import assert from 'node:assert/strict';
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
  installComposerState,
  nativeUiBaseline,
  runtimeFixtureHtml
} from '../tests/runtime-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = path.resolve(
  process.argv[2] ||
  path.join(root, 'artifacts', 'test-runs', `v22-native-composer-stack-${stamp}`)
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

const stateContracts = [
  {
    state: 'default',
    file: '03-composer-default.png',
    panels: 0,
    queueItems: 0,
    progressFades: 0
  },
  {
    state: 'guided',
    file: '08-composer-guided.png',
    panels: 2,
    queueItems: 1,
    progressFades: 1
  },
  {
    state: 'multi-guided',
    file: '13-composer-multi-guided.png',
    fullFile: '14-full-multi-guided.png',
    panels: 2,
    queueItems: 2,
    progressFades: 1
  }
];

const geometrySnapshot = page => page.evaluate(() => {
  const read = element => {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left
    };
  };
  return {
    queued: read(document.querySelector('[data-fixture-surface="queued-panel"]')),
    goal: read(document.querySelector('[data-fixture-surface="goal-panel"]')),
    queueItems: [
      ...document.querySelectorAll('[data-fixture-surface^="queued-message-"]')
    ].map(read),
    controls: [
      ...document.querySelectorAll(
        '[data-fixture-surface="composer-stack"] button'
      )
    ].map(read)
  };
});

const assertGeometryPreserved = (state, before, after) => {
  assert.deepEqual(after.queued, before.queued, `${state}: queued panel geometry changed`);
  assert.deepEqual(after.goal, before.goal, `${state}: goal panel geometry changed`);
  assert.deepEqual(
    after.queueItems,
    before.queueItems,
    `${state}: queued-message geometry changed`
  );
  assert.deepEqual(
    after.controls,
    before.controls,
    `${state}: native control hit-box geometry changed`
  );
};

const paintSnapshot = page => page.evaluate(() => {
  const stack = document.querySelector('.forge-composer-panel-stack');
  const stackPaper = stack ? getComputedStyle(stack, '::before') : null;
  const panels = stack
    ? [...stack.querySelectorAll(':scope > .forge-composer-panel')]
    : [];
  const queueItems = stack
    ? [...stack.querySelectorAll('.forge-composer-queue-item')]
    : [];
  const progressFades = [...document.querySelectorAll('.forge-composer-progress-fade')];
  return {
    stackPaper: stackPaper
      ? {
          content: stackPaper.content,
          backgroundImage: stackPaper.backgroundImage,
          backgroundSize: stackPaper.backgroundSize,
          clipPath: stackPaper.clipPath,
          pointerEvents: stackPaper.pointerEvents
        }
      : null,
    panelCount: panels.length,
    queueItemCount: queueItems.length,
    panels: panels.map(panel => {
      const rect = panel.getBoundingClientRect();
      const style = getComputedStyle(panel);
      const field = getComputedStyle(panel, '::before');
      const cap = getComputedStyle(panel, '::after');
      return {
        y: rect.y,
        height: rect.height,
        borderTopWidth: style.borderTopWidth,
        borderTopColor: style.borderTopColor,
        beforeTop: field.top,
        fieldContent: field.content,
        fieldClipPath: field.clipPath,
        fieldBackgroundSize: field.backgroundSize,
        capContent: cap.content,
        capBackgroundSize: cap.backgroundSize
      };
    }),
    queueItems: queueItems.map(item => {
      const rect = item.getBoundingClientRect();
      const leaf = getComputedStyle(item, '::before');
      return {
        y: rect.y,
        height: rect.height,
        leafContent: leaf.content,
        leafClipPath: leaf.clipPath,
        leafBackgroundSize: leaf.backgroundSize,
        leafBoxShadow: leaf.boxShadow
      };
    }),
    progressFades: progressFades.map(fade => {
      const style = getComputedStyle(fade);
      const rect = fade.getBoundingClientRect();
      return {
        rect: [rect.x, rect.y, rect.width, rect.height],
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        opacity: style.opacity
      };
    })
  };
});

