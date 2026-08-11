# Wukong Codex Theme

为 Windows 官方 ChatGPT/Codex 桌面应用制作的《黑神话：悟空》风格主题。项目直接从本地 Git 仓库加载背景、纸面材质与样式，最终窗口仍由官方 `ChatGPT.exe` 承载；不会修改 `ChatGPT.exe`、`app.asar`、WindowsApps、应用签名或 Codex 配置，也不会创建一个独立的“Wukong Codex”应用。

当前源码版本为 **0.14.7 / V53**。主题提供 20 张有序背景、原生坐标上的四角纸面输入器、侧栏选中纸带、环境信息纸面以及清晰的运行进度状态色。

## 主要特性

- 保留官方应用名称、图标、账号、项目、任务和原生交互。
- 13 张战斗图和 7 张风景图按两组独立的固定顺序切换，不随机抽取；新建任务页自动使用战斗序列，项目/对话页自动使用风景序列。
- `Ctrl+Alt+F` 在当前序列内原位切换下一张背景，`Ctrl+Alt+B` 切换上一张；`Ctrl+Alt+C` 手动切换战斗/风景序列。
- `Ctrl+Alt+T` 原位隐藏或重新显示新建任务页的“此去，欲破何局？”题字和“悟空”字标；该选择在当前窗口内跨背景、任务和对话保持，重启后默认显示。
- `Ctrl+Alt+C` 只在当前页面临时覆盖自动序列；进入另一任务、对话或页面时恢复上述页面默认，不推进该序列中的播放位置。
- 同一页面类型内的普通任务切换、history/hash、流式回答、窗口缩放和 DOM 重挂载都不会推进组内图片；组内播放位置只响应上述前进/后退快捷键，没有后台定时轮播。
- 下一张图由最终参与绘制的同一个 `<img>` 完成解码后，在连续两个绘制帧之间启动 420 ms 淡入；旧图在此之前持续可见。稳态只保留一张背景纹理，过渡期最多两张，并且同时最多一个图片解码请求。
- 图片本身不使用亮度、饱和度或对比度滤镜；新建任务页的全屏遮罩固定为 10%（保留 90% 原图），项目/对话页则为每张图片单独校准遮罩，在亮暗差异很大的素材间兼顾原色与文字可读性。该校准绑定图片和页面类型，不绑定战斗/风景序列。输入器、内容栏、常驻侧栏以及折叠侧栏临时展开的浮层都保持透明主题表面。
- 运行链不使用 WMI/CIM、固定周期进程扫描、renderer 轮询、服务或计划任务。
- 删除仓库后主题来源消失，监督器会注销自身，后续启动回到官方原生界面。

## 系统要求

- Windows 10 或 Windows 11。
- 已安装 Microsoft Store 提供的官方 ChatGPT/Codex 桌面应用（包名 `OpenAI.Codex`）。
- Windows 自带的 .NET Framework v4 C# 编译器可用；安装器用它构建当前用户级激活器与监督器。
- 当前用户可以运行 PowerShell 5.1 脚本。PowerShell 只用于一次性安装、维护与停用；日常正式启动使用预编译激活器和 Codex 自带 Node。
- 仓库必须保留在固定路径。主题资源直接从该 checkout 读取，不会复制为一套可脱离仓库运行的主题。
- 仓库路径及关键输入文件不得经过 junction、符号链接或其他 reparse point；安装器会对此 fail closed。

为保证旧版本无损升级，部分内部运行标识仍保留 `WukongCodexForge`、`wukong-forge` 和旧存储键。它们只是兼容性协议，不代表另一个应用或仓库；对外项目名、包标记与推荐本地目录统一为 `wukong-codex-theme`。

## 安装与首次启动

```powershell
git clone https://github.com/Udkam/wukong-codex-theme.git
cd wukong-codex-theme
.\install-theme.cmd
.\start-theme.cmd
```

首次安装前，建议先完全退出 ChatGPT，包括托盘或后台实例。安装器会验证官方包、建立仓库 bridge、编译当前用户级原生入口监督器，并维护一个仍叫作 `ChatGPT`、仍使用官方图标的开始菜单入口。

