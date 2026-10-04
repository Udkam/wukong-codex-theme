# 当前目标与发行状态

更新：2026-10-04。当前版本为 [v0.18.0](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.0)，发行说明见 [RELEASE_0.18.0.md](RELEASE_0.18.0.md)。本轮用户已明确要求检查后同步发行。

运行时 v108-native-surface-adapter 保留背景队列、切换快捷键、跨页复用、玻璃材质、深浅模式、首页装饰和自定义主题功能。对照 Windows Codex 26.930.3930.0 的活动 CSS/JS，按原生语义标记及实际绘制归属维护适配，减少尺寸、工具类和组件层级依赖。

语义映射集中于 runtime/native-ui-contract.mjs，材质和阅读颜色从主题 materials 配置生成。旧 schemaVersion 3 导出继续兼容；退役纸张和侧栏纹理不再加载。完整范围见 [原生表面与材质接口](native-surface-adaptation.md)。

检查记录区分实机、自动回归、包校验与未执行范围，见 [验证记录](VALIDATION.md)。README、六张实机预览、版本和发行说明随运行包同步；源码与已发布包均使用本轮适配内容。

旧方案、专用旧测试与重复文案已清理，有效保护迁移；Git 历史和既有版本保留。宠物、旧诊断及 Archives 存档的手动删除范围见 [清理记录](CLEANUP.md)。

用户入口为 start.cmd。后续更新遵循 [固定更新与发布流程](DEVELOPMENT.md)。
