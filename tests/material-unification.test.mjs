import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

const require = createRequire(import.meta.url);
const output = new URL('../artifacts/test-runs/native-boundary-20260920/', import.meta.url);
const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const structurePath = new URL('./fixtures/native-environment-classes.json', import.meta.url);
function loadNative() {
  try {
    const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
    const root = path.join(process.env.ProgramFiles, 'WindowsApps');
    const archive = fs.readdirSync(root).filter(name => /^OpenAI\.Codex_.*_x64__/.test(name))
      .map(name => path.join(root, name, 'app/resources/app.asar')).filter(fs.existsSync)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const css = asar.listPackage(archive)
      .filter(name => /webview[\\/]assets[\\/](app-shared-|app-initial-|app-primary-).*\.css$/.test(name))
      .map(name => asar.extractFile(archive, name.replace(/^[/\\]/, '')).toString('utf8')).join('\n');
    const effort = css.match(/\.(_ModelPickerTriggerEffortText_[\w]+)\[data-max-effort=true\]/)[1];
    return { archive, css, effort };
  } catch { return null; }
}
const native = loadNative();
const rgbAt = (png, x, y) => [...png.data.subarray((Math.round(y) * png.width + Math.round(x)) * 4, (Math.round(y) * png.width + Math.round(x)) * 4 + 3)];
const luminance = rgb => rgb.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05);
const parseRgb = value => value.match(/[\d.]+/g).slice(0, 3).map(Number);

