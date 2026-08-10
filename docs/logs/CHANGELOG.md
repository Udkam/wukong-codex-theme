# Local work log

## 2026-08-11 — Wukong Codex Theme repository rename

- Merged PR 1 into `main` at `ad0bef0`, renamed the public repository to `wukong-codex-theme`, and updated the canonical npm/package marker, current installer/runtime checks, Studio labels and user clone instructions.
- Preserved `WukongCodexForge`, `wukong-forge`, the retained-release path and the existing Studio storage key as explicit upgrade-compatibility identifiers; historical release paths and evidence remain unchanged.
- Added path-specific line-ending attributes for the frozen pet proof files so fresh Windows clones reproduce the reviewed byte hashes instead of depending on a previous checkout's Git settings.
- Rename/lifecycle/minimal-package focused contracts passed 46/46. The final full gate passed 101 tests with 9 environment-only skips and 0 failures.

## 2026-08-01 — V34 event-driven lifecycle release candidate

- Replaced the formal persistent PowerShell/watcher launch path with Codex embedded Node, an append-only bridge, `runtime/host.mjs`, and the official ChatGPT root process.
- The host is event-driven through browser Target/Page/Runtime and marker filesystem events; it exits with the official root and verifies native restoration on disable.
- Pets are deferred and excluded from this release gate; `releasedPetIds` remains empty, existing pet state is preserved, and the canceled gourd remains outside the active package.
- Version and current documentation move to 0.13.0 / V34. Append-only retained release `0.13.0-20260801-144611` is installed; both managed Start Menu entries use the Codex embedded Node bridge, and the installed/repository host hashes match.
- Renderer startup now waits without a global timeout while individual CDP operations remain bounded. Focused lifecycle/restore contracts pass 23/23 and the minimal managed package passes 1/1.
- Three single-owned live attempts failed closed: one earlier red-threshold stop, one renderer-ready/deadline collision, and one later red-threshold stop. Every attempt returned `disabled-verified` and released its exact root, host, descendants, and port. No screenshot was produced or claimed as acceptance.
- With pets deferred and the gourd canceled, the only remaining release gate is one real managed complete-page capture containing queue/goal state and post-capture resource cleanup; fixture evidence is not substituted for this gate.

## 2026-08-01 — V25 unapproved native pet release gate

- Unified preparation, packaging, and installation through `pets/release-policy.json`; `releasedPetIds` is empty and both rejected historical pets are frozen.
- Preparation performs no historical atlas read/write, the managed package includes no old pet payload, and installation returns before touching Codex user directories or runtime records.
- Focused contracts passed: native pets 3 pass / 2 historical skip and managed package 1/1. No browser, full suite, server, or listener was started.

## 2026-07-31 — V24 background transition lifecycle proof

- Added one-page, four-stage full-viewport capture evidence for landing battle, landing-to-thread crossfade, thread scenery, and returned landing battle states.
- Locked every background/veil layer to viewport coverage, stable/transition texture counts to `1/2`, prefetch to `0`, and rejected persistent full-screen filters or `will-change`.
- Updated one stale background assertion to recognize the official V23 environment panel mapping; focused background tests passed 8/8 and pixel/scene gates passed 6/6.
- Evidence is under `artifacts/test-runs/v24-background-transition-2026-07-31T23-55-59-699Z/`; it is a headless native-structure fixture checkpoint, not final installed-Codex acceptance.

## 2026-07-31 — V23 environment panel scripture surface

- Read the installed `OpenAI.Codex 26.715.2305.0` ASAR and made the official `thread-summary-panel` obstacle, 300px width, content class signature, and native slots the fail-closed source of truth.
- Applied the warm smoked-paper material only through pointer-transparent paint layers; the native panel, rows, links, add button, scroll behavior, ARIA, geometry, and hit boxes remain unchanged.
- Focused ASAR and Playwright checks passed 1/1 each. The complete 1600x900 fixture evidence with two queued messages, an active goal, composer, sidebar, top bar, background, and environment card is `artifacts/test-runs/v23-environment-panel-2026-07-31T23-14-14-461Z/01-full-multi-guided.png`.
- The one-page headless capture closed in `finally`; no project browser, Node helper, debug window, or listener was retained. This is a rollback checkpoint, not final real-Codex acceptance.

## 2026-07-25 — V15 真实金箍棒原生槽位占比修正

- 用户指出前一版虽然使用真实模型，但在 56×56 槽位内仍像过小的卡通短棍。保持官方槽位、原节点、DOMRect 和 aria 不变，只把离线生成参数从 48×7 调整为 60×9，继续使用 39° 方向。
- 新 112×112 资源为 3,218 bytes；`alpha>16` 边界为 100×84，映射到原生槽位约 50×42 px，左右约 3 px、上下约 7 px，完整保留两端兽纹端箍。
- 像素合同新增四边透明、边距对称、主轴角度 138°–144°、可见面积 9%–13% 和不允许 CSS 改写 width/height/transform 的门禁。素材/像素 4/4、landing 1/1、原生表面/最小包/原生主题相关回归 14/14 通过。
- 无头证据位于 `artifacts/test-runs/v15-native-surfaces-2026-07-25T04-49-40-653Z/`。capture 完成后 browser 已关闭，未打开第二个 Codex 窗口；真实 Codex 用户视觉验收仍待进行。

## 2026-07-25 — V15 sidebar / topbar 原生状态矩阵

- 只读复核当前 ASAR 的 `nav-list`、`worktree-init-row`、`task-row-status-indicator` 与 `spinner`，把 `aria-current`、disabled/aria-disabled、role/tabIndex/dataAttributes、未读 token、loading 分支和 24×24 spinner 纳入漂移合同。
- 五个顶部入口保持原生 DOM/文字/图标/30 px row；真实“外层行 + 主按钮 + 尾部菜单”结构进入 fixture。内部 section/project 操作按钮被显式排除，项目容器不会因内部控件被误画。
- 补齐 topbar 与 sidebar 的 default、hover、focus、open/selected、expanded/collapsed、disabled、unread/running。修复尾部菜单禁用误伤整行、折叠项目缺少 focus/press、浏览器白色矩形焦点框和 `data-state=active` 误当当前页。
- Windows forced-colors 回退提高到足以压过所有组合态的 `#root` specificity，强制移除位图、阴影和主题 opacity，恢复系统焦点轮廓与系统颜色。
- 定向结果：ASAR 合同 1/1、原生表面/状态/响应式/首次挂载/forced-colors 7/7、背景/最小包/原生主题相关回归 11/11。视觉证据为 `artifacts/test-runs/v15-native-surfaces-2026-07-25T04-30-21-640Z/`。
- 截图仅由无头 fixture 生成，browser 关闭后项目调试端口为 0；本轮没有打开第二个 Codex 窗口。Electron 下拉菜单本体不在 renderer DOM，当前只完成四个触发页签，真实 Codex 用户验收仍待进行。

## 2026-07-25 — V15 真实金箍棒 landing mark

