import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { SCENE_TONES, cssFor, validateTheme } from '../shared/theme-model.mjs';

const active = JSON.parse(fs.readFileSync('themes/active.json', 'utf8').replace(/^\uFEFF/, ''));
const backgroundStyleSheet = fs.readFileSync('runtime/forge-background-v13.css', 'utf8');

const rgb = hex => [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
const luminance = color => {
  const linear = color.map(channel => {
    const unit = channel / 255;
    return unit <= .04045 ? unit / 12.92 : ((unit + .055) / 1.055) ** 2.4;
  });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
};
const contrast = (left, right) => {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
};

test('all twenty numbered cinematic scenes declare a validated adaptive tone and project veil', () => {
  assert.equal(active.schemaVersion, 3);
  assert.equal(active.background.gallery.length, 20);
  assert.equal(new Set(active.background.gallery.map(scene => scene.slot)).size, 20);
  assert.doesNotThrow(() => validateTheme(active));
  assert.equal(
    active.background.gallery.some(scene => Number.parseInt(scene.slot.slice(1), 10) !== scene.order),
    true,
    'stable scene slots must be allowed to differ from playback order'
  );
  for (const scene of active.background.gallery) {
    const tone = SCENE_TONES[scene.tone];
    assert.equal(typeof scene.threadVeil, 'number', `${scene.id} is missing threadVeil`);
    assert.ok(scene.threadVeil >= 0 && scene.threadVeil <= 1, `${scene.id} threadVeil is outside 0..1`);
    for (const key of ['ink', 'inkSoft', 'lacquer', 'jade', 'jadeLight', 'gold', 'goldLight', 'paper', 'composer', 'sidebar', 'rightCard', 'veil', 'brightness']) {
      assert.ok(tone[key], `${scene.id} is missing ${key}`);
    }
  }
  const invalid = structuredClone(active);
  delete invalid.background.gallery[3].tone;
  assert.throws(() => validateTheme(invalid), /Invalid background\.gallery entry/);
  const invalidSequence = structuredClone(active);
  invalidSequence.background.gallery.find(scene => scene.slot === 'B16').order = 12;
  assert.throws(() => validateTheme(invalidSequence), /Invalid background\.gallery/);
  const invalidThreadVeil = structuredClone(active);
  invalidThreadVeil.background.gallery[0].threadVeil = 1.01;
  assert.throws(() => validateTheme(invalidThreadVeil), /Invalid background\.gallery entry/);
  assert.equal(active.background.gallery[0].position, '68% center');
});

test('landing retains 90% colour and project threads use per-image veils while local panels preserve copy contrast', () => {
  assert.match(backgroundStyleSheet, /--forge-landing-color-retention:\s*\.9\s*;/);
  assert.match(backgroundStyleSheet, /--forge-thread-color-retention:\s*\.75\s*;/);
  assert.match(
    backgroundStyleSheet,
    /\[data-forge-surface="landing"\][^{]*\{[^}]*opacity:\s*calc\(1\s*-\s*var\(--forge-landing-color-retention\)\)/s
  );
  assert.match(
    backgroundStyleSheet,
    /\[data-forge-surface="thread"\][^{]*\{[^}]*opacity:\s*var\(\s*--forge-layer-thread-veil,\s*calc\(1\s*-\s*var\(--forge-thread-color-retention\)\)\s*\)/s
  );
  for (const scene of active.background.gallery) {
    const tone = SCENE_TONES[scene.tone];
    for (const surface of ['composer', 'sidebar', 'rightCard']) {
      const ratio = contrast(rgb(tone.ink), rgb(tone[surface][0]));
      assert.ok(
        ratio >= 4.5,
        `${scene.id} ${surface} primary copy contrast is ${ratio.toFixed(2)}:1`
      );
    }
  }
});

test('scene switching updates image, shell surfaces and text minerals together', async t => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const assets = active.background.gallery.map((scene, index) => ({
    ...scene,
    url: `data:image/jpeg;base64,${Buffer.from(String(index)).toString('base64')}`
  }));
  const variables = cssFor(active, assets, {});
  await page.setContent('<style id="theme"></style>');
  await page.evaluate(css => {
    document.getElementById('theme').textContent = css;
    document.documentElement.classList.add('forge-ink-mountain');
  }, variables);

  const states = [];
  for (let index = 0; index < active.background.gallery.length; index += 1) {
    states.push(await page.evaluate(scene => {
      document.documentElement.dataset.forgeScene = String(scene);
      const style = getComputedStyle(document.documentElement);
      return {
        ink: style.getPropertyValue('--forge-ink').trim(),
        paper: style.getPropertyValue('--forge-paper').trim(),
        sidebar: style.getPropertyValue('--forge-sidebar-bg').trim(),
        composer: style.getPropertyValue('--forge-composer-bg').trim(),
        rightCard: style.getPropertyValue('--forge-right-card-bg').trim(),
        sceneVeil: style.getPropertyValue('--forge-scene-veil').trim(),
        sceneThreadVeil: Number(style.getPropertyValue('--forge-scene-thread-veil')),
        sceneBrightness: style.getPropertyValue('--forge-scene-brightness').trim(),
        sceneSlot: style.getPropertyValue('--forge-scene-slot').trim(),
        sceneOrder: Number(style.getPropertyValue('--forge-scene-order')),
        sceneBackground: style.getPropertyValue('--forge-scene-bg').trim()
      };
    }, index));
  }

  assert.ok(new Set(states.map(state => state.composer)).size >= 9);
  assert.ok(new Set(states.map(state => state.sidebar)).size >= 9);
  assert.ok(new Set(states.map(state => state.rightCard)).size >= 9);
  assert.ok(new Set(states.map(state => state.paper)).size >= 9);
  states.forEach((state, index) => {
    const tone = SCENE_TONES[active.background.gallery[index].tone];
    assert.equal(state.ink, tone.ink);
    assert.equal(state.paper, tone.paper);
    assert.match(state.sceneVeil, /linear-gradient/);
    assert.equal(state.sceneThreadVeil, active.background.gallery[index].threadVeil);
    assert.equal(Number(state.sceneBrightness), tone.brightness);
    assert.equal(state.sceneSlot, active.background.gallery[index].slot);
    assert.equal(state.sceneOrder, active.background.gallery[index].order);
    assert.match(state.sceneBackground, /data:image\/jpeg/);
  });
});
