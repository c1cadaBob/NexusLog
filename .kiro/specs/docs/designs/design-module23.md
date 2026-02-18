# 模块23：边缘计算 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module23.md](../requirements/requirements-module23.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: Phase 3

### 1.3 相关文档
- [需求文档](../requirements/requirements-module23.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块1设计文档](./design-module1.md) - 日志采集
- [模块2设计文档](./design-module2.md) - 日志存储

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            边缘计算整体架构                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            云端层（Cloud Layer）                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  核心服务                                                                      │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │  Kafka   │  │    ES    │  │  MinIO   │  │   PG     │                      │   │ │
│  │  │  │ 消息队列  │  │ 日志存储  │  │ 对象存储  │  │ 元数据   │                      │   │ │
│  │  │  └────▲─────┘  └────▲─────┘  └────▲─────┘  └────▲─────┘                      │   │ │
│  │  │       │             │             │             │                             │   │ │
│  │  │  ┌────┴─────────────┴─────────────┴─────────────┴────┐                       │   │ │
│  │  │  │              Edge Gateway                          │                       │   │ │
│  │  │  │  ┌──────────────────────────────────────────────┐ │                       │   │ │
│  │  │  │  │  边缘节点管理                                │ │                       │   │ │
│  │  │  │  │  • 节点注册/认证                             │ │                       │   │ │
│  │  │  │  │  • 节点状态监控                              │ │                       │   │ │
│  │  │  │  │  • 节点分组管理                              │ │                       │   │ │
│  │  │  │  └──────────────────────────────────────────────┘ │                       │   │ │
│  │  │  │  ┌──────────────────────────────────────────────┐ │                       │   │ │
│  │  │  │  │  配置管理                                    │ │                       │   │ │
│  │  │  │  │  • 配置下发（MQTT/HTTPS）                    │ │                       │   │ │
│  │  │  │  │  • 配置版本管理                              │ │                       │   │ │
│  │  │  │  │  • 配置热更新                                │ │                       │   │ │
│  │  │  │  └──────────────────────────────────────────────┘ │                       │   │ │
│  │  │  │  ┌──────────────────────────────────────────────┐ │                       │   │ │
│  │  │  │  │  数据接收                                    │ │                       │   │ │
│  │  │  │  │  • HTTPS接收                                 │ │                       │   │ │
│  │  │  │  │  • MQTT接收                                  │ │                       │   │ │
│  │  │  │  │  • 数据聚合                                  │ │                       │   │ │
│  │  │  │  └──────────────────────────────────────────────┘ │                       │   │ │
│  │  │  │  ┌──────────────────────────────────────────────┐ │                       │   │ │
│  │  │  │  │  远程管理                                    │ │                       │   │ │
│  │  │  │  │  • 远程升级                                  │ │                       │   │ │
│  │  │  │  │  • 远程诊断                                  │ │                       │   │ │
│  │  │  │  │  • 远程重启                                  │ │                       │   │ │
│  │  │  │  └──────────────────────────────────────────────┘ │                       │   │ │
│  │  │  └────────────────────────────────────────────────────┘                       │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          │ HTTPS/MQTT/TLS                                  │
│                                          │                                                 │
│  ┌───────────────────────────────────────┴───────────────────────────────────────────────┐ │
│  │                            边缘层（Edge Layer）                                        │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  Edge Agent（轻量级采集器）                                                    │   │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  采集模块                                                                │ │   │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │   │ │
│  │  │  │  │ 文件采集  │  │ Syslog   │  │  MQTT    │  │  HTTP    │                │ │   │ │
│  │  │  │  │ tail -f  │  │ UDP/TCP  │  │ 订阅     │  │ 拉取     │                │ │   │ │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │   │ │
│  │  │  └──────────────────────────────────────────────────────────────────────────┘ │   │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  预处理模块                                                              │ │   │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │   │ │
│  │  │  │  │ 过滤     │  │ 采样     │  │ 脱敏     │  │ 格式化   │                │ │   │ │
│  │  │  │  │ 规则匹配  │  │ 按比例   │  │ 敏感数据  │  │ JSON化   │                │ │   │ │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │   │ │
│  │  │  └──────────────────────────────────────────────────────────────────────────┘ │   │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  本地缓存模块（BoltDB/SQLite）                                           │ │   │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │   │ │
│  │  │  │  │ 写入缓存  │  │ 压缩存储  │  │ 加密存储  │  │ FIFO淘汰 │                │ │   │ │
│  │  │  │  │ 批量写入  │  │ LZ4/Zstd │  │ AES-256  │  │ 容量管理  │                │ │   │ │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │   │ │
│  │  │  │  ┌──────────────────────────────────────────────────────┐              │ │   │ │
│  │  │  │  │  断点续传                                            │              │ │   │ │
│  │  │  │  │  • 记录上传位置                                      │              │ │   │ │
│  │  │  │  │  • 网络恢复后自动续传                                │              │ │   │ │
│  │  │  │  │  • 数据完整性校验                                    │              │ │   │ │
│  │  │  │  └──────────────────────────────────────────────────────┘              │ │   │ │
│  │  │  └──────────────────────────────────────────────────────────────────────────┘ │   │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  上传模块                                                                │ │   │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │   │ │
│  │  │  │  │ HTTPS上传│  │ MQTT上传 │  │ 批量上传  │  │ 压缩传输  │                │ │   │ │
│  │  │  │  │ TLS加密  │  │ QoS=1    │  │ 1000条/批│  │ Gzip     │                │ │   │ │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │   │ │
│  │  │  └──────────────────────────────────────────────────────────────────────────┘ │   │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  配置管理模块                                                            │ │   │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │   │ │
│  │  │  │  │ 配置拉取  │  │ 配置验证  │  │ 热更新   │  │ 配置回滚  │                │ │   │ │
│  │  │  │  │ 定期拉取  │  │ Schema   │  │ 无重启   │  │ 失败回滚  │                │ │   │ │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │   │ │
│  │  │  └──────────────────────────────────────────────────────────────────────────┘ │   │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────────────┐ │   │ │
│  │  │  │  监控模块                                                                │ │   │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │   │ │
│  │  │  │  │ 健康检查  │  │ 指标采集  │  │ 心跳上报  │  │ 日志上报  │                │ │   │ │
│  │  │  │  │ 自检     │  │ CPU/内存 │  │ 60s间隔  │  │ 错误日志  │                │ │   │ │
│  │  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                │ │   │ │
│  │  │  └──────────────────────────────────────────────────────────────────────────┘ │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                                       │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  边缘设备（IoT Devices）                                                       │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │   │ │
│  │  │  │   PLC    │  │   IoT    │  │   POS    │  │  Camera  │  │ Gateway  │        │   │ │
│  │  │  │ 工控机   │  │ 传感器   │  │ 收银机   │  │ 摄像头   │  │ 网关     │        │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据流向                                                    │ │
│  │                                                                                       │ │
│  │  设备日志 → Edge Agent采集 → 本地预处理 → 本地缓存 → 批量上传 → Edge Gateway          │ │
│  │                                                                                       │ │
│  │  Edge Gateway → 数据聚合 → Kafka → Collector → ES/MinIO                              │ │
│  │                                                                                       │ │
│  │  云端配置 → Edge Gateway → MQTT/HTTPS → Edge Agent → 配置热更新                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| Edge Agent | 边缘侧轻量级日志采集 | 多源采集、本地预处理、本地缓存、断点续传、配置热更新 |
| 本地缓存 | 网络不稳定时本地存储 | BoltDB/SQLite存储、压缩、加密、FIFO淘汰、断点续传 |
| Edge Gateway | 云端边缘节点管理 | 节点注册、配置下发、数据接收、远程管理、节点监控 |
| 配置管理 | 边缘节点配置管理 | 配置下发、版本管理、热更新、配置验证、回滚 |
| 边缘预处理 | 边缘侧数据预处理 | 过滤、采样、脱敏、格式化、聚合 |
| 远程管理 | 边缘节点远程运维 | 远程升级、远程诊断、远程重启、日志查看 |

### 2.3 关键路径

**边缘节点注册流程**:
```
Edge Agent启动 → 生成节点ID → 向Edge Gateway注册(10ms) → 认证验证(20ms) 
  → 创建节点记录(30ms) → 下发初始配置(50ms) → 建立MQTT连接(100ms) 
  → 开始心跳上报(60s间隔)

总时长: < 300ms
```

**日志采集上传流程**:
```
设备日志产生 → Edge Agent采集(1ms) → 本地预处理(2ms) → 写入本地缓存(5ms) 
  → 批量读取(10ms) → 压缩(20ms) → HTTPS上传(100ms) → Edge Gateway接收(10ms) 
  → 写入Kafka(20ms)

单条日志延迟: < 200ms（网络正常）
批量上传: 1000条/批，每60秒或缓存满时上传
```

**配置热更新流程**:
```
云端配置变更 → Edge Gateway发布MQTT消息(10ms) → Edge Agent订阅接收(50ms) 
  → 配置验证(20ms) → 原子更新(10ms) → 生效确认(10ms)

配置生效时间: < 100ms
```

