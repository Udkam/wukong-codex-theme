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
const ownerFunction = (ast, target) => nodes(ast).filter(node => node.type === 'FunctionDeclaration' && node.start <= target.start && node.end >= target.end)
  .sort((left, right) => (left.end - left.start) - (right.end - right.start))[0];
const ownNodes = fn => {
  const nested = nodes(fn).filter(node => node !== fn && /^(?:Function|ArrowFunction)/.test(node.type));
  return nodes(fn).filter(node => !nested.some(child => child.start <= node.start && child.end >= node.end));
};
const aliasResolver = fn => {
  const values = new Map();
  for (const node of ownNodes(fn)) {
    const name = node.type === 'VariableDeclarator' && node.id.type === 'Identifier' ? node.id.name
      : node.type === 'AssignmentExpression' && node.left.type === 'Identifier' ? node.left.name : null;
    if (name) values.set(name, [...(values.get(name) || []), node.init || node.right]);
  }
  // Follow compiler-cache aliases only. In particular, do not look through a
  // newly inserted JSX wrapper: the CSS depends on this direct-child relation.
  const resolves = (expression, target, visited = new Set()) => {
    if (expression === target) return true;
    if (expression?.type !== 'Identifier' || visited.has(expression.name)) return false;
    return (values.get(expression.name) || []).some(value => resolves(value, target, new Set([...visited, expression.name])));
  };
  return { resolves, values };
};

