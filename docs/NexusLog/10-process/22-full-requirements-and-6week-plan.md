# NexusLog 完整项目需求与 6 周实施规划

> 版本：v1.0
> 基线日期：2026-03-06
> 周期：Week1（03-09）~ Week6（04-17）
> 上位文档：`11-current-project-overall-planning.md`、`14-topic-proposal-8-week-plan.md`

---

## 1. 现状评估

### 1.1 已完成能力（可直接复用）

| 能力 | 状态 | 关键代码/文件 |
|------|------|--------------|
| 认证闭环（注册/登录/刷新/退出/重置） | ✅ 已完成 | `api-service`、前端 `LoginForm/RegisterForm/ForgotPasswordForm` |
| 网关统一路由 `/api/v1/*` | ✅ 已完成 | `gateway/openresty` |
| 数据库迁移框架 | ✅ 已完成 | `storage/postgresql/migrations/000001~000017` |
| 前端页面框架 | ✅ 骨架完成 | ~60 个页面已创建，含侧边栏/布局/主题/路由守卫 |
| Pull 控制面骨架 | ✅ 部分完成 | `control-plane` pull-sources/tasks/packages/receipts/dead-letters |
| Agent 文件采集 + Pull API | ✅ 部分完成 | `collector-agent` readFileIncremental/pullapi |
| 日志检索 API | ✅ 部分完成 | `query-api` POST /api/v1/query/logs |
| Docker Compose 编排 | ✅ 已完成 | 根目录 `docker-compose.yml` + `docker-compose.override.yml` |
| CI/CD 流水线 | ✅ 已完成 | `.github/workflows/` backend-ci/frontend-ci/docker-build |
| 监控配置（Prometheus/Grafana/Alertmanager） | ✅ 配置已备 | `observability/` |

### 1.2 待建设能力（与 9 项需求的差距）

| 需求编号 | 需求 | 当前状态 | 差距等级 |
|---------|------|---------|---------|
| R1 | 多源采集 + 存入 ES | Agent 仅支持文件采集；ES 写入字段不全；无加密/压缩/去重 | 大 |
| R2 | 前端日志显示/查询 | `RealtimeSearch` 已接 query-api；其余页面 mock | 中 |
| R3 | 日志备份/下载/恢复 | `export-api` 占位；前端 `BackupRecovery` 页面 mock | 大 |
| R4 | 告警（邮箱/钉钉/短信） | 仅有延迟监控打日志；无告警规则引擎/通知渠道 | 大 |
| R5 | 多用户权限分发 | 仅有认证；无 RBAC、无角色/权限表 | 大 |
| R6 | 服务器资源监控 + 阈值告警 | `health-worker` 仅 HTTP 探测；无 CPU/内存/磁盘采集 | 大 |
| R7 | 日志流程审计 | `audit-api` 占位；前端事件管理页面 mock | 大 |
| R8 | 其他（安全/性能/可靠性） | 见 `21-log-ingest-e2e-implementation-taskbook.md` | 中 |
| R9 | 6 周内可交付 | 需精准裁剪范围 | - |

### 1.3 核心矛盾

前端页面骨架完整（~60 页），但 90% 以上页面使用 mock 数据。后端多个服务为占位实现。**最大风险是广度铺得太大而深度不够**。6 周内必须聚焦"最小通路"，把核心链路真正打通，其余保留扩展接口但不实现完整功能。

---

## 2. 需求基线（R1~R9）

### R1：多源日志采集 + 存入 ES

#### R1.1 文件日志采集（P0）

- Agent 基于原文件增量读取，不生成中间暂存文件。
- 支持 glob 路径配置（`/var/log/*.log`、`/var/log/nginx/*.log`）。
- 支持 inode/dev 追踪，正确处理日志轮转。
- checkpoint 原子持久化（tmp+rename）。
- 日志级别检测（三层策略：方括号 → JSON/KV → 独立关键字）。
- 优先传递错误日志（critical/normal 双通道缓冲）。

#### R1.2 多服务器采集（P0）

- 每台目标服务器部署一个 collector-agent 实例。
- 日志服务器通过 control-plane 统一管理所有 agent 的 pull-source。
- 支持通过前端页面添加/编辑/禁用采集源。

#### R1.3 传输安全与效率（P0）

- Pull 响应加密（AES-256-GCM + HMAC + 防重放）。
- Pull 响应压缩（gzip，小于 1KB 跳过）。
- 日志服务器解密后入库。

#### R1.4 ES 写入规范（P0）

- 五层字段模型落库（raw/event/transport/ingest/governance 核心字段）。
- 入库前去重（event_id 幂等 + 滑动窗口）。
- `_id = event_id = sha256(server_id + source_collect_path + offset + message_hash)`。

#### R1.5 多采集方式扩展预留（P2，本轮不实现）

