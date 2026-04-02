@echo off
cd /d "%~dp0.."
echo =====================================
echo PalaLauriLab - Aggiorna archivio
echo =====================================
echo.
python -m pip install --upgrade pip >nul 2>&1
python -m pip install pypdf
python scripts\build_archive.py
echo.
echo Operazione completata.
pause
