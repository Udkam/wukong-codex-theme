import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nativeFunction, nativeObject, ownNodes } from './native-bundle-current-helper.mjs';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { loadQuotaNative, quotaNativeSkip, quotaHtml, key, text, prop, nodes } from './native-quota-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const element = (tag, props) => ({ tag, props });
const frameSlots = frame => {
  const content = frame.props.children;
  assert.equal(content?.tag, 'div', 'Native floating section must retain its content transport wrapper');
  assert.equal(content.props.className, 'contents', 'The resting native content wrapper must not add paint or geometry');
  assert.equal(content.props.children.length, 4, 'Native floating content must retain background, resize, minimized and composer slots');
  return content.props.children;
};
// Installed Rspack module factories execute only audited presentation code.
// Memo cache, hooks, motion transport and editor slots are inert boundaries.
let cached;
const loadGoalNative = () => {
  if (cached) return cached;
  const native = loadQuotaNative(), { bundle, harness } = native;
  const records = bundle.findModules(['"data-composer-rail-item"', '"data-composer-rail"']);
  assert.equal(records.length, 1, 'Native composer rail module must be unique');
  const record = records[0], item = nativeFunction(record, '"data-composer-rail-item"'), rail = nativeFunction(record, '"data-composer-rail"');
  const backgroundMap = nodes(record.ast).find(node => node.type === 'ObjectExpression' && text(prop(node, 'default')) === 'bg-surface-elevated-secondary' && prop(node, 'warning'));
  assert.ok(backgroundMap, 'Native background variant map changed');
  const backgrounds = nativeObject(record, backgroundMap);
  const registry = harness.load(record.id).l;
  const member = call => call?.callee?.type === 'SequenceExpression' ? call.callee.expressions.at(-1) : call?.callee;
  const contextCalls = item.nodes.filter(node => node.type === 'CallExpression' && key(member(node)?.property) === 'useContext');
  assert.equal(contextCalls.length, 1, 'Native Rail.Item context reader changed');
  const contextCall = contextCalls[0], contextName = contextCall.arguments[0]?.name;
  assert.ok(contextName, 'Native Rail.Item must read its module-owned context');
  const contextDefinition = ownNodes(record.ast).find(node => node.type === 'VariableDeclarator' && node.id.name === contextName);
  assert.equal(key(member(contextDefinition?.init)?.property), 'createContext', 'Native rail context initializer changed');
  assert.equal(contextDefinition.init.arguments[0]?.value, null, 'Native rail context default changed');
  assert.equal(member(contextDefinition.init).object.name, member(contextCall).object.name,
    'Native rail context creation and reading must use the same React transport');
  assert.ok(rail.nodes.some(node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' &&
    node.arguments[0].object.name === contextName && key(node.arguments[0].property) === 'Provider'),
  'The actual rail provider must own the context read by Rail.Item');
  const reactImport = bundle.imports(record)[member(contextCall).object.name];
  const react = harness.modules[reactImport?.id];
  assert.equal(typeof react?.useContext, 'function', 'Native rail React presentation transport changed');
  const observed = [], readContext = react.useContext;
  react.useContext = value => { observed.push(value); return readContext(value); };
  // Capture the genuine private context through the one audited Item reader.
  // Other presentation modules may create their own null-default contexts.
  try { registry.Item({ children: null }); } finally { react.useContext = readContext; }
  assert.equal(observed.length, 1, 'Native Rail.Item must retain one direct context read');
  const [context] = observed;
  assert.equal(context?.defaultValue, null, 'Native rail context boundary changed');
  const renderItem = (options, embedded = true, { present = true } = {}) => {
    const presence = harness.modules.iodE;
    const previous = presence.tF;
    presence.tF = () => present;
    harness.contexts.set(context, { embedded, placement: 'above', shouldUseReducedMotion: true });
    try { return registry.Item(options); } finally { harness.contexts.delete(context); presence.tF = previous; }
  };
  const railClasses = Object.fromEntries(['rail', 'embedded', 'item', 'attached'].map(name => [name,
    nodes(record.ast).map(text).find(value => value.startsWith(`${name}-`) && !value.includes(' '))]));
  const floatingRecord = bundle.findModules(['.floatingSurface', '.singleLineSurface', '"composer"']).filter(record => record.source.length < 5000);
  assert.equal(floatingRecord.length, 1, 'Native floating presentation module changed');
  const floating = nativeFunction(floatingRecord[0], '.floatingSurface');
  const floatImport = Object.values(bundle.imports(floatingRecord[0])).find(imported => {
    const object = bundle.exports(bundle.module(imported.id)).A;
    return object?.type === 'ObjectExpression' && prop(object, 'floatingSurface');
  });
  assert.ok(floatImport, 'Native floating CSS module changed');
  const cssMap = bundle.module(floatImport.id), floatingClasses = nativeObject(cssMap, bundle.exports(cssMap).A);
  const frameRecords = bundle.findModules(['group/chat-frame focus:outline-none', 'prefersCompactPresentation']);
  assert.equal(frameRecords.length, 1, 'Native floating frame module changed');
  const frame = nativeFunction(frameRecords[0], 'group/chat-frame focus:outline-none');
  const frameClass = frame.nodes.map(text).find(value => /^frame-\S+$/.test(value));
  assert.ok(frameClass, 'Native floating frame CSS module changed');
  const renderFrame = harness.compile(frame);
  cached = { ...native, item, rail, backgrounds, railClasses, floating, floatingClasses, frame, source: frameRecords[0].source,
    css: `${native.css}\n${bundle.css(floatingClasses.floatingSurface)}\n${bundle.css(frameClass)}\n${bundle.css(railClasses.item)}`,
    renderItem, renderRail: registry, renderFloating: harness.load(floatingRecord[0].id).kW, renderFrame };
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
  for (const [variant, embedded, painted] of [
    ['default', true, false], ['default', false, true],
    ['warning', true, true], ['warning', false, true],
    ['controls', true, false], ['controls', false, false],
    ['inline', true, false], ['inline', false, false]
  ]) assert.equal(/(?:^|\s)bg-/.test(native.renderItem({ variant }, embedded).props.className), painted,
    `${variant}/${embedded ? 'embedded' : 'independent'} retains the current native background ownership`);
  const section = native.frame.nodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' && key(node.arguments[0].property) === 'section');
  const content = native.frame.nodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' &&
    key(node.arguments[0].property) === 'div' && prop(node.arguments[1], 'children')?.type === 'ArrayExpression' &&
    prop(node.arguments[1], 'children').elements.length === 4);
  const sectionChild = prop(section?.arguments[1], 'children');
  assert.ok(content && sectionChild?.type === 'Identifier' && ownNodes(native.frame.ast).some(node =>
    node.type === 'AssignmentExpression' && node.left.name === sectionChild.name && node.right === content),
  'The section must directly retain the native content wrapper containing all four floating slots');
  assert.ok(native.frame.nodes.some(node => text(node) === 'overflow-visible'));
  const frame = native.renderFrame({ background: 'panel', prefersCompactPresentation: true, keepSurfaceInset: true,
    isCompact: true, resizable: false, shouldReduceMotion: true, sectionProps: { 'data-quick-chat-drag-handle': true, 'data-pip-obstacle': 'quick-chat' } });
  assert.equal(frame.tag, 'section');
  assert.ok(!/(?:^|\s)bg-/.test(frame.props.className), 'The drag frame must remain unpainted');
  assert.match(frameSlots(frame)[0].props.className, /(?:^|\s)bg-surface-elevated-secondary(?:\s|$)/);
});

