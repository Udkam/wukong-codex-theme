import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const read = file => fs.readFileSync(file, 'utf8');
const supervisor = read('runtime/native-entry-supervisor.cs');
const appxActivator = read('runtime/activate-appx.cs');
const host = read('runtime/host.mjs');
const installer = read('scripts/install-native-supervisor.ps1');
const repositoryInstaller = read('scripts/install-repository.ps1');

const parsePowerShell = file => {
  const absolute = path.resolve(file).replaceAll("'", "''");
  const command =
    '$tokens=$null;$errors=$null;' +
    `[System.Management.Automation.Language.Parser]::ParseFile('${absolute}',[ref]$tokens,[ref]$errors)|Out-Null;` +
    'if($errors.Count){$errors|ForEach-Object{Write-Error $_.Message};exit 1}';
  return spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
};

test('native supervisor installer remains valid for Windows PowerShell 5.1', () => {
  const result = parsePowerShell('scripts/install-native-supervisor.ps1');
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('native entry detection is event-driven and verifies the exact official executable', () => {
  assert.match(supervisor, /private const uint EventObjectShow = 0x8002;/);
  assert.match(
    supervisor,
    /SetWinEventHook\(\s*EventObjectShow,\s*EventObjectShow,[\s\S]*?WineventOutOfContext \| WineventSkipOwnProcess\)/
  );
  assert.match(supervisor, /SetWinEventHook\(EVENT_OBJECT_SHOW\) failed/);
  assert.match(supervisor, /new FileSystemWatcher\(repositoryRoot, "package\.json"\)/);
  assert.match(supervisor, /repositoryWatcher\.Deleted[\s\S]*QueueMarkerValidation\("repository-marker-deleted"\)/);
  assert.match(supervisor, /repositoryWatcher\.Renamed[\s\S]*QueueMarkerValidation\("repository-marker-renamed"\)/);
  assert.match(supervisor, /repositoryWatcher\.Error[\s\S]*QueueMarkerValidation\("repository-watcher-error"\)/);
  assert.match(supervisor, /GetMessage\(out message, IntPtr\.Zero, 0, 0\)/);

  assert.match(supervisor, /QueryFullProcessImageName\(process, 0, path, ref capacity\)/);
  assert.match(
    supervisor,
    /String\.Equals\(CanonicalPath\(actualPath\), expectedChatGptPath, StringComparison\.OrdinalIgnoreCase\)/
  );
  assert.doesNotMatch(supervisor, /process\.Kill\(/);
  assert.doesNotMatch(supervisor, /taskkill|\/IM|Stop-Process|Kill\(\s*"?ChatGPT/i);
});

test('owned Codex windows suppress the DWM accent border and restore it on shutdown', () => {
  assert.match(supervisor, /private const int DwmwaBorderColor = 34;/);
  assert.match(supervisor, /private const uint DwmColorNone = 0xFFFFFFFE;/);
  assert.match(supervisor, /private const uint DwmColorDefault = 0xFFFFFFFF;/);
  assert.match(
    supervisor,
    /ApplyThemeBordersToOfficialWindows\(\);[\s\S]*?Log\("supervisor-ready"/
  );
  assert.match(
    supervisor,
    /if \(!IsExpectedOfficialProcess\(processId\)\)[\s\S]*?ApplyThemeWindowBorder\(window\);/
  );
  assert.match(
    supervisor,
    /DwmSetWindowAttribute\([\s\S]*?DwmwaBorderColor,[\s\S]*?ref borderColor/
  );
  assert.match(
    supervisor,
    /Interlocked\.Exchange\(ref shuttingDown, 1\);[\s\S]*?RestoreThemeWindowBorders\(\);/
  );
  assert.match(supervisor, /\[DllImport\("dwmapi\.dll"\)\]/);
});

test('repository install verifies the bridge before starting and merging supervisor evidence', () => {
  const bridgeVerification = repositoryInstaller.indexOf('scripts\\verify-launch-adapter.ps1');
  const supervisorInstall = repositoryInstaller.indexOf("& (Join-Path $rootPath 'scripts\\install-native-supervisor.ps1')");
  assert.ok(bridgeVerification >= 0, 'repository installer omits bridge verification');
  assert.ok(supervisorInstall > bridgeVerification, 'supervisor must start only after bridge verification');
  assert.match(repositoryInstaller, /native-entry-supervisor\.cs/);
  assert.match(repositoryInstaller, /install-native-supervisor\.ps1/);
  assert.match(repositoryInstaller, /eventSource, 'SetWinEventHook\(EVENT_OBJECT_SHOW\)'/);
  assert.match(repositoryInstaller, /\[bool\]\$supervisor\.steadyPolling/);
  assert.match(repositoryInstaller, /\[bool\]\$supervisor\.wmi/);
  assert.match(repositoryInstaller, /Add-Member -NotePropertyName nativeEntrySupervisor/);
  assert.match(repositoryInstaller, /\$verification \| ConvertTo-Json -Depth 8 -Compress/);
  assert.doesNotMatch(repositoryInstaller, /\$supervisorOutput\s*\|\s*Write-Output/);
});

test('supervisor lifecycle uses named Ready, Stop, and Instance primitives', () => {
  assert.match(supervisor, /NativeEntrySupervisor\.Stop/);
  assert.match(supervisor, /NativeEntrySupervisor\.Ready/);
  assert.match(supervisor, /NativeEntrySupervisor\.Instance/);
  assert.match(supervisor, /new Mutex\(true, InstanceMutexName, out createdNew\)/);
  assert.match(supervisor, /new EventWaitHandle\(false, EventResetMode\.ManualReset, StopEventName/);
  assert.match(supervisor, /new EventWaitHandle\(false, EventResetMode\.ManualReset, ReadyEventName/);
  assert.match(supervisor, /ThreadPool\.RegisterWaitForSingleObject\(\s*stopEvent/);
  assert.match(supervisor, /readyEvent\.Set\(\)/);
});

test('native AppX activation and supervisor share one fail-safe ManagedLaunch AutoReset signal', () => {
  const eventName = /Local\\WukongCodexTheme\.NativeEntrySupervisor\.ManagedLaunch/;
  assert.match(appxActivator, eventName);
  assert.match(supervisor, eventName);
  assert.match(
    supervisor,
    /new EventWaitHandle\(false, EventResetMode\.AutoReset, ManagedLaunchEventName, out managedLaunchCreated\)/
  );
  assert.match(
    appxActivator,
    /EventWaitHandle\.OpenExisting\(\s*ManagedLaunchEventName,\s*EventWaitHandleRights\.Modify\)/
  );
  assert.match(appxActivator, /if \(!supervisorEvent\.Set\(\)\)[\s\S]*?markerSet = true;/);
  assert.match(
    appxActivator,
    /catch\s*\{[\s\S]*?if \(markerSet\)[\s\S]*?supervisorEvent\.Reset\(\);[\s\S]*?throw;/
  );
  assert.match(supervisor, /managedLaunchEvent != null && managedLaunchEvent\.WaitOne\(0\)/);
  assert.match(supervisor, /observation\.ManagedLaunchSignaled = managedLaunchSignaled/);
  assert.match(supervisor, /if \(observation\.ManagedLaunchSignaled\)[\s\S]*?managed-launch-signal-consumed/);
  assert.match(
    supervisor,
    /if \(managedLaunchSignaled\)[\s\S]*?DateTime\.UtcNow\.AddSeconds\(45\)[\s\S]*?managedRelaunchSuppressedUntilUtc = requestedSuppression/
  );
});

test('active AppX launch path executes the compiled C# helper without PowerShell or WMI', () => {
  assert.match(appxActivator, /IApplicationActivationManager/);
  assert.match(appxActivator, /manager\.ActivateApplication\(/);
  assert.match(appxActivator, /Convert\.FromBase64String\(encoded\)/);
  assert.match(appxActivator, /new UTF8Encoding\(false, true\)\.GetString\(bytes\)/);
  assert.ok(appxActivator.includes("value.IndexOf('\\0')"));
  assert.ok(appxActivator.includes("value.IndexOf('\\r')"));
  assert.ok(appxActivator.includes("value.IndexOf('\\n')"));

  const activationFunction = host.match(
    /export const activatePackagedChatGpt = \(\{[\s\S]*?^\};$/m
  )?.[0] ?? '';
  assert.match(activationFunction, /const run = dependencies\.spawnSync \|\| spawnSync/);
  assert.match(activationFunction, /const result = run\(helperPath, \[/);
  assert.match(activationFunction, /--arguments-base64/);
  assert.doesNotMatch(activationFunction, /powershell|pwsh|\.ps1/i);
  for (const source of [appxActivator, activationFunction]) {
    assert.doesNotMatch(
      source,
      /Get-CimInstance|Get-WmiObject|Win32_Process|ManagementObjectSearcher|System\.Management|Get-NetTCPConnection/i
    );
  }
});

test('an unmanaged native window is preserved without a restart or kill path', () => {
  assert.match(supervisor, /native-channel-unavailable-preserved/);
  assert.doesNotMatch(supervisor, /StopOfficialProcesses|TryConsumeRestartBudget|process\.Kill\(|WmClose/);
});

test('unmanaged native entry performs one CDP check instead of a six-second probe loop', () => {
  assert.doesNotMatch(supervisor, /WaitForCodexCdp|CdpStartupWaitMs/);
  const launchHandler = supervisor.match(
    /private static void HandleOfficialLaunch\(LaunchObservation observation\)[\s\S]*?(?=private static bool HasCodexCdp\()/
  )?.[0] ?? '';
  assert.equal(
    (launchHandler.match(/HasCodexCdp\(\)/g) || []).length,
    1,
    'each unmanaged native window may inspect the existing CDP channel only once'
  );
  assert.doesNotMatch(launchHandler, /Stopwatch|ElapsedMilliseconds|WaitOne\(|Thread\.Sleep|Task\.Delay/);
  assert.match(launchHandler, /if \(HasCodexCdp\(\)\)/);
});

test('auxiliary official windows preserve a confirmed managed process tree before probing transient CDP state', () => {
  const launchHandler = supervisor.match(
    /private static void HandleOfficialLaunch\(LaunchObservation observation\)[\s\S]*?(?=private static int CaptureManagedProcessIdentities\()/
  )?.[0] ?? '';
  const identityGuard = launchHandler.indexOf('if (HasLiveManagedProcessIdentity())');
  const cdpProbe = launchHandler.indexOf('if (HasCodexCdp())');
  assert.ok(identityGuard >= 0, 'managed process identity guard is missing');
  assert.ok(cdpProbe > identityGuard, 'transient CDP must not be probed before the managed process identity guard');
  assert.match(launchHandler, /managed-process-identity-confirmed/);
  assert.match(launchHandler, /int managedProcessCount = CaptureManagedProcessIdentities\(\)/);
  assert.match(supervisor, /private static readonly Dictionary<int, long> ManagedProcessIdentities/);
  assert.match(supervisor, /process\.StartTime\.ToUniversalTime\(\)\.Ticks == identity\.Value/);
  assert.match(supervisor, /IsExpectedOfficialProcess\(identity\.Key\)/);
  assert.match(
    launchHandler,
    /if \(observation\.ManagedLaunchSignaled\)[\s\S]*?CaptureManagedProcessIdentities\(\)[\s\S]*?managed-launch-signal-consumed/
  );
  assert.match(
    supervisor,
    /ApplyThemeBordersToOfficialWindows\(\);[\s\S]*?if \(HasCodexCdp\(\)\)[\s\S]*?initial-managed-channel-confirmed[\s\S]*?Log\("supervisor-ready"/
  );
});

test('repository marker loss removes only the exact per-user Run value', () => {
  assert.match(supervisor, /private const string RunKeyPath = @"Software\\Microsoft\\Windows\\CurrentVersion\\Run";/);
  assert.match(supervisor, /if \(!markerValid\)[\s\S]*?RequestShutdown\(true, reason\)/);
  assert.match(supervisor, /Registry\.CurrentUser\.OpenSubKey\(RunKeyPath, true\)/);
  assert.match(supervisor, /runKey\.DeleteValue\(runValueName, false\)/);
  assert.doesNotMatch(supervisor, /DeleteSubKey|DeleteSubKeyTree/);
  assert.match(installer, /\$runValueName = 'WukongCodexThemeNativeEntrySupervisor'/);
  assert.match(installer, /'--run-value', \$runValueName/);
});

test('legacy supervisor retirement is ownership-gated and runs only after the new ready event', () => {
  assert.match(installer, /\$legacyLifecycleIds = \[ordered\]@\{/);
  assert.match(installer, /function Test-LegacyRunCommandOwned/);
  assert.match(installer, /native-entry-supervisor-\[0-9a-f\]\+\\\.exe/);
  assert.match(installer, /function Retire-LegacySupervisor/);
  assert.match(installer, /foreign-preserved/);
  assert.match(installer, /changed-preserved/);
  assert.match(installer, /orphan-unowned-preserved/);
  assert.match(installer, /orphan-retired/);
  assert.match(installer, /legacyState\.repositoryRoot/);
  assert.match(installer, /\$legacyStopEvent\.Set\(\)/);
  assert.match(installer, /\$legacyMutex\.WaitOne\(7000\)/);
  assert.match(installer, /Remove-ItemProperty -Path \$RunKeyPath -Name \$LegacyRunValueName/);
  assert.doesNotMatch(installer, /Remove-Item[^\r\n]*(?:WukongCodexForge|\$legacyLifecycleIds)/);
  const readyCheck = installer.indexOf('$ready = $readyEvent.WaitOne(7000)');
  const retirement = installer.lastIndexOf('$legacyRetirement = Retire-LegacySupervisor');
  assert.ok(retirement > readyCheck, 'legacy supervisor was retired before the new supervisor published ready');
});

test('supervisor has no WMI, CIM, timer, steady polling, or name-only kill path', () => {
  for (const source of [supervisor, installer, appxActivator, host]) {
    assert.doesNotMatch(
      source,
      /Get-CimInstance|Get-WmiObject|Win32_Process|ManagementObjectSearcher|System\.Management|Get-NetTCPConnection/i
    );
  }
  assert.doesNotMatch(supervisor, /System\.Threading\.Timer|System\.Timers\.Timer|new Timer\s*\(|Thread\.Sleep|Task\.Delay/i);
  assert.doesNotMatch(supervisor, /setInterval|setTimeout/i);
  assert.match(supervisor, /while \(true\)[\s\S]*?GetMessage\(out message/);
  const messageLoop = supervisor.match(
    /private static void RunMessageLoop\(\)[\s\S]*?(?=private static void OnWinEvent\()/
  )?.[0] ?? '';
  assert.doesNotMatch(messageLoop, /GetProcessesByName|HasCodexCdp|Thread\.Sleep|WaitOne/i);
  assert.doesNotMatch(installer, /Get-Process\s+-Name\s+['"]?ChatGPT|Stop-Process\s+-Name|taskkill/i);
});

test('installer reuses only matching immutable state and live native ownership evidence', () => {
  assert.match(installer, /\$statePath = Join-Path \$installRoot 'install-state\.json'/);
  for (const field of [
    'sourceHash',
    'activatorSourceHash',
    'bridgeHash',
    'executableHash',
    'activatorExecutablePath',
    'activatorExecutableHash',
    'appUserModelId',
    'packageFullName',
    'packageVersion',
    'runCommand',
    'supervisorPid',
    'processStartTimeUtcTicks'
  ]) {
    assert.match(installer, new RegExp(`existingState\\.${field}`), `reuse omits ${field}`);
  }
  assert.match(installer, /Get-Process -Id \(\[int\]\$existingState\.supervisorPid\)/);
  assert.match(installer, /\$existingProcess\.Path[\s\S]*?\$exePath/);
  assert.match(installer, /\$existingProcess\.StartTime\.ToUniversalTime\(\)\.Ticks -eq \[long\]\$existingState\.processStartTimeUtcTicks/);
  assert.match(installer, /EventWaitHandle\]::OpenExisting\(\$readyEventName\)/);
  assert.match(installer, /Mutex\]::OpenExisting\(\$instanceMutexName\)/);
  assert.match(installer, /\$reused = \$processMatches -and \$readySet -and \$mutexHeldBySupervisor/);
  assert.match(installer, /New-ItemProperty -Path \$runKeyPath -Name \$runValueName -Value \$runCommand/);
  assert.match(installer, /\$readyEvent\.WaitOne\(7000\)/);
  assert.match(installer, /\$readyEvent\.Reset\(\) \| Out-Null/);
  assert.match(installer, /if \(-not \$ready -or \$started\.HasExited\)/);
  assert.match(installer, /steadyPolling = \$false/);
  assert.match(installer, /wmi = \$false/);
  assert.match(installer, /currentChatGptUntouched = \$true/);
  assert.match(installer, /\$activatorSourcePath = Join-Path \$rootPath 'runtime\\activate-appx\.cs'/);
  assert.match(installer, /"\/out:\$temporaryActivatorExePath"[\s\S]*?\$activatorSourcePath/);
});

test('installer file replacement is limited to two literal .new.exe to .exe moves with no recursive or wildcard mutation', () => {
  const moveLines = installer.split(/\r?\n/).filter(line => /\bMove-Item\b/.test(line));
  assert.deepEqual(moveLines.map(line => line.trim()), [
    'Move-Item -LiteralPath $temporaryExePath -Destination $exePath -Force',
    'Move-Item -LiteralPath $temporaryActivatorExePath -Destination $activatorExePath -Force'
  ]);
  assert.match(installer, /\$temporaryExePath = Join-Path \$installRoot "native-entry-supervisor-\$repositoryId\.new\.exe"/);
  assert.match(installer, /\$exePath = Join-Path \$installRoot "native-entry-supervisor-\$repositoryId\.exe"/);
  assert.match(installer, /\$temporaryActivatorExePath = Join-Path \$installRoot "appx-activator-\$repositoryId\.new\.exe"/);
  assert.match(installer, /\$activatorExePath = Join-Path \$installRoot "appx-activator-\$repositoryId\.exe"/);
  assert.doesNotMatch(installer, /\b(?:Move|Remove)-Item\b[^\r\n]*-(?:Recurse|Include|Exclude)\b/i);
  assert.doesNotMatch(installer, /\b(?:Move|Remove)-Item\b[^\r\n]*(?:\*|\?)/);
});
