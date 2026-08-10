[CmdletBinding()]
param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'

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
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '')
    }
    finally {
        $algorithm.Dispose()
    }
}

function Assert-DirectPath([string]$Path, [string]$Label) {
    $resolved = [IO.Path]::GetFullPath($Path)
    $parsedRoot = [IO.Path]::GetPathRoot($resolved)
    $cursor = $parsedRoot
    foreach ($segment in $resolved.Substring($parsedRoot.Length).Split(@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar), [StringSplitOptions]::RemoveEmptyEntries)) {
        $cursor = Join-Path $cursor $segment
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Native supervisor install refused a reparse point for ${Label}: $cursor"
        }
    }
}

function Quote-NativeArgument([string]$Value) {
    $builder = New-Object Text.StringBuilder
    [void]$builder.Append([char]34)
    $backslashes = 0
    foreach ($character in $Value.ToCharArray()) {
        if ($character -eq [char]92) {
            $backslashes += 1
            continue
        }
        if ($character -eq [char]34) {
            for ($slashIndex = 0; $slashIndex -lt ($backslashes * 2 + 1); $slashIndex += 1) {
                [void]$builder.Append([char]92)
            }
            [void]$builder.Append([char]34)
            $backslashes = 0
            continue
        }
        if ($backslashes -gt 0) {
            for ($slashIndex = 0; $slashIndex -lt $backslashes; $slashIndex += 1) {
                [void]$builder.Append([char]92)
            }
            $backslashes = 0
        }
        [void]$builder.Append($character)
    }
    if ($backslashes -gt 0) {
        for ($slashIndex = 0; $slashIndex -lt ($backslashes * 2); $slashIndex += 1) {
            [void]$builder.Append([char]92)
        }
    }
    [void]$builder.Append([char]34)
    return $builder.ToString()
}

$rootPath = [IO.Path]::GetFullPath($Root)
$markerPath = Join-Path $rootPath 'package.json'
$sourcePath = Join-Path $rootPath 'runtime\native-entry-supervisor.cs'
$activatorSourcePath = Join-Path $rootPath 'runtime\activate-appx.cs'
foreach ($requiredPath in @($rootPath, $markerPath, $sourcePath, $activatorSourcePath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Native supervisor install is missing a required path: $requiredPath"
    }
    Assert-DirectPath -Path $requiredPath -Label 'repository input'
}

$marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$marker.name -ne 'wukong-codex-forge') {
    throw 'Native supervisor install refused an invalid repository marker.'
}

