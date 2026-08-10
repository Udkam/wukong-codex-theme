@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-repository.ps1" -Root "%~dp0."
if errorlevel 1 pause
