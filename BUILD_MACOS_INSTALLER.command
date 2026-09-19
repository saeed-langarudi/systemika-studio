#!/usr/bin/env bash
set -euo pipefail

# Finder launches .command files with a minimal PATH. Add the normal locations
# used by the official Go installer, Homebrew on Apple Silicon, and Homebrew on Intel.
export PATH="/usr/local/go/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

finish() {
  status=$?
  trap - EXIT
  if [ -t 0 ]; then
    echo
    if [ "$status" -eq 0 ]; then
      echo "Systemika Studio macOS build finished successfully."
    else
      echo "The Systemika Studio macOS build stopped because of an error."
    fi
    read -r -p "Press Return to close this window..." _ || true
  fi
  exit "$status"
}
trap finish EXIT

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "This builder must be run on macOS." >&2
  echo "Use a Mac to create the final .app and .dmg files." >&2
  exit 1
fi

VERSION="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$ROOT/package.json" | head -n 1)"
if [ -z "$VERSION" ]; then
  echo "Could not read the Systemika Studio version from package.json." >&2
  exit 1
fi

printf 'Systemika Studio %s — macOS Universal installer builder\n\n' "$VERSION"

if ! xcode-select -p >/dev/null 2>&1; then
  echo "Apple Command Line Tools are not installed." >&2
  echo "Run: xcode-select --install" >&2
  echo "Complete the Apple installer, then run this file again." >&2
  exit 1
fi

for tool in go /usr/bin/lipo /usr/bin/ditto /usr/bin/codesign /usr/bin/hdiutil; do
  if [ "$tool" = "go" ]; then
    if ! command -v go >/dev/null 2>&1; then
      echo "Go is not installed or is not on PATH." >&2
      echo "Install the current macOS Go package from https://go.dev/dl/ and run this file again." >&2
      exit 1
    fi
  elif [ ! -x "$tool" ]; then
    echo "Required macOS build tool is missing: $tool" >&2
    exit 1
  fi
done

printf 'Using Go: %s\n' "$(go version)"
printf 'Using Apple developer tools: %s\n\n' "$(xcode-select -p)"

BUILD_DIR="$ROOT/release/macos"
WORK_DIR="$BUILD_DIR/.work"
APP_NAME="Systemika Studio.app"
APP_PATH="$BUILD_DIR/$APP_NAME"
DMG_NAME="Systemika-Studio-$VERSION-macOS-Universal.dmg"
ZIP_NAME="Systemika-Studio-$VERSION-macOS-Universal.zip"
DMG_PATH="$BUILD_DIR/$DMG_NAME"
ZIP_PATH="$BUILD_DIR/$ZIP_NAME"

rm -rf "$WORK_DIR" "$APP_PATH" "$DMG_PATH" "$ZIP_PATH"
mkdir -p "$WORK_DIR/bin" "$APP_PATH/Contents/MacOS" "$APP_PATH/Contents/Resources/app"

LAUNCHER_SOURCE="$ROOT/desktop-launcher/macos/main.go"
if [ ! -f "$LAUNCHER_SOURCE" ]; then
  echo "macOS launcher source was not found: $LAUNCHER_SOURCE" >&2
  exit 1
fi

# Build both Mac CPU architectures even when the build Mac itself has only one.
echo "Building Intel (x86_64) launcher..."
CGO_ENABLED=0 GOOS=darwin GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o "$WORK_DIR/bin/systemika-amd64" "$LAUNCHER_SOURCE"

echo "Building Apple Silicon (arm64) launcher..."
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w" -o "$WORK_DIR/bin/systemika-arm64" "$LAUNCHER_SOURCE"

echo "Combining both architectures into one Universal executable..."
/usr/bin/lipo -create \
  "$WORK_DIR/bin/systemika-amd64" \
  "$WORK_DIR/bin/systemika-arm64" \
  -output "$APP_PATH/Contents/MacOS/Systemika Studio"
chmod +x "$APP_PATH/Contents/MacOS/Systemika Studio"

# Copy only files needed by the installed application. Development tests,
# source build scripts, and release documentation stay outside the app bundle.
echo "Copying Systemika Studio application files..."
/usr/bin/ditto "$ROOT/start.html" "$APP_PATH/Contents/Resources/app/start.html"
/usr/bin/ditto "$ROOT/OpenSystemDynamics" "$APP_PATH/Contents/Resources/app/OpenSystemDynamics"
/usr/bin/ditto "$ROOT/MultiSimulationAnalyser" "$APP_PATH/Contents/Resources/app/MultiSimulationAnalyser"
/usr/bin/ditto "$ROOT/app-icons" "$APP_PATH/Contents/Resources/app/app-icons"

