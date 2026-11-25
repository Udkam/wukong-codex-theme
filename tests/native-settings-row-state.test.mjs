import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { loadNativeBundle, nodes, ownNodes, key, text, prop, nativeFunction, nativeObject, presentationHarness } from './native-bundle-current-helper.mjs';

const theme=fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css',import.meta.url),'utf8');
const one=(values,message)=>{assert.equal(values.length,1,message);return values[0];};
const element=(tag,props)=>({tag,props});
const walk=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(walk):[tree,...walk(tree.props?.children)];
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const html=tree=>{
  if(tree==null||tree===false)return '';if(Array.isArray(tree))return tree.map(html).join('');if(typeof tree!=='object')return escape(tree);
  const {tag,props}=tree;if(tag==='#fragment')return html(props.children);
  const svgNames={strokeWidth:'stroke-width',strokeLinecap:'stroke-linecap',strokeLinejoin:'stroke-linejoin',fillRule:'fill-rule',clipRule:'clip-rule'};
  const attributes=Object.entries(props).filter(([name,value])=>!['children','style','ref','dangerouslySetInnerHTML'].includes(name)&&!name.startsWith('on')&&value!=null&&
    (value!==false||/^(?:aria-|data-)/.test(name))).map(([name,value])=>`${name==='className'?'class':svgNames[name]||name}="${escape(value===true?'true':value)}"`).join(' ');
  const style=Object.entries(props.style||{}).map(([name,value])=>`${name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${value}`).join(';');
  return `<${tag} ${attributes}${style?` style="${escape(style)}"`:''}>${props.dangerouslySetInnerHTML?.__html??html(props.children)}</${tag}>`;
};
const hookMember=call=>call?.callee?.type==='SequenceExpression'?call.callee.expressions.at(-1):call?.callee;