**断点续传流程**:
```
网络中断 → 数据写入本地缓存 → 网络恢复检测(心跳) → 读取未上传数据 
  → 从断点位置续传 → 上传成功后删除本地缓存

恢复时间: < 5秒
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、低内存占用、交叉编译支持、适合边缘设备 |
| BoltDB | 1.3+ | 嵌入式KV数据库、无需独立进程、适合边缘缓存 |
| SQLite | 3.40+ | 轻量级关系数据库、备选方案、SQL查询支持 |
| MQTT | 3.1.1/5.0 | 轻量级消息协议、低带宽、支持QoS、适合IoT场景 |
| Eclipse Paho | 1.4+ | MQTT客户端库、稳定可靠、Go语言支持 |
| LZ4 | 1.9+ | 高速压缩算法、压缩比适中、CPU占用低 |
| Zstd | 1.5+ | 高压缩比、可调节压缩级别、备选方案 |
| TLS | 1.3 | 传输加密、证书认证、安全通信 |
| AES-256 | - | 数据加密、敏感数据保护、行业标准 |
| Prometheus Client | 1.17+ | 指标采集、监控数据上报 |
| Logrus | 1.9+ | 结构化日志、日志级别控制 |

### 3.2 本地存储方案对比

| 方案 | 优点 | 缺点 | 性能 | 资源占用 | 选择 |
|------|------|------|------|----------|------|
| BoltDB | 嵌入式、无需独立进程、事务支持 | 单写入者限制 | 高 | 低 | ✅ 主方案 |
| SQLite | SQL查询、成熟稳定、工具丰富 | 相对较重 | 中 | 中 | ✅ 备选 |
| LevelDB | 高性能写入 | 无事务支持 | 高 | 低 | ❌ |
| 文件系统 | 简单直接 | 无索引、查询慢 | 低 | 最低 | ❌ |

**选择理由**: BoltDB作为主方案，嵌入式设计无需独立进程，内存占用低，事务支持保证数据一致性，适合边缘设备。SQLite作为备选方案，提供SQL查询能力。

### 3.3 通信协议对比

| 协议 | 优点 | 缺点 | 带宽占用 | 适用场景 | 选择 |
|------|------|------|----------|----------|------|
| MQTT | 轻量级、低带宽、QoS支持、双向通信 | 需要Broker | 低 | 配置下发、心跳 | ✅ 主方案 |
| HTTPS | 通用、安全、防火墙友好 | 带宽占用高 | 高 | 数据上传 | ✅ 主方案 |
| gRPC | 高性能、双向流 | 复杂度高 | 中 | 不适合边缘 | ❌ |
| WebSocket | 双向通信、实时性好 | 连接维护成本 | 中 | 备选方案 | ⚠️ |

**选择理由**: MQTT用于配置下发和心跳上报（低带宽、双向通信），HTTPS用于批量数据上传（安全、防火墙友好）。

### 3.4 压缩算法对比

| 算法 | 压缩比 | 压缩速度 | 解压速度 | CPU占用 | 选择 |
|------|--------|----------|----------|---------|------|
| LZ4 | 2-3x | 极快 | 极快 | 低 | ✅ 主方案 |
| Zstd | 3-5x | 快 | 快 | 中 | ✅ 备选 |
| Gzip | 3-4x | 中 | 中 | 中 | ⚠️ 兼容 |
| Snappy | 2x | 极快 | 极快 | 低 | ⚠️ 备选 |

**选择理由**: LZ4作为主方案，压缩速度极快，CPU占用低，适合边缘设备实时压缩。Zstd作为备选，提供更高压缩比。

### 3.5 架构支持对比

| 架构 | 支持度 | 交叉编译 | 测试覆盖 | 选择 |
|------|--------|----------|----------|------|
| x86_64 | 完整支持 | ✅ | 完整 | ✅ |
| ARM64 | 完整支持 | ✅ | 完整 | ✅ |
| ARMv7 | 完整支持 | ✅ | 基础 | ✅ |
| MIPS | 基础支持 | ✅ | 有限 | ⚠️ |

**选择理由**: Go语言天然支持交叉编译，可以轻松编译到多种架构。重点支持x86_64、ARM64、ARMv7三种主流架构。

---

## 4. 关键流程设计

### 4.1 边缘节点注册流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      边缘节点注册流程                            │
└─────────────────────────────────────────────────────────────────┘

1. Edge Agent启动
   ├─ 读取本地配置文件
   ├─ 检查节点ID（如果不存在则生成）
   │  └─ 节点ID格式: edge-{hostname}-{uuid}
   ├─ 加载TLS证书
   └─ 初始化日志系统

2. 生成注册请求
   ├─ 收集节点信息
   │  ├─ 主机名
   │  ├─ 操作系统: Linux/Windows
   │  ├─ 架构: x86_64/arm64/armv7
   │  ├─ Agent版本
   │  ├─ 可用能力: [file, syslog, mqtt, http]
   │  └─ 系统资源: CPU核数、内存大小、磁盘空间
   │
   └─ 构建注册请求
      {
        "node_id": "edge-factory-001-abc123",
        "hostname": "factory-floor-1",
        "os": "linux",
        "arch": "arm64",
        "version": "1.0.0",
        "capabilities": ["file", "syslog", "mqtt"],
        "resources": {
          "cpu_cores": 4,
          "memory_mb": 2048,
          "disk_gb": 32
        }
      }

3. 向Edge Gateway注册
   ├─ HTTPS POST /api/v1/edge/nodes/register
   ├─ 携带认证Token（预配置或临时Token）
   ├─ TLS双向认证（可选）
   └─ 超时时间: 10秒

4. Edge Gateway处理注册
   ├─ 验证认证Token
   ├─ 检查节点ID唯一性
   ├─ 创建节点记录（PostgreSQL）
   │  ├─ 节点基本信息
   │  ├─ 状态: online
   │  ├─ 注册时间
   │  └─ 最后心跳时间
   │
   ├─ 分配节点分组（根据标签）
   ├─ 生成节点专属配置
   └─ 返回注册响应
      {
        "success": true,
        "node_id": "edge-factory-001-abc123",
        "mqtt_broker": "mqtt://gateway.example.com:1883",
        "mqtt_topic": "edge/edge-factory-001-abc123/config",
        "upload_url": "https://gateway.example.com/api/v1/edge/data",
        "heartbeat_interval": 60,
        "config_version": 1
      }

5. Edge Agent建立MQTT连接
   ├─ 连接到MQTT Broker
   ├─ 订阅配置Topic: edge/{node_id}/config
   ├─ 订阅命令Topic: edge/{node_id}/command
   ├─ 设置QoS=1（至少一次）
   └─ 设置遗嘱消息（Last Will）

6. 下发初始配置
   ├─ Edge Gateway发布配置到MQTT
   ├─ Edge Agent接收配置
   ├─ 验证配置格式
   ├─ 应用配置（热更新）
   └─ 发送确认消息

7. 开始心跳上报
   ├─ 每60秒发送一次心跳
   ├─ 心跳内容:
   │  {
   │    "node_id": "edge-factory-001-abc123",
   │    "timestamp": "2026-01-31T10:00:00Z",
   │    "status": "online",
   │    "metrics": {
   │      "cpu_usage": 15.5,
   │      "memory_usage": 45.2,
   │      "disk_usage": 60.0,
   │      "buffer_size": 1024,
   │      "pending_logs": 500
   │    }
   │  }
   └─ 通过MQTT发送到: edge/{node_id}/heartbeat

8. 注册完成
   ├─ 节点状态: online
   ├─ 开始日志采集
   └─ 记录注册日志

总耗时: < 300ms
```

**时序图**:

```
Edge Agent  Edge Gateway  PostgreSQL  MQTT Broker  Redis
    │           │             │            │         │
    │─注册请求──→│             │            │         │
    │           │─验证Token──→│            │         │
    │           │◄────OK──────│            │         │
    │           │─创建节点────→│            │         │
    │           │◄────OK──────│            │         │
    │           │─缓存节点────────────────────────→│
    │           │◄────OK──────────────────────────│
    │◄─注册响应─│             │            │         │
    │           │             │            │         │
    │─连接MQTT──────────────────────────→│         │
    │◄─连接成功──────────────────────────│         │
    │─订阅配置──────────────────────────→│         │
    │           │             │            │         │
    │           │─发布配置────────────────→│         │
    │◄─接收配置──────────────────────────│         │
    │─应用配置─→│             │            │         │
    │           │             │            │         │
    │─心跳上报──────────────────────────→│         │
    │           │◄─心跳消息───────────────│         │
    │           │─更新心跳────→│            │         │
```

### 4.2 日志采集与上传流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      日志采集与上传流程                          │
└─────────────────────────────────────────────────────────────────┘

1. 日志采集
   ├─ 文件采集（tail -f模式）
   │  ├─ 监听文件变化
   │  ├─ 读取新增行
   │  ├─ 记录读取位置（offset）
   │  └─ 延迟: < 1ms
   │
   ├─ Syslog采集
   │  ├─ 监听UDP/TCP端口
   │  ├─ 解析Syslog格式
   │  └─ 延迟: < 1ms
   │
   ├─ MQTT采集
   │  ├─ 订阅指定Topic
   │  ├─ 接收消息
   │  └─ 延迟: < 10ms
   │
   └─ HTTP采集
      ├─ 定期拉取API
      ├─ 解析响应
      └─ 延迟: < 100ms

2. 本地预处理
   ├─ 过滤处理
   │  ├─ 按日志级别过滤
   │  │  └─ 规则: level in [ERROR, WARN, INFO]
   │  ├─ 按关键词过滤
   │  │  └─ 规则: message contains "error" or "exception"
   │  └─ 按正则表达式过滤
   │     └─ 规则: message matches "^ERROR.*"
   │
   ├─ 采样处理
   │  ├─ 按比例采样: 10%
   │  ├─ 按规则采样: ERROR级别100%，INFO级别10%
   │  └─ 按时间窗口采样: 每秒最多100条
   │
   ├─ 脱敏处理
   │  ├─ 手机号脱敏: 138****1234
   │  ├─ 身份证脱敏: 110***********1234
   │  ├─ 邮箱脱敏: u***@example.com
   │  └─ IP地址脱敏: 192.168.*.*
   │
   ├─ 格式化处理
   │  ├─ 统一时间格式: RFC3339
   │  ├─ 添加节点标识
   │  ├─ 添加采集时间
   │  └─ 转换为JSON格式
   │
   └─ 聚合处理（可选）
      ├─ 相同日志合并
      ├─ 记录出现次数
      └─ 时间窗口: 60秒

   预处理延迟: < 2ms

3. 写入本地缓存
   ├─ 批量写入BoltDB
   │  ├─ 批次大小: 100条
   │  ├─ 写入间隔: 1秒
   │  └─ 事务提交
   │
   ├─ 数据压缩（可选）
   │  ├─ 使用LZ4压缩
   │  ├─ 压缩比: 2-3x
   │  └─ 压缩延迟: < 5ms
   │
   ├─ 数据加密（敏感数据）
   │  ├─ 使用AES-256加密
   │  ├─ 密钥管理
   │  └─ 加密延迟: < 10ms
   │
   ├─ 容量管理
   │  ├─ 检查缓存大小
   │  ├─ 超过限制时FIFO淘汰
   │  └─ 默认限制: 1GB
   │
   └─ 断点记录
      ├─ 记录上传位置
      ├─ 记录文件offset
      └─ 持久化到BoltDB

   写入延迟: < 5ms

4. 批量读取缓存
   ├─ 触发条件
   │  ├─ 定时触发: 每60秒
   │  ├─ 容量触发: 缓存达到10MB
   │  └─ 手动触发: 收到上传命令
   │
   ├─ 读取策略
   │  ├─ 批次大小: 1000条
   │  ├─ 优先级排序: ERROR > WARN > INFO
   │  └─ 时间排序: 旧数据优先
   │
   └─ 读取延迟: < 10ms

5. 数据压缩
   ├─ 批量压缩
   │  ├─ 使用Gzip压缩
   │  ├─ 压缩级别: 6（平衡）
   │  └─ 压缩比: 5-10x
   │
   └─ 压缩延迟: < 20ms

6. HTTPS上传
   ├─ 构建上传请求
   │  ├─ URL: https://gateway.example.com/api/v1/edge/data
   │  ├─ Method: POST
   │  ├─ Headers:
   │  │  ├─ Authorization: Bearer {token}
   │  │  ├─ Content-Type: application/json
   │  │  ├─ Content-Encoding: gzip
   │  │  └─ X-Node-ID: edge-factory-001-abc123
   │  └─ Body: 压缩后的日志数据
   │
   ├─ 发送请求
   │  ├─ TLS 1.3加密
   │  ├─ 超时时间: 30秒
   │  └─ 重试策略: 3次，指数退避
   │
   ├─ 接收响应
   │  ├─ 200 OK: 上传成功
   │  ├─ 429 Too Many Requests: 限流，延迟重试
   │  ├─ 500 Server Error: 服务器错误，重试
   │  └─ 其他错误: 记录日志，重试
   │
   └─ 上传延迟: < 100ms（网络正常）

7. Edge Gateway接收
   ├─ 验证请求
   │  ├─ 验证Token
   │  ├─ 验证节点ID
   │  └─ 检查限流
   │
   ├─ 解压数据
   │  └─ Gzip解压
   │
   ├─ 数据验证
   │  ├─ JSON格式验证
   │  ├─ 必填字段验证
   │  └─ 数据完整性校验
   │
   ├─ 写入Kafka
   │  ├─ Topic: edge-logs
   │  ├─ 分区策略: 按node_id哈希
   │  └─ 批量写入
   │
   └─ 返回响应
      {
        "success": true,
        "received": 1000,
        "timestamp": "2026-01-31T10:00:00Z"
      }

   接收延迟: < 10ms

8. 清理本地缓存
   ├─ 上传成功后删除已上传数据
   ├─ 更新断点位置
   ├─ 释放存储空间
   └─ 记录上传日志

9. 后续处理
   ├─ Kafka → Collector → ES/MinIO
   ├─ 数据索引
   └─ 数据查询

