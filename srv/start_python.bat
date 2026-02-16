@echo off
echo 🐍 Starting Kahoot Quiz Server (Python)
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
if "%KAHOOT_PORT%"=="" set KAHOOT_PORT=5001
if "%KAHOOT_LB_URL%"=="" set KAHOOT_LB_URL=http://localhost:5000
if "%KAHOOT_ADDRESS%"=="" set KAHOOT_ADDRESS=http://localhost:5001

REM Start server (use --lb-url only if LB_URL is set)
if "%KAHOOT_LB_URL%"=="none" (
    python server.py --port %KAHOOT_PORT%
) else (
    python server.py --port %KAHOOT_PORT% --lb-url %KAHOOT_LB_URL% --address %KAHOOT_ADDRESS%
)

