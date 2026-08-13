import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const MANAGED_BY = 'WukongCodexThemeNativeTheme';
const LEGACY_MANAGED_BY = 'WukongCodexForgeNativeTheme';

const escapeRegExp = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function tomlLiteral(value) {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return String(value);
  throw new TypeError(`Unsupported native theme value: ${String(value)}`);
}

function textModel(text) {
  const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
  const body = bom ? text.slice(1) : text;
  const newline = body.includes('\r\n') ? '\r\n' : '\n';
  return { bom, newline, lines: body.replaceAll('\r\n', '\n').split('\n') };
}

function sectionRange(lines, section) {
  const header = new RegExp(`^\\s*\\[${escapeRegExp(section)}\\]\\s*(?:#.*)?$`);
  const start = lines.findIndex(line => header.test(line));
  if (start < 0) return null;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^\s*\[[^\]]+\]\s*(?:#.*)?$/.test(lines[index])) {
      end = index;
      break;
    }
  }
  return { start, end };
}

function keyIndex(lines, range, key) {
  const matcher = new RegExp(`^\\s*${escapeRegExp(key)}\\s*=`);
  for (let index = range.start + 1; index < range.end; index += 1) {
    if (matcher.test(lines[index])) return index;
  }
  return -1;
}

function validateSettings(settings) {
  if (!Array.isArray(settings) || settings.length === 0) throw new Error('Native theme settings are missing.');
  const seen = new Set();
  return settings.map(setting => {
    if (!setting || typeof setting.section !== 'string' || typeof setting.key !== 'string') {
      throw new Error('Each native theme setting needs a section and key.');
    }
    const identity = `${setting.section}.${setting.key}`;
    if (seen.has(identity)) throw new Error(`Duplicate native theme setting: ${identity}`);
    seen.add(identity);
    return { ...setting, appliedRaw: tomlLiteral(setting.value) };
  });
}

export function applyNativeTheme(configText, settings) {
  const model = textModel(configText);
  const trailingEmptyLines = [...model.lines].reverse().findIndex(line => line !== '');
  const normalized = validateSettings(settings);
  const managedSections = new Set(normalized.map(setting => setting.section));
  const originalSections = [...new Set(
    model.lines
      .map(line => /^\s*\[([^\]]+)\]\s*(?:#.*)?$/.exec(line)?.[1])
      .filter(section => section && managedSections.has(section))
  )];
  const previous = [];

  for (const setting of normalized) {
    let range = sectionRange(model.lines, setting.section);
    if (range == null) {
      if (model.lines.at(-1) !== '') model.lines.push('');
      model.lines.push(`[${setting.section}]`);
      model.lines.push(`${setting.key} = ${setting.appliedRaw}`);
      previous.push({ ...setting, present: false, line: null });
      continue;
    }

    const index = keyIndex(model.lines, range, setting.key);
    if (index >= 0) {
      previous.push({ ...setting, present: true, line: model.lines[index] });
      model.lines[index] = `${setting.key} = ${setting.appliedRaw}`;
    } else {
      previous.push({ ...setting, present: false, line: null });
      model.lines.splice(range.end, 0, `${setting.key} = ${setting.appliedRaw}`);
    }
  }

  return {
    text: model.bom + model.lines.join(model.newline),
    state: { originalSections, previous, trailingEmptyLines: trailingEmptyLines < 0 ? model.lines.length : trailingEmptyLines }
  };
}

function isAppliedLine(line, setting) {
  return line.trim() === `${setting.key} = ${setting.appliedRaw}`;
}

export function restoreNativeTheme(configText, themeState) {
  const model = textModel(configText);
  const warnings = [];
  const previous = Array.isArray(themeState?.previous) ? [...themeState.previous].reverse() : [];

  for (const setting of previous) {
    const range = sectionRange(model.lines, setting.section);
    const index = range == null ? -1 : keyIndex(model.lines, range, setting.key);
    if (index < 0) {
      if (setting.present) warnings.push(`Missing user setting was not recreated: ${setting.section}.${setting.key}`);
      continue;
    }
    if (!isAppliedLine(model.lines[index], setting)) {
      warnings.push(`Preserved setting changed after install: ${setting.section}.${setting.key}`);
      continue;
    }
    if (setting.present) model.lines[index] = setting.line;
    else model.lines.splice(index, 1);
  }

  const originalSections = new Set(themeState?.originalSections ?? []);
  const insertedSections = [...new Set(previous.map(setting => setting.section))]
    .filter(section => !originalSections.has(section));
  for (const section of insertedSections) {
    const range = sectionRange(model.lines, section);
    if (range == null) continue;
    const content = model.lines.slice(range.start + 1, range.end);
    if (content.every(line => line.trim() === '' || line.trim().startsWith('#'))) {
      model.lines.splice(range.start, range.end - range.start);
      while (range.start < model.lines.length - 1 && model.lines[range.start] === '' && model.lines[range.start + 1] === '') {
        model.lines.splice(range.start, 1);
      }
    }
  }

  if (Number.isInteger(themeState?.trailingEmptyLines) && themeState.trailingEmptyLines >= 0) {
    let currentTrailing = [...model.lines].reverse().findIndex(line => line !== '');
    currentTrailing = currentTrailing < 0 ? model.lines.length : currentTrailing;
    while (currentTrailing > themeState.trailingEmptyLines) {
      model.lines.pop();
      currentTrailing -= 1;
    }
    while (currentTrailing < themeState.trailingEmptyLines) {
      model.lines.push('');
      currentTrailing += 1;
    }
  }

  return { text: model.bom + model.lines.join(model.newline), warnings };
}

export function upgradeNativeTheme(configText, themeState, settings) {
  const restored = restoreNativeTheme(configText, themeState);
  const applied = applyNativeTheme(restored.text, settings);
  return { text: applied.text, state: applied.state, warnings: restored.warnings };
}

export function loadThemeDefinition(file) {
  const definition = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (definition.schemaVersion !== 1 || typeof definition.id !== 'string') {
    throw new Error('Unsupported native theme definition.');
  }
  validateSettings(definition.settings);
  return definition;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith('--') || value == null) throw new Error(`Invalid argument near ${flag ?? '(end)'}.`);
    values[flag.slice(2)] = value;
  }
  return { command, values };
}

