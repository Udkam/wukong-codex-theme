# Wukong Codex Theme

这是一个为 Windows ChatGPT/Codex 桌面客户端制作的悟空主题。当前修复保留完整双背景队列，以原生组件的形状和语义配色为边界替换玻璃材质。浅色视觉和部分实际窗口仍未验收，具体证据见下方逐项检查表。

这是单一的完整本地发行版：10 张战斗图与 3 张风景图保留为双背景队列，按页面路由、快捷键、题字和字标工作。Dream Skin 的单背景包、Gallery 构建链和投稿材料已经移除，不再作为本项目的分发方案。

## 完整双队列运行时

本地运行时不修改 `ChatGPT.exe`、`app.asar`、WindowsApps、账号数据、Store 设置或自动更新策略。只有运行项目的 `start.cmd` 才通过官方 AppX 激活入口携带 loopback CDP 参数启动并注入主题。原生 ChatGPT.exe 和商店入口保持原生行为。也支持热应用到已有可信本机 CDP 会话；不会关闭或强杀已运行的官方客户端。

当前视觉规则：

- 新建任务页使用战斗组，项目和对话页使用风景组。
- `Ctrl+Alt+F` / `Ctrl+Alt+B` 在当前组内前进或后退。
- `Ctrl+Alt+C` 临时切换战斗或风景组。
- `Ctrl+Alt+K` 锁定或解锁当前图片与组。
- `Ctrl+Alt+T` 显示或隐藏新建任务页的“此去，欲破何局？”与字标。
- 正文与按钮保持原生字色，不增加文字阴影或 Ultra 背衬；原生已有的面板使用玻璃材质，圆角、裁切和布局保持原生。
- 深浅色新对话均无背景遮罩；浅色对话使用随场景变化的白色薄遮罩（雪山 18%、夕阳 19.5%、峡谷 23%），深色对话保留按场景配置的暗色遮罩，不修改图片资产或文字颜色。
- Electron 主进程绘制的系统菜单不受网页 CSS 控制，目前仍未实现玻璃材质。

开发或受管会话中可用以下命令热应用或还原。`<port>` 必须是已验证的本机 `127.0.0.1` CDP 端口；命令不会启动或重启 ChatGPT。

```powershell
node runtime/injector.mjs --apply <port> themes/active.json
node runtime/injector.mjs --state <port>
node runtime/injector.mjs --restore <port>
```

## 唯一主题入口

双击项目文件夹内的 **start.cmd**。不需要安装程序，不接管原生快捷方式，不注册开机项或常驻原生启动监听。原生 ChatGPT.exe 正常启动，不自动加载主题。

每次显式启动都会重新查询当前官方包并准备匹配的 AppX 激活助手，因此不依赖旧版本的 WindowsApps 路径，不修改或限制官方自动更新。若已有原生客户端进程运行，请完全退出后再运行主题入口；脚本不会强制关闭现有进程。未来官方版本若移除嵌入式 Node 或改变注入接口，仍需适配。

需要快捷方式时，只让它指向这个项目的 start.cmd。旧 install/stop/remove/backgrounds 批处理已删除，项目根目录只保留 start.cmd；历史存档暂不删除，具体清单见 [文件整理清单](docs/FILE_INVENTORY.md)。不要移动项目后继续使用指向旧路径的快捷方式。

背景管理保留为内部脚本 scripts/manage-backgrounds.ps1。恢复当前窗口的原生样式可调用 scripts/disable.ps1；这些脚本没有单独的 .cmd 入口。发布包由 scripts/package-runtime.mjs 按活动文件白名单生成，不携带宠物。

## 验证

```powershell
npm run test:runtime-states
npm run test:lifecycle
npm run test:managed-package
```

测试与验收边界见 [验证记录](docs/VALIDATION.md)。本轮只同步主题实现，不同步独立宠物改动。
