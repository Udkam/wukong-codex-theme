import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { cssFor, validateTheme } from '../shared/theme-model.mjs';

export { DEFAULT_THEME, cssFor, makeTheme, validateTheme } from '../shared/theme-model.mjs';

export const MAX_THEME_BYTES = 256 * 1024;
export const MAX_ART_BYTES = 16 * 1024 * 1024;
export const MAX_GALLERY_BYTES = 24 * 1024 * 1024;
export const MAX_MOTIF_BYTES = 4 * 1024 * 1024;
export const MAX_UI_ASSET_BYTES = 1024 * 1024;
export const MAX_BACKGROUND_PIXELS = 12_000_000;
export const MAX_GALLERY_PIXELS = 48_000_000;
export const MAX_TRANSITION_PIXELS = 16_000_000;
export const MAX_DECORATION_PIXELS = 4_194_304;

export function readThemeFile(themePath) {
  const raw = fs.readFileSync(themePath, 'utf8');
  if (Buffer.byteLength(raw) > MAX_THEME_BYTES) throw Error('Theme exceeds size limit');
  return validateTheme(JSON.parse(raw.replace(/^\uFEFF/, '')));
}

const jpegDimensions = buffer => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  const startOfFrame = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf
  ]);
  let offset = 2;
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
    if (startOfFrame.has(marker) && segmentLength >= 7) {
      return {
        width: buffer.readUInt16BE(offset + 5),
        height: buffer.readUInt16BE(offset + 3)
      };
    }
    offset += segmentLength;
  }
  return null;
};

const pngDimensions = buffer => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (
    buffer.length < 24 ||
    !buffer.subarray(0, 8).equals(signature) ||
    buffer.toString('ascii', 12, 16) !== 'IHDR'
  ) return null;
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
};

const webpDimensions = buffer => {
  if (
    buffer.length < 30 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) return null;
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (chunk === 'VP8L' && buffer[20] === 0x2f) {
    return {
      width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8),
      height: 1 + ((buffer[22] & 0xc0) >> 6) + (buffer[23] << 2) + ((buffer[24] & 0x0f) << 10)
    };
  }
  if (
    chunk === 'VP8 ' &&
    buffer[23] === 0x9d &&
    buffer[24] === 0x01 &&
    buffer[25] === 0x2a
  ) {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  return null;
};

export const readRasterDimensions = (buffer, extension) => ({
  '.jpg': jpegDimensions,
  '.jpeg': jpegDimensions,
  '.png': pngDimensions,
  '.webp': webpDimensions
}[extension.toLowerCase()]?.(buffer) || null);

export const assertRasterPixelBudget = (buffer, extension, maximumPixels, label = 'Theme asset') => {
  const dimensions = readRasterDimensions(buffer, extension);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1) {
    throw Error(`${label} has invalid or unsupported raster dimensions`);
  }
  if (dimensions.width > Math.floor(maximumPixels / dimensions.height)) {
    throw Error(`${label} exceeds decoded pixel limit`);
  }
  return {
    ...dimensions,
    pixels: dimensions.width * dimensions.height
  };
};

const assetDataUrl = (themePath, relativeAsset, options = {}) => {
  const root = path.resolve(path.dirname(themePath));
  const asset = path.resolve(root, relativeAsset);
  const relative = path.relative(root, asset);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Theme asset escapes its managed directory');
  const stat = fs.statSync(asset);
  if (!stat.isFile() || stat.size > MAX_ART_BYTES) throw Error('Invalid theme asset');
  const extension = path.extname(asset).toLowerCase();
  const mime = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  }[extension];
  if (!mime) throw Error('Unsupported theme asset');
  const buffer = fs.readFileSync(asset);
  const dimensions = options.maximumPixels
    ? assertRasterPixelBudget(buffer, extension, options.maximumPixels, options.label)
    : null;
  return {
    bytes: stat.size,
    ...dimensions,
    url: `data:${mime};base64,${buffer.toString('base64')}`
  };
};

