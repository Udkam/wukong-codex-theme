import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { createTranscriptOcclusion, RESTORE_EXPRESSION } from '../runtime/injection-plan-v13.mjs';
import { loadNativeBundle, nodes, ownNodes, prop, text, key, nativeFunction, presentationHarness } from './native-bundle-current-helper.mjs';
import { quotaHtml } from './native-quota-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const provenance = JSON.parse(fs.readFileSync(new URL('../docs/native-asar-provenance.json', import.meta.url), 'utf8'));
const archive = process.env.CODEX_LOCAL_ASAR || path.join(process.env.ProgramFiles || '', 'WindowsApps', provenance.packageDirectoryName, provenance.asarRelativePath);
const skip = !fs.existsSync(archive) && 'Requires the installed native ASAR; CODEX_LOCAL_ASAR selects an updated client';
const artifacts = fileURLToPath(new URL('../work/composer-occlusion-20261125/transcript-tests/', import.meta.url));
const attribute = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
const marker = 'data-forge-transcript-occlusion';
const maskProperty = '--forge-transcript-mask';
const sizeProperty = '--forge-transcript-mask-size';
const offsetProperty = '--forge-transcript-mask-y';
const one = (items, label) => { assert.equal(items.length, 1, label); return items[0]; };
const literals = node => nodes(node).map(text).filter(Boolean);
let cached;