let cachedNative;
const loadNative = () => {
  if (cachedNative) return cachedNative;
  const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
  const entries = asar.listPackage(archive);
  const read = entry => asar.extractFile(archive, entry.replace(/^[/\\]/, '')).toString('utf8');
  const source = read(entries.find(entry => /webview[\\/]assets[\\/]app-shared-.*\.js$/.test(entry)));
  const css = entries.filter(entry => /webview[\\/]assets[\\/]app-(initial|shared|primary)-.*\.css$/.test(entry)).map(read).join('\n');
  const drift = 'Native summary header paint ownership changed; inspect its renderer and side-panel consumers';
  const anchor = source.indexOf('pointer-events-none sticky top-0 isolate z-10 shrink-0 select-none');
  assert.ok(anchor > 0, drift);
  const start = source.lastIndexOf('function ', anchor), end = source.indexOf('function ', anchor);
  const rendererSource = source.slice(start, end);
  const renderer = parseAst(rendererSource).body.find(node => node.type === 'FunctionDeclaration');
  const content = nodes(renderer);
  const member = name => content.find(node => node.type === 'MemberExpression' && key(node.property) === name && node.object.type === 'Identifier')?.object.name;
  const classCall = content.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument).startsWith('pointer-events-none sticky')));
  const cache = member('c'), jsx = member('jsx'), motion = member('div'), portal = member('createPortal');
  assert.ok(cache && jsx && motion && portal && classCall, drift);
  const jsxFactory = { jsx: (tag, props) => ({ tag, props }), jsxs: (tag, props) => ({ tag, props }), Fragment: '#fragment' };
  // Execute the native pure renderer. Its default/solid branches, portal
  // placeholder, dimensions and motion opacity are therefore not fixture copies.
  const render = new Function(cache, jsx, motion, portal, classCall.callee.name,
    `return (${rendererSource.slice(renderer.start, renderer.end)});`)(
    { c: length => Array(length).fill(Symbol('unset')) }, jsxFactory, { div: 'div' },
    { createPortal: (children, target) => ({ tag: '#portal', props: { children, target } }) },
    (...values) => values.flat(Infinity).filter(Boolean).join(' '));
  const alias = source.match(new RegExp(`\\b${renderer.id.name} as ([\\w$]+)`))?.[1];
  assert.ok(alias, drift);
  const consumers = entries.filter(entry => /webview[\\/]assets[\\/]side-panel-[^\\/]+\.js$/.test(entry)).map(entry => {
    const code = read(entry), ast = parseAst(code);
    const local = ast.body.filter(node => node.type === 'ImportDeclaration' && /app-shared-.*\.js$/.test(node.source.value))
      .flatMap(node => node.specifiers).find(node => key(node.imported) === alias)?.local.name;
    const calls = local ? nodes(ast).filter(node => node.type === 'CallExpression' && node.arguments[0]?.name === local && node.arguments[1]?.type === 'ObjectExpression') : [];
    return { code, ast, calls };
  });
  const summarySource = read(entries.find(entry => /webview[\\/]assets[\\/]thread-summary-panel-components-.*\.js$/.test(entry)));
  const summaryAst = parseAst(summarySource);
  const summaryClasses = [...summarySource.matchAll(/`([^`]*group\/summary-panel[^`]*)`/g)].map(match => match[1])[0];
  assert.ok(summaryClasses && summarySource.includes('"data-summary-panel-variant"'), drift);
  const controlClass = css.match(/\.(_controlSurface_[\w]+)\{background:linear-gradient\(var\(--color-background-viewer-control\)/)?.[1];
  assert.ok(controlClass, `${drift}: viewer control material changed`);
  cachedNative = { css, render, consumers, summaryAst, summaryClasses, controlClass, drift };
  return cachedNative;
};

test('installed summary fade renderer retains default, solid and portal branches plus three native consumers', { skip }, () => {
  const native = loadNative();
  for (const variant of [undefined, 'solid']) for (const fadeOpacity of [undefined, 0, .4, 1]) {
    const direct = native.render({ variant, fadeOpacity, children: null });
    const fade = direct.props.children[0];
    assert.equal(direct.tag, 'div');
    assert.equal(fade.tag, 'div');
    assert.equal(fade.props['aria-hidden'], true);
    assert.equal(fade.props.children, undefined, `${native.drift}: fade must remain decorative and empty`);
    assert.equal(fade.props.style.opacity, fadeOpacity ?? 1);
    assert.match(fade.props.className, /\bfrom-surface-elevated-secondary\b/);
    assert.ok(direct.props.className.includes(variant === 'solid' ? 'h-12 bg-surface-elevated-secondary' : 'h-16'), native.drift);
    const portaled = native.render({ variant, fadeOpacity, children: null, portalContainer: 'header-portal' });
    assert.equal(portaled.tag, '#fragment');
    assert.equal(portaled.props.children[0].props['aria-hidden'], true);
    assert.equal(portaled.props.children[1].tag, '#portal');
    assert.deepEqual(portaled.props.children[1].props.children, direct);
  }
  const calls = native.consumers.flatMap(consumer => consumer.calls);
  assert.equal(calls.length, 3, `${native.drift}: re-audit all consumers when count changes`);
  assert.ok(calls.some(call => text(prop(call.arguments[1], 'variant')) === 'solid' && prop(call.arguments[1], 'children')?.value === null), `${native.drift}: profile identity solid plate missing`);
  assert.ok(calls.some(call => prop(call.arguments[1], 'portalContainer') && prop(call.arguments[1], 'fadeOpacity')), `${native.drift}: animated task title missing`);
  assert.ok(calls.some(call => prop(call.arguments[1], 'portalContainer') && !prop(call.arguments[1], 'fadeOpacity')), `${native.drift}: compact task title missing`);
  assert.ok(native.consumers.some(consumer => consumer.code.includes('"data-orbit-profile-identity"') && consumer.code.includes('variant:`dynamic-isle`')), `${native.drift}: collapsed profile owner changed`);
});

test('native task portals and collapsed identity paints remain inside their actual summary owners', { skip }, () => {
  const native = loadNative();
  const consumer = native.consumers.find(item => item.calls.length === 3);
  assert.ok(consumer, native.drift);
  const summaryImport = consumer.ast.body.find(node => node.type === 'ImportDeclaration' && /thread-summary-panel-components-.*\.js$/.test(node.source.value));
  const summaryExport = native.summaryAst.body.filter(node => node.type === 'ExportNamedDeclaration').flatMap(node => node.specifiers)
    .find(specifier => nodes(native.summaryAst).some(node => node.type === 'AssignmentExpression' && node.left.name === specifier.local.name && prop(node.right, 'Content')));
  const summaryName = summaryImport?.specifiers.find(specifier => key(specifier.imported) === key(summaryExport?.exported))?.local.name;
  assert.ok(summaryName, `${native.drift}: summary Content import/export mapping changed`);
  const module = nodes(native.summaryAst).find(node => node.type === 'AssignmentExpression' && node.left.name === summaryExport.local.name && prop(node.right, 'Content'));
  const contentFunction = native.summaryAst.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === prop(module.right, 'Content').name);
  const contentNodes = ownNodes(contentFunction), contentAliases = aliasResolver(contentFunction);
  const contentPaint = contentNodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'data-summary-panel-variant'));
  const variantDefault = contentNodes.find(node => node.type === 'VariableDeclarator' && node.init?.type === 'ConditionalExpression' && text(node.init.consequent) === 'summary');
  assert.ok(contentPaint && variantDefault && contentAliases.resolves(prop(contentPaint.arguments[1], 'data-summary-panel-variant'), variantDefault.init),
    `${native.drift}: Content must retain the semantic owner and default summary variant`);
  const contentParameters = contentNodes.find(node => node.type === 'ObjectPattern' && node.properties.some(property => key(property.key) === 'scrollable'));
  const parameter = name => contentParameters?.properties.find(property => key(property.key) === name)?.value;
  const childrenParameter = parameter('children'), scrollableParameter = parameter('scrollable');
  const scrollableDefault = contentNodes.find(node => node.type === 'VariableDeclarator' && node.init?.type === 'LogicalExpression' &&
    node.init.operator === '||' && node.init.right.name === scrollableParameter?.name && node.init.left.type === 'BinaryExpression' &&
    node.init.left.operator === '===' && node.init.left.left.name === scrollableParameter?.name && node.init.left.right.type === 'UnaryExpression' && node.init.left.right.operator === 'void');
  const forwardedChildren = contentNodes.find(node => node.type === 'ConditionalExpression' && node.test?.name === scrollableDefault?.id.name && node.alternate?.name === childrenParameter?.name);
  assert.ok(scrollableDefault && forwardedChildren && contentAliases.resolves(prop(contentPaint.arguments[1], 'children'), forwardedChildren),
    `${native.drift}: non-scrolling Content must forward its children directly inside the semantic summary owner`);
  const isContent = node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' &&
    node.arguments[0].object.name === summaryName && key(node.arguments[0].property) === 'Content';
  const directChild = (call, target, resolves) => {
    const child = prop(call.arguments[1], 'children');
    return child?.type === 'ArrayExpression' ? child.elements.some(element => resolves(element, target)) : resolves(child, target);
  };

  const portalRenderers = consumer.calls.filter(call => prop(call.arguments[1], 'portalContainer')).map(call => ownerFunction(consumer.ast, call).id.name);
  const portalUses = nodes(consumer.ast).filter(node => node.type === 'CallExpression' && portalRenderers.includes(node.arguments[0]?.name) && prop(node.arguments[1], 'portalContainer'));
  assert.equal(portalUses.length, 2, `${native.drift}: both compact and animated task headers need an audited portal host`);
  const task = ownerFunction(consumer.ast, portalUses[0]);
  assert.ok(portalUses.every(call => ownerFunction(consumer.ast, call) === task), `${native.drift}: task title branches no longer share their owner`);
  const taskNodes = ownNodes(task), taskAliases = aliasResolver(task);
  const portalState = prop(portalUses[0].arguments[1], 'portalContainer');
  assert.ok(portalState?.type === 'Identifier' && portalUses.every(call => prop(call.arguments[1], 'portalContainer')?.name === portalState.name), native.drift);
  const statePair = taskNodes.find(node => node.type === 'VariableDeclarator' && node.id.type === 'ArrayPattern' && node.id.elements[0]?.name === portalState.name &&
    nodes(node.init).some(child => child.type === 'MemberExpression' && key(child.property) === 'useState'));
  assert.ok(statePair?.id.elements[1]?.name, `${native.drift}: portal target no longer comes from the native ref state`);
  const portalHost = taskNodes.find(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' &&
    prop(node.arguments[1], 'ref')?.name === statePair.id.elements[1].name);
  assert.ok(portalHost, `${native.drift}: task header portal ref host disappeared`);
  const taskContent = taskNodes.find(node => isContent(node) && directChild(node, portalHost, taskAliases.resolves));
  assert.ok(taskContent && prop(taskContent.arguments[1], 'scrollable')?.type === 'UnaryExpression' &&
    prop(taskContent.arguments[1], 'scrollable').operator === '!' && prop(taskContent.arguments[1], 'scrollable').argument.value === 1 &&
    !prop(taskContent.arguments[1], 'variant'), `${native.drift}: portal host must remain a direct child of non-scrolling default summary Content`);
  assert.ok(!prop(portalHost.arguments[1], 'children'), `${native.drift}: portal target must not become a different content owner`);

  const solid = consumer.calls.find(call => text(prop(call.arguments[1], 'variant')) === 'solid');
  const profile = ownerFunction(consumer.ast, solid), profileNodes = ownNodes(profile), profileAliases = aliasResolver(profile);
  const hiddenWrapper = profileNodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'aria-hidden')?.type === 'UnaryExpression' &&
    prop(node.arguments[1], 'aria-hidden').operator === '!' && prop(node.arguments[1], 'aria-hidden').argument.value === 0 &&
    directChild(node, solid, profileAliases.resolves));
  assert.ok(hiddenWrapper, `${native.drift}: solid plate must remain a direct child of its aria-hidden wrapper`);
  const stickyOwner = profileNodes.find(node => node.type === 'CallExpression' && text(prop(node.arguments[1], 'className')).includes('pointer-events-none sticky') &&
    directChild(node, hiddenWrapper, profileAliases.resolves));
  const identity = profileNodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'data-orbit-profile-identity'));
  assert.ok(stickyOwner && identity && directChild(stickyOwner, identity, profileAliases.resolves), `${native.drift}: native profile identity must remain a sibling of decorative paint`);
  const profileContent = profileNodes.find(node => isContent(node) && text(prop(node.arguments[1], 'variant')) === 'dynamic-isle' &&
    directChild(node, stickyOwner, profileAliases.resolves));
  assert.ok(profileContent, `${native.drift}: collapsed plate must remain inside dynamic-isle Content`);
});

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const renderedHeader = (native, id, options = {}) => {
  const portals = [];
  const serialize = tree => {
    if (tree == null || tree === false) return '';
    if (Array.isArray(tree)) return tree.map(serialize).join('');
    if (typeof tree !== 'object') return escape(tree);
    const { tag, props } = tree;
    if (tag === '#fragment') return serialize(props.children);
    if (tag === '#portal') { portals.push(serialize(props.children)); return ''; }
    const marker = props.className?.includes('bg-linear-to-b') ? 'fade' : props.className?.includes('sticky') ? 'header' : props['aria-hidden'] ? 'placeholder' : 'control';
    const attributes = Object.entries(props).filter(([name]) => !['children', 'ref', 'style'].includes(name))
      .map(([name, value]) => `${name === 'className' ? 'class' : name}="${escape(value)}"`).join(' ');
    const style = props.style ? ` style="${Object.entries(props.style).map(([name, value]) => `${name}:${value}`).join(';')}"` : '';
    return `<${tag} id="${id}-${marker}" ${attributes}${style}>${serialize(props.children)}</${tag}>`;
  };
  const result = serialize(native.render({ ...options, children: { tag: 'button', props: { className: `pointer-events-auto ${native.controlClass} bg-surface-elevated-secondary`, children: 'Back to profile' } } }));
  return `${result}${portals.length ? `<div class="pointer-events-none absolute inset-x-0 top-0 z-10 px-6">${portals.join('')}</div>` : ''}`;
};

