# NexusLog Schema Registry 容器镜像
# 基于 Confluent Schema Registry，预置兼容性配置
# change_level: cab
# 生效时间: 分钟级

FROM confluentinc/cp-schema-registry:7.6.0

LABEL maintainer="NexusLog Team"
LABEL description="NexusLog Schema Registry with pre-configured compatibility rules"

# 复制配置文件
COPY config/ /etc/schema-registry/config/
COPY compatibility-rules/ /etc/schema-registry/compatibility-rules/

EXPOSE 8081

# 使用默认 Confluent 入口点
