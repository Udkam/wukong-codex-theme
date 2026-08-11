import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { commandTimeoutMs, isCodexTarget } from '../runtime/cdp-client.mjs';
import { browserIdentity, isProcessAlive, runWatcher } from '../runtime/watch.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const publicScripts = {
  install: read('scripts/install-repository.ps1'),
  launch: read('scripts/launch.ps1'),
  disable: read('scripts/disable.ps1'),
  hook: read('scripts/install-chatgpt-hook.ps1'),
  verifyAdapter: read('scripts/verify-launch-adapter.ps1'),
  start: read('scripts/start.ps1'),
  appxActivator: read('runtime/activate-appx.ps1'),
  nativePets: read('scripts/install-native-pets.ps1')
};

test('repository start delegates one preflight to the verified Node bridge', () => {
  assert.match(publicScripts.start, /& \$node \$bridge/);
  assert.match(publicScripts.start, /\$bridgeExitCode -eq 4/);
  assert.doesNotMatch(publicScripts.start, /Invoke-RestMethod|Get-Process -Name 'ChatGPT'|Start-Process/);
});

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

test('all public and retained legacy lifecycle scripts parse', () => {
  for (const file of [
    'scripts/install-repository.ps1',
    'scripts/install-preserving.ps1',
    'scripts/launch.ps1',
    'scripts/start.ps1',
    'scripts/install-native-pets.ps1',
    'scripts/manage-backgrounds.ps1',
    'scripts/prepare-background.ps1',
    'runtime/activate-appx.ps1',
    'scripts/install-chatgpt-hook.ps1',
    'scripts/verify-launch-adapter.ps1',
    'scripts/disable.ps1',
    'scripts/install.ps1',
    'scripts/restore.ps1'
  ]) {
    const result = parsePowerShell(file);
    assert.equal(result.status, 0, file + ' parse failure: ' + result.stdout + result.stderr);
  }
});

test('AppX activation helper resolves the official manifest and contains no WMI path', () => {
  const helper = publicScripts.appxActivator;
  assert.match(helper, /Get-AppxPackage -Name 'OpenAI\.Codex'/);
  assert.match(helper, /AppxManifest\.xml/);
  assert.match(helper, /app\\ChatGPT\.exe/);
  assert.match(helper, /IApplicationActivationManager/);
  assert.match(helper, /ActivateApplication/);
  assert.match(helper, /FromBase64String/);
  assert.doesNotMatch(helper, /Get-CimInstance|Get-WmiObject|Win32_Process|Get-NetTCPConnection|setInterval/i);
});

