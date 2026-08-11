# 大圣归来 Codex 样式层 — 需求与验收

> **V52.1 现行发布合同。** 下表延续 V15 的视觉/几何编号；旧版本证据作为历史保留，冲突处以 `CURRENT_GOAL.md`、V15-01、V15-04、V15-17、V15-40 至 V15-52 和本表为准。

| ID | V15 需求 | 验收方法 |
| --- | --- | --- |
| V15-01 | 包括主输入器在内的所有布局几何来自本机 `ChatGPT.exe 26.715.2305.0` 的只读 `app.asar` 与真实 renderer：toolbar、sidebar、row、thread、composer surface/editor/footer/buttons、间距与响应式公式不得从审稿图反推；主题轮廓只属于不参与布局的 paint | `native-asar-ui-contract` 直接读取当前安装包并与 fixture baseline 对照；对全部组件做主题前后 DOMRect/命中区全等比较 |
| V15-02 | 用户最终三张输入器参考允许直接实现；主输入器及所有相邻纸面统一使用第一张参考图的底纹、角纹、云纹和色阶，文本与控件仍由原生 DOM 绘制 | 1×/125% 宽窄与多行 fixture、像素对照、文本/ARIA/按钮尺寸深比较 |
| V15-03 | 一级侧栏条目映射项目条和无项目对话；二级条目映射项目下对话。默认、hover、focus、selected、expanded、disabled、unread/running 必须各有明确且一致的目录状态 | 结构优先选择器测试、动态状态矩阵、真实 sidebar 截图 |
| V15-04 | “新建任务 / 拉取请求 / 站点 / 已安排 / 插件”可按既有 renderer 映射只换材质与状态；“文件 / 编辑 / 视图 / 帮助”四个应用菜单触发器及菜单内容完全保留官方 paint。两类都不得改变文字、图标、DOM 顺序、原生尺寸或菜单行为 | 官方 topbar class/ARIA 锚点、open/close/hover/focus 测试、官方菜单 paint 断言与几何前后对照 |
| V15-05 | 新建页保留原生 56×56 槽位；卡通短棍、微缩武器和生成物均已否决，当前使用官方“悟空”书法与朱印的深/浅双资产；视觉层至少为旧版三倍、可见约 141×96 px，且不得遮挡杨戬头部或其他画面焦点 | 官方源 SHA、336×336 双资产像素/体积/边界合同、168×168 绘制层、场景 0/1/2/3 构图审查、槽位 DOMRect/原节点/restore 合同与用户实机验收 |
| V15-06 | 不实现葫芦；活动主题定义、运行包、注入器和后续视觉提案均不得引用葫芦。含退役葫芦/旧宠物引用的 `themes/ink-mountain.json` 只作历史保留，不得进入最小运行包 | active theme 深比较、package 白名单/反向排除断言与 DOM 标记清单 |
| V15-07 | 助手回答保持无框；提示词、回答、placeholder、项目名、菜单名和按钮可访问名称逐字不改 | 注入前后文本/ARIA 深比较 |
| V15-08 | UI 材质使用静态 WebP/nine-slice；无网络请求、无逐帧动画、无 filter/will-change 常驻、无布局 JS；forced-colors 回退系统原生面 | 网络/计时器/动画计数、computed style 与强制高对比测试 |
| V15-09 | 本轮属于多轮验收，不以 fixture 通过代替实机视觉通过；每个独立里程碑针对性测试后精确 commit/push，保留可回退 SHA | cached path 审计、测试记录、远端 SHA 与用户验收记录 |
| V15-10 | 不删除、移动或覆盖本地文件；不修改 `ChatGPT.exe`、`app.asar`、WindowsApps 或官方配置；临时调试窗口截图后立即关闭并核验资源释放 | 文件/进程/父子树/端口前后审计 |
| V15-11 | 所有输入相关纸面统一到最新参考的暖灰黄赭综合色阶，当前重建目标 `RGB(135,117,93)`、实际四类产物中位色 `RGB(131–135,111–117,86–93)`；主框、strip、pill 和 tile 必须同源重建，不能靠运行时 filter 变色 | 产物尺寸/median/std/暗纹理对比度测试，CSS fallback/filter 审计与四状态无头截图 |
| V15-12 | 两只 Hatch Pet 必须从用户已否决的旧 canonical 完全断开：小天命人 base 同时具备正确双足与完整神锋连续链；小八戒 base 同时具备成年游戏骨相与完整、可逐枚计数的九齿钉耙；母版未过门不得生成动作 | 新 run source lock、base 四项/五项白名单、依赖任务状态和用户母版审查 |
| V15-13 | 两只宠物的最终像素动作均不得镜像；左右跑独立生成，装备手性、武器端向与不对称衣装保持连续。小八戒 hover 为持耙捧腹大笑，小天命人运行态棍花只使用录像可证明的背面节奏 | row prompt/manifest 派生策略、逐帧武器连续性、左右手性与动作语义盲审 |
| V15-14 | 活动背景与 UI 位图除压缩字节上限外必须有解码像素硬门：单背景 ≤12,000,000 px、图库唯一文件总计 ≤48,000,000 px、任意两张最大背景合计 ≤16,000,000 px、单 UI/装饰位图 ≤4,194,304 px；尺寸头无效或超限时必须在 payload 组装前失败 | JPEG/PNG/WebP 头解析、实际 22 图与活动 UI 资产统计、内存内 100,000×100,000 PNG 拒绝测试、最小包导入测试 |
| V15-15 | 用户否决或明确删除的活动图必须退出 active/default/native preview/最小包，但历史源文件不得批量删除；当前图库固定为 B01–B13 十三张战斗与 S01–S09 九张风景 | active/default 深比较、22 个唯一槽位、最小包排除断言、真实 ChatGPT 截图 |
| V15-16 | 新建页只保留“悟空”字标与“此去，欲破何局？”；原生“新建任务”和描述说明在主题激活时视觉透明，但 DOM、文本、ARIA、布局占位和停用恢复不得改变 | 首帧自动标记、computed opacity、前后 DOMRect/innerText、延迟挂载与 restore 测试 |
| V15-17 | 主输入器的 surface、editor shell、editor、footer、按钮、padding、宽高、底部锚点和响应式结果全部沿用原生实时布局，不得声明主题比例、高度或安全内距。悟空纸张仍保持长方形，只在同一原生矩形内由 `pointer-events:none` 的 `::before` 裁出四个 8px 角；宿主不裁切，矩形命中区不变 | 360/400/560/736/1600 响应式全 DOMRect 比较、真实 renderer 主题开关前后最大差 `0`、按钮身份/layout 深比较、四角 paint 与 forced-colors 回退 |
| V15-18 | 排队消息与进行中目标必须保留官方 above-composer stack 的真实生产拓扑：一个外层 queue panel 内含 N 个 internal queue item，再接一个外层 goal panel。只有整组首个外层 panel 拥有左上/右上两个外部角；后续外层 panel 直边承接。每个内部消息拥有独立纸纹与原生 1px 接缝，不得提升为独立外层卡片，也不得把一张总背景按条目数拉长。独立计划/变更进度 pill 仍为四周圆角 | 当前 ASAR 解包源码、guided/multi-guided fixture、outer panel / internal item 数量、固定顶饰高度、原生 gap、pill radius、相邻行与控件 DOMRect 全等 |
| V15-19 | 当前 Codex 内部 editor class/role 漂移不得导致输入框漏替换；官方 `.composer-surface-chrome` 是主 surface 身份，内部 editor 仅作可选语义辅助；主题不得伪造 editor、contenteditable 或 ARIA | 删除 ProseMirror/role 的漂移回归测试、真实 Codex DOM audit、主题化覆盖率与 restore |
| V15-20 | composer component、above-composer portal、queue 外层 panel、内部 message wrapper、goal 外层 panel 与独立 progress pill 的对应关系必须从当前安装包的生产结构推导；fixture 不得用测试属性或每条消息一个 outer panel 的简化结构伪造 component 身份。内部 message wrapper 只能通过完整生产 class token 识别，不得猜本地化文案 | 当前 ASAR 只读源码核对、root 直属子节点关系、queue list / message row 生产 class 签名、portal/component 互斥、guided/multi-guided 数量与重映射定向断言 |
| V15-21 | 临时真实 Codex 验收不得留下调试窗口、便携 profile 子进程或监听端口；普通截图仍不得关闭任意窗口。只有 launcher、disable request 与 CDP browser PID 三者一致时，捕获器才可在 `Browser.close` 超时后结束该精确 PID 树，且不能按名称或映像批量结束 | 临时实例真实截图、CDP PID 匹配、精确 `/PID` 树兜底、root/owner/profile process/port 四项归零与生命周期合同 |
| V15-22 | 主输入器四角与 above-composer stack 首个外层 panel 的两个上角只能裁切主题纸面，不得裁掉原生宿主或内部消息的矩形命中区；后续外层 panel 与内部消息均不得重复外部角或卡片阴影，独立 progress pill 仍保持全圆。所有纸面绘制层必须 `pointer-events:none`，高对比模式必须完全撤下 | 宿主与内部消息 computed `clip-path:none`、仅首个外层绘制层的 polygon/固定顶饰、内部 item 无 shadow、`pointer-events:none`、forced-colors、原生坐标/尺寸/语义深比较 |
| V15-23 | 已缓存或 data URL 背景即使在赋值后同步报告 `Image.complete=true`，也必须等待同一图像的 `decode()` 门完成后才能公开 ready；稳定页面刷新必须差量对账主题标记，禁止通过每轮全量移除/重加 class 或重复写入相同 ARIA 触发 ResizeObserver/MutationObserver 自循环 | 同步 complete + 悬挂 decode 门禁、ready 前原生 paint、稳定 2.2 秒 refreshCount 不增长、停用恢复与项目资源归零 |
| V15-24 | 未经用户明确通过的新宠物母版不得进入准备、最小包或安装链路；发布集合由单一策略文件控制，空集合必须在任何 Codex 用户目录写入前无操作退出。旧包、既有 discovery 目录、当前选择与事件记录全部只保留、不迁移、不升级、不覆盖 | 策略一致性、准备前后目录 hash、最小包缺失断言、CodexHome 不存在/已存在两态字节级不变测试 |
| V15-25 | 新母版候选必须使用与旧冻结包不同的独立 pet id，并在策略中处于 `pending`，不得借用旧包 id 伪装为可发布版本；`released`、`pending`、`frozen` 三集合必须两两互斥。小天命人 v2 图集仍保留 schema 所需 row 4，但动作语义改为双足着地、身体高度稳定的原地移步反应，不得出现跳跃 | 策略三态互斥校验、候选 request id / verdict / 留白与透明边缘合同、最小包排除断言、row 4 语义与禁跳说明测试 |
| V15-26 | README、便携说明、需求、设计、分工与工作日志必须区分现行 V50、历史版本和未完成门槛；文档引用的 V23/V24 完整页及 JSON 必须被 Git 跟踪并在文件内声明 fixture-only，禁止把无头证据写成真实 Codex 窗口或用户视觉通过 | 证据路径/PNG 尺寸/JSON source 与覆盖状态定向合同、最小包便携说明真值断言、Git 精确暂存审计 |
| V15-27 | 当前本机 `app.asar` 是全部组件几何与结构的原生真值；包目录名、文件长度或 SHA-256 任一变化必须使原生合同失效即停，禁止静默使用旧 fixture。哈希计算必须有固定内存上限，不得把约 192 MiB 归档一次性读入内存 | `docs/native-asar-provenance.json`、1 MiB 分块 SHA-256、当前安装包目录/长度/哈希断言与清晰漂移错误 |
| V15-28 | 真实 Codex 整页验收不得在启动 Logo / preloader 阶段截图；必须先出现原生 app shell 与 landing 或 composer 实体，再确认 V13 根节点和背景 overlay 都已 ready，最后等待短稳定期。捕获失败或超时仍须只回收明确归属的临时实例 | 单实例完整页截图、原生 shell/surface 与背景 ready 前置等待、CDP browser/launcher/disable request 三重归属、root/owner/port/project-process 四项归零 |
| V15-29 | 真实 renderer 截图若含本地项目名、账号或其他用户工作区标识，不得直接提交到公开仓库；应本地保留原图，提交去标识化几何、状态、资源、清理摘要及原图/报告哈希。landing 技术预验收不得冒充 queue/goal、环境卡、宠物或最终生命周期通过 | 本地完整页 PNG、tracked `acceptance.json`、SHA-256、原生/主题几何与四项资源归零、明确 acceptance boundary |
| V15-30 | 显式受管的临时真实 Codex 捕获无论成功，还是在选任务、等待稳定或截图前失败，都必须走同一清理路径：先验证 CDP browser PID、launcher 与唯一 disable request，再恢复原生 DOM、等待 watcher 确认、关闭该精确 browser，并证明 root/launcher/port 归零。失败不得制造 PNG；含临时 PID/端口的原始报告只本地保留 | 故意打开不存在任务的真实 renderer 超时回归、`capture-failed` 报告、无 PNG、原生恢复/watcher 确认、三项归零与生命周期定向合同 |
| V15-31 | 当前安装包的 thread/progress 底部渐隐绘制层即使 Tailwind 渐变、方向或颜色 token 漂移，也不得在 queue/goal 或输入器上方残留黑带。progress 兼容识别只允许在来源锁定的 host 直属子层或当前生产 `host -> Motion wrapper -> fade` 一层嵌套中命中无交互、底缘贴合 paint layer，不能误命中承载原生 pill 的交互 carrier；主题只撤下 paint，不改 DOM、几何或命中区 | 首帧原生直达规则、移除历史 token 后刷新运行时、唯一 fade 标记、pill carrier 排除、fade/host DOMRect 前后全等、透明 paint 与 focused joined-stack 回归 |
| V15-32 | 用户已将两只 Hatch Pet 整体延期；当前交付不得继续修改其造型、动作、武器、图集、发布策略或本地安装状态，也不得用宠物未通过阻断其余非宠物主题与最终生命周期验收 | Git 精确路径审计、宠物目录与策略无本轮 diff、当前目标/分工/工作日志一致性 |
| V15-33 | 正式受管启动链不得保留 PowerShell 进程或依赖固定周期 renderer target 轮询；必须使用官方包内 Node、append-only bridge 与事件驱动 host，并跟随官方 ChatGPT 根进程退出 | 快捷方式 target/arguments、bridge 源码、Target/Page/Runtime 事件合同、根进程退出、项目 host/端口归零 |
| V15-34 | 移除保留式主题包或 package marker 后，受管 bridge 必须在下一次启动直接回退官方 `ChatGPT.exe`；恢复失败必须 fail closed，不得把残留主题写成成功 | 隔离 marker 移除/恢复、原生状态验证、无主题 DOM 标记、无残留 host/监听端口 |
| V15-35 | 受管入口边界必须明示：安装器只接管其保存并重建的用户开始菜单 `ChatGPT.lnk`；当前已打开的非受管窗口不强制重写，WindowsApps/AUMID/协议/第三方快捷方式可能绕过。Store 覆盖该链接后 verifier 必须明确失败并要求修复 | 适配器事件记录、单一原生名称/图标/bridge 验证、Store 覆盖失败合同、便携说明与真实安装核验 |
| V15-36 | 本轮最终发布门排除两个延期宠物与已取消葫芦；其余主题、资源、生命周期、文档与分段 push 完成后即可结束当前目标 | 宠物/葫芦路径零 diff、非宠物定向测试、真实单实例证据、最终 Git/远端一致性 |
| V15-37 | 环境卡只能由最外层绘制一张连续纸面；`环境信息`、`子智能体`、`后台进程`、`来源` 标题不得另画深色标题条、阴影或独立圆角。当前 `data-thread-scroll-footer` 只允许清除其内层渐隐 paint，不得删除 sticky footer、滚动障碍或命中区 | 当前 ASAR 来源锁、7 行/3 分区/主标题 + 3 分区标题映射、标题 computed paint 透明断言、卡片/行/按钮/footer DOMRect 前后全等与整页 fixture |
| V15-38 | 真实整页验收只能在原生侧栏范围内点击指定任务；截图前必须再次同时证明该任务仍为 current/selected，且 thread/scenery/queue/goal 门仍成立，禁止因同名工作区文本或旧任务状态生成伪通过截图 | 取证脚本静态合同、侧栏 scoped locator、截图前最终双重门禁顺序断言、失败/成功共享归零路径 |
| V15-39 | 环境卡主标题的原生 paint 可能位于标题本体或其 `bg-token-dropdown-background` 祖先承载层；运行时必须只沿已定位标题到官方卡片的分支清除这些承载层，并同时清除主标题及三个官方 Section 直属 header 的 `::before` / `::after` paint。不得扩大到卡内其他节点，也不得改变 300px 外卡、Section、行、按钮、折叠、滚动、ARIA 或命中区 | 当前 ASAR 结构来源、带独立标题承载层与伪元素的回归夹具、注入前深色 paint 先验断言、注入后基础层/双伪元素透明断言、全部 DOMRect 与按钮命中前后全等、真实完整页复验 |
| V15-40 | composer、submit、环境卡/行和显式 selected/current 侧栏行必须由稳定原生选择器首帧直达；当 React 保留 composer/sidebar/right-panel 根但替换内部子树，或新增 landing/thread surface evidence 时，必须只合并一个 MutationObserver 微任务并在首个 rAF 前完成主题标记，不得回落 140–520ms 延迟路径。纯文本流式增长不得触发该快速刷新 | 移除 marker 后同步克隆/重挂载；持久根内部替换与 surface evidence 新增后的首个 rAF paper/箭头/环境分隔/选中行/progress/goal 断言；流式文本稳定计数 |
| V15-41 | 同模式 task/project/history/hash 与流式文本变化不得自行换图、重解码或交叉淡变；背景推进只能来自 V15-46 的显式事件牌堆。landing/thread 自动模式变化以 420ms 单向叠化过渡到该模式当前选定场景；已经处于目标组时不得重复工作。旧层保持完全不透明，新层置顶淡入，合成 alpha 不得下坠；隐藏页面暂停刷新，恢复时合并一次 | 200 次流式 mutation、100 次 history 变化、同组自动零 decode/render/transition、隐藏/恢复、单请求取消、叠化中点合成 alpha、最多两个 follow-up timer 与稳态单纹理测试 |
| V15-42 | V50 历史正式发布必须新建时间戳 append-only release，不能用原地同步替代版本化安装；安装后两个开始菜单入口、bridge、marker 和仓库/安装 runtime 哈希必须通过 verifier。宠物批准集合为空时不得触碰既有宠物目录或状态 | `package-runtime` 目标已存在即拒绝、保留式安装输出、双入口 verifier、旧 release 原始 SHA 恢复、新 release CSS/plan SHA、宠物 no-op 输出 |
| V15-43 | V51.3 仓库模式不得创建独立命名的 Wukong/主题入口；迁移只能在确认旧链接目标为 Codex 内置 Node、bridge 位于本项目 LocalAppData 目录后，先备份再定点删除。最终唯一入口仍启动官方 `ChatGPT.exe`，仓库缺失时回退原生 | 单入口安装/验证合同、旧入口所有权与备份先后断言、无 WMI/CIM/常驻拦截、仓库 marker 缺失回退 |
| V15-44 | V51.4 必须让原始 Store、开始菜单与任务栏入口在保留官方 ChatGPT/Codex 名称、图标、包身份、正式 profile 和 `ChatGPT.exe` 的同时进入仓库主题链。用户级监督器只能通过 `SetWinEventHook(EVENT_OBJECT_SHOW)` 处理安装后新显示的窗口，使用 `QueryFullProcessImageNameW` 精确确认当前 `OpenAI.Codex\app\ChatGPT.exe` 后才切到 repository bridge；正式重启使用 manifest AUMID + `IApplicationActivationManager`。稳态不得使用 WMI/CIM、进程或 target 轮询、服务、计划任务、IFEO/DLL；marker 消失后必须撤销自身 HKCU Run 并退出，恢复原生。测试通过前不得触碰当前窗口或声称实机完成 | C# 编译与 WinEvent/路径/单实例/重启预算静态合同，PowerShell 5.1 解析与 AUMID/UTF-8 Base64 激活合同，installer ready/Run/state 证据，无 WMI/CIM/steady polling 扫描，聚焦与全量测试后一次受控 Store/任务栏原生入口、`renderer-verified`、marker 删除恢复闭环 |
| V15-45 | V51.5 切换对话、托盘恢复和既有受管窗口重附着不得重启；只有所有官方进程完全退出后的原始 AUMID 冷启动可因 remote-debugging 参数无法事后加入而快速接管一次。正式激活必须由编译 `runtime/activate-appx.cs` 直接调用 `IApplicationActivationManager` 并发送 `ManagedLaunch`，不得启动 PowerShell、`Get-AppxPackage` 或 `Add-Type`。监督器对每个精确路径匹配窗口只执行一次 `HasCodexCdp`，不得保留 6 秒循环；零双启动日常入口是同名官方图标的 Start Menu `ChatGPT.lnk`。全链不得使用 WMI/CIM | 切换/托盘/managed signal 不重启合同，编译激活器与命名事件合同，单次 HasCodexCdp/无循环静态断言，同名快捷方式与官方图标验证，45/45 聚焦 + 27/27 补充定向；全量、热更新后再执行一次原始 AUMID 冷启动实机门 |
| V15-46 | 活动战斗与风景图库分别使用稳定物理 `slot` 与独立连续 `order` 序列：真实“新建任务”事件只在距上次自动推进至少 20 分钟时推进，`Ctrl+Alt+F` 手动推进当前可见序列下一张，`Ctrl+Alt+B` 手动退回上一张，两者均在本组内循环且不受该冷却限制；普通同模式任务/项目/history/hash/stream/resize/mutation 不推进。隐藏页只合并一次待请求并在恢复后执行；不得新增 interval、轮询、WMI/CIM、PowerShell 或进程，且继续满足单解码请求、稳态单纹理和过渡双纹理上限 | 锁定 B07/B01/B02/B03/B04/B05/B08/B09/B06/B10/B11/B12/B13 与 S05/S04/S08/S01/S02/S03/S06/S07/S09 完整双向顺序、slot/order 分离、旧牌堆迁移、冷却边界、隐藏/恢复合并及静态无 interval/WMI/CIM 扫描 |
| V15-47 | `Ctrl+Alt+F` 与 `Ctrl+Alt+B` 必须在同一 document、主题 runtime、style、overlay 与主题标记节点上原位切换当前模式的下一张或上一张，不得改变 battle/scenery 模式，也不得触发页面导航、页面或主题 reload、主题 refresh 或重建；目标图必须由最终绘制的同一 DOM `<img>` 自身完成 decode 后才淡入，等待期间旧图保持可见，新图底色透明，命中的快捷键不得继续传播。稳态一纹理、过渡双纹理与单一在途解码上限保持不变 | 两组真实键盘输入、双向回绕、延迟 decode、document/runtime/style/overlay/标记引用全等、URL/history/navigation/lifecycle 零变化、refresh/render/generation 计数、等待/过渡/稳态图层与透明底色合同 |
| V15-48 | 新增背景不得通过运行时亮度/饱和度/对比度滤镜改色；只允许确定性裁边、等比缩放与 JPEG 编码。战斗与风景的 per-scene veil 应尽量降低，但每张场景在 tone + 双层场景 veil + 模式横纵遮罩模型下的正文对比不得低于 4.5:1；不能直接比较不同 tone 的原始 veil 数值来判断最终亮度 | 源资产与输出尺寸/字节、脚本四边裁切边界、22 场景逐项对比度、battle/scenery 最终背景亮度、无图片 filter 静态合同与实机视觉验收 |
| V15-49 | 所有手动背景过渡必须经过一致的透明首帧门：目标 `<img>` 自身 decode 完成后仍为 `opacity:0`，至少跨过连续两个 rAF 才开始淡入；缓存命中与首次加载路径相同。过渡必须由 `transitionend` 正常收束、由单个有界 timeout 兜底；新意图取消旧 decode/帧/事件，失败 decode 保留当前图 | 延迟 decode、同步缓存、首/次 rAF opacity、transitionend/timeout、快速意图、返回当前图、拒绝 decode、稳定层无 transition 与 stale listener/timer 归零 |
| V15-50 | `Ctrl+Alt+C` 仅在当前页面临时切换 battle/scenery 可见序列；F/B 随当前可见组移动。真实导航或 landing/thread surface 变化清除覆盖，新建任务页仍默认 battle，项目/已有对话仍默认 scenery；同 URL `replaceState` 不得误清覆盖，自动目标已可见时 render/decode/transition 均不得增加 | F/B/C 真实键盘事件、重复键/Shift/Meta 排除、同 URL replaceState、侧栏/新建任务导航、自动默认恢复、游标独立与同组零工作计数 |
| V15-51 | 公开 `backgrounds.cmd` 必须提供交互模式以及 `list/add/replace/move/remove`：Target 支持稳定 slot 或 scene id；move 只重排 order，add 分配未使用物理 slot，remove 只退出轮播并保留资产。战斗/风景必须各保留至少一张；清单以 UTF-8 无 BOM 原子替换，清单和覆盖前图片备份到仓库本地状态目录，replace/remove 需要显式确认 | 隔离仓库端到端 manager 测试、真实清单 SHA 不变、两组最小保留、稳定 slot/order、备份/原子写/assetRetained、reparse/path confinement、包白名单与无 WMI/CIM/进程控制扫描 |
| V15-52 | 当前用户路径中的历史 `scripts/launch.ps1` 兼容入口不得继续执行旧 WMI/CIM 或重复启动逻辑；它只能验证仓库 marker 后委托公开 `scripts/start.ps1`。正式运行仍保持事件驱动 host，不新增周期性进程/renderer 扫描 | PowerShell AST/静态禁词、launch wrapper 精确委托、生命周期与最小包合同 |
| V15-53 | `Ctrl+Alt+T` 必须在同一 document/runtime/style/overlay 上原位隐藏或显示新建任务页“此去，欲破何局？”；不得改变原生标题文本、DOMRect、背景 scene/mode、refresh/render/decode 或 lifecycle。隐藏时恢复原生 ARIA，显示时恢复题字 ARIA；选择跨背景、task/thread surface、React 重挂载和无重载热应用保持，新进程默认显示。重复键只消费不切换，Shift/Meta 组合不接管，停用必须清除控制 dataset 并完整恢复原生标题 | 真实 T 键、repeat/Shift 排除、伪元素 display/ARIA、节点与几何全等、计数零变化、surface 往返、热应用继承、RESTORE 原生状态合同 |

