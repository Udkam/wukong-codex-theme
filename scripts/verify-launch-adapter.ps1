[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [switch]$Portable,
    [switch]$Repository
)

$ErrorActionPreference = 'Stop'
if ($Portable -and $Repository) {
    throw 'Launch adapter verification failed: repository and portable modes are mutually exclusive.'
}

function Get-PortableSha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '')
    }
    finally {
        $algorithm.Dispose()
        $stream.Dispose()
    }
}

function Get-TextSha256([string]$Value) {
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try {
        return ([BitConverter]::ToString($algorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($Value)))).Replace('-', '')
    }
    finally {
        $algorithm.Dispose()
    }
}

function Assert-DirectPath([string]$Path, [string]$Label) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction Stop
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw "Launch adapter verification refused a reparse point for ${Label}: $Path"
    }
}

$rootPath = [IO.Path]::GetFullPath($Root)
$markerPath = Join-Path $rootPath 'package.json'
$hostPath = Join-Path $rootPath 'runtime\host.mjs'
$legacyActivatorPath = Join-Path $rootPath 'runtime\activate-appx.ps1'
$activatorSourcePath = Join-Path $rootPath 'runtime\activate-appx.cs'
if (
    -not (Test-Path -LiteralPath $markerPath) -or
    -not (Test-Path -LiteralPath $hostPath) -or
    -not (Test-Path -LiteralPath $legacyActivatorPath) -or
    -not (Test-Path -LiteralPath $activatorSourcePath)
) {
    throw 'Launch adapter verification failed: theme source root is incomplete.'
}
Assert-DirectPath -Path $rootPath -Label 'theme root'
Assert-DirectPath -Path $markerPath -Label 'package marker'
Assert-DirectPath -Path $hostPath -Label 'event lifecycle host'
Assert-DirectPath -Path $legacyActivatorPath -Label 'legacy AppX activation helper'
Assert-DirectPath -Path $activatorSourcePath -Label 'native AppX activation source'
$marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$marker.name -ne 'wukong-codex-forge') {
    throw 'Launch adapter verification failed: package marker name is invalid.'
}

$programs = [Environment]::GetFolderPath('Programs')
$shortcutPath = Join-Path $programs 'ChatGPT.lnk'
$adapterRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'WukongCodexForge'))
$repositoryId = (Get-TextSha256 $rootPath.ToLowerInvariant()).Substring(0, 16).ToLowerInvariant()
$nativeActivatorPath = Join-Path $adapterRoot "native-supervisor\appx-activator-$repositoryId.exe"
$eventPath = Join-Path $adapterRoot 'shortcut-hook-events.jsonl'
foreach ($path in @($shortcutPath, $eventPath)) {
    if (-not (Test-Path -LiteralPath $path)) {
        throw "Launch adapter verification failed: required path is missing: $path"
    }
    Assert-DirectPath -Path $path -Label 'adapter evidence'
}

