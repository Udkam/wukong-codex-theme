import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import {
  makeApplyExpression,
  RESTORE_EXPRESSION
} from '../runtime/injection-plan-v13.mjs';
import {
  installComposerState,
  nativeUiBaseline,
  runtimeFixtureHtml
} from './runtime-fixture.mjs';

const styleSheet = fs.readFileSync(
  new URL('../runtime/forge-background-v13.css', import.meta.url),
  'utf8'
);

const texture = color => (
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='16'` +
  `%3E%3Crect width='32' height='16' fill='%23${color}'/%3E%3C/svg%3E")`
);

const variables = [
  ':root.forge-ink-mountain{',
  '--forge-scene-count:1;',
  '--forge-battle-scenes:0;',
  '--forge-battle-primary-scenes:0;',
  '--forge-battle-secondary-scenes:0;',
  '--forge-scenery-scenes:0;',
  `--forge-bg-0:${texture('1b1711')};`,
  '--forge-position-0:center;',
  `--forge-ui-composer-main:${texture('bfa884')};`,
  `--forge-ui-composer-strip:${texture('bca47f')};`,
  `--forge-ui-composer-pill:${texture('c2aa83')};`,
  `--forge-ui-paper-tile:${texture('bfa884')};`,
  `--forge-ui-sidebar-level1:${texture('211f1d')};`,
  `--forge-ui-sidebar-selected:${texture('c9bfb4')};`,
  `--forge-ui-sidebar-level2-hover:${texture('151314')};`,
  '}',
  ':root.forge-ink-mountain[data-forge-scene="0"]{',
  '--forge-scene-brightness:1;',
  '--forge-scene-veil:linear-gradient(rgba(12,14,13,.3),rgba(12,14,13,.3));',
  '}'
].join('');

const expression = makeApplyExpression({ styleSheet, variables });

const selectors = {
  composer: '.composer-surface-chrome',
  editor: '.ProseMirror[role="textbox"]',
  add: '[data-native-slot="composer-add"]',
  access: '[data-native-slot="composer-access"]',
  model: '[data-native-slot="composer-model"]',
  voice: '[data-native-slot="composer-voice"]',
  send: '.composer-footer .send',
  newTask: '[data-native-slot="new-task"]',
  newTaskRow: '[data-native-slot="new-task-row"]',
  newTaskMenu: '[data-native-slot="new-task-menu"]',
  pullRequests: '[data-native-slot="pull-requests"]',
  sites: '[data-native-slot="sites"]',
  scheduled: '[data-native-slot="scheduled"]',
  plugins: '[data-native-slot="plugins"]',
  projectInternalControl: '[data-native-slot="project-internal-control"]',
  menuFile: '[data-native-slot="menu-file"]',
  menuEdit: '[data-native-slot="menu-edit"]',
  menuView: '[data-native-slot="menu-view"]',
  menuHelp: '[data-native-slot="menu-help"]',
  rightPanel: '[data-pip-obstacle="thread-summary-panel"]',
  rightCard: '[data-native-slot="right-card"]',
  rightTitle: '.summary-heading',
  rightRow: '[data-slot="thread-summary-panel-item"]',
  rightAdd: '[data-native-slot="right-add"]',
  rootThread: '[data-app-action-sidebar-section-heading="Tasks"] [data-app-action-sidebar-thread-row]',
  project: '[data-app-action-sidebar-project-row]',
  childThread: '[data-native-slot="project-active"]'
};

const hitSelectors = [
  selectors.add,
  selectors.access,
  selectors.model,
  selectors.voice,
  selectors.send,
  selectors.newTask,
  selectors.newTaskMenu,
  selectors.pullRequests,
  selectors.sites,
  selectors.scheduled,
  selectors.plugins,
  selectors.projectInternalControl,
  selectors.menuFile,
  selectors.menuEdit,
  selectors.menuView,
  selectors.menuHelp,
  selectors.rightAdd,
  selectors.rootThread,
  selectors.project,
  selectors.childThread
];

const snapshot = page => page.evaluate(targets => {
  const read = selector => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`missing fixture selector: ${selector}`);
    const rect = element.getBoundingClientRect();
    return {
      rect: [rect.x, rect.y, rect.width, rect.height],
      text: element.textContent,
      ariaLabel: element.getAttribute('aria-label'),
      ariaCurrent: element.getAttribute('aria-current'),
      ariaSelected: element.getAttribute('aria-selected'),
      ariaExpanded: element.getAttribute('aria-expanded'),
      ariaHaspopup: element.getAttribute('aria-haspopup'),
      role: element.getAttribute('role'),
      type: element.getAttribute('type'),
      tabIndex: element.tabIndex,
      disabled: 'disabled' in element ? element.disabled : null,
      contentEditable: element.getAttribute('contenteditable'),
      placeholder: element.getAttribute('data-placeholder')
    };
  };
  return Object.fromEntries(
    Object.entries(targets).map(([name, selector]) => [name, read(selector)])
  );
}, selectors);

const assertRectsEqual = (
  actual,
  expected,
  tolerance = 0.25,
  ignoredGeometry = new Set()
) => {
  for (const [name, before] of Object.entries(expected)) {
    assert.ok(actual[name], `missing geometry for ${name}`);
    if (!ignoredGeometry.has(name)) {
      actual[name].rect.forEach((value, index) => {
        assert.ok(
          Math.abs(value - before.rect[index]) <= tolerance,
          `${name} rect[${index}] changed from ${before.rect[index]} to ${value}`
        );
      });
    }
    assert.deepEqual(
      { ...actual[name], rect: undefined },
      { ...before, rect: undefined },
      `${name} native semantics changed`
    );
  }
};

const nativeHitPattern = (page, selector) => page.evaluate(target => {
  const element = document.querySelector(target);
  const rect = element.getBoundingClientRect();
  const edgeInset = Math.min(.75, rect.width / 5, rect.height / 5);
  const points = [
    [rect.left + rect.width / 2, rect.top + rect.height / 2],
    [rect.left + edgeInset, rect.top + edgeInset],
    [rect.right - edgeInset, rect.top + edgeInset],
    [rect.left + edgeInset, rect.bottom - edgeInset],
    [rect.right - edgeInset, rect.bottom - edgeInset],
    [rect.left + rect.width / 2, rect.top + edgeInset],
    [rect.left + rect.width / 2, rect.bottom - edgeInset],
    [rect.left + edgeInset, rect.top + rect.height / 2],
    [rect.right - edgeInset, rect.top + rect.height / 2]
  ];
  return points.map(([x, y]) => {
    const hit = document.elementFromPoint(x, y);
    return hit === element || element.contains(hit);
  });
}, selector);

let browser;

test.before(async () => {
  browser = await chromium.launch({ headless: true });
});

test.after(async () => {
  await browser?.close();
});

