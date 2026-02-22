#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -x ".venv/bin/python" ]; then
    echo "Missing virtualenv: system.sim/.venv/bin/python"
    exit 1
fi

LB_URL="${QUIZNGO_LB_URL:-https://srv.quizngo.online}"
GAMES="${QUIZNGO_GAMES:-4000}"

exec .venv/bin/python simulate.py --lb-url "$LB_URL" --games "$GAMES" "$@"
