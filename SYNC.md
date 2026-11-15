# SYNC.md — 上游同步策略与定制改动清单

## 上游来源

- 上游仓库: https://github.com/Dark-CC/Cloudreve-New
- 同步分支: `master`（唯一主线；上游仅在 tag 发版，日常提交直接进 master）
- 版本策略: 跟随上游 `v4.x.y` tag，不自行定义版本号；tag 由 sync-tags.yml 自动重放

## 同步方式

| 场景       | 处理方式                                                     |
| ---------- | ------------------------------------------------------------ |
| 无冲突     | 直接 ff-merge 推送到本仓库 master                            |
| 有冲突     | `-X theirs` 预合并到 `upstream-sync/auto` 分支，自动开 PR 人工核对 |
| 上游新 tag | tag 对应提交已进入 master 后，推送 tag 触发 release.yml 构建发布 |

## 本仓库定制改动清单（冲突时重点保护）

> 每次新增定制改动必须登记到此表，自动合并时此清单即人工核对依据。

| 文件/目录                           | 定制内容                     | 冲突策略                                                 |
| ----------------------------------- | ---------------------------- | -------------------------------------------------------- |
| `.github/workflows/sync-*.yml`      | 本同步机制自身               | ours（保留本地）                                         |
| `SYNC.md`                           | 本文档                       | ours                                                     |
| `README.md`                         | （如改了指向自己仓库的链接） | 人工核对                                                 |
| `Dockerfile` / `docker-compose.yml` | （如有镜像名/源改动）        | theirs（跟随上游），定制改为 docker-compose.override.yml |
| `web/`、`src/`                      | 上游功能主体                 | theirs 优先，本地定制应放独立文件                        |

## 定制改动的兼容保障（长期原则）

1. **隔离而非修改**：定制尽量新增文件/目录（如 `web/src/overrides/`、`docker-compose.override.yml`），不直接改上游文件。
2. **上游占主导路径**用 `.gitattributes` 声明 `merge=theirs`（需配合自定义 merge driver）或接受 `-X theirs` 结果后人工核对。
3. **构建即验证**：同步成功后 release.yml 会完整构建前端+后端+镜像，构建失败即同步失败，不会发布坏版本。
4. **金丝雀验证**（可选）：同步后先推 `:edge` 镜像标签，人工确认后再推 `latest` 与版本标签。
