import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import postcss from 'postcss';
import { loadQuotaNative, quotaNativeSkip, quotaHtml } from './native-quota-current-helper.mjs';
import { nodes, prop, text, key, nativeFunction, nativeObject } from './native-bundle-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const oldSheet = postcss.parse(theme);
let isolatedRule = 0;
oldSheet.walkRules(rule => {
  if (!rule.selector.includes('[data-thread-composer-backdrop]')) return;
  if (!rule.nodes.some(node => node.type === 'decl' && node.prop === '--composer-layout-surface-backdrop-filter' && node.value === 'none')) return;
  assert.ok(rule.selector.includes(':not([data-composer-drag-active])') &&
    ['default', 'opaque', 'secondary'].every(value => rule.selector.includes(`[data-composer-surface-variant="${value}"]`)),
  'The fix must stay on the three ordinary thread surfaces and exclude native drag feedback');
  assert.equal(rule.nodes.filter(node => node.type === 'decl').length, 1, 'The fix must change only backdrop sampling');
  isolatedRule++; rule.remove();
});
assert.equal(isolatedRule, 1, 'The working-text fix must have one bounded thread composer rule');
const previousTheme = oldSheet.toString();
const element = (tag, props) => ({ tag, props });
const shortLabel = 'Checking visual boundaries';
const longLabel = 'Checking the current composer and status paint boundaries';
const one = (items, message) => { assert.equal(items.length, 1, message); return items[0]; };
let cached;
const loadWorkingNative = () => {
  if (cached) return cached;
  const quota = loadQuotaNative(), { bundle, harness } = quota;
  const shimmer = one(bundle.findModules(['cadencedShimmerActive', 'startWithSweep', 'data-shimmer-visibility-root']), 'Native working-label shimmer changed');
  const sweepCall = nodes(shimmer.ast).find(node => node.type === 'CallExpression' &&
    key(prop(node.arguments[1], 'className')?.property) === 'cadencedShimmerSweep');
  assert.ok(sweepCall, 'Native shimmer must render its own aria-hidden sweep layer');
  assert.ok(prop(sweepCall.arguments[1], 'aria-hidden'), 'The duplicate highlight must remain decorative');
  const renderer = nativeFunction(shimmer, sweepCall.start);
  const mapAlias = prop(sweepCall.arguments[1], 'className').object.object.name;
  const mapRecord = bundle.module(bundle.imports(shimmer)[mapAlias].id);
  const shimmerClasses = nativeObject(mapRecord, bundle.exports(mapRecord).A);
  assert.ok(renderer.nodes.some(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'span' &&
    prop(node.arguments[1], 'ref') && prop(node.arguments[1], 'children')?.type === 'ArrayExpression'),
  'The real shimmer keeps original text and its highlight as siblings');
  assert.ok(renderer.source.includes('onSweepChange') && renderer.source.includes('document.hidden') &&
    renderer.source.includes('prefers-reduced-motion') && renderer.source.includes('4e3') && renderer.source.includes('1e3'),
  'Native shimmer cadence, visibility and reduced-motion boundaries changed');
  // useLayoutEffect is inert in the established presentation harness. Execute
  // the actual span renderer; no timers, observers or application state run.
  const renderShimmer = harness.compile(renderer);
  const lineRecord = one(bundle.findModules(['data-activity-text-slot', 'data-shimmer-visibility-root']), 'Native activity status line changed');
  const lineClass = nodes(lineRecord.ast).map(text).find(value => value.startsWith('flex w-fit max-w-full min-w-0 items-center overflow-hidden'));
  const cssMap = Object.values(bundle.imports(lineRecord)).map(imported => bundle.module(imported.id)).find(record =>
    prop(bundle.exports(record).A, 'line') && prop(bundle.exports(record).A, 'revealLabel'));
  assert.ok(lineClass && cssMap, 'Native status clipping and handoff presentation changed');
  const statusClasses = nativeObject(cssMap, bundle.exports(cssMap).A);
  const legacy = one(bundle.findModules(['activeCommentary-', 'showShimmer:']), 'Native commentary shimmer owner changed');
  const legacyClass = nodes(legacy.ast).map(text).find(value => value.includes('activeCommentary-') && value.endsWith(' loading-shimmer'));
  assert.ok(legacyClass && legacy.source.includes('showShimmer'), 'Legacy text-clipped commentary variant remains source-bound');
  const cssAssets = new Set([bundle.stylesheetAssets(`.${shimmerClasses.cadencedShimmer}`)[0],
    bundle.stylesheetAssets(`.${statusClasses.line}`)[0], bundle.stylesheetAssets(`.${legacyClass.split(' ')[0]}`)[0],
    bundle.stylesheetAssets(['.loading-shimmer-pure-text', '@keyframes loading-shimmer{'])[0]]);
  assert.ok(!cssAssets.has(undefined), 'Native working-status CSS is missing');
  const css = `${quota.css}\n${[...cssAssets].map(asset => bundle.read(asset)).join('\n')}`;
  assert.ok(css.includes('background-clip:text') && css.includes('mask-image:linear-gradient(90deg,#0000') &&
    css.includes('@keyframes ' + shimmerClasses.cadencedLoadingShimmerSweep), 'Native text clipping, mask and sweep animation changed');
  cached = { ...quota, css, shimmer, renderer, renderShimmer, shimmerClasses, statusClasses, lineClass, legacyClass };
  return cached;
};