V50 当前证据边界：保留式 release `0.13.0-20260808-121354` 已新建并通过双入口 verifier；仓库与安装副本的 CSS/注入计划 SHA-256 一致，旧 `0.13.0-20260803-191843` 中曾用于验收同步的两份文件已按其安装时 Git 检查点恢复原始 SHA。同一个真实 `2050×1106 @ 125%` 任务中已同时出现 queue/goal、300px 环境卡与四角长方形输入器；原生/主题 surface 均为 `736×98px`，完整比较最大 DOMRect 差为 `0`，四角 paint 保留。核心联合合同 45/45、非宠物增量 19/19、UI 材质 4/4 通过。不包含两只延期宠物或已取消葫芦。

当前技术状态（不等于用户视觉验收）：V15-03 / V15-04 的 renderer 状态矩阵已通过本机 ASAR 与 Windows forced-colors 合同。Electron 四个应用菜单触发页签和原生下拉菜单本体全部保留官方 paint；下拉本体不在 renderer DOM 中，不得把夹具中的页面元素当作应用菜单交付。

V15-05 / V15-16 当前技术候选使用官方“悟空”书法生成 336×336 深/浅透明 WebP，分别约 25–34 KiB；以原生 56×56 槽位为锚点绘制 168×168 视觉层，有效边界约为 141×96 px。官方源 SHA、四边透明、上移量、深浅场景映射、原生 host 几何不变、两行原生文本视觉隐藏与最小包门禁进入定向测试；最新四战斗场景无头证据为 `artifacts/test-runs/v16-landing-threefold-20260728T3/`，仍待用户实机视觉验收。

