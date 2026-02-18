# 模块二十五：数据模型与系统接口 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module25.md](../requirements/requirements-module25.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP

### 1.3 相关文档
- [需求文档](../requirements/requirements-module25.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [所有模块设计文档](./README.md)

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────┐
│                数据模型与系统接口架构                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  核心数据模型层                                       │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ LogEntry   │  │ BackupMeta │  │ AlertRule  │     │      │
│  │  │ (日志条目)  │  │ (备份元数据)│  │ (告警规则)  │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  │  ┌────────────┐  ┌────────────┐                     │      │
│  │  │ User/Role  │  │ Tenant     │                     │      │
│  │  │ (用户权限)  │  │ (租户)     │                     │      │
│  │  └────────────┘  └────────────┘                     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  REST API 接口层                                      │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 日志查询API │  │ 备份管理API │  │ 告警管理API │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  │  ┌────────────┐  ┌────────────┐                     │      │
│  │  │ 用户管理API │  │ 系统监控API │                     │      │
│  │  └────────────┘  └────────────┘                     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  外部系统集成层                                       │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ Prometheus │  │ 通知系统    │  │ SSO集成     │     │      │
│  │  │ (监控指标)  │  │ (告警通知)  │  │ (身份认证)  │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  用户界面层                                           │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ Web Console│  │ 移动端适配  │  │ 国际化支持  │     │      │
│  │  │ (React)    │  │ (响应式)   │  │ (i18n)     │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 数据模型层 | 统一数据定义 | LogEntry、BackupMetadata、AlertRule、User/Permission |
| API接口层 | 对外服务接口 | REST API、GraphQL、gRPC接口 |
| 集成层 | 外部系统对接 | Prometheus、通知系统、SSO、Webhook |
| UI层 | 用户交互界面 | 响应式设计、国际化、可访问性 |
| 数据流管理 | 数据流转控制 | 采集流程、查询流程、备份流程 |

### 2.3 关键路径
```
数据采集路径: 日志源 → Log Agent → Kafka → Collector → Processor → Redis → Elasticsearch (200ms)
数据查询路径: 用户请求 → API Server → Redis缓存 → Elasticsearch → 结果返回 (500ms)
数据备份路径: 定时任务 → 备份管理器 → ES快照 → 加密压缩 → S3存储 (分钟级)
告警触发路径: 日志流 → 规则引擎 → 告警生成 → 通知系统 → 用户接收 (秒级)
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、类型安全、并发友好 |
| PostgreSQL | 15+ | 关系型数据、ACID保证、RLS支持 |
| Elasticsearch | 8.11+ | 全文检索、分布式存储、高性能查询 |
| Redis | 7.2+ | 缓存、配置分发、Pub/Sub通知 |
| React | 18+ | 组件化、虚拟DOM、生态丰富 |
| TypeScript | 5.0+ | 类型安全、IDE支持好 |
| Ant Design | 5.0+ | 企业级UI组件、国际化支持 |
| OpenAPI | 3.1 | API规范标准、自动生成文档 |

### 3.2 数据存储选型对比

| 存储类型 | 技术方案 | 适用场景 | 优势 | 劣势 |
|---------|---------|---------|------|------|
| 元数据存储 | PostgreSQL | 用户、权限、配置、备份元数据 | ACID、关系查询、RLS | 扩展性有限 |
| 日志存储 | Elasticsearch | 日志数据、全文检索 | 全文检索、分布式、高性能 | 不支持事务 |
| 缓存存储 | Redis | 查询缓存、配置缓存、会话 | 高性能、Pub/Sub | 内存限制 |
| 对象存储 | MinIO/S3 | 备份文件、归档数据 | 成本低、容量大 | 访问延迟高 |

### 3.3 API协议选型

| 协议 | 使用场景 | 优势 | 选择 |
|------|---------|------|------|
| REST | 主要API接口 | 简单、标准、易调试 | ✅ 主要 |
| GraphQL | 复杂查询场景 | 灵活查询、减少请求 | ⚠️ Phase 2 |
| gRPC | 内部服务通信 | 高性能、类型安全 | ⚠️ Phase 2 |
| WebSocket | 实时推送 | 双向通信、低延迟 | ✅ 告警推送 |

---

## 4. 关键流程设计

### 4.1 日志采集流程

**流程说明**:
```
1. 日志源生成日志 (应用/系统/网络设备)
2. Log Agent采集日志 (文件/Syslog/HTTP)
3. 本地预处理 (格式化、初步过滤)
4. 发送到Kafka消息队列 (异步解耦)
5. Collector消费Kafka消息
6. 数据处理管道:
   - 清洗: 去除无效字段
   - 解析: Grok/JSON解析
   - 脱敏: 敏感信息脱敏
   - 去重: 基于内容哈希去重
   - 标准化: 统一字段格式
7. 写入Redis缓存 (热点数据)
8. 批量写入Elasticsearch (持久化)
9. 更新统计指标
```

**时序图**:
```
日志源  Agent  Kafka  Collector  Processor  Redis  ES
  │      │      │        │          │        │     │
  │─生成→│      │        │          │        │     │
  │      │─采集→│        │          │        │     │
  │      │      │─消费→  │          │        │     │
  │      │      │        │─处理→    │        │     │
  │      │      │        │          │─清洗→  │     │
  │      │      │        │          │─脱敏→  │     │
  │      │      │        │          │─去重→  │     │
  │      │      │        │          │        │─缓存→│
  │      │      │        │          │        │     │─存储→
```

**性能指标**:
- 端到端延迟: < 200ms (P95)
- 吞吐量: 100万条/秒
- 数据丢失率: < 0.01%

### 4.2 日志查询流程

**流程说明**:
```
1. 用户在Web Console输入查询条件
2. 前端构建查询请求 (时间范围、关键词、过滤条件)
3. API Server接收请求
4. 认证授权检查 (JWT验证、权限校验)
5. 查询缓存检查 (Redis):
   - 缓存命中: 直接返回结果
   - 缓存未命中: 继续查询
6. 构建Elasticsearch查询DSL
7. 执行ES查询 (分页、排序、聚合)
8. 结果后处理 (脱敏、格式化)
9. 写入缓存 (TTL 5分钟)
10. 返回结果给前端
11. 前端渲染展示
```

**查询优化策略**:
- 缓存热点查询 (命中率 > 60%)
- 查询结果分页 (默认100条/页)
- 时间范围限制 (最大7天)
- 查询超时控制 (30秒)
- 慢查询日志记录 (> 5秒)

### 4.3 备份恢复流程

**全量备份流程**:
```
1. 定时任务触发 (每周日凌晨2点)
2. 创建ES快照 (snapshot API)
3. 导出所有索引数据
4. 计算SHA-256校验和
5. AES-256加密
6. Zstd压缩 (压缩率 > 70%)
7. 上传到S3 (分片上传)
8. 跨区域复制 (容灾)
9. 验证备份完整性
10. 更新备份元数据到PostgreSQL
11. 发送备份完成通知
```

**增量备份流程**:
```
1. 定时任务触发 (每天凌晨3点)
2. 获取上次备份时间点
3. 查询变更数据 (基于@timestamp)
4. 导出增量数据
5. 压缩加密
6. 上传到S3
7. 记录基准备份ID (based_on字段)
8. 更新备份元数据
```

**恢复流程**:
```
1. 用户选择恢复时间点
2. 查找对应的全量备份
3. 查找所有相关增量备份
4. 下载备份文件 (并行下载)
5. 验证完整性 (SHA-256)
6. 解密解压
7. 按顺序恢复数据:
   - 先恢复全量备份
   - 再按时间顺序恢复增量备份
8. 验证数据一致性
9. 重建索引
10. 恢复完成通知
```

### 4.4 告警触发流程

**流程说明**:
```
1. 日志流进入告警引擎
2. 规则引擎匹配告警规则:
   - 阈值规则: 错误率 > 5%
   - 模式规则: 连续3次失败
   - 异常规则: ML模型检测
3. 触发条件满足
4. 告警聚合 (5分钟窗口内相同告警合并)
5. 告警抑制 (静默期内不重复发送)
6. 告警升级 (根据严重程度)
7. 通知分发:
   - 邮件通知
   - 短信通知
   - Webhook推送
   - 企业微信/钉钉
8. 记录告警历史
9. 等待用户确认
10. 自动响应执行 (如配置)
```

**告警状态机**:
```
[待触发] → [已触发] → [已发送] → [已确认] → [已解决]
                ↓
            [已静默]
```

### 4.5 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| API请求失败 | 返回错误码、记录日志 | 客户端重试(指数退避) |
| 数据库连接失败 | 连接池重试、降级服务 | 自动重连、告警通知 |
| ES查询超时 | 取消查询、返回部分结果 | 优化查询、增加资源 |
| 缓存失效 | 直接查询数据库 | 重建缓存 |
| 备份失败 | 记录失败原因、告警 | 手动重试、检查存储 |
| 通知发送失败 | 重试3次、记录失败日志 | 人工介入 |

---

## 5. 接口设计

### 5.1 API概览

详见 [API设计文档](./api-design.md) 模块25部分，本模块定义了系统所有核心API接口规范。

### 5.2 日志查询API

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
          "service": "api-gateway",
          "host": "server-01"
        }
      }
    ]
  },
  "took_ms": 150
}
```

### 5.3 备份管理API

**创建备份**: `POST /api/v1/backups`

**请求体**:
```json
{
  "name": "production_full_20260127",
  "description": "生产环境全量备份",
  "type": "full",
  "repository": "log-backups",
  "indices": ["logs-2026.01.*"]
}
```

**响应**:
```json
{
  "code": 0,
  "message": "备份任务已创建",
  "data": {
    "id": "backup-uuid",
    "status": "in_progress",
    "created_at": "2026-01-27T10:00:00Z"
  }
}
```

**其他备份API**:
- `GET /api/v1/backups` - 列出备份
- `GET /api/v1/backups/{id}` - 获取备份详情
- `DELETE /api/v1/backups/{id}` - 删除备份
- `GET /api/v1/backups/{id}/download` - 下载备份
- `POST /api/v1/backups/import` - 导入备份
- `GET /api/v1/backups/stats` - 备份统计

### 5.4 告警管理API

**创建告警规则**: `POST /api/v1/alerts/rules`

**请求体**:
```json
{
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
      "recipients": ["ops@example.com"]
    }
  ],
  "throttle": "15m"
}
```

### 5.5 用户管理API

**用户认证**: `POST /api/v1/auth/login`

**请求体**:
```json
{
  "username": "admin",
  "password": "encrypted_password",
  "mfa_code": "123456"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_in": 3600,
    "user": {
      "id": "user-uuid",
      "username": "admin",
      "roles": ["admin"]
    }
  }
}
```

### 5.6 监控指标API

**Prometheus指标端点**: `GET /metrics`

**暴露指标**:
```prometheus
# 日志摄入速率
log_ingestion_rate{service="collector"} 10000

# 查询延迟
log_query_duration_seconds{quantile="0.5"} 0.1
log_query_duration_seconds{quantile="0.95"} 0.5
log_query_duration_seconds{quantile="0.99"} 1.0

# 存储使用
log_storage_bytes{tier="hot"} 10737418240
log_storage_bytes{tier="warm"} 53687091200

# API请求统计
api_requests_total{method="GET",endpoint="/api/v1/logs",status="200"} 1000
api_request_duration_seconds{endpoint="/api/v1/logs"} 0.15

# 告警统计
alert_total{severity="high"} 10
alert_total{severity="medium"} 50
```

### 5.7 Webhook集成

**Webhook请求格式**:
```json
{
  "event_type": "alert.triggered",
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

### 5.8 API通用规范

**统一响应格式**:
```json
{
  "code": 0,           // 0表示成功，非0表示错误
  "message": "string", // 响应消息
  "data": {},          // 响应数据
  "took_ms": 100       // 请求耗时(毫秒)
}
```

**错误码定义**:
| 错误码 | 说明 | HTTP状态码 |
|--------|------|-----------|
| 0 | 成功 | 200 |
| 1001 | 参数错误 | 400 |
| 1002 | 认证失败 | 401 |
| 1003 | 权限不足 | 403 |
| 1004 | 资源不存在 | 404 |
| 1005 | 请求超时 | 408 |
| 1006 | 请求过于频繁 | 429 |
| 2001 | 服务器内部错误 | 500 |
| 2002 | 服务不可用 | 503 |

**认证方式**:
- JWT Bearer Token
- API Key (用于服务间调用)
- OAuth 2.0 (Phase 2)

**限流策略**:
- 默认: 1000次/分钟/用户
- 查询API: 100次/分钟/用户
- 写入API: 10000次/分钟/租户

---

## 6. 数据设计

### 6.1 核心数据模型

#### 6.1.1 日志条目 (LogEntry)

**Go结构体定义**:
```go
// LogEntry 日志条目数据模型
type LogEntry struct {
    // 基础字段
    Timestamp   time.Time              `json:"@timestamp" es:"date"`
    Version     string                 `json:"@version" es:"keyword"`
    ID          string                 `json:"id" es:"keyword"`
    Level       LogLevel               `json:"level" es:"keyword"`
    Message     string                 `json:"message" es:"text"`
    
    // 来源信息
    Source      LogSource              `json:"source"`
    
    // 自定义字段
    Fields      map[string]interface{} `json:"fields" es:"object"`
    
    // 标签
    Tags        []string               `json:"tags" es:"keyword"`
    
    // 元数据
    Meta        LogMeta                `json:"_meta"`
}

// LogLevel 日志级别枚举
type LogLevel string

const (
    LogLevelDebug LogLevel = "DEBUG"
    LogLevelInfo  LogLevel = "INFO"
    LogLevelWarn  LogLevel = "WARN"
    LogLevelError LogLevel = "ERROR"
    LogLevelFatal LogLevel = "FATAL"
)

// LogSource 日志来源
type LogSource struct {
    Service     string `json:"service" es:"keyword"`
    Host        string `json:"host" es:"keyword"`
    IP          string `json:"ip" es:"ip"`
    ContainerID string `json:"container_id,omitempty" es:"keyword"`
    PodName     string `json:"pod_name,omitempty" es:"keyword"`
}

// LogMeta 日志元数据
type LogMeta struct {
    CollectorVersion string    `json:"collector_version"`
    ProcessedAt      time.Time `json:"processed_at"`
    Pipeline         string    `json:"pipeline"`
}
```

**Elasticsearch映射**:
```json
{
  "mappings": {
    "properties": {
      "@timestamp": {
        "type": "date",
        "format": "strict_date_optional_time||epoch_millis"
      },
      "@version": {
        "type": "keyword"
      },
      "id": {
        "type": "keyword"
      },
      "level": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "source": {
        "properties": {
          "service": {"type": "keyword"},
          "host": {"type": "keyword"},
          "ip": {"type": "ip"}
        }
      },
      "fields": {
        "type": "object",
        "dynamic": true
      },
      "tags": {
        "type": "keyword"
      }
    }
  }
}
```

#### 6.1.2 备份元数据 (BackupMetadata)

**Go结构体定义**:
```go
// BackupMetadata 备份元数据
type BackupMetadata struct {
    ID            string                 `json:"id" db:"id"`
    Name          string                 `json:"name" db:"name"`
    Description   string                 `json:"description" db:"description"`
    Type          BackupType             `json:"type" db:"type"`
    Status        BackupStatus           `json:"status" db:"status"`
    Repository    string                 `json:"repository" db:"repository"`
    Path          string                 `json:"path" db:"path"`
    Indices       []string               `json:"indices" db:"indices"`
    CreatedAt     time.Time              `json:"created_at" db:"created_at"`
    CompletedAt   *time.Time             `json:"completed_at,omitempty" db:"completed_at"`
    SizeBytes     int64                  `json:"size_bytes" db:"size_bytes"`
    DocumentCount int64                  `json:"document_count" db:"document_count"`
    ShardCount    int                    `json:"shard_count" db:"shard_count"`
    BasedOn       *string                `json:"based_on,omitempty" db:"based_on"`
    Checksum      string                 `json:"checksum" db:"checksum"`
    Metadata      map[string]interface{} `json:"metadata" db:"metadata"`
}

// BackupType 备份类型
type BackupType string

const (
    BackupTypeFull        BackupType = "full"
    BackupTypeIncremental BackupType = "incremental"
)

// BackupStatus 备份状态
type BackupStatus string

const (
    BackupStatusPending    BackupStatus = "pending"
    BackupStatusInProgress BackupStatus = "in_progress"
    BackupStatusSuccess    BackupStatus = "success"
    BackupStatusFailed     BackupStatus = "failed"
)
```

**PostgreSQL表设计**:
```sql
CREATE TABLE backup_metadata (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'in_progress', 'success', 'failed')),
    repository VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    indices TEXT[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    document_count BIGINT NOT NULL DEFAULT 0,
    shard_count INTEGER NOT NULL DEFAULT 0,
    based_on VARCHAR(64) REFERENCES backup_metadata(id),
    checksum VARCHAR(128) NOT NULL,
    metadata JSONB,
    
    -- 索引
    INDEX idx_backup_created_at (created_at DESC),
    INDEX idx_backup_status (status),
    INDEX idx_backup_type (type)
);

