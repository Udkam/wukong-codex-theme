import { DEFAULT_THEME, makeTheme, validateTheme } from '../shared/theme-model.mjs';

const $ = id => document.getElementById(id);
const storage = 'wukong-codex-theme.theme.v2';
const legacyStorage = 'wukong-codex-forge.theme.v2';
const bundledArt = '../themes/' + DEFAULT_THEME.background.asset;
const clone = value => JSON.parse(JSON.stringify(value));

let theme = loadTheme();
let localImage = theme.background.source === DEFAULT_THEME.background.source ? bundledArt : '';
let surface = 'landing';
let workbenchBackground = clone(theme.background);

function loadTheme() {
  try {
    const current = localStorage.getItem(storage);
    const legacy = current === null ? localStorage.getItem(legacyStorage) : null;
    if (current === null && legacy === null) return clone(DEFAULT_THEME);
    const loaded = makeTheme(JSON.parse(current ?? legacy));
    if (current === null && legacy !== null) {
      localStorage.setItem(storage, JSON.stringify(loaded));
      localStorage.removeItem(legacyStorage);
    }
    return loaded;
  } catch {
    return clone(DEFAULT_THEME);
  }
}

function save() {
  localStorage.setItem(storage, JSON.stringify(theme));
}

function status(message) {
  $('status').textContent = message;
}

function setSurface(next) {
  surface = next;
  $('preview').dataset.surface = next;
  $('showLanding').setAttribute('aria-pressed', String(next === 'landing'));
  $('showThread').setAttribute('aria-pressed', String(next === 'thread'));
}

function render() {
  validateTheme(theme);
  $('themeName').value = theme.name;
  $('backgroundMode').value = theme.background.mode;
  $('position').value = theme.background.position;
  $('landingPosition').value = theme.background.landingPosition;
  $('dim').value = Math.round(theme.background.dim * 100);
  $('art').value = Math.round(theme.background.taskIntensity * 100);
  $('landingArt').value = Math.round(theme.background.landingIntensity * 100);
  $('dimOut').value = Math.round(theme.background.dim * 100) + '%';
  $('artOut').value = Math.round(theme.background.taskIntensity * 100) + '%';
  $('landingArtOut').value = Math.round(theme.background.landingIntensity * 100) + '%';
  $('reducedMotion').checked = theme.accessibility.reducedMotion;
  $('localFileLabel').hidden = theme.background.mode !== 'local';

  const preview = $('preview');
  preview.style.setProperty('--studio-dim', theme.background.dim);
  preview.style.setProperty('--studio-intensity', theme.background.taskIntensity);
  preview.style.setProperty('--studio-landing-intensity', theme.background.landingIntensity);
  preview.style.setProperty('--studio-position', theme.background.position);
  preview.style.setProperty('--studio-landing-position', theme.background.landingPosition);
  preview.classList.toggle('high-read', theme.accessibility.preset === 'high-read');
  preview.classList.toggle('reduced-motion', theme.accessibility.reducedMotion);
  const image = theme.background.mode === 'local' && localImage
    ? 'url("' + localImage.replaceAll('"', '%22') + '")'
    : theme.background.mode === 'gallery' ? 'url("../themes/' + theme.background.asset.replaceAll('"', '%22') + '")' : 'none';
  preview.style.setProperty('--studio-image', image);

  save();
}

function update(mutator) {
  mutator(theme);
  theme = makeTheme(theme);
  render();
}

const inputBindings = [
  ['themeName', value => { theme.name = value; }],
  ['backgroundMode', value => { theme.background.mode = value; }],
  ['position', value => { theme.background.position = value; }],
  ['landingPosition', value => { theme.background.landingPosition = value; }],
  ['dim', value => { theme.background.dim = Number(value) / 100; }],
  ['art', value => { theme.background.taskIntensity = Number(value) / 100; }],
  ['landingArt', value => { theme.background.landingIntensity = Number(value) / 100; }],
  ['reducedMotion', value => { theme.accessibility.reducedMotion = value; }],
];

for (const [id, mutator] of inputBindings) {
  $(id).addEventListener('input', event => update(() => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    mutator(value);
  }));
}

$('showLanding').addEventListener('click', () => setSurface('landing'));
$('showThread').addEventListener('click', () => setSurface('thread'));

$('localFile').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 16 * 1024 * 1024) {
    status('图片超过 16 MB，未导入。');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    localImage = reader.result;
    update(() => {
      theme.background.mode = 'local';
      theme.background.source = file.name;
      theme.background.asset = null;
    });
    status('已用于当前预览；导出后请用 theme.ps1 -Image 导入受管运行时。');
  };
  reader.readAsDataURL(file);
});

$('themeImport').addEventListener('change', event => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      theme = makeTheme(JSON.parse(reader.result));
      localImage = theme.background.source === DEFAULT_THEME.background.source ? bundledArt : '';
      workbenchBackground = clone(theme.background);
      render();
      status(localImage ? '有效主题与内置素材已导入。' : '有效主题已导入；本地背景需重新选择。');
    } catch (error) {
      status('拒绝主题：' + error.message);
    }
  };
  reader.readAsText(file, 'utf-8');
});

$('preset').addEventListener('click', () => update(() => {
  if (theme.accessibility.preset === 'high-read') {
    theme.accessibility.preset = 'workbench';
    theme.background = clone(workbenchBackground);
    theme.accessibility.reducedMotion = false;
  } else {
    workbenchBackground = clone(theme.background);
    theme.accessibility.preset = 'high-read';
    theme.background.mode = 'solid';
    theme.background.asset = null;
    theme.background.taskIntensity = 0;
    theme.background.landingIntensity = 0;
    theme.background.dim = 0.94;
    theme.accessibility.reducedMotion = true;
  }
}));

$('export').addEventListener('click', () => {
  const output = makeTheme(theme);
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' }));
  anchor.download = 'wukong-codex-theme.json';
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  status('已导出 schema v2 主题配置。');
});

setSurface(surface);
render();
