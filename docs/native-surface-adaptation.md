# 原生 UI 与主题替换接口

核对客户端：Windows Codex 26.930.3930.0，2026-10-04。依据安装包的活动 CSS/JS，来源哈希见 native-asar-provenance.json。本文件统一现役设计、材质配置和覆盖边界；历史方案从 Git 查询。

2026-10-06 补充核对 26.930.4958.0 的 FloatingSurface / QuickChat 绘制归属，当前来源记录已更新。其圆角类可用于透明定位框；仅带原生 bg-surface-elevated-secondary 或 bg-surface-canvas 材质的载体参与玻璃替换，快速聊天的外框保持透明。

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
| 顶底渐变 | thread footer、scroll container、main-content-top-fade | 仅清除装饰节点绘制，保留布局预留 |
| dots 标题 | orbit header 锚点装饰叶 | 清除标题渐变及共享 composer 内的底部装饰渐变，保留锚点定位 |
| 设置 | group/settings、settings mobile header | 设置壳透明，真实卡片玻璃，色卡与代码预览保留 |
| 浏览器智能体权限表 | group/settings 内 table 的 browser-use-site-permissions-column-* 无障碍 ID | 局部单元格材质变量；固定列和表头用实色遮挡移动内容，保留原生边角、横向翻页及下拉权限状态 |
| 目录、图像、插件、技能、计划页标题 | data-sticky、titlebar inset 变量、实际搜索输入 ID | 替换实际背景伪元素，不泛化处理任意 sticky 元素 |
| 菜单、对话框、下拉 | role 与实际绘制面、FloatingSurface / ComposerTopMenuPanel、mention-list-scroll-area | 绘制面用玻璃，位置包装器透明；tooltip 保留反色配对；添加列表局部文字变量、行透明度与 sticky 分组底色配套 |
| 消息预览 | data-thread-user-message-navigation-tooltip-preview | 不再依赖 w-80 / max-width 类 |
| Markdown 代码 | code-block 与原生绘制 token | 代码和 sticky 工具栏共用不透明底，语法颜色保留 |
| 首页字标、题字 | home icon、landing title | 主题自有装饰，可快捷键关闭并还原，不重写对话正文 |

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

host 对主模块和适配依赖共同计算指纹，并用于 renderer 新鲜度判定，映射单独更新也能加载。回归检查接口和实际行为，不把原生工具栏、侧栏尺寸锁成旧数值；漂移夹具改变尺寸、工具类、层级和页面可见状态，验证替换归属。

减少动态、减少透明度、强制色彩与还原功能保留。原生语义标记也可能变更，未来彻底重写组件时仍需维护映射。系统菜单和其他进程窗口不属于 renderer CSS。源码核对、夹具和实机范围分别记录于 VALIDATION.md。
