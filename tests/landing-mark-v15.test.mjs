import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANDING_HERO_PROFILES, cssFor, validateTheme } from '../shared/theme-model.mjs';

const css = fs.readFileSync(
  new URL('../runtime/wukong-codex-theme-background-v13.css', import.meta.url),
  'utf8'
);

const ruleMatch = [
  ...css.matchAll(
    /\[data-testid="home-icon"\]\[data-forge-mark="1"\]::before\s*\{([\s\S]*?)\n\}/g
  )
].find(([, rule]) => /background-image:\s*var\(/.test(rule));

test('V16 landing mark paints the official Wukong wordmark at threefold scale without resizing its host', () => {
  assert.ok(ruleMatch, 'landing mark pseudo rule must exist');
  const rule = ruleMatch[1];
  assert.match(
    rule,
    /background-image:\s*var\(\s*--forge-landing-mark-active,[\s\S]*--forge-ui-landing-mark/
  );
  assert.doesNotMatch(rule, /animation|will-change/i);
  assert.match(rule, /top:\s*50%/);
  assert.match(rule, /left:\s*50%/);
  assert.match(rule, /width:\s*168px/);
  assert.match(rule, /height:\s*168px/);
  assert.match(rule, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(rule, /background-size:\s*contain/);
  assert.match(rule, /opacity:\s*var\(--forge-landing-mark-opacity,\s*1\)/);
  assert.match(rule, /filter:\s*var\(--forge-landing-mark-filter,\s*none\)/);
  assert.match(rule, /mix-blend-mode:\s*normal/);
  assert.match(rule, /pointer-events:\s*none/);
  assert.doesNotMatch(rule, /(?:^|[;\s])(?:margin|padding|scale)\s*:/);

  const hostRule = css.match(
    /\[data-testid="home-icon"\]\[data-forge-mark="1"\]\s*\{([\s\S]*?)\n\}/
  );
  assert.ok(hostRule, 'landing mark host rule must exist');
  assert.match(hostRule[1], /overflow:\s*visible/);
  assert.doesNotMatch(
    hostRule[1],
    /(?:^|[;\s])(?:width|height|margin|padding|transform|scale)\s*:/
  );

  const activeTheme = JSON.parse(
    fs.readFileSync(new URL('../themes/active.json', import.meta.url), 'utf8')
  );
  assert.equal(
    activeTheme.uiAssets.landingMark,
    'ui/v16/landing-wukong-wordmark-light.webp'
  );
  assert.equal(
    activeTheme.uiAssets.landingMarkDark,
    'ui/v16/landing-wukong-wordmark-dark.webp'
  );
  for (const relativePath of Object.values({
    light: activeTheme.uiAssets.landingMark,
    dark: activeTheme.uiAssets.landingMarkDark
  })) {
    const asset = fs.readFileSync(new URL(`../themes/${relativePath}`, import.meta.url));
    assert.equal(asset.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.ok(asset.byteLength < 40960, `${relativePath} should stay under 40 KiB`);
  }

  const sceneVariables = cssFor(
    activeTheme,
    activeTheme.background.gallery.map((scene, index) => ({
      ...scene,
      url: `data:image/jpeg;base64,${Buffer.from(String(index)).toString('base64')}`
    })),
    {},
    {}
  );
  for (const slot of ['B01', 'B05', 'B06', 'B07', 'B08', 'B11', 'S04', 'S05', 'S08']) {
    const index = activeTheme.background.gallery.findIndex(scene => scene.slot === slot);
    assert.match(
      sceneVariables,
      new RegExp(`data-forge-scene="${index}"[^}]*--forge-landing-mark-active:var\\(--forge-ui-landing-mark-dark\\)`)
    );
  }
  const firstSceneRule = sceneVariables.match(/data-forge-scene="0"\]\{([^}]*)\}/)?.[1] || '';
  assert.match(firstSceneRule, /--forge-landing-mark-active:var\(--forge-ui-landing-mark-dark\)/);

  for (const scene of activeTheme.background.gallery) {
    const index = activeTheme.background.gallery.indexOf(scene);
    const ruleForScene = sceneVariables.match(
      new RegExp(`data-forge-scene="${index}"\\]\\{([^}]*)\\}`)
    )?.[1] || '';
    const profile = LANDING_HERO_PROFILES[scene.heroProfile];
    assert.match(ruleForScene, new RegExp(`--forge-landing-hero-profile:${scene.heroProfile}`));
    assert.match(ruleForScene, new RegExp(`--forge-landing-mark-opacity:${profile.markOpacity}`));
    assert.ok(
      ruleForScene.includes(`--forge-landing-mark-filter:${profile.markFilter}`),
      `${scene.slot} should emit the reviewed ${scene.heroProfile} mark filter`
    );
    assert.match(ruleForScene, new RegExp(`--forge-landing-quote-color:${profile.quoteColor}`));
    assert.match(ruleForScene, new RegExp(`--forge-landing-quote-opacity:${profile.quoteOpacity}`));
  }

  const legacyTheme = structuredClone(activeTheme);
  delete legacyTheme.uiAssets.landingMarkDark;
  assert.doesNotThrow(
    () => validateTheme(legacyTheme),
    'schema v3 themes with the original UI asset set must remain valid'
  );
});

test('V61 landing mark profiles visibly separate every wordmark without uniform glow', () => {
  const flatLight = LANDING_HERO_PROFILES['ink-on-light-flat'];
  const complexLight = LANDING_HERO_PROFILES['ink-on-light-complex'];
  const flatDark = LANDING_HERO_PROFILES['bone-on-dark-flat'];
  const complexDark = LANDING_HERO_PROFILES['bone-on-dark-complex'];

  for (const profile of Object.values(LANDING_HERO_PROFILES)) {
    assert.equal(profile.markOpacity, 1);
    assert.match(profile.markFilter, /brightness\(/);
    assert.match(profile.markFilter, /saturate\(/);
    assert.match(profile.markFilter, /contrast\(/);
    assert.doesNotMatch(profile.markFilter, /blur\(|url\(|drop-shadow\([^)]*(?:4px|5px|6px)/);
  }
  assert.ok(complexLight.markFilter.length > flatLight.markFilter.length);
  assert.ok(complexDark.markFilter.length > flatDark.markFilter.length);
  assert.match(flatLight.markFilter, /brightness\(\.68\)/);
  assert.match(complexLight.markFilter, /brightness\(\.56\)/);
  assert.match(flatDark.markFilter, /brightness\(1\.48\)/);
  assert.match(complexDark.markFilter, /brightness\(1\.62\)/);
  assert.equal((complexLight.markFilter.match(/drop-shadow\(/g) || []).length, 4);
  assert.equal((complexDark.markFilter.match(/drop-shadow\(/g) || []).length, 4);
});

test('V16 landing title is optically reduced without changing native geometry', () => {
  const titleRule = css.match(
    /\[data-forge-title-copy\]::after\s*\{([\s\S]*?)\n\}/
  );
  assert.ok(titleRule, 'landing title pseudo rule must exist');
  assert.match(titleRule[1], /inset:\s*-2px 0 2px/);
  assert.match(titleRule[1], /font-size:\s*\.9em/);
  assert.match(titleRule[1], /letter-spacing:\s*\.035em/);
  assert.match(titleRule[1], /color:\s*var\(--forge-landing-quote-color/);
  assert.match(titleRule[1], /opacity:\s*var\(--forge-landing-quote-opacity/);
  assert.match(titleRule[1], /text-shadow:\s*var\(/);
  assert.doesNotMatch(titleRule[1], /18px/);
  assert.doesNotMatch(titleRule[1], /(?:^|[;\s])(?:width|height|margin|padding)\s*:/);
});
