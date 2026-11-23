import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import postcss from 'postcss';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { makeApplyExpression, makeStyleUpdateExpression, ACTIVE_PROBE_EXPRESSION, RESTORE_EXPRESSION,
  THEME_STATE_EXPRESSION, isNativeThemeState } from '../runtime/injection-plan-v13.mjs';
import { NATIVE_UI_SELECTORS } from '../runtime/native-ui-contract.mjs';
import { loadBrowserSurfaceNative, browserSurfaceFixture } from './native-browser-surface-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const source = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><path fill="#47789b" d="M0 0h32v24H0z"/></svg>');
const variables = `:root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("${source}");}`;
const expression = makeApplyExpression({ styleSheet: theme, variables });
const absoluteRightHeader = '[data-app-shell-titlebar] [data-app-shell-focus-area="right-panel"][class~="absolute"]';
const standaloneRightRow = '[data-app-shell-tab-row]:has([data-app-shell-tab-strip-controller="right"]):not([data-app-shell-titlebar] *)';
const headerMaterialRule = rule => rule.selector.includes(absoluteRightHeader) && rule.selector.includes(standaloneRightRow) &&
  rule.nodes.some(node => node.prop === 'background-color' && node.value === 'var(--color-surface, Canvas)');
const legacySheet = postcss.parse(theme);
let removedHeaderRules = 0;
legacySheet.walkRules(rule => {
  if (headerMaterialRule(rule)) {
    rule.remove(); removedHeaderRules++;
  }
});
assert.equal(removedHeaderRules, 1, 'The legacy material must remove exactly the newly introduced right-header mapping');
const legacyTheme = legacySheet.toString();
const rowOnlySheet = postcss.parse(theme);
let restoredRowOnlyRules = 0;
rowOnlySheet.walkRules(rule => {
  if (headerMaterialRule(rule)) {
    rule.selector = ':root.forge-ink-mountain #root [data-app-shell-tab-row]:has([data-app-shell-tab-strip-controller="right"])';
    restoredRowOnlyRules++;
  }
});
assert.equal(restoredRowOnlyRules, 1, 'The endcap negative control must preserve row paint while removing the complete slot owner');
const rowOnlyTheme = rowOnlySheet.toString();
const missingEndSheet = postcss.parse(theme), wholeEndGridSheet = postcss.parse(theme);
let missingEndRules = 0, wholeEndGridRules = 0;
missingEndSheet.walkRules(rule => {
  if (!rule.selector.includes('[data-app-shell-header-slot="end"]') || !rule.selector.includes('[data-app-shell-workspace-layout-toggle="right-panel"]')) return;
  assert.ok(headerMaterialRule(rule));
  rule.selector = `:root.forge-ink-mountain #root :is(${absoluteRightHeader}, ${standaloneRightRow})`;
  missingEndRules++;
});
wholeEndGridSheet.walkRules(rule => {
  if (!rule.selector.includes('[data-app-shell-header-slot="end"]')) return;
  assert.equal(rule.selector.split(' > .col-span-full.row-start-1.h-full.min-w-max').length, 2);
  rule.selector = rule.selector.replace(' > .col-span-full.row-start-1.h-full.min-w-max', ''); wholeEndGridRules++;
});
assert.equal(missingEndRules, 1, 'The live endcap control must remove only the registered end owner');
assert.equal(wholeEndGridRules, 1, 'The overpaint control must widen exactly the measured carrier to its entire grid');
const missingEndTheme = missingEndSheet.toString(), wholeEndGridTheme = wholeEndGridSheet.toString();
// Disable only the newly audited full-workspace predicate. This preserves the
// actual legacy runtime's continued wallpaper/paint in a full-view native tab.
const legacyExpression = [NATIVE_UI_SELECTORS.fullViewWorkspace, NATIVE_UI_SELECTORS.fullViewToggle]
  .reduce((current, selector) => current.replace(JSON.stringify(selector), JSON.stringify(':not(*)')),
    makeApplyExpression({ styleSheet: legacyTheme, variables }));
assert.notEqual(legacyExpression, expression, 'The legacy control must disable the full-workspace suspension predicate');
const visibilityObserver = 'const fullViewStructureChanged = records.some(';
const regularToggleScan = '    selectors.fullViewToggle,\n';
assert.equal(expression.split(visibilityObserver).length, 2, 'The visibility negative control must remove exactly one observer predicate');
assert.equal(expression.split(regularToggleScan).length, 2, 'The visibility negative control must remove exactly one regular structure mapping');
const legacyVisibilityExpression = expression
  .replace(visibilityObserver, 'const fullViewStructureChanged = false && records.some(')
  .replace(regularToggleScan, "    ':not(*)',\n");

test('current native browser separates new-tab paint, transparent toolbar and its navigation slot carrier', () => {
  const native = loadBrowserSurfaceNative();
  assert.match(native.newTabClass, /(?:^|\s)bg-surface(?:\s|$)/);
  assert.ok(!native.toolbarBaseClass.includes('bg-'));
  assert.match(native.frameClass, /(?:^|\s)bg-surface(?:\s|$)/);
  // Semantic JSX/import/export/owner assertions live in the helper, which
  // runs no app code and does not freeze compiled module IDs or chunk hashes.
});

