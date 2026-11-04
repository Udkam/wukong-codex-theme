import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { key, nodes, prop, text } from './native-bundle-current-helper.mjs';
import { aliases, loadPopoverNative, owner } from './native-popover-ownership-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const lock = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
const archive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', lock.packageDirectoryName, lock.asarRelativePath);
const skip = !fs.existsSync(archive) && 'Requires the audited installed ASAR';
let cachedNative;
const loadNative = () => cachedNative ||= loadPopoverNative(archive);

test('native Design controls keeps its unstyled Popover shell around one FloatingSurface', { skip }, () => {
  const native = loadNative();
  const outerProps = native.editorPopover.arguments[1];
  assert.equal(prop(outerProps, 'unstyled')?.operator, '!');
  assert.equal(prop(outerProps, 'unstyled')?.argument.value, 0);
  assert.ok(prop(outerProps, 'children')?.elements.some(child => native.reaches(child, native.innerFloating)), 'The independent floating owner must remain a direct Popover child');
  const openParameter = nodes(native.editorFunction).find(node => node.type === 'ObjectPattern' && node.properties.some(item => key(item.key) === 'isOpen'))?.properties.find(item => key(item.key) === 'isOpen')?.value;
  assert.ok(nodes(native.editorFunction).some(node => node.type === 'CallExpression' && prop(node.arguments[1], 'open')?.name === openParameter?.name), 'Native Design controls open state changed');
  const shell = native.renderPopover({ unstyled: true, className: text(prop(outerProps, 'className')) });
  assert.equal(shell.props['data-slot'], 'popover-content');
  assert.equal(shell.props.role, 'dialog');
  assert.equal(shell.props.className, text(prop(outerProps, 'className')));
  assert.ok(!/(?:^|\s)bg-surface/.test(shell.props.className), 'Native editor shell must remain transparent');
  const inner = native.renderFloating({ className: native.editorClasses });
  assert.match(inner.props.className, /(?:^|\s)bg-surface-elevated-secondary(?:\s|$)/);
  assert.ok(inner.props.className.split(/\s+/).includes(native.floatingClass));
  for (const options of [{}, { opaque: false }, { variant: 'comment' }, { variant: 'menu' }]) {
    assert.match(native.renderPopover(options).props.className, /(?:^|\s)bg-surface-elevated-secondary(?:\/90)?(?:\s|$)/);
  }
});