-- 备份保留策略触发器
CREATE OR REPLACE FUNCTION cleanup_old_backups()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM backup_metadata
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND status = 'success';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_backups
AFTER INSERT ON backup_metadata
EXECUTE FUNCTION cleanup_old_backups();
```

#### 6.1.3 告警规则 (AlertRule)

**Go结构体定义**:
```go
// AlertRule 告警规则
type AlertRule struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Description string                 `json:"description" db:"description"`
    Enabled     bool                   `json:"enabled" db:"enabled"`
    Severity    AlertSeverity          `json:"severity" db:"severity"`
    Query       string                 `json:"query" db:"query"`
    Condition   AlertCondition         `json:"condition" db:"condition"`
    Actions     []AlertAction          `json:"actions" db:"actions"`
    Throttle    string                 `json:"throttle" db:"throttle"`
    Tags        []string               `json:"tags" db:"tags"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
}

// AlertSeverity 告警严重程度
type AlertSeverity string

const (
    AlertSeverityLow      AlertSeverity = "low"
    AlertSeverityMedium   AlertSeverity = "medium"
    AlertSeverityHigh     AlertSeverity = "high"
    AlertSeverityCritical AlertSeverity = "critical"
)

// AlertCondition 告警条件
type AlertCondition struct {
    Type     string      `json:"type"`     // threshold, pattern, anomaly
    Operator string      `json:"operator"` // gt, lt, eq, ne
    Value    interface{} `json:"value"`
    Window   string      `json:"window"`   // 5m, 1h, 1d
}

// AlertAction 告警动作
type AlertAction struct {
    Type       string                 `json:"type"` // email, webhook, slack
    Recipients []string               `json:"recipients,omitempty"`
    URL        string                 `json:"url,omitempty"`
    Template   string                 `json:"template,omitempty"`
    Params     map[string]interface{} `json:"params,omitempty"`
}
```

**PostgreSQL表设计**:
```sql
CREATE TABLE alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    query TEXT NOT NULL,
    condition JSONB NOT NULL,
    actions JSONB NOT NULL,
    throttle VARCHAR(20) NOT NULL DEFAULT '15m',
    tags TEXT[],
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    
    -- 索引
    INDEX idx_alert_enabled (enabled),
    INDEX idx_alert_severity (severity),
    INDEX idx_alert_tenant (tenant_id)
);

-- 更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alert_updated_at
BEFORE UPDATE ON alert_rules
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();
```

#### 6.1.4 用户与权限 (User & Permission)

**Go结构体定义**:
```go
// User 用户
type User struct {
    ID          string    `json:"id" db:"id"`
    Username    string    `json:"username" db:"username"`
    Email       string    `json:"email" db:"email"`
    DisplayName string    `json:"display_name" db:"display_name"`
    PasswordHash string   `json:"-" db:"password_hash"`
    Roles       []string  `json:"roles" db:"roles"`
    TenantID    string    `json:"tenant_id" db:"tenant_id"`
    Status      string    `json:"status" db:"status"`
    MFAEnabled  bool      `json:"mfa_enabled" db:"mfa_enabled"`
    MFASecret   string    `json:"-" db:"mfa_secret"`
    LastLoginAt *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Role 角色
type Role struct {
    ID          string   `json:"id" db:"id"`
    Name        string   `json:"name" db:"name"`
    DisplayName string   `json:"display_name" db:"display_name"`
    Permissions []string `json:"permissions" db:"permissions"`
    TenantID    string   `json:"tenant_id" db:"tenant_id"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// Permission 权限定义
const (
    PermissionLogsRead       = "logs:read"
    PermissionLogsWrite      = "logs:write"
    PermissionLogsDelete     = "logs:delete"
    PermissionAlertsRead     = "alerts:read"
    PermissionAlertsCreate   = "alerts:create"
    PermissionAlertsUpdate   = "alerts:update"
    PermissionAlertsDelete   = "alerts:delete"
    PermissionBackupsRead    = "backups:read"
    PermissionBackupsCreate  = "backups:create"
    PermissionBackupsRestore = "backups:restore"
    PermissionUsersManage    = "users:manage"
    PermissionSystemAdmin    = "system:admin"
)
```

**PostgreSQL表设计**:
```sql
-- 用户表
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}',
    tenant_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'locked')),
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_secret VARCHAR(255),
    last_login_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- 索引
    INDEX idx_user_tenant (tenant_id),
    INDEX idx_user_status (status)
);

-- 角色表
CREATE TABLE roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    permissions TEXT[] NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- 唯一约束
    UNIQUE (name, tenant_id),
    
    -- 索引
    INDEX idx_role_tenant (tenant_id)
);

-- 启用行级安全 (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- RLS策略: 用户只能访问自己租户的数据
CREATE POLICY tenant_isolation_users ON users
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR);

CREATE POLICY tenant_isolation_roles ON roles
    USING (tenant_id = current_setting('app.current_tenant_id')::VARCHAR);
```

### 6.2 数据库索引设计

**Elasticsearch索引策略**:
```
索引命名规范: logs-{tier}-{date}
- logs-hot-2026.01.27  (热存储)
- logs-warm-2026.01.20 (温存储)
- logs-cold-2026.01.01 (冷存储)

索引设置:
- 热存储: 5分片, 2副本, 无压缩
- 温存储: 3分片, 1副本, best_compression
- 冷存储: 1分片, 0副本, 高压缩
```

**PostgreSQL索引优化**:
```sql
-- 复合索引
CREATE INDEX idx_backup_status_created ON backup_metadata(status, created_at DESC);
CREATE INDEX idx_alert_tenant_enabled ON alert_rules(tenant_id, enabled) WHERE enabled = true;

-- 部分索引
CREATE INDEX idx_user_active ON users(tenant_id) WHERE status = 'active';

-- GIN索引 (JSONB)
CREATE INDEX idx_backup_metadata_gin ON backup_metadata USING GIN(metadata);
CREATE INDEX idx_alert_condition_gin ON alert_rules USING GIN(condition);
```

### 6.3 缓存设计

**Redis缓存策略**:

```go
// 缓存键命名规范
const (
    // 查询结果缓存
    CacheKeyQueryResult = "query:result:{hash}"  // TTL: 5分钟
    
    // 用户会话缓存
    CacheKeyUserSession = "session:{user_id}"    // TTL: 1小时
    
    // 配置缓存
    CacheKeyConfig = "config:{module}:{key}"     // TTL: 永久(手动失效)
    
    // 统计数据缓存
    CacheKeyStats = "stats:{type}:{date}"        // TTL: 1天
    
    // 热点数据缓存
    CacheKeyHotLogs = "logs:hot:{service}"       // TTL: 1分钟
)

// 缓存管理器
type CacheManager struct {
    redis *redis.Client
}

// 查询结果缓存
func (m *CacheManager) CacheQueryResult(queryHash string, result interface{}, ttl time.Duration) error {
    key := fmt.Sprintf("query:result:%s", queryHash)
    data, _ := json.Marshal(result)
    return m.redis.Set(context.Background(), key, data, ttl).Err()
}

// 获取缓存的查询结果
func (m *CacheManager) GetCachedQueryResult(queryHash string) (interface{}, error) {
    key := fmt.Sprintf("query:result:%s", queryHash)
    data, err := m.redis.Get(context.Background(), key).Bytes()
    if err != nil {
        return nil, err
    }
    
    var result interface{}
    err = json.Unmarshal(data, &result)
    return result, err
}
```

**缓存失效策略**:
- 查询缓存: TTL 5分钟
- 配置缓存: 手动失效(配置更新时)
- 统计缓存: TTL 1天
- 会话缓存: TTL 1小时(滑动窗口)

### 6.4 数据分区策略

**Elasticsearch时间分区**:
```
按天分区: logs-hot-2026.01.27
按周分区: logs-warm-2026-W04
按月分区: logs-cold-2026-01
```

**PostgreSQL分区表**:
```sql
-- 告警历史表按月分区
CREATE TABLE alert_history (
    id VARCHAR(64),
    alert_id VARCHAR(64),
    triggered_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    status VARCHAR(20),
    PRIMARY KEY (id, triggered_at)
) PARTITION BY RANGE (triggered_at);

-- 创建分区
CREATE TABLE alert_history_2026_01 PARTITION OF alert_history
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE alert_history_2026_02 PARTITION OF alert_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

---

## 7. 安全设计

### 7.1 认证授权

**认证方式**:
```go
// JWT认证
type JWTClaims struct {
    UserID    string   `json:"user_id"`
    Username  string   `json:"username"`
    Roles     []string `json:"roles"`
    TenantID  string   `json:"tenant_id"`
    jwt.StandardClaims
}

// 生成JWT Token
func GenerateToken(user *User) (string, error) {
    claims := JWTClaims{
        UserID:   user.ID,
        Username: user.Username,
        Roles:    user.Roles,
        TenantID: user.TenantID,
        StandardClaims: jwt.StandardClaims{
            ExpiresAt: time.Now().Add(time.Hour * 24).Unix(),
            Issuer:    "log-management-system",
        },
    }
    
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString([]byte(jwtSecret))
}

// 验证Token
func ValidateToken(tokenString string) (*JWTClaims, error) {
    token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
        return []byte(jwtSecret), nil
    })
    
    if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
        return claims, nil
    }
    
    return nil, err
}
```

**多因素认证 (MFA)**:
```go
// TOTP (Time-based One-Time Password)
func GenerateMFASecret(username string) (string, error) {
    key, err := totp.Generate(totp.GenerateOpts{
        Issuer:      "LogManagement",
        AccountName: username,
    })
    return key.Secret(), err
}

// 验证MFA代码
func ValidateMFACode(secret, code string) bool {
    return totp.Validate(code, secret)
}
```

**权限控制 (RBAC)**:
```go
// 权限检查中间件
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        claims := c.MustGet("claims").(*JWTClaims)
        
        // 检查用户角色是否有该权限
        hasPermission := false
        for _, role := range claims.Roles {
            permissions := GetRolePermissions(role)
            if contains(permissions, permission) {
                hasPermission = true
                break
            }
        }
        
        if !hasPermission {
            c.JSON(403, gin.H{"error": "权限不足"})
            c.Abort()
            return
        }
        
        c.Next()
    }
}

// 使用示例
router.GET("/api/v1/logs", 
    AuthMiddleware(),
    RequirePermission("logs:read"),
    LogQueryHandler)
```

### 7.2 数据安全

**数据加密**:
```go
// AES-256加密
func EncryptData(plaintext []byte, key []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
    return ciphertext, nil
}

// 解密
func DecryptData(ciphertext []byte, key []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    nonceSize := gcm.NonceSize()
    nonce, ciphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
    
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    return plaintext, err
}
```

**敏感数据脱敏**:
```go
// 脱敏规则
type MaskingRule struct {
    Field   string
    Pattern string
    Replace string
}

var maskingRules = []MaskingRule{
    {Field: "password", Pattern: ".*", Replace: "******"},
    {Field: "credit_card", Pattern: `(\d{4})\d{8}(\d{4})`, Replace: "$1********$2"},
    {Field: "phone", Pattern: `(\d{3})\d{4}(\d{4})`, Replace: "$1****$2"},
    {Field: "email", Pattern: `(.{2}).*(@.*)`, Replace: "$1***$2"},
    {Field: "id_card", Pattern: `(\d{6})\d{8}(\d{4})`, Replace: "$1********$2"},
}

// 应用脱敏规则
func ApplyMasking(log *LogEntry) {
    for _, rule := range maskingRules {
        if value, ok := log.Fields[rule.Field]; ok {
            if str, ok := value.(string); ok {
                re := regexp.MustCompile(rule.Pattern)
                log.Fields[rule.Field] = re.ReplaceAllString(str, rule.Replace)
            }
        }
    }
}
```

**传输安全**:
- TLS 1.3加密传输
- 证书双向认证(mTLS)
- API请求签名验证

### 7.3 审计日志

**审计日志记录**:
```go
// 审计日志结构
type AuditLog struct {
    ID        string                 `json:"id"`
    Timestamp time.Time              `json:"timestamp"`
    UserID    string                 `json:"user_id"`
    Username  string                 `json:"username"`
    TenantID  string                 `json:"tenant_id"`
    Action    string                 `json:"action"`
    Resource  string                 `json:"resource"`
    Result    string                 `json:"result"` // success, failed
    IP        string                 `json:"ip"`
    UserAgent string                 `json:"user_agent"`
    Details   map[string]interface{} `json:"details"`
}

// 审计日志中间件
func AuditMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        // 处理请求
        c.Next()
        
        // 记录审计日志
        claims, _ := c.Get("claims")
        auditLog := AuditLog{
            ID:        uuid.New().String(),
            Timestamp: time.Now(),
            Action:    c.Request.Method + " " + c.Request.URL.Path,
            Resource:  c.Request.URL.Path,
            Result:    getResult(c.Writer.Status()),
            IP:        c.ClientIP(),
            UserAgent: c.Request.UserAgent(),
            Details: map[string]interface{}{
                "duration_ms": time.Since(start).Milliseconds(),
                "status_code": c.Writer.Status(),
            },
        }
        
        if claims != nil {
            jwtClaims := claims.(*JWTClaims)
            auditLog.UserID = jwtClaims.UserID
            auditLog.Username = jwtClaims.Username
            auditLog.TenantID = jwtClaims.TenantID
        }
        
        // 异步写入审计日志
        go WriteAuditLog(auditLog)
    }
}
```

**审计事件类型**:
- 用户登录/登出
- 权限变更
- 数据查询
- 数据导出
- 配置修改
- 备份创建/恢复
- 告警规则变更

### 7.4 安全加固

**API安全**:
```go
// 限流中间件
func RateLimitMiddleware(limit int) gin.HandlerFunc {
    limiter := rate.NewLimiter(rate.Limit(limit), limit*2)
    
    return func(c *gin.Context) {
        if !limiter.Allow() {
            c.JSON(429, gin.H{"error": "请求过于频繁"})
            c.Abort()
            return
        }
        c.Next()
    }
}

// SQL注入防护
func SanitizeInput(input string) string {
    // 移除特殊字符
    re := regexp.MustCompile(`[^\w\s\-@.]`)
    return re.ReplaceAllString(input, "")
}

// XSS防护
func EscapeHTML(input string) string {
    return html.EscapeString(input)
}
```