const geometry = page => page.locator('#main,#paint,#native-tabstrip,#right-header-slot,#right-header-track,#native-header-divider,#right-pane-clip,#right-pane-surface,#right-pane-content,#right-header-portal,#right-header-actions,#left-header-slot,#left-header-action,#full-toggle,#split-toggle,#right-tabstrip,#left-tabstrip,#tabs-body,#browser-panel,#toolbar-carrier,#toolbar,#back,#address,#reload,#new-tab,#new-tab-content,#new-tab-input,#new-tab-action,#nested-card,#right-header-clip,#registered-end-slot,#registered-end-measure,#registered-end-padding,#registered-slot-content,#registered-entry,#registered-action-root,#registered-action-group,#guest').evaluateAll(elements => elements.map(element => {
  const s = getComputedStyle(element), r = element.getBoundingClientRect();
  return { id: element.id, rect: [r.x, r.y, r.width, r.height], radius: s.borderRadius, corner: s.cornerShape,
    border: s.borderWidth, padding: s.padding, margin: s.margin, position: s.position, overflow: s.overflow,
    font: s.font, opacity: s.opacity, disabled: element.disabled, tabIndex: element.tabIndex };
}));
const nativePaint = page => page.locator('html,body,#root,#layout,#main,#native-tabstrip,#right-header-slot,#right-header-track,#native-header-divider,#right-pane-clip,#right-pane-surface,#right-pane-content,#right-header-portal,#right-header-actions,#left-header-slot,#left-header-action,#full-toggle,#split-toggle,#right-tabstrip,#left-tabstrip,#workspace-content,#tabs-body,#toolbar-carrier,#toolbar,#back,#address,#reload,#new-tab,#new-tab-content,#new-tab-input,#new-tab-action,#nested-card,#right-header-clip,#registered-end-slot,#registered-end-measure,#registered-end-padding,#registered-slot-content,#registered-entry,#registered-action-root,#registered-action-group,#guest').evaluateAll(elements => elements.map(element => {
  const s = getComputedStyle(element), before = getComputedStyle(element, '::before'); return { id: element.id || element.tagName, background: s.backgroundColor,
    image: s.backgroundImage, shadow: s.boxShadow, blur: s.backdropFilter, color: s.color, opacity: s.opacity,
    borderColor: s.borderColor, clip: s.clipPath, before: { display: before.display, background: before.backgroundColor, image: before.backgroundImage, zIndex: before.zIndex } };
}));
// Each immutable screenshot is decoded once, including the continuous endcap row.
const screenshotPixels = new WeakMap();
const pixel = (buffer, x, y) => {
  let png = screenshotPixels.get(buffer);
  if (!png) { png = PNG.sync.read(buffer); screenshotPixels.set(buffer, png); }
  const index = (Math.floor(y) * png.width + Math.floor(x)) * 4;
  return [...png.data.subarray(index, index + 3)];
};
const active = page => page.waitForFunction(() => {
  const overlay = document.getElementById('wukong-codex-theme-background'), image = overlay?.querySelector('[data-forge-active="true"] img');
  return overlay?.parentElement === document.body && document.documentElement.dataset.forgeBackgroundPlacement === 'viewport' && !overlay.hidden && document.documentElement.dataset.forgeBackgroundReady === 'true' && image?.naturalWidth > 0;
});
const suspended = page => page.waitForFunction(() => {
  const style = document.getElementById('wukong-codex-theme-style'), overlay = document.getElementById('wukong-codex-theme-background');
  return style?.media === 'not all' && overlay?.hidden;
});

test('full workspace restores native paint while split reuses the same decoded theme and preserves controls', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) for (const width of [900, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 760 }, colorScheme: mode });
      try {
        await page.setContent(browserSurfaceFixture(native, { mode, layout: 'split' }));
        const split = await geometry(page), splitPaint = await nativePaint(page);
        await page.evaluate(() => fixtureLayout('full'));
        assert.equal(await page.locator('#new-tab').evaluate(element =>
          Math.round(element.getBoundingClientRect().width) === Math.round(element.parentElement.getBoundingClientRect().width)),
        true, 'The native block canvas must fill its content slot before theme comparisons');
        const full = await geometry(page), fullPaint = await nativePaint(page), nativeFull = await page.screenshot();
        await page.evaluate(() => fixtureLayout('split'));
        await page.evaluate(expression);
        await active(page);
        assert.deepEqual(await geometry(page), split, mode+'/'+width+': split geometry');
        const themedSplit = await nativePaint(page);
        assert.notDeepEqual(themedSplit, splitPaint, 'The ordinary split workspace remains themed');
        for (const id of ['new-tab', 'toolbar-carrier']) assert.deepEqual(themedSplit.find(item => item.id === id), splitPaint.find(item => item.id === id), 'Split browser '+id+' keeps its existing native material');
        await page.evaluate(() => {
          window.savedOverlay = document.getElementById('wukong-codex-theme-background');
          window.savedImage = savedOverlay.querySelector('[data-forge-active="true"] img');
          window.decodeCalls = 0;
          const decode = HTMLImageElement.prototype.decode;
          HTMLImageElement.prototype.decode = function (...args) { decodeCalls++; return decode.apply(this, args); };
        });
        await page.evaluate(() => fixtureLayout('full'));
        await suspended(page);
        assert.deepEqual(await geometry(page), full, mode+'/'+width+': full native geometry');
        assert.deepEqual(await nativePaint(page), fullPaint, mode+'/'+width+': every sampled native paint/ink/filter is restored');
        const actualFull = await page.screenshot();
        for (const [x,y] of [[16,80],[100,80],[16,300],[100,300]]) assert.deepEqual(pixel(actualFull,x,y),pixel(nativeFull,x,y),'Full view has native paint across the former rail edge and tab strip');
        assert.deepEqual(pixel(actualFull,width-20,740),[15,180,117],'The separate guest document keeps its native paint');
        assert.equal(await page.evaluate(ACTIVE_PROBE_EXPRESSION),true,'Suspension remains a healthy installed runtime, preventing polling reinjection');
        await page.locator('#address').fill('example.test');
        await page.locator('#new-tab-input').fill('Fixture query');
        await page.locator('#reload').click();
        await page.locator('#new-tab-action').click();
        assert.equal(await page.evaluate(() => fixtureClicks),2);
        assert.equal(await page.locator('#back').isDisabled(),true);
        await page.evaluate(() => fixtureLayout('split'));
        await active(page);
        assert.deepEqual(await geometry(page),split,mode+'/'+width+': return to split');
        assert.deepEqual(await nativePaint(page),themedSplit,mode+'/'+width+': previous split material is restored');
        assert.deepEqual(await page.evaluate(() => ({overlay:document.getElementById('wukong-codex-theme-background')===savedOverlay,
          image:savedOverlay.querySelector('[data-forge-active="true"] img')===savedImage,decoded:savedImage.dataset.forgeDecoded,
          decodeCalls,count:document.querySelectorAll('#wukong-codex-theme-background').length,media:document.getElementById('wukong-codex-theme-style').media})),
        {overlay:true,image:true,decoded:'true',decodeCalls:0,count:1,media:''});

        const negative=await browser.newPage({viewport:{width,height:760},colorScheme:mode});
        try {
          await negative.setContent(browserSurfaceFixture(native,{mode,layout:'split'}));
          await negative.evaluate(legacyExpression);
          await active(negative);
          await negative.evaluate(()=>fixtureLayout('full'));
          // The old predicate cannot suspend. Wait two rendered frames so the
          // negative control is not merely catching an intermediate mutation.
          await negative.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
          assert.equal(await negative.locator('#wukong-codex-theme-background').evaluate(e=>e.hidden),false);
          const visible=await negative.screenshot();
          assert.notDeepEqual(pixel(visible,100,80),pixel(nativeFull,100,80),'Legacy runtime visibly leaves wallpaper in the full-view tab strip');
          assert.deepEqual(await geometry(negative),full,'Legacy control still has the same native geometry');
        } finally {await negative.close();}
      } finally {await page.close();}
    }
  } finally {await browser.close();}
});

