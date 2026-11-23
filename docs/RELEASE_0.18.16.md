# v0.18.16 状态条与标签页绘制调整

适配 Windows Codex 26.1117.4957.0，主题运行时为 v134。

针对目标条与排队消息中的间歇竖线反馈，本版停用状态条实际材质表面的背景模糊，保留底色、高光、原生边框、分隔线、圆角和控件。

独立状态条由自身绘制材质。浮动输入框中的透明状态条由外层表面绘制，带状态条时停用该外层的背景采样。最小化浮动聊天的工作提示也按其独立材质表面停用采样。项目条继续采用无背景模糊的材质，普通首页输入主体、其他独立提示及菜单沿用各自滤镜。

右侧标签页的原生底色按实际外层标题载体绘制，按原生间距补齐末端，并对齐独立的边界装饰线。分栏、完整视图和左右书写方向沿用各自的原生布局，标签、按钮、内容和拖拽区域保留原位。用户已实机确认右侧标签页现在对齐。

原生组件回归检查材料归属、动态挂载和布局范围。深浅色预览由原生组件、CSS 和示例内容生成，夹具未复现间歇竖线。实际注入与本轮实机确认范围见验证记录。[组件预览](previews/README.md) · [验证记录](VALIDATION.md)

209 文件独立源码逐项匹配暂存 Git blob，219/219 检查与 Studio E2E 通过。38 文件下载包通过源码、ZIP CRC、解压哈希与独立白名单审计；同包恢复原生、重新应用及前台稳定读回通过。冷启动和卸载本轮未执行。

解压 Windows 运行包后，完全退出桌面客户端，再双击 `start.cmd`。[使用说明](QUICK_START.txt)

[GitHub 发行页](https://github.com/Udkam/wukong-codex-theme/releases/tag/v0.18.16) · [Windows ZIP](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.16/Wukong-Codex-Theme-0.18.16-Windows.zip) · [SHA256SUMS.txt](https://github.com/Udkam/wukong-codex-theme/releases/download/v0.18.16/SHA256SUMS.txt)
