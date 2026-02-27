#!/bin/bash
# NexusLog Kafka Topic 初始化脚本
# 从 nexuslog-topics.yaml 读取配置并创建 Topic
# 用法: ./init-topics.sh [bootstrap-server]

set -euo pipefail

BOOTSTRAP_SERVER="${1:-kafka:9092}"
MAX_RETRIES=30
RETRY_INTERVAL=5

echo "[NexusLog] 等待 Kafka Broker 就绪..."
for i in $(seq 1 $MAX_RETRIES); do
    if kafka-broker-api-versions --bootstrap-server "$BOOTSTRAP_SERVER" > /dev/null 2>&1; then
        echo "[NexusLog] Kafka Broker 已就绪"
        break
    fi
    if [ "$i" -eq "$MAX_RETRIES" ]; then
        echo "[NexusLog] 错误: Kafka Broker 未就绪，超时退出"
        exit 1
    fi
    echo "[NexusLog] 等待中... ($i/$MAX_RETRIES)"
    sleep $RETRY_INTERVAL
done

echo "[NexusLog] 开始创建 Topic..."

# 核心 Topic 定义（与 nexuslog-topics.yaml 保持一致）
declare -A TOPICS
TOPICS["nexuslog.logs.raw"]="--partitions 12 --replication-factor 1 --config retention.ms=604800000 --config compression.type=lz4 --config max.message.bytes=10485760 --config min.insync.replicas=1 --config segment.bytes=1073741824"
TOPICS["nexuslog.logs.parsed"]="--partitions 12 --replication-factor 1 --config retention.ms=259200000 --config compression.type=lz4 --config min.insync.replicas=1"
TOPICS["nexuslog.alerts.events"]="--partitions 6 --replication-factor 1 --config retention.ms=604800000 --config compression.type=snappy --config min.insync.replicas=1"
TOPICS["nexuslog.alerts.notifications"]="--partitions 3 --replication-factor 1 --config retention.ms=259200000 --config min.insync.replicas=1"
TOPICS["nexuslog.audit.logs"]="--partitions 6 --replication-factor 1 --config retention.ms=2592000000 --config compression.type=snappy --config min.insync.replicas=1"
TOPICS["nexuslog.dlq.logs"]="--partitions 3 --replication-factor 1 --config retention.ms=2592000000 --config min.insync.replicas=1"
TOPICS["nexuslog.metrics.aggregated"]="--partitions 6 --replication-factor 1 --config retention.ms=86400000 --config compression.type=lz4 --config min.insync.replicas=1"

# 注意: 本地开发环境 replication-factor=1，生产环境应设为 3

for TOPIC in "${!TOPICS[@]}"; do
    if kafka-topics --bootstrap-server "$BOOTSTRAP_SERVER" --describe --topic "$TOPIC" > /dev/null 2>&1; then
        echo "[NexusLog] Topic '$TOPIC' 已存在，跳过"
    else
        echo "[NexusLog] 创建 Topic: $TOPIC"
        eval kafka-topics --bootstrap-server "$BOOTSTRAP_SERVER" --create --topic "$TOPIC" ${TOPICS[$TOPIC]}
        echo "[NexusLog] Topic '$TOPIC' 创建成功"
    fi
done

echo "[NexusLog] 所有 Topic 创建完成"
kafka-topics --bootstrap-server "$BOOTSTRAP_SERVER" --list