test('split, inactive and hidden full-workspace branches do not suspend an active theme', async () => {
  const native=loadBrowserSurfaceNative(),browser=await chromium.launch({headless:true});
  try {
    for(const scenario of ['split','inactive','opacity-zero','inert','hidden-toggle','aria-hidden-toggle','false-toggle']) {
      const page=await browser.newPage({viewport:{width:1000,height:760}});
      try {
        await page.setContent(browserSurfaceFixture(native,{layout:scenario==='split'?'split':'full'}));
        await page.evaluate(scenario=>{
          if(scenario==='inactive')document.getElementById('active-page').dataset.appShellActivePage='false';
          if(scenario==='opacity-zero')document.getElementById('main').style.opacity='0';
          if(scenario==='inert')document.getElementById('main').inert=true;
          if(scenario==='hidden-toggle'||scenario==='aria-hidden-toggle') {
            document.getElementById('viewport').dataset.appShellWorkspaceLayout='split';
            if(scenario==='hidden-toggle')document.getElementById('full-toggle').hidden=true;
            else document.getElementById('full-toggle').setAttribute('aria-hidden','true');
          }
          if(scenario==='false-toggle')document.getElementById('full-toggle').setAttribute('aria-pressed','false');
        },scenario);
        await page.evaluate(expression);
        await active(page);
        assert.equal(await page.locator('#wukong-codex-theme-style').evaluate(e=>e.media),'',scenario+' must not disable theme CSS');
      } finally {await page.close();}
    }
  } finally {await browser.close();}
});

test('native full view retains gallery selection across material updates and fully restores without owned remnants', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  const secondSource = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><path fill="#9b7847" d="M0 0h32v24H0z"/></svg>');
  const galleryVariables = `:root.forge-ink-mountain{--forge-scene-count:2;--forge-battle-scenes:0 1;--forge-scenery-scenes:0 1;--forge-bg-0:url("${source}");--forge-bg-1:url("${secondSource}");}`;
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, colorScheme: 'dark' });
    try {
      await page.setContent(browserSurfaceFixture(native, { layout: 'full' }));
      const fullPaint = await nativePaint(page), fullGeometry = await geometry(page);
      await page.evaluate(() => fixtureLayout('split'));
      await page.evaluate(makeApplyExpression({ styleSheet: theme, variables: galleryVariables }));
      await active(page);
      await page.evaluate(() => fixtureLayout('full'));
      await suspended(page);
      await page.evaluate(makeStyleUpdateExpression({
        styleSheet: `${theme}\n:root.forge-ink-mountain{--forge-navigation-fill:rgba(90,80,70,.64);}`,
        variables: galleryVariables
      }));
      assert.deepEqual(await nativePaint(page), fullPaint, 'A material hot update must not re-enable theme paint in native full view');
      assert.deepEqual(await geometry(page), fullGeometry);
      assert.equal(await page.evaluate(() => {
        const runtime = window.__wukongCodexThemeRuntimeV13;
        return runtime.nextBackground(runtime.currentMode);
      }), true);
      await page.waitForFunction(() => {
        const runtime = window.__wukongCodexThemeRuntimeV13;
        return runtime.currentScene === 1 && !runtime.transitionInFlight && runtime.preloadRequests.size === 0;
      });
      assert.equal(await page.locator('[data-forge-active="true"] [data-forge-background-image]').getAttribute('src'), secondSource,
        'The two-scene gallery remains functional while the paint sheet is disabled');
      assert.deepEqual(await nativePaint(page), fullPaint);
      await page.evaluate(() => {
        window.galleryOverlay = document.getElementById('wukong-codex-theme-background');
        window.galleryImage = galleryOverlay.querySelector('[data-forge-active="true"] img');
        window.resumeDecodeCalls = 0;
        const decode = HTMLImageElement.prototype.decode;
        HTMLImageElement.prototype.decode = function (...args) { resumeDecodeCalls++; return decode.apply(this, args); };
        fixtureLayout('split');
      });
      await active(page);
      assert.deepEqual(await page.evaluate(() => ({ sameOverlay: document.getElementById('wukong-codex-theme-background') === galleryOverlay,
        sameImage: galleryOverlay.querySelector('[data-forge-active="true"] img') === galleryImage,
        selectedScene: window.__wukongCodexThemeRuntimeV13.currentScene, resumeDecodeCalls })),
      { sameOverlay: true, sameImage: true, selectedScene: 1, resumeDecodeCalls: 0 });
      await page.evaluate(() => fixtureLayout('full'));
      await suspended(page);
      await page.evaluate(RESTORE_EXPRESSION);
      assert.equal(isNativeThemeState(await page.evaluate(THEME_STATE_EXPRESSION)), true);
      assert.equal(await page.locator('#wukong-codex-theme-style,#wukong-codex-theme-scene-variables,#wukong-codex-theme-background,[data-forge-owned],[data-forge-mark]').count(), 0,
        'Restoring from native full view removes all theme styles, layers and marks');
      assert.deepEqual(await nativePaint(page), fullPaint);
      assert.deepEqual(await geometry(page), fullGeometry);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});