- Syslog 采集（接口已定义，实现顺延）。
- Kafka 输入（pipeline 已有骨架，顺延）。
- 容器 stdout 采集（顺延）。

### R2：前端日志显示与查询

#### R2.1 实时日志检索页（P0）

- 关键词搜索、时间范围筛选、日志级别筛选、来源筛选。
- 日志详情展开（显示五层字段）。
- 分页加载。
- 调用 `query-api` 真实接口（已部分实现）。

#### R2.2 查询历史与收藏（P0）

- 查询历史自动保存（已实现）。
- 收藏查询管理（已实现）。

#### R2.3 Dashboard 概览（P1）

- 日志总量趋势图。
- 按级别分布饼图。
- 按来源 Top N 柱状图。
- 最近告警摘要。
- 系统健康状态卡片。

#### R2.4 日志分析页面（P2，本轮最小实现）

- 聚合分析页面接入真实 API（按时间/级别/来源聚合）。

### R3：日志备份、下载与恢复

#### R3.1 日志导出/下载（P0）

- 支持按时间范围 + 筛选条件导出日志为 CSV/JSON 文件。
- 导出任务异步执行，前端显示进度，完成后提供下载链接。
- 单次导出上限 10 万条（超过提示缩小范围）。

#### R3.2 ES 快照备份（P1）

- 通过 API 触发 ES snapshot 备份到本地/远程仓库。
- 前端页面管理备份记录（列表/触发备份/查看状态）。

#### R3.3 备份恢复（P1）

- 支持从快照恢复到指定索引。
- 前端页面选择备份点 → 确认恢复 → 显示进度。

### R4：日志告警

#### R4.1 告警规则引擎（P0）

- 基于日志关键词/级别/频率的告警规则。
- 规则配置：名称、条件表达式、级别、通知渠道、静默期。
- 规则 CRUD 接口 + 前端规则管理页面。

#### R4.2 告警触发与通知（P0）

- 告警评估：定时扫描（每 30 秒）+ 实时推送（可选 P2）。
- 通知渠道（至少实现 2 种）：
  - 邮箱（SMTP，P0）。
  - 钉钉 Webhook（P0）。
  - 短信（P2，预留接口）。
- 告警记录入库，前端告警列表可查。

#### R4.3 告警静默策略（P1）

- 按时间窗口/规则/来源配置静默。
- 静默期内不发送通知，但仍记录告警。

### R5：多用户权限分发

#### R5.1 角色与权限模型（P0）

- 内置角色：`admin`（超级管理员）、`operator`（运维人员）、`viewer`（只读用户）。
- 权限维度：模块级（采集管理/日志查询/告警管理/用户管理/系统设置）。
- 用户-角色绑定（一个用户一个角色，简化模型）。

#### R5.2 权限控制实现（P0）

- 后端：API 中间件校验角色权限（基于 token 中的 user_id 查角色）。
- 前端：根据角色隐藏/禁用无权限的菜单和操作按钮。
- 数据隔离：operator 只能看到分配给自己的采集源。

#### R5.3 用户管理页面（P0）

- 管理员可创建/编辑/禁用用户。
- 管理员可分配角色。
- 用户列表/详情/操作日志。

### R6：服务器资源监控 + 阈值告警

#### R6.1 Agent 资源指标采集（P0）

- collector-agent 增加系统指标采集：CPU 使用率、内存使用率、磁盘使用率、磁盘 IO、网络流量。
- 指标定时上报到日志服务器（复用 Pull API 或独立上报接口）。

#### R6.2 资源监控展示（P0）

- 前端资源监控页面：按 Agent 分组显示资源使用图表。
- 支持时间范围选择。

#### R6.3 资源阈值告警（P0）

- 管理员在前端设定阈值（如 CPU > 80%、磁盘 > 90%）。
- 超过阈值自动触发告警（复用 R4 告警通知渠道）。

### R7：日志流程审计

#### R7.1 错误事件全流程记录（P0）

完整生命周期：

1. **日志产生**：目标服务器产生错误日志 → Agent 采集并标记 critical。
2. **日志传输**：日志服务器拉取 → 解密 → 入库。
3. **告警触发**：按服务预设的告警级别自动触发告警。
4. **告警分发**：通知到指定运维人员。
5. **人员响应**：记录运维人员确认告警的时间（响应时间）。
6. **问题解决**：记录问题解决的时间（处理时间）。
7. **研判归档**：运维人员对错误进行根因分析、填写研判结论、归档关闭。

#### R7.2 事件管理接口（P0）

- 事件 CRUD：创建（由告警自动创建或手动创建）、列表、详情、更新状态、归档。
- 事件时间线：记录每个阶段的时间戳和操作人。
- 事件 SLA：统计响应时间、处理时间，对比 SLA 目标。

#### R7.3 事件管理前端（P0）