- 否决第二版“通用暗金短棍”：虽然去掉亮红卡通色，但 56×56 下仍缺少《黑神话：悟空》的器物辨识度。
- 改用项目内真实金箍棒模型透明参考，保留深红棍身、对称兽纹端箍和旧金浮雕，在 4× 工作分辨率压缩、旋转后输出 112×112 透明 WebP；正式显示仍占官方 56×56 槽位，不新增徽章、墨尾、阴影、动画或网络请求。
- 新资源 `landing-jingubang.webp` 为 2,476 字节，纳入 `uiAssets`、主题变量和最小包；像素/alpha/体积、运行时恢复、原生主题和最小包定向门禁通过。
- headless 证据位于 `artifacts/test-runs/v15-native-surfaces-2026-07-25T03-06-59-584Z/`；本轮只标记技术与 fixture 视觉检查通过，真实 Codex 用户验收仍待完成。

## 2026-07-25 — V15 输入纸面统一暗化

- 用户要求输入框相关替换内容整体调暗，以适配战斗/风景背景和深墨侧栏。只读像素审计测得目标截图主纸面内区中位色约 `RGB(126,112,96)`，不再沿用上一轮约 `RGB(189,166,128)` 的亮黄纸。
- `build-ui-materials-v15.py` 从原透明合同源统一应用 `(-82,-69,-49)` 通道偏移与 `RGB(127,113,97)` matte，重新生成 main/strip/pill/tile；实际中位色落在 `RGB(125,109,92)` 至 `RGB(126,113,97)`，纹理方差与所有原尺寸保持。
- CSS fallback 统一为 `#7f7161`，主文字/图标收紧为深墨 `#100c08`；高亮内沿降强度并移除 composer 常驻 `filter`，避免额外合成成本。暗纹理第 10 百分位仍通过 3:1 定向对比度门槛，forced-colors 保持系统回退。
- 像素/纹理合同 3/3、原生几何/状态合同 6/6、最小包/原生主题合同 6/6 通过。无头证据位于 `artifacts/test-runs/v15-native-surfaces-2026-07-25T02-31-50-355Z/`；截图完成后显式关闭 browser，复核为 0 个项目 Node/Chromium 和 0 个项目监听端口。
- 本轮只完成用户要求的暗化检查点；金箍棒印记、侧栏后续状态和真实 Codex 用户验收没有混入或标记完成。

## 2026-07-25 — V15 生产 sidebar 锚点与原生几何检查点

- 把项目条、无项目对话和项目下对话的分类从测试假属性收口到当前 `ChatGPT.exe 26.715.2305.0` ASAR 的 `data-app-action-sidebar-project-row`、`data-app-action-sidebar-thread-row`、`data-app-action-sidebar-project-list-id` 与 `data-app-action-sidebar-section-heading="Tasks"`。
- 选中态读取生产 `data-app-action-sidebar-thread-active` / `aria-current`；项目展开与折叠读取 `aria-expanded` / `data-app-action-sidebar-project-collapsed`。属性变化由有限 attribute filter 触发刷新，不依赖窗口缩放，也不监听输入文字。
- fixture 删除旧 `data-project-row` / `data-sidebar-thread-row` 等假生产锚点；V15 定向测试证明一级/二级/选中材质对应正确，项目容器不会误用浅纸选中带。
- 原生表面门禁 6/6、ASAR/背景/最小包/主题合同 12/12 通过；测试后为 0 个项目 Node/Chromium 进程和 0 个项目监听端口。真实 Codex 视觉仍未验收，不标记整体完成。

## 2026-07-24 — V15 本机 ASAR 几何基线与小步推送策略

- 用户明确要求所有尺寸直接来自本机 `ChatGPT.exe` 内部 UI 数据。只读解析 `OpenAI.Codex 26.715.2305.0` 的 `app.asar`，锁定 spacing、toolbar、sidebar clamp、row、thread、composer editor/footer/button 与 radius token；fixture 改用这些源码值和当前 renderer 的 1.25 device scale。
- 新增 `native-asar-ui-contract`：直接读取已安装 ASAR，官方 token/class 漂移时 fail closed；生产主题不再从 736×98 审稿图反推 width/height/padding。
- V15 将用户最终三张输入器参考统一为一套纸面底纹，并把一级项目/无项目对话、二级项目对话、顶部原生入口和四个应用菜单映射到游记目录材质。当前只完成 headless 几何/状态门禁，未宣称实机视觉通过。
- 用户取消葫芦方案；当前目标、验收合同和设计均删除活动葫芦范围。两只 Hatch Pet 和最终非 PowerShell 随启随停继续排在视觉验收之后。
- 用户否决现有 56×56 卡通短棍；下一小里程碑重绘为暗金箍纹棍身与墨势残影，并单独 commit/push。
- 高难度目标改为多轮验收和高频远端检查点：每个独立模块通过针对性测试后精确暂存、提交、推送，不堆积多轮实现；用户未验收项不标记整体完成。
- 本轮 headless 截图完成后复核为 0 个项目 Chromium/Node 测试进程、0 个项目监听端口；没有打开或保留第二个 Codex 调试窗口，没有删除或移动文件。

## 2026-07-24 — Composer V9 原生几何纠偏与三案审稿

- V8 经独立几何和盲审复核后正式否决：fixture 固定 `736×96`、把 `overflow:hidden` 改成 `auto`，主题边框使 editor/footer 位移 1 px、可见宽度收窄 2 px，并使用非当前 Codex 的伪图标；其三案继续原位保留但不进入 runtime。
- 只读结合官方 composer 锚点与 Interface In Game 的黑神话 UI 归档重新归纳结构语汇：凝墨留白、短残纸选中带、朱点、器物断口优先于整圈金框、武器缩略图和发光 HUD。
- 新增 V9 三案：A“章回残墨”使用单向凝墨、短残纸与破边朱批；B“金箍锁锋”只把两道磨损金箍收进原 32 px 发送座；C“大圣翎影”以烟褐断口和双翎负形呼应大圣。三案只用于用户审稿，未写入 `runtime/forge-background-v13.css` 或最小包。
- 审稿覆盖 `736×98`、`560×98` 与 `154 px` 多行增长态；生产标准改为主题前后 host/editor/footer/五个按钮 DOMRect、原文字、ARIA、placeholder、overflow 与五点命中区全等，不再把任一高度写成生产常量。
- 定向脚本 `capture-and-verify-v9-20260724.mjs` 通过：3 案、2 宽、2 高，几何/文字/ARIA/命中区全等；零外部请求、零候选位图、零 timer、零 animation/filter，reduced-motion 与 forced-colors 回退均通过。
- 本轮仅启动无头 Playwright 截图，完成后立即关闭；复核为 0 个相关 Node/Chromium 进程、0 个监听端口残留，未打开第二个 Codex 调试窗口。旧 portrait-leaf 草稿、既有失败候选和全部用户素材均原位保留，未删除或移动。

## 2026-07-24 — V13.3 新建任务首帧修复与调试窗口即时回收

