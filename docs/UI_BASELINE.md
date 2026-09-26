# 新版原生 UI 基准

核对客户端：Windows Codex 26.924.2738.0（2026-09-27）。来源为已安装 ChatGPT.exe 的 app/resources/app.asar，文件大小与 SHA-256 记录在 native-asar-provenance.json。官方文件仅只读检查。

## 结构与绘制归属

- PageSurface 是壁纸唯一首选宿主：原生 inset 控制顶部留白、导航轨道与底部边界，主题绝对填满并继承圆角。
- app-shell-left-panel 包含图标轨道和宽侧栏。外层不叠底；group/sidebar-rail 和最外层 sidebar-navigation 分别填充材质。
- sidebar-navigation 内嵌同名节点保持原生，避免重复磨砂。设置、Customize 和对话侧栏共用此边界。
- SearchablePageLayout 的 _shell_* > _content_* 标识目录页面。data-sticky 壳的 ::before 拥有标题底色、滚动偏移与上方圆角。
- ComposerLayout：对话 ROOT 与首页 BODY 分别拥有表面；主题使用原生材质变量，不同时给两层加底。
- tooltip 的原生反色前景与背景成对保留；角色属性本身不代表可绘制面板。

## 不变量

位置、尺寸、响应式公式、圆角、裁切、间距、字体和命中区域沿用原生；不得以截图估算固定宽高。CSS Modules 使用组件名片段，不锁定构建哈希。选择器变化仍需重新审计。

tests/runtime-fixture.mjs 仅用于状态机行为，不是原生几何基准。new-ui-surfaces 与 native-paint-boundary 测试读取当前原生 CSS；scripts/audit-native-geometry.mjs 核对真实页面。夹具和实机证据分别记录。

旧基准已退出现行文档，恢复方式见 DEVELOPMENT.md。
