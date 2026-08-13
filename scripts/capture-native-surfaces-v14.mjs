import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';
import { makeApplyExpression, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import {
  installComposerState,
  nativeUiBaseline,
  runtimeFixtureHtml
} from '../tests/runtime-fixture.mjs';

const root = path.resolve(import.meta.dirname, '..');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDirectory = path.resolve(
  process.argv[2] || path.join(root, 'artifacts', 'test-runs', `v15-native-surfaces-${stamp}`)
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

const readComposerContract = page => page.evaluate(() => {
  const root = document.querySelector('[data-codex-composer-root]');
  const portal = root?.querySelector(':scope > [data-above-composer-portal]');
  const composer = root?.querySelector('.composer-surface-chrome');
  const component = root && composer
    ? [...root.children].find(child => (
        child !== portal && child.contains(composer)
      )) || null
    : null;
  const stack = root?.querySelector('[data-fixture-surface="composer-stack"]');
  const submit = root?.querySelector('[data-native-slot="composer-submit"]');
  const nodes = {
    root,
    portal,
    component,
    utility: root?.querySelector('[data-native-composer-utility-slot]'),
    progressHost: root?.querySelector('.native-progress-host'),
    progress: root?.querySelector('[data-fixture-control="plan"]'),
    stackInset: stack?.parentElement || null,
    stack,
    queued: root?.querySelector('[data-fixture-surface="queued-panel"]'),
    goal: root?.querySelector('[data-fixture-surface="goal-panel"]'),
    composer,
    editor: root?.querySelector('.ProseMirror[role="textbox"]'),
    inputShell: root?.querySelector('.ProseMirror[role="textbox"]')?.parentElement || null,
    footer: submit?.closest('div.select-none') || null,
    add: root?.querySelector('[data-native-slot="composer-add"]'),
    access: root?.querySelector('[data-native-slot="composer-access"]'),
    model: root?.querySelector('[data-native-slot="composer-model"]'),
    voice: root?.querySelector('[data-native-slot="composer-voice"]'),
    submit
  };
  const keys = new Map(
    Object.entries(nodes)
      .filter(([, element]) => element)
      .map(([key, element]) => [element, key])
  );
  const rectOf = element => {
    const rect = element.getBoundingClientRect();
    const css = [rect.x, rect.y, rect.width, rect.height];
    return {
      css,
      physical: css.map(value => value * devicePixelRatio)
    };
  };
  const describe = element => {
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      rect: rectOf(element),
      parentKey: keys.get(element.parentElement) || null,
      childKeys: [...element.children].map(child => keys.get(child) || null),
      nextSiblingKey: keys.get(element.nextElementSibling) || null,
      display: style.display,
      position: style.position,
      zIndex: style.zIndex,
      isolation: style.isolation,
      order: style.order,
      alignSelf: style.alignSelf,
      alignItems: style.alignItems,
      justifyContent: style.justifyContent,
      flexDirection: style.flexDirection,
      gridTemplateColumns: style.gridTemplateColumns,
      marginBottom: style.marginBottom,
      padding: [
        style.paddingTop,
        style.paddingRight,
        style.paddingBottom,
        style.paddingLeft
      ],
      gap: style.gap,
      rowGap: style.rowGap,
      columnGap: style.columnGap,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      maxHeight: style.maxHeight,
      forgePaintHost: element.matches(
        '.forge-composer-frame, .forge-composer-context, ' +
        '.forge-composer-panel-stack, .forge-composer-panel, ' +
        '.forge-composer-queue-item'
      ),
      ariaLabel: element.getAttribute('aria-label'),
      type: element.getAttribute('type'),
      disabled: 'disabled' in element ? element.disabled : null,
      ariaDisabled: element.getAttribute('aria-disabled'),
      contentEditable: element.getAttribute('contenteditable'),
      text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
      svgCount: element.querySelectorAll('svg').length
    };
  };
  return {
    viewport: [innerWidth, innerHeight],
    deviceScaleFactor: devicePixelRatio,
    elements: Object.fromEntries(
      Object.entries(nodes).map(([key, element]) => [key, describe(element)])
    )
  };
});

const invariantContract = (contract, paintHostKeys = new Set()) => Object.fromEntries(
  Object.entries(contract.elements).map(([key, element]) => [
    key,
    element && {
      parentKey: element.parentKey,
      childKeys: element.childKeys,
      nextSiblingKey: element.nextSiblingKey,
      display: element.display,
      position: paintHostKeys.has(key) ? undefined : element.position,
      zIndex: paintHostKeys.has(key) ? undefined : element.zIndex,
      isolation: paintHostKeys.has(key) ? undefined : element.isolation,
      order: element.order,
      alignSelf: element.alignSelf,
      alignItems: element.alignItems,
      justifyContent: element.justifyContent,
      flexDirection: element.flexDirection,
      gridTemplateColumns: key === 'footer' ? undefined : element.gridTemplateColumns,
      gap: element.gap,
      rowGap: element.rowGap,
      columnGap: element.columnGap,
      overflowX: element.overflowX,
      overflowY: element.overflowY,
      ariaLabel: element.ariaLabel,
      type: element.type,
      disabled: element.disabled,
      ariaDisabled: element.ariaDisabled,
      contentEditable: element.contentEditable,
      text: element.text,
      svgCount: element.svgCount
    }
  ])
);

const assertComposerInvariant = (state, nativeContract, themedContract) => {
  const paintHostKeys = new Set(
    Object.entries(themedContract.elements)
      .filter(([, element]) => element?.forgePaintHost)
      .map(([key]) => key)
  );
  const before = JSON.stringify(invariantContract(nativeContract, paintHostKeys));
  const after = JSON.stringify(invariantContract(themedContract, paintHostKeys));
  if (before !== after) {
    throw new Error(`Composer topology or semantics changed in ${state}`);
  }
  const native = nativeContract.elements;
  const themed = themedContract.elements;
  const close = (actual, expected, label, tolerance = .5) => {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`${label} changed from ${expected} to ${actual} in ${state}`);
    }
  };
  const composerWidth = themed.composer.rect.css[2];
  const expectedHeight = Math.min(120, Math.max(96, composerWidth * 25 / 184));
  close(themed.composer.rect.css[0], native.composer.rect.css[0], 'composer x');
  close(composerWidth, native.composer.rect.css[2], 'composer width');
  close(
    themed.composer.rect.css[1] + themed.composer.rect.css[3],
    native.composer.rect.css[1] + native.composer.rect.css[3],
    'composer bottom'
  );
  close(themed.composer.rect.css[3], expectedHeight, 'approved composer height');
  for (const key of [
    'progressHost',
    'progress',
    'stackInset',
    'stack',
    'queued',
    'goal',
    'add',
    'access',
    'model',
    'voice',
    'submit'
  ]) {
    if (!native[key] || !themed[key]) continue;
    close(themed[key].rect.css[2], native[key].rect.css[2], `${key} width`);
    close(themed[key].rect.css[3], native[key].rect.css[3], `${key} height`);
  }
};

