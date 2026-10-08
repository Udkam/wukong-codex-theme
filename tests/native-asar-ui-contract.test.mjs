import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parseAst } from 'rollup/parseAst';


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

test('native Dots header exposes an empty decorative anchor surface separate from controls', {
  skip: skipReason
}, () => {
  const entries = asar.listPackage(archive);
  const header = readMatchingAsset(entries, /header-.*\.js$/i, '--orbit-messaging-header-');
  const drift = 'native Dots header contract drifted; re-audit its anchor, portal and paint ownership';
  assert.ok(header, drift);

  // Use the parser already supplied by Vite to inspect actual JSX calls. This
  // survives minified variable names and property ordering; a hand-written DOM
  // fixture alone cannot detect a native background/floating-header variant.
  const nodes = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') nodes.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parseAst(header));
  const keyName = key => key?.name ?? key?.value;
  const property = (node, name) => node?.type === 'ObjectExpression'
    ? node.properties.find(item => item.type === 'Property' && keyName(item.key) === name)?.value
    : undefined;
  const templateText = node => node?.type === 'TemplateLiteral'
    ? node.quasis.map(part => part.value.cooked).join(' ')
    : node?.type === 'Literal' ? String(node.value) : '';
  const anchors = new Set(nodes.filter(node => node.type === 'VariableDeclarator' &&
    templateText(node.init).startsWith('--orbit-messaging-header-')).map(node => node.id.name));
  assert.ok(anchors.size, drift);
  const nativeDivs = nodes.filter(node => node.type === 'CallExpression' &&
    templateText(node.arguments[0]) === 'div' && node.arguments[1]?.type === 'ObjectExpression')
    .map(node => node.arguments[1]);
  const anchored = nativeDivs.filter(props => anchors.has(property(property(props, 'style'), 'positionAnchor')?.name));
  const isTrue = node => node?.type === 'Literal' && node.value === true ||
    node?.type === 'UnaryExpression' && node.operator === '!' && node.argument?.value === 0;
  const decorative = anchored.filter(props => isTrue(property(props, 'aria-hidden')) &&
    templateText(property(props, 'className')).split(/\s+/).includes('pointer-events-none') &&
    !property(props, 'children'));
  assert.ok(decorative.length, drift);
  assert.ok(anchored.some(props => property(props, 'children')), `${drift}: interactive header siblings missing`);
  assert.ok(header.includes('data-app-shell-main-content-layout') && header.includes('createPortal'),
    `${drift}: header decoration may leave the messaging-root subtree`);

  const shared = readMatchingAsset(entries, /app-shared-.*\.js$/i, 'floatingHeader');
  const css = entries.filter(name => /webview[\\/]assets[\\/]app-shared-.*\.css$/.test(name))
    .map(name => asar.extractFile(archive, listedPathToArchivePath(name)).toString('utf8')).join('\n');
  assert.ok(shared, drift);
  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const props of decorative) {
    const className = property(props, 'className');
    const moduleKeys = (className.expressions || []).filter(node => node.type === 'MemberExpression')
      .map(node => keyName(node.property));
    const nativeClasses = moduleKeys.flatMap(key => [...shared.matchAll(new RegExp(`\\b${escape(key)}:([\\w$]+)`, 'g'))]
      .flatMap(match => [...shared.matchAll(new RegExp(`${escape(match[1])}=[\x60"']([^\x60"']+)[\x60"']`, 'g'))]
        .map(binding => binding[1])));
    assert.ok(nativeClasses.some(name => [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
      .some(rule => new RegExp(`\\.${escape(name)}(?![\\w-])`).test(rule[1]) &&
        /background-image:\s*linear-gradient\(/.test(rule[2]))),
    `${drift}: empty anchor surface no longer owns the native gradient`);
  }
});