**密码策略**:
- 最小长度: 12位
- 必须包含: 大写字母、小写字母、数字、特殊字符
- 密码历史: 不能与最近5次密码相同
- 密码过期: 90天
- 登录失败锁定: 5次失败后锁定30分钟

**会话管理**:
- 会话超时: 1小时无操作自动登出
- 单点登录: 同一用户只能有一个活跃会话
- 会话固定防护: 登录后重新生成Session ID

---

## 8. 性能设计

### 8.1 性能指标

| 指标类别 | 指标名称 | 目标值 | 测量方式 |
|---------|---------|--------|----------|
| API响应 | 日志查询延迟 | P95 < 500ms | Prometheus histogram |
| API响应 | 备份创建延迟 | P95 < 2s | Prometheus histogram |
| API响应 | 告警规则查询 | P95 < 100ms | Prometheus histogram |
| 吞吐量 | API请求QPS | > 10000 | Prometheus counter |
| 吞吐量 | 日志写入TPS | > 100万/秒 | Kafka metrics |
| 可用性 | API可用性 | > 99.9% | Uptime监控 |
| 缓存 | 缓存命中率 | > 60% | Redis INFO |
| 数据库 | 查询延迟 | P95 < 50ms | PostgreSQL pg_stat |
| 存储 | ES查询延迟 | P95 < 200ms | ES _cat/indices |

### 8.2 性能优化策略

#### 8.2.1 查询优化

**缓存策略**:
```go
// 多级缓存架构
type QueryCache struct {
    l1Cache *sync.Map           // 本地内存缓存 (100MB)
    l2Cache *redis.Client       // Redis缓存 (10GB)
}

// 查询流程
func (c *QueryCache) Query(query string) (interface{}, error) {
    // L1缓存查询
    if result, ok := c.l1Cache.Load(query); ok {
        metrics.CacheHit.WithLabelValues("l1").Inc()
        return result, nil
    }
    
    // L2缓存查询
    if result, err := c.l2Cache.Get(ctx, query).Result(); err == nil {
        metrics.CacheHit.WithLabelValues("l2").Inc()
        // 回填L1缓存
        c.l1Cache.Store(query, result)
        return result, nil
    }
    
    // 缓存未命中，查询数据库
    metrics.CacheMiss.Inc()
    result, err := c.queryDatabase(query)
    if err != nil {
        return nil, err
    }
    
    // 写入缓存
    c.l2Cache.Set(ctx, query, result, 5*time.Minute)
    c.l1Cache.Store(query, result)
    
    return result, nil
}
```

**查询优化**:
- 使用ES的filter context代替query context (不计算相关性分数)
- 限制返回字段 (_source filtering)
- 使用scroll API处理大结果集
- 查询结果分页 (默认100条/页)
- 慢查询日志记录 (> 5秒)

#### 8.2.2 数据库优化

**连接池配置**:
```go
// PostgreSQL连接池
db, err := sql.Open("postgres", dsn)
db.SetMaxOpenConns(100)        // 最大连接数
db.SetMaxIdleConns(10)         // 最大空闲连接
db.SetConnMaxLifetime(time.Hour) // 连接最大生命周期
db.SetConnMaxIdleTime(10 * time.Minute) // 空闲连接超时

// Redis连接池
redisClient := redis.NewClient(&redis.Options{
    PoolSize:     100,
    MinIdleConns: 10,
    MaxRetries:   3,
    DialTimeout:  5 * time.Second,
    ReadTimeout:  3 * time.Second,
    WriteTimeout: 3 * time.Second,
})
```

**批量操作**:
```go
// 批量插入
func BatchInsert(logs []*LogEntry) error {
    const batchSize = 1000
    
    for i := 0; i < len(logs); i += batchSize {
        end := i + batchSize
        if end > len(logs) {
            end = len(logs)
        }
        
        batch := logs[i:end]
        if err := insertBatch(batch); err != nil {
            return err
        }
    }
    
    return nil
}
```

#### 8.2.3 API优化

**并发控制**:
```go
// 使用worker pool限制并发
type WorkerPool struct {
    workers   int
    taskQueue chan Task
    wg        sync.WaitGroup
}

func NewWorkerPool(workers int) *WorkerPool {
    pool := &WorkerPool{
        workers:   workers,
        taskQueue: make(chan Task, workers*2),
    }
    
    // 启动worker
    for i := 0; i < workers; i++ {
        pool.wg.Add(1)
        go pool.worker()
    }
    
    return pool
}

func (p *WorkerPool) worker() {
    defer p.wg.Done()
    
    for task := range p.taskQueue {
        task.Execute()
    }
}
```

**响应压缩**:
```go
// Gzip压缩中间件
func GzipMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        if !strings.Contains(c.Request.Header.Get("Accept-Encoding"), "gzip") {
            c.Next()
            return
        }
        
        gz := gzip.NewWriter(c.Writer)
        defer gz.Close()
        
        c.Header("Content-Encoding", "gzip")
        c.Writer = &gzipWriter{Writer: gz, ResponseWriter: c.Writer}
        c.Next()
    }
}
```

#### 8.2.4 前端优化

**代码分割**:
```typescript
// React懒加载
const LogSearch = lazy(() => import('./pages/LogSearch'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Backup = lazy(() => import('./pages/Backup'));

// 路由配置
<Suspense fallback={<Loading />}>
  <Routes>
    <Route path="/logs" element={<LogSearch />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/backup" element={<Backup />} />
  </Routes>
</Suspense>
```

**虚拟滚动**:
```typescript
// 使用react-window处理大列表
import { FixedSizeList } from 'react-window';

const LogList = ({ logs }) => (
  <FixedSizeList
    height={600}
    itemCount={logs.length}
    itemSize={50}
    width="100%"
  >
    {({ index, style }) => (
      <div style={style}>
        {logs[index].message}
      </div>
    )}
  </FixedSizeList>
);
```

**请求合并**:
```typescript
// 使用debounce减少请求
import { debounce } from 'lodash';

const debouncedSearch = debounce((query: string) => {
  api.searchLogs(query);
}, 300);
```

### 8.3 容量规划

**存储容量**:
| 数据类型 | 日增量 | 保留期 | 总容量 |
|---------|--------|--------|--------|
| 热存储日志 | 100GB | 7天 | 700GB |
| 温存储日志 | 100GB | 23天 | 2.3TB |
| 冷存储日志 | 100GB | 335天 | 33.5TB |
| 备份数据 | 50GB | 90天 | 4.5TB |
| 元数据 | 1GB | 永久 | 100GB |

**计算资源**:
| 组件 | CPU | 内存 | 副本数 | 总资源 |
|------|-----|------|--------|--------|
| API Server | 2核 | 4GB | 3 | 6核/12GB |
| Collector | 4核 | 8GB | 5 | 20核/40GB |
| Elasticsearch | 8核 | 32GB | 3 | 24核/96GB |
| PostgreSQL | 4核 | 16GB | 2 | 8核/32GB |
| Redis | 2核 | 8GB | 3 | 6核/24GB |
| Kafka | 4核 | 16GB | 3 | 12核/48GB |

**网络带宽**:
- 日志采集: 100Mbps
- API访问: 50Mbps
- 数据备份: 20Mbps
- 总带宽需求: 200Mbps

---

## 9. 部署方案

### 9.1 部署架构

**Kubernetes部署架构**:
```yaml
# 命名空间划分
namespaces:
  - log-management-prod      # 生产环境
  - log-management-staging   # 预发布环境
  - log-management-dev       # 开发环境

# 服务拓扑
┌─────────────────────────────────────────────────────────┐
│  Ingress (Nginx)                                        │
│  - TLS终止                                              │
│  - 负载均衡                                             │
│  - 限流                                                 │
└────────────────┬────────────────────────────────────────┘
                 │
    ┌────────────┴────────────┐
    │                         │
┌───▼────────┐        ┌──────▼──────┐
│ API Server │        │ Web Console │
│ (3副本)    │        │ (2副本)     │
└───┬────────┘        └─────────────┘
    │
    ├─────────┬─────────┬─────────┬─────────┐
    │         │         │         │         │
┌───▼───┐ ┌──▼──┐ ┌───▼───┐ ┌───▼───┐ ┌──▼──┐
│ ES    │ │Redis│ │Postgres│ │Kafka  │ │MinIO│
│(3节点)│ │(3节点)│ │(2节点)│ │(3节点)│ │(3节点)│
└───────┘ └─────┘ └───────┘ └───────┘ └─────┘
```

### 9.2 资源配置

**生产环境配置**:
```yaml
# API Server Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: log-management-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
      - name: api-server
        image: log-management/api-server:v1.0.0
        resources:
          requests:
            cpu: "1000m"
            memory: "2Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        env:
        - name: ENV
          value: "production"
        - name: DB_HOST
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: host
        ports:
        - containerPort: 8080
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
---
# HPA (水平自动扩缩容)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
  namespace: log-management-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

**Elasticsearch StatefulSet**:
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: log-management-prod
spec:
  serviceName: elasticsearch
  replicas: 3
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      initContainers:
      - name: increase-vm-max-map
        image: busybox
        command: ["sysctl", "-w", "vm.max_map_count=262144"]
        securityContext:
          privileged: true
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
        resources:
          requests:
            cpu: "4000m"
            memory: "16Gi"
          limits:
            cpu: "8000m"
            memory: "32Gi"
        env:
        - name: cluster.name
          value: "log-cluster"
        - name: node.name
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: discovery.seed_hosts
          value: "elasticsearch-0.elasticsearch,elasticsearch-1.elasticsearch,elasticsearch-2.elasticsearch"
        - name: cluster.initial_master_nodes
          value: "elasticsearch-0,elasticsearch-1,elasticsearch-2"
        - name: ES_JAVA_OPTS
          value: "-Xms16g -Xmx16g"
        ports:
        - containerPort: 9200
          name: http
        - containerPort: 9300
          name: transport
        volumeMounts:
        - name: data
          mountPath: /usr/share/elasticsearch/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 500Gi
```

### 9.3 发布策略

**滚动更新**:
```yaml
# Deployment更新策略
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 最多超出期望副本数1个
      maxUnavailable: 0  # 更新时保持所有副本可用
```

**蓝绿部署**:
```bash
#!/bin/bash
# 蓝绿部署脚本

# 1. 部署绿色环境
kubectl apply -f deployment-green.yaml

# 2. 等待绿色环境就绪
kubectl wait --for=condition=available --timeout=300s deployment/api-server-green

# 3. 切换流量到绿色环境
kubectl patch service api-server -p '{"spec":{"selector":{"version":"green"}}}'

# 4. 验证绿色环境
./health-check.sh

# 5. 如果验证通过，删除蓝色环境
if [ $? -eq 0 ]; then
    kubectl delete deployment api-server-blue
else
    # 回滚到蓝色环境
    kubectl patch service api-server -p '{"spec":{"selector":{"version":"blue"}}}'
    kubectl delete deployment api-server-green
fi
```

**金丝雀发布**:
```yaml
# 使用Istio实现金丝雀发布
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-server
spec:
  hosts:
  - api-server
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: api-server
        subset: v2
  - route:
    - destination:
        host: api-server
        subset: v1
      weight: 90
    - destination:
        host: api-server
        subset: v2
      weight: 10  # 10%流量到新版本
```

### 9.4 配置管理

**ConfigMap配置**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-server-config
  namespace: log-management-prod
data:
  config.yaml: |
    server:
      port: 8080
      read_timeout: 30s
      write_timeout: 30s
    
    database:
      max_open_conns: 100
      max_idle_conns: 10
      conn_max_lifetime: 1h
    
    cache:
      ttl: 5m
      max_size: 1000
    
    log:
      level: info
      format: json
```

**Secret管理**:
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: log-management-prod
type: Opaque
data:
  host: cG9zdGdyZXM6NTQzMg==  # base64编码
  username: YWRtaW4=
  password: c2VjcmV0cGFzc3dvcmQ=
```

**使用Vault管理敏感信息**:
```go
// 从Vault读取密钥
import "github.com/hashicorp/vault/api"

func GetSecret(path string) (string, error) {
    client, err := api.NewClient(api.DefaultConfig())
    if err != nil {
        return "", err
    }
    
    secret, err := client.Logical().Read(path)
    if err != nil {
        return "", err
    }
    
    return secret.Data["value"].(string), nil
}
```

### 9.5 环境隔离

**多环境配置**:
```
environments/
├── dev/
│   ├── kustomization.yaml
│   ├── configmap.yaml
│   └── resources.yaml
├── staging/
│   ├── kustomization.yaml
│   ├── configmap.yaml
│   └── resources.yaml
└── prod/
    ├── kustomization.yaml
    ├── configmap.yaml
    └── resources.yaml
```

**Kustomize配置**:
```yaml
# environments/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: log-management-prod

resources:
- ../../base

replicas:
- name: api-server
  count: 3

images:
- name: api-server
  newTag: v1.0.0

configMapGenerator:
- name: api-server-config
  files:
  - config.yaml

secretGenerator:
- name: db-credentials
  envs:
  - secrets.env
```

---

## 10. 监控与运维

### 10.1 监控指标

**系统级指标**:
```prometheus
# CPU使用率
node_cpu_usage_percent{instance="api-server-1"} 45.2

# 内存使用率
node_memory_usage_percent{instance="api-server-1"} 68.5

# 磁盘使用率
node_disk_usage_percent{instance="es-node-1",mountpoint="/data"} 72.3

# 网络流量
node_network_receive_bytes_total{instance="api-server-1"} 1234567890
node_network_transmit_bytes_total{instance="api-server-1"} 9876543210
```

**应用级指标**:
```prometheus
# API请求总数
api_requests_total{method="GET",endpoint="/api/v1/logs",status="200"} 10000

# API请求延迟
api_request_duration_seconds{endpoint="/api/v1/logs",quantile="0.5"} 0.1
api_request_duration_seconds{endpoint="/api/v1/logs",quantile="0.95"} 0.5
api_request_duration_seconds{endpoint="/api/v1/logs",quantile="0.99"} 1.0

# 日志摄入速率
log_ingestion_rate{service="collector"} 10000

# 缓存命中率
cache_hit_rate{cache="redis"} 0.65

# 数据库连接池
db_connection_pool_active{db="postgres"} 45
db_connection_pool_idle{db="postgres"} 5
db_connection_pool_wait_count{db="postgres"} 10

# 队列深度
queue_depth{queue="priority_high"} 100
queue_depth{queue="priority_medium"} 500
queue_depth{queue="priority_low"} 1000
```

**业务级指标**:
```prometheus
# 日志总量
log_total_count{tier="hot"} 1000000000
log_total_count{tier="warm"} 5000000000
log_total_count{tier="cold"} 10000000000

# 告警统计
alert_triggered_total{severity="high"} 10
alert_triggered_total{severity="medium"} 50
alert_resolved_total 45

# 备份统计
backup_total_count{type="full"} 4
backup_total_count{type="incremental"} 28
backup_total_size_bytes 107374182400

# 用户活跃度
user_active_count 150
user_login_total 1000
```

### 10.2 告警规则

