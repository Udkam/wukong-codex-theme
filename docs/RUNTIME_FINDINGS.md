# Codex 样式运行时调查

> **2026-07-23 V12 当前结论。** V11 及更早调查继续保留为历史。

## V12 官方 UI 与背景运行时

- 只读检查当前 `OpenAI.Codex 26.715.2305.0` 的 `app.asar`：composer 实体仍为 `.composer-surface-chrome`；多行布局使用原生 `--composer-border-radius: var(--radius-3xl)`，footer 由容器查询调整，隐藏测量节点可能产生越界。候选必须围绕这些原生节点工作，而不是重建一个伪 composer。
- 官方 Hatch Pet loader 返回 `id: custom:${directoryName}`；`pet.json.id` 只参与显示回退，不决定持久 identity。因此升级必须保持 `${petId}-wukong-forge` discovery 目录名稳定。
- 当前普通开始菜单 `ChatGPT.lnk` 仍指向旧 0.9.0 Temp bridge，保留 release 最高仍为 0.8.0。只有安装本轮 0.11.0 后，普通入口才会加载 V12；当前控制窗口不被强制关闭或重写。
- V12 runtime 使用双背景层，不再对 sidebar/composer/right card 等节点注入活动样式。旧 mark classes 只用于彻底清除历史标记并验证回归。
- 战斗池与风景池分别保存 cursor；landing/thread 状态只切换场景池，不因标题流式变化重新选图。
- 游戏安装目录当前以签名 PAK 为主，没有可直接读取的松散角色贴图或动画视频；本轮不修改 PAK、不替换游戏文件、不绕过加密。真实跑动与棍花动作优先从用户自有录像复制式抽帧，原录像保持不变。

## 保留式安装新结论

- 宠物 atlas 升级用 `payload-<atlasSha256前16位>` 新建内部 junction，既有 payload 不删除、不改指向。
- 变更当前 manifest/validation/proof 前，先将三者逐字节复制到唯一 `history/<timestamp>-<hash>-<guid>`；旧 metadata 与 payload 均可追溯。
- `stop-theme.cmd` 和 `remove-theme.cmd` 不再硬编码 `-Portable`；`disable.ps1` 根据 release marker 自动识别稳定/便携路径。
- retained install 在发布 release 后执行同一 release 内的原生宠物安装器；开始菜单 bridge 和其 backup/history/adapter root 新增 reparse-point fail-closed 检查。
- 本轮新增全局资源纪律：`E:\GameRecord\Black Myth Wukong`、`D:\SteamLibrary\steamapps\common\BlackMythWukong` 和所有旧候选只允许读、索引与复制；任何实现脚本都不得把这些目录作为删除、移动或覆盖目标。

> **2026-07-22 V11 当前结论。** 下方 V10、V9 调查作为历史保留。

## V11 DOM 与视觉修正

- 运行时探针统一升级为 V11；watcher 默认探针不再误留 V10，避免已注入页面被当作旧状态反复处理。
- sidebar 标记提升到完整左侧面板；composer 只从编辑器自身的 `[data-thread-find-composer=true]` 向内选实体，不把旁边的搜索/假编辑器误标为输入器。
- 环境信息卡优先按“环境信息 / Environment”标题寻找最小包含卡片，再标记真实标题与直接行；不再命中外层右侧宿主。
- 取消全局 button 扫描，只主题化 topbar、任务栏、侧栏、composer 和环境卡中的已知按钮，避免把正文或插件按钮误染色。
- 场景稳定键从 `pathname + document.title` 收敛为 `pathname + hash`，流式标题不再触发背景跳变。
- 运行时页面只保留一个湘妃葫芦 motif；旧静态悟空/八戒层仅在升级/恢复路径中作为历史清理对象。两只角色交由 Codex 原生 Hatch Pet v2 包。

## V11 fixture 证据

`docs/screenshots/runtime-v11-fixture-v2-landing.png` 与 `runtime-v11-fixture-v2-thread.png` 来自同一套生产 DOM 形态 fixture。记录 JSON 表明 sidebar 275 px、composer 736×96、环境卡 300×213.296875、assistant 祖先透明无框、控制台错误为空。背景为单一固定 `cover` 层。

