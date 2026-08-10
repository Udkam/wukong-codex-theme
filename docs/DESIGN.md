# 大圣归来 · 潇湘双境 — 设计与实现

## V51.9 二十二图画廊、低遮罩与原色保留

V51.9 在不改变 V51.8 原位 `<img>` 解码路径、持久状态版本或事件源的前提下，把活动画廊扩展为战斗 `B01..B13` 与风景 `S01..S09`。B06/S04 在原索引处替换，B10–B13 追加，因此所有未替换场景的数字索引保持稳定；每组仍按 `order` 独立顺序循环。

键盘切图保持同一原位运行时合同：`Ctrl+Alt+B` 取当前模式下一张，`Ctrl+Alt+Shift+B` 取当前模式上一张；两者都只在当前 battle 或 scenery 序列内循环，不改变模式，不触发页面刷新、主题重载或主题重建。

资产准备只执行源矩形裁切、等比缩放和 JPEG 编码。只有带信箱黑边的 B06 使用 `CropTop=50` / `CropBottom=50`；其他新图不裁切、不调色。页面层不对图像应用 brightness、contrast 或 saturation filter，颜色可见度只由每场景 tone 与 veil 控制。

veil 采用白底最坏情形下的双层场景遮罩、模式横纵遮罩与正文色共同建模，最低正文对比度维持 `4.5:1`。当前战斗最小值为 `4.501:1`，风景最小值为 `4.511:1`；不再用两组原始 veil 数值大小判断亮暗，因为不同 tone 的基础 alpha 不可直接比较，而是验证最终合成背景的感知亮度。22 张图合计 `8,355,513 bytes`、`45,201,592 px`，最大双图过渡仍为 `5,337,600 px`。

## V51.8 原位切图、全量编号背景与纸面状态对比度（历史）

V51.8 保留 V49–V51.7 的低占用核心：普通任务/项目/history/hash/流式变化只触发表面对账，不选择新图。变化只来自两个显式事件源：真实“新建任务”点击在 20 分钟自动冷却通过后推进一组，`Ctrl+Alt+B` 手动推进当前 battle 或 scenery 模式。没有后台计时轮播；冷却只在事件到来时比较时间戳，因此页面空闲时没有背景工作。

活动图库为 18 张，分别占用固定槽位 `B01..B09` 与 `S01..S09`。状态版本 3 保存每组规范顺序、游标、当前选择、上次自动推进时间和至多一个隐藏页待执行意图；旧版洗牌状态在读取时迁移到当前可见场景对应的有序游标。每次推进只取下一个编号，到 B09/S09 后回到本组第一张，因此手动切换可预测且不会随机重复。

加载路径复用双 layer 与单一可取消解码请求，但不再用临时 `Image` 解码后把同一 URL 交给另一 CSS background。非活动 layer 中最终参与绘制的 `<img>` 直接设置 `src` 并等待自身 `decode()`；在它就绪前当前图保持活动，且新图层的底色始终透明。解码完成后旧 layer 保持完全不透明，新 layer 置顶以 420 ms 对称缓动淡入，完成后立即清空旧 `<img>`。因此快捷键只改变背景状态，不导航、不刷新主题、不重建 style/overlay/标记节点；命中的键盘事件也不会继续传播给应用快捷键。隐藏文档只记录最后一次推进，恢复时合并一次；不会在后台解码多张。18 张压缩 JPEG 合计 `5,887,434 bytes`，解码总量 `37,329,592 px`，最大双图过渡 `5,337,600 px`。

色彩策略不对图片使用全屏饱和度/对比度滤镜；每个槽位仅声明阅读 veil，战斗组整体保持比风景组明亮。纸面 progress pill 内的完成 SVG、增加数字和删除数字分别使用深青蓝、深绿、深红，并以细描边提高暖纸面上的对比；所有规则只改 paint，不改几何。

用户替换由 `scripts/prepare-background.ps1` 写入稳定槽位，运行时继续只读取 `themes/active.json`。手动快捷键和素材替换都不新增页面控件、常驻 Node host、端口、PowerShell、WMI/CIM 或进程；dispose 必须移除监听并取消待处理意图，停用后完整回到原生。

## V51.5 低开销原生入口

V51.5 把“已有窗口复用”和“完全冷启动”分开处理。切换项目/对话、托盘恢复、二次显示与已有受管通道重附着都沿用当前官方 `ChatGPT.exe` 和 renderer，不触发重启。只有全部官方进程退出后再从原始 Store/任务栏 AUMID 冷启动，才可能需要一次快速接管；Electron/Chromium 的 `--remote-debugging-*` 参数只能在进程创建时传入，无法对已经创建的原生进程事后追加。

正式 bridge 使用预编译的 `runtime/activate-appx.cs`。安装阶段已把精确 AUMID 固化到受管 bridge；运行时激活器直接调用 `IApplicationActivationManager`，并在激活前发送 `ManagedLaunch` 命名信号。因此日常启动不再创建 PowerShell，不执行 `Get-AppxPackage`，也不运行 `Add-Type`。监督器收到相应窗口时消费该信号并跳过接管，避免 bridge 激活自触发。

原始入口的 WinEvent 仍先用 `QueryFullProcessImageNameW` 验证当前官方 EXE 完整路径，但随后只调用一次 `HasCodexCdp`；V51.4 的最长 6 秒重复核对被删除。稳态阻塞等待 `SetWinEventHook(EVENT_OBJECT_SHOW)`、`ManagedLaunch`、marker 文件事件和进程退出，不使用 WMI/CIM 或固定周期轮询。

用户 Start Menu 中由安装器维护的 `ChatGPT.lnk` 保留官方名称与图标，直接进入 repository bridge；固定这个同名图标是零双启动的日常方案。原始 Store/AUMID 入口仍由监督器兜底，在真正冷启动时承担一次快速接管的兼容成本。当前主题窗口没有为 V51.5 重启；聚焦合同 45/45 与补充定向合同 27/27 已通过，全量、热更新和原始 AUMID 冷启动实机门仍待执行。

## V51.4 原生入口事件监督（历史）

V51.4 不再要求用户辨认或重新固定一个项目快捷方式。Store、开始菜单和任务栏继续显示并启动官方 ChatGPT/Codex，应用名称、图标、包身份、正式 profile 和最终 `ChatGPT.exe` 均不变化；仓库只增加当前用户级的启动后监督层，不创建独立可见的 `Wukong Codex`。

安装器从当前 `OpenAI.Codex` AppxManifest 锁定包、`app\ChatGPT.exe` 和 `PackageFamilyName!ApplicationId`，编译单实例监督器并登记到 `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`。监督器通过 `SetWinEventHook(EVENT_OBJECT_SHOW)` 接收新窗口通知；回调只把 HWND/PID 放入有界处理流程，随后用 `QueryFullProcessImageNameW` 比较规范化后的完整官方 EXE 路径。只有安装后新显示、路径完全匹配且没有受管 DevTools 通道的窗口才允许切到 repository bridge；不会按进程名操作其他 ChatGPT/Codex 进程，也不会改写安装时已经存在的窗口。

非便携启动由 `runtime/activate-appx.ps1` 解析当前 manifest，并通过 `IApplicationActivationManager.ActivateApplication` 激活精确 AUMID。参数使用 UTF-8 Base64 在 Node 与 Windows PowerShell 5.1 之间传递；激活器只返回可验证的 PID、AUMID、包名、版本和 EXE 证据。版本化 WindowsApps 路径不再承担启动入口，只作为监督器的身份边界。

监督器稳态阻塞在 WinEvent/message loop，仓库 marker 由 `FileSystemWatcher` 接收变化；renderer host 继续使用 DevTools Target/Page/Runtime 与文件事件。实现不使用 WMI/CIM、固定周期进程扫描、稳态 target 轮询、服务、计划任务、IFEO 或 DLL 注入。新窗口后的路径、通道和重启判断有明确时限与重启预算，不构成常态采样。

`package.json` marker 或仓库目录消失时，已连接的 host 先撤销主题并验证原生 renderer；监督器随后删除自己在 HKCU Run 的精确值并退出。LocalAppData 只保留微型 bridge、监督器二进制与事件/安装状态，不复制 CSS、图片或可在仓库删除后独立运行的主题。V51.4 当前属于待测试候选：聚焦和全量合同通过前不触碰已打开窗口，之后再以一次受控 Store/任务栏启动验证完整闭环。

