import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { cssFor, SCENE_TONES } from '../shared/theme-model.mjs';
import { makeApplyExpression, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import { loadNativeBundle, nodes, ownNodes, prop, key, text, nativeFunction, nativeObject, presentationHarness } from './native-bundle-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const active = JSON.parse(fs.readFileSync(new URL('../themes/active.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const one = (values, message) => { assert.equal(values.length, 1, message); return values[0]; };
const jsx = node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression';
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const html = tree => {
  if (tree == null || tree === false) return '';
  if (Array.isArray(tree)) return tree.map(html).join('');
  if (typeof tree !== 'object') return escape(tree);
  if (tree.tag === '#fragment') return html(tree.props.children);
  const attrs = Object.entries(tree.props).filter(([name, value]) => !['children', 'ref', 'style'].includes(name) && !name.startsWith('on') && value != null &&
    (value !== false || /^(?:aria-|data-)/.test(name))).map(([name, value]) => ` ${name === 'className' ? 'class' : name === 'tabIndex' ? 'tabindex' : name}="${escape(value)}"`).join('');
  return `<${tree.tag}${attrs}>${html(tree.props.children)}</${tree.tag}>`;
};
const element = (tag, props) => ({ tag, props });

let cached;
const loadSidebar = () => {
  if (cached) return cached;
  const bundle = loadNativeBundle();
  const shell = one(bundle.findModules(['data-sidebar-navigation-root', 'data-slate-sidebar-content', 'app-shell-floating-left-panel']), 'Native sidebar shell changed');
  const navigation = one(nodes(shell.ast).filter(node => jsx(node) && prop(node.arguments[1], 'data-sidebar-navigation-root')), 'Native outer navigation changed');
  const slate = one(nodes(shell.ast).filter(node => jsx(node) && prop(node.arguments[1], 'data-slate-sidebar-content')), 'Native slate navigation changed');
  const owner = nativeFunction(shell, navigation.start), slateOwner = nativeFunction(shell, slate.start);
  const navigationClass = nodes(prop(navigation.arguments[1], 'className')).map(text).find(value => value.endsWith('overflow-hidden sidebar-navigation'));
  const slateClass = slateOwner.nodes.map(text).find(value => value.endsWith('overflow-hidden sidebar-navigation'));
  const peekClass = slateOwner.nodes.map(text).find(value => value.includes('bg-(--app-shell-sidebar-popover-background)'));
  assert.ok(navigationClass && slateClass && peekClass, 'Native paint carriers and peek background must remain source bound');
  const navClass = owner.nodes.map(text).find(value => /^Navigation-\S+$/.test(value));
  assert.ok(navClass, 'Native conversation navigation content changed');

  // Follow the actual shared-sidebar lazy ActivitySidebar branch; do not run
  // that factory, its data hooks, navigation, or account operations.
  const activityCall = ownNodes(owner.ast).find(node => jsx(node) && prop(node.arguments[1], 'showBack') && node.arguments[0]?.type === 'MemberExpression');
  const provider = bundle.module(bundle.imports(shell)[activityCall?.arguments[0].object.name]?.id);
  const providerExport = bundle.exports(provider)[key(activityCall.arguments[0].property)];
  const providerRenderer = ownNodes(provider.ast).find(node => node.type === 'FunctionDeclaration' && node.id.name === providerExport?.name);
  const lazyCall = ownNodes(providerRenderer).find(node => jsx(node) && node.arguments[0]?.type === 'Identifier' && node.arguments[1].properties.some(p => p.type === 'SpreadElement'));
  const lazy = ownNodes(provider.ast).find(node => node.type === 'VariableDeclarator' && node.id.name === lazyCall?.arguments[0].name);
  const activityLoad = nodes(lazy).find(node => node.type === 'MemberExpression' && key(node.property) === 'ActivitySidebar');
  const bind = nodes(activityLoad).find(node => node.type === 'CallExpression' && key(node.callee.property) === 'bind' && text(node.arguments[1]));
  assert.ok(bind, 'Native ActivitySidebar export association changed');
  const activity = bundle.module(text(bind.arguments[1]));
  const section = one(nodes(activity.ast).filter(node => jsx(node) && text(node.arguments[0]) === 'section' && prop(node.arguments[1], 'aria-label')), 'Native Activity section changed');
  const activityOwner = nativeFunction(activity, section.start);
  assert.equal(activityOwner.ast.id.name, bundle.exports(activity).ActivitySidebar?.name);
  const activityClass = ownNodes(activityOwner.ast).find(node => node.type === 'AssignmentExpression' &&
    node.left.name === prop(section.arguments[1], 'className').name && node.right.type === 'Literal')?.right.value;
  assert.ok(activityClass?.split(' ').includes('font-openai-sans'));
  const settings = one(bundle.findModules('sidebar settings-dialog-sidebar'), 'Native settings navigation changed');
  const settingsClass = nodes(settings.ast).map(text).find(value => value.includes('sidebar settings-dialog-sidebar'));
  const settingsPage = one(bundle.findModules('data-settings-nav-scroll-container'), 'Native settings scroll marker changed');
  assert.ok(Object.values(bundle.imports(settingsPage)).some(ref => ref.id === settings.id), 'The real settings page uses the shared navigation layout');
  const settingsScroll = one(nodes(settingsPage.ast).filter(node => jsx(node) && prop(node.arguments[1], 'data-settings-nav-scroll-container')), 'Native settings scroll root changed');
  assert.equal(text(settingsScroll.arguments[0]), 'div');

  const stickyCandidates = bundle.findModules(['--app-shell-titlebar-left-inset', 'data-scroll-collapse', 'data-sticky']);
  const sticky = one(stickyCandidates.flatMap(record => nodes(record.ast).filter(node => node.type === 'FunctionDeclaration' && node !== record.ast &&
    nodes(node).some(child => child.type === 'ObjectExpression' && prop(child, 'data-sticky') && prop(child, 'data-scroll-collapse'))).map(fn => ({ record, fn }))), 'Native catalog header changed');
  assert.ok(Object.values(bundle.exports(sticky.record)).some(value => value.name === sticky.fn.id.name));
  const stickyClass = one([...new Set(nodes(sticky.fn).map(text).filter(value => /^shell-[\w-]+$/.test(value)))], 'Native catalog header class changed');

  const marker = one(bundle.findModules(['data-app-action-sidebar-thread-selected', 'sidebarProjectRow:']), 'Native sidebar attributes changed');
  const map = nodes(marker.ast).find(node => node.type === 'VariableDeclarator' && prop(node.init, 'sidebarThreadActive'));
  const helpers = nodes(marker.ast).find(node => node.type === 'VariableDeclarator' && prop(node.init, 'sidebarThreadRow')?.type === 'ArrowFunctionExpression');
  const attributes = nativeObject(marker, map.init);
  const attrs = name => new Function(map.id.name, `return (${marker.source.slice(prop(helpers.init, name).start, prop(helpers.init, name).end)});`)(attributes);
  const threadAttributes = attrs('sidebarThreadRow'), projectAttributes = attrs('sidebarProjectRow');
  const rowRecord = one(bundle.findModules(['data-sidebar-cycle-item', 'hasNavigationButton', 'isHighlighted', 'sidebar-item']), 'Native sidebar row changed');
  const row = nativeFunction(rowRecord, Object.values(bundle.exports(rowRecord)).find(value => /FunctionExpression/.test(value.type)).start);
  const pressOptions = row.nodes.find(node => node.type === 'ObjectExpression' && prop(node, 'onSelect') && prop(node, 'isDisabled'));
  const pressBinding = row.nodes.find(node => node.type === 'AssignmentExpression' && node.right === pressOptions)?.left.name;
  const press = row.nodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.name === pressBinding);
  const pressMember = press.callee.type === 'SequenceExpression' ? press.callee.expressions.at(-1) : press.callee;
  assert.ok(bundle.imports(rowRecord)[pressMember.object.name]);
  const renderRow = presentationHarness(bundle).compile(row, { [pressMember.object.name]: { [key(pressMember.property)]: () => ({}) } });
  const selectedClass = 'data-[app-action-sidebar-thread-selected=true]:bg-secondary-ghost-hover';
  const thread = one(bundle.findModules(selectedClass), 'Native selected-thread presentation changed');
  assert.ok(Object.values(bundle.imports(thread)).some(ref => ref.id === rowRecord.id));
  const threadClass = nodes(thread.ast).map(text).find(value => value.startsWith('flex h-full w-full items-center text-sm leading-4'));
  const css = bundle.css();
  assert.ok(css.includes('.sidebar-item{border-radius:var(--radius-lg);corner-shape:var(--codex-corner-shape)}'));
  cached = { css, navigationClass, slateClass, peekClass, navClass, activityClass, settingsClass, stickyClass,
    renderRow, threadAttributes, projectAttributes, selectedClass, threadClass };
  return cached;
};

