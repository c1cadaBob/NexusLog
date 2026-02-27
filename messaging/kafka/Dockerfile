# NexusLog Kafka 容器镜像
# 基于 Confluent Platform，预置 Topic 初始化脚本
# change_level: cab
# 生效时间: 发布窗口

FROM confluentinc/cp-kafka:7.6.0

LABEL maintainer="NexusLog Team"
LABEL description="NexusLog Kafka Broker with topic initialization"

# 复制 Topic 配置和初始化脚本
COPY topics/ /etc/kafka/topics/
COPY broker-config/ /etc/kafka/broker-config/
COPY quotas/ /etc/kafka/quotas/
COPY scripts/init-topics.sh /docker-entrypoint-initdb.d/

# 设置脚本可执行权限
RUN chmod +x /docker-entrypoint-initdb.d/init-topics.sh

EXPOSE 9092 9093

# 使用默认 Confluent 入口点
