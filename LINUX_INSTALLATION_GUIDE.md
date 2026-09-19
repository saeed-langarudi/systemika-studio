# Systemika Studio 1.0.6 — Linux Installation Guide

This guide is written for users who are new to Linux. It explains how to build Systemika Studio as a Linux AppImage, install the application launcher, and start Systemika Studio from the normal Applications menu.

You do **not** need administrator (`sudo`) privileges to install the Systemika Studio launcher. The launcher is installed only for your own Linux user account.

## 1. What you will install

The Linux build uses an **AppImage**. An AppImage is a portable Linux application file. The build process creates the AppImage from the Systemika Studio source code, and the included launcher installer then copies it to a stable location in your home folder and registers it with your desktop environment.

After the process is complete, you should be able to launch **Systemika Studio** from your Linux Applications menu. On desktop environments that provide a Desktop folder, the installer also creates a Desktop shortcut.

The launcher installer places files in these locations:

- Application: `~/.local/opt/systemika-studio/Systemika-Studio.AppImage`
- Applications-menu launcher: `~/.local/share/applications/systemika-studio.desktop`
- Icon: `~/.local/share/icons/hicolor/256x256/apps/systemika-studio.png`
- Optional Desktop shortcut: usually `~/Desktop/Systemika Studio.desktop`

`~` means your home folder. For example, if your Linux username is `alex`, `~/.local/` refers to `/home/alex/.local/`.

## 2. Before you begin

You need:

1. A Linux computer with a graphical desktop environment.
2. The Systemika Studio 1.0.6 source folder.
3. An internet connection while building, because npm downloads the required packaging dependencies.
4. Node.js **22.12 or newer** (a current Node.js LTS release) and npm installed.

Systemika Studio itself can run offline after it has been built and installed.

### Check whether Node.js and npm are installed

Open a Terminal window and enter:

```bash
node --version
npm --version
```

If `node --version` reports **v22.12.0 or newer** and npm prints a version number, continue to the next section.

If either command says `command not found`, install a current **Node.js LTS** release using the normal software/package manager for your Linux distribution, then run the two commands again.

Do not run the Systemika build with `sudo`. If Node.js works as your normal user but you run the build through `sudo`, the root account may not be able to find your Node.js/npm installation.

## 3. Open a Terminal in the Systemika Studio source folder

The easiest method is to open your file manager, open the Systemika Studio source folder, right-click an empty area, and choose an option similar to **Open in Terminal**. The exact wording depends on your Linux desktop.

Alternatively, use `cd` in a terminal. For example:

```bash
cd ~/Downloads/Systemika-Studio-1.0.6-Source
```

Replace that path with the actual location of your source folder.

To confirm that you are in the correct folder, run:

```bash
ls
```

You should see files including:

```text
BUILD_LINUX_APPIMAGE.sh
INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
package.json
distribute
```

## 4. Build the Linux AppImage

The Linux build script may not initially have permission to run. Give it executable permission once:

```bash
chmod +x BUILD_LINUX_APPIMAGE.sh
```

Then build Systemika Studio:

```bash
./BUILD_LINUX_APPIMAGE.sh
```

Do **not** use:

```bash
sudo ./BUILD_LINUX_APPIMAGE.sh
```

The build script will:

1. Check that Node.js and npm are available.
2. Install the pinned Electron packaging tool (`electron-builder` 26.16.1).
3. Stage Systemika with a dependency-free Node build script.
4. Build the Linux AppImage with Electron 44.3.0 using Electron Builder's static AppImage runtime toolset (`1.0.3`).

The 1.0.6 source no longer uses Gulp or the older electron-builder 26.0.x toolchain that produced the earlier `tar@6.2.1`, Git `node-gyp`, and high/critical audit warnings. npm can still display upstream deprecation notices from electron-builder's own build-only transitive packages. Those packages are not Systemika runtime application dependencies. The AppImage is also built with the modern static runtime, so students should not need the legacy `libfuse.so.2`/FUSE2 package merely to launch Systemika. Do not run `npm audit fix --force` on the release source. See `BUILD_TOOLCHAIN_SECURITY.md` for details.

When the build succeeds, the script prints the location of the generated `.AppImage` file. It is normally located in:

```text
distribute/output/dist-electron/
```

### Important: do not use `distribute/build.sh` as the Linux installer

`distribute/build.sh` is an internal application-build script. It is **not** the recommended Linux packaging or installation command.

For Linux, use the root-level script:

```bash
./BUILD_LINUX_APPIMAGE.sh
```

## 5. Install the Systemika Studio launcher

