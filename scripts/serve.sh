#!/usr/bin/env bash
# Oceanview dev server (R-01): ES modules require an http origin.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8171}"
echo "Oceanview running at http://localhost:${PORT}"
exec python3 -m http.server "$PORT"
