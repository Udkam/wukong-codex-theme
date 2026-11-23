import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { loadQuotaNative, quotaHtml, quotaNativeSkip } from './native-quota-current-helper.mjs';
import { nodes, ownNodes, prop, text, key, nativeFunction } from './native-bundle-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const element = (tag, props) => ({ tag, props });
const callMember = call => call.callee?.type === 'SequenceExpression' ? call.callee.expressions.at(-1) : call.callee;
const jsxCalls = record => nodes(record.ast).filter(node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression');
let cached;

const loadProjectNative = () => {
  if (cached) return cached;
  const native = loadQuotaNative(), { bundle, harness } = native;
  const [utility, ...otherUtilities] = bundle.findModules(['data-composer-utility-rail', 'data-composer-utility-bar-scroll-area']);
  assert.ok(utility && !otherUtilities.length, 'Use the one installed project utility presentation');
  const railCall = jsxCalls(utility).find(call => prop(call.arguments[1], 'data-composer-utility-rail'));
  const utilityFunction = nativeFunction(utility, railCall.start), utilityImports = bundle.imports(utility);
  const railModule = bundle.module(utilityImports[railCall.arguments[0].object.object.name].id);
  const registry = harness.load(railModule.id)[key(railCall.arguments[0].object.property)];
  const item = nativeFunction(railModule, '"data-composer-rail-item"');
  const contextReader = item.nodes.find(node => node.type === 'CallExpression' && key(callMember(node)?.property) === 'useContext');
  const observed = [], readContext = harness.react.useContext;
  harness.react.useContext = context => { observed.push(context); return readContext(context); };
  try { registry.Item({ children: null }); } finally { harness.react.useContext = readContext; }
  assert.equal(observed.length, 1);
  assert.ok(contextReader && observed[0]?.defaultValue === null, 'Keep the real private rail context');
  const railContext = observed[0], composerContext = harness.load(native.composerRoot.record.id).k;

  const scroll = jsxCalls(utility).find(call => prop(call.arguments[1], 'data-composer-utility-bar-scroll-area'));
  const scrollFunction = nativeFunction(utility, scroll.start);
  const footerCall = utilityFunction.nodes.find(call => call.type === 'CallExpression' &&
    text(prop(call.arguments[1], 'className')) === 'flex min-w-0 items-center justify-between gap-2 py-1.5 text-size-chat');
  assert.ok(footerCall, 'Keep the actual native footer presentation rather than a synthetic row');
  const footerImport = utilityImports[footerCall.arguments[0].object.name], footerRecord = bundle.module(footerImport.id);
  const footerExport = bundle.exports(footerRecord)[key(footerCall.arguments[0].property)];
  const footerFunction = footerExport?.type === 'Identifier'
    ? nodes(footerRecord.ast).find(node => node.type === 'FunctionDeclaration' && node.id.name === footerExport.name) : footerExport;
  assert.ok(footerFunction);
  const renderFooter = harness.compile(nativeFunction(footerRecord, footerFunction.start));
  // Only presentation hooks are inert: localization, direction, merged refs and
  // tooltip transport. Native scroll markup and pointer handlers are retained.
  const scrollBindings = {};
  const scrollImports = bundle.imports(utility);
  for (const [binding, imported] of Object.entries(scrollImports)) {
    if (imported.id === 'Wf1j') scrollBindings[binding] = { A: () => ({ formatMessage: message => message.defaultMessage }) };
    if (imported.id === 'wD9O') scrollBindings[binding] = { dz: () => 'ltr', Ud: value => value };
    if (imported.id === 'bIvi') scrollBindings[binding] = { K: ref => ref };
  }
  const renderScroll = harness.compile(scrollFunction, scrollBindings);
  const scrollCall = utilityFunction.nodes.find(call => call.type === 'CallExpression' &&
    call.arguments[0]?.name === scrollFunction.ast.id.name);
  assert.ok(scrollCall);
  const utilityBindings = { [scrollFunction.ast.id.name]: renderScroll,
    [footerCall.arguments[0].object.name]: { [key(footerCall.arguments[0].property)]: renderFooter } };
  const defaults = utilityFunction.nodes.find(call => call.type === 'CallExpression' && key(call.arguments[0]?.property) === 'DefaultsProvider');
  utilityBindings[defaults.arguments[0].object.object.name] = { m: { DefaultsProvider: props => props.children } };
  const renderUtility = harness.compile(utilityFunction, utilityBindings);

  const wrappers = bundle.modulesInAsset(utility.asset).filter(record => /utilityBarVariant:\s*"home"/.test(record.source));
  assert.equal(wrappers.length, 1);
  const wrapper = wrappers[0], rootCall = jsxCalls(wrapper).find(call => text(prop(call.arguments[1], 'utilityBarVariant')) === 'home');
  const wrapperFunction = nativeFunction(wrapper, rootCall.start), wrapperImports = bundle.imports(wrapper);
  const utilityBinding = Object.entries(wrapperImports).find(([, imported]) => imported.id === utility.id);
  assert.ok(utilityBinding && wrapperFunction.source.includes('UtilityBarSlot'), 'The actual home wrapper must retain its native slot');
  const renderHome = harness.compile(wrapperFunction, { [utilityBinding[0]]: { S: renderUtility } });
  const railClass = nodes(railModule.ast).map(text).find(value => /^rail-\S+$/.test(value));
  const footerClass = nodes(footerRecord.ast).map(text).find(value => /^ComposerFooter-\S+$/.test(value));
  assert.ok(railClass && footerClass);
  const cssAssets = [...new Set([...native.cssEntries, bundle.stylesheetAssets(railClass)[0], bundle.stylesheetAssets(footerClass)[0]])];
  assert.ok(cssAssets.every(Boolean));
  cached = { ...native, css: `${bundle.layerOrder}\n${cssAssets.map(asset => bundle.read(asset)).join('\n')}`,
    registry, railContext, composerContext, renderHome, utilityFunction, wrapperFunction };
  return cached;
};

const markup = native => {
  const { harness, registry, railContext, composerContext } = native;
  harness.contexts.set(composerContext, { isHome: true, expansion: null, homeMode: undefined });
  harness.contexts.set(railContext, { embedded: false, placement: 'above', shouldUseReducedMotion: true });
  try {
    const buttons = ['此计算机', '选择项目'].map((children, index) => native.renderButton({ id: `project-${index}`, children,
      'data-composer-navigation-target': index ? 'workspace-project' : 'workspace-host', color: 'ghost', size: 'composer' }));
    const body = native.renderComposerBody({ layout: 'multiline', children: [
      native.renderComposerRoot.Input({ children: element('textarea', { id: 'editor', rows: 2, 'aria-label': 'Fixture message' }) }),
      element('div', { id: 'body-controls', children: native.renderButton({ id: 'send', size: 'composer', color: 'ghost', children: '发送' }) })
    ] });
    const home = native.renderHome({ actionBar: { isVisible: true, isHidden: false, children: buttons }, actionBarPosition: 'above',
      surfaceVariant: 'default', children: body });
    const identify = tree => {
      if (!tree || typeof tree !== 'object') return;
      if (Array.isArray(tree)) return tree.forEach(identify);
      const p = tree.props;
      if (p?.['data-composer-utility-bar-variant'] === 'home') p.id = 'composer';
      if (p?.['data-composer-body'] !== undefined) p.id = 'composer-body';
      if (p?.['data-composer-rail'] !== undefined) p.id = 'project-rail';
      if (p?.['data-composer-utility-rail'] !== undefined) p.id = 'project-item';
      if (p?.['data-composer-utility-bar-scroll-area'] !== undefined) p.id = 'project-scroll';
      if (p?.['data-composer-footer-responsive'] !== undefined) p.id = 'project-row';
      if (p?.className?.includes('z-0') && p.className.includes('absolute')) p.id = 'project-slot';
      identify(p?.children);
    };
    identify(home);
    const independent = ['goal', 'queue'].map((id, index) => {
      const item = registry.Item({ id, children: registry.Row({ title: index ? '示例队列：检查主题效果' : '示例目标：修复项目条',
        actions: registry.Action({ children: index ? '发送' : '暂停' }) }) });
      const rail = registry({ placement: 'above', children: item });
      return element('section', { className: 'independent-example', children: rail });
    });
    return quotaHtml([home, element('div', { id: 'independent', children: independent })]);
  } finally {
    harness.contexts.delete(railContext); harness.contexts.delete(composerContext);
  }
};

const oldFilterTheme = () => {
  const parsed = postcss.parse(theme); let removed = 0;
  parsed.walkRules(rule => {
    if (rule.selector.includes('[data-composer-utility-rail]') &&
      rule.nodes.some(node => node.prop === 'backdrop-filter' && node.value === 'none')) {
      assert.ok(rule.nodes.some(node => node.prop === '-webkit-backdrop-filter' && node.value === 'none'));
      rule.remove(); removed++;
    }
  });
  assert.equal(removed, 1, 'Negative control removes only the project utility sampling override');
  return parsed.toString();
};
const fixture = (native, mode, html, backdrop = '') => `<html data-theme="${mode}" data-forge-native-theme="${mode}" data-codex-window-type="electron" data-codex-os="win32" style="color-scheme:${mode}"><head>
  <style>${native.css}</style><style>body{margin:0;background:#47789b;font-family:system-ui}main{padding:28px 24px 40px}#example{max-width:710px;margin:auto}#fixture-label{font:12px/1.5 system-ui;margin:0 0 65px;text-align:center;color:CanvasText}#editor{display:block;box-sizing:border-box;width:100%;height:90px;resize:none;background:transparent;padding:14px;border:0}#body-controls{padding:0 12px 10px;display:flex;justify-content:flex-end}#independent{display:grid;gap:30px;margin-top:52px}.independent-example{position:relative;padding-bottom:20px}#project-row{min-width:0}${backdrop}</style>
  <style id="theme">${theme}</style></head><body><div id="root"><main><div id="example"><p id="fixture-label">原生组件夹具 · 项目条不采样背景 · 非客户端截图 / 未复现间歇横线</p><div id="mount">${html}</div></div></main></div></body></html>`;
const capture = page => page.locator('#mount [id]').evaluateAll(elements => Object.fromEntries(elements.map(node => {
  const s = getComputedStyle(node), r = node.getBoundingClientRect();
  const pseudo = type => { const p = getComputedStyle(node, type); return [p.content,p.opacity,p.backgroundColor,p.backgroundImage,p.boxShadow,p.borderWidth,p.borderColor,p.clipPath,p.position,p.inset]; };
  return [node.id, { geometry: [r.x,r.y,r.width,r.height,s.padding,s.margin,s.borderWidth,s.borderRadius,s.cornerShape,s.overflow,s.position,s.clipPath,s.transform,s.font,s.lineHeight],
    paint: [s.backgroundColor,s.backgroundImage,s.boxShadow,s.backdropFilter,s.webkitBackdropFilter ?? null,s.borderColor], before:pseudo('::before'),after:pseudo('::after'),
    tuck:s.getPropertyValue('--composer-rail-tuck'),spacing:s.getPropertyValue('--spacing'), state:node.getAttribute('data-composer-rail-item'),framed:node.hasAttribute('data-composer-rail-framed'),
    contained:node.hasAttribute('data-composer-rail-contained'),inert:node.inert,tabIndex:node.tabIndex }];
})));
const geometry = capture => Object.fromEntries(Object.entries(capture).map(([id, state]) => [id,
  { geometry:state.geometry,before:state.before,after:state.after,tuck:state.tuck,state:state.state,framed:state.framed,contained:state.contained,inert:state.inert,tabIndex:state.tabIndex }]));

test('native home project rail retains the slot, attached tuck and independent paint boundaries without a sampling layer', { skip:quotaNativeSkip }, async () => {
  const native = loadProjectNative(), html = markup(native), oldTheme = oldFilterTheme();
  const browser = await chromium.launch({ headless:true });
  try {
    for (const mode of ['dark','light']) for (const width of [900,1800]) {
      const page = await browser.newPage({ colorScheme:mode,viewport:{width,height:760} });
      try {
        await page.setContent(fixture(native,mode,html));
        assert.equal(await page.locator('#project-slot #project-rail #project-item #project-scroll').count(),1);
        assert.equal(await page.locator('#composer #composer-body').count(),1);
        const baseline = await capture(page);
        assert.equal(baseline['project-item'].contained,true); assert.equal(baseline['project-item'].framed,false);
        assert.equal(baseline['project-item'].state,'present');
        assert.equal(baseline['project-rail'].tuck,baseline['project-rail'].spacing,'Native attached tuck equals its spacing token');
        assert.equal(baseline['project-rail'].geometry[9],'clip');
        assert.ok(Number.parseFloat(baseline['project-rail'].geometry[5].split(' ')[2] ?? baseline['project-rail'].geometry[5]) < 0, 'Native attached rail retains its negative bottom margin');
        assert.equal(baseline['project-rail'].after[1],'0','The native attached outline is hidden for controls');
        await page.locator('#theme').evaluate((style,css)=>style.textContent=css,oldTheme);
        await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
        const previous = await capture(page);
        assert.match(previous['project-item'].paint[3],/blur\(/,'The old sampling layer is the negative control, not a claimed reproduction of the intermittent line');
        await page.locator('#theme').evaluate((style,css)=>style.textContent=css,theme);
        const after = await capture(page);
        assert.deepEqual(geometry(after),geometry(baseline),`${mode}/${width}: preserve all native geometry, clipping and pseudos`);
        assert.equal(after['project-item'].paint[3],'none');
        if (after['project-item'].paint[4] !== null) assert.equal(after['project-item'].paint[4],'none');
        assert.deepEqual(after['project-item'].paint.slice(0,3),previous['project-item'].paint.slice(0,3),'Keep tint, continuous highlight and the existing top inset');
        for (const id of ['composer-body','goal','queue']) {
          assert.match(after[id].paint[3],/blur\(/,`${id} keeps its separate sampling owner`);
          assert.deepEqual(after[id].paint,previous[id].paint,`${id} paint remains unchanged`);
        }
        for (const id of ['project-0','project-1']) {
          await page.locator(`#${id}`).evaluate(node=>{node.onclick=()=>node.dataset.fixtureClicked='true';});
          await page.locator(`#${id}`).click();
          assert.equal(await page.locator(`#${id}`).getAttribute('data-fixture-clicked'),'true');
        }
        await page.mouse.move(0,0);
        await page.evaluate(html=>document.getElementById('mount').innerHTML=html,html);
        assert.deepEqual(await capture(page),after,'A newly mounted project bar immediately keeps the same paint without runtime markers');
        await page.evaluate(()=>document.documentElement.classList.remove('forge-ink-mountain'));
        assert.deepEqual(await capture(page),baseline,'Removing the theme restores every native paint owner');
      } finally { await page.close(); }
    }
    const previewDirectory = process.env.WUKONG_PROJECT_RAIL_PREVIEW_DIRECTORY;
    if (previewDirectory) {
      fs.mkdirSync(previewDirectory,{recursive:true});
      const image = fs.readFileSync(new URL('../themes/backgrounds/scenery-08.jpg',import.meta.url)).toString('base64');
      for (const mode of ['dark','light']) {
        const page=await browser.newPage({colorScheme:mode,viewport:{width:1000,height:600}});
        try {
          const veil = mode === 'dark' ? 'rgba(12,20,28,.3)' : 'rgba(247,249,251,.35)';
          const labelFill = mode === 'dark' ? 'rgba(12,20,28,.6)' : 'rgba(247,249,251,.8)';
          await page.setContent(fixture(native,mode,html,`#root{background:linear-gradient(${veil},${veil}),url(data:image/jpeg;base64,${image}) center 55% / cover no-repeat}#fixture-label{padding:4px 6px;border-radius:6px;background:${labelFill}}`));
          await page.evaluate(()=>document.documentElement.classList.add('forge-ink-mountain'));
          await page.locator('main').screenshot({path:path.join(previewDirectory,`${mode}-project-rail-compositing-fixture-20261124.png`)});
        } finally { await page.close(); }
      }
    }
  } finally { await browser.close(); }
});
