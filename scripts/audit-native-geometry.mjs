// Compare the running client's native geometry with the theme in one synchronous
// read. No navigation, preference changes, resizing or conversation text capture.
import { getTargets, isCodexTarget, evaluateTarget } from '../runtime/cdp-client.mjs';

const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Usage: node scripts/audit-native-geometry.mjs <CDP port>');
const target = (await getTargets(port)).find(isCodexTarget);
if (!target) throw Error('No active Codex renderer');
const result = await evaluateTarget(target, `(() => {
  const style = document.getElementById('wukong-codex-theme-style');
  const overlay = document.getElementById('wukong-codex-theme-background');
  if (!style || !overlay || style.disabled) throw Error('An active theme is required');
  const selectors = {
    titlebar: '[class*="_ApplicationMenuTopBar_"]',
    sidebar: 'aside.app-shell-left-panel',
    rail: 'nav[class~="group/sidebar-rail"]',
    navigation: '.sidebar-navigation[class*="_ConversationSidebar_"]',
    page: '[class*="_PageSurface_"]',
    main: '[data-app-shell-main-surface]',
    composer: '[data-composer-surface-variant]'
  };
  const panels = Object.entries(selectors).map(([name, selector]) => ({name, element: document.querySelector(selector)}));
  const elements = [...new Set(panels.flatMap(({element}) => element ? [element, ...element.querySelectorAll('*')] : []))]
    .filter(e => !e.closest('[data-forge-owned]') && e.getClientRects().length && !(e instanceof SVGElement));
  const measure = e => {
    const r = e.getBoundingClientRect(), c = getComputedStyle(e);
    return {rect: [r.x, r.y, r.width, r.height], radius: c.borderRadius,
      position: c.position, padding: c.padding, margin: c.margin, fontSize: c.fontSize, lineHeight: c.lineHeight};
  };
  const themed = elements.map(measure);
  const display = overlay.style.getPropertyValue('display');
  const priority = overlay.style.getPropertyPriority('display');
  let native;
  try {
    // Otherwise disabling CSS puts the theme's large images into normal flow.
    overlay.style.setProperty('display', 'none', 'important');
    style.disabled = true;
    native = elements.map(measure);
  } finally {
    style.disabled = false;
    if (display) overlay.style.setProperty('display', display, priority);
    else overlay.style.removeProperty('display');
  }
  const differences = elements.flatMap((e, i) => {
    const a = themed[i], b = native[i];
    const fields = Object.keys(a).filter(k => k === 'rect' ? a.rect.some((v,j) => Math.abs(v - b.rect[j]) > .5) : a[k] !== b[k]);
    return fields.length ? [{tag: e.tagName, classes: String(e.className), fields, themed: a, native: b}] : [];
  });
  return {viewport: [innerWidth, innerHeight], nativeTheme: document.documentElement.dataset.forgeNativeTheme,
    inspected: elements.length, differences,
    panels: panels.map(({name, element}) => ({name, geometry: element ? measure(element) : null})),
    wallpaper: {placement: document.documentElement.dataset.forgeBackgroundPlacement, geometry: measure(overlay), hostGeometry: measure(overlay.parentElement)}};
})()`);
console.log(JSON.stringify(result, null, 2));
if (result.differences.length) process.exitCode = 1;