## V51.3 单一原生 ChatGPT 入口（历史）

当前安装器只管理用户开始菜单中的 `ChatGPT.lnk`。快捷方式继续显示官方名称与图标，以 Codex 包内置 Node 启动仓库 bridge；bridge 再启动真正的官方 `ChatGPT.exe`，因此主题窗口不是另一个应用或复制品。安装器不再创建 `Wukong Codex`、`ChatGPT - Wukong Theme` 或桌面主题入口。

旧版本创建的三个独立入口只在同时满足两项所有权证据时迁移：目标以 Codex 内置 `app\resources\cua_node\bin\node.exe` 结尾，且唯一参数解析出的 `.mjs` 位于 `%LOCALAPPDATA%\WukongCodexForge\launcher-bridges`。确认后先复制到 append-only shortcut history，再精确删除原链接；同名但不满足证据的用户文件保持不变。

该入口策略不能把 Store/AUMID 本身改写成 bridge。Store 安装、修复或升级若重新生成 `ChatGPT.lnk`，verifier 会识别官方 EXE 直连目标并明确要求重跑 `install-theme.cmd`。项目不以 ACL、IFEO、DLL、服务、计划任务或常驻监听阻止覆盖；这些机制会破坏签名包更新、安全边界或“删除仓库回原生”的低残留目标。

## V50 原生坐标上的持久四角纸面

composer、编辑器壳、发送键、环境信息外卡/行和显式 selected/current 侧栏行属于任务切换时会被 React 高频重建的表面。V50 延续稳定原生属性和精确 class 组合直达：新 DOM 在首次样式计算时即可得到主题 paint，不必先等待 MutationObserver 添加 `forge-*` class。运行时 class 保留为 queue/goal、动态标题、兼容选择器和上下文判断的补充，而不是这些高频表面的首帧前提。

V50 把输入器的完整 surface、editor shell、editor、footer、按钮与布局属性作为原生坐标合同，不再保留主题高度、比例或额外 padding 例外。悟空长方形纸张仍完整保留，只在同一原生矩形内的 `pointer-events:none` 伪元素上裁出四个 8px 角；宿主、内容坐标和矩形命中区均不变化。侧栏只接受原生 `data-app-action-sidebar-thread-active`、`aria-current` 或 `aria-selected` 的真实外层行，因此单对话和多对话项目共用同一宽度来源；旧节点即使在 React/observer 交界暂留标记，也会立即失去选中 paper。forced-colors 同时撤下直接规则与标记规则的位图/伪元素，主题停用仍由移除注入样式完整恢复原生。

V49 曾在每个 renderer 会话中分别固定一张 battle 与 scenery 场景；V51.6 保留“普通 task/project/history/hash 与流式回答不推进”的资源边界，但用显式事件牌堆替代永久固定双图。landing/thread 模式变化以 420 ms 单向叠化过渡到该模式当前选择；只有通过冷却的新建任务或手动快捷键才会产生新选择。已解码 URL 复用，过期请求立即取消；隐藏文档暂停主题 refresh，恢复前台只合并一次。MutationObserver 只把表面结构变化视为刷新信号，既有对话中的纯文本流式增长不触发整页重映射。

## V42 环境卡单一纸面补强

V42 不给 `环境信息`、`子智能体`、`后台进程`、`来源` 添加题签、深条或独立卡片。唯一可见材质来自官方 300px 外卡上的连续纸面，标题、分区、行与分隔继续位于同一原生容器内。

当前打包 UI 的主标题文字可能嵌在另一个带 `bg-token-dropdown-background` 的绘制承载层中。旧 `closest()` 在标题本体提前停止，导致真实窗口仍露出深色条；V42 改为从已定位标题向外卡逐级上行，只标记标题/header 与显式 dropdown-background 承载层。同时，三个分区只接受当前 ASAR 的 `Section -> 直属 header` 双层 class-token 签名，避免按中文标题或宽泛容器猜测。

这些标记的基础背景、背景图、边框色、阴影、backdrop 以及 `::before` / `::after` paint 全部透明；不删除伪元素、不改 `content`，也不改外卡、Section、标题、行、按钮的 display、position、width、height、padding、gap、overflow、z-index、DOM 顺序或事件属性。分隔线仍由官方 Section 层承担，forced-colors 继续交还系统。

## V34 事件驱动正式生命周期与范围冻结

V34 不再把开发期 `PowerShell -> watcher` 路径包装成正式交付。保留式安装器一次性生成并保存开始菜单适配器；快捷方式目标为当前官方 Codex 包内置 Node，参数只包含一个 append-only `.mjs` bridge。bridge 检查 retained package marker：存在时启动 `runtime/host.mjs`，不存在时直接启动官方 `ChatGPT.exe`。

host 只使用 Node 内建 WebSocket、浏览器 Target/Page/Runtime 事件和 marker 文件系统事件；不启动服务、不安装计划任务、不维持 PowerShell、不做 1700ms target poll。它拥有一个官方 ChatGPT 根进程，根进程退出即结束；主题停用先恢复并验证原生 renderer，失败则 fail closed。当前已打开的非受管窗口不被重写。直接 WindowsApps/AUMID/协议/第三方入口可能绕过受管开始菜单链。

两个 Hatch Pet 与葫芦都不属于 V34 发布门。`releasedPetIds` 为空，打包/安装链对宠物 no-op；所有现有宠物文件、选择和历史资产保持原样。V34 的视觉边界仅是已实现的背景、landing、sidebar/topbar、composer/queue/goal、progress pill 与环境卡 paint 替换。

V34 当时的本机保留式安装落到 append-only release `0.13.0-20260803-191843`。普通与主题两个开始菜单入口均以当前 Codex 包内置 Node 启动同一 bridge；当时环境卡专项完整页已经证明四个标题与唯一外层纸面一体，但 queue/goal + 环境卡同态完整页尚待单独取证。该历史门已由顶部 V50 真实联合证据关闭。

> **V51.9 现行候选设计。** V51.8 及更早章节保留为演变记录；冲突处以 `CURRENT_GOAL.md` 和顶部 V51.9 / V51.5 / V50 章节为准。公开联系邮箱已由当前 GitHub 账号确认；candidate 仅保留用户视觉验收发布标记。

## V15：本机原生几何上的游记纸面系统

V15 把“高保真复刻”分成两个互不混淆的真值源：

1. **原生几何真值**来自本机 `ChatGPT.exe 26.715.2305.0` 的只读 `app.asar` 与真实 renderer。包括主输入器在内，宽高、间距、padding、位置、响应式公式、动态增长和点击热区均由官方 DOM/CSS/JS 决定；主题轮廓只属于 paint。
2. **视觉真值**来自用户最终确认的输入器三图和《黑神话：悟空》“游记”目录参考。纸张纤维、云纹、边角线、深墨条、浅纸选中带、旧金/烟褐/骨纸配色和交互状态由这些参考决定。

### 当前本机几何基线

| 项目 | 官方值 / 公式 |
| --- | --- |
| 基础 spacing / 正文字号 | `4px` / `14px`，行高 `1.5` |
| 主工具栏 / 小工具栏 / pane 工具栏 | `46px` / `36px` / `40px` |
| sidebar | `clamp(240px, 275px, min(520px, calc(100vw - 320px)))` |
| sidebar row | `30px`，row radius `10px` |
| thread 最大宽度 | `48rem`，即 `768px` |
| composer 多行 editor 最小高度 | `2.75rem`，即 `44px` |
| composer / send button | `28×28px` |
| composer 单行 radius token | `22px` |

fixture 使用 `deviceScaleFactor:1.25`，对应当前 ChatGPT renderer。sidebar、topbar、composer surface、editor wrapper、editor、footer 和内部控件全部由官方几何负责；活动 CSS 不声明主输入器高度、比例、padding 或位置，只在同一 surface 内绘制四角纸面。`tests/native-asar-ui-contract.test.mjs` 直接读取安装包，官方组件拓扑或按钮 token 漂移时 fail closed，而不是继续用旧截图伪装通过。

### 输入器与纸面层级

- `composer-main.webp`：主输入器纸面。
- `composer-strip.webp`：进行中目标、上下文与面板条。
- `composer-pill.webp`：计划/变更摘要等小条。
- `paper-tile.webp`：所有纸面统一底纹，避免三张参考之间出现不同“地面图案”。

