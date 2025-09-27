@echo off
echo 🔧 Kahoot Add-in Setup for Modern Office 365
echo =============================================
echo.
echo This script will help you install the Kahoot add-in in modern Office 365
echo.

echo Step 1: Checking if server is running...
powershell -Command "if (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue) { Write-Host '✅ Server is running on port 3000' } else { Write-Host '❌ Server is NOT running. Please run: npm start'; pause; exit }"

echo.
echo Step 2: Opening PowerPoint with instructions...
echo.
echo Please follow these steps in PowerPoint:
echo.
echo 🎯 METHOD 1 - Try Developer Tab:
echo 1. Open PowerPoint
echo 2. Go to File ^> Options ^> Customize Ribbon  
echo 3. Check "Developer" in the right list
echo 4. Click OK
echo 5. Go to Developer tab ^> Add-ins ^> COM Add-ins
echo.
echo 🎯 METHOD 2 - Try Insert Menu:
echo 1. Open PowerPoint  
echo 2. Go to Insert ^> Add-ins (or Store)
echo 3. Look for "My Add-ins" or "Organization" 
echo 4. Look for "Shared Folder" or "Browse"
echo.
echo 🎯 METHOD 3 - Manual Registry (if above fails):
echo 1. Close PowerPoint completely
echo 2. Run this script as Administrator  
echo 3. Restart PowerPoint
echo 4. Your add-in should appear automatically
echo.

set /p choice="Do you want to register in Windows Registry now? (y/n): "
if /i "%choice%"=="y" (
    echo.
    echo Registering add-in in Windows Registry...
    powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/c regedit /s register-addin.reg && echo Registry updated! && pause'"
    echo.
    echo ✅ Registry updated! Please restart PowerPoint.
) else (
    echo.
    echo Manual installation chosen. Manifest file location:
    echo %~dp0manifest.xml
    echo.
    echo Copy this path and use it when PowerPoint asks for the manifest file.
)

echo.
echo 📁 Opening add-in folder for easy access...
explorer "%~dp0"

echo.
echo 🌐 Server should be running at: http://localhost:3000
echo 📄 Manifest file: %~dp0manifest.xml
echo.
echo Press any key to exit...
pause
