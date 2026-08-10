import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  activatePackagedChatGpt,
  appxArgumentLine,
  browserIdentity,
  controlPipeName,
  createHostSignals,
  deriveOfficialPaths,
  findReusableDevToolsPort,
  parseHostArgs,
  repositoryStateRoot,
  resolveHostPaths,
  runEventWatcher,
  waitForDevToolsPort
} from '../runtime/host.mjs';
import {
  ACTIVE_PROBE_EXPRESSION,
  RESTORE_EXPRESSION,
  THEME_STATE_EXPRESSION
} from '../runtime/injection-plan-v13.mjs';

const read = file => fs.readFileSync(file, 'utf8');

const activeState = {
  stylePresent: true,
  rootClass: true,
  backgroundLayerPresent: true,
  backgroundLayerCount: 2,
  backgroundReady: true,
  backgroundActiveLayer: '0',
  surface: 'landing',
  mode: 'battle',
  scene: '0',
  backgroundActiveScene: '0',
  backgroundActiveMode: 'battle',
  backgroundActiveImage: 'url("data:image/jpeg;base64,test")',
  motifLayerPresent: false,
  visibleNativeComposerCount: 1,
  visibleThemedComposerCount: 1,
  runtimeV12: false,
  runtimeV13: true
};

const nativeState = {
  stylePresent: false,
  rootClass: false,
  markedElements: 0,
  ownedNodeCount: 0,
  backgroundLayerPresent: false,
  backgroundReady: false,
  motifLayerPresent: false,
  runtimeV4: false,
  runtimeV5: false,
  runtimeV6: false,
  runtimeV7: false,
  runtimeV8: false,
  runtimeV9: false,
  runtimeV10: false,
  runtimeV11: false,
  runtimeV12: false,
  runtimeV13: false
};

