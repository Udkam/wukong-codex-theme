# 当前目标与发行状态

更新：2026-10-24。按用户明确授权已发布 **[v0.18.8](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.8)** 并回读为 GitHub Latest，运行时 **v117-goal-rail-paint-owner**。浏览器浮动输入框启用 goal 时，原生透明的目标条曾被主题重新涂成矩形，盖住外层圆角。本轮只为原生自带底色的条目替换材料，保留透明行、输入框布局与控件行为。范围见 [RELEASE_0.18.8.md](RELEASE_0.18.8.md)。

当前原生来源为 Windows Codex 26.1016.8622.0。真实深色渲染器已复现并对照旧规则，新规则恢复外层圆角，22 个原生节点几何差异为 0；深浅、收起／展开与独立提示条由真实原生展示回归检查。开发阶段精确独立源码 181 项检查及 Studio E2E 通过。

本机活动 v117 与完整样式已独立读回。发布测试期间曾读回普通主页面可见且背景就绪；同包恢复原生 verified=true，随后重新应用时渲染器隐藏，deferred=true／verified=false，包内完整样式与活动 v117 已确认。后台 DOM／局部绘制和延期安装不能写成 goal 前台视觉验收；发布授权与上述范围分别记录，详情见 [验证记录](VALIDATION.md)。

## 发行验证

精确发行源码 181 项检查和 Studio E2E 已通过。Windows ZIP 为 4,053,919 字节、37 个必要文件，解压逐文件哈希一致，同包恢复／应用状态已记录。GitHub 已回读非草稿、非预发行，ZIP 和 SHA256SUMS.txt 均 uploaded；两个资产回下载后的哈希分别与本地正式文件及 GitHub digest 一致。发行标签指向 aedad11，后续仅补写发行／清理文档，运行代码、测试和打包输入不变。

[下载 v0.18.8 Windows 运行包](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.8/Wukong-Codex-Theme-0.18.8-Windows.zip)。正式文件保留在 release/0.18.8，独立源码、构建／解压／回下载副本及测试临时目录已清理，最小发行证据保留在忽略的 artifacts/release-readiness-0188-20261024。

README 继续保持简约介绍和两张整体效果图；最新 goal 局部对照与其来源见 [预览说明](previews/README.md)。既有 Popover、Dots、浏览器及额度提示轮廓适配保留，先前未复现的额度底板问题仍维持原验证边界。

既有功能与原生接口见 [适配说明](native-surface-adaptation.md)，历史验证见 [验证记录](VALIDATION.md)，任务临时产物收尾见 [清理记录](CLEANUP.md)。后续更新遵循 [固定更新与发布流程](DEVELOPMENT.md)。
