# Systemika Studio macOS launcher

This directory contains the Go source for the native entry point used by the Systemika Studio 1.0.1 macOS application bundle.

Do not build this file manually unless you are maintaining the launcher itself. The supported public build path is the root-level `BUILD_MACOS_INSTALLER.command`, documented in `MACOS_INSTALLER_GUIDE.md`.

The builder cross-compiles the launcher for `darwin/amd64` and `darwin/arm64`, combines the two Mach-O executables into one Universal binary, places the application payload under `Contents/Resources/app`, and creates a distributable DMG.

The installed application does not require Node.js or Go. For full project-folder and saved-run functionality, a Chromium-based browser (Chrome, Edge, or Chromium) is recommended on the user's Mac.
