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
      <div class="composer-wrap"><div data-codex-composer-root>
        <div id="dot-composer-fade" aria-hidden="true" class="pointer-events-none bg-gradient-to-t"></div>
        <div class="card">Input</div></div></div></div></div>
      <div class="thread-scroll-container"><div id="fade" aria-hidden="true" class="pointer-events-none bg-gradient-to-t from-surface"></div></div>
      <div id="orbit-fade" aria-hidden="true" class="pointer-events-none _background_fixture_1" style="position-anchor:--orbit-messaging-header-fixture"></div>
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
      for(const id of ['fade','orbit-fade','dot-composer-fade'])assert.equal(await page.locator('#'+id).evaluate(e=>getComputedStyle(e).backgroundImage),'none');
    }
  } finally {await browser.close();}
});

test('native dots floating header paint follows its inert anchor contract across class and portal changes', {
  skip: !fs.existsSync(archive) && 'Requires the audited installed ASAR'
}, async () => {
  const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
  const css = asar.listPackage(archive).filter(x => /webview[\\/]assets[\\/]app-(?:initial|shared)-.*\.css$/.test(x))
    .map(x => asar.extractFile(archive, x.slice(1)).toString('utf8')).join('\n');
  // Discover the two actual native paint hosts; keep the fixture independent of
  // the theme selector so a native rename/removal fails the contract audit.
  const nativeGradient = css.match(/\.(_background_[\w]+),\.(_floatingHeader_[\w]+)\{background-image:[^}]+\}/);
  assert.ok(nativeGradient, 'Native dots floating header paint must be re-audited');
  const [, legacyClass, floatingClass] = nativeGradient;
  const renamedClass = 'future-header-material';
  const renamedPaint = nativeGradient[0].replaceAll(legacyClass, renamedClass).replaceAll(floatingClass, renamedClass);
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:760}});
    await page.setContent(`<html data-theme="dark"><style>${css}</style><style>${renamedPaint}
      :root{--spacing:4px;--color-surface:rgb(24,24,24)}
      :root[data-theme="light"]{--color-surface:rgb(250,250,250)}
      body{margin:0}#root{position:relative;margin:24px;height:540px}
      #viewport{height:360px;overflow:auto}.messaging-root{height:900px;padding-top:36px}
      #anchor{anchor-name:--orbit-messaging-header-a;width:80%;height:60px}
      .test-fade{position:absolute;top:anchor(bottom);left:anchor(left);width:anchor-size(width);min-height:16px}
      .${renamedClass}{height:96px}#interaction{height:48px}
      #call{background:rgb(44,55,66);border:2px solid rgb(88,99,110);padding:8px;border-radius:50%}
      #placeholder,#ordinary,#outside-root{width:160px;height:24px}
    </style><div id="root"><main id="viewport"><div class="messaging-root messaging-embedded">
      <div id="anchor"></div><div id="ordinary" class="${floatingClass}"></div>
    </div></main><div id="portal" data-main-content-layout>
      <div id="legacy-fade" aria-hidden="true" class="pointer-events-none test-fade ${legacyClass}" style="position-anchor:--orbit-messaging-header-a"></div>
      <div id="floating-fade" aria-hidden="true" class="pointer-events-none test-fade ${floatingClass}" style="position-anchor: --orbit-messaging-header-a;"></div>
      <div id="renamed-fade" aria-hidden="true" class="pointer-events-none test-fade ${renamedClass}" style="opacity: 0.8; position-anchor:   --orbit-messaging-header-a; z-index: 2;"></div>
      <div id="placeholder" aria-hidden="true" class="pointer-events-none ${floatingClass}" style="anchor-name:--orbit-messaging-header-placeholder"></div>
      <div id="interaction" aria-hidden="false" class="pointer-events-none test-fade ${floatingClass}" style="position-anchor:--orbit-messaging-header-a"><button id="call">Call</button></div>
      <div id="hidden-profile" aria-hidden="true" class="pointer-events-none test-fade ${floatingClass}" style="position-anchor:--orbit-messaging-header-a"><button>Profile</button></div>
      <div id="other-anchor" aria-hidden="true" class="pointer-events-none test-fade ${floatingClass}" style="position-anchor:--unrelated-header-a"></div>
      <div id="no-inert-marker" aria-hidden="true" class="test-fade ${floatingClass}" style="position-anchor:--orbit-messaging-header-a"></div>
    </div></div><div id="outside-root" aria-hidden="true" class="pointer-events-none ${floatingClass}" style="position-anchor:--orbit-messaging-header-a"></div></html>`);
    await page.addStyleTag({content:theme});
    const cleared = ['legacy-fade','floating-fade','renamed-fade'];
    const preserved = ['placeholder','interaction','hidden-profile','other-anchor','no-inert-marker','ordinary','outside-root','call'];
    const capture = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[id]')].map(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return [element.id, {
        geometry:[rect.x,rect.y,rect.width,rect.height,style.position,style.padding,style.borderWidth,style.borderRadius,style.font,style.opacity,style.pointerEvents,style.positionAnchor,style.anchorName],
        paint:[style.backgroundImage,style.backgroundColor,style.color,style.boxShadow,style.backdropFilter]
      }];
    })));
    assert.equal(await page.locator('#portal').evaluate(element => !!element.closest('.messaging-root')),false,
      'native floating paint is portalled outside the messaging subtree');
    for (const mode of ['dark','light']) for (const width of [720,1280]) for (const scroll of [0,160]) {
      await page.setViewportSize({width,height:760});
      await page.evaluate(({mode,scroll}) => {
        const root = document.documentElement;
        root.classList.remove('forge-ink-mountain');
        Object.assign(root.dataset,{theme:mode,forgeNativeTheme:mode,forgeBackgroundReady:'true'});
        document.getElementById('viewport').scrollTop=scroll;
      },{mode,scroll});
      // CSS anchor positioning catches up with a scroll at the next frame.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const native = await capture();
      for (const id of [...cleared,...preserved.filter(id=>id!=='call')]) {
        assert.match(native[id].paint[0],/^linear-gradient\(/, `${mode}/${width}/${scroll}: ${id} must start with native gradient paint`);
      }
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const themed = await capture();
      for (const id of Object.keys(native)) assert.deepEqual(themed[id].geometry,native[id].geometry,`${mode}/${width}/${scroll}: ${id} geometry must stay native`);
      for (const id of cleared) {
        assert.equal(themed[id].paint[0],'none',`${mode}/${width}/${scroll}: ${id} clears native dots fade`);
        assert.deepEqual(themed[id].paint.slice(1),native[id].paint.slice(1),`${id} changes only background-image`);
      }
      for (const id of preserved) assert.deepEqual(themed[id].paint,native[id].paint,`${mode}/${width}/${scroll}: ${id} paint is not an inert dots fade`);
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
    const contract=path.join(dir,'native-ui-contract.mjs');
    fs.writeFileSync(contract,'export const selector="first";','utf8');
    fs.writeFileSync(file,'import {selector} from "./native-ui-contract.mjs"; export const RUNTIME_REVISION="c"; export const makeApplyExpression=()=>selector;','utf8');
    assert.equal((await read()).makeApplyExpression(),'first');
    const beforeMapping = (await read()).SOURCE_FINGERPRINT;
    fs.writeFileSync(contract,'export const selector="updated";','utf8');
    assert.equal((await read()).makeApplyExpression(),'updated','a native mapping update must invalidate its imported dependency');
    assert.notEqual((await read()).SOURCE_FINGERPRINT,beforeMapping,'renderer freshness must change even when the declared revision stays the same');
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
    </style><div id="root"><div id="layout" data-app-shell-page-surface><div id="paint" class="${surface}"></div><aside class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><nav class="rail group/sidebar-rail"></nav><div id="sidebar" class="sidebar-navigation"><div class="sidebar-navigation">Navigation</div></div></aside><main data-app-shell-main-surface="default"><div id="header" class="${sticky}" data-sticky style="--app-shell-titlebar-left-inset:0px"><div class="${stickyContent}"><input id="plugins-store-page-search"></div></div><div class="rows"><div data-thread-find-target="conversation"><div data-message-id="fixture"><div data-markdown-text-style="assistant-message"><p id="stream">Streaming</p></div></div></div></div></main></div><div role="tooltip" class="bg-tooltip" style="background:#111;color:white">Tooltip</div></div></html>`);
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

test('mapping-only hot updates move the wallpaper owner and carry a new renderer fingerprint', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wukong-adapter-update-'));
  const file=path.join(dir,'injection-plan-v13.mjs');
  const contract=path.join(dir,'native-ui-contract.mjs');
  fs.copyFileSync('runtime/injection-plan-v13.mjs',file);
  const original=fs.readFileSync('runtime/native-ui-contract.mjs','utf8');
  fs.writeFileSync(contract,original,'utf8');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<style>section{position:relative;height:600px}.paint{position:absolute;inset:0}main{height:400px}</style><div id="root"><section data-app-shell-page-surface><div id="old-paint" class="paint _PageSurface_fixture_1"></div><div id="new-paint" class="paint" data-proof-paint></div><main data-app-shell-main-surface><h1>Home</h1></main></section></div>');
    const read=createRuntimeProvider(file),first=await read();
    await page.evaluate(first.makeApplyExpression({styleSheet:theme,variables}));
    assert.equal(await page.locator('#wukong-codex-theme-background').evaluate(e=>e.parentElement.id),'old-paint');
    const updated=original.replace("pagePaint: '[class*=\"_PageSurface_\"]'","pagePaint: '[data-proof-paint]'");
    assert.notEqual(updated,original);
    fs.writeFileSync(contract,updated,'utf8');
    const second=await read();
    assert.equal(second.RUNTIME_REVISION,first.RUNTIME_REVISION);
    assert.notEqual(second.SOURCE_FINGERPRINT,first.SOURCE_FINGERPRINT);
    await page.evaluate(second.makeApplyExpression({styleSheet:theme,variables}));
    assert.equal(await page.locator('#wukong-codex-theme-background').evaluate(e=>e.parentElement.id),'new-paint');
    assert.equal(await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.sourceFingerprint),second.SOURCE_FINGERPRINT);
  } finally {await browser.close();fs.rmSync(dir,{recursive:true});}
});
