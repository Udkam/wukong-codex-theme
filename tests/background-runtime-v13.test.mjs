import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import {
  ACTIVE_PROBE_EXPRESSION,
  isActiveThemeState,
  isNativeThemeState,
  makeApplyExpression,
  RESTORE_EXPRESSION,
  THEME_STATE_EXPRESSION
} from '../runtime/injection-plan-v13.mjs';
import { cssFor } from '../shared/theme-model.mjs';
import {
  runtimeFixtureHtml,
  enterThreadState,
  geometry,
  conversationGeometry,
  conversationText
} from './runtime-fixture.mjs';

const styleSheet = fs.readFileSync(new URL('../runtime/forge-background-v13.css', import.meta.url), 'utf8');
const tinySceneSource = index => {
  const palette = ['8b5e3c', '634e3e', '8a703e', '7b2929', '245868', '243c66', '55463c', '30483d', '365641', '55534f', '75463b'];
  const color = palette[index % palette.length];
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='18'%3E%3Crect width='32' height='18' fill='%23${color}'/%3E%3Ctext x='3' y='13' fill='white'%3E${index}%3C/text%3E%3C/svg%3E`;
};
const tinyScene = index => `url("${tinySceneSource(index)}")`;
const variables = [
  ':root.forge-ink-mountain{',
  '--forge-paper:#101210;',
  '--forge-scene-count:11;',
  '--forge-battle-scenes:0 1 2 3;',
  '--forge-battle-primary-scenes:0 1;',
  '--forge-battle-secondary-scenes:2 3;',
  '--forge-scenery-scenes:6 7 8 9 10;',
  `--forge-ui-composer-main:${tinyScene(0)};`,
  `--forge-ui-composer-strip:${tinyScene(1)};`,
  `--forge-ui-composer-pill:${tinyScene(2)};`,
  `--forge-ui-paper-tile:${tinyScene(3)};`,
  `--forge-ui-sidebar-level1:${tinyScene(4)};`,
  `--forge-ui-sidebar-selected:${tinyScene(5)};`,
  `--forge-ui-sidebar-level2-hover:${tinyScene(6)};`,
  `--forge-ui-landing-mark:${tinyScene(7)};`,
  `--forge-ui-landing-mark-dark:${tinyScene(8)};`,
  ...Array.from({ length: 11 }, (_, index) => (
    `--forge-bg-${index}:${tinyScene(index)};--forge-position-${index}:${index === 0 ? '68% center' : 'center center'};`
  )),
  '}',
  ...Array.from({ length: 11 }, (_, index) => (
    `:root.forge-ink-mountain[data-forge-scene="${index}"]{--forge-scene-brightness:1;` +
    `--forge-scene-veil:linear-gradient(rgba(12,14,13,.3),rgba(12,14,13,.3));}`
  ))
].join('');
const expression = makeApplyExpression({ styleSheet, variables });
const activeTheme = JSON.parse(fs.readFileSync(new URL('../themes/active.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const orderedAssets = activeTheme.background.gallery.map((scene, index) => ({
  ...scene,
  url: tinySceneSource(index)
}));
const orderedExpression = makeApplyExpression({
  styleSheet,
  variables: cssFor(activeTheme, orderedAssets, {}, {})
});
const sequenceFor = mode => activeTheme.background.gallery
  .map((scene, index) => ({ scene, index }))
  .filter(({ scene }) => mode === 'battle' ? scene.mode.startsWith('battle') : scene.mode === 'scenery')
  .sort((left, right) => left.scene.order - right.scene.order)
  .map(({ index }) => String(index));
let browser;
let browserServer;

test.before(async () => {
  browserServer = await chromium.launchServer({ headless: true });
  browser = await chromium.connect(browserServer.wsEndpoint());
});

test.after(async () => {
  await browser?.close();
  await browserServer?.kill();
});

const nativeLayoutStyle = page => page.evaluate(() => {
  const read = selector => {
    const style = getComputedStyle(document.querySelector(selector));
    return {
      clipPath: style.clipPath,
      height: style.height,
      padding: style.padding,
      width: style.width
    };
  };
  return {
    topbar: read('.application-menu'),
    sidebar: read('.app-shell-left-panel'),
    sidebarButton: read('.sidebar-row'),
    composer: read('.composer-surface-chrome'),
    send: read('.send'),
    environment: read('.summary-panel-card')
  };
});

const installLanding = page => page.evaluate(() => {
  document.querySelector('[data-thread-find-target="conversation"]')?.remove();
  if (!document.querySelector('.landing-native')) {
    const landing = document.createElement('section');
    landing.className = 'landing-native';
    landing.innerHTML = `
      <div class="landing-hero">
        <small>新建任务</small>
        <div data-testid="home-icon" aria-hidden="true" style="position:relative;width:56px;height:56px;margin:0 auto 12px">
          <svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="13"/></svg>
        </div>
        <h1 class="heading-xl" data-feature="game-source"><span>今天想处理什么？</span></h1>
        <p>描述目标，Codex 会在当前项目中开始工作。</p>
      </div>`;
    document.querySelector('.route-host').insertBefore(landing, document.querySelector('.thread-summary-layer'));
  }
});

const waitForRuntime = (page, predicate, argument) => page.waitForFunction(
  ({ source, value }) => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    if (!runtime) return false;
    if (source === 'scene') return runtime.currentScene === value && !runtime.transitionInFlight;
    if (source === 'transition') return runtime.currentScene === value && runtime.transitionInFlight;
    if (source === 'surface') return document.documentElement.dataset.forgeSurface === value;
    return false;
  },
  { source: predicate, value: argument },
  { timeout: 5000 }
);

const currentBackground = page => page.evaluate(() => {
  const runtime = window.__wukongCodexForgeRuntimeV13;
  return {
    scene: String(runtime.currentScene),
    mode: runtime.currentMode,
    renderCount: runtime.renderCount,
    preloadInFlight: runtime.preloadRequests.size,
    transitioning: runtime.transitionInFlight
  };
});

const waitForSceneChange = async (page, previousScene, expectedMode) => {
  await page.waitForFunction(
    ({ previous, mode }) => {
      const runtime = window.__wukongCodexForgeRuntimeV13;
      return runtime?.currentMode === mode &&
        String(runtime.currentScene) !== previous &&
        !runtime.transitionInFlight &&
        runtime.preloadRequests.size === 0;
    },
    { previous: String(previousScene), mode: expectedMode },
    { timeout: 5000 }
  );
  return currentBackground(page);
};

const advanceBackground = async (page, mode) => {
  const before = await currentBackground(page);
  assert.equal(before.mode, mode);
  assert.equal(
    await page.evaluate(requestedMode => (
      window.__wukongCodexForgeRuntimeV13.nextBackground(requestedMode)
    ), mode),
    true
  );
  return waitForSceneChange(page, before.scene, mode);
};

const backgroundCoverage = page => page.evaluate(() => {
  const overlay = document.getElementById('wukong-forge-background');
  const active = overlay?.querySelector('[data-forge-background-layer][data-forge-active="true"]');
  const image = active?.querySelector('[data-forge-background-image]');
  const veil = active?.querySelector('[data-forge-background-veil]');
  const read = element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x, y, width, height };
  };
  return {
    viewport: { x: 0, y: 0, width: innerWidth, height: innerHeight },
    overlay: read(overlay),
    active: read(active),
    image: read(image),
    veil: read(veil),
    activeImage: image.dataset.forgeBackgroundSource || '',
    layerCount: overlay.querySelectorAll(':scope > [data-forge-background-layer]').length,
    overflow: getComputedStyle(overlay).overflow,
    contain: getComputedStyle(overlay).contain
  };
});

const composerGeometryKeys = new Set([
  'composer',
  'composer-add',
  'composer-access',
  'composer-model',
  'composer-voice',
  'composer-submit'
]);

const withoutComposerGeometry = value => Object.fromEntries(
  Object.entries(value).filter(([key]) => !composerGeometryKeys.has(key))
);

const assertComposerGeometryContract = (before, after) => {
  assert.equal(after.composer[0], before.composer[0], 'composer x anchor changed');
  assert.equal(after.composer[2], before.composer[2], 'composer width changed');
  assert.equal(
    after.composer[1] + after.composer[3],
    before.composer[1] + before.composer[3],
    'composer bottom anchor changed'
  );
  for (const key of [...composerGeometryKeys].filter(item => item !== 'composer')) {
    assert.deepEqual(after[key].slice(2), before[key].slice(2), `${key} hit-box size changed`);
  }
};

test('V13 keeps native UI intact, crossfades decoded scenes, repairs its overlay, and reaches refresh quiescence', async () => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.route('http://wukong.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong.test/');
  await page.evaluate(() => sessionStorage.setItem(
    'wukong-forge-scene-cursors-v13',
    JSON.stringify({ battle: -6, scenery: 'broken' })
  ));
  await page.evaluate(() => {
    window.__forgePreloadImages = [];
    const nativeDecode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = function (...args) {
      if (!window.__forgePreloadImages.includes(this)) window.__forgePreloadImages.push(this);
      return nativeDecode.call(this, ...args);
    };
  });

  const beforeGeometry = await geometry(page);
  const beforeStyle = await nativeLayoutStyle(page);
  const beforeText = await page.locator('body').innerText();
  const beforeBodyChildren = await page.locator('body > *').count();
  const beforeRightRowCount = await page.locator(
    '[data-native-slot="right-card"] [data-slot="thread-summary-panel-item"]'
  ).count();
  assert.ok(beforeRightRowCount > 0, 'fixture must expose native environment rows');
  const beforeLandingGeometry = await page.evaluate(() => {
    const read = selector => {
      const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      kicker: read('.landing-hero small'),
      icon: read('[data-testid="home-icon"]'),
      title: read('[data-feature="game-source"]'),
      subtitle: read('.landing-hero p'),
      titleText: document.querySelector('[data-feature="game-source"]').textContent.trim()
    };
  });

  await page.evaluate(expression);
  const activeState = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(isActiveThemeState(activeState), true);
  assert.equal(await page.evaluate(ACTIVE_PROBE_EXPRESSION), true);
  await page.waitForFunction(() => (
    document.querySelector('.forge-landing-kicker') &&
    document.querySelector('.forge-landing-icon') &&
    document.querySelector('.forge-landing-title') &&
    document.querySelector('.forge-landing-subtitle')
  ));
  assert.equal(activeState.surface, 'landing');
  assert.equal(activeState.mode, 'battle');
  assert.equal(activeState.scene, '0');
  assert.equal(activeState.backgroundActiveImage, 'var(--forge-bg-0)');
  assert.equal(activeState.backgroundLoadedLayerCount, 1);
  assert.equal(activeState.backgroundTransitioning, false);
  assert.equal(activeState.preloadInFlight, 0);
  assert.equal(activeState.backgroundReady, true);
  assert.equal(await page.evaluate(() => window.__forgePreloadImages.length), 1);
  const afterGeometry = await geometry(page);
  const afterStyle = await nativeLayoutStyle(page);
  assert.deepEqual(withoutComposerGeometry(afterGeometry), withoutComposerGeometry(beforeGeometry));
  assertComposerGeometryContract(beforeGeometry, afterGeometry);
  const { composer: beforeComposerStyle, ...beforeNonComposerStyle } = beforeStyle;
  const { composer: afterComposerStyle, ...afterNonComposerStyle } = afterStyle;
  assert.deepEqual(afterNonComposerStyle, beforeNonComposerStyle);
  assert.equal(afterComposerStyle.clipPath, 'none');
  assert.equal(afterComposerStyle.width, beforeComposerStyle.width);
  assert.equal(await page.locator('body').innerText(), beforeText);
  assert.equal(await page.locator('body > *').count(), beforeBodyChildren + 1);
  assert.equal(await page.locator('.forge-workspace').count(), 1);
  assert.equal(await page.locator('.forge-landing-kicker').count(), 1);
  assert.equal(await page.locator('.forge-landing-title').count(), 1);
  assert.equal(await page.locator('.forge-landing-icon').count(), 1);
  assert.equal(await page.locator('.forge-landing-subtitle').count(), 1);
  assert.equal(await page.locator('.forge-composer').count(), 1);
  assert.equal(await page.locator('.forge-sidebar').count(), 1);
  assert.equal(await page.locator('.forge-input,.forge-button').count(), 0);
  assert.equal(await page.locator('.forge-right-panel').count(), 1);
  assert.equal(await page.locator('.forge-right-card').count(), 1);
  assert.equal(await page.locator('.forge-right-title').count(), 1);
  assert.equal(
    await page.locator('.forge-right-row').count(),
    beforeRightRowCount,
    'every native environment row must receive exactly one theme marker'
  );

  const background = await page.evaluate(() => {
    const overlay = document.getElementById('wukong-forge-background');
    const active = overlay.querySelector('[data-forge-background-layer][data-forge-active="true"]');
    const image = active.querySelector('[data-forge-background-image]');
    return {
      position: getComputedStyle(overlay).position,
      inset: getComputedStyle(overlay).inset,
      pointerEvents: getComputedStyle(overlay).pointerEvents,
      transitionDuration: getComputedStyle(active).transitionDuration,
      objectFit: getComputedStyle(image).objectFit,
      objectPosition: getComputedStyle(image).objectPosition,
      imageBackground: getComputedStyle(image).backgroundColor,
      filter: getComputedStyle(image).filter,
      transform: getComputedStyle(image).transform,
      willChange: getComputedStyle(active).willChange,
      bodyIsolation: getComputedStyle(document.body).isolation,
      mainBackground: getComputedStyle(document.querySelector('main.main-surface')).backgroundColor,
      mainBackgroundImage: getComputedStyle(document.querySelector('main.main-surface')).backgroundImage,
      topFadeBackgroundImage: getComputedStyle(document.querySelector('[data-app-shell-main-content-top-fade]')).backgroundImage
    };
  });
  assert.equal(background.position, 'fixed');
  assert.equal(background.inset, '0px');
  assert.equal(background.pointerEvents, 'none');
  assert.equal(background.transitionDuration, '0.42s');
  assert.equal(background.objectFit, 'cover');
  assert.equal(background.objectPosition, '68% 50%');
  assert.equal(background.imageBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(background.filter, 'none');
  assert.equal(background.transform, 'none');
  assert.equal(background.willChange, 'auto');
  assert.equal(background.bodyIsolation, 'auto');
  assert.equal(background.mainBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(background.mainBackgroundImage, 'none');
  assert.equal(background.topFadeBackgroundImage, 'none');

  const landingSkin = await page.evaluate(() => {
    const title = document.querySelector('.forge-landing-title');
    const icon = document.querySelector('.forge-landing-icon');
    const kicker = document.querySelector('.forge-landing-kicker');
    const subtitle = document.querySelector('.forge-landing-subtitle');
    const readRect = element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      titleCopy: title.dataset.forgeTitleCopy,
      titleAria: title.getAttribute('aria-label'),
      titlePseudo: getComputedStyle(title, '::after').content,
      iconPseudo: getComputedStyle(icon, '::before').backgroundImage,
      iconPaintWidth: getComputedStyle(icon, '::before').width,
      iconPaintHeight: getComputedStyle(icon, '::before').height,
      iconPaintTransform: getComputedStyle(icon, '::before').transform,
      kickerOpacity: getComputedStyle(kicker).opacity,
      subtitleOpacity: getComputedStyle(subtitle).opacity,
      kickerRect: readRect(kicker),
      iconRect: readRect(icon),
      titleRect: readRect(title),
      subtitleRect: readRect(subtitle),
      nativeText: title.textContent.trim()
    };
  });
  assert.equal(landingSkin.titleCopy, '此去，欲破何局？');
  assert.equal(landingSkin.titleAria, '此去，欲破何局？');
  assert.match(landingSkin.titlePseudo, /此去，欲破何局/);
  assert.match(landingSkin.iconPseudo, /data:image\/svg\+xml/);
  assert.equal(landingSkin.iconPaintWidth, '168px');
  assert.equal(landingSkin.iconPaintHeight, '168px');
  assert.equal(landingSkin.iconPaintTransform, 'matrix(1, 0, 0, 1, -84, -84)');
  assert.equal(landingSkin.kickerOpacity, '0');
  assert.equal(landingSkin.subtitleOpacity, '0');
  assert.deepEqual(landingSkin.kickerRect, beforeLandingGeometry.kicker);
  assert.deepEqual(landingSkin.iconRect, beforeLandingGeometry.icon);
  assert.deepEqual(landingSkin.titleRect, beforeLandingGeometry.title);
  assert.deepEqual(landingSkin.subtitleRect, beforeLandingGeometry.subtitle);
  assert.equal(landingSkin.nativeText, beforeLandingGeometry.titleText);

  const landingMarkMatrix = await page.evaluate(() => {
    const root = document.documentElement;
    const icon = document.querySelector('[data-testid="home-icon"]');
    const originalScene = root.dataset.forgeScene;
    const readRect = () => {
      const { x, y, width, height } = icon.getBoundingClientRect();
      return { x, y, width, height };
    };
    const matrix = {};
    for (const scene of ['0', '1', '4', '8']) {
      root.dataset.forgeScene = scene;
      matrix[scene] = {
        image: getComputedStyle(icon, '::before').backgroundImage,
        rect: readRect()
      };
    }
    root.dataset.forgeScene = originalScene;
    return matrix;
  });
  for (const scene of Object.keys(landingMarkMatrix)) {
    assert.match(landingMarkMatrix[scene].image, /(?:%3E|>)7(?:%3C|<)/);
  }
  for (const scene of Object.values(landingMarkMatrix)) {
    assert.deepEqual(scene.rect, beforeLandingGeometry.icon);
  }

  await page.waitForTimeout(900);
  const settledRefreshCount = await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.refreshCount);
  await page.waitForTimeout(1300);
  assert.equal(
    await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.refreshCount),
    settledRefreshCount,
    'ResizeObserver kept refreshing a stable layout'
  );

  const battleScene = await page.locator('html').getAttribute('data-forge-scene');
  await page.locator('.sidebar-row').nth(1).click();
  await page.waitForTimeout(650);
  assert.equal(await page.locator('html').getAttribute('data-forge-scene'), battleScene);

  const authored = await enterThreadState(page);
  await waitForRuntime(page, 'transition', 6);
  const transitionState = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(transitionState.backgroundLoadedLayerCount, 2);
  assert.equal(transitionState.backgroundTransitioning, true);
  assert.equal(transitionState.preloadInFlight, 0);
  assert.equal(await page.evaluate(() => window.__forgePreloadImages.length), 2);
  const transitionLayers = await page.locator('[data-forge-background-layer]').evaluateAll(layers => (
    layers.map(layer => {
      const style = getComputedStyle(layer);
      return {
        active: layer.dataset.forgeActive,
        opacity: Number.parseFloat(style.opacity),
        zIndex: Number.parseInt(style.zIndex, 10) || 0,
        transitionDuration: style.transitionDuration,
        transitionTimingFunction: style.transitionTimingFunction,
        willChange: style.willChange
      };
    })
  ));
  assert.equal(transitionLayers.filter(layer => layer.willChange === 'opacity').length, 1);
  assert.ok(transitionLayers.every(layer => layer.transitionDuration === '0.42s'));
  assert.ok(transitionLayers.every(layer => layer.transitionTimingFunction === 'cubic-bezier(0.4, 0, 0.6, 1)'));
  await page.waitForTimeout(90);
  const midpoint = await page.locator('[data-forge-background-layer]').evaluateAll(layers => (
    layers.map(layer => ({
      active: layer.dataset.forgeActive,
      opacity: Number.parseFloat(getComputedStyle(layer).opacity),
      zIndex: Number.parseInt(getComputedStyle(layer).zIndex, 10) || 0
    }))
  ));
  const incoming = midpoint.find(layer => layer.active === 'true');
  const outgoing = midpoint.find(layer => layer.active === 'false');
  assert.ok(incoming.opacity > .03 && incoming.opacity < .97, `invalid incoming opacity ${incoming.opacity}`);
  assert.equal(outgoing.opacity, 1);
  assert.ok(incoming.zIndex > outgoing.zIndex);
  const compositeAlpha = incoming.opacity + outgoing.opacity * (1 - incoming.opacity);
  assert.ok(compositeAlpha > .999, `crossfade exposed the backdrop: ${compositeAlpha}`);
  await waitForRuntime(page, 'scene', 6);
  const settledBackgroundState = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(settledBackgroundState.backgroundLoadedLayerCount, 1);
  assert.equal(settledBackgroundState.backgroundTransitioning, false);
  assert.equal(settledBackgroundState.preloadInFlight, 0);
  const settledLayers = await page.locator('[data-forge-background-layer]').evaluateAll(layers => (
    layers.map(layer => ({
      active: layer.dataset.forgeActive,
      background: layer.querySelector('[data-forge-background-image]').dataset.forgeBackgroundSource || '',
      veil: layer.querySelector('[data-forge-background-veil]').style.backgroundImage,
      willChange: getComputedStyle(layer).willChange
    }))
  ));
  assert.deepEqual(
    settledLayers[0],
    { active: 'false', background: '', veil: 'none', willChange: 'auto' }
  );
  assert.equal(settledLayers[1].active, 'true');
  assert.equal(settledLayers[1].background, 'var(--forge-bg-6)');
  assert.match(settledLayers[1].veil, /linear-gradient/);
  assert.equal(settledLayers[1].willChange, 'auto');
  assert.deepEqual(
    await page.evaluate(() => window.__forgePreloadImages.map(image => ({
      onload: image.onload,
      onerror: image.onerror,
      hasSource: Boolean(image.getAttribute('src'))
    }))),
    [
      { onload: null, onerror: null, hasSource: false },
      { onload: null, onerror: null, hasSource: true }
    ]
  );
  assert.equal(await page.locator('html').getAttribute('data-forge-mode'), 'scenery');
  assert.equal(await page.locator('html').getAttribute('data-forge-scene'), '6');
  const threadGeometry = await geometry(page);
  const threadStyle = await nativeLayoutStyle(page);
  assert.deepEqual(withoutComposerGeometry(threadGeometry), withoutComposerGeometry(beforeGeometry));
  assertComposerGeometryContract(beforeGeometry, threadGeometry);
  const { composer: threadComposerStyle, ...threadNonComposerStyle } = threadStyle;
  assert.deepEqual(threadNonComposerStyle, beforeNonComposerStyle);
  assert.equal(threadComposerStyle.clipPath, 'none');
  assert.equal(threadComposerStyle.width, beforeComposerStyle.width);
  assert.deepEqual(await conversationGeometry(page), authored.geometry);
  assert.equal(await conversationText(page), authored.text);
  assert.equal(await page.locator(
    '.forge-landing-kicker,.forge-landing-title,.forge-landing-icon,.forge-landing-subtitle,.forge-landing-hero'
  ).count(), 0);

  await page.locator('#wukong-forge-background').evaluate(element => element.remove());
  await page.waitForFunction(() => {
    const overlay = document.getElementById('wukong-forge-background');
    const active = overlay?.querySelector('[data-forge-background-layer][data-forge-active="true"]');
    return overlay?.querySelectorAll(':scope > [data-forge-background-layer]').length === 2 &&
      Boolean(active?.querySelector('[data-forge-background-image]')?.dataset.forgeBackgroundSource);
  }, null, { timeout: 5000 });
  assert.equal(await page.evaluate(ACTIVE_PROBE_EXPRESSION), true);

  await installLanding(page);
  await page.evaluate(() => {
    const stale = document.createElement('section');
    stale.dataset.threadFindTarget = 'conversation';
    stale.style.opacity = '0';
    stale.innerHTML = '<div data-virtualized-turn-content>stale hidden turn</div>';
    document.querySelector('.route-host').append(stale);
  });
  await waitForRuntime(page, 'scene', 0);
  assert.equal(await page.locator('html').getAttribute('data-forge-surface'), 'landing');
  assert.equal(await page.locator('html').getAttribute('data-forge-mode'), 'battle');

  await page.evaluate(RESTORE_EXPRESSION);
  const nativeState = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(isNativeThemeState(nativeState), true);
  assert.equal(await page.locator('#wukong-forge-background').count(), 0);
  assert.deepEqual(await nativeLayoutStyle(page), beforeStyle);
  assert.equal(await page.locator('[data-forge-title-copy],[data-forge-original-aria-label]').count(), 0);
});

test('V13 covers the complete viewport on its first commit and after a window resize', async () => {
  const page = await browser.newPage({ viewport: { width: 1536, height: 864 } });
  await page.route('http://wukong-viewport-cover.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-viewport-cover.test/');

  await page.evaluate(expression);
  const initial = await backgroundCoverage(page);
  assert.equal(initial.activeImage, 'var(--forge-bg-0)');
  assert.equal(initial.layerCount, 2);
  assert.equal(initial.overflow, 'clip');
  assert.equal(initial.contain, 'strict');
  assert.deepEqual(initial.overlay, initial.viewport);
  assert.deepEqual(initial.active, initial.viewport);
  assert.deepEqual(initial.image, initial.viewport);
  assert.deepEqual(initial.veil, initial.viewport);

  await page.setViewportSize({ width: 1001, height: 733 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const resized = await backgroundCoverage(page);
  assert.equal(resized.activeImage, 'var(--forge-bg-0)');
  assert.equal(resized.layerCount, 2);
  assert.deepEqual(resized.overlay, resized.viewport);
  assert.deepEqual(resized.active, resized.viewport);
  assert.deepEqual(resized.image, resized.viewport);
  assert.deepEqual(resized.veil, resized.viewport);

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('#wukong-forge-background').count(), 0);
});

test('V13 keeps native carriers painted until the first background is decoded', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-first-ready.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-first-ready.test/');
  const nativeMainPaint = await page.locator('main.main-surface').evaluate(element => ({
    color: getComputedStyle(element).backgroundColor,
    image: getComputedStyle(element).backgroundImage
  }));
  await page.evaluate(() => {
    window.__forgeFirstReadyDecodeResolvers = [];
    HTMLImageElement.prototype.decode = function () {
      return new Promise(resolve => window.__forgeFirstReadyDecodeResolvers.push(resolve));
    };
  });

  const applyPromise = page.evaluate(expression);
  await page.waitForFunction(() => window.__forgeFirstReadyDecodeResolvers?.length === 1);
  const pending = await page.evaluate(ACTIVE_PROBE_EXPRESSION);
  assert.equal(pending, false);
  assert.equal(await page.locator('html').getAttribute('data-forge-background-ready'), null);
  assert.deepEqual(
    await page.locator('main.main-surface').evaluate(element => ({
      color: getComputedStyle(element).backgroundColor,
      image: getComputedStyle(element).backgroundImage
    })),
    nativeMainPaint
  );

  await page.evaluate(() => window.__forgeFirstReadyDecodeResolvers.shift()?.());
  assert.equal(await applyPromise, true);
  assert.equal(await page.evaluate(ACTIVE_PROBE_EXPRESSION), true);
  assert.equal(await page.locator('html').getAttribute('data-forge-background-ready'), 'true');
  assert.equal(
    await page.locator('main.main-surface').evaluate(element => getComputedStyle(element).backgroundColor),
    'rgba(0, 0, 0, 0)'
  );

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V13 still waits for decode when a cached background is already complete', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-cached-ready.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-cached-ready.test/');
  const nativeMainPaint = await page.locator('main.main-surface').evaluate(element => ({
    color: getComputedStyle(element).backgroundColor,
    image: getComputedStyle(element).backgroundImage
  }));
  await page.evaluate(() => {
    window.__forgeCachedDecodeResolvers = [];
    HTMLImageElement.prototype.decode = function () {
      return new Promise(resolve => window.__forgeCachedDecodeResolvers.push(resolve));
    };
  });

  const applyPromise = page.evaluate(expression);
  await page.waitForFunction(() => window.__forgeCachedDecodeResolvers?.length === 1);
  assert.equal(await page.evaluate(ACTIVE_PROBE_EXPRESSION), false);
  assert.equal(await page.locator('html').getAttribute('data-forge-background-ready'), null);
  assert.deepEqual(
    await page.locator('main.main-surface').evaluate(element => ({
      color: getComputedStyle(element).backgroundColor,
      image: getComputedStyle(element).backgroundImage
    })),
    nativeMainPaint
  );

  await page.evaluate(() => window.__forgeCachedDecodeResolvers.shift()?.());
  assert.equal(await applyPromise, true);
  assert.equal(await page.evaluate(ACTIVE_PROBE_EXPRESSION), true);
  assert.equal(await page.locator('html').getAttribute('data-forge-background-ready'), 'true');

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V13 restores native paint while rebuilding an overlay removed during crossfade', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-overlay-generation.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-overlay-generation.test/');
  const nativeMainPaint = await page.locator('main.main-surface').evaluate(element => ({
    color: getComputedStyle(element).backgroundColor,
    image: getComputedStyle(element).backgroundImage
  }));
  await page.evaluate(expression);
  await enterThreadState(page);
  await waitForRuntime(page, 'transition', 6);

  await page.evaluate(() => {
    window.__forgeRepairDecodeResolvers = [];
    HTMLImageElement.prototype.decode = function () {
      return new Promise(resolve => {
        window.__forgeRepairDecodeResolvers.push(resolve);
      });
    };
  });

  await page.locator('#wukong-forge-background').evaluate(element => element.remove());
  await page.waitForFunction(() => (
    document.documentElement.dataset.forgeBackgroundReady !== 'true' &&
    window.__forgeRepairDecodeResolvers?.length === 1
  ));
  assert.equal(await page.locator('html').getAttribute('data-forge-background-ready'), null);
  assert.deepEqual(
    await page.locator('main.main-surface').evaluate(element => ({
      color: getComputedStyle(element).backgroundColor,
      image: getComputedStyle(element).backgroundImage
    })),
    nativeMainPaint
  );

  await page.evaluate(() => window.__forgeRepairDecodeResolvers.shift()?.());
  await page.waitForFunction(ACTIVE_PROBE_EXPRESSION, null, { timeout: 5000 });
  const repaired = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(repaired.backgroundReady, true);
  assert.equal(repaired.backgroundLoadedLayerCount, 1);
  assert.equal(repaired.backgroundTransitioning, false);
  assert.equal(repaired.preloadInFlight, 0);
  const coverage = await backgroundCoverage(page);
  assert.deepEqual(coverage.overlay, coverage.viewport);
  assert.deepEqual(coverage.active, coverage.viewport);
  assert.deepEqual(coverage.image, coverage.viewport);
  assert.deepEqual(coverage.veil, coverage.viewport);

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V13 skins a delayed animated home hero without waiting for a resize', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-delayed-hero.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-delayed-hero.test/');
  await page.evaluate(() => document.querySelector('.landing-native')?.remove());
  await page.evaluate(expression);
  await page.evaluate(() => {
    window.__forgeDelayedHeroInsertedAt = performance.now();
    const landing = document.createElement('section');
    landing.className = 'landing-native';
    landing.style.opacity = '0';
    landing.innerHTML = `
      <div class="landing-hero">
        <div data-testid="home-icon" aria-hidden="true" style="position:relative;width:56px;height:56px;margin:0 auto 12px">
          <svg viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="13"/></svg>
        </div>
        <div class="heading-xl" data-feature="game-source">
          <span>我们该构建什么<button style="color:rgb(220,220,220);text-decoration:underline dotted rgb(220,220,220);border-bottom:1px solid rgb(220,220,220)">项目</button>？</span>
        </div>
      </div>`;
    document.querySelector('.route-host').prepend(landing);
  });

  await page.waitForFunction(() => (
    document.querySelector('[data-feature="game-source"]')?.classList.contains('forge-landing-title') &&
    document.querySelector('[data-testid="home-icon"]')?.classList.contains('forge-landing-icon')
  ), null, { timeout: 3000 });

  const skin = await page.evaluate(() => {
    const title = document.querySelector('.forge-landing-title');
    const button = title.querySelector('button');
    return {
      parentOpacity: getComputedStyle(document.querySelector('.landing-native')).opacity,
      mountToSkinMs: performance.now() - window.__forgeDelayedHeroInsertedAt,
      titleCopy: title.dataset.forgeTitleCopy,
      titlePseudo: getComputedStyle(title, '::after').content,
      iconPseudo: getComputedStyle(document.querySelector('.forge-landing-icon'), '::before').backgroundImage,
      nativeDecorationLine: getComputedStyle(button).textDecorationLine,
      nativeDecorationColor: getComputedStyle(button).textDecorationColor,
      nativeBorderBottomColor: getComputedStyle(button).borderBottomColor,
      refreshCount: window.__wukongCodexForgeRuntimeV13.refreshCount
    };
  });
  assert.equal(skin.parentOpacity, '0');
  assert.ok(skin.mountToSkinMs < 300, `delayed hero skin took ${skin.mountToSkinMs.toFixed(1)} ms`);
  assert.equal(skin.titleCopy, '此去，欲破何局？');
  assert.match(skin.titlePseudo, /此去，欲破何局/);
  assert.match(skin.iconPseudo, /data:image\/svg\+xml/);
  assert.equal(skin.nativeDecorationLine, 'none');
  assert.equal(skin.nativeDecorationColor, 'rgba(0, 0, 0, 0)');
  assert.equal(skin.nativeBorderBottomColor, 'rgba(0, 0, 0, 0)');
  assert.ok(skin.refreshCount >= 2);

  /*
   * React may write its own className again after the 280 ms hero animation.
   * Theme paint must stay anchored to owned data attributes, not to classes
   * React can legitimately replace.
   */
  await page.waitForTimeout(900);
  const afterReactClassCommit = await page.evaluate(() => {
    const title = document.querySelector('[data-feature="game-source"]');
    const icon = document.querySelector('[data-testid="home-icon"]');
    title.className = 'heading-xl';
    icon.className = '';
    const button = title.querySelector('button');
    return {
      titleCopy: title.dataset.forgeTitleCopy,
      titlePseudo: getComputedStyle(title, '::after').content,
      iconPseudo: getComputedStyle(icon, '::before').backgroundImage,
      nativeDecorationLine: getComputedStyle(button).textDecorationLine,
      nativeBorderBottomColor: getComputedStyle(button).borderBottomColor
    };
  });
  assert.equal(afterReactClassCommit.titleCopy, '此去，欲破何局？');
  assert.match(afterReactClassCommit.titlePseudo, /此去，欲破何局/);
  assert.match(afterReactClassCommit.iconPseudo, /data:image\/svg\+xml/);
  assert.equal(afterReactClassCommit.nativeDecorationLine, 'none');
  assert.equal(afterReactClassCommit.nativeBorderBottomColor, 'rgba(0, 0, 0, 0)');

  await page.evaluate(() => {
    document.querySelector('.landing-native').style.opacity = '1';
  });
  assert.equal(await page.locator('[data-forge-title-copy]').isVisible(), true);

  await page.evaluate(RESTORE_EXPRESSION);
  const restored = await page.evaluate(() => {
    const title = document.querySelector('[data-feature="game-source"]');
    const icon = document.querySelector('[data-testid="home-icon"]');
    const button = title.querySelector('button');
    return {
      titleCopy: title.dataset.forgeTitleCopy || null,
      titlePseudo: getComputedStyle(title, '::after').content,
      iconPseudo: getComputedStyle(icon, '::before').content,
      nativeDecorationLine: getComputedStyle(button).textDecorationLine,
      nativeBorderBottomColor: getComputedStyle(button).borderBottomColor
    };
  });
  assert.equal(restored.titleCopy, null);
  assert.equal(restored.titlePseudo, 'none');
  assert.equal(restored.iconPseudo, 'none');
  assert.equal(restored.nativeDecorationLine, 'underline');
  assert.equal(restored.nativeBorderBottomColor, 'rgb(220, 220, 220)');
});

test('V13 detects content mounted inside an existing home-title shell after startup probes finish', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-late-title-content.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-late-title-content.test/');
  await page.evaluate(() => {
    document.querySelector('.landing-native')?.remove();
    const landing = document.createElement('section');
    landing.className = 'landing-native';
    landing.innerHTML = `
      <div class="landing-hero">
        <div data-testid="home-icon" aria-hidden="true" style="position:relative;width:56px;height:56px"></div>
        <h1 class="heading-xl" data-feature="game-source"></h1>
      </div>`;
    document.querySelector('.route-host').prepend(landing);
    window.__forgeResizeEvents = 0;
    window.addEventListener('resize', () => { window.__forgeResizeEvents += 1; });
  });
  await page.evaluate(expression);
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const title = document.querySelector('[data-feature="game-source"]');
    const span = document.createElement('span');
    span.textContent = '我们该构建什么？';
    title.append(span);
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-feature="game-source"]')?.dataset.forgeTitleCopy === '此去，欲破何局？'
  ), null, { timeout: 1000 });
  assert.equal(await page.evaluate(() => window.__forgeResizeEvents), 0);
  assert.match(
    await page.locator('[data-feature="game-source"]').evaluate(element => getComputedStyle(element, '::after').content),
    /此去，欲破何局/
  );

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V13 prefers a visible conversation over an opacity-zero retained home hero', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-overlap-route.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-overlap-route.test/');
  await page.evaluate(expression);
  await enterThreadState(page);
  await page.evaluate(() => {
    const landing = document.createElement('section');
    landing.className = 'landing-native';
    landing.style.opacity = '0';
    landing.innerHTML = `
      <div class="landing-hero">
        <div data-testid="home-icon" aria-hidden="true" style="position:relative;width:56px;height:56px"></div>
        <h1 class="heading-xl" data-feature="game-source"><span>我们该构建什么？</span></h1>
      </div>`;
    document.querySelector('.route-host').prepend(landing);
  });

  await waitForRuntime(page, 'surface', 'thread');
  assert.equal(await page.locator('html').getAttribute('data-forge-mode'), 'scenery');
  assert.equal(await page.locator('[data-feature="game-source"]').getAttribute('data-forge-title-copy'), null);

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V13 bounds rapid navigation follow-up timers to the latest two probes', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-route-timers.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-route-timers.test/');
  await page.evaluate(expression);

  await page.evaluate(() => {
    const row = document.querySelector('[data-app-action-sidebar-thread-row]');
    for (let index = 0; index < 100; index += 1) {
      row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
  });
  assert.ok(
    await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.routeTimers.size <= 2)
  );

  await page.evaluate(() => {
    for (let index = 0; index < 100; index += 1) {
      history.pushState({}, '', `#rapid-${index}`);
    }
  });
  assert.ok(
    await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.routeTimers.size <= 2)
  );
  await page.waitForTimeout(1400);
  assert.equal(
    await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.routeTimers.size),
    0
  );

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V51.7 keeps ordinary task, history, hash, and streaming churn on one decoded scene', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-low-resource.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-low-resource.test/');
  await page.evaluate(expression);
  await enterThreadState(page);
  await waitForRuntime(page, 'scene', 6);
  await page.waitForTimeout(800);

  const beforeStreaming = await page.evaluate(() => ({
    refreshCount: window.__wukongCodexForgeRuntimeV13.refreshCount,
    renderCount: window.__wukongCodexForgeRuntimeV13.renderCount,
    scene: document.documentElement.dataset.forgeScene,
    decodedSources: window.__wukongCodexForgeRuntimeV13.decodedSources.size
  }));
  await page.evaluate(async () => {
    const paragraph = document.querySelector('[data-local-conversation-final-assistant] p');
    for (let index = 0; index < 200; index += 1) {
      paragraph.append(document.createTextNode(` token-${index}`));
      await Promise.resolve();
    }
  });
  await page.waitForTimeout(700);
  assert.deepEqual(
    await page.evaluate(() => ({
      refreshCount: window.__wukongCodexForgeRuntimeV13.refreshCount,
      renderCount: window.__wukongCodexForgeRuntimeV13.renderCount,
      scene: document.documentElement.dataset.forgeScene,
      decodedSources: window.__wukongCodexForgeRuntimeV13.decodedSources.size
    })),
    beforeStreaming,
    'streaming text inside an established turn scheduled theme work'
  );

  await page.locator('[data-app-action-sidebar-thread-row]').last().click();
  await page.evaluate(() => {
    for (let index = 0; index < 100; index += 1) {
      history.pushState({}, '', `#thread-${index}`);
    }
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  assert.ok(await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.routeTimers.size <= 2));
  await page.waitForTimeout(1100);
  const afterRouting = await page.evaluate(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return {
      renderCount: runtime.renderCount,
      scene: document.documentElement.dataset.forgeScene,
      decodedSources: runtime.decodedSources.size,
      transitioning: runtime.transitionInFlight,
      loadedLayers: [...document.querySelectorAll('[data-forge-background-image]')]
        .filter(image => image.dataset.forgeBackgroundSource && image.getAttribute('src')).length
    };
  });
  assert.equal(afterRouting.renderCount, beforeStreaming.renderCount);
  assert.equal(afterRouting.scene, beforeStreaming.scene);
  assert.equal(afterRouting.decodedSources, beforeStreaming.decodedSources);
  assert.equal(afterRouting.transitioning, false);
  assert.equal(afterRouting.loadedLayers, 1);

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V51.7 merges hidden background requests and resumes with one refresh and one scene change', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-hidden-resource.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-hidden-resource.test/');
  await page.evaluate(expression);
  await page.waitForTimeout(900);
  const before = await currentBackground(page);
  const beforeRefreshCount = await page.evaluate(() => (
    window.__wukongCodexForgeRuntimeV13.refreshCount
  ));

  const hiddenRequests = await page.evaluate(() => {
    window.__forgeTestHidden = true;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => window.__forgeTestHidden
    });
    document.dispatchEvent(new Event('visibilitychange'));
    const submit = document.querySelector('[data-native-slot="composer-submit"]');
    submit.setAttribute('aria-disabled', 'true');
    history.pushState({}, '', '#hidden-route');
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return [runtime.nextBackground(), runtime.nextBackground()];
  });
  assert.deepEqual(hiddenRequests, [false, false]);
  await page.waitForTimeout(1000);
  assert.deepEqual(
    await page.evaluate(() => ({
      refreshCount: window.__wukongCodexForgeRuntimeV13.refreshCount,
      renderCount: window.__wukongCodexForgeRuntimeV13.renderCount,
      scene: String(window.__wukongCodexForgeRuntimeV13.currentScene),
      hiddenDirty: window.__wukongCodexForgeRuntimeV13.hiddenDirty,
      preloadInFlight: window.__wukongCodexForgeRuntimeV13.preloadRequests.size
    })),
    {
      refreshCount: beforeRefreshCount,
      renderCount: before.renderCount,
      scene: before.scene,
      hiddenDirty: true,
      preloadInFlight: 0
    }
  );

  await page.evaluate(() => {
    window.__forgeTestHidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForFunction(expected => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return runtime.refreshCount === expected.refreshCount + 1 &&
      runtime.renderCount === expected.renderCount + 1 &&
      String(runtime.currentScene) !== expected.scene &&
      runtime.hiddenDirty === false &&
      !runtime.transitionInFlight &&
      runtime.preloadRequests.size === 0;
  }, {
    refreshCount: beforeRefreshCount,
    renderCount: before.renderCount,
    scene: before.scene
  });
  await page.waitForTimeout(700);
  const resumed = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(resumed.refreshCount, beforeRefreshCount + 1);
  assert.equal(resumed.renderCount, before.renderCount + 1);
  assert.notEqual(resumed.scene, before.scene);
  assert.equal(resumed.backgroundLoadedLayerCount, 1);
  assert.equal(resumed.backgroundTransitioning, false);
  assert.equal(resumed.preloadInFlight, 0);
  await page.evaluate(() => {
    delete document.hidden;
    delete window.__forgeTestHidden;
  });
  await page.evaluate(RESTORE_EXPRESSION);
});

