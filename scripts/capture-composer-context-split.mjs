import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';
import { makeApplyExpression, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import { installComposerState, runtimeFixtureHtml } from '../tests/runtime-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outputDirectory = path.resolve(
  process.argv[2] || path.join(root, 'artifacts', 'test-runs', 'composer-context-split')
);

if (fs.existsSync(outputDirectory)) {
  throw new Error(`Capture directory already exists: ${outputDirectory}`);
}
fs.mkdirSync(outputDirectory, { recursive: true });

const expression = makeApplyExpression({
  styleSheet: fs.readFileSync(
    path.join(root, 'runtime', 'wukong-codex-theme-background-v13.css'),
    'utf8'
  ),
  variables: payloadFromThemeFile(
    path.join(root, 'themes', 'active.json')
  ).variables
});

const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const fixture of [
    {
      state: 'context',
      marker: 'forge-composer-context-above',
      placement: 'above',
      fileName: '01-thread-context-above.png',
      fullFileName: '01-thread-context-above-full.png'
    },
    {
      state: 'codex-home-context',
      marker: 'forge-composer-context-above',
      placement: 'above',
      fileName: '02-codex-new-task-context-above.png',
      fullFileName: '02-codex-new-task-context-above-full.png'
    },
    {
      state: 'home-context',
      marker: 'forge-composer-context-below',
      placement: 'below',
      fileName: '03-work-context-below.png',
      fullFileName: '03-work-context-below-full.png'
    }
  ]) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await page.route('http://wukong-context-split.test/**', route => route.fulfill({
      body: runtimeFixtureHtml,
      contentType: 'text/html; charset=utf-8'
    }));
    await page.goto(`http://wukong-context-split.test/?state=${fixture.state}`);
    await installComposerState(page, fixture.state);
    await page.evaluate(expression);
    await page.waitForFunction(marker => (
      document.querySelector('.composer-surface-chrome')
        ?.classList.contains('forge-composer-frame') &&
      document.querySelector('.forge-composer-context')
        ?.classList.contains(marker)
    ), fixture.marker);

    if (fixture.state === 'home-context') {
      await page.locator('.composer-area').evaluate(element => {
        element.style.bottom = '76px';
      });
    }
    const clip = await page.evaluate(() => {
      const composer = document.querySelector('.composer-surface-chrome')
        .getBoundingClientRect();
      const context = document.querySelector('.forge-composer-context')
        .getBoundingClientRect();
      const margin = 8;
      const x = Math.max(0, Math.min(composer.left, context.left) - margin);
      const y = Math.max(0, Math.min(composer.top, context.top) - margin);
      const right = Math.min(innerWidth, Math.max(composer.right, context.right) + margin);
      const bottom = Math.min(innerHeight, Math.max(composer.bottom, context.bottom) + margin);
      return { x, y, width: right - x, height: bottom - y };
    });
    const outputPath = path.join(outputDirectory, fixture.fileName);
    const fullOutputPath = path.join(outputDirectory, fixture.fullFileName);
    await page.screenshot({ path: fullOutputPath, fullPage: true });
    await page.screenshot({ path: outputPath, clip });
    const contract = await page.locator('.forge-composer-context').evaluate(element => {
      const field = getComputedStyle(element, '::before');
      const paint = getComputedStyle(element, '::after');
      const composer = document.querySelector('.composer-surface-chrome');
      return {
        classes: [...element.classList].filter(name => name.startsWith('forge-composer-context')),
        hostTransform: getComputedStyle(element).transform,
        fieldClipPath: field.clipPath,
        paintTop: paint.top,
        paintBottom: paint.bottom,
        paintPosition: paint.backgroundPosition,
        paintTransform: paint.transform,
        placement: element.nextElementSibling === composer
          ? 'above'
          : composer.nextElementSibling === element
            ? 'below'
            : 'detached'
      };
    });
    if (contract.placement !== fixture.placement || contract.hostTransform !== 'none') {
      throw new Error(
        `${fixture.state} expected ${fixture.placement} with no transform; ` +
        `received ${contract.placement} and ${contract.hostTransform}`
      );
    }
    const expectedMarker = `forge-composer-context-${fixture.placement}`;
    const oppositeMarker = fixture.placement === 'above'
      ? 'forge-composer-context-below'
      : 'forge-composer-context-above';
    if (!contract.classes.includes(expectedMarker) || contract.classes.includes(oppositeMarker)) {
      throw new Error(
        `${fixture.state} expected only ${expectedMarker}; received ${contract.classes.join(', ')}`
      );
    }
    const expectedClipPath = fixture.placement === 'above'
      ? 'polygon(8px 0px, calc(100% - 8px) 0px, 100% 8px, 100% 100%, 0px 100%, 0px 8px)'
      : 'polygon(0px 0px, 100% 0px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0px calc(100% - 8px))';
    if (contract.fieldClipPath !== expectedClipPath || contract.paintTransform !== 'none') {
      throw new Error(
        `${fixture.state} expected the ${fixture.placement} corner contract with no paint transform; ` +
        `received clip=${contract.fieldClipPath}, transform=${contract.paintTransform}`
      );
    }
    const expectedPosition = fixture.placement === 'above' ? '50% 0%' : '50% 100%';
    const anchoredToExpectedEdge = fixture.placement === 'above'
      ? contract.paintTop === '0px'
      : contract.paintBottom === '0px';
    if (!anchoredToExpectedEdge || contract.paintPosition !== expectedPosition) {
      throw new Error(
        `${fixture.state} expected ${fixture.placement} strip paint at ${expectedPosition}; ` +
        `received top=${contract.paintTop}, bottom=${contract.paintBottom}, ` +
        `position=${contract.paintPosition}`
      );
    }
    results.push({ ...fixture, outputPath, fullOutputPath, contract });
    await page.evaluate(RESTORE_EXPRESSION);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ outputDirectory, results }, null, 2));