test('right-panel toggle overrides retained layout markers and the right tab header keeps native paint through portals', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 760 }, colorScheme: mode });
      try {
        await page.setContent(browserSurfaceFixture(native, { mode, layout: 'split' }));
        const before = await geometry(page), leftPaint = (await nativePaint(page)).find(item => item.id === 'left-tabstrip');
        const nativeColor = await page.locator('#toolbar-carrier').evaluate(element => getComputedStyle(element).backgroundColor);
        const color = await page.evaluate(value => {
          const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
          canvas.width = canvas.height = 1; context.fillStyle = value; context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        }, nativeColor);
        await page.evaluate(expression);
        await active(page);
        assert.deepEqual(await geometry(page), before, 'Giving the right header native paint must not change any native/control geometry');
        let paints = await nativePaint(page);
        assert.equal(paints.find(item => item.id === 'right-header-slot').background, nativeColor);
        assert.equal(paints.find(item => item.id === 'right-tabstrip').background, leftPaint.background, 'The portalled row keeps its native transparent paint over the outer header');
        assert.deepEqual(paints.find(item => item.id === 'left-tabstrip'), leftPaint, 'The left chat header remains outside the right-controller mapping');
        const row = await page.locator('#right-tabstrip').boundingBox();
        assert.deepEqual(pixel(await page.screenshot(), row.x + row.width - 6, row.y + row.height / 2), color,
          'The right header actually paints the native surface instead of showing wallpaper');
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: legacyTheme, variables }));
        assert.equal((await nativePaint(page)).find(item => item.id === 'right-tabstrip').background, leftPaint.background,
          'Old CSS leaves the actual right tab-row carrier transparent');
        assert.notDeepEqual(pixel(await page.screenshot(), row.x + row.width - 6, row.y + row.height / 2), color,
          'The old-header control must visibly show wallpaper instead of the native surface');
        assert.deepEqual(await geometry(page), before);
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: theme, variables }));

        for (const marker of ['missing', 'split']) {
          await page.evaluate(marker => {
            fixtureLayout('full');
            if (marker === 'missing') document.getElementById('viewport').removeAttribute('data-app-shell-workspace-layout');
            else document.getElementById('viewport').dataset.appShellWorkspaceLayout = 'split';
            if (!document.getElementById('main-view-toggle')) document.getElementById('native-tabstrip').insertAdjacentHTML('beforeend',
              '<button id="main-view-toggle" data-app-shell-workspace-layout-toggle="main" aria-pressed="true">Main view fixture</button>');
          }, marker);
          await suspended(page);
          assert.equal(await page.evaluate(() => document.documentElement.dataset.forgePresentation), 'native-full-view',
            `Pressed right-panel toggle is authoritative with ${marker} layout and a concurrently pressed main toggle`);
          await page.evaluate(() => {
            fixtureLayout('split');
            document.getElementById('main-view-toggle').remove();
          });
          await active(page);
        }

        // Header portal forwarding does not change the controller marker. The
        // appearance rule must therefore survive leaving the Tabs.Root tree.
        await page.evaluate(() => {
          const slot = document.createElement('div'); slot.id = 'native-header-portal';
          slot.style.cssText = 'position:fixed;top:0;left:0;width:220px;height:44px';
          document.getElementById('root').append(slot);
          slot.append(document.getElementById('right-tabstrip'));
        });
        paints = await nativePaint(page);
        assert.equal(paints.find(item => item.id === 'right-tabstrip').background, nativeColor);
        assert.deepEqual(paints.find(item => item.id === 'left-tabstrip'), leftPaint);

        // When an older native branch has no full-view command, its explicit
        // active/unified/titlebar/full workspace remains a proven fallback.
        await page.evaluate(() => { document.getElementById('full-toggle').remove(); fixtureLayout('full'); });
        await suspended(page);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('settled full-view command visibility and remounts resume theme without polling', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  const settle = async page => {
    await page.waitForFunction(() => {
      const runtime = window.__wukongCodexThemeRuntimeV13;
      return runtime && !runtime.timer && !runtime.routeTimers.size && !runtime.transitionInFlight;
    }, null, { timeout: 3000 });
    const count = await page.evaluate(() => window.__wukongCodexThemeRuntimeV13.refreshCount);
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => window.__wukongCodexThemeRuntimeV13.refreshCount), count,
      'A settled native full view must not keep refreshing its hidden wallpaper');
  };
  const prepare = async (page, apply) => {
    await page.setContent(browserSurfaceFixture(native, { layout: 'split' }));
    await page.evaluate(apply);
    await active(page);
    // Both bounded startup probes must expire before exercising transitions.
    await page.waitForTimeout(650);
    await settle(page);
    await page.evaluate(() => {
      window.transitionOverlay = document.getElementById('wukong-codex-theme-background');
      window.transitionImage = transitionOverlay.querySelector('[data-forge-active="true"] img');
      window.transitionToggle = document.getElementById('full-toggle');
      window.transitionAncestor = transitionToggle.parentElement;
      window.transitionAncestorParent = transitionAncestor.parentElement;
      window.transitionAncestorNext = transitionAncestor.nextSibling;
      transitionToggle.setAttribute('aria-pressed', 'true');
    });
    await suspended(page);
    await settle(page);
    assert.equal(await page.locator('#viewport').getAttribute('data-app-shell-workspace-layout'), 'split',
      'This native full-view command must exercise the underlying split-state branch');
  };
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    try {
      await prepare(page, expression);
      for (const target of ['toggle', 'ancestor']) for (const attribute of ['hidden', 'aria-hidden', 'inert']) {
        await page.evaluate(({ target, attribute }) => {
          const node = target === 'toggle' ? transitionToggle : transitionAncestor;
          node.setAttribute(attribute, attribute === 'aria-hidden' ? 'true' : '');
        }, { target, attribute });
        await active(page);
        await settle(page);
        await page.evaluate(({ target, attribute }) => {
          (target === 'toggle' ? transitionToggle : transitionAncestor).removeAttribute(attribute);
        }, { target, attribute });
        await suspended(page);
        await settle(page);
      }
      for (const target of ['toggle', 'ancestor']) {
        await page.evaluate(target => (target === 'toggle' ? transitionToggle : transitionAncestor).remove(), target);
        await active(page);
        await settle(page);
        await page.evaluate(target => {
          if (target === 'toggle') transitionAncestor.append(transitionToggle);
          else transitionAncestorParent.insertBefore(transitionAncestor, transitionAncestorNext);
        }, target);
        await suspended(page);
        await settle(page);
      }
      assert.deepEqual(await page.evaluate(() => ({
        overlay: document.getElementById('wukong-codex-theme-background') === transitionOverlay,
        image: transitionOverlay.querySelector('[data-forge-active="true"] img') === transitionImage,
        count: document.querySelectorAll('#wukong-codex-theme-background').length,
        decoded: transitionImage.dataset.forgeDecoded
      })), { overlay: true, image: true, count: 1, decoded: 'true' }, 'Visibility changes preserve the decoded wallpaper instance');
    } finally { await page.close(); }

    // Keep full-view detection and pressed-state handling in the negative
    // control. Remove only visibility/subtree observation and its normal scan.
    const negative = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    try {
      await prepare(negative, legacyVisibilityExpression);
      const count = await negative.evaluate(() => window.__wukongCodexThemeRuntimeV13.refreshCount);
      await negative.evaluate(() => transitionToggle.setAttribute('aria-hidden', 'true'));
      await negative.waitForTimeout(650);
      assert.equal(await negative.locator('#wukong-codex-theme-style').evaluate(element => element.media), 'not all',
        'The old observer must reproduce the stuck native presentation after the only full-view command is hidden');
      assert.equal(await negative.evaluate(() => window.__wukongCodexThemeRuntimeV13.refreshCount), count,
        'The old observer failure must not be masked by startup probes or a hidden-overlay refresh loop');
    } finally { await negative.close(); }
  } finally { await browser.close(); }
});

