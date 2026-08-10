[CmdletBinding()]
param(
    [string]$Destination = (Join-Path $env:USERPROFILE '.codex\themes\wukong-codex-forge'),
    [switch]$NoShortcut
)

$ErrorActionPreference = 'Stop'
$source = Split-Path $PSScriptRoot -Parent

Write-Warning 'Append-only release copying is retired. This compatibility entry now links the live repository without copying theme assets.'
& (Join-Path $PSScriptRoot 'install-repository.ps1') -Root $source -NoShortcut:$NoShortcut
