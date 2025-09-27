@echo off
echo 🎯 Installing Kahoot PowerPoint Add-in...
echo ==========================================

echo Step 1: Installing Node.js dependencies...
call npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies!
    echo Make sure Node.js is installed: https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully!
echo.
echo Step 2: Starting development server...
echo The server will start on http://localhost:3000
echo.
echo After the server starts:
echo 1. Open PowerPoint
echo 2. Go to Insert ^> My Add-ins ^> Shared Folder  
echo 3. Select manifest.xml from this folder
echo 4. Click Add
echo.
echo Press any key to start the server...
pause

echo Starting server...
call npm start
