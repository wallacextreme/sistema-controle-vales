param(
    [ValidateSet("all", "exe", "msi")]
    [string]$Target = "all"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "  Tucano Cloud - Build de Executáveis Windows       " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Alvo selecionado: $Target" -ForegroundColor Yellow

$bundles = switch ($Target) {
    "exe" { "nsis" }
    "msi" { "msi" }
    default { "nsis,msi" }
}

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

Write-Host "`n[1/2] Iniciando compilação Tauri Release (bundles: $bundles)..." -ForegroundColor Green
npm run tauri -- build --bundles $bundles

Write-Host "`n[2/2] Verificando artefatos gerados..." -ForegroundColor Green
$bundleDir = Join-Path $projectRoot "src-tauri\target\release\bundle"

if (Test-Path $bundleDir) {
    Write-Host "`n--- INSTALADORES GERADOS COM SUCESSO ---" -ForegroundColor Cyan
    $files = Get-ChildItem -Path $bundleDir -Recurse -Include *.exe, *.msi | Where-Object { $_.FullName -notmatch "target\\release\\controle" }
    foreach ($file in $files) {
        $sizeMB = [math]::Round($file.Length / 1MB, 2)
        Write-Host "-> [$($file.Extension.ToUpper().Trim('.'))] $($file.Name) ($sizeMB MB)" -ForegroundColor Green
        Write-Host "   Caminho: $($file.FullName)" -ForegroundColor Gray
    }
} else {
    Write-Host "Diretório de bundle não encontrado: $bundleDir" -ForegroundColor Red
}

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "  Build finalizado com sucesso!                     " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
