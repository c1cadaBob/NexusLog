# 模块19：通用日志采集代理 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module19.md](../requirements/requirements-module19.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档
- [需求文档](../requirements/requirements-module19.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

### 1.3 模块概述

通用日志采集代理（Universal Log Agent）是一个轻量级、高性能的日志采集组件，能够在被监测端通过简单部署实现各类日志的增量采集，并在日志生成后3秒内完成采集和传输。支持50+种日志来源，包括文件、容器、数据库、网络设备、云服务、IoT设备等。

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            通用日志采集代理整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            输入插件层（Input Plugins）                                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │  File    │  │  Docker  │  │  Syslog  │  │  MQTT    │  │  HTTP    │              │ │
│  │  │  Watcher │  │  Logs    │  │  Server  │  │  Client  │  │  Server  │              │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │ │
│  │       │             │             │             │             │                      │ │
│  │  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐              │ │
│  │  │ Database │  │  Cloud   │  │  IoT     │  │ Network  │  │  System  │              │ │
│  │  │  Logs    │  │  Logs    │  │  Devices │  │  Devices │  │  Logs    │              │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │ │
│  │       └─────────────┴─────────────┴─────────────┴─────────────┘                    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            检查点管理器（Checkpoint Manager）                          │ │
│  │  • 记录每个输入源的采集位置（文件偏移量/时间戳）                                      │ │
│  │  • 持久化到 BoltDB，确保重启后继续采集                                                │ │
│  │  • 支持文件轮转检测（inode 跟踪）                                                     │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            处理管道（Processing Pipeline）                             │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 格式解析     │───▶│ 字段提取     │───▶│ 元数据添加    │                           │ │
│  │  │ (多格式支持) │    │ (正则/Grok)  │    │ (主机/标签)   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            本地缓冲层（Local Buffer）                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐                                                │ │
│  │  │ 内存队列     │───▶│ 持久化缓存    │                                                │ │
│  │  │ (Ring Buffer)│    │ (BoltDB)     │                                                │ │
│  │  │ 快速写入     │    │ 断线保护     │                                                │ │
│  │  └──────────────┘    └──────────────┘                                                │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            输出层（Output Layer）                                      │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Kafka        │    │ HTTP(S)      │    │ gRPC         │                           │ │
│  │  │ Producer     │    │ Client       │    │ Client       │                           │ │
│  │  │ • 批量发送   │    │ • 压缩传输   │    │ • TLS 加密   │                           │ │
│  │  │ • 压缩       │    │ • 重试机制   │    │ • 流式传输   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与管理层                                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Prometheus   │    │ 健康检查     │    │ 配置热加载    │                           │ │
│  │  │ Metrics      │    │ /health      │    │ (SIGHUP)     │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 输入插件层 | 从各种数据源采集日志 | 文件监控、容器日志、数据库日志、网络设备日志、云服务日志、IoT设备日志、系统日志 |
| 检查点管理器 | 记录采集位置，支持断点续传 | 位置记录、持久化存储、文件轮转检测 |
| 处理管道 | 日志解析和字段提取 | 格式解析、字段提取、元数据添加 |
| 本地缓冲层 | 缓冲日志，保证不丢失 | 内存队列、持久化缓存、断线保护 |
| 输出层 | 将日志传输到中央服务器 | Kafka输出、HTTP输出、gRPC输出、批量发送、压缩传输 |
| 监控与管理层 | 监控Agent状态，支持配置热加载 | Prometheus指标、健康检查、配置热加载 |

### 2.3 关键路径

**数据流向**:
```
日志源 → 输入插件 → 检查点记录 → 处理管道 → 本地缓冲 → 输出传输 → 中央服务器
         ↑                                                      ↓
         └──────────────── 配置热加载 ──────────────────────────┘
```

**关键路径说明**:
1. 输入插件实时监控日志源，检测到新日志后立即读取
2. 检查点管理器记录采集位置，确保重启后继续采集
3. 处理管道解析日志格式，提取字段，添加元数据
4. 本地缓冲层先写入内存队列，再持久化到BoltDB
5. 输出层批量发送日志到中央服务器，支持压缩和加密
6. 监控层实时上报指标，支持配置热加载

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 轻量级、跨平台、高性能、低资源占用 |
| fsnotify | latest | 跨平台文件监控库，支持Linux/macOS/Windows |
| Docker API | latest | 容器日志采集，自动发现容器 |
| Kubernetes API | latest | Pod日志采集，支持K8s环境 |
| BoltDB | latest | 嵌入式KV存储，用于检查点和本地缓冲 |
| Kafka Client | latest | 高吞吐量消息队列，支持批量发送 |
| gRPC | latest | 高性能RPC框架，支持流式传输 |
| Prometheus Client | latest | 指标采集和上报 |
| MQTT Client | latest | IoT设备日志采集 |
| Syslog Parser | latest | 网络设备日志解析 |

### 3.2 文件监控技术对比

| 技术方案 | 优点 | 缺点 | 选择 |
|---------|------|------|------|
| inotify (Linux) | 内核级监控，实时性好，资源占用低 | 仅支持Linux | ✅ 采用 |
| FSEvents (macOS) | 系统原生支持，性能好 | 仅支持macOS | ✅ 采用 |
| ReadDirectoryChangesW (Windows) | 系统原生支持 | 仅支持Windows | ✅ 采用 |
| 轮询方式 | 跨平台，实现简单 | 延迟高，资源占用大 | ❌ 不采用 |

**选择**: 使用fsnotify库，封装了各平台的原生文件监控API，实现跨平台支持

### 3.3 本地缓冲技术对比

| 技术方案 | 优点 | 缺点 | 选择 |
|---------|------|------|------|
| BoltDB | 嵌入式，无需外部依赖，事务支持 | 单机存储 | ✅ 采用 |
| SQLite | 成熟稳定，SQL查询 | 性能略低 | ❌ 不采用 |
| LevelDB | 高性能 | 无事务支持 | ❌ 不采用 |
| 文件队列 | 简单 | 可靠性差 | ❌ 不采用 |

**选择**: BoltDB，嵌入式KV存储，支持事务，适合检查点和本地缓冲

### 3.4 传输协议对比

| 协议 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| Kafka | 高吞吐量，持久化，分布式 | 需要部署Kafka集群 | ✅ 大规模生产环境 |
| HTTP(S) | 简单，广泛支持，防火墙友好 | 性能略低 | ✅ 中小规模环境 |
| gRPC | 高性能，流式传输，类型安全 | 需要proto定义 | ✅ 微服务环境 |
| TCP Socket | 性能最高 | 需要自定义协议 | ❌ 不采用 |

**选择**: 支持多种协议，根据环境选择

---

## 4. 关键流程设计

### 4.1 文件日志采集流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      文件日志采集流程                            │
└─────────────────────────────────────────────────────────────────┘

1. 启动阶段
   ├─ 加载配置文件（监控路径、多行模式等）
   ├─ 创建fsnotify监控器
   ├─ 从BoltDB恢复检查点（文件路径+inode+偏移量）
   └─ 添加监控路径（支持通配符）

2. 文件监控
   ├─ 监听文件系统事件（Write/Create/Remove/Rename）
   ├─ Write事件 → 读取新增内容
   ├─ Create事件 → 检测文件轮转，切换到新文件
   ├─ Remove事件 → 读取剩余内容，移除监控
   └─ Rename事件 → 检测文件轮转

3. 文件读取
   ├─ 打开文件
   ├─ Seek到上次偏移量
   ├─ 逐行读取（支持多行合并）
   ├─ 更新偏移量
   └─ 保存检查点到BoltDB

4. 多行日志处理
   ├─ 检测多行起始模式（正则匹配）
   ├─ 缓冲多行内容
   ├─ 达到最大行数或超时 → 刷新缓冲
   └─ 合并为单条日志

5. 文件轮转检测
   ├─ 比较inode是否变化
   ├─ inode变化 → 读取旧文件剩余内容
   ├─ 更新为新文件的inode
   └─ 从新文件开始位置读取
```

### 4.2 容器日志采集流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      容器日志采集流程                            │
└─────────────────────────────────────────────────────────────────┘

1. Docker容器监控
   ├─ 连接Docker Socket
   ├─ 获取现有容器列表
   ├─ 根据标签过滤容器
   ├─ 为每个容器启动日志读取器
   └─ 监听容器事件（start/die）

2. Kubernetes Pod监控
   ├─ 连接Kubernetes API
   ├─ 创建Pod Informer
   ├─ 监听Pod事件（Add/Delete）
   ├─ 过滤节点和命名空间
   └─ 为每个容器启动日志读取器

3. 日志读取
   ├─ 获取容器日志流（Follow模式）
   ├─ 解析Docker日志格式（8字节头部）
   ├─ 提取时间戳和消息
   ├─ 添加容器元数据（ID/名称/镜像/标签）
   └─ 发送到处理管道

4. 容器停止处理
   ├─ 检测到容器停止事件
   ├─ 读取剩余日志
   ├─ 关闭日志流
   └─ 释放资源
```

### 4.3 日志传输流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      日志传输流程                                │
└─────────────────────────────────────────────────────────────────┘

1. 本地缓冲
   ├─ 日志写入内存队列（Ring Buffer）
   ├─ 批量写入BoltDB（持久化）
   ├─ 内存队列满 → 阻塞写入
   └─ BoltDB满 → 丢弃最旧日志（可配置）

2. 批量发送
   ├─ 从内存队列读取日志
   ├─ 累积到批次大小或超时
   ├─ 序列化为JSON
   ├─ 压缩（gzip/lz4/zstd）
   └─ 发送到输出目标

3. Kafka输出
   ├─ 创建Kafka消息
   ├─ 设置Key（日志源）和Headers
   ├─ 异步发送
   ├─ 等待确认（acks=all）
   └─ 失败重试（指数退避）

4. HTTP输出
   ├─ 创建HTTP请求
   ├─ 设置认证头（Bearer Token/API Key）
   ├─ 设置压缩头（Content-Encoding）
   ├─ 发送请求
   ├─ 检查响应状态码
   └─ 失败重试（指数退避）

5. 网络故障处理
   ├─ 检测网络连接失败
   ├─ 日志持久化到BoltDB
   ├─ 定期重试连接
   ├─ 连接恢复 → 重传缓冲日志
   └─ 保持日志顺序
```

### 4.4 配置热加载流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      配置热加载流程                              │
└─────────────────────────────────────────────────────────────────┘

1. 信号触发
   ├─ 接收SIGHUP信号
   └─ 触发配置重新加载

2. 配置加载
   ├─ 读取配置文件（YAML）
   ├─ 解析配置内容
   ├─ 验证配置有效性
   └─ 配置无效 → 保持原配置，记录错误

3. 配置应用
   ├─ 使用atomic.Value原子更新配置
   ├─ 文件监控：添加/删除监控路径
   ├─ 容器监控：更新标签过滤规则
   ├─ 输出配置：重新创建输出客户端
   └─ 记录配置变更审计日志

4. 验证生效
   ├─ 检查新配置是否生效
   ├─ 监控指标是否正常
   └─ 记录配置版本号
```

### 4.5 异常流程

**文件读取失败**:
```
1. 检测文件读取错误
2. 记录错误日志
3. 保持检查点不变
4. 定期重试读取（指数退避）
5. 文件恢复后继续采集
```

**网络传输失败**:
```
1. 检测网络连接失败
2. 日志写入BoltDB持久化
3. 定期重试连接（指数退避）
4. 连接恢复后重传缓冲日志
5. 缓冲区满时丢弃最旧日志（可配置）
```

**资源不足**:
```
1. 监控内存和磁盘使用率
2. 内存不足 → 减少内存队列大小
3. 磁盘不足 → 清理旧的BoltDB数据
4. CPU不足 → 降低采集频率
5. 上报资源告警
```

---

## 5. 接口设计

### 5.1 配置文件接口

**配置文件格式**: YAML

**配置文件路径**: `/etc/log-agent/config.yaml`

**配置热更新说明**: 
- ✅ 大部分配置支持热更新（通过SIGHUP信号或文件监控）
- ❌ 少数配置需要重启服务（如监听端口、BoltDB路径）
- 详细热更新设计见第11节

**配置示例**:
```yaml
# 通用配置
agent:
  name: "log-agent-01"                    # ❌ 不推荐热更新（影响元数据一致性）
  hostname: "web-server-01"               # ❌ 不推荐热更新（影响元数据一致性）
  tags:                                   # ✅ 支持热更新
    env: "production"
    region: "us-east-1"

# 文件日志采集
inputs:
  file:
    enabled: true                         # ✅ 支持热更新
    paths:                                # ✅ 支持热更新（动态添加/删除监控路径）
      - /var/log/nginx/*.log
      - /var/log/app/*.log
    multiline_pattern: "^\\d{4}-\\d{2}-\\d{2}"  # ✅ 支持热更新
    max_line_length: 1048576              # ✅ 支持热更新
    buffer_size: 65536                    # ✅ 支持热更新
    checkpoint_interval: 5                # ✅ 支持热更新

  # 容器日志采集
  docker:
    enabled: true                         # ✅ 支持热更新
    socket: /var/run/docker.sock          # ❌ 不推荐热更新（需要重建连接）
    include_labels:                       # ✅ 支持热更新
      log_collection: "enabled"
    exclude_labels:                       # ✅ 支持热更新
      log_collection: "disabled"

  # Kubernetes日志采集
  kubernetes:
    enabled: false                        # ✅ 支持热更新
    kubeconfig: ~/.kube/config            # ❌ 不推荐热更新（需要重建连接）
    namespaces:                           # ✅ 支持热更新
      - default
      - production
    node_name: ""                         # ✅ 支持热更新

  # 数据库日志采集
  database:
    mysql:
      enabled: false                      # ✅ 支持热更新
      slow_log_path: /var/log/mysql/slow.log      # ✅ 支持热更新
      error_log_path: /var/log/mysql/error.log    # ✅ 支持热更新
      slow_threshold: 1.0                 # ✅ 支持热更新
    postgresql:
      enabled: false                      # ✅ 支持热更新
      log_dir: /var/log/postgresql        # ✅ 支持热更新
    mongodb:
      enabled: false                      # ✅ 支持热更新
      log_path: /var/log/mongodb/mongod.log       # ✅ 支持热更新
    redis:
      enabled: false                      # ✅ 支持热更新
      log_path: /var/log/redis/redis.log # ✅ 支持热更新

  # Syslog服务器
  syslog:
    udp:
      enabled: true                       # ✅ 支持热更新
      port: 514                           # ❌ 不推荐热更新（需要重新绑定端口）
    tcp:
      enabled: true                       # ✅ 支持热更新
      port: 514                           # ❌ 不推荐热更新（需要重新绑定端口）
    tls:
      enabled: false                      # ✅ 支持热更新
      port: 6514                          # ❌ 不推荐热更新（需要重新绑定端口）
      cert_file: /etc/log-agent/certs/server.crt  # ❌ 不推荐热更新（需要重新加载证书）
      key_file: /etc/log-agent/certs/server.key   # ❌ 不推荐热更新（需要重新加载证书）
      ca_file: /etc/log-agent/certs/ca.crt        # ❌ 不推荐热更新（需要重新加载证书）

  # 云服务日志
  cloud:
    aws:
      enabled: false                      # ✅ 支持热更新
      region: us-east-1                   # ✅ 支持热更新
      log_groups:                         # ✅ 支持热更新
        - /aws/lambda/my-function
      poll_interval: 60                   # ✅ 支持热更新
    webhook:
      enabled: false                      # ✅ 支持热更新
      port: 8081                          # ❌ 不推荐热更新（需要重新绑定端口）
      path: /webhook                      # ✅ 支持热更新
      auth:
        type: bearer                      # ✅ 支持热更新
        token: "your-secret-token"        # ✅ 支持热更新

  # IoT设备日志
  iot:
    mqtt:
      enabled: false                      # ✅ 支持热更新
      broker: tcp://localhost:1883        # ❌ 不推荐热更新（需要重建连接）
      client_id: log-agent                # ❌ 不推荐热更新（需要重建连接）
      username: ""                        # ❌ 不推荐热更新（需要重新认证）
      password: ""                        # ❌ 不推荐热更新（需要重新认证）
      topics:                             # ✅ 支持热更新
        - devices/+/logs
      qos: 1                              # ✅ 支持热更新
      tls:
        enabled: false                    # ✅ 支持热更新
        cert_file: ""                     # ❌ 不推荐热更新（需要重新加载证书）
        key_file: ""                      # ❌ 不推荐热更新（需要重新加载证书）
    http:
      enabled: false                      # ✅ 支持热更新
      port: 8081                          # ❌ 不推荐热更新（需要重新绑定端口）
      path: /iot/logs                     # ✅ 支持热更新
      auth:
        type: api_key                     # ✅ 支持热更新
        header: X-API-Key                 # ✅ 支持热更新
        api_key: "your-api-key"           # ✅ 支持热更新
    coap:
      enabled: false                      # ✅ 支持热更新
      port: 5683                          # ❌ 不推荐热更新（需要重新绑定端口）

  # 系统日志
  system:
    journald:
      enabled: true                       # ✅ 支持热更新
      units:                              # ✅ 支持热更新
        - nginx.service
        - docker.service
    eventlog:
      enabled: false                      # ✅ 支持热更新
      channels:                           # ✅ 支持热更新
        - Application
        - System
    macos_log:
      enabled: false                      # ✅ 支持热更新
      predicate: 'eventMessage contains "error"'  # ✅ 支持热更新
      processes:                          # ✅ 支持热更新
        - nginx
        - docker

# 本地缓冲
buffer:
  memory_size: 10000                      # ✅ 支持热更新
  disk_path: /var/lib/log-agent/buffer.db  # ❌ 不推荐热更新（需要重新打开数据库）
  disk_max_size: 1073741824  # 1GB      # ✅ 支持热更新
  flush_interval: 5                       # ✅ 支持热更新

# 输出配置
outputs:
  kafka:
    enabled: true                         # ✅ 支持热更新
    brokers:                              # ❌ 不推荐热更新（需要重建连接）
      - localhost:9092
    topic: logs                           # ✅ 支持热更新
    compression: lz4                      # ✅ 支持热更新
    batch_size: 1000                      # ✅ 支持热更新
    linger_ms: 100                        # ✅ 支持热更新
    tls:
      enabled: false                      # ✅ 支持热更新
      ca_file: ""                         # ❌ 不推荐热更新（需要重新加载证书）
      cert_file: ""                       # ❌ 不推荐热更新（需要重新加载证书）
      key_file: ""                        # ❌ 不推荐热更新（需要重新加载证书）
    sasl:
      enabled: false                      # ✅ 支持热更新
      mechanism: PLAIN                    # ❌ 不推荐热更新（需要重新认证）
      username: ""                        # ❌ 不推荐热更新（需要重新认证）
      password: ""                        # ❌ 不推荐热更新（需要重新认证）

  http:
    enabled: false                        # ✅ 支持热更新
    url: https://log-collector.example.com/api/logs  # ❌ 不推荐热更新（需要重建连接）
    method: POST                          # ✅ 支持热更新
    compression: gzip                     # ✅ 支持热更新
    batch_size: 100                       # ✅ 支持热更新
    timeout: 30s                          # ✅ 支持热更新
    tls:
      enabled: true                       # ✅ 支持热更新
      insecure_skip_verify: false         # ✅ 支持热更新
      ca_file: ""                         # ❌ 不推荐热更新（需要重新加载证书）
    auth:
      type: bearer                        # ✅ 支持热更新
      token: "your-api-token"             # ✅ 支持热更新
    retry:
      max_attempts: 3                     # ✅ 支持热更新
      initial_backoff: 1s                 # ✅ 支持热更新
      max_backoff: 30s                    # ✅ 支持热更新

  grpc:
    enabled: false                        # ✅ 支持热更新
    address: log-collector.example.com:9090  # ❌ 不推荐热更新（需要重建连接）
    compression: gzip                     # ✅ 支持热更新
    batch_size: 100                       # ✅ 支持热更新
    tls:
      enabled: true                       # ✅ 支持热更新
      insecure_skip_verify: false         # ✅ 支持热更新
      ca_file: ""                         # ❌ 不推荐热更新（需要重新加载证书）
      cert_file: ""                       # ❌ 不推荐热更新（需要重新加载证书）
      key_file: ""                        # ❌ 不推荐热更新（需要重新加载证书）

# 监控配置
monitoring:
  prometheus:
    enabled: true                         # ✅ 支持热更新
    port: 9100                            # ❌ 不推荐热更新（需要重新绑定端口）
    path: /metrics                        # ✅ 支持热更新
  health_check:
    enabled: true                         # ✅ 支持热更新
    port: 8080                            # ❌ 不推荐热更新（需要重新绑定端口）
    path: /health                         # ✅ 支持热更新

# 告警配置
alerting:
  enabled: true                           # ✅ 支持热更新
  # 告警规则文件路径（✅ 支持热更新 - 文件监控自动更新）
  rules_file: /etc/log-agent/alert_rules.yaml
  # 告警评估间隔（✅ 支持热更新）
  evaluation_interval: 30s
  # 告警通知配置（✅ 支持热更新）
  notifications:
    - type: webhook
      url: https://alert.example.com/webhook
      enabled: true
      timeout: 10s
      retry: 3
    - type: email
      smtp_host: smtp.example.com
      smtp_port: 587
      username: alert@example.com
      password: "${SMTP_PASSWORD}"
      from: alert@example.com
      to:
        - ops@example.com
        - oncall@example.com
      enabled: false
    - type: slack
      webhook_url: https://hooks.slack.com/services/xxx
      channel: "#alerts"
      enabled: false

# 日志配置
logging:
  level: info                             # ✅ 支持热更新
  format: json                            # ✅ 支持热更新
  output: stdout                          # ❌ 不推荐热更新（需要重新打开输出）
```

**配置热更新总结**:
- ✅ **支持热更新**（约70%配置项）: 业务逻辑配置、过滤规则、批量大小、超时时间、日志级别等
- ❌ **不推荐热更新**（约30%配置项）: 连接地址、监听端口、证书路径、数据库路径、Agent标识等

**热更新方式**:
```bash
# 方式1: 发送SIGHUP信号（推荐）
kill -HUP $(pidof log-agent)

# 方式2: 文件监控自动更新（自动）
# 修改配置文件后1秒内自动生效

# 方式3: HTTP API触发
curl -X POST http://localhost:8080/reload
```

### 5.2 健康检查接口

**端点**: `GET /health`

**响应示例**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600,
  "inputs": {
    "file": {
      "enabled": true,
      "files_monitored": 10,
      "lines_read": 1000000
    },
    "docker": {
      "enabled": true,
      "containers_monitored": 5
    }
  },
  "buffer": {
    "memory_usage": 5000,
    "disk_usage": 104857600
  },
  "outputs": {
    "kafka": {
      "enabled": true,
      "messages_sent": 950000,
      "errors": 0
    }
  }
}
```

### 5.3 Prometheus指标接口

**端点**: `GET /metrics`

**指标列表**:
```
# 输入指标
log_agent_input_lines_total{source="file",path="/var/log/nginx/access.log"}
log_agent_input_bytes_total{source="file",path="/var/log/nginx/access.log"}
log_agent_input_errors_total{source="file",path="/var/log/nginx/access.log"}

