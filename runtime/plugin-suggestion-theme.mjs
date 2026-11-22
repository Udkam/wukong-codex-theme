// The first-party suggest_plugins widget renders inside a same-origin iframe
// in an Electron webview. Its styles have a separate document boundary.
export function createPluginSuggestionTheme(document) {
  const view = document.defaultView;
  const selector = '[data-mcp-app-frame="true"] webview[title="Codex Apps MCP suggest_plugins"]';
  const origin = 'https://connector-id-34b79eb8c16f076166e29359db7191ef.web-sandbox.oaiusercontent.com';
  const entries = new Map();
  const owner = Array.from(view.crypto.getRandomValues(new Uint32Array(4))).join('-');
  let disposed = false;

  function updateGuest(owner, css) {
    const key = '__wukongPluginSuggestionTheme';
    const previous = window[key];
    if (css === null) {
      if (previous?.owner === owner) previous.dispose();
      return;
    }
    if (previous?.owner === owner) {
      previous.update(css);
      return;
    }
    previous?.dispose();
    const styles = new Set();
    const frames = new Map();
    let active = true;
    let current = css;
    const paint = target => {
      if (!active || !target?.head) return;
      styles.forEach(style => { if (!style.isConnected) styles.delete(style); });
      let style = target.getElementById('wukong-plugin-suggestion-style');
      if (!style) {
        style = target.createElement('style');
        style.id = 'wukong-plugin-suggestion-style';
        target.head.append(style);
      }
      if (style.textContent !== current) style.textContent = current;
      styles.add(style);
    };
    const refresh = () => {
      paint(document);
      const frame = document.querySelector('iframe#root');
      for (const [old, listener] of frames) {
        if (old === frame) continue;
        old.removeEventListener('load', listener);
        frames.delete(old);
      }
      if (!frame) return;
      if (!frames.has(frame)) {
        const onLoad = () => {
          try { paint(frame.contentDocument); } catch {}
        };
        frame.addEventListener('load', onLoad);
        frames.set(frame, onLoad);
      }
      try { paint(frame.contentDocument); } catch {}
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => [...record.addedNodes, ...record.removedNodes]
        .some(node => node.nodeType === 1 && (node.matches('iframe#root') || node.querySelector('iframe#root'))))) refresh();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window[key] = {
      owner,
      update(css) { current = css; refresh(); },
      dispose() {
        active = false;
        observer.disconnect();
        frames.forEach((listener, frame) => frame.removeEventListener('load', listener));
        frames.clear();
        styles.forEach(style => style.remove());
        styles.clear();
        if (window[key]?.owner === owner) delete window[key];
      }
    };
    refresh();
  }

  const matches = element => {
    if (!element.matches(selector) || typeof element.executeJavaScript !== 'function') return false;
    try { return new URL(element.getAttribute('src')).origin === origin; }
    catch { return false; }
  };
  const styleForTheme = () => {
    const root = document.documentElement;
    if (!root.classList.contains('forge-ink-mountain') || root.dataset.forgePresentation === 'native-full-view') return null;
    const style = view.getComputedStyle(root);
    const value = property => style.getPropertyValue(property).trim();
    const light = root.dataset.forgeNativeTheme === 'light';
    return `
html, body { background: transparent !important; }
[class^="_Root_"] {
  --request-surface: ${value('--forge-glass-fill')} !important;
  --request-border: ${value('--forge-glass-edge')} !important;
  --request-divider: ${value('--forge-glass-edge')} !important;
  --request-secondary-border: ${value('--forge-glass-edge')} !important;
  --request-text: ${value('--forge-nav-ink')} !important;
  --request-secondary: ${value('--forge-nav-muted')} !important;
  --request-primary: ${light ? '#314d63' : '#dbe8f3'} !important;
  --request-primary-hover: ${light ? '#253e52' : '#f0f6fb'} !important;
  --request-primary-text: ${light ? '#f8fbfd' : '#192b38'} !important;
  --request-secondary-hover: ${value('--forge-nav-row-hover')} !important;
}
[class^="_Shell_"], [class^="_Root_"] { background: transparent !important; }
[class^="_Heading_"] { color: ${value('--forge-nav-muted')} !important; }
[class^="_Card_"], [class^="_GroupCard_"] {
  background-color: var(--request-surface) !important;
  background-image: ${value('--forge-glass-highlight')} !important;
  box-shadow: inset 0 0 0 1px var(--request-border), inset 0 1px 0 rgba(255,255,255,.1) !important;
}
[class^="_GroupCard_"] [class^="_Card_"] {
  background: transparent !important;
  box-shadow: none !important;
}
[class^="_IconFrame_"] {
  background: #f1f5f8 !important;
}
[class^="_IconFrame_"] [class^="_IconFallback_"] { color: #314d63 !important; }
@media (prefers-reduced-transparency: reduce) {
  [class^="_Root_"] { --request-surface: ${light ? '#f7f9fb' : '#26323e'} !important; }
}
@media (forced-colors: active) {
  [class^="_Root_"] {
    --request-surface: Canvas !important;
    --request-border: CanvasText !important;
    --request-divider: CanvasText !important;
    --request-secondary-border: ButtonText !important;
    --request-text: CanvasText !important;
    --request-secondary: CanvasText !important;
    --request-primary: ButtonFace !important;
    --request-primary-hover: Highlight !important;
    --request-primary-text: ButtonText !important;
  }
  [class^="_Heading_"] { color: CanvasText !important; }
  [class^="_Card_"], [class^="_GroupCard_"] { background-image: none !important; }
  [class^="_IconFrame_"] { background: Canvas !important; }
  [class^="_IconFrame_"] [class^="_IconFallback_"] { color: CanvasText !important; }
}
`;
  };
  const send = (entry, css) => {
    entry.pending = entry.pending.then(async () => {
      if (css !== null && (disposed || !matches(entry.element))) return;
      try {
        await entry.element.executeJavaScript(`(${updateGuest.toString()})(${JSON.stringify(owner)},${JSON.stringify(css)})`);
        entry.error = null;
      } catch (error) {
        entry.signature = undefined;
        entry.error = String(error?.message || error);
      }
    });
    return entry.pending;
  };
  const detach = entry => {
    entry.element.removeEventListener('dom-ready', entry.onReady);
    entries.delete(entry.element);
    return send(entry, null);
  };
  const refresh = () => {
    if (disposed) return;
    const css = styleForTheme();
    for (const entry of entries.values()) {
      if (!entry.element.isConnected || !matches(entry.element)) detach(entry);
    }
    for (const element of document.querySelectorAll(selector)) {
      if (!matches(element)) continue;
      let entry = entries.get(element);
      if (!entry) {
        entry = { element, signature: undefined, pending: Promise.resolve(), error: null };
        entry.onReady = () => {
          entry.signature = undefined;
          refresh();
        };
        entries.set(element, entry);
        element.addEventListener('dom-ready', entry.onReady);
      }
      if (entry.signature === css) continue;
      entry.signature = css;
      send(entry, css);
    }
  };
  const observer = new view.MutationObserver(records => {
    const relevant = records.some(record => {
      if (record.type === 'attributes') return record.target === document.documentElement || record.target.matches?.('webview');
      return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
        (node.matches('webview, [data-mcp-app-frame]') || node.querySelector('webview')));
    });
    if (relevant) refresh();
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['src', 'title', 'class', 'data-forge-native-theme', 'data-forge-presentation']
  });
  refresh();
  return {
    refresh,
    settled: () => Promise.all([...entries.values()].map(entry => entry.pending)),
    status: () => ({ guests: entries.size, errors: [...entries.values()].filter(entry => entry.error).length }),
    dispose() {
      disposed = true;
      observer.disconnect();
      return Promise.all([...entries.values()].map(detach));
    }
  };
}