$shell = New-Object -ComObject WScript.Shell
$defaultShortcut = $shell.CreateShortcut($shortcutPath)
$package = Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1
if (-not $package) { throw 'Launch adapter verification failed: official OpenAI.Codex Store package was not found.' }
$expectedChatGpt = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
$expectedTarget = Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
if (-not (Test-Path -LiteralPath $expectedChatGpt) -or -not (Test-Path -LiteralPath $expectedTarget)) {
    throw 'Launch adapter verification failed: official ChatGPT or its embedded Node was not found.'
}
$manifestPath = Join-Path $package.InstallLocation 'AppxManifest.xml'
[xml]$manifest = [IO.File]::ReadAllText($manifestPath, [Text.Encoding]::UTF8)
$manifestApplication = @($manifest.SelectNodes(
    "/*[local-name()='Package']/*[local-name()='Applications']/*[local-name()='Application']"
)) | Where-Object {
    [string]::Equals(
        ([string]$_.GetAttribute('Executable')).Replace('/', '\').TrimStart([char]92),
        'app\ChatGPT.exe',
        [StringComparison]::OrdinalIgnoreCase
    )
} | Select-Object -First 1
if (-not $manifestApplication -or [string]::IsNullOrWhiteSpace([string]$manifestApplication.GetAttribute('Id'))) {
    throw 'Launch adapter verification failed: official AppX application identity is unavailable.'
}
$expectedAumid = ([string]$package.PackageFamilyName) + '!' + [string]$manifestApplication.GetAttribute('Id')
if (-not [string]::Equals(
    [IO.Path]::GetFullPath($defaultShortcut.TargetPath),
    [IO.Path]::GetFullPath($expectedTarget),
    [StringComparison]::OrdinalIgnoreCase
)) {
    if ([string]::Equals(
        [IO.Path]::GetFullPath($defaultShortcut.TargetPath),
        [IO.Path]::GetFullPath($expectedChatGpt),
        [StringComparison]::OrdinalIgnoreCase
    )) {
        throw 'Launch adapter verification failed: the Store package replaced the managed ChatGPT shortcut. Run install-theme.cmd again.'
    }
    throw 'Launch adapter verification failed: the native ChatGPT entry does not target the retained bridge host.'
}
$expectedIconLocation = "$expectedChatGpt,0"
if (-not [string]::Equals([string]$defaultShortcut.IconLocation, $expectedIconLocation, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Launch adapter verification failed: the native ChatGPT entry does not use the official ChatGPT icon.'
}
$bridgeMatch = [regex]::Match($defaultShortcut.Arguments, '^"([^"]+\.mjs)"$')
if (-not $bridgeMatch.Success) {
    throw 'Launch adapter verification failed: shortcut does not contain one quoted Node bridge path.'
}
$bridgePath = [IO.Path]::GetFullPath($bridgeMatch.Groups[1].Value)
if (-not (Test-Path -LiteralPath $bridgePath)) {
    throw "Launch adapter verification failed: bridge is missing: $bridgePath"
}
Assert-DirectPath -Path $bridgePath -Label 'launcher bridge'
$bridge = [IO.File]::ReadAllText($bridgePath, [Text.Encoding]::UTF8)
$rootMatch = [regex]::Match($bridge, '(?m)^const themeRoot = ("(?:\\.|[^"])*");\s*$')
if (-not $rootMatch.Success) {
    throw 'Launch adapter verification failed: bridge theme root declaration is missing.'
}
$bridgeRoot = [IO.Path]::GetFullPath(($rootMatch.Groups[1].Value | ConvertFrom-Json))
if (-not [string]::Equals($bridgeRoot, $rootPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Launch adapter verification failed: bridge root is stale. Expected $rootPath; found $bridgeRoot"
}
$portableMatch = [regex]::Match($bridge, '(?m)^const portable = (true|false);\s*$')
$repositoryMatch = [regex]::Match($bridge, '(?m)^const repository = (true|false);\s*$')
if (-not $portableMatch.Success -or -not $repositoryMatch.Success) {
    throw 'Launch adapter verification failed: bridge launch-mode declaration is missing.'
}
$bridgePortable = [bool]($portableMatch.Groups[1].Value | ConvertFrom-Json)
$bridgeRepository = [bool]($repositoryMatch.Groups[1].Value | ConvertFrom-Json)
if ($bridgePortable -ne [bool]$Portable -or $bridgeRepository -ne [bool]$Repository) {
    throw 'Launch adapter verification failed: bridge launch mode does not match the requested source mode.'
}
if ($Repository -and $bridge -notmatch "\['--repository'\]") {
    throw 'Launch adapter verification failed: repository bridge does not request repository mode.'
}
$activatorMatch = [regex]::Match($bridge, '(?m)^const activator = ("(?:\\.|[^"])*");\s*$')
$aumidMatch = [regex]::Match($bridge, '(?m)^const activationAumid = ("(?:\\.|[^"])*");\s*$')
$packageMatch = [regex]::Match($bridge, '(?m)^const activationPackage = ("(?:\\.|[^"])*");\s*$')
$versionMatch = [regex]::Match($bridge, '(?m)^const activationVersion = ("(?:\\.|[^"])*");\s*$')
$executableMatch = [regex]::Match($bridge, '(?m)^const activationExecutable = ("(?:\\.|[^"])*");\s*$')
if (-not $activatorMatch.Success -or -not $aumidMatch.Success -or -not $packageMatch.Success -or -not $versionMatch.Success -or -not $executableMatch.Success) {
    throw 'Launch adapter verification failed: native AppX activation declarations are missing.'
}
$bridgeActivatorPath = [IO.Path]::GetFullPath(($activatorMatch.Groups[1].Value | ConvertFrom-Json))
if (
    -not [string]::Equals($bridgeActivatorPath, $nativeActivatorPath, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals(($aumidMatch.Groups[1].Value | ConvertFrom-Json), $expectedAumid, [StringComparison]::Ordinal) -or
    -not [string]::Equals(($packageMatch.Groups[1].Value | ConvertFrom-Json), [string]$package.PackageFullName, [StringComparison]::Ordinal) -or
    -not [string]::Equals(($versionMatch.Groups[1].Value | ConvertFrom-Json), ([version]$package.Version).ToString(), [StringComparison]::Ordinal) -or
    -not [string]::Equals([IO.Path]::GetFullPath(($executableMatch.Groups[1].Value | ConvertFrom-Json)), [IO.Path]::GetFullPath($expectedChatGpt), [StringComparison]::OrdinalIgnoreCase)
) {
    throw 'Launch adapter verification failed: native AppX activation declarations are stale.'
}
if (
    $bridge -notmatch "runtime', 'host\.mjs" -or
    $bridge -notmatch "--appx-activator" -or
    $bridge -match 'powershell(?:\.exe)?|launch\.ps1'
) {
    throw 'Launch adapter verification failed: bridge is not the non-PowerShell event-host bridge.'
}

$eventLines = @(Get-Content -LiteralPath $eventPath -Encoding UTF8 | Where-Object { $_.Trim() })
if ($eventLines.Count -eq 0) {
    throw 'Launch adapter verification failed: hook event log is empty.'
}
$latestEvent = $eventLines[-1] | ConvertFrom-Json
if (-not [string]::Equals(
    [IO.Path]::GetFullPath([string]$latestEvent.themeRoot),
    $rootPath,
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw 'Launch adapter verification failed: latest hook event points to a stale theme source.'
}
if ([bool]$latestEvent.portable -ne [bool]$Portable -or [bool]$latestEvent.repository -ne [bool]$Repository) {
    throw 'Launch adapter verification failed: latest hook event has a different source mode.'
}
if (
    -not [string]::Equals([string]$latestEvent.shortcutPath, $shortcutPath, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([string]$latestEvent.entryPolicy, 'native-chatgpt-only', [StringComparison]::Ordinal) -or
    -not [string]::Equals([IO.Path]::GetFullPath([string]$latestEvent.activationHelper), $nativeActivatorPath, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([string]$latestEvent.activationHelperSource, 'runtime\activate-appx.cs', [StringComparison]::Ordinal) -or
    -not [string]::Equals([string]$latestEvent.activationMode, 'native-appx-aumid', [StringComparison]::Ordinal)
) {
    throw 'Launch adapter verification failed: hook event does not describe the single native ChatGPT entry.'
}

$result = [ordered]@{
    verified = $true
    version = [string]$marker.version
    themeRoot = $rootPath
    shortcutPath = $shortcutPath
    entryPolicy = 'native-chatgpt-only'
    bridgePath = $bridgePath
    bridgeHash = Get-PortableSha256 $bridgePath
    bridgeHost = 'CodexEmbeddedNode'
    bridgeHostPath = $expectedTarget
    activationMode = 'native-appx-aumid'
    activationHelperPath = $nativeActivatorPath
    activationHelperHash = if (Test-Path -LiteralPath $nativeActivatorPath) { Get-PortableSha256 $nativeActivatorPath } else { $null }
    activationHelperSourcePath = $activatorSourcePath
    activationHelperSourceHash = Get-PortableSha256 $activatorSourcePath
    appUserModelId = $expectedAumid
    eventDriven = $true
    sourceMode = if ($Repository) { 'repository-live' } elseif ($Portable) { 'portable' } else { 'retained-release' }
    defaultShortcutHash = Get-PortableSha256 $shortcutPath
    latestHookAt = [string]$latestEvent.at
}
$result | ConvertTo-Json -Compress
