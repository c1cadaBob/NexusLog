# Collector Agent v0.1.3 Release Notes

> 建议 GitHub Release 标题：`Collector Agent v0.1.3`

## 发布摘要

本次版本聚焦于 **collector-agent 的一键部署与发布体验完善**，适合直接用于远端主机接入与后续 GitHub Release 分发；同时补齐了两套可直接复制的日志传输模板：**默认被动拉取** 与 **可选主动上传（Kafka 兼容）**。

### 亮点

- 新增基于 GitHub Release 资产的 **一键安装脚本**，支持 Linux 主机直接命令行部署
- 新增递归日志路径匹配，支持直接配置 `**/*.log` 采集任意层子目录日志
- 控制台接入向导默认升级到 `v0.1.3`，自动带出：
  - Release 下载地址
  - 安装脚本地址
  - GHCR 镜像地址
  - `被动拉取（默认）` / `主动上传（Kafka 兼容）` 两种模式
- systemd 部署链路进一步收敛：
  - 非 root 用户支持 `sudo` 直接执行
  - root 用户支持 `curl | env | bash` 直接执行
- 安装脚本默认内置部署后修复能力：
  - 自动根据控制面可达性决定是否开启指标回传
  - systemd 服务附加只读日志能力，减少手动加组/改 ACL 操作
- 一键命令模板现已区分：
  - 默认 `DELIVERY_MODE=pull`、`ENABLE_KAFKA_PIPELINE=false`
  - 主动上传时自动切换为 `DELIVERY_MODE=dual`、`ENABLE_KAFKA_PIPELINE=true`

## 适用场景

- 需要通过 GitHub Release 为远端 Linux 主机分发 collector-agent
- 需要在控制台中直接生成可执行的 Linux systemd 安装命令
- 需要根据现场网络条件，在被动拉取与主动上传之间切换
- 需要降低 agent 首次接入时的手工配置成本

## 发布资产

本次 Release 应包含以下资产：

- `collector-agent-linux-amd64.tar.gz`
- `collector-agent-linux-arm64.tar.gz`
- `collector-agent-installer.sh`
- `collector-agent-checksums.txt`

## 默认地址

- Release Base URL：`https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3`
- Install Script URL：`https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh`
- Container Image：`ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.3`

## 一键安装示例

### 模式 A：被动拉取（默认）

```bash
if [ "$(id -u)" -eq 0 ]; then
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh' | env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='pull' \
    ENABLE_KAFKA_PIPELINE='false' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"custom","source_type":"custom"},"pattern":"/var/log/**/*.log"}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo 'sudo is required when not running as root' >&2
    exit 1
  fi
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh' | sudo env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='pull' \
    ENABLE_KAFKA_PIPELINE='false' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"custom","source_type":"custom"},"pattern":"/var/log/**/*.log"}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
fi
```

### 模式 B：主动上传（Kafka 兼容）

```bash
if [ "$(id -u)" -eq 0 ]; then
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh' | env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='dual' \
    ENABLE_KAFKA_PIPELINE='true' \
    KAFKA_BROKERS='10.0.0.10:9092' \
    KAFKA_TOPIC='nexuslog.logs.raw' \
    KAFKA_SCHEMA_REGISTRY_URL='http://schema-registry:8081' \
    KAFKA_SCHEMA_SUBJECT='nexuslog.logs.raw-value' \
    KAFKA_REQUIRED_ACKS='all' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"custom","source_type":"custom"},"pattern":"/var/log/**/*.log"}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
else
  if ! command -v sudo >/dev/null 2>&1; then
    echo 'sudo is required when not running as root' >&2
    exit 1
  fi
  curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-installer.sh' | sudo env \
    ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.3/collector-agent-linux-amd64.tar.gz' \
    AGENT_ID='collector-agent-node-01' \
    AGENT_VERSION='v0.1.3' \
    CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
    AGENT_API_KEY_ACTIVE_ID='active' \
    AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
    DELIVERY_MODE='dual' \
    ENABLE_KAFKA_PIPELINE='true' \
    KAFKA_BROKERS='10.0.0.10:9092' \
    KAFKA_TOPIC='nexuslog.logs.raw' \
    KAFKA_SCHEMA_REGISTRY_URL='http://schema-registry:8081' \
    KAFKA_SCHEMA_SUBJECT='nexuslog.logs.raw-value' \
    KAFKA_REQUIRED_ACKS='all' \
    COLLECTOR_INCLUDE_PATHS='/var/log/**/*.log' \
    COLLECTOR_EXCLUDE_PATHS='' \
    COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"custom","source_type":"custom"},"pattern":"/var/log/**/*.log"}]' \
    COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
    bash
fi
```

## 升级说明

- 控制台默认版本已切换到 `v0.1.3`
- 控制台接入向导默认使用 `被动拉取（pull）`，也可切换为 `主动上传（Kafka 兼容）`
- 重新生成 Linux systemd 部署脚本后，可直接获取新的 Release 地址与一键安装命令
- 如控制面地址对目标主机不可达，安装脚本会自动关闭 metrics report，避免持续报错

## 验证建议

安装完成后，可执行：

```bash
systemctl status collector-agent --no-pager
curl http://127.0.0.1:9091/healthz
curl -H 'X-Agent-Key: replace-with-strong-key' http://127.0.0.1:9091/agent/v1/meta
```

如使用主动上传模式，还应额外检查：

- Kafka brokers 对目标主机可达
- Schema Registry 地址可达
- Topic / Subject 与消费侧配置一致

## 已知注意事项

- 如使用控制台保存 pull source，请填写目标主机真实可访问的 Agent URL
- `CONTROL_PLANE_BASE_URL` 应填写被采集主机可访问的控制面地址，而不是仅本地网络可达的内网地址
- 主动上传当前映射为 **Kafka 兼容主动上传链路**，并保留 Agent HTTP 接口用于健康检查与元数据访问
- GHCR 仓库路径需要保持小写：`ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.3`
