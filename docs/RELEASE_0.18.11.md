# v0.18.11 侧栏、语音专注模式与壁纸切换

适配 Windows Codex 26.1106.6628.0，主题运行时为 v125。

- **侧栏反馈。** 恢复项目行和聊天行的浅色悬停底，菜单展开时继续显示。「新聊天」等普通入口恢复主题悬停底色，当前聊天保留细内描边。活动侧栏使用原生材质，聊天侧栏使用主题磨砂。
- **语音专注模式。** 壁纸就绪后，底部外层变为透明，控件沿用原生布局。
- **壁纸切换。** 启用「减少动态效果」时，新壁纸解码完成后直接显示，连续切换无需等待渐变。

深浅色侧栏与语音底部预览来自当前客户端结构和 CSS 的组件测试夹具。 [预览](previews/README.md) · [验证记录](VALIDATION.md)

解压 Windows 运行包后，完全退出桌面客户端，再双击 `start.cmd`。 [使用说明](QUICK_START.txt)

[GitHub 正式发行](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.11) · [Windows ZIP](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.11/Wukong-Codex-Theme-0.18.11-Windows.zip) · [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.11/SHA256SUMS.txt)

独立发行源码 197 项检查及 Studio 端到端测试均通过。37 个包内文件与源码及解压内容逐项核对一致。解压包在本机前台验证了恢复原生和重新应用，其他界面状态由组件回归覆盖。

两个发行资产均已重新下载，SHA-256 与本地文件和 GitHub digest 一致。Windows ZIP 的 SHA-256 为 `f252035a8bc8c05fbc2b765ab795e66192e8f21f71453de64888a746b2219ca6`。
