@echo off
echo ================================================================
echo Starting CoopConnect - AI-Powered Cooperative Marketplace
echo Tagline: Fair Work * Stronger Communities
echo ================================================================

echo.
echo [1/2] Launching FastAPI Backend on http://127.0.0.1:8000 ...
start "CoopConnect Backend (FastAPI)" cmd /k "cd backend && python main.py"

timeout /t 3 /nobreak >nul

echo.
echo [2/2] Launching Next.js Frontend on http://localhost:3000 ...
start "CoopConnect Frontend (Next.js)" cmd /k "cd frontend && npm run dev"

echo.
echo ================================================================
echo CoopConnect is running!
echo Frontend: http://localhost:3000
echo Backend API Docs: http://127.0.0.1:8000/docs
echo.
echo Initial state: Completely empty (Zero dummy data pre-filled).
echo Optional test data: Click 'Load Demo Data' in the top banner.
echo ================================================================
pause
