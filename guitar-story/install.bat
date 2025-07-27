@echo off
echo 🎸 Installing Guitar Story...

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js version 18 or higher.
    echo Visit: https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version
for /f "tokens=1,2 delims=." %%a in ('node --version') do set NODE_VERSION=%%a
set NODE_VERSION=%NODE_VERSION:~1%
if %NODE_VERSION% LSS 18 (
    echo ❌ Node.js version 18 or higher is required. Current version: 
    node --version
    echo Please update Node.js from: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js version: 
node --version

REM Check if npm is installed
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not installed. Please install npm.
    pause
    exit /b 1
)

echo ✅ npm version:
npm --version

REM Install dependencies
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies. Please check your internet connection and try again.
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully!

REM Check if .env file exists
if not exist .env (
    echo ⚠️  No .env file found. Creating template...
    (
        echo # Firebase Configuration
        echo VITE_FIREBASE_API_KEY=your_api_key_here
        echo VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
        echo VITE_FIREBASE_PROJECT_ID=your_project_id
        echo VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
        echo VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
        echo VITE_FIREBASE_APP_ID=your_app_id
        echo.
        echo # YouTube API Key
        echo VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
    ) > .env
    echo 📝 Created .env template. Please update it with your actual API keys.
) else (
    echo ✅ .env file found
)

echo.
echo 🎉 Installation complete!
echo.
echo Next steps:
echo 1. Update the .env file with your Firebase and YouTube API keys
echo 2. Run 'npm run dev' to start the development server
echo 3. Open http://localhost:5173 in your browser
echo.
echo For more information, see the README.md file.
pause 