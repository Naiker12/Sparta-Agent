@echo off
REM Sparta AI Sidecar — Setup script for Windows

echo === Sparta AI Sidecar Setup ===

REM Create virtual environment if not exists
if not exist ".venv\Scripts\python.exe" (
    echo [1/3] Creating Python virtual environment...
    python -m venv .venv
)

echo [2/3] Activating virtual environment...
call .venv\Scripts\activate.bat

echo [3/3] Installing dependencies...
pip install -r requirements.txt -r requirements-dev.txt

echo.
echo === Setup complete ===
echo.
echo To activate the environment later, run:
echo   .venv\Scripts\activate
echo.
echo To run Python tests:
echo   .venv\Scripts\python -m pytest sparta_ai/tests/ -v
echo.
echo To run the sidecar standalone:
echo   .venv\Scripts\python sparta_ai/main.py