总延迟: < 200ms（网络正常）
批量上传: 1000条/批，每60秒或缓存满时上传
```

### 4.3 配置热更新流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      配置热更新流程                              │
└─────────────────────────────────────────────────────────────────┘

1. 云端配置变更
   ├─ 用户通过Web Console修改配置
   │  ├─ 修改采集源配置
   │  ├─ 修改过滤规则
   │  ├─ 修改上传参数
   │  └─ 修改采样比例
   │
   ├─ 或通过API修改配置
   │  └─ PUT /api/v1/edge/nodes/{node_id}/config
   │
   └─ 配置示例:
      {
        "collection": {
          "sources": [
            {
              "type": "file",
              "path": "/var/log/app/*.log",
              "enabled": true
            }
          ],
          "filters": [
            {
              "type": "level",
              "levels": ["ERROR", "WARN"]
            }
          ],
          "sampling_rate": 0.1
        },
        "upload": {
          "batch_size": 1000,
          "interval_seconds": 60,
          "compression": "gzip"
        },
        "buffer": {
          "max_size_mb": 1024,
          "encryption_enabled": false
        }
      }

2. 配置验证
   ├─ Schema验证
   │  ├─ 字段类型检查
   │  ├─ 必填字段检查
   │  └─ 值范围检查
   │
   ├─ 业务规则验证
   │  ├─ 采样率: 0-1之间
   │  ├─ 批次大小: 100-10000
   │  ├─ 上传间隔: 10-3600秒
   │  └─ 缓存大小: 100-10240MB
   │
   └─ 验证失败则拒绝变更

3. 保存配置
   ├─ 保存到PostgreSQL
   │  ├─ 更新edge_node_configs表
   │  ├─ 版本号+1
   │  └─ 记录变更时间和操作人
   │
   ├─ 同步到Redis
   │  ├─ Key: edge:config:{node_id}
   │  ├─ Value: JSON配置
   │  └─ TTL: 24小时
   │
   └─ 记录配置历史
      ├─ 保存到edge_config_history表
      └─ 用于回滚

4. 发布配置变更通知
   ├─ 方式1: MQTT推送（主方式）
   │  ├─ Topic: edge/{node_id}/config
   │  ├─ QoS: 1（至少一次）
   │  ├─ Retain: true（保留消息）
   │  └─ Payload:
   │     {
   │       "version": 2,
   │       "config": {...},
   │       "timestamp": "2026-01-31T10:00:00Z"
   │     }
   │
   └─ 方式2: 定期拉取（备用方式）
      ├─ Edge Agent每5分钟拉取一次
      ├─ GET /api/v1/edge/nodes/{node_id}/config
      └─ 对比版本号，如有更新则应用

5. Edge Agent接收配置
   ├─ MQTT订阅接收（实时）
   │  ├─ 接收延迟: < 50ms
   │  └─ 解析JSON配置
   │
   ├─ 或定期拉取接收（备用）
   │  ├─ 拉取间隔: 5分钟
   │  └─ 对比版本号
   │
   └─ 配置接收确认
      └─ 发送ACK到MQTT

6. 配置验证
   ├─ JSON格式验证
   ├─ Schema验证
   ├─ 版本号检查（必须递增）
   ├─ 签名验证（可选）
   └─ 验证失败则拒绝更新，保持原配置

7. 配置备份
   ├─ 备份当前配置到本地文件
   │  └─ /var/lib/edge-agent/config.backup.json
   ├─ 记录配置版本
   └─ 用于回滚

8. 应用新配置（热更新）
   ├─ 使用atomic.Value原子更新
   │  ```go
   │  type ConfigManager struct {
   │      config atomic.Value // *Config
   │  }
   │  
   │  func (m *ConfigManager) UpdateConfig(newConfig *Config) error {
   │      // 验证配置
   │      if err := newConfig.Validate(); err != nil {
   │          return err
   │      }
   │      
   │      // 原子更新
   │      m.config.Store(newConfig)
   │      
   │      // 通知各模块
   │      m.notifyModules(newConfig)
   │      
   │      return nil
   │  }
   │  
   │  func (m *ConfigManager) GetConfig() *Config {
   │      return m.config.Load().(*Config)
   │  }
   │  ```
   │
   ├─ 通知各模块重新加载配置
   │  ├─ 采集模块: 更新采集源
   │  ├─ 过滤模块: 更新过滤规则
   │  ├─ 上传模块: 更新上传参数
   │  └─ 缓存模块: 更新缓存配置
   │
   ├─ 各模块平滑切换
   │  ├─ 完成当前批次处理
   │  ├─ 应用新配置
   │  └─ 开始新批次处理
   │
   └─ 无需重启Agent进程

9. 配置生效确认
   ├─ 检查各模块状态
   ├─ 验证配置已生效
   ├─ 发送确认消息到MQTT
   │  └─ Topic: edge/{node_id}/config/ack
   │     {
   │       "version": 2,
   │       "status": "applied",
   │       "timestamp": "2026-01-31T10:00:01Z"
   │     }
   │
   └─ 记录配置变更日志

10. Edge Gateway接收确认
    ├─ 更新节点配置状态
    ├─ 记录配置应用时间
    └─ 通知用户配置已生效

11. 配置回滚（如果失败）
    ├─ 检测配置应用失败
    ├─ 加载备份配置
    ├─ 恢复到上一版本
    ├─ 发送失败通知
    └─ 记录回滚日志

配置生效时间: < 100ms
无需重启: ✅
支持回滚: ✅
```

### 4.4 断点续传流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      断点续传流程                                │
└─────────────────────────────────────────────────────────────────┘

1. 正常上传阶段
   ├─ 日志写入本地缓存
   ├─ 记录每条日志的序列号
   │  └─ 序列号: 自增ID
   ├─ 批量上传
   └─ 上传成功后记录最后上传的序列号
      └─ 保存到BoltDB: last_uploaded_seq = 1000

2. 网络中断检测
   ├─ 上传请求超时（30秒）
   ├─ 连接失败
   ├─ 心跳超时（3次连续失败）
   └─ 标记网络状态: offline

3. 离线模式
   ├─ 停止上传尝试
   ├─ 继续采集日志
   ├─ 写入本地缓存
   ├─ 监控缓存容量
   │  ├─ 接近限制时发出警告
   │  └─ 达到限制时FIFO淘汰
   │
   └─ 定期检测网络状态
      ├─ 每30秒尝试连接一次
      └─ 发送心跳测试

4. 网络恢复检测
   ├─ 心跳成功
   ├─ 或上传测试成功
   └─ 标记网络状态: online

5. 读取断点位置
   ├─ 从BoltDB读取last_uploaded_seq
   ├─ 查询未上传的日志
   │  └─ SELECT * FROM logs WHERE seq > last_uploaded_seq ORDER BY seq
   │
   └─ 统计待上传数量
      └─ 例如: 5000条待上传

6. 断点续传
   ├─ 从断点位置开始上传
   │  └─ 起始序列号: 1001
   │
   ├─ 批量上传策略
   │  ├─ 批次大小: 1000条
   │  ├─ 并发上传: 2个批次
   │  └─ 限速: 避免占用过多带宽
   │
   ├─ 上传进度跟踪
   │  ├─ 记录每批次上传状态
   │  ├─ 成功: 更新last_uploaded_seq
   │  ├─ 失败: 重试该批次
   │  └─ 进度: 1000/5000 (20%)
   │
   └─ 数据完整性校验
      ├─ 每批次计算校验和
      ├─ 服务端验证校验和
      └─ 不匹配则重传

7. 清理已上传数据
   ├─ 上传成功后删除本地缓存
   ├─ 释放存储空间
   └─ 更新断点位置

8. 恢复正常模式
   ├─ 所有积压数据上传完成
   ├─ 恢复正常上传频率
   └─ 记录恢复日志

9. 异常处理
   ├─ 续传过程中再次中断
   │  └─ 保存当前进度，等待下次恢复
   │
   ├─ 缓存数据损坏
   │  ├─ 跳过损坏数据
   │  ├─ 记录错误日志
   │  └─ 继续上传其他数据
   │
   └─ 服务端拒绝旧数据
      ├─ 根据时间戳判断
      ├─ 删除过期数据
      └─ 继续上传新数据

恢复时间: < 5秒
数据完整性: 保证
支持多次中断: ✅
```

### 4.5 异常流程

**网络异常处理**:
```
1. 检测网络异常
   ├─ 上传超时
   ├─ 连接失败
   └─ 心跳超时

2. 切换到离线模式
   ├─ 停止上传
   ├─ 继续采集
   └─ 本地缓存

3. 定期检测网络
   └─ 每30秒测试一次

4. 网络恢复后断点续传
   └─ 参见4.4节
```

**缓存满处理**:
```
1. 监控缓存使用率
   ├─ 80%: 发出警告
   ├─ 90%: 加快上传
   └─ 100%: FIFO淘汰

2. FIFO淘汰策略
   ├─ 删除最旧的日志
   ├─ 优先保留ERROR级别
   └─ 记录淘汰日志

3. 通知云端
   └─ 上报缓存满事件
```

**配置更新失败处理**:
```
1. 检测更新失败
   ├─ 验证失败
   ├─ 应用失败
   └─ 模块异常

2. 自动回滚
   ├─ 加载备份配置
   ├─ 恢复到上一版本
   └─ 记录回滚日志

3. 通知云端
   └─ 发送失败消息

4. 人工介入
   └─ 等待管理员处理
```

**Agent崩溃恢复**:
```
1. Agent重启
   ├─ 加载配置
   ├─ 恢复断点位置
   └─ 重新注册

2. 恢复采集
   ├─ 从文件offset继续
   ├─ 避免重复采集
   └─ 避免遗漏数据

3. 恢复上传
   ├─ 检查未上传数据
   └─ 断点续传
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块23部分，主要接口包括:

**边缘节点管理接口**:
- POST /api/v1/edge/nodes/register - 边缘节点注册
- GET /api/v1/edge/nodes - 获取边缘节点列表
- GET /api/v1/edge/nodes/{id} - 获取节点详情
- PUT /api/v1/edge/nodes/{id} - 更新节点信息
- DELETE /api/v1/edge/nodes/{id} - 删除节点
- POST /api/v1/edge/nodes/{id}/restart - 远程重启节点

**配置管理接口（支持热更新）**:
- GET /api/v1/edge/nodes/{id}/config - 获取节点配置
- PUT /api/v1/edge/nodes/{id}/config - 更新节点配置（热更新）
- GET /api/v1/edge/nodes/{id}/config/history - 获取配置历史
- POST /api/v1/edge/nodes/{id}/config/rollback - 回滚配置（热更新）

**数据上传接口**:
- POST /api/v1/edge/data - 批量上传日志数据
- POST /api/v1/edge/heartbeat - 心跳上报

**远程管理接口**:
- POST /api/v1/edge/nodes/{id}/upgrade - 远程升级
- GET /api/v1/edge/nodes/{id}/logs - 查看节点日志
- POST /api/v1/edge/nodes/{id}/diagnose - 远程诊断

**节点分组接口**:
- POST /api/v1/edge/groups - 创建节点分组
- GET /api/v1/edge/groups - 获取分组列表
- PUT /api/v1/edge/groups/{id}/nodes - 批量分配节点到分组
- PUT /api/v1/edge/groups/{id}/config - 批量更新分组配置（热更新）

**告警规则管理接口（支持热更新）**:
- POST /api/v1/edge/nodes/{node_id}/alert-rules - 创建自定义告警规则（热更新）
- GET /api/v1/edge/nodes/{node_id}/alert-rules - 获取告警规则列表
- GET /api/v1/edge/nodes/{node_id}/alert-rules/{rule_name} - 获取告警规则详情
- PUT /api/v1/edge/nodes/{node_id}/alert-rules/{rule_name} - 更新告警规则（热更新）
- DELETE /api/v1/edge/nodes/{node_id}/alert-rules/{rule_name} - 删除告警规则（热更新）
- PATCH /api/v1/edge/nodes/{node_id}/alert-rules/{rule_name}/toggle - 启用/禁用告警规则（热更新）
- POST /api/v1/edge/nodes/{node_id}/alert-rules/batch - 批量更新告警规则（热更新）
- GET /api/v1/edge/alert-rules/templates - 获取告警规则模板

### 5.2 内部接口

**Edge Agent核心接口**:

```go
// Edge Agent主接口
type EdgeAgent interface {
    // 启动Agent
    Start(ctx context.Context) error
    
    // 停止Agent
    Stop() error
    
    // 注册到云端
    Register() error
    
    // 获取配置
    GetConfig() *Config
    
    // 更新配置（热更新）
    UpdateConfig(config *Config) error
    
    // 获取状态
    GetStatus() *AgentStatus
}

// 配置管理器接口
type ConfigManager interface {
    // 加载配置
    LoadConfig(path string) (*Config, error)
    
    // 保存配置
    SaveConfig(config *Config) error
    
    // 热更新配置
    HotReload(config *Config) error
    
    // 订阅配置变更
    Subscribe(callback func(*Config)) error
    
    // 回滚配置
    Rollback() error
}

// 采集器接口
type Collector interface {
    // 启动采集
    Start() error
    
    // 停止采集
    Stop() error
    
    // 采集日志
    Collect() (<-chan *LogEntry, error)
    
    // 获取采集位置
    GetOffset() int64
    
    // 设置采集位置
    SetOffset(offset int64) error
}

// 本地缓存接口
type LocalBuffer interface {
    // 写入日志
    Write(entry *LogEntry) error
    
    // 批量写入
    WriteBatch(entries []*LogEntry) error
    
    // 读取日志
    Read(limit int) ([]*LogEntry, error)
    
    // 删除已上传日志
    Delete(seq int64) error
    
    // 获取缓存大小
    Size() int64
    
    // 获取待上传数量
    PendingCount() int64
    
    // 获取最后上传序列号
    GetLastUploadedSeq() int64
    
    // 设置最后上传序列号
    SetLastUploadedSeq(seq int64) error
}

// 上传器接口
type Uploader interface {
    // 上传日志
    Upload(entries []*LogEntry) error
    
    // 批量上传
    UploadBatch(batches [][]*LogEntry) error
    
    // 获取上传状态
    GetStatus() *UploadStatus
    
    // 重试上传
    Retry(entries []*LogEntry) error
}

// 心跳管理器接口
type HeartbeatManager interface {
    // 启动心跳
    Start() error
    
    // 停止心跳
    Stop() error
    
    // 发送心跳
    SendHeartbeat() error
    
    // 获取网络状态
    GetNetworkStatus() NetworkStatus
}
```