test('V50 maps composer paper without changing native geometry or content coordinates', async () => {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v14.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v14.test/');

  const before = await snapshot(page);
  const nativeComposerLayout = await page.evaluate(() => {
    const frame = document.querySelector('.composer-surface-chrome');
    const editor = frame.querySelector('.ProseMirror[role="textbox"]');
    const editorShell = editor.parentElement;
    const footer = frame.querySelector('.composer-footer');
    const frameStyle = getComputedStyle(frame);
    return {
      aspectRatio: frameStyle.aspectRatio,
      minHeight: frameStyle.minHeight,
      maxHeight: frameStyle.maxHeight,
      editorPaddingBlockStart: getComputedStyle(editor).paddingBlockStart,
      inputShellPaddingBlockStart: getComputedStyle(editorShell).paddingBlockStart,
      inputShellPaddingInlineStart: getComputedStyle(editorShell).paddingInlineStart,
      footerPaddingInlineStart: getComputedStyle(footer).paddingInlineStart,
      footerMarginBottom: getComputedStyle(footer).marginBottom
    };
  });
  const beforeHits = Object.fromEntries(await Promise.all(
    hitSelectors.map(async selector => [selector, await nativeHitPattern(page, selector)])
  ));
  await page.evaluate(() => {
    window.__forgeClicks = {
      add: 0,
      send: 0,
      newTask: 0,
      newTaskMenu: 0,
      pullRequests: 0,
      sites: 0,
      scheduled: 0,
      plugins: 0,
      projectInternalControl: 0,
      menuFile: 0,
      menuEdit: 0,
      menuView: 0,
      menuHelp: 0
    };
    document.querySelector('[data-native-slot="composer-add"]')
      .addEventListener('click', () => { window.__forgeClicks.add += 1; });
    document.querySelector('.composer-footer .send')
      .addEventListener('click', event => {
        event.preventDefault();
        window.__forgeClicks.send += 1;
      });
    document.querySelector('[data-native-slot="new-task"]')
      .addEventListener('click', () => { window.__forgeClicks.newTask += 1; });
    document.querySelector('[data-native-slot="new-task-menu"]')
      .addEventListener('click', () => { window.__forgeClicks.newTaskMenu += 1; });
    document.querySelector('[data-native-slot="pull-requests"]')
      .addEventListener('click', () => { window.__forgeClicks.pullRequests += 1; });
    document.querySelector('[data-native-slot="sites"]')
      .addEventListener('click', () => { window.__forgeClicks.sites += 1; });
    document.querySelector('[data-native-slot="scheduled"]')
      .addEventListener('click', () => { window.__forgeClicks.scheduled += 1; });
    document.querySelector('[data-native-slot="plugins"]')
      .addEventListener('click', () => { window.__forgeClicks.plugins += 1; });
    document.querySelector('[data-native-slot="project-internal-control"]')
      .addEventListener('click', () => { window.__forgeClicks.projectInternalControl += 1; });
    document.querySelector('[data-native-slot="menu-file"]')
      .addEventListener('click', () => { window.__forgeClicks.menuFile += 1; });
    document.querySelector('[data-native-slot="menu-edit"]')
      .addEventListener('click', () => { window.__forgeClicks.menuEdit += 1; });
    document.querySelector('[data-native-slot="menu-view"]')
      .addEventListener('click', () => { window.__forgeClicks.menuView += 1; });
    document.querySelector('[data-native-slot="menu-help"]')
      .addEventListener('click', () => { window.__forgeClicks.menuHelp += 1; });
  });

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('.composer-surface-chrome')?.classList.contains('forge-composer-frame') &&
    document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ));

  const after = await snapshot(page);
  assertRectsEqual(after, before);
  assert.equal(await page.locator('.forge-composer-frame').count(), 1);
  assert.equal(await page.locator('.forge-composer-input-shell').count(), 1);
  assert.equal(await page.locator('.forge-composer-footer').count(), 1);
  assert.equal(
    await page.locator(
      '[data-native-slot="composer-submit"][type="button"].forge-composer-submit'
    ).count(),
    1,
    'the real type=button send host must receive paint without replacing its semantics'
  );
  assert.equal(await page.locator('.forge-topbar-menu-item').count(), 4);
  assert.equal(
    await page.locator(
      '[class~="group/application-menu-top-bar"] button' +
      '[aria-haspopup="menu"][aria-expanded].forge-topbar-menu-item'
    ).count(),
    4,
    'all four native ASAR application-menu buttons must be mapped structurally'
  );
  assert.equal(await page.locator('.forge-sidebar-shell').count(), 1);
  assert.equal(await page.locator('.forge-sidebar-action').count(), 0);
  assert.equal(await page.locator('.forge-sidebar-level1').count(), 0);
  assert.equal(await page.locator('.forge-sidebar-level2').count(), 0);
  assert.equal(await page.locator('.forge-sidebar-selected').count(), 1);
  assert.equal(
    await page.locator('[data-app-action-sidebar-project-row].forge-sidebar-selected').count(),
    0,
    'non-current project containers must retain the dark level-one material'
  );
  assert.equal(
    await page.locator('[data-app-action-sidebar-project-row].forge-sidebar-level1').count(),
    0,
    'unselected production project rows must not receive themed paint classes'
  );
  assert.equal(
    await page.locator(
      '[data-app-action-sidebar-section-heading="Tasks"] ' +
      '[data-app-action-sidebar-thread-row].forge-sidebar-level1'
    ).count(),
    0,
    'unselected root threads must not receive themed paint classes'
  );
  assert.equal(
    await page.locator(
      '[data-app-action-sidebar-project-list-id] ' +
      '[data-app-action-sidebar-thread-row].forge-sidebar-level2'
    ).count(),
    0,
    'unselected project threads must not receive themed paint classes'
  );
  assert.equal(
    await page.locator(
      '[data-app-action-sidebar-project-row][aria-expanded="true"].forge-sidebar-level1'
    ).count(),
    0,
    'expanded state alone must not add themed paint'
  );
  assert.equal(
    await page.locator(
      '[data-app-action-sidebar-project-row]' +
      '[data-app-action-sidebar-project-collapsed="true"]' +
      '[aria-expanded="false"].forge-sidebar-level1'
    ).count(),
    0,
    'collapsed state alone must not add themed paint'
  );
  assert.equal(
    await page.locator(
      '[data-app-action-sidebar-thread-row][data-app-action-sidebar-thread-active="true"]' +
      '.forge-sidebar-selected'
    ).count(),
    1,
    'production active-thread state must receive the selected material'
  );
  assert.equal(
    await page.locator(
      '[data-root-thread-row], [data-project-row], ' +
      '[data-sidebar-project-row], [data-sidebar-thread-row]'
    ).count(),
    0,
    'the fixture must not depend on superseded fake sidebar attributes'
  );
  assert.equal(
    await page.locator('[data-native-slot="new-task-row"][data-forge-mark]').count(),
    0,
    'unselected top navigation must remain entirely native'
  );
  assert.equal(
    await page.locator('[data-native-slot="plugins"][data-forge-mark]').count(),
    0,
    'unselected Plugins must remain entirely native'
  );
  assert.equal(
    await page.locator('[data-native-slot="plugins"][aria-expanded]').count(),
    0,
    'the fixture must not invent project expansion semantics for Plugins'
  );
  assert.equal(
    await page.locator(
      '[data-app-action-sidebar-project-show-all-toggle][data-forge-mark]'
    ).count(),
    0,
    'internal project controls must not be painted as sidebar rows'
  );

  const paint = await page.evaluate(() => ({
    composer: (() => {
      const element = document.querySelector('.forge-composer-frame');
      const style = getComputedStyle(element);
      const paintStyle = getComputedStyle(element, '::before');
      const rect = element.getBoundingClientRect();
      const controlsRemainHittable = [...element.querySelectorAll('button,[role="button"]')]
        .every(control => {
          const controlRect = control.getBoundingClientRect();
          const hit = document.elementFromPoint(
            controlRect.left + controlRect.width / 2,
            controlRect.top + controlRect.height / 2
          );
          return hit === control || control.contains(hit);
        });
      return {
        backgroundImage: style.backgroundImage,
        aspectRatio: style.aspectRatio,
        minHeight: style.minHeight,
        maxHeight: style.maxHeight,
        borderRadius: style.borderRadius,
        clipPath: style.clipPath,
        pseudoContent: paintStyle.content,
        pseudoPointerEvents: paintStyle.pointerEvents,
        pseudoBackgroundImage: paintStyle.backgroundImage,
        pseudoBackgroundPosition: paintStyle.backgroundPosition,
        pseudoBackgroundRepeat: paintStyle.backgroundRepeat,
        pseudoBackgroundSize: paintStyle.backgroundSize,
        pseudoClipPath: paintStyle.clipPath,
        cornerHitKeepsHost: document
          .elementsFromPoint(rect.left + 1, rect.top + 1)
          .includes(element),
        controlsRemainHittable
      };
    })(),
    composerEditorPaddingBlockStart: getComputedStyle(
      document.querySelector('.forge-composer-frame .ProseMirror[role="textbox"]')
    ).paddingBlockStart,
    composerInputShellPaddingBlockStart: getComputedStyle(
      document.querySelector('.forge-composer-input-shell')
    ).paddingBlockStart,
    composerInputShellPaddingInlineStart: getComputedStyle(
      document.querySelector('.forge-composer-input-shell')
    ).paddingInlineStart,
    composerFooterPaddingInlineStart: getComputedStyle(
      document.querySelector('.forge-composer-footer')
    ).paddingInlineStart,
    composerFooterMarginBottom: getComputedStyle(
      document.querySelector('.forge-composer-footer')
    ).marginBottom,
    sidebarShell: (() => {
      const style = getComputedStyle(document.querySelector('.forge-sidebar-shell'));
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backdropFilter: style.backdropFilter
      };
    })(),
    menu: getComputedStyle(document.querySelector('.forge-topbar-menu-item')).backgroundImage,
    action: getComputedStyle(document.querySelector('[data-native-slot="pull-requests"]')).backgroundImage,
    level1: getComputedStyle(document.querySelector('[data-app-action-sidebar-project-row]')).backgroundImage,
    selected: getComputedStyle(document.querySelector('.forge-sidebar-selected')).backgroundImage,
    level2: getComputedStyle(
      document.querySelector('[data-native-slot="project-temple-child"]')
    ).backgroundImage
  }));
  assert.equal(paint.composer.backgroundImage, 'none');
  assert.match(paint.composer.pseudoBackgroundImage, /data:image\/svg\+xml/);
  assert.ok(
    (paint.composer.pseudoBackgroundImage.match(/data:image\//g) || []).length >= 2,
    'composer paint layer must use the frame and repeatable paper layers'
  );
  assert.equal(paint.composer.pseudoBackgroundRepeat, 'no-repeat, repeat');
  assert.equal(paint.composer.pseudoBackgroundSize, '100% 100%, 512px 220px');
  assert.equal(paint.composer.aspectRatio, nativeComposerLayout.aspectRatio);
  assert.equal(paint.composer.minHeight, nativeComposerLayout.minHeight);
  assert.equal(paint.composer.maxHeight, nativeComposerLayout.maxHeight);
  assert.equal(paint.composer.borderRadius, '0px');
  assert.equal(paint.composer.clipPath, 'none');
  assert.match(paint.composer.pseudoClipPath, /^polygon\(/);
  assert.equal(
    paint.composer.pseudoContent,
    '""',
    'composer paper must be isolated to a paint-only pseudo-element'
  );
  assert.equal(paint.composer.pseudoPointerEvents, 'none');
  assert.equal(
    paint.composer.cornerHitKeepsHost,
    true,
    'the visually cut composer corner must retain the native rectangular host hit area'
  );
  assert.equal(
    paint.composer.controlsRemainHittable,
    true,
    'the composer paint stacking context must not cover native controls'
  );
  assert.equal(
    paint.composerEditorPaddingBlockStart,
    nativeComposerLayout.editorPaddingBlockStart,
    'the editable ProseMirror node itself must keep its native padding'
  );
  assert.equal(
    paint.composerInputShellPaddingBlockStart,
    nativeComposerLayout.inputShellPaddingBlockStart
  );
  assert.equal(
    paint.composerInputShellPaddingInlineStart,
    nativeComposerLayout.inputShellPaddingInlineStart
  );
  assert.equal(
    paint.composerFooterPaddingInlineStart,
    nativeComposerLayout.footerPaddingInlineStart
  );
  assert.equal(paint.composerFooterMarginBottom, nativeComposerLayout.footerMarginBottom);
  assert.equal(paint.sidebarShell.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.match(paint.sidebarShell.backgroundImage, /linear-gradient/);
  assert.equal(
    paint.sidebarShell.backdropFilter,
    'none',
    'the full-window background must show through the sidebar without a GPU blur'
  );
  assert.equal(
    paint.menu,
    'none',
    'the four native application-menu buttons must not receive themed paper'
  );
  assert.equal(paint.action, 'none');
  assert.equal(paint.level1, 'none');
  assert.match(paint.selected, /data:image\/svg\+xml/);
  assert.equal(paint.level2, 'none');

  for (const selector of hitSelectors) {
    assert.deepEqual(
      await nativeHitPattern(page, selector),
      beforeHits[selector],
      `nine-point native hit region changed for ${selector}`
    );
  }

  const menuFile = page.locator(selectors.menuFile);
  const menuEdit = page.locator(selectors.menuEdit);
  const menuView = page.locator(selectors.menuView);
  const menuDefaultImage = await menuFile.evaluate(
    element => getComputedStyle(element).backgroundImage
  );
  assert.equal(menuDefaultImage, 'none');
  await menuFile.hover();
  const menuHover = await menuFile.evaluate(element => ({
    image: getComputedStyle(element).backgroundImage,
    color: getComputedStyle(element).color
  }));
  assert.equal(menuHover.image, menuDefaultImage);
  assert.equal(menuHover.color, 'rgb(163, 166, 166)');
  await page.mouse.move(800, 450);
  await menuEdit.focus();
  assert.equal(await menuEdit.evaluate(element => element.matches(':focus-visible')), true);
  assert.equal(
    await menuEdit.evaluate(element => getComputedStyle(element).backgroundImage),
    menuDefaultImage
  );
  await menuView.evaluate(element => element.setAttribute('aria-expanded', 'true'));
  assert.equal(
    await menuView.evaluate(element => getComputedStyle(element).backgroundImage),
    menuDefaultImage,
    'open native menus must not receive themed paper'
  );
  await menuView.evaluate(element => element.setAttribute('aria-expanded', 'false'));

  await page.locator(selectors.add).click();
  await page.locator(selectors.send).click();
  await page.locator(selectors.newTask).click();
  await page.locator(selectors.newTaskMenu).click();
  await page.locator(selectors.pullRequests).click();
  await page.locator(selectors.sites).click();
  await page.locator(selectors.scheduled).click();
  await page.locator(selectors.plugins).click();
  await page.locator(selectors.projectInternalControl).click();
  await page.locator(selectors.menuFile).click();
  await page.locator(selectors.menuEdit).click();
  await page.locator(selectors.menuView).click();
  await page.locator(selectors.menuHelp).click();
  assert.deepEqual(
    await page.evaluate(() => window.__forgeClicks),
    {
      add: 1,
      send: 1,
      newTask: 1,
      newTaskMenu: 1,
      pullRequests: 1,
      sites: 1,
      scheduled: 1,
      plugins: 1,
      projectInternalControl: 1,
      menuFile: 1,
      menuEdit: 1,
      menuView: 1,
      menuHelp: 1
    }
  );

  await page.evaluate(RESTORE_EXPRESSION);
  await page.waitForFunction(() => !document.querySelector('[data-forge-mark]'));
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  assert.equal(await page.locator('#wukong-forge-background').count(), 0);
  assertRectsEqual(await snapshot(page), before);
  await page.close();
});

test('V35 preserves native unselected sidebar paint and themes only the current selection', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v15-state-matrix.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v15-state-matrix.test/');

  const rectTargets = {
    menuFile: selectors.menuFile,
    menuEdit: selectors.menuEdit,
    menuView: selectors.menuView,
    menuHelp: selectors.menuHelp,
    newTaskRow: selectors.newTaskRow,
    newTask: selectors.newTask,
    newTaskMenu: selectors.newTaskMenu,
    pullRequests: selectors.pullRequests,
    sites: selectors.sites,
    scheduled: selectors.scheduled,
    plugins: selectors.plugins,
    rootThread: selectors.rootThread,
    project: selectors.project,
    childThread: selectors.childThread
  };
  const readRects = () => page.evaluate(targets => Object.fromEntries(
    Object.entries(targets).map(([name, selector]) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return [name, [rect.x, rect.y, rect.width, rect.height]];
    })
  ), rectTargets);
  const beforeRects = await readRects();
  const nativeUnselectedPaint = await page.evaluate(targets => Object.fromEntries(
    Object.entries(targets).map(([name, selector]) => {
      const element = document.querySelector(selector);
      const style = getComputedStyle(element);
      return [name, {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backgroundPosition: style.backgroundPosition,
        backgroundSize: style.backgroundSize,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        color: style.color,
        opacity: style.opacity,
        outlineStyle: style.outlineStyle
      }];
    })
  ), {
    newTask: selectors.newTaskRow,
    pullRequests: selectors.pullRequests,
    sites: selectors.sites,
    scheduled: selectors.scheduled,
    plugins: selectors.plugins,
    rootThread: selectors.rootThread,
    project: selectors.project,
    projectChild: '[data-native-slot="project-temple-child"]'
  });
  const nativeUnreadColor = await page.locator(
    '[data-native-status="unread"] span span'
  ).evaluate(element => getComputedStyle(element).backgroundColor);

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelectorAll('.forge-topbar-menu-item').length === 4 &&
    document.querySelectorAll('.forge-sidebar-selected').length === 1 &&
    document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ));

  assert.equal(
    await page.locator(
      [
        selectors.newTaskRow,
        selectors.pullRequests,
        selectors.sites,
        selectors.scheduled,
        selectors.plugins
      ].map(selector => `${selector}[data-forge-mark]`).join(',')
    ).count(),
    0,
    'all five unselected native sidebar entries must remain unmarked'
  );

  const menuFile = page.locator(selectors.menuFile);
  const menuEdit = page.locator(selectors.menuEdit);
  const menuView = page.locator(selectors.menuView);
  const menuHelp = page.locator(selectors.menuHelp);
  const menuDefault = await menuFile.evaluate(element => ({
    image: getComputedStyle(element).backgroundImage,
    color: getComputedStyle(element).color,
    shadow: getComputedStyle(element).boxShadow
  }));

  await menuFile.hover();
  const menuHover = await menuFile.evaluate(element => ({
    image: getComputedStyle(element).backgroundImage,
    color: getComputedStyle(element).color
  }));
  assert.equal(menuDefault.image, 'none');
  assert.equal(menuHover.image, menuDefault.image);
  assert.equal(menuHover.color, menuDefault.color);

  await page.mouse.move(900, 450);
  await menuEdit.focus();
  assert.equal(await menuEdit.evaluate(element => element.matches(':focus-visible')), true);
  assert.equal(
    await menuEdit.evaluate(element => getComputedStyle(element).boxShadow),
    menuDefault.shadow
  );
  assert.notEqual(
    await menuEdit.evaluate(element => getComputedStyle(element).outlineStyle),
    'none',
    'native browser focus outline must remain available'
  );

  await menuView.evaluate(element => element.setAttribute('aria-expanded', 'true'));
  assert.equal(
    await menuView.evaluate(element => getComputedStyle(element).backgroundImage),
    menuDefault.image
  );
  await menuView.evaluate(element => element.setAttribute('aria-expanded', 'false'));

  await menuHelp.evaluate(element => element.dataset.state = 'open');
  assert.equal(
    await menuHelp.evaluate(element => getComputedStyle(element).backgroundImage),
    menuDefault.image,
    'data-state=open must retain native menu paint'
  );
  await menuHelp.evaluate(element => delete element.dataset.state);

  await page.evaluate(() => {
    window.__disabledMenuClicks = 0;
    const menu = document.querySelector('[data-native-slot="menu-file"]');
    menu.addEventListener('click', () => { window.__disabledMenuClicks += 1; });
    menu.disabled = true;
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="menu-file"]')?.disabled === true
  ));
  await menuFile.hover();
  const disabledMenu = await menuFile.evaluate(element => ({
    image: getComputedStyle(element).backgroundImage,
    shadow: getComputedStyle(element).boxShadow,
    opacity: getComputedStyle(element).opacity
  }));
  assert.equal(disabledMenu.image, menuDefault.image);
  assert.equal(disabledMenu.shadow, menuDefault.shadow);
  assert.equal(disabledMenu.opacity, '1');
  await menuFile.evaluate(element => element.click());
  assert.equal(await page.evaluate(() => window.__disabledMenuClicks), 0);
  await menuFile.evaluate(element => { element.disabled = false; });

  const themedUnselectedPaint = await page.evaluate(targets => Object.fromEntries(
    Object.entries(targets).map(([name, selector]) => {
      const element = document.querySelector(selector);
      const style = getComputedStyle(element);
      return [name, {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        backgroundPosition: style.backgroundPosition,
        backgroundSize: style.backgroundSize,
        borderColor: style.borderColor,
        boxShadow: style.boxShadow,
        color: style.color,
        opacity: style.opacity,
        outlineStyle: style.outlineStyle
      }];
    })
  ), {
    newTask: selectors.newTaskRow,
    pullRequests: selectors.pullRequests,
    sites: selectors.sites,
    scheduled: selectors.scheduled,
    plugins: selectors.plugins,
    rootThread: selectors.rootThread,
    project: selectors.project,
    projectChild: '[data-native-slot="project-temple-child"]'
  });
  assert.deepEqual(
    themedUnselectedPaint,
    nativeUnselectedPaint,
    'unselected sidebar rows must retain their exact native paint'
  );

  const newTaskRow = page.locator(selectors.newTaskRow);
  const newTask = page.locator(selectors.newTask);
  const newTaskMenu = page.locator(selectors.newTaskMenu);
  const actionDefault = nativeUnselectedPaint.newTask;
  await newTaskRow.hover();
  assert.notEqual(
    await newTaskRow.evaluate(element => getComputedStyle(element).backgroundColor),
    actionDefault.backgroundColor,
    'native action hover must remain available'
  );
  await page.mouse.move(900, 450);
  await newTask.focus();
  assert.equal(await newTask.evaluate(element => element.matches(':focus-visible')), true);
  await newTaskMenu.evaluate(element => element.dataset.state = 'open');
  assert.equal(
    await newTaskRow.evaluate(element => getComputedStyle(element).backgroundImage),
    actionDefault.backgroundImage,
    'opening an unselected trailing menu must not add themed paper'
  );
  await newTaskMenu.evaluate(element => element.dataset.state = 'closed');

  await page.locator(selectors.pullRequests).evaluate(element => {
    element.setAttribute('aria-current', 'page');
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="pull-requests"]')
      ?.classList.contains('forge-sidebar-action-active')
  ));
  assert.notEqual(
    await page.locator(selectors.pullRequests).evaluate(
      element => getComputedStyle(element).backgroundImage
    ),
    actionDefault.backgroundImage
  );
  const activeActionPaint = await page.locator(selectors.pullRequests).evaluate(element => ({
    backgroundImage: getComputedStyle(element).backgroundImage,
    shadow: getComputedStyle(element).boxShadow,
    color: getComputedStyle(element).color,
    descendantColors: [...element.querySelectorAll('span, svg')]
      .map(child => getComputedStyle(child).color)
  }));
  assert.equal(activeActionPaint.color, 'rgb(47, 40, 34)');
  assert.ok(
    activeActionPaint.descendantColors.every(color => color === 'rgb(47, 40, 34)'),
    `active action descendants did not switch to dark ink: ${
      activeActionPaint.descendantColors.join(', ')
    }`
  );
  assert.doesNotMatch(
    `${activeActionPaint.backgroundImage} ${activeActionPaint.shadow}`,
    /(?:157,\s*63,\s*38|133,\s*56,\s*35)/,
    'active action retained the rejected lacquer-red left edge'
  );
  await page.locator(selectors.pullRequests).evaluate(element => {
    element.removeAttribute('aria-current');
  });
  await page.waitForFunction(() => (
    !document.querySelector('[data-native-slot="pull-requests"]')
      ?.classList.contains('forge-sidebar-action-active')
  ));

  await page.locator(selectors.sites).evaluate(element => {
    element.dataset.state = 'active';
  });
  await page.waitForTimeout(80);
  assert.equal(
    await page.locator(`${selectors.sites}.forge-sidebar-action-active`).count(),
    0,
    'generic data-state=active must not be mistaken for native current navigation'
  );
  await page.locator(selectors.sites).evaluate(element => {
    delete element.dataset.state;
  });

  assert.equal(
    await page.locator('[data-native-slot="project-active"] [data-thread-title]').evaluate(
      element => getComputedStyle(element).color
    ),
    'rgb(47, 40, 34)',
    'the pale current-thread material must use dark ink text'
  );

  const nativeIndicators = await page.evaluate(() => {
    const unread = document.querySelector('[data-native-status="unread"] span span');
    const spinner = document.querySelector('[data-native-status="running"] .animate-spin');
    const spinnerStyle = getComputedStyle(spinner);
    return {
      unreadColor: getComputedStyle(unread).backgroundColor,
      spinnerColor: spinnerStyle.color,
      spinnerAnimationName: spinnerStyle.animationName,
      spinnerAnimationDuration: spinnerStyle.animationDuration
    };
  });
  assert.equal(nativeIndicators.unreadColor, nativeUnreadColor);
  assert.equal(nativeIndicators.spinnerColor, 'rgb(47, 40, 34)');
  assert.equal(nativeIndicators.spinnerAnimationName, 'fixture-spin');
  assert.equal(nativeIndicators.spinnerAnimationDuration, '2s');
  assert.equal(
    await page.locator('[data-native-slot="project-internal-control"][data-forge-mark]').count(),
    0
  );
  assert.equal(
    await page.locator('[data-native-slot="project-thread-menu"][data-forge-mark]').count(),
    0,
    'native thread menus must not become selected-paper surfaces'
  );

  const afterRects = await readRects();
  for (const [name, before] of Object.entries(beforeRects)) {
    afterRects[name].forEach((value, index) => {
      assert.ok(
        Math.abs(value - before[index]) <= 0.25,
        `${name} rect[${index}] changed from ${before[index]} to ${value}`
      );
    });
  }

  const selectedPaperGeometry = slot => page.locator(
    `[data-native-slot="${slot}"]`
  ).evaluate(element => {
    const list = element.closest('[data-app-action-sidebar-project-list-id]');
    const rect = element.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const style = getComputedStyle(element);
    const ancestorPaint = [];
    for (let cursor = element.parentElement; cursor; cursor = cursor.parentElement) {
      ancestorPaint.push({
        marked: cursor.hasAttribute('data-forge-mark'),
        selected: cursor.classList.contains('forge-sidebar-selected'),
        backgroundImage: getComputedStyle(cursor).backgroundImage
      });
      if (cursor === list) break;
    }
    return {
      rowCount: list.querySelectorAll('[data-app-action-sidebar-thread-row]').length,
      rowWidth: rect.width,
      listWidth: listRect.width,
      backgroundOrigin: style.backgroundOrigin,
      backgroundClip: style.backgroundClip,
      ancestorPaint
    };
  });
  const multiThreadSelection = await selectedPaperGeometry('project-active');
  assert.equal(multiThreadSelection.rowCount, 2);
  assert.ok(Math.abs(multiThreadSelection.rowWidth - multiThreadSelection.listWidth) <= .25);
  assert.equal(
    await page.locator('.forge-sidebar-selected').count(),
    1,
    'only the explicit native row may own selected paper in a multi-thread project'
  );
  assert.ok(
    multiThreadSelection.ancestorPaint.every(ancestor => (
      !ancestor.marked &&
      !ancestor.selected &&
      ancestor.backgroundImage === 'none'
    )),
    'multi-thread sortable, animation, listitem, and list wrappers must remain unpainted'
  );

  const immediatePersistentSelection = await page.evaluate(() => {
    const multi = document.querySelector('[data-native-slot="project-active"]');
    const single = document.querySelector('[data-native-slot="project-temple-child"]');
    multi.removeAttribute('data-app-action-sidebar-thread-active');
    multi.removeAttribute('aria-current');
    single.setAttribute('data-app-action-sidebar-thread-active', 'true');
    single.setAttribute('aria-current', 'page');
    return {
      oldMarkerStillPresent: multi.classList.contains('forge-sidebar-selected'),
      newMarkerNotYetPresent: !single.classList.contains('forge-sidebar-selected'),
      oldBackgroundImage: getComputedStyle(multi).backgroundImage,
      newBackgroundImage: getComputedStyle(single).backgroundImage
    };
  });
  assert.equal(immediatePersistentSelection.oldMarkerStillPresent, true);
  assert.equal(immediatePersistentSelection.newMarkerNotYetPresent, true);
  assert.equal(immediatePersistentSelection.oldBackgroundImage, 'none');
  assert.notEqual(immediatePersistentSelection.newBackgroundImage, 'none');
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="project-temple-child"]')
      ?.classList.contains('forge-sidebar-selected') &&
    !document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ));
  const singleThreadSelection = await selectedPaperGeometry('project-temple-child');
  assert.equal(singleThreadSelection.rowCount, 1);
  assert.ok(Math.abs(singleThreadSelection.rowWidth - singleThreadSelection.listWidth) <= .25);
  assert.equal(
    await page.locator('.forge-sidebar-selected').count(),
    1,
    'a one-thread project must not paint its sortable or animation wrappers'
  );
  assert.ok(
    singleThreadSelection.ancestorPaint.every(ancestor => (
      !ancestor.marked &&
      !ancestor.selected &&
      ancestor.backgroundImage === 'none'
    )),
    'single-thread sortable, animation, listitem, and list wrappers must remain unpainted'
  );
  assert.ok(
    Math.abs(singleThreadSelection.rowWidth - multiThreadSelection.rowWidth) <= .25,
    'single-thread and multi-thread projects must use the same selected-paper width'
  );
  assert.deepEqual(
    {
      origin: singleThreadSelection.backgroundOrigin,
      clip: singleThreadSelection.backgroundClip
    },
    {
      origin: multiThreadSelection.backgroundOrigin,
      clip: multiThreadSelection.backgroundClip
    }
  );

  await page.evaluate(() => {
    const multi = document.querySelector('[data-native-slot="project-active"]');
    const single = document.querySelector('[data-native-slot="project-temple-child"]');
    single.removeAttribute('data-app-action-sidebar-thread-active');
    single.removeAttribute('aria-current');
    multi.setAttribute('data-app-action-sidebar-thread-active', 'true');
    multi.setAttribute('aria-current', 'page');
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ));

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V16 maps the native guided stack once and remaps context without a resize trigger', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v14-state.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v14-state.test/');
  await installComposerState(page, 'guided');

  const nativeStateContract = await page.evaluate(() => {
    const rectOf = element => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      };
    };
    const root = document.querySelector('[data-codex-composer-root]');
    const portal = root.querySelector(
      ':scope > [data-above-composer-portal][data-above-composer-conversation-id]'
    );
    const composer = root.querySelector('.composer-surface-chrome');
    const component = [...root.children].find(child => (
      child !== portal && child.contains(composer)
    ));
    const editor = composer.querySelector('.ProseMirror[role="textbox"]');
    const submit = composer.querySelector('[data-native-slot="composer-submit"]');
    const footer = submit.closest('div.select-none');
    const footerButtons = [...footer.querySelectorAll('button')].filter(button => {
      const rect = button.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
    const controlGroupButtons = [
      ...submit.parentElement.querySelectorAll('button')
    ].filter(button => {
      const rect = button.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    });
    const progressHost = portal.querySelector('.native-progress-host');
    const progressFade = portal.querySelector('.native-progress-gradient');
    const progress = portal.querySelector('[data-fixture-control="plan"]');
    const stack = root.querySelector('[data-fixture-surface="composer-stack"]');
    const queued = root.querySelector('[data-fixture-surface="queued-panel"]');
    const goal = root.querySelector('[data-fixture-surface="goal-panel"]');
    return {
      composer: rectOf(composer),
      editor: rectOf(editor),
      submit: rectOf(submit),
      progressHost: rectOf(progressHost),
      progressFade: rectOf(progressFade),
      progressFadeRelative: [
        progressFade.getBoundingClientRect().x - progressHost.getBoundingClientRect().x,
        progressFade.getBoundingClientRect().y - progressHost.getBoundingClientRect().y,
        progressFade.getBoundingClientRect().width,
        progressFade.getBoundingClientRect().height
      ],
      progress: rectOf(progress),
      stack: rectOf(stack),
      queued: rectOf(queued),
      goal: rectOf(goal),
      stackSharedParent: queued.parentElement === goal.parentElement,
      portalIsDirectChild: portal.parentElement === root,
      componentIsDirectChild: component.parentElement === root,
      componentUsesProductionSignature: [
        'relative',
        'flex',
        'w-full',
        'flex-col',
        'gap-2'
      ].every(token => component.classList.contains(token)),
      fixtureDoesNotDeclareComponentIdentity: !root.querySelector(
        '[data-native-composer-component]'
      ),
      stackInsideComponent: component.contains(stack),
      progressInsidePortal: portal.contains(progress),
      progressFadeWithinHost: progressHost.contains(progressFade),
      progressFadeInsideMotionLayer: progressFade.parentElement
        ?.classList.contains('native-progress-layer'),
      progressFadeSignature: [
        'pointer-events-none',
        'absolute',
        'inset-x-0',
        '-bottom-1',
        'h-7',
        'bg-gradient-to-t',
        'from-token-main-surface-primary',
        'to-transparent'
      ].every(token => progressFade.classList.contains(token)),
      progressInsideStack: stack.contains(progress),
      stackInsidePortal: portal.contains(stack),
      progressSignature: [
        'flex',
        'w-max',
        'max-w-full',
        'min-w-0',
        'items-center',
        'gap-2',
        'rounded-3xl',
        'border',
        'px-3',
        'py-1.5'
      ].every(token => progress.classList.contains(token)),
      submitSignature: [
        'cursor-interaction',
        'size-token-button-composer',
        'flex',
        'items-center',
        'justify-center',
        'rounded-full',
        'transition-opacity',
        'focus-visible:outline-2'
      ].every(token => submit.classList.contains(token)),
      footerSignature: [
        'select-none',
        '_footer_uoylu_2'
      ].every(token => footer.classList.contains(token)),
      submitIsLastFooterButton: footerButtons.at(-1) === submit,
      submitIsLastControlGroupButton: controlGroupButtons.at(-1) === submit,
      submitLabel: submit.getAttribute('aria-label'),
      submitType: submit.getAttribute('type'),
      stopSquare: submit.querySelector('rect')?.getAttribute('width')
    };
  });
  assert.equal(nativeStateContract.composer.height, 84);
  assert.equal(nativeStateContract.editor.height, nativeUiBaseline.composerEditorMinHeight);
  assert.deepEqual(
    [nativeStateContract.submit.width, nativeStateContract.submit.height],
    [nativeUiBaseline.composerButtonSize, nativeUiBaseline.composerButtonSize]
  );
  assert.equal(nativeStateContract.progressHost.height, 32);
  assert.ok(nativeStateContract.progress.width < nativeStateContract.composer.width * .8);
  assert.ok(
    Math.abs(
      nativeStateContract.progress.x + nativeStateContract.progress.width / 2 -
      (nativeStateContract.composer.x + nativeStateContract.composer.width / 2)
    ) <= .25,
    'native progress pill must remain content-width and centered over the composer'
  );
  assert.equal(nativeStateContract.stackSharedParent, true);
  assert.equal(nativeStateContract.portalIsDirectChild, true);
  assert.equal(nativeStateContract.componentIsDirectChild, true);
  assert.equal(nativeStateContract.componentUsesProductionSignature, true);
  assert.equal(nativeStateContract.fixtureDoesNotDeclareComponentIdentity, true);
  assert.equal(nativeStateContract.stackInsideComponent, true);
  assert.equal(nativeStateContract.progressInsidePortal, true);
  assert.equal(nativeStateContract.progressFadeWithinHost, true);
  assert.equal(nativeStateContract.progressFadeInsideMotionLayer, true);
  assert.equal(nativeStateContract.progressFadeSignature, true);
  assert.equal(nativeStateContract.progressInsideStack, false);
  assert.equal(nativeStateContract.stackInsidePortal, false);
  assert.equal(nativeStateContract.progressSignature, true);
  assert.equal(nativeStateContract.submitSignature, true);
  assert.equal(nativeStateContract.footerSignature, true);
  assert.equal(nativeStateContract.submitIsLastFooterButton, true);
  assert.equal(nativeStateContract.submitIsLastControlGroupButton, true);
  assert.ok(
    Math.abs(nativeStateContract.queued.bottom - nativeStateContract.goal.y) <= .25,
    'queued and active-goal rows must be contiguous without a card gap'
  );
  assert.ok(
    Math.abs(
      nativeStateContract.stack.width -
      (nativeStateContract.composer.width - (2 * 13))
    ) <= .25,
    'the native above-composer stack must keep the official 13px side inset'
  );
  assert.equal(nativeStateContract.submitLabel, '停止');
  assert.equal(nativeStateContract.submitType, 'button');
  assert.equal(nativeStateContract.stopSquare, '6');

  const adjacentBefore = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('[data-fixture-surface], [data-fixture-control]')].map(element => {
      const rect = element.getBoundingClientRect();
      return [
        element.dataset.fixtureSurface || element.dataset.fixtureControl,
        [rect.x, rect.y, rect.width, rect.height]
      ];
    })
  ));

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('[data-fixture-control="plan"]')
      ?.classList.contains('forge-composer-progress-pill') &&
    document.querySelector('[data-fixture-control="plan"]')
      ?.classList.contains('forge-plan-pill') &&
    document.querySelector('.native-progress-gradient')
      ?.classList.contains('forge-composer-progress-fade') &&
    document.querySelector('[data-fixture-surface="composer-stack"]')
      ?.classList.contains('forge-composer-panel-stack') &&
    document.querySelectorAll('.forge-composer-panel').length === 2 &&
    document.querySelectorAll('.forge-composer-queue-item').length === 1 &&
    document.querySelector('[data-native-slot="composer-submit"]')
      ?.classList.contains('forge-composer-submit')
  ));

  assert.equal(await page.locator('.forge-composer-context').count(), 0);
  assert.equal(await page.locator('.forge-composer-panel-stack').count(), 1);
  assert.equal(await page.locator('.forge-composer-panel').count(), 2);
  assert.equal(await page.locator('.forge-composer-queue-item').count(), 1);
  assert.equal(await page.locator('.forge-composer-progress-pill').count(), 1);
  assert.equal(await page.locator('.forge-composer-progress-fade').count(), 1);
  assert.equal(await page.locator('.forge-plan-pill').count(), 1);
  assert.equal(await page.locator('.forge-diff-summary').count(), 1);
  const guidedPaint = await page.evaluate(() => {
    const stack = document.querySelector('.forge-composer-panel-stack');
    const stackStyle = getComputedStyle(stack);
    const stackPaintStyle = getComputedStyle(stack, '::before');
    const panelPaint = [...stack.querySelectorAll(':scope > .forge-composer-panel')]
      .map(panel => {
        const panelStyle = getComputedStyle(panel);
        const paintStyle = getComputedStyle(panel, '::before');
        const capStyle = getComputedStyle(panel, '::after');
        const controls = [...panel.querySelectorAll('button,[role="button"]')];
        const previousPanelPointerEvents = panel.style.pointerEvents;
        const previousControlPointerEvents = controls.map(
          control => control.style.pointerEvents
        );
        panel.style.pointerEvents = 'auto';
        controls.forEach(control => {
          control.style.pointerEvents = 'auto';
        });
        const controlsRemainHittable = controls.every(control => {
          const controlRect = control.getBoundingClientRect();
          const hit = document.elementFromPoint(
            controlRect.left + controlRect.width / 2,
            controlRect.top + controlRect.height / 2
          );
          return hit === control || control.contains(hit);
        });
        panel.style.pointerEvents = previousPanelPointerEvents;
        controls.forEach((control, index) => {
          control.style.pointerEvents = previousControlPointerEvents[index];
        });
        return {
          panelClipPath: panelStyle.clipPath,
          panelBackgroundImage: panelStyle.backgroundImage,
          panelBorderRadius: panelStyle.borderRadius,
          panelBorderColors: [
            panelStyle.borderTopColor,
            panelStyle.borderRightColor,
            panelStyle.borderBottomColor,
            panelStyle.borderLeftColor
          ],
          panelBackdropFilter: panelStyle.backdropFilter,
          paintContent: paintStyle.content,
          paintClipPath: paintStyle.clipPath,
          paintBackgroundSize: paintStyle.backgroundSize,
          paintBackgroundPosition: paintStyle.backgroundPosition,
          paintPointerEvents: paintStyle.pointerEvents,
          capContent: capStyle.content,
          capClipPath: capStyle.clipPath,
          capBackgroundImage: capStyle.backgroundImage,
          capBackgroundSize: capStyle.backgroundSize,
          controlsRemainHittable
        };
      });
    const queueItemPaint = [...stack.querySelectorAll('.forge-composer-queue-item')]
      .map(item => {
        const itemStyle = getComputedStyle(item);
        const paintStyle = getComputedStyle(item, '::before');
        return {
          itemClipPath: itemStyle.clipPath,
          itemBackgroundImage: itemStyle.backgroundImage,
          itemBorderRadius: itemStyle.borderRadius,
          itemBorderColors: [
            itemStyle.borderTopColor,
            itemStyle.borderRightColor,
            itemStyle.borderBottomColor,
            itemStyle.borderLeftColor
          ],
          itemBackdropFilter: itemStyle.backdropFilter,
          paintContent: paintStyle.content,
          paintClipPath: paintStyle.clipPath,
          paintBackgroundImage: paintStyle.backgroundImage,
          paintBackgroundSize: paintStyle.backgroundSize,
          paintBoxShadow: paintStyle.boxShadow,
          paintPointerEvents: paintStyle.pointerEvents
        };
      });
    const pillStyle = getComputedStyle(
      document.querySelector('.forge-composer-progress-pill')
    );
    const fade = document.querySelector('.forge-composer-progress-fade');
    const fadeHost = fade.closest('.native-progress-host');
    const fadeStyle = getComputedStyle(fade);
    const fadeRect = fade.getBoundingClientRect();
    const fadeHostRect = fadeHost.getBoundingClientRect();
    return {
      stackClipPath: stackStyle.clipPath,
      stackBackgroundImage: stackStyle.backgroundImage,
      stackBorderColors: [
        stackStyle.borderTopColor,
        stackStyle.borderRightColor,
        stackStyle.borderBottomColor,
        stackStyle.borderLeftColor
      ],
      stackBackdropFilter: stackStyle.backdropFilter,
      stackPaintContent: stackPaintStyle.content,
      stackBorderRadius: stackStyle.borderRadius,
      panelPaint,
      queueItemPaint,
      pillBorderRadius: pillStyle.borderRadius,
      fade: {
        relativeRect: [
          fadeRect.x - fadeHostRect.x,
          fadeRect.y - fadeHostRect.y,
          fadeRect.width,
          fadeRect.height
        ],
        backgroundColor: fadeStyle.backgroundColor,
        backgroundImage: fadeStyle.backgroundImage,
        opacity: fadeStyle.opacity
      }
    };
  });
  assert.equal(
    guidedPaint.stackClipPath,
    'none',
    'the live joined queue/goal host must retain its rectangular native hit area'
  );
  assert.equal(guidedPaint.stackBackgroundImage, 'none');
  assert.deepEqual(
    guidedPaint.stackBorderColors,
    Array(4).fill('rgba(0, 0, 0, 0)'),
    'the native stack border must be visually transparent without changing its box'
  );
  assert.equal(guidedPaint.stackBackdropFilter, 'none');
  assert.equal(
    guidedPaint.stackPaintContent,
    'none',
    'the stack must not stretch one paper image over multiple native rows'
  );
  assert.equal(guidedPaint.stackBorderRadius, '0px');
  assert.equal(guidedPaint.panelPaint.length, 2);
  guidedPaint.panelPaint.forEach((row, index) => {
    assert.equal(row.panelClipPath, 'none');
    assert.equal(row.panelBackgroundImage, 'none');
    assert.equal(row.panelBorderRadius, '0px');
    assert.deepEqual(row.panelBorderColors, Array(4).fill('rgba(0, 0, 0, 0)'));
    assert.equal(row.panelBackdropFilter, 'none');
    assert.equal(row.paintContent, '""');
    assert.equal(
      row.paintClipPath,
      index === 0
        ? 'polygon(8px 0px, calc(100% - 8px) 0px, 100% 8px, 100% 100%, 0px 100%, 0px 8px)'
        : 'none',
      'only the first native outer panel may own the two exterior top corners'
    );
    assert.equal(
      row.paintBackgroundSize,
      '100% 100%, 512px 220px',
      'every outer panel must retain an independent non-stretched paper field'
    );
    assert.match(
      row.paintBackgroundPosition,
      /^50% 50%/,
      'outer rows must use the same continuous paper registration'
    );
    assert.equal(row.paintPointerEvents, 'none');
    assert.equal(row.capContent, index === 0 ? '""' : 'none');
    if (index === 0) {
      assert.notEqual(row.capBackgroundImage, 'none');
      assert.equal(row.capBackgroundSize, '100% 58px');
      assert.equal(
        row.capClipPath,
        'polygon(8px 0px, calc(100% - 8px) 0px, 100% 8px, 100% 100%, 0px 100%, 0px 8px)'
      );
    }
    assert.equal(
      row.controlsRemainHittable,
      true,
      'a row paper layer must not cover its native controls'
    );
  });
  assert.equal(guidedPaint.queueItemPaint.length, 1);
  for (const item of guidedPaint.queueItemPaint) {
    assert.equal(item.itemClipPath, 'none');
    assert.equal(item.itemBackgroundImage, 'none');
    assert.equal(item.itemBorderRadius, '0px');
    assert.deepEqual(item.itemBorderColors, Array(4).fill('rgba(0, 0, 0, 0)'));
    assert.equal(item.itemBackdropFilter, 'none');
    assert.equal(item.paintContent, '""');
    assert.equal(item.paintClipPath, 'none');
    assert.notEqual(item.paintBackgroundImage, 'none');
    assert.equal(item.paintBackgroundSize, '512px 220px');
    assert.equal(item.paintBoxShadow, 'none');
    assert.equal(item.paintPointerEvents, 'none');
  }
  assert.equal(
    guidedPaint.pillBorderRadius,
    '999px',
    'the separate progress pill remains rounded on all sides'
  );
  assert.deepEqual(
    guidedPaint.fade.relativeRect,
    nativeStateContract.progressFadeRelative,
    'the native fade geometry relative to its host must remain untouched'
  );
  assert.equal(guidedPaint.fade.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(guidedPaint.fade.backgroundImage, 'none');
  assert.equal(guidedPaint.fade.opacity, '0');
  const driftedFadeContract = await page.evaluate(() => {
    const fade = document.querySelector('.native-progress-gradient');
    const host = fade.closest('.native-progress-host');
    const before = fade.getBoundingClientRect();
    const hostBefore = host.getBoundingClientRect();
    fade.classList.remove(
      'bg-gradient-to-t',
      'from-token-main-surface-primary',
      'to-transparent',
      'forge-composer-progress-fade'
    );
    delete fade.dataset.forgeMark;
    window.__wukongCodexForgeRuntimeV13.refresh();
    const after = fade.getBoundingClientRect();
    const hostAfter = host.getBoundingClientRect();
    const style = getComputedStyle(fade);
    return {
      marked: fade.classList.contains('forge-composer-progress-fade'),
      relativeBefore: [
        before.x - hostBefore.x,
        before.y - hostBefore.y,
        before.width,
        before.height
      ],
      relativeAfter: [
        after.x - hostAfter.x,
        after.y - hostAfter.y,
        after.width,
        after.height
      ],
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      opacity: style.opacity
    };
  });
  assert.equal(
    driftedFadeContract.marked,
    true,
    'the source-backed fade must survive packaged Tailwind palette-token drift'
  );
  assert.deepEqual(
    driftedFadeContract.relativeAfter,
    driftedFadeContract.relativeBefore,
    'palette-token drift recovery must preserve the native fade geometry'
  );
  assert.equal(driftedFadeContract.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(driftedFadeContract.backgroundImage, 'none');
  assert.equal(driftedFadeContract.opacity, '0');
  assert.equal(
    await page.locator('[data-native-slot="composer-submit"]').getAttribute('aria-label'),
    '停止'
  );
  const themedComposerRect = await page.locator('.forge-composer-frame').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height];
  });
  const nativeComposerRect = [
    nativeStateContract.composer.x,
    nativeStateContract.composer.y,
    nativeStateContract.composer.width,
    nativeStateContract.composer.height
  ];
  themedComposerRect.forEach((value, index) => {
    assert.ok(
      Math.abs(value - nativeComposerRect[index]) <= .25,
      `themed composer rect[${index}] changed from ${nativeComposerRect[index]} to ${value}`
    );
  });

  const adjacentAfter = await page.evaluate(() => Object.fromEntries(
    [...document.querySelectorAll('[data-fixture-surface], [data-fixture-control]')].map(element => {
      const rect = element.getBoundingClientRect();
      return [
        element.dataset.fixtureSurface || element.dataset.fixtureControl,
        [rect.x, rect.y, rect.width, rect.height]
      ];
    })
  ));
  for (const [key, beforeRect] of Object.entries(adjacentBefore)) {
    const afterRect = adjacentAfter[key];
    assert.ok(afterRect, `missing adjacent surface ${key}`);
    if (key !== 'goal') {
      assert.ok(Math.abs(afterRect[0] - beforeRect[0]) <= 0.25, `${key} x changed`);
    }
    assert.ok(Math.abs(afterRect[2] - beforeRect[2]) <= 0.25, `${key} width changed`);
    assert.ok(Math.abs(afterRect[3] - beforeRect[3]) <= 0.25, `${key} height changed`);
  }

  await installComposerState(page, 'multi-guided');
  await page.waitForFunction(() => (
    document.querySelectorAll('.forge-composer-panel-stack').length === 1 &&
    document.querySelectorAll('.forge-composer-panel').length === 2 &&
    document.querySelectorAll('.forge-composer-queue-item').length === 2
  ));
  const multiRowPaint = await page.evaluate(() => {
    const stack = document.querySelector('.forge-composer-panel-stack');
    const rows = [...stack.querySelectorAll(':scope > .forge-composer-panel')];
    const queueItems = [...stack.querySelectorAll('.forge-composer-queue-item')];
    return {
      stackPaintContent: getComputedStyle(stack, '::before').content,
      rows: rows.map(row => {
        const rect = row.getBoundingClientRect();
        const paint = getComputedStyle(row, '::before');
        const cap = getComputedStyle(row, '::after');
        return {
          y: rect.y,
          height: rect.height,
          content: paint.content,
          backgroundSize: paint.backgroundSize,
          clipPath: paint.clipPath,
          capContent: cap.content
        };
      }),
      queueItems: queueItems.map(item => {
        const rect = item.getBoundingClientRect();
        const paint = getComputedStyle(item, '::before');
        return {
          y: rect.y,
          height: rect.height,
          content: paint.content,
          backgroundSize: paint.backgroundSize,
          clipPath: paint.clipPath,
          boxShadow: paint.boxShadow
        };
      })
    };
  });
  assert.equal(multiRowPaint.stackPaintContent, 'none');
  assert.equal(multiRowPaint.rows.length, 2);
  multiRowPaint.rows.forEach((row, index) => {
    assert.equal(row.content, '""', `outer row ${index + 1} must own a paper field`);
    assert.equal(row.backgroundSize, '100% 100%, 512px 220px');
    assert.equal(
      row.clipPath,
      index === 0
        ? 'polygon(8px 0px, calc(100% - 8px) 0px, 100% 8px, 100% 100%, 0px 100%, 0px 8px)'
        : 'none'
    );
    assert.equal(row.capContent, index === 0 ? '""' : 'none');
    if (index > 0) {
      const previous = multiRowPaint.rows[index - 1];
      assert.ok(
        Math.abs(previous.y + previous.height - row.y) <= .25,
        'native rows must remain contiguous while each receives its own paper layer'
      );
    }
  });
  assert.equal(multiRowPaint.queueItems.length, 2);
  multiRowPaint.queueItems.forEach((item, index) => {
    assert.equal(item.content, '""', `queued message ${index + 1} must own one paper leaf`);
    assert.equal(item.backgroundSize, '512px 220px');
    assert.equal(item.clipPath, 'none');
    assert.equal(item.boxShadow, 'none');
    if (index > 0) {
      const previous = multiRowPaint.queueItems[index - 1];
      const nativeGap = item.y - (previous.y + previous.height);
      assert.ok(
        nativeGap >= .75 && nativeGap <= 1.25,
        'queued messages must retain the native one-pixel seam'
      );
    }
  });

  const contextGeometry = await installComposerState(page, 'context');
  await page.waitForFunction(() => (
    document.querySelector('[data-fixture-surface="composer-context"]')
      ?.classList.contains('forge-composer-context') &&
    !document.querySelector('.forge-composer-panel-stack') &&
    !document.querySelector('.forge-composer-panel')
  ));
  assert.equal(await page.locator('.forge-composer-context').count(), 1);
  assert.equal(await page.locator('.forge-plan-pill').count(), 0);
  assert.equal(
    await page.locator('[data-native-slot="composer-submit"]').getAttribute('aria-label'),
    null
  );
  const contextAfter = await page.locator(
    '[data-fixture-surface="composer-context"]'
  ).evaluate(element => {
    const rect = element.getBoundingClientRect();
    return [rect.x, rect.y, rect.width, rect.height];
  });
  assert.deepEqual(contextAfter, contextGeometry.context);
  const contextContract = await page.evaluate(() => {
    const root = document.querySelector('[data-codex-composer-root]');
    const utility = root.querySelector('[data-native-composer-utility-slot]');
    const portal = root.querySelector('[data-above-composer-portal]');
    const composer = root.querySelector('.composer-surface-chrome');
    const component = [...root.children].find(child => (
      child !== portal && child.contains(composer)
    ));
    const utilityRect = utility.getBoundingClientRect();
    const composerRect = composer.getBoundingClientRect();
    return {
      utilityIsInsideComponent: component.contains(utility) && !portal.contains(utility),
      utilitySignature: [
        'flex',
        'flex-wrap',
        'items-center',
        'gap-2',
        'overflow-visible',
        'pr-2',
        'pl-2'
      ].every(token => utility.classList.contains(token)),
      utilityWidth: utilityRect.width,
      composerWidth: composerRect.width,
      runLocationCount: utility.querySelectorAll(
        '[data-composer-navigation-target="run-location"]'
      ).length,
      footerReasoningInsideUtility: Boolean(
        utility.querySelector('[data-composer-navigation-target="reasoning"]')
      )
    };
  });
  assert.equal(contextContract.utilityIsInsideComponent, true);
  assert.equal(contextContract.utilitySignature, true);
  assert.equal(contextContract.utilityWidth, contextContract.composerWidth);
  assert.equal(contextContract.runLocationCount, 1);
  assert.equal(contextContract.footerReasoningInsideUtility, false);

  const homeContextGeometry = await installComposerState(page, 'home-context');
  await page.waitForFunction(() => (
    document.querySelector('[data-fixture-surface="composer-context"]')
      ?.classList.contains('forge-composer-context') &&
    document.querySelector('[data-composer-utility-bar-scroll-area]')
  ));
  const homeContextContract = await page.evaluate(() => {
    const root = document.querySelector('[data-codex-composer-root]');
    const utility = root.querySelector('[data-native-composer-utility-slot]');
    const portal = root.querySelector('[data-above-composer-portal]');
    const composer = root.querySelector('.composer-surface-chrome');
    const component = [...root.children].find(child => (
      child !== portal && child.contains(composer)
    ));
    const scrollArea = utility.querySelector('[data-composer-utility-bar-scroll-area]');
    const rect = utility.getBoundingClientRect();
    return {
      insideComponent: component.contains(utility),
      outsidePortal: !portal.contains(utility),
      componentSignature: [
        'relative',
        'flex',
        'w-full',
        'flex-col',
        'gap-2'
      ].every(token => component.classList.contains(token)),
      scrollAreaDirect: scrollArea.parentElement === utility,
      signature: [
        'flex',
        'flex-nowrap',
        'items-center',
        'gap-2',
        'overflow-hidden'
      ].every(token => utility.classList.contains(token)),
      rect: [rect.x, rect.y, rect.width, rect.height]
    };
  });
  assert.equal(homeContextContract.insideComponent, true);
  assert.equal(homeContextContract.outsidePortal, true);
  assert.equal(homeContextContract.componentSignature, true);
  assert.equal(homeContextContract.scrollAreaDirect, true);
  assert.equal(homeContextContract.signature, true);
  assert.deepEqual(homeContextContract.rect, homeContextGeometry.context);

  const transitionStates = [
    {
      name: 'running',
      context: 0,
      progress: 1,
      fades: 1,
      stacks: 1,
      panels: 1,
      submitLabel: '停止'
    },
    {
      name: 'guided',
      context: 0,
      progress: 1,
      fades: 1,
      stacks: 1,
      panels: 2,
      submitLabel: '停止',
      collapsed: true
    },
    {
      name: 'expanded-guided',
      context: 0,
      progress: 1,
      fades: 1,
      stacks: 1,
      panels: 2,
      submitLabel: '停止',
      collapsed: false
    },
    {
      name: 'default',
      context: 0,
      progress: 0,
      fades: 0,
      stacks: 0,
      panels: 0,
      submitLabel: null
    }
  ];
  for (const expected of transitionStates) {
    const nativeGeometry = await installComposerState(page, expected.name);
    await page.waitForFunction(state => {
      const submit = document.querySelector('[data-native-slot="composer-submit"]');
      return (
        document.querySelectorAll('.forge-composer-context').length === state.context &&
        document.querySelectorAll('.forge-composer-progress-pill').length === state.progress &&
        document.querySelectorAll('.forge-composer-progress-fade').length === state.fades &&
        document.querySelectorAll('.forge-composer-panel-stack').length === state.stacks &&
        document.querySelectorAll('.forge-composer-panel').length === state.panels &&
        submit?.getAttribute('aria-label') === state.submitLabel &&
        submit.classList.contains('forge-composer-submit')
      );
    }, expected);
    const mappedGeometry = await page.evaluate(() => Object.fromEntries(
      [
        ['composer', '.composer-surface-chrome'],
        ['context', '[data-fixture-surface="composer-context"]'],
        ['progress', '[data-fixture-control="plan"]'],
        ['stack', '[data-fixture-surface="composer-stack"]'],
        ['queued', '[data-fixture-surface="queued-panel"]'],
        ['goal', '[data-fixture-surface="goal-panel"]'],
        ['submit', '[data-native-slot="composer-submit"]']
      ].map(([name, selector]) => {
        const element = document.querySelector(selector);
        if (!element) return [name, null];
        const rect = element.getBoundingClientRect();
        return [name, [rect.x, rect.y, rect.width, rect.height]];
      })
    ));
    assert.deepEqual(mappedGeometry, nativeGeometry, `${expected.name} geometry changed`);
    const topology = await page.evaluate(() => {
      const root = document.querySelector('[data-codex-composer-root]');
      const portal = root.querySelector(':scope > [data-above-composer-portal]');
      const composer = root.querySelector('.composer-surface-chrome');
      const component = [...root.children].find(child => (
        child !== portal && child.contains(composer)
      ));
      const utility = root.querySelector('[data-native-composer-utility-slot]');
      const stack = root.querySelector('[data-fixture-surface="composer-stack"]');
      const progress = root.querySelector('[data-fixture-control="plan"]');
      const queue = root.querySelector('[data-fixture-surface="queued-panel"]');
      const goal = root.querySelector('[data-fixture-surface="goal-panel"]');
      const inset = stack?.parentElement;
      const rows = [queue, goal].filter(Boolean);
      return {
        portalDirect: portal?.parentElement === root,
        componentDirect: component?.parentElement === root,
        utilityInComponent: Boolean(utility && component?.contains(utility)),
        progressInPortal: Boolean(progress && portal.contains(progress)),
        stackInPortal: Boolean(stack && portal.contains(stack)),
        progressInStack: Boolean(progress && stack?.contains(progress)),
        queueGoalSameParent: Boolean(queue && goal && queue.parentElement === goal.parentElement),
        insetCollapsed: inset
          ? inset.classList.contains('native-collapsed')
          : null,
        rowsUseCompactBorders: rows.length
          ? rows.every(row => (
              row.classList.contains('border-x') &&
              row.classList.contains('border-t')
            ))
          : null,
        rowsUseNativeTopCornerToken: rows.length
          ? rows.every(row => row.classList.contains('first:rounded-t-2xl'))
          : null,
        rowsUseLowerCornerToken: rows.length
          ? rows.some(row => [...row.classList].some(token => (
              token.includes('rounded-b') ||
              token.includes('rounded-bl') ||
              token.includes('rounded-br')
            )))
          : null,
        directStackOrder: stack
          ? [...stack.children].map(element => element.dataset.fixtureSurface)
          : []
      };
    });
    assert.equal(topology.portalDirect, true);
    assert.equal(topology.componentDirect, true);
    assert.equal(topology.utilityInComponent, true);
    assert.equal(topology.progressInPortal, expected.progress === 1);
    assert.equal(topology.stackInPortal, false);
    assert.equal(topology.progressInStack, false);
    assert.equal(
      topology.insetCollapsed,
      expected.stacks ? expected.collapsed ?? true : null
    );
    assert.equal(
      topology.rowsUseCompactBorders,
      expected.stacks ? expected.collapsed ?? true : null
    );
    assert.equal(
      topology.rowsUseNativeTopCornerToken,
      expected.stacks ? expected.collapsed ?? true : null
    );
    assert.equal(
      topology.rowsUseLowerCornerToken,
      expected.stacks ? false : null
    );
    assert.equal(
      topology.queueGoalSameParent,
      expected.name === 'guided' || expected.name === 'expanded-guided'
    );
    assert.deepEqual(
      topology.directStackOrder,
      expected.name === 'guided' || expected.name === 'expanded-guided'
        ? ['queued-panel', 'goal-panel']
        : expected.name === 'running'
          ? ['goal-panel']
          : []
    );
  }

  await page.evaluate(() => {
    const active = document.querySelector('[data-native-slot="project-active"]');
    active.removeAttribute('aria-current');
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ));

  await page.evaluate(() => {
    document.querySelector('[data-native-slot="project-active"]')
      .removeAttribute('data-app-action-sidebar-thread-active');
    document.querySelector(
      '[data-app-action-sidebar-section-heading="Tasks"] ' +
      '[data-app-action-sidebar-thread-row]'
    ).setAttribute('data-app-action-sidebar-thread-active', 'true');
  });
  await page.waitForFunction(() => (
    document.querySelector(
      '[data-app-action-sidebar-section-heading="Tasks"] ' +
      '[data-app-action-sidebar-thread-row]'
    )?.classList.contains('forge-sidebar-selected') &&
    !document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ));

  await page.evaluate(() => {
    document.querySelector(
      '[data-app-action-sidebar-section-heading="Tasks"] ' +
      '[data-app-action-sidebar-thread-row]'
    ).removeAttribute('data-app-action-sidebar-thread-active');
    document.querySelector('[data-app-action-sidebar-project-row]')
      .setAttribute('aria-current', 'page');
  });
  await page.waitForFunction(() => (
    !document.querySelector(
      '[data-app-action-sidebar-section-heading="Tasks"] ' +
      '[data-app-action-sidebar-thread-row]'
    )?.classList.contains('forge-sidebar-selected') &&
    document.querySelector('[data-app-action-sidebar-project-row]')
      ?.classList.contains('forge-sidebar-selected')
  ));
  assert.equal(
    await page.locator('[data-app-action-sidebar-project-row].forge-sidebar-selected').count(),
    1
  );
  const selectedProjectPaint = await page.locator(
    '[data-app-action-sidebar-project-row].forge-sidebar-selected'
  ).evaluate(element => {
    const style = getComputedStyle(element);
    const descendantColors = [...element.querySelectorAll('span, svg, button')]
      .filter(child => {
        const rect = child.getBoundingClientRect();
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          !child.closest('[data-native-status]')
        );
      })
      .map(child => getComputedStyle(child).color);
    return {
      backgroundImage: style.backgroundImage,
      backgroundSize: style.backgroundSize,
      color: style.color,
      shadow: style.boxShadow,
      descendantColors
    };
  });
  assert.match(selectedProjectPaint.backgroundImage, /data:image\//);
  assert.equal(
    selectedProjectPaint.backgroundSize,
    '100% 100%',
    'selected paper must fit the exact live row box without a two-pixel inset'
  );
  assert.equal(selectedProjectPaint.color, 'rgb(47, 40, 34)');
  assert.ok(
    selectedProjectPaint.descendantColors.every(color => color === 'rgb(47, 40, 34)'),
    `selected project descendants did not switch to dark ink: ${
      selectedProjectPaint.descendantColors.join(', ')
    }`
  );
  assert.doesNotMatch(
    `${selectedProjectPaint.backgroundImage} ${selectedProjectPaint.shadow}`,
    /(?:157,\s*63,\s*38|133,\s*56,\s*35)/,
    'selected project retained the rejected lacquer-red left edge'
  );

  await page.evaluate(() => {
    document.querySelector('[data-app-action-sidebar-project-row]')
      .removeAttribute('aria-current');
    document.querySelector('[data-native-slot="new-task"]').setAttribute('aria-current', 'page');
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="new-task-row"]')
      ?.classList.contains('forge-sidebar-action-active')
  ));
  assert.equal(
    await page.locator('[data-native-slot="new-task-row"].forge-sidebar-selected').count(),
    1
  );

  const level2 = page.locator('[data-native-slot="project-temple-child"]');
  const defaultImage = await level2.evaluate(element => getComputedStyle(element).backgroundImage);
  await level2.hover();
  const hoverImage = await level2.evaluate(element => getComputedStyle(element).backgroundImage);
  assert.equal(
    hoverImage,
    defaultImage,
    'an unselected thread hover must keep its native background-image contract'
  );

  await page.evaluate(() => {
    const current = document.querySelector(
      '[class~="group/application-menu-top-bar"]'
    );
    const replacement = current.cloneNode(true);
    replacement.querySelector('[data-native-slot="menu-help"]').textContent = 'Aide';
    replacement.querySelectorAll('[data-forge-mark]').forEach(element => {
      element.removeAttribute('data-forge-mark');
      [...element.classList]
        .filter(className => className.startsWith('forge-'))
        .forEach(className => element.classList.remove(className));
    });
    current.replaceWith(replacement);
  });
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="menu-help"]')?.textContent === 'Aide' &&
    document.querySelectorAll(
      '[class~="group/application-menu-top-bar"] ' +
      'button[aria-haspopup="menu"][aria-expanded].forge-topbar-menu-item'
    ).length === 4
  ));

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V51.7 strengthens progress status contrast without moving native content', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v51-progress.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v51-progress.test/');
  await installComposerState(page, 'guided');

  const readProgressParts = () => {
    const pill = document.querySelector('[data-fixture-control="plan"]');
    const icon = pill.querySelector('svg');
    const textParts = [...pill.querySelectorAll('span')];
    const added = textParts.find(element => /^[+\uFF0B]\s*\d/u.test(element.textContent.trim()));
    const removed = textParts.find(element => /^[-\u2212\uFF0D]\s*\d/u.test(element.textContent.trim()));
    const rectOf = element => {
      const rect = element.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height];
    };
    return {
      pill: rectOf(pill),
      icon: rectOf(icon),
      added: rectOf(added),
      removed: rectOf(removed)
    };
  };
  const before = await page.evaluate(readProgressParts);

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelectorAll('.forge-progress-status-icon').length === 1 &&
    document.querySelectorAll('.forge-diff-added').length === 1 &&
    document.querySelectorAll('.forge-diff-removed').length === 1
  ));

  const after = await page.evaluate(readProgressParts);
  for (const [part, beforeRect] of Object.entries(before)) {
    after[part].forEach((value, index) => {
      assert.ok(
        Math.abs(value - beforeRect[index]) <= .25,
        `${part} rect[${index}] changed from ${beforeRect[index]} to ${value}`
      );
    });
  }

  const paint = await page.evaluate(() => {
    const icon = document.querySelector('.forge-progress-status-icon');
    const circle = icon.querySelector('circle');
    const added = document.querySelector('.forge-diff-added');
    const removed = document.querySelector('.forge-diff-removed');
    return {
      iconColor: getComputedStyle(icon).color,
      circleStroke: getComputedStyle(circle).stroke,
      circleStrokeWidth: getComputedStyle(circle).strokeWidth,
      addedColor: getComputedStyle(added).color,
      removedColor: getComputedStyle(removed).color,
      addedStrokeWidth: getComputedStyle(added).webkitTextStrokeWidth,
      removedStrokeWidth: getComputedStyle(removed).webkitTextStrokeWidth
    };
  });
  assert.equal(paint.iconColor, 'rgb(6, 63, 97)');
  assert.equal(paint.circleStroke, 'rgb(6, 63, 97)');
  assert.equal(paint.circleStrokeWidth, '1.65px');
  assert.equal(paint.addedColor, 'rgb(6, 69, 33)');
  assert.equal(paint.removedColor, 'rgb(120, 23, 24)');
  assert.equal(paint.addedStrokeWidth, '0.18px');
  assert.equal(paint.removedStrokeWidth, '0.18px');

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V38 clears only the source-backed thread footer fade without changing native geometry', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v38-footer.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v38-footer.test/');
  await installComposerState(page, 'guided');

  const before = await page.evaluate(() => {
    const composerArea = document.querySelector('.composer-area');
    const threadFooter = document.createElement('div');
    threadFooter.dataset.threadScrollFooter = 'true';
    threadFooter.style.cssText = 'position:relative;width:100%;';

    const fadeHost = document.createElement('div');
    fadeHost.className =
      'pointer-events-none absolute inset-x-0 bottom-0 z-0 flex h-full w-full justify-center pt-4';
    fadeHost.style.cssText =
      'position:absolute;inset-inline:0;bottom:0;z-index:0;display:flex;' +
      'width:100%;height:180px;justify-content:center;padding-top:16px;pointer-events:none;';

    const fadePaint = document.createElement('div');
    fadePaint.className =
      'z-0 h-full bg-gradient-to-t from-token-main-surface-primary ' +
      'via-token-main-surface-primary extension:from-token-bg-primary ' +
      'extension:via-token-bg-primary native-thread-footer-gradient';
    fadePaint.style.cssText =
      'z-index:0;width:100%;height:100%;background-color:rgb(31,31,31);' +
      'background-image:linear-gradient(to top,rgb(31,31,31),rgb(31,31,31),transparent);';
    fadeHost.append(fadePaint);

    const obstacle = document.createElement('div');
    obstacle.dataset.pipObstacle = 'thread-footer';
    obstacle.className = 'relative z-10 flex flex-col';
    obstacle.style.cssText = 'position:relative;z-index:10;display:flex;flex-direction:column;';

    composerArea.before(threadFooter);
    obstacle.append(composerArea);
    threadFooter.append(fadeHost, obstacle);

    const read = () => {
      const hostRect = fadeHost.getBoundingClientRect();
      const paintRect = fadePaint.getBoundingClientRect();
      const composerRect = document
        .querySelector('[data-codex-composer-root]')
        .getBoundingClientRect();
      const style = getComputedStyle(fadePaint);
      return {
        relativeRect: [
          paintRect.x - hostRect.x,
          paintRect.y - hostRect.y,
          paintRect.width,
          paintRect.height
        ],
        composerWidth: composerRect.width,
        pointerEvents: style.pointerEvents,
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
        opacity: style.opacity
      };
    };
    window.__readNativeThreadFade = read;
    return read();
  });

  assert.equal(before.pointerEvents, 'none');
  assert.equal(before.backgroundColor, 'rgb(31, 31, 31)');
  assert.notEqual(before.backgroundImage, 'none');
  assert.equal(before.opacity, '1');

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('.native-thread-footer-gradient')
      ?.classList.contains('forge-composer-thread-fade')
  ));

  assert.equal(await page.locator('.forge-composer-thread-fade').count(), 1);
  const after = await page.evaluate(() => window.__readNativeThreadFade());
  assert.deepEqual(
    after.relativeRect,
    before.relativeRect,
    'clearing the paint-only fade must preserve its native footer geometry'
  );
  assert.ok(
    Math.abs(after.composerWidth - before.composerWidth) <= .25,
    'clearing the fade must preserve the native composer width'
  );
  assert.equal(after.pointerEvents, 'none');
  assert.equal(after.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(after.backgroundImage, 'none');
  assert.equal(after.opacity, '0');
  assert.equal(
    await page.locator('[data-native-slot="composer-submit"]').getAttribute('aria-label'),
    '停止'
  );

  const immediatePersistentFade = await page.evaluate(() => {
    const oldFooter = document.querySelector('[data-thread-scroll-footer="true"]');
    const replacement = oldFooter.cloneNode(true);
    for (const element of [replacement, ...replacement.querySelectorAll('[data-forge-mark]')]) {
      element.removeAttribute('data-forge-mark');
      [...element.classList]
        .filter(className => className.startsWith('forge-'))
        .forEach(className => element.classList.remove(className));
    }
    oldFooter.replaceWith(replacement);
    const host = replacement.querySelector(':scope > .pointer-events-none');
    const fade = host.querySelector('.native-thread-footer-gradient');
    const composer = replacement.querySelector('[data-codex-composer-root]');
    const hostRect = host.getBoundingClientRect();
    const fadeRect = fade.getBoundingClientRect();
    const style = getComputedStyle(fade);
    return {
      marker: fade.classList.contains('forge-composer-thread-fade'),
      relativeRect: [
        fadeRect.x - hostRect.x,
        fadeRect.y - hostRect.y,
        fadeRect.width,
        fadeRect.height
      ],
      composerWidth: composer.getBoundingClientRect().width,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      opacity: style.opacity
    };
  });
  assert.equal(immediatePersistentFade.marker, false);
  assert.deepEqual(immediatePersistentFade.relativeRect, before.relativeRect);
  assert.ok(Math.abs(immediatePersistentFade.composerWidth - before.composerWidth) <= .25);
  assert.equal(immediatePersistentFade.backgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(immediatePersistentFade.backgroundImage, 'none');
  assert.equal(immediatePersistentFade.opacity, '0');
  await page.waitForFunction(() => (
    document.querySelector('.native-thread-footer-gradient')
      ?.classList.contains('forge-composer-thread-fade')
  ));

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('.forge-composer-thread-fade').count(), 0);
  await page.close();
});

