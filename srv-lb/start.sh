#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -x ".venv/bin/python" ]; then
    echo "Missing virtualenv. Run: ./install.sh"
    exit 1
fi

# Required runtime command:
exec .venv/bin/python server.py --port 5000 --log-verbosity normal --no-ssl
