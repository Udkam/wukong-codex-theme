import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { getBrowserVersion, getTargets, evaluateTarget, isCodexTarget } from './cdp-client.mjs';
import { payloadFromThemeFile } from './forge-runtime.mjs';
import {
  ACTIVE_PROBE_EXPRESSION,
  isNativeThemeState,
  makeApplyExpression,
  RESTORE_EXPRESSION,
  THEME_STATE_EXPRESSION
} from './injection-plan-v13.mjs';

const DEFAULT_INTERVAL_MS = 1700;
const DEFAULT_PROBE = ACTIVE_PROBE_EXPRESSION;

export const browserIdentity = version => {
  const endpoint = String(version?.webSocketDebuggerUrl || '');
  if (!/^ws:\/\/127\.0\.0\.1(?::\d+)?\//.test(endpoint)) {
    throw Error('Refusing an invalid or non-loopback browser identity');
  }
  return `${String(version?.Browser || '')}\n${endpoint}`;
};

export const isProcessAlive = pid => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
};

const writeDisableConfirmation = ({ disableRequest, port, rootPid, targets, states, deferredNative }) => {
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

export async function runWatcher({
  port,
  themePath,
  disableRequest,
  rootPid,
  expression,
  probe = DEFAULT_PROBE,
  intervalMs = DEFAULT_INTERVAL_MS,
  dependencies = {}
}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Port must be 1024..65535');
  if (!Number.isInteger(rootPid) || rootPid <= 0) throw Error('ChatGPT root PID must be a positive integer');

  const versionFor = dependencies.getBrowserVersion || getBrowserVersion;
  const targetsFor = dependencies.getTargets || getTargets;
  const evaluate = dependencies.evaluateTarget || evaluateTarget;
  const targetMatches = dependencies.isCodexTarget || isCodexTarget;
  const rootIsAlive = dependencies.isProcessAlive || isProcessAlive;
  const pause = dependencies.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const log = dependencies.log || (message => console.log(message));
  const shouldStop = dependencies.shouldStop || (() => false);

  let expectedBrowserIdentity = null;
  let everConnected = false;
  let retryCount = 0;

  while (!shouldStop()) {
    const rootAlive = rootIsAlive(rootPid);
    if (!rootAlive) {
      log(`ChatGPT root process ${rootPid} exited; watcher is ending.`);
      return { reason: 'root-exited', everConnected, retryCount };
    }

    try {
      const version = await versionFor(port);
      const currentIdentity = browserIdentity(version);
      if (expectedBrowserIdentity === null) expectedBrowserIdentity = currentIdentity;
      else if (currentIdentity !== expectedBrowserIdentity) {
        const error = Error('The loopback port now belongs to a different browser instance; refusing cross-process injection');
        error.code = 'WUKONG_BROWSER_IDENTITY_CHANGED';
        throw error;
      }

      everConnected = true;
      retryCount = 0;
      const targets = (await targetsFor(port)).filter(targetMatches);
      const disableRequested = Boolean(disableRequest && fs.existsSync(disableRequest));

      if (disableRequested) {
        if (!targets.length) {
          const confirmation = writeDisableConfirmation({
            disableRequest,
            port,
            rootPid,
            targets: 0,
            states: [],
            deferredNative: true
          });
          log('Wukong watcher disabled while no renderer was visible; the next renderer will remain native.');
          return { reason: 'disabled-no-renderer', confirmation, targets: 0 };
        }

        await Promise.all(targets.map(target => evaluate(target, RESTORE_EXPRESSION)));
        const states = await Promise.all(targets.map(target => evaluate(target, THEME_STATE_EXPRESSION)));
        if (!states.every(isNativeThemeState)) {
          throw Error('Disable requested, but native renderer state was not verified');
        }
        const confirmation = writeDisableConfirmation({
          disableRequest,
          port,
          rootPid,
          targets: targets.length,
          states,
          deferredNative: false
        });
        log(`Wukong style restored and verified on ${targets.length} native surface(s).`);
        return { reason: 'disabled-verified', confirmation, targets: targets.length };
      }

      // Closing the last window does not end the official Electron root process.
      // Keep waiting through an unlimited renderer-free tray interval; a new page
      // receives the complete theme as soon as it appears again.
      if (!targets.length) {
        await pause(intervalMs);
        continue;
      }

      for (const target of targets) {
        const active = await evaluate(target, probe).catch(() => false);
        if (!active) await evaluate(target, expression);
      }
      await pause(intervalMs);
    } catch (error) {
      if (error?.code === 'WUKONG_BROWSER_IDENTITY_CHANGED') throw error;
      retryCount += 1;
      if (!rootIsAlive(rootPid)) {
        log(`ChatGPT root process ${rootPid} exited after a channel disconnect; watcher is ending.`);
        return { reason: 'root-exited-after-disconnect', everConnected, retryCount };
      }
      // A live Electron root can briefly recreate its renderer or CDP transport.
      // Retrying is bounded by the root process lifetime, never by an arbitrary
      // empty-target counter.
      await pause(Math.min(intervalMs, everConnected ? 900 : 700));
    }
  }

  return { reason: 'signal', everConnected, retryCount };
}

async function main() {
  const [,, portRaw, providedTheme, disableRequest, rootPidRaw] = process.argv;
  const port = Number(portRaw);
  const rootPid = Number(rootPidRaw);
  const themePath = providedTheme || 'themes/active.json';
  const expression = makeApplyExpression({
    styleSheet: fs.readFileSync(new URL('./wukong-codex-theme-background-v13.css', import.meta.url), 'utf8'),
    variables: payloadFromThemeFile(themePath).variables
  });
  let stopping = false;
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });

  const result = await runWatcher({
    port,
    themePath,
    disableRequest,
    rootPid,
    expression,
    dependencies: { shouldStop: () => stopping }
  });
  console.log(`Wukong style watcher stopped: ${result.reason}.`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  await main();
}