**Prometheus告警规则**:
```yaml
# prometheus-rules.yaml
groups:
- name: api-server-alerts
  interval: 30s
  rules:
  # API可用性告警
  - alert: APIServerDown
    expr: up{job="api-server"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "API Server实例 {{ $labels.instance }} 宕机"
      description: "API Server已经宕机超过1分钟"
  
  # API响应时间告警
  - alert: APIHighLatency
    expr: histogram_quantile(0.95, rate(api_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "API响应时间过高"
      description: "P95延迟 {{ $value }}s 超过1秒"
  
  # API错误率告警
  - alert: APIHighErrorRate
    expr: rate(api_requests_total{status=~"5.."}[5m]) / rate(api_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "API错误率过高"
      description: "错误率 {{ $value | humanizePercentage }} 超过5%"

- name: storage-alerts
  interval: 30s
  rules:
  # 磁盘空间告警
  - alert: DiskSpaceHigh
    expr: node_disk_usage_percent > 80
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "磁盘空间不足"
      description: "{{ $labels.instance }} 磁盘使用率 {{ $value }}% 超过80%"
  
  # Elasticsearch集群健康告警
  - alert: ElasticsearchClusterUnhealthy
    expr: elasticsearch_cluster_health_status{color="red"} == 1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "Elasticsearch集群状态异常"
      description: "集群状态为红色，存在未分配的分片"
  
  # 备份失败告警
  - alert: BackupFailed
    expr: increase(backup_failed_total[1h]) > 0
    labels:
      severity: high
    annotations:
      summary: "备份任务失败"
      description: "最近1小时内有 {{ $value }} 个备份任务失败"

- name: business-alerts
  interval: 30s
  rules:
  # 日志摄入速率异常
  - alert: LogIngestionRateAbnormal
    expr: abs(rate(log_ingestion_rate[5m]) - rate(log_ingestion_rate[1h] offset 1h)) / rate(log_ingestion_rate[1h] offset 1h) > 0.5
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "日志摄入速率异常"
      description: "当前摄入速率与1小时前相比变化超过50%"
```

### 10.3 日志规范

**日志格式**:
```go
// 结构化日志
type LogEntry struct {
    Timestamp  time.Time              `json:"timestamp"`
    Level      string                 `json:"level"`
    Message    string                 `json:"message"`
    Service    string                 `json:"service"`
    TraceID    string                 `json:"trace_id,omitempty"`
    SpanID     string                 `json:"span_id,omitempty"`
    UserID     string                 `json:"user_id,omitempty"`
    RequestID  string                 `json:"request_id,omitempty"`
    Error      string                 `json:"error,omitempty"`
    StackTrace string                 `json:"stack_trace,omitempty"`
    Fields     map[string]interface{} `json:"fields,omitempty"`
}

// 日志记录器
logger := logrus.New()
logger.SetFormatter(&logrus.JSONFormatter{
    TimestampFormat: time.RFC3339Nano,
    FieldMap: logrus.FieldMap{
        logrus.FieldKeyTime:  "timestamp",
        logrus.FieldKeyLevel: "level",
        logrus.FieldKeyMsg:   "message",
    },
})

// 使用示例
logger.WithFields(logrus.Fields{
    "service":    "api-server",
    "request_id": requestID,
    "user_id":    userID,
    "duration":   duration.Milliseconds(),
}).Info("API请求完成")
```

**日志级别使用规范**:
| 级别 | 使用场景 | 示例 |
|------|---------|------|
| DEBUG | 调试信息 | 变量值、函数调用 |
| INFO | 正常业务流程 | 请求开始/完成、状态变更 |
| WARN | 警告信息 | 重试、降级、配置缺失 |
| ERROR | 错误信息 | 请求失败、异常捕获 |
| FATAL | 致命错误 | 服务无法启动、关键资源不可用 |

### 10.4 运维手册

**日常运维检查清单**:
```markdown
## 每日检查
- [ ] 检查所有服务健康状态
- [ ] 查看告警面板，处理未解决告警
- [ ] 检查磁盘空间使用率
- [ ] 查看API错误率和延迟
- [ ] 检查备份任务执行情况
- [ ] 查看日志摄入速率是否正常

## 每周检查
- [ ] 审查慢查询日志
- [ ] 检查数据库性能指标
- [ ] 清理过期备份
- [ ] 审查安全审计日志
- [ ] 更新监控仪表盘

## 每月检查
- [ ] 容量规划评估
- [ ] 性能基准测试
- [ ] 灾难恢复演练
- [ ] 安全漏洞扫描
- [ ] 依赖组件版本更新
```

**常见问题处理**:

**问题1: API响应慢**
```bash
# 1. 检查API延迟
curl -w "@curl-format.txt" -o /dev/null -s http://api-server/api/v1/logs

# 2. 查看慢查询日志
kubectl logs -n log-management-prod api-server-xxx | grep "slow_query"

# 3. 检查数据库连接池
kubectl exec -it postgres-0 -- psql -c "SELECT * FROM pg_stat_activity;"

# 4. 检查缓存命中率
redis-cli INFO stats | grep hit_rate

# 5. 如果是ES查询慢，检查索引状态
curl -X GET "localhost:9200/_cat/indices?v&s=store.size:desc"
```

**问题2: 磁盘空间不足**
```bash
# 1. 检查磁盘使用情况
df -h

# 2. 查找大文件
du -sh /* | sort -rh | head -10

# 3. 清理ES旧索引
curl -X DELETE "localhost:9200/logs-hot-2026.01.01"

# 4. 清理Docker镜像
docker system prune -a

# 5. 触发ILM策略执行
curl -X POST "localhost:9200/_ilm/move/logs-hot-2026.01.27" -H 'Content-Type: application/json' -d'
{
  "current_step": {
    "phase": "hot",
    "action": "rollover"
  },
  "next_step": {
    "phase": "warm"
  }
}'
```

**问题3: 服务宕机**
```bash
# 1. 检查Pod状态
kubectl get pods -n log-management-prod

# 2. 查看Pod日志
kubectl logs -n log-management-prod api-server-xxx --tail=100

# 3. 查看Pod事件
kubectl describe pod -n log-management-prod api-server-xxx

# 4. 重启Pod
kubectl rollout restart deployment/api-server -n log-management-prod

# 5. 如果持续失败，回滚到上一版本
kubectl rollout undo deployment/api-server -n log-management-prod
```

### 10.5 备份与恢复

**自动备份脚本**:
```bash
#!/bin/bash
# backup.sh - 自动备份脚本

set -e

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_${BACKUP_DATE}"
BACKUP_DIR="/var/backups/log-management"

echo "开始备份: ${BACKUP_NAME}"

# 1. 创建ES快照
curl -X PUT "localhost:9200/_snapshot/backup_repo/${BACKUP_NAME}?wait_for_completion=true" \
  -H 'Content-Type: application/json' -d'
{
  "indices": "logs-*",
  "ignore_unavailable": true,
  "include_global_state": false
}'

# 2. 备份PostgreSQL
pg_dump -h postgres -U admin log_management > "${BACKUP_DIR}/postgres_${BACKUP_DATE}.sql"

# 3. 压缩备份
tar -czf "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "${BACKUP_DIR}/postgres_${BACKUP_DATE}.sql"

# 4. 上传到S3
aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "s3://log-backups/${BACKUP_NAME}.tar.gz"

# 5. 清理本地文件
rm -f "${BACKUP_DIR}/postgres_${BACKUP_DATE}.sql"
rm -f "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"

# 6. 清理30天前的备份
find "${BACKUP_DIR}" -name "backup_*.tar.gz" -mtime +30 -delete

echo "备份完成: ${BACKUP_NAME}"
```

**恢复脚本**:
```bash
#!/bin/bash
# restore.sh - 数据恢复脚本

set -e

BACKUP_NAME=$1

if [ -z "$BACKUP_NAME" ]; then
    echo "用法: ./restore.sh <backup_name>"
    exit 1
fi

echo "开始恢复: ${BACKUP_NAME}"

# 1. 从S3下载备份
aws s3 cp "s3://log-backups/${BACKUP_NAME}.tar.gz" "/tmp/${BACKUP_NAME}.tar.gz"

# 2. 解压备份
tar -xzf "/tmp/${BACKUP_NAME}.tar.gz" -C /tmp/

# 3. 恢复PostgreSQL
psql -h postgres -U admin log_management < "/tmp/postgres_*.sql"

# 4. 恢复ES快照
curl -X POST "localhost:9200/_snapshot/backup_repo/${BACKUP_NAME}/_restore?wait_for_completion=true" \
  -H 'Content-Type: application/json' -d'
{
  "indices": "logs-*",
  "ignore_unavailable": true,
  "include_global_state": false
}'

# 5. 清理临时文件
rm -rf /tmp/${BACKUP_NAME}*

echo "恢复完成: ${BACKUP_NAME}"
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| api_rate_limit | int | 1000 | API速率限制(次/分钟) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| query_timeout | int | 30 | 查询超时时间(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| max_page_size | int | 1000 | 最大分页大小 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| cache_ttl | int | 300 | 缓存TTL(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| log_level | string | info | 日志级别 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| masking_rules | array | [] | 脱敏规则列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_rules | array | [] | 告警规则列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_throttle | int | 900 | 告警节流时间(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| custom_alert_templates | array | [] | 自定义告警模板 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| alert_channels | array | [] | 告警通道配置 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| backup_schedule | string | 0 2 * * 0 | 备份计划(cron) | Redis Pub/Sub | 下次调度 | ✅ 推荐 |
| postgresql_host | string | "postgres" | PostgreSQL主机 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接池) |
| postgresql_port | int | 5432 | PostgreSQL端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接池) |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建连接) |
| elasticsearch_urls | array | [] | ES集群地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐(需要重建客户端) |

### 11.2 热更新实现机制

**配置管理器**:
```go
// ConfigManager 配置管理器
type ConfigManager struct {
    config      atomic.Value  // 当前配置(原子操作)
    redis       *redis.Client // Redis客户端
    postgres    *sql.DB       // PostgreSQL客户端
    subscribers []chan Config // 订阅者列表
    mu          sync.RWMutex  // 读写锁
}

// Config 配置结构
type Config struct {
    APIRateLimit         int                    `json:"api_rate_limit"`
    QueryTimeout         int                    `json:"query_timeout"`
    MaxPageSize          int                    `json:"max_page_size"`
    CacheTTL             int                    `json:"cache_ttl"`
    LogLevel             string                 `json:"log_level"`
    MaskingRules         []MaskingRule          `json:"masking_rules"`
    AlertRules           []AlertRule            `json:"alert_rules"`           // 告警规则(热更新)
    AlertThrottle        int                    `json:"alert_throttle"`
    CustomAlertTemplates []CustomAlertTemplate  `json:"custom_alert_templates"` // 自定义告警模板
    AlertChannels        []AlertChannel         `json:"alert_channels"`        // 告警通道配置
    BackupSchedule       string                 `json:"backup_schedule"`
    Version              int64                  `json:"version"`
    UpdatedAt            time.Time              `json:"updated_at"`
    UpdatedBy            string                 `json:"updated_by"`
}

// CustomAlertTemplate 自定义告警模板
type CustomAlertTemplate struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    Subject     string                 `json:"subject"`      // 告警主题模板
    Body        string                 `json:"body"`         // 告警内容模板
    Variables   []string               `json:"variables"`    // 可用变量列表
    Format      string                 `json:"format"`       // text, html, markdown
    CreatedAt   time.Time              `json:"created_at"`
}

// AlertChannel 告警通道配置
type AlertChannel struct {
    ID       string                 `json:"id"`
    Type     string                 `json:"type"`     // email, webhook, slack, dingtalk, wecom
    Name     string                 `json:"name"`
    Enabled  bool                   `json:"enabled"`
    Config   map[string]interface{} `json:"config"`   // 通道特定配置
    Priority int                    `json:"priority"` // 优先级(数字越小优先级越高)
}

// NewConfigManager 创建配置管理器
func NewConfigManager(redis *redis.Client, postgres *sql.DB) (*ConfigManager, error) {
    cm := &ConfigManager{
        redis:       redis,
        postgres:    postgres,
        subscribers: make([]chan Config, 0),
    }
    
    // 从数据库加载初始配置
    if err := cm.loadConfigFromDB(); err != nil {
        return nil, err
    }
    
    // 启动配置监听
    go cm.watchConfigChanges()
    
    return cm, nil
}

// GetConfig 获取当前配置(线程安全)
func (cm *ConfigManager) GetConfig() Config {
    return cm.config.Load().(Config)
}

// UpdateConfig 更新配置
func (cm *ConfigManager) UpdateConfig(newConfig Config, updatedBy string) error {
    // 1. 验证配置
    if err := cm.validateConfig(newConfig); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 2. 保存到数据库(版本化)
    newConfig.Version = time.Now().UnixNano()
    newConfig.UpdatedAt = time.Now()
    newConfig.UpdatedBy = updatedBy
    
    if err := cm.saveConfigToDB(newConfig); err != nil {
        return fmt.Errorf("保存配置失败: %w", err)
    }
    
    // 3. 发布到Redis(通知所有实例)
    configJSON, _ := json.Marshal(newConfig)
    if err := cm.redis.Publish(context.Background(), "config:reload", configJSON).Err(); err != nil {
        return fmt.Errorf("发布配置失败: %w", err)
    }
    
    // 4. 记录审计日志
    cm.logConfigChange(newConfig, updatedBy)
    
    return nil
}

// watchConfigChanges 监听配置变更
func (cm *ConfigManager) watchConfigChanges() {
    pubsub := cm.redis.Subscribe(context.Background(), "config:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        var newConfig Config
        if err := json.Unmarshal([]byte(msg.Payload), &newConfig); err != nil {
            log.Error("解析配置失败", "error", err)
            continue
        }
        
        // 验证配置
        if err := cm.validateConfig(newConfig); err != nil {
            log.Error("配置验证失败", "error", err)
            continue
        }
        
        // 原子更新配置
        oldConfig := cm.GetConfig()
        cm.config.Store(newConfig)
        
        log.Info("配置已更新",
            "version", newConfig.Version,
            "updated_by", newConfig.UpdatedBy,
            "updated_at", newConfig.UpdatedAt)
        
        // 通知订阅者
        cm.notifySubscribers(newConfig)
        
        // 应用配置变更
        cm.applyConfigChanges(oldConfig, newConfig)
    }
}

// validateConfig 验证配置
func (cm *ConfigManager) validateConfig(config Config) error {
    if config.APIRateLimit < 1 || config.APIRateLimit > 100000 {
        return fmt.Errorf("api_rate_limit必须在1-100000之间")
    }
    
    if config.QueryTimeout < 1 || config.QueryTimeout > 300 {
        return fmt.Errorf("query_timeout必须在1-300秒之间")
    }
    
    if config.MaxPageSize < 10 || config.MaxPageSize > 10000 {
        return fmt.Errorf("max_page_size必须在10-10000之间")
    }
    
    if config.CacheTTL < 60 || config.CacheTTL > 3600 {
        return fmt.Errorf("cache_ttl必须在60-3600秒之间")
    }
    
    validLogLevels := []string{"debug", "info", "warn", "error"}
    if !contains(validLogLevels, config.LogLevel) {
        return fmt.Errorf("log_level必须是: %v", validLogLevels)
    }
    
    // 验证cron表达式
    if _, err := cron.ParseStandard(config.BackupSchedule); err != nil {
        return fmt.Errorf("backup_schedule格式错误: %w", err)
    }
    
    return nil
}