- 用户实机发现：首次启动只有背景，缩放窗口后题字和图案才出现；项目选择按钮的原生点状下划线会穿过替换题字；缺口金箍图案视觉不合格。
- 根因来自官方 hero 的 280 ms opacity 入场与延迟挂载。运行时现按布局识别淡入中的稳定节点，并监听 `game-source`、`home-icon` 与新建任务容器；另加 120/420 ms 两次有界启动探测，不形成常驻轮询。
- 主题激活时只隐藏 headline 内部原生文字、边框与下划线绘制，保留 DOM、项目选择热区和尺寸；停用后随主题样式移除恢复原生。
- 并行复核进一步复现 React 在入场动画后重写 `className`：旧 CSS 因依赖 `forge-landing-*` class 会再次消失，而 active probe 仍认为背景有效。V13.3 改以主题自有 data 属性承载题字/图案绘制；定向测试在启动探针结束后主动覆写两处 class，题字、图案和横线抑制仍成立，restore 后原生下划线与边框恢复。
- 56×56 图案撤销残缺金箍，重绘为带赤金箍纹的金箍棒与三道墨尾。定向新增“父级 opacity 0、节点延迟挂载、没有 resize”场景并通过；其余四项背景运行时场景分别定向通过。
- 用户追加资源纪律：常态不保留调试窗口；实机截图和指标采样后立即关闭，并验证 watcher、子进程与专用端口全部释放。长期记忆与 `docs/CURRENT_GOAL.md` 已同步。
- 一次性真实 Codex 首屏证据 `docs/screenshots/live-codex-v13-3-initial-20260724-0458.png` 证明无需 resize 即有题字/图案，原项目下划线消失；背景为 `cover`，侧栏 275 px、输入器 736×98，活动 runtime 标记 4 个。
- 同一临时实例稳态为 1 个已加载背景、0 个解码请求、无过渡，V8 heap 使用约 126.3 MiB。完整第二个 Codex 进程树稳定约 48 个进程/2.93 GiB 工作集，说明双窗口本身是主要风险；截图与采样后已关闭根进程、launcher、watcher 和滞后 GPU 子进程，21505 端口释放，控制窗口未触碰。
- 为后续调试补上 fail-closed 自动回收选项：普通截图仍只断开 CDP，不会关控制窗口；只有显式传入临时 root/launcher/disable request，且 `SystemInfo.getProcessInfo` 返回的 browser PID 精确匹配时，才触发原生恢复与 `Browser.close`，随后验证 root、owner 和端口释放。未重新开启调试窗口测试该选项，当前只通过 Node 语法与静态生命周期合同。
- 资源审查澄清：renderer 内 120/420 ms 启动探测是有界的，但开发期 watcher 仍有 1700 ms loopback 生命周期探测（实测约 51.8 MiB，launcher 约 115.1 MiB）。该链继续明确标注为临时审计工具；最终随 Codex 启停阶段必须移除 PowerShell launcher 与常驻 CDP 轮询。

## 2026-07-24 — V13.2 背景资源硬预算与会话资源清理

- 用户报告每轮主题调试可能因资源占用过大而崩溃，并要求先清理本项目会话资源、核对目标和进度，再继续视觉实现。
- 以父 PID、命令行、监听端口和内存独立核验：主题调试实例、watcher 与 45411 均已退出；随后关闭 37 个明确无用的重复 Playwright、Chrome DevTools、Context7、Serena 与空闲 Node REPL 根进程，共 98 个后代，清理前工作集约 4.36 GiB。Codex 主界面、renderer、GPU 与 app-server 未触碰。
- 11 张活动背景压缩共 2.45 MiB，全量 RGBA 展开约 84.76 MiB。旧 runtime 首次刷新会并发解码全部 11 张，并在淡变后长期保留两张全屏纹理、永久 `will-change`、滤镜与缩放。
- V13.2 删除全量预载，首屏不再创建额外 `Image`；切换只解码目标一张，任意时刻最多一个请求，新请求、超时、restore 和 dispose 都会清理 handler、timeout、`src` 与 in-flight 记录。
- 图层改存短 `var(--forge-bg-N)`；过渡结束清空退场层图片、veil 与场景数据。永久全屏 `will-change`、`filter` 和 `scale(1.001)` 已移除。
- 新增资源遥测：持图层数量、过渡状态和 in-flight 解码数。定向浏览器测试 4/4 通过，证明首屏 0 预载、请求上限 1、稳态 1 张、过渡最多 2 张、取消/restore 完整清理。
- 测试结束后无 Node、Chromium、watcher 或相关端口残留；用户自行打开的 Typora 文档窗口被识别为无关进程并保留。
- 新增 `docs/CURRENT_GOAL.md`，把用户历次补充形成的最终目标、顺序与不可违反约束固化为唯一执行基线。
- 全程未删除、移动或覆盖任何文件。

## 2026-07-24 — V13.1 全窗覆盖与新建页题字/图案

- 用户截图证明战斗背景只穿透侧栏，中央内容区仍被原生黑色 surface 遮住；问题不是素材尺寸或 `cover` 失效。
- 只读解包核对官方 `OpenAI.Codex 26.715.2305.0` renderer：`app-shell-CHGA5kyS.js` 创建 `main.main-surface`，官方 CSS 为其绘制实体背景，另有 `[data-app-shell-main-content-top-fade]`；`app-main-B98AP2a1.js` 暴露 56×56 `[data-testid="home-icon"]` 与 `[data-feature="game-source"]`。
- V13.1 只清除 main surface 与 top fade 的背景绘制，保留圆角、阴影、overflow、布局与 hit box；没有恢复侧栏、环境卡、消息、composer 或按钮主题样式。
- 新建页原位显示“此去，欲破何局？”，原 56×56 图标位改为缺口金箍、墨痕和朱点；原文字节点与 SVG 保留，停用时恢复 aria、class 与 dataset，不新增卡片、按钮、栏位或 emoji。
- 定向浏览器测试 3/3 通过：覆盖层 `cover`、主表面透明、820 ms 双层过渡、6+5 场景池、DOMRect/原文字节点不变、restore、forced-colors 与 refresh quiescence。
- 最终随 Codex 启动集成按用户要求移至全部视觉与宠物完成之后；现有 PowerShell bridge 继续只作开发调试入口，不再宣称最终方案。
- 本轮仍未删除、移动或覆盖任何文件；官方 app.asar/ChatGPT.exe/WindowsApps 仅只读。

## 2026-07-24 — V13 背景状态机、启动适配器与新动作录制

