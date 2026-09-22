# 最新本地修复验证（2026-09-22）

当前暂停发行。77 项定向测试全部通过：background-runtime-v13、native-paint-boundary、event-host-contract、lifecycle-contract。新增输入框重新挂载期间健康检查仍通过的回归；保留图片未解码时检查失败的覆盖。

实机诊断证据：artifacts/test-runs/native-boundary-20260920/settings-user-repro.json。设置返回后约 0.7 秒，运行时和背景节点同时被旧 v98 替换；因此修复健康检查并更换旧常驻进程。修复后证据见同目录 settings-user-repro-fixed.json：设置中 dark → light → 返回 thread，场景均为 10，sameRuntime 与 sameOverlay 始终为 true。用户反馈“没有问题了”。之后记录到的 10 → 4 → 3 → 10 换图仍保留同一背景层。临时诊断已清除。

以下为历史验证记录，不代表本次最新代码全量验收：

# Theme validation

The current theme preserves native component geometry and semantic text colours. Dark and light settings content surfaces are transparent; cards and sidebars keep their own materials. The light user bubble paints its native surface without adding a blur layer to every message.

## Automated checks

2026-09-22 manual-entry cleanup: the current working tree reports 157 tests, 150 passed, 0 failed and 7 skipped. This includes loading a retired empty taskbar test file whose deletion was blocked. The final cleanup diff has not yet been revalidated in an isolated theme-only checkout; the earlier isolated result below predates it.

A separate checkout of the exact staged theme-only tree was validated using npm ci --ignore-scripts, followed by npm run check: 151 tests, 142 passed, 0 failed, 9 existing legacy tests skipped (7 renderer and 2 historical pet-linker tests). No uncommitted pet changes or private DOM captures are required. The local working tree, including unrelated pet changes, previously reported 153 tests, 146 passed, 0 failed and 7 skipped. The replacement native-boundary suite runs in both colour schemes; no new skip was added to conceal a failing current contract.

The installed-client contract was re-audited against desktop 26.915.4065.0. Its source hash is locked in native-asar-provenance.json. Old assertions for paper textures, forced text colours and the removed B15 scene were replaced with native geometry, semantic state, restoration and the 16-scene queue contracts.

## Performance evidence

A fixed menu fixture reduced average geometry reads from 72.67 to 13.5 and selector queries from 52.5 to 15 per iteration. This measures runtime work, not real application input latency. Region caching, coalesced invalidation and incremental resize observation are covered by behavioural tests. Real input latency and GPU profiling remain separate acceptance work.

## Startup boundary

The public entry is now project start.cmd only. Manual preparation resolves the current official package without changing the native ChatGPT shortcut or a startup registry value; this is exercised by a Windows test. The previously installed launch supervisor has been stopped and its Run value removed. Native ChatGPT.exe starts normally without automatic injection. Existing unmanaged processes are preserved. This new manual preparation path has not yet had another cold-start acceptance run.

## Remaining visual scope

Electron system menus are outside renderer CSS and remain native. Broad visual acceptance is not implied by automated checks. This update does not publish or change native pet packages.

本轮最终 npm run check：161 项，154 通过、0 失败、7 跳过。默认配置已同步当前 13 张图和雪山优先顺序；开始菜单已有主题快捷方式已指向 start.cmd。未执行发布或删除历史存档。

## 本次远程源码同步验证

2026-09-22：从暂存区导出独立主题源码副本后运行 npm run check，158 项中 149 通过、0 失败、9 项既有跳过。未携带本地宠物修改、退役任务栏测试或未跟踪存档；相比本地全工作区的 161 项计数不同。package.json 与 package-lock.json 版本一致。用户已确认浅色效果和设置往返无问题。本次仅推送源码，不创建发行包或标签。

## 主题专用仓库与简化下载包

2026-09-22：取消跟踪 255 个宠物和旧主题资料文件，工作区原文件前后 SHA-256 一致。独立源码 npm run check：153 项，146 通过、0 失败、7 项既有跳过；Studio 端到端检查通过（修正旧默认素材引用，并移除宠物预览）。下载包导入与中文空格路径测试通过，只有根目录 start.cmd 一个批处理，app 中 13 张活动背景可独立解码装载。未为验证重启正在使用的客户端；本次不创建新版 GitHub Release。

## v0.16.0 正式包

独立源码 npm run check：153 项，146 通过、0 失败、7 跳过。正式 ZIP：43 文件，13 背景，解压前后哈希一致。中文空格解压路径下 manual-start 预检通过，未改动官方快捷方式和开机项；未额外冷启动正在运行的客户端。