所有材质由用户最终参考的透明合同源确定性重建。V17 活动纸面使用完整实心中央与周期化底纹：主卷和各原生行只在 `pointer-events:none` 静态绘制层缩放一次对应源图，不能把一个绘制层跨多行纵向拉伸。原生 editor、footer、按钮、文字、placeholder、ARIA 和 hit box 均保留。助手回答不套纸框。

### V50 原生几何输入器与 V22 内层消息叠页

用户最终要求是“替换后的所有位置不变，同时保留长方形四角纸张”。运行时把可见官方 `.composer-surface-chrome` 标记为 `forge-composer-frame`，把可识别 editor 的直属原生外壳标记为 `forge-composer-input-shell`，并用原生结构识别 footer 后标记为 `forge-composer-footer`；不增加替代输入框、按钮或文字节点。当前 Codex 内部 editor 已不稳定保留 `.ProseMirror[role=textbox]`，所以 editor 只作可选辅助，不能再成为整块纸面是否生效的前置条件。composer component 由 `data-codex-composer-root` 的直属子节点关系推导：它必须包含官方 surface，并且不能是直属 above-composer portal；生产和 fixture 都不依赖测试专用组件属性。

- 外框宽度、高度、水平位置、底部锚点和响应式结果全部由原生布局决定；活动 CSS 不再声明 `aspect-ratio`、`min-height` 或 `max-height`。
- 轮廓在 `::before` paint 层使用 8px 低成本四角 `clip-path: polygon(...)`，形成同一矩形内的长方形卷页；不使用 SVG filter、持续合成层或逐帧动画。
- `composer-main.webp` 只负责纸面与边饰，不能作为 alpha mask。V17 重建产物已经把中央修成完整不透明纸面；旧中央透明洞版本仅作历史证据，不得回流活动清单。
- editor、editor wrapper 与 footer 全部沿用当前原生 padding、grid 和按钮坐标；主题不得为卷页增加安全区、内缩或上移。
- 四角卷页只绘制在主输入器的 `::before` 静态纸面层；该层不命中鼠标，原生宿主自身保持 `clip-path:none` 与完整矩形热区。焦点阴影也只作用于纸面层，不削减或移动编辑器与五类按钮。
- Windows forced-colors 取消纸面伪元素、切角和位图，回退系统原生矩形与系统色。

排队、目标、上下文、进度 pill 和环境信息窗口同样只换 paint，结构和尺寸继续使用原生值。主 composer 的 `[data-codex-composer-root] .composer-surface-chrome`、直属 editor 壳与 footer 内官方 submit button 同时拥有稳定原生 CSS 直达规则，因此任务切换重挂载时无需等待运行时 class 才能获得纸面与清晰箭头。V21 夹具曾错误地把每条排队消息提升为独立 outer panel，导致每层都像一张互不衔接的卡片；V22 以当前 `OpenAI.Codex 26.715.2305.0` 解包源码重新建立生产拓扑：

- above-composer wrapper 仍为官方 `order-2 flex min-w-0 flex-col`。
- 排队区只有一个 `relative min-w-0 overflow-clip text-token-foreground` 外层 panel；其内部 list 保留官方 `vertical-scroll-fade-mask hide-scrollbar flex max-h-[30dvh] flex-col gap-px overflow-x-hidden overflow-y-auto px-3 py-row-y`。
- 每条排队消息是 list 内的 `overflow-visible` wrapper，内部行继续保留 `group flex min-w-0 items-center justify-between gap-2 py-0.5 text-sm`；进行中目标则是紧随其后的另一个外层 panel，内部行保留 `px-3 py-row-y`。
- 运行时必须同时命中这些生产 token 才标记 `forge-composer-queue-item`，不得按“引导”“目标”或其他本地化文本猜测。

外层 queue / goal panel 共同提供一块连续、实心的暖灰黄赭纸面；只有 stack 中第一个外层 panel 的绘制层使用两个外部上角。其 29px 顶饰由固定高度 `::after` 单独绘制，`composer-strip.webp` 按 `100% 58px` 取上半部，因此排队项增多时不会拉伸角饰。后续 goal panel 不再重复外部切角或阴影，只通过直边与前层连续衔接。每个内部 queue item 再拥有一层独立 `paper-tile.webp`，按原生 12px list 内距向两侧安全延伸，并用 `gap-px` 形成 1px 接缝；内部叶片本身不裁切、不加卡片阴影、不改变矩形热区。主输入器和独立 progress pill 不属于该叠页：前者使用原生几何内的四角长方形纸面，后者继续使用 `999px` 全圆轮廓。

用户最新要求把整套输入纸面收进能衔接战斗/风景背景与深墨侧栏的暖灰黄赭范围。V17 生成器以同一 `RGB(135,117,93)` 目标和 `0.86` 纹理对比系数重建；实际 main/strip/pill/tile 中位色落在 `RGB(134–135,117,93–94)`。CSS 回退色统一为 `#87755d`，主墨色为 `#080604`；纸纹无运行时 filter，暗纹理对比度和 forced-colors 回退继续由定向合同锁定。

### V23 环境信息经卷卡片

右侧环境信息窗口不使用截图尺寸、文本猜测或自建面板。当前 `OpenAI.Codex 26.715.2305.0` 的 `thread-summary-panel-components-t019TZYb.js` 是唯一结构真值：外层以 `data-pip-obstacle="thread-summary-panel"` 标识，卡片固定宽度为 `300px`，内容宿主保留官方 `rounded-3xl`、滚动与最大高度结构；标题、行、操作按钮继续使用 `thread-summary-panel-*` 的原生 `data-slot`。

官方外卡完整 class token 与 `[data-slot="thread-summary-panel-item"]` 行 slot 由 CSS 直接绘制；运行时继续在同一结构上增加 `forge-right-panel`、`forge-right-card`、`forge-right-title`、`forge-right-section`、`forge-right-section-title` 与 `forge-right-row` 标记，补足动态标题与兼容分支。卡片宿主本身保持透明、`clip-path:none` 和原生矩形命中区；暖褐纸纤维、8px 角饰与双层内沿只由卡片的 `pointer-events:none` 静态伪元素绘制。`环境信息` 主标题以及 `子智能体`、`后台进程`、`来源` 三个分区标题的背景、背景图、阴影、圆角裁切和模糊全部透明，让唯一纸面连续贯穿 7 行内容。行高、分隔位置、加号按钮、折叠箭头、链接、键盘焦点、ARIA、滚动和 300px 宽度均不改写；forced-colors 隐藏位图和伪元素并交回系统色。

`tests/native-asar-ui-contract.test.mjs` 直接锁定本机 300px、宿主 class token 与稳定 slot；`tests/native-surfaces-runtime-v14.test.mjs` 则逐项比较主题前后的面板、卡片、标题、7 行、3 分区和加号九点命中几何。V38 完整无头证据位于 `artifacts/test-runs/v38-environment-unified-20260803-141204/01-full-multi-guided.png`，其中排队、目标、主输入器、侧栏、顶部栏和一体环境卡同屏；该证据仍不等于真实 Codex 用户验收。

### V24 背景四阶段覆盖与纹理生命周期

背景技术门以同一个临时无头页面连续验证四个真实状态，不通过重新加载页面伪造切换：新建页战斗稳态、新建页进入对话的交叉淡化帧、对话风景稳态、返回新建页后的战斗稳态。每一帧同时量取 overlay、活动层、图片层和 veil；四层必须逐边等于 `1600×900` 视口并保持 `background-size: cover`，不能出现只覆盖中央内容区、侧栏露底或窗口缩放后才补挂题字的情况。

纹理生命周期继续执行低占用硬合同：稳态只允许一个已解码背景节点；交叉淡化期间只允许当前与下一张两个节点；不预取第三张，不保留永久全屏 `will-change`，不使用全屏 CSS filter。首次图片只有在 `decode()` 完成后才公开主题 ready，返回新建页后同样由状态变化直接提交“悟空”印记与题字，不依赖 resize。restore 必须移除主题 overlay 和所有本项目标记，交回原生 paint。

