#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required"
    exit 1
fi

npm ci
echo "Installation complete."
echo "Run: ./start.sh"