test('V51.7 advances on real New Task clicks only after the 20 minute cooldown and has no timer rotation', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 760 },
    reducedMotion: 'reduce'
  });
  await page.route('http://wukong-auto-rotation.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-auto-rotation.test/');
  await page.evaluate(() => {
    window.__forgeNow = 24 * 60 * 60 * 1000;
    Date.now = () => window.__forgeNow;
    window.__forgeIntervalCalls = 0;
    window.__forgeLongTimeoutCalls = 0;
    const nativeSetTimeout = window.setTimeout.bind(window);
    window.setInterval = () => {
      window.__forgeIntervalCalls += 1;
      return 1;
    };
    window.setTimeout = (callback, delay, ...args) => {
      if (Number(delay) >= 20 * 60 * 1000) window.__forgeLongTimeoutCalls += 1;
      return nativeSetTimeout(callback, delay, ...args);
    };
  });
  await page.evaluate(expression);
  await waitForRuntime(page, 'scene', 0);
  assert.ok(
    await page.locator('[data-forge-background-layer]').evaluateAll(layers => (
      layers.every(layer => getComputedStyle(layer).transitionDuration === '0s')
    ))
  );

  const initial = await currentBackground(page);
  await page.locator('[data-native-slot="new-task"]').click();
  const firstAdvance = await waitForSceneChange(page, initial.scene, 'battle');
  assert.equal(firstAdvance.renderCount, initial.renderCount + 1);

  await page.locator('[data-native-slot="new-task"]').click();
  await page.waitForTimeout(650);
  assert.deepEqual(await currentBackground(page), firstAdvance);

  await page.evaluate(() => {
    window.__forgeNow += 20 * 60 * 1000 - 1;
  });
  await page.locator('[data-native-slot="new-task"]').click();
  await page.waitForTimeout(650);
  assert.deepEqual(await currentBackground(page), firstAdvance);

  await page.evaluate(() => {
    window.__forgeNow += 1;
  });
  await page.locator('[data-native-slot="new-task"]').click();
  const secondAdvance = await waitForSceneChange(page, firstAdvance.scene, 'battle');
  assert.equal(secondAdvance.renderCount, firstAdvance.renderCount + 1);

  assert.deepEqual(
    await page.evaluate(() => ({
      pending: window.__wukongCodexForgeRuntimeV13.autoSceneryPending,
      ready: window.__wukongCodexForgeRuntimeV13.autoSceneryReady
    })),
    { pending: true, ready: true }
  );
  await enterThreadState(page);
  await page.waitForFunction(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return runtime.currentMode === 'scenery' &&
      runtime.currentScene === runtime.selectedScenes.scenery &&
      runtime.currentScene !== 6 &&
      runtime.autoSceneryPending === false &&
      runtime.autoSceneryReady === false;
  });
  await page.waitForFunction(() => !window.__wukongCodexForgeRuntimeV13.transitionInFlight);

  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => window.__forgeIntervalCalls), 0);
  assert.equal(await page.evaluate(() => window.__forgeLongTimeoutCalls), 0);
  assert.equal((await page.evaluate(THEME_STATE_EXPRESSION)).backgroundLoadedLayerCount, 1);
  await page.evaluate(RESTORE_EXPRESSION);
});