如果 `start-theme.cmd` 提示当前窗口来自未受管入口，请完全退出 ChatGPT 后再运行一次。Chromium 的受管启动参数不能在进程创建后补加，因此只有这种首次修复场景需要完整退出；安装完成后的日常任务切换不需要重启。

## 日常使用

安装成功后，从开始菜单或已固定的官方名称 `ChatGPT` 入口启动即可，不需要运行 `npm`，也不需要保持 PowerShell 窗口。

- 手动下一张背景：`Ctrl+Alt+F`（当前模式内循环）
- 手动上一张背景：`Ctrl+Alt+B`（当前模式内循环）
- 临时切换战斗/风景序列：`Ctrl+Alt+C`（当前页面有效；进入另一页面后恢复自动默认）
- 同时开关新建任务页题字与“悟空”字标：`Ctrl+Alt+T`（当前窗口内保持，重启后默认显示）
- 四个主题快捷键都在当前 document 内工作，不刷新页面，也不重载或重建主题。
- 临时恢复当前窗口为原生界面：运行 `stop-theme.cmd`
- 在同一个可复用官方窗口重新应用主题：运行 `start-theme.cmd`
- Store 更新覆盖入口后：重新运行 `install-theme.cmd`

## 背景编号与切换顺序

`slot` 是图片与清单条目的稳定物理编号，`order` 才是该组内的播放位置。手动前进/后退按 `order` 循环，不随机抽图；`Ctrl+Alt+C` 只临时改变当前页面使用的序列，不改写两组顺序。新建任务页默认战斗序列，项目/对话页默认风景序列；跨页面后自动恢复对应默认。

| 顺序 | 战斗槽位 / 场景 ID | 风景槽位 / 场景 ID |
| ---: | --- | --- |
| 1 | B07 / `ink-wanderer` | S05 / `sunset-ravine` |
| 2 | B01 / `erlang-ink-duel` | S04 / `sunlit-mountain-vista` |
| 3 | B02 / `great-sage-staff` | S08 / `snow-lake` |
| 4 | B03 / `storm-bearer` | S01 / `ridge-gate` |
| 5 | B04 / `shadow-confrontation` | S02 / `forest-shrine` |
| 6 | B05 / `training-sunset` | S03 / `mountain-path` |
| 7 | B08 / `white-tiger` | S10 / `verdant-cavern` |
| 8 | B09 / `red-lightning` | — |
| 9 | B06 / `thunder-dragon-ascent` | — |
| 10 | B11 / `white-dragon-frost` | — |
| 11 | B12 / `bear-crush` | — |
| 12 | B15 / `crimson-lightning-burst` | — |
| 13 | B16 / `night-spear-confrontation` | — |

完整循环分别为：

```text
B07 -> B01 -> B02 -> B03 -> B04 -> B05 -> B08 -> B09 -> B06 -> B11 -> B12 -> B15 -> B16 -> B07
S05 -> S04 -> S08 -> S01 -> S02 -> S03 -> S10 -> S05
```

当前 20 张 JPEG 合计 6,574,985 bytes（约 6.57 MB）、41,284,792 解码像素；最大双图过渡为 5,337,600 像素。图片不会在启动时全部解码，也不会进行相邻场景预取。

## 自行调整背景

推荐从仓库根目录运行交互管理器；它会列出当前播放位置，并引导完成新增、替换、移动或移出轮播：

```powershell
.\backgrounds.cmd
```

也可以直接执行命令：

