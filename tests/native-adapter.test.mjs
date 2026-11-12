import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { NATIVE_UI_SELECTORS, createNativeUiAdapter } from '../runtime/native-ui-contract.mjs';
import { makeApplyExpression, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import { loadNativeBundle, nativeFunction, nodes, ownNodes, prop, text, key } from './native-bundle-current-helper.mjs';

const css = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="32"><path fill="#546c7f" d="M0 0h48v32H0z"/></svg>');
const variables = `:root.forge-ink-mountain{--forge-scene-count:2;--forge-battle-scenes:0;--forge-scenery-scenes:1;--forge-bg-0:url("${image}");--forge-bg-1:url("${image}");}`;
const apply = makeApplyExpression({ styleSheet: css, variables });
const adapterExpression = `window.adapter=(${createNativeUiAdapter.toString()})(document,${JSON.stringify(NATIVE_UI_SELECTORS)})`;
let browser;
test.before(async () => { browser = await chromium.launch({ headless: true }); });
test.after(async () => { await browser?.close(); });

test('native ownership survives utility churn and retained hidden main/shell nodes', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>
      [data-app-shell-page-surface]{position:relative;height:700px}
      [class^="PageSurface-"]{position:absolute;inset:20px;border-radius:31px;pointer-events:none}
      main{height:300px}aside{height:200px}.sidebar-navigation{height:100px}
    </style><section hidden data-app-shell-page-surface><div class="PageSurface-retired2"></div><main id="stale" data-app-shell-main-surface>Old</main></section>
    <section style="opacity:0" data-app-shell-page-surface="true">
      <div class="PageSurface-transparent3" aria-hidden="true" style="opacity:1"></div>
      <main data-app-shell-main-surface="default" style="opacity:1">
        <aside data-app-shell-left-panel-appearance="default"><div class="sidebar-navigation">Retained navigation</div></aside>
        <div data-settings-mobile-header="false" style="height:100px">Retained settings</div>
      </main>
    </section>
    <div style="visibility:hidden"><section data-app-shell-page-surface="true">
      <div id="paint" style="visibility:visible" class="PageSurface-newhash99" aria-hidden="true"></div>
      <main id="active" style="visibility:visible" data-app-shell-main-surface="default">
        <aside data-app-shell-left-panel-appearance="default"><div id="nav" class="sidebar-navigation changed-classes"><div class="sidebar-navigation">Inner list</div></div></aside>
      </main></section></div>`);
    await page.evaluate(adapterExpression);
    assert.deepEqual(await page.evaluate(() => ({
      main: adapter.workspace()?.id,
      paint: adapter.pagePaint()?.id,
      sidebar: adapter.conversationSidebar()?.id,
      settings: adapter.settingsActive(),
      paintedLeaf: adapter.visible(document.querySelector('#paint')),
      hasLayout: adapter.layoutPresent(document.querySelector('#paint'))
    })), { main: 'active', paint: 'paint', sidebar: 'nav', settings: false, paintedLeaf: false, hasLayout: true });
    await page.locator('#active').evaluate(e => e.setAttribute('inert', ''));
    assert.equal(await page.evaluate(() => adapter.workspace()), null);
    await page.locator('#active').evaluate(e => { e.removeAttribute('inert'); e.style.contentVisibility='hidden'; });
    assert.equal(await page.evaluate(() => adapter.workspace()), null);
  } finally { await page.close(); }
});

test('settings state follows mounted settings and excludes schedule dialogs', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<div role="dialog"><form class="group/settings" style="height:100px">Schedule</form></div><div hidden id="settings" data-settings-mobile-header="false" style="height:200px">Settings</div><div style="opacity:0"><div id="faded-settings" class="group/settings" style="height:100px;opacity:1">Retained settings</div></div>');
    await page.evaluate(adapterExpression);
    assert.equal(await page.evaluate(() => adapter.settingsActive()), false);
    await page.locator('#settings').evaluate(e => e.hidden=false);
    assert.equal(await page.evaluate(() => adapter.settingsActive()), true);
  } finally { await page.close(); }
});

test('activity sidebar keeps its native paint and cannot become the conversation navigation owner', async () => {
  const bundle = loadNativeBundle();
  const shells = bundle.findModules(['data-sidebar-navigation-root', 'data-slate-sidebar-content', 'app-shell-floating-left-panel']);
  const activities = bundle.findModules(['ActivitySidebar:', 'activity-sidebar-toolbar-button']);
  assert.equal(shells.length, 1);
  assert.equal(activities.length, 1);
  const [shell] = shells, [activity] = activities;
  const jsx = node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression';
  const navigation = nodes(shell.ast).find(node => jsx(node) && prop(node.arguments[1], 'data-sidebar-navigation-root'));
  const slate = nodes(shell.ast).find(node => jsx(node) && prop(node.arguments[1], 'data-slate-sidebar-content'));
  const floatingShell = nodes(shell.ast).find(node => jsx(node) && text(node.arguments[0]) === 'aside' &&
    text(prop(node.arguments[1], 'data-testid')) === 'app-shell-floating-left-panel');
  const owner = nativeFunction(shell, navigation.start);
  const activityCall = ownNodes(owner.ast).find(node => jsx(node) && prop(node.arguments[1], 'showBack') &&
    node.arguments[0]?.type === 'MemberExpression' && key(node.arguments[0].property) === 'S');
  const provider = bundle.imports(shell)[activityCall?.arguments[0].object.name];
  assert.ok(provider && bundle.module(provider.id).source.includes(`"${activity.id}"`), 'Activity is mounted by the shared sidebar owner');
  const navigationClass = nodes(prop(navigation.arguments[1], 'className')).map(text).find(value => value.endsWith('overflow-hidden sidebar-navigation'));
  const slateClass = text(prop(slate.arguments[1], 'className'));
  const floatingClass = nodes(prop(floatingShell.arguments[1], 'className')).map(text).find(value => value.endsWith('overflow-hidden bg-surface'));
  const activitySection = nodes(activity.ast).find(node => jsx(node) && text(node.arguments[0]) === 'section' && prop(node.arguments[1], 'aria-label'));
  const activityOwner = nativeFunction(activity, activitySection.start);
  const activityClass = ownNodes(activityOwner.ast).find(node => node.type === 'AssignmentExpression' &&
    node.left.name === prop(activitySection.arguments[1], 'className').name && node.right.type === 'Literal')?.right.value;
  assert.ok(navigationClass && slateClass.includes('sidebar-navigation') && floatingClass && activityClass?.split(' ').includes('font-openai-sans'));
  const nativeCss = bundle.css(['.sidebar-navigation:not(.sidebar-navigation .sidebar-navigation)']);
  const activityViews = [
    '<header><button class="activity-sidebar-toolbar-button">Filter</button></header><button data-activity-id="fixture">Entry</button>',
    '<header><button class="activity-sidebar-toolbar-button">Filter</button></header><div role="status">Empty</div>',
    '<header><button>Back</button></header><div>Detail</div>'
  ];
  for (const mode of ['dark', 'light']) {
    const page = await browser.newPage({ colorScheme: mode });
    try {
      for (const [floating, wrap] of [[false, false], [false, true], [true, true]]) for (const view of activityViews) {
        const section = `<section id="activity" class="${activityClass}" aria-label="Fixture activity">${view}</section>`;
        const children = wrap ? `<div id="slate" data-slate-sidebar-content="true" class="${slateClass}"><div>${section}</div></div>` : section;
        const shellAttributes = floating ? `class="${floatingClass}" data-testid="app-shell-floating-left-panel"` : 'class="app-shell-left-panel"';
        await page.setContent(`<html class="electron-${mode}" data-theme="${mode}" style="color-scheme:${mode}"><style>${nativeCss}</style>
          <style>aside{display:flex;height:320px;width:300px}</style><aside ${shellAttributes} data-app-shell-left-panel-appearance="default">
          <div id="shared" class="${navigationClass}" data-sidebar-navigation-root="true">${children}</div></aside></html>`);
        await page.evaluate(adapterExpression);
        const read = () => page.locator('#shared,#slate,#activity').evaluateAll(elements => elements.map(element => {
          const style = getComputedStyle(element), rect = element.getBoundingClientRect();
          return { id: element.id, rect: [rect.x, rect.y, rect.width, rect.height], radius: style.borderRadius,
            paint: [style.backgroundColor, style.backgroundImage, style.backdropFilter] };
        }));
        const before = await read();
        await page.addStyleTag({ content: css });
        await page.evaluate(value => { document.documentElement.classList.add('forge-ink-mountain'); document.documentElement.dataset.forgeNativeTheme = value; }, mode);
        assert.deepEqual(await read(), before, 'Activity retains native gutter paint and geometry across list, empty and detail');
        assert.equal(await page.evaluate(() => adapter.conversationSidebar()), null, 'The activity branch is excluded from conversation sampling');
        if (floating) assert.match(await page.locator('aside').evaluate(element => getComputedStyle(element).backdropFilter), /^blur\(/,
          'The floating shell keeps its separate glass material');
        await page.locator('#activity').evaluate(element => element.replaceWith(document.createElement('nav')));
        assert.equal(await page.evaluate(() => adapter.conversationSidebar()?.id), 'shared');
        if (!floating) assert.match((await read())[0].paint[2], /^blur\(/, 'The docked wrapper resumes conversation material on return');
      }
    } finally { await page.close(); }
  }
});

test('new composer rails map through attributes without native spacing or font tokens', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent(`<style>main{height:500px}.context{display:flex;min-height:90px}.composer-surface-chrome{height:130px}[data-composer-rail-item]{height:42px}[data-summary-panel-variant]{height:80px}</style>
      <main data-app-shell-main-surface="default"><h1>What should we build?</h1>
      <div data-codex-composer-root>
      <div data-above-composer-portal data-above-composer-conversation-id="fixture"><div data-in-progress-fixed-content><div id="progress" class="bg-surface-elevated-secondary">Localized status without a file count</div></div></div><div>
        <div id="context" class="context"><button data-composer-navigation-target="workspace-project">Project</button><button data-composer-navigation-target="branch">Branch</button></div>
        <div id="stack" data-composer-rail data-composer-rail-placement="above">
          <div id="queue" data-composer-rail-item="present" data-composer-rail-framed><div class="vertical-scroll-fade-mask"><div id="item" class="overflow-visible"><button>Queued item</button></div></div></div>
          <div id="goal" data-composer-rail-item="present" data-composer-rail-framed>Goal</div>
        </div><div class="composer-surface-chrome" data-composer-surface-variant="default"><div class="ProseMirror" role="textbox">Input</div></div>
      </div></div><div id="summary" data-summary-panel-variant="summary"><button data-slot="thread-summary-panel-item-button">Summary</button></div></main>`);
    await page.evaluate(apply);
    const marks = () => page.evaluate(() => Object.fromEntries(['context','stack','queue','goal','summary'].map(id => [id,[...document.getElementById(id).classList].filter(c=>c.startsWith('forge-'))])));
    const state = await marks();
    assert.ok(state.context.includes('forge-composer-context'));
    assert.ok(state.stack.includes('forge-composer-panel-stack'));
    assert.ok(state.queue.includes('forge-composer-panel'));
    assert.ok(state.goal.includes('forge-composer-panel'));
    assert.ok(state.summary.includes('forge-right-panel'));
    assert.equal(await page.locator('#progress').evaluate(e => e.classList.contains('forge-composer-progress-pill')), true);
    await page.evaluate(() => document.querySelector('#goal').setAttribute('data-composer-rail-item','exiting'));
    await page.waitForFunction(() => !document.querySelector('#goal').classList.contains('forge-composer-panel'));
    await page.evaluate(RESTORE_EXPRESSION);
    assert.equal(await page.locator('[data-forge-mark]').count(), 0);
    assert.equal(await page.locator('#goal').getAttribute('data-composer-rail-item'), 'exiting');
  } finally { await page.close(); }
});

test('mounting an empty dot is a route signal and reuses decoded wallpaper layers', async () => {
  const page = await browser.newPage();
  try {
    await page.setContent('<style>main{height:500px}.thread-pane{height:300px}</style><main data-app-shell-main-surface="default"><h1>What should we build?</h1></main>');
    await page.evaluate(apply);
    await page.waitForFunction(() => document.documentElement.dataset.forgeBackgroundReady === 'true');
    await page.evaluate(() => { window.initialOverlay=document.querySelector('#wukong-codex-theme-background'); document.querySelector('main').insertAdjacentHTML('beforeend','<div class="messaging-root messaging-embedded"><div class="thread-pane">Empty dot</div></div>'); });
    await page.waitForFunction(() => document.documentElement.dataset.forgeMode === 'scenery');
    assert.equal(await page.evaluate(() => initialOverlay === document.querySelector('#wukong-codex-theme-background')), true);
    await page.evaluate(() => document.querySelector('.messaging-root').remove());
    await page.waitForFunction(() => document.documentElement.dataset.forgeMode === 'battle');
  } finally { await page.close(); }
});
