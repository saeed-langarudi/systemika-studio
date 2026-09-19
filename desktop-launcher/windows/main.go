package main

import (
	"bytes"
	"embed"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

const version = "1.0.1"

//go:embed app/**
var embedded embed.FS

var (
	heartbeatMu   sync.Mutex
	lastHeartbeat time.Time
	gotHeartbeat  bool
)

func main() {
	if runtime.GOOS != "windows" {
		fatal(fmt.Errorf("this build is for Windows"))
	}

	// Installation/shortcut repair must happen BEFORE the existing-session
	// check. Earlier builds checked for a running local server first, which
	// meant launching a new downloaded EXE while Systemika was already open
	// skipped the first-run setup entirely and created no shortcuts.
	existingURL := findExisting()

	// First launch is also the installation step. The downloaded EXE copies
	// itself into the current user's local Programs directory, writes the
	// Systemika Studio icon there, and creates/repairs Start Menu + Desktop
	// shortcuts. No administrator privileges are required.
	installedExe, runningInstalledCopy, err := ensureInstalled(existingURL != "")
	if err != nil {
		fatal(fmt.Errorf("could not set up Systemika Studio shortcuts: %w", err))
	}

	// If this exact release is already running, the setup above has now still
	// repaired/created its shortcuts. Just open another app window.
	if existingURL != "" {
		if err := openDesktopWindow(existingURL); err != nil {
			fatal(err)
		}
		return
	}

	if !runningInstalledCopy {
		if err := exec.Command(installedExe, "--installed").Start(); err != nil {
			fatal(fmt.Errorf("Systemika Studio was installed but could not be started: %w", err))
		}
		return
	}

	sub, err := fs.Sub(embedded, "app")
	if err != nil {
		fatal(err)
	}

	ln, port, err := listenAvailable(8765, 21)
	if err != nil {
		fatal(err)
	}
	url := fmt.Sprintf("http://localhost:%d/start.html", port)

	mux := http.NewServeMux()
	mux.HandleFunc("/__systemika_version", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		_, _ = fmt.Fprint(w, version)
	})
	mux.HandleFunc("/__systemika_ping", func(w http.ResponseWriter, r *http.Request) {
		heartbeatMu.Lock()
		lastHeartbeat = time.Now()
		gotHeartbeat = true
		heartbeatMu.Unlock()
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusNoContent)
	})

	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		serveEmbeddedFile(sub, w, r)
	})

	server := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}

	go func() {
		time.Sleep(400 * time.Millisecond)
		if err := openDesktopWindow(url); err != nil {
			fatal(fmt.Errorf("could not open the Systemika Studio desktop window: %w", err))
		}
	}()

	// Shut down the private local server after the application window is gone.
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			heartbeatMu.Lock()
			seen := gotHeartbeat
			last := lastHeartbeat
			heartbeatMu.Unlock()
			if seen && time.Since(last) > 2*time.Minute {
				_ = server.Close()
				return
			}
		}
	}()

	if err := server.Serve(ln); err != nil && !errors.Is(err, http.ErrServerClosed) {
		fatal(err)
	}
}

// serveEmbeddedFile serves the requested embedded asset directly instead of
// delegating to http.FileServer. FileServer canonicalizes any URL ending in
// /index.html by redirecting it to the containing directory. Systemika also
// resolves directory URLs to index.html, so combining the two behaviours
// creates an infinite redirect loop. Direct serving keeps both URL forms valid
// without emitting redirects.
func serveEmbeddedFile(appFS fs.FS, w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	p := strings.TrimPrefix(r.URL.Path, "/")
	if p == "" {
		p = "start.html"
	}
	clean := path.Clean(p)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	info, err := fs.Stat(appFS, clean)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if info.IsDir() {
		clean = path.Join(clean, "index.html")
		info, err = fs.Stat(appFS, clean)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
	}

	data, err := fs.ReadFile(appFS, clean)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Cache-Control", "no-store")
	if ct := mime.TypeByExtension(path.Ext(clean)); ct != "" {
		w.Header().Set("Content-Type", ct)
	}
	http.ServeContent(w, r, path.Base(clean), info.ModTime(), bytes.NewReader(data))
}