test('component fixture: uniform summary paint, shared shells and accessible material fallbacks', {
  skip: native ? false : 'Installed client CSS unavailable'
}, async t => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1180, height: 920 }, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  const report = { kind: 'component fixture, not live application acceptance', archive: native.archive, visualAcceptance: false, modes: [], accessibility: [] };
  try {
    report.relativeColorWithOpaqueAlphaSupported = await page.evaluate(() => CSS.supports('background-color', 'rgb(from rgb(1 2 3 / .4) r g b / 1)'));
    assert.equal(report.relativeColorWithOpaqueAlphaSupported, true, 'Chromium must support the explicit opaque relative-colour fallback');
    // Sanitized native class names only; the fixture contains no captured user content.
    const classes = JSON.parse(fs.readFileSync(structurePath, 'utf8'));
    fs.mkdirSync(output, { recursive: true });
    const samples = [{ name: 'dark', color: 'rgb(12,20,28)' }, { name: 'middle', color: 'rgb(120,110,95)' }, { name: 'light', color: 'rgb(230,235,240)' }];
    const section = (index, label) => `<section class="${classes.section}"><header class="${classes.header}" data-header="${index}"><span>${label}</span></header><div class="${classes.body}" style="${classes.bodyStyle}" aria-hidden="false"><div class="${classes.rows}">${Array.from({ length: 11 }, (_, i) => `<button class="fixture-row ${classes.row} text-default" data-slot="thread-summary-panel-item-button"><span>测试项目 ${i + 1}</span>${i % 3 === 0 ? '<span class="text-success"> +128</span><span class="text-danger"> −64</span>' : ''}</button>`).join('')}</div></div></section>`;
    // The live client drives opacity/filter inline after its label transition.
    // These are the observed native resting values, not theme overrides.
    const cards = samples.map(sample => `<article class="sample" data-sample="${sample.name}" style="background:${sample.color}"><p class="fixture-label">${sample.name} backdrop · 组件夹具</p><div class="environment ${classes.root}"><div class="${classes.scroller}"><div class="${classes.stack}">${section(0, '环境信息')}${section(1, '来源')}</div></div></div><div class="contrast-card rounded-3xl bg-surface-elevated-secondary electron:elevation-prominent"><div class="text-default primary-sample">GPT-6 Astra <span class="${native.effort}" data-max-effort="true" style="opacity:1;filter:blur(0px)">Ultra</span></div><p class="text-secondary">原生辅助文字</p><span class="pixel-probe" aria-hidden="true"></span></div></article>`).join('');
    await page.setContent(`<html data-theme="dark" data-codex-os="win32" data-codex-window-type="electron" data-codex-window-chrome="application-menu"><head><style>${native.css}</style><style>
      :root { --color-text:rgb(212,212,212); --color-text-secondary:rgb(160,160,160); --color-chart-purple:rgb(0,0,128); }
      :root[data-theme="light"] { --color-text:rgb(0,0,0); --color-text-secondary:rgb(90,90,90); --color-chart-purple:rgb(0,0,255); }
      body { margin:0; background:#17212b; font-family:Arial,"Microsoft YaHei",sans-serif; }
      #root { padding:24px; } .fixture-heading { font:16px Arial; color:white; background:#17212b; padding:4px; margin:0 0 14px; }
      .samples { display:flex; gap:24px; } .sample { width:360px; padding:20px; }
      .fixture-label { background:#fff; color:#111; margin:0 0 12px; padding:4px; font:12px Arial; }
      .environment { width:300px; max-height:310px; } .fixture-row { font-size:14px; }
      .contrast-card { width:300px; margin-top:20px; padding:20px; min-height:135px; }
      .primary-sample { margin-bottom:12px; }
      .pixel-probe { display:block; width:1px; height:1px; margin-top:10px; }
      .shell-grid { display:flex; gap:24px; margin-top:24px; background:repeating-linear-gradient(100deg,#18344c 0 40px,#7190a0 40px 80px); }
      .shell-grid > * { width:360px; height:220px; padding:20px; } .shell-grid input { width:160px; }
    </style></head><body><div id="root"><p class="fixture-heading" style="background:#17212b!important">COMPONENT FIXTURE — native CSS and synthetic content; not a live app screenshot</p><div class="samples">${cards}</div><div class="shell-grid"><aside id="settings-sidebar" class="app-shell-left-panel"><input id="settings-search" aria-label="Fixture settings search"><p class="text-default">设置侧栏</p></aside><aside id="conversation-sidebar" class="app-shell-left-panel"><p class="text-default">对话侧栏</p></aside><div id="settings-detail" class="flex h-full min-h-0 flex-col electron:overflow-hidden electron:bg-surface windows:rounded-tl-lg"><div class="group/settings"><p class="text-default">设置主区</p></div></div></div></div></body></html>`);
    await page.addStyleTag({ content: theme });
    const read = () => page.evaluate(() => {
      const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
      const style = (e, pseudo) => {
        const s = getComputedStyle(e, pseudo), r = e.getBoundingClientRect();
        context.clearRect(0, 0, 1, 1); context.fillStyle = s.backgroundColor; context.fillRect(0, 0, 1, 1);
        return { bg: s.backgroundColor, backgroundAlpha: context.getImageData(0, 0, 1, 1).data[3], image: s.backgroundImage, filter: s.backdropFilter, shadow: s.boxShadow, geometry: [r.x, r.y, r.width, r.height, s.position, s.top, s.width, s.height, s.borderRadius, s.cornerShape], color: s.color };
      };
      return { shells: ['settings-sidebar', 'conversation-sidebar', 'settings-detail'].map(id => ({ id, ...style(document.getElementById(id)) })), cards: [...document.querySelectorAll('.sample')].map(e => ({ sample: e.dataset.sample, root: style(e.querySelector('.environment')), header: style(e.querySelector('header')), before: style(e.querySelector('header'), '::before'), primary: style(e.querySelector('.primary-sample')), ultra: style(e.querySelector('[data-max-effort]')), probe: style(e.querySelector('.pixel-probe')).geometry.slice(0, 2) })) };
    });
    for (const mode of ['dark', 'light']) {
      await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }] });
      await page.evaluate(mode => { const root = document.documentElement; root.classList.remove('forge-ink-mountain'); root.dataset.theme = mode; root.dataset.forgeNativeTheme = mode; root.dataset.forgeBackgroundReady = 'true'; document.querySelectorAll('.environment > div').forEach(e => e.scrollTop = 0); }, mode);
      const base = await read();
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const painted = await read();
      const modeReport = { mode, native: base, painted, pixels: [] };
      report.modes.push(modeReport);
      await t.test(`${mode}: shared shells and native header geometry`, async () => {
        for (const surface of painted.shells) for (const key of ['bg', 'image', 'filter', 'shadow']) { const expected=surface.id==='settings-detail'?(key==='bg'?'rgba(0, 0, 0, 0)':'none'):painted.shells[0][key]; assert.equal(surface[key], expected, `${surface.id} ${key}`); }
        for (let i = 0; i < painted.cards.length; i++) {
          for (const part of ['root', 'header', 'before']) assert.deepEqual(painted.cards[i][part].geometry, base.cards[i][part].geometry, `${mode} ${part} geometry`);
          for (const part of ['root', 'header', 'before']) {
            assert.equal(painted.cards[i][part].backgroundAlpha, 255, `${mode} ${part} must obscure scrolling content`);
            assert.equal(painted.cards[i][part].bg, painted.cards[i].root.bg);
            assert.equal(painted.cards[i][part].filter, 'none');
          }
          assert.equal(painted.cards[i].ultra.color, base.cards[i].ultra.color);
          assert.equal(painted.cards[i].primary.color, base.cards[i].primary.color);
        }
      });
      for (const scrollTop of [0, 137]) {
        await page.locator('.environment > div').evaluateAll((es, scrollTop) => es.forEach(e => e.scrollTop = scrollTop), scrollTop);
        await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
        const nativeScrolled = await read();
        await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const state = await read();
        for (let i = 0; i < state.cards.length; i++) for (const part of ['root', 'header', 'before']) assert.deepEqual(state.cards[i][part].geometry, nativeScrolled.cards[i][part].geometry, `${mode} scroll=${scrollTop} ${part} geometry`);
        const file = `material-fixture-${mode}-${scrollTop ? 'scrolled' : 'static'}.png`;
        const png = PNG.sync.read(await page.screenshot({ path: path.join(fileURLToPath(output), file) }));
        modeReport.pixels.push({ scrollTop, file, cards: state.cards.map(card => {
          const [x, y] = card.probe;
          const backdrop = rgbAt(png, x + 20, y);
          const [ux, uy, uw, uh] = card.ultra.geometry;
          const [px, py, , ph] = card.primary.geometry;
          const ultraBackdrop = rgbAt(png, ux + uw / 2, uy + uh + 2);
          const primaryBackdrop = rgbAt(png, px + 30, py + ph + 2);
          const [hx, hy, hw, hh] = card.header.geometry;
          const headerEmpty = rgbAt(png, hx + hw - 18, hy + hh / 2);
          const bodyEmpty = rgbAt(png, hx + hw - 18, hy + hh + 12);
          const [rx, ry] = card.root.geometry;
          let topStripMaxChannelDelta = 0;
          for (let dy = 3; dy < 8; dy++) for (let dx = 40; dx < 240; dx++) {
            const pixel = rgbAt(png, rx + dx, ry + dy);
            topStripMaxChannelDelta = Math.max(topStripMaxChannelDelta, ...pixel.map((value, i) => Math.abs(value - bodyEmpty[i])));
          }
          return { sample: card.sample, headerEmpty, bodyEmpty, stripeChannelDelta: Math.max(...headerEmpty.map((value, i) => Math.abs(value - bodyEmpty[i]))), topStripMaxChannelDelta, backdrop, ultraBackdrop, primaryBackdrop, ultra: card.ultra.color, primary: card.primary.color, ultraContrast: contrast(parseRgb(card.ultra.color), ultraBackdrop), primaryContrast: contrast(parseRgb(card.primary.color), primaryBackdrop), nativeGeometry: card.header.geometry, beforeGeometry: card.before.geometry };
        }) });
      }
      await t.test(`${mode}: header and adjacent blank body do not form a visible colour stripe`, () => {
        // This bounded pixel regression catches the previously reported stripe;
        // it is not a substitute for human review of texture or readability.
        for (const frame of modeReport.pixels) for (const card of frame.cards) {
          assert.ok(card.stripeChannelDelta <= 2, `${mode}/${card.sample}/scroll=${frame.scrollTop}: header ${card.headerEmpty} vs body ${card.bodyEmpty}, delta ${card.stripeChannelDelta}`);
        }
      });
      await t.test(`${mode}: native eight-pixel sticky cap obscures scrolling text`, () => {
        for (const frame of modeReport.pixels) for (const card of frame.cards) {
          assert.ok(card.topStripMaxChannelDelta <= 2, `${mode}/${card.sample}/scroll=${frame.scrollTop}: native top strip pixel deviation ${card.topStripMaxChannelDelta}`);
        }
      });
      for (const preference of ['prefers-reduced-transparency', 'forced-colors']) {
        await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: mode }, { name: preference, value: preference === 'forced-colors' ? 'active' : 'reduce' }] });
        const state = await read();
        report.accessibility.push({ mode, preference, state });
        await t.test(`${mode}: ${preference} restores opaque surfaces and disables blur`, () => {
          for (const surface of [...state.shells, ...state.cards.flatMap(card => [card.root, card.header, card.before])]) {
            assert.equal(surface.filter, 'none');
            assert.equal(surface.backgroundAlpha, 255);
            assert.equal(surface.image, 'none');
          }
        });
      }
    }
  } finally {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(new URL('material-fixture-report.json', output), JSON.stringify(report, null, 2), 'utf8');
    await browser.close();
  }
});
