# 模块二：日志存储

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块二：日志存储
> **需求编号**: 

---

**模块概述**: 

负责日志数据的分层存储管理，支持热/温/冷三级存储策略，提供自动备份恢复和完整的数据生命周期管理能力。

**模块技术栈**:
- 热存储：Elasticsearch 8.x (快速检索，SSD)
- 温存储：Elasticsearch 8.x (HDD，压缩优化)
- 冷存储：MinIO/S3 + Parquet (对象存储，高压缩)
- 备份存储：S3 Glacier / Azure Archive (长期归档)
- 数据迁移：Apache Flink (流式数据迁移)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                日志存储模块整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (ILM策略/    │    │ (当前策略)   │    │ (策略变更)   │                           │ │
│  │  │  备份配置)   │    │              │    │              │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            存储层级管理（ILM Manager）                                 │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        热存储层 (0-7天)                                      │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ ES Node 1    │    │ ES Node 2    │    │ ES Node 3    │                 │     │ │
│  │  │  │ SSD 存储     │    │ SSD 存储     │    │ SSD 存储     │                 │     │ │
│  │  │  │ 3 副本       │    │ 3 副本       │    │ 3 副本       │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  │  查询延迟: < 500ms  |  压缩率: 无/低  |  成本: 高                          │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼ (7天后自动迁移)                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        温存储层 (8-30天)                                     │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐                                      │     │ │
│  │  │  │ ES Node 1    │    │ ES Node 2    │                                      │     │ │
│  │  │  │ HDD 存储     │    │ HDD 存储     │                                      │     │ │
│  │  │  │ 2 副本       │    │ 2 副本       │                                      │     │ │
│  │  │  └──────────────┘    └──────────────┘                                      │     │ │
│  │  │  查询延迟: < 2s  |  压缩率: 中 (Zstd)  |  成本: 中                          │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼ (30天后自动迁移)                             │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        冷存储层 (31天-1年)                                   │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐                                      │     │ │
│  │  │  │ MinIO/S3     │    │ Parquet 格式  │                                      │     │ │
│  │  │  │ 对象存储     │    │ 列式存储     │                                      │     │ │
│  │  │  │ 1 副本       │    │ 高压缩       │                                      │     │ │
│  │  │  └──────────────┘    └──────────────┘                                      │     │ │
│  │  │  查询延迟: < 30s  |  压缩率: 高 (70%+)  |  成本: 低                         │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼ (1年后归档)                                  │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        归档存储层 (1年+)                                     │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐                                      │     │ │
│  │  │  │ S3 Glacier   │    │ Azure Archive│                                      │     │ │
│  │  │  │ 深度归档     │    │ 深度归档     │                                      │     │ │
│  │  │  │ 1 副本       │    │ 1 副本       │                                      │     │ │
│  │  │  └──────────────┘    └──────────────┘                                      │     │ │
│  │  │  恢复时间: 小时级  |  压缩率: 极高  |  成本: 极低                           │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            备份与恢复管理                                          │ │
│  │                                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        备份策略引擎                                      │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │     │ │
│  │  │  │ 全量备份     │    │ 增量备份     │    │ 快照备份     │             │     │ │
│  │  │  │ (每周日)     │───▶│ (每日)       │───▶│ (实时)       │             │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘             │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────┘     │ │
│  │                                        │                                          │ │
│  │                                        ▼                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        备份存储                                          │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │     │ │
│  │  │  │ AWS S3       │    │ Azure Blob   │    │ Google GCS   │             │     │ │
│  │  │  │ 跨区域复制   │    │ 跨区域复制   │    │ 跨区域复制   │             │     │ │
│  │  │  │ AES-256 加密 │    │ AES-256 加密 │    │ AES-256 加密 │             │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘             │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────┘     │ │
│  │                                                                                    │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │                        恢复管理                                          │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐             │     │ │
│  │  │  │ 完整性校验   │───▶│ 数据恢复     │───▶│ 验证测试     │             │     │ │
│  │  │  │ (SHA-256)    │    │ (时间点恢复) │    │ (自动验证)   │             │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘             │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            生命周期管理引擎                                        │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 策略评估     │───▶│ 自动迁移     │───▶│ 安全删除     │                       │ │
│  │  │ (规则匹配)   │    │ (数据转移)   │    │ (加密擦除)   │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  │                                                                                    │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 审计日志     │    │ 执行报告     │    │ 告警通知     │                       │ │
│  │  │ (操作记录)   │    │ (统计分析)   │    │ (异常提醒)   │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与健康检查                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 存储容量监控  │    │ 迁移任务监控  │    │ 备份状态监控  │                       │ │
│  │  │ (使用率告警)  │    │ (进度跟踪)   │    │ (成功率统计)  │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储 ILM 策略和备份配置，Redis 分发当前生效策略
2. **存储层级管理**: 四级存储（热/温/冷/归档），自动根据时间和访问频率迁移数据
3. **备份与恢复**: 支持全量/增量/快照三种备份策略，跨区域存储，AES-256 加密
4. **生命周期引擎**: 自动执行策略评估、数据迁移、安全删除，记录审计日志
5. **监控层**: 实时监控存储容量、迁移进度、备份状态

**存储层级策略**:

| 层级 | 时间范围 | 存储介质 | 副本数 | 压缩率 | 查询延迟 | 成本 |
|------|----------|----------|--------|--------|----------|------|
| 热存储 | 0-7天 | SSD | 3 | 无/低 | < 500ms | 高 |
| 温存储 | 8-30天 | HDD | 2 | 中 | < 2s | 中 |
| 冷存储 | 31天-1年 | 对象存储 | 1 | 高 | < 30s | 低 |
| 归档 | 1年+ | Glacier | 1 | 极高 | 小时级 | 极低 |

**数据迁移策略**:

1. **自动迁移触发条件**:
   - 时间触发：每天凌晨 2:00 执行迁移任务
   - 访问频率：7 天未访问 → 温存储，30 天未访问 → 冷存储
   - 存储容量：热存储使用率 > 80% 时提前迁移

2. **迁移流程**:
   ```
   识别待迁移数据 → 数据压缩 → 写入目标存储 → 验证完整性 → 删除源数据 → 更新索引
   ```

3. **配置热更新**:
   - 迁移策略变更通过配置中心下发
   - 无需重启 ILM 服务即可生效
   - 支持灰度发布和回滚

**数据流向**:

```
日志写入 → 热存储(ES) → 温存储(ES) → 冷存储(S3) → 归档(Glacier)
            ↓              ↓              ↓              ↓
         快速查询       中速查询       慢速查询       归档查询
            ↓              ↓              ↓              ↓
         实时备份       增量备份       全量备份       长期保存
```

**需求列表**:
- 需求 2-6：分层日志存储 [MVP]
- 需求 2-7：日志备份与恢复 [MVP]
- 需求 2-8：日志数据生命周期管理 [Phase 2]

---

## 需求 2-6：分层日志存储 [MVP]

**用户故事**: 

作为系统管理员，我希望系统能够根据数据访问频率自动分层存储日志，以便优化存储成本和查询性能。

**验收标准**:

