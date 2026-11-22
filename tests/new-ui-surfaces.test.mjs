import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postcss from 'postcss';
import { PNG } from 'pngjs';
import { chromium } from '@playwright/test';
import { makeApplyExpression, ACTIVE_PROBE_EXPRESSION, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import { createRuntimeProvider } from '../runtime/host.mjs';
import { loadNativeBundle, nodes, prop, text } from './native-bundle-current-helper.mjs';
import { loadNativeShell, shellHtml } from './native-shell-current-helper.mjs';

const lock = JSON.parse(fs.readFileSync('docs/native-asar-provenance.json', 'utf8'));
const archive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', lock.packageDirectoryName, lock.asarRelativePath);
const theme = fs.readFileSync('runtime/wukong-codex-theme-background-v13.css', 'utf8');
const asset = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#708090"/></svg>');
const variables = `:root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("${asset}");}`;
const elementTree = (tag, props) => ({ tag, props });

const nativeStyles = (bundle, needles) => {
  const assets = bundle.stylesheetAssets(needles);
  assert.ok(assets.length, `Native styles for ${needles.join('/')} must be re-audited`);
  return `${bundle.layerOrder}\n${[...new Set([...bundle.baseStylesheets(), assets[0]])].map(asset => bundle.read(asset)).join('\n')}`;
};

test('thread footer and embedded messaging clear layout paint without clearing controls', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage();
    await page.setContent(`<html><style>
      .plate,.thread-pane,.messaging-root,.card{background:rgb(255,255,255)}
      .background-fixture{background-image:linear-gradient(white,transparent)}
      .composer-wrap{border-bottom:12px solid white}
      [data-thread-scroll-footer]{position:relative;padding:16px;border-radius:14px}
    </style><div id="root"><div data-thread-scroll-footer="true">
      <div id="plate" aria-hidden="true" class="pointer-events-none plate"></div>
      <div id="card" class="card">Control</div></div>
      <div class="messaging-root messaging-embedded"><div class="thread-pane">
      <div class="composer-wrap"><div data-codex-composer-root>
        <div id="dot-composer-fade" aria-hidden="true" class="pointer-events-none background-fixture combined-fixture"></div>
        <div class="card">Input</div></div></div></div></div>
      <div class="thread-scroll-container"><div id="fade" aria-hidden="true" class="pointer-events-none background-fixture fade-fixture"></div></div>
      <div id="orbit-fade" aria-hidden="true" class="pointer-events-none background-fixture" style="position-anchor:--orbit-messaging-header-fixture"></div>
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
  const bundle = loadNativeBundle({ archive });
  // Discover the actual anchored native leaf. The current client replaced the
  // CSS-module material classes with a utility whose gradient has a native var
  // fallback. Keep rename controls, but bind their paint to this real rule.
  const headers = bundle.findModules(['--orbit-messaging-header-']);
  assert.equal(headers.length, 1, 'Native dots header owner must be re-audited');
  const headerNodes = nodes(headers[0].ast);
  const anchors = new Set(headerNodes.filter(node => node.type === 'VariableDeclarator' &&
    text(node.init).startsWith('--orbit-messaging-header-')).map(node => node.id.name));
  const leaves = headerNodes.filter(node => node.type === 'CallExpression' && text(node.arguments[0]) === 'div')
    .map(node => node.arguments[1]).filter(props => anchors.has(prop(prop(props, 'style'), 'positionAnchor')?.name) &&
      !prop(props, 'children') && prop(props, 'aria-hidden'));
  assert.equal(leaves.length, 1, 'Native dots inert anchored paint leaf must be re-audited');
  const paintClasses = text(prop(leaves[0], 'className')).split(/\s+/);
  const paintTokens = paintClasses.filter(name => name.startsWith('bg-[image:var(--app-shell-content-fade,'));
  assert.equal(paintTokens.length, 1, 'Native dots content-fade utility must be re-audited');
  const floatingClass = paintTokens[0], legacyClass = 'previous-header-material';
  const css = bundle.css(['--app-shell-content-fade']);
  const nativeSelector = '.' + floatingClass.replace(/[^\w-]/g, character => `\\${character}`);
  const gradients = [];
  postcss.parse(css).walkRules(rule => {
    if (rule.selector === nativeSelector && rule.nodes.some(node => node.type === 'decl' &&
      node.prop === 'background-image' && node.value.includes('linear-gradient('))) gradients.push(rule);
  });
  assert.equal(gradients.length, 1, 'Native dots floating header paint must be re-audited');
  const renamedClass = 'future-header-material';
  // Preserve the native nested titlebar-context gradient as well as its base
  // declaration when testing an otherwise unrelated future module rename.
  const renamedPaint = gradients[0].clone({ selector: `.${renamedClass}` }).toString();
  const previousPaint = gradients[0].clone({ selector: `.${legacyClass}` }).toString();
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:760}});
    await page.setContent(`<html data-theme="dark"><style>${css}</style><style>${renamedPaint}${previousPaint}
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
    const widget=path.join(dir,'plugin-suggestion-theme.mjs');
    fs.writeFileSync(widget,'export const widget="first";','utf8');
    fs.writeFileSync(file,'import {widget} from "./plugin-suggestion-theme.mjs"; export const RUNTIME_REVISION="d"; export const makeApplyExpression=()=>widget;','utf8');
    assert.equal((await read()).makeApplyExpression(),'first');
    const beforeWidget=(await read()).SOURCE_FINGERPRINT;
    fs.writeFileSync(widget,'export const widget="updated";','utf8');
    assert.equal((await read()).makeApplyExpression(),'updated');
    assert.notEqual((await read()).SOURCE_FINGERPRINT,beforeWidget);
    fs.writeFileSync(file, 'export const broken=true;', 'utf8');
    await assert.rejects(read(), /missing its revision/);
  } finally { fs.rmSync(dir, { recursive:true }); }
});