# 缓冲指标
log_agent_buffer_memory_usage
log_agent_buffer_disk_usage
log_agent_buffer_disk_max_size

# 输出指标
log_agent_output_messages_total{output="kafka",topic="logs"}
log_agent_output_bytes_total{output="kafka",topic="logs"}
log_agent_output_errors_total{output="kafka",topic="logs"}
log_agent_output_latency_seconds{output="kafka",topic="logs"}

# 系统指标
log_agent_cpu_usage_percent
log_agent_memory_usage_bytes
log_agent_goroutines_count
```

### 5.4 内部接口

**输入插件接口**:
```go
type Input interface {
    // 启动输入插件
    Start(ctx context.Context) error
    
    // 停止输入插件
    Stop() error
    
    // 获取插件名称
    Name() string
    
    // 获取插件状态
    Status() InputStatus
}
```

**输出插件接口**:
```go
type Output interface {
    // 发送日志批次
    Send(ctx context.Context, entries []*LogEntry) error
    
    // 关闭输出插件
    Close() error
    
    // 获取插件名称
    Name() string
}
```

**检查点接口**:
```go
type Checkpointer interface {
    // 保存检查点
    Save(path string, inode uint64, offset int64) error
    
    // 加载检查点
    Load(path string, inode uint64) (int64, error)
    
    // 删除检查点
    Delete(path string, inode uint64) error
}
```

详见 [API设计文档](./api-design.md) 模块19部分

---

## 6. 数据设计

### 6.1 核心数据模型

**日志条目结构**:
```go
// LogEntry 日志条目
type LogEntry struct {
    // 基础字段
    Source    string                 `json:"source"`              // 日志来源
    Message   string                 `json:"message"`             // 日志消息
    Timestamp string                 `json:"timestamp"`           // 时间戳（RFC3339Nano）
    Level     string                 `json:"level,omitempty"`     // 日志级别
    
    // 扩展字段
    Fields    map[string]interface{} `json:"fields,omitempty"`    // 自定义字段
    
    // 元数据
    AgentName string                 `json:"agent_name"`          // Agent名称
    Hostname  string                 `json:"hostname"`            // 主机名
    Tags      map[string]string      `json:"tags,omitempty"`      // 标签
}

