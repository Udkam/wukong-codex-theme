import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { parseAst } from 'rollup/parseAst';
import { key, loadNativeBundle, nodes, prop, text } from './native-bundle-current-helper.mjs';

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

const memberPath = node => node?.type === 'Identifier' ? node.name
  : node?.type === 'ThisExpression' ? 'this'
    : node?.type === 'MemberExpression' ? `${memberPath(node.object)}.${key(node.property)}` : '';
const calls = (tree, receiver, method) => nodes(tree).filter(node => node.type === 'CallExpression' &&
  node.callee.type === 'MemberExpression' && memberPath(node.callee.object) === receiver &&
  key(node.callee.property) === method);
const assignments = (tree, target) => nodes(tree).filter(node => node.type === 'AssignmentExpression' &&
  memberPath(node.left) === target);
const calleeMember = expression => expression?.type === 'SequenceExpression'
  ? expression.expressions.at(-1) : expression;

// Evaluate only the literal URL-building syntax used by Rspack's two chunk
// resolvers. No installed application code is executed by this source audit.
const chunkPath = (resolver, chunkId) => {
  const parameter = resolver.params[0]?.name;
  const evaluate = node => {
    if (node?.type === 'Literal') return node.value;
    if (node?.type === 'Identifier' && node.name === parameter) return chunkId;
    if (node?.type === 'BinaryExpression' && node.operator === '+') return evaluate(node.left) + evaluate(node.right);
    if (node?.type === 'MemberExpression' && node.computed && node.object.type === 'ObjectExpression') {
      const property = node.object.properties.find(item => item.type === 'Property' &&
        String(key(item.key)) === String(evaluate(node.property)));
      assert.ok(property, 'native browser chunk is absent from its active resolver');
      return evaluate(property.value);
    }
    assert.fail(`native browser chunk resolver syntax changed: ${node?.type}`);
  };
  return evaluate(resolver.body);
};

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
  const { javascript, stylesheet, entrypoint, runtime } = sources;
  assert.ok(javascript && stylesheet && entrypoint && runtime, drift);
  const bundle = loadNativeBundle({ archive });
  assert.equal(bundle.index, entrypoint, `${drift}: active browser entrypoint`);
  const normalize = member => member.replaceAll('\\', '/');
  assert.ok(bundle.entryScripts.includes(normalize(provenance.assets.runtime.member)),
    `${drift}: audited chunk runtime is no longer referenced by the active entrypoint`);
  const runtimeNodes = nodes(parseAst(runtime));
  const resolver = name => {
    const matches = runtimeNodes.filter(node => node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' && key(node.left.property) === name &&
      node.right.type === 'ArrowFunctionExpression');
    assert.equal(matches.length, 1, `${drift}: active ${name} chunk resolver`);
    return matches[0];
  };
  const javascriptResolver = resolver('u'), stylesheetResolver = resolver('miniCssF');
  assert.equal(memberPath(javascriptResolver.left.object), memberPath(stylesheetResolver.left.object),
    `${drift}: browser JS and CSS must use the same active chunk runtime`);
  const browserAsset = normalize(provenance.assets.javascript.member);
  const browserChunkId = path.posix.basename(browserAsset).match(/^(\d+)\.[a-f0-9]+\.js$/)?.[1];
  assert.ok(browserChunkId, `${drift}: browser async chunk filename`);
  assert.equal(`webview/${chunkPath(javascriptResolver.right, browserChunkId)}`, browserAsset,
    `${drift}: active entrypoint no longer resolves the audited browser JavaScript`);
  const stylesheetAsset = normalize(provenance.assets.stylesheet.member);
  const stylesheetHash = path.posix.basename(stylesheetAsset, '.css');
  const stylesheetChunks = nodes(stylesheetResolver.right).filter(node => node.type === 'Property' &&
    text(node.value) === stylesheetHash).map(node => key(node.key));
  assert.ok(stylesheetChunks.some(id => `webview/${chunkPath(stylesheetResolver.right, id)}` === stylesheetAsset),
    `${drift}: active entrypoint no longer resolves the audited browser stylesheet`);
  assert.ok(stylesheetChunks.some(id => runtimeNodes.some(node => node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' && key(node.callee.property) === 'e' &&
    String(node.arguments[0]?.value) === String(id))), `${drift}: browser base CSS is no longer loaded by the entrypoint`);

  // The current app splits its semantic modules into an asynchronous Rspack
  // chunk. Locate declarations inside the pinned browser asset, then follow
  // their imports/exports instead of depending on minified names or quotes.
  const browserModules = bundle.modulesInAsset(browserAsset);
  const moduleWith = marker => {
    const matches = browserModules.filter(record => record.source.includes(marker));
    assert.equal(matches.length, 1, `${drift}: module containing ${marker}`);
    return matches[0];
  };
  const exportedHost = (record, selector) => {
    const matches = nodes(record.ast).filter(node => node.type === 'FunctionDeclaration' && node !== record.ast &&
      nodes(node).some(call => call.type === 'CallExpression' && call.callee.type === 'MemberExpression' &&
        key(call.callee.property) === 'querySelector' && text(call.arguments[0]) === selector));
    assert.equal(matches.length, 1, `${drift}: ${selector} declaration`);
    const fn = matches[0];
    assert.ok(Object.values(bundle.exports(record)).some(value => value.type === 'Identifier' && value.name === fn.id.name),
      `${drift}: ${selector} exported host factory`);
    return fn;
  };
  const createdDiv = fn => {
    const match = nodes(fn).find(node => node.type === 'VariableDeclarator' && node.id.type === 'Identifier' &&
      node.init?.type === 'CallExpression' && memberPath(node.init.callee) === 'document.createElement' &&
      text(node.init.arguments[0]) === 'div');
    assert.ok(match, `${drift}: native portal div creation`);
    return match.id.name;
  };
  const outerModule = moduleWith('data-embedded-frame-host-root');
  const outer = exportedHost(outerModule, '[data-embedded-frame-host-root]');
  const outerDiv = createdDiv(outer);
  assert.ok(calls(outer, 'document', 'querySelector').some(call => text(call.arguments[0]) === '[data-embedded-frame-host-root]'),
    `${drift}: embedded host must be discovered from the document`);
  assert.ok(assignments(outer, `${outerDiv}.dataset.embeddedFrameHostRoot`).length,
    `${drift}: embeddedFrameHostRoot marker`);
  assert.equal(text(assignments(outer, `${outerDiv}.className`)[0]?.right),
    'pointer-events-none fixed inset-0 overflow-visible', `${drift}: embedded host paint and hit-test boundary`);
  assert.ok(calls(outer, 'document.body', 'append').some(call => call.arguments[0]?.name === outerDiv),
    `${drift}: embedded host must be appended to body outside the app root`);

  const hostModule = moduleWith('data-browser-host-root');
  const host = exportedHost(hostModule, '[data-browser-host-root]');
  const hostDiv = createdDiv(host);
  assert.ok(assignments(host, `${hostDiv}.dataset.browserHostRoot`).length, `${drift}: browserHostRoot marker`);
  assert.equal(text(assignments(host, `${hostDiv}.className`)[0]?.right),
    'pointer-events-none fixed inset-0 [contain:paint]', `${drift}: browser host paint isolation`);
  const hostImports = bundle.imports(hostModule);
  const parentHost = nodes(host).find(node => node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression' &&
    hostImports[calleeMember(node.init.callee)?.object?.name]?.id === outerModule.id &&
    bundle.exports(outerModule)[key(calleeMember(node.init.callee)?.property)]?.name === outer.id.name);
  assert.ok(parentHost && calls(host, parentHost.id.name, 'append').some(call => call.arguments[0]?.name === hostDiv),
    `${drift}: browser host must remain inside the body-owned embedded host`);
  assert.ok(calls(host, parentHost.id.name, 'querySelector').some(call => text(call.arguments[0]) === '[data-browser-host-root]'),
    `${drift}: browser host must be discovered inside the embedded host`);
  assert.ok(stylesheet.includes('.\\[contain\\:paint\\]{contain:paint}'), drift);

  const webviewModule = moduleWith('browserSidebarWebview');
  const constructors = nodes(webviewModule.ast).filter(node => node.type === 'MethodDefinition' && node.kind === 'constructor' &&
    calls(node, 'document', 'createElement').some(call => text(call.arguments[0]) === 'webview'));
  assert.equal(constructors.length, 1, `${drift}: native webview creation`);
  const constructor = constructors[0];
  const webview = nodes(constructor).find(node => node.type === 'VariableDeclarator' && node.init?.type === 'CallExpression' &&
    memberPath(node.init.callee) === 'document.createElement' && text(node.init.arguments[0]) === 'webview')?.id.name;
  const container = assignments(constructor, 'this.container')[0]?.right.name;
  assert.ok(container && assignments(constructor, `${container}.dataset.browserSidebarWebview`).length,
    `${drift}: browserSidebarWebview container marker`);
  assert.equal(text(assignments(constructor, `${webview}.className`)[0]?.right), 'h-full w-full',
    `${drift}: native webview sizing`);
  assert.ok(calls(constructor, webview, 'setAttribute').some(call =>
    text(call.arguments[0]) === 'webviewrole' && text(call.arguments[1]) === 'tab'), `${drift}: native webview tab role`);
  assert.ok(calls(constructor, container, 'append').some(call => call.arguments.some(argument => argument.name === webview)),
    `${drift}: native webview must remain inside its portal container`);

  const mount = nodes(webviewModule.ast).find(node => node.type === 'MethodDefinition' && key(node.key) === 'attachToDom');
  assert.ok(mount, `${drift}: browser container portal mount`);
  const mountParameter = mount.value.params[0];
  const defaultHost = calleeMember(mountParameter?.right?.callee);
  assert.equal(mountParameter?.type, 'AssignmentPattern', `${drift}: default browser host`);
  assert.equal(bundle.imports(webviewModule)[defaultHost?.object?.name]?.id, hostModule.id, `${drift}: default browser host import`);
  assert.equal(bundle.exports(hostModule)[key(defaultHost?.property)]?.name, host.id.name, `${drift}: default browser host export`);
  const mountedContainer = nodes(mount).find(node => node.type === 'VariableDeclarator' && memberPath(node.init) === 'this.container');
  assert.ok(mountedContainer && calls(mount, mountParameter.left.name, 'prepend').some(call =>
    call.arguments[0]?.name === mountedContainer.id.name), `${drift}: browser container portal prepend`);
  // Connected guest containers now use moveBefore to preserve their existing
  // contents; the prepend fallback still owns the same body portal topology.
  assert.ok(calls(mount, mountParameter.left.name, 'moveBefore').some(call =>
    call.arguments[0]?.name === mountedContainer.id.name &&
    memberPath(call.arguments[1]) === `${mountParameter.left.name}.firstChild`), `${drift}: connected browser container portal move`);
  assert.ok(nodes(webviewModule.ast).some(node => node.type === 'CallExpression' && memberPath(node.callee) === 'Object.assign' &&
    memberPath(node.arguments[0]).endsWith('.style') &&
    text(prop(node.arguments[1], 'position')) === 'fixed' && text(prop(node.arguments[1], 'visibility')) === 'visible' &&
    prop(node.arguments[1], 'zIndex')?.type === 'Literal' && prop(node.arguments[1], 'zIndex').value === ''),
    `${drift}: visible native browser container stacking`);

  const rootRules = [...stylesheet.matchAll(/#root\{([^}]*)\}/g)];
  assert.equal(rootRules.length, 1, `${drift}: native root declaration count`);
  assert.equal(rootRules[0][1], 'height:100svh', `${drift}: native root must not establish a raised stacking context`);
});
