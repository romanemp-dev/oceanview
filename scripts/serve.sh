#!/usr/bin/env bash
# Oceanview dev server: static files with no-store (LAN-ready; python3 is
# firewall-allowed on macOS). ES modules require an http origin.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${1:-8171}"
echo "Oceanview running at http://localhost:${PORT}"
exec python3 server.py "$PORT"