function writeUtf8(file, text) {
  fs.writeFileSync(file, text, { encoding: 'utf8' });
}

function validateManagedState(state, { config, destination }) {
  if (state.managedBy !== MANAGED_BY && state.managedBy !== LEGACY_MANAGED_BY) {
    throw new Error('Refusing native theme operation: state marker is invalid.');
  }
  if (path.resolve(config).toLowerCase() !== path.resolve(state.configPath).toLowerCase()) {
    throw new Error('Refusing native theme operation: config path does not match the state marker.');
  }
  if (path.resolve(destination).toLowerCase() !== path.resolve(state.destination).toLowerCase()) {
    throw new Error('Refusing native theme operation: destination does not match the state marker.');
  }
}

function stateFor({ config, destination, theme, applied }) {
  return {
    managedBy: MANAGED_BY,
    installedAt: new Date().toISOString(),
    configPath: path.resolve(config),
    destination: path.resolve(destination),
    themeId: theme.id,
    ...applied.state
  };
}

function install({ config, definition, destination }) {
  const statePath = path.join(destination, 'state.json');
  if (fs.existsSync(statePath)) throw new Error('Native Wukong theme is already installed. Remove it before reinstalling.');
  const theme = loadThemeDefinition(definition);
  const original = fs.readFileSync(config, 'utf8');
  const applied = applyNativeTheme(original, theme.settings);
  const state = stateFor({ config, destination, theme, applied });
  writeUtf8(config, applied.text);
  try {
    writeUtf8(statePath, `${JSON.stringify(state, null, 2)}\n`);
  } catch (error) {
    writeUtf8(config, original);
    throw error;
  }
  return state;
}

function upgrade({ config, definition, destination }) {
  const statePath = path.join(destination, 'state.json');
  const originalStateText = fs.readFileSync(statePath, 'utf8');
  const originalState = JSON.parse(originalStateText);
  validateManagedState(originalState, { config, destination });
  const theme = loadThemeDefinition(definition);
  const originalConfig = fs.readFileSync(config, 'utf8');
  const upgraded = upgradeNativeTheme(originalConfig, originalState, theme.settings);
  const state = stateFor({ config, destination, theme, applied: upgraded });
  writeUtf8(config, upgraded.text);
  try {
    writeUtf8(statePath, `${JSON.stringify(state, null, 2)}\n`);
  } catch (error) {
    writeUtf8(config, originalConfig);
    writeUtf8(statePath, originalStateText);
    throw error;
  }
  return { state, warnings: upgraded.warnings };
}

function restore({ config, destination }) {
  const statePath = path.join(destination, 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  validateManagedState(state, { config, destination });
  const current = fs.readFileSync(config, 'utf8');
  const restored = restoreNativeTheme(current, state);
  writeUtf8(config, restored.text);
  return restored;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const { command, values } = parseArgs(process.argv.slice(2));
    if (command === 'validate') {
      loadThemeDefinition(values.definition);
      console.log('VALID: native Codex theme definition');
    } else if (command === 'install') {
      install(values);
      console.log('INSTALLED: native Codex theme settings');
    } else if (command === 'upgrade') {
      const result = upgrade(values);
      for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
      console.log('UPGRADED: native Codex theme settings');
    } else if (command === 'restore') {
      const result = restore(values);
      for (const warning of result.warnings) console.warn(`WARNING: ${warning}`);
      console.log('RESTORED: native Codex theme settings');
    } else {
      throw new Error('Usage: native-theme.mjs <validate|install|upgrade|restore> --definition FILE --config FILE --destination DIR');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
