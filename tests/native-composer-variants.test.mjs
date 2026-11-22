import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { loadQuotaNative, quotaNativeSkip, quotaHtml, key, text, prop, nodes } from './native-quota-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const element = (tag, props) => ({ tag, props });
const variants = ['default', 'opaque', 'secondary', 'inline', 'document'];
const cases = variants.flatMap(variant => ['default', 'home'].flatMap(utility => [false, true].map(drag => ({
  variant, utility, drag, id: `${variant}-${utility}${drag ? '-drag' : ''}`, painted: !drag && ['default','opaque','secondary'].includes(variant)
}))));

const sourceContract = native => {
  const { bundle, composerClasses, composerRoot } = native;
  const asset = bundle.stylesheetAssets([`.${composerClasses.DocumentComposerControls}`, '[data-composer-surface-variant=document]'])[0];
  assert.ok(asset, 'Native document composer stylesheet changed');
  const rules = [];
  postcss.parse(bundle.read(asset)).walkRules(rule => rules.push(rule));
  const declaration = (selector, name, value) => rules.some(rule => rule.selector === selector &&
    rule.nodes.some(node => node.type === 'decl' && node.prop === name && node.value === value));
  const document = `.${composerClasses.ComposerLayoutRoot}[data-composer-surface-variant=document]`;
  assert.ok(declaration(document, '--composer-layout-surface-background', 'transparent'));
  assert.ok(declaration(document, '--composer-layout-surface-shadow', 'none'));
  assert.ok(declaration(document, 'inline-size', 'max-content'));
  assert.ok(declaration(`${document}:focus-within`, '--composer-layout-surface-background', 'var(--color-surface-secondary)'));
  const toolbar = `${document} .${composerClasses.DocumentComposerControls}`;
  for (const [name, value] of [['width','max-content'],['position','absolute'],['background','var(--color-surface-elevated-secondary)']]) {
    assert.ok(declaration(toolbar, name, value), `Native document toolbar ${name} changed`);
  }
  assert.ok(rules.some(rule => rule.selector === `.${composerClasses.ComposerLayoutRoot}[data-composer-drag-active]` &&
    rule.nodes.some(node => node.prop === '--composer-layout-surface-background' && node.value.includes('50%, transparent'))),
  'Native drag feedback must retain its independent translucent material');
  const registry = nodes(composerRoot.record.ast).find(node => node.type === 'ObjectExpression' && prop(node, 'AdaptiveFooter'));
  const adaptive = prop(registry, 'AdaptiveFooter');
  assert.ok(nodes(adaptive).some(node => node.type === 'MemberExpression' && key(node.property) === 'DocumentComposerControls'),
    'Native AdaptiveFooter must still render the independent document toolbar');
};

test('native document and drag surfaces retain explicit independent paint contracts', { skip: quotaNativeSkip }, () => {
  sourceContract(loadQuotaNative());
});

const legacyTheme = () => {
  const sheet = postcss.parse(theme); let changed = 0;
  sheet.walkRules(rule => {
    if (!rule.selector.includes('data-composer-surface-variant')) return;
    if (rule.nodes.some(node => node.prop === '--composer-layout-surface-background')) {
      rule.selector = ':root.forge-ink-mountain [data-composer-surface-variant]:not([data-composer-surface-variant="inline"])'; changed++;
    } else if (rule.nodes.some(node => node.prop === 'background-image' && node.value === 'var(--forge-glass-highlight)')) {
      rule.selector = ':root.forge-ink-mountain :is([data-composer-surface-variant]:not([data-composer-utility-bar-variant="home"]):not([data-composer-surface-variant="inline"]),[data-composer-utility-bar-variant="home"] > [data-composer-body])'; changed++;
    }
  });
  assert.equal(changed, 2, 'The negative control must restore only the two former composer paint selectors');
  return sheet.toString();
};

const renderCase = (native, item) => {
  const context = native.harness.load(native.composerRoot.record.id).k;
  const previous = native.harness.contexts.get(context), hadContext = native.harness.contexts.has(context);
  native.harness.contexts.set(context, { isHome: item.utility === 'home', isDocument: item.variant === 'document',
    canStackSingleLine: false, expansion: null, homeMode: undefined });
  try {
    const input = native.renderComposerRoot.Input({ children: element('input', { id: `${item.id}-editor`, type: 'text', value: 'Fixture draft', size: 12 }) });
    const button = native.renderButton({ id: `${item.id}-send`, children: 'Send', size: 'composer', color: 'ghost' });
    const layout = item.utility === 'home' ? 'single-line' : 'multiline';
    const children = item.variant === 'document'
      ? native.renderComposerRoot.AdaptiveFooter({ layout, input, leadingControls: button }) : [input, button];
    const body = native.renderComposerBody({ layout, children }); body.props.id = `${item.id}-body`;
    const root = native.renderComposerRoot({ className: 'fixture-composer', layout, utilityBarVariant: item.utility,
      surfaceVariant: item.variant, isDragActive: item.drag, density: item.variant === 'document' ? 'compact' : 'default', children: body });
    root.props.id = item.id;
    const visit = tree => {
      if (!tree || typeof tree !== 'object') return;
      if (Array.isArray(tree)) return tree.forEach(visit);
      if (tree.props?.className?.split(/\s+/).includes(native.composerClasses.DocumentComposerControls)) tree.props.id = `${item.id}-toolbar`;
      visit(tree.props?.children);
    };
    visit(root);
    return `<section data-fixture="${item.id}">${quotaHtml(root)}</section>`;
  } finally {
    if (hadContext) native.harness.contexts.set(context, previous); else native.harness.contexts.delete(context);
  }
};