- 事件列表页（筛选/排序/状态过滤）。
- 事件详情页（时间线展示、状态流转、操作记录）。
- 事件归档页。

### R8：其他需考虑内容

#### R8.1 敏感信息脱敏（P1）

- 日志入 ES 前对 IP/邮箱/手机号做正则替换。
- 见 `21-log-ingest-e2e-implementation-taskbook.md` T-09。

#### R8.2 多行日志合并（P1）

- Java 堆栈等多行日志合并为单条记录。
- 见 `21-log-ingest-e2e-implementation-taskbook.md` T-08。

#### R8.3 操作审计日志（P1）

- 记录关键操作（登录/退出/创建用户/修改规则/导出日志等）到 `audit_logs` 表。
- 前端审计日志查看页面。

#### R8.4 系统健康检查（P1）

- Dashboard 展示各服务、ES、PG、Agent 的健康状态。
- 复用 `health-worker` 并扩展检查项。

#### R8.5 Graceful Shutdown（P2）

- Agent 优雅停止：flush checkpoint → 等待 pending batch → 关闭。

---

## 3. 技术架构决策

### 3.1 最小通路架构

```text
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React 19 + AntD)                     │
│  登录 │ Dashboard │ 日志检索 │ 告警管理 │ 事件管理 │ 用户管理 │ 监控  │
└────────────────────────────┬────────────────────────────────────┘
                             │ /api/v1/*
                    ┌────────┴────────┐
                    │   Gateway (Nginx) │
                    └────────┬────────┘
          ┌──────────────────┼───────────────────┐
          │                  │                   │
   ┌──────┴───────┐  ┌──────┴───────┐   ┌──────┴───────┐
   │  api-service  │  │ control-plane │   │  query-api   │
   │ 认证/用户/权限 │  │ 采集/告警/事件 │   │  日志检索     │
   │ 告警通知/审计  │  │ 资源监控/导出  │   │  聚合分析     │
   └──────┬───────┘  └──────┬───────┘   └──────┬───────┘
          │                  │                   │
   ┌──────┴──────────────────┴───────────────────┴───────┐
   │                     PostgreSQL                       │
   │  users/roles/sessions/alert_rules/incidents/audit    │
   └─────────────────────────────────────────────────────┘
          │                  │
   ┌──────┴──────┐   ┌──────┴──────┐
   │Elasticsearch│   │collector-   │
   │ 日志存储/检索 │   │agent (N台)  │
   └─────────────┘   │文件采集+资源 │
                     │指标+Pull API│
                     └─────────────┘
```

### 3.2 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 告警规则存储 | PostgreSQL | 规则量少、需要事务、不需要分布式 |
| 告警评估方式 | 定时扫描（control-plane 内）| 最简实现，6 周内可交付 |
| 通知渠道 | SMTP + 钉钉 Webhook | 最常用两种，短信预留接口 |
| 权限模型 | 简化 RBAC（3 角色 + 模块级权限）| 6 周内可实现，满足"专人专管" |
| 资源监控 | Agent 端采集 + 指标上报 | 复用已有 Agent，不引入 node_exporter |
| 事件管理 | control-plane 内实现 | 与告警强关联，减少跨服务调用 |
| 日志导出 | control-plane 异步任务 | 复用 ES 连接，不新建服务 |

### 3.3 服务职责重新划分

为控制 6 周内的复杂度，**不新建服务**，将新功能合并到已有服务中：

| 服务 | 原有职责 | 新增职责 |
|------|---------|---------|
| `api-service` | 认证 | + 用户管理 + 角色权限 + 操作审计 |
| `control-plane` | 拉取控制 | + 告警规则 + 告警评估 + 告警通知 + 事件管理 + 资源监控 + 日志导出 |
| `query-api` | 日志检索 | + 聚合分析 |
| `collector-agent` | 文件采集 | + 系统资源指标采集 + 加密/压缩 |
| `audit-api` | 占位 | 暂不启用，审计功能合并到 `api-service` |
| `export-api` | 占位 | 暂不启用，导出功能合并到 `control-plane` |

---

## 4. 数据库扩展（新增迁移）

### 4.1 新增表

