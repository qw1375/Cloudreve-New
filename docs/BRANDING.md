# 品牌与链接配置

Cloudreve-New 允许在不改代码的前提下调整对外展示的链接。

## 前端构建变量

复制 `web/.env.example` 为 `web/.env.local`，按需填写：

| 变量 | 作用 | 默认值 |
| --- | --- | --- |
| `VITE_REPO_URL` | 管理端首页的仓库链接、"了解更多"按钮 | `https://github.com/Dark-CC/Cloudreve-New` |
| `VITE_HOME_URL` | 管理端首页的"主页"入口 | 同 `VITE_REPO_URL` |
| `VITE_DOCS_URL` | "文档"入口 | `<repo>#readme` |
| `VITE_DISCUSSION_URL` | "社区论坛"入口 | `<repo>/discussions` |
| `VITE_GISCUS_*` | 管理端首页公告板；留空时显示"暂无公告" | 空 |

变量在 `pnpm build` 时写入产物，因此修改后必须重新构建前端并重新打包
`src/application/statics/assets.zip`。

## 站点名称与图标

站点名称、Logo、图标在**管理端 → 参数设置 → 站点信息**中配置，与上游一致，
不需要改代码。默认展示的名称来自 `src/inventory/setting.go` 中的
`siteTitle` 默认值。

## 版本号

后端版本由 `-ldflags` 注入：

```bash
-X 'github.com/cloudreve/Cloudreve/v4/application/constants.BackendVersion=4.19.2'
```

前端 `version.json` 中的 `version` 必须与之完全一致，否则启动日志会提示
静态资源版本不一致。`name` 必须为 `cloudreve-frontend`。
