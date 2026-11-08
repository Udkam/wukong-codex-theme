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
const legacySheet = postcss.parse(theme);
let removedHeaderRules = 0;
legacySheet.walkRules(rule => {
  if (rule.selector.includes('[data-app-shell-tab-row]') && rule.selector.includes('[data-app-shell-tab-strip-controller="right"]')) {
    rule.remove(); removedHeaderRules++;
  }
});
assert.equal(removedHeaderRules, 1, 'The legacy material must remove exactly the newly introduced right-header mapping');
const legacyTheme = legacySheet.toString();
const rowOnlySheet = postcss.parse(theme);
let restoredRowOnlyRules = 0;
rowOnlySheet.walkRules(rule => {
  if (rule.selector.includes('[data-app-shell-titlebar-slot="content"]') &&
    rule.selector.includes('[data-app-shell-tab-row]') && rule.selector.includes('[data-app-shell-tab-strip-controller="right"]')) {
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
  assert.ok(rule.selector.includes('[data-app-shell-titlebar-slot="content"]') && rule.selector.includes('[data-app-shell-tab-row]'));
  rule.selector = ':root.forge-ink-mountain #root :is([data-app-shell-focus-area="right-panel"][data-app-shell-titlebar-slot="content"], [data-app-shell-tab-row]:has([data-app-shell-tab-strip-controller="right"]))';
  missingEndRules++;
});
wholeEndGridSheet.walkRules(rule => {
  if (!rule.selector.includes('[data-app-shell-header-slot="end"]')) return;
  assert.equal(rule.selector.split(' > .h-full.w-max.justify-self-end').length, 2);
  rule.selector = rule.selector.replace(' > .h-full.w-max.justify-self-end', ''); wholeEndGridRules++;
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

test('current native browser separates new-tab canvas, transparent toolbar and its real paint carrier', () => {
  const native = loadBrowserSurfaceNative();
  assert.match(native.newTabClass, /(?:^|\s)bg-surface-canvas(?:\s|$)/);
  assert.ok(!native.toolbarBaseClass.includes('bg-'));
  assert.match(native.frameClass, /(?:^|\s)bg-surface(?:\s|$)/);
  // Semantic JSX/import/export/owner assertions live in the helper, which
  // runs no app code and does not freeze compiled module IDs or chunk hashes.
});

const geometry = page => page.locator('#main,#paint,#native-tabstrip,#right-header-slot,#right-header-track,#right-header-portal,#right-header-actions,#left-header-slot,#left-header-action,#full-toggle,#split-toggle,#right-tabstrip,#left-tabstrip,#tabs-body,#browser-panel,#toolbar-carrier,#toolbar,#back,#address,#reload,#new-tab,#new-tab-input,#new-tab-action,#nested-card,#right-header-clip,#registered-end-slot,#registered-end-measure,#registered-end-padding,#registered-slot-content,#registered-entry,#registered-action-root,#registered-action-group,#guest').evaluateAll(elements => elements.map(element => {
  const s = getComputedStyle(element), r = element.getBoundingClientRect();
  return { id: element.id, rect: [r.x, r.y, r.width, r.height], radius: s.borderRadius, corner: s.cornerShape,
    border: s.borderWidth, padding: s.padding, margin: s.margin, position: s.position, overflow: s.overflow,
    font: s.font, opacity: s.opacity, disabled: element.disabled, tabIndex: element.tabIndex };
}));
const nativePaint = page => page.locator('html,body,#root,#layout,#main,#native-tabstrip,#right-header-slot,#right-header-track,#right-header-portal,#right-header-actions,#left-header-slot,#left-header-action,#full-toggle,#split-toggle,#right-tabstrip,#left-tabstrip,#workspace-content,#tabs-body,#toolbar-carrier,#toolbar,#back,#address,#reload,#new-tab,#new-tab-input,#new-tab-action,#nested-card,#right-header-clip,#registered-end-slot,#registered-end-measure,#registered-end-padding,#registered-slot-content,#registered-entry,#registered-action-root,#registered-action-group,#guest').evaluateAll(elements => elements.map(element => {
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
  return overlay?.parentElement?.id === 'paint' && !overlay.hidden && document.documentElement.dataset.forgeBackgroundReady === 'true' && image?.naturalWidth > 0;
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
        if (width === 1280 && process.env.WUKONG_BROWSER_PREVIEW_DIRECTORY) {
          fs.mkdirSync(process.env.WUKONG_BROWSER_PREVIEW_DIRECTORY, { recursive: true });
          const main = await page.locator('#main').boundingBox();
          const preview = await page.screenshot({ clip: { x: main.x, y: main.y, width: main.width, height: Math.min(550, main.height) } });
          fs.writeFileSync(path.join(process.env.WUKONG_BROWSER_PREVIEW_DIRECTORY,
            `${mode}-native-full-view-fixture-20261108.png`), preview);
        }
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
        assert.equal(paints.find(item => item.id === 'right-tabstrip').background, nativeColor);
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
          for (let x = carrier.x; x < carrier.x + carrier.width; x++) {
            assert.deepEqual(pixel(actual, x, y), layout === 'full' ? pixel(baseline, x, y) : rgb, `${label}: continuous native endcap column ${x - carrier.x}`);
          }
          if (width === 1280 && layout === 'split' && !remounted && process.env.WUKONG_HEADER_PREVIEW_DIRECTORY) {
            fs.mkdirSync(process.env.WUKONG_HEADER_PREVIEW_DIRECTORY, { recursive: true });
            const clip = await page.locator('#right-header-slot').boundingBox();
            fs.writeFileSync(path.join(process.env.WUKONG_HEADER_PREVIEW_DIRECTORY,
              `${mode}-tab-header-endcap-fixture-20261109.png`), await page.screenshot({ clip }));
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