```sql
-- 角色与权限
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,        -- admin/operator/viewer
    display_name VARCHAR(100) NOT NULL,
    permissions JSONB NOT NULL DEFAULT '{}',  -- {"log_query":true,"alert_manage":true,...}
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id),
    role_id UUID NOT NULL REFERENCES roles(id),
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

-- 告警规则
CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'warning',  -- critical/warning/info
    condition_type VARCHAR(50) NOT NULL,               -- keyword/level_count/threshold
    condition_config JSONB NOT NULL,                   -- {"keyword":"OOM","window":"5m","threshold":3}
    notification_channels JSONB NOT NULL DEFAULT '[]', -- [{"type":"email","target":"ops@example.com"}]
    silence_minutes INT NOT NULL DEFAULT 30,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 告警记录
CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES alert_rules(id),
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    detail TEXT,
    source_id VARCHAR(200),
    agent_id VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'firing', -- firing/resolved/silenced
    fired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    notified_at TIMESTAMPTZ,
    notification_result JSONB
);

-- 事件管理（流程审计）
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL,              -- critical/major/minor
    status VARCHAR(30) NOT NULL DEFAULT 'open', -- open/acknowledged/investigating/resolved/closed
    source_alert_id UUID REFERENCES alert_events(id),
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,                -- 响应时间
    resolved_at TIMESTAMPTZ,                    -- 解决时间
    closed_at TIMESTAMPTZ,                      -- 归档时间
    root_cause TEXT,                             -- 根因分析
    resolution TEXT,                             -- 解决方案
    verdict TEXT,                                -- 运维研判
    sla_response_minutes INT,                   -- SLA 响应时限
    sla_resolve_minutes INT,                    -- SLA 解决时限
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 事件时间线
CREATE TABLE incident_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id),
    action VARCHAR(100) NOT NULL,               -- created/acknowledged/assigned/note_added/resolved/closed
    actor_id UUID REFERENCES users(id),
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 资源监控指标
CREATE TABLE server_metrics (
    id BIGSERIAL PRIMARY KEY,
    agent_id VARCHAR(200) NOT NULL,
    server_id VARCHAR(200) NOT NULL,
    cpu_usage_pct DECIMAL(5,2),
    memory_usage_pct DECIMAL(5,2),
    disk_usage_pct DECIMAL(5,2),
    disk_io_read_bytes BIGINT,
    disk_io_write_bytes BIGINT,
    net_in_bytes BIGINT,
    net_out_bytes BIGINT,
    collected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_server_metrics_agent_time ON server_metrics(agent_id, collected_at DESC);

-- 资源阈值配置
CREATE TABLE resource_thresholds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id VARCHAR(200),                      -- NULL 表示全局默认
    metric_name VARCHAR(50) NOT NULL,           -- cpu_usage_pct/memory_usage_pct/disk_usage_pct
    threshold_value DECIMAL(5,2) NOT NULL,
    comparison VARCHAR(10) NOT NULL DEFAULT '>', -- >/>=/</<=/=
    alert_severity VARCHAR(20) NOT NULL DEFAULT 'warning',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 导出任务
CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_params JSONB NOT NULL,                -- 检索条件
    format VARCHAR(10) NOT NULL DEFAULT 'csv',  -- csv/json
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending/running/completed/failed
    total_records INT,
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    error_message TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ                      -- 文件自动清理时间
);

-- 操作审计日志
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,               -- login/logout/create_user/update_rule/export_logs/...
    resource_type VARCHAR(50),                  -- user/alert_rule/incident/export_job/...
    resource_id VARCHAR(200),
    detail JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_user_time ON audit_logs(user_id, created_at DESC);

-- 通知渠道配置
CREATE TABLE notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    type VARCHAR(30) NOT NULL,                  -- email/dingtalk/sms
    config JSONB NOT NULL,                      -- {"smtp_host":"...","smtp_port":465,...} 或 {"webhook_url":"..."}
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2 种子数据

```sql
INSERT INTO roles (name, display_name, permissions) VALUES
('admin', '超级管理员', '{"all":true}'),
('operator', '运维人员', '{"log_query":true,"alert_manage":true,"incident_manage":true,"source_manage":true,"export":true}'),
('viewer', '只读用户', '{"log_query":true,"dashboard":true}');
```

---

## 5. API 接口规划（新增）

### 5.1 用户与权限（api-service）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/users` | 用户列表 | admin |
| POST | `/api/v1/users` | 创建用户 | admin |
| PUT | `/api/v1/users/:id` | 编辑用户 | admin |
| DELETE | `/api/v1/users/:id` | 禁用用户 | admin |
| PUT | `/api/v1/users/:id/role` | 分配角色 | admin |
| GET | `/api/v1/users/me` | 当前用户信息+权限 | all |
| GET | `/api/v1/roles` | 角色列表 | admin |
| GET | `/api/v1/audit/logs` | 操作审计日志 | admin |

### 5.2 告警管理（control-plane）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/alert/rules` | 规则列表 | operator+ |
| POST | `/api/v1/alert/rules` | 创建规则 | operator+ |
| PUT | `/api/v1/alert/rules/:id` | 更新规则 | operator+ |
| DELETE | `/api/v1/alert/rules/:id` | 删除规则 | operator+ |
| GET | `/api/v1/alert/events` | 告警事件列表 | operator+ |
| POST | `/api/v1/alert/events/:id/resolve` | 手动解决 | operator+ |
| GET | `/api/v1/notification/channels` | 通知渠道列表 | admin |
| POST | `/api/v1/notification/channels` | 创建渠道 | admin |
| PUT | `/api/v1/notification/channels/:id` | 更新渠道 | admin |
| POST | `/api/v1/notification/channels/:id/test` | 测试渠道 | admin |