export function resolveThemeAssets(themePath, theme) {
  if (theme.background.mode === 'solid') return [];
  const requested = theme.background.gallery?.length
    ? theme.background.gallery
    : theme.background.asset
      ? [{ id: 'primary', asset: theme.background.asset, position: theme.background.position }]
      : [];
  let totalBytes = 0;
  let totalPixels = 0;
  const uniquePixels = [];
  const cache = new Map();
  const assets = requested.map(entry => {
    let encoded = cache.get(entry.asset);
    if (!encoded) {
      encoded = assetDataUrl(themePath, entry.asset, {
        maximumPixels: MAX_BACKGROUND_PIXELS,
        label: `Theme background ${entry.id}`
      });
      cache.set(entry.asset, encoded);
      totalBytes += encoded.bytes;
      totalPixels += encoded.pixels;
      uniquePixels.push(encoded.pixels);
      if (totalBytes > MAX_GALLERY_BYTES) throw Error('Theme gallery exceeds size limit');
      if (totalPixels > MAX_GALLERY_PIXELS) throw Error('Theme gallery exceeds decoded pixel limit');
    }
    return {
      id: entry.id,
      slot: entry.slot,
      order: entry.order,
      url: encoded.url,
      position: entry.position,
      mode: entry.mode,
      tone: entry.tone,
      veil: entry.veil,
      mark: entry.mark
    };
  });
  const transitionPixels = uniquePixels.sort((left, right) => right - left).slice(0, 2)
    .reduce((sum, pixels) => sum + pixels, 0);
  if (transitionPixels > MAX_TRANSITION_PIXELS) {
    throw Error('Theme gallery exceeds two-scene transition pixel limit');
  }
  return assets;
}

export function resolveThemeAsset(themePath, theme) {
  return resolveThemeAssets(themePath, theme)[0]?.url || '';
}

export function resolveThemeMotifs(themePath, theme) {
  if (!theme.motifs) return {};
  let totalBytes = 0;
  return Object.fromEntries(Object.entries(theme.motifs).map(([key, relativeAsset]) => {
    const encoded = assetDataUrl(themePath, relativeAsset, {
      maximumPixels: MAX_DECORATION_PIXELS,
      label: `Theme motif ${key}`
    });
    totalBytes += encoded.bytes;
    if (totalBytes > MAX_MOTIF_BYTES) throw Error('Theme motifs exceed size limit');
    return [key, encoded.url];
  }));
}

export function resolveThemeUiAssets(themePath, theme) {
  if (!theme.uiAssets) return {};
  let totalBytes = 0;
  return Object.fromEntries(Object.entries(theme.uiAssets).map(([key, relativeAsset]) => {
    const encoded = assetDataUrl(themePath, relativeAsset, {
      maximumPixels: MAX_DECORATION_PIXELS,
      label: `Theme UI asset ${key}`
    });
    totalBytes += encoded.bytes;
    if (totalBytes > MAX_UI_ASSET_BYTES) throw Error('Theme UI assets exceed size limit');
    return [key, encoded.url];
  }));
}

export function payloadFromThemeFile(themePath) {
  const theme = readThemeFile(themePath);
  const assets = resolveThemeAssets(themePath, theme);
  const motifs = resolveThemeMotifs(themePath, theme);
  const uiAssets = resolveThemeUiAssets(themePath, theme);
  const assetUrl = assets[0]?.url || '';
  return {
    theme,
    assetUrl,
    assets,
    motifs,
    uiAssets,
    variables: cssFor(theme, assets, motifs, uiAssets)
  };
}

if (process.argv[2] === '--validate') {
  const theme = readThemeFile(process.argv[3]);
  console.log(`VALID: ${theme.name}`);
} else if (process.argv[2] === '--payload') {
  console.log(payloadFromThemeFile(process.argv[3]).variables);
}