// applyConfigChanges 应用配置变更
func (cm *ConfigManager) applyConfigChanges(oldConfig, newConfig Config) {
    // 日志级别变更
    if oldConfig.LogLevel != newConfig.LogLevel {
        log.SetLevel(newConfig.LogLevel)
        log.Info("日志级别已更新", "level", newConfig.LogLevel)
    }
    
    // 限流配置变更
    if oldConfig.APIRateLimit != newConfig.APIRateLimit {
        rateLimiter.SetLimit(newConfig.APIRateLimit)
        log.Info("API限流已更新", "limit", newConfig.APIRateLimit)
    }
    
    // 缓存TTL变更
    if oldConfig.CacheTTL != newConfig.CacheTTL {
        cacheManager.SetTTL(time.Duration(newConfig.CacheTTL) * time.Second)
        log.Info("缓存TTL已更新", "ttl", newConfig.CacheTTL)
    }
    
    // 告警规则变更(热更新)
    if !reflect.DeepEqual(oldConfig.AlertRules, newConfig.AlertRules) {
        alertEngine.ReloadRules(newConfig.AlertRules)
        log.Info("告警规则已更新", "count", len(newConfig.AlertRules))
    }
    
    // 自定义告警模板变更
    if !reflect.DeepEqual(oldConfig.CustomAlertTemplates, newConfig.CustomAlertTemplates) {
        alertEngine.ReloadTemplates(newConfig.CustomAlertTemplates)
        log.Info("告警模板已更新", "count", len(newConfig.CustomAlertTemplates))
    }
    
    // 告警通道变更
    if !reflect.DeepEqual(oldConfig.AlertChannels, newConfig.AlertChannels) {
        alertEngine.ReloadChannels(newConfig.AlertChannels)
        log.Info("告警通道已更新", "count", len(newConfig.AlertChannels))
    }
    
    // 备份计划变更
    if oldConfig.BackupSchedule != newConfig.BackupSchedule {
        backupScheduler.UpdateSchedule(newConfig.BackupSchedule)
        log.Info("备份计划已更新", "schedule", newConfig.BackupSchedule)
    }
}

// AlertEngine 告警引擎(支持热更新)
type AlertEngine struct {
    rules     atomic.Value // []AlertRule
    templates atomic.Value // []CustomAlertTemplate
    channels  atomic.Value // []AlertChannel
    mu        sync.RWMutex
}

// ReloadRules 热更新告警规则
func (ae *AlertEngine) ReloadRules(rules []AlertRule) {
    // 验证规则
    for _, rule := range rules {
        if err := ae.validateRule(rule); err != nil {
            log.Error("告警规则验证失败", "rule", rule.Name, "error", err)
            return
        }
    }
    
    // 原子更新
    ae.rules.Store(rules)
    
    // 重建规则索引
    ae.rebuildRuleIndex()
    
    log.Info("告警规则热更新成功", "count", len(rules))
}

// ReloadTemplates 热更新告警模板
func (ae *AlertEngine) ReloadTemplates(templates []CustomAlertTemplate) {
    // 验证模板
    for _, tmpl := range templates {
        if err := ae.validateTemplate(tmpl); err != nil {
            log.Error("告警模板验证失败", "template", tmpl.Name, "error", err)
            return
        }
    }
    
    // 原子更新
    ae.templates.Store(templates)
    
    log.Info("告警模板热更新成功", "count", len(templates))
}

// ReloadChannels 热更新告警通道
func (ae *AlertEngine) ReloadChannels(channels []AlertChannel) {
    // 验证通道配置
    for _, ch := range channels {
        if err := ae.validateChannel(ch); err != nil {
            log.Error("告警通道验证失败", "channel", ch.Name, "error", err)
            return
        }
    }
    
    // 原子更新
    ae.channels.Store(channels)
    
    // 重新初始化通道连接
    ae.reinitChannels(channels)
    
    log.Info("告警通道热更新成功", "count", len(channels))
}

// GetRules 获取当前告警规则
func (ae *AlertEngine) GetRules() []AlertRule {
    if rules := ae.rules.Load(); rules != nil {
        return rules.([]AlertRule)
    }
    return []AlertRule{}
}

// GetTemplates 获取当前告警模板
func (ae *AlertEngine) GetTemplates() []CustomAlertTemplate {
    if templates := ae.templates.Load(); templates != nil {
        return templates.([]CustomAlertTemplate)
    }
    return []CustomAlertTemplate{}
}

// GetChannels 获取当前告警通道
func (ae *AlertEngine) GetChannels() []AlertChannel {
    if channels := ae.channels.Load(); channels != nil {
        return channels.([]AlertChannel)
    }
    return []AlertChannel{}
}

// validateRule 验证告警规则
func (ae *AlertEngine) validateRule(rule AlertRule) error {
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if rule.Query == "" {
        return fmt.Errorf("查询条件不能为空")
    }
    
    // 验证条件
    if rule.Condition.Type == "" {
        return fmt.Errorf("条件类型不能为空")
    }
    
    // 验证动作
    if len(rule.Actions) == 0 {
        return fmt.Errorf("至少需要一个告警动作")
    }
    
    return nil
}

// validateTemplate 验证告警模板
func (ae *AlertEngine) validateTemplate(tmpl CustomAlertTemplate) error {
    if tmpl.Name == "" {
        return fmt.Errorf("模板名称不能为空")
    }
    
    if tmpl.Subject == "" {
        return fmt.Errorf("模板主题不能为空")
    }
    
    if tmpl.Body == "" {
        return fmt.Errorf("模板内容不能为空")
    }
    
    // 验证模板语法
    if _, err := template.New("test").Parse(tmpl.Body); err != nil {
        return fmt.Errorf("模板语法错误: %w", err)
    }
    
    return nil
}

// validateChannel 验证告警通道
func (ae *AlertEngine) validateChannel(ch AlertChannel) error {
    if ch.Name == "" {
        return fmt.Errorf("通道名称不能为空")
    }
    
    if ch.Type == "" {
        return fmt.Errorf("通道类型不能为空")
    }
    
    // 根据类型验证配置
    switch ch.Type {
    case "email":
        if _, ok := ch.Config["smtp_host"]; !ok {
            return fmt.Errorf("邮件通道缺少smtp_host配置")
        }
    case "webhook":
        if _, ok := ch.Config["url"]; !ok {
            return fmt.Errorf("Webhook通道缺少url配置")
        }
    case "slack":
        if _, ok := ch.Config["webhook_url"]; !ok {
            return fmt.Errorf("Slack通道缺少webhook_url配置")
        }
    }
    
    return nil
}

// Subscribe 订阅配置变更
func (cm *ConfigManager) Subscribe() <-chan Config {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    ch := make(chan Config, 10)
    cm.subscribers = append(cm.subscribers, ch)
    return ch
}

// notifySubscribers 通知所有订阅者
func (cm *ConfigManager) notifySubscribers(config Config) {
    cm.mu.RLock()
    defer cm.mu.RUnlock()
    
    for _, ch := range cm.subscribers {
        select {
        case ch <- config:
        default:
            log.Warn("订阅者通道已满，跳过通知")
        }
    }
}

// saveConfigToDB 保存配置到数据库
func (cm *ConfigManager) saveConfigToDB(config Config) error {
    configJSON, _ := json.Marshal(config)
    
    query := `
        INSERT INTO system_config (version, config, updated_at, updated_by)
        VALUES ($1, $2, $3, $4)
    `
    
    _, err := cm.postgres.Exec(query, config.Version, configJSON, config.UpdatedAt, config.UpdatedBy)
    return err
}

// loadConfigFromDB 从数据库加载配置
func (cm *ConfigManager) loadConfigFromDB() error {
    query := `
        SELECT config FROM system_config
        ORDER BY version DESC
        LIMIT 1
    `
    
    var configJSON []byte
    err := cm.postgres.QueryRow(query).Scan(&configJSON)
    if err != nil {
        return err
    }
    
    var config Config
    if err := json.Unmarshal(configJSON, &config); err != nil {
        return err
    }
    
    cm.config.Store(config)
    return nil
}

// logConfigChange 记录配置变更审计日志
func (cm *ConfigManager) logConfigChange(config Config, updatedBy string) {
    auditLog := AuditLog{
        ID:        uuid.New().String(),
        Timestamp: time.Now(),
        UserID:    updatedBy,
        Action:    "config.update",
        Resource:  "system_config",
        Result:    "success",
        Details: map[string]interface{}{
            "version": config.Version,
            "config":  config,
        },
    }
    
    WriteAuditLog(auditLog)
}
```

### 11.3 配置更新API

**更新配置接口**:
```go
// UpdateConfigHandler 更新配置处理器
func UpdateConfigHandler(c *gin.Context) {
    var req struct {
        APIRateLimit         *int                   `json:"api_rate_limit,omitempty"`
        QueryTimeout         *int                   `json:"query_timeout,omitempty"`
        MaxPageSize          *int                   `json:"max_page_size,omitempty"`
        CacheTTL             *int                   `json:"cache_ttl,omitempty"`
        LogLevel             *string                `json:"log_level,omitempty"`
        MaskingRules         []MaskingRule          `json:"masking_rules,omitempty"`
        AlertRules           []AlertRule            `json:"alert_rules,omitempty"`           // 告警规则热更新
        AlertThrottle        *int                   `json:"alert_throttle,omitempty"`
        CustomAlertTemplates []CustomAlertTemplate  `json:"custom_alert_templates,omitempty"` // 自定义告警模板
        AlertChannels        []AlertChannel         `json:"alert_channels,omitempty"`        // 告警通道配置
        BackupSchedule       *string                `json:"backup_schedule,omitempty"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "参数错误"})
        return
    }
    
    // 获取当前配置
    currentConfig := configManager.GetConfig()
    
    // 更新指定字段
    if req.APIRateLimit != nil {
        currentConfig.APIRateLimit = *req.APIRateLimit
    }
    if req.QueryTimeout != nil {
        currentConfig.QueryTimeout = *req.QueryTimeout
    }
    if req.MaxPageSize != nil {
        currentConfig.MaxPageSize = *req.MaxPageSize
    }
    if req.CacheTTL != nil {
        currentConfig.CacheTTL = *req.CacheTTL
    }
    if req.LogLevel != nil {
        currentConfig.LogLevel = *req.LogLevel
    }
    if req.MaskingRules != nil {
        currentConfig.MaskingRules = req.MaskingRules
    }
    if req.AlertRules != nil {
        currentConfig.AlertRules = req.AlertRules
    }
    if req.AlertThrottle != nil {
        currentConfig.AlertThrottle = *req.AlertThrottle
    }
    if req.CustomAlertTemplates != nil {
        currentConfig.CustomAlertTemplates = req.CustomAlertTemplates
    }
    if req.AlertChannels != nil {
        currentConfig.AlertChannels = req.AlertChannels
    }
    if req.BackupSchedule != nil {
        currentConfig.BackupSchedule = *req.BackupSchedule
    }
    
    // 获取当前用户
    claims := c.MustGet("claims").(*JWTClaims)
    
    // 更新配置
    if err := configManager.UpdateConfig(currentConfig, claims.UserID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "配置更新成功",
        "version": currentConfig.Version,
    })
}

// GetConfigHandler 获取当前配置
func GetConfigHandler(c *gin.Context) {
    config := configManager.GetConfig()
    c.JSON(200, config)
}

// GetConfigHistoryHandler 获取配置历史
func GetConfigHistoryHandler(c *gin.Context) {
    query := `
        SELECT version, config, updated_at, updated_by
        FROM system_config
        ORDER BY version DESC
        LIMIT 50
    `
    
    rows, err := db.Query(query)
    if err != nil {
        c.JSON(500, gin.H{"error": "查询失败"})
        return
    }
    defer rows.Close()
    
    var history []map[string]interface{}
    for rows.Next() {
        var version int64
        var configJSON []byte
        var updatedAt time.Time
        var updatedBy string
        
        rows.Scan(&version, &configJSON, &updatedAt, &updatedBy)
        
        var config Config
        json.Unmarshal(configJSON, &config)
        
        history = append(history, map[string]interface{}{
            "version":    version,
            "config":     config,
            "updated_at": updatedAt,
            "updated_by": updatedBy,
        })
    }
    
    c.JSON(200, gin.H{"history": history})
}
```

**自定义告警规则API**:
```go
// CreateAlertRuleHandler 创建告警规则(热更新)
func CreateAlertRuleHandler(c *gin.Context) {
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": "参数错误"})
        return
    }
    
    // 生成规则ID
    rule.ID = uuid.New().String()
    rule.CreatedAt = time.Now()
    rule.UpdatedAt = time.Now()
    
    // 获取当前用户
    claims := c.MustGet("claims").(*JWTClaims)
    rule.CreatedBy = claims.UserID
    
    // 获取当前配置
    config := configManager.GetConfig()
    
    // 添加新规则
    config.AlertRules = append(config.AlertRules, rule)
    
    // 热更新配置
    if err := configManager.UpdateConfig(config, claims.UserID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警规则创建成功(已热更新)",
        "rule_id": rule.ID,
    })
}

// UpdateAlertRuleHandler 更新告警规则(热更新)
func UpdateAlertRuleHandler(c *gin.Context) {
    ruleID := c.Param("id")
    
    var updatedRule AlertRule
    if err := c.ShouldBindJSON(&updatedRule); err != nil {
        c.JSON(400, gin.H{"error": "参数错误"})
        return
    }
    
    // 获取当前配置
    config := configManager.GetConfig()
    
    // 查找并更新规则
    found := false
    for i, rule := range config.AlertRules {
        if rule.ID == ruleID {
            updatedRule.ID = ruleID
            updatedRule.UpdatedAt = time.Now()
            updatedRule.CreatedAt = rule.CreatedAt
            updatedRule.CreatedBy = rule.CreatedBy
            config.AlertRules[i] = updatedRule
            found = true
            break
        }
    }
    
    if !found {
        c.JSON(404, gin.H{"error": "告警规则不存在"})
        return
    }
    
    // 获取当前用户
    claims := c.MustGet("claims").(*JWTClaims)
    
    // 热更新配置
    if err := configManager.UpdateConfig(config, claims.UserID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警规则更新成功(已热更新)",
    })
}

// DeleteAlertRuleHandler 删除告警规则(热更新)
func DeleteAlertRuleHandler(c *gin.Context) {
    ruleID := c.Param("id")
    
    // 获取当前配置
    config := configManager.GetConfig()
    
    // 查找并删除规则
    found := false
    newRules := make([]AlertRule, 0)
    for _, rule := range config.AlertRules {
        if rule.ID != ruleID {
            newRules = append(newRules, rule)
        } else {
            found = true
        }
    }
    
    if !found {
        c.JSON(404, gin.H{"error": "告警规则不存在"})
        return
    }
    
    config.AlertRules = newRules
    
    // 获取当前用户
    claims := c.MustGet("claims").(*JWTClaims)
    
    // 热更新配置
    if err := configManager.UpdateConfig(config, claims.UserID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警规则删除成功(已热更新)",
    })
}

// ListAlertRulesHandler 列出所有告警规则
func ListAlertRulesHandler(c *gin.Context) {
    config := configManager.GetConfig()
    c.JSON(200, gin.H{
        "rules": config.AlertRules,
        "total": len(config.AlertRules),
    })
}

// CreateAlertTemplateHandler 创建自定义告警模板(热更新)
func CreateAlertTemplateHandler(c *gin.Context) {
    var tmpl CustomAlertTemplate
    if err := c.ShouldBindJSON(&tmpl); err != nil {
        c.JSON(400, gin.H{"error": "参数错误"})
        return
    }
    
    // 生成模板ID
    tmpl.ID = uuid.New().String()
    tmpl.CreatedAt = time.Now()
    
    // 获取当前配置
    config := configManager.GetConfig()
    
    // 添加新模板
    config.CustomAlertTemplates = append(config.CustomAlertTemplates, tmpl)
    
    // 获取当前用户
    claims := c.MustGet("claims").(*JWTClaims)
    
    // 热更新配置
    if err := configManager.UpdateConfig(config, claims.UserID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警模板创建成功(已热更新)",
        "template_id": tmpl.ID,
    })
}

// CreateAlertChannelHandler 创建告警通道(热更新)
func CreateAlertChannelHandler(c *gin.Context) {
    var channel AlertChannel
    if err := c.ShouldBindJSON(&channel); err != nil {
        c.JSON(400, gin.H{"error": "参数错误"})
        return
    }
    
    // 生成通道ID
    channel.ID = uuid.New().String()
    
    // 获取当前配置
    config := configManager.GetConfig()
    
    // 添加新通道
    config.AlertChannels = append(config.AlertChannels, channel)
    
    // 获取当前用户
    claims := c.MustGet("claims").(*JWTClaims)
    
    // 热更新配置
    if err := configManager.UpdateConfig(config, claims.UserID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "告警通道创建成功(已热更新)",
        "channel_id": channel.ID,
    })
}
```

**自定义告警模板示例**:
```json
{
  "name": "数据库连接失败告警",
  "description": "数据库连接失败时的告警模板",
  "subject": "【严重】{{.Service}}数据库连接失败",
  "body": "告警时间: {{.Timestamp}}\n服务名称: {{.Service}}\n错误信息: {{.Message}}\n影响范围: {{.Impact}}\n建议操作: {{.Suggestion}}",
  "variables": ["Service", "Timestamp", "Message", "Impact", "Suggestion"],
  "format": "text"
}
```

**自定义告警通道示例**:
```json
{
  "type": "webhook",
  "name": "企业微信机器人",
  "enabled": true,
  "config": {
    "url": "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json"
    },
    "timeout": 5
  },
  "priority": 1
}
```

### 11.4 配置回滚机制

**回滚到指定版本**:
```go
// RollbackConfigHandler 回滚配置
func RollbackConfigHandler(c *gin.Context) {
    var req struct {
        Version int64 `json:"version" binding:"required"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "参数错误"})
        return
    }
    
    // 从数据库加载指定版本配置
    query := `
        SELECT config FROM system_config
        WHERE version = $1
    `
    
    var configJSON []byte
    err := db.QueryRow(query, req.Version).Scan(&configJSON)
    if err != nil {
        c.JSON(404, gin.H{"error": "配置版本不存在"})
        return
    }
    
    var config Config
    if err := json.Unmarshal(configJSON, &config); err != nil {
        c.JSON(500, gin.H{"error": "配置解析失败"})
        return
    }
    
    // 获取当前用户
    claims := c.MustGet("claims").(*JWTClaims)
    
    // 更新配置(会生成新版本)
    if err := configManager.UpdateConfig(config, claims.UserID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "message": "配置已回滚",
        "version": config.Version,
    })
}
```

### 11.5 YAML配置文件备用方案

**配置文件结构** (`/etc/log-management/config.yaml`):
```yaml
# 日志管理系统配置文件
# 注意: 此配置文件仅在Redis不可用时使用，需要重启服务生效