$package = Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1
if (-not $package) {
    throw 'The official OpenAI.Codex Store package was not found.'
}
$chatGptPath = [IO.Path]::GetFullPath((Join-Path $package.InstallLocation 'app\ChatGPT.exe'))
$nodePath = [IO.Path]::GetFullPath((Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'))
foreach ($officialPath in @($chatGptPath, $nodePath)) {
    if (-not (Test-Path -LiteralPath $officialPath)) {
        throw "The official Codex runtime path is missing: $officialPath"
    }
    Assert-DirectPath -Path $officialPath -Label 'official Codex runtime'
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
    throw 'The official AppX application identity is unavailable.'
}
$appUserModelId = ([string]$package.PackageFamilyName) + '!' + [string]$manifestApplication.GetAttribute('Id')
$packageFullName = [string]$package.PackageFullName
$packageVersion = ([version]$package.Version).ToString()

$shortcutPath = Join-Path ([Environment]::GetFolderPath('Programs')) 'ChatGPT.lnk'
if (-not (Test-Path -LiteralPath $shortcutPath)) {
    throw 'The managed native ChatGPT shortcut is missing. Install the repository launch bridge first.'
}
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
if (-not [string]::Equals(
    [IO.Path]::GetFullPath([string]$shortcut.TargetPath),
    $nodePath,
    [StringComparison]::OrdinalIgnoreCase
)) {
    throw 'The native ChatGPT shortcut does not target the current official embedded Node runtime.'
}
$bridgeMatch = [regex]::Match([string]$shortcut.Arguments, '^"([^\"]+\.mjs)"$')
if (-not $bridgeMatch.Success) {
    throw 'The native ChatGPT shortcut does not contain one verified Node bridge argument.'
}
$bridgePath = [IO.Path]::GetFullPath($bridgeMatch.Groups[1].Value)
if (-not (Test-Path -LiteralPath $bridgePath)) {
    throw "The verified launch bridge is missing: $bridgePath"
}
Assert-DirectPath -Path $bridgePath -Label 'verified Node bridge'
$expectedBridgeRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'WukongCodexForge\launcher-bridges')) + [IO.Path]::DirectorySeparatorChar
if (-not $bridgePath.StartsWith($expectedBridgeRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The Node bridge is outside the managed LocalAppData bridge directory.'
}
$bridgeText = [IO.File]::ReadAllText($bridgePath, [Text.Encoding]::UTF8)
$bridgeRootMatch = [regex]::Match($bridgeText, '(?m)^const themeRoot = ("(?:\\.|[^"])*");\s*$')
if (-not $bridgeRootMatch.Success) {
    throw 'The Node bridge does not declare its repository root.'
}
$bridgeRoot = [IO.Path]::GetFullPath(($bridgeRootMatch.Groups[1].Value | ConvertFrom-Json))
if (-not [string]::Equals($bridgeRoot, $rootPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'The Node bridge belongs to a different repository checkout.'
}
if ($bridgeText -notmatch '(?m)^const repository = true;\s*$' -or $bridgeText -notmatch "runtime', 'host\.mjs") {
    throw 'The Node bridge is not a repository-backed event-host bridge.'
}
if ($bridgeText -match 'powershell(?:\.exe)?|launch\.ps1') {
    throw 'The Node bridge unexpectedly delegates to a PowerShell launcher.'
}

$profilePath = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Codex\web\Codex'))
if (-not (Test-Path -LiteralPath $profilePath)) {
    New-Item -ItemType Directory -Force -Path $profilePath | Out-Null
}
Assert-DirectPath -Path $profilePath -Label 'native Codex profile'

$installRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'WukongCodexForge\native-supervisor'))
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
Assert-DirectPath -Path $installRoot -Label 'native supervisor install root'
$repositoryId = (Get-TextSha256 $rootPath.ToLowerInvariant()).Substring(0, 16).ToLowerInvariant()
$exePath = Join-Path $installRoot "native-entry-supervisor-$repositoryId.exe"
$temporaryExePath = Join-Path $installRoot "native-entry-supervisor-$repositoryId.new.exe"
$activatorExePath = Join-Path $installRoot "appx-activator-$repositoryId.exe"
$temporaryActivatorExePath = Join-Path $installRoot "appx-activator-$repositoryId.new.exe"
$statePath = Join-Path $installRoot 'install-state.json'
$runValueName = 'WukongCodexForgeNativeEntrySupervisor'
$runKeyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$stopEventName = 'Local\WukongCodexForge.NativeEntrySupervisor.Stop'
$readyEventName = 'Local\WukongCodexForge.NativeEntrySupervisor.Ready'
$instanceMutexName = 'Local\WukongCodexForge.NativeEntrySupervisor.Instance'
$argumentValues = @(
    '--repo', $rootPath,
    '--chatgpt', $chatGptPath,
    '--node', $nodePath,
    '--bridge', $bridgePath,
    '--profile', $profilePath,
    '--run-value', $runValueName
)
$quotedArguments = for ($index = 0; $index -lt $argumentValues.Count; $index += 2) {
    $argumentValues[$index]
    Quote-NativeArgument $argumentValues[$index + 1]
}
$argumentString = $quotedArguments -join ' '
$runCommand = (Quote-NativeArgument $exePath) + ' ' + $argumentString
$sourceHash = Get-PortableSha256 $sourcePath
$activatorSourceHash = Get-PortableSha256 $activatorSourcePath
$bridgeHash = Get-PortableSha256 $bridgePath

