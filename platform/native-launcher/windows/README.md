# Systemika Studio Windows native launcher

This directory contains the Go source for the legacy/native Windows launcher implementation retained for maintenance and regression coverage.

The normal public Windows installer is built from the source root with `BUILD_WINDOWS_INSTALLER.bat`; its packaging configuration lives under `build/`. Do not compile this launcher manually unless you are specifically maintaining the native launcher path.

The launcher installs into the current user's profile, creates Desktop/Start Menu shortcuts, and does not require administrator privileges for its own user-level installation behavior.
