@echo off
cd /d "%~dp0"
title GST Ledger - Local Server

echo ============================================================================
echo   GST Ledger - Starting Local Server (Next.js)
echo ============================================================================
echo.
echo   Local URL : http://localhost:3000
echo   To Stop   : Press Ctrl+C
echo.
echo ============================================================================
echo.

if not exist "node_modules\" (
    echo [INFO] Installing project dependencies, please wait...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Launching dev server...
call npm run dev

echo.
echo [INFO] Server stopped.
pause
