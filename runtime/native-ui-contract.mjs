/*
 * Native DOM contracts, audited against the packaged 26.930 UI. Data attributes
 * describe ownership; utility classes are only retained as bounded fallbacks.
 * Keep this module dependency-free: the factory is serialized into the client.
 */
export const NATIVE_UI_SELECTORS = Object.freeze({
  pageShell: '[data-app-shell-page-surface]:not([data-app-shell-page-surface="false"])',
  pagePaint: '[class*="_PageSurface_"]',
  main: '[data-app-shell-main-surface]',
  mainContent: '[data-app-shell-main-content-layout]',
  sidebar: 'aside[data-app-shell-left-panel-appearance], aside.app-shell-left-panel',
  floatingSidebar: 'aside[data-testid="app-shell-floating-left-panel"], [data-testid="app-shell-floating-left-panel"] > aside',
  navigation: '.sidebar-navigation',
  settings: '[data-settings-mobile-header], [class~="group/settings"]',
  catalogHeader: '[data-sticky][style*="--app-shell-titlebar-left-inset"]',
  conversation: '[data-thread-find-target="conversation"]',
  conversationHost: '[data-vscode-context*="supportsNewChatMenu"]',
  turns: '[data-virtualized-turn-content], [data-local-conversation-final-assistant], [data-message-author-role], [data-content-search-turn-key]',
  messaging: '.messaging-root.messaging-embedded .thread-pane',
  messagingRoot: '.messaging-root.messaging-embedded',
  landing: '[data-feature="game-source"]',
  homeIcon: '[data-testid="home-icon"]',
  composer: '[data-codex-composer-root]',
  composerSurface: '.composer-surface-chrome, [data-composer-surface-variant]',
  composerFind: '[data-thread-find-composer]',
  composerPortal: '[data-above-composer-portal]',
  composerNavigation: '[data-composer-navigation-target]',
  composerOverlay: '[data-composer-overlay-floating-ui="true"], .composer-home-top-menu',
  utilityScroll: '[data-composer-utility-bar-scroll-area]',
  utilityTargets: '[data-composer-navigation-target="workspace-project"], [data-composer-navigation-target="environment"], [data-composer-navigation-target="run-location"], [data-composer-navigation-target="branch"], [data-composer-navigation-target="starting-state"]',
  composerRail: '[data-composer-rail]',
  composerRailItem: '[data-composer-rail-item]',
  progress: '[data-in-progress-fixed-content]',
  footer: '[data-thread-scroll-footer="true"]',
  summary: '[data-summary-panel-variant]',
  summaryRows: '[data-slot="thread-summary-panel-item"], [data-slot="thread-summary-panel-item-button"], [data-slot="thread-summary-panel-item-link"]',
  overlay: '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], [role="tooltip"]'
});

export function createNativeUiAdapter(document, selectors) {
  const view = document.defaultView;
  const isElement = element => element instanceof view.Element;
  const all = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  // CSS visibility is inherited but a descendant may explicitly restore it.
  // display:none, inert and content-visibility:hidden cannot be restored below.
  // aria-hidden on the inert PageSurface paint leaf does not mean unpainted.
  const mounted = (element, { size = true, painted = false, accessible = false } = {}) => {
    if (!isElement(element) || !element.isConnected) return false;
    if (size) {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false;
    }
    const ownStyle = view.getComputedStyle(element);
    if (ownStyle.visibility === 'hidden' || ownStyle.visibility === 'collapse') return false;
    for (let cursor = element; cursor; cursor = cursor.parentElement) {
      const style = cursor === element ? ownStyle : view.getComputedStyle(cursor);
      if (cursor.hidden || cursor.hasAttribute('inert') || style.display === 'none' ||
          style.contentVisibility === 'hidden' ||
          (accessible && cursor.getAttribute('aria-hidden') === 'true') ||
          (painted && Number.parseFloat(style.opacity || '1') <= .01)) return false;
    }
    return true;
  };
  const visible = element => mounted(element, { painted: true, accessible: true });
  const layoutPresent = element => mounted(element);
  const structurallyMounted = element => mounted(element, { size: false });
  const first = (selector, scope = document, predicate = visible) => all(selector, scope).find(predicate) || null;
  const workspace = () => first(selectors.main) || first(selectors.mainContent) || first('[role="main"], main');
  const pagePaint = () => {
    for (const shell of all(selectors.pageShell)) {
      // The native PageSurface leaf has no own data attribute. Scope this
      // component fallback to its semantic shell, never to a global class hit.
      // PageSurface itself is aria-hidden decoration, but an opacity-zero
      // retained shell must not receive the current wallpaper.
      const paint = first(selectors.pagePaint, shell, element => mounted(element, { painted: true }));
      if (paint) return paint;
    }
    return null;
  };
  const settingsActive = () => all(selectors.settings)
    .some(element => visible(element) && !element.closest(selectors.overlay));
  const sidebar = () => first(selectors.floatingSidebar) || first(selectors.sidebar);
  const conversationSidebar = () => {
    const owner = sidebar();
    if (!owner) return null;
    // The outer navigation owns the glass. Nested list navigation and drag
    // previews must not become independent sampled/painted sidebars.
    return first(selectors.navigation, owner, element => visible(element) &&
      !element.parentElement?.closest(selectors.navigation));
  };
  const utilityContext = (composerRoot, surface) => {
    const scroll = first(selectors.utilityScroll, composerRoot);
    if (scroll) {
      const parent = scroll.parentElement;
      if (parent && parent !== composerRoot && !parent.contains(surface) &&
          view.getComputedStyle(parent).display === 'flex') return parent;
      return scroll;
    }
    const controls = all(selectors.utilityTargets, composerRoot)
      .filter(element => visible(element) && !surface.contains(element));
    if (!controls.length) return null;
    // A semantic utility row owns only its controls; never promote the editor,
    // attachments, panels or the complete composer to a painted context strip.
    for (let candidate = controls[0].parentElement; candidate && candidate !== composerRoot; candidate = candidate.parentElement) {
      if (candidate.contains(surface) || candidate.querySelector(selectors.composerRail)) break;
      if (controls.every(element => candidate.contains(element)) &&
          ['flex', 'grid'].includes(view.getComputedStyle(candidate).display)) return candidate;
    }
    return null;
  };
  return { all, first, mounted, visible, layoutPresent, structurallyMounted, workspace, pagePaint, settingsActive, sidebar, conversationSidebar, utilityContext };
}
