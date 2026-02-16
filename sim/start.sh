#!/bin/bash

echo "========================================"
echo "   QuizNGO Simulator - Starting..."
echo "========================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[1/2] Installing dependencies..."
    npm install
    echo ""
else
    echo "[1/2] Dependencies already installed"
    echo ""
fi

echo "[2/2] Starting development server..."
echo ""
echo "Open browser at: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop"
echo ""
npm run dev







