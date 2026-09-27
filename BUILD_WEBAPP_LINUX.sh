#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

echo "Building Systemika Studio WebApp..."
if ! command -v node >/dev/null 2>&1; then
  echo >&2
  echo "ERROR: Node.js was not found." >&2
  echo "Install Node.js 22.12 or newer, then run this file again." >&2
  exit 1
fi

if ! node -e 'const [M,m]=process.versions.node.split(".").map(Number); process.exit(M > 22 || (M === 22 && m >= 12) ? 0 : 1)'; then
  echo >&2
  echo "ERROR: Systemika WebApp builds require Node.js 22.12 or newer." >&2
  exit 1
fi

node build/build.js
VERSION="$(node -p "require('./package.json').version")"

echo
echo "WebApp build completed."
echo "Output: build/output/web/$VERSION"
echo "Upload the CONTENTS of that folder as one complete release."