test('only native painted composer variants receive glass while document, inline and drag keep their own feedback', {
  skip: quotaNativeSkip
}, async () => {
  const native = loadQuotaNative(); sourceContract(native);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
    await page.setContent(`<html data-theme="dark" data-codex-os="win32" data-codex-window-type="electron"><style>${native.css}</style><style>
      body{margin:0;padding:16px}#fixtures{width:420px}section[data-fixture]{padding-bottom:48px}.fixture-composer{position:relative}
    </style><div id="fixtures">${cases.map(item => renderCase(native, item)).join('')}</div></html>`);
    const style = await page.addStyleTag({ content: legacyTheme() });
    const capture = () => page.locator('#fixtures [id]').evaluateAll(elements => Object.fromEntries(elements.map(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const pseudo = type => { const p = getComputedStyle(e,type); return [p.content,p.backgroundColor,p.backgroundImage,p.borderRadius,p.boxShadow,p.backdropFilter]; };
      return [e.id, { geometry:[r.x,r.y,r.width,r.height,s.borderRadius,s.cornerShape,s.padding,s.margin,s.borderWidth,s.position,s.overflow,
        s.inlineSize,s.maxInlineSize,s.font,s.lineHeight,s.opacity,s.pointerEvents,s.visibility,s.display],
        paint:[s.backgroundColor,s.backgroundImage,s.backdropFilter,s.boxShadow,s.color,s.filter],before:pseudo('::before'),after:pseudo('::after'),
        value:e.value ?? null,tabindex:e.tabIndex,disabled:e.disabled ?? null,inert:e.inert }];
    })));
    const owner = item => item.utility === 'home' ? `${item.id}-body` : item.id;
    const compare = (base, painted, description) => {
      const permitted = new Set(cases.filter(item => item.painted).map(owner));
      for (const id of Object.keys(base)) {
        for (const name of ['geometry','before','after','value','tabindex','disabled','inert']) assert.deepEqual(painted[id][name],base[id][name],`${description}: ${id} ${name}`);
        if (!permitted.has(id)) assert.deepEqual(painted[id].paint,base[id].paint,`${description}: ${id} has no replacement paint owner`);
        else assert.deepEqual(painted[id].paint.slice(4),base[id].paint.slice(4),`${description}: ${id} preserves native ink and filter`);
      }
    };
    for (const mode of ['dark','light']) {
      await page.emulateMedia({ colorScheme:mode });
      await page.evaluate(mode => {
        document.activeElement?.blur(); document.documentElement.classList.remove('forge-ink-mountain');
        document.documentElement.style.colorScheme=mode;
        Object.assign(document.documentElement.dataset,{theme:mode,forgeNativeTheme:mode});
      },mode);
      const baseline = await capture();
      for (const item of cases.filter(item => item.variant === 'document' && !item.drag)) {
        assert.equal(baseline[owner(item)].paint[0],'rgba(0, 0, 0, 0)','Unfocused document surface stays native transparent');
        assert.equal(baseline[owner(item)].paint[2],'none');
        assert.notEqual(baseline[`${item.id}-toolbar`].paint[0],'rgba(0, 0, 0, 0)','Its max-content toolbar remains the independent painted owner');
      }
      await style.evaluate((e, css) => e.textContent=css,legacyTheme());
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const previous = await capture();
      assert.notEqual(previous['document-default'].paint[0],baseline['document-default'].paint[0],'Old CSS must reproduce document overpaint');
      assert.match(previous['document-default'].paint[2],/blur\(/);
      assert.notDeepEqual(previous['default-default-drag'].paint,baseline['default-default-drag'].paint,'Old CSS must overwrite native drag feedback');
      assert.match(previous['inline-home-body'].paint[1],/linear-gradient\(/,'Old home selector also paints the transparent inline body');
      await style.evaluate((e, css) => e.textContent=css,theme);
      const after = await capture(); compare(baseline,after,mode);
      for (const item of cases.filter(item => item.painted)) {
        assert.deepEqual(after[owner(item)].paint,previous[owner(item)].paint,`${mode}: ${item.id} keeps its existing glass appearance`);
        assert.match(after[owner(item)].paint[1],/linear-gradient\(/);
        assert.match(after[owner(item)].paint[2],/blur\(/);
        if (item.utility === 'home') assert.deepEqual(after[item.id].paint,baseline[item.id].paint,'Home root remains layout only; body owns the glass');
      }
      await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
      assert.deepEqual(await capture(),baseline,'Removing the theme restores every native surface');
      for (const item of cases.filter(item => item.variant === 'document')) {
        await page.locator(`#${item.id}-editor`).evaluate(e => e.focus({preventScroll:true}));
        const focusedNative = await capture();
        assert.notEqual(focusedNative[owner(item)].paint[0],'rgba(0, 0, 0, 0)','Native document focus adds its own secondary fill');
        await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
        compare(focusedNative,await capture(),`${mode}/${item.id}/focus`);
        await page.evaluate(() => { document.documentElement.classList.remove('forge-ink-mountain'); document.activeElement?.blur(); });
      }
    }
    await page.locator('#document-default-editor').fill('Document editing still works');
    assert.equal(await page.locator('#document-default-editor').inputValue(),'Document editing still works');
  } finally { await browser.close(); }
});