1. THE Storage_Manager SHALL 根据访问频率和数据年龄自动将日志分类为热、温、冷三个存储层级
2. WHEN 日志条目超过 7 天未被访问时，THE Storage_Manager SHALL 自动从 Hot_Storage 迁移到 Warm_Storage
3. WHEN 日志条目超过 30 天未被访问时，THE Storage_Manager SHALL 自动从 Warm_Storage 迁移到 Cold_Storage
4. THE Storage_Manager SHALL 在至少 3 个不同可用区的节点上维护数据冗余
5. WHEN 从 Hot_Storage 检索日志时，THE System SHALL 在 500 毫秒内返回跨度不超过 1 小时的查询结果
6. WHEN 从 Cold_Storage 检索日志时，THE System SHALL 在 30 秒内开始返回数据
7. THE Storage_Manager SHALL 支持每个集群存储至少 100TB 的日志数据，并具备水平扩展能力
8. THE Storage_Manager SHALL 使用 LZ4/Zstd 无损压缩，压缩率达到 70% 以上
9. WHEN 热存储使用率超过 80% 时，THE Storage_Manager SHALL 自动触发提前迁移
10. THE Storage_Manager SHALL 通过配置中心热更新迁移策略，无需重启服务

**实现方向**:

**实现方式**:

```go
// 存储管理器
type StorageManager struct {
    hotStorage  *ElasticsearchStorage   // 热存储
    warmStorage *ElasticsearchStorage   // 温存储
    coldStorage *S3Storage              // 冷存储
    ilmPolicy   atomic.Value            // ILM 策略（支持热更新）
    migrator    *DataMigrator           // 数据迁移器
    monitor     *StorageMonitor         // 存储监控器
}

// ILM 策略配置
type ILMPolicy struct {
    HotPhase  PhaseConfig  // 热存储阶段配置
    WarmPhase PhaseConfig  // 温存储阶段配置
    ColdPhase PhaseConfig  // 冷存储阶段配置
    DeletePhase PhaseConfig // 删除阶段配置
}

// 阶段配置
type PhaseConfig struct {
    MinAge           string   // 最小年龄，如 "7d", "30d"
    Actions          []Action // 执行的操作
    Priority         int      // 优先级
    ReplicaCount     int      // 副本数
    CompressionCodec string   // 压缩算法：lz4/zstd
}

// 操作类型
type Action struct {
    Type   string                 // rollover/shrink/forcemerge/migrate/delete
    Config map[string]interface{} // 操作配置
}

// Elasticsearch 存储
type ElasticsearchStorage struct {
    client      *elasticsearch.Client
    indexPrefix string
    shardCount  int
    replicaCount int
}

// 创建索引（带 ILM 策略）
func (es *ElasticsearchStorage) CreateIndex(name string, policy *ILMPolicy) error {
    // 1. 创建索引模板
    template := map[string]interface{}{
        "index_patterns": []string{fmt.Sprintf("%s-*", es.indexPrefix)},
        "settings": map[string]interface{}{
            "number_of_shards":   es.shardCount,
            "number_of_replicas": es.replicaCount,
            "index.lifecycle.name": policy.Name,
            "index.lifecycle.rollover_alias": es.indexPrefix,
            "codec": policy.HotPhase.CompressionCodec, // 压缩算法
        },
        "mappings": map[string]interface{}{
            "properties": map[string]interface{}{
                "@timestamp": map[string]string{"type": "date"},
                "level":      map[string]string{"type": "keyword"},
                "message":    map[string]string{"type": "text"},
                "source":     map[string]string{"type": "keyword"},
            },
        },
    }
    
    // 2. 应用模板
    req := esapi.IndicesPutTemplateRequest{
        Name: fmt.Sprintf("%s-template", es.indexPrefix),
        Body: esutil.NewJSONReader(template),
    }
    
    res, err := req.Do(context.Background(), es.client)
    if err != nil {
        return fmt.Errorf("创建索引模板失败: %w", err)
    }
    defer res.Body.Close()
    
    if res.IsError() {
        return fmt.Errorf("创建索引模板失败: %s", res.String())
    }
    
    return nil
}

// 数据迁移器
type DataMigrator struct {
    source      Storage
    destination Storage
    batchSize   int
    workers     int
}

// 执行迁移
func (dm *DataMigrator) Migrate(ctx context.Context, query string) error {
    log.Info("开始数据迁移", "query", query)
    
    // 1. 查询待迁移数据
    docs, err := dm.source.Query(ctx, query, dm.batchSize)
    if err != nil {
        return fmt.Errorf("查询数据失败: %w", err)
    }
    
    // 2. 使用 worker 池并行迁移
    var wg sync.WaitGroup
    docChan := make(chan []Document, dm.workers)
    errChan := make(chan error, dm.workers)
    
    // 启动 workers
    for i := 0; i < dm.workers; i++ {
        wg.Add(1)
        go func() {
            defer wg.Done()
            for batch := range docChan {
                if err := dm.migrateBatch(ctx, batch); err != nil {
                    errChan <- err
                    return
                }
            }
        }()
    }
    
    // 3. 分批发送数据
    go func() {
        for i := 0; i < len(docs); i += dm.batchSize {
            end := i + dm.batchSize
            if end > len(docs) {
                end = len(docs)
            }
            docChan <- docs[i:end]
        }
        close(docChan)
    }()
    
    // 4. 等待完成
    wg.Wait()
    close(errChan)
    
    // 5. 检查错误
    for err := range errChan {
        if err != nil {
            return fmt.Errorf("迁移失败: %w", err)
        }
    }
    
    log.Info("数据迁移完成", "count", len(docs))
    return nil
}

// 迁移单个批次
func (dm *DataMigrator) migrateBatch(ctx context.Context, docs []Document) error {
    // 1. 压缩数据（如果目标是冷存储）
    if coldStorage, ok := dm.destination.(*S3Storage); ok {
        // 转换为 Parquet 格式
        parquetData, err := dm.convertToParquet(docs)
        if err != nil {
            return fmt.Errorf("转换 Parquet 失败: %w", err)
        }
        
        // 写入 S3
        return coldStorage.WriteBatch(ctx, parquetData)
    }
    
    // 2. 写入目标存储
    if err := dm.destination.WriteBatch(ctx, docs); err != nil {
        return fmt.Errorf("写入目标存储失败: %w", err)
    }
    
    // 3. 验证数据完整性
    if err := dm.verifyIntegrity(ctx, docs); err != nil {
        return fmt.Errorf("数据完整性验证失败: %w", err)
    }
    
    // 4. 删除源数据
    if err := dm.source.DeleteBatch(ctx, docs); err != nil {
        return fmt.Errorf("删除源数据失败: %w", err)
    }
    
    return nil
}

// 转换为 Parquet 格式
func (dm *DataMigrator) convertToParquet(docs []Document) ([]byte, error) {
    var buf bytes.Buffer
    
    // 创建 Parquet writer
    writer, err := parquet.NewWriter(&buf, new(Document))
    if err != nil {
        return nil, err
    }
    
    // 写入数据
    for _, doc := range docs {
        if err := writer.Write(doc); err != nil {
            return nil, err
        }
    }
    
    // 关闭 writer
    if err := writer.Close(); err != nil {
        return nil, err
    }
    
    return buf.Bytes(), nil
}

// S3 冷存储
type S3Storage struct {
    client     *s3.Client
    bucket     string
    prefix     string
    compressor *ZstdCompressor
}

// 写入批次数据
func (s3s *S3Storage) WriteBatch(ctx context.Context, data []byte) error {
    // 1. Zstd 压缩
    compressed, err := s3s.compressor.Compress(data)
    if err != nil {
        return fmt.Errorf("压缩失败: %w", err)
    }
    
    // 2. 生成对象键
    key := fmt.Sprintf("%s/%s.parquet.zst", s3s.prefix, time.Now().Format("2006/01/02/15"))
    
    // 3. 上传到 S3
    _, err = s3s.client.PutObject(ctx, &s3.PutObjectInput{
        Bucket: aws.String(s3s.bucket),
        Key:    aws.String(key),
        Body:   bytes.NewReader(compressed),
        Metadata: map[string]string{
            "original-size":   strconv.Itoa(len(data)),
            "compressed-size": strconv.Itoa(len(compressed)),
            "compression":     "zstd",
            "format":          "parquet",
        },
    })
    
    if err != nil {
        return fmt.Errorf("上传 S3 失败: %w", err)
    }
    
    log.Info("数据已写入冷存储",
        "key", key,
        "original_size", len(data),
        "compressed_size", len(compressed),
        "compression_ratio", float64(len(compressed))/float64(len(data)))
    
    return nil
}

// 从冷存储读取
func (s3s *S3Storage) Read(ctx context.Context, key string) ([]Document, error) {
    // 1. 从 S3 下载
    result, err := s3s.client.GetObject(ctx, &s3.GetObjectInput{
        Bucket: aws.String(s3s.bucket),
        Key:    aws.String(key),
    })
    if err != nil {
        return nil, fmt.Errorf("下载 S3 对象失败: %w", err)
    }
    defer result.Body.Close()
    
    // 2. 读取数据
    compressed, err := io.ReadAll(result.Body)
    if err != nil {
        return nil, fmt.Errorf("读取数据失败: %w", err)
    }
    
    // 3. 解压缩
    decompressed, err := s3s.compressor.Decompress(compressed)
    if err != nil {
        return nil, fmt.Errorf("解压缩失败: %w", err)
    }
    
    // 4. 解析 Parquet
    docs, err := s3s.parseParquet(decompressed)
    if err != nil {
        return nil, fmt.Errorf("解析 Parquet 失败: %w", err)
    }
    
    return docs, nil
}

// 存储监控器
type StorageMonitor struct {
    storages map[string]Storage
    metrics  *prometheus.Registry
}

// 监控存储使用率
func (sm *StorageMonitor) MonitorUsage(ctx context.Context) {
    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            for name, storage := range sm.storages {
                usage, err := storage.GetUsage(ctx)
                if err != nil {
                    log.Error("获取存储使用率失败", "storage", name, "error", err)
                    continue
                }
                
                // 记录指标
                sm.recordUsageMetric(name, usage)
                
                // 检查是否需要触发提前迁移
                if usage.UsagePercent > 80 {
                    log.Warn("存储使用率过高，触发提前迁移",
                        "storage", name,
                        "usage_percent", usage.UsagePercent)
                    
                    // 触发迁移
                    sm.triggerEarlyMigration(ctx, name)
                }
            }
        }
    }
}

// Zstd 压缩器
type ZstdCompressor struct {
    level int // 压缩级别 1-22
}

func (zc *ZstdCompressor) Compress(data []byte) ([]byte, error) {
    encoder, err := zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.EncoderLevelFromZstd(zc.level)))
    if err != nil {
        return nil, err
    }
    defer encoder.Close()
    
    return encoder.EncodeAll(data, make([]byte, 0, len(data))), nil
}

func (zc *ZstdCompressor) Decompress(data []byte) ([]byte, error) {
    decoder, err := zstd.NewReader(nil)
    if err != nil {
        return nil, err
    }
    defer decoder.Close()
    
    return decoder.DecodeAll(data, nil)
}
```