const assertQueueGoalSeamCovered = (state, geometry, paint) => {
  const gap = geometry.goal.top - geometry.queued.bottom;
  assert.ok(
    Math.abs(gap) <= .25,
    `${state}: queue and goal panels are not geometrically continuous (${gap}px)`
  );

  const adjacentGoal = paint.panels[1];
  const borderTopWidth = Number.parseFloat(adjacentGoal.borderTopWidth);
  const beforeTop = Number.parseFloat(adjacentGoal.beforeTop);
  assert.ok(
    Number.isFinite(borderTopWidth) && Number.isFinite(beforeTop),
    `${state}: adjacent goal seam paint geometry is not measurable`
  );
  assert.ok(
    -beforeTop >= borderTopWidth,
    `${state}: adjacent goal paper does not cover its ${borderTopWidth}px top border ` +
      `(before top ${beforeTop}px)`
  );
  assert.equal(
    adjacentGoal.borderTopColor,
    'rgba(75, 51, 27, 0.5)',
    `${state}: retained native goal border must remain an intentional separator`
  );
  assert.equal(paint.stackPaper?.content, '""', `${state}: stack underpaint is missing`);
  assert.notEqual(paint.stackPaper?.backgroundImage, 'none');
  assert.equal(paint.stackPaper?.backgroundSize, '512px 220px');
  assert.equal(paint.stackPaper?.pointerEvents, 'none');
};

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const contract of stateContracts) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
    });
    try {
      await page.route('http://wukong-v22-composer.test/**', route => route.fulfill({
        body: runtimeFixtureHtml,
        contentType: 'text/html; charset=utf-8'
      }));
      await page.goto(`http://wukong-v22-composer.test/?state=${contract.state}`, {
        waitUntil: 'networkidle'
      });
      await installComposerState(page, contract.state);
      const before = await geometrySnapshot(page);

      await page.evaluate(expression);
      await page.waitForFunction(expected => (
        document.querySelector('.composer-surface-chrome')
          ?.classList.contains('forge-composer-frame') &&
        document.querySelectorAll('.forge-composer-panel').length === expected.panels &&
        document.querySelectorAll('.forge-composer-queue-item').length ===
          expected.queueItems &&
        document.querySelectorAll('.forge-composer-progress-fade').length ===
          expected.progressFades
      ), contract);

      const after = await geometrySnapshot(page);
      assertGeometryPreserved(contract.state, before, after);
      const paint = await paintSnapshot(page);
      assert.equal(paint.panelCount, contract.panels);
      assert.equal(paint.queueItemCount, contract.queueItems);
      assert.equal(paint.progressFades.length, contract.progressFades);
      if (contract.state === 'guided' || contract.state === 'multi-guided') {
        assertQueueGoalSeamCovered(contract.state, after, paint);
      }
      paint.progressFades.forEach(fade => {
        assert.equal(fade.backgroundColor, 'rgba(0, 0, 0, 0)');
        assert.equal(fade.backgroundImage, 'none');
        assert.equal(fade.opacity, '0');
      });

      const file = path.join(outputDirectory, contract.file);
      await page.locator('.composer-area').screenshot({ path: file });
      const fullFile = contract.fullFile
        ? path.join(outputDirectory, contract.fullFile)
        : null;
      if (fullFile) {
        await page.screenshot({ path: fullFile, fullPage: false });
      }
      results.push({
        state: contract.state,
        file,
        fullFile,
        geometry: { before, after },
        paint
      });
      await page.evaluate(RESTORE_EXPRESSION);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}

fs.writeFileSync(
  path.join(outputDirectory, 'capture.json'),
  `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: 'headless native-structure fixture; not real Codex acceptance',
    results
  }, null, 2)}\n`,
  'utf8'
);

console.log(outputDirectory);
