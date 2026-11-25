# 原生 UI 与主题替换接口

## 正文与输入区的轮廓隔离（2026-11-25，v135）

当前 Windows Codex 26.1120.5083.0 的 ThreadScrollLayout 在普通布局中将 transcript wrapper 和 footer 放在同一滚动容器内，compact 布局则将 footer 放在外部。依据直接子节点的 data-thread-user-message-navigation-content 识别正文 wrapper，不给滚动容器或 footer 加遮罩。

遮罩是滚动视口大小的 SVG luminance 图：白色保留正文，黑色路径取自真实 composer surface 和 rail Item 的边界及四角半径。半径按 CSS 的统一缩放规则归一化。原生 attached Rail 的 Item 通常没有自身圆角，可见顶角属于 overflow:clip 的 Rail 外层；因此每条黑路径同时与真实祖先的 overflow 裁切求交，包括 portal target 的层级。重叠黑路径形成遮挡区域的并集，保留输入区两侧和圆角外正文。

布局刷新或现有 ResizeObserver 回调缓存轮廓与坐标。passive scroll 回调只读取 scrollTop，并合并到一次 requestAnimationFrame 更新 mask-position；不读取布局或遍历消息。输入框的尺寸、材质、滤镜和原生滚动范围保持。专用释放事件允许原生恢复在 runtime 对象丢失时仍移除滚动监听、排队帧与自有属性。原生资料、Dots、首页及无 footer 的嵌套滚动区不靠首个子节点猜测匹配。

当前适配运行时为 v134-status-rail-compositing，原生来源为 Windows Codex 26.1117.4957.0。状态条与标签页绘制调整概览见 [v0.18.16 发行说明](RELEASE_0.18.16.md)，验证范围见 [验证记录](VALIDATION.md)。

## 状态条实际材质表面的背景采样（2026-11-24，v134）

目标与排队消息共用 Rail.Item。带原生未加状态前缀的 bg-* token 且非 bg-transparent 的 data-composer-rail-item 拥有独立材质，本轮与项目条一并将该表面的 backdrop-filter 和 -webkit-backdrop-filter 设为 none。原生边框、分隔线、圆角、负边距、退出状态与交互继续由组件控制。

浮动输入框使用透明的状态条，背景滤镜由外层 FloatingSurface 的实际背景子节点持有。主题按 section.floatingSurface-* 中直接内容包装下的 data-floating-chat-surface 识别内容槽，槽内存在 data-composer-rail-item 时，只对同一包装下具有 bg-surface-elevated-secondary／bg-surface-canvas 的直接 FloatingSurface 背景子节点停用采样。该关系沿用内容槽与背景槽的真实父子结构，适配宿主定位类和可选拖动标记的变化。透明定位壳、无状态条的浮动输入框、普通首页输入主体及独立菜单各自保留材料归属。间歇竖线尚未稳定复现，源组件回归用于检查绘制范围与动态状态，本轮实机确认另记验证记录。

同类检查发现 compact 浮动聊天最小化后的 working response-preview 使用独立 FloatingSurface notice，工作文字通过真实 cadencedShimmer 链渲染。该提示位于 data-floating-chat-surface 之外，其原生包装固定发布 data-pip-obstacle="quick-chat"。主题在该包装的直接 FloatingSurface 背景子节点具有 bg-surface-elevated-secondary 且包含 role=status 中的 workingTextShimmer-* 时，停用此表面的两种背景滤镜。ready 状态的独立 notice 和菜单使用各自滤镜。额度恢复提示的原生表面没有背景滤镜，文件进度徽标也没有第二采样层；紧凑 warning 左侧强调线沿用原生设计。

## 右侧标签页标题背景与面板边界（2026-11-24，v134）

实机标题栏带原生 me-1 末端间距，绝对定位的 right-panel 标题背景与内容 aside 宽度相同、起点相差 4 CSS px。主题只给标题栏内绝对定位的外层 right-panel 载体绘制原生 surface 底色，内层 focus、按钮和已传送到标题栏的 tab row 继续由原生内容绘制。独立注册 end-slot 的实际按钮载体和未传送到标题栏的 tab row 维持各自背景归属。

对于 me-1 分支，外层标题背景用 linear-gradient 在起端保留一个 --spacing，再绘制原生底色；壁纸就绪后，底下的 main surface 在逻辑末端补一条 --spacing 宽、原生标题高度高的同色背景。末端补色限定到 data-app-shell-active-page=true 与 data-app-shell-unified-tab-strip=true 的工作区，并要求存在可见的绝对定位 right-panel 标题。该组合对应打开的分栏，收起、完整视图和非活动工作区按自身状态绘制。RTL 将渐变和补色方向反转。

标题边界线来自同一外层 right-panel 载体内直接 absolute.inset-y-0 轨道中的空装饰叶。主题进一步要求 data-app-shell-titlebar-divider="pane"、aria-hidden=true、pointer-events-none 和 :empty，使用独立 translate 属性沿 --spacing 平移，RTL 使用负值。该范围沿用活动工作区、unified 分栏、me-1 与可见标题条件。原生 1 CSS px 线宽、边框颜色、阴影和像素对齐规则保留，原生标签、按钮、内容与拖拽区域几何保持。修正后前台读回该线与内容 aside 起点一致，内容绘制仍从原生边框之后开始。用户已实机确认右侧标签页现在对齐，最终样式读回和可见性范围见 [验证记录](VALIDATION.md)。

