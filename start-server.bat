@echo off
REM ============================================================
REM  Dingyun Yachen - MCP / API server launcher
REM
REM  Starts the backend that serves:
REM    - the web app (dist/)
REM    - REST API (/api/*)
REM    - MCP endpoint for phone AI assistants (/mcp, /sse)
REM
REM  IMPORTANT: uses the SYSTEM node, not the sandboxed one.
REM  The sandboxed runtime carries an explicit firewall BLOCK rule
REM  for Public/Inbound, so LAN devices would be rejected silently.
REM  System node: D:\Program Files\nodejs\node.exe
REM
REM  NOTE: keep this file ASCII-only. Chinese text + codepage
REM  mismatch corrupts .bat files on this machine.
REM ============================================================

setlocal
cd /d "%~dp0"

set "NODE_EXE=D:\Program Files\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE=node"

set "PORT=%PORT%"
if "%PORT%"=="" set "PORT=3020"

echo.
echo Starting Dingyun Yachen server on port %PORT% ...
echo Node: %NODE_EXE%
echo.

if not exist "dist\index.html" (
  echo [warn] dist\index.html not found - the web UI will not be served.
  echo        Run "npm run build" first. The MCP/API endpoints still work.
  echo.
)

if not exist "server\data\seed.json" (
  echo [info] seed.json missing - generating it from src/data/initialData.ts ...
  "%NODE_EXE%" .\node_modules\tsx\dist\cli.mjs server\scripts\build-seed.ts
  echo.
)

"%NODE_EXE%" server\index.mjs

echo.
echo Server stopped.
pause