func ensureInstalled(existingSession bool) (installedExe string, runningInstalledCopy bool, err error) {
	localAppData := os.Getenv("LOCALAPPDATA")
	if localAppData == "" {
		return "", false, fmt.Errorf("Windows LOCALAPPDATA is not available")
	}

	installDir := filepath.Join(localAppData, "Programs", "Systemika Studio")
	installedExe = filepath.Join(installDir, "Systemika Studio "+version+".exe")
	iconPath := filepath.Join(installDir, "Systemika Studio.ico")
	if err := os.MkdirAll(installDir, 0755); err != nil {
		return "", false, err
	}

	currentExe, err := os.Executable()
	if err != nil {
		return "", false, err
	}
	currentExe, _ = filepath.Abs(currentExe)
	installedAbs, _ := filepath.Abs(installedExe)
	runningInstalledCopy = strings.EqualFold(filepath.Clean(currentExe), filepath.Clean(installedAbs))

	if !runningInstalledCopy {
		_, statErr := os.Stat(installedExe)
		switch {
		case errors.Is(statErr, os.ErrNotExist):
			// No installed copy yet: create it even if another portable instance
			// of this release is currently serving the UI.
			if err := copyExecutableAtomically(currentExe, installedExe); err != nil {
				return "", false, err
			}
		case statErr != nil:
			return "", false, statErr
		case !existingSession:
			// Safe to refresh the installed copy when this release is not active.
			if err := copyExecutableAtomically(currentExe, installedExe); err != nil {
				return "", false, err
			}
		default:
			// An installed copy of this release is already running. Windows may
			// lock the executable, so leave it in place and repair shortcuts only.
		}
	}

	iconBytes, err := fs.ReadFile(embedded, "app/app-icons/systemika.ico")
	if err != nil {
		return "", false, fmt.Errorf("embedded application icon is missing: %w", err)
	}
	if err := os.WriteFile(iconPath, iconBytes, 0644); err != nil {
		return "", false, err
	}

	if err := createWindowsShortcuts(installedExe, iconPath); err != nil {
		return "", false, err
	}
	return installedExe, runningInstalledCopy, nil
}

func copyExecutableAtomically(src, dst string) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()

	tmp := dst + ".new"
	out, err := os.Create(tmp)
	if err != nil {
		return err
	}
	_, copyErr := io.Copy(out, in)
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(tmp)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}

	// The caller avoids replacing an installed executable while that exact
	// release is already running.
	_ = os.Remove(dst)
	if err := os.Rename(tmp, dst); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