## 项目条背景采样层（2026-11-24，v133）

首页 UtilityBarSlot 是透明的 motion 定位壳，真正的项目条表面由带原生背景 token 的 data-composer-utility-rail 节点绘制。用户此前反馈该条内部偶尔出现横线，该间歇现象未能稳定复现。实际读取到该表面使用 12px backdrop-filter，controls 栏内部结构保持原生布局。

参照既有普通对话输入框关闭背景模糊后移动遮盖消失的实机经验，v133 在 utility rail 的实际材质表面将 backdrop-filter 和 -webkit-backdrop-filter 设为 none，消除同类采样层。底色、顶部高光和 1px 内阴影保留，原生尺寸、收起动画、负边距与事件继续由原生组件控制。透明变体和内部 scroll-area 按各自材料归属绘制。用户验证后认为项目条内部横线已不再出现，原触发条件仍不明确。v134 将相同处理扩展到目标条与排队消息。

## 设置原生整行悬停（2026-11-23，v132）

设置可点击行由 data-settings-search-entry 与原生 hover token 关联；26.1120.5083.0 已撤去原自定义规则入口，通用反馈回归改由真实 security-linked-apps 的同一 clickable Row caller 承担，导入历史的按钮带有 import-history- 前缀的 aria-controls。主题只在 data-settings-panel／data-settings-search-root 内给这两类行映射较淡的悬停底色，深色为 rgba(183,205,224,.055)，浅色为 rgba(76,107,132,.035)。整行反馈沿用原生 hover 状态，原生图标、分隔线、圆角、键盘焦点轮廓和事件继续由组件控制。鼠标反馈只更换底色，强制色彩模式使用原生颜色。

## 侧栏实际壁纸取色（2026-11-23，v131）

普通聊天导航由 default aside 中最外层的 data-sidebar-navigation-root／data-slate-sidebar-content 识别，peek 使用带原生 popover 背景 token 的 slate 内层。两者只消费专用 conversation 材质变量；共享 navigation-fill 继续用于设置及目录。Activity 的直接宿主、标记 section 与真实 settings-nav-scroll-container 排除保持。

沿用 adaptShellToImage 的真实 cover 裁切及 24×64 canvas。复用已读取像素和亮度上下阈值，对中段像素求 RGB 均值，原始像素均值提供回退；结果发布为 forge-sidebar-sampled-color。没有增加 canvas、DOM 测量或监听，sampleKey 缓存与原有亮度公式保留。dispose 和恢复原生均清除此新属性。

深色材质保留采样色相并降低其亮度，以较低透明底配上下轻渐变；现有亮度样本结合场景 brightness／thread veil 自动提高亮背景衬底，首页不套对话 veil。浅色以原浅底为主、少量混入真实采样色。采样未就绪时回退既有场景配色，缺少场景标记则沿用原导航材质。

可见 peek 由内层独占色层，外层保留原模糊而不重复填色。原生退出期间，即使已 inert／collapsed／aria-hidden，popover 背景 token 仍代表保留绘制，应等 token 退出后才恢复外层；真正 hidden／隐藏类及其祖先不清空可见外层。新材质仅在允许透明度且非强制色彩时启用，其余状态继续使用 Canvas 和无滤镜。

## 公共资料页与执行扫光（2026-11-22—23，v130）

公共资料页通过自己的页面布局包装渲染，根是 `div.bg-surface`，直接包含标题包装及 `data-profile-scroll`。它没有资料设置组件的 `data-settings-search-root` 标记。主题依据真实的直接父子关系清除根底色，不依赖 main 祖先，覆盖独立页面及 tab 两种原生呈现。资料设置页的现有规则保留。

标题包装在 scrollTop>0 时才获得 `bg-surface/80` 与原生背景模糊，内部使用 `data-app-shell-header-toolbar`。主题只在这个实际滚动底板上应用共享玻璃材质；回顶部后不再匹配，保留原生透明标题、滚动遮挡、控件和尺寸。无关背景、错误嵌套的滚动节点及保留的隐藏页面不改变布局。

执行状态文字的原生 cadenced 蒙版扫光及旧式 text-clip 扫光保持。实机对照中仅关闭输入框背景模糊后，用户确认移动遮盖消失；限制状态行 paint 范围的候选无效，已撤回。正式规则只在 `data-thread-composer-backdrop` 内的 default／opaque／secondary 非拖放输入表面令 `--composer-layout-surface-backdrop-filter:none`。普通对话的半透明底色、高光和阴影保留；首页输入主体及独立菜单继续使用自己的玻璃滤镜。临时模糊诊断规则已移除。离线夹具不声称重现 Windows 合成异常，而是验证真实动画保留、绘制范围、输入框像素稳定及材质边界。

## 当前工作区与资料页（2026-11-22，v129）

