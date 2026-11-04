import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { loadNativeBundle, key, text, prop, nodes } from './native-bundle-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const provenance = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
const archive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', provenance.packageDirectoryName, provenance.asarRelativePath);
const skip = !fs.existsSync(archive) && 'Requires the audited installed ASAR';
const member = (content, name) => content.find(node => node.type === 'MemberExpression' && key(node.property) === name && node.object.type === 'Identifier')?.object.name;

let cached;
const loadNative = () => {
  if (cached) return cached;
  const bundle = loadNativeBundle({ archive });
  const record = bundle.findModules(['pointer-events-none absolute z-0', 'from-surface extension:from-surface-secondary'])
    .find(item => item.source.includes('combined-') && item.source.includes('surface-') && item.source.includes('fade-'));
  assert.ok(record, 'Current shared footer renderer changed; re-audit its paint ownership');
  const renderer = record.ast.body.body.find(node => node.type === 'FunctionDeclaration' && nodes(node).some(child => /^background-/.test(text(child))));
  assert.ok(renderer, 'The shared footer must remain a pure native presentation function');
  const content = nodes(renderer);
  const classes = Object.fromEntries(['background', 'surface', 'fade', 'combined'].map(name => {
    const values = [...new Set(content.map(text).filter(value => value.startsWith(`${name}-`) && !value.includes(' ')))];
    assert.equal(values.length, 1, `Native footer ${name} class contract changed`);
    return [name, values[0]];
  }));
  const leaf = content.find(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div' && prop(node.arguments[1], 'aria-hidden'));
  assert.ok(leaf && !prop(leaf.arguments[1], 'children'), 'Native footer paint must remain an empty aria-hidden leaf');
  const classCall = content.find(node => node.type === 'CallExpression' && node.arguments.some(argument => text(argument) === classes.background));
  assert.equal(classCall?.callee.type, 'SequenceExpression');
  const classNameMember = classCall.callee.expressions.at(-1);
  // Only the installed pure renderer executes. JSX, compiler cache and the
  // class joiner are transports; no native app state or business hook runs.
  const render = new Function(member(content, 'c'), member(content, 'jsx'), classNameMember.object.name,
    `return (${record.source.slice(renderer.start, renderer.end)});`)(
    { c: length => Array(length).fill(Symbol.for('react.memo_cache_sentinel')) },
    { jsx: (tag, props) => ({ tag, props }) },
    { [key(classNameMember.property)]: (...values) => values.flat(Infinity).filter(value => typeof value === 'string' && value).join(' ') });
  const exportName = Object.entries(bundle.exports(record)).find(([, value]) => value.name === renderer.id.name)?.[0];
  assert.ok(exportName, 'Current footer export must resolve from its real module contract');
  const consumers = bundle.findModules([`"${record.id}"`]).flatMap(item => {
    const namespaces = Object.entries(bundle.imports(item)).filter(([, value]) => value.id === record.id).map(([name]) => name);
    const calls = nodes(item.ast).filter(node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' &&
      namespaces.includes(node.arguments[0].object.name) && key(node.arguments[0].property) === exportName);
    return calls.length ? [{ ...item, calls }] : [];
  });
  assert.ok(consumers.length, 'Current footer consumers must import its resolved module/export');
  cached = { css: bundle.css([classes.background]), render, classes, record, consumers };
  return cached;
};

test('current shared footer source retains split thread, Dots and portal consumers without a gradient direction utility', { skip }, () => {
  const native = loadNative();
  for (const part of ['surface', 'fade', undefined]) {
    const result = native.render({ part });
    assert.equal(result.tag, 'div');
    assert.equal(result.props['aria-hidden'], true);
    assert.equal(result.props.children, undefined);
    for (const name of [native.classes.background, native.classes[part || 'combined'], 'pointer-events-none']) assert.ok(result.props.className.split(/\s+/).includes(name));
    assert.ok(!result.props.className.includes('bg-gradient-to-t'), 'Native CSS owns the gradient; direction utilities cannot identify its paint leaf');
  }
  const portal = native.consumers.find(item => item.source.includes('workspace-agent-preview-footer'));
  // Workspace preview has its own measured clearance; it is not the ordinary
  // thread's sticky reservation even though it references the scroll owner.
  const threads = native.consumers.filter(item => item !== portal && item.source.includes('thread-scroll-container') && item.source.includes('data-thread-scroll-footer'));
  assert.ok(threads.length, 'Current ordinary thread consumers are missing');
  for (const thread of threads) {
    const parts = thread.calls.map(call => text(prop(call.arguments[1], 'part')));
    assert.ok(parts.includes('surface') && parts.includes('fade'), `${thread.asset}: native split paints must both be exercised`);
    assert.ok(nodes(thread.ast).some(node => node.type === 'ObjectExpression' && text(prop(node, 'data-thread-scroll-footer')) === 'true' &&
      nodes(prop(node, 'children')).some(child => thread.calls.includes(child) && text(prop(child.arguments[1], 'part')) === 'surface')));
    assert.ok(nodes(thread.ast).some(node => node.type === 'ObjectExpression' && nodes(prop(node, 'className')).some(child => text(child).includes('sticky bottom-0')) &&
      nodes(prop(node, 'children')).some(child => thread.calls.includes(child) && text(prop(child.arguments[1], 'part')) === 'fade')));
  }
  const dots = native.consumers.find(item => item.source.includes('composer-disclaimer-above'));
  assert.ok(dots && dots.calls.some(call => !prop(call.arguments[1], 'part')) && dots.calls.some(call => text(prop(call.arguments[1], 'part')) === 'surface'),
    'Dots composer and disclaimer must execute combined and surface variants');
  assert.ok(portal && portal.source.includes('createPortal') && portal.calls.some(call => text(prop(call.arguments[1], 'part')) === 'surface') &&
    portal.calls.some(call => text(prop(call.arguments[1], 'part')) === 'fade'), 'Workspace preview footer must retain its portal and reserve paints');
  assert.ok(nodes(portal.ast).some(node => node.type === 'ObjectExpression' && prop(node, 'aria-hidden') &&
    nodes(prop(node, 'className')).some(child => text(child).startsWith('clearance-')) &&
    nodes(prop(node, 'children')).some(child => portal.calls.includes(child) && text(prop(child.arguments[1], 'part')) === 'fade')),
  'Workspace preview fade must remain in its distinct measured clearance carrier');
  assert.ok(native.consumers.some(item => item !== dots && item.calls.some(call => !prop(call.arguments[1], 'part'))), 'Other current combined footer consumers must remain covered');
});

const legacyFooterSelectors = current => {
  const sheet = postcss.parse(current);
  let replaced = 0;
  sheet.walkRules(rule => {
    if (rule.selector.includes('background-') && rule.selector.includes('combined-')) {
      rule.selector = ':root.forge-ink-mountain #root :is([data-app-shell-main-content-layout], .thread-scroll-container, [data-thread-scroll-footer="true"], [data-codex-composer-root]) [aria-hidden="true"].pointer-events-none:empty[class*="_background_"]:is([class*="_fade_"],[class*="_surface_"],[class*="_combined_"])';
      replaced++;
    } else if (rule.selector.includes('[data-forge-background-ready="true"]') && rule.selector.includes('[data-thread-scroll-footer="true"]')) {
      rule.selector = ':root.forge-ink-mountain[data-forge-background-ready="true"] #root [data-thread-scroll-footer="true"], :root.forge-ink-mountain[data-forge-background-ready="true"] #root [data-thread-scroll-footer="true"] > [aria-hidden="true"].pointer-events-none';
      replaced++;
    }
  });
  assert.equal(replaced, 2, 'Negative control must restore both obsolete footer owner selectors');
  return sheet.toString();
};

test('current footer paint clears in thread, Dots and body portals without changing geometry, controls or unrelated leaves', { skip }, async () => {
  const native = loadNative(), oldTheme = legacyFooterSelectors(theme);
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const paint = (id, part, children = '') => `<div id="${id}" aria-hidden="true" class="${escape(native.render({ part }).props.className)}">${children}</div>`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1260, height: 920 } });
    // The real renderer supplies every paint leaf. The source-proven owners
    // below provide layout/scroll bounds and inert input slots only; they add
    // no alternative native footer paint, dimensions or special gradient class.
    await page.setContent(`<html data-theme="dark" data-codex-window-type="electron"><head><style>${native.css}</style><style>
      body{margin:0}#root{position:relative;padding:16px}section{position:relative;height:130px;margin:20px 0}
      #viewport{height:260px;overflow:auto;position:relative}#scroll-content{height:800px;position:relative}
      #reservation{position:sticky;bottom:0;height:90px}#footer{position:relative;height:90px}
      #main,#dots{height:150px}#disclaimer{position:relative;height:45px}#dot-carrier{position:relative;height:60px}
      #workspace-portal,#dots-portal{position:relative;height:95px;margin:12px}#outside-root{position:relative;height:45px}
      #image-preview,#no-module,#with-children,#interactive,#other-owner,#no-hidden,#no-pointer,#no-variant,#hover-family,#substring-family{position:relative;height:40px;width:180px}
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
        ${paint('with-children', 'fade', '<span>Native content</span>')}
        <button id="interactive" class="${escape(native.render({}).props.className)}">Control</button>
        <div id="no-hidden" class="${escape(native.render({}).props.className)}"></div>
        <div id="no-pointer" aria-hidden="true" class="${native.classes.background} ${native.classes.combined}"></div>
        <div id="no-variant" aria-hidden="true" class="pointer-events-none ${native.classes.background} test-gradient"></div>
        <div id="hover-family" aria-hidden="true" class="pointer-events-none hover:${native.classes.background} ${native.classes.fade} test-gradient"></div>
        <div id="substring-family" aria-hidden="true" class="pointer-events-none not-${native.classes.background} ${native.classes.fade} test-gradient"></div>
      </section>${paint('other-owner')}
    </div><div id="workspace-portal" data-thread-scroll-footer="true">${paint('portal-surface', 'surface')}</div>
      <div id="dots-portal" data-codex-composer-root>${paint('portal-combined')}</div>${paint('outside-root')}
      <iframe title="External page" srcdoc="<style>body{margin:0;background:rgb(10,20,30)}input{background:rgb(40,50,60);border-radius:11px}</style><input aria-label='External' value='Frame'>"></iframe>
    </body></html>`);
    const style = await page.addStyleTag({ content: oldTheme });
    const cleared = ['thread-fade', 'thread-surface', 'dot-disclaimer', 'dot-combined', 'home-combined', 'health-surface', 'portal-surface', 'portal-combined'];
    const preserved = ['image-preview', 'no-module', 'with-children', 'interactive', 'other-owner', 'outside-root', 'no-hidden', 'no-pointer', 'no-variant', 'hover-family', 'substring-family', 'call'];
    const capture = () => page.locator('[id]').evaluateAll(elements => Object.fromEntries(elements.map(element => {
      const css = getComputedStyle(element), rect = element.getBoundingClientRect();
      return [element.id, { geometry: [rect.x, rect.y, rect.width, rect.height, css.position, css.padding, css.margin, css.borderWidth, css.borderRadius, css.cornerShape, css.font, css.opacity, css.pointerEvents],
        paint: [css.backgroundColor, css.backgroundImage, css.color, css.boxShadow, css.backdropFilter], value: element.value, disabled: element.disabled, tabIndex: element.tabIndex }];
    })));
    const external = () => page.frameLocator('iframe').locator('body,input').evaluateAll(elements => elements.map(element => {
      const css = getComputedStyle(element); return [css.backgroundColor, css.borderRadius, element.value];
    }));
    for (const mode of ['dark', 'light']) for (const width of [720, 1260]) for (const height of [660, 920]) for (const scroll of [0, 180]) {
      const label = `${mode}/${width}x${height}/scroll${scroll}`;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: mode });
      await style.evaluate((node, css) => { node.textContent = css; }, oldTheme);
      await page.evaluate(({ mode, scroll }) => {
        const root = document.documentElement; root.classList.remove('forge-ink-mountain');
        Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: 'true' });
        document.getElementById('viewport').scrollTop = scroll;
      }, { mode, scroll });
      const before = await capture(), frameBefore = await external();
      for (const id of cleared) assert.ok(before[id].paint[0] !== 'rgba(0, 0, 0, 0)' || before[id].paint[1] !== 'none', `${label}: ${id} must actually own native paint`);
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const legacy = await capture();
      for (const id of ['thread-fade', 'dot-combined', 'dot-disclaimer', 'portal-surface', 'portal-combined']) assert.ok(legacy[id].paint[0] !== 'rgba(0, 0, 0, 0)' || legacy[id].paint[1] !== 'none', `${label}: old CSS must reproduce missed native paint in ${id}`);
      await style.evaluate((node, css) => { node.textContent = css; }, theme);
      const after = await capture();
      for (const id of Object.keys(before)) assert.deepEqual(after[id].geometry, before[id].geometry, `${label}: ${id} retains native geometry`);
      for (const id of cleared) {
        assert.deepEqual(after[id].paint.slice(0, 2), ['rgba(0, 0, 0, 0)', 'none'], `${label}: ${id} clears solid and gradient paint`);
        assert.deepEqual(after[id].paint.slice(2), before[id].paint.slice(2), `${label}: ${id} changes background only`);
      }
      for (const id of preserved) assert.deepEqual(after[id], before[id], `${label}: ${id} is outside the decorative owner contract`);
      assert.deepEqual(await external(), frameBefore, `${label}: external frames remain isolated`);
      assert.equal(await page.locator('#viewport').evaluate(element => element.scrollTop), scroll);
    }
    await page.locator('#message').fill('Still editable');
    assert.equal(await page.locator('#message').inputValue(), 'Still editable');
    await page.locator('#call').click();
    assert.equal(await page.locator('#call').evaluate(element => element === document.activeElement), true);
  } finally { await browser.close(); }
});
