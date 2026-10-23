import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseAst } from 'rollup/parseAst';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { loadQuotaNative, quotaNativeSkip, quotaArchive, quotaHtml, key, text, prop, nodes } from './native-quota-current-helper.mjs';

const require = createRequire(import.meta.url);
const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const member = (fn, name) => fn.nodes.find(node => node.type === 'MemberExpression' && key(node.property) === name && node.object.type === 'Identifier')?.object.name;
const classNames = (...values) => values.flat(Infinity).filter(value => typeof value === 'string' && value).join(' ');
const cache = { c: length => Array(length).fill(Symbol.for('react.memo_cache_sentinel')) };
const jsx = { jsx: (tag, props) => typeof tag === 'function' ? tag(props) : ({ tag, props }),
  jsxs: (tag, props) => jsx.jsx(tag, props), Fragment: '#fragment' };
const compile = (fn, bindings) => new Function(...Object.keys(bindings), `return (${fn.source});`)(...Object.values(bindings));
const objectStrings = (fn, name) => {
  const strings = Object.fromEntries(fn.nodes.filter(node => node.type === 'AssignmentExpression' && node.left.type === 'Identifier' && text(node.right))
    .map(node => [node.left.name, text(node.right)]));
  const object = fn.nodes.find(node => node.type === 'AssignmentExpression' && node.left.name === name && node.right.type === 'ObjectExpression')?.right;
  assert.ok(object, `Native goal/floating module changed: ${name}`);
  return Object.fromEntries(object.properties.map(node => [key(node.key), text(node.value) || strings[node.value.name] || '']));
};
const element = (tag, props) => ({ tag, props });
// Resolve only resting animation styles. Native class selection, framing,
// embedded/variant decisions and actual presentation renderers execute intact.
const motion = tag => props => {
  const style = { ...props.style };
  for (const [name, value] of Object.entries(props.animate || {})) {
    if (['top', 'right', 'bottom', 'left', 'borderTopWidth', 'borderBottomWidth'].includes(name)) style[name] = `${value}px`;
    else if (['opacity', 'gridTemplateRows'].includes(name)) style[name] = value;
  }
  return element(tag, { ...props, style });
};

