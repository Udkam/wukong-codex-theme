import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';

test('manual preparation resolves the official package without changing its shortcut or startup entry', {skip:process.platform!=='win32'}, () => {
  const script = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$ProgressPreference='SilentlyContinue'
$shortcut=Join-Path ([Environment]::GetFolderPath('Programs')) 'ChatGPT.lnk'
$before=if(Test-Path $shortcut){[Convert]::ToBase64String([IO.File]::ReadAllBytes($shortcut))}else{''}
$runPath='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
$runName='WukongCodexThemeNativeEntrySupervisor'
$startupBefore=(Get-ItemProperty -LiteralPath $runPath -Name $runName -ErrorAction SilentlyContinue).$runName
$raw=@(& './scripts/install-chatgpt-hook.ps1' -Root (Get-Location).Path -Repository -ManualOnly)
$record=($raw | Where-Object { ([string]$_).StartsWith('{') } | Select-Object -Last 1) | ConvertFrom-Json
$after=if(Test-Path $shortcut){[Convert]::ToBase64String([IO.File]::ReadAllBytes($shortcut))}else{''}
$startupAfter=(Get-ItemProperty -LiteralPath $runPath -Name $runName -ErrorAction SilentlyContinue).$runName
@{mode=$record.mode; node=$record.bridgeHostPath; bridge=$record.bridgePath; shortcutUnchanged=($before -eq $after); startupUnchanged=($startupBefore -eq $startupAfter)} | ConvertTo-Json -Compress
`;
  const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{encoding:'utf8',timeout:20000,windowsHide:true});
  assert.equal(result.status,0,result.stderr);
  const proof=JSON.parse(result.stdout.trim());
  assert.equal(proof.mode,'manual-only');
  assert.equal(proof.shortcutUnchanged,true);
  assert.equal(proof.startupUnchanged,true);
  assert.ok(fs.existsSync(proof.node));
  assert.ok(fs.existsSync(proof.bridge));
});