test('complete right titlebar paint covers the portal gap and both end actions without touching the left header', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  const headerPoints = page => page.evaluate(() => {
    const rect = id => document.getElementById(id).getBoundingClientRect();
    const owner = rect('right-header-slot'), row = rect('right-tabstrip'), actions = rect('right-header-actions');
    const full = rect('full-toggle'), split = rect('split-toggle'), y = owner.y + owner.height / 2;
    return { rowTail: [row.right - 4, y], gap: [(row.right + actions.left) / 2, y],
      fullSurround: [full.left - 2, full.y + full.height / 2], betweenActions: [(full.right + split.left) / 2, y],
      splitSurround: [split.right + 2, split.y + split.height / 2], endcap: [owner.right - 2, y] };
  });
  const leftPaint = async page => (await nativePaint(page)).filter(item => ['left-header-slot', 'left-tabstrip', 'left-header-action'].includes(item.id));
  try {
    for (const mode of ['dark', 'light']) for (const width of [900, 1280]) for (const layout of ['split', 'full']) {
      const page = await browser.newPage({ viewport: { width, height: 760 }, colorScheme: mode });
      try {
        await page.setContent(browserSurfaceFixture(native, { mode, layout }));
        const before = await geometry(page), left = await leftPaint(page), baseline = await page.screenshot();
        const surface = await page.locator('#toolbar-carrier').evaluate(element => getComputedStyle(element).backgroundColor);
        const surfaceRgb = await page.evaluate(value => {
          const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
          canvas.width = canvas.height = 1; context.fillStyle = value; context.fillRect(0, 0, 1, 1);
          return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        }, surface);
        await page.evaluate(expression);
        if (layout === 'full') await suspended(page); else await active(page);
        let expectedClicks = 0, expectedLeftClicks = 0;
        for (const remounted of [false, true]) {
          if (remounted) await page.evaluate(() => {
            // G.l mounts the same shared content container into its current
            // host. Recreate only that host, keeping the real end-action
            // sibling outside the portalled tab row throughout the move.
            const oldHost = document.getElementById('right-header-portal'), host = oldHost.cloneNode(false);
            oldHost.before(host); host.append(document.getElementById('shared-titlebar-content')); oldHost.remove();
          });
          const label = `${mode}/${width}/${layout}/portal-remount=${remounted}`;
          assert.deepEqual(await geometry(page), before, `${label}: all owner, control and page geometry`);
          assert.deepEqual(await leftPaint(page), left, `${label}: independent left slot/action paint`);
          const points = await headerPoints(page), painted = await page.screenshot();
          for (const [name, point] of Object.entries(points)) {
            const expected = layout === 'full' ? pixel(baseline, ...point) : surfaceRgb;
            assert.deepEqual(pixel(painted, ...point), expected, `${label}: native continuous ${name}`);
          }
          if (layout === 'split') {
            await page.evaluate(makeStyleUpdateExpression({ styleSheet: rowOnlyTheme, variables }));
            const oldPaint = await page.screenshot();
            assert.deepEqual(pixel(oldPaint, ...points.rowTail), surfaceRgb, `${label}: old row-only paint must remain effective`);
            for (const name of ['gap', 'fullSurround', 'splitSurround', 'endcap']) {
              assert.notDeepEqual(pixel(oldPaint, ...points[name]), surfaceRgb, `${label}: old row-only paint must expose wallpaper at ${name}`);
            }
            assert.deepEqual(await geometry(page), before);
            assert.deepEqual(await leftPaint(page), left);
            await page.evaluate(makeStyleUpdateExpression({ styleSheet: theme, variables }));
          }
          if (layout === 'split') {
            await page.locator('#full-toggle').click(); await suspended(page);
            await page.locator('#split-toggle').click(); await active(page);
            await page.locator('#left-header-action').click();
            expectedLeftClicks++;
          } else {
            await page.locator('#split-toggle').click(); await active(page);
            await page.locator('#full-toggle').click(); await suspended(page);
          }
          expectedClicks += 2;
          assert.deepEqual(await page.evaluate(() => ({ right: fixtureClicks, left: leftClicks })),
            { right: expectedClicks, left: expectedLeftClicks }, `${label}: end actions and independent chat action remain clickable`);
          assert.deepEqual(await geometry(page), before);
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('registered end-slot paints its complete 81px carrier beyond the content clip while preserving visible tab text', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  const contrastPixels = (buffer, box, background) => {
    const png = PNG.sync.read(buffer); let count = 0;
    for (let y = Math.ceil(box.y + 2); y < Math.floor(box.y + box.height - 2); y++) {
      for (let x = Math.ceil(box.x + 2); x < Math.floor(box.x + box.width - 2); x++) {
        const at = (y * png.width + x) * 4;
        if (background.some((value, channel) => Math.abs(png.data[at + channel] - value) > 20)) count++;
      }
    }
    return count;
  };
  try {
    for (const mode of ['dark', 'light']) for (const width of [900, 1280]) for (const layout of ['split', 'full']) {
      const page = await browser.newPage({ viewport: { width, height: 760 }, colorScheme: mode });
      try {
        await page.setContent(browserSurfaceFixture(native, { mode, layout, registeredEndSlot: true }));
        const before = await geometry(page), left = (await nativePaint(page)).filter(item => item.id.startsWith('left-'));
        const baseline = await page.screenshot(), carrier = await page.locator('#registered-end-measure').boundingBox();
        const frameEdge = await page.locator('#paint').evaluate(element => ({
          right: element.getBoundingClientRect().right,
          width: Math.ceil(parseFloat(getComputedStyle(element).getPropertyValue('--border-width-hairline'))),
          shadow: getComputedStyle(element, '::after').boxShadow
        }));
        assert.ok(frameEdge.width > 0 && frameEdge.shadow !== 'none', 'Native backing keeps its source-owned hairline above the end carrier');
        const grid = await page.locator('#registered-end-slot').boundingBox();
        assert.equal(carrier.width, 81, 'Live capture input: full-height padding carrier is 81 CSS px, including both controls and trailing padding');
        assert.equal(carrier.height, 52);
        assert.ok(grid.width > carrier.width * 2, 'The native end grid spans the pane and must not become a solid overlay');
        assert.equal(await page.locator('#right-header-clip').evaluate(element => getComputedStyle(element).clipPath), 'inset(0px 81px 0px 6px)');
        const surface = await page.locator('#toolbar-carrier').evaluate(element => getComputedStyle(element).backgroundColor);
        const rgb = await page.evaluate(value => {
          const canvas = document.createElement('canvas'), context = canvas.getContext('2d'); canvas.width = canvas.height = 1;
          context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        }, surface);
        await page.evaluate(expression);
        if (layout === 'full') await suspended(page); else await active(page);
        for (const remounted of [false, true]) {
          if (remounted) await page.evaluate(() => {
            const old = document.getElementById('right-header-portal'), next = old.cloneNode(false);
            old.before(next); next.append(document.getElementById('shared-titlebar-content')); old.remove();
          });
          const label = `${mode}/${width}/${layout}/registered-portal=${remounted}`;
          assert.deepEqual(await geometry(page), before, `${label}: source-owned boxes and controls`);
          assert.deepEqual((await nativePaint(page)).filter(item => item.id.startsWith('left-')), left, `${label}: left chat header remains independent`);
          const actual = await page.screenshot(), y = carrier.y + carrier.height - 4;
          // This row lies below the 28px buttons. Sampling all 81 columns
          // protects the entire 52px carrier, including its native pe-2 edge.
          // The new backing's ::after retains its native inset hairline over
          // the final physical edge, independently of the carrier material.
          for (let x = carrier.x; x < carrier.x + carrier.width; x++) {
            const nativeFrameEdge = x >= frameEdge.right - frameEdge.width;
            assert.deepEqual(pixel(actual, x, y), layout === 'full' || nativeFrameEdge ? pixel(baseline, x, y) : rgb, `${label}: continuous native endcap column ${x - carrier.x}`);
          }
          const tab = await page.locator('#right-tabstrip button[role="tab"]').boundingBox();
          assert.ok(contrastPixels(actual, tab, rgb) > 5, `${label}: native tab text remains visibly painted below the end-grid layer`);
          if (layout === 'split') {
            await page.evaluate(makeStyleUpdateExpression({ styleSheet: missingEndTheme, variables }));
            const missing = await page.screenshot();
            for (let x = carrier.x; x < carrier.x + carrier.width; x++) {
              assert.notDeepEqual(pixel(missing, x, y), rgb, `${label}: the previous content-slot rule must leave this exact 81px strip showing wallpaper`);
            }
            assert.equal(await page.locator('#right-header-slot').evaluate(element => getComputedStyle(element).backgroundColor), surface,
              'The negative control preserves the previous successful content-slot paint; clipping alone reveals the missing owner');
            await page.evaluate(makeStyleUpdateExpression({ styleSheet: wholeEndGridTheme, variables }));
            assert.equal(contrastPixels(await page.screenshot(), tab, rgb), 0,
              `${label}: painting the pane-wide end grid must reproduce covered tab text`);
            assert.deepEqual(await geometry(page), before);
            await page.evaluate(makeStyleUpdateExpression({ styleSheet: theme, variables }));
          }
        }
        if (layout === 'split') {
          await page.locator('#full-toggle').click(); await suspended(page);
          await page.locator('#split-toggle').click(); await active(page);
        } else {
          await page.locator('#split-toggle').click(); await active(page);
          await page.locator('#full-toggle').click(); await suspended(page);
        }
        assert.equal(await page.evaluate(() => fixtureClicks), 2, 'Registered main-focus actions remain clickable across the presentation switch');
        assert.deepEqual(await geometry(page), before);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});


test('non-measured native end slots paint the live carrier while preserving their invisible sizing sibling', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 760 }, colorScheme: mode });
      try {
        await page.setContent(browserSurfaceFixture(native, { mode, registeredEndSlot: true, measureLiveContent: false }));
        const before = await geometry(page), left = (await nativePaint(page)).filter(item => item.id.startsWith('left-'));
        const read = () => page.locator('#registered-end-slot,#registered-end-measure,#registered-end-sizing').evaluateAll(elements => Object.fromEntries(elements.map(element => {
          const style = getComputedStyle(element);
          return [element.id, { background: style.backgroundColor, visibility: style.visibility, pointer: style.pointerEvents }];
        })));
        const original = await read(), surface = await page.locator('#toolbar-carrier').evaluate(element => getComputedStyle(element).backgroundColor);
        assert.equal(original['registered-end-sizing'].visibility, 'hidden');
        await page.evaluate(expression); await active(page);
        const painted = await read();
        assert.equal(painted['registered-end-slot'].background, 'rgba(0, 0, 0, 0)');
        assert.equal(painted['registered-end-measure'].background, surface);
        assert.deepEqual(painted['registered-end-sizing'], original['registered-end-sizing']);
        assert.deepEqual(await geometry(page), before);
        assert.deepEqual((await nativePaint(page)).filter(item => item.id.startsWith('left-')), left);
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: missingEndTheme, variables }));
        assert.equal((await read())['registered-end-measure'].background, original['registered-end-measure'].background, 'Removing current end-slot paint must leave the native live carrier transparent');
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: theme, variables }));
        await page.locator('#full-toggle').click(); await suspended(page);
        await page.locator('#split-toggle').click(); await active(page);
        assert.deepEqual(await geometry(page), before);
        assert.equal(await page.evaluate(() => fixtureClicks), 2);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('native inset titlebars align right-pane paint without moving launcher content or controls', async () => {
  const native = loadBrowserSurfaceNative(), sampled = postcss.parse(theme); let removed = 0;
  sampled.walkRules(rule => {
    if (rule.selector.includes('[data-app-shell-titlebar][class~="me-1"]') && !rule.selector.includes('[data-app-shell-titlebar-divider=') &&
        rule.nodes.some(node => ['background-image', 'background-position'].includes(node.prop))) {
      rule.remove(); removed++;
    }
  });
  assert.equal(removed, 4, 'The misaligned control removes only the logical header-fill offset and clipped end-strip rules');
  const unshifted = postcss.parse(theme); let dividerRules = 0;
  unshifted.walkRules(rule => {
    if (rule.selector.includes('[data-app-shell-titlebar-divider="pane"]') && rule.nodes.some(node => node.prop === 'translate')) {
      rule.remove(); dividerRules++;
    }
  });
  assert.equal(dividerRules, 2, 'The divider control removes only the two directional empty-pane-divider offsets');
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) for (const direction of ['ltr', 'rtl']) for (const launcher of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, colorScheme: mode });
      try {
        await page.setContent(browserSurfaceFixture(native, { mode, direction, launcher, nativeHeaderInset: true, headerHeight: 46, registeredEndSlot: true }));
        assert.equal(await page.locator('#toolbar-carrier').count(), launcher ? 0 : 1, 'Launcher search omits the native navigation row while the browser branch retains it');
        const before = await geometry(page), left = (await nativePaint(page)).filter(node => node.id.startsWith('left-'));
        const dividerMaterial = () => page.locator('#native-header-divider').evaluate(node => {
          const s = getComputedStyle(node), pseudo = type => { const p = getComputedStyle(node, type); return [p.content, p.backgroundColor, p.backgroundImage, p.boxShadow, p.pointerEvents]; };
          return { paint: [s.backgroundColor, s.backgroundImage, s.boxShadow, s.borderColor, s.color], width: s.width, height: s.height,
            outline: s.outline, pointer: s.pointerEvents, before: pseudo('::before'), after: pseudo('::after') };
        });
        const nativeDivider = await dividerMaterial();
        const points = await page.evaluate(() => {
          const header = document.getElementById('right-header-slot').getBoundingClientRect();
          const pane = document.getElementById('right-panel').getBoundingClientRect(), main = document.getElementById('main').getBoundingClientRect();
          const body = document.getElementById('right-pane-surface'), border = getComputedStyle(body), bodyBox = body.getBoundingClientRect();
          const titlebar = document.getElementById('native-tabstrip'), inset = parseFloat(getComputedStyle(titlebar).marginInlineEnd);
          const rtl = document.documentElement.dir === 'rtl', y = header.bottom - 6;
          return { inset, header: [header.x, header.y, header.width, header.height], pane: [pane.x, pane.y, pane.width, pane.height],
            start: [rtl ? header.right - inset / 2 : header.left + inset / 2, y],
            aligned: [rtl ? pane.right - inset - 1 : pane.left + inset + 1, y],
            end: [rtl ? main.left + inset / 2 : main.right - inset / 2, y],
            borderWidth: parseFloat(rtl ? border.borderRightWidth : border.borderLeftWidth),
            lineX: rtl ? bodyBox.right - parseFloat(border.borderRightWidth) / 2 : bodyBox.left + parseFloat(border.borderLeftWidth) / 2,
            lineY: y, bodyY: bodyBox.top + 32, paneEdge: rtl ? bodyBox.right : bodyBox.left };
        });
        assert.equal(points.inset, 4, 'Native me-1 input matches the measured 4px titlebar end gutter');
        assert.equal(points.header[2], points.pane[2], 'The titlebar keeps the pane width while retaining its native shifted origin');
        assert.equal(direction === 'ltr' ? points.pane[0] - points.header[0] : points.header[0] - points.pane[0], points.inset);
        assert.equal(points.header[1] + points.header[3], points.pane[1], 'The pane begins immediately below the native 46px header');
        assert.ok(points.borderWidth > 0, 'The real pane surface retains its native border edge');
        const expectedGeometry = structuredClone(before), dividerGeometry = expectedGeometry.find(node => node.id === 'native-header-divider');
        assert.ok(dividerGeometry);
        dividerGeometry.rect[0] += direction === 'rtl' ? -points.inset : points.inset;
        const surface = await page.locator('#new-tab').evaluate(node => getComputedStyle(node).backgroundColor);
        const rgb = await page.evaluate(value => {
          const canvas = document.createElement('canvas'), context = canvas.getContext('2d'); canvas.width = canvas.height = 1;
          context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3);
        }, surface);
        await page.evaluate(() => fixtureLayout('full'));
        const fullGeometry = await geometry(page), fullPaint = await nativePaint(page);
        await page.evaluate(() => fixtureLayout('split'));
        await page.evaluate(expression); await active(page);
        assert.deepEqual(await geometry(page), expectedGeometry, 'Only the empty pane decoration shifts; every native input, border carrier and control stays fixed');
        assert.deepEqual(await dividerMaterial(), nativeDivider, 'The native divider retains its colour, width, outline, pseudos and pointer boundary');
        const verifyPixels = async () => {
          const image = await page.screenshot();
          assert.notDeepEqual(pixel(image, ...points.start), rgb, 'The logical start gutter keeps the adjacent chat material');
          assert.deepEqual(pixel(image, ...points.aligned), rgb, 'The header fill begins on the actual pane boundary');
          assert.deepEqual(pixel(image, ...points.end), rgb, 'The clipped logical end gutter continues the native pane fill');
          const divider = await page.locator('#native-header-divider').boundingBox();
          assert.equal(direction === 'rtl' ? divider.x + divider.width : divider.x, points.paneEdge, 'The actual header line meets the body border at the same physical edge');
          assert.notDeepEqual(pixel(image, points.lineX, points.lineY), rgb, 'A real header divider stroke is visible on the aligned body edge');
          assert.notDeepEqual(pixel(image, points.lineX, points.bodyY), pixel(image, points.lineX + (direction === 'rtl' ? 2 : -2), points.bodyY), 'The native body border remains visibly distinct from the adjacent chat material');
        };
        await verifyPixels();
        if (launcher && direction === 'ltr' && process.env.WUKONG_TAB_ALIGNMENT_PREVIEW_DIRECTORY) {
          const box = await page.locator('#main').boundingBox();
          await page.evaluate(box => {
            const caption = document.createElement('div'); caption.id = 'fixture-preview-caption';
            caption.textContent = '原生组件夹具 · 新标签页顶部与页面边界对齐';
            caption.style.cssText = `position:fixed;left:${box.x + 12}px;top:${box.y + 58}px;z-index:100;padding:4px 8px;font:12px/1.5 system-ui;color:CanvasText;background:Canvas;border-radius:4px`;
            document.body.append(caption);
          }, box);
          fs.mkdirSync(process.env.WUKONG_TAB_ALIGNMENT_PREVIEW_DIRECTORY, { recursive: true });
          await page.screenshot({ path: path.join(process.env.WUKONG_TAB_ALIGNMENT_PREVIEW_DIRECTORY,
            `${mode}-native-pane-alignment-fixture-20261124.png`), clip: { ...box, height: Math.min(420, box.height) } });
          await page.locator('#fixture-preview-caption').evaluate(node => node.remove());
        }
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: sampled.toString(), variables }));
        const misaligned = await page.screenshot();
        assert.deepEqual(pixel(misaligned, ...points.start), rgb, 'The previous solid owner reproduces the extra 4px at the start');
        assert.notDeepEqual(pixel(misaligned, ...points.end), rgb, 'The previous owner leaves the matching native end gutter unpainted');
        assert.deepEqual(await geometry(page), expectedGeometry);
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: theme, variables }));
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: unshifted.toString(), variables }));
        const wrongLine = await page.screenshot();
        assert.deepEqual(pixel(wrongLine, points.lineX, points.lineY), rgb, 'The unshifted real divider leaves no header stroke on the body edge despite correct background fill');
        assert.deepEqual(await geometry(page), before, 'The unshifted divider control retains all original native geometry');
        await page.evaluate(makeStyleUpdateExpression({ styleSheet: theme, variables }));
        await page.evaluate(() => {
          const old = document.getElementById('right-header-portal'), next = old.cloneNode(false);
          old.before(next); next.append(document.getElementById('shared-titlebar-content')); old.remove();
        });
        await verifyPixels();
        assert.deepEqual(await geometry(page), expectedGeometry, 'Portal remount leaves controls and launcher content in their native positions');
        assert.deepEqual((await nativePaint(page)).filter(node => node.id.startsWith('left-')), left);
        for (const state of ['invisible', 'aria-hidden', 'inert', 'closed', 'inactive']) {
          await page.evaluate(state => {
            const header = document.getElementById('right-header-slot');
            if (state === 'invisible') header.classList.add('invisible');
            if (state === 'aria-hidden') header.setAttribute('aria-hidden', 'true');
            if (state === 'inert') header.inert = true;
            if (state === 'closed') document.getElementById('workspace').dataset.appShellUnifiedTabStrip = 'false';
            if (state === 'inactive') document.getElementById('active-page').dataset.appShellActivePage = 'false';
          }, state);
          assert.equal(await page.locator('#main').evaluate(node => getComputedStyle(node).backgroundImage), 'none', `${state}: retained panel nodes cannot activate the end strip`);
          await page.evaluate(() => {
            const header = document.getElementById('right-header-slot'); header.classList.remove('invisible');
            header.removeAttribute('aria-hidden'); header.inert = false;
            document.getElementById('workspace').dataset.appShellUnifiedTabStrip = 'true';
            document.getElementById('active-page').dataset.appShellActivePage = 'true';
          });
        }
        await page.evaluate(() => fixtureLayout('full')); await suspended(page);
        assert.deepEqual(await geometry(page), fullGeometry);
        assert.deepEqual(await nativePaint(page), fullPaint, 'Complete view retains its native header and pane paint');
        await page.evaluate(() => fixtureLayout('split')); await active(page);
        await verifyPixels(); assert.deepEqual(await geometry(page), expectedGeometry);
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});

