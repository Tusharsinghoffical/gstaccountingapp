@echo off
cd /d "%~dp0"
title GST Ledger — Quick Launcher

REM ============================================================================
REM  GST Ledger — Multi-Mode Launcher (Local Node.js & Docker)
REM ============================================================================

set IMAGE_NAME=gst-ledger
set CONTAINER_NAME=gst-ledger
set PORT=3000

REM ── Ensure data directory exists for SQLite ────────────────────────────────
if not exist "data\" mkdir data

REM ── Check or Auto-Create .env.local ──────────────────────────────────────────
if not exist ".env.local" (
    echo [INFO] Initializing .env.local for local mode...
    (
        echo NEXTAUTH_SECRET=gst-ledger-local-secret-key-32-chars-min
        echo NEXTAUTH_URL=http://localhost:3000
        echo GROQ_API_KEY=
    ) > ".env.local"
)

REM ── Direct CLI Argument Dispatch ─────────────────────────────────────────────
if /I "%1"=="dev"     goto RUN_LOCAL
if /I "%1"=="local"   goto RUN_LOCAL
if /I "%1"=="docker"  goto DOCKER_BUILD_AND_START
if /I "%1"=="test"    goto RUN_TESTS
if /I "%1"=="backup"  goto RUN_BACKUP
if /I "%1"=="restore" goto RUN_RESTORE
if /I "%1"=="build"   goto RUN_BUILD

REM ── Interactive Menu (When run without arguments) ────────────────────────────
:MENU
cls
echo ============================================================================
echo   GST Ledger — Local Accounting Platform (Prisma + SQLite WAL)
echo ============================================================================
echo.
echo   [1] Run Locally with Node.js (npm run dev)    - [Fastest / Instant]
echo   [2] Run with Docker (Container with Persistent Storage)
echo   [3] Run Automated Test Suite (npm test)
echo   [4] Backup Database and Storage (npm run backup)
echo   [5] Restore Database and Storage (npm run restore)
echo   [6] Build Production Bundle (npm run build)
echo   [7] Exit
echo.
echo ============================================================================
choice /C 1234567 /N /M "Press a number (1-7) on your keyboard: "

if errorlevel 7 goto QUIT
if errorlevel 6 goto RUN_BUILD
if errorlevel 5 goto RUN_RESTORE
if errorlevel 4 goto RUN_BACKUP
if errorlevel 3 goto RUN_TESTS
if errorlevel 2 goto DOCKER_BUILD_AND_START
if errorlevel 1 goto RUN_LOCAL

goto MENU

REM ── Option 1: Run Locally ───────────────────────────────────────────────────
:RUN_LOCAL
echo.
echo ============================================================================
echo   Starting GST Ledger locally on Next.js dev server...
echo ============================================================================
echo   Local Address : http://localhost:3000
echo   To Stop Server: Press Ctrl+C
echo ============================================================================
echo.

if not exist "node_modules\" (
    echo [INFO] Installing project dependencies first, please wait...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        goto MENU
    )
)

call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Development server exited with an error.
    pause
)
goto MENU

REM ── Option 2: Docker Build & Start ──────────────────────────────────────────
:DOCKER_BUILD_AND_START
echo.
echo [GST Ledger] Checking Docker service...
docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo ============================================================================
    echo [ERROR] Docker Desktop is not running!
    echo ============================================================================
    echo  1. Please open "Docker Desktop" from Windows Start menu.
    echo  2. Or press Option [1] to run locally with Node.js without Docker.
    echo ============================================================================
    echo.
    pause
    goto MENU
)

echo.
echo [GST Ledger] Building Docker image: %IMAGE_NAME% ...
docker build -t %IMAGE_NAME% .
if errorlevel 1 (
    echo.
    echo [ERROR] Docker build failed.
    pause
    goto MENU
)

echo.
echo [GST Ledger] Stopping previous container instance if running...
docker rm -f %CONTAINER_NAME% >nul 2>&1

echo [GST Ledger] Starting Docker container with persistent volumes...
docker run -d ^
    --name %CONTAINER_NAME% ^
    -p %PORT%:3000 ^
    -v "%cd%\data:/app/data" ^
    -v "%cd%\storage:/app/storage" ^
    --restart unless-stopped ^
    %IMAGE_NAME%

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start Docker container.
    pause
    goto MENU
)

echo.
echo [OK] GST Ledger is now running in Docker with persistent volume mounts!
echo      URL: http://localhost:%PORT%
start "" http://localhost:%PORT%
echo.
pause
goto MENU

REM ── Option 3: Automated Tests ───────────────────────────────────────────────
:RUN_TESTS
echo.
echo ============================================================================
echo   Running Automated Test Suite (Unit + Concurrency + Cross-Tenant Tests)
echo ============================================================================
echo.
call npm test
echo.
pause
goto MENU

REM ── Option 4: Backup ────────────────────────────────────────────────────────
:RUN_BACKUP
echo.
echo ============================================================================
echo   Running Online SQLite Backup & Storage Snapshot ...
echo ============================================================================
echo.
call npm run backup
echo.
pause
goto MENU

REM ── Option 5: Restore ───────────────────────────────────────────────────────
:RUN_RESTORE
echo.
echo ============================================================================
echo   Restoring Database and Storage from Backup ...
echo ============================================================================
echo.
call npm run restore
echo.
pause
goto MENU

REM ── Option 6: Production Build ──────────────────────────────────────────────
:RUN_BUILD
echo.
echo ============================================================================
echo   Building Production Next.js Bundle ...
echo ============================================================================
echo.
call npm run build
echo.
pause
goto MENU

:QUIT
exit /b 0
