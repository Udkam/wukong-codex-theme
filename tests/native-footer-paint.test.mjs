import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseAst } from 'rollup/parseAst';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const lock = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
const archive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', lock.packageDirectoryName, lock.asarRelativePath);
const skip = !fs.existsSync(archive) && 'Requires the audited installed ASAR';
const key = node => node?.name ?? node?.value;
const text = node => node?.type === 'TemplateLiteral' ? node.quasis.map(part => part.value.cooked).join(' ') : node?.type === 'Literal' ? String(node.value) : '';
const prop = (node, name) => node?.type === 'ObjectExpression' ? node.properties.find(item => item.type === 'Property' && key(item.key) === name)?.value : undefined;
const nodes = tree => {
  const result = [];
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.type === 'string') result.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(tree);
  return result;
};

const loadNative = () => {
  const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
  const entries = asar.listPackage(archive);
  const read = entry => asar.extractFile(archive, entry.replace(/^[/\\]/, '')).toString('utf8');
  const source = read(entries.find(entry => /webview[\\/]assets[\\/]app-initial-.*\.js$/.test(entry)));
  const css = entries.filter(entry => /webview[\\/]assets[\\/]app-(initial|shared|primary)-.*\.css$/.test(entry)).map(read).join('\n');
  const drift = 'Native footer paint ownership changed; inspect the installed shared renderer and its consumers';

  // Parse the actual CSS-module initializer rather than locking its generated
  // hash, component name, or export alias. A new module shape fails this audit.
  let module;
  for (const match of source.matchAll(/_background_[a-z0-9]+_\d+/g)) {
    const start = source.lastIndexOf('function ', match.index);
    const end = source.indexOf('function ', match.index);
    if (start < 0 || end < 0) continue;
    let declarations;
    try { declarations = nodes(parseAst(source.slice(start, end))); } catch { continue; }
    const assignment = declarations.find(node => node.type === 'AssignmentExpression' && node.left.type === 'Identifier' &&
      ['background', 'fade', 'surface', 'combined'].every(name => prop(node.right, name)?.type === 'Identifier'));
    if (!assignment) continue;
    const values = Object.fromEntries(declarations.filter(node => node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && text(node.right))
      .map(node => [node.left.name, text(node.right)]));
    const classes = Object.fromEntries(['background', 'fade', 'surface', 'combined'].map(name => [name, values[prop(assignment.right, name).name]]));
    if (Object.values(classes).every(Boolean)) { module = { name: assignment.left.name, classes, end }; break; }
  }
  assert.ok(module, drift);
  const use = source.indexOf(`${module.name}.background`, module.end);
  assert.ok(use >= 0, drift);
  const start = source.lastIndexOf('function ', use);
  const end = source.indexOf('function ', use);
  const rendererSource = source.slice(start, end);
  const renderer = parseAst(rendererSource).body.find(node => node.type === 'FunctionDeclaration');
  const content = nodes(renderer);
  const cache = content.find(node => node.type === 'MemberExpression' && key(node.property) === 'c' && node.object.type === 'Identifier');
  const jsx = content.find(node => node.type === 'MemberExpression' && key(node.property) === 'jsx' && node.object.type === 'Identifier');
  const classCall = content.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
    node.arguments.some(argument => argument.type === 'MemberExpression' && argument.object.name === module.name && key(argument.property) === 'background'));
  assert.ok(cache && jsx && classCall, drift);
  const leaf = content.find(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' && prop(node.arguments[1], 'aria-hidden'));
  assert.ok(leaf && !prop(leaf.arguments[1], 'children'), `${drift}: shared background must remain an empty decorative leaf`);
  const classname = (...values) => values.flat(Infinity).filter(Boolean).join(' ');
  // Execute only this pure native component, with JSX and compiler cache stubs.
  // The generated DOM thus follows actual native part selection and markers.
  const render = new Function(cache.object.name, jsx.object.name, classCall.callee.name, module.name,
    `return (${rendererSource.slice(renderer.start, renderer.end)});`)(
    { c: length => Array(length).fill(Symbol('unset')) }, { jsx: (tag, props) => ({ tag, props }) }, classname, module.classes);
  const exportAlias = source.match(new RegExp(`\\b${renderer.id.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} as ([\\w$]+)`))?.[1];
  assert.ok(exportAlias, drift);
  const consumers = pattern => entries.filter(entry => pattern.test(entry)).map(entry => {
    const code = read(entry);
    const ast = parseAst(code);
    const local = ast.body.filter(node => node.type === 'ImportDeclaration' && /app-initial-.*\.js$/.test(node.source.value))
      .flatMap(node => node.specifiers).find(node => key(node.imported) === exportAlias)?.local.name;
    const calls = local ? nodes(ast).filter(node => node.type === 'CallExpression' && node.arguments[0]?.name === local && node.arguments[1]?.type === 'ObjectExpression') : [];
    return { code, ast, calls };
  });
  return { css, render, classes: module.classes, consumers, drift };
};

