@echo off
REM Quick Deployment Setup Script for Windows

echo ========================================
echo  GST Accounting - Render Deployment
echo  Setup Script for Windows
echo ========================================
echo.

REM Check if Git is installed
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git is not installed!
    echo Please install Git from: https://git-scm.com/download/win
    pause
    exit /b 1
)

echo [OK] Git is installed
echo.

REM Initialize Git repository if not already done
if not exist ".git" (
    echo Initializing Git repository...
    git init
    echo [OK] Git repository initialized
    echo.
) else (
    echo [OK] Git repository already exists
    echo.
)

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating .env file...
    copy .env.example .env
    echo [OK] .env file created
    echo.
    echo WARNING: Please edit .env file and set your SECRET_KEY!
    echo.
) else (
    echo [OK] .env file already exists
    echo.
)

REM Install Python dependencies
echo Installing Python dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo [OK] Dependencies installed
echo.

REM Run migrations
echo Running database migrations...
python manage.py migrate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Migrations failed!
    pause
    exit /b 1
)
echo [OK] Migrations completed
echo.

REM Collect static files
echo Collecting static files...
python manage.py collectstatic --noinput
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to collect static files!
    pause
    exit /b 1
)
echo [OK] Static files collected
echo.

echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Edit .env file and set your SECRET_KEY
echo 2. Push code to GitHub
echo 3. Deploy to Render using the guide
echo.
echo Open DEPLOYMENT_GUIDE.md for detailed instructions!
echo.
pause