test('V35 maps a motion-mounted active goal before its first visible frame', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v35-motion-goal.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v35-motion-goal.test/');
  await installComposerState(page, 'guided');

  const before = await page.evaluate(() => {
    const stack = document.querySelector('[data-fixture-surface="composer-stack"]');
    const goal = document.querySelector('[data-fixture-surface="goal-panel"]');
    stack.style.opacity = '0';
    const stackRect = stack.getBoundingClientRect();
    const goalRect = goal.getBoundingClientRect();
    return [
      goalRect.x - stackRect.x,
      goalRect.y - stackRect.y,
      goalRect.width,
      goalRect.height
    ];
  });

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('[data-fixture-surface="composer-stack"]')
      ?.classList.contains('forge-composer-panel-stack') &&
    document.querySelector('[data-fixture-surface="goal-panel"]')
      ?.classList.contains('forge-composer-panel')
  ));

  const firstFrame = await page.evaluate(() => {
    const stack = document.querySelector('[data-fixture-surface="composer-stack"]');
    const goal = document.querySelector('[data-fixture-surface="goal-panel"]');
    const style = getComputedStyle(goal);
    const paint = getComputedStyle(goal, '::before');
    const stackRect = stack.getBoundingClientRect();
    const goalRect = goal.getBoundingClientRect();
    stack.style.opacity = '1';
    return {
      rect: [
        goalRect.x - stackRect.x,
        goalRect.y - stackRect.y,
        goalRect.width,
        goalRect.height
      ],
      backgroundImage: style.backgroundImage,
      borderColors: [
        style.borderTopColor,
        style.borderRightColor,
        style.borderBottomColor,
        style.borderLeftColor
      ],
      backdropFilter: style.backdropFilter,
      paintContent: paint.content
    };
  });
  assert.deepEqual(firstFrame.rect, before);
  assert.equal(firstFrame.backgroundImage, 'none');
  assert.deepEqual(firstFrame.borderColors, Array(4).fill('rgba(0, 0, 0, 0)'));
  assert.equal(firstFrame.backdropFilter, 'none');
  assert.equal(firstFrame.paintContent, '""');

  const immediatePersistentStack = await page.evaluate(() => {
    const oldStack = document.querySelector('[data-fixture-surface="composer-stack"]');
    const replacement = oldStack.cloneNode(true);
    const oldGoal = oldStack.querySelector('[data-fixture-surface="goal-panel"]');
    const oldStackRect = oldStack.getBoundingClientRect();
    const oldGoalRect = oldGoal.getBoundingClientRect();
    const expectedGoalRect = [
      oldGoalRect.x - oldStackRect.x,
      oldGoalRect.y - oldStackRect.y,
      oldGoalRect.width,
      oldGoalRect.height
    ];
    for (const element of [replacement, ...replacement.querySelectorAll('[data-forge-mark]')]) {
      element.removeAttribute('data-forge-mark');
      [...element.classList]
        .filter(className => className.startsWith('forge-'))
        .forEach(className => element.classList.remove(className));
    }
    oldStack.replaceWith(replacement);
    const queued = replacement.querySelector('[data-fixture-surface="queued-panel"]');
    const goal = replacement.querySelector('[data-fixture-surface="goal-panel"]');
    const queueItem = replacement.querySelector('.native-queued-message-wrap');
    const stackRect = replacement.getBoundingClientRect();
    const goalRect = goal.getBoundingClientRect();
    const goalStyle = getComputedStyle(goal);
    return {
      markers: {
        stack: replacement.classList.contains('forge-composer-panel-stack'),
        queued: queued.classList.contains('forge-composer-panel'),
        goal: goal.classList.contains('forge-composer-panel'),
        queueItem: queueItem.classList.contains('forge-composer-queue-item')
      },
      expectedGoalRect,
      goalRect: [
        goalRect.x - stackRect.x,
        goalRect.y - stackRect.y,
        goalRect.width,
        goalRect.height
      ],
      goalBackgroundImage: goalStyle.backgroundImage,
      goalBorderColors: [
        goalStyle.borderTopColor,
        goalStyle.borderRightColor,
        goalStyle.borderBottomColor,
        goalStyle.borderLeftColor
      ],
      queuedPaperContent: getComputedStyle(queued, '::before').content,
      queueTopCapContent: getComputedStyle(queued, '::after').content,
      goalPaperContent: getComputedStyle(goal, '::before').content,
      queueItemPaperContent: getComputedStyle(queueItem, '::before').content
    };
  });
  assert.deepEqual(immediatePersistentStack.markers, {
    stack: false,
    queued: false,
    goal: false,
    queueItem: false
  });
  assert.deepEqual(immediatePersistentStack.goalRect, immediatePersistentStack.expectedGoalRect);
  assert.equal(immediatePersistentStack.goalBackgroundImage, 'none');
  assert.deepEqual(
    immediatePersistentStack.goalBorderColors,
    Array(4).fill('rgba(0, 0, 0, 0)')
  );
  assert.equal(immediatePersistentStack.queuedPaperContent, '""');
  assert.equal(immediatePersistentStack.queueTopCapContent, '""');
  assert.equal(immediatePersistentStack.goalPaperContent, '""');
  assert.equal(immediatePersistentStack.queueItemPaperContent, '""');
  await page.waitForTimeout(80);
  assert.equal(
    await page.locator('[data-fixture-surface="goal-panel"].forge-composer-panel').count(),
    1,
    'the goal must stay themed when its motion wrapper becomes visible without a style observer'
  );

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V14 selects the visible composer surface and ignores one-button context and external submits', async () => {
  const page = await browser.newPage({
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v14-composer-edge.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v14-composer-edge.test/');

  await page.evaluate(() => {
    const root = document.querySelector('[data-thread-find-composer="true"]');
    const liveSurface = root.querySelector('.composer-surface-chrome');
    const staleSurface = liveSurface.cloneNode(true);
    staleSurface.dataset.nativeSlot = 'composer-stale-hidden';
    staleSurface.querySelectorAll('[data-native-slot]').forEach(element => {
      element.dataset.nativeSlot = `stale-${element.dataset.nativeSlot}`;
    });
    staleSurface.style.display = 'none';
    root.prepend(staleSurface);

    const oneButtonContext = document.createElement('div');
    oneButtonContext.dataset.fixtureSurface = 'single-navigation-target';
    oneButtonContext.innerHTML =
      '<button data-composer-navigation-target="only-one">只有一个导航项</button>';
    root.prepend(oneButtonContext);

    const misplacedSubmit = liveSurface.querySelector(
      '[data-native-slot="composer-submit"]'
    ).cloneNode(true);
    misplacedSubmit.removeAttribute('data-native-slot');
    misplacedSubmit.dataset.fixtureControl = 'misplaced-native-submit';
    misplacedSubmit.setAttribute('aria-label', '发送');
    Object.assign(misplacedSubmit.style, {
      position: 'absolute',
      right: '8px',
      bottom: '8px',
      width: '28px',
      height: '28px'
    });
    liveSurface.querySelector('.composer-input-wrap').append(misplacedSubmit);

    const externalSubmit = document.createElement('button');
    externalSubmit.type = 'button';
    externalSubmit.dataset.fixtureControl = 'external-submit';
    externalSubmit.textContent = '外部提交';
    root.prepend(externalSubmit);

    document.querySelector('[data-native-slot="composer-access"]').disabled = true;
  });

  const accessBefore = await page.locator(selectors.access).evaluate(element => ({
    color: getComputedStyle(element).color,
    disabled: element.disabled
  }));
  const nativePersistentComposer = await page.evaluate(() => {
    const rectOf = element => {
      const rect = element.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height];
    };
    const frame = document.querySelector('[data-native-slot="composer"]');
    const editor = frame.querySelector('.ProseMirror[role="textbox"]');
    const editorShell = editor.parentElement;
    const footer = frame.querySelector('.composer-footer');
    const submit = frame.querySelector('[data-native-slot="composer-submit"]');
    const editorStyle = getComputedStyle(editor);
    const editorShellStyle = getComputedStyle(editorShell);
    return {
      rects: {
        frame: rectOf(frame),
        editor: rectOf(editor),
        editorShell: rectOf(editorShell),
        footer: rectOf(footer),
        submit: rectOf(submit)
      },
      editorLayout: {
        paddingBlockStart: editorStyle.paddingBlockStart,
        paddingInlineStart: editorStyle.paddingInlineStart,
        shellPaddingBlockStart: editorShellStyle.paddingBlockStart,
        shellPaddingInlineStart: editorShellStyle.paddingInlineStart
      }
    };
  });
  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="composer"]')
      ?.classList.contains('forge-composer-frame')
  ));

  assert.equal(
    await page.locator('[data-native-slot="composer-stale-hidden"].forge-composer-frame').count(),
    0
  );
  assert.equal(
    await page.locator('[data-fixture-surface="single-navigation-target"].forge-composer-context')
      .count(),
    0,
    'a single navigation button must not paint its entire ancestor as a context strip'
  );
  assert.equal(
    await page.locator('[data-fixture-control="external-submit"].forge-composer-submit').count(),
    0,
    'submit-like controls outside the native composer surface must not be themed as send'
  );
  assert.equal(
    await page.locator(
      '[data-fixture-control="misplaced-native-submit"].forge-composer-submit'
    ).count(),
    0,
    'a native-signature button outside the official footer must not be themed as send'
  );
  assert.equal(
    await page.locator(
      '[data-native-slot="composer-submit"].forge-composer-submit'
    ).count(),
    1,
    'the final native footer control remains the only themed send button'
  );
  assert.deepEqual(
    await page.locator(selectors.access).evaluate(element => ({
      color: getComputedStyle(element).color,
      disabled: element.disabled
    })),
    accessBefore,
    'full-access orange and disabled semantics must survive composer theming'
  );

  const immediatePersistentComposer = await page.evaluate(() => {
    const oldSurface = document.querySelector('[data-native-slot="composer"]');
    const replacement = oldSurface.cloneNode(true);
    replacement.dataset.nativeSlot = 'composer-fresh-visible';
    [replacement, ...replacement.querySelectorAll('[data-forge-mark]')].forEach(element => {
      element.removeAttribute('data-forge-mark');
      [...element.classList]
        .filter(className => className.startsWith('forge-'))
        .forEach(className => element.classList.remove(className));
    });
    oldSurface.after(replacement);
    oldSurface.style.display = 'none';
    const rectOf = element => {
      const rect = element.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height];
    };
    const editor = replacement.querySelector('.ProseMirror[role="textbox"]');
    const editorShell = replacement.querySelector('.ProseMirror[role="textbox"]').parentElement;
    const footer = replacement.querySelector('.composer-footer');
    const submit = replacement.querySelector('[data-native-slot="composer-submit"]');
    const misplaced = document.querySelector('[data-fixture-control="misplaced-native-submit"]');
    const editorStyle = getComputedStyle(editor);
    const editorShellStyle = getComputedStyle(editorShell);
    return {
      frameMarker: replacement.classList.contains('forge-composer-frame'),
      inputShellMarker: editorShell.classList.contains('forge-composer-input-shell'),
      submitMarker: submit.classList.contains('forge-composer-submit'),
      paperContent: getComputedStyle(replacement, '::before').content,
      paperImage: getComputedStyle(replacement, '::before').backgroundImage,
      rects: {
        frame: rectOf(replacement),
        editor: rectOf(editor),
        editorShell: rectOf(editorShell),
        footer: rectOf(footer),
        submit: rectOf(submit)
      },
      editorLayout: {
        paddingBlockStart: editorStyle.paddingBlockStart,
        paddingInlineStart: editorStyle.paddingInlineStart,
        shellPaddingBlockStart: editorShellStyle.paddingBlockStart,
        shellPaddingInlineStart: editorShellStyle.paddingInlineStart
      },
      submitOpacity: getComputedStyle(submit).opacity,
      submitBackground: getComputedStyle(submit).backgroundColor,
      misplacedBackground: getComputedStyle(misplaced).backgroundColor
    };
  });
  assert.equal(immediatePersistentComposer.frameMarker, false);
  assert.equal(immediatePersistentComposer.inputShellMarker, false);
  assert.equal(immediatePersistentComposer.submitMarker, false);
  assert.equal(immediatePersistentComposer.paperContent, '""');
  assert.notEqual(immediatePersistentComposer.paperImage, 'none');
  for (const [name, nativeRect] of Object.entries(nativePersistentComposer.rects)) {
    immediatePersistentComposer.rects[name].forEach((value, index) => {
      assert.ok(
        Math.abs(value - nativeRect[index]) <= .25,
        `marker-free replacement ${name} rect[${index}] changed from ${nativeRect[index]} to ${value}`
      );
    });
  }
  assert.deepEqual(
    immediatePersistentComposer.editorLayout,
    nativePersistentComposer.editorLayout,
    'marker-free replacement must keep native editor and input-shell padding'
  );
  assert.equal(immediatePersistentComposer.submitOpacity, '1');
  assert.equal(immediatePersistentComposer.submitBackground, 'rgb(73, 54, 31)');
  assert.notEqual(
    immediatePersistentComposer.misplacedBackground,
    immediatePersistentComposer.submitBackground,
    'a matching button outside the native footer received persistent submit paint'
  );
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="composer-fresh-visible"]')
      ?.classList.contains('forge-composer-frame') &&
    !document.querySelector('[data-native-slot="composer"]')
      ?.classList.contains('forge-composer-frame')
  ));
  assert.equal(
    await page.locator(
      '[data-native-slot="composer-fresh-visible"] ' +
      '[data-native-slot="composer-submit"].forge-composer-submit'
    ).count(),
    1
  );
  assert.equal(
    await page.locator('[data-fixture-control="external-submit"].forge-composer-submit').count(),
    0
  );
  assert.equal(
    await page.locator(
      '[data-fixture-control="misplaced-native-submit"].forge-composer-submit'
    ).count(),
    0
  );

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V15 keeps the empty composer send arrow legible over the native opacity utility', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v15-submit-opacity.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v15-submit-opacity.test/');

  const submit = page.locator('[data-native-slot="composer-submit"]');
  const native = await submit.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      opacity: getComputedStyle(element).opacity,
      rect: [rect.x, rect.y, rect.width, rect.height]
    };
  });
  assert.equal(native.opacity, '0.5');

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="composer-submit"]')
      ?.classList.contains('forge-composer-submit')
  ));

  const themed = await submit.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const buttonStyle = getComputedStyle(element);
    const arrowStyle = getComputedStyle(element.querySelector('svg'));
    return {
      opacity: buttonStyle.opacity,
      color: buttonStyle.color,
      arrowColor: arrowStyle.color,
      arrowOpacity: arrowStyle.opacity,
      rect: [rect.x, rect.y, rect.width, rect.height]
    };
  });
  assert.equal(themed.opacity, '1');
  assert.equal(themed.color, 'rgb(247, 232, 199)');
  assert.equal(themed.arrowColor, themed.color);
  assert.equal(themed.arrowOpacity, '1');
  assert.deepEqual(themed.rect, native.rect);

  await page.evaluate(RESTORE_EXPRESSION);
  await page.close();
});