### 5.3 事件管理（control-plane）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/incidents` | 事件列表 | operator+ |
| GET | `/api/v1/incidents/:id` | 事件详情（含时间线） | operator+ |
| POST | `/api/v1/incidents` | 手动创建事件 | operator+ |
| PUT | `/api/v1/incidents/:id` | 更新事件状态/信息 | operator+ |
| POST | `/api/v1/incidents/:id/acknowledge` | 确认事件（记录响应时间） | operator+ |
| POST | `/api/v1/incidents/:id/resolve` | 解决事件（记录处理时间） | operator+ |
| POST | `/api/v1/incidents/:id/close` | 归档关闭（填写研判结论） | operator+ |
| POST | `/api/v1/incidents/:id/timeline` | 添加时间线记录 | operator+ |
| GET | `/api/v1/incidents/sla/summary` | SLA 统计概览 | operator+ |

### 5.4 资源监控（control-plane）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/metrics/report` | Agent 上报资源指标 | agent |
| GET | `/api/v1/metrics/servers` | 服务器资源列表 | operator+ |
| GET | `/api/v1/metrics/servers/:agent_id` | 单台服务器指标历史 | operator+ |
| GET | `/api/v1/resource/thresholds` | 阈值配置列表 | admin |
| POST | `/api/v1/resource/thresholds` | 创建阈值 | admin |
| PUT | `/api/v1/resource/thresholds/:id` | 更新阈值 | admin |

### 5.5 日志导出（control-plane）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/api/v1/export/jobs` | 创建导出任务 | operator+ |
| GET | `/api/v1/export/jobs` | 导出任务列表 | operator+ |
| GET | `/api/v1/export/jobs/:id/download` | 下载导出文件 | operator+ |

### 5.6 ES 备份（control-plane）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/backup/snapshots` | 备份列表 | admin |
| POST | `/api/v1/backup/snapshots` | 触发备份 | admin |
| POST | `/api/v1/backup/snapshots/:id/restore` | 从备份恢复 | admin |

### 5.7 Dashboard 聚合（query-api）

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| GET | `/api/v1/query/stats/overview` | 概览统计（总量/级别分布/来源Top） | all |
| POST | `/api/v1/query/stats/aggregate` | 自定义聚合 | all |

### 5.8 Agent 资源上报（collector-agent）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/agent/v1/metrics` | 获取当前系统资源指标 |

---

## 6. 六周实施计划

### 总览

| 周次 | 日期 | 主题 | P0 交付 |
|------|------|------|---------|
| W1 | 03-09 ~ 03-15 | 采集链路打通 | Agent 增量采集 → 加密传输 → ES 入库 → 前端可查 |
| W2 | 03-16 ~ 03-22 | 权限 + 告警基础 | RBAC 三角色 + 告警规则引擎 + 邮箱/钉钉通知 |
| W3 | 03-23 ~ 03-29 | 事件管理 + 资源监控 | 全流程审计闭环 + Agent 资源采集 + 阈值告警 |
| W4 | 03-30 ~ 04-05 | 导出/备份 + Dashboard | 日志导出下载 + ES 备份恢复 + Dashboard 真实数据 |
| W5 | 04-06 ~ 04-12 | 联调测试 + 体验优化 | 全链路 E2E 测试 + 前端页面去 mock + UI 打磨 |
| W6 | 04-13 ~ 04-17 | 文档 + 部署 + 验收 | 部署手册 + 用户手册 + 答辩材料 + 最终验收 |

---

### Week 1：采集链路打通（最小通路核心）

**目标**：一条日志从目标服务器产生 → Agent 采集 → 日志服务器拉取（加密） → 写入 ES → 前端可查。

#### 后端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W1-B1 | Agent: 日志级别检测（三层策略） | P0 | 1d |
| W1-B2 | Agent: inode/dev 追踪 + checkpoint 原子写入 | P0 | 1d |
| W1-B3 | Agent: Pull 响应 gzip 压缩 | P0 | 0.5d |
| W1-B4 | Agent + control-plane: 加密传输（AES-256-GCM + HMAC） | P0 | 2d |
| W1-B5 | control-plane: ES 五层字段落库 + event_id 幂等 | P0 | 1d |
| W1-B6 | control-plane: 滑动窗口去重 | P0 | 0.5d |
| W1-B7 | Agent: critical/normal 双通道缓冲 | P0 | 0.5d |

#### 前端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W1-F1 | RealtimeSearch: 补充级别筛选、来源筛选 | P0 | 1d |
| W1-F2 | RealtimeSearch: 日志详情展开（五层字段） | P0 | 0.5d |
| W1-F3 | SourceManagement: 接入 pull-sources 真实 API | P0 | 1d |
| W1-F4 | AgentManagement: 接入 agent 真实 API | P0 | 0.5d |

