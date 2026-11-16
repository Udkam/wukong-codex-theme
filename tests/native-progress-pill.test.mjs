import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { key, loadNativeBundle, nativeFunction, nodes, presentationHarness, prop, text } from './native-bundle-current-helper.mjs';
import { quotaHtml } from './native-quota-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const previewDirectory = process.env.WUKONG_PROGRESS_PREVIEW_DIRECTORY;
const progressMarker = 'data-in-progress-fixed-content';
const carrierClass = 'bg-surface-elevated-secondary';
const jsxCalls = tree => nodes(tree).filter(node => node.type === 'CallExpression' && node.arguments[1]?.type === 'ObjectExpression');

const loadProgress = () => {
  const bundle = loadNativeBundle();
  const [progress, ...extra] = bundle.findModules([progressMarker, 'inProgressDiffSummary:', 'data-above-composer-progress-content']);
  assert.ok(progress && !extra.length, 'The native active-turn progress portal must be unique');
  const [surface, ...otherSurfaces] = bundle.findModules(['overflow-hidden rounded-3xl', carrierClass, 'animateSize']).filter(record =>
    jsxCalls(record.ast).some(node => text(prop(node.arguments[1], 'className')).includes(`rounded-3xl border border-border/80 ${carrierClass}`)));
  assert.ok(surface && !otherSurfaces.length, 'The installed progress surface must retain its own rounded paint carrier');
  const renderer = nativeFunction(surface, 'overflow-hidden rounded-3xl');
  const exported = Object.entries(bundle.exports(surface)).find(([, expression]) => expression === renderer.ast ||
    (renderer.ast.id && expression.name === renderer.ast.id.name));
  assert.ok(exported, 'The progress carrier must belong to an exported presentation renderer');

  const owner = nativeFunction(progress, 'inProgressDiffSummary:');
  const imports = bundle.imports(progress);
  const usesSurface = node => node.type === 'CallExpression' && node.arguments[0]?.type === 'MemberExpression' &&
    imports[node.arguments[0].object.name]?.id === surface.id && key(node.arguments[0].property) === exported[0];
  const portal = owner.nodes.find(node => {
    if (node.type !== 'CallExpression' || node.arguments[0]?.type !== 'ConditionalExpression') return false;
    const callee = node.callee.type === 'SequenceExpression' ? node.callee.expressions.at(-1) : node.callee;
    return key(callee.property) === 'createPortal' && nodes(node.arguments[0]).some(usesSurface);
  });
  assert.ok(portal, 'The active progress renderer must portal its standalone surface');
  const { consequent: inline, alternate: standalone } = portal.arguments[0];
  assert.ok(prop(inline.arguments[1], progressMarker) && text(prop(inline.arguments[1], 'className')) === 'contents');
  assert.ok(prop(standalone.arguments[1], progressMarker) && nodes(standalone).some(usesSurface) && !nodes(inline).some(usesSurface),
    'Only the default portal branch owns the painted pill');

  const diff = bundle.findModules(['codex.unifiedDiff.filesChanged', 'codex.turn_diff.state']).find(record =>
    Object.values(imports).some(imported => imported.id === record.id));
  const button = diff && jsxCalls(diff.ast).find(node => text(node.arguments[0]) === 'button' &&
    nodes(prop(node.arguments[1], 'children')).some(child => child.type === 'MemberExpression' && key(child.property) === 'filesChanged'));
  assert.equal(text(prop(button?.arguments[1], 'type')), 'button', 'The active change count retains its native review action');
  return { css: bundle.css(carrierClass), render: presentationHarness(bundle).compile(renderer),
    standaloneClass: text(prop(standalone.arguments[1], 'className')), buttonClass: text(prop(button.arguments[1], 'className')) };
};

const progressHtml = (native, id) => {
  const control = { tag: 'button', props: { id: `${id}-action`, type: 'button', className: native.buttonClass,
    children: [
      { tag: 'span', props: { className: 'truncate-text', children: '1 个文件已更改' } },
      { tag: 'span', props: { className: 'text-codex-git-added', children: '+65' } },
      { tag: 'span', props: { className: 'text-codex-git-deleted', children: '-5' } }
    ] } };
  const surface = native.render({ children: control });
  const clip = surface.props.children;
  clip.props.id = `${id}-clip`;
  clip.props.children.props.id = id;
  return `<div ${progressMarker}="true" class="${native.standaloneClass}">${quotaHtml(surface)}</div>`;
};

