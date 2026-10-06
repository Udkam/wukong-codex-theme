# 当前目标与发行状态

更新：2026-10-06。当前版本为 [v0.18.1](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.1)，发行说明见 [RELEASE_0.18.1.md](RELEASE_0.18.1.md)。本轮用户已明确授权检查后发布。

运行时 v109-floating-paint-owner 修正右下角快速聊天定位外框重复绘制的问题。对照 Windows Codex 26.930.4958.0 的原生浮动组件，只替换实际带背景的表面，保留原生几何、收起与展开行为。深浅色实机局部预览已同步。

基础适配继续保留背景队列、切换快捷键、跨页复用、玻璃材质、深浅模式、首页装饰和自定义主题功能。语义映射集中于 runtime/native-ui-contract.mjs，材质与阅读颜色从主题 materials 配置生成，旧 schemaVersion 3 导出继续兼容。完整范围见 [原生表面与材质接口](native-surface-adaptation.md)。

检查记录区分实机、自动回归、包校验与未执行范围，见 [验证记录](VALIDATION.md)。旧方案从 Git 历史恢复；过程产物收尾见 [清理记录](CLEANUP.md)。

用户入口为 start.cmd。后续更新遵循 [固定更新与发布流程](DEVELOPMENT.md)。
