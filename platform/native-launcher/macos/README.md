# Systemika Studio macOS launcher

This directory contains the Go source for the native entry point used by the Systemika Studio macOS application bundle.

Do not build this file manually unless you are maintaining the launcher itself. The supported public build path is the root-level `BUILD_MACOS_INSTALLER.command`, documented in `docs/guides/MACOS_INSTALLER_GUIDE.md`.

The builder compiles the launcher for `darwin/amd64` and `darwin/arm64`, combines the executables into one Universal binary, places the application payload under `Contents/Resources/app`, and creates the distributable DMG/ZIP output.

The installed application does not require Node.js or Go.
