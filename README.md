# Wukong Codex Forge

为 Windows 官方 ChatGPT/Codex 桌面应用制作的《黑神话：悟空》风格主题。项目直接从本地 Git 仓库加载背景、纸面材质与样式，最终窗口仍由官方 `ChatGPT.exe` 承载；不会修改 `ChatGPT.exe`、`app.asar`、WindowsApps、应用签名或 Codex 配置，也不会创建一个独立的“Wukong Codex”应用。

当前源码版本为 **0.14.7 / V51.9**。主题提供 22 张有序背景、原生坐标上的四角纸面输入器、侧栏选中纸带、环境信息纸面以及清晰的运行进度状态色。

## 主要特性

- 保留官方应用名称、图标、账号、项目、任务和原生交互。
- 新建任务页使用 13 张战斗图，已有任务使用 9 张风景图；两组都按固定编号顺序切换，不随机抽取。
- `Ctrl+Alt+B` 在当前模式内原位切换下一张背景，`Ctrl+Alt+Shift+B` 切换上一张；两者都在战斗或风景当前组内循环，不刷新页面、不重载或重建主题。
- 普通任务切换、history/hash、流式回答、窗口缩放和 DOM 重挂载都不会换图。
- 真正点击“新建任务”时，只有距上次自动推进至少 20 分钟才自动推进；没有后台定时轮播。
- 下一张图由最终参与绘制的同一个 `<img>` 完成解码后才淡入；旧图在此之前持续可见。稳态只保留一张背景纹理，420 ms 过渡期最多两张，并且同时最多一个图片解码请求。
- 图片本身不使用亮度、饱和度或对比度滤镜；战斗与风景遮罩均按每张图的色调降至正文仍满足至少 4.5:1 模型对比度的范围。
- 运行链不使用 WMI/CIM、固定周期进程扫描、renderer 轮询、服务或计划任务。
- 删除仓库后主题来源消失，监督器会注销自身，后续启动回到官方原生界面。

## 系统要求

- Windows 10 或 Windows 11。
- 已安装 Microsoft Store 提供的官方 ChatGPT/Codex 桌面应用（包名 `OpenAI.Codex`）。
- Windows 自带的 .NET Framework v4 C# 编译器可用；安装器用它构建当前用户级激活器与监督器。
- 当前用户可以运行 PowerShell 5.1 脚本。PowerShell 只用于一次性安装、维护与停用；日常正式启动使用预编译激活器和 Codex 自带 Node。
- 仓库必须保留在固定路径。主题资源直接从该 checkout 读取，不会复制为一套可脱离仓库运行的主题。
- 仓库路径及关键输入文件不得经过 junction、符号链接或其他 reparse point；安装器会对此 fail closed。

## 安装与首次启动

```powershell
git clone https://github.com/Udkam/wukong-codex-forge.git
cd wukong-codex-forge
.\install-theme.cmd
.\start-theme.cmd
```

首次安装前，建议先完全退出 ChatGPT，包括托盘或后台实例。安装器会验证官方包、建立仓库 bridge、编译当前用户级原生入口监督器，并维护一个仍叫作 `ChatGPT`、仍使用官方图标的开始菜单入口。

如果 `start-theme.cmd` 提示当前窗口来自未受管入口，请完全退出 ChatGPT 后再运行一次。Chromium 的受管启动参数不能在进程创建后补加，因此只有这种首次修复场景需要完整退出；安装完成后的日常任务切换不需要重启。

## 日常使用

安装成功后，从开始菜单或已固定的官方名称 `ChatGPT` 入口启动即可，不需要运行 `npm`，也不需要保持 PowerShell 窗口。

- 手动下一张背景：`Ctrl+Alt+B`（当前模式内循环）
- 手动上一张背景：`Ctrl+Alt+Shift+B`（当前模式内循环）
- 两个切图快捷键都原位解码与淡入，不刷新页面，也不重载或重建主题。
- 临时恢复当前窗口为原生界面：运行 `stop-theme.cmd`
- 在同一个可复用官方窗口重新应用主题：运行 `start-theme.cmd`
- Store 更新覆盖入口后：重新运行 `install-theme.cmd`

## 背景编号与切换顺序

