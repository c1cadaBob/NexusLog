# 模块二十五：数据模型与系统接口

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块二十五：数据模型与系统接口  
> **实施阶段**: MVP/Phase 2/Phase 3

---

## 模块概述

定义系统核心数据模型、REST API 接口规范、外部系统集成接口和用户界面需求。

---

## 一、核心数据模型

### 1.1 日志条目 (LogEntry)

**数据结构**:

```json
{
  "@timestamp": "2026-01-27T10:30:45.123Z",
  "@version": "1",
  "id": "uuid-v4",
  "level": "ERROR",
  "message": "Database connection timeout",
  "source": {
    "service": "api-gateway",
    "host": "server-01",
    "ip": "192.168.1.100",
    "container_id": "abc123",
    "pod_name": "api-gateway-7d8f9c-xyz"
  },
  "fields": {
    "request_id": "req-abc-123",
    "user_id": "user-456",
    "duration_ms": 5000,
    "status_code": 500
  },
  "tags": ["production", "critical"],
  "_meta": {
    "collector_version": "1.0.0",
    "processed_at": "2026-01-27T10:30:45.150Z",
    "pipeline": "default"
  }
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 | 索引 |
|------|------|------|------|------|
| @timestamp | datetime | ✅ | 日志生成时间 (ISO 8601) | ✅ |
| @version | string | ✅ | 数据格式版本 | ❌ |
| id | string | ✅ | 唯一标识符 (UUID v4) | ✅ |
| level | enum | ✅ | 日志级别 (DEBUG/INFO/WARN/ERROR/FATAL) | ✅ |
| message | text | ✅ | 日志消息内容 | ✅ 全文索引 |
| source.service | keyword | ✅ | 服务名称 | ✅ |
| source.host | keyword | ✅ | 主机名 | ✅ |
| source.ip | ip | ❌ | IP 地址 | ✅ |
| fields | object | ❌ | 自定义字段 | 动态映射 |
| tags | keyword[] | ❌ | 标签数组 | ✅ |

**存储策略**:
- 热存储 (0-7天): Elasticsearch, SSD, 3副本
- 温存储 (8-30天): Elasticsearch, HDD, 2副本, 压缩
- 冷存储 (31天-1年): MinIO/S3, 1副本, 高压缩

---

### 1.2 备份元数据 (BackupMetadata)

**数据结构**:

```json
{
  "id": "backup-uuid",
  "name": "production_full_20260127",
  "description": "生产环境全量备份",
  "type": "full",
  "status": "success",
  "repository": "log-backups",
  "path": "/var/lib/elasticsearch/snapshots",
  "indices": ["logs-2026.01.*"],
  "created_at": "2026-01-27T10:00:00Z",
  "completed_at": "2026-01-27T10:15:00Z",
  "size_bytes": 10737418240,
  "document_count": 1000000,
  "shard_count": 5,
  "based_on": "backup-parent-uuid",
  "checksum": "sha256:abc123...",
  "metadata": {
    "created_by": "admin",
    "retention_days": 30,
    "tags": ["production", "monthly"]
  }
}
```

**字段说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | ✅ | 备份唯一标识符 |
| name | string | ✅ | 备份名称 (用户自定义或自动生成) |
| type | enum | ✅ | 备份类型 (full/incremental) |
| status | enum | ✅ | 状态 (pending/in_progress/success/failed) |
| size_bytes | long | ✅ | 备份大小 (字节) |
| based_on | string | ❌ | 增量备份的基准备份 ID |

**存储位置**: PostgreSQL (元数据) + Elasticsearch Snapshot Repository (实际数据)

---

### 1.3 告警规则 (AlertRule)

**数据结构**:

```json
{
  "id": "rule-uuid",
  "name": "高错误率告警",
  "description": "当错误率超过5%时触发告警",
  "enabled": true,
  "severity": "high",
  "query": "level:ERROR",
  "condition": {
    "type": "threshold",
    "operator": "gt",
    "value": 100,
    "window": "5m"
  },
  "actions": [
    {
      "type": "email",
      "recipients": ["ops@example.com"],
      "template": "error_alert"
    },
    {
      "type": "webhook",
      "url": "https://hooks.slack.com/xxx",
      "method": "POST"
    }
  ],
  "throttle": "15m",
  "tags": ["production", "critical"],
  "created_at": "2026-01-27T10:00:00Z",
  "updated_at": "2026-01-27T10:00:00Z",
  "created_by": "admin"
}
```

**存储位置**: PostgreSQL

---

### 1.4 用户与权限 (User & Permission)

**用户数据结构**:

```json
{
  "id": "user-uuid",
  "username": "admin",
  "email": "admin@example.com",
  "display_name": "系统管理员",
  "roles": ["admin", "operator"],
  "tenant_id": "tenant-uuid",
  "status": "active",
  "mfa_enabled": true,
  "last_login_at": "2026-01-27T10:00:00Z",
  "created_at": "2026-01-20T00:00:00Z"
}
```

**角色数据结构**:

```json
{
  "id": "role-uuid",
  "name": "operator",
  "display_name": "运维工程师",
  "permissions": [
    "logs:read",
    "logs:search",
    "alerts:read",
    "alerts:create",
    "backups:read"
  ],
  "tenant_id": "tenant-uuid"
}
```

**存储位置**: PostgreSQL (启用 RLS 行级安全)

---

## 二、数据流

### 2.1 日志采集流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  日志源     │────▶│ Log Agent   │────▶│   Kafka     │────▶│  Collector  │
│ (应用/系统) │     │ (采集代理)  │     │ (消息队列)  │     │ (采集服务)  │
└─────────────┘     └─────────────┘     └─────────────┘     └──────┬──────┘
                                                                    │
                    ┌───────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Processor   │────▶│    Redis    │────▶│Elasticsearch│
│ (数据处理)  │     │   (缓存)    │     │  (存储)     │
└─────────────┘     └─────────────┘     └─────────────┘
```