**关键实现点**:

1. 使用 Elasticsearch ILM (Index Lifecycle Management) 自动管理索引生命周期
2. 实现智能压缩算法选择：热存储使用 LZ4（快速），冷存储使用 Zstd（高压缩比）
3. 冷存储使用 Parquet 列式格式，压缩率达到 70% 以上
4. 支持跨可用区数据复制，热存储 3 副本，温存储 2 副本，冷存储 1 副本
5. 实时监控存储使用率，超过 80% 自动触发提前迁移

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| hot_phase_min_age | string | "0d" | 热存储最小年龄 |
| warm_phase_min_age | string | "7d" | 温存储最小年龄 |
| cold_phase_min_age | string | "30d" | 冷存储最小年龄 |
| hot_replica_count | int | 3 | 热存储副本数 |
| warm_replica_count | int | 2 | 温存储副本数 |
| cold_replica_count | int | 1 | 冷存储副本数 |
| hot_compression_codec | string | "lz4" | 热存储压缩算法 |
| warm_compression_codec | string | "zstd" | 温存储压缩算法 |
| cold_compression_level | int | 9 | 冷存储压缩级别 |
| migration_batch_size | int | 10000 | 迁移批次大小 |
| migration_workers | int | 5 | 迁移并发数 |
| usage_threshold | float | 80.0 | 使用率告警阈值（%） |
| early_migration_enabled | bool | true | 是否启用提前迁移 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次 ILM 策略评估）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和存储统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN ILM 策略变更时，THE System SHALL 验证策略的有效性（时间范围、副本数等）
6. THE System SHALL 支持策略灰度发布，先应用到部分索引验证后再全量发布

---

## 需求 2-7：日志备份与恢复 [MVP]

**用户故事**: 

作为系统管理员，我希望系统能够自动备份日志数据并支持快速恢复，以便在数据丢失或灾难发生时快速恢复业务。

**验收标准**:

1. THE Backup_Manager SHALL 支持自动全量备份（每周）和增量备份（每日）策略
2. THE Backup_Manager SHALL 支持将备份数据存储到云存储（S3、Azure Blob、GCS）
3. THE UI SHALL 提供一键恢复功能，支持选择恢复时间点
4. WHEN 恢复前，THE Backup_Manager SHALL 自动验证备份数据的完整性（SHA-256 校验）
5. THE Backup_Manager SHALL 支持跨区域备份，确保 RPO ≤ 1 小时，RTO ≤ 4 小时
6. THE Backup_Manager SHALL 支持增量备份，只备份自上次备份以来的变更数据
7. WHEN 备份失败时，THE System SHALL 自动重试（最多 3 次），并发送告警通知
8. THE Backup_Manager SHALL 支持备份加密（AES-256），保护数据安全
9. THE Backup_Manager SHALL 通过配置中心管理备份策略，支持热更新
10. THE System SHALL 提供备份恢复演练功能，定期验证备份可用性

**实现方向**:

**实现方式**:

