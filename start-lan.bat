@echo off
rem ============================================================
rem  Dingyun Yachen Quality Experience Center  -  V2 LAN Preview
rem  IMPORTANT: uses SYSTEM node.exe (D:\Program Files\nodejs)
rem  because the managed node.exe has an explicit INBOUND BLOCK
rem  firewall rule, which makes the server unreachable from LAN.
rem  This file is intentionally ASCII-only + path-free (%~dp0)
rem  so that non-ASCII directories / code pages cannot garble it.
rem ============================================================
setlocal
chcp 65001 >nul 2>&1
cd /d "%~dp0"

set "NODE=D:\Program Files\nodejs\node.exe"
set "VITE=.\node_modules\vite\bin\vite.js"
set "PORT=3010"

if not exist "%NODE%" (
  echo [ERROR] System Node not found at: %NODE%
  echo         Edit this file and point NODE to your node.exe
  pause
  exit /b 1
)

if not exist "%VITE%" (
  echo [ERROR] vite not found: %VITE%
  echo         Run "npm install" first.
  pause
  exit /b 1
)

title Dingyun Yachen V2 - LAN Preview :%PORT%

echo.
echo [1/2] Building production bundle ...
"%NODE%" "%VITE%" build
if errorlevel 1 (
  echo.
  echo [ERROR] Build failed. Preview aborted.
  pause
  exit /b 1
)

echo.
echo [2/2] Starting preview server bound to 0.0.0.0:%PORT%
echo.
echo   Local : http://127.0.0.1:%PORT%/
echo   LAN   : http://^<your-LAN-IPv4^>:%PORT%/     ^<- run "ipconfig" to find it
echo.
echo   Deep links (append to the URL):
echo     ?view=OVERVIEW | SALES | BORROW | AUDIT | PARTNERS | FRANCHISEES | SPREADSHEET
echo.
echo   Press Ctrl+C to stop the server.
echo.

"%NODE%" "%VITE%" preview --port=%PORT% --host=0.0.0.0 --strictPort

echo.
echo Server stopped.
pause
endlocal
