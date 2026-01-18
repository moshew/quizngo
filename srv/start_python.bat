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
echo 📍 Server will be available at: http://localhost:5000
echo 📖 API Documentation: http://localhost:5000
echo.
echo Press Ctrl+C to stop the server
echo ================================
echo.

python server.py

