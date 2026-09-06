@echo off
cd /d "%~dp0"
title GST Ledger - Local Server

echo ============================================================================
echo   GST Ledger — Starting Local Development Server (Next.js)
echo ============================================================================
echo.
echo   Local Address : http://localhost:3000
echo   To Stop       : Press Ctrl+C
echo.
echo ============================================================================
echo.

REM Check if dependencies are installed
if not exist "node_modules\" (
    echo [INFO] Installing dependencies (first-time only, please wait)...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

call npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Server stopped with an error.
    pause
)