```powershell
# 查看真实播放顺序、稳定槽位和未加入轮播但仍保留的文件
.\backgrounds.cmd list

# 替换现有图片；可使用槽位或场景 ID 定位
.\backgrounds.cmd replace -Target B05 -InputPath "D:\Pictures\my-battle.png" -Force

# 同时为项目/对话页设置该图的独立遮罩（0=无遮挡，1=完全遮罩）
.\backgrounds.cmd replace -Target B05 -InputPath "D:\Pictures\my-battle.png" -ThreadVeil 0.42 -Force

# 只调整播放位置，不重命名图片或槽位
.\backgrounds.cmd move -Target B07 -Position 1

# 在战斗组第 3 位新增图片；省略 Position 时追加到组尾
.\backgrounds.cmd add -Mode battle -Id my-battle -InputPath "D:\Pictures\new.jpg" -Position 3 -ThreadVeil 0.35

# 从轮播移除，图片文件仍保留在磁盘
.\backgrounds.cmd remove -Target my-battle -Force
```

管理器遵循以下边界：

1. `slot`（如 B07/S05）是稳定物理身份；`order` 是组内播放位置。移动场景只重排 `order`，不会交换槽位、文件名或场景 ID。
2. 活动清单只有 `themes/active.json`；战斗和风景组必须各保留至少一张，且两组 `order` 分别从 1 连续编号。
3. 新增/替换会调用有界图片准备脚本：源图不被修改，默认不放大，最大 1920×1080、JPEG 质量 90。可额外传入 `-Quality`、`-CropTop`、`-CropRight`、`-CropBottom`、`-CropLeft`；`-ThreadVeil 0..1` 单独控制该图在项目/对话页的均衡遮罩，不改变新建任务页固定 10% 遮罩。
4. 每次清单写入以及被覆盖的图片都会备份到 `.wukong-runtime/background-backups/`；移出轮播不会删除图片，`list` 会把它显示为 unlinked asset。
5. 修改后依次运行 `stop-theme.cmd`、`start-theme.cmd`，即可让同一个受管官方窗口重新载入资源，不需要重启 ChatGPT；只有受管调试通道本身已不存在时才需要退出并重开一次。
6. 准备公开提交前运行 `npm ci` 与 `npm run check`，确保图片数量、压缩字节、解码像素和双图过渡预算没有超限。

高级用户仍可直接编辑 `themes/active.json`。JSON 条目所在行不决定播放顺序；必须保持 `slot` 唯一、场景 `id` 唯一、每组 `order` 连续，并把可选 `threadVeil` 保持在 0..1。图库最多 24 项，当前已使用 41,284,792 / 48,000,000 解码像素，因此增加高分辨率图片前应先运行完整检查。

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
npm run test:backgrounds
npm run test:managed-package
npm run test:native
```

项目结构：

- `themes/active.json`：唯一活动主题清单。
- `themes/backgrounds/`：B/S 编号背景槽位。
- `runtime/`：renderer 注入、背景状态机、宿主与原生入口组件。
- `backgrounds.cmd`：交互式与命令行背景管理入口。
- `scripts/`：安装、启动、停用、打包与背景准备工具。
- `tests/`：资源预算、原生几何、生命周期和最小包合同。
- `docs/`：需求、设计、素材来源、历史决策和验收记录。

进一步阅读：[当前目标](docs/CURRENT_GOAL.md)、[设计说明](docs/DESIGN.md)、[需求与验收](docs/REQUIREMENTS.md)、[素材来源](docs/ASSET_SOURCES.md)。

## 素材、商标与侵权联系

本项目是独立、非官方的本地主题项目，与 OpenAI、Game Science 或《黑神话：悟空》的权利人不存在隶属、授权或背书关系。ChatGPT、Codex、《黑神话：悟空》及相关角色、商标、书法、截图和美术权利归各自权利人所有。

部分背景由维护者本人拍摄或自行截取，部分来自网络搜集或由用户提供，仅用于非商业主题展示。仓库不主张游戏画面、角色、美术或其他第三方内容的所有权，相关权利仍归各自权利人。若您是相关权利人并认为仓库内容侵犯了您的权利，请发送邮件至 **`chenlj89@mail2.sysu.edu.cn`**，维护者会核验并及时移除或更正。

详细来源和发布边界见 [docs/ASSET_SOURCES.md](docs/ASSET_SOURCES.md)。

## 许可证

代码按 [MIT License](LICENSE) 发布。第三方图片、商标、角色和其他素材不因代码许可证而获得再许可。
