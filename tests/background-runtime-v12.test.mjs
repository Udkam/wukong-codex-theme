import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';
import {
  isActiveThemeState,
  isNativeThemeState,
  makeApplyExpression,
  RESTORE_EXPRESSION,
  THEME_STATE_EXPRESSION
} from '../runtime/injection-plan-v12.mjs';
import {
  runtimeFixtureHtml,
  enterThreadState,
  geometry,
  conversationGeometry,
  conversationText
} from './runtime-fixture.mjs';

const styleSheet = fs.readFileSync(new URL('../runtime/forge-background-v12.css', import.meta.url), 'utf8');
const payload = payloadFromThemeFile(fileURLToPath(new URL('../themes/active.json', import.meta.url)));
const activeTheme = JSON.parse(fs.readFileSync(new URL('../themes/active.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const expression = makeApplyExpression({ styleSheet, variables: payload.variables });
const payloadSceneIds = name => {
  const value = payload.variables.match(new RegExp(`${name}:([^;]+)`))?.[1] || '';
  return value.trim().split(/\s+/).filter(Boolean);
};
const battleSceneIds = payloadSceneIds('--forge-battle-scenes');
const scenerySceneIds = payloadSceneIds('--forge-scenery-scenes');
const firstBattleScene = activeTheme.background.gallery[Number(battleSceneIds[0])];
const computedPosition = value => String(value)
  .split(/\s+/)
  .map(token => ({ left: '0%', center: '50%', right: '100%', top: '0%', bottom: '100%' })[token] || token)
  .join(' ');

const nativeSurfaceStyle = page => page.evaluate(() => {
  const read = selector => {
    const style = getComputedStyle(document.querySelector(selector));
    return {
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
      clipPath: style.clipPath,
      color: style.color,
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
      <div class="landing-hero" data-feature="game-source">
        <small>新建任务</small>
        <h1 class="heading-xl">今天想处理什么？</h1>
        <p>描述目标，Codex 会在当前项目中开始工作。</p>
      </div>`;
    document.querySelector('.route-host').insertBefore(landing, document.querySelector('.thread-summary-layer'));
  }
});

test('V12 changes only the full-window background carriers and preserves native surfaces', async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.setContent(runtimeFixtureHtml);
  const beforeGeometry = await geometry(page);
  const beforeStyle = await nativeSurfaceStyle(page);
  const beforeText = await page.locator('body').innerText();
  const beforeBodyChildren = await page.locator('body > *').count();

  await page.evaluate(expression);
  const activeState = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(isActiveThemeState(activeState), true);
  assert.equal(activeState.mode, 'battle');
  assert.equal(activeState.scene, battleSceneIds[0]);
  assert.equal(activeState.backgroundLayerPresent, true);
  assert.equal(activeState.backgroundLayerCount, 2);
  assert.equal(activeState.motifLayerPresent, false);
  assert.deepEqual(await geometry(page), beforeGeometry);
  assert.deepEqual(await nativeSurfaceStyle(page), beforeStyle);
  assert.equal(await page.locator('body').innerText(), beforeText);
  assert.equal(await page.locator('body > *').count(), beforeBodyChildren + 1);
  assert.equal(await page.locator('#wukong-forge-motif-overlay').count(), 0);
  assert.equal(await page.locator('[data-forge-pet]').count(), 0);
  assert.equal(await page.locator('.forge-sidebar,.forge-sidebar-action,.forge-right-card,.forge-button').count(), 0);
  assert.equal(await page.locator('.forge-workspace').count(), 1);
  assert.equal(await page.locator('.forge-composer').count(), 1);
  assert.equal(await page.locator('.forge-input').count(), 1);

  const background = await page.evaluate(() => {
    const overlay = document.getElementById('wukong-forge-background');
    const active = overlay.querySelector('[data-forge-background-layer][data-forge-active="true"]');
    const image = active.querySelector('[data-forge-background-image]');
    const overlayStyle = getComputedStyle(overlay);
    const layerStyle = getComputedStyle(active);
    const imageStyle = getComputedStyle(image);
    return {
      position: overlayStyle.position,
      inset: overlayStyle.inset,
      pointerEvents: overlayStyle.pointerEvents,
      transitionDuration: layerStyle.transitionDuration,
      backgroundImage: imageStyle.backgroundImage,
      backgroundSize: imageStyle.backgroundSize,
      backgroundPosition: imageStyle.backgroundPosition
    };
  });
  assert.equal(background.position, 'fixed');
  assert.equal(background.inset, '0px');
  assert.equal(background.pointerEvents, 'none');
  assert.equal(background.transitionDuration, '0.82s');
  assert.match(background.backgroundImage, /data:image\/jpeg/);
  assert.equal(background.backgroundSize, 'cover');
  assert.equal(background.backgroundPosition, computedPosition(firstBattleScene.position));

  const authored = await enterThreadState(page);
  await page.waitForTimeout(760);
  assert.equal(await page.locator('html').getAttribute('data-forge-mode'), 'scenery');
  assert.equal(await page.locator('html').getAttribute('data-forge-scene'), scenerySceneIds[0]);
  assert.deepEqual(await geometry(page), beforeGeometry);
  assert.deepEqual(await nativeSurfaceStyle(page), beforeStyle);
  assert.deepEqual(await conversationGeometry(page), authored.geometry);
  assert.equal(await conversationText(page), authored.text);

  await page.evaluate(RESTORE_EXPRESSION);
  const nativeState = await page.evaluate(THEME_STATE_EXPRESSION);
  assert.equal(isNativeThemeState(nativeState), true);
  assert.equal(await page.locator('#wukong-forge-background').count(), 0);
  assert.deepEqual(await nativeSurfaceStyle(page), beforeStyle);
});

test('V12 rotates through every active battle and scenery image in separate state pools', async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.setContent(runtimeFixtureHtml);
  await page.evaluate(expression);

  const battleScenes = [await page.locator('html').getAttribute('data-forge-scene')];
  const sceneryScenes = [];
  const activeLayers = [await page.locator('#wukong-forge-background').getAttribute('data-forge-active-layer')];
  const transitionCount = Math.max(battleSceneIds.length - 1, scenerySceneIds.length);
  for (let index = 0; index < transitionCount; index += 1) {
    await enterThreadState(page);
    await page.evaluate(() => window.__wukongCodexForgeRuntimeV12.refresh());
    if (sceneryScenes.length < scenerySceneIds.length) {
      sceneryScenes.push(await page.locator('html').getAttribute('data-forge-scene'));
    }
    activeLayers.push(await page.locator('#wukong-forge-background').getAttribute('data-forge-active-layer'));

    await installLanding(page);
    await page.evaluate(() => window.__wukongCodexForgeRuntimeV12.refresh());
    if (battleScenes.length < battleSceneIds.length) {
      battleScenes.push(await page.locator('html').getAttribute('data-forge-scene'));
    }
    activeLayers.push(await page.locator('#wukong-forge-background').getAttribute('data-forge-active-layer'));
  }

  assert.deepEqual(battleScenes, battleSceneIds);
  assert.deepEqual(sceneryScenes, scenerySceneIds);
  for (let index = 1; index < activeLayers.length; index += 1) {
    assert.notEqual(activeLayers[index], activeLayers[index - 1], 'background layer did not crossfade');
  }
  assert.equal(new Set(battleScenes).size, battleSceneIds.length);
  assert.equal(new Set(sceneryScenes).size, scenerySceneIds.length);
});

test('V12 transition is disabled for reduced motion and background is inert in forced colors', async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, reducedMotion: 'reduce' });
  await page.setContent(runtimeFixtureHtml);
  await page.evaluate(expression);
  const reduced = await page.locator('[data-forge-background-layer="0"]').evaluate(element => ({
    duration: getComputedStyle(element).transitionDuration,
    ariaHidden: element.parentElement.getAttribute('aria-hidden'),
    inert: element.parentElement.getAttribute('inert')
  }));
  assert.equal(reduced.duration, '0s');
  assert.equal(reduced.ariaHidden, 'true');
  assert.equal(reduced.inert, '');

  await page.emulateMedia({ forcedColors: 'active' });
  assert.equal(
    await page.locator('#wukong-forge-background').evaluate(element => getComputedStyle(element).display),
    'none'
  );
});