test('native pane portal remounts preserve stylesheet media and root presentation without redundant writes', async () => {
  const native = loadBrowserSurfaceNative(), browser = await chromium.launch({ headless: true });
  const guarded = 'if (style.media !== media) style.media = media;';
  assert.equal(expression.split(guarded).length, 2);
  const previous = expression.replace(guarded, 'style.media = media;');
  try {
    for (const mode of ['dark', 'light']) for (const legacy of [false, true]) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, colorScheme: mode });
      try {
        await page.setContent(browserSurfaceFixture(native, { mode, registeredEndSlot: true }));
        await page.evaluate(legacy ? previous : expression); await active(page);
        await page.waitForTimeout(1100);
        await page.evaluate(() => {
          window.presentationWrites = { media: 0, root: 0 };
          const count = records => records.forEach(record => presentationWrites[record.attributeName === 'media' ? 'media' : 'root']++);
          window.mediaObserver = new MutationObserver(count);
          mediaObserver.observe(document.getElementById('wukong-codex-theme-style'), { attributes: true, attributeFilter: ['media'] });
          window.presentationObserver = new MutationObserver(count);
          presentationObserver.observe(document.documentElement, { attributes: true,
            attributeFilter: ['data-forge-presentation', 'data-forge-background-placement', 'data-forge-background-ready'] });
          window.paneOverlay = document.getElementById('wukong-codex-theme-background');
          window.paneImage = paneOverlay.querySelector('[data-forge-active="true"] img');
        });
        await page.evaluate(async () => {
          for (let index = 0; index < 12; index++) {
            const carrier = document.getElementById('registered-end-measure'), parent = carrier.parentElement;
            carrier.remove(); parent.append(carrier);
            await new Promise(requestAnimationFrame);
          }
          await new Promise(requestAnimationFrame);
        });
        const writes = await page.evaluate(() => ({ ...presentationWrites }));
        if (legacy) {
          assert.ok(writes.media >= 12, mode + ': old same-value setter must reproduce repeated stylesheet media writes');
        } else {
          assert.deepEqual(writes, { media: 0, root: 0 }, mode + ': pane portal remounts must not invalidate unchanged presentation');
          await page.locator('#full-toggle').click(); await suspended(page);
          assert.equal(await page.evaluate(() => presentationWrites.media), 1, 'Entering full view still pauses material once');
          await page.locator('#split-toggle').click(); await active(page);
          assert.equal(await page.evaluate(() => presentationWrites.media), 2, 'Returning still restores material once');
          assert.deepEqual(await page.evaluate(() => ({ overlay: paneOverlay === document.getElementById('wukong-codex-theme-background'),
            image: paneImage === paneOverlay.querySelector('[data-forge-active="true"] img'), generation: __wukongCodexThemeRuntimeV13.overlayGeneration })),
            { overlay: true, image: true, generation: 1 });
        }
        await page.evaluate(() => { mediaObserver.disconnect(); presentationObserver.disconnect(); });
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
