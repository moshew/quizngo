#!/bin/bash

echo "Starting Kahoot Load Balancer"
echo "======================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Virtual environment not found! Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

# Check if requirements are installed
echo "Checking requirements..."
python3 -c "import flask, flask_cors, requests" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Installing packages..."
    pip install -r requirements.txt
fi

echo ""
echo "Starting Load Balancer on port 5000..."
echo "Press Ctrl+C to stop"
echo "================================"
echo ""

python3 server.py
