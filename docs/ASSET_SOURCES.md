# 素材来源与发布边界

## 当前活动背景边界

活动 runtime 只从 `themes/active.json` 组装以下 13 个稳定物理槽位（10 张战斗图、3 张风景图）。`slot` 不随排序变化，B/S 两组分别按独立、连续的 `order` 循环，不使用随机牌堆；文件合计 `3,944,596 bytes`，解码总量 `26,769,592 px`，最大双图过渡 `5,337,600 px`。

| 槽位 | 播放位 | 场景 ID | 像素 | 字节 | 活动文件 | 来源类别 |
| --- | ---: | --- | ---: | ---: | --- | --- |
| B07 | 1 | `ink-wanderer` | 2560×1042 | 400,195 | `themes/backgrounds/battle-07.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B01 | 2 | `erlang-ink-duel` | 2560×1043 | 309,953 | `themes/backgrounds/battle-01.jpg` | 用户提供的既有活动图 |
| B02 | 3 | `great-sage-staff` | 1920×1080 | 341,165 | `themes/backgrounds/battle-02.jpg` | 用户本地既有活动图 |
| B04 | 4 | `shadow-confrontation` | 1920×1080 | 98,466 | `themes/backgrounds/battle-04.jpg` | 用户提供的既有活动图 |
| B05 | 5 | `training-sunset` | 1256×707 | 62,396 | `themes/backgrounds/battle-05.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B08 | 6 | `white-tiger` | 1920×1080 | 332,994 | `themes/backgrounds/battle-08.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B09 | 7 | `red-lightning` | 1920×1080 | 659,828 | `themes/backgrounds/battle-09.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B06 | 8 | `thunder-dragon-ascent` | 1920×980 | 357,973 | `themes/backgrounds/battle-06.jpg` | 2026-08-11 用户提供；可能来自网络搜集；仅裁去源图上下黑边 |
| B11 | 9 | `white-dragon-frost` | 1920×1080 | 416,627 | `themes/backgrounds/battle-11.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B16 | 10 | `night-spear-confrontation` | 1920×1080 | 151,080 | `themes/backgrounds/battle-16.jpg` | 2026-08-12 用户提供；具体来源未单独断言 |
| S05 | 2 | `sunset-ravine` | 1920×1080 | 167,847 | `themes/backgrounds/scenery-05.jpg` | 用户提供的既有活动图 |
| S08 | 1 | `snow-lake` | 1920×1080 | 518,319 | `themes/backgrounds/scenery-08.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| S01 | 3 | `ridge-gate` | 1920×1080 | 127,753 | `themes/backgrounds/scenery-01.jpg` | 用户提供的既有活动图 |

当前风景按雪山、夕阳、峡谷循环。图片资产不使用亮度、饱和度或对比度滤镜；新建任务页不加阅读遮罩，对话页根据深浅模式和场景配置施加阅读衬底。深色对话的最低遮罩及文字材质由主题变量控制。运行时没有定时轮换。

开发者通过 `scripts/manage-backgrounds.ps1` 管理资源，写入前建立本地备份。新图片需通过字节、像素及双图过渡预算。下载包仅包含活动清单引用的图片，退役图片从 Git 历史恢复。

## 首页字标

新建任务页的题字与“悟空”字标可由 `Ctrl+Alt+T` 同时隐藏或显示。活动资产是 `themes/ui/v16/landing-wukong-wordmark-light.webp` 和 `landing-wukong-wordmark-dark.webp`，用于不同背景亮度的首页装饰。

源文件来自 [Steam 官方 CDN 的游戏字标](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2358720/logo_2x.png)，只读副本保存在 `themes/ui/v16/sources/steam-black-myth-wukong-logo-2x.png`，310,824 bytes，SHA-256 为 `9B627BEE5BE0DB718A837A5DDFE1D367E02577AA5DF6168A5774382AF2BC0FA0`。

`scripts/build-landing-mark-v16.py` 负责确定性裁切、色阶映射与透明画布缩放，输出两张 336×336 WebP。原图、构建脚本和活动资产保留可复现来源；源文件不进入下载包。游戏商标、书法与美术权利仍归原权利人。

## 材质与退役内容

输入框、侧栏、菜单和阅读表面使用 CSS 材质变量；旧纸张纹理、旧装饰清单、宠物及宠物制作工具已退出当前主题与下载包。当前源码不保留多套已失效材质方案。旧素材来源和历史制作过程从 Git 历史查询，本地恢复及实际删除状态见 `CLEANUP.md`。

运行时只读取项目中已纳入活动清单的资源，不扫描本机游戏目录，不发起网络图片请求，不解码视频。

## 权利与来源边界

部分背景由维护者本人拍摄或自行截取，部分来自网络搜集或由用户提供，仅用于非商业主题展示。游戏画面、角色、美术及其他第三方内容的著作权、商标权和其他权利仍归相应权利人所有。若权利人认为相关素材构成侵权，请发送邮件至 `chenlj89@mail2.sysu.edu.cn`；维护者核验后会及时处理或移除。

[黑神话：悟空官网](https://www.heishenhua.com/) 与 [Steam 商店页](https://store.steampowered.com/app/2358720/Black_Myth_Wukong/) 仅作来源指引，不代表获得额外再分发许可。未来新增图片应记录直达来源、许可边界、像素尺寸和压缩后体积，再加入活动清单。
