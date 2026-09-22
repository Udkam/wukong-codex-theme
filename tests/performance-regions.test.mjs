import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {runtimeFixtureHtml} from './runtime-fixture.mjs';
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
