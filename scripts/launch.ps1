[CmdletBinding()]
param(
    [string]$Root = (Split-Path $PSScriptRoot -Parent),
    [switch]$Portable
)

$ErrorActionPreference = 'Stop'
$rootPath = [IO.Path]::GetFullPath($Root)
$packageDefinition = Join-Path $rootPath 'package.json'
if (-not (Test-Path -LiteralPath $packageDefinition)) {
    throw 'Theme package marker package.json is missing.'
}
$themePackage = Get-Content -LiteralPath $packageDefinition -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$themePackage.name -ne 'wukong-codex-theme') {
    throw 'Theme package marker is invalid.'
}

$managedTheme = [IO.Path]::GetFullPath((Join-Path $env:USERPROFILE '.codex\themes\wukong-codex-forge'))
if ($Portable) {
    $stateRoot = Join-Path $rootPath '.wukong-runtime'
    $profilePath = Join-Path $stateRoot 'profile'
    $profileMode = 'isolated-portable'
} else {
    $managedRoot = [IO.Path]::GetFullPath((Join-Path $managedTheme 'app'))
    $managedReleases = [IO.Path]::GetFullPath((Join-Path $managedTheme 'releases'))
    $releasePrefix = $managedReleases.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    $isLegacyRoot = [string]::Equals($rootPath, $managedRoot, [StringComparison]::OrdinalIgnoreCase)
    $isReleaseRoot = $rootPath.StartsWith($releasePrefix, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $rootPath -Leaf) -eq 'app'
    if (-not $isLegacyRoot -and -not $isReleaseRoot) {
        throw 'Managed launcher only runs from a retained Wukong release; use start-theme.cmd for portable mode.'
    }
    if ($isReleaseRoot -and -not (Test-Path -LiteralPath (Join-Path (Split-Path $rootPath -Parent) 'release.json'))) {
        throw 'Managed release marker is missing.'
    }
    $stateRoot = $managedTheme
    $profilePath = [IO.Path]::GetFullPath((Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Codex\web\Codex'))
    $profileMode = 'native-default'
}
foreach ($required in @('runtime\watch.mjs', 'runtime\injector.mjs', 'themes\active.json')) {
    if (-not (Test-Path -LiteralPath (Join-Path $rootPath $required))) {
        throw "Managed runtime file is missing: $required"
    }
}

foreach ($managedPath in @($rootPath, $stateRoot, $profilePath, (Join-Path $stateRoot 'requests'))) {
    if (Test-Path -LiteralPath $managedPath) {
        $item = Get-Item -LiteralPath $managedPath -Force
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Refusing launch: managed path is a reparse point: $managedPath"
        }
    }
}

# A named process mutex closes the double-click race without creating or deleting a lock file.
$hashAlgorithm = [Security.Cryptography.SHA256]::Create()
try {
    $stateHashBytes = $hashAlgorithm.ComputeHash([Text.Encoding]::UTF8.GetBytes($stateRoot.ToLowerInvariant()))
}
finally {
    $hashAlgorithm.Dispose()
}
$stateHash = ([BitConverter]::ToString($stateHashBytes)).Replace('-', '').Substring(0, 24)
$launchMutex = [Threading.Mutex]::new($false, "Local\WukongCodexForge-$stateHash")
$launchMutexAcquired = $launchMutex.WaitOne(0)
if (-not $launchMutexAcquired) {
    $launchMutex.Dispose()
    throw 'This Wukong theme package is already starting or watching a Codex window.'
}

$package = Get-AppxPackage -Name 'OpenAI.Codex' | Select-Object -First 1
if (-not $package) { throw 'Official OpenAI.Codex Store package was not found.' }
$chatGpt = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
if (-not (Test-Path -LiteralPath $chatGpt)) { throw 'ChatGPT.exe was not found inside the registered OpenAI.Codex package.' }
$node = Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
if (-not (Test-Path -LiteralPath $node)) { throw 'The Node runtime bundled with OpenAI.Codex was not found.' }

$activePortPath = Join-Path $profilePath 'DevToolsActivePort'
$injectorPath = Join-Path $rootPath 'runtime\injector.mjs'
$watcherPath = Join-Path $rootPath 'runtime\watch.mjs'
$themePath = Join-Path $rootPath 'themes\active.json'
if ($Portable) { New-Item -ItemType Directory -Force -Path $profilePath | Out-Null }
$profileRootProcesses = @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" -ErrorAction SilentlyContinue | Where-Object {
    if (-not $_.CommandLine -or $_.CommandLine -match '(?:^|\s)--type=') { return $false }
    if ($Portable) {
        return $_.CommandLine.IndexOf($profilePath, [StringComparison]::OrdinalIgnoreCase) -ge 0
    }
    return $_.CommandLine -notmatch '(?:^|\s)--user-data-dir(?:=|\s)'
})
if ($profileRootProcesses.Count -gt 1) { throw 'Multiple ChatGPT root processes own the selected profile; refusing an ambiguous attach.' }
$managedProcesses = @($profileRootProcesses | Where-Object {
    $_.CommandLine -match '(?:^|\s)--remote-debugging-address=127\.0\.0\.1(?:\s|$)' -and
    $_.CommandLine -match '(?:^|\s)--remote-debugging-port=0(?:\s|$)'
})
if ($profileRootProcesses.Count -eq 1 -and $managedProcesses.Count -eq 0) {
    throw 'ChatGPT is already running without the managed loopback theme channel. Leave it open now; after one full app exit, the installed ChatGPT shortcut will start this same native profile with the theme.'
}
$reuseManagedProcess = $managedProcesses.Count -eq 1