```go
// 备份管理器
type BackupManager struct {
    storage      Storage                // 源存储
    destinations []BackupDestination    // 备份目标列表
    scheduler    *BackupScheduler       // 备份调度器
    encryptor    *AESEncryptor          // 加密器
    config       atomic.Value           // 配置（支持热更新）
    metrics      *BackupMetrics         // 备份指标
}

// 备份配置
type BackupConfig struct {
    FullBackup       ScheduleConfig      // 全量备份配置
    IncrementalBackup ScheduleConfig     // 增量备份配置
    SnapshotBackup   ScheduleConfig      // 快照备份配置
    Destinations     []DestinationConfig // 备份目标配置
    Encryption       EncryptionConfig    // 加密配置
    Retention        RetentionConfig     // 保留策略
}

// 调度配置
type ScheduleConfig struct {
    Enabled  bool   // 是否启用
    Cron     string // Cron 表达式，如 "0 2 * * 0" (每周日凌晨2点)
    Timeout  int    // 超时时间（秒）
    Retry    int    // 重试次数
}

// 备份目标配置
type DestinationConfig struct {
    Type     string // s3/azure/gcs
    Bucket   string // 存储桶名称
    Region   string // 区域
    Prefix   string // 前缀路径
    Enabled  bool   // 是否启用
}

// 加密配置
type EncryptionConfig struct {
    Enabled   bool   // 是否启用加密
    Algorithm string // 加密算法：aes-256-gcm
    KeyID     string // 密钥 ID
}

// 保留策略
type RetentionConfig struct {
    FullBackupDays        int // 全量备份保留天数
    IncrementalBackupDays int // 增量备份保留天数
    SnapshotBackupDays    int // 快照备份保留天数
}

// 执行全量备份
func (bm *BackupManager) PerformFullBackup(ctx context.Context) error {
    log.Info("开始全量备份")
    startTime := time.Now()
    
    // 1. 创建备份元数据
    metadata := &BackupMetadata{
        ID:          generateBackupID(),
        Type:        "full",
        StartTime:   startTime,
        Status:      "running",
        SourceType:  bm.storage.Type(),
    }
    
    // 2. 导出所有数据
    data, err := bm.storage.ExportAll(ctx)
    if err != nil {
        return fmt.Errorf("导出数据失败: %w", err)
    }
    
    // 3. 计算校验和
    checksum := sha256.Sum256(data)
    metadata.Checksum = hex.EncodeToString(checksum[:])
    metadata.OriginalSize = len(data)
    
    // 4. 加密数据（如果启用）
    config := bm.config.Load().(*BackupConfig)
    if config.Encryption.Enabled {
        encrypted, err := bm.encryptor.Encrypt(data)
        if err != nil {
            return fmt.Errorf("加密失败: %w", err)
        }
        data = encrypted
        metadata.Encrypted = true
    }
    
    metadata.BackupSize = len(data)
    
    // 5. 上传到所有备份目标
    var wg sync.WaitGroup
    errChan := make(chan error, len(bm.destinations))
    
    for _, dest := range bm.destinations {
        wg.Add(1)
        go func(d BackupDestination) {
            defer wg.Done()
            
            // 上传备份
            if err := d.Upload(ctx, metadata.ID, data, metadata); err != nil {
                errChan <- fmt.Errorf("上传到 %s 失败: %w", d.Name(), err)
                return
            }
            
            log.Info("备份已上传", "destination", d.Name(), "backup_id", metadata.ID)
        }(dest)
    }
    
    wg.Wait()
    close(errChan)
    
    // 6. 检查错误
    var errors []error
    for err := range errChan {
        errors = append(errors, err)
    }
    
    if len(errors) > 0 {
        return fmt.Errorf("部分备份失败: %v", errors)
    }
    
    // 7. 更新元数据
    metadata.EndTime = time.Now()
    metadata.Duration = metadata.EndTime.Sub(metadata.StartTime)
    metadata.Status = "completed"
    
    // 8. 保存元数据
    if err := bm.saveMetadata(ctx, metadata); err != nil {
        return fmt.Errorf("保存元数据失败: %w", err)
    }
    
    // 9. 记录指标
    bm.metrics.RecordBackup(metadata)
    
    log.Info("全量备份完成",
        "backup_id", metadata.ID,
        "duration", metadata.Duration,
        "original_size", metadata.OriginalSize,
        "backup_size", metadata.BackupSize)
    
    return nil
}

// 执行增量备份
func (bm *BackupManager) PerformIncrementalBackup(ctx context.Context) error {
    log.Info("开始增量备份")
    
    // 1. 获取上次备份时间
    lastBackup, err := bm.getLastBackup(ctx)
    if err != nil {
        return fmt.Errorf("获取上次备份失败: %w", err)
    }
    
    // 2. 导出变更数据
    data, err := bm.storage.ExportChanges(ctx, lastBackup.EndTime)
    if err != nil {
        return fmt.Errorf("导出变更数据失败: %w", err)
    }
    
    // 3. 创建备份元数据
    metadata := &BackupMetadata{
        ID:          generateBackupID(),
        Type:        "incremental",
        StartTime:   time.Now(),
        Status:      "running",
        BaseBackupID: lastBackup.ID,
        SourceType:  bm.storage.Type(),
    }
    
    // 4. 计算校验和
    checksum := sha256.Sum256(data)
    metadata.Checksum = hex.EncodeToString(checksum[:])
    metadata.OriginalSize = len(data)
    
    // 5. 加密数据
    config := bm.config.Load().(*BackupConfig)
    if config.Encryption.Enabled {
        encrypted, err := bm.encryptor.Encrypt(data)
        if err != nil {
            return fmt.Errorf("加密失败: %w", err)
        }
        data = encrypted
        metadata.Encrypted = true
    }
    
    metadata.BackupSize = len(data)
    
    // 6. 上传到所有备份目标
    if err := bm.uploadToDestinations(ctx, metadata.ID, data, metadata); err != nil {
        return err
    }
    
    // 7. 更新元数据
    metadata.EndTime = time.Now()
    metadata.Duration = metadata.EndTime.Sub(metadata.StartTime)
    metadata.Status = "completed"
    
    // 8. 保存元数据
    if err := bm.saveMetadata(ctx, metadata); err != nil {
        return fmt.Errorf("保存元数据失败: %w", err)
    }
    
    log.Info("增量备份完成",
        "backup_id", metadata.ID,
        "base_backup_id", metadata.BaseBackupID,
        "duration", metadata.Duration)
    
    return nil
}

// 恢复备份
func (bm *BackupManager) Restore(ctx context.Context, backupID string, targetTime time.Time) error {
    log.Info("开始恢复备份", "backup_id", backupID, "target_time", targetTime)
    
    // 1. 获取备份元数据
    metadata, err := bm.getMetadata(ctx, backupID)
    if err != nil {
        return fmt.Errorf("获取备份元数据失败: %w", err)
    }
    
    // 2. 构建恢复链（如果是增量备份）
    backupChain, err := bm.buildRestoreChain(ctx, metadata)
    if err != nil {
        return fmt.Errorf("构建恢复链失败: %w", err)
    }
    
    log.Info("恢复链构建完成", "chain_length", len(backupChain))
    
    // 3. 按顺序恢复备份
    for i, backup := range backupChain {
        log.Info("恢复备份", "step", i+1, "total", len(backupChain), "backup_id", backup.ID)
        
        // 3.1 从备份目标下载
        data, err := bm.downloadFromDestination(ctx, backup.ID)
        if err != nil {
            return fmt.Errorf("下载备份失败: %w", err)
        }
        
        // 3.2 验证完整性
        if err := bm.verifyIntegrity(data, backup); err != nil {
            return fmt.Errorf("完整性验证失败: %w", err)
        }
        
        // 3.3 解密数据
        if backup.Encrypted {
            decrypted, err := bm.encryptor.Decrypt(data)
            if err != nil {
                return fmt.Errorf("解密失败: %w", err)
            }
            data = decrypted
        }
        
        // 3.4 导入数据
        if err := bm.storage.Import(ctx, data); err != nil {
            return fmt.Errorf("导入数据失败: %w", err)
        }
    }
    
    log.Info("备份恢复完成", "backup_id", backupID)
    return nil
}

// 验证完整性
func (bm *BackupManager) verifyIntegrity(data []byte, metadata *BackupMetadata) error {
    // 计算校验和
    checksum := sha256.Sum256(data)
    actualChecksum := hex.EncodeToString(checksum[:])
    
    // 比较校验和
    if actualChecksum != metadata.Checksum {
        return fmt.Errorf("校验和不匹配: expected=%s, actual=%s",
            metadata.Checksum, actualChecksum)
    }
    
    log.Info("完整性验证通过", "backup_id", metadata.ID)
    return nil
}

// 构建恢复链
func (bm *BackupManager) buildRestoreChain(ctx context.Context, metadata *BackupMetadata) ([]*BackupMetadata, error) {
    chain := []*BackupMetadata{metadata}
    
    // 如果是增量备份，需要找到基础备份
    current := metadata
    for current.Type == "incremental" && current.BaseBackupID != "" {
        base, err := bm.getMetadata(ctx, current.BaseBackupID)
        if err != nil {
            return nil, fmt.Errorf("获取基础备份失败: %w", err)
        }
        
        // 插入到链的开头
        chain = append([]*BackupMetadata{base}, chain...)
        current = base
    }
    
    return chain, nil
}

// 备份调度器
type BackupScheduler struct {
    manager *BackupManager
    cron    *cron.Cron
}

// 启动调度器
func (bs *BackupScheduler) Start(ctx context.Context) error {
    config := bs.manager.config.Load().(*BackupConfig)
    
    // 1. 添加全量备份任务
    if config.FullBackup.Enabled {
        _, err := bs.cron.AddFunc(config.FullBackup.Cron, func() {
            if err := bs.manager.PerformFullBackup(ctx); err != nil {
                log.Error("全量备份失败", "error", err)
                bs.sendAlert("全量备份失败", err)
            }
        })
        if err != nil {
            return fmt.Errorf("添加全量备份任务失败: %w", err)
        }
    }
    
    // 2. 添加增量备份任务
    if config.IncrementalBackup.Enabled {
        _, err := bs.cron.AddFunc(config.IncrementalBackup.Cron, func() {
            if err := bs.manager.PerformIncrementalBackup(ctx); err != nil {
                log.Error("增量备份失败", "error", err)
                
                // 重试逻辑
                for i := 0; i < config.IncrementalBackup.Retry; i++ {
                    log.Info("重试增量备份", "attempt", i+1)
                    time.Sleep(time.Duration(i+1) * time.Minute)
                    
                    if err := bs.manager.PerformIncrementalBackup(ctx); err == nil {
                        log.Info("增量备份重试成功")
                        return
                    }
                }
                
                // 重试失败，发送告警
                bs.sendAlert("增量备份失败（已重试3次）", err)
            }
        })
        if err != nil {
            return fmt.Errorf("添加增量备份任务失败: %w", err)
        }
    }
    
    // 3. 启动 cron
    bs.cron.Start()
    
    log.Info("备份调度器已启动")
    return nil
}

// AES 加密器
type AESEncryptor struct {
    key []byte // 256-bit 密钥
}

func (ae *AESEncryptor) Encrypt(data []byte) ([]byte, error) {
    // 创建 AES cipher
    block, err := aes.NewCipher(ae.key)
    if err != nil {
        return nil, err
    }
    
    // 使用 GCM 模式
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    // 生成随机 nonce
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, err
    }
    
    // 加密数据
    ciphertext := gcm.Seal(nonce, nonce, data, nil)
    
    return ciphertext, nil
}

func (ae *AESEncryptor) Decrypt(data []byte) ([]byte, error) {
    // 创建 AES cipher
    block, err := aes.NewCipher(ae.key)
    if err != nil {
        return nil, err
    }
    
    // 使用 GCM 模式
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    // 提取 nonce
    nonceSize := gcm.NonceSize()
    if len(data) < nonceSize {
        return nil, fmt.Errorf("密文太短")
    }
    
    nonce, ciphertext := data[:nonceSize], data[nonceSize:]
    
    // 解密数据
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return nil, err
    }
    
    return plaintext, nil
}

// 备份恢复演练
func (bm *BackupManager) PerformDrillTest(ctx context.Context) error {
    log.Info("开始备份恢复演练")
    
    // 1. 选择最近的全量备份
    latestBackup, err := bm.getLatestFullBackup(ctx)
    if err != nil {
        return fmt.Errorf("获取最新备份失败: %w", err)
    }
    
    // 2. 创建临时恢复环境
    tempStorage, err := bm.createTempStorage(ctx)
    if err != nil {
        return fmt.Errorf("创建临时存储失败: %w", err)
    }
    defer tempStorage.Cleanup()
    
    // 3. 恢复到临时环境
    tempManager := &BackupManager{
        storage:      tempStorage,
        destinations: bm.destinations,
        encryptor:    bm.encryptor,
        config:       bm.config,
    }
    
    if err := tempManager.Restore(ctx, latestBackup.ID, latestBackup.EndTime); err != nil {
        return fmt.Errorf("恢复失败: %w", err)
    }
    
    // 4. 验证数据完整性
    if err := bm.verifyRestoredData(ctx, tempStorage); err != nil {
        return fmt.Errorf("数据验证失败: %w", err)
    }
    
    log.Info("备份恢复演练成功", "backup_id", latestBackup.ID)
    return nil
}
```

