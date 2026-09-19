#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm install --no-audit --no-fund
npm run build
