# 当前进行中目标

更新时间：2026-08-11

本文件是本项目当前唯一执行基线。后续旧方案、旧截图和旧文档若与本文件冲突，以本文件为准。

## V52.2 稳定叠化、双序列与题字开关候选（2026-08-11）

- 活动图库为 22 张稳定物理槽位：战斗 `B01..B13`、风景 `S01..S09`。播放位由各组独立的连续 `order` 决定，`slot` 不再与播放位绑定。当前战斗顺序为 `B07 -> B01 -> B02 -> B03 -> B04 -> B05 -> B08 -> B09 -> B06 -> B10 -> B11 -> B12 -> B13`，风景顺序为 `S05 -> S04 -> S08 -> S01 -> S02 -> S03 -> S06 -> S07 -> S09`。
- `Ctrl+Alt+F` / `Ctrl+Alt+B` 在当前可见序列内前进/后退；`Ctrl+Alt+C` 只在当前页面临时切换战斗与风景序列。导航或真实 surface 变化会清除临时覆盖，新建任务页仍自动使用战斗，项目/已有对话仍自动使用风景；自动目标已经可见时不触发解码、render 或叠化。
- `Ctrl+Alt+T` 只切换新建任务页“此去，欲破何局？”的 paint 与对应 ARIA：原生标题节点、文字、DOMRect、主题 style/overlay/runtime 和背景状态不变。选择在当前 renderer 内跨背景、任务与对话保持，无重载热应用也会继承；新进程默认显示。
- 手动切图继续保持同一 document、runtime、style、overlay 与标记节点。目标 `<img>` 解码后仍保持 `opacity:0`，跨过连续两个绘制帧才启动 420 ms 淡入；过渡由 `transitionend` 收束，并保留有界超时兜底。过期解码请求会取消，解码失败时保留当前可见图。
- composer、sidebar、right-panel 的稳定根内部被 React 替换，或 landing/thread surface evidence 新增时，MutationObserver 只合并一个微任务刷新并在首个 rAF 前完成主题对账；纯文本流式增长仍不触发该路径，也不新增轮询。
- 新图只做等比缩放和 JPEG 编码；B06 额外裁掉源图实测上下黑边。运行时不添加亮度、饱和度或对比度滤镜，尽量保留原色。
- 战斗和风景均把每图 veil 降至可读性边界附近；当前模型最低正文对比度分别为战斗 `4.501:1`、风景 `4.511:1`，战斗平均背景亮度仍高于风景。S06/S07 已在可读性下限附近，因此不再继续减遮罩。
- 22 张 JPEG 合计 `8,355,513 bytes`、`45,201,592 px`，最大双图过渡 `5,337,600 px`，仍处于 24 MiB / 48,000,000 px / 16,000,000 px 三重预算内。定向资源、色板、顺序与原位切图测试 22/22 通过。
- `backgrounds.cmd` 是公开背景管理入口，提供交互及 `list/add/replace/move/remove` 命令；移动只改 `order`，移除只退出轮播而不删除图片，清单与被覆盖图片备份到 `.wukong-runtime/background-backups/`。低层 `scripts/prepare-background.ps1` 继续负责有界转码。

## V51.8 原位切图、全量编号背景与可读性候选（2026-08-11）

- 活动图库扩展为 18 张：战斗 `B01..B09`、风景 `S01..S09`。原有 4 张战斗和 5 张风景保留，本轮追加 5 张战斗和 4 张风景；压缩文件合计 `5,887,434 bytes`，解码总量 `37,329,592 px`。
- 两组都使用固定编号顺序，不再洗牌：`B01 -> ... -> B09` 与 `S01 -> ... -> S09`，到末尾后回到本组 B01/S01。持久状态版本 3 会把旧随机牌堆迁移为有序游标，同时保留当前可见场景。
- 普通项目/对话切换、history/hash、流式文字、DOM 对账与 resize 不推进序列。只有真实点击“新建任务”且距上次自动推进至少 20 分钟时才自动推进；`Ctrl+Alt+F` / `Ctrl+Alt+B` 只前进或后退当前模式且不受自动冷却限制。
- 页面隐藏时不创建解码请求，只合并一次待推进意图；新图由最终绘制的同一个 DOM `<img>` 完成 `decode()` 前，旧图持续可见。两个手动快捷键都不导航、不刷新主题、不重建 style/overlay/主题标记；切换继续使用 420 ms 单向叠化、透明新图底层、单一在途解码、稳态一纹理与过渡期最多两纹理。
- 新增 `scripts/prepare-background.ps1`，用户可按 B/S 槽位替换自己的背景；默认不放大、最大 1920×1080、JPEG 质量 90，活动清单仍只有 `themes/active.json`。
- 进度胶囊的完成圈、增加数和删除数改为深青蓝、深绿和深红，并以 paint-only 描边提高纸面上的可读性；DOMRect、间距与命中区保持原生全等。
- 不创建 interval、周期轮询、WMI/CIM、服务或额外进程。V51.5 原生入口保持不变；全量验证为 101 通过、9 个环境型跳过、0 失败，既有 renderer 已完成无重启热刷新并达到 `renderer-verified`，仍保留用户视觉验收边界。

## V51.5 低开销原生入口候选（2026-08-10）

- 切换项目/对话、再次显示已有窗口和托盘恢复必须复用当前官方受管 renderer，不得关闭或重启 `ChatGPT.exe`。本候选实现及聚焦测试期间，当前主题窗口均未重启。
- 只有全部官方 ChatGPT/Codex 进程完全退出，随后从原始 Store/任务栏 AUMID 冷启动时，才允许一次快速接管；这是因为 `--remote-debugging-*` 只能在 Electron/Chromium 进程创建时提供，无法事后加入。该原始 AUMID 冷启动实机门当前仍待执行。
- `runtime/activate-appx.cs` 编译后直接调用 `IApplicationActivationManager` 激活安装器已验证的 AUMID，并在激活前发送 `ManagedLaunch` 命名信号。正式启动链不再调用 PowerShell、`Get-AppxPackage` 或运行时 `Add-Type`。
- 原生入口监督器对每个 WinEvent 新窗口先做精确 `QueryFullProcessImageNameW` 路径核对，再且只执行一次 `HasCodexCdp`；V51.4 的最长 6 秒重复核对已经移除。命中 `ManagedLaunch` 的窗口直接跳过接管，避免 bridge 自触发。
- 零双启动的日常方式是使用并固定用户 Start Menu 的 `ChatGPT.lnk`。它保持官方 ChatGPT 名称和图标，但直接进入 repository bridge 与编译 AUMID 激活器；原始 Store/AUMID 入口仍由监督器保护，在真正冷启动时可能发生上述一次快速接管。
- 稳态只等待 `SetWinEventHook(EVENT_OBJECT_SHOW)`、`ManagedLaunch`、marker 文件事件、进程退出和 DevTools Target/Page/Runtime 事件；不使用 WMI/CIM、固定周期进程扫描、renderer target 轮询、服务或计划任务。
- 当前证据边界：聚焦合同 45/45 与补充定向合同 27/27 已通过，当前主题窗口未重启；全量测试与热更新安装待执行，原始 AUMID 冷启动实机验收未执行，不得把 V51.5 写成已完成。

