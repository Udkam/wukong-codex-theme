import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { loadQuotaNative, quotaNativeSkip, quotaHtml } from './native-quota-current-helper.mjs';
import { nodes, ownNodes, key, text, prop, nativeFunction } from './native-bundle-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const el = (tag, props) => ({ tag, props });
const one = (items, message) => { assert.equal(items.length,1,message); return items[0]; };
const exportedFunction = (bundle, record, name) => {
  const expression = bundle.exports(record)[name];
  assert.ok(expression, `Native presentation export ${name} changed`);
  const fn = expression.type === 'Identifier' ? ownNodes(record.ast).find(node => node.type === 'FunctionDeclaration' && node.id.name === expression.name) : expression;
  assert.ok(fn, `Native presentation declaration ${name} changed`);
  return nativeFunction(record,fn.start);
};
const walk = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(walk) : [tree,...walk(tree.props?.children)];

let cached;
const loadProfile = () => {
  if (cached) return cached;
  const native = loadQuotaNative(), { bundle,harness } = native;
  const record = one(bundle.findModules(['"data-profile-scroll"','-mt-[var(--height-toolbar)]']), 'Native public profile layout changed');
  const layout = nativeFunction(record,'"data-profile-scroll"');
  const exported = Object.entries(bundle.exports(record)).find(([,value]) => value.name === layout.ast.id.name);
  assert.ok(exported,'The public profile layout must retain its native export');
  const page = exportedFunction(bundle,record,'ProfilePage');
  assert.ok(page.nodes.some(node => node.type === 'ObjectExpression' && prop(node,'Layout')?.name === layout.ast.id.name && prop(node,'redirectToUsername')),
    'ProfilePage must use the actual public layout, independently of ProfileSettings');
  const scrollCall = one(layout.nodes.filter(node => node.type === 'CallExpression' && prop(node.arguments[1],'data-profile-scroll')), 'Native profile scroller changed');
  assert.equal(text(prop(scrollCall.arguments[1],'className')),'@container -mt-[var(--height-toolbar)] min-h-0 flex-1 scrollbar-stable overflow-y-auto');
  const ownerCall = one(layout.nodes.filter(node => node.type === 'CallExpression' && text(prop(node.arguments[1],'className')) ===
    'relative flex h-full min-h-0 min-w-0 flex-1 flex-col bg-surface'), 'Native public profile paint owner changed');
  assert.equal(prop(ownerCall.arguments[1],'data-settings-search-root'),undefined);
  const rootBinding = one(layout.nodes.filter(node => node.type === 'AssignmentExpression' && node.right === ownerCall),'Native profile root association changed');
  const boundary = one(layout.nodes.filter(node => node.type === 'CallExpression' && prop(node.arguments[1],'children')?.name === rootBinding.left.name),
    'Native profile AppShell boundary changed');
  assert.equal(text(prop(boundary.arguments[1],'contentInset')),'default');
  const enabled = prop(boundary.arguments[1],'enabled');
  assert.ok(layout.nodes.some(node => node.type === 'VariableDeclarator' && node.id.name === enabled?.name &&
    node.init.type === 'UnaryExpression' && node.init.operator === '!' && nodes(node.init).some(child => child.type === 'Identifier' && child.name)),
  'The public profile boundary must remain conditional on isTab');
  const imports = bundle.imports(record);
  const headerCall = one(layout.nodes.filter(node => node.type === 'CallExpression' && key(node.arguments[0]?.property) === 'HeaderToolbar'), 'Native profile header toolbar changed');
  const shellNamespace = headerCall.arguments[0].object.object.name;
  const shellRecord = bundle.module(imports[shellNamespace].id);
  const headerRegistry = nodes(shellRecord.ast).find(node => node.type === 'ObjectExpression' && prop(node,'HeaderToolbar'));
  const memo = nodes(prop(headerRegistry,'HeaderToolbar')).find(node => node.type === 'CallExpression' &&
    key(node.callee?.expressions?.at(-1)?.property) === 'memo');
  const headerMember = memo?.arguments[0], headerImport = bundle.imports(shellRecord)[headerMember?.object.name];
  assert.ok(headerImport,'AppShell.HeaderToolbar must retain its real presentation import');
  const headerRecord = bundle.module(headerImport.id), header = exportedFunction(bundle,headerRecord,key(headerMember.property));
  assert.ok(header.nodes.some(node => node.type === 'ObjectExpression' && prop(node,'data-app-shell-header-toolbar')));
  const bodyCall = one(layout.nodes.filter(node => node.type === 'CallExpression' && key(node.arguments[0]?.property) === 'mh'), 'Native profile content wrapper changed');
  const bodyNamespace = bodyCall.arguments[0].object.name, bodyRecord = bundle.module(imports[bodyNamespace].id);
  const body = exportedFunction(bundle,bodyRecord,key(bodyCall.arguments[0].property));
  const card = nativeFunction(bodyRecord,'"surface-QuDOuv"');
  const boundaryNamespace = boundary.arguments[0].object.name, boundaryRecord = bundle.module(imports[boundaryNamespace].id);
  const boundaryFunction = exportedFunction(bundle,boundaryRecord,key(boundary.arguments[0].property));
  assert.ok(!boundaryFunction.nodes.some(node => node.type === 'CallExpression' && typeof node.arguments[0]?.value === 'string'),
    'The AppShell boundary must remain a context-only transport');
  const motionHook = one(layout.nodes.filter(node => node.type === 'CallExpression' &&
    node.callee?.type === 'SequenceExpression' && key(node.callee.expressions.at(-1)?.property) === 'I'), 'Native reduced-motion read changed');
  const motionNamespace = motionHook.callee.expressions.at(-1).object.name;
  const renderHeader = harness.compile(header), renderBody = harness.compile(body), renderCard = harness.compile(card);
  const boundaries = [];
  const renderLayout = harness.compile(layout, {
    [shellNamespace]: { [key(headerCall.arguments[0].object.property)]: { HeaderToolbar: renderHeader } },
    [bodyNamespace]: { [key(bodyCall.arguments[0].property)]: renderBody },
    [boundaryNamespace]: { [key(boundary.arguments[0].property)]: props => { boundaries.push(props); return props.children; } },
    [motionNamespace]: { I: () => true }
  });
  const render = ({isTab=false,scrolled=false,isEditPaneOpen=false} = {}) => {
    const useState = harness.react.useState; let nextState = scrolled;
    assert.equal(layout.nodes.filter(node => node.type === 'CallExpression' &&
      key(node.callee?.expressions?.at(-1)?.property) === 'useState').length,1,'Profile scroll state must retain one native state reader');
    harness.react.useState = value => { assert.equal(value,false); return [scrolled,value => { nextState=value; }]; };
    try {
      const headerContent = el('div',{className:'flex w-full items-center justify-end gap-2',children:[
        native.renderButton({id:'profile-edit',children:'Edit',color:'ghostActive',size:'toolbar'}),
        el('span',{className:'text-secondary',children:'Private'}),
        native.renderButton({id:'profile-share',children:'Share',color:'ghostActive',size:'toolbar'})]});
      const content = [el('div',{id:'fixture-avatar',style:{width:'180px',height:'120px',background:'rgb(240,40,60)',borderRadius:'20px'},children:''}),
        el('h1',{className:'heading-xl text-default',children:'示例个人资料'}),
        el('p',{className:'text-secondary',children:'原生个人资料页组件夹具 · 示例内容，不含账号数据'}),
        renderCard({title:'Token activity · 示例',description:'Synthetic statistics',children:el('div',{id:'profile-card-content',style:{padding:'20px'},children:'24,000 sample tokens'})}),
        el('div',{style:{height:'900px'},children:'Activity · Featured work · 合成展示内容'})];
      const tree = renderLayout({isTab,isEditPaneOpen,header:headerContent,children:content});
      const all = walk(tree), scroll = one(all.filter(node => node.props?.['data-profile-scroll']),'Rendered native profile scroller missing');
      const toolbar = one(all.filter(node => node.props?.['data-app-shell-header-toolbar']),'Rendered real HeaderToolbar missing');
      const headerOwner = tree.props.children[0];
      tree.props.id='profile-owner'; scroll.props.id='profile-scroll'; toolbar.props.id='profile-toolbar'; headerOwner.props.id='profile-header';
      const cardOwner = one(all.filter(node => node.props?.className === 'surface-QuDOuv'),'Rendered native profile card missing'); cardOwner.props.id='profile-card';
      assert.equal(boundaries.at(-1).enabled,!isTab,'Native isTab controls the context boundary');
      return {tree,scroll,headerOwner,nextState:()=>nextState};
    } finally { harness.react.useState=useState; }
  };
  const classes = ['Toolbar-w4tLPD','page-G4NZp3','surface-QuDOuv'];
  const cssAssets = [...new Set([...bundle.baseStylesheets(),...classes.map(name => bundle.stylesheetAssets([name])[0])])];
  assert.ok(cssAssets.every(Boolean),'Native profile/header stylesheets changed');
  cached={...native,record,layout,css:`${bundle.layerOrder}\n${cssAssets.map(asset=>bundle.read(asset)).join('\n')}`,render};
  return cached;
};

