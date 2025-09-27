@echo off
echo 🔧 Registering Kahoot Add-in in Windows Registry...
echo ================================================

echo Warning: This will modify your Windows Registry.
echo This allows PowerPoint to load your custom add-in.
echo.
echo Press any key to continue or Ctrl+C to cancel...
pause

echo Adding registry entries...
regedit /s register-addin.reg

if %errorlevel% equ 0 (
    echo ✅ Registry entries added successfully!
    echo.
    echo Now follow these steps:
    echo 1. Close PowerPoint completely if it's open
    echo 2. Restart PowerPoint
    echo 3. Go to Insert ^> Get Add-ins ^> MY ADD-INS
    echo 4. Your add-in should appear in the list
    echo.
) else (
    echo ❌ Failed to add registry entries.
    echo Make sure you're running as Administrator.
    echo.
)

echo Press any key to exit...
pause