test('the native progress pill paints on mount and remount without changing its action or surrounding surfaces', async () => {
  const native = loadProgress();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const mode of ['dark', 'light']) {
      const page = await browser.newPage({ viewport: { width: 720, height: 400 }, colorScheme: mode });
      try {
        const outside = progressHtml(native, 'outside');
        const inside = `<div data-above-composer-portal data-above-composer-conversation-id="fixture">${progressHtml(native, 'inside')}</div>`;
        await page.setContent(`<html data-theme="${mode}" data-codex-window-type="electron"><head><style>${native.css}</style><style>${theme}</style><style>
          body{margin:0;padding:24px}.slot{margin-block:14px;min-height:32px}
          #reference{background-color:var(--forge-glass-fill);background-image:var(--forge-glass-highlight);border-color:var(--forge-glass-edge)}
        </style></head><body><div id="root"><div id="outside-slot" class="slot">${outside}</div><div id="inside-slot" class="slot">${inside}</div>
        <div ${progressMarker} class="contents"><div id="inline-decoy" class="rounded-3xl ${carrierClass}">Progress embedded in another action surface</div></div>
        <div class="overflow-hidden rounded-3xl"><div id="unscoped-decoy" class="rounded-3xl ${carrierClass}">Unrelated rounded surface</div></div>
        <div id="reference" hidden></div></div></body></html>`);
        await page.evaluate(mode => {
          document.documentElement.dataset.forgeNativeTheme = mode;
          document.documentElement.dataset.forgeBackgroundReady = 'false';
          window.probeProgress = () => Object.fromEntries([...document.querySelectorAll('#outside-slot [id], #inside-slot [id], #inline-decoy, #unscoped-decoy, #reference')].map(node => {
            const css = getComputedStyle(node), box = node.getBoundingClientRect();
            return [node.id, { fill: css.backgroundColor, highlight: css.backgroundImage, edge: css.borderTopColor,
              blur: css.backdropFilter, geometry: [box.x, box.y, box.width, box.height, css.borderRadius, css.borderTopWidth,
                css.padding, css.margin, css.opacity, css.pointerEvents, css.font], text: node.textContent, color: css.color,
              tabIndex: node.tabIndex, type: node.type, disabled: node.disabled }];
          }));
        }, mode);
        const snapshot = () => page.evaluate(() => window.probeProgress());
        const baseline = await snapshot();
        assert.notEqual(baseline.outside.fill, 'rgba(0, 0, 0, 0)', `${mode}: native control must have a painted outer carrier`);
        const { immediate, nextFrame } = await page.evaluate(async ({ outside, inside }) => {
          document.documentElement.classList.add('forge-ink-mountain');
          document.getElementById('outside-slot').innerHTML = outside;
          document.getElementById('inside-slot').innerHTML = inside;
          const immediate = window.probeProgress();
          await new Promise(resolve => requestAnimationFrame(resolve));
          return { immediate, nextFrame: window.probeProgress() };
        }, { outside, inside });
        assert.deepEqual(nextFrame, immediate, `${mode}: the first frame has no native-color flash`);
        for (const id of ['outside', 'inside']) {
          assert.notEqual(immediate[id].fill, baseline[id].fill, `${mode}/${id}: the native fill must change`);
          assert.equal(immediate[id].fill, immediate.reference.fill);
          assert.equal(immediate[id].highlight, immediate.reference.highlight);
          assert.equal(immediate[id].edge, immediate.reference.edge);
          assert.equal(immediate[id].blur, baseline[id].blur, `${mode}/${id}: no second backdrop filter`);
          for (const key of ['geometry', 'text', 'color']) assert.deepEqual(immediate[id][key], baseline[id][key], `${mode}/${id}: ${key} stays native`);
          assert.deepEqual(immediate[`${id}-clip`], baseline[`${id}-clip`], `${mode}/${id}: motion clip remains a layout wrapper`);
          assert.deepEqual(immediate[`${id}-action`], baseline[`${id}-action`], `${mode}/${id}: the native review action is unchanged`);
        }
        for (const id of ['inline-decoy', 'unscoped-decoy']) assert.deepEqual(immediate[id], baseline[id], `${mode}/${id}: a non-owner keeps native paint`);
        assert.equal(await page.locator('[data-forge-mark], .forge-composer-progress-pill').count(), 0);
        await page.evaluate(outside => {
          const slot = document.getElementById('outside-slot');
          slot.replaceChildren();
          document.documentElement.dataset.forgeBackgroundReady = 'true';
          slot.innerHTML = outside;
          document.getElementById('outside-clip').style.opacity = '.4';
        }, outside);
        const remounted = await snapshot();
        assert.deepEqual(remounted.outside, immediate.outside, `${mode}: remount and wallpaper readiness keep the same material`);
        assert.equal(remounted['outside-clip'].geometry[8], '0.4', `${mode}: the motion parent keeps its opacity`);
        await page.locator('#outside-action').evaluate(node => node.addEventListener('click', () => { window.fixtureReviewCalls = (window.fixtureReviewCalls || 0) + 1; }));
        await page.locator('#outside-action').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(() => window.fixtureReviewCalls), 1);
        await page.emulateMedia({ forcedColors: 'active' });
        const forced = await snapshot();
        assert.notEqual(forced.outside.fill, 'rgba(0, 0, 0, 0)', `${mode}: forced-colors uses an opaque surface`);
        assert.equal(forced.outside.highlight, 'none');
        assert.equal(forced.outside.blur, 'none');

        if (previewDirectory) {
          await page.emulateMedia({ forcedColors: 'none' });
          await page.setViewportSize({ width: 720, height: 228 });
          await page.evaluate(() => {
            document.activeElement.blur();
            document.querySelectorAll('#inside-slot,#inline-decoy,#unscoped-decoy').forEach(node => node.remove());
            document.getElementById('outside-clip').style.opacity = '1';
            const label = document.createElement('h1');
            label.textContent = '进行中的文件改动 · 组件夹具';
            document.getElementById('root').prepend(label);
          });
          const wallpaper = fs.readFileSync(new URL('../themes/backgrounds/scenery-01.jpg', import.meta.url)).toString('base64');
          await page.addStyleTag({ content: `#root{padding:22px 28px;min-height:180px;border-radius:16px;color:#fff;background:linear-gradient(#0c18305c,#0c18302e),url(data:image/jpeg;base64,${wallpaper}) center/cover!important}#root h1{font-size:16px;font-weight:600;margin-bottom:44px}` });
          fs.mkdirSync(previewDirectory, { recursive: true });
          await page.locator('#root').screenshot({ path: path.join(previewDirectory, `${mode}-native-progress-pill-fixture-20261117.png`) });
        }
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
});
