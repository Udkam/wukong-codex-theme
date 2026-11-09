# 当前目标与发行状态

更新：2026-11-09。当前开发适配为 **v123-sidebar-current-outline**：当前聊天用冷色底与一圈细内描边，多选但未打开的聊天用更淡的冷色底，项目标题保留轻悬停。新聊天继续沿用 v122 的图标、题字和项目条首帧规则。

当前来源为 Windows Codex 26.1103.4239.0（包内 26.1103.32239）。侧栏沿用原生行尺寸、圆角、键盘焦点与拖放反馈。深浅预览及来源见 [预览说明](previews/README.md)，具体范围见 [当前适配说明](RELEASE_NEXT.md)。

此前 v121 计数优化后，用户仍反馈标签页开合卡顿；临时完整恢复原生后也同样卡顿，主题随后已恢复。客户端减少动态效果尚未开启：用户在设置操作中按 Esc 停止。该项不记为已解决。

本轮为开发源码更新，正式下载继续指向 v0.18.9。独立源码检查与本机读回见 [验证记录](VALIDATION.md)。

以下为上一正式发行的记录，开发版验证及实际注入状态另见 [验证记录](VALIDATION.md)。

更新：2026-11-05。**v0.18.9 已发布为 [GitHub Latest](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.9)**，运行时 **v118-native-module-families**，原生来源 Windows Codex 26.1029.7803.0。已复现并修正普通对话和 Dots 的底部黑色横带，补齐工作区预览 body portal 的同类背景；范围见 [发行说明](RELEASE_0.18.9.md)。

同一轮迁移覆盖 PageSurface 壁纸定位、代码卡／工具栏、浮层、确认／语音、侧栏和额度提示的失效模块入口，保留原生几何、材料归属和隔离。原生合同改从当前数字资源块及真实 require／export 关系读取；压力夹具与真实组件分开记录。

普通／Dots 的深浅真实状态均已做旧规则负控制，采样控件几何差异为 0。深色两类确认前台可见；浅色为实际原生设置切换后的后台渲染器检查。已恢复原深色及本聊天，精确独立开发源码 181 项检查与 Studio E2E 通过，详细边界见 [验证记录](VALIDATION.md)。

## 正式发行

精确发行源码 181 项检查和 Studio E2E 已通过，37 文件 Windows ZIP 为 4,053,853 字节，解压逐文件哈希一致。同包恢复原生 verified=true，重新应用为后台延期状态 deferred=true／verified=false，活动 v118 和完整包内样式已回读。此状态不作为前台应用通过，未执行冷启动／卸载。

[Windows 运行包](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.9/Wukong-Codex-Theme-0.18.9-Windows.zip) 与 [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.9/SHA256SUMS.txt) 均已上传并重新下载；两个文件的本地、回下载及 GitHub digest 一致。ZIP SHA-256 为 e5dc5db0559e4987517160a22372f50ee5cb3d1393b18c7282678023959561d1。标签指向运行时提交 e4e90a136f9d4cd4d9141733e8bd134eba9ccb60，随后仅补写发行及清理文档。

README 保持简约两图展示，当前四张普通／Dots 局部实机预览见 [来源说明](previews/README.md)。既有透明 goal、Popover 与摘要材料边界保护保留；先前未复现的额度底板问题仍维持原验证边界。

本轮发行的 15 个临时目录、339 个文件已清理并独立核验不存在；正式包与最小验证证据保留，共享依赖及无关未跟踪材料保持原状。

原生接口见 [适配记录](native-surface-adaptation.md)，临时产物收尾见 [清理记录](CLEANUP.md)，后续更新遵循 [固定发布流程](DEVELOPMENT.md)。
