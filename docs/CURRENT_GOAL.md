# 当前目标与发行状态

更新：2026-10-18。当前正式版本为 [v0.18.5](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.5)，已设为 GitHub Latest。运行时 v114-summary-header-material 已注入本机，独立源码 173 项回归与 Studio E2E 通过，同一正式包完成恢复原生及重新注入，远程回下载哈希一致。发行说明见 [RELEASE_0.18.5.md](RELEASE_0.18.5.md)，完整范围见 [验证记录](VALIDATION.md)。

原生来源 Windows Codex 26.1013.4894.0。处理 Dots 任务详情、普通线程预览及资料收起标题的共用渐变，保留原生透明度与遮挡作用，使顶部绘制与摘要面板材质一致。实色底板直接使用摘要填充，颜色变量仅作用于空装饰渐变，避免传给返回等交互控件。深浅任务面板实机预览已同步；当前实际任务没有可滚动范围，长内容滚动仍属于原生组件夹具的验证范围。

既有底部背景、代码卡和浏览器修复，以及背景队列、快捷键、跨页复用、浮动输入框、深浅玻璃、首页装饰、自定义主题及旧 schemaVersion 3 兼容保留。完整范围见 [原生表面与材质接口](native-surface-adaptation.md)，浏览器专项见 [修复说明](BROWSER_PORTAL_FIX.md)。

检查记录区分实机、原生 CSS 夹具、自动回归及包校验。旧方案从 Git 历史恢复，过程产物见 [清理记录](CLEANUP.md)。用户入口为 start.cmd，后续更新遵循 [固定更新与发布流程](DEVELOPMENT.md)。