const browser = await chromium.launch({ headless: true });
try {
  const newPage = async state => {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
      deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
    });
    await page.route('http://wukong-v14-capture.test/**', route => route.fulfill({
      body: runtimeFixtureHtml,
      contentType: 'text/html; charset=utf-8'
    }));
    await page.goto(`http://wukong-v14-capture.test/?state=${state}`);
    await installComposerState(page, state);
    const nativeContract = await readComposerContract(page);
    await page.evaluate(expression);
    await page.waitForFunction(() => (
      document.querySelector('.composer-surface-chrome')
        ?.classList.contains('forge-composer-frame') &&
      document.querySelectorAll('.forge-topbar-menu-item').length === 4
    ));
    if (state === 'context' || state === 'home-context') {
      await page.waitForFunction(() => document.querySelector('.forge-composer-context'));
    } else if (
      state === 'running' ||
      state === 'guided' ||
      state === 'expanded-guided' ||
      state === 'multi-guided'
    ) {
      await page.waitForFunction(expected => (
        document.querySelector('.forge-composer-progress-pill') &&
        document.querySelector('.forge-composer-panel-stack') &&
        document.querySelectorAll('.forge-composer-panel').length === expected.panels &&
        document.querySelectorAll('.forge-composer-queue-item').length === expected.queueItems
      ), {
        panels: state === 'running' ? 1 : 2,
        queueItems: state === 'multi-guided'
          ? 2
          : state === 'guided' || state === 'expanded-guided'
            ? 1
            : 0
      });
    }
    const themedContract = await readComposerContract(page);
    assertComposerInvariant(state, nativeContract, themedContract);
    return { page, nativeContract, themedContract };
  };

  const {
    page,
    nativeContract: defaultNativeContract,
    themedContract: defaultThemedContract
  } = await newPage('default');
  const files = {
    fullDefault: path.join(outputDirectory, '01-full-default.png'),
    sidebar: path.join(outputDirectory, '02-sidebar-levels.png'),
    composerDefault: path.join(outputDirectory, '03-composer-default.png'),
    topbarOpen: path.join(outputDirectory, '04-topbar-open.png'),
    composerContext: path.join(outputDirectory, '05-composer-context.png'),
    composerHomeContext: path.join(outputDirectory, '06-composer-home-context.png'),
    composerProgress: path.join(outputDirectory, '07-composer-progress.png'),
    composerGuided: path.join(outputDirectory, '08-composer-guided.png'),
    composerExpanded: path.join(outputDirectory, '09-composer-expanded.png'),
    landingMark: path.join(outputDirectory, '10-landing-mark-56.png'),
    sidebarStateMatrix: path.join(outputDirectory, '11-sidebar-state-matrix.png'),
    topbarStateMatrix: path.join(outputDirectory, '12-topbar-state-matrix.png'),
    composerMultiGuided: path.join(outputDirectory, '13-composer-multi-guided.png')
  };
  await page.screenshot({ path: files.fullDefault, fullPage: true });
  await page.locator('aside.app-shell-left-panel').screenshot({ path: files.sidebar });
  await page.locator('.composer-area').screenshot({ path: files.composerDefault });
  await page.locator('[data-testid="home-icon"]').screenshot({ path: files.landingMark });

  await page.locator('[data-native-slot="menu-view"]').evaluate(element => {
    element.setAttribute('aria-expanded', 'true');
  });
  await page.locator('[data-native-slot="project-temple-child"]').hover();
  await page.locator('[class~="group/application-menu-top-bar"]')
    .screenshot({ path: files.topbarOpen });

  await page.evaluate(() => {
    document.querySelector('[data-native-slot="menu-file"]').disabled = true;
    document.querySelector('[data-native-slot="menu-view"]')
      .setAttribute('aria-expanded', 'true');
    document.querySelector('[data-native-slot="menu-help"]').dataset.state = 'open';

    document.querySelector('[data-native-slot="new-task-menu"]').dataset.state = 'open';
    document.querySelector('[data-native-slot="project-active"]')
      .removeAttribute('aria-current');
    document.querySelector('[data-native-slot="project-active"]')
      .removeAttribute('data-app-action-sidebar-thread-active');
    document.querySelector('[data-native-slot="pull-requests"]')
      .setAttribute('aria-current', 'page');
    document.querySelector('[data-native-slot="scheduled"]').disabled = true;
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="pull-requests"]')
      ?.classList.contains('forge-sidebar-action-active') &&
    !document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ));
  await page.locator('[data-native-slot="menu-help"]').focus();
  await page.locator('[data-native-slot="menu-edit"]').hover();
  await page.locator('[class~="group/application-menu-top-bar"]')
    .screenshot({ path: files.topbarStateMatrix });
  await page.locator(
    '[data-app-action-sidebar-project-row][aria-expanded="false"]'
  ).focus();
  await page.locator('[data-native-slot="plugins"]').hover();
  await page.locator('aside.app-shell-left-panel')
    .screenshot({ path: files.sidebarStateMatrix });

  const metrics = await page.evaluate(() => {
    const count = selector => document.querySelectorAll(selector).length;
    const rect = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return [box.x, box.y, box.width, box.height];
    };
    return {
      marked: count('[data-forge-mark]'),
      topbarMenuItems: count('.forge-topbar-menu-item'),
      sidebarActions: count('.forge-sidebar-action'),
      sidebarLevel1: count('.forge-sidebar-level1'),
      sidebarLevel2: count('.forge-sidebar-level2'),
      sidebarSelected: count('.forge-sidebar-selected'),
      composerFrames: count('.forge-composer-frame'),
      disabledTopbarItems: count('.forge-topbar-menu-item:disabled'),
      openTopbarItems: count(
        '.forge-topbar-menu-item[aria-expanded="true"], .forge-topbar-menu-item[data-state="open"]'
      ),
      activeSidebarActions: count('.forge-sidebar-action-active'),
      disabledSidebarActions: count('.forge-sidebar-action:disabled'),
      runningIndicators: count('[data-native-status="running"] .animate-spin'),
      unreadIndicators: count('[data-native-status="unread"]'),
      topbarRect: rect('[class~="group/application-menu-top-bar"]'),
      sidebarRect: rect('aside.app-shell-left-panel'),
      composerRect: rect('.composer-surface-chrome')
    };
  });
  await page.evaluate(RESTORE_EXPRESSION);
  const restoredMarks = await page.locator('[data-forge-mark]').count();
  await page.close();

  const {
    page: contextPage,
    nativeContract: contextNativeContract,
    themedContract: contextThemedContract
  } = await newPage('context');
  await contextPage.locator('.composer-area').screenshot({ path: files.composerContext });
  const contextMarks = await contextPage.locator('.forge-composer-context').count();
  await contextPage.evaluate(RESTORE_EXPRESSION);
  await contextPage.close();

  const {
    page: homeContextPage,
    nativeContract: homeContextNativeContract,
    themedContract: homeContextThemedContract
  } = await newPage('home-context');
  await homeContextPage.locator('.composer-area')
    .screenshot({ path: files.composerHomeContext });
  const homeContextMarks = await homeContextPage.locator(
    '.forge-composer-context'
  ).count();
  await homeContextPage.evaluate(RESTORE_EXPRESSION);
  await homeContextPage.close();

  const {
    page: progressPage,
    nativeContract: runningNativeContract,
    themedContract: runningThemedContract
  } = await newPage('running');
  await progressPage.waitForFunction(() => (
    document.querySelector('.forge-plan-pill') &&
    document.querySelector('.forge-composer-panel-stack') &&
    document.querySelector('.forge-composer-panel')
  ));
  await progressPage.locator('.composer-area').screenshot({ path: files.composerProgress });
  const progressMarks = {
    plan: await progressPage.locator('.forge-plan-pill').count(),
    stacks: await progressPage.locator('.forge-composer-panel-stack').count(),
    panels: await progressPage.locator('.forge-composer-panel').count()
  };
  await progressPage.evaluate(RESTORE_EXPRESSION);
  await progressPage.close();

  const {
    page: guidedPage,
    nativeContract: guidedNativeContract,
    themedContract: guidedThemedContract
  } = await newPage('guided');
  await guidedPage.waitForFunction(() => (
    document.querySelector('.forge-plan-pill') &&
    document.querySelectorAll('.forge-composer-panel-stack').length === 1 &&
    document.querySelectorAll('.forge-composer-panel').length === 2 &&
    document.querySelectorAll('.forge-composer-queue-item').length === 1
  ));
  await guidedPage.locator('.composer-area').screenshot({ path: files.composerGuided });
  const guidedMarks = {
    plan: await guidedPage.locator('.forge-plan-pill').count(),
    stacks: await guidedPage.locator('.forge-composer-panel-stack').count(),
    panels: await guidedPage.locator('.forge-composer-panel').count(),
    queueItems: await guidedPage.locator('.forge-composer-queue-item').count()
  };
  await guidedPage.evaluate(RESTORE_EXPRESSION);
  await guidedPage.close();

  const {
    page: expandedPage,
    nativeContract: expandedNativeContract,
    themedContract: expandedThemedContract
  } = await newPage('expanded-guided');
  await expandedPage.waitForFunction(() => (
    document.querySelector('.forge-plan-pill') &&
    document.querySelectorAll('.forge-composer-panel-stack').length === 1 &&
    document.querySelectorAll('.forge-composer-panel').length === 2 &&
    document.querySelectorAll('.forge-composer-queue-item').length === 1
  ));
  await expandedPage.locator('.composer-area')
    .screenshot({ path: files.composerExpanded });
  const expandedMarks = {
    plan: await expandedPage.locator('.forge-plan-pill').count(),
    stacks: await expandedPage.locator('.forge-composer-panel-stack').count(),
    panels: await expandedPage.locator('.forge-composer-panel').count(),
    queueItems: await expandedPage.locator('.forge-composer-queue-item').count()
  };
  await expandedPage.evaluate(RESTORE_EXPRESSION);
  await expandedPage.close();

  const {
    page: multiGuidedPage,
    nativeContract: multiGuidedNativeContract,
    themedContract: multiGuidedThemedContract
  } = await newPage('multi-guided');
  await multiGuidedPage.waitForFunction(() => (
    document.querySelector('.forge-plan-pill') &&
    document.querySelectorAll('.forge-composer-panel-stack').length === 1 &&
    document.querySelectorAll('.forge-composer-panel').length === 2 &&
    document.querySelectorAll('.forge-composer-queue-item').length === 2
  ));
  await multiGuidedPage.locator('.composer-area')
    .screenshot({ path: files.composerMultiGuided });
  const multiGuidedMarks = {
    plan: await multiGuidedPage.locator('.forge-plan-pill').count(),
    stacks: await multiGuidedPage.locator('.forge-composer-panel-stack').count(),
    panels: await multiGuidedPage.locator('.forge-composer-panel').count(),
    queueItems: await multiGuidedPage.locator('.forge-composer-queue-item').count()
  };
  await multiGuidedPage.evaluate(RESTORE_EXPRESSION);
  await multiGuidedPage.close();

  fs.writeFileSync(
    path.join(outputDirectory, 'capture.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      source: 'headless native-structure fixture; not real Codex acceptance',
      files,
      metrics,
      states: {
        contextMarks,
        homeContextMarks,
        progressMarks,
        guidedMarks,
        expandedMarks,
        multiGuidedMarks,
        contracts: {
          default: {
            native: defaultNativeContract,
            themed: defaultThemedContract
          },
          context: {
            native: contextNativeContract,
            themed: contextThemedContract
          },
          homeContext: {
            native: homeContextNativeContract,
            themed: homeContextThemedContract
          },
          running: {
            native: runningNativeContract,
            themed: runningThemedContract
          },
          guided: {
            native: guidedNativeContract,
            themed: guidedThemedContract
          },
          expanded: {
            native: expandedNativeContract,
            themed: expandedThemedContract
          },
          multiGuided: {
            native: multiGuidedNativeContract,
            themed: multiGuidedThemedContract
          }
        }
      },
      restoredMarks
    }, null, 2)}\n`,
    'utf8'
  );
  console.log(outputDirectory);
} finally {
  await browser.close();
}

// Playwright's Windows driver can retain an otherwise idle stdio handle after
// browser.close(). The capture is complete at this point; exit explicitly so a
// QA screenshot never leaves a debug helper resident beside Codex.
process.exit(0);
