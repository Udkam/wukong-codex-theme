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
const escapeAttribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

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
  cached = { bundle, css: bundle.css([classes.background]), render, classes, record, consumers };
  return cached;
};

test('current shared footer source retains Dots and portal consumers without a gradient direction utility', { skip }, () => {
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
  const dots = native.consumers.find(item => item.source.includes('composer-disclaimer-above'));
  assert.ok(dots && dots.source.includes('"composer-wrap"') && dots.source.includes('reply-chain-host-open') &&
    dots.calls.some(call => !prop(call.arguments[1], 'part')) && dots.calls.some(call => text(prop(call.arguments[1], 'part')) === 'surface'),
    'Dots reply chain and composer disclaimer must retain their shared paint variants');
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
    } else if (rule.selector.includes('[data-forge-background-ready="true"]') &&
      rule.selector.includes('[data-thread-scroll-footer="true"] > [aria-hidden="true"].pointer-events-none')) {
      rule.selector = ':root.forge-ink-mountain[data-forge-background-ready="true"] #root [data-thread-scroll-footer="true"], :root.forge-ink-mountain[data-forge-background-ready="true"] #root [data-thread-scroll-footer="true"] > [aria-hidden="true"].pointer-events-none';
      replaced++;
    }
  });
  assert.equal(replaced, 2, 'Negative control must restore both obsolete footer owner selectors');
  return sheet.toString();
};