let cached;
const loadGoalNative = () => {
  if (cached) return cached;
  const native = loadQuotaNative();
  const item = native.functionAt('initial', '"data-composer-rail-item":');
  const rail = native.functionAt('initial', '"data-composer-rail":');
  const railModule = member(item, 'item');
  const railClasses = objectStrings(native.functionAt('initial', `${railModule}={rail:`), railModule);
  const backgroundMapName = item.nodes.filter(node => node.type === 'MemberExpression' && node.computed && node.object.type === 'Identifier')
    .map(node => node.object.name).find(name => native.initial.includes(`${name}={default:`));
  assert.ok(backgroundMapName, 'Native goal rail background variant map changed');
  const variantInitializer = native.functionAt('initial', `${backgroundMapName}={default:`);
  const backgrounds = objectStrings(variantInitializer, backgroundMapName);
  const contextCall = item.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'SequenceExpression' &&
    key(node.callee.expressions.at(-1)?.property) === 'useContext');
  const contextName = contextCall.arguments[0].name;
  const fallbackName = item.nodes.find(node => node.type === 'LogicalExpression' && node.operator === '??' && node.right.type === 'Identifier')?.right.name;
  const exitName = item.nodes.find(node => node.type === 'Property' && key(node.key) === 'exit' && node.value.type === 'Identifier')?.value.name;
  const presence = item.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 0)?.callee.name;
  const classes = item.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument) === 'relative min-w-0 overflow-clip text-default'))?.callee.name;
  assert.ok(contextName && fallbackName && exitName && presence && classes, 'Native goal rail pure presentation boundary changed');
  let context;
  const renderItemFn = compile(item, {
    [member(item, 'c')]: cache, [member(item, 'jsx')]: jsx,
    [member(item, 'useContext')]: { useContext: () => context },
    [member(item, 'div')]: { div: motion('div') }, [contextName]: {},
    [fallbackName]: { embedded: false, expandedTopTray: false, placement: 'above', shouldUseReducedMotion: true },
    [exitName]: { gridTemplateRows: '0fr', borderTopWidth: 0, borderBottomWidth: 0 },
    [presence]: () => true, [classes]: classNames, [railModule]: railClasses, [backgroundMapName]: backgrounds
  });
  const renderItem = (options, embedded = true) => {
    context = { embedded, expandedTopTray: false, placement: 'above', shouldUseReducedMotion: true };
    try { return renderItemFn(options); } finally { context = undefined; }
  };
  const railClassCall = rail.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument) === 'relative flex min-w-0 flex-col empty:contents'));
  const railPresence = rail.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 0);
  const animation = rail.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'propagate'));
  const mapper = rail.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && key(node.callee.property) === 'map');
  const expandedWrapper = rail.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'expandedTopTray') && prop(node.arguments[1], 'inFlow'));
  assert.ok(railClassCall && railPresence && animation && mapper && expandedWrapper, 'Native composer rail wrapper changed');
  const contextProvider = props => props.children;
  const renderRail = compile(rail, {
    [member(rail, 'c')]: cache, [member(rail, 'jsx')]: jsx, [railClassCall.callee.name]: classNames,
    [railPresence.callee.name]: () => true, [railModule]: railClasses,
    [mapper.callee.object.object.name]: { Children: { map: children => children } },
    [mapper.arguments[1].name]: value => value,
    [animation.arguments[0].name]: contextProvider, [expandedWrapper.arguments[0].name]: contextProvider,
    [contextName]: { Provider: contextProvider }
  });

  const floating = native.functionAt('shared', '.floatingSurface');
  const floatingModule = member(floating, 'floatingSurface');
  const floatingClasses = objectStrings(native.functionAt('shared', `${floatingModule}={floatingSurface:`), floatingModule);
  const floatClassCall = floating.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' &&
    nodes(node).some(child => child.type === 'MemberExpression' && key(child.property) === 'floatingSurface'));
  const renderFloating = compile(floating, {
    [member(floating, 'c')]: cache, [member(floating, 'jsx')]: jsx, [floatingModule]: floatingClasses,
    [floatClassCall.callee.name]: classNames,
    [member(floating, 'cloneElement')]: { cloneElement: (child, props) => ({ ...child, props: { ...child.props, ...props } }) }
  });
  const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
  const entries = asar.listPackage(quotaArchive);
  const read = entry => asar.extractFile(quotaArchive, entry.replace(/^[/\\]/, '')).toString('utf8');
  const surfaceEntry = entries.find(entry => /webview[\\/]assets[\\/]floating-chat-surface-.*\.js$/.test(entry));
  const source = read(surfaceEntry), ast = parseAst(source);
  const frameAst = ast.body.find(node => node.type === 'FunctionDeclaration' && nodes(node).some(child => text(child) === 'group/chat-frame focus:outline-none'));
  assert.ok(frameAst, 'Native compact floating chat frame changed');
  const frame = { ast: frameAst, source: source.slice(frameAst.start, frameAst.end), nodes: nodes(frameAst) };
  const frameModule = member(frame, 'frame');
  const frameInitializer = ast.body.find(node => node.type === 'FunctionDeclaration' && nodes(node).some(child => child.type === 'AssignmentExpression' && child.left.name === frameModule));
  const frameClasses = objectStrings({ nodes: nodes(frameInitializer) }, frameModule);
  const frameClassCall = frame.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.some(argument => text(argument) === 'flex flex-col text-default'));
  const frameFloating = frame.nodes.find(node => node.type === 'CallExpression' && prop(node.arguments[1], 'asChild') && prop(node.arguments[1], 'unstyled'));
  const mergeRef = frame.nodes.find(node => node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.arguments.length === 3);
  assert.ok(frameClassCall && frameFloating && mergeRef, 'Native floating frame paint/transport boundary changed');
  const renderFrame = compile(frame, {
    [member(frame, 'c')]: cache, [member(frame, 'jsx')]: jsx,
    [member(frame, 'section')]: { section: motion('section'), div: motion('div') },
    [frameClassCall.callee.name]: classNames, [frameFloating.arguments[0].name]: renderFloating,
    [frameModule]: frameClasses, [member(frame, 'floatingSurface')]: floatingClasses,
    [mergeRef.callee.name]: () => undefined, [mergeRef.arguments[2].name]: () => {}
  });
  const extraCss = entries.filter(entry => /webview[\\/]assets[\\/]floating-chat-surface-.*\.css$/.test(entry)).map(read).join('\n');
  cached = { ...native, item, rail, backgrounds, railClasses, floating, floatingClasses, frame, source,
    css: `${native.css}\n${extraCss}`, renderItem, renderRail, renderFloating, renderFrame };
  return cached;
};

