import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { makeApplyExpression, ACTIVE_PROBE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import { createRuntimeProvider } from '../runtime/host.mjs';

const require = createRequire(import.meta.url);
const lock = JSON.parse(fs.readFileSync('docs/native-asar-provenance.json', 'utf8'));
const archive = path.join(process.env.ProgramFiles || '', 'WindowsApps', lock.packageDirectoryName, lock.asarRelativePath);
const theme = fs.readFileSync('runtime/wukong-codex-theme-background-v13.css', 'utf8');
const asset = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#708090"/></svg>');
const variables = `:root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("${asset}");}`;

test('thread footer and embedded messaging clear layout paint without clearing controls', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent(`<html><style>
      .plate,.thread-pane,.messaging-root,.card{background:rgb(255,255,255)}
      .bg-gradient-to-t,._background_fixture_1{background-image:linear-gradient(white,transparent)}
      .composer-wrap{border-bottom:12px solid white}
      [data-thread-scroll-footer]{position:relative;padding:16px;border-radius:14px}
    </style><div id="root"><div data-thread-scroll-footer="true">
      <div id="plate" aria-hidden="true" class="pointer-events-none plate"></div>
      <div id="card" class="card">Control</div></div>
      <div class="messaging-root messaging-embedded"><div class="thread-pane">
      <div class="composer-wrap"><div class="card">Input</div></div></div></div>
      <div class="thread-scroll-container"><div id="fade" aria-hidden="true" class="pointer-events-none bg-gradient-to-t from-surface"></div></div>
      <div id="orbit-fade" class="pointer-events-none _background_fixture_1" style="position-anchor:--orbit-messaging-header-fixture"></div>
      <div id="standalone" class="messaging-root">Standalone</div></div></html>`);
    const measure = () => page.evaluate(() => [...document.querySelectorAll('#root *')].map(e=>{
      const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [r.x,r.y,r.width,r.height,s.borderRadius,s.padding,s.borderBottomWidth];
    }));
    const native = await measure();
    await page.addStyleTag({content:theme});
    for (const mode of ['dark','light']) {
      await page.evaluate(mode=>{document.documentElement.classList.add('forge-ink-mountain');Object.assign(document.documentElement.dataset,{forgeNativeTheme:mode,forgeBackgroundReady:'true'});},mode);
      assert.deepEqual(await measure(),native);
      assert.deepEqual(await page.evaluate(()=>['#plate','.messaging-embedded','.thread-pane'].map(s=>getComputedStyle(document.querySelector(s)).backgroundColor)),Array(3).fill('rgba(0, 0, 0, 0)'));
      assert.equal(await page.locator('#card').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
      assert.equal(await page.locator('#standalone').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
      assert.equal(await page.locator('.composer-wrap').evaluate(e=>getComputedStyle(e).borderBottomColor),'rgba(0, 0, 0, 0)');
      for(const id of ['fade','orbit-fade'])assert.equal(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).backgroundImage),'none');
    }
  } finally {await browser.close();}
});

test('visible empty dot switches landing to scenery while hidden messaging does not', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<div id="root"><main><h1>What should we build?</h1><div class="messaging-root messaging-embedded" style="display:none"><div class="thread-pane" style="height:200px">Dot</div></div></main></div>');
    await page.evaluate(makeApplyExpression({styleSheet:theme,variables}));
    const state=()=>page.evaluate(()=>({surface:document.documentElement.dataset.forgeSurface,mode:document.documentElement.dataset.forgeMode}));
    assert.deepEqual(await state(),{surface:'landing',mode:'battle'});
    await page.evaluate(()=>{document.querySelector('.messaging-root').style.display='block';window.__wukongCodexThemeRuntimeV13.refresh();});
    assert.deepEqual(await state(),{surface:'thread',mode:'scenery'});
    await page.evaluate(()=>{document.querySelector('.messaging-root').style.display='none';window.__wukongCodexThemeRuntimeV13.refresh();});
    assert.deepEqual(await state(),{surface:'landing',mode:'battle'});
  } finally {await browser.close();}
});

test('updated runtime provider replaces cached code and rejects incomplete updates', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wukong-module-'));
  const file = path.join(dir, 'runtime.mjs');
  try {
    fs.writeFileSync(file, 'export const RUNTIME_REVISION="a"; export const makeApplyExpression=()=>"a";', 'utf8');
    const read = createRuntimeProvider(file), first = await read();
    assert.equal(await read(), first);
    fs.writeFileSync(file, 'export const RUNTIME_REVISION="b"; export const makeApplyExpression=()=>"b";', 'utf8');
    assert.equal((await read()).makeApplyExpression(), 'b');
    fs.writeFileSync(file, 'export const broken=true;', 'utf8');
    await assert.rejects(read(), /missing its revision/);
  } finally { fs.rmSync(dir, { recursive:true }); }
});

