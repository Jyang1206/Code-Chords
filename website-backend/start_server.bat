@echo off
echo Guitar Fretboard Detection Server Launcher
echo =========================================

REM Check if Python is available
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python not found! Please install Python and try again.
    pause
    exit /b 1
)

REM Free ports if needed
echo Checking for busy ports...
python server_manager.py 8000 8001 8002 8003

echo.
echo Starting server with automatic port selection...
python fastapi_server.py --free-port

REM Keep the window open if there's an error
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server exited with error code %ERRORLEVEL%
    pause
) 