V15-14 / V15-15 当前实测：22 张唯一活动背景共 45,201,592 px、8,355,513 bytes，最大两张合计 5,337,600 px；8 张活动 UI WebP 单张最大 580,608 px。活动背景满足 960p-wide、批准的超宽构图或明确的源分辨率例外；低分辨率历史 `great-sage-return.jpg`、被否决候选与夜叉王裂焰图均不进入运行包。

V50 输入器当前技术候选已通过定向运行时与真实 renderer 几何合同：surface、editor shell、editor、footer、按钮和 padding 完全沿用原生，只在同一矩形内绘制四个角。V22 joined stack 的“一个 queue 外层面板 + N 个内部消息叶片 + 一个 goal 外层面板”生产拓扑继续有效；guided / multi-guided 夹具证明新增消息只增加内部纸纹叶片，整组首个外层面板才拥有两个上角，后续目标层直边承接，独立 pill 全圆。V17/V20 的主题高度比例与 V21 的“每条消息一个 outer panel”继续保留为已被取代的历史证据。

> **0.12.3 / V13.3 历史验收合同。** 以下内容继续保留；冲突处以 V15 为准。

| ID | V13 需求 | 验收方法 |
| --- | --- | --- |
| V13-01 | 活动 runtime 只替换全窗背景与用户明确授权的新建页题字/图案；顶部栏、侧栏、环境信息、消息、composer、按钮、尺寸、命中区和回答无框状态保持原生 | 注入前后 DOMRect、原始文本节点与非授权 computed style 深比较 |
| V13-02 | 新建任务严格轮换 6 张战斗图，对话严格轮换 5 张风景图；两池独立且损坏游标归一为安全首项 | 浏览器状态机测试与 6+5 唯一 SHA 清单 |
| V13-03 | 背景 `cover` 全窗；首帧先完成图片解码且 ready 前保留原生 carrier paint，后续切换再进行 820 ms 双层真实 opacity 交叉淡变；快速请求排队且不得闪黑 | 首图悬挂/解码门控、淡变中点 alpha、排队与 reduced-motion 测试 |
| V13-04 | 隐藏、`aria-hidden`、`inert` 或透明旧对话不得把新任务页误判为 thread；反向重叠时，可见且含 turn 的对话必须优先于仍在布局但 `opacity:0` 的旧新建页；普通侧栏点击不得无故换图 | 双向旧页面重叠 fixture、可见性判据与非路由点击 fixture |
| V13-05 | 覆盖层被移除或层数损坏后立即撤销 ready 并恢复原生 carrier paint，取消旧 generation 后自动恢复为 2 层与 1 个活动图；稳定布局不得形成 ResizeObserver 自循环 | 交叉淡化中移除、自修复、generation、单层稳定与 refresh quiescence 测试 |
| V13-06 | composer 候选在用户选择前只作为预览，不进入 runtime。V9 审稿覆盖 `736×98` / `560×98` 与 `154 px` 多行增长态，生产不得锁死高度；主题前后 host/editor/footer/五个按钮 DOMRect、原文字、ARIA、提示词、overflow 与命中区必须完全一致 | V9 双宽双高几何 JSON、五点命中测试、上下文/盲审截图与运行包清单 |
| V13-07 | 被否决的小天命人基础立绘和所有派生图集继续冻结；完整神锋前端、握持段、后棍身、尾端及双足厌火魔足未同时成立前不得扩展动作或发行 | 基础角色四项连续性审查与三重发布白名单 |
| V13-08 | 用户新录制只用于跑动和背面棍花的节奏、重心、脚步、剪影及棍路；不得从背面视角臆造正面握法、脸部、夜叉套正面或武器遮挡段 | 原录像只读 hash、逐帧相位表和“可证 / 不可证”边界 |
| V13-09 | 稳定安装追加 retained release，写前备份普通入口，同时建立唯一名称主题入口；安装后 verifier 必须证明两个入口指向同一 bridge 和同一 release。绕过入口的 AppX/AUMID 不作虚假保证 | 安装后 JSON、快捷方式/bridge/release SHA 与进程命令行 |
| V13-10 | 公共执行路径不删除、移动本地任何文件，不修改 ChatGPT.exe、app.asar、WindowsApps 或 Codex 配置；每轮只跑相关测试并精确 commit/push | PowerShell/Node 静态合同、Git cached diff 与远端 SHA |
| V13-11 | 背景必须穿透官方 `main.main-surface` 与其顶部装饰 fade，不能只显示在侧栏；只清除二者的 paint，不改圆角、阴影、overflow、DOMRect 或 hit box | 官方 app.asar 只读源码审计 + 主表面 computed style + 真实窗口截图 |
| V13-12 | 新建页原 56×56 图标位显示真实金箍棒候选，题字显示“此去，欲破何局？”；官方 280 ms 淡入、零尺寸外壳、既有外壳内部补挂内容及 React 后续 class 回写时必须在首次启动自行保持，不依赖 resize；120/420 ms 有界探针必须按期执行，不得合并成迟到的单次刷新；不得新增面板、按钮、emoji 或改写原文字节点，原项目按钮下划线不得穿过题字 | 稳定 data selector、延迟/内部挂载、父级 opacity 0、className 覆写、<300 ms 无 resize、DOMRect、`textContent`、装饰透明、aria 与 restore 测试 |
| V13-19 | 背景 overlay、活动 layer、image 与 veil 在首次提交和任何窗口 resize 后必须与当前 viewport DOMRect 完全一致；不得因中央原生 carrier、DPR 或窗口比例出现只覆盖侧栏/中央黑块/边缘漏底 | 初始与 resize 后四层 DOMRect、`fixed/inset/cover`、主表面 paint 清除及后续单窗口真实 Codex 多比例验收 |
| V13-13 | 最终随 Codex 启动集成必须排在全部视觉/宠物验收之后；现有 PowerShell bridge 与 1700 ms CDP watcher 只作开发入口，不能当最终方案；正式交付不得以换一个轮询间隔冒充宿主生命周期绑定 | 里程碑顺序审计、进程/端口/内存差值与最终宿主级生命周期测试 |
| V13-14 | 背景首屏不得全量预载；解码请求最多 1 个，稳态持图层必须为 1，过渡期最多 2；请求替换、超时和停用均须取消并释放解码器 | 可计数/悬挂 `Image` 定向测试、THEME_STATE 资源遥测和真实进程差值 |
| V13-15 | 全屏层不得永久使用 `will-change`、滤镜或缩放；`will-change` 只允许在交叉淡变期间出现，结束后恢复 `auto` | 过渡前/中/后 computed style 与持图层数量断言 |
| V13-16 | 每次调试前后、长阶段至少每 30 分钟及收尾前检查本项目进程、监听端口和物理内存；只释放可证明属于本项目的调试/测试/工具资源 | 父进程、命令行、端口与内存的前后独立核验 |
| V13-17 | 常态只保留当前控制窗口；主题调试窗口仅在截图或指标采集时临时开启，完成后立即关闭，不得在大型项目工作期间保留第二个 Codex 窗口；自动回收路径必须先以 CDP process info 核对临时 root PID，普通截图路径不得擅自关闭控制窗口 | 关闭前记录调试 root/launcher/watcher/端口；关闭后分别确认 root、owner、子进程、watcher 与专用端口均不存在，控制窗口根 PID 保持不变；静态合同验证 opt-in 与 PID fail-closed |
| V13-18 | composer 候选与最终选案不得引入外部网络请求、候选位图解码、JS timer、持续动画、filter 或 `will-change`；装饰层不接收事件，reduced-motion 与 forced-colors 必须安全回退 | 候选 CSS 静态审计、浏览器请求/计时器计数、pseudo computed style、reduced-motion 与 forced-colors 证据 |

