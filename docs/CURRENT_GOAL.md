# 当前目标与发行状态

更新于 2026-11-22。**[v0.18.13](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.13) 已发布为 GitHub 最新正式版**。发行运行时为 v127-composer-status-first-paint，适配 Windows Codex 26.1111.2228.0（包内 26.1111.21308）。

正式版的文件变更徽标、排队消息和目标条从首次挂载起应用主题材质，详见 [发行说明](RELEASE_0.18.13.md)。

当前开发运行时为 **v129-native-workspace-surface**，适配 Windows Codex 26.1117.4957.0（包内 26.1117.41037）。本轮处理新版工作区背景底板与残留渐变、设置窗口材质及独立账户资料页背景，以及右侧浏览器标题区域的绘制归属，并保留此前 v128 的插件推荐适配。

首页沿用原来的字标资源、文案、168px 尺寸与宿主透明度，清除新版原生外框叠加的灰色渐变，首页不加额外遮罩。开发版效果使用当前源码与原生 CSS 生成深浅色组件夹具，来源见 [预览说明](previews/README.md)。独立源码 210 项回归及 Studio E2E 已通过，查找条 AST 定位增强另经独立 2 项复测。已注入本机；最终读回为后台等待壁纸解码，间歇性移动／缩放遮盖尚未复现，详见 [验证记录](VALIDATION.md)。

本轮处于开发状态，尚无本轮发布授权；正式下载和发行版本仍为 v0.18.13。改动范围见 [下一版说明](RELEASE_NEXT.md)。

此前标签页开合卡顿在恢复原生外观时也有复现。标签页开合沿用客户端动画。

[Windows 运行包](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.13/Wukong-Codex-Theme-0.18.13-Windows.zip) 和 [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.13/SHA256SUMS.txt) 的正式发行校验、恢复原生和重新应用结果见 [验证记录](VALIDATION.md)，过程材料状态见 [清理记录](CLEANUP.md)。

上一版的普通对话底部背景修复见 [v0.18.12 发行说明](RELEASE_0.18.12.md)。
