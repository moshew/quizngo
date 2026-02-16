@echo off
echo Starting QuizNGO Load Balancer
echo =======================================

REM Check if virtual environment exists
if not exist venv (
    echo Virtual environment not found!
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)

REM Check if requirements are installed
echo Checking requirements...
python -c "import flask, flask_cors, requests" >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing packages...
    pip install -r requirements.txt
)

echo.
echo Starting Load Balancer on port 5000...
echo Press Ctrl+C to stop
echo ================================
echo.

python server.py