定向证据位于 `artifacts/test-runs/v24-background-transition-2026-07-31T23-55-59-699Z/`：四张 `1600×900` 完整页面截图与 `capture.json` 分别记录 `1 → 2 → 1 → 1` 个已加载背景、`0` 个预取节点和正确的 battle/scenery 模式。该捕获只证明当前源码、运行时与原生结构 fixture 的背景职责，不替代正式安装窗口的最终用户验收。

### 侧栏与顶部状态映射

| 原生对象 | 游记映射 | 状态 |
| --- | --- | --- |
| 项目条、无项目对话 | 一级深墨目录条 | 默认深墨；hover/focus 提亮纸纤维；expanded 保持一级层级 |
| 项目下对话 | 二级目录正文行 | 默认无整块底；hover 为窄深墨刷痕；selected 为浅纸选中带 |
| 新建任务等顶部入口 | 一级目录操作行 | 保留原生图标/文字/30px row，只替换底材与状态 |
| 文件/编辑/视图/帮助 | 原生菜单触发器 | 完全保留官方 paint 与状态，不做主题替换 |

生产 hierarchy 以当前 ASAR 的稳定属性为锚点：`data-app-action-sidebar-project-row` 是项目条，`data-app-action-sidebar-thread-row` 位于 `data-app-action-sidebar-project-list-id` 内时是项目下对话，位于 `data-app-action-sidebar-section-heading="Tasks"` 且不在项目列表内时是无项目对话。选中态读取 `data-app-action-sidebar-thread-active` / `aria-current`，展开与折叠读取 `aria-expanded` / `data-app-action-sidebar-project-collapsed`；不使用 `nth-child` 或测试专用属性作为生产判断。

当前运行时已覆盖默认、hover、focus、selected、expanded、collapsed、menu open、disabled 与原生 unread/running。`nav-list` 的 current/disabled、`worktree-init-row` 的 `role=button` / `tabIndex` / `aria-disabled` / `aria-current`、`task-row-status-indicator` 的未读 token 与 loading 分支、以及 24×24 原生 spinner 都由 `native-asar-ui-contract` 直接读取本机 ASAR 锁定。

交互态只改 paint：focus 使用朱砂内缘替代浏览器矩形默认框；expanded/collapsed 保持一级目录材质但以左缘朱砂、明暗和按压阴影区分；selected 使用浅纸带；disabled 保留所在层级的底材并降墨色。对于“外层 row + 主按钮 + 尾部菜单”的原生结构，只有 surface 本身或直属主操作禁用才会禁用整行，尾部菜单独立禁用不会误伤。未读圆点/计数继续继承 `--vscode-textLink-foreground`，running 只着色原生 24×24 spinner，不制造新徽章。

Windows forced-colors 使用 `#root` 高优先级回退压过 hover/focus/open/expanded/disabled 的 `!important` 组合，移除位图、阴影和主题 opacity，并把焦点轮廓交回系统。当前无头状态矩阵见 `artifacts/test-runs/v15-native-surfaces-2026-07-25T04-30-21-640Z/09-sidebar-state-matrix.png` 与 `10-topbar-state-matrix.png`。Electron 应用菜单及其四个 renderer 触发器都保持官方 paint；后续若要改菜单必须另立可逆方案，不能用伪 DOM 宣称完成。

### 新建页印记

官方 `[data-testid="home-icon"]` 提供 56×56 原生槽位。旧 SVG 短棍与后续微缩金箍棒均因卡通贴纸感、器物失真或多背景辨识不足而否决。V16 从 Steam 官方透明 logo 中确定性裁出“悟空”书法与朱印，生成深墨/骨色两张 336×336 WebP；只通过 `--forge-ui-landing-mark` 与 `--forge-ui-landing-mark-dark` 在原槽位锚定 168×168 绘制层，保留原始 SVG 节点、56×56 DOMRect、aria 和 restore，不另加徽章、光晕、动画或滤镜。

产物可见边界为 `282×191`，在 168×168 绘制层内约为 `141×96`；相对 56×56 锚点的可见范围约为 `x=-42.5–98.5 / y=-41–54.5`，因此视觉主体主要向上展开，不侵占标题。绘制层绝对定位且不参与布局，56×56 容器、项目布局与热区保持不变；在 V16 当时的 9 图清单中，场景 0/4/8 使用深墨版，其余场景使用骨色版。现行 V51.7 则由 `themes/active.json` 的 `mark` 字段逐图决定，当前为 B07/B08 使用深墨版。题字在原 30 px headline 内光学收至 27 px、字距 `.035em` 并上移 2 px。原生 kicker 与描述说明保留布局矩形和文本，只在主题激活时视觉透明。

### 活动图库边界

V15 当时只组装 9 张背景：`erlang-ink-duel` 与 `great-sage-staff` 为主战斗池，`storm-bearer` 与 `shadow-confrontation` 为次级战斗池，5 张纯风景保持 thread 池。现行 V51.9 已扩展为 B01–B13 与 S01–S09 两组固定编号序列。默认/原生预览在 V15 当时统一指向 1920×1080 的 `great-sage-staff.jpg`。用户否决的 `destined-afterimage.jpg`、`yaksha-king-rift.jpg` 与旧 1256×707 `great-sage-return.jpg` 均保留在本地素材/历史证据中，但不生成 CSS 变量、不嵌入 payload、不复制到最小运行包。

V15 当时收敛后的图库解码总量为 19,258,880 px，交叉淡变最坏两图为 4,743,680 px。现行 V51.9 的 22 图实测值分别为 45,201,592 px 与 5,337,600 px，仍只按需解码当前一图，过渡时最多保留两图；场景数量不会改变原生页面结构、路由判定或全窗 `cover` 合同。

背景 ready 门不把 `Image.complete` 当作已可绘制的替代证据：缓存/data URL 同步 complete 与普通异步 onload 共用唯一 `decode()` 收口，解码完成前继续保留 Codex 原生 carrier paint。结构刷新也改为先生成本轮目标标记集合，再只删除失效 class；稳定 composer 的几何始终保持同一组原生值，任务切换时也不会先闪回原生灰色 paint 再重绘纸张。新建页题字的 ARIA 只在值实际改变时写入，避免相同属性写入反复唤醒 MutationObserver。

### 成本与回退

九张活动 UI WebP 中的两张 landing 字标合计约 59 KiB 压缩数据；单张 336×336 解码约 441 KiB，两张理论合计约 882 KiB，仍低于单 UI/装饰图硬门。材质静态绘制，无 timer、动画、网络请求、常驻 filter 或持续合成提示。强制高对比模式隐藏全部材质并恢复系统面。葫芦已从当前目标删除，不进入活动主题或包。当前只完成 fixture、像素与本机源码合同，不等于真实 Codex 用户验收。

> **0.12.3 / V13.3 历史设计。** 以下章节继续保留；冲突处以 V15 为准。

## V13.3：原生背景状态机、资源硬预算与首帧可靠的新建页

V13.1 的活动范围只有全窗背景与用户明确授权的新建页题字/图案，不恢复任何旧 sidebar、composer、环境卡、消息、按钮或滚动条样式。页面增加一个 `aria-hidden`、`inert`、`pointer-events:none` 的 `#wukong-forge-background`；覆盖层仍有两个 image/veil layer，画面 `cover` 全窗，战斗池为索引 0–5，风景池为索引 6–10。

### 官方 UI 源锚点与完整覆盖

只读检查 `OpenAI.Codex_26.715.2305.0` 的 `app.asar` 后，V13.1 不再通过猜测祖先来清透明度。官方 `app-shell-CHGA5kyS.js` 创建 `<main class="main-surface">`，官方 CSS 为它绘制 `--color-token-main-surface-primary`；这正是用户截图中只剩侧栏可见背景的黑块。活动 CSS 直接命中 `main.main-surface` 与 `[data-app-shell-main-content-top-fade]`，只把 `background-color/background-image` 清空，圆角、阴影、overflow、尺寸与事件全部继续由 Codex 管理。

新建页使用官方 `app-main-B98AP2a1.js` 的稳定节点：`[data-testid="home-icon"]` 是 56×56 原图标位，`[data-feature="game-source"]` 是原 headline 位。图案原位绘制官方“悟空”书法与朱印，题字原位显示“此去，欲破何局？”。原生 kicker 与描述说明由内容模式识别后只做透明绘制；原始文字节点、原始 SVG、DOMRect 和布局占位均保留，停用时移除标记并恢复 aria。官方 headline 内的项目选择按钮自带点状下划线；主题激活时只把这条原生装饰透明化，避免它穿过替换题字，停用后由移除样式完整恢复。完整只读证据见 `artifacts/asar-ui-audit-20260724T0225/AUDIT.md`。