test('public profile and tab layouts preserve the native scroll owner, header overlap and reading surface', {skip:quotaNativeSkip}, async () => {
  const native=loadProfile(),browser=await chromium.launch({headless:true});
  try {
    for (const mode of ['dark','light']) for (const isTab of [false,true]) {
      const page=await browser.newPage({viewport:{width:1100,height:900},colorScheme:mode});
      try {
        let rendered=native.render({isTab});
        await page.setContent(`<html data-theme="${mode}" data-codex-os="win32" data-codex-window-type="electron" style="color-scheme:${mode}"><style>${native.css}</style><style>
          body{margin:16px;background:linear-gradient(120deg,#365578,#d5b987)}#stage{height:640px;width:900px;--app-shell-header-height:44px;--height-toolbar:44px}
          #ordinary,#nested-owner{background:var(--color-surface);width:120px;height:50px}#nested-owner [data-profile-scroll]{height:20px}
        </style><div id="stage">${quotaHtml(rendered.tree)}</div><div id="ordinary" class="bg-surface"></div><div id="nested-owner" class="bg-surface"><section><div data-profile-scroll></div></section></div></html>`);
        assert.equal(await page.locator('[data-settings-search-root],[data-settings-panel],main').count(),0,'Public/tab fixtures must not invent a settings or main ancestor');
        const read=()=>page.locator('#stage [id],#ordinary,#nested-owner').evaluateAll(elements=>Object.fromEntries(elements.map(e=>{
          const s=getComputedStyle(e),r=e.getBoundingClientRect();return [e.id,{geometry:[r.x,r.y,r.width,r.height,s.position,s.padding,s.margin,s.borderWidth,s.borderRadius,s.overflow,s.font,s.opacity,s.visibility,s.pointerEvents],
            paint:[s.backgroundColor,s.backgroundImage,s.backdropFilter,s.boxShadow,s.color],tab:e.tabIndex,disabled:e.disabled??null,inert:e.inert}];
        })));
        const material=await page.addStyleTag({content:theme});
        const apply=()=>page.evaluate(mode=>{document.documentElement.classList.add('forge-ink-mountain');Object.assign(document.documentElement.dataset,{forgeNativeTheme:mode,forgeBackgroundReady:'true'});},mode);
        const remove=()=>page.evaluate(()=>document.documentElement.classList.remove('forge-ink-mountain'));
        const scrollTo=async value=>{
          await page.locator('#profile-scroll').evaluate((e,value)=>e.scrollTop=value,value);
          const top=await page.locator('#profile-scroll').evaluate(e=>e.scrollTop);
          rendered.scroll.props.onScroll({currentTarget:{scrollTop:top}});
          rendered=native.render({isTab,scrolled:rendered.nextState()});
          await page.locator('#profile-header').evaluate((e,value)=>e.className=value,rendered.headerOwner.props.className);
          return top;
        };
        for (const top of [0,80,0]) {
          await scrollTo(top); await remove(); const baseline=await read();
          assert.notEqual(baseline['profile-owner'].paint[0],'rgba(0, 0, 0, 0)','Native public profile reproduces the real opaque parent');
          await apply(); const themed=await read();
          for (const id of Object.keys(baseline)) {
            for (const field of ['geometry','tab','disabled','inert']) assert.deepEqual(themed[id][field],baseline[id][field],`${mode}/${isTab}/${top}: ${id} ${field}`);
            if (!['profile-owner','profile-header'].includes(id)) assert.deepEqual(themed[id].paint,baseline[id].paint,`${id} preserves native content/control paint`);
          }
          assert.deepEqual(themed['profile-owner'].paint.slice(0,3),['rgba(0, 0, 0, 0)','none','none']);
          assert.deepEqual(themed['profile-toolbar'].paint.slice(0,3),['rgba(0, 0, 0, 0)','none','none'],'Only the real header backing receives material');
          if (top) {
            assert.match(baseline['profile-header'].paint[0],/0\.8\)/,'Native scroll state owns its 80% backing');
            assert.match(themed['profile-header'].paint[1],/linear-gradient/);
            assert.equal(themed['profile-header'].paint[2],await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--forge-glass-filter').trim()),
              'The scrolled header uses the current dark/light reading material');
            const overlap=await page.evaluate(()=>{
              const h=document.getElementById('profile-header').getBoundingClientRect(),a=document.getElementById('fixture-avatar').getBoundingClientRect();
              const x=(Math.max(h.left,a.left)+Math.min(h.right,a.right))/2,y=(Math.max(h.top,a.top)+Math.min(h.bottom,a.bottom))/2;
              return {x,y,overlaps:a.top<h.bottom&&a.bottom>h.top,headerOwns:!!document.elementFromPoint(x,y)?.closest('#profile-header')};
            });
            assert.ok(overlap.overlaps&&overlap.headerOwns,'Native z-order retains the header above normally scrolling profile content');
            const png=PNG.sync.read(await page.screenshot()),offset=(Math.floor(overlap.y)*png.width+Math.floor(overlap.x))*4;
            assert.notDeepEqual([...png.data.subarray(offset,offset+3)],[240,40,60],'The reading material continues to cover the profile content');
          } else assert.deepEqual(themed['profile-header'].paint,baseline['profile-header'].paint,'At the top and after scrolling back the native header remains transparent');
          await remove(); assert.deepEqual(await read(),baseline,'Theme removal restores native profile/header paint');
        }
        const old=theme.replaceAll('[data-app-shell-main-surface] div[class~="bg-surface"]:has(> [data-profile-scroll])','[data-never-profile-fixture]');
        // Remove only selectors belonging to the actual public owner, retaining
        // the distinct settings-profile rule as a negative control.
        const noPublicOwner=old.replaceAll('div[class~="bg-surface"]:has(> [data-profile-scroll])','div[data-never-profile-fixture]');
        await material.evaluate((e,value)=>e.textContent=value,noPublicOwner); await apply();
        assert.notEqual((await read())['profile-owner'].paint[0],'rgba(0, 0, 0, 0)','The former settings-only adaptation leaves the real public shell opaque');
        await material.evaluate((e,value)=>e.textContent=value,theme);
        const cdp=await page.context().newCDPSession(page);
        for (const [transparency,forced] of [['reduce','none'],['no-preference','active']]) {
          await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:transparency},{name:'forced-colors',value:forced},{name:'prefers-color-scheme',value:mode}]});
          assert.equal(await page.evaluate(value=>matchMedia(value).matches,`(${forced==='active'?'forced-colors: active':'prefers-reduced-transparency: reduce'})`),true);
          await scrollTo(80); await remove(); const fallbackNative=await read(); await apply(); const fallback=await read();
          for(const id of Object.keys(fallbackNative))assert.deepEqual(fallback[id].geometry,fallbackNative[id].geometry,`${id} keeps native fallback geometry`);
          for (const id of ['profile-owner','profile-header']) {
            assert.notEqual(fallback[id].paint[0],'rgba(0, 0, 0, 0)'); assert.equal(fallback[id].paint[1],'none'); assert.equal(fallback[id].paint[2],'none');
          }
        }
        await cdp.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'no-preference'},{name:'forced-colors',value:'none'},{name:'prefers-color-scheme',value:mode}]});
        await scrollTo(0); await apply(); await page.getByRole('button',{name:'Edit',exact:true}).focus();
        assert.equal(await page.locator('#profile-edit').evaluate(e=>e===document.activeElement),true);
        if (process.env.WUKONG_PROFILE_PREVIEW_DIRECTORY&&!isTab) {
          const data='data:image/jpeg;base64,'+fs.readFileSync(new URL('../themes/backgrounds/scenery-01.jpg',import.meta.url)).toString('base64');
          await page.evaluate(async data=>{
            const image=new Image();image.src=data;await image.decode();document.activeElement?.blur();
            document.documentElement.dataset.forgeSurface='thread'; document.body.style.background='none';
            const background=document.createElement('div');background.id='wukong-codex-theme-background';
            const layer=document.createElement('div');layer.dataset.forgeBackgroundLayer='0';layer.dataset.forgeActive='true';
            image.setAttribute('data-forge-background-image','');const veil=document.createElement('div');veil.setAttribute('data-forge-background-veil','');
            layer.append(image,veil);background.append(layer);document.body.prepend(background);
            Object.assign(document.getElementById('stage').style,{position:'relative',zIndex:'1'});
            const avatar=document.getElementById('fixture-avatar');avatar.textContent='示例头像';
            Object.assign(avatar.style,{background:'var(--color-surface-secondary)',color:'var(--color-text-secondary)',display:'grid',placeItems:'center'});
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          },data);
          fs.mkdirSync(process.env.WUKONG_PROFILE_PREVIEW_DIRECTORY,{recursive:true});
          await page.locator('#stage').screenshot({path:path.join(process.env.WUKONG_PROFILE_PREVIEW_DIRECTORY,`${mode}-profile-surface-fixture-20261122.png`)});
        }
      } finally {await page.close();}
    }
  } finally {await browser.close();}
});
