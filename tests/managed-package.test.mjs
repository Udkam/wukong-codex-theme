import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { packageRuntime } from '../scripts/package-runtime.mjs';

test('minimal managed package imports independently and omits development surfaces', async t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wukong-runtime-'));
  t.diagnostic(`retained package proof: ${temp}`);
  const target = path.join(temp, 'app');
  packageRuntime({ source: process.cwd(), destination: target });
  const sourceTheme = JSON.parse(fs.readFileSync('themes/active.json', 'utf8'));

  for (const omitted of ['.git', 'docs', 'studio', 'tests', 'node_modules']) {
    assert.equal(fs.existsSync(path.join(target, omitted)), false, `development-only path copied: ${omitted}`);
  }
  for (const required of [
    'runtime/forge-background-v13.css',
    'runtime/injection-plan-v13.mjs',
    'runtime/host.mjs',
    'runtime/activate-appx.cs',
    'runtime/activate-appx.ps1',
    'runtime/native-entry-supervisor.cs',
    'runtime/watch.mjs',
    'scripts/launch.ps1',
    'scripts/start.ps1',
    'scripts/install-native-pets.ps1',
    'scripts/install-chatgpt-hook.ps1',
    'scripts/install-native-supervisor.ps1',
    'scripts/prepare-background.ps1',
    'scripts/manage-backgrounds.ps1',
    'scripts/verify-launch-adapter.ps1',
    'scripts/disable.ps1',
    'backgrounds.cmd',
    'start-theme.cmd',
    'stop-theme.cmd',
    'remove-theme.cmd',
    'PORTABLE-README.txt',
    'pets/release-policy.json',
    'themes/active.json',
    'themes/native-wukong.json',
    ...sourceTheme.background.gallery.map(entry => `themes/${entry.asset}`),
    ...Object.values(sourceTheme.motifs || {}).map(asset => `themes/${asset}`),
    ...Object.values(sourceTheme.uiAssets || {}).map(asset => `themes/${asset}`)
  ]) {
    assert.equal(fs.existsSync(path.join(target, required)), true, `managed file missing: ${required}`);
  }
  const prepareBackground = fs.readFileSync(
    path.join(target, 'scripts', 'prepare-background.ps1'),
    'utf8'
  );
  const manageBackgrounds = fs.readFileSync(
    path.join(target, 'scripts', 'manage-backgrounds.ps1'),
    'utf8'
  );
  assert.match(manageBackgrounds, /ValidateSet\('list', 'add', 'replace', 'move', 'remove'\)/);
  assert.match(manageBackgrounds, /Join-Path \$resolvedRoot '\.wukong-runtime'/);
  assert.match(manageBackgrounds, /Join-Path \$runtimeRoot 'background-backups'/);
  assert.match(manageBackgrounds, /\[IO\.File\]::Replace\(/);
  assert.doesNotMatch(manageBackgrounds, /Get-CimInstance|Get-WmiObject|Win32_Process|Stop-Process|taskkill/i);
  const slotPatternText = prepareBackground.match(/\[ValidatePattern\('([^']+)'\)\]/)?.[1];
  assert.ok(slotPatternText, 'background slot validation pattern missing');
  const slotPattern = new RegExp(slotPatternText);
  for (const slot of ['B01', 'S09', 'B10', 'S10', 'B99', 'S99']) {
    assert.match(slot, slotPattern, `supported background slot rejected: ${slot}`);
  }
  for (const slot of ['B00', 'S00', 'B100', 'A10']) {
    assert.doesNotMatch(slot, slotPattern, `invalid background slot accepted: ${slot}`);
  }
  assert.match(prepareBackground, /\$number = \[int\]\$Slot\.Substring\(1\)/);
  assert.match(prepareBackground, /'\{0\}-\{1:D2\}\.jpg' -f \$group, \$number/);
  for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
    assert.match(
      prepareBackground,
      new RegExp(String.raw`\[ValidateRange\(0, 8192\)\]\s+\[int\]\$Crop${side} = 0`),
      `Crop${side} parameter contract missing`
    );
    assert.match(
      prepareBackground,
      new RegExp(String.raw`\bCrop${side} = \$Crop${side}\b`),
      `Crop${side} result contract missing`
    );
  }
  assert.match(prepareBackground, /\$cropWidth = \$source\.Width - \$CropLeft - \$CropRight/);
  assert.match(prepareBackground, /\$cropHeight = \$source\.Height - \$CropTop - \$CropBottom/);
  assert.match(prepareBackground, /if \(\$cropWidth -le 0 -or \$cropHeight -le 0\)/);
  assert.match(
    prepareBackground,
    /\$graphics\.DrawImage\([\s\S]*?\$CropLeft,\s*\$CropTop,\s*\$cropWidth,\s*\$cropHeight,\s*\[System\.Drawing\.GraphicsUnit\]::Pixel/
  );
  assert.equal(
    fs.existsSync(path.join(target, 'themes', 'ink-mountain.json')),
    false,
    'legacy theme manifest with retired motifs was packaged'
  );
  const packagedPetPolicy = JSON.parse(fs.readFileSync(path.join(target, 'pets', 'release-policy.json'), 'utf8'));
  assert.deepEqual(packagedPetPolicy.releasedPetIds, []);
  assert.deepEqual(packagedPetPolicy.pendingPetIds, [
    'little-bajie-v4-inart-game-motion',
    'little-wukong-v5-yaksha-shenfeng'
  ]);
  assert.deepEqual(packagedPetPolicy.frozenPetIds, [
    'little-bajie-v3-inart',
    'little-wukong-yaksha-shenfeng'
  ]);
  assert.deepEqual(fs.readdirSync(path.join(target, 'pets')).sort(), ['release-policy.json']);
  for (const frozenPetFile of [
    'pets/little-bajie-v3-inart/pet.json',
    'pets/little-bajie-v3-inart/spritesheet.webp',
    'pets/little-bajie-v3-inart/validation.json',
    'pets/little-bajie-v3-inart/package-proof.json',
    'pets/little-wukong-yaksha-shenfeng/pet.json',
    'pets/little-wukong-yaksha-shenfeng/spritesheet.webp',
    'pets/little-wukong-yaksha-shenfeng/validation.json',
    'pets/little-wukong-yaksha-shenfeng/package-proof.json'
  ]) {
    assert.equal(fs.existsSync(path.join(target, frozenPetFile)), false, `unapproved pet file packaged: ${frozenPetFile}`);
  }
  assert.equal(fs.existsSync(path.join(target, 'node_modules', 'ws')), false, 'ws runtime dependency was packaged');
  assert.equal(fs.existsSync(path.join(target, 'runtime', 'ws-client.mjs')), false, 'superseded ws bundle was packaged');
  assert.equal(fs.existsSync(path.join(target, 'runtime', 'ws-client-node.mjs')), false, 'diagnostic ws bundle was packaged');
  const packagedManifest = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
  assert.equal(packagedManifest.version, '0.14.7');
  assert.deepEqual(packagedManifest.dependencies, {});
  for (const rejected of [
    'themes/assets/erlang-meishan.jpg',
    'themes/assets/yaksha-king.jpg',
    'themes/assets/yaksha-king-rift.jpg',
    'themes/assets/destined-afterimage.jpg',
    'themes/motifs/yaksha-plate.svg',
    'themes/motifs/shenfeng-profile.svg',
    'themes/motifs/yaksha-set.png',
    'themes/motifs/fanged-cyan-staff.png',
    'themes/motifs/little-wukong.webp',
    'themes/motifs/little-bajie.webp',
    'themes/motifs/little-wukong-v2.png',
    'themes/motifs/little-bajie-v2.png',
    'themes/motifs/little-wukong-gameplay-v6.png',
    'themes/motifs/little-bajie-gameplay-v6.png',
    'themes/motifs/pets/little-wukong-pet-v1.png',
    'themes/motifs/pets/little-bajie-pet-v1.png',
    'themes/motifs/pets/little-wukong-pet-v1-chroma.png',
    'themes/motifs/pets/little-bajie-pet-v1-chroma.png',
    'themes/motifs/xiangfei-gourd.png',
    'themes/motifs/xiangfei-gourd.webp',
    'themes/motifs/xiangfei-gourd-icon.webp'
  ]) assert.equal(fs.existsSync(path.join(target, rejected)), false, `rejected asset packaged: ${rejected}`);
  assert.equal(fs.existsSync(path.join(target, 'runtime', 'capture-live.mjs')), false);
  const portableReadme = fs.readFileSync(path.join(target, 'PORTABLE-README.txt'), 'utf8');
  assert.match(portableReadme, /CURRENT V52\.1 ORDERED 22-BACKGROUND GALLERY/);
  assert.match(portableReadme, /22-image gallery \(13 battle \+ 9 scenery\) in two explicit playback sequences/);
  assert.match(portableReadme, /B07 -> B01 -> B02 -> B03 -> B04 -> B05 -> B08 -> B09 -> B06 -> B10 -> B11 -> B12 -> B13/);
  assert.match(portableReadme, /S05 -> S04 -> S08 -> S01 -> S02 -> S03 -> S06 -> S07 -> S09/);
  assert.match(portableReadme, /20-minute cooldown/);
  assert.match(portableReadme, /Ctrl\+Alt\+F/);
  assert.match(portableReadme, /Ctrl\+Alt\+B/);
  assert.match(portableReadme, /Ctrl\+Alt\+C/);
  assert.doesNotMatch(portableReadme, /Ctrl\+Alt\+Shift\+B/);
  assert.match(portableReadme, /Run backgrounds\.cmd without arguments for the interactive manager/);
  assert.match(portableReadme, /Move changes only the contiguous order inside the group/);
  assert.match(portableReadme, /Remove unlinks a scene from rotation but retains its image/);
  assert.match(portableReadme, /without starting PowerShell, Get-AppxPackage or Add-Type/);
  assert.match(portableReadme, /does not create a separately named Wukong launcher/);
  assert.doesNotMatch(portableReadme, /HISTORICAL V12 INSTRUCTIONS/);
  assert.match(portableReadme, /releasedPetIds is empty/);
  assert.match(portableReadme, /Codex embedded Node -> repository bridge -> event-driven lifecycle host -> official ChatGPT/);
  assert.match(portableReadme, /Pets are deferred and excluded from this release gate/);
  assert.doesNotMatch(portableReadme.split('HISTORICAL V12 INSTRUCTIONS')[0], /V12 changes only/);

  const runtime = await import(pathToFileURL(path.join(target, 'runtime', 'forge-runtime.mjs')));
  const payload = runtime.payloadFromThemeFile(path.join(target, 'themes', 'active.json'));
  assert.match(payload.variables, /data:image\/jpeg;base64/);
  assert.match(payload.variables, /data:image\/webp;base64/);
  assert.equal(payload.assets.length, 22);
  assert.deepEqual(payload.assets.map(asset => asset.id), [
    'erlang-ink-duel',
    'great-sage-staff',
    'storm-bearer',
    'shadow-confrontation',
    'ridge-gate',
    'forest-shrine',
    'mountain-path',
    'sunlit-mountain-vista',
    'sunset-ravine',
    'training-sunset',
    'thunder-dragon-ascent',
    'ink-wanderer',
    'white-tiger',
    'red-lightning',
    'mist-temple',
    'cavern-temple',
    'snow-lake',
    'autumn-grove',
    'violet-dharma-ring',
    'white-dragon-frost',
    'bear-crush',
    'spider-blade'
  ]);
  assert.deepEqual(payload.motifs, {});
  assert.deepEqual(Object.keys(payload.uiAssets), [
    'composerMain',
    'composerStrip',
    'composerPill',
    'paperTile',
    'sidebarLevel1',
    'sidebarSelected',
    'sidebarLevel2Hover',
    'landingMark',
    'landingMarkDark'
  ]);
  assert.match(payload.theme.name, /\S/);
  assert.match(payload.variables, /--forge-paper:#[0-9a-f]{6}/i);
  assert.match(payload.variables, /--forge-scene-count:22/);
  assert.doesNotMatch(payload.variables, /--forge-primary-scene-count:/);
  assert.match(payload.variables, /--forge-scenery-scenes:8 7 16 4 5 6 14 15 17/);
  assert.match(payload.variables, /--forge-battle-primary-scenes:0 1/);
  assert.match(payload.variables, /--forge-battle-secondary-scenes:11 2 3 9 12 13 10 18 19 20 21/);
  assert.match(payload.variables, /--forge-battle-scenes:11 0 1 2 3 9 12 13 10 18 19 20 21/);
  assert.doesNotMatch(payload.variables, /--forge-art-yaksha-king-rift:/);
  assert.match(payload.variables, /--forge-art-great-sage-staff:var\(--forge-bg-1\)/);
  assert.equal((payload.variables.match(/data:image\/jpeg;base64,/g) || []).length, 22, 'each gallery image must be embedded only once');
  assert.match(payload.variables, /--forge-motif-xiangfei-gourd:none/);
  assert.match(payload.variables, /--forge-ui-composer-main:url\("data:image\/webp;base64,/);
  assert.match(payload.variables, /--forge-ui-sidebar-level2-hover:url\("data:image\/webp;base64,/);
  assert.match(payload.variables, /--forge-ui-landing-mark:url\("data:image\/webp;base64,/);
  assert.match(payload.variables, /--forge-ui-landing-mark-dark:url\("data:image\/webp;base64,/);
  assert.doesNotMatch(payload.variables, /--forge-motif-little-(?:wukong|bajie):/);
  assert.equal('motifs' in payload.theme, false);
  assert.deepEqual(payload.assets.map(asset => asset.tone), payload.theme.background.gallery.map(scene => scene.tone));
  assert.deepEqual(payload.assets.map(asset => asset.slot), payload.theme.background.gallery.map(scene => scene.slot));
  assert.deepEqual(payload.assets.map(asset => asset.order), payload.theme.background.gallery.map(scene => scene.order));
  const client = await import(pathToFileURL(path.join(target, 'runtime', 'cdp-client.mjs')));
  assert.equal(typeof client.getTargets, 'function');
  assert.equal(typeof client.commandTarget, 'function');
  assert.equal(client.isCodexTarget({ type: 'page', title: 'Codex', url: 'app://-/index.html' }), true);
  assert.equal(client.isCodexTarget({ type: 'page', title: 'Other', url: 'app://-/index.html' }), false);
  assert.equal(client.isCodexTarget({ type: 'page', title: 'Codex', url: 'https://example.com/' }), false);
});
