import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { loadQuotaNative, quotaNativeSkip, quotaPackageVersion, quotaHtml, prop, text, nodes } from './native-quota-current-helper.mjs';

const theme = fs.readFileSync(new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url), 'utf8');
const seamRule = theme.match(/:root\.forge-ink-mountain \[data-codex-composer-root\]:has\([\s\S]*?corner-shape:\s*var\(--composer-corner-shape\)[^}]+\}/)?.[0];
assert.ok(seamRule, 'Quota seam contour rule is missing');
const previousTheme = theme.replace(seamRule, '');
const output = new URL('../artifacts/new-ui-adaptation-20261021/', import.meta.url);
const element = (tag, props) => ({ tag, props });

test('current native quota recovery has its own status surface and bypasses ordinary attached-notice overlap', { skip: quotaNativeSkip }, () => {
  const native = loadQuotaNative();
  const banner = native.renderBanner({ title: 'Fixture usage title', content: 'Fixture renewal date' });
  assert.equal(banner.tag, 'aside');
  assert.equal(banner.props.role, 'status');
  assert.equal(banner.props['aria-live'], 'polite');
  assert.ok(banner.props.className.split(/\s+/).includes(native.classes.banner));
  assert.equal(Object.keys(banner.props).filter(name => name.startsWith('data-')).length, 0,
    'Recovery has no dedicated native data marker; do not invent one in production');
  const branch = native.notice.nodes.find(node => node.type === 'IfStatement' && node.test.type === 'BinaryExpression' && text(node.test.right) === 'recovery');
  assert.ok(branch && nodes(branch.consequent).some(node => node.type === 'ReturnStatement'),
    'Recovery must return before generic attachedToComposer notice styling');
  assert.ok(nodes(branch.consequent).some(node => node.type === 'CallExpression' && node.arguments[0]?.name === native.banner.ast.id.name));
  assert.ok(!nodes(branch.consequent).some(node => /-mb-|pb-9|rounded-b-none/.test(text(node))));
  assert.match(native.placement.source, /className=`contents`/);
  const nativeRule = native.css.match(new RegExp(`\\.${native.classes.banner}\\{([^}]+)\\}`))?.[1];
  assert.ok(nativeRule);
  assert.match(nativeRule, /border-radius:28px/);
  assert.match(nativeRule, /padding:24px/);
  assert.match(nativeRule, /width:100%/);
  assert.ok(!/(?:margin|position|overflow|padding-bottom):/.test(nativeRule), 'Recovery owns no hidden overlapping bottom plate');
  const host = native.renderHost({ placement: { kind: 'thread' }, banners: banner, children: 'Composer slot' });
  const html = quotaHtml(host);
  assert.ok(html.startsWith('<aside '));
  assert.ok(html.includes('</aside><div class="contents">Composer slot</div>'), 'Native host keeps recovery and the composer slot as siblings');
});