func createWindowsShortcuts(targetExe, iconPath string) error {
	// WScript.Shell is available on supported Windows versions and creates
	// genuine .lnk shortcuts. Paths are passed through environment variables
	// so usernames containing spaces or apostrophes do not require escaping.
	// PowerShell also returns the resolved shortcut paths so Go can verify them.
	ps := `$ErrorActionPreference = 'Stop';
$ws = New-Object -ComObject WScript.Shell;
$desktop = [Environment]::GetFolderPath('Desktop');
$startMenu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs';
New-Item -ItemType Directory -Force -Path $desktop | Out-Null;
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null;
function New-SystemikaShortcut([string]$shortcutPath) {
  $s = $ws.CreateShortcut($shortcutPath);
  $s.TargetPath = $env:SYSTEMIKA_TARGET;
  $s.WorkingDirectory = Split-Path -Parent $env:SYSTEMIKA_TARGET;
  $s.IconLocation = $env:SYSTEMIKA_ICON + ',0';
  $s.Description = 'Systemika Studio';
  $s.Save();
}
$desktopShortcut = Join-Path $desktop 'Systemika Studio.lnk';
$startShortcut = Join-Path $startMenu 'Systemika Studio.lnk';
New-SystemikaShortcut $desktopShortcut;
New-SystemikaShortcut $startShortcut;
Write-Output $desktopShortcut;
Write-Output $startShortcut;`

	cmd := exec.Command("powershell.exe", "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps)
	cmd.Env = append(os.Environ(),
		"SYSTEMIKA_TARGET="+targetExe,
		"SYSTEMIKA_ICON="+iconPath,
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if msg == "" {
			msg = err.Error()
		}
		return fmt.Errorf("could not create Windows shortcuts: %s", msg)
	}

	lines := strings.Split(strings.ReplaceAll(strings.TrimSpace(string(out)), "\r\n", "\n"), "\n")
	if len(lines) < 2 {
		return fmt.Errorf("Windows did not report the created shortcut locations")
	}
	desktopShortcut := strings.TrimSpace(lines[len(lines)-2])
	startShortcut := strings.TrimSpace(lines[len(lines)-1])
	for _, shortcut := range []string{desktopShortcut, startShortcut} {
		if shortcut == "" {
			return fmt.Errorf("Windows returned an empty shortcut location")
		}
		if info, err := os.Stat(shortcut); err != nil || info.IsDir() {
			if err != nil {
				return fmt.Errorf("shortcut was not created at %s: %w", shortcut, err)
			}
			return fmt.Errorf("shortcut path is not a file: %s", shortcut)
		}
	}
	return nil
}

func listenAvailable(first, count int) (net.Listener, int, error) {
	for p := first; p < first+count; p++ {
		ln, err := net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", p))
		if err == nil {
			return ln, p, nil
		}
	}
	return nil, 0, fmt.Errorf("could not open a local Systemika Studio port")
}

func findExisting() string {
	client := &http.Client{Timeout: 250 * time.Millisecond}
	for p := 8765; p < 8786; p++ {
		base := fmt.Sprintf("http://localhost:%d", p)
		resp, err := client.Get(base + "/__systemika_version")
		if err != nil {
			continue
		}
		b := make([]byte, 32)
		n, _ := resp.Body.Read(b)
		_ = resp.Body.Close()
		if resp.StatusCode == 200 && strings.TrimSpace(string(b[:n])) == version {
			return base + "/start.html"
		}
	}
	return ""
}

func openDesktopWindow(url string) error {
	// Chromium's --app mode gives Systemika Studio a dedicated application
	// window: no browser tabs, address bar, bookmarks bar, or navigation UI.
	// We keep the user's normal browser profile so project-folder permissions
	// persist in the same way as the tested web build.
	candidates := []string{
		`C:\Program Files\Microsoft\Edge\Application\msedge.exe`,
		`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`,
		pathJoin(os.Getenv("LOCALAPPDATA"), `Microsoft\Edge\Application\msedge.exe`),
		`C:\Program Files\Google\Chrome\Application\chrome.exe`,
		`C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`,
		pathJoin(os.Getenv("LOCALAPPDATA"), `Google\Chrome\Application\chrome.exe`),
	}
	for _, exe := range candidates {
		if exe == "" {
			continue
		}
		if _, err := os.Stat(exe); err != nil {
			continue
		}
		args := []string{
			"--app=" + url,
			"--start-maximized",
			"--no-first-run",
			"--disable-default-apps",
		}
		if err := exec.Command(exe, args...).Start(); err == nil {
			return nil
		}
	}
	return fmt.Errorf("Microsoft Edge or Google Chrome was not found. Install Edge or Chrome and try again")
}

func pathJoin(base, rest string) string {
	if base == "" {
		return ""
	}
	if strings.HasSuffix(base, "\\") {
		return base + rest
	}
	return base + "\\" + rest
}

func fatal(err error) {
	msg := strings.ReplaceAll(err.Error(), "'", "''")
	_ = exec.Command("powershell", "-NoProfile", "-Command", "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('"+msg+"','Systemika Studio')").Run()
	log.Print(err)
	os.Exit(1)
}
