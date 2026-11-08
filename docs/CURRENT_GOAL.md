# 当前目标与发行状态

更新：2026-11-08。当前开发适配为 **v119-native-full-view**：右侧标签条在分栏时恢复原生底色，完整视图暂停主题材料与壁纸，退出后恢复原有主题。用户要求优先保留原生外观；本轮不继续扩展完整视图的壁纸覆盖，也没有创建新正式发行。详细范围见 [当前适配说明](RELEASE_NEXT.md)。

当前来源为 Windows Codex 26.1103.4239.0（包内 26.1103.32239）。原生完整视图按钮能够覆盖仍标记为 split 的工作区；源码合同与回归已纳入该分支，排除隐藏／非活动状态，保持原生几何。普通导航保留主题，原生活动侧栏保留自身材料。

独立精确源码 **188/188 检查与 Studio E2E 通过**。v119 已再次注入，活动完整样式与源码一致；应用时为隐藏延期状态，随后后台真实客户端已读到 native-full-view、材料样式暂停及壁纸隐藏，尚未做前台视觉验收。电脑控制被物理 Esc 停止后未继续界面操作。当前开发记录和原生组件夹具均已同步，正式发行仍为下方 v0.18.9。

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
