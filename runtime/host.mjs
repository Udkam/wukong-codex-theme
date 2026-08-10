import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { getBrowserVersion, getTargets, evaluateTarget, isCodexTarget } from './cdp-client.mjs';
import { payloadFromThemeFile } from './forge-runtime.mjs';
import {
  ACTIVE_PROBE_EXPRESSION,
  isActiveThemeState,
  isNativeThemeState,
  makeApplyExpression,
  RESTORE_EXPRESSION,
  THEME_STATE_EXPRESSION
} from './injection-plan-v13.mjs';

export const HOST_MARKER = 'WukongCodexForgeEventHostV1';
const CONTROL_TIMEOUT_MS = 12_000;
const STARTUP_TIMEOUT_MS = 45_000;
const INITIAL_TARGET_SETTLE_MS = 650;
const EVENT_CHANNEL_DISCONNECT_GRACE_MS = 4_000;
const STARTUP_TARGET_PROBE_DELAYS_MS = [120, 280, 650, 1_200, 2_400, 4_800];

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const normalizePath = value => path.resolve(String(value || ''));

const assertDirectPath = (candidate, label, { allowMissing = false } = {}) => {
  const resolved = normalizePath(candidate);
  const parsed = path.parse(resolved);
  let cursor = parsed.root;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) {
      if (allowMissing) return resolved;
      throw Error(`${label} is missing: ${cursor}`);
    }
    if (fs.lstatSync(cursor).isSymbolicLink()) {
      throw Error(`${label} passes through a symbolic link or junction: ${cursor}`);
    }
  }
  return resolved;
};

export const parseHostArgs = argv => {
  const values = { portable: false, repository: false, signalDisable: false };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === '--portable') values.portable = true;
    else if (flag === '--repository') values.repository = true;
    else if (flag === '--signal-disable') values.signalDisable = true;
    else if (flag === '--root' && argv[index + 1]) values.root = argv[++index];
    else if (flag === '--appx-activator' && argv[index + 1]) values.appxActivator = argv[++index];
    else if (flag === '--appx-aumid' && argv[index + 1]) values.appxAumid = argv[++index];
    else if (flag === '--appx-package' && argv[index + 1]) values.appxPackage = argv[++index];
    else if (flag === '--appx-version' && argv[index + 1]) values.appxVersion = argv[++index];
    else if (flag === '--appx-executable' && argv[index + 1]) values.appxExecutable = argv[++index];
    else throw Error(`Unknown or incomplete host argument: ${flag}`);
  }
  if (!values.root) throw Error('Use --root DIR [--repository|--portable|--signal-disable].');
  if (values.portable && values.repository) {
    throw Error('Repository and portable modes are mutually exclusive.');
  }
  return values;
};

export const deriveOfficialPaths = (nodePath = process.execPath) => {
  const embeddedNode = normalizePath(nodePath);
  const appRoot = path.resolve(path.dirname(embeddedNode), '..', '..', '..');
  return {
    embeddedNode,
    appRoot,
    chatGpt: path.join(appRoot, 'ChatGPT.exe')
  };
};

export const repositoryStateRoot = ({ root, env = process.env }) => {
  const rootPath = normalizePath(root);
  const localAppData = env.LOCALAPPDATA || path.join(
    env.USERPROFILE || os.homedir(),
    'AppData',
    'Local'
  );
  const repositoryId = crypto
    .createHash('sha256')
    .update(rootPath.toLowerCase())
    .digest('hex')
    .slice(0, 24);
  return normalizePath(path.join(localAppData, 'WukongCodexForge', 'repository-state', repositoryId));
};

export const resolveHostPaths = ({
  root,
  portable = false,
  repository = false,
  appxActivator = null,
  appxAumid = null,
  appxPackage = null,
  appxVersion = null,
  appxExecutable = null,
  env = process.env
}) => {
  const rootPath = normalizePath(root);
  const stateRoot = portable
    ? path.join(rootPath, '.wukong-runtime')
    : repository
      ? repositoryStateRoot({ root: rootPath, env })
      : path.join(env.USERPROFILE || os.homedir(), '.codex', 'themes', 'wukong-codex-forge');
  const profilePath = portable
    ? path.join(stateRoot, 'profile')
    : path.join(env.APPDATA || path.join(env.USERPROFILE || os.homedir(), 'AppData', 'Roaming'), 'Codex', 'web', 'Codex');
  return {
    rootPath,
    stateRoot: normalizePath(stateRoot),
    profilePath: normalizePath(profilePath),
    requestDirectory: normalizePath(path.join(stateRoot, 'requests')),
    eventPath: normalizePath(path.join(stateRoot, 'runtime-events.jsonl')),
    markerPath: normalizePath(path.join(rootPath, 'package.json')),
    themePath: normalizePath(path.join(rootPath, 'themes', 'active.json')),
    stylePath: normalizePath(path.join(rootPath, 'runtime', 'forge-background-v13.css')),
    appxActivatorPath: appxActivator ? normalizePath(appxActivator) : null,
    appxAumid: appxAumid ? String(appxAumid) : null,
    appxPackage: appxPackage ? String(appxPackage) : null,
    appxVersion: appxVersion ? String(appxVersion) : null,
    appxExecutable: appxExecutable ? normalizePath(appxExecutable) : null
  };
};

