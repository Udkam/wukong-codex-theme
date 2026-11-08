import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {runtimeFixtureHtml,enterThreadState} from './runtime-fixture.mjs';
import {makeApplyExpression,RESTORE_EXPRESSION} from '../runtime/injection-plan-v13.mjs';

test('local mutations stay regional, burst events coalesce, and navigation invalidates cached regions',async()=>{
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage();
    await page.route('http://theme-regions.test/**',r=>r.fulfill({body:runtimeFixtureHtml,contentType:'text/html'}));
    await page.goto('http://theme-regions.test/');
    await page.evaluate(()=>document.querySelector('[data-codex-composer-root]').insertAdjacentHTML('beforeend','<button id="menu-trigger" aria-haspopup="menu" aria-expanded="false">Menu</button>'));
    await page.evaluate(makeApplyExpression({styleSheet:fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css',import.meta.url),'utf8'),variables:':root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0}'}));
    await page.waitForTimeout(1500);
    const counts=()=>page.evaluate(()=>({...window.__wukongCodexThemeRuntimeV13.regionRefreshCounts}));
    const initial=await counts();
    await page.evaluate(()=>{document.getElementById('menu-trigger').setAttribute('aria-expanded','true');const e=document.createElement('div');e.id='test-menu';e.role='menu';e.className='bg-surface';e.textContent='Menu';document.body.append(e)});
    await page.waitForTimeout(750);
    const opened=await counts();
    for(const key of ['composer','sidebar','right','page','topbar'])assert.equal(opened[key],initial[key],key);
    assert.equal(opened.overlay,initial.overlay+1);
    assert.equal(await page.locator('#test-menu').evaluate(e=>e.classList.contains('forge-menu')),true);
    await page.evaluate(()=>{document.getElementById('menu-trigger').setAttribute('aria-expanded','false');document.getElementById('test-menu').remove()});
    await page.waitForTimeout(750);
    const closed=await counts();assert.equal(closed.overlay,opened.overlay+1);assert.equal(closed.composer,opened.composer);
    await page.evaluate(()=>{const e=document.querySelector('[data-codex-composer-root]');for(let i=0;i<50;i++)e.setAttribute('aria-expanded',String(i%2===0))});
    await page.waitForTimeout(750);
    const composer=await counts();assert.equal(composer.composer,closed.composer+1);assert.equal(composer.page,closed.page);assert.equal(composer.overlay,closed.overlay);
    await page.evaluate(()=>{const e=document.querySelector('[data-app-action-sidebar-thread-row]');e.dispatchEvent(new MouseEvent('click',{bubbles:true}));history.pushState({},'','#next');});
    await page.waitForTimeout(1000);
    const navigated=await counts();
    for(const key of Object.keys(initial))assert.ok(navigated[key]>composer[key],key);
    assert.equal(await page.evaluate(()=>window.__wukongCodexThemeRuntimeV13.routeTimers.size),0);
    await page.evaluate(RESTORE_EXPRESSION);
    assert.equal(await page.locator('[data-forge-mark]').count(),0);
    fs.writeFileSync(new URL('../artifacts/test-runs/native-boundary-20260920/performance-regions.json',import.meta.url),JSON.stringify({initial,opened,closed,composer,navigated},null,2));
  } finally {await browser.close()}
});
fs.mkdirSync(new URL('../artifacts/test-runs/native-boundary-20260920/',import.meta.url),{recursive:true});

test('unchanged regional refreshes do not rewrite marks or root state while ownership changes still reconcile',async()=>{
  // This is a synthetic behavior/pressure fixture, not a native transition or
  // frame-rate baseline. Native component geometry has separate source gates.
  const source='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><path fill="#47789b" d="M0 0h32v24H0z"/></svg>');
  const expression=makeApplyExpression({
    styleSheet:fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css',import.meta.url),'utf8'),
    variables:`:root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("${source}");}`
  });
  const start=expression.indexOf('  const reconcileMarks = planned => {');
  const end=expression.indexOf('  const mark = (element, name) => {',start);
  assert.ok(start>=0&&end>start,'The negative control must replace one complete reconciliation function');
  const previousReconcile=`  const reconcileMarks = planned => {
    const existing = new Set(document.querySelectorAll('[data-forge-mark]'));
    for (const element of existing) {
      const desired = planned.get(element);
      if (!desired) {
        if (element.classList.contains('forge-image-viewer-backdrop')) {
          element.style.removeProperty('--forge-image-viewer-scene');
          element.style.removeProperty('--forge-image-viewer-scene-position');
        }
        restoreLandingCopy(element);
        element.classList.remove(...markClasses);
        delete element.dataset.forgeMark;
        continue;
      }
      for (const name of markClasses) {
        if (!desired.has(name)) element.classList.remove(name);
      }
    }
    for (const [element, desired] of planned) {
      element.classList.add(...desired);
      element.dataset.forgeMark = '1';
    }
  };
`;
  const refreshBoundary='    const background = ensureBackground();';
  assert.equal(expression.split(refreshBoundary).length,2);
  const previous=(expression.slice(0,start)+previousReconcile+expression.slice(end)).replace(refreshBoundary,
    `    root.dataset.forgeSurface = surface;
    root.dataset.forgeSettingsVeil = settingsVeil ? 'true' : 'false';
    root.dataset.forgeMode = mode;
${refreshBoundary}`);
  const browser=await chromium.launch({headless:true});
  const observations={};
  try {
    for(const legacy of [false,true]){
      const page=await browser.newPage();
      try {
        await page.route('http://theme-mark-writes.test/**',r=>r.fulfill({body:runtimeFixtureHtml,contentType:'text/html'}));
        await page.goto('http://theme-mark-writes.test/');
        await enterThreadState(page);
        await page.evaluate(legacy?previous:expression);
        await page.waitForTimeout(1500);
        const stable=await page.evaluate(async()=>{
          const marked=[...document.querySelectorAll('[data-forge-mark]')];
          const snapshot=()=>marked.map(e=>({classes:e.className,mark:e.getAttribute('data-forge-mark')}));
          const before=snapshot(),records=[];
          const observer=new MutationObserver(batch=>records.push(...batch));
          observer.observe(document.documentElement,{subtree:true,attributes:true,
            attributeFilter:['class','data-forge-mark','data-forge-surface','data-forge-settings-veil','data-forge-mode']});
          for(let i=0;i<4;i++)window.__wukongCodexThemeRuntimeV13.refresh(new Set(['overlay']));
          await Promise.resolve();records.push(...observer.takeRecords());observer.disconnect();
          const writes={classes:0,marks:0,root:0};
          for(const record of records){
            if(record.attributeName==='class')writes.classes++;
            else if(record.attributeName==='data-forge-mark')writes.marks++;
            else writes.root++;
          }
          return {marked:marked.length,before,after:snapshot(),writes};
        });
        assert.ok(stable.marked>5,'Exercise several independently cached theme regions');
        assert.deepEqual(stable.after,stable.before,'Stable refreshes preserve the same marks and native classes');
        observations[legacy?'previous':'current']={marked:stable.marked,writes:stable.writes};
        if(legacy){
          assert.ok(stable.writes.classes>=stable.marked*4,'The previous reconciliation must reproduce repeated whole-page class writes');
          assert.ok(stable.writes.marks>=stable.marked*4,'The previous reconciliation also rewrites every mark attribute');
          assert.equal(stable.writes.root,12,'The previous root setters write all three state attributes on every pass');
          continue;
        }
        assert.deepEqual(stable.writes,{classes:0,marks:0,root:0},'No unchanged marker or root-state setter should run');
        await page.evaluate(()=>{
          const menu=document.createElement('div');menu.id='ownership-menu';menu.role='menu';
          menu.className='native-menu bg-surface';menu.textContent='Fixture menu';
          menu.style.cssText='position:fixed;left:400px;top:150px;width:100px;height:40px';
          document.body.append(menu);window.__wukongCodexThemeRuntimeV13.refresh(new Set(['overlay']));
        });
        assert.equal(await page.locator('#ownership-menu').evaluate(e=>e.classList.contains('forge-menu')&&e.dataset.forgeMark==='1'),true,'New native paint owners are still marked');
        await page.evaluate(()=>{
          const menu=document.getElementById('ownership-menu');menu.classList.remove('bg-surface');
          window.__wukongCodexThemeRuntimeV13.refresh(new Set(['overlay']));
        });
        assert.equal(await page.locator('#ownership-menu').evaluate(e=>!e.classList.contains('forge-menu')&&!e.hasAttribute('data-forge-mark')&&e.classList.contains('native-menu')),true,'Changing the native owner condition revokes obsolete theme classes without removing native classes');
        await page.evaluate(()=>{
          const menu=document.getElementById('ownership-menu');menu.classList.add('bg-surface');
          window.__wukongCodexThemeRuntimeV13.refresh(new Set(['overlay']));
          menu.remove();window.__wukongCodexThemeRuntimeV13.refresh(new Set(['overlay']));
          document.body.append(menu);window.__wukongCodexThemeRuntimeV13.refresh(new Set(['overlay']));
        });
        assert.equal(await page.locator('#ownership-menu').evaluate(e=>e.classList.contains('forge-menu')&&e.dataset.forgeMark==='1'),true,'A removed and remounted owner is reconciled again');
        const navigation=await page.evaluate(()=>{
          const state=window.__wukongCodexThemeRuntimeV13,before={...state.regionRefreshCounts};
          history.pushState({},'','#new-route');state.refresh(new Set(['overlay']));
          return {before,after:{...state.regionRefreshCounts}};
        });
        for(const key of Object.keys(navigation.before))assert.ok(navigation.after[key]>navigation.before[key],key+': route changes invalidate cached regions');
        await page.evaluate(RESTORE_EXPRESSION);
        assert.equal(await page.locator('[data-forge-mark]').count(),0);
        assert.equal(await page.locator('#ownership-menu').evaluate(e=>e.className==='native-menu bg-surface'),true,'Restore removes theme classes and preserves native paint');
        assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('forge-ink-mountain')),false);
      } finally {await page.close();}
    }
    fs.writeFileSync(new URL('../artifacts/test-runs/native-boundary-20260920/marker-writes.json',import.meta.url),JSON.stringify(observations,null,2),'utf8');
  } finally {await browser.close();}
});
