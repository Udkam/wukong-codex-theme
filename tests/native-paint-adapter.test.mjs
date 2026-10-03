import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');

const require = createRequire(import.meta.url);
const native = (() => {
  try {
    const asar = require(path.join(process.env.APPDATA, 'npm/node_modules/asar'));
    const packages = path.join(process.env.ProgramFiles, 'WindowsApps');
    const archive = fs.readdirSync(packages).filter(name => /^OpenAI\.Codex_.*_x64__/.test(name))
      .map(name => path.join(packages, name, 'app/resources/app.asar')).filter(fs.existsSync)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const entries = asar.listPackage(archive);
    const read = entry => asar.extractFile(archive, entry.replace(/^[/\\]/, '')).toString('utf8');
    const css = entries.filter(entry => /webview[\\/]assets[\\/]app-(shared|initial|primary)-.*\.css$/.test(entry)).map(read).join('\n');
    const source = read(entries.find(entry => /webview[\\/]assets[\\/]app-initial-.*\.js$/.test(entry)));
    const permissionsCss = read(entries.find(entry => /webview[\\/]assets[\\/]browser-use-policy-site-permissions-.*\.css$/.test(entry)));
    const permissionsSource = read(entries.find(entry => /webview[\\/]assets[\\/]browser-use-policy-site-permissions-.*\.js$/.test(entry)));
    return { css, source, permissionsCss, permissionsSource,
      permissionsClass: permissionsCss.match(/\.(_table_[\w]+)\{/)[1],
      suggestionClass: css.match(/\.(_suggestionMenu_[\w]+)\{/)[1],
      topTrayClass: css.match(/\.(_ComposerTopMenuPanel_[\w]+)\[/)[1] };
  } catch { return null; }
})();

test('browser permissions use local cell materials and retain native paging, sticky corners and controls', {
  skip: !native && 'Requires the installed native UI CSS'
}, async () => {
  assert.match(native.permissionsSource, /browser-use-site-permissions-column-\$\{e\}/);
  const browser=await chromium.launch({headless:true});
  try {
    for(const mode of ['dark','light']) {
      const page=await browser.newPage({viewport:{width:850,height:600}});
      const table=(id,semantic=true)=>`<table id="${id}" class="${native.permissionsClass}" data-page-size="2" style="grid-template-columns:160px repeat(4,240px) 48px;scroll-padding-inline:160px 48px">
        <thead class="sticky bg-surface"><tr class="text-secondary"><th>Website</th><th ${semantic?'id="browser-use-site-permissions-column-origin"':''}>Browsing</th><th>Download</th><th>Upload</th><th>CDP</th><th><button disabled aria-label="Previous">Back</button><button aria-label="Next">Next</button></th></tr>
        <tr><td>Default</td>${Array.from({length:4},()=>'<td><button aria-haspopup="menu" aria-expanded="false" class="bg-primary-soft-alpha border border-default text-default">Ask</button></td>').join('')}<td></td></tr></thead>
        <tbody><tr><td>Example</td><td>Ask</td><td>Ask</td><td>Ask</td><td>Ask</td><td><button aria-label="Delete">Delete</button></td></tr></tbody></table>`;
      await page.setContent(`<html data-theme="${mode}"><head><style>${native.css}\n${native.permissionsCss}</style><style>body{margin:20px;background:linear-gradient(90deg,#fff,#000)}.group\\/settings{width:700px}button{padding:4px}</style></head><body><div class="group/settings">${table('permissions')}${table('unrelated',false)}</div></body></html>`);
      const read=()=>page.locator('table,thead,tbody,tr,td,th,button').evaluateAll(es=>es.map(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {rect:[r.x,r.y,r.width,r.height],radius:s.borderRadius,position:s.position,overflow:s.overflow,grid:s.gridTemplateColumns,border:s.borderWidth,font:s.font,color:s.color,disabled:e.disabled,tabIndex:e.tabIndex,expanded:e.getAttribute('aria-expanded')};}));
      const before=await read();
      const unrelated=await page.locator('#unrelated th,#unrelated td').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor));
      await page.addStyleTag({content:theme});
      await page.evaluate(mode=>{document.documentElement.classList.add('forge-ink-mountain');document.documentElement.dataset.forgeNativeTheme=mode;},mode);
      assert.deepEqual(await read(),before);
      assert.deepEqual(await page.locator('#unrelated th,#unrelated td').evaluateAll(es=>es.map(e=>getComputedStyle(e).backgroundColor)),unrelated);
      const fill=await page.locator('#permissions td').first().evaluate(e=>getComputedStyle(e).backgroundColor);
      assert.equal(fill,mode==='dark'?'color(srgb 0.25098 0.298039 0.345098)':'color(srgb 0.968627 0.976471 0.984314)');
      assert.equal(await page.locator('#permissions thead').evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
      await page.locator('#permissions tbody').evaluate(e=>{e.scrollLeft=200;});
      assert.ok(await page.locator('#permissions tbody').evaluate(e=>e.scrollLeft)>0);
      await page.locator('#permissions button[aria-haspopup="menu"]').first().focus();
      assert.equal(await page.locator('#permissions button[aria-haspopup="menu"]').first().evaluate(e=>e===document.activeElement),true);
      await page.close();
    }
  } finally {await browser.close();}
});

test('Add suggestion groups use one reading material in both modes without changing native row states', {
  skip: !native && 'Requires the installed native UI CSS'
}, async () => {
  assert.match(native.source, /data-mention-list-scroll-area/);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
      await page.setContent(`<html data-theme="${mode}"><head><style>${native.css}</style><style>
        body{margin:0;padding:30px;background:linear-gradient(90deg,#000,#fff);font:16px sans-serif}
        #menu{width:520px;border-radius:20px;padding:8px}
        #list{height:220px;overflow:auto}button{display:block;padding:12px;width:100%;text-align:left}
      </style></head><body><div id="menu" class="${native.suggestionClass}"><div id="list" data-mention-list-scroll-area>
        <div><div id="heading" class="sticky top-0 bg-surface-elevated-secondary">Add</div>
          <button id="normal" data-list-navigation-item style="opacity:var(--opacity-menu-row,.75)">Files <span id="description" class="text-codex-description">Choose local documents</span></button>
          <button id="selected" data-list-navigation-item aria-current="true" class="bg-menu-item-highlighted">Selected <span class="text-codex-description">Current row</span></button>
          <button id="disabled" disabled class="opacity-50">Unavailable</button>
        </div><div><div class="sticky top-0 bg-surface-elevated-secondary">Plugins</div><button data-list-navigation-item>Example plugin</button></div>
      </div></div><div id="unrelated" class="sticky bg-surface-elevated-secondary">Unrelated heading</div></body></html>`);
      const readGeometry = () => page.locator('#menu,#list,button,.sticky').evaluateAll(nodes => nodes.map(e => {
        const s=getComputedStyle(e),r=e.getBoundingClientRect();return {rect:[r.x,r.y,r.width,r.height],radius:s.borderRadius,position:s.position,padding:s.padding,disabled:e.disabled,tabIndex:e.tabIndex};
      }));
      const before=await readGeometry();
      const unrelated=await page.locator('#unrelated').evaluate(e=>getComputedStyle(e).backgroundColor);
      await page.addStyleTag({content:theme});
      await page.evaluate(mode=>{document.documentElement.classList.add('forge-ink-mountain');document.documentElement.dataset.forgeNativeTheme=mode;},mode);
      assert.deepEqual(await readGeometry(),before);
      const paint=await page.locator('#menu').evaluate(e=>({background:getComputedStyle(e).backgroundColor,filter:getComputedStyle(e).backdropFilter,ink:getComputedStyle(e).color}));
      assert.match(paint.background,/0\.94/);
      assert.match(paint.filter,/blur/);
      const headingRgba=await page.locator('#heading').evaluate(e=>{const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.fillStyle=getComputedStyle(e).backgroundColor;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];});
      assert.deepEqual(headingRgba,mode==='dark'?[64,76,88,255]:[247,249,251,255]);
      assert.equal(await page.locator('#description').evaluate(e=>getComputedStyle(e).color),mode==='dark'?'rgb(208, 210, 211)':'rgb(48, 58, 50)');
      assert.equal(await page.locator('#normal').evaluate(e=>getComputedStyle(e).opacity),'1');
      assert.equal(await page.locator('#disabled').evaluate(e=>getComputedStyle(e).opacity),'0.5');
      assert.equal(await page.locator('#unrelated').evaluate(e=>getComputedStyle(e).backgroundColor),unrelated);
      await page.locator('#normal').focus();
      assert.equal(await page.locator('#normal').evaluate(e=>e===document.activeElement),true);
      await page.close();
    }
  } finally {await browser.close();}
});