**关键实现点**:

1. 支持全量备份、增量备份、快照备份三种策略，使用 Cron 表达式灵活调度
2. 使用 SHA-256 校验和验证备份完整性，确保数据不被篡改
3. 使用 AES-256-GCM 加密备份数据，保护数据安全
4. 支持跨区域多目标备份，并行上传到多个云存储
5. 实现备份恢复链构建，自动处理增量备份的依赖关系

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| full_backup_enabled | bool | true | 是否启用全量备份 |
| full_backup_cron | string | "0 2 * * 0" | 全量备份 Cron 表达式 |
| incremental_backup_enabled | bool | true | 是否启用增量备份 |
| incremental_backup_cron | string | "0 2 * * *" | 增量备份 Cron 表达式 |
| snapshot_backup_enabled | bool | false | 是否启用快照备份 |
| backup_retry_count | int | 3 | 备份失败重试次数 |
| backup_timeout_seconds | int | 3600 | 备份超时时间（秒） |
| encryption_enabled | bool | true | 是否启用加密 |
| encryption_algorithm | string | "aes-256-gcm" | 加密算法 |
| full_backup_retention_days | int | 90 | 全量备份保留天数 |
| incremental_backup_retention_days | int | 30 | 增量备份保留天数 |
| destinations | array | [] | 备份目标列表 |
| drill_test_enabled | bool | true | 是否启用恢复演练 |
| drill_test_cron | string | "0 3 * * 6" | 恢复演练 Cron 表达式 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次备份任务）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和备份统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 备份策略变更时，THE System SHALL 验证 Cron 表达式的有效性
6. THE System SHALL 支持备份任务的暂停和恢复，不影响已有备份数据

---

## 需求 2-8：日志数据生命周期管理 [Phase 2]

**用户故事**: 

作为数据管理员，我希望能够定义和执行日志数据的完整生命周期策略，以便自动化管理数据从创建到删除的全过程。

**验收标准**:

1. THE UI SHALL 提供生命周期策略配置界面，支持定义数据从创建到删除的完整流程
2. THE Lifecycle_Manager SHALL 支持基于时间（1天-10年）、访问频率、数据类型的生命周期规则
3. THE Lifecycle_Manager SHALL 自动执行生命周期策略，包括数据迁移、压缩、归档和安全删除
4. THE UI SHALL 提供生命周期策略的预览功能，在执行前评估影响范围（影响数据量、存储空间变化）
5. WHEN 日志保留期限到期时，THE Lifecycle_Manager SHALL 使用加密擦除（DoD 5220.22-M 标准）安全删除日志
6. THE Lifecycle_Manager SHALL 支持策略优先级，高优先级策略优先执行
7. THE Lifecycle_Manager SHALL 记录所有生命周期操作的审计日志，保留至少 3 年
8. THE Lifecycle_Manager SHALL 通过配置中心管理策略，支持热更新和版本回滚
9. WHEN 策略冲突时，THE System SHALL 发送告警并暂停执行，等待人工确认
10. THE Lifecycle_Manager SHALL 提供策略执行报告，展示数据迁移量、删除量、节省的存储空间

**实现方向**:

**实现方式**:

```go
// 生命周期管理器
type LifecycleManager struct {
    policies   atomic.Value         // 策略列表（支持热更新）
    executor   *PolicyExecutor      // 策略执行器
    evaluator  *PolicyEvaluator     // 策略评估器
    auditor    *AuditLogger         // 审计日志记录器
    reporter   *ReportGenerator     // 报告生成器
    config     atomic.Value         // 配置（支持热更新）
}

// 生命周期策略
type LifecyclePolicy struct {
    ID          string              // 策略 ID
    Name        string              // 策略名称
    Description string              // 策略描述
    Priority    int                 // 优先级（1-100，数字越大优先级越高）
    Enabled     bool                // 是否启用
    Rules       []LifecycleRule     // 规则列表
    CreatedAt   time.Time           // 创建时间
    UpdatedAt   time.Time           // 更新时间
    Version     int                 // 版本号
}

// 生命周期规则
type LifecycleRule struct {
    ID          string              // 规则 ID
    Condition   RuleCondition       // 触发条件
    Actions     []RuleAction        // 执行动作
    Enabled     bool                // 是否启用
}

// 规则条件
type RuleCondition struct {
    Type        string              // 条件类型：time/access_frequency/data_type/size
    Operator    string              // 操作符：gt/lt/eq/gte/lte
    Value       interface{}         // 条件值
    LogicalOp   string              // 逻辑操作符：AND/OR（用于组合多个条件）
}

// 规则动作
type RuleAction struct {
    Type        string              // 动作类型：migrate/compress/archive/delete
    Target      string              // 目标存储层级
    Parameters  map[string]interface{} // 动作参数
}

// 策略评估器
type PolicyEvaluator struct {
    storage Storage
}

// 评估策略影响
func (pe *PolicyEvaluator) EvaluateImpact(ctx context.Context, policy *LifecyclePolicy) (*ImpactReport, error) {
    log.Info("开始评估策略影响", "policy_id", policy.ID)
    
    report := &ImpactReport{
        PolicyID:   policy.ID,
        PolicyName: policy.Name,
        EvaluatedAt: time.Now(),
    }
    
    // 遍历所有规则
    for _, rule := range policy.Rules {
        if !rule.Enabled {
            continue
        }
        
        // 1. 查询匹配条件的数据
        matchedData, err := pe.findMatchingData(ctx, rule.Condition)
        if err != nil {
            return nil, fmt.Errorf("查询匹配数据失败: %w", err)
        }
        
        // 2. 计算影响
        ruleImpact := &RuleImpact{
            RuleID:       rule.ID,
            AffectedCount: len(matchedData),
            AffectedSize:  pe.calculateTotalSize(matchedData),
        }
        
        // 3. 根据动作类型计算存储空间变化
        for _, action := range rule.Actions {
            switch action.Type {
            case "compress":
                // 压缩可节省约 70% 空间
                ruleImpact.SpaceSaved += int64(float64(ruleImpact.AffectedSize) * 0.7)
            case "migrate":
                // 迁移到冷存储可节省约 80% 成本
                ruleImpact.CostSaved += pe.calculateCostSaving(ruleImpact.AffectedSize, action.Target)
            case "delete":
                // 删除可释放全部空间
                ruleImpact.SpaceSaved += ruleImpact.AffectedSize
            }
        }
        
        report.RuleImpacts = append(report.RuleImpacts, ruleImpact)
    }
    
    // 4. 汇总总影响
    for _, ri := range report.RuleImpacts {
        report.TotalAffectedCount += ri.AffectedCount
        report.TotalAffectedSize += ri.AffectedSize
        report.TotalSpaceSaved += ri.SpaceSaved
        report.TotalCostSaved += ri.CostSaved
    }
    
    log.Info("策略影响评估完成",
        "policy_id", policy.ID,
        "affected_count", report.TotalAffectedCount,
        "space_saved", report.TotalSpaceSaved)
    
    return report, nil
}

// 查找匹配条件的数据
func (pe *PolicyEvaluator) findMatchingData(ctx context.Context, condition RuleCondition) ([]DataItem, error) {
    var query string
    
    switch condition.Type {
    case "time":
        // 基于时间的条件，如：数据年龄 > 30 天
        age := condition.Value.(string)
        query = fmt.Sprintf("@timestamp:[* TO now-%s]", age)
        
    case "access_frequency":
        // 基于访问频率的条件，如：30 天内访问次数 < 5
        days := condition.Value.(int)
        query = fmt.Sprintf("access_count:[* TO %d] AND last_access:[* TO now-%dd]", days, days)
        
    case "data_type":
        // 基于数据类型的条件，如：日志级别 = DEBUG
        dataType := condition.Value.(string)
        query = fmt.Sprintf("level:%s", dataType)
        
    case "size":
        // 基于大小的条件，如：文档大小 > 1MB
        size := condition.Value.(int64)
        query = fmt.Sprintf("_size:[%d TO *]", size)
    }
    
    // 执行查询
    return pe.storage.Query(ctx, query, 10000)
}

// 策略执行器
type PolicyExecutor struct {
    manager   *LifecycleManager
    storage   Storage
    scheduler *cron.Cron
}

// 执行策略
func (pex *PolicyExecutor) ExecutePolicy(ctx context.Context, policy *LifecyclePolicy) error {
    log.Info("开始执行生命周期策略", "policy_id", policy.ID, "policy_name", policy.Name)
    
    // 1. 检查策略冲突
    if err := pex.checkConflicts(ctx, policy); err != nil {
        log.Error("检测到策略冲突", "error", err)
        pex.sendAlert("策略冲突", policy, err)
        return fmt.Errorf("策略冲突: %w", err)
    }
    
    // 2. 按优先级排序规则
    sortedRules := pex.sortRulesByPriority(policy.Rules)
    
    // 3. 执行每个规则
    executionReport := &ExecutionReport{
        PolicyID:   policy.ID,
        StartTime:  time.Now(),
        Status:     "running",
    }
    
    for _, rule := range sortedRules {
        if !rule.Enabled {
            continue
        }
        
        log.Info("执行规则", "rule_id", rule.ID)
        
        // 3.1 查找匹配数据
        matchedData, err := pex.findMatchingData(ctx, rule.Condition)
        if err != nil {
            log.Error("查找匹配数据失败", "rule_id", rule.ID, "error", err)
            continue
        }
        
        log.Info("找到匹配数据", "rule_id", rule.ID, "count", len(matchedData))
        
        // 3.2 执行动作
        for _, action := range rule.Actions {
            if err := pex.executeAction(ctx, action, matchedData); err != nil {
                log.Error("执行动作失败", "action_type", action.Type, "error", err)
                executionReport.Errors = append(executionReport.Errors, err.Error())
                continue
            }
            
            // 记录执行结果
            executionReport.ActionsExecuted++
            executionReport.DataProcessed += len(matchedData)
        }
        
        // 3.3 记录审计日志
        pex.manager.auditor.LogRuleExecution(ctx, policy.ID, rule.ID, len(matchedData))
    }
    
    // 4. 更新执行报告
    executionReport.EndTime = time.Now()
    executionReport.Duration = executionReport.EndTime.Sub(executionReport.StartTime)
    executionReport.Status = "completed"
    
    // 5. 保存执行报告
    if err := pex.manager.reporter.SaveReport(ctx, executionReport); err != nil {
        log.Error("保存执行报告失败", "error", err)
    }
    
    log.Info("生命周期策略执行完成",
        "policy_id", policy.ID,
        "duration", executionReport.Duration,
        "actions_executed", executionReport.ActionsExecuted,
        "data_processed", executionReport.DataProcessed)
    
    return nil
}

// 执行动作
func (pex *PolicyExecutor) executeAction(ctx context.Context, action RuleAction, data []DataItem) error {
    switch action.Type {
    case "migrate":
        // 迁移数据到目标存储层级
        target := action.Target
        log.Info("迁移数据", "target", target, "count", len(data))
        return pex.migrateData(ctx, data, target)
        
    case "compress":
        // 压缩数据
        codec := action.Parameters["codec"].(string)
        log.Info("压缩数据", "codec", codec, "count", len(data))
        return pex.compressData(ctx, data, codec)
        
    case "archive":
        // 归档数据
        destination := action.Parameters["destination"].(string)
        log.Info("归档数据", "destination", destination, "count", len(data))
        return pex.archiveData(ctx, data, destination)
        
    case "delete":
        // 安全删除数据
        log.Info("安全删除数据", "count", len(data))
        return pex.secureDelete(ctx, data)
        
    default:
        return fmt.Errorf("未知的动作类型: %s", action.Type)
    }
}

// 安全删除（DoD 5220.22-M 标准）
func (pex *PolicyExecutor) secureDelete(ctx context.Context, data []DataItem) error {
    log.Info("开始安全删除", "count", len(data))
    
    for _, item := range data {
        // DoD 5220.22-M 标准：3 次覆写
        // 第 1 次：写入随机数据
        // 第 2 次：写入随机数据的补码
        // 第 3 次：再次写入随机数据
        
        for pass := 1; pass <= 3; pass++ {
            log.Debug("覆写数据", "item_id", item.ID, "pass", pass)
            
            // 生成随机数据
            randomData := make([]byte, item.Size)
            if _, err := rand.Read(randomData); err != nil {
                return fmt.Errorf("生成随机数据失败: %w", err)
            }
            
            // 第 2 次覆写使用补码
            if pass == 2 {
                for i := range randomData {
                    randomData[i] = ^randomData[i]
                }
            }
            
            // 覆写数据
            if err := pex.storage.Overwrite(ctx, item.ID, randomData); err != nil {
                return fmt.Errorf("覆写数据失败: %w", err)
            }
        }
        
        // 最后删除元数据
        if err := pex.storage.Delete(ctx, item.ID); err != nil {
            return fmt.Errorf("删除元数据失败: %w", err)
        }
        
        // 记录审计日志
        pex.manager.auditor.LogSecureDelete(ctx, item.ID)
    }
    
    log.Info("安全删除完成", "count", len(data))
    return nil
}

// 检查策略冲突
func (pex *PolicyExecutor) checkConflicts(ctx context.Context, policy *LifecyclePolicy) error {
    policies := pex.manager.policies.Load().([]*LifecyclePolicy)
    
    for _, existingPolicy := range policies {
        if existingPolicy.ID == policy.ID {
            continue
        }
        
        if !existingPolicy.Enabled {
            continue
        }
        
        // 检查规则是否冲突
        for _, rule1 := range policy.Rules {
            for _, rule2 := range existingPolicy.Rules {
                if pex.rulesConflict(rule1, rule2) {
                    return fmt.Errorf("策略 %s 的规则 %s 与策略 %s 的规则 %s 冲突",
                        policy.ID, rule1.ID, existingPolicy.ID, rule2.ID)
                }
            }
        }
    }
    
    return nil
}

// 判断规则是否冲突
func (pex *PolicyExecutor) rulesConflict(rule1, rule2 LifecycleRule) bool {
    // 如果两个规则的条件相同，但动作不同，则认为冲突
    if pex.conditionsEqual(rule1.Condition, rule2.Condition) {
        if !pex.actionsEqual(rule1.Actions, rule2.Actions) {
            return true
        }
    }
    
    return false
}

// 审计日志记录器
type AuditLogger struct {
    storage Storage
}

// 记录规则执行
func (al *AuditLogger) LogRuleExecution(ctx context.Context, policyID, ruleID string, affectedCount int) error {
    auditLog := &AuditLog{
        ID:            generateAuditID(),
        Timestamp:     time.Now(),
        EventType:     "rule_execution",
        PolicyID:      policyID,
        RuleID:        ruleID,
        AffectedCount: affectedCount,
        User:          "system",
        Details: map[string]interface{}{
            "policy_id":      policyID,
            "rule_id":        ruleID,
            "affected_count": affectedCount,
        },
    }
    
    return al.storage.WriteAuditLog(ctx, auditLog)
}

// 记录安全删除
func (al *AuditLogger) LogSecureDelete(ctx context.Context, itemID string) error {
    auditLog := &AuditLog{
        ID:        generateAuditID(),
        Timestamp: time.Now(),
        EventType: "secure_delete",
        ItemID:    itemID,
        User:      "system",
        Details: map[string]interface{}{
            "item_id": itemID,
            "method":  "DoD 5220.22-M",
            "passes":  3,
        },
    }
    
    return al.storage.WriteAuditLog(ctx, auditLog)
}

// 报告生成器
type ReportGenerator struct {
    storage Storage
}

// 生成执行报告
func (rg *ReportGenerator) GenerateReport(ctx context.Context, policyID string, startTime, endTime time.Time) (*PolicyReport, error) {
    log.Info("生成策略执行报告", "policy_id", policyID)
    
    // 1. 查询执行记录
    executions, err := rg.storage.QueryExecutions(ctx, policyID, startTime, endTime)
    if err != nil {
        return nil, fmt.Errorf("查询执行记录失败: %w", err)
    }
    
    // 2. 统计数据
    report := &PolicyReport{
        PolicyID:  policyID,
        StartTime: startTime,
        EndTime:   endTime,
        GeneratedAt: time.Now(),
    }
    
    for _, exec := range executions {
        report.TotalExecutions++
        report.TotalDataProcessed += exec.DataProcessed
        report.TotalActionsExecuted += exec.ActionsExecuted
        
        if exec.Status == "completed" {
            report.SuccessfulExecutions++
        } else {
            report.FailedExecutions++
        }
    }
    
    // 3. 计算存储空间节省
    report.SpaceSaved = rg.calculateSpaceSaved(ctx, policyID, startTime, endTime)
    
    // 4. 计算成本节省
    report.CostSaved = rg.calculateCostSaved(ctx, policyID, startTime, endTime)
    
    log.Info("策略执行报告生成完成",
        "policy_id", policyID,
        "total_executions", report.TotalExecutions,
        "space_saved", report.SpaceSaved)
    
    return report, nil
}

// 策略版本管理
type PolicyVersionManager struct {
    storage Storage
}

// 保存策略版本
func (pvm *PolicyVersionManager) SaveVersion(ctx context.Context, policy *LifecyclePolicy) error {
    // 增加版本号
    policy.Version++
    policy.UpdatedAt = time.Now()
    
    // 保存到版本历史
    version := &PolicyVersion{
        PolicyID:  policy.ID,
        Version:   policy.Version,
        Content:   policy,
        CreatedAt: time.Now(),
    }
    
    return pvm.storage.SavePolicyVersion(ctx, version)
}

// 回滚到指定版本
func (pvm *PolicyVersionManager) Rollback(ctx context.Context, policyID string, version int) (*LifecyclePolicy, error) {
    log.Info("回滚策略版本", "policy_id", policyID, "version", version)
    
    // 获取指定版本
    policyVersion, err := pvm.storage.GetPolicyVersion(ctx, policyID, version)
    if err != nil {
        return nil, fmt.Errorf("获取策略版本失败: %w", err)
    }
    
    // 恢复策略
    policy := policyVersion.Content
    policy.Version = policyVersion.Version
    
    log.Info("策略版本回滚成功", "policy_id", policyID, "version", version)
    return policy, nil
}
```