test('V51.9 follows the complete numbered battle and scenery sequences and bounds decoded textures', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const expectedBattle = sequenceFor('battle');
  const expectedScenery = sequenceFor('scenery');
  assert.equal(expectedBattle.length, 13);
  assert.equal(expectedScenery.length, 9);
  await page.route('http://wukong-background-decks.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-background-decks.test/');
  await page.evaluate(({ battle, scenery }) => {
    localStorage.setItem('wukong-forge-scene-cursors-v13', JSON.stringify({
      version: 2,
      backgroundDecks: {
        battle: { order: [...battle].reverse(), index: battle.length - 1 },
        scenery: { order: [...scenery].reverse(), index: scenery.length - 1 }
      },
      selectedBattle: battle[0],
      selectedScenery: scenery[0]
    }));
  }, {
    battle: expectedBattle.map(Number),
    scenery: expectedScenery.map(Number)
  });
  await page.evaluate(orderedExpression);
  await waitForRuntime(page, 'scene', Number(expectedBattle[0]));

  const initialBattle = await currentBackground(page);
  const battleScenes = [initialBattle.scene];
  await page.keyboard.press('Control+Alt+F');
  await page.waitForFunction(previous => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return String(runtime.currentScene) !== previous && runtime.transitionInFlight;
  }, initialBattle.scene);
  const transitionState = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(transitionState.backgroundLoadedLayerCount, 2);
  assert.equal(transitionState.backgroundTransitioning, true);
  assert.ok(transitionState.preloadInFlight <= 1);
  battleScenes.push((await waitForSceneChange(page, initialBattle.scene, 'battle')).scene);
  while (battleScenes.length < expectedBattle.length) {
    battleScenes.push((await advanceBackground(page, 'battle')).scene);
  }
  assert.deepEqual(battleScenes, expectedBattle);
  assert.equal((await advanceBackground(page, 'battle')).scene, expectedBattle[0]);
  await page.keyboard.press('Control+Alt+B');
  assert.equal(
    (await waitForSceneChange(page, expectedBattle[0], 'battle')).scene,
    expectedBattle.at(-1)
  );
  await page.keyboard.press('Control+Alt+F');
  assert.equal(
    (await waitForSceneChange(page, expectedBattle.at(-1), 'battle')).scene,
    expectedBattle[0]
  );

  await enterThreadState(page);
  await waitForRuntime(page, 'scene', Number(expectedScenery[0]));
  const sceneryScenes = [(await currentBackground(page)).scene];
  while (sceneryScenes.length < expectedScenery.length) {
    sceneryScenes.push((await advanceBackground(page, 'scenery')).scene);
  }
  assert.deepEqual(sceneryScenes, expectedScenery);
  assert.equal((await advanceBackground(page, 'scenery')).scene, expectedScenery[0]);
  await page.keyboard.press('Control+Alt+B');
  assert.equal(
    (await waitForSceneChange(page, expectedScenery[0], 'scenery')).scene,
    expectedScenery.at(-1)
  );
  await page.keyboard.press('Control+Alt+F');
  assert.equal(
    (await waitForSceneChange(page, expectedScenery.at(-1), 'scenery')).scene,
    expectedScenery[0]
  );

  const persisted = await page.evaluate(() => JSON.parse(
    localStorage.getItem('wukong-forge-scene-cursors-v13')
  ));
  assert.equal(persisted.version, 3);
  assert.equal(persisted.backgroundDecks.battle.strategy, 'ordered-v1');
  assert.equal(persisted.backgroundDecks.scenery.strategy, 'ordered-v1');
  assert.deepEqual(persisted.backgroundDecks.battle.order.map(String), expectedBattle);
  assert.deepEqual(persisted.backgroundDecks.scenery.order.map(String), expectedScenery);

  const settled = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(settled.backgroundLoadedLayerCount, 1);
  assert.equal(settled.backgroundTransitioning, false);
  assert.equal(settled.preloadInFlight, 0);
  await page.evaluate(RESTORE_EXPRESSION);
});