**数据模型**:

```go
// 边缘节点
type EdgeNode struct {
    ID           string                 `json:"id" db:"id"`
    Hostname     string                 `json:"hostname" db:"hostname"`
    OS           string                 `json:"os" db:"os"`
    Arch         string                 `json:"arch" db:"arch"`
    Version      string                 `json:"version" db:"version"`
    Status       NodeStatus             `json:"status" db:"status"`
    Capabilities []string               `json:"capabilities" db:"capabilities"`
    Resources    *NodeResources         `json:"resources" db:"resources"`
    GroupID      string                 `json:"group_id" db:"group_id"`
    Config       map[string]interface{} `json:"config" db:"config"`
    ConfigVersion int                   `json:"config_version" db:"config_version"`
    RegisteredAt time.Time              `json:"registered_at" db:"registered_at"`
    LastHeartbeat time.Time             `json:"last_heartbeat" db:"last_heartbeat"`
    CreatedAt    time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt    time.Time              `json:"updated_at" db:"updated_at"`
}

// 节点状态
type NodeStatus string

const (
    NodeStatusOnline  NodeStatus = "online"
    NodeStatusOffline NodeStatus = "offline"
    NodeStatusError   NodeStatus = "error"
)

// 节点资源
type NodeResources struct {
    CPUCores  int   `json:"cpu_cores"`
    MemoryMB  int   `json:"memory_mb"`
    DiskGB    int   `json:"disk_gb"`
}

// 节点配置
type EdgeConfig struct {
    Collection CollectionConfig `json:"collection"`
    Upload     UploadConfig     `json:"upload"`
    Buffer     BufferConfig     `json:"buffer"`
    Heartbeat  HeartbeatConfig  `json:"heartbeat"`
}

// 采集配置
type CollectionConfig struct {
    Sources      []SourceConfig  `json:"sources"`
    Filters      []FilterConfig  `json:"filters"`
    SamplingRate float64         `json:"sampling_rate"`
}

// 采集源配置
type SourceConfig struct {
    Type    string                 `json:"type"` // file, syslog, mqtt, http
    Enabled bool                   `json:"enabled"`
    Config  map[string]interface{} `json:"config"`
}

// 过滤配置
type FilterConfig struct {
    Type   string                 `json:"type"` // level, keyword, regex
    Config map[string]interface{} `json:"config"`
}

// 上传配置
type UploadConfig struct {
    BatchSize       int    `json:"batch_size"`
    IntervalSeconds int    `json:"interval_seconds"`
    Compression     string `json:"compression"` // gzip, lz4, zstd
    MaxRetries      int    `json:"max_retries"`
    RetryInterval   int    `json:"retry_interval"`
}

// 缓存配置
type BufferConfig struct {
    MaxSizeMB          int    `json:"max_size_mb"`
    EncryptionEnabled  bool   `json:"encryption_enabled"`
    CompressionEnabled bool   `json:"compression_enabled"`
    StorageType        string `json:"storage_type"` // boltdb, sqlite
}

// 心跳配置
type HeartbeatConfig struct {
    IntervalSeconds int `json:"interval_seconds"`
    TimeoutSeconds  int `json:"timeout_seconds"`
    MaxRetries      int `json:"max_retries"`
}

// 日志条目
type LogEntry struct {
    Seq       int64                  `json:"seq"`
    NodeID    string                 `json:"node_id"`
    Timestamp time.Time              `json:"timestamp"`
    Level     string                 `json:"level"`
    Source    string                 `json:"source"`
    Message   string                 `json:"message"`
    Fields    map[string]interface{} `json:"fields"`
    Uploaded  bool                   `json:"uploaded"`
    CreatedAt time.Time              `json:"created_at"`
}

// Agent状态
type AgentStatus struct {
    NodeID        string        `json:"node_id"`
    Status        NodeStatus    `json:"status"`
    Version       string        `json:"version"`
    Uptime        time.Duration `json:"uptime"`
    ConfigVersion int           `json:"config_version"`
    Metrics       *AgentMetrics `json:"metrics"`
}

// Agent指标
type AgentMetrics struct {
    CPUUsage      float64 `json:"cpu_usage"`
    MemoryUsage   float64 `json:"memory_usage"`
    DiskUsage     float64 `json:"disk_usage"`
    BufferSize    int64   `json:"buffer_size"`
    PendingLogs   int64   `json:"pending_logs"`
    UploadedLogs  int64   `json:"uploaded_logs"`
    FailedUploads int64   `json:"failed_uploads"`
}

// 网络状态
type NetworkStatus string

const (
    NetworkStatusOnline  NetworkStatus = "online"
    NetworkStatusOffline NetworkStatus = "offline"
)
```

### 5.3 MQTT Topic设计

```
边缘节点相关Topic:

1. 配置下发
   Topic: edge/{node_id}/config
   QoS: 1
   Retain: true
   Payload: JSON配置

2. 告警规则下发（热更新）
   Topic: edge/{node_id}/alert-rules
   QoS: 1
   Retain: true
   Payload:
   {
     "version": 123456789,
     "rules": [
       {
         "name": "buffer_usage_high",
         "enabled": true,
         "type": "metric",
         "metric": "edge_agent_buffer_usage_percent",
         "condition": "> 80",
         "duration": "5m",
         "severity": "warning",
         "message": "缓存使用率超过80%",
         "actions": [...]
       }
     ],
     "timestamp": "2026-01-31T10:00:00Z"
   }

3. 命令下发
   Topic: edge/{node_id}/command
   QoS: 1
   Payload: 
   {
     "command": "restart|upgrade|diagnose",
     "params": {...}
   }

4. 心跳上报
   Topic: edge/{node_id}/heartbeat
   QoS: 1
   Payload: 心跳数据

5. 配置确认
   Topic: edge/{node_id}/config/ack
   QoS: 1
   Payload:
   {
     "version": 2,
     "status": "applied|failed",
     "error": "错误信息"
   }

6. 告警规则确认（热更新）
   Topic: edge/{node_id}/alert-rules/ack
   QoS: 1
   Payload:
   {
     "version": 123456789,
     "status": "applied|failed",
     "error": "错误信息",
     "applied_count": 5
   }

7. 告警上报
   Topic: edge/{node_id}/alerts
   QoS: 1
   Payload:
   {
     "rule_name": "buffer_usage_high",
     "node_id": "edge-001",
     "severity": "warning",
     "message": "缓存使用率超过80%",
     "value": 85.5,
     "timestamp": "2026-01-31T10:00:00Z",
     "labels": {...}
   }

8. 状态上报
   Topic: edge/{node_id}/status
   QoS: 1
   Payload: Agent状态

9. 日志上报（备用通道）
   Topic: edge/{node_id}/logs
   QoS: 1
   Payload: 压缩的日志数据

10. 遗嘱消息
    Topic: edge/{node_id}/lwt
    QoS: 1
    Payload:
    {
      "node_id": "edge-001",
      "status": "offline",
      "timestamp": "2026-01-31T10:00:00Z"
    }
```

---

## 6. 数据设计

### 6.1 数据模型

参见5.2节内部接口中的数据模型定义。

### 6.2 数据库设计

**PostgreSQL表设计**:

```sql
-- 边缘节点表
CREATE TABLE edge_nodes (
    id VARCHAR(255) PRIMARY KEY,
    hostname VARCHAR(255) NOT NULL,
    os VARCHAR(50) NOT NULL,
    arch VARCHAR(50) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'offline',
    capabilities JSONB DEFAULT '[]',
    resources JSONB DEFAULT '{}',
    group_id VARCHAR(255),
    config JSONB DEFAULT '{}',
    config_version INTEGER DEFAULT 1,
    registered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_status CHECK (status IN ('online', 'offline', 'error')),
    CONSTRAINT chk_os CHECK (os IN ('linux', 'windows', 'darwin')),
    CONSTRAINT chk_arch CHECK (arch IN ('x86_64', 'arm64', 'armv7', 'mips'))
);

CREATE INDEX idx_edge_nodes_status ON edge_nodes(status);
CREATE INDEX idx_edge_nodes_group_id ON edge_nodes(group_id);
CREATE INDEX idx_edge_nodes_last_heartbeat ON edge_nodes(last_heartbeat);

-- 节点配置历史表
CREATE TABLE edge_node_config_history (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL,
    config JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    
    FOREIGN KEY (node_id) REFERENCES edge_nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_config_history_node_id ON edge_node_config_history(node_id);
CREATE INDEX idx_config_history_version ON edge_node_config_history(node_id, version);

-- 节点分组表
CREATE TABLE edge_node_groups (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 节点心跳记录表（可选，用于历史分析）
CREATE TABLE edge_node_heartbeats (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    metrics JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (node_id) REFERENCES edge_nodes(id) ON DELETE CASCADE
);

CREATE INDEX idx_heartbeats_node_id ON edge_node_heartbeats(node_id);
CREATE INDEX idx_heartbeats_timestamp ON edge_node_heartbeats(timestamp);

-- 分区策略：按月分区
CREATE TABLE edge_node_heartbeats_2026_01 PARTITION OF edge_node_heartbeats
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 节点事件表
CREATE TABLE edge_node_events (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (node_id) REFERENCES edge_nodes(id) ON DELETE CASCADE,
    CONSTRAINT chk_event_type CHECK (event_type IN ('register', 'config_update', 'upgrade', 'restart', 'error'))
);

CREATE INDEX idx_events_node_id ON edge_node_events(node_id);
CREATE INDEX idx_events_type ON edge_node_events(event_type);
CREATE INDEX idx_events_timestamp ON edge_node_events(timestamp);

-- 告警规则表（支持热更新）
CREATE TABLE edge_alert_rules (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    type VARCHAR(50) NOT NULL,
    metric VARCHAR(255),
    event VARCHAR(255),
    condition TEXT NOT NULL,
    duration VARCHAR(50),
    window VARCHAR(50),
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    actions JSONB DEFAULT '[]',
    labels JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    
    FOREIGN KEY (node_id) REFERENCES edge_nodes(id) ON DELETE CASCADE,
    CONSTRAINT chk_rule_type CHECK (type IN ('metric', 'event', 'log')),
    CONSTRAINT chk_severity CHECK (severity IN ('info', 'warning', 'critical')),
    UNIQUE(node_id, name)
);

CREATE INDEX idx_alert_rules_node_id ON edge_alert_rules(node_id);
CREATE INDEX idx_alert_rules_enabled ON edge_alert_rules(enabled);
CREATE INDEX idx_alert_rules_type ON edge_alert_rules(type);

-- 告警历史表
CREATE TABLE edge_alerts (
    id BIGSERIAL PRIMARY KEY,
    node_id VARCHAR(255) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    value JSONB,
    labels JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'firing',
    fired_at TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP,
    
    FOREIGN KEY (node_id) REFERENCES edge_nodes(id) ON DELETE CASCADE,
    CONSTRAINT chk_alert_status CHECK (status IN ('firing', 'resolved', 'acknowledged'))
);

CREATE INDEX idx_alerts_node_id ON edge_alerts(node_id);
CREATE INDEX idx_alerts_rule_name ON edge_alerts(rule_name);
CREATE INDEX idx_alerts_status ON edge_alerts(status);
CREATE INDEX idx_alerts_fired_at ON edge_alerts(fired_at);

-- 分区策略：按月分区
CREATE TABLE edge_alerts_2026_01 PARTITION OF edge_alerts
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**BoltDB本地缓存设计**:

```go
// BoltDB Bucket设计
const (
    // 日志数据Bucket
    BucketLogs = "logs"
    
    // 元数据Bucket
    BucketMeta = "meta"
    
    // 配置Bucket
    BucketConfig = "config"
)

// Key设计
// 日志Key: seq_{序列号}
// 例如: seq_0000000001, seq_0000000002

// 元数据Key:
// - last_uploaded_seq: 最后上传的序列号
// - current_seq: 当前序列号
// - buffer_size: 缓存大小

// 配置Key:
// - current_config: 当前配置
// - backup_config: 备份配置
// - config_version: 配置版本

// BoltDB实现
type BoltDBBuffer struct {
    db       *bolt.DB
    maxSize  int64
    currentSeq atomic.Int64
}