// Native quota, button, composer root/body and placement renderers execute the
// installed source. Editable text and control labels are inert fixture content.
// The frame establishes only a viewport/backdrop; it adds no coloured backing,
// overlap, border radius, margin or padding to the quota/composer boundary.
export const quotaFixture = (native, options = {}) => {
  const button = (id, children, color = 'outlineGhost', disabled = false) => native.renderButton({ id, children, color, disabled,
    size: 'recoveryAction', radius: 'full' });
  const banner = native.renderBanner({ title: 'Codex 和工作使用额度已用完',
    content: '你的速率限制将于 10月28日 18:30 重置。立即升级，或使用一次速率限制重置机会。',
    actions: [button('reset-fixture', '重置使用量', 'outlineGhost', options.disabled), button('upgrade-fixture', '✦ 升级', 'upgrade')] });
  banner.props.id = 'quota-fixture';
  const headerInside = options.placement === 'embedded-header';
  const composer = native.renderLayout({ layoutState: { layout: 'multiline' }, surfacePlacement: { kind: 'thread' },
    editor: { readOnlyContent: element('div', { id: 'editor-fixture', role: 'textbox', 'aria-label': 'Fixture message', contenteditable: 'true', className: 'min-h-[var(--composer-editor-min-height,2.5rem)] text-base outline-none', children: '和 Codex 一起工作' }) },
    header: headerInside ? banner : undefined, leadingActions: [button('add-fixture', '+', 'ghost'), button('access-fixture', '完全访问', 'ghost')],
    primaryAction: button('send-fixture', '↑', 'primary', options.disabled) });
  const markRoot = tree => {
    if (!tree || typeof tree !== 'object') return;
    if (Array.isArray(tree)) return tree.forEach(markRoot);
    if (tree.props?.['data-composer-surface-variant']) tree.props.id = 'composer-fixture';
    markRoot(tree.props?.children);
  };
  markRoot(composer);
  return quotaHtml(element('div', { className: native.ownerClass, children: native.renderHost({ placement: { kind: 'thread' }, banners: headerInside ? undefined : banner, children: composer }) }));
};