$sessionId = [Guid]::NewGuid().ToString('N')
$requestDirectory = Join-Path $stateRoot 'requests'
$disableRequest = Join-Path $requestDirectory ("disable-$sessionId.request")
$eventPath = Join-Path $stateRoot 'runtime-events.jsonl'
New-Item -ItemType Directory -Force -Path $requestDirectory | Out-Null

function Write-RuntimeEvent([string]$value, [Nullable[int]]$port) {
    $event = [ordered]@{
        at = (Get-Date).ToString('o')
        session = $sessionId
        state = $value
        port = $port
        appPath = $rootPath
        profilePath = $profilePath
        profileMode = $profileMode
        rootPid = if ($codexProcess) { $codexProcess.Id } else { $null }
        disableRequest = $disableRequest
    } | ConvertTo-Json -Compress
    [IO.File]::AppendAllText($eventPath, $event + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

function Wait-ForManagedMainWindow([int]$ManagedProcessId, [int]$Seconds) {
    $deadline = [DateTime]::UtcNow.AddSeconds($Seconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        $managedProcess = Get-Process -Id $ManagedProcessId -ErrorAction SilentlyContinue
        if ($managedProcess -and $managedProcess.MainWindowHandle -ne 0) { return $true }
        Start-Sleep -Milliseconds 250
    }
    return $false
}

$launchStartedAt = [DateTime]::UtcNow
if ($reuseManagedProcess) {
    Write-RuntimeEvent 'reattaching' $null
    $codexProcess = Get-Process -Id $managedProcesses[0].ProcessId -ErrorAction Stop
    if ($Portable) {
        $previousUserDataPath = $env:CODEX_ELECTRON_USER_DATA_PATH
        try {
            $env:CODEX_ELECTRON_USER_DATA_PATH = $profilePath
            Start-Process -FilePath $chatGpt -ArgumentList @(
                "--user-data-dir=`"$profilePath`"",
                'codex://launch'
            ) | Out-Null
        }
        finally {
            if ($null -eq $previousUserDataPath) { [Environment]::SetEnvironmentVariable('CODEX_ELECTRON_USER_DATA_PATH', $null, 'Process') }
            else { $env:CODEX_ELECTRON_USER_DATA_PATH = $previousUserDataPath }
        }
    } else {
        Start-Process -FilePath $chatGpt -ArgumentList 'codex://launch' | Out-Null
    }
}
else {
    Write-RuntimeEvent 'starting' $null
    if ($Portable) {
        $previousUserDataPath = $env:CODEX_ELECTRON_USER_DATA_PATH
        try {
            $env:CODEX_ELECTRON_USER_DATA_PATH = $profilePath
            $codexProcess = Start-Process -FilePath $chatGpt -ArgumentList @(
                '--remote-debugging-address=127.0.0.1',
                '--remote-debugging-port=0',
                "--user-data-dir=`"$profilePath`""
            ) -PassThru
        }
        finally {
            if ($null -eq $previousUserDataPath) { [Environment]::SetEnvironmentVariable('CODEX_ELECTRON_USER_DATA_PATH', $null, 'Process') }
            else { $env:CODEX_ELECTRON_USER_DATA_PATH = $previousUserDataPath }
        }
    } else {
        $codexProcess = Start-Process -FilePath $chatGpt -ArgumentList @(
            '--remote-debugging-address=127.0.0.1',
            '--remote-debugging-port=0'
        ) -PassThru
    }
}

$deadline = [DateTime]::UtcNow.AddSeconds(45)
while ($true) {
    $portReady = (Test-Path -LiteralPath $activePortPath) -and (
        $reuseManagedProcess -or
        (Get-Item -LiteralPath $activePortPath).LastWriteTimeUtc -ge $launchStartedAt.AddSeconds(-1)
    )
    if ($portReady) { break }
    if ($codexProcess.HasExited) { throw 'Codex exited before its local theme channel became ready.' }
    if ([DateTime]::UtcNow -ge $deadline) { throw 'Timed out waiting for the local Codex theme channel.' }
    Start-Sleep -Milliseconds 250
}
$portLine = [IO.File]::ReadAllLines($activePortPath, [Text.Encoding]::UTF8)[0]
$port = 0
if (-not [int]::TryParse($portLine, [ref]$port) -or $port -lt 1024 -or $port -gt 65535) {
    throw 'Codex returned an invalid loopback theme channel port.'
}

Push-Location $rootPath
try {
    # Electron can publish DevToolsActivePort a fraction of a second before the
    # loopback endpoint accepts its first connection. Retry that startup edge
    # instead of turning a healthy new window into a false not-running result.
    $verifyDeadline = [DateTime]::UtcNow.AddSeconds(20)
    $lastVerifyOutput = @()
    while ($true) {
        $priorErrorActionPreference = $ErrorActionPreference
        try {
            # Windows PowerShell 5.1 wraps native stderr as ErrorRecord objects.
            # During the expected readiness window, capture those records and
            # decide from the native exit code instead of terminating the script.
            $ErrorActionPreference = 'Continue'
            $lastVerifyOutput = @(& $node $injectorPath --verify $port 2>&1)
            $verifyExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $priorErrorActionPreference
        }
        if ($verifyExitCode -eq 0) { break }
        if ($codexProcess.HasExited) { throw 'Codex exited before its local theme channel accepted a connection.' }
        if ([DateTime]::UtcNow -ge $verifyDeadline) {
            throw "Timed out verifying the Codex loopback theme channel: $($lastVerifyOutput -join ' ')"
        }
        Start-Sleep -Milliseconds 250
    }

    # The browser port can become reachable before the Codex page target exists.
    # Do not report a watching session until one renderer has accepted and verified
    # the full theme payload.
    $applyDeadline = [DateTime]::UtcNow.AddSeconds(20)
    $lastApplyOutput = @()
    while ($true) {
        $priorErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $lastApplyOutput = @(& $node $injectorPath --apply $port $themePath 2>&1)
            $applyExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $priorErrorActionPreference
        }
        if ($applyExitCode -eq 0) { break }
        if ($codexProcess.HasExited) { throw 'Codex exited before the theme reached a verified renderer state.' }
        if ([DateTime]::UtcNow -ge $applyDeadline) {
            throw "Timed out waiting for a verified Codex theme surface: $($lastApplyOutput -join ' ')"
        }
        Start-Sleep -Milliseconds 350
    }

    # Chromium can report a visible document while the native Electron window
    # is hidden in the tray. Accept only the main window of this managed root PID.
    if (-not (Wait-ForManagedMainWindow -ManagedProcessId $codexProcess.Id -Seconds 9)) {
        throw 'Timed out waiting for the managed Codex window to become visible.'
    }
    Write-RuntimeEvent 'watching' $port
    # Absolute runtime paths make the active package identity visible in the
    # watcher command line, so the retained ChatGPT shortcut can distinguish
    # this exact session without touching Electron or official package files.
    & $node $watcherPath $port $themePath $disableRequest $codexProcess.Id
    if ($LASTEXITCODE -ne 0) { throw "Theme watcher exited with code $LASTEXITCODE." }
}
finally {
    if (Test-Path -LiteralPath $disableRequest) {
        if ($codexProcess.HasExited) {
            Write-RuntimeEvent 'disabled-on-exit' $null
        } else {
            $disableConfirmation = "$disableRequest.confirmed.json"
            $deferredNative = $false
            if (Test-Path -LiteralPath $disableConfirmation) {
                try {
                    $confirmationRecord = Get-Content -LiteralPath $disableConfirmation -Raw -Encoding UTF8 | ConvertFrom-Json
                    $deferredNative = [bool]$confirmationRecord.deferredNative -and [int]$confirmationRecord.targets -eq 0
                } catch { }
            }
            if (-not $deferredNative) {
                & $node $injectorPath --assert-native $port
                if ($LASTEXITCODE -ne 0) {
                    Write-RuntimeEvent 'disable-failed' $port
                    throw 'Theme watcher stopped after a disable request, but native DOM state was not verified.'
                }
            }
            Write-RuntimeEvent 'disabled-confirmed' $port
        }
    } else {
        if (-not $codexProcess.HasExited) {
            try { & $node $injectorPath --restore $port | Out-Null }
            catch { }
        }
        Write-RuntimeEvent 'not-running' $null
    }
    Pop-Location
}

[GC]::KeepAlive($launchMutex)
$launchMutex.ReleaseMutex()
$launchMutex.Dispose()
