import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';
import {
  makeApplyExpression,
  RESTORE_EXPRESSION
} from '../runtime/injection-plan-v13.mjs';
import {
  nativeUiBaseline,
  runtimeFixtureHtml
} from '../tests/runtime-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.resolve(
  process.argv[2] ||
    path.join(root, 'artifacts', 'test-runs', `v16-landing-composition-${Date.now()}`)
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

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v16-capture.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v16-capture.test/');
  await page.evaluate(expression);
  await page.waitForFunction(() => {
    const runtime = window.__wukongCodexThemeRuntimeV13;
    return Boolean(
      runtime &&
      !runtime.transitionInFlight &&
      document.documentElement.dataset.forgeBackgroundReady === 'true' &&
      document.querySelector('.forge-landing-icon') &&
      document.querySelector('.forge-landing-title') &&
      document.querySelector('.forge-landing-kicker') &&
      document.querySelector('.forge-landing-subtitle')
    );
  });

  const records = [];
  const seenScenes = new Set();
  const sceneGroups = [
    { mode: 'battle', count: payload.theme.background.gallery.filter(scene => scene.mode.startsWith('battle')).length },
    { mode: 'scenery', count: payload.theme.background.gallery.filter(scene => scene.mode === 'scenery').length }
  ];
  let captureIndex = 0;
  for (const group of sceneGroups) {
    if (await page.locator('html').getAttribute('data-forge-mode') !== group.mode) {
      await page.evaluate(() => window.__wukongCodexThemeRuntimeV13.toggleBackgroundMode());
      await page.waitForFunction(expectedMode => {
        const runtime = window.__wukongCodexThemeRuntimeV13;
        return Boolean(
          runtime &&
          document.documentElement.dataset.forgeMode === expectedMode &&
          !runtime.transitionInFlight &&
          !runtime.requestedScene
        );
      }, group.mode);
    }
    for (let groupIndex = 0; groupIndex < group.count; groupIndex += 1) {
      const record = await page.evaluate(() => {
        const rootElement = document.documentElement;
        const icon = document.querySelector('.forge-landing-icon');
        const title = document.querySelector('.forge-landing-title');
        const kicker = document.querySelector('.forge-landing-kicker');
        const subtitle = document.querySelector('.forge-landing-subtitle');
        const rect = element => {
          const box = element.getBoundingClientRect();
          return {
            x: box.x,
            y: box.y,
            width: box.width,
            height: box.height
          };
        };
        const iconPaint = getComputedStyle(icon, '::before');
        const titlePaint = getComputedStyle(title, '::after');
        return {
          scene: Number.parseInt(rootElement.dataset.forgeScene, 10),
          mode: rootElement.dataset.forgeMode,
          slot: getComputedStyle(rootElement).getPropertyValue('--forge-scene-slot').trim(),
          heroProfile: getComputedStyle(rootElement).getPropertyValue('--forge-landing-hero-profile').trim(),
          iconHost: rect(icon),
          iconPaint: {
            width: iconPaint.width,
            height: iconPaint.height,
            left: iconPaint.left,
            top: iconPaint.top,
            transform: iconPaint.transform,
            backgroundImage: iconPaint.backgroundImage.slice(0, 96),
            opacity: iconPaint.opacity,
            filter: iconPaint.filter,
            mixBlendMode: iconPaint.mixBlendMode
          },
          title: {
            ...rect(title),
            fontSize: titlePaint.fontSize,
            letterSpacing: titlePaint.letterSpacing,
            color: titlePaint.color,
            opacity: titlePaint.opacity,
            textShadow: titlePaint.textShadow,
            content: titlePaint.content,
            ariaLabel: title.getAttribute('aria-label')
          },
          hiddenNativeLines: {
            kickerOpacity: getComputedStyle(kicker).opacity,
            subtitleOpacity: getComputedStyle(subtitle).opacity
          }
        };
      });
      if (seenScenes.has(record.scene)) {
        throw new Error(`Scene ${record.scene} repeated before the 20-scene capture matrix completed`);
      }
      seenScenes.add(record.scene);
      const scene = payload.theme.background.gallery[record.scene];
      const fileName = `${String(captureIndex).padStart(2, '0')}-${scene.slot}-${scene.id}.png`;
      await page.screenshot({
        path: path.join(outputDirectory, fileName),
        fullPage: true
      });
      records.push({ ...record, file: fileName });

      captureIndex += 1;
      if (groupIndex + 1 < group.count) {
        const priorScene = record.scene;
        await page.evaluate(mode => window.__wukongCodexThemeRuntimeV13.nextBackground(mode), group.mode);
        await page.waitForFunction(previous => {
          const runtime = window.__wukongCodexThemeRuntimeV13;
          return Boolean(
            runtime &&
            runtime.currentScene !== previous &&
            !runtime.transitionInFlight &&
            !runtime.requestedScene
          );
        }, priorScene);
      }
    }
  }

  if (records.length !== payload.theme.background.gallery.length) {
    throw new Error(`Captured ${records.length} scenes; expected ${payload.theme.background.gallery.length}`);
  }

  fs.writeFileSync(
    path.join(outputDirectory, 'capture.json'),
    `${JSON.stringify({
      source: 'headless native-structure fixture',
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor,
      records
    }, null, 2)}\n`,
    'utf8'
  );
  await page.evaluate(RESTORE_EXPRESSION);
  await page.close();
  process.stdout.write(`${outputDirectory}\n`);
} finally {
  await browser.close();
}
