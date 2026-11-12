import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import postcss from 'postcss';
import { PNG } from 'pngjs';
import { loadNativeBundle, nodes, prop, text, key, nativeFunction, nativeObject, presentationHarness } from './native-bundle-current-helper.mjs';
import { makeApplyExpression, makeStyleUpdateExpression } from '../runtime/injection-plan-v13.mjs';

fs.mkdirSync(new URL('../artifacts/test-runs/native-boundary-20260920/',import.meta.url),{recursive:true});

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const require = createRequire(import.meta.url);
const loadNative = () => {
  const lock=JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json',import.meta.url),'utf8'));
  const archive=process.env.CODEX_LOCAL_ASAR||path.join(process.env.ProgramFiles||'', 'WindowsApps',lock.packageDirectoryName,lock.asarRelativePath);
  if(!fs.existsSync(archive))return null;
  const bundle = loadNativeBundle();
  const css = bundle.css();
  const family = name => { const match = css.match(new RegExp('\\.(' + name + '-[A-Za-z0-9_-]+)[\\[{,]')); assert.ok(match, 'Native CSS family missing: ' + name); return match[1]; };
  const code = bundle.findModules(['data-code-block-source', 'data-markdown-copy']).find(record => record.source.includes('CodeSurface-'));
  assert.ok(code, 'Native code block owner changed');
  return { archive:bundle.archive, css, rootClass:family('ComposerLayoutRoot'), bodyClass:family('ComposerLayoutBody'), topMenu:family('ComposerTopMenuPanel'), effortClass:family('ModelPickerTriggerEffortText'), codeSurfaceClass:family('CodeSurface'), stickyCodeBarClass:family('StickyActionBar'), codeBlockSource:code.source, codeBlockAST:code.ast };
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
    assert.equal(await opacity(),'0.68');
    assert.equal(await page.locator('[data-forge-background-veil]').evaluate(e=>getComputedStyle(e).backgroundImage),'linear-gradient(rgb(8, 16, 24), rgb(8, 16, 24))');
    await page.evaluate(()=>document.documentElement.dataset.forgeSurface='landing');
    assert.equal(await opacity(),'0');
  } finally {await browser.close();}
});

test('reading materials are replaceable theme variables without changing native geometry', async () => {
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<html class="forge-ink-mountain" data-forge-native-theme="dark" data-forge-surface="thread"><div data-forge-background-veil></div><div data-thread-find-target="conversation"><div data-markdown-text-style="assistant-message"><a href="#example">Example</a></div></div></html>');
    if(native) await page.addStyleTag({content:native.css});
    const rect=()=>page.locator('a').evaluate(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height]});
    const baseline=await rect();
    await page.addStyleTag({content:theme+' :root.forge-ink-mountain{--forge-reading-link:#ffffcc;--forge-reading-min-opacity:.75;--forge-reading-tint:rgb(12,20,28)} [data-forge-background-veil]{transition:none!important}'});
    assert.deepEqual(await rect(),baseline);
    assert.equal(await page.locator('a').evaluate(e=>getComputedStyle(e).color),'rgb(255, 255, 204)');
    assert.equal(await page.locator('[data-forge-background-veil]').evaluate(e=>getComputedStyle(e).opacity),'0.75');
    assert.equal(await page.locator('[data-forge-background-veil]').evaluate(e=>getComputedStyle(e).backgroundImage),'linear-gradient(rgb(12, 20, 28), rgb(12, 20, 28))');
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
    await page.setContent('<html data-theme="dark"><style>aside{width:275px;height:700px}main{height:700px}</style><aside class="app-shell-left-panel"><nav class="group/sidebar-rail" style="height:100%">Sidebar</nav></aside><main><div data-thread-find-target="conversation">Conversation</div></main></html>');
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
    const paint=await page.locator('nav').evaluate(e=>getComputedStyle(e).backgroundColor);
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
      await page.setContent(`<html class="forge-ink-mountain" data-forge-native-theme="${mode}"><style>body{margin:0;background:${mode==='dark'?'white':'black'}}aside{height:400px;width:300px;color:${mode==='dark'?'#a0a0a0':'#5a5a5a'}}</style><aside class="app-shell-left-panel"><nav class="group/sidebar-rail" style="height:100%">Native text</nav></aside></html>`);
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