**数据流说明**:
1. **采集阶段**: Log Agent 从日志源采集原始日志
2. **传输阶段**: 通过 Kafka 进行可靠传输和解耦
3. **处理阶段**: Collector 消费 Kafka 消息，进行清洗、解析、脱敏
4. **缓存阶段**: Redis 缓存热点查询和聚合结果
5. **存储阶段**: Elasticsearch 存储结构化日志数据

---

### 2.2 查询流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   用户      │────▶│  API Server │────▶│    Redis    │
│  (浏览器)   │     │  (查询接口) │     │  (查询缓存) │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           │ Cache Miss        │ Cache Hit
                           ▼                   │
                    ┌─────────────┐            │
                    │Elasticsearch│            │
                    │  (查询引擎) │            │
                    └──────┬──────┘            │
                           │                   │
                           └───────────────────┘
                                   │
                                   ▼
                           ┌─────────────┐
                           │  返回结果   │
                           └─────────────┘
```

---

## 三、REST API 接口

### 3.1 日志查询 API

**端点**: `GET /api/v1/logs`

**请求参数**:

```json
{
  "query": "level:ERROR AND service:api-gateway",
  "start_time": "2026-01-27T00:00:00Z",
  "end_time": "2026-01-27T23:59:59Z",
  "page": 1,
  "page_size": 100,
  "sort": "-@timestamp",
  "fields": ["@timestamp", "level", "message", "source.service"]
}
```

**响应示例**:

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "total": 1234,
    "page": 1,
    "page_size": 100,
    "logs": [
      {
        "@timestamp": "2026-01-27T10:30:45.123Z",
        "level": "ERROR",
        "message": "Database connection timeout",
        "source": {
          "service": "api-gateway"
        }
      }
    ]
  },
  "took_ms": 150
}
```

**状态码**:
- 200: 成功
- 400: 参数错误
- 401: 未授权
- 403: 无权限
- 500: 服务器错误

---

### 3.2 备份管理 API

| 方法 | 端点 | 说明 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | /api/v1/backups | 创建备份 | BackupRequest | BackupMetadata |
| GET | /api/v1/backups | 列出备份 | Query Params | BackupList |
| GET | /api/v1/backups/{id} | 获取备份详情 | - | BackupMetadata |
| DELETE | /api/v1/backups/{id} | 删除备份 | - | 204 No Content |
| GET | /api/v1/backups/{id}/download | 下载备份 | - | File Stream |
| POST | /api/v1/backups/import | 导入备份 | Multipart File | BackupMetadata |
| GET | /api/v1/backups/stats | 备份统计 | - | BackupStats |

**创建备份请求示例**:

```json
{
  "name": "production_full_20260127",
  "description": "生产环境全量备份",
  "type": "full",
  "repository": "log-backups",
  "path": "/var/lib/elasticsearch/snapshots",
  "indices": ["logs-2026.01.*"]
}
```

---

### 3.3 告警管理 API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | /api/v1/alerts/rules | 创建告警规则 |
| GET | /api/v1/alerts/rules | 列出告警规则 |
| PUT | /api/v1/alerts/rules/{id} | 更新告警规则 |
| DELETE | /api/v1/alerts/rules/{id} | 删除告警规则 |
| GET | /api/v1/alerts/history | 告警历史 |
| POST | /api/v1/alerts/{id}/ack | 确认告警 |
| POST | /api/v1/alerts/{id}/silence | 静默告警 |

