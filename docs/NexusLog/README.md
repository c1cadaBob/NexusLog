# NexusLog 文档索引（已整理）

本文档用于说明 `docs/NexusLog` 的当前目录结构、核心入口与推荐阅读顺序。
本页已经对齐最新文档重组结果，可作为 NexusLog 专题文档的统一导航入口。

## 当前目录结构

- `00-overview/`
  - 总览与规格基线入口
- `10-process/`
  - 项目过程文档、流程图、任务分解、联调记录、证据留档
- `20-database/`
  - 数据库迁移、审计链路、分区、导出与 SQL 参考脚本
- `30-delivery-security/`
  - 发布、回滚、CI/CD、部署安全与交付治理
- `40-monitoring/`
  - 监控、告警、热更新与回滚观察手册

---

## 核心入口

### 1. 规格与总览入口

- `00-overview/01-spec-baseline.md`
  - 当前规格基线入口，适合先快速理解项目文档体系

### 2. 当前实现与流程图库入口

- `10-process/33-project-workflow-diagram-index.md`
  - 双口径流程图库入口：当前真实实现 + 目标全平台蓝图
- `10-process/34-current-real-implementation-flowcharts.md`
  - 当前真实实现主链路事实图
- `10-process/35-target-platform-blueprint-flowcharts.md`
  - 目标全平台蓝图图集
- `10-process/39-engineering-delivery-ops-flowcharts.md`
  - 工程交付、发布、回滚、E2E 排障流程图

### 3. 日志链路重点入口

- `10-process/20-log-ingest-e2e-workflow-v2.md`
- `10-process/24-sdlc-development-process.md`
- `10-process/31-log-end-to-end-lifecycle-and-uml.md`
- `10-process/32-log-sequence-diagram-mermaid.md`

### 4. 数据库与治理入口

- `20-database/01-flyway-v2-v5-migrations.md`
- `20-database/08-schema-gap-and-extension-plan.md`
- `20-database/sql/`

### 5. 发布与监控入口

- `30-delivery-security/01-deploy-script-hot-reload-and-auto-rollback.md`
- `30-delivery-security/07-monitoring-release-workflow-final.md`
- `40-monitoring/01-worker-implementation-and-metrics.md`
- `40-monitoring/05-monitoring-rollback-runbook.md`

---

## 推荐阅读顺序

### 路径 A：先看当前系统怎么跑

1. `00-overview/01-spec-baseline.md`
2. `10-process/33-project-workflow-diagram-index.md`
3. `10-process/34-current-real-implementation-flowcharts.md`
4. `10-process/32-log-sequence-diagram-mermaid.md`
5. `10-process/36-runtime-business-flowcharts.md`
6. `10-process/38-storage-backup-archive-flowcharts.md`

### 路径 B：先看项目如何开发与交付

1. `10-process/01-project-development-strategy-and-phase-split.md`
2. `10-process/02-end-to-end-development-workflow.md`
3. `10-process/23-project-master-plan-and-task-registry.md`
4. `10-process/25-full-lifecycle-task-registry.md`
5. `10-process/39-engineering-delivery-ops-flowcharts.md`

### 路径 C：先看数据库与后端治理

1. `20-database/01-flyway-v2-v5-migrations.md`
2. `20-database/03-v7-rls-multitenancy.md`
3. `20-database/04-v8-immutable-audit.md`
4. `20-database/08-schema-gap-and-extension-plan.md`

### 路径 D：先看发布、安全与监控

1. `30-delivery-security/01-deploy-script-hot-reload-and-auto-rollback.md`
2. `30-delivery-security/02-versioned-deploy-and-rollback.md`
3. `30-delivery-security/07-monitoring-release-workflow-final.md`
4. `40-monitoring/01-worker-implementation-and-metrics.md`
5. `40-monitoring/05-monitoring-rollback-runbook.md`

---

## 目录用途说明

| 目录 | 用途 | 典型内容 |
|---|---|---|
| `00-overview/` | 总入口 | 规格基线、阅读入口 |
| `10-process/` | 过程与流程 | 计划、需求、设计、任务、流程图、证据 |
| `10-process/evidence/` | 执行留档 | 联调日志、验证记录、排障证据 |
| `20-database/` | 数据库专题 | Flyway、RLS、审计、导出、分区、SQL 参考 |
| `30-delivery-security/` | 交付与安全 | 部署、回滚、审批、sudoers、SSH 加固 |
| `40-monitoring/` | 运维与监控 | Metrics、Prometheus、Alertmanager、回滚观察 |

---

## 旧目录到新目录映射

| 旧路径 | 新路径 |
|---|---|
| `README-spec-baseline.md` | `00-overview/01-spec-baseline.md` |
| `process/` | `10-process/` |
| `database/` | `20-database/` |
| `delivery-security/` | `30-delivery-security/` |
| `monitoring/` | `40-monitoring/` |

### 其他说明

- `10-process/evidence/` 保留为执行态证据目录，用于保存联调摘要、验证记录和排障日志
- `20-database/sql/` 保留为数据库设计 / 历史 SQL 参考目录，不等同于运行时迁移入口
- 运行时数据库迁移真相源仍以 `storage/postgresql/migrations/` 为准

---

## 阅读与维护建议

- 想看“当前真实实现”，优先从 `10-process/33 ~ 39` 开始
- 想看“目标态蓝图”，优先从 `10-process/35` 开始
- 想看“数据库与审计链路”，优先从 `20-database/` 开始
- 想看“交付与运维闭环”，优先从 `30-delivery-security/` 和 `40-monitoring/` 开始
- 如果发现旧路径引用，应优先收口到本页定义的新目录结构