test('active paint sheet preserves geometry and scopes ink to navigation and dark conversation', () => {
  const quotaContourSelector = `:root.forge-ink-mountain [data-codex-composer-root]:has(
  [data-composer-layout="multiline"][data-composer-radius-variant="default"][data-composer-surface-variant="default"]
) aside[role="status"][aria-live="polite"]:is([class^="banner-"], [class*=" banner-"]):not(:is(
  [data-composer-surface-variant], [data-slot="popover-content"],
  [role="dialog"], [role="alertdialog"], [data-summary-panel-variant],
  [data-checkout-presentation]
) *):not([data-codex-composer-root] [data-codex-composer-root] *)`;
  const quotaContourValues = new Map([
    ['border-radius', 'var(--composer-radius)'],
    ['corner-shape', 'var(--composer-corner-shape)']
  ]);
  const quotaContourSeen = new Set();
  const sidebarHoverSelector = `:root.forge-ink-mountain .sidebar-navigation:not([data-activity-sidebar-host]) :is(
  [data-app-action-sidebar-project-row],
  [data-app-action-sidebar-thread-row]
).sidebar-item:not([data-file-drop-active="true"]):not([class~="bg-text-info/10"], [class~="bg-text-accent/10"]):not([data-activity-sidebar-host] *)`;
  const sidebarHoverTokens = [
    '--color-background-primary-ghost-hover',
    '--color-background-secondary-ghost-hover'
  ];
  const sidebarHoverSeen = new Set();
  const navigationHoverSelector = `:root.forge-ink-mountain .sidebar-navigation nav:is([class^="Navigation-"], [class*=" Navigation-"]) .sidebar-item:is(
  [class~="hover:bg-secondary-ghost-hover"],
  [class~="hover:before:bg-secondary-ghost-hover"]
):not([data-app-action-sidebar-project-row], [data-app-action-sidebar-thread-row], [data-file-drop-active="true"], [class~="bg-text-info/10"], [class~="bg-text-accent/10"], [data-activity-sidebar-host] *)`;
  let navigationHoverSeen = false;
  postcss.parse(theme).walkDecls(d => {
    const s = d.parent.selector || '';
    // Only the independent recovery notice may adopt the adjacent native
    // composer's contour; every other native geometry guard remains active.
    if (s === quotaContourSelector) {
      assert.ok(quotaContourValues.has(d.prop), `Unexpected quota contour declaration: ${d.prop}`);
      assert.equal(d.value, quotaContourValues.get(d.prop), `Quota contour value: ${d.prop}`);
      assert.equal(d.important, true, `Quota contour priority: ${d.prop}`);
      assert.ok(!quotaContourSeen.has(d.prop), `Duplicate quota contour declaration: ${d.prop}`);
      quotaContourSeen.add(d.prop);
      return;
    }
    // The shared sidebar row owns these hover tokens. Keep the exception
    // on its audited semantic rows, excluding drop/activity/high-contrast paths.
    if (s === sidebarHoverSelector && sidebarHoverTokens.includes(d.prop)) {
      assert.equal(d.value, 'var(--forge-nav-row-hover)');
      assert.equal(d.important, true);
      assert.equal(d.parent.parent.type, 'atrule');
      assert.equal(d.parent.parent.params, '(forced-colors: none)');
      assert.ok(!sidebarHoverSeen.has(d.prop), `Duplicate sidebar hover token: ${d.prop}`);
      sidebarHoverSeen.add(d.prop);
      return;
    }
    if (s === navigationHoverSelector) {
      assert.equal(d.prop, '--color-background-secondary-ghost-hover');
      assert.equal(d.value, 'var(--forge-nav-hover)');
      assert.equal(d.important, true);
      assert.equal(d.parent.parent.params, '(forced-colors: none)');
      assert.equal(navigationHoverSeen, false);
      navigationHoverSeen = true;
      return;
    }
    const conversation = s.split(',').every(selector => selector.includes('[data-forge-native-theme="dark"]') && /\[data-thread-find-target="conversation"\]|\.messaging-root\.messaging-embedded \.messages-scroll/.test(selector));
    if (conversation && ['--color-text-secondary','--color-text-tertiary'].includes(d.prop)) return;
    if (s.includes('[data-forge-native-theme="dark"]') && s.includes('[data-markdown-text-style="assistant-message"] a') && d.prop === 'color') return;
    if (s === ':root.forge-ink-mountain .sidebar-navigation:is([class^="ConversationSidebar-"], [class*=" ConversationSidebar-"]) nav:is([class^="Navigation-"], [class*=" Navigation-"])' &&
        ['color','text-shadow','--color-text','--color-text-secondary','--color-text-secondary-solid','--color-text-tertiary','--color-background-primary-ghost-hover'].includes(d.prop)) return;
    if (s === ':root.forge-ink-mountain :has(> [data-mention-list-scroll-area])' &&
        ['color','--color-text','--color-codex-description','--color-text-tertiary'].includes(d.prop)) return;
    if (s === ':root.forge-ink-mountain :is([cmdk-root], [data-cmdk-root]):not([class*="ComposerTopMenuPanel"] *)' &&
        ['color','--color-text','--color-text-secondary','--color-text-tertiary','--color-codex-description'].includes(d.prop)) return;
    if (s === ':root.forge-ink-mountain [data-mention-list-scroll-area]' && d.prop === '--color-surface-elevated-secondary') return;
    // The shared summary header resolves its gradient through this token.
    // Permit only the empty inert paint leaf, never an inherited container.
    if (s === ':root.forge-ink-mountain [data-summary-panel-variant] [aria-hidden="true"].pointer-events-none:empty[class~="from-surface-elevated-secondary"]' &&
        d.prop === '--color-surface-elevated-secondary' && d.value === 'var(--forge-summary-fill)') return;
    if (s.startsWith(':root.forge-ink-mountain [data-mention-list-scroll-area] :is(') && d.prop === '--color-codex-description') return;
    if (s === ':root.forge-ink-mountain [class~="group/settings"] table:has([id^="browser-use-site-permissions-column-"])' &&
        ['--color-background-panel','--color-surface-elevated-secondary','--color-border'].includes(d.prop)) return;
    const owned = /data-forge-title-copy|\.forge-landing|home-icon|#wukong-codex-theme-background|\[data-forge-background-(?:image|veil|layer)\]/.test(s);
    if (owned) return;
    const documentLayer = /:root\.forge-ink-mountain (?:body|#root)$/.test(s);
    if (documentLayer && ['position','z-index'].includes(d.prop)) return;
    assert.ok(!/^(?:color|-webkit-text-fill-color|fill|stroke|font.*|line-height|letter-spacing|text-shadow|border(?:-.*)?-radius|border-radius|corner-shape|clip-path|mask.*|transform|(?:min-|max-)?(?:width|height)|padding.*|margin.*|inset.*|top|right|bottom|left|position|display|flex.*|grid.*|gap|overflow.*|opacity|border(?:-.*)?-width)$/.test(d.prop), `${d.prop}: ${s}`);
    assert.ok(!/^--color-/.test(d.prop), `Client token override: ${d.prop}`);
  });
  assert.deepEqual([...quotaContourSeen].sort(), [...quotaContourValues.keys()].sort(),
    'The bounded quota contour rule retains both native variable declarations');
  assert.deepEqual([...sidebarHoverSeen].sort(), sidebarHoverTokens, 'Native hover tokens stay in the bounded row rule');
  assert.equal(navigationHoverSeen, true, 'The native navigation item receives its own bounded hover token');
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
    await page.locator('#preview').evaluate(e => e.setAttribute('data-thread-user-message-navigation-tooltip-preview', 'true'));
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
    await page.locator('#fixtures').evaluate(e => e.insertAdjacentHTML('beforeend','<div id="settings" class="flex h-full min-h-0 flex-col electron:overflow-hidden electron:bg-surface windows:rounded-tl-lg"><div class="group/settings"><h1 class="text-default">外观</h1><div id="settings-card" class="flex flex-col rounded-2xl overflow-hidden border border-default" style="background-color:var(--color-background-panel,var(--color-background-primary-soft-alpha))"><span class="text-secondary">设置说明</span><button id="swatch" style="background:#007acc;color:white;border-radius:8px">强调色</button></div><div id="theme-preview" data-testid="theme-preview" class="rounded-xl bg-surface">原生代码与色卡预览</div></div></div><div id="summary-mount"><div data-pip-obstacle="thread-summary-panel" class="pointer-events-none absolute" aria-hidden="true"></div><div><div id="environment" data-summary-panel-variant="summary" class="group/summary-panel relative flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl bg-surface-elevated-secondary electron:elevation-prominent"><section><header id="environment-header" class="sticky top-2 h-7 bg-surface-elevated-secondary text-secondary before:bg-surface-elevated-secondary before:content-[\'\']">环境信息</header><button data-slot="thread-summary-panel-item-button" class="text-default">变更 <span class="text-success">+6,827</span><span class="text-danger">-3,661</span></button><button disabled class="text-tertiary">查看全部</button></section></div></div></div>'));
    await page.locator('#fixtures').evaluate(e=>e.insertAdjacentHTML('beforeend','<aside class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><div id="settings-sidebar" class="sidebar-navigation"><input id="settings-search"><span class="text-secondary">设置侧栏</span></div></aside><aside class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><div id="conversation-sidebar" class="sidebar-navigation"><span class="text-secondary">对话侧栏</span></div></aside>'));
    const modeComparisons=[];
    for (const mode of ['dark','light']) {
      await page.evaluate(mode => {const r=document.documentElement;r.classList.remove('forge-ink-mountain','electron-dark','electron-light');r.classList.add('electron-'+mode);r.dataset.theme=mode;},mode);
      const base=await read();
      await page.evaluate(mode=>{document.documentElement.dataset.forgeNativeTheme=mode;document.documentElement.classList.add('forge-ink-mountain');},mode);
      const painted=await read();
      base.forEach((value,i)=>{for(const key of ['color','fill','radius','corner','rect'])assert.deepEqual(painted[i][key],value[key],`${mode} ${value.id||value.tag} ${key}`);});
      const shell=painted.find(x=>x.id==='settings-sidebar');
      assert.equal(shell.bg,mode==='light'?'rgba(247, 249, 251, 0.6)':'rgba(20, 24, 28, 0.64)');
      assert.equal(shell.image,'none');
      assert.equal(shell.blur,'blur(12px)');
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
  // Derive the paint owners from the installed component instead of keeping a
  // retired utility in the fixture. Its default surface and sticky toolbar
  // share native paint; preview/hover/transparent variants do not own it.
  assert.ok(native.codeSurfaceClass, 'native default code surface drifted; re-audit the code-block paint owner');
  assert.ok(native.stickyCodeBarClass, 'native sticky code toolbar drifted; re-audit its paint owner');
  for (const contract of [native.codeSurfaceClass, native.stickyCodeBarClass]) assert.ok(native.codeBlockSource.includes(contract), 'Current renderer must own native class ' + contract);
  const objects = nodes(native.codeBlockAST).filter(node => node.type === 'ObjectExpression');
  assert.ok(objects.some(node => prop(node,'data-code-block') && text(prop(node,'data-markdown-copy')) === 'code-block'), 'Code card semantic owner changed');
  assert.ok(objects.some(node => prop(node,'data-code-block-source')), 'Source content hook changed');
  assert.ok(objects.some(node => text(prop(node,'data-markdown-copy')) === 'exclude'), 'Toolbar copy-exclusion hook changed');
  const browser = await chromium.launch({headless:true});
  try {
    for (const mode of ['light','dark']) {
      const page = await browser.newPage({colorScheme:mode});
      await page.setContent(`<html class="${mode}" data-theme="${mode}"><div id="code-scroll" style="height:190px;width:500px;overflow:auto">
        <div id="card" data-code-block="true" data-theme="${mode}" data-markdown-copy="code-block" class="relative w-full min-w-0 overflow-clip contain-inline-size rounded-(--radius-3xl-base) border border-subtle text-default ${native.codeSurfaceClass}">
          <div id="code-toolbar" data-markdown-copy="exclude" class="flex items-center font-sans text-sm select-none min-h-12 gap-2 py-1.5 ps-4 pe-1.5 font-medium text-default md:ps-5 sticky z-10 ${native.stickyCodeBarClass}">JavaScript<button id="copy-code">Copy</button><button id="wrap-code" aria-pressed="false">Wrap</button></div>
          <div data-code-block-source="true"><pre id="source-code" class="overflow-auto px-4" style="white-space:pre"><code>${Array.from({length:18},(_,i)=>`example/path-${i}.wav <span style="color:rgb(40,140,80)">token</span>`).join('\n')}</code></pre></div>
        </div></div>
        <div id="legacy" data-theme="${mode}" data-markdown-copy="code-block" class="bg-secondary-soft-alpha"><div data-markdown-copy="exclude">Legacy toolbar</div><pre>Legacy default code</pre></div>
        <div id="preview" data-code-block="true" data-theme="${mode}" data-markdown-copy="code-block" class="group/code-snippet rounded-lg border border-default bg-surface text-default"><div data-markdown-copy="exclude">Preview toolbar</div>Preview</div>
        <div id="hover" data-code-block="true" data-theme="${mode}" data-markdown-copy="code-block" class="w-auto overflow-visible bg-transparent"><div data-markdown-copy="exclude">Hover toolbar</div>Hover</div>
        <div id="transparent" data-code-block="true" data-theme="${mode}" data-markdown-copy="code-block" class="rounded-(--radius-3xl-base) border border-subtle text-default bg-transparent"><div data-markdown-copy="exclude">Transparent toolbar</div>Transparent</div>
        <pre id="user-code" data-markdown-copy="code-block" class="bg-(--color-text-user-message)/10 text-user-message"><code>User code</code></pre></html>`);
      await page.addStyleTag({content:native.css});
      await page.evaluate(() => {
        document.getElementById('copy-code').addEventListener('click', () => {
          document.getElementById('card').dataset.copiedText = document.getElementById('source-code').textContent;
        });
        document.getElementById('wrap-code').addEventListener('click', event => {
          const pressed = event.currentTarget.getAttribute('aria-pressed') !== 'true';
          event.currentTarget.setAttribute('aria-pressed', String(pressed));
          document.getElementById('source-code').style.whiteSpace = pressed ? 'pre-wrap' : 'pre';
        });
      });
      const read=()=>page.locator('#card, #card *, #legacy, #legacy *, #preview, #preview *, #hover, #hover *, #transparent, #transparent *, #user-code, #user-code *').evaluateAll(nodes=>nodes.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {id:e.id,color:s.color,rect:[r.x,r.y,r.width,r.height],radius:s.borderRadius,corner:s.cornerShape,overflow:s.overflow,bg:s.backgroundColor,image:s.backgroundImage,filter:s.backdropFilter};}));
      const before=await read();
      await page.addStyleTag({content:theme});
      await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
      const after=await read();
      for(let i=0;i<before.length;i++) for(const key of ['color','rect','radius','corner','overflow','filter']) assert.deepEqual(after[i][key],before[i][key],mode+' '+i+' '+key);
      const card=after.find(node=>node.id==='card'),toolbar=after.find(node=>node.id==='code-toolbar');
      assert.equal(card.bg,mode==='light'?'rgb(237, 240, 243)':'rgb(36, 40, 44)');
      assert.equal(toolbar.bg,card.bg);
      assert.equal(card.image,'none');
      assert.equal(toolbar.image,'none');
      assert.equal(after.find(node=>node.id==='legacy').bg,card.bg);
      for (const id of ['preview','hover','transparent','user-code']) {
        const start=before.findIndex(node=>node.id===id),end=before.findIndex((node,index)=>index>start&&node.id);
        const stop=end===-1?before.length:end;
        assert.deepEqual(after.slice(start,stop),before.slice(start,stop),mode+' '+id+' must retain native paint');
      }
      await page.getByRole('button',{name:'Copy',exact:true}).click();
      assert.equal(await page.locator('#card').getAttribute('data-copied-text'),await page.locator('#source-code').textContent());
      await page.getByRole('button',{name:'Wrap',exact:true}).click();
      assert.equal(await page.getByRole('button',{name:'Wrap',exact:true}).getAttribute('aria-pressed'),'true');
      assert.equal(await page.locator('#source-code').evaluate(e=>getComputedStyle(e).whiteSpace),'pre-wrap');
      // The native toolbar must continue covering code while the card scrolls.
      await page.locator('#code-scroll').evaluate(e=>{e.scrollTop=130;});
      const scrolled=await read();
      await page.evaluate(()=>document.documentElement.classList.remove('forge-ink-mountain'));
      const nativeScrolled=await read();
      for(let i=0;i<scrolled.length;i++) for(const key of ['color','rect','radius','corner','overflow','filter']) assert.deepEqual(scrolled[i][key],nativeScrolled[i][key],mode+' scrolled '+i+' '+key);
      assert.equal(scrolled.find(node=>node.id==='code-toolbar').bg,card.bg);
      await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
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


// Actual shared row renderer and attribute helpers. Presentation uses an inert
// press hook; these fixtures exercise paint, geometry and native CSS hitboxes,
// never project navigation, account state or sidebar business modules.
const loadSidebarRowNative = () => {
  const bundle = loadNativeBundle();
  const markerRecords = bundle.findModules(['data-app-action-sidebar-thread-selected', 'sidebarProjectRow:']);
  assert.equal(markerRecords.length, 1, 'Native sidebar semantic attribute helper changed');
  const marker = markerRecords[0];
  const mapDeclaration = nodes(marker.ast).find(node => node.type === 'VariableDeclarator' && prop(node.init, 'sidebarThreadActive'));
  const helperDeclaration = nodes(marker.ast).find(node => node.type === 'VariableDeclarator' && prop(node.init, 'sidebarThreadRow')?.type === 'ArrowFunctionExpression');
  const attributes = nativeObject(marker, mapDeclaration.init);
  assert.equal(attributes.sidebarProjectRow, 'data-app-action-sidebar-project-row');
  assert.equal(attributes.sidebarThreadActive, 'data-app-action-sidebar-thread-active');
  assert.equal(attributes.sidebarThreadSelected, 'data-app-action-sidebar-thread-selected');
  const helper = name => {
    const fn = prop(helperDeclaration.init, name);
    assert.equal(fn.type, 'ArrowFunctionExpression');
    return new Function(mapDeclaration.id.name, 'return (' + marker.source.slice(fn.start, fn.end) + ');')(attributes);
  };
  const projectAttributes = helper('sidebarProjectRow'), threadAttributes = helper('sidebarThreadRow');
  assert.deepEqual(threadAttributes({ active: true, selected: false, id: 'fixture', kind: 'local', pinned: false }), {
    'data-app-action-sidebar-thread-active': 'true', 'data-app-action-sidebar-thread-host-id': '',
    'data-app-action-sidebar-thread-id': 'fixture', 'data-app-action-sidebar-thread-kind': 'local',
    'data-app-action-sidebar-thread-pinned': 'false', 'data-app-action-sidebar-thread-row': '',
    'data-app-action-sidebar-thread-selected': 'false'
  });
  const rowRecords = bundle.findModules(['sidebar-item focus-visible:outline', 'isHighlighted']);
  assert.equal(rowRecords.length, 1, 'Shared native sidebar interaction renderer changed');
  const rowRecord = rowRecords[0], exports = bundle.exports(rowRecord);
  const rowExport = Object.values(exports).find(node => /FunctionExpression/.test(node.type));
  const rowFunction = nativeFunction(rowRecord, rowExport.start), rowNodes = rowFunction.nodes;
  const pressOptions = rowNodes.find(node => node.type === 'ObjectExpression' && prop(node, 'onSelect') && prop(node, 'isDisabled'));
  const pressBinding = rowNodes.find(node => node.type === 'AssignmentExpression' && node.right === pressOptions)?.left.name;
  const pressCall = rowNodes.find(node => node.type === 'CallExpression' && node.arguments[0]?.name === pressBinding);
  const pressMember = pressCall.callee.type === 'SequenceExpression' ? pressCall.callee.expressions.at(-1) : pressCall.callee;
  assert.equal(pressMember.type, 'MemberExpression');
  assert.ok(bundle.imports(rowRecord)[pressMember.object.name]);
  const harness = presentationHarness(bundle);
  const renderRow = harness.compile(rowFunction, { [pressMember.object.name]: { [key(pressMember.property)]: () => ({}) } });
  const hoverClass = 'bg-secondary-ghost-hover';
  const selectClass = 'data-[app-action-sidebar-thread-selected=true]:' + hoverClass;
  const fileDropClass = 'data-[file-drop-active=true]:' + hoverClass;
  const threadRecords = bundle.findModules(selectClass);
  assert.equal(threadRecords.length, 1, 'Native selected-thread paint class changed');
  const threadRecord = threadRecords[0];
  assert.ok(Object.values(bundle.imports(threadRecord)).some(ref => ref.id === rowRecord.id), 'Thread presentation must use the shared row');
  assert.ok(threadRecord.source.includes(fileDropClass), 'Native file-drop feedback changed');
  assert.ok(threadRecord.source.includes('before:pointer-events-auto before:absolute before:inset-0'), 'Native link hitbox changed');
  const threadContentClass = nodes(threadRecord.ast).map(text).find(value => value.startsWith('flex h-full w-full items-center text-sm leading-4'));
  assert.ok(threadContentClass, 'Native thread link and trailing action layout carrier changed');
  const projectRecords = bundle.findModules('sidebarProjectRow({');
  assert.equal(projectRecords.length, 1, 'Project presentation must publish the semantic row attributes');
  const projectRenderer = projectRecords[0];
  const folderRecord = Object.values(bundle.imports(projectRenderer)).map(ref => bundle.module(ref.id))
    .find(record => record.source.includes('group/folder-row') && record.source.includes('sidebar-row-focus'));
  assert.ok(folderRecord && Object.values(bundle.imports(folderRecord)).some(ref => ref.id === rowRecord.id), 'Project row must use the same native interaction renderer');
  const css = bundle.css();
  assert.ok(css.includes('.sidebar-item{border-radius:var(--radius-lg);corner-shape:var(--codex-corner-shape)}'));
  assert.ok(rowFunction.source.includes('hover:' + hoverClass), 'Native row hover utility changed');
  assert.ok(rowFunction.source.includes('has-[[aria-haspopup=menu][aria-expanded=true]]:' + hoverClass), 'Native expanded menu utility changed');
  assert.ok(css.includes('.' + hoverClass + '{background-color:var(--color-background-secondary-ghost-hover)'));
  assert.ok(rowFunction.source.includes('bg-text-accent/10 ring-2 ring-inset ring-ring'), 'Native drop target fill and ring changed');
  assert.ok(rowFunction.source.includes('"aria-current":'));
  const navRecords = bundle.findModules(['data-sidebar-navigation-root', 'sidebarElectron.newThread']);
  assert.equal(navRecords.length, 1, 'Native New Chat navigation owner changed');
  const [navRecord] = navRecords;
  const newChat = nativeFunction(navRecord, 'sidebarElectron.newThread');
  const itemCall = newChat.nodes.find(node => node.type === 'CallExpression' &&
    text(prop(node.arguments[1], 'animatedIcon')) === 'sidebar-new-chat');
  const itemImport = bundle.imports(navRecord)[itemCall?.arguments[0].object.name];
  assert.ok(itemImport, 'New Chat must still use the shared navigation item');
  const itemRecord = bundle.module(itemImport.id), itemExport = bundle.exports(itemRecord)[key(itemCall.arguments[0].property)];
  const itemClasses = nodes(itemExport).map(text);
  const navClass = nodes(navRecord.ast).map(text).find(value => /^Navigation-\S+$/.test(value));
  const navItem = itemClasses.find(value => value.startsWith('sidebar-item relative shrink-0'));
  const navElementHover = itemClasses.find(value => value.startsWith('hover:bg-secondary-ghost-hover '));
  const navPseudoHover = itemClasses.find(value => value.startsWith('hover:before:bg-secondary-ghost-hover '));
  const navPseudoBase = itemClasses.find(value => value.includes('before:pointer-events-none before:absolute before:inset-0'));
  assert.ok(navClass && navItem && navElementHover && navPseudoHover && navPseudoBase,
    'Native shared navigation item paint ownership changed');
  return { css, renderRow, projectAttributes, threadAttributes, selectClass, fileDropClass, threadContentClass,
    navClass, navItem, navElementHover, navPseudoHover, navPseudoBase };
};

const sidebarFixture = (native, mode, width) => {
  const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const html = value => {
    if (value == null || value === false) return '';
    if (Array.isArray(value)) return value.map(html).join('');
    if (typeof value !== 'object') return escape(value);
    if (value.tag === '#fragment') return html(value.props.children);
    const attrs = Object.entries(value.props).filter(([name, item]) => name !== 'children' && name !== 'ref' && !name.startsWith('on') && item != null && item !== false)
      .map(([name, item]) => ' ' + (name === 'className' ? 'class' : name === 'tabIndex' ? 'tabindex' : name) + '="' + escape(item === true ? 'true' : item) + '"').join('');
    return '<' + value.tag + attrs + '>' + html(value.props.children) + '</' + value.tag + '>';
  };
  const child = (tag, props) => ({ tag, props });
  const project = (id, active) => native.renderRow({ id, ...native.projectAttributes({ collapsed: false, label: 'Fixture project', projectId: id }),
    className: 'sidebar-row-focus group/folder-row flex items-center justify-between overflow-hidden text-default px-2',
    isActive: active, onPress: () => {}, children: [child('span', { className: 'flex min-w-0 flex-1 items-center gap-2', children: [child('span', { className: 'sidebar-item-icon', children: '◇' }), '示例项目'] }),
      child('button', { id: id + '-menu', 'aria-haspopup': 'menu', 'aria-expanded': 'false', className: 'px-1', children: '⋯' })] });
  const thread = (id, { active = false, selected = false, drop = false, fileDrop = false } = {}) => native.renderRow({
    id, ...native.threadAttributes({ active, selected, id, kind: 'local', pinned: false }),
    ...(fileDrop ? { 'data-file-drop-active': 'true' } : {}),
    className: native.selectClass + ' ' + native.fileDropClass + ' px-2 py-row-y',
    isActive: active, isDropTarget: drop, hasNavigationLink: true, onPress: () => {},
    children: [child('div', { className: native.threadContentClass, children: [child('a', { id: id + '-link', href: '#fixture', 'data-interactive-row-link': 'true',
      className: 'flex min-w-0 flex-1 before:pointer-events-auto before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] focus-visible:before:outline focus-visible:before:outline-2 focus-visible:before:outline-offset-[-2px] focus-visible:before:outline-ring',
      children: child('span', { className: 'ps-8 truncate', children: active ? '当前示例聊天' : selected ? '已多选的示例聊天' : '未选中的示例聊天' }) }),
      child('button', { id: id + '-menu', 'aria-haspopup': 'menu', 'aria-expanded': 'false', className: 'px-1', children: '⋯' })] })]
  });
  return '<!doctype html><html class="electron-' + mode + '" data-theme="' + mode + '" style="color-scheme:' + mode + '"><head><style>' + native.css + '</style><style>' +
    'body{margin:0;min-height:650px;background:' + (mode === 'dark' ? '#29333a' : '#e4e9e7') + '}#selection-sidebar{position:absolute;left:16px;top:16px;width:' + width + 'px;height:600px}.sidebar-navigation{height:100%}#outside{position:absolute;left:460px;top:16px;width:260px}#activity{margin-top:18px}.fixture-heading{padding:8px;font-size:11px;opacity:.7}#selection-sidebar nav{padding:8px}button{cursor:pointer}</style></head><body><div id="root">' +
    '<aside id="selection-sidebar" class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><div class="sidebar-navigation">' +
    '<nav class="' + native.navClass + '"><p class="fixture-heading">原生行展示夹具 · 非实机</p>' +
    '<button id="new-chat" class="' + native.navItem + ' ' + native.navElementHover + ' w-full px-2 py-1.5">新聊天</button>' +
    '<button id="nav-destination" class="' + native.navItem + ' ' + native.navPseudoBase + ' ' + native.navPseudoHover + ' w-full px-2 py-1.5">导航示例</button>' +
    html(project('project', true)) + html(thread('active', { active: true, selected: true })) + html(thread('inactive')) + html(thread('selected', { selected: true })) + html(project('inactive-project', false)) + html(thread('drop', { active: true, selected: true, drop: true })) + html(thread('file-drop', { active: true, selected: true, fileDrop: true })) +
    '</nav><div id="activity" class="sidebar-navigation" data-activity-sidebar-host="true">' + html(thread('activity-row', { active: true, selected: true })) + '</div></div></aside>' +
    '<div id="outside">' + html(thread('outside-row', { active: true, selected: true })) + '</div></div><script>window.fixtureMenuClicks=0;window.fixtureLinkClicks=0;document.querySelectorAll("button[aria-haspopup=menu]").forEach(e=>e.onclick=event=>{event.stopPropagation();fixtureMenuClicks++;e.setAttribute("aria-expanded",String(e.getAttribute("aria-expanded")!=="true"))});document.querySelectorAll("a").forEach(e=>e.onclick=event=>{event.preventDefault();fixtureLinkClicks++})</script></body></html>';
};

test('current native sidebar distinguishes the current chat, multi-selection and project hover without changing native interactions', async () => {
  const native = loadSidebarRowNative(), browser = await chromium.launch({ headless: true });
  const old = postcss.parse(theme); let removed = 0;
  old.walkRules(rule => { if (rule.selector.includes('.sidebar-navigation:not([data-activity-sidebar-host])')) { rule.remove(); removed++; } });
  assert.equal(removed, 3, 'The shared-native-paint control must remove only the three sidebar row mappings');
  const previousTheme = old.toString(), report = [];
  const primaryOnly = postcss.parse(theme);
  primaryOnly.walkDecls('--color-background-secondary-ghost-hover', declaration => declaration.remove());
  const geometry = page => page.locator('#selection-sidebar .sidebar-item,#selection-sidebar a,#selection-sidebar button').evaluateAll(elements => elements.map(e => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { id: e.id, rect: [r.x, r.y, r.width, r.height], radius: s.borderRadius,
      corner: s.cornerShape, padding: s.padding, margin: s.margin, font: s.font, border: s.borderWidth, pointer: s.pointerEvents, tab: e.tabIndex, overflow: s.overflow };
  }));
  const paint = (page, id) => page.locator('#' + id).evaluate(e => { const s = getComputedStyle(e); return { background: s.backgroundColor, image: s.backgroundImage,
    position: s.backgroundPosition, shadow: s.boxShadow, outline: s.outline, pointer: s.pointerEvents }; });
  const focus = async page => {
    await page.locator('#active-menu').focus(); await page.keyboard.press('Shift+Tab');
    return page.locator('#active-link').evaluate(e => { const s = getComputedStyle(e, '::before'); return { focused: document.activeElement === e, visible: e.matches(':focus-visible'), outline: s.outline, pointer: s.pointerEvents, position: s.position, inset: s.inset }; });
  };
  const navigationHover = async page => {
    const observations = [];
    for (const [id, pseudo] of [['new-chat', null], ['nav-destination', '::before']]) {
      const item = page.locator('#' + id);
      await item.hover();
      observations.push(await item.evaluate((element, selector) => {
        const probe = document.createElement('span');
        probe.style.backgroundColor = 'var(--forge-nav-hover)';
        element.append(probe);
        const result = { id: element.id, hover: getComputedStyle(element, selector).backgroundColor,
          expected: getComputedStyle(probe).backgroundColor };
        probe.remove();
        return result;
      }, pseudo));
    }
    await page.mouse.move(770, 620);
    return observations;
  };
  const feedback = async page => {
    const observations = [];
    for (const id of ['inactive-project', 'inactive']) {
      const row = page.locator('#' + id);
      const menu = row.locator('button[aria-haspopup="menu"]');
      await row.hover();
      const hover = (await paint(page, id)).background;
      await page.mouse.move(770, 620);
      const idle = (await paint(page, id)).background;
      await menu.evaluate(button => button.setAttribute('aria-expanded', 'true'));
      const menuOpen = (await paint(page, id)).background;
      await menu.evaluate(button => button.setAttribute('aria-expanded', 'false'));
      const colors = await row.evaluate(element => {
        const probe = document.createElement('span');
        element.append(probe);
        const resolve = token => {
          probe.style.backgroundColor = 'var(' + token + ')';
          return getComputedStyle(probe).backgroundColor;
        };
        const values = {
          expected: resolve('--forge-nav-row-hover'),
          nativeUtility: resolve('--color-background-secondary-ghost-hover')
        };
        probe.remove();
        return values;
      });
      assert.equal(idle, 'rgba(0, 0, 0, 0)', 'The idle row remains transparent');
      assert.equal(hover, colors.nativeUtility, 'Hover uses the actual native secondary utility');
      assert.equal(menuOpen, colors.nativeUtility, 'Expanded menu paints even when the pointer is outside the row');
      observations.push({ id, hover, menuOpen, ...colors });
    }
    return observations;
  };
  try {
    for (const mode of ['dark', 'light']) for (const width of [300, 380]) {
      const page = await browser.newPage({ viewport: { width: 800, height: 650 }, colorScheme: mode });
      try {
        await page.setContent(sidebarFixture(native, mode, width));
        const baseline = await geometry(page), nativeFocus = await focus(page);
        const drop = await paint(page, 'drop'), fileDrop = await paint(page, 'file-drop');
        const outside = await paint(page, 'outside-row'), activity = await paint(page, 'activity-row');
        assert.ok(nativeFocus.focused && nativeFocus.visible, 'Exercise the native link pseudo-element focus indicator');
        const sheet = await page.addStyleTag({ content: previousTheme });
        await sheet.evaluate(e => e.id = 'theme-under-test');
        await page.evaluate(value => { document.documentElement.classList.add('forge-ink-mountain'); document.documentElement.dataset.forgeNativeTheme = value; }, mode);
        const previous = { project: await paint(page, 'project'), active: await paint(page, 'active'), selected: await paint(page, 'selected') };
        assert.equal(previous.project.background, previous.active.background, 'The old shared ghost token must reproduce stacked equal project/thread fill');
        assert.equal(previous.active.background, previous.selected.background, 'The native ghost token also fills multi-selected rows');
        assert.equal(previous.active.shadow, previous.selected.shadow, 'The native rows lack a distinct current-chat edge');
        await sheet.evaluate((e, css) => e.textContent = css, primaryOnly.toString());
        const oldNavigation = await navigationHover(page);
        for (const item of oldNavigation) assert.notEqual(item.hover, item.expected, 'Primary alone misses general navigation hover');
        const previousFeedback = await feedback(page);
        for (const row of previousFeedback) {
          assert.notEqual(row.hover, row.expected, 'The primary-only theme reproduces the missed secondary hover and expanded-menu paint');
        }
        await page.locator('#theme-under-test').evaluate((e, css) => e.textContent = css, theme);
        const newNavigation = await navigationHover(page);
        for (const item of newNavigation) assert.equal(item.hover, item.expected, 'Both native navigation hover carriers use theme paint');
        const currentFeedback = await feedback(page);
        for (const row of currentFeedback) {
          assert.equal(row.hover, row.expected, 'The current theme restores the intended hover and expanded-menu paint');
        }
        await page.locator('#project').hover();
        const current = { project: await paint(page, 'project'), active: await paint(page, 'active'), selected: await paint(page, 'selected') };
        assert.notEqual(current.project.background, current.active.background, 'Project hover and current-chat fills are distinct');
        assert.notEqual(current.project.background, current.selected.background, 'Project hover and multi-selection fills are distinct');
        assert.notEqual(current.active.background, current.selected.background, 'The current chat has its own fill');
        assert.equal(current.active.image, 'none');
        assert.equal(current.selected.image, 'none');
        assert.match(current.active.shadow, / 0px 0px 0px 1px inset$/, 'Only the current chat receives a 1px inset edge');
        assert.equal(current.selected.shadow, previous.selected.shadow, 'A multi-selected row keeps its native shadow');
        await page.locator('#active').evaluate(e => e.setAttribute('data-app-action-sidebar-thread-selected', 'false'));
        assert.deepEqual(await paint(page, 'active'), current.active, 'The current chat has the same paint outside multi-selection');
        await page.locator('#active').evaluate(e => e.setAttribute('data-app-action-sidebar-thread-selected', 'true'));
        assert.deepEqual(await geometry(page), baseline, mode + '/' + width + ': native row and control geometry');
        assert.deepEqual(await focus(page), nativeFocus, 'Native anchor focus outline and hitbox remain intact');
        assert.deepEqual(await paint(page, 'outside-row'), outside, 'Semantic-looking rows outside conversation navigation remain untouched');
        assert.deepEqual(await paint(page, 'activity-row'), activity, 'Activity navigation remains native');
        assert.deepEqual(await paint(page, 'drop'), drop, 'Drag-and-drop retains its native paint and ring');
        assert.deepEqual(await paint(page, 'file-drop'), fileDrop, 'File drop retains its native paint');
        await page.locator('#inactive-project-menu').click(); await page.mouse.move(770, 620);
        assert.equal(await page.locator('#inactive-project-menu').getAttribute('aria-expanded'), 'true');
        assert.equal((await paint(page, 'inactive-project')).background, currentFeedback[0].expected, 'Clicking the native action button applies the intended open-menu feedback');
        await page.locator('#active-link').click();
        assert.deepEqual(await page.evaluate(() => ({ menus: fixtureMenuClicks, links: fixtureLinkClicks })), { menus: 1, links: 1 });
        if (width === 300 && process.env.WUKONG_SIDEBAR_PREVIEW_DIRECTORY) {
          fs.mkdirSync(process.env.WUKONG_SIDEBAR_PREVIEW_DIRECTORY, { recursive: true });
          await page.evaluate(() => document.activeElement.blur());
          await page.locator('#new-chat').hover();
          const box = await page.locator('#selection-sidebar nav').boundingBox(), lastRow = await page.locator('#selected').boundingBox();
          fs.writeFileSync(path.join(process.env.WUKONG_SIDEBAR_PREVIEW_DIRECTORY, mode + '-sidebar-navigation-hover-fixture-20261113.png'), await page.screenshot({ clip: { ...box, height: lastRow.y + lastRow.height - box.y } }));
        }
        await page.locator('#selection-sidebar').evaluate(e => e.dir = 'rtl');
        const rtlBefore = await geometry(page);
        assert.deepEqual(await paint(page, 'active'), current.active, 'The inset edge and fill are symmetric in RTL');
        assert.deepEqual(await paint(page, 'selected'), current.selected, 'Multi-selection paint is symmetric in RTL');
        await page.locator('#theme-under-test').evaluate((e, css) => e.textContent = css, previousTheme);
        assert.deepEqual(await geometry(page), rtlBefore);
        await page.locator('#theme-under-test').evaluate((e, css) => e.textContent = css, theme);
        await page.emulateMedia({ forcedColors: 'active' });
        const forced = { active: await paint(page, 'active'), selected: await paint(page, 'selected') };
        const forcedNavigation = await navigationHover(page);
        await page.locator('#theme-under-test').evaluate((e, css) => e.textContent = css, primaryOnly.toString());
        assert.deepEqual(await navigationHover(page), forcedNavigation, 'Forced-colors retains native navigation hover');
        await page.locator('#theme-under-test').evaluate((e, css) => e.textContent = css, previousTheme);
        assert.deepEqual(forced, { active: await paint(page, 'active'), selected: await paint(page, 'selected') }, 'Forced-colors retains native selection paint');
        report.push({ mode, width, previous, current, previousFeedback, currentFeedback, oldNavigation, newNavigation, geometryPreserved: true, nativeFocusPreserved: true, nativeDropPreserved: true, forcedColorsPreserved: true, rtlPaintPreserved: true });
      } finally { await page.close(); }
    }
    const reportFile = process.env.WUKONG_SIDEBAR_PREVIEW_DIRECTORY
      ? path.join(process.env.WUKONG_SIDEBAR_PREVIEW_DIRECTORY, 'sidebar-selection.json')
      : new URL('../artifacts/test-runs/native-boundary-20260920/sidebar-selection.json', import.meta.url);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf8');
  } finally { await browser.close(); }
});