test('new native paint hosts keep geometry, sticky corners, tooltip ink and decoded layers', {
  skip: !fs.existsSync(archive) && 'Requires the audited installed ASAR'
}, async () => {
  const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
  const css = asar.listPackage(archive).filter(x => /webview[\\/]assets[\\/]app-initial-.*\.css$/.test(x))
    .map(x => asar.extractFile(archive, x.slice(1)).toString('utf8')).join('\n');
  const component = name => {
    const found = css.match(new RegExp(`\\.(${name}_[a-z0-9]+_\\d+)`));
    assert.ok(found, `Native component ${name} must be re-audited`);
    return found[1];
  };
  const surface = component('_PageSurface'), shell = component('_shell'), content = component('_content');
  // Find the actual sticky header module rather than the first generic _shell.
  const sticky = css.match(/\.(_shell_\w+)\[data-sticky\]:before/)[1];
  const stickyContent = sticky.replace('_shell_', '_content_');
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    await page.setContent(`<html data-theme="dark" data-codex-window-type="electron"><style>${css}</style><style>
      body{margin:0}:root{--app-shell-titlebar-height:44px;--app-shell-navigation-rail-width:52px;--app-shell-main-surface-top-start-radius:12px;--app-shell-main-surface-top-end-radius:12px}
      #layout{position:relative;height:100vh}aside{position:absolute;top:44px;bottom:4px;display:flex;width:308px}nav.rail{width:52px}.sidebar-navigation{flex:1;border-radius:12px 0 0 12px}
      main{position:absolute;top:44px;bottom:4px;left:308px;right:4px;overflow:auto;border-radius:0 12px 4px 0}.rows{height:1400px}
    </style><div id="root"><div id="layout" data-app-shell-page-surface><div id="paint" class="${surface}"></div><aside class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><nav class="rail group/sidebar-rail"></nav><div id="sidebar" class="sidebar-navigation"><div class="sidebar-navigation">Navigation</div></div></aside><main data-app-shell-main-surface="default"><div id="header" class="${sticky}" data-sticky><div class="${stickyContent}"><input id="plugins-store-page-search"></div></div><div class="rows"><div data-thread-find-target="conversation"><div data-message-id="fixture"><div data-markdown-text-style="assistant-message"><p id="stream">Streaming</p></div></div></div></div></main></div><div role="tooltip" class="bg-tooltip" style="background:#111;color:white">Tooltip</div></div></html>`);
    const geometry = () => page.evaluate(() => ['paint','sidebar','header'].map(id => {
      const e=document.getElementById(id), r=e.getBoundingClientRect(),s=getComputedStyle(e),p=getComputedStyle(e,'::before');
      return [id,r.x,r.y,r.width,r.height,s.borderRadius,s.position,p.inset,p.borderRadius,p.position];
    }));
    for (const mode of ['light','dark']) for (const width of [720,1280]) {
      await page.setViewportSize({width,height:800});
      await page.evaluate(mode=>{document.documentElement.dataset.theme=mode;document.documentElement.classList.remove('forge-ink-mountain');},mode);
      const before=await geometry();
      await page.evaluate(makeApplyExpression({styleSheet:theme,variables}));
      await page.waitForFunction(ACTIVE_PROBE_EXPRESSION);
      assert.deepEqual(await geometry(),before);
      const paint=await page.evaluate(()=>({
        host:document.getElementById('wukong-codex-theme-background').parentElement.id,
        tooltip:getComputedStyle(document.querySelector('[role=tooltip]')).color,
        tooltipBg:getComputedStyle(document.querySelector('[role=tooltip]')).backgroundColor,
        header:getComputedStyle(document.getElementById('header'),'::before').backdropFilter,
        inner:getComputedStyle(document.querySelector('#sidebar > div')).backgroundColor,
        main:getComputedStyle(document.querySelector('[data-app-shell-main-surface]')).backgroundColor
      }));
      assert.equal(paint.host,'paint');assert.equal(paint.tooltip,'rgb(255, 255, 255)');assert.equal(paint.tooltipBg,'rgb(17, 17, 17)');
      assert.equal(paint.header,'blur(12px)');assert.equal(paint.inner,'rgba(0, 0, 0, 0)');
      assert.equal(paint.main,mode==='light'?'rgba(247, 249, 251, 0.9)':'rgba(20, 24, 28, 0.86)');
      await page.evaluate(()=>document.querySelector('main').scrollTop=90);
      await page.evaluate(()=>document.documentElement.classList.remove('forge-ink-mountain'));
      const scrolled=await geometry();
      await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
      assert.deepEqual(await geometry(),scrolled);
      await page.evaluate(()=>document.querySelector('main').scrollTop=0);
    }
    await page.evaluate(()=>{
      window.savedOverlay=document.getElementById('wukong-codex-theme-background');
      window.savedImage=savedOverlay.querySelector('[data-forge-active="true"] img');
      window.calls=0;HTMLImageElement.prototype.decode=function(){window.calls++;return Promise.resolve()};
    });
    for(let i=0;i<6;i++) {
      await page.evaluate(i=>{
        const old=document.getElementById('paint'),replacement=old.cloneNode(false);old.replaceWith(replacement);
        document.getElementById('sidebar').classList.toggle('group/settings',i%2===0);
      },i);
      await page.waitForFunction(()=>savedOverlay.isConnected);
      assert.deepEqual(await page.evaluate(()=>({same:document.querySelector('[data-forge-active="true"] img')===savedImage,decode:calls,ready:document.documentElement.dataset.forgeBackgroundReady})),{same:true,decode:0,ready:'true'});
    }
    await page.waitForTimeout(700);
    await page.evaluate(()=>{const r=window.__wukongCodexThemeRuntimeV13;r.lastSurface='thread';r.lastRouteHref=location.href;window.beforeRefresh=r.refreshCount;});
    for(let i=0;i<12;i++)await page.evaluate(()=>{const s=document.createElement('span');s.textContent='追加';document.getElementById('stream').append(s);});
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.refreshCount),await page.evaluate(()=>beforeRefresh),'inline streaming must not rescan the page');
  } finally {await browser.close();}
});