test('summary header fades match their card in both modes while preserving native gradients, opacity, portals and controls', { skip }, async () => {
  const native = loadNative();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    const fadeClasses = native.render({}).props.children[0].props.className;
    const nonDecorative = `<div id="preview-fade" aria-hidden="true" class="${fadeClasses}"><img alt="Native image preview"></div><button id="interactive-fade" class="${fadeClasses}">Native action</button>`;
    const panel = (id, children, variant = 'summary') => `<section id="${id}" data-summary-panel-variant="${variant}" class="${native.summaryClasses} bg-surface-elevated-secondary rounded-2xl">${children}<div data-scroll class="min-h-0 flex-1 overflow-y-auto"><div class="fixture-content"><p class="native-message bg-primary-soft-alpha">Native message</p><div class="bg-surface-elevated-secondary" data-preview>Native preview</div></div></div></section>`;
    await page.setContent(`<html data-theme="dark"><head><style>${native.css}</style><style>
      body{margin:0;padding:12px}#fixtures{display:flex;align-items:start;gap:12px}section{width:var(--fixture-width,350px);height:320px;flex-shrink:0}
      #profile{height:590px}.fixture-content{min-height:900px;padding-top:90px}#profile>section{height:320px}.unrelated{width:250px;height:180px;position:relative}
    </style></head><body><div id="fixtures">
      <div data-orbit-profile="true">${panel('profile', `<div aria-hidden="true" style="opacity:1">${renderedHeader(native, 'identity', { variant: 'solid' })}</div>${panel('nested-task', renderedHeader(native, 'task', { portalContainer: 'task-portal', fadeOpacity: .4 }))}`, 'dynamic-isle')}</div>
      ${panel('standalone-task', renderedHeader(native, 'compact', { portalContainer: 'compact-portal' }) + nonDecorative)}
      <div class="unrelated">${renderedHeader(native, 'unrelated')}</div>
    </div></body></html>`);
    await page.addStyleTag({ content: theme });
    const read = () => page.locator('[id],.native-message,[data-preview]').evaluateAll(elements => Object.fromEntries(elements.map((element, index) => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return [element.id || `probe-${index}`, { geometry: [rect.x, rect.y, rect.width, rect.height, style.position, style.padding, style.margin, style.borderWidth, style.borderRadius, style.font, style.opacity, style.pointerEvents],
        paint: [style.backgroundColor, style.backgroundImage, style.boxShadow, style.backdropFilter], token: style.getPropertyValue('--color-surface-elevated-secondary').trim(),
        gradient: ['--tw-gradient-position', '--tw-gradient-from-position', '--tw-gradient-to-position', '--tw-gradient-to'].map(name => style.getPropertyValue(name).trim()) }];
    })));
    // Chromium may omit the interpolation-space spelling when replacing the
    // native oklab token with a resolved relative RGB color. Stops and direction
    // remain comparable; the actual native utility stays installed unchanged.
    const gradientShape = value => value.replace(/in oklab,\s*/g, '').replace(/(?:rgba?|color)\([^)]*\)/g, '<color>');
    const fades = ['identity-fade', 'task-fade', 'compact-fade'];
    for (const mode of ['dark', 'light']) for (const width of [300, 390]) for (const scroll of [0, 160]) for (const opacity of [0, .4, 1]) {
      const label = `${mode}/width${width}/scroll${scroll}/opacity${opacity}`;
      await page.evaluate(({ mode, width, scroll, opacity }) => {
        const root = document.documentElement;
        root.classList.remove('forge-ink-mountain');
        Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: 'true' });
        root.style.setProperty('--fixture-width', `${width}px`);
        for (const scroller of document.querySelectorAll('[data-scroll]')) scroller.scrollTop = scroll;
        for (const id of ['identity-fade', 'task-fade', 'compact-fade']) document.getElementById(id).style.opacity = String(opacity);
      }, { mode, width, scroll, opacity });
      const before = await read();
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const after = await read();
      for (const id of Object.keys(before)) assert.deepEqual(after[id].geometry, before[id].geometry, `${label}: ${id} native geometry and alpha`);
      for (const id of fades) {
        assert.notEqual(before[id].paint[1], 'none', `${label}: ${id} must own a real native gradient`);
        assert.notEqual(after[id].paint[1], before[id].paint[1], `${label}: ${id} adopts the summary fill`);
        assert.equal(gradientShape(after[id].paint[1]), gradientShape(before[id].paint[1]), `${label}: ${id} keeps native gradient direction, stops and alpha`);
        assert.deepEqual(after[id].gradient, before[id].gradient, `${label}: ${id} native interpolation, stop positions and transparent end remain intact`);
        assert.deepEqual(after[id].paint.filter((_, index) => index !== 1), before[id].paint.filter((_, index) => index !== 1), `${label}: ${id} changes gradient colors only`);
      }
      const expected = mode === 'dark' ? [64, 76, 88, 255] : [247, 249, 251, 255];
      for (const id of ['identity-header', ...fades]) {
        const rgba = await page.locator(`#${id}`).evaluate(element => {
          const style = getComputedStyle(element), canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d');
          const probe = document.createElement('span');
          probe.style.backgroundColor = element.id.endsWith('-fade') ? style.getPropertyValue('--color-surface-elevated-secondary') : style.backgroundColor;
          document.body.append(probe);
          context.fillStyle = getComputedStyle(probe).backgroundColor;
          probe.remove();
          context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data];
        });
        assert.deepEqual(rgba, expected, `${label}: ${id} uses the opaque card tint`);
      }
      const preserved = Object.keys(before).filter(id => id.endsWith('-control') || id.startsWith('unrelated') || id.startsWith('probe-') || ['preview-fade', 'interactive-fade'].includes(id));
      for (const id of preserved) assert.deepEqual(after[id].paint, before[id].paint, `${label}: ${id} native control/message/preview material is unchanged`);
      assert.equal(after['identity-header'].token, before['identity-header'].token, `${label}: solid plate must not leak a token override to controls`);
      assert.ok(await page.locator('#standalone-task>[data-scroll]').evaluate(element => element.scrollTop) === scroll, `${label}: native scrolling remains available`);
    }
    await page.locator('#compact-control').click();
    assert.equal(await page.locator('#compact-control').evaluate(element => element === document.activeElement), true);
  } finally { await browser.close(); }
});