// FileState 文件状态
type FileState struct {
    Path      string          `json:"path"`       // 文件路径
    Inode     uint64          `json:"inode"`      // 文件inode
    Offset    int64           `json:"offset"`     // 读取偏移量
    LastRead  time.Time       `json:"last_read"`  // 最后读取时间
    Multiline *MultilineState `json:"multiline"`  // 多行日志状态
}

// MultilineState 多行日志状态
type MultilineState struct {
    Pattern     *regexp.Regexp `json:"-"`              // 起始模式
    Buffer      []string       `json:"buffer"`         // 行缓冲
    StartTime   time.Time      `json:"start_time"`     // 开始时间
    MaxLines    int            `json:"max_lines"`      // 最大行数
    MaxDuration time.Duration  `json:"max_duration"`   // 最大持续时间
}

// ContainerReader 容器读取器
type ContainerReader struct {
    ID          string                 `json:"id"`           // 容器ID
    Name        string                 `json:"name"`         // 容器名称
    Image       string                 `json:"image"`        // 镜像名称
    Labels      map[string]string      `json:"labels"`       // 标签
    Metadata    map[string]interface{} `json:"metadata"`     // 元数据
    LogStream   io.ReadCloser          `json:"-"`            // 日志流
    Cancel      context.CancelFunc     `json:"-"`            // 取消函数
    LastRead    time.Time              `json:"last_read"`    // 最后读取时间
}

// DeviceInfo 设备信息
type DeviceInfo struct {
    ID       string                 `json:"id"`        // 设备ID
    Type     string                 `json:"type"`      // 设备类型
    Location string                 `json:"location"`  // 设备位置
    Metadata map[string]interface{} `json:"metadata"`  // 元数据
}
```

### 6.2 BoltDB存储设计

**Bucket结构**:
```
log-agent.db
├── checkpoints/          # 检查点Bucket
│   ├── file:{path}:{inode} → {offset}
│   └── ...
├── buffer/               # 缓冲Bucket
│   ├── {sequence} → {log_entry_json}
│   └── ...
└── metadata/             # 元数据Bucket
    ├── version → "1.0.0"
    ├── agent_id → "agent-01"
    └── last_flush → "2024-01-31T10:30:45Z"
```

**检查点存储**:
```go
// 检查点Key格式
key := fmt.Sprintf("file:%s:%d", path, inode)

// 检查点Value格式
type CheckpointValue struct {
    Offset    int64     `json:"offset"`
    Timestamp time.Time `json:"timestamp"`
}
```

**缓冲存储**:
```go
// 缓冲Key格式（使用递增序列号）
key := fmt.Sprintf("%020d", sequence)

// 缓冲Value格式（JSON序列化的LogEntry）
value := json.Marshal(logEntry)
```

### 6.3 内存缓冲设计

**Ring Buffer实现**:
```go
// RingBuffer 环形缓冲区
type RingBuffer struct {
    buffer   []*LogEntry
    size     int
    head     int
    tail     int
    count    int
    mu       sync.RWMutex
    notEmpty *sync.Cond
    notFull  *sync.Cond
}

// 写入逻辑
func (rb *RingBuffer) Write(entry *LogEntry) error {
    rb.mu.Lock()
    defer rb.mu.Unlock()
    
    // 等待缓冲区有空间
    for rb.count == rb.size {
        rb.notFull.Wait()
    }
    
    // 写入数据
    rb.buffer[rb.tail] = entry
    rb.tail = (rb.tail + 1) % rb.size
    rb.count++
    
    // 通知读取者
    rb.notEmpty.Signal()
    return nil
}

// 读取逻辑
func (rb *RingBuffer) Read() (*LogEntry, error) {
    rb.mu.Lock()
    defer rb.mu.Unlock()
    
    // 等待缓冲区有数据
    for rb.count == 0 {
        rb.notEmpty.Wait()
    }
    
    // 读取数据
    entry := rb.buffer[rb.head]
    rb.head = (rb.head + 1) % rb.size
    rb.count--
    
    // 通知写入者
    rb.notFull.Signal()
    return entry, nil
}
```

### 6.4 配置数据结构

```go
// Config Agent配置
type Config struct {
    Agent      AgentConfig      `yaml:"agent"`
    Inputs     InputsConfig     `yaml:"inputs"`
    Buffer     BufferConfig     `yaml:"buffer"`
    Outputs    OutputsConfig    `yaml:"outputs"`
    Monitoring MonitoringConfig `yaml:"monitoring"`
    Logging    LoggingConfig    `yaml:"logging"`
}

// AgentConfig Agent基础配置
type AgentConfig struct {
    Name     string            `yaml:"name"`
    Hostname string            `yaml:"hostname"`
    Tags     map[string]string `yaml:"tags"`
}

// InputsConfig 输入配置
type InputsConfig struct {
    File       FileInputConfig       `yaml:"file"`
    Docker     DockerInputConfig     `yaml:"docker"`
    Kubernetes K8sInputConfig        `yaml:"kubernetes"`
    Database   DatabaseInputConfig   `yaml:"database"`
    Syslog     SyslogInputConfig     `yaml:"syslog"`
    Cloud      CloudInputConfig      `yaml:"cloud"`
    IoT        IoTInputConfig        `yaml:"iot"`
    System     SystemInputConfig     `yaml:"system"`
}

// BufferConfig 缓冲配置
type BufferConfig struct {
    MemorySize    int    `yaml:"memory_size"`     // 内存队列大小
    DiskPath      string `yaml:"disk_path"`       // 磁盘缓冲路径
    DiskMaxSize   int64  `yaml:"disk_max_size"`   // 磁盘最大大小
    FlushInterval int    `yaml:"flush_interval"`  // 刷新间隔（秒）
}

// OutputsConfig 输出配置
type OutputsConfig struct {
    Kafka KafkaOutputConfig `yaml:"kafka"`
    HTTP  HTTPOutputConfig  `yaml:"http"`
    GRPC  GRPCOutputConfig  `yaml:"grpc"`
}
```

---

## 7. 安全设计

### 7.1 传输安全

**TLS加密传输**:
```go
// TLS配置
type TLSConfig struct {
    Enabled            bool   `yaml:"enabled"`
    CertFile           string `yaml:"cert_file"`
    KeyFile            string `yaml:"key_file"`
    CAFile             string `yaml:"ca_file"`
    InsecureSkipVerify bool   `yaml:"insecure_skip_verify"`
}

// 创建TLS配置
func createTLSConfig(config TLSConfig) (*tls.Config, error) {
    tlsConfig := &tls.Config{
        MinVersion: tls.VersionTLS12,
        MaxVersion: tls.VersionTLS13,
    }
    
    // 加载客户端证书
    if config.CertFile != "" && config.KeyFile != "" {
        cert, err := tls.LoadX509KeyPair(config.CertFile, config.KeyFile)
        if err != nil {
            return nil, err
        }
        tlsConfig.Certificates = []tls.Certificate{cert}
    }
    
    // 加载CA证书
    if config.CAFile != "" {
        caCert, err := ioutil.ReadFile(config.CAFile)
        if err != nil {
            return nil, err
        }
        caCertPool := x509.NewCertPool()
        caCertPool.AppendCertsFromPEM(caCert)
        tlsConfig.RootCAs = caCertPool
    }
    
    tlsConfig.InsecureSkipVerify = config.InsecureSkipVerify
    
    return tlsConfig, nil
}
```

**支持的加密协议**:
- TLS 1.2 / TLS 1.3
- 支持客户端证书认证
- 支持CA证书验证

### 7.2 认证授权

**支持的认证方式**:

1. **Bearer Token认证**:
```go
// HTTP请求添加Bearer Token
req.Header.Set("Authorization", "Bearer "+token)
```

2. **API Key认证**:
```go
// HTTP请求添加API Key
req.Header.Set("X-API-Key", apiKey)
```

3. **SASL认证（Kafka）**:
```yaml
sasl:
  enabled: true
  mechanism: PLAIN  # PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
  username: "user"
  password: "pass"
```

4. **客户端证书认证（mTLS）**:
```yaml
tls:
  enabled: true
  cert_file: /etc/log-agent/certs/client.crt
  key_file: /etc/log-agent/certs/client.key
  ca_file: /etc/log-agent/certs/ca.crt
```

### 7.3 数据安全

**敏感数据脱敏**:
```go
// 敏感字段脱敏
type Masker struct {
    patterns map[string]*regexp.Regexp
}

func (m *Masker) Mask(message string) string {
    // 脱敏密码
    message = m.patterns["password"].ReplaceAllString(message, "password=***")
    
    // 脱敏信用卡号
    message = m.patterns["credit_card"].ReplaceAllString(message, "****-****-****-$1")
    
    // 脱敏手机号
    message = m.patterns["phone"].ReplaceAllString(message, "$1****$2")
    
    return message
}
```

**本地数据保护**:
- BoltDB文件权限设置为600（仅所有者可读写）
- 配置文件权限设置为600
- 证书文件权限设置为400（仅所有者可读）

### 7.4 审计日志

**审计事件**:
```go
// 审计日志记录
type AuditLog struct {
    Timestamp string `json:"timestamp"`
    Event     string `json:"event"`
    User      string `json:"user"`
    Action    string `json:"action"`
    Resource  string `json:"resource"`
    Result    string `json:"result"`
    Details   string `json:"details"`
}

// 记录配置变更
func logConfigChange(oldConfig, newConfig *Config) {
    audit := &AuditLog{
        Timestamp: time.Now().Format(time.RFC3339),
        Event:     "config_change",
        User:      "system",
        Action:    "reload",
        Resource:  "config.yaml",
        Result:    "success",
        Details:   fmt.Sprintf("配置从版本%s更新到%s", oldConfig.Version, newConfig.Version),
    }
    logAudit(audit)
}
```

**审计事件类型**:
- 配置变更（config_change）
- 输入启动/停止（input_start/input_stop）
- 输出启动/停止（output_start/output_stop）
- 认证失败（auth_failure）
- 连接失败（connection_failure）

### 7.5 安全最佳实践

1. **最小权限原则**: Agent以非root用户运行
2. **证书管理**: 定期轮换证书，使用短期证书
3. **密钥管理**: 敏感配置使用环境变量或密钥管理服务
4. **网络隔离**: 仅开放必要的端口
5. **日志脱敏**: 自动脱敏敏感信息
6. **审计追踪**: 记录所有关键操作

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 日志采集延迟 | < 3秒 | 从日志生成到采集完成的时间 |
| 文件监控响应时间 | < 1秒 | 文件变化到检测到的时间 |
| 吞吐量 | 10万条/秒 | 单Agent每秒处理的日志条数 |
| CPU占用率 | < 10% | 正常负载下的CPU使用率 |
| 内存占用 | < 200MB | 正常负载下的内存使用量 |
| 磁盘IO | < 10MB/s | 正常负载下的磁盘写入速度 |
| 网络带宽 | < 10MB/s | 正常负载下的网络传输速度 |

### 8.2 性能优化策略

**1. 批量处理**:
```go
// 批量发送配置
type BatchConfig struct {
    Size     int           // 批次大小（条数）
    Timeout  time.Duration // 批次超时时间
    MaxBytes int           // 批次最大字节数
}

// 批量累积器
type Batcher struct {
    entries  []*LogEntry
    size     int
    bytes    int
    timer    *time.Timer
    config   BatchConfig
}

func (b *Batcher) Add(entry *LogEntry) bool {
    b.entries = append(b.entries, entry)
    b.size++
    b.bytes += len(entry.Message)
    
    // 检查是否达到批次条件
    if b.size >= b.config.Size || b.bytes >= b.config.MaxBytes {
        return true // 需要刷新
    }
    
    return false
}
```

**2. 压缩传输**:
```go
// 压缩器接口
type Compressor interface {
    Compress(data []byte) ([]byte, error)
    Decompress(data []byte) ([]byte, error)
}

// LZ4压缩器（速度最快）
type LZ4Compressor struct{}

func (c *LZ4Compressor) Compress(data []byte) ([]byte, error) {
    buf := make([]byte, lz4.CompressBlockBound(len(data)))
    n, err := lz4.CompressBlock(data, buf, nil)
    if err != nil {
        return nil, err
    }
    return buf[:n], nil
}

// 压缩比对比
// gzip: 压缩比最高（~70%），速度较慢
// lz4:  压缩比中等（~50%），速度最快
// zstd: 压缩比高（~65%），速度快
```

**3. 内存池复用**:
```go
// LogEntry对象池
var logEntryPool = sync.Pool{
    New: func() interface{} {
        return &LogEntry{
            Fields: make(map[string]interface{}),
        }
    },
}