test('formal lifecycle bridge is Node-hosted and uses a compiled native AppX helper', () => {
  const host = read('runtime/host.mjs');
  const hook = read('scripts/install-chatgpt-hook.ps1');
  const bridge = hook.match(/\$bridgeScript = @"([\s\S]*?)"@/)?.[1] || '';

  assert.match(host, /Target\.setDiscoverTargets/);
  assert.match(host, /Target\.setAutoAttach/);
  assert.match(host, /Page\.frameNavigated/);
  assert.match(host, /Runtime\.executionContextCreated/);
  assert.doesNotMatch(host, /setInterval\s*\(/);
  assert.doesNotMatch(host, /runtime[\\/]watch\.mjs|Start-Sleep|Get-CimInstance|Get-WmiObject/i);
  assert.match(host, /helperPath: paths\.appxActivatorPath/);
  assert.match(host, /activationMode: 'native-appx-aumid'/);
  assert.match(host, /launchMode = 'activated-official-appx'/);
  assert.match(host, /if \(portable\) \{[\s\S]*?spawn\(official\.chatGpt, args/);
  assert.match(host, /runtime', 'activate-appx\.cs'/);
  assert.doesNotMatch(host, /WindowsPowerShell|powershell\.exe|activate-appx\.ps1/i);

  assert.match(bridge, /import fs from 'node:fs'/);
  assert.match(bridge, /spawn\(target, args/);
  assert.match(bridge, /spawnSync\(tasklist/);
  assert.match(bridge, /hasReusableCodexChannel/);
  assert.match(bridge, /AbortSignal\.timeout\(5_000\)/);
  assert.match(bridge, /initialRoute[\s\S]*?avatar-overlay/);
  assert.match(bridge, /showBlockedLaunch/);
  assert.match(bridge, /runtime', 'host\.mjs/);
  assert.match(bridge, /const activator = \$nativeActivatorLiteral/);
  assert.match(bridge, /--appx-activator[\s\S]*--appx-aumid[\s\S]*--appx-package/);
  assert.doesNotMatch(bridge, /powershell(?:\.exe)?|launch\.ps1|watch\.mjs|Get-CimInstance|Get-WmiObject|Start-Process/i);
  assert.match(hook, /\$expectedTarget = \$node/);
  assert.match(hook, /chatgpt-entry-\$bridgeId\.mjs/);
  assert.match(hook, /& \$node --check \$bridgePath/);
  assert.match(hook, /\$expectedArguments = "`"\$bridgePath`""/);
});

test('AppX activation uses an encoded argument line and validates helper evidence', () => {
  assert.equal(
    appxArgumentLine(['--remote-debugging-port=0', '--user-data-dir=C:\\A B', 'a"b']),
    '--remote-debugging-port=0 "--user-data-dir=C:\\A B" "a\\"b"'
  );

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), `wukong-appx-helper-${process.pid}-`));
  const helperPath = path.join(temp, 'activate-appx.exe');
  const expectedExecutable = path.join(temp, 'ChatGPT.exe');
  fs.writeFileSync(helperPath, '', 'utf8');
  fs.writeFileSync(expectedExecutable, '', 'utf8');
  let invocation;
  const aumid = 'OpenAI.Codex_test!App';
  const packageName = 'OpenAI.Codex_test_1.2.3.4_x64__test';
  const version = '1.2.3.4';
  const evidence = activatePackagedChatGpt({
    helperPath,
    args: ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0'],
    aumid,
    packageName,
    version,
    expectedExecutable,
    dependencies: {
      spawnSync: (executable, args, options) => {
        invocation = { executable, args, options };
        return {
          status: 0,
          stdout: `${JSON.stringify({ pid: 1234, aumid, package: packageName, version, executable: expectedExecutable })}\n`,
          stderr: ''
        };
      }
    }
  });
  assert.equal(evidence.pid, 1234);
  assert.equal(invocation.executable, helperPath);
  assert.deepEqual(invocation.args.slice(0, 8), [
    '--aumid', aumid,
    '--expected-executable', expectedExecutable,
    '--package', packageName,
    '--version', version
  ]);
  const encoded = invocation.args[invocation.args.indexOf('--arguments-base64') + 1];
  assert.equal(
    Buffer.from(encoded, 'base64').toString('utf8'),
    '--remote-debugging-address=127.0.0.1 --remote-debugging-port=0'
  );
  assert.equal(invocation.options.windowsHide, true);
  assert.doesNotMatch(invocation.executable, /powershell|pwsh/i);
});

test('event host arguments, official path derivation and pipe ownership are deterministic', () => {
  assert.deepEqual(parseHostArgs(['--root', 'C:\\theme']), {
    portable: false,
    repository: false,
    signalDisable: false,
    root: 'C:\\theme'
  });
  assert.deepEqual(parseHostArgs(['--root', 'C:\\theme', '--repository', '--signal-disable']), {
    portable: false,
    repository: true,
    signalDisable: true,
    root: 'C:\\theme'
  });
  assert.throws(
    () => parseHostArgs(['--root', 'C:\\theme', '--portable', '--repository']),
    /mutually exclusive/
  );
  assert.throws(() => parseHostArgs(['--portable']), /--root DIR/);
  assert.throws(() => parseHostArgs(['--root', 'C:\\theme', '--unknown']), /Unknown or incomplete/);

  const official = deriveOfficialPaths('C:\\Program Files\\WindowsApps\\OpenAI.Codex_test\\app\\resources\\cua_node\\bin\\node.exe');
  assert.equal(official.chatGpt, path.resolve('C:\\Program Files\\WindowsApps\\OpenAI.Codex_test\\app\\ChatGPT.exe'));
  const resolved = resolveHostPaths({
    root: 'C:\\theme',
    env: { USERPROFILE: 'C:\\Users\\Test', APPDATA: 'C:\\Users\\Test\\AppData\\Roaming' }
  });
  assert.equal(resolved.profilePath, path.resolve('C:\\Users\\Test\\AppData\\Roaming\\Codex\\web\\Codex'));
  const repositoryResolved = resolveHostPaths({
    root: 'C:\\checkout\\wukong-codex-theme',
    repository: true,
    env: {
      USERPROFILE: 'C:\\Users\\Test',
      APPDATA: 'C:\\Users\\Test\\AppData\\Roaming',
      LOCALAPPDATA: 'C:\\Users\\Test\\AppData\\Local'
    }
  });
  assert.equal(repositoryResolved.profilePath, resolved.profilePath);
  assert.equal(
    repositoryResolved.stateRoot,
    repositoryStateRoot({
      root: 'C:\\checkout\\wukong-codex-theme',
      env: { USERPROFILE: 'C:\\Users\\Test', LOCALAPPDATA: 'C:\\Users\\Test\\AppData\\Local' }
    })
  );
  assert.match(repositoryResolved.stateRoot, /WukongCodexForge[\\/]repository-state[\\/][0-9a-f]{24}$/);
  assert.equal(repositoryResolved.stateRoot.startsWith(path.resolve('C:\\checkout')), false);
  assert.equal(controlPipeName(resolved.stateRoot), controlPipeName(resolved.stateRoot.toUpperCase()));
  assert.match(controlPipeName(resolved.stateRoot), /^\\\\\.\\pipe\\WukongCodexForge-[0-9a-f]{24}$/);
  assert.match(browserIdentity({
    Browser: 'Codex/test',
    webSocketDebuggerUrl: 'ws://127.0.0.1:17777/devtools/browser/stable'
  }), /Codex\/test/);
  assert.throws(() => browserIdentity({ webSocketDebuggerUrl: 'ws://example.com/devtools/browser/a' }), /non-loopback/);
});

test('startup follows the managed DevTools channel after the short-lived Store relay exits', async () => {
  const profilePath = path.join(os.tmpdir(), `wukong-event-host-relay-${process.pid}-${Date.now()}`);
  fs.mkdirSync(profilePath, { recursive: false });
  const relayExit = Promise.resolve({ code: 0, signal: null });
  setTimeout(() => {
    fs.writeFileSync(
      path.join(profilePath, 'DevToolsActivePort'),
      '17776\n/devtools/browser/relay-handoff\n',
      { encoding: 'utf8', flag: 'wx' }
    );
  }, 20);

  const port = await waitForDevToolsPort({
    profilePath,
    rootExit: relayExit,
    timeoutMs: 1_000
  });

  assert.equal(port, 17776);
});

test('startup channel wait stops immediately when the lifecycle is terminated', async () => {
  const profilePath = path.join(os.tmpdir(), `wukong-event-host-cancel-${process.pid}-${Date.now()}`);
  fs.mkdirSync(profilePath, { recursive: false });
  const signals = createHostSignals();
  const waiting = waitForDevToolsPort({ profilePath, timeoutMs: 30_000, signals });
  signals.requestTerminate();
  assert.equal(await waiting, null);
});

test('host refresh signal requests reconciliation without changing stop state', () => {
  const signals = createHostSignals();
  let changes = 0;
  const unsubscribe = signals.subscribe(() => { changes += 1; });
  signals.requestRefresh();
  unsubscribe();
  assert.equal(changes, 1);
  assert.equal(signals.disableRequested, false);
  assert.equal(signals.terminateRequested, false);
});

test('an orphaned event host can safely reattach to the live Codex profile channel', async () => {
  const profilePath = path.join(os.tmpdir(), `wukong-event-host-reattach-${process.pid}-${Date.now()}`);
  fs.mkdirSync(profilePath, { recursive: false });
  fs.writeFileSync(
    path.join(profilePath, 'DevToolsActivePort'),
    '17775\n/devtools/browser/live-codex\n',
    { encoding: 'utf8', flag: 'wx' }
  );

  const reusable = await findReusableDevToolsPort({
    profilePath,
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Chrome/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17775/devtools/browser/live-codex'
      }),
      getTargets: async () => [{ id: 'page-1', type: 'page', url: 'app://-/index.html' }],
      isCodexTarget: () => true
    }
  });

  assert.deepEqual(reusable, {
    port: 17775,
    identity: 'Chrome/test\nws://127.0.0.1:17775/devtools/browser/live-codex',
    targets: 1
  });
});

test('event watcher is bound to the browser channel rather than the Store relay PID', async () => {
  const runRoot = path.join(os.tmpdir(), `wukong-event-host-channel-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: false });
  const markerPath = path.join(runRoot, 'package.json');
  fs.writeFileSync(markerPath, '{"name":"wukong-codex-theme"}\n', { encoding: 'utf8', flag: 'wx' });
  const signals = createHostSignals();
  const never = new Promise(() => {});
  let themed = false;

  const result = await runEventWatcher({
    port: 17774,
    expression: 'APPLY',
    disableRequest: '',
    rootPid: null,
    markerPath,
    signals,
    rootExit: Promise.resolve({ code: 0, signal: null }),
    onReady: () => { signals.requestTerminate(); },
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Chrome/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17774/devtools/browser/stable'
      }),
      getTargets: async () => [{ id: 'page-1', type: 'page', url: 'app://-/index.html' }],
      isCodexTarget: () => true,
      connectBrowserEvents: async () => ({
        closed: never,
        command: async () => ({}),
        close: () => {}
      }),
      evaluateTarget: async (_target, expression) => {
        if (expression === 'APPLY') {
          themed = true;
          return true;
        }
        if (expression === ACTIVE_PROBE_EXPRESSION) return themed;
        if (expression === THEME_STATE_EXPRESSION) return themed ? activeState : nativeState;
        if (expression === RESTORE_EXPRESSION) {
          themed = false;
          return true;
        }
        throw Error(`Unexpected expression: ${expression.slice(0, 24)}`);
      },
      targetSettleMs: 0,
      log: () => {}
    }
  });

  assert.equal(result.reason, 'terminated-verified');
  assert.equal(themed, false);
});

test('event watcher applies once, verifies active state, and restores before disable completes', async () => {
  const runRoot = path.join(os.tmpdir(), `wukong-event-host-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: false });
  const markerPath = path.join(runRoot, 'package.json');
  fs.writeFileSync(markerPath, '{"name":"wukong-codex-theme"}\n', { encoding: 'utf8', flag: 'wx' });

  const target = { id: 'page-1', type: 'page', url: 'app://codex/index.html' };
  const commands = [];
  let themed = false;
  let applyCount = 0;
  let restoreCount = 0;
  let closeCount = 0;
  const signals = createHostSignals();
  const never = new Promise(() => {});

  const result = await runEventWatcher({
    port: 17777,
    expression: 'APPLY',
    disableRequest: '',
    rootPid: process.pid,
    markerPath,
    signals,
    rootExit: never,
    onReady: () => { void signals.requestDisable(); },
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Codex/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17777/devtools/browser/stable'
      }),
      getTargets: async () => [target],
      isCodexTarget: () => true,
      connectBrowserEvents: async () => ({
        closed: never,
        command: async (method, params) => { commands.push({ method, params }); return {}; },
        close: () => { closeCount += 1; }
      }),
      evaluateTarget: async (_target, expression) => {
        if (expression === 'APPLY') {
          applyCount += 1;
          themed = true;
          return true;
        }
        if (expression === ACTIVE_PROBE_EXPRESSION) return themed;
        if (expression === RESTORE_EXPRESSION) {
          restoreCount += 1;
          themed = false;
          return true;
        }
        if (expression === THEME_STATE_EXPRESSION) return themed ? activeState : nativeState;
        throw Error(`Unexpected expression: ${expression.slice(0, 24)}`);
      },
      targetSettleMs: 0,
      log: () => {}
    }
  });

  assert.equal(result.reason, 'disabled-verified');
  assert.equal(result.targets, 1);
  assert.equal(result.deferredNative, false);
  assert.equal(applyCount, 1);
  assert.equal(restoreCount, 1);
  assert.equal(themed, false);
  assert.ok(closeCount >= 1);
  assert.deepEqual(commands.map(entry => entry.method), [
    'Target.setDiscoverTargets',
    'Target.setAutoAttach'
  ]);
});

test('removing the repository marker restores the live ChatGPT renderer before the host exits', async () => {
  const runRoot = path.join(os.tmpdir(), `wukong-repository-removal-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: false });
  const markerPath = path.join(runRoot, 'package.json');
  fs.writeFileSync(markerPath, '{"name":"wukong-codex-theme"}\n', { encoding: 'utf8', flag: 'wx' });
  let markerPresent = true;
  let themed = false;
  const never = new Promise(() => {});

  const result = await runEventWatcher({
    port: 17773,
    expression: 'APPLY',
    disableRequest: '',
    rootPid: null,
    markerPath,
    signals: createHostSignals(),
    onReady: () => {
      markerPresent = false;
      fs.writeFileSync(path.join(runRoot, 'repository-removed.signal'), 'removed\n', { encoding: 'utf8', flag: 'wx' });
    },
    dependencies: {
      existsSync: candidate => candidate === markerPath ? markerPresent : fs.existsSync(candidate),
      getBrowserVersion: async () => ({
        Browser: 'Codex/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17773/devtools/browser/stable'
      }),
      getTargets: async () => [{ id: 'page-1', type: 'page', url: 'app://codex/index.html' }],
      isCodexTarget: () => true,
      connectBrowserEvents: async () => ({
        closed: never,
        command: async () => ({}),
        close: () => {}
      }),
      evaluateTarget: async (_target, expression) => {
        if (expression === 'APPLY') { themed = true; return true; }
        if (expression === ACTIVE_PROBE_EXPRESSION) return themed;
        if (expression === THEME_STATE_EXPRESSION) return themed ? activeState : nativeState;
        if (expression === RESTORE_EXPRESSION) { themed = false; return true; }
        throw Error(`Unexpected expression: ${expression.slice(0, 24)}`);
      },
      targetSettleMs: 0,
      log: () => {}
    }
  });

  assert.equal(result.reason, 'theme-removed-verified');
  assert.equal(result.targets, 1);
  assert.equal(themed, false);
});

test('disable fails closed when native restoration cannot be verified', async () => {
  const runRoot = path.join(os.tmpdir(), `wukong-event-host-fail-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: false });
  const markerPath = path.join(runRoot, 'package.json');
  fs.writeFileSync(markerPath, '{"name":"wukong-codex-theme"}\n', { encoding: 'utf8', flag: 'wx' });
  const signals = createHostSignals();
  const never = new Promise(() => {});
  let disablePromise;

  const result = await runEventWatcher({
    port: 17778,
    expression: 'APPLY',
    disableRequest: '',
    rootPid: process.pid,
    markerPath,
    signals,
    rootExit: never,
    onReady: () => { disablePromise = signals.requestDisable(); },
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Codex/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17778/devtools/browser/stable'
      }),
      getTargets: async () => [{ id: 'page-1', type: 'page', url: 'app://codex/index.html' }],
      isCodexTarget: () => true,
      connectBrowserEvents: async () => ({
        closed: never,
        command: async () => ({}),
        close: () => {}
      }),
      evaluateTarget: async (_target, expression) => {
        if (expression === ACTIVE_PROBE_EXPRESSION) return true;
        if (expression === THEME_STATE_EXPRESSION) return activeState;
        if (expression === RESTORE_EXPRESSION) throw Error('restore refused');
        return true;
      },
      targetSettleMs: 0,
      log: () => {}
    }
  });

  assert.equal(result.reason, 'native-restore-failed');
  assert.match(result.error, /restore refused/);
  await assert.rejects(disablePromise, /restore refused/);
});

test('event watcher retries a deferred large apply and reports bounded renderer phases', async () => {
  const runRoot = path.join(os.tmpdir(), `wukong-event-host-retry-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: false });
  const markerPath = path.join(runRoot, 'package.json');
  fs.writeFileSync(markerPath, '{"name":"wukong-codex-theme"}\n', { encoding: 'utf8', flag: 'wx' });
  const signals = createHostSignals();
  const never = new Promise(() => {});
  const phases = [];
  let applyCount = 0;
  let themed = false;

  const result = await runEventWatcher({
    port: 17779,
    expression: 'APPLY',
    disableRequest: '',
    rootPid: process.pid,
    markerPath,
    signals,
    rootExit: never,
    onReady: () => { signals.requestTerminate(); },
    onProgress: progress => phases.push(progress.phase),
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Codex/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17779/devtools/browser/stable'
      }),
      getTargets: async () => [{ id: 'page-1', type: 'page', url: 'app://codex/index.html' }],
      isCodexTarget: () => true,
      connectBrowserEvents: async () => ({
        closed: never,
        command: async () => ({}),
        close: () => {}
      }),
      evaluateTarget: async (_target, expression) => {
        if (expression === 'APPLY') {
          applyCount += 1;
          if (applyCount === 1) throw Error('renderer navigated during apply');
          themed = true;
          return true;
        }
        if (expression === ACTIVE_PROBE_EXPRESSION) return themed;
        if (expression === THEME_STATE_EXPRESSION) return themed ? activeState : nativeState;
        if (expression === RESTORE_EXPRESSION) {
          themed = false;
          return true;
        }
        throw Error(`Unexpected expression: ${expression.slice(0, 24)}`);
      },
      targetSettleMs: 0,
      delay: async () => {},
      log: () => {}
    }
  });

  assert.equal(result.reason, 'terminated-verified');
  assert.equal(applyCount, 2);
  assert.ok(phases.includes('renderer-applying'));
  assert.ok(phases.includes('reconcile-deferred'));
  assert.ok(phases.includes('renderer-verified'));
});