export const controlPipeName = stateRoot => {
  const digest = crypto.createHash('sha256').update(normalizePath(stateRoot).toLowerCase()).digest('hex').slice(0, 24);
  return `\\\\.\\pipe\\WukongCodexForge-${digest}`;
};

const encodeLine = value => `${JSON.stringify(value)}\n`;

export const sendControl = (pipeName, request, { timeoutMs = CONTROL_TIMEOUT_MS } = {}) => new Promise((resolve, reject) => {
  const socket = net.createConnection(pipeName);
  let settled = false;
  let buffer = '';
  const timeout = setTimeout(() => finish(Error('Wukong lifecycle host control timed out')), timeoutMs);
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    socket.destroy();
    if (error) reject(error);
    else resolve(value);
  };
  socket.setEncoding('utf8');
  socket.once('connect', () => socket.write(encodeLine(request)));
  socket.on('data', chunk => {
    buffer += chunk;
    const newline = buffer.indexOf('\n');
    if (newline < 0) return;
    try {
      const response = JSON.parse(buffer.slice(0, newline));
      if (response?.ok) finish(null, response);
      else finish(Error(response?.error || 'Wukong lifecycle host rejected the request'));
    } catch (error) {
      finish(error);
    }
  });
  socket.once('error', finish);
  socket.once('close', () => {
    if (!settled) finish(Error('Wukong lifecycle host closed the control channel without a response'));
  });
});

export const browserIdentity = version => {
  const endpoint = String(version?.webSocketDebuggerUrl || '');
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\/devtools\/browser\//.test(endpoint)) {
    throw Error('Refusing an invalid or non-loopback browser identity');
  }
  return `${String(version?.Browser || '')}\n${endpoint}`;
};

const eventDataText = async data => {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8');
  if (data && typeof data.text === 'function') return data.text();
  return String(data);
};

