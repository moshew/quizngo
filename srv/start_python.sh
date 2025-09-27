#!/bin/bash

# Start Kahoot Quiz Server (Python)

echo "🐍 Starting Kahoot Quiz Server (Python)"
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
echo "📍 Server will be available at: http://localhost:5000"
echo "📖 API Documentation: http://localhost:5000"
echo ""
echo "Press Ctrl+C to stop the server"
echo "================================"
echo ""

python3 app.py

