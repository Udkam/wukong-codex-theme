import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MAX_BACKGROUND_PIXELS,
  MAX_DECORATION_PIXELS,
  MAX_GALLERY_BYTES,
  MAX_GALLERY_PIXELS,
  MAX_TRANSITION_PIXELS,
  assertRasterPixelBudget,
  payloadFromThemeFile,
  readRasterDimensions
} from '../runtime/forge-runtime.mjs';

const themePath = path.resolve('themes/active.json');
const themeRoot = path.dirname(themePath);
const theme = JSON.parse(fs.readFileSync(themePath, 'utf8').replace(/^\uFEFF/, ''));

const dimensionsFor = relativeAsset => {
  const assetPath = path.resolve(themeRoot, relativeAsset);
  const dimensions = readRasterDimensions(fs.readFileSync(assetPath), path.extname(assetPath));
  assert.ok(dimensions, `unable to read raster dimensions: ${relativeAsset}`);
  return {
    asset: relativeAsset,
    ...dimensions,
    pixels: dimensions.width * dimensions.height
  };
};

test('active gallery stays inside decoded-pixel and two-scene transition budgets', t => {
  const slotByAsset = new Map(theme.background.gallery.map(scene => [scene.asset, scene.slot]));
  const unique = [...new Set(theme.background.gallery.map(scene => scene.asset))]
    .map(asset => ({ ...dimensionsFor(asset), slot: slotByAsset.get(asset) }));
  const totalPixels = unique.reduce((sum, asset) => sum + asset.pixels, 0);
  const totalBytes = unique.reduce(
    (sum, asset) => sum + fs.statSync(path.resolve(themeRoot, asset.asset)).size,
    0
  );
  const transitionPixels = unique
    .map(asset => asset.pixels)
    .sort((left, right) => right - left)
    .slice(0, 2)
    .reduce((sum, pixels) => sum + pixels, 0);

  for (const asset of unique) {
    assert.ok(asset.pixels <= MAX_BACKGROUND_PIXELS, `${asset.asset} exceeds the per-background budget`);
  }
  assert.equal(unique.length, 22, 'active gallery must contain 22 unique numbered assets');
  assert.ok(totalBytes <= MAX_GALLERY_BYTES, 'gallery exceeds its encoded-byte budget');
  assert.ok(totalPixels <= MAX_GALLERY_PIXELS, 'gallery exceeds its decoded-pixel budget');
  assert.ok(transitionPixels <= MAX_TRANSITION_PIXELS, 'crossfade exceeds its two-scene decoded-pixel budget');

  const primaryGreatSage = unique.find(asset => asset.slot === 'B02');
  assert.deepEqual(
    { width: primaryGreatSage?.width, height: primaryGreatSage?.height },
    { width: 1920, height: 1080 },
    'B02 Great Sage battle background must remain full HD'
  );
  for (const asset of unique) {
    const approvedWide = (
      asset.width >= 1920 &&
      asset.height >= 960 &&
      asset.width / asset.height <= 2.1
    );
    const approvedUltrawide = (
      ['B01', 'B07'].includes(asset.slot) &&
      asset.width >= 2560 &&
      asset.height >= 1000
    );
    const sourceResolutionException = asset.slot === 'B05' && asset.width === 1256 && asset.height === 707;
    assert.ok(
      approvedWide || approvedUltrawide || sourceResolutionException,
      `${asset.slot} ${asset.asset} is below the active cinematic quality floor`
    );
  }
  t.diagnostic(
    `encoded gallery: ${totalBytes.toLocaleString('en-US')} bytes; ` +
    `decoded gallery: ${totalPixels.toLocaleString('en-US')} px; transition: ${transitionPixels.toLocaleString('en-US')} px; ` +
    '22 numbered slots satisfy the 960p-wide, approved ultrawide, or source-resolution contract'
  );

  assert.equal(payloadFromThemeFile(themePath).assets.length, theme.background.gallery.length);
});

test('active UI materials remain bounded after decode', () => {
  for (const relativeAsset of Object.values(theme.uiAssets)) {
    const asset = dimensionsFor(relativeAsset);
    assert.ok(asset.pixels <= MAX_DECORATION_PIXELS, `${asset.asset} exceeds the decoration budget`);
  }
});

test('pixel guard rejects oversized and malformed rasters before payload assembly', () => {
  const oversizedPng = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversizedPng, 0);
  oversizedPng.writeUInt32BE(13, 8);
  oversizedPng.write('IHDR', 12, 'ascii');
  oversizedPng.writeUInt32BE(100_000, 16);
  oversizedPng.writeUInt32BE(100_000, 20);

  assert.throws(
    () => assertRasterPixelBudget(oversizedPng, '.png', MAX_BACKGROUND_PIXELS, 'Synthetic background'),
    /exceeds decoded pixel limit/
  );
  assert.throws(
    () => assertRasterPixelBudget(Buffer.from('not-an-image'), '.png', MAX_BACKGROUND_PIXELS),
    /invalid or unsupported raster dimensions/
  );
});
