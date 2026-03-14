# NexusLog 部署指南

本文档面向当前仓库的**本地持久化部署**场景，目标是把 NexusLog 在单机上完整跑起来，并接通：

- 宿主机真实日志采集
- Docker 容器日志采集
- Pull / Stream 主链基础设施
- Elasticsearch 检索
- Query API / Frontend Console
- Alertmanager / Grafana 可视化与告警链路

如果你要看更细的交付、安全、回滚和监控细节，再继续阅读 `docs/NexusLog/` 下的专题文档；本文件优先提供“能直接执行”的部署步骤。

## 1. 推荐部署模式

| 模式 | 命令 | 适用场景 |
|---|---|---|
| 完整本地持久化部署 | `make local-deploy` | 推荐默认方式；启动全链路并做本地自举 |
| 完整热更新环境 | `make dev-up` | 已知链路已自举，仅需拉起全部服务 |
| 轻量开发环境 | `make dev-up-lite` | 机器资源不足时，仅起最小开发集 |
| 仅补链路自举 | `make local-bootstrap` | 服务已启动，但需要重装 alias / schema / pull source / alert rule |

说明：

- `make local-deploy` = `make dev-up` + `make local-bootstrap`
- 本仓库当前推荐通过 `docker-compose.yml` + `docker-compose.override.yml` 在本地运行
- 默认会保留 Docker named volumes，因此重启 Docker 后数据仍可继续使用

## 2. 前置条件

在开始前请确认：

- 已安装 Docker Engine 与 Docker Compose v2
- 已安装 `make`、`curl`、`jq`
- 当前用户可执行 `docker compose`
- 宿主机有足够资源运行完整链路；如果资源偏紧，先使用 `make dev-up-lite`
- 常用端口未被占用：`3000`、`3001`、`3002`、`8080`、`8081`、`8082`、`8083`、`8084`、`8085`、`8088`、`9091`、`9200`、`18081`、`19090`、`19093`

## 3. 一键部署（推荐）

### Step 1：写入宿主机身份文件

`collector-agent` 默认通过宿主机身份文件注入**真实主机名**和**真实主 IP**，避免误用容器 IP。

执行：

```bash
bash ./scripts/local/write-host-identity.sh
```

执行成功后，会在仓库下生成：

- `./.runtime/host-meta/source_hostname`
- `./.runtime/host-meta/source_ip`

如果你的宿主机有多网卡，脚本会优先选择主 IPv4；如需手工覆盖，可这样执行：

```bash
NEXUSLOG_SOURCE_HOSTNAME=my-host \
NEXUSLOG_SOURCE_IP=192.168.0.10 \
bash ./scripts/local/write-host-identity.sh
```

### Step 2：启动完整本地环境并完成链路自举

```bash
make local-deploy
```

这个命令会自动完成两件事：

1. 启动本地开发热更新环境
2. 自动执行链路自举，包括：
   - 注册 Schema Registry subjects
   - 安装 Elasticsearch v2 template
   - 安装 Elasticsearch 读写别名
   - 创建 / 更新本地 Pull Source
   - 创建 / 复用本地测试告警规则
   - 触发一次手工 Pull，缩短首批日志入链路时间

### Step 3：执行冒烟检查

```bash
make dev-test-smoke
```

如果全部通过，说明当前机器上的核心服务已经 ready。

## 4. 本地部署会启动哪些能力

完整部署默认会拉起以下能力域：

- 前端：`frontend-console`、`bff-service`
- 控制与数据服务：`control-plane`、`api-service`、`query-api`、`audit-api`、`export-api`、`health-worker`
- 认证密钥约束：`control-plane` 与所有签发/校验业务访问令牌的服务必须使用同一组 `JWT_SECRET`；若密钥不一致，`control-plane` 的受保护接口会拒绝合法 Bearer Token
- 采集：`collector-agent`
- 流式链路：`zookeeper`、`kafka`、`schema-registry`、`flink-jobmanager`、`flink-taskmanager`
- 存储：`postgres`、`redis`、`elasticsearch`
- 监控告警：`prometheus`、`alertmanager`、`grafana`
- Exporter：`node-exporter`、`elasticsearch-exporter`、`kafka-exporter`、`postgres-exporter`、`redis-exporter`

此外还包含一个本地模拟远程 Agent：

- `collector-agent-remote`
  - 默认端口：`16666`
  - 默认主机名：`collector-agent-remote-local`
  - 默认模拟 IP：`198.18.0.2`

## 5. 默认日志采集范围

当前本地部署会让 `collector-agent` 采集两大类日志：

### 宿主机日志

默认覆盖：

- `/var/log/*.log`
- `/var/log/messages`
- `/var/log/secure`
- `/var/log/cron`
- `/var/log/maillog`
- `/var/log/spooler`
- `/var/log/boot.log`
- `/var/log/command_audit.log`
- `/var/log/kdump.log`
- `/var/log/*/*.log`
- `/var/log/*/*_log`

### Docker 容器日志

默认覆盖：

- `/var/lib/docker/containers/*/*-json.log`

说明：

- 宿主机 `/var/log` 以只读方式挂载进 `collector-agent`
- Docker 容器 JSON 日志目录也会只读挂载进 `collector-agent`
- `collector-agent` 默认从宿主机身份文件读取 `source_hostname` 与 `source_ip`
- 因此实时检索页面中的“主机 / 主机IP”默认展示宿主机真实值，而不是容器网桥 IP

## 6. 访问地址

部署完成后，常用入口如下：