mkdir -p "$APP_PATH/Contents/Resources/licenses"
/usr/bin/ditto "$ROOT/LICENSE.txt" "$APP_PATH/Contents/Resources/licenses/LICENSE.txt"
/usr/bin/ditto "$ROOT/COPYRIGHT.txt" "$APP_PATH/Contents/Resources/licenses/COPYRIGHT.txt"
/usr/bin/ditto "$ROOT/third-party-licenses.md" "$APP_PATH/Contents/Resources/licenses/third-party-licenses.md"
/usr/bin/ditto "$ROOT/app-icons/systemika.icns" "$APP_PATH/Contents/Resources/systemika.icns"

cat > "$APP_PATH/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Systemika Studio</string>
  <key>CFBundleExecutable</key>
  <string>Systemika Studio</string>
  <key>CFBundleIconFile</key>
  <string>systemika.icns</string>
  <key>CFBundleIdentifier</key>
  <string>org.systemika.studio</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Systemika Studio</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$VERSION</string>
  <key>CFBundleVersion</key>
  <string>$VERSION</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

SIGN_IDENTITY="${SYSTEMIKA_SIGN_IDENTITY:-}"
NOTARY_PROFILE="${SYSTEMIKA_NOTARY_PROFILE:-}"

if [ -n "$SIGN_IDENTITY" ]; then
  echo "Signing the application with: $SIGN_IDENTITY"
  /usr/bin/codesign --force --deep --options runtime --timestamp --sign "$SIGN_IDENTITY" "$APP_PATH"
else
  echo "Applying an ad-hoc signature (suitable for local/classroom testing, not frictionless public distribution)..."
  /usr/bin/codesign --force --deep --sign - "$APP_PATH"
fi

/usr/bin/codesign --verify --deep --strict "$APP_PATH"
/usr/bin/lipo -info "$APP_PATH/Contents/MacOS/Systemika Studio"

echo "Creating ZIP archive..."
/usr/bin/ditto -c -k --sequesterRsrc --keepParent "$APP_PATH" "$ZIP_PATH"

echo "Creating DMG installer image..."
DMG_STAGE="$WORK_DIR/dmg"
mkdir -p "$DMG_STAGE"
/usr/bin/ditto "$APP_PATH" "$DMG_STAGE/$APP_NAME"
ln -s /Applications "$DMG_STAGE/Applications"
/usr/bin/hdiutil create \
  -volname "Systemika Studio $VERSION" \
  -srcfolder "$DMG_STAGE" \
  -ov \
  -format UDZO \
  "$DMG_PATH" >/dev/null

if [ -n "$SIGN_IDENTITY" ]; then
  echo "Signing the DMG..."
  /usr/bin/codesign --force --timestamp --sign "$SIGN_IDENTITY" "$DMG_PATH"
fi

if [ -n "$NOTARY_PROFILE" ]; then
  if [ -z "$SIGN_IDENTITY" ]; then
    echo "SYSTEMIKA_NOTARY_PROFILE was supplied without SYSTEMIKA_SIGN_IDENTITY." >&2
    echo "Notarization requires a Developer ID-signed application." >&2
    exit 1
  fi
  echo "Submitting DMG to Apple for notarization..."
  xcrun notarytool submit "$DMG_PATH" --keychain-profile "$NOTARY_PROFILE" --wait
  echo "Stapling Apple's notarization ticket..."
  xcrun stapler staple "$DMG_PATH"
  xcrun stapler validate "$DMG_PATH"
fi

/usr/bin/hdiutil verify "$DMG_PATH" >/dev/null

(
  cd "$BUILD_DIR"
  /usr/bin/shasum -a 256 "$DMG_NAME" "$ZIP_NAME" > SHA256SUMS.txt
)

rm -rf "$WORK_DIR"

printf '\nCreated files:\n'
printf '  %s\n' "$DMG_PATH"
printf '  %s\n' "$ZIP_PATH"
printf '  %s\n' "$BUILD_DIR/SHA256SUMS.txt"
printf '\nThe DMG is the normal file to give to students and public users.\n'
if [ -z "$SIGN_IDENTITY" ]; then
  printf 'This build is not Developer ID signed/notarized. See MACOS_INSTALLER_GUIDE.md before public distribution.\n'
fi
