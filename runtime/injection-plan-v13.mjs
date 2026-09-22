/*
 * V13 keeps V12's native-layout background scope, replaces its scene
 * lifecycle, and applies the explicitly approved landing-title/icon skin.
 * V4–V12 stay in the repository as retained implementation history.
 */
export const MARK_CLASSES = [
  'forge-topbar',
  'forge-topbar-menu-item',
  'forge-sidebar',
  'forge-sidebar-action',
  'forge-sidebar-action-active',
  'forge-new-task',
  'forge-project-active',
  'forge-workspace',
  'forge-taskbar',
  'forge-landing-hero',
  'forge-landing-kicker',
  'forge-landing-icon',
  'forge-landing-title',
  'forge-landing-subtitle',
  'forge-composer',
  'forge-composer-frame',
  'forge-composer-input-shell',
  'forge-composer-footer',
  'forge-composer-context',
  'forge-composer-context-above',
  'forge-composer-context-below',
  'forge-composer-panel-stack',
  'forge-composer-panel',
  'forge-composer-queue-item',
  'forge-composer-thread-fade',
  'forge-composer-progress-fade',
  'forge-composer-progress-pill',
  'forge-progress-status-icon',
  'forge-diff-added',
  'forge-diff-removed',
  'forge-plan-pill',
  'forge-diff-summary',
  'forge-composer-submit',
  'forge-composer-button',
  'forge-input',
  'forge-sidebar-shell',
  'forge-sidebar-level1',
  'forge-sidebar-level2',
  'forge-sidebar-selected',
  'forge-turn',
  'forge-user-message',
  'forge-assistant-message',
  'forge-assistant-turn',
  'forge-code-block',
  'forge-right-panel',
  'forge-right-card',
  'forge-right-title',
  'forge-right-title-surface',
  'forge-right-section',
  'forge-right-section-title',
  'forge-right-row',
  'forge-menu',
  'forge-menu-item',
  'forge-overlay-trailing-icon',
  'forge-composer-add-menu',
  'forge-review-card',
  'forge-paper-containing-block',
  'forge-overlay-separator',
  'forge-dialog',
  'forge-image-viewer',
  'forge-image-viewer-backdrop',
  'forge-history-rail',
  'forge-history-row',
  'forge-history-marker',
  'forge-history-preview',
  'forge-page-surface',
  'forge-page-content',
  'forge-page-card',
  'forge-page-search',
  'forge-page-search-band',
  'forge-settings-page',
  'forge-scheduled-page',
  'forge-button'
];

const RUNTIME_KEY = '__wukongCodexThemeRuntimeV13';
const RUNTIME_REVISION = 'v99-settings-background-continuity';
const RETIRED_RUNTIME_KEYS = [
  '__wukongCodexForgeRuntimeV13',
  '__wukongCodexForgeRuntimeV4',
  '__wukongCodexForgeRuntimeV5',
  '__wukongCodexForgeRuntimeV6',
  '__wukongCodexForgeRuntimeV7',
  '__wukongCodexForgeRuntimeV8',
  '__wukongCodexForgeRuntimeV9',
  '__wukongCodexForgeRuntimeV10',
  '__wukongCodexForgeRuntimeV11',
  '__wukongCodexForgeRuntimeV12'
];

