import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { loadQuotaNative, quotaHtml } from './native-quota-current-helper.mjs';
import { nodes, prop, text, key, nativeFunction } from './native-bundle-current-helper.mjs';
import { makeApplyExpression, makeStyleUpdateExpression, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const scene = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><path fill="#47789b" d="M0 0h32v24H0z"/></svg>');
const brand = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168"><path fill="#f7d589" d="M18 68h132v32H18z"/></svg>');
const variables = `:root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("${scene}");--forge-ui-landing-mark:url("${brand}");}`;
const oldSheet = postcss.parse(theme);
let oldIcon = 0, oldTitle = 0, oldRail = 0;
oldSheet.walkRules(rule => {
  if (rule.selector.includes('[data-testid="home-icon"]')) {
    rule.selector = rule.selector.replaceAll('[data-testid="home-icon"]', '[data-testid="home-icon"][data-forge-mark="1"]'); oldIcon++;
  }
  if (rule.selector.includes('[data-feature="game-source"]')) {
    rule.selector = rule.selector.replaceAll('[data-feature="game-source"]', '[data-forge-title-copy]'); oldTitle++;
  }
  if (rule.selector.includes('[data-composer-utility-rail]')) {
    rule.selector = rule.selector.replaceAll('[data-composer-utility-rail]', ':not(*)'); oldRail++;
  }
});
assert.ok(oldIcon && oldTitle && oldRail, 'First-paint negative control must retain marker paint while removing all three native interfaces');
const oldTheme = oldSheet.toString();
const element = (tag, props) => ({ tag, props });
const jsx = record => nodes(record.ast).filter(n => n.type === 'CallExpression' && n.arguments[1]?.type === 'ObjectExpression');
let cached;
const loadLandingNative = () => {
  if (cached) return cached;
  const native = loadQuotaNative(), { bundle, harness } = native;
  const records = bundle.findModules(['data-testid', 'home-icon', 'game-source']);
  assert.equal(records.length, 1, 'Native home icon and project heading must belong to one audited presentation module');
  const record = records[0];
  const icon = jsx(record).find(n => text(prop(n.arguments[1], 'data-testid')) === 'home-icon');
  const title = jsx(record).find(n => text(prop(n.arguments[1], 'data-feature')) === 'game-source');
  assert.ok(icon && title);
  assert.equal(text(prop(icon.arguments[1], 'aria-hidden')), 'true');
  assert.equal(text(title.arguments[0]), 'div', 'game-source is the heading itself, not a hero ancestor');
  const heading = nativeFunction(record, title.start), iconFn = nativeFunction(record, icon.start);
  const titleSpan = prop(title.arguments[1], 'children');
  assert.equal(text(titleSpan.arguments[0]), 'span');
  const projectCall = heading.nodes.find(n => n.type === 'CallExpression' && n.arguments[0]?.type === 'Identifier' && prop(n.arguments[1], 'children'));
  const projectFn = nodes(record.ast).find(n => n.type === 'FunctionDeclaration' && n.id?.name === projectCall?.arguments[0].name);
  assert.ok(projectFn && record.source.slice(projectFn.start, projectFn.end).includes('type:"button"'), 'Rich project heading must retain its real project trigger');
  const motionHero = heading.nodes.find(n => n.type === 'CallExpression' && text(prop(n.arguments[1], 'className')) === 'flex w-full flex-col items-center gap-6');
  assert.ok(motionHero && prop(motionHero.arguments[1], 'variants'), 'Native heading and icon retain one animated hero owner');
  const iconCaller = nodes(record.ast).find(n => n.type === 'FunctionDeclaration' && n !== iconFn.ast && nodes(n).some(x => x.type === 'CallExpression' && x.arguments[0]?.name === iconFn.ast.id.name));
  assert.ok(iconCaller);
  const imports = bundle.imports(record);
  const glyphCandidates = nodes(iconCaller).filter(n => n.type === 'CallExpression' && n.arguments[0]?.type === 'MemberExpression' && imports[n.arguments[0].object?.name]).map(n => {
    const imported = imports[n.arguments[0].object.name], candidate = bundle.module(imported.id), exported = bundle.exports(candidate)[key(n.arguments[0].property)];
    return { candidate, exported };
  }).filter(({ exported }) => exported?.type === 'ArrowFunctionExpression' && nodes(exported).some(n => n.type === 'CallExpression' && text(n.arguments[0]) === 'svg'));
  assert.equal(glyphCandidates.length, 1, 'The native static Codex SVG stays linked through the real icon renderer');
  const glyph = glyphCandidates[0];
  const renderGlyph = harness.compile(nativeFunction(glyph.candidate, glyph.exported.start));
  const renderProject = harness.compile(nativeFunction(record, projectFn.start));
  const utilityModules = bundle.findModules(['data-composer-utility-rail', 'data-composer-utility-bar-scroll-area']);
  assert.equal(utilityModules.length, 1);
  const utility = utilityModules[0], railCall = jsx(utility).find(n => prop(n.arguments[1], 'data-composer-utility-rail'));
  assert.equal(text(prop(railCall.arguments[1], 'variant')), 'controls');
  assert.ok(nodes(utility.ast).some(n => text(n) === 'bg-background-composer-action-bar'), 'Utility material remains on the native rail item');
  const railImport = bundle.imports(utility)[railCall.arguments[0].object.object.name];
  assert.ok(railImport);
  const railRegistry = harness.load(railImport.id)[key(railCall.arguments[0].object.property)];
  const scroll = jsx(utility).find(n => prop(n.arguments[1], 'data-composer-utility-bar-scroll-area'));
  const scrollFn = nativeFunction(utility, scroll.start);
  const scrollClass = scrollFn.nodes.map(text).find(value => value.startsWith('horizontal-scroll-fade-mask '));
  const rowClass = nativeFunction(utility, railCall.start).nodes.map(text).find(value => value === 'flex min-w-0 items-center justify-between gap-2 py-1.5 text-size-chat');
  assert.ok(scrollClass && rowClass);
  const localWrappers = bundle.modulesInAsset(utility.asset).filter(candidate => /utilityBarVariant:\s*"home"/.test(candidate.source));
  const wrappers = localWrappers.length ? localWrappers : bundle.findModules([new RegExp(`\\b\\w+\\(["']${utility.id}["']\\)`), /utilityBarVariant:\s*"home"/]);
  assert.equal(wrappers.length, 1);
  assert.ok(wrappers[0].source.includes('variant:"home"') && wrappers[0].source.includes('UtilityBarSlot'), 'Home wrapper routes the action bar through the native home slot');
  const composerRecord = [native.composerRoot.record];
  assert.ok(composerRecord[0].source.includes('data-composer-utility-bar-variant') && composerRecord[0].source.includes('UtilityBarSlot'));
  const utilitySlot = nodes(composerRecord[0].ast).find(n => n.type === 'Property' && key(n.key) === 'UtilityBarSlot');
  assert.ok(utilitySlot && nodes(utilitySlot).some(n => text(n) === 'bottom-full') && nodes(utilitySlot).some(n => text(n) === 'top-full'), 'Home slot retains native placement, rather than treating home as above');
  const classes = { icon: text(prop(icon.arguments[1], 'className')), title: text(prop(title.arguments[1], 'className')),
    span: text(prop(titleSpan.arguments[1], 'className')), hero: text(prop(motionHero.arguments[1], 'className')), scroll: scrollClass, row: rowClass };
  cached = { ...native, classes, renderGlyph, renderProject, railRegistry };
  return cached;
};

const mountMarkup = native => {
  const icon = element('div', { id: 'home-icon', 'data-testid': 'home-icon', 'aria-hidden': 'true', className: native.classes.icon,
    children: native.renderGlyph({ id: 'native-logo', className: 'absolute inset-0 size-full' }) });
  const heading = element('div', { id: 'home-title', 'data-feature': 'game-source', className: native.classes.title,
    children: element('span', { className: native.classes.span, children: ['What should we build in ', native.renderProject({ id: 'hero-project', children: 'Fixture project' }), '?'] }) });
  const project = native.renderButton({ id: 'utility-project', 'data-composer-navigation-target': 'workspace-project', children: 'Fixture project', color: 'ghost', size: 'composer' });
  const scroll = element('div', { id: 'utility-scroll', 'data-composer-utility-bar-scroll-area': '', className: native.classes.scroll,
    role: 'group', 'aria-label': 'Composer utility bar', children: element('div', { className: 'flex w-max min-w-full items-center gap-2 p-0.5', children: project }) });
  const rail = native.railRegistry.Item({ id: 'utility-rail', 'data-composer-utility-rail': '', className: 'px-1.5 bg-background-composer-action-bar', variant: 'controls',
    children: element('div', { id: 'utility-row', className: native.classes.row, children: scroll }) });
  const composer = native.renderComposerRoot({ id: 'composer-surface', utilityBarVariant: 'home', surfaceVariant: 'default', layout: 'multiline',
    children: native.renderComposerBody({ layout: 'multiline', children: element('textarea', { id: 'message', role: 'textbox', 'aria-label': 'Fixture message', rows: 2 }) }) });
  return quotaHtml([element('div', { id: 'hero-motion', className: native.classes.hero, children: [icon, heading] }),
    element('div', { id: 'composer-host', 'data-codex-composer-root': '', children: [element('div', { id: 'utility-position', className: 'relative z-0', children: rail }), composer] })]);
};
const fixture = (native, mode) => `<html class="electron-${mode}" data-theme="${mode}" data-codex-os="win32" data-codex-window-type="electron" style="color-scheme:${mode}"><head><style>${native.css}</style><style>
  body{margin:0;background:#47789b}main{min-height:760px;padding:60px 28px;box-sizing:border-box}#mount{max-width:760px;margin:auto;padding:28px 0}#hero-motion{min-height:180px}#composer-host{max-width:620px;margin:70px auto 0}#message{display:block;width:100%;min-height:90px;padding:14px;resize:none;box-sizing:border-box;background:transparent}#utility-position{margin:0 8px}#utility-scroll{min-width:0}#fixture-label{font:12px sans-serif;text-align:center;margin:0 0 30px;color:CanvasText}
  </style></head><body><div id="root"><main data-app-shell-main-surface="default"><div id="mount"><p id="fixture-label">Native presentation fixture · not a desktop screenshot</p><div id="late"></div></div></main></div></body></html>`;
const geometry = page => page.locator('#home-icon,#home-title,#hero-project,#utility-position,#utility-rail,#utility-row,#utility-scroll,#utility-project,#composer-surface,#message').evaluateAll(elements => elements.map(e => {
  const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { id: e.id, rect: [r.x, r.y, r.width, r.height], font: s.font, padding: s.padding, border: s.borderWidth, radius: s.borderRadius, overflow: s.overflow };
}));
const paint = page => page.evaluate(() => {
  const read = (id, pseudo) => { const s = getComputedStyle(document.getElementById(id), pseudo); return { content: s.content, image: s.backgroundImage, color: s.color, fill: s.webkitTextFillColor, opacity: s.opacity, display: s.display, blur: s.backdropFilter, background: s.backgroundColor, shadow: s.boxShadow, border: s.borderColor }; };
  return { title: read('home-title', '::after'), project: read('hero-project'), icon: read('home-icon', '::before'), logo: read('native-logo'), rail: read('utility-rail') };
});
const prepare = async (page, native, mode, sheet = theme, vars = variables) => {
  await page.setContent(fixture(native, mode));
  await page.evaluate(makeApplyExpression({ styleSheet: sheet, variables: vars }));
  await page.waitForFunction(() => document.documentElement.dataset.forgeBackgroundReady === 'true');
  await page.waitForTimeout(1100);
  await page.evaluate(() => {
    const r = window.__wukongCodexThemeRuntimeV13;
    r.observer.disconnect(); r.resizeObserver.disconnect(); if (r.timer) clearTimeout(r.timer); r.timer = 0;
    r.routeTimers.forEach(clearTimeout); r.routeTimers.clear();
    document.documentElement.dataset.forgeSurface = 'thread';
  });
};
const insert = (page, markup) => page.evaluate(markup => {
  document.getElementById('late').innerHTML = markup; window.fixtureProjectClicks = 0;
  for (const id of ['hero-project', 'utility-project']) document.getElementById(id).onclick = () => fixtureProjectClicks++;
}, markup);

test('current native home exposes the heading, static logo, rich project trigger and independent utility paint owner', () => {
  const native = loadLandingNative();
  assert.match(native.classes.icon, /relative size-14/);
  assert.match(native.classes.title, /heading-xl/);
});

test('late native home paints its replacement before markers while preserving controls, toggles and restoration', async () => {
  const native = loadLandingNative(), markup = mountMarkup(native), browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) for (const width of [900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 760 }, colorScheme: mode });
      try {
        await prepare(page, native, mode); await insert(page, markup);
        assert.equal(await page.locator('#late [data-forge-mark],#late [data-forge-title-copy]').count(), 0, 'Capture first paint with runtime marking withheld');
        const before = await geometry(page), first = await paint(page);
        assert.equal(first.logo.opacity, '0'); assert.match(first.icon.image, /^url\(/); assert.match(first.title.content, /此去，欲破何局/);
        assert.equal(first.project.fill, 'rgba(0, 0, 0, 0)'); assert.notEqual(first.rail.blur, 'none');
        await page.evaluate(() => window.__wukongCodexThemeRuntimeV13.refresh());
        assert.deepEqual(await paint(page), first, `${mode}/${width}: marker arrival must not change hero or utility paint`);
        assert.deepEqual(await geometry(page), before);
        await page.locator('#hero-project').click(); await page.locator('#utility-project').click();
        assert.equal(await page.evaluate(() => fixtureProjectClicks), 2);
        await page.evaluate(() => {
          window.__wukongCodexThemeRuntimeV13.toggleLandingQuote();
          document.getElementById('home-title').removeAttribute('data-forge-title-copy'); document.getElementById('home-icon').removeAttribute('data-forge-mark');
        });
        const hidden = await paint(page); assert.equal(hidden.title.opacity, '0'); assert.equal(hidden.icon.opacity, '0');
        await page.emulateMedia({ forcedColors: 'active' });
        const forced = await paint(page); assert.equal(forced.title.display, 'none'); assert.equal(forced.icon.display, 'none'); assert.equal(forced.logo.opacity, '1');
        assert.notEqual(forced.project.fill, 'rgba(0, 0, 0, 0)');
        await page.emulateMedia({ forcedColors: 'none' });
        await page.evaluate(() => { document.getElementById('home-icon').dataset.forgeMark = '1'; });
        await page.evaluate(RESTORE_EXPRESSION);
        const restored = await paint(page); assert.equal(restored.logo.opacity, '1'); assert.ok(!restored.title.content || ['none', 'normal'].includes(restored.title.content));
        assert.equal(await page.locator('[data-forge-owned],[data-forge-mark]').count(), 0);
        assert.equal(await page.locator('#late [class*="forge-"]').count(), 0);
        assert.deepEqual(await geometry(page), before);
      } finally { await page.close(); }
    }
    const negative = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    try {
      await prepare(negative, native, 'dark', oldTheme); await insert(negative, markup);
      const first = await paint(negative); assert.equal(first.logo.opacity, '1'); assert.equal(first.rail.blur, 'none'); assert.ok(!first.title.content || ['none', 'normal'].includes(first.title.content));
      await negative.evaluate(() => window.__wukongCodexThemeRuntimeV13.refresh());
      const marked = await paint(negative); assert.equal(marked.logo.opacity, '0'); assert.notEqual(marked.rail.blur, 'none'); assert.match(marked.title.content, /此去，欲破何局/);
    } finally { await negative.close(); }
    if (process.env.WUKONG_HOME_PREVIEW_DIRECTORY) {
      fs.mkdirSync(process.env.WUKONG_HOME_PREVIEW_DIRECTORY, { recursive: true });
      for (const mode of ['dark', 'light']) {
        const preview = await browser.newPage({ viewport: { width: 1280, height: 760 }, colorScheme: mode });
        try {
          await preview.setContent(fixture(native, mode)); await insert(preview, markup);
          await preview.evaluate(makeApplyExpression({ styleSheet: theme, variables: payloadFromThemeFile('themes/active.json').variables }));
          await preview.waitForFunction(() => document.documentElement.dataset.forgeBackgroundReady === 'true' && !window.__wukongCodexThemeRuntimeV13.transitionInFlight);
          fs.writeFileSync(path.join(process.env.WUKONG_HOME_PREVIEW_DIRECTORY, `${mode}-landing-first-paint-fixture-20261109.png`), await preview.locator('#mount').screenshot());
        } finally { await preview.close(); }
      }
    }
  } finally { await browser.close(); }
});