// 获取LogEntry
func getLogEntry() *LogEntry {
    return logEntryPool.Get().(*LogEntry)
}

// 释放LogEntry
func putLogEntry(entry *LogEntry) {
    entry.Source = ""
    entry.Message = ""
    entry.Timestamp = ""
    entry.Level = ""
    for k := range entry.Fields {
        delete(entry.Fields, k)
    }
    logEntryPool.Put(entry)
}
```

**4. 并发处理**:
```go
// Worker Pool模式
type WorkerPool struct {
    workers   int
    taskQueue chan *LogEntry
    wg        sync.WaitGroup
}

func (wp *WorkerPool) Start(ctx context.Context) {
    for i := 0; i < wp.workers; i++ {
        wp.wg.Add(1)
        go wp.worker(ctx, i)
    }
}

func (wp *WorkerPool) worker(ctx context.Context, id int) {
    defer wp.wg.Done()
    
    for {
        select {
        case <-ctx.Done():
            return
        case entry := <-wp.taskQueue:
            wp.processEntry(entry)
        }
    }
}
```

**5. 零拷贝优化**:
```go
// 使用io.Copy避免内存拷贝
func (fw *FileWatcher) readFileZeroCopy(path string) error {
    file, err := os.Open(path)
    if err != nil {
        return err
    }
    defer file.Close()
    
    // 直接从文件读取到网络连接，避免中间缓冲
    _, err = io.Copy(fw.outputWriter, file)
    return err
}
```

### 8.3 资源限制

**CPU限制**:
```go
// 使用runtime.GOMAXPROCS限制CPU核心数
runtime.GOMAXPROCS(2) // 限制使用2个CPU核心
```

**内存限制**:
```go
// 设置内存软限制
debug.SetMemoryLimit(200 * 1024 * 1024) // 200MB

// 定期触发GC
ticker := time.NewTicker(30 * time.Second)
go func() {
    for range ticker.C {
        runtime.GC()
    }
}()
```

**磁盘限制**:
```go
// 检查磁盘使用率
func checkDiskUsage(path string) (float64, error) {
    var stat syscall.Statfs_t
    if err := syscall.Statfs(path, &stat); err != nil {
        return 0, err
    }
    
    total := stat.Blocks * uint64(stat.Bsize)
    free := stat.Bfree * uint64(stat.Bsize)
    used := total - free
    
    return float64(used) / float64(total), nil
}

// 磁盘使用率超过90%时停止写入
if usage, _ := checkDiskUsage("/var/lib/log-agent"); usage > 0.9 {
    log.Warn("磁盘使用率过高，停止写入缓冲")
    return ErrDiskFull
}
```

### 8.4 容量规划

**单Agent容量估算**:

假设条件:
- 平均日志大小: 500字节
- 目标吞吐量: 10万条/秒
- 压缩比: 50%（使用lz4）

计算:
- 原始数据量: 100,000 × 500 = 50MB/s
- 压缩后数据量: 50MB/s × 50% = 25MB/s
- 网络带宽需求: 25MB/s = 200Mbps
- 内存需求: 10,000条缓冲 × 500字节 = 5MB
- 磁盘缓冲: 1GB（可缓冲40秒数据）

**扩展策略**:
- 单机部署: 适用于日志量 < 1万条/秒
- 多Agent部署: 适用于日志量 1万-10万条/秒
- 分布式部署: 适用于日志量 > 10万条/秒

### 8.5 性能监控

**关键性能指标**:
```go
// 性能指标收集
type PerformanceMetrics struct {
    // 吞吐量指标
    InputRate  float64 // 输入速率（条/秒）
    OutputRate float64 // 输出速率（条/秒）
    
    // 延迟指标
    ProcessingLatency time.Duration // 处理延迟
    TransmitLatency   time.Duration // 传输延迟
    
    // 资源指标
    CPUUsage    float64 // CPU使用率
    MemoryUsage int64   // 内存使用量
    DiskUsage   int64   // 磁盘使用量
    
    // 队列指标
    QueueSize   int // 队列大小
    QueueUsage  float64 // 队列使用率
}

// 定期上报性能指标
func (pm *PerformanceMetrics) Report() {
    prometheus.InputRateGauge.Set(pm.InputRate)
    prometheus.OutputRateGauge.Set(pm.OutputRate)
    prometheus.ProcessingLatencyHistogram.Observe(pm.ProcessingLatency.Seconds())
    prometheus.CPUUsageGauge.Set(pm.CPUUsage)
    prometheus.MemoryUsageGauge.Set(float64(pm.MemoryUsage))
}
```

---

## 9. 部署方案

### 9.1 部署架构

**单机部署架构**:
```
┌─────────────────────────────────────────┐
│         被监控服务器                     │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │      应用服务                    │   │
│  │  ├─ Nginx                        │   │
│  │  ├─ Docker容器                   │   │
│  │  └─ 应用日志                     │   │
│  └──────────┬──────────────────────┘   │
│             │ 日志文件                  │
│             ▼                           │
│  ┌─────────────────────────────────┐   │
│  │    Log Agent                     │   │
│  │  ├─ 文件监控                     │   │
│  │  ├─ 容器监控                     │   │
│  │  ├─ 本地缓冲                     │   │
│  │  └─ 日志传输                     │   │
│  └──────────┬──────────────────────┘   │
└─────────────┼──────────────────────────┘
              │ Kafka/HTTP/gRPC
              ▼
   ┌─────────────────────────┐
   │   中央日志服务器         │
   │  ├─ Kafka               │
   │  ├─ Collector           │
   │  └─ Elasticsearch       │
   └─────────────────────────┘
```

**分布式部署架构**:
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  服务器1      │  │  服务器2      │  │  服务器N      │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │Log Agent │ │  │ │Log Agent │ │  │ │Log Agent │ │
│ └────┬─────┘ │  │ └────┬─────┘ │  │ └────┬─────┘ │
└──────┼───────┘  └──────┼───────┘  └──────┼───────┘
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │ Kafka
                         ▼
              ┌─────────────────────┐
              │   Kafka Cluster     │
              │  ├─ Broker 1        │
              │  ├─ Broker 2        │
              │  └─ Broker 3        │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Collector         │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │   Elasticsearch     │
              └─────────────────────┘
```

### 9.2 安装部署

**二进制安装**:
```bash
# 1. 下载二进制文件
wget https://releases.example.com/log-agent/v1.0.0/log-agent-linux-amd64.tar.gz

# 2. 解压
tar -xzf log-agent-linux-amd64.tar.gz

# 3. 安装
sudo cp log-agent /usr/local/bin/
sudo chmod +x /usr/local/bin/log-agent

# 4. 创建配置目录
sudo mkdir -p /etc/log-agent
sudo cp config.yaml /etc/log-agent/

# 5. 创建数据目录
sudo mkdir -p /var/lib/log-agent
sudo chown log-agent:log-agent /var/lib/log-agent

# 6. 创建systemd服务
sudo cp log-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable log-agent
sudo systemctl start log-agent
```

**Docker部署**:
```bash
# 1. 拉取镜像
docker pull log-agent:v1.0.0

# 2. 运行容器
docker run -d \
  --name log-agent \
  --restart always \
  -v /var/log:/var/log:ro \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /etc/log-agent:/etc/log-agent:ro \
  -v /var/lib/log-agent:/var/lib/log-agent \
  log-agent:v1.0.0
```

**Kubernetes部署**:
```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
  namespace: logging
spec:
  selector:
    matchLabels:
      app: log-agent
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      serviceAccountName: log-agent
      containers:
      - name: log-agent
        image: log-agent:v1.0.0
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        volumeMounts:
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: config
          mountPath: /etc/log-agent
        - name: data
          mountPath: /var/lib/log-agent
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: config
        configMap:
          name: log-agent-config
      - name: data
        hostPath:
          path: /var/lib/log-agent
          type: DirectoryOrCreate
```

### 9.3 资源配置

| 组件 | 副本数 | CPU | 内存 | 磁盘 | 说明 |
|------|--------|-----|------|------|------|
| Log Agent（轻量） | 1/节点 | 100m | 128Mi | 1GB | 小规模环境 |
| Log Agent（标准） | 1/节点 | 200m | 256Mi | 5GB | 中等规模环境 |
| Log Agent（高性能） | 1/节点 | 500m | 512Mi | 10GB | 大规模环境 |

**资源配置建议**:

1. **CPU配置**:
   - 轻量级: 100m（0.1核）- 适用于日志量 < 1000条/秒
   - 标准: 200m（0.2核）- 适用于日志量 1000-5000条/秒
   - 高性能: 500m（0.5核）- 适用于日志量 > 5000条/秒

2. **内存配置**:
   - 轻量级: 128Mi - 内存队列1000条
   - 标准: 256Mi - 内存队列5000条
   - 高性能: 512Mi - 内存队列10000条

3. **磁盘配置**:
   - 轻量级: 1GB - 可缓冲约10分钟数据
   - 标准: 5GB - 可缓冲约1小时数据
   - 高性能: 10GB - 可缓冲约2小时数据

### 9.4 配置管理

**配置热更新（推荐方式）**:

模块19支持通过SIGHUP信号或文件监控实现配置热更新，无需重启服务。详细设计见第11节"配置热更新详细设计"。

**热更新优势**:
- ✅ 无需重启进程，服务不中断
- ✅ 生效速度快（< 1秒）
- ✅ 不影响正在采集的日志
- ✅ 支持配置验证和自动回滚
- ✅ 记录完整的审计日志

**热更新方式**:

1. **SIGHUP信号触发**（推荐）:
```bash
# 发送SIGHUP信号
kill -HUP $(pidof log-agent)

# 或使用systemctl
systemctl reload log-agent
```

2. **文件监控自动更新**:
```bash
# 修改配置文件后自动检测并重新加载
vim /etc/log-agent/config.yaml
# 保存后1秒内自动生效
```

3. **HTTP API触发**:
```bash
# 通过API触发配置重载
curl -X POST http://localhost:8080/reload
```

**支持热更新的配置项**（共50+项）:

| 配置组 | 配置项 | 热更新支持 |
|--------|--------|-----------|
| **文件监控** | paths、multiline_pattern、max_line_length、buffer_size、checkpoint_interval | ✅ 支持 |
| **容器监控** | include_labels、exclude_labels | ✅ 支持 |
| **K8s监控** | namespaces、node_name | ✅ 支持 |
| **数据库监控** | slow_threshold、log_path | ✅ 支持 |
| **Syslog服务器** | port、tls配置 | ✅ 支持 |
| **云服务** | poll_interval、log_groups | ✅ 支持 |
| **IoT设备** | topics、qos | ✅ 支持 |
| **缓冲配置** | memory_size、flush_interval | ✅ 支持 |
| **输出配置** | batch_size、compression、timeout | ✅ 支持 |
| **告警规则** | rules_file（文件监控自动更新） | ✅ 支持 |
| **日志级别** | log_level | ✅ 支持 |

**配置文件管理**:
```bash
# 配置文件位置
/etc/log-agent/
├── config.yaml          # 主配置文件（✅ 支持热更新）
├── alert_rules.yaml     # 告警规则文件（✅ 支持热更新）
├── certs/               # 证书目录（❌ 不推荐热更新）
│   ├── ca.crt
│   ├── client.crt
│   └── client.key
└── patterns/            # 自定义模式（✅ 支持热更新）
    └── grok_patterns
```

**环境变量配置**（备选方式）:

当配置文件不可用时，可以通过环境变量覆盖配置：

```bash
# Agent基础配置
export LOG_AGENT_NAME="agent-01"
export LOG_AGENT_HOSTNAME="web-server-01"

# Kafka输出配置
export LOG_AGENT_KAFKA_BROKERS="kafka1:9092,kafka2:9092"
export LOG_AGENT_KAFKA_TOPIC="logs"
export LOG_AGENT_KAFKA_COMPRESSION="lz4"

# HTTP输出配置
export LOG_AGENT_HTTP_URL="https://log-collector.example.com/api/logs"
export LOG_AGENT_HTTP_TOKEN="your-api-token"

# 缓冲配置
export LOG_AGENT_BUFFER_MEMORY_SIZE="10000"
export LOG_AGENT_BUFFER_DISK_MAX_SIZE="1073741824"

# 监控配置
export LOG_AGENT_PROMETHEUS_PORT="9100"
export LOG_AGENT_HEALTH_CHECK_PORT="8080"
```

**Kubernetes ConfigMap（容器化部署）**:

在Kubernetes环境中，可以使用ConfigMap管理配置：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-agent-config
  namespace: log-management
