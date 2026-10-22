# 当前预览

## v0.18.7／v116 额度接缝轮廓夹具（2026-10-21 生成）

dark-quota-seam-fixture.png / light-quota-seam-fixture.png：Windows Codex 26.1016.6573.0 的真实 Recovery、按钮、ComposerLayout 与宿主纯渲染组件，在独立浏览器中使用原生 CSS 生成。CSS 按当前入口的层预声明和 shared、initial、primary 顺序加载；先核对原生 padding、边框、按钮与圆角有效，再比较轮廓。

画面标注“原生组件夹具，非额度实机”，文字含示例日期，按钮不连接业务操作。图片展示独立提示卡跟随默认多行输入框的圆角；保留原生底色与间距。**没有复现截图中的额外深色底板，也不是额度耗尽界面的实机截图**。用户额度已经重置，原始状态无法再打开；不能将该夹具当作原问题根因或用户视觉验收的证据。用户于 2026-10-23 明确授权发布 v0.18.7，该授权不改变图片来源和验证边界，发行结果见 ../CURRENT_GOAL.md。

## v0.18.6 设计控件原生组件夹具（2026-10-18）

dark-design-controls-fixture.png / light-design-controls-fixture.png：Windows Codex 26.1013.4894.0，运行时 v115-popover-paint-owner。两张图片均为 136×116 px，由当前安装包的真实原生渲染组件与 CSS 生成，仅截取右上圆角与外壳交界的局部，包含一小段外部背景，展示无样式 Popover 定位／缩放壳和内层有圆角、有底色的实际内容面。该拓扑是本轮检查和修复的输入，画面属于自动夹具，**不是实际打开“设计控件”业务面板的实机截图，也未复刻业务控件布局**。

用户验收后已发布 v0.18.6，并回读为 GitHub Latest；该状态不改变本组图片的夹具来源。预览用于说明背景只填充实际表面，透明外壳不再重复绘制；技术检查、同包注入、远程校验及未执行范围见 ../VALIDATION.md。

该组图片只展示设计控件的绘制归属，不代表头像反应选择器、内联结账或引导提示的实机验收。其原生调用及材质边界另见 ../native-surface-adaptation.md。

## v0.18.5 Dots 处理框标题预览（2026-10-18）

dark-dots-task-header.png / light-dots-task-header.png：Windows Codex 26.1013.4894.0，运行时 v114-summary-header-material。实际打开 Dots 的任务处理面板，通过原生外观设置切换深浅模式后截图。任务标题临时替换为“示例任务”，消息滚动区及其后代仅隐藏绘制；原生面板、顶部渐变、返回和打开聊天按钮均保持实际状态，截图后恢复标题及正文绘制。预览未重绘或合成。

实机抽查面板、渐变叶和返回按钮的矩形、内边距、圆角、定位、字体、行高、边框、透明度与变换，均与原生一致。当前实际任务内容没有可滚动范围，图片不代表已完成长内容滚动的实机检查；滚动遮挡和其他标题变体由实际原生组件夹具覆盖。完整边界见 ../VALIDATION.md。

## v0.18.4 底部修复预览（2026-10-17）

dark-thread-footer-current.png / light-thread-footer-current.png 与 dark-dots-footer-current.png / light-dots-footer-current.png：Windows Codex 26.1013.4894.0，运行时 v113-native-footer-paint。实机分别打开普通对话和 Dots，切换原生深浅模式后截取消息滚动区同宽的底部 180 CSS px。仅临时隐藏消息、草稿和附件内容的绘制以保护隐私，保留背景装饰、输入框、控件的原生可见状态和布局；截图后恢复，结束时恢复深色及当前任务。不是合成或夹具截图。

## 本轮合并的浏览器专项预览（修正阶段 v112）

2026-10-17，安装客户端 26.1013.4894.0（包内 26.1013.40934）。browser-portal-before.png / browser-portal-after.png 来自同一实际窗口中的公开 foreseer.site 网页及其原生工具栏，通过 CDP 按网页矩形向上包含工具栏截取；无聊天正文、侧栏或本机路径。before 临时恢复旧 #root z-index:1 规则，after 使用 auto；两次网页矩形完全一致。截图后删除临时诊断样式，永久修复由活动源码提供。此处只有深色实机截图；深浅色和两种宽度的结果来自自动绘制夹具，不作为浅色实机验收。

## v0.18.3 Dots 标题预览

2026-10-08，Windows Codex 26.1002.7124.0，运行时 v111-dots-header-owner。

dark-dots-header.png / light-dots-header.png：实际打开 Dots 页面，关闭资料面板后，按原生消息容器的顶部边界截取标题区域。为避免私人正文和附件进入预览，截图时临时隐藏消息滚动区及后代的绘制，不改变其布局；截图后立即恢复。头像、通话按钮、壁纸与标题材质均来自真实界面，未重绘或合成。两模式通过原生外观设置切换，结束后恢复深色。

## v0.18.2 搜索窗口预览

2026-10-08，Windows Codex 26.1002.7124.0，运行时 v110-command-surface-owner。

dark-search-menu.png / light-search-menu.png：实际打开侧栏搜索，按原生 cmdk-root 边界截取。为保护隐私，截图前临时替换列表中的聊天与项目名称为示例文字，截图后立即恢复；未重绘背景、材质或控件。两种模式均通过原生外观设置切换，检查后恢复深色及原聊天。


## 浮动输入框修正预览

2026-10-06，Windows Codex 26.930.4958.0，运行时 v109-floating-paint-owner，随 v0.18.1 发行。

dark-floating-composer.png / light-floating-composer.png：实际打开客户端空白浏览器标签页、进入完整视图，截取右下角收起状态的快速聊天输入框及周围 12px；不含聊天正文、标题及侧栏名称。两种模式通过原生外观设置切换，检查后关闭临时标签页并恢复原模式及原对话。

## v0.18.0 发行预览

2026-10-04，Windows Codex 26.930.3930.0，运行时 v108-native-surface-adapter。

- dark-reading-footer.png / light-reading-footer.png：当前客户端的 dots composer-wrap，按原生边界截取底部 65px 内的输入控件与壁纸，不含聊天正文和附件内容。
- dark-add-menu.png / light-add-menu.png：当前客户端实际打开“添加文件等内容”后，按 data-mention-list-scroll-area 截取滚动区。展示添加与插件标题、选中项和说明文字。
- dark-shell.png / light-shell.png：当前客户端的空白新聊天页。为保护隐私，截图前临时把侧栏项目及聊天名称替换为“示例 N”，隐藏个人头像，截图后立即恢复；未替换页面布局、背景或材质。

两种模式均通过原生外观设置切换，结束后恢复原深色模式与原对话。截图未重绘或合成；截图中的插件品牌属于原生菜单内容。预览不代表全部页面完成用户验收。

旧 UI 预览已退出当前分支，可从 Git 历史或已发布版本查看。当前验证范围见 ../VALIDATION.md。
