import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const provenance = JSON.parse(fs.readFileSync(
  process.env.CODEX_BROWSER_PROVENANCE || new URL('../docs/native-browser-provenance.json', import.meta.url),
  'utf8'
));
const expectedArchive = path.join(
  process.env.ProgramFiles || 'C:\\Program Files',
  'WindowsApps', provenance.packageDirectoryName, provenance.asarRelativePath
);
const archive = process.env.CODEX_LOCAL_ASAR || expectedArchive;
const loadAsar = () => {
  try {
    return require('asar');
  } catch {
    try {
      return require(path.join(process.env.APPDATA || '', 'npm', 'node_modules', 'asar'));
    } catch {
      return null;
    }
  }
};
const asar = loadAsar();
const skipReason = !fs.existsSync(archive)
  ? 'the browser-audited local ChatGPT.exe app.asar is unavailable'
  : !asar ? 'the read-only asar module is unavailable' : false;

test('native in-app browser remains a body portal outside the app root', { skip: skipReason }, () => {
  const drift = 'native browser host contract drifted; re-audit browser-specific provenance without refreshing the general UI baseline';
  assert.equal(provenance.schemaVersion, 1, drift);
  assert.equal(provenance.scope, 'browser only', drift);
  assert.equal(provenance.packageDirectoryName,
    `OpenAI.Codex_${provenance.installationDirectoryVersion}_x64__2p2nqsd0c76g0`, drift);
  assert.equal(path.basename(path.dirname(path.dirname(path.dirname(archive)))),
    provenance.packageDirectoryName, drift);
  assert.equal(fs.statSync(archive).size, provenance.sizeBytes, drift);

  const read = member => asar.extractFile(archive, path.normalize(member));
  assert.equal(JSON.parse(read('package.json').toString('utf8')).version,
    provenance.internalPackageVersion, drift);
  const sources = {};
  for (const [name, asset] of Object.entries(provenance.assets)) {
    const bytes = read(asset.member);
    assert.equal(bytes.length, asset.bytes, `${drift}: ${asset.member} size`);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),
      asset.sha256.toLowerCase(), `${drift}: ${asset.member} hash`);
    sources[name] = bytes.toString('utf8');
  }
  const { javascript, stylesheet, entrypoint } = sources;
  assert.ok(javascript && stylesheet && entrypoint, drift);
  for (const name of ['javascript', 'stylesheet']) {
    assert.ok(entrypoint.includes(`./assets/${path.basename(provenance.assets[name].member)}`),
      `${drift}: audited browser asset is no longer referenced by the active entrypoint`);
  }

  // Contextual source checks deliberately avoid minified function names.
  // Asset hashes pin these audited declarations; an app update requires a
  // focused source audit rather than silently searching unrelated bundles.
  const outer = javascript.match(/function\s+[\w$]+\(\)\{[^{}]{0,600}data-embedded-frame-host-root[^{}]{0,600}\}/)?.[0];
  assert.ok(outer, `${drift}: embedded host declaration`);
  for (const token of ['document.querySelector(', 'document.createElement(',
    'embeddedFrameHostRoot=', 'pointer-events-none fixed inset-0 overflow-visible',
    'document.body.append(']) assert.ok(outer.includes(token), `${drift}: ${token}`);

  const host = javascript.match(/function\s+[\w$]+\(\)\{[^{}]{0,600}data-browser-host-root[^{}]{0,600}\}/)?.[0];
  assert.ok(host && host.includes('browserHostRoot=') &&
    host.includes('pointer-events-none fixed inset-0 [contain:paint]') &&
    host.includes('.append('), `${drift}: browser host declaration`);
  assert.ok(stylesheet.includes('.\\[contain\\:paint\\]{contain:paint}'), drift);

  const webviewOffset = javascript.indexOf('document.createElement(`webview`)');
  assert.ok(webviewOffset >= 0, `${drift}: native webview creation`);
  const webview = javascript.slice(Math.max(0, webviewOffset - 160), webviewOffset + 1450);
  for (const token of ['.dataset.browserSidebarWebview=', '.className=`h-full w-full`',
    '.setAttribute(`webviewrole`,`tab`)', '.append(']) {
    assert.ok(webview.includes(token), `${drift}: ${token}`);
  }
  const mount = javascript.match(/attachToDom\([\w$]+=[\w$]+\(\)\)\{.{0,350}/)?.[0];
  assert.ok(mount && mount.includes('this.container') && mount.includes('.prepend('),
    `${drift}: browser container portal mount`);
  assert.ok(/Object\.assign\([\w$]+\.style,\{.{0,650}?position:`fixed`.{0,180}?visibility:`visible`.{0,100}?zIndex:``\}\)/.test(javascript),
    `${drift}: visible native browser container stacking`);

  const rootRules = [...stylesheet.matchAll(/#root\{([^}]*)\}/g)];
  assert.equal(rootRules.length, 1, `${drift}: native root declaration count`);
  assert.equal(rootRules[0][1], 'height:100svh', `${drift}: native root must not establish a raised stacking context`);
});