> **0.11.0 / V12 历史验收合同。** 下表继续保留；冲突处以 V13 为准。

| ID | V12 需求 | 验收方法 |
| --- | --- | --- |
| V12-01 | 活动 runtime 只替换全窗背景；侧栏、顶部栏、环境信息、消息、composer、按钮、文字、图标、尺寸和命中区保持原生 | 样式表禁区测试、真实 DOMRect 与 computed style 对照 |
| V12-02 | 新建任务只使用 6 张战斗图，对话只使用 5 张风景图；两组独立轮换，切换时不瞬黑、不跳回同一张 | session 游标状态测试与跨 landing/thread 截图 |
| V12-03 | 背景必须完整 `cover` 全窗；双层交叉淡变不阻挡交互，`aria-hidden`、`inert`、`pointer-events:none` | 运行时结构与点击穿透测试 |
| V12-04 | composer 候选不得进入 runtime，直到用户审稿通过；V1–V6 继续保留为失败历史 | 注入资源清单与 runtime style 审计 |
| V12-05 | composer 不改变 `736×96` / `560×96`、原控件坐标、提示词和命中区；夜叉套+神锋由小天命人、金箍棒由战斗背景完整承担，composer 不堆三件道具 | 1×/4×审稿、12 态几何、元素落点矩阵与盲审 |
| V12-06 | composer 不得使用整圈古风画框、外置悬浮道具、AI 代理装备、发光 HUD 或 emoji；装饰四向外扩为 0 | alpha 包围盒、素材来源与视觉审计 |
| V12-07 | 小天命人各动作行必须保持同一夜叉套造型、同一比例和正确神锋；不得在跑动行换成 Q 版大圣 | 全 11 行 contact sheet、逐帧角色一致性 |
| V12-08 | 小八戒 hover 模仿“大笑奶龙”的捧腹节奏：一手持正确完整九齿钉耙，一手捧腹，前俯—后仰—腹肩弹起；不得摇耙或穿模 | row 4 GIF、5 帧动作关键姿势与九齿计数 |
| V12-09 | 宠物升级保持 discovery 目录稳定；新 atlas 使用 `payload-<hash16>`，旧 payload 全部保留；改写 metadata 前完整复制到唯一 history | 隔离安装、升级、冲突 fail-closed 与文件树前后审计 |
| V12-10 | 公共安装、停止和恢复路径不删除任何文件，不修改 ChatGPT.exe、app.asar、WindowsApps 或官方配置 | PowerShell AST、reparse 防护与保留式合同 |
| V12-11 | 每轮只跑相关测试；完成真实窗口定向审计后再精确暂存、提交并 push | 测试日志、截图、cached diff 与远端 SHA |
| V12-12 | 本机游戏安装、录像、截图、模组和既有候选全部只读；允许复制与新增派生物，不得删除、移动或覆盖任何原文件 | 源目录文件清单/hash 前后对照，写入目标限定为项目内追加路径 |
| V12-13 | 小天命人跑动与棍花在用户提供新录制前暂停；现有本地录像与已抽辅助帧不得作为完整动作真值 | 动作候选目录与 canonical hash 审计 |
| V12-14 | 小天命人基础角色必须同时具备完整神锋前端、握持段、后棍身与尾端，且双腿/双足均为正确厌火魔足；缺任一项不得扩展动作或进入 canonical | 正/侧/背基础板、武器连续性与双足装备审计 |
| V12-15 | 被视觉否决的小天命人旧包继续保留，但不得被 V12 准备、打包或新安装；已有 discovery 目录与用户当前选择必须字节级不变 | 三重白名单、最小包缺失断言、预置冻结目录前后 hash |