let cached;
const loadRows=()=>{
  if(cached)return cached;const bundle=loadNativeBundle();
  const row=one(bundle.findModules(['highlightOnFocus','"group w-full items-center"']),'Native clickable settings row changed');
  const clickableExport=one(Object.entries(bundle.exports(row)).filter(([,fn])=>nodes(fn).some(node=>text(node)==='group w-full items-center')),'Clickable row presentation export changed')[0];
  const wrapperCandidates=bundle.findModules(['"AWNZ"','searchAnchor:','entry:']);
  const metadata=one(bundle.findModules(['id:"security-linked-apps"']),'Current settings entry metadata changed');
  const entryNode=one(nodes(metadata.ast).filter(node=>node.type==='ObjectExpression'&&text(prop(node,'id'))==='security-linked-apps'),'Current settings entry entry changed');
  const title=one(nodes(metadata.ast).filter(node=>node.type==='ObjectExpression'&&text(prop(node,'id'))==='settings.chatGpt.security.overview.linkedApps.title'),'Current settings entry title changed');
  const entry={section:text(prop(entryNode,'section')),id:text(prop(entryNode,'id')),title:nativeObject(metadata,title)};
  const callers=bundle.findModules([`"${metadata.id}"`]);
  const calls=callers.flatMap(record=>nodes(record.ast).filter(node=>node.type==='CallExpression'&&
    wrapperCandidates.some(candidate=>candidate.id===bundle.imports(record)[node.arguments[0]?.object?.name]?.id)&&
    prop(node.arguments[1],'entry')?.object?.type==='MemberExpression'&&
    bundle.imports(record)[prop(node.arguments[1],'entry').object.object.name]?.id===metadata.id&&
    key(prop(node.arguments[1],'entry').property)==='linkedApps'&&
    text(prop(node.arguments[1],'edgeRounding'))==='surface').map(call=>({record,call})));
  const caller=one(calls,'Current settings entry must retain its actual surface-rounded caller');
  // The former Custom rules entry is absent in this client. Preserve the same
  // generic Row feedback coverage through the current real linked-apps caller.
  const entryReference=prop(caller.call.arguments[1],'entry');
  const registryExport=bundle.exports(metadata)[key(entryReference.object.property)];
  const registry=registryExport?.type==='Identifier'?ownNodes(metadata.ast).find(node=>node.type==='VariableDeclarator'&&node.id.name===registryExport.name)?.init:registryExport;
  assert.equal(prop(registry,key(entryReference.property)),entryNode,'The actual caller must resolve to this exact metadata entry through its exported registry');
  const wrappers=bundle.module(bundle.imports(caller.record)[caller.call.arguments[0].object.name].id),wrapperExport=key(caller.call.arguments[0].property);
  assert.ok(nodes(bundle.exports(wrappers)[wrapperExport]).some(node=>node.type==='CallExpression'&&key(node.arguments[0]?.property)===clickableExport),
    'The actual settings entry wrapper must use the native clickable row');
  assert.ok(prop(caller.call.arguments[1],'onClick'));
  for(const name of ['variant','highlightOnFocus','ariaExpanded'])assert.equal(prop(caller.call.arguments[1],name),undefined);
  const history=one(bundle.findModules(['settings.import.history.latestTitle','aria-expanded']),'Native import history renderer changed');
  const triggerCall=one(nodes(history.ast).filter(node=>node.type==='CallExpression'&&text(node.arguments[0])==='button'&&
    prop(node.arguments[1],'aria-controls')&&prop(node.arguments[1],'aria-expanded')&&text(prop(node.arguments[1],'className')).includes('hover:bg-secondary-ghost-hover')),
  'Native import trigger changed');
  const trigger=nativeFunction(history,triggerCall.start);
  const importCaller=one(nodes(history.ast).filter(node=>node.type==='CallExpression'&&node.arguments[0]?.name===trigger.ast.id.name&&
    prop(node.arguments[1],'expanded')&&prop(node.arguments[1],'onClick')&&prop(node.arguments[1],'icon')),'Actual import history trigger consumer changed');
  const item=nativeFunction(history,importCaller.start);
  const click=prop(importCaller.arguments[1],'onClick');
  const clickDefinition=one(item.nodes.filter(node=>node.type==='AssignmentExpression'&&node.left.name===click.name&&node.right.type==='ArrowFunctionExpression'),'Import click state association changed');
  const clickBody=clickDefinition.right.body;
  if(clickBody.type==='BlockStatement')assert.equal(clickBody.body.length,1,'The native import click only toggles expansion');
  const setterCall=clickBody.type==='BlockStatement'?clickBody.body[0].expression:clickBody;
  assert.equal(setterCall.type,'CallExpression');
  const updater=one(ownNodes(history.ast).filter(node=>node.type==='FunctionDeclaration'&&node.id.name===setterCall.arguments[0]?.name),'Native import expansion updater changed');
  assert.equal(updater.body.body[0].argument.operator,'!');assert.equal(updater.body.body[0].argument.argument.name,updater.params[0].name);
  assert.ok(item.nodes.some(node=>node.type==='VariableDeclarator'&&node.id.type==='ArrayPattern'&&node.id.elements[1]?.name===setterCall.callee.name&&key(hookMember(node.init)?.property)==='useState'),
    'Import expanded is state, not a selected fill');
  const expand=one(bundle.findModules(['"bZug"','contentId:','expanded:']).filter(record=>record.source.length<1000),'Native import expansion wrapper changed');
  const expandExport=one(Object.entries(bundle.exports(expand)).filter(([,fn])=>nodes(fn).some(node=>node.type==='ConditionalExpression')),'Native expansion export changed')[0];
  const divider=one(Object.values(bundle.imports(expand)).map(ref=>bundle.module(ref.id)).filter(record=>Object.values(bundle.exports(record)).some(value=>text(value).includes('after:inset-x-4'))),'Native divider owner changed');
  const dividerClass=one(Object.values(bundle.exports(divider)).map(text).filter(value=>value.includes('after:inset-x-4')),'Native divider class changed');
  assert.ok(dividerClass.includes('after:pointer-events-none')&&dividerClass.includes('after:h-px'));
  const card=one(bundle.findModules(['--settings-surface-background','recommendation']),'Native SettingsCard changed');
  const cardExport=Object.keys(bundle.exports(card))[0];
  const iconModules=['ESTr','ZWS5','RyCm','Y62k','HOLv','gT86','yX0s','GCsp','lCMb','UxN3','FyDI'];
  const harness=presentationHarness(bundle,[row.id,wrappers.id,expand.id,divider.id,card.id,...iconModules]);
  const renderEntry=harness.load(wrappers.id)[wrapperExport],renderTrigger=harness.compile(trigger),renderExpand=harness.load(expand.id)[expandExport],renderCard=harness.load(card.id)[cardExport];
  const customArrowCall=one(nodes(prop(caller.call.arguments[1],'trailing')).filter(node=>node.type==='CallExpression'&&key(node.arguments[0]?.property)==='uM3'),'Actual current settings entry chevron call changed');
  const iconRecord=bundle.module(bundle.imports(caller.record)[customArrowCall.arguments[0].object.name].id);
  const iconAlias=bundle.exports(iconRecord)[key(customArrowCall.arguments[0].property)];
  const iconFactory=ownNodes(iconRecord.ast).find(node=>node.type==='VariableDeclarator'&&node.id.name===iconAlias.name)?.init;
  assert.equal(iconFactory?.type,'CallExpression');
  const factoryMember=hookMember(iconFactory),presetMember=iconFactory.arguments[0];
  const factoryImport=bundle.imports(iconRecord)[factoryMember.object.name],presetImport=bundle.imports(iconRecord)[presetMember.object.name];
  const preset=harness.load(presetImport.id)[key(presetMember.property)];
  assert.equal(preset.name,'chevron-right-md-light-16');assert.deepEqual([preset.canvas.width,preset.canvas.height],[16,16]);
  const CustomArrow=harness.load(factoryImport.id)[key(factoryMember.property)](preset);
  const defaultIconBinding=prop(importCaller.arguments[1],'control');
  const defaultIconCall=one(item.nodes.filter(node=>node.type==='AssignmentExpression'&&node.left.name===defaultIconBinding.name&&node.right.type==='CallExpression'),'Native Import chevron binding changed').right;
  const defaultIconImport=bundle.imports(history)[defaultIconCall.arguments[0].object.name];
  const ImportArrow=harness.load(defaultIconImport.id)[key(defaultIconCall.arguments[0].property)];
  const importArrowClass=one(item.nodes.map(text).filter(value=>value.startsWith('icon-2xs text-tertiary transition-transform')),'Native Import chevron classes changed');
  const nestedCall=one(nodes(history.ast).filter(node=>node.type==='CallExpression'&&node.arguments[0]?.name===trigger.ast.id.name&&text(prop(node.arguments[1],'variant'))==='nested'),'Native nested Import call changed');
  const nested=nativeFunction(history,nestedCall.start);
  const nestedIconCall=one(nested.nodes.filter(node=>node.type==='CallExpression'&&prop(node.arguments[1],'asset16')&&prop(node.arguments[1],'legacyIcon')),'Native nested icon branches changed');
  const nestedImport=bundle.imports(history)[nestedIconCall.arguments[0].object.name],asset=prop(nestedIconCall.arguments[1],'asset16'),legacy=prop(nestedIconCall.arguments[1],'legacyIcon');
  const NestedArrow=harness.load(nestedImport.id)[key(nestedIconCall.arguments[0].property)];
  const nestedPreset=harness.load(bundle.imports(history)[asset.object.name].id)[key(asset.property)];
  const LegacyArrow=harness.load(bundle.imports(history)[legacy.object.name].id)[key(legacy.property)];
  const nestedArrowClass=one(nested.nodes.map(text).filter(value=>value.startsWith('shrink-0 text-tertiary transition-transform')),'Nested chevron classes changed');
  const loading=bundle.module('RNul'),loadingFunction=nativeFunction(loading,bundle.exports(loading).y.start);
  const inertRefs=Object.fromEntries(ownNodes(loading.ast).filter(node=>node.type==='FunctionDeclaration'&&node!==loading.ast).map(node=>[node.id.name,()=>{}]));
  const renderLoading=harness.compile(loadingFunction,inertRefs);
  const markArrow=(tree,kind,id=kind)=>{walk(tree).filter(node=>node.tag==='svg').forEach((node,index)=>Object.assign(node.props,{id:`${id}-arrow${kind==='nested'?'-'+index:''}`,'data-fixture-arrow':kind}));return tree;};
  const customClick=function(){window.fixtureCustomClicks++;};
  const importClick=function(){return window.fixtureToggleImport();};
  const custom=(id=entry.id,disabled=false,{pending=false,count=3}={})=>{
    const spinner=pending?renderLoading({className:'icon-xs',Icon:harness.load('FyDI').A}):null;
    if(spinner){spinner.props.id='custom-loading';walk(spinner).filter(node=>node.tag==='svg').forEach(node=>node.props.id='custom-loading-svg');}
    const tree=renderEntry({entry:{...entry,id,title:disabled?{localizedText:'Disabled fixture'}:entry.title},edgeRounding:'surface',disabled,
      description:'Manage permissions and global rules',trailing:[spinner,!pending&&count>0?String(count):null,markArrow(CustomArrow({}),'custom',id)],onClick:customClick});
    const button=one(walk(tree).filter(node=>node.tag==='button'),'Native settings-entry button missing');button.props.id=id+'-button';
    assert.equal(button.props.onClick,customClick,'The native entry must preserve its caller click handler');
    return tree;
  };
  const imported=(expanded,id='import-toggle',variant)=>{
    const contentId=variant==='nested'?'import-history-fixture-category':'import-history-fixture';
    const control=variant==='nested'?element('div',{className:'flex shrink-0 items-center gap-3 whitespace-nowrap',children:[
      element('span',{id:'nested-result-count',className:'text-secondary',children:'2 imported'}),
      markArrow(NestedArrow({asset16:nestedPreset,legacyIcon:LegacyArrow,legacyClassName:text(prop(nestedIconCall.arguments[1],'legacyClassName')),
        className:nestedArrowClass+(expanded?' rotate-90':''),'aria-hidden':false}),'nested')
    ]}):markArrow(ImportArrow({'aria-hidden':true,className:importArrowClass+(expanded?' rotate-180':'')}),'import');
    const tree=renderTrigger({contentId,expanded,variant,label:variant==='nested'?'Imported items':'Import',description:'Synthetic completed import',
      control,onClick:importClick});
    tree.props.id=id;assert.equal(tree.props.onClick,importClick,'Native import trigger forwards its click handler');
    return tree;
  };
  const importTree=expanded=>{
    const nested=imported(false,'nested-toggle','nested');
    return renderExpand({contentId:'import-history-fixture',expanded,children:imported(expanded),content:[nested,
      element('div',{className:'px-4 py-3 text-secondary',children:'Example import results · no account data'})]});
  };
  const toggle=new Function(`return (${history.source.slice(updater.start,updater.end)});`)();
  cached={bundle,css:bundle.css(),entry,custom,imported,importTree,renderCard,customClick,importClick,toggle};return cached;
};

