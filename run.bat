@echo off
REM ============================================================================
REM  GST Ledger — Docker Build & Run Script (Windows)
REM ============================================================================
REM  Usage:
REM    run.bat            — build image + start container (reads .env.local)
REM    run.bat build      — build image only
REM    run.bat start      — start container (image must already be built)
REM    run.bat stop       — stop + remove the container
REM    run.bat logs       — tail container logs
REM    run.bat shell      — open a shell inside the running container
REM    run.bat clean      — stop container + remove image
REM ============================================================================

SET IMAGE_NAME=gst-ledger
SET CONTAINER_NAME=gst-ledger
SET PORT=3000
SET ENV_FILE=.env.local

REM ── Load NEXT_PUBLIC_ vars from .env.local for the build args ───────────────
IF NOT EXIST %ENV_FILE% (
    echo [ERROR] %ENV_FILE% not found.
    echo        Copy .env.local.example to .env.local and fill in your credentials.
    exit /b 1
)

REM Parse NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local
FOR /F "usebackq tokens=1,* delims==" %%A IN ("%ENV_FILE%") DO (
    IF "%%A"=="NEXT_PUBLIC_SUPABASE_URL"      SET NEXT_PUBLIC_SUPABASE_URL=%%B
    IF "%%A"=="NEXT_PUBLIC_SUPABASE_ANON_KEY" SET NEXT_PUBLIC_SUPABASE_ANON_KEY=%%B
)

REM ── Dispatch on first argument ───────────────────────────────────────────────
IF "%1"=="build"  GOTO BUILD
IF "%1"=="start"  GOTO START
IF "%1"=="stop"   GOTO STOP
IF "%1"=="logs"   GOTO LOGS
IF "%1"=="shell"  GOTO SHELL
IF "%1"=="clean"  GOTO CLEAN

REM Default: build then start
GOTO BUILD_AND_START

REM ── BUILD ────────────────────────────────────────────────────────────────────
:BUILD
echo.
echo [GST Ledger] Building Docker image: %IMAGE_NAME% ...
echo.
docker build ^
    --build-arg NEXT_PUBLIC_SUPABASE_URL="%NEXT_PUBLIC_SUPABASE_URL%" ^
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="%NEXT_PUBLIC_SUPABASE_ANON_KEY%" ^
    -t %IMAGE_NAME% .

IF ERRORLEVEL 1 (
    echo.
    echo [ERROR] Docker build failed. See output above.
    exit /b 1
)
echo.
echo [OK] Image built: %IMAGE_NAME%
GOTO END

REM ── START ────────────────────────────────────────────────────────────────────
:START
echo.
echo [GST Ledger] Starting container: %CONTAINER_NAME% on port %PORT% ...
echo.
docker run -d ^
    --name %CONTAINER_NAME% ^
    --env-file %ENV_FILE% ^
    -p %PORT%:3000 ^
    --restart unless-stopped ^
    %IMAGE_NAME%

IF ERRORLEVEL 1 (
    echo.
    echo [ERROR] Failed to start container.
    echo        If a container with this name already exists, run:  run.bat stop
    exit /b 1
)
echo.
echo [OK] Container started.  Open http://localhost:%PORT%
GOTO END

REM ── BUILD + START (default) ──────────────────────────────────────────────────
:BUILD_AND_START
CALL :BUILD_INLINE
IF ERRORLEVEL 1 exit /b 1

REM Stop + remove any existing container with the same name
docker rm -f %CONTAINER_NAME% >nul 2>&1

GOTO START

:BUILD_INLINE
echo.
echo [GST Ledger] Building Docker image: %IMAGE_NAME% ...
echo.
docker build ^
    --build-arg NEXT_PUBLIC_SUPABASE_URL="%NEXT_PUBLIC_SUPABASE_URL%" ^
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="%NEXT_PUBLIC_SUPABASE_ANON_KEY%" ^
    -t %IMAGE_NAME% .
EXIT /B %ERRORLEVEL%

REM ── STOP ─────────────────────────────────────────────────────────────────────
:STOP
echo.
echo [GST Ledger] Stopping and removing container: %CONTAINER_NAME% ...
docker stop %CONTAINER_NAME% >nul 2>&1
docker rm   %CONTAINER_NAME% >nul 2>&1
echo [OK] Container stopped and removed.
GOTO END

REM ── LOGS ─────────────────────────────────────────────────────────────────────
:LOGS
echo.
echo [GST Ledger] Tailing logs for: %CONTAINER_NAME%  (Ctrl+C to exit)
echo.
docker logs -f %CONTAINER_NAME%
GOTO END

REM ── SHELL ────────────────────────────────────────────────────────────────────
:SHELL
echo.
echo [GST Ledger] Opening shell in container: %CONTAINER_NAME%
docker exec -it %CONTAINER_NAME% /bin/sh
GOTO END

REM ── CLEAN ────────────────────────────────────────────────────────────────────
:CLEAN
echo.
echo [GST Ledger] Cleaning up container and image ...
docker stop %CONTAINER_NAME% >nul 2>&1
docker rm   %CONTAINER_NAME% >nul 2>&1
docker rmi  %IMAGE_NAME%     >nul 2>&1
echo [OK] Container and image removed.
GOTO END

:END
echo.