test('quota contour uses the native composer curve while preserving all bounds, gaps, paint and controls', { skip: quotaNativeSkip }, async () => {
  const native = loadQuotaNative();
  const browser = await chromium.launch({ headless: true });
  const report = { packageVersion: quotaPackageVersion, kind: 'installed pure presentation fixture with inert input slots',
    liveQuotaStateVerified: false, originalBlackBackingReproduced: false, testedChange: 'bounded shared contour adaptation', cases: [] };
  try {
    for (const placement of ['independent']) for (const mode of ['dark', 'light']) for (const width of [368, 736]) {
      const page = await browser.newPage({ viewport: { width: width + 64, height: 450 }, colorScheme: mode });
      try {
        await page.setContent(`<html data-theme="${mode}" data-forge-native-theme="${mode}" data-forge-background-ready="true" data-codex-os="win32" data-codex-window-type="electron"><head><meta charset="utf-8"><style>${native.css}</style><style>
          body{margin:0;padding:32px;font-family:Arial,"Microsoft YaHei",sans-serif}
          #fixture-backdrop{position:fixed;inset:0;z-index:-1;background:linear-gradient(120deg,#193047,#78909c)}
          #root{width:${width}px}#fixture-label{font:12px Arial;color:white;margin-bottom:16px}
        </style></head><body><div id="fixture-backdrop" aria-hidden="true"></div><p id="fixture-label">原生组件夹具，非额度实机 · ${placement}/${mode}/${width}</p><div id="root"><div data-codex-composer-root data-composer-placement="thread">${quotaFixture(native, { placement })}</div></div></body></html>`);
        const themeStyle = await page.addStyleTag({ content: previousTheme });
        const capture = () => page.locator('#quota-fixture,#quota-fixture *,#composer-fixture,#composer-fixture *').evaluateAll(elements => elements.map(element => {
          const style = getComputedStyle(element), rect = element.getBoundingClientRect();
          return { tag: element.tagName, id: element.id, className: element.className,
            rect: [rect.x, rect.y, rect.width, rect.height], geometry: [style.margin, style.padding, style.borderWidth, style.borderRadius, style.overflow, style.position, style.font, style.flexDirection, style.cornerShape],
            paint: [style.backgroundColor, style.backgroundImage, style.boxShadow, style.backdropFilter, style.color],
            role: element.getAttribute('role'), disabled: element.disabled ?? null, tabIndex: element.tabIndex };
        }));
        const baseline = await capture();
        const baselineBanner = baseline.find(item => item.id === 'quota-fixture'), baselineButton = baseline.find(item => item.id === 'reset-fixture');
        assert.equal(baselineBanner.geometry[1], '24px', 'Native CSS cascade must preserve the real recovery padding');
        assert.ok(parseFloat(baselineBanner.geometry[2]) > 0, 'Native recovery border must survive the base reset layer');
        assert.equal(baselineBanner.geometry[3], '28px');
        assert.ok(baselineButton.geometry[1].includes('12px'), 'Native recovery action must retain its native horizontal padding');
        assert.ok(parseFloat(baselineButton.geometry[3]) > 100, 'Native recovery action must retain its pill radius');
        await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
        const before = await capture();
        const oldAt = id => before.find(item => item.id === id);
        assert.notEqual(oldAt('quota-fixture').geometry[3], oldAt('composer-fixture').geometry[3],
          'Negative control: the old theme retains the native 28px recovery radius beside the 22px composer radius');
        if (process.env.CODEX_WRITE_QUOTA_PREVIEWS === '1') {
          fs.mkdirSync(output, { recursive: true });
          await page.screenshot({ path: path.join(fileURLToPath(output), `quota-native-before-${placement}-${mode}-${width}.png`) });
        }
        await themeStyle.evaluate((style, content) => { style.textContent = content; }, theme);
        const themed = await capture(), at = id => themed.find(item => item.id === id);
        assert.equal(at('quota-fixture').geometry[3], at('composer-fixture').geometry[3], 'Recovery and input use the same native radius');
        assert.equal(at('quota-fixture').geometry[8], at('composer-fixture').geometry[8], 'Recovery and input use the same native corner curve');
        assert.notEqual(at('quota-fixture').geometry[3], oldAt('quota-fixture').geometry[3], 'The new rule must make an actual contour change');
        for (let index = 0; index < before.length; index++) {
          const oldNode = before[index], currentNode = themed[index];
          assert.deepEqual(currentNode.rect, oldNode.rect, `${placement}/${mode}/${width}: ${oldNode.id || oldNode.tag} retains its native bounds`);
          assert.deepEqual(currentNode.paint, oldNode.paint, `${placement}/${mode}/${width}: ${oldNode.id || oldNode.tag} retains its existing paint and text`);
          const allowed = item => ({ ...item, geometry: item.geometry.filter((_, property) => ![3, 8].includes(property)) });
          assert.deepEqual(oldNode.id === 'quota-fixture' ? allowed(currentNode) : currentNode,
            oldNode.id === 'quota-fixture' ? allowed(oldNode) : oldNode,
            `${placement}/${mode}/${width}: only the recovery radius/corner curve may change`);
        }
        assert.equal(at('quota-fixture').rect[0], at('composer-fixture').rect[0]);
        assert.equal(at('quota-fixture').rect[2], at('composer-fixture').rect[2]);
        if (placement === 'independent') assert.equal(at('quota-fixture').rect[1] + at('quota-fixture').rect[3] + 8, at('composer-fixture').rect[1],
          'The native Pht owner retains its source-proven gap-2 between sibling surfaces');
        else assert.equal(at('quota-fixture').rect[1], at('composer-fixture').rect[1], 'The native header is the first child inside the composer body');
        const label = `${placement}-${mode}-${width}`;
        report.cases.push({ placement, mode, width, baseline, before, themed });
        if (process.env.CODEX_WRITE_QUOTA_PREVIEWS === '1') {
          fs.mkdirSync(output, { recursive: true });
          await page.screenshot({ path: path.join(fileURLToPath(output), `quota-native-after-${label}.png`) });
          if (placement === 'independent' && width === 736) {
            await page.screenshot({ path: fileURLToPath(new URL(`../docs/previews/${mode}-quota-seam-fixture.png`, import.meta.url)) });
          }
        }
        await page.getByRole('textbox', { name: 'Fixture message', exact: true }).fill('输入与焦点仍可使用');
        await page.getByRole('button', { name: '重置使用量', exact: true }).click();
        assert.equal(await page.locator('#reset-fixture').evaluate(node => node === document.activeElement), true);
        await page.locator('#composer-fixture').evaluate(node => { node.dataset.composerSurfaceVariant = 'inline'; });
        assert.equal(await page.locator('#quota-fixture').evaluate(node => getComputedStyle(node).borderRadius), '28px', 'Switching to an inline composer restores the native recovery contour');
        await page.locator('#composer-fixture').evaluate(node => { node.dataset.composerSurfaceVariant = 'default'; });
        assert.equal(await page.locator('#quota-fixture').evaluate(node => getComputedStyle(node).borderRadius), at('composer-fixture').geometry[3]);
        await page.evaluate(() => document.documentElement.classList.remove('forge-ink-mountain'));
        assert.equal(await page.locator('#quota-fixture').evaluate(node => getComputedStyle(node).borderRadius), baselineBanner.geometry[3], 'Removing the theme restores the native radius');
      } finally { await page.close(); }
    }
  } finally {
    if (process.env.CODEX_WRITE_QUOTA_PREVIEWS === '1') {
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(new URL('quota-native-contour-report.json', output), JSON.stringify(report, null, 2), 'utf8');
    }
    await browser.close();
  }
});

