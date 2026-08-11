[CmdletBinding()]
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [switch]$Portable
)

$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($Root)
$packageDefinition = Join-Path $rootPath 'package.json'
if (-not (Test-Path -LiteralPath $packageDefinition -PathType Leaf)) {
    throw 'Theme package marker package.json is missing.'
}

$themePackage = Get-Content -LiteralPath $packageDefinition -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$themePackage.name -ne 'wukong-codex-theme') {
    throw 'Theme package marker is invalid.'
}

$startScript = Join-Path $rootPath 'scripts\start.ps1'
if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    throw 'Current repository-backed theme launcher scripts\start.ps1 is missing.'
}

# Retain the legacy -Portable switch as a no-op so old shortcuts and callers do
# not fail parameter binding. The current repository-backed entry owns profile
# selection and lifecycle policy in one implementation.
$null = $Portable
& $startScript -Root $rootPath