---

## 四、外部系统集成

### 4.1 监控系统集成

**Prometheus 指标端点**: `GET /metrics`

**暴露指标**:

```
# 日志摄入速率
log_ingestion_rate{service="collector"} 10000

# 查询延迟
log_query_duration_seconds{quantile="0.5"} 0.1
log_query_duration_seconds{quantile="0.95"} 0.5
log_query_duration_seconds{quantile="0.99"} 1.0

# 存储使用
log_storage_bytes{tier="hot"} 10737418240
log_storage_bytes{tier="warm"} 53687091200
log_storage_bytes{tier="cold"} 107374182400

# 告警统计
alert_total{severity="high"} 10
alert_total{severity="medium"} 50
```

---

### 4.2 通知系统集成

**支持的通知渠道**:

| 渠道 | 协议 | 配置示例 |
|------|------|----------|
| 邮件 | SMTP | smtp://smtp.example.com:587 |
| Slack | Webhook | https://hooks.slack.com/services/xxx |
| 企业微信 | Webhook | https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx |
| 钉钉 | Webhook | https://oapi.dingtalk.com/robot/send?access_token=xxx |
| PagerDuty | API | https://events.pagerduty.com/v2/enqueue |
| Webhook | HTTP | 自定义 URL |

**Webhook 请求格式**:

```json
{
  "alert_id": "alert-uuid",
  "rule_name": "高错误率告警",
  "severity": "high",
  "message": "错误率超过5%",
  "timestamp": "2026-01-27T10:30:45Z",
  "details": {
    "query": "level:ERROR",
    "count": 150,
    "threshold": 100
  },
  "actions": ["investigate", "acknowledge"]
}
```

---

## 五、用户界面需求

### 5.1 响应式设计

#### 桌面端布局 (≥1200px)

```
┌─────────────────────────────────────────────────────────────┐
│  顶部导航栏 (固定)                                          │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  侧边栏  │              主内容区                            │
│  (200px) │              (自适应宽度)                        │
│          │                                                  │
│  • 搜索  │                                                  │
│  • 仪表盘│                                                  │
│  • 告警  │                                                  │
│  • 备份  │                                                  │
│          │                                                  │
└──────────┴──────────────────────────────────────────────────┘
```

#### 平板端布局 (768px - 1199px)

```
┌─────────────────────────────────────────────────────────────┐
│  顶部导航栏 + 汉堡菜单                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              主内容区 (全宽)                                │
│                                                             │
│  侧边栏折叠为抽屉式菜单                                     │
│  点击汉堡菜单展开                                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 移动端布局 (<768px)

```
┌──────────────────────┐
│  顶部导航栏          │
│  [☰] Logo  [🔔]     │
├──────────────────────┤
│                      │
│  主内容区            │
│  (单列布局)          │
│                      │
│  • 卡片式展示        │
│  • 垂直滚动          │
│  • 简化操作按钮      │
│                      │
└──────────────────────┘
```

---

### 5.2 可访问性要求

#### 键盘导航

| 快捷键 | 功能 | 适用页面 |
|--------|------|----------|
| `/` | 聚焦搜索框 | 全局 |
| `Ctrl+K` | 打开命令面板 | 全局 |
| `Esc` | 关闭对话框/取消操作 | 全局 |
| `Enter` | 确认/提交 | 表单 |
| `↑` `↓` | 导航列表 | 列表页面 |
| `Space` | 选择/取消选择 | 复选框 |
| `Tab` | 切换焦点 | 全局 |
| `Shift+Tab` | 反向切换焦点 | 全局 |

---

### 5.3 国际化 (i18n)

**支持语言**:

**MVP 阶段**:
- 简体中文 (zh-CN) - 默认
- 英文 (en-US)

**Phase 2 阶段**:
- 繁体中文 (zh-TW)
- 日文 (ja-JP)
- 韩文 (ko-KR)

**日期时间格式**:

| 语言 | 日期格式 | 时间格式 | 示例 |
|------|----------|----------|------|
| zh-CN | YYYY-MM-DD | HH:mm:ss | 2026-01-27 10:30:45 |
| en-US | MM/DD/YYYY | hh:mm:ss A | 01/27/2026 10:30:45 AM |
| ja-JP | YYYY年MM月DD日 | HH:mm:ss | 2026年01月27日 10:30:45 |

---

## 配置热更新

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| api_rate_limit | int | 1000 | API 速率限制（次/分钟） |
| query_timeout | int | 30 | 查询超时时间（秒） |
| max_page_size | int | 1000 | 最大分页大小 |

**热更新机制**:
- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置

---

## 相关需求

本模块为所有其他模块提供数据模型和接口定义支持。
