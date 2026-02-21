#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -x ".venv/bin/python" ]; then
    echo "Missing virtualenv: srv/.venv/bin/python"
    exit 1
fi

LB_URL="${QUIZNGO_LB_URL:-https://srv.quizngo.online}"
ADDRESS="${QUIZNGO_SRV_ADDRESS:-}"
PORT="${QUIZNGO_SRV_PORT:-5001}"

if [ "${1:-}" = "--port" ]; then
    if [ $# -lt 2 ]; then
        echo "Usage: ./start.sh [PORT] | ./start.sh --port PORT"
        exit 1
    fi
    PORT="$2"
elif [ $# -ge 1 ]; then
    PORT="$1"
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
    echo "Invalid port: $PORT"
    exit 1
fi

if [ -z "$ADDRESS" ]; then
    case "$PORT" in
        5001) ADDRESS="https://srv-01.quizngo.online" ;;
        5002) ADDRESS="https://srv-02.quizngo.online" ;;
        *) ADDRESS="https://srv-01.quizngo.online" ;;
    esac
fi

exec .venv/bin/python server.py --port "$PORT" --lb-url "$LB_URL" --address "$ADDRESS" --admin-url https://quizngo.online/admin --game-url https://quizngo.online/game --log-verbosity normal --no-ssl
