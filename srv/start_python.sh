#!/bin/bash

# Start QuizNGO Quiz Server (Python)

echo "🐍 Starting QuizNGO Quiz Server (Python)"
echo "======================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "   Run: ./install_python.sh first"
    exit 1
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Check if requirements are installed
echo "📦 Checking requirements..."
python3 -c "import flask, flask_cors" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ Required packages not found!"
    echo "   Installing packages..."
    pip install -r requirements.txt
fi

# Start the server
echo ""
echo "🚀 Starting server..."
echo "Server will be available at: http://localhost:5001"
echo "API Documentation: http://localhost:5001"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"
echo ""

# Configure via environment variables or use defaults
: ${QUIZNGO_PORT:=5001}
: ${QUIZNGO_LB_URL:=http://localhost:5000}
: ${QUIZNGO_ADDRESS:=http://localhost:5001}

# Start server (use --lb-url only if not set to 'none')
if [ "$QUIZNGO_LB_URL" = "none" ]; then
    python3 server.py --port $QUIZNGO_PORT
else
    python3 server.py --port $QUIZNGO_PORT --lb-url $QUIZNGO_LB_URL --address $QUIZNGO_ADDRESS
fi

