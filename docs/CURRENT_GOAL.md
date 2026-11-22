# 当前目标与发行状态

更新于 2026-11-23。**[v0.18.13](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.13) 已发布为 GitHub 最新正式版**。发行运行时为 v127-composer-status-first-paint，适配 Windows Codex 26.1111.2228.0（包内 26.1111.21308）。

正式版的文件变更徽标、排队消息和目标条从首次挂载起应用主题材质，详见 [发行说明](RELEASE_0.18.13.md)。

当前开发运行时为 **v130-public-profile-surface**，适配 Windows Codex 26.1117.4957.0（包内 26.1117.41037）。补齐用户实际打开的公共资料页独立底色及滚动标题栏，资料设置页保留自己的适配。此前 v129 的工作区、设置、浏览器和查找条修复继续保留。

用户已确认资料页主体显示壁纸，并确认保留执行文字发光、仅关闭输入框背景模糊时，移动遮盖消失。正式规则仅停用普通对话输入框的背景模糊，保留底色、高光、阴影和原生执行动画；首页和其他玻璃浮层不变，首页字标保持原样。最终回归及实机范围见 [验证记录](VALIDATION.md)。

设置中的「自定义规则」与导入历史改为底部晕染：悬停时从行底部向上、向左右柔和淡出，按用户反馈提高强度；不增加整行实色、描边、阴影或圆角。末端箭头使用淡金强调，鼠标移开恢复透明，展开本身不持续高亮。已热更新本机，最终观感待用户确认。

本轮处于开发状态，尚无本轮发布授权；正式下载和发行版本仍为 v0.18.13。改动范围见 [下一版说明](RELEASE_NEXT.md)。

此前标签页开合卡顿在恢复原生外观时也有复现。标签页开合沿用客户端动画。

[Windows 运行包](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.13/Wukong-Codex-Theme-0.18.13-Windows.zip) 和 [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.13/SHA256SUMS.txt) 的正式发行校验、恢复原生和重新应用结果见 [验证记录](VALIDATION.md)，过程材料状态见 [清理记录](CLEANUP.md)。

上一版的普通对话底部背景修复见 [v0.18.12 发行说明](RELEASE_0.18.12.md)。
