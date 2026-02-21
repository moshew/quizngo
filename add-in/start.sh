#!/usr/bin/env bash
set -euo pipefail

HOST="${ADDIN_HOST:-127.0.0.1}"
PORT="${ADDIN_PORT:-3300}"

cd "$(dirname "${BASH_SOURCE[0]}")"

exec python3 -m http.server "$PORT" --bind "$HOST"