test('V52.1 toggles battle and scenery locally while route defaults remain automatic', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const firstBattle = Number(sequenceFor('battle')[0]);
  const firstScenery = Number(sequenceFor('scenery')[0]);
  await page.route('http://wukong-mode-toggle.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-mode-toggle.test/');
  await page.evaluate(orderedExpression);
  await waitForRuntime(page, 'scene', firstBattle);
  const initialBattle = await currentBackground(page);

  await page.keyboard.press('Control+Alt+C');
  await waitForRuntime(page, 'scene', firstScenery);
  const landingScenery = await page.evaluate(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return {
      surface: document.documentElement.dataset.forgeSurface,
      mode: runtime.currentMode,
      automaticMode: runtime.automaticBackgroundMode,
      manualMode: runtime.manualBackgroundMode,
      renderCount: runtime.renderCount
    };
  });
  assert.deepEqual(landingScenery, {
    surface: 'landing',
    mode: 'scenery',
    automaticMode: 'battle',
    manualMode: 'scenery',
    renderCount: initialBattle.renderCount + 1
  });

  await page.evaluate(() => history.replaceState({ sameRouteRefresh: true }, '', location.href));
  await page.waitForTimeout(850);
  assert.deepEqual(
    await page.evaluate(() => {
      const runtime = window.__wukongCodexForgeRuntimeV13;
      return {
        mode: runtime.currentMode,
        manualMode: runtime.manualBackgroundMode,
        renderCount: runtime.renderCount
      };
    }),
    { mode: 'scenery', manualMode: 'scenery', renderCount: landingScenery.renderCount },
    'same-URL history state updates must not clear the current-page sequence override'
  );

  await enterThreadState(page);
  await page.waitForFunction(expectedScene => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return document.documentElement.dataset.forgeSurface === 'thread' &&
      runtime.currentMode === 'scenery' &&
      runtime.currentScene === expectedScene &&
      !runtime.transitionInFlight;
  }, firstScenery);
  await page.waitForTimeout(700);
  assert.deepEqual(
    await page.evaluate(() => {
      const runtime = window.__wukongCodexForgeRuntimeV13;
      return {
        automaticMode: runtime.automaticBackgroundMode,
        manualMode: runtime.manualBackgroundMode,
        renderCount: runtime.renderCount
      };
    }),
    { automaticMode: 'scenery', manualMode: null, renderCount: landingScenery.renderCount },
    'entering a thread should keep an already visible scenery frame without decoding it again'
  );

  await page.keyboard.press('Control+Alt+C');
  await waitForRuntime(page, 'scene', firstBattle);
  const manualBattle = await currentBackground(page);
  await page.locator('[data-app-action-sidebar-thread-row]').last().click();
  await waitForRuntime(page, 'scene', firstScenery);
  assert.deepEqual(
    await page.evaluate(() => {
      const runtime = window.__wukongCodexForgeRuntimeV13;
      return {
        surface: document.documentElement.dataset.forgeSurface,
        automaticMode: runtime.automaticBackgroundMode,
        manualMode: runtime.manualBackgroundMode,
        renderCount: runtime.renderCount
      };
    }),
    {
      surface: 'thread',
      automaticMode: 'scenery',
      manualMode: null,
      renderCount: manualBattle.renderCount + 1
    }
  );

  await page.keyboard.press('Control+Alt+C');
  await waitForRuntime(page, 'scene', firstBattle);
  const beforeLanding = await currentBackground(page);
  await installLanding(page);
  await page.waitForFunction(expectedScene => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return document.documentElement.dataset.forgeSurface === 'landing' &&
      runtime.currentMode === 'battle' &&
      runtime.currentScene === expectedScene &&
      !runtime.transitionInFlight;
  }, firstBattle);
  await page.waitForTimeout(700);
  assert.deepEqual(
    await page.evaluate(() => {
      const runtime = window.__wukongCodexForgeRuntimeV13;
      return {
        automaticMode: runtime.automaticBackgroundMode,
        manualMode: runtime.manualBackgroundMode,
        renderCount: runtime.renderCount
      };
    }),
    { automaticMode: 'battle', manualMode: null, renderCount: beforeLanding.renderCount },
    'returning to New Task should keep an already visible battle frame without decoding it again'
  );

  await page.evaluate(RESTORE_EXPRESSION);
});

