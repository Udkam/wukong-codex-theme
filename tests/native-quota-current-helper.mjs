import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadNativeBundle, nativeFunction, presentationHarness, nativeObject, nodes, ownNodes, key, text, prop } from './native-bundle-current-helper.mjs';
export { nodes, key, text, prop };

const provenance = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
export const quotaPackageVersion = provenance.packageVersion;
export const quotaArchive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps',
  provenance.packageDirectoryName, provenance.asarRelativePath);
export const quotaNativeSkip = !fs.existsSync(quotaArchive) && 'Requires the audited quota-recovery ASAR';

let cached;
export const loadQuotaNative = () => {
  if (cached) return cached;
  const bundle = loadNativeBundle({ archive: quotaArchive }), harness = presentationHarness(bundle);
  const recovery = bundle.findModules(['aria-live', 'banner-', 'value:"recovery"']).filter(record => record.source.length < 10000);
  assert.equal(recovery.length, 1, 'Native recovery presentation module must be unique');
  const bannerRecord = recovery[0], banner = nativeFunction(bannerRecord, 'role:"status"');
  const aside = banner.nodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'role')) === 'status');
  const classes = { banner: banner.nodes.map(text).find(value => /^banner-\S+$/.test(value)),
    description: banner.nodes.map(text).find(value => /^description-\S+$/.test(value)) };
  assert.ok(classes.banner && classes.description, 'Native recovery CSS classes changed');
  const noticeRecord = bundle.findModules(['"composerContext"', '"recovery"', 'attachedToComposer']).filter(record => record.source.length < 50000);
  assert.equal(noticeRecord.length, 1, 'Native generic notice module changed');
  const notice = nativeFunction(noticeRecord[0], 'attachedToComposer');
  const placementCall = banner.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'children') === aside && node.arguments[0]?.type === 'MemberExpression');
  const placementImport = placementCall && bundle.imports(bannerRecord)[placementCall.arguments[0].object.name];
  assert.ok(placementImport, 'Native quota placement boundary changed');
  const placementRecord = bundle.module(placementImport.id);
  const placement = nativeFunction(placementRecord, 'className:"contents"');
  const composerRecord = bundle.findModules(['"data-composer-surface-variant"', '"data-composer-body"']).filter(record => record.source.length < 50000);
  assert.equal(composerRecord.length, 1, 'Native composer primitives module changed');
  const composerRoot = nativeFunction(composerRecord[0], '"data-composer-surface-variant"');
  const composerBody = nativeFunction(composerRecord[0], '"data-composer-body"');
  const defaults = composerRoot.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === 'DefaultsProvider');
  assert.equal(defaults?.object.type, 'MemberExpression', 'Native composer tooltip-defaults boundary changed');
  const defaultsImport = bundle.imports(composerRecord[0])[defaults.object.object.name];
  const defaultsRecord = bundle.module(defaultsImport.id), defaultsExport = bundle.exports(defaultsRecord)[key(defaults.object.property)];
  const defaultsProvider = nodes(defaultsRecord.ast).find(node => node.type === 'AssignmentExpression' &&
    node.left.type === 'MemberExpression' && node.left.object.name === defaultsExport?.name && key(node.left.property) === 'DefaultsProvider');
  assert.ok(defaultsProvider && !nodes(defaultsProvider.right).some(node => node.type === 'CallExpression' &&
    typeof node.arguments[0]?.value === 'string'), 'Tooltip defaults must remain a context-only presentation boundary');
  const pass = props => props.children;
  harness.modules[defaultsImport.id] = { [key(defaults.object.property)]: Object.assign(pass, { DefaultsProvider: pass }) };
  const registry = ownNodes(composerRecord[0].ast).find(node => node.type === 'VariableDeclarator' &&
    node.init?.type === 'CallExpression' && key(node.init.callee.property) === 'assign' && node.init.arguments[0] === composerRoot.ast);
  const registryExport = Object.entries(bundle.exports(composerRecord[0])).find(([, expression]) => expression.name === registry?.id.name)?.[0];
  assert.ok(registryExport && prop(registry.init.arguments[1], 'Body') === composerBody.ast,
    'Native composer root/body registry export association changed');
  const cssMapImport = Object.values(bundle.imports(composerRecord[0])).find(imported => {
    const exported = bundle.exports(bundle.module(imported.id));
    return exported.A?.type === 'ObjectExpression' && prop(exported.A, 'ComposerLayoutRoot');
  });
  assert.ok(cssMapImport, 'Native composer CSS module export changed');
  const mapRecord = bundle.module(cssMapImport.id), composerClasses = nativeObject(mapRecord, bundle.exports(mapRecord).A);
  const layoutRecord = bundle.findModules(['layoutState:', 'renderOwnSurface', 'header:', 'footerLayout:']).filter(record => record.source.length < 50000);
  assert.equal(layoutRecord.length, 1, 'Native public composer layout module changed');
  const layoutRenderer = nativeFunction(layoutRecord[0], 'layoutState:');
  const surfaceRenderer = nativeFunction(layoutRecord[0], 'renderOwnSurface:');
  const gateCall = layoutRenderer.nodes.find(node => node.type === 'CallExpression' &&
    node.callee.type === 'SequenceExpression' && key(node.callee.expressions.at(-1)?.property) === 'Zj');
  if (gateCall) {
    const member = gateCall.callee.expressions.at(-1), imported = bundle.imports(layoutRecord[0])[member.object.name];
    const gateRecord = bundle.module(imported.id), exported = bundle.exports(gateRecord).Zj;
    assert.ok(exported && nodes(exported).some(node => node.type === 'MemberExpression' && key(node.property) === 'Ul'),
      'Native layout feature-gate state boundary changed');
    // Fixture feature gates are disabled; no Statsig client or state subscription
    // executes while the actual renderer keeps ownership and class selection.
    harness.modules[imported.id] = { Zj: value => typeof value === 'boolean' ? value : false };
  }
  const hostRecord = bundle.findModules(['aboveHomeActionBarInRail', 'bannersRef:', 'className:"contents"']).filter(record => record.source.length < 50000);
  assert.equal(hostRecord.length, 1, 'Native banner/composer placement host changed');
  const host = nativeFunction(hostRecord[0], 'aboveHomeActionBarInRail');
  // Resolve the host's transport imports through its actual calls. Their
  // Rspack IDs can change independently of the pure presentation contract.
  const importedCall = node => {
    const callee = node?.callee?.type === 'SequenceExpression' ? node.callee.expressions.at(-1) : node?.callee;
    if (callee?.type !== 'MemberExpression' || callee.object.type !== 'Identifier') return null;
    const imported = bundle.imports(hostRecord[0])[callee.object.name];
    return imported && { ...imported, name: key(callee.property) };
  };
  const stateReader = host.nodes.filter(node => node.type === 'CallExpression').map(importedCall).find(call => call?.name === 'Ul');
  assert.ok(stateReader && bundle.exports(bundle.module(stateReader.id)).Ul,
    'Native host state-read transport export changed');
  harness.modules[stateReader.id] = { Ul: () => false };
  const lazyCall = ownNodes(hostRecord[0].ast).find(node => node.type === 'CallExpression' &&
    node.arguments[0]?.type === 'ArrowFunctionExpression' && node.arguments[0].async && prop(node.arguments[1], 'errorFallback'));
  const lazyImport = importedCall(lazyCall), lazyRecord = lazyImport && bundle.module(lazyImport.id);
  assert.ok(lazyRecord && bundle.exports(lazyRecord)[lazyImport.name] &&
    nodes(lazyRecord.ast).some(node => node.type === 'MemberExpression' && key(node.property) === 'lazy') &&
    nodes(lazyRecord.ast).some(node => node.type === 'Property' && key(node.key) === 'operation' && text(node.value) === 'lazy-component-load'),
  'Native disclaimer lazy-load transport changed');
  // Never invoke its importer, preload or account-specific disclaimer code.
  harness.modules[lazyImport.id] = { [lazyImport.name]: () => () => null };
  const exportedName = (record, fn) => {
    const matches = Object.entries(bundle.exports(record)).filter(([, expression]) => expression === fn.ast ||
      expression.type === 'Identifier' && fn.ast.id && expression.name === fn.ast.id.name);
    assert.equal(matches.length, 1, 'Native presentation renderer export association changed');
    return matches[0][0];
  };
  const ownerCandidates = bundle.findModules(['flex w-full flex-col gap-2', 'aboveHomeActionBarInRail:']);
  assert.ok(ownerCandidates.length && ownerCandidates.some(record => record.source.includes(`"${hostRecord[0].id}"`)), 'Native composer/banner owner changed');
  const ownerClass = 'flex w-full flex-col gap-2';
  const cssEntries = [...new Set([...bundle.baseStylesheets(), ...bundle.stylesheetAssets(classes.banner), ...bundle.stylesheetAssets(composerClasses.ComposerLayoutRoot)])];
  const css = `${bundle.layerOrder}\n${cssEntries.map(entry => bundle.read(entry)).join('\n')}`;
  const primitiveRegistry = harness.load(composerRecord[0].id)[registryExport];
  const renderLayout = options => {
    harness.contexts.set(harness.load(composerRecord[0].id).k, { isHome: options.surfacePlacement.kind === 'home', expansion: null, homeMode: undefined });
    try { return harness.load(layoutRecord[0].id)[exportedName(layoutRecord[0], layoutRenderer)](options); }
    finally { harness.contexts.delete(harness.load(composerRecord[0].id).k); }
  };
  cached = { bundle, harness, css, classes, banner, bannerRecord, aside, placement, notice,
    renderBanner: harness.load(bannerRecord.id)[exportedName(bannerRecord, banner)], renderButton: harness.load('ygO2').$,
    composerRoot, composerBody, composerClasses, renderComposerRoot: primitiveRegistry, renderComposerBody: primitiveRegistry.Body,
    host, renderHost: harness.load(hostRecord[0].id)[exportedName(hostRecord[0], host)], renderLayout, layoutRenderer, surfaceRenderer,
    ownerClass, cssEntries, layerOrder: bundle.layerOrder };
  return cached;
};

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
export const quotaHtml = tree => {
  if (tree == null || tree === false) return '';
  if (typeof tree === 'string' || typeof tree === 'number') return escape(tree);
  if (Array.isArray(tree)) return tree.map(quotaHtml).join('');
  const { tag, props } = tree;
  if (tag === '#fragment') return quotaHtml(props.children);
  const attributes = Object.entries(props).filter(([name, value]) => !['children', 'style', 'ref', 'initial', 'animate', 'transition', 'layoutId', 'layoutCrossfade', 'layout', 'layoutDependency'].includes(name) &&
    !name.startsWith('on') && value !== undefined && value !== false)
    .map(([name, value]) => `${name === 'className' ? 'class' : name}="${escape(value === true ? '' : value)}"`).join(' ');
  const style = props.style ? Object.entries(props.style).filter(([, value]) => value !== undefined).map(([name, value]) => `${name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}:${value}`).join(';') : '';
  return `<${tag} ${attributes}${style ? ` style="${escape(style)}"` : ''}>${quotaHtml(props.children)}</${tag}>`;
};