**关键实现点**:

1. 支持基于时间、访问频率、数据类型、大小等多维度的生命周期规则
2. 实现策略冲突检测，防止多个策略对同一数据执行矛盾操作
3. 使用 DoD 5220.22-M 标准安全删除数据，3 次覆写确保数据无法恢复
4. 完整的审计日志记录，保留至少 3 年，满足合规要求
5. 支持策略版本管理和回滚，配置变更可追溯

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| policies | array | [] | 生命周期策略列表 |
| evaluation_interval | string | "1h" | 策略评估间隔 |
| execution_interval | string | "24h" | 策略执行间隔 |
| conflict_check_enabled | bool | true | 是否启用冲突检测 |
| audit_retention_days | int | 1095 | 审计日志保留天数（3年） |
| secure_delete_enabled | bool | true | 是否启用安全删除 |
| secure_delete_passes | int | 3 | 安全删除覆写次数 |
| report_generation_enabled | bool | true | 是否启用报告生成 |
| report_interval | string | "7d" | 报告生成间隔 |
| version_retention_count | int | 10 | 策略版本保留数量 |
| alert_on_conflict | bool | true | 策略冲突时是否告警 |
| dry_run_enabled | bool | false | 是否启用试运行模式 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次策略评估）
- 回滚策略: 支持版本回滚，可恢复到任意历史版本

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值和策略执行统计
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 策略变更时，THE System SHALL 验证规则的有效性（条件、动作、优先级等）
6. THE System SHALL 支持策略的试运行模式，评估影响后再正式执行
7. THE System SHALL 支持策略版本回滚，可恢复到任意历史版本

