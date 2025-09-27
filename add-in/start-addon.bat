@echo off
echo 🚀 Starting Kahoot PowerPoint Add-in Server...
echo ============================================

echo Server will be available at: http://localhost:3000
echo.
echo To load the add-in:
echo 1. Open PowerPoint
echo 2. Insert ^> My Add-ins ^> Shared Folder
echo 3. Select manifest.xml
echo 4. Click Add
echo.

echo Starting server...
npm start
