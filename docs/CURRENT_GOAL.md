# 当前目标与发行状态

更新：2026-11-09。当前开发适配为 **v120-native-tab-header**：补齐右侧标签页最右端原生注册按钮层的背景，标签行与按钮区域均保留原生底色；完整视图继续暂停主题材料与壁纸，退出后恢复原主题。详细范围见 [当前适配说明](RELEASE_NEXT.md)。

用户截图证实先前 v119 的标签行规则仍遗漏右端背景。本轮核对实机 content overlay 的裁切及独立 end-slot，按当前 Windows Codex 26.1103.4239.0 的注册链处理真正的整高内容载体，不调整原生尺寸或裁切。左侧聊天标题和普通主题保留。

独立源码 191/191 检查和 Studio E2E 通过，v120 已注入，当前隐藏窗口按后台延期状态记录。用户已人工核验右侧背景通过；随后补充的开合过渡反馈已纳入同状态重复写入优化，实际流畅度不以夹具结果代替实机感受。本轮未创建新正式发行；最新正式下载仍为 v0.18.9。独立回归、注入与实机验收边界按 [验证记录](VALIDATION.md) 的 v120 小节记录。

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