- 独立背景审计确认仓库 6 张战斗图与 5 张风景图均为不同 SHA，但本机受管目录仍停在 0.8.0；旧 V12 从未进入当前窗口。
- V13 保持“背景是唯一活动主题层”，修复隐藏旧对话误判、任意侧栏点击换图、负/损坏游标、ResizeObserver 自循环、覆盖层损坏、杨戬白场 veil 被覆盖、未解码切换及快速切换闪帧。
- 浏览器定向测试真实检查双层中点 opacity、820 ms 交叉淡变、6+5 独立轮换、overlay 自修复、refresh quiescence、reduced-motion 与 forced-colors，3/3 通过。
- 生命周期、最小包、保留安装和原生宠物门禁定向合同 18/18 通过；测试使用 Codex bundled Node，不依赖机器全局 Node。
- 新增安装后 `verify-launch-adapter.ps1`；普通 `ChatGPT.lnk` 与名称明确的 `ChatGPT - Wukong Theme.lnk` 必须指向同一 hash bridge 和同一 retained release，hook event 与 release marker 不一致即失败。
- 已追加安装 `0.12.0-20260724-012825`；旧普通入口先复制到 `C:\Users\Alex Chen\AppData\Local\WukongCodexForge\shortcut-backups\`，新 bridge 为 `chatgpt-entry-236e3ba177cff7b9db28.ps1`。安装后 verifier 返回 `verified:true`。
- 当前控制窗口 PID 9592 仍是无 CDP 参数的官方 AppX 原生实例，未关闭、未重启、未注入。V13 将在下一次从已验证的受管入口启动时加载；不声称能拦截 AppX/AUMID 等绕过入口。
- V7 composer 经独立视觉审计否决；V8 新增残卷墨界、石印绳契、丹炉铜契三个 `736×96`、零外扩、零控件位移预览及 battle/scenery 上下文证据，尚未进入 runtime。
- 用户提供新录制 `E:\GameRecord\Black Myth Wukong\新汇总\Replay 2026-07-24 00-30-17.mkv`，142,279,116 bytes，SHA-256 `FCC257977C4A34C2AB2813D018770DDE17CD5E5CBCE1941AC7E207965C92A7E5`。只读抽取仅用于跑动和背面棍花节奏；不从背面外推正面握法、夜叉套或神锋遮挡段。
- 全程未删除或移动任何本地文件；旧 release、快捷方式、候选、录制、游戏资源和失败证据均原位保留。

## 2026-07-23 — V12 背景收敛、输入框再设计与保留式升级

- 用户将正式活动范围收敛为背景替换；侧栏、顶部栏、环境信息、消息、按钮、滚动条与 composer 的 V11 样式全部退出活动 runtime，旧文件原样保留。
- 新增 V12 双固定背景层：6 张战斗图用于新建任务、5 张风景图用于对话，两池独立轮换、`cover` 全窗并以 820 ms 交叉淡变。
- 只读核对当前 `OpenAI.Codex 26.715.2305.0` app.asar，确认 composer 原生 surface、footer/测量节点和 Hatch Pet identity 由 discovery 目录名决定。
- 输入框 V1–V4 均被否决并原样保留：V4 把夜叉衣甲、护腕与神锋裁成极窄碎片后出现明显失真，不进入 runtime，停止“装备切片贴边”路线。
- 输入框 V5、V6 继续在 1× 盲审失败：V5 为泛用棱角面板；V6 的夜叉案读成宝石徽章、金箍棒案读成科幻状态条。两版仅保留审计证据，未进入 runtime。
- 修正元素落点合同：夜叉套与神锋由 Hatch Pet 小天命人完整表现，金箍棒由战斗背景完整表现；composer 不再同时堆三件道具，只承接游戏 UI 的形状与信息层级。
- 宠物首轮 row 1/2/4 候选通过图集验证但视觉不合格：小天命人跑动行换成不同 Q 版角色，小八戒持耙动作失真；候选保留且未写入 canonical。
- 小八戒 repair-v2 已形成独立候选：一手持完整九齿钉耙、一手捧腹，模仿“大笑奶龙”的前俯—后仰—肩腹弹起节奏；atlas SHA-256 为 `e553bf09e234bcaff67f43a2f3a2f6ae446a5abc70ddec322b7682edf0ca478a`，尚未写入 canonical。
- 小天命人 repair-v2 保持了同一角色身份，但跑动和棍花仍未达到游戏动作保真要求，继续否决；下一版改用用户本地录像连续帧和真实动作族名称建立相位图。
- 用户确认本地视频均不符合本次动作参考要求；已停止继续扫描、取帧和 repair-v3 生成，现有 contact 只作为失败/辅助记录，等待用户后续录制。
- 用户指出小天命人现有基础立绘的两个源头缺陷：兽棍·神锋缺少握持点后的后棍身/尾端，角色右腿与右脚缺少厌火魔足。该 base 及所有派生动作候选冻结，下一轮必须先重建完整基础角色。
- V12 为错误小天命人增加三重发布白名单：准备脚本不再读取旧 spec，最小包不再复制旧四文件，安装器不再处理该 ID；仓库文件和用户已有 discovery 目录全部保留，当前宠物选择不修改。
- 定向验证通过 18/18：最小包确认悟空四文件缺席，安装器只处理白名单小八戒，预置旧悟空 discovery 目录与 sentinel 字节级不变；生命周期与保留式合同继续通过。
- `D:\SteamLibrary\steamapps\common\BlackMythWukong` 与 `E:\GameRecord\Black Myth Wukong` 纳入只读素材范围；允许索引、hash、复制式抽帧和项目内新增派生物，禁止删除、移动或覆盖任意原文件。
- 本地夜叉资源只读审计确认 4 个 mod 为 UE Pak v11，可验证 `T_WuKong_YeChaWang_*` 索引与纹理族；本机无可信 FModel/umodel/UnrealPak/repak，未解包、未预览、未下载陌生工具，也未处理加密或 DRM。
- 官方来源重新分栏：黑神话官方微博“天命人·夜叉王厌火套 1/12”是厌火套主锚点；INART `Yaksha King 1/12` 是夜叉王 Boss 本体，不能作为天命人衣甲依据。此前混用结论全部作废。
- 修复稳定/便携 disable 判定、停止/恢复入口、install-phase 宠物注册与开始菜单 bridge reparse 防护。
- 宠物升级改为稳定 discovery 目录 + hash 版本 payload；current metadata 写前复制到唯一 history，旧 payload 和 metadata 不删除。
- 定向生命周期、保留式安装与原生宠物合同 16/16 通过；视觉候选仍以人工审查为门槛。

## 2026-07-20 — 大圣归来深度主题重构

- 判定旧版只达到“背景可显示与可恢复”的技术线，不满足深度视觉设计。
- 审查本地主题参考目录、现有 Studio/运行时、真实 ChatGPT 进程与 OpenAI.Codex 包。
- 从用户素材目录比较多张 1080p/1440p 候选，最终保留用户点名的 `大圣归来.jpg`：构图更适合新建页，且只有 78 KB。
- 建立“残卷入梦”双态视觉：landing 高显影、thread 低显影。
- 实现 schema v2、主题即时开关、MutationObserver 重标记、生命周期 watcher、受管启动器与快捷方式。
- schema/素材 7/7、生命周期 3/3、运行时状态 2/2、Studio E2E 与受管导入均通过。
- 修复无来源 renderer 访问 localStorage 的降级、switch 点击命中和 Studio 画布纵横比。
- 复审 landing/thread/运行时四张真实浏览器截图；双态差异、小行者空间关系和恢复边界成立。
- 待完成：精确 diff、commit、push，以及安装最终受管副本与开始菜单入口。
- 首个里程碑已提交并推送为 476c3bd；安装前复核发现旧安装器会复制整个开发仓库。
- 将受管安装收窄到运行时必需目录和 ws；受管导入与生命周期测试再次通过。
- 首次真实快捷方式安装暴露 Windows PowerShell 5.1 对无 BOM 中文脚本源码的错误解码；已按 state marker 精确卸载 3.46 MB 管理目录和乱码快捷方式。
- 快捷方式叶名改为 ASCII `ChatGPT - Wukong Theme.lnk`，并确认 scripts 全部 ASCII-safe；生命周期和受管导入复测通过。
- 用户收紧验收边界为“原生 Codex 页面只换主题”：删除运行时主题按钮、landing 标题卡、宠物状态气泡和 Studio 底部素材栏；CSS 不再覆盖宿主几何属性。
- 新增原生三栏 Codex fixture，主题前后逐槽比较坐标与尺寸，并断言 companion 关闭时 body 不增加任何受管节点。
- 新增 `install-theme.cmd` / `remove-theme.cmd`；安装默认创建受管入口，卸载即回归原生。
- 根据第二次视觉反馈，隐藏 Studio 最左侧整块主题参数编辑栏，画布改为全窗口；README 与 E2E 均以无编辑栏的主题页面为准。
- 根据第三次反馈，删除预览中的“主题状态 / RUNTIME”内容，将右栏改回 Codex 原生“环境信息”；同时移除悟字顶栏、启字按钮、定制落地标题和主题状态文案。
- 新增本地 `capture-live.mjs`，用于主题重启后通过回环 CDP 捕获真实 Codex renderer 与 Forge DOM 摘要；真实对话截图只写入忽略目录。
- 首次真实启动复核发现 Codex 内置 Chromium 150 会忽略默认用户数据目录上的远程调试参数，导致主题 watcher 无法接管 renderer；启动器改用受管隔离 profile，并明确不复制或读取原 Codex 凭据。
- 用户明确正式交付模型为“放入 Codex 对应位置即可使用”，因此终止 CDP/独立实例路线；核对本机 Codex 原生 `desktop.appearance*ChromeTheme` schema 后，将 0.3.0 重构为 `~/.codex/themes/wukong-codex-forge` 原生主题包。
- 原生主题只管理 accent、contrast、ink、surface、opaqueWindows、fonts 与 semanticColors；背景图、双页面状态和宠物没有原生字段，保留为预览素材并停止伪装成运行时能力。
- 新增按 TOML 键记录/恢复的安装引擎；卸载保留安装后用户再次修改的值，不回滚整份配置。移除 launcher、watcher、9222、独立 profile、开始菜单入口及全部 CDP 运行时代码。
- 用户真实窗口截图确认外观没有变化；进一步只读核对 Codex 26.715.2305.0 主进程，确认桌面外观只在启动时初始化，外部 `config.toml` 写入没有文件监听或公开热加载深链。
- 排除 `codex://codex-app/apply-config`：该入口只处理 `~/.codex/codex-app/config.json` 的 SSH/远程连接 schema，与 `desktop.appearance*` 无关。
- 安装/恢复脚本改为检测已运行的 ChatGPT 进程并输出明确的延迟生效警告；需求、设计、分工和运行时调查文档撤销“磁盘写入即视觉生效”的错误结论。
- 用户将验收标准明确提升为“样式替换而非颜色主题”：背景、新对话页、侧栏按钮、输入框必须出现全新视觉，同时严格保留原生三栏布局且不增加侧栏、底栏或主题按钮。
- 新增 V4 运行时样式层和当前 Codex DOM 标记器；采用“玄铁古卷 + 火漆烬金”，新对话高显影、对话中低显影，侧栏切角金/青玉侧刃与玄铁卷轴输入框均已实渲染。
- 新增动态状态与视觉定向测试；修复样式层覆盖输入框原生定位的问题，最终 2/2 通过并逐槽验证原生几何不变、清理后无受管节点残留。
- 用户否决暗系视觉后，将 V4 样式层改为“日照宣纸 + 暖金朱砂”：全局切换 light color-scheme，侧栏/顶栏/右栏采用浅米宣纸，正文用深墨，保留夕照截图的暖色主视觉。
- 新增工作区原生任务栏识别与浅色样式；新对话标题改为朱砂书卷字，输入框改为米白卷轴面，消息块采用浅金与青玉分层，仅代码块保留深色以维持可读性。
- 视觉测试增加双状态亮度下限和亮度差断言；landing/thread 实渲染均超过 155 平均亮度，2/2 定向测试通过且所有原生槽位坐标、尺寸不变。
- 用户确认背景方向、否决其余“通用浅色卡片”后，保留夕照背景并重做全部组件母题：朱砂签印侧栏、金箍棒横卷输入框、命簿碑刻消息与环境卡。
- 侧栏取消通用圆角卡，改为墨刷渐层、菱形签印、朱砂/青玉侧脊；新建任务使用朱砂端条与鎏金折角，项目选中态使用朱砂刷痕和碑帖字体。
- 输入框取消圆角白框，改为双金线、朱砂端箍、切角八边工具钮与红漆发送印；工作区任务栏增加朱砂/鎏金短尺分隔，消息、代码和右栏卡均采用非对称碑刻切角。
- 更新针对性视觉断言，以 `clip-path` 和零圆角锁定金箍横卷造型；两张实渲染复核及动态/恢复测试仍为 2/2 通过，原生布局几何未变化。
- 将 0.4.0 交付链恢复为受管运行时：明亮原生基线、0.3 暗色 state 原位升级、随机 loopback 端口、隔离 web profile、同生命周期 watcher、实时 restore request 与最小包构建。
- 新增最小包独立导入测试和真实 renderer 回环截图工具；包中不含 Git、docs、Studio 或测试，正式安装 39 个文件，约 0.36 MiB。
- 定向验证通过：原生主题升级/恢复 4/4、生命周期 2/2、最小包 1/1、动态/视觉 2/2；未运行无关 Studio 全量 E2E。
- 已将本机旧 0.3 安装原位升级到 `C:\Users\Alex Chen\.codex\themes\wukong-codex-forge`，创建 `Codex - Wukong Theme.lnk`；当前普通 Codex 按约束未被关闭或重启，真实生产截图待受管启动。
- 两个设计提交 `95ba968`、`7b97d0b` 已创建；GitHub 443 暂时不可达，远端仍停在 `fb38867`，结束前继续重试且不得误报已推送。
- 用户否决浅宣纸版并明确四项红线：采用《黑神话：悟空》配色与元素、输入框不得拉长、所有原生尺寸不变、助手回答无框且对话文字不得改写。
- V5 收敛为“烟墨残阳”：烟墨/石褐中明度基底，旧金圆相、金箍图标环、朱砂签印与暗铜横卷；保留用户背景和原生三栏，不新增 UI。
- 修正 fixture 将输入框从工作区铺宽改为原生 736 px 居中基线；注入前后逐项比较 composer、用户气泡、回答和代码块 DOMRect，并新增整段 `innerText` 零改写断言。
- 移除 turn 与 assistant 的主题卡片，回答背景、边框和阴影均为透明/none；用户样式只落到实际气泡，不再污染外层 anchor。
- 第一次定向测试发现用户气泡实边框导致 2 px 几何回归；改为不占布局的 inset 描边后 runtime 动态/视觉测试 2/2、原生主题测试 4/4 通过。
- 用户指出“烟墨残阳”仍沿用上一版切角框和金线骨架，判定不是完全重构；该版不再作为交付方案。
- 重新审计本地 `11891心猿.jpg`、`金箍.jpg`、`封面.png`，以游戏战绩页的放射盘、六点印记、无框墨幕和细线信息层级建立 V6“六根墨幕”。三张参考图不进入运行包。
- 删除逐项卡片、双金边、切角卷轴、碑刻回答框；新对话使用放射六根盘，侧栏使用无框列表和六点选中印，输入框使用单线棍势与石符按钮，右栏改为信息墨幕。
- V6 首次测试捕获 composer `position` 覆盖导致底部输入框上移；将伪元素棍线改为背景层并删除定位覆盖后，输入框恢复原生 736 px 与底部坐标，runtime 2/2 通过。
- 完全重构作为 0.5.0 里程碑发布；最小包测试新增 active theme 名称、五色 palette 与 `--forge-paper` 变量断言，防止源码已改而正式包仍携带旧主题。
- 提交 `716978d` 已成功推送到 `origin/main`；此前积压的四个本地提交也随本次 push 一并同步，远端不再停留在 `fb38867`。

