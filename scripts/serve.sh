#!/usr/bin/env bash
# Oceanview dev server (no-store, ES modules require an http origin).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8171}"
echo "Oceanview running at http://localhost:${PORT}"
exec node server.mjs "$PORT"