test('V15 keeps the native composer material while the editor is read-only', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v15-readonly-composer.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v15-readonly-composer.test/');

  const before = await page.evaluate(() => {
    const editor = document.querySelector('.composer-surface-chrome .ProseMirror[role="textbox"]');
    const submit = document.querySelector(
      '.composer-surface-chrome [data-native-slot="composer-submit"]'
    );
    editor.setAttribute('contenteditable', 'false');
    editor.setAttribute('aria-readonly', 'true');
    submit.disabled = true;
    submit.setAttribute('aria-disabled', 'true');
    const rect = document.querySelector('.composer-surface-chrome').getBoundingClientRect();
    return {
      rect: [rect.x, rect.y, rect.width, rect.height],
      contenteditable: editor.getAttribute('contenteditable'),
      ariaReadonly: editor.getAttribute('aria-readonly'),
      disabled: submit.disabled,
      ariaDisabled: submit.getAttribute('aria-disabled')
    };
  });

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('.composer-surface-chrome')
      ?.classList.contains('forge-composer-frame')
  ));

  const themed = await page.evaluate(() => {
    const frame = document.querySelector('.composer-surface-chrome');
    const editor = frame.querySelector('.ProseMirror[role="textbox"]');
    const submit = frame.querySelector('[data-native-slot="composer-submit"]');
    const submitStyle = getComputedStyle(submit);
    const arrowStyle = getComputedStyle(submit.querySelector('svg'));
    const rect = frame.getBoundingClientRect();
    return {
      rect: [rect.x, rect.y, rect.width, rect.height],
      backgroundImage: getComputedStyle(frame, '::before').backgroundImage,
      contenteditable: editor.getAttribute('contenteditable'),
      ariaReadonly: editor.getAttribute('aria-readonly'),
      disabled: submit.disabled,
      ariaDisabled: submit.getAttribute('aria-disabled'),
      submitColor: submitStyle.color,
      submitBackground: submitStyle.backgroundColor,
      submitOpacity: submitStyle.opacity,
      arrowColor: arrowStyle.color,
      arrowOpacity: arrowStyle.opacity
    };
  });
  assert.deepEqual(themed.rect, before.rect);
  assert.match(themed.backgroundImage, /data:image\//);
  assert.equal(themed.submitColor, 'rgb(240, 223, 189)');
  assert.equal(themed.submitBackground, 'rgb(95, 85, 72)');
  assert.equal(themed.submitOpacity, '1');
  assert.equal(themed.arrowColor, themed.submitColor);
  assert.equal(themed.arrowOpacity, '1');
  assert.deepEqual(
    {
      contenteditable: themed.contenteditable,
      ariaReadonly: themed.ariaReadonly,
      disabled: themed.disabled,
      ariaDisabled: themed.ariaDisabled
    },
    {
      contenteditable: before.contenteditable,
      ariaReadonly: before.ariaReadonly,
      disabled: before.disabled,
      ariaDisabled: before.ariaDisabled
    }
  );

  for (const editable of ['true', 'false', 'true']) {
    await page.evaluate(value => {
      document.querySelector('.composer-surface-chrome .ProseMirror[role="textbox"]')
        .setAttribute('contenteditable', value);
    }, editable);
    await page.waitForFunction(() => (
      document.querySelector('.composer-surface-chrome')
        ?.classList.contains('forge-composer-frame') &&
      document.querySelectorAll('.forge-composer-frame').length === 1
    ));
  }

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V17 keeps the official composer surface themed when the native editor signature changes', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v17-editor-signature.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v17-editor-signature.test/');

  const before = await page.evaluate(() => {
    const frame = document.querySelector('.composer-surface-chrome');
    const editor = frame.querySelector('.ProseMirror[role="textbox"]');
    editor.classList.remove('ProseMirror');
    editor.removeAttribute('role');
    editor.setAttribute('contenteditable', 'true');
    const rect = frame.getBoundingClientRect();
    return {
      rect: [rect.x, rect.y, rect.width, rect.height],
      contenteditable: editor.getAttribute('contenteditable'),
      role: editor.getAttribute('role')
    };
  });

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('.composer-surface-chrome')
      ?.classList.contains('forge-composer-frame')
  ));

  const themed = await page.evaluate(() => {
    const frame = document.querySelector('.composer-surface-chrome');
    const editor = frame.querySelector('[contenteditable="true"]');
    const rect = frame.getBoundingClientRect();
    return {
      rect: [rect.x, rect.y, rect.width, rect.height],
      backgroundImage: getComputedStyle(frame, '::before').backgroundImage,
      contenteditable: editor.getAttribute('contenteditable'),
      role: editor.getAttribute('role')
    };
  });
  assert.deepEqual(themed.rect, before.rect);
  assert.match(themed.backgroundImage, /data:image\//);
  assert.deepEqual(
    {
      contenteditable: themed.contenteditable,
      role: themed.role
    },
    {
      contenteditable: before.contenteditable,
      role: before.role
    }
  );

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V50 keeps exact native composer geometry at every responsive width', async () => {
  const page = await browser.newPage({
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v14-responsive.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));

  for (const width of [360, 400, 560, 736, 1600]) {
    await page.setViewportSize({ width, height: 820 });
    await page.goto(`http://wukong-v14-responsive.test/?width=${width}`);
    const before = await snapshot(page);
    await page.evaluate(expression);
    await page.waitForTimeout(700);
    assert.equal(
      await page.locator('.composer-surface-chrome.forge-composer-frame').count(),
      1,
      `composer mapping missing at ${width}px`
    );
    assert.equal(
      await page.locator('.forge-topbar-menu-item').count(),
      4,
      `top menu mapping missing at ${width}px`
    );
    const after = await snapshot(page);
    assertRectsEqual(after, before);
    for (const name of ['add', 'access', 'model', 'voice', 'send']) {
      assert.deepEqual(
        after[name].rect.slice(2),
        before[name].rect.slice(2),
        `${name} native hit-box dimensions changed at ${width}px`
      );
    }
    await page.evaluate(RESTORE_EXPRESSION);
    assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  }

  await page.close();
});