# API配置
api:
  rate_limit: 1000        # API速率限制(次/分钟)
  query_timeout: 30       # 查询超时时间(秒)
  max_page_size: 1000     # 最大分页大小

# 缓存配置
cache:
  ttl: 300                # 缓存TTL(秒)

# 日志配置
log:
  level: info             # 日志级别: debug, info, warn, error

# 脱敏规则
masking_rules:
  - field: password
    pattern: ".*"
    replace: "******"
  - field: credit_card
    pattern: '(\d{4})\d{8}(\d{4})'
    replace: "$1********$2"

# 告警规则(支持热更新)
alert_rules:
  - id: rule-001
    name: "高错误率告警"
    description: "当错误率超过5%时触发告警"
    enabled: true
    severity: high
    query: "level:ERROR"
    condition:
      type: threshold
      operator: gt
      value: 100
      window: 5m
    actions:
      - type: email
        recipients:
          - ops@example.com
      - type: webhook
        url: https://hooks.slack.com/xxx
    throttle: 15m
    tags:
      - production
      - critical

# 自定义告警模板
custom_alert_templates:
  - id: tmpl-001
    name: "数据库连接失败告警"
    description: "数据库连接失败时的告警模板"
    subject: "【严重】{{.Service}}数据库连接失败"
    body: |
      告警时间: {{.Timestamp}}
      服务名称: {{.Service}}
      错误信息: {{.Message}}
      影响范围: {{.Impact}}
      建议操作: {{.Suggestion}}
    variables:
      - Service
      - Timestamp
      - Message
      - Impact
      - Suggestion
    format: text

# 告警通道配置
alert_channels:
  - id: channel-001
    type: email
    name: "运维团队邮件"
    enabled: true
    config:
      smtp_host: smtp.example.com
      smtp_port: 587
      username: alert@example.com
      password: ${SMTP_PASSWORD}  # 支持环境变量
      from: alert@example.com
      use_tls: true
    priority: 1
  
  - id: channel-002
    type: webhook
    name: "企业微信机器人"
    enabled: true
    config:
      url: https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${WECOM_KEY}
      method: POST
      headers:
        Content-Type: application/json
      timeout: 5
    priority: 2
  
  - id: channel-003
    type: slack
    name: "Slack告警频道"
    enabled: true
    config:
      webhook_url: ${SLACK_WEBHOOK_URL}
      channel: "#alerts"
      username: "Log Alert Bot"
      icon_emoji: ":warning:"
    priority: 3

# 告警节流配置
alert:
  throttle: 900           # 告警节流时间(秒)

# 备份配置
backup:
  schedule: "0 2 * * 0"   # 备份计划(cron表达式)
```

**加载YAML配置**:
```go
// LoadConfigFromYAML 从YAML文件加载配置
func LoadConfigFromYAML(filepath string) (*Config, error) {
    data, err := ioutil.ReadFile(filepath)
    if err != nil {
        return nil, fmt.Errorf("读取配置文件失败: %w", err)
    }
    
    // 替换环境变量
    data = []byte(os.ExpandEnv(string(data)))
    
    var yamlConfig struct {
        API struct {
            RateLimit    int `yaml:"rate_limit"`
            QueryTimeout int `yaml:"query_timeout"`
            MaxPageSize  int `yaml:"max_page_size"`
        } `yaml:"api"`
        Cache struct {
            TTL int `yaml:"ttl"`
        } `yaml:"cache"`
        Log struct {
            Level string `yaml:"level"`
        } `yaml:"log"`
        MaskingRules         []MaskingRule         `yaml:"masking_rules"`
        AlertRules           []AlertRule           `yaml:"alert_rules"`
        CustomAlertTemplates []CustomAlertTemplate `yaml:"custom_alert_templates"`
        AlertChannels        []AlertChannel        `yaml:"alert_channels"`
        Alert struct {
            Throttle int `yaml:"throttle"`
        } `yaml:"alert"`
        Backup struct {
            Schedule string `yaml:"schedule"`
        } `yaml:"backup"`
    }
    
    if err := yaml.Unmarshal(data, &yamlConfig); err != nil {
        return nil, fmt.Errorf("解析配置文件失败: %w", err)
    }
    
    // 转换为Config结构
    config := &Config{
        APIRateLimit:         yamlConfig.API.RateLimit,
        QueryTimeout:         yamlConfig.API.QueryTimeout,
        MaxPageSize:          yamlConfig.API.MaxPageSize,
        CacheTTL:             yamlConfig.Cache.TTL,
        LogLevel:             yamlConfig.Log.Level,
        MaskingRules:         yamlConfig.MaskingRules,
        AlertRules:           yamlConfig.AlertRules,
        CustomAlertTemplates: yamlConfig.CustomAlertTemplates,
        AlertChannels:        yamlConfig.AlertChannels,
        AlertThrottle:        yamlConfig.Alert.Throttle,
        BackupSchedule:       yamlConfig.Backup.Schedule,
        Version:              time.Now().UnixNano(),
        UpdatedAt:            time.Now(),
        UpdatedBy:            "system",
    }
    
    return config, nil
}

// 启动时优先从Redis加载，失败则从YAML加载
func (cm *ConfigManager) Initialize() error {
    // 尝试从Redis加载
    if err := cm.loadConfigFromRedis(); err == nil {
        log.Info("从Redis加载配置成功")
        return nil
    }
    
    log.Warn("从Redis加载配置失败，尝试从YAML文件加载")
    
    // 从YAML文件加载
    config, err := LoadConfigFromYAML("/etc/log-management/config.yaml")
    if err != nil {
        return fmt.Errorf("从YAML文件加载配置失败: %w", err)
    }
    
    cm.config.Store(*config)
    
    // 尝试同步到Redis
    if err := cm.syncConfigToRedis(*config); err != nil {
        log.Warn("同步配置到Redis失败", "error", err)
    }
    
    log.Info("从YAML文件加载配置成功")
    return nil
}
```

**ConfigMap挂载YAML配置**:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-management-config
  namespace: log-management-prod
data:
  config.yaml: |
    api:
      rate_limit: 1000
      query_timeout: 30
      max_page_size: 1000
    cache:
      ttl: 300
    log:
      level: info
    alert_rules:
      - id: rule-001
        name: "高错误率告警"
        enabled: true
        severity: high
        query: "level:ERROR"
        condition:
          type: threshold
          operator: gt
          value: 100
          window: 5m
        actions:
          - type: email
            recipients:
              - ops@example.com
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
spec:
  template:
    spec:
      containers:
      - name: api-server
        volumeMounts:
        - name: config
          mountPath: /etc/log-management
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: log-management-config
```

**更新ConfigMap后重启服务**:
```bash
# 1. 更新ConfigMap
kubectl apply -f configmap.yaml

# 2. 重启服务使配置生效
kubectl rollout restart deployment/api-server -n log-management-prod

# 3. 等待滚动更新完成
kubectl rollout status deployment/api-server -n log-management-prod

# 4. 验证配置已生效
kubectl exec -it api-server-xxx -- curl localhost:8080/api/v1/config
```

### 11.6 验收标准

**功能验收**:
- ✅ 配置更新后1秒内所有实例生效
- ✅ 配置验证失败时保持原配置不变
- ✅ 配置变更记录审计日志
- ✅ 支持配置版本历史查询
- ✅ 支持配置回滚到任意历史版本
- ✅ 配置更新不影响正在处理的请求
- ✅ 告警规则支持热更新，无需重启服务
- ✅ 自定义告警模板支持热更新
- ✅ 告警通道配置支持热更新
- ✅ Redis不可用时自动降级到YAML配置文件
- ✅ 支持通过API和YAML两种方式管理配置

**性能验收**:
- ✅ 配置更新延迟 < 1秒
- ✅ 配置读取延迟 < 1ms (原子操作)
- ✅ 支持10000+ QPS的配置读取
- ✅ 告警规则热更新不影响告警引擎性能

**可靠性验收**:
- ✅ Redis不可用时使用本地缓存配置
- ✅ 配置更新失败时自动回滚
- ✅ 配置验证失败时拒绝更新
- ✅ 告警规则验证失败时保持原规则
- ✅ 告警通道连接失败时自动重试

**易用性验收**:
- ✅ 提供Web界面管理告警规则
- ✅ 支持告警规则模板导入导出
- ✅ 提供告警规则测试功能
- ✅ 支持告警模板变量预览
- ✅ 提供配置变更历史对比功能

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险类别 | 风险描述 | 概率 | 影响 | 缓解措施 |
|---------|---------|------|------|----------|
| 数据模型变更 | 字段类型变更导致数据不兼容 | 中 | 高 | 版本化迁移、向后兼容设计 |
| API接口变更 | 接口变更导致客户端不兼容 | 中 | 高 | API版本控制、废弃通知期 |
| 性能下降 | 新数据模型查询性能下降 | 低 | 中 | 性能测试、索引优化 |
| 数据丢失 | 迁移过程数据丢失 | 低 | 高 | 完整备份、灰度迁移 |
| 安全漏洞 | 新接口存在安全漏洞 | 低 | 高 | 安全审计、渗透测试 |
| 配置错误 | 热更新配置错误导致服务异常 | 中 | 中 | 配置验证、自动回滚 |
| 缓存雪崩 | 缓存失效导致数据库压力 | 低 | 高 | 缓存预热、限流保护 |
| 第三方依赖 | 外部系统不可用 | 中 | 中 | 降级策略、熔断机制 |

### 12.2 回滚方案

#### 12.2.1 数据模型回滚

**场景**: 新数据模型导致查询性能下降

**回滚步骤**:
```bash
# 1. 停止写入新模型
kubectl scale deployment collector --replicas=0

# 2. 切换到旧索引模板
curl -X PUT "localhost:9200/_index_template/logs-template" \
  -H 'Content-Type: application/json' \
  -d @old-template.json

# 3. 重建索引别名
curl -X POST "localhost:9200/_aliases" -H 'Content-Type: application/json' -d'
{
  "actions": [
    {"remove": {"index": "logs-new-*", "alias": "logs"}},
    {"add": {"index": "logs-old-*", "alias": "logs"}}
  ]
}'

# 4. 恢复写入
kubectl scale deployment collector --replicas=5

# 5. 验证数据写入
curl "localhost:9200/logs/_count"
```

**回滚时间**: 5分钟  
**数据影响**: 回滚期间的数据需要重新导入

#### 12.2.2 API接口回滚

**场景**: 新API接口存在bug

**回滚步骤**:
```bash
# 1. 使用蓝绿部署快速切换
kubectl patch service api-server -p '{"spec":{"selector":{"version":"v1.0.0"}}}'

# 2. 验证旧版本服务
curl http://api-server/health

# 3. 删除新版本部署
kubectl delete deployment api-server-v1.1.0

# 4. 回滚数据库迁移(如有)
migrate -path ./migrations -database "postgres://..." down 1
```

**回滚时间**: 2分钟  
**数据影响**: 无

#### 12.2.3 配置回滚

**场景**: 配置热更新导致服务异常

**自动回滚**:
```go
// 配置更新时自动验证
func (cm *ConfigManager) UpdateConfig(newConfig Config) error {
    // 保存旧配置
    oldConfig := cm.GetConfig()
    
    // 应用新配置
    cm.config.Store(newConfig)
    
    // 健康检查(30秒)
    time.Sleep(30 * time.Second)
    
    if !cm.healthCheck() {
        // 健康检查失败，自动回滚
        log.Error("健康检查失败，自动回滚配置")
        cm.config.Store(oldConfig)
        return fmt.Errorf("配置更新失败，已自动回滚")
    }
    
    return nil
}
```

**手动回滚**:
```bash
# 通过API回滚到指定版本
curl -X POST http://api-server/api/v1/config/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"version": 1706342400000}'
```

**回滚时间**: 1秒  
**数据影响**: 无

#### 12.2.4 数据库迁移回滚

**场景**: 数据库schema变更失败

**回滚步骤**:
```bash
# 1. 查看当前迁移版本
migrate -path ./migrations -database "postgres://..." version

# 2. 回滚到上一版本
migrate -path ./migrations -database "postgres://..." down 1

# 3. 验证数据完整性
psql -h postgres -U admin -d log_management -c "SELECT COUNT(*) FROM users;"

# 4. 重启应用
kubectl rollout restart deployment/api-server
```

**回滚时间**: 5分钟  
**数据影响**: 可能丢失迁移期间的数据

### 12.3 应急预案

#### 12.3.1 服务完全不可用

**应急措施**:
```bash
# 1. 立即切换到备用集群
kubectl config use-context backup-cluster

# 2. 更新DNS指向备用集群
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch file://dns-failover.json

# 3. 启动数据同步
./scripts/sync-data-from-primary.sh

# 4. 通知用户
./scripts/send-notification.sh "系统已切换到备用集群"
```

