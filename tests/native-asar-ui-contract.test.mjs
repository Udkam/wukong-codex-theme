import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';


const require = createRequire(import.meta.url);
const provenance = JSON.parse(fs.readFileSync(
  new URL('../docs/native-asar-provenance.json', import.meta.url),
  'utf8'
));

const sha256FileBounded = filePath => {
  const hash = createHash('sha256');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const handle = fs.openSync(filePath, 'r');
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(handle, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(handle);
  }
  return hash.digest('hex').toUpperCase();
};

const findLocalAsar = () => {
  const explicit = process.env.CODEX_LOCAL_ASAR;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const appRoot = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WindowsApps');
  try {
    const candidates = fs.readdirSync(appRoot, { withFileTypes: true })
      .filter(entry => (
        entry.isDirectory() &&
        /^OpenAI\.Codex_.*_x64__/.test(entry.name)
      ))
      .map(entry => path.join(appRoot, entry.name, 'app', 'resources', 'app.asar'))
      .filter(candidate => fs.existsSync(candidate))
      .sort((left, right) => (
        fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs
      ));
    return candidates[0] || null;
  } catch {
    return null;
  }
};

const loadAsar = () => {
  try {
    return require('asar');
  } catch {
    const globalModule = path.join(
      process.env.APPDATA || '',
      'npm',
      'node_modules',
      'asar'
    );
    try {
      return require(globalModule);
    } catch {
      return null;
    }
  }
};

const archive = findLocalAsar();
const asar = loadAsar();
const skipReason = !archive
  ? 'local ChatGPT.exe app.asar is unavailable'
  : !asar
    ? 'the read-only asar module is unavailable'
    : false;

const listedPathToArchivePath = listedPath => listedPath.replace(/^\\/, '');

const readMatchingAsset = (entries, pattern, requiredText) => {
  for (const listedPath of entries) {
    if (!pattern.test(listedPath)) continue;
    const content = asar.extractFile(
      archive,
      listedPathToArchivePath(listedPath)
    ).toString('utf8');
    if (content.includes(requiredText)) return content;
  }
  return null;
};

test('local ChatGPT.exe ASAR remains the authoritative native geometry contract', {
  skip: skipReason
}, () => {
  const packageDirectory = path.dirname(path.dirname(path.dirname(archive)));
  const packageDirectoryName = path.basename(packageDirectory);
  assert.equal(provenance.schemaVersion, 1);
  assert.equal(
    path.relative(packageDirectory, archive).replaceAll('\\', '/'),
    provenance.asarRelativePath,
    'native Codex app.asar relative path drifted; re-audit the installed package layout'
  );
  assert.equal(
    packageDirectoryName,
    provenance.packageDirectoryName,
    'native Codex package drifted; re-audit app.asar before changing theme selectors or geometry'
  );
  assert.equal(
    fs.statSync(archive).size,
    provenance.sizeBytes,
    'native Codex app.asar size drifted; re-audit before updating the provenance lock'
  );
  assert.equal(
    sha256FileBounded(archive),
    provenance.sha256,
    'native Codex app.asar hash drifted; do not reuse the previous UI baseline'
  );

  const entries = asar.listPackage(archive);
  const css = entries.filter(name => /webview[\\/]assets[\\/](app-shared-|app-initial-|app-primary-).*\.css$/.test(name))
    .map(name => asar.extractFile(archive, name.replace(/^[/\\]/, '')).toString('utf8')).join('\n');
  // Native dimensions may change without breaking paint replacement. Protect
  // the available interfaces, not a frozen copy of the client's pixel values.
  for (const token of ['--height-toolbar:', '--height-toolbar-sm:',
    '--spacing-token-sidebar:', '--radius-token-composer-single-line:',
    '--composer-layout-surface-background', '--composer-layout-surface-backdrop-filter',
    'data-composer-surface-variant', '_ComposerLayoutRoot_', '_ComposerLayoutBody_',
    '_PageSurface_', '--app-shell-navigation-rail-width',
    '[data-sticky]:before', '.sidebar-navigation:not(.sidebar-navigation .sidebar-navigation)']) {
    assert.ok(css.includes(token), 'native CSS contract drift: '+token);
  }
  const userMessage = readMatchingAsset(entries, /user-message-.*\.js$/i, 'data-user-message-bubble');
  assert.ok(userMessage, 'native user-message paint owner must remain explicit');
  const settings = readMatchingAsset(entries, /app-initial-.*\.js$/i, 'group/settings');
  assert.ok(settings, 'native settings layout contract must remain explicit');
  // Pixel/geometry/semantic colour equivalence is checked by the browser-based
  // native-paint-boundary test against this same installed CSS, at two widths.
});
