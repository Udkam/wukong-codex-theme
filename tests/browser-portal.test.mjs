import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(path.join(repository, 'package.json'));
const { chromium } = require('@playwright/test');
const { PNG } = require('pngjs');
const theme = fs.readFileSync(path.join(repository, 'runtime/wukong-codex-theme-background-v13.css'), 'utf8');

const portalColor = [15, 180, 117];
const wallpaperColor = [38, 66, 94];
const rootControlColor = [229, 171, 52];
const wallpaper = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path fill="rgb(${wallpaperColor})" d="M0 0h16v16H0z"/></svg>`
);

// This is a stacking/paint fixture, not a loaded Electron guest. It preserves
// the relevant native topology: the wallpaper belongs to PageSurface below
// #root; the browser guest is a positioned body portal after #root. Native
// toolbar and modal controls retain their own stacking levels.
const background = `<div id="wukong-codex-theme-background">
  <div data-forge-background-layer data-forge-active="true">
    <img alt="" data-forge-background-image src="${wallpaper}">
    <div data-forge-background-veil></div>
  </div>
</div>`;
const fixture = (mode, placement) => `<!doctype html>
<html data-theme="${mode}" style="color-scheme:${mode}">
<head><style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 100%; height: 100%; }
  body { background: ${mode === 'dark' ? '#141414' : '#eee'}; }
  #root { width: 100%; height: 100svh; }
  [data-app-shell-page-surface] { position: absolute; inset: 12px; overflow: hidden; border-radius: 18px; }
  .native-page-paint { position: absolute; inset: 0; }
  #native-toolbar { position: absolute; z-index: 10; left: 24px; right: 24px; top: 24px; height: 44px; background: #263447; }
  #native-toolbar button { position: absolute; left: 12px; top: 8px; width: 80px; height: 28px; }
  #root-action { position: absolute; left: 80px; bottom: 14px; width: 160px; height: 20px; border: 0; padding: 0; background: rgb(${rootControlColor}); }
  #browser-portal-host { position: fixed; inset: 0; overflow: visible; pointer-events: none; }
  #browser-portal-containment { position: fixed; inset: 0; contain: paint; pointer-events: none; }
  #browser-portal { position: fixed; overflow: hidden; left: 36px; right: 36px; top: 96px; height: calc(100vh - 132px); z-index: auto; }
  webview { display: flex; visibility: visible; height: 100%; width: 100%; background: rgb(${portalColor}); pointer-events: auto; }
  #browser-action { position: absolute; left: 12px; top: 12px; width: 100px; height: 30px; }
  #native-modal { display: none; position: fixed; z-index: 50; left: 48px; right: 48px; top: 48px; height: 180px; background: #8b316d; }
  #modal-action { margin: 24px; width: 100px; height: 30px; }
  #native-modal[data-open] { display: block; }
</style></head><body>
  ${placement === 'body' ? background : ''}
  <div id="root">
    <main data-app-shell-page-surface>
      <div class="native-page-paint">
        ${placement === 'native-page' ? background : ''}
      </div>
    </main>
    <div id="native-toolbar"><button id="toolbar-action">Toolbar</button></div>
    <button id="root-action">Native root control</button>
  </div>
  <div id="browser-portal-host" data-embedded-frame-host-root><div id="browser-portal-containment" data-browser-host-root><div id="browser-portal" data-browser-sidebar-webview><webview id="browser-guest" class="h-full w-full"><button id="browser-action">Page action</button></webview></div></div></div>
  <div id="native-modal"><button id="modal-action">Modal action</button></div>
  <script>
    window.clicks = { browser: 0, toolbar: 0, root: 0, modal: 0 };
    document.querySelector('#browser-action').onclick = () => window.clicks.browser++;
    document.querySelector('#toolbar-action').onclick = () => window.clicks.toolbar++;
    document.querySelector('#root-action').onclick = () => window.clicks.root++;
    document.querySelector('#modal-action').onclick = () => window.clicks.modal++;
  </script>