test('V52.2 toggles the landing quote on Ctrl+Alt+T without reload or background work', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const firstBattle = Number(sequenceFor('battle')[0]);
  await page.route('http://wukong-quote-toggle.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-quote-toggle.test/');
  await page.evaluate(orderedExpression);
  await waitForRuntime(page, 'scene', firstBattle);
  await page.waitForFunction(() => (
    document.documentElement.dataset.forgeLandingQuoteVisible === 'true' &&
    document.querySelector('[data-feature="game-source"]')?.dataset.forgeTitleCopy === '此去，欲破何局？'
  ));
  await page.waitForTimeout(900);

  const baseline = await page.evaluate(() => {
    const title = document.querySelector('[data-feature="game-source"]');
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const rect = title.getBoundingClientRect();
    window.__forgeQuoteReferences = {
      document,
      runtime,
      style: document.getElementById('wukong-forge-style'),
      overlay: document.getElementById('wukong-forge-background'),
      url: location.href,
      historyLength: history.length,
      timeOrigin: performance.timeOrigin
    };
    window.__forgeQuoteLifecycle = {
      beforeunload: 0,
      pagehide: 0,
      unload: 0,
      load: 0,
      pageshow: 0
    };
    for (const name of Object.keys(window.__forgeQuoteLifecycle)) {
      window.addEventListener(name, () => { window.__forgeQuoteLifecycle[name] += 1; });
    }
    window.__forgeDownstreamQuoteKeys = 0;
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.altKey && event.code === 'KeyT') {
        window.__forgeDownstreamQuoteKeys += 1;
      }
    });
    return {
      quoteVisible: runtime.landingQuoteVisible,
      rootState: document.documentElement.dataset.forgeLandingQuoteVisible,
      aria: title.getAttribute('aria-label'),
      nativeText: title.textContent,
      pseudoContent: getComputedStyle(title, '::after').content,
      pseudoDisplay: getComputedStyle(title, '::after').display,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      scene: String(runtime.currentScene),
      refreshCount: runtime.refreshCount,
      renderCount: runtime.renderCount
    };
  });
  assert.equal(baseline.quoteVisible, true);
  assert.equal(baseline.rootState, 'true');
  assert.equal(baseline.aria, '此去，欲破何局？');
  assert.match(baseline.pseudoContent, /此去，欲破何局/);
  assert.equal(baseline.pseudoDisplay, 'flex');

  const repeated = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 't',
      code: 'KeyT',
      ctrlKey: true,
      altKey: true,
      repeat: true,
      bubbles: true,
      cancelable: true
    });
    const accepted = document.dispatchEvent(event);
    return {
      accepted,
      defaultPrevented: event.defaultPrevented,
      quoteVisible: window.__wukongCodexForgeRuntimeV13.landingQuoteVisible,
      downstream: window.__forgeDownstreamQuoteKeys
    };
  });
  assert.deepEqual(repeated, {
    accepted: false,
    defaultPrevented: true,
    quoteVisible: true,
    downstream: 0
  });

  await page.keyboard.press('Control+Alt+T');
  await page.waitForFunction(() => (
    document.documentElement.dataset.forgeLandingQuoteVisible === 'false'
  ));
  await page.waitForTimeout(650);
  const hidden = await page.evaluate(() => {
    const references = window.__forgeQuoteReferences;
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const title = document.querySelector('[data-feature="game-source"]');
    const rect = title.getBoundingClientRect();
    return {
      sameDocument: references.document === document,
      sameRuntime: references.runtime === runtime,
      sameStyle: references.style === document.getElementById('wukong-forge-style'),
      sameOverlay: references.overlay === document.getElementById('wukong-forge-background'),
      sameUrl: references.url === location.href,
      sameHistoryLength: references.historyLength === history.length,
      sameTimeOrigin: references.timeOrigin === performance.timeOrigin,
      lifecycle: { ...window.__forgeQuoteLifecycle },
      quoteVisible: runtime.landingQuoteVisible,
      rootState: document.documentElement.dataset.forgeLandingQuoteVisible,
      aria: title.getAttribute('aria-label'),
      nativeText: title.textContent,
      titleCopy: title.dataset.forgeTitleCopy,
      pseudoDisplay: getComputedStyle(title, '::after').display,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      scene: String(runtime.currentScene),
      refreshCount: runtime.refreshCount,
      renderCount: runtime.renderCount,
      preloadInFlight: runtime.preloadRequests.size,
      downstream: window.__forgeDownstreamQuoteKeys
    };
  });
  assert.equal(hidden.sameDocument, true);
  assert.equal(hidden.sameRuntime, true);
  assert.equal(hidden.sameStyle, true);
  assert.equal(hidden.sameOverlay, true);
  assert.equal(hidden.sameUrl, true);
  assert.equal(hidden.sameHistoryLength, true);
  assert.equal(hidden.sameTimeOrigin, true);
  assert.deepEqual(hidden.lifecycle, { beforeunload: 0, pagehide: 0, unload: 0, load: 0, pageshow: 0 });
  assert.equal(hidden.quoteVisible, false);
  assert.equal(hidden.rootState, 'false');
  assert.equal(hidden.aria, null);
  assert.equal(hidden.nativeText, baseline.nativeText);
  assert.equal(hidden.titleCopy, '此去，欲破何局？');
  assert.equal(hidden.pseudoDisplay, 'none');
  assert.deepEqual(hidden.rect, baseline.rect);
  assert.equal(hidden.scene, baseline.scene);
  assert.equal(hidden.refreshCount, baseline.refreshCount);
  assert.equal(hidden.renderCount, baseline.renderCount);
  assert.equal(hidden.preloadInFlight, 0);
  assert.equal(hidden.downstream, 0);

  const shifted = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'T',
      code: 'KeyT',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true
    });
    const accepted = document.dispatchEvent(event);
    return {
      accepted,
      defaultPrevented: event.defaultPrevented,
      quoteVisible: window.__wukongCodexForgeRuntimeV13.landingQuoteVisible
    };
  });
  assert.deepEqual(shifted, { accepted: true, defaultPrevented: false, quoteVisible: false });

  await enterThreadState(page);
  await waitForRuntime(page, 'surface', 'thread');
  assert.deepEqual(
    await page.evaluate(() => ({
      quoteVisible: window.__wukongCodexForgeRuntimeV13.landingQuoteVisible,
      rootState: document.documentElement.dataset.forgeLandingQuoteVisible
    })),
    { quoteVisible: false, rootState: 'false' }
  );
  await installLanding(page);
  await page.waitForFunction(() => (
    document.documentElement.dataset.forgeSurface === 'landing' &&
    document.querySelector('[data-feature="game-source"]')?.dataset.forgeTitleCopy === '此去，欲破何局？'
  ));
  assert.equal(
    await page.locator('[data-feature="game-source"]').evaluate(title => getComputedStyle(title, '::after').display),
    'none'
  );

  await page.evaluate(() => {
    window.__forgeQuoteRuntimeBeforeReapply = window.__wukongCodexForgeRuntimeV13;
  });
  await page.evaluate(orderedExpression);
  await page.waitForFunction(() => (
    window.__wukongCodexForgeRuntimeV13 !== window.__forgeQuoteRuntimeBeforeReapply &&
    document.documentElement.dataset.forgeBackgroundReady === 'true' &&
    document.documentElement.dataset.forgeLandingQuoteVisible === 'false'
  ));
  assert.deepEqual(
    await page.evaluate(() => ({
      quoteVisible: window.__wukongCodexForgeRuntimeV13.landingQuoteVisible,
      pseudoDisplay: getComputedStyle(
        document.querySelector('[data-feature="game-source"]'),
        '::after'
      ).display
    })),
    { quoteVisible: false, pseudoDisplay: 'none' },
    'a no-reload hot apply should retain the current-window quote preference'
  );

  await page.keyboard.press('Control+Alt+T');
  await page.waitForFunction(() => (
    document.documentElement.dataset.forgeLandingQuoteVisible === 'true'
  ));
  const visibleAgain = await page.evaluate(() => {
    const title = document.querySelector('[data-feature="game-source"]');
    return {
      quoteVisible: window.__wukongCodexForgeRuntimeV13.landingQuoteVisible,
      aria: title.getAttribute('aria-label'),
      nativeText: title.textContent,
      pseudoContent: getComputedStyle(title, '::after').content,
      pseudoDisplay: getComputedStyle(title, '::after').display
    };
  });
  assert.equal(visibleAgain.quoteVisible, true);
  assert.equal(visibleAgain.aria, '此去，欲破何局？');
  assert.match(visibleAgain.pseudoContent, /此去，欲破何局/);
  assert.equal(visibleAgain.pseudoDisplay, 'flex');

  await page.evaluate(RESTORE_EXPRESSION);
  const native = await page.evaluate(() => {
    const title = document.querySelector('[data-feature="game-source"]');
    return {
      rootControlPresent: document.documentElement.hasAttribute('data-forge-landing-quote-visible'),
      titleCopyPresent: Object.hasOwn(title.dataset, 'forgeTitleCopy'),
      aria: title.getAttribute('aria-label'),
      nativeText: title.textContent
    };
  });
  assert.deepEqual(native, {
    rootControlPresent: false,
    titleCopyPresent: false,
    aria: null,
    nativeText: visibleAgain.nativeText
  });
  assert.equal(isNativeThemeState(await page.evaluate(THEME_STATE_EXPRESSION)), true);
});

