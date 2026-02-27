# NexusLog 文档索引（已整理）

本文档用于说明 `docs/NexusLog` 目录的当前结构、阅读顺序和重命名映射。

## 目录结构

- `database/`: 数据库迁移、审计链路、分区与导出
- `database/sql/`: 可执行 SQL 脚本与模板
- `monitoring/`: 监控告警、热更新与回滚 Runbook
- `delivery-security/`: 发布流程、CI/CD、权限与安全加固
- `process/`: 项目开发策略与端到端开发流程

## 推荐阅读顺序

1. `process/01-project-development-strategy-and-phase-split.md`
2. `process/02-end-to-end-development-workflow.md`
3. `database/01-flyway-v2-v5-migrations.md`
4. `database/02-flyway-compatibility-and-v6-sla.md`
5. `database/03-v7-rls-multitenancy.md`
6. `database/04-v8-immutable-audit.md`
7. `database/05-v9-audit-verify-export.md`
8. `database/06-v10-partition-retention-and-worker-runbook.md`
9. `database/07-v11-retry-dead-letter-observability.md`
10. `monitoring/01-worker-implementation-and-metrics.md`
11. `monitoring/02-prometheus-alert-rules-and-grafana-dashboard.md`
12. `monitoring/03-alertmanager-routing-template.md`
13. `monitoring/04-hot-reload-guidelines.md`
14. `monitoring/05-monitoring-rollback-runbook.md`
15. `delivery-security/01-deploy-script-hot-reload-and-auto-rollback.md`
16. `delivery-security/02-versioned-deploy-and-rollback.md`
17. `delivery-security/03-github-actions-auto-deploy-and-rollback.md`
18. `delivery-security/04-production-approval-and-auto-rollback.md`
19. `delivery-security/05-sudoers-and-ssh-hardening.md`
20. `delivery-security/06-hot-reload-first-deploy-strategy.md`
21. `delivery-security/07-monitoring-release-workflow-final.md`

## 重命名映射（旧 -> 新）

| 旧文件 | 新文件 |
|---|---|
| `a.md` | `database/01-flyway-v2-v5-migrations.md` |
| `b.md` | `database/02-flyway-compatibility-and-v6-sla.md` |
| `c.md` | `database/03-v7-rls-multitenancy.md` |
| `d.md` | `database/04-v8-immutable-audit.md` |
| `e.md` | `database/05-v9-audit-verify-export.md` |
| `f.md` | `database/06-v10-partition-retention-and-worker-runbook.md` |
| `g.md` | `database/07-v11-retry-dead-letter-observability.md` |
| `h.md` | `monitoring/01-worker-implementation-and-metrics.md` |
| `i.md` | `monitoring/02-prometheus-alert-rules-and-grafana-dashboard.md` |
| `j.md` | `monitoring/03-alertmanager-routing-template.md` |
| `k.md` | `monitoring/04-hot-reload-guidelines.md` |
| `m.md` | `delivery-security/01-deploy-script-hot-reload-and-auto-rollback.md` |
| `n.md` | `delivery-security/02-versioned-deploy-and-rollback.md` |
| `o.md` | `delivery-security/03-github-actions-auto-deploy-and-rollback.md` |
| `p.md` | `delivery-security/04-production-approval-and-auto-rollback.md` |
| `q.md` | `delivery-security/05-sudoers-and-ssh-hardening.md` |
| `r.md` | `delivery-security/06-hot-reload-first-deploy-strategy.md` |
| `s.md` | `delivery-security/07-monitoring-release-workflow-final.md` |
| `t.md` | `monitoring/05-monitoring-rollback-runbook.md` |
| `u.md` | `process/01-project-development-strategy-and-phase-split.md` |
| `v.md` | 已删除（空文件） |
| `w.md` | 已删除（空文件） |
| `x.md` | 已删除（空文件） |
| `y.md` | 已删除（空文件） |
| `z.md` | 已删除（空文件） |

### SQL 文件重命名

| 旧文件 | 新文件 |
|---|---|
| `sql/Migration 脚本模板（复制即用）.sql` | `database/sql/migration-script-template.sql` |
| `sql/业务事务写法示例（建议你服务端照这个模式）.sql` | `database/sql/transaction-pattern-example.sql` |