function applyRuntime(payload) {
  const root = document.documentElement;
  const runtimeKey = payload.runtimeKey;
  const markClasses = payload.markClasses;
  const detectNativeTheme = () => {
    if (root.classList.contains('electron-light')) return 'light';
    if (root.classList.contains('electron-dark')) return 'dark';
    const explicitTheme = [
      root.dataset.theme,
      root.dataset.colorTheme,
      root.dataset.colorScheme,
      root.getAttribute('data-mode')
    ].find(value => value === 'light' || value === 'dark');
    if (explicitTheme) return explicitTheme;
    const declaredScheme = getComputedStyle(root).colorScheme
      .split(/\s+/)
      .find(value => value === 'light' || value === 'dark');
    if (declaredScheme) return declaredScheme;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const nativePaletteProperties = [
    ['--forge-native-token-foreground', '--color-token-foreground'],
    ['--forge-native-text-primary', '--color-token-text-primary'],
    ['--forge-native-text-secondary', '--color-token-text-secondary'],
    ['--forge-native-text-tertiary', '--color-token-text-tertiary'],
    ['--forge-native-description', '--color-token-description-foreground']
  ];
  const clearRetiredPalette = () => {
    root.style.removeProperty('--forge-native-foreground');
    root.style.removeProperty('--forge-native-sidebar-foreground');
    for (const [property] of nativePaletteProperties) {
      root.style.removeProperty(property);
      root.style.removeProperty(property.replace('--forge-native-', '--forge-native-sidebar-'));
    }
  };

  for (const retiredKey of payload.retiredRuntimeKeys) {
    const retired = window[retiredKey];
    retired?.observer?.disconnect();
    retired?.resizeObserver?.disconnect();
    retired?.dispose?.();
    if (retired?.timer) clearTimeout(retired.timer);
    delete window[retiredKey];
  }
  const previous = window[runtimeKey];
  const previousLandingQuoteVisible = previous?.landingQuoteVisible !== false;
  try {
    localStorage.removeItem('wukong-codex-theme-journal-tone-v1'); // gitleaks:allow -- retired public localStorage key
  } catch {
    // Sandboxed fixture pages may disable localStorage.
  }
  const initialNativeTheme = detectNativeTheme();
  const previousBackgroundLock = previous?.backgroundLocked === true &&
    (previous.lockedMode === 'battle' || previous.lockedMode === 'scenery') &&
    Number.isInteger(previous.lockedScene) &&
    previous.lockedScene >= 0
      ? { mode: previous.lockedMode, scene: previous.lockedScene }
      : null;
  previous?.observer?.disconnect();
  previous?.nativeThemeObserver?.disconnect();
  previous?.resizeObserver?.disconnect();
  previous?.dispose?.();
  clearRetiredPalette();
  if (previous?.timer) clearTimeout(previous.timer);
  // One migration pass; never scan conversation text or apply foreground repairs.
  document.querySelectorAll('[class*="forge-contrast-"]').forEach(element => {
    element.classList.remove('forge-contrast-status', 'forge-contrast-event', 'forge-contrast-reasoning');
  });

  document.getElementById('wukong-forge-pet-overlay')?.remove();
  document.getElementById('wukong-forge-motif-overlay')?.remove();
  document.getElementById('wukong-forge-style')?.remove();
  document.getElementById('wukong-forge-background')?.remove();
  document.getElementById('wukong-codex-theme-background')?.remove();
  delete root.dataset.forgeBackgroundReady;
  root.dataset.forgeNativeTheme = initialNativeTheme;
  // V75 keeps the original dual-scene runtime but replaces the opaque scroll
  // carrier with one translucent, scene-reactive glass material.  The value is
  // intentionally explicit so a live state read can distinguish it from the
  // historical frosted-paper comparison branch.
  root.dataset.forgePaperMaterial = 'liquid-glass';

  let style = document.getElementById('wukong-codex-theme-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'wukong-codex-theme-style';
    style.dataset.forgeOwned = 'style';
    document.head.append(style);
  }
  style.textContent = `${payload.styleSheet}\n${payload.variables}`;
  root.classList.add('forge-ink-mountain');

  const updateLandingAria = (element, value) => {
    if (!(element instanceof Element)) return;
    if (value === null) {
      if (!element.hasAttribute('aria-label')) return;
      state.selfManagedLandingAria.add(element);
      element.removeAttribute('aria-label');
      return;
    }
    if (element.getAttribute('aria-label') === value) return;
    state.selfManagedLandingAria.add(element);
    element.setAttribute('aria-label', value);
  };
  const restoreLandingCopy = element => {
    if (!(element instanceof Element)) return;
    if (Object.hasOwn(element.dataset, 'forgeOriginalAriaLabel')) {
      const original = element.dataset.forgeOriginalAriaLabel;
      updateLandingAria(element, original === '__forge_absent__' ? null : original);
      delete element.dataset.forgeOriginalAriaLabel;
    }
    delete element.dataset.forgeTitleCopy;
  };
  const landingQuoteCopy = '此去，欲破何局？';
  const applyLandingTitleCopy = element => {
    if (!(element instanceof Element)) return;
    if (!Object.hasOwn(element.dataset, 'forgeOriginalAriaLabel')) {
      element.dataset.forgeOriginalAriaLabel =
        element.hasAttribute('aria-label')
          ? element.getAttribute('aria-label')
          : '__forge_absent__';
    }
    element.dataset.forgeTitleCopy = landingQuoteCopy;
    if (state.landingQuoteVisible !== false) {
      updateLandingAria(element, landingQuoteCopy);
      return;
    }
    const original = element.dataset.forgeOriginalAriaLabel;
    updateLandingAria(element, original === '__forge_absent__' ? null : original);
  };
  let pendingMarkPlan = null;
  const reconcileMarks = planned => {
    const existing = new Set(document.querySelectorAll('[data-forge-mark]'));
    for (const element of existing) {
      const desired = planned.get(element);
      if (!desired) {
        if (element.classList.contains('forge-image-viewer-backdrop')) {
          element.style.removeProperty('--forge-image-viewer-scene');
          element.style.removeProperty('--forge-image-viewer-scene-position');
        }
        restoreLandingCopy(element);
        element.classList.remove(...markClasses);
        delete element.dataset.forgeMark;
        continue;
      }
      for (const name of markClasses) {
        if (!desired.has(name)) element.classList.remove(name);
      }
    }
    for (const [element, desired] of planned) {
      element.classList.add(...desired);
      element.dataset.forgeMark = '1';
    }
  };
  const mark = (element, name) => {
    if (!(element instanceof Element)) return null;
    if (pendingMarkPlan) {
      const desired = pendingMarkPlan.get(element) || new Set();
      desired.add(name);
      pendingMarkPlan.set(element, desired);
      return element;
    }
    element.classList.add(name);
    element.dataset.forgeMark = '1';
    return element;
  };
  const textOf = element => (element?.textContent || '').replace(/\s+/g, ' ').trim();
  const visible = element => {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false;
    for (let cursor = element; cursor && cursor !== document.documentElement; cursor = cursor.parentElement) {
      const computed = getComputedStyle(cursor);
      if (
        cursor.hidden ||
        cursor.getAttribute('aria-hidden') === 'true' ||
        cursor.hasAttribute('inert') ||
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        Number.parseFloat(computed.opacity || '1') <= .01
      ) return false;
    }
    return true;
  };
  const layoutPresent = element => {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false;
    for (let cursor = element; cursor && cursor !== document.documentElement; cursor = cursor.parentElement) {
      const computed = getComputedStyle(cursor);
      if (
        cursor.hidden ||
        cursor.hasAttribute('inert') ||
        computed.display === 'none' ||
        computed.visibility === 'hidden'
      ) return false;
    }
    return true;
  };
  const structurallyMounted = element => {
    if (!(element instanceof Element) || !element.isConnected) return false;
    for (let cursor = element; cursor && cursor !== document.documentElement; cursor = cursor.parentElement) {
      const computed = getComputedStyle(cursor);
      if (
        cursor.hidden ||
        cursor.hasAttribute('inert') ||
        computed.display === 'none' ||
        computed.visibility === 'hidden'
      ) return false;
    }
    return true;
  };
  const largeAncestor = (start, predicate) => {
    let element = start;
    let match = null;
    while (element && element !== document.body) {
      const rect = element.getBoundingClientRect();
      if (predicate(rect, element)) match = element;
      element = element.parentElement;
    }
    return match;
  };

  const createBackgroundImage = () => {
    const image = document.createElement('img');
    image.dataset.forgeBackgroundImage = '';
    image.alt = '';
    image.draggable = false;
    image.decoding = 'async';
    return image;
  };
  const clearTransitionControls = () => {
    if (state.transitionTimer) clearTimeout(state.transitionTimer);
    state.transitionTimer = 0;
    if (state.transitionArmTimer) clearTimeout(state.transitionArmTimer);
    state.transitionArmTimer = 0;
    state.transitionArmed = false;
    if (state.transitionFrameA) window.cancelAnimationFrame(state.transitionFrameA);
    if (state.transitionFrameB) window.cancelAnimationFrame(state.transitionFrameB);
    state.transitionFrameA = 0;
    state.transitionFrameB = 0;
    if (state.transitionEndLayer && state.transitionEndHandler) {
      state.transitionEndLayer.removeEventListener('transitionend', state.transitionEndHandler);
    }
    state.transitionEndLayer = null;
    state.transitionEndHandler = null;
  };
  const ensureBackground = () => {
    let overlay = document.getElementById('wukong-codex-theme-background');
    if (overlay && overlay.querySelectorAll(':scope > [data-forge-background-layer]').length !== 2) {
      overlay.remove();
      overlay = null;
    }
    if (overlay) return overlay;
    delete root.dataset.forgeBackgroundReady;
    clearTransitionControls();
    state.transitionInFlight = false;
    state.pendingSceneStyle = null;
    state.sceneRequestToken += 1;
    state.requestedSceneKey = null;
    state.requestedScene = null;
    state.preloadRequests.forEach(request => request.cancel());
    state.preloadRequests.clear();
    state.activeLayer = 0;
    overlay = document.createElement('div');
    overlay.id = 'wukong-codex-theme-background';
    overlay.dataset.forgeOwned = 'background';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('inert', '');
    overlay.inert = true;
    for (let index = 0; index < 2; index += 1) {
      const layer = document.createElement('div');
      layer.dataset.forgeBackgroundLayer = String(index);
      layer.dataset.forgeActive = 'false';
      const image = createBackgroundImage();
      const veil = document.createElement('i');
      veil.dataset.forgeBackgroundVeil = '';
      layer.append(image, veil);
      overlay.append(layer);
    }
    document.body.prepend(overlay);
    state.overlayGeneration += 1;
    return overlay;
  };

  const sceneStateStorageKey = 'wukong-codex-theme-scene-cursors-v13'; // gitleaks:allow -- public localStorage key, not a credential
  const legacySceneStateStorageKey = 'wukong-forge-scene-cursors-v13'; // gitleaks:allow -- compatibility key, not a credential
  const orderedDeckStrategy = 'ordered-v1';
  const normalizeStoredScene = value => Number.isInteger(value) && value >= 0 ? value : null;
  const normalizeStoredDeck = value => ({
    strategy: value?.strategy === orderedDeckStrategy ? orderedDeckStrategy : null,
    order: Array.isArray(value?.order)
      ? value.order.map(normalizeStoredScene).filter(scene => scene !== null)
      : [],
    index: Number.isInteger(value?.index) && value.index >= 0 ? value.index : -1
  });
  const readSceneState = () => {
    let parsed = null;
    for (const storageName of ['localStorage', 'sessionStorage']) {
      try {
        const storage = window[storageName];
        const currentValue = storage?.getItem(sceneStateStorageKey);
        const legacyValue = currentValue ? null : storage?.getItem(legacySceneStateStorageKey);
        const value = currentValue || legacyValue;
        if (!value) continue;
        const candidate = JSON.parse(value);
        if (candidate && typeof candidate === 'object') {
          if (legacyValue) storage?.setItem(sceneStateStorageKey, value);
          storage?.removeItem(legacySceneStateStorageKey);
          parsed = candidate;
          break;
        }
      } catch {
        // Sandboxed fixture pages may disable either storage implementation.
      }
    }
    for (const storageName of ['localStorage', 'sessionStorage']) {
      try {
        window[storageName]?.removeItem(legacySceneStateStorageKey);
      } catch {
        // Legacy cleanup is best-effort when a storage implementation is disabled.
      }
    }
    parsed ||= {};
    return {
      decks: {
        battle: normalizeStoredDeck(parsed.backgroundDecks?.battle || parsed.decks?.battle),
        scenery: normalizeStoredDeck(parsed.backgroundDecks?.scenery || parsed.decks?.scenery)
      },
      selections: {
        battle: normalizeStoredScene(parsed.selectedBattle ?? parsed.selections?.battle),
        scenery: normalizeStoredScene(parsed.selectedScenery ?? parsed.selections?.scenery)
      },
      lock: parsed.backgroundLocked === true &&
        (parsed.lockedMode === 'battle' || parsed.lockedMode === 'scenery') &&
        normalizeStoredScene(parsed.lockedScene) !== null
        ? {
            mode: parsed.lockedMode,
            scene: normalizeStoredScene(parsed.lockedScene)
          }
        : null
    };
  };
  const writeSceneState = sceneState => {
    const serialized = JSON.stringify({
      version: 6,
      backgroundDecks: sceneState.backgroundDecks,
      selectedBattle: sceneState.selectedScenes.battle,
      selectedScenery: sceneState.selectedScenes.scenery,
      backgroundLocked: sceneState.backgroundLocked,
      lockedMode: sceneState.backgroundLocked ? sceneState.lockedMode : null,
      lockedScene: sceneState.backgroundLocked ? sceneState.lockedScene : null
    });
    for (const storageName of ['localStorage', 'sessionStorage']) {
      try {
        window[storageName]?.setItem(sceneStateStorageKey, serialized);
      } catch {
        // Local persistence is preferred; session storage remains a fallback.
      }
    }
  };
  const sceneList = (computed, name, sceneCount) => computed.getPropertyValue(name)
    .trim()
    .split(/\s+/)
    .map(value => Number.parseInt(value, 10))
    .filter(value => Number.isInteger(value) && value >= 0 && value < sceneCount);
  const readSceneChoices = mode => {
    const computed = getComputedStyle(root);
    const sceneCount = Math.max(1, Number.parseInt(computed.getPropertyValue('--forge-scene-count'), 10) || 1);
    const sceneryScenes = sceneList(computed, '--forge-scenery-scenes', sceneCount);
    const combinedBattleScenes = sceneList(computed, '--forge-battle-scenes', sceneCount);
    const legacyBattleScenes = [
      ...sceneList(computed, '--forge-battle-primary-scenes', sceneCount),
      ...sceneList(computed, '--forge-battle-secondary-scenes', sceneCount)
    ];
    const choices = mode === 'battle'
      ? (combinedBattleScenes.length ? combinedBattleScenes : legacyBattleScenes)
      : sceneryScenes;
    const uniqueChoices = [...new Set(choices)];
    return uniqueChoices.length ? uniqueChoices : [0];
  };
  const deckMatchesChoices = (deck, choices) => (
    deck &&
    deck.strategy === orderedDeckStrategy &&
    Array.isArray(deck.order) &&
    deck.order.length === choices.length &&
    deck.order.every((scene, index) => scene === choices[index]) &&
    Number.isInteger(deck.index) &&
    deck.index >= 0 &&
    deck.index < deck.order.length
  );
  const ensureSceneSelection = (mode, choices, persist = true) => {
    let changed = false;
    let deck = state.backgroundDecks[mode];
    if (!deckMatchesChoices(deck, choices)) {
      const storedSelection = choices.includes(state.selectedScenes[mode])
        ? state.selectedScenes[mode]
        : choices[0];
      deck = {
        strategy: orderedDeckStrategy,
        order: [...choices],
        index: choices.indexOf(storedSelection)
      };
      state.backgroundDecks[mode] = deck;
      state.selectedScenes[mode] = storedSelection;
      changed = true;
    } else if (state.selectedScenes[mode] !== deck.order[deck.index]) {
      state.selectedScenes[mode] = deck.order[deck.index];
      changed = true;
    }
    if (changed && persist) persistSceneState();
    return state.selectedScenes[mode];
  };
  const stepSceneSelection = (mode, choices, direction = 1, persist = true) => {
    ensureSceneSelection(mode, choices, false);
    const deck = state.backgroundDecks[mode];
    const step = direction < 0 ? -1 : 1;
    const nextIndex = (deck.index + step + deck.order.length) % deck.order.length;
    deck.index = nextIndex;
    state.selectedScenes[mode] = deck.order[nextIndex];
    if (persist) persistSceneState();
    return state.selectedScenes[mode];
  };
  const sourceFromCssUrl = value => {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed === 'none') return '';
    const match = trimmed.match(/^url\((['"]?)(.*)\1\)$/s);
    return match ? match[2] : '';
  };
  const preloadBackground = (image, backgroundImage) => {
    const source = sourceFromCssUrl(backgroundImage);
    if (!(image instanceof HTMLImageElement) || !source) return Promise.resolve(false);
    const existing = state.preloadRequests.get(source);
    if (existing?.image === image) return existing.promise;
    state.preloadRequests.forEach(request => request.cancel());

    let resolvePromise;
    let settled = false;
    let decodeStarted = false;
    let timeout = 0;
    const promise = new Promise(resolve => {
      resolvePromise = resolve;
    });
    const finish = value => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      if (!value) {
        try { image.removeAttribute('src'); } catch { }
      }
      state.preloadRequests.delete(source);
      resolvePromise(value);
    };
    const request = {
      image,
      promise,
      cancel: () => finish(false)
    };
    state.preloadRequests.set(source, request);
    delete image.dataset.forgeDecoded;
    timeout = window.setTimeout(() => finish(false), 5000);
    const finishLoadedImage = async () => {
      if (settled || decodeStarted) return;
      decodeStarted = true;
      try {
        await image.decode?.();
      } catch {
        finish(false);
        return;
      }
      if (settled) return;
      const decoded = image.naturalWidth > 0;
      if (decoded) {
        image.dataset.forgeDecoded = 'true';
        state.decodedSources.add(source);
      }
      finish(decoded);
    };
    image.onload = () => {
      void finishLoadedImage();
    };
    image.onerror = () => finish(false);
    image.src = source;
    if (image.complete && image.naturalWidth > 0) void finishLoadedImage();
    return promise;
  };
  const readSceneStyle = (scene, mode) => {
    const priorScene = root.dataset.forgeScene;
    const priorMode = root.dataset.forgeMode;
    root.dataset.forgeScene = String(scene);
    root.dataset.forgeMode = mode;
    const computed = getComputedStyle(root);
    const backgroundVariable = `--forge-bg-${scene}`;
    const result = {
      scene,
      mode,
      backgroundImage: `var(${backgroundVariable})`,
      preloadImage: computed.getPropertyValue(backgroundVariable).trim() || 'none',
      backgroundPosition: computed.getPropertyValue(`--forge-position-${scene}`).trim() || 'center center',
      brightness: computed.getPropertyValue('--forge-scene-brightness').trim() || '1',
      threadVeil: computed.getPropertyValue('--forge-scene-thread-veil').trim() || '.25',
      veil: [
        computed.getPropertyValue('--forge-mode-veil').trim(),
        computed.getPropertyValue('--forge-scene-veil').trim()
      ].filter(value => value && value !== 'none').join(',')
    };
    if (priorScene == null) delete root.dataset.forgeScene;
    else root.dataset.forgeScene = priorScene;
    if (priorMode == null) delete root.dataset.forgeMode;
    else root.dataset.forgeMode = priorMode;
    return result;
  };
  const paintLayer = (layer, sceneStyle) => {
    const image = layer.querySelector('[data-forge-background-image]');
    const veil = layer.querySelector('[data-forge-background-veil]');
    layer.dataset.forgeScene = String(sceneStyle.scene);
    layer.dataset.forgeMode = sceneStyle.mode;
    image.dataset.forgeBackgroundSource = sceneStyle.backgroundImage;
    image.style.objectPosition = sceneStyle.backgroundPosition;
    image.style.setProperty('--forge-layer-brightness', sceneStyle.brightness);
    veil.style.backgroundImage = sceneStyle.veil || 'none';
    veil.style.setProperty('--forge-layer-thread-veil', sceneStyle.threadVeil);
  };
  const clearLayer = layer => {
    if (!layer) return;
    const image = layer.querySelector('[data-forge-background-image]');
    const veil = layer.querySelector('[data-forge-background-veil]');
    layer.dataset.forgeActive = 'false';
    layer.style.opacity = '0';
    layer.style.removeProperty('z-index');
    delete layer.dataset.forgeScene;
    delete layer.dataset.forgeMode;
    if (image) {
      image.onload = null;
      image.onerror = null;
      try { image.removeAttribute('src'); } catch { }
      delete image.dataset.forgeBackgroundSource;
      delete image.dataset.forgeDecoded;
      image.style.removeProperty('object-position');
      image.style.removeProperty('--forge-layer-brightness');
    }
    if (veil) {
      veil.style.backgroundImage = 'none';
      veil.style.removeProperty('--forge-layer-thread-veil');
    }
  };
  const transitionDuration = () => {
    const value = getComputedStyle(root).getPropertyValue('--forge-background-transition').trim();
    if (value.endsWith('ms')) return Math.max(0, Number.parseFloat(value) || 0);
    if (value.endsWith('s')) return Math.max(0, (Number.parseFloat(value) || 0) * 1000);
    return 420;
  };
  const adaptShellToImage = image => {
    // Sample only an already decoded incoming image, never clicks or scroll.
    // Match object-fit:cover and the image's actual horizontal crop.
    try {
      if (!image?.naturalWidth || !image.naturalHeight) return;
      const width = innerWidth, height = innerHeight;
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
      const position = image.style.objectPosition.split(/\s+/)[0];
      const fraction = position === 'right' ? 1 : position === 'left' ? 0 : position.endsWith('%') ? parseFloat(position) / 100 : .5;
      const sx = Math.max(0, (image.naturalWidth * scale - width) * fraction / scale);
      const sy = Math.max(0, (image.naturalHeight * scale - height) / 2 / scale);
      const sidebar = document.querySelector('aside.app-shell-left-panel');
      const stripWidth = sidebar?.getBoundingClientRect().width || 275;
      const canvas = document.createElement('canvas');
      canvas.width = 24; canvas.height = 64;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, sx, sy, Math.min(stripWidth / scale, image.naturalWidth - sx), height / scale, 0, 0, 24, 64);
      const pixels = ctx.getImageData(0, 0, 24, 64).data, values = [];
      for (let i = 0; i < pixels.length; i += 4) values.push((.2126*pixels[i] + .7152*pixels[i+1] + .0722*pixels[i+2]) / 255);
      values.sort((a,b) => a-b);
      const low = values[Math.floor(values.length * .15)], high = values[Math.floor(values.length * .85)];
      const dark = Number((.24 + .54 * high).toFixed(3));
      // Use decoded wallpaper brightness in both themes. Do not assume a
      // white veil: landing has none and thread veils vary by scene.
      const light = Number((.10 + .32 * (1-low)).toFixed(3));
      root.style.setProperty('--forge-shell-dark-alpha', String(dark));
      root.style.setProperty('--forge-shell-light-alpha', String(light));
      state.shellSample = { dark, light, low, high, samples: values.length };
      state.shellSampleCount = (state.shellSampleCount || 0) + 1;
    } catch { /* CORS or decode failure keeps the readable CSS fallback. */ }
  };
  const commitScene = (sceneStyle, preparedLayer = null) => {
    const overlay = ensureBackground();
    const initial = state.currentScene === null || !overlayReady();
    if (!initial && state.transitionInFlight) {
      state.pendingSceneStyle = sceneStyle;
      if (preparedLayer && preparedLayer.dataset.forgeActive !== 'true') clearLayer(preparedLayer);
      return;
    }
    const nextIndex = initial ? 0 : (state.activeLayer === 0 ? 1 : 0);
    const previousLayer = overlay.querySelector(`[data-forge-background-layer="${state.activeLayer}"]`);
    const nextLayer = overlay.querySelector(`[data-forge-background-layer="${nextIndex}"]`);
    if (preparedLayer && preparedLayer !== nextLayer) {
      clearLayer(preparedLayer);
      return;
    }
    paintLayer(nextLayer, sceneStyle);
    adaptShellToImage(nextLayer.querySelector('[data-forge-background-image]'));
    root.dataset.forgeScene = String(sceneStyle.scene);
    root.dataset.forgeMode = sceneStyle.mode;

    if (initial) {
      nextLayer.style.transition = 'none';
      nextLayer.dataset.forgeActive = 'true';
      nextLayer.style.opacity = '1';
      nextLayer.getBoundingClientRect();
      nextLayer.style.removeProperty('transition');
    } else {
      state.transitionInFlight = true;
      overlay.dataset.forgeTransitioning = 'true';
      previousLayer.style.zIndex = '1';
      previousLayer.style.opacity = '1';
      nextLayer.dataset.forgeActive = 'false';
      nextLayer.style.zIndex = '2';
      nextLayer.style.opacity = '0';
      nextLayer.getBoundingClientRect();
      previousLayer.dataset.forgeActive = 'false';
      nextLayer.dataset.forgeActive = 'true';
    }
    overlay.dataset.forgeActiveLayer = String(nextIndex);
    overlay.dataset.forgeReady = 'true';
    state.activeLayer = nextIndex;
    state.currentScene = sceneStyle.scene;
    state.currentMode = sceneStyle.mode;
    state.renderCount += 1;
    root.dataset.forgeBackgroundReady = 'true';
    state.resolveInitialReady?.(true);
    state.resolveInitialReady = null;

    if (!initial) {
      const generation = state.overlayGeneration;
      const finishTransition = () => {
        if (generation !== state.overlayGeneration || !overlay.isConnected) return;
        clearTransitionControls();
        state.transitionInFlight = false;
        delete overlay.dataset.forgeTransitioning;
        clearLayer(previousLayer);
        nextLayer.style.removeProperty('z-index');
        const pending = state.pendingSceneStyle;
        state.pendingSceneStyle = null;
        if (pending && (pending.scene !== state.currentScene || pending.mode !== state.currentMode)) {
          requestScene(pending.scene, pending.mode);
        }
      };
      const beginTransition = () => {
        if (
          state.transitionArmed ||
          generation !== state.overlayGeneration ||
          !overlay.isConnected ||
          !state.transitionInFlight
        ) return;
        state.transitionArmed = true;
        if (state.transitionArmTimer) clearTimeout(state.transitionArmTimer);
        state.transitionArmTimer = 0;
        if (state.transitionFrameA) window.cancelAnimationFrame(state.transitionFrameA);
        state.transitionFrameA = 0;
        state.transitionFrameB = 0;
        const duration = transitionDuration();
        if (duration === 0) {
          nextLayer.style.opacity = '1';
          queueMicrotask(finishTransition);
          return;
        }
        state.transitionEndLayer = nextLayer;
        state.transitionEndHandler = event => {
          if (event.target === nextLayer && event.propertyName === 'opacity') finishTransition();
        };
        nextLayer.addEventListener('transitionend', state.transitionEndHandler);
        nextLayer.style.opacity = '1';
        state.transitionTimer = window.setTimeout(finishTransition, duration + 120);
      };
      /*
       * Two paint frames make the opacity-0 layer observable before its fade.
       * The timer only covers backgrounded Chromium renderers where rAF is
       * paused; the shared arm makes the two paths mutually exclusive.
       */
      state.transitionFrameA = window.requestAnimationFrame(() => {
        state.transitionFrameA = 0;
        state.transitionFrameB = window.requestAnimationFrame(beginTransition);
      });
      state.transitionArmTimer = window.setTimeout(beginTransition, 64);
    }
  };
  const requestScene = (scene, mode, force = false) => {
    if (document.hidden) {
      state.hiddenDirty = true;
      return;
    }
    const overlay = ensureBackground();
    const requestKey = `${mode}:${scene}:${state.overlayGeneration}`;
    if (state.transitionInFlight) {
      state.pendingSceneStyle = state.currentScene === scene && state.currentMode === mode
        ? null
        : readSceneStyle(scene, mode);
      return;
    }
    if (!force && state.requestedSceneKey === requestKey) return;
    if (state.requestedSceneKey && state.requestedSceneKey !== requestKey) {
      state.sceneRequestToken += 1;
      state.requestedSceneKey = null;
      state.requestedScene = null;
      state.preloadRequests.forEach(request => request.cancel());
      state.preloadRequests.clear();
    }
    if (!force && (
      (state.currentScene === scene && state.currentMode === mode) ||
      (state.pendingSceneStyle?.scene === scene && state.pendingSceneStyle?.mode === mode)
    )) return;
    const sceneStyle = readSceneStyle(scene, mode);
    const initial = state.currentScene === null || !overlayReady();
    const nextIndex = initial ? 0 : (state.activeLayer === 0 ? 1 : 0);
    const nextLayer = overlay.querySelector(`[data-forge-background-layer="${nextIndex}"]`);
    clearLayer(nextLayer);
    paintLayer(nextLayer, sceneStyle);
    const nextImage = nextLayer.querySelector('[data-forge-background-image]');
    state.requestedSceneKey = requestKey;
    state.requestedScene = {
      scene,
      mode,
      generation: state.overlayGeneration
    };
    const token = ++state.sceneRequestToken;

    void preloadBackground(nextImage, sceneStyle.preloadImage).then(ready => {
      if (token !== state.sceneRequestToken) {
        if (
          nextLayer.dataset.forgeActive !== 'true' &&
          nextLayer.dataset.forgeScene === String(sceneStyle.scene)
        ) clearLayer(nextLayer);
        return;
      }
      state.requestedSceneKey = null;
      state.requestedScene = null;
      if (document.hidden) {
        clearLayer(nextLayer);
        state.hiddenDirty = true;
        return;
      }
      if (!ready) {
        clearLayer(nextLayer);
        if (state.currentScene === null) {
          state.resolveInitialReady?.(false);
          state.resolveInitialReady = null;
        }
        return;
      }
      commitScene(sceneStyle, nextLayer);
    });
  };
  const overlayReady = () => {
    const overlay = document.getElementById('wukong-codex-theme-background');
    if (!overlay || overlay.querySelectorAll(':scope > [data-forge-background-layer]').length !== 2) return false;
    const active = overlay.querySelector('[data-forge-background-layer][data-forge-active="true"]');
    const image = active?.querySelector('[data-forge-background-image]');
    return Boolean(
      root.dataset.forgeBackgroundReady === 'true' &&
      overlay.dataset.forgeReady === 'true' &&
      active &&
      image instanceof HTMLImageElement &&
      Boolean(image.dataset.forgeBackgroundSource) &&
      Boolean(image.getAttribute('src')) &&
      image.dataset.forgeDecoded === 'true'
    );
  };

  const landingTitlePattern = /我们该构建什么|今天想处理什么|准备好就开始|随时可以开始|从哪里开始|what should we build|what(?:'s| is) on your mind|ready when you are|where should we begin|what (?:do you want|would you like) to (?:work on|do)|how can i help|新建任务/i;
  const landingKickerPattern = /^(?:新建任务|新任务|new task)$/i;
  const landingSubtitlePattern = /^(?:描述目标，?\s*Codex\s*会在当前项目中开始工作。?|describe (?:a )?goal[,，]?\s*and Codex will (?:start|begin) working in (?:the )?current project\.?)$/i;
  const newTaskLabels = [
    '新建任务', '新聊天', '新建对话', '新任务',
    'New task', 'New chat', 'Start a new chat'
  ];
  const exactNewTask = label => newTaskLabels.some(item => label === item || label.startsWith(`${item} `));
  const threadSelectors = [
    '[data-virtualized-turn-content]',
    '[data-local-conversation-final-assistant]',
    '[data-message-author-role]',
    '[data-content-search-turn-key]'
  ].join(',');
  const conversationHasTurns = element => {
    if (!(element instanceof Element)) return false;
    if (element.matches(threadSelectors)) return true;
    return Boolean(element.querySelector(threadSelectors));
  };
  const findLandingTitle = workspace => {
    const scope = workspace || document;
    /*
     * The official home hero enters through a 280 ms opacity animation. Its
     * stable node can therefore have a real layout while opacity is still 0.
     * Detect the layout node instead of waiting for paint; otherwise the skin
     * only appears after an unrelated resize schedules another refresh.
     */
    const stable = [...scope.querySelectorAll('[data-feature="game-source"]')].find(layoutPresent);
    if (stable) return stable;
    return [...scope.querySelectorAll('h1, h2, .heading-xl')]
      .find(element => layoutPresent(element) && landingTitlePattern.test(textOf(element)));
  };
  const classifySurface = workspace => {
    const landingTitle = findLandingTitle(workspace);
    const threadEvidence = [...document.querySelectorAll([
      '[data-thread-find-target="conversation"]',
      threadSelectors
    ].join(','))].find(element => visible(element) && conversationHasTurns(element));
    /*
     * React can leave the prior home hero in layout at opacity 0 while a
     * conversation is already visible. A visible thread is stronger route
     * evidence than that retained layout node; the opposite case remains safe
     * because hidden stale conversations fail `visible()`.
     */
    const priorSurface = root.dataset.forgeSurface;
    const surface = threadEvidence
      ? 'thread'
      : landingTitle
        ? 'landing'
        : priorSurface === 'thread'
          ? 'thread'
          : 'landing';
    return {
      surface,
      threadEvidence,
      landingTitle: surface === 'landing' ? landingTitle : null
    };
  };
  const settingsPageIsActive = () => (
    [...document.querySelectorAll('.scrollbar-stable.flex-1.overflow-y-auto.p-panel')]
      .some(layoutPresent)
  );
  const commonAncestor = (first, second) => {
    if (!(first instanceof Element) || !(second instanceof Element)) return null;
    let cursor = first;
    while (cursor && cursor !== document.body) {
      if (cursor.contains(second)) return cursor;
      cursor = cursor.parentElement;
    }
    return null;
  };
  const markLandingHero = (workspace, landingTitle) => {
    if (!(landingTitle instanceof Element)) return;
    applyLandingTitleCopy(landingTitle);
    mark(landingTitle, 'forge-landing-title');

    const icon = [...(workspace || document).querySelectorAll('[data-testid="home-icon"]')]
      .find(layoutPresent);
    if (icon) mark(icon, 'forge-landing-icon');

    const hero = commonAncestor(landingTitle, icon) || landingTitle.parentElement;
    if (hero && hero !== workspace) {
      mark(hero, 'forge-landing-hero');
      const leafMatch = pattern => [...hero.querySelectorAll('*')]
        .filter(element => (
          element !== landingTitle &&
          element !== icon &&
          layoutPresent(element) &&
          pattern.test(textOf(element)) &&
          ![...element.children].some(child => pattern.test(textOf(child)))
        ))
        .sort((left, right) => {
          const leftRect = left.getBoundingClientRect();
          const rightRect = right.getBoundingClientRect();
          return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
        })[0];
      mark(leafMatch(landingKickerPattern), 'forge-landing-kicker');
      mark(leafMatch(landingSubtitlePattern), 'forge-landing-subtitle');
    }
  };
  const findWorkspace = () => {
    let workspace = document.querySelector('[role="main"], main');
    if (workspace && visible(workspace)) return workspace;
    const anchor = document.querySelector('[data-thread-find-target="conversation"], [data-vscode-context*="supportsNewChatMenu"]');
    workspace = largeAncestor(anchor, rect => rect.width >= innerWidth * .42 && rect.height >= innerHeight * .58);
    if (workspace && visible(workspace)) return workspace;
    return largeAncestor(document.elementFromPoint(innerWidth * .52, innerHeight * .5), rect => (
      rect.width >= innerWidth * .42 && rect.height >= innerHeight * .58 && rect.width < innerWidth * .92
    ));
  };
  const setResizeTargets = targets => {
    const next = [...new Set(targets.filter(Boolean))];
    if (
      next.length === state.observedResizeTargets.length &&
      next.every((target, index) => target === state.observedResizeTargets[index])
    ) return;
    const old = new Set(state.observedResizeTargets);
    const current = new Set(next);
    old.forEach(target => { if (!current.has(target)) state.resizeObserver?.unobserve(target); });
    state.observedResizeTargets = next;
    next.forEach(target => { if (!old.has(target)) state.resizeObserver?.observe(target); });
  };
  const hasClassTokens = (element, tokens) => (
    Boolean(element) && tokens.every(token => element.classList.contains(token))
  );
  const markTopbarMenus = () => {
    const topbar = [...document.querySelectorAll(
      '[class~="group/application-menu-top-bar"], .application-menu'
    )]
      .find(visible);
    if (!topbar) return [];
    mark(topbar, 'forge-topbar');
    const taskbar = [...document.querySelectorAll(
      'header[data-app-shell-header-edge-scroll="true"], .app-thread-header[data-native-slot="taskbar"]'
    )].find(visible);
    if (taskbar) mark(taskbar, 'forge-taskbar');
    const labelPattern = /^(?:文件|编辑|视图|帮助|file|edit|view|help)$/i;
    const nativeApplicationMenuItems = [
      ...topbar.querySelectorAll('button[aria-haspopup="menu"][aria-expanded]')
    ].filter(visible);
    const fallbackSemanticItems = [
      ...topbar.querySelectorAll(
        '[role="menuitem"], [data-menu-id], button, [role="button"]'
      )
    ];
    const directItems = [...topbar.children].filter(element => (
      !element.matches('.history, .window-controls') &&
      labelPattern.test(textOf(element))
    ));
    const menuItems = nativeApplicationMenuItems.length
      ? nativeApplicationMenuItems
      : [...new Set([...fallbackSemanticItems, ...directItems])]
        .filter(element => visible(element) && labelPattern.test(textOf(element)));
    menuItems
      .forEach(element => mark(element, 'forge-topbar-menu-item'));
    return [topbar, taskbar].filter(Boolean);
  };
  const compactPaintSurface = (element, boundary, minimumWidth) => {
    let cursor = element;
    let match = null;
    while (cursor && cursor !== boundary && cursor !== document.body) {
      const rect = cursor.getBoundingClientRect();
      if (rect.height >= 20 && rect.height <= 56 && rect.width >= minimumWidth) match = cursor;
      if (rect.height > 72) break;
      cursor = cursor.parentElement;
    }
    return match;
  };
  const markComposerSurfaces = () => {
    /*
     * The native adapter owns editability and can temporarily render the
     * ProseMirror textbox with contenteditable="false". Editability is an
     * interaction state, not composer identity. Anchor the paint mapping to
     * the official root, chrome and textbox role so read-only/locked frames
     * keep their material without altering native semantics.
     */
    const editorSelector = [
      '.ProseMirror[role="textbox"]',
      '[role="textbox"]',
      '[contenteditable="true"]',
      '[contenteditable="false"][aria-readonly="true"]',
      'textarea',
      '[data-placeholder]'
    ].join(', ');
    const composerSurfaceSelector = [
      '.composer-surface-chrome',
      '[data-composer-surface-variant]'
    ].join(', ');
    let composerRoot = null;
    let editor = null;
    let surface = null;
    for (const candidateRoot of document.querySelectorAll(
      '[data-codex-composer-root]'
    )) {
      if (!visible(candidateRoot)) continue;
      for (const candidateSurface of candidateRoot.querySelectorAll(composerSurfaceSelector)) {
        if (!visible(candidateSurface)) continue;
        const candidateEditor = candidateSurface.matches(editorSelector)
          ? candidateSurface
          : [...candidateSurface.querySelectorAll(editorSelector)].find(visible);
        composerRoot = candidateRoot;
        editor = candidateEditor;
        surface = candidateSurface;
        break;
      }
      if (composerRoot) break;
    }
    if (!surface) {
      surface = [...document.querySelectorAll(composerSurfaceSelector)]
        .filter(visible)
        .sort((
          left,
          right
        ) => right.getBoundingClientRect().bottom - left.getBoundingClientRect().bottom)[0] || null;
      if (surface) {
        composerRoot = surface.closest(
          '[data-codex-composer-root], [data-thread-find-composer="true"]'
        ) || surface.parentElement;
        editor = surface.matches(editorSelector)
          ? surface
          : [...surface.querySelectorAll(editorSelector)].find(visible) || null;
      }
    }
    if (!composerRoot || !surface) return [];

    const aboveComposerPortal = [...composerRoot.children].find(child => (
      child.matches?.(
        '[data-above-composer-portal][data-above-composer-conversation-id]'
      )
    )) || null;
    const composerComponent = [...composerRoot.children].find(child => (
      child !== aboveComposerPortal &&
      child.contains(surface)
    )) || null;

    mark(composerRoot, 'forge-composer');
    if (surface && visible(surface)) mark(surface, 'forge-composer-frame');
    const editorShell = editor?.parentElement?.closest('div') || null;
    if (
      editorShell &&
      editorShell !== surface &&
      surface.contains(editorShell)
    ) mark(editorShell, 'forge-composer-input-shell');

    /*
     * The native composer uses the same navigation-target attribute for both
     * the utility/context row and footer controls. Only the project,
     * environment and branch/run-location controls belong to the upper row.
     * Grouping every navigation target promotes the whole composer root and
     * destroys the native context geometry.
     */
    const navigationSelector = [
      '[data-composer-navigation-target="workspace-project"]',
      '[data-composer-navigation-target="environment"]',
      '[data-composer-navigation-target="run-location"]',
      '[data-composer-navigation-target="branch"]',
      '[data-composer-navigation-target="starting-state"]'
    ].join(', ');
    const threadUtilityTokens = [
      'flex',
      'flex-wrap',
      'items-center',
      'gap-2',
      'overflow-visible',
      'pr-2',
      'pl-2'
    ];
    const homeUtilityTokens = [
      'flex',
      'flex-nowrap',
      'items-center',
      'gap-2',
      'overflow-hidden'
    ];
    const homeScrollArea = [
      ...(composerComponent?.querySelectorAll(
        '[data-composer-utility-bar-scroll-area]'
      ) || [])
    ].find(visible) || null;
    const homeContext = homeScrollArea
      ? [homeScrollArea.parentElement, homeScrollArea]
        .find(element => (
          element &&
          element !== composerRoot &&
          hasClassTokens(element, homeUtilityTokens)
        )) || null
      : null;
    const threadContext = [
      ...(composerComponent?.querySelectorAll('div') || [])
    ].find(element => (
      element !== composerRoot &&
      element !== surface &&
      visible(element) &&
      hasClassTokens(element, threadUtilityTokens) &&
      element.querySelector(navigationSelector)
    )) || null;
    const context = homeContext || threadContext;
    if (
      context &&
      context !== composerRoot &&
      context !== surface &&
      context.getBoundingClientRect().height <= 64
    ) {
      const contextRect = context.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      /*
       * The home utility component is not a placement contract. Codex mounts
       * the same scrollable utility bar above the new-task composer by using
       * a negative overlap wrapper, while ChatGPT Work places it below. Use
       * the painted vertical order so those two products keep independent
       * upper/lower strip ends even when their component signature is shared.
       */
      const contextIsAbove = (
        contextRect.top + contextRect.height / 2 <
        surfaceRect.top + surfaceRect.height / 2
      );
      mark(context, 'forge-composer-context');
      mark(
        context,
        contextIsAbove
          ? 'forge-composer-context-above'
          : 'forge-composer-context-below'
      );
    }

    /*
     * Codex owns two distinct layers here:
     * 1. one AboveComposerPanelRow for the entire queued-message list;
     * 2. one motion wrapper per queued message inside that list.
     * The active goal is a second AboveComposerPanelRow. Preserve that native
     * topology so several queued messages become joined inner leaves instead
     * of several unrelated outer cards.
     */
    const aboveComposerPortals = aboveComposerPortal
      ? [aboveComposerPortal]
      : [];
    const nativePanelRow = panel => (
      structurallyMounted(panel) &&
      hasClassTokens(panel, [
        'relative',
        'min-w-0',
        'overflow-clip',
        'text-token-foreground'
      ])
    );
    const panelStacks = [
      ...(composerRoot.querySelectorAll(
        '.order-2.flex.min-w-0.flex-col'
      ) || [])
    ].filter(stack => (
      structurallyMounted(stack) &&
      !aboveComposerPortal?.contains(stack) &&
      [...stack.children].some(nativePanelRow)
    ));
    panelStacks.forEach(stack => mark(stack, 'forge-composer-panel-stack'));
    const panelCandidates = panelStacks.flatMap(stack => (
      [...stack.children].filter(nativePanelRow)
    ));
    panelCandidates.forEach(panel => mark(panel, 'forge-composer-panel'));
    const queuedListTokens = [
      'vertical-scroll-fade-mask',
      'hide-scrollbar',
      'flex',
      'max-h-[30dvh]',
      'flex-col',
      'gap-px',
      'overflow-x-hidden',
      'overflow-y-auto',
      'px-3',
      'py-row-y'
    ];
    const queuedMessageRowTokens = [
      'group',
      'flex',
      'min-w-0',
      'items-center',
      'justify-between',
      'gap-2',
      'py-0.5',
      'text-sm'
    ];
    const queuedLists = panelCandidates.flatMap(panel => (
      [...panel.querySelectorAll('div')].filter(element => (
        structurallyMounted(element) &&
        hasClassTokens(element, queuedListTokens)
      ))
    ));
    const queuedItems = queuedLists.flatMap(list => (
      [...list.children].filter(item => (
        structurallyMounted(item) &&
        item.classList.contains('overflow-visible') &&
        [...item.querySelectorAll('div')].some(row => (
          structurallyMounted(row) &&
          hasClassTokens(row, queuedMessageRowTokens)
        ))
      ))
    ));
    queuedItems.forEach(item => mark(item, 'forge-composer-queue-item'));

    /*
     * ChatGPT.exe 26.715.2305.0 mounts the composer beneath an official
     * data-thread-scroll-footer. Its first child is a pointer-transparent,
     * full-footer gradient whose only job is to blend the native solid main
     * surface into the thread. Once the thread background is photographic,
     * that paint-only child becomes the unrelated black carrier visible
     * around the paper stack. Clear the inner gradient only: the sticky
     * footer, its obstacle layer and every native hit box stay untouched.
     */
    const threadScrollFooter = composerRoot.closest(
      '[data-thread-scroll-footer="true"]'
    );
    const threadFadeHost = threadScrollFooter
      ? [...threadScrollFooter.children].find(child => (
          layoutPresent(child) &&
          hasClassTokens(child, [
            'pointer-events-none',
            'absolute',
            'inset-x-0',
            'bottom-0',
            'z-0',
            'flex',
            'h-full',
            'w-full',
            'justify-center',
            'pt-4'
          ]) &&
          child.childElementCount === 1
        )) || null
      : null;
    const threadFadePaint = threadFadeHost?.firstElementChild || null;
    const nativeThreadFadePaint = (
      threadFadePaint &&
      hasClassTokens(threadFadePaint, [
        'z-0',
        'h-full',
        'bg-gradient-to-t'
      ]) &&
      [...threadFadePaint.classList].some(token => (
        token === 'from-token-main-surface-primary' ||
        token === 'extension:from-token-bg-primary'
      ))
        ? threadFadePaint
        : null
    );
    if (nativeThreadFadePaint) {
      mark(nativeThreadFadePaint, 'forge-composer-thread-fade');
    }

    const planPattern = /(?:第\s*\d+\s*\/\s*\d+\s*步|step\s*\d+\s*\/\s*\d+)/i;
    const diffPattern = /(?:\d+\s*个文件(?:已)?(?:更改|修改)|\d+\s*files?\s+changed)/i;
    const progressHosts = aboveComposerPortals.flatMap(portal => (
      [...portal.children].filter(child => (
        visible(child) &&
        child.classList.contains('relative') &&
        child.classList.contains('col-start-1') &&
        child.classList.contains('row-start-1') &&
        child.classList.contains('h-8') &&
        child.classList.contains('self-end')
      ))
    ));
    const progressFadeTokens = [
      'pointer-events-none',
      'absolute',
      'inset-x-0',
      '-bottom-1',
      'h-7',
      'bg-gradient-to-t',
      'from-token-main-surface-primary',
      'to-transparent'
    ];
    const nativeProgressFade = (host, child) => {
      if (!layoutPresent(child)) return false;
      if (hasClassTokens(child, progressFadeTokens)) return true;

      /*
       * ChatGPT.exe keeps this paint-only fade either directly below the
       * source-backed progress host or one level down inside its Motion
       * wrapper. Its Tailwind color/direction tokens have changed between
       * packaged builds, so identify that single paint layer by the native
       * geometry and interaction contract instead of by palette classes. The
       * sibling that owns the pill remains interactive and cannot satisfy it.
       */
      const hostRect = host.getBoundingClientRect();
      const rect = child.getBoundingClientRect();
      const style = getComputedStyle(child);
      const horizontalInset = Math.max(
        Math.abs(rect.left - hostRect.left),
        Math.abs(rect.right - hostRect.right)
      );
      const nearHostBottom = (
        rect.top <= hostRect.bottom + 8 &&
        rect.bottom >= hostRect.bottom - 8
      );
      return (
        style.position === 'absolute' &&
        style.pointerEvents === 'none' &&
        child.childElementCount === 0 &&
        horizontalInset <= 2 &&
        rect.height >= 16 &&
        rect.height <= 48 &&
        nearHostBottom
      );
    };
    const progressFades = progressHosts.flatMap(host => {
      const candidates = [
        ...host.children,
        ...[...host.children].flatMap(child => [...child.children])
      ];
      return candidates.filter(child => nativeProgressFade(host, child));
    }).filter((fade, index, fades) => fades.indexOf(fade) === index);
    progressFades.forEach(fade => mark(fade, 'forge-composer-progress-fade'));
    const progressPills = progressHosts.map(host => {
      const descendants = [host, ...host.querySelectorAll('*')].filter(element => {
        if (!visible(element)) return false;
        const rect = element.getBoundingClientRect();
        const text = textOf(element);
        return (
          rect.height >= 24 &&
          rect.height <= 56 &&
          rect.width > 1 &&
          rect.width <= surface.getBoundingClientRect().width &&
          (planPattern.test(text) || diffPattern.test(text))
        );
      });
      return descendants.find(element => hasClassTokens(element, [
        'flex',
        'w-max',
        'max-w-full',
        'min-w-0',
        'items-center',
        'gap-2',
        'rounded-3xl',
        'border',
        'px-3',
        'py-1.5'
      ])) || null;
    }).filter((pill, index, pills) => pill && pills.indexOf(pill) === index);
    progressPills.forEach(pill => {
      const text = textOf(pill);
      mark(pill, 'forge-composer-progress-pill');
      if (planPattern.test(text)) mark(pill, 'forge-plan-pill');
      if (diffPattern.test(text)) mark(pill, 'forge-diff-summary');

    });

    return [
      composerRoot,
      surface,
      editorShell,
      context,
      ...panelStacks,
      ...panelCandidates,
      nativeThreadFadePaint,
      ...progressFades,
      ...progressPills
    ];
  };
  const markRightPanelSurfaces = () => {
    // SummaryPanel.Content now renders a FloatingSurface island. The PIP
    // obstacle is an empty sibling, so never use it as a query scope.
    // Static CSS owns first paint; markers only report component coverage.
    const cards = [...document.querySelectorAll(
      '.rounded-3xl.bg-surface-elevated-secondary[class~="electron:elevation-prominent"]'
    )].filter(card => layoutPresent(card) && card.querySelector('[data-slot^="thread-summary-panel-item"]'));
    const targets = [];
    for (const card of cards) {
      mark(card, 'forge-right-panel');
      targets.push(card);
      card.querySelectorAll('[data-slot="thread-summary-panel-item"], [data-slot="thread-summary-panel-item-button"], [data-slot="thread-summary-panel-item-link"]')
        .forEach(row => { mark(row, 'forge-right-row'); targets.push(row); });
    }
    return targets;
  };
  const markOverlaySurfaces = () => {
    // Diagnostic markers only. Static CSS paints native surface owners on the
    // first frame. Never scan text, decorate icons, or create paper containers.
    const groups = [
      ['[role="menu"][class*="bg-"], [role="listbox"][class*="bg-"]', 'forge-menu'],
      ['[role="dialog"][class*="bg-"], [role="alertdialog"][class*="bg-"]', 'forge-dialog'],
      ['[class*="ComposerTopMenuPanel"], .composer-home-top-menu', 'forge-composer-add-menu'],
      ['[data-thread-user-message-navigation-tooltip-preview]', 'forge-history-preview']
    ];
    const targets = [];
    for (const [selector, className] of groups) {
      for (const surface of document.querySelectorAll(selector)) {
        if (!layoutPresent(surface)) continue;
        mark(surface, className);
        targets.push(surface);
      }
    }
    return targets;
  };
  const markPageSurfaces = () => {
    /*
     * Settings, browser/file workspaces and other entered application pages
     * use a full-viewport main surface instead of the thread main. Detect the
     * source token and viewport ownership, then map its inner main-surface and
     * semantic cards without relying on a localized page title.
     */
    const pageLayoutPresent = element => {
      if (!(element instanceof Element)) return false;
      const rect = element.getBoundingClientRect();
      const computed = getComputedStyle(element);
      /*
       * Electron keeps application subpages below an `invisible` portal
       * carrier and restores visibility on the mounted child. Visibility is
       * overridable, unlike display:none; checking every ancestor therefore
       * rejected the page that is actually painted on screen.
       */
      return rect.width > 1 && rect.height > 1 &&
        computed.display !== 'none' && computed.visibility !== 'hidden';
    };
    const fullPageRoots = [...document.querySelectorAll(
      'main.bg-token-main-surface-primary'
    )].filter(element => {
      if (!pageLayoutPresent(element)) return false;
      const rect = element.getBoundingClientRect();
      return rect.width >= innerWidth * .82 && rect.height >= innerHeight * .82 &&
        textOf(element).length > 3;
    });
    const enteredWorkspaceRoots = [...document.querySelectorAll('main.main-surface')]
      .filter(element => {
        if (!pageLayoutPresent(element)) return false;
        const rect = element.getBoundingClientRect();
        if (rect.width < innerWidth * .42 || rect.height < innerHeight * .5) return false;
        if (element.querySelector([
          '[data-thread-find-target="conversation"]',
          '[data-feature="game-source"]',
          '[data-testid="home-icon"]',
          '[data-codex-composer-root]',
          '[data-thread-find-composer="true"]'
        ].join(','))) return false;
        return textOf(element).length > 3;
      });
    const pageRoots = [...new Set([...fullPageRoots, ...enteredWorkspaceRoots])];
    const targets = [];
    for (const pageRoot of pageRoots) {
      mark(pageRoot, 'forge-page-surface');
      targets.push(pageRoot);
      const settingsScroller = pageRoot.querySelector(
        '.scrollbar-stable.flex-1.overflow-y-auto.p-panel'
      );
      const scheduledSearch = pageRoot.querySelector('#scheduled-page-search');
      const pageRect = pageRoot.getBoundingClientRect();
      if (settingsScroller && pageLayoutPresent(settingsScroller)) {
        mark(pageRoot, 'forge-settings-page');
        const settingsShell = pageRoot.parentElement?.closest(
          'main.no-drag.flex.h-full.min-h-0.flex-col'
        );
        if (settingsShell && pageLayoutPresent(settingsShell)) {
          mark(settingsShell, 'forge-settings-page');
          targets.push(settingsShell);
        }
      }
      if (scheduledSearch && pageLayoutPresent(scheduledSearch)) {
        mark(pageRoot, 'forge-scheduled-page');
        /*
         * The scheduler's search field is nested in a wide sticky layout
         * carrier.  The carrier's utility tokens change between desktop
         * releases, so follow the actual input upward and mark only the first
         * short, near-page-width ancestor.  This avoids styling the input
         * itself and removes the otherwise detached full-width band.
         */
        let searchBand = null;
        for (
          let candidate = scheduledSearch.parentElement;
          candidate && candidate !== pageRoot;
          candidate = candidate.parentElement
        ) {
          if (!pageLayoutPresent(candidate)) continue;
          const rect = candidate.getBoundingClientRect();
          if (
            rect.width >= pageRect.width * .74 &&
            rect.height >= 38 &&
            rect.height <= 120
          ) {
            searchBand = candidate;
            break;
          }
        }
        if (searchBand) {
          mark(searchBand, 'forge-page-search-band');
          targets.push(searchBand);
        }
      }
      const contentCandidates = [...pageRoot.querySelectorAll(
        ':is(.main-surface, .bg-token-main-surface-primary)'
      )]
        .filter(element => {
          if (!pageLayoutPresent(element)) return false;
          const rect = element.getBoundingClientRect();
          return element !== pageRoot &&
            rect.width >= Math.max(320, pageRect.width * .28) &&
            rect.height >= pageRect.height * .5;
        });
      const primaryContent = contentCandidates.find(element => (
        element !== pageRoot &&
        element.classList.contains('h-full') &&
        element.tagName !== 'MAIN'
      )) || contentCandidates.at(-1) || null;
      const contentSurfaces = [...new Set([
        ...(primaryContent ? [primaryContent] : []),
        ...contentCandidates.filter(element => (
          element.classList.contains('bg-token-main-surface-primary') ||
          element.classList.contains('main-surface')
        ))
      ])];
      for (const content of contentSurfaces) {
        mark(content, 'forge-page-content');
        targets.push(content);
        const cards = [...content.querySelectorAll(
          ':is(div, section, article)[class*="rounded"][class~="border"]'
        )].filter(element => {
          if (!pageLayoutPresent(element)) return false;
          const rect = element.getBoundingClientRect();
          return rect.width >= 260 && rect.height >= 44 && rect.height <= innerHeight * .78;
        });
        cards.forEach(card => mark(card, 'forge-page-card'));
        targets.push(...cards);

        /*
         * A page can place a normal text input directly inside a tall editor
         * group.  `closest(div)` promoted that whole group to a 700 px search
         * bar on Scheduled Tasks.  Only a compact, direct input shell is a
         * page search surface; large editors remain owned by their page card.
         */
        const searchSurfaces = [...content.querySelectorAll(
          'input[class*="text-token-input-foreground"]'
        )].map(input => input.parentElement).filter(surface => {
          if (!pageLayoutPresent(surface)) return false;
          const rect = surface.getBoundingClientRect();
          return rect.width >= 120 && rect.height >= 24 && rect.height <= 64;
        });
        searchSurfaces.forEach(surface => mark(surface, 'forge-page-search'));
        targets.push(...searchSurfaces);
      }
    }
    return targets;
  };
  const markPageSearchBands = () => {
    const targets = [];
    for (const search of document.querySelectorAll(
      '#scheduled-page-search, #plugins-store-page-search'
    )) {
      if (!layoutPresent(search)) continue;
      for (
        let candidate = search.parentElement;
        candidate && candidate !== document.body;
        candidate = candidate.parentElement
      ) {
        if (!layoutPresent(candidate)) continue;
        const rect = candidate.getBoundingClientRect();
        if (
          rect.width >= innerWidth * .7 &&
          rect.height >= 38 &&
          rect.height <= 120
        ) {
          mark(candidate, 'forge-page-search-band');
          targets.push(candidate);
          break;
        }
      }
    }
    return targets;
  };
  const floatingSidebarShellSelector = [
    'aside[data-testid="app-shell-floating-left-panel"]',
    '[data-testid="app-shell-floating-left-panel"] > aside',
    '[class~="fixed"][class~="left-0"] > aside:has(nav.sidebar-foreground-muted)'
  ].join(',');
  const sidebarShellSelector = [floatingSidebarShellSelector, 'aside.app-shell-left-panel'].join(',');
  const markSidebarSurfaces = () => {
    // Native rows own their paint. Only track mounted shells; measuring every
    // button and text Range served the retired selected-row design.
    const sidebar = [...document.querySelectorAll(floatingSidebarShellSelector)].find(layoutPresent) ||
      [...document.querySelectorAll('aside.app-shell-left-panel')].find(layoutPresent);
    if (!sidebar) return [];
    mark(sidebar, 'forge-sidebar');
    mark(sidebar, 'forge-sidebar-shell');
    return [sidebar];
  };
  const regionCache = new Map();
  const refresh = (regions = null) => {
    const refreshStartedAt = performance.now();
    state.lastRefreshAt = performance.now();
    state.refreshCount += 1;
    const nativeTheme = detectNativeTheme();
    if (state.nativeTheme !== nativeTheme) state.nativeTheme = nativeTheme;
    if (root.dataset.forgeNativeTheme !== nativeTheme) root.dataset.forgeNativeTheme = nativeTheme;
    document.getElementById('wukong-forge-pet-overlay')?.remove();
    document.getElementById('wukong-forge-motif-overlay')?.remove();

    const overlayWasReady = overlayReady();
    const workspace = findWorkspace();
    const settingsVeil = settingsPageIsActive();
    const settingsTransition = settingsVeil || state.settingsPageActive === true;
    let { surface, landingTitle } = classifySurface(workspace);
    if (settingsVeil && state.lastSurface) {
      surface = state.lastSurface;
      landingTitle = null;
    }
    state.settingsPageActive = settingsVeil;
    const routeHref = location.href;
    const surfaceChanged = state.lastSurface !== null && state.lastSurface !== surface;
    const routeChanged = state.lastRouteHref !== routeHref;
    if (surfaceChanged || routeChanged) regions = null;
    if (routeChanged) {
      state.routeTimers.forEach(timer => clearTimeout(timer));
      state.routeTimers.clear();
    }
    if ((surfaceChanged || routeChanged) && !settingsTransition && !state.backgroundLocked) state.manualBackgroundMode = null;
    state.lastSurface = surface;
    state.lastRouteHref = routeHref;
    state.automaticBackgroundMode = surface === 'landing' ? 'battle' : 'scenery';
    let mode = state.backgroundLocked
      ? state.lockedMode
      : (state.manualBackgroundMode || state.automaticBackgroundMode);
    if (mode !== 'battle' && mode !== 'scenery') mode = state.automaticBackgroundMode;
    root.dataset.forgeSurface = surface;
    root.dataset.forgeSettingsVeil = settingsVeil ? 'true' : 'false';
    root.dataset.forgeMode = mode;
    ensureBackground();
    const plannedMarks = new Map();
    const runRegion = (name, collect) => {
      if (!regions || regions.has('all') || regions.has(name) || !regionCache.has(name)) {
        const marks = new Map();
        pendingMarkPlan = marks;
        let targets;
        try { targets = collect(); } finally { pendingMarkPlan = plannedMarks; }
        regionCache.set(name, { marks, targets });
        state.regionRefreshCounts ||= {};
        state.regionRefreshCounts[name] = (state.regionRefreshCounts[name] || 0) + 1;
      }
      const cached = regionCache.get(name);
      for (const [element, names] of cached.marks) {
        if (!element.isConnected) continue;
        const desired = plannedMarks.get(element) || new Set();
        names.forEach(name => desired.add(name));
        plannedMarks.set(element, desired);
      }
      return cached.targets.filter(element => element?.isConnected);
    };
    pendingMarkPlan = plannedMarks;
    let topbarTargets;
    let composerTargets;
    let sidebarTargets;
    let rightPanelTargets;
    let overlayTargets;
    let pageTargets;
    try {
      mark(workspace, 'forge-workspace');
      topbarTargets = runRegion('topbar', markTopbarMenus);
      composerTargets = runRegion('composer', markComposerSurfaces);
      sidebarTargets = runRegion('sidebar', markSidebarSurfaces);
      rightPanelTargets = runRegion('right', markRightPanelSurfaces);
      overlayTargets = runRegion('overlay', markOverlaySurfaces);
      pageTargets = runRegion('page', () => [...markPageSurfaces(), ...markPageSearchBands()]);
      if (surface === 'landing') markLandingHero(workspace, landingTitle);
    } finally {
      pendingMarkPlan = null;
      reconcileMarks(plannedMarks);
    }

    const safeChoices = readSceneChoices(mode);
    ensureSceneSelection(mode, safeChoices);
    if (state.backgroundLocked) {
      if (!safeChoices.includes(state.lockedScene)) {
        state.lockedScene = state.selectedScenes[mode];
        state.lockedMode = mode;
        persistSceneState();
      }
      state.selectedScenes[mode] = state.lockedScene;
    }
    state.sceneKey = `${mode}|renderer`;
    const plannedScene = state.backgroundLocked ? state.lockedScene : state.selectedScenes[mode];
    const requestedSceneIsCurrent = state.requestedScene?.mode === mode &&
      state.requestedScene.scene === plannedScene &&
      state.requestedScene.generation === state.overlayGeneration;
    const pendingSceneIsCurrent = state.pendingSceneStyle?.mode === mode &&
      state.pendingSceneStyle?.scene === plannedScene;
    const activeSceneIsPlanned = state.currentMode === mode &&
      state.currentScene === plannedScene;
    if (overlayWasReady && activeSceneIsPlanned) {
      if (state.requestedScene && !requestedSceneIsCurrent) {
        state.sceneRequestToken += 1;
        state.requestedSceneKey = null;
        state.requestedScene = null;
        state.preloadRequests.forEach(request => request.cancel());
        state.preloadRequests.clear();
      }
      if (state.pendingSceneStyle && !pendingSceneIsCurrent) {
        state.pendingSceneStyle = null;
      }
    }
    if (!overlayWasReady && !requestedSceneIsCurrent && !pendingSceneIsCurrent) {
      requestScene(plannedScene, mode, true);
    } else if (
      overlayWasReady &&
      !requestedSceneIsCurrent &&
      !pendingSceneIsCurrent &&
      !activeSceneIsPlanned
    ) {
      requestScene(plannedScene, mode);
    }

    const landingMountTargets = [...document.querySelectorAll([
      '[data-feature="game-source"]',
      '[data-testid="home-icon"]',
      '[data-vscode-context*="supportsNewChatMenu"] [role="main"]'
    ].join(','))];
    setResizeTargets([
      workspace,
      ...topbarTargets,
      ...composerTargets,
      ...sidebarTargets,
      ...rightPanelTargets,
      ...pageTargets,
      ...landingMountTargets
    ]);
    state.lastRefreshDurationMs = performance.now() - refreshStartedAt;
    state.maxRefreshDurationMs = Math.max(state.maxRefreshDurationMs || 0, state.lastRefreshDurationMs);
  };

  let resolveInitialReady;
  const initialReady = new Promise(resolve => {
    resolveInitialReady = resolve;
  });
  const storedSceneState = readSceneState();
  const state = {
    revision: payload.runtimeRevision,
    observer: null,
    resizeObserver: null,
    observedResizeTargets: [],
    lastRefreshAt: 0,
    timer: 0,
    timerDueAt: 0,
    hiddenDirty: false,
    firstPaintRefreshQueued: false,
    disposed: false,
    routeTimers: new Set(),
    backgroundDecks: storedSceneState.decks,
    selectedScenes: storedSceneState.selections,
    backgroundLocked: previousBackgroundLock !== null || storedSceneState.lock !== null,
    lockedMode: previousBackgroundLock?.mode || storedSceneState.lock?.mode || null,
    lockedScene: previousBackgroundLock?.scene ?? storedSceneState.lock?.scene ?? null,
    pendingBackgroundMode: null,
    pendingBackgroundDirection: 1,
    manualBackgroundMode: previous?.manualBackgroundMode === 'battle' || previous?.manualBackgroundMode === 'scenery'
      ? previous.manualBackgroundMode
      : null,
    automaticBackgroundMode: null,
    landingQuoteVisible: previousLandingQuoteVisible,
    nativeTheme: initialNativeTheme,
    selfManagedLandingAria: new WeakSet(),
    lastSurface: previous?.lastSurface === 'landing' || previous?.lastSurface === 'thread'
      ? previous.lastSurface
      : null,
    lastRouteHref: typeof previous?.lastRouteHref === 'string'
      ? previous.lastRouteHref
      : location.href,
    sceneKey: null,
    currentScene: null,
    currentMode: null,
    activeLayer: 0,
    transitionInFlight: false,
    transitionTimer: 0,
    transitionArmTimer: 0,
    transitionArmed: false,
    transitionFrameA: 0,
    transitionFrameB: 0,
    transitionEndLayer: null,
    transitionEndHandler: null,
    pendingSceneStyle: null,
    requestedSceneKey: null,
    requestedScene: null,
    sceneRequestToken: 0,
    preloadRequests: new Map(),
    decodedSources: new Set(),
    overlayGeneration: 0,
    refreshCount: 0,
    renderCount: 0,
    resolveInitialReady,
    refresh,
    nextBackground: null,
    previousBackground: null,
    toggleBackgroundMode: null,
    toggleBackgroundLock: null,
    toggleLandingQuote: null,
    nativeThemeObserver: null,
    dispose: null
  };
  root.dataset.forgeLandingQuoteVisible = state.landingQuoteVisible ? 'true' : 'false';
  root.dataset.forgeBackgroundLocked = state.backgroundLocked ? 'true' : 'false';
  root.dataset.forgeNativeTheme = state.nativeTheme;
  const persistSceneState = () => writeSceneState(state);
  const updateLockedScene = (mode, scene) => {
    if (!state.backgroundLocked) return;
    state.lockedMode = mode;
    state.lockedScene = scene;
    persistSceneState();
  };
  const stepBackground = (requestedMode, direction = 1) => {
    const mode = requestedMode === 'battle' || requestedMode === 'scenery'
      ? requestedMode
      : (
          (state.backgroundLocked && state.lockedMode) ||
          state.manualBackgroundMode ||
          state.automaticBackgroundMode ||
          (root.dataset.forgeMode === 'scenery' || state.currentMode === 'scenery' ? 'scenery' : 'battle')
        );
    const step = direction < 0 ? -1 : 1;
    if (document.hidden) {
      if (state.pendingBackgroundMode === null) {
        state.pendingBackgroundMode = mode;
        state.pendingBackgroundDirection = step;
      }
      state.hiddenDirty = true;
      return false;
    }
    const scene = stepSceneSelection(mode, readSceneChoices(mode), step);
    updateLockedScene(mode, scene);
    if (state.backgroundLocked) root.dataset.forgeMode = mode;
    if (root.dataset.forgeMode === mode) requestScene(scene, mode);
    return true;
  };
  const nextBackground = requestedMode => stepBackground(requestedMode, 1);
  const previousBackground = requestedMode => stepBackground(requestedMode, -1);
  const toggleBackgroundMode = () => {
    if (document.hidden) {
      state.hiddenDirty = true;
      return false;
    }
    const visibleMode = root.dataset.forgeMode === 'scenery' || state.currentMode === 'scenery'
      ? 'scenery'
      : 'battle';
    const mode = visibleMode === 'battle' ? 'scenery' : 'battle';
    const safeChoices = readSceneChoices(mode);
    ensureSceneSelection(mode, safeChoices);
    state.manualBackgroundMode = mode === state.automaticBackgroundMode ? null : mode;
    updateLockedScene(mode, state.selectedScenes[mode]);
    root.dataset.forgeMode = mode;
    requestScene(state.selectedScenes[mode], mode);
    return true;
  };
  const toggleBackgroundLock = () => {
    if (state.backgroundLocked) {
      /*
       * A manual F/B/C request may still be decoding under the lock. Invalidate
       * it before exposing the unlocked state, otherwise that stale locked-mode
       * image can commit once and flash before the current surface default wins.
       */
      if (state.requestedScene || state.preloadRequests.size) {
        state.sceneRequestToken += 1;
        state.requestedSceneKey = null;
        state.requestedScene = null;
        state.preloadRequests.forEach(request => request.cancel());
        state.preloadRequests.clear();
      }
      state.pendingSceneStyle = null;
      state.pendingBackgroundMode = null;
      state.pendingBackgroundDirection = 1;
      state.backgroundLocked = false;
      state.lockedMode = null;
      state.lockedScene = null;
      state.manualBackgroundMode = null;
      root.dataset.forgeBackgroundLocked = 'false';
      persistSceneState();
      scheduleRefresh(0);
      return false;
    }
    /*
     * Once a scene has committed, currentScene already points at the incoming
     * layer even while its fade is still running. Lock that committed target
     * and let the one in-flight transition finish. Only an uncommitted decode
     * or queued follow-up intent is cancelled below.
     */
    const mode = state.currentMode === 'battle' || state.currentMode === 'scenery'
      ? state.currentMode
      : (root.dataset.forgeMode === 'scenery' ? 'scenery' : 'battle');
    const safeChoices = readSceneChoices(mode);
    ensureSceneSelection(mode, safeChoices);
    const scene = Number.isInteger(state.currentScene) && safeChoices.includes(state.currentScene)
      ? state.currentScene
      : state.selectedScenes[mode];
    if (state.requestedScene || state.preloadRequests.size) {
      state.sceneRequestToken += 1;
      state.requestedSceneKey = null;
      state.requestedScene = null;
      state.preloadRequests.forEach(request => request.cancel());
      state.preloadRequests.clear();
    }
    state.pendingSceneStyle = null;
    state.pendingBackgroundMode = null;
    state.pendingBackgroundDirection = 1;
    state.backgroundLocked = true;
    state.lockedMode = mode;
    state.lockedScene = scene;
    state.manualBackgroundMode = mode === state.automaticBackgroundMode ? null : mode;
    state.selectedScenes[mode] = scene;
    root.dataset.forgeMode = mode;
    root.dataset.forgeBackgroundLocked = 'true';
    persistSceneState();
    return true;
  };
  const toggleLandingQuote = () => {
    state.landingQuoteVisible = !state.landingQuoteVisible;
    root.dataset.forgeLandingQuoteVisible = state.landingQuoteVisible ? 'true' : 'false';
    const landingTitle = findLandingTitle(findWorkspace());
    if (landingTitle) applyLandingTitleCopy(landingTitle);
    return state.landingQuoteVisible;
  };
  state.nextBackground = nextBackground;
  state.previousBackground = previousBackground;
  state.toggleBackgroundMode = toggleBackgroundMode;
  state.toggleBackgroundLock = toggleBackgroundLock;
  state.toggleLandingQuote = toggleLandingQuote;
  const pendingRegions = new Set();
  const scheduleRefresh = (maximumDelay, regions = ['all']) => {
    regions.forEach(region => pendingRegions.add(region));
    if (document.hidden) {
      state.hiddenDirty = true;
      return;
    }
    const elapsed = performance.now() - state.lastRefreshAt;
    const naturalDelay = Math.max(140, 520 - elapsed);
    const delay = Number.isFinite(maximumDelay)
      ? Math.min(naturalDelay, Math.max(0, maximumDelay))
      : naturalDelay;
    const dueAt = performance.now() + delay;
    if (state.timer) {
      if (state.timerDueAt <= dueAt + 1) return;
      clearTimeout(state.timer);
    }
    state.timerDueAt = dueAt;
    state.timer = window.setTimeout(() => {
      state.timer = 0;
      state.timerDueAt = 0;
      if (document.hidden) {
        state.hiddenDirty = true;
        return;
      }
      const regions = new Set(pendingRegions);
      pendingRegions.clear();
      refresh(regions);
    }, delay);
  };
  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (state.timer) clearTimeout(state.timer);
      state.timer = 0;
      state.timerDueAt = 0;
      state.hiddenDirty = true;
      if (state.requestedScene || state.preloadRequests.size) {
        state.sceneRequestToken += 1;
        state.requestedSceneKey = null;
        state.requestedScene = null;
        state.preloadRequests.forEach(request => request.cancel());
        state.preloadRequests.clear();
      }
      return;
    }
    const hiddenDirty = state.hiddenDirty;
    const pendingBackgroundMode = state.pendingBackgroundMode;
    const pendingBackgroundDirection = state.pendingBackgroundDirection;
    state.hiddenDirty = false;
    state.pendingBackgroundMode = null;
    state.pendingBackgroundDirection = 1;
    if (pendingBackgroundMode) stepBackground(pendingBackgroundMode, pendingBackgroundDirection);
    if (hiddenDirty || pendingBackgroundMode) scheduleRefresh(0);
  };
  const queueRefreshes = delays => {
    /*
     * Only the newest navigation/submit needs bounded follow-up probes. Rapid
     * clicks must not retain one timer set per event until every old deadline.
     */
    state.routeTimers.forEach(timer => clearTimeout(timer));
    state.routeTimers.clear();
    scheduleRefresh();
    for (const delay of delays) {
      const timer = window.setTimeout(() => {
        state.routeTimers.delete(timer);
        scheduleRefresh(0);
      }, delay);
      state.routeTimers.add(timer);
    }
  };
  const scheduleNavigationRefresh = event => {
    const target = event.target instanceof Element
      ? event.target.closest('button, a, [role="button"], [role="treeitem"]')
      : null;
    if (!target) return;
    const label = textOf(target);
    const newTask = exactNewTask(label);
    const insideComposer = Boolean(target.closest(
      '[data-thread-find-composer="true"], .composer-surface-chrome, [data-composer-surface-variant]'
    ));
    const composerSubmit = insideComposer && (
      target.matches('button[type="submit"], [data-testid="send-button"]') ||
      /^(?:发送|提交|Send(?: message)?|Submit)$/iu.test(target.getAttribute('aria-label') || label)
    );
    const sidebarNavigation = Boolean(target.closest([
      '[data-app-action-sidebar-project-row]',
      '[data-app-action-sidebar-thread-row]',
      '[data-project-row]',
      '[data-sidebar-project-row]',
      '[data-sidebar-thread-row]',
      '[data-root-thread-row]'
    ].join(',')));
    const possibleNavigation = newTask ||
      sidebarNavigation ||
      target.matches('a[href], [role="treeitem"], [aria-current], [aria-selected]') ||
      target.closest('a[href], [role="treeitem"]');
    if (!possibleNavigation && !composerSubmit) return;
    queueRefreshes(composerSubmit ? [320, 1100] : [360]);
  };
  const scheduleComposerKeyboardSubmit = event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(
      '[data-thread-find-composer="true"], .composer-surface-chrome, [data-composer-surface-variant]'
    )) return;
    queueRefreshes([320, 1100]);
  };
  const handleThemeKeyboardShortcut = event => {
    if (!event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey) return;
    const key = String(event.key || '').toLowerCase();
    const toggleMode = key === 'c' || event.code === 'KeyC';
    const toggleLock = key === 'k' || event.code === 'KeyK';
    const toggleQuote = key === 't' || event.code === 'KeyT';
    const direction = key === 'f' || event.code === 'KeyF'
      ? 1
      : (key === 'b' || event.code === 'KeyB' ? -1 : 0);
    if (!direction && !toggleMode && !toggleLock && !toggleQuote) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (toggleLock) toggleBackgroundLock();
    else if (toggleQuote) toggleLandingQuote();
    else if (toggleMode) toggleBackgroundMode();
    else if (direction < 0) previousBackground();
    else nextBackground();
  };
  const routeEventName = 'wukong-codex-theme-route-v13';
  const scheduleRouteRefresh = () => {
    // Mounted structures are observed directly; keep only one fallback for
    // routes whose content arrives asynchronously without a recognised root.
    queueRefreshes([720]);
  };
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  const notifyRoute = () => window.dispatchEvent(new Event(routeEventName));
  history.pushState = function (...args) {
    const result = originalPushState.apply(this, args);
    notifyRoute();
    return result;
  };
  history.replaceState = function (...args) {
    const result = originalReplaceState.apply(this, args);
    notifyRoute();
    return result;
  };

  const surfaceSignalSelector = [
    '[data-feature="game-source"]',
    '[data-testid="home-icon"]',
    '[data-vscode-context*="supportsNewChatMenu"]',
    '[data-thread-find-target="conversation"]',
    '[data-virtualized-turn-content]',
    '[data-content-search-turn-key]',
    '[data-local-conversation-final-assistant]',
    '[data-message-author-role]'
  ].join(',');
  const refreshStructureSelector = [
    '[class~="group/application-menu-top-bar"]',
    '[class~="group/application-menu-top-bar"] button[aria-haspopup="menu"][aria-expanded]',
    '.application-menu',
    '[data-thread-find-composer]',
    '[data-thread-scroll-footer="true"]',
    '[data-codex-composer-root]',
    '[data-above-composer-portal]',
    '.composer-surface-chrome',
    '[data-composer-navigation-target]',
    '[data-pip-obstacle="thread-summary-panel"]',
    '[data-slot^="thread-summary-panel-"]',
    '[role="menu"]',
    '[role="listbox"]',
    '[role="tooltip"]',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[role="menuitem"]',
    '[role="menuitemradio"]',
    '[role="menuitemcheckbox"]',
    '[role="option"]',
    '[data-composer-overlay-floating-ui="true"]',
    '.composer-home-top-menu',
    ':is(div, section).flex.max-w-full.flex-col.overflow-hidden.rounded-lg[class~="bg-token-dropdown-background/50"][class*="--turn-diff-row-padding-y"]',
    'main.bg-token-main-surface-primary',
    'main.bg-token-main-surface-primary .main-surface',
    'main.main-surface .bg-token-main-surface-primary',
    'main.main-surface input[class*="text-token-input-foreground"]',
    '#scheduled-page-search',
    '#plugins-store-page-search',
    '.app-shell-left-panel',
    '[data-testid="app-shell-floating-left-panel"]',
    '[class~="fixed"][class~="left-0"] > aside:has(nav.sidebar-foreground-muted)',
    '[data-app-action-sidebar-scroll]',
    '[data-app-action-sidebar-section]',
    '[data-app-action-sidebar-section-heading]',
    '[data-app-action-sidebar-project-row]',
    '[data-app-action-sidebar-project-list-id]',
    '[data-app-action-sidebar-thread-row]',
    '.vertical-scroll-fade-mask',
    '[data-project-row]',
    '[data-sidebar-project-row]',
    '[data-sidebar-thread-row]',
    '[data-root-thread-row]',
    '.app-shell-left-panel button',
    '.app-shell-left-panel a[href]',
    '[role="treeitem"]'
  ].join(',');
  const nodeTouchesSurfaceSignal = node => (
    node.nodeType === Node.ELEMENT_NODE &&
    (node.matches(surfaceSignalSelector) || Boolean(node.querySelector(surfaceSignalSelector)))
  );
  const recordTouchesSurfaceSignal = record => {
    const target = record.target instanceof Element
      ? record.target
      : record.target?.parentElement;
    if (record.type === 'attributes') return Boolean(target?.matches(surfaceSignalSelector));
    return [...record.addedNodes, ...record.removedNodes].some(nodeTouchesSurfaceSignal);
  };
  const nodeTouchesThemeStructure = node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.id === 'wukong-codex-theme-background') return true;
    if (node.matches('[data-forge-owned], [data-forge-owned] *')) return false;
    return node.matches(refreshStructureSelector) || Boolean(node.querySelector(refreshStructureSelector));
  };
  const nodeIsWithinThemeStructure = node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    if (node.matches('[data-forge-owned], [data-forge-owned] *')) return false;
    return node.matches(refreshStructureSelector) || Boolean(node.closest(refreshStructureSelector));
  };
  const composerBoundarySelector = [
    '[data-codex-composer-root]',
    '[data-thread-find-composer="true"]',
    '[data-thread-scroll-footer="true"]',
    '.composer-surface-chrome',
    '[data-above-composer-portal]'
  ].join(',');
  const composerSignalSelector = [
    '[data-codex-composer-root]',
    '[data-thread-scroll-footer="true"]',
    '.composer-surface-chrome',
    '[data-above-composer-portal]',
    '[data-composer-utility-bar-scroll-area]',
    '[data-composer-navigation-target]',
    '[data-composer-overlay-floating-ui="true"]',
    '.composer-home-top-menu',
    '.order-2.flex.min-w-0.flex-col',
    '.relative.min-w-0.overflow-clip.text-token-foreground',
    '.vertical-scroll-fade-mask.hide-scrollbar.flex.max-h-\\[30dvh\\].flex-col.gap-px.overflow-x-hidden.overflow-y-auto.px-3.py-row-y',
    '.relative.col-start-1.row-start-1.h-8.self-end',
    '.flex.w-max.max-w-full.min-w-0.items-center.gap-2.rounded-3xl.border.px-3.py-1\\.5',
    'button.size-token-button-composer'
  ].join(',');
  const nodeTouchesComposerSignal = node => (
    node.nodeType === Node.ELEMENT_NODE &&
    (
      node.matches(composerSignalSelector) ||
      Boolean(node.querySelector(composerSignalSelector))
    )
  );
  const recordTouchesComposerSignal = record => {
    const target = record.target instanceof Element
      ? record.target
      : record.target?.parentElement;
    if (!target?.closest(composerBoundarySelector)) return false;
    if (record.type === 'attributes') return target.matches(composerSignalSelector);
    return (
      target.matches(composerSignalSelector) ||
      [...record.addedNodes, ...record.removedNodes].some(nodeTouchesComposerSignal)
    );
  };
  const firstPaintStructureSelector = [
    '[data-codex-composer-root]',
    '[data-thread-find-composer="true"]',
    '[data-thread-scroll-footer="true"]',
    '.composer-surface-chrome',
    '[data-above-composer-portal]',
    '[data-composer-utility-bar-scroll-area]',
    '[data-composer-navigation-target="workspace-project"]',
    '[data-composer-navigation-target="environment"]',
    '[data-composer-navigation-target="run-location"]',
    '[data-composer-navigation-target="branch"]',
    '[data-composer-navigation-target="starting-state"]',
    '[data-composer-overlay-floating-ui="true"]',
    '.composer-home-top-menu',
    ':is(div, section).flex.max-w-full.flex-col.overflow-hidden.rounded-lg[class~="bg-token-dropdown-background/50"][class*="--turn-diff-row-padding-y"]',
    '[data-pip-obstacle="thread-summary-panel"]',
    '.app-shell-left-panel',
    '[data-testid="app-shell-floating-left-panel"]',
    '[class~="fixed"][class~="left-0"] > aside:has(nav.sidebar-foreground-muted)'
  ].join(',');
  const nodeMountsFirstPaintStructure = node => (
    node.nodeType === Node.ELEMENT_NODE &&
    !node.matches('[data-forge-owned], [data-forge-owned] *') &&
    (
      node.matches(firstPaintStructureSelector) ||
      Boolean(node.querySelector(firstPaintStructureSelector))
    )
  );
  const recordMountsFirstPaintStructure = record => {
    if (record.type !== 'childList') return false;
    const addedElements = [...record.addedNodes].filter(node => (
      node.nodeType === Node.ELEMENT_NODE &&
      !node.matches('[data-forge-owned], [data-forge-owned] *')
    ));
    if (addedElements.some(nodeMountsFirstPaintStructure)) return true;
    if (addedElements.some(nodeTouchesSurfaceSignal)) return true;
    const target = record.target instanceof Element
      ? record.target
      : record.target?.parentElement;
    if (!target?.closest(firstPaintStructureSelector)) return false;
    return (
      addedElements.length > 0 && (
        !target.closest(composerBoundarySelector) ||
        target.matches(composerSignalSelector) ||
        addedElements.some(nodeTouchesComposerSignal)
      )
    );
  };
  const scheduleFirstPaintRefresh = regions => {
    // Native selectors paint composer/portal surfaces immediately. Full geometry
    // reconciliation no longer blocks the click's microtask checkpoint.
    if (!state.disposed) scheduleRefresh(80, regions);
  };
  const changedRegion = node => {
    if (!(node instanceof Element)) node = node?.parentElement;
    if (!node) return null;
    if (node.closest('[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"], [role="tooltip"], [class*="ComposerTopMenuPanel"]')) return 'overlay';
    if (node.closest(composerBoundarySelector)) return 'composer';
    if (node.closest(sidebarShellSelector)) return 'sidebar';
    if (node.closest('.rounded-3xl.bg-surface-elevated-secondary[class~="electron:elevation-prominent"]')) return 'right';
    return null;
  };
  const mutationRegions = records => {
    const regions = new Set();
    for (const record of records) {
      if (recordTouchesSurfaceSignal(record)) return ['all'];
      if (record.type === 'attributes' && record.attributeName === 'aria-expanded' &&
          record.target.matches('button[aria-haspopup]')) {
        regions.add('overlay');
        if (!record.target.closest(composerBoundarySelector)) regions.add('topbar');
        continue;
      }
      const region = changedRegion(record.target);
      if (region) { regions.add(region); continue; }
      const nodes = [...record.addedNodes, ...record.removedNodes];
      if (!nodes.length) return ['all'];
      for (const node of nodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const mountedRegion = changedRegion(node);
        if (!mountedRegion) return ['all'];
        regions.add(mountedRegion);
      }
    }
    return regions.size ? [...regions] : ['all'];
  };
  const observer = new MutationObserver(records => {
    const observedRecords = records.filter(record => {
      if (
        record.type === 'attributes' &&
        record.attributeName === 'aria-label' &&
        record.target instanceof Element &&
        state.selfManagedLandingAria.has(record.target)
      ) {
        state.selfManagedLandingAria.delete(record.target);
        return false;
      }
      return true;
    });
    if (!observedRecords.length) return;
    if (observedRecords.some(record => (
      record.target?.id === 'wukong-codex-theme-background' ||
      [...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE && node.id === 'wukong-codex-theme-background')
    ))) delete root.dataset.forgeBackgroundReady;
    const firstPaintStructureMounted = observedRecords.some(recordMountsFirstPaintStructure);
    const composerSignalChanged = observedRecords.some(recordTouchesComposerSignal);
    const otherThemeStructureChanged = observedRecords.some(record => {
      if (recordTouchesSurfaceSignal(record)) return true;
      const target = record.target instanceof Element
        ? record.target
        : record.target?.parentElement;
      if (target?.closest(composerBoundarySelector)) return false;
      return record.type === 'attributes'
        ? (
            nodeTouchesThemeStructure(record.target) ||
            Boolean(record.target.closest?.(sidebarShellSelector))
          )
        : (
            nodeIsWithinThemeStructure(record.target) ||
            [...record.addedNodes, ...record.removedNodes].some(nodeTouchesThemeStructure)
          );
    });
    if (firstPaintStructureMounted) {
      scheduleFirstPaintRefresh(mutationRegions(observedRecords));
    } else if (composerSignalChanged || otherThemeStructureChanged) {
      scheduleRefresh(composerSignalChanged ? 140 : undefined, mutationRegions(observedRecords));
    }
  });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => {
    const regions = entries.map(entry => changedRegion(entry.target));
    scheduleRefresh(undefined, regions.every(Boolean) ? regions : ['all']);
  }) : null;
  const syncNativeTheme = () => {
    const nativeTheme = detectNativeTheme();
    if (nativeTheme === state.nativeTheme && root.dataset.forgeNativeTheme === nativeTheme) return;
    state.nativeTheme = nativeTheme;
    root.dataset.forgeNativeTheme = nativeTheme;
  };
  const nativeThemeObserver = new MutationObserver(syncNativeTheme);
  nativeThemeObserver.observe(root, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'data-color-theme', 'data-color-scheme', 'data-mode', 'style']
  });
  const systemThemeMedia = window.matchMedia?.('(prefers-color-scheme: dark)') || null;
  systemThemeMedia?.addEventListener?.('change', syncNativeTheme);
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'aria-current',
      'aria-selected',
      'aria-expanded',
      'aria-label',
      'aria-disabled',
      'disabled',
      'hidden',
      'inert',
      'title',
      'data-state',
      'data-disabled',
      'data-app-action-sidebar-thread-active',
      'data-app-action-sidebar-project-collapsed'
    ]
  });
  window.addEventListener('popstate', scheduleRouteRefresh);
  window.addEventListener('hashchange', scheduleRouteRefresh);
  window.addEventListener(routeEventName, scheduleRouteRefresh);
  window.addEventListener('resize', scheduleRefresh);
  window.visualViewport?.addEventListener('resize', scheduleRefresh);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  document.addEventListener('click', scheduleNavigationRefresh, true);
  document.addEventListener('keydown', scheduleComposerKeyboardSubmit, true);
  document.addEventListener('keydown', handleThemeKeyboardShortcut, true);
  state.observer = observer;
  state.nativeThemeObserver = nativeThemeObserver;
  state.resizeObserver = resizeObserver;
  state.dispose = () => {
    state.disposed = true;
    regionCache.clear();
    pendingRegions.clear();
    root.style.removeProperty('--forge-shell-dark-alpha');
    root.style.removeProperty('--forge-shell-light-alpha');
    state.firstPaintRefreshQueued = false;
    window.removeEventListener('popstate', scheduleRouteRefresh);
    window.removeEventListener('hashchange', scheduleRouteRefresh);
    window.removeEventListener(routeEventName, scheduleRouteRefresh);
    window.removeEventListener('resize', scheduleRefresh);
    window.visualViewport?.removeEventListener('resize', scheduleRefresh);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    document.removeEventListener('click', scheduleNavigationRefresh, true);
    document.removeEventListener('keydown', scheduleComposerKeyboardSubmit, true);
    document.removeEventListener('keydown', handleThemeKeyboardShortcut, true);
    systemThemeMedia?.removeEventListener?.('change', syncNativeTheme);
    observer.disconnect();
    nativeThemeObserver.disconnect();
    resizeObserver?.disconnect();
    if (state.timer) clearTimeout(state.timer);
    clearTransitionControls();
    state.sceneRequestToken += 1;
    state.requestedSceneKey = null;
    state.requestedScene = null;
    state.pendingSceneStyle = null;
    state.resolveInitialReady?.(false);
    state.resolveInitialReady = null;
    state.preloadRequests.forEach(request => request.cancel());
    state.preloadRequests.clear();
    document.querySelectorAll('#wukong-codex-theme-background > [data-forge-background-layer]').forEach(clearLayer);
    state.routeTimers.forEach(timer => clearTimeout(timer));
    state.routeTimers.clear();
    if (history.pushState === state.patchedPushState) history.pushState = originalPushState;
    if (history.replaceState === state.patchedReplaceState) history.replaceState = originalReplaceState;
    document.getElementById('wukong-forge-pet-overlay')?.remove();
    document.getElementById('wukong-forge-motif-overlay')?.remove();
    document.getElementById('wukong-codex-theme-background')?.remove();
    delete root.dataset.forgeLandingQuoteVisible;
    delete root.dataset.forgeBackgroundLocked;
    delete root.dataset.forgeNativeTheme;
    delete root.dataset.forgePaperMaterial;
    delete root.dataset.forgeSettingsVeil;
    clearRetiredPalette();
  };
  state.patchedPushState = history.pushState;
  state.patchedReplaceState = history.replaceState;
  window[runtimeKey] = state;
  refresh();
  /*
   * Bounded startup probes cover React mounting the home hero after the first
   * runtime pass. They stop after 420 ms and do not become a polling loop.
   */
  queueRefreshes([120, 420]);
  return initialReady;
}