> **0.10.0 / V11 历史验收合同（保留）。** 下方内容只记录 V11 当时对 V10、V9 的替代；冲突处以顶部 V50 合同为准。

| ID | V11 需求 | 验收方法 |
| --- | --- | --- |
| V11-01 | 页面仍为原生 Codex 三段结构，不得增加侧栏、底栏、控制面板、开关、状态卡或 emoji | DOM 结构与原生基线对照 |
| V11-02 | 原生槽位坐标、宽高、padding、文字、图标和事件不变；允许替换圆角、切角、边线、材质和空伪元素 | before/after DOMRect、文本与 computed style 对照 |
| V11-03 | 侧栏操作项、输入器、发送键和环境信息卡必须具有彼此统一、可辨认的黑神话形状语言，不得只换颜色 | fixture 与真实窗口视觉审计 |
| V11-04 | 助手回答及其祖先链必须透明、无框、无阴影；用户气泡和输入器不得拉长，提示词与回答不得改写 | 动态 thread fixture + computed style |
| V11-05 | 背景固定全窗 `cover`；11 张画面独立色板、遮罩、焦点与亮度，白场杨戬和暗场佛窟均满足正文对比 | 场景像素/对比度测试 + 截图 |
| V11-06 | 新建任务为战斗境，进入对话为风景境；同一路径/hash 稳定选图，标题流式变化不得跳图 | 状态 fixture |
| V11-07 | 页面装饰只保留无交互湘妃葫芦；静态小悟空/小八戒覆盖层不得存在 | 运行时状态与 restore 断言 |
| V11-08 | 小悟空必须使用游科官方天命人厌火夜叉套 1/12 的造型和正确兽棍·神锋；不得画成夜叉王、通用红甲或金箍棒 | canonical、行级 contact sheet 与盲审 |
| V11-09 | 小八戒必须复刻 INART 1/12 的灰黑猪脸、旧青衣、念珠与腰封；神态更可爱但非粉色幼猪；武器必须是完整九齿钉耙且每帧恰好九齿 | canonical、逐帧武器计数与盲审 |
| V11-10 | 两只宠物必须是 Codex Hatch Pet v2：`1536×2288`、8×11、9 个标准动作、16 个顺时针 look 方向、透明背景 | `validate_atlas.py --require-v2`、动作差异、四向/连续性与 RGB residue 验证 |
| V11-11 | 主题/宠物发布包不修改 `ChatGPT.exe`、WindowsApps、`app.asar` 或官方配置；公共执行路径不删除任何文件，历史候选原位保留 | 静态脚本合同、安装前后文件审计 |
| V11-12 | 每轮只运行针对性测试；形成需求、设计、分工、宠物设计和工作日志；精确暂存后 commit/push | 测试记录、文档、Git 远端 SHA |