test('new native paint hosts keep geometry, sticky corners, tooltip ink and decoded layers', {
  skip: !fs.existsSync(archive) && 'Requires the audited installed ASAR'
}, async () => {
  const bundle = loadNativeBundle({ archive });
  const shell = loadNativeShell({ bundle });
  const backing = shell.backing.render({ sidebarOpen: true, leftInset: 308 });
  backing.props.id = 'paint';
  const frame = shell.frame.render(); frame.props.id = 'layout';
  const frameOpen = shellHtml(frame).slice(0, -'</div>'.length);
  // Bind both classes to the renderer that supplies the sticky semantics and
  // titlebar inset. Generic shell/content names exist in unrelated components.
  const stickyRecords = bundle.findModules(['--app-shell-titlebar-left-inset', 'data-scroll-collapse', 'data-sticky']);
  const stickyFunctions = stickyRecords.flatMap(record => nodes(record.ast).filter(node =>
    node.type === 'FunctionDeclaration' && node !== record.ast && nodes(node).some(child =>
      child.type === 'ObjectExpression' && prop(child, 'data-sticky') && prop(child, 'data-scroll-collapse'))).map(fn => ({ record, fn })));
  assert.equal(stickyFunctions.length, 1, 'Native sticky header renderer must be re-audited');
  const { record: stickyRecord, fn: stickyFunction } = stickyFunctions[0];
  assert.ok(Object.values(bundle.exports(stickyRecord)).some(value => value.type === 'Identifier' && value.name === stickyFunction.id.name),
    'Native sticky header must retain its real renderer export');
  const stickyClass = prefix => {
    const values = [...new Set(nodes(stickyFunction).map(text).filter(value => new RegExp(`^${prefix}-[\\w-]+$`).test(value)))];
    assert.equal(values.length, 1, `Native sticky header ${prefix} class must be re-audited`);
    return values[0];
  };
  const sticky = stickyClass('shell'), stickyContent = stickyClass('content');
  const css = shell.css + '\n' + nativeStyles(bundle, [`.${sticky}[data-sticky]:before`, `.${stickyContent}`]);
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:800}});
    await page.setContent(`<html data-theme="dark" data-codex-window-type="electron"><style>${css}</style><style>
      body{margin:0}:root{--app-shell-titlebar-height:44px;--app-shell-navigation-rail-width:52px;--app-shell-main-surface-top-start-radius:12px;--app-shell-main-surface-top-end-radius:12px}
      #layout{position:relative;height:100vh}#workspace{position:absolute;top:44px;bottom:4px;inset-inline:0}
      aside{position:absolute;top:0;bottom:0;display:flex;width:308px}nav.rail{width:52px}.sidebar-navigation{flex:1;border-radius:12px 0 0 12px}
      main{position:absolute;top:0;bottom:0;left:308px;right:4px;overflow:auto;border-radius:0 12px 4px 0}.rows{height:1400px}
    </style><div id="root">${frameOpen}<div id="workspace" data-app-shell-workspace="true">${shellHtml(backing)}<aside class="app-shell-left-panel" data-app-shell-left-panel-appearance="default"><nav class="rail group/sidebar-rail"></nav><div id="sidebar" class="sidebar-navigation"><div class="sidebar-navigation">Navigation</div></div></aside><main data-app-shell-main-surface="default"><div id="header" class="${sticky}" data-sticky style="--app-shell-titlebar-left-inset:0px"><div class="${stickyContent}"><input id="plugins-store-page-search"></div></div><div class="rows"><div data-thread-find-target="conversation"><div data-message-id="fixture"><div data-markdown-text-style="assistant-message"><p id="stream">Streaming</p></div></div></div></div></main></div></div><div role="tooltip" class="bg-tooltip" style="background:#111;color:white">Tooltip</div></div></html>`);
    const geometry = () => page.evaluate(() => ['paint','sidebar','header'].map(id => {
      const e=document.getElementById(id), r=e.getBoundingClientRect(),s=getComputedStyle(e),p=getComputedStyle(e,'::before');
      return [id,r.x,r.y,r.width,r.height,s.borderRadius,s.position,p.inset,p.borderRadius,p.position];
    }));
    for (const mode of ['light','dark']) for (const width of [720,1280]) {
      await page.evaluate(RESTORE_EXPRESSION);
      await page.setViewportSize({width,height:800});
      await page.evaluate(mode=>{document.documentElement.dataset.theme=mode;document.documentElement.classList.remove('forge-ink-mountain');},mode);
      const before=await geometry();
      await page.evaluate(makeApplyExpression({styleSheet:theme,variables}));
      await page.waitForFunction(ACTIVE_PROBE_EXPRESSION);
      assert.deepEqual(await geometry(),before);
      const paint=await page.evaluate(()=>({
        host:document.getElementById('wukong-codex-theme-background').parentElement.tagName,
        backing:getComputedStyle(document.getElementById('paint')).backgroundColor,
        tooltip:getComputedStyle(document.querySelector('[role=tooltip]')).color,
        tooltipBg:getComputedStyle(document.querySelector('[role=tooltip]')).backgroundColor,
        header:getComputedStyle(document.getElementById('header'),'::before').backdropFilter,
        inner:getComputedStyle(document.querySelector('#sidebar > div')).backgroundColor,
        main:getComputedStyle(document.querySelector('[data-app-shell-main-surface]')).backgroundColor
      }));
      assert.equal(paint.host,'BODY');assert.equal(paint.backing,'rgba(0, 0, 0, 0)');
      assert.equal(paint.tooltip,'rgb(255, 255, 255)');assert.equal(paint.tooltipBg,'rgb(17, 17, 17)');
      assert.equal(paint.header,'blur(12px)');assert.equal(paint.inner,'rgba(0, 0, 0, 0)');
      assert.equal(paint.main,mode==='light'?'rgba(247, 249, 251, 0.9)':'rgba(20, 24, 28, 0.86)');
      await page.evaluate(()=>document.querySelector('main').scrollTop=90);
      await page.evaluate(RESTORE_EXPRESSION);
      const scrolled=await geometry();
      await page.evaluate(makeApplyExpression({styleSheet:theme,variables}));
      await page.waitForFunction(ACTIVE_PROBE_EXPRESSION);
      assert.deepEqual(await geometry(),scrolled);
      await page.evaluate(()=>document.querySelector('main').scrollTop=0);
    }
    await page.evaluate(()=>{
      window.savedOverlay=document.getElementById('wukong-codex-theme-background');
      window.savedImage=savedOverlay.querySelector('[data-forge-active="true"] img');
      window.nativeDecode=HTMLImageElement.prototype.decode;
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
    if (process.env.WUKONG_SHELL_PREVIEW_DIRECTORY) {
      await page.evaluate(() => { HTMLImageElement.prototype.decode = window.nativeDecode; delete window.nativeDecode; });
      const wallpaper = fs.readFileSync(new URL('../themes/backgrounds/scenery-01.jpg', import.meta.url)).toString('base64');
      const previewVariables = variables.replace(asset, `data:image/jpeg;base64,${wallpaper}`);
      await page.evaluate(() => {
        document.getElementById('header').removeAttribute('data-sticky');
        document.getElementById('header').firstElementChild.innerHTML = '<span style="padding:12px 20px;display:block">主区域背景 · 原生组件夹具</span>';
        document.getElementById('sidebar').innerHTML = '<div style="padding:24px 18px"><strong>工作区</strong><p style="margin-top:28px">新建聊天</p><p>示例项目</p><p>最近聊天</p><p style="margin-top:40px;font-size:12px;opacity:.7">合成内容 · 不含聊天记录</p></div>';
        document.querySelector('.rows').innerHTML = '<div data-thread-find-target="conversation" style="padding:28px 36px"><div data-message-id="fixture"><h2 style="font-size:22px">新的工作，从这里开始</h2><p style="margin-top:16px;line-height:1.8">新版主区域使用原生背景节点和布局。<br>主题只替换绘制，保留侧栏缩进、圆角与控件。</p><div style="margin-top:32px;padding:20px;border:1px solid var(--forge-glass-edge);background:var(--forge-glass-fill);border-radius:12px;backdrop-filter:var(--forge-glass-filter)">当前客户端源码 + 示例内容<br><small style="opacity:.75">组件夹具预览，不代表实机页面验收</small></div></div></div>';
        document.querySelector('main').scrollTop = 0;
      });
      fs.mkdirSync(process.env.WUKONG_SHELL_PREVIEW_DIRECTORY, { recursive: true });
      for (const mode of ['dark','light']) {
        await page.evaluate(RESTORE_EXPRESSION);
        await page.evaluate(mode => document.documentElement.dataset.theme = mode, mode);
        await page.evaluate(makeApplyExpression({styleSheet:theme,variables:previewVariables}));
        await page.waitForFunction(ACTIVE_PROBE_EXPRESSION);
        await page.waitForFunction(() => {
          const image = document.querySelector('[data-forge-background-layer][data-forge-active="true"] img');
          return image?.complete && image.naturalWidth > 0 && !window.__wukongCodexThemeRuntimeV13.transitionInFlight;
        });
        assert.equal(await page.locator('main').evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', 'Preview must expose the decoded wallpaper');
        await page.screenshot({ path: path.join(process.env.WUKONG_SHELL_PREVIEW_DIRECTORY, `${mode}-native-shell-fixture-20261122.png`) });
      }
    }
  } finally {await browser.close();}
});