**恢复时间目标(RTO)**: 15分钟  
**恢复点目标(RPO)**: 5分钟

#### 12.3.2 数据损坏

**应急措施**:
```bash
# 1. 立即停止写入
kubectl scale deployment collector --replicas=0

# 2. 评估损坏范围
./scripts/check-data-integrity.sh

# 3. 从最近备份恢复
./scripts/restore.sh backup_20260127_020000

# 4. 验证数据完整性
./scripts/verify-data.sh

# 5. 恢复写入
kubectl scale deployment collector --replicas=5
```

**恢复时间**: 30分钟  
**数据丢失**: 最多5分钟数据

#### 12.3.3 性能严重下降

**应急措施**:
```bash
# 1. 启用降级模式
curl -X POST http://api-server/api/v1/system/degradation \
  -d '{"enabled": true, "level": "high"}'

# 2. 限制非关键功能
# - 禁用复杂查询
# - 禁用报表生成
# - 禁用数据导出

# 3. 扩容关键服务
kubectl scale deployment api-server --replicas=10
kubectl scale deployment collector --replicas=10

# 4. 清理缓存
redis-cli FLUSHDB

# 5. 重建索引
curl -X POST "localhost:9200/logs-*/_forcemerge?max_num_segments=1"
```

**恢复时间**: 10分钟

### 12.4 灾难恢复演练

**演练计划**:
```markdown
## 季度灾难恢复演练

### 演练目标
- 验证备份恢复流程
- 验证故障切换机制
- 验证应急响应流程
- 培训运维团队

### 演练场景
1. 主集群完全不可用
2. 数据库损坏
3. 网络分区
4. 存储故障

### 演练步骤
1. 准备阶段(1小时)
   - 通知相关人员
   - 准备演练环境
   - 检查备份完整性

2. 执行阶段(2小时)
   - 模拟故障
   - 执行恢复流程
   - 记录恢复时间
   - 验证数据完整性

3. 总结阶段(1小时)
   - 分析问题
   - 优化流程
   - 更新文档
   - 培训总结

### 成功标准
- RTO < 15分钟
- RPO < 5分钟
- 数据完整性100%
- 所有功能正常
```

### 12.5 变更管理流程

**变更分类**:
| 变更类型 | 审批级别 | 测试要求 | 回滚准备 |
|---------|---------|---------|---------|
| 紧急修复 | 技术负责人 | 冒烟测试 | 必须 |
| 常规变更 | 团队评审 | 完整测试 | 必须 |
| 重大变更 | 架构评审 | 全面测试+演练 | 必须 |

**变更流程**:
```
1. 提交变更申请
   ↓
2. 风险评估
   ↓
3. 审批
   ↓
4. 测试验证
   ↓
5. 准备回滚方案
   ↓
6. 执行变更
   ↓
7. 验证结果
   ↓
8. 文档更新
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 日志条目 | Log Entry | 单条日志记录，包含时间戳、级别、消息等字段 |
| 备份元数据 | Backup Metadata | 备份任务的描述信息，包含备份类型、大小、状态等 |
| 告警规则 | Alert Rule | 定义告警触发条件和响应动作的规则 |
| 热更新 | Hot Reload | 不重启服务即可更新配置的机制 |
| 数据模型 | Data Model | 数据结构的抽象定义 |
| REST API | RESTful API | 基于HTTP协议的应用程序接口 |
| 响应式设计 | Responsive Design | 适配不同屏幕尺寸的UI设计 |
| 国际化 | i18n | 支持多语言的软件设计 |
| 可访问性 | Accessibility | 让残障人士也能使用的设计 |
| 行级安全 | Row Level Security | 数据库行级别的访问控制 |
| 多租户 | Multi-tenancy | 多个租户共享同一系统实例 |
| 蓝绿部署 | Blue-Green Deployment | 通过两套环境实现零停机部署 |
| 金丝雀发布 | Canary Release | 逐步放量的发布策略 |
| 熔断 | Circuit Breaker | 防止故障扩散的保护机制 |
| 降级 | Degradation | 关闭非核心功能保证核心服务 |
| 限流 | Rate Limiting | 限制请求速率防止过载 |
| 脱敏 | Masking | 隐藏敏感信息的处理 |
| 审计日志 | Audit Log | 记录用户操作的日志 |
| 时序图 | Sequence Diagram | 展示对象交互时序的图表 |
| 状态机 | State Machine | 描述状态转换的模型 |

### 13.2 数据模型关系图

```
┌─────────────────────────────────────────────────────────────┐
│                    数据模型关系图                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐         ┌──────────┐         ┌──────────┐   │
│  │  Tenant  │────1:N──│   User   │────M:N──│   Role   │   │
│  │  (租户)  │         │  (用户)  │         │  (角色)  │   │
│  └──────────┘         └────┬─────┘         └────┬─────┘   │
│                            │                     │         │
│                            │ 1:N                 │ 1:N     │
│                            │                     │         │
│                            ▼                     ▼         │
│                      ┌──────────┐         ┌──────────┐    │
│                      │ LogEntry │         │Permission│    │
│                      │ (日志)   │         │ (权限)   │    │
│                      └────┬─────┘         └──────────┘    │
│                           │                               │
│                           │ 1:N                           │
│                           │                               │
│                           ▼                               │
│  ┌──────────┐       ┌──────────┐       ┌──────────┐     │
│  │AlertRule │──1:N─→│  Alert   │       │  Backup  │     │
│  │(告警规则)│       │ (告警)   │       │ (备份)   │     │
│  └──────────┘       └──────────┘       └──────────┘     │
│                                                           │
└─────────────────────────────────────────────────────────────┘
```

### 13.3 API版本兼容性

| API版本 | 发布日期 | 状态 | 支持截止日期 | 主要变更 |
|---------|---------|------|-------------|----------|
| v1.0 | 2026-01-01 | 稳定 | 2027-01-01 | 初始版本 |
| v1.1 | 2026-06-01 | 计划中 | - | 增加GraphQL支持 |
| v2.0 | 2027-01-01 | 计划中 | - | 重构数据模型 |

**废弃策略**:
- 新版本发布后，旧版本至少支持12个月
- 废弃前3个月发出通知
- 提供迁移指南和工具

### 13.4 性能基准测试结果

**测试环境**:
- CPU: 8核 Intel Xeon
- 内存: 32GB
- 磁盘: SSD 500GB
- 网络: 1Gbps

**测试结果**:
| 测试场景 | QPS | P50延迟 | P95延迟 | P99延迟 |
|---------|-----|---------|---------|---------|
| 日志查询(简单) | 5000 | 50ms | 150ms | 300ms |
| 日志查询(复杂) | 1000 | 200ms | 500ms | 1000ms |
| 日志写入 | 100000 | 5ms | 20ms | 50ms |
| 备份创建 | 10 | 1000ms | 2000ms | 3000ms |
| 告警规则查询 | 10000 | 10ms | 50ms | 100ms |
| 用户认证 | 5000 | 20ms | 100ms | 200ms |

### 13.5 参考文档

**内部文档**:
- [项目总体设计](./project-design-overview.md)
- [API设计文档](./api-design.md)
- [模块1设计：日志采集](./design-module1.md)
- [模块2设计：日志存储](./design-module2.md)
- [模块3设计：日志分析](./design-module3.md)
- [需求文档](../requirements/requirements-module25.md)

**外部参考**:
- [Elasticsearch官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [PostgreSQL官方文档](https://www.postgresql.org/docs/)
- [Redis官方文档](https://redis.io/documentation)
- [Kubernetes官方文档](https://kubernetes.io/docs/)
- [OpenAPI规范](https://swagger.io/specification/)
- [JWT规范](https://jwt.io/introduction)
- [OAuth 2.0规范](https://oauth.net/2/)
- [WCAG 2.1可访问性指南](https://www.w3.org/WAI/WCAG21/quickref/)

**技术博客**:
- [Elasticsearch性能优化最佳实践](https://www.elastic.co/blog/performance-considerations-elasticsearch-indexing)
- [PostgreSQL高可用架构](https://www.postgresql.org/docs/current/high-availability.html)
- [微服务配置管理](https://microservices.io/patterns/externalized-configuration.html)
- [API设计最佳实践](https://restfulapi.net/)

### 13.6 变更记录

| 日期 | 版本 | 变更内容 | 作者 | 审批人 |
|------|------|----------|------|--------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 | 技术总监 |
| 2026-02-01 | v1.0 | 补充配置热更新详细设计 | 系统架构团队 | 技术总监 |

### 13.7 FAQ

**Q1: 为什么选择PostgreSQL而不是MySQL？**
A: PostgreSQL支持更强大的JSON查询、行级安全(RLS)、更好的并发控制和ACID保证，更适合复杂的元数据管理场景。

**Q2: 配置热更新会影响正在处理的请求吗？**
A: 不会。配置更新使用atomic.Value原子操作，正在处理的请求会继续使用旧配置，新请求使用新配置。告警规则、告警模板、告警通道的热更新也是如此。

**Q3: 如何保证多租户数据隔离？**
A: 使用PostgreSQL的行级安全(RLS)策略，在数据库层面强制隔离。同时在应用层也进行租户ID验证。

**Q4: API限流是针对用户还是租户？**
A: 两者都有。用户级别限流防止单个用户滥用，租户级别限流保证公平性。

**Q5: 备份数据如何加密？**
A: 使用AES-256加密算法，密钥存储在HashiCorp Vault中，支持密钥轮换。

**Q6: 如何处理API版本升级？**
A: 使用URL路径版本控制(如/api/v1/、/api/v2/)，旧版本至少支持12个月，提供迁移指南。

**Q7: 响应式设计支持哪些设备？**
A: 支持桌面(≥1200px)、平板(768-1199px)、手机(<768px)三种断点，自动适配。

**Q8: 国际化如何实现？**
A: 前端使用react-i18next，后端使用go-i18n，支持动态语言切换，日期时间格式自动本地化。

**Q9: 如何监控配置热更新是否成功？**
A: 通过Prometheus指标`config_reload_total`和`config_reload_errors_total`监控，失败时触发告警。

**Q10: 数据模型变更如何保证向后兼容？**
A: 使用版本化字段(@version)，新增字段设为可选，废弃字段保留但标记为deprecated，提供数据迁移工具。

**Q11: 告警规则热更新后多久生效？**
A: 立即生效。告警引擎使用atomic.Value原子更新规则，更新后的下一条日志就会使用新规则进行匹配。

**Q12: 如何测试自定义告警规则？**
A: 提供告警规则测试API，可以模拟日志数据测试规则是否正确触发，无需等待真实告警。

**Q13: Redis不可用时告警规则还能更新吗？**
A: 可以通过更新YAML配置文件并重启服务来更新。系统会在启动时优先从Redis加载，失败则从YAML加载。

**Q14: 自定义告警模板支持哪些变量？**
A: 支持所有日志字段作为变量，如{{.Timestamp}}、{{.Level}}、{{.Message}}、{{.Service}}等，也支持自定义变量。

**Q15: 告警通道配置中的敏感信息如何保护？**
A: 支持使用环境变量(如${SMTP_PASSWORD})，实际密码存储在Kubernetes Secret中，不会明文保存在配置文件。

### 11.6 不推荐热更新的配置

以下配置项**不推荐使用热更新**，应通过YAML文件更新并重启服务：

| 配置项 | 是否热更新 | 说明 |
|--------|-----------|------|
| postgresql_host | ❌ 不推荐 | PostgreSQL主机地址变更需要重建连接池，可能导致短暂服务中断 |
| postgresql_port | ❌ 不推荐 | PostgreSQL端口变更需要重建连接池 |
| postgresql_database | ❌ 不推荐 | 数据库名称变更需要重建连接池和重新初始化 |
| postgresql_max_connections | ⚠️ 谨慎 | 连接池大小大幅变更可能影响系统稳定性，建议重启 |
| redis_address | ❌ 不推荐 | Redis地址变更需要重建连接，影响缓存和Pub/Sub |
| redis_password | ❌ 不推荐 | Redis密码变更需要重新认证，涉及安全性 |
| elasticsearch_urls | ❌ 不推荐 | ES集群地址变更需要重建客户端，可能影响查询和写入 |
| elasticsearch_username | ❌ 不推荐 | ES认证信息变更需要重新认证 |
| elasticsearch_password | ❌ 不推荐 | ES密码变更需要重新认证，涉及安全性 |
| kafka_brokers | ❌ 不推荐 | Kafka broker地址变更需要重建生产者/消费者 |
| server_port | ❌ 不推荐 | 服务端口变更需要重启HTTP服务器 |
| grpc_port | ❌ 不推荐 | gRPC端口变更需要重启gRPC服务器 |
| tls_cert_file | ❌ 不推荐 | TLS证书路径变更需要重新加载证书，涉及安全性 |
| tls_key_file | ❌ 不推荐 | TLS密钥路径变更需要重新加载密钥，涉及安全性 |
| jwt_secret | ❌ 不推荐 | JWT密钥变更会使所有现有Token失效，涉及安全性 |

**配置覆盖率**: 50% (10/20项)

**不推荐热更新的原因**:

1. **数据库连接配置** (postgresql_*, redis_*, elasticsearch_*, kafka_*)
   - 需要关闭现有连接并重新建立
   - 连接池需要完全重建
   - 可能导致短暂的服务中断
   - 可能存在未完成的事务或请求

2. **安全凭证配置** (passwords, jwt_secret, tls_*)
   - 涉及安全性，需要确保所有连接都使用新凭证
   - 密钥变更会使现有会话失效
   - 证书加载失败可能导致服务不可用
   - 建议在维护窗口期间更新

3. **服务端口配置** (server_port, grpc_port)
   - 需要重启HTTP/gRPC服务器
   - 端口占用可能导致启动失败
   - 客户端需要更新连接地址
   - 负载均衡器需要更新配置

4. **资源限制配置** (postgresql_max_connections)
   - 大幅变更可能影响系统稳定性
   - 需要评估系统资源是否充足
   - 建议在低峰期重启更新

**YAML配置文件示例**（不推荐热更新的配置）:

```yaml
# configs/infrastructure.yaml
# 基础设施配置（不推荐热更新，需要重启服务）

# PostgreSQL配置
postgresql:
  host: postgresql
  port: 5432
  database: log_management
  username: admin
  password: ${POSTGRES_PASSWORD}  # 从环境变量读取
  max_connections: 100
  max_idle_connections: 10
  connection_timeout: 30s
  ssl_mode: require

# Redis配置
redis:
  address: redis:6379
  password: ${REDIS_PASSWORD}
  db: 0
  pool_size: 100
  min_idle_conns: 10
  dial_timeout: 5s
  read_timeout: 3s
  write_timeout: 3s

# Elasticsearch配置
elasticsearch:
  urls:
    - http://elasticsearch-1:9200
    - http://elasticsearch-2:9200
    - http://elasticsearch-3:9200
  username: elastic
  password: ${ES_PASSWORD}
  max_retries: 3
  timeout: 30s
  sniff: true

# Kafka配置
kafka:
  brokers:
    - kafka-1:9092
    - kafka-2:9092
    - kafka-3:9092
  sasl_username: ${KAFKA_USERNAME}
  sasl_password: ${KAFKA_PASSWORD}
  sasl_mechanism: SCRAM-SHA-512
  tls_enabled: true

# 服务端口配置
server:
  http_port: 8080
  grpc_port: 9090
  metrics_port: 9091
  pprof_port: 6060

