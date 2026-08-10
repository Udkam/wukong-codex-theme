import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

test('public install links the live repository without copying a retained theme release', () => {
  const install = read('scripts/install-repository.ps1');
  const compatibilityInstall = read('scripts/install-preserving.ps1');
  const hook = read('scripts/install-chatgpt-hook.ps1');
  const verify = read('scripts/verify-launch-adapter.ps1');
  const start = read('scripts/start.ps1');
  const disable = read('scripts/disable.ps1');
  const installCmd = read('install-theme.cmd');
  const startCmd = read('start-theme.cmd');

  for (const [name, script] of Object.entries({ install, compatibilityInstall, hook, verify, start, disable })) {
    const destructivePattern = name === 'hook'
      ? /\bRemove-Item\b|\bMove-Item\b|rmSync|unlinkSync|rmdirSync/
      : /\bRemove-Item\b|\bMove-Item\b|\.Delete\(|rmSync|unlinkSync|rmdirSync/;
    assert.doesNotMatch(script, destructivePattern, `${name} contains an unbounded destructive file operation`);
    assert.doesNotMatch(script, /Stop-Process|taskkill|Get-CimInstance|Get-WmiObject/i, `${name} uses process killing or WMI`);
  }

  assert.match(installCmd, /scripts\\install-repository\.ps1/i);
  assert.match(install, /install-chatgpt-hook\.ps1/);
  assert.match(install, /verify-launch-adapter\.ps1/);
  assert.match(install, /-Repository/);
  assert.match(install, /--signal-disable --root \$rootPath/);
  const hookInvocation = "& (Join-Path $rootPath 'scripts\\install-chatgpt-hook.ps1')";
  assert.ok(
    install.indexOf('--signal-disable --root $rootPath') < install.indexOf(hookInvocation),
    'the previous retained host is not retired before shortcuts switch to repository mode'
  );
  assert.doesNotMatch(install, /package-runtime|releases|appTarget|install-native-pets/);
  assert.doesNotMatch(install, /Copy-Item|WriteAllText|AppendAllText|config\.toml/i);
  assert.match(compatibilityInstall, /install-repository\.ps1/);
  assert.doesNotMatch(compatibilityInstall, /package-runtime|release\.json|appTarget/);

  assert.match(start, /install-repository\.ps1/);
  assert.match(start, /bridgeHostPath/);
  assert.match(start, /bridgePath/);
  assert.match(start, /& \$node \$bridge/);
  assert.match(start, /\$bridgeExitCode -eq 4/);
  assert.doesNotMatch(start, /install-native-pets|launch\.ps1|Get-CimInstance/);
  assert.doesNotMatch(startCmd, /WindowStyle Hidden|^start\s+""/im);
  assert.match(startCmd, /if errorlevel 1 pause/i);

  assert.match(hook, /const repository = \$repositoryLiteral/);
  assert.match(hook, /\['--repository'\]/);
  assert.match(hook, /const themeAvailable = \[marker, host, theme, style, \.\.\.\(portable \? \[\] : \[activator\]\)\]/);
  assert.match(hook, /const target = themeAvailable \? process\.execPath : official/);
  assert.match(hook, /tasklist\.exe/);
  assert.match(hook, /AbortSignal\.timeout\(5_000\)/);
  assert.match(hook, /launch-notices/);
  assert.doesNotMatch(hook, /Get-CimInstance|Get-WmiObject|wmic(?:\.exe)?/i);
  assert.match(hook, /launcher-bridges/);
  assert.match(hook, /Copy-Item -LiteralPath \$Path -Destination \$backupPath/);
  assert.match(hook, /entryPolicy = 'native-chatgpt-only'/);
  assert.match(hook, /function Remove-LegacyManagedShortcut/);
  assert.match(hook, /legacyBridgePath\.StartsWith\(\$bridgeRoot/);
  assert.match(hook, /Copy-Item -LiteralPath \$Path -Destination \$retiredBackup/);
  assert.match(hook, /\[IO\.File\]::Delete\(\$Path\)/);
  assert.doesNotMatch(hook, /Install-PreservedShortcut[\s\S]{0,100}-Path \$themeShortcutPath/);
  assert.doesNotMatch(hook, /Install-PreservedShortcut[\s\S]{0,100}-Path \$wukongShortcutPath/);
  assert.doesNotMatch(hook, /Install-PreservedShortcut[\s\S]{0,100}-Path \$desktopShortcutPath/);
  assert.match(verify, /bridge launch mode does not match the requested source mode/);
  assert.match(verify, /native-chatgpt-only/);
  assert.doesNotMatch(verify, /Wukong Codex Desktop|ChatGPT - Wukong Theme/);
  assert.match(verify, /Store package replaced the managed ChatGPT shortcut/);
  assert.match(verify, /official ChatGPT icon/);
  assert.match(verify, /sourceMode/);
});

test('repository lifecycle uses Codex embedded Node and never mutates official program files', () => {
  for (const file of ['scripts/install-chatgpt-hook.ps1', 'scripts/disable.ps1']) {
    const script = read(file);
    assert.match(script, /app\\resources\\cua_node\\bin\\node\.exe/, `${file} does not use Codex embedded Node`);
    assert.doesNotMatch(script, /Get-Command\s+node(?:\.exe)?\b/i, `${file} still requires external Node`);
    assert.doesNotMatch(
      script,
      /(?:Set-Content|Add-Content|Out-File|WriteAllText|AppendAllText|Copy-Item|Move-Item|Remove-Item)[^\r\n]*(?:app\.asar|WindowsApps|ChatGPT\.exe)/i,
      `${file} writes an official Codex program path`
    );
  }

  assert.deepEqual(JSON.parse(read('package.json')).dependencies, {});
  assert.doesNotMatch(read('runtime/host.mjs'), /from '\.\/ws-client(?:-node)?\.mjs'/);
  assert.match(read('runtime/host.mjs'), /globalThis\.WebSocket/);
  assert.doesNotMatch(read('package-lock.json'), /"node_modules\/ws"|"ws"\s*:/);
});

test('repository removal and manual stop both use verified renderer restoration', () => {
  const host = read('runtime/host.mjs');
  const disable = read('scripts/disable.ps1');

  assert.match(host, /const themeMissing = !exists\(markerPath\)/);
  assert.match(host, /await Promise\.all\(targets\.map\(target => evaluate\(target, RESTORE_EXPRESSION\)\)\)/);
  assert.match(host, /states\.every\(isNativeThemeState\)/);
  assert.match(host, /theme-removed-verified/);
  assert.match(host, /sourceMode: repository \? 'repository-live'/);
  assert.match(disable, /--signal-disable/);
  assert.match(disable, /--repository/);
  assert.match(disable, /Event lifecycle host did not restore native state/);
  assert.doesNotMatch(disable, /Get-CimInstance|Get-WmiObject|Stop-Process|taskkill/);
});