test('V14 re-maps a delayed React shell without resize or zoom assistance', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v14-first-frame.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v14-first-frame.test/');
  await installComposerState(page, 'guided');
  await page.evaluate(() => {
    window.__forgeResizeEvents = 0;
    window.addEventListener('resize', () => { window.__forgeResizeEvents += 1; });
    window.ResizeObserver = undefined;
    window.__delayedAppWindow = document.querySelector('.app-window');
    window.__delayedAppWindow.remove();
  });

  await page.evaluate(expression);
  assert.equal(await page.locator('.forge-topbar-menu-item').count(), 0);
  assert.equal(await page.locator('.forge-composer-frame').count(), 0);
  await page.waitForTimeout(700);
  const firstPaint = await page.evaluate(() => new Promise(resolve => {
    const insertedAt = performance.now();
    const refreshCountBefore = window.__wukongCodexForgeRuntimeV13.refreshCount;
    document.querySelector('#root').append(window.__delayedAppWindow);
    requestAnimationFrame(() => {
      const composer = document.querySelector('.composer-surface-chrome');
      const rightCard = document.querySelector('[data-native-slot="right-card"]');
      resolve({
        insertedAt,
        sampledAt: performance.now(),
        topbarMenuCount: document.querySelectorAll('.forge-topbar-menu-item').length,
        composerMarked: composer?.classList.contains('forge-composer-frame') || false,
        composerPaperContent: getComputedStyle(composer, '::before').content,
        composerPaperImage: getComputedStyle(composer, '::before').backgroundImage,
        rightCardMarked: rightCard?.classList.contains('forge-right-card') || false,
        rightCardPaperContent: getComputedStyle(rightCard, '::before').content,
        rightCardPaperImage: getComputedStyle(rightCard, '::before').backgroundImage,
        sidebarMarked: document.querySelector('[data-native-slot="project-active"]')
          ?.classList.contains('forge-sidebar-selected') || false,
        progressMarked: document.querySelector('[data-fixture-control="plan"]')
          ?.classList.contains('forge-composer-progress-pill') || false,
        progressFadeMarked: document.querySelector('.native-progress-gradient')
          ?.classList.contains('forge-composer-progress-fade') || false,
        goalPanelMarked: document.querySelector('[data-fixture-surface="goal-panel"]')
          ?.classList.contains('forge-composer-panel') || false,
        refreshCountDelta:
          window.__wukongCodexForgeRuntimeV13.refreshCount - refreshCountBefore
      });
    });
  }));
  assert.equal(firstPaint.topbarMenuCount, 4);
  assert.equal(firstPaint.composerMarked, true);
  assert.equal(firstPaint.composerPaperContent, '""');
  assert.notEqual(firstPaint.composerPaperImage, 'none');
  assert.equal(firstPaint.rightCardMarked, true);
  assert.equal(firstPaint.rightCardPaperContent, '""');
  assert.notEqual(firstPaint.rightCardPaperImage, 'none');
  assert.equal(firstPaint.sidebarMarked, true);
  assert.equal(firstPaint.progressMarked, true);
  assert.equal(firstPaint.progressFadeMarked, true);
  assert.equal(firstPaint.goalPanelMarked, true);
  assert.equal(firstPaint.refreshCountDelta, 1);
  const insertedAt = firstPaint.insertedAt;
  await page.waitForFunction(() => (
    document.querySelectorAll('.forge-topbar-menu-item').length === 4 &&
    document.querySelector('.composer-surface-chrome')?.classList.contains('forge-composer-frame') &&
    document.querySelector('[data-native-slot="project-active"]')
      ?.classList.contains('forge-sidebar-selected')
  ), undefined, { timeout: 1800 });

  const markedAt = await page.evaluate(() => performance.now());
  assert.ok(
    markedAt - insertedAt < 900,
    `delayed shell was not mapped promptly (${markedAt - insertedAt}ms)`
  );
  assert.equal(
    await page.evaluate(() => window.__forgeResizeEvents),
    0,
    'first-frame recovery must not depend on a window resize or zoom change'
  );

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V52.1 themes persistent-shell replacements before their first visible frame', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v52-persistent-shell.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v52-persistent-shell.test/');
  await installComposerState(page, 'guided');
  await page.evaluate(() => { window.ResizeObserver = undefined; });
  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('.composer-surface-chrome')?.classList.contains('forge-composer-frame') &&
    document.querySelector('[data-native-slot="right-card"]')?.classList.contains('forge-right-card') &&
    document.querySelector('[data-native-slot="project-active"]')?.classList.contains('forge-sidebar-selected')
  ));
  await page.waitForTimeout(700);

  const firstPaint = await page.evaluate(() => new Promise(resolve => {
    const runtime = window.__wukongCodexForgeRuntimeV13;
    const refreshCountBefore = runtime.refreshCount;
    const stripThemeMarks = element => {
      for (const node of [element, ...element.querySelectorAll('*')]) {
        for (const name of [...node.classList]) {
          if (name.startsWith('forge-')) node.classList.remove(name);
        }
        node.removeAttribute('data-forge-mark');
      }
      return element;
    };

    const sidebarList = document.querySelector('[data-app-action-sidebar-project-list-id="wukong-codex-theme"]');
    sidebarList.innerHTML = `
      <div role="listitem"><div role="button" tabindex="0"><div>
        <div role="button" tabindex="0" data-app-action-sidebar-thread-row
          data-app-action-sidebar-thread-active="true" aria-current="page"
          data-native-slot="persistent-project-active"><span data-thread-title>持久根切换任务</span></div>
      </div></div></div>`;

    const rightCard = document.querySelector('[data-native-slot="right-card"]');
    const priorRightRow = rightCard.querySelector('[data-slot="thread-summary-panel-item"]');
    const nextRightRow = stripThemeMarks(priorRightRow.cloneNode(true));
    nextRightRow.dataset.persistentRightRow = 'true';
    priorRightRow.replaceWith(nextRightRow);

    const abovePortal = document.querySelector('[data-above-composer-portal]');
    abovePortal.innerHTML = `
      <div class="relative col-start-1 row-start-1 h-8 self-end">
        <div class="pointer-events-none absolute inset-x-0 -bottom-1 h-7 bg-gradient-to-t from-token-main-surface-primary to-transparent native-progress-gradient"></div>
        <div class="flex w-max max-w-full min-w-0 items-center gap-2 rounded-3xl border px-3 py-1.5 native-progress-pill"
          data-state="active" data-fixture-control="persistent-plan">第 2 / 3 步 · +8 -2</div>
      </div>`;
    document.querySelector('[data-native-above-stack-slot]').innerHTML = `
      <div class="order-2 flex min-w-0 flex-col">
        <div class="relative min-w-0 overflow-clip text-token-foreground"
          data-fixture-surface="persistent-goal-panel">进行中的目标</div>
      </div>`;

    document.querySelector('.landing-native')?.remove();
    const conversation = document.createElement('section');
    conversation.dataset.threadFindTarget = 'conversation';
    conversation.style.minHeight = '240px';
    conversation.innerHTML = '<div data-virtualized-turn-content style="min-height:80px">已进入项目对话</div>';
    document.querySelector('.route-host').prepend(conversation);

    requestAnimationFrame(() => resolve({
      refreshCountDelta: runtime.refreshCount - refreshCountBefore,
      surface: document.documentElement.dataset.forgeSurface,
      mode: document.documentElement.dataset.forgeMode,
      sidebarMarked: document.querySelector('[data-native-slot="persistent-project-active"]')
        ?.classList.contains('forge-sidebar-selected') || false,
      rightRowMarked: nextRightRow.classList.contains('forge-right-row'),
      progressMarked: document.querySelector('[data-fixture-control="persistent-plan"]')
        ?.classList.contains('forge-composer-progress-pill') || false,
      progressFadeMarked: document.querySelector('.native-progress-gradient')
        ?.classList.contains('forge-composer-progress-fade') || false,
      goalPanelMarked: document.querySelector('[data-fixture-surface="persistent-goal-panel"]')
        ?.classList.contains('forge-composer-panel') || false
    }));
  }));

  assert.deepEqual(firstPaint, {
    refreshCountDelta: 1,
    surface: 'thread',
    mode: 'scenery',
    sidebarMarked: true,
    rightRowMarked: true,
    progressMarked: true,
    progressFadeMarked: true,
    goalPanelMarked: true
  });

  const beforeStreamingText = await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.refreshCount);
  await page.evaluate(() => {
    document.querySelector('[data-virtualized-turn-content]').append(document.createTextNode(' · 流式增量'));
  });
  await page.waitForTimeout(700);
  assert.equal(
    await page.evaluate(() => window.__wukongCodexForgeRuntimeV13.refreshCount),
    beforeStreamingText,
    'ordinary streaming text must not trigger a first-paint or delayed refresh'
  );

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});