test('mapping-only hot updates move the wallpaper owner and carry a new renderer fingerprint', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wukong-adapter-update-'));
  const file=path.join(dir,'injection-plan-v13.mjs');
  const contract=path.join(dir,'native-ui-contract.mjs');
  fs.copyFileSync('runtime/injection-plan-v13.mjs',file);
  fs.copyFileSync('runtime/plugin-suggestion-theme.mjs',path.join(dir,'plugin-suggestion-theme.mjs'));
  const original=fs.readFileSync('runtime/native-ui-contract.mjs','utf8');
  fs.writeFileSync(contract,original,'utf8');
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<style>section{position:relative;height:600px}.paint{position:absolute;inset:0}main{height:400px}</style><div id="root"><section data-app-shell-page-surface><div id="old-paint" class="paint PageSurface-fixture"></div><div id="new-paint" class="paint" data-proof-paint></div><main data-app-shell-main-surface><h1>Home</h1></main></section></div>');
    const read=createRuntimeProvider(file),first=await read();
    await page.evaluate(first.makeApplyExpression({styleSheet:theme,variables}));
    assert.equal(await page.locator('#wukong-codex-theme-background').evaluate(e=>e.parentElement.id),'old-paint');
    const updated=original.replace(/(pagePaint:\s*)'[^']*'/,"$1'[data-proof-paint]'");
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

test('current shell backing and alternate main pseudo clear only decoded wallpaper paint', {
  skip: !fs.existsSync(archive) && 'Requires the audited installed ASAR'
}, async () => {
  const shell = loadNativeShell({ archive });
  const nativeBacking = shell.backing.render({ sidebarOpen: true, leftInset: 308, trailingSidebar: true });
  nativeBacking.props.id = 'backing';
  const frame = shell.frame.render(); frame.props.id = 'frame';
  const frameOpen = shellHtml(frame).slice(0, -'</div>'.length);
  const wrapper = shell.workspace.renderWrapper({ hasPageSurface: false, unifiedTabs: true,
    children: { tag: 'button', props: { id: 'control', type: 'button', className: 'bg-surface', children: 'Native control' } } });
  wrapper.props.id = 'alternate';
  const decoy = shell.workspace.renderWrapper({ hasPageSurface: false, unifiedTabs: true });
  decoy.props.id = 'nested-decoy';
  decoy.props.children = { tag: 'section', props: { children: decoy.props.children } };
  const outside = shell.backing.render(); outside.props.id = 'outside-backing';
  const oldStyle = postcss.parse(theme);
  let removed = 0;
  oldStyle.walkRules(rule => {
    if (rule.selector.includes('data-app-shell-surface-backing') || rule.selector.includes('electron:before:bg-surface')) {
      rule.remove(); removed++;
    }
  });
  assert.ok(removed, 'The old-owner negative control must remove the current shell paint adaptation');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`<html data-theme="dark" data-codex-window-type="electron"><style>${shell.css}</style><style>
      :root{--color-surface:rgb(24,25,26);--height-toolbar:44px;--radius-xl-base:16px}
      :root[data-theme="light"]{--color-surface:rgb(248,249,250)}
      body{margin:0}#frame{position:relative;height:360px}#workspace{position:relative;height:100%}
      #alternate,#nested-decoy{height:180px;flex:none}#control{margin:12px;padding:8px;border:2px solid #789;border-radius:9px}
      #outside-owner{position:relative;height:60px}
    </style><div id="root">${frameOpen}<div id="workspace" data-app-shell-workspace="true">${shellHtml(nativeBacking)}<main data-app-shell-main-surface="default"></main></div></div>${shellHtml(wrapper)}${shellHtml(decoy)}<div id="outside-owner" data-app-shell-workspace="true">${shellHtml(outside)}</div></div></html>`);
    const capture = () => page.evaluate(() => Object.fromEntries(['backing','alternate','nested-decoy','outside-backing','control'].map(id => {
      const element = document.getElementById(id), rect = element.getBoundingClientRect();
      const style = getComputedStyle(element), before = getComputedStyle(element, '::before');
      return [id, {
        geometry: [rect.x,rect.y,rect.width,rect.height,style.position,style.inset,style.borderRadius,style.padding,style.borderWidth,
          style.font,style.pointerEvents,style.zIndex,before.position,before.inset,before.zIndex,before.pointerEvents,before.content],
        color: style.backgroundColor, image: style.backgroundImage, ink: style.color,
        before: before.backgroundColor
      }];
    })));
    const old = await page.addStyleTag({ content: oldStyle.toString() });
    for (const mode of ['dark','light']) for (const width of [720,1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.evaluate(mode => {
        document.documentElement.classList.add('forge-ink-mountain');
        Object.assign(document.documentElement.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: 'true' });
      }, mode);
      const oldPaint = await capture();
      assert.notEqual(oldPaint.backing.color, 'rgba(0, 0, 0, 0)', 'Previous shell selectors leave the current solid backing opaque');
      assert.notEqual(oldPaint.alternate.before, 'rgba(0, 0, 0, 0)', 'Previous shell selectors leave the actual alternate pseudo opaque');
    }
    await old.evaluate(element => element.remove());
    await page.addStyleTag({ content: theme });
    for (const mode of ['dark','light']) for (const width of [720,1280]) for (const sidebarOpen of [true,false]) {
      await page.setViewportSize({ width, height: 800 });
      const nativeInset = shell.backing.render({ sidebarOpen, leftInset: width < 1000 ? 240 : 308 }).props.style.insetInlineStart;
      await page.evaluate(({ mode, nativeInset }) => {
        const root = document.documentElement;
        root.classList.remove('forge-ink-mountain');
        Object.assign(root.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: 'true' });
        document.getElementById('backing').style.insetInlineStart = nativeInset;
      }, { mode, nativeInset });
      const native = await capture();
      await page.evaluate(() => {
        document.documentElement.dataset.forgeBackgroundReady = 'false';
        document.documentElement.classList.add('forge-ink-mountain');
      });
      const waiting = await capture();
      assert.equal(waiting.backing.color, native.backing.color, 'Undecoded wallpaper retains native backing');
      assert.equal(waiting.alternate.before, native.alternate.before, 'Undecoded wallpaper retains native pseudo');
      await page.evaluate(() => document.documentElement.dataset.forgeBackgroundReady = 'true');
      const themed = await capture();
      for (const id of Object.keys(native)) assert.deepEqual(themed[id].geometry, native[id].geometry, `${mode}/${width}/${sidebarOpen}: ${id} geometry remains native`);
      assert.equal(themed.backing.color, 'rgba(0, 0, 0, 0)');
      assert.equal(themed.alternate.before, 'rgba(0, 0, 0, 0)');
      for (const id of ['nested-decoy','outside-backing','control']) assert.deepEqual(themed[id], native[id], `${id} is not the current shell paint owner`);
      await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
      assert.deepEqual(await capture(), native, 'Theme removal restores native backing and pseudo paint');
    }
  } finally { await browser.close(); }
});

