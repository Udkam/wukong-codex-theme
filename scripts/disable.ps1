[CmdletBinding()]
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [switch]$Portable,
    [switch]$Repository
)

$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($Root)
$releaseMarker = Join-Path (Split-Path $rootPath -Parent) 'release.json'
$repositoryMode = if ($PSBoundParameters.ContainsKey('Repository')) {
    [bool]$Repository
}
else {
    -not $Portable -and -not (Test-Path -LiteralPath $releaseMarker)
}

if ($Portable -and $repositoryMode) {
    throw 'Repository and portable disable modes are mutually exclusive.'
}

$packageDefinition = Join-Path $rootPath 'package.json'
$lifecycleHost = Join-Path $rootPath 'runtime\host.mjs'
if (-not (Test-Path -LiteralPath $packageDefinition -PathType Leaf) -or -not (Test-Path -LiteralPath $lifecycleHost -PathType Leaf)) {
    throw 'Theme source is incomplete; live native restoration cannot be requested from this directory.'
}
$themePackage = Get-Content -LiteralPath $packageDefinition -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$themePackage.name -ne 'wukong-codex-theme') {
    throw 'Theme package marker is invalid.'
}

$package = Get-AppxPackage -Name 'OpenAI.Codex' | Select-Object -First 1
if (-not $package) { throw 'Official OpenAI.Codex Store package was not found.' }
$node = Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) {
    throw 'The Node runtime bundled with OpenAI.Codex was not found.'
}

$hostArguments = @($lifecycleHost, '--signal-disable', '--root', $rootPath)
if ($repositoryMode) { $hostArguments += '--repository' }
elseif ($Portable) { $hostArguments += '--portable' }

$hostOutput = @(& $node @hostArguments 2>&1)
if ($LASTEXITCODE -ne 0) {
    throw "Event lifecycle host did not restore native state: $($hostOutput -join ' ')"
}
$responseLine = @($hostOutput | Where-Object { $_ -and ([string]$_).Trim().StartsWith('{') })[-1]
if (-not $responseLine) {
    throw 'Event lifecycle host returned no machine-readable disable evidence.'
}
try {
    $response = $responseLine | ConvertFrom-Json
}
catch {
    throw 'Event lifecycle host returned invalid disable evidence.'
}

if ([string]$response.state -eq 'disable') {
    if ([bool]$response.result.deferredNative) {
        Write-Host 'No renderer was visible; the event host stopped and the next unthemed launch will use the native surface.'
    }
    else {
        Write-Host 'The running ChatGPT renderer was restored to verified native DOM state and left open.'
    }
}
elseif ([string]$response.state -eq 'not-running') {
    Write-Host 'No repository lifecycle host is running; there is no active managed renderer to restore.'
}
else {
    throw "Unexpected lifecycle disable result: $($response | ConvertTo-Json -Compress)"
}

Write-Host 'No process was terminated and no repository, shortcut, release, asset or log was deleted.'
