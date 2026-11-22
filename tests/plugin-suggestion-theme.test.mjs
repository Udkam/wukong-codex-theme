import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { createPluginSuggestionTheme } from '../runtime/plugin-suggestion-theme.mjs';
import { key, loadNativeBundle, nodes } from './native-bundle-current-helper.mjs';

const nativeCss = fs.readFileSync(new URL('./fixtures/plugin-suggestion-native.css', import.meta.url), 'utf8');
const themeCss = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const guestOrigin = 'https://connector-id-34b79eb8c16f076166e29359db7191ef.web-sandbox.oaiusercontent.com';
const guestTitle = 'Codex Apps MCP suggest_plugins';
const styleId = 'wukong-plugin-suggestion-style';
const markup = `<div class="_Shell_1gv8j_3"><section class="_Root_1gv8j_8" data-theme="dark" data-layout="single" data-presentation="desktop-request">
  <span class="_Heading_1gv8j_90">建议的插件 · 组件夹具</span><article class="_Card_1gv8j_101" id="card">
  <button type="button" class="_Identity_1gv8j_126" id="identity"><span class="_IconFrame_1gv8j_142" id="tile"><img alt="Fixture logo" class="_Icon_1rgnj_120" width="24" height="24" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M3 3h18v18H3z' fill='%2319232d'/%3E%3C/svg%3E"></span>
  <span class="_Content_1gv8j_170" aria-live="polite"><span class="_Title_1gv8j_178">Example Plugin</span><span class="_Description_1gv8j_185" id="description">无法建立连接</span></span></button>
  <div class="_Actions_1gv8j_196"><span class="_ActionSlot_1gv8j_207"><span class="_ActionSizer_1gv8j_208" aria-hidden="true"><button type="button" class="_SecondaryAction_1gv8j_226" tabindex="-1">稍后</button></span><button type="button" class="_SecondaryAction_1gv8j_226" id="later">稍后</button></span>
  <span class="_ActionSlot_1gv8j_207"><span class="_ActionSizer_1gv8j_208" aria-hidden="true"><button type="button" class="_PrimaryAction_1gv8j_225" tabindex="-1">安装</button></span><button type="button" class="_PrimaryAction_1gv8j_225" id="install">安装</button></span></div></article></section></div>`;

test('plugin suggestion guest fixture follows the installed native sandbox creation and presentation boundary', () => {
  const bundle = loadNativeBundle();
  const hosts = bundle.findModules(['group/mcp-app pointer-events-auto relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden']);
  assert.equal(hosts.length, 1, 'The native MCP application frame must retain its bounded presentation owner');
  const host = hosts[0];
  const hostNodes = nodes(host.ast);
  assert.ok(hostNodes.some(node => node.type === 'AssignmentExpression' && key(node.left.property) === 'mcpAppFrame' &&
    key(node.left.object?.property) === 'dataset' && node.right.value === 'true'));
  assert.ok(hostNodes.some(node => node.type === 'AssignmentExpression' && key(node.left.property) === 'title'), 'Native widget metadata must supply the sandbox title');
  const factories = bundle.findModules(['document.createElement', 'allow-scripts allow-same-origin', 'referrerpolicy']);
  assert.equal(factories.length, 1, 'The sandbox must remain a separately created iframe or webview document');
  assert.ok(Object.values(bundle.imports(host)).some(imported => imported.id === factories[0].id), 'The actual widget host must import that sandbox factory');
  for (const method of ['remove','destroy']) assert.ok(hostNodes.some(node => node.type === 'CallExpression' &&
    key(node.callee.property) === method), `Native teardown must retain ${method}`);
  for (const token of ['._Root_1gv8j_8', '._Card_1gv8j_101', '._IconFrame_1gv8j_142', '._PrimaryAction_1gv8j_225', '._SecondaryAction_1gv8j_226', '--request-primary', '--request-surface']) {
    assert.ok(nativeCss.includes(token), `The captured native guest interface must include ${token}`);
  }
  assert.ok(!nativeCss.includes('https://'), 'The CSS snapshot must contain no external asset URL');
});