官方 hero 通过 280 ms opacity 动画进入。V13.3 以“有布局但尚未绘制”作为稳定节点判据，并把 `game-source`、`home-icon` 与新建任务容器加入结构监听；另有 120/420 ms 两次 renderer 内启动探测作为有界兜底，之后页面不轮询。刷新调度器记录下一次到期时间，较早探针会替换较晚的合并 timer，因此两次探针不再被错误折叠成约 520 ms 的单次刷新。MutationObserver 同时检查 `childList` 的目标外壳，ResizeObserver 观察零尺寸原始标题/图标，所以 React 只向既有外壳补入内容时也能自动映射。题字与图案的 CSS 锚点改为主题自有 `data-forge-title-copy` / `data-forge-mark`，不再依赖 React 后续 commit 可能覆写的 `className`。当透明旧 hero 与可见对话短暂共存时，可见且含 turn 的对话是更强路由证据，避免背景误回战斗池。

覆盖合同不仅检查 `fixed + inset:0 + cover` 的 computed style，还在首次提交与窗口 resize 后分别要求 overlay、活动 layer、image 和 veil 的 DOMRect 与 viewport 完全一致；中央 `main.main-surface` 与 top fade 只清除 paint，不改变原生圆角、阴影、裁切、几何或命中区。

V13 重写了切换状态机：

1. 读取 session 状态时把负数、字符串和越界游标归一到 `-1`；battle/scenery 各选择一次并持久保存，renderer 存续期间不因同模式导航继续推进。
2. 可见且包含 turn 的 thread 优先于只保留布局的旧 landing hero；反向情况下，祖先链上的 `hidden`、`aria-hidden`、`inert`、`display:none`、`visibility:hidden` 或 `opacity≤.01` 会使旧 turn 失效。
3. 路由/历史变化、任务树导航或 composer 提交只安排有限次模式复核；任务身份和 hash 不参与场景选择，同模式复核不会换图。
4. 首帧和模式切换场景都先通过唯一一个 `Image` 加载并尝试 `decode()`；首帧 ready 前保留原生 main/fade paint，成功后才一次性公开背景。已成功解码的 URL 直接复用，进行中只保留最后一个待提交场景；若目标已是当前可见层，旧待处理请求会立即取消。
5. 覆盖层缺失或层数不为 2 时先撤销 `background-ready`、恢复原生 paint，再取消旧 generation 的 timer/请求并原位重建；watcher 探针同时检查 style、runtime、ready、两层、活动层和非空活动图。
6. ResizeObserver 只在 workspace 身份变化时重绑，不在每次 refresh 中断开再观察；MutationObserver 把表面结构信号与普通流式文本分离，稳定回答期间必须达到 refresh quiescence。
7. 文档隐藏时清除待执行刷新并只记录 dirty；恢复可见后合并一次刷新。杨戬白场使用更高 specificity 的 veil，forced-colors 下背景隐藏并恢复系统 `Canvas`。

### V13.3 资源硬预算

活动图库的 11 张图片压缩共 2.45 MiB，但全部展开为 RGBA 约 84.76 MiB。旧实现首次 `refresh()` 会主动创建 11 个 `Image` 并解码全部背景；两个全屏层在淡变后仍保留上一张图片，且永久使用 `will-change`、滤镜和轻微缩放。这些成本会在反复调试重注入时叠加。

V13.2–V13.3 改为：

1. 首屏只解码目标一张；解码完成前不清除原生 main/fade paint，避免 CSS URL 尚未解码时出现空暗底。
2. 后续只有 landing/thread 模式切换才可能解码目标一张；同模式任务变化不换图。任意时刻最多一个请求，新请求先取消旧请求，已解码 URL 可直接复用。
3. 成功、失败、超时、请求替换和 runtime dispose 共用同一清理路径：清 timeout、事件处理器、`src` 和 in-flight 记录。
4. 图层行内只保存短 `var(--forge-bg-N)`，不再复制完整 base64 URL。
5. 过渡结束立即把退场层的图片、veil、位置、亮度与场景数据清空；稳态只有一张图片。
6. `will-change: opacity` 只在 `data-forge-transitioning=true` 的 420 ms 模式过渡内存在，并且只分配给置顶淡入的新 layer；全屏 `filter` 与 `scale(1.001)` 被移除，色调只由廉价 veil 完成。
7. 导航/提交后的有界复核只保留最新一组，新的 route event 会清除旧的 2 个 follow-up timer；快速连续操作不会按事件数累计 timer。隐藏页面不执行刷新，流式文本 mutation 不进入表面刷新信号。
8. payload 组装前直接解析 JPEG SOF、PNG IHDR 与 WebP VP8X/VP8L/VP8 尺寸头；单背景、图库总量、双图过渡和 UI 材质同时受解码像素预算约束，异常尺寸或超限文件不会进入 base64 注入表达式。

现行资源合同不做相邻场景或跨模式预取。静态门限为单背景 12,000,000 px、图库唯一文件总计 48,000,000 px、最大两张合计 16,000,000 px、单 UI/装饰图 4,194,304 px、压缩图库总计 24 MiB。V51.9 的 22 图实测总计 45,201,592 px，最大两张合计 5,337,600 px，压缩文件合计 8,355,513 bytes；历史低分辨率或用户否决的候选图仍可原位保留，但不进入活动清单或最小包，不能把“文件仍在仓库”混写成“当前发布仍使用”。

V13.3 在真实 Codex renderer 稳态采样时为 `loadedLayers=1`、`preloadInFlight=0`、`transitioning=false`，V8 heap 使用约 126.3 MiB。另一个完整调试 Codex 实例会带起 48 个进程，稳定工作集约 2.93 GiB；这不是单张主题背景的占用，却会直接造成双窗口卡顿。因此开发期常态只保留控制窗口：调试实例仅在实机截图与指标采集期间临时启动，完成后立即关闭，并独立核验其 watcher、子进程与专用端口均已释放。

### Composer V9：原生几何纠偏与三案审稿

V7 因 footer 分隔线、透明可读性和控件遮挡被整体否决。对 V8 的独立复核又证明其 fixture 不是可信原生基线：它把 composer 固定为 `736×96`、把原生 `overflow:hidden` 改为 `auto`，1 px 主题边框使 host 内的 editor/footer 发生 1 px 位移并把可见宽度收窄 2 px，预览图标也不是当前 Codex 的真实控件。V8 三案因此冻结为失败历史，不进入 runtime。

