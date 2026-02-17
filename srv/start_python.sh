#!/bin/bash

# Start QuizNGO Quiz Server (Python)

echo "Starting QuizNGO Quiz Server (Python)"
echo "======================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "ERROR: Virtual environment not found!"
    echo "   Run: ./install_python.sh first"
    exit 1
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Check if requirements are installed
echo "Checking requirements..."
python3 -c "import flask, flask_cors" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "ERROR: Required packages not found!"
    echo "   Installing packages..."
    pip install -r requirements.txt
fi

# Configure via environment variables or use defaults
: "${QUIZNGO_PORT:=5001}"
: "${QUIZNGO_SSL:=0}"

PROTOCOL="http"
if [ "$QUIZNGO_SSL" = "1" ] || [ "${QUIZNGO_SSL,,}" = "true" ]; then
    PROTOCOL="https"
fi

# Start the server
echo ""
echo "Starting server..."
echo "Server will be available at: $PROTOCOL://localhost:$QUIZNGO_PORT"
echo "API Documentation: $PROTOCOL://localhost:$QUIZNGO_PORT/docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"
echo ""

# Build command line - server.py auto-detects LAN IP for all URLs if not provided
CMD="python3 server.py --port $QUIZNGO_PORT"
[ -n "$QUIZNGO_LB_URL" ] && CMD="$CMD --lb-url $QUIZNGO_LB_URL"
[ -n "$QUIZNGO_ADDRESS" ] && CMD="$CMD --address $QUIZNGO_ADDRESS"
[ -n "$QUIZNGO_ADMIN_URL" ] && CMD="$CMD --admin-url $QUIZNGO_ADMIN_URL"
[ -n "$QUIZNGO_GAME_URL" ] && CMD="$CMD --game-url $QUIZNGO_GAME_URL"

if [ "$QUIZNGO_SSL" = "1" ] || [ "${QUIZNGO_SSL,,}" = "true" ]; then
    CMD="$CMD --ssl"
else
    CMD="$CMD --no-ssl"
fi

# Start server (always requires Load Balancer)
$CMD
