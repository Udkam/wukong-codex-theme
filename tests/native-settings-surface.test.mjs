import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { loadNativeBundle, nodes, prop, text, key, nativeFunction, nativeObject, presentationHarness } from './native-bundle-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const bundle = loadNativeBundle();
const jsx = node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression';
const unique = (records, message) => { assert.equal(records.length, 1, message); return records[0]; };
const literalClass = (record, marker) => nodes(record.ast).map(text).find(value => value.includes(marker));

const panel = unique(bundle.findModules(['data-codex-history-swipe-page', 'data-settings-panel']), 'Native routed settings owner changed');
const panelNodes = nodes(panel.ast).filter(node => jsx(node) && prop(node.arguments[1], 'data-settings-panel'));
assert.equal(panelNodes.length, 2, 'Both routed and dialog settings must use the same semantic panel');
assert.ok(panelNodes.every(node => prop(node.arguments[1], 'data-settings-panel').type === 'UnaryExpression'), 'Settings marker stays unconditional');
const panelClass = text(prop(panelNodes.find(node => prop(node.arguments[1], 'data-codex-history-swipe-page')).arguments[1], 'className'));
const dialog = unique(bundle.findModules(['settings-dialog-backdrop', 'settings-dialog overflow-hidden']), 'Native settings window changed');
const dialogCall = nodes(dialog.ast).find(node => jsx(node) && prop(node.arguments[1], 'contentClassName'));
assert.equal(text(prop(dialogCall.arguments[1], 'overlayClassName')), 'settings-dialog-backdrop');
assert.equal(prop(dialogCall.arguments[1], 'unstyledContent').type, 'UnaryExpression', 'Settings owns its separate content plate');
const dialogClass = text(prop(dialogCall.arguments[1], 'contentClassName'));
const nav = unique(bundle.findModules(['sidebar settings-dialog-sidebar']), 'Native settings navigation changed');
assert.ok(Object.values(bundle.imports(panel)).some(value => value.id === nav.id), 'Routed settings must use the shared settings navigation layout');
const navClass = literalClass(nav, 'sidebar settings-dialog-sidebar');
const layoutClass = literalClass(nav, 'flex h-full min-h-0 min-w-0');
const profile = unique(bundle.findModules(['data-profile-scroll', 'data-settings-search-root']), 'Native profile settings shell changed');
const profileClass = literalClass(profile, 'relative flex h-full min-h-0 min-w-0 flex-1 flex-col electron:overflow-hidden electron:bg-surface');
assert.ok(profileClass && profileClass.includes('windows:rounded-tl-lg'), 'Profile preserves its own native shell contour');
const profileFunction = nativeFunction(profile, 'data-profile-scroll');
const profileRoot = profileFunction.nodes.find(node => jsx(node) && prop(node.arguments[1], 'data-settings-search-root'));
const profileScroll = profileFunction.nodes.find(node => jsx(node) && prop(node.arguments[1], 'data-profile-scroll'));
assert.ok(profileRoot && profileScroll && !profileFunction.nodes.some(node => text(node) === 'data-settings-panel'), 'Standalone profile must not depend on a settings-panel ancestor');
const rootClassName = prop(profileRoot.arguments[1], 'className').name;
assert.ok(profileFunction.nodes.some(node => node.type === 'AssignmentExpression' && node.left.name === rootClassName && nodes(node.right).some(value => text(value) === profileClass)), 'Profile class must belong to the semantic root');
const profileScrollClass = literalClass(profile, '@container flex-1 scrollbar-stable overflow-y-auto');
assert.ok(profileScrollClass, 'Profile retains its own native scroll surface');
const layout = unique(bundle.findModules(['group/settings mx-auto flex w-full flex-col']), 'Native settings content layout changed');
const contentClass = literalClass(layout, 'flex h-full min-h-0 flex-col electron:overflow-hidden electron:bg-surface');
const groupClass = literalClass(layout, 'group/settings mx-auto flex w-full flex-col');
const card = unique(bundle.findModules(['--settings-surface-background', 'recommendation']), 'Native settings card changed');
const cardFunction = nativeFunction(card, '--settings-surface-background');
const harness = presentationHarness(bundle);
const classesImport = Object.entries(bundle.imports(card)).find(([, imported]) => Object.values(bundle.exports(bundle.module(imported.id))).some(value => text(value).includes('[&>*:not(:last-child)]')));
assert.ok(classesImport, 'Settings card dividers remain owned by its native CSS export');
const classes = Object.fromEntries(Object.entries(bundle.exports(bundle.module(classesImport[1].id))).map(([name, value]) => [name, nativeObject(bundle.module(classesImport[1].id), value)]));
const renderCard = harness.compile(cardFunction, { [classesImport[0]]: classes });
const defaultCard = renderCard({ variant: 'default', children: 'Fixture options' });
const boxedCard = renderCard({ variant: 'boxed', children: 'Fixture options' });
const flatMarker = '[[data-settings-panel]_&]:[--settings-surface-background:transparent]';
assert.ok(defaultCard.props.className.split(' ').includes(flatMarker), 'Default card must remain native flat rows in a settings panel');
assert.ok(!boxedCard.props.className.split(' ').includes(flatMarker), 'Explicit boxed cards retain a distinct material');
assert.ok(defaultCard.props.style.backgroundColor.includes('--settings-surface-background'));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const cardHtml = (id, tree) => `<div id="${id}" class="${escape(tree.props.className)}" style="background-color:${escape(tree.props.style.backgroundColor)}"><button class="text-default" data-native-control>Preference</button><button disabled class="text-secondary" data-native-control>Unavailable</button></div>`;

