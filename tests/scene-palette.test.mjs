import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { SCENE_TONES, cssFor, validateTheme } from '../shared/theme-model.mjs';

const active = JSON.parse(fs.readFileSync('themes/active.json', 'utf8').replace(/^\uFEFF/, ''));

const rgb = hex => [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16));
const blend = (under, over, alpha) => under.map((channel, index) => channel * (1 - alpha) + over[index] * alpha);
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

test('all twenty-two numbered cinematic scenes declare a validated adaptive tone', () => {
  assert.equal(active.schemaVersion, 3);
  assert.equal(active.background.gallery.length, 22);
  assert.equal(new Set(active.background.gallery.map(scene => scene.slot)).size, 22);
  assert.doesNotThrow(() => validateTheme(active));
  assert.equal(
    active.background.gallery.some(scene => Number.parseInt(scene.slot.slice(1), 10) !== scene.order),
    true,
    'stable scene slots must be allowed to differ from playback order'
  );
  for (const scene of active.background.gallery) {
    const tone = SCENE_TONES[scene.tone];
    for (const key of ['ink', 'inkSoft', 'lacquer', 'jade', 'jadeLight', 'gold', 'goldLight', 'paper', 'composer', 'sidebar', 'rightCard', 'veil', 'brightness']) {
      assert.ok(tone[key], `${scene.id} is missing ${key}`);
    }
  }
  const invalid = structuredClone(active);
  delete invalid.background.gallery[3].tone;
  assert.throws(() => validateTheme(invalid), /Invalid background\.gallery entry/);
  const invalidSequence = structuredClone(active);
  invalidSequence.background.gallery.find(scene => scene.slot === 'B13').order = 12;
  assert.throws(() => validateTheme(invalidSequence), /Invalid background\.gallery/);
  assert.equal(active.background.gallery[0].position, '68% center');
});

test('all active scene veils preserve copy contrast while battle art remains lighter than scenery art', () => {
  const backdropLuminances = { battle: [], scenery: [] };
  for (const scene of active.background.gallery) {
    const tone = SCENE_TONES[scene.tone];
    const [, , toneCenter] = tone.veil;
    const sceneCenter = toneCenter * (scene.veil ?? 1);
    const scenery = scene.mode === 'scenery';
    const modeHorizontal = scenery ? ['#0c0f0d', .25] : ['#0c0e0d', .035];
    const modeVertical = scenery ? ['#0a0d0b', .12] : ['#0a0c0b', .018];
    let backdrop = [255, 255, 255];
    backdrop = blend(backdrop, rgb(tone.veil[0]), sceneCenter);
    backdrop = blend(backdrop, rgb(tone.veil[0]), sceneCenter);
    backdrop = blend(backdrop, rgb(modeVertical[0]), modeVertical[1]);
    backdrop = blend(backdrop, rgb(modeHorizontal[0]), modeHorizontal[1]);
    const ratio = contrast(rgb(tone.ink), backdrop);
    assert.ok(ratio >= 4.5, `${scene.id} primary copy contrast is ${ratio.toFixed(2)}:1`);
    const group = scenery ? 'scenery' : 'battle';
    backdropLuminances[group].push(luminance(backdrop));
  }
  const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(
    average(backdropLuminances.battle) > average(backdropLuminances.scenery),
    'battle backdrops must remain perceptually lighter than scenery backdrops'
  );
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
    assert.equal(Number(state.sceneBrightness), tone.brightness);
    assert.equal(state.sceneSlot, active.background.gallery[index].slot);
    assert.equal(state.sceneOrder, active.background.gallery[index].order);
    assert.match(state.sceneBackground, /data:image\/jpeg/);
  });
});