// Material-only hot updates keep scene variables and the existing runtime/layers.
// Replacing the style with CSS alone drops wallpaper data and can trigger recovery.
export function makeStyleUpdateExpression({ styleSheet, variables }) {
  if (typeof styleSheet !== 'string' || typeof variables !== 'string' || !variables.trim()) {
    throw new Error('Style updates require both CSS and scene variables');
  }
  return `(() => {
    const style = document.getElementById('wukong-codex-theme-style');
    if (!style || !window.__wukongCodexThemeRuntimeV13) throw Error('Active theme required');
    const next = ${JSON.stringify(`${styleSheet}\n${variables}`)};
    if (style.textContent !== next) style.textContent = next;
    return { updated: true, timeOrigin: performance.timeOrigin };
  })()`;
}

export function makeApplyExpression({ styleSheet, variables }) {
  const payload = JSON.stringify({
    styleSheet,
    variables,
    markClasses: MARK_CLASSES,
    runtimeKey: RUNTIME_KEY,
    runtimeRevision: RUNTIME_REVISION,
    retiredRuntimeKeys: RETIRED_RUNTIME_KEYS
  });
  return `(${applyRuntime.toString()})(${payload})`;
}

export const THEME_STATE_EXPRESSION = `(() => {
  const overlay = document.getElementById('wukong-codex-theme-background');
  const activeLayer = overlay?.querySelector('[data-forge-background-layer][data-forge-active="true"]') || null;
  const activeImage = activeLayer?.querySelector('[data-forge-background-image]') || null;
  const visible = element => {
    if (!(element instanceof Element)) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) return false;
    for (let cursor = element; cursor && cursor !== document.documentElement; cursor = cursor.parentElement) {
      const computed = getComputedStyle(cursor);
      if (
        cursor.hidden ||
        cursor.getAttribute('aria-hidden') === 'true' ||
        cursor.hasAttribute('inert') ||
        computed.display === 'none' ||
        computed.visibility === 'hidden' ||
        Number.parseFloat(computed.opacity || '1') <= .01
      ) return false;
    }
    return true;
  };
  const nativeComposerFrames = [
    ...document.querySelectorAll(
      '[data-thread-find-composer="true"] :is(.composer-surface-chrome, [data-composer-surface-variant])'
    )
  ].filter(frame => (
    visible(frame) &&
    Boolean(frame.querySelector('.ProseMirror[role="textbox"]'))
  ));
  return {
    documentHidden: document.hidden,
    stylePresent: Boolean(document.getElementById('wukong-codex-theme-style')),
    rootClass: document.documentElement.classList.contains('forge-ink-mountain'),
    markedElements: document.querySelectorAll('[data-forge-mark]').length,
    ownedNodeCount: document.querySelectorAll('[data-forge-owned]').length,
    backgroundLayerPresent: Boolean(overlay),
    backgroundLayerCount: overlay?.querySelectorAll(':scope > [data-forge-background-layer]').length || 0,
    backgroundActiveLayer: overlay?.dataset.forgeActiveLayer || null,
    backgroundActiveScene: activeLayer?.dataset.forgeScene || null,
    backgroundActiveMode: activeLayer?.dataset.forgeMode || null,
    backgroundActiveImage: activeImage?.dataset.forgeBackgroundSource || '',
    backgroundLoadedLayerCount: overlay
      ? [...overlay.querySelectorAll('[data-forge-background-image]')]
        .filter(image => (
          image.dataset.forgeBackgroundSource &&
          image.getAttribute('src') &&
          image.dataset.forgeDecoded === 'true'
        )).length
      : 0,
    backgroundTransitioning: overlay?.dataset.forgeTransitioning === 'true',
    backgroundReady: document.documentElement.dataset.forgeBackgroundReady === 'true' &&
      overlay?.dataset.forgeReady === 'true',
    preloadInFlight: window.__wukongCodexThemeRuntimeV13?.preloadRequests?.size || 0,
    motifLayerPresent: Boolean(document.getElementById('wukong-forge-motif-overlay')),
    visibleNativeComposerCount: nativeComposerFrames.length,
    visibleThemedComposerCount: nativeComposerFrames.filter(
      frame => frame.classList.contains('forge-composer-frame')
    ).length,
    surface: document.documentElement.dataset.forgeSurface || null,
    mode: document.documentElement.dataset.forgeMode || null,
    scene: document.documentElement.dataset.forgeScene || null,
    backgroundLocked: document.documentElement.dataset.forgeBackgroundLocked === 'true',
    lockedMode: window.__wukongCodexThemeRuntimeV13?.lockedMode || null,
    lockedScene: Number.isInteger(window.__wukongCodexThemeRuntimeV13?.lockedScene)
      ? String(window.__wukongCodexThemeRuntimeV13.lockedScene)
      : null,
    landingQuoteVisible: document.documentElement.dataset.forgeLandingQuoteVisible === 'true',
    nativeTheme: document.documentElement.dataset.forgeNativeTheme || null,
    paperMaterial: document.documentElement.dataset.forgePaperMaterial || null,
    settingsVeil: document.documentElement.dataset.forgeSettingsVeil === 'true',
    refreshCount: window.__wukongCodexThemeRuntimeV13?.refreshCount || 0,
    renderCount: window.__wukongCodexThemeRuntimeV13?.renderCount || 0,
    runtimeRevision: window.__wukongCodexThemeRuntimeV13?.revision || null,
    runtimeV4: Boolean(window.__wukongCodexForgeRuntimeV4),
    runtimeV5: Boolean(window.__wukongCodexForgeRuntimeV5),
    runtimeV6: Boolean(window.__wukongCodexForgeRuntimeV6),
    runtimeV7: Boolean(window.__wukongCodexForgeRuntimeV7),
    runtimeV8: Boolean(window.__wukongCodexForgeRuntimeV8),
    runtimeV9: Boolean(window.__wukongCodexForgeRuntimeV9),
    runtimeV10: Boolean(window.__wukongCodexForgeRuntimeV10),
    runtimeV11: Boolean(window.__wukongCodexForgeRuntimeV11),
    runtimeV12: Boolean(window.__wukongCodexForgeRuntimeV12),
    runtimeV13: Boolean(window.__wukongCodexThemeRuntimeV13)
  };
})()`;

