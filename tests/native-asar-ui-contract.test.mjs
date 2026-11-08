import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { loadNativeBundle, key, text, prop, nodes, nativeObject } from './native-bundle-current-helper.mjs';
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

const bundle = loadNativeBundle();
const { archive } = bundle;

test('local ChatGPT.exe ASAR remains the authoritative native geometry contract', () => {
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

  // The installed client now splits Rspack modules across numbered chunks.
  // Select actual interface-bearing CSS, retaining its native layer prelude.
  const cssAssets = new Set(['--composer-layout-surface-background',
    '--app-shell-navigation-rail-width', '[data-sticky]:before']
    .flatMap(token => bundle.stylesheetAssets([token])));
  const css = [bundle.layerOrder, ...bundle.baseStylesheets().map(asset => bundle.read(asset)),
    ...[...cssAssets].map(asset => bundle.read(asset))].join('\n');
  // Native dimensions may change without breaking paint replacement. Protect
  // the available interfaces, not a frozen copy of the client's pixel values.
  for (const token of ['--height-toolbar:', '--height-toolbar-sm:',
    '--spacing-token-sidebar:', '--radius-token-composer-single-line:',
    '--composer-layout-surface-background', '--composer-layout-surface-backdrop-filter',
    'data-composer-surface-variant', '.ComposerLayoutRoot-', '.ComposerLayoutBody-',
    '.PageSurface-', '--app-shell-navigation-rail-width',
    '[data-sticky]:before', '.sidebar-navigation:not(.sidebar-navigation .sidebar-navigation,[data-activity-sidebar-host])']) {
    assert.ok(css.includes(token), 'native CSS contract drift: '+token);
  }
  assert.ok(bundle.findModules(['data-user-message-bubble']).some(record => nodes(record.ast)
    .some(node => node.type === 'Property' && key(node.key) === 'data-user-message-bubble')),
  'native user-message paint owner must remain explicit');
  assert.ok(bundle.findModules(['group/settings']).some(record => nodes(record.ast)
    .some(node => text(node).split(/\s+/).includes('group/settings'))),
  'native settings layout contract must remain explicit');
  // Pixel/geometry/semantic colour equivalence is checked by the browser-based
  // native-paint-boundary test against this same installed CSS, at two widths.
});

test('native Dots header exposes an empty decorative anchor surface separate from controls', () => {
  const headers = bundle.findModules(['--orbit-messaging-header-']);
  const drift = 'native Dots header contract drifted; re-audit its anchor, portal and paint ownership';
  assert.equal(headers.length, 1, drift);
  const header = headers[0];

  // Use the parser already supplied by Vite to inspect actual JSX calls. This
  // survives minified variable names and property ordering; a hand-written DOM
  // fixture alone cannot detect a native background/floating-header variant.
  const headerNodes = nodes(header.ast);
  const anchors = new Set(headerNodes.filter(node => node.type === 'VariableDeclarator' &&
    text(node.init).startsWith('--orbit-messaging-header-')).map(node => node.id.name));
  assert.ok(anchors.size, drift);
  const nativeDivs = headerNodes.filter(node => node.type === 'CallExpression' &&
    text(node.arguments[0]) === 'div' && node.arguments[1]?.type === 'ObjectExpression')
    .map(node => node.arguments[1]);
  const anchored = nativeDivs.filter(props => anchors.has(prop(prop(props, 'style'), 'positionAnchor')?.name));
  const isTrue = node => node?.type === 'Literal' && node.value === true ||
    node?.type === 'UnaryExpression' && node.operator === '!' && node.argument?.value === 0;
  const decorative = anchored.filter(props => isTrue(prop(props, 'aria-hidden')) &&
    text(prop(props, 'className')).split(/\s+/).includes('pointer-events-none') &&
    !prop(props, 'children'));
  assert.ok(decorative.length, drift);
  assert.ok(anchored.some(props => prop(props, 'children')), `${drift}: interactive header siblings missing`);
  assert.ok(headerNodes.some(node => text(node).includes('[data-app-shell-main-content-layout]')) &&
    headerNodes.some(node => node.type === 'MemberExpression' && key(node.property) === 'createPortal'),
    `${drift}: header decoration may leave the messaging-root subtree`);

  const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const props of decorative) {
    const className = prop(props, 'className');
    const nativeClasses = (className.expressions || []).filter(node => node.type === 'MemberExpression')
      .map(member => {
        assert.equal(member.object.type, 'MemberExpression', `${drift}: CSS module binding`);
        const imported = bundle.imports(header)[member.object.object.name];
        assert.ok(imported, `${drift}: CSS module import`);
        const record = bundle.module(imported.id);
        let expression = bundle.exports(record)[key(member.object.property)];
        // Rspack guards this pure CSS export by renderer runtime ID.
        if (expression?.type === 'ConditionalExpression') {
          assert.equal(expression.alternate.value, null, `${drift}: conditional CSS export`);
          expression = expression.consequent;
        }
        return nativeObject(record, expression)[key(member.property)];
      });
    const css = nativeClasses.flatMap(name => bundle.stylesheetAssets([name]))
      .map(asset => bundle.read(asset)).join('\n');
    const gradientClasses = new Set();
    postcss.parse(css).walkRules(rule => {
      if (!rule.nodes.some(node => node.type === 'decl' && node.prop === 'background-image' &&
        node.value.startsWith('linear-gradient('))) return;
      for (const name of nativeClasses) if (new RegExp(`\\.${escape(name)}(?![\\w-])`).test(rule.selector)) gradientClasses.add(name);
    });
    assert.ok(nativeClasses.some(name => gradientClasses.has(name)),
    `${drift}: empty anchor surface no longer owns the native gradient`);
  }
});