test('shared footer leaves clear in Dots and body portals without changing geometry, controls or unrelated leaves', { skip }, async () => {
  const native = loadNative(), oldTheme = legacyFooterSelectors(theme);
  const paint = (id, part, children = '') => `<div id="${id}" aria-hidden="true" class="${escapeAttribute(native.render({ part }).props.className)}">${children}</div>`;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1260, height: 920 } });
    // The real renderer supplies every paint leaf. The source-proven owners
    // below provide layout/scroll bounds and inert input slots only; they add
    // no alternative native footer paint, dimensions or special gradient class.
    await page.setContent(`<html data-theme="dark" data-codex-window-type="electron"><head><style>${native.css}</style><style>
      body{margin:0}#root{position:relative;padding:16px}section{position:relative;height:130px;margin:20px 0}
      #preview-reserve{position:relative;height:90px}
      #footer{position:relative;height:90px}
      #main,#dots{height:150px}#disclaimer{position:relative;height:45px}#dot-carrier{position:relative;height:60px}
      #workspace-portal,#dots-portal{position:relative;height:95px;margin:12px}#outside-root{position:relative;height:45px}
      #image-preview,#no-module,#with-children,#interactive,#other-owner,#no-hidden,#no-pointer,#no-variant,#hover-family,#substring-family{position:relative;height:40px;width:180px}
      .test-gradient{background-image:linear-gradient(#112233,#667788)}#call{padding:8px;border:2px solid #8ab;border-radius:12px;background:#456;color:#fff}
    </style></head><body><div id="root">
      <div id="footer" data-thread-scroll-footer="true"><button id="call">Call</button></div>
      <div id="preview-reserve" class="thread-scroll-container">${paint('portal-fade', 'fade')}</div>
      <section id="dots" class="messaging-root messaging-embedded"><div data-app-shell-main-content-layout><div class="composer-wrap">
        <div id="disclaimer" class="composer-disclaimer-above relative">${paint('dot-disclaimer', 'surface')}<span>Disclaimer</span></div>
        <div id="dot-carrier" class="reply-chain-host reply-chain-host-open">${paint('dot-combined')}<input id="message" aria-label="Message" style="position:relative"></div>
      </div></div></section>
      <section id="main" data-app-shell-main-content-layout>${paint('home-combined')}${paint('health-surface', 'surface')}
        <div id="image-preview" aria-hidden="true" class="pointer-events-none test-gradient"><img alt="Preview"></div>
        <div id="no-module" aria-hidden="true" class="pointer-events-none test-gradient"></div>
        ${paint('with-children', 'fade', '<span>Native content</span>')}
        <button id="interactive" class="${escapeAttribute(native.render({}).props.className)}">Control</button>
        <div id="no-hidden" class="${escapeAttribute(native.render({}).props.className)}"></div>
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
    const cleared = ['portal-fade', 'dot-disclaimer', 'dot-combined', 'home-combined', 'health-surface', 'portal-surface', 'portal-combined'];
    const preserved = ['image-preview', 'no-module', 'with-children', 'interactive', 'other-owner', 'outside-root', 'no-hidden', 'no-pointer', 'no-variant', 'hover-family', 'substring-family', 'call'];
    const capture = () => page.locator('[id]').evaluateAll(elements => Object.fromEntries(elements.map(element => {
      const css = getComputedStyle(element), rect = element.getBoundingClientRect();
      return [element.id, { geometry: [rect.x, rect.y, rect.width, rect.height, css.position, css.padding, css.margin, css.borderWidth, css.borderRadius, css.cornerShape, css.font, css.opacity, css.pointerEvents],
        paint: [css.backgroundColor, css.backgroundImage, css.color, css.boxShadow, css.backdropFilter], value: element.value, disabled: element.disabled, tabIndex: element.tabIndex }];
    })));
    const external = () => page.frameLocator('iframe').locator('body,input').evaluateAll(elements => elements.map(element => {
      const css = getComputedStyle(element); return [css.backgroundColor, css.borderRadius, element.value];
    }));
    for (const mode of ['dark', 'light']) for (const width of [720, 1260]) for (const height of [660, 920]) {
      const label = `${mode}/${width}x${height}`;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: mode });
      await style.evaluate((node, css) => { node.textContent = css; }, oldTheme);
      await page.evaluate(mode => {
        const root = document.documentElement; root.classList.remove('forge-ink-mountain');
        Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: 'true' });
      }, mode);
      const before = await capture(), frameBefore = await external();
      for (const id of cleared) assert.ok(before[id].paint[0] !== 'rgba(0, 0, 0, 0)' || before[id].paint[1] !== 'none', `${label}: ${id} must actually own native paint`);
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const legacy = await capture();
      for (const id of ['portal-fade', 'dot-combined', 'dot-disclaimer', 'portal-surface', 'portal-combined']) assert.ok(legacy[id].paint[0] !== 'rgba(0, 0, 0, 0)' || legacy[id].paint[1] !== 'none', `${label}: old CSS must reproduce missed native paint in ${id}`);
      await style.evaluate((node, css) => { node.textContent = css; }, theme);
      const after = await capture();
      for (const id of Object.keys(before)) assert.deepEqual(after[id].geometry, before[id].geometry, `${label}: ${id} retains native geometry`);
      for (const id of cleared) {
        assert.deepEqual(after[id].paint.slice(0, 2), ['rgba(0, 0, 0, 0)', 'none'], `${label}: ${id} clears solid and gradient paint`);
        assert.deepEqual(after[id].paint.slice(2), before[id].paint.slice(2), `${label}: ${id} changes background only`);
      }
      for (const id of preserved) assert.deepEqual(after[id], before[id], `${label}: ${id} is outside the decorative owner contract`);
      assert.deepEqual(await external(), frameBefore, `${label}: external frames remain isolated`);
    }
    await page.locator('#message').fill('Still editable');
    assert.equal(await page.locator('#message').inputValue(), 'Still editable');
    await page.locator('#call').click();
    assert.equal(await page.locator('#call').evaluate(element => element === document.activeElement), true);
  } finally { await browser.close(); }
});

test('thread footer clears only native backdrop and voice focus paint once the wallpaper is ready', { skip }, async () => {
  const native = loadNative();
  const focusMarker = 'data-thread-focus-mode';
  const focusUtility = `has-[[${focusMarker}]]:bg-surface`;
  const records = native.bundle.findModules(['data-thread-composer-backdrop', 'data-thread-scroll-footer']);
  assert.equal(records.length, 1, 'Current ThreadScrollLayout backdrop owner changed');
  const outerFooters = nodes(records[0].ast).flatMap(node => {
    if (node.type !== 'CallExpression' || text(node.arguments[0]) !== 'div') return [];
    const props = node.arguments[1];
    const child = prop(props, 'children');
    if (child?.type !== 'CallExpression' || text(prop(child.arguments[1], 'data-thread-scroll-footer')) !== 'true') return [];
    const carrier = prop(child.arguments[1], 'children')?.elements?.find(item => prop(item?.arguments?.[1], 'data-thread-composer-backdrop'));
    if (!carrier) return [];
    const classes = nodes(prop(props, 'className')).map(text);
    const utility = classes.find(value => value.split(/\s+/).includes(focusUtility));
    const moduleClass = classes.find(value => /^footer-\S+$/.test(value));
    return utility && moduleClass ? [{ moduleClass, outerClass: `${moduleClass} ${utility} bottom-0` }] : [];
  });
  assert.equal(outerFooters.length, 1, 'Native focus paint must sit on the parent of the semantic thread footer');
  assert.ok(native.bundle.findModules([`"${focusMarker}"`]).some(record => nodes(record.ast)
    .some(node => node.type === 'Property' && key(node.key) === focusMarker)), 'Native voice stage must emit the focus marker');
  const [{ outerClass, moduleClass }] = outerFooters;
  const pseudoSelector = `.${moduleClass}:has([data-thread-composer-backdrop] [data-composer-body])`;
  const backdropCss = native.bundle.stylesheetAssets([pseudoSelector])[0];
  assert.ok(backdropCss, 'Native thread footer backdrop stylesheet is missing');
  const backdropRules = postcss.parse(native.bundle.read(backdropCss));
  for (const pseudo of ['before', 'after']) {
    const paint = [];
    backdropRules.walkRules(pseudoSelector + ':' + pseudo, rule => {
      rule.walkDecls('background', declaration => paint.push(declaration.value));
    });
    assert.equal(paint.length, 1, `Native footer ${pseudo} paint owner changed`);
    assert.match(paint[0], pseudo === 'before' ? /linear-gradient\(.*var\(--color-surface\)/ : /^var\(--color-surface\)$/);
  }
  const sheets = new Set([
    ...native.bundle.baseStylesheets(),
    ...native.bundle.stylesheetAssets([native.classes.background]),
    ...native.bundle.stylesheetAssets([`has([${focusMarker}])`]),
    backdropCss
  ]);
  const css = `${native.bundle.layerOrder}\n${[...sheets].map(asset => native.bundle.read(asset)).join('\n')}`;
  const section = (id, classes, content, style = '') => `<section class="host"><div id="${id}" class="${escapeAttribute(classes)}" style="${style}">${content}</div></section>`;
  const footer = (content, id = '') => `<div ${id ? `id="${id}"` : ''} data-thread-scroll-footer="true" class="relative w-full shrink-0 fixture-footer">${content}</div>`;
  const marked = `<div ${focusMarker}="true"></div>`;
  const composer = '<div data-thread-composer-backdrop><div data-composer-body><button id="voice-control" class="pointer-events-auto">Voice action</button></div></div>';
  const body = section('focus-outer', outerClass, footer('<div id="voice-stage"></div>' + composer, 'focus-inner')) +
    section('nested-decoy', outerClass, `<div>${footer(marked + '<div data-thread-composer-backdrop><div data-composer-body></div></div>')}</div>`) +
    section('interactive-decoy', outerClass.replace('pointer-events-none ', ''), footer(marked)) +
    section('paint-decoy', outerClass.replace(focusUtility, ''), footer(marked), 'background-color:rgb(40,60,80)');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
    await page.setContent(`<html data-codex-window-type="electron"><head><style>${css}</style><style>${theme}</style><style>
      body{margin:0}.host{position:relative;height:120px}.fixture-footer{height:86px}
      #voice-control{margin:16px;padding:6px 12px;background-color:rgb(35,65,85);color:white}
    </style></head><body><div id="root"><main data-app-shell-main-content-layout>${body}</main></div></body></html>`);
    const transparent = 'rgba(0, 0, 0, 0)';
    const state = ({ mode, themed, ready, focused }) => page.evaluate(({ mode, themed, ready, focused, focusMarker }) => {
      const root = document.documentElement;
      root.className = `electron-${mode}${themed ? ' forge-ink-mountain' : ''}`;
      Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: String(ready) });
      document.getElementById('voice-stage').toggleAttribute(focusMarker, focused);
    }, { mode, themed, ready, focused, focusMarker });
    const read = () => page.locator('.host [id]').evaluateAll(elements => Object.fromEntries(elements.map(element => {
      const css = getComputedStyle(element), rect = element.getBoundingClientRect();
      const readPseudo = pseudo => {
        const style = getComputedStyle(element, pseudo);
        return { color: style.backgroundColor, image: style.backgroundImage, top: style.top, bottom: style.bottom,
          content: style.content, opacity: style.opacity, pointerEvents: style.pointerEvents };
      };
      return [element.id, { color: css.backgroundColor, image: css.backgroundImage, shadow: css.boxShadow,
        rect: [rect.x, rect.y, rect.width, rect.height], position: css.position, radius: css.borderRadius,
        pointerEvents: css.pointerEvents, disabled: element.disabled, tabIndex: element.tabIndex,
        before: readPseudo('::before'), after: readPseudo('::after') }];
    })));
    const cleared = (snapshot, color = snapshot['focus-outer'].color) => {
      const outer = snapshot['focus-outer'];
      return { ...snapshot, 'focus-outer': { ...outer, color,
        before: { ...outer.before, color: transparent, image: 'none' },
        after: { ...outer.after, color: transparent, image: 'none' } } };
    };
    for (const mode of ['dark', 'light']) for (const width of [680, 960]) {
      await page.setViewportSize({ width, height: 640 });
      await page.emulateMedia({ colorScheme: mode });
      await state({ mode, themed: false, ready: true, focused: false });
      const normal = await read();
      assert.equal(normal['focus-outer'].color, transparent, `${mode}: ordinary footer has no outer plate`);
      assert.match(normal['focus-outer'].before.image, /linear-gradient/);
      assert.notEqual(normal['focus-outer'].after.color, transparent);
      assert.match(normal['nested-decoy'].before.image, /linear-gradient/);
      await state({ mode, themed: true, ready: true, focused: false });
      assert.deepEqual(await read(), cleared(normal), `${mode}: clear normal footer pseudos only`);
      await state({ mode, themed: false, ready: true, focused: true });
      const focused = await read();
      for (const id of ['focus-outer', 'nested-decoy', 'interactive-decoy', 'paint-decoy']) {
        assert.notEqual(focused[id].color, transparent, `${mode}: ${id} must actually paint`);
      }
      await state({ mode, themed: true, ready: false, focused: true });
      assert.deepEqual(await read(), focused, `${mode}: keep native focus paint until the wallpaper is ready`);
      await state({ mode, themed: true, ready: true, focused: true });
      assert.deepEqual(await read(), cleared(focused, transparent),
        `${mode}: clear focus plate and pseudos while preserving geometry, controls, and unrelated carriers`);
      await page.locator('#voice-control').click();
      assert.equal(await page.locator('#voice-control').evaluate(element => element === document.activeElement), true);
      await state({ mode, themed: true, ready: true, focused: false });
      assert.deepEqual(await read(), cleared(normal), `${mode}: leaving focus restores the ordinary footer`);
    }
    const previewDirectory = process.env.WUKONG_THREAD_FOOTER_PREVIEW_DIRECTORY;
    if (previewDirectory) {
      const wallpaper = fs.readFileSync(new URL('../themes/backgrounds/scenery-01.jpg', import.meta.url)).toString('base64');
      fs.mkdirSync(previewDirectory, { recursive: true });
      await page.setViewportSize({ width: 760, height: 640 });
      await page.addStyleTag({ content: `
        .host:first-child{height:172px;background:center 75%/cover url("data:image/jpeg;base64,${wallpaper}")}
        .host:first-child::before{content:"Composer footer · fixture";position:absolute;inset:12px auto auto 16px;color:#fff;font:14px sans-serif}
        #focus-outer{height:110px}
        #focus-inner{display:grid;place-items:center}
        #voice-control{position:relative;z-index:1;border-radius:18px;min-width:280px;min-height:52px;margin:0;
          background:var(--color-surface-elevated-secondary);color:var(--color-text);text-align:start;padding-inline:16px}
      ` });
      await page.locator('#voice-control').evaluate(button => button.textContent = '示例输入框');
      for (const mode of ['dark', 'light']) {
        await page.emulateMedia({ colorScheme: mode });
        await state({ mode, themed: true, ready: true, focused: false });
        await page.locator('.host').first().screenshot({
          path: path.join(previewDirectory, `${mode}-thread-footer-fixture-20261115.png`)
        });
      }
    }
  } finally { await browser.close(); }
});
