# 当前目标与发行状态

更新：2026-10-08。当前正式版本为 [v0.18.2](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.2)，已设为 GitHub Latest。运行包与校验文件均已上传、回下载核对一致；同一正式包已完成本机恢复原生与重新注入。发行说明见 [RELEASE_0.18.2.md](RELEASE_0.18.2.md)。

运行时 v110-command-surface-owner 修正搜索窗口的实际绘制归属，并补齐共用命令根、Popover、确认及专用语音选择表面。透明定位框和输入框嵌入列表不重复绘制玻璃。原生来源为 Windows Codex 26.1002.7124.0；两张深浅色实机搜索预览已同步。

既有背景队列、快捷键、跨页复用、浮动输入框、深浅玻璃、首页装饰、自定义主题以及旧 schemaVersion 3 兼容继续保留。完整范围见 [原生表面与材质接口](native-surface-adaptation.md)。

检查记录区分实机、原生 CSS 夹具、自动回归及包校验，见 [验证记录](VALIDATION.md)。旧方案从 Git 历史恢复；过程产物收尾见 [清理记录](CLEANUP.md)。用户入口为 start.cmd，后续更新遵循 [固定更新与发布流程](DEVELOPMENT.md)。
