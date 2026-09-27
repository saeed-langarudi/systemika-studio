package main

import (
	"bytes"
	"errors"
	"fmt"
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

var (
	heartbeatMu   sync.Mutex
	lastHeartbeat time.Time
	gotHeartbeat  bool
)

func main() {
	root, err := applicationRoot()
	if err != nil {
		fatal(err)
	}

	if existing := findExisting(); existing != "" {
		if os.Getenv("SYSTEMIKA_TEST_NO_BROWSER") == "" {
			if err := openDesktopWindow(existing); err != nil {
				fatal(err)
			}
		}
		return
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
		serveFile(root, w, r)
	})

	server := &http.Server{Handler: mux, ReadHeaderTimeout: 10 * time.Second}

	if os.Getenv("SYSTEMIKA_TEST_NO_BROWSER") == "" {
		go func() {
			time.Sleep(400 * time.Millisecond)
			if err := openDesktopWindow(url); err != nil {
				fmt.Fprintln(os.Stderr, "Systemika Studio could not open a Chromium application window:", err)
				_ = exec.Command("/usr/bin/open", url).Start()
			}
		}()
	} else {
		fmt.Println(url)
	}

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

func applicationRoot() (string, error) {
	// Tests/build verification can supply the payload explicitly. Ignore
	// unrelated LaunchServices arguments (for example historical -psn_*
	// arguments) unless the argument actually names a Systemika payload.
	if len(os.Args) > 1 && os.Args[1] != "" {
		if candidate, err := filepath.Abs(os.Args[1]); err == nil {
			if st, statErr := os.Stat(filepath.Join(candidate, "start.html")); statErr == nil && !st.IsDir() {
				return candidate, nil
			}
		}
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	// .app layout:
	// Contents/MacOS/Systemika Studio
	// Contents/Resources/app/start.html
	contents := filepath.Dir(filepath.Dir(exe))
	root := filepath.Join(contents, "Resources", "app")
	if st, err := os.Stat(filepath.Join(root, "start.html")); err != nil || st.IsDir() {
		return "", fmt.Errorf("Systemika Studio application files were not found in %s", root)
	}
	return root, nil
}

func serveFile(root string, w http.ResponseWriter, r *http.Request) {
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

	full := filepath.Join(root, filepath.FromSlash(clean))
	rel, err := filepath.Rel(root, full)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}
	info, err := os.Stat(full)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if info.IsDir() {
		full = filepath.Join(full, "index.html")
		info, err = os.Stat(full)
		if err != nil || info.IsDir() {
			http.NotFound(w, r)
			return
		}
		clean = path.Join(clean, "index.html")
	}
	data, err := os.ReadFile(full)
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
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("macOS launcher used on %s", runtime.GOOS)
	}
	home, _ := os.UserHomeDir()
	candidates := []struct{ appPath, appName string }{
		{"/Applications/Google Chrome.app", "Google Chrome"},
		{filepath.Join(home, "Applications/Google Chrome.app"), "Google Chrome"},
		{"/Applications/Microsoft Edge.app", "Microsoft Edge"},
		{filepath.Join(home, "Applications/Microsoft Edge.app"), "Microsoft Edge"},
		{"/Applications/Chromium.app", "Chromium"},
		{filepath.Join(home, "Applications/Chromium.app"), "Chromium"},
	}
	for _, c := range candidates {
		if _, err := os.Stat(c.appPath); err != nil {
			continue
		}
		// -n starts a dedicated browser instance; --app removes normal browser
		// chrome so Systemika Studio appears in its own application window.
		args := []string{"-n", "-a", c.appName, "--args", "--app=" + url, "--no-first-run", "--disable-default-apps"}
		if err := exec.Command("/usr/bin/open", args...).Start(); err == nil {
			return nil
		}
	}
	return fmt.Errorf("Google Chrome, Microsoft Edge, or Chromium was not found")
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "Systemika Studio could not start:")
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}
