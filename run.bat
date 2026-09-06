@echo off
cd /d "%~dp0"
title GST Ledger — Quick Launcher

REM ============================================================================
REM  GST Ledger — Multi-Mode Launcher (Local Node.js & Docker)
REM ============================================================================

set IMAGE_NAME=gst-ledger
set CONTAINER_NAME=gst-ledger
set PORT=3000
set ENV_FILE=.env.local

REM ── Check or Auto-Create .env.local ──────────────────────────────────────────
if not exist "%ENV_FILE%" (
    if exist ".env.local.example" (
        echo [INFO] .env.local not found. Creating from .env.local.example...
        copy .env.local.example .env.local >nul
    ) else (
        echo [INFO] Creating default .env.local for offline LocalStorage mode...
        (
            echo NEXT_PUBLIC_SUPABASE_URL=https://placeholder-project.supabase.co
            echo NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key
            echo SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key
            echo GROQ_API_KEY=
        ) > "%ENV_FILE%"
    )
    echo [OK] %ENV_FILE% is ready.
)

REM ── Direct CLI Argument Dispatch ─────────────────────────────────────────────
if /I "%1"=="dev"     goto RUN_LOCAL
if /I "%1"=="local"   goto RUN_LOCAL
if /I "%1"=="docker"  goto DOCKER_BUILD_AND_START
if /I "%1"=="build"   goto DOCKER_BUILD
if /I "%1"=="start"   goto DOCKER_START
if /I "%1"=="stop"    goto DOCKER_STOP
if /I "%1"=="logs"    goto DOCKER_LOGS
if /I "%1"=="test"    goto RUN_TESTS
if /I "%1"=="clean"   goto DOCKER_CLEAN

REM ── Interactive Menu (When run without arguments) ────────────────────────────
:MENU
cls
echo ============================================================================
echo   GST Ledger — Accounting Management Platform
echo ============================================================================
echo.
echo   [1] Run Locally with Node.js (npm run dev)    - [Instant / Recommended]
echo   [2] Run with Docker (Build + Start Container)
echo   [3] Run Automated Test Suite (npm test)
echo   [4] Build Production Application (npm run build)
echo   [5] Stop Docker Container
echo   [6] View Docker Container Logs
echo   [7] Exit
echo.
echo ============================================================================
choice /C 1234567 /N /M "Press a number (1-7) on your keyboard: "

if errorlevel 7 goto QUIT
if errorlevel 6 goto DOCKER_LOGS
if errorlevel 5 goto DOCKER_STOP
if errorlevel 4 goto RUN_BUILD
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
echo   Once compiled, open your browser at: http://localhost:3000
echo   (To stop server, press Ctrl+C)
echo ============================================================================
echo.

REM Check node_modules
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
    echo [ERROR] Docker Desktop is not running or not started!
    echo ============================================================================
    echo  1. Please open "Docker Desktop" from your Windows Start menu.
    echo  2. Wait until Docker Desktop shows "Engine running" (green icon).
    echo  3. OR press Option [1] to run locally with Node.js without Docker!
    echo ============================================================================
    echo.
    pause
    goto MENU
)

REM Parse NEXT_PUBLIC_ vars from .env.local for Docker build args
set NEXT_PUBLIC_SUPABASE_URL=
set NEXT_PUBLIC_SUPABASE_ANON_KEY=
for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
    if "%%A"=="NEXT_PUBLIC_SUPABASE_URL"      set NEXT_PUBLIC_SUPABASE_URL=%%B
    if "%%A"=="NEXT_PUBLIC_SUPABASE_ANON_KEY" set NEXT_PUBLIC_SUPABASE_ANON_KEY=%%B
)

echo.
echo [GST Ledger] Building Docker image: %IMAGE_NAME% ...
docker build ^
    --build-arg NEXT_PUBLIC_SUPABASE_URL="%NEXT_PUBLIC_SUPABASE_URL%" ^
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="%NEXT_PUBLIC_SUPABASE_ANON_KEY%" ^
    -t %IMAGE_NAME% .

if errorlevel 1 (
    echo.
    echo [ERROR] Docker build failed.
    pause
    goto MENU
)

echo.
echo [GST Ledger] Stopping previous container instance if running...
docker rm -f %CONTAINER_NAME% >nul 2>&1

echo [GST Ledger] Starting Docker container: %CONTAINER_NAME% on port %PORT% ...
docker run -d ^
    --name %CONTAINER_NAME% ^
    --env-file %ENV_FILE% ^
    -p %PORT%:3000 ^
    --restart unless-stopped ^
    %IMAGE_NAME%

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start Docker container.
    pause
    goto MENU
)

echo.
echo [OK] GST Ledger is now running in Docker!
echo      URL: http://localhost:%PORT%
start "" http://localhost:%PORT%
echo.
pause
goto MENU

REM ── Option 3: Automated Tests ───────────────────────────────────────────────
:RUN_TESTS
echo.
echo ============================================================================
echo   Running Automated Test Suite & Multi-Tenant RLS Penetration Suite ...
echo ============================================================================
echo.
call npm test
echo.
pause
goto MENU

REM ── Option 4: Production Build ──────────────────────────────────────────────
:RUN_BUILD
echo.
echo ============================================================================
echo   Building Production Bundle (Next.js) ...
echo ============================================================================
echo.
call npm run build
echo.
pause
goto MENU

REM ── Option 5: Stop Docker Container ─────────────────────────────────────────
:DOCKER_STOP
echo.
echo [GST Ledger] Stopping and removing container: %CONTAINER_NAME% ...
docker stop %CONTAINER_NAME% >nul 2>&1
docker rm   %CONTAINER_NAME% >nul 2>&1
echo [OK] Container stopped and removed.
echo.
pause
goto MENU

REM ── Option 6: View Docker Logs ──────────────────────────────────────────────
:DOCKER_LOGS
echo.
echo [GST Ledger] Viewing logs for container: %CONTAINER_NAME% (Ctrl+C to exit)
echo.
docker logs -f %CONTAINER_NAME%
pause
goto MENU

REM ── Docker Clean ────────────────────────────────────────────────────────────
:DOCKER_CLEAN
echo.
echo [GST Ledger] Removing container and image: %IMAGE_NAME% ...
docker stop %CONTAINER_NAME% >nul 2>&1
docker rm   %CONTAINER_NAME% >nul 2>&1
docker rmi  %IMAGE_NAME% >nul 2>&1
echo [OK] Docker cleanup complete.
pause
goto MENU

:QUIT
exit /b 0
