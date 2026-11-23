# v0.18.15 项目条背景采样调整

适配 Windows Codex 26.1117.4957.0，主题运行时为 v133。

针对项目条内部间歇出现横线的反馈，本版停用项目条实际材质表面的背景模糊，保留底色、顶部高光、阴影、原生布局和控件。首页输入主体、目标条及排队消息沿用各自的滤镜。

用户验证后认为内部横线已不再出现，原触发条件仍不明确。组件回归使用当前原生 Slot、项目条和首页输入主体结构检查材质与几何范围。深浅色预览由原生组件、CSS 和示例内容生成，夹具未复现间歇横线。[组件预览](previews/README.md) · [验证记录](VALIDATION.md)

发行输入的 218 项检查与 Studio 端到端测试全部通过。38 个运行文件与验证源码、ZIP 和解压内容一致；使用解压包恢复原生和重新应用通过，本机前台读回运行时与完整主题样式一致。

解压 Windows 运行包后，完全退出桌面客户端，再双击 `start.cmd`。[使用说明](QUICK_START.txt)

[GitHub 发行页](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.15) · [Windows ZIP](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.15/Wukong-Codex-Theme-0.18.15-Windows.zip) · [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.15/SHA256SUMS.txt)
