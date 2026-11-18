# 构建与发布

## 依赖

- Go 1.26+（`go.mod` 声明 `go 1.26.0`）
- Node.js 20+，包管理器 pnpm 9（`web/pnpm-lock.yaml`）
- `zip`（打包静态资源）

## 1. 构建前端

```bash
cd web
pnpm install
npm_package_name=cloudreve-frontend npm_package_version=4.19.2 pnpm build
```

产品在 `web/build/`，其中 `version.json` 应为：

```json
{"name":"cloudreve-frontend","version":"4.19.2"}
```

## 2. 打包静态资源

服务端用 `fs.Sub(statics, "assets/build")` 读取，所以 zip 内**必须**保留
`assets/build/` 前缀：

```bash
cd web
rm -f ../src/application/statics/assets.zip
zip -r - assets/build > ../src/application/statics/assets.zip
```

压缩后的结构：

```text
assets/build/index.html
assets/build/version.json
assets/build/assets/...
```

直接压缩 `build/*` 会让首页返回 404。

## 3. 构建后端

```bash
cd src
CGO_ENABLED=0 go build -trimpath \
  -ldflags "-s -w \
    -X 'github.com/cloudreve/Cloudreve/v4/application/constants.BackendVersion=4.19.2' \
    -X 'github.com/cloudreve/Cloudreve/v4/application/constants.LastCommit=$(git rev-parse --short HEAD)' \
    -X 'github.com/cloudreve/Cloudreve/v4/application/constants.IsPro=false'" \
  -o ../cloudreve .
```

交叉编译只需设置 `GOOS` / `GOARCH`，无需 CGO。

## 4. 发布检查

1. `./cloudreve --version` 版本号与 `version.json` 一致；
2. 首页可打开，浏览器控制台无 404；
3. 启动日志无 `Static resource version mismatch`；
4. 二进制与源码 tag 对应，GPL-3.0 要求同时提供源码。

## 关于 goreleaser

`src/.goreleaser.yaml` 负责多平台构建与 GitHub Release 发布，产物命名与官方一致：

```text
cloudreve_<version>_<os>_<arch>.tar.gz   # linux / darwin / freebsd
cloudreve_<version>_windows_<arch>.zip
checksums.txt
```

构建矩阵覆盖 `linux / windows / darwin / freebsd` 与
`amd64 / arm64 / arm(v5,v6,v7) / loong64`，CGO 关闭，产物为静态二进制。

在本地试运行（不发布）：

```bash
cd src
goreleaser build --snapshot --clean
```

正式发布由 `.github/workflows/release.yml` 完成：推送形如 `v4.19.2` 的 tag 后，
工作流会先构建前端并打包 `assets.zip`，再调用 goreleaser 生成 Release，
同时构建并推送多架构容器镜像到 `ghcr.io/dark-cc/cloudreve-new`。

仓库只保留这一个工作流：普通提交不会触发任何 CI，Actions 页面只留下发版记录。
所有平台的编译都在 GitHub 的 runner 上完成，本地不需要安装 Go / Node。

## 发版流程

```bash
git tag v4.19.2
git push origin v4.19.2
```

若需要重跑某个已存在的 tag，可在 Actions 页面手动触发 `release` 工作流，
并填写 `tag` 与 `ref`（`ref` 指定用于编译的源码分支）。
