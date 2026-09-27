#!/usr/bin/env bash
set -euo pipefail

# User-facing Linux launcher installer entry point.
# The implementation lives under platform/linux/ so the source tree stays organized.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/platform/linux/install-launcher.sh" "$SCRIPT_DIR"
