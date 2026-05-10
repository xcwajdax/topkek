@echo off
setlocal enabledelayedexpansion

:: Always run from this batch file's folder (so Python finds server.py / project root).
cd /d "%~dp0"

echo ==========================================
echo    TOPKEK Productions - Quick Start
echo ==========================================
echo.

:: Check for Python using 'where' as a secondary check
where python >nul 2>&1
if %errorlevel% neq 0 (
    python --version >nul 2>&1
    if %errorlevel% neq 0 (
        echo [!] Python is NOT detected in PATH.
        echo [!] Please make sure "Add Python to PATH" was checked during install.
        pause
        exit /b 1
    )
)

echo [V] Python detected.
echo [!] Server will listen on port 8002 — open http://127.0.0.1:8002/ in the browser (IPv4 loopback).
echo     On Windows, "localhost" may use IPv6 first while Python serves IPv4 — that causes Chrome errors.
echo.

:: Server in a separate window with correct working directory (avoids race with browser).
start "TOPKEK server :8002" /D "%~dp0" cmd /k python server.py 8002

:: Brief pause so the socket is listening before the browser loads the page.
echo [!] Waiting for server to start...
timeout /t 3 /nobreak >nul

start "" "http://127.0.0.1:8002/"

echo.
echo Site should open in your browser at http://127.0.0.1:8002/
echo Keep the ^"TOPKEK server^" console open while testing. You can close this window.
echo.
pause