test('installed shared footer renderer retains all three paints and independent native consumers', { skip }, () => {
  const native = loadNative();
  for (const part of ['surface', 'fade', undefined]) {
    const result = native.render({ part });
    assert.equal(result.tag, 'div');
    assert.equal(result.props['aria-hidden'], true);
    assert.equal(result.props.children, undefined);
    for (const name of [native.classes.background, native.classes[part || 'combined'], 'pointer-events-none']) {
      assert.ok(result.props.className.split(/\s+/).includes(name), `${native.drift}: ${part || 'combined'} missing ${name}`);
    }
  }
  const thread = native.consumers(/webview[\\/]assets[\\/]thread-scroll-layout-.*\.js$/)[0];
  assert.ok(thread, native.drift);
  const branches = thread.calls.map(call => text(prop(call.arguments[1], 'part')));
  assert.ok(branches.includes('surface') && branches.includes('fade'), `${native.drift}: split scroll/footer parts missing`);
  assert.ok(nodes(thread.ast).some(node => node.type === 'ObjectExpression' && text(prop(node, 'data-thread-scroll-footer')) === 'true' &&
    nodes(prop(node, 'children')).some(child => child.type === 'CallExpression' && text(prop(child.arguments[1], 'part')) === 'surface')),
  `${native.drift}: surface must belong to semantic footer`);
  assert.ok(nodes(thread.ast).some(node => node.type === 'ObjectExpression' && nodes(prop(node, 'className')).some(child => text(child).includes('sticky bottom-0')) &&
    nodes(prop(node, 'children')).some(child => child.type === 'CallExpression' && text(prop(child.arguments[1], 'part')) === 'fade')),
  `${native.drift}: fade must remain independently mounted in scroll reservation`);
  const dots = native.consumers(/webview[\\/]assets[\\/]composer-controls-.*\.js$/)[0];
  assert.ok(dots?.calls.some(call => !prop(call.arguments[1], 'part')) && dots.calls.some(call => text(prop(call.arguments[1], 'part')) === 'surface'),
    `${native.drift}: Dots composer and disclaimer must exercise combined and surface variants`);
  const mainConsumers = native.consumers(/webview[\\/]assets[\\/]app-primary-.*\.js$/);
  assert.ok(mainConsumers.some(consumer => consumer.calls.some(call => !prop(call.arguments[1], 'part'))),
    `${native.drift}: main/home shared background use must be re-audited`);
});

