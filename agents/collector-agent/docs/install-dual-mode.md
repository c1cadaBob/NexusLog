# Collector Agent 双安装模式（7.4）

本文档提供 `预编译二进制 + systemd` 与 `Docker` 两种安装方式，均不依赖远端 Go/GCC 编译工具；其中日志传输又分为 **被动拉取（默认）** 与 **主动上传（Kafka 兼容）** 两种模式。

## 1. 预编译打包

在构建机执行：

```bash
cd /opt/projects/NexusLog/agents/collector-agent
bash scripts/package-release-assets.sh
```

输出产物：

- `dist/collector-agent-linux-amd64/collector-agent`
- `dist/collector-agent-linux-amd64.tar.gz`
- `dist/collector-agent-linux-arm64.tar.gz`
- `dist/collector-agent-installer.sh`
- `dist/collector-agent-checksums.txt`

如果只需要单架构本地包，也可以继续执行：

```bash
cd /opt/projects/NexusLog/agents/collector-agent
bash scripts/package-agent.sh
```

## 2. GitHub Release 发布

仓库已提供 `.github/workflows/collector-agent-release.yml`，在推送 `v*` 标签后会自动上传以下 GitHub Release 资产：

- `collector-agent-linux-amd64.tar.gz`
- `collector-agent-linux-arm64.tar.gz`
- `collector-agent-installer.sh`
- `collector-agent-checksums.txt`

前端接入向导可通过运行时配置中的 `collectorAgent.releaseBaseUrl` 与 `collectorAgent.installScriptUrl` 直接生成一键安装命令。

正式发布前，可按 `agents/collector-agent/docs/release-checklist.md` 执行完整检查与发版流程。

## 3. 模式 A：预编译二进制 + systemd

### 3.1 一键安装（被动拉取，默认）

在目标 Linux 主机执行：

```bash
if [ "$(id -u)" -eq 0 ]; then
  curl -fsSL 'https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-installer.sh' | env \
    ASSET_URL='https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:8080' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='pull' \
    ENABLE_KAFKA_PIPELINE='false' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log,/data/app/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='/var/log/wtmp' \
    COLLECTOR_PATH_LABEL_RULES='[{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx","env":"prod"}}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo 'sudo is required when not running as root' >&2
    exit 1
  fi
  curl -fsSL 'https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-installer.sh' | sudo env \
    ASSET_URL='https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:8080' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='pull' \
    ENABLE_KAFKA_PIPELINE='false' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log,/data/app/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='/var/log/wtmp' \
    COLLECTOR_PATH_LABEL_RULES='[{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx","env":"prod"}}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
fi
```

### 3.2 一键安装（主动上传 / Kafka 兼容）

```bash
if [ "$(id -u)" -eq 0 ]; then
  curl -fsSL 'https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-installer.sh' | env \
    ASSET_URL='https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:8080' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='dual' \
    ENABLE_KAFKA_PIPELINE='true' \
    KAFKA_BROKERS='10.0.0.10:9092' \
    KAFKA_TOPIC='nexuslog.logs.raw' \
    KAFKA_SCHEMA_REGISTRY_URL='http://schema-registry:8081' \
    KAFKA_SCHEMA_SUBJECT='nexuslog.logs.raw-value' \
    KAFKA_REQUIRED_ACKS='all' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log,/data/app/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='/var/log/wtmp' \
    COLLECTOR_PATH_LABEL_RULES='[{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx","env":"prod"}}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo 'sudo is required when not running as root' >&2
    exit 1
  fi
  curl -fsSL 'https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-installer.sh' | sudo env \
    ASSET_URL='https://github.com/<owner>/<repo>/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:8080' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='dual' \
    ENABLE_KAFKA_PIPELINE='true' \
    KAFKA_BROKERS='10.0.0.10:9092' \
    KAFKA_TOPIC='nexuslog.logs.raw' \
    KAFKA_SCHEMA_REGISTRY_URL='http://schema-registry:8081' \
    KAFKA_SCHEMA_SUBJECT='nexuslog.logs.raw-value' \
    KAFKA_REQUIRED_ACKS='all' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log,/data/app/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='/var/log/wtmp' \
    COLLECTOR_PATH_LABEL_RULES='[{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx","env":"prod"}}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
fi
```

安装脚本会自动完成以下动作：

