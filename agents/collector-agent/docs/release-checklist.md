# Collector Agent `v0.1.1` GitHub Release 清单

## 1. 发布前确认

- 当前分支工作区干净：`git status --short`
- 版本位已经同步到 `v0.1.1`：
  - `apps/frontend-console/public/config/app-config.json`
  - `apps/frontend-console/src/config/runtime-config.ts`
  - `agents/collector-agent/cmd/agent/main.go`
  - `agents/collector-agent/deploy/systemd/collector-agent.env.example`
  - `agents/collector-agent/deploy/docker/docker-compose.agent.yml`
  - `agents/collector-agent/docs/install-dual-mode.md`
- 一键安装地址计划使用：
  - `https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-installer.sh`
- 默认容器镜像计划使用：
  - `ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.1`

## 2. 本地校验命令

在仓库根目录执行：

```bash
pnpm --dir apps/frontend-console exec vitest --run tests/runtimeConfig.test.ts
pnpm --dir apps/frontend-console exec tsc -b

go test ./services/control-plane/internal/ingest/...

bash -n agents/collector-agent/scripts/install-release.sh
bash -n agents/collector-agent/scripts/package-agent.sh
bash -n agents/collector-agent/scripts/package-release-assets.sh
bash agents/collector-agent/scripts/package-release-assets.sh
```

校验通过后，确认以下产物存在：

```bash
ls -lh agents/collector-agent/dist/
sha256sum agents/collector-agent/dist/collector-agent-linux-amd64.tar.gz
sha256sum agents/collector-agent/dist/collector-agent-linux-arm64.tar.gz
sha256sum agents/collector-agent/dist/collector-agent-installer.sh
```

## 3. 推送 Git 标签

```bash
git push origin main
git tag v0.1.1
git push origin v0.1.1
```

推送标签后，会触发：

- `collector-agent-release`：上传 Release 安装包与脚本资产
- `Docker Build & Security Scan`：构建并推送 `collector-agent` 的 GHCR 镜像标签

## 4. GitHub Release 结果检查

打开 GitHub 仓库的 Actions 与 Releases 页面，确认：

- `collector-agent-release` 成功
- `Docker Build & Security Scan` 成功，且包含 `collector-agent`
- Release 资产已上传：
  - `collector-agent-linux-amd64.tar.gz`
  - `collector-agent-linux-arm64.tar.gz`
  - `collector-agent-installer.sh`
  - `collector-agent-checksums.txt`
- GHCR 镜像标签可见：
  - `ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.1`

## 5. 发布后冒烟验证

### 5.1 安装脚本可下载

```bash
curl -I https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-installer.sh
curl -I https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-linux-amd64.tar.gz
```

### 5.2 一键部署命令可执行

在一台 Linux 测试机执行：

```bash
if [ "$(id -u)" -eq 0 ]; then
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-installer.sh' | env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='smoke-agent' \
    AGENT_VERSION='v0.1.1' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    COLLECTOR_INCLUDE_PATHS='/var/log/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"smoke","source_type":"custom"},"pattern":"/var/log/*.log"}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
else
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-installer.sh' | sudo env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='smoke-agent' \
    AGENT_VERSION='v0.1.1' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    COLLECTOR_INCLUDE_PATHS='/var/log/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"smoke","source_type":"custom"},"pattern":"/var/log/*.log"}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
fi
```

安装后检查：

```bash
systemctl status collector-agent --no-pager
curl http://127.0.0.1:9091/healthz
curl -H 'X-Agent-Key: replace-with-strong-key' http://127.0.0.1:9091/agent/v1/meta
```

## 6. 控制台验收

- 打开接入向导，确认默认版本显示为 `v0.1.1`
- 生成 Linux systemd 脚本，确认：
  - 安装脚本地址为 `.../v0.1.1/collector-agent-installer.sh`
  - 二进制资产地址为 `.../v0.1.1/collector-agent-linux-amd64.tar.gz`
  - GHCR 镜像为 `ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.1`
- 使用新 Agent URL 完成采集源接入

## 7. 回滚预案

如需撤回默认版本：

- 删除 Git 标签：`git tag -d v0.1.1`
- 删除远端标签：`git push origin :refs/tags/v0.1.1`
- 在 GitHub Release 页面删除错误资产
- 将前端运行时配置中的默认版本改回上一版并重新部署控制台
