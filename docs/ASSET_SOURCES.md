# 素材来源与发布边界

## V53 当前活动背景边界

活动 runtime 只从 `themes/active.json` 组装以下 20 个稳定物理槽位（13 张战斗图、7 张风景图）。`slot` 不随排序变化，B/S 两组分别按独立、连续的 `order` 循环，不使用随机牌堆；文件合计 `6,574,985 bytes`，解码总量 `41,284,792 px`，最大双图过渡 `5,337,600 px`。

| 槽位 | 播放位 | 场景 ID | 像素 | 字节 | 活动文件 | 来源类别 |
| --- | ---: | --- | ---: | ---: | --- | --- |
| B07 | 1 | `ink-wanderer` | 2560×1042 | 400,195 | `themes/backgrounds/battle-07.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B01 | 2 | `erlang-ink-duel` | 2560×1043 | 309,953 | `themes/backgrounds/battle-01.jpg` | 用户提供的既有活动图 |
| B02 | 3 | `great-sage-staff` | 1920×1080 | 341,165 | `themes/backgrounds/battle-02.jpg` | 用户本地既有活动图 |
| B03 | 4 | `storm-bearer` | 1920×1080 | 293,694 | `themes/backgrounds/battle-03.jpg` | 用户提供的既有活动图 |
| B04 | 5 | `shadow-confrontation` | 1920×1080 | 98,466 | `themes/backgrounds/battle-04.jpg` | 用户提供的既有活动图 |
| B05 | 6 | `training-sunset` | 1256×707 | 62,396 | `themes/backgrounds/battle-05.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B08 | 7 | `white-tiger` | 1920×1080 | 332,994 | `themes/backgrounds/battle-08.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B09 | 8 | `red-lightning` | 1920×1080 | 659,828 | `themes/backgrounds/battle-09.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B06 | 9 | `thunder-dragon-ascent` | 1920×980 | 357,973 | `themes/backgrounds/battle-06.jpg` | 2026-08-11 用户提供；可能来自网络搜集；仅裁去源图上下黑边 |
| B11 | 10 | `white-dragon-frost` | 1920×1080 | 416,627 | `themes/backgrounds/battle-11.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B12 | 11 | `bear-crush` | 1920×1080 | 551,165 | `themes/backgrounds/battle-12.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| B15 | 12 | `crimson-lightning-burst` | 1920×1080 | 342,914 | `themes/backgrounds/battle-15.jpg` | 2026-08-12 用户提供的替换图；替换同槽位上一版夜叉王背景；具体来源未单独断言 |
| B16 | 13 | `night-spear-confrontation` | 1920×1080 | 151,080 | `themes/backgrounds/battle-16.jpg` | 2026-08-12 用户提供；具体来源未单独断言 |
| S05 | 1 | `sunset-ravine` | 1920×1080 | 167,847 | `themes/backgrounds/scenery-05.jpg` | 用户提供的既有活动图 |
| S04 | 2 | `sunlit-mountain-vista` | 1920×1080 | 395,960 | `themes/backgrounds/scenery-04.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| S08 | 3 | `snow-lake` | 1920×1080 | 518,319 | `themes/backgrounds/scenery-08.jpg` | 2026-08-11 用户提供；可能来自网络搜集 |
| S01 | 4 | `ridge-gate` | 1920×1080 | 127,753 | `themes/backgrounds/scenery-01.jpg` | 用户提供的既有活动图 |
| S02 | 5 | `forest-shrine` | 1920×1080 | 256,950 | `themes/backgrounds/scenery-02.jpg` | 用户提供的既有活动图 |
| S03 | 6 | `mountain-path` | 1920×1080 | 391,525 | `themes/backgrounds/scenery-03.jpg` | 用户提供的既有活动图 |
| S10 | 7 | `verdant-cavern` | 1920×1080 | 398,181 | `themes/backgrounds/scenery-10.jpg` | 2026-08-12 用户提供；具体来源未单独断言 |

本轮保留 S10、以用户新图替换 B15，并新增 B16；它们只进行有界缩放和 JPEG 重编码，不进行生成式改画或调色，源图保持原位不变。图片本身不使用亮度、饱和度或对比度滤镜；新建任务页使用固定 10% 全屏遮罩（保留 90% 原图），项目/对话页则读取每张活动图自己的 `threadVeil`，针对素材亮暗逐图均衡可读性。该参数绑定图片和页面类型，不绑定战斗/风景序列。新建任务页自动使用战斗序列，项目/对话页自动使用风景序列；`Ctrl+Alt+C` 只在当前页面临时覆盖，进入另一页面恢复自动默认。运行时没有定时轮换。用户优先通过 `backgrounds.cmd` 管理新增、替换、移动和移出轮播；它把 `scripts/prepare-background.ps1` 作为低层确定性转码器，并在写清单或覆盖图片前建立本地备份。`add` / `replace` 的 `-ThreadVeil 0..1` 可校准项目/对话页遮罩。新的图片仍必须通过压缩字节、单图像素、图库总像素和双图过渡预算。

新建任务页的题字与“悟空”字标可由 `Ctrl+Alt+T` 同时隐藏或显示；折叠侧栏从屏幕边缘临时展开时，也与常驻侧栏一样使用透明主题表面。

部分背景由维护者本人拍摄或自行截取，部分来自网络搜集或由用户提供，仅用于非商业主题展示。游戏画面、角色、美术及其他第三方内容的著作权、商标权和其他权利仍归相应权利人所有。若权利人认为相关素材构成侵权，请发送邮件至 `chenlj89@mail2.sysu.edu.cn`；维护者核验后会及时处理或移除。

本轮移出活动清单的 B14、S09，以及此前移出的 B10、B13、S06、S07 文件仍原位保留（inactive retained），但不被 active/default 引用，也不会进入最小运行包。`themes/assets/destined-afterimage.jpg`、历史 `themes/assets/yaksha-king-rift.jpg` 和其他未链接素材同样不进入活动运行包；当前 B15 只引用 `themes/backgrounds/battle-15.jpg` 的用户替换图。

## 0.12.3 / V13.3 背景、新建页、输入框与动作证据

- V13.3 当时的 runtime 只发布 `themes/assets/` 中 4 张战斗图与 5 张风景图；当时 9 个活动源文件 SHA-256 均不同。现行 V53 清单以本文顶部 20 个稳定槽位及独立播放位为准。runtime 不读取本机素材目录，不进行网络请求或视频解码。含退役葫芦/旧宠物引用的 `themes/ink-mountain.json` 保留为历史文件，但不进入最小运行包。
- V8 composer 三案及上下文证据位于 `docs/design/composer-options/v8-black-myth-silhouette-study-20260723/`。这些是纯 UI 形状预览，不包含夜叉套、神锋或金箍棒的生成替身，不进入 0.12.3 最小运行包。
- 新建页旧 56×56 内联 SVG 短棍、墨尾与 V15 微缩金箍棒均已因卡通贴纸感或器物失真被用户否决；文件继续原位保留但 active theme 和最小包不再引用。
- V16 字标源为 Steam 官方 CDN 的 `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2358720/logo_2x.png`，项目内只读副本是 `themes/ui/v16/sources/steam-black-myth-wukong-logo-2x.png`，310,824 bytes，SHA-256 `9B627BEE5BE0DB718A837A5DDFE1D367E02577AA5DF6168A5774382AF2BC0FA0`。
- `scripts/build-landing-mark-v16.py` 只做确定性裁切、色阶映射、透明画布缩放与位置调整，输出 `landing-wukong-wordmark-light.webp` 和 `landing-wukong-wordmark-dark.webp`（均 336×336、约 25–34 KiB、可见边界 `282×191`）。运行时把双倍源绘制为 168×168 视觉层，可见约 141×96 px；原生 56×56 锚点与热区不变。游戏商标、书法与美术权利仍归原权利人；资源仅用于本地主题审稿与用户拥有环境中的非商业实现。
- `E:\GameRecord\Black Myth Wukong\图片\封面.png` 与 `金箍.jpg` 本轮只读用于观察黑底金绘、赤金箍纹和长棍比例；未新增复制或重编码文件。历史上被用户否决的 `themes/motifs/fanged-cyan-staff.png` 继续保留但不引用。
- 用户新录制源文件为 `E:\GameRecord\Black Myth Wukong\新汇总\Replay 2026-07-24 00-30-17.mkv`，142,279,116 bytes，SHA-256 `FCC257977C4A34C2AB2813D018770DDE17CD5E5CBCE1941AC7E207965C92A7E5`。源文件保持原位只读；所有 contact sheet、时间码和分析只能新增到项目 `artifacts/wukong-user-recording-audit-20260724T003017+0800/`。
- 该录像可用于跑动步频、支撑脚、躯干起伏、持棍惯性，以及背面棍花的剪影、脚步、重心和棍路连续性。棍花没有正面视角，不能证明正面握法、面部、厌火套正面或身体遮挡后的神锋结构，不能据此修补基础立绘。
- 本轮没有继续搜索、扫描或抽取其他本地视频；用户此前否决的视频结论保持不变。游戏安装目录、截图、模组、旧候选和录像均不得删除、移动或覆盖。

## 0.11.0 / V12 历史背景与组件审稿素材

- 活动背景只使用 `themes/assets/` 中已纳入项目的 11 张画面：6 张战斗场景和 5 张风景场景。用户本地 `E:\GameRecord\Black Myth Wukong\TipsImg` 与 `图片` 只作为审稿和场景筛选来源，不由 runtime 直接读取。
- 本轮只读素材索引与 contact sheet 位于 `artifacts/asset-audit-20260723/`。它们用于识别真实游戏器物、材质和构图，不等于获批 UI 资产。
- composer V1–V6 全部保留在 `docs/design/composer-options/`。V3/V4 把复杂装备压成不可识别的细边条；V5 是泛用棱角面板；V6 的夜叉案读成宝石徽章、金箍棒案读成科幻状态条。六版均为失败历史，不进入运行包。
- 后续 composer 不再承担夜叉套、神锋、金箍棒三件道具的微缩展示。夜叉套与神锋由小天命人完整承担，金箍棒由战斗背景完整承担；输入框只提炼本地原生游戏画面中“展开经卷、单侧墨蚀断口、断续细线、单枚铜铸焦点”的形状语言。不得用 imagegen 猜造装备细节，也不得把完整装备压成 64×8、22×18 或 40×40 的装饰碎片。
- 静态形状审查位于 `artifacts/black-myth-ui-shape-audit-20260723T232750/`：11 张精选来源均来自用户本地 `TipsImg` / `图片`，排除普通战斗画面，只用于设计研究。联系表和报告不进入最小运行包，源文件未删除、移动或覆盖。
- INART/游科/游戏截图只用于结构校准；第三方页面的攻略图不作为可再发布运行资产。项目发布的透明 UI 资产必须记录来源裁图、处理步骤、alpha 边缘与最终 hash。
- `D:\SteamLibrary\steamapps\common\BlackMythWukong` 只读审计未发现可直接使用的松散 PNG/JPG/视频；核心资源为签名 PAK，不修改、不替换、不绕过加密。`E:\GameRecord\Black Myth Wukong` 中用户自有录像和截图可复制到项目追加式审计目录并抽取连续动作帧，源文件始终原位保留。
- 本地模组索引中可见 `AS_Wukong_ComboA_q1_sprint`、`AS_Wukong_ComboC_q1_run` 与 `AS_Wukong_ComboC_q*_start/loop/end` 等真实动作族名称；这些名称只用于锁定跑动/棍花语义。用户已确认现有本地视频均不符合本次动作参考要求，因此停止扫描，等待用户后续录制。
- 天命人厌火套的官方主锚点为[黑神话 BLACKMYTH 官方微博](https://www.weibo.com/7972761955/Q5qbwbjOC)正文中的“天命人·夜叉王厌火套 1/12 收藏手办”。[INART Yaksha King 1/12](https://global.inart.studio/products/yaksha-king-1-12-action-figure)是夜叉王 Boss 本体，不是天命人厌火套，严禁再把它当作厌火绣衫、魔手或魔足依据。
- [BWIKI 厌火套装页](https://wiki.biligame.com/wukong/%E5%8E%8C%E7%81%AB%E5%A5%97%E8%A3%85)只用于交叉核对四件命名：厌火夜叉面、厌火绣衫、厌火魔手、厌火魔足；它是开放编辑的非官方来源。金箍棒动作结构可参考[INART 天命人 1/12](https://global.inart.studio/products/black-myth-wukong-the-destined-one-1-12)，但该手办也不是厌火套。

## 0.10.0 / V11 原生 Hatch Pet 参考

| 角色 / 装备 | 参考 | 使用边界 |
| --- | --- | --- |
| 小八戒 | [INART 官方授权《黑神话：悟空》Bajie 1/12](https://global.inart.studio/ja/products/bajie-twelfth-scale-figure)；只读研究副本位于 `artifacts/native-pets/little-bajie-v3-inart/references/` | 只用于核对灰棕猪脸、旧青衣、念珠、腰封、体态和九齿钉耙结构；官方宣传图不进入便携运行包，不宣称为本项目资产。 |
| 小悟空 | 用户指定的游科官方天命人夜叉套 1/12 手办宣传图；[黑神话 BLACKMYTH 官方衍生品发布](https://www.weibo.com/7972761955/Q5qbwbjOC)将其列为“天命人·夜叉王厌火套 1/12 收藏手办”；只读研究副本 `artifacts/reference-library/official-yaksha-figure-1-12.jpg` | 只用于核对厌火面、灰袍、妖臂/魔足不对称与旧化材质；宣传图不进入便携运行包。 |
| 厌火夜叉套 | `artifacts/reference-library/yanhuo-yaksha-set-wiki.png` | 只用于装备结构交叉核对，不直接贴入组件或宠物图集。 |
| 兽棍·神锋 | `artifacts/reference-library/beast-staff-shenfeng-icon.png` | 只用于核对兽首、獠牙、旧金和青绿氧化端部；最终宠物武器不得退化为金箍棒、枪或普通棍。 |

V11 最终角色图是基于上述视觉锚点生成并经 Hatch Pet 动画化的项目资产，不是 Game Science 或 INART 模型导出。被否决的基准、旧动画、色键中间件、透明帧与 QA 图全部保留在 `artifacts/native-pets/`，但只有通过 v2 验证与盲审的 `pet.json + spritesheet.webp` 才能进入运行包。页面样式层只发布湘妃葫芦 motif，不再打包静态悟空/八戒覆盖图。

最终发布选择为小八戒 candidate C 和小悟空 v7；二者的可提交 visual proof 位于 `docs/pets/`。运行包只携带项目生成的宠物图集、manifest、验证 JSON 与来源哈希证明，不携带 INART/游科宣传参考图。

## 0.9.0 / V10 活动伴随元素

| 文件 | 字节 | 来源、处理与用途 |
| --- | ---: | --- |
| `themes/motifs/pets/little-wukong-pet-v1-chroma.png` | 1,829,632 | 本轮图像生成的平面品红色键源；参考旧 V6 悟空与用户本地 `E:\GameRecord\Black Myth Wukong\TipsImg\Img_LoadTips_200003_B.png`。保留作可复现编辑证据，不进入最小包。 |
| `themes/motifs/pets/little-wukong-pet-v1.png` | 1,201,795 | 通过官方 imagegen skill 的 `remove_chroma_key.py` 自动取边缘键色，soft matte 18/82 与 spill cleanup 得到的透明 PNG；不进入最小包。 |
| `themes/motifs/pets/little-wukong-pet-v1.webp` | 142,866 | 活动透明宠物；保留猴脸、单根毛发、青玉旧甲、红绳和金棍，工作区左下安全位置。 |
| `themes/motifs/pets/little-bajie-pet-v1-chroma.png` | 2,150,124 | 本轮图像生成的平面品红色键源；参考旧 V6 八戒，明确要求传统九齿钉耙的九枚独立耙齿。保留，不进入最小包。 |
| `themes/motifs/pets/little-bajie-pet-v1.png` | 1,728,734 | 同一色键流程得到的透明 PNG；不进入最小包。 |
| `themes/motifs/pets/little-bajie-pet-v1.webp` | 202,024 | 活动透明宠物；保留野猪面部、鬃毛、旧青袍、念珠与九齿钉耙，工作区右下安全位置。 |
| `themes/motifs/xiangfei-gourd-icon.webp` | 10,650 | 继续使用游戏图标紧裁透明版；V10 不再只依附 composer，按页面放在新任务主视觉、环境卡脚部或工作区上缘。 |

活动发布包仍只携带 11 张 JPEG 与 3 张透明 WebP，共 **2,928,470 bytes**；chroma 与透明 PNG 作为仓库内 append-only 生成证据保留。完整提示词、参考图和去背参数见 [PET_GENERATION.md](PET_GENERATION.md)。

本轮没有把生成角色宣称为 Game Science 官方模型或设定图；它们是依据用户提供/指定的游戏画面重新生成的主题伴随资产。游戏角色、装备、画面与美术权利属于相应权利人。

## 0.8.0 运行时画廊

| 文件 | 像素 / 字节 | 来源与用途 |
| --- | --- | --- |
| `themes/assets/great-sage-return.jpg` | 1256 × 707 / 78,423 | 用户本地 `E:\\GameRecord\\Black Myth Wukong\\图片\\大圣归来.jpg`；0.8.0 历史战斗场景，文件保留，当前活动 runtime 不引用。 |
| `themes/assets/erlang-ink-duel.jpg` | 2560 × 1043 / 309,953 | 用户提供的白场水墨杨戬对决图 `codex-clipboard-62ae5e68-bad0-4a3c-aa72-97d2d4d87aa2.png`；替换被否决的旧杨戬背景。 |
| `themes/assets/great-sage-staff.jpg` | 1920 × 1080 / 341,165 | 用户本地 `E:\\GameRecord\\Black Myth Wukong\\图片\\金箍.jpg`；战斗境主场景之一。 |
| `themes/assets/yaksha-king-rift.jpg` | 1920 × 1080 / 267,415 | 用户提供 `codex-clipboard-92ab9198-6da0-49fc-9afe-590acee89f9c.jpg`；0.8.0 历史次级战斗场景，用户已否决，文件保留，当前活动 runtime 不引用。 |
| `themes/assets/storm-bearer.jpg` | 1920 × 1080 / 293,694 | 用户提供 `codex-clipboard-f90c91b3-0b8a-40a6-a288-578fcf8fac7e.jpg`；低频次级战斗场景。 |
| `themes/assets/shadow-confrontation.jpg` | 1920 × 1080 / 98,466 | 用户提供 `codex-clipboard-b49f0747-316a-461e-8ae9-0e838dd764b5.jpg`；低频次级战斗场景。 |
| `themes/assets/ridge-gate.jpg` | 1920 × 1080 / 127,753 | 用户提供 `codex-clipboard-9feb2815-c0fa-4ee5-a6d8-6a020bb3c2db.jpg`；风景境。 |
| `themes/assets/forest-shrine.jpg` | 1920 × 1080 / 256,950 | 用户提供 `codex-clipboard-75e29de6-e24c-4526-9b42-c917c108f022.png`；风景境。 |
| `themes/assets/mountain-path.jpg` | 1920 × 1080 / 391,525 | 用户提供 `codex-clipboard-44b19127-01d2-4e94-a2d1-477b5c2e4bbe.jpg`；风景境。 |
| `themes/assets/stone-buddhas.jpg` | 1920 × 1080 / 239,739 | 用户提供 `codex-clipboard-6aa1d89a-3e8d-4193-aca1-0d9e1a2a0e1b.jpg`；风景境。 |
| `themes/assets/sunset-ravine.jpg` | 1920 × 1080 / 167,847 | 用户提供 `codex-clipboard-d1f8f588-0972-4ccb-8bf8-2e1eb5a57520.png`；风景境。 |

新建任务页只从三张主战斗图（大圣、杨戬、金箍棒）选择；夜叉王与另外两张高张力画面为低频战斗补充。已进入对话只从五张纯风景图稳定选择。所有背景使用一个 fixed `cover` 平面，不并排、不留黑边、不重复叠图。

## 0.8.0 伴随元素

| 文件 | 像素 / 字节 | 来源、处理与边界 |
| --- | --- | --- |
| `themes/motifs/little-wukong-gameplay-v6.webp` | 508 × 768 / 76,266 | 以用户本地实机画面 `E:\\GameRecord\\Black Myth Wukong\\TipsImg\\Img_LoadTips_200003_B.png` 作为造型参考，通过图像生成得到绿幕角色中间件 `tmp/imagegen/little-wukong-gameplay-chroma.png`，再经本地色键透明化、边缘清理、紧裁和 WebP 压缩，保留青色鳞甲、猴脸、尾巴和棍势。不是 Game Science 模型导出或官方立绘；相关角色与游戏美术权利仍归原权利人。 |
| `themes/motifs/little-bajie-gameplay-v6.webp` | 509 × 768 / 78,038 | 以 [BWIKI 八戒实机截图](https://patchwiki.biligame.com/images/wukong/8/81/a5y269r2m0nhml7ll69afir51cj6hki.jpg) 为造型参考，并用 [八戒影神图](https://patchwiki.biligame.com/images/wukong/6/60/9yji4hm85t19qn4wea97geaadc99a9r.png) 核对旧青袍、念珠和九齿钉耙；通过图像生成得到绿幕角色中间件 `tmp/imagegen/little-bajie-gameplay-chroma.png`，再经本地色键透明化、边缘清理、紧裁和 WebP 压缩。不是 Game Science 模型导出或官方立绘；相关角色与游戏美术权利仍归原权利人。 |
| `themes/motifs/xiangfei-gourd-icon.webp` | 140 × 175 / 10,650 | 从 [BWIKI 湘妃葫芦游戏图标](https://patchwiki.biligame.com/images/wukong/c/c9/chawfoslfshdt8kci9q85zpfrid064e.png) 紧裁并透明化，保留青绿双节、银白泪痕、蓝绳和流苏；相关图像权利仍归原权利人。 |

三张透明伴随元素均不是 Game Science 官方模型导出，不应作为角色/装备设定图再次分发或宣称官方素材。用户提供、本地原始文件、首轮/V2/V3/V4/V5 候选和 PNG 编辑源均未被移动或删除。0.8.0 最小运行包只复制 11 张 JPEG 与上述 3 张 WebP，合计 2,737,884 bytes；无运行时网络请求、视频或 HUD 战绩页。`tmp/` 保留生成与研究副本，不进入正式运行包。

## 已停用但保留的 0.7.0 素材

| 文件 | 状态 |
| --- | --- |
| `themes/motifs/yaksha-set.png` | 用户否决；0.8.0 主题定义和最小包均不引用，文件保留作历史证据。 |
| `themes/motifs/fanged-cyan-staff.png` | 用户否决；0.8.0 主题定义和最小包均不引用，文件保留作历史证据。 |
| `themes/motifs/little-wukong.png/.webp` | 首轮候选成年感过重；不进入运行包，保留不删除。 |
| `themes/motifs/little-bajie.png/.webp` | 首轮候选武器与“小八戒”要求不符；不进入运行包，保留不删除。 |
| `themes/motifs/little-wukong-v2.png/.webp` | 第二轮仍呈泛化金甲贴纸感；不进入运行包，保留不删除。 |
| `themes/motifs/little-bajie-v2.png/.webp` | 第二轮仍缺少实机材质可信度；不进入运行包，保留不删除。 |
| `themes/motifs/little-wukong-gameplay.png/.webp`、`gameplay-clean`、`gameplay-v3`、`gameplay-v4`、`gameplay-v5` | 绿幕、边缘清理和透明阈值迭代；均不被主题定义引用，保留为过程证据。 |
| `themes/motifs/little-bajie-gameplay.png/.webp`、`gameplay-clean`、`gameplay-v3`、`gameplay-v4`、`gameplay-v5` | 绿幕、边缘清理和透明阈值迭代；均不被主题定义引用，保留为过程证据。 |
| `themes/motifs/xiangfei-gourd.png/.webp` | 早期大图候选；正式运行包只使用 `xiangfei-gourd-icon.webp`，旧文件保留。 |

## 历史素材记录（0.2.0）

| 文件 | 来源 | 技术信息 | 用途与权利说明 |
| --- | --- | --- | --- |
| `themes/assets/great-sage-return.jpg` | 用户提供的本地《黑神话：悟空》游戏截图，原路径 `E:\GameRecord\Black Myth Wukong\图片\大圣归来.jpg` | 1256 × 707，78,423 bytes | 用户明确授权本项目使用；游戏画面相关权利仍归原权利人。本项目不主张该截图或游戏角色权利。 |
| `assets/little-wayfarer.png` | 为本项目生成的原创通用小猴行者插画 | 透明 PNG | 不是游戏截图、模型提取或官方角色素材；仅用于 Studio 概念预览，0.3.0 原生主题不安装该文件。 |

选择 `大圣归来.jpg` 的原因不是分辨率最高，而是它在最低文件体积下提供了最强的前后景关系：左侧黑色近景自然形成内容留白，右侧大圣剪影与夕照形成明确焦点。主题用 CSS 遮罩将同一图复用为新建页和对话页，避免第二张大图的解码与内存成本。

## 本地视觉参考（不打包）

| 文件 | 提炼内容 | 发布边界 |
| --- | --- | --- |
| `E:\GameRecord\Black Myth Wukong\图片\11891心猿.jpg` | 战绩页的无框墨幕、放射圆盘、六点印记、细线信息层级 | 仅用于设计观察，不复制进运行包 |
| `E:\GameRecord\Black Myth Wukong\图片\金箍.jpg` | 熔金焦点、暗绿黑环境与棍势亮线 | 仅用于配色观察，不复制进运行包 |
| `E:\GameRecord\Black Myth Wukong\图片\封面.png` | 黑底金绘与朱砂小印的比例关系 | 仅用于配色观察，不复制进运行包 |

## 仅作来源指引

Studio 保留以下官方入口，但不会自动下载、缓存或再分发页面图片：

| 来源 | 入口 | 边界 |
| --- | --- | --- |
| Game Science | [黑神话：悟空官网](https://www.heishenhua.com/) | 官方素材权利仍归 Game Science。 |
| Steam | [Black Myth: Wukong 商店页](https://store.steampowered.com/app/2358720/Black_Myth_Wukong/) | 商店截图不因链接而获得再许可。 |
| PlayStation | [Black Myth: Wukong](https://www.playstation.com/en-us/games/black-myth-wukong/) | 平台与发行方素材不在本仓库二次分发。 |
| Xbox | [Black Myth: Wukong](https://www.xbox.com/en-us/games/store/black-myth-wukong/9p51d1h0t7cw) | 平台与发行方素材不在本仓库二次分发。 |

如未来替换为网络 1080p 以上素材，必须先记录直达来源、许可边界、像素尺寸和压缩后体积，再进入主题资产目录。
