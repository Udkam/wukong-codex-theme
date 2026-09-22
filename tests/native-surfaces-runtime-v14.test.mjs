import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from '@playwright/test';
import {makeApplyExpression, RESTORE_EXPRESSION} from '../runtime/injection-plan-v13.mjs';
import {runtimeFixtureHtml, installComposerState} from './runtime-fixture.mjs';
import {snapshotNativeControls, assertNativeControls} from './native-surfaces-current-helper.mjs';

// Replaces retired paper/colour overrides with the current native-boundary contract.
// This synthetic shell tests state transitions; installed-client paint tests live
// in native-paint-boundary.test.mjs and material-unification.test.mjs.
const styleSheet=fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css',import.meta.url),'utf8');
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#304050"/></svg>');
const variables=':root.forge-ink-mountain{--forge-scene-count:1;--forge-battle-scenes:0;--forge-scenery-scenes:0;--forge-bg-0:url("'+image+'");}';
let browser;
test.before(async()=>{browser=await chromium.launch({headless:true});});
test.after(async()=>{await browser?.close();});
for(const mode of ['dark','light']) for(const state of ['default','context','running','guided','multi-guided']) {
  test(mode+' '+state+': theme preserves control geometry, semantics and native restore',async()=>{
    const page=await browser.newPage({viewport:{width:1280,height:800},colorScheme:mode});
    try {
      await page.setContent(runtimeFixtureHtml);
      await installComposerState(page,state);
      const before=await snapshotNativeControls(page);
      await page.evaluate(makeApplyExpression({styleSheet,variables}));
      assertNativeControls(await snapshotNativeControls(page),before);
      // A mounted replacement must keep its own native bounds and disabled state.
      await page.evaluate(RESTORE_EXPRESSION);
      assertNativeControls(await snapshotNativeControls(page),before);
      assert.equal(await page.locator('[data-forge-mark]').count(),0);
      assert.equal(await page.locator('#wukong-codex-theme-background').count(),0);
    } finally {await page.close();}
  });
}