> **0.9.0 / V10 历史验收补充（保留）。** 下方内容只记录 V10 当时对 0.8.0 的替代；冲突处以顶部 V50 合同为准。

| ID | V10 当时需求 | V10 验收结果 |
| --- | --- | --- |
| V10-01 | 普通 ChatGPT 入口启动主题 | 用户开始菜单 `ChatGPT.lnk` 使用 178 字符 `-File` 短入口；真实启动得到独立 `ChatGPT.exe` PID 26812、CDP 38625 与 watcher PID 18296。 |
| V10-02 | 删除主题即回原生 | 入口桥接脚本位于 append-only 历史目录；主题根目录不存在时只动态启动当前官方 Store `ChatGPT.exe`，不再请求主题运行时。桥接脚本本身保留，不执行删除。 |
| V10-03 | 关闭应用即关闭主题 | 连续约 13.6 秒没有 Codex renderer 后 watcher 退出；官方 Windows 主进程若按托盘策略隐藏窗口但保留 renderer，则原 watcher 继续绑定且不新增副本。再次点击同一快捷方式以同一 env/profile 和 `codex://launch` 触发官方 `second-instance`，按目标 PID 的真实 HWND 验证复显；renderer 已退出时才重建 watcher。不常驻服务、不建开机项、不结束普通 Codex。 |
| V10-04 | 无新增栏与控制按钮 | 允许且仅允许一个 body 直属、无障碍隐藏、惰性且不命中鼠标的宠物覆盖层；它不是栏、卡片、按钮或可交互 UI。旧“只能伪元素”的实现约束由此替代。 |
| V10-05 | 宠物独立于输入框 | 小悟空与小八戒使用独立透明 WebP 和固定层，landing 为 112 px 档、thread 为 92 px 档；不改变 composer DOMRect，碰撞或窄屏时隐藏。 |
| V10-06 | 葫芦不只放输入框旁 | 湘妃葫芦按 surface 在 `landing-hero-left`、`right-card-foot`、`workspace-upper-rail` 三组候选位置中选择；真实截图分别命中新任务主视觉与环境卡脚部。 |
| V10-07 | 换背景同步换组件配色 | 11 个场景各声明 `tone`；切换时同时更新正文、背景基色、topbar、sidebar、composer、环境卡、用户气泡、代码块、菜单与 veil。 |
| V10-08 | 完全覆盖且保留原生尺寸 | `body::before` 固定全窗、`background-size:cover`；真实窗口两页均为 2050 × 1106、侧栏 275 px、输入器 736 × 98；thread 环境卡 300 × 473。 |
| V10-09 | 内容零改写 | 助手回答保持透明、无框、无阴影；输入提示与对话文字不替换；覆盖层 `aria-hidden`、`inert`、`pointer-events:none`。 |
| V10-10 | 零删除与官方零写入 | 公共脚本没有删除、移动或进程终止命令；每次替换快捷方式前复制旧版，桥接脚本按内容哈希新建；WindowsApps、`app.asar`、`ChatGPT.exe`、官方配置零写入。 |
| V10-11 | 启动竞态可恢复 | `DevToolsActivePort` 发布后，回环验证最多重试 20 秒；renderer 生效也最多重试 20 秒，只有 V10 回读成功才记录 `watching`。 |
| V10-12 | 定向测试与真实审计 | 运行时、视觉、场景色板、生命周期、保留合同和最小包定向测试 24/24；真实截图与同名 JSON 均为普通快捷方式启动的生产 renderer。 |

