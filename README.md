# Cloudreve-New

[![License: GPL-3.0](https://img.shields.io/badge/license-GPL--3.0-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Dark-CC/Cloudreve-New?include_prereleases&sort=semver)](https://github.com/Dark-CC/Cloudreve-New/releases)
[![Release](https://github.com/Dark-CC/Cloudreve-New/actions/workflows/release.yml/badge.svg)](https://github.com/Dark-CC/Cloudreve-New/actions/workflows/release.yml)
[![Docker](https://img.shields.io/badge/ghcr.io-cloudreve--new-2496ed?logo=docker&logoColor=white)](https://github.com/Dark-CC/Cloudreve-New/pkgs/container/cloudreve-new)

[English](#english) · [中文](#中文)

Cloudreve-New 是基于 [Cloudreve](https://github.com/cloudreve/Cloudreve) v4 社区版源码构建的
自托管网盘增强分支。它在保留社区版架构、数据模型与 API 兼容性的前提下，补齐了原社区版
缺失的商业功能（滥用举报、审计日志、SSO、增值服务/支付/积分、分享 ACL、组多存储策略、
负载均衡、归档迁移等），并让前端布局与管理端交互与官方 Pro 版保持一致。

> **本项目是非官方分支，与 Cloudreve 官方无任何关联，也不是 Pro 版的替代授权。**
> 项目不包含、不分发、不反编译任何 Pro 版本的二进制或前端资源。

## 功能

在原社区版基础上新增或补齐：

- **滥用举报**：用户端提交、管理端筛选/详情/批量软删除、验证码开关
- **审计日志 / 事件**：文件与目录创建、重命名、删除等事件落库与检索
- **SSO / OpenID Connect**：PKCE + state + nonce，一次性 ticket 兑换，绑定与解绑
- **增值服务**：积分、礼品码、存储包、订单、支付回调与事件
- **分享细粒度 ACL**：用户/用户组/内置受众，含 `/share/info` 脱敏
- **组多存储策略与负载均衡**：分组绑定策略、策略切换、负载均衡配置
- **归档 / 解压 / 导入 / 迁移工作流**的统一校验
- **站点公告、默认分享快捷方式、邮件模板、默认置顶**等 Pro 设置项
- 管理端页面布局、字段、图标与 Pro 对齐（**不含**授权/许可证销售相关页面）

## 快速开始

### 下载预编译版本

前往 [Releases](https://github.com/Dark-CC/Cloudreve-New/releases) 下载对应平台的压缩包：

```text
cloudreve_<version>_linux_amd64.tar.gz
cloudreve_<version>_linux_arm64.tar.gz
cloudreve_<version>_linux_armv5.tar.gz
cloudreve_<version>_linux_armv6.tar.gz
cloudreve_<version>_linux_armv7.tar.gz
cloudreve_<version>_linux_loong64.tar.gz
cloudreve_<version>_windows_amd64.zip
cloudreve_<version>_windows_arm64.zip
cloudreve_<version>_darwin_arm64.tar.gz
cloudreve_<version>_darwin_amd64.tar.gz
cloudreve_<version>_freebsd_amd64.tar.gz
cloudreve_<version>_freebsd_arm64.tar.gz
checksums.txt
```

校验下载（Linux / macOS）：

```bash
sha256sum -c checksums.txt --ignore-missing
```

解压后直接运行，压缩包内为单个静态二进制 `cloudreve`（Windows 为 `cloudreve.exe`），
无需额外运行时依赖：

```bash
tar -xzf cloudreve_4.19.2_linux_amd64.tar.gz
chmod +x cloudreve
./cloudreve -c data/conf.ini server
```

### Docker

```bash
docker run -d --name cloudreve \
  -p 5212:5212 -p 6888:6888 -p 6888:6888/udp \
  -v $(pwd)/data:/cloudreve/data \
  ghcr.io/dark-cc/cloudreve-new:latest
```

或使用仓库内的 `docker-compose.yml`：

```bash
docker compose up -d
```

### 直接运行

```bash
./cloudreve -c data/conf.ini server
```

默认监听 `:5212`，首次启动会创建 `data/` 目录与 SQLite 数据库，并在控制台输出管理员账号。

### 从源码构建

需要 Go 1.26+ 与 Node.js 20+（或 pnpm / yarn）。

```bash
# 1. 构建前端
cd web
pnpm install
pnpm build            # 产物在 web/build

# 2. 打包静态资源（必须保留 assets/build/ 层级）
cd ..
mkdir -p src/application/statics
cd web && zip -r - assets/build > ../src/application/statics/assets.zip

# 3. 构建后端（静态资源会被 embed 进二进制）
cd ../src
CGO_ENABLED=0 go build -trimpath \
  -ldflags "-s -w -X 'github.com/cloudreve/Cloudreve/v4/application/constants.IsPro=false'" \
  -o ../cloudreve .
```

> `assets.zip` 内必须是 `assets/build/index.html`，直接压缩 `build/*` 会导致首页 404。
> `version.json` 需为 `{"name":"cloudreve-frontend","version":"<后端版本>"}`，否则会提示静态资源版本不一致。

### 自行构建镜像

```bash
docker build -t cloudreve-new:local .
```

仓库根目录的 `Dockerfile` 会依次构建前端、嵌入静态资源、编译后端，最终镜像基于 Alpine。

### 发布新版本

所有平台产物与容器镜像都由 GitHub Actions 构建，本地无需安装 Go/Node 工具链：

```bash
git tag v4.19.3
git push origin v4.19.3
```

推送 tag 后，`.github/workflows/release.yml` 会自动构建 12 个平台的二进制、
发布 Release 并推送多架构镜像到 `ghcr.io/dark-cc/cloudreve-new`。
日常提交不会触发任何 CI，Actions 页面只保留发版记录。

## 配置

配置文件默认位于 `data/conf.ini`，支持 SQLite、PostgreSQL、MySQL。
生产部署建议使用 PostgreSQL 或 MySQL，并把 `data/` 目录放在独立磁盘上。

## 与官方版本的关系

| 项目 | 说明 |
| --- | --- |
| 上游 | [cloudreve/Cloudreve](https://github.com/cloudreve/Cloudreve)（GPL-3.0） |
| 本分支 | 在社区版源码上补齐功能，非官方发布 |
| Pro 资源 | **不包含**。所有 Pro 专有的二进制、前端 bundle、许可证逻辑均未使用 |
| 版本号 | 跟随上游 `4.19.x`，功能差异见上表 |

升级上游时请先阅读 `NOTICE` 与提交历史，避免与本地补丁冲突。

## 参与贡献

欢迎提交 Issue 与 PR。提交前请：

1. 确认改动不与 GPL-3.0 冲突；
2. 不提交任何生产数据、密钥、Pro 二进制或解包资源；
3. 前后端改动尽量配套，并附上复现/验证步骤。

## 许可证

本项目继承上游的 **GNU General Public License v3.0**，详见 [LICENSE](LICENSE)。
依据 GPL-3.0，任何分发本项目的二进制时都必须同时提供完整对应源码。

---

## English

Cloudreve-New is an unofficial fork of the [Cloudreve](https://github.com/cloudreve/Cloudreve) v4
community source tree. It keeps the upstream architecture, data model, and API surface while adding
the commercial features missing from the community edition (abuse reports, audit logs, SSO, VAS /
payments / credits, share ACLs, per-group storage policies, load balancing, archive workflows), and
aligns the admin UI with the official Pro layout.

**This project is not affiliated with Cloudreve and ships no Pro binaries, bundles, or license logic.**

### Build

```bash
cd web && pnpm install && pnpm build
mkdir -p ../src/application/statics
zip -r - assets/build > ../src/application/statics/assets.zip
cd ../src && CGO_ENABLED=0 go build -trimpath -o ../cloudreve .
```

### License

GPL-3.0. See [LICENSE](LICENSE). Redistributing binaries requires publishing the corresponding source.
