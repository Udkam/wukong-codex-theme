[CmdletBinding()]
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($Root)

$verificationOutput = @(
    & (Join-Path $rootPath 'scripts\install-repository.ps1') -Root $rootPath
)
$verificationLine = @($verificationOutput | Where-Object { $_ -and ([string]$_).Trim().StartsWith('{') })[-1]
if (-not $verificationLine) {
    throw 'Repository launch adapter verification did not return machine-readable evidence.'
}
$verification = $verificationLine | ConvertFrom-Json
$node = [IO.Path]::GetFullPath([string]$verification.bridgeHostPath)
$bridge = [IO.Path]::GetFullPath([string]$verification.bridgePath)
if (-not (Test-Path -LiteralPath $node -PathType Leaf) -or -not (Test-Path -LiteralPath $bridge -PathType Leaf)) {
    throw 'Repository launch adapter verification returned a missing bridge or embedded Node path.'
}

& $node $bridge
$bridgeExitCode = $LASTEXITCODE
if ($bridgeExitCode -eq 4) {
    throw @'
ChatGPT is already running from an unmanaged native entry and has no reusable DevTools channel.
Exit ChatGPT completely, including its tray/background instance, then run start-theme.cmd once to repair and launch the native ChatGPT entry.
The signed Store process cannot be retrofitted after it has already started without the managed launch flags.
'@
}
if ($bridgeExitCode -ne 0) {
    throw "The verified repository launch bridge failed with exit code $bridgeExitCode."
}

Write-Host 'The official ChatGPT.exe is starting with the Wukong renderer theme loaded directly from this repository.'
