#!/usr/bin/env bash
set -euo pipefail

# Installs a built Systemika Studio AppImage and registers a Linux application launcher.
# Run from the Systemika Studio source root after BUILD_LINUX_APPIMAGE.sh has completed.
# No sudo is required.

if [ "${EUID:-$(id -u)}" -eq 0 ]; then
  echo "Please run this installer as your normal user, not with sudo." >&2
  echo "The launcher is installed only for your user account under ~/.local/." >&2
  exit 1
fi

ROOT="${1:-$(pwd)}"
if [ ! -f "$ROOT/BUILD_LINUX_APPIMAGE.sh" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/BUILD_LINUX_APPIMAGE.sh" ]; then
    ROOT="$SCRIPT_DIR"
  else
    echo "Could not find the Systemika Studio source root." >&2
    echo "Run this script from the source root, or pass the source root as its first argument." >&2
    exit 1
  fi
fi

OUT="$ROOT/distribute/output/dist-electron"
APPIMAGE="$(find "$OUT" -maxdepth 1 -type f -name '*.AppImage' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2- || true)"
if [ -z "$APPIMAGE" ] || [ ! -f "$APPIMAGE" ]; then
  echo "No AppImage was found in:" >&2
  echo "  $OUT" >&2
  echo >&2
  echo "Build it first with:" >&2
  echo "  chmod +x BUILD_LINUX_APPIMAGE.sh" >&2
  echo "  ./BUILD_LINUX_APPIMAGE.sh" >&2
  exit 1
fi

APP_DIR="$HOME/.local/opt/systemika-studio"
APPLICATIONS_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
DESKTOP_FILE="$APPLICATIONS_DIR/systemika-studio.desktop"
ICON_SOURCE="$ROOT/app-icons/systemika.png"

mkdir -p "$APP_DIR" "$APPLICATIONS_DIR" "$ICON_DIR"

printf 'Installing Systemika Studio AppImage...\n'
cp -f "$APPIMAGE" "$APP_DIR/Systemika-Studio.AppImage"
chmod +x "$APP_DIR/Systemika-Studio.AppImage"

if [ -f "$ICON_SOURCE" ]; then
  cp -f "$ICON_SOURCE" "$ICON_DIR/systemika-studio.png"
fi

cat > "$DESKTOP_FILE" <<'DESKTOP'
[Desktop Entry]
Version=1.0
Type=Application
Name=Systemika Studio
GenericName=System Dynamics Modeling and Simulation
Comment=Build, simulate, and analyze system dynamics models
Exec=sh -c 'exec "$HOME/.local/opt/systemika-studio/Systemika-Studio.AppImage"'
Icon=systemika-studio
Terminal=false
Categories=Education;Science;
StartupNotify=true
StartupWMClass=Systemika Studio
DESKTOP
chmod +x "$DESKTOP_FILE"

# Refresh menu/icon databases when the host desktop provides the tools.
if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database "$APPLICATIONS_DIR" >/dev/null 2>&1 || true
fi
if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true
fi

# Also create a Desktop shortcut when the user's desktop directory exists.
DESKTOP_DIR=""
if command -v xdg-user-dir >/dev/null 2>&1; then
  DESKTOP_DIR="$(xdg-user-dir DESKTOP 2>/dev/null || true)"
fi
if [ -z "$DESKTOP_DIR" ] || [ "$DESKTOP_DIR" = "$HOME" ]; then
  if [ -d "$HOME/Desktop" ]; then
    DESKTOP_DIR="$HOME/Desktop"
  fi
fi

if [ -n "$DESKTOP_DIR" ] && [ -d "$DESKTOP_DIR" ]; then
  cp -f "$DESKTOP_FILE" "$DESKTOP_DIR/Systemika Studio.desktop"
  chmod +x "$DESKTOP_DIR/Systemika Studio.desktop"
  if command -v gio >/dev/null 2>&1; then
    gio set "$DESKTOP_DIR/Systemika Studio.desktop" metadata::trusted true >/dev/null 2>&1 || true
  fi
  printf 'Desktop shortcut: %s\n' "$DESKTOP_DIR/Systemika Studio.desktop"
fi

printf '\nSystemika Studio launcher installed successfully.\n'
printf 'Application menu entry: %s\n' "$DESKTOP_FILE"
printf 'Installed AppImage:      %s\n' "$APP_DIR/Systemika-Studio.AppImage"
printf '\nYou should now find "Systemika Studio" in your Applications menu.\n'
