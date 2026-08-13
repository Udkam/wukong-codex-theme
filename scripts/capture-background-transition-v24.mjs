import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';
import {
  makeApplyExpression,
  RESTORE_EXPRESSION,
  THEME_STATE_EXPRESSION
} from '../runtime/injection-plan-v13.mjs';
import {
  enterThreadState,
  nativeUiBaseline,
  runtimeFixtureHtml
} from '../tests/runtime-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = path.resolve(
  process.argv[2] ||
  path.join(root, 'artifacts', 'test-runs', `v24-background-transition-${stamp}`)
);

if (fs.existsSync(outputDirectory)) {
  throw new Error(`Capture directory already exists: ${outputDirectory}`);
}
fs.mkdirSync(outputDirectory, { recursive: true });

const styleSheet = fs.readFileSync(
  path.join(root, 'runtime', 'wukong-codex-theme-background-v13.css'),
  'utf8'
);
const payload = payloadFromThemeFile(path.join(root, 'themes', 'active.json'));
const expression = makeApplyExpression({
  styleSheet,
  variables: payload.variables
});

const installLanding = page => page.evaluate(() => {
  document.querySelector('[data-thread-find-target="conversation"]')?.remove();
  if (document.querySelector('.landing-native')) return;
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
  document.querySelector('.route-host')
    .insertBefore(landing, document.querySelector('.thread-summary-layer'));
});

const readEvidence = page => page.evaluate(stateExpression => {
  const state = (0, eval)(stateExpression);
  const overlay = document.getElementById('wukong-codex-theme-background');
  const active = overlay?.querySelector(
    '[data-forge-background-layer][data-forge-active="true"]'
  );
  const image = active?.querySelector('[data-forge-background-image]');
  const veil = active?.querySelector('[data-forge-background-veil]');
  const rect = element => {
    if (!element) return null;
    const box = element.getBoundingClientRect();
    return [box.x, box.y, box.width, box.height];
  };
  return {
    state,
    viewport: [0, 0, innerWidth, innerHeight],
    coverage: {
      overlay: rect(overlay),
      active: rect(active),
      image: rect(image),
      veil: rect(veil)
    },
    paint: image ? {
      backgroundSize: getComputedStyle(image).backgroundSize,
      filter: getComputedStyle(image).filter,
      willChange: getComputedStyle(image).willChange
    } : null
  };
}, THEME_STATE_EXPRESSION);

const assertCoverage = (label, evidence) => {
  for (const [part, bounds] of Object.entries(evidence.coverage)) {
    assert.deepEqual(bounds, evidence.viewport, `${label}: ${part} does not cover viewport`);
  }
  assert.equal(evidence.paint?.backgroundSize, 'cover', `${label}: background is not cover`);
  assert.equal(evidence.paint?.filter, 'none', `${label}: full-screen filter is active`);
  assert.equal(evidence.paint?.willChange, 'auto', `${label}: persistent will-change is active`);
};

const waitForStable = async (page, surface, mode) => {
  await page.waitForFunction(
    ({ surface, mode }) => {
      const runtime = window.__wukongCodexThemeRuntimeV13;
      const overlay = document.getElementById('wukong-codex-theme-background');
      return document.documentElement.dataset.forgeSurface === surface &&
        document.documentElement.dataset.forgeMode === mode &&
        document.documentElement.dataset.forgeBackgroundReady === 'true' &&
        overlay?.dataset.forgeReady === 'true' &&
        overlay?.dataset.forgeTransitioning !== 'true' &&
        runtime?.preloadRequests?.size === 0;
    },
    { surface, mode }
  );
};

const waitForTransition = async (page, surface, mode) => {
  await page.waitForFunction(
    ({ surface, mode }) => {
      const overlay = document.getElementById('wukong-codex-theme-background');
      return document.documentElement.dataset.forgeSurface === surface &&
        document.documentElement.dataset.forgeMode === mode &&
        overlay?.dataset.forgeTransitioning === 'true';
    },
    { surface, mode }
  );
};

const evidence = {};
const browser = await chromium.launch({ headless: true });
let page;
try {
  page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v24-background-capture.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v24-background-capture.test/', {
    waitUntil: 'networkidle'
  });
  await page.evaluate(expression);

  await waitForStable(page, 'landing', 'battle');
  evidence.landing = await readEvidence(page);
  assertCoverage('landing', evidence.landing);
  assert.equal(evidence.landing.state.backgroundLoadedLayerCount, 1);
  assert.equal(evidence.landing.state.preloadInFlight, 0);
  await page.screenshot({
    path: path.join(outputDirectory, '01-full-landing-stable.png'),
    fullPage: false
  });

  await enterThreadState(page);
  await waitForTransition(page, 'thread', 'scenery');
  evidence.toThread = await readEvidence(page);
  assertCoverage('landing-to-thread', evidence.toThread);
  assert.equal(evidence.toThread.state.backgroundLoadedLayerCount, 2);
  assert.equal(evidence.toThread.state.preloadInFlight, 0);
  await page.screenshot({
    path: path.join(outputDirectory, '02-full-transition-to-thread.png'),
    fullPage: false
  });

  await waitForStable(page, 'thread', 'scenery');
  evidence.thread = await readEvidence(page);
  assertCoverage('thread', evidence.thread);
  assert.equal(evidence.thread.state.backgroundLoadedLayerCount, 1);
  assert.equal(evidence.thread.state.preloadInFlight, 0);
  await page.screenshot({
    path: path.join(outputDirectory, '03-full-thread-stable.png'),
    fullPage: false
  });

  await installLanding(page);
  await waitForTransition(page, 'landing', 'battle');
  await waitForStable(page, 'landing', 'battle');
  evidence.returnedLanding = await readEvidence(page);
  assertCoverage('returned-landing', evidence.returnedLanding);
  assert.equal(evidence.returnedLanding.state.backgroundLoadedLayerCount, 1);
  assert.equal(evidence.returnedLanding.state.preloadInFlight, 0);
  await page.screenshot({
    path: path.join(outputDirectory, '04-full-landing-returned.png'),
    fullPage: false
  });

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-owned]').count(), 0);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  assert.equal(await page.locator('#wukong-codex-theme-background').count(), 0);

  fs.writeFileSync(
    path.join(outputDirectory, 'capture.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'single headless native-structure fixture; not real Codex acceptance',
      screenshots: [
        '01-full-landing-stable.png',
        '02-full-transition-to-thread.png',
        '03-full-thread-stable.png',
        '04-full-landing-returned.png'
      ],
      evidence
    }, null, 2)}\n`,
    'utf8'
  );
  console.log(outputDirectory);
} finally {
  await page?.close();
  await browser.close();
}
