# Collector Agent `v0.1.3` GitHub Release 清单

## 1. 发布前确认

- 当前分支工作区干净：`git status --short`
- 版本位已经同步到 `v0.1.3`：
  - `apps/frontend-console/public/config/app-config.json`
  - `apps/frontend-console/src/config/runtime-config.ts`
  - `agents/collector-agent/cmd/agent/main.go`
  - `agents/collector-agent/deploy/systemd/collector-agent.env.example`
  - `agents/collector-agent/deploy/docker/docker-compose.agent.yml`
  - `agents/collector-agent/docs/install-dual-mode.md`
- 一键安装地址计划使用：
  - `https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh`
- 默认容器镜像计划使用：
  - `ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.3`
- 本版默认日志传输模式为：
  - `被动拉取（pull）`
- 本版可选日志传输模式为：
  - `主动上传（Kafka 兼容，脚本映射为 DELIVERY_MODE=dual）`

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
git tag v0.1.3
git push origin v0.1.3
```

推送标签后，会触发：

- `collector-agent-release`：上传 Release 安装包与脚本资产
- `Docker Build & Security Scan`：构建并推送 `collector-agent` 的 GHCR 镜像标签

## 3.1 Release 说明文案

可直接将 `agents/collector-agent/docs/release-notes-v0.1.3.md` 的内容粘贴到 GitHub Release 页面。

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
  - `ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.3`

## 5. 发布后冒烟验证

### 5.1 安装脚本可下载

```bash
curl -I https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh
curl -I https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz
```

### 5.2 默认被动拉取命令可执行

在一台 Linux 测试机执行：

```bash
if [ "$(id -u)" -eq 0 ]; then
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh' | env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='smoke-agent-pull' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='pull' \
    ENABLE_KAFKA_PIPELINE='false' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"smoke","source_type":"custom"},"pattern":"/var/log/**/*.log"}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
else
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh' | sudo env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='smoke-agent-pull' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='pull' \
    ENABLE_KAFKA_PIPELINE='false' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"smoke","source_type":"custom"},"pattern":"/var/log/**/*.log"}]' \
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

### 5.3 主动上传模板检查

至少确认主动上传模板包含以下变量：

- `DELIVERY_MODE='dual'`
- `ENABLE_KAFKA_PIPELINE='true'`
- `KAFKA_BROKERS='...'`
- `KAFKA_TOPIC='...'`
- `KAFKA_SCHEMA_REGISTRY_URL='...'`
- `KAFKA_SCHEMA_SUBJECT='...'`
- `KAFKA_REQUIRED_ACKS='...'`

如冒烟环境具备 Kafka / Schema Registry，也可直接执行主动上传模板并检查 Agent 进程正常启动。

## 6. 控制台验收

- 打开接入向导，确认默认版本显示为 `v0.1.3`
- 进入“日志传输模式”，确认：
  - 默认显示 `被动拉取（默认）`
  - 切换到 `主动上传（Kafka 兼容）` 后会展开 Kafka 配置表单
- 生成 Linux systemd 脚本，确认：
  - 安装脚本地址为 `.../v0.1.3/collector-agent-installer.sh`
  - 二进制资产地址为 `.../v0.1.3/collector-agent-linux-amd64.tar.gz`
  - GHCR 镜像为 `ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.3`
  - 默认模式脚本包含 `DELIVERY_MODE='pull'`
  - 主动上传脚本包含 `DELIVERY_MODE='dual'` 与 Kafka 环境变量
- 使用新 Agent URL 完成采集源接入

## 7. 回滚预案

如需撤回默认版本：

- 删除 Git 标签：`git tag -d v0.1.3`
- 删除远端标签：`git push origin :refs/tags/v0.1.3`
- 在 GitHub Release 页面删除错误资产
- 将前端运行时配置中的默认版本改回上一版并重新部署控制台
