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
  'forge-dialog',
  'forge-button'
];

const RUNTIME_KEY = '__wukongCodexForgeRuntimeV13';
const RUNTIME_REVISION = 'v54-native-pages-and-toggle';
const RETIRED_RUNTIME_KEYS = [
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
  previous?.observer?.disconnect();
  previous?.resizeObserver?.disconnect();
  previous?.dispose?.();
  if (previous?.timer) clearTimeout(previous.timer);

  document.getElementById('wukong-forge-pet-overlay')?.remove();
  document.getElementById('wukong-forge-motif-overlay')?.remove();
  document.getElementById('wukong-forge-background')?.remove();
  delete root.dataset.forgeBackgroundReady;

  let style = document.getElementById('wukong-forge-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'wukong-forge-style';
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
    let overlay = document.getElementById('wukong-forge-background');
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
    overlay.id = 'wukong-forge-background';
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

  const sceneStateStorageKey = 'wukong-forge-scene-cursors-v13'; // gitleaks:allow -- public localStorage key, not a credential
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
        const value = window[storageName]?.getItem(sceneStateStorageKey);
        if (!value) continue;
        const candidate = JSON.parse(value);
        if (candidate && typeof candidate === 'object') {
          parsed = candidate;
          break;
        }
      } catch {
        // Sandboxed fixture pages may disable either storage implementation.
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
      }
    };
  };
  const writeSceneState = sceneState => {
    const serialized = JSON.stringify({
      version: 5,
      backgroundDecks: sceneState.backgroundDecks,
      selectedBattle: sceneState.selectedScenes.battle,
      selectedScenery: sceneState.selectedScenes.scenery
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
        state.transitionFrameB = 0;
        if (
          generation !== state.overlayGeneration ||
          !overlay.isConnected ||
          !state.transitionInFlight
        ) return;
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
       * Cached decodes can resolve inside the same rendering turn. Keep the
       * incoming layer at opacity 0 for one painted frame before arming the
       * fade, so cached and uncached images follow the exact same transition.
       */
      state.transitionFrameA = window.requestAnimationFrame(() => {
        state.transitionFrameA = 0;
        state.transitionFrameB = window.requestAnimationFrame(beginTransition);
      });
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
    const overlay = document.getElementById('wukong-forge-background');
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

  const landingTitlePattern = /我们该构建什么|今天想处理什么|准备好就开始|从哪里开始|what should we build|what(?:'s| is) on your mind|ready when you are|where should we begin|what (?:do you want|would you like) to (?:work on|do)|how can i help|新建任务/i;
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
    state.resizeObserver?.disconnect();
    state.observedResizeTargets = next;
    next.forEach(target => state.resizeObserver?.observe(target));
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
    return [topbar];
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
    let composerRoot = null;
    let editor = null;
    let surface = null;
    for (const candidateRoot of document.querySelectorAll(
      '[data-codex-composer-root]'
    )) {
      if (!visible(candidateRoot)) continue;
      for (const candidateSurface of candidateRoot.querySelectorAll('.composer-surface-chrome')) {
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
      surface = [...document.querySelectorAll('.composer-surface-chrome')]
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
    ) mark(context, 'forge-composer-context');

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
      [...pill.querySelectorAll('svg')].filter(layoutPresent).forEach(icon => {
        mark(icon, 'forge-progress-status-icon');
      });
      const markSmallestDelta = (pattern, className) => {
        [...pill.querySelectorAll('*')]
          .filter(element => pattern.test(textOf(element)))
          .filter(element => ![...element.children].some(child => pattern.test(textOf(child))))
          .forEach(element => mark(element, className));
      };
      markSmallestDelta(/^[+＋]\s*\d/u, 'forge-diff-added');
      markSmallestDelta(/^[-−－]\s*\d/u, 'forge-diff-removed');
    });

    /*
     * Codex owns the send/stop state on a type="button" control. Restrict the
     * search to the official select-none footer and its final control group:
     * prefer a semantic send/stop label, then accept one unlabeled native
     * signature only when it is the final visible button in both the footer
     * and its immediate control group. Never infer this control from the
     * composer-wide bottom-right geometry.
     */
    const nativeSubmitTokens = [
      'cursor-interaction',
      'size-token-button-composer',
      'flex',
      'items-center',
      'justify-center',
      'rounded-full',
      'transition-opacity',
      'focus-visible:outline-2'
    ];
    const footerCandidates = surface
      ? [...surface.querySelectorAll('div.select-none')].filter(element => (
          visible(element) &&
          [...element.classList].some(token => /^_footer_.+_\d+$/.test(token)) &&
          element.querySelector('button')
        ))
      : [];
    const footer = footerCandidates.find(element => (
      [...element.querySelectorAll('button')].some(button => (
        visible(button) && hasClassTokens(button, nativeSubmitTokens)
      ))
    )) || null;
    if (footer) mark(footer, 'forge-composer-footer');
    const footerButtons = footer
      ? [...footer.querySelectorAll('button')].filter(visible)
      : [];
    const nativeSubmitButtons = footerButtons.filter(button => (
      hasClassTokens(button, nativeSubmitTokens)
    ));
    const submitPattern = /(?:send|stop|发送|停止|取消生成|cancel generation)/i;
    const semanticSubmit = nativeSubmitButtons.find(button => (
      submitPattern.test(
        [
          button.getAttribute('aria-label'),
          button.getAttribute('title'),
          textOf(button)
        ].filter(Boolean).join(' ')
      )
    ));
    const unlabeledSubmitButtons = nativeSubmitButtons.filter(button => (
      ![
        button.getAttribute('aria-label'),
        button.getAttribute('title'),
        textOf(button)
      ].filter(Boolean).join(' ').trim()
    ));
    const unlabeledFooterSubmit = unlabeledSubmitButtons.length === 1
      ? unlabeledSubmitButtons[0]
      : null;
    const unlabeledControlGroupButtons = unlabeledFooterSubmit?.parentElement
      ? [
          ...unlabeledFooterSubmit.parentElement.querySelectorAll('button')
        ].filter(visible)
      : [];
    const submit = semanticSubmit || (
      unlabeledFooterSubmit &&
      footerButtons.at(-1) === unlabeledFooterSubmit &&
      unlabeledControlGroupButtons.at(-1) === unlabeledFooterSubmit
        ? unlabeledFooterSubmit
        : null
    );
    if (submit) mark(submit, 'forge-composer-submit');
    return [
      composerRoot,
      surface,
      editorShell,
      footer,
      context,
      ...panelStacks,
      ...panelCandidates,
      nativeThreadFadePaint,
      ...progressFades,
      ...progressPills,
      submit
    ];
  };
  const markRightPanelSurfaces = () => {
    /*
     * ChatGPT.exe 26.715.2305.0 owns the floating panel geometry: the
     * data-pip obstacle is its stable mount, the inner card is exactly 300px
     * wide, and each native row exposes a thread-summary-panel-item slot.
     * Map those source-backed nodes only; paint must never infer a replacement
     * box from the current color, radius or shadow.
     */
    const panel = [...document.querySelectorAll(
      '[data-pip-obstacle="thread-summary-panel"]'
    )].find(layoutPresent) || null;
    if (!panel) return [];
    mark(panel, 'forge-right-panel');

    const cardTokens = [
      'relative',
      'flex',
      'max-h-full',
      'min-h-0',
      'flex-col',
      'overflow-hidden',
      'rounded-3xl',
      'bg-token-dropdown-background',
      'pt-2.5'
    ];
    const sourceCard = [panel, ...panel.querySelectorAll('div, section')]
      .find(element => layoutPresent(element) && hasClassTokens(element, cardTokens)) || null;
    const titlePattern = /^(?:环境信息|environment(?: info(?:rmation)?)?)$/i;
    const titleCandidates = [...panel.querySelectorAll(
      'h1, h2, h3, h4, h5, h6, [role="heading"], p, span, div'
    )].filter(element => (
      layoutPresent(element) && titlePattern.test(textOf(element))
    )).sort((left, right) => {
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      return leftRect.width * leftRect.height - rightRect.width * rightRect.height;
    });
    const title = titleCandidates[0] || null;
    let fallbackCard = null;
    for (let element = title?.parentElement; element && element !== panel; element = element.parentElement) {
      const rect = element.getBoundingClientRect();
      if (
        layoutPresent(element) &&
        rect.width >= 280 &&
        rect.width <= 320 &&
        rect.height >= 84 &&
        rect.height <= innerHeight * .78
      ) {
        fallbackCard = element;
        break;
      }
    }
    const card = sourceCard || fallbackCard;
    if (!card) return [panel];
    mark(card, 'forge-right-card');
    if (title && card.contains(title)) mark(title, 'forge-right-title');
    /*
     * The current packaged title can own its paint directly or sit inside a
     * dropdown-background carrier. `closest()` stopped at the heading itself,
     * which left that carrier's native dark strip visible. Walk only the
     * source-backed title branch and clear every heading/header or explicit
     * dropdown surface on it; never widen the match to unrelated card nodes.
     */
    const titleSurfaces = [];
    for (
      let element = title;
      element && element !== card;
      element = element.parentElement
    ) {
      const isTitleElement = /^(?:HEADER|H[1-6])$/.test(element.tagName);
      const isDropdownSurface = [...element.classList]
        .some(token => token.includes('bg-token-dropdown-background'));
      if (
        layoutPresent(element) &&
        card.contains(element) &&
        (isTitleElement || isDropdownSurface)
      ) titleSurfaces.push(element);
    }
    [...new Set(titleSurfaces)]
      .forEach(surface => mark(surface, 'forge-right-title-surface'));

    const slottedRows = [...card.querySelectorAll(
      '[data-slot="thread-summary-panel-item"]'
    )].filter(layoutPresent);
    const fixtureRows = slottedRows.length
      ? []
      : [...card.querySelectorAll('.summary-row')].filter(layoutPresent);
    const rows = [...new Set([...slottedRows, ...fixtureRows])];
    rows.forEach(row => mark(row, 'forge-right-row'));

    /*
     * The packaged Section component intentionally has no data-slot. Its
     * source contract is nevertheless stable: a direct section root owns a
     * sticky h-7 dropdown-background header. Map that exact native topology
     * instead of guessing from localized labels or the current gray paint.
     */
    const sectionTokens = [
      'relative',
      'z-0',
      'flex',
      'flex-col',
      'pb-3'
    ];
    const sectionTitleTokens = [
      'sticky',
      'top-0',
      'z-10',
      'flex',
      'h-7',
      'w-full',
      'bg-token-dropdown-background',
      'ps-3.5',
      'pe-2.5',
      'text-token-text-tertiary'
    ];
    const sectionTitles = [...card.querySelectorAll('header')].filter(header => (
      layoutPresent(header) &&
      hasClassTokens(header, sectionTitleTokens) &&
      header.parentElement?.tagName === 'SECTION' &&
      layoutPresent(header.parentElement) &&
      hasClassTokens(header.parentElement, sectionTokens)
    ));
    const sections = [...new Set(sectionTitles.map(header => header.parentElement))];
    sections.forEach(section => mark(section, 'forge-right-section'));
    sectionTitles.forEach(sectionTitle => mark(sectionTitle, 'forge-right-section-title'));
    return [panel, card, title, ...titleSurfaces, ...sections, ...sectionTitles, ...rows];
  };
  const firstTextLeft = element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const value = node.nodeValue || '';
      const start = value.search(/\S/);
      if (start !== -1) {
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, Math.min(value.length, start + 1));
        const rect = range.getBoundingClientRect();
        range.detach?.();
        if (rect.width > 0 && rect.height > 0) return rect.left;
      }
      node = walker.nextNode();
    }
    return element.getBoundingClientRect().left;
  };
  const sidebarSelected = element => Boolean(
    element.matches?.(
      '[data-app-action-sidebar-thread-active="true"], ' +
      '[aria-current="page"], [aria-selected="true"]'
    ) ||
    element.querySelector?.(
      '[data-app-action-sidebar-thread-active="true"], ' +
      '[aria-current="page"], [aria-selected="true"]'
    )
  );
  const explicitProjectRow = element => Boolean(
    element.matches?.(
      '[data-app-action-sidebar-project-row], ' +
      '[data-project-row], [data-sidebar-project-row], [data-project-id], [data-project-key]'
    ) ||
    element.querySelector?.(
      '[data-app-action-sidebar-project-row], ' +
      '[data-project-row], [data-sidebar-project-row], [data-project-id], [data-project-key]'
    )
  );
  const explicitThreadRow = element => Boolean(
    element.matches?.(
      '[data-app-action-sidebar-thread-row], ' +
      '[data-sidebar-thread-row], [data-thread-id], [data-conversation-id], [data-task-id]'
    ) ||
    element.querySelector?.(
      '[data-app-action-sidebar-thread-row], ' +
      '[data-sidebar-thread-row], [data-thread-id], [data-conversation-id], [data-task-id]'
    )
  );
  const explicitRootThreadRow = element => Boolean(
    element.matches?.('[data-root-thread-row]') ||
    element.querySelector?.('[data-root-thread-row]')
  );
  const closestFromEither = (surface, source, selector) => (
    source.closest?.(selector) ||
    surface.closest?.(selector) ||
    null
  );
  const sidebarRowKind = (surface, source) => {
    if (explicitProjectRow(surface) || explicitProjectRow(source)) return 'project';

    const productionThread = (
      source.matches?.('[data-app-action-sidebar-thread-row]') ||
      surface.matches?.('[data-app-action-sidebar-thread-row]')
    );
    const productionProjectList = closestFromEither(
      surface,
      source,
      '[data-app-action-sidebar-project-list-id]'
    );
    if (productionThread && productionProjectList) return 'project-thread';
    const productionTaskSection = closestFromEither(
      surface,
      source,
      '[data-app-action-sidebar-section-heading="Tasks"]'
    );
    if (productionThread && productionTaskSection) return 'root-thread';

    if (explicitRootThreadRow(surface) || explicitRootThreadRow(source)) return 'root-thread';

    const treeItem = source.closest?.('[role="treeitem"]') ||
      surface.matches?.('[role="treeitem"]') && surface;
    const projectTree = source.closest?.(
      '[role="tree"], [data-sidebar-project-group], [data-project-group]'
    ) || surface.closest?.(
      '[role="tree"], [data-sidebar-project-group], [data-project-group]'
    );
    if (
      (explicitThreadRow(surface) || explicitThreadRow(source) || treeItem) &&
      projectTree
    ) return 'project-thread';
    if (explicitThreadRow(surface) || explicitThreadRow(source)) return 'root-thread';
    return 'action';
  };
  const floatingSidebarShellSelector = [
    'aside[data-testid="app-shell-floating-left-panel"]',
    '[data-testid="app-shell-floating-left-panel"] > aside',
    '[class~="fixed"][class~="left-0"] > aside:has(nav.sidebar-foreground-muted)'
  ].join(',');
  const sidebarShellSelector = [
    floatingSidebarShellSelector,
    'aside.app-shell-left-panel'
  ].join(',');
  const markSidebarSurfaces = () => {
    const sidebar = [...document.querySelectorAll(floatingSidebarShellSelector)].find(layoutPresent) ||
      [...document.querySelectorAll('aside.app-shell-left-panel')].find(layoutPresent);
    if (!sidebar) return [];
    mark(sidebar, 'forge-sidebar');
    mark(sidebar, 'forge-sidebar-shell');

    const scroll = sidebar.querySelector(
      '[data-app-action-sidebar-scroll], .vertical-scroll-fade-mask, [data-sidebar-scroll]'
    ) || sidebar;
    const sidebarRect = sidebar.getBoundingClientRect();
    const excludedHeader = [
      '[class~="group/projects-section-header"]',
      '[class~="group/chats-section-header"]',
      '[data-sidebar-section-header]'
    ].join(',');
    const excludedControl = [
      '[data-app-action-sidebar-section-toggle]',
      '[data-app-action-sidebar-project-show-all-toggle]',
      '[data-app-action-sidebar-select-project]'
    ].join(',');
    const candidates = [
      ...scroll.querySelectorAll([
        '[data-app-action-sidebar-project-row]',
        '[data-app-action-sidebar-thread-row]',
        '[data-project-row]',
        '[data-sidebar-project-row]',
        '[data-sidebar-thread-row]',
        '[data-root-thread-row]',
        '[data-thread-id]',
        '[data-conversation-id]',
        '[role="treeitem"]',
        'a[href]',
        'button',
        'button[aria-current]',
        'button[aria-selected]',
        'button[aria-expanded]'
      ].join(','))
    ];
    const bySurface = new Map();
    const productionRowSelector = [
      '[data-app-action-sidebar-project-row]',
      '[data-app-action-sidebar-thread-row]'
    ].join(',');
    for (const candidate of candidates) {
      if (
        !layoutPresent(candidate) ||
        candidate.closest(excludedHeader) ||
        candidate.closest(excludedControl)
      ) continue;
      const productionRow = candidate.matches(productionRowSelector);
      /*
       * Production project threads sit inside sortable/listitem animation
       * wrappers that are also role=button candidates. Painting those
       * wrappers duplicates the selected paper: a one-thread project can
       * temporarily expose a 40px animation box while a multi-thread project
       * exposes a 31px listitem. Only the explicit native row may own paint;
       * ignore both ancestors and descendants discovered by generic roles.
       */
      if (
        !productionRow &&
        (
          candidate.closest(productionRowSelector) ||
          candidate.querySelector(productionRowSelector)
        )
      ) continue;
      const surface = productionRow
        ? candidate
        : compactPaintSurface(candidate, scroll, sidebarRect.width * .48);
      if (
        !surface ||
        surface.closest(excludedHeader) ||
        surface.matches(excludedControl) ||
        !textOf(surface)
      ) continue;
      const rect = surface.getBoundingClientRect();
      if (
        rect.left < sidebarRect.left - 1 ||
        rect.right > sidebarRect.right + 1 ||
        rect.height < 20 ||
        rect.height > 56
      ) continue;
      const prior = bySurface.get(surface);
      const descriptor = {
        surface,
        source: candidate,
        left: firstTextLeft(candidate),
        selected: sidebarSelected(surface) || sidebarSelected(candidate),
        kind: sidebarRowKind(surface, candidate)
      };
      if (!prior) {
        bySurface.set(surface, descriptor);
      } else {
        const priority = {
          action: 0,
          'root-thread': 1,
          'project-thread': 2,
          project: 3
        };
        bySurface.set(surface, {
          ...prior,
          source: priority[descriptor.kind] > priority[prior.kind] ? descriptor.source : prior.source,
          left: Math.min(prior.left, descriptor.left),
          selected: prior.selected || descriptor.selected,
          kind: priority[descriptor.kind] > priority[prior.kind] ? descriptor.kind : prior.kind
        });
      }
    }
    const rows = [...bySurface.values()].sort((left, right) => (
      left.surface.compareDocumentPosition(right.surface) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    ));
    if (!rows.length) return [sidebar];
    for (const row of rows) {
      if (!row.selected) continue;
      if (row.kind === 'action') mark(row.surface, 'forge-sidebar-action-active');
      mark(row.surface, 'forge-sidebar-selected');
    }
    return [sidebar, scroll];
  };
  const refresh = () => {
    state.lastRefreshAt = performance.now();
    state.refreshCount += 1;
    document.getElementById('wukong-forge-pet-overlay')?.remove();
    document.getElementById('wukong-forge-motif-overlay')?.remove();

    const overlayWasReady = overlayReady();
    const workspace = findWorkspace();
    const { surface, landingTitle } = classifySurface(workspace);
    const routeHref = location.href;
    const surfaceChanged = state.lastSurface !== null && state.lastSurface !== surface;
    const routeChanged = state.lastRouteHref !== routeHref;
    if (surfaceChanged || routeChanged) state.manualBackgroundMode = null;
    state.lastSurface = surface;
    state.lastRouteHref = routeHref;
    state.automaticBackgroundMode = surface === 'landing' ? 'battle' : 'scenery';
    const mode = state.manualBackgroundMode || state.automaticBackgroundMode;
    root.dataset.forgeSurface = surface;
    root.dataset.forgeMode = mode;
    ensureBackground();
    const plannedMarks = new Map();
    pendingMarkPlan = plannedMarks;
    let topbarTargets;
    let composerTargets;
    let sidebarTargets;
    let rightPanelTargets;
    try {
      mark(workspace, 'forge-workspace');
      topbarTargets = markTopbarMenus();
      composerTargets = markComposerSurfaces();
      sidebarTargets = markSidebarSurfaces();
      rightPanelTargets = markRightPanelSurfaces();
      if (surface === 'landing') markLandingHero(workspace, landingTitle);
    } finally {
      pendingMarkPlan = null;
      reconcileMarks(plannedMarks);
    }

    const safeChoices = readSceneChoices(mode);
    ensureSceneSelection(mode, safeChoices);
    state.sceneKey = `${mode}|renderer`;
    const plannedScene = state.selectedScenes[mode];
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
      ...landingMountTargets
    ]);
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
    pendingBackgroundMode: null,
    pendingBackgroundDirection: 1,
    manualBackgroundMode: previous?.manualBackgroundMode === 'battle' || previous?.manualBackgroundMode === 'scenery'
      ? previous.manualBackgroundMode
      : null,
    automaticBackgroundMode: null,
    landingQuoteVisible: previousLandingQuoteVisible,
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
    toggleLandingQuote: null,
    dispose: null
  };
  root.dataset.forgeLandingQuoteVisible = state.landingQuoteVisible ? 'true' : 'false';
  const persistSceneState = () => writeSceneState(state);
  const stepBackground = (requestedMode, direction = 1) => {
    const mode = requestedMode === 'battle' || requestedMode === 'scenery'
      ? requestedMode
      : (
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
    root.dataset.forgeMode = mode;
    requestScene(state.selectedScenes[mode], mode);
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
  state.toggleLandingQuote = toggleLandingQuote;
  const scheduleRefresh = maximumDelay => {
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
      refresh();
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
    const composerSubmit = Boolean(target.closest('[data-thread-find-composer="true"], .composer-surface-chrome'));
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
    if (!target?.closest('[data-thread-find-composer="true"], .composer-surface-chrome')) return;
    queueRefreshes([320, 1100]);
  };
  const handleThemeKeyboardShortcut = event => {
    if (!event.ctrlKey || !event.altKey || event.shiftKey || event.metaKey) return;
    const key = String(event.key || '').toLowerCase();
    const toggleMode = key === 'c' || event.code === 'KeyC';
    const toggleQuote = key === 't' || event.code === 'KeyT';
    const direction = key === 'f' || event.code === 'KeyF'
      ? 1
      : (key === 'b' || event.code === 'KeyB' ? -1 : 0);
    if (!direction && !toggleMode && !toggleQuote) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (toggleQuote) toggleLandingQuote();
    else if (toggleMode) toggleBackgroundMode();
    else if (direction < 0) previousBackground();
    else nextBackground();
  };
  const routeEventName = 'wukong-forge-route-v13';
  const scheduleRouteRefresh = () => {
    queueRefreshes([160, 720]);
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
    if (node.id === 'wukong-forge-background') return true;
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
  const scheduleFirstPaintRefresh = () => {
    if (document.hidden) {
      state.hiddenDirty = true;
      return;
    }
    if (state.firstPaintRefreshQueued || state.disposed) return;
    state.firstPaintRefreshQueued = true;
    const enqueue = typeof queueMicrotask === 'function'
      ? queueMicrotask
      : callback => Promise.resolve().then(callback);
    enqueue(() => {
      state.firstPaintRefreshQueued = false;
      if (state.disposed) return;
      if (document.hidden) {
        state.hiddenDirty = true;
        return;
      }
      if (state.timer) clearTimeout(state.timer);
      state.timer = 0;
      state.timerDueAt = 0;
      refresh();
    });
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
      record.target?.id === 'wukong-forge-background' ||
      [...record.removedNodes].some(node => node.nodeType === Node.ELEMENT_NODE && node.id === 'wukong-forge-background')
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
      scheduleFirstPaintRefresh();
    } else if (composerSignalChanged || otherThemeStructureChanged) {
      scheduleRefresh(composerSignalChanged ? 140 : undefined);
    }
  });
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleRefresh) : null;
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
  state.resizeObserver = resizeObserver;
  state.dispose = () => {
    state.disposed = true;
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
    observer.disconnect();
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
    document.querySelectorAll('#wukong-forge-background > [data-forge-background-layer]').forEach(clearLayer);
    state.routeTimers.forEach(timer => clearTimeout(timer));
    state.routeTimers.clear();
    if (history.pushState === state.patchedPushState) history.pushState = originalPushState;
    if (history.replaceState === state.patchedReplaceState) history.replaceState = originalReplaceState;
    document.getElementById('wukong-forge-pet-overlay')?.remove();
    document.getElementById('wukong-forge-motif-overlay')?.remove();
    document.getElementById('wukong-forge-background')?.remove();
    delete root.dataset.forgeLandingQuoteVisible;
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
  const overlay = document.getElementById('wukong-forge-background');
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
      '[data-thread-find-composer="true"] .composer-surface-chrome'
    )
  ].filter(frame => (
    visible(frame) &&
    Boolean(frame.querySelector('.ProseMirror[role="textbox"]'))
  ));
  return {
    documentHidden: document.hidden,
    stylePresent: Boolean(document.getElementById('wukong-forge-style')),
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
    preloadInFlight: window.__wukongCodexForgeRuntimeV13?.preloadRequests?.size || 0,
    motifLayerPresent: Boolean(document.getElementById('wukong-forge-motif-overlay')),
    visibleNativeComposerCount: nativeComposerFrames.length,
    visibleThemedComposerCount: nativeComposerFrames.filter(
      frame => frame.classList.contains('forge-composer-frame')
    ).length,
    surface: document.documentElement.dataset.forgeSurface || null,
    mode: document.documentElement.dataset.forgeMode || null,
    scene: document.documentElement.dataset.forgeScene || null,
    landingQuoteVisible: document.documentElement.dataset.forgeLandingQuoteVisible === 'true',
    refreshCount: window.__wukongCodexForgeRuntimeV13?.refreshCount || 0,
    renderCount: window.__wukongCodexForgeRuntimeV13?.renderCount || 0,
    runtimeRevision: window.__wukongCodexForgeRuntimeV13?.revision || null,
    runtimeV4: Boolean(window.__wukongCodexForgeRuntimeV4),
    runtimeV5: Boolean(window.__wukongCodexForgeRuntimeV5),
    runtimeV6: Boolean(window.__wukongCodexForgeRuntimeV6),
    runtimeV7: Boolean(window.__wukongCodexForgeRuntimeV7),
    runtimeV8: Boolean(window.__wukongCodexForgeRuntimeV8),
    runtimeV9: Boolean(window.__wukongCodexForgeRuntimeV9),
    runtimeV10: Boolean(window.__wukongCodexForgeRuntimeV10),
    runtimeV11: Boolean(window.__wukongCodexForgeRuntimeV11),
    runtimeV12: Boolean(window.__wukongCodexForgeRuntimeV12),
    runtimeV13: Boolean(window.__wukongCodexForgeRuntimeV13)
  };
})()`;

export const ACTIVE_PROBE_EXPRESSION = `(() => {
  const overlay = document.getElementById('wukong-forge-background');
  const layers = overlay?.querySelectorAll(':scope > [data-forge-background-layer]') || [];
  const active = overlay?.querySelector('[data-forge-background-layer][data-forge-active="true"]');
  const image = active?.querySelector('[data-forge-background-image]');
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
      '[data-thread-find-composer="true"] .composer-surface-chrome'
    )
  ].filter(frame => (
    visible(frame) &&
    Boolean(frame.querySelector('.ProseMirror[role="textbox"]'))
  ));
  return Boolean(
    document.getElementById('wukong-forge-style') &&
    document.documentElement.classList.contains('forge-ink-mountain') &&
    window.__wukongCodexForgeRuntimeV13 &&
    document.documentElement.dataset.forgeBackgroundReady === 'true' &&
    overlay?.dataset.forgeReady === 'true' &&
    layers.length === 2 &&
    active &&
    image?.dataset.forgeBackgroundSource &&
    image.getAttribute('src') &&
    image.dataset.forgeDecoded === 'true' &&
    nativeComposerFrames.every(
      frame => frame.classList.contains('forge-composer-frame')
    )
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
    runtime?.resizeObserver?.disconnect();
    runtime?.dispose?.();
    if (runtime?.timer) clearTimeout(runtime.timer);
    delete window[runtimeKey];
  }
  document.getElementById('wukong-forge-style')?.remove();
  document.getElementById('wukong-forge-pet-overlay')?.remove();
  document.getElementById('wukong-forge-motif-overlay')?.remove();
  document.getElementById('wukong-forge-background')?.remove();
  document.querySelectorAll('[data-forge-mark]').forEach(element => {
    if (Object.hasOwn(element.dataset, 'forgeOriginalAriaLabel')) {
      const original = element.dataset.forgeOriginalAriaLabel;
      if (original === '__forge_absent__') element.removeAttribute('aria-label');
      else element.setAttribute('aria-label', original);
      delete element.dataset.forgeOriginalAriaLabel;
    }
    delete element.dataset.forgeTitleCopy;
    element.classList.remove(${MARK_CLASSES.map(name => `'${name}'`).join(',')});
    delete element.dataset.forgeMark;
  });
  document.documentElement.classList.remove('forge-ink-mountain');
  delete document.documentElement.dataset.forgeSurface;
  delete document.documentElement.dataset.forgeScene;
  delete document.documentElement.dataset.forgeMode;
  delete document.documentElement.dataset.forgeBackgroundReady;
  delete document.documentElement.dataset.forgeLandingQuoteVisible;
  delete document.documentElement.dataset.forgeWukongSafe;
  delete document.documentElement.dataset.forgeBajieSafe;
  delete document.documentElement.dataset.forgeGourdSafe;
  delete document.documentElement.dataset.forgeGourdPlacement;
  return true;
})()`;