test('V23 maps the official 300px environment panel as paint-only scripture paper', async () => {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.route('http://wukong-v23-environment.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v23-environment.test/');

  const readContract = () => page.evaluate(() => {
    const rectOf = element => {
      const rect = element.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height];
    };
    const card = document.querySelector('[data-native-slot="right-card"]');
    const titleSurface = card.querySelector('.summary-heading-surface');
    const title = card.querySelector('.summary-heading');
    const add = card.querySelector('[data-native-slot="right-add"]');
    const rows = [...card.querySelectorAll('[data-slot="thread-summary-panel-item"]')];
    const sections = [...card.querySelectorAll('.summary-native-section')];
    const sectionTitles = [...card.querySelectorAll('.summary-native-section-title')];
    return {
      panel: rectOf(document.querySelector('[data-pip-obstacle="thread-summary-panel"]')),
      card: rectOf(card),
      titleSurface: rectOf(titleSurface),
      title: rectOf(title),
      add: rectOf(add),
      rows: rows.map(rectOf),
      rowText: rows.map(row => row.textContent.replace(/\s+/g, ' ').trim()),
      sections: sections.map(rectOf),
      sectionTitles: sectionTitles.map(rectOf),
      sectionTitleText: sectionTitles.map(section => (
        section.textContent.replace(/\s+/g, ' ').trim()
      )),
      addSemantics: {
        ariaLabel: add.getAttribute('aria-label'),
        role: add.getAttribute('role'),
        type: add.getAttribute('type'),
        tabIndex: add.tabIndex,
        disabled: add.disabled
      }
    };
  });
  const before = await readContract();
  assert.equal(before.card[2], 300, 'fixture must retain the official 300px card width');
  assert.equal(before.rows.length, 7);
  assert.equal(before.sections.length, 3);
  assert.equal(before.sectionTitles.length, 3);
  const fixtureTitlePaint = await page.evaluate(() => {
    const titleSurface = document.querySelector('.summary-heading-surface');
    const sectionTitle = document.querySelector('.summary-native-section-title');
    return {
      titleBase: getComputedStyle(titleSurface).backgroundColor,
      titleBefore: getComputedStyle(titleSurface, '::before').backgroundColor,
      sectionBase: getComputedStyle(sectionTitle).backgroundColor,
      sectionBefore: getComputedStyle(sectionTitle, '::before').backgroundColor
    };
  });
  for (const [layer, color] of Object.entries(fixtureTitlePaint)) {
    assert.notEqual(
      color,
      'rgba(0, 0, 0, 0)',
      `fixture must exercise the native dark ${layer} paint before injection`
    );
  }
  const beforeAddHits = await nativeHitPattern(page, selectors.rightAdd);

  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelector('[data-pip-obstacle="thread-summary-panel"]')
      ?.classList.contains('forge-right-panel') &&
    document.querySelector('[data-native-slot="right-card"]')
      ?.classList.contains('forge-right-card') &&
    document.querySelectorAll('.forge-right-row').length === 7 &&
    document.querySelectorAll('.forge-right-section').length === 3 &&
    document.querySelectorAll('.forge-right-section-title').length === 3 &&
    document.querySelectorAll('.forge-right-title-surface').length === 2
  ));

  assert.deepEqual(
    await readContract(),
    before,
    'environment-panel geometry, row order and native semantics must remain exact'
  );
  assert.deepEqual(
    await nativeHitPattern(page, selectors.rightAdd),
    beforeAddHits,
    'environment add control hit region changed'
  );
  assert.equal(await page.locator('.forge-right-panel').count(), 1);
  assert.equal(await page.locator('.forge-right-card').count(), 1);
  assert.equal(await page.locator('.forge-right-title').count(), 1);
  assert.equal(await page.locator('.forge-right-title-surface').count(), 2);
  assert.equal(await page.locator('.forge-right-row').count(), 7);
  assert.equal(await page.locator('.forge-right-section').count(), 3);
  assert.equal(await page.locator('.forge-right-section-title').count(), 3);

  const defaultPaint = await page.evaluate(() => {
    const card = document.querySelector('.forge-right-card');
    const row = document.querySelector('.forge-right-row');
    const style = getComputedStyle(card);
    const paper = getComputedStyle(card, '::before');
    const rail = getComputedStyle(card, '::after');
    const separator = getComputedStyle(row, '::after');
    const section = document.querySelector('.forge-right-section');
    const sectionTitle = document.querySelector('.forge-right-section-title');
    const sectionStyle = getComputedStyle(section);
    const sectionSeparator = getComputedStyle(section, '::after');
    const sectionTitleStyle = getComputedStyle(sectionTitle);
    const sectionTitleBefore = getComputedStyle(sectionTitle, '::before');
    const sectionTitleAfter = getComputedStyle(sectionTitle, '::after');
    const titleSurfaceStyles = [...document.querySelectorAll(
      '.forge-right-title-surface'
    )].map(surface => ({
      base: getComputedStyle(surface),
      before: getComputedStyle(surface, '::before'),
      after: getComputedStyle(surface, '::after')
    }));
    return {
      cardBackgroundColor: style.backgroundColor,
      cardBackgroundImage: style.backgroundImage,
      cardClipPath: style.clipPath,
      cardBorderRadius: style.borderRadius,
      cardColor: style.color,
      paperContent: paper.content,
      paperPointerEvents: paper.pointerEvents,
      paperBackgroundImage: paper.backgroundImage,
      paperBackgroundSize: paper.backgroundSize,
      paperClipPath: paper.clipPath,
      railContent: rail.content,
      separatorContent: separator.content,
      rowBackgroundColor: getComputedStyle(row).backgroundColor,
      sectionBackgroundColor: sectionStyle.backgroundColor,
      sectionBackgroundImage: sectionStyle.backgroundImage,
      sectionSeparatorBackgroundImage: sectionSeparator.backgroundImage,
      sectionTitleBackgroundImage: sectionTitleStyle.backgroundImage,
      sectionTitleBackgroundColor: sectionTitleStyle.backgroundColor,
      sectionTitleClipPath: sectionTitleStyle.clipPath,
      sectionTitleColor: sectionTitleStyle.color,
      sectionTitleShadow: sectionTitleStyle.boxShadow,
      sectionTitleBeforeBackgroundImage: sectionTitleBefore.backgroundImage,
      sectionTitleBeforeBackgroundColor: sectionTitleBefore.backgroundColor,
      sectionTitleBeforeShadow: sectionTitleBefore.boxShadow,
      sectionTitleAfterBackgroundImage: sectionTitleAfter.backgroundImage,
      sectionTitleAfterBackgroundColor: sectionTitleAfter.backgroundColor,
      sectionTitleAfterShadow: sectionTitleAfter.boxShadow,
      titleSurfaces: titleSurfaceStyles.map(({ base, before, after }) => ({
        backgroundImage: base.backgroundImage,
        backgroundColor: base.backgroundColor,
        shadow: base.boxShadow,
        beforeBackgroundImage: before.backgroundImage,
        beforeBackgroundColor: before.backgroundColor,
        beforeShadow: before.boxShadow,
        afterBackgroundImage: after.backgroundImage,
        afterBackgroundColor: after.backgroundColor,
        afterShadow: after.boxShadow
      }))
    };
  });
  assert.equal(defaultPaint.cardBackgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(defaultPaint.cardBackgroundImage, 'none');
  assert.equal(defaultPaint.cardClipPath, 'none');
  assert.equal(defaultPaint.paperContent, '""');
  assert.equal(defaultPaint.paperPointerEvents, 'none');
  assert.match(defaultPaint.paperBackgroundImage, /linear-gradient/);
  assert.match(defaultPaint.paperBackgroundImage, /data:image\/svg\+xml/);
  assert.equal(defaultPaint.paperBackgroundSize, '100% 100%, 512px 220px');
  assert.match(defaultPaint.paperClipPath, /^polygon\(/);
  assert.equal(defaultPaint.railContent, 'none');
  assert.equal(defaultPaint.separatorContent, '""');
  assert.notEqual(defaultPaint.cardColor, 'rgba(0, 0, 0, 0)');
  assert.equal(defaultPaint.sectionBackgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(defaultPaint.sectionBackgroundImage, 'none');
  assert.match(defaultPaint.sectionSeparatorBackgroundImage, /linear-gradient/);
  assert.equal(defaultPaint.sectionTitleBackgroundImage, 'none');
  assert.equal(defaultPaint.sectionTitleBackgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(defaultPaint.sectionTitleClipPath, 'none');
  assert.notEqual(defaultPaint.sectionTitleColor, 'rgba(0, 0, 0, 0)');
  assert.equal(defaultPaint.sectionTitleShadow, 'none');
  assert.equal(defaultPaint.sectionTitleBeforeBackgroundImage, 'none');
  assert.equal(defaultPaint.sectionTitleBeforeBackgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(defaultPaint.sectionTitleBeforeShadow, 'none');
  assert.equal(defaultPaint.sectionTitleAfterBackgroundImage, 'none');
  assert.equal(defaultPaint.sectionTitleAfterBackgroundColor, 'rgba(0, 0, 0, 0)');
  assert.equal(defaultPaint.sectionTitleAfterShadow, 'none');
  assert.equal(defaultPaint.titleSurfaces.length, 2);
  for (const titleSurface of defaultPaint.titleSurfaces) {
    assert.equal(titleSurface.backgroundImage, 'none');
    assert.equal(titleSurface.backgroundColor, 'rgba(0, 0, 0, 0)');
    assert.equal(titleSurface.shadow, 'none');
    assert.equal(titleSurface.beforeBackgroundImage, 'none');
    assert.equal(titleSurface.beforeBackgroundColor, 'rgba(0, 0, 0, 0)');
    assert.equal(titleSurface.beforeShadow, 'none');
    assert.equal(titleSurface.afterBackgroundImage, 'none');
    assert.equal(titleSurface.afterBackgroundColor, 'rgba(0, 0, 0, 0)');
    assert.equal(titleSurface.afterShadow, 'none');
  }

  const firstRow = page.locator('.forge-right-row').first();
  await firstRow.hover();
  assert.notEqual(
    await firstRow.evaluate(element => getComputedStyle(element).backgroundColor),
    defaultPaint.rowBackgroundColor,
    'environment row hover must be visible without changing its geometry'
  );
  await page.locator(selectors.rightAdd).focus();
  assert.notEqual(
    await page.locator(selectors.rightAdd).evaluate(
      element => getComputedStyle(element).outlineStyle
    ),
    'none',
    'environment control focus must remain visible'
  );
  assert.deepEqual(await readContract(), before);

  const immediatePersistentEnvironment = await page.evaluate(() => {
    const oldCard = document.querySelector('[data-native-slot="right-card"]');
    const replacement = oldCard.cloneNode(true);
    [replacement, ...replacement.querySelectorAll('[data-forge-mark]')].forEach(element => {
      element.removeAttribute('data-forge-mark');
      [...element.classList]
        .filter(className => className.startsWith('forge-'))
        .forEach(className => element.classList.remove(className));
    });
    oldCard.replaceWith(replacement);

    const titleSurface = replacement.querySelector('.summary-heading-surface');
    const sectionTitle = replacement.querySelector('.summary-native-section-title');
    const row = replacement.querySelector('[data-slot="thread-summary-panel-item"]');
    const outsidePanel = document.createElement('div');
    outsidePanel.dataset.pipObstacle = 'unrelated-panel';
    outsidePanel.innerHTML = '<section class="relative flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-token-dropdown-background pt-2.5"></section>';
    document.getElementById('root').append(outsidePanel);
    const outsideCard = outsidePanel.firstElementChild;
    const result = {
      cardMarker: replacement.classList.contains('forge-right-card'),
      rowMarker: row.classList.contains('forge-right-row'),
      paperContent: getComputedStyle(replacement, '::before').content,
      paperImage: getComputedStyle(replacement, '::before').backgroundImage,
      titleBackground: getComputedStyle(titleSurface).backgroundColor,
      titleBeforeBackground: getComputedStyle(titleSurface, '::before').backgroundColor,
      sectionTitleBackground: getComputedStyle(sectionTitle).backgroundColor,
      rowSeparatorContent: getComputedStyle(row, '::after').content,
      rowSeparatorImage: getComputedStyle(row, '::after').backgroundImage,
      unrelatedPaperContent: getComputedStyle(outsideCard, '::before').content
    };
    outsidePanel.remove();
    return result;
  });
  assert.equal(immediatePersistentEnvironment.cardMarker, false);
  assert.equal(immediatePersistentEnvironment.rowMarker, false);
  assert.equal(immediatePersistentEnvironment.paperContent, '""');
  assert.notEqual(immediatePersistentEnvironment.paperImage, 'none');
  assert.equal(immediatePersistentEnvironment.titleBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(immediatePersistentEnvironment.titleBeforeBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(immediatePersistentEnvironment.sectionTitleBackground, 'rgba(0, 0, 0, 0)');
  assert.equal(immediatePersistentEnvironment.rowSeparatorContent, '""');
  assert.notEqual(immediatePersistentEnvironment.rowSeparatorImage, 'none');
  assert.equal(immediatePersistentEnvironment.unrelatedPaperContent, 'none');

  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="right-card"]')?.classList.contains('forge-right-card') &&
    document.querySelectorAll('.forge-right-row').length === 7 &&
    document.querySelectorAll('.forge-right-section').length === 3 &&
    document.querySelectorAll('.forge-right-section-title').length === 3
  ));
  assert.deepEqual(await readContract(), before);

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('.forge-right-card').count(), 0);
  assert.equal(await page.locator('.forge-right-title-surface').count(), 0);
  assert.equal(await page.locator('.forge-right-row').count(), 0);
  assert.equal(await page.locator('.forge-right-section').count(), 0);
  assert.equal(await page.locator('.forge-right-section-title').count(), 0);
  assert.deepEqual(await readContract(), before);
  await page.close();
});

test('V15 yields all journal materials to Windows forced-colors mode', async () => {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 820 },
    deviceScaleFactor: nativeUiBaseline.rendererDeviceScaleFactor
  });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.route('http://wukong-v14-forced-colors.test/**', route => route.fulfill({
    body: runtimeFixtureHtml,
    contentType: 'text/html; charset=utf-8'
  }));
  await page.goto('http://wukong-v14-forced-colors.test/');
  await page.evaluate(() => {
    document.querySelector('[data-native-slot="menu-file"]').disabled = true;
    document.querySelector('[data-native-slot="menu-view"]')
      .setAttribute('aria-expanded', 'true');
    document.querySelector('[data-native-slot="menu-help"]').dataset.state = 'open';
    document.querySelector('[data-native-slot="new-task-menu"]').dataset.state = 'open';
    document.querySelector('[data-native-slot="plugins"]').disabled = true;
  });
  const before = await snapshot(page);
  await page.evaluate(expression);
  await page.waitForFunction(() => (
    document.querySelectorAll('.forge-topbar-menu-item').length === 4 &&
    document.querySelector('.forge-composer-frame')
  ));
  const immediateForcedPersistent = await page.evaluate(() => {
    const stripThemeMarks = root => {
      for (const element of [root, ...root.querySelectorAll('[data-forge-mark]')]) {
        element.removeAttribute('data-forge-mark');
        [...element.classList]
          .filter(className => className.startsWith('forge-'))
          .forEach(className => element.classList.remove(className));
      }
    };
    const oldComposer = document.querySelector('[data-native-slot="composer"]');
    const composer = oldComposer.cloneNode(true);
    stripThemeMarks(composer);
    oldComposer.replaceWith(composer);
    const oldCard = document.querySelector('[data-native-slot="right-card"]');
    const card = oldCard.cloneNode(true);
    stripThemeMarks(card);
    oldCard.replaceWith(card);
    const submit = composer.querySelector('[data-native-slot="composer-submit"]');
    const row = card.querySelector('[data-slot="thread-summary-panel-item"]');
    return {
      composerMarker: composer.classList.contains('forge-composer-frame'),
      cardMarker: card.classList.contains('forge-right-card'),
      composerImage: getComputedStyle(composer).backgroundImage,
      composerPaperContent: getComputedStyle(composer, '::before').content,
      composerPaperImage: getComputedStyle(composer, '::before').backgroundImage,
      submitImage: getComputedStyle(submit).backgroundImage,
      cardImage: getComputedStyle(card).backgroundImage,
      cardPaperContent: getComputedStyle(card, '::before').content,
      cardPaperImage: getComputedStyle(card, '::before').backgroundImage,
      rowSeparatorContent: getComputedStyle(row, '::after').content
    };
  });
  assert.equal(immediateForcedPersistent.composerMarker, false);
  assert.equal(immediateForcedPersistent.cardMarker, false);
  assert.equal(immediateForcedPersistent.composerImage, 'none');
  assert.equal(immediateForcedPersistent.composerPaperContent, 'none');
  assert.equal(immediateForcedPersistent.composerPaperImage, 'none');
  assert.equal(immediateForcedPersistent.submitImage, 'none');
  assert.equal(immediateForcedPersistent.cardImage, 'none');
  assert.equal(immediateForcedPersistent.cardPaperContent, 'none');
  assert.equal(immediateForcedPersistent.cardPaperImage, 'none');
  assert.equal(immediateForcedPersistent.rowSeparatorContent, 'none');
  await page.waitForFunction(() => (
    document.querySelector('[data-native-slot="composer"]')?.classList.contains('forge-composer-frame') &&
    document.querySelector('[data-native-slot="right-card"]')?.classList.contains('forge-right-card')
  ));
  await page.locator(
    '[data-app-action-sidebar-project-row][aria-expanded="false"]'
  ).hover();
  await page.locator('[data-native-slot="project-active"]').focus();

  const forcedPaint = await page.evaluate(() => {
    const selector = [
      '.forge-composer-frame',
      '.forge-composer-context',
      '.forge-composer-panel-stack',
      '.forge-composer-panel',
      '.forge-composer-queue-item',
      '.forge-composer-progress-pill',
      '.forge-plan-pill',
      '.forge-diff-summary',
      '.forge-composer-submit',
      '.forge-topbar-menu-item',
      '.forge-sidebar-shell',
      '.forge-sidebar-action',
      '.forge-sidebar-level1',
      '.forge-sidebar-level2',
      '.forge-sidebar-selected',
      '.forge-right-card',
      '.forge-right-title',
      '.forge-right-title-surface',
      '.forge-right-section',
      '.forge-right-section-title',
      '.forge-right-row'
    ].join(',');
    return [...new Set(document.querySelectorAll(selector))].map((element, index) => {
      const style = getComputedStyle(element);
      return {
        selector: `${element.className}#${index}`,
        backgroundImage: style.backgroundImage,
        boxShadow: style.boxShadow,
        color: style.color,
        opacity: style.opacity,
        clipPath: style.clipPath,
        forcedColorAdjust: style.forcedColorAdjust
      };
    });
  });
  for (const paint of forcedPaint) {
    assert.equal(paint.backgroundImage, 'none', `${paint.selector} retained a bitmap`);
    assert.equal(paint.boxShadow, 'none', `${paint.selector} retained a decorative shadow`);
    assert.notEqual(paint.color, 'rgba(0, 0, 0, 0)', `${paint.selector} lost readable text`);
    assert.equal(paint.opacity, '1', `${paint.selector} retained theme opacity`);
    assert.equal(paint.clipPath, 'none', `${paint.selector} retained a theme clip path`);
    assert.equal(paint.forcedColorAdjust, 'auto', `${paint.selector} blocks system colors`);
  }
  assert.notEqual(
    await page.locator('[data-native-slot="project-active"]').evaluate(
      element => getComputedStyle(element).outlineStyle
    ),
    'none',
    'forced-colors focus must return to the system outline'
  );
  assertRectsEqual(await snapshot(page), before);

  await page.evaluate(RESTORE_EXPRESSION);
  assert.equal(await page.locator('[data-forge-mark]').count(), 0);
  await page.close();
});
