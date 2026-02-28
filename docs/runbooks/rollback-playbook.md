# Runbook: 回滚操作手册

## 概述

本手册描述 NexusLog 各组件的回滚流程，确保在发布出现问题时能够快速恢复。

## 回滚 SLA

| 时间点 | 目标 |
|--------|------|
| T+5 分钟 | 完成回滚决策并触发止血动作 |
| T+15 分钟 | 核心服务恢复（错误率回落、可用性恢复） |
| T+30 分钟 | 根因初判 + 影响面确认 + 对内通报 |
| T+24 小时 | 提交复盘报告（含改进项） |

## 回滚决策流程

```
发现问题
    │
    ▼
错误率 > 1% 或 P99 延迟 > 2x 基线？
    │
    ├── 是 ──▶ 立即回滚
    │
    └── 否 ──▶ 观察 5 分钟
                  │
                  ▼
              问题持续？
                  │
                  ├── 是 ──▶ 回滚
                  │
                  └── 否 ──▶ 继续观察
```

## 前端回滚

### 方式 1: Argo CD 回滚

```bash
# 查看历史版本
argocd app history nexuslog-frontend

# 回滚到指定版本
argocd app rollback nexuslog-frontend <REVISION>
```

### 方式 2: 手动回滚

```bash
# 更新镜像版本
kubectl set image deployment/frontend-console \
  frontend=nexuslog/frontend-console:v1.2.3 \
  -n nexuslog-apps

# 等待滚动更新完成
kubectl rollout status deployment/frontend-console -n nexuslog-apps
```

## 后端服务回滚

### Control Plane 回滚

```bash
# Argo CD 回滚
argocd app rollback nexuslog-control-plane <REVISION>

# 或手动回滚
kubectl rollout undo deployment/control-plane -n nexuslog-services
```

### API Service 回滚

```bash
# Argo CD 回滚
argocd app rollback nexuslog-api-service <REVISION>

# 或手动回滚
kubectl rollout undo deployment/api-service -n nexuslog-services
```

## 数据库回滚

### PostgreSQL Schema 回滚

```bash
# 统一入口（推荐）：通过 Makefile 调用 scripts/db-migrate.sh
export DB_DSN="postgres://$PG_USER:$PG_PASSWORD@$PG_HOST:$PG_PORT/nexuslog?sslmode=disable"
make db-migrate-down STEPS=1

# 或直接调用脚本入口
scripts/db-migrate.sh down 1
```

说明：
- 运行时唯一迁移目录：`storage/postgresql/migrations`
- 统一迁移命令入口：`scripts/db-migrate.sh`（请勿在仓库内散落原始 `migrate -path ...` 命令）

### Elasticsearch 索引回滚

```bash
# 恢复索引模板
curl -X PUT "$ES_HOST/_index_template/nexuslog-logs" \
  -H 'Content-Type: application/json' \
  -d @storage/elasticsearch/index-templates/nexuslog-logs-v1.json

# 如需恢复数据，从快照恢复
curl -X POST "$ES_HOST/_snapshot/nexuslog-backup/snapshot_20240101/_restore"
```

## 配置回滚

### Kafka Topic 配置回滚

```bash
# 恢复 Topic 配置
kafka-configs.sh --bootstrap-server $KAFKA_BROKERS \
  --alter --entity-type topics --entity-name nexuslog-logs \
  --add-config retention.ms=604800000
```

### OPA 策略回滚

```bash
# 回滚策略 Bundle
kubectl rollout undo deployment/opa -n nexuslog-iam
```

## 回滚后检查清单

- [ ] 服务健康检查通过
- [ ] 错误率恢复正常
- [ ] 延迟恢复正常
- [ ] 功能验证通过
- [ ] 无数据丢失或损坏
- [ ] 告警恢复

## 复盘模板

### 事件概述

- **事件时间**: YYYY-MM-DD HH:MM - HH:MM
- **影响范围**: 
- **影响时长**: 
- **根本原因**: 

### 时间线

| 时间 | 事件 | 操作人 |
|------|------|--------|
| HH:MM | 发现问题 | |
| HH:MM | 开始回滚 | |
| HH:MM | 服务恢复 | |

### 改进措施

| 措施 | 负责人 | 截止日期 |
|------|--------|----------|
| | | |
