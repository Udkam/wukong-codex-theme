import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import { PNG } from 'pngjs';
import { makeApplyExpression, makeStyleUpdateExpression } from '../runtime/injection-plan-v13.mjs';

fs.mkdirSync(new URL('../artifacts/test-runs/native-boundary-20260920/',import.meta.url),{recursive:true});

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const loadNative = () => {
  try {
    const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
    const root = path.join(process.env.ProgramFiles, 'WindowsApps');
    const archive = fs.readdirSync(root).filter(x => /^OpenAI\.Codex_.*_x64__/.test(x))
      .map(x => path.join(root, x, 'app/resources/app.asar')).filter(fs.existsSync)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const entries = asar.listPackage(archive);
    const css = entries.filter(x => /webview[\\/]assets[\\/](app-shared-|app-initial-|app-primary-).*\.css$/.test(x))
      .map(x => asar.extractFile(archive, x.replace(/^[/\\]/, '')).toString('utf8')).join('\n');
    const rootClass = css.match(/\.(_ComposerLayoutRoot_[\w]+)\{/)[1];
    const bodyClass = css.match(/\.(_ComposerLayoutBody_[\w]+)\{/)[1];
    const topMenu = css.match(/\.(_ComposerTopMenuPanel_[\w]+)\[/)[1];
    const effortClass = css.match(/\.(_ModelPickerTriggerEffortText_[\w]+)\[data-max-effort=true\]/)[1];
    return { archive, css, rootClass, bodyClass, topMenu, effortClass };
  } catch { return null; }
};
const native = loadNative();

test('light landing removes the veil while thread reading retains it', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<html class="forge-ink-mountain" data-forge-native-theme="light" data-forge-surface="landing"><div data-forge-background-veil></div></html>');
    await page.addStyleTag({content:theme+' [data-forge-background-veil]{transition:none!important}'});
    const opacity=()=>page.locator('[data-forge-background-veil]').evaluate(e=>getComputedStyle(e).opacity);
    assert.equal(await opacity(),'0');
    await page.evaluate(()=>document.documentElement.dataset.forgeSurface='thread');
    assert.equal(await opacity(),'0.2375');
    await page.evaluate(()=>document.documentElement.dataset.forgeNativeTheme='dark');
    assert.equal(await opacity(),'0.25');
    await page.evaluate(()=>document.documentElement.dataset.forgeSurface='landing');
    assert.equal(await opacity(),'0');
  } finally {await browser.close();}
});

test('full titlebar and sidebar share material while preserving native controls', {skip: !native}, async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    const topClass = native.css.match(/\.(_ApplicationMenuTopBar_[\w]+)/)[1];
    await page.setContent(`<style>${native.css}</style><style>:root{--app-shell-animated-left-panel-width:275px;--height-toolbar-sm:36px}</style><div id="layout" class="_Layout_fixture" style="display:flex;flex-direction:column"><div id="bar" class="${topClass}"><button id="control" class="no-drag">Menu</button></div></div>`);
    const read = () => page.evaluate(() => ['bar','control'].map(id => {
      const e=document.getElementById(id), s=getComputedStyle(e), r=e.getBoundingClientRect();
      return {rect:[r.x,r.y,r.width,r.height],color:s.color,radius:s.borderRadius,position:s.position,drag:s.webkitAppRegion};
    }));
    const before=await read();
    await page.addStyleTag({content:theme});
    await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
    assert.deepEqual(await read(),before);
    const paint=()=>page.evaluate(()=>{const s=getComputedStyle(document.getElementById('layout'),'::before');return {width:parseFloat(s.width),events:s.pointerEvents,mask:s.maskImage,height:s.height,maskSize:s.maskSize};});
    assert.equal((await paint()).events,'none');
    assert.equal((await paint()).width,1280);
    assert.match((await paint()).maskSize,/^100% 36px, 275px 100%,/);
    assert.match((await paint()).mask,/radial-gradient/);
    assert.match((await paint()).mask,/gradient/);
    assert.equal((await paint()).height,'720px');
    await page.evaluate(()=>document.documentElement.style.setProperty('--app-shell-animated-left-panel-width','0px'));
    assert.match((await paint()).maskSize,/^100% 36px, 0px 100%, 0px /);
    await page.evaluate(()=>document.documentElement.style.setProperty('--app-shell-animated-left-panel-width','500px'));
    assert.match((await paint()).maskSize,/^100% 36px, 500px 100%,/);
    assert.deepEqual(await read(),before);
  } finally {await browser.close();}
});