无法在安全边界内承诺的入口：直接执行 WindowsApps 内可执行文件、Store AUMID、协议或第三方自建快捷方式。覆盖这些入口需要修改官方程序、系统级重定向或进程注入，与 S-01 和稳定性目标冲突，因此不实现。

## 0.8.0 历史产品目标（保留）

> 以下 0.8.0 目标、功能表与成本数字只用于追溯当时实现，不是 V50 现行合同；与顶部 V50 表冲突时全部以前者为准。

在不改变 Codex 原生三栏布局、不新增控制栏、不修改官方程序文件的前提下，实现一套可安装、可恢复、可审计的《黑神话：悟空》深度样式层。它必须真正替换背景、新建任务页、侧栏按钮、输入框和环境信息窗口的造型，不得只换颜色 token。

角色重点是杨戬与大圣；夜叉王是低频次级战斗场景。不使用战绩页、HUD 或普通战斗截图作为主背景。用户最终否决夜叉套、兽棍·神锋和武器条作为组件装饰，因此 0.8.0 运行时停用这些素材，改用湘妃葫芦、小悟空与小八戒；历史文件保留但不打包。

“下载即用、删除即原生”的可实现定义是：解压后双击包内 `start-theme.cmd` 启动主题 Codex；双击 `stop-theme.cmd` 后关闭该窗口，用户可自行删除整个解压目录。所有 profile、请求、事件和运行状态均写在包内 `.wukong-runtime`，普通 Codex 入口不加载 CSS。0.8.0 不写官方程序、`config.toml` 或目录外快捷方式。按用户最高约束，本轮实现、测试和发布不得删除任何文件，旧版本与证据采用 append-only 保留。

