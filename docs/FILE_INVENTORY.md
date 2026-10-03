# 文件结构

## 用户下载包

| 项目 | 用途 |
| --- | --- |
| start.cmd | 唯一启动入口 |
| 使用说明.txt | 中文启动步骤、快捷键、常见问题 |
| app/ | 运行脚本、主题资源、清单、许可证；请勿拆分 |

运行所需 Node 由已安装的官方客户端提供。`scripts/package-runtime.mjs` 通过运行文件白名单和 `themes/active.json` 的实际资产引用生成下载包。

## 当前源码

| 目录 | 用途 |
| --- | --- |
| runtime/ | 原生语义适配接口、主题注入、背景生命周期、还原及 CSS |
| scripts/ | 启动、打包、活动字标构建和现役诊断工具 |
| shared/ | 主题模型、可配置材质与资源清单生成 |
| themes/ | 活动背景、首页字标和原生主题定义 |
| studio/ | 主题开发预览，不进入运行包 |
| tests/ | 回归与原生合同测试，不进入运行包 |
| docs/ | 使用说明、适配边界、资源来源、验证和最新发行说明 |

测试读取当前源码与动态夹具，原生表面检查读取已安装客户端。过时截图和验收 JSON 已退出测试输入。

`runtime/native-ui-contract.mjs` 集中原生绘制边界；`themes/active.json` 维护活动图片、首页字标与可选材质。现役接口说明统一在 [native-surface-adaptation.md](native-surface-adaptation.md)，开发状态与正式版本的区别见 [CURRENT_GOAL.md](CURRENT_GOAL.md)。

## 本地与历史材料

`artifacts/`、`.wukong-runtime/`、`release/` 与临时输出不进入发行包。宠物制作材料已取消跟踪；已将清单内宠物、旧诊断及 Archives 存档集中到仓库外的待手动删除目录，迁移哈希核对通过。永久删除仍由用户执行，原位置可能留下空目录。清理状态见 `CLEANUP.md`。

旧方案、旧测试和早期发行说明通过 Git 历史恢复。已发布 GitHub Releases 保留，不作为现役源码依赖。
