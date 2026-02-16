@echo off
echo 🐍 QuizNGO Quiz Server (Python) Installer - Windows
echo ===================================================

REM Check Python
echo 🔍 Checking Python installation...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python not found!
    echo    Please install Python 3.7+ from https://python.org
    echo    Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo    ✅ Python found: %PYTHON_VERSION%

REM Check pip
pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ pip not found!
    echo    pip should come with Python. Try reinstalling Python.
    pause
    exit /b 1
)
echo    ✅ pip found

echo.
echo 🔧 Setting up virtual environment...
if not exist venv (
    python -m venv venv
    echo    ✅ Virtual environment created
) else (
    echo    ✅ Virtual environment already exists
)

REM Activate virtual environment
call venv\Scripts\activate.bat
echo    ✅ Virtual environment activated

echo.
echo 📦 Installing Python packages...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo ❌ Failed to install packages!
    pause
    exit /b 1
)
echo    ✅ Packages installed

echo.
echo 📁 Creating data directories...
if not exist data mkdir data
if not exist logs mkdir logs
echo    ✅ Directories created

echo.
echo 🧪 Testing installation...
python -c "import flask, flask_cors; print('✅ All packages imported successfully')"

echo.
echo 🎉 Installation completed!
echo.
echo 🚀 To start the server:
echo    start_python.bat
echo    or
echo    venv\Scripts\activate.bat ^&^& python app.py
echo.
echo 🌐 Server will be available at:
echo    http://localhost:5000
echo.
echo 📋 To test the API:
echo    Open browser: http://localhost:5000/?status
echo.
echo 💡 Don't forget to update your Add-in URL to:
echo    const API_BASE = 'http://localhost:5000/';
echo.
echo ✨ Happy testing!
echo.
pause