## V11 原生宠物发现与实机证据

- 只读提取的官方 26.715.2305.0 加载器先对 `%CODEX_HOME%\pets` 执行 `readdir(...,{withFileTypes:true})`，再只保留 `Dirent.isDirectory()`。因此整个宠物目录的 junction 虽可读取，仍会被列表过滤。
- 同一加载器将 `spritesheetPath` 与宠物目录进行 `resolve/relative` 词法范围检查，再读取图集；目录内部的 `payload/spritesheet.webp` 可以通过检查并经 NTFS junction 解析到保留主题包。
- V11 安装器据此使用顶层真目录、内部 payload junction 与派生 manifest。隔离证明、三次复用、早期直接副本保留式迁移、冲突 fail-closed 均由 `tests/native-pets-contract.test.mjs` 覆盖。
- 当前调试实例端口 57508 的官方宠物页刷新后同时显示“小八戒”和“小悟空·厌火夜叉”；主窗口证据为 `live-codex-v11-native-pets-linked-payload-main-20260722.png`。两者均能进入官方 avatar overlay；实际 sprite computed style 为 `background-size:800% 1100%`，与 Hatch Pet v2 8×11 图集一致。
- 真实 V11 主窗口为 2050×1106、sidebar 275 px、style 3,477,222 字符、68 个 landing 受管标记；`live-codex-v11-native-pets-initial-20260722.png.json` 同时证明背景、原生几何与 assistant 无框。宠物页截图有 24 个标记，因为设置页不含 composer 和环境卡。

> **2026-07-21 V10 当前结论。** 下方 V9 调查继续保留为路线证据。

## 普通入口重启失效的根因与修复

重启后的普通 Codex 根进程由 Explorer 直接启动，没有 `--remote-debugging-*`、隔离 profile、主题 watcher、启动项或服务，因此 V9 只存在于此前受管 renderer，重启后不会自动恢复。安全路线不能把 CSS 复制到正在运行且没有调试通道的 renderer；也不能在不修改官方包、IFEO、DLL 或系统服务的前提下拦截所有可能入口。

本轮将用户开始菜单的普通 `ChatGPT.lnk` 作为默认入口。第一次实现把完整 `-EncodedCommand` 写进快捷方式，真实读取发现 WScript 将 Arguments 截断为 **1023** 字符，脚本中断在变量名中间。该失败入口哈希为 `0C9A89D6E19541DDEBFDE2095CE57D4C8A0CC01AC1638A5E878AD3D0534841D5`，已保留在 `history\shortcut-backups`；官方原始快捷方式哈希 `D2E3ACB487C7D1BC03282D4FDBA4A93DB24BA749274307D7D158358B89B60C6C` 也仍保留。

V10 把完整逻辑写入按内容哈希命名的版本化桥接脚本，`.lnk` 只使用 178 字符 `-File` 参数，并在安装时拒绝达到 900 字符的参数。桥接脚本不在下载主题根内：根存在时调用主题启动器，根缺失时动态 `Get-AppxPackage OpenAI.Codex` 并启动官方 `ChatGPT.exe`。已有桥接文件内容不覆盖；哈希冲突时创建带时间戳的新文件。每次改变快捷方式前先复制当前 `.lnk`，没有删除或移动。

第二个真实问题是 Electron 写出 `DevToolsActivePort` 后，回环 HTTP 端点仍可能短暂拒绝首个连接。原启动器立即 `--verify`，导致健康窗口被记录成 `not-running`。V10 对回环验证增加 20 秒、250 ms 间隔的有界重试；renderer `--apply` 仍保留 20 秒、350 ms 间隔重试。

正式便携包 fresh-profile 验收进一步发现 Windows PowerShell 5.1 会把 native stderr 包装为 `ErrorRecord`；在全局 `ErrorActionPreference=Stop` 下，renderer 尚未出现时 `injector` 的预期 stderr 会提前终止脚本，使上述重试形同虚设。两段 readiness loop 现仅在单次 native 调用期间临时使用 `Continue`，同时捕获 stdout/stderr 和 `$LASTEXITCODE`，调用后立即恢复 `Stop`。失败输出仍进入最终超时信息，非 readiness 阶段的脚本错误仍然 fail-closed。