| 能力 | 地址 |
|---|---|
| Frontend Console | `http://localhost:3000` |
| BFF 健康检查 | `http://localhost:3001/healthz` |
| Control Plane | `http://localhost:8080/healthz` |
| API Service | `http://localhost:8085/healthz` |
| Query API | `http://localhost:8082/healthz` |
| Audit API | `http://localhost:8083/healthz` |
| Export API | `http://localhost:8084/healthz` |
| Health Worker | `http://localhost:8081/healthz` |
| Collector Agent | `http://localhost:9091/healthz` |
| Collector Agent Meta | `http://localhost:9091/agent/v1/meta` |
| Schema Registry | `http://localhost:18081/subjects` |
| Flink REST | `http://localhost:8088/overview` |
| Elasticsearch | `http://localhost:9200` |
| Prometheus | `http://localhost:19090/-/ready` |
| Alertmanager | `http://localhost:19093/-/ready` |
| Grafana | `http://localhost:3002` |

## 7. 端到端验证

### 7.1 验证采集 Agent 已带出宿主机身份

当前本地开发环境默认启用了 Agent Key 鉴权，因此应这样调用：

```bash
curl -H 'X-Agent-Key: dev-agent-key' http://localhost:9091/agent/v1/meta
```

预期返回里能看到：

- `hostname`
- `ip`

### 7.2 验证 Query API 已可查询日志

```bash
curl -X POST http://localhost:8082/api/v1/query/logs \
  -H 'Content-Type: application/json' \
  -d '{
    "keywords": "",
    "page": 1,
    "page_size": 5,
    "sort": [{"field":"@timestamp","order":"desc"}],
    "time_range": {"from":"","to":""}
  }'
```

### 7.3 人工写入一条测试日志，验证“采集 → 存储 → 检索”

```bash
printf '%s level=ERROR service=nexuslog-local token=%s message="local alert test"\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  "NEXUSLOG_LOCAL_ALERT_TEST" | sudo tee -a /var/log/nexuslog-local.log
```

然后执行：

- 打开 `http://localhost:3000/#/search/realtime`
- 搜索 `NEXUSLOG_LOCAL_ALERT_TEST`
- 确认新日志可见
- 确认“主机”与“主机IP”字段已带出宿主机信息

### 7.4 验证告警链路

本地 bootstrap 默认会创建名为 `local-host-token-alert` 的测试规则，关键字默认是 `NEXUSLOG_LOCAL_ALERT_TEST`。

验证方式：

1. 按上面的命令写入测试日志
2. 打开 `http://localhost:19093`
3. 检查 Alertmanager 是否出现对应告警
4. 打开 `http://localhost:3002`
5. 在 Grafana 中确认告警与指标可见

## 8. 日常运维命令

### 查看整体日志

```bash
make dev-logs
```

### 查看单个服务日志

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml logs -f --tail=200 query-api
```

可将最后一个服务名替换成：

- `collector-agent`
- `control-plane`
- `frontend-console`
- `flink-jobmanager`
- `flink-taskmanager`
- `elasticsearch`

### 重启单个服务

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml restart query-api
```

### 关闭环境

```bash
make dev-down
```

### 清空所有本地数据并重建

```bash
docker compose -f docker-compose.yml -f docker-compose.override.yml down -v --remove-orphans
bash ./scripts/local/write-host-identity.sh
make local-deploy
```

注意：`down -v` 会删除数据库、ES、Grafana、Prometheus、Agent checkpoint/cache 等持久化数据。

## 9. 持久化说明

以下内容默认会持久化保留：

- PostgreSQL 数据
- Redis 数据
- Elasticsearch 数据
- Kafka / ZooKeeper 数据
- Grafana / Prometheus / Alertmanager 数据
- `collector-agent` checkpoint / cache
- `collector-agent-remote` checkpoint / cache
- 仓库内的 `./.runtime/host-meta` 宿主机身份文件

因此：

- **重启 Docker / 重启宿主机** 后，重新执行 `make dev-up` 或 `make local-deploy` 即可继续使用
- **如宿主机 IP 或主机名发生变化**，请重新执行一次：

```bash
bash ./scripts/local/write-host-identity.sh
```

## 10. 常见问题

### 10.1 `collector-agent` 读到了容器 IP，而不是宿主机 IP

先确认：

```bash
cat ./.runtime/host-meta/source_ip
```

若值不对，重新生成：

```bash
bash ./scripts/local/write-host-identity.sh
```

必要时显式指定：

```bash
NEXUSLOG_SOURCE_IP=你的宿主机IP bash ./scripts/local/write-host-identity.sh
```

### 10.2 服务都起来了，但链路没有打通

重新执行：

```bash
make local-bootstrap
```

这个命令会重新安装 alias / schema / pull source / alert rule。

### 10.3 机器资源不够，完整环境起不来

先使用轻量模式：

```bash
make dev-up-lite
```

等确认核心开发链路可用后，再切回：

```bash
make local-deploy
```

### 10.4 重启 Docker 之后页面没数据

按顺序执行：

```bash
bash ./scripts/local/write-host-identity.sh
make local-deploy
make dev-test-smoke
```

## 11. 进一步阅读

如果你需要更细的说明，继续参考：

- `docs/NexusLog/README.md`
- `docs/NexusLog/10-process/40-log-chain-completeness-assessment.md`
- `docs/NexusLog/30-delivery-security/01-deploy-script-hot-reload-and-auto-rollback.md`
- `docs/NexusLog/40-monitoring/05-monitoring-rollback-runbook.md`
