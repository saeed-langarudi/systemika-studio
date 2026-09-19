#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run Systemika Studio from the source tree. Install Node.js and run this file again."
  read -r -p "Press Enter to close..."
  exit 1
fi
node web-server.js
