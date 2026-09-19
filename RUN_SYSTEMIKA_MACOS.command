#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run Systemika from source. Install Node.js and run this file again."
  read -r -p "Press Enter to close..."
  exit 1
fi
if [ ! -x node_modules/.bin/electron ]; then
  echo "Installing the Electron runtime for Systemika..."
  npm install --no-audit --no-fund
fi
npm run electron
