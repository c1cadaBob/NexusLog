# Collector Agent v0.1.1 Release Notes

> 建议 GitHub Release 标题：`Collector Agent v0.1.1`

## 发布摘要

本次版本聚焦于 **collector-agent 的一键部署与发布体验完善**，适合直接用于远端主机接入与后续 GitHub Release 分发。

### 亮点

- 新增基于 GitHub Release 资产的 **一键安装脚本**，支持 Linux 主机直接命令行部署
- 控制台接入向导默认升级到 `v0.1.1`，自动带出：
  - Release 下载地址
  - 安装脚本地址
  - GHCR 镜像地址
- systemd 部署链路进一步收敛：
  - 非 root 用户支持 `sudo` 直接执行
  - root 用户支持 `curl | env | bash` 直接执行
- 安装脚本默认内置部署后修复能力：
  - 自动根据控制面可达性决定是否开启指标回传
  - systemd 服务附加只读日志能力，减少手动加组/改 ACL 操作

## 适用场景

- 需要通过 GitHub Release 为远端 Linux 主机分发 collector-agent
- 需要在控制台中直接生成可执行的 Linux systemd 安装命令
- 需要降低 agent 首次接入时的手工配置成本

## 发布资产

本次 Release 应包含以下资产：

- `collector-agent-linux-amd64.tar.gz`
- `collector-agent-linux-arm64.tar.gz`
- `collector-agent-installer.sh`
- `collector-agent-checksums.txt`

## 默认地址

- Release Base URL：`https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1`
- Install Script URL：`https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-installer.sh`
- Container Image：`ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.1`

## 一键安装示例

### root 用户

```bash
curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-installer.sh' | env \
  ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-linux-amd64.tar.gz' \
  AGENT_ID='collector-agent-node-01' \
  AGENT_VERSION='v0.1.1' \
  CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
  AGENT_API_KEY_ACTIVE_ID='active' \
  AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
  COLLECTOR_INCLUDE_PATHS='/var/log/*.log' \
  COLLECTOR_EXCLUDE_PATHS='' \
  COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"custom","source_type":"custom"},"pattern":"/var/log/*.log"}]' \
  COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
  bash
```

### 普通用户 + sudo

```bash
curl -fsSL 'https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-installer.sh' | sudo env \
  ASSET_URL='https://github.com/c1cadabob/NexusLog/releases/download/v0.1.1/collector-agent-linux-amd64.tar.gz' \
  AGENT_ID='collector-agent-node-01' \
  AGENT_VERSION='v0.1.1' \
  CONTROL_PLANE_BASE_URL='http://<control-plane-host>:3000' \
  AGENT_API_KEY_ACTIVE_ID='active' \
  AGENT_API_KEY_ACTIVE='replace-with-strong-key' \
  COLLECTOR_INCLUDE_PATHS='/var/log/*.log' \
  COLLECTOR_EXCLUDE_PATHS='' \
  COLLECTOR_PATH_LABEL_RULES='[{"labels":{"service":"custom","source_type":"custom"},"pattern":"/var/log/*.log"}]' \
  COLLECTOR_SYSLOG_LISTENERS_JSON='[]' \
  bash
```

## 升级说明

- 控制台默认版本已切换到 `v0.1.1`
- 重新生成 Linux systemd 部署脚本后，可直接获取新的 Release 地址与一键安装命令
- 如控制面地址对目标主机不可达，安装脚本会自动关闭 metrics report，避免持续报错

## 验证建议

安装完成后，可执行：

```bash
systemctl status collector-agent --no-pager
curl http://127.0.0.1:9091/healthz
curl -H 'X-Agent-Key: replace-with-strong-key' http://127.0.0.1:9091/agent/v1/meta
```

## 已知注意事项

- 如使用控制台保存 pull source，请填写目标主机真实可访问的 Agent URL
- `CONTROL_PLANE_BASE_URL` 应填写被采集主机可访问的控制面地址，而不是仅本地网络可达的内网地址
- GHCR 仓库路径需要保持小写：`ghcr.io/c1cadabob/nexuslog-collector-agent:v0.1.1`
