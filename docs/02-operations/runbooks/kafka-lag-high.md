# Runbook: Kafka 消费延迟过高

## 告警信息

- **告警名称**: KafkaConsumerLagHigh
- **严重级别**: Warning / Critical
- **触发条件**: Consumer Lag > 10000 (Warning) / > 100000 (Critical)

## 影响范围

- 日志处理延迟增加
- 实时告警可能延迟触发
- Dashboard 数据不是最新

## 诊断步骤

### 1. 确认告警详情

```bash
# 查看当前 Consumer Lag
kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --describe --group nexuslog-flink-consumer
```

### 2. 检查 Consumer 状态

```bash
# 检查 Consumer 实例数量
kubectl get pods -n nexuslog-messaging -l app=flink-consumer

# 查看 Consumer 日志
kubectl logs -n nexuslog-messaging -l app=flink-consumer --tail=100
```

### 3. 检查 Kafka Broker 状态

```bash
# 检查 Broker 健康状态
kafka-broker-api-versions.sh --bootstrap-server $KAFKA_BROKERS

# 检查 Topic 分区状态
kafka-topics.sh --bootstrap-server $KAFKA_BROKERS \
  --describe --topic nexuslog-logs
```

### 4. 检查资源使用

```bash
# 检查 Consumer Pod 资源使用
kubectl top pods -n nexuslog-messaging -l app=flink-consumer

# 检查 Broker 资源使用
kubectl top pods -n nexuslog-messaging -l app=kafka
```

## 处理方案

### 方案 A: 扩容 Consumer

适用场景：Consumer 处理能力不足

```bash
# 增加 Consumer 副本数
kubectl scale deployment flink-consumer -n nexuslog-messaging --replicas=6
```

### 方案 B: 增加分区数

适用场景：分区数少于 Consumer 数量

```bash
# 增加 Topic 分区（不可逆操作，需 CAB 审批）
kafka-topics.sh --bootstrap-server $KAFKA_BROKERS \
  --alter --topic nexuslog-logs --partitions 12
```

### 方案 C: 临时跳过积压消息

适用场景：紧急恢复，可接受数据丢失

```bash
# 重置 Consumer Offset 到最新（需确认数据丢失影响）
kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --group nexuslog-flink-consumer \
  --topic nexuslog-logs \
  --reset-offsets --to-latest --execute
```

## 恢复确认

1. Consumer Lag 持续下降
2. 日志处理延迟恢复正常
3. 无新的错误日志

## 根因分析检查项

- [ ] 是否有流量突增
- [ ] Consumer 是否有异常重启
- [ ] Kafka Broker 是否有性能问题
- [ ] 网络是否有延迟或丢包

## 预防措施

- 配置 Consumer Lag 告警阈值
- 定期检查 Consumer 处理能力
- 容量规划时预留 50% 余量
