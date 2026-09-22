# 开发与打包

## 运行源码

Windows 上双击根目录 start.cmd。实际启动由 scripts/start.ps1 处理，定位官方包并使用其嵌入式 Node；普通用户不需要 npm。

## 验证

开发环境使用 Node.js 与 npm：

```powershell
npm ci
npm run check
npm run test:e2e
```

部分原生客户端合同要求 Windows 和匹配的已安装官方版本。历史跳过项不代表当前页面已验收；见 VALIDATION.md。

## 生成用户下载目录

目的目录必须不存在，且位于源码目录之外：

```powershell
node scripts/package-runtime.mjs --source . --destination ../Wukong-Codex-Theme
```

默认输出 start.cmd、使用说明.txt、app 三项。app 内仅复制活动清单引用的资源与必要运行文件。打包完成后将整个 Wukong-Codex-Theme 文件夹压缩为 ZIP；解压必须保留此结构。

内部测试需要平铺运行布局时，可显式增加 --layout runtime。这不是第二个面向用户的启动入口。

只构建目录不代表已经发布；上传 Release、设置版本及变更记录需单独执行。不要将 Source code 压缩包当作简化运行包。

## 源码与本地材料

宠物文件和历史截图保留本地但已取消跟踪。测试需使用索引导出的独立源码验证，避免本地材料遮盖缺失依赖。现役测试依赖的 V23/V24/V30/V31 证据暂保留，其他旧截图不作为当前效果证明。
