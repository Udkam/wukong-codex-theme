import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { payloadFromThemeFile } from '../runtime/forge-runtime.mjs';
import {
  applyNativeTheme,
  loadThemeDefinition,
  restoreNativeTheme,
  upgradeNativeTheme
} from '../scripts/native-theme.mjs';

const definition = loadThemeDefinition('themes/native-wukong.json');
const activeThemePath = 'themes/active.json';
const activeTheme = JSON.parse(fs.readFileSync(activeThemePath, 'utf8').replace(/^\uFEFF/, ''));

test('active page payload contains backgrounds and paint-only UI assets; pets remain native packages', () => {
  assert.equal('motifs' in activeTheme, false);
  assert.equal(activeTheme.companion.enabled, false);
  const payload = payloadFromThemeFile(activeThemePath);
  assert.deepEqual(payload.motifs, {});
  assert.deepEqual(Object.keys(payload.uiAssets), Object.keys(activeTheme.uiAssets));
  assert.match(payload.variables, /--forge-ui-composer-main:url\("data:image\/webp;base64,/);
  assert.match(payload.variables, /--forge-ui-sidebar-selected:url\("data:image\/webp;base64,/);
  assert.match(payload.variables, /--forge-ui-landing-mark:url\("data:image\/webp;base64,/);
  assert.match(payload.variables, /--forge-ui-landing-mark-dark:url\("data:image\/webp;base64,/);
  assert.match(payload.variables, /--forge-motif-xiangfei-gourd:none/);
  assert.doesNotMatch(payload.variables, /--forge-motif-little-(?:wukong|bajie):/);
  assert.doesNotMatch(payload.variables, /forge-motif-(?:yaksha|fanged-cyan)/);
  assert.match(payload.variables, /--forge-battle-scenes:11 0 1 2 3 9 12 13 10 18 19 20 21/);
  assert.match(payload.variables, /--forge-scenery-scenes:8 7 16 4 5 6 14 15 17/);
  assert.doesNotMatch(payload.variables, /--forge-primary-scene-count:/);

  const modes = activeTheme.background.gallery.map(scene => scene.mode);
  assert.ok(modes.includes('battle-primary'));
  assert.ok(modes.includes('battle-secondary'));
  assert.ok(modes.includes('scenery'));
  assert.equal(activeTheme.schemaVersion, 3);
  assert.equal(activeTheme.background.gallery.length, 22);
  assert.deepEqual(
    activeTheme.background.gallery.filter(scene => scene.mode.startsWith('battle')).sort((a, b) => a.order - b.order).map(scene => scene.slot),
    ['B07', 'B01', 'B02', 'B03', 'B04', 'B05', 'B08', 'B09', 'B06', 'B10', 'B11', 'B12', 'B13']
  );
  assert.deepEqual(
    activeTheme.background.gallery.filter(scene => scene.mode === 'scenery').sort((a, b) => a.order - b.order).map(scene => scene.slot),
    ['S05', 'S04', 'S08', 'S01', 'S02', 'S03', 'S06', 'S07', 'S09']
  );
});

test('native definition stays within the current Codex chrome theme schema', () => {
  const identities = definition.settings.map(setting => `${setting.section}.${setting.key}`);
  assert.deepEqual(definition.unsupportedByNativeLoader, ['backgroundImage', 'companion', 'customCss']);
  assert.ok(identities.includes('desktop.appearanceTheme'));
  assert.ok(identities.includes('desktop.appearanceDarkChromeTheme.accent'));
  assert.ok(identities.includes('desktop.appearanceDarkChromeTheme.semanticColors.skill'));
  assert.equal(fs.statSync('themes/backgrounds/battle-02.jpg').size < 400_000, true);
});

test('install and uninstall round-trip only managed native appearance values', () => {
  const original = [
    'model = "gpt-5.6-sol"',
    '',
    '[desktop]',
    'localeOverride = "zh-CN"',
    'appearanceTheme = "system" # keep user preference',
    'appearanceLightCodeThemeId = "vscode-plus"',
    '',
    '[desktop.appearanceLightChromeTheme]',
    'accent = "#007acc"',
    'contrast = 60',
    'ink = "#d4d4d4"',
    'opaqueWindows = false',
    'surface = "#1e1e1e"',
    '',
    '[desktop.appearanceLightChromeTheme.semanticColors]',
    'diffAdded = "#369432"',
    'diffRemoved = "#f44747"',
    'skill = "#000080"',
    '',
    '[features]',
    'memories = true',
    ''
  ].join('\r\n');
  const applied = applyNativeTheme(original, definition.settings);
  assert.match(applied.text, /appearanceTheme = "dark"/);
  assert.match(applied.text, /accent = "#a88755"/);
  assert.match(applied.text, /ui = "\\"Microsoft YaHei UI\\""/);
  assert.match(applied.text, /\[features\]\r\nmemories = true/);

  const restored = restoreNativeTheme(applied.text, applied.state);
  assert.deepEqual(restored.warnings, []);
  assert.equal(restored.text, original);
});

test('uninstall preserves a managed value changed by the user after install', () => {
  const original = '[desktop]\nappearanceTheme = "system"\n';
  const applied = applyNativeTheme(original, definition.settings);
  const userChanged = applied.text.replace('accent = "#a88755"', 'accent = "#ff00aa"');
  const restored = restoreNativeTheme(userChanged, applied.state);
  assert.match(restored.text, /accent = "#ff00aa"/);
  assert.ok(restored.warnings.some(warning => warning.includes('appearanceDarkChromeTheme.accent')));
  assert.match(restored.text, /appearanceTheme = "system"/);
});

test('upgrade replaces an older managed theme while preserving the pre-theme baseline', () => {
  const original = [
    '[desktop]',
    'appearanceTheme = "system"',
    'appearanceLightCodeThemeId = "vscode-plus"',
    '',
    '[desktop.appearanceLightChromeTheme]',
    'accent = "#007acc"',
    'surface = "#ffffff"',
    ''
  ].join('\n');
  const legacy = [
    { section: 'desktop', key: 'appearanceTheme', value: 'dark' },
    { section: 'desktop.appearanceLightChromeTheme', key: 'accent', value: '#d6a85f' }
  ];
  const oldApplied = applyNativeTheme(original, legacy);
  const upgraded = upgradeNativeTheme(oldApplied.text, oldApplied.state, definition.settings);
  assert.deepEqual(upgraded.warnings, []);
  assert.match(upgraded.text, /appearanceTheme = "dark"/);
  assert.match(upgraded.text, /accent = "#a88755"/);
  const restored = restoreNativeTheme(upgraded.text, upgraded.state);
  assert.deepEqual(restored.warnings, []);
  assert.equal(restored.text, original);
});
