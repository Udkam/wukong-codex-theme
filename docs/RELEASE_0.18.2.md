# v0.18.2：搜索与共用浮层材质

2026-10-08，运行时 v110-command-surface-owner，原生来源 26.1002.7124.0。本版保留现有背景队列、快捷键、自定义主题及浮动输入框修复。

- 修正搜索聊天窗口的实际绘制归属：cmdk-dialog 定位框透明，cmdk-root 使用深浅玻璃。共用根组件的文件搜索、命令及项目／分支选择列表一并适配。
- 搜索阅读表面至少 94% 填充，主文字、副文字和提示采用主题局部颜色；保留原生选择、禁用与加载状态。
- 补齐 data-slot=popover-content、旧版 Popover 组件，以及确认／专用语音选择表面的背景。保留原生文字和按钮状态。
- 输入框上方托盘的嵌入 cmdk 列表保持透明，无独立模糊或阴影，避免重复绘制。
- 更新 README、两张脱敏实机搜索预览、原生来源及回归保护。

实机检查覆盖深浅色搜索、颜色弹层、项目表单、个人菜单和添加面板；其他组件变体由原生源码与 CSS 夹具检查覆盖，未宣称逐页实机验收。详情见 [验证记录](https://github.com/Udkam/wukong-codex-theme/blob/main/docs/VALIDATION.md)。

下载请选择 Wukong-Codex-Theme-0.18.2-Windows.zip，完整解压后双击 start.cmd。SHA256SUMS.txt 用于核验；GitHub 自动生成的 Source code 是开发源码。

本轮未执行完整冷启动、卸载或新的流式重载专项检查。
