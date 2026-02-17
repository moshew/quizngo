@echo off
echo Starting QuizNGO Quiz Server (Python)
echo ======================================

REM Check if virtual environment exists
if not exist venv (
    echo ERROR: Virtual environment not found!
    echo    Run: install_python.bat first
    pause
    exit /b 1
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Check if requirements are installed
echo Checking requirements...
python -c "import flask, flask_cors" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Required packages not found!
    echo    Installing packages...
    pip install -r requirements.txt
)

REM Configure via environment variables or use defaults
if "%QUIZNGO_PORT%"=="" set QUIZNGO_PORT=5001
if "%QUIZNGO_SSL%"=="" set QUIZNGO_SSL=0
set QUIZNGO_PROTOCOL=http
if "%QUIZNGO_SSL%"=="1" set QUIZNGO_PROTOCOL=https

REM Start the server
echo.
echo Starting server...
echo Server will be available at: %QUIZNGO_PROTOCOL%://localhost:%QUIZNGO_PORT%
echo API Documentation: %QUIZNGO_PROTOCOL%://localhost:%QUIZNGO_PORT%/docs
echo.
echo Press Ctrl+C to stop the server
echo ================================
echo.

REM Build command line - server.py auto-detects LAN IP for all URLs if not provided
set CMD=python server.py --port %QUIZNGO_PORT%
if not "%QUIZNGO_LB_URL%"=="" set CMD=%CMD% --lb-url %QUIZNGO_LB_URL%
if not "%QUIZNGO_ADDRESS%"=="" set CMD=%CMD% --address %QUIZNGO_ADDRESS%
if not "%QUIZNGO_ADMIN_URL%"=="" set CMD=%CMD% --admin-url %QUIZNGO_ADMIN_URL%
if not "%QUIZNGO_GAME_URL%"=="" set CMD=%CMD% --game-url %QUIZNGO_GAME_URL%
if "%QUIZNGO_SSL%"=="1" (
    set CMD=%CMD% --ssl
) else (
    set CMD=%CMD% --no-ssl
)

REM Start server (always requires Load Balancer)
%CMD%