test('V52.0 switches the decoded image in place on Ctrl+Alt+F without reloading the page or theme', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const firstBattle = Number(sequenceFor('battle')[0]);
  await page.route('http://wukong-switch-in-place.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-switch-in-place.test/');
  await page.evaluate(() => {
    const nativeDecode = HTMLImageElement.prototype.decode;
    let decodeCalls = 0;
    window.__forgeDelayedDecodes = [];
    HTMLImageElement.prototype.decode = function (...args) {
      decodeCalls += 1;
      if (decodeCalls === 1) return nativeDecode.call(this, ...args);
      return new Promise(resolve => {
        window.__forgeDelayedDecodes.push({ image: this, resolve });
      });
    };
  });
  await page.evaluate(orderedExpression);
  await waitForRuntime(page, 'scene', firstBattle);
  await page.waitForTimeout(900);

  const baseline = await page.evaluate(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const style = document.getElementById('wukong-forge-style');
    const overlay = document.getElementById('wukong-forge-background');
    const marks = [...document.querySelectorAll('[data-forge-mark]')];
    window.__forgeSwitchReferences = {
      document,
      runtime,
      style,
      overlay,
      marks,
      styleText: style.textContent,
      url: location.href,
      historyLength: history.length,
      navigationEntries: performance.getEntriesByType('navigation').length,
      timeOrigin: performance.timeOrigin
    };
    window.__forgeSwitchLifecycle = {
      beforeunload: 0,
      pagehide: 0,
      unload: 0,
      load: 0,
      pageshow: 0
    };
    for (const name of Object.keys(window.__forgeSwitchLifecycle)) {
      window.addEventListener(name, () => {
        window.__forgeSwitchLifecycle[name] += 1;
      });
    }
    window.__forgeDownstreamBackgroundKeys = 0;
    document.addEventListener('keydown', event => {
      if (event.ctrlKey && event.altKey && event.code === 'KeyF') {
        window.__forgeDownstreamBackgroundKeys += 1;
      }
    });
    return {
      scene: String(runtime.currentScene),
      refreshCount: runtime.refreshCount,
      renderCount: runtime.renderCount,
      overlayGeneration: runtime.overlayGeneration
    };
  });

  const repeated = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'f',
      code: 'KeyF',
      ctrlKey: true,
      altKey: true,
      repeat: true,
      bubbles: true,
      cancelable: true
    });
    const accepted = document.dispatchEvent(event);
    return {
      accepted,
      defaultPrevented: event.defaultPrevented,
      scene: String(window.__wukongCodexForgeRuntimeV13.currentScene),
      renderCount: window.__wukongCodexForgeRuntimeV13.renderCount,
      downstream: window.__forgeDownstreamBackgroundKeys
    };
  });
  assert.deepEqual(repeated, {
    accepted: false,
    defaultPrevented: true,
    scene: baseline.scene,
    renderCount: baseline.renderCount,
    downstream: 0
  });
  await page.evaluate(() => { window.__forgeDownstreamBackgroundKeys = 0; });

  await page.keyboard.press('Control+Alt+F');
  await page.waitForFunction(() => window.__forgeDelayedDecodes.length === 1);
  const waiting = await page.evaluate(() => {
    const references = window.__forgeSwitchReferences;
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const layers = [...document.querySelectorAll('[data-forge-background-layer]')].map(layer => {
      const image = layer.querySelector('[data-forge-background-image]');
      return {
        active: layer.dataset.forgeActive === 'true',
        opacity: Number.parseFloat(getComputedStyle(layer).opacity),
        source: image.dataset.forgeBackgroundSource || '',
        hasSource: Boolean(image.getAttribute('src')),
        decoded: image.dataset.forgeDecoded === 'true',
        imageBackground: getComputedStyle(image).backgroundColor
      };
    });
    return {
      sameDocument: references.document === document,
      sameRuntime: references.runtime === runtime,
      sameStyle: references.style === document.getElementById('wukong-forge-style'),
      sameOverlay: references.overlay === document.getElementById('wukong-forge-background'),
      sameMarks: references.marks.length === document.querySelectorAll('[data-forge-mark]').length &&
        references.marks.every((mark, index) => mark === document.querySelectorAll('[data-forge-mark]')[index]),
      sameStyleText: references.styleText === references.style.textContent,
      sameUrl: references.url === location.href,
      sameHistoryLength: references.historyLength === history.length,
      sameNavigationEntries: references.navigationEntries === performance.getEntriesByType('navigation').length,
      sameTimeOrigin: references.timeOrigin === performance.timeOrigin,
      lifecycle: { ...window.__forgeSwitchLifecycle },
      downstream: window.__forgeDownstreamBackgroundKeys,
      scene: String(runtime.currentScene),
      refreshCount: runtime.refreshCount,
      renderCount: runtime.renderCount,
      overlayGeneration: runtime.overlayGeneration,
      backgroundReady: document.documentElement.dataset.forgeBackgroundReady === 'true',
      preloadInFlight: runtime.preloadRequests.size,
      layers
    };
  });
  assert.equal(waiting.sameDocument, true);
  assert.equal(waiting.sameRuntime, true);
  assert.equal(waiting.sameStyle, true);
  assert.equal(waiting.sameOverlay, true);
  assert.equal(waiting.sameMarks, true);
  assert.equal(waiting.sameStyleText, true);
  assert.equal(waiting.sameUrl, true);
  assert.equal(waiting.sameHistoryLength, true);
  assert.equal(waiting.sameNavigationEntries, true);
  assert.equal(waiting.sameTimeOrigin, true);
  assert.deepEqual(waiting.lifecycle, { beforeunload: 0, pagehide: 0, unload: 0, load: 0, pageshow: 0 });
  assert.equal(waiting.downstream, 0);
  assert.equal(waiting.scene, baseline.scene);
  assert.equal(waiting.refreshCount, baseline.refreshCount);
  assert.equal(waiting.renderCount, baseline.renderCount);
  assert.equal(waiting.overlayGeneration, baseline.overlayGeneration);
  assert.equal(waiting.backgroundReady, true);
  assert.equal(waiting.preloadInFlight, 1);
  assert.equal(waiting.layers.filter(layer => layer.active).length, 1);
  assert.equal(waiting.layers.filter(layer => layer.decoded && layer.hasSource).length, 1);
  const waitingIncoming = waiting.layers.find(layer => !layer.active && layer.hasSource);
  assert.ok(waitingIncoming);
  assert.equal(waitingIncoming.opacity, 0);
  assert.equal(waitingIncoming.decoded, false);
  assert.equal(waitingIncoming.imageBackground, 'rgba(0, 0, 0, 0)');

  const armedBeforePaint = await page.evaluate(async () => {
    window.__forgeDelayedDecodes[0].resolve();
    for (let index = 0; index < 6; index += 1) await Promise.resolve();
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const incoming = document.querySelector('[data-forge-background-layer][data-forge-active="true"]');
    return {
      transitionInFlight: runtime.transitionInFlight,
      firstFrameQueued: Boolean(runtime.transitionFrameA),
      secondFrameQueued: Boolean(runtime.transitionFrameB),
      incomingOpacity: Number.parseFloat(getComputedStyle(incoming).opacity)
    };
  });
  assert.deepEqual(armedBeforePaint, {
    transitionInFlight: true,
    firstFrameQueued: true,
    secondFrameQueued: false,
    incomingOpacity: 0
  }, 'a decoded incoming layer must remain hidden until the first painted frame');
  await page.waitForFunction(previous => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return String(runtime.currentScene) !== previous && runtime.transitionInFlight;
  }, baseline.scene);
  await page.waitForTimeout(90);
  const transitioning = await page.evaluate(() => {
    const references = window.__forgeSwitchReferences;
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const layers = [...document.querySelectorAll('[data-forge-background-layer]')].map(layer => ({
      active: layer.dataset.forgeActive === 'true',
      opacity: Number.parseFloat(getComputedStyle(layer).opacity),
      decoded: layer.querySelector('[data-forge-background-image]').dataset.forgeDecoded === 'true',
      hasSource: Boolean(layer.querySelector('[data-forge-background-image]').getAttribute('src')),
      imageBackground: getComputedStyle(layer.querySelector('[data-forge-background-image]')).backgroundColor
    }));
    return {
      sameDocument: references.document === document,
      sameRuntime: references.runtime === runtime,
      sameStyle: references.style === document.getElementById('wukong-forge-style'),
      sameOverlay: references.overlay === document.getElementById('wukong-forge-background'),
      sameStyleText: references.styleText === references.style.textContent,
      lifecycle: { ...window.__forgeSwitchLifecycle },
      refreshCount: runtime.refreshCount,
      renderCount: runtime.renderCount,
      overlayGeneration: runtime.overlayGeneration,
      preloadInFlight: runtime.preloadRequests.size,
      layers
    };
  });
  assert.equal(transitioning.sameDocument, true);
  assert.equal(transitioning.sameRuntime, true);
  assert.equal(transitioning.sameStyle, true);
  assert.equal(transitioning.sameOverlay, true);
  assert.equal(transitioning.sameStyleText, true);
  assert.deepEqual(transitioning.lifecycle, { beforeunload: 0, pagehide: 0, unload: 0, load: 0, pageshow: 0 });
  assert.equal(transitioning.refreshCount, baseline.refreshCount);
  assert.equal(transitioning.renderCount, baseline.renderCount + 1);
  assert.equal(transitioning.overlayGeneration, baseline.overlayGeneration);
  assert.equal(transitioning.preloadInFlight, 0);
  assert.equal(transitioning.layers.filter(layer => layer.decoded && layer.hasSource).length, 2);
  assert.ok(transitioning.layers.every(layer => layer.imageBackground === 'rgba(0, 0, 0, 0)'));
  const incoming = transitioning.layers.find(layer => layer.active);
  const outgoing = transitioning.layers.find(layer => !layer.active);
  assert.ok(incoming.opacity > .03 && incoming.opacity < .97, `invalid incoming opacity ${incoming.opacity}`);
  assert.equal(outgoing.opacity, 1);

  const changed = await waitForSceneChange(page, baseline.scene, 'battle');
  assert.notEqual(changed.scene, baseline.scene);
  await page.waitForTimeout(800);
  const settled = await page.evaluate(() => {
    const references = window.__forgeSwitchReferences;
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const inactive = document.querySelector('[data-forge-background-layer][data-forge-active="false"]');
    const inactiveImage = inactive.querySelector('[data-forge-background-image]');
    return {
      sameDocument: references.document === document,
      sameRuntime: references.runtime === runtime,
      sameStyle: references.style === document.getElementById('wukong-forge-style'),
      sameOverlay: references.overlay === document.getElementById('wukong-forge-background'),
      sameMarks: references.marks.length === document.querySelectorAll('[data-forge-mark]').length &&
        references.marks.every((mark, index) => mark === document.querySelectorAll('[data-forge-mark]')[index]),
      sameStyleText: references.styleText === references.style.textContent,
      sameUrl: references.url === location.href,
      sameHistoryLength: references.historyLength === history.length,
      sameNavigationEntries: references.navigationEntries === performance.getEntriesByType('navigation').length,
      sameTimeOrigin: references.timeOrigin === performance.timeOrigin,
      lifecycle: { ...window.__forgeSwitchLifecycle },
      refreshCount: runtime.refreshCount,
      renderCount: runtime.renderCount,
      overlayGeneration: runtime.overlayGeneration,
      transitionInFlight: runtime.transitionInFlight,
      preloadInFlight: runtime.preloadRequests.size,
      loadedLayers: [...document.querySelectorAll('[data-forge-background-image]')].filter(image => (
        image.dataset.forgeBackgroundSource &&
        image.dataset.forgeDecoded === 'true' &&
        image.getAttribute('src')
      )).length,
      inactiveHasSource: Boolean(inactiveImage.getAttribute('src')),
      inactiveTrackedSource: inactiveImage.dataset.forgeBackgroundSource || ''
    };
  });
  assert.equal(settled.sameDocument, true);
  assert.equal(settled.sameRuntime, true);
  assert.equal(settled.sameStyle, true);
  assert.equal(settled.sameOverlay, true);
  assert.equal(settled.sameMarks, true);
  assert.equal(settled.sameStyleText, true);
  assert.equal(settled.sameUrl, true);
  assert.equal(settled.sameHistoryLength, true);
  assert.equal(settled.sameNavigationEntries, true);
  assert.equal(settled.sameTimeOrigin, true);
  assert.deepEqual(settled.lifecycle, { beforeunload: 0, pagehide: 0, unload: 0, load: 0, pageshow: 0 });
  assert.equal(settled.refreshCount, baseline.refreshCount);
  assert.equal(settled.renderCount, baseline.renderCount + 1);
  assert.equal(settled.overlayGeneration, baseline.overlayGeneration);
  assert.equal(settled.transitionInFlight, false);
  assert.equal(settled.preloadInFlight, 0);
  assert.equal(settled.loadedLayers, 1);
  assert.equal(settled.inactiveHasSource, false);
  assert.equal(settled.inactiveTrackedSource, '');
  await page.evaluate(RESTORE_EXPRESSION);
});