const statusTree = (native, state) => {
  if (state === 'legacy') return element('div', { id: 'status-root', className: native.legacyClass, children: shortLabel });
  const { statusClasses: c } = native;
  const handoff = state.startsWith('handoff');
  const label = state === 'steady-long' || state === 'handoff-long' ? longLabel : shortLabel;
  const old = label === shortLabel ? longLabel : shortLabel;
  const shimmer = native.renderShimmer({ className: c.label, startWithSweep: true, children: label });
  return element('span', { id: 'status-root', role: 'status', 'data-shimmer-visibility-root': '',
    className: `${c.line} ${native.lineClass}`, children: element('span', { 'data-activity-text-slot': '',
      className: `${c.slot} ${native.shimmerClasses.sweepTiming}`, children: [
        handoff ? element('span', { 'aria-hidden': true, inert: true,
          className: `${native.shimmerClasses.cadencedShimmer} ${c.outgoing}`, children: old }) : null,
        element('span', { className: `${c.viewport} ${handoff ? c.reveal : ''}`, children: shimmer })
      ] }) });
};

const composerTree = native => {
  const button = (id, children, color = 'ghost', disabled = false) => native.renderButton({ id, children, color, disabled,
    size: 'composer', radius: 'full' });
  const tree = native.renderLayout({ layoutState: { layout: 'multiline' }, surfacePlacement: { kind: 'thread' },
    editor: { readOnlyContent: element('div', { id: 'fixture-editor', role: 'textbox', 'aria-label': 'Fixture message',
      contenteditable: true, className: 'min-h-[var(--composer-editor-min-height,2.5rem)] text-base outline-none', children: 'Fixture input' }) },
    leadingActions: [button('fixture-add', '+'), button('fixture-disabled', 'Disabled', 'ghost', true)],
    primaryAction: button('fixture-send', 'Send', 'primary') });
  const mark = tree => { if (!tree || typeof tree !== 'object') return; if (Array.isArray(tree)) return tree.forEach(mark);
    if (tree.props?.['data-composer-surface-variant']) tree.props.id = 'composer-fixture'; mark(tree.props?.children); };
  mark(tree);
  return tree;
};

const pixels = buffer => PNG.sync.read(buffer).data;
const difference = (left, right) => { assert.equal(left.length, right.length); let changed = 0;
  for (let index = 0; index < left.length; index += 4) if (left[index] !== right[index] || left[index + 1] !== right[index + 1] ||
    left[index + 2] !== right[index + 2] || left[index + 3] !== right[index + 3]) changed++; return changed; };

test('native working text keeps the original text, decorative mask and source-bound handoff classes', { skip: quotaNativeSkip }, () => {
  const native = loadWorkingNative();
  const tree = native.renderShimmer({ children: shortLabel, startWithSweep: true });
  assert.equal(tree.tag, 'span');
  assert.equal(tree.props.children[0], shortLabel);
  assert.equal(tree.props.children[1].props['aria-hidden'], true);
  assert.equal(tree.props.children[1].props.className, native.shimmerClasses.cadencedShimmerSweep);
  assert.equal(tree.props.children[1].props.children.props.className, native.shimmerClasses.cadencedShimmerHighlight);
  assert.equal(tree.props.children[1].props.children.props.children, shortLabel);
});