当前核对 Windows Codex 26.1117.4957.0，包内 26.1117.41037。工作区在 retained pages 之外共用 `data-app-shell-surface-backing` 空装饰叶，原生侧栏动画控制其 inset 和圆角。壁纸继续覆盖视口，准备就绪后清除 frame 自己的窗口底色、docked 渐变及 backing 的底色；另一种 unified-tabs 布局在 main-content 直接包装的 `::before` 绘制同样底色，按相同就绪状态清除。布局、原生边缘细线和非主题状态不变。

普通内容及 viewer header 的顶部渐变现在读取 `--app-shell-content-fade`。仅清除对应主内容或 header 内空、aria-hidden、pointer-events-none 的背景图；保留高度、定位、原生透明度和控件。Dots 继续按动态锚点清除自己的空装饰叶。

新版设置用 `.settings-dialog` 统一绘制窗口材质，`.settings-dialog-sidebar` 提供阅读底色。`data-settings-panel` 内默认卡片已变为透明平铺行，主题让出其原生背景变量，显式 boxed 卡片继续使用玻璃底色。资料设置页没有 settings-panel 祖先，按 `data-settings-search-root` 及其直接 `data-profile-scroll` 子节点识别自己的背景壳；不依赖设置窗口容器。侧栏 peek 的嵌套 popover 绘制节点单独映射底色，不增加重复模糊。

首页字标的资源、168px 尺寸、文案及宿主透明度保持原样；首页壁纸不叠加灰雾或额外边缘遮罩。当前深浅色组件夹具与验证边界见 [预览说明](previews/README.md) 和 [验证记录](VALIDATION.md)。

新版输入框只在有独立材质的默认、opaque 与 secondary 状态应用主题；document／inline 的透明编辑画布以及拖放反馈沿用原生绘制。document 的子工具栏仍由原生自己绘制，不能把其尺寸随内容变化的根节点涂成玻璃。当前独立头像 activity-dismiss 使用自己的材质及原生按钮，不套用已经退出当前调用链的 reaction-picker 夹具；设计控件、独立工具栏与内联结账继续按真实 Popover owner 回归。

聊天查找条的 `data-content-search-overlay[role=search]` 是透明定位外层，`data-content-search-bar=true` 是 contents 包装。只给其直接 `div.bg-surface-secondary` 应用共享玻璃材质；`data-codex-find-input` 保持原生透明，尺寸、圆角和查找事件由客户端控制。

## 内置插件推荐（2026-11-22，v128）

Windows Codex 26.1111.9664.0 的 MCP App 宿主使用 `data-mcp-app-frame=true`，工具推荐内容位于独立 webview 的同源 iframe 中。内置 `suggest_plugins` 工具由固定的标题和 connector 来源共同识别。

宿主背景设为透明，嵌入页内沿其现有 `--request-*` 材质变量应用主题文字、描边和按钮颜色。卡片保留原生圆角和尺寸，图标底板使用浅色以增强黑色图形的对比。组件 CSS 来源为 2026-11-22 读取的实际推荐页，测试夹具保留相关规则与引用变量。

每个受管 webview 的加载事件负责重新应用样式，主题切换和热更新使用最新变量。同源 iframe 替换时重新挂载样式，恢复原生等待清理完成。旧实例清理按所属标识核对，避免删除新实例样式。

## 普通对话底部绘制（2026-11-15，v126）

Windows Codex 26.1111.2228.0 的 ThreadScrollLayout 通过外壳的 `::before` 和 `::after` 绘制普通对话底部渐变和实色。主题匹配带 `footer-` 类的外壳、直接语义 footer 和 composer backdrop 内的输入框主体，壁纸就绪后只清除两个伪元素的背景。原生锚点、大小、滚动透明度和输入框材质保留。Dots、工作区预览及语音专注状态沿用各自的绘制归属。

## 侧栏行材质与首页首帧

共享 sidebar-item 行使用原生 active、selected、hover 和菜单状态。主题按 data-app-action-sidebar-project-row／thread-row 区分项目与聊天：项目悬停和菜单用局部 ghost token，selected 聊天用淡冷色底，active 聊天覆盖为更清晰的冷色底及 1 CSS px 内描边。内描边由行自身的 inset box-shadow 绘制，沿用原生圆角，不占用链接的 ::before 热区或键盘焦点轮廓。拖放状态、activity-sidebar-host 和 forced-colors 保持原生绘制；左右书写方向使用同样的完整描边。

Windows Codex 26.1106.6628.0 使用 secondary ghost 变量绘制悬停和展开菜单。v124 在两类侧栏行内同时映射新版 secondary 和旧版 primary 变量。新版以 `bg-text-accent/10` 标记拖放目标，主题在此状态让出底色和描边，文件拖放继续由 `data-file-drop-active` 隔离。

v125 将普通导航入口的 secondary ghost 变量映射到通用悬停底色，涵盖行与行的伪元素。当前活动侧栏把有无障碍标签的 Activity section 挂在共享导航或其 slate 包装中。主题按该结构识别活动内容，让共享导航保留原生绘制，并从对话侧栏的采样范围排除。浮动侧栏外壳继续使用独立材质。

