[CmdletBinding()]
param(
    [string]$Destination = (Join-Path $env:USERPROFILE '.codex\themes\wukong-codex-forge'),
    [switch]$NoShortcut,
    [switch]$AllowLegacyMutation
)

$ErrorActionPreference = 'Stop'
if ($AllowLegacyMutation) { Write-Warning 'Legacy mutation was requested, but destructive legacy behavior remains archived and cannot run.' }
& (Join-Path $PSScriptRoot 'install-repository.ps1') -Root (Split-Path $PSScriptRoot -Parent) -NoShortcut:$NoShortcut
return

<# Archived legacy implementation retained below as non-executable history.

$controlled = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.codex\themes\wukong-codex-forge'))
$target = [IO.Path]::GetFullPath($Destination)
if (-not [string]::Equals($target, $controlled, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Destination must be the managed CODEX_HOME themes\wukong-codex-forge directory.'
}

$source = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $env:USERPROFILE '.codex\config.toml'
$definition = Join-Path $source 'themes\native-wukong.json'
$engine = Join-Path $source 'scripts\native-theme.mjs'
$packager = Join-Path $source 'scripts\package-runtime.mjs'
$node = (Get-Command node -ErrorAction Stop).Source
foreach ($required in @($configPath, $definition, $engine, $packager, (Join-Path $source 'scripts\launch.ps1'))) {
    if (-not (Test-Path -LiteralPath $required)) { throw "Required install file is missing: $required" }
}

$targetExisted = Test-Path -LiteralPath $target
$profilePath = Join-Path $target 'profile'
if ($targetExisted) {
    $targetItem = Get-Item -LiteralPath $target -Force
    if ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        throw 'Refusing update: the managed theme path is a reparse point.'
    }
    $statePath = Join-Path $target 'state.json'
    if (-not (Test-Path -LiteralPath $statePath)) { throw 'Refusing update: native theme state marker is missing.' }
    $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($state.managedBy -ne 'WukongCodexForgeNativeTheme') { throw 'Refusing update: native theme state marker is invalid.' }
    if (-not [string]::Equals([IO.Path]::GetFullPath([string]$state.destination), $target, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing update: native theme destination does not match the managed path.'
    }
    $themedProcesses = @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
        $_.CommandLine -and $_.CommandLine.IndexOf($profilePath, [StringComparison]::OrdinalIgnoreCase) -ge 0
    })
    if ($themedProcesses.Count -gt 0) { throw 'Close the managed Wukong Codex instance before updating its runtime.' }
} else {
    New-Item -ItemType Directory -Force -Path $target | Out-Null
}

$stage = Join-Path $target ('.app-stage-' + [Guid]::NewGuid().ToString('N'))
$appTarget = Join-Path $target 'app'
$codexWasRunning = @(Get-Process -Name ChatGPT -ErrorAction SilentlyContinue).Count -gt 0
try {
    New-Item -ItemType Directory -Path $stage | Out-Null
    & $node $packager --source $source --destination $stage
    if ($LASTEXITCODE -ne 0) { throw 'Managed runtime packaging failed.' }

    if ($targetExisted) {
        & $node $engine upgrade --config $configPath --definition $definition --destination $target
        if ($LASTEXITCODE -ne 0) { throw 'Native Codex theme upgrade failed.' }
    } else {
        Copy-Item -LiteralPath $engine -Destination (Join-Path $target 'native-theme.mjs') -Force
        & $node (Join-Path $target 'native-theme.mjs') install --config $configPath --definition $definition --destination $target
        if ($LASTEXITCODE -ne 0) { throw 'Native Codex theme install failed.' }
    }

    if (Test-Path -LiteralPath $appTarget) {
        $appItem = Get-Item -LiteralPath $appTarget -Force
        if ($appItem.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Refusing update: managed app path is a reparse point.' }
        Remove-Item -LiteralPath $appTarget -Recurse -Force
    }
    Move-Item -LiteralPath $stage -Destination $appTarget

    Copy-Item -LiteralPath $engine -Destination (Join-Path $target 'native-theme.mjs') -Force
    Copy-Item -LiteralPath $definition -Destination (Join-Path $target 'theme.json') -Force
    Copy-Item -LiteralPath (Join-Path $source 'themes\assets\great-sage-staff.jpg') -Destination (Join-Path $target 'preview.jpg') -Force
    Copy-Item -LiteralPath (Join-Path $source 'LICENSE') -Destination (Join-Path $target 'LICENSE') -Force

    $shortcutPath = $null
    $expectedShortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex - Wukong Theme.lnk'
    if ($NoShortcut) {
        if (Test-Path -LiteralPath $expectedShortcut) { Remove-Item -LiteralPath $expectedShortcut -Force }
    } else {
        $shortcutPath = $expectedShortcut
        $powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
        $launchScript = Join-Path $appTarget 'scripts\launch.ps1'
        $shell = New-Object -ComObject WScript.Shell
        $shortcut = $shell.CreateShortcut($shortcutPath)
        $shortcut.TargetPath = $powerShell
        $shortcut.Arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$launchScript`""
        $shortcut.WorkingDirectory = $appTarget
        $shortcut.Description = 'Launch Codex with the managed Wukong relic style layer'
        $shortcut.Save()
    }

    $statePath = Join-Path $target 'state.json'
    $state = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    $runtimeState = [pscustomobject]@{
        managedBy = 'WukongCodexForgeRuntime'
        version = '0.6.0'
        installedAt = (Get-Date).ToString('o')
        appPath = $appTarget
        profilePath = $profilePath
        shortcutPath = $shortcutPath
        state = 'installed'
        lastLaunchAt = $null
        port = $null
    }
    $state | Add-Member -MemberType NoteProperty -Name runtime -Value $runtimeState -Force
    [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json -Depth 12), [Text.UTF8Encoding]::new($false))
}
catch {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    if (-not $targetExisted -and (Test-Path -LiteralPath $target)) {
        $installedEngine = Join-Path $target 'native-theme.mjs'
        if ((Test-Path -LiteralPath $installedEngine) -and (Test-Path -LiteralPath (Join-Path $target 'state.json'))) {
            & $node $installedEngine restore --config $configPath --destination $target | Out-Null
        }
        Remove-Item -LiteralPath $target -Recurse -Force
    }
    throw
}

Write-Host "Installed the Meishan Night Edge Wukong baseline and managed style runtime at $target."
Write-Host 'No app.asar, WindowsApps package file, Codex executable, sidebar, footer, or in-app theme control was added.'
if (-not $NoShortcut) { Write-Host "Created launcher: $shortcutPath" }
if ($codexWasRunning) {
    Write-Warning 'The currently open Codex instance was not modified or restarted. Close it when ready, then launch Codex - Wukong Theme.'
} else {
    Write-Host 'Launch Codex - Wukong Theme from the Start menu to use the managed style.'
}
#>