- 下载并解压 Release 包
- 安装 `/usr/local/bin/collector-agent`
- 写入 `/opt/nexuslog/collector-agent/configs`
- 写入 `/etc/nexuslog/collector-agent.env`
- 安装并启动 `collector-agent.service`
- 为 systemd 服务附加只读日志能力，避免再手动加组/改 ACL
- 自动探测 `CONTROL_PLANE_BASE_URL` 可达性，不可达时关闭指标回传避免持续报错

### 3.3 远端目录与用户

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin collector || true
sudo mkdir -p /opt/nexuslog/collector-agent /etc/nexuslog /var/lib/collector-agent/{checkpoints,cache}
sudo chown -R collector:collector /opt/nexuslog/collector-agent /var/lib/collector-agent
```

### 3.4 安装文件

```bash
sudo cp collector-agent /usr/local/bin/collector-agent
sudo chmod +x /usr/local/bin/collector-agent
sudo cp -r configs /opt/nexuslog/collector-agent/
sudo cp deploy/systemd/collector-agent.service /etc/systemd/system/
sudo cp deploy/systemd/collector-agent.env.example /etc/nexuslog/collector-agent.env
```

可按需编辑 `/etc/nexuslog/collector-agent.env`：

```bash
COLLECTOR_INCLUDE_PATHS=/var/log/**/*.log,/data/app/**/*.log
COLLECTOR_EXCLUDE_PATHS=/var/log/wtmp,/data/app/debug-*.log
COLLECTOR_PATH_LABEL_RULES=[{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx","env":"prod"}},{"pattern":"/data/app/**/*.log","labels":{"service":"app","env":"prod"}}]

# 默认被动拉取
DELIVERY_MODE=pull
ENABLE_KAFKA_PIPELINE=false

# 如需切换为主动上传（Kafka 兼容），改为：
# DELIVERY_MODE=dual
# ENABLE_KAFKA_PIPELINE=true
# KAFKA_BROKERS=10.0.0.10:9092
# KAFKA_TOPIC=nexuslog.logs.raw
# KAFKA_SCHEMA_REGISTRY_URL=http://schema-registry:8081
# KAFKA_SCHEMA_SUBJECT=nexuslog.logs.raw-value
# KAFKA_REQUIRED_ACKS=all
```

### 3.5 启动与验证

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now collector-agent
sudo systemctl status collector-agent --no-pager
curl -s http://127.0.0.1:9091/healthz
curl -s -H 'X-Agent-Key: replace-with-strong-key' http://127.0.0.1:9091/agent/v1/meta
```

如启用了主动上传模式，还应补充检查 Kafka / Schema Registry 连通性。

## 4. 模式 B：Docker 运行

```bash
cd deploy/docker
mkdir -p configs state/checkpoints state/cache
cp ../../configs/agent.yaml ./configs/agent.yaml
docker compose -f docker-compose.agent.yml up -d
docker compose -f docker-compose.agent.yml ps
curl -s http://127.0.0.1:9091/healthz
curl -s -H 'X-Agent-Key: replace-with-strong-key' http://127.0.0.1:9091/agent/v1/meta
```

可在 `docker-compose.agent.yml` 中独立配置容器采集范围与传输模式。

### 4.1 Docker 默认被动拉取

```yaml
environment:
  DELIVERY_MODE: "pull"
  ENABLE_KAFKA_PIPELINE: "false"
  COLLECTOR_INCLUDE_PATHS: "/var/log/**/*.log,/host-data/logs/**/*.log"
  COLLECTOR_EXCLUDE_PATHS: "/var/log/wtmp,/host-data/logs/debug-*.log"
  COLLECTOR_PATH_LABEL_RULES: '[{"pattern":"/host-data/logs/nginx*.log","labels":{"service":"nginx","env":"prod"}}]'
```

### 4.2 Docker 切换为主动上传（Kafka 兼容）

```yaml
environment:
  DELIVERY_MODE: "dual"
  ENABLE_KAFKA_PIPELINE: "true"
  KAFKA_BROKERS: "kafka:9092"
  KAFKA_TOPIC: "nexuslog.logs.raw"
  KAFKA_SCHEMA_REGISTRY_URL: "http://schema-registry:8081"
  KAFKA_SCHEMA_SUBJECT: "nexuslog.logs.raw-value"
  KAFKA_REQUIRED_ACKS: "all"
```

## 5. 回滚与停机

- systemd：`sudo systemctl stop collector-agent`
- Docker：`docker compose -f docker-compose.agent.yml down`