export const ACTIVE_PROBE_EXPRESSION = `(() => {
  const overlay = document.getElementById('wukong-codex-theme-background');
  const layers = overlay?.querySelectorAll(':scope > [data-forge-background-layer]') || [];
  const active = overlay?.querySelector('[data-forge-background-layer][data-forge-active="true"]');
  const image = active?.querySelector('[data-forge-background-image]');
  // Composer nodes may remount before the runtime observer tags them.
  // Their transient paint state must not restart a healthy background runtime.
  return Boolean(
    document.getElementById('wukong-codex-theme-style') &&
    document.documentElement.classList.contains('forge-ink-mountain') &&
    window.__wukongCodexThemeRuntimeV13 &&
    document.documentElement.dataset.forgeBackgroundReady === 'true' &&
    overlay?.dataset.forgeReady === 'true' &&
    layers.length === 2 &&
    active &&
    image?.dataset.forgeBackgroundSource &&
    image.getAttribute('src') &&
    image.dataset.forgeDecoded === 'true'
  );
})()`;

export const isActiveThemeState = state => Boolean(state) &&
  state.stylePresent === true &&
  state.rootClass === true &&
  state.backgroundLayerPresent === true &&
  state.backgroundLayerCount === 2 &&
  state.backgroundReady === true &&
  ['0', '1'].includes(state.backgroundActiveLayer) &&
  ['landing', 'thread'].includes(state.surface) &&
  ['battle', 'scenery'].includes(state.mode) &&
  /^\d+$/.test(String(state.scene || '')) &&
  state.backgroundActiveScene === state.scene &&
  state.backgroundActiveMode === state.mode &&
  Boolean(state.backgroundActiveImage && state.backgroundActiveImage !== 'none') &&
  state.motifLayerPresent === false &&
  Number.isInteger(state.visibleNativeComposerCount) &&
  Number.isInteger(state.visibleThemedComposerCount) &&
  state.visibleThemedComposerCount === state.visibleNativeComposerCount &&
  state.runtimeV12 === false &&
  state.runtimeV13 === true;