首页标题game-source是heading div，并非hero布局祖先；其子span可能包含真实项目选择按钮。home-icon是独立motion图标容器，父级通过原生opacity动画进出。主题直接对这两个语义owner绘制，与后续运行时属性共享字标／题字；不强制父级visibility，不改真实标题子控件的点击或布局。quote关闭与高对比路径也覆盖未标记节点。

home UtilityBarSlot 仅承担透明 motion 定位；data-composer-utility-rail 实际 Item 上的原生 bg token 决定是否拥有材料。底色和高光从首帧应用，v133 在该材质表面停用背景滤镜。bg-transparent 及无背景 token 的变体仍透明，内部 scroll-area 和上下定位按自身归属绘制。

## 标签页标题与完整视图（2026-11-22，v129）

当前右侧标签条发布 data-app-shell-tab-row，其内滚动条发布 data-app-shell-tab-strip-controller="right"；标题通过 portal 移到共享 titlebar。content 槽位使用 data-app-shell-focus-area="right-panel"，新版不再发布 titlebar-slot="content"。它可包含内联 end action，但不是所有注册动作的绘制 owner。

全局 HeaderAction 的 unified-workspace-controls 仍以 align=end、slotPosition=right 注册到 titlebar，focus-area 可为 main。end-slot 使用 data-app-shell-header-slot="end"；测量分支的实际载体为 col-span-full／row-start-1／h-full／min-w-max，非测量分支为 pointer-events-none／relative／col-start-1／row-start-1／h-full／w-full／min-w-0。只绘制对应 live 载体，不绘制同级不可见尺寸副本，也不把整个注册 grid 涂成实色。

主题在 end-slot 含原生 right-panel toggle 时给上述实际整高载体使用原生 surface 并清除背景图；v134 的标题背景归属收敛到绝对定位外层 right-panel 载体，非 portal row 保留自身覆盖。选择器不依赖模块 hash、按钮中文文案或固定像素。原生标签、按钮、内容与拖拽区域几何保持，边界装饰线的绘制偏移见上方 v134 范围。源码合同保护两种载体和注册／渲染关系；原生工作区 backing 的边缘细线保留，并与原生像素基线比较。

完整视图不延伸主题壁纸。原生 right-panel 切换按钮的 aria-pressed 组合显式 full 布局与独立完整视图覆盖状态；后者允许 workspace-layout 仍为 split。当前使用可见原生按钮作为优先依据，按钮缺失时才检查活动 workspace 的显式 full 状态。

进入完整视图后只暂停本项目材料样式并隐藏自身 inert 壁纸节点；原生 stylesheet、控件、顶部和侧栏自行绘制。图库参数保留在只含 forge 属性的受管样式中；材料热更新维持暂停，退出后复用原图片与主题。恢复原生移除两份受管样式及全部自有节点。toggle 自身／祖先的隐藏与重挂载触发同步判定，暂停状态不重复写入 hidden 属性。

原生侧栏材料规则排除 data-activity-sidebar-host，adapter 与同一 scope 的主题 CSS 保持一致。额度、goal、Popover 合同保留；不执行账户或客户端业务模块。

主题标记的协调现只增删实际差异，按 MARK_CLASSES 精确成员保留／撤销，不重写原生 class。根主题状态同值不写入；原生条件变化和路由仍重新收集并协调。此项仅减少更新工作，不改变本节语义选择器、绘制材料和几何。

## 数字资源块与当前模块类名（2026-11-05，v0.18.9／v118）

当前来源 Windows Codex 26.1029.7803.0 已改用 Rspack 数字资源块，入口只有四个 JavaScript 资源，组件及样式经运行时映射异步加载。原来的 app-shared／initial／primary 文件名和下划线模块类名不再是当前接口；不得只刷新来源哈希后沿用旧组件夹具。测试现在静态读取实际 module factory、require／export 关系、入口资源与 CSS 层次，再执行限定的纯展示组件，不执行客户端业务模块。

共享底部组件仍有 fade、surface、combined 三个分支，真实空装饰叶使用 background- 与对应 part 的类名 token。普通线程独立挂载 fade／surface，Dots 使用 combined／免责声明 surface，工作区预览通过 portal 挂载语义 footer 和独立间隙中的 fade。主题仅在明确布局／输入区 owner 下，匹配空、aria-hidden、pointer-events-none 的这组叶子，同时清除实体背景和渐变。显式 footer／composer owner 可在 body portal 中生效；无 owner、非空、交互、伪状态类及外部网页继续隔离。

语音专注模式在语义 footer 内挂载 `data-thread-focus-mode`。它触发直接外壳的原生实色规则。v125 只在壁纸就绪后清除带该原生绘制类的外壳底色，保留内层语音控件和布局。

PageSurface、CodeSurface、Popover、FloatingSurface、确认／语音面板、侧栏与额度提示的模块回退标记已迁移到当前未加前缀的 name- token 边界。页面壁纸仍挂到实际 PageSurface 中，保留原生 inset／圆角；代码工具栏与材质归属沿用原生结构。没有新增尺寸、位置、裁切或控件几何覆盖。