test('light user bubbles paint only their native surface without changing geometry or text', {skip: !native}, async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({colorScheme:'light'});
    await page.setContent('<html class="light"><div id="carrier"><div data-user-message-bubble="true" class="bg-user-message text-user-message rounded-2xl relative overflow-hidden px-4 py-2.5"><p>Native user message</p></div></div></html>');
    await page.addStyleTag({content:native.css});
    const read = () => page.locator('[data-user-message-bubble]').evaluate(e => {
      const s=getComputedStyle(e),r=e.getBoundingClientRect();
      return {rect:[r.x,r.y,r.width,r.height],radius:s.borderRadius,corner:s.cornerShape,color:getComputedStyle(e.firstElementChild).color,bg:s.backgroundColor,image:s.backgroundImage,blur:s.backdropFilter,carrier:getComputedStyle(e.parentElement).backgroundColor};
    });
    const baseline=await read();
    await page.addStyleTag({content:theme});
    await page.evaluate(()=>{document.documentElement.classList.add('forge-ink-mountain');document.documentElement.dataset.forgeNativeTheme='light'});
    const painted=await read();
    for (const key of ['rect','radius','corner','color','carrier','blur']) assert.deepEqual(painted[key],baseline[key],key);
    assert.equal(painted.image,baseline.image);
    assert.equal(painted.bg,baseline.bg);
    await page.evaluate(()=>document.documentElement.dataset.forgeNativeTheme='dark');
    const dark=await read();
    assert.equal(dark.bg,baseline.bg);
    assert.equal(dark.image,baseline.image);
  } finally {await browser.close();}
});