After the AppImage has been built successfully, give the launcher installer permission to run:

```bash
chmod +x INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
```

Then run it:

```bash
./INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
```

Again, do **not** use `sudo`.

The installer automatically finds the most recently built Systemika Studio AppImage and copies it into your user account. It then installs the Systemika Studio icon and application-menu launcher.

A successful installation ends with a message similar to:

```text
Systemika Studio launcher installed successfully.
Application menu entry: .../.local/share/applications/systemika-studio.desktop
Installed AppImage:      .../.local/opt/systemika-studio/Systemika-Studio.AppImage
```

## 6. Start Systemika Studio

Open your normal Linux Applications menu and search for:

**Systemika Studio**

Select the application to launch it.

If your desktop environment supports Desktop launchers, you may also see a **Systemika Studio** icon on your Desktop.

Some GNOME-based Linux desktops may display a Desktop launcher as an untrusted file the first time it appears. If that happens, right-click the Desktop icon and choose **Allow Launching**. The Applications-menu launcher should normally work without this extra step.

## 7. Updating Systemika Studio later

When you obtain an updated Systemika Studio source package:

1. Build the new AppImage with:

   ```bash
   ./BUILD_LINUX_APPIMAGE.sh
   ```

2. Run the launcher installer again:

   ```bash
   ./INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
   ```

The installer replaces the previously installed AppImage with the newly built version while keeping the same Applications-menu entry and shortcut location.

## 8. Uninstalling Systemika Studio

Systemika Studio is installed only inside your user account. No system-wide uninstall program is required.

To remove it, open a Terminal and run:

```bash
rm -rf "$HOME/.local/opt/systemika-studio"
rm -f "$HOME/.local/share/applications/systemika-studio.desktop"
rm -f "$HOME/.local/share/icons/hicolor/256x256/apps/systemika-studio.png"
```

If a Desktop shortcut was created, you can delete **Systemika Studio.desktop** from your Desktop like any other file.

You do not need `sudo` to uninstall these files.

## 9. Troubleshooting

### `Permission denied` when running a `.sh` file

If you enter:

```bash
./BUILD_LINUX_APPIMAGE.sh
```

or:

```bash
./INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
```

and Linux reports `Permission denied`, give the file executable permission:

```bash
chmod +x BUILD_LINUX_APPIMAGE.sh
chmod +x INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
```

Then run the command again.

### `node: command not found` or `npm: command not found`

Node.js/npm is either not installed or not available in your normal shell environment.

Check with:

```bash
node --version
npm --version
```

Install a current Node.js LTS release if needed. Then close and reopen the Terminal and try again.

Do not try to solve this by adding `sudo` before the Systemika build command. `sudo` uses a different environment and may make an otherwise working Node/npm installation disappear from the command path.

### The launcher says that no AppImage was found

The AppImage has not been built yet, or the build did not finish successfully.

From the Systemika Studio source root, run:

```bash
chmod +x BUILD_LINUX_APPIMAGE.sh
./BUILD_LINUX_APPIMAGE.sh
```

After it succeeds, run:

```bash
./INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
```

### Systemika Studio does not appear immediately in the Applications menu

First, wait a few seconds and search again. Some desktop environments cache application menus.

You can also log out and back in, or restart your desktop session. The launcher file should exist at:

```text
~/.local/share/applications/systemika-studio.desktop
```

### The Desktop shortcut does not appear

Not every Linux desktop uses a traditional Desktop folder, and some desktops disable Desktop icons entirely. This does not mean the installation failed.

Search for **Systemika Studio** in the Applications menu. The Applications-menu entry is the primary launcher.

### The AppImage reports a FUSE-related error

The Systemika Studio 1.0.6 builder uses Electron Builder's static AppImage runtime (`toolsets.appimage = 1.0.3`), so the finished AppImage should **not** require the legacy FUSE2 library (`libfuse.so.2`) merely to start. If a newly built Systemika AppImage still reports a FUSE2/libfuse2 error, first confirm that you are building from the 1.0.6 source package and rebuild it with `./BUILD_LINUX_APPIMAGE.sh`. Do not install an obsolete FUSE2 package solely as a workaround for an AppImage produced by an older Systemika build configuration.

## 10. Quick installation summary

For users who already have Node.js and npm installed, the complete process from the Systemika Studio source root is:

```bash
chmod +x BUILD_LINUX_APPIMAGE.sh
./BUILD_LINUX_APPIMAGE.sh

chmod +x INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
./INSTALL_SYSTEMIKA_LINUX_LAUNCHER.sh
```

No `sudo` is required for either command.