真实 ordinary／Dots 深浅状态的旧规则负控制均重现残余背景，新规则清除后所采样控件几何差异为 0；深色两类均取得可见窗口结果，浅色另有实际设置切换后的渲染器检查。当前准确检查范围见 [验证记录](VALIDATION.md)。

## 浏览器浮动输入框的 goal 背景归属（2026-10-24，v0.18.8／v117）

核对 Windows Codex 26.1016.8622.0。浮动输入框经 body portal 挂载在 #root 外；带 data-quick-chat-drag-handle 的 section 是透明定位／拖动外壳，保留 overflow-visible。它的直接 FloatingSurface 背景子节点负责整个组件的 22px 圆角和底色；data-floating-chat-surface 内使用 compact／inline composer。v134 在带状态条时停用实际背景载体的采样。不得通过给外壳加裁切或给 goal 行硬加圆角来修复材料归属。

当前 26.1117.4957.0 的原生 rail Item 背景选择为 `(variant !== "default" || !embedded) && backgroundMap[variant]`。默认 embedded 行没有背景类，controls 和 inline 在嵌入与独立状态下都透明；独立 default 使用 bg-surface-elevated-secondary，warning 在两种状态下均使用原生 color-mix 背景类。data-composer-rail-contained 只表示存在 rail 上下文，本身不能证明有底色。

共享条目材料要求 rail item 本身具有未加状态或伪元素前缀的 bg-* token，并排除 bg-transparent。独立 default／warning 条从首次挂载至退出保持同一材质，原生透明 goal 行由浮动外壳绘制。宽高、圆角、边距、溢出和控件行为沿用原生。

回归实际执行当前原生 rail、composer 与 floating frame／surface 展示函数，保护 body portal 归属、真实背景子节点、透明 goal 和其他变体；旧共享选择器的内存负控制能捕获方形覆盖。实机只复现并对照当前深色状态，渲染器隐藏及其他检查边界见 [验证记录](VALIDATION.md)。

## 额度提示卡与输入框轮廓（2026-10-21，v0.18.7／v116）

当前核对 Windows Codex 26.1016.6573.0。公共 Notice 的 `recovery` 分支提前返回独立 Recovery renderer，跳过普通 Notice 的 `attachedToComposer` 重叠分支。真实表面为带 `role="status"`、`aria-live="polite"` 的 aside；缺少专用 data 属性，使用限定在 composer 根内的 `_banner_` 组件家族作为回退标记。它自身使用固定 28px 圆角；默认多行 ComposerLayout 将其圆角映射到 `--composer-radius`，Windows 当前为 22px，曲线来自 `--composer-corner-shape`。

仅在同一 composer 根内存在默认多行／默认表面／默认圆角的输入框时，独立 Recovery aside 读取这两个变量。内嵌于实际输入表面、Popover、dialog、摘要或 checkout 的通知，以及嵌套 composer 的后代明确排除。其他输入布局保留原生轮廓。该规则只调整两项轮廓声明，不修改背景、宽高、padding、margin、布局、按钮或状态行为；全局禁止几何改写的测试仅为完整选择器和精确变量值增加例外。

回归实际执行当前安装包的 Recovery、按钮、ComposerLayout 与宿主渲染组件，并加载入口的 `@layer theme, base, components, utilities` 声明及实际 CSS 次序；仅拼接 CSS 而遗漏层声明会使原生 padding 被 reset 覆盖，不能作为有效夹具。源码合同和基线断言共同保护这一点。

用户额度已重置，原始业务状态无法再次打开。当前合法组件重现未出现截图中的额外深色底板；其归属和根因仍未确认，不能为此把共享父容器改透明或套用普通 Notice 的负边距。此处记录的是轮廓适配，不是原始底板问题已复现、已修复或实机验收通过。

## 既有表面适配

2026-10-18 补充核对同一 Windows Codex 26.1013.4894.0 的“设计控件”Popover，运行时 v115-popover-paint-owner，已随 v0.18.6 发行。`data-slot="popover-content"` 保留在原生 `unstyled:true` 的透明定位／缩放壳上，内层 FloatingSurface 才拥有真实圆角与底色。材质依据实际绘制载体分配，slot 或 dialog role 本身不能作为带底色的证据；详见下方 Popover 绘制归属合同。

2026-10-18 补充核对同一 Windows Codex 26.1013.4894.0 的摘要面板共享标题，运行时 v114-summary-header-material。Dots 处理框顶部的原生渐变仍读取默认 surface-elevated-secondary，而面板已替换为摘要材质，两者颜色不同形成黑带。本轮使空装饰渐变局部读取摘要填充，实色底板直接同色，保留原生渐变、透明度、布局和滚动遮挡；不把局部变量传给返回等控件。详见下方 Dots 处理框标题合同。

2026-10-17 当前来源已核对至 Windows Codex 26.1013.4894.0。底部背景共享组件有 fade、surface、combined 三个实际分支，分别出现在 transcript 占位、语义 footer、Dots composer、免责声明及主内容页面。按主内容／对话／composer 所属范围、空惰性节点和背景绘制家族识别，不绑定模块 hash、方向工具类或固定宽高；背景色和背景图同时清除，输入控件与布局预留保留。