test('adaptive shell samples only committed images and restores its variables', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1100,height:700}});
    await page.setContent('<html data-theme="dark"><style>aside{width:275px;height:700px}main{height:700px}</style><aside class="app-shell-left-panel">Sidebar</aside><main><div data-thread-find-target="conversation">Conversation</div></main></html>');
    const url=color=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="700"><rect width="1100" height="700" fill="${color}"/></svg>`);
    await page.evaluate(makeApplyExpression({styleSheet:theme,variables:`:root.forge-ink-mountain{--forge-scene-count:2;--forge-battle-scenes:0 1;--forge-scenery-scenes:0 1;--forge-bg-0:url("${url('white')}");--forge-bg-1:url("${url('black')}");}`}));
    await page.waitForFunction(()=>window.__wukongCodexThemeRuntimeV13?.shellSampleCount===1);
    const before=await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.shellSample);
    assert.equal(before.dark,.78);assert.equal(before.light,.10);
    await page.evaluate(()=>{const r=window.__wukongCodexThemeRuntimeV13;for(let i=0;i<5;i++)r.refresh();document.body.click()});
    assert.equal(await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.shellSampleCount),1);
    await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.nextBackground());
    await page.waitForFunction(()=>window.__wukongCodexThemeRuntimeV13.shellSampleCount===2);
    const after=await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.shellSample);
    assert.equal(after.dark,.24);assert.equal(after.light,.42);
    await page.evaluate(()=>document.documentElement.dataset.theme='light');
    await page.waitForFunction(()=>document.documentElement.dataset.forgeNativeTheme==='light');
    const paint=await page.locator('aside').evaluate(e=>getComputedStyle(e).backgroundColor);
    assert.match(paint,/^rgba\(247, 249, 251, /);
    assert.ok(Math.abs(Number(paint.match(/, ([\d.]+)\)$/)[1])-.42)<1/255);
    assert.equal(await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.shellSampleCount),2);
    await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.dispose());
    assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--forge-shell-dark-alpha')),'');
    fs.writeFileSync(new URL('../artifacts/test-runs/native-boundary-20260920/adaptive-shell.json',import.meta.url),JSON.stringify({white:before,black:after,extraSamplesOnRefreshOrThemeSwitch:0},null,2));
  } finally {await browser.close();}
});

test('shell tint bounds white and black wallpaper without changing native text', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:400,height:400}});
    const report=[];
    for(const mode of ['dark','light']) {
      await page.setContent(`<html class="forge-ink-mountain" data-forge-native-theme="${mode}"><style>body{margin:0;background:${mode==='dark'?'white':'black'}}aside{height:400px;width:300px;color:${mode==='dark'?'#a0a0a0':'#5a5a5a'}}</style><aside class="app-shell-left-panel">Native text</aside></html>`);
      const before=await page.locator('aside').evaluate(e=>getComputedStyle(e).color);
      await page.addStyleTag({content:theme});
      assert.equal(await page.locator('aside').evaluate(e=>getComputedStyle(e).color),before);
      const png=PNG.sync.read(await page.screenshot()),offset=(200*png.width+150)*4;
      const rgb=[...png.data.subarray(offset,offset+3)];
      if(mode==='dark')assert.ok(Math.max(...rgb)<60);else assert.ok(Math.min(...rgb)>210);
      report.push({mode,wallpaper:mode==='dark'?'white':'black',background:rgb,text:before});
    }
    fs.writeFileSync(new URL('../artifacts/test-runs/native-boundary-20260920/sidebar-extreme-backgrounds.json',import.meta.url),JSON.stringify(report,null,2));
  } finally {await browser.close();}
});

test('settings sticky controls preserve search geometry without the opaque surface band or fade', {skip:!native}, async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent(`<html data-theme="dark"><style>${native.css}</style><div class="group/settings"><div id="band" class="bg-surface sticky z-30 after:pointer-events-none after:absolute after:top-full after:right-0 after:left-0 after:bg-linear-to-b after:from-surface after:to-transparent after:content-[''] after:h-8 top-[calc(-1*var(--padding-panel))] pt-panel pb-2"><input id="search" class="rounded-full bg-surface-elevated border border-default" placeholder="Search"><div role="tablist">Overview</div></div></div></html>`);
    const read=()=>page.locator('#search').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [r.width,r.height,s.borderRadius,s.color,s.backgroundColor]});
    const before=await read();await page.addStyleTag({content:theme});await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
    assert.deepEqual(await read(),before);
    assert.equal(await page.locator('#band').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('#band').evaluate(e=>getComputedStyle(e,'::after').backgroundImage),'none');
  } finally {await browser.close();}
});

test('sidebar refresh does not measure each native row or text range', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<style>aside{position:absolute;width:275px;height:700px}button{display:block;height:30px}main{margin-left:280px;height:700px}</style><aside class="app-shell-left-panel">'+Array.from({length:150},(_,i)=>`<button data-app-action-sidebar-thread-row>Thread ${i}</button>`).join('')+'</aside><main><div data-thread-find-target="conversation">Conversation</div></main>');
    await page.evaluate(()=>{window.measurements={element:0,range:0};const e=Element.prototype.getBoundingClientRect,r=Range.prototype.getBoundingClientRect;Element.prototype.getBoundingClientRect=function(){window.measurements.element++;return e.call(this)};Range.prototype.getBoundingClientRect=function(){window.measurements.range++;return r.call(this)}});
    await page.evaluate(makeApplyExpression({styleSheet:theme,variables:':root{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0}'}));
    const samples=await page.evaluate(()=>Array.from({length:5},()=>{window.measurements={element:0,range:0};const start=performance.now();window.__wukongCodexThemeRuntimeV13.refresh();return {...window.measurements,ms:performance.now()-start}}));
    for(const sample of samples){assert.equal(sample.range,0);assert.ok(sample.element<20);}
    fs.writeFileSync(new URL('../artifacts/test-runs/native-boundary-20260920/sidebar-cost-after.json',import.meta.url),JSON.stringify(samples,null,2));
  } finally {await browser.close();}
});

test('light thread veil brightens the image without column scrims or image filters', async () => {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1100,height:700},colorScheme:'light'});
  try {
    await page.setContent('<html data-theme="light"><head><style>body{margin:0}#root{height:700px}aside{position:absolute;width:160px;height:650px;top:36px}main{height:700px}[data-thread-find-target]{position:absolute;left:450px;top:120px;width:350px;height:520px;color:black}</style></head><body><div id="root"><aside class="app-shell-left-panel">导航</aside><main class="main-surface"><div data-thread-find-target="conversation">正文</div></main></div></body></html>');
    const geometry=()=>page.locator('[data-thread-find-target]').evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [r.x,r.y,r.width,r.height,s.borderRadius,s.color,s.backgroundColor];});
    const before=await geometry();
    const scene='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="700"><rect width="1100" height="700" fill="rgb(30,60,90)"/></svg>');
    await page.evaluate(makeApplyExpression({styleSheet:theme,variables:`:root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("${scene}");}`}));
    await page.waitForFunction(()=>document.documentElement.dataset.forgeBackgroundReady==='true');
    assert.deepEqual(await geometry(),before);
    await page.evaluate(()=>document.documentElement.dataset.forgeSurface='thread');
    await page.waitForTimeout(300);
    const png=PNG.sync.read(await page.screenshot());
    const rgb=(x,y)=>[...png.data.subarray((y*png.width+x)*4,(y*png.width+x)*4+3)];
    const open=rgb(320,350), reading=rgb(650,350), navigation=rgb(80,350);
    assert.deepEqual(reading,open);
    // The native sidebar now intentionally blurs/saturates its backdrop;
    // its material is compared with the settings sidebar in the client test.
    for (let c=0;c<3;c++) assert.ok(open[c]>[30,60,90][c],'Light veil must brighten the original image');
    const imagePaint=await page.locator('[data-forge-active="true"] [data-forge-background-image]').evaluate(e=>{
      const s=getComputedStyle(e);return {filter:s.filter,opacity:s.opacity,blend:s.mixBlendMode};
    });
    assert.deepEqual(imagePaint,{filter:'none',opacity:'1',blend:'normal'});
    await page.setViewportSize({width:1250,height:700});
    await page.locator('[data-thread-find-target]').evaluate(e=>{e.style.left='550px';});
    await page.waitForTimeout(300);
    await page.evaluate(()=>document.documentElement.dataset.forgeSurface="thread");
    await page.waitForTimeout(300);
    const resized=PNG.sync.read(await page.screenshot());
    const resizedPixel=[...resized.data.subarray((350*resized.width+650)*4,(350*resized.width+650)*4+3)];
    // Scene gradients may change sampled colour after resizing; only the
    // native geometry and absence of image filters are invariant here.
    assert.equal(await page.locator('[data-forge-active="true"] [data-forge-background-image]').evaluate(e=>getComputedStyle(e).filter),'none');
    assert.deepEqual((await geometry()).slice(2),before.slice(2));
    const dir=new URL('../artifacts/test-runs/native-boundary-20260920/',import.meta.url);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(new URL('light-uniform-veil.json',dir),JSON.stringify({open,reading,navigation,imagePaint,veilOpacity:0,nativeGeometry:before,themedGeometryAfterResize:await geometry(),visualAcceptance:false},null,2),'utf8');
  } finally {await browser.close();}
});

test('model/permission clicks do not schedule submit follow-up scans', async () => {
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  try {
    await page.setContent('<html><body><main id="root"><div class="main-surface"><div data-thread-find-composer="true"><div class="composer-surface-chrome"><button id="model" aria-haspopup="menu">模型</button><button id="permissions" aria-haspopup="menu">完全访问</button><button id="submit" type="submit" aria-label="发送">发送</button><div class="ProseMirror" contenteditable="true" role="textbox">输入</div></div></div></div></main></body></html>');
    await page.evaluate(makeApplyExpression({styleSheet:theme,variables:':root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'2\' height=\'2\'%3E%3C/svg%3E");}'}));
    await page.waitForTimeout(650);
    await page.locator('#model').click();
    await page.locator('#permissions').click();
    assert.equal(await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.routeTimers.size),0);
    await page.locator('#submit').click();
    assert.equal(await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.routeTimers.size),2);
  } finally {await browser.close();}
});

test('active paint sheet has no client text, icon, radius or layout replacements', () => {
  postcss.parse(theme).walkDecls(d => {
    const s = d.parent.selector || '';
    // Only this non-interactive generated paint layer owns new geometry.
    if (s === ':root.forge-ink-mountain [class*="_Layout_"]:has(> [class*="_ApplicationMenuTopBar_"])::before') return;
    const owned = /data-forge-title-copy|\.forge-landing|home-icon|#wukong-codex-theme-background|\[data-forge-background-(?:image|veil|layer)\]/.test(s);
    if (owned) return;
    const documentLayer = /:root\.forge-ink-mountain (?:body|#root)$/.test(s);
    if (documentLayer && ['position','z-index'].includes(d.prop)) return;
    assert.ok(!/^(?:color|-webkit-text-fill-color|fill|stroke|font.*|line-height|letter-spacing|text-shadow|border(?:-.*)?-radius|border-radius|corner-shape|clip-path|mask.*|transform|(?:min-|max-)?(?:width|height)|padding.*|margin.*|inset.*|top|right|bottom|left|position|display|flex.*|grid.*|gap|overflow.*|opacity|border(?:-.*)?-width)$/.test(d.prop), `${d.prop}: ${s}`);
    assert.ok(!/^--color-/.test(d.prop), `Client token override: ${d.prop}`);
  });
});

test('current client CSS: native geometry/semantic colours, home paint boundaries and popup first paint', {
  skip: native ? false : 'Local read-only client ASAR unavailable'
}, async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  try {
    const composer = (id, mode, utility) => `<div id="${id}" class="${native.rootClass}" data-composer-layout="${mode}" data-composer-radius-variant="default" data-composer-surface-variant="default" data-composer-utility-bar-variant="${utility}"><div class="${native.bodyClass}" data-composer-body data-composer-layout="${mode}"><div class="p-3"><span class="text-warning">完全访问</span><span data-codex-intelligence-trigger="true"><span id="${id}-ultra" class="${native.effortClass}" data-reasoning-effort="ultra" data-max-effort="true">Ultra</span></span><button class="rounded-full bg-composer-primary text-composer-primary p-2">发送</button><button class="rounded-full text-default p-2">取消</button><div contenteditable="true" role="textbox" class="text-default">测试输入</div></div></div></div>`;
    await page.setContent(`<html data-theme="dark" data-codex-os="win32" data-codex-window-type="electron"><head><style>${native.css}</style><style>#fixtures{padding:24px;width:900px;display:grid;gap:20px}.native-preview{width:320px}#scheduler{padding:10px}#scheduler input{height:32px}#scheduler::after{content:'';position:absolute;top:100%;height:32px;background:linear-gradient(#333,transparent)}</style></head><body><div id="fixtures">${composer('thread','multiline','default')}${composer('chat','single-line','home')}${composer('work','multiline','home')}<div id="scheduler" class="sticky z-30 bg-surface"><div class="rounded-full bg-surface-elevated border border-default"><input id="scheduled-page-search" class="text-default"></div></div><div id="preview" class="native-preview w-80 rounded-xl bg-surface-elevated-secondary/95 p-2 text-sm text-default shadow-xl-spread">侧边预览，正文中的 Ultra 不能染色</div><div id="goal" data-composer-rail-item="present" class="rounded-t-2xl bg-surface-elevated-secondary text-default p-2">目标已停滞</div><div id="queue" data-composer-rail-item="present" class="rounded-t-2xl bg-surface-elevated-secondary text-default p-2">排队消息</div><div id="menu" role="menu" class="rounded-xl bg-surface-elevated-secondary p-2 text-default">重命名 <span class="text-warning">警告</span></div><div id="add" class="${native.topMenu} rounded-xl bg-surface-elevated-secondary" data-composer-expanded-top-tray><div cmdk-root class="bg-surface"><span class="text-default">添加插件</span></div></div><p class="text-default">正文 Ultra，已处理、正在重新连接</p><p class="text-secondary">运行了命令</p></div></body></html>`);
    const read = () => page.evaluate(() => [...document.querySelectorAll('#fixtures,#fixtures *')].map(e => {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      const pseudo = type => { const p=getComputedStyle(e,type);return [p.content,p.backgroundColor,p.backgroundImage,p.borderRadius,p.boxShadow]; };
      return { id: e.id, tag: e.tagName, color: s.color, fill: s.webkitTextFillColor, radius: s.borderRadius, corner: s.cornerShape, rect: [r.x,r.y,r.width,r.height], bg: s.backgroundColor, image: s.backgroundImage, blur: s.backdropFilter, shadow: s.boxShadow, before:pseudo('::before'),after:pseudo('::after') };
    }));
    const before = await read();
    await page.addStyleTag({ content: theme });
    await page.evaluate(() => { document.documentElement.classList.add('forge-ink-mountain'); document.documentElement.dataset.forgeNativeTheme = 'dark'; });
    const after = await read();
    before.forEach((base, i) => {
      for (const key of ['color','fill','radius','corner','rect']) assert.deepEqual(after[i][key], base[key], `${base.id || base.tag} ${key}`);
      if (base.id.endsWith('-ultra')) assert.deepEqual(after[i],base,'Ultra must have no theme badge or pseudo background');
    });
    for (const id of ['chat','work']) {
      assert.equal(after.find(x => x.id === id).bg, before.find(x => x.id === id).bg, `${id} layout root must not gain a rectangle`);
      const v = await page.locator(`#${id} > [data-composer-body]`).evaluate(e => ({bg:getComputedStyle(e).backgroundColor,image:getComputedStyle(e).backgroundImage}));
      assert.match(v.bg, /64, 76, 88/);
      assert.match(v.image, /linear-gradient/);
    }
    // The original preview remains unchanged until it has the current native
    // signature. The user now requests glass for it while retaining its shape.
    assert.deepEqual(after.find(x => x.id === 'preview'), before.find(x => x.id === 'preview'));
    await page.locator('#preview').evaluate(e => e.classList.add('max-w-[calc(100vw-1rem)]'));
    const glassPreview = (await read()).find(x => x.id === 'preview');
    for (const key of ['radius','corner','rect','color','fill']) assert.deepEqual(glassPreview[key], before.find(x => x.id === 'preview')[key]);
    assert.match(glassPreview.image, /linear-gradient/);
    assert.equal(after.find(x => x.id === 'scheduler').bg, 'rgba(0, 0, 0, 0)');
    assert.equal(await page.locator('#scheduler').evaluate(e => getComputedStyle(e,'::after').backgroundImage), 'none');
    assert.deepEqual(after.find(x => x.id === 'scheduled-page-search'), before.find(x => x.id === 'scheduled-page-search'));
    // Reproduce marker arrival after mount: the colour must already be final.
    const first = after.find(x => x.id === 'menu');
    await page.locator('#menu').evaluate(e => e.classList.add('forge-menu','forge-paper-containing-block'));
    assert.deepEqual((await read()).find(x => x.id === 'menu'), first);
    assert.equal(await page.locator('#add [cmdk-root]').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
    await page.locator('#work [role=textbox]').fill('仍可正常输入');
    assert.equal(await page.locator('#work [role=textbox]').textContent(), '仍可正常输入');
    // Current SettingsLayout container, with native colour swatches inside it.
    await page.locator('#fixtures').evaluate(e => e.insertAdjacentHTML('beforeend','<div id="settings" class="flex h-full min-h-0 flex-col electron:overflow-hidden electron:bg-surface windows:rounded-tl-lg"><div class="group/settings"><h1 class="text-default">外观</h1><div id="settings-card" class="flex flex-col rounded-2xl overflow-hidden border border-default" style="background-color:var(--color-background-panel,var(--color-background-primary-soft-alpha))"><span class="text-secondary">设置说明</span><button id="swatch" style="background:#007acc;color:white;border-radius:8px">强调色</button></div><div id="theme-preview" data-testid="theme-preview" class="rounded-xl bg-surface">原生代码与色卡预览</div></div></div><div id="summary-mount"><div data-pip-obstacle="thread-summary-panel" class="pointer-events-none absolute" aria-hidden="true"></div><div><div id="environment" class="relative flex max-h-full min-h-0 flex-col overflow-hidden rounded-3xl bg-surface-elevated-secondary electron:elevation-prominent"><section><header id="environment-header" class="sticky top-2 h-7 bg-surface-elevated-secondary text-secondary before:bg-surface-elevated-secondary before:content-[\'\']">环境信息</header><button data-slot="thread-summary-panel-item-button" class="text-default">变更 <span class="text-success">+6,827</span><span class="text-danger">-3,661</span></button><button disabled class="text-tertiary">查看全部</button></section></div></div></div>'));
    await page.locator('#fixtures').evaluate(e=>e.insertAdjacentHTML('beforeend','<aside id="settings-sidebar" class="app-shell-left-panel"><input id="settings-search"><span class="text-secondary">设置侧栏</span></aside><aside id="conversation-sidebar" class="app-shell-left-panel"><span class="text-secondary">对话侧栏</span></aside>'));
    const modeComparisons=[];
    for (const mode of ['dark','light']) {
      await page.evaluate(mode => {const r=document.documentElement;r.classList.remove('forge-ink-mountain','electron-dark','electron-light');r.classList.add('electron-'+mode);r.dataset.theme=mode;},mode);
      const base=await read();
      await page.evaluate(mode=>{document.documentElement.dataset.forgeNativeTheme=mode;document.documentElement.classList.add('forge-ink-mountain');},mode);
      const painted=await read();
      base.forEach((value,i)=>{for(const key of ['color','fill','radius','corner','rect'])assert.deepEqual(painted[i][key],value[key],`${mode} ${value.id||value.tag} ${key}`);});
      const shell=painted.find(x=>x.id==='settings-sidebar');
      assert.equal(shell.bg,mode==='light'?'rgba(247, 249, 251, 0.88)':'rgba(20, 24, 28, 0.88)');
      assert.equal(shell.image,'none');
      assert.equal(shell.blur,'blur(8px)');
      for (const id of ['settings','conversation-sidebar']) {
        const surface=painted.find(x=>x.id===id);
        for (const key of ['bg','image','blur','shadow']) { const expected=id==='settings'?(key==='bg'?'rgba(0, 0, 0, 0)':'none'):shell[key]; assert.equal(surface[key],expected,`${id} ${mode} ${key}`); }
      }
      assert.match(painted.find(x=>x.id==='settings-card').image,/linear-gradient/);
      assert.equal(painted.find(x=>x.id==='settings-card').blur,'none');
      assert.deepEqual(painted.find(x=>x.id==='theme-preview'),base.find(x=>x.id==='theme-preview'));
      assert.deepEqual(painted.find(x=>x.id==='swatch'),base.find(x=>x.id==='swatch'));
      assert.match(painted.find(x=>x.id==='preview').image,/linear-gradient/);
      assert.equal(painted.find(x=>x.id==='environment').image,'none');
      assert.equal(painted.find(x=>x.id==='environment').blur,'none');
      assert.equal(painted.find(x=>x.id==='environment-header').image,'none');
      const environmentFill=painted.find(x=>x.id==='environment').bg;
      assert.equal(painted.find(x=>x.id==='environment-header').bg,environmentFill);
      assert.equal(painted.find(x=>x.id==='environment-header').before[1],environmentFill);
      for(const value of painted.filter(x=>x.id.endsWith('-ultra')))assert.deepEqual(value,base.find(x=>x.id===value.id));
      modeComparisons.push({mode,checked:base.length,before:base,after:painted});
    }
    // Source: Tooltip(floating-navigation-rail) has an unpainted outer role;
    // the preview child alone owns the native rounded surface. Painting both
    // layers creates a rectangle even though border-radius values are intact.
    await page.locator('#preview').evaluate(e=>{const wrapper=document.createElement('div');wrapper.id='preview-positioner';wrapper.className='w-fit text-sm whitespace-normal break-words z-20 flex flex-col';wrapper.role='tooltip';e.before(wrapper);wrapper.append(e);e.setAttribute('data-thread-user-message-navigation-tooltip-preview','true');});
    await page.evaluate(()=>document.documentElement.classList.remove('forge-ink-mountain'));
    const nativePositioner=(await read()).find(x=>x.id==='preview-positioner');
    await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
    assert.deepEqual((await read()).find(x=>x.id==='preview-positioner'),nativePositioner);
    assert.match((await read()).find(x=>x.id==='preview').image,/linear-gradient/);
    // Reflow and read-only state must continue to use the client's own boxes.
    for (const width of [640,1100]) {
      await page.setViewportSize({width,height:1000});
      await page.locator('[role=textbox]').evaluateAll(es=>es.forEach(e=>{e.contentEditable='false';e.setAttribute('aria-readonly','true');}));
      await page.evaluate(()=>document.documentElement.classList.remove('forge-ink-mountain'));
      const base=await read();
      await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
      const painted=await read();
      base.forEach((value,i)=>{for(const key of ['color','radius','corner','rect'])assert.deepEqual(painted[i][key],value[key],`${width}px ${value.id||value.tag} ${key}`);});
    }
    const dir = new URL('../artifacts/test-runs/native-boundary-20260920/', import.meta.url);
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(new URL('native-component-comparison.json',dir),JSON.stringify({source:native.archive,checked:before.length,before,after,modeComparisons,responsiveWidths:[640,1100]},null,2),'utf8');
    await page.screenshot({path:fileURLToPath(new URL('native-component-fixture.png',dir))});
  } finally { await browser.close(); }
});