test('native settings row feedback follows hover and keyboard focus without turning expansion into selection',async()=>{
  const native=loadRows(),old=postcss.parse(theme);let removed=0;
  old.walkRules(rule=>{if(rule.selector.includes('[data-settings-panel]')&&rule.selector.includes('import-history-')){rule.remove();removed++;}});
  assert.equal(removed,2,'Remove only the settings-row idle and interaction feedback rules');
  const browser=await chromium.launch({headless:true});
  try{
    for(const mode of ['dark','light'])for(const scope of ['data-settings-panel','data-settings-search-root']){
      const page=await browser.newPage({viewport:{width:1100,height:850},colorScheme:mode,reducedMotion:'no-preference'});
      try{
        const card=children=>native.renderCard({variant:scope==='data-settings-panel'?'default':'rows',children});
        const tree=native.importTree(false);tree.props.id='import-wrapper';
        await page.setContent(`<html data-theme="${mode}" data-codex-os="win32" data-codex-window-type="electron" style="color-scheme:${mode}"><style>${native.css}</style><style>
          body{margin:20px;background:linear-gradient(120deg,#36516b,#a2b4bc)}#fixture-scope{width:640px}.group\/settings{display:grid;gap:16px}
          #outside{margin-top:24px;width:640px}button[data-start]{padding:3px;font-size:11px}#ordinary{padding:14px}
        </style><div id="fixture-scope" ${scope}="true"><div class="group/settings" data-density="default"><p class="text-secondary">原生设置行组件夹具 · 示例内容</p><button id="before-custom" data-start>Keyboard start</button>
          ${html(card([native.custom(),native.custom('disabled-row',true)]))}<button id="before-import" data-start>Keyboard start</button>${html(card(tree))}
          <button id="ordinary" class="hover:bg-secondary-ghost-hover">Unrelated button</button></div></div><div id="outside">${html(native.custom('outside-row'))}</div></html>`);
        await page.exposeFunction('fixtureImportPresentation',expanded=>{
          const expandedTree=native.importTree(expanded),arrow=walk(expandedTree).find(node=>node.props?.id==='import-arrow');
          return {expanded:expandedTree.props.children[0].props['aria-expanded'],arrowClass:arrow.props.className,content:html(expandedTree.props.children[1])};
        });
        await page.evaluate(({custom,imported,toggle})=>{
          window.fixtureCustomClicks=0;window.fixtureImportClicks=0;window.fixtureExpanded=false;window.fixtureToggle=eval('('+toggle+')');
          window.fixtureToggleImport=async()=>{
            window.fixtureImportClicks++;window.fixtureExpanded=window.fixtureToggle(window.fixtureExpanded);
            const next=await window.fixtureImportPresentation(window.fixtureExpanded),root=document.getElementById('import-wrapper');
            document.getElementById('import-toggle').setAttribute('aria-expanded',String(next.expanded));
            document.getElementById('import-arrow').setAttribute('class',next.arrowClass);
            document.getElementById('import-history-fixture')?.remove();if(next.content)root.insertAdjacentHTML('beforeend',next.content);
          };
          document.getElementById('security-linked-apps-button').onclick=eval('('+custom+')');
          document.getElementById('import-toggle').onclick=eval('('+imported+')');
        },{custom:native.customClick.toString(),imported:native.importClick.toString(),toggle:native.toggle.toString()});
        const style=await page.addStyleTag({content:old.toString()});
        const apply=()=>page.evaluate(mode=>{document.documentElement.classList.add('forge-ink-mountain');document.documentElement.dataset.forgeNativeTheme=mode;},mode);
        const remove=()=>page.evaluate(()=>document.documentElement.classList.remove('forge-ink-mountain'));
        const reset=async()=>{await page.mouse.move(1000,800);await page.evaluate(()=>document.activeElement?.blur());};
        const settleArrows=()=>page.locator('#fixture-scope [data-fixture-arrow]').evaluateAll(elements=>Promise.all(elements.flatMap(e=>
          e.getAnimations().filter(a=>Number.isFinite(a.effect?.getTiming().iterations)).map(a=>a.finished.catch(()=>{})))));
        const capture=async()=>{await settleArrows();return page.locator('#fixture-scope,#fixture-scope *,#outside,#outside *').evaluateAll(elements=>Object.fromEntries(elements.map((e,index)=>{
          const s=getComputedStyle(e),r=e.getBoundingClientRect(),owner=e.closest('[data-settings-search-entry].group,button[aria-controls^="import-history-"]');
          const loading=e.closest('[data-loading-indicator]'),spinning=!!loading&&s.animationName.split(',').map(v=>v.trim()).includes('spin');
          let localBox=r;
          if(loading&&e instanceof SVGGraphicsElement)localBox=e.getBBox();
          else if(loading){
            const width=parseFloat(s.width)+(s.boxSizing==='border-box'?0:parseFloat(s.paddingLeft)+parseFloat(s.paddingRight)+parseFloat(s.borderLeftWidth)+parseFloat(s.borderRightWidth));
            const height=parseFloat(s.height)+(s.boxSizing==='border-box'?0:parseFloat(s.paddingTop)+parseFloat(s.paddingBottom)+parseFloat(s.borderTopWidth)+parseFloat(s.borderBottomWidth));
            // Rotation changes the physical axis-aligned bounds, not the native
            // centered layout box. Preserve viewport position without pausing it.
            localBox={x:Math.round((r.x+r.width/2-width/2)*1000)/1000,y:Math.round((r.y+r.height/2-height/2)*1000)/1000,width,height};
          }
          const eligible=!!owner?.closest('[data-settings-panel],[data-settings-search-root]')&&owner.classList.contains('hover:bg-secondary-ghost-hover');
          const active=eligible&&owner.matches(':is(:hover,:focus-visible,:has(:focus-visible))');
          const pseudo=name=>{const p=getComputedStyle(e,name);return [p.content,p.position,p.inset,p.width,p.height,p.backgroundColor,p.backgroundImage,p.boxShadow,p.pointerEvents];};
          return [e.id||'node-'+index,{rect:[localBox.x,localBox.y,localBox.width,localBox.height],geometry:[s.width,s.height,s.boxSizing,s.transformOrigin,s.padding,s.margin,s.borderWidth,s.position,s.overflow,s.display,s.font,s.lineHeight,s.cornerShape,s.opacity,s.pointerEvents,spinning?'native spin':s.transform,spinning?'native spin':s.rotate],
            animation:[s.animationName,s.animationDuration,s.animationTimingFunction,s.animationIterationCount,s.animationPlayState],
            radius:s.borderRadius,outline:[s.outlineWidth,s.outlineStyle,s.outlineColor,s.outlineOffset],paint:[s.backgroundColor,s.backgroundImage,s.boxShadow,s.color],before:pseudo('::before'),after:pseudo('::after'),
            eligible:eligible&&e===owner,iconPaint:[s.fill,s.stroke],
            svg:[e.getAttribute('width'),e.getAttribute('height'),e.getAttribute('viewBox'),e.getAttribute('focusable'),e.getAttribute('aria-hidden')],
            active,disabled:e.disabled??null,tab:e.tabIndex,
            expanded:e.getAttribute('aria-expanded'),controls:e.getAttribute('aria-controls')}];
        })));};
        const compare=(baseline,themed,label)=>{
          for(const id of Object.keys(baseline)){
            for(const field of ['rect','geometry','animation','before','after','disabled','tab','expanded','controls','svg'])assert.deepEqual(themed[id][field],baseline[id][field],`${label}: ${id} ${field}`);
            assert.equal(themed[id].radius,baseline[id].radius,`${id} keeps its complete native radius`);
            assert.deepEqual(themed[id].outline,baseline[id].outline,`${id} keeps the complete native keyboard outline`);
            const allowed=new Set(themed[id].eligible?[0,1]:[]);
            themed[id].paint.forEach((value,index)=>{if(!allowed.has(index))assert.equal(value,baseline[id].paint[index],`${id} preserves native paint channel ${index}`);});
            assert.deepEqual(themed[id].iconPaint,baseline[id].iconPaint,`${id} preserves native icon and loader paint`);
          }
        };
        const verify=async(label,target)=>{
          await remove();const baseline=await capture();await apply();const after=await capture();compare(baseline,after,label);
          for(const [id,value]of Object.entries(after).filter(([,value])=>value.eligible)){
            if(value.active){
              const expected=await page.locator('#'+id).evaluate(e=>{
                const p=document.createElement('span');p.style.backgroundColor='var(--forge-settings-row-hover)';
                e.append(p);const color=getComputedStyle(p).backgroundColor;p.remove();return color;
              });
              assert.notEqual(expected,'rgba(0, 0, 0, 0)',`${label}: ${id} resolves a visible hover fill`);
              assert.equal(value.paint[0],expected,`${label}: ${id} receives the themed whole-row hover fill`);
            }else assert.equal(value.paint[0],'rgba(0, 0, 0, 0)',`${label}: ${id} idle keeps its base fill transparent`);
            assert.equal(value.paint[1],'none',`${label}: ${id} uses flat row paint`);
            assert.equal(value.paint[2],baseline[id].paint[2],`${label}: ${id} adds no edge or shadow`);
          }
          if(target)assert.equal(after[target].active,true);
          await remove();assert.deepEqual(await capture(),baseline,'Theme removal restores native feedback and state');await apply();return after;
        };
        await reset();await apply();await page.locator('#security-linked-apps-button').click();await page.mouse.move(1000,800);
        assert.equal(await page.locator('#security-linked-apps-button').evaluate(e=>e.matches(':focus-visible')),false);
        assert.notEqual((await capture())['security-linked-apps'].paint[0],'rgba(0, 0, 0, 0)','Old CSS preserves the clicked focus-within gray block');
        await style.evaluate((e,css)=>e.textContent=css,theme);
        assert.equal((await capture())['security-linked-apps'].paint[0],'rgba(0, 0, 0, 0)','Mouse focus after leaving does not persist as selected paint');
        await reset();await verify('idle');
        await page.locator('#security-linked-apps-button').hover();await verify('custom hover','security-linked-apps');
        const pending=native.custom(native.entry.id,false,{pending:true});
        const pendingTrailing=walk(pending).find(node=>node.props?.className?.split(' ').includes('col-start-3'));
        await page.locator('#security-linked-apps-button > .col-start-3').evaluate((e,value)=>e.innerHTML=value,html(pendingTrailing.props.children));
        await verify('loading icon isolation','security-linked-apps');
        assert.equal(await page.locator('#custom-loading [data-fixture-arrow]').count(),0,'The pending indicator is not an action arrow');
        assert.equal(await page.locator('#custom-loading').evaluate(e=>e.getAnimations().some(a=>a.effect?.getTiming().iterations===Infinity&&a.playState==='running')),true,
          'The real native loading spinner keeps running; snapshots compare its layout rather than rotation phase');
        const counted=native.custom(),countedTrailing=walk(counted).find(node=>node.props?.className?.split(' ').includes('col-start-3'));
        await page.locator('#security-linked-apps-button > .col-start-3').evaluate((e,value)=>e.innerHTML=value,html(countedTrailing.props.children));
        assert.equal(await page.locator('#security-linked-apps-button > .col-start-3').evaluate(e=>[...e.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('')),'3');
        await reset();await page.locator('#before-custom').focus();await page.keyboard.press('Tab');
        assert.equal(await page.locator('#security-linked-apps-button').evaluate(e=>e.matches(':focus-visible')),true);
        await verify('custom keyboard','security-linked-apps');
        await reset();await page.locator('#import-toggle').hover();await verify('import hover','import-toggle');
        await reset();await page.locator('#before-import').focus();await page.keyboard.press('Tab');
        assert.equal(await page.locator('#import-toggle').evaluate(e=>e.matches(':focus-visible')),true);await verify('import keyboard','import-toggle');
        await reset();await page.locator('#import-toggle').click();await page.waitForFunction(()=>document.getElementById('import-toggle').getAttribute('aria-expanded')==='true');
        await page.mouse.move(1000,800);await page.evaluate(()=>document.activeElement?.blur());
        const expanded=await verify('expanded idle');assert.equal(expanded['import-toggle'].paint[0],'rgba(0, 0, 0, 0)');
        assert.equal(expanded['import-toggle'].after[0],'""','The expanded trigger retains the native divider pseudo');
        assert.equal(expanded['import-toggle'].after[1],'absolute');assert.equal(await page.locator('#import-history-fixture').count(),1);
        await page.locator('#nested-toggle').hover();await verify('nested result hover','nested-toggle');
        assert.equal(await page.locator('#nested-toggle [data-fixture-arrow="nested"]').count(),2,'Both native compact/leading icon branches remain present');
        const nestedExpanded=native.imported(true,'nested-toggle','nested');
        await page.locator('#nested-toggle').evaluate((e,value)=>{e.innerHTML=value;e.setAttribute('aria-expanded','true');},html(nestedExpanded.props.children));
        await verify('nested expanded arrow','nested-toggle');
        assert.equal(await page.locator('#nested-toggle svg').evaluateAll(elements=>elements.every(e=>e.classList.contains('rotate-90'))),true);
        await reset();await page.locator('#disabled-row-button').hover();await verify('disabled');
        assert.equal(await page.locator('#disabled-row-button').isDisabled(),true);
        await page.locator('#ordinary').hover();await verify('unrelated native button');
        await page.locator('#outside-row-button').hover();await verify('outside settings scope');
        await page.locator('#import-toggle').click();await page.waitForFunction(()=>document.getElementById('import-toggle').getAttribute('aria-expanded')==='false');
        assert.equal(await page.locator('#import-history-fixture').count(),0);assert.equal(await page.evaluate(()=>fixtureImportClicks),2);
        assert.equal(await page.evaluate(()=>fixtureCustomClicks),1);
        await reset();await remove();await page.emulateMedia({forcedColors:'active'});await page.locator('#security-linked-apps-button').hover();
        const forced=await capture();await apply();assert.deepEqual(await capture(),forced,'Forced colors retain all native row feedback');
        await page.emulateMedia({forcedColors:'none'});
        if(process.env.WUKONG_SETTINGS_ROW_PREVIEW_DIRECTORY&&scope==='data-settings-panel'){
          await reset();await page.locator('#import-toggle').click();await page.waitForFunction(()=>document.getElementById('import-toggle').getAttribute('aria-expanded')==='true');
          await reset();await page.locator('#import-toggle').hover();await apply();
          await page.evaluate(()=>{
            document.querySelectorAll('button[data-start],#ordinary').forEach(e=>e.remove());
            Object.assign(document.getElementById('fixture-scope').style,{padding:'24px 28px',fontFamily:'var(--font-ui-family,system-ui)',boxSizing:'content-box'});
            document.querySelector('#fixture-scope p').textContent='设置行组件夹具 · 导入行示例悬停';
          });
          fs.mkdirSync(process.env.WUKONG_SETTINGS_ROW_PREVIEW_DIRECTORY,{recursive:true});
          await page.locator('#fixture-scope').screenshot({path:path.join(process.env.WUKONG_SETTINGS_ROW_PREVIEW_DIRECTORY,`${mode}-settings-row-state-fixture-20261123.png`)});
        }
      }finally{await page.close();}
    }
  }finally{await browser.close();}
});
