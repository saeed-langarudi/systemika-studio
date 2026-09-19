#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST="$ROOT/distribute"

printf 'Systemika Linux AppImage Builder\n\n'
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo 'Node.js and npm are required to build the AppImage.' >&2
  echo 'Install the current Node.js LTS for your distribution, then run this script again.' >&2
  exit 1
fi

printf 'Using Node.js: %s\n' "$(node --version)"
printf 'Using npm:     %s\n\n' "$(npm --version)"

if ! node -e 'const [M,m]=process.versions.node.split(".").map(Number); process.exit(M > 22 || (M === 22 && m >= 12) ? 0 : 1)'; then
  echo 'Systemika installer builds require Node.js 22.12 or newer. Install a current Node.js LTS release and try again.' >&2
  exit 1
fi

cd "$DIST"
echo 'Installing packaging dependencies...'
npm install --no-audit --no-fund

echo 'Building Systemika AppImage...'
npm run dist:linux

OUT="$DIST/output/dist-electron"
APPIMAGE="$(find "$OUT" -maxdepth 1 -type f -name '*.AppImage' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -n1 | cut -d' ' -f2- || true)"
if [ -z "$APPIMAGE" ]; then
  echo "Build completed but no AppImage was found in $OUT" >&2
  exit 1
fi
chmod +x "$APPIMAGE"
printf '\nAppImage created successfully:\n%s\n' "$APPIMAGE"
