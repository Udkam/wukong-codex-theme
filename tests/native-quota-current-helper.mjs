import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadNativeBundle, nativeFunction, presentationHarness, nativeObject, nodes, key, text, prop } from './native-bundle-current-helper.mjs';
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
  const primitiveRegistry = harness.load(composerRecord[0].id).r;
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
  const hostRecord = bundle.findModules(['aboveHomeActionBarInRail', 'bannersRef:', 'className:"contents"']).filter(record => record.source.length < 50000);
  assert.equal(hostRecord.length, 1, 'Native banner/composer placement host changed');
  const host = nativeFunction(hostRecord[0], 'aboveHomeActionBarInRail');
  const ownerCandidates = bundle.findModules(['flex w-full flex-col gap-2', 'aboveHomeActionBarInRail:']);
  assert.ok(ownerCandidates.length && ownerCandidates.some(record => record.source.includes(`"${hostRecord[0].id}"`)), 'Native composer/banner owner changed');
  const ownerClass = 'flex w-full flex-col gap-2';
  const cssEntries = [...new Set([...bundle.baseStylesheets(), ...bundle.stylesheetAssets(classes.banner), ...bundle.stylesheetAssets(composerClasses.ComposerLayoutRoot)])];
  const css = `${bundle.layerOrder}\n${cssEntries.map(entry => bundle.read(entry)).join('\n')}`;
  const renderLayout = options => {
    harness.contexts.set(harness.load(composerRecord[0].id).k, { isHome: options.surfacePlacement.kind === 'home', expansion: null, homeMode: undefined });
    try { return harness.load(layoutRecord[0].id).C(options); }
    finally { harness.contexts.delete(harness.load(composerRecord[0].id).k); }
  };
  cached = { bundle, harness, css, classes, banner, bannerRecord, aside, placement, notice,
    renderBanner: harness.load(bannerRecord.id).B, renderButton: harness.load('ygO2').$,
    composerRoot, composerBody, composerClasses, renderComposerRoot: primitiveRegistry, renderComposerBody: primitiveRegistry.Body,
    host, renderHost: harness.load(hostRecord[0].id).RR, renderLayout, layoutRenderer, surfaceRenderer,
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