test('V52.0 coalesces rapid manual intent and always reuses a settled layer from zero opacity', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-stable-transition.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-stable-transition.test/');
  await page.evaluate(expression);
  await waitForRuntime(page, 'scene', 0);
  const baseline = await currentBackground(page);

  await page.keyboard.press('Control+Alt+F');
  await page.waitForFunction(previous => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return runtime.transitionInFlight && String(runtime.currentScene) !== previous;
  }, baseline.scene);
  await page.evaluate(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    runtime.nextBackground('battle');
    runtime.previousBackground('battle');
  });
  await page.waitForFunction(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return !runtime.transitionInFlight && runtime.preloadRequests.size === 0;
  });
  await page.waitForTimeout(700);

  const coalesced = await page.evaluate(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const inactive = document.querySelector('[data-forge-background-layer][data-forge-active="false"]');
    return {
      scene: String(runtime.currentScene),
      renderCount: runtime.renderCount,
      pending: runtime.pendingSceneStyle,
      inactiveOpacity: Number.parseFloat(getComputedStyle(inactive).opacity),
      inactiveTransition: getComputedStyle(inactive).transitionDuration,
      loaded: [...document.querySelectorAll('[data-forge-background-image]')].filter(image => (
        image.dataset.forgeDecoded === 'true' && image.getAttribute('src')
      )).length
    };
  });
  assert.notEqual(coalesced.scene, baseline.scene);
  assert.equal(coalesced.renderCount, baseline.renderCount + 1);
  assert.equal(coalesced.pending, null);
  assert.equal(coalesced.inactiveOpacity, 0);
  assert.equal(coalesced.inactiveTransition, '0s');
  assert.equal(coalesced.loaded, 1);

  await page.keyboard.press('Control+Alt+F');
  await page.waitForFunction(previous => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return runtime.transitionInFlight && String(runtime.currentScene) !== previous;
  }, coalesced.scene);
  await page.waitForTimeout(140);
  const reused = await page.evaluate(() => {
    const layers = [...document.querySelectorAll('[data-forge-background-layer]')];
    const incoming = layers.find(layer => layer.dataset.forgeActive === 'true');
    const outgoing = layers.find(layer => layer.dataset.forgeActive === 'false');
    return {
      incoming: Number.parseFloat(getComputedStyle(incoming).opacity),
      outgoing: Number.parseFloat(getComputedStyle(outgoing).opacity)
    };
  });
  assert.ok(reused.incoming > .02 && reused.incoming < .98, `invalid reused opacity ${reused.incoming}`);
  assert.equal(reused.outgoing, 1);
  await page.waitForFunction(() => !window.__wukongCodexForgeRuntimeV13.transitionInFlight);
  assert.equal((await page.evaluate(THEME_STATE_EXPRESSION)).backgroundLoadedLayerCount, 1);
  await page.evaluate(RESTORE_EXPRESSION);
});