## 2026-07-21 — 原生 UI 对齐、双模式重构与真实应用验收

- 按用户要求停止使用 Computer Use；只读解包 Codex 26.715.2305.0 的 `app.asar`，逐项建立菜单栏、侧栏、工具栏、composer、回答与环境卡的官方 DOM/CSS 基线。
- 将 fixture 重建为当前原生布局：36 px 菜单栏、275 px 左栏、46 px 任务工具栏、768/736 px 内容与输入框、300 px 浮动环境卡；移除伪造的固定第三栏。
- 重做 V5 注入边界：只装饰 `.composer-surface-chrome`，回答只命中真实 assistant 节点且保持无框；所有文字、宽高、定位和交互结构均由 Codex 原生 DOM 负责。
- 形成双模式：新建任务为战斗模式，主画面按杨戬与大圣优先轮换；进入线程后为风景模式，使用山门、古刹、峡谷、佛窟和夕照场景。
- 用户指定的新杨戬对决图替换旧杨戬背景；夜叉王、大圣与金箍棒进入战斗场景；夜叉套、神锋、金箍棒只作为侧栏、环境卡和 composer 的小尺寸高保真材质嵌片，不再手绘大图。
- 安装链改为 append-only release：每次创建新的 `releases/<version-timestamp>`，旧 app、state、配置备份、素材、研究副本和快捷方式全部保留；公开禁用入口只发恢复请求，不删除文件。
- 修正正式 renderer 地址：当前窗口为 `app://-/index.html`，旧白名单漏掉它是此前“安装却无变化”的关键原因。
- 定向测试通过：runtime states 3/3、preserving contract 2/2、managed package 1/1、native theme 4/4；PowerShell 三个公开脚本 AST 解析通过。
- 真实 ChatGPT.exe 热应用通过：landing 为 battle 场景 0；thread 为 scenery 场景 8；全窗 cover、侧栏 275 px、composer 736 × 98 px、环境卡 300 px、回答透明无框均从生产 DOM 实测确认。
- 真实截图与 JSON 摘要保留在 `docs/logs/live-codex-theme-0.7.0.*` 和 `docs/logs/live-codex-theme-thread-0.7.0.*`；不删除任何历史证据。

