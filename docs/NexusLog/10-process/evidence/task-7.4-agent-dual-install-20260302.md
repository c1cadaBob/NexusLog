# Task 7.4 agent 双安装模式交付记录

- 日期：2026-03-02
- 任务：`7.4 交付双安装模式：预编译二进制 + systemd、Docker 运行`
- 服务：`agents/collector-agent`

## 本次交付范围

1. 预编译二进制交付资产：
   - 新增打包脚本：`scripts/package-agent.sh`
   - 产物包含：二进制、`configs/`、systemd 与 Docker 部署文件。
2. systemd 交付资产：
   - `deploy/systemd/collector-agent.service`
   - `deploy/systemd/collector-agent.env.example`
3. Docker 交付资产：
   - `deploy/docker/docker-compose.agent.yml`
   - 修复 `Dockerfile`（无 `go.sum` 时复制 `go.mod` 构建）。
4. 安装文档：
   - `docs/install-dual-mode.md`（含 systemd 与 Docker 两种启动步骤）。

## 验证结果

1. 预编译打包验证（通过）：
   - 命令：`cd /opt/projects/NexusLog/agents/collector-agent && bash scripts/package-agent.sh`
   - 日志：`docs/NexusLog/10-process/evidence/task-7.4-agent-package-build-20260302.log`
2. 本地二进制启动冒烟（通过）：
   - 验证项：`/healthz`、`/agent/v1/meta`、鉴权失败 401
   - 日志：`docs/NexusLog/10-process/evidence/task-7.4-agent-systemd-like-smoke-20260302.log`
3. Docker Compose 结构校验（通过）：
   - 命令：`docker compose -f deploy/docker/docker-compose.agent.yml config`
   - 日志：`docs/NexusLog/10-process/evidence/task-7.4-agent-docker-compose-config-20260302.log`
4. Docker 镜像构建尝试（受环境网络限制失败）：
   - 失败原因：`go mod download` 访问 `proxy.golang.org` 超时
   - 日志：`docs/NexusLog/10-process/evidence/task-7.4-agent-docker-build-20260302.log`

## 备注

- 双安装模式所需脚本、配置与运行文档已交付，systemd 模式可本地验证启动。
- Docker 运行资产已可通过 `compose config` 校验；实际镜像构建受当前执行环境外网超时影响，建议在具备稳定外网的 CI/目标环境执行一次构建与启动复核。