test('live capture closes only an explicitly owned transient debug session', () => {
  const capture = read('scripts/capture-live-playwright.mjs');
  assert.match(capture, /close-debug-after-capture/);
  assert.match(capture, /debug-root-pid/);
  assert.match(capture, /debug-owner-pid/);
  assert.match(capture, /disable-\[0-9a-f\]\{32\}/i);
  assert.match(capture, /SystemInfo\.getProcessInfo/);
  assert.match(capture, /Transient cleanup PID mismatch/);
  assert.match(capture, /aside\.app-shell-left-panel/);
  assert.match(capture, /\.composer-surface-chrome/);
  assert.match(capture, /root\.dataset\.forgeBackgroundReady === 'true'/);
  assert.match(capture, /overlay\?\.dataset\.forgeReady === 'true'/);
  assert.ok(
    capture.indexOf('aside.app-shell-left-panel') < capture.indexOf('page.screenshot'),
    'capture must wait for the native shell before taking evidence'
  );
  assert.match(capture, /Browser\.close/);
  assert.match(
    capture,
    /execFileAsync\('taskkill\.exe', \['\/PID', String\(pid\), '\/T', '\/F'\]/
  );
  assert.ok(
    capture.indexOf('SystemInfo.getProcessInfo') <
      capture.indexOf('terminateVerifiedDebugTree(debugRootPid)'),
    'the exact-tree fallback must remain behind the CDP browser PID proof'
  );
  assert.match(capture, /verifiedTreeFallback/);
  assert.match(capture, /rootReleased/);
  assert.match(capture, /ownerReleased/);
  assert.match(capture, /portReleased/);
  assert.match(capture, /const cleanupTransientDebug = async reason/);
  assert.match(capture, /watcherConfirmed/);
  assert.match(capture, /captureError/);
  assert.match(capture, /open-task-candidates/);
  assert.match(capture, /data-app-action-sidebar-thread-row/);
  assert.match(capture, /data-app-action-sidebar-thread-title/);
  assert.match(capture, /data-app-action-sidebar-thread-active/);
  assert.match(capture, /require-queue-goal/);
  assert.match(capture, /dismiss-full-access-warning/);
  assert.match(
    capture,
    /const clicked = await dismiss\.evaluate\(element => \{[\s\S]*?element\.click\(\)/
  );
  assert.doesNotMatch(capture, /await dismiss\.click\(/);
  assert.match(capture, /hasBackgroundImage:\s*paper\.backgroundImage !== 'none'/);
  assert.doesNotMatch(capture, /themedPaper\s*=\s*\{[\s\S]*?backgroundImage:\s*paper\.backgroundImage/);
  assert.match(capture, /const sanitizeReportValue = value =>/);
  assert.match(capture, /\[embedded image omitted\]/);
  assert.match(capture, /const safePayload = safeReportValue\(payload\)/);
  assert.match(capture, /report: safeReport/);
  assert.match(capture, /backgroundImage: summarizeBackgroundImage\(before\.backgroundImage\)/);
  assert.match(capture, /backgroundImage: summarizeBackgroundImage\(after\.backgroundImage\)/);
  assert.doesNotMatch(capture, /backgroundImage:\s*(?:before|after)\.backgroundImage/);
  assert.match(capture, /editorInitiallyEmpty/);
  assert.match(capture, /reusedExistingOwnedDraft/);
  assert.match(capture, /editorFocused/);
  assert.match(capture, /inputPrepared/);
  assert.match(capture, /existingEditorText === nativeEnqueueMessage/);
  assert.match(capture, /attempt < 8 && !nativeEnqueueProof\.editorFocused/);
  assert.match(capture, /editor = await findVisibleEditor\(\)/);
  assert.match(capture, /element\.focus\(\{ preventScroll: true \}\)/);
  assert.match(capture, /editor\.click\(\{ position: \{ x: 8, y: 8 \} \}\)/);
  assert.match(capture, /Native composer draft changed while acquiring focus/);
  assert.match(capture, /page\.keyboard\.insertText\(nativeEnqueueMessage\)/);
  assert.match(capture, /await editor\.press\('Enter'\)/);
  assert.doesNotMatch(capture, /page\.keyboard\.press\('Control\+Enter'\)/);
  assert.doesNotMatch(capture, /editor\.fill\(nativeEnqueueMessage\)/);
  assert.match(capture, /root\.dataset\.forgeSurface === 'thread'/);
  assert.match(capture, /root\.dataset\.forgeMode === 'scenery'/);
  assert.match(capture, /querySelectorAll\('\.forge-composer-panel'\)\.length >= 2/);
  assert.match(capture, /querySelectorAll\('\.forge-composer-queue-item'\)\.length >= 1/);
  assert.match(capture, /taskSelectionProof/);
  assert.ok(
    capture.indexOf('const taskSelectionProof = [];') < capture.indexOf('\ntry {'),
    'capture failure reporting state must be declared outside the cleanup try/catch'
  );
  assert.match(capture, /selectedTask/);
  assert.match(capture, /const waitForSelectedTask = async \(label, threadId = ''\)/);
  assert.match(capture, /const verifySelectedTaskState = async \(label, threadId = ''\)/);
  assert.match(capture, /values\['open-task-id'\]/);
  assert.match(capture, /selectedTaskId/);
  assert.match(capture, /\.forge-sidebar-selected/);
  assert.match(capture, /const rows = page\.locator\(/);
  assert.match(capture, /await task\.evaluate\(element => element\.click\(\)\)/);
  assert.doesNotMatch(capture, /getByText\(label, \{ exact: true \}\)\s*\.first\(\)/);
  assert.ok(
    capture.indexOf('await waitForSelectedTask(label, threadId)') <
      capture.indexOf('await waitForRequestedTaskState()'),
    'capture must prove the requested task is current before accepting a stale thread state'
  );
  assert.ok(
    capture.lastIndexOf("await verifySelectedTaskState(selectedTask, selectedTaskId || '')") <
      capture.indexOf("await page.screenshot({ path: output, type: 'png' })") &&
      capture.lastIndexOf("await verifySelectedTaskState(selectedTask, selectedTaskId || '')") >
        capture.indexOf('report.selectedTask = selectedTask'),
    'capture must re-prove the selected task and requested queue/goal state immediately before screenshot'
  );
  assert.match(capture, /composerAncestorChain[\s\S]*backdropFilter/);
  assert.match(
    capture,
    /catch \(error\) \{[\s\S]*cleanupTransientDebug\('capture-failed'\)/
  );
  assert.match(capture, /flag:\s*'wx'/);
  assert.doesNotMatch(
    capture,
    /Stop-Process|process\.kill\([^,]+,\s*['"]SIGKILL/i
  );
  assert.doesNotMatch(capture, /['"]\/IM['"]/i);
});

test('V31 real capture failure evidence proves automatic owned cleanup', () => {
  const evidence = JSON.parse(read(
    'artifacts/test-runs/v31-live-capture-failure-contract-20260801/acceptance.json'
  ));
  assert.equal(evidence.schemaVersion, 1);
  assert.match(evidence.source, /real Codex renderer/i);
  assert.equal(evidence.expectedFailure.captureExitCode, 1);
  assert.equal(evidence.expectedFailure.errorName, 'TimeoutError');
  assert.equal(evidence.expectedFailure.screenshotCreated, false);
  assert.match(evidence.rawReportPolicy, /retained locally only/i);
  assert.match(evidence.rawReportSha256, /^[0-9A-F]{64}$/);
  assert.equal(evidence.cleanup.reason, 'capture-failed');
  assert.equal(evidence.cleanup.nativeRestoreObserved, true);
  assert.equal(evidence.cleanup.watcherConfirmed, true);
  assert.equal(evidence.cleanup.rootReleased, true);
  assert.equal(evidence.cleanup.launcherReleased, true);
  assert.equal(evidence.cleanup.portReleased, true);
  assert.equal(evidence.cleanup.remainingProjectProcesses, 0);
  assert.match(evidence.acceptanceBoundary, /failure cleanup only/i);
  assert.match(evidence.acceptanceBoundary, /not queue/i);
  assert.match(evidence.acceptanceBoundary, /final lifecycle/i);
});

test('public entries route to repository-backed injection and verified disable', () => {
  const installEntry = read('install-theme.cmd');
  const removeEntry = read('remove-theme.cmd');
  const startEntry = read('start-theme.cmd');
  const stopEntry = read('stop-theme.cmd');

  assert.match(installEntry, /scripts\\install-repository\.ps1/i);
  assert.doesNotMatch(installEntry, /scripts\\install\.ps1/i);
  assert.match(removeEntry, /scripts\\disable\.ps1/i);
  assert.doesNotMatch(removeEntry, /scripts\\restore\.ps1|-Uninstall/i);
  assert.match(startEntry, /scripts\\start\.ps1/i);
  assert.match(stopEntry, /scripts\\disable\.ps1/i);
  assert.doesNotMatch(stopEntry, /-Portable/i);
  assert.doesNotMatch(removeEntry, /-Portable/i);
  assert.match(publicScripts.disable, /\$PSBoundParameters\.ContainsKey\('Repository'\)/);
  assert.match(publicScripts.disable, /\$releaseMarker/);

  for (const [name, script] of Object.entries({ disable: publicScripts.disable })) {
    assert.match(script, /Get-AppxPackage -Name 'OpenAI\.Codex'/, `${name} does not resolve the official Codex package`);
    assert.match(script, /app\\resources\\cua_node\\bin\\node\.exe/, `${name} does not use Codex's embedded Node runtime`);
    assert.doesNotMatch(script, /Get-Command\s+node(?:\.exe)?\b/i, `${name} depends on an external Node installation`);
    assert.doesNotMatch(script, /\bRemove-Item\b|\bMove-Item\b|\.Delete\(|rmSync|unlinkSync|rmdirSync/, `${name} contains a destructive file operation`);
    assert.doesNotMatch(script, /Stop-Process|taskkill/i, `${name} terminates a Codex process`);
    assert.doesNotMatch(
      script,
      /(?:Set-Content|Add-Content|Out-File|WriteAllText|AppendAllText|Copy-Item|Move-Item|Remove-Item)[^\r\n]*(?:app\.asar|WindowsApps|ChatGPT\.exe)/i,
      `${name} writes an official Codex program path`
    );
    assert.doesNotMatch(
      script,
      /(?:-Destination\s+\$configPath|WriteAllText\(\s*\$configPath|AppendAllText\(\s*\$configPath|(?:Set-Content|Add-Content|Out-File)[^\r\n]*\$configPath)/i,
      `${name} writes the official Codex config`
    );
  }

  for (const [name, script] of Object.entries(publicScripts)) {
    assert.doesNotMatch(script, /\bRemove-Item\b|\bMove-Item\b|\.Delete\(|rmSync|unlinkSync|rmdirSync/, `${name} contains a destructive file operation`);
    assert.doesNotMatch(script, /Stop-Process|taskkill/i, `${name} terminates a Codex process`);
  }

  assert.doesNotMatch(publicScripts.install, /(?:upgrade|apply|restore)\s+--config|&\s*\$node\s+\$engine/i);
  assert.match(publicScripts.install, /install-chatgpt-hook\.ps1/);
  assert.match(publicScripts.install, /verify-launch-adapter\.ps1/);
  assert.match(publicScripts.install, /-Repository/);
  assert.doesNotMatch(publicScripts.install, /releases|release\.json|package-runtime|appTarget/);
  assert.match(publicScripts.launch, /\[string\]\$Root/);
  assert.match(publicScripts.launch, /\[switch\]\$Portable/);
  assert.match(publicScripts.launch, /Theme package marker package\.json is missing/);
  assert.match(publicScripts.launch, /Theme package marker is invalid/);
  assert.match(publicScripts.launch, /\$startScript = Join-Path \$rootPath 'scripts\\start\.ps1'/);
  assert.match(publicScripts.launch, /\$null = \$Portable/);
  assert.match(publicScripts.launch, /& \$startScript -Root \$rootPath/);
  assert.doesNotMatch(
    publicScripts.launch,
    /Get-AppxPackage|Get-CimInstance|Get-WmiObject|Win32_Process|Start-Process|--remote-debugging|CODEX_ELECTRON_USER_DATA_PATH/,
    'legacy launch compatibility wrapper owns runtime or process discovery instead of delegating'
  );
  assert.match(publicScripts.disable, /repositoryMode/);
  assert.doesNotMatch(publicScripts.install, /install-native-pets\.ps1/);
  assert.match(publicScripts.hook, /BackupPrefix 'ChatGPT-before-wukong'/);
  assert.match(publicScripts.hook, /Copy-Item -LiteralPath \$Path -Destination \$backupPath/);
  assert.match(publicScripts.hook, /CreateShortcut\(\$Path\)/);
  assert.match(publicScripts.hook, /launcher-bridges/);
  assert.match(publicScripts.hook, /LOCALAPPDATA[^\r\n]*WukongCodexForge/);
  assert.match(publicScripts.hook, /Assert-DirectManagedPath/);
  assert.match(publicScripts.hook, /Start Menu Programs directory/);
  assert.match(publicScripts.hook, /ChatGPT Start Menu shortcut/);
  assert.match(publicScripts.hook, /entryPolicy = 'native-chatgpt-only'/);
  assert.match(publicScripts.hook, /function Remove-LegacyManagedShortcut/);
  assert.match(publicScripts.hook, /legacyBridgePath\.StartsWith\(\$bridgeRoot/);
  assert.match(publicScripts.hook, /Copy-Item -LiteralPath \$Path -Destination \$retiredBackup/);
  assert.match(publicScripts.hook, /\[IO\.File\]::Delete\(\$Path\)/);
  assert.match(publicScripts.hook, /launch adapter root/);
  assert.match(publicScripts.hook, /shortcut backup directory/);
  assert.match(publicScripts.hook, /launcher bridge directory/);
  assert.match(publicScripts.hook, /ReparsePoint/);
  assert.match(publicScripts.hook, /runtime\\host\.mjs/);
  assert.match(publicScripts.hook, /chatgpt-entry-\$bridgeId\.mjs/);
  assert.match(publicScripts.hook, /WriteAllText\(\$bridgePath, \$bridgeScript/);
  assert.match(publicScripts.hook, /Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.match(publicScripts.hook, /function Get-PortableSha256/);
  assert.match(publicScripts.hook, /\[IO\.File\]::OpenRead\(\$Path\)/);
  assert.doesNotMatch(publicScripts.hook, /Get-FileHash/);
  assert.match(publicScripts.hook, /\$expectedTarget = \$node/);
  assert.match(publicScripts.hook, /\$shortcut\.IconLocation = "\$chatGpt,0"/);
  assert.match(publicScripts.hook, /\$expectedArguments = "`"\$bridgePath`""/);
  assert.match(publicScripts.hook, /\$expectedArguments\.Length -ge 900/);
  assert.match(publicScripts.hook, /& \$node --check \$bridgePath/);
  assert.match(publicScripts.hook, /const themeAvailable = \[marker, host, theme, style, \.\.\.\(portable \? \[\] : \[activator\]\)\]/);
  assert.match(publicScripts.hook, /const target = themeAvailable \? process\.execPath : official/);
  assert.match(publicScripts.hook, /spawn\(target, args/);
  assert.doesNotMatch(publicScripts.hook, /EncodedCommand|WindowsPowerShell|Get-CimInstance|runtime\[\\\\\/\]watch\\\.mjs/);
  assert.doesNotMatch(publicScripts.hook, /ShowWindowAsync|SetForegroundWindow|user32\.dll/i);
  assert.match(publicScripts.hook, /Generated ChatGPT Node launch bridge is invalid/);
  assert.match(publicScripts.start, /install-repository\.ps1/);
  assert.match(publicScripts.start, /bridgeHostPath/);
  assert.doesNotMatch(publicScripts.start, /install-native-pets\.ps1|launch\.ps1|Get-CimInstance/);
  assert.match(publicScripts.nativePets, /New-Item -ItemType Junction/);
  assert.match(publicScripts.nativePets, /spriteVersionNumber 2/);
  assert.match(publicScripts.nativePets, /native-pet-links\.jsonl/);
  assert.match(publicScripts.nativePets, /Get-WebpDimensions/);
  assert.match(publicScripts.nativePets, /1536x2288/);
  assert.match(publicScripts.nativePets, /validation\.json/);
  assert.match(publicScripts.nativePets, /package-proof\.json/);
  assert.match(publicScripts.nativePets, /transparent_rgb_residue_pixels/);
  assert.match(publicScripts.nativePets, /Assert-NoReparseSegments/);
  assert.ok(
    publicScripts.nativePets.indexOf('$plans = @()') < publicScripts.nativePets.indexOf('New-Item -ItemType Junction'),
    'native pet junction creation begins before package preflight finishes'
  );
  assert.doesNotMatch(publicScripts.nativePets, /Remove-Item|Move-Item|Copy-Item[^\r\n]*-Force/);
  assert.match(publicScripts.nativePets, /payloadName[\s\S]*spritesheet\.webp/);
  assert.match(publicScripts.nativePets, /source-pet\.json/);
  assert.match(publicScripts.nativePets, /managed-upgrade/);
  assert.match(publicScripts.nativePets, /versioned-linked-payload/);
  assert.doesNotMatch(publicScripts.nativePets, /Copy-Item[^\r\n]*spritesheet\.webp/);

  const packager = read('scripts/package-runtime.mjs');
  assert.doesNotMatch(packager, /node_modules/);
  assert.doesNotMatch(packager, /runtime\/ws-client(?:-node)?\.mjs/);
  assert.doesNotMatch(read('runtime/cdp-client.mjs'), /from '\.\/ws-client(?:-node)?\.mjs'/);
  assert.match(read('runtime/cdp-client.mjs'), /export const commandTarget = rawCommandTarget/);
  assert.deepEqual(JSON.parse(read('package.json')).dependencies, {});
  assert.doesNotMatch(read('package-lock.json'), /"node_modules\/ws"|"ws"\s*:/);
});

test('disable is fail-closed and records success only after native-state verification', () => {
  const disable = publicScripts.disable;
  const host = read('runtime/host.mjs');
  const injector = read('runtime/injector.mjs');

  assert.match(disable, /--signal-disable/);
  assert.match(disable, /--repository/);
  assert.match(disable, /Event lifecycle host did not restore native state/);
  assert.doesNotMatch(disable, /Get-CimInstance|Get-WmiObject|Stop-Process|taskkill/);
  assert.match(host, /await Promise\.all\(targets\.map\(target => evaluate\(target, RESTORE_EXPRESSION\)\)\)/);
  assert.match(host, /states\.every\(isNativeThemeState\)/);
  assert.match(host, /native-restore-failed/);
  assert.match(host, /theme-removed-verified/);
  assert.match(injector, /--assert-native/);
  assert.match(injector, /states\.every\(isNativeThemeState\)/);
});

test('retained legacy entry files delegate before archived mutation history', () => {
  for (const [file, delegate] of [
    ['scripts/install.ps1', 'install-repository.ps1'],
    ['scripts/restore.ps1', 'disable.ps1']
  ]) {
    const script = read(file);
    const archiveIndex = script.indexOf('<# Archived legacy implementation');
    assert.ok(archiveIndex > 0, `${file} is missing retained non-executable history`);
    const livePrefix = script.slice(0, archiveIndex);
    assert.match(livePrefix, new RegExp(delegate.replace('.', '\\.')));
    assert.match(livePrefix, /\breturn\b/);
    assert.doesNotMatch(livePrefix, /\bRemove-Item\b|\bMove-Item\b|Stop-Process|taskkill/i);
  }
});

test('renderer target selection defaults to Codex app pages and gates local development explicitly', () => {
  assert.equal(isCodexTarget({ type: 'page', url: 'app://codex/index.html' }), true);
  assert.equal(isCodexTarget({ type: 'page', title: 'Codex', url: 'app://-/index.html' }), true);
  assert.equal(isCodexTarget({
    type: 'page',
    title: 'Codex',
    url: 'app://-/index.html?initialRoute=%2Favatar-overlay'
  }), false);
  assert.equal(isCodexTarget({
    type: 'page',
    url: 'app://codex/index.html?initialRoute=/avatar-overlay'
  }), false);
  assert.equal(isCodexTarget({ type: 'page', title: 'Other', url: 'app://-/index.html' }), false);
  assert.equal(isCodexTarget({ type: 'page', url: 'http://127.0.0.1:3000/' }), false);
  assert.equal(isCodexTarget(
    { type: 'page', url: 'http://127.0.0.1:3000/' },
    { allowLocalDevelopment: true }
  ), true);
  assert.equal(isCodexTarget({ type: 'page', url: 'https://example.com/' }), false);
  assert.equal(isCodexTarget({ type: 'worker', url: 'app://codex/index.html' }), false);
});

test('large runtime expressions receive a bounded 45 second transport window', () => {
  assert.equal(commandTimeoutMs('Runtime.evaluate', { expression: 'x'.repeat(1_000_001) }), 45000);
  assert.equal(commandTimeoutMs('Runtime.evaluate', { expression: 'x' }), 12000);
  assert.equal(commandTimeoutMs('Page.captureScreenshot'), 20000);
  assert.match(read('runtime/cdp-client.mjs'), /awaitPromise:\s*true/);
});

test('renderer refreshes are structural, throttled, and layout-loop free', () => {
  const runtime = read('runtime/injection-plan-v13.mjs');
  assert.match(runtime, /const naturalDelay = Math\.max\(140, 520 - elapsed\)/);
  assert.match(runtime, /timerDueAt/);
  assert.match(runtime, /scheduleRefresh\(0\)/);
  assert.match(runtime, /state\.routeTimers\.forEach\(timer => clearTimeout\(timer\)\)/);
  assert.match(runtime, /state\.routeTimers\.clear\(\)/);
  assert.match(runtime, /new MutationObserver\(/);
  const observerConfig = runtime.match(/observer\.observe\(document\.body,\s*(\{[\s\S]*?\})\s*\);/)?.[1] || '';
  assert.match(observerConfig, /childList:\s*true/);
  assert.match(observerConfig, /subtree:\s*true/);
  assert.match(observerConfig, /attributes:\s*true/);
  assert.match(observerConfig, /attributeFilter:\s*\[/);
  assert.match(observerConfig, /'hidden'/);
  assert.match(observerConfig, /'inert'/);
  assert.doesNotMatch(observerConfig, /'class'|'style'|'data-forge-/);
  assert.match(runtime, /nodeTouchesThemeStructure/);
  assert.match(runtime, /nodeIsWithinThemeStructure/);
  assert.match(runtime, /surfaceSignalSelector/);
  assert.match(runtime, /recordTouchesSurfaceSignal/);
  assert.match(runtime, /data-local-conversation-final-assistant/);
  assert.match(runtime, /new ResizeObserver\(/);
  assert.match(runtime, /setResizeTargets/);
  assert.match(runtime, /observedResizeTargets/);
  assert.doesNotMatch(runtime, /characterData:\s*true/);
  assert.doesNotMatch(runtime, /window\.addEventListener\('scroll', scheduleRefresh/);
  assert.match(runtime, /visualViewport\?\.addEventListener\('resize', scheduleRefresh/);
  assert.doesNotMatch(runtime, /visualViewport\?\.addEventListener\('scroll', scheduleRefresh/);
  assert.match(runtime, /addEventListener\('keydown', scheduleComposerKeyboardSubmit/);
  assert.doesNotMatch(runtime, /addEventListener\('input', scheduleRefresh/);
  assert.match(runtime, /history\.pushState = function/);
  assert.match(runtime, /preloadBackground/);
  assert.match(runtime, /transitionInFlight/);
  assert.match(runtime, /selectedScenes/);
  assert.match(runtime, /decodedSources/);
  assert.match(runtime, /if \(document\.hidden\)/);
  assert.match(runtime, /addEventListener\('visibilitychange', handleVisibilityChange/);
  assert.match(runtime, /scheduleRefresh\(composerSignalChanged \? 140 : undefined\)/);
  assert.doesNotMatch(runtime, /taskIdentity|landingEpoch/);
  assert.doesNotMatch(runtime, /setInterval/);
  assert.equal(
    runtime.match(/window\.requestAnimationFrame\(/g)?.length,
    2,
    'background transitions may use exactly two one-shot paint frames, never a renderer refresh loop'
  );
  assert.match(runtime, /state\.transitionFrameA = window\.requestAnimationFrame\(\(\) =>/);
  assert.match(runtime, /state\.transitionFrameB = window\.requestAnimationFrame\(beginTransition\)/);
  assert.match(runtime, /window\.cancelAnimationFrame\(state\.transitionFrameA\)/);
  assert.match(runtime, /window\.cancelAnimationFrame\(state\.transitionFrameB\)/);

  const style = read('runtime/forge-background-v13.css');
  assert.match(style, /\[data-codex-composer-root\] \.composer-surface-chrome/);
  assert.doesNotMatch(
    style,
    /aspect-ratio:\s*184\s*\/\s*25|min-height:\s*96px|max-height:\s*120px|padding-block-start:\s*8px\s*!important/,
    'composer theme paint must not override native geometry or editor insets'
  );
  assert.match(style, /\[data-thread-scroll-footer="true"\][\s\S]*\.bg-gradient-to-t/);
  assert.match(
    style,
    /\.order-2\.flex\.min-w-0\.flex-col:not\(\[data-above-composer-portal\] \*\):has\(/
  );
  assert.match(style, /\[data-pip-obstacle="thread-summary-panel"\]/);
  assert.match(style, /\[data-slot="thread-summary-panel-item"\]/);
  assert.match(style, /\[data-app-action-sidebar-thread-row\]\[data-app-action-sidebar-thread-active="true"\]/);
  assert.match(style, /@media \(forced-colors: active\)[\s\S]*\[data-codex-composer-root\][\s\S]*\[data-pip-obstacle="thread-summary-panel"\]/);
  assert.match(style, /@media \(forced-colors: active\)[\s\S]*\[data-thread-scroll-footer="true"\]/);

  const watcher = read('runtime/watch.mjs');
  assert.doesNotMatch(watcher, /emptyTargetPasses|targets\.length\s*>=?\s*8/);
  assert.match(watcher, /if \(!rootAlive\)/);
  assert.match(watcher, /rootIsAlive\(rootPid\)/);
  assert.match(watcher, /WUKONG_BROWSER_IDENTITY_CHANGED/);
  assert.match(watcher, /if \(!targets\.length\)[\s\S]*await pause\(intervalMs\)[\s\S]*continue/);
});

test('watcher survives an unlimited renderer-free tray interval and reapplies to the next page', async () => {
  const target = { type: 'page', url: 'app://codex/index.html' };
  let targetReads = 0;
  let applyCount = 0;
  let rootAlive = true;
  let pauses = 0;
  const result = await runWatcher({
    port: 17777,
    themePath: 'unused.json',
    disableRequest: '',
    rootPid: process.pid,
    expression: 'APPLY',
    intervalMs: 1,
    dependencies: {
      getBrowserVersion: async () => ({ Browser: 'Codex/test', webSocketDebuggerUrl: 'ws://127.0.0.1:17777/devtools/browser/stable' }),
      getTargets: async () => (++targetReads <= 12 ? [] : [target]),
      evaluateTarget: async (_target, expression) => {
        if (expression === 'APPLY') {
          applyCount += 1;
          rootAlive = false;
          return true;
        }
        return false;
      },
      isCodexTarget: () => true,
      isProcessAlive: () => rootAlive,
      sleep: async () => { pauses += 1; },
      log: () => {}
    }
  });
  assert.equal(
    pauses,
    13,
    'twelve renderer-free polls plus one paced poll after the first successful reapply'
  );
  assert.equal(applyCount, 1);
  assert.equal(result.reason, 'root-exited');
});

test('watcher binds the loopback endpoint to one browser identity', async () => {
  let versionReads = 0;
  await assert.rejects(() => runWatcher({
    port: 17778,
    themePath: 'unused.json',
    disableRequest: '',
    rootPid: process.pid,
    expression: 'APPLY',
    intervalMs: 1,
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Codex/test',
        webSocketDebuggerUrl: `ws://127.0.0.1:17778/devtools/browser/${++versionReads}`
      }),
      getTargets: async () => [],
      isProcessAlive: () => true,
      sleep: async () => {},
      log: () => {}
    }
  }), /different browser instance/);
});

test('watcher process and browser identity helpers reject ambiguous ownership', () => {
  assert.equal(isProcessAlive(process.pid), true);
  assert.match(
    browserIdentity({ Browser: 'Codex/test', webSocketDebuggerUrl: 'ws://127.0.0.1:17779/devtools/browser/a' }),
    /Codex\/test/
  );
  assert.throws(() => browserIdentity({ webSocketDebuggerUrl: 'ws://example.com/devtools/browser/a' }), /non-loopback/);
});

test('watcher can disable cleanly while the native window is closed to tray', async () => {
  const runRoot = path.resolve('artifacts', 'test-runs', `watcher-disable-no-renderer-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: true });
  const request = path.join(runRoot, 'disable.request');
  fs.writeFileSync(request, 'test request\n', { encoding: 'utf8', flag: 'wx' });
  const result = await runWatcher({
    port: 17780,
    themePath: 'unused.json',
    disableRequest: request,
    rootPid: process.pid,
    expression: 'APPLY',
    intervalMs: 1,
    dependencies: {
      getBrowserVersion: async () => ({ Browser: 'Codex/test', webSocketDebuggerUrl: 'ws://127.0.0.1:17780/devtools/browser/stable' }),
      getTargets: async () => [],
      isProcessAlive: () => true,
      log: () => {}
    }
  });
  const confirmation = JSON.parse(fs.readFileSync(`${request}.confirmed.json`, 'utf8'));
  assert.equal(result.reason, 'disabled-no-renderer');
  assert.equal(confirmation.targets, 0);
  assert.equal(confirmation.deferredNative, true);
});