// Deliberately change native sizing utilities while retaining the public DOM
// hooks verified by native-asar-ui-contract. This is a drift fixture, not a
// screenshot or acceptance record from the running application.
test('semantic paint survives utility changes and preserves positioning wrappers', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
      await page.setContent(`<html><head><style>
        body { margin: 0; color: ${mode === 'dark' ? '#eeeeee' : '#182019'}; }
        #root { padding: 20px; display: grid; gap: 12px; }
        [data-sample] { background: ${mode === 'dark' ? '#303030' : '#f0f0f0'}; }
        [data-sample]:not(#positioner) { padding: 8px; border-radius: 17px; }
        #summary header::before { content: ''; position: absolute; inset: -8px 0 100%; background: #303030; }
        #header::before, #unrelated-header::before { content: ''; position: absolute; inset: 0; background: #303030; }
        #header, #unrelated-header { position: relative; height: 30px; }
        #positioner { background: transparent; }
        #settings-header { position: sticky; top: 0; }
        #settings-header::after { content: ''; position: absolute; inset: 100% 0 -10px; background: linear-gradient(#303030, transparent); }
        #summary header { position: sticky; top: 8px; }
      </style></head><body><div id="root">
        <div id="unrelated-root-child" data-sample>Native component</div>
        <div id="catalog" data-app-shell-main-surface data-sample>
          <div id="header" data-sticky style="--app-shell-titlebar-left-inset:0px"><span>Catalog</span></div>
        </div>
        <div id="unrelated-header" data-sticky class="_shell_example_1"><div class="_content_example_1">Unrelated component</div></div>
        <div id="positioner" data-sample role="tooltip"><div id="preview" data-sample data-thread-user-message-navigation-tooltip-preview>Message preview</div></div>
        <div id="summary" data-sample data-summary-panel-variant="dynamic-isle"><section><header id="summary-header" class="sticky">Summary</header><button data-slot="thread-summary-panel-item-button">Native action</button></section></div>
        <div id="settings" data-sample class="electron:bg-surface"><div class="group/settings">
          <div id="settings-header" data-sample class="sticky"><input value="Native search"></div>
          <div id="settings-card" data-sample style="background-color:var(--color-background-panel,#303030)"><button aria-label="Preference">Change</button></div>
          <div data-testid="theme-preview"><div id="theme-swatch" data-sample style="background-color:var(--color-background-panel,#ff00ff)">Preview</div></div>
        </div></div>
      </div></body></html>`);
      const read = () => page.locator('[data-sample], header, button, input').evaluateAll(nodes => nodes.map(node => {
        const s = getComputedStyle(node), r = node.getBoundingClientRect();
        return { id: node.id, rect: [r.x, r.y, r.width, r.height], radius: s.borderRadius,
          color: s.color, pointer: s.pointerEvents, tabIndex: node.tabIndex,
          bg: s.backgroundColor, image: s.backgroundImage, blur: s.backdropFilter };
      }));
      const before = await read();
      await page.addStyleTag({ content: theme });
      await page.evaluate(mode => {
        const root = document.documentElement;
        root.classList.add('forge-ink-mountain');
        root.dataset.forgeNativeTheme = mode;
        root.dataset.forgeBackgroundReady = 'true';
      }, mode);
      const after = await read();
      before.forEach((base, index) => {
        for (const key of ['rect', 'radius', 'color', 'pointer', 'tabIndex']) {
          assert.deepEqual(after[index][key], base[key], `${mode} ${base.id} ${key}`);
        }
      });
      for (const id of ['unrelated-root-child', 'positioner', 'theme-swatch']) {
        assert.deepEqual(after.find(node => node.id === id), before.find(node => node.id === id), `${id} is not a theme paint owner`);
      }
      const value = id => after.find(node => node.id === id);
      assert.match(value('preview').image, /linear-gradient/);
      assert.equal(value('summary').image, 'none');
      assert.equal(value('summary').blur, 'none');
      assert.equal(value('summary-header').bg, value('summary').bg);
      assert.equal(await page.locator('#summary-header').evaluate(node => getComputedStyle(node, '::before').backgroundColor), value('summary').bg);
      assert.equal(value('settings').bg, 'rgba(0, 0, 0, 0)');
      assert.match(value('settings-card').image, /linear-gradient/);
      assert.equal(value('settings-header').bg, 'rgba(0, 0, 0, 0)');
      assert.equal(await page.locator('#settings-header').evaluate(node => getComputedStyle(node, '::after').backgroundImage), 'none');
      assert.equal(await page.locator('#header').evaluate(node => getComputedStyle(node, '::before').backdropFilter), 'blur(12px)');
      assert.equal(await page.locator('#unrelated-header').evaluate(node => getComputedStyle(node, '::before').backdropFilter), 'none');
      assert.equal(value('catalog').bg, mode === 'dark' ? 'rgba(20, 24, 28, 0.86)' : 'rgba(247, 249, 251, 0.9)');
      await page.locator('input').fill('Still editable');
      assert.equal(await page.locator('input').inputValue(), 'Still editable');
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('thread fade removal stays inside the native scroll or footer owner', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<html class="forge-ink-mountain" data-forge-background-ready="true"><head><style>
      .paint { height: 20px; background: linear-gradient(#333, transparent); }
    </style></head><body><div id="root">
      <div data-thread-scroll-footer="true"><div id="footer" aria-hidden="true" class="paint pointer-events-none bg-gradient-to-t"></div></div>
      <div class="thread-scroll-container"><div id="reservation" aria-hidden="true" class="paint pointer-events-none bg-gradient-to-t"></div></div>
      <div role="dialog"><div id="dialog" aria-hidden="true" class="paint pointer-events-none bg-gradient-to-t from-surface via-surface"></div></div>
    </div></body></html>`);
    await page.addStyleTag({ content: theme });
    const paints = await page.locator('.paint').evaluateAll(nodes => nodes.map(node => ({ id: node.id, image: getComputedStyle(node).backgroundImage })));
    assert.equal(paints.find(node => node.id === 'footer').image, 'none');
    assert.equal(paints.find(node => node.id === 'reservation').image, 'none');
    assert.match(paints.find(node => node.id === 'dialog').image, /linear-gradient/);
  } finally {
    await browser.close();
  }
});
