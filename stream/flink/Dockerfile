# NexusLog Flink 流计算容器镜像
# 基于 Apache Flink，预置 SQL/CEP 作业和 Kafka Connector
# change_level: cab
# 生效时间: 发布窗口（作业通过 Savepoint 发布）

FROM flink:1.19-java11

LABEL maintainer="NexusLog Team"
LABEL description="NexusLog Flink 流计算引擎"

# 安装 Kafka 和 Elasticsearch Connector
RUN wget -P /opt/flink/lib/ \
    https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.2.0-1.19/flink-sql-connector-kafka-3.2.0-1.19.jar && \
    wget -P /opt/flink/lib/ \
    https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-elasticsearch7/3.1.0-1.19/flink-sql-connector-elasticsearch7-3.1.0-1.19.jar && \
    wget -P /opt/flink/lib/ \
    https://repo1.maven.org/maven2/org/apache/flink/flink-sql-avro-confluent-registry/1.19.0/flink-sql-avro-confluent-registry-1.19.0.jar

# 复制作业文件和配置
COPY jobs/ /opt/flink/jobs/
COPY configs/ /opt/flink/conf-custom/
COPY udf/ /opt/flink/udf/

RUN chmod +x /opt/flink/jobs/submit-sql-jobs.sh

EXPOSE 6123 8081 9249
