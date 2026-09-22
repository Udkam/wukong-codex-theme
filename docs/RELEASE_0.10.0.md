# 0.10.0 / V11 发布记录

发布日期：2026-07-22

## 交付结论

V11 在真实 Codex 26.715.2305.0 renderer 上完成主题与原生 Hatch Pet 闭环。它保留 Codex 原有顶部栏、275 px 侧栏、工作区、736 × 98 px 输入器、环境信息卡、原文案和事件，只替换现有表面的背景、轮廓、材质、边线和状态表达；没有新增主题侧栏、底栏、开关、状态卡、提示词或 emoji。

- 新建任务使用战斗境，杨戬、大圣、金箍棒为主画面，夜叉王等为次级画面。
- 进入对话使用风景境；11 张背景均为单层全窗 `cover`，各自携带独立的组件色板与可读性遮罩。
- 侧栏按钮、输入器、发送键和环境卡采用经匣、朱砂签、短轨和典籍匣角的非通用组件造型；不改变原生 DOMRect。
- 助手回答及祖先链继续透明无框；用户提示词、回答与输入提示不改写。
- 页面角色覆盖层已经移除；页面 motif 只保留不接收交互、无障碍隐藏的湘妃葫芦。

## 原生 Hatch Pet

两个角色均为 Codex `spriteVersionNumber: 2` 原生宠物包，而不是页面贴图。图集固定为 1536 × 2288、8 列 × 11 行、RGBA WebP，包含 9 个标准动作行和 16 个顺时针观察方向；透明像素 RGB 残留为 0。

| 宠物 | 造型与武器 | 图集 SHA-256 | 验证 SHA-256 |
| --- | --- | --- | --- |
| 小八戒 | 参考 INART 1/12 的幼态脸、旧青衣与念珠；完整九齿钉耙，每个方向均保留九齿 | `511BC2B8CA7C197407AB8E3BE194AAA5F2036428C05FDCB811400525005C2277` | `C3D40C54805F4AEB4F6042D70933853C9F4D4A06472FD7A8D09476160AD8CAD8` |
| 小悟空·厌火夜叉 | 参考游科官方天命人厌火夜叉套 1/12；武器为兽棍·神锋 | `018C3447368C23F963335710CA09086EFD634B2826B2913A920F3960E3D77D87` | `FA8ACF13C459EC8293FC3E25B2CFB42ECAF74487B46DCC92E8206632A1DC9C1C` |

设计参考：[INART Bajie 1/12 官方页](https://global.inart.studio/ja/products/bajie-twelfth-scale-figure)、[《黑神话：悟空》官方微博手办发布](https://www.weibo.com/7972761955/Q5qbwbjOC)。这些页面只作为造型与装备参考，发布包不包含网页文件或第三方模型数据。

动作与方向证据：

- [小八戒 11 行动作表](pets/little-bajie-v3-inart/contact-sheet.png)、[16 方向表](pets/little-bajie-v3-inart/look-directions.png)、[盲审记录](pets/little-bajie-v3-inart/direction-blind-validation.json)
- [小悟空 11 行动作表](pets/little-wukong-yaksha-shenfeng/contact-sheet.png)、[16 方向表](pets/little-wukong-yaksha-shenfeng/look-directions.png)、[盲审记录](pets/little-wukong-yaksha-shenfeng/direction-blind-validation.json)

## 官方发现链路

只读核对官方宠物 loader 后确认：Codex 只枚举 `Dirent.isDirectory()` 为真的顶层目录，并检查 manifest 中的图集路径在该目录词法范围内。安装器因此创建真实的顶层发现目录，在内部建立 `payload` 目录 junction，并让派生 `pet.json` 指向 `payload/spritesheet.webp`。

这样首次安装不会复制约 2 MiB 的动画图集，不需要管理员权限或 Developer Mode；图集继续由下载并保留的主题包承载。若存在早期直接复制版，原 manifest 会保存为 `source-pet.json`，旧图集继续原位保留，再将活动 manifest 迁移到 payload 路径。内容冲突时安装器 fail closed，不覆盖、移动或删除已有文件。

## 实机证据

- [真实 Codex V11 新建任务页](screenshots/live-codex-v11-native-pets-initial-20260722.png)及其[状态 JSON](screenshots/live-codex-v11-native-pets-initial-20260722.png.json)
- [官方“宠物”设置页识别两个 payload 包](screenshots/live-codex-v11-native-pets-linked-payload-main-20260722.png)及其[状态 JSON](screenshots/live-codex-v11-native-pets-linked-payload-main-20260722.png.json)
- [小八戒原生 overlay](screenshots/live-codex-v11-bajie-pet-linked-payload-20260722.png)及其[状态 JSON](screenshots/live-codex-v11-bajie-pet-linked-payload-20260722.png.json)
- [小悟空原生 overlay](screenshots/live-codex-v11-wukong-pet-linked-payload-20260722.png)及其[状态 JSON](screenshots/live-codex-v11-wukong-pet-linked-payload-20260722.png.json)
- [稳定 fixture：战斗境](screenshots/runtime-v11-fixture-v2-landing.png)、[稳定 fixture：风景境](screenshots/runtime-v11-fixture-v2-thread.png)、[几何与控制台记录](screenshots/runtime-v11-fixture-v2.json)

## 定向验证

以下组合在最终源码与最终宠物包上通过 32/32：

```powershell
node --test tests/native-pets-contract.test.mjs tests/injection-fixture.test.mjs tests/runtime-style-visual.test.mjs tests/scene-palette.test.mjs tests/lifecycle-contract.test.mjs tests/preserving-install-contract.test.mjs tests/managed-package.test.mjs tests/native-theme.test.mjs
```

覆盖范围包括：Hatch Pet v2 包与哈希绑定、官方发现目录链接器、landing/thread 动态注入、输入器尺寸拒绝门、回答无框、11 场景色板、PowerShell 生命周期、无删除安装、最小包导入和原生主题恢复。

## 发布包

- 文件：`release/wukong-codex-forge-0.10.0-portable-20260722-123609-0afe4b0.zip`
- ZIP：42 项，6,790,345 bytes
- 解包内容：6,987,427 bytes
- SHA-256：`25196E65C39AC2176AB63FC856C643ACAEF201736157931801FE8BBBAB6F4513`
- 禁止项审计：`docs`、`tests`、`artifacts`、`node_modules`、`.wukong-runtime`、WebSocket 调研件均为 0
- 只增不删 stage：`E:\Proj\wukong-codex-forge-package-stage-0.10.0-20260722-123609-0afe4b0`

下载并解压后双击 `start.cmd`。`stop-theme.cmd` 只把当前 renderer 恢复为原生外观并验证清理，不删除文件。宠物 payload 依赖保留的解压目录；该目录不存在后图集在下一次宠物刷新时不可读。根据本轮“任何内容不得删除”的最高约束，脚本会保留小型发现元数据和历史证据，用户可在自行审计后决定是否手工清理。
