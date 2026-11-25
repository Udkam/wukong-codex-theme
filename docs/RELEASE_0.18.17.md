# v0.18.17 输入区正文轮廓避让与新版客户端适配

已于 2026-11-25 发布为 GitHub Latest 正式版。源码与 v0.18.17 标签已推送，两个发行资产回下载校验通过。

适配 Windows Codex **26.1120.5083.0**（包内 **26.1120.41243**），主题运行时为 **v135-transcript-occlusion**。

聊天正文在普通输入框、Goal 和排队消息的实际绘制范围内隐藏，使半透明输入区只透出壁纸。遮挡沿原生圆角和外层容器裁切，保留输入区两侧及圆角外的正文。字体、首页字标、壁纸、材质和控件尺寸沿用现有设置。

普通输入框、Goal 与排队消息的贴合效果均已获得用户实机确认。滚动同步使用缓存偏移；动态高度、重挂载、compact 布局以及主题恢复后的清理纳入回归。回归同时适配新版客户端的编译缓存与现行原生设置入口。

213 文件独立发行源码的完整检查 **226/226** 与 Studio 端到端通过。38 文件运行包通过源码、ZIP CRC、解压哈希与独立白名单审计；同包恢复原生、重新应用与前台样式哈希读回通过。冷启动和卸载本轮未执行。完整发行与远程资产核验结果记录于 [验证记录](VALIDATION.md)。[组件预览](previews/README.md) 由当前原生结构、真实 CSS、公开壁纸与示例内容生成，不是实机聊天截图。

解压 Windows 运行包后，完全退出桌面客户端，再双击 `start.cmd`。[使用说明](QUICK_START.txt)

[GitHub 发行页](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.17) · [Windows ZIP](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.17/Wukong-Codex-Theme-0.18.17-Windows.zip) · [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.17/SHA256SUMS.txt)
