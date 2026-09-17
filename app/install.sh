#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required"
    exit 1
fi

if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi

echo "Installation complete."
echo "Run: ./start.sh   (API server: ./server/install.sh && ./server/start.sh)"