第二次 fresh-profile 包验证发现隐藏 PowerShell 5.1 子进程未自动加载 `Get-FileHash` 所属模块，快捷方式已保存但写审计事件时终止。V10 入口不再依赖该 cmdlet：`Get-PortableSha256` 以 `[IO.File]::OpenRead` 和 `[Security.Cryptography.SHA256]::Create()` 只读计算哈希，并在 `finally` 释放 stream/algorithm。这样快捷方式安装只依赖 PowerShell 5.1 核心 .NET 类型。

## V10 普通快捷方式实测

- 快捷方式目标：系统 PowerShell；Arguments 长度 178。
- 受管 `ChatGPT.exe`：PID 26812，命令行包含随机端口与 `E:\Proj\wukong-codex-forge\.wukong-runtime\profile`。
- CDP：`127.0.0.1:38625`；watcher：PID 18296。
- 事件：首次暴露启动竞态的 `not-running` 记录原样保留；修复后同一进程安全重连，记录 `reattaching` → `watching`。
- landing：V10 `battle/scene 0`、sidebar 275 px、composer 736 × 98、背景 cover、三件伴随元素安全。
- thread：V10 `scenery/scene 8`、同尺寸 composer、环境卡 300 × 473、assistant 透明无框；葫芦从 landing 主视觉左侧改放环境卡脚部。

主题实例继续留在本机供用户审计。直接 WindowsApps 可执行文件、Store AUMID、协议或第三方自建入口仍会绕过适配器；这是稳定性与官方零写入边界，不伪装成“全系统注入”。

## 最终包 fresh-profile 实测

静态打包测试不能替代一个从未出现过 `DevToolsActivePort` 的全新 profile。最终推荐包因此从唯一临时目录启动，取得根 PID 45072、端口 34661 和 watcher PID 46940；事件顺序为 `starting` 后约 3.9 秒进入 `watching`，重试期间 PowerShell stderr 文件保持 0 bytes。生产 renderer 回读 V10 active、128 个受管标记、独立 overlay 存在、三项安全位 true；2050 × 1106 真实截图仍保持 sidebar 275 px、composer 736 × 98、背景 cover 和三件独立伴随元素。该实例与旧诊断实例并存，没有结束任何进程。

## 官方 Windows 生命周期补充

只读抽取 26.715.2305.0 的 `.vite/build/bootstrap-*`、`main-*` 与 `window-all-closed-*` 后确认：Windows 的 `window-all-closed` handler 不调用 `app.quit()`；所有窗口关闭后主进程和托盘可以继续存在。二次实例由 `requestSingleInstanceLock` / `second-instance` 接收参数，进入 `queueSecondInstanceArgs`，主窗口管理器随后 restore/show/focus。审计副本位于被忽略且保留的 `.wukong-runtime/research/chatgpt-ui-26.715.2305.0-20260721-1841`，官方包零写入。

因此 V10 不把“窗口不可见”伪报为“`ChatGPT.exe` 已退出”。watcher 连续 8 个 1.7 秒周期找不到 Codex renderer 后自行结束并释放启动 mutex；窗口仅被隐藏但 renderer 保留时，原 watcher 继续绑定。再次点击 ChatGPT 时，adapter 设置相同 `CODEX_ELECTRON_USER_DATA_PATH`，同时传相同 `--user-data-dir` 与官方 `codex://launch`，命中正确 profile 的 `second-instance`。实测 DOM visibility 在原生窗口隐藏时仍为 visible，因此成功条件改为受管根 PID 的 `MainWindowHandle`；首次 6 秒未复显会重试一次，仍失败明确返回非零。没有使用 `ShowWindowAsync`、`SetForegroundWindow`、`Stop-Process`、`taskkill`、IFEO、DLL 注入或 WindowsApps 修改。

## 结论

Windows Codex 26.715.2305.0 的原生 Chrome Theme 只能表达颜色、字体和语义色，不能表达背景图、组件切角或 landing/thread 状态。外部修改 `config.toml` 也不会让已打开窗口热加载。因此“深度样式替换”需要受控运行时 CSS；只放置原生主题文件只能得到用户已否决的颜色变化。