---

# 模块二 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-2-32 | 获取ILM策略列表 | Storage | GET | /api/v1/storage/ilm/policies | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-33 | 创建ILM策略 | Storage | POST | /api/v1/storage/ilm/policies | storage.write | Body: policy_config | {code:0,data:{id:"ilm-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-34 | 更新ILM策略 | Storage | PUT | /api/v1/storage/ilm/policies/{id} | storage.write | Body: policy_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-35 | 删除ILM策略 | Storage | DELETE | /api/v1/storage/ilm/policies/{id} | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-36 | 启用ILM策略 | Storage | POST | /api/v1/storage/ilm/policies/{id}/enable | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-37 | 禁用ILM策略 | Storage | POST | /api/v1/storage/ilm/policies/{id}/disable | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-38 | 获取存储层级信息 | Storage | GET | /api/v1/storage/tiers | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-39 | 获取存储层级使用率 | Storage | GET | /api/v1/storage/tiers/{tier}/usage | storage.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-40 | 获取迁移任务状态 | Storage | GET | /api/v1/storage/migration/status | storage.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-41 | 手动触发数据迁移 | Storage | POST | /api/v1/storage/migration/trigger | storage.write | Body: {tier,query} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-42 | 获取备份策略列表 | Storage | GET | /api/v1/storage/backup/policies | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-43 | 创建备份策略 | Storage | POST | /api/v1/storage/backup/policies | storage.write | Body: policy_config | {code:0,data:{id:"backup-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-44 | 更新备份策略 | Storage | PUT | /api/v1/storage/backup/policies/{id} | storage.write | Body: policy_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-45 | 删除备份策略 | Storage | DELETE | /api/v1/storage/backup/policies/{id} | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-46 | 手动执行备份 | Storage | POST | /api/v1/storage/backup/execute | storage.write | Body: {type} | {code:0,data:{backup_id:"bak-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-47 | 获取备份列表 | Storage | GET | /api/v1/storage/backup/list | storage.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-2-48 | 获取备份详情 | Storage | GET | /api/v1/storage/backup/{id} | storage.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-2-49 | 验证备份完整性 | Storage | POST | /api/v1/storage/backup/{id}/verify | storage.read | 无 | {code:0,data:{valid:true}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-50 | 恢复备份 | Storage | POST | /api/v1/storage/restore | storage.write | Body: {backup_id,target_time} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-51 | 获取恢复任务状态 | Storage | GET | /api/v1/storage/restore/status | storage.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-52 | 执行恢复演练 | Storage | POST | /api/v1/storage/restore/drill | storage.write | 无 | {code:0,data:{drill_id:"drill-1"}} | 200/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-53 | 获取生命周期策略列表 | Storage | GET | /api/v1/storage/lifecycle/policies | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-54 | 创建生命周期策略 | Storage | POST | /api/v1/storage/lifecycle/policies | storage.write | Body: policy_config | {code:0,data:{id:"lc-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-55 | 更新生命周期策略 | Storage | PUT | /api/v1/storage/lifecycle/policies/{id} | storage.write | Body: policy_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-56 | 删除生命周期策略 | Storage | DELETE | /api/v1/storage/lifecycle/policies/{id} | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-57 | 评估策略影响 | Storage | POST | /api/v1/storage/lifecycle/policies/{id}/evaluate | storage.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-58 | 执行生命周期策略 | Storage | POST | /api/v1/storage/lifecycle/policies/{id}/execute | storage.write | Body: {dry_run} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-2-59 | 获取策略版本历史 | Storage | GET | /api/v1/storage/lifecycle/policies/{id}/versions | storage.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-2-60 | 回滚策略版本 | Storage | POST | /api/v1/storage/lifecycle/policies/{id}/rollback | storage.write | Body: {version} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-2-61 | 获取审计日志 | Storage | GET | /api/v1/storage/lifecycle/audit | storage.read | Query: start_time, end_time | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-62 | 获取执行报告 | Storage | GET | /api/v1/storage/lifecycle/report | storage.read | Query: policy_id, time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-63 | 触发配置热更新 | Storage | POST | /api/v1/storage/config/reload | storage.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-2-64 | 健康检查 | Storage | GET | /api/v1/storage/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-2-65 | 获取存储指标 | Storage | GET | /api/v1/storage/metrics | storage.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

---