test('current main and viewer header fades retain native visibility, geometry and controls', {
  skip: !fs.existsSync(archive) && 'Requires the audited installed ASAR'
}, async () => {
  const shell = loadNativeShell({ archive });
  const mainFade = shell.fades.main.render(); mainFade.props.id = 'main-fade';
  const viewerFade = shell.fades.viewer.render(); viewerFade.props.id = 'viewer-fade';
  const outside = shell.fades.main.render(); outside.props.id = 'outside-fade';
  const ordinary = shell.fades.viewer.render(); ordinary.props.id = 'ordinary-header-fade';
  const interactive = shell.fades.main.render();
  Object.assign(interactive.props, { id: 'interactive', 'aria-hidden': 'false', children: 'Native action' });
  const nonempty = shell.fades.main.render();
  Object.assign(nonempty.props, { id: 'nonempty', children: { tag: 'button', props: { type: 'button', children: 'Native action' } } });
  const nativeStyle = postcss.parse(theme); let removed = 0;
  nativeStyle.walkRules(rule => {
    if (rule.selector.includes('--app-shell-content-fade') || rule.selector.includes('data-viewer-content-fade')) { rule.remove(); removed++; }
  });
  assert.ok(removed, 'The old-header negative control must remove the current fade adaptation');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.setContent(`<html data-theme="dark" data-codex-window-type="electron"><style>${shell.css}</style><style>
      :root{--color-surface:rgb(24,25,26)}:root[data-theme="light"]{--color-surface:rgb(248,249,250)}
      body{margin:0}.fixture-area{position:relative;height:140px;width:100%;isolation:isolate}
      #interactive,#nonempty{top:70px}button{padding:8px;border:2px solid #789;border-radius:9px;background:#456;color:#fff}
    </style><div id="root"><main class="fixture-area" data-app-shell-main-surface="default">${shellHtml(mainFade)}${shellHtml(interactive)}${shellHtml(nonempty)}</main>
      <header class="fixture-area" data-testid="viewer-header" data-viewer-content-fade="true">${shellHtml(viewerFade)}<button id="viewer-control">Native toolbar action</button></header>
      <header class="fixture-area">${shellHtml(ordinary)}</header><div class="fixture-area">${shellHtml(outside)}</div></div></html>`);
    const capture = () => page.evaluate(() => Object.fromEntries(['main-fade','viewer-fade','outside-fade','ordinary-header-fade','interactive','nonempty','viewer-control'].map(id => {
      const e = document.getElementById(id), r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return [id, { geometry: [r.x,r.y,r.width,r.height,s.position,s.inset,s.borderRadius,s.borderWidth,s.padding,s.font,
        s.opacity,s.visibility,s.display,s.pointerEvents,s.zIndex,s.transitionProperty,s.transitionDuration],
        image:s.backgroundImage,paint:[s.backgroundColor,s.color,s.boxShadow,s.backdropFilter] }];
    })));
    const old = await page.addStyleTag({ content: nativeStyle.toString() });
    await page.evaluate(() => {
      document.documentElement.classList.add('forge-ink-mountain');
      Object.assign(document.documentElement.dataset, { forgeBackgroundReady: 'true', forgeNativeTheme: 'dark' });
    });
    const previous = await capture();
    assert.match(previous['main-fade'].image, /linear-gradient\(/, 'Previous selectors leave the source main top fade opaque');
    assert.match(previous['viewer-fade'].image, /linear-gradient\(/, 'Previous selectors leave the source viewer header fade opaque');
    await old.evaluate(element => element.remove());
    await page.addStyleTag({ content: theme });
    for (const mode of ['dark','light']) for (const width of [720,1280]) for (const visible of [true,false]) for (const hidden of [true,false]) {
      await page.setViewportSize({ width, height: 800 });
      const render = shell.fades.main.render({ visible, hidden });
      await page.evaluate(({ mode, render }) => {
        document.documentElement.classList.remove('forge-ink-mountain');
        Object.assign(document.documentElement.dataset, { theme: mode, forgeNativeTheme: mode, forgeBackgroundReady: 'true' });
        const fade = document.getElementById('main-fade'); fade.className = render.props.className; fade.hidden = render.props.hidden;
      }, { mode, render });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const native = await capture();
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      const themed = await capture();
      for (const id of Object.keys(native)) {
        assert.deepEqual(themed[id].geometry, native[id].geometry, `${mode}/${width}/${visible}/${hidden}: ${id} keeps native layout and visibility`);
        assert.deepEqual(themed[id].paint, native[id].paint, `${id} changes no native ink, fill or filter`);
      }
      for (const id of ['main-fade','viewer-fade']) assert.equal(themed[id].image, 'none', `${id} clears only its decorative fade`);
      for (const id of ['outside-fade','ordinary-header-fade','interactive','nonempty','viewer-control']) assert.equal(themed[id].image, native[id].image, `${id} retains native paint`);
      await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
      assert.deepEqual(await capture(), native, 'Theme removal restores native header fades');
    }
  } finally { await browser.close(); }
});

test('actual native window frames shed layered tint only when wallpaper is ready', {
  skip: !fs.existsSync(archive) && 'Requires the audited installed ASAR'
}, async () => {
  const shell = loadNativeShell({ archive });
  const frame = (id, hasPageSurface, children) => {
    const result = shell.frame.render({ hasPageSurface, children }); result.props.id = id; return result;
  };
  const backing = shell.backing.render({ leftInset: 64 }); backing.props.id = 'frame-backing';
  const backed = frame('backed-frame', true, elementTree('div', { 'data-app-shell-workspace': true, className: 'fixture-workspace', children: [backing,
    elementTree('button', { id: 'frame-control', type: 'button', className: 'bg-surface', children: 'Native control' })] }));
  const plain = frame('plain-frame', false, elementTree('main', { 'data-app-shell-main-surface': 'default' }));
  const retained = frame('retained-frame', true, null);
  const previousStyle = postcss.parse(theme); let removed = 0;
  previousStyle.walkRules(rule => {
    if (rule.selector.includes('data-forge-background-ready') && rule.selector.includes('[data-app-shell-frame]') &&
      rule.nodes.some(node => node.type === 'decl' && node.prop === 'background-image' && node.value === 'none')) {
      rule.remove(); removed++;
    }
  });
  assert.equal(removed, 1, 'Negative control removes only the current window-frame paint replacement');
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 800 } });
    await page.setContent(`<html data-theme="dark" data-appearance-preset="codex" data-codex-os="win32" data-codex-window-type="electron"><style>${shell.css}</style><style>
      body{margin:0}#known-image{position:fixed;inset:0;z-index:0;background:rgb(64,96,128)}#root{position:relative;z-index:1}
      #backed-frame,#plain-frame{height:180px;flex:none}.fixture-workspace{position:relative;height:100%}
      #frame-control{position:absolute;top:16px;left:12px;padding:8px;border-radius:8px;border:2px solid #789}
      #frame-decoy{width:80px;height:40px;background:rgba(10,20,30,.7)}
    </style><div id="known-image"></div><div id="root">${[backed,plain].map(shellHtml).join('')}<div id="retained-page" data-app-shell-active-page="false" hidden>${shellHtml(retained)}</div><div id="frame-decoy"></div></div></html>`);
    const capture = () => page.evaluate(() => Object.fromEntries(['backed-frame','plain-frame','retained-frame','frame-backing','frame-control','frame-decoy'].map(id => {
      const e = document.getElementById(id), r = e.getBoundingClientRect(), s = getComputedStyle(e), a = getComputedStyle(e, '::after');
      return [id, { rect:[r.x,r.y,r.width,r.height], geometry:[s.position,s.inset,s.borderRadius,s.padding,s.borderWidth,s.font,s.opacity,s.display,s.visibility,s.pointerEvents],
        fill:s.backgroundColor,image:s.backgroundImage,ink:s.color,filter:[s.filter,s.backdropFilter],
        after:[a.content,a.position,a.inset,a.borderRadius,a.boxShadow,a.zIndex,a.pointerEvents] }];
    })));
    const alpha = color => page.evaluate(color => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0,0,1,1); return context.getImageData(0,0,1,1).data[3]/255;
    }, color);
    const pixel = async () => {
      const png = PNG.sync.read(await page.screenshot()); return [...png.data.subarray((80*png.width+png.width-32)*4,(80*png.width+png.width-32)*4+3)];
    };
    const style = await page.addStyleTag({ content: previousStyle.toString() });
    for (const mode of ['dark','light']) {
      await page.emulateMedia({ colorScheme: mode });
      await page.evaluate(mode => {
        document.documentElement.style.colorScheme = mode;
        document.documentElement.classList.add('forge-ink-mountain');
        Object.assign(document.documentElement.dataset, { theme:mode,forgeNativeTheme:mode,forgeBackgroundReady:'true' });
      }, mode);
      const old = await capture();
      assert.match(old['backed-frame'].image,/linear-gradient\(/, 'Old selectors leave the native docked gradient above the wallpaper');
      assert.ok(Math.abs(await alpha(old['backed-frame'].fill)-(mode==='dark'?.8:.85)) <= 1/255,
        'Old selectors leave the native 80%/85% window fill');
      const gradientColor = await page.locator('#backed-frame').evaluate(frame => {
        const probe = document.createElement('span'); probe.style.backgroundColor='var(--app-shell-sidebar-docked-background)';
        frame.append(probe); const color=getComputedStyle(probe).backgroundColor; probe.remove(); return color;
      });
      assert.ok(Math.abs(await alpha(gradientColor)-.65)<=1/255,'The native gradient adds its independent 65% docked tint');
      assert.notDeepEqual(await pixel(),[64,96,128], 'Clearing the child backing alone still changes wallpaper contrast');
    }
    await style.evaluate((element, content) => element.textContent = content, theme);
    for (const mode of ['dark','light']) for (const width of [720,1280]) {
      await page.setViewportSize({ width, height:800 }); await page.emulateMedia({ colorScheme:mode });
      await page.evaluate(mode => {
        document.documentElement.classList.remove('forge-ink-mountain'); document.documentElement.style.colorScheme=mode;
        Object.assign(document.documentElement.dataset,{ theme:mode,forgeNativeTheme:mode,forgeBackgroundReady:'true' });
      }, mode);
      const native = await capture();
      assert.equal(native['backed-frame'].after[4],'none'); // The separate backing owns the hairline.
      assert.notEqual(native['frame-backing'].after[4],'none','The genuine frame enables its native backing hairline');
      await page.evaluate(() => {
        document.documentElement.classList.add('forge-ink-mountain'); document.documentElement.dataset.forgeBackgroundReady='false';
      });
      const waiting = await capture();
      for (const id of ['backed-frame','plain-frame','retained-frame']) {
        assert.equal(waiting[id].fill,native[id].fill); assert.equal(waiting[id].image,native[id].image);
      }
      await page.evaluate(() => document.documentElement.dataset.forgeBackgroundReady='true');
      const themed = await capture();
      for (const id of Object.keys(native)) {
        for (const field of ['rect','geometry','after','ink','filter']) assert.deepEqual(themed[id][field],native[id][field],`${mode}/${width}: ${id} ${field} stays native`);
      }
      for (const id of ['backed-frame','retained-frame']) {
        assert.equal(themed[id].fill,'rgba(0, 0, 0, 0)'); assert.equal(themed[id].image,'none');
      }
      for (const id of ['plain-frame','frame-control','frame-decoy']) assert.deepEqual(themed[id],native[id],`${id} retains native material`);
      assert.deepEqual(themed['retained-frame'].rect,[0,0,0,0],'Retained hidden pages remain hidden');
      assert.deepEqual(await pixel(),[64,96,128],'The ready frame adds no tint above the known wallpaper');
      await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
      assert.deepEqual(await capture(),native,'Removing the theme restores the complete native frame material');
    }
  } finally { await browser.close(); }
});
