@echo off
REM Sparta AI Sidecar — Setup script for Windows
REM Creates a venv and installs all 14 workspace packages in editable mode.

echo === Sparta AI Sidecar Setup ===

REM Create virtual environment if not exists
if not exist ".venv\Scripts\python.exe" (
    echo [1/4] Creating Python virtual environment...
    python -m venv .venv
)

echo [2/4] Activating virtual environment...
call .venv\Scripts\activate.bat

echo [3/4] Installing workspace packages (editable mode)...
pip install -e ./py-sparta-errors -e ./py-sparta-config -e ./py-sparta-security -e ./py-sparta-providers -e ./py-sparta-audio -e ./py-sparta-persistence -e ./py-sparta-hooks -e ./py-sparta-memory -e ./py-sparta-streaming -e ./py-sparta-tools -e ./py-sparta-skills -e ./py-sparta-agents -e ./py-sparta-handlers -e ./py-sparta-mcp

echo [4/4] Installing dev dependencies...
pip install pytest pytest-asyncio pytest-mock ruff

echo.
echo === Setup complete ===
echo.
echo To activate the environment later, run:
echo   .venv\Scripts\activate
echo.
echo To run Python tests (per package):
echo   .venv\Scripts\python -m pytest py-sparta-<domain>/tests/ -v
echo.
echo To run the sidecar standalone:
echo   .venv\Scripts\python -m sparta_mcp.main
