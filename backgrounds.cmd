@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\manage-backgrounds.ps1" %*
exit /b %ERRORLEVEL%