test('quota contour excludes embedded headers, unrelated surfaces and non-default composer layouts', { skip: quotaNativeSkip }, async () => {
  const native = loadQuotaNative();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 650 } });
    const banner = () => {
      const tree = native.renderBanner({ title: 'Native notice fixture', content: 'Inert content', actions: native.renderButton({ children: 'Native action', size: 'recoveryAction', radius: 'full' }) });
      tree.props.id = 'negative-quota';
      return quotaHtml(tree);
    };
    const composer = (options = {}) => quotaHtml(native.renderComposerRoot({ layout: 'multiline', radiusVariant: 'default', surfaceVariant: 'default',
      children: native.renderComposerBody({ children: 'Native input slot' }), ...options }));
    const root = content => `<div data-codex-composer-root>${content}</div>`;
    const cases = {
      outside: `${banner()}${root(composer())}`,
      large: root(`${banner()}${composer({ radiusVariant: 'large' })}`),
      inline: root(`${banner()}${composer({ surfaceVariant: 'inline' })}`),
      singleLine: root(`${banner()}${composer({ layout: 'single-line' })}`),
      embeddedHeader: root(quotaFixture(native, { placement: 'embedded-header' }).replace('id="quota-fixture"', 'id="negative-quota"')),
      popover: root(`<div data-slot="popover-content">${banner()}</div>${composer()}`),
      dialog: root(`<div role="dialog">${banner()}</div>${composer()}`),
      alertdialog: root(`<div role="alertdialog">${banner()}</div>${composer()}`),
      summary: root(`<div data-summary-panel-variant="summary">${banner()}</div>${composer()}`),
      checkout: root(`<div data-checkout-presentation="inline">${banner()}</div>${composer()}`),
      nestedRoot: root(root(`${banner()}${composer()}`))
    };
    for (const mode of ['dark', 'light']) for (const [name, markup] of Object.entries(cases)) {
      await page.emulateMedia({ colorScheme: mode });
      await page.setContent(`<html data-theme="${mode}" data-forge-native-theme="${mode}"><head><style>${native.css}</style></head><body><div id="root">${markup}</div></body></html>`);
      await page.addStyleTag({ content: theme });
      const contour = () => page.locator('#negative-quota').evaluate(node => {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        return { radius: style.borderRadius, corner: style.cornerShape, rect: [rect.x, rect.y, rect.width, rect.height], padding: style.padding, border: style.borderWidth, background: style.backgroundColor };
      });
      const before = await contour();
      assert.equal(before.radius, '28px');
      await page.evaluate(() => document.documentElement.classList.add('forge-ink-mountain'));
      assert.deepEqual(await contour(), before, `${mode}/${name}: recovery outside the independent default multiline path retains its native contour`);
    }
    await page.close();
  } finally { await browser.close(); }
});
