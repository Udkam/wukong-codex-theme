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
    const popoverCss = read(entries.find(entry => /webview[\\/]assets[\\/]popover-.*\.css$/.test(entry)));
    return { css, source, permissionsCss, permissionsSource, popoverCss,
      popoverClass: popoverCss.match(/\.(_Popover_[\w]+)\{/)[1],
      confirmationClass: css.match(/\.(_chatgptConfirmationSurface_[\w]+)\{/)[1],
      voicePickerClass: css.match(/\.(_voicePickerSurface_[\w]+)\{/)[1],
      permissionsClass: permissionsCss.match(/\.(_table_[\w]+)\{/)[1],
      suggestionClass: css.match(/\.(_suggestionMenu_[\w]+)\{/)[1],
      floatingClass: css.match(/\.(_floatingSurface_[\w]+)\{/)[1],
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

test('floating quick chat paints only the native carrier, preserving its drag frame and both sizes', {
  skip: !native && 'Requires the installed native UI CSS'
}, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
      await page.setContent(`<html data-theme="${mode}"><head><style>${native.css}</style><style>
        body{margin:0}#frame{position:absolute;right:12px;bottom:12px;width:572px;height:50px}
        #paint{position:absolute;left:6px;top:0;width:560px;height:44px}
        #frame[data-expanded]{height:106px}#frame[data-expanded] #paint{height:100px}
        #other{position:absolute;left:10px;top:10px;width:120px;height:60px}
      </style></head><body>
        <div id="frame" data-quick-chat-drag-handle="true" data-pip-obstacle="quick-chat" class="${native.floatingClass}">
          <div id="paint" class="${native.floatingClass} bg-surface-elevated-secondary"></div>
          <input aria-label="Message" style="position:relative;margin:10px">
        </div><div id="other" class="${native.floatingClass} bg-surface-canvas"></div>
      </body></html>`);
      const measure = () => page.locator('#frame,#paint,#other,input').evaluateAll(nodes => nodes.map(e => {
        const s=getComputedStyle(e),r=e.getBoundingClientRect();return {rect:[r.x,r.y,r.width,r.height],radius:s.borderRadius,padding:s.padding,position:s.position};
      }));
      const before=await measure();
      await page.locator('#frame').evaluate(e=>e.dataset.expanded='true');
      const expanded=await measure();
      await page.addStyleTag({content:theme});
      await page.evaluate(mode=>{document.documentElement.classList.add('forge-ink-mountain');document.documentElement.dataset.forgeNativeTheme=mode;},mode);
      assert.deepEqual(await measure(),expanded);
      const paint = id => page.locator(id).evaluate(e=>{const s=getComputedStyle(e);return {bg:s.backgroundColor,image:s.backgroundImage,blur:s.backdropFilter,shadow:s.boxShadow};});
      assert.deepEqual(await paint('#frame'),{bg:'rgba(0, 0, 0, 0)',image:'none',blur:'none',shadow:'none'});
      for (const id of ['#paint','#other']) {
        const material=await paint(id);
        assert.notEqual(material.bg,'rgba(0, 0, 0, 0)');
        assert.match(material.blur,/blur/);
        assert.match(material.image,/linear-gradient/);
      }
      await page.locator('#frame').evaluate(e=>delete e.dataset.expanded);
      assert.deepEqual(await measure(),before);
      await page.getByRole('textbox',{name:'Message'}).fill('Still editable');
      assert.equal(await page.getByRole('textbox',{name:'Message'}).inputValue(),'Still editable');
      await page.close();
    }
  } finally { await browser.close(); }
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

test('command surfaces paint their content once and retain native input, list and row states', {
  skip: !native && 'Requires the installed native UI CSS'
}, async () => {
  assert.match(native.css, /\[cmdk-root\],\[data-cmdk-root\]/);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, colorScheme: mode });
      await page.setContent(`<html data-theme="${mode}" data-codex-window-type="electron"><head><style>${native.css}</style><style>
        body{margin:0;padding:20px;background:linear-gradient(90deg,#000,#fff)}
        #search{position:relative;inset:auto;transform:none;width:540px;max-width:none}
        #results{height:170px;max-height:170px}#standalone,#alias,#tray{width:360px;margin-top:20px}
        #transparent-menu,#transparent-dialog,#transparent-alert{width:250px;height:30px}
      </style></head><body>
        <div id="search" role="dialog" cmdk-dialog class="codex-dialog command-menu-dialog global-command-menu-dialog bg-transparent">
          <div id="search-surface" cmdk-root>
            <input id="query" cmdk-input role="combobox" aria-label="Search fixture" placeholder="Search chats">
            <div id="results" cmdk-list role="listbox" aria-label="Results">
              <div cmdk-group><div id="heading" cmdk-group-heading class="text-tertiary">Chats</div><div cmdk-group-items>
                <div id="normal" cmdk-item role="option" aria-selected="false" data-command-menu-has-results="true">Normal <span id="description" class="text-codex-description">Project name</span></div>
                <div id="selected" cmdk-item role="option" aria-selected="true" data-selected="true">Selected result</div>
                <div id="disabled" cmdk-item role="option" aria-disabled="true" data-disabled="true">Unavailable result</div>
                <div id="loading" cmdk-item role="option" data-command-menu-loading="true" aria-selected="true">Loading</div>
                ${Array.from({ length: 12 }, (_, index) => `<div cmdk-item role="option">Result ${index + 1}</div>`).join('')}
              </div></div>
            </div>
          </div>
        </div>
        <div id="transparent-menu" role="menu" class="bg-transparent">Positioning menu</div>
        <div id="transparent-dialog" role="dialog" class="bg-transparent">Positioning dialog</div>
        <div id="transparent-alert" role="alertdialog" class="bg-transparent">Positioning alert</div>
        <div id="painted-dialog" role="dialog" class="bg-surface-elevated-secondary">Ordinary dialog</div>
        <div id="image-dialog" role="dialog" class="bg-surface-elevated-secondary"><img class="object-contain" alt="Preview"></div>
        <div id="standalone" cmdk-root><input cmdk-input aria-label="Standalone command"><div cmdk-list><div cmdk-item>Independent command menu</div></div></div>
        <div id="alias" data-cmdk-root><input cmdk-input aria-label="Alias command"><div data-cmdk-list>Alternate attribute</div></div>
        <div id="tray" class="${native.topTrayClass}" data-composer-expanded-top-tray><div id="tray-command" cmdk-root><div cmdk-list>Add menu</div></div></div>
      </body></html>`);
      const measure = () => page.locator('body *').evaluateAll(nodes => nodes.map(node => {
        const s = getComputedStyle(node), r = node.getBoundingClientRect();
        return { id: node.id, rect: [r.x, r.y, r.width, r.height], radius: s.borderRadius,
          padding: s.padding, font: s.font, border: s.borderWidth, position: s.position,
          overflow: s.overflow, tabIndex: node.tabIndex,
          disabled: node.getAttribute('aria-disabled'), selected: node.getAttribute('aria-selected') };
      }));
      const material = id => page.locator(id).evaluate(node => {
        const s = getComputedStyle(node);
        return { background: s.backgroundColor, image: s.backgroundImage, blur: s.backdropFilter, shadow: s.boxShadow };
      });
      const states = () => page.locator('#normal,#selected,#disabled,#loading').evaluateAll(nodes => nodes.map(node => {
        const s = getComputedStyle(node);
        return { id: node.id, opacity: s.opacity, cursor: s.cursor, background: s.backgroundColor };
      }));
      const before = await measure(), nativeStates = await states();
      const imagePreview = await material('#image-dialog');
      await page.addStyleTag({ content: theme });
      await page.evaluate(mode => {
        document.documentElement.classList.add('forge-ink-mountain');
        document.documentElement.dataset.forgeNativeTheme = mode;
      }, mode);
      assert.deepEqual(await measure(), before, `${mode}: native geometry and attributes`);
      assert.deepEqual(await states(), nativeStates, `${mode}: selected, disabled and loading row paint`);
      for (const id of ['#search', '#transparent-menu', '#transparent-dialog', '#transparent-alert', '#query', '#results', '#tray-command']) {
        assert.deepEqual(await material(id), {
          background: 'rgba(0, 0, 0, 0)', image: 'none', blur: 'none', shadow: 'none'
        }, `${mode}: ${id} must not create a second material layer`);
      }
      for (const id of ['#search-surface', '#standalone', '#alias', '#painted-dialog', '#tray']) {
        const paint = await material(id);
        assert.notEqual(paint.background, 'rgba(0, 0, 0, 0)', `${mode}: ${id} visible fill`);
        assert.match(paint.blur, /blur\(/, `${mode}: ${id} glass owner`);
      }
      assert.deepEqual(await material('#image-dialog'), imagePreview, `${mode}: image preview retains native paint`);
      const ink = await page.locator('#search-surface').evaluate(node => {
        const s = getComputedStyle(node);
        return { primary: s.color, secondary: s.getPropertyValue('--color-codex-description').trim(), tertiary: s.getPropertyValue('--color-text-tertiary').trim() };
      });
      assert.equal(ink.primary, mode === 'dark' ? 'rgb(244, 240, 232)' : 'rgb(24, 32, 25)');
      assert.notEqual(ink.secondary, '');
      assert.notEqual(ink.tertiary, '');
      await page.getByRole('combobox', { name: 'Search fixture' }).focus();
      await page.keyboard.type('Theme search');
      assert.equal(await page.locator('#query').inputValue(), 'Theme search');
      assert.equal(await page.locator('#query').evaluate(node => node === document.activeElement), true);
      await page.locator('#results').evaluate(node => { node.scrollTop = node.scrollHeight; });
      assert.ok(await page.locator('#results').evaluate(node => node.scrollTop) > 0, 'Native result list remains scrollable');
      await page.close();
    }
  } finally { await browser.close(); }
});

test('semantic and module popup carriers receive glass without painting their positioning wrappers', {
  skip: !native && 'Requires the installed native UI CSS'
}, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 1100, height: 1000 }, colorScheme: mode });
      await page.setContent(`<html data-theme="${mode}"><head><style>${native.css}\n${native.popoverCss}</style><style>
        body{margin:20px;background:linear-gradient(90deg,#000,#fff)}
        #fixture{display:flex;flex-direction:column;gap:20px;align-items:flex-start}
        .codex-dialog{position:relative;inset:auto;transform:none;width:360px}
      </style></head><body><div id="fixture">
        <div id="positioner" data-radix-popper-content-wrapper><div id="slot-popup" data-slot="popover-content" class="bg-surface rounded-xl border border-default"><button>Popover action</button></div></div>
        <div id="transition"><div id="module-popup" role="dialog" class="${native.popoverClass}"><input aria-label="Popover input"></div></div>
        <div id="confirmation" role="dialog" class="codex-dialog ${native.confirmationClass}"><button class="text-danger">Destructive action</button></div>
        <div id="voice-picker" role="dialog" class="codex-dialog ${native.voicePickerClass}"><button aria-pressed="true">Selected voice</button></div>
        <div id="unrelated-popover" class="${native.popoverClass}">Outside popup role</div>
        <div id="unrelated-confirmation" class="${native.confirmationClass}">Outside dialog surface</div>
      </div></body></html>`);
      const read = () => page.locator('#fixture,#fixture *').evaluateAll(nodes => nodes.map(node => {
        const s = getComputedStyle(node), r = node.getBoundingClientRect();
        return { id: node.id, geometry: [r.x, r.y, r.width, r.height, s.borderRadius, s.borderWidth, s.padding, s.font, s.overflow, s.transform, s.position],
          color: s.color, background: s.backgroundColor, image: s.backgroundImage, blur: s.backdropFilter, shadow: s.boxShadow };
      }));
      const before = await read();
      await page.addStyleTag({ content: theme });
      await page.evaluate(mode => { document.documentElement.classList.add('forge-ink-mountain'); document.documentElement.dataset.forgeNativeTheme = mode; }, mode);
      const after = await read();
      before.forEach((node, index) => {
        assert.deepEqual(after[index].geometry, node.geometry, `${mode}: ${node.id} native geometry`);
        assert.equal(after[index].color, node.color, `${mode}: ${node.id} native control colours`);
      });
      for (const id of ['positioner', 'transition', 'unrelated-popover', 'unrelated-confirmation']) {
        assert.deepEqual(after.find(node => node.id === id), before.find(node => node.id === id), `${mode}: ${id} is not a theme carrier`);
      }
      for (const id of ['slot-popup', 'module-popup', 'confirmation', 'voice-picker']) {
        const material = after.find(node => node.id === id);
        assert.notEqual(material.background, 'rgba(0, 0, 0, 0)', `${mode}: ${id} visible fill`);
        assert.match(material.blur, /blur\(/, `${mode}: ${id} glass surface`);
      }
      await page.getByRole('textbox', { name: 'Popover input' }).fill('Still editable');
      assert.equal(await page.getByRole('textbox', { name: 'Popover input' }).inputValue(), 'Still editable');
      await page.close();
    }
  } finally { await browser.close(); }
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