test('V52.0 cancels a stale decode when manual intent returns to the visible scene', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-cancel-stale-decode.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-cancel-stale-decode.test/');
  await page.evaluate(expression);
  await waitForRuntime(page, 'scene', 0);
  const baseline = await currentBackground(page);
  await page.evaluate(() => {
    window.__forgeIntentDecodes = [];
    HTMLImageElement.prototype.decode = function () {
      return new Promise(resolve => window.__forgeIntentDecodes.push({ image: this, resolve }));
    };
  });

  assert.equal(await page.evaluate(() => (
    window.__wukongCodexForgeRuntimeV13.nextBackground('battle')
  )), true);
  await page.waitForFunction(() => window.__forgeIntentDecodes.length === 1);
  assert.equal(await page.evaluate(() => (
    window.__wukongCodexForgeRuntimeV13.previousBackground('battle')
  )), true);
  await page.waitForFunction(() => window.__wukongCodexForgeRuntimeV13.preloadRequests.size === 0);
  await page.evaluate(() => window.__forgeIntentDecodes[0].resolve());
  await page.waitForTimeout(120);

  const settled = await page.evaluate(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const inactive = document.querySelector('[data-forge-background-layer][data-forge-active="false"]');
    const image = inactive.querySelector('[data-forge-background-image]');
    return {
      scene: String(runtime.currentScene),
      renderCount: runtime.renderCount,
      requested: runtime.requestedScene,
      pending: runtime.pendingSceneStyle,
      inactiveSource: image.getAttribute('src'),
      inactiveDecoded: image.dataset.forgeDecoded === 'true'
    };
  });
  assert.deepEqual(settled, {
    scene: baseline.scene,
    renderCount: baseline.renderCount,
    requested: null,
    pending: null,
    inactiveSource: null,
    inactiveDecoded: false
  });
  await page.evaluate(RESTORE_EXPRESSION);
});

test('V52.0 keeps the visible scene when image decode rejects', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-rejected-decode.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-rejected-decode.test/');
  await page.evaluate(expression);
  await waitForRuntime(page, 'scene', 0);
  const baseline = await currentBackground(page);
  await page.evaluate(() => {
    HTMLImageElement.prototype.decode = () => Promise.reject(new Error('synthetic decode failure'));
  });
  await page.keyboard.press('Control+Alt+F');
  await page.waitForFunction(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    return runtime.preloadRequests.size === 0 && runtime.requestedScene === null;
  });
  await page.waitForTimeout(100);
  const settled = await page.evaluate(() => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const inactive = document.querySelector('[data-forge-background-layer][data-forge-active="false"]');
    const image = inactive.querySelector('[data-forge-background-image]');
    return {
      scene: String(runtime.currentScene),
      renderCount: runtime.renderCount,
      transitioning: runtime.transitionInFlight,
      inactiveSource: image.getAttribute('src')
    };
  });
  assert.deepEqual(settled, {
    scene: baseline.scene,
    renderCount: baseline.renderCount,
    transitioning: false,
    inactiveSource: null
  });
  await page.evaluate(RESTORE_EXPRESSION);
});

test('V13 bounds pending background decoding to one request and cancels it on replacement and restore', async () => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  await page.route('http://wukong-loader.test/**', route => route.fulfill({ body: runtimeFixtureHtml, contentType: 'text/html; charset=utf-8' }));
  await page.goto('http://wukong-loader.test/');
  await page.evaluate(() => {
    window.__forgeDecodeControls = [];
    HTMLImageElement.prototype.decode = function () {
      return new Promise(resolve => window.__forgeDecodeControls.push({ image: this, resolve }));
    };
  });
  const initialApply = page.evaluate(expression);
  await page.waitForFunction(() => window.__forgeDecodeControls?.length === 1);
  await page.evaluate(() => window.__forgeDecodeControls[0].resolve());
  await initialApply;
  assert.equal((await page.evaluate(THEME_STATE_EXPRESSION)).preloadInFlight, 0);

  await enterThreadState(page);
  await waitForRuntime(page, 'surface', 'thread');
  assert.equal((await page.evaluate(THEME_STATE_EXPRESSION)).preloadInFlight, 1);
  assert.equal(await page.evaluate(() => window.__forgeDecodeControls.length), 2);

  await installLanding(page);
  await waitForRuntime(page, 'surface', 'landing');
  assert.equal((await page.evaluate(THEME_STATE_EXPRESSION)).preloadInFlight, 0);
  assert.equal(await page.evaluate(() => window.__forgeDecodeControls.length), 2);
  assert.equal(await page.evaluate(() => Boolean(window.__forgeDecodeControls[1].image.getAttribute('src'))), false);

  await enterThreadState(page);
  await waitForRuntime(page, 'surface', 'thread');
  assert.equal((await page.evaluate(THEME_STATE_EXPRESSION)).preloadInFlight, 1);
  assert.equal(await page.evaluate(() => window.__forgeDecodeControls.length), 3);

  await page.evaluate(() => {
    window.__retiredForgeRuntime = window.__wukongCodexForgeRuntimeV13;
  });
  await page.evaluate(RESTORE_EXPRESSION);
  assert.deepEqual(
    await page.evaluate(() => ({
      pending: window.__retiredForgeRuntime.preloadRequests.size,
      images: window.__forgeDecodeControls.map(control => ({
        hasSource: Boolean(control.image.getAttribute('src')),
        onload: control.image.onload,
        onerror: control.image.onerror
      }))
    })),
    {
      pending: 0,
      images: [
        { hasSource: false, onload: null, onerror: null },
        { hasSource: false, onload: null, onerror: null },
        { hasSource: false, onload: null, onerror: null }
      ]
    }
  );
});

test('V51.7 keeps its background inert in forced-colors mode and accepts generated per-scene veils', async () => {
  assert.doesNotMatch(styleSheet, /html:root\.forge-ink-mountain\[data-forge-scene="0"\]/);
  const page = await browser.newPage({ viewport: { width: 1024, height: 700 } });
  await page.setContent(runtimeFixtureHtml);
  await page.evaluate(expression);
  const veil = await page.locator('html').evaluate(element => (
    getComputedStyle(element).getPropertyValue('--forge-scene-veil')
  ));
  assert.match(veil, /rgba\(12,14,13,(?:0)?\.3\)/);
  await page.emulateMedia({ forcedColors: 'active' });
  assert.equal(
    await page.locator('#wukong-forge-background').evaluate(element => getComputedStyle(element).display),
    'none'
  );
});