默认 Markdown 代码块以 data-markdown-copy、data-code-block 和 CodeSurface 模块共同识别，卡片与直接子工具栏共用阅读底色；preview、hover、透明模式及用户消息 pre 没有默认表面标记时保留原生绘制。新回归读取当前组件的 AST／CSS，并实际执行共享底部组件生成三种分支，防止旧手写夹具继续遗漏新版绘制节点。

核对客户端：Windows Codex 26.930.3930.0，2026-10-04。依据安装包的活动 CSS/JS，来源哈希见 native-asar-provenance.json。本文件统一现役设计、材质配置和覆盖边界；历史方案从 Git 查询。

2026-10-06 补充核对 26.930.4958.0 的 FloatingSurface / QuickChat 绘制归属，当前来源记录已更新。其圆角类可用于透明定位框；仅带原生 bg-surface-elevated-secondary 或 bg-surface-canvas 材质的载体参与玻璃替换，快速聊天的外框保持透明。

2026-10-08 补充核对 26.1002.7124.0 的 Command / Dialog / Popover 共用组件，来源记录已更新。cmdk-dialog 定位壳保持透明；cmdk-root/data-cmdk-root 是搜索与选择列表的材质载体。无 bg 工具类的 Popover、确认和专用语音变体按原生组件边界补齐，嵌入托盘后代不重复绘制。

同日 v0.18.3 / v111-dots-header-owner 复核 Dots 浮动标题：原生装饰渐变使用另一种模块背景变体，旧类名子串选择器未覆盖。现按标题动态锚点与空惰性节点识别绘制层，详情见下方 Dots 标题合同。

## 分层

- runtime/native-ui-contract.mjs：集中语义选择器、可见性和容器归属。优先 data 属性；缺少语义属性的绘制叶节点保留限定范围的组件回退。
- runtime/injection-plan-v13.mjs：管理背景队列、快捷键、标记、跨页复用和还原；普通流式正文不触发整页扫描。
- 活动 CSS：替换现有表面的绘制，原生控制尺寸、圆角、滚动和交互。浮层首帧直接由语义 CSS 覆盖。
- themes/active.json：配置图片与可选 materials，不绑定组件类名。

## 全部替换范围

| 区域 | 原生依据 | 处理 |
| --- | --- | --- |
| 壁纸 | data-app-shell-page-surface 内 PageSurface 叶节点 | 继承边界和圆角，最多两层；叶节点无独立 data 属性，保留限定范围组件回退 |
| 主内容与页框 | main-surface、main-content-layout 属性 | 布局层透明，目录正文增加阅读衬底 |
| 图标轨道、应用顶栏 | sidebar rail、ApplicationMenuTopBar | 按实际图片裁切采样填色，不拼接固定宽高遮罩 |
| 宽侧栏 | default aside 的原生导航标记；data-slate-sidebar-content 的 popover 背景 token | 真实图片裁切取色，普通／peek 按状态单层绘制；外层沿用模糊；设置及 Activity 排除，浮动壳保留原生归属 |
| 导航文字 | ConversationSidebar / Navigation 范围 | 局部颜色变量随材质变化，不覆盖全局原生文字 |
| 对话、dots | conversation 属性、embedded messaging | 风景队列与深色阅读色；原生消息气泡和操作语义保留 |
| 输入框 | composer-surface-variant、composer-body | 使用原生绘制变量，首页 body 和对话 root 各自拥有表面 |
| 项目、分支信息条 | utility-bar-scroll-area、具体 navigation target | 按控件归属识别，不依赖固定行高或工具类顺序 |
| 目标、排队消息 | 带原生底色的 data-composer-rail-item；含透明状态条的浮动输入框实际背景子节点 | 材质载体停用背景采样，保留底色、高光、原生边框及分隔线；队列子项沿用原生绘制 |
| 文件变更等进度区 | data-in-progress-fixed-content 内的原生圆角进度表面 | 首次挂载即替换底色；无独立背景的紧凑 portal 保留继承绘制 |
| 摘要、环境、变更面板 | data-summary-panel-variant、summary item slot | 卡片及 sticky 标题共用不透明底，遮挡滚动文字 |
| dots 处理框与资料收起标题 | summary 范围内共享 sticky 标题的空惰性渐变叶、带实色底板的装饰分支 | 渐变局部取摘要材质色，实色底板同色；保留原生透明度、portal、遮挡和控件 |
| 顶底渐变与底板 | thread footer、scroll container、composer、main-content-layout 内共享 footer background 的空惰性叶；main-content-top-fade | 覆盖 fade、surface、combined，清除绘制，保留布局预留与交互 |
| dots 标题 | position-anchor 指向 orbit-messaging-header 动态锚点的空惰性节点 | 清除标题渐变，允许原生 portal 改变挂载位置；头像、通话与资料控件不参与替换；共享 composer 底部装饰渐变单独限定 |
| 设置 | data-settings-panel、settings-dialog；资料设置页的 data-settings-search-root 与 electron:bg-surface | 设置窗口整体及导航应用材质，正文壳透明；默认平铺行静止时透明，动作行及导入行使用较淡的原生整行悬停底色；显式盒装卡片使用玻璃，色卡与代码预览保留 |
| 公共资料页 | bg-surface 直接包含 data-profile-scroll，滚动标题包装含 data-app-shell-header-toolbar | 页面根透明，滚动标题独立应用玻璃材质，顶部与回顶部保持原生透明标题及遮挡顺序 |
| 浏览器智能体权限表 | group/settings 内 table 的 browser-use-site-permissions-column-* 无障碍 ID | 局部单元格材质变量；固定列和表头用实色遮挡移动内容，保留原生边角、横向翻页及下拉权限状态 |
| 目录、图像、插件、技能、计划页标题 | data-sticky、titlebar inset 变量、实际搜索输入 ID | 替换实际背景伪元素，不泛化处理任意 sticky 元素 |
| 菜单、对话框、下拉 | role 与实际绘制面、cmdk-root/data-cmdk-root、Popover slot 的实际原生底色及直接内容面、限定的 Popover/确认/语音组件、FloatingSurface / ComposerTopMenuPanel、mention-list-scroll-area | bg-transparent 与无底色定位壳不绘制；命令根与添加列表使用浓阅读底色；内层表面与嵌入托盘单层玻璃；tooltip 保留反色配对，原生尺寸和行状态保留 |
| 消息预览 | data-thread-user-message-navigation-tooltip-preview | 不再依赖 w-80 / max-width 类 |
| Markdown 代码 | code-block、data-code-block 与默认 CodeSurface | 代码和 sticky 工具栏共用不透明底，语法颜色及非默认变体保留 |
| 首页字标、题字 | home icon、landing title | 主题自有装饰，可快捷键关闭并还原，不重写对话正文 |