test('plugin guest styling preserves native controls and geometry through reloads, remounts, and owned cleanup', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1040, height: 760 } });
    await page.route('https://plugin-theme-fixture.test/', route => route.fulfill({ contentType: 'text/html', body: '<html><head></head><body></body></html>' }));
    await page.goto('https://plugin-theme-fixture.test/');
    await page.addStyleTag({ content: themeCss });
    await page.evaluate(async ({ nativeCss, markup, guestOrigin, guestTitle, factory }) => {
      document.body.innerHTML = '<div id="root"><div id="native-host" data-mcp-app-frame="true"></div><div id="loose-host"></div><iframe id="guest-document"></iframe></div>';
      const root = document.documentElement;
      root.classList.add('forge-ink-mountain');
      root.dataset.forgeNativeTheme = 'dark';
      root.dataset.forgePresentation = 'theme';
      const guest = document.getElementById('guest-document');
      const outer = guest.contentDocument;
      outer.open(); outer.write('<html class="transparentSkybridgeBackground desktopSkybridge"><head></head><body><iframe id="root"></iframe></body></html>'); outer.close();
      const writeInner = frame => {
        const doc = frame.contentDocument;
        doc.open(); doc.write('<html class="transparentSkybridgeBackground desktopSkybridge dark"><head><style>'+nativeCss+'</style></head><body><div id="root">'+markup+'</div></body></html>'); doc.close();
        doc.getElementById('install').onclick = () => { window.fixtureInstalls = (window.fixtureInstalls || 0) + 1; };
      };
      writeInner(outer.getElementById('root'));
      window.fixtureInnerDocument = () => guest.contentDocument.getElementById('root').contentDocument;
      window.fixtureReloadInner = () => {
        const frame = outer.getElementById('root'); writeInner(frame); frame.dispatchEvent(new Event('load'));
      };
      window.fixtureReplaceInner = () => {
        const previous = outer.getElementById('root'), frame = outer.createElement('iframe'); frame.id = 'root'; previous.replaceWith(frame); writeInner(frame); frame.dispatchEvent(new Event('load'));
      };
      window.fixtureReloadGuest = async () => {
        await new Promise(resolve => { guest.onload = resolve; guest.srcdoc = '<html class="transparentSkybridgeBackground desktopSkybridge"><head></head><body><iframe id="root"></iframe></body></html>'; });
        writeInner(guest.contentDocument.getElementById('root'));
        document.getElementById('target').dispatchEvent(new Event('dom-ready'));
      };
      window.fixtureReads = () => {
        const doc = window.fixtureInnerDocument();
        return Object.fromEntries([...doc.body.querySelectorAll('[id], ._Heading_1gv8j_90, ._Root_1gv8j_8')].map((node, index) => {
          const css = doc.defaultView.getComputedStyle(node), r = node.getBoundingClientRect();
          return [node.id || `native-${index}`, { rect: [r.x,r.y,r.width,r.height], radius: css.borderRadius, padding: css.padding, margin: css.margin,
            font: css.font, type: node.type, disabled: node.disabled, role: node.getAttribute('role'), live: node.getAttribute('aria-live'), tabIndex: node.tabIndex,
            fill: css.backgroundColor, image: css.backgroundImage, color: css.color, opacity: css.opacity,
            after: doc.defaultView.getComputedStyle(node, '::after').borderRadius }];
        }));
      };
      window.fixtureCalls = [];
      window.fixtureCleanupGate = null;
      const make = (id, title, src, parent) => {
        const webview = document.createElement('webview'); webview.id = id; webview.setAttribute('title', title); webview.setAttribute('src', src);
        webview.executeJavaScript = async code => {
          window.fixtureCalls.push({ id, cleanup: code.endsWith(',null)') });
          if (window.fixtureCleanupGate && code.endsWith(',null)')) await window.fixtureCleanupGate;
          return guest.contentWindow.eval(code);
        };
        parent.append(webview); return webview;
      };
      window.fixtureMakeGuest = id => make(id, guestTitle, guestOrigin+'/fixture', document.getElementById('native-host'));
      make('wrong-title', 'Unrelated app', guestOrigin+'/fixture', document.getElementById('native-host'));
      make('wrong-origin', guestTitle, 'https://example.test/fixture', document.getElementById('native-host'));
      make('loose', guestTitle, guestOrigin+'/fixture', document.getElementById('loose-host'));
      window.fixtureFactory = eval('('+factory+')');
    }, { nativeCss, markup, guestOrigin, guestTitle, factory: createPluginSuggestionTheme.toString() });
    const baseline = await page.evaluate(() => window.fixtureReads());
    await page.evaluate(async () => { window.fixtureMakeGuest('target'); window.fixtureManager = window.fixtureFactory(document); await window.fixtureManager.settled(); });
    const styled = await page.evaluate(() => window.fixtureReads());
    for (const [id, before] of Object.entries(baseline)) {
      for (const property of ['rect','radius','padding','margin','font','type','disabled','role','live','tabIndex','opacity','after']) {
        assert.deepEqual(styled[id][property], before[property], `${id} retains native ${property}`);
      }
    }
    assert.notEqual(styled.card.fill, baseline.card.fill, 'The actual card receives the theme material');
    assert.match(styled.card.image, /linear-gradient/);
    assert.equal(styled.tile.fill, 'rgb(241, 245, 248)', 'Logos keep a pale contrast tile');
    assert.notEqual(styled.install.fill, styled.later.fill, 'Primary and secondary actions keep distinct treatments');
    assert.deepEqual(await page.evaluate(() => [...new Set(window.fixtureCalls.map(call => call.id))]), ['target']);
    await page.evaluate(() => { const button = window.fixtureInnerDocument().getElementById('install'); button.focus(); button.click(); });
    assert.equal(await page.evaluate(() => window.fixtureInstalls), 1);
    for (const remount of ['fixtureReloadInner','fixtureReplaceInner']) {
      await page.evaluate(name => window[name](), remount);
      await page.waitForFunction(id => window.fixtureInnerDocument().getElementById(id), styleId);
      assert.equal((await page.evaluate(() => window.fixtureReads())).card.fill, styled.card.fill);
    }
    await page.evaluate(async () => { await window.fixtureReloadGuest(); await window.fixtureManager.settled(); });
    assert.equal((await page.evaluate(() => window.fixtureReads())).card.fill, styled.card.fill, 'A guest navigation reapplies after dom-ready');
    await page.evaluate(async () => {
      document.documentElement.dataset.forgeNativeTheme = 'light'; window.fixtureManager.refresh(); await window.fixtureManager.settled();
    });
    const light = await page.evaluate(() => window.fixtureReads());
    assert.notEqual(light.card.fill, styled.card.fill, 'A native theme change updates the guest');
    assert.deepEqual(light.card.rect, styled.card.rect);
    await page.emulateMedia({ forcedColors: 'active' });
    const forced = await page.evaluate(() => window.fixtureReads());
    assert.equal(forced.card.image, 'none', 'Forced colors retains an opaque system surface');
    assert.equal(forced.install.type, 'button');
    await page.emulateMedia({ forcedColors: 'none' });
    await page.evaluate(async () => {
      document.documentElement.dataset.forgePresentation = 'native-full-view'; window.fixtureManager.refresh(); await window.fixtureManager.settled();
    });
    assert.deepEqual(await page.evaluate(() => window.fixtureReads()), baseline, 'Full native presentation removes the owned guest material');
    await page.evaluate(async () => {
      document.documentElement.dataset.forgePresentation = 'theme'; window.fixtureManager.refresh(); await window.fixtureManager.settled();
    });
    await page.evaluate(async () => {
      document.getElementById('target').remove(); window.fixtureManager.refresh(); await window.fixtureManager.settled();
      window.fixtureMakeGuest('remounted'); window.fixtureManager.refresh(); await window.fixtureManager.settled();
    });
    assert.equal((await page.evaluate(() => window.fixtureReads())).card.fill, light.card.fill);
    await page.evaluate(async () => {
      window.fixtureCleanupGate = new Promise(resolve => { window.fixtureReleaseCleanup = resolve; });
      window.fixtureOldDisposal = window.fixtureManager.dispose();
      window.fixtureNewManager = window.fixtureFactory(document); await window.fixtureNewManager.settled();
      window.fixtureCleanupGate = null; window.fixtureReleaseCleanup(); await window.fixtureOldDisposal;
    });
    assert.equal((await page.evaluate(() => window.fixtureReads())).card.fill, light.card.fill, 'Queued cleanup from an older runtime preserves the current owner');
    await page.evaluate(async () => { await window.fixtureNewManager.dispose(); });
    assert.equal(await page.evaluate(id => window.fixtureInnerDocument().getElementById(id), styleId), null);
    assert.deepEqual(await page.evaluate(() => window.fixtureReads()), baseline, 'Restoring removes the guest style and returns native material');

    if (process.env.WUKONG_PLUGIN_PREVIEW_DIRECTORY) {
      const wallpaper = fs.readFileSync(new URL('../themes/backgrounds/scenery-01.jpg', import.meta.url)).toString('base64');
      await page.evaluate(wallpaper => {
        const guest = document.getElementById('guest-document'); guest.style.cssText = 'width:740px;height:248px;border:0';
        const frame = guest.contentDocument.getElementById('root'); frame.style.cssText = 'width:720px;height:228px;border:0';
        frame.style.background = 'linear-gradient(#0c183050,#0c183050),url(data:image/jpeg;base64,'+wallpaper+') center/cover';
        const doc = window.fixtureInnerDocument(), context = doc.createElement('div'), root = doc.getElementById('root');
        context.style.cssText = 'box-sizing:border-box;padding:24px;width:100vw;height:228px';
        root.style.cssText = 'position:relative;width:100%;height:auto';
        root.before(context); context.append(root);
        window.fixturePreviewManager = window.fixtureFactory(document);
      }, wallpaper);
      fs.mkdirSync(process.env.WUKONG_PLUGIN_PREVIEW_DIRECTORY, { recursive: true });
      for (const mode of ['dark','light']) {
        await page.evaluate(async ({ mode, wallpaper }) => {
          document.documentElement.dataset.forgeNativeTheme = mode;
          window.fixtureInnerDocument().querySelector('section').dataset.theme = mode;
          const tint = mode === 'dark' ? 'rgba(12,24,48,.32)' : 'rgba(247,249,251,.68)';
          document.getElementById('guest-document').contentDocument.getElementById('root').style.backgroundImage = 'linear-gradient('+tint+','+tint+'),url(data:image/jpeg;base64,'+wallpaper+')';
          window.fixturePreviewManager.refresh(); await window.fixturePreviewManager.settled();
        }, { mode, wallpaper });
        await page.locator('#guest-document').contentFrame().locator('iframe#root').screenshot({
          path: path.join(process.env.WUKONG_PLUGIN_PREVIEW_DIRECTORY, `${mode}-plugin-suggestion-fixture-20261122.png`)
        });
      }
      await page.evaluate(async () => { await window.fixturePreviewManager.dispose(); });
    }
  } finally { await browser.close(); }
});
