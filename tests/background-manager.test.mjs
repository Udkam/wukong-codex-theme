import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateTheme } from '../shared/theme-model.mjs';

const root = process.cwd();
const manager = path.join(root, 'scripts', 'manage-backgrounds.ps1');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

const runManager = (repositoryRoot, args = [], options = {}) => spawnSync(
  'powershell.exe',
  [
    '-NoLogo',
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    manager,
    ...args,
    '-RepositoryRoot',
    repositoryRoot
  ],
  {
    cwd: root,
    encoding: 'utf8',
    input: options.input,
    timeout: 30_000
  }
);

const expectSuccess = result => {
  assert.equal(result.status, 0, `manager failed:\n${result.stdout}\n${result.stderr}`);
  return result;
};

const makeFixture = () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'wukong-background-manager-'));
  const backgrounds = path.join(fixture, 'themes', 'backgrounds');
  fs.mkdirSync(backgrounds, { recursive: true });
  for (const file of ['battle-01.jpg', 'battle-02.jpg', 'scenery-01.jpg', 'scenery-02.jpg']) {
    fs.copyFileSync(path.join(root, 'themes', 'backgrounds', file), path.join(backgrounds, file));
  }
  const theme = readJson(path.join(root, 'themes', 'active.json'));
  theme.id = 'test-gallery';
  theme.name = 'Test gallery';
  theme.background.asset = 'backgrounds/battle-01.jpg';
  theme.background.position = 'center center';
  theme.background.landingPosition = 'center center';
  theme.background.gallery = [
    { id: 'battle-one', slot: 'B01', order: 1, asset: 'backgrounds/battle-01.jpg', position: 'center center', mode: 'battle-primary', tone: 'celestial-ink', veil: 0.78 },
    { id: 'scenery-one', slot: 'S01', order: 1, asset: 'backgrounds/scenery-01.jpg', position: 'center center', mode: 'scenery', tone: 'forest-moss', veil: 0.75 },
    { id: 'battle-two', slot: 'B02', order: 2, asset: 'backgrounds/battle-02.jpg', position: 'center center', mode: 'battle-secondary', tone: 'staff-gold', veil: 0.8 },
    { id: 'scenery-two', slot: 'S02', order: 2, asset: 'backgrounds/scenery-02.jpg', position: 'center center', mode: 'scenery', tone: 'ridge-umber', veil: 0.7 }
  ];
  fs.writeFileSync(path.join(fixture, 'themes', 'active.json'), `${JSON.stringify(theme, null, 2)}\n`, 'utf8');
  return fixture;
};

