@echo off
chcp 65001 > nul
setlocal

echo ====================================================
echo   Tucano Cloud - Build de Executáveis Windows (.exe e .msi)
echo ====================================================

cd /d "%~dp0.."

echo [1/2] Executando build de produção (NSIS e WiX/MSI)...
call npm run tauri -- build --bundles nsis,msi

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERRO] Falha durante o build do Tauri.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Instaladores gerados com sucesso em src-tauri\target\release\bundle:
dir /s /b src-tauri\target\release\bundle\*.exe src-tauri\target\release\bundle\*.msi 2>nul

echo.
echo ====================================================
echo   Build finalizado com sucesso!
echo ====================================================
pause
