# v0.18.9：当前原生模块与底部背景适配

2026-11-05，运行时 v118-native-module-families，原生来源 Windows Codex 26.1029.7803.0。已发布为 GitHub Latest，前台深色与后台浅色检查仍按原范围记录。

新版客户端更换资源分块与模块类名后，普通对话和 Dots 的共享渐变未被旧主题规则识别，再次出现黑色横带。当前适配按真实背景叶、part 与语义 owner 清除绘制，同时保护控件、布局、页面 inset 和圆角。

一并迁移页面壁纸、代码卡／工具栏、浮层、确认／语音、侧栏及额度提示的当前模块入口，补齐工作区预览 body portal 的同类 footer；没有放宽全局几何或外部网页隔离。原生组件回归从当前 module factory 和 require／export 关系读取，不使用旧 bundle 名冒充当前来源。

真实普通／Dots 深浅状态已用旧规则负控制对照，采样控件几何不变。深色两类均确认前台可见，浅色为实际原生设置切换后的后台绘制检查；完整自动回归与范围见 [验证记录](VALIDATION.md)，实际图片见 [预览说明](previews/README.md)。

精确独立源码全量 181/181 通过，0 失败、0 跳过；Studio E2E 通过。本机活动样式为 v118，原生深色外观及当前聊天已恢复，临时脱敏样式已清除。

正式发行源码 181 项检查和 Studio E2E 通过。Windows ZIP 为 4,053,853 字节、37 个必要文件，解压逐文件哈希一致；正式 ZIP 内注入器恢复原生 verified=true，重新应用为隐藏延期状态 deferred=true／verified=false，活动 v118 和完整包内样式已独立确认。未将其写成完整前台应用或浅色前台验收；未执行冷启动／卸载。

Windows 运行包：Wukong-Codex-Theme-0.18.9-Windows.zip。SHA-256：

e5dc5db0559e4987517160a22372f50ee5cb3d1393b18c7282678023959561d1

[正式发行](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.9) 为非草稿、非预发行；[Windows ZIP](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.9/Wukong-Codex-Theme-0.18.9-Windows.zip) 与 [校验文件](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.9/SHA256SUMS.txt) 已重新下载，两个资产的本地哈希、回下载哈希和 GitHub digest 一致。标签指向 e4e90a136f9d4cd4d9141733e8bd134eba9ccb60；后续仅同步发行与清理记录。
