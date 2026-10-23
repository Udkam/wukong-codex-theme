# 原生 UI 与主题替换接口

## 浏览器浮动输入框的 goal 背景归属（2026-10-24，v0.18.8／v117）

核对 Windows Codex 26.1016.8622.0。浮动输入框经 body portal 挂载在 #root 外；带 data-quick-chat-drag-handle 的 section 是透明定位／拖动外壳，保留 overflow-visible。它的直接 FloatingSurface 背景子节点负责整个组件的 22px 圆角、底色和滤镜；data-floating-chat-surface 内使用 compact／inline composer。不得通过给外壳加裁切或给 goal 行硬加圆角来修复材料归属。

原生 rail Item 的背景选择为 `(variant !== "default" || !embedded && !expandedTopTray) && backgroundMap[variant]`。默认 embedded／expandedTopTray 行没有背景类，controls 和 inline 也透明；独立 default 使用 bg-surface-elevated-secondary，warning 使用原生 color-mix 背景类。data-composer-rail-contained 只表示存在 rail 上下文，本身不能证明有底色。

共享条目材料现要求未加状态或伪元素前缀的 bg-* token，排除 bg-transparent；与运行时标记的 panel／progress 入口使用同一判定。原生透明 goal 行不会重复绘制方形玻璃，独立 default／warning 条仍保留材料替换。宽高、圆角、边距、溢出和控件行为均不改写。

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
| 宽侧栏 | aside 的 appearance 属性、外层 sidebar-navigation | 单层磨砂，内层导航不重复叠色；浮动侧栏按原生 testid |
| 导航文字 | ConversationSidebar / Navigation 范围 | 局部颜色变量随材质变化，不覆盖全局原生文字 |
| 对话、dots | conversation 属性、embedded messaging | 风景队列与深色阅读色；原生消息气泡和操作语义保留 |
| 输入框 | composer-surface-variant、composer-body | 使用原生绘制变量，首页 body 和对话 root 各自拥有表面 |
| 项目、分支信息条 | utility-bar-scroll-area、具体 navigation target | 按控件归属识别，不依赖固定行高或工具类顺序 |
| 目标、排队消息 | data-composer-rail / rail-item | 外层玻璃，排队叶节点不额外模糊；列表回退限定在 rail 内 |
| 进度区 | data-in-progress-fixed-content 内绘制叶 | 不再依赖 h-8、字号或进度文案 |
| 摘要、环境、变更面板 | data-summary-panel-variant、summary item slot | 卡片及 sticky 标题共用不透明底，遮挡滚动文字 |
| dots 处理框与资料收起标题 | summary 范围内共享 sticky 标题的空惰性渐变叶、带实色底板的装饰分支 | 渐变局部取摘要材质色，实色底板同色；保留原生透明度、portal、遮挡和控件 |
| 顶底渐变与底板 | thread footer、scroll container、composer、main-content-layout 内共享 footer background 的空惰性叶；main-content-top-fade | 覆盖 fade、surface、combined，清除绘制，保留布局预留与交互 |
| dots 标题 | position-anchor 指向 orbit-messaging-header 动态锚点的空惰性节点 | 清除标题渐变，允许原生 portal 改变挂载位置；头像、通话与资料控件不参与替换；共享 composer 底部装饰渐变单独限定 |
| 设置 | group/settings、settings mobile header | 设置壳透明，真实卡片玻璃，色卡与代码预览保留 |
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