手动切换永远在当前模式的编号序列内推进或后退并循环，因此不会随机抽图，也不会切换战斗/风景模式。

| 战斗顺序 | 场景 ID | 风景顺序 | 场景 ID |
| --- | --- | --- | --- |
| B01 | `erlang-ink-duel` | S01 | `ridge-gate` |
| B02 | `great-sage-staff` | S02 | `forest-shrine` |
| B03 | `storm-bearer` | S03 | `mountain-path` |
| B04 | `shadow-confrontation` | S04 | `sunlit-mountain-vista` |
| B05 | `training-sunset` | S05 | `sunset-ravine` |
| B06 | `thunder-dragon-ascent` | S06 | `mist-temple` |
| B07 | `ink-wanderer` | S07 | `cavern-temple` |
| B08 | `white-tiger` | S08 | `snow-lake` |
| B09 | `red-lightning` | S09 | `autumn-grove` |
| B10 | `violet-dharma-ring` | — | — |
| B11 | `white-dragon-frost` | — | — |
| B12 | `bear-crush` | — | — |
| B13 | `spider-blade` | — | — |

完整循环分别为：

```text
B01 -> B02 -> B03 -> B04 -> B05 -> B06 -> B07 -> B08 -> B09 -> B10 -> B11 -> B12 -> B13 -> B01
S01 -> S02 -> S03 -> S04 -> S05 -> S06 -> S07 -> S08 -> S09 -> S01
```

当前 22 张 JPEG 合计 8,355,513 bytes（约 8.36 MB）、45,201,592 解码像素。图片不会在启动时全部解码，也不会进行相邻场景预取。

## 自行调整背景

### 替换现有图片

`scripts/prepare-background.ps1` 可以把 JPG、PNG 等 System.Drawing 可读取的图片转换为对应编号槽位。脚本不会修改源图，默认不放大小图，最大输出 1920×1080、JPEG 质量 90；带透明通道的区域会铺为黑色。需要去掉源图黑边时，可选传入 `-CropTop`、`-CropRight`、`-CropBottom`、`-CropLeft`，单位均为源图像素。

例如，用自己的图片替换 B05：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-background.ps1 `
  -Slot B05 `
  -InputPath "D:\Pictures\my-battle.png" `
  -Force
```

替换 S03 并自定义编码质量：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-background.ps1 `
  -Slot S03 `
  -InputPath "D:\Pictures\my-scenery.jpg" `
  -Quality 92 `
  -Force
```

使用规则：

1. 当前活动战斗槽位为 `B01`–`B13`，风景槽位为 `S01`–`S09`；准备脚本为后续扩展接受 `B01`–`B99` / `S01`–`S99`。
2. 已存在的槽位必须显式传入 `-Force`，防止误覆盖。
3. 活动清单只有 `themes/active.json`；`themes/ink-mountain.json` 是历史文件，不要编辑它来配置当前主题。
4. 如需改变裁切焦点，可编辑对应条目的 `position`；`tone` 控制界面配色，`veil` 控制阅读遮罩强度，`mark` 可在浅/深“悟空”字标之间选择。
5. 替换后依次运行 `stop-theme.cmd`、`start-theme.cmd`，即可让同一官方窗口重新载入资源，不需要重启 ChatGPT；只有受管调试通道本身已不存在时才需要退出并重开一次。
6. 准备公开提交前请运行 `npm ci` 与 `npm run check`，确保总字节、解码像素和双图过渡预算没有超限。

### 调整播放顺序

播放顺序由 `themes/active.json` 中每个场景的 `slot` 与 `order` 决定，JSON 条目本身排在哪一行不影响播放。战斗组与风景组分别从 1 连续编号，且 `slot` 必须和 `order` 一致：例如 `B03` 对应 `order: 3`，`S06` 对应 `order: 6`。

要交换两张图的顺序，同时交换它们的 `slot` 和 `order` 即可；场景的 `id`、`asset`、`position`、`tone`、`veil` 和 `mark` 留在原条目中。修改后运行 `stop-theme.cmd`、`start-theme.cmd`。由于图片文件名和逻辑顺序可以不同，后续替换图片时应以该条目的 `asset` 文件名为准。

### 增加一张背景

例如增加第 14 张战斗图：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-background.ps1 `
  -Slot B14 `
  -InputPath "D:\Pictures\my-new-battle.jpg"
```