test('native Markdown code cards keep text and geometry while unifying toolbar paint', {skip: !native}, async () => {
  const browser = await chromium.launch({headless:true});
  try {
    for (const mode of ['light','dark']) {
      const page = await browser.newPage({colorScheme:mode});
      await page.setContent('<html data-theme="'+mode+'"><div id="card" data-theme="'+mode+'" data-markdown-copy="code-block" class="relative w-full min-w-0 overflow-clip contain-inline-size rounded-(--radius-3xl-base) border border-subtle bg-secondary-soft-alpha"><div data-markdown-copy="exclude" class="sticky flex items-center min-h-12 text-default" style="background:var(--color-surface)">Plain text<button>Copy</button></div><pre class="overflow-auto px-4"><code>example/path.wav <span style="color:rgb(40,140,80)">token</span></code></pre></div><div id="preview" data-markdown-copy="code-block" class="bg-transparent">Preview</div></html>');
      await page.addStyleTag({content:native.css});
      const read=()=>page.locator('#card, #card *, #preview').evaluateAll(nodes=>nodes.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {color:s.color,rect:[r.x,r.y,r.width,r.height],radius:s.borderRadius,corner:s.cornerShape,overflow:s.overflow,bg:s.backgroundColor,filter:s.backdropFilter};}));
      const before=await read();
      await page.addStyleTag({content:theme});
      await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
      const after=await read();
      for(let i=0;i<before.length;i++) for(const key of ['color','rect','radius','corner','overflow','filter']) assert.deepEqual(after[i][key],before[i][key],mode+' '+i+' '+key);
      assert.equal(after[0].bg,mode==='light'?'rgb(237, 240, 243)':'rgb(36, 40, 44)');
      assert.equal(after[1].bg,after[0].bg);
      assert.equal(after.at(-1).bg,before.at(-1).bg);
      await page.emulateMedia({forcedColors:'active'});
      assert.equal(await page.locator('#card').evaluate(e=>getComputedStyle(e).boxShadow),'none');
      await page.close();
    }
  } finally {await browser.close();}
});