const scenes = ['S08', 'S05'].map(slot => {
  const entry = active.background.gallery.find(scene => scene.slot === slot);
  assert.ok(entry && SCENE_TONES[entry.tone]);
  return { ...entry, url: 'data:image/jpeg;base64,' + fs.readFileSync(new URL('../themes/' + entry.asset, import.meta.url)).toString('base64') };
});
const variables = cssFor(active, scenes, {});
const fixture = (native, mode, { preview = false, scene = 0 } = {}) => {
  const row = (id, selected = false) => html(native.renderRow({ id, ...native.threadAttributes({ active: selected, selected, id, kind: 'local', pinned: false }),
    className: native.selectedClass + ' px-2 py-row-y', isActive: selected, hasNavigationLink: true, onPress: () => {},
    children: element('div', { className: native.threadClass, children: [element('a', { href: '#fixture', className: 'flex min-w-0 flex-1 ps-8 truncate',
      children: selected ? '当前示例聊天' : '场景配色示例' }), element('button', { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': false, children: '⋯' })] }) }));
  const project = html(native.renderRow({ id: 'project', ...native.projectAttributes({ collapsed: false, label: 'Fixture project', projectId: 'fixture' }),
    className: 'sidebar-row-focus group/folder-row flex items-center justify-between overflow-hidden text-default px-2', isActive: false,
    onPress: () => {}, children: [element('span', { children: '示例项目' }), element('button', { type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': false, children: '⋯' })] }));
  const content = `<nav class="${native.navClass}"><p class="text-secondary">项目与聊天</p>${project}${row('selected', true)}${row('unselected')}</nav>`;
  return `<!doctype html><html data-theme="${mode}" data-codex-os="win32" data-codex-window-type="electron" style="color-scheme:${mode}"
    ${preview ? `class="forge-ink-mountain" data-forge-native-theme="${mode}" data-forge-scene="${scene}" data-forge-background-ready="true"` : ''}><head><style>${native.css}</style><style>${theme}</style><style>${variables}</style><style>
    body{margin:0;min-height:600px;background:#627e88}#fixtures{display:grid;grid-template-columns:320px 300px;gap:24px;padding:28px}
    .fixture-panel{height:440px;width:320px;display:flex;position:relative}#docked .sidebar-navigation{height:100%}nav.${native.navClass}{padding:12px}nav p{margin:8px 0 20px}
    #peek-aside,#activity-aside{height:250px;width:300px;display:flex;position:relative}#settings,#catalog{width:300px;height:110px;position:relative}
    #catalog-header{position:relative}#catalog-header::before{height:100%}#unselected{margin-top:4px}#caption{position:relative;font:12px/1.6 system-ui;padding:12px 20px}
    ${preview ? `body{min-height:0}#fixtures{display:block;padding:0 24px 24px}#docked{width:300px;height:440px}#docked .sidebar-navigation{min-width:0}#negative{display:none}` : ''}
    </style></head><body>
    <p id="caption" class="text-secondary">侧栏场景配色组件夹具 · ${scene === 0 ? '冷色山景' : '暖色山景'}</p><div id="root"><div id="fixtures">
    <aside id="docked" class="app-shell-left-panel fixture-panel" data-app-shell-left-panel-appearance="default"><div id="navigation" class="${native.navigationClass}" data-sidebar-navigation-root="true">${content}</div></aside>
    <div id="negative"><aside id="peek-aside" class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><div id="peek-parent" class="${native.navigationClass}" data-sidebar-navigation-root="true"><div id="peek-presence" class="contents"><div id="peek" class="${native.slateClass} ${native.peekClass}" data-slate-sidebar-content="true"><nav class="${native.navClass}"><span class="text-secondary">Peek fixture</span></nav></div></div></div></aside>
    <aside id="activity-aside" class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><div id="activity-parent" class="${native.navigationClass}" data-sidebar-navigation-root="true"><div id="activity-peek" class="${native.slateClass} ${native.peekClass}" data-slate-sidebar-content="true"><section id="activity" class="${native.activityClass}" aria-label="Fixture activity"><button>Fixture activity control</button></section></div></div></aside>
    <aside class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><div id="settings-parent" class="${native.navigationClass}" data-sidebar-navigation-root="true"><div id="settings" class="${native.settingsClass}"><div data-settings-nav-scroll-container="true"><nav><button class="sidebar-item">Fixture preferences</button></nav></div></div></div></aside>
    <main id="catalog" data-app-shell-main-surface="default"><div id="catalog-header" class="${native.stickyClass}" data-sticky="true" style="--app-shell-titlebar-left-inset:0px"><input id="plugins-store-page-search" aria-label="Fixture catalog search"></div></main></div>
    </div></div></body></html>`;
};

test('native sidebar follows cold and warm wallpaper scenes while preserving native layout and isolated surfaces', async () => {
  const native = loadSidebar(), browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 950 }, colorScheme: mode });
      try {
        await page.setContent(fixture(native, mode));
        const read = () => page.locator('#fixtures,#fixtures *').evaluateAll(elements => Object.fromEntries(elements.map((e, index) => {
          const s = getComputedStyle(e), r = e.getBoundingClientRect(), p = getComputedStyle(e, '::before');
          return [e.id || 'node-' + index, { geometry: [r.x, r.y, r.width, r.height, s.padding, s.margin, s.borderWidth, s.borderRadius, s.cornerShape, s.overflow, s.position, s.font, s.lineHeight, s.display, s.opacity],
            text: e.textContent, selected: [e.getAttribute('aria-current'), e.getAttribute('data-app-action-sidebar-thread-active'), e.getAttribute('data-app-action-sidebar-thread-selected')],
            control: [e.disabled ?? null, e.tabIndex, e.getAttribute('aria-expanded'), s.outline, s.pointerEvents], color: s.color,
            paint: [s.backgroundColor, s.backgroundImage, s.backdropFilter, s.boxShadow], before: [p.backgroundColor, p.backgroundImage, p.backdropFilter] }];
        })));
        const apply = () => page.evaluate(mode => { document.documentElement.classList.add('forge-ink-mountain'); Object.assign(document.documentElement.dataset, { forgeNativeTheme: mode, forgeScene: '0', forgeBackgroundReady: 'true' }); }, mode);
        const remove = () => page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
        const baseline = await read(); await apply(); const cold = await read();
        const expectedMaterial = () => page.evaluate(() => {
          const sample = document.createElement('span'); sample.style.backgroundColor = 'var(--forge-conversation-fill)'; sample.style.backgroundImage = 'var(--forge-conversation-shade)';
          document.body.append(sample); const s = getComputedStyle(sample), value = [s.backgroundColor, s.backgroundImage]; sample.remove(); return value;
        });
        assert.deepEqual(cold.navigation.paint.slice(0, 2), await expectedMaterial(), `${mode}: the actual owner consumes the dedicated conversation material`);
        for (const id of Object.keys(baseline)) {
          for (const field of ['geometry', 'text', 'selected', 'control']) assert.deepEqual(cold[id][field], baseline[id][field], `${mode}/${id} retains native ${field}`);
        }
        const switchScene = index => page.evaluate(index => {
          document.documentElement.dataset.forgeScene = String(index);
          // A computed read in the same task proves CSS updates immediately;
          // no renderer remount, refresh timer, or image loader is involved.
          return getComputedStyle(document.getElementById('navigation')).backgroundColor;
        }, index);
        const warmColor = await switchScene(1), warm = await read();
        assert.notEqual(warmColor, cold.navigation.paint[0], `${mode}: cold and warm scenes have distinct navigation tint`);
        assert.deepEqual(warm.navigation.paint.slice(0, 2), await expectedMaterial(), `${mode}: the committed warm palette reaches the owner immediately`);
        for (const id of Object.keys(cold)) for (const field of ['geometry', 'text', 'selected', 'control', 'color']) {
          assert.deepEqual(warm[id][field], cold[id][field], `${mode}/${id}: a scene change preserves ${field}`);
        }
        for (const id of ['selected', 'unselected', 'project', 'activity-parent', 'activity-peek', 'activity', 'settings-parent', 'settings', 'catalog', 'catalog-header']) {
          assert.deepEqual(warm[id].paint, cold[id].paint, `${mode}/${id}: scene tint stays on conversation carriers`);
          assert.deepEqual(warm[id].before, cold[id].before, `${mode}/${id}: scene tint does not reach decorative pseudo surfaces`);
        }
        for (const id of ['navigation', 'peek']) {
          assert.notEqual(warm[id].paint[0], cold[id].paint[0], `${mode}/${id} follows the wallpaper palette`);
          assert.notEqual(warm[id].paint[1], cold[id].paint[1], `${mode}/${id} updates its scene gradient in the same task`);
          assert.equal(warm[id].paint[2], cold[id].paint[2], `${mode}/${id} keeps its original material filter`);
        }
        assert.deepEqual(cold['peek-parent'].paint.slice(0, 2), ['rgba(0, 0, 0, 0)', 'none'], 'The visible peek owns the only tint layer');
        assert.deepEqual(warm['peek-parent'].paint, cold['peek-parent'].paint, 'The peek parent keeps one shared blur without adding another tint');
        assert.equal(warm.peek.paint[2], baseline.peek.paint[2], 'The nested peek never receives a second filter');
        assert.equal(await switchScene(0), cold.navigation.paint[0], `${mode}: returning to the cold scene restores its exact tint`);
        assert.deepEqual(await read(), cold, `${mode}: scene switching is fully reversible`);
        // These controlled inputs exercise the CSS boundary independently of
        // the sampler. Preview images below obtain their RGB from the actual
        // runtime canvas and the decoded wallpaper, not these synthetic colors.
        const sampled = [];
        for (const color of ['rgb(32, 124, 168)', 'rgb(184, 92, 42)']) {
          await page.evaluate(value => document.documentElement.style.setProperty('--forge-sidebar-sampled-color', value), color);
          const state = await read(); sampled.push(state.navigation.paint);
          assert.deepEqual(state.navigation.paint.slice(0, 2), await expectedMaterial(), `${mode}: sampled RGB reaches the native carrier`);
          for (const id of ['navigation', 'peek']) assert.notDeepEqual(state[id].paint.slice(0, 2), cold[id].paint.slice(0, 2));
          assert.deepEqual(state['peek-parent'].paint, cold['peek-parent'].paint);
          for (const id of Object.keys(cold)) for (const field of ['geometry', 'text', 'selected', 'control', 'color']) assert.deepEqual(state[id][field], cold[id][field], `${mode}/${id}: sample changes preserve ${field}`);
          for (const id of ['selected', 'unselected', 'project', 'activity-parent', 'activity-peek', 'activity', 'settings-parent', 'settings', 'catalog', 'catalog-header']) {
            assert.deepEqual(state[id].paint, cold[id].paint, `${mode}/${id}: actual-sample material remains isolated`);
            assert.deepEqual(state[id].before, cold[id].before);
          }
        }
        assert.notDeepEqual(sampled[0], sampled[1], `${mode}: different sampled RGB changes paint without changing scene metadata`);
        await page.evaluate(() => document.documentElement.style.removeProperty('--forge-sidebar-sampled-color'));
        assert.deepEqual(await read(), cold, `${mode}: removing the sample restores the exact scene-preset fallback`);
        for (const selector of ['#peek', '#peek-presence']) for (const hidden of ['hidden-attribute', 'hidden', 'invisible']) {
          await page.locator(selector).evaluate((e, state) => state === 'hidden-attribute' ? e.setAttribute('hidden', '') : e.classList.add(state), hidden);
          const state = await read();
          assert.deepEqual(state['peek-parent'].paint, cold.navigation.paint, `${mode}/${selector}/${hidden}: retained hidden peek does not clear the visible outer material`);
          await page.locator(selector).evaluate((e, state) => state === 'hidden-attribute' ? e.removeAttribute('hidden') : e.classList.remove(state), hidden);
          assert.deepEqual((await read())['peek-parent'].paint, cold['peek-parent'].paint, 'Restoring the peek returns tint ownership to its native child');
        }
        // Native CQTN/nie7 keeps the popover paint token during the exit
        // motion, including inert/collapsed/aria-hidden and opacity zero.
        // Those semantics must not create a second tinted parent mid-exit.
        for (const opacity of ['0.85', '0.35', '0']) {
          await page.locator('#peek').evaluate((e, value) => {
            e.style.opacity = value; e.setAttribute('inert', ''); e.setAttribute('aria-hidden', 'true'); e.setAttribute('data-sidebar-collapsed', 'true');
          }, opacity);
          const hidden = await read();
          assert.deepEqual(hidden['peek-parent'].paint, cold['peek-parent'].paint, `${mode}/exit opacity=${opacity}: native peek retains the single tint layer`);
          assert.deepEqual(hidden.peek.paint, cold.peek.paint);
          assert.equal(await page.locator('#peek').evaluate(e => getComputedStyle(e).opacity), opacity);
        }
        await page.locator('#peek').evaluate(e => {
          e.style.removeProperty('opacity'); for (const name of ['inert', 'aria-hidden', 'data-sidebar-collapsed']) e.removeAttribute(name);
          e.classList.remove('bg-(--app-shell-sidebar-popover-background)');
        });
        assert.deepEqual((await read())['peek-parent'].paint, cold.navigation.paint, 'Only retiring the native popover paint token transfers material back to the outer owner');
        await page.locator('#peek').evaluate(e => e.classList.add('bg-(--app-shell-sidebar-popover-background)'));
        await page.evaluate(() => delete document.documentElement.dataset.forgeScene);
        const noScene = await read();
        for (const id of ['navigation', 'peek-parent', 'peek']) {
          assert.equal(noScene[id].paint[1], 'none', `${mode}/${id}: missing scene preserves the former flat reading material`);
          assert.equal(noScene[id].paint[0], await page.evaluate(() => {
            const sample = document.createElement('span'); sample.style.backgroundColor = 'var(--forge-navigation-fill)'; document.body.append(sample);
            const value = getComputedStyle(sample).backgroundColor; sample.remove(); return value;
          }));
        }
        await switchScene(0);
        const former = postcss.parse(theme); let oldRules = 0;
        former.walkRules(rule => { if (rule.selector.includes('[data-forge-scene]') && rule.selector.includes('.sidebar-navigation')) { rule.remove(); oldRules++; } });
        assert.equal(oldRules, 2, 'The negative control retires only the two new scene ownership rules');
        const material = page.locator('head > style').nth(1);
        await material.evaluate((e, value) => e.textContent = value, former.toString());
        const oldCold = (await read()).navigation.paint;
        await switchScene(1); assert.deepEqual((await read()).navigation.paint, oldCold, 'The former fixed material cannot follow the scene palette');
        await material.evaluate((e, value) => e.textContent = value, theme); await switchScene(0);
        await remove(); assert.deepEqual(await read(), baseline, `${mode}: theme removal restores native paint and controls`);

        const cdp = await page.context().newCDPSession(page);
        for (const [transparency, forced] of [['reduce', 'none'], ['no-preference', 'active']]) {
          await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: 'prefers-reduced-transparency', value: transparency }, { name: 'forced-colors', value: forced }] });
          assert.equal(await page.evaluate(query => matchMedia(query).matches, forced === 'active' ? '(forced-colors: active)' : '(prefers-reduced-transparency: reduce)'), true);
          const fallbackNative = await read();
          await apply(); const fallback = await read(); await switchScene(1); const fallbackWarm = await read();
          for (const id of ['navigation', 'peek-parent', 'peek']) {
            assert.deepEqual(fallbackWarm[id].paint, fallback[id].paint, `${mode}/${id}: accessibility fallback is scene-independent`);
            assert.equal(fallback[id].paint[1], 'none'); assert.equal(fallback[id].paint[2], 'none');
            assert.ok(!fallback[id].paint[0].startsWith('rgba('), `${mode}/${id}: fallback is opaque`);
            assert.deepEqual(fallback[id].geometry, fallbackNative[id].geometry, `${mode}/${id}: fallback preserves geometry and fonts under the same native media`);
          }
          await remove();
        }
      } finally { await page.close(); }
      if (process.env.WUKONG_SIDEBAR_SCENE_PREVIEW_DIRECTORY) {
        const preview = await browser.newPage({ viewport: { width: 780, height: 540 }, colorScheme: mode, deviceScaleFactor: 1 });
        try {
          await preview.setContent('<style>body{margin:0;display:flex;background:' + (mode === 'dark' ? '#171e23' : '#edf1f2') + '}iframe{border:0;width:390px;height:540px}</style><iframe title="Cold scene component fixture"></iframe><iframe title="Warm scene component fixture"></iframe>');
          for (const [index, frame] of preview.frames().filter(frame => frame !== preview.mainFrame()).entries()) {
            await frame.setContent(fixture(native, mode, { preview: true, scene: index }));
            await frame.evaluate(makeApplyExpression({ styleSheet: theme, variables: cssFor(active, [scenes[index]], {}) }));
            await frame.waitForFunction(() => document.documentElement.dataset.forgeBackgroundReady === 'true' &&
              window.__wukongCodexThemeRuntimeV13?.shellSampleCount > 0 && document.documentElement.style.getPropertyValue('--forge-sidebar-sampled-color'));
            const ready = await frame.evaluate(async () => {
              const image = document.querySelector('[data-forge-active="true"] [data-forge-background-image]'); await image.decode();
              return { decoded: image.complete && image.naturalWidth > 0, rootFill: getComputedStyle(document.getElementById('root')).backgroundColor,
                wallpaper: getComputedStyle(image.parentElement).opacity === '1', overflow: document.documentElement.scrollHeight > innerHeight,
                rgb: window.__wukongCodexThemeRuntimeV13.shellSample.rgb, samples: window.__wukongCodexThemeRuntimeV13.shellSample.samples,
                color: document.documentElement.style.getPropertyValue('--forge-sidebar-sampled-color') };
            });
            assert.equal(ready.samples, 24 * 64, 'The preview uses the actual existing runtime canvas sampling path');
            assert.deepEqual(ready.color.match(/[\d.]+/g).map(Number), ready.rgb, 'The native sidebar consumes the real sampled image RGB');
            assert.deepEqual({ decoded: ready.decoded, rootFill: ready.rootFill, wallpaper: ready.wallpaper, overflow: ready.overflow },
              { decoded: true, rootFill: 'rgba(0, 0, 0, 0)', wallpaper: true, overflow: false }, 'The component preview shows decoded wallpaper beneath a ready transparent root without scrollbars');
          }
          fs.mkdirSync(process.env.WUKONG_SIDEBAR_SCENE_PREVIEW_DIRECTORY, { recursive: true });
          await preview.screenshot({ path: path.join(process.env.WUKONG_SIDEBAR_SCENE_PREVIEW_DIRECTORY, `${mode}-sidebar-scene-palette-fixture-20261123.png`) });
        } finally {
          for (const frame of preview.frames().filter(frame => frame !== preview.mainFrame())) await frame.evaluate(RESTORE_EXPRESSION);
          await preview.close();
        }
      }
    }
  } finally { await browser.close(); }
});