test('current settings window and profile-settings shells receive material while native flat rows stay transparent', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, colorScheme: mode });
      try {
        await page.setContent(`<html data-theme="${mode}" data-codex-os="win32" data-codex-window-type="electron" data-appearance-preset="codex" style="color-scheme:${mode}"><style>${bundle.css()}</style><style>body{margin:20px;background:linear-gradient(120deg,#597b9d,#dcbe85)}#profile{height:250px;width:800px;margin-top:20px}button[data-native-control]{min-height:38px;text-align:start}</style><body>
          <div id="window" role="dialog" class="${dialogClass}"><div class="${layoutClass}">
            <div id="navigation" class="${navClass}"><nav><button class="sidebar-item" data-native-control>Account</button><button class="sidebar-item" data-native-control>App</button></nav></div>
            <div data-settings-panel class="${panelClass}"><div id="content" class="${contentClass}"><div class="${groupClass}" data-density="default">${cardHtml('flat', defaultCard)}${cardHtml('boxed', boxedCard)}</div></div></div>
          </div></div>
          <div id="profile" data-settings-search-root class="${profileClass}"><div data-profile-scroll class="${profileScrollClass}"><h1 class="heading-xl text-default select-none">Fixture profile</h1><button data-native-control class="text-default">Edit fixture</button></div></div>
          <div id="preview" data-testid="theme-preview" class="bg-surface">Native preview</div></body></html>`);
        const snapshot = () => page.locator('#window,#navigation,#content,#flat,#boxed,#profile,[data-native-control]').evaluateAll(elements => elements.map(element => {
          const style = getComputedStyle(element), r = element.getBoundingClientRect();
          return { id: element.id, rect: [r.x, r.y, r.width, r.height], radius: style.borderRadius, overflow: style.overflow,
            font: style.font, color: style.color, position: style.position, disabled: element.disabled, tabIndex: element.tabIndex,
            pointer: style.pointerEvents, borderWidth: style.borderWidth };
        }));
        const before = await snapshot();
        const previewBefore = await page.locator('#preview').evaluate(element => getComputedStyle(element).backgroundColor);
        assert.equal(await page.locator('#flat').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)');
        assert.equal(await page.locator('#profile').evaluate(element => element.closest('[data-settings-panel]')), null, 'Profile fixture has no invented settings wrapper');
        assert.notEqual(await page.locator('#profile').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'Native standalone profile reproduces the opaque shell');
        await page.addStyleTag({ content: theme });
        await page.evaluate(mode => { document.documentElement.classList.add('forge-ink-mountain'); document.documentElement.dataset.forgeNativeTheme = mode; }, mode);
        assert.deepEqual(await snapshot(), before, `${mode}: settings geometry, native text and controls remain unchanged`);
        for (const id of ['content', 'profile', 'flat']) {
          const paint = await page.locator(`#${id}`).evaluate(element => { const style = getComputedStyle(element); return [style.backgroundColor, style.backgroundImage, style.backdropFilter]; });
          assert.deepEqual(paint, ['rgba(0, 0, 0, 0)', 'none', 'none'], `${mode}: ${id} stays transparent without a nested glass rectangle`);
        }
        assert.match(await page.locator('#window').evaluate(element => getComputedStyle(element).backgroundImage), /linear-gradient/, 'The actual settings window owns one themed plate');
        assert.match(await page.locator('#boxed').evaluate(element => getComputedStyle(element).backgroundImage), /linear-gradient/, 'Native explicitly boxed sections keep their separate material');
        assert.equal(await page.locator('#navigation').evaluate(element => getComputedStyle(element).backgroundColor), mode === 'dark' ? 'rgba(20, 24, 28, 0.64)' : 'rgba(247, 249, 251, 0.6)');
        assert.equal(await page.locator('#preview').evaluate(element => getComputedStyle(element).backgroundColor), previewBefore);
        await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
        assert.deepEqual(await snapshot(), before, 'Restoring native leaves settings layout and controls intact');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
