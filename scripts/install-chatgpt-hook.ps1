[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Root,
    [switch]$Portable,
    [switch]$Repository
)

$ErrorActionPreference = 'Stop'
if ($Portable -and $Repository) {
    throw 'Repository and portable launch modes are mutually exclusive.'
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
        $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
        return ([BitConverter]::ToString($algorithm.ComputeHash($bytes))).Replace('-', '')
    }
    finally {
        $algorithm.Dispose()
    }
}

function Assert-DirectManagedPath([string]$Path, [string]$Label) {
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Refusing ChatGPT launch adapter install: ${Label} is a reparse point: $Path"
    }
}

$rootPath = [IO.Path]::GetFullPath($Root)
$packageDefinition = Join-Path $rootPath 'package.json'
$hostPath = Join-Path $rootPath 'runtime\host.mjs'
$legacyActivatorPath = Join-Path $rootPath 'runtime\activate-appx.ps1'
$activatorSourcePath = Join-Path $rootPath 'runtime\activate-appx.cs'
if (
    -not (Test-Path -LiteralPath $packageDefinition) -or
    -not (Test-Path -LiteralPath $hostPath) -or
    -not (Test-Path -LiteralPath $legacyActivatorPath) -or
    -not (Test-Path -LiteralPath $activatorSourcePath)
) {
    throw 'Wukong theme package is incomplete; the ChatGPT launch adapter was not installed.'
}
$themePackage = Get-Content -LiteralPath $packageDefinition -Raw -Encoding UTF8 | ConvertFrom-Json
if ([string]$themePackage.name -ne 'wukong-codex-theme') {
    throw 'Wukong theme package marker is invalid.'
}

$package = Get-AppxPackage -Name 'OpenAI.Codex' | Sort-Object Version -Descending | Select-Object -First 1
if (-not $package) { throw 'Official OpenAI.Codex Store package was not found.' }
$chatGpt = Join-Path $package.InstallLocation 'app\ChatGPT.exe'
$node = Join-Path $package.InstallLocation 'app\resources\cua_node\bin\node.exe'
if (-not (Test-Path -LiteralPath $chatGpt)) { throw 'Official ChatGPT.exe was not found.' }
if (-not (Test-Path -LiteralPath $node)) { throw 'The Node runtime bundled with OpenAI.Codex was not found.' }
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
    throw 'Official AppX application identity is unavailable.'
}
$appUserModelId = ([string]$package.PackageFamilyName) + '!' + [string]$manifestApplication.GetAttribute('Id')

$programs = [Environment]::GetFolderPath('Programs')
$desktop = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $programs 'ChatGPT.lnk'
$themeShortcutPath = Join-Path $programs 'ChatGPT - Wukong Theme.lnk'
$wukongShortcutPath = Join-Path $programs 'Wukong Codex.lnk'
$desktopShortcutPath = Join-Path $desktop 'Wukong Codex.lnk'
$adapterRoot = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'WukongCodexForge'))
$nativeToolRoot = Join-Path $adapterRoot 'native-supervisor'
$repositoryId = (Get-TextSha256 $rootPath.ToLowerInvariant()).Substring(0, 16).ToLowerInvariant()
$nativeActivatorPath = Join-Path $nativeToolRoot "appx-activator-$repositoryId.exe"
$historyRoot = Join-Path $adapterRoot 'shortcut-backups'
$bridgeRoot = Join-Path $adapterRoot 'launcher-bridges'
$eventPath = Join-Path $adapterRoot 'shortcut-hook-events.jsonl'
Assert-DirectManagedPath -Path $programs -Label 'Start Menu Programs directory'
Assert-DirectManagedPath -Path $shortcutPath -Label 'ChatGPT Start Menu shortcut'
Assert-DirectManagedPath -Path $desktop -Label 'Desktop directory'
Assert-DirectManagedPath -Path $adapterRoot -Label 'launch adapter root'
Assert-DirectManagedPath -Path $historyRoot -Label 'shortcut backup directory'
Assert-DirectManagedPath -Path $bridgeRoot -Label 'launcher bridge directory'
New-Item -ItemType Directory -Force -Path $historyRoot | Out-Null
New-Item -ItemType Directory -Force -Path $bridgeRoot | Out-Null
Assert-DirectManagedPath -Path $adapterRoot -Label 'launch adapter root'
Assert-DirectManagedPath -Path $historyRoot -Label 'shortcut backup directory'
Assert-DirectManagedPath -Path $bridgeRoot -Label 'launcher bridge directory'