test('material hot update retains scene variables and runtime without page navigation', async () => {
  assert.throws(()=>makeStyleUpdateExpression({styleSheet:'body{}'}), /scene variables/);
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<style id="wukong-codex-theme-style">:root{--forge-scene-count:16}</style><div id="wukong-codex-theme-background"></div>');
    await page.evaluate(()=>{window.__wukongCodexThemeRuntimeV13={identity:42};window.originalRuntime=window.__wukongCodexThemeRuntimeV13;window.originalLayer=document.getElementById('wukong-codex-theme-background');window.originalTime=performance.timeOrigin;});
    const expr=makeStyleUpdateExpression({styleSheet:'body{background:rgb(1,2,3)}',variables:':root{--forge-scene-count:16;--forge-bg-0:url("scene.jpg")}'});
    await page.evaluate(expr);
    await page.evaluate(expr);
    assert.deepEqual(await page.evaluate(()=>({runtime:window.originalRuntime===window.__wukongCodexThemeRuntimeV13,layer:window.originalLayer===document.getElementById('wukong-codex-theme-background'),time:window.originalTime===performance.timeOrigin,count:getComputedStyle(document.documentElement).getPropertyValue('--forge-scene-count')})),{runtime:true,layer:true,time:true,count:'16'});
  } finally {await browser.close();}
});