## 2026-07-21 — 0.8.0 潇湘双境、双同行者与便携闭环

- 用户最终否决夜叉套、兽棍·神锋和武器条作为组件元素；保留夜叉王战斗背景，停用两张装备 motif，原文件不删除。
- 三个并行只读审计分别复核素材质量、原生落点和下载/删除生命周期；确认首轮宠物候选成年感过重、八戒武器错误，且开始菜单快捷方式和全局 Node/`ws` 破坏“删目录即原生”。
- 使用图像生成工作流重绘小悟空 V2 与持九齿钉耙的小八戒 V2，去绿幕并编码成 512 × 512 透明 WebP；湘妃葫芦继续使用青绿双节透明 WebP。
- 视觉结构改为：侧栏与环境卡只换潇湘矿色材质；小悟空和小八戒只站在 composer 上沿外侧；葫芦只放 composer 旁空白沟槽，不在任何卡片内贴人物。
- 注入器升级到 V7；新增三项碰撞安全属性、正文/标题交叠检测、窄屏隐藏、resize/scroll/focus 合并刷新和完整恢复清理。
- 输入器仍为原生 736 × 98 px / 25 px 圆角，用户气泡只换不占布局的材质，助手回答所有祖先保持无框，提示词/回答文本不改。
- 新增 `start-theme.cmd` / `stop-theme.cmd`：profile、请求、事件和日志全部位于解压目录 `.wukong-runtime`；使用 Codex 包内 Node 24 与原生 WebSocket，不需要 npm 或全局 Node。
- 最小包只复制活动主题引用的 11 张 JPEG 和 3 张 WebP，不复制源 PNG、首轮候选、夜叉套、神锋、开发依赖或外部快捷方式；活动素材总计 2,728,584 bytes。
- 保留旧 `install.ps1` / `restore.ps1` 文件名，但它们先委托零删除入口并返回；破坏性旧实现作为不可执行块注释留存，满足历史内容保留与误执行防护。
- 定向夹具首轮暴露环境卡选择器和旧断言；修正后 runtime 5/5、便携/生命周期/主题 15/15 通过。完整生产窗口热应用、便携 ZIP、最终 commit/push 尚待本节后续记录。
- 否决 V2 泛化贴纸后，活动 motif 改为 `little-wukong-gameplay-v3.webp`、`little-bajie-gameplay-v3.webp` 与紧裁的 `xiangfei-gourd-icon.webp`；旧 PNG/WebP、中间绿幕和研究副本全部保留但不打包。
- 读取真实 26.715.2305.0 landing DOM 后加入 `[data-feature="game-source"]` / “我们该构建什么？”识别，并为侧栏路由增加两次有界延迟复核；新建任务与对话切换无需重新注入。
- 背景 data URL 从 `--forge-bg-*` / `--forge-art-*` 双份嵌入改为单份嵌入加变量别名；变量载荷从约 7.65M 字符降至 4,203,478 字符，真实窗口热应用实测约 1.03 秒。
- 真实 0.8.0 审计完成：landing `battle/scene 0`、thread `scenery/scene 8`；侧栏 275 px、composer 736 × 98 px、环境卡 300 px、助手无框，双同行者与湘妃葫芦位于 composer 外侧安全沟槽。

## 2026-07-21 — V9 正式发布闭环

