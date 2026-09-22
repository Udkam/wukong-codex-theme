import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { makeApplyExpression } from '../runtime/injection-plan-v13.mjs';
import { runtimeFixtureHtml } from '../tests/runtime-fixture.mjs';

// Isolated component workload; never presented as real-client click latency.
const label=process.argv[2] || 'current';
if(!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid label');
const browser=await chromium.launch({headless:true});
const result={kind:'synthetic component workload, not live client latency',modes:[]};
try {
  for(const themed of [false,true]) {
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    await page.setContent(runtimeFixtureHtml);
    await page.evaluate(()=>{
      window.work={rect:0,style:0,query:0};
      const rect=Element.prototype.getBoundingClientRect, style=window.getComputedStyle;
      Element.prototype.getBoundingClientRect=function(){window.work.rect++;return rect.call(this)};
      window.getComputedStyle=function(...args){window.work.style++;return style(...args)};
      for(const proto of [Element.prototype,Document.prototype]) {
        const query=proto.querySelectorAll;
        proto.querySelectorAll=function(...args){window.work.query++;return query.apply(this,args)};
      }
    });
    if(themed) await page.evaluate(makeApplyExpression({styleSheet:fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css',import.meta.url),'utf8'),variables:':root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0}'}));
    await page.waitForTimeout(1300);
    const samples=[];
    for(let i=0;i<6;i++) {
      const immediate=await page.evaluate(async i=>{
        window.work={rect:0,style:0,query:0};
        const before=window.__wukongCodexThemeRuntimeV13?.refreshCount||0;
        const start=performance.now();
        if(i%2===0){const menu=document.createElement('div');menu.id='bench-menu';menu.role='menu';menu.className='bg-surface-elevated-secondary';menu.innerHTML='<button role="menuitem">Fixture action</button>';document.body.append(menu)}
        else document.getElementById('bench-menu')?.remove();
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        return {before,twoFramesMs:performance.now()-start};
      },i);
      await page.waitForTimeout(700);
      samples.push({...immediate,...await page.evaluate(()=>({...window.work,refreshes:window.__wukongCodexThemeRuntimeV13?.refreshCount||0,lastRefreshMs:window.__wukongCodexThemeRuntimeV13?.lastRefreshDurationMs||0}))});
    }
    result.modes.push({themed,samples});await page.close();
  }
} finally {await browser.close()}
const output=new URL(`../artifacts/test-runs/native-boundary-20260920/performance-${label}.json`,import.meta.url);
fs.writeFileSync(output,JSON.stringify(result,null,2),'utf8');
for(const mode of result.modes) console.log(JSON.stringify({themed:mode.themed,meanRects:mode.samples.reduce((s,x)=>s+x.rect,0)/6,meanQueries:mode.samples.reduce((s,x)=>s+x.query,0)/6,refreshes:mode.samples.map(x=>x.refreshes-x.before),twoFramesMs:mode.samples.map(x=>x.twoFramesMs)}));