const loadNative = () => {
  if (cached) return cached;
  const bundle = loadNativeBundle({ archive });
  const record = one(bundle.findModules(['data-thread-scroll-footer', 'data-thread-composer-backdrop']),
    'The current ThreadScrollLayout source must remain unique');
  const render = nativeFunction(record, '"data-thread-scroll-footer"');
  const calls = render.nodes.filter(node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression');
  const viewport = one(calls.filter(node => prop(node.arguments[1], 'data-mcp-app-scroll-host')),
    'The real native scroll viewport must remain identifiable');
  const children = prop(viewport.arguments[1], 'children');
  assert.equal(children?.type, 'ArrayExpression', 'The native scroller retains transcript and footer slots');
  const wrapper = children.elements[0];
  assert.equal(text(wrapper?.arguments?.[0]), 'div', 'The first scroll child remains the transcript wrapper');
  const transcript = prop(wrapper.arguments[1], 'children')?.elements?.[0];
  assert.ok(prop(transcript?.arguments?.[1], 'data-thread-user-message-navigation-content'),
    'The actual message-content marker must be a direct child of the masked wrapper');
  assert.equal(children.elements[1]?.type, 'ConditionalExpression', 'The default footer remains a sibling of the wrapper');
  assert.equal(text(children.elements[1].test.left), 'compact', 'Compact placement must retain its distinct native branch');
  const footer = one(calls.filter(node => text(prop(node.arguments[1], 'data-thread-scroll-footer')) === 'true'),
    'The native footer measurement owner must remain unique');
  const outer = one(calls.filter(node => prop(node.arguments[1], 'children') === footer),
    'The native footer retains its independently positioned outer shell');
  const classes = {
    wrapper: one(literals(prop(wrapper.arguments[1], 'className')).filter(value => value.includes('[container-name:thread-content]')),
      'The transcript wrapper retains its native container and clipping classes'),
    scroller: one(literals(prop(viewport.arguments[1], 'className')).filter(value => /^scrollContainer-\S+$/.test(value)),
      'The viewport CSS module class must come from the installed renderer'),
    transcript: one(literals(prop(transcript.arguments[1], 'className')).filter(value => /^transcriptContent-\S+$/.test(value)),
      'The transcript CSS module class must come from the installed renderer'),
    footer: one(literals(prop(outer.arguments[1], 'className')).filter(value => /^footer-\S+$/.test(value)),
      'The footer CSS module class must come from the installed renderer')
  };
  assert.ok(record.source.includes('--thread-scroll-padding-bottom') && record.source.includes('--thread-scroll-seeded-padding-bottom') &&
    record.source.includes('16*('), 'The native measured and seeded footer-height interfaces must remain present');
  const sharedCss = bundle.stylesheetAssets(`.${classes.scroller}`)[0];
  assert.ok(sharedCss, 'The installed native scroll/footer stylesheet must exist');
  const railRecord = one(bundle.findModules(['"data-composer-rail-item"', '"data-composer-rail"']), 'The native Rail/Item registry remains unique');
  const item = nativeFunction(railRecord, '"data-composer-rail-item"'), rail = nativeFunction(railRecord, '"data-composer-rail"');
  const harness = presentationHarness(bundle), registry = harness.load(railRecord.id).l;
  const member = call => call?.callee?.type === 'SequenceExpression' ? call.callee.expressions.at(-1) : call?.callee;
  const contextRead = one(item.nodes.filter(node => node.type === 'CallExpression' && key(member(node)?.property) === 'useContext'), 'Rail.Item retains one private context reader');
  const contextName = contextRead.arguments[0]?.name;
  const definition = ownNodes(railRecord.ast).find(node => node.type === 'VariableDeclarator' && node.id.name === contextName);
  assert.equal(key(member(definition?.init)?.property), 'createContext', 'The rail context remains a pure React presentation boundary');
  assert.equal(definition.init.arguments[0]?.value, null, 'The native rail context default remains null');
  assert.ok(rail.nodes.some(node => node.type === 'CallExpression' && node.arguments[0]?.object?.name === contextName && key(node.arguments[0].property) === 'Provider'));
  const reactImport = bundle.imports(railRecord)[member(contextRead).object.name], react = harness.modules[reactImport.id];
  const contexts = [], readContext = react.useContext;
  react.useContext = context => { contexts.push(context); return readContext(context); };
  try { registry.Item({ children: null }); } finally { react.useContext = readContext; }
  const context = one(contexts, 'Only the actual Rail.Item context is captured');
  const renderItem = options => {
    harness.contexts.set(context, { embedded: false, placement: 'above', shouldUseReducedMotion: true });
    try { return registry.Item(options); } finally { harness.contexts.delete(context); }
  };
  const renderNativeRail = ({ portal = false } = {}) => {
    const items = [['native-goal', 'Paused goal', 'Continue after review'], ['native-queue', 'Queued message', 'Waiting to send']].map(([id, title, meta]) =>
      renderItem({ id, children: registry.Row({ title, meta, onClick: () => {} }) }));
    let children = items;
    if (portal) {
      // This is the final DOM of the actual Target + createPortal relationship;
      // the native subscription/timer-bearing Portal component never executes.
      const target = registry.Target(); target.props.children = items; children = target;
      assert.ok(target.props['data-above-composer-attached-portal']);
      assert.ok(railRecord.source.includes('createPortal'), 'The real Portal must remain source-bound to its native target');
    }
    const tree = registry({ embedded: false, placement: 'above', children }); tree.props.id = 'native-rail';
    return quotaHtml(tree);
  };
  const railClass = one(literals(rail.ast).filter(value => /^rail-\S+$/.test(value)), 'The native Rail CSS class remains source-derived');
  const railCss = bundle.stylesheetAssets('.' + railClass)[0]; assert.ok(railCss, 'The installed native Rail stylesheet exists');
  assert.ok(bundle.read(railCss).includes('overflow:clip') && bundle.read(railCss).includes('border-start-start-radius'),
    'The attached rail owns ancestor clipping and logical corner radii');
  const sheets = new Set([...bundle.baseStylesheets(), sharedCss, railCss]);
  cached = { classes, css: `${bundle.layerOrder}\n${[...sheets].map(asset => bundle.read(asset)).join('\n')}`, record, renderNativeRail };
  return cached;
};

// Only source-proven native layout classes and semantic ownership are copied.
// Test content, wallpaper, input slots and rail dimensions are deterministic;
// no native app hooks, business state, chat data or application module runs.
const fixture = (native, { compact = false, rows = 65, mode = 'dark' } = {}) => {
  const c = native.classes;
  const messages = Array.from({ length: rows }, (_, index) => `<button class="fixture-message" id="message-${index}"><span>Paragraph ${index + 1}: readable text and a long mathematical expression.</span></button>`).join('');
  const transcript = `<div id="transcript" class="${attribute(c.wrapper)}" style="--fixture-user-style:retained"><div id="message-content" data-thread-user-message-navigation-content="true" class="${c.transcript} relative flex flex-1 shrink-0 flex-col w-full pb-8">${messages}</div><div aria-hidden="true" class="pointer-events-none mt-auto w-full shrink-0" style="height:var(--thread-scroll-padding-bottom)"></div></div>`;
  const footer = `<div id="footer-shell" class="${c.footer} pointer-events-none absolute inset-x-0 bottom-0 z-20"><div id="footer" data-thread-scroll-footer="true" class="relative w-full shrink-0 after:block after:h-(--thread-composer-bottom-inset)"><div data-pip-obstacle="thread-footer" data-thread-composer-backdrop="true" class="relative z-10 flex flex-col *:pointer-events-auto"><div id="composer" data-composer-body data-composer-surface-variant="default"><textarea id="editor" aria-label="Fixture input">Fixture draft</textarea><button id="send">Send</button></div></div></div></div>`;
  const scroller = `<div id="scroller" data-mcp-app-scroll-host="true" class="${c.scroller} thread-scroll-container overflow-x-hidden overflow-y-auto flex flex-col ${compact ? 'min-h-0 flex-1' : 'h-full'}" style="--thread-scroll-padding-bottom:154px">${transcript}${compact ? '' : footer}</div>`;
  return `<html class="forge-ink-mountain electron-${mode}" data-theme="${mode}" data-forge-native-theme="${mode}" data-forge-background-ready="true" data-codex-window-type="electron"><head><style>${native.css}</style><style>${theme}</style><style>
    body{margin:0;font-family:Arial,sans-serif}#fixture-wallpaper{position:fixed;inset:0;pointer-events:none;background:repeating-linear-gradient(117deg,#173345 0 23px,#496979 23px 49px)}
    #root{position:relative;height:100vh;padding:20px}#layout{position:relative;width:min(760px,calc(100vw - 40px));height:560px;--fixture-composer-height:138px}
    #layout.compact{display:flex;flex-direction:column}#scroller{scroll-behavior:auto;overflow-anchor:none}
    #message-content{padding-inline:12px}.fixture-message{display:block;flex:none;width:100%;height:32px;padding:0 8px;border:0;border-radius:0;text-align:left;color:#fff;background:repeating-linear-gradient(0deg,#df36c6 0 3px,transparent 3px 12px);font-size:15px;line-height:32px}
    #composer{position:relative;margin-inline:54px;height:var(--fixture-composer-height);padding:14px 18px;border:0;border-radius:24px;background:rgba(46,65,78,.65);backdrop-filter:none}
    #editor{display:block;width:100%;height:64px;resize:none;padding:0;border:0;outline:0;background:transparent;color:#fff;caret-color:transparent}
    #send{position:absolute;right:16px;bottom:12px;padding:6px 12px;border:0;border-radius:20px;color:white;background:#2866b8}
    .fixture-rail{position:absolute;z-index:25;left:54px;right:54px;height:38px;padding:8px 16px;border-radius:18px;background:rgba(46,65,78,.72);color:white;pointer-events:auto}
    #goal-rail{bottom:calc(var(--fixture-composer-height) + 16px)}#queue-rail{bottom:calc(var(--fixture-composer-height) + 62px)}
  </style></head><body><div id="fixture-wallpaper" aria-hidden="true"></div><div id="root"><main data-app-shell-main-content-layout data-app-shell-active-page="true"><div id="layout" data-request-input-activity-root="true" class="group/thread-scroll-layout relative ${compact ? 'compact' : 'h-full flex-1'}">${scroller}${compact ? footer : ''}<button id="goal-rail" class="fixture-rail" data-composer-rail-item style="display:none">Goal</button><button id="queue-rail" class="fixture-rail" data-composer-rail-item style="display:none">Queued message</button></div></main><div id="decoy" class="thread-scroll-container"><div id="decoy-wrapper"><div><div data-thread-user-message-navigation-content="true">Nested unrelated content</div></div></div><div data-thread-scroll-footer="true"></div></div></div></body></html>`;
};

const settle = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const install = async (page, source = createTranscriptOcclusion.toString()) => {
  await page.evaluate(source => {
    window.fixtureStyleReads = 0;
    window.occlusion = (0, eval)(`(${source})`)({ document,
      getComputedStyle: (...args) => { window.fixtureStyleReads++; return getComputedStyle(...args); },
      requestAnimationFrame: callback => requestAnimationFrame(callback), cancelAnimationFrame: id => cancelAnimationFrame(id) });
    window.occlusion.refresh();
  }, source);
  await settle(page);
};
const geometry = page => page.evaluate(() => {
  const ids = ['scroller', 'transcript', 'message-content', 'footer-shell', 'footer', 'composer', 'editor', 'send'];
  return Object.fromEntries(ids.map(id => {
    const element = document.getElementById(id), rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    return [id, { rect: [rect.x, rect.y, rect.width, rect.height], scrollHeight: element.scrollHeight,
      scrollWidth: element.scrollWidth, scrollTop: element.scrollTop, font: style.font,
      background: style.backgroundColor, image: style.backgroundImage, filter: style.backdropFilter,
      radius: style.borderRadius, pointer: style.pointerEvents, value: element.value }];
  }));
});
const state = page => page.evaluate(({ marker, maskProperty, sizeProperty, offsetProperty }) => {
  const wrapper = document.getElementById('transcript'), rect = wrapper.getBoundingClientRect();
  const viewport = document.getElementById('scroller').getBoundingClientRect(), style = getComputedStyle(wrapper);
  return { marker: wrapper.getAttribute(marker), image: wrapper.style.getPropertyValue(maskProperty),
    size: wrapper.style.getPropertyValue(sizeProperty).split(/\s+/).map(parseFloat), expectedSize: [rect.width, viewport.height],
    offset: parseFloat(wrapper.style.getPropertyValue(offsetProperty)), expectedOffset: viewport.top - rect.top,
    clip: style.clipPath, mask: style.maskImage, mode: style.maskMode,
    owners: [...document.querySelectorAll(`[${marker}]`)].map(element => element.id),
    targets: window.occlusion.resizeTargets().map(element => element.id), userStyle: wrapper.style.getPropertyValue('--fixture-user-style') };
}, { marker, maskProperty, sizeProperty, offsetProperty });
const assertMask = snapshot => {
  assert.equal(snapshot.marker, 'true', 'Only the transcript wrapper receives the ownership marker');
  assert.deepEqual(snapshot.owners, ['transcript'], 'Footer, input, messages and nested decoys stay outside the mask owner');
  assert.match(snapshot.image, /^url\(["']?data:image\/svg\+xml/, 'The shape mask is an owned SVG rather than a full-width cutoff');
  assert.ok(Math.abs(snapshot.offset - snapshot.expectedOffset) <= 1, 'The viewport-sized mask follows the transcript content while scrolling');
  for (let index = 0; index < 2; index++) assert.ok(Math.abs(snapshot.size[index] - snapshot.expectedSize[index]) <= 1, 'Mask dimensions follow the wrapper width and actual scrollport height');
  assert.equal(snapshot.clip, 'none', 'No horizontal clip removes text beside the rounded input');
  assert.equal(snapshot.mode, 'luminance', 'White retains text and overlapping black surface shapes form one union');
  assert.notEqual(snapshot.mask, 'none', 'The actual protected surfaces own a visible mask');
  assert.equal(snapshot.userStyle, 'retained', 'Existing inline user styles survive ownership');
};
const pixels = buffer => PNG.sync.read(buffer);
const difference = (leftBuffer, rightBuffer) => {
  const left = pixels(leftBuffer), right = pixels(rightBuffer);
  assert.equal(left.width, right.width); assert.equal(left.height, right.height);
  let changed = 0;
  for (let offset = 0; offset < left.data.length; offset += 4) if ([0, 1, 2].some(channel =>
    Math.abs(left.data[offset + channel] - right.data[offset + channel]) > 1)) changed++;
  return changed;
};
// A CSS mask moves text into a composited layer and can change antialiasing.
// Compare retained text with a fully white mask in the same layer rather than
// misclassifying glyph-edge rasterization as clipped/changed message content.
const compositedReference = async (page, captureReference) => {
  const original = await page.locator('#transcript').evaluate(element => [element.style.getPropertyValue('mask-image'), element.style.getPropertyPriority('mask-image')]);
  await page.locator('#transcript').evaluate(element => element.style.setProperty('mask-image', 'linear-gradient(white,white)', 'important'));
  try { return await captureReference(); }
  finally { await page.locator('#transcript').evaluate((element, original) => original[0]
    ? element.style.setProperty('mask-image', ...original) : element.style.removeProperty('mask-image'), original); }
};
// Raster checks use the interior of the real CSS roundrect, excluding only
// two antialiasing pixels. The bounding-box corners intentionally retain text.
const roundrectDifference = (leftBuffer, rightBuffer, { radius = 24, inside = true } = {}) => {
  const left = pixels(leftBuffer), right = pixels(rightBuffer);
  assert.equal(left.width, right.width); assert.equal(left.height, right.height);
  const contains = (x, y, inset) => {
    const low = inset, highX = left.width - inset, highY = left.height - inset;
    if (x < low || x > highX || y < low || y > highY) return false;
    const r = Math.max(0, radius - inset);
    const centerX = Math.max(low + r, Math.min(highX - r, x));
    const centerY = Math.max(low + r, Math.min(highY - r, y));
    return (x - centerX) ** 2 + (y - centerY) ** 2 <= r ** 2;
  };
  let changed = 0;
  for (let y = 0; y < left.height; y++) for (let x = 0; x < left.width; x++) {
    if (inside ? !contains(x + .5, y + .5, 2) : contains(x + .5, y + .5, -2)) continue;
    const offset = (y * left.width + x) * 4;
    if ([0, 1, 2].some(channel => Math.abs(left.data[offset + channel] - right.data[offset + channel]) > 1)) changed++;
  }
  return changed;
};
const screenshotSide = async page => {
  const bounds = await page.locator('#composer').boundingBox();
  return page.screenshot({ clip: { x: bounds.x - 30, y: bounds.y + 12, width: 20, height: bounds.height - 24 }, animations: 'disabled', caret: 'hide' });
};
const capture = (page, id = 'composer') => page.locator('#' + id).screenshot({ animations: 'disabled', caret: 'hide' });
const wallpaperOnly = async (page, id = 'composer') => {
  const original = await page.locator('#transcript').evaluate(element => [element.style.getPropertyValue('visibility'), element.style.getPropertyPriority('visibility')]);
  await page.locator('#transcript').evaluate(element => element.style.setProperty('visibility', 'hidden', 'important'));
  try { return await capture(page, id); }
  finally { await page.locator('#transcript').evaluate((element, original) => original[0]
    ? element.style.setProperty('visibility', ...original) : element.style.removeProperty('visibility'), original); }
};
const mountNativeRails = async (page, { portal = false } = {}) => {
  const html = loadNative().renderNativeRail({ portal });
  await page.evaluate(html => {
    document.getElementById('native-rail')?.remove();
    document.getElementById('layout').style.setProperty('--home-composer-inline-inset', '54px');
    document.querySelector('[data-pip-obstacle="thread-footer"]').insertAdjacentHTML('afterbegin', html);
  }, html);
  await settle(page);
};
const nativeCornerPoints = async page => {
  const shape = await page.locator('#native-rail').evaluate(element => {
    const rect = element.getBoundingClientRect(), styles = getComputedStyle(element);
    return { radius: Math.max(parseFloat(styles.borderTopLeftRadius), parseFloat(styles.borderTopRightRadius)),
      overflow: styles.overflow, itemRadius: getComputedStyle(document.getElementById('native-goal')).borderTopLeftRadius,
      clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
  });
  await page.locator('#transcript').evaluate(element => element.style.setProperty('visibility', 'hidden', 'important'));
  let withRail, withoutRail;
  try {
    withRail = await page.screenshot({ clip: shape.clip, animations: 'disabled', caret: 'hide' });
    await page.locator('#native-rail').evaluate(element => element.style.setProperty('visibility', 'hidden', 'important'));
    withoutRail = await page.screenshot({ clip: shape.clip, animations: 'disabled', caret: 'hide' });
  } finally {
    await page.locator('#native-rail').evaluate(element => element.style.removeProperty('visibility'));
    await page.locator('#transcript').evaluate(element => element.style.removeProperty('visibility'));
  }
  // Chromium hit-testing can still report an overflow-clipping ancestor in
  // these corners. Compare actual native paint against wallpaper instead.
  const shown = pixels(withRail), absent = pixels(withoutRail), points = [];
  for (let y = 0; y < Math.ceil(shape.radius); y++) for (let x = 0; x < Math.ceil(shape.radius); x++) {
    for (const localX of [x, shown.width - x - 1]) {
      const offset = (y * shown.width + localX) * 4;
      if ([0, 1, 2].every(channel => Math.abs(shown.data[offset + channel] - absent.data[offset + channel]) <= 1)) points.push([localX, y]);
    }
  }
  return { ...shape, points };
};
const differenceAt = (leftBuffer, rightBuffer, points) => {
  const left = pixels(leftBuffer), right = pixels(rightBuffer); let changed = 0;
  assert.equal(left.width, right.width); assert.equal(left.height, right.height);
  for (const [x, y] of points) {
    const offset = (y * left.width + x) * 4;
    if ([0, 1, 2].some(channel => Math.abs(left.data[offset + channel] - right.data[offset + channel]) > 2)) changed++;
  }
  return changed;
};
const savePreview = async (page, mode) => {
  const directory = process.env.CODEX_TRANSCRIPT_PREVIEW_DIR;
  if (!directory) return;
  assert.ok(path.isAbsolute(directory), 'Preview output must use an explicit absolute task/project path');
  fs.mkdirSync(directory, { recursive: true });
  await mountNativeRails(page); await page.evaluate(() => window.occlusion.refresh());
  const wallpaper = fs.readFileSync(new URL('../themes/backgrounds/scenery-01.jpg', import.meta.url)).toString('base64');
  // The illustration keeps actual native Rail/Item/Row DOM and source CSS,
  // uses the repository's public wallpaper and synthetic text only.
  const cleanInk = await page.addStyleTag({ content: '.fixture-message{background:transparent!important}#fixture-wallpaper{background-image:url("data:image/jpeg;base64,' + wallpaper + '");background-size:cover;background-position:center}' });
  try {
    const clip = await page.locator('#layout').boundingBox();
    await page.screenshot({ path: path.join(directory, `${mode}-transcript-occlusion-fixture-20261125.png`), clip, animations: 'disabled', caret: 'hide' });
  } finally {
    await cleanInk.evaluate(element => element.remove());
    await page.evaluate(() => { document.getElementById('native-rail').remove(); window.occlusion.refresh(); });
  }
};
const withPage = async (browser, name, options, body) => {
  const page = await browser.newPage({ viewport: { width: 920, height: 640 }, colorScheme: options.mode || 'dark', reducedMotion: 'reduce' });
  try { await page.setContent(fixture(loadNative(), options)); await settle(page); await body(page); }
  catch (error) {
    fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, `${name}-failure.png`), fullPage: true }).catch(() => {});
    throw error;
  } finally { await page.close(); }
};

test('current native transcript/footer ownership remains source-bound', { skip }, () => {
  assert.ok(loadNative().record.source.includes('data-request-input-activity-root'));
});

test('transcript occlusion separates wallpaper and controls from scrolling message content', { skip }, async t => {
  const browser = await chromium.launch({ headless: true });
  try {
    await t.test('long transcript has no message paint or hit targets behind the composer, in both themes', async () => {
      for (const mode of ['dark', 'light']) await withPage(browser, `long-${mode}`, { mode }, async page => {
        await page.locator('#scroller').evaluate(element => { element.scrollTop = 420; });
        await settle(page);
        const before = await geometry(page), unmasked = await capture(page), wallpaper = await wallpaperOnly(page);
        assert.ok(roundrectDifference(unmasked, wallpaper) > 500, 'The unmasked negative control visibly reproduces message paint through the input');
        await install(page);
        assertMask(await state(page));
        assert.deepEqual(await geometry(page), before, 'Masking changes no footer material, font, layout, scroll range or input state');
        const masked = await capture(page), identityMask = await compositedReference(page, () => capture(page));
        assert.ok(roundrectDifference(masked, wallpaper) <= 2, 'The rounded input interior shows its original material over wallpaper without transcript paint');
        assert.ok(roundrectDifference(masked, identityMask, { inside: false }) <= 2, 'The roundrect corners retain the original message paint outside the input shape');
        const sideAfter = await screenshotSide(page), sideReference = await compositedReference(page, () => screenshotSide(page));
        assert.equal(difference(sideAfter, sideReference), 0, 'Text beside the input stays fully visible instead of being cut off across the viewport');
        const hits = await page.evaluate(() => {
          const layout = document.getElementById('layout').getBoundingClientRect();
          const footer = document.getElementById('footer').getBoundingClientRect();
          const at = (x, y) => document.elementFromPoint(x, y);
          const composer = document.getElementById('composer').getBoundingClientRect();
          return { above: !!at(layout.left + 22, footer.top - 30)?.closest('.fixture-message'),
            side: !!at(composer.left - 12, composer.top + 25)?.closest('[data-thread-user-message-navigation-content]'),
            corner: !!at(composer.left + 2, composer.top + 2)?.closest('[data-thread-user-message-navigation-content]'),
            input: at(composer.left + 50, composer.top + 30)?.id };
        });
        assert.equal(hits.above, true, 'Transcript above the input stays visible and clickable');
        assert.equal(hits.side, true, 'Text beside the input retains its native click target');
        assert.equal(hits.corner, true, 'Text outside the rounded corner retains its native click target');
        assert.equal(hits.input, 'editor', 'The input remains the frontmost editable surface');
        await page.locator('#editor').fill('Still editable');
        assert.equal(await page.locator('#editor').inputValue(), 'Still editable');
        await page.locator('#send').click();
        assert.equal(await page.locator('#send').evaluate(element => element === document.activeElement), true);

        const reads = await page.evaluate(async () => {
          const original = Element.prototype.getBoundingClientRect;
          let geometryReads = 0;
          Element.prototype.getBoundingClientRect = function (...args) { geometryReads++; return original.apply(this, args); };
          window.fixtureStyleReads = 0;
          try {
            const scroller = document.getElementById('scroller'); scroller.scrollTop += 180;
            scroller.dispatchEvent(new Event('scroll'));
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            return { geometryReads, styleReads: window.fixtureStyleReads };
          } finally { Element.prototype.getBoundingClientRect = original; }
        });
        assert.deepEqual(reads, { geometryReads: 0, styleReads: 0 }, 'Scrolling uses cached geometry and scrollTop without layout/style measurement');
        assertMask(await state(page));
        assert.ok(roundrectDifference(await capture(page), await wallpaperOnly(page)) <= 2, 'The roundrect follows a long transcript while scrolling');

        await savePreview(page, mode);
        await page.evaluate(() => window.occlusion.dispose());
        const disposed = await page.locator('#transcript').evaluate((element, marker) => ({ marker: element.hasAttribute(marker),
          owned: [...element.style].filter(name => name.startsWith('--forge-transcript-')), user: element.style.getPropertyValue('--fixture-user-style') }), marker);
        assert.deepEqual(disposed, { marker: false, owned: [], user: 'retained' }, 'Dispose restores the transcript without removing unrelated inline styles');
        assert.ok(roundrectDifference(await capture(page), await wallpaperOnly(page)) > 500, 'The negative control returns after disposal rather than hiding or relocating content');
      });
    });

    await t.test('footer growth and visible goal/queue rails update only their transcript binding', async () => {
      await withPage(browser, 'resize-and-rails', {}, async page => {
        await page.locator('#scroller').evaluate(element => { element.scrollTop = 480; });
        await install(page);
        const initial = await state(page);
        for (const id of ['scroller', 'footer', 'footer-shell']) assert.ok(initial.targets.includes(id), `${id} participates in the existing ResizeObserver`);
        const unprotectedMask = initial.image;
        await page.evaluate(() => {
          document.getElementById('layout').style.setProperty('--fixture-composer-height', '190px');
          window.occlusion.handleResize([{ target: document.getElementById('footer') }]);
        });
        assertMask(await state(page));
        assert.notEqual((await state(page)).image, unprotectedMask, 'Growing input height changes its actual rounded mask shape');
        await page.evaluate(() => {
          for (const id of ['goal-rail', 'queue-rail']) document.getElementById(id).style.display = 'block';
          window.occlusion.refresh();
        });
        const rails = await state(page); assertMask(rails);
        assert.ok(rails.targets.includes('goal-rail') && rails.targets.includes('queue-rail'), 'Visible native rails are measured and observed');
        assert.notEqual(rails.image, initial.image, 'Visible goal and queue surfaces join the protected union');
        await page.evaluate(() => {
          document.getElementById('queue-rail').style.height = '72px';
          window.occlusion.handleResize([{ target: document.getElementById('queue-rail') }]);
        });
        const grown = await state(page); assertMask(grown);
        assert.notEqual(grown.image, rails.image, 'A rail resize updates the protected roundrect');
        assert.ok(roundrectDifference(await capture(page, 'queue-rail'), await wallpaperOnly(page, 'queue-rail'), { radius: 18 }) <= 2, 'The queue interior shows wallpaper without transcript paint');
        await page.evaluate(() => { document.getElementById('queue-rail').remove(); window.occlusion.refresh(); });
        assertMask(await state(page));
        await page.setViewportSize({ width: 740, height: 700 });
        await page.evaluate(() => {
          document.getElementById('layout').style.height = '610px';
          window.occlusion.handleResize([{ target: document.getElementById('scroller') }]);
        });
        assertMask(await state(page));
        assert.ok(roundrectDifference(await capture(page), await wallpaperOnly(page)) <= 2, 'Resize and rail changes keep the composer free of underlying text');
        await page.evaluate(() => {
          const shell = document.getElementById('footer-shell'); window.fixtureDetachedFooter = shell;
          shell.remove(); window.occlusion.refresh();
        });
        assert.equal(await page.locator('#transcript').getAttribute(marker), null, 'Unmounting the native footer releases the transcript owner');
        await page.evaluate(() => { document.getElementById('scroller').append(window.fixtureDetachedFooter); window.occlusion.refresh(); });
        assertMask(await state(page));
        await page.evaluate(() => {
          const scroller = document.getElementById('scroller'); scroller.scrollTop += 50; scroller.dispatchEvent(new Event('scroll'));
          window.occlusion.dispose();
        });
        await settle(page);
        assert.equal(await page.locator(`[${marker}]`).count(), 0, 'Dispose cancels a pending scroll frame and removes every owner');
      });
    });

    await t.test('actual native attached goal and queue rails retain their ancestor-clipped silhouettes', async () => {
      for (const portal of [false, true]) await withPage(browser, 'native-rail-' + (portal ? 'portal' : 'direct'), {}, async page => {
        await mountNativeRails(page, { portal });
        await page.locator('#scroller').evaluate(element => { element.scrollTop = 430; });
        const before = await geometry(page), silhouette = await nativeCornerPoints(page);
        assert.equal(silhouette.itemRadius, '0px', 'Contained native Item is square rather than an independently rounded card');
        assert.ok(silhouette.radius > 0 && silhouette.points.length > 20 && silhouette.overflow === 'clip',
          'The actual attached Rail ancestor owns visible corner clipping: ' + JSON.stringify(silhouette));
        const currentFactory = createTranscriptOcclusion.toString();
        const oldFactory = currentFactory.replace('let parent = surface.parentElement;', 'let parent = null;');
        assert.notEqual(oldFactory, currentFactory, 'The negative control must remove only ancestor mask clipping');
        await install(page, oldFactory);
        const legacy = await capture(page, 'native-rail');
        const legacyReference = await compositedReference(page, () => capture(page, 'native-rail'));
        assert.ok(differenceAt(legacy, legacyReference, silhouette.points) > 10,
          'The old Item-only rectangle mask reproduces the visible horizontal bite at native Rail corners');
        await install(page);
        assertMask(await state(page));
        const corrected = await capture(page, 'native-rail');
        const correctedReference = await compositedReference(page, () => capture(page, 'native-rail'));
        assert.ok(differenceAt(corrected, correctedReference, silhouette.points) <= 2,
          'Ancestor clipping preserves the actual native corner exterior for direct and portal items');
        assert.deepEqual(await geometry(page), before, 'Native Rail/Item masking preserves footer geometry, fonts, materials and scroll range');
        const at = await page.locator('#native-goal').evaluate(element => {
          const rect = element.getBoundingClientRect(); return document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)?.closest('[data-composer-rail-item]')?.id;
        });
        assert.equal(at, 'native-goal', 'The original foreground native rail remains the click owner');
        await page.evaluate(() => window.occlusion.dispose());
      });
    });

    await t.test('hidden footer recovery and orphan restoration retire listeners and queued paint', async () => {
      await withPage(browser, 'lifecycle', {}, async page => {
        await page.locator('#scroller').evaluate(element => { element.scrollTop = 400; });
        await page.evaluate(() => {
          const scroller = document.getElementById('scroller');
          const add = scroller.addEventListener, remove = scroller.removeEventListener;
          const documentAdd = document.addEventListener, documentRemove = document.removeEventListener;
          window.fixtureScrollListeners = new Set(); window.fixtureDisposeListeners = new Set();
          scroller.addEventListener = function (type, listener, options) {
            if (type === 'scroll') window.fixtureScrollListeners.add(listener);
            return add.call(this, type, listener, options);
          };
          scroller.removeEventListener = function (type, listener, options) {
            if (type === 'scroll') window.fixtureScrollListeners.delete(listener);
            return remove.call(this, type, listener, options);
          };
          document.addEventListener = function (type, listener, options) {
            if (type === 'wukong-codex-transcript-dispose') window.fixtureDisposeListeners.add(listener);
            return documentAdd.call(this, type, listener, options);
          };
          document.removeEventListener = function (type, listener, options) {
            if (type === 'wukong-codex-transcript-dispose') window.fixtureDisposeListeners.delete(listener);
            return documentRemove.call(this, type, listener, options);
          };
        });
        await install(page);
        assert.deepEqual(await page.evaluate(() => [window.fixtureScrollListeners.size, window.fixtureDisposeListeners.size]), [1, 1],
          'One helper owns one passive scroll subscription and its independent restore subscription');
        await page.evaluate(() => {
          const footer = document.getElementById('footer'); footer.style.visibility = 'hidden';
          window.occlusion.handleResize([{ target: footer }]);
          const scroller = document.getElementById('scroller'); scroller.scrollTop += 30; scroller.dispatchEvent(new Event('scroll'));
        });
        await settle(page);
        assert.equal(await page.locator('#transcript').getAttribute(marker), null,
          'A hidden footer stops occlusion and a queued scroll cannot resurrect it');
        await page.evaluate(() => {
          const footer = document.getElementById('footer'); footer.style.visibility = '';
          window.occlusion.handleResize([{ target: footer }]);
        });
        assert.equal(await page.locator('#transcript').getAttribute(marker), 'true', 'Showing the footer restores the same binding');
        await install(page);
        assert.deepEqual(await page.evaluate(() => [window.fixtureScrollListeners.size, window.fixtureDisposeListeners.size]), [1, 1],
          'A replacement helper retires the previous helper before subscribing');
        await page.evaluate(() => {
          const scroller = document.getElementById('scroller'); scroller.scrollTop += 25; scroller.dispatchEvent(new Event('scroll'));
          delete window.occlusion;
        });
        assert.equal(await page.evaluate(RESTORE_EXPRESSION), true, 'Native restoration succeeds without a runtime/helper handle');
        await settle(page);
        assert.deepEqual(await page.evaluate(() => [window.fixtureScrollListeners.size, window.fixtureDisposeListeners.size]), [0, 0],
          'The independent restore event removes orphan listeners and cancels pending work');
        const restored = await page.locator('#transcript').evaluate((element, marker) => ({ marked: element.hasAttribute(marker),
          owned: [...element.style].filter(name => name.startsWith('--forge-transcript-')), user: element.style.getPropertyValue('--fixture-user-style') }), marker);
        assert.deepEqual(restored, { marked: false, owned: [], user: 'retained' }, 'All mask properties are removed and unrelated inline style survives');
        await page.locator('#scroller').evaluate(element => { element.scrollTop += 60; element.dispatchEvent(new Event('scroll')); });
        await settle(page);
        assert.equal(await page.locator('#transcript').getAttribute(marker), null, 'No orphan callback repaints after native restoration');
      });
    });

    await t.test('short messages remain intact and compact footer placement uses the same bounded ownership', async () => {
      await withPage(browser, 'short', { rows: 2 }, async page => {
        const before = await geometry(page), messageText = await page.locator('#message-content').textContent();
        await install(page);
        assert.deepEqual(await geometry(page), before, 'Short transcripts do not acquire padding, reflow or additional scroll range');
        const shortAfter = await page.locator('#message-content').screenshot({ animations: 'disabled' });
        const identityPaint = await compositedReference(page, () => page.locator('#message-content').screenshot({ animations: 'disabled' }));
        assert.equal(await page.locator('#message-content').textContent(), messageText, 'Short text content stays unchanged');
        assert.equal(difference(shortAfter, identityPaint), 0, 'Short message text stays fully visible above the input in the same compositing mode');
        await page.locator('#message-1').click();
        assert.equal(await page.locator('#message-1').evaluate(element => element === document.activeElement), true);
        await page.evaluate(() => window.occlusion.dispose());
      });
      await withPage(browser, 'compact', { compact: true }, async page => {
        await page.locator('#scroller').evaluate(element => { element.scrollTop = 300; });
        const before = await geometry(page);
        await install(page); assertMask(await state(page));
        assert.deepEqual(await geometry(page), before, 'Compact ownership preserves the native sibling-footer layout');
        assert.ok(roundrectDifference(await capture(page), await wallpaperOnly(page)) <= 2, 'The sibling footer also shows wallpaper rather than transcript text');
        await page.evaluate(() => {
          window.fixtureDetachedLayout = document.getElementById('layout'); window.fixtureDetachedLayout.remove(); window.occlusion.refresh();
        });
        assert.equal(await page.evaluate(marker => window.fixtureDetachedLayout.querySelector(`[${marker}]`) !== null, marker), false,
          'Removing a complete layout cleans detached transcript nodes');
        await page.evaluate(() => window.occlusion.dispose());
      });
    });
  } finally { await browser.close(); }
});