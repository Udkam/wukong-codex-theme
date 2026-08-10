[CmdletBinding()]
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [switch]$NoShortcut
)

$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($Root)

foreach ($requiredRelative in @(
    'package.json',
    'runtime\activate-appx.ps1',
    'runtime\activate-appx.cs',
    'runtime\host.mjs',
    'runtime\native-entry-supervisor.cs',
    'runtime\forge-background-v13.css',
    'themes\active.json',
    'scripts\install-chatgpt-hook.ps1',
    'scripts\install-native-supervisor.ps1',
    'scripts\verify-launch-adapter.ps1'
)) {
    $required = Join-Path $rootPath $requiredRelative
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) {
        throw "Repository-backed installation is incomplete: $required"
    }
}

$rootItem = Get-Item -LiteralPath $rootPath -Force
if ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw "Repository-backed installation refuses a reparse-point root: $rootPath"
}

$packageDefinition = Get-Content -LiteralPath (Join-Path $rootPath 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$packageDefinition.name -ne 'wukong-codex-forge') {
    throw 'Repository-backed installation found an invalid package marker.'
}

if ($NoShortcut) {
    Write-Host "Validated repository-backed Wukong source at $rootPath. No shortcut was changed."
    return
}

# A machine that previously used an append-only release may still have its old host
# attached to the same native renderer. Retire that control-pipe owner without WMI,
# process termination, or release deletion before repository mode becomes current.
$package = Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1
if (-not $package) { throw 'Official OpenAI.Codex Store package was not found.' }
$node = Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
if (-not (Test-Path -LiteralPath $node -PathType Leaf)) {
    throw 'The Node runtime bundled with OpenAI.Codex was not found.'
}
$legacyHostOutput = @(
    & $node (Join-Path $rootPath 'runtime\host.mjs') --signal-disable --root $rootPath 2>&1
)
if ($LASTEXITCODE -ne 0) {
    throw "A previous retained-release host could not restore native state: $($legacyHostOutput -join ' ')"
}

& (Join-Path $rootPath 'scripts\install-chatgpt-hook.ps1') -Root $rootPath -Repository
$verificationOutput = @(
    & (Join-Path $rootPath 'scripts\verify-launch-adapter.ps1') -Root $rootPath -Repository
)
$verificationLine = @($verificationOutput | Where-Object { $_ -and ([string]$_).Trim().StartsWith('{') })[-1]
if (-not $verificationLine) {
    throw 'Repository launch adapter verification did not return machine-readable evidence.'
}
$verification = $verificationLine | ConvertFrom-Json
if (-not [string]::Equals(
    [IO.Path]::GetFullPath([string]$verification.bridgeHostPath),
    [IO.Path]::GetFullPath($node),
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw 'Repository launch adapter verification returned a different embedded Node path.'
}

$supervisorOutput = @(
    & (Join-Path $rootPath 'scripts\install-native-supervisor.ps1') -Root $rootPath
)
$supervisorLine = @($supervisorOutput | Where-Object { $_ -and ([string]$_).Trim().StartsWith('{') })[-1]
if (-not $supervisorLine) {
    throw 'Native entry supervisor installation did not return machine-readable evidence.'
}
$supervisor = $supervisorLine | ConvertFrom-Json
$expectedChatGpt = [IO.Path]::GetFullPath((Join-Path $package.InstallLocation 'app\ChatGPT.exe'))
$expectedBridge = [IO.Path]::GetFullPath([string]$verification.bridgePath)
if (
    -not [bool]$supervisor.installed -or
    -not [bool]$supervisor.started -or
    -not [string]::Equals([string]$supervisor.eventSource, 'SetWinEventHook(EVENT_OBJECT_SHOW)', [StringComparison]::Ordinal) -or
    [bool]$supervisor.steadyPolling -or
    [bool]$supervisor.wmi -or
    [bool]$supervisor.powerShellOnLaunch -or
    -not [string]::Equals([string]$supervisor.activationRuntime, 'native-dotnet-framework', [StringComparison]::Ordinal) -or
    -not [bool]$supervisor.currentChatGptUntouched -or
    -not [string]::Equals([IO.Path]::GetFullPath([string]$supervisor.repositoryRoot), $rootPath, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([IO.Path]::GetFullPath([string]$supervisor.expectedChatGptPath), $expectedChatGpt, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([IO.Path]::GetFullPath([string]$supervisor.embeddedNodePath), [IO.Path]::GetFullPath($node), [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([IO.Path]::GetFullPath([string]$supervisor.bridgePath), $expectedBridge, [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([IO.Path]::GetFullPath([string]$supervisor.activatorExecutablePath), [IO.Path]::GetFullPath([string]$verification.activationHelperPath), [StringComparison]::OrdinalIgnoreCase) -or
    -not [string]::Equals([string]$supervisor.appUserModelId, [string]$verification.appUserModelId, [StringComparison]::Ordinal)
) {
    throw 'Native entry supervisor evidence does not match this verified repository launch adapter.'
}
$verification | Add-Member -NotePropertyName activationHelperHash -NotePropertyValue ([string]$supervisor.activatorExecutableHash) -Force
$verification | Add-Member -NotePropertyName nativeEntrySupervisor -NotePropertyValue $supervisor -Force

Write-Host "Wukong now loads directly from this repository: $rootPath"
Write-Host 'The visible application remains the official ChatGPT/Codex entry; no separately named Wukong launcher is installed.'
Write-Host 'Both the native Store/taskbar entry and the user Start Menu ChatGPT entry route to the same repository bridge.'
Write-Host 'No theme runtime was copied into CODEX_HOME and no pet package was installed.'
Write-Host 'ChatGPT.exe, app.asar, WindowsApps and the official Codex configuration were not modified.'
Write-Host 'The native Store/taskbar entry is observed by SetWinEventHook without WMI or steady polling.'
Write-Host 'If this repository is removed, the supervisor unregisters itself and later launches remain native.'
$verification | ConvertTo-Json -Depth 8 -Compress
