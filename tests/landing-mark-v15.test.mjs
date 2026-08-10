import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cssFor, validateTheme } from '../shared/theme-model.mjs';

const css = fs.readFileSync(
  new URL('../runtime/forge-background-v13.css', import.meta.url),
  'utf8'
);

const ruleMatch = css.match(
  /\[data-testid="home-icon"\]\[data-forge-mark="1"\]::before\s*\{([\s\S]*?)\n\}/
);

test('V16 landing mark paints the official Wukong wordmark at threefold scale without resizing its host', () => {
  assert.ok(ruleMatch, 'landing mark pseudo rule must exist');
  const rule = ruleMatch[1];
  assert.match(
    rule,
    /background-image:\s*var\(\s*--forge-landing-mark-active,[\s\S]*--forge-ui-landing-mark/
  );
  assert.doesNotMatch(rule, /animation|filter|will-change/i);
  assert.match(rule, /top:\s*50%/);
  assert.match(rule, /left:\s*50%/);
  assert.match(rule, /width:\s*168px/);
  assert.match(rule, /height:\s*168px/);
  assert.match(rule, /transform:\s*translate\(-50%,\s*-50%\)/);
  assert.match(rule, /background-size:\s*contain/);
  assert.match(rule, /pointer-events:\s*none/);
  assert.doesNotMatch(rule, /(?:^|[;\s])(?:margin|padding|filter|scale)\s*:/);

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

  assert.doesNotMatch(css, /data-forge-scene="(?:4|8)"[\s\S]*landing-mark-dark/);
  const sceneVariables = cssFor(
    activeTheme,
    activeTheme.background.gallery.map((scene, index) => ({
      ...scene,
      url: `data:image/jpeg;base64,${Buffer.from(String(index)).toString('base64')}`
    })),
    {},
    {}
  );
  for (const slot of ['B07', 'B08']) {
    const index = activeTheme.background.gallery.findIndex(scene => scene.slot === slot);
    assert.match(
      sceneVariables,
      new RegExp(`data-forge-scene="${index}"[^}]*--forge-landing-mark-active:var\\(--forge-ui-landing-mark-dark\\)`)
    );
  }
  const firstSceneRule = sceneVariables.match(/data-forge-scene="0"\]\{([^}]*)\}/)?.[1] || '';
  assert.match(firstSceneRule, /--forge-landing-mark-active:var\(--forge-ui-landing-mark\)/);
  assert.doesNotMatch(firstSceneRule, /landing-mark-dark/);

  const legacyTheme = structuredClone(activeTheme);
  delete legacyTheme.uiAssets.landingMarkDark;
  assert.doesNotThrow(
    () => validateTheme(legacyTheme),
    'schema v3 themes with the original UI asset set must remain valid'
  );
});

test('V16 landing title is optically reduced without changing native geometry', () => {
  const titleRule = css.match(
    /\[data-forge-title-copy\]::after\s*\{([\s\S]*?)\n\}/
  );
  assert.ok(titleRule, 'landing title pseudo rule must exist');
  assert.match(titleRule[1], /inset:\s*-2px 0 2px/);
  assert.match(titleRule[1], /font-size:\s*\.9em/);
  assert.match(titleRule[1], /letter-spacing:\s*\.035em/);
  assert.doesNotMatch(titleRule[1], /(?:^|[;\s])(?:width|height|margin|padding)\s*:/);
});