然后在 `themes/active.json` 的 `background.gallery` 中增加：

```json
{ "id": "my-new-battle", "slot": "B14", "order": 14, "asset": "backgrounds/battle-14.jpg", "position": "center center", "mode": "battle-secondary", "tone": "celestial-ink", "veil": 0.8 }
```

风景图同理使用下一个连续编号（当前为 `S10`）并把 `mode` 设为 `scenery`。`id` 必须唯一；同一组的 `slot`/`order` 必须从 1 连续到末项，图库最多 24 项。当前图库已使用 45,201,592 / 48,000,000 解码像素，因此通常只能再加入一张不超过 1920×1080 的图片；如需更多图片，请降低尺寸或替换现有图片。仅本地自用时只需修改 `themes/active.json`；若要把新默认顺序公开提交，还应同步 `shared/theme-model.mjs`、固定数量测试、README 表格与 `docs/ASSET_SOURCES.md`。

## 停用与恢复原生

运行以下任一命令可以恢复当前窗口的原生 DOM 与绘制，且不会结束 ChatGPT 进程：

```powershell
.\stop-theme.cmd
# 或
.\remove-theme.cmd
```

如果不再使用本项目，先运行上述命令，再删除本地仓库。监督器检测到仓库或 `package.json` 标记消失后会撤销自己的当前用户启动项；残留 bridge 也只会回退启动官方应用，不再加载主题资源。

## 故障排查

### 启动后仍是原生主题

1. 完全退出 ChatGPT，包括托盘/后台实例。
2. 在仓库根目录重新运行 `install-theme.cmd`。
3. 再运行 `start-theme.cmd`。
4. 若 Store 刚完成更新，必须重跑安装器以刷新官方包路径与 AUMID 验证。

### 切换任务时短暂错位

主题只替换原生 DOM 上的 paint，不创建第二套输入器。若应用升级改变了原生结构，运行 `npm run check`；原生结构合同失败时应先更新适配器，不要用额外定位规则掩盖漂移。

### 资源占用异常

背景运行时没有定时轮播，稳态只保留一张纹理。若占用持续异常，先运行 `stop-theme.cmd` 比较原生状态，并检查是否存在开发服务器、测试浏览器或其他非日常进程；不要按进程名批量结束 ChatGPT 子进程。

## 开发与验证

```powershell
npm ci
npm run check
```

常用聚焦测试：

```powershell
npm run test:runtime-states
npm run test:managed-package
npm run test:native
```

项目结构：

- `themes/active.json`：唯一活动主题清单。
- `themes/backgrounds/`：B/S 编号背景槽位。
- `runtime/`：renderer 注入、背景状态机、宿主与原生入口组件。
- `scripts/`：安装、启动、停用、打包与背景准备工具。
- `tests/`：资源预算、原生几何、生命周期和最小包合同。
- `docs/`：需求、设计、素材来源、历史决策和验收记录。

进一步阅读：[当前目标](docs/CURRENT_GOAL.md)、[设计说明](docs/DESIGN.md)、[需求与验收](docs/REQUIREMENTS.md)、[素材来源](docs/ASSET_SOURCES.md)。

## 素材、商标与侵权联系

本项目是独立、非官方的本地主题项目，与 OpenAI、Game Science 或《黑神话：悟空》的权利人不存在隶属、授权或背书关系。ChatGPT、Codex、《黑神话：悟空》及相关角色、商标、书法、截图和美术权利归各自权利人所有。

部分背景图片由网络搜集或由用户提供，仅用于非商业主题展示；仓库不主张这些原始图片的所有权。若您是相关权利人并认为仓库内容侵犯了您的权利，请发送邮件至 **`chenlj89@mail2.sysu.edu.cn`**，维护者会核验并及时移除或更正。

详细来源和发布边界见 [docs/ASSET_SOURCES.md](docs/ASSET_SOURCES.md)。

## 许可证

代码按 [MIT License](LICENSE) 发布。第三方图片、商标、角色和其他素材不因代码许可证而获得再许可。