$rootLiteral = $rootPath | ConvertTo-Json -Compress
$nativeActivatorLiteral = $nativeActivatorPath | ConvertTo-Json -Compress
$appUserModelIdLiteral = $appUserModelId | ConvertTo-Json -Compress
$packageFullNameLiteral = ([string]$package.PackageFullName) | ConvertTo-Json -Compress
$packageVersionLiteral = (([version]$package.Version).ToString()) | ConvertTo-Json -Compress
$chatGptLiteral = ([IO.Path]::GetFullPath($chatGpt)) | ConvertTo-Json -Compress
$portableLiteral = if ($Portable) { 'true' } else { 'false' }
$repositoryLiteral = if ($Repository) { 'true' } else { 'false' }
$bridgeScript = @"
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const themeRoot = $rootLiteral;
const portable = $portableLiteral;
const repository = $repositoryLiteral;
const marker = path.join(themeRoot, 'package.json');
const host = path.join(themeRoot, 'runtime', 'host.mjs');
const activator = $nativeActivatorLiteral;
const activationAumid = $appUserModelIdLiteral;
const activationPackage = $packageFullNameLiteral;
const activationVersion = $packageVersionLiteral;
const activationExecutable = $chatGptLiteral;
const theme = path.join(themeRoot, 'themes', 'active.json');
const style = path.join(themeRoot, 'runtime', 'forge-background-v13.css');
const appRoot = path.resolve(path.dirname(process.execPath), '..', '..', '..');
const official = path.join(appRoot, 'ChatGPT.exe');
const themeAvailable = [marker, host, theme, style, ...(portable ? [] : [activator])]
  .every(candidate => fs.existsSync(candidate));