test('native embedded goal rows have no background owner while independent default/warning rows do', { skip: quotaNativeSkip }, () => {
  const native = loadGoalNative();
  const embedded = native.renderItem({ children: 'Goal' });
  const independent = native.renderItem({ children: 'Goal' }, false);
  assert.equal(embedded.props['data-composer-rail-item'], 'present');
  assert.equal(embedded.props['data-composer-rail-contained'], '');
  assert.equal(embedded.props['data-composer-rail-framed'], undefined);
  assert.ok(!/(?:^|\s)bg-/.test(embedded.props.className));
  assert.match(independent.props.className, /(?:^|\s)bg-surface-elevated-secondary(?:\s|$)/);
  assert.equal(independent.props['data-composer-rail-framed'], '');
  assert.match(native.renderItem({ variant: 'warning' }, false).props.className, /(?:^|\s)bg-\[/);
  for (const variant of ['controls', 'inline']) assert.ok(!/(?:^|\s)bg-/.test(native.renderItem({ variant }).props.className));
  const section = native.frame.nodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' && key(node.arguments[0].property) === 'section');
  assert.ok(section && prop(section.arguments[1], 'children').elements.length === 3);
  assert.ok(native.frame.nodes.some(node => text(node) === 'overflow-visible'));
  const frame = native.renderFrame({ background: 'panel', prefersCompactPresentation: true, keepSurfaceInset: true,
    isCompact: true, resizable: false, shouldReduceMotion: true, sectionProps: { 'data-quick-chat-drag-handle': true, 'data-pip-obstacle': 'quick-chat' } });
  assert.equal(frame.tag, 'section');
  assert.ok(!/(?:^|\s)bg-/.test(frame.props.className), 'The drag frame must remain unpainted');
  assert.match(frame.props.children[0].props.className, /(?:^|\s)bg-surface-elevated-secondary(?:\s|$)/);
});

const legacyRailPaint = current => {
  const sheet = postcss.parse(current);
  let restored = 0;
  sheet.walkRules(rule => {
    if (rule.selector.includes('[data-composer-rail-item]') && rule.selector.includes('.forge-composer-progress-pill')) {
      rule.selector = ':root.forge-ink-mountain :is(.forge-composer-panel[class*="bg-"], [data-composer-rail-item], .forge-composer-progress-pill[class*="bg-"])';
      restored++;
    } else if (rule.selector.startsWith(':root.forge-ink-mountain .forge-composer-panel') && rule.nodes.some(node => node.prop === 'backdrop-filter')) {
      rule.selector = ':root.forge-ink-mountain .forge-composer-panel[class*="bg-"]';
      restored++;
    }
  });
  assert.equal(restored, 2, 'The negative control must restore both original rail paint selectors');
  return sheet.toString();
};

test('body-portal floating goals remain transparent in collapsed/expanded layouts and preserve their real outer surface', { skip: quotaNativeSkip }, async () => {
  const native = loadGoalNative();
  const oldTheme = legacyRailPaint(theme);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) for (const layout of ['single-line', 'multiline']) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, colorScheme: mode });
      try {
        const button = (id, children) => native.renderButton({ id, children, size: 'composer', color: 'ghost' });
        const goal = native.renderItem({ id: 'goal', className: 'forge-composer-panel', children: [
          element('span', { children: '示例目标' }), button('pause-goal', '暂停目标'), button('expand-goal', '展开目标')
        ] });
        const rail = native.renderRail({ embedded: true, children: goal });
        const input = native.renderComposerRoot({ layout, radiusVariant: 'compact', surfaceVariant: 'inline', density: 'compact',
          children: native.renderComposerBody({ layout, children: [element('input', { id: 'message', 'aria-label': 'Fixture message', value: 'Draft' }), button('send', '发送')] }) });
        const content = element('div', { 'data-floating-chat-surface': true, className: 'relative z-0 flex min-h-0 flex-1 flex-col',
          children: element('div', { 'data-codex-composer-root': '', children: [rail, input] }) });
        const frame = native.renderFrame({ background: 'panel', prefersCompactPresentation: true, keepSurfaceInset: true,
          isCompact: layout === 'single-line', resizable: false, shouldReduceMotion: true,
          sectionProps: { id: 'frame', 'data-quick-chat-drag-handle': true, 'data-pip-obstacle': 'quick-chat',
            style: { top: '40px', left: '40px', width: '580px', height: layout === 'single-line' ? '150px' : '230px' } }, children: content });
        frame.props.children[0].props.id = 'floating-paint';
        const independent = native.renderItem({ id: 'independent', className: 'forge-composer-panel', children: button('independent-control', '独立目标') }, false);
        const warning = native.renderItem({ id: 'warning', className: 'forge-composer-panel', variant: 'warning', children: 'Native warning' }, false);
        const transparentVariants = ['controls', 'inline'].map(variant => native.renderItem({ id: variant, className: 'forge-composer-panel', variant, children: 'Native transparent row' }));
        const negativeTokens = ['hover:bg-surface-elevated-secondary', 'after:bg-surface-elevated-secondary', 'bg-transparent'].map((className, index) => native.renderItem({ id: `negative-${index}`, variant: 'inline', className: `forge-composer-panel ${className}`, children: 'Transparent token control' }));
        // Portal mounting is represented by a body sibling, as observed live;
        // goal, rail, composer primitives and floating frame/paint execute the
        // installed pure renderers. Fixture bounds add no clipping or backing.
        await page.setContent(`<html data-theme="${mode}" data-forge-native-theme="${mode}" data-codex-os="win32" data-codex-window-type="electron"><head><style>${native.css}</style><style>
          body{margin:0;background:linear-gradient(120deg,#233e55,#b8cbd1)}#root{width:320px;height:650px}
          #independent,#warning,#controls,#inline,[id^="negative-"]{max-width:320px}
        </style></head><body><div id="root">${[independent, warning, ...transparentVariants, ...negativeTokens].map(quotaHtml).join('')}</div>${quotaHtml(frame)}</body></html>`);
        assert.equal(await page.locator('#frame').evaluate(node => document.body.contains(node) && !document.getElementById('root').contains(node)), true);
        const capture = () => page.locator('#frame,#frame *,#root [data-composer-rail-item],#root button').evaluateAll(elements => Object.fromEntries(elements.map((node, index) => {
          const style = getComputedStyle(node), rect = node.getBoundingClientRect();
          const pseudo = name => { const p = getComputedStyle(node, name); return [p.content, p.backgroundColor, p.backgroundImage, p.borderRadius, p.boxShadow, p.backdropFilter]; };
          return [node.id || `node-${index}`, { rect: [rect.x, rect.y, rect.width, rect.height], geometry: [style.borderRadius, style.cornerShape, style.padding, style.margin, style.borderWidth, style.position, style.overflow, style.font],
            paint: [style.backgroundColor, style.backgroundImage, style.boxShadow, style.backdropFilter, style.color], before: pseudo('::before'), after: pseudo('::after'),
            disabled: node.disabled ?? null, tabindex: node.tabIndex, value: node.value ?? null }];
        })));
        const baseline = await capture();
        assert.deepEqual(baseline.goal.paint.slice(0, 4), ['rgba(0, 0, 0, 0)', 'none', 'none', 'none']);
        assert.equal(baseline.goal.geometry[0], '0px', 'The contained native goal row intentionally has square corners');
        assert.equal(baseline['floating-paint'].geometry[0], '22px');
        const style = await page.addStyleTag({ content: oldTheme });
        await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
        const legacy = await capture();
        assert.notEqual(legacy.goal.paint[0], 'rgba(0, 0, 0, 0)', 'Old CSS must reproduce the square goal background');
        assert.match(legacy.goal.paint[1], /linear-gradient/, 'Old CSS must reproduce the goal highlight outside the real rounded owner');
        assert.equal(legacy.goal.geometry[0], '0px');
        await style.evaluate((node, content) => { node.textContent = content; }, theme);
        const after = await capture();
        for (const id of Object.keys(baseline)) {
          assert.deepEqual(after[id].rect, baseline[id].rect, `${mode}/${layout}: ${id} retains native bounds`);
          assert.deepEqual(after[id].geometry, baseline[id].geometry, `${mode}/${layout}: ${id} retains native geometry`);
          assert.deepEqual(after[id].before, baseline[id].before, `${mode}/${layout}: ${id} before pseudo stays native`);
          assert.deepEqual(after[id].after, baseline[id].after, `${mode}/${layout}: ${id} after pseudo stays native`);
          for (const field of ['disabled', 'tabindex', 'value']) assert.deepEqual(after[id][field], baseline[id][field]);
        }
        for (const id of ['goal', 'frame', 'controls', 'inline', 'negative-0', 'negative-1', 'negative-2']) {
          assert.deepEqual(after[id].paint, baseline[id].paint, `${mode}/${layout}: ${id} cannot become a new square paint owner`);
        }
        assert.equal(after.frame.geometry[6], 'visible', 'The real drag frame must not clip overlays or resize handles');
        for (const id of ['floating-paint', 'independent', 'warning']) {
          assert.notEqual(after[id].paint[0], 'rgba(0, 0, 0, 0)', `${id} retains readable fill`);
          assert.match(after[id].paint[1], /linear-gradient/);
          assert.match(after[id].paint[3], /blur\(/);
        }
        for (const id of ['message', 'send', 'pause-goal', 'expand-goal', 'independent-control']) assert.deepEqual(after[id], baseline[id], `${id} remains a native control`);
        await page.getByRole('textbox', { name: 'Fixture message' }).fill('Input still works');
        assert.equal(await page.locator('#message').inputValue(), 'Input still works');
        await page.getByRole('button', { name: '暂停目标', exact: true }).click();
        assert.equal(await page.locator('#pause-goal').evaluate(node => node === document.activeElement), true);
        await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
        const restored = await capture();
        for (const id of ['goal', 'floating-paint', 'independent', 'warning']) assert.deepEqual(restored[id].paint, baseline[id].paint, `${id} restores native material`);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
