# v0.18.8：浏览器 goal 输入框材料归属

2026-10-24，运行时 v117-goal-rail-paint-owner，原生来源 Windows Codex 26.1016.8622.0。用户明确授权发布 v0.18.8；该授权不等同于前台窗口的独立视觉验收。

浏览器浮动输入框启用 goal 时，原生透明的目标条被主题再次涂成了矩形，盖在负责整体圆角的背景层上。本轮只为原生确有底色的条目替换材料，透明目标条由外层 FloatingSurface 统一绘制；保留布局、圆角、拖动／缩放外壳的溢出和输入／目标按钮行为。

![原生圆角恢复后的实机局部](previews/dark-goal-floating-after.png)

当前深色真实渲染器已复现并对照旧规则；采样 22 个原生节点几何不变。渲染器处于隐藏状态，未声称前台窗口或用户视觉验收通过。深浅与收起／展开、独立 default／warning 及透明变体由真实原生组件回归检查。完整结果见 [验证记录](VALIDATION.md)，图片来源见 [预览说明](previews/README.md)。

精确独立源码的 181 项检查全部通过，0 失败、0 跳过；Studio E2E 通过。本机读回活动 v117 和完整样式一致，没有临时样式残留。

正式发行源码 181 项检查和 Studio E2E 通过。Windows ZIP 共 37 个必要文件、4,053,919 字节，解压逐文件哈希一致。正式 ZIP 内的注入器恢复原生 verified=true；重新应用时窗口隐藏，deferred=true／verified=false，活动 v117 与完整包内样式已独立确认。未执行冷启动／卸载，未将延期安装视为可见窗口验收。

Windows 运行包：`Wukong-Codex-Theme-0.18.8-Windows.zip`。SHA-256：

`dec1dc15706a2bbb54fa180f9cd89dc02067807dbfe00e7fec445a2d9ca04734`