data:
  config.yaml: |
    # Agent配置
    agent:
      name: "log-agent-k8s"
      hostname: "${HOSTNAME}"
      tags:
        env: "production"
        cluster: "k8s-prod"
    
    # 文件日志采集（✅ 支持热更新）
    inputs:
      file:
        enabled: true
        paths:
          - /var/log/containers/*.log
        multiline_pattern: "^\\d{4}-\\d{2}-\\d{2}"
        checkpoint_interval: 5
      
      # Kubernetes日志采集（✅ 支持热更新）
      kubernetes:
        enabled: true
        namespaces:
          - default
          - production
        node_name: "${NODE_NAME}"
    
    # 本地缓冲（✅ 支持热更新）
    buffer:
      memory_size: 10000
      disk_path: /var/lib/log-agent/buffer.db
      disk_max_size: 1073741824
      flush_interval: 5
    
    # Kafka输出（✅ 支持热更新）
    outputs:
      kafka:
        enabled: true
        brokers:
          - kafka-0.kafka:9092
          - kafka-1.kafka:9092
          - kafka-2.kafka:9092
        topic: logs
        compression: lz4
        batch_size: 1000
        linger_ms: 100
    
    # 监控配置（✅ 支持热更新）
    monitoring:
      prometheus:
        enabled: true
        port: 9100
      health_check:
        enabled: true
        port: 8080
    
    # 日志配置（✅ 支持热更新）
    logging:
      level: info
      format: json
      output: stdout

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-agent-alert-rules
  namespace: log-management
data:
  alert_rules.yaml: |
    # 告警规则（✅ 支持热更新）
    rules:
      - name: "采集延迟过高"
        metric: "log_agent_input_lag_seconds"
        operator: ">"
        threshold: 10
        duration: 60
        severity: "warning"
        message: "日志采集延迟超过10秒"
      
      - name: "缓冲区使用率过高"
        metric: "log_agent_buffer_usage_percent"
        operator: ">"
        threshold: 90
        duration: 60
        severity: "warning"
        message: "缓冲区使用率超过90%"
```

**更新ConfigMap后重载配置**:
```bash
# 编辑ConfigMap
kubectl edit configmap log-agent-config -n log-management

# 方式1: 发送SIGHUP信号到Pod（推荐，无需重启）
kubectl exec -n log-management log-agent-xxx -- kill -HUP 1

# 方式2: 重启Pod（仅在热更新失败时使用）
kubectl rollout restart daemonset/log-agent -n log-management

# 查看重启状态
kubectl rollout status daemonset/log-agent -n log-management
```

**配置优先级**:

模块19的配置加载优先级（从高到低）：
1. **环境变量**（Environment Variables）- 最高优先级
2. **配置文件**（config.yaml）- 中等优先级
3. **默认配置**（代码内置）- 最低优先级

**配置降级策略**:

```
正常情况:
配置文件 → 热更新生效（SIGHUP/文件监控）

配置文件损坏:
环境变量 → 覆盖配置

环境变量未配置:
默认配置 → 使用内置默认值
```

**不推荐热更新的配置**:

以下配置不推荐热更新，建议重启服务：

| 配置类型 | 原因 | 更新方式 |
|---------|------|---------|
| TLS证书路径 | 需要重新加载证书 | 更新配置文件并重启服务 |
| BoltDB路径 | 需要重新打开数据库 | 更新配置文件并重启服务 |
| 监听端口（Prometheus/Health） | 需要重新绑定端口 | 更新配置文件并重启服务 |
| Agent名称和主机名 | 影响日志元数据一致性 | 更新配置文件并重启服务 |

**Secret管理**（Kubernetes环境）:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: log-agent-secret
  namespace: log-management
type: Opaque
data:
  kafka-username: <base64-encoded>
  kafka-password: <base64-encoded>
  http-token: <base64-encoded>
  tls-cert: <base64-encoded>
  tls-key: <base64-encoded>
```

**注意**: Secret中的敏感信息（Kafka密码、HTTP Token、TLS证书等）不推荐热更新，建议通过Secret更新并重启服务。

**配置热更新验证**:

```bash
# 1. 修改配置文件
vim /etc/log-agent/config.yaml

# 2. 触发热更新
kill -HUP $(pidof log-agent)

# 3. 查看日志确认配置已更新
tail -f /var/log/log-agent/agent.log | grep "配置已重新加载"

# 4. 验证新配置生效
curl http://localhost:8080/health

# 5. 检查Prometheus指标
curl http://localhost:9100/metrics | grep log_agent_config_reload_total
```

**配置热更新API**:

```bash
# 触发配置重载
curl -X POST http://localhost:8080/reload

# 查询当前配置版本
curl -X GET http://localhost:8080/config/version

# 查询配置历史
curl -X GET http://localhost:8080/config/history
```

### 9.5 升级策略

**滚动升级**:
```bash
# 1. 备份配置
cp /etc/log-agent/config.yaml /etc/log-agent/config.yaml.bak

# 2. 下载新版本
wget https://releases.example.com/log-agent/v1.1.0/log-agent-linux-amd64.tar.gz

# 3. 停止服务
systemctl stop log-agent

# 4. 替换二进制
sudo cp log-agent /usr/local/bin/

# 5. 启动服务
systemctl start log-agent

# 6. 验证版本
log-agent --version

# 7. 检查状态
systemctl status log-agent
curl http://localhost:8080/health
```

**回滚策略**:
```bash
# 1. 停止服务
systemctl stop log-agent

# 2. 恢复旧版本二进制
sudo cp /usr/local/bin/log-agent.bak /usr/local/bin/log-agent

# 3. 恢复配置
cp /etc/log-agent/config.yaml.bak /etc/log-agent/config.yaml

# 4. 启动服务
systemctl start log-agent
```

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus指标定义**:
```go
// 输入指标
var (
    InputLinesTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "log_agent_input_lines_total",
            Help: "采集的日志行数总计",
        },
        []string{"source", "path"},
    )
    
    InputBytesTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "log_agent_input_bytes_total",
            Help: "采集的日志字节数总计",
        },
        []string{"source", "path"},
    )
    
    InputErrorsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "log_agent_input_errors_total",
            Help: "输入错误总计",
        },
        []string{"source", "error_type"},
    )
)

// 缓冲指标
var (
    BufferMemoryUsage = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "log_agent_buffer_memory_usage",
            Help: "内存缓冲区使用量",
        },
    )
    
    BufferDiskUsage = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "log_agent_buffer_disk_usage",
            Help: "磁盘缓冲区使用量（字节）",
        },
    )
    
    BufferDiskMaxSize = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "log_agent_buffer_disk_max_size",
            Help: "磁盘缓冲区最大大小（字节）",
        },
    )
)

// 输出指标
var (
    OutputMessagesTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "log_agent_output_messages_total",
            Help: "发送的消息总计",
        },
        []string{"output", "topic"},
    )
    
    OutputBytesTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "log_agent_output_bytes_total",
            Help: "发送的字节数总计",
        },
        []string{"output", "topic"},
    )
    
    OutputErrorsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "log_agent_output_errors_total",
            Help: "输出错误总计",
        },
        []string{"output", "error_type"},
    )
    
    OutputLatencySeconds = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "log_agent_output_latency_seconds",
            Help:    "输出延迟（秒）",
            Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5},
        },
        []string{"output", "topic"},
    )
)

// 系统指标
var (
    CPUUsagePercent = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "log_agent_cpu_usage_percent",
            Help: "CPU使用率（百分比）",
        },
    )
    
    MemoryUsageBytes = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "log_agent_memory_usage_bytes",
            Help: "内存使用量（字节）",
        },
    )
    
    GoroutinesCount = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "log_agent_goroutines_count",
            Help: "Goroutine数量",
        },
    )
)
```

### 10.2 告警规则

**内置告警规则配置**:
```yaml
# 配置文件: /etc/log-agent/config.yaml
alerting:
  enabled: true
  # 告警规则配置文件路径
  rules_file: /etc/log-agent/alert_rules.yaml
  # 告警通知配置
  notifications:
    - type: webhook
      url: https://alert.example.com/webhook
      enabled: true
    - type: email
      smtp_host: smtp.example.com
      smtp_port: 587
      from: alert@example.com
      to:
        - ops@example.com
      enabled: false
  # 告警评估间隔
  evaluation_interval: 30s
```

**自定义告警规则文件**:
```yaml
# 文件: /etc/log-agent/alert_rules.yaml
# 支持热更新：修改后自动重新加载

rules:
  # Agent离线告警
  - name: agent_down
    enabled: true
    severity: critical
    condition:
      metric: up
      operator: "=="
      threshold: 0
    duration: 1m
    annotations:
      summary: "Log Agent {{ .Instance }} 离线"
      description: "Log Agent已离线超过1分钟"
    actions:
      - webhook
      - email

  # 输入错误率告警
  - name: input_error_rate_high
    enabled: true
    severity: warning
    condition:
      metric: log_agent_input_errors_total
      operator: ">"
      threshold: 10
      rate: 5m
    duration: 5m
    annotations:
      summary: "Log Agent {{ .Instance }} 输入错误率过高"
      description: "输入错误率: {{ .Value }} 错误/秒"
    actions:
      - webhook

  # 输出错误率告警
  - name: output_error_rate_high
    enabled: true
    severity: warning
    condition:
      metric: log_agent_output_errors_total
      operator: ">"
      threshold: 10
      rate: 5m
    duration: 5m
    annotations:
      summary: "Log Agent {{ .Instance }} 输出错误率过高"
      description: "输出错误率: {{ .Value }} 错误/秒"
    actions:
      - webhook

  # 缓冲区使用率告警
  - name: buffer_usage_high
    enabled: true
    severity: warning
    condition:
      metric: log_agent_buffer_disk_usage
      operator: ">"
      threshold: 0.8
      compare_metric: log_agent_buffer_disk_max_size
      operation: divide
    duration: 5m
    annotations:
      summary: "Log Agent {{ .Instance }} 缓冲区使用率过高"
      description: "缓冲区使用率: {{ .Value | percentage }}"
    actions:
      - webhook

  # 缓冲区满告警
  - name: buffer_full
    enabled: true
    severity: critical
    condition:
      metric: log_agent_buffer_disk_usage
      operator: ">"
      threshold: 0.95
      compare_metric: log_agent_buffer_disk_max_size
      operation: divide
    duration: 1m
    annotations:
      summary: "Log Agent {{ .Instance }} 缓冲区即将满"
      description: "缓冲区使用率: {{ .Value | percentage }}"
    actions:
      - webhook
      - email

  # CPU使用率告警
  - name: cpu_usage_high
    enabled: true
    severity: warning
    condition:
      metric: log_agent_cpu_usage_percent
      operator: ">"
      threshold: 80
    duration: 5m
    annotations:
      summary: "Log Agent {{ .Instance }} CPU使用率过高"
      description: "CPU使用率: {{ .Value }}%"
    actions:
      - webhook

  # 内存使用率告警
  - name: memory_usage_high
    enabled: true
    severity: warning
    condition:
      metric: log_agent_memory_usage_bytes
      operator: ">"
      threshold: 524288000  # 500MB
    duration: 5m
    annotations:
      summary: "Log Agent {{ .Instance }} 内存使用量过高"
      description: "内存使用量: {{ .Value | humanize }}B"
    actions:
      - webhook

  # 输出延迟告警
  - name: output_latency_high
    enabled: true
    severity: warning
    condition:
      metric: log_agent_output_latency_seconds
      operator: ">"
      threshold: 1
      percentile: 0.95
      rate: 5m
    duration: 5m
    annotations:
      summary: "Log Agent {{ .Instance }} 输出延迟过高"
      description: "P95延迟: {{ .Value }}秒"
    actions:
      - webhook

  # 自定义告警示例：文件采集停滞
  - name: file_collection_stalled
    enabled: true
    severity: warning
    condition:
      metric: log_agent_input_lines_total
      operator: "=="
      threshold: 0
      rate: 10m
    duration: 10m
    annotations:
      summary: "Log Agent {{ .Instance }} 文件采集停滞"
      description: "10分钟内未采集到任何日志"
    actions:
      - webhook

  # 自定义告警示例：日志采集速率异常下降
  - name: collection_rate_drop
    enabled: true
    severity: warning
    condition:
      metric: log_agent_input_lines_total
      operator: "<"
      threshold: 100
      rate: 5m
      compare_previous: true
      drop_percentage: 50
    duration: 5m
    annotations:
      summary: "Log Agent {{ .Instance }} 采集速率异常下降"
      description: "采集速率下降超过50%"
    actions:
      - webhook
```

**告警规则热更新实现**:
```go
// 告警管理器
type AlertManager struct {
    rules       atomic.Value  // *AlertRules
    evaluator   *AlertEvaluator
    notifier    *AlertNotifier
    rulesFile   string
    watcher     *fsnotify.Watcher
    config      atomic.Value
}

// 告警规则
type AlertRules struct {
    Rules []AlertRule `yaml:"rules"`
}

// 告警规则定义
type AlertRule struct {
    Name        string            `yaml:"name"`
    Enabled     bool              `yaml:"enabled"`
    Severity    string            `yaml:"severity"`
    Condition   AlertCondition    `yaml:"condition"`
    Duration    time.Duration     `yaml:"duration"`
    Annotations map[string]string `yaml:"annotations"`
    Actions     []string          `yaml:"actions"`
}

// 告警条件
type AlertCondition struct {
    Metric         string  `yaml:"metric"`
    Operator       string  `yaml:"operator"`
    Threshold      float64 `yaml:"threshold"`
    Rate           string  `yaml:"rate,omitempty"`
    Percentile     float64 `yaml:"percentile,omitempty"`
    CompareMetric  string  `yaml:"compare_metric,omitempty"`
    Operation      string  `yaml:"operation,omitempty"`
    ComparePrevious bool   `yaml:"compare_previous,omitempty"`
    DropPercentage float64 `yaml:"drop_percentage,omitempty"`
}

// 启动告警管理器
func (am *AlertManager) Start(ctx context.Context) error {
    // 1. 加载告警规则
    if err := am.loadRules(); err != nil {
        return fmt.Errorf("加载告警规则失败: %w", err)
    }
    
    // 2. 启动规则文件监控（热更新）
    if err := am.watchRulesFile(ctx); err != nil {
        log.Warn("启动规则文件监控失败", "error", err)
    }
    
    // 3. 启动告警评估器
    go am.evaluator.Start(ctx)
    
    log.Info("告警管理器已启动")
    return nil
}

// 加载告警规则
func (am *AlertManager) loadRules() error {
    // 读取规则文件
    data, err := ioutil.ReadFile(am.rulesFile)
    if err != nil {
        return fmt.Errorf("读取规则文件失败: %w", err)
    }
    
    // 解析规则
    var rules AlertRules
    if err := yaml.Unmarshal(data, &rules); err != nil {
        return fmt.Errorf("解析规则文件失败: %w", err)
    }
    
    // 验证规则
    if err := am.validateRules(&rules); err != nil {
        return fmt.Errorf("验证规则失败: %w", err)
    }
    
    // 原子更新规则
    am.rules.Store(&rules)
    
    log.Info("告警规则已加载", "rule_count", len(rules.Rules))
    return nil
}

// 监控规则文件变化（热更新）
func (am *AlertManager) watchRulesFile(ctx context.Context) error {
    var err error
    am.watcher, err = fsnotify.NewWatcher()
    if err != nil {
        return err
    }
    
    if err := am.watcher.Add(am.rulesFile); err != nil {
        return err
    }
    
    go func() {
        defer am.watcher.Close()
        
        for {
            select {
            case <-ctx.Done():
                return
                
            case event := <-am.watcher.Events:
                if event.Op&fsnotify.Write == fsnotify.Write {
                    log.Info("检测到告警规则文件变化")
                    
                    // 等待文件写入完成
                    time.Sleep(time.Second)
                    
                    // 重新加载规则
                    if err := am.loadRules(); err != nil {
                        log.Error("重新加载告警规则失败", "error", err)
                    } else {
                        log.Info("告警规则已热更新")
                        
                        // 记录审计日志
                        am.logRuleChange()
                    }
                }
                
            case err := <-am.watcher.Errors:
                log.Error("规则文件监控错误", "error", err)
            }
        }
    }()
    
    return nil
}

// 验证告警规则
func (am *AlertManager) validateRules(rules *AlertRules) error {
    for i, rule := range rules.Rules {
        // 验证规则名称
        if rule.Name == "" {
            return fmt.Errorf("规则[%d]: 名称不能为空", i)
        }
        
        // 验证严重级别
        validSeverities := map[string]bool{
            "critical": true,
            "warning":  true,
            "info":     true,
        }
        if !validSeverities[rule.Severity] {
            return fmt.Errorf("规则[%s]: 无效的严重级别: %s", rule.Name, rule.Severity)
        }
        
        // 验证条件
        if rule.Condition.Metric == "" {
            return fmt.Errorf("规则[%s]: 指标不能为空", rule.Name)
        }
        
        // 验证操作符
        validOperators := map[string]bool{
            ">": true, "<": true, ">=": true, "<=": true, "==": true, "!=": true,
        }
        if !validOperators[rule.Condition.Operator] {
            return fmt.Errorf("规则[%s]: 无效的操作符: %s", rule.Name, rule.Condition.Operator)
        }
        
        // 验证持续时间
        if rule.Duration < 0 {
            return fmt.Errorf("规则[%s]: 持续时间不能为负数", rule.Name)
        }
    }
    
    return nil
}

// 告警评估器
type AlertEvaluator struct {
    manager  *AlertManager
    metrics  *MetricsCollector
    interval time.Duration
}

// 启动评估器
func (ae *AlertEvaluator) Start(ctx context.Context) {
    ticker := time.NewTicker(ae.interval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            ae.evaluate()
        }
    }
}

// 评估告警规则
func (ae *AlertEvaluator) evaluate() {
    rules := ae.manager.rules.Load().(*AlertRules)
    
    for _, rule := range rules.Rules {
        // 跳过禁用的规则
        if !rule.Enabled {
            continue
        }
        
        // 获取指标值
        value, err := ae.metrics.GetMetricValue(rule.Condition.Metric)
        if err != nil {
            log.Error("获取指标值失败", "rule", rule.Name, "error", err)
            continue
        }
        
        // 评估条件
        if ae.evaluateCondition(&rule.Condition, value) {
            // 触发告警
            ae.manager.notifier.Send(&Alert{
                Rule:        rule,
                Value:       value,
                Timestamp:   time.Now(),
                Instance:    ae.manager.config.Load().(*Config).Agent.Name,
            })
        }
    }
}

// 评估条件
func (ae *AlertEvaluator) evaluateCondition(cond *AlertCondition, value float64) bool {
    switch cond.Operator {
    case ">":
        return value > cond.Threshold
    case "<":
        return value < cond.Threshold
    case ">=":
        return value >= cond.Threshold
    case "<=":
        return value <= cond.Threshold
    case "==":
        return value == cond.Threshold
    case "!=":
        return value != cond.Threshold
    default:
        return false
    }
}
```

**告警规则热更新验收标准**:

1. ✅ 修改告警规则文件后自动重新加载（无需重启Agent）
2. ✅ 规则验证失败时保持原规则并记录错误
3. ✅ 支持动态启用/禁用告警规则
4. ✅ 支持动态调整告警阈值
5. ✅ 支持动态添加/删除告警规则
6. ✅ 规则变更后记录审计日志
7. ✅ 热更新时间 < 1秒
8. ✅ 热更新不影响正在进行的告警评估

**Prometheus告警规则（可选）**:

如果使用Prometheus进行告警，可以配置Prometheus告警规则文件，由Prometheus负责告警评估和通知。

### 10.3 日志规范

**日志级别**:
- DEBUG: 调试信息，仅开发环境使用
- INFO: 一般信息，正常运行日志
- WARNING: 警告信息，可能的问题
- ERROR: 错误信息，需要关注
- FATAL: 致命错误，程序退出

**日志格式**:
```json
{
  "timestamp": "2024-01-31T10:30:45.123Z",
  "level": "INFO",
  "logger": "file_watcher",
  "message": "文件监控已启动",
  "fields": {
    "file_count": 10,
    "paths": ["/var/log/nginx/*.log"]
  }
}
```

**日志输出**:
```go
// 结构化日志
log.Info("文件监控已启动",
    "file_count", 10,
    "paths", []string{"/var/log/nginx/*.log"},
)

// 错误日志
log.Error("读取文件失败",
    "path", "/var/log/app.log",
    "error", err,
)
```

### 10.4 运维手册

**常见问题排查**:

1. **Agent无法启动**:
```bash
# 检查配置文件
log-agent --config /etc/log-agent/config.yaml --validate

# 检查日志
journalctl -u log-agent -n 100

# 检查端口占用
netstat -tlnp | grep log-agent
```

2. **日志采集延迟高**:
```bash
# 检查缓冲区使用率
curl http://localhost:8080/health | jq '.buffer'

# 检查网络连接
curl http://localhost:8080/health | jq '.outputs'

# 检查CPU和内存
top -p $(pidof log-agent)
```

3. **日志丢失**:
```bash
# 检查输入错误
curl http://localhost:9100/metrics | grep input_errors

# 检查输出错误
curl http://localhost:9100/metrics | grep output_errors

# 检查缓冲区
ls -lh /var/lib/log-agent/buffer.db
```

**性能调优**:

1. **提高吞吐量**:
```yaml
# 增加批次大小
outputs:
  kafka:
    batch_size: 2000  # 默认1000
    linger_ms: 200    # 默认100

# 增加内存缓冲
buffer:
  memory_size: 20000  # 默认10000
```

2. **降低延迟**:
```yaml
# 减少批次大小
outputs:
  kafka:
    batch_size: 100
    linger_ms: 10

# 减少刷新间隔
buffer:
  flush_interval: 1  # 默认5秒
```

3. **降低资源占用**:
```yaml
# 减少内存缓冲
buffer:
  memory_size: 5000

# 限制并发数
processing:
  workers: 2  # 默认4
```

**备份与恢复**:

1. **备份检查点**:
```bash
# 备份BoltDB文件
cp /var/lib/log-agent/buffer.db /backup/buffer.db.$(date +%Y%m%d)
```

2. **恢复检查点**:
```bash
# 停止Agent
systemctl stop log-agent

# 恢复BoltDB文件
cp /backup/buffer.db.20240131 /var/lib/log-agent/buffer.db

# 启动Agent
systemctl start log-agent
```

**日常维护**:

1. **清理旧数据**:
```bash
# 清理超过7天的备份
find /backup -name "buffer.db.*" -mtime +7 -delete

# 清理日志文件
find /var/log/log-agent -name "*.log" -mtime +30 -delete
```

2. **健康检查**:
```bash
# 每日健康检查脚本
#!/bin/bash
HEALTH_URL="http://localhost:8080/health"
STATUS=$(curl -s $HEALTH_URL | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
    echo "Log Agent不健康: $STATUS"
    # 发送告警
    curl -X POST https://alert.example.com/webhook \
        -d "Log Agent健康检查失败"
fi
```

3. **性能监控**:
```bash
# 每小时性能检查脚本
#!/bin/bash
METRICS_URL="http://localhost:9100/metrics"

# 检查输入速率
INPUT_RATE=$(curl -s $METRICS_URL | grep input_lines_total | awk '{sum+=$2} END {print sum}')

# 检查输出速率
OUTPUT_RATE=$(curl -s $METRICS_URL | grep output_messages_total | awk '{sum+=$2} END {print sum}')

echo "输入速率: $INPUT_RATE 条/小时"
echo "输出速率: $OUTPUT_RATE 条/小时"
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 热更新支持 |
|--------|------|--------|------|-----------|
| **文件监控** |
| file_paths | array | [] | 监控的文件路径列表 | ✅ 支持 |
| multiline_pattern | string | "" | 多行日志起始模式（正则） | ✅ 支持 |
| max_line_length | int | 1048576 | 最大行长度（字节） | ✅ 支持 |
| buffer_size | int | 65536 | 读取缓冲区大小 | ✅ 支持 |
| checkpoint_interval | int | 5 | 检查点保存间隔（秒） | ✅ 支持 |
| **容器监控** |
| docker_enabled | bool | true | 是否启用Docker采集 | ✅ 支持 |
| docker_socket | string | /var/run/docker.sock | Docker Socket路径 | ❌ 需重启 |
| docker_include_labels | map | {} | 包含标签过滤 | ✅ 支持 |
| docker_exclude_labels | map | {} | 排除标签过滤 | ✅ 支持 |
| k8s_enabled | bool | false | 是否启用Kubernetes采集 | ❌ 需重启 |
| k8s_namespaces | array | ["default"] | 监控的命名空间列表 | ✅ 支持 |
| **数据库监控** |
| mysql_slow_threshold | float | 1.0 | 慢查询阈值（秒） | ✅ 支持 |
| mysql_slow_log_path | string | /var/log/mysql/slow.log | MySQL慢查询日志路径 | ✅ 支持 |
| **Syslog服务器** |
| syslog_udp_enabled | bool | true | 是否启用UDP Syslog | ❌ 需重启 |
| syslog_udp_port | int | 514 | UDP端口 | ❌ 需重启 |
| syslog_tcp_enabled | bool | true | 是否启用TCP Syslog | ❌ 需重启 |
| syslog_tcp_port | int | 514 | TCP端口 | ❌ 需重启 |
| **云服务** |
| aws_poll_interval | int | 60 | AWS日志拉取间隔（秒） | ✅ 支持 |
| aws_log_groups | array | [] | AWS日志组列表 | ✅ 支持 |
| **IoT设备** |
| mqtt_topics | array | [] | MQTT订阅主题列表 | ✅ 支持 |
| mqtt_qos | int | 1 | MQTT QoS级别 | ✅ 支持 |
| **系统日志** |
| journald_units | array | [] | systemd单元列表 | ✅ 支持 |
| eventlog_channels | array | ["Application","System"] | Windows事件日志通道 | ✅ 支持 |
| **缓冲配置** |
| buffer_memory_size | int | 10000 | 内存队列大小 | ✅ 支持 |
| buffer_flush_interval | int | 5 | 刷新间隔（秒） | ✅ 支持 |
| **输出配置** |
| kafka_batch_size | int | 1000 | Kafka批次大小 | ✅ 支持 |
| kafka_linger_ms | int | 100 | Kafka等待时间（毫秒） | ✅ 支持 |
| kafka_compression | string | lz4 | Kafka压缩算法 | ✅ 支持 |
| http_batch_size | int | 100 | HTTP批次大小 | ✅ 支持 |
| http_timeout | duration | 30s | HTTP超时时间 | ✅ 支持 |
| **告警配置** |
| alert_rules_file | string | /etc/log-agent/alert_rules.yaml | 告警规则文件路径 | ✅ 支持（文件监控） |
| alert_enabled | bool | true | 是否启用告警 | ✅ 支持 |
| alert_evaluation_interval | duration | 30s | 告警评估间隔 | ✅ 支持 |
| alert_notifications | array | [] | 告警通知配置 | ✅ 支持 |
| **日志配置** |
| log_level | string | info | 日志级别 | ✅ 支持 |

**告警规则热更新说明**:

告警规则支持两种热更新方式：

1. **文件监控自动更新**（推荐）:
   - 修改 `/etc/log-agent/alert_rules.yaml` 文件
   - Agent自动检测文件变化并重新加载
   - 无需手动触发，1秒内生效

2. **SIGHUP信号触发**:
   - 修改告警规则文件后发送 `kill -HUP $(pidof log-agent)`
   - Agent重新加载所有配置（包括告警规则）
   - 适用于批量配置更新

3. **HTTP API触发**:
   - `curl -X POST http://localhost:8080/reload`
   - 适用于自动化脚本

### 11.2 热更新实现机制

**方式1: SIGHUP信号触发**:
```go
// 信号处理器
func (a *Agent) setupSignalHandler() {
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGHUP)
    
    go func() {
        for sig := range sigChan {
            if sig == syscall.SIGHUP {
                log.Info("收到SIGHUP信号，重新加载配置")
                if err := a.reloadConfig(); err != nil {
                    log.Error("重新加载配置失败", "error", err)
                } else {
                    log.Info("配置重新加载成功")
                }
            }
        }
    }()
}

// 配置重新加载
func (a *Agent) reloadConfig() error {
    // 1. 读取配置文件
    newConfig, err := loadConfig(a.configPath)
    if err != nil {
        return fmt.Errorf("读取配置文件失败: %w", err)
    }
    
    // 2. 验证配置
    if err := newConfig.Validate(); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 3. 原子更新配置
    a.config.Store(newConfig)
    
    // 4. 应用配置变更
    if err := a.applyConfigChanges(newConfig); err != nil {
        return fmt.Errorf("应用配置失败: %w", err)
    }
    
    // 5. 记录审计日志
    a.logConfigChange(a.config.Load().(*Config), newConfig)
    
    return nil
}

// 应用配置变更
func (a *Agent) applyConfigChanges(newConfig *Config) error {
    oldConfig := a.config.Load().(*Config)
    
    // 更新文件监控路径
    if !reflect.DeepEqual(oldConfig.Inputs.File.Paths, newConfig.Inputs.File.Paths) {
        log.Info("更新文件监控路径")
        a.fileWatcher.UpdatePaths(newConfig.Inputs.File.Paths)
    }
    
    // 更新容器标签过滤
    if !reflect.DeepEqual(oldConfig.Inputs.Docker.IncludeLabels, newConfig.Inputs.Docker.IncludeLabels) {
        log.Info("更新容器标签过滤")
        a.containerCollector.UpdateLabelFilters(newConfig.Inputs.Docker.IncludeLabels, newConfig.Inputs.Docker.ExcludeLabels)
    }
    
    // 更新输出配置
    if !reflect.DeepEqual(oldConfig.Outputs.Kafka, newConfig.Outputs.Kafka) {
        log.Info("更新Kafka输出配置")
        a.outputManager.UpdateKafkaConfig(newConfig.Outputs.Kafka)
    }
    
    // 更新日志级别
    if oldConfig.Logging.Level != newConfig.Logging.Level {
        log.Info("更新日志级别", "old", oldConfig.Logging.Level, "new", newConfig.Logging.Level)
        a.updateLogLevel(newConfig.Logging.Level)
    }
    
    return nil
}
```

**方式2: HTTP API触发**:
```go
// HTTP API端点
func (a *Agent) handleReload(w http.ResponseWriter, r *http.Request) {
    if r.Method != http.MethodPost {
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
        return
    }
    
    log.Info("收到配置重新加载请求")
    
    if err := a.reloadConfig(); err != nil {
        log.Error("重新加载配置失败", "error", err)
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    w.WriteHeader(http.StatusOK)
    json.NewEncoder(w).Encode(map[string]string{
        "status": "success",
        "message": "配置重新加载成功",
    })
}
```

**方式3: 配置文件监控**:
```go
// 监控配置文件变化
func (a *Agent) watchConfigFile() {
    watcher, err := fsnotify.NewWatcher()
    if err != nil {
        log.Error("创建配置文件监控器失败", "error", err)
        return
    }
    defer watcher.Close()
    
    if err := watcher.Add(a.configPath); err != nil {
        log.Error("添加配置文件监控失败", "error", err)
        return
    }
    
    for {
        select {
        case event := <-watcher.Events:
            if event.Op&fsnotify.Write == fsnotify.Write {
                log.Info("检测到配置文件变化")
                time.Sleep(time.Second) // 等待文件写入完成
                if err := a.reloadConfig(); err != nil {
                    log.Error("重新加载配置失败", "error", err)
                }
            }
        case err := <-watcher.Errors:
            log.Error("配置文件监控错误", "error", err)
        }
    }
}
```

### 11.3 配置验证

```go
// 配置验证
func (c *Config) Validate() error {
    // 验证Agent配置
    if c.Agent.Name == "" {
        return fmt.Errorf("agent.name不能为空")
    }
    
    // 验证文件路径
    for _, path := range c.Inputs.File.Paths {
        if _, err := filepath.Glob(path); err != nil {
            return fmt.Errorf("无效的文件路径: %s", path)
        }
    }
    
    // 验证正则表达式
    if c.Inputs.File.MultilinePattern != "" {
        if _, err := regexp.Compile(c.Inputs.File.MultilinePattern); err != nil {
            return fmt.Errorf("无效的多行模式: %w", err)
        }
    }
    
    // 验证端口范围
    if c.Inputs.Syslog.UDP.Port < 1 || c.Inputs.Syslog.UDP.Port > 65535 {
        return fmt.Errorf("无效的UDP端口: %d", c.Inputs.Syslog.UDP.Port)
    }
    
    // 验证Kafka配置
    if c.Outputs.Kafka.Enabled {
        if len(c.Outputs.Kafka.Brokers) == 0 {
            return fmt.Errorf("Kafka brokers不能为空")
        }
        if c.Outputs.Kafka.Topic == "" {
            return fmt.Errorf("Kafka topic不能为空")
        }
    }
    
    // 验证缓冲配置
    if c.Buffer.MemorySize < 100 {
        return fmt.Errorf("内存缓冲大小不能小于100")
    }
    if c.Buffer.DiskMaxSize < 1024*1024 {
        return fmt.Errorf("磁盘缓冲大小不能小于1MB")
    }
    
    return nil
}
```

### 11.4 热更新验收标准

1. **功能验收**:
   - ✅ 系统在收到SIGHUP信号后能够重新加载配置
   - ✅ 配置无效时保持原配置并记录错误日志
   - ✅ 支持动态添加/删除文件监控路径
   - ✅ 支持动态调整容器标签过滤规则
   - ✅ 支持动态调整输出批次大小和压缩算法
   - ✅ 配置变更后记录审计日志

2. **性能验收**:
   - ✅ 配置重新加载时间 < 1秒
   - ✅ 配置重新加载期间不丢失日志
   - ✅ 配置重新加载不影响正在进行的日志传输

3. **安全验收**:
   - ✅ 配置文件权限检查（必须是600或400）
   - ✅ 配置变更记录审计日志
   - ✅ 敏感配置（密码、Token）不记录到日志

4. **稳定性验收**:
   - ✅ 配置验证失败时不影响当前运行
   - ✅ 配置重新加载失败时自动回滚
   - ✅ 连续多次配置重新加载不导致内存泄漏

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 文件监控失效 | 低 | 高 | 定期健康检查，自动重启监控 |
| 网络连接中断 | 中 | 高 | 本地缓冲，自动重连，断点续传 |
| 磁盘空间不足 | 中 | 高 | 磁盘使用率监控，自动清理旧数据 |
| 内存泄漏 | 低 | 中 | 定期GC，内存使用监控，自动重启 |
| CPU占用过高 | 低 | 中 | CPU限制，降级处理，告警通知 |
| 配置错误 | 中 | 中 | 配置验证，热更新失败回滚 |
| 日志丢失 | 低 | 高 | 检查点机制，持久化缓冲，at-least-once保证 |
| 日志重复 | 中 | 低 | 幂等性设计，去重机制 |
| 证书过期 | 低 | 高 | 证书过期监控，自动告警 |
| 依赖服务故障 | 中 | 高 | 降级处理，本地缓冲，重试机制 |

### 12.2 故障处理策略

**1. 文件监控失效**:
```go
// 健康检查
func (fw *FileWatcher) HealthCheck() error {
    // 检查监控器是否正常
    if fw.watcher == nil {
        return fmt.Errorf("文件监控器未初始化")
    }
    
    // 检查最后活动时间
    if time.Since(fw.lastActivity) > 5*time.Minute {
        return fmt.Errorf("文件监控器无活动超过5分钟")
    }
    
    return nil
}

// 自动恢复
func (fw *FileWatcher) autoRecover() {
    ticker := time.NewTicker(time.Minute)
    defer ticker.Stop()
    
    for range ticker.C {
        if err := fw.HealthCheck(); err != nil {
            log.Error("文件监控健康检查失败", "error", err)
            log.Info("尝试重启文件监控")
            
            // 停止旧监控器
            fw.Stop()
            
            // 启动新监控器
            if err := fw.Start(context.Background(), fw.paths); err != nil {
                log.Error("重启文件监控失败", "error", err)
            } else {
                log.Info("文件监控重启成功")
            }
        }
    }
}
```

**2. 网络连接中断**:
```go
// 连接重试
func (ko *KafkaOutput) sendWithRetry(ctx context.Context, entries []*LogEntry) error {
    backoff := time.Second
    maxBackoff := time.Minute
    
    for attempt := 0; attempt < 10; attempt++ {
        err := ko.Send(ctx, entries)
        if err == nil {
            return nil
        }
        
        // 检查是否为网络错误
        if isNetworkError(err) {
            log.Warn("网络连接失败，等待重试",
                "attempt", attempt+1,
                "backoff", backoff,
                "error", err,
            )
            
            // 写入本地缓冲
            ko.buffer.WriteAll(entries)
            
            // 指数退避
            time.Sleep(backoff)
            backoff *= 2
            if backoff > maxBackoff {
                backoff = maxBackoff
            }
            continue
        }
        
        // 非网络错误，直接返回
        return err
    }
    
    return fmt.Errorf("重试次数已用尽")
}
```

**3. 磁盘空间不足**:
```go
// 磁盘空间检查
func (b *Buffer) checkDiskSpace() error {
    usage, err := getDiskUsage(b.diskPath)
    if err != nil {
        return err
    }
    
    // 磁盘使用率超过90%
    if usage > 0.9 {
        log.Warn("磁盘使用率过高，开始清理", "usage", usage)
        
        // 清理最旧的数据
        if err := b.cleanOldData(); err != nil {
            return fmt.Errorf("清理旧数据失败: %w", err)
        }
    }
    
    // 磁盘使用率超过95%
    if usage > 0.95 {
        return fmt.Errorf("磁盘空间不足: %.2f%%", usage*100)
    }
    
    return nil
}

// 清理旧数据
func (b *Buffer) cleanOldData() error {
    // 删除最旧的10%数据
    return b.db.Update(func(tx *bolt.Tx) error {
        bucket := tx.Bucket([]byte("buffer"))
        if bucket == nil {
            return nil
        }
        
        // 计算要删除的数量
        count := bucket.Stats().KeyN
        deleteCount := count / 10
        
        // 删除最旧的数据
        c := bucket.Cursor()
        for i := 0; i < deleteCount; i++ {
            k, _ := c.First()
            if k == nil {
                break
            }
            bucket.Delete(k)
        }
        
        return nil
    })
}
```

### 12.3 回滚方案

**1. 配置回滚**:
```bash
# 自动回滚脚本
#!/bin/bash

CONFIG_FILE="/etc/log-agent/config.yaml"
BACKUP_FILE="/etc/log-agent/config.yaml.bak"

# 备份当前配置
cp $CONFIG_FILE $BACKUP_FILE

# 应用新配置
cp $NEW_CONFIG_FILE $CONFIG_FILE

# 重新加载配置
systemctl reload log-agent

# 等待5秒
sleep 5

# 检查健康状态
HEALTH=$(curl -s http://localhost:8080/health | jq -r '.status')

if [ "$HEALTH" != "healthy" ]; then
    echo "健康检查失败，回滚配置"
    
    # 恢复旧配置
    cp $BACKUP_FILE $CONFIG_FILE
    
    # 重新加载配置
    systemctl reload log-agent
    
    echo "配置已回滚"
    exit 1
fi

echo "配置更新成功"
```

**2. 版本回滚**:
```bash
# 版本回滚脚本
#!/bin/bash

OLD_VERSION="v1.0.0"
NEW_VERSION="v1.1.0"

# 停止服务
systemctl stop log-agent

# 备份新版本
cp /usr/local/bin/log-agent /usr/local/bin/log-agent.$NEW_VERSION

# 恢复旧版本
cp /usr/local/bin/log-agent.$OLD_VERSION /usr/local/bin/log-agent

# 启动服务
systemctl start log-agent

# 检查状态
sleep 5
systemctl status log-agent

# 检查健康状态
curl http://localhost:8080/health
```

**3. 数据回滚**:
```bash
# 检查点回滚
#!/bin/bash

BUFFER_FILE="/var/lib/log-agent/buffer.db"
BACKUP_FILE="/backup/buffer.db.$(date +%Y%m%d)"

# 停止服务
systemctl stop log-agent

# 恢复检查点
cp $BACKUP_FILE $BUFFER_FILE

# 启动服务
systemctl start log-agent

echo "检查点已恢复"
```

### 12.4 应急预案

**1. Agent完全失效**:
```
应急措施:
1. 立即切换到备用Agent
2. 检查日志文件，确认问题原因
3. 如果是配置问题，回滚配置
4. 如果是版本问题，回滚版本
5. 如果是数据问题，恢复检查点
6. 重启Agent
7. 验证日志采集恢复正常
```

**2. 大量日志丢失**:
```
应急措施:
1. 检查Agent状态和日志
2. 检查网络连接
3. 检查中央服务器状态
4. 检查本地缓冲区
5. 如果缓冲区有数据，等待自动重传
6. 如果缓冲区已清空，从检查点重新采集
7. 记录事故报告
```

**3. 性能严重下降**:
```
应急措施:
1. 检查CPU和内存使用率
2. 检查磁盘IO
3. 检查网络带宽
4. 临时降低采集频率
5. 临时减少监控文件数量
6. 临时增加批次大小
7. 分析性能瓶颈
8. 制定优化方案
```

**4. 安全事件**:
```
应急措施:
1. 立即停止Agent
2. 检查是否有未授权访问
3. 检查配置文件是否被篡改
4. 检查证书是否泄露
5. 更换证书和密钥
6. 加固安全配置
7. 重启Agent
8. 记录安全事件
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| Agent | 日志采集代理，部署在被监控端的轻量级程序 |
| Checkpoint | 检查点，记录日志采集位置，用于断点续传 |
| inode | 文件索引节点，用于唯一标识文件，检测文件轮转 |
| Ring Buffer | 环形缓冲区，固定大小的循环队列 |
| BoltDB | 嵌入式键值数据库，用于本地持久化 |
| fsnotify | 跨平台文件系统监控库 |
| at-least-once | 至少一次语义，保证消息至少被传输一次 |
| 文件轮转 | 日志文件达到一定大小或时间后，创建新文件，旧文件重命名或压缩 |
| 多行日志 | 一条日志跨越多行，如Java堆栈跟踪 |
| 批量发送 | 累积多条日志后一次性发送，提高吞吐量 |
| 压缩传输 | 对日志数据进行压缩后传输，减少网络带宽 |
| TLS | 传输层安全协议，用于加密网络传输 |
| SASL | 简单认证与安全层，用于Kafka认证 |
| Syslog | 标准日志协议，广泛用于网络设备 |
| MQTT | 消息队列遥测传输协议，用于IoT设备 |
| CoAP | 受限应用协议，用于资源受限的IoT设备 |
| systemd journal | Linux系统日志服务 |
| Event Log | Windows事件日志系统 |
| Unified Logging | macOS统一日志系统 |
| Prometheus | 开源监控系统，用于指标采集 |
| Grafana | 开源可视化平台，用于指标展示 |

### 13.2 参考文档

**官方文档**:
- [Go语言官方文档](https://golang.org/doc/)
- [fsnotify文档](https://github.com/fsnotify/fsnotify)
- [BoltDB文档](https://github.com/etcd-io/bbolt)
- [Kafka Go客户端文档](https://github.com/confluentinc/confluent-kafka-go)
- [Docker API文档](https://docs.docker.com/engine/api/)
- [Kubernetes API文档](https://kubernetes.io/docs/reference/kubernetes-api/)

**RFC标准**:
- [RFC 3164 - BSD Syslog Protocol](https://tools.ietf.org/html/rfc3164)
- [RFC 5424 - Syslog Protocol](https://tools.ietf.org/html/rfc5424)
- [RFC 5246 - TLS 1.2](https://tools.ietf.org/html/rfc5246)
- [RFC 8446 - TLS 1.3](https://tools.ietf.org/html/rfc8446)

**最佳实践**:
- [The Twelve-Factor App](https://12factor.net/)
- [Logging Best Practices](https://www.loggly.com/ultimate-guide/logging-best-practices/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)

**相关项目**:
- [Filebeat](https://www.elastic.co/beats/filebeat) - Elastic的日志采集器
- [Fluentd](https://www.fluentd.org/) - 开源日志收集器
- [Logstash](https://www.elastic.co/logstash) - Elastic的日志处理工具
- [Vector](https://vector.dev/) - 高性能日志路由器

### 13.3 配置示例

**最小配置示例**:
```yaml
agent:
  name: "log-agent-01"

inputs:
  file:
    enabled: true
    paths:
      - /var/log/*.log

outputs:
  kafka:
    enabled: true
    brokers:
      - localhost:9092
    topic: logs
```

**生产环境配置示例**:
```yaml
agent:
  name: "log-agent-prod-01"
  hostname: "web-server-01"
  tags:
    env: "production"
    region: "us-east-1"
    datacenter: "dc1"

inputs:
  file:
    enabled: true
    paths:
      - /var/log/nginx/*.log
      - /var/log/app/*.log
    multiline_pattern: "^\\d{4}-\\d{2}-\\d{2}"
    max_line_length: 1048576
    buffer_size: 65536
    checkpoint_interval: 5

  docker:
    enabled: true
    socket: /var/run/docker.sock
    include_labels:
      log_collection: "enabled"

  syslog:
    udp:
      enabled: true
      port: 514
    tcp:
      enabled: true
      port: 514
    tls:
      enabled: true
      port: 6514
      cert_file: /etc/log-agent/certs/server.crt
      key_file: /etc/log-agent/certs/server.key
      ca_file: /etc/log-agent/certs/ca.crt

buffer:
  memory_size: 10000
  disk_path: /var/lib/log-agent/buffer.db
  disk_max_size: 1073741824
  flush_interval: 5

outputs:
  kafka:
    enabled: true
    brokers:
      - kafka1.example.com:9092
      - kafka2.example.com:9092
      - kafka3.example.com:9092
    topic: logs-production
    compression: lz4
    batch_size: 1000
    linger_ms: 100
    tls:
      enabled: true
      ca_file: /etc/log-agent/certs/kafka-ca.crt
      cert_file: /etc/log-agent/certs/kafka-client.crt
      key_file: /etc/log-agent/certs/kafka-client.key
    sasl:
      enabled: true
      mechanism: SCRAM-SHA-512
      username: "log-agent"
      password: "${KAFKA_PASSWORD}"

monitoring:
  prometheus:
    enabled: true
    port: 9100
    path: /metrics
  health_check:
    enabled: true
    port: 8080
    path: /health

alerting:
  enabled: true
  rules_file: /etc/log-agent/alert_rules.yaml
  evaluation_interval: 30s
  notifications:
    - type: webhook
      url: https://alert.example.com/webhook
      enabled: true
    - type: email
      smtp_host: smtp.example.com
      smtp_port: 587
      username: alert@example.com
      password: "${SMTP_PASSWORD}"
      from: alert@example.com
      to:
        - ops@example.com
      enabled: true

logging:
  level: info
  format: json
  output: stdout
```

**自定义告警规则示例**:
```yaml
# 文件: /etc/log-agent/alert_rules.yaml
# 此文件支持热更新，修改后自动生效

rules:
  # 基础告警
  - name: agent_down
    enabled: true
    severity: critical
    condition:
      metric: up
      operator: "=="
      threshold: 0
    duration: 1m
    annotations:
      summary: "Log Agent离线"
      description: "Agent已离线超过1分钟"
    actions:
      - webhook
      - email

  # 性能告警
  - name: high_cpu_usage
    enabled: true
    severity: warning
    condition:
      metric: log_agent_cpu_usage_percent
      operator: ">"
      threshold: 80
    duration: 5m
    annotations:
      summary: "CPU使用率过高"
      description: "CPU使用率持续5分钟超过80%"
    actions:
      - webhook

  # 业务告警
  - name: error_log_spike
    enabled: true
    severity: warning
    condition:
      metric: log_agent_input_lines_total
      operator: ">"
      threshold: 1000
      rate: 1m
      filter:
        level: "ERROR"
    duration: 2m
    annotations:
      summary: "错误日志激增"
      description: "1分钟内错误日志超过1000条"
    actions:
      - webhook
      - slack

  # 自定义业务告警
  - name: payment_failure_rate_high
    enabled: true
    severity: critical
    condition:
      metric: log_agent_input_lines_total
      operator: ">"
      threshold: 10
      rate: 5m
      filter:
        message_contains: "payment failed"
    duration: 5m
    annotations:
      summary: "支付失败率过高"
      description: "5分钟内支付失败超过10次"
    actions:
      - webhook
      - email
      - slack
```

### 13.4 故障排查清单

**Agent无法启动**:
- [ ] 检查配置文件语法是否正确
- [ ] 检查配置文件权限（应为600）
- [ ] 检查端口是否被占用
- [ ] 检查证书文件是否存在
- [ ] 检查数据目录权限
- [ ] 查看systemd日志

**日志采集延迟高**:
- [ ] 检查CPU使用率
- [ ] 检查内存使用率
- [ ] 检查磁盘IO
- [ ] 检查网络延迟
- [ ] 检查缓冲区使用率
- [ ] 检查批次大小配置

**日志丢失**:
- [ ] 检查输入错误计数
- [ ] 检查输出错误计数
- [ ] 检查缓冲区是否满
- [ ] 检查网络连接
- [ ] 检查检查点是否正常
- [ ] 检查文件轮转是否正常

**资源占用过高**:
- [ ] 检查监控文件数量
- [ ] 检查日志量
- [ ] 检查批次大小
- [ ] 检查压缩算法
- [ ] 检查内存队列大小
- [ ] 检查是否有内存泄漏

### 13.5 性能调优建议

**提高吞吐量**:
1. 增加批次大小（batch_size）
2. 增加等待时间（linger_ms）
3. 使用更快的压缩算法（lz4）
4. 增加内存队列大小
5. 增加Worker数量

**降低延迟**:
1. 减少批次大小
2. 减少等待时间
3. 禁用压缩
4. 减少刷新间隔
5. 使用gRPC流式传输

**降低资源占用**:
1. 减少内存队列大小
2. 减少监控文件数量
3. 使用更高效的压缩算法
4. 限制CPU核心数
5. 定期触发GC

### 13.6 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| | | - 完成总体架构设计 | |
| | | - 完成技术选型 | |
| | | - 完成关键流程设计 | |
| | | - 完成接口设计 | |
| | | - 完成数据设计 | |
| | | - 完成安全设计 | |
| | | - 完成性能设计 | |
| | | - 完成部署方案 | |
| | | - 完成监控运维方案 | |
| | | - 完成配置热更新设计 | |
| | | - 完成风险与回滚方案 | |

---

**文档结束**
