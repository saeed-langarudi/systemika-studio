# Systemika Studio 1.1 — Windows installer builder

For the simplest Windows build, double-click:

`BUILD_WINDOWS_INSTALLER.bat`

The builder checks for Node.js automatically. If Node.js is missing and Windows Package Manager (`winget`) is available, it installs the current Node.js LTS package and continues. Windows may show a UAC prompt during this one-time build-prerequisite installation.

The finished installer is written to:

`build\output\dist-electron\Systemika-Studio-Setup-1.1.3-x64.exe`

Node.js 22.12 or newer is required only on the computer that builds the installer. Students and other users who install Systemika Studio from the resulting `.exe` do not need Node.js or npm.

If `winget` is unavailable, install Node.js LTS manually from the official Node.js website, then run `BUILD_WINDOWS_INSTALLER.bat` again.