test('event watcher remains dormant until a delayed renderer appears', async () => {
  const runRoot = path.join(os.tmpdir(), `wukong-event-host-delayed-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: false });
  const markerPath = path.join(runRoot, 'package.json');
  fs.writeFileSync(markerPath, '{"name":"wukong-codex-theme"}\n', { encoding: 'utf8', flag: 'wx' });
  const signals = createHostSignals();
  const never = new Promise(() => {});
  const target = { id: 'page-delayed', type: 'page', url: 'app://codex/index.html' };
  let rendererVisible = false;
  let themed = false;
  let browserEvent;

  const resultPromise = runEventWatcher({
    port: 17780,
    expression: 'APPLY',
    disableRequest: '',
    rootPid: process.pid,
    markerPath,
    signals,
    rootExit: never,
    onReady: () => { signals.requestTerminate(); },
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Codex/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17780/devtools/browser/stable'
      }),
      getTargets: async () => rendererVisible ? [target] : [],
      isCodexTarget: () => true,
      connectBrowserEvents: async (_endpoint, onEvent) => {
        browserEvent = onEvent;
        return {
          closed: never,
          command: async () => ({}),
          close: () => {}
        };
      },
      evaluateTarget: async (_target, expression) => {
        if (expression === 'APPLY') {
          themed = true;
          return true;
        }
        if (expression === ACTIVE_PROBE_EXPRESSION) return themed;
        if (expression === THEME_STATE_EXPRESSION) return themed ? activeState : nativeState;
        if (expression === RESTORE_EXPRESSION) {
          themed = false;
          return true;
        }
        throw Error(`Unexpected expression: ${expression.slice(0, 24)}`);
      },
      targetSettleMs: 0,
      log: () => {}
    }
  });

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(themed, false);
  rendererVisible = true;
  browserEvent({ method: 'Target.targetCreated', params: { targetInfo: target } }, { command: async () => ({}) });
  const result = await resultPromise;

  assert.equal(result.reason, 'terminated-verified');
  assert.equal(themed, false);
});

test('bounded startup probes recover a delayed renderer when the browser emits no target event', async () => {
  const runRoot = path.join(os.tmpdir(), `wukong-event-host-probe-${process.pid}-${Date.now()}`);
  fs.mkdirSync(runRoot, { recursive: false });
  const markerPath = path.join(runRoot, 'package.json');
  fs.writeFileSync(markerPath, '{"name":"wukong-codex-theme"}\n', { encoding: 'utf8', flag: 'wx' });
  const signals = createHostSignals();
  const never = new Promise(() => {});
  const target = { id: 'page-probed', type: 'page', url: 'app://codex/index.html' };
  let targetReads = 0;
  let themed = false;

  const result = await runEventWatcher({
    port: 17781,
    expression: 'APPLY',
    disableRequest: '',
    rootPid: process.pid,
    markerPath,
    signals,
    onReady: () => { signals.requestTerminate(); },
    dependencies: {
      getBrowserVersion: async () => ({
        Browser: 'Codex/test',
        webSocketDebuggerUrl: 'ws://127.0.0.1:17781/devtools/browser/stable'
      }),
      getTargets: async () => (++targetReads >= 2 ? [target] : []),
      isCodexTarget: () => true,
      connectBrowserEvents: async () => ({
        closed: never,
        command: async () => ({}),
        close: () => {}
      }),
      evaluateTarget: async (_target, expression) => {
        if (expression === 'APPLY') { themed = true; return true; }
        if (expression === ACTIVE_PROBE_EXPRESSION) return themed;
        if (expression === THEME_STATE_EXPRESSION) return themed ? activeState : nativeState;
        if (expression === RESTORE_EXPRESSION) { themed = false; return true; }
        throw Error(`Unexpected expression: ${expression.slice(0, 24)}`);
      },
      startupTargetProbeDelays: [1],
      targetSettleMs: 0,
      log: () => {}
    }
  });

  assert.ok(targetReads >= 2);
  assert.ok(targetReads <= 3);
  assert.equal(result.reason, 'terminated-verified');
  assert.equal(themed, false);
});
