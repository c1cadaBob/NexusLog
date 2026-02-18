# Runbook: Elasticsearch 写入拒绝

## 告警信息

- **告警名称**: ElasticsearchWriteRejected
- **严重级别**: Critical
- **触发条件**: Thread Pool Write Rejected > 0

## 影响范围

- 日志写入失败
- 数据可能丢失（取决于重试机制）
- 搜索结果不完整

## 诊断步骤

### 1. 确认告警详情

```bash
# 查看集群健康状态
curl -X GET "$ES_HOST/_cluster/health?pretty"

# 查看线程池状态
curl -X GET "$ES_HOST/_cat/thread_pool/write?v&h=node_name,name,active,rejected,completed"
```

### 2. 检查节点状态

```bash
# 查看节点资源使用
curl -X GET "$ES_HOST/_cat/nodes?v&h=name,heap.percent,ram.percent,cpu,load_1m"

# 查看热点节点
curl -X GET "$ES_HOST/_cat/hot_threads"
```

### 3. 检查索引状态

```bash
# 查看索引写入速率
curl -X GET "$ES_HOST/_cat/indices?v&h=index,docs.count,store.size,indexing.index_total,indexing.index_time"

# 查看分片分布
curl -X GET "$ES_HOST/_cat/shards?v&h=index,shard,prirep,state,docs,store,node"
```

### 4. 检查磁盘空间

```bash
# 查看磁盘使用
curl -X GET "$ES_HOST/_cat/allocation?v"
```

## 处理方案

### 方案 A: 增加写入线程池大小

适用场景：CPU 和内存有余量

```bash
# 临时调整线程池大小（重启后失效）
curl -X PUT "$ES_HOST/_cluster/settings" -H 'Content-Type: application/json' -d'
{
  "transient": {
    "thread_pool.write.queue_size": 2000
  }
}'
```

### 方案 B: 降低写入速率

适用场景：上游可控制写入速率

```bash
# 在 Flink 作业中配置限流
# 或调整 Kafka Consumer 的 fetch.max.bytes
```

### 方案 C: 扩容 ES 集群

适用场景：长期容量不足

```bash
# 添加新节点（需 CAB 审批）
# 参考部署文档进行节点扩容
```

### 方案 D: 清理旧数据

适用场景：磁盘空间不足

```bash
# 手动触发 ILM 策略
curl -X POST "$ES_HOST/_ilm/move/nexuslog-logs-2024.01.01" -H 'Content-Type: application/json' -d'
{
  "current_step": {
    "phase": "hot",
    "action": "rollover",
    "name": "check-rollover-ready"
  },
  "next_step": {
    "phase": "delete",
    "action": "delete",
    "name": "delete"
  }
}'
```

## 恢复确认

1. Thread Pool Write Rejected 归零
2. 写入延迟恢复正常
3. 无数据丢失（检查 DLQ）

## 根因分析检查项

- [ ] 是否有写入流量突增
- [ ] 是否有慢查询影响写入
- [ ] 磁盘 I/O 是否饱和
- [ ] JVM GC 是否频繁

## 预防措施

- 配置写入拒绝告警
- 定期检查集群容量
- 优化索引 Mapping 减少写入开销
- 配置合理的 ILM 策略
