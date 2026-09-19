#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run Systemika from source." >&2
  exit 1
fi
if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to install the Systemika Electron runtime." >&2
  exit 1
fi

REQUIRED_ELECTRON_VERSION="$(node -p "require('./package.json').devDependencies.electron")"
INSTALLED_ELECTRON_VERSION=""
if [ -f node_modules/electron/package.json ]; then
  INSTALLED_ELECTRON_VERSION="$(node -p "require('./node_modules/electron/package.json').version" 2>/dev/null || true)"
fi

if [ ! -x node_modules/.bin/electron ] || [ "$INSTALLED_ELECTRON_VERSION" != "$REQUIRED_ELECTRON_VERSION" ]; then
  echo "Installing Electron ${REQUIRED_ELECTRON_VERSION} for Systemika..."
  npm install --no-audit --no-fund
fi

npm run electron