func NewBoltDBBuffer(path string, maxSize int64) (*BoltDBBuffer, error) {
    db, err := bolt.Open(path, 0600, &bolt.Options{
        Timeout: 1 * time.Second,
    })
    if err != nil {
        return nil, err
    }
    
    // 创建Buckets
    err = db.Update(func(tx *bolt.Tx) error {
        _, err := tx.CreateBucketIfNotExists([]byte(BucketLogs))
        if err != nil {
            return err
        }
        _, err = tx.CreateBucketIfNotExists([]byte(BucketMeta))
        if err != nil {
            return err
        }
        _, err = tx.CreateBucketIfNotExists([]byte(BucketConfig))
        return err
    })
    
    if err != nil {
        return nil, err
    }
    
    buf := &BoltDBBuffer{
        db:      db,
        maxSize: maxSize,
    }
    
    // 加载当前序列号
    seq, _ := buf.GetLastUploadedSeq()
    buf.currentSeq.Store(seq)
    
    return buf, nil
}

func (b *BoltDBBuffer) Write(entry *LogEntry) error {
    // 生成序列号
    seq := b.currentSeq.Add(1)
    entry.Seq = seq
    
    // 序列化
    data, err := json.Marshal(entry)
    if err != nil {
        return err
    }
    
    // 压缩（可选）
    compressed := compress(data)
    
    // 写入BoltDB
    return b.db.Update(func(tx *bolt.Tx) error {
        bucket := tx.Bucket([]byte(BucketLogs))
        key := []byte(fmt.Sprintf("seq_%010d", seq))
        return bucket.Put(key, compressed)
    })
}

func (b *BoltDBBuffer) Read(limit int) ([]*LogEntry, error) {
    var entries []*LogEntry
    
    err := b.db.View(func(tx *bolt.Tx) error {
        bucket := tx.Bucket([]byte(BucketLogs))
        c := bucket.Cursor()
        
        count := 0
        for k, v := c.First(); k != nil && count < limit; k, v = c.Next() {
            // 解压
            data := decompress(v)
            
            // 反序列化
            var entry LogEntry
            if err := json.Unmarshal(data, &entry); err != nil {
                continue
            }
            
            entries = append(entries, &entry)
            count++
        }
        
        return nil
    })
    
    return entries, err
}
```

### 6.3 缓存设计

**Redis缓存设计**:

```
1. 节点状态缓存
   Key: edge:node:{node_id}:status
   Value: JSON节点状态
   TTL: 5分钟

2. 节点配置缓存
   Key: edge:node:{node_id}:config
   Value: JSON配置
   TTL: 24小时

3. 节点心跳缓存
   Key: edge:node:{node_id}:heartbeat
   Value: 最后心跳时间戳
   TTL: 2分钟

4. 在线节点集合
   Key: edge:nodes:online
   Type: Set
   Members: node_id列表

5. 节点指标缓存（时序数据）
   Key: edge:node:{node_id}:metrics:{timestamp}
   Value: JSON指标数据
   TTL: 1小时
```

---

## 7. 安全设计

### 7.1 认证授权

**节点认证**:
```
1. 注册认证
   ├─ 预配置Token认证
   │  └─ 管理员预先生成注册Token
   │
   ├─ 证书认证（推荐）
   │  ├─ 使用TLS客户端证书
   │  ├─ 证书由CA签发
   │  └─ 双向TLS认证
   │
   └─ API Key认证
      └─ 每个节点分配唯一API Key

2. 通信认证
   ├─ MQTT认证
   │  ├─ 用户名: node_id
   │  ├─ 密码: 节点密钥
   │  └─ TLS加密
   │
   └─ HTTPS认证
      ├─ Bearer Token
      └─ TLS 1.3加密
```

**权限控制**:
```
1. 节点权限
   ├─ 只能访问自己的配置
   ├─ 只能上传自己的数据
   └─ 不能访问其他节点信息

2. MQTT ACL
   ├─ 订阅权限: edge/{node_id}/#
   ├─ 发布权限: edge/{node_id}/#
   └─ 禁止跨节点访问

3. API权限
   ├─ 节点只能调用数据上传API
   ├─ 管理API需要管理员权限
   └─ 基于RBAC的权限控制
```

### 7.2 数据安全

**传输加密**:
```
1. HTTPS
   ├─ TLS 1.3
   ├─ 强加密套件
   └─ 证书验证

2. MQTT
   ├─ TLS加密
   ├─ QoS=1保证消息送达
   └─ 遗嘱消息

3. 数据压缩
   └─ 减少传输数据量
```

**存储加密**:
```
1. 本地缓存加密（敏感数据）
   ├─ AES-256-GCM加密
   ├─ 密钥管理
   │  ├─ 密钥存储在安全位置
   │  ├─ 定期轮换
   │  └─ 不硬编码
   └─ 加密范围
      ├─ 敏感字段加密
      └─ 全量加密（可选）

2. 配置文件加密
   ├─ 敏感配置加密存储
   └─ 启动时解密
```

**数据脱敏**:
```
1. 边缘侧脱敏
   ├─ 手机号: 138****1234
   ├─ 身份证: 110***********1234
   ├─ 邮箱: u***@example.com
   ├─ IP地址: 192.168.*.*
   └─ 自定义脱敏规则

2. 脱敏配置
   ├─ 正则表达式匹配
   ├─ 替换规则
   └─ 热更新支持
```

### 7.3 审计日志

```
1. 节点操作审计
   ├─ 注册/注销
   ├─ 配置变更
   ├─ 升级操作
   └─ 重启操作

2. 数据上传审计
   ├─ 上传时间
   ├─ 数据量
   ├─ 上传结果
   └─ 失败原因

3. 异常事件审计
   ├─ 认证失败
   ├─ 权限拒绝
   ├─ 配置错误
   └─ 网络异常

4. 审计日志存储
   ├─ 本地日志文件
   ├─ 上报到云端
   └─ 长期归档
```

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 二进制大小 | < 20MB | 编译后文件大小 |
| 内存占用 | < 50MB | 运行时RSS内存 |
| CPU占用 | < 5% | 平均CPU使用率 |
| 启动时间 | < 3秒 | 从启动到就绪的时间 |
| 采集延迟 | < 1ms | 日志产生到采集的延迟 |
| 预处理延迟 | < 2ms | 过滤、脱敏等处理延迟 |
| 本地写入延迟 | < 5ms | 写入BoltDB的延迟 |
| 上传延迟 | < 200ms | 批量上传的延迟（网络正常） |
| 配置热更新延迟 | < 100ms | 配置生效时间 |
| 吞吐量 | 10000条/秒 | 单节点日志处理能力 |
| 并发连接数 | 1000+ | 支持的并发采集源数量 |

### 8.2 优化策略

**内存优化**:
```
1. 对象池复用
   ├─ LogEntry对象池
   ├─ Buffer对象池
   └─ 减少GC压力

2. 批量处理
   ├─ 批量写入BoltDB
   ├─ 批量上传
   └─ 减少系统调用

3. 流式处理
   ├─ 使用Channel传递数据
   ├─ 避免大量数据堆积
   └─ 及时释放内存

4. 内存限制
   ├─ 设置最大缓存大小
   ├─ 超限时FIFO淘汰
   └─ 防止OOM
```

**CPU优化**:
```
1. 并发处理
   ├─ 多个采集源并发采集
   ├─ 使用Goroutine池
   └─ 限制并发数量

2. 高效压缩
   ├─ 使用LZ4快速压缩
   ├─ 可配置压缩级别
   └─ CPU占用低

3. 避免阻塞
   ├─ 异步上传
   ├─ 非阻塞IO
   └─ 超时控制

4. 热路径优化
   ├─ 减少锁竞争
   ├─ 使用atomic操作
   └─ 避免反射
```

**IO优化**:
```
1. 批量IO
   ├─ 批量读取文件
   ├─ 批量写入数据库
   └─ 减少IO次数

2. 缓冲IO
   ├─ 使用bufio
   ├─ 合理设置缓冲区大小
   └─ 减少系统调用

3. 异步IO
   ├─ 异步写入本地缓存
   ├─ 异步上传数据
   └─ 不阻塞采集

4. 磁盘优化
   ├─ 顺序写入
   ├─ 定期压缩数据库
   └─ 及时清理旧数据
```

**网络优化**:
```
1. 连接复用
   ├─ HTTP Keep-Alive
   ├─ MQTT长连接
   └─ 减少连接开销

2. 批量传输
   ├─ 批量上传日志
   ├─ 减少请求次数
   └─ 提高吞吐量

3. 压缩传输
   ├─ Gzip压缩
   ├─ 减少带宽占用
   └─ 降低传输成本

4. 限流控制
   ├─ 令牌桶限流
   ├─ 避免占用过多带宽
   └─ 平滑流量
```

### 8.3 资源配置建议

**最小配置**（适用于小型边缘设备）:
```
CPU: 1核
内存: 512MB
磁盘: 2GB
网络: 1Mbps

适用场景:
- 日志量: < 1000条/分钟
- 采集源: 1-2个
- 缓存: 100MB
```

**推荐配置**（适用于中型边缘设备）:
```
CPU: 2核
内存: 2GB
磁盘: 10GB
网络: 10Mbps

适用场景:
- 日志量: < 10000条/分钟
- 采集源: 5-10个
- 缓存: 1GB
```

**高性能配置**（适用于大型边缘设备）:
```
CPU: 4核
内存: 4GB
磁盘: 50GB
网络: 100Mbps

适用场景:
- 日志量: < 100000条/分钟
- 采集源: 20+个
- 缓存: 10GB
```

---

## 9. 部署方案

### 9.1 部署架构

**云端部署架构**:
```
Kubernetes集群部署方案

1. Edge Gateway (Deployment)
   - 副本数: 3-10 (HPA自动扩缩容)
   - 资源: 2核/4GB
   - 端口: 8080 (HTTPS), 1883 (MQTT)

2. MQTT Broker (StatefulSet)
   - 副本数: 3
   - 资源: 1核/2GB
   - 持久化: 10GB PVC

3. PostgreSQL (StatefulSet)
   - 主从复制: 1主2从
   - 资源: 4核/8GB
   - 存储: 100GB SSD

4. Redis (StatefulSet)
   - 集群模式: 3主3从
   - 资源: 2核/4GB
   - 存储: 20GB SSD
```

**边缘侧部署方式**:
```
方式1: 二进制部署（推荐）
- 下载对应架构的二进制文件
- 配置config.yaml
- 使用systemd管理
- 自动启动和重启

方式2: Docker部署
- 使用官方Docker镜像
- 挂载配置文件和数据目录
- Docker Compose管理

方式3: Kubernetes部署（边缘K8s）
- 使用DaemonSet部署
- 每个节点一个Pod
- ConfigMap管理配置
```

### 9.2 资源配置

**云端组件资源配置**:

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| Edge Gateway | 3-10 | 2核 | 4GB | - | HPA自动扩缩容 |
| MQTT Broker | 3 | 1核 | 2GB | 10GB | StatefulSet |
| PostgreSQL | 3 | 4核 | 8GB | 100GB | 主从复制 |
| Redis | 6 | 2核 | 4GB | 20GB | 集群模式 |

**边缘Agent资源配置**:

| 配置级别 | CPU | 内存 | 磁盘 | 适用场景 |
|---------|-----|------|------|----------|
| 最小 | 1核 | 512MB | 2GB | 小型设备，低日志量 |
| 推荐 | 2核 | 2GB | 10GB | 中型设备，中等日志量 |
| 高性能 | 4核 | 4GB | 50GB | 大型设备，高日志量 |

### 9.3 部署流程

**边缘Agent安装脚本**:
```bash
#!/bin/bash
# Edge Agent一键安装脚本

set -e

# 检测系统架构
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        ARCH="amd64"
        ;;
    aarch64)
        ARCH="arm64"
        ;;
    armv7l)
        ARCH="armv7"
        ;;
    *)
        echo "不支持的架构: $ARCH"
        exit 1
        ;;
esac

# 下载二进制文件
echo "下载Edge Agent..."
wget -O /tmp/edge-agent https://gateway.example.com/downloads/edge-agent-linux-${ARCH}

# 安装
echo "安装Edge Agent..."
sudo mv /tmp/edge-agent /usr/local/bin/edge-agent
sudo chmod +x /usr/local/bin/edge-agent

# 创建配置目录
sudo mkdir -p /etc/edge-agent
sudo mkdir -p /var/lib/edge-agent
sudo mkdir -p /var/log/edge-agent

# 创建配置文件
cat <<EOF | sudo tee /etc/edge-agent/config.yaml
gateway:
  url: https://gateway.example.com
  token: YOUR_TOKEN_HERE