export const isDeferredThemeState = state => Boolean(state) &&
  state.documentHidden === true &&
  state.stylePresent === true &&
  state.rootClass === true &&
  state.backgroundLayerPresent === true &&
  state.backgroundLayerCount === 2 &&
  state.backgroundReady === false &&
  ['landing', 'thread'].includes(state.surface) &&
  ['battle', 'scenery'].includes(state.mode) &&
  state.motifLayerPresent === false &&
  Number.isInteger(state.visibleNativeComposerCount) &&
  Number.isInteger(state.visibleThemedComposerCount) &&
  state.visibleThemedComposerCount === state.visibleNativeComposerCount &&
  state.runtimeV12 === false &&
  state.runtimeV13 === true &&
  state.runtimeRevision === RUNTIME_REVISION;

export const isNativeThemeState = state => Boolean(state) &&
  state.stylePresent === false &&
  state.rootClass === false &&
  state.markedElements === 0 &&
  state.ownedNodeCount === 0 &&
  state.backgroundLayerPresent === false &&
  state.backgroundReady === false &&
  state.motifLayerPresent === false &&
  state.runtimeV4 === false &&
  state.runtimeV5 === false &&
  state.runtimeV6 === false &&
  state.runtimeV7 === false &&
  state.runtimeV8 === false &&
  state.runtimeV9 === false &&
  state.runtimeV10 === false &&
  state.runtimeV11 === false &&
  state.runtimeV12 === false &&
  state.runtimeV13 === false;

