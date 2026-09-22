# 项目文件整理清单（2026-09-22）

## 当前入口与本机状态

- 唯一有效公开批处理：start.cmd → scripts/start.ps1 → 手动准备桥接 → 官方 AppX 启动及主题注入。
- 每次显式启动检测当前官方版本；不注册开机项，不安装原生启动监听，不接管官方快捷方式。
- 本机 ChatGPT.lnk 已恢复指向官方 ChatGPT.exe，参数为空。
- 本机 ChatGPT Theme.lnk 已指向项目 start.cmd。没有删除或终止官方进程。
- WukongCodexThemeNativeEntrySupervisor 开机项已撤销，当前没有主题监督器进程。

## 活动发行文件（44 个）

以下清单由 scripts/package-runtime.mjs 与 themes/active.json 合并、去重生成。包含 13 张活动背景；缺失文件：0。

| 文件 | 状态 |
|---|---|
| runtime/cdp-client.mjs | 保留、进入发行包 |
| runtime/forge-runtime.mjs | 保留、进入发行包 |
| runtime/wukong-codex-theme-background-v13.css | 保留、进入发行包 |
| runtime/injection-plan-v13.mjs | 保留、进入发行包 |
| runtime/injector.mjs | 保留、进入发行包 |
| runtime/host.mjs | 保留、进入发行包 |
| runtime/activate-appx.cs | 保留、进入发行包 |
| runtime/activate-appx.ps1 | 保留、进入发行包 |
| runtime/watch.mjs | 保留、进入发行包 |
| shared/theme-model.mjs | 保留、进入发行包 |
| scripts/start.ps1 | 保留、进入发行包 |
| scripts/install-chatgpt-hook.ps1 | 保留、进入发行包 |
| scripts/prepare-background.ps1 | 保留、进入发行包 |
| scripts/manage-backgrounds.ps1 | 保留、进入发行包 |
| scripts/disable.ps1 | 保留、进入发行包 |
| themes/active.json | 保留、进入发行包 |
| themes/native-wukong.json | 保留、进入发行包 |
| package.json | 保留、进入发行包 |
| LICENSE | 保留、进入发行包 |
| README.md | 保留、进入发行包 |
| PORTABLE-README.txt | 保留、进入发行包 |
| start.cmd | 保留、进入发行包 |
| themes/backgrounds/battle-07.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-01.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-02.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-04.jpg | 保留、进入发行包 |
| themes/backgrounds/scenery-01.jpg | 保留、进入发行包 |
| themes/backgrounds/scenery-05.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-05.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-06.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-08.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-09.jpg | 保留、进入发行包 |
| themes/backgrounds/scenery-08.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-11.jpg | 保留、进入发行包 |
| themes/backgrounds/battle-16.jpg | 保留、进入发行包 |
| themes/ui/v17/composer-main.webp | 保留、进入发行包 |
| themes/ui/v17/composer-strip.webp | 保留、进入发行包 |
| themes/ui/v17/composer-pill.webp | 保留、进入发行包 |
| themes/ui/v17/paper-tile.webp | 保留、进入发行包 |
| themes/ui/v15/sidebar-level1.webp | 保留、进入发行包 |
| themes/ui/v15/sidebar-selected.webp | 保留、进入发行包 |
| themes/ui/v15/sidebar-level2-hover.webp | 保留、进入发行包 |
| themes/ui/v16/landing-wukong-wordmark-light.webp | 保留、进入发行包 |
| themes/ui/v16/landing-wukong-wordmark-dark.webp | 保留、进入发行包 |

## 整理状态（2026-09-22）

项目根目录唯一批处理入口为 start.cmd。install-theme.cmd、stop-theme.cmd、remove-theme.cmd、backgrounds.cmd 已删除。

旧设计、截图、交接存档和任务栏桥文件暂不删除。用户已决定保留具体 76 项清单（约 85.71 MiB），见 [CLEANUP.md](CLEANUP.md)。这些文件不属于活动运行包。

## 保留在源码树，但不进入活动发行

- runtime/native-entry-supervisor.cs、scripts/install-native-supervisor.ps1、scripts/install-repository.ps1、scripts/verify-launch-adapter.ps1、scripts/launch.ps1：旧安装链源码，本次不再从公共入口调用。
- tests/、开发依赖、Studio、docs/：开发与验证材料，不进入最小运行包。
- pets/、artifacts/native-pets/ 及宠物相关未提交修改：保持原状，不纳入主题发行。
- artifacts/test-runs/：本地验证证据，已忽略，不纳入发布。

## 验证边界

手动准备桥接已经验证不改动原生快捷方式和开机项；本轮不强行关闭当前 ChatGPT 做冷启动。官方更新后的新进程仍需要嵌入式 Node 与现有 AppX/CDP 接口可用。

## 本轮检查结果

- 早前 npm run check 记录：157 项，150 通过、7 项跳过；不代表最新修复的全量结果。
- 最新定向验证：77 项通过，0 失败，覆盖背景、原生绘制边界及生命周期。
- 本轮检查针对整个本地工作区；没有提交或推送未提交的宠物修改。
- 发行白名单检查：44 个文件全部存在，唯一 .cmd 为 start.cmd。
- 四个退役根目录批处理已删除；其余存档保持原状。
- 暂停发行：本轮没有生成或发布新的发行包。

本轮最终 npm run check：161 项，154 通过、0 失败、7 跳过。默认配置已同步当前 13 张图和雪山优先顺序；开始菜单已有主题快捷方式已指向 start.cmd。未执行发布或删除历史存档。

## 本次远程源码同步验证

2026-09-22：从暂存区导出独立主题源码副本后运行 npm run check，158 项中 149 通过、0 失败、9 项既有跳过。未携带本地宠物修改、退役任务栏测试或未跟踪存档；相比本地全工作区的 161 项计数不同。package.json 与 package-lock.json 版本一致。用户已确认浅色效果和设置往返无问题。本次仅推送源码，不创建发行包或标签。