collection:
  sources:
    - type: file
      path: /var/log/*.log
      enabled: true

buffer:
  max_size_mb: 1024
  storage_type: boltdb

upload:
  batch_size: 1000
  interval_seconds: 60
EOF

# 创建systemd服务
cat <<EOF | sudo tee /etc/systemd/system/edge-agent.service
[Unit]
Description=Edge Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/edge-agent --config /etc/edge-agent/config.yaml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# 启动服务
echo "启动Edge Agent..."
sudo systemctl daemon-reload
sudo systemctl enable edge-agent
sudo systemctl start edge-agent

echo "Edge Agent安装完成！"
echo "查看状态: sudo systemctl status edge-agent"
echo "查看日志: sudo journalctl -u edge-agent -f"
```

---

## 10. 监控与运维

### 10.1 监控指标

**Edge Agent指标**:
```prometheus
# 系统资源指标
edge_agent_cpu_usage_percent{node_id="edge-001"} 15.5
edge_agent_memory_usage_bytes{node_id="edge-001"} 52428800
edge_agent_disk_usage_bytes{node_id="edge-001"} 1073741824

# 采集指标
edge_agent_logs_collected_total{node_id="edge-001",source="file"} 10000
edge_agent_logs_filtered_total{node_id="edge-001",reason="level"} 2000
edge_agent_logs_sampled_total{node_id="edge-001"} 1000

# 缓存指标
edge_agent_buffer_size_bytes{node_id="edge-001"} 10485760
edge_agent_buffer_usage_percent{node_id="edge-001"} 45.2
edge_agent_pending_logs_total{node_id="edge-001"} 500

# 上传指标
edge_agent_logs_uploaded_total{node_id="edge-001"} 8000
edge_agent_upload_failures_total{node_id="edge-001",reason="timeout"} 10
edge_agent_upload_duration_seconds{node_id="edge-001"} 0.15
edge_agent_upload_bytes_total{node_id="edge-001"} 8388608

# 配置指标
edge_agent_config_version{node_id="edge-001"} 2
edge_agent_config_updates_total{node_id="edge-001"} 5
edge_agent_config_update_failures_total{node_id="edge-001"} 0

# 网络指标
edge_agent_network_status{node_id="edge-001",status="online"} 1
edge_agent_heartbeat_failures_total{node_id="edge-001"} 2
```

**Edge Gateway指标**:
```prometheus
# 节点管理指标
edge_gateway_nodes_total{status="online"} 150
edge_gateway_nodes_registered_total 200
edge_gateway_nodes_offline_total 50

# 数据接收指标
edge_gateway_data_received_bytes_total{node_id="edge-001"} 104857600
edge_gateway_data_received_logs_total{node_id="edge-001"} 100000
edge_gateway_data_receive_duration_seconds 0.05

# 配置下发指标
edge_gateway_config_updates_total{node_id="edge-001"} 10
edge_gateway_config_update_failures_total{node_id="edge-001"} 1

# 心跳指标
edge_gateway_heartbeats_received_total{node_id="edge-001"} 1440
edge_gateway_heartbeat_latency_seconds{node_id="edge-001"} 0.02
```

### 10.2 告警规则（支持热更新）

**系统预置告警规则**:

| 告警名称 | 条件 | 级别 | 处理方式 | 热更新 |
|---------|------|------|----------|--------|
| 节点离线 | 心跳超时3分钟 | Warning | 检查网络连接，重启Agent | ✅ |
| 节点长时间离线 | 离线超过30分钟 | Critical | 人工介入，现场检查 | ✅ |
| 缓存使用率高 | 缓存使用率 > 80% | Warning | 检查网络，加快上传 | ✅ |
| 缓存满 | 缓存使用率 > 95% | Critical | 紧急处理，清理缓存 | ✅ |
| 上传失败率高 | 上传失败率 > 10% | Warning | 检查网络和服务端 | ✅ |
| CPU使用率高 | CPU > 80% | Warning | 检查配置，优化性能 | ✅ |
| 内存使用率高 | 内存 > 80% | Warning | 检查内存泄漏 | ✅ |
| 磁盘使用率高 | 磁盘 > 90% | Critical | 清理磁盘空间 | ✅ |
| 配置更新失败 | 配置更新失败 | Warning | 检查配置格式，重试 | ✅ |
| Agent崩溃 | Agent进程退出 | Critical | 自动重启，记录日志 | ✅ |

**自定义告警规则支持**:

```yaml
# 告警规则配置（支持热更新）
alert_rules:
  # 规则1: 自定义缓存告警阈值
  - name: "custom_buffer_alert"
    enabled: true
    type: "metric"
    metric: "edge_agent_buffer_usage_percent"
    condition: "> 85"
    duration: "5m"
    severity: "warning"
    message: "节点 {{.node_id}} 缓存使用率超过85%"
    actions:
      - type: "webhook"
        url: "https://alert.example.com/webhook"
      - type: "email"
        to: ["admin@example.com"]
    
  # 规则2: 自定义上传延迟告警
  - name: "upload_latency_high"
    enabled: true
    type: "metric"
    metric: "edge_agent_upload_duration_seconds"
    condition: "> 5"
    duration: "10m"
    severity: "warning"
    message: "节点 {{.node_id}} 上传延迟超过5秒"
    actions:
      - type: "log"
      - type: "mqtt"
        topic: "alerts/edge/{{.node_id}}"
    
  # 规则3: 自定义日志采集异常告警
  - name: "collection_failure"
    enabled: true
    type: "event"
    event: "collection_error"
    condition: "count > 10"
    window: "5m"
    severity: "critical"
    message: "节点 {{.node_id}} 在5分钟内采集失败超过10次"
    actions:
      - type: "webhook"
        url: "https://alert.example.com/webhook"
      - type: "sms"
        to: ["+86-138****1234"]
```

**告警规则热更新实现**:

```go
// 告警规则管理器
type AlertRuleManager struct {
    rules       atomic.Value // []*AlertRule
    mqttClient  mqtt.Client
    nodeID      string
    evaluators  map[string]*RuleEvaluator
    mu          sync.RWMutex
}

// 告警规则定义
type AlertRule struct {
    Name      string            `json:"name"`
    Enabled   bool              `json:"enabled"`
    Type      string            `json:"type"` // metric, event, log
    Metric    string            `json:"metric,omitempty"`
    Event     string            `json:"event,omitempty"`
    Condition string            `json:"condition"`
    Duration  string            `json:"duration,omitempty"`
    Window    string            `json:"window,omitempty"`
    Severity  string            `json:"severity"` // info, warning, critical
    Message   string            `json:"message"`
    Actions   []AlertAction     `json:"actions"`
    Labels    map[string]string `json:"labels,omitempty"`
}

// 告警动作
type AlertAction struct {
    Type   string                 `json:"type"` // webhook, email, sms, mqtt, log
    Config map[string]interface{} `json:"config"`
}

// 初始化告警规则管理器
func NewAlertRuleManager(nodeID string, mqttClient mqtt.Client) *AlertRuleManager {
    arm := &AlertRuleManager{
        nodeID:     nodeID,
        mqttClient: mqttClient,
        evaluators: make(map[string]*RuleEvaluator),
    }
    
    // 加载初始规则
    rules := arm.loadDefaultRules()
    arm.rules.Store(rules)
    
    // 订阅规则变更
    arm.subscribeRuleChanges()
    
    // 启动规则评估器
    arm.startEvaluators()
    
    return arm
}

// 订阅MQTT告警规则变更
func (arm *AlertRuleManager) subscribeRuleChanges() {
    topic := fmt.Sprintf("edge/%s/alert-rules", arm.nodeID)
    
    arm.mqttClient.Subscribe(topic, 1, func(client mqtt.Client, msg mqtt.Message) {
        log.Info("收到告警规则更新消息")
        
        var rulesMsg struct {
            Version   int          `json:"version"`
            Rules     []*AlertRule `json:"rules"`
            Timestamp time.Time    `json:"timestamp"`
        }
        
        if err := json.Unmarshal(msg.Payload(), &rulesMsg); err != nil {
            log.Error("解析告警规则失败", "error", err)
            return
        }
        
        // 验证规则
        for _, rule := range rulesMsg.Rules {
            if err := rule.Validate(); err != nil {
                log.Error("告警规则验证失败", "rule", rule.Name, "error", err)
                return
            }
        }
        
        // 应用新规则（热更新）
        if err := arm.applyRules(rulesMsg.Rules); err != nil {
            log.Error("应用告警规则失败", "error", err)
            return
        }
        
        log.Info("告警规则更新成功", "count", len(rulesMsg.Rules))
    })
}

// 应用告警规则（热更新）
func (arm *AlertRuleManager) applyRules(newRules []*AlertRule) error {
    // 原子更新规则
    arm.rules.Store(newRules)
    
    // 重新加载评估器
    arm.mu.Lock()
    defer arm.mu.Unlock()
    
    // 停止旧的评估器
    for _, evaluator := range arm.evaluators {
        evaluator.Stop()
    }
    
    // 创建新的评估器
    arm.evaluators = make(map[string]*RuleEvaluator)
    for _, rule := range newRules {
        if rule.Enabled {
            evaluator := NewRuleEvaluator(rule, arm)
            arm.evaluators[rule.Name] = evaluator
            go evaluator.Start()
        }
    }
    
    return nil
}

// 获取当前规则
func (arm *AlertRuleManager) GetRules() []*AlertRule {
    return arm.rules.Load().([]*AlertRule)
}

// 规则评估器
type RuleEvaluator struct {
    rule       *AlertRule
    manager    *AlertRuleManager
    stopCh     chan struct{}
    lastAlert  time.Time
    alertCount int
}

// 启动评估器
func (e *RuleEvaluator) Start() {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ticker.C:
            e.evaluate()
        case <-e.stopCh:
            return
        }
    }
}

// 评估规则
func (e *RuleEvaluator) evaluate() {
    switch e.rule.Type {
    case "metric":
        e.evaluateMetric()
    case "event":
        e.evaluateEvent()
    case "log":
        e.evaluateLog()
    }
}

// 评估指标规则
func (e *RuleEvaluator) evaluateMetric() {
    // 获取指标值
    value := e.getMetricValue(e.rule.Metric)
    
    // 评估条件
    if e.checkCondition(value, e.rule.Condition) {
        // 检查持续时间
        if e.checkDuration(e.rule.Duration) {
            // 触发告警
            e.triggerAlert(value)
        }
    } else {
        // 重置计数
        e.alertCount = 0
    }
}

// 触发告警
func (e *RuleEvaluator) triggerAlert(value interface{}) {
    // 构建告警消息
    alert := &Alert{
        RuleName:  e.rule.Name,
        NodeID:    e.manager.nodeID,
        Severity:  e.rule.Severity,
        Message:   e.renderMessage(value),
        Value:     value,
        Timestamp: time.Now(),
        Labels:    e.rule.Labels,
    }
    
    // 执行告警动作
    for _, action := range e.rule.Actions {
        e.executeAction(action, alert)
    }
    
    // 记录告警
    e.lastAlert = time.Now()
    e.alertCount++
    
    log.Info("告警已触发", 
        "rule", e.rule.Name, 
        "severity", e.rule.Severity,
        "value", value)
}

// 执行告警动作
func (e *RuleEvaluator) executeAction(action AlertAction, alert *Alert) {
    switch action.Type {
    case "webhook":
        e.sendWebhook(action.Config, alert)
    case "email":
        e.sendEmail(action.Config, alert)
    case "sms":
        e.sendSMS(action.Config, alert)
    case "mqtt":
        e.publishMQTT(action.Config, alert)
    case "log":
        e.logAlert(alert)
    }
}

// 发送Webhook
func (e *RuleEvaluator) sendWebhook(config map[string]interface{}, alert *Alert) {
    url := config["url"].(string)
    
    payload, _ := json.Marshal(alert)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(payload))
    if err != nil {
        log.Error("发送Webhook失败", "error", err)
        return
    }
    defer resp.Body.Close()
    
    log.Info("Webhook已发送", "url", url, "status", resp.StatusCode)
}

// 告警规则验证
func (r *AlertRule) Validate() error {
    if r.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if r.Type == "" {
        return fmt.Errorf("规则类型不能为空")
    }
    
    validTypes := map[string]bool{"metric": true, "event": true, "log": true}
    if !validTypes[r.Type] {
        return fmt.Errorf("无效的规则类型: %s", r.Type)
    }
    
    if r.Condition == "" {
        return fmt.Errorf("规则条件不能为空")
    }
    
    validSeverities := map[string]bool{"info": true, "warning": true, "critical": true}
    if !validSeverities[r.Severity] {
        return fmt.Errorf("无效的严重级别: %s", r.Severity)
    }
    
    if len(r.Actions) == 0 {
        return fmt.Errorf("至少需要一个告警动作")
    }
    
    return nil
}
```

**告警规则API接口**:

```go
// 创建自定义告警规则（热更新）
// POST /api/v1/edge/nodes/{node_id}/alert-rules
func CreateAlertRule(c *gin.Context) {
    nodeID := c.Param("node_id")
    
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 验证规则
    if err := rule.Validate(); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 保存到数据库
    if err := db.CreateAlertRule(nodeID, &rule); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 通过MQTT推送到边缘节点（热更新）
    if err := publishAlertRules(nodeID); err != nil {
        log.Error("推送告警规则失败", "error", err)
    }
    
    c.JSON(200, rule)
}

// 更新告警规则（热更新）
// PUT /api/v1/edge/nodes/{node_id}/alert-rules/{rule_name}
func UpdateAlertRule(c *gin.Context) {
    nodeID := c.Param("node_id")
    ruleName := c.Param("rule_name")
    
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 验证规则
    if err := rule.Validate(); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 更新数据库
    if err := db.UpdateAlertRule(nodeID, ruleName, &rule); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 通过MQTT推送到边缘节点（热更新）
    if err := publishAlertRules(nodeID); err != nil {
        log.Error("推送告警规则失败", "error", err)
    }
    
    c.JSON(200, rule)
}

// 删除告警规则（热更新）
// DELETE /api/v1/edge/nodes/{node_id}/alert-rules/{rule_name}
func DeleteAlertRule(c *gin.Context) {
    nodeID := c.Param("node_id")
    ruleName := c.Param("rule_name")
    
    // 从数据库删除
    if err := db.DeleteAlertRule(nodeID, ruleName); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 通过MQTT推送到边缘节点（热更新）
    if err := publishAlertRules(nodeID); err != nil {
        log.Error("推送告警规则失败", "error", err)
    }
    
    c.JSON(200, gin.H{"message": "告警规则已删除"})
}

// 启用/禁用告警规则（热更新）
// PATCH /api/v1/edge/nodes/{node_id}/alert-rules/{rule_name}/toggle
func ToggleAlertRule(c *gin.Context) {
    nodeID := c.Param("node_id")
    ruleName := c.Param("rule_name")
    
    var req struct {
        Enabled bool `json:"enabled"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    
    // 更新数据库
    if err := db.ToggleAlertRule(nodeID, ruleName, req.Enabled); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 通过MQTT推送到边缘节点（热更新）
    if err := publishAlertRules(nodeID); err != nil {
        log.Error("推送告警规则失败", "error", err)
    }
    
    c.JSON(200, gin.H{"message": "告警规则状态已更新"})
}

// 推送告警规则到边缘节点
func publishAlertRules(nodeID string) error {
    // 从数据库获取所有规则
    rules, err := db.GetAlertRules(nodeID)
    if err != nil {
        return err
    }
    
    // 构建消息
    msg := map[string]interface{}{
        "version":   time.Now().Unix(),
        "rules":     rules,
        "timestamp": time.Now(),
    }
    
    payload, _ := json.Marshal(msg)
    
    // 发布到MQTT
    topic := fmt.Sprintf("edge/%s/alert-rules", nodeID)
    token := mqttClient.Publish(topic, 1, true, payload)
    token.Wait()
    
    return token.Error()
}
```

**YAML配置文件方式（备用）**:

```yaml
# /etc/edge-agent/alert-rules.yaml
# 修改后需要重启Agent生效

alert_rules:
  - name: "buffer_usage_high"
    enabled: true
    type: "metric"
    metric: "edge_agent_buffer_usage_percent"
    condition: "> 80"
    duration: "5m"
    severity: "warning"
    message: "缓存使用率超过80%"
    actions:
      - type: "log"
      - type: "webhook"
        url: "https://alert.example.com/webhook"
```

**告警规则更新优先级**:
1. ✅ **优先**: MQTT热更新（实时生效，无需重启）
2. ⚠️ **备用**: YAML文件配置（需要重启Agent）

### 10.3 日志规范

**日志级别**:
- ERROR: 错误事件，需要立即处理
- WARN: 警告事件，需要关注
- INFO: 重要信息事件
- DEBUG: 调试信息（生产环境关闭）

**日志格式**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "level": "INFO",
  "node_id": "edge-001",
  "component": "collector",
  "message": "日志采集成功",
  "fields": {
    "source": "file",
    "path": "/var/log/app.log",
    "count": 100
  }
}
```

### 10.4 运维手册

**常见问题处理**:

1. **节点无法注册**: 检查网络连接、认证Token、TLS证书
2. **数据上传失败**: 检查网络、Edge Gateway状态、本地缓存
3. **配置更新不生效**: 检查MQTT连接、配置版本号、配置格式
4. **内存占用过高**: 检查缓存大小、内存泄漏、Goroutine数量

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 热更新 |
|--------|------|--------|------|--------|
| edge_enabled | bool | true | 是否启用边缘计算 | ✅ |
| buffer_size_mb | int | 1024 | 本地缓冲区大小（MB） | ✅ |
| upload_interval | int | 60 | 上传间隔（秒） | ✅ |
| upload_batch_size | int | 1000 | 批量上传大小 | ✅ |
| compression_enabled | bool | true | 是否启用压缩 | ✅ |
| compression_type | string | gzip | 压缩类型（gzip/lz4/zstd） | ✅ |
| encryption_enabled | bool | false | 是否启用加密 | ✅ |
| sampling_rate | float | 1.0 | 采样率（0-1） | ✅ |
| filter_rules | array | [] | 过滤规则列表 | ✅ |
| collection_sources | array | [] | 采集源配置 | ✅ |
| heartbeat_interval | int | 60 | 心跳间隔（秒） | ✅ |
| log_level | string | info | 日志级别 | ✅ |
| **alert_rules** | **array** | **[]** | **告警规则列表** | **✅** |
| **alert_enabled** | **bool** | **true** | **是否启用告警** | **✅** |

**热更新方式优先级**:
1. ✅ **优先**: MQTT推送（实时生效，< 100ms）
2. ✅ **备用**: 定期拉取（5分钟间隔）
3. ⚠️ **降级**: YAML文件配置（需要重启Agent）

### 11.2 热更新实现

**方式1: MQTT推送（主方式）**

```go
// 配置管理器
type ConfigManager struct {
    config       atomic.Value // *EdgeConfig
    mqttClient   mqtt.Client
    nodeID       string
    configPath   string
    subscribers  []func(*EdgeConfig)
    mu           sync.RWMutex
}

// 初始化配置管理器
func NewConfigManager(nodeID string, mqttClient mqtt.Client) *ConfigManager {
    cm := &ConfigManager{
        nodeID:     nodeID,
        mqttClient: mqttClient,
        subscribers: make([]func(*EdgeConfig), 0),
    }
    
    // 加载初始配置
    config, _ := cm.loadConfigFromFile()
    cm.config.Store(config)
    
    // 订阅配置变更
    cm.subscribeConfigChanges()
    
    return cm
}

// 订阅MQTT配置变更
func (cm *ConfigManager) subscribeConfigChanges() {
    topic := fmt.Sprintf("edge/%s/config", cm.nodeID)
    
    cm.mqttClient.Subscribe(topic, 1, func(client mqtt.Client, msg mqtt.Message) {
        log.Info("收到配置更新消息")
        
        // 解析配置
        var configMsg struct {
            Version   int         `json:"version"`
            Config    *EdgeConfig `json:"config"`
            Timestamp time.Time   `json:"timestamp"`
        }
        
        if err := json.Unmarshal(msg.Payload(), &configMsg); err != nil {
            log.Error("解析配置失败", "error", err)
            cm.sendConfigAck(configMsg.Version, "failed", err.Error())
            return
        }
        
        // 验证配置
        if err := configMsg.Config.Validate(); err != nil {
            log.Error("配置验证失败", "error", err)
            cm.sendConfigAck(configMsg.Version, "failed", err.Error())
            return
        }
        
        // 检查版本号（必须递增）
        currentConfig := cm.GetConfig()
        if configMsg.Version <= currentConfig.Version {
            log.Warn("配置版本号未递增，忽略更新", 
                "current", currentConfig.Version, 
                "new", configMsg.Version)
            return
        }
        
        // 备份当前配置
        if err := cm.backupConfig(currentConfig); err != nil {
            log.Error("备份配置失败", "error", err)
        }
        
        // 应用新配置（热更新）
        if err := cm.applyConfig(configMsg.Config); err != nil {
            log.Error("应用配置失败", "error", err)
            // 回滚到备份配置
            cm.rollbackConfig()
            cm.sendConfigAck(configMsg.Version, "failed", err.Error())
            return
        }
        
        // 保存配置到文件
        if err := cm.saveConfigToFile(configMsg.Config); err != nil {
            log.Error("保存配置失败", "error", err)
        }
        
        // 发送确认消息
        cm.sendConfigAck(configMsg.Version, "applied", "")
        
        log.Info("配置更新成功", "version", configMsg.Version)
    })
}

// 应用配置（热更新）
func (cm *ConfigManager) applyConfig(newConfig *EdgeConfig) error {
    // 原子更新配置
    cm.config.Store(newConfig)
    
    // 通知所有订阅者
    cm.mu.RLock()
    subscribers := cm.subscribers
    cm.mu.RUnlock()
    
    for _, subscriber := range subscribers {
        go subscriber(newConfig)
    }
    
    return nil
}

// 获取当前配置
func (cm *ConfigManager) GetConfig() *EdgeConfig {
    return cm.config.Load().(*EdgeConfig)
}

// 订阅配置变更
func (cm *ConfigManager) Subscribe(callback func(*EdgeConfig)) {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    cm.subscribers = append(cm.subscribers, callback)
}

// 发送配置确认
func (cm *ConfigManager) sendConfigAck(version int, status, errorMsg string) {
    topic := fmt.Sprintf("edge/%s/config/ack", cm.nodeID)
    
    ack := map[string]interface{}{
        "version":   version,
        "status":    status,
        "error":     errorMsg,
        "timestamp": time.Now(),
    }
    
    payload, _ := json.Marshal(ack)
    cm.mqttClient.Publish(topic, 1, false, payload)
}

// 备份配置
func (cm *ConfigManager) backupConfig(config *EdgeConfig) error {
    backupPath := cm.configPath + ".backup"
    data, err := json.MarshalIndent(config, "", "  ")
    if err != nil {
        return err
    }
    return os.WriteFile(backupPath, data, 0644)
}

// 回滚配置
func (cm *ConfigManager) rollbackConfig() error {
    backupPath := cm.configPath + ".backup"
    config, err := cm.loadConfigFromFile()
    if err != nil {
        return err
    }
    cm.config.Store(config)
    log.Info("配置已回滚")
    return nil
}
```

**方式2: 定期拉取（备用方式）**

```go
// 定期拉取配置
func (cm *ConfigManager) startConfigPuller() {
    ticker := time.NewTicker(5 * time.Minute)
    defer ticker.Stop()
    
    for range ticker.C {
        if err := cm.pullConfig(); err != nil {
            log.Error("拉取配置失败", "error", err)
        }
    }
}

// 拉取配置
func (cm *ConfigManager) pullConfig() error {
    url := fmt.Sprintf("https://gateway.example.com/api/v1/edge/nodes/%s/config", cm.nodeID)
    
    resp, err := http.Get(url)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    var configResp struct {
        Version int         `json:"version"`
        Config  *EdgeConfig `json:"config"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&configResp); err != nil {
        return err
    }
    
    // 检查版本号
    currentConfig := cm.GetConfig()
    if configResp.Version > currentConfig.Version {
        // 应用新配置
        return cm.applyConfig(configResp.Config)
    }
    
    return nil
}
```

### 11.3 配置验证

```go
// 配置验证
func (c *EdgeConfig) Validate() error {
    // 验证缓存大小
    if c.Buffer.MaxSizeMB < 100 || c.Buffer.MaxSizeMB > 10240 {
        return fmt.Errorf("缓存大小必须在100-10240MB之间")
    }
    
    // 验证上传间隔
    if c.Upload.IntervalSeconds < 10 || c.Upload.IntervalSeconds > 3600 {
        return fmt.Errorf("上传间隔必须在10-3600秒之间")
    }
    
    // 验证批次大小
    if c.Upload.BatchSize < 100 || c.Upload.BatchSize > 10000 {
        return fmt.Errorf("批次大小必须在100-10000之间")
    }
    
    // 验证采样率
    if c.Collection.SamplingRate < 0 || c.Collection.SamplingRate > 1 {
        return fmt.Errorf("采样率必须在0-1之间")
    }
    
    // 验证压缩类型
    validCompressions := map[string]bool{"gzip": true, "lz4": true, "zstd": true}
    if !validCompressions[c.Upload.Compression] {
        return fmt.Errorf("不支持的压缩类型: %s", c.Upload.Compression)
    }
    
    return nil
}
```

### 11.4 热更新验收标准

- ✅ 配置更新无需重启Agent
- ✅ 配置生效时间 < 100ms
- ✅ 支持配置验证和回滚
- ✅ 支持MQTT推送和定期拉取两种方式
- ✅ 配置变更有审计日志
- ✅ 支持配置版本管理
- ✅ 更新失败自动回滚

### 11.5 不推荐热更新的配置

模块23的所有配置项都**推荐使用热更新**，原因如下：

| 配置项 | 是否热更新 | 说明 |
|--------|-----------|------|
| edge_enabled | ✅ 推荐 | 可以动态启用/禁用边缘计算功能，不影响已有连接 |
| buffer_size_mb | ✅ 推荐 | 可以动态调整缓冲区大小，通过内存重分配实现 |
| upload_interval | ✅ 推荐 | 可以动态调整上传间隔，重置定时器即可 |
| upload_batch_size | ✅ 推荐 | 可以动态调整批次大小，不影响已有批次 |
| compression_enabled | ✅ 推荐 | 可以动态启用/禁用压缩，对新数据生效 |
| compression_type | ✅ 推荐 | 可以动态切换压缩算法，对新数据生效 |
| encryption_enabled | ✅ 推荐 | 可以动态启用/禁用加密，对新数据生效 |
| sampling_rate | ✅ 推荐 | 可以动态调整采样率，立即生效 |
| filter_rules | ✅ 推荐 | 可以动态更新过滤规则，对新日志生效 |
| collection_sources | ✅ 推荐 | 可以动态添加/删除采集源，启动/停止对应的采集器 |
| heartbeat_interval | ✅ 推荐 | 可以动态调整心跳间隔，重置定时器即可 |
| log_level | ✅ 推荐 | 可以动态调整日志级别，立即生效 |
| alert_rules | ✅ 推荐 | 可以动态更新告警规则，对新日志生效 |
| alert_enabled | ✅ 推荐 | 可以动态启用/禁用告警功能 |

**配置覆盖率**: 100% (14/14项)

**特殊说明**:
- 边缘计算模块的所有配置都设计为支持热更新
- 通过MQTT推送实现实时配置下发（< 100ms）
- 配置变更通过原子操作和订阅者模式实现无缝切换
- 所有配置变更都有版本控制和回滚机制

### 11.6 配置热更新扩展接口

为了支持未来的配置热更新扩展，预留以下接口：

```go
// ConfigUpdateHandler 配置更新处理器接口
type ConfigUpdateHandler interface {
    // OnConfigUpdate 配置更新回调
    // oldConfig: 旧配置
    // newConfig: 新配置
    // 返回错误时会触发回滚
    OnConfigUpdate(oldConfig, newConfig *EdgeConfig) error
    
    // GetHandlerName 获取处理器名称
    GetHandlerName() string
    
    // GetPriority 获取处理器优先级（数字越小优先级越高）
    GetPriority() int
}

// ConfigValidator 配置验证器接口
type ConfigValidator interface {
    // Validate 验证配置
    Validate(config *EdgeConfig) error
    
    // GetValidatorName 获取验证器名称
    GetValidatorName() string
}

// ConfigSource 配置源接口
type ConfigSource interface {
    // FetchConfig 获取配置
    FetchConfig(nodeID string) (*EdgeConfig, error)
    
    // WatchConfig 监听配置变更
    WatchConfig(nodeID string, callback func(*EdgeConfig)) error
    
    // GetSourceName 获取配置源名称
    GetSourceName() string
}

// 扩展配置管理器
type ExtendedConfigManager struct {
    *ConfigManager
    handlers   []ConfigUpdateHandler
    validators []ConfigValidator
    sources    []ConfigSource
}

// RegisterHandler 注册配置更新处理器
func (ecm *ExtendedConfigManager) RegisterHandler(handler ConfigUpdateHandler) {
    ecm.handlers = append(ecm.handlers, handler)
    // 按优先级排序
    sort.Slice(ecm.handlers, func(i, j int) bool {
        return ecm.handlers[i].GetPriority() < ecm.handlers[j].GetPriority()
    })
}

// RegisterValidator 注册配置验证器
func (ecm *ExtendedConfigManager) RegisterValidator(validator ConfigValidator) {
    ecm.validators = append(ecm.validators, validator)
}

// RegisterSource 注册配置源
func (ecm *ExtendedConfigManager) RegisterSource(source ConfigSource) {
    ecm.sources = append(ecm.sources, source)
}

// ApplyConfigWithHandlers 应用配置（调用所有处理器）
func (ecm *ExtendedConfigManager) ApplyConfigWithHandlers(newConfig *EdgeConfig) error {
    oldConfig := ecm.GetConfig()
    
    // 1. 执行所有验证器
    for _, validator := range ecm.validators {
        if err := validator.Validate(newConfig); err != nil {
            return fmt.Errorf("验证器 %s 失败: %w", validator.GetValidatorName(), err)
        }
    }
    
    // 2. 执行所有处理器（按优先级）
    for _, handler := range ecm.handlers {
        if err := handler.OnConfigUpdate(oldConfig, newConfig); err != nil {
            return fmt.Errorf("处理器 %s 失败: %w", handler.GetHandlerName(), err)
        }
    }
    
    // 3. 应用配置
    return ecm.applyConfig(newConfig)
}
```

**扩展示例**:

```go
// 示例1: 自定义配置验证器
type ResourceValidator struct{}

func (rv *ResourceValidator) Validate(config *EdgeConfig) error {
    // 检查系统资源是否满足配置要求
    if config.Buffer.MaxSizeMB > getAvailableMemoryMB() {
        return fmt.Errorf("缓冲区大小超过可用内存")
    }
    return nil
}

func (rv *ResourceValidator) GetValidatorName() string {
    return "ResourceValidator"
}

// 示例2: 自定义配置更新处理器
type MetricsHandler struct {
    metricsClient *MetricsClient
}

func (mh *MetricsHandler) OnConfigUpdate(oldConfig, newConfig *EdgeConfig) error {
    // 记录配置变更指标
    mh.metricsClient.RecordConfigChange(oldConfig, newConfig)
    return nil
}

func (mh *MetricsHandler) GetHandlerName() string {
    return "MetricsHandler"
}

func (mh *MetricsHandler) GetPriority() int {
    return 100 // 低优先级，最后执行
}

// 示例3: 自定义配置源（从Consul获取配置）
type ConsulConfigSource struct {
    consulClient *consul.Client
}

func (ccs *ConsulConfigSource) FetchConfig(nodeID string) (*EdgeConfig, error) {
    key := fmt.Sprintf("edge/nodes/%s/config", nodeID)
    pair, _, err := ccs.consulClient.KV().Get(key, nil)
    if err != nil {
        return nil, err
    }
    
    var config EdgeConfig
    if err := json.Unmarshal(pair.Value, &config); err != nil {
        return nil, err
    }
    
    return &config, nil
}

func (ccs *ConsulConfigSource) WatchConfig(nodeID string, callback func(*EdgeConfig)) error {
    key := fmt.Sprintf("edge/nodes/%s/config", nodeID)
    
    go func() {
        var lastIndex uint64
        for {
            pair, meta, err := ccs.consulClient.KV().Get(key, &consul.QueryOptions{
                WaitIndex: lastIndex,
            })
            if err != nil {
                log.Error("监听Consul配置失败", "error", err)
                time.Sleep(5 * time.Second)
                continue
            }
            
            if meta.LastIndex > lastIndex {
                lastIndex = meta.LastIndex
                var config EdgeConfig
                if err := json.Unmarshal(pair.Value, &config); err != nil {
                    log.Error("解析配置失败", "error", err)
                    continue
                }
                callback(&config)
            }
        }
    }()
    
    return nil
}

func (ccs *ConsulConfigSource) GetSourceName() string {
    return "ConsulConfigSource"
}

// 使用扩展接口
func main() {
    // 创建扩展配置管理器
    ecm := &ExtendedConfigManager{
        ConfigManager: NewConfigManager(nodeID, mqttClient),
    }
    
    // 注册自定义验证器
    ecm.RegisterValidator(&ResourceValidator{})
    
    // 注册自定义处理器
    ecm.RegisterHandler(&MetricsHandler{
        metricsClient: metricsClient,
    })
    
    // 注册自定义配置源
    ecm.RegisterSource(&ConsulConfigSource{
        consulClient: consulClient,
    })
}
```

**扩展点说明**:
1. **ConfigUpdateHandler**: 在配置更新时执行自定义逻辑（如记录指标、发送通知等）
2. **ConfigValidator**: 添加自定义验证规则（如资源检查、业务规则验证等）
3. **ConfigSource**: 支持从多种配置源获取配置（如Consul、etcd、数据库等）
4. **优先级机制**: 处理器按优先级顺序执行，支持精细控制
5. **错误处理**: 任何处理器失败都会触发回滚，保证配置一致性

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 网络不稳定导致数据丢失 | 高 | 高 | 本地缓存+断点续传 |
| 边缘设备资源不足 | 中 | 中 | 资源监控+自动降级 |
| 配置错误导致Agent异常 | 中 | 高 | 配置验证+自动回滚 |
| Agent崩溃导致服务中断 | 低 | 高 | Systemd自动重启 |
| 本地缓存满导致数据淘汰 | 中 | 中 | 缓存监控+告警 |
| 证书过期导致认证失败 | 低 | 高 | 证书监控+自动更新 |
| 版本不兼容导致升级失败 | 低 | 中 | 灰度升级+版本检查 |
| MQTT连接断开 | 中 | 中 | 自动重连+遗嘱消息 |

### 12.2 回滚方案

**配置回滚**:
```
1. 自动回滚
   - 配置验证失败时自动回滚
   - 应用配置失败时自动回滚
   - 加载备份配置
   - 通知云端回滚事件

2. 手动回滚
   - 通过API触发回滚
   - 回滚到指定版本
   - 记录回滚操作
```

**版本回滚**:
```
1. Agent版本回滚
   - 停止当前版本
   - 恢复备份的旧版本
   - 重启Agent
   - 验证功能正常

2. 回滚脚本
   ```bash
   #!/bin/bash
   # 回滚到上一版本
   
   systemctl stop edge-agent
   cp /usr/local/bin/edge-agent.backup /usr/local/bin/edge-agent
   systemctl start edge-agent
   systemctl status edge-agent
   ```
```

**数据回滚**:
```
1. 本地缓存恢复
   - 从备份恢复BoltDB
   - 验证数据完整性
   - 重新上传数据

2. 配置文件恢复
   - 从备份恢复配置文件
   - 重启Agent
   - 验证配置生效
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| Edge Agent | 边缘侧轻量级日志采集器 |
| Edge Gateway | 云端边缘节点管理服务 |
| BoltDB | 嵌入式键值数据库，用于本地缓存 |
| MQTT | 轻量级消息协议，用于配置下发和心跳上报 |
| 断点续传 | 网络中断后从断点位置继续上传数据 |
| 热更新 | 无需重启即可更新配置 |
| FIFO | 先进先出，缓存淘汰策略 |
| QoS | 服务质量，MQTT消息传递保证级别 |
| 遗嘱消息 | MQTT客户端异常断开时自动发送的消息 |
| 采样 | 按比例或规则选择部分日志进行采集 |
| 脱敏 | 对敏感数据进行掩码处理 |

### 13.2 参考文档

- [需求文档](../requirements/requirements-module23.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块1设计文档](./design-module1.md) - 日志采集
- [模块2设计文档](./design-module2.md) - 日志存储
- [BoltDB官方文档](https://github.com/boltdb/bolt)
- [Eclipse Paho MQTT](https://www.eclipse.org/paho/)
- [MQTT协议规范](https://mqtt.org/)
- [Go交叉编译指南](https://golang.org/doc/install/source#environment)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-02-01 | v1.1 | 补充不推荐热更新配置说明和扩展接口设计 | 系统架构团队 |