# start.ps1 may invoke this installer on every launch. Reuse only when both
# immutable configuration and live native ownership evidence match exactly.
$reused = $false
$existingState = $null
if ((Test-Path -LiteralPath $statePath) -and (Test-Path -LiteralPath $exePath) -and (Test-Path -LiteralPath $activatorExePath)) {
    try {
        Assert-DirectPath -Path $statePath -Label 'native supervisor install state'
        Assert-DirectPath -Path $exePath -Label 'compiled native supervisor'
        Assert-DirectPath -Path $activatorExePath -Label 'compiled native AppX activator'
        $existingState = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
        $currentRunCommand = [string](Get-ItemProperty -Path $runKeyPath -Name $runValueName -ErrorAction Stop).$runValueName
        $staticStateMatches = (
            [int]$existingState.schema -eq 2 -and
            [string]::Equals([string]$existingState.sourceHash, $sourceHash, [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.activatorSourceHash, $activatorSourceHash, [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.repositoryRoot, $rootPath, [StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$existingState.bridgePath, $bridgePath, [StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$existingState.bridgeHash, $bridgeHash, [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.embeddedNodePath, $nodePath, [StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$existingState.expectedChatGptPath, $chatGptPath, [StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$existingState.profilePath, $profilePath, [StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$existingState.executablePath, $exePath, [StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$existingState.executableHash, (Get-PortableSha256 $exePath), [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.activatorExecutablePath, $activatorExePath, [StringComparison]::OrdinalIgnoreCase) -and
            [string]::Equals([string]$existingState.activatorExecutableHash, (Get-PortableSha256 $activatorExePath), [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.appUserModelId, $appUserModelId, [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.packageFullName, $packageFullName, [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.packageVersion, $packageVersion, [StringComparison]::Ordinal) -and
            [string]::Equals([string]$existingState.runCommand, $runCommand, [StringComparison]::Ordinal) -and
            [string]::Equals($currentRunCommand, $runCommand, [StringComparison]::Ordinal)
        )
        if ($staticStateMatches -and [int]$existingState.supervisorPid -gt 0) {
            $existingProcess = Get-Process -Id ([int]$existingState.supervisorPid) -ErrorAction Stop
            try {
                $processMatches = (
                    -not $existingProcess.HasExited -and
                    [string]::Equals([IO.Path]::GetFullPath([string]$existingProcess.Path), $exePath, [StringComparison]::OrdinalIgnoreCase) -and
                    $existingProcess.StartTime.ToUniversalTime().Ticks -eq [long]$existingState.processStartTimeUtcTicks
                )
            }
            finally {
                $existingProcess.Dispose()
            }

            $readySet = $false
            try {
                $existingReadyEvent = [Threading.EventWaitHandle]::OpenExisting($readyEventName)
                try { $readySet = $existingReadyEvent.WaitOne(0) }
                finally { $existingReadyEvent.Dispose() }
            }
            catch [Threading.WaitHandleCannotBeOpenedException] {
            }

            $mutexHeldBySupervisor = $false
            try {
                $existingInstanceMutex = [Threading.Mutex]::OpenExisting($instanceMutexName)
                try {
                    $installerAcquiredMutex = $false
                    try { $installerAcquiredMutex = $existingInstanceMutex.WaitOne(0) }
                    catch [Threading.AbandonedMutexException] { $installerAcquiredMutex = $true }
                    if ($installerAcquiredMutex) {
                        $existingInstanceMutex.ReleaseMutex()
                    }
                    else {
                        $mutexHeldBySupervisor = $true
                    }
                }
                finally { $existingInstanceMutex.Dispose() }
            }
            catch [Threading.WaitHandleCannotBeOpenedException] {
            }
            $reused = $processMatches -and $readySet -and $mutexHeldBySupervisor
        }
    }
    catch {
        $reused = $false
    }
}

if ($reused) {
    $reuseResult = [ordered]@{
        installed = $true
        started = $true
        reused = $true
        supervisorPid = [int]$existingState.supervisorPid
        processStartTimeUtcTicks = [long]$existingState.processStartTimeUtcTicks
        executablePath = $exePath
        executableHash = [string]$existingState.executableHash
        activatorExecutablePath = $activatorExePath
        activatorExecutableHash = [string]$existingState.activatorExecutableHash
        appUserModelId = $appUserModelId
        packageFullName = $packageFullName
        packageVersion = $packageVersion
        statePath = $statePath
        repositoryRoot = $rootPath
        expectedChatGptPath = $chatGptPath
        embeddedNodePath = $nodePath
        bridgePath = $bridgePath
        profilePath = $profilePath
        runValueName = $runValueName
        eventSource = 'SetWinEventHook(EVENT_OBJECT_SHOW)'
        steadyPolling = $false
        wmi = $false
        restartLimit = 3
        restartWindowMinutes = 10
        currentChatGptUntouched = $true
        activationRuntime = 'native-dotnet-framework'
        powerShellOnLaunch = $false
    }
    $reuseResult | ConvertTo-Json -Compress
    return
}

$cscCandidates = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
)
$cscPath = $cscCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $cscPath) {
    throw 'The built-in .NET Framework C# compiler was not found.'
}

if (Test-Path -LiteralPath $temporaryExePath) {
    Remove-Item -LiteralPath $temporaryExePath -Force
}
$compilerArguments = @(
    '/nologo',
    '/target:winexe',
    '/platform:anycpu',
    '/optimize+',
    '/checked+',
    "/out:$temporaryExePath",
    '/reference:System.dll',
    '/reference:System.Core.dll',
    '/reference:System.Web.Extensions.dll',
    $sourcePath
)
& $cscPath @compilerArguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporaryExePath)) {
    throw 'The native entry supervisor did not compile successfully.'
}
if (Test-Path -LiteralPath $temporaryActivatorExePath) {
    Remove-Item -LiteralPath $temporaryActivatorExePath -Force
}
$activatorCompilerArguments = @(
    '/nologo',
    '/target:exe',
    '/platform:anycpu',
    '/optimize+',
    '/checked+',
    "/out:$temporaryActivatorExePath",
    '/reference:System.dll',
    '/reference:System.Core.dll',
    $activatorSourcePath
)
& $cscPath @activatorCompilerArguments
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $temporaryActivatorExePath)) {
    if (Test-Path -LiteralPath $temporaryExePath) {
        Remove-Item -LiteralPath $temporaryExePath -Force
    }
    throw 'The native AppX activator did not compile successfully.'
}

try {
    $existingStopEvent = [Threading.EventWaitHandle]::OpenExisting($stopEventName)
    try { $existingStopEvent.Set() | Out-Null }
    finally { $existingStopEvent.Dispose() }
}
catch [Threading.WaitHandleCannotBeOpenedException] {
}

try {
    $existingMutex = [Threading.Mutex]::OpenExisting($instanceMutexName)
    try {
        $mutexOwned = $false
        try {
            $mutexOwned = $existingMutex.WaitOne(7000)
        }
        catch [Threading.AbandonedMutexException] {
            $mutexOwned = $true
        }
        if (-not $mutexOwned) {
            throw 'The previous native entry supervisor did not stop within seven seconds.'
        }
        $existingMutex.ReleaseMutex()
    }
    finally {
        $existingMutex.Dispose()
    }
}
catch [Threading.WaitHandleCannotBeOpenedException] {
}

Move-Item -LiteralPath $temporaryExePath -Destination $exePath -Force
Assert-DirectPath -Path $exePath -Label 'compiled native supervisor'
Move-Item -LiteralPath $temporaryActivatorExePath -Destination $activatorExePath -Force
Assert-DirectPath -Path $activatorExePath -Label 'compiled native AppX activator'

New-Item -Path $runKeyPath -Force | Out-Null
New-ItemProperty -Path $runKeyPath -Name $runValueName -Value $runCommand -PropertyType String -Force | Out-Null

$readyEvent = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::ManualReset, $readyEventName)
try {
    $readyEvent.Reset() | Out-Null
    $started = Start-Process -FilePath $exePath -ArgumentList $argumentString -WorkingDirectory $rootPath -WindowStyle Hidden -PassThru
    $ready = $readyEvent.WaitOne(7000)
    $started.Refresh()
    if (-not $ready -or $started.HasExited) {
        Remove-ItemProperty -Path $runKeyPath -Name $runValueName -ErrorAction SilentlyContinue
        if (-not $started.HasExited) {
            $started.Kill()
        }
        throw 'The native entry supervisor did not publish ready and remain alive within seven seconds.'
    }
}
finally {
    $readyEvent.Dispose()
}
$started.Refresh()
$installedState = [ordered]@{
    schema = 2
    installedAt = [DateTime]::UtcNow.ToString('o')
    sourceHash = $sourceHash
    activatorSourceHash = $activatorSourceHash
    repositoryRoot = $rootPath
    bridgePath = $bridgePath
    bridgeHash = $bridgeHash
    embeddedNodePath = $nodePath
    expectedChatGptPath = $chatGptPath
    profilePath = $profilePath
    executablePath = $exePath
    executableHash = Get-PortableSha256 $exePath
    activatorExecutablePath = $activatorExePath
    activatorExecutableHash = Get-PortableSha256 $activatorExePath
    appUserModelId = $appUserModelId
    packageFullName = $packageFullName
    packageVersion = $packageVersion
    runCommand = $runCommand
    supervisorPid = $started.Id
    processStartTimeUtcTicks = $started.StartTime.ToUniversalTime().Ticks
}
$stateJson = $installedState | ConvertTo-Json -Compress
[IO.File]::WriteAllText($statePath, $stateJson + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
Assert-DirectPath -Path $statePath -Label 'native supervisor install state'
$result = [ordered]@{
    installed = $true
    started = $true
    reused = $false
    supervisorPid = $started.Id
    processStartTimeUtcTicks = $started.StartTime.ToUniversalTime().Ticks
    executablePath = $exePath
    executableHash = Get-PortableSha256 $exePath
    activatorExecutablePath = $activatorExePath
    activatorExecutableHash = Get-PortableSha256 $activatorExePath
    activatorSourcePath = $activatorSourcePath
    activatorSourceHash = $activatorSourceHash
    appUserModelId = $appUserModelId
    packageFullName = $packageFullName
    packageVersion = $packageVersion
    statePath = $statePath
    sourcePath = $sourcePath
    repositoryRoot = $rootPath
    expectedChatGptPath = $chatGptPath
    embeddedNodePath = $nodePath
    bridgePath = $bridgePath
    profilePath = $profilePath
    runValueName = $runValueName
    eventSource = 'SetWinEventHook(EVENT_OBJECT_SHOW)'
    steadyPolling = $false
    wmi = $false
    restartLimit = 3
    restartWindowMinutes = 10
    currentChatGptUntouched = $true
    activationRuntime = 'native-dotnet-framework'
    powerShellOnLaunch = $false
}
$result | ConvertTo-Json -Compress