export const connectBrowserEvents = (endpoint, onEvent, {
  WebSocketImpl = globalThis.WebSocket,
  timeoutMs = 10_000
} = {}) => new Promise((resolve, reject) => {
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\/devtools\/browser\//.test(String(endpoint || ''))) {
    reject(Error('Refusing a non-loopback browser event endpoint'));
    return;
  }
  if (typeof WebSocketImpl !== 'function') {
    reject(Error('The Codex embedded Node runtime does not provide WebSocket'));
    return;
  }

  const socket = new WebSocketImpl(endpoint);
  const pending = new Map();
  let nextId = 1;
  let opened = false;
  let closedResolve;
  const closed = new Promise(resolveClosed => { closedResolve = resolveClosed; });
  const openingTimeout = setTimeout(() => {
    try { socket.close(); } catch { }
    reject(Error('Timed out opening the browser event endpoint'));
  }, timeoutMs);

  const failPending = error => {
    for (const entry of pending.values()) {
      clearTimeout(entry.timeout);
      entry.reject(error);
    }
    pending.clear();
  };

  const client = {
    closed,
    command(method, params = {}, sessionId = undefined) {
      if (!opened || socket.readyState !== WebSocketImpl.OPEN) {
        return Promise.reject(Error('Browser event endpoint is not open'));
      }
      const id = nextId++;
      return new Promise((resolveCommand, rejectCommand) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectCommand(Error(`Browser event command timed out: ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve: resolveCommand, reject: rejectCommand, timeout });
        try {
          socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        } catch (error) {
          clearTimeout(timeout);
          pending.delete(id);
          rejectCommand(error);
        }
      });
    },
    close() {
      try { socket.close(); } catch { }
    }
  };

  socket.addEventListener('open', () => {
    opened = true;
    clearTimeout(openingTimeout);
    resolve(client);
  }, { once: true });
  socket.addEventListener('message', async event => {
    let message;
    try { message = JSON.parse(await eventDataText(event.data)); }
    catch { return; }
    if (Number.isInteger(message.id)) {
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timeout);
      if (message.error) entry.reject(Error(message.error.message || 'Browser event command failed'));
      else entry.resolve(message.result);
      return;
    }
    if (message.method) onEvent?.(message, client);
  });
  socket.addEventListener('error', () => {
    if (!opened) {
      clearTimeout(openingTimeout);
      reject(Error('Browser event WebSocket failed before opening'));
    }
  }, { once: true });
  socket.addEventListener('close', () => {
    clearTimeout(openingTimeout);
    failPending(Error('Browser event endpoint closed'));
    closedResolve();
  }, { once: true });
});

export const createHostSignals = () => {
  const events = new EventEmitter();
  let disableRequested = false;
  let terminateRequested = false;
  let disabledResolve;
  let disabledReject;
  const disabled = new Promise((resolve, reject) => {
    disabledResolve = resolve;
    disabledReject = reject;
  });
  return {
    get disableRequested() { return disableRequested; },
    get terminateRequested() { return terminateRequested; },
    disabled,
    subscribe(listener) {
      events.on('change', listener);
      return () => events.off('change', listener);
    },
    requestDisable() {
      disableRequested = true;
      events.emit('change');
      return disabled;
    },
    requestTerminate() {
      terminateRequested = true;
      events.emit('change');
    },
    requestRefresh() {
      events.emit('change');
    },
    confirmDisabled(result) { disabledResolve(result); },
    failDisabled(error) { disabledReject(error); }
  };
};

const writeDisableConfirmation = ({ disableRequest, port, rootPid, targets, states, deferredNative }) => {
  if (!disableRequest) return null;
  const confirmation = `${disableRequest}.confirmed.json`;
  const record = {
    at: new Date().toISOString(),
    port,
    rootPid,
    targets,
    states,
    deferredNative: Boolean(deferredNative)
  };
  if (!fs.existsSync(confirmation)) {
    fs.writeFileSync(confirmation, `${JSON.stringify(record)}\n`, { encoding: 'utf8', flag: 'wx' });
  } else {
    JSON.parse(fs.readFileSync(confirmation, 'utf8'));
  }
  return confirmation;
};

export async function runEventWatcher({
  port,
  expression,
  disableRequest,
  rootPid,
  markerPath,
  signals,
  onReady = () => {},
  onProgress = () => {},
  dependencies = {}
}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Port must be 1024..65535');
  if (rootPid !== null && (!Number.isInteger(rootPid) || rootPid <= 0)) {
    throw Error('ChatGPT launch PID must be positive when present');
  }
  if (!signals?.subscribe) throw Error('Lifecycle host signals are required');

  const versionFor = dependencies.getBrowserVersion || getBrowserVersion;
  const targetsFor = dependencies.getTargets || getTargets;
  const evaluate = dependencies.evaluateTarget || evaluateTarget;
  const targetMatches = dependencies.isCodexTarget || isCodexTarget;
  const connect = dependencies.connectBrowserEvents || connectBrowserEvents;
  const exists = dependencies.existsSync || fs.existsSync;
  const confirmDisable = dependencies.writeDisableConfirmation || writeDisableConfirmation;
  const pause = dependencies.delay || delay;
  const log = dependencies.log || (message => console.log(message));
  const targetSettleMs = dependencies.targetSettleMs ?? INITIAL_TARGET_SETTLE_MS;
  const disconnectGraceMs = dependencies.disconnectGraceMs ?? EVENT_CHANNEL_DISCONNECT_GRACE_MS;
  const connectionStartupTimeoutMs = dependencies.connectionStartupTimeoutMs ?? STARTUP_TIMEOUT_MS;
  const startupTargetProbeDelays = dependencies.startupTargetProbeDelays ?? STARTUP_TARGET_PROBE_DELAYS_MS;
  const setTimer = dependencies.setTimeout || setTimeout;
  const clearTimer = dependencies.clearTimeout || clearTimeout;
  const now = dependencies.now || Date.now;

  let expectedIdentity = null;
  let client = null;
  let stopped = false;
  let stopResult = null;
  let reconcileRunning = false;
  let reconcileQueued = false;
  let ready = false;
  let restorationInFlight = false;
  let disconnectedAt = now();
  let startupTargetProbeIndex = 0;
  let startupTargetProbeTimer = null;
  const settledTargets = new Set();
  let stopResolve;
  const stoppedPromise = new Promise(resolve => { stopResolve = resolve; });

  const finish = result => {
    if (stopped) return;
    stopped = true;
    stopResult = result;
    if (startupTargetProbeTimer !== null) {
      clearTimer(startupTargetProbeTimer);
      startupTargetProbeTimer = null;
    }
    try { client?.close(); } catch { }
    stopResolve(result);
  };

  const scheduleStartupTargetProbe = () => {
    if (ready || stopped || startupTargetProbeTimer !== null) return;
    if (startupTargetProbeIndex >= startupTargetProbeDelays.length) return;
    const waitMs = startupTargetProbeDelays[startupTargetProbeIndex++];
    startupTargetProbeTimer = setTimer(() => {
      startupTargetProbeTimer = null;
      if (!ready && !stopped) scheduleReconcile();
    }, waitMs);
    startupTargetProbeTimer?.unref?.();
  };

  const reconcile = async () => {
    if (stopped) return;
    if (reconcileRunning) {
      reconcileQueued = true;
      return;
    }
    reconcileRunning = true;
    try {
      do {
        reconcileQueued = false;
        const targets = (await targetsFor(port)).filter(targetMatches);
        onProgress({ phase: targets.length ? 'renderer-found' : 'waiting-for-renderer', targets: targets.length });
        const themeMissing = !exists(markerPath);
        const disableRequested = signals.disableRequested || Boolean(disableRequest && exists(disableRequest));
        const terminating = signals.terminateRequested;
        if (disableRequested || themeMissing || terminating) {
          restorationInFlight = true;
          if (!targets.length) {
            const result = {
              reason: disableRequested ? 'disabled-no-renderer' : themeMissing ? 'theme-removed-no-renderer' : 'terminated-no-renderer',
              confirmation: disableRequested ? confirmDisable({
                disableRequest,
                port,
                rootPid,
                targets: 0,
                states: [],
                deferredNative: true
              }) : null,
              targets: 0,
              deferredNative: true
            };
            if (disableRequested) signals.confirmDisabled(result);
            finish(result);
            return;
          }
          await Promise.all(targets.map(target => evaluate(target, RESTORE_EXPRESSION)));
          const states = await Promise.all(targets.map(target => evaluate(target, THEME_STATE_EXPRESSION)));
          if (!states.every(isNativeThemeState)) throw Error('Native renderer state was not verified before lifecycle host exit');
          const result = {
            reason: disableRequested ? 'disabled-verified' : themeMissing ? 'theme-removed-verified' : 'terminated-verified',
            confirmation: disableRequested ? confirmDisable({
              disableRequest,
              port,
              rootPid,
              targets: targets.length,
              states,
              deferredNative: false
            }) : null,
            targets: targets.length,
            deferredNative: false
          };
          if (disableRequested) signals.confirmDisabled(result);
          finish(result);
          return;
        }

        if (!targets.length) {
          scheduleStartupTargetProbe();
          continue;
        }
        const states = [];
        for (const target of targets) {
          let active = await evaluate(target, ACTIVE_PROBE_EXPRESSION).catch(() => false);
          if (!active) {
            if (targetSettleMs > 0 && !settledTargets.has(target.id)) {
              settledTargets.add(target.id);
              states.push(null);
              onProgress({ phase: 'renderer-settling', targets: targets.length });
              void pause(targetSettleMs).then(() => {
                if (!stopped) scheduleReconcile();
              });
              continue;
            }
            onProgress({ phase: 'renderer-applying', targets: targets.length });
            await evaluate(target, expression);
            active = await evaluate(target, ACTIVE_PROBE_EXPRESSION).catch(() => false);
          }
          states.push(active ? await evaluate(target, THEME_STATE_EXPRESSION) : null);
        }
        if (states.length && states.every(isActiveThemeState) && !ready) {
          ready = true;
          onProgress({ phase: 'renderer-verified', targets: states.length });
          onReady({ targets: states.length, states });
        }
      } while (reconcileQueued && !stopped);
    } catch (error) {
      const restorationRequired = restorationInFlight || signals.disableRequested || signals.terminateRequested;
      if (restorationRequired) {
        const result = {
          reason: 'native-restore-failed',
          error: error.message,
          targets: 0,
          deferredNative: false
        };
        if (signals.disableRequested) signals.failDisabled(error);
        finish(result);
      } else {
        onProgress({ phase: 'reconcile-deferred', targets: 0, error: error.message });
        log(`Wukong lifecycle reconcile deferred: ${error.message}`);
        void pause(320).then(() => {
          if (!stopped) scheduleReconcile();
        });
      }
    } finally {
      reconcileRunning = false;
      restorationInFlight = false;
    }
  };

  const scheduleReconcile = () => {
    reconcileQueued = true;
    queueMicrotask(() => { void reconcile(); });
  };
  const unsubscribe = signals.subscribe(scheduleReconcile);

  let requestWatch = null;
  let markerWatch = null;
  try {
    if (disableRequest) {
      fs.mkdirSync(path.dirname(disableRequest), { recursive: true });
      requestWatch = fs.watch(path.dirname(disableRequest), { persistent: false }, scheduleReconcile);
    }
    markerWatch = fs.watch(path.dirname(markerPath), { persistent: false }, scheduleReconcile);
  } catch (error) {
    unsubscribe();
    throw Error(`Unable to watch the managed lifecycle paths: ${error.message}`);
  }

  try {
    let reconnectDelay = 160;
    while (!stopped) {
      let version;
      try {
        version = await versionFor(port);
        const identity = browserIdentity(version);
        if (expectedIdentity === null) expectedIdentity = identity;
        else if (expectedIdentity !== identity) throw Error('The loopback port now belongs to a different browser instance');
        client = await connect(version.webSocketDebuggerUrl, (message, eventClient) => {
          if (message.method === 'Target.attachedToTarget') {
            const sessionId = message.params?.sessionId;
            const targetInfo = message.params?.targetInfo;
            if (sessionId && targetMatches(targetInfo)) {
              void eventClient.command('Runtime.enable', {}, sessionId).catch(() => {});
              void eventClient.command('Page.enable', {}, sessionId).catch(() => {});
            }
          }
          if (
            message.method?.startsWith('Target.') ||
            message.method === 'Page.frameNavigated' ||
            message.method === 'Runtime.executionContextCreated'
          ) scheduleReconcile();
        });
        await client.command('Target.setDiscoverTargets', { discover: true });
        await client.command('Target.setAutoAttach', {
          autoAttach: true,
          waitForDebuggerOnStart: false,
          flatten: true
        });
        disconnectedAt = null;
        reconnectDelay = 160;
        scheduleReconcile();
      } catch (error) {
        if (stopped) break;
        log(`Wukong lifecycle event channel waiting: ${error.message}`);
        if (expectedIdentity !== null && /different browser instance/.test(error.message)) {
          finish({ reason: 'browser-identity-changed', targets: 0 });
          break;
        }
        if (disconnectedAt === null) disconnectedAt = now();
        const disconnectedFor = now() - disconnectedAt;
        if (
          (expectedIdentity === null && disconnectedFor >= connectionStartupTimeoutMs) ||
          (expectedIdentity !== null && disconnectedFor >= disconnectGraceMs)
        ) {
          finish({
            reason: expectedIdentity === null ? 'event-channel-timeout' : 'browser-channel-closed',
            targets: 0
          });
          break;
        }
        await Promise.race([pause(reconnectDelay), stoppedPromise]);
        reconnectDelay = Math.min(900, Math.ceil(reconnectDelay * 1.7));
        continue;
      }

      const outcome = await Promise.race([
        client.closed.then(() => ({ type: 'channel-closed' })),
        stoppedPromise
      ]);
      if (stopped) break;
      if (outcome?.type !== 'channel-closed') continue;
      client = null;
      disconnectedAt = now();
      await pause(reconnectDelay);
      reconnectDelay = Math.min(900, Math.ceil(reconnectDelay * 1.7));
    }
  } finally {
    if (startupTargetProbeTimer !== null) clearTimer(startupTargetProbeTimer);
    unsubscribe();
    requestWatch?.close();
    markerWatch?.close();
    try { client?.close(); } catch { }
  }
  return stopResult || { reason: 'stopped', targets: 0 };
}

export const readDevToolsPort = ({ profilePath, notBefore = 0 }) => {
  const activePortPath = path.join(profilePath, 'DevToolsActivePort');
  try {
    const stat = fs.statSync(activePortPath);
    if (notBefore && stat.mtimeMs < notBefore - 1_000) return null;
    const port = Number(fs.readFileSync(activePortPath, 'utf8').split(/\r?\n/, 1)[0]);
    return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null;
  } catch { return null; }
};

export const waitForDevToolsPort = ({
  profilePath,
  notBefore = 0,
  timeoutMs = STARTUP_TIMEOUT_MS,
  signals = null
}) => {
  fs.mkdirSync(profilePath, { recursive: true });
  const current = readDevToolsPort({ profilePath, notBefore });
  if (current) return Promise.resolve(current);
  if (signals?.disableRequested || signals?.terminateRequested) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    let settled = false;
    let watcher = null;
    let timeout = null;
    let unsubscribe = null;
    const finish = (error, port) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      watcher?.close();
      unsubscribe?.();
      if (error) reject(error);
      else resolve(port);
    };
    watcher = fs.watch(profilePath, { persistent: false }, () => {
      const port = readDevToolsPort({ profilePath, notBefore });
      if (port) finish(null, port);
    });
    if (signals?.subscribe) {
      unsubscribe = signals.subscribe(() => {
        if (signals.disableRequested || signals.terminateRequested) finish(null, null);
      });
      if (signals.disableRequested || signals.terminateRequested) finish(null, null);
    }
    timeout = setTimeout(() => finish(Error('Timed out waiting for the managed loopback channel')), timeoutMs);
  });
};

export const findReusableDevToolsPort = async ({ profilePath, dependencies = {} }) => {
  const versionFor = dependencies.getBrowserVersion || getBrowserVersion;
  const targetsFor = dependencies.getTargets || getTargets;
  const targetMatches = dependencies.isCodexTarget || isCodexTarget;
  const port = readDevToolsPort({ profilePath });
  if (!port) return null;
  try {
    const version = await versionFor(port);
    const identity = browserIdentity(version);
    const targets = (await targetsFor(port)).filter(targetMatches);
    if (!targets.length) return null;
    return { port, identity, targets: targets.length };
  } catch {
    return null;
  }
};

const quoteWindowsArgument = value => {
  const argument = String(value);
  if (argument && !/[\s"]/u.test(argument)) return argument;
  let quoted = '"';
  let slashes = 0;
  for (const character of argument) {
    if (character === '\\') {
      slashes += 1;
      continue;
    }
    if (character === '"') {
      quoted += '\\'.repeat((slashes * 2) + 1) + '"';
      slashes = 0;
      continue;
    }
    quoted += '\\'.repeat(slashes) + character;
    slashes = 0;
  }
  return quoted + '\\'.repeat(slashes * 2) + '"';
};

export const appxArgumentLine = args => args.map(quoteWindowsArgument).join(' ');

export const activatePackagedChatGpt = ({
  helperPath,
  args,
  aumid,
  packageName,
  version,
  expectedExecutable,
  env = process.env,
  dependencies = {}
}) => {
  const run = dependencies.spawnSync || spawnSync;
  assertDirectPath(helperPath, 'Native AppX activation helper');
  assertDirectPath(expectedExecutable, 'Expected official ChatGPT executable');
  if (!/^[A-Za-z0-9._-]+![A-Za-z0-9._-]+$/u.test(String(aumid || ''))) {
    throw Error('Native AppX activation AUMID is invalid');
  }
  if (!String(packageName || '').trim() || !String(version || '').trim()) {
    throw Error('Native AppX activation package evidence is incomplete');
  }
  const argumentLine = appxArgumentLine(args || []);
  const argumentLineBase64 = Buffer.from(argumentLine, 'utf8').toString('base64');
  const result = run(helperPath, [
    '--aumid',
    aumid,
    '--expected-executable',
    expectedExecutable,
    '--package',
    packageName,
    '--version',
    version,
    '--arguments-base64',
    argumentLineBase64
  ], {
    encoding: 'utf8',
    env,
    timeout: 20_000,
    windowsHide: true
  });
  if (result.error) throw Error(`Official AppX activation failed: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim().slice(-1_200);
    throw Error(`Official AppX activation helper exited with ${result.status}${detail ? `: ${detail}` : ''}`);
  }
  const evidenceLine = String(result.stdout || '')
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .at(-1);
  let evidence;
  try {
    evidence = JSON.parse(evidenceLine || '');
  } catch {
    throw Error('Official AppX activation helper did not return JSON evidence');
  }
  const pid = Number(evidence.pid);
  const executableMatches = String(evidence.executable || '') &&
    normalizePath(evidence.executable).toLowerCase() === normalizePath(expectedExecutable).toLowerCase();
  if (
    !Number.isInteger(pid) || pid <= 0 ||
    String(evidence.aumid || '') !== String(aumid) ||
    String(evidence.package || '') !== String(packageName) ||
    String(evidence.version || '') !== String(version) ||
    !executableMatches
  ) {
    throw Error('Official AppX activation evidence is invalid');
  }
  return { ...evidence, pid };
};

const spawnOfficialActivation = ({ chatGpt, profilePath, portable, paths }) => {
  const args = [...(portable ? [`--user-data-dir=${profilePath}`] : []), 'codex://launch'];
  if (!portable) {
    return {
      ...activatePackagedChatGpt({
        helperPath: paths.appxActivatorPath,
        args,
        aumid: paths.appxAumid,
        packageName: paths.appxPackage,
        version: paths.appxVersion,
        expectedExecutable: paths.appxExecutable
      }),
      activationMode: 'native-appx-aumid'
    };
  }
  const child = spawn(chatGpt, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
    env: portable ? { ...process.env, CODEX_ELECTRON_USER_DATA_PATH: profilePath } : process.env
  });
  child.unref();
  return { pid: child.pid, activationMode: 'direct-portable' };
};

const writeRuntimeEvent = (eventPath, record) => {
  fs.mkdirSync(path.dirname(eventPath), { recursive: true });
  fs.appendFileSync(eventPath, `${JSON.stringify({ at: new Date().toISOString(), host: HOST_MARKER, ...record })}\n`, 'utf8');
};

const validateThemeRoot = ({ paths, portable, repository, official }) => {
  assertDirectPath(paths.rootPath, 'Theme root');
  for (const required of [
    paths.markerPath,
    paths.themePath,
    paths.stylePath,
    path.join(paths.rootPath, 'runtime', 'activate-appx.cs'),
    path.join(paths.rootPath, 'runtime', 'host.mjs')
  ]) {
    assertDirectPath(required, 'Managed lifecycle file');
  }
  const marker = JSON.parse(fs.readFileSync(paths.markerPath, 'utf8').replace(/^\uFEFF/, ''));
  if (marker.name !== 'wukong-codex-theme') throw Error('Theme package marker is invalid');
  if (!portable && !repository) {
    const releaseMarker = path.join(path.dirname(paths.rootPath), 'release.json');
    assertDirectPath(releaseMarker, 'Managed release marker');
  }
  if (!portable) {
    if (!paths.appxActivatorPath || !paths.appxExecutable) {
      throw Error('Native AppX activation paths are missing from the verified launcher bridge');
    }
    assertDirectPath(paths.appxActivatorPath, 'Compiled native AppX activator');
    assertDirectPath(paths.appxExecutable, 'Verified AppX executable');
    if (normalizePath(paths.appxExecutable).toLowerCase() !== normalizePath(official.chatGpt).toLowerCase()) {
      throw Error('Native AppX activation executable does not match the current official ChatGPT path');
    }
    if (!/^[A-Za-z0-9._-]+![A-Za-z0-9._-]+$/u.test(String(paths.appxAumid || ''))) {
      throw Error('Native AppX activation AUMID is invalid');
    }
    if (!String(paths.appxPackage || '').trim() || !String(paths.appxVersion || '').trim()) {
      throw Error('Native AppX activation package identity is incomplete');
    }
  }
  for (const candidate of [paths.stateRoot, paths.profilePath, paths.requestDirectory]) {
    assertDirectPath(candidate, 'Managed lifecycle path', { allowMissing: true });
  }
};

const createControlServer = ({ pipeName, activate, disable }) => {
  const server = net.createServer(socket => {
    socket.setEncoding('utf8');
    let buffer = '';
    socket.on('data', chunk => {
      buffer += chunk;
      const newline = buffer.indexOf('\n');
      if (newline < 0) return;
      const raw = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      void (async () => {
        try {
          const request = JSON.parse(raw);
          let result;
          if (request?.type === 'activate') result = await activate();
          else if (request?.type === 'disable') result = await disable();
          else throw Error('Unsupported lifecycle host request');
          socket.end(encodeLine({ ok: true, state: request.type, result: result ?? null }));
        } catch (error) {
          socket.end(encodeLine({ ok: false, error: error.message }));
        }
      })();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(pipeName, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
};

export async function runHost({
  root,
  portable = false,
  repository = false,
  signalDisable = false,
  appxActivator = null,
  appxAumid = null,
  appxPackage = null,
  appxVersion = null,
  appxExecutable = null
}) {
  const paths = resolveHostPaths({
    root,
    portable,
    repository,
    appxActivator,
    appxAumid,
    appxPackage,
    appxVersion,
    appxExecutable
  });
  const pipeName = controlPipeName(paths.stateRoot);
  if (signalDisable) {
    try { return await sendControl(pipeName, { type: 'disable' }); }
    catch (error) {
      if (/ENOENT|ECONNREFUSED|closed the control channel/.test(error.message)) {
        return { ok: true, state: 'not-running' };
      }
      throw error;
    }
  }

  try {
    const response = await sendControl(pipeName, { type: 'activate' }, { timeoutMs: 2_000 });
    return { reason: 'activated-existing-host', response };
  } catch (error) {
    if (!/ENOENT|ECONNREFUSED|closed the control channel/.test(error.message)) throw error;
  }

  const official = deriveOfficialPaths();
  assertDirectPath(official.embeddedNode, 'Codex embedded Node');
  assertDirectPath(official.chatGpt, 'Official ChatGPT executable');
  validateThemeRoot({ paths, portable, repository, official });
  fs.mkdirSync(paths.requestDirectory, { recursive: true });

  const signals = createHostSignals();
  let server;
  try {
    server = await createControlServer({
      pipeName,
      activate: async () => {
        const activation = spawnOfficialActivation({
          chatGpt: official.chatGpt,
          profilePath: paths.profilePath,
          portable,
          paths
        });
        signals.requestRefresh();
        return { reason: 'activation-requested', ...activation };
      },
      disable: async () => signals.requestDisable()
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      const response = await sendControl(pipeName, { type: 'activate' });
      return { reason: 'activated-racing-host', response };
    }
    throw error;
  }

  const session = crypto.randomUUID().replaceAll('-', '');
  const disableRequest = path.join(paths.requestDirectory, `disable-${session}.request`);
  const launchStarted = Date.now();
  const reusable = await findReusableDevToolsPort({ profilePath: paths.profilePath });
  let port = reusable?.port || null;
  let rootPid = null;
  let launchMode = 'reattached-live-channel';
  if (port) {
    const activation = spawnOfficialActivation({
      chatGpt: official.chatGpt,
      profilePath: paths.profilePath,
      portable,
      paths
    });
    rootPid = activation.pid;
    launchMode = activation.activationMode === 'native-appx-aumid'
      ? 'reactivated-official-appx'
      : 'reactivated-portable';
  } else {
    const args = [
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      ...(portable ? [`--user-data-dir=${paths.profilePath}`] : [])
    ];
    if (portable) {
      const child = spawn(official.chatGpt, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
        env: { ...process.env, CODEX_ELECTRON_USER_DATA_PATH: paths.profilePath }
      });
      rootPid = child.pid;
      launchMode = 'spawned-portable';
      if (!Number.isInteger(rootPid) || rootPid <= 0) throw Error('Official ChatGPT portable launch process did not start');
      child.unref();
    } else {
      const activation = activatePackagedChatGpt({
        helperPath: paths.appxActivatorPath,
        args,
        aumid: paths.appxAumid,
        packageName: paths.appxPackage,
        version: paths.appxVersion,
        expectedExecutable: paths.appxExecutable
      });
      rootPid = activation.pid;
      launchMode = 'activated-official-appx';
    }
  }

  writeRuntimeEvent(paths.eventPath, {
    session,
    state: port ? 'reattaching-event-host' : 'starting-event-host',
    appPath: paths.rootPath,
    profilePath: paths.profilePath,
    profileMode: portable ? 'isolated-portable' : 'native-default',
    sourceMode: repository ? 'repository-live' : portable ? 'portable' : 'retained-release',
    rootPid,
    hostPid: process.pid,
    disableRequest,
    pipeName,
    launchMode,
    ...(port ? { port } : {})
  });

  let watcherPromise;
  try {
    if (!port) {
      port = await waitForDevToolsPort({
        profilePath: paths.profilePath,
        notBefore: launchStarted,
        signals
      });
    }
    if (!port) {
      const result = {
        reason: signals.disableRequested ? 'disabled-before-channel' : 'terminated-before-channel',
        targets: 0,
        deferredNative: true
      };
      if (signals.disableRequested) signals.confirmDisabled(result);
      writeRuntimeEvent(paths.eventPath, {
        session,
        state: result.reason,
        appPath: paths.rootPath,
        profilePath: paths.profilePath,
        rootPid,
        hostPid: process.pid,
        disableRequest,
        targets: 0,
        deferredNative: true
      });
      return result;
    }
    const expression = makeApplyExpression({
      styleSheet: fs.readFileSync(paths.stylePath, 'utf8'),
      variables: payloadFromThemeFile(paths.themePath).variables
    });
    const reportedProgress = new Set();
    const reportProgress = progress => {
      const key = JSON.stringify(progress);
      if (reportedProgress.has(key)) return;
      reportedProgress.add(key);
      writeRuntimeEvent(paths.eventPath, {
        session,
        state: 'renderer-probe',
        phase: progress.phase,
        targets: progress.targets,
        ...(progress.error ? { error: progress.error } : {}),
        appPath: paths.rootPath,
        profilePath: paths.profilePath,
        rootPid,
        hostPid: process.pid,
        port
      });
    };
    let readyResolve;
    const ready = new Promise(resolve => { readyResolve = resolve; });
    watcherPromise = runEventWatcher({
      port,
      expression,
      disableRequest,
      rootPid,
      markerPath: paths.markerPath,
      signals,
      onReady: readyResolve,
      onProgress: reportProgress
    });
    const startup = await Promise.race([
      ready.then(proof => ({ type: 'ready', proof })),
      watcherPromise.then(result => ({ type: 'stopped', result }))
    ]);
    if (startup.type !== 'ready') {
      writeRuntimeEvent(paths.eventPath, {
        session,
        state: startup.result.reason,
        appPath: paths.rootPath,
        profilePath: paths.profilePath,
        rootPid,
        hostPid: process.pid,
        port,
        disableRequest,
        targets: startup.result.targets,
        deferredNative: startup.result.deferredNative
      });
      if (startup.result.error) {
        throw Error(`Lifecycle host stopped without verified native restoration: ${startup.result.error}`);
      }
      return startup.result;
    }
    writeRuntimeEvent(paths.eventPath, {
      session,
      state: 'watching-event-driven',
      appPath: paths.rootPath,
      profilePath: paths.profilePath,
      rootPid,
      hostPid: process.pid,
      port,
      disableRequest,
      targets: startup.proof.targets
    });
    process.once('SIGINT', () => signals.requestTerminate());
    process.once('SIGTERM', () => signals.requestTerminate());
    const result = await watcherPromise;
    writeRuntimeEvent(paths.eventPath, {
      session,
      state: result.reason,
      appPath: paths.rootPath,
      profilePath: paths.profilePath,
      rootPid,
      hostPid: process.pid,
      port,
      disableRequest,
      targets: result.targets,
      deferredNative: result.deferredNative
    });
    if (result.error) throw Error(`Lifecycle host stopped without verified native restoration: ${result.error}`);
    return result;
  } catch (error) {
    writeRuntimeEvent(paths.eventPath, {
      session,
      state: 'host-error',
      error: error instanceof Error ? error.message : String(error),
      appPath: paths.rootPath,
      profilePath: paths.profilePath,
      rootPid,
      hostPid: process.pid,
      ...(port ? { port } : {})
    });
    throw error;
  } finally {
    server.close();
    if (watcherPromise) await watcherPromise.catch(() => {});
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const result = await runHost(parseHostArgs(process.argv.slice(2)));
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
