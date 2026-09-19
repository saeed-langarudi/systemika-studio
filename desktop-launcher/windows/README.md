# Systemika Studio Windows desktop launcher

This Go launcher is the source for the student-facing Windows desktop executable.

On first launch it:

1. Copies itself to `%LOCALAPPDATA%\Programs\Systemika Studio\Systemika Studio 1.0.1.exe`.
2. Extracts `Systemika Studio.ico` beside the installed executable.
3. Creates a `Systemika Studio` shortcut on the Desktop.
4. Creates a `Systemika Studio` entry in the current user's Start Menu.
5. Relaunches the installed copy, which opens Systemika Studio in a dedicated Chromium application window.

No administrator privileges are required. The shortcuts explicitly use the Systemika Studio icon.

Example cross-build command:

```sh
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -H=windowsgui" -o Systemika-Studio-1.0.1-Desktop-Windows.exe main.go
```