## Popover 绘制归属合同（2026-10-18，v0.18.6／v115）

原生编辑器的“设计控件”调用 Popover Content 时设置 `unstyled:true`。该组件仍输出 `data-slot="popover-content"`，用于定位、缩放与承载交互内容，但不提供默认底色和圆角；真正表面位于其内层 FloatingSurface。仅凭 slot 给外壳绘制玻璃，会在圆角外暴露矩形背景。

主题先检查 slot 自身的类 token：无状态前缀的原生 `bg-surface` 家族底色才表示该节点本身拥有材质，`bg-transparent` 明确退出。slot 自身没有该底色时，仅补齐直接块级内容面中实际具有原生表面底色的节点；保持外壳的原生透明、定位和缩放关系。菜单、列表、对话框等 role 的通用规则排除该 slot，避免它们绕过同一绘制归属边界。已有 FloatingSurface 的实际背景载体规则继续生效。

同次源码审查覆盖共享组件的 20 处无样式调用，补充两种独立材质入口：slot 直接子节点的 `data-avatar-overlay-material="css"` 仅局部设置 `--avatar-overlay-material-background` 为玻璃填充，保留原生 SVG 材质滤镜及边框；slot 自身的 `data-checkout-presentation="inline"` 使用玻璃材质，独立结账页不参与该规则。通用 role 规则同时排除 `bg-coachmark`，保留引导提示的原生反色文字与 SVG 箭头配对。

纯壳直接子表面的补齐限定为 `div`、`section`、`form`、`aside` 和 `nav`。不递归追改设计面板内部的 `h3 bg-text/5`、输入控件或 composer；其原生绘制层级继续有效。这些边界来自调用源码核对，不能扩大为 20 个业务入口的实机验收。

这种识别不依赖“设计控件”中文文案、原生宽高、圆角数值或模块 hash。需要区分完整 class token 与 `hover:`、`focus:` 等状态前缀，不能仅因类字符串包含 `bg-` 就把定位壳作为背景。当前修正的原生源码、共享 Popover 调用及自动回归范围见 [验证记录](VALIDATION.md)。本轮用户暂时无法重开业务面板；深浅预览来自真实原生渲染组件与 CSS 夹具，未完成该面板的实机视觉验收。

## Dots 标题合同

原生标题在当前安装包中将装饰背景、头像和通话控件分别挂载。背景与通话控件可能通过 portal 移入 `data-app-shell-main-content-layout`，所以绘制规则不依赖 `.messaging-root` 后代关系，也不使用模块类名、固定高度或 `top` 数值识别背景。

标题渐变的现役识别条件为：`position-anchor` 指向 `--orbit-messaging-header-` 动态锚点，同时具有 `pointer-events-none`、`aria-hidden="true"` 和 `:empty`。规则只清除该叶节点的 `background-image`，原生锚点定位、覆盖范围、滚动预留和堆叠关系继续生效。

`:empty` 是控件隔离条件：打开资料页时，头像容器也会使用同一锚点并切换到 `aria-hidden="true"`，但仍带有头像与交互子节点；通话控件同样有子节点。它们不能仅因共享锚点被当作背景处理。