#### 数据库任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W1-D1 | 创建迁移脚本 000018: roles + user_roles + 种子数据 | P0 | 0.5d |

#### 验收标准

1. 在目标服务器写入一条 `[ERROR] OOM killed` 日志 → Agent 采集并标记 critical → 日志服务器拉取（抓包不可见明文）→ ES 入库（`level=ERROR`、`agent_id` 有值）→ 前端 RealtimeSearch 可搜索到。
2. 重拉同一批次，ES 文档数不增长。
3. 日志轮转后，Agent 正确从新文件继续采集。

---

### Week 2：权限体系 + 告警基础

**目标**：三角色权限控制生效 + 告警规则可配置 + 邮箱/钉钉可发通知。

#### 后端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W2-B1 | api-service: 用户 CRUD 接口 + 角色分配接口 | P0 | 1.5d |
| W2-B2 | api-service: 权限中间件（token → user → role → permission 校验） | P0 | 1d |
| W2-B3 | api-service: `/users/me` 接口（返回权限列表） | P0 | 0.5d |
| W2-B4 | control-plane: 告警规则 CRUD 接口 | P0 | 1d |
| W2-B5 | control-plane: 告警评估引擎（定时扫描 ES） | P0 | 1.5d |
| W2-B6 | control-plane: 通知渠道管理接口 + 邮箱 SMTP 发送 | P0 | 1d |
| W2-B7 | control-plane: 钉钉 Webhook 通知 | P0 | 0.5d |
| W2-B8 | api-service: 操作审计日志记录中间件 | P1 | 0.5d |

#### 前端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W2-F1 | UserManagement: 接入用户 CRUD + 角色分配真实 API | P0 | 1d |
| W2-F2 | RolePermissions: 接入角色列表真实 API | P0 | 0.5d |
| W2-F3 | AppSidebar/AppLayout: 根据 `/users/me` 权限控制菜单显隐 | P0 | 0.5d |
| W2-F4 | AlertRules: 接入告警规则 CRUD 真实 API | P0 | 1d |
| W2-F5 | AlertList: 接入告警事件列表真实 API | P0 | 0.5d |
| W2-F6 | NotificationConfig: 接入通知渠道管理 + 测试发送 | P0 | 0.5d |

#### 数据库任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W2-D1 | 迁移 000019: alert_rules + alert_events + notification_channels + audit_logs | P0 | 0.5d |

#### 验收标准

1. admin 可创建 operator/viewer 用户并分配角色。
2. viewer 用户无法访问告警管理 API（返回 403）。
3. 创建一条告警规则（关键词 `OOM`，窗口 5 分钟，阈值 1 次）→ 产生匹配日志 → 自动触发告警 → 邮箱/钉钉收到通知。
4. 告警事件在前端 AlertList 中可见。

---

### Week 3：事件管理 + 资源监控

**目标**：错误日志全流程审计闭环 + 服务器资源实时监控 + 阈值告警。

#### 后端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W3-B1 | control-plane: 事件 CRUD 接口 | P0 | 1d |
| W3-B2 | control-plane: 事件状态流转 + 时间线记录 | P0 | 1d |
| W3-B3 | control-plane: 告警自动创建事件 | P0 | 0.5d |
| W3-B4 | control-plane: 事件 SLA 统计接口 | P0 | 0.5d |
| W3-B5 | Agent: 系统资源指标采集（CPU/内存/磁盘） | P0 | 1d |
| W3-B6 | control-plane: 资源指标上报接口 + 存储 | P0 | 0.5d |
| W3-B7 | control-plane: 资源阈值配置 + 阈值评估 + 触发告警 | P0 | 1d |
| W3-B8 | control-plane: 资源指标查询接口 | P0 | 0.5d |

#### 前端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W3-F1 | IncidentList: 接入事件列表真实 API | P0 | 0.5d |
| W3-F2 | IncidentDetail: 接入事件详情 + 时间线 + 状态流转操作 | P0 | 1d |
| W3-F3 | IncidentTimeline: 接入事件时间线真实 API | P0 | 0.5d |
| W3-F4 | IncidentArchive: 接入归档管理 | P0 | 0.5d |
| W3-F5 | PerformanceMonitoring: 接入资源监控真实 API + 图表 | P0 | 1d |
| W3-F6 | HealthCheck: 接入阈值配置 | P0 | 0.5d |

#### 数据库任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W3-D1 | 迁移 000020: incidents + incident_timeline + server_metrics + resource_thresholds | P0 | 0.5d |

#### 验收标准