const legacyRailPaint = current => {
  const sheet = postcss.parse(current);
  let restored = 0;
  sheet.walkRules(rule => {
    if (rule.selector.includes('[data-composer-rail-item]') && rule.nodes.some(node => node.prop === 'background-color')) {
      rule.selector = ':root.forge-ink-mountain :is(.forge-composer-panel[class*="bg-"], [data-composer-rail-item])';
      restored++;
    } else if (rule.selector.includes('[data-composer-rail-item]') && rule.selector.includes('[data-composer-utility-rail]') &&
        rule.nodes.some(node => node.prop === 'backdrop-filter')) {
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
        frameSlots(frame)[0].props.id = 'floating-paint';
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

test('newly mounted and exiting native goals and queues keep the same themed paint owner', { skip: quotaNativeSkip }, async () => {
  const native = loadGoalNative(), { bundle } = native;
  const rail = native.item.record;
  const [goal] = bundle.findModules(['composer.threadGoal.clearTooltip', `"${rail.id}"`]);
  const [queue] = bundle.findModules(['composer.queuedMessage.resumeInterruptedQueue', 'vertical-scroll-fade-mask', `"${rail.id}"`]);
  assert.ok(goal && queue, 'Native goal and queue must both use the installed rail');
  const itemCall = (record, anchor) => {
    const root = nativeFunction(record, anchor).ast;
    const imports = bundle.imports(record);
    const call = ownNodes(root).find(node => node.type === 'CallExpression' && key(node.arguments[0]?.property) === 'Item' &&
      imports[node.arguments[0].object.object?.name]?.id === rail.id);
    assert.ok(call, 'The actual shared Rail.Item must own this presentation');
    return { call, root };
  };
  const goalItem = itemCall(goal, 'composer.threadGoal.clearTooltip');
  assert.equal(prop(goalItem.call.arguments[1], 'variant'), undefined, 'Goal inherits the default rail item variant');
  const queueItem = itemCall(queue, 'composer.queuedMessage.resumeInterruptedQueue');
  const variant = prop(queueItem.call.arguments[1], 'variant');
  const variantDefinition = ownNodes(queueItem.root).find(node => node.type === 'VariableDeclarator' && node.id.name === variant?.name)?.init;
  assert.equal(variantDefinition?.type, 'ConditionalExpression');
  assert.deepEqual([text(variantDefinition.consequent), text(variantDefinition.alternate)], ['inline', 'default']);
  assert.match(queue.source.slice(variantDefinition.test.start, variantDefinition.test.end), /isCompact/,
    'Only the noncompact floating queue switches to an inline item');
  const listClass = ownNodes(queueItem.root).map(text).find(value => value.startsWith('vertical-scroll-fade-mask '));
  const leafClass = nodes(queue.ast).find(node => node.type === 'ObjectExpression' &&
    text(prop(node, 'className')) === 'overflow-visible' && prop(node, 'initial') && prop(node, 'exit'));
  assert.ok(listClass && leafClass, 'Native queue preserves one scrolling list with unpainted motion leaves');
  const oldPaint = postcss.parse(theme);
  let count = 0;
  oldPaint.walkRules(rule => {
    if (rule.selector.includes('[data-composer-utility-rail]') && rule.nodes.some(node => node.prop === 'backdrop-filter' && node.value !== 'none')) {
      rule.selector = rule.selector.replace('[data-composer-rail-item]', '.forge-composer-panel');
      count++;
    }
  });
  assert.equal(count, 1, 'Restore only the former runtime-mark dependency in the rail filter');
  const previewDirectory = process.env.WUKONG_COMPOSER_RAIL_PREVIEW_DIRECTORY;
  const previewBackdrop = previewDirectory
    ? fs.readFileSync(new URL('../themes/backgrounds/scenery-08.jpg', import.meta.url)).toString('base64') : '';
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ colorScheme: mode, viewport: { width: 640, height: 520 } });
      try {
        const row = (title, action) => native.renderRail.Row({ title, actions: action ?
          native.renderRail.Action({ children: action }) : undefined });
        const queueChildren = element('div', { className: listClass, children: [1, 2].map(index =>
          element('div', { id: `queue-leaf-${index}`, className: text(prop(leafClass, 'className')), children:
            row(index === 1 ? '检查变更后的界面' : '运行完整验证', '发送') })) });
        const parts = present => [
          native.renderItem({ id: 'goal-default', children: row('示例目标：修复输入区显示', '暂停目标') }, false, { present }),
          native.renderItem({ id: 'queue-default', children: queueChildren }, false, { present }),
          native.renderItem({ id: 'warning', variant: 'warning', children: 'Connection warning' }, false, { present }),
          native.renderItem({ id: 'goal-embedded', children: 'Embedded goal' }, true, { present }),
          native.renderItem({ id: 'rail-controls', variant: 'controls', children: 'Native controls row' }, false, { present }),
          native.renderItem({ id: 'queue-inline', variant: 'inline', children: 'Floating queue' }, true, { present })
        ].map(quotaHtml).join('');
        const backdrop = previewBackdrop ? `body{background:center 55% / cover no-repeat url(data:image/jpeg;base64,${previewBackdrop})}` : '';
        await page.setContent(`<html class="forge-ink-mountain" data-theme="${mode}" data-forge-native-theme="${mode}" style="color-scheme:${mode}">
          <style>${native.css}</style><style>body{margin:0;padding:12px 20px}${backdrop}</style><style id="theme">${oldPaint.toString()}</style><body><div id="root"><div data-composer-rail>${parts(true)}</div></div><div id="portal"></div></body></html>`);
        const rows = page.locator('[data-composer-rail-item],#queue-leaf-1,#queue-leaf-2');
        const read = () => rows.evaluateAll(elements => Object.fromEntries(elements.map(node => {
          const style = getComputedStyle(node), rect = node.getBoundingClientRect();
          return [node.id, { fill: style.backgroundColor, image: style.backgroundImage, filter: style.backdropFilter,
            rect: [rect.x, rect.y, rect.width, rect.height], radius: style.borderRadius, opacity: style.opacity,
            state: node.getAttribute('data-composer-rail-item'), inert: node.inert }];
        })));
        const previously = await read();
        for (const id of ['goal-default', 'queue-default', 'warning']) assert.equal(previously[id].filter, 'none');
        await page.locator('#theme').evaluate((style, next) => { style.textContent = next; }, theme);
        const mounted = await read();
        for (const [id, row] of Object.entries(mounted)) {
          assert.deepEqual(row.rect, previously[id].rect);
          assert.equal(row.radius, previously[id].radius);
          assert.equal(row.opacity, previously[id].opacity);
        }
        const verifyPaint = values => {
          for (const id of ['goal-default', 'queue-default', 'warning']) {
            assert.notEqual(values[id].fill, 'rgba(0, 0, 0, 0)');
            assert.match(values[id].image, /linear-gradient/);
            assert.match(values[id].filter, /blur\(/);
          }
          for (const id of ['goal-embedded', 'rail-controls', 'queue-inline', 'queue-leaf-1', 'queue-leaf-2']) {
            assert.equal(values[id].fill, 'rgba(0, 0, 0, 0)');
            assert.equal(values[id].image, 'none');
            assert.equal(values[id].filter, 'none');
          }
        };
        verifyPaint(mounted);
        assert.equal(await page.locator('[data-forge-mark],.forge-composer-panel').count(), 0);
        if (previewDirectory) {
          fs.mkdirSync(previewDirectory, { recursive: true });
          const queueBox = await page.locator('#queue-default').boundingBox();
          assert.ok(queueBox);
          await page.screenshot({ path: path.join(previewDirectory, `${mode}-goal-queue-fixture-20261117.png`),
            clip: { x: 0, y: 0, width: 640, height: Math.ceil(queueBox.y + queueBox.height) } });
        }
        await page.locator('[data-composer-rail]').evaluate((rail, html) => { rail.innerHTML = html; }, parts(false));
        const exiting = await read();
        verifyPaint(exiting);
        for (const id of ['goal-default', 'queue-default', 'warning']) {
          assert.equal(exiting[id].state, 'exiting');
          assert.equal(exiting[id].inert, true);
          assert.equal(exiting[id].filter, mounted[id].filter);
        }
        await page.locator('#portal').evaluate((portal, html) => {
          document.querySelector('#root [data-composer-rail]').remove();
          portal.innerHTML = `<div data-composer-rail>${html}</div>`;
        }, parts(true));
        verifyPaint(await read());
        assert.equal(await page.locator('#portal [data-composer-rail-item="present"]').count(), 6);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
