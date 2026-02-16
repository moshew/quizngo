@echo off
echo 🎯 Kahoot Load Balancer Installer - Windows
echo ============================================

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
echo 🧪 Testing installation...
python -c "import flask, flask_cors, requests; print('✅ All packages imported successfully')"

echo.
echo 🎉 Installation completed!
echo.
echo 🚀 To start the Load Balancer:
echo    start_lb.bat
echo    or
echo    venv\Scripts\activate.bat ^&^& python server.py
echo.
echo 🌐 Load Balancer will be available at:
echo    http://localhost:5000
echo.
echo 📋 To test the Load Balancer:
echo    Open browser: http://localhost:5000/health
echo.
echo 💡 Game servers should register with:
echo    --lb-url http://localhost:5000
echo.
echo 🎮 Clients should resolve PINs via:
echo    http://localhost:5000/resolve/{gamePin}
echo.
echo ✨ Happy load balancing!
echo.
pause
