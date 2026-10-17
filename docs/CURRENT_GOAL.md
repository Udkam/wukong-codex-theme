# 当前目标与发行状态

更新：2026-10-17。本轮发行版本为 [v0.18.4](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.4)，用户已明确授权发布。发行说明见 [RELEASE_0.18.4.md](RELEASE_0.18.4.md)，完整证据见 [验证记录](VALIDATION.md)。

运行时 v113-native-footer-paint，原生来源 Windows Codex 26.1013.4894.0。统一处理普通对话和 Dots 的渐变、实色及组合背景，适配默认代码卡与吸顶工具栏，并合入浏览器 portal 堆叠修复。深浅实机底部预览与浏览器专项预览已同步。

既有背景队列、快捷键、跨页复用、浮动输入框、深浅玻璃、首页装饰、自定义主题及旧 schemaVersion 3 兼容保留。完整范围见 [原生表面与材质接口](native-surface-adaptation.md)，浏览器专项见 [修复说明](BROWSER_PORTAL_FIX.md)。

检查记录区分实机、原生 CSS 夹具、自动回归及包校验。旧方案从 Git 历史恢复，过程产物见 [清理记录](CLEANUP.md)。用户入口为 start.cmd，后续更新遵循 [固定更新与发布流程](DEVELOPMENT.md)。
