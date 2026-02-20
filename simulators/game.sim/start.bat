@echo off
echo ========================================
echo    QuizNGO Simulator - Starting...
echo ========================================
echo.

REM Check if node_modules exists
if not exist node_modules (
    echo [1/2] Installing dependencies...
    call npm install
    echo.
) else (
    echo [1/2] Dependencies already installed
    echo.
)

echo [2/2] Starting development server...
echo.
echo Open browser at: http://localhost:3001
echo.
echo Press Ctrl+C to stop
echo.
call npm run dev