# TLS配置
tls:
  enabled: true
  cert_file: /etc/certs/server.crt
  key_file: /etc/certs/server.key
  ca_file: /etc/certs/ca.crt
  client_auth: require

# JWT配置
jwt:
  secret: ${JWT_SECRET}
  expiration: 24h
  refresh_expiration: 168h
  issuer: log-management-system
```

**配置更新流程**:

对于不推荐热更新的配置：
1. 修改YAML配置文件或更新ConfigMap
2. 验证配置格式正确性
3. 在维护窗口期间执行滚动重启
4. 监控服务健康状态
5. 验证功能正常

对于支持热更新的配置：
1. 通过API更新配置
2. 配置立即生效（< 100ms）
3. 无需重启服务
4. 检查配置版本和审计日志

### 11.7 配置热更新扩展接口

为了支持未来的配置热更新扩展，预留以下接口：

```go
// ConfigUpdateHook 配置更新钩子接口
type ConfigUpdateHook interface {
    // OnConfigUpdate 配置更新回调
    // oldConfig: 旧配置
    // newConfig: 新配置
    // 返回错误时会触发回滚
    OnConfigUpdate(oldConfig, newConfig Config) error
    
    // GetHookName 获取钩子名称
    GetHookName() string
    
    // GetPriority 获取钩子优先级（数字越小优先级越高）
    GetPriority() int
}

// ConfigValidator 配置验证器接口
type ConfigValidator interface {
    // Validate 验证配置
    Validate(config Config) error
    
    // GetValidatorName 获取验证器名称
    GetValidatorName() string
}

// ConfigLoader 配置加载器接口
type ConfigLoader interface {
    // LoadConfig 加载配置
    LoadConfig(ctx context.Context) (*Config, error)
    
    // SaveConfig 保存配置
    SaveConfig(ctx context.Context, config *Config) error
    
    // GetLoaderName 获取加载器名称
    GetLoaderName() string
    
    // GetPriority 获取加载器优先级（数字越小优先级越高）
    GetPriority() int
}

// AlertRuleValidator 告警规则验证器接口
type AlertRuleValidator interface {
    // ValidateRule 验证告警规则
    ValidateRule(rule AlertRule) error
    
    // GetValidatorName 获取验证器名称
    GetValidatorName() string
}

// AlertTemplateRenderer 告警模板渲染器接口
type AlertTemplateRenderer interface {
    // Render 渲染告警模板
    Render(template CustomAlertTemplate, data map[string]interface{}) (string, error)
    
    // GetRendererName 获取渲染器名称
    GetRendererName() string
    
    // SupportedFormats 支持的格式列表
    SupportedFormats() []string
}

// AlertChannelSender 告警通道发送器接口
type AlertChannelSender interface {
    // Send 发送告警
    Send(ctx context.Context, channel AlertChannel, message string) error
    
    // GetSenderName 获取发送器名称
    GetSenderName() string
    
    // SupportedTypes 支持的通道类型
    SupportedTypes() []string
}

// 扩展配置管理器
type ExtendedConfigManager struct {
    *ConfigManager
    hooks           []ConfigUpdateHook
    validators      []ConfigValidator
    loaders         []ConfigLoader
    ruleValidators  []AlertRuleValidator
    templateRenderers map[string]AlertTemplateRenderer
    channelSenders    map[string]AlertChannelSender
}

// RegisterHook 注册配置更新钩子
func (ecm *ExtendedConfigManager) RegisterHook(hook ConfigUpdateHook) {
    ecm.hooks = append(ecm.hooks, hook)
    // 按优先级排序
    sort.Slice(ecm.hooks, func(i, j int) bool {
        return ecm.hooks[i].GetPriority() < ecm.hooks[j].GetPriority()
    })
}

// RegisterValidator 注册配置验证器
func (ecm *ExtendedConfigManager) RegisterValidator(validator ConfigValidator) {
    ecm.validators = append(ecm.validators, validator)
}

// RegisterLoader 注册配置加载器
func (ecm *ExtendedConfigManager) RegisterLoader(loader ConfigLoader) {
    ecm.loaders = append(ecm.loaders, loader)
    // 按优先级排序
    sort.Slice(ecm.loaders, func(i, j int) bool {
        return ecm.loaders[i].GetPriority() < ecm.loaders[j].GetPriority()
    })
}

// RegisterRuleValidator 注册告警规则验证器
func (ecm *ExtendedConfigManager) RegisterRuleValidator(validator AlertRuleValidator) {
    ecm.ruleValidators = append(ecm.ruleValidators, validator)
}

// RegisterTemplateRenderer 注册告警模板渲染器
func (ecm *ExtendedConfigManager) RegisterTemplateRenderer(renderer AlertTemplateRenderer) {
    for _, format := range renderer.SupportedFormats() {
        ecm.templateRenderers[format] = renderer
    }
}

// RegisterChannelSender 注册告警通道发送器
func (ecm *ExtendedConfigManager) RegisterChannelSender(sender AlertChannelSender) {
    for _, channelType := range sender.SupportedTypes() {
        ecm.channelSenders[channelType] = sender
    }
}

// UpdateConfigWithHooks 更新配置（调用所有钩子）
func (ecm *ExtendedConfigManager) UpdateConfigWithHooks(newConfig Config, updatedBy string) error {
    oldConfig := ecm.GetConfig()
    
    // 1. 执行所有验证器
    for _, validator := range ecm.validators {
        if err := validator.Validate(newConfig); err != nil {
            return fmt.Errorf("验证器 %s 失败: %w", validator.GetValidatorName(), err)
        }
    }
    
    // 2. 验证告警规则
    for _, rule := range newConfig.AlertRules {
        for _, validator := range ecm.ruleValidators {
            if err := validator.ValidateRule(rule); err != nil {
                return fmt.Errorf("告警规则验证器 %s 失败: %w", validator.GetValidatorName(), err)
            }
        }
    }
    
    // 3. 执行所有钩子（按优先级）
    for _, hook := range ecm.hooks {
        if err := hook.OnConfigUpdate(oldConfig, newConfig); err != nil {
            return fmt.Errorf("钩子 %s 失败: %w", hook.GetHookName(), err)
        }
    }
    
    // 4. 更新配置
    return ecm.UpdateConfig(newConfig, updatedBy)
}

// LoadConfigWithLoaders 使用加载器加载配置
func (ecm *ExtendedConfigManager) LoadConfigWithLoaders(ctx context.Context) (*Config, error) {
    // 按优先级尝试各个加载器
    for _, loader := range ecm.loaders {
        config, err := loader.LoadConfig(ctx)
        if err == nil {
            log.Info("配置加载成功", "loader", loader.GetLoaderName())
            return config, nil
        }
        log.Warn("配置加载失败", "loader", loader.GetLoaderName(), "error", err)
    }
    
    return nil, fmt.Errorf("所有配置加载器都失败")
}
```

**扩展示例**:

```go
// 示例1: 自定义配置验证器
type BusinessRuleValidator struct{}

func (brv *BusinessRuleValidator) Validate(config Config) error {
    // 验证业务规则
    // 例如：确保API限流不低于最小值
    if config.APIRateLimit < 100 {
        return fmt.Errorf("API限流不能低于100次/分钟")
    }
    
    // 验证查询超时时间合理性
    if config.QueryTimeout > 300 {
        return fmt.Errorf("查询超时时间不能超过300秒")
    }
    
    // 验证告警规则数量
    if len(config.AlertRules) > 1000 {
        return fmt.Errorf("告警规则数量不能超过1000个")
    }
    
    return nil
}

func (brv *BusinessRuleValidator) GetValidatorName() string {
    return "BusinessRuleValidator"
}

// 示例2: 自定义配置更新钩子
type MetricsHook struct {
    metricsClient *MetricsClient
}

func (mh *MetricsHook) OnConfigUpdate(oldConfig, newConfig Config) error {
    // 记录配置变更指标
    mh.metricsClient.RecordConfigChange(
        "log_management",
        oldConfig.Version,
        newConfig.Version,
    )
    
    // 记录具体变更
    if oldConfig.APIRateLimit != newConfig.APIRateLimit {
        mh.metricsClient.RecordConfigFieldChange("api_rate_limit", 
            fmt.Sprint(oldConfig.APIRateLimit), 
            fmt.Sprint(newConfig.APIRateLimit))
    }
    
    if len(oldConfig.AlertRules) != len(newConfig.AlertRules) {
        mh.metricsClient.RecordConfigFieldChange("alert_rules_count",
            fmt.Sprint(len(oldConfig.AlertRules)),
            fmt.Sprint(len(newConfig.AlertRules)))
    }
    
    return nil
}

func (mh *MetricsHook) GetHookName() string {
    return "MetricsHook"
}

func (mh *MetricsHook) GetPriority() int {
    return 100 // 低优先级，最后执行
}

// 示例3: 自定义配置加载器（从Consul加载）
type ConsulConfigLoader struct {
    consulClient *consul.Client
}

func (ccl *ConsulConfigLoader) LoadConfig(ctx context.Context) (*Config, error) {
    key := "log_management/config"
    pair, _, err := ccl.consulClient.KV().Get(key, nil)
    if err != nil {
        return nil, err
    }
    
    if pair == nil {
        return nil, fmt.Errorf("配置不存在")
    }
    
    var config Config
    if err := json.Unmarshal(pair.Value, &config); err != nil {
        return nil, err
    }
    
    return &config, nil
}

func (ccl *ConsulConfigLoader) SaveConfig(ctx context.Context, config *Config) error {
    key := "log_management/config"
    data, err := json.Marshal(config)
    if err != nil {
        return err
    }
    
    _, err = ccl.consulClient.KV().Put(&consul.KVPair{
        Key:   key,
        Value: data,
    }, nil)
    
    return err
}

func (ccl *ConsulConfigLoader) GetLoaderName() string {
    return "ConsulConfigLoader"
}

func (ccl *ConsulConfigLoader) GetPriority() int {
    return 10 // 高优先级，优先尝试
}

// 示例4: 自定义告警规则验证器
type CustomRuleValidator struct {
    db *sql.DB
}

func (crv *CustomRuleValidator) ValidateRule(rule AlertRule) error {
    // 验证规则名称唯一性
    var count int
    err := crv.db.QueryRow(`
        SELECT COUNT(*) FROM alert_rules 
        WHERE name = $1 AND id != $2
    `, rule.Name, rule.ID).Scan(&count)
    
    if err != nil {
        return err
    }
    
    if count > 0 {
        return fmt.Errorf("告警规则名称已存在: %s", rule.Name)
    }
    
    // 验证查询语法
    if !isValidQuery(rule.Query) {
        return fmt.Errorf("查询语法错误: %s", rule.Query)
    }
    
    // 验证条件值合理性
    if rule.Condition.Type == "threshold" {
        if value, ok := rule.Condition.Value.(float64); ok {
            if value < 0 {
                return fmt.Errorf("阈值不能为负数")
            }
        }
    }
    
    return nil
}

func (crv *CustomRuleValidator) GetValidatorName() string {
    return "CustomRuleValidator"
}

// 示例5: 自定义告警模板渲染器（Markdown格式）
type MarkdownTemplateRenderer struct{}

func (mtr *MarkdownTemplateRenderer) Render(template CustomAlertTemplate, data map[string]interface{}) (string, error) {
    // 使用Go模板引擎渲染
    tmpl, err := textTemplate.New("alert").Parse(template.Body)
    if err != nil {
        return "", err
    }
    
    var buf bytes.Buffer
    if err := tmpl.Execute(&buf, data); err != nil {
        return "", err
    }
    
    // 转换为Markdown格式
    markdown := fmt.Sprintf("# %s\n\n%s", template.Subject, buf.String())
    
    return markdown, nil
}

func (mtr *MarkdownTemplateRenderer) GetRendererName() string {
    return "MarkdownTemplateRenderer"
}

func (mtr *MarkdownTemplateRenderer) SupportedFormats() []string {
    return []string{"markdown", "md"}
}

// 示例6: 自定义告警通道发送器（企业微信）
type WeChatWorkSender struct {
    webhookURL string
}

func (wcs *WeChatWorkSender) Send(ctx context.Context, channel AlertChannel, message string) error {
    // 构建企业微信消息
    payload := map[string]interface{}{
        "msgtype": "text",
        "text": map[string]string{
            "content": message,
        },
    }
    
    data, _ := json.Marshal(payload)
    
    // 发送到企业微信
    resp, err := http.Post(wcs.webhookURL, "application/json", bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != 200 {
        return fmt.Errorf("企业微信通知失败: %d", resp.StatusCode)
    }
    
    return nil
}

func (wcs *WeChatWorkSender) GetSenderName() string {
    return "WeChatWorkSender"
}

func (wcs *WeChatWorkSender) SupportedTypes() []string {
    return []string{"wechat_work", "wecom"}
}

// 使用扩展接口
func main() {
    // 创建扩展配置管理器
    ecm := &ExtendedConfigManager{
        ConfigManager:     NewConfigManager(redis, postgres),
        templateRenderers: make(map[string]AlertTemplateRenderer),
        channelSenders:    make(map[string]AlertChannelSender),
    }
    
    // 注册自定义验证器
    ecm.RegisterValidator(&BusinessRuleValidator{})
    
    // 注册自定义钩子
    ecm.RegisterHook(&MetricsHook{
        metricsClient: metricsClient,
    })
    
    // 注册自定义加载器
    ecm.RegisterLoader(&ConsulConfigLoader{
        consulClient: consulClient,
    })
    
    // 注册告警规则验证器
    ecm.RegisterRuleValidator(&CustomRuleValidator{
        db: db,
    })
    
    // 注册告警模板渲染器
    ecm.RegisterTemplateRenderer(&MarkdownTemplateRenderer{})
    
    // 注册告警通道发送器
    ecm.RegisterChannelSender(&WeChatWorkSender{
        webhookURL: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx",
    })
}
```

**扩展点说明**:
1. **ConfigUpdateHook**: 在配置更新时执行自定义逻辑（如记录指标、发送通知、触发其他操作等）
2. **ConfigValidator**: 添加自定义验证规则（如业务规则验证、合理性检查、依赖检查等）
3. **ConfigLoader**: 支持从多种配置源加载配置（如Consul、etcd、配置中心、数据库等）
4. **AlertRuleValidator**: 验证告警规则的业务逻辑（如唯一性、语法检查、合理性验证等）
5. **AlertTemplateRenderer**: 支持自定义告警模板格式（如Markdown、HTML、富文本等）
6. **AlertChannelSender**: 支持自定义告警通道（如企业微信、飞书、自定义Webhook等）
7. **优先级机制**: 钩子和加载器按优先级顺序执行，支持精细控制
8. **错误处理**: 任何钩子或验证器失败都会触发回滚，保证配置一致性

---

### 13.8 联系方式

**技术支持**:
- 邮箱: tech-support@example.com
- Slack: #log-management-support
- 工单系统: https://jira.example.com

**架构团队**:
- 邮箱: architecture@example.com
- 会议: 每周三下午2点架构评审会

**紧急联系**:
- 值班电话: +86-xxx-xxxx-xxxx
- 告警通知: PagerDuty

### 13.9 变更记录

| 日期 | 版本 | 变更内容 | 作者 | 审批人 |
|------|------|----------|------|--------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 | 技术总监 |
| 2026-02-01 | v1.1 | 补充不推荐热更新配置说明和扩展接口设计 | 系统架构团队 | 技术总监 |

---

**文档结束**

> 本文档为模块25：数据模型与系统接口的完整技术设计文档，涵盖了数据模型定义、API接口规范、外部系统集成、用户界面设计、配置热更新机制等所有关键内容。文档遵循项目设计规范，与其他模块设计保持一致。