test('native footer paints clear across split thread, Dots and main owners without geometry or control changes', { skip }, async () => {
  const native = loadNative();
  const escaped = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const paint = (id, part, extra = '', children = '') => {
    const { props } = native.render({ part });
    return `<div id="${id}" aria-hidden="true" class="${escaped(props.className)}" ${extra}>${children}</div>`;
  };
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1260, height: 820 } });
    await page.setContent(`<html data-theme="dark"><head><style>${native.css}</style><style>
      :root{--spacing:4px}body{margin:0}#root{position:relative;padding:16px}section{position:relative;height:130px;margin:20px 0}
      #viewport{height:260px;overflow:auto;position:relative}#scroll-content{height:800px;position:relative}
      #reservation{position:sticky;bottom:0;height:90px}#footer{position:relative;height:90px}
      #main,#dots{height:150px}#disclaimer{position:relative;height:45px}#dot-carrier{position:relative;height:60px}
      #image-preview,#no-module,#with-children,#interactive,#other-owner,#outside-root,#no-hidden,#no-pointer,#no-variant{position:relative;height:40px;width:180px}
      .test-gradient{background-image:linear-gradient(#112233,#667788)}#call{padding:8px;border:2px solid #8ab;border-radius:12px;background:#456;color:#fff}
    </style></head><body><div id="root">
      <div id="viewport" class="thread-scroll-container"><div id="scroll-content"><p>Scrollable thread</p></div><div id="reservation">${paint('thread-fade', 'fade')}</div></div>
      <div id="footer" data-thread-scroll-footer="true">${paint('thread-surface', 'surface')}<button id="call">Call</button></div>
      <section id="dots" class="messaging-root messaging-embedded"><div class="composer-wrap"><div data-codex-composer-root>
        <div id="disclaimer" class="composer-disclaimer-above relative">${paint('dot-disclaimer', 'surface')}<span>Disclaimer</span></div>
        <div id="dot-carrier">${paint('dot-combined')}<input id="message" aria-label="Message" style="position:relative"></div>
      </div></div></section>
      <section id="main" data-app-shell-main-content-layout>${paint('home-combined')}${paint('health-surface', 'surface')}
        <div id="image-preview" aria-hidden="true" class="pointer-events-none test-gradient"><img alt="Preview"></div>
        <div id="no-module" aria-hidden="true" class="pointer-events-none test-gradient"></div>
        ${paint('with-children', 'fade', '', '<span>Native content</span>')}
        <button id="interactive" class="${escaped(native.render({}).props.className)}">Control</button>
        <div id="no-hidden" class="${escaped(native.render({}).props.className)}"></div>
        <div id="no-pointer" aria-hidden="true" class="${native.classes.background} ${native.classes.combined}"></div>
        <div id="no-variant" aria-hidden="true" class="pointer-events-none ${native.classes.background} test-gradient"></div>
      </section>${paint('other-owner')}
    </div>${paint('outside-root')}</body></html>`);
    await page.addStyleTag({ content: theme });
    const cleared = ['thread-fade', 'thread-surface', 'dot-disclaimer', 'dot-combined', 'home-combined', 'health-surface'];
    const preserved = ['image-preview', 'no-module', 'with-children', 'interactive', 'other-owner', 'outside-root', 'no-hidden', 'no-pointer', 'no-variant', 'call'];
    const capture = () => page.locator('[id]').evaluateAll(elements => Object.fromEntries(elements.map(element => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return [element.id, { geometry: [rect.x, rect.y, rect.width, rect.height, style.position, style.padding, style.margin, style.borderWidth, style.borderRadius, style.font, style.opacity, style.pointerEvents],
        paint: [style.backgroundColor, style.backgroundImage, style.color, style.boxShadow, style.backdropFilter] }];
    })));
    for (const mode of ['dark', 'light']) for (const width of [720, 1260]) for (const height of [660, 920]) for (const scroll of [0, 180]) {
      const label = `${mode}/${width}x${height}/scroll${scroll}`;
      await page.setViewportSize({ width, height });
      await page.evaluate(({ mode, scroll }) => {
        const root = document.documentElement;
        root.classList.remove('forge-ink-mountain');
        Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: 'true' });
        document.getElementById('viewport').scrollTop = scroll;
      }, { mode, scroll });
      const before = await capture();
      for (const id of cleared) assert.ok(before[id].paint[0] !== 'rgba(0, 0, 0, 0)' || before[id].paint[1] !== 'none', `${label}: ${id} must actually own native paint`);
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const after = await capture();
      for (const id of Object.keys(before)) assert.deepEqual(after[id].geometry, before[id].geometry, `${label}: ${id} retains native geometry`);
      for (const id of cleared) {
        assert.deepEqual(after[id].paint.slice(0, 2), ['rgba(0, 0, 0, 0)', 'none'], `${label}: ${id} clears both solid and gradient paint`);
        assert.deepEqual(after[id].paint.slice(2), before[id].paint.slice(2), `${label}: ${id} changes background only`);
      }
      for (const id of preserved) assert.deepEqual(after[id].paint, before[id].paint, `${label}: ${id} is outside the decorative owner contract`);
      assert.equal(await page.locator('#viewport').evaluate(element => element.scrollTop), scroll);
    }
    await page.locator('#message').fill('Still editable');
    assert.equal(await page.locator('#message').inputValue(), 'Still editable');
    await page.locator('#call').click();
    assert.equal(await page.locator('#call').evaluate(element => element === document.activeElement), true);
  } finally { await browser.close(); }
});