- 将活动伴随素材最终锁定为小悟空 V6（76,266 bytes）、小八戒 V6（78,038 bytes）与湘妃葫芦 icon（10,650 bytes）；11 张背景与 3 张 WebP 总计 2,737,884 bytes。V2–V5、PNG 编辑源、夜叉套、神锋与旧葫芦全部保留但不打包。
- V9 组件改为无玻璃模糊的墨铁、石青、旧金与漆褐哑光材质；侧栏、输入器、环境卡保持 Codex 原生宽高、位置和圆角，assistant 继续透明无框，正文不改写。
- 页面运行时只观察关键 `childList` 新增/移除节点，排除 attribute、characterData、scroll、逐字 input 与 focus 监听；刷新以 650 ms 合并，watcher 以 1.7 s 廉价 probe 维持生命周期。
- 便携入口在独立 profile 上完成 start → V9 active → stop → V4–V9 全空原生闭环：测试根进程 17748、端口 45580；普通 Codex 根进程 9896 未被触碰。
- 启动器补充首次生效验证门控：随机端口可用后以 350 ms 间隔、最多 20 秒等待 renderer 接受完整主题，只有 `--apply` 回读成功后才记录 `watching`。
- append-only 正式 release `0.8.0-20260721-110648` 复用同一受管 Codex 根进程 40840、端口 41310 完成 native → V9 热切换；最终 thread 为 scenery/scene 8、landing 为 battle/scene 2。
- 最终可提交生产证据为 `docs/screenshots/live-codex-v9-final-thread.*` 与 `docs/screenshots/live-codex-v9-final-landing.*`；前者实测 assistant 透明背景、无阴影、0 px 圆角，二者均为 275 px 侧栏、736 × 98 px composer 与单层 cover 背景。带时间戳审计件继续保留在本地 `docs/logs/`。
- 定向验证：运行时/生命周期/打包/保留合同 17/17，原生主题与恢复 6/6，首次生效验证生命周期 7/7，最终最小包与保留式入口 4/4；未重跑无关 Studio 全量测试。
- 最终便携 ZIP：`release/wukong-codex-forge-0.8.0-portable-20260721-110324.zip`，33 个条目、2,735,754 bytes、SHA-256 `DE7C2F4D51D3E672C07120C4F554B3AE8242A01D694A52258F24FC0E868E67E3`；无 `node_modules`、docs、tmp、源 PNG、旧装备或停用候选。
- 本轮所有旧 release、失败启动日志、研究副本、截图和运行记录均原位保留，没有删除或移动任何文件。
- 最终活动素材收敛为 V6：`little-wukong-gameplay-v6.webp` 76,266 bytes、`little-bajie-gameplay-v6.webp` 78,038 bytes、`xiangfei-gourd-icon.webp` 10,650 bytes；11 张背景与三件伴随元素合计 2,737,884 bytes。夜叉套、兽棍·神锋与所有中间候选仍保留在仓库历史中，但活动定义和发布包零引用。
- V9 组件改为平涂墨铁、石青、旧金与漆褐，不再使用玻璃模糊、通用三色渐变或武器贴图；背景固定单层 `cover`，原生槽位、圆角、提示词和回答文本不变，助手回答保持无框。
- 页面监听收敛为 selector-filtered `childList` 结构变化，排除 attribute、characterData、scroll、input 与 focus 高频信号；刷新以 650 ms 合并节流。文档同步纠正此前“不安装 MutationObserver”的过度表述。
- 可移植真实生命周期闭环：独立 profile 根进程 17748 / 端口 45580 从 V9 `battle/landing` 生效，经 `stop-theme.cmd` 等价入口恢复到 style/class/mark/runtime 全零，再关闭精确 profile；普通 Codex 根进程 9896 未受影响。
- 正式启动器新增首次生效验证门控：随机端口可用后最多等待 20 秒、每 350 ms 复核一次，只有 `--apply` 已确认 V9 renderer state 才记录 `watching`。定向 lifecycle 契约 7/7 通过。
- append-only 最终本机发布为 `C:\Users\Alex Chen\.codex\themes\wukong-codex-forge\releases\0.8.0-20260721-110648\app`；复用同一受管 Codex 根进程 40840 / 端口 41310 完成“主题→原生→新发布主题”热切换，窗口保留供用户审计。
- 最终安装版实机证据为 `docs/screenshots/live-codex-v9-final-landing.png/.json` 与 `docs/screenshots/live-codex-v9-final-thread.png/.json`：2050 × 1106 视口、275 px 侧栏、736 × 98 px / 25 px composer、全窗 cover；战斗境 scene 2 与风景境 scene 8 均为 V9 active，三项安全位全部为 true。
- 定向自动验证：组合 fixture/视觉/生命周期/最小包/保留安装 17/17；原生主题与恢复 6/6；首次生效验证修改后 lifecycle 7/7。未重复运行无关 Studio 全量套件。
- 最终便携包为 `release\wukong-codex-forge-0.8.0-portable-20260721-110324.zip`，33 项、2,735,754 bytes、SHA-256 `DE7C2F4D51D3E672C07120C4F554B3AE8242A01D694A52258F24FC0E868E67E3`；禁用素材、PNG 源、V2–V5、`node_modules`、ws 候选、docs 与 tmp 均未打包。所有旧目录、旧 ZIP、旧发布、日志与素材原样保留，没有删除文件。

## 2026-07-21 — 0.8.0 最终安全门与发布更正

- `.gitignore` 增加 `.wukong-runtime/`、`tmp/` 与 `release/`，避免独立 profile、调试端口、研究中间件和本地 ZIP 被误提交；现有目录及其全部内容均原位保留。
- 启动器的重解析点拒绝范围增加主题包根目录；生命周期、最小包与保留安装定向测试 11/11 通过，Studio 脚本语法通过。Studio 下载测试改为唯一临时目录且不再删除导出文件。
- V6 来源说明明确为“实机画面作造型参考→图像生成绿幕中间件→本地色键去背、清边、紧裁与 WebP 压缩”，不再暗示来自官方模型导出。
- append-only 最终 release `0.8.0-20260721-113129` 复用根进程 40840 / 端口 41310，先验证 V4–V9 原生全空，再进入 V9 `battle/scene 0`、130 个标记；三件伴随元素安全位均为 true。视觉载荷与真实截图版 SHA-256 完全一致。
- 最终便携包更正为 `release\wukong-codex-forge-0.8.0-portable-20260721-113129.zip`，33 项、2,735,793 bytes、SHA-256 `BA38996C318521EC519C5B4686167AA65A2B4CD4F029E6DAE0AB9CD5DF5BB4DC`，禁用项 0。旧 ZIP、旧 release、失败日志与所有素材继续保留，没有覆盖、移动或删除文件。
- 本轮 23/23 项定向测试通过；提交 `9b5747c`（`feat: ship portable Wukong dual-scene theme`）已确认位于 `origin/main`。提交含 50 个精确路径、删除项为 0；本地未跟踪的历史截图、WebSocket 调研件和 V2–V5 素材继续原位保留。
- 精确提交 `9b5747c62911bde7e7e75d36e124e998f3c23029`（`feat: ship portable Wukong dual-scene theme`）已成功推送到 `origin/main`；本地工作日志继续按仓库约定忽略，不进入提交。

## 2026-07-21 — 0.9.0 V10 普通入口、独立同行者与场景色板

