# 模块二：日志存储 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module2.md](../requirements/requirements-module2.md)

---

## 1. 文档信息

### 1.1 版本历史

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档

- [需求文档](../requirements/requirements-module2.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块1设计](./design-module1.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    日志存储模块架构                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  配置中心 (PostgreSQL + Redis)                                  │
│       ↓ (ILM策略、备份配置)                                     │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  ILM Manager (索引生命周期管理)                      │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 热存储(ES)  │→│ 温存储(ES)  │→│ 冷存储(S3)  │     │      │
│  │  │ 0-7天/SSD  │  │ 8-30天/HDD │  │ 31天-1年   │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  │         ↓              ↓              ↓              │      │
│  │  ┌────────────────────────────────────────────┐     │      │
│  │  │ 归档存储 (S3 Glacier) - 1年+              │     │      │
│  │  └────────────────────────────────────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Backup Manager (备份与恢复)                         │      │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │      │
│  │  │ 全量备份    │  │ 增量备份    │  │ 快照备份    │     │      │
│  │  │ (每周)     │  │ (每日)     │  │ (实时)     │     │      │
│  │  └────────────┘  └────────────┘  └────────────┘     │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| ILM管理器 | 生命周期管理 | 自动迁移、策略评估、安全删除 |
| 热存储层 | 快速检索 | ES索引、SSD存储、3副本 |
| 温存储层 | 中速查询 | ES压缩、HDD存储、2副本 |
| 冷存储层 | 归档查询 | Parquet格式、S3存储、高压缩 |
| 备份管理器 | 数据保护 | 全量/增量/快照备份、恢复验证 |

### 2.3 关键路径

```
写入路径: Kafka → ES热存储(200ms) → 索引刷新(5s)
迁移路径: 热存储 → 温存储(7天) → 冷存储(30天) → 归档(1年)
查询路径: 查询请求 → 缓存检查 → ES查询(500ms) → 返回结果
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Elasticsearch | 8.11+ | 全文检索强、查询延迟低 |
| MinIO/S3 | - | 对象存储、成本低 |
| S3 Glacier | - | 深度归档、极低成本 |
| Apache Parquet | - | 列式存储、高压缩率 |
| Zstd | - | 高压缩比、解压快 |

### 3.2 存储层级对比

| 层级 | 介质 | 副本 | 压缩 | 延迟 | 成本 |
|------|------|------|------|------|------|
| 热存储 | SSD | 3 | 无/低 | <500ms | 高 |
| 温存储 | HDD | 2 | 中 | <2s | 中 |
| 冷存储 | S3 | 1 | 高 | <30s | 低 |
| 归档 | Glacier | 1 | 极高 | 小时级 | 极低 |

---

## 4. 关键流程设计

### 4.1 ILM自动迁移流程

```
1. 定时任务(每天凌晨2点)触发策略评估
2. 扫描所有索引，检查年龄和访问频率
3. 匹配迁移规则:
   - 7天未访问 → 热→温
   - 30天未访问 → 温→冷
   - 1年未访问 → 冷→归档
4. 执行数据迁移:
   - 读取源数据
   - 压缩转换(Parquet+Zstd)
   - 写入目标存储
   - 验证完整性(SHA-256)
   - 删除源数据
5. 更新索引元数据
6. 记录审计日志
```

### 4.2 备份恢复流程

**全量备份**:
```
1. 创建ES快照
2. 导出所有索引数据
3. 计算SHA-256校验和
4. AES-256加密
5. 上传到S3(跨区域复制)
6. 验证备份完整性
7. 更新备份元数据
```

**增量备份**:
```
1. 获取上次备份时间点
2. 导出变更数据(基于@timestamp)
3. 压缩加密
4. 上传到S3
5. 记录基准备份ID
```

**恢复流程**:
```
1. 选择恢复时间点
2. 查找对应的全量备份
3. 查找所有增量备份
4. 下载并验证完整性
5. 解密解压
6. 按顺序恢复数据
7. 验证数据一致性
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块2部分，共34个接口:

- ILM策略管理: 增删改查、启用禁用
- 存储层级管理: 使用率查询、迁移触发
- 备份策略管理: 策略配置、手动备份
- 备份管理: 列表查询、验证、恢复
- 生命周期管理: 策略评估、执行、审计
- 配置热更新: 触发更新、版本查询
- 健康检查: 状态查询、指标获取

---

## 6. 数据设计

### 6.1 索引模板

**热存储索引模板**:

```json
{
  "index_patterns": ["logs-hot-*"],
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 2,
    "codec": "best_compression",
    "refresh_interval": "5s",
    "index.lifecycle.name": "hot-warm-cold-policy"
  },
  "mappings": {
    "properties": {
      "@timestamp": {"type": "date"},
      "level": {"type": "keyword"},
      "message": {"type": "text"},
      "source": {"type": "keyword"}
    }
  }
}
```

### 6.2 ILM策略配置

```json
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_size": "50GB",
            "max_age": "1d"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": {"number_of_shards": 1},
          "forcemerge": {"max_num_segments": 1},
          "allocate": {"require": {"data": "warm"}}
        }
      },
      "cold": {
        "min_age": "30d",
        "actions": {
          "searchable_snapshot": {
            "snapshot_repository": "s3-repo"
          }
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": {"delete": {}}
      }
    }
  }
}
```

### 6.3 备份元数据

```go
type BackupMetadata struct {
    ID            string    // 备份ID
    Type          string    // full/incremental/snapshot
    StartTime     time.Time // 开始时间
    EndTime       time.Time // 结束时间
    Duration      time.Duration // 耗时
    OriginalSize  int64     // 原始大小
    BackupSize    int64     // 备份大小
    Checksum      string    // SHA-256校验和
    Encrypted     bool      // 是否加密
    BaseBackupID  string    // 基准备份ID(增量)
    Status        string    // completed/failed/running
}
```

---

## 7. 安全设计

### 7.1 数据加密

**传输加密**:
- ES集群间通信: TLS 1.3
- S3上传下载: HTTPS + TLS 1.3

**存储加密**:
- 备份数据: AES-256-GCM
- 冷存储: S3服务端加密(SSE-S3)
- 密钥管理: AWS KMS / HashiCorp Vault

### 7.2 访问控制

- ES索引级别权限控制
- S3存储桶策略限制
- 备份操作需要admin权限
- 审计所有数据访问操作

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 写入吞吐 | 10万条/秒 | ES bulk API |
| 查询延迟P95 | <500ms | APM监控 |
| 迁移速度 | 1TB/小时 | 迁移任务统计 |
| 压缩率 | >70% | 压缩前后对比 |
| 备份速度 | 500GB/小时 | 备份任务统计 |

### 8.2 优化策略

**写入优化**:
- Bulk批量写入(10000条/批)
- 异步刷新(5秒间隔)
- 禁用_source字段(节省空间)
- 使用routing key(提升查询性能)

**查询优化**:
- 多级缓存(本地+Redis)
- 索引预热(常用索引)
- 分片优化(5个主分片)
- 使用filter context(可缓存)

**存储优化**:
- 冷数据Parquet列式存储
- Zstd高压缩比(level 9)
- S3生命周期策略(自动归档)
- 定期清理过期数据

---

## 9. 部署方案

### 9.1 ES集群部署

**节点配置**:

| 节点类型 | 数量 | CPU | 内存 | 磁盘 | 角色 |
|---------|------|-----|------|------|------|
| Master | 3 | 2核 | 4GB | 50GB | 集群管理 |
| Hot Data | 3 | 8核 | 32GB | 1TB SSD | 热数据 |
| Warm Data | 2 | 4核 | 16GB | 2TB HDD | 温数据 |

**Kubernetes部署**:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch-hot
spec:
  serviceName: elasticsearch
  replicas: 3
  template:
    spec:
      containers:
      - name: elasticsearch
        image: elasticsearch:8.11
        resources:
          requests:
            cpu: 4
            memory: 16Gi
          limits:
            cpu: 8
            memory: 32Gi
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
          storage: 1Ti
```

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus指标**:

```
# 存储指标
storage_tier_usage_bytes{tier="hot|warm|cold"}
storage_tier_usage_percent{tier="hot|warm|cold"}
storage_index_count{tier="hot|warm|cold"}
storage_document_count{tier="hot|warm|cold"}

# ILM指标
ilm_migration_total{from="hot",to="warm",status="success|failed"}
ilm_migration_duration_seconds
ilm_policy_execution_total

# 备份指标
backup_total{type="full|incremental",status="success|failed"}
backup_duration_seconds{type="full|incremental"}
backup_size_bytes{type="full|incremental"}
backup_compression_ratio

# ES集群指标
es_cluster_health{status="green|yellow|red"}
es_node_jvm_memory_used_percent
es_indices_search_query_time_seconds
```

### 10.2 告警规则

| 告警 | 条件 | 级别 | 处理 |
|------|------|------|------|
| 存储使用率高 | >80% | Warning | 触发提前迁移 |
| 存储空间不足 | >90% | Critical | 紧急扩容 |
| 迁移失败 | 连续3次 | Critical | 检查迁移任务 |
| 备份失败 | 任意失败 | Critical | 立即重试 |
| 集群状态异常 | status!=green | Warning | 检查节点状态 |

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

```
┌─────────────────────────────────────────────────────────────┐
│  基础设施层 (Kubernetes)                                     │
│  ❌ 不支持热更新，需要 kubectl apply + 滚动重启              │
│  - StatefulSet配置、镜像版本、资源限制                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  连接层 (基础服务连接)                                       │
│  ⚠️ 不推荐热更新，建议通过YAML文件更新并重启服务             │
│  - Elasticsearch集群地址、S3连接配置                        │
│  原因：需要重建ES客户端连接，可能导致短暂服务中断            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  应用层 (业务配置)                                           │
│  ✅ 推荐热更新，通过Redis Pub/Sub立即生效                    │
│  - ILM策略、备份策略、压缩配置                               │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| hot_phase_min_age | string | "0d" | 热存储最小年龄 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| warm_phase_min_age | string | "7d" | 温存储最小年龄 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| cold_phase_min_age | string | "30d" | 冷存储最小年龄 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| delete_phase_min_age | string | "365d" | 删除最小年龄 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| hot_replica_count | int | 2 | 热存储副本数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| warm_replica_count | int | 1 | 温存储副本数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| compression_codec | string | "best_compression" | 压缩算法 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| backup_schedule_full | string | "0 2 * * 0" | 全量备份Cron | Redis Pub/Sub | 下次调度 | ✅ 推荐 |
| backup_schedule_incremental | string | "0 2 * * *" | 增量备份Cron | Redis Pub/Sub | 下次调度 | ✅ 推荐 |
| backup_retention_days | int | 30 | 备份保留天数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| es_cluster_urls | array | [] | ES集群地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| s3_endpoint | string | "" | S3端点地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| s3_credentials | object | {} | S3认证信息 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |

**不推荐热更新的原因说明**:

1. **Elasticsearch集群地址** (es_cluster_urls):
   - 需要重建ES客户端连接
   - 需要重新初始化连接池
   - 可能导致正在进行的操作失败
   - 建议：通过YAML文件更新并重启服务

2. **S3连接配置** (s3_endpoint, s3_credentials):
   - 需要重建S3客户端
   - 涉及认证信息变更
   - 可能影响正在进行的备份任务
   - 建议：通过YAML文件更新并重启服务

**备用更新方式**:
- 如果Redis不可用，支持通过YAML配置文件更新，需要重启服务
- 配置文件路径: `/etc/storage-manager/config.yaml`
- 重启命令: `kubectl rollout restart deployment/storage-manager`

### 11.3 热更新实现

```go
// StorageConfig 存储配置
type StorageConfig struct {
    // ILM策略配置 (✅ 支持热更新)
    HotPhaseMinAge    string `json:"hot_phase_min_age"`
    WarmPhaseMinAge   string `json:"warm_phase_min_age"`
    ColdPhaseMinAge   string `json:"cold_phase_min_age"`
    DeletePhaseMinAge string `json:"delete_phase_min_age"`
    
    // 副本配置 (✅ 支持热更新)
    HotReplicaCount  int `json:"hot_replica_count"`
    WarmReplicaCount int `json:"warm_replica_count"`
    
    // 压缩配置 (✅ 支持热更新)
    CompressionCodec string `json:"compression_codec"`
    
    // 备份配置 (✅ 支持热更新)
    BackupScheduleFull        string `json:"backup_schedule_full"`
    BackupScheduleIncremental string `json:"backup_schedule_incremental"`
    BackupRetentionDays       int    `json:"backup_retention_days"`
    
    // 元数据
    Version   int64     `json:"version"`
    UpdatedAt time.Time `json:"updated_at"`
    UpdatedBy string    `json:"updated_by"`
}

// StorageManager 存储管理器
type StorageManager struct {
    ilmPolicy    atomic.Value  // 存储*ILMPolicy
    backupConfig atomic.Value  // 存储*BackupConfig
    redis        *redis.Client
    esClient     *elasticsearch.Client
    
    // 扩展接口
    configHooks  []ConfigHook  // 配置变更钩子
    policyLoader PolicyLoader  // 策略加载器
}

// ConfigHook 配置变更钩子接口(扩展点)
type ConfigHook interface {
    // OnConfigChange 配置变更时调用
    OnConfigChange(oldConfig, newConfig *StorageConfig) error
    
    // Name 钩子名称
    Name() string
}

// PolicyLoader 策略加载器接口(扩展点)
type PolicyLoader interface {
    // LoadPolicy 加载ILM策略
    LoadPolicy(name string) (*ILMPolicy, error)
    
    // ApplyPolicy 应用ILM策略到ES
    ApplyPolicy(policy *ILMPolicy) error
    
    // ValidatePolicy 验证策略
    ValidatePolicy(policy *ILMPolicy) error
}

// RegisterConfigHook 注册配置变更钩子(扩展接口)
func (sm *StorageManager) RegisterConfigHook(hook ConfigHook) {
    sm.mu.Lock()
    defer sm.mu.Unlock()
    sm.configHooks = append(sm.configHooks, hook)
    log.Info("注册配置钩子", "name", hook.Name())
}

// 订阅ILM策略变更
func (sm *StorageManager) subscribeILMChanges() {
    pubsub := sm.redis.Subscribe(context.Background(), "config:ilm:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        // 从Redis获取最新配置
        newConfig, err := sm.loadConfigFromRedis()
        if err != nil {
            log.Error("加载ILM配置失败", "error", err)
            continue
        }
        
        // 验证配置
        if err := sm.validateConfig(newConfig); err != nil {
            log.Error("ILM配置验证失败", "error", err)
            continue
        }
        
        // 获取旧配置
        oldConfig := sm.getConfig()
        
        // 执行配置变更钩子
        for _, hook := range sm.configHooks {
            if err := hook.OnConfigChange(oldConfig, newConfig); err != nil {
                log.Error("配置钩子执行失败", "hook", hook.Name(), "error", err)
                return
            }
        }
        
        // 构建ILM策略
        policy := sm.buildILMPolicy(newConfig)
        
        // 应用到ES
        if err := sm.applyILMPolicy(policy); err != nil {
            log.Error("应用ILM策略失败", "error", err)
            // 回滚配置
            continue
        }
        
        // 原子更新配置
        sm.ilmPolicy.Store(policy)
        
        log.Info("ILM策略已更新", "version", newConfig.Version)
    }
}

// applyILMPolicy 应用ILM策略到ES
func (sm *StorageManager) applyILMPolicy(policy *ILMPolicy) error {
    // 构建ES ILM策略JSON
    policyJSON, err := json.Marshal(policy)
    if err != nil {
        return fmt.Errorf("序列化策略失败: %w", err)
    }
    
    // 调用ES API更新策略
    req := esapi.ILMPutLifecycleRequest{
        Policy: policy.Name,
        Body:   bytes.NewReader(policyJSON),
    }
    
    res, err := req.Do(context.Background(), sm.esClient)
    if err != nil {
        return fmt.Errorf("更新ES策略失败: %w", err)
    }
    defer res.Body.Close()
    
    if res.IsError() {
        return fmt.Errorf("ES返回错误: %s", res.String())
    }
    
    log.Info("ILM策略已应用到ES", "policy", policy.Name)
    return nil
}

// validateConfig 验证配置
func (sm *StorageManager) validateConfig(config *StorageConfig) error {
    // 验证年龄配置
    if _, err := time.ParseDuration(config.HotPhaseMinAge); err != nil {
        return fmt.Errorf("hot_phase_min_age格式错误: %w", err)
    }
    
    // 验证副本数
    if config.HotReplicaCount < 0 || config.HotReplicaCount > 10 {
        return fmt.Errorf("hot_replica_count必须在0-10之间")
    }
    
    // 验证Cron表达式
    if _, err := cron.ParseStandard(config.BackupScheduleFull); err != nil {
        return fmt.Errorf("backup_schedule_full格式错误: %w", err)
    }
    
    // 验证保留天数
    if config.BackupRetentionDays < 1 || config.BackupRetentionDays > 365 {
        return fmt.Errorf("backup_retention_days必须在1-365之间")
    }
    
    return nil
}

// getConfig 获取当前配置(无锁)
func (sm *StorageManager) getConfig() *StorageConfig {
    if config := sm.ilmPolicy.Load(); config != nil {
        return config.(*StorageConfig)
    }
    return nil
}
```

### 11.4 YAML配置文件备用方案

**配置文件结构** (`/etc/storage-manager/config.yaml`):
```yaml
# 存储管理器配置文件
# 注意: 此配置文件仅在Redis不可用时使用，需要重启服务生效

# ILM策略配置 (✅ 支持热更新)
ilm:
  hot_phase:
    min_age: "0d"
    replica_count: 2
    shard_count: 5
  
  warm_phase:
    min_age: "7d"
    replica_count: 1
    shard_count: 1
    compression: "best_compression"
  
  cold_phase:
    min_age: "30d"
    searchable_snapshot: true
    repository: "s3-repo"
  
  delete_phase:
    min_age: "365d"

# 备份配置 (✅ 支持热更新)
backup:
  # 全量备份计划
  schedule_full: "0 2 * * 0"  # 每周日凌晨2点
  
  # 增量备份计划
  schedule_incremental: "0 2 * * *"  # 每天凌晨2点
  
  # 备份保留天数
  retention_days: 30
  
  # 备份加密
  encryption:
    enabled: true
    algorithm: "AES-256-GCM"
    key_id: "${BACKUP_ENCRYPTION_KEY_ID}"  # 支持环境变量
  
  # 备份压缩
  compression:
    enabled: true
    algorithm: "zstd"
    level: 9

# Elasticsearch配置 (⚠️ 不推荐热更新，需要重启)
elasticsearch:
  urls:
    - "https://es-node-1:9200"
    - "https://es-node-2:9200"
    - "https://es-node-3:9200"
  
  # 认证配置
  auth:
    username: "${ES_USERNAME}"
    password: "${ES_PASSWORD}"
  
  # TLS配置
  tls:
    enabled: true
    ca_cert: "/etc/certs/ca.crt"
    client_cert: "/etc/certs/client.crt"
    client_key: "/etc/certs/client.key"
  
  # 连接池配置
  pool:
    max_connections: 100
    max_idle_connections: 10
    connection_timeout: "30s"

# S3配置 (⚠️ 不推荐热更新，需要重启)
s3:
  endpoint: "https://s3.amazonaws.com"
  region: "us-east-1"
  bucket: "log-backups"
  
  # 认证配置
  credentials:
    access_key_id: "${AWS_ACCESS_KEY_ID}"
    secret_access_key: "${AWS_SECRET_ACCESS_KEY}"
  
  # 跨区域复制
  replication:
    enabled: true
    target_region: "us-west-2"
    target_bucket: "log-backups-replica"

# 监控配置
monitoring:
  metrics_port: 9090
  health_port: 8080
  log_level: "info"
```

**加载YAML配置**:
```go
// LoadConfigFromYAML 从YAML文件加载配置
func LoadConfigFromYAML(filepath string) (*StorageConfig, error) {
    data, err := ioutil.ReadFile(filepath)
    if err != nil {
        return nil, fmt.Errorf("读取配置文件失败: %w", err)
    }
    
    // 替换环境变量
    data = []byte(os.ExpandEnv(string(data)))
    
    var yamlConfig struct {
        ILM struct {
            HotPhase struct {
                MinAge       string `yaml:"min_age"`
                ReplicaCount int    `yaml:"replica_count"`
            } `yaml:"hot_phase"`
            WarmPhase struct {
                MinAge       string `yaml:"min_age"`
                ReplicaCount int    `yaml:"replica_count"`
            } `yaml:"warm_phase"`
            ColdPhase struct {
                MinAge string `yaml:"min_age"`
            } `yaml:"cold_phase"`
            DeletePhase struct {
                MinAge string `yaml:"min_age"`
            } `yaml:"delete_phase"`
        } `yaml:"ilm"`
        Backup struct {
            ScheduleFull        string `yaml:"schedule_full"`
            ScheduleIncremental string `yaml:"schedule_incremental"`
            RetentionDays       int    `yaml:"retention_days"`
        } `yaml:"backup"`
        Elasticsearch ESConfig `yaml:"elasticsearch"`
        S3            S3Config `yaml:"s3"`
    }
    
    if err := yaml.Unmarshal(data, &yamlConfig); err != nil {
        return nil, fmt.Errorf("解析配置文件失败: %w", err)
    }
    
    // 转换为StorageConfig
    config := &StorageConfig{
        HotPhaseMinAge:            yamlConfig.ILM.HotPhase.MinAge,
        WarmPhaseMinAge:           yamlConfig.ILM.WarmPhase.MinAge,
        ColdPhaseMinAge:           yamlConfig.ILM.ColdPhase.MinAge,
        DeletePhaseMinAge:         yamlConfig.ILM.DeletePhase.MinAge,
        HotReplicaCount:           yamlConfig.ILM.HotPhase.ReplicaCount,
        WarmReplicaCount:          yamlConfig.ILM.WarmPhase.ReplicaCount,
        BackupScheduleFull:        yamlConfig.Backup.ScheduleFull,
        BackupScheduleIncremental: yamlConfig.Backup.ScheduleIncremental,
        BackupRetentionDays:       yamlConfig.Backup.RetentionDays,
        Version:                   time.Now().UnixNano(),
        UpdatedAt:                 time.Now(),
    }
    
    return config, nil
}

// Initialize 初始化存储管理器
func (sm *StorageManager) Initialize() error {
    // 优先从Redis加载配置
    if err := sm.loadConfigFromRedis(); err == nil {
        log.Info("从Redis加载配置成功")
        go sm.subscribeILMChanges()
        return nil
    }
    
    log.Warn("从Redis加载配置失败，尝试从YAML文件加载")
    
    // 从YAML文件加载配置
    config, err := LoadConfigFromYAML("/etc/storage-manager/config.yaml")
    if err != nil {
        return fmt.Errorf("从YAML文件加载配置失败: %w", err)
    }
    
    sm.ilmPolicy.Store(config)
    
    // 尝试同步到Redis
    if err := sm.syncConfigToRedis(config); err != nil {
        log.Warn("同步配置到Redis失败", "error", err)
    }
    
    log.Info("从YAML文件加载配置成功")
    return nil
}
```

### 11.5 扩展接口示例

**自定义配置钩子**:
```go
// MetricsHook ILM指标收集钩子
type MetricsHook struct {
    metrics *prometheus.Registry
}

func (h *MetricsHook) Name() string {
    return "ilm-metrics-hook"
}

func (h *MetricsHook) OnConfigChange(oldConfig, newConfig *StorageConfig) error {
    // 记录配置变更指标
    ilmConfigChangeCounter.Inc()
    
    // 记录策略年龄变化
    if oldConfig.WarmPhaseMinAge != newConfig.WarmPhaseMinAge {
        log.Info("温存储年龄已变更",
            "old", oldConfig.WarmPhaseMinAge,
            "new", newConfig.WarmPhaseMinAge)
    }
    
    return nil
}

// 注册钩子
storageManager.RegisterConfigHook(&MetricsHook{metrics: promRegistry})
```

**自定义策略加载器**:
```go
// CustomPolicyLoader 自定义策略加载器
type CustomPolicyLoader struct {
    esClient *elasticsearch.Client
}

func (l *CustomPolicyLoader) LoadPolicy(name string) (*ILMPolicy, error) {
    // 从ES加载现有策略
    req := esapi.ILMGetLifecycleRequest{
        Policy: name,
    }
    
    res, err := req.Do(context.Background(), l.esClient)
    if err != nil {
        return nil, err
    }
    defer res.Body.Close()
    
    // 解析策略
    var policy ILMPolicy
    if err := json.NewDecoder(res.Body).Decode(&policy); err != nil {
        return nil, err
    }
    
    return &policy, nil
}

func (l *CustomPolicyLoader) ApplyPolicy(policy *ILMPolicy) error {
    // 应用策略到ES
    // ... 实现细节
    return nil
}

func (l *CustomPolicyLoader) ValidatePolicy(policy *ILMPolicy) error {
    // 验证策略合法性
    if policy.Phases.Hot.MinAge == "" {
        return fmt.Errorf("hot phase min_age不能为空")
    }
    return nil
}
```

### 11.6 验收标准

**功能验收**:
1. ✅ ILM策略变更后立即应用到ES
2. ✅ 备份计划变更后下次调度生效
3. ✅ 配置验证失败时保持原配置
4. ✅ 配置变更记录审计日志
5. ✅ Redis不可用时降级到YAML配置
6. ✅ 支持自定义配置钩子扩展
7. ✅ 支持自定义策略加载器扩展

**性能验收**:
1. ✅ 配置更新不影响正在进行的数据迁移
2. ✅ 配置读取延迟 < 1ms
3. ✅ ILM策略应用延迟 < 5秒

**可靠性验收**:
1. ✅ 配置验证失败时拒绝更新
2. ✅ ES策略应用失败时回滚配置
3. ✅ 配置钩子执行失败时回滚配置

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 数据丢失 | 低 | 高 | 多副本+备份 |
| 迁移失败 | 中 | 中 | 自动重试+告警 |
| 存储空间不足 | 中 | 高 | 监控告警+自动扩容 |
| 备份损坏 | 低 | 高 | 校验和验证+多地备份 |

### 12.2 回滚方案

**ILM策略回滚**:
1. 检测到迁移失败率>10%
2. 从PostgreSQL获取上一版本策略
3. 通过Redis Pub/Sub下发回滚通知
4. 自动应用旧策略到ES
5. 验证回滚成功

**数据恢复**:
1. 确认数据丢失范围
2. 选择最近的可用备份
3. 执行恢复流程
4. 验证数据完整性
5. 切换到恢复后的数据

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| ILM | Index Lifecycle Management，索引生命周期管理 |
| Parquet | Apache Parquet，列式存储格式 |
| Zstd | Zstandard，高压缩比算法 |
| Searchable Snapshot | ES可搜索快照，冷数据查询优化 |

### 13.2 参考文档

- [Elasticsearch ILM文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/index-lifecycle-management.html)
- [Apache Parquet文档](https://parquet.apache.org/docs/)
- [AWS S3 Glacier文档](https://docs.aws.amazon.com/glacier/)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