## 已确认的本机边界

1. `desktop.appearance*ChromeTheme` 支持 accent、contrast、ink、surface、opaqueWindows、fonts 和 semanticColors，不支持 backgroundImage/customCss/companion。
2. `codex://codex-app/apply-config` 只处理远程连接配置，不刷新桌面外观。
3. 当前主进程没有对外部 `config.toml` 写入的外观 watcher。
4. 已安装 Chromium 150 会忽略默认用户数据目录上的远程调试参数；受管隔离 profile 可建立随机回环调试通道。
5. 当前生产 renderer 暴露 conversation/composer/message/new-chat 数据属性，可避免依赖哈希 class。

## 路线比较

| 路线 | 背景/组件样式 | 当前窗口热清理 | 风险结论 |
| --- | --- | --- | --- |
| 只写原生配置 | 否，只能换色 | 否 | 稳定但不满足需求 |
| 修改 `app.asar`/WindowsApps | 是 | 需重启 | 破坏签名与更新，不采用 |
| 任意进程注入 | 是 | 理论可行 | 崩溃与安全风险高，不采用 |
| 目录内随机回环 CSS | 是 | 是 | 官方文件零写入，可验证清理，当前采用 |

## 为什么需要主题入口

已经运行的普通 Codex 没有调试通道，外部文件复制无法取得 renderer。强行补丁官方包与“使用成本最优、不得导致崩溃”的要求冲突。0.8.0 因此使用包内 `start.cmd`：它启动官方 `ChatGPT.exe`，为 Chromium web 数据使用解压目录内 `.wukong-runtime\profile`，并把调试端口限制在 `127.0.0.1` 的随机端口。没有开始菜单快捷方式、系统服务或开机项。

watcher 默认只接受 `app://codex/` 或标题为 Codex 的精确 `app://-/index.html` renderer；localhost 仅在显式开发开关下允许。调试协议 URL 必须是 loopback。它使用 Codex 包内 Node 24 和仅依赖 Node 核心模块的原始协议客户端，不携带 `node_modules`、第三方 WebSocket 包或运行时 npm 依赖。它检查 V9 style/runtime probe，缺失时才重新注入；Codex 退出后结束。停用请求先触发 `RESTORE_EXPRESSION`，随后重新读取 renderer state；style、class、标记、状态属性和 V4–V9 runtime 全部清空后才确认成功。

Chromium 的随机调试端口可能早于首个 Codex 页面 target 可用。启动器因此在端口验证后提供最多 20 秒、每 350 ms 一次的有界首次生效复核；只有 `--apply` 已读取 V9 state 并确认完整主题生效，才记录 `watching` 并进入低频 watcher。这个门槛避免“窗口已开但主题尚未进入 renderer”的假成功。

V9 页面运行时只安装一个 `childList` 结构观察器，忽略属性、文字、滚动、逐字输入和焦点变化；只有新增/移除节点命中对话、输入器或浮层选择器时才进入刷新调度。侧栏/提交动作与窗口尺寸变化同样走至少 650 ms 的合并节流，提交与导航只安排有限次复核。这避免长任务的逐字流式变化把页面扫描变成常驻负载，同时仍能识别新出现的原生对话结构。

## 真实验收边界

- TOML、state、包结构和 fixture 自动测试只能证明交付契约。
- 两张 `runtime-style-*.png` 是生产 DOM 形态 fixture，不是当前 Codex 窗口。
- 历史阶段的普通 Codex 进程没有被重启；下方 2026-07-21 复核已用独立受管实例完成生产视觉认证。
- 大版本更新若改变数据属性或多窗口结构，必须重新执行真实截图审计；几何 fallback 不是无限兼容承诺。

## 2026-07-21 生产 UI 与热应用复核

本轮只读检查了已安装包
`C:\Program Files\WindowsApps\OpenAI.Codex_26.715.2305.0_x64__2p2nqsd0c76g0\app\resources\app.asar`，
并将选定 UI 文件的只读解包副本保留在
`E:\Proj\wukong-codex-forge\tmp\codex-ui-audit-20260721-082644`。
没有改写 WindowsApps、`app.asar`、`ChatGPT.exe` 或官方快捷方式。

