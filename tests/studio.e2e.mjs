import { chromium } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_THEME, validateTheme } from '../shared/theme-model.mjs';

const url = process.env.STUDIO_URL || 'http://127.0.0.1:5190/studio/';
const browser = await chromium.launch({ headless: true });
try {
const page = await browser.newPage({
  viewport: { width: 1440, height: 1050 },
  reducedMotion: 'reduce'
});
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(url, { waitUntil: 'networkidle' });

for (const text of ['Codex', '今天想处理什么', '新建任务', '重设计黑神话悟空主题', '环境信息']) {
  if (!await page.getByText(text, { exact: false }).count()) throw Error('Missing preview surface: ' + text);
}

assert(await page.locator('.controls:visible').count() === 0, 'Theme editor column is still visible');
assert(await page.locator('#runtimeToggle, #themeEnabled, .source-rail').count() === 0, 'Runtime control or bottom rail is still present');
assert(await page.getByText('主题状态', { exact: true }).count() === 0, 'Theme status panel is still present');
assert(await page.getByText('RUNTIME', { exact: true }).count() === 0, 'Runtime status card is still present');
const stageBox = await page.locator('#preview').boundingBox();
assert(stageBox.x === 0 && stageBox.width === 1440, 'Preview does not fill the full window after removing the editor column');
assert(await page.locator('#preview').getAttribute('data-surface') === 'landing', 'Studio did not start in landing state');
const defaultImage = await page.locator('#preview').evaluate(element => element.style.getPropertyValue('--studio-image'));
assert(defaultImage.includes(DEFAULT_THEME.background.asset), 'Active default background was not loaded');
assert(await page.evaluate(async asset => { const img = new Image(); img.src = '../themes/' + asset; await img.decode(); return img.naturalWidth > 0; }, DEFAULT_THEME.background.asset), 'Default background failed to decode');

await page.evaluate(() => document.getElementById('showThread').click());
assert(await page.locator('#preview').getAttribute('data-surface') === 'thread', 'Thread preview did not activate');
assert(await page.locator('.thread-scene').evaluate(element => getComputedStyle(element).visibility) === 'visible', 'Thread scene stayed hidden');
assert(await page.locator('.landing-scene').evaluate(element => getComputedStyle(element).visibility) === 'hidden', 'Landing scene stayed visible');
await page.evaluate(() => document.getElementById('showLanding').click());

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9JfRgAAAAASUVORK5CYII=',
  'base64'
);
await page.locator('#localFile').setInputFiles({ name: 'mist.png', mimeType: 'image/png', buffer: png });
await page.evaluate(() => {
  const setInput = (id, value) => {
    const element = document.getElementById(id);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  };
  setInput('position', 'left center');
  setInput('landingPosition', 'center center');
  setInput('dim', '62');
  setInput('art', '21');
  setInput('landingArt', '83');
});
const variables = await page.locator('#preview').evaluate(element => ({
  image: element.style.getPropertyValue('--studio-image'),
  position: element.style.getPropertyValue('--studio-position'),
  landingPosition: element.style.getPropertyValue('--studio-landing-position'),
  dim: element.style.getPropertyValue('--studio-dim'),
  intensity: element.style.getPropertyValue('--studio-intensity'),
  landingIntensity: element.style.getPropertyValue('--studio-landing-intensity')
}));
assert(variables.image.includes('data:image/png'), 'Local image did not reach the preview');
assert(variables.position === 'left center', 'Thread focus did not update');
assert(variables.landingPosition === 'center center', 'Landing focus did not update');
assert(variables.dim === '0.62', 'Dim did not update');
assert(variables.intensity === '0.21', 'Thread intensity did not update');
assert(variables.landingIntensity === '0.83', 'Landing intensity did not update');

const downloadPromise = page.waitForEvent('download');
await page.evaluate(() => document.getElementById('export').click());
const download = await downloadPromise;
const retainedExportDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'wukong-forge-export-'));
const retainedExportPath = path.join(retainedExportDirectory, 'theme.json');
await download.saveAs(retainedExportPath);
const exported = JSON.parse(fs.readFileSync(retainedExportPath, 'utf8'));
validateTheme(exported);

await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => document.activeElement?.blur());
await page.screenshot({ path: 'docs/screenshots/theme-studio.png', fullPage: true });
await page.screenshot({ path: 'docs/screenshots/theme-studio-landing.png', fullPage: true });
await page.evaluate(() => document.getElementById('showThread').click());
await page.waitForTimeout(400);
await page.screenshot({ path: 'docs/screenshots/theme-studio-thread.png', fullPage: true });

for (const file of [
  'docs/screenshots/theme-studio.png',
  'docs/screenshots/theme-studio-landing.png',
  'docs/screenshots/theme-studio-thread.png'
]) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 20000) throw Error('Studio screenshot is missing or empty: ' + file);
}
if (errors.length) throw Error('Studio page errors: ' + errors.join('; '));
} finally { await browser.close(); }
console.log('Studio full-window native-shell preview, hidden editor boundary, local image, export, and screenshots PASS');

function assert(condition, message) {
  if (!condition) throw Error(message);
}
