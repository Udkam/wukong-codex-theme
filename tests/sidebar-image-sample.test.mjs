import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { makeApplyExpression, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const blue = [36, 102, 168], red = [190, 52, 46];
const image = (color, outliers = false) => {
  const png = new PNG({ width: 1100, height: 700 });
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    const rgb = outliers && y < 70 ? [0, 0, 0] : outliers && y >= 630 ? [255, 255, 255] : color;
    const offset = (y * png.width + x) * 4;
    for (let channel = 0; channel < 3; channel++) png.data[offset + channel] = rgb[channel];
    png.data[offset + 3] = 255;
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`;
};

test('sidebar RGB follows decoded wallpaper midtones, reuses the sample cache and clears on dispose and restore', async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  try {
    await page.setContent(`<html data-theme="dark"><style>html,body{margin:0;height:100%}aside{position:absolute;left:0;top:0;width:275px;height:700px;display:flex}.sidebar-navigation{width:100%;height:100%}main{height:700px}</style>
      <aside class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><div data-sidebar-navigation-root class="sidebar-navigation">Fixture navigation</div></aside>
      <main><div data-thread-find-target="conversation">Fixture content</div></main></html>`);
    const variables = `:root.forge-ink-mountain{--forge-background-transition:0ms;--forge-scene-count:2;--forge-battle-scenes:0 1;--forge-scenery-scenes:0 1;--forge-bg-0:url("${image(blue, true)}");--forge-bg-1:url("${image(red)}");}`;
    await page.evaluate(makeApplyExpression({ styleSheet: theme, variables }));
    await page.waitForFunction(() => window.__wukongCodexThemeRuntimeV13?.shellSample?.rgb &&
      window.__wukongCodexThemeRuntimeV13.shellSampleCount === 1);
    const read = () => page.evaluate(() => {
      const runtime = window.__wukongCodexThemeRuntimeV13;
      return { sample: runtime.shellSample, count: runtime.shellSampleCount,
        color: document.documentElement.style.getPropertyValue('--forge-sidebar-sampled-color') };
    });
    const first = await read();
    assert.deepEqual(first.sample.rgb, blue, 'The actual decoded black/blue/white PNG uses its blue middle range rather than its raw mean');
    assert.equal(first.color, 'rgb(36, 102, 168)');
    assert.equal(first.sample.samples, 24 * 64);
    assert.equal(first.sample.dark, .436, 'The existing high-percentile dark alpha formula is unchanged');
    assert.equal(first.sample.light, .304, 'The existing low-percentile light alpha formula is unchanged');
    await page.evaluate(() => {
      const runtime = window.__wukongCodexThemeRuntimeV13;
      for (let i = 0; i < 5; i++) runtime.refresh();
      document.documentElement.dataset.theme = 'light';
    });
    await page.waitForFunction(() => document.documentElement.dataset.forgeNativeTheme === 'light');
    assert.deepEqual(await read(), first, 'Refresh and native theme switching reuse the decoded image sample');
    await page.evaluate(() => window.__wukongCodexThemeRuntimeV13.nextBackground());
    await page.waitForFunction(() => window.__wukongCodexThemeRuntimeV13.shellSampleCount === 2 &&
      !window.__wukongCodexThemeRuntimeV13.transitionInFlight);
    const second = await read();
    assert.deepEqual(second.sample.rgb, red, 'A second actual decoded PNG changes the sampled colour');
    assert.equal(second.color, 'rgb(190, 52, 46)');
    assert.equal(second.sample.dark, .411);
    assert.equal(second.sample.light, .318);
    await page.evaluate(() => { for (let i = 0; i < 5; i++) window.__wukongCodexThemeRuntimeV13.refresh(); });
    assert.deepEqual(await read(), second, 'The new committed image is sampled only once');
    await page.evaluate(() => window.__wukongCodexThemeRuntimeV13.dispose());
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--forge-sidebar-sampled-color')), '');
    // Explicit restore also handles a stale owned variable when its runtime
    // object is already gone. No extra sampler or account flow participates.
    await page.evaluate(() => {
      delete window.__wukongCodexThemeRuntimeV13;
      document.documentElement.style.setProperty('--forge-sidebar-sampled-color', 'rgb(1, 2, 3)');
    });
    await page.evaluate(RESTORE_EXPRESSION);
    assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--forge-sidebar-sampled-color')), '');
  } finally {
    await page.evaluate(RESTORE_EXPRESSION).catch(() => {});
    await browser.close();
  }
});