</body></html>`;

const rectangle = page => page.locator('#browser-portal').evaluate(element => {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return { rect: [rect.x, rect.y, rect.width, rect.height], position: style.position, zIndex: style.zIndex };
});

const topAt = (page, x, y) => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x, y });
const rgbAt = (png, x, y) => [...png.data.subarray((png.width * y + x) * 4, (png.width * y + x) * 4 + 3)];

test('native browser body portal stays above wallpaper without changing its geometry', async t => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const placement of ['native-page', 'body']) {
      for (const mode of ['dark', 'light']) {
        for (const width of [720, 1280]) {
        await t.test(`${placement}, ${mode}, ${width}px`, async () => {
          const page = await browser.newPage({ viewport: { width, height: 720 }, colorScheme: mode });
          try {
            await page.setContent(fixture(mode, placement));
            await page.locator('[data-forge-background-image]').evaluate(image => image.decode());
            const nativeRectangle = await rectangle(page);
            const sample = { x: Math.floor(width / 2), y: 360 };
            assert.equal(await topAt(page, sample.x, sample.y), 'browser-guest', 'fixture must start with the native guest exposed');

            await page.addStyleTag({ content: theme });
            await page.evaluate(({ mode, placement }) => {
              const root = document.documentElement;
              root.classList.add('forge-ink-mountain');
              root.dataset.forgeNativeTheme = mode;
              root.dataset.forgeBackgroundReady = 'true';
              root.dataset.forgeBackgroundPlacement = placement;
              root.dataset.forgeSurface = 'landing';
            }, { mode, placement });

            assert.deepEqual(await rectangle(page), nativeRectangle, 'theme must retain native portal coordinates, size and stacking declaration');
            assert.equal(await topAt(page, sample.x, sample.y), 'browser-guest', 'browser guest must receive hits above the PageSurface wallpaper');
            const screenshot = PNG.sync.read(await page.screenshot());
            assert.deepEqual(rgbAt(screenshot, sample.x, sample.y), portalColor, 'guest must actually paint, beyond CSS visibility flags');
            assert.deepEqual(rgbAt(screenshot, 20, 360), wallpaperColor, 'wallpaper must remain visible in the native outer gutter');
            assert.deepEqual(rgbAt(screenshot, 230, 696), rootControlColor, 'native root content must paint above wallpaper, including body fallback');
            assert.equal(await topAt(page, 230, 696), 'root-action', 'wallpaper must not cover native root controls');
            assert.equal(await page.locator('#wukong-codex-theme-background').evaluate(element => getComputedStyle(element).pointerEvents), 'none');

            await page.locator('#browser-action').click({ timeout: 2000 });
            await page.locator('#toolbar-action').click({ timeout: 2000 });
            await page.locator('#root-action').click({ timeout: 2000 });
            assert.deepEqual(await page.evaluate(() => window.clicks), { browser: 1, toolbar: 1, root: 1, modal: 0 }, 'native toolbar, root content and guest actions remain interactive');

            // Exercise an overlapping native portal. It must stay above both
            // the browser guest and the toolbar after the root-context fix.
            await page.locator('#native-modal').evaluate(element => element.setAttribute('data-open', ''));
            assert.equal(await topAt(page, 160, 58), 'native-modal', 'modal must cover the overlapping toolbar');
            assert.equal(await topAt(page, sample.x, 180), 'native-modal', 'modal must cover the overlapping browser');
            await page.locator('#modal-action').click({ timeout: 2000 });
            assert.equal(await page.evaluate(() => window.clicks.modal), 1);
            await page.locator('#native-modal').evaluate(element => element.removeAttribute('data-open'));

            // Negative control: the old root context must visibly obscure
            // this exact fixture. Otherwise the regression test is insensitive.
            if (placement === 'native-page') {
              const oldRootContext = await page.addStyleTag({ content: ':root.forge-ink-mountain #root { z-index: 1 !important; }' });
              assert.notEqual(await topAt(page, sample.x, sample.y), 'browser-guest', 'old CSS must reproduce the hidden guest');
              const hiddenScreenshot = PNG.sync.read(await page.screenshot());
              assert.deepEqual(rgbAt(hiddenScreenshot, sample.x, sample.y), wallpaperColor, 'old CSS must paint wallpaper over the guest');
              assert.deepEqual(await rectangle(page), nativeRectangle, 'the reproduced failure is paint order, not a changed portal rectangle');
              await oldRootContext.evaluate(element => element.remove());
              assert.equal(await topAt(page, sample.x, sample.y), 'browser-guest', 'removing the old stacking context must restore the guest');
            }
          } finally {
            await page.close();
          }
        });
        }
      }
    }
  } finally {
    await browser.close();
  }
});
