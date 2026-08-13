[CmdletBinding()]
param(
    [switch]$Uninstall,
    [string]$Destination = (Join-Path $env:USERPROFILE '.codex\themes\wukong-codex-theme'),
    [switch]$AllowLegacyMutation
)

$ErrorActionPreference = 'Stop'
if ($Uninstall -or $AllowLegacyMutation) { Write-Warning 'Deletion is not performed. Theme files and archived state are retained.' }
& (Join-Path $PSScriptRoot 'disable.ps1') -Root (Split-Path $PSScriptRoot -Parent)
return

<# Archived legacy implementation retained below as non-executable history.

$controlled = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.codex\themes\wukong-codex-forge'))
$target = [IO.Path]::GetFullPath($Destination)
if (-not [string]::Equals($target, $controlled, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing uninstall: Destination is outside the managed CODEX_HOME Wukong theme directory.'
}
if (-not (Test-Path -LiteralPath $target)) {
    Write-Host 'No managed Wukong theme is installed.'
    return
}

$targetItem = Get-Item -LiteralPath $target -Force
if ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'Refusing uninstall: the managed theme path is a reparse point.'
}
$statePath = Join-Path $target 'state.json'
$enginePath = Join-Path $target 'native-theme.mjs'
if (-not (Test-Path -LiteralPath $statePath) -or -not (Test-Path -LiteralPath $enginePath)) {
    throw 'Refusing uninstall: managed theme files are incomplete.'
}
$state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($state.managedBy -ne 'WukongCodexForgeNativeTheme') {
    throw 'Refusing uninstall: native theme state marker is invalid.'
}
if (-not [string]::Equals([IO.Path]::GetFullPath([string]$state.destination), $controlled, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing uninstall: state destination does not match the managed theme directory.'
}

$node = (Get-Command node -ErrorAction Stop).Source
$profilePath = if ($state.runtime.profilePath) { [string]$state.runtime.profilePath } else { Join-Path $target 'profile' }
if (-not [string]::Equals([IO.Path]::GetFullPath($profilePath), [IO.Path]::GetFullPath((Join-Path $target 'profile')), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Refusing uninstall: managed profile path is invalid.'
}
$themedProcesses = @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($profilePath, [StringComparison]::OrdinalIgnoreCase) -ge 0
})
$disableRequest = Join-Path $target 'disable.request'
if ($state.runtime -and $themedProcesses.Count -gt 0) {
    [IO.File]::WriteAllText($disableRequest, 'restore', [Text.UTF8Encoding]::new($false))
    $deadline = [DateTime]::UtcNow.AddSeconds(6)
    do {
        Start-Sleep -Milliseconds 250
        $latest = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    } while ($latest.runtime.state -ne 'disabled' -and [DateTime]::UtcNow -lt $deadline)

    $activePortPath = Join-Path $profilePath 'DevToolsActivePort'
    $injector = Join-Path $target 'app\runtime\injector.mjs'
    if ((Test-Path -LiteralPath $activePortPath) -and (Test-Path -LiteralPath $injector)) {
        $port = 0
        $portLine = [IO.File]::ReadAllLines($activePortPath, [Text.Encoding]::UTF8)[0]
        if ([int]::TryParse($portLine, [ref]$port) -and $port -ge 1024 -and $port -le 65535) {
            Push-Location (Join-Path $target 'app')
            try { & $node runtime/injector.mjs --restore $port }
            catch { Write-Warning 'The live style restore channel closed before confirmation.' }
            finally { Pop-Location }
        }
    }
}

$configPath = Join-Path $env:USERPROFILE '.codex\config.toml'
& $node $enginePath restore --config $configPath --destination $target
if ($LASTEXITCODE -ne 0) { throw 'Native Codex theme restore failed.' }

$expectedShortcut = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex - Wukong Theme.lnk'))
if ($state.runtime.shortcutPath) {
    $recordedShortcut = [IO.Path]::GetFullPath([string]$state.runtime.shortcutPath)
    if (-not [string]::Equals($recordedShortcut, $expectedShortcut, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing uninstall: managed shortcut path does not match the expected Start Menu target.'
    }
    if ($Uninstall -and (Test-Path -LiteralPath $recordedShortcut)) {
        Remove-Item -LiteralPath $recordedShortcut -Force
    }
}

if (-not $Uninstall) {
    Write-Host 'Restored native Codex surfaces; managed theme files remain available for a later themed launch.'
    return
}
if ($themedProcesses.Count -gt 0) {
    Write-Warning 'The Wukong style was removed from the open window and its launcher was removed.'
    throw 'Close the managed Codex window, then run remove-theme.cmd again to delete its in-use profile and remaining files.'
}

$reparseItems = @(Get-ChildItem -LiteralPath $target -Recurse -Force -ErrorAction Stop | Where-Object {
    $_.Attributes -band [IO.FileAttributes]::ReparsePoint
})
if ($reparseItems.Count -gt 0) {
    throw 'Refusing uninstall: a reparse point exists inside the managed theme directory.'
}
Remove-Item -LiteralPath $target -Recurse -Force
Write-Host 'Removed the managed Wukong style, profile, launcher, and native baseline. Codex program files were never modified.'

$normalCodexStillRunning = @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue).Count -gt 0
if ($normalCodexStillRunning) {
    Write-Warning 'A non-managed Codex window is still open and may retain cached native colors until its next launch.'
}
#>
