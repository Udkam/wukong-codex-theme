# 内嵌浏览器显示修复专项记录

日期：2026-10-17。本专项在 v112-browser-portal-stacking 完成验证，随后由主任务合入 v113-native-footer-paint，随 v0.18.4 统一发行。以下记录专项执行时的范围与结果；合并后的独立回归及正式包验证见 [验证记录](VALIDATION.md)。

网页能加载，但浏览器区域显示空白或透出应用背景。实机检查发现网页已包含完整内容，guest 区域尺寸正常；应用主界面的 #root 却因主题 z-index:1 创建了更高的堆叠上下文，盖住挂在 body 下的浏览器 portal。

## 改动

runtime/wukong-codex-theme-background-v13.css 只移除 #root 的 z-index:1，保留 position:relative。原生浏览器的尺寸、可见性、坐标、指针行为及网页 CSS 没有改动。body 壁纸回退使用 prepend，仍在 root 之前；无需提高浏览器的层级。runtime/injection-plan-v13.mjs 修订号更新为 v112-browser-portal-stacking。

## 实机与原生来源

当前安装目录版本 26.1013.4894.0，包内版本 26.1013.40934。浏览器专项来源记录为 native-browser-provenance.json，ASAR 为 582,072,504 字节，流式 SHA-256 为 bbec1d64e135b718a154b31655bb8ad9a39472bac1b2cabba991a9d97a339dd8。该记录仅覆盖浏览器；旧 general UI baseline 未被冒充更新。

实际源码将 [data-embedded-frame-host-root] 挂在 document.body 下，其内的 [data-browser-host-root] 使用 contain:paint，实际 webview 位于 [data-browser-sidebar-webview]。可见容器 z-index 为空（auto），原生 #root 声明仅为 height:100svh。tests/native-browser-contract.test.mjs 检查版本、活动 HTML 引用、JS/CSS/HTML 哈希及上述语义结构。

在同一实际窗口对照旧 z-index:1 与 auto：网页从被遮挡恢复可见，命中检测从非 guest 变为 guest；两次网页矩形完全一致（x=1339.0125732421875, y=144, width=704.9874877929688, height=956）。局部截图为 previews/browser-portal-before.png 和 previews/browser-portal-after.png，仅包含公开网页及工具栏。对照后临时诊断样式已移除，永久主题源码提供修复。

## 自动检查

从 Git HEAD 导出独立源码，并覆盖本次两个运行文件和浏览器测试；依赖通过只读使用的现有 node_modules junction 提供。未将继承的未跟踪材料作为测试输入。

- node --test --test-concurrency=1 tests/browser-portal.test.mjs tests/background-runtime-v13.test.mjs：40 项通过，0 失败，0 跳过。覆盖背景切换、锁定、快捷键、隐藏应用恢复和新增浏览器绘制回归。
- node --test tests/native-browser-contract.test.mjs：1 项通过，0 失败，0 跳过；当前安装包的浏览器专项合同成立。
- 浏览器夹具包含 PageSurface/body 背景回退 × dark/light × 720/1280 宽度；检查矩形、实际 PNG 像素、根内容/工具栏/浏览器/弹窗点击和层级。每个 native-page 场景都以旧规则复现遮挡，证明回归能检出本次缺陷。该 webview 是绘制夹具，不能替代 Electron guest 实机验收。

背景测试的 31 项断言完成后，现有 browser.close 钩子未自动结束。核对本轮进程树和专用 Playwright 配置目录后，先尝试 Stop-Process，遇到 PowerShell 内部空引用错误；随后 taskkill 结束同一测试浏览器及子进程。其余浏览器测试继续完成，测试命令最终退出码为 0；总耗时 181.0 秒包含收尾等待。未修改原有测试钩子或应用进程。

本专项未执行完整 npm run check、Studio E2E、客户端冷启动、卸载或浅色实机检查；深浅模式与两种宽度来自自动夹具。没有重新核对所有原生 UI，不能将浏览器专项来源扩大为整个新版客户端的全量适配验收。

## 清理

保留本修复说明、专项来源、两个测试与公开网页局部预览。含聊天内容的初始诊断截图和本轮独立源码副本在收尾时删除；继承的未跟踪材料、共享依赖、历史发行及用户浏览器保留。本轮未在 Archives 写入材料。
