# 当前目标与发行状态

更新于 2026-11-23。**[v0.18.13](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.13) 已发布为 GitHub 最新正式版**。发行运行时为 v127-composer-status-first-paint，适配 Windows Codex 26.1111.2228.0（包内 26.1111.21308）。

正式版的文件变更徽标、排队消息和目标条从首次挂载起应用主题材质，详见 [发行说明](RELEASE_0.18.13.md)。

当前开发运行时为 **v131-sidebar-scene-palette**，适配 Windows Codex 26.1117.4957.0（包内 26.1117.41037）。侧栏复用现有壁纸裁切采样直接取色，采用更通透的分层阅读底色；用户已确认这版合适。此前 v130 的资料页／输入框修复及 v129 的工作区、设置、浏览器和查找条修复继续保留。

用户已确认资料页主体显示壁纸，并确认保留执行文字发光、仅关闭输入框背景模糊时，移动遮盖消失。正式规则仅停用普通对话输入框的背景模糊，保留底色、高光、阴影和原生执行动画；首页和其他玻璃浮层不变，首页字标保持原样。最终回归及实机范围见 [验证记录](VALIDATION.md)。

侧栏颜色随实际图片、裁切及窗口尺寸变化更新，浅色模式保留浅底并轻微染色；亮背景自动提高阅读衬底。沿用同一份 24×64 采样及缓存，不增加图片层、模糊层或逐行扫描。Activity、设置和目录材质保持独立，完整回归与实机结果见 [验证记录](VALIDATION.md)。

设置底部柔光仍为已提交的 v130 基线；后续外溢柔光候选仅提供交互预览，没有合入本次侧栏改动。

本轮处于开发状态，尚无本轮发布授权；正式下载和发行版本仍为 v0.18.13。改动范围见 [下一版说明](RELEASE_NEXT.md)。

此前标签页开合卡顿在恢复原生外观时也有复现。标签页开合沿用客户端动画。

[Windows 运行包](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.13/Wukong-Codex-Theme-0.18.13-Windows.zip) 和 [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.13/SHA256SUMS.txt) 的正式发行校验、恢复原生和重新应用结果见 [验证记录](VALIDATION.md)，过程材料状态见 [清理记录](CLEANUP.md)。

上一版的普通对话底部背景修复见 [v0.18.12 发行说明](RELEASE_0.18.12.md)。