## 0.8.0 历史功能验收（保留）

| ID | 需求 | 验收标准 | 当前状态 |
| --- | --- | --- | --- |
| F-01 | 保留原生页面 | 顶部栏、侧栏、工作区、环境栏、输入区及事件均由 Codex 提供；主题前后槽位坐标与尺寸一致。 | 定向自动验证 |
| F-02 | 无额外主题 UI | 不创建主题按钮、状态栏、侧栏、底栏或 body 控件节点；三件伴随元素只使用 `pointer-events:none` 伪元素。 | 定向自动验证 |
| F-03 | 黑神话配色 | 墨铁、潇湘石青、旧金、漆褐与骨白形成中暗但可辨画面，不近黑、不漂白。 | 自动实渲染 |
| F-04 | 双境自动切换 | 新建任务页是战斗境，进入对话后是风景境；不提供手动开关。 | 状态测试覆盖 |
| F-05 | 战斗境 | 首幕使用新的水墨杨戬对决图；主组覆盖杨戬、大圣归来与金箍棒，夜叉王等三张次组只低频出现。原生标题与说明不改写。 | 自动实渲染 |
| F-06 | 风景境 | 对话页只从五张纯风景图中稳定选择，同一任务刷新不跳图。 | 状态测试覆盖 |
| F-07 | 侧栏按钮 | 未选中条目完整沿用 Codex 原生默认、悬停、焦点、展开、折叠、禁用及状态指示；只有原生 current/selected 节点换成白纸黑字，素材始终按该节点实际尺寸居中铺满且不出现红色左边。 | 定向自动验证 + 实机视觉验收 |
| F-08 | 输入框与相邻状态 | 主输入器使用受限高度短卷比例；编辑器、footer、项目上下文、排队消息、进行中目标、按钮、文字、ARIA 和命中区继续由 Codex 提供。queue/goal 以当前 ASAR 的真实外层/内层拓扑连续衔接；原生边框与模糊层可视觉透明，但不得删除其盒模型占位。初始 `opacity:0` 的 Motion 目标也必须在首帧正确映射。 | 原生拓扑 + 几何 + 首帧映射验证 |
| F-09 | 环境信息 | 只给最外一个 300px 原生环境卡及其真实 Section/标题/行换材质，不出现卡片套卡片；子智能体、后台进程、来源等动态分区都必须按 ASAR 结构识别，保留折叠、按钮、行序与命中区。宠物与葫芦不属于本轮完成范围。 | 定向回归 + 环境卡专项实机整页通过；联合门待验 |
| F-10 | 对话内容 | 用户气泡只换材质与轮廓；助手回答无背景、无边框、无阴影；双方文字逐字不变。 | DOMRect / `innerText` 验证 |
| F-11 | 图标纯净 | 不注入 emoji、Unicode 伪图标或装饰按钮；只保留原生图标。 | 代码与 fixture 验证 |
| F-12 | 下载 / 停用 | 包内启动、包内状态、同生命周期 watcher、经验证的 renderer 恢复；公共脚本不删除或移动文件。 | 便携包与保留合同 |
| F-13 | 真实窗口审计 | 从受管入口启动后，在真实 Codex renderer 中同时核对样式状态、surface/mode/scene、标记数量、原生几何与截图。 | 0.8.0 真实窗口完成 |

2026-08-03 V38 当时的验收边界：先完成 F-07 的“仅选中态”收口，再修复 active goal 初始动画阶段偶发漏标、composer/queue/goal 原生黑边残留，并完成环境信息窗的分区材质；这些门已由顶部 V50 合同更新或关闭。

## 0.8.0 历史稳定性与成本（保留）

| ID | 约束 | 验收标准 |
| --- | --- | --- |
| S-01 | 官方程序零写入 | 不修改 WindowsApps、`app.asar`、签名或 `ChatGPT.exe`。 |
| S-02 | 回环隔离 | 调试通道只绑定 `127.0.0.1`，使用随机端口，只接收 Codex / 本地目标。 |
| S-03 | 最小运行包 | 不复制 `.git`、`docs`、Studio、测试、源 PNG、停用素材、`node_modules` 或临时文件；使用 Codex 内置 Node 与仅依赖 Node 核心模块的回环协议客户端。 |
| S-04 | 静态素材 | 11 张 JPEG + 3 张 WebP 共 2,737,884 bytes；每张背景只嵌入一次，无视频、动画轮播和运行时素材请求。 |
| S-05 | 低运行成本 | V10 仅以 `childList` 观察新增/移除的关键结构，排除属性与文字变化，不监听全窗滚动、逐字输入或焦点；侧栏/提交只做有界复核，所有页面刷新以 650 ms 合并节流；watcher 1.7 s 做廉价存活探测，无页面约 13.6 秒后停止。 |
| S-06 | 几何零侵入 | CSS 不覆盖宿主宽高、网格和固定槽位；逐槽及逐消息比较 DOMRect。 |
| S-07 | 零删除 | 公共安装、启动、停用脚本不得包含文件删除或移动；旧 release、state、素材、配置快照和失败证据保留。 |
| S-08 | 配置不丢失 | 0.8.0 从不写 `config.toml`；发现旧版 state 时只做 append-only 证据复制，不自动覆盖当前配置。 |
| S-09 | UTF-8 / PS 5.1 | 中文文档与 JSON 使用 UTF-8；PowerShell 生命周期脚本保持 ASCII-safe。 |
| S-10 | 内容零侵入 | 注入前后对话 `innerText` 完全一致；样式标记不落到用户气泡外层锚点。 |

## 发布与记录

- 每个可验证设计轮次独立 commit / push，不堆积多轮未发布实现。
- 每轮运行覆盖当前风险的最小测试集；纯视觉调整不跑无关全量 E2E。
- 需求、设计、多对话分工、运行调查和素材边界放在 `docs/`；过程日志写入本地 `docs/logs/CHANGELOG.md`。
- fixture 截图只证明 CSS、DOM 标记和几何契约，不得冒充真实 Codex 生产窗口证据。