test('background manager lists, adds, replaces, moves and removes without touching the real manifest', t => {
  if (process.platform !== 'win32') return t.skip('PowerShell 5.1 background manager is Windows-only');
  const realManifest = path.join(root, 'themes', 'active.json');
  const realManifestHash = sha256(realManifest);
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const manifest = path.join(fixture, 'themes', 'active.json');
  const backupRoot = path.join(fixture, '.wukong-runtime', 'background-backups');

  const listed = expectSuccess(runManager(fixture, ['list', '-AsJson']));
  const initialList = JSON.parse(listed.stdout);
  assert.equal(initialList.count, 4);
  assert.deepEqual(initialList.scenes.map(scene => scene.slot), ['B01', 'B02', 'S01', 'S02']);
  assert.deepEqual(initialList.unlinkedAssets, []);

  const manifestBeforeRejectedAdd = sha256(manifest);
  const rejectedAdd = runManager(fixture, [
    'add', '-Mode', 'battle', '-Id', 'battle-one',
    '-InputPath', path.join(root, 'themes', 'backgrounds', 'battle-03.jpg')
  ]);
  assert.notEqual(rejectedAdd.status, 0);
  assert.match(`${rejectedAdd.stdout}\n${rejectedAdd.stderr}`, /already exists/i);
  assert.equal(sha256(manifest), manifestBeforeRejectedAdd);
  assert.equal(fs.existsSync(path.join(fixture, 'themes', 'backgrounds', 'battle-03.jpg')), false);

  expectSuccess(runManager(fixture, [
    'add', '-Mode', 'battle', '-Id', 'inserted-battle', '-Position', '2',
    '-InputPath', path.join(root, 'themes', 'backgrounds', 'battle-03.jpg'),
    '-Tone', 'storm-cyan', '-Veil', '0.7', '-MaxWidth', '320', '-MaxHeight', '180'
  ]));
  let active = readJson(manifest);
  assert.doesNotThrow(() => validateTheme(active));
  let battles = active.background.gallery.filter(scene => scene.mode.startsWith('battle'));
  assert.deepEqual(battles.map(scene => scene.id), ['battle-one', 'inserted-battle', 'battle-two']);
  assert.deepEqual(battles.map(scene => scene.slot), ['B01', 'B03', 'B02']);
  assert.deepEqual(battles.map(scene => scene.order), [1, 2, 3]);
  const insertedAsset = path.join(fixture, 'themes', ...battles[1].asset.split('/'));
  assert.equal(fs.existsSync(insertedAsset), true);
  assert.ok(fs.statSync(insertedAsset).size > 0);

  expectSuccess(runManager(fixture, ['move', '-Target', 'battle-two', '-Position', '1']));
  active = readJson(manifest);
  assert.doesNotThrow(() => validateTheme(active));
  battles = active.background.gallery.filter(scene => scene.mode.startsWith('battle'));
  assert.deepEqual(battles.map(scene => scene.id), ['battle-two', 'battle-one', 'inserted-battle']);
  assert.deepEqual(battles.map(scene => scene.slot), ['B02', 'B01', 'B03']);
  assert.deepEqual(battles.map(scene => scene.order), [1, 2, 3]);
  assert.deepEqual(battles.map(scene => scene.asset), [
    'backgrounds/battle-02.jpg',
    'backgrounds/battle-01.jpg',
    'backgrounds/battle-03.jpg'
  ]);
  assert.equal(active.background.asset, 'backgrounds/battle-02.jpg');
  assert.equal(active.background.position, battles[0].position);
  assert.equal(active.background.landingPosition, battles[0].position);

  const insertedHashBeforeReplace = sha256(insertedAsset);
  expectSuccess(runManager(fixture, [
    'replace', '-Target', 'inserted-battle',
    '-InputPath', path.join(root, 'themes', 'backgrounds', 'scenery-02.jpg'),
    '-Force', '-MaxWidth', '320', '-MaxHeight', '180'
  ]));
  assert.doesNotThrow(() => validateTheme(readJson(manifest)));
  assert.notEqual(sha256(insertedAsset), insertedHashBeforeReplace);
  const assetBackups = fs.readdirSync(backupRoot).filter(file => file.endsWith('-battle-03.jpg'));
  assert.equal(assetBackups.length, 1);
  assert.equal(sha256(path.join(backupRoot, assetBackups[0])), insertedHashBeforeReplace);

  expectSuccess(runManager(fixture, ['remove', '-Target', 'inserted-battle', '-Force']));
  active = readJson(manifest);
  assert.doesNotThrow(() => validateTheme(active));
  battles = active.background.gallery.filter(scene => scene.mode.startsWith('battle'));
  assert.deepEqual(battles.map(scene => scene.id), ['battle-two', 'battle-one']);
  assert.deepEqual(battles.map(scene => scene.slot), ['B02', 'B01']);
  assert.deepEqual(battles.map(scene => scene.order), [1, 2]);
  assert.equal(fs.existsSync(insertedAsset), true, 'remove deleted the retained image asset');

  const afterRemove = JSON.parse(expectSuccess(runManager(fixture, ['list', '-AsJson'])).stdout);
  assert.deepEqual(afterRemove.unlinkedAssets, ['backgrounds/battle-03.jpg']);
  const manifestBackups = fs.readdirSync(backupRoot).filter(file => file.endsWith('-active.json'));
  assert.equal(manifestBackups.length, 4);
  for (const file of [manifest, ...manifestBackups.map(name => path.join(backupRoot, name))]) {
    const bytes = fs.readFileSync(file);
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${file} has a UTF-8 BOM`);
    assert.doesNotThrow(() => JSON.parse(bytes.toString('utf8')));
  }

  const interactive = expectSuccess(runManager(fixture, [], { input: 'q\r\n' }));
  assert.match(interactive.stdout, /Wukong background manager/);
  assert.equal(sha256(realManifest), realManifestHash, 'manager test modified the real theme manifest');
});

test('background manager contracts stay event-free, non-process-controlling and package-safe', () => {
  const script = fs.readFileSync('scripts/manage-backgrounds.ps1', 'utf8');
  const prepare = fs.readFileSync('scripts/prepare-background.ps1', 'utf8');
  const entry = fs.readFileSync('backgrounds.cmd', 'utf8');
  assert.match(script, /ValidateSet\('list', 'add', 'replace', 'move', 'remove'\)/);
  assert.match(script, /Join-Path \$resolvedRoot '\.wukong-runtime'/);
  assert.match(script, /Join-Path \$runtimeRoot 'background-backups'/);
  assert.match(script, /\[IO\.File\]::Replace\(/);
  assert.match(script, /Read-Host/);
  assert.match(script, /assetRetained/);
  assert.match(script, /Battle and scenery rotations must each retain at least one scene/);
  assert.doesNotMatch(script, /Get-CimInstance|Get-WmiObject|Win32_Process|Stop-Process|taskkill|setInterval/i);
  assert.doesNotMatch(script, /Remove-Item[^\r\n]*(?:background|asset)/i);
  assert.match(prepare, /\[string\]\$RepositoryRoot/);
  assert.match(prepare, /\[string\]\$TargetAsset/);
  assert.match(entry, /scripts\\manage-backgrounds\.ps1/);
});

test('background manager preserves both automatic background groups', t => {
  if (process.platform !== 'win32') return t.skip('PowerShell 5.1 background manager is Windows-only');
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  expectSuccess(runManager(fixture, ['remove', '-Target', 'scenery-one', '-Force']));
  const manifest = path.join(fixture, 'themes', 'active.json');
  const beforeRejectedRemoval = sha256(manifest);
  const rejected = runManager(fixture, ['remove', '-Target', 'scenery-two', '-Force']);
  assert.notEqual(rejected.status, 0);
  assert.match(`${rejected.stdout}\n${rejected.stderr}`, /must each retain at least one scene/i);
  assert.equal(sha256(manifest), beforeRejectedRemoval);
  assert.equal(
    readJson(manifest).background.gallery.filter(scene => scene.mode === 'scenery').length,
    1
  );
});

test('public backgrounds.cmd resolves the repository without an explicit root', t => {
  if (process.platform !== 'win32') return t.skip('Windows command entry is Windows-only');
  const result = spawnSync('cmd.exe', ['/d', '/c', path.join(root, 'backgrounds.cmd'), 'list'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000
  });
  assert.equal(result.status, 0, `backgrounds.cmd failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /ORD SLOT GROUP/);
  assert.match(result.stdout, /B01/);
  assert.match(result.stdout, /S01/);
});
