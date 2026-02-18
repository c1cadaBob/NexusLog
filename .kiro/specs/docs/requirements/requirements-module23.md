# 模块二十三：边缘计算

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块二十三：边缘计算  
> **实施阶段**: Phase 3

---

## 模块概述

支持 IoT 与边缘设备日志采集，提供轻量级边缘采集器和边缘-云同步机制。

**边缘场景分析**:

| 场景 | 设备类型 | 网络条件 | 日志量 |
|------|----------|----------|--------|
| 工厂车间 | 工控机、PLC | 内网稳定 | 中等 |
| 零售门店 | POS、摄像头 | 4G/WiFi | 低 |
| 车联网 | 车载终端 | 4G 不稳定 | 高 |
| 智能家居 | 网关、传感器 | WiFi | 低 |

**模块架构**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Edge Computing Architecture               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                    Cloud Layer                       │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │    │
│  │  │  Kafka  │  │   ES    │  │  MinIO  │             │    │
│  │  └────▲────┘  └────▲────┘  └────▲────┘             │    │
│  │       │            │            │                   │    │
│  │  ┌────┴────────────┴────────────┴────┐             │    │
│  │  │         Edge Gateway               │             │    │
│  │  │  - 边缘节点注册/管理               │             │    │
│  │  │  - 配置下发                        │             │    │
│  │  │  - 数据接收/聚合                   │             │    │
│  │  └───────────────▲───────────────────┘             │    │
│  └──────────────────│───────────────────────────────────┘   │
│                     │ HTTPS/MQTT                             │
│  ┌──────────────────│───────────────────────────────────┐   │
│  │                  │        Edge Layer                  │   │
│  │  ┌───────────────┴───────────────────┐               │   │
│  │  │         Edge Agent                 │               │   │
│  │  │  - 本地日志采集                    │               │   │
│  │  │  - 本地缓存 (SQLite/BoltDB)        │               │   │
│  │  │  - 断点续传                        │               │   │
│  │  │  - 本地预处理/过滤                 │               │   │
│  │  └───────────────────────────────────┘               │   │
│  │                  │                                    │   │
│  │  ┌───────┬───────┼───────┬───────┐                   │   │
│  │  ▼       ▼       ▼       ▼       ▼                   │   │
│  │ ┌───┐  ┌───┐  ┌───┐  ┌───┐  ┌───┐                   │   │
│  │ │PLC│  │IoT│  │POS│  │CAM│  │GW │                   │   │
│  │ └───┘  └───┘  └───┘  └───┘  └───┘                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 需求 23-1：轻量级边缘采集器 [Phase 3]

**用户故事**: 

作为 IoT 工程师，我希望能够在资源受限的边缘设备上运行日志采集器。

**验收标准**:

1. THE Agent SHALL 支持 ARM/ARM64/x86 架构
2. THE Agent SHALL 内存占用 < 50MB
3. THE Agent SHALL 支持多种日志源（文件、syslog、MQTT）
4. THE Agent SHALL 支持本地过滤和采样
5. THE Agent SHALL 支持配置热更新

**技术规格**:

| 指标 | 要求 |
|------|------|
| 二进制大小 | < 20MB |
| 内存占用 | < 50MB |
| CPU 占用 | < 5% |
| 启动时间 | < 3s |

**实现方向**:

使用 Go 开发轻量级采集器，支持交叉编译到多种架构。

---

## 需求 23-2：边缘缓存与断点续传 [Phase 3]

**用户故事**: 

作为 IoT 工程师，我希望在网络不稳定时本地缓存日志，网络恢复后自动续传。

**验收标准**:

1. THE Agent SHALL 本地缓存容量可配置（默认 1GB）
2. THE Agent SHALL 支持 FIFO 淘汰策略
3. THE Agent SHALL 支持断点续传（记录上传位置）
4. THE Agent SHALL 支持压缩存储
5. THE Agent SHALL 支持加密存储（敏感数据）

**数据模型**:

```sql
-- SQLite 本地缓存表
CREATE TABLE log_buffer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    data BLOB NOT NULL,
    uploaded INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_uploaded ON log_buffer(uploaded, timestamp);
```

**实现方向**:

```go
// BoltDB 本地缓存
package edge

import (
    "github.com/boltdb/bolt"
)

type LocalBuffer struct {
    db       *bolt.DB
    maxSize  int64
    bucket   []byte
}

func NewLocalBuffer(config BufferConfig) *LocalBuffer {
    db, _ := bolt.Open(config.Path, 0600, nil)
    db.Update(func(tx *bolt.Tx) error {
        _, err := tx.CreateBucketIfNotExists([]byte("logs"))
        return err
    })

    return &LocalBuffer{
        db:      db,
        maxSize: config.MaxSizeBytes,
        bucket:  []byte("logs"),
    }
}

func (b *LocalBuffer) Write(data []byte) error {
    return b.db.Update(func(tx *bolt.Tx) error {
        bucket := tx.Bucket(b.bucket)
        id, _ := bucket.NextSequence()
        return bucket.Put(itob(id), data)
    })
}

func (b *LocalBuffer) ReadBatch(limit int) ([][]byte, error) {
    var results [][]byte
    b.db.View(func(tx *bolt.Tx) error {
        bucket := tx.Bucket(b.bucket)
        c := bucket.Cursor()
        for k, v := c.First(); k != nil && len(results) < limit; k, v = c.Next() {
            results = append(results, v)
        }
        return nil
    })
    return results, nil
}
```

---

## 需求 23-3：边缘节点管理 [Phase 3]

**用户故事**: 

作为平台管理员，我希望能够集中管理所有边缘节点的注册、配置和监控。

**验收标准**:

1. THE System SHALL 支持边缘节点自动注册
2. THE System SHALL 支持配置集中下发
3. THE System SHALL 支持节点状态监控（在线/离线/异常）
4. THE System SHALL 支持节点分组管理
5. THE System SHALL 支持远程升级

**API 设计**:

```yaml
# 边缘节点注册
POST /api/v1/edge/nodes/register
{
  "node_id": "edge-001",
  "hostname": "factory-floor-1",
  "arch": "arm64",
  "os": "linux",
  "version": "1.0.0",
  "capabilities": ["file", "syslog", "mqtt"]
}

# 配置下发
GET /api/v1/edge/nodes/{node_id}/config
Response:
{
  "collection": {
    "sources": [...],
    "filters": [...],
    "sampling_rate": 1.0
  },
  "upload": {
    "batch_size": 1000,
    "interval_seconds": 60,
    "compression": "lz4"
  }
}
```

---

## 需求 23-4：边缘预处理 [Phase 3]

**用户故事**: 

作为 IoT 工程师，我希望在边缘侧进行日志预处理，减少传输数据量。

**验收标准**:

1. THE Agent SHALL 支持日志过滤（按级别、关键词）
2. THE Agent SHALL 支持日志采样（按比例、按规则）
3. THE Agent SHALL 支持日志聚合（相同日志合并计数）
4. THE Agent SHALL 支持敏感数据脱敏
5. THE Agent SHALL 支持格式标准化

**实现方向**:

在边缘采集器中集成数据处理管道，支持本地过滤、采样和脱敏。

---

## 配置热更新

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| edge_enabled | bool | false | 是否启用边缘计算 |
| buffer_size_mb | int | 1024 | 本地缓冲区大小（MB） |
| upload_interval | int | 60 | 上传间隔（秒） |
| compression_enabled | bool | true | 是否启用压缩 |

**热更新机制**:
- 更新方式: MQTT + API
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置

---

## 相关需求

- 需求 54: IoT 与边缘设备日志采集