1. 错误日志 → 告警触发 → 自动创建事件 → 运维确认（记录响应时间）→ 标记解决（记录处理时间）→ 填写研判归档 → 事件关闭。完整流程可在前端操作。
2. 事件详情页显示完整时间线（每个阶段的时间和操作人）。
3. Agent 每 30 秒上报一次资源指标 → 前端图表实时刷新。
4. 设置 CPU > 80% 告警阈值 → 超过时自动收到告警通知。

---

### Week 4：导出/备份 + Dashboard

**目标**：日志可导出下载 + ES 可备份恢复 + Dashboard 展示真实数据。

#### 后端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W4-B1 | control-plane: 日志导出任务接口（异步查 ES → 写 CSV/JSON → 存文件） | P0 | 1.5d |
| W4-B2 | control-plane: 导出文件下载接口 | P0 | 0.5d |
| W4-B3 | control-plane: ES snapshot 备份/恢复接口 | P1 | 1d |
| W4-B4 | query-api: Dashboard 概览统计接口（ES 聚合） | P0 | 1d |
| W4-B5 | query-api: 自定义聚合分析接口 | P1 | 0.5d |
| W4-B6 | control-plane: 告警静默策略接口 | P1 | 0.5d |
| W4-B7 | api-service: 审计日志查询接口 | P1 | 0.5d |

#### 前端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W4-F1 | DownloadRecords: 接入导出任务真实 API（创建/列表/下载） | P0 | 1d |
| W4-F2 | BackupRecovery: 接入备份/恢复真实 API | P1 | 0.5d |
| W4-F3 | Dashboard: 接入真实统计 API（趋势图/级别饼图/来源 TopN/告警摘要） | P0 | 1.5d |
| W4-F4 | AggregateAnalysis: 接入聚合分析真实 API | P1 | 0.5d |
| W4-F5 | AuditLogs: 接入操作审计日志真实 API | P1 | 0.5d |
| W4-F6 | SilencePolicy: 接入静默策略真实 API | P1 | 0.5d |

#### 数据库任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W4-D1 | 迁移 000021: export_jobs | P0 | 0.5d |

#### 验收标准

1. 在日志检索页选择条件 → 点击导出 → 任务列表显示进度 → 完成后点击下载 → 获得 CSV 文件。
2. 触发 ES 备份 → 备份列表显示成功 → 删除索引 → 从备份恢复 → 日志可查。
3. Dashboard 概览页展示真实数据（日志趋势/级别分布/来源 TopN/告警摘要/服务健康）。

---

### Week 5：联调测试 + 体验优化

**目标**：全链路 E2E 验证 + 剩余页面去 mock + 前端 UI 打磨。

#### 测试任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W5-T1 | 采集链路 E2E 测试（多源多文件、轮转、压力） | P0 | 1d |
| W5-T2 | 告警 E2E 测试（规则触发、通知送达、静默） | P0 | 1d |
| W5-T3 | 事件管理 E2E 测试（全流程审计） | P0 | 0.5d |
| W5-T4 | 权限 E2E 测试（三角色权限隔离） | P0 | 0.5d |
| W5-T5 | 备份恢复 E2E 测试 | P1 | 0.5d |

#### 后端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W5-B1 | Bug 修复 + 性能优化 | P0 | 2d |
| W5-B2 | Agent graceful shutdown | P1 | 0.5d |
| W5-B3 | 入库前敏感信息脱敏 | P1 | 0.5d |

#### 前端任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W5-F1 | 剩余核心页面去 mock（SourceStatus/IncidentSLA/LoginPolicy） | P1 | 1d |
| W5-F2 | 错误处理统一（API 错误提示、网络异常降级） | P0 | 0.5d |
| W5-F3 | 响应式布局检查 + 移动端适配 | P1 | 0.5d |
| W5-F4 | UI 细节打磨（loading 状态、空数据提示、表单校验） | P1 | 1d |

#### 验收标准

1. 核心链路无阻断性 Bug。
2. 前端核心页面（检索/告警/事件/用户/监控/导出/Dashboard）全部使用真实 API。
3. 三角色权限隔离测试通过。

---

### Week 6：文档 + 部署 + 验收

**目标**：部署到目标环境 + 文档完备 + 最终验收。

#### 文档任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W6-D1 | 部署手册（Docker Compose 一键部署 + 环境变量说明） | P0 | 1d |
| W6-D2 | 用户使用手册（含截图） | P0 | 1d |
| W6-D3 | 数据库设计文档 | P0 | 0.5d |
| W6-D4 | API 接口文档（Swagger 或 Markdown） | P0 | 0.5d |

#### 部署任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W6-P1 | 目标服务器部署全套环境 | P0 | 1d |
| W6-P2 | 冒烟测试 + 参数调优 | P0 | 0.5d |
| W6-P3 | 数据备份 + 版本归档 | P0 | 0.5d |

#### 验收任务

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| W6-V1 | 全功能验收（按第 7 节验收清单逐项） | P0 | 1d |
| W6-V2 | 答辩材料准备 | P0 | 1d |