`tests/native-asar-ui-contract.test.mjs` 读取实际安装包中的标题组件，解析动态锚点、装饰叶、交互兄弟和 portal，并关联真实 CSS 的渐变声明。几何和材质回归使用该原生结构，同时覆盖深浅模式、滚动位置及资料开关状态。接口漂移时先重新核对原生代码，不把旧夹具的通过结果当作当前组件已经覆盖。

## Dots 处理框标题合同（2026-10-18）

处理框使用 `data-summary-panel-variant` 的真实摘要容器。任务标题、普通线程预览标题和资料身份收起标题消费同一个共享 sticky 标题组件：默认分支绘制从面板色到透明的顶部渐变，solid 分支额外绘制实色底板及其下沿渐变。任务标题的透明度由原生滚动状态驱动；普通线程标题默认完全显示。标题可能通过 portal 挂在摘要面板的顶部容器中，不一定是消息滚动区域的后代。

材质映射限定在摘要范围内的空装饰渐变叶：`pointer-events-none`、`aria-hidden="true"`、`:empty`，并具有原生从 surface-elevated-secondary 到透明的渐变绘制。仅在该叶节点设置局部颜色变量，使渐变起点与 `--forge-summary-fill` 一致；不清除背景图或改写 opacity。solid 底板限定在无障碍隐藏的装饰分支及其共享标题结构，直接设置背景色，不向整个标题及其交互后代传递材质变量。返回按钮、资料控件和“打开聊天”按钮保留原生控件表面。

`tests/native-summary-fade.test.mjs` 从当前安装包中提取并执行真实共享组件，关联原生 CSS 与三个消费者，覆盖默认、动态透明度、solid 和 portal 分支。检查关注渐变、遮挡和绘制边界，不将高度、挂载位置或模块 hash 固定为当前值。2026-10-18 的深浅实机检查核对了任务面板、渐变和返回按钮的布局与绘制；当前内容无可滚动范围，长内容滚动和资料收起状态由组件夹具覆盖，不能视作实机验收。

## 材质配置

已有 schemaVersion 3 主题继续兼容。可在主题 JSON 中追加：

```json
"materials": {
  "dark": {
    "glassFill": "#404c58b8",
    "glassBlur": 12,
    "navigationFill": "#14181ca3",
    "readingLink": "#a8dcff",
    "readingTint": "#081018",
    "readingMinOpacity": 0.68
  },
  "light": { "glassFill": "#f7f9fb99", "glassBlur": 10 }
}
```

颜色接受 #RRGGBB / #RRGGBBAA。可配置 glassFill、glassEdge、shellFill、navigationFill/Ink/Muted/Hover、catalogFill、readingSecondary/Tertiary/Link/Tint。glassBlur、shellBlur、navigationBlur 范围 0–32，glassSaturation 范围 0–2，readingMinOpacity 范围 0–1。缺省字段使用当前主题默认材质。

阅读参数当前作用于深色对话；浅色继续使用各场景白色薄遮罩。自定义颜色后应重新核验可读性，默认配色结论不自动覆盖自定义参数。旧 uiAssets 七张纸张/侧栏纹理不再解码，旧导出中的键可继续加载；现役装饰为深浅两枚悟空字标。

## 更新耐受性和验证

可见性允许原生 portal 子节点恢复 visibility，同时排除隐藏、inert 和透明保留页。PageSurface 重挂载复用已解码图片，设置往返不主动重建壁纸。区域缓存、有界导航探针及流式更新过滤继续生效。

host 对主模块和适配依赖共同计算指纹，并用于 renderer 新鲜度判定，映射单独更新也能加载。回归检查接口和实际行为，不把原生工具栏、侧栏尺寸锁成旧数值；漂移夹具改变尺寸、工具类、层级和页面可见状态，验证替换归属。夹具需要与安装包中的实际组件合同关联；存在 portal、资料开关或浮动变体的组件，还需检查这些变体的绘制归属。

减少动态、减少透明度、强制色彩与还原功能保留。原生语义标记也可能变更，未来彻底重写组件时仍需维护映射。系统菜单和其他进程窗口不属于 renderer CSS。源码核对、夹具和实机范围分别记录于 VALIDATION.md。

## 内嵌浏览器 portal 合同（2026-10-17）

浏览器专项来源为安装客户端 26.1013.4894.0（包内 26.1013.40934），记录在 native-browser-provenance.json；其他区域仍保留各自已审计来源，不代表本次完成全 UI 重新审计。

原生 [data-embedded-frame-host-root] 直接挂到 body，[data-browser-host-root] 位于其内并使用 contain:paint，[data-browser-sidebar-webview] 包含实际 webview。可见容器由原生设置固定矩形和 visibility:visible，z-index 为空（auto）；与 #root 是兄弟关系。v112-browser-portal-stacking 只取消主题 #root 的正 z-index，保留 position:relative。body 壁纸回退始终 prepend 在 root 之前，继续位于内容后方。

不为浏览器 portal 添加高 z-index，不修改网页 CSS、浏览器坐标或指针行为。tests/native-browser-contract.test.mjs 关联当前原生源码；tests/browser-portal.test.mjs 使用同样的语义拓扑检查绘制像素、交互、模态层级和回退，并以旧规则复现缺陷。夹具不能替代真实 Electron guest 的屏幕验证。