## V51.4 原生入口监督候选（历史，2026-08-10）

- 用户可见入口、应用名称、图标、Store 包身份、正式 profile 与实际 `ChatGPT.exe` 均保持官方 ChatGPT/Codex；不创建独立 `Wukong Codex` 应用，不修改 WindowsApps、`app.asar`、签名或官方配置。
- V51.4 增加当前用户级原生入口监督器：以 `SetWinEventHook(EVENT_OBJECT_SHOW)` 接收新窗口事件，并以 `QueryFullProcessImageNameW` 精确核对该窗口是否属于当前 `OpenAI.Codex` 包内的 `app\ChatGPT.exe`。只在新窗口未受仓库管理时切到 repository bridge；不按名称批量结束进程，也不处理安装前已经存在的窗口。
- 原始 Store、开始菜单与任务栏入口无需改名或另建可见快捷方式。监督器只登记到当前用户 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`，不安装服务、计划任务、DLL/IFEO，也不使用 WMI/CIM。
- repository bridge 在非便携模式通过 `IApplicationActivationManager` 激活从当前 AppxManifest 精确解析的 AUMID；版本化 WindowsApps EXE 路径只用于身份核对，最终仍由官方包完成激活和窗口承载。
- 稳态只等待 WinEvent、marker 文件事件以及 DevTools Target/Page/Runtime 事件；不设置固定周期进程扫描或 renderer target 轮询。新窗口后的路径、通道与切换核对均为有界启动工作。
- 仓库或 `package.json` marker 消失时，renderer host 先恢复并验证原生 DOM；监督器通过文件事件撤销自身 HKCU Run 项并退出。之后原始官方入口保持原生，LocalAppData 中不保留可独立运行主题的资产副本。
- 本检查点只记录候选实现与合同。当前已打开的 Codex 窗口在聚焦和全量测试通过前未被关闭、重启或改写；V51.4 的受控 Store/任务栏原生入口实机验收仍为待测试，不得写成已经生效。

## V51.3 仓库驻留注入历史状态（2026-08-10）

- 公共交付从 append-only release 复制切换为 repository-backed runtime injection：Git checkout 是 CSS、图片、主题定义与事件 host 的唯一来源，`install-theme.cmd` 不再创建 `.codex\themes\wukong-codex-forge\releases\<版本>`。
- 官方 `ChatGPT.exe` 是实际启动和承载 renderer 的进程，但二进制、`app.asar`、WindowsApps、签名与官方配置保持零写入；Codex 内置 Node 只通过 `127.0.0.1` DevTools 通道把主题应用到真实 renderer。
- V51.3 取消所有独立命名入口。安装器只备份并更新用户开始菜单的原生 `ChatGPT.lnk`，保留官方名称、图标和最终 `ChatGPT.exe`；旧 `ChatGPT - Wukong Theme`、开始菜单/桌面 `Wukong Codex` 仅在目标为 Codex 内置 Node、参数属于本项目 bridge 目录时先备份再精确移除。
- 本机已经证实 Store 可在安装后把同名 `ChatGPT.lnk` 恢复成官方直连入口；verifier 必须把它报告为真实失效并要求重跑 `install-theme.cmd`。固定图标/AUMID 仍可能绕过用户级 `.lnk`，在不修改签名包、不使用 IFEO/DLL/服务/常驻监听的安全边界内不能承诺无条件接管。
- 仓库模式使用正式 Codex profile，同时把控制管道、请求和事件写入 `%LOCALAPPDATA%\WukongCodexForge\repository-state\<仓库路径散列>`，避免删除仓库后被 host 重新创建。主题资产不会复制到该状态目录。
- bridge 在 `package.json`、host、活动主题或样式任一缺失时直接启动官方 EXE。若仓库在主题窗口运行期间消失，event watcher 先执行 `RESTORE_EXPRESSION` 并验证所有 renderer 已达到 native state，再退出。
- 活动安装、启动和停用路径不得使用 WMI/CIM，不安装延期宠物，不启动旧 `launch.ps1` watcher 链；旧保留式 releases 仅作为历史证据留存，不再是当前启动源。
- 2026-08-10 实机复核定位到“受管重启后仍无主题”的真实原因：浏览器通道先出现而首个 renderer 延迟创建，旧 host 首次得到 0 targets 后未收到目标事件。V51.2 增加最多 6 次、约 9.5 秒的启动阶段补偿探测；实机新通道 `19454` 已从 `waiting-for-renderer` 到达 `renderer-verified`。进入稳态后仍不轮询。
- `start.ps1` 不再在安装器后重复 PowerShell 端口判断，而是同步调用同一个已验证 Node bridge 并处理退出码；bridge 只执行一次窄范围 `tasklist` 与最长 5 秒本地通道核对。整个日常链不使用 WMI/CIM。
- 官方进程以 `detached: true` + `child.unref()` 启动；实机 `disabled-verified` 后 host 自然退出而 `ChatGPT.exe` 主窗口保持运行。临时移走 `package.json` 时已得到 `theme-removed-verified`，标记缺失期间 bridge 退出 0、未新增 runtime event 且 renderer 保持原生，随后标记恢复并重新注入成功。
- 宠物使用独立 `initialRoute=/avatar-overlay` 透明 renderer；V51.2 在目标选择层排除该路由。实机主 renderer 保持 `runtimeV13=true`，宠物 renderer 的 style/class/background/runtime 全为 false，截图 alpha 审计为 96.24% 完全透明且非透明包围盒仅 105×125 的宠物本体。
- 生命周期等待首个 DevTools 通道期间现在订阅同一 host signal；停用请求可立即返回 `disabled-before-channel`，不再等待 12 秒控制超时。该行为不使用 WMI/CIM、进程终止或固定轮询。

## V50.1 历史范围冻结与启动链热修复状态（2026-08-08）

- 本轮完成标准只包含非宠物主题、背景/过渡/覆盖、输入区与相邻原生状态、侧栏/顶部/环境卡、资源预算、正式生命周期、定向测试、文档与分段推送。
- 小天命人和小八戒整体延期：不修改造型、动作、武器、图集、发布策略或本地安装状态，也不再阻塞本轮完成。
- 葫芦保持取消，不进入活动主题、运行包或验收。
- 正式生命周期已经实现为 `Codex embedded Node -> append-only bridge -> runtime/host.mjs -> official ChatGPT.exe`，并完成 V50.1 保留式安装：当前 append-only release 为 `0.13.0-20260808-171808`，两个开始菜单入口均指向 Codex 内置 Node 与同一 bridge。host 以受管 profile 的回环 DevTools 通道和浏览器身份为生命周期真值，不再绑定 Windows Store 很快退出的中转 PID；遗留活动通道可由新 host 重新接管。旧 release 和快捷方式全部 append-only 保留，旧 `0.13.0-20260803-191843` 仍保持其安装时原始 SHA。
- V50 的视觉与原生几何门保持有效，`releasedPetIds` 为空且安装阶段对宠物无操作。V50.1 新增中转 PID、活动通道重接管和 browser-channel 生命周期回归；当前聚焦生命周期/保留安装合同 26/26 通过。新 release 已重新接管当前真实 renderer：单一 Codex target、`active=true`、style/runtime/background ready 均为真，输入器仍为 `736×98px`、editor 为 `712×44px`，四角纸面 `pointer-events:none`。
- 2026-08-01 后续两次单实例尝试均按 fail-closed 处理：一次在 renderer 刚就绪时撞到外层时限，另一次在整机 CPU 越过 90% 红线时主动中止；两次均得到 `disabled-verified` 且精确 root、host 与专用端口归零，没有生成 PNG，也不冒充最终视觉验收。
- 当前已打开且没有受管回环通道的非受管 Codex 窗口不被强制关闭或改写；已有有效受管 Codex 通道但 host 意外退出时，新入口会核对 Codex target 后重新接管。直接 WindowsApps/AUMID/协议/第三方入口仍可能绕过受管链，必须如实披露。

## 最终目标

在不改变 Codex 原生信息架构、文本内容、布局坐标和交互热区的前提下，实现一套与《黑神话：悟空》深度融合的 Codex 视觉主题。主输入器仍保留长方形四角纸张外观，但这四个角只属于同一原生矩形内的绘制轮廓，不构成几何例外：

- 保持 Codex 原生页面结构，不增加额外侧边栏、底栏、主题控制栏或开关按钮。
- 正式包放入约定位置即可使用，并随 Codex 启动和退出；移除主题包后完整回归原生。
- 主题不得修改 `ChatGPT.exe`、`app.asar` 或官方配置，不得以长期 PowerShell 启动脚本作为最终方案。
- 关闭或移除主题后不得残留背景、标记、宠物、监听端口、watcher 或调试进程。
- 所有实现优先保证稳定与最小资源占用，不能以视觉效果换取崩溃风险。
- 所有宽高、间距、内边距、位置、响应式断点和命中区均以本机已安装 `ChatGPT.exe` 的 `app.asar` UI 源码及真实 renderer 为几何真值；主输入器只在不命中鼠标的 paint 层使用四角长方形纸张轮廓，原生文字、状态、按钮尺寸、可访问语义和交互能力全部不变。

## 当前实施顺序

### 1. 资源与稳定性硬门槛

该硬门已完成并继续作为发布合同；用户已取消周期资源采样，因此只在启动/结束本项目临时实例和最终归属边界做一次性核对，不把持续监控重新引入运行链。

- 背景按需加载，不允许启动时预载全部场景。
- 稳态仅允许一张背景驻留；过渡期间最多两张。
- 单张背景、图库总量、双图过渡和 UI 材质必须同时受“压缩字节 + 解码像素”硬预算约束；不能让高压缩率超大图绕过内存门禁。
- 不使用永久全屏 `will-change`、全屏滤镜或无必要的缩放合成层。
- 不做跨模式或相邻场景预取。
- 只在启动/结束一次性调试实例和任务收尾的归属边界核对进程、端口与清理结果；不做周期资源轮询。
- 只关闭本项目明确创建的调试实例、watcher、测试进程和工具进程；保留 Codex 主界面、renderer、GPU 与 app-server。
- 常态不保留主题调试窗口；实机截图与资源采样完成后立即关闭，并验证其 watcher、子进程和专用端口全部释放。

### 2. 背景与新建任务页

- 新建任务页使用战斗背景池；进入已有对话后切换为风景背景池。
- 战斗/风景分别使用稳定槽位与独立播放位序列；同模式任务/项目切换、history/hash 与流式变化不推进。冷却后的真实新建任务或 `Ctrl+Alt+F` 才选择下一张，`Ctrl+Alt+B` 返回上一张，`Ctrl+Alt+C` 只临时切换当前页面可见组；landing/thread 自动默认不变，且已经处于目标组时不重复工作。
- 背景必须完整覆盖整个 Codex 窗口，不能只覆盖侧边栏或中央局部。
- 战斗视觉以杨戬与大圣为主；用户最新否决的候选大圣图与原夜叉王裂焰图均退出活动图库和运行包，源文件只作保留证据。
- 夜叉套、神锋、金箍棒等元素必须来源准确，不使用失真的手绘替代。
- 风景模式使用用户认可的纯画面、场景与建筑素材，不采用普通战绩图或杂乱战斗截图。
- 杨戬主背景使用用户指定的白底水墨对决图。
- 当前活动图库为 22 张：`B01..B13` 十三张战斗与 `S01..S09` 九张风景；默认回退资源始终镜像战斗组 `order=1`，当前为 `themes/backgrounds/battle-07.jpg`。
- 新建任务页原生标题和 56×56 图案允许替换，但必须保留原生占位、尺寸与布局；当前活动候选为文案“此去，欲破何局？”与深/浅两套“悟空”书法字标，不再使用金箍棒模型缩略图。

### 3. 输入框

- 用户上传的三张最终参考图已取代 V1–V9 候选，允许直接实现并测试；主输入器、上下文条、进行中目标条、计划/变更摘要和项目上下文条统一使用第一张参考图的纸面底纹。
- 纸面综合色阶以用户最新暗色参考为准：当前 V17 材质重建目标为 `RGB(135,117,93)`，四类活动产物内区中位色约 `RGB(134–135,117,93–94)`；主输入器、上下文/目标条、计划/变更条和项目上下文条必须从同一源重建并使用同一暖灰黄赭 matte，不能分别套滤镜或出现亮黄断层。
- 主输入器的 surface、editor shell、editor、footer、按钮、内距、宽高和底部锚点全部沿用原生实时布局，不再声明主题高度、比例或额外位移。主题仍在同一原生矩形内绘制长方形纸张，并以四个 8px 切角表达卷页轮廓；不得为了保留纸张外观移动任何内容，也不得回退为原生灰色圆角 paint。
- 外形使用轻量切角卷页轮廓与静态纸面，不沿用原生圆角矩形，也不使用会把纸面中央挖空的 alpha 位图遮罩。
- 原生编辑器、footer、上下文条、排队/目标条、项目条、按钮尺寸、文字、ARIA、动态状态、命中区和内边距全部保留，不允许编辑器外壳或 footer 为纸张额外内缩或上移。排队消息与进行中目标继续使用贴在主卷页上方的官方 stack，并按当前安装包解包得到的真实两层拓扑绘制：一个外层 queue panel 包含 N 个 internal queue item，随后是一个外层 goal panel；只有整组首个外层面板拥有左上/右上外部切角，每条内部消息在组内拥有独立纸纹与原生 1px 接缝，后续目标面板以直边连续承接。不得把每条消息提升为独立外层卡片，也不得把一张纸面按总高度拉长；独立计划/变更进度 pill 才保留完整圆角。
- 不修改用户提示词、占位文案或回答内容；助手回答保持无额外外框。
- 纸面、角纹、云纹、边线、墨色和控件状态按用户最终参考高保真实现；不得退化为泛古风金框、换色皮肤或拉伸位图。
- V1–V9 全部作为失败/历史候选保留，不再参与当前实现决策。

### 4. 侧边栏、顶部入口与应用菜单

- 一级条目用于项目条和无项目对话，采用黑神话“游记”目录的深墨条材质；二级条目用于项目下对话，采用目录正文行与浅纸选中带。
- 必须完整定义默认、悬停、焦点、选中、展开、禁用和未读/进行中状态的对应关系，不能只做静态截图。
- “新建任务 / 拉取请求 / 站点 / 已安排 / 插件”等 renderer 顶部入口可按既有主题映射替换材质；“文件 / 编辑 / 视图 / 帮助”四个应用菜单明确取消替换，完全保留官方 paint、状态、DOM、文字、图标、热区和几何。
- 用户明确取消葫芦融入方案；活动 runtime、发布清单和后续设计均不得新增葫芦。

### 5. 新建任务页图案

- 保留官方 56×56 图标槽位、原始节点和命中关系。
- 卡通短棍和金箍棒缩略图均已退出活动主题；当前深/浅“悟空”书法使用 336×336 双倍源，在官方 56×56 槽位不变的前提下绘制 168×168 视觉层，可见约 141×96px，并保留原生占位、布局和命中关系，不增加背景徽章、贴纸或动画。
- 当前题字“此去，欲破何局？”仍处于多轮验收中，不因技术测试通过而自动视为视觉通过。

### 6. Hatch Pet 宠物（本轮延期）

用户已明确将两个宠物整体移出当前完成标准：不修改现有小天命人或小八戒造型、动作、武器、图集、发布策略和本地安装状态，也不以宠物未通过阻断其余主题与生命周期交付。此前对小天命人武器连续性、小八戒沿用既有造型只改动作等反馈继续保留，后续收到新的明确指令时再单独恢复该工作流。

### 7. 最终随 Codex 启停

V50–V51.4 的实现保留为历史；V51.5 正在把原生入口监督收敛为无需日常重启、无需 PowerShell 激活且单次判定的低开销候选，宠物延期不阻断本阶段。

- 当前候选链使用用户级 `SetWinEventHook(EVENT_OBJECT_SHOW)` 监督器、Codex 内置 Node、repository bridge、编译 `activate-appx.cs` 与事件驱动 host；同名 Start Menu `ChatGPT.lnk` 保留官方名称/图标并提供零双启动日常入口。
- 切换对话、托盘恢复与有效受管通道重附着均不重启。只有全部官方进程退出后的原始 AUMID 冷启动才可能快速接管一次，因为 remote-debugging 参数无法事后加入；每个精确路径匹配窗口只调用一次 `HasCodexCdp`。
- 仓库 marker 存在时进入主题 host；marker 或仓库不存在时，监督器撤销 HKCU Run 并退出，原始官方入口保持原生。正式链不使用 WMI/CIM、固定周期进程扫描或稳态 renderer 轮询。
- V51.5 聚焦 45/45 与补充定向 27/27 已通过且当前主题窗口未重启；全量、热更新和受控原始 AUMID 冷启动仍待执行，不能提前标为完成。

## 不可违反的约束

- 不删除、移动或覆盖用户本地任何原始文件；只允许在项目或明确的主题安装目录中新增和修改本项目文件。
- 不使用 Computer Use 审查 Codex；以只读方式审计 `ChatGPT.exe` 所在应用包的 UI 源文件。
- 常态只保留当前 Codex 控制窗口；实机审查时最多临时增加一个主题调试窗口，截图与采样后立即关闭。
- 不新增表情符号装饰。
- 不改变 Codex 原生侧边栏宽度、输入框长度、环境信息窗口尺寸、按钮热区和回答排版；主输入器外框高度与轮廓仅按本文件第 3 节的显式例外调整。
- 每轮只运行与变更相关的定向测试；里程碑或推送前再运行必要的契约测试。
- 每轮维护需求、设计、分工与工作日志，并对本轮精确暂存、提交和推送；不得混入用户已有或无关改动。
- 高难度模块拆成可独立回退的小里程碑；每个里程碑通过针对性测试后立即精确 commit/push，不允许把多个验收轮次堆在一个大提交里。

## 当前进度

- 已完成 Codex 26.715.2305.0 UI 源码只读审计，锁定中央 `main-surface`、顶部渐变、新建任务标题和 56×56 图案的原生节点。
- V13 当时已实现全窗口背景覆盖、新建页临时标题/图案，以及每个 renderer 会话各自固定的战斗/风景场景；现行 V51.7 已由第 209 条的两组编号序列取代该固定单景策略。
- 已定位主题崩溃风险：旧实现启动时主动解码 11 张背景，并长期保留双全屏纹理、合成层和滤镜。
- 已把背景运行时改为单请求按需解码并复用已解码 URL，过渡后清空旧层；同模式任务/history/hash 变化保持当前场景和单图层不动，首张背景仍须完成解码后才公开 ready。资源上限定向测试与真实 renderer 历史采样均证明稳态 1 张背景、0 个解码请求。
- 已修复新建任务标题/图案只在缩放后出现的问题：120/420 ms 启动探针现在按各自期限真正执行，既有标题外壳内部后续挂载内容也会触发刷新，零尺寸标题/图标纳入 ResizeObserver；原项目名下划线在主题激活时隐藏。
- 已补齐背景/路由竞态门禁：可见对话优先于仍在布局但 `opacity:0` 的旧新建页；背景覆盖层、活动层、图像层与 veil 在首次提交及窗口改为 `1001×733` 后均与视口 DOMRect 完全一致；交叉淡化中覆盖层被移除时会先恢复原生 paint，再以新 generation 重建单活动层。背景状态机 10/10、V15 原生表面 7/7 与最小包/保留式安装 4/4 通过，真实 Codex 视觉仍需后续单窗口里程碑验收。
- 快速导航/提交的 follow-up timer 已改为“最新一组覆盖旧组”，任意时刻最多 2 个 route timer；隐藏页面不执行主题刷新，恢复可见时只合并刷新一次。流式回答的纯文本追加不进入表面结构信号，200 次连续文本 mutation 不增加 refresh/render 计数。
- 已增加图片头级解码像素门禁：单背景不超过 1200 万像素、活动图库总计不超过 4800 万像素、过渡中两张最大图合计不超过 1600 万像素、单张 UI 材质不超过 419 万像素。当前 22 图图库实测总计 45,201,592 像素，最坏双图过渡 5,337,600 像素；伪造的 100,000×100,000 PNG 会在组装 payload 前被拒绝。
- 低分辨率 `great-sage-return.jpg`、用户否决的候选大圣图与原夜叉王裂焰图均已退出活动图库和最小包；文件继续原位保留。
- `themes/active.json` 已锁定为页面 payload 的唯一活动主题清单；含退役葫芦、旧宠物和旧构图参数的 `themes/ink-mountain.json` 继续原位保留为历史证据，但从最小运行包白名单中排除，不删除文件。
- 已完成一次 V13.3 临时调试实审并在截图/采样后立即关闭；调试根进程、launcher、watcher、子进程和专用端口均已释放，后续继续执行同一纪律。
- 已从本机 `ChatGPT.exe 26.715.2305.0` 的 `app.asar` 提取 composer、topbar、sidebar、按钮和响应式 token，并建立自动漂移合同；V15 fixture 不再从审稿图猜尺寸。
- 已把 sidebar 生产映射收口到当前 ASAR 的 `data-app-action-sidebar-*` 结构：项目条、无项目对话和项目内对话不再依赖测试假属性或 `nth-child`；active、expanded、collapsed 的属性变化可在不缩放窗口的情况下刷新材质。
- V15 已把用户最终参考的纸面与目录材质接入原生 composer、上下文条、一级/二级侧栏条目及应用菜单，当前仅通过 headless 几何/状态门禁，尚未通过用户实机视觉验收。
- V15 输入相关四类纸面已统一暗化到目标综合色阶，移除 composer 常驻 CSS filter，并通过像素、纹理、原生几何、forced-colors 和最小包定向门禁；该结果仍需用户实机视觉验收。
- V17 曾撤回 V16 过高的概念稿并把主输入器收至 `120–168px`；该检查点先被 V20 的 `96–120px` / `736×100px` 合同取代，随后 V20 的主题高度例外又被 V50 原生全等几何取代。V17 证据继续保留为历史，不再作为当前几何真值。
- V17 曾把排队消息与进行中目标识别为一个官方 above-composer stack，并只在该 stack 外层绘制一次纸面；这一“总背景随条目拉长”的绘制策略已被后续原生内层消息合同取代。V17 的八状态证据继续保留为历史，不再代表当前绘制方式。
- V17 修复当前 Codex 编辑器签名漂移造成“背景已替换、输入框仍原生灰色”的漏映射：官方 `.composer-surface-chrome` 现在是主身份，内部 editor 签名只作可选辅助；不改变 contenteditable、ARIA、按钮或 DOM 拓扑。
- V17 生产拓扑门禁已继续收紧：composer component 必须是 `data-codex-composer-root` 的直属子节点、包含官方 `.composer-surface-chrome` 且排除直属 above-composer portal；fixture 不再声明测试专用组件身份。官方 compact row 的 `first:rounded-t-2xl`、`border-x`、`border-t` 以及“不含任何下角 token”均进入 9 项定向回归测试。
- V17 临时调试清理已增加精确 PID 树兜底：只有 launcher、disable request 与 CDP browser PID 三重归属成立，且 `Browser.close` 超时后仍残留时才触发；最新真实复验中该兜底被实际触发，随后 root、owner、便携 profile 进程与专属端口全部归零。它只用于开发验收，不是最终随 Codex 启停方案。
- V18 保持 V17 已确认的三类几何不变，并把视觉裁角从原生宿主迁到不命中鼠标的静态纸面层：主输入器仍为四角短卷页；排队/目标 joined stack 仍只含两个上角与直底边；独立 progress pill 仍全圆。原生宿主现在保持 `clip-path:none` 和完整矩形命中区；fixture 证据位于 `artifacts/test-runs/v18-paint-only-corners-20260730-qa2/`，当前仍待用户多轮视觉验收。
- V19 修复背景首帧与稳定刷新两项资源缺口：同步命中缓存的图片也必须等 `decode()` 后才公开 ready；主题刷新改为差量对账标记，不再每轮全量移除/重加 composer class，也不重复写入相同题字 ARIA。稳定布局 2.2 秒内 `refreshCount` 不再增长，卷页高度不抖动，非输入区几何、输入器宽度/底锚和五类按钮命中尺寸保持合同。
- V20 曾依据当时两张截图把主卷页收至 `clamp(96px, width × 25 / 184, 120px)`，最大原生列宽 `736px` 时为 `100px`；这一主题高度例外已被 V50 的“全部位置与尺寸严格沿用原生、四角仅存在于 paint 层”合同取代。V20 的 stack 外层单次绘制也已被 V22 原生内层消息绘制取代。
- V21 使用无中央透明洞的暗暖灰黄赭静态纸面，并尝试把每条排队消息/进行中目标都提升为独立外层绘制宿主。用户审图证明这种夹具拓扑会让每层像互不衔接的卡片；V21 证据继续保留为失败历史，不再代表当前绘制方式。
- V22 只读解包 `above-composer-panel-row`、`queued-message-list` 与 `codex-composer-adapter` 生产模块，确认真实结构为一个 queue 外层面板内含 N 个 `overflow-visible` 消息包装，再接一个 goal 外层面板。运行时现在通过完整原生 class token 标记内部消息，不猜中文/英文文案：首个外层面板独占固定 29px 顶饰和两个外部上角，内部每条消息独占一层不命中鼠标的纸纹并以原生 `gap-px` 接缝连续堆叠，后续 goal 面板保持直边承接。guided / multi-guided 定向夹具中外层面板、内部消息和所有原生控件 DOMRect 前后全等；证据位于 `artifacts/test-runs/v22-native-composer-stack-2026-07-31T00-40-21-809Z/`。这只是原生结构无头证据，仍待用户实机视觉验收。
- V24 已把背景技术门补成同页四阶段证据：新建页战斗稳态、进入对话交叉淡化、对话风景稳态和返回新建页战斗稳态均为完整 `1600×900` 页面；overlay、活动层、图片层与 veil 四层逐边覆盖视口，加载纹理数为 `1 → 2 → 1 → 1`，预取始终为 `0`，没有全屏 filter 或永久 `will-change`。返回新建页后印记与题字无需 resize 即出现；背景定向 8/8、像素预算与场景色板 6/6 通过。证据位于 `artifacts/test-runs/v24-background-transition-2026-07-31T23-55-59-699Z/`，仍需最终正式安装窗口验收。
- V33 修复当前安装包 progress paint token 漂移导致的 queue/goal 上方黑带：旧精确 class token 仍保留，兼容回退只匹配 progress host 的直属、无子元素、无交互、底缘贴合绘制层，排除含原生 pill 的交互 carrier。token 漂移定向测试证明渐隐层在不改几何的前提下重新透明化；本轮单窗口便携实机未找到含真实 queue/goal 的任务，故真实整页视觉门仍保持待验证，且失败后 root/launcher/watcher/port 已全部释放。
- 用户已将两个宠物整体延期；现有候选、策略与安装状态保持不变，不再属于本轮完成条件，也不阻断最终非 PowerShell 生命周期工作。
- V15 当时的侧栏/顶部入口状态矩阵曾覆盖五个顶部入口、一级项目/无项目对话、二级项目对话和四个应用菜单触发器；其中四个应用菜单的主题替换已被用户取消，现行合同以官方 paint 为准。其余 active、expanded、disabled、unread/running 与 forced-colors 证据仍作为历史基线保留。
- 当前 Electron 的“文件/编辑/视图/帮助”触发页签和下拉内容全部保留官方 paint；下拉内容由主进程原生菜单绘制，不在 renderer DOM 中，测试夹具不得伪装成已改造原生应用菜单。
- V15 当时的金箍棒图案曾从约 40×34 px 放大到原生槽位内约 50×42 px；该方案后来已退役，现行实现是由 `themes/active.json` 逐图选择深/浅版本的“悟空”字标。V15 无头证据继续保留为历史记录，不是现行视觉真值。
- 宠物已进入 Hatch Pet v2 全量重做：新建 `little-wukong-v5-yaksha-shenfeng-canonical-rebuild-20260725` 与 `little-bajie-v4-inart-game-motion` 两个独立 run，待审批 id 分别为 `little-wukong-v5-yaksha-shenfeng` 与 `little-bajie-v4-inart-game-motion`，不复用旧冻结 id。两只 base 候选已分别通过完整神锋/双足与成年猪妖/完整九齿钉耙的本地门，并完成透明边缘与 192×208 留白验证；下一步是用户母版审计，未通过前不扩展动作。小天命人 schema row 4 改为双足落地、身高稳定的原地反应，不再生成跳跃动作。
- V25 已把宠物发布门收口到唯一 `pets/release-policy.json`：`releasedPetIds` 当前为空，旧小八戒 v3 与旧小天命人 v4 均列入 `frozenPetIds`。准备脚本不读取旧候选，最小包不携带其 manifest/atlas/proof，安装器在解析空批准集合后、触碰 Codex 用户目录前直接无操作退出；仓库旧包、用户 discovery 目录、当前选择和既有事件记录全部保留不变。只有用户明确通过新母版后，才允许在独立检查点更新该策略。
- V26 修复两个新 run 曾沿用旧包 id 的身份冲突：发布策略新增独立 `pendingPetIds`，loader、准备脚本与安装器强制 `released / pending / frozen` 三态两两互斥；新候选 request 与 verdict 同步使用独立 id。待审批候选仍不进入准备、最小包或安装链，旧冻结包也未被改写。
- V27 将 V23 环境卡完整页及 V24 四阶段背景完整页连同机器可读 JSON 纳入 Git，并同步现行 README、便携说明、需求、分工和工作日志。证据文件继续明确标注为无头原生结构 fixture，不代表真实 Codex 窗口或用户视觉验收；本检查点不改运行时、不启动调试窗口，也不越过两只宠物母版审批门。
- V28 将当前 `OpenAI.Codex 26.715.2305.0` 的包目录名、`app.asar` 长度 `201143773` 与 SHA-256 写入结构化来源锁；原生合同以固定 1 MiB 缓冲分块校验，任一漂移都会要求重新只读审计，不能静默沿用旧选择器或旧几何。本检查点不修改官方包、不启动调试窗口，也不越过宠物母版审批门。
- V29 已定位一次真实整页捕获只出现启动 Logo 的原因：背景运行时已 ready，但捕获器未等待原生 shell 与 composer/landing 节点。验收脚本现在把两组 ready 条件设为截图硬门，并保留 650 ms 静止期；首次失败捕获已完成原生恢复，root、launcher、端口和项目进程均归零，不把它冒充视觉通过。
- V30 已用修复后的捕获器完成一次真实 Codex landing 整页技术预验收：`1280×820 @ 125%` 下原生侧栏为 `275×784`、工作区 `1005×784`、composer 列 `736×143`、实际纸面 `736×100`；背景为 `cover` 且只有一层加载活动纹理，60 个主题节点、原生 editor 与 contenteditable 均存在。原图含用户项目名，仅本地保留；tracked 摘要与哈希位于 `artifacts/test-runs/v30-live-landing-contract-20260801/acceptance.json`。该门不代表用户视觉通过，也不覆盖 queue/goal、环境卡、双宠物或最终生命周期。
- V31 修复真实捕获在选任务超时后绕过关闭逻辑的资源缺口：成功与失败现在共用同一三重归属清理函数。真实 renderer 故意打开不存在任务触发 `TimeoutError` 后未生成 PNG，仍观察到原生恢复与 watcher 确认，唯一 root、launcher、端口和项目进程全部归零；去标识化证据位于 `artifacts/test-runs/v31-live-capture-failure-contract-20260801/acceptance.json`。当前便携 profile 未出现目标任务标题，因此真实 queue/goal 页面仍未通过，不能由 fixture 顶替。
- V34 已完成非 PowerShell 正式随启随停实现与 `0.13.0-20260801-144611` 保留式安装；两个开始菜单入口均使用 Codex 内置 Node + append-only bridge，安装副本与仓库 `runtime/host.mjs` 哈希一致。生命周期/恢复合同 23/23、最小包 1/1 通过；剩余的是资源绿色窗口下的一次完整页真实 queue/goal 联合取证，不再包含宠物或葫芦。
- V35 第一检查点已按最新审稿撤销所有未选中侧栏条目的主题行材质、颜色、焦点和状态指示覆盖；运行时仍保留原生语义标记用于 current 切换，只有真实 selected/current 外层节点绘制白纸黑字，并按节点实时尺寸四边内缩 1 px。定向侧栏合同已验证未选中八类条目的默认 paint 与原生逐项全等、选中态与所有 DOMRect 保持有效；目标稳定映射、输入区黑边和环境信息窗仍在下一检查点处理。
- V36 修复进行中目标偶发不替换：当前 Codex 的 Framer Motion 宿主会先以 `opacity:0` 挂载，旧映射在首帧误判不存在，而后续纯 style 显现不会触发结构观察器。composer 专属映射现改为“已连接且非 hidden/inert/display:none/visibility:hidden”的结构门禁，首帧即可标记并在显现后保持。
- V36 将输入器、queue 外层、每条 queue item 与 goal 外层的原生 border、border-image、outline、backdrop-filter 和 box-shadow 视觉中和，同时保留边框占位与所有 DOMRect；不使用 `border:0` 改变盒模型。
- V36 只读解包 `thread-summary-panel-components` 后，为环境信息卡增加官方 Section/直属 header 的完整 class-token 映射：Section 根保持透明，标题换为暖墨纸签，官方分隔线换为赭色发丝线；动态分区、按钮、折叠语义、行序和 300px 卡片几何不变。
- V36 定向结果：侧栏选中态 1/1、透明首帧目标 1/1、原生 queue/goal 堆叠与黑边中和 1/1、环境信息分区 1/1、forced-colors 1/1；本检查点仍不等同于真实 Codex 完整页视觉验收。
- V37 第一次真实联合门按合同拒绝：候选任务可见但未在时限内达到 queue/goal，未生成 PNG；失败路径确认原生恢复、watcher、root、launcher 与端口全部释放。随后完整页诊断发现捕获器在点击新任务后会被旧任务已经成立的 `thread` 状态抢跑。捕获器现必须先证明目标任务已成为原生 current/selected，再接受 surface/queue/goal，并在截图前复核一次；诊断 JSON同时记录 composer 祖先层的 computed paint，用于定位仍存黑色承载层。该工具修复不等于完成真实联合门。
- V38 已把环境信息卡收敛为一张连续纸面：`环境信息` 主标题以及 `子智能体`、`后台进程`、`来源` 分区标题均不再绘制独立深色底条、阴影或额外圆角，行、分隔线、折叠与 300px 原生几何保持不变。输入区上方黑色承载层同时依据当前 `app.asar` 的 `data-thread-scroll-footer` 来源，仅清除其内层渐隐绘制，不移除 sticky footer、障碍层或命中区。四项定向回归通过；完整 `1600×900` 原生结构夹具证据位于 `artifacts/test-runs/v38-environment-unified-20260803-141204/`，明确不等同于真实 Codex 窗口验收。
- V38 尝试真实单窗口联合取证时，便携 profile 自动恢复重任务并把整机 CPU 推至 100%；本轮立即完成原生恢复并精确释放所属 root、host 与专用端口，没有保留调试窗口。资源安全优先于重复实机捕获，因此最终真实窗口视觉门仍保持待验，不由夹具截图替代。
- V40 将真实整页取证的任务 locator 限定在原生 `aside.app-shell-left-panel` 内，并在候选通过、滚动前与 `page.screenshot` 紧前重复证明 current/selected + thread/scenery/queue/goal 门；该取证脚本合同 1/1 通过，检查点 `19069cd` 已推送。
- V41 只读预检再次证明两个开始菜单入口共用 Codex 内置 Node bridge，retained release `0.13.0-20260803-143153` 与 event-driven host 通过 verifier。当前 Store 包版本 `26.715.2305.0`、目录名和 `app.asar` 长度 `201143773` 字节与来源锁一致；完整 ASAR SHA-256 因 CPU `82.1%` 处于琥珀区而暂缓，不把轻量预检冒充最终验收。
- V42 接受用户实机截图对 V38 结论的否定：真实 `环境信息` 标题分支存在标题本体之外的 `bg-token-dropdown-background` 绘制承载层，并可能由 `::before` / `::after` 继续绘制深条。运行时只沿已定位标题到官方外卡的祖先链标记标题/标题承载层，并对它们及三个官方 Section 直属 header 的基础层与伪元素全部撤下 paint；外卡、Section、行、分隔、滚动、折叠、按钮、ARIA 和 DOMRect 不变。V38 fixture 只保留为历史证据，不能替代 V42 定向回归和真实完整页验收。
- V42 环境卡专项实机门已经通过：新安装 release `0.13.0-20260803-191843` 的完整页截图中，`环境信息`、`子智能体`、`后台进程`、`来源` 均直接使用外卡连续纸面，没有独立深色标题条；卡宽仍为 300px。该专项证据不含最终要求的同态 queue/goal，因此不关闭剩余联合门。
- V43 对最终联合门的第一次原生排队尝试保持失败即停：捕获器向真实 contenteditable 写入后使用普通 `Enter`，输入没有清空、queue 没有出现，因此没有生成 PNG；失败报告确认原生恢复、watcher、受管 root/owner 与专用端口全部释放。随后只读解包当前 `app.asar` 的 `prompt-editor`、`service-tier-icons` 与 `codex-composer-adapter`，确认编辑器恒将 `Mod+Enter` 映射为原生 `submit`，而本机普通 `Enter` 会受 `composerEnterBehavior` 影响；运行中默认 follow-up 在启用队列时走 `queue`，备用组合键才翻转为 `steer`。捕获器据此改用 Windows `Ctrl+Enter`，继续要求真实输入清空且出现 `.forge-composer-queue-item` 才允许截图。该工具修正已通过语法与生命周期 13/13；当前资源仍为琥珀档，下一次也是本检查点允许的唯一一次单窗口联合重试。
- V43 唯一一次 `Ctrl+Enter` 联合重试在连续绿色资源样本后执行，仍由真实 Codex 拒绝：任务已可见且编辑器已写入，但原生输入没有清空、queue 没有出现，捕获器没有生成 PNG。失败 JSON 记录 `submissionShortcut=Control+Enter`、`inputCleared=false`、`queueObserved=false`；随后原生 DOM 恢复、watcher 确认、精确 PID 树兜底、root/owner 与随机回环端口释放全部通过。联合整页门因此保持未完成，安装生命周期与原生恢复证据不得越级标记为最终完成；下一检查点必须先从当前 ASAR 的实际提交控制器继续定位该 profile 下未接受提交的原因，再申请新的单窗口验收轮次。
- V44 将第二次失败进一步收敛到编辑器状态准备：Playwright `fill()` 能改 contenteditable 的可见 DOM，但不足以证明 ProseMirror 控制器接收了可提交文档。捕获器现在先拒绝任何非空草稿，真实聚焦编辑器后使用键盘 `insertText` 走原生 `beforeinput/input` 路径，并新增 `editorInitiallyEmpty` 与 `inputPrepared` 两项布尔门；只有输入内容被控制器原样接收后才发送 `Control+Enter`。语法与生命周期 13/13 通过，本检查点不再启动窗口；该修正仍需后续新的单窗口联合实机门证明，不能把静态合同写成视觉完成。
- V45 单窗口联合重试在连续绿色样本后执行，V44 的草稿保护门按预期先于输入动作关闭：隔离 profile 仍保留上一轮由本项目写入但未被 Codex 接受的验收占位文本，因此 `attempted=false`，没有覆盖草稿、没有生成 PNG。失败路径再次证明原生恢复、watcher 确认、精确 PID 树、launcher 与随机端口全部释放。捕获器现只允许在现有草稿与本轮请求文本逐字一致时复用该本项目占位；任意不同文本继续失败闭合，绝不清空或覆盖。语法与生命周期定向合同 13/13 通过；真实联合整页门仍未完成。
- V46 已按 V45 的自有草稿门复用逐字一致的验收占位，证明 `editorInitiallyEmpty=false`、`reusedExistingOwnedDraft=true`、`inputPrepared=true`；但 `Control+Enter` 后输入未清空且 queue 未出现，因此没有生成 PNG，原生恢复、watcher、root/owner 与随机端口再次全部释放。继续只读核对当前 `app.asar` 后确认：隔离 profile 没有 `composerEnterBehavior` 或 `followUpQueueMode` 覆盖，故官方默认 `composerEnterBehavior=enter` 生效；该模式下普通 `Enter` 才是默认 follow-up 提交，而 `Ctrl+Enter` 会被运行中拦截为一次性的反向动作。捕获器现改为先证明真实 ProseMirror 获得焦点，再由该编辑器自身发送普通 `Enter`；此修正仍需下一次绿色资源窗口下的唯一单窗口联合门证明。
- V49 将任务切换中最常重建的 composer、编辑器壳、发送键、环境信息外卡/行和显式 selected/current 侧栏行改为稳定原生选择器直接绘制；V52.1 又为稳定根内部子树替换和 landing/thread surface evidence 新增补上单微任务首帧对账，首个 rAF 前即可获得动态标记，不再回落 140–520 ms 的普通延迟路径。动态标记继续承担 queue/goal、标题兼容和上下文判断，纯文本流式增长不会触发首帧路径；forced-colors 与停用恢复同时覆盖两条路径。侧栏直接规则只读取当前原生选中属性，因此单/多对话分支使用同一外层行宽，旧标记不会造成选中残影。
- V49 当时把背景从“任务切换轮换”收敛为“每个 renderer 每种模式固定一景”；V51.7 保留同模式的项目、任务、history、hash 与流式文本变化不换图、不重解码的低成本合同，但由第 209 条的显式编号顺序取代固定单景。隐藏文档暂停 refresh，恢复后只合并一次；解码 URL 缓存、过期待处理请求取消和最多两个 follow-up timer 共同限制运行成本。
- V51.8 在 V51.7 的 18 个 B/S 编号槽位、固定顺序、用户替换脚本、进度胶囊高对比 paint 和标准 README 上，进一步把快捷切图改为“最终 DOM `<img>` 自身解码后原位淡入”。真实 `Ctrl+Alt+B` 合同证明 document/runtime/style/overlay/主题标记对象、URL、history、导航条目与 `refreshCount` 均不变；新图等待期旧图持续可见，过渡层没有暗纸底色，稳态仍只有一张纹理。全量结果为 101 通过、9 个环境型跳过、0 失败；当前官方 renderer 已通过控制通道无重启热刷新，实机状态为唯一 Codex target、两个 `IMG` 层、稳态 1 个已解码层和 0 个在途请求。
- V49 最终真实联合取证使用唯一临时受管实例：完整页同屏包含原生顶部栏/侧栏、scenery 背景、真实 queue/goal、`736×100px` 主纸面和 `300px` 环境卡；主题稳态为 1 个已加载背景层、0 个解码请求。隐私相关原图和原始报告只留本机；可公开结论只记录几何、布尔门和 SHA-256。取证后 `disabled-verified`、原生状态 1/1、root/host 释放、CDP endpoint 不再接受连接且端口无 LISTENING。
- V50 根据用户最终澄清撤销 `184:25 / 96–120px` 主题几何：仍保留长方形悟空纸张和四个切角，但 surface、editor shell、editor、footer、按钮、padding 与锚点全部逐项沿用原生。四角只画在同一矩形内的 `pointer-events:none` 伪元素上，宿主维持完整矩形命中区。
- V50 为 thread footer 渐变、真实 Motion wrapper 内 progress fade，以及 portal 外 queue/goal stack 增加首帧原生直达规则；新 DOM 不再先出现黑带或原生灰面再等待 observer。生产拓扑、forced-colors 和停用恢复均由定向合同覆盖。
- V50 真实联合取证在 `2050×1106 @ 125%` 下同时出现真实 queue/goal、`300px` 环境卡与主题 composer。原生和主题 surface 均为 `736×98px`，完整几何比较最大差为 `0`、按钮身份与布局属性一致、四角纸面保留，thread footer 渐变为 `none`。隐私相关原图与原始报告只留本机；取证后原生恢复、watcher、精确 root/host 与回环监听释放全部通过。
- V50.1 根据用户“启动后没有主题”的实机反馈定位到 Store 进程交接：17:08 启动记录只有 `starting-event-host`，中转 root PID 与旧 host 均已退出，而正式 ChatGPT renderer 和 `DevToolsActivePort` 继续存活，因而主题从未进入 apply。host 现跨越该中转进程，按浏览器通道维持事件驱动生命周期，并可重接管仍存活的同 profile Codex target；新 release `0.13.0-20260808-171808` 已在当前窗口达到 `renderer-verified` 与 `watching-event-driven`。