---

## 7. 验收清单（上线前必须全部满足）

### 7.1 采集与存储（R1）

- [ ] 至少 2 台服务器部署 Agent 并采集日志到 ES。
- [ ] 支持不同路径的日志（nginx、应用日志）同时采集。
- [ ] Pull 响应加密（抓包不可见明文）。
- [ ] ES 文档包含五层字段核心字段。
- [ ] 日志级别检测准确（`[ERROR]`、`"level":"error"` 等格式）。
- [ ] 重拉同批次 ES 文档数不增长。

### 7.2 前端查询（R2）

- [ ] 实时检索页可按关键词/时间/级别/来源搜索日志。
- [ ] 日志详情可展开查看完整字段。
- [ ] Dashboard 概览页展示真实数据。

### 7.3 备份与导出（R3）

- [ ] 可按条件导出日志为 CSV 文件并下载。
- [ ] 可触发 ES 备份并从备份恢复。

### 7.4 告警（R4）

- [ ] 可创建告警规则（关键词/频率）。
- [ ] 匹配规则时自动触发告警。
- [ ] 告警通知至少支持邮箱和钉钉两种渠道。
- [ ] 告警事件在前端可查看。

### 7.5 权限（R5）

- [ ] 三角色（admin/operator/viewer）权限隔离生效。
- [ ] viewer 无法访问管理类 API。
- [ ] 前端菜单根据角色动态显隐。

### 7.6 资源监控（R6）

- [ ] Agent 采集并上报 CPU/内存/磁盘使用率。
- [ ] 前端可查看各服务器资源图表。
- [ ] 超过阈值自动触发告警通知。

### 7.7 流程审计（R7）

- [ ] 错误日志 → 告警 → 创建事件 → 确认 → 解决 → 归档，完整流程可操作。
- [ ] 事件详情页展示完整时间线。
- [ ] 可统计响应时间和处理时间。

### 7.8 文档与部署

- [ ] 部署手册可指导他人独立部署。
- [ ] 用户手册覆盖核心功能操作。

---

## 8. 扩展预留（本轮不实现，保留接口）

| 扩展点 | 预留方式 | 未来方向 |
|--------|---------|---------|
| Syslog 采集 | `SourceTypeSyslog` 已定义 | UDP/TCP syslog 接收器 |
| Kafka 输入 | `pipeline/kafka_producer.go` 已有骨架 | Kafka consumer → ES |
| 容器日志 | Agent 配置支持容器路径 | Docker/K8s stdout/stderr |
| 短信通知 | 通知渠道 `type=sms` 已在数据模型中预留 | 接入阿里云/腾讯云短信 |
| 高级权限 | `permissions` 为 JSONB 灵活字段 | 资源级权限、数据行级隔离 |
| 实时推送告警 | WebSocket 路由已配置 | SSE/WebSocket 实时告警 |
| ML 异常检测 | 前端 `AnomalyDetection` 页面已有 | 接入 ML 模型 |
| 多行日志 | 配置结构已预留 `multiline` | 正则模式合并 |
| PII 脱敏 | `pii_masked` 字段已预留 | 正则规则引擎 |
| 分布式追踪 | 前端 tracing 页面已有 | 接入 Jaeger/OTLP |

---

## 9. 风险与应对

| 风险 | 触发条件 | 影响 | 应对策略 |
|------|---------|------|---------|
| 开发容量不足 | 单人开发，周任务超载 | P0 任务延期 | 砍 P1/P2，保 P0 最小通路 |
| ES 性能瓶颈 | 写入/查询延迟高 | 告警评估不及时 | 简化聚合查询、加缓存 |
| 加密增加复杂度 | 加解密实现 bug | 日志无法入库 | 提供 fallback 明文模式开关 |
| Agent 部署到远程 | 网络不通/权限不足 | 采集链路不通 | 预编译二进制 + systemd 双模式 |
| 前端去 mock 工作量大 | 60 个页面 | 核心页面未完成 | 只去 mock 核心 15 个页面 |

---

## 10. 与已有文档的关系

| 文档 | 关系 |
|------|------|
| `11-current-project-overall-planning.md` | 本文档为其 v2 升级版，扩展了 R3~R7 需求 |
| `14-topic-proposal-8-week-plan.md` | 本文档为其执行细化版（压缩到 6 周） |
| `20-log-ingest-e2e-workflow-v2.md` | 采集链路规范，R1 的技术口径遵循此文档 |
| `21-log-ingest-e2e-implementation-taskbook.md` | R1 的代码级任务分解，W1 任务映射到 T-01~T-04 |
| `10-current-project-tasks.md` | M1 已完成任务记录，本文档从 M2/M3 接续 |

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-03-06 | v1.0 | 初始版本，完整 R1~R9 需求 + 6 周实施计划 |
