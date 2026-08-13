import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from '@playwright/test';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';
import { makeApplyExpression, RESTORE_EXPRESSION } from '../runtime/injection-plan.mjs';
import {
  runtimeFixtureHtml,
  enterThreadState,
  geometry,
  conversationGeometry,
  conversationText
} from './runtime-fixture.mjs';

// V11 visual assertions are retained as executable history. V12 deliberately
// rolls these surface replacements back; see background-runtime-v12.test.mjs.
const test = nodeTest.skip;

const averageLuminance = (png, box) => {
  let total = 0;
  let count = 0;
  for (let y = box.y; y < box.y + box.height; y += 8) {
    for (let x = box.x; x < box.x + box.width; x += 8) {
      const index = (png.width * y + x) * 4;
      total += png.data[index] * .2126 + png.data[index + 1] * .7152 + png.data[index + 2] * .0722;
      count++;
    }
  }
  return total / count;
};

test('Wukong style visibly replaces background, navigation and composer without moving native slots', async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(runtimeFixtureHtml);
  const nativeGeometry = await geometry(page);
  const nativeBodyChildren = await page.locator('body > *').count();
  const nativeBodyText = await page.locator('body').innerText();
  const nativeShapes = await page.evaluate(() => ({
    composerRadius: getComputedStyle(document.querySelector('.composer-native')).borderRadius,
    sidebarRadius: getComputedStyle(document.querySelector('.sidebar-row')).borderRadius,
    rightCardRadius: getComputedStyle(document.querySelector('.summary-panel-card')).borderRadius,
    sendRadius: getComputedStyle(document.querySelector('.send')).borderRadius
  }));
  const payload = payloadFromThemeFile(fileURLToPath(new URL('../themes/active.json', import.meta.url)));
  const styleSheet = fs.readFileSync(new URL('../runtime/forge-theme.css', import.meta.url), 'utf8');
  assert.doesNotMatch(styleSheet, /forge-motif-(?:yaksha|fanged-cyan)/);
  await page.evaluate(makeApplyExpression({ styleSheet, variables: payload.variables }));

  const landingStyles = await page.evaluate(() => ({
    scene: document.documentElement.dataset.forgeScene,
    mode: document.documentElement.dataset.forgeMode,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    bodyBackground: getComputedStyle(document.body).backgroundImage,
    fullScreenBackground: getComputedStyle(document.body, '::before').backgroundImage,
    fullScreenBackgroundSize: getComputedStyle(document.body, '::before').backgroundSize,
    fullScreenBackgroundPosition: getComputedStyle(document.body, '::before').position,
    fullScreenVeil: getComputedStyle(document.body, '::after').backgroundImage,
    workspaceBackground: getComputedStyle(document.querySelector('.forge-workspace')).backgroundImage,
    composerRadius: getComputedStyle(document.querySelector('.forge-composer')).borderRadius,
    composerFrame: getComputedStyle(document.querySelector('.forge-composer'), '::before').content,
    composerBackground: getComputedStyle(document.querySelector('.forge-composer')).backgroundImage,
    xiangfeiMaterial: getComputedStyle(document.querySelector('[data-forge-motif="xiangfei-gourd"]')).backgroundImage,
    xiangfeiPointerEvents: getComputedStyle(document.querySelector('[data-forge-motif="xiangfei-gourd"]')).pointerEvents,
    xiangfeiPlacement: document.querySelector('[data-forge-motif="xiangfei-gourd"]').dataset.forgePlacement,
    sidebarDecoration: getComputedStyle(document.querySelector('.forge-new-task'), '::after').content,
    environmentDecoration: getComputedStyle(document.querySelector('.forge-right-card'), '::after').content,
    gourdSafe: document.documentElement.dataset.forgeGourdSafe,
    newTaskShape: getComputedStyle(document.querySelector('.forge-new-task'), '::before').clipPath,
    sidebarShape: getComputedStyle(document.querySelector('.forge-sidebar-action'), '::before').clipPath,
    landingSeal: getComputedStyle(document.querySelector('.forge-landing-title'), '::before').backgroundImage,
    sidebarIconRing: getComputedStyle(document.querySelector('.forge-sidebar-action > :first-child')).boxShadow,
    rightCardRadius: getComputedStyle(document.querySelector('.forge-right-card')).borderRadius,
    rightCardShape: getComputedStyle(document.querySelector('.forge-right-card'), '::before').clipPath,
    sendRadius: getComputedStyle(document.querySelector('.forge-composer button[type="submit"]')).borderRadius,
    sendShape: getComputedStyle(document.querySelector('.forge-composer button[type="submit"]')).clipPath,
    composerWidth: document.querySelector('.forge-composer').getBoundingClientRect().width
  }));
  assert.equal(landingStyles.scene, '0');
  assert.equal(landingStyles.mode, 'battle');
  assert.equal(landingStyles.colorScheme, 'dark');
  assert.equal(landingStyles.bodyBackground, 'none');
  assert.match(landingStyles.fullScreenBackground, /data:image\/jpeg/);
  assert.equal(landingStyles.fullScreenBackgroundSize, 'cover');
  assert.equal(landingStyles.fullScreenBackgroundPosition, 'fixed');
  assert.notEqual(landingStyles.fullScreenVeil, 'none');
  assert.equal(landingStyles.workspaceBackground, 'none');
  assert.equal(landingStyles.composerBackground, 'none');
  assert.match(landingStyles.xiangfeiMaterial, /data:image\/webp/);
  assert.equal(landingStyles.xiangfeiPointerEvents, 'none');
  assert.doesNotMatch(landingStyles.xiangfeiPlacement, /composer/i);
  assert.notEqual(landingStyles.sidebarDecoration, 'none');
  assert.notEqual(landingStyles.environmentDecoration, 'none');
  assert.equal(landingStyles.gourdSafe, 'true');
  assert.notEqual(landingStyles.composerRadius, nativeShapes.composerRadius);
  assert.notEqual(landingStyles.composerFrame, 'none');
  assert.notEqual(landingStyles.newTaskShape, 'none');
  assert.notEqual(landingStyles.sidebarShape, 'none');
  assert.equal(landingStyles.landingSeal, 'none');
  assert.equal(landingStyles.sidebarIconRing, 'none');
  assert.notEqual(landingStyles.rightCardRadius, nativeShapes.rightCardRadius);
  assert.notEqual(landingStyles.rightCardShape, 'none');
  assert.notEqual(landingStyles.sendRadius, nativeShapes.sendRadius);
  assert.notEqual(landingStyles.sendShape, 'none');
  assert.equal(landingStyles.composerWidth, 736);
  assert.deepEqual(await geometry(page), nativeGeometry);
  assert.equal(await page.locator('body > *').count(), nativeBodyChildren + 1);
  assert.equal(await page.locator('body').innerText(), nativeBodyText);
  assert.equal(await page.locator('body > #wukong-forge-motif-overlay[data-forge-owned="motif-overlay"]').count(), 1);
  assert.equal(await page.locator('[data-forge-pet]').count(), 0);
  assert.equal(await page.locator('.summary-panel-card.forge-right-card').count(), 1);
  assert.equal(await page.locator('.summary-heading.forge-right-title').count(), 1);
  assert.equal(await page.locator('.summary-row.forge-right-row').count(), 4);

  const landingBuffer = await page.screenshot();
  const landing = PNG.sync.read(landingBuffer);
  const authored = await enterThreadState(page);
  await page.waitForTimeout(760);
  const threadStyles = await page.evaluate(() => ({
    scene: document.documentElement.dataset.forgeScene,
    mode: document.documentElement.dataset.forgeMode,
    fullScreenBackground: getComputedStyle(document.body, '::before').backgroundImage,
    workspaceBackground: getComputedStyle(document.querySelector('.forge-workspace')).backgroundImage
  }));
  assert.equal(threadStyles.mode, 'scenery');
  assert.ok(['6', '7', '8', '9', '10'].includes(threadStyles.scene));
  assert.notEqual(threadStyles.fullScreenBackground, landingStyles.fullScreenBackground);
  assert.equal(threadStyles.workspaceBackground, 'none');
  const threadBuffer = await page.screenshot();
  const thread = PNG.sync.read(threadBuffer);
  assert.deepEqual(await geometry(page), nativeGeometry);
  assert.deepEqual(await conversationGeometry(page), authored.geometry);
  assert.equal(await conversationText(page), authored.text);

  const assistantFrame = await page.locator('[data-local-conversation-final-assistant].forge-assistant-message').evaluate(element => {
    const style = getComputedStyle(element);
    return [style.backgroundImage, style.backgroundColor, style.borderColor, style.boxShadow];
  });
  assert.deepEqual(assistantFrame, ['none', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)', 'none']);

  const artBox = { x: 560, y: 92, width: 650, height: 470 };
  const landingLight = averageLuminance(landing, artBox);
  const threadLight = averageLuminance(thread, artBox);
  assert.ok(landingLight > 65 && landingLight < 175, `landing must remain balanced, not black or bleached: ${landingLight.toFixed(2)}`);
  assert.ok(threadLight > 45 && threadLight < 145, `thread must remain balanced, not black or bleached: ${threadLight.toFixed(2)}`);
  assert.ok(Math.abs(landingLight - threadLight) > 5, `landing and thread should remain visually distinct: ${landingLight.toFixed(2)} vs ${threadLight.toFixed(2)}`);

  await page.evaluate(RESTORE_EXPRESSION);
  const restored = await page.evaluate(() => ({
    backgroundImage: getComputedStyle(document.body).backgroundImage,
    workspaceBackground: getComputedStyle(document.querySelector('main')).backgroundImage,
    rootClass: document.documentElement.classList.contains('forge-ink-mountain'),
    stylePresent: Boolean(document.getElementById('wukong-codex-theme-style')),
    scene: document.documentElement.dataset.forgeScene || null,
    mode: document.documentElement.dataset.forgeMode || null,
    motifLayerPresent: Boolean(document.getElementById('wukong-forge-motif-overlay'))
  }));
  assert.deepEqual(restored, {
    backgroundImage: 'none',
    workspaceBackground: 'none',
    rootClass: false,
    stylePresent: false,
    scene: null,
    mode: null,
    motifLayerPresent: false
  });
});
