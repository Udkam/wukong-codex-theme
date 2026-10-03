import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {makeTheme, validateTheme, cssFor} from '../shared/theme-model.mjs';
import {resolveThemeUiAssets} from '../runtime/forge-runtime.mjs';

test('exported material choices replace paint in both modes while native dimensions remain authoritative',async()=>{
  const theme=makeTheme({materials:{dark:{glassFill:'#123456cc',glassBlur:6,readingLink:'#ffeedd'},light:{glassFill:'#ffeeddcc',glassBlur:3}}});
  const exported=JSON.parse(JSON.stringify(theme));
  assert.deepEqual(validateTheme(exported).materials,theme.materials);
  const browser=await chromium.launch({headless:true});
  try{
    const page=await browser.newPage();
    await page.setContent('<html class="forge-ink-mountain"><style>[data-composer-surface-variant]{width:73%;height:95px;border-radius:19px;background:var(--composer-layout-surface-background);backdrop-filter:var(--composer-layout-surface-backdrop-filter)}</style><div data-composer-surface-variant="thread"></div></html>');
    const measure=()=>page.locator('[data-composer-surface-variant]').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {rect:[r.x,r.y,r.width,r.height],radius:s.borderRadius,bg:s.backgroundColor,blur:s.backdropFilter};});
    const native=await measure();
    await page.addStyleTag({content:fs.readFileSync('runtime/wukong-codex-theme-background-v13.css','utf8')+cssFor(exported)});
    for(const [mode,bg,blur] of [['dark','rgba(18, 52, 86, 0.8)','blur(6px) saturate(1.04)'],['light','rgba(255, 238, 221, 0.8)','blur(3px) saturate(1.2)']]){
      await page.evaluate(mode=>document.documentElement.dataset.forgeNativeTheme=mode,mode);
      const painted=await measure();assert.deepEqual(painted.rect,native.rect);assert.equal(painted.radius,native.radius);
      assert.equal(painted.bg,bg);assert.equal(painted.blur,blur);
    }
  }finally{await browser.close();}
});

test('material configuration validates values and old exports no longer require retired texture files',()=>{
  for(const values of [{glassBlur:-1},{glassBlur:Infinity},{glassFill:'red;display:none'},{unknown:1},{readingMinOpacity:2}]){
    assert.throws(()=>makeTheme({materials:{dark:values}}),/Invalid materials/);
  }
  const active=JSON.parse(fs.readFileSync('themes/active.json','utf8'));
  active.uiAssets.composerMain='retired-file-no-longer-present.webp';
  assert.doesNotThrow(()=>validateTheme(active));
  assert.deepEqual(Object.keys(resolveThemeUiAssets('themes/active.json',active)),['landingMark','landingMarkDark']);
  assert.doesNotMatch(cssFor(active),/--forge-ui-composer/);
});
