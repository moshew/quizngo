@echo off
echo 🐍 Starting QuizNGO Quiz Server (Python)
echo =======================================

REM Check if virtual environment exists
if not exist venv (
    echo ❌ Virtual environment not found!
    echo    Run: install_python.bat first
    pause
    exit /b 1
)

REM Activate virtual environment
echo 🔧 Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if requirements are installed
echo 📦 Checking requirements...
python -c "import flask, flask_cors" >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Required packages not found!
    echo    Installing packages...
    pip install -r requirements.txt
)

REM Start the server
echo.
echo 🚀 Starting server...
echo Server will be available at: http://localhost:5001
echo API Documentation: http://localhost:5001
echo.
echo Press Ctrl+C to stop the server
echo ================================
echo.

REM Configure via environment variables or use defaults
if "%QUIZNGO_PORT%"=="" set QUIZNGO_PORT=5001
if "%QUIZNGO_LB_URL%"=="" set QUIZNGO_LB_URL=http://localhost:5000
if "%QUIZNGO_ADDRESS%"=="" set QUIZNGO_ADDRESS=http://localhost:%QUIZNGO_PORT%
if "%QUIZNGO_ADMIN_URL%"=="" set QUIZNGO_ADMIN_URL=http://localhost:3002
if "%QUIZNGO_GAME_URL%"=="" set QUIZNGO_GAME_URL=http://localhost:8080

REM Start server (always requires Load Balancer)
python server.py --port %QUIZNGO_PORT% --lb-url %QUIZNGO_LB_URL% --address %QUIZNGO_ADDRESS% --admin-url %QUIZNGO_ADMIN_URL% --game-url %QUIZNGO_GAME_URL%