V9 位于 `docs/design/composer-options/v9-black-myth-native-proposals-20260724/`，先以只读官方 UI 锚点和 [Interface In Game 的《黑神话：悟空》UI 归档](https://interfaceingame.com/games/black-myth-wukong/)校正形状语汇：实际界面更接近凝墨留白、短幅残纸选中带、朱砂点和器物断口，而不是整圈金框、武器缩略图或发光 HUD。三个候选分别为：

| 方案 | 结构识别点 | 刻意不做 |
| --- | --- | --- |
| A · 章回残墨 | 单向凝墨、短残纸选中带、朱点与破边朱批 | 不做卷轴、全幅金线或中央贴图 |
| B · 金箍锁锋 | 原 32 px 发送座内的暗红漆芯与两道磨损金箍 | 不横画完整金箍棒，不改向上箭头 |
| C · 大圣翎影 | 烟褐旧纸断口与发送侧双翎负形 | 不放人物或装备贴图，不新增按钮 |

V9 的审稿尺寸是当前实机常见的 `736×98` 与 `560×98`，同时验证 `154 px` 多行增长态；生产实现不得锁死这些高度。主题注入前后 host、editor、footer 和五个按钮的 DOMRect、原始文字、ARIA、placeholder 与五点命中区必须全等，`overflow:hidden` 保持不变。候选只使用 CSS 静态层和内嵌矢量线条：零外部请求、零候选位图解码、零 JS timer、零动画、零 filter、零 `will-change`；reduced-motion 为零过渡，forced-colors 隐藏装饰回退原生面。用户选择前，V13 runtime 和最小包均不加载 V9 CSS。

### 开发期启动适配器（非最终交付）

现有稳定安装仍把最小包写入新的 `releases/<版本-时间>/app` 并保留 hash bridge，供临时调试实例回归。调试窗口不能在截图或指标采集后继续保留；关闭后必须核验 launcher、watcher、子进程和专用端口均已释放。`capture-live-playwright.mjs` 的普通模式只连接、截图而不擅自关闭任意窗口；只有显式提供临时 root PID、launcher PID、disable request 且 CDP browser PID 匹配时，`--close-debug-after-capture true` 才会在成功和失败共享路径中先等待原生恢复及 watcher 确认，再关闭该一次性 browser，并验证 root、owner 与端口释放。选任务、等待稳定或截图前超时也必须进入该路径，记录 `capture-failed` 且不得制造 PNG。当前 Windows Electron 偶发在 `Browser.close` 后关闭所有 renderer 却保留 portable browser root；捕获器只有在上述三重归属证明已经成立、且 20 秒释放期失败时，才会以精确 `/PID` 结束该调试树，禁止 `/IM`、进程名匹配或触及普通控制窗口。该入口是开发期工具，不再宣称为“下载即用”的最终启动集成。按用户要求，最终随 Codex 启动而启动、随 Codex 关闭而关闭的宿主级方案必须等全部背景、新建页、composer 和 Hatch Pet 视觉工作完成后再单独设计与验证，且不能只依赖 PowerShell。

开发期 watcher 当前仍每 1700 ms 检查一次 loopback renderer，并在目标新建或主题状态缺失时重应用；真实采样中它的工作集约 51.8 MiB，launcher 约 115.1 MiB。这是临时审计链的已知成本，不与“renderer 页面没有常驻布局/动画轮询”混为一谈，也不满足最终最小资源启动合同。最终宿主方案必须消除 PowerShell launcher 与低频 CDP 轮询，而不是仅调整间隔后宣称完成。

该适配器只覆盖这两个经过验证的入口；Store AppX、AUMID、协议或第三方固定项可绕过它。已经运行且没有远程调试端口的普通 Codex renderer 不能被文件复制热附加，安装器因此不关闭或伪装修改当前控制窗口；V13 在下一次从受管入口启动时生效。

### 新录制的动作证据边界

`Replay 2026-07-24 00-30-17.mkv` 是用户为小天命人补录的动作参考。跑动可以提取步频、支撑脚、躯干起伏和持棍惯性；棍花只有背面视角，只能证明背部剪影、重心转移、脚步与棍路连续性。它不能单独证明正面握法、脸部、厌火套正面细节或被身体遮挡的神锋棍段。动作审计可以追加逐帧证据，但在完整基础角色通过前不得生成或写入 canonical atlas。

> **0.11.0 / V12 历史设计。** 以下章节继续保留；冲突处以 V13 为准。

## V12：背景正式化，组件先审后装

V12 把活动 runtime 收敛到一个职责：在不改变 Codex 原生 UI 的前提下提供战斗/风景双场景背景。`#wukong-forge-background` 内含两个 fixed layer；每层分为 image 与 veil，使用 `cover`、独立焦点和 820 ms opacity 交叉淡变。新建任务从索引 0–5 的战斗池轮换，对话从索引 6–10 的风景池轮换，两组 cursor 分开写入 sessionStorage。背景节点无语义、无交互并在强制高对比模式隐藏。

V11 的 sidebar、composer、Environment 卡、消息、按钮、滚动条和 motif 样式文件继续留在仓库，但 V12 plan 主动退役 V4–V11 runtime key，清除旧标记和旧 overlay，不再把这些视觉写进页面。

### composer 审稿合同

V1–V3 的共性失败是“主体仍为原生圆角框，只在外面贴古风边条或微缩道具”。V4 `夜叉护匣 · 神锋发令` 继续失败：把完整夜叉衣甲、护腕和神锋裁成极窄碎片后，装备结构与材质全部失真。V5 又退化为泛用棱角面板；V6 的 `厌火襟匣` 在 1× 下读成宝石徽章，`如意棍枕` 读成科幻状态条。V1–V6 全部冻结，不进入 runtime，不再沿用“装备切片贴边”或“把完整武器拉成输入框”的构成方法。

下一候选必须同时满足：

| 约束 | 设计合同 |
| --- | --- |
| 形状 | 在原生边界内改变 composer 的整体轮廓与层次，不围一圈泛古风边框，不把完整装备压成细条 |
| 元素分工 | 夜叉套与神锋由小天命人完整承担；金箍棒由战斗背景完整承担。composer 不再被要求同时塞入三件元素 |
| composer 语汇 | 只提取游戏 UI 的留白、墨迹断口、器物边缘、拓印层次与克制的信息层级；不能依赖标题才被读成《黑神话：悟空》 |
| 原生合同 | 保留 `736×96` / `560×96`、32×32 发送命中区、提示词、footer、键盘导航与可访问语义 |
| 审稿 | 必须提交真实 Codex 1× 全窗、4× 局部、浅/深背景、125% 缩放与强制高对比证据，用户批准后才可集成 |

候选所有装饰四向外扩为 0；不加标题、道具状态珠、新控件、emoji 或解释性文案。源图不足时停在素材审计，不通过 imagegen 猜画夜叉套或武器。

### Hatch Pet 动作一致性

宠物沿用官方 v2 8×11 映射。跑动和 hover 行必须与其余行保持同一角色、同一比例、同一装备与同一渲染风格。小八戒 repair-v2 已按“持耙捧腹前俯蓄势 → 更深前俯 → 后仰抬头大笑峰值 → 肩腹二次弹起 → 回落衔接”形成独立候选；一手始终持完整九齿钉耙，另一手捧腹。小天命人当前基础立绘不是有效 identity anchor：兽棍·神锋只画出棍首与前段，握持点后的后棍身和尾端缺失；角色右腿/右脚仍为普通布绑与裸足，没有厌火魔足。base、repair-v2 与其派生图集全部冻结。本地录像已由用户确认不符合要求，动作线暂停；等待用户后续录制后先重建完整基础角色，再建立 repair-v3，不使用现有抽帧凑动作。

冻结不通过删除实现。V12 在 `prepare-native-pets.mjs`、`package-runtime.mjs` 与 `install-native-pets.ps1` 三处使用同一显式发布白名单；旧悟空 spec、仓库包、图集、证明、候选和用户已有 discovery 目录全部保留，但不再被读取、复制、迁移、升级或记录。Codex 若已发现旧目录，仍可原样显示；新 V12 不修改用户当前宠物选择。

> **0.10.0 / V11 历史设计（保留）。** 下方内容只记录 V11 当时的路线演变；冲突处以顶部 V50 设计为准。

## V11 设计结论

V11 将“原生”定义为保留 Codex 的信息架构、槽位几何、文字、图标和交互，而不是冻结所有视觉轮廓。主题不得改变菜单栏、侧栏、内容列、composer、环境信息卡的坐标和宽高，也不得增加任何栏、控制器或文案；但可以在原节点上替换圆角、切角、边线、材质层和空内容伪元素，使其成为真正的《黑神话：悟空》样式，而非颜色主题。

### 组件造型语汇

| 原生组件 | V11 形状替换 | 黑神话语义 | 不变合同 |
| --- | --- | --- | --- |
| 侧栏操作项 | 2 px 主轮廓、经匣式切角底片、短朱砂签/青玉选中脊 | 经卷匣、朱砂批签、珍玩槽 | DOMRect、文字、图标、点击区域 |
| 输入器 | 7 px 收束轮廓、短漆木/青玉轨、角部压线 | 典籍匣与棍饰金属包角 | 原宽高、位置、padding、工具与提示文字 |
| 发送键 | 同尺寸八角朱砂印 | 丹丸、印信与火漆 | 按钮尺寸、图标、可访问名称 |
| 环境信息卡 | 5 px 匣角、题签短轨、行级细分隔 | 经匣目录、珍玩陈列格 | 卡片宽高、原行顺序、原按钮与文字 |
| 用户气泡 | 原尺寸材质替换 | 漆面与旧金薄边 | padding、文字、位置 |
| 助手回答 | 完全透明 | 不做“古风卡片” | 所有祖先无背景、无边框、无阴影 |

所有造型只使用 CSS 背景、边线与伪元素，不添加 emoji、武器贴图、标题牌或新按钮。兽棍、葫芦、珍玩、精魄与丹药只贡献比例、切角和材质语言，不把道具图片贴满组件。

### 背景与色板

背景仍只有一个 `body::before` 固定层，`inset:0`、`background-size:cover`。每张图同时输出 `--forge-scene-veil` 与 `--forge-scene-brightness`；页面状态只输出 `--forge-mode-veil`。`body::after` 将二者合成，所以切换 battle/scenery 不会覆盖场景自身的可读性修正。对话背景按路径与 hash 稳定选择，不再因标题流式更新而跳图。杨戬白场采用偏右焦点，使杨戬与天命人都留在常见裁切区。

### 原生 Hatch Pet

V11 删除活动页面里的静态悟空/八戒 DOM 覆盖层，只保留一个无交互湘妃葫芦 motif。两位角色通过 Codex 原生宠物目录加载：

- 小悟空：厌火夜叉套 + 兽棍·神锋，锁定游科官方天命人 1/12 手办与游戏装备图标。
- 小八戒：锁定 INART 官方 1/12 的灰黑猪脸、旧青衣、念珠、腰封，以及恰好九枚分离耙齿的九齿钉耙；可爱来自较短吻部、圆润脸颊和柔和眼神，不变成粉色幼猪。
- 两者均使用 v2 `1536×2288`、8×11、单格 `192×208` 的完整动画图集；未通过逐行、四向、16 向、连续性、透明边缘与三方盲审的候选不得进入安装包。

### V11 恢复边界

主题停用时移除 `forge-*` 标记、V11 样式、运行时状态和单一葫芦层；助手祖先链回到官方 computed style。宠物是 Codex 原生包，不以静态 CSS 假装“宠物”。官方扫描器会过滤顶层 junction，所以启动器创建真实发现目录，并在内部建立 `payload` junction 指向主题包；派生 manifest 只引用词法上仍位于发现目录内的 `payload/spritesheet.webp`。这既通过官方 `Dirent.isDirectory()` 与路径范围检查，又避免复制 atlas。主题载荷目录不存在后 payload 图集不可读，刷新宠物列表即不再加载。整个路径不修改 `ChatGPT.exe`、WindowsApps 或 `app.asar`，内容冲突时不覆盖；早期直接副本迁移前会把原 manifest 保存为 `source-pet.json`，旧 atlas 保留。

> **0.9.0 / V10 历史设计（保留）。** 后文 V9 伪元素与固定矿色描述同样只作历史，不代表活动实现。

## V10 设计结论

V10 的重点不是给原生界面统一蒙一层深色，而是让每张电影画面决定自身的“界面矿物”。`SCENE_TONES` 为 11 张背景分别定义 ink、paper、topbar、sidebar、composer、environment card、user bubble、code、menu 与 veil；白场杨戬使用冷墨青灰，夜叉王使用漆红与焦铜，山林场景使用松石、苔灰与岩绿。背景切换和 chrome 配色是同一个原子状态，避免“图换了、界面仍是上一张图的颜色”。

组件继续保留 Codex 原生几何与文字：只改已有表面的颜色、边线、阴影与背景透明度，不设宽高、外边距、网格或文案。助手回答祖先链保持透明无框；输入器仍使用官方 25 px 圆角和原始高度，不做武器形输入框、装备贴图或额外工具按钮。

## 独立同行者层

运行时只新增一个 body 直属容器：

```html
<div id="wukong-forge-pet-overlay" data-forge-owned="pet-overlay" aria-hidden="true" inert>
  <i data-forge-pet="little-wukong" hidden></i>
  <i data-forge-pet="little-bajie" hidden></i>
  <i data-forge-pet="xiangfei-gourd" hidden></i>
</div>
```

容器与三个子元素均 `position:fixed`、`pointer-events:none`，不属于 composer、sidebar 或环境卡的布局树。小悟空和小八戒分别以 `workspace-left-floor` 与 `workspace-right-floor` 站在工作区底边；landing 使用约 112 px 档，thread 使用约 92 px 档。湘妃葫芦依次尝试 `landing-hero-left`、`right-card-foot` 与 `workspace-upper-rail`。每次结构变化、视口变化或视觉视口滚动后，用真实 DOMRect 检查标题、正文、代码块、composer 和环境卡碰撞，不安全即隐藏；900 px 以下全部收敛隐藏。恢复时整个受管覆盖层移除。

两位同行者使用本轮重新生成的透明 WebP：小悟空保留可信猴脸、单根毛发、青玉旧甲、红绳与金棍；小八戒保留野猪面部、粗硬鬃毛、旧青袍、念珠与九枚清晰耙齿。它们只做低振幅呼吸/摇摆，`prefers-reduced-motion` 与 forced-colors 下禁用。完整提示词、参考图与编辑链见 [PET_GENERATION.md](PET_GENERATION.md)。

## 普通入口与回退

`start-theme.cmd` 先安装用户级普通 `ChatGPT.lnk` 适配器，再调用原有安全启动器。V10 不再把完整 PowerShell 代码塞进 `.lnk`：Windows 将其截断到 1023 字符。安装器把完整 ASCII-safe 脚本按内容 SHA-256 命名，写入 `%USERPROFILE%\.codex\themes\wukong-codex-forge\history\launcher-bridges`，快捷方式只保留 178 字符 `-File` 参数。桥接脚本存在但主题根缺失时，动态定位当前 Store 包并原生启动。所有旧快捷方式先复制到 `history\shortcut-backups`，不覆盖历史。

主题启动器使用隔离 profile 和随机 loopback 端口；端口文件出现后允许 20 秒有界连接重试，再允许 20 秒 renderer 生效重试。只有 `THEME_STATE` 确认为 V10 active 才进入 watcher。watcher 不安装服务或开机项，并在连续 8 个 1.7 秒周期没有 Codex renderer 后自行退出。官方 Windows 版关掉所有窗口后仍可保留主进程、renderer 与托盘，因此再次启动时，launcher 同时设置相同 `CODEX_ELECTRON_USER_DATA_PATH`、传入相同 `--user-data-dir` 和官方 `codex://launch`，命中该 profile 的 `second-instance`。验收不依赖可能失真的 DOM visibility，而只读取受管根 PID 的 `MainWindowHandle`；6 秒未复显会重试一次，仍失败则明确返回非零，不调用 Win32 窗口操控 API。

这一处理来自对官方 26.715.2305.0 `bootstrap`、`main` 和 `window-all-closed` 打包文件的只读审计：Windows 分支不会在 `window-all-closed` 中 `app.quit()`，`codex://launch` 会进入 `showPrimaryWindow({stealFocus:true})`，其他第二实例参数也由主窗口管理器执行 restore/show/focus。主题不修改这些文件，只适配它们公开表现出的生命周期。

## V10 真实几何

普通快捷方式启动的 2050 × 1106 生产窗口实测：landing 为 `battle/scene 0`，thread 为 `scenery/scene 8`；侧栏 275 px、composer 736 × 98 / 25 px 圆角，thread 环境卡 300 × 473。背景为单层 embedded JPEG、`background-size:cover`；助手回答 computed style 为透明背景、无阴影、0 px 圆角。覆盖层元素不接收鼠标，三项安全位均为 true。

## 设计结论

本轮不做“深色界面加金边”，也不用古风卡片、书法标签、emoji 或装饰按钮制造主题感。视觉核心是“真实电影画面 + 潇湘矿色 + 两位同行者”：杨戬、大圣、夜叉王和黑神话风景承担画面张力，湘妃葫芦提供石青识别，小悟空与小八戒提供角色温度。夜叉套、兽棍·神锋和武器条已按用户最终意见停用。

页面仍然是 Codex：定位、尺寸、文案、图标、事件和三栏结构均不改。主题仅在现有节点上增加 class / dataset，使用背景层和空内容伪元素替换表面。

## 双境状态

| Codex 页面 | 主题状态 | 用途 |
| --- | --- | --- |
| 新建任务 / landing | **战斗境** `data-forge-mode="battle"` | 任务开始前给出最强张力和角色识别 |
| 已进入对话 / thread | **风景境** `data-forge-mode="scenery"` | 长时间阅读时降低角色冲突，保留世界感 |

这一映射不提供开关按钮，由运行时根据可见页面语义自动判断。对话 data 属性、virtualized turn、assistant 包装和新建页原生标题是依据；`supportsNewChatMenu` 与 pathname 都不能单独判断页面状态。

## 场景系统

| 索引 | 文件 | 分组 | 视觉主体 |
| --- | --- | --- | --- |
| 0 | `erlang-ink-duel.jpg` | battle-primary | 水墨杨戬与大圣对决，战斗境首幕 |
| 1 | `great-sage-staff.jpg` | battle-primary | 金箍棒与大圣甲胄特写 |
| 2 | `storm-bearer.jpg` | battle-secondary | 雷法、棍势与青蓝强光 |
| 3 | `shadow-confrontation.jpg` | battle-secondary | 蓝色光柱下的巨影对峙 |
| 4 | `ridge-gate.jpg` | scenery | 日色岭谷与山门 |
| 5 | `forest-shrine.jpg` | scenery | 雾林寺院 |
| 6 | `mountain-path.jpg` | scenery | 山道、石灯与天光 |
| 7 | `stone-buddhas.jpg` | scenery | 佛窟、造像与暗部烛火 |
| 8 | `sunset-ravine.jpg` | scenery | 晚霞山峡 |

战斗境在索引 0–3 间、风景境在索引 4–8 间分别使用独立 session 游标顺序轮换；同一可见页面身份保持当前场景，只有 landing/thread 身份真正变化或当前索引失效时才推进。两种状态都不使用计时轮播、视频解码或运行时网络请求。`themes/active.json` 是页面 payload 的唯一活动清单；带有退役葫芦、旧宠物和旧构图参数的 `themes/ink-mountain.json` 只作历史留档，保留文件但不复制进最小运行包。

## 伴随元素与组件映射

| 元素 | 设计特征 | 落点 |
| --- | --- | --- |
| 小悟空 | 以用户本地实机帧为主体依据，保留青色鳞甲、猴脸、尾巴与棍，透明背景 | landing 输入器左侧空白沟槽 88 × 98 px；thread 收敛为 62 × 70 px |
| 小八戒 | 以实机截图与影神图交叉核对，保留旧青袍、念珠、猪首与九齿钉耙，透明背景 | landing 输入器右侧空白沟槽 92 × 100 px；thread 收敛为 68 × 74 px |
| 湘妃葫芦 | 游戏图标中的青绿双节、银白泪痕、蓝绳与流苏 | 优先位于输入器左侧剩余沟槽，右侧回退；landing 42 × 64 px，thread 34 × 52 px |
| 侧栏 / 环境卡 | 墨铁底、石青窄边、旧金发丝线、漆褐暗纹 | 只换材质，不显示人物或装备 |

三件伴随元素均使用透明 WebP。人物静止，不做呼吸循环；全部 `pointer-events:none`。V9 在初始化、关键结构新增/移除、侧栏/提交动作和窗口尺寸变化时计算候选矩形；若与标题、用户气泡、助手回答、代码块或右侧环境卡相交则隐藏。宽度小于 900 px 隐藏葫芦，小于 780 px 隐藏两位同行者。原始 PNG 与被否决素材保留在仓库工作树或 Git 历史，但最小运行包不复制。

## 配色与明度

| 角色 | 色值 | 用法 |
| --- | --- | --- |
| 骨白 | `#e5dfd4` | 正文和关键标题 |
| 漆褐 | `#7c4438` / `#4f2e28` | 用户气泡右缘与小面积暗纹 |
| 潇湘石青 | `#4f7f7c` / `#82aaa4` | focus、选中边与次级信息 |
| 旧金 | `#a88755` / `#c6ad7d` | 链接、分隔发丝线与小面积热点 |
| 墨铁 | `#171917` / `#252825` | 基层、侧栏和稳定阅读表面 |

配色是画面的承托，不是主题本身。战斗境主体区遮罩较薄，确保杨戬、夜叉王和金箍棒可识别；风景境只在文字左右增加方向性 veil，不把图压成近黑。

## 原生几何和内容契约

- 侧栏标记只用于定位原生语义，未选中 action/project/thread 即使带有 `forge-sidebar-*` 标记也不获得任何主题颜色、背景、边框、阴影或状态指示覆盖；仅原生 `aria-current`、`aria-selected` 或 `data-app-action-sidebar-thread-active` 对应的真实外层行绘制选中纸面。选中材质以节点实时宽高为基准，四边各留 1 px 安全内缩，避免纹理透明缘越过原生命中区。
- 不对顶部栏、侧栏、项目树、环境行、消息和输入槽位设置 `width`、`height`、`margin`、`padding`、`gap` 或 `transform`；只有 composer 保留 `position:relative` 作为同行者伪元素坐标系，DOMRect 必须保持一致。
- composer 只在实际组合框宽 360–960 px、高 58 px 至 `min(480 px, 48vh)` 且位于页面底部时标记；外层过宽 `form` 不再降级命中，长输入也不会突然失去样式。
- 环境栏运行时只标记面积最大的一个候选容器，防止多层嵌套同时变成卡片；当前 300px 官方外卡和稳定行 slot 另由精确原生选择器直接绘制，保证任务切换后的首帧持久主题。
- 从实际 `[data-local-conversation-final-assistant]` 开始，只清理到其所属 turn 的真实包装链，去除背景、边框、阴影、outline 和 filter；不越过 turn 污染工作区。代码块可保留独立黑铁表面。
- 用户气泡只更换不占布局的材质与轮廓。注入前后对话 `innerText` 必须逐字一致。
- 唯一新增节点是 `head` 内的受管 `<style>`；body 内不新增任何 UI。人物与葫芦分别使用 composer/workspace 的伪元素，不抢占 DOM 或点击命中。

## 恢复与兼容

恢复表达式会断开结构 `MutationObserver`，取消侧栏/提交复核定时器，移除 popstate、hashchange、resize、click、keydown listener、style、class、`data-forge-mark`、状态与三项碰撞属性，并清除葫芦定位变量。强制高对比模式下禁用所有图片伪元素，优先保证系统可访问性。

便携启动器使用解压目录内 `.wukong-runtime` 的隔离 web profile 和随机回环端口，不写官方程序文件。0.8.0 使用 Codex 自带 `cua_node` 与仅依赖 `http`、`crypto`、`zlib` 的回环协议客户端，不携带 npm 依赖树。11 张背景在变量载荷中各编码一次，`--forge-art-*` 只引用对应 `--forge-bg-*`；当前变量载荷 3,654,150 字符，完整样式 3,670,925 字符。停用必须验证 V4–V9 style/class/mark/runtime 全部消失后才成功；磁盘文件由脚本原样保留。关闭主题窗口后，用户自行删除整个解压目录即可回到普通 Codex。已经运行且没有 CDP 端口的普通 Codex 无法从外部热注入，这是 Chromium 运行边界。

## V36 原生首帧与环境分区设计

- `visible()` 继续服务于一般可见表面；仅 composer 的官方 above-composer panel、queue list、queue item 和 goal 使用 `structurallyMounted()`。后者要求元素已连接，并沿祖先链排除 `hidden`、`inert`、`display:none` 与 `visibility:hidden`，但不以 `opacity` 或首帧 DOMRect 判死，从而兼容 Framer Motion 的先挂载后显现。
- queue/goal 的宿主仍保留原生 border 宽度。主题只把四边颜色、`border-image`、outline、backdrop-filter 与阴影设为视觉透明；纸纹全部位于 `pointer-events:none` 的伪元素层。这样能消除截图中的黑边/黑带，又不会让输入区、目标行或按钮发生像素位移。
- 环境信息分区不读取“子智能体 / 后台进程 / 来源”等本地化文字。生产 `Section` 的根签名是 `relative z-0 flex flex-col pb-3`，其直属 `header` 签名包含 `sticky top-0 z-10 h-7 w-full bg-token-dropdown-background ps-3.5 pe-2.5 text-token-text-tertiary`。只有同时满足两层合同的节点获得透明标题标记。
- 分区根与标题保持透明，官方 `::after` 分隔线改为低对比赭色渐变；标题直接显露外卡连续纸面，不再使用深暖墨纸、切角、独立圆角或内嵌阴影。forced-colors 下图案与绘制覆盖全部交还系统。