const profile = path.join(process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming'), 'Codex', 'web', 'Codex');

const officialProcessIsRunning = () => {
  const tasklist = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tasklist.exe');
  const result = spawnSync(tasklist, ['/FI', 'IMAGENAME eq ChatGPT.exe', '/FO', 'CSV', '/NH'], {
    encoding: 'utf8',
    timeout: 3_000,
    windowsHide: true
  });
  return result.status === 0 && /"ChatGPT\.exe"/i.test(result.stdout || '');
};

const hasReusableCodexChannel = async () => {
  try {
    const port = Number(fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split(/\r?\n/, 1)[0]);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) return false;
    const response = await fetch('http://127.0.0.1:' + port + '/json/list', { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) return false;
    const targets = await response.json();
    return Array.isArray(targets) && targets.some(target => {
      let avatarOverlay = false;
      try {
        avatarOverlay = new URL(target?.url || '').searchParams.get('initialRoute') === '/avatar-overlay';
      } catch {}
      return target?.type === 'page' && !avatarOverlay && (
        /^app:\/\/codex\//.test(target.url || '') ||
        (target.title === 'Codex' && /^app:\/\/-\/index\.html(?:[?#]|$)/.test(target.url || ''))
      );
    });
  } catch {
    return false;
  }
};

const showBlockedLaunch = () => {
  const noticeRoot = path.join(process.env.LOCALAPPDATA, 'WukongCodexForge', 'launch-notices');
  fs.mkdirSync(noticeRoot, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
  const noticePath = path.join(noticeRoot, 'blocked-' + stamp + '.txt');
  fs.writeFileSync(noticePath, [
    'The ChatGPT theme did not start because ChatGPT is already running from an unmanaged native entry.',
    '',
    'Exit ChatGPT completely, including its tray/background instance, then run start-theme.cmd once to repair and launch ChatGPT.',
    'No process was terminated. No WMI/CIM query was used. The repository theme was not partially applied.'
  ].join('\r\n') + '\r\n', 'utf8');
  const notepad = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'notepad.exe');
  const child = spawn(notepad, [noticePath], { detached: true, stdio: 'ignore', windowsHide: false });
  child.unref();
};

if (themeAvailable && officialProcessIsRunning() && !(await hasReusableCodexChannel())) {
  showBlockedLaunch();
  process.exit(4);
}

const target = themeAvailable ? process.execPath : official;
const args = themeAvailable
  ? [
      host,
      '--root',
      themeRoot,
      ...(repository ? ['--repository'] : portable ? ['--portable'] : []),
      '--appx-activator', activator,
      '--appx-aumid', activationAumid,
      '--appx-package', activationPackage,
      '--appx-version', activationVersion,
      '--appx-executable', activationExecutable
    ]
  : [];

if (!fs.existsSync(target)) process.exit(3);
const child = spawn(target, args, {
  detached: true,
  stdio: 'ignore',
  windowsHide: themeAvailable
});
child.unref();
"@
$bridgeBytes = [Text.Encoding]::UTF8.GetBytes($bridgeScript)
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
    $bridgeId = ([BitConverter]::ToString($sha256.ComputeHash($bridgeBytes))).Replace('-', '').Substring(0, 20).ToLowerInvariant()
}
finally {
    $sha256.Dispose()
}
$bridgePath = Join-Path $bridgeRoot "chatgpt-entry-$bridgeId.mjs"
if (Test-Path -LiteralPath $bridgePath) {
    $existingBridge = [IO.File]::ReadAllText($bridgePath, [Text.Encoding]::UTF8)
    if (-not [string]::Equals($existingBridge, $bridgeScript, [StringComparison]::Ordinal)) {
        do {
            $collisionStamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fffffff')
            $bridgePath = Join-Path $bridgeRoot "chatgpt-entry-$bridgeId-$collisionStamp.mjs"
        } while (Test-Path -LiteralPath $bridgePath)
    }
}
if (-not (Test-Path -LiteralPath $bridgePath)) {
    [IO.File]::WriteAllText($bridgePath, $bridgeScript, [Text.UTF8Encoding]::new($false))
}
& $node --check $bridgePath
if ($LASTEXITCODE -ne 0) {
    throw 'Generated ChatGPT Node launch bridge is invalid.'
}

$expectedTarget = $node
$expectedArguments = "`"$bridgePath`""
if ($expectedArguments.Length -ge 900) {
    throw 'ChatGPT launch adapter arguments exceed the safe Windows shortcut limit.'
}

$shell = New-Object -ComObject WScript.Shell
function Test-ShortcutCurrent([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $current = $shell.CreateShortcut($Path)
    return (
        [string]::Equals([IO.Path]::GetFullPath($current.TargetPath), [IO.Path]::GetFullPath($expectedTarget), [StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals($current.Arguments, $expectedArguments, [StringComparison]::Ordinal)
    )
}

function Install-PreservedShortcut([string]$Path, [string]$BackupPrefix, [string]$Description) {
    $alreadyCurrent = Test-ShortcutCurrent -Path $Path
    $backupPath = $null
    if (-not $alreadyCurrent) {
        if (Test-Path -LiteralPath $Path) {
            $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fffffff')
            $backupPath = Join-Path $historyRoot "$BackupPrefix-$stamp.lnk"
            Copy-Item -LiteralPath $Path -Destination $backupPath
        }
        $shortcut = $shell.CreateShortcut($Path)
        $shortcut.TargetPath = $expectedTarget
        $shortcut.Arguments = $expectedArguments
        $shortcut.WorkingDirectory = $env:USERPROFILE
        $shortcut.IconLocation = "$chatGpt,0"
        $shortcut.Description = $Description
        $shortcut.WindowStyle = 7
        $shortcut.Save()
    }
    return [pscustomobject]@{
        changed = -not $alreadyCurrent
        backup = $backupPath
    }
}

function Remove-LegacyManagedShortcut([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    Assert-DirectManagedPath -Path $Path -Label 'legacy Wukong shortcut'
    $legacy = $shell.CreateShortcut($Path)
    $legacyBridgeMatch = [regex]::Match([string]$legacy.Arguments, '^"([^"]+\\launcher-bridges\\chatgpt-entry-[^"]+\.mjs)"$')
    $legacyTargetPath = [string]$legacy.TargetPath
    if (
        [string]::IsNullOrWhiteSpace($legacyTargetPath) -or
        -not $legacyTargetPath.EndsWith('\app\resources\cua_node\bin\node.exe', [StringComparison]::OrdinalIgnoreCase) -or
        -not $legacyBridgeMatch.Success
    ) {
        return $false
    }
    $legacyBridgePath = [IO.Path]::GetFullPath($legacyBridgeMatch.Groups[1].Value)
    if (-not $legacyBridgePath.StartsWith($bridgeRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        return $false
    }
    $retiredLeaf = [IO.Path]::GetFileNameWithoutExtension($Path) -replace '[^A-Za-z0-9-]', '-'
    $retiredStamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fffffff')
    $retiredBackup = Join-Path $historyRoot "retired-$retiredLeaf-$retiredStamp.lnk"
    Copy-Item -LiteralPath $Path -Destination $retiredBackup
    [IO.File]::Delete($Path)
    return $true
}

$defaultShortcut = Install-PreservedShortcut `
    -Path $shortcutPath `
    -BackupPrefix 'ChatGPT-before-wukong' `
    -Description 'ChatGPT (official executable with repository-backed Wukong renderer theme)'
$removedLegacyShortcuts = @(
    $themeShortcutPath,
    $wukongShortcutPath,
    $desktopShortcutPath
) | Where-Object { Remove-LegacyManagedShortcut -Path $_ }

$event = [ordered]@{
    at = (Get-Date).ToString('o')
    managedBy = 'WukongCodexForgeLaunchAdapter'
    shortcutPath = $shortcutPath
    entryPolicy = 'native-chatgpt-only'
    themeRoot = $rootPath
    portable = [bool]$Portable
    repository = [bool]$Repository
    sourceMode = if ($Repository) { 'repository-live' } elseif ($Portable) { 'portable' } else { 'retained-release' }
    bridgePath = $bridgePath
    bridgeHash = Get-PortableSha256 $bridgePath
    bridgeHost = 'CodexEmbeddedNode'
    lifecycleHost = 'runtime\host.mjs'
    activationHelper = $nativeActivatorPath
    activationHelperSource = 'runtime\activate-appx.cs'
    activationMode = 'native-appx-aumid'
    eventDriven = $true
    shortcutArgumentsLength = $expectedArguments.Length
    changed = [bool]($defaultShortcut.changed -or $removedLegacyShortcuts.Count -gt 0)
    defaultShortcutChanged = [bool]$defaultShortcut.changed
    removedLegacyShortcutPaths = @($removedLegacyShortcuts)
    preservedBackup = $defaultShortcut.backup
    shortcutHash = Get-PortableSha256 $shortcutPath
} | ConvertTo-Json -Compress
[IO.File]::AppendAllText($eventPath, $event + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))

Write-Host "ChatGPT launch adapter is active at $shortcutPath"
Write-Host 'This is the only managed entry and it keeps the official ChatGPT name, icon and executable.'
if ($defaultShortcut.backup) { Write-Host "The prior shortcut was preserved at $($defaultShortcut.backup)" }
foreach ($removedLegacyShortcut in $removedLegacyShortcuts) {
    Write-Host "Removed obsolete separately named launcher: $removedLegacyShortcut"
}
