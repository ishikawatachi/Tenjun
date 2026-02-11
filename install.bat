@echo off
REM ============================================
REM Threat Modeling Platform - Installer Launcher
REM ============================================

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                                                               ║
echo ║     THREAT MODELING PLATFORM - INSTALLER                     ║
echo ║                                                               ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Check if PowerShell is available
where powershell >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available
    echo.
    echo Please install PowerShell or use WSL with install.sh
    echo.
    pause
    exit /b 1
)

echo Starting PowerShell installer...
echo.

REM Run PowerShell script with appropriate execution policy
powershell.exe -ExecutionPolicy Bypass -File "%~dp0install.ps1"

if %errorlevel% neq 0 (
    echo.
    echo ERROR: Installation failed
    echo.
    echo Alternative: Use WSL (Windows Subsystem for Linux)
    echo   1. Install WSL: wsl --install
    echo   2. Run: bash install.sh
    echo.
    pause
    exit /b 1
)

echo.
pause