- 三个并行只读子对话审计启动生命周期、宠物/色板架构与测试缺口；主对话统一修改共享工作树。
- 使用 imagegen 按高保真游戏参考重新生成小悟空与持九齿钉耙的小八戒，保留品红色键源、透明 PNG 与活动 WebP 三层资产；旧 V2–V6 和所有失败候选继续原位保留。
- schema 升级到 v3、运行时升级到 V10；11 张背景分别携带完整 chrome tone，切换场景同步更新正文、topbar、sidebar、composer、环境卡、用户气泡、代码块、菜单与 veil。
- 将小悟空、小八戒和湘妃葫芦迁移到 body 直属的 inert / aria-hidden / pointer-events-none 固定覆盖层；宠物站工作区底边两侧，葫芦可位于 landing 主视觉、环境卡脚部或工作区上缘，不改变任何原生槽位。
- 真实发现旧快捷方式 Arguments 被截断到 1023 字符；失败版哈希和官方原版均备份。V10 改为内容哈希命名的 append-only 桥接脚本，快捷方式参数降到 178 字符，主题根缺失时动态回退官方原生启动。
- 普通 `ChatGPT.lnk` 成功启动独立主题进程 PID 26812 / CDP 38625；首启又暴露 DevTools 端口先写文件、端点稍后监听的竞态，事件 `not-running` 原样保留。为 `--verify` 增加 20 秒有界重试后，同一进程安全重连，watcher PID 18296 进入 `watching`。
- 真实 landing 审计为 V10 battle/scene 0，thread 为 scenery/scene 8；两页均是 2050 × 1106、侧栏 275 px、composer 736 × 98、背景 cover。thread 环境卡 300 × 473，assistant 透明无框；三项伴随元素安全位为 true。
- 生产证据新增 `docs/screenshots/live-codex-v10-autostart-landing.*` 与 `live-codex-v10-autostart-thread.*`。运行时、视觉、场景色板、生命周期、保留合同和最小包定向回归 24/24 通过。
- 推送前完整验证通过：原生定义 valid、全部测试 25/25；打包目录的四个 PowerShell 入口 AST 解析 0 错误，独立 V10 载荷导入成功。
- 第一次 `Compress-Archive -LiteralPath <stage>\*` 因参数语义失败，没有生成 ZIP；stage 保留。最终 0.9.0 包为 `release\wukong-codex-forge-0.9.0-portable-20260721-183530-7655056.zip`，35 项、2,931,727 bytes、SHA-256 `E0A1F1E25184CC50DCC1003B4D3D3C022154DADE128738DF612594F0BD8274D3`；禁用项与缺失项均为 0。
- 发布后 fresh-profile 实启暴露 PowerShell 5.1 native stderr 终止语义：renderer 未就绪的正常重试错误被 `ErrorActionPreference=Stop` 提前终止。失败 stage、profile、stdout/stderr 和首个 ZIP 全部保留；launch 的 verify/apply loop 改为单次 native 调用期间临时 `Continue`、捕获 exit code 后恢复 `Stop`，等待与超时边界不变。
- 第二个唯一包的隐藏 PowerShell 5.1 子进程未自动加载 `Get-FileHash` 模块，入口在写快捷方式事件时终止；该包、stage、profile 和日志全部保留。hook 改为 `[IO.File]::OpenRead` + `.NET SHA256` 的自包含只读哈希函数，移除模块自动加载依赖。
- 第三个唯一包 `release\wukong-codex-forge-0.9.0-portable-20260721-185413-8390691.zip` 完成 fresh-profile 真启动：35 项、2,932,159 bytes、SHA-256 `BCF9F9E7C7F9B8C7490ED3ECFFF576966A76AE5FC46BC7A8C8AF6F53A07FC697`；根 PID 45072、端口 34661、watcher PID 46940，事件 `starting → watching`，隐藏启动 stderr 0 bytes。
- 最终包生产 renderer 为 V10 battle/scene 0、128 个受管标记、三项安全位 true；2050 × 1106、sidebar 275 px、composer 736 × 98、背景 cover。证据为 `docs/screenshots/live-codex-v10-release-fresh-profile-landing.*`，窗口保留供用户审计。
- 继续只读审计官方 26.715.2305.0 主进程：Windows `window-all-closed` 不退出应用，二次激活通过 `requestSingleInstanceLock` / `second-instance` 和 `CODEX_ELECTRON_USER_DATA_PATH` 路由。V10 watcher 因此改为无 Codex renderer 连续约 13.6 秒后自行停止；隐藏窗口仍保留 renderer 时复用原 watcher，renderer 已消失时才由 launcher 重建，不强制结束进程。
- 真机正常关窗证明隐藏原生窗口可继续持有 renderer，且 DOM visibility 会误报 visible。启动桥接改为同一 `CODEX_ELECTRON_USER_DATA_PATH` + 同一 `--user-data-dir` + `codex://launch`，并以受管根 PID 的 `MainWindowHandle` 验收；6 秒未复显重试一次，仍失败返回非零。Win32 操控候选未进入正式包，文件按零删除约束保留。

## 2026-07-22 — 0.10.0 V11 原生 Hatch Pet 与组件深度重构

- 按用户最终参考重做两个原生 Codex v2 Hatch Pet：小八戒使用 INART 1/12 的幼态脸、旧青衣、念珠与完整九齿钉耙；小悟空使用游科官方天命人厌火夜叉套 1/12 造型与兽棍·神锋。两者均为 1536 × 2288、8 × 11、RGBA WebP，覆盖 9 个标准动作行和 16 个顺时针方向。
- 小八戒最终图集 SHA-256 为 `511BC2B8CA7C197407AB8E3BE194AAA5F2036428C05FDCB811400525005C2277`；小悟空最终图集 SHA-256 为 `018C3447368C23F963335710CA09086EFD634B2826B2913A920F3960E3D77D87`。两套图集均通过透明残留、动作、方向盲审和武器结构审计；小八戒全部方向的钉耙均为九齿。
- 主题进入 V11：移除页面小悟空/小八戒静态 overlay，只保留无交互湘妃葫芦；侧栏按钮、输入器、发送键和环境卡改用经匣、朱砂签、短轨与典籍匣角造型。原生三栏、槽位坐标、736 × 98 px 输入器、文案和助手无框合同不变。
- 11 张背景继续使用唯一固定 `cover` 层；每张画面独立适配正文、侧栏、顶栏、输入器、用户气泡、代码块、环境卡和遮罩。新建任务为杨戬/大圣优先的战斗境，进入对话为风景境。
- 只读复核官方宠物 loader 后修正发现链：顶层使用可被 `Dirent.isDirectory()` 识别的真实目录，内部 `payload` junction 指向保留的主题宠物包，派生 manifest 指向 `payload/spritesheet.webp`。首次安装不复制图集、不需要管理员；早期直接副本只迁移活动 manifest，原 manifest 与 atlas 全部原位保留。
- 真实 Codex “宠物”设置页识别两个自定义包；小八戒与小悟空均在官方 `avatar-overlay` 窗口完成实际加载。主题实机仍为单层全窗背景、275 px 侧栏、736 × 98 px 输入器与无框回答。
- 最终定向回归 32/32 通过，覆盖宠物包、官方发现链接器、注入、视觉、11 场景色板、生命周期、保留式安装、最小包与原生恢复。
- 最终便携 ZIP 为 `release\wukong-codex-forge-0.10.0-portable-20260722-123609-0afe4b0.zip`，42 项、6,790,345 bytes、SHA-256 `25196E65C39AC2176AB63FC856C643ACAEF201736157931801FE8BBBAB6F4513`；开发目录、测试、调研件与运行状态均未打包。唯一 stage、所有候选、失败证据、旧版本和已安装旧副本全部保留，未删除或移动文件。
# 2026-07-25 — 双宠物 canonical 重建起点

- 按 Hatch Pet v2 规范建立两个全新、互不覆盖的 run：`little-wukong-v5-yaksha-shenfeng-canonical-rebuild-20260725` 与 `little-bajie-v4-inart-game-motion`；旧 run、旧 atlas 和全部失败稿原位保留。
- 小天命人 source lock 把神锋拆成兽首前端、连接箍、前棍身、握持段、后棍身、尾端连续链，并逐侧锁定两腿双足；任何一项缺失都禁止进入 canonical。
- 小八戒 source lock 锁定成年矮壮猪妖骨相、低饱和旧青衣和“长柄 + 尾鐏 + 旧铜横梁 + 恰好九枚分离弯齿”的完整钉耙。
- 两个 run 均只开放 `base`。装备和持握均不对称，因此所有最终像素动作禁止镜像；左右跑必须独立生成。
- 输入纸面暗色里程碑复验：材质 4/4、原生几何/状态/最小包 9/9，通过；当前实渲染纸面中位色 `RGB(127,113,97)`，与用户暗色参考 `RGB(124,110,94)` 相差约 3 个灰阶，无常驻滤镜。
- 小天命人 base 候选通过本地白名单：两侧魔足正确，唯一神锋从兽首至尾端连续完整；192×208 留白为 29/17/29/16 px，绿键残留 0。
- 小八戒先保留狼脸失败稿，再完成成年猪妖骨相与机灵笑容修复；唯一九齿钉耙的长柄、尾鐏、旧铜横梁和九枚独立弯齿全部完整，原生单元留白为 18/32/18/32 px，洋红键残留 0。
- 两只 base 均只进入 `INTERNAL_PASS / USER_PENDING`，没有写入 canonical、生成动作或安装。