test('native independent toolbar, avatar material and asChild checkout preserve their actual paint ownership', { skip }, () => {
  const native = loadNative();
  const direct = (parent, child, fn) => {
    const children = prop(parent.arguments[1], 'children'), reaches = aliases(fn);
    return children?.type === 'ArrayExpression' ? children.elements.some(item => reaches(item, child)) : reaches(children, child);
  };
  const { toolbarCall, aboutPopover } = native;
  assert.ok(toolbarCall && aboutPopover && prop(aboutPopover.arguments[1], 'unstyled') &&
    direct(aboutPopover, toolbarCall, owner(native.aboutAst, aboutPopover)), 'Native Memory summary toolbar must remain a direct child of an unstyled Popover');
  const toolbarRoot = native.toolbar.nodes.find(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' && text(prop(node.arguments[1], 'role')) === 'presentation');
  assert.ok(toolbarRoot, 'Native toolbar material must remain its actual block root');
  const reactionUses = nodes(native.avatarAst).filter(node => node.type === 'CallExpression' && node.arguments[0]?.name === native.avatarReaction.ast.id.name);
  assert.ok(reactionUses.length, 'Native reaction picker consumer changed');
  assert.ok(native.avatarPopovers.some(avatarPopover => {
    const avatarFn = owner(native.avatarAst, avatarPopover), avatarAliases = aliases(avatarFn);
    const reactionBranch = nodes(avatarFn).find(node => node.type === 'ConditionalExpression' && reactionUses.includes(node.consequent));
    return reactionBranch && avatarAliases(prop(avatarPopover.arguments[1], 'children'), reactionBranch);
  }), 'Native reaction material must remain directly in the transparent Popover branch');
  const avatar = native.renderAvatarReaction({ children: 'Reaction choices' });
  assert.equal(avatar.props['data-avatar-overlay-material'], 'css');
  assert.equal(avatar.props['data-avatar-overlay-material-variant'], 'reaction-picker');
  assert.match(avatar.props.style.backdropFilter, /^url\(#/);
  const { checkoutCall, checkoutPopover } = native;
  assert.ok(checkoutCall && checkoutPopover && prop(checkoutPopover.arguments[1], 'unstyled') &&
    direct(checkoutPopover, checkoutCall, owner(native.checkoutDialogAst, checkoutPopover)), 'Native inline checkout must remain the merged asChild surface');
  const checkout = native.renderCheckout({ isDarkMode: true, children: 'Checkout controls' });
  assert.equal(checkout.props['data-checkout-presentation'], 'inline');
  assert.equal(checkout.props['data-checkout-theme'], 'dark');
  assert.ok(!/(?:^|\s)bg-surface/.test(checkout.props.className), 'Inline checkout must exercise its actual CSS module material');
});

const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const html = tree => {
  if (tree == null || tree === false) return '';
  if (typeof tree === 'string') return escape(tree);
  if (Array.isArray(tree)) return tree.map(html).join('');
  const { tag, props } = tree;
  if (tag === '#fragment') return html(props.children);
  const attributes = Object.entries(props).filter(([name, value]) => !['children', 'style', 'ref'].includes(name) && !name.startsWith('on') && value !== undefined && value !== false)
    .map(([name, value]) => `${name === 'className' ? 'class' : ['floodColor', 'floodOpacity', 'colorInterpolationFilters'].includes(name) ? name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`) : name}="${escape(value === true ? 'true' : value)}"`).join(' ');
  const style = props.style ? Object.entries(props.style).filter(([, value]) => value !== undefined).map(([name, value]) => `${name.replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}:${value}`).join(';') : '';
  return `<${tag} ${attributes}${style ? ` style="${escape(style)}"` : ''}>${html(props.children)}</${tag}>`;
};

test('Popover shells stay transparent while actual native carriers paint once and keep controls and external frames unchanged', { skip }, async () => {
  const native = loadNative();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    const controlTree = () => ({ tag: 'div', props: { className: 'flex flex-col gap-2 p-4', children: [
      { tag: 'input', props: { 'data-control': 'input', 'aria-label': 'Color', className: native.inputClass, value: '#abcdef' } },
      { tag: 'button', props: { 'data-control': 'select', 'aria-label': 'Variant', className: native.selectClass, 'aria-haspopup': 'menu', children: 'Default' } },
      native.renderSwitch({ id: 'native-toggle', 'data-control': 'switch', ariaLabel: 'Enabled', checked: true, onChange: () => {} })
    ] } });
    const inner = native.renderFloating({ id: 'design-paint', className: native.editorClasses, children: controlTree() });
    const design = native.renderPopover({ id: 'design-shell', unstyled: true, className: text(prop(native.editorPopover.arguments[1], 'className')), children: inner });
    const pop = (id, options = {}, children) => native.renderPopover({ id, ...options, children });
    const reaction = native.renderAvatarReaction({ children: { tag: 'button', props: { id: 'avatar-action', className: 'bg-primary-soft rounded-md px-2', children: 'Reaction' } } });
    reaction.props.id = 'avatar-paint';
    const checkoutControls = () => ({ tag: 'div', props: { children: [
      { tag: 'input', props: { 'data-checkout-control': 'input', 'aria-label': 'Credit amount', className: native.inputClass, value: '20' } },
      { tag: 'button', props: { 'data-checkout-control': 'button', className: native.checkoutSecondary, disabled: true, children: 'Continue' } }
    ] } });
    const checkout = (expanded, isDarkMode) => pop('checkout-inline', { asChild: true, unstyled: true, className: 'z-50' }, native.renderCheckout({ expanded, isDarkMode, children: checkoutControls() }));
    const cases = [design,
      ...[{}, { opaque: false }, { variant: 'comment' }, { variant: 'menu' }].map((options, index) => pop(`styled-${index}`, options, { tag: 'div', props: { id: `styled-child-${index}`, className: 'bg-surface-elevated-secondary', children: 'Child must not add glass' } })),
      pop('custom-own', { unstyled: true, className: 'rounded-xl bg-surface-elevated-secondary/90' }, 'Self painted caller'),
      pop('canvas-own', { unstyled: true, className: 'rounded-xl bg-surface-canvas' }, 'Canvas caller'),
      pop('as-child-form', { asChild: true, unstyled: true }, { tag: 'form', props: { className: 'rounded-xl bg-surface', children: 'Form caller' } }),
      ...['div', 'section', 'form', 'aside', 'nav'].map(tag => pop(`child-${tag}`, { unstyled: true }, { tag, props: { id: `carrier-${tag}`, className: native.toolbarClasses, children: [
        { tag: 'h2', props: { id: `heading-${tag}`, className: 'bg-surface-elevated-secondary', children: 'Nested native heading' } }, 'Native independent carrier'
      ] } })),
      pop('button-shell', { unstyled: true }, { tag: 'button', props: { id: 'button-carrier', className: native.toolbarClasses, children: 'Interactive button' } }),
      ...['hover:bg-surface-elevated-secondary', 'after:bg-surface-elevated-secondary', 'bg-transparent', 'bg-transparent hover:bg-surface-elevated-secondary'].map((className, index) => pop(`negative-${index}`, { unstyled: true, className }, 'Transparent native shell')),
      pop('coachmark', { unstyled: true, className: 'bg-coachmark' }, 'Intentional native coachmark'),
      pop('avatar-shell', { unstyled: true }, reaction),
      native.renderAvatarMaterial({ id: 'avatar-native', variant: 'reaction-picker', children: 'Independent native material', style: { backdropFilter: 'url(#native-reaction-filter)' } }),
      checkout(false, true), native.renderCheckout({ id: 'checkout-native', expanded: false, isDarkMode: true, children: checkoutControls() })
    ];
    await page.setContent(`<html data-theme="dark"><head><style>${native.css}</style><style>body{margin:0;padding:12px}#fixtures{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;align-items:start}#design-shell{height:var(--test-panel-height,240px);width:var(--test-panel-width,368px)}iframe{width:180px;height:65px}#as-child-form{display:block}</style></head><body><div id="fixtures">${cases.map(html).join('')}</div><iframe title="External control" srcdoc="<style>body{background:rgb(15,25,35);color:rgb(230,240,250);margin:0}input{background:rgb(40,50,60);border-radius:9px;color:white}</style><input aria-label='External' value='Frame'></input>"></iframe></body></html>`);
    await page.addStyleTag({ content: theme });
    const read = () => page.locator('[id],[data-control],[data-control] *,[data-checkout-control]').evaluateAll(elements => Object.fromEntries(elements.map((element, index) => {
      const style = getComputedStyle(element), rect = element.getBoundingClientRect();
      return [element.id || `control-${index}`, { geometry: [rect.x, rect.y, rect.width, rect.height, style.position, style.padding, style.margin, style.borderWidth, style.borderRadius, style.font, style.opacity],
        paint: [style.backgroundColor, style.backgroundImage, style.boxShadow, style.backdropFilter, style.color], checked: element.getAttribute('aria-checked'), disabled: element.disabled, value: element.value,
        checkoutTokens: ['--checkout-bg-primary', '--checkout-text-primary', '--checkout-border-default'].map(name => style.getPropertyValue(name).trim()) }];
    })));
    const transparent = ['design-shell', 'button-shell', 'avatar-shell', ...['div', 'section', 'form', 'aside', 'nav'].map(tag => `child-${tag}`), ...[0, 1, 2, 3].map(index => `negative-${index}`)];
    const painted = ['design-paint', 'custom-own', 'canvas-own', 'as-child-form', 'checkout-inline', ...[0, 1, 2, 3].map(index => `styled-${index}`), ...['div', 'section', 'form', 'aside', 'nav'].map(tag => `carrier-${tag}`)];
    for (const mode of ['dark', 'light']) for (const dimensions of [[368, 240], [470, 360]]) {
      const label = `${mode}/${dimensions.join('x')}`;
      await page.evaluate(({ mode, dimensions }) => { const root = document.documentElement; root.classList.remove('forge-ink-mountain'); Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode }); root.style.setProperty('--test-panel-width', `${dimensions[0]}px`); root.style.setProperty('--test-panel-height', `${dimensions[1]}px`); }, { mode, dimensions });
      await page.locator('#checkout-inline').evaluate((element, replacement) => { element.outerHTML = replacement; }, html(checkout(dimensions[0] > 400, mode === 'dark')));
      await page.locator('#checkout-native').evaluate((element, replacement) => { element.outerHTML = replacement; }, html(native.renderCheckout({ id: 'checkout-native', expanded: dimensions[0] > 400, isDarkMode: mode === 'dark', children: checkoutControls() })));
      await page.locator('[data-avatar-overlay-material]').evaluateAll((elements, mode) => elements.forEach(element => element.dataset.theme = mode), mode);
      await page.locator('#checkout-inline,#checkout-native').evaluateAll(elements => Promise.allSettled(elements.flatMap(element => element.getAnimations({ subtree: true })).map(animation => animation.finished)));
      const before = await read();
      const frameBefore = await page.frameLocator('iframe').locator('body,input').evaluateAll(elements => elements.map(element => { const style = getComputedStyle(element); return [style.backgroundColor, style.color, style.borderRadius, element.value]; }));
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const after = await read();
      for (const id of Object.keys(before)) assert.deepEqual(after[id].geometry, before[id].geometry, `${label}: ${id} retains native geometry and rounded corners`);
      for (const id of transparent) assert.deepEqual(after[id].paint.slice(0, 4), ['rgba(0, 0, 0, 0)', 'none', 'none', 'none'], `${label}: ${id} must remain a transparent positioning shell`);
      for (const id of painted) { assert.notEqual(after[id].paint[0], 'rgba(0, 0, 0, 0)', `${label}: ${id} keeps readable fill`); assert.match(after[id].paint[3], /blur\(/, `${label}: ${id} owns the only glass layer`); }
      for (const id of Object.keys(before).filter(id => id.startsWith('control-') || ['native-toggle', 'avatar-action', 'avatar-native', 'checkout-native', 'coachmark', 'button-carrier'].includes(id) || id.startsWith('styled-child-') || id.startsWith('heading-'))) assert.deepEqual(after[id], before[id], `${label}: ${id} remains native`);
      assert.notEqual(after['avatar-paint'].paint[0], before['avatar-paint'].paint[0], `${label}: reaction material adopts the theme fill`);
      assert.deepEqual(after['avatar-paint'].paint.slice(1), before['avatar-paint'].paint.slice(1), `${label}: avatar keeps native SVG backdrop, border elevation and foreground`);
      assert.match(after['avatar-paint'].paint[3], /^url\(/);
      assert.deepEqual(after['checkout-inline'].checkoutTokens, before['checkout-inline'].checkoutTokens, `${label}: checkout controls keep their native color tokens`);
      assert.equal(await page.locator('#design-shell').evaluate(element => [...element.querySelectorAll('*')].filter(child => getComputedStyle(child).backdropFilter !== 'none').length), 1, `${label}: design controls paints one glass surface`);
      assert.deepEqual(await page.frameLocator('iframe').locator('body,input').evaluateAll(elements => elements.map(element => { const style = getComputedStyle(element); return [style.backgroundColor, style.color, style.borderRadius, element.value]; })), frameBefore, `${label}: external frame is isolated`);
    }
    await page.getByRole('textbox', { name: 'Color', exact: true }).fill('#123456');
    assert.equal(await page.getByRole('textbox', { name: 'Color', exact: true }).inputValue(), '#123456');
    await page.getByRole('button', { name: 'Variant', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Variant', exact: true }).evaluate(element => element === document.activeElement), true);
    await page.getByRole('switch', { name: 'Enabled', exact: true }).click();
    assert.equal(await page.getByRole('switch', { name: 'Enabled', exact: true }).evaluate(element => element === document.activeElement), true);
    // The real caller has an open state. This fixture checks remount stability
    // only; it does not claim the native visualization business flow was run.
    await page.locator('#design-shell').evaluate(element => element.remove());
    assert.equal(await page.locator('#design-shell').count(), 0);
    await page.locator('#fixtures').evaluate((element, content) => element.insertAdjacentHTML('afterbegin', content), html(design));
    assert.equal(await page.locator('#design-shell').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
    if (process.env.CODEX_WRITE_POPOVER_PREVIEWS === '1') {
      const preview = await browser.newPage({ viewport: { width: 440, height: 410 } });
      try {
        for (const mode of ['dark', 'light']) {
          const header = { tag: 'div', props: { className: native.editorHeader, children: { tag: 'h2', props: { className: native.editorHeading, children: '设计控件 · 组件夹具' } } } };
          const panel = native.renderPopover({ id: 'design-preview', unstyled: true, className: text(prop(native.editorPopover.arguments[1], 'className')),
            children: native.renderFloating({ className: native.editorClasses, children: [header, controlTree()] }) });
          await preview.setContent(`<html class="forge-ink-mountain" data-theme="${mode}" data-forge-native-theme="${mode}"><head><meta charset="utf-8"><style>${native.css}\n${theme}</style><style>body{margin:0;padding:32px;background:${mode === 'dark' ? 'linear-gradient(145deg,#132333,#506775)' : 'linear-gradient(145deg,#dce8ef,#a9b9c5)'};min-height:410px}#design-preview{width:368px;height:320px}#design-preview input{max-width:100%}</style></head><body>${html(panel)}</body></html>`);
          // Show only the actual renderer's rounded boundary, with an outer
          // backdrop margin. This is a material fixture, not a business UI mock.
          const bounds = await preview.locator('#design-preview').boundingBox();
          await preview.screenshot({ path: new URL(`../docs/previews/${mode}-design-controls-fixture.png`, import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
            clip: { x: bounds.x + bounds.width - 120, y: bounds.y - 16, width: 136, height: 116 } });
        }
      } finally { await preview.close(); }
    }
  } finally { await browser.close(); }
});
