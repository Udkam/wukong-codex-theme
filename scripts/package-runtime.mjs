import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadNativePetReleasePolicy } from './native-pet-release-policy.mjs';

const runtimeFiles = [
  'runtime/cdp-client.mjs',
  'runtime/forge-runtime.mjs',
  'runtime/forge-background-v13.css',
  'runtime/injection-plan-v13.mjs',
  'runtime/injector.mjs',
  'runtime/host.mjs',
  'runtime/activate-appx.cs',
  'runtime/activate-appx.ps1',
  'runtime/native-entry-supervisor.cs',
  'runtime/watch.mjs',
  'shared/theme-model.mjs',
  'scripts/launch.ps1',
  'scripts/start.ps1',
  'scripts/install-repository.ps1',
  'scripts/install-native-pets.ps1',
  'scripts/install-chatgpt-hook.ps1',
  'scripts/install-native-supervisor.ps1',
  'scripts/prepare-background.ps1',
  'scripts/verify-launch-adapter.ps1',
  'scripts/disable.ps1',
  'pets/release-policy.json',
  'themes/active.json',
  'themes/native-wukong.json',
  'package.json',
  'LICENSE',
  'README.md',
  'PORTABLE-README.txt',
  'start-theme.cmd',
  'install-theme.cmd',
  'stop-theme.cmd',
  'remove-theme.cmd'
];

const inside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const assertNoLinkedExistingSegments = (candidate, label) => {
  const resolved = path.resolve(candidate);
  const parsed = path.parse(resolved);
  let cursor = parsed.root;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) break;
    if (fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`${label} passes through a symbolic link or junction: ${cursor}`);
    }
  }
};

export function packageRuntime({ source, destination }) {
  const sourceRoot = path.resolve(source);
  const target = path.resolve(destination);
  assertNoLinkedExistingSegments(sourceRoot, 'Runtime package source');
  assertNoLinkedExistingSegments(target, 'Runtime package destination');
  const sourceRootItem = fs.lstatSync(sourceRoot);
  if (!sourceRootItem.isDirectory() || sourceRootItem.isSymbolicLink()) {
    throw new Error('Runtime package source must be a direct directory.');
  }
  if (sourceRoot === target || inside(sourceRoot, target) || inside(target, sourceRoot)) {
    throw new Error('Runtime package destination must be separate from the source repository.');
  }
  if (fs.existsSync(target)) {
    throw new Error('Runtime package destination must not already exist.');
  }

  const releasePolicy = loadNativePetReleasePolicy(sourceRoot);
  const nativePetFiles = releasePolicy.releasedPetIds.flatMap(id => [
    `pets/${id}/pet.json`,
    `pets/${id}/spritesheet.webp`,
    `pets/${id}/validation.json`,
    `pets/${id}/package-proof.json`
  ]);

  const activePath = path.join(sourceRoot, 'themes', 'active.json');
  if (!fs.lstatSync(activePath).isFile()) throw new Error('Required active theme definition is missing.');
  const active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
  const themeReferences = [
    active.background?.asset,
    ...(active.background?.gallery || []).map(item => item.asset),
    ...Object.values(active.motifs || {}),
    ...Object.values(active.uiAssets || {})
  ].filter(Boolean).map(file => `themes/${file}`);
  const sourceRootReal = fs.realpathSync.native(sourceRoot);
  const packageFiles = [...new Set([...runtimeFiles, ...nativePetFiles, ...themeReferences])];
  const sources = packageFiles.map(relativeFile => {
    const normalized = path.normalize(relativeFile);
    const sourceFile = path.resolve(sourceRoot, normalized);
    if (!inside(sourceRoot, sourceFile)) throw new Error(`Theme file escapes the source root: ${relativeFile}`);
    assertNoLinkedExistingSegments(sourceFile, `Runtime source file ${relativeFile}`);
    const sourceItem = fs.lstatSync(sourceFile);
    if (!sourceItem.isFile() || sourceItem.isSymbolicLink()) throw new Error(`Required runtime file is missing or linked: ${relativeFile}`);
    const sourceFileReal = fs.realpathSync.native(sourceFile);
    if (!inside(sourceRootReal, sourceFileReal)) throw new Error(`Theme file resolves outside the source root: ${relativeFile}`);
    return { relativeFile, normalized, sourceFile };
  });

  const targetParent = path.dirname(target);
  assertNoLinkedExistingSegments(targetParent, 'Runtime package destination parent');
  fs.mkdirSync(targetParent, { recursive: true });
  assertNoLinkedExistingSegments(targetParent, 'Runtime package destination parent');
  const stage = `${target}.stage-${process.pid}-${randomUUID()}`;
  assertNoLinkedExistingSegments(stage, 'Runtime package staging destination');
  fs.mkdirSync(stage, { recursive: false });
  assertNoLinkedExistingSegments(stage, 'Runtime package staging destination');
  const targetRootReal = fs.realpathSync.native(stage);
  const copyRelativeFile = ({ relativeFile, normalized, sourceFile }) => {
    const targetFile = path.resolve(stage, normalized);
    if (!inside(stage, targetFile)) throw new Error(`Theme file escapes the package root: ${relativeFile}`);
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
    const targetParentReal = fs.realpathSync.native(path.dirname(targetFile));
    if (targetParentReal !== targetRootReal && !inside(targetRootReal, targetParentReal)) {
      throw new Error(`Theme destination resolves outside the package root: ${relativeFile}`);
    }
    fs.copyFileSync(sourceFile, targetFile);
  };
  try {
    sources.forEach(copyRelativeFile);
    fs.renameSync(stage, target);
  } catch (error) {
    error.message = `${error.message} Incomplete append-only package state was retained at ${stage}.`;
    throw error;
  }
  return target;
}

function args(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || value == null) throw new Error(`Invalid argument near ${flag ?? '(end)'}.`);
    values[flag.slice(2)] = value;
  }
  return values;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const values = args(process.argv.slice(2));
    if (!values.source || !values.destination) throw new Error('Use --source DIR --destination DIR.');
    console.log(`PACKAGED: ${packageRuntime(values)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
