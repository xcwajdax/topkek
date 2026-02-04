@echo off
setlocal enabledelayedexpansion

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
        exit
    )
)

echo [V] Python detected.
echo [!] Starting local server on http://localhost:8002...
echo.

:: Use 'start' with the URL directly - this triggers the system default browser.
:: Wrapping in quotes is safer, and the empty title "" is necessary for 'start' with paths/URLs.
start "" "http://localhost:8002"

:: Start Python HTTP Server
python -m http.server 8002
