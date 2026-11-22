# v0.18.14 侧栏取色与新版界面适配

适配 Windows Codex 26.1117.4957.0，主题运行时为 v132。

- **侧栏跟随壁纸取色。** 深色侧栏更通透，浅色侧栏轻微染色，明亮场景自动增加阅读衬底。展开的临时侧栏使用同一套材质。
- **设置行使用更淡的整行反馈。** 「自定义规则」和导入历史沿用原生悬停方式，深浅主题各自使用蓝灰底色，键盘焦点保留原生轮廓。
- **公共资料页显示主题壁纸。** 资料主体和滚动后的标题底板应用各自的材质，顶部、滚动与回顶部的布局沿用客户端。
- **修正输入框上的移动遮盖。** 普通对话输入框采用无背景模糊的半透明材质，保留高光、圆角、阴影和执行文字动画。
- **适配新版工作区与浏览器。** 清理工作区和查看器残留的实色与渐变，补齐设置窗口、右侧标签区域和聊天查找条的材质。
- **内置插件推荐使用主题配色。** 卡片、图标底板和安装按钮随深浅主题更新，嵌入页重新加载后继续应用主题。

深浅色图片使用当前原生结构、CSS 与示例内容生成，属于组件夹具。具体检查与实机确认范围见验证记录。[组件预览](previews/README.md) · [验证记录](VALIDATION.md)

独立源码 217 项检查与 Studio 端到端测试全部通过。运行包 38 个文件与源码、ZIP 和解压内容逐项一致；已使用解压包完成恢复原生及重新应用，本机前台读回运行时和完整主题样式一致。

解压 Windows 运行包后，完全退出桌面客户端，再双击 `start.cmd`。[使用说明](QUICK_START.txt)

[GitHub 发行页](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.14) · [Windows ZIP](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.14/Wukong-Codex-Theme-0.18.14-Windows.zip) · [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.14/SHA256SUMS.txt)
