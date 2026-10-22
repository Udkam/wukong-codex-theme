# 当前目标与发行状态

更新：2026-10-23。用户明确回复“可发布”，当前准备 **v0.18.7**，运行时为 **v116-quota-seam-contour**。默认多行输入框上方的独立 Recovery 提示卡使用输入框的圆角／曲线变量，保留原生底色、边距、宽度及操作。范围见 [RELEASE_0.18.7.md](RELEASE_0.18.7.md)。

额度已重置，无法再次打开原始额度耗尽界面。当前源码及真实组件夹具确认提示卡 28px 与 Windows 输入框 22px 的轮廓差异，但未重现截图中的额外深色底板。该底板根因仍未确认；本轮不得称为原始业务状态实机验收通过。独立源码回归、注入及具体限制见 [验证记录](VALIDATION.md)。

## 本轮发行验证

原生来源重新核对为 Windows Codex 26.1016.6573.0，ASAR 大小及 SHA-256 与开发记录一致。发布开始时实际主页面为 v116、dark、backgroundReady=true、document.hidden=false。两张深浅预览仍是 10 月 21 日生成的真实原生组件／CSS 独立夹具，带有“非额度实机”标注。

精确索引导出源码的 179 项回归与 Studio E2E 已通过。Windows ZIP 为 4,053,853 字节、37 个必要文件，解压逐文件哈希一致；使用同包实际恢复原生并重新注入均 verified=true，最终主页面可见、背景就绪且完整样式匹配发行源码。正执行 GitHub 发布及回下载校验，完成后补记；此时最近已发布版本仍为 [v0.18.6](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.6)。

既有 Popover 绘制归属、Dots 处理框标题、底部背景、代码卡和浏览器修复，以及背景队列、快捷键、跨页复用、浮动输入框、深浅玻璃、首页装饰、自定义主题及旧 schemaVersion 3 兼容保留。原生接口见 [适配说明](native-surface-adaptation.md)，浏览器专项见 [修复说明](BROWSER_PORTAL_FIX.md)，历史发行结果见 [验证记录](VALIDATION.md)。

检查记录区分实机、原生 CSS 夹具、自动回归及包校验。旧方案从 Git 历史恢复，过程产物见 [清理记录](CLEANUP.md)。用户入口为 start.cmd，后续更新遵循 [固定更新与发布流程](DEVELOPMENT.md)。