test('thread composer stops backdrop sampling while native working sweep, handoff, controls and restoration remain intact', { skip: quotaNativeSkip }, async t => {
  const native = loadWorkingNative(), browser = await chromium.launch({ headless: true });
  const report = [];
  try {
    for (const mode of ['dark', 'light']) for (const state of ['steady-short', 'steady-long', 'handoff-long', 'handoff-short', 'legacy']) {
      const page = await browser.newPage({ viewport: { width: 920, height: 520 }, colorScheme: mode, reducedMotion: 'no-preference' });
      try {
        await page.setContent(`<html data-theme="${mode}" data-reduced-motion="false" data-codex-os="win32" data-codex-window-type="electron"><style>${native.css}</style><style>
          body{margin:0;background:linear-gradient(120deg,#1d384b,#91a1a8);min-height:100vh}#fixture{width:700px;margin:60px auto}
          #status-mount{margin-bottom:8px}#fixture-editor{caret-color:transparent}
        </style><body><div id="fixture"><div id="status-mount">${quotaHtml(statusTree(native, state))}</div><div data-thread-scroll-footer="true" data-thread-composer-backdrop><div data-codex-composer-root>${quotaHtml(composerTree(native))}</div></div></div></body></html>`);
        await page.evaluate(({ active, shimmer }) => {
          document.querySelectorAll('#status-root .' + active).forEach(node => node.classList.remove(active));
          const label = document.querySelector('#status-root .' + shimmer + ':has([aria-hidden])');
          label?.classList.add(active);
          window.fixtureIdentity = [document.querySelector('#composer-fixture'), document.querySelector('#fixture-editor'), document.querySelector('#fixture-send')];
        }, { active: native.shimmerClasses.cadencedShimmerActive, shimmer: native.shimmerClasses.cadencedShimmer });
        const geometry = () => page.locator('#status-root,#composer-fixture,#fixture-editor,#composer-fixture button').evaluateAll(elements => elements.map(element => {
          const s = getComputedStyle(element), r = element.getBoundingClientRect();
          return { id: element.id, rect: [r.x, r.y, r.width, r.height], font: s.font, radius: s.borderRadius,
            border: s.borderWidth, role: element.getAttribute('role'), editable: element.getAttribute('contenteditable'),
            disabled: element.disabled, tabIndex: element.tabIndex, pointer: s.pointerEvents };
        }));
        const at = async time => {
          await page.evaluate(time => { for (const animation of document.querySelector('#status-root').getAnimations({ subtree: true })) {
            animation.pause(); animation.currentTime = time;
          } }, time);
          await page.waitForTimeout(20);
        };
        await at(0);
        const original = await geometry(), originalText = await page.locator('#status-root').textContent();
        const frames = state === 'legacy' ? [0, 1000, 2000, 3000, 3999] : [0, 250, 500, 750, 999];
        let statusChanges = 0;
        const themeStyle = await page.addStyleTag({ content: theme });
        let previousPaint;
        for (const appearance of ['native', 'previous', 'theme']) {
          await themeStyle.evaluate((element, content) => { element.textContent = content; }, appearance === 'previous' ? previousTheme : theme);
          await page.evaluate(({ appearance, mode }) => { document.documentElement.classList.toggle('forge-ink-mountain', appearance === 'theme');
            document.documentElement.classList.toggle('forge-ink-mountain', appearance !== 'native');
            document.documentElement.dataset.forgeNativeTheme = mode; }, { appearance, mode });
          await at(0);
          assert.deepEqual(await geometry(), original, `${mode}/${state}/${appearance}: original layout and controls`);
          const names = await page.locator('#status-root').evaluate(element => element.getAnimations({ subtree: true }).map(animation => animation.animationName));
          assert.ok(names.some(name => state === 'legacy' ? name === 'loading-shimmer' : name.startsWith('cadencedLoadingShimmer')),
            'The source animation remains active, including in theme mode');
          const inputBaseline = pixels(await page.locator('#composer-fixture').screenshot({ caret: 'hide' }));
          const statusBaseline = pixels(await page.locator('#status-root').screenshot({ caret: 'hide' }));
          let maxInputChangedPixels = 0;
          for (const phase of frames) {
            await at(phase);
            assert.deepEqual(await geometry(), original, `${mode}/${state}/${appearance}/${phase}: no input or status layout mutation`);
            assert.equal(await page.locator('#status-root').textContent(), originalText, 'The shimmer preserves its original text');
            maxInputChangedPixels = Math.max(maxInputChangedPixels,
              difference(inputBaseline, pixels(await page.locator('#composer-fixture').screenshot({ caret: 'hide' }))));
            statusChanges = Math.max(statusChanges, difference(statusBaseline, pixels(await page.locator('#status-root').screenshot({ caret: 'hide' }))));
          }
          const paint = await page.locator('#composer-fixture').evaluate(element => { const s = getComputedStyle(element);
            return { blur: s.backdropFilter, fill: s.backgroundColor, highlight: s.backgroundImage, shadow: s.boxShadow }; });
          if (appearance === 'previous') {
            assert.match(paint.blur, /^blur\(/, 'Removing only the bounded fix restores the former thread backdrop sampling');
            previousPaint = paint;
          } else if (appearance === 'theme') {
            assert.equal(paint.blur, 'none', 'The ordinary thread input must stop sampling the animated backdrop');
            assert.deepEqual({ ...paint, blur: previousPaint.blur }, previousPaint, 'Fill, highlight and shadow stay unchanged');
            assert.equal(maxInputChangedPixels, 0, 'The fixed thread input stays pixel-stable across native text animation phases');
          }
          report.push({ mode, state, appearance, sampledFrames: frames.length, maxInputChangedPixels,
            composerBlur: paint.blur });
        }
        assert.ok(statusChanges > 0, 'The native text highlight/handoff remains visibly animated');
        await page.locator('#fixture-editor').fill('Fixture input remains editable');
        assert.equal(await page.locator('#fixture-editor').textContent(), 'Fixture input remains editable');
        await page.locator('#fixture-send').evaluate(element => { window.fixtureClicks = 0; element.onclick = () => window.fixtureClicks++; });
        await page.locator('#fixture-send').click();
        assert.equal(await page.evaluate(() => window.fixtureClicks), 1);
        assert.equal(await page.locator('#fixture-disabled').isDisabled(), true);
        await themeStyle.evaluate(element => element.remove());
        await page.evaluate(() => { document.documentElement.classList.remove('forge-ink-mountain'); document.activeElement?.blur(); });
        await at(0);
        assert.deepEqual(await geometry(), original, 'Native restoration retains all bounds and control semantics');
        assert.equal(await page.evaluate(() => fixtureIdentity.every(element => element.isConnected) &&
          fixtureIdentity[0] === document.querySelector('#composer-fixture') && fixtureIdentity[1] === document.querySelector('#fixture-editor') &&
          fixtureIdentity[2] === document.querySelector('#fixture-send')), true);
        assert.equal(await page.locator('#fixture-editor').textContent(), 'Fixture input remains editable');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
  // This is pixel evidence, not an assertion that the user's intermittent
  // artifact was reproduced or fixed. Native masks/transforms are retained.
  t.diagnostic(JSON.stringify({ evidence: 'native status/composer fixture; no live conversation', cases: report,
    composerPixelsVariedAcrossPhases: report.some(item => item.maxInputChangedPixels > 0), liveArtifactVerified: false,
    productionFixAsserted: true, headlessArtifactReproductionAsserted: false }));
});

test('thread-only backdrop fix keeps home and independent glass filters on all three painted native surfaces', { skip: quotaNativeSkip }, async () => {
  const native = loadWorkingNative(), browser = await chromium.launch({ headless: true });
  const fixture = (utility, variant, kind) => {
    const context = native.harness.load(native.composerRoot.record.id).k;
    native.harness.contexts.set(context, { isHome: utility === 'home', isDocument: false, canStackSingleLine: false, expansion: null, homeMode: undefined });
    try {
      const body = native.renderComposerBody({ layout: 'multiline', children: element('div', { children: 'Fixture content' }) });
      body.props.id = `${kind}-${variant}-body`;
      const root = native.renderComposerRoot({ layout: 'multiline', utilityBarVariant: utility, surfaceVariant: variant, children: body });
      root.props.id = `${kind}-${variant}`;
      return element('div', { ...(kind === 'thread' ? { 'data-thread-composer-backdrop': '' } : {}), children: root });
    } finally { native.harness.contexts.delete(context); }
  };
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 1000 }, colorScheme: mode });
      try {
        const markup = ['default', 'opaque', 'secondary'].flatMap(variant => [fixture('home', variant, 'home'),
          fixture('default', variant, 'independent'), fixture('default', variant, 'thread')]).map(quotaHtml).join('');
        await page.setContent(`<html class="forge-ink-mountain" data-theme="${mode}" data-forge-native-theme="${mode}" data-codex-os="win32" data-codex-window-type="electron"><style>${native.css}</style><style>${theme}</style><body>${markup}</body></html>`);
        for (const variant of ['default', 'opaque', 'secondary']) {
          assert.match(await page.locator(`#home-${variant}-body`).evaluate(element => getComputedStyle(element).backdropFilter), /^blur\(/,
            'The actual home body retains its theme glass filter');
          assert.match(await page.locator(`#independent-${variant}`).evaluate(element => getComputedStyle(element).backdropFilter), /^blur\(/,
            'The independent native root retains its theme glass filter');
          assert.equal(await page.locator(`#thread-${variant}`).evaluate(element => getComputedStyle(element).backdropFilter), 'none');
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
