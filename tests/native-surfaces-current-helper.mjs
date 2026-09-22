import assert from 'node:assert/strict';

// Snapshot native behaviour, not a theme-specific class or obsolete paper fill.
export const snapshotNativeControls = page => page.locator('[data-native-slot], [role="textbox"], [data-slot="thread-summary-panel-item"]').evaluateAll(nodes => nodes.map(e => {
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  return {slot:e.getAttribute('data-native-slot'), role:e.getAttribute('role'),
    rect:[r.x,r.y,r.width,r.height], radius:s.borderRadius, corner:s.cornerShape,
    color:s.color, opacity:s.opacity, pointer:s.pointerEvents,
    disabled:e.hasAttribute('disabled'), ariaDisabled:e.getAttribute('aria-disabled'),
    tabIndex:e.tabIndex, editable:e.getAttribute('contenteditable')};
}));

export const assertNativeControls = (actual, expected) => assert.deepEqual(actual, expected);