export const RESTORE_EXPRESSION = `(() => {
  for (const runtimeKey of [${[...RETIRED_RUNTIME_KEYS, RUNTIME_KEY].map(key => `'${key}'`).join(',')}]) {
    const runtime = window[runtimeKey];
    runtime?.observer?.disconnect();
    runtime?.nativeThemeObserver?.disconnect();
    runtime?.resizeObserver?.disconnect();
    runtime?.dispose?.();
    if (runtime?.timer) clearTimeout(runtime.timer);
    delete window[runtimeKey];
  }
  document.getElementById('wukong-codex-theme-style')?.remove();
  document.getElementById('wukong-forge-style')?.remove();
  document.getElementById('wukong-forge-pet-overlay')?.remove();
  document.getElementById('wukong-forge-motif-overlay')?.remove();
  document.getElementById('wukong-codex-theme-background')?.remove();
  document.getElementById('wukong-forge-background')?.remove();
  document.querySelectorAll('[data-forge-mark]').forEach(element => {
    if (Object.hasOwn(element.dataset, 'forgeOriginalAriaLabel')) {
      const original = element.dataset.forgeOriginalAriaLabel;
      if (original === '__forge_absent__') element.removeAttribute('aria-label');
      else element.setAttribute('aria-label', original);
      delete element.dataset.forgeOriginalAriaLabel;
    }
    delete element.dataset.forgeTitleCopy;
    element.style.removeProperty('--forge-image-viewer-scene');
    element.style.removeProperty('--forge-image-viewer-scene-position');
    element.classList.remove(${MARK_CLASSES.map(name => `'${name}'`).join(',')});
    delete element.dataset.forgeMark;
  });
  document.documentElement.classList.remove('forge-ink-mountain');
  delete document.documentElement.dataset.forgeSurface;
  delete document.documentElement.dataset.forgeScene;
  delete document.documentElement.dataset.forgeMode;
  delete document.documentElement.dataset.forgeBackgroundReady;
  delete document.documentElement.dataset.forgeBackgroundLocked;
  delete document.documentElement.dataset.forgeLandingQuoteVisible;
  delete document.documentElement.dataset.forgeJournalTone;
  delete document.documentElement.dataset.forgeNativeTheme;
  delete document.documentElement.dataset.forgePaperMaterial;
  delete document.documentElement.dataset.forgeSettingsVeil;
  delete document.documentElement.dataset.forgeWukongSafe;
  delete document.documentElement.dataset.forgeBajieSafe;
  delete document.documentElement.dataset.forgeGourdSafe;
  delete document.documentElement.dataset.forgeGourdPlacement;
  for (const property of [
    '--forge-native-foreground',
    '--forge-native-token-foreground',
    '--forge-native-text-primary',
    '--forge-native-text-secondary',
    '--forge-native-text-tertiary',
    '--forge-native-description',
    '--forge-native-sidebar-foreground',
    '--forge-native-sidebar-token-foreground',
    '--forge-native-sidebar-text-primary',
    '--forge-native-sidebar-text-secondary',
    '--forge-native-sidebar-text-tertiary',
    '--forge-native-sidebar-description'
  ]) document.documentElement.style.removeProperty(property);
  return true;
})()`;