从官方 CSS 与真实 DOM 得到的当前基线如下：

- 应用菜单栏 36 px；任务工具栏 46 px。
- 左侧原生面板默认 275 px，官方约束为 240–520 px。
- 对话内容最大宽度 48 rem，左右各 16 px 内边距；当前输入框实测 736 × 98 px、25 px 圆角。
- 环境信息是 300 px 浮动卡片，不是固定第三栏。
- 助手最终回答节点为 `[data-local-conversation-final-assistant]`，原生没有消息框。
- composer 外层定位锚点是 `[data-thread-find-composer="true"]`，实际可着色表面是 `.composer-surface-chrome`。

真实生产 renderer 的当前 URL 是 `app://-/index.html`，不是早期调查中的
`app://codex/`。旧目标白名单因此会漏掉真实窗口；`runtime/cdp-client.mjs`
已改为只接受 `type=page`、标题 `Codex` 且 URL 为当前精确地址或已知官方地址。

在保留普通 Codex 的同时，最终便携实例通过当次随机回环端口 18982 完成热应用：

- landing：`surface=landing`、`mode=battle`、场景 0、131 个含根样式类的受管元素；标题来自当前生产节点 `[data-feature="game-source"]`。
- thread：`surface=thread`、`mode=scenery`、场景 8、386 个含根样式类的受管元素；助手回答 computed style 为透明背景、无阴影、0 px 圆角。
- 全窗背景：`body::before` 实测 `position:fixed; inset:0; background-size:cover`，覆盖 2050 × 1106 视口。
- 两种页面实测均为侧栏 275 px、composer 736 × 98 px；thread 右侧浮层宿主 316 px，其中包含官方 300 px 环境卡。
- 0.8.0 最终安装版真实截图保留在 `docs/screenshots/live-codex-v9-installed-landing.png` 与包含对话正文的 `docs/screenshots/live-codex-v9-installed-thread-content.png`，对应 JSON 记录同名状态、几何与 computed style；它们来自 append-only 正式发布 `0.8.0-20260721-105715`，不把 fixture 冒充生产结果。
- 11 张背景只编码一次，主题变量为 3,654,150 字符，完整 style 为 3,670,925 字符。
- 同一 renderer、同一 landing 页分别稳定 3 秒后采样 6 秒：原生约 3.90% 单核，V9 主题约 1.82% 单核。该差值处于系统调度噪声内，没有测得主题常驻增量；冷启动与正在运行的长任务页面曾短时占用较高，不能归因给主题。

因此本节取代上文“生产视觉认证仍待完成”的历史状态；上文保留用于解释路线演变。

真实截图复核使用 append-only release `0.8.0-20260721-110648`。受管窗口根进程 40840 在端口 41310 上先热恢复到 V4–V9 全空的原生状态，再由该 release 复用同一进程；启动事件只在 `--apply` 回读 V9 成功后记录 `watching`。thread 为 `scenery/scene 8`、468 个受管标记，assistant computed style 为透明背景、无阴影、0 px 圆角；随后 landing 为 `battle/scene 2`、131 个标记。两页都保持 275 px 侧栏与 736 × 98 px composer，背景为单层 embedded JPEG 且 `background-size: cover`。可提交证据为 `docs/screenshots/live-codex-v9-final-thread.*` 与 `docs/screenshots/live-codex-v9-final-landing.*`；带时间戳审计件继续保留在本地 `docs/logs/`。

最终交付 release 为 `0.8.0-20260721-113129`。它与上述截图版的 `forge-theme.css`、`injection-plan.mjs` 和 `active.json` SHA-256 完全一致，只在启动器增加主题根目录重解析点拒绝。相同进程 40840 再次通过原生全空验证后热应用到 `battle/scene 0`、130 个受管标记，V9 与小悟空/小八戒/湘妃葫芦三项安全位均为 true；普通 Codex 根进程 9896 在整个受管切换中保持运行且未被触碰。
