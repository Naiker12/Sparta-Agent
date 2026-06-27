@echo off
echo === Building sparta-security (Rust + napi-rs) ===

cd /d "%~dp0"

REM Install @napi-rs/cli if not present
where npx >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js/npx not found
    exit /b 1
)

echo [1/2] Installing napi-rs CLI...
call npx @napi-rs/cli@latest --version >nul 2>&1 || call npm install --no-save @napi-rs/cli

echo [2/2] Building native addon...
call npx napi build --platform --release

echo.
echo === Build complete ===
echo Output: sparta-security.{platform}.node
