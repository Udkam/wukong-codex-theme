# v0.18.10 侧栏选中态与标签页适配

适配 Windows Codex 26.1103.4239.0，主题运行时为 v123。

- **侧栏更容易分辨当前聊天。** 当前聊天用半透明冷色底和 1 像素内描边，多选但未打开的聊天使用更淡的底色，项目标题使用轻微的悬停反馈。保留原生行尺寸、键盘焦点和拖放反馈。
- **新聊天从首帧使用主题外观。** 图标、题字和项目条在相应节点挂载时直接应用主题样式，减少先看到原生界面再切换的闪现。
- **右侧标签页恢复原生背景。** 分栏时，标签条和最右侧按钮区使用统一的原生底色。进入完整视图时暂时隐藏主题壁纸并停用主题材料，退出后恢复原主题和所选图片。
- **减少区域刷新时的重复写入。** 主题仅更新有变化的标记、类和展示状态。标签页开合沿用客户端动画。

深浅色侧栏、新聊天和标签页的示例来自原生组件测试夹具。 [预览](previews/README.md) · [验证记录](VALIDATION.md)

解压 Windows 运行包后，完全退出桌面客户端，再双击 `start.cmd`。 [使用说明](QUICK_START.txt)

[GitHub 正式发行](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.10) · [Windows ZIP](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.10/Wukong-Codex-Theme-0.18.10-Windows.zip) · [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.10/SHA256SUMS.txt)

独立发行源码 195/195 项检查及 Studio E2E 通过；37 个包内文件的源码、ZIP 与解压内容一致。两个上传资产已重新下载，SHA-256 与本地文件和 GitHub digest 一致。ZIP SHA-256 为 `2e7cebd3f7cb54b426b4c78ba528b0ebd9afeaf6f0f25d9ad3f4ce8eb9585bc8`。
