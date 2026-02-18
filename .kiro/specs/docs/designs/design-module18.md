# 模块18：真实备份集成 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module18.md](../requirements/requirements-module18.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 相关文档
- [需求文档](../requirements/requirements-module18.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2：日志存储](./design-module2.md)
- [模块17：备份系统增强](./design-module17.md)

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                真实备份集成模块整体架构                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            API Server (cmd/api-server/main.go)                         │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        启动时初始化                                           │    │ │
│  │  │  1. 读取环境变量配置                                                         │    │ │
│  │  │     • ES_ADDRESSES (Elasticsearch 地址)                                      │    │ │
│  │  │     • ES_USERNAME / ES_PASSWORD (认证)                                       │    │ │
│  │  │     • BACKUP_REPOSITORY (仓库名称)                                           │    │ │
│  │  │     • BACKUP_METADATA_PATH (元数据路径)                                      │    │ │
│  │  │  2. 初始化 Backup Manager                                                    │    │ │
│  │  │  3. 注册备份相关路由                                                         │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        HTTP 路由层                                            │    │ │
│  │  │  POST   /api/v1/backups              → CreateBackupHandler                   │    │ │
│  │  │  GET    /api/v1/backups              → ListBackupsHandler                    │    │ │
│  │  │  GET    /api/v1/backups/{id}         → GetBackupHandler                      │    │ │
│  │  │  DELETE /api/v1/backups/{id}         → DeleteBackupHandler                   │    │ │
│  │  │  GET    /api/v1/backups/stats        → GetBackupStatsHandler                 │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                    Backup Manager (internal/storage/backup/manager.go)                │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        核心功能                                               │    │ │
│  │  │  • CreateBackup(type, indices) → Backup                                      │    │ │
│  │  │  • ListBackups() → []Backup                                                  │    │ │
│  │  │  • GetBackup(id) → Backup                                                    │    │ │
│  │  │  • DeleteBackup(id) → error                                                  │    │ │
│  │  │  • GetStats() → BackupStats                                                  │    │ │
│  │  │  • RestoreBackup(id, indices) → error                                        │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        内部组件                                               │    │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │    │ │
│  │  │  │ Snapshot     │    │ Metadata     │    │ Validation   │                  │    │ │
│  │  │  │ Client       │    │ Store        │    │ Engine       │                  │    │ │
│  │  │  │ (ES API)     │    │ (PostgreSQL) │    │ (规则检查)   │                  │    │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                  │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            存储层                                                      │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Elasticsearch│───▶│ 文件系统     │───▶│ PostgreSQL   │                           │ │
│  │  │ Snapshot API │    │ (快照数据)   │    │ (元数据)     │                           │ │
│  │  │ /_snapshot/* │    │ /var/lib/... │    │ backups 表   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| API Handler | HTTP请求处理 | 接收备份请求、参数验证、响应格式化 |
| Backup Manager | 备份管理核心 | 备份创建、查询、删除、统计、恢复 |
| Snapshot Client | ES快照操作 | 调用Elasticsearch Snapshot API |
| Metadata Store | 元数据管理 | 备份元数据的持久化存储（PostgreSQL） |
| Validation Engine | 配置验证 | 验证备份配置、参数、权限 |
| Config Manager | 配置管理 | 环境变量加载、配置热更新、配置验证 |

### 2.3 关键路径

#### 2.3.1 备份创建路径
```
用户请求 → API Handler → 参数验证 → Backup Manager → Snapshot Client → 
Elasticsearch Snapshot API → 文件系统 → 元数据存储 → 返回结果
```

#### 2.3.2 备份查询路径
```
用户请求 → API Handler → Backup Manager → Metadata Store → 返回备份列表
```

#### 2.3.3 备份删除路径
```
用户请求 → API Handler → Backup Manager → Snapshot Client → 
Elasticsearch Snapshot API → 元数据删除 → 返回结果
```

#### 2.3.4 系统初始化路径
```
服务启动 → 加载环境变量 → 验证配置 → 初始化Backup Manager → 
验证ES连接 → 确保仓库存在 → 注册路由 → 服务就绪
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、并发支持好、部署简单 |
| Gin | 1.9+ | 轻量级Web框架、性能优异、中间件丰富 |
| Elasticsearch | 7.x/8.x | 原生Snapshot API支持、成熟稳定 |
| PostgreSQL | 14+ | 元数据存储、ACID保证、关系型查询 |
| Docker | 20.10+ | 容器化部署、环境一致性 |

### 3.2 技术对比

#### 3.2.1 备份存储方案对比
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| Elasticsearch Snapshot | 原生支持、增量备份、快速恢复 | 依赖文件系统 | ✅ 采用 |
| 自定义导出 | 灵活性高 | 开发成本高、性能差 | ❌ 不采用 |
| 第三方工具 | 功能丰富 | 依赖外部工具、维护成本高 | ❌ 不采用 |

#### 3.2.2 元数据存储方案对比
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| PostgreSQL | ACID保证、关系查询、成熟稳定 | 需要额外部署 | ✅ 采用 |
| 文件系统 | 简单、无依赖 | 并发控制差、查询不便 | ❌ 不采用 |
| Redis | 高性能 | 持久化不可靠、数据结构限制 | ❌ 不采用 |

#### 3.2.3 配置管理方案对比
| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| 环境变量 | 简单、容器友好、12-Factor | 热更新需重启 | ✅ 采用（核心配置） |
| 配置文件 | 结构化、易维护 | 容器化不便 | ⚠️ 辅助使用 |
| 配置中心 | 热更新、集中管理 | 增加复杂度、依赖外部服务 | ⚠️ 未来考虑 |

### 3.3 依赖库选择
| 库名 | 版本 | 用途 | 理由 |
|------|------|------|------|
| github.com/gin-gonic/gin | v1.9+ | Web框架 | 性能好、社区活跃 |
| github.com/elastic/go-elasticsearch/v8 | v8.x | ES客户端 | 官方库、功能完整 |
| github.com/lib/pq | v1.10+ | PostgreSQL驱动 | 成熟稳定 |
| github.com/spf13/viper | v1.16+ | 配置管理 | 功能强大、支持多种格式 |
| go.uber.org/zap | v1.24+ | 日志库 | 高性能、结构化日志 |

---

## 4. 关键流程设计

### 4.1 系统初始化流程

#### 4.1.1 流程图
```
┌─────────────┐
│ 服务启动    │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ 加载环境变量配置    │
│ • ES_ADDRESSES      │
│ • ES_USERNAME       │
│ • ES_PASSWORD       │
│ • BACKUP_REPOSITORY │
│ • BACKUP_METADATA   │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 验证配置有效性      │
│ • 地址格式检查      │
│ • 路径有效性检查    │
│ • 数值范围检查      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 初始化Backup Manager│
│ • 创建ES客户端      │
│ • 连接PostgreSQL    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 健康检查            │
│ • ES连接测试        │
│ • 仓库存在性检查    │
└──────┬──────────────┘
       │
       ├─ 失败 ──┐
       │         ▼
       │    ┌─────────────┐
       │    │ 记录错误    │
       │    │ 退出服务    │
       │    └─────────────┘
       │
       ▼ 成功
┌─────────────────────┐
│ 注册HTTP路由        │
│ • POST /backups     │
│ • GET /backups      │
│ • GET /backups/:id  │
│ • DELETE /backups/:id│
│ • GET /backups/stats│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 启动HTTP服务器      │
│ 监听端口 :8080      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 服务就绪            │
│ 等待请求            │
└─────────────────────┘
```

#### 4.1.2 实现代码
```go
// cmd/api-server/main.go

func main() {
    // 1. 加载配置
    config := loadBackupConfig()
    
    // 2. 验证配置
    if err := config.Validate(); err != nil {
        log.Fatalf("配置验证失败: %v", err)
    }
    
    // 3. 初始化备份管理器
    backupManager, err := initializeBackupManager(config)
    if err != nil {
        log.Fatalf("初始化备份管理器失败: %v", err)
    }
    defer backupManager.Close()
    
    // 4. 初始化路由
    router := setupRouter(backupManager)
    
    // 5. 启动服务器
    srv := &http.Server{
        Addr:    ":8080",
        Handler: router,
    }
    
    // 6. 优雅关闭
    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("服务器启动失败: %v", err)
        }
    }()
    
    // 7. 等待中断信号
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    
    // 8. 优雅关闭
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := srv.Shutdown(ctx); err != nil {
        log.Fatal("服务器强制关闭:", err)
    }
    
    log.Println("服务器已关闭")
}
```

### 4.2 创建备份流程

#### 4.2.1 流程图
```
┌─────────────────────┐
│ 接收POST请求        │
│ /api/v1/backups     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 解析请求参数        │
│ • type (必需)       │
│ • index_pattern     │
│ • name              │
│ • description       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 参数验证            │
│ • type: full/incr   │
│ • pattern格式检查   │
└──────┬──────────────┘
       │
       ├─ 失败 ──┐
       │         ▼
       │    ┌─────────────┐
       │    │ 返回400错误 │
       │    └─────────────┘
       │
       ▼ 成功
┌─────────────────────┐
│ 设置默认值          │
│ index_pattern="logs-*"│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 调用Backup Manager  │
│ CreateBackup()      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 生成备份ID          │
│ snapshot-{timestamp}│
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 调用ES Snapshot API │
│ PUT /_snapshot/repo/│
│     {snapshot_id}   │
└──────┬──────────────┘
       │
       ├─ 失败 ──┐
       │         ▼
       │    ┌─────────────┐
       │    │ 返回500错误 │
       │    └─────────────┘
       │
       ▼ 成功
┌─────────────────────┐
│ 保存元数据到PG      │
│ • id, name, type    │
│ • status, time      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 更新自定义元数据    │
│ • name              │
│ • description       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 返回201响应         │
│ {code:0, data:{...}}│
└─────────────────────┘
```

#### 4.2.2 实现代码
```go
// internal/api/backup_handler.go

func createBackupHandler(c *gin.Context) {
    var req CreateBackupRequest
    
    // 1. 解析请求
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{
            "code":    400,
            "message": "请求参数错误",
            "error":   err.Error(),
        })
        return
    }
    
    // 2. 设置默认值
    if req.IndexPattern == "" {
        req.IndexPattern = "logs-*"
    }
    
    // 3. 确定备份类型
    var backupType backup.BackupType
    switch req.Type {
    case "full":
        backupType = backup.BackupTypeFull
    case "incremental":
        backupType = backup.BackupTypeIncremental
    default:
        c.JSON(400, gin.H{
            "code":    400,
            "message": "无效的备份类型",
        })
        return
    }
    
    // 4. 创建备份
    result, err := backupManager.CreateBackup(backupType, []string{req.IndexPattern})
    if err != nil {
        c.JSON(500, gin.H{
            "code":    500,
            "message": "创建备份失败",
            "error":   err.Error(),
        })
        return
    }
    
    // 5. 更新元数据
    if req.Name != "" || req.Description != "" {
        backupManager.UpdateMetadata(result.ID, req.Name, req.Description)
    }
    
    // 6. 返回成功
    c.JSON(201, gin.H{
        "code":    0,
        "message": "备份创建成功",
        "data":    result,
    })
}
```

### 4.3 查询备份流程

#### 4.3.1 列出备份流程
```
┌─────────────────────┐
│ 接收GET请求         │
│ /api/v1/backups     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 调用Backup Manager  │
│ ListBackups()       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 查询PostgreSQL      │
│ SELECT * FROM       │
│ backups ORDER BY    │
│ created_at DESC     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 返回200响应         │
│ {code:0, data:{     │
│   items:[...],      │
│   total:N           │
│ }}                  │
└─────────────────────┘
```

#### 4.3.2 获取备份详情流程
```
┌─────────────────────┐
│ 接收GET请求         │
│ /api/v1/backups/:id │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 提取备份ID          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 调用Backup Manager  │
│ GetBackup(id)       │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 查询PostgreSQL      │
│ SELECT * FROM       │
│ backups WHERE id=?  │
└──────┬──────────────┘
       │
       ├─ 未找到 ──┐
       │           ▼
       │      ┌─────────────┐
       │      │ 返回404错误 │
       │      └─────────────┘
       │
       ▼ 找到
┌─────────────────────┐
│ 返回200响应         │
│ {code:0, data:{...}}│
└─────────────────────┘
```

### 4.4 删除备份流程

#### 4.4.1 流程图
```
┌─────────────────────┐
│ 接收DELETE请求      │
│ /api/v1/backups/:id │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 提取备份ID          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 调用Backup Manager  │
│ DeleteBackup(id)    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 查询备份是否存在    │
└──────┬──────────────┘
       │
       ├─ 不存在 ──┐
       │           ▼
       │      ┌─────────────┐
       │      │ 返回404错误 │
       │      └─────────────┘
       │
       ▼ 存在
┌─────────────────────┐
│ 调用ES Snapshot API │
│ DELETE /_snapshot/  │
│ repo/{snapshot_id}  │
└──────┬──────────────┘
       │
       ├─ 失败 ──┐
       │         ▼
       │    ┌─────────────┐
       │    │ 返回500错误 │
       │    └─────────────┘
       │
       ▼ 成功
┌─────────────────────┐
│ 删除PostgreSQL元数据│
│ DELETE FROM backups │
│ WHERE id=?          │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 返回204响应         │
│ (No Content)        │
└─────────────────────┘
```

### 4.5 异常流程

#### 4.5.1 ES连接失败处理
```
┌─────────────────────┐
│ 检测到ES连接失败    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 记录错误日志        │
│ 包含详细错误信息    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 重试机制            │
│ • 最多重试3次       │
│ • 间隔5秒           │
└──────┬──────────────┘
       │
       ├─ 仍失败 ──┐
       │           ▼
       │      ┌─────────────┐
       │      │ 返回500错误 │
       │      │ 提示用户    │
       │      └─────────────┘
       │
       ▼ 成功
┌─────────────────────┐
│ 继续正常流程        │
└─────────────────────┘
```

#### 4.5.2 备份超时处理
```
┌─────────────────────┐
│ 备份执行超过60分钟  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 标记备份状态为超时  │
│ status = "timeout"  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 尝试取消备份任务    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 记录告警日志        │
│ 通知管理员          │
└─────────────────────┘
```

#### 4.5.3 磁盘空间不足处理
```
┌─────────────────────┐
│ 检测到磁盘空间不足  │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 拒绝新备份请求      │
│ 返回507错误         │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│ 触发告警            │
│ 通知管理员清理空间  │
└─────────────────────┘
```

---

## 5. 接口设计

### 5.1 API接口列表

详见 [API设计文档](./api-design.md) 模块18部分

| 接口编号 | 接口名称 | HTTP方法 | 路径 | 说明 |
|---------|---------|----------|------|------|
| API-18-01 | 创建备份 | POST | /api/v1/backups | 创建全量或增量备份 |
| API-18-02 | 列出备份 | GET | /api/v1/backups | 获取所有备份列表 |
| API-18-03 | 获取备份详情 | GET | /api/v1/backups/{id} | 获取指定备份的详细信息 |
| API-18-04 | 删除备份 | DELETE | /api/v1/backups/{id} | 删除指定备份 |
| API-18-05 | 获取备份统计 | GET | /api/v1/backups/stats | 获取备份系统统计信息 |

### 5.2 请求响应示例

#### 5.2.1 创建备份
**请求**:
```http
POST /api/v1/backups HTTP/1.1
Content-Type: application/json

{
  "type": "full",
  "index_pattern": "logs-2024-*",
  "name": "每日全量备份",
  "description": "2024年日志全量备份"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "备份创建成功",
  "data": {
    "id": "snapshot-20240131-120000",
    "name": "每日全量备份",
    "type": "full",
    "status": "in_progress",
    "index_pattern": "logs-2024-*",
    "start_time": "2024-01-31T12:00:00Z",
    "estimated_time_minutes": 30
  }
}
```

#### 5.2.2 列出备份
**请求**:
```http
GET /api/v1/backups HTTP/1.1
```

**响应**:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "items": [
      {
        "id": "snapshot-20240131-120000",
        "name": "每日全量备份",
        "type": "full",
        "status": "success",
        "size_bytes": 1073741824,
        "created_at": "2024-01-31T12:00:00Z",
        "completed_at": "2024-01-31T12:25:00Z"
      }
    ],
    "total": 1
  }
}
```

#### 5.2.3 获取备份详情
**请求**:
```http
GET /api/v1/backups/snapshot-20240131-120000 HTTP/1.1
```

**响应**:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "id": "snapshot-20240131-120000",
    "name": "每日全量备份",
    "type": "full",
    "status": "success",
    "index_pattern": "logs-2024-*",
    "indices": ["logs-2024-01", "logs-2024-02"],
    "size_bytes": 1073741824,
    "size_gb": 1.0,
    "created_at": "2024-01-31T12:00:00Z",
    "completed_at": "2024-01-31T12:25:00Z",
    "duration_minutes": 25,
    "description": "2024年日志全量备份"
  }
}
```

#### 5.2.4 删除备份
**请求**:
```http
DELETE /api/v1/backups/snapshot-20240131-120000 HTTP/1.1
```

**响应**:
```http
HTTP/1.1 204 No Content
```

#### 5.2.5 获取备份统计
**请求**:
```http
GET /api/v1/backups/stats HTTP/1.1
```

**响应**:
```json
{
  "code": 0,
  "message": "查询成功",
  "data": {
    "total_backups": 10,
    "successful_backups": 9,
    "failed_backups": 1,
    "in_progress_backups": 0,
    "total_size_bytes": 10737418240,
    "total_size_gb": 10.0,
    "oldest_backup": "2024-01-01T00:00:00Z",
    "newest_backup": "2024-01-31T12:00:00Z"
  }
}
```

### 5.3 错误响应格式

#### 5.3.1 参数错误 (400)
```json
{
  "code": 400,
  "message": "请求参数错误",
  "error": "type字段必须是'full'或'incremental'"
}
```

#### 5.3.2 备份不存在 (404)
```json
{
  "code": 404,
  "message": "备份不存在",
  "error": "未找到ID为 snapshot-xxx 的备份"
}
```

#### 5.3.3 服务器错误 (500)
```json
{
  "code": 500,
  "message": "创建备份失败",
  "error": "Elasticsearch连接超时"
}
```

### 5.4 内部接口

#### 5.4.1 Backup Manager接口
```go
// internal/storage/backup/manager.go

type Manager interface {
    // 创建备份
    CreateBackup(backupType BackupType, indices []string) (*Backup, error)
    
    // 列出所有备份
    ListBackups() ([]*Backup, error)
    
    // 获取备份详情
    GetBackup(id string) (*Backup, error)
    
    // 删除备份
    DeleteBackup(id string) error
    
    // 获取统计信息
    GetStats() (*BackupStats, error)
    
    // 恢复备份
    RestoreBackup(id string, indices []string) error
    
    // 更新元数据
    UpdateMetadata(id, name, description string) error
    
    // 健康检查
    HealthCheck() error
    
    // 确保仓库存在
    EnsureRepository() error
    
    // 关闭管理器
    Close() error
}
```

#### 5.4.2 数据结构定义
```go
// 备份类型
type BackupType string

const (
    BackupTypeFull        BackupType = "full"
    BackupTypeIncremental BackupType = "incremental"
)

// 备份状态
type BackupStatus string

const (
    BackupStatusInProgress BackupStatus = "in_progress"
    BackupStatusSuccess    BackupStatus = "success"
    BackupStatusFailed     BackupStatus = "failed"
    BackupStatusTimeout    BackupStatus = "timeout"
)

// 备份信息
type Backup struct {
    ID            string       `json:"id"`
    Name          string       `json:"name"`
    Type          BackupType   `json:"type"`
    Status        BackupStatus `json:"status"`
    IndexPattern  string       `json:"index_pattern"`
    Indices       []string     `json:"indices"`
    SizeBytes     int64        `json:"size_bytes"`
    SizeGB        float64      `json:"size_gb"`
    CreatedAt     time.Time    `json:"created_at"`
    CompletedAt   *time.Time   `json:"completed_at,omitempty"`
    DurationMin   int          `json:"duration_minutes,omitempty"`
    Description   string       `json:"description,omitempty"`
    ErrorMessage  string       `json:"error_message,omitempty"`
}

// 备份统计
type BackupStats struct {
    TotalBackups      int        `json:"total_backups"`
    SuccessfulBackups int        `json:"successful_backups"`
    FailedBackups     int        `json:"failed_backups"`
    InProgressBackups int        `json:"in_progress_backups"`
    TotalSizeBytes    int64      `json:"total_size_bytes"`
    TotalSizeGB       float64    `json:"total_size_gb"`
    OldestBackup      *time.Time `json:"oldest_backup,omitempty"`
    NewestBackup      *time.Time `json:"newest_backup,omitempty"`
}
```

---

## 6. 数据设计

### 6.1 数据模型

#### 6.1.1 核心数据结构
```go
// 备份信息（主要数据模型）
type Backup struct {
    ID            string       `json:"id" db:"id"`                      // 备份ID
    Name          string       `json:"name" db:"name"`                  // 备份名称
    Type          BackupType   `json:"type" db:"type"`                  // 备份类型：full/incremental
    Status        BackupStatus `json:"status" db:"status"`              // 备份状态
    IndexPattern  string       `json:"index_pattern" db:"index_pattern"` // 索引模式
    Indices       []string     `json:"indices" db:"indices"`            // 实际备份的索引列表
    SizeBytes     int64        `json:"size_bytes" db:"size_bytes"`      // 备份大小（字节）
    SizeGB        float64      `json:"size_gb" db:"-"`                  // 备份大小（GB，计算字段）
    CreatedAt     time.Time    `json:"created_at" db:"created_at"`      // 创建时间
    CompletedAt   *time.Time   `json:"completed_at,omitempty" db:"completed_at"` // 完成时间
    DurationMin   int          `json:"duration_minutes,omitempty" db:"-"` // 持续时间（分钟，计算字段）
    Description   string       `json:"description,omitempty" db:"description"` // 描述
    ErrorMessage  string       `json:"error_message,omitempty" db:"error_message"` // 错误信息
    Repository    string       `json:"repository" db:"repository"`      // 仓库名称
    SnapshotUUID  string       `json:"snapshot_uuid" db:"snapshot_uuid"` // ES快照UUID
}

// 备份配置
type BackupConfig struct {
    ESAddresses          []string `json:"es_addresses"`           // ES地址列表
    ESUsername           string   `json:"es_username"`            // ES用户名
    ESPassword           string   `json:"-"`                      // ES密码（不序列化）
    Repository           string   `json:"repository"`             // 仓库名称
    MetadataPath         string   `json:"metadata_path"`          // 元数据路径
    MaxConcurrentBackups int      `json:"max_concurrent_backups"` // 最大并发备份数
    BackupTimeout        int      `json:"backup_timeout_minutes"` // 备份超时时间（分钟）
    RetryAttempts        int      `json:"retry_attempts"`         // 重试次数
    RetryInterval        int      `json:"retry_interval_seconds"` // 重试间隔（秒）
}

// 备份统计
type BackupStats struct {
    TotalBackups      int        `json:"total_backups"`       // 总备份数
    SuccessfulBackups int        `json:"successful_backups"`  // 成功备份数
    FailedBackups     int        `json:"failed_backups"`      // 失败备份数
    InProgressBackups int        `json:"in_progress_backups"` // 进行中备份数
    TotalSizeBytes    int64      `json:"total_size_bytes"`    // 总大小（字节）
    TotalSizeGB       float64    `json:"total_size_gb"`       // 总大小（GB）
    OldestBackup      *time.Time `json:"oldest_backup,omitempty"` // 最早备份时间
    NewestBackup      *time.Time `json:"newest_backup,omitempty"` // 最新备份时间
}
```

### 6.2 数据库设计

#### 6.2.1 PostgreSQL表结构
```sql
-- 备份元数据表
CREATE TABLE backups (
    id VARCHAR(255) PRIMARY KEY,                    -- 备份ID（snapshot-{timestamp}）
    name VARCHAR(255) NOT NULL,                     -- 备份名称
    type VARCHAR(50) NOT NULL,                      -- 备份类型：full/incremental
    status VARCHAR(50) NOT NULL,                    -- 状态：in_progress/success/failed/timeout
    index_pattern VARCHAR(255) NOT NULL,            -- 索引模式
    indices TEXT[],                                 -- 实际备份的索引列表（数组）
    size_bytes BIGINT DEFAULT 0,                    -- 备份大小（字节）
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),    -- 创建时间
    completed_at TIMESTAMP,                         -- 完成时间
    description TEXT,                               -- 描述
    error_message TEXT,                             -- 错误信息
    repository VARCHAR(255) NOT NULL,               -- 仓库名称
    snapshot_uuid VARCHAR(255),                     -- ES快照UUID
    
    -- 索引
    CONSTRAINT backups_type_check CHECK (type IN ('full', 'incremental')),
    CONSTRAINT backups_status_check CHECK (status IN ('in_progress', 'success', 'failed', 'timeout'))
);

-- 创建索引
CREATE INDEX idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_type ON backups(type);
CREATE INDEX idx_backups_repository ON backups(repository);

-- 创建视图：备份统计
CREATE VIEW backup_stats AS
SELECT 
    COUNT(*) as total_backups,
    COUNT(*) FILTER (WHERE status = 'success') as successful_backups,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_backups,
    COALESCE(SUM(size_bytes), 0) as total_size_bytes,
    ROUND(COALESCE(SUM(size_bytes), 0)::numeric / (1024*1024*1024), 2) as total_size_gb,
    MIN(created_at) as oldest_backup,
    MAX(created_at) as newest_backup
FROM backups;
```

#### 6.2.2 数据库操作示例
```go
// internal/storage/postgres/backup_metadata.go

type BackupMetadataStore struct {
    db *sql.DB
}

// 保存备份元数据
func (s *BackupMetadataStore) Save(backup *Backup) error {
    query := `
        INSERT INTO backups (
            id, name, type, status, index_pattern, indices,
            size_bytes, created_at, description, repository, snapshot_uuid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `
    
    _, err := s.db.Exec(query,
        backup.ID,
        backup.Name,
        backup.Type,
        backup.Status,
        backup.IndexPattern,
        pq.Array(backup.Indices),
        backup.SizeBytes,
        backup.CreatedAt,
        backup.Description,
        backup.Repository,
        backup.SnapshotUUID,
    )
    
    return err
}

// 更新备份状态
func (s *BackupMetadataStore) UpdateStatus(id string, status BackupStatus, completedAt *time.Time, errorMsg string) error {
    query := `
        UPDATE backups 
        SET status = $1, completed_at = $2, error_message = $3
        WHERE id = $4
    `
    
    _, err := s.db.Exec(query, status, completedAt, errorMsg, id)
    return err
}

// 查询所有备份
func (s *BackupMetadataStore) List() ([]*Backup, error) {
    query := `
        SELECT id, name, type, status, index_pattern, indices,
               size_bytes, created_at, completed_at, description,
               error_message, repository, snapshot_uuid
        FROM backups
        ORDER BY created_at DESC
    `
    
    rows, err := s.db.Query(query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var backups []*Backup
    for rows.Next() {
        var b Backup
        err := rows.Scan(
            &b.ID, &b.Name, &b.Type, &b.Status, &b.IndexPattern,
            pq.Array(&b.Indices), &b.SizeBytes, &b.CreatedAt,
            &b.CompletedAt, &b.Description, &b.ErrorMessage,
            &b.Repository, &b.SnapshotUUID,
        )
        if err != nil {
            return nil, err
        }
        
        // 计算派生字段
        b.SizeGB = float64(b.SizeBytes) / (1024 * 1024 * 1024)
        if b.CompletedAt != nil {
            b.DurationMin = int(b.CompletedAt.Sub(b.CreatedAt).Minutes())
        }
        
        backups = append(backups, &b)
    }
    
    return backups, nil
}

// 获取备份统计
func (s *BackupMetadataStore) GetStats() (*BackupStats, error) {
    query := `SELECT * FROM backup_stats`
    
    var stats BackupStats
    err := s.db.QueryRow(query).Scan(
        &stats.TotalBackups,
        &stats.SuccessfulBackups,
        &stats.FailedBackups,
        &stats.InProgressBackups,
        &stats.TotalSizeBytes,
        &stats.TotalSizeGB,
        &stats.OldestBackup,
        &stats.NewestBackup,
    )
    
    return &stats, err
}

// 删除备份元数据
func (s *BackupMetadataStore) Delete(id string) error {
    query := `DELETE FROM backups WHERE id = $1`
    result, err := s.db.Exec(query, id)
    if err != nil {
        return err
    }
    
    rows, err := result.RowsAffected()
    if err != nil {
        return err
    }
    
    if rows == 0 {
        return ErrBackupNotFound
    }
    
    return nil
}
```

### 6.3 缓存设计

#### 6.3.1 缓存策略
| 数据类型 | 缓存位置 | TTL | 更新策略 | 说明 |
|---------|---------|-----|---------|------|
| 备份列表 | 内存（可选） | 30秒 | 写入时失效 | 减少数据库查询 |
| 备份详情 | 内存（可选） | 60秒 | 写入时失效 | 高频查询优化 |
| 备份统计 | 内存（可选） | 5分钟 | 定时刷新 | 统计计算开销大 |
| ES连接 | 连接池 | 长连接 | 健康检查 | 复用连接 |

#### 6.3.2 缓存实现（可选）
```go
// 简单的内存缓存实现
type BackupCache struct {
    listCache   atomic.Value // []*Backup
    listCacheAt time.Time
    statsCache  atomic.Value // *BackupStats
    statsCacheAt time.Time
    mu          sync.RWMutex
}

// 获取缓存的备份列表
func (c *BackupCache) GetList() ([]*Backup, bool) {
    c.mu.RLock()
    defer c.mu.RUnlock()
    
    // 检查缓存是否过期（30秒）
    if time.Since(c.listCacheAt) > 30*time.Second {
        return nil, false
    }
    
    if list := c.listCache.Load(); list != nil {
        return list.([]*Backup), true
    }
    
    return nil, false
}

// 设置备份列表缓存
func (c *BackupCache) SetList(backups []*Backup) {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    c.listCache.Store(backups)
    c.listCacheAt = time.Now()
}

// 清除缓存
func (c *BackupCache) Invalidate() {
    c.mu.Lock()
    defer c.mu.Unlock()
    
    c.listCache.Store(nil)
    c.statsCache.Store(nil)
}
```

**注意**: 缓存是可选的优化，初期可以不实现，根据实际性能需求决定是否启用。

---

## 7. 安全设计

### 7.1 认证授权

#### 7.1.1 API认证
```go
// 使用JWT进行API认证
func authMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 从请求头获取Token
        token := c.GetHeader("Authorization")
        if token == "" {
            c.JSON(401, gin.H{
                "code":    401,
                "message": "未提供认证令牌",
            })
            c.Abort()
            return
        }
        
        // 2. 验证Token
        claims, err := validateJWT(token)
        if err != nil {
            c.JSON(401, gin.H{
                "code":    401,
                "message": "认证令牌无效",
                "error":   err.Error(),
            })
            c.Abort()
            return
        }
        
        // 3. 设置用户信息到上下文
        c.Set("user_id", claims.UserID)
        c.Set("user_role", claims.Role)
        
        c.Next()
    }
}
```

#### 7.1.2 权限控制
```go
// 基于角色的权限控制
func requirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        role := c.GetString("user_role")
        
        // 检查角色权限
        if !hasPermission(role, permission) {
            c.JSON(403, gin.H{
                "code":    403,
                "message": "权限不足",
            })
            c.Abort()
            return
        }
        
        c.Next()
    }
}

// 权限映射
var permissions = map[string][]string{
    "admin": {"backup.read", "backup.write", "backup.delete"},
    "operator": {"backup.read", "backup.write"},
    "viewer": {"backup.read"},
}

// 注册路由时添加权限检查
func registerBackupRoutes(router *gin.Engine) {
    api := router.Group("/api/v1")
    api.Use(authMiddleware())
    
    backups := api.Group("/backups")
    {
        backups.POST("", requirePermission("backup.write"), createBackupHandler)
        backups.GET("", requirePermission("backup.read"), listBackupsHandler)
        backups.GET("/:id", requirePermission("backup.read"), getBackupHandler)
        backups.DELETE("/:id", requirePermission("backup.delete"), deleteBackupHandler)
        backups.GET("/stats", requirePermission("backup.read"), getBackupStatsHandler)
    }
}
```

### 7.2 数据安全

#### 7.2.1 敏感信息保护
```go
// 配置中的敏感信息处理
type BackupConfig struct {
    ESAddresses  []string `json:"es_addresses"`
    ESUsername   string   `json:"es_username"`
    ESPassword   string   `json:"-"` // 不序列化到JSON
    Repository   string   `json:"repository"`
    MetadataPath string   `json:"metadata_path"`
}

// 日志输出时隐藏密码
func (c *BackupConfig) SafeString() string {
    return fmt.Sprintf(
        "ESAddresses=%v, ESUsername=%s, ESPassword=%s, Repository=%s",
        c.ESAddresses,
        c.ESUsername,
        maskPassword(c.ESPassword),
        c.Repository,
    )
}

// 密码掩码
func maskPassword(password string) string {
    if password == "" {
        return "<未设置>"
    }
    if len(password) <= 4 {
        return "****"
    }
    return password[:2] + "****" + password[len(password)-2:]
}
```

#### 7.2.2 Elasticsearch连接安全
```go
// 使用TLS连接Elasticsearch
func createESClient(config *BackupConfig) (*elasticsearch.Client, error) {
    cfg := elasticsearch.Config{
        Addresses: config.ESAddresses,
        Username:  config.ESUsername,
        Password:  config.ESPassword,
        
        // TLS配置
        Transport: &http.Transport{
            TLSClientConfig: &tls.Config{
                MinVersion: tls.VersionTLS12, // 最低TLS 1.2
                // 生产环境应配置证书验证
                // InsecureSkipVerify: false,
                // RootCAs: certPool,
            },
        },
        
        // 超时配置
        MaxRetries:    3,
        RetryOnStatus: []int{502, 503, 504},
    }
    
    return elasticsearch.NewClient(cfg)
}
```

#### 7.2.3 SQL注入防护
```go
// 使用参数化查询防止SQL注入
func (s *BackupMetadataStore) GetBackup(id string) (*Backup, error) {
    // ✅ 正确：使用参数化查询
    query := `SELECT * FROM backups WHERE id = $1`
    
    var backup Backup
    err := s.db.QueryRow(query, id).Scan(...)
    
    // ❌ 错误：字符串拼接（容易SQL注入）
    // query := fmt.Sprintf("SELECT * FROM backups WHERE id = '%s'", id)
    
    return &backup, err
}
```

### 7.3 审计日志

#### 7.3.1 操作审计
```go
// 审计日志结构
type AuditLog struct {
    Timestamp  time.Time `json:"timestamp"`
    UserID     string    `json:"user_id"`
    Action     string    `json:"action"`
    Resource   string    `json:"resource"`
    ResourceID string    `json:"resource_id"`
    Result     string    `json:"result"`
    IPAddress  string    `json:"ip_address"`
    UserAgent  string    `json:"user_agent"`
    Details    string    `json:"details,omitempty"`
}

// 审计日志中间件
func auditMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        
        // 处理请求
        c.Next()
        
        // 记录审计日志
        log := AuditLog{
            Timestamp:  start,
            UserID:     c.GetString("user_id"),
            Action:     c.Request.Method,
            Resource:   c.Request.URL.Path,
            ResourceID: c.Param("id"),
            Result:     fmt.Sprintf("%d", c.Writer.Status()),
            IPAddress:  c.ClientIP(),
            UserAgent:  c.Request.UserAgent(),
        }
        
        // 写入审计日志（异步）
        go writeAuditLog(log)
    }
}

// 写入审计日志
func writeAuditLog(log AuditLog) {
    // 写入到日志文件或数据库
    auditLogger.Info("audit",
        zap.Time("timestamp", log.Timestamp),
        zap.String("user_id", log.UserID),
        zap.String("action", log.Action),
        zap.String("resource", log.Resource),
        zap.String("resource_id", log.ResourceID),
        zap.String("result", log.Result),
        zap.String("ip_address", log.IPAddress),
    )
}
```

#### 7.3.2 关键操作审计
```go
// 备份创建审计
func createBackupHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    
    // ... 创建备份逻辑 ...
    
    // 记录关键操作
    auditLogger.Info("backup_created",
        zap.String("user_id", userID),
        zap.String("backup_id", result.ID),
        zap.String("backup_type", req.Type),
        zap.String("index_pattern", req.IndexPattern),
    )
    
    c.JSON(201, gin.H{"code": 0, "data": result})
}

// 备份删除审计
func deleteBackupHandler(c *gin.Context) {
    userID := c.GetString("user_id")
    backupID := c.Param("id")
    
    // ... 删除备份逻辑 ...
    
    // 记录关键操作
    auditLogger.Warn("backup_deleted",
        zap.String("user_id", userID),
        zap.String("backup_id", backupID),
    )
    
    c.Status(204)
}
```

### 7.4 安全配置清单

| 安全项 | 配置 | 说明 |
|--------|------|------|
| API认证 | JWT Token | 所有API请求需要认证 |
| 权限控制 | RBAC | 基于角色的权限控制 |
| TLS加密 | TLS 1.2+ | Elasticsearch连接加密 |
| 密码保护 | 环境变量 | 密码不写入代码和日志 |
| SQL注入防护 | 参数化查询 | 所有数据库查询使用参数化 |
| 审计日志 | 结构化日志 | 记录所有关键操作 |
| 输入验证 | Gin Binding | 验证所有用户输入 |
| 错误处理 | 统一格式 | 不泄露敏感信息 |

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 | 说明 |
|------|--------|----------|------|
| API响应时间 | < 200ms | Prometheus | 不包括备份执行时间 |
| 备份创建时间 | < 30分钟 | 日志记录 | 全量备份，100GB数据 |
| 增量备份时间 | < 5分钟 | 日志记录 | 10GB增量数据 |
| 并发备份数 | 3个 | 配置限制 | 避免资源竞争 |
| 数据库查询 | < 50ms | 慢查询日志 | 元数据查询 |
| ES连接池 | 10个连接 | 连接池配置 | 复用连接 |
| 内存占用 | < 512MB | 监控指标 | API服务器 |
| CPU使用率 | < 50% | 监控指标 | 正常负载 |

### 8.2 优化策略

#### 8.2.1 数据库优化
```sql
-- 1. 创建合适的索引
CREATE INDEX idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_type ON backups(type);

-- 2. 使用视图优化统计查询
CREATE VIEW backup_stats AS
SELECT 
    COUNT(*) as total_backups,
    COUNT(*) FILTER (WHERE status = 'success') as successful_backups,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
    COALESCE(SUM(size_bytes), 0) as total_size_bytes
FROM backups;

-- 3. 定期清理旧数据（保留90天）
DELETE FROM backups 
WHERE created_at < NOW() - INTERVAL '90 days' 
  AND status IN ('success', 'failed');
```

#### 8.2.2 连接池优化
```go
// Elasticsearch连接池配置
func createESClient(config *BackupConfig) (*elasticsearch.Client, error) {
    cfg := elasticsearch.Config{
        Addresses: config.ESAddresses,
        Username:  config.ESUsername,
        Password:  config.ESPassword,
        
        // 连接池配置
        Transport: &http.Transport{
            MaxIdleConns:        10,              // 最大空闲连接数
            MaxIdleConnsPerHost: 10,              // 每个主机最大空闲连接
            IdleConnTimeout:     90 * time.Second, // 空闲连接超时
            DisableKeepAlives:   false,           // 启用Keep-Alive
        },
        
        // 重试配置
        MaxRetries:    3,
        RetryOnStatus: []int{502, 503, 504},
    }
    
    return elasticsearch.NewClient(cfg)
}

// PostgreSQL连接池配置
func createDBPool(connStr string) (*sql.DB, error) {
    db, err := sql.Open("postgres", connStr)
    if err != nil {
        return nil, err
    }
    
    // 连接池配置
    db.SetMaxOpenConns(25)                 // 最大打开连接数
    db.SetMaxIdleConns(5)                  // 最大空闲连接数
    db.SetConnMaxLifetime(5 * time.Minute) // 连接最大生命周期
    db.SetConnMaxIdleTime(1 * time.Minute) // 空闲连接最大时间
    
    return db, nil
}
```

#### 8.2.3 并发控制
```go
// 限制并发备份数
type BackupManager struct {
    semaphore chan struct{} // 信号量
    config    *BackupConfig
}

func NewBackupManager(config *BackupConfig) *BackupManager {
    return &BackupManager{
        semaphore: make(chan struct{}, config.MaxConcurrentBackups),
        config:    config,
    }
}

// 创建备份（带并发控制）
func (m *BackupManager) CreateBackup(backupType BackupType, indices []string) (*Backup, error) {
    // 获取信号量（阻塞直到有空闲槽位）
    m.semaphore <- struct{}{}
    defer func() { <-m.semaphore }() // 释放信号量
    
    // 执行备份
    return m.doCreateBackup(backupType, indices)
}
```

#### 8.2.4 异步处理
```go
// 异步创建备份
func createBackupHandler(c *gin.Context) {
    var req CreateBackupRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"code": 400, "message": "参数错误"})
        return
    }
    
    // 生成备份ID
    backupID := generateBackupID()
    
    // 异步执行备份
    go func() {
        result, err := backupManager.CreateBackup(
            parseBackupType(req.Type),
            []string{req.IndexPattern},
        )
        
        if err != nil {
            log.Printf("备份失败: %v", err)
            // 更新状态为失败
            backupManager.UpdateStatus(backupID, BackupStatusFailed, nil, err.Error())
        } else {
            log.Printf("备份成功: %s", result.ID)
        }
    }()
    
    // 立即返回备份ID
    c.JSON(202, gin.H{
        "code":    0,
        "message": "备份任务已创建",
        "data": gin.H{
            "id":     backupID,
            "status": "in_progress",
        },
    })
}
```

#### 8.2.5 缓存优化（可选）
```go
// 缓存备份列表（减少数据库查询）
type CachedBackupManager struct {
    manager *BackupManager
    cache   *BackupCache
}

func (m *CachedBackupManager) ListBackups() ([]*Backup, error) {
    // 尝试从缓存获取
    if backups, ok := m.cache.GetList(); ok {
        return backups, nil
    }
    
    // 缓存未命中，查询数据库
    backups, err := m.manager.ListBackups()
    if err != nil {
        return nil, err
    }
    
    // 更新缓存
    m.cache.SetList(backups)
    
    return backups, nil
}
```

### 8.3 容量规划

#### 8.3.1 存储容量
| 数据类型 | 单条大小 | 预估数量 | 总容量 | 说明 |
|---------|---------|---------|--------|------|
| 备份元数据 | 1KB | 1000条 | 1MB | PostgreSQL |
| 备份快照 | 100GB | 10个 | 1TB | 文件系统 |
| 审计日志 | 500B | 100万条 | 500MB | 日志文件 |

#### 8.3.2 资源配置建议
| 环境 | CPU | 内存 | 磁盘 | 说明 |
|------|-----|------|------|------|
| 开发环境 | 2核 | 2GB | 100GB | 单实例 |
| 测试环境 | 4核 | 4GB | 500GB | 单实例 |
| 生产环境 | 8核 | 8GB | 2TB | 多实例 |

#### 8.3.3 扩展策略

**水平扩展（推荐）**:

模块18的API Server支持水平扩展，通过增加Pod副本数来提升处理能力。扩展配置可以通过热更新或滚动更新方式调整。

**热更新方式**（推荐）:
```bash
# 通过kubectl直接调整副本数（立即生效）
kubectl scale deployment api-server --replicas=5 -n log-management

# 查看扩展状态
kubectl get pods -n log-management -l app=api-server
```

**HPA自动扩展**（推荐）:
```yaml
# Kubernetes HPA配置（✅ 支持动态调整）
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
  namespace: log-management
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 2      # ✅ 可通过kubectl edit动态调整
  maxReplicas: 10     # ✅ 可通过kubectl edit动态调整
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70    # ✅ 可动态调整
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80    # ✅ 可动态调整
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
```

**动态调整HPA配置**:
```bash
# 编辑HPA配置（立即生效）
kubectl edit hpa api-server-hpa -n log-management

# 调整最小副本数
kubectl patch hpa api-server-hpa -n log-management -p '{"spec":{"minReplicas":3}}'

# 调整最大副本数
kubectl patch hpa api-server-hpa -n log-management -p '{"spec":{"maxReplicas":15}}'

# 调整CPU阈值
kubectl patch hpa api-server-hpa -n log-management --type='json' \
  -p='[{"op": "replace", "path": "/spec/metrics/0/resource/target/averageUtilization", "value":60}]'
```

**垂直扩展**（需要重启）:
```yaml
# 调整资源配额（❌ 需要滚动重启Pod）
resources:
  requests:
    cpu: 1000m      # 从500m调整到1000m
    memory: 2Gi     # 从1Gi调整到2Gi
  limits:
    cpu: 4000m      # 从2000m调整到4000m
    memory: 8Gi     # 从4Gi调整到8Gi
```

**更新资源配额**:
```bash
# 编辑Deployment（需要滚动重启）
kubectl edit deployment api-server -n log-management

# 等待滚动更新完成
kubectl rollout status deployment/api-server -n log-management
```

### 8.4 性能测试

#### 8.4.1 压力测试脚本
```bash
#!/bin/bash
# 备份API压力测试

# 并发创建备份
for i in {1..10}; do
  curl -X POST http://localhost:8080/api/v1/backups \
    -H "Content-Type: application/json" \
    -d '{
      "type": "full",
      "index_pattern": "logs-test-*"
    }' &
done

wait

# 并发查询备份列表
ab -n 1000 -c 50 http://localhost:8080/api/v1/backups

# 查询备份详情
ab -n 1000 -c 50 http://localhost:8080/api/v1/backups/snapshot-test-001
```

#### 8.4.2 性能监控
```go
// Prometheus指标
var (
    backupDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "backup_duration_seconds",
            Help:    "备份执行时间",
            Buckets: []float64{60, 300, 600, 1800, 3600}, // 1分钟到1小时
        },
        []string{"type", "status"},
    )
    
    backupSize = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "backup_size_bytes",
            Help: "备份大小",
        },
        []string{"backup_id"},
    )
    
    apiRequestDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "api_request_duration_seconds",
            Help:    "API请求时间",
            Buckets: prometheus.DefBuckets,
        },
        []string{"method", "path", "status"},
    )
)

// 记录备份性能指标
func (m *BackupManager) CreateBackup(backupType BackupType, indices []string) (*Backup, error) {
    start := time.Now()
    
    backup, err := m.doCreateBackup(backupType, indices)
    
    duration := time.Since(start).Seconds()
    status := "success"
    if err != nil {
        status = "failed"
    }
    
    // 记录指标
    backupDuration.WithLabelValues(string(backupType), status).Observe(duration)
    if backup != nil {
        backupSize.WithLabelValues(backup.ID).Set(float64(backup.SizeBytes))
    }
    
    return backup, err
}
```

---

## 9. 部署方案

### 9.1 部署架构

#### 9.1.1 架构图
```
┌─────────────────────────────────────────────────────────────────┐
│                        生产环境部署架构                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────┐                                             │
│  │  Load Balancer│                                             │
│  │   (Nginx)     │                                             │
│  └───────┬───────┘                                             │
│          │                                                     │
│          ▼                                                     │
│  ┌───────────────────────────────────────┐                    │
│  │     API Server Cluster (K8s)          │                    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐│                    │
│  │  │ Pod 1   │  │ Pod 2   │  │ Pod 3   ││                    │
│  │  │ API     │  │ API     │  │ API     ││                    │
│  │  │ Server  │  │ Server  │  │ Server  ││                    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘│                    │
│  └───────┼────────────┼────────────┼─────┘                    │
│          │            │            │                          │
│          └────────────┴────────────┘                          │
│                       │                                       │
│          ┌────────────┴────────────┐                          │
│          │                         │                          │
│          ▼                         ▼                          │
│  ┌───────────────┐         ┌───────────────┐                 │
│  │ Elasticsearch │         │  PostgreSQL   │                 │
│  │   Cluster     │         │   (Primary)   │                 │
│  │  ┌─────────┐  │         │               │                 │
│  │  │ Node 1  │  │         └───────┬───────┘                 │
│  │  │ Node 2  │  │                 │                         │
│  │  │ Node 3  │  │                 ▼                         │
│  │  └─────────┘  │         ┌───────────────┐                 │
│  └───────┬───────┘         │  PostgreSQL   │                 │
│          │                 │   (Replica)   │                 │
│          ▼                 └───────────────┘                 │
│  ┌───────────────┐                                           │
│  │  File System  │                                           │
│  │  (NFS/Ceph)   │                                           │
│  │  /backups     │                                           │
│  └───────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

#### 9.2.1 Kubernetes部署配置
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: log-management
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  template:
    metadata:
      labels:
        app: api-server
    spec:
      containers:
      - name: api-server
        image: log-management/api-server:v1.0.0
        ports:
        - containerPort: 8080
          name: http
        env:
        # Elasticsearch配置
        - name: ES_ADDRESSES
          value: "http://elasticsearch:9200"
        - name: ES_USERNAME
          valueFrom:
            secretKeyRef:
              name: es-credentials
              key: username
        - name: ES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: es-credentials
              key: password
        
        # 备份配置
        - name: BACKUP_REPOSITORY
          value: "log-backups"
        - name: BACKUP_METADATA_PATH
          value: "/var/lib/log-backup/metadata"
        
        # PostgreSQL配置
        - name: DB_HOST
          value: "postgresql"
        - name: DB_PORT
          value: "5432"
        - name: DB_NAME
          value: "log_management"
        - name: DB_USER
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: username
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
        
        # 性能配置
        - name: MAX_CONCURRENT_BACKUPS
          value: "3"
        - name: BACKUP_TIMEOUT_MINUTES
          value: "60"
        
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        
        volumeMounts:
        - name: backup-metadata
          mountPath: /var/lib/log-backup/metadata
        
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
      
      volumes:
      - name: backup-metadata
        persistentVolumeClaim:
          claimName: backup-metadata-pvc

---
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: api-server
  namespace: log-management
spec:
  selector:
    app: api-server
  ports:
  - port: 8080
    targetPort: 8080
    name: http
  type: ClusterIP

---
# pvc.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-metadata-pvc
  namespace: log-management
spec:
  accessModes:
  - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
  storageClassName: nfs-storage
```

#### 9.2.2 资源配置表
| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| API Server | 3 | 2核 | 2GB | - | 无状态服务 |
| Elasticsearch | 3 | 4核 | 8GB | 1TB | 数据节点 |
| PostgreSQL | 2 | 2核 | 4GB | 100GB | 主从复制 |
| 备份存储 | - | - | - | 2TB | NFS/Ceph |

### 9.3 Docker Compose部署（开发/测试环境）

```yaml
# docker-compose.yml
version: '3.8'

services:
  api-server:
    image: log-management/api-server:latest
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      # Elasticsearch配置
      ES_ADDRESSES: "http://elasticsearch:9200"
      ES_USERNAME: "elastic"
      ES_PASSWORD: "${ES_PASSWORD}"
      
      # 备份配置
      BACKUP_REPOSITORY: "log-backups"
      BACKUP_METADATA_PATH: "/var/lib/log-backup/metadata"
      
      # PostgreSQL配置
      DB_HOST: "postgresql"
      DB_PORT: "5432"
      DB_NAME: "log_management"
      DB_USER: "postgres"
      DB_PASSWORD: "${DB_PASSWORD}"
      
      # 性能配置
      MAX_CONCURRENT_BACKUPS: "3"
      BACKUP_TIMEOUT_MINUTES: "60"
    volumes:
      - backup-metadata:/var/lib/log-backup/metadata
      - backup-data:/var/lib/elasticsearch/backups
    depends_on:
      - elasticsearch
      - postgresql
    networks:
      - log-network
    restart: unless-stopped

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=${ES_PASSWORD}
      - path.repo=/var/lib/elasticsearch/backups
    volumes:
      - es-data:/usr/share/elasticsearch/data
      - backup-data:/var/lib/elasticsearch/backups
    ports:
      - "9200:9200"
    networks:
      - log-network
    restart: unless-stopped

  postgresql:
    image: postgres:14
    environment:
      POSTGRES_DB: log_management
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pg-data:/var/lib/postgresql/data
      - ./deploy/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    networks:
      - log-network
    restart: unless-stopped

volumes:
  es-data:
  pg-data:
  backup-metadata:
  backup-data:

networks:
  log-network:
    driver: bridge
```

### 9.4 发布策略

**配置更新策略**:

模块18的配置更新优先使用**热更新机制**，无需重启Pod：

| 更新场景 | 推荐方式 | 生效时间 | 服务影响 |
|---------|---------|---------|---------|
| 业务配置（备份参数、缓存配置、清理策略等） | ✅ 热更新 | < 3秒 | 无影响 |
| 连接配置（Elasticsearch、PostgreSQL、Redis） | ❌ 环境变量 + 重启 | 1-2分钟 | 滚动重启 |
| 资源配额（CPU、内存） | ❌ Deployment + 重启 | 2-5分钟 | 滚动重启 |
| 代码更新 | ❌ 镜像 + 滚动更新 | 3-10分钟 | 滚动重启 |

**热更新优势**:
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（< 3秒）
- ✅ 不影响正在进行的备份操作
- ✅ 支持配置验证和自动回滚

详细配置管理说明见第9.6节。

#### 9.4.1 滚动更新（用于代码更新）
```yaml
# deployment.yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # 最多额外创建1个Pod
      maxUnavailable: 0  # 最多0个Pod不可用（保证服务可用）
```

**滚动更新流程**:
```bash
# 1. 更新镜像
kubectl set image deployment/api-server api-server=log-management/api-server:v1.1.0 -n log-management

# 2. 查看滚动更新状态
kubectl rollout status deployment/api-server -n log-management

# 3. 验证新版本
kubectl get pods -n log-management -l app=api-server

# 4. 如果需要回滚
kubectl rollout undo deployment/api-server -n log-management
```

#### 9.4.2 蓝绿部署
```bash
#!/bin/bash
# 蓝绿部署脚本

# 1. 部署新版本（绿色环境）
kubectl apply -f deployment-green.yaml

# 2. 等待新版本就绪
kubectl wait --for=condition=available deployment/api-server-green --timeout=300s

# 3. 切换流量到绿色环境
kubectl patch service api-server -p '{"spec":{"selector":{"version":"green"}}}'

# 4. 验证新版本
./scripts/health-check.sh

# 5. 如果验证通过，删除旧版本（蓝色环境）
kubectl delete deployment api-server-blue

# 6. 如果验证失败，回滚到蓝色环境
# kubectl patch service api-server -p '{"spec":{"selector":{"version":"blue"}}}'
```

#### 9.4.3 金丝雀发布
```yaml
# 使用Istio进行金丝雀发布
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: api-server
spec:
  hosts:
  - api-server
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: api-server
        subset: v2
  - route:
    - destination:
        host: api-server
        subset: v1
      weight: 90
    - destination:
        host: api-server
        subset: v2
      weight: 10  # 10%流量到新版本
```

### 9.5 环境配置

#### 9.5.1 开发环境
```bash
# .env.development
ES_ADDRESSES=http://localhost:9200
ES_USERNAME=elastic
ES_PASSWORD=dev_password
BACKUP_REPOSITORY=log-backups-dev
BACKUP_METADATA_PATH=/tmp/backup-metadata
DB_HOST=localhost
DB_PORT=5432
DB_NAME=log_management_dev
MAX_CONCURRENT_BACKUPS=1
BACKUP_TIMEOUT_MINUTES=30
```

#### 9.5.2 测试环境
```bash
# .env.testing
ES_ADDRESSES=http://es-test:9200
ES_USERNAME=elastic
ES_PASSWORD=test_password
BACKUP_REPOSITORY=log-backups-test
BACKUP_METADATA_PATH=/var/lib/log-backup/metadata
DB_HOST=pg-test
DB_PORT=5432
DB_NAME=log_management_test
MAX_CONCURRENT_BACKUPS=2
BACKUP_TIMEOUT_MINUTES=45
```

#### 9.5.3 生产环境
```bash
# .env.production
ES_ADDRESSES=http://es-prod-1:9200,http://es-prod-2:9200,http://es-prod-3:9200
ES_USERNAME=elastic
ES_PASSWORD=${ES_PASSWORD_SECRET}
BACKUP_REPOSITORY=log-backups-prod
BACKUP_METADATA_PATH=/var/lib/log-backup/metadata
DB_HOST=pg-prod
DB_PORT=5432
DB_NAME=log_management_prod
MAX_CONCURRENT_BACKUPS=3
BACKUP_TIMEOUT_MINUTES=60
```

### 9.6 配置管理

**配置热更新（推荐方式）**:

模块18支持通过Redis Pub/Sub实现配置热更新，无需重启服务。详细设计见第11节"配置热更新详细设计"。

**热更新优势**:
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（< 3秒）
- ✅ 不影响正在进行的备份操作
- ✅ 支持配置验证和自动回滚
- ✅ 记录完整的审计日志

**热更新流程**:
1. 用户通过API修改配置
2. 配置验证（范围检查、依赖检查）
3. 保存到Redis
4. Redis发布Pub/Sub通知（`config:backup:reload`）
5. 所有服务实例订阅到通知
6. 重新加载配置并验证
7. 使用atomic.Value原子更新配置
8. 配置在3秒内生效

**支持热更新的配置项**（共11项）:
- max_concurrent_backups（最大并发备份数）
- backup_timeout_minutes（备份超时时间）
- retry_attempts（重试次数）
- retry_interval_seconds（重试间隔）
- enable_list_cache（启用列表缓存）
- list_cache_ttl_seconds（列表缓存TTL）
- enable_stats_cache（启用统计缓存）
- stats_cache_ttl_seconds（统计缓存TTL）
- enable_auto_cleanup（启用自动清理）
- cleanup_interval_hours（清理间隔）
- cleanup_keep_days（保留天数）

**ConfigMap（备选方式）**:

当热更新机制不可用时（如Redis故障），可以通过修改ConfigMap并重启Pod来更新配置：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backup-config
  namespace: log-management
data:
  backup.yaml: |
    # 备份配置
    backup:
      # 最大并发备份数（✅ 支持热更新）
      max_concurrent_backups: 3
      # 备份超时时间（分钟）（✅ 支持热更新）
      backup_timeout_minutes: 60
      # 重试次数（✅ 支持热更新）
      retry_attempts: 3
      # 重试间隔（秒）（✅ 支持热更新）
      retry_interval_seconds: 5
    
    # 缓存配置
    cache:
      # 启用列表缓存（✅ 支持热更新）
      enable_list_cache: true
      # 列表缓存TTL（秒）（✅ 支持热更新）
      list_cache_ttl_seconds: 300
      # 启用统计缓存（✅ 支持热更新）
      enable_stats_cache: true
      # 统计缓存TTL（秒）（✅ 支持热更新）
      stats_cache_ttl_seconds: 60
    
    # 清理配置
    cleanup:
      # 启用自动清理（✅ 支持热更新）
      enable_auto_cleanup: false
      # 清理间隔（小时）（✅ 支持热更新）
      cleanup_interval_hours: 24
      # 保留天数（✅ 支持热更新）
      cleanup_keep_days: 30
    
    # Elasticsearch配置（❌ 不推荐热更新）
    elasticsearch:
      addresses:
        - http://es-prod-1:9200
        - http://es-prod-2:9200
        - http://es-prod-3:9200
      username: elastic
      # 密码从Secret获取
    
    # PostgreSQL配置（❌ 不推荐热更新）
    database:
      host: pg-prod
      port: 5432
      name: log_management_prod
      # 用户名和密码从Secret获取
```

**更新ConfigMap后重启Pod**:
```bash
# 编辑ConfigMap
kubectl edit configmap backup-config -n log-management

# 重启Pod使配置生效
kubectl rollout restart deployment/api-server -n log-management

# 查看重启状态
kubectl rollout status deployment/api-server -n log-management
```

**配置优先级**:

模块18的配置加载优先级（从高到低）：
1. **热更新配置**（Redis）- 最高优先级
2. **环境变量**（Kubernetes Env）- 中等优先级
3. **ConfigMap配置**（Kubernetes ConfigMap）- 较低优先级
4. **默认配置**（代码内置）- 最低优先级

**配置降级策略**:

```
正常情况:
Redis → 服务实例（热更新）

Redis故障:
环境变量 → 服务实例（从环境变量读取）

环境变量未配置:
ConfigMap → 服务实例（从ConfigMap读取）

全部故障:
默认配置 → 服务实例（使用内置默认值）
```

**不推荐热更新的配置**:

以下配置不推荐热更新，建议通过环境变量或ConfigMap更新并重启服务：

| 配置类型 | 原因 | 更新方式 |
|---------|------|---------|
| Elasticsearch连接配置 | 需要重建ES客户端连接 | 修改环境变量并重启Pod |
| PostgreSQL连接配置 | 需要重建数据库连接池 | 修改环境变量并重启Pod |
| Redis连接配置 | 需要重建Redis连接 | 修改环境变量并重启Pod |
| 备份仓库名称 | 需要重新注册ES仓库 | 修改环境变量并重启Pod |
| 元数据路径 | 需要重新挂载存储卷 | 修改Deployment并滚动更新 |
| 资源配额（CPU/内存） | 需要Pod重建 | 修改Deployment并滚动更新 |

**Secret管理**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: es-credentials
  namespace: log-management
type: Opaque
data:
  username: <base64-encoded>
  password: <base64-encoded>

---
apiVersion: v1
kind: Secret
metadata:
  name: db-credentials
  namespace: log-management
type: Opaque
data:
  username: <base64-encoded>
  password: <base64-encoded>
```

**注意**: Secret中的敏感信息（数据库密码、ES密码等）不推荐热更新，建议通过Secret更新并重启服务。

**配置热更新API示例**:

```bash
# 查询当前配置
curl -X GET "http://api/v1/backup/config"

# 更新单个配置项
curl -X PUT "http://api/v1/backup/config" \
  -H "Content-Type: application/json" \
  -d '{
    "max_concurrent_backups": 5
  }'

# 批量更新配置
curl -X PUT "http://api/v1/backup/config" \
  -H "Content-Type: application/json" \
  -d '{
    "max_concurrent_backups": 5,
    "backup_timeout_minutes": 90,
    "enable_list_cache": true,
    "list_cache_ttl_seconds": 600
  }'

# 查询配置历史
curl -X GET "http://api/v1/backup/config/history"

# 回滚配置
curl -X POST "http://api/v1/backup/config/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 5
  }'
```

---

## 10. 监控与运维

### 10.1 监控指标

#### 10.1.1 业务指标
```prometheus
# 备份总数
backup_total{type="full|incremental", status="success|failed"}

# 备份执行时间
backup_duration_seconds{type="full|incremental", status="success|failed"}

# 备份大小
backup_size_bytes{backup_id="xxx"}

# 备份成功率
backup_success_rate = 
  sum(backup_total{status="success"}) / 
  sum(backup_total) * 100

# 当前进行中的备份数
backup_in_progress_count
```

#### 10.1.2 系统指标
```prometheus
# API请求时间
api_request_duration_seconds{method="GET|POST|DELETE", path="/api/v1/backups", status="200|400|500"}

# API请求总数
api_request_total{method="GET|POST|DELETE", path="/api/v1/backups", status="200|400|500"}

# API错误率
api_error_rate = 
  sum(rate(api_request_total{status=~"5.."}[5m])) / 
  sum(rate(api_request_total[5m])) * 100

# 数据库连接池
db_connections{state="active|idle"}

# ES连接状态
es_connection_status{address="xxx"}
```

#### 10.1.3 资源指标
```prometheus
# CPU使用率
process_cpu_usage_percent

# 内存使用
process_memory_usage_bytes

# 磁盘使用
disk_usage_percent{path="/var/lib/elasticsearch/backups"}

# 网络流量
network_bytes_total{direction="in|out"}
```

### 10.2 告警规则（支持热更新）

#### 10.2.1 告警规则热更新设计

**热更新机制**：
- 优先方式：通过API动态更新告警规则，立即生效
- 备用方式：修改YAML文件后重新加载Prometheus配置

**可热更新的告警配置项**：
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | bool | true | 是否启用告警 |
| threshold | float | - | 告警阈值 |
| duration | string | "5m" | 持续时间 |
| severity | string | "warning" | 告警级别 |
| notification_channels | []string | ["default"] | 通知渠道 |

#### 10.2.2 自定义告警规则管理

```go
// internal/alert/rule_manager.go

// 告警规则定义
type AlertRule struct {
    ID          string            `json:"id"`
    Name        string            `json:"name"`
    Description string            `json:"description"`
    Enabled     bool              `json:"enabled"`
    Expr        string            `json:"expr"`        // Prometheus表达式
    Duration    string            `json:"duration"`    // 持续时间，如"5m"
    Severity    string            `json:"severity"`    // warning/critical
    Labels      map[string]string `json:"labels"`
    Annotations map[string]string `json:"annotations"`
    Channels    []string          `json:"channels"`    // 通知渠道
    CreatedAt   time.Time         `json:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at"`
}

// 告警规则管理器
type AlertRuleManager struct {
    rules       sync.Map // map[string]*AlertRule
    db          *sql.DB
    prometheus  *prometheus.Client
    configFile  string
    mu          sync.RWMutex
}

// 创建告警规则管理器
func NewAlertRuleManager(db *sql.DB, promClient *prometheus.Client, configFile string) *AlertRuleManager {
    mgr := &AlertRuleManager{
        db:         db,
        prometheus: promClient,
        configFile: configFile,
    }
    
    // 从数据库加载规则
    if err := mgr.loadRulesFromDB(); err != nil {
        log.Error("加载告警规则失败", zap.Error(err))
    }
    
    // 启动规则同步
    go mgr.syncRulesToPrometheus()
    
    return mgr
}

// 创建告警规则（热更新）
func (m *AlertRuleManager) CreateRule(rule *AlertRule) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 验证规则
    if err := rule.Validate(); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 生成ID
    if rule.ID == "" {
        rule.ID = generateRuleID()
    }
    
    rule.CreatedAt = time.Now()
    rule.UpdatedAt = time.Now()
    
    // 3. 保存到数据库
    if err := m.saveRuleToDB(rule); err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 4. 更新内存
    m.rules.Store(rule.ID, rule)
    
    // 5. 同步到Prometheus（热更新）
    if err := m.syncRuleToPrometheus(rule); err != nil {
        log.Error("同步规则到Prometheus失败", zap.Error(err))
        // 不影响规则创建，后台会重试
    }
    
    log.Info("告警规则已创建",
        zap.String("rule_id", rule.ID),
        zap.String("rule_name", rule.Name),
    )
    
    return nil
}

// 更新告警规则（热更新）
func (m *AlertRuleManager) UpdateRule(ruleID string, updates *AlertRule) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 获取现有规则
    value, ok := m.rules.Load(ruleID)
    if !ok {
        return fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    rule := value.(*AlertRule)
    
    // 2. 应用更新
    if updates.Name != "" {
        rule.Name = updates.Name
    }
    if updates.Description != "" {
        rule.Description = updates.Description
    }
    rule.Enabled = updates.Enabled
    if updates.Expr != "" {
        rule.Expr = updates.Expr
    }
    if updates.Duration != "" {
        rule.Duration = updates.Duration
    }
    if updates.Severity != "" {
        rule.Severity = updates.Severity
    }
    if updates.Labels != nil {
        rule.Labels = updates.Labels
    }
    if updates.Annotations != nil {
        rule.Annotations = updates.Annotations
    }
    if updates.Channels != nil {
        rule.Channels = updates.Channels
    }
    
    rule.UpdatedAt = time.Now()
    
    // 3. 验证规则
    if err := rule.Validate(); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 4. 更新数据库
    if err := m.updateRuleInDB(rule); err != nil {
        return fmt.Errorf("更新规则失败: %w", err)
    }
    
    // 5. 更新内存
    m.rules.Store(ruleID, rule)
    
    // 6. 同步到Prometheus（热更新）
    if err := m.syncRuleToPrometheus(rule); err != nil {
        log.Error("同步规则到Prometheus失败", zap.Error(err))
    }
    
    log.Info("告警规则已更新",
        zap.String("rule_id", ruleID),
        zap.String("rule_name", rule.Name),
    )
    
    return nil
}

// 删除告警规则（热更新）
func (m *AlertRuleManager) DeleteRule(ruleID string) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    // 1. 检查规则是否存在
    _, ok := m.rules.Load(ruleID)
    if !ok {
        return fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    // 2. 从数据库删除
    if err := m.deleteRuleFromDB(ruleID); err != nil {
        return fmt.Errorf("删除规则失败: %w", err)
    }
    
    // 3. 从内存删除
    m.rules.Delete(ruleID)
    
    // 4. 从Prometheus删除（热更新）
    if err := m.removeRuleFromPrometheus(ruleID); err != nil {
        log.Error("从Prometheus删除规则失败", zap.Error(err))
    }
    
    log.Info("告警规则已删除",
        zap.String("rule_id", ruleID),
    )
    
    return nil
}

// 同步规则到Prometheus（热更新核心）
func (m *AlertRuleManager) syncRuleToPrometheus(rule *AlertRule) error {
    // 1. 生成Prometheus规则配置
    promRule := m.convertToPrometheusRule(rule)
    
    // 2. 通过Prometheus API更新规则
    // 使用Prometheus的配置热加载功能
    if err := m.prometheus.ReloadConfig(); err != nil {
        return fmt.Errorf("重载Prometheus配置失败: %w", err)
    }
    
    return nil
}

// 转换为Prometheus规则格式
func (m *AlertRuleManager) convertToPrometheusRule(rule *AlertRule) string {
    if !rule.Enabled {
        return "" // 禁用的规则不生成
    }
    
    return fmt.Sprintf(`
  - alert: %s
    expr: %s
    for: %s
    labels:
      severity: %s
      rule_id: %s
    annotations:
      summary: %s
      description: %s
`, 
        rule.Name,
        rule.Expr,
        rule.Duration,
        rule.Severity,
        rule.ID,
        rule.Annotations["summary"],
        rule.Annotations["description"],
    )
}

// 验证规则
func (r *AlertRule) Validate() error {
    if r.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if r.Expr == "" {
        return fmt.Errorf("规则表达式不能为空")
    }
    
    // 验证持续时间格式
    if r.Duration != "" {
        if _, err := time.ParseDuration(r.Duration); err != nil {
            return fmt.Errorf("无效的持续时间格式: %s", r.Duration)
        }
    }
    
    // 验证严重级别
    validSeverities := map[string]bool{
        "info":     true,
        "warning":  true,
        "critical": true,
    }
    if !validSeverities[r.Severity] {
        return fmt.Errorf("无效的严重级别: %s", r.Severity)
    }
    
    return nil
}
```

#### 10.2.3 告警规则API

```go
// internal/api/alert_rule_handler.go

// 创建告警规则
func createAlertRuleHandler(c *gin.Context) {
    var req AlertRule
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{
            "code":    400,
            "message": "请求参数错误",
            "error":   err.Error(),
        })
        return
    }
    
    if err := alertRuleManager.CreateRule(&req); err != nil {
        c.JSON(500, gin.H{
            "code":    500,
            "message": "创建告警规则失败",
            "error":   err.Error(),
        })
        return
    }
    
    c.JSON(201, gin.H{
        "code":    0,
        "message": "告警规则创建成功",
        "data":    &req,
    })
}

// 列出告警规则
func listAlertRulesHandler(c *gin.Context) {
    rules := alertRuleManager.ListRules()
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "查询成功",
        "data": gin.H{
            "items": rules,
            "total": len(rules),
        },
    })
}

// 获取告警规则详情
func getAlertRuleHandler(c *gin.Context) {
    ruleID := c.Param("id")
    
    rule, err := alertRuleManager.GetRule(ruleID)
    if err != nil {
        c.JSON(404, gin.H{
            "code":    404,
            "message": "告警规则不存在",
        })
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "查询成功",
        "data":    rule,
    })
}

// 更新告警规则
func updateAlertRuleHandler(c *gin.Context) {
    ruleID := c.Param("id")
    
    var req AlertRule
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{
            "code":    400,
            "message": "请求参数错误",
            "error":   err.Error(),
        })
        return
    }
    
    if err := alertRuleManager.UpdateRule(ruleID, &req); err != nil {
        c.JSON(500, gin.H{
            "code":    500,
            "message": "更新告警规则失败",
            "error":   err.Error(),
        })
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "告警规则更新成功",
    })
}

// 删除告警规则
func deleteAlertRuleHandler(c *gin.Context) {
    ruleID := c.Param("id")
    
    if err := alertRuleManager.DeleteRule(ruleID); err != nil {
        c.JSON(500, gin.H{
            "code":    500,
            "message": "删除告警规则失败",
            "error":   err.Error(),
        })
        return
    }
    
    c.Status(204)
}

// 启用/禁用告警规则
func toggleAlertRuleHandler(c *gin.Context) {
    ruleID := c.Param("id")
    
    var req struct {
        Enabled bool `json:"enabled"`
    }
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{
            "code":    400,
            "message": "请求参数错误",
        })
        return
    }
    
    if err := alertRuleManager.UpdateRule(ruleID, &AlertRule{Enabled: req.Enabled}); err != nil {
        c.JSON(500, gin.H{
            "code":    500,
            "message": "更新告警规则状态失败",
            "error":   err.Error(),
        })
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "告警规则状态已更新",
    })
}

// 注册告警规则路由
func registerAlertRuleRoutes(router *gin.Engine) {
    api := router.Group("/api/v1")
    api.Use(authMiddleware())
    
    alertRules := api.Group("/alert-rules")
    {
        alertRules.POST("", requirePermission("alert.write"), createAlertRuleHandler)
        alertRules.GET("", requirePermission("alert.read"), listAlertRulesHandler)
        alertRules.GET("/:id", requirePermission("alert.read"), getAlertRuleHandler)
        alertRules.PUT("/:id", requirePermission("alert.write"), updateAlertRuleHandler)
        alertRules.DELETE("/:id", requirePermission("alert.write"), deleteAlertRuleHandler)
        alertRules.POST("/:id/toggle", requirePermission("alert.write"), toggleAlertRuleHandler)
    }
}
```

#### 10.2.4 预定义告警规则（可通过API修改）

```yaml
# alerts.yml（初始配置，可通过API热更新）
groups:
- name: backup_alerts
  interval: 30s
  rules:
  
  # 备份失败告警
  - alert: BackupFailed
    expr: backup_total{status="failed"} > 0
    for: 5m
    labels:
      severity: warning
      component: backup
      rule_id: "backup-failed"
    annotations:
      summary: "备份失败"
      description: "备份 {{ $labels.backup_id }} 失败，错误: {{ $labels.error }}"
  
  # 备份超时告警
  - alert: BackupTimeout
    expr: backup_duration_seconds > 3600
    for: 1m
    labels:
      severity: warning
      component: backup
      rule_id: "backup-timeout"
    annotations:
      summary: "备份超时"
      description: "备份 {{ $labels.backup_id }} 执行超过1小时"
  
  # 备份成功率低告警
  - alert: BackupSuccessRateLow
    expr: |
      (
        sum(increase(backup_total{status="success"}[24h])) /
        sum(increase(backup_total[24h]))
      ) < 0.9
    for: 10m
    labels:
      severity: critical
      component: backup
      rule_id: "backup-success-rate-low"
    annotations:
      summary: "备份成功率低于90%"
      description: "过去24小时备份成功率: {{ $value | humanizePercentage }}"
  
  # API错误率高告警
  - alert: APIErrorRateHigh
    expr: |
      (
        sum(rate(api_request_total{status=~"5.."}[5m])) /
        sum(rate(api_request_total[5m]))
      ) > 0.05
    for: 5m
    labels:
      severity: warning
      component: api
      rule_id: "api-error-rate-high"
    annotations:
      summary: "API错误率高于5%"
      description: "当前API错误率: {{ $value | humanizePercentage }}"
  
  # 磁盘空间不足告警
  - alert: DiskSpaceLow
    expr: disk_usage_percent{path="/var/lib/elasticsearch/backups"} > 80
    for: 10m
    labels:
      severity: warning
      component: storage
      rule_id: "disk-space-low"
    annotations:
      summary: "备份磁盘空间不足"
      description: "备份磁盘使用率: {{ $value }}%"
  
  # ES连接失败告警
  - alert: ElasticsearchDown
    expr: es_connection_status == 0
    for: 2m
    labels:
      severity: critical
      component: elasticsearch
      rule_id: "elasticsearch-down"
    annotations:
      summary: "Elasticsearch连接失败"
      description: "无法连接到Elasticsearch: {{ $labels.address }}"
  
  # 数据库连接池耗尽告警
  - alert: DBConnectionPoolExhausted
    expr: db_connections{state="active"} / db_connections_max > 0.9
    for: 5m
    labels:
      severity: warning
      component: database
      rule_id: "db-connection-pool-exhausted"
    annotations:
      summary: "数据库连接池接近耗尽"
      description: "活跃连接数: {{ $value }}"

- name: system_alerts
  interval: 30s
  rules:
  
  # CPU使用率高告警
  - alert: HighCPUUsage
    expr: process_cpu_usage_percent > 80
    for: 10m
    labels:
      severity: warning
      component: system
      rule_id: "high-cpu-usage"
    annotations:
      summary: "CPU使用率过高"
      description: "CPU使用率: {{ $value }}%"
  
  # 内存使用率高告警
  - alert: HighMemoryUsage
    expr: process_memory_usage_bytes / process_memory_limit_bytes > 0.85
    for: 10m
    labels:
      severity: warning
      component: system
      rule_id: "high-memory-usage"
    annotations:
      summary: "内存使用率过高"
      description: "内存使用率: {{ $value | humanizePercentage }}"
```

#### 10.2.5 告警规则数据库设计

```sql
-- 告警规则表
CREATE TABLE alert_rules (
    id VARCHAR(255) PRIMARY KEY,                    -- 规则ID
    name VARCHAR(255) NOT NULL,                     -- 规则名称
    description TEXT,                               -- 规则描述
    enabled BOOLEAN DEFAULT true,                   -- 是否启用
    expr TEXT NOT NULL,                             -- Prometheus表达式
    duration VARCHAR(50) DEFAULT '5m',              -- 持续时间
    severity VARCHAR(50) NOT NULL,                  -- 严重级别：info/warning/critical
    labels JSONB,                                   -- 标签（JSON格式）
    annotations JSONB,                              -- 注解（JSON格式）
    channels TEXT[],                                -- 通知渠道列表
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),    -- 创建时间
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),    -- 更新时间
    created_by VARCHAR(255),                        -- 创建人
    updated_by VARCHAR(255),                        -- 更新人
    
    CONSTRAINT alert_rules_severity_check CHECK (severity IN ('info', 'warning', 'critical'))
);

-- 创建索引
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity);
CREATE INDEX idx_alert_rules_created_at ON alert_rules(created_at DESC);

-- 告警历史表
CREATE TABLE alert_history (
    id BIGSERIAL PRIMARY KEY,                       -- 历史记录ID
    rule_id VARCHAR(255) NOT NULL,                  -- 规则ID
    rule_name VARCHAR(255) NOT NULL,                -- 规则名称
    status VARCHAR(50) NOT NULL,                    -- 状态：firing/resolved
    severity VARCHAR(50) NOT NULL,                  -- 严重级别
    labels JSONB,                                   -- 标签
    annotations JSONB,                              -- 注解
    started_at TIMESTAMP NOT NULL,                  -- 开始时间
    resolved_at TIMESTAMP,                          -- 解决时间
    duration_seconds INTEGER,                       -- 持续时间（秒）
    
    CONSTRAINT alert_history_status_check CHECK (status IN ('firing', 'resolved'))
);

-- 创建索引
CREATE INDEX idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX idx_alert_history_status ON alert_history(status);
CREATE INDEX idx_alert_history_started_at ON alert_history(started_at DESC);
CREATE INDEX idx_alert_history_severity ON alert_history(severity);

-- 告警通知记录表
CREATE TABLE alert_notifications (
    id BIGSERIAL PRIMARY KEY,                       -- 通知记录ID
    alert_history_id BIGINT NOT NULL,               -- 告警历史ID
    channel VARCHAR(255) NOT NULL,                  -- 通知渠道
    status VARCHAR(50) NOT NULL,                    -- 状态：success/failed
    message TEXT,                                   -- 通知消息
    error_message TEXT,                             -- 错误信息
    sent_at TIMESTAMP NOT NULL DEFAULT NOW(),       -- 发送时间
    
    FOREIGN KEY (alert_history_id) REFERENCES alert_history(id) ON DELETE CASCADE,
    CONSTRAINT alert_notifications_status_check CHECK (status IN ('success', 'failed'))
);

-- 创建索引
CREATE INDEX idx_alert_notifications_alert_history_id ON alert_notifications(alert_history_id);
CREATE INDEX idx_alert_notifications_channel ON alert_notifications(channel);
CREATE INDEX idx_alert_notifications_status ON alert_notifications(status);
CREATE INDEX idx_alert_notifications_sent_at ON alert_notifications(sent_at DESC);
```

#### 10.2.6 告警规则使用示例

**创建自定义告警规则**：
```bash
# 创建备份失败告警规则
curl -X POST http://localhost:8080/api/v1/alert-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "备份失败告警",
    "description": "当备份失败时触发告警",
    "enabled": true,
    "expr": "backup_total{status=\"failed\"} > 0",
    "duration": "5m",
    "severity": "warning",
    "labels": {
      "component": "backup",
      "team": "ops"
    },
    "annotations": {
      "summary": "备份失败",
      "description": "备份 {{ $labels.backup_id }} 失败"
    },
    "channels": ["email", "dingtalk"]
  }'
```

**更新告警规则阈值（热更新）**：
```bash
# 修改磁盘空间告警阈值从80%改为85%
curl -X PUT http://localhost:8080/api/v1/alert-rules/disk-space-low \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expr": "disk_usage_percent{path=\"/var/lib/elasticsearch/backups\"} > 85",
    "duration": "10m"
  }'
```

**禁用告警规则（热更新）**：
```bash
# 临时禁用备份超时告警
curl -X POST http://localhost:8080/api/v1/alert-rules/backup-timeout/toggle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "enabled": false
  }'
```

**查询告警规则列表**：
```bash
curl http://localhost:8080/api/v1/alert-rules \
  -H "Authorization: Bearer $TOKEN"
```

**删除告警规则（热更新）**：
```bash
curl -X DELETE http://localhost:8080/api/v1/alert-rules/custom-rule-001 \
  -H "Authorization: Bearer $TOKEN"
```

#### 10.2.7 告警规则热更新验收标准

1. **功能验收**：
   - ✅ 通过API创建告警规则，立即生效
   - ✅ 通过API更新告警规则，立即生效
   - ✅ 通过API删除告警规则，立即生效
   - ✅ 通过API启用/禁用告警规则，立即生效
   - ✅ 规则变更后，Prometheus自动重载配置

2. **性能验收**：
   - 规则创建/更新响应时间 < 200ms
   - 规则生效时间 < 5秒
   - 规则变更不影响现有告警
   - 支持至少100条自定义规则

3. **安全验收**：
   - 规则操作需要认证和授权
   - 规则验证失败时保持原规则
   - 规则变更记录审计日志
   - 规则表达式安全验证

4. **备用方案**：
   - 如果API热更新失败，可以修改YAML文件
   - 修改YAML后执行：`kubectl rollout restart deployment/prometheus`
   - 或者手动重载：`curl -X POST http://prometheus:9090/-/reload`

#### 10.2.8 告警规则配置热更新流程

```
┌─────────────────────┐
│ 用户通过API更新规则 │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 验证规则有效性      │
│ • 表达式语法        │
│ • 参数范围          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 保存到PostgreSQL    │
│ • 持久化存储        │
│ • 版本记录          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 更新内存缓存        │
│ • 原子更新          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 生成Prometheus配置  │
│ • 转换为YAML格式    │
│ • 合并所有规则      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 写入配置文件        │
│ • /etc/prometheus/  │
│   rules/dynamic.yml │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 触发Prometheus重载  │
│ • POST /-/reload    │
│ • 不中断服务        │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 规则立即生效        │
│ • 开始监控          │
│ • 触发告警          │
└─────────────────────┘
```

#### 10.2.2 告警通知配置
```yaml
# alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'component']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  
  routes:
  # 关键告警立即通知
  - match:
      severity: critical
    receiver: 'critical-alerts'
    continue: true
  
  # 备份相关告警
  - match:
      component: backup
    receiver: 'backup-team'
  
  # API相关告警
  - match:
      component: api
    receiver: 'api-team'

receivers:
- name: 'default'
  webhook_configs:
  - url: 'http://alertmanager-webhook:8080/alerts'

- name: 'critical-alerts'
  email_configs:
  - to: 'ops-team@example.com'
    subject: '[CRITICAL] {{ .GroupLabels.alertname }}'
  webhook_configs:
  - url: 'http://dingtalk-webhook:8080/critical'

- name: 'backup-team'
  email_configs:
  - to: 'backup-team@example.com'
  webhook_configs:
  - url: 'http://dingtalk-webhook:8080/backup'

- name: 'api-team'
  email_configs:
  - to: 'api-team@example.com'
```

### 10.3 日志规范

#### 10.3.1 日志级别
| 级别 | 使用场景 | 示例 |
|------|---------|------|
| DEBUG | 调试信息 | 详细的请求参数、中间状态 |
| INFO | 正常操作 | 备份创建成功、服务启动 |
| WARN | 警告信息 | 重试操作、配置缺失 |
| ERROR | 错误信息 | 备份失败、连接错误 |
| FATAL | 致命错误 | 服务无法启动 |

#### 10.3.2 日志格式
```go
// 使用结构化日志
import "go.uber.org/zap"

// 初始化日志
logger, _ := zap.NewProduction()
defer logger.Sync()

// 记录日志
logger.Info("备份创建成功",
    zap.String("backup_id", backupID),
    zap.String("type", "full"),
    zap.String("index_pattern", "logs-*"),
    zap.Int64("size_bytes", sizeBytes),
    zap.Duration("duration", duration),
)

logger.Error("备份创建失败",
    zap.String("backup_id", backupID),
    zap.Error(err),
    zap.String("index_pattern", "logs-*"),
)
```

#### 10.3.3 日志示例
```json
{
  "level": "info",
  "ts": "2024-01-31T12:00:00.000Z",
  "caller": "backup/manager.go:123",
  "msg": "备份创建成功",
  "backup_id": "snapshot-20240131-120000",
  "type": "full",
  "index_pattern": "logs-*",
  "size_bytes": 1073741824,
  "duration": "25m30s"
}

{
  "level": "error",
  "ts": "2024-01-31T12:30:00.000Z",
  "caller": "backup/manager.go:145",
  "msg": "备份创建失败",
  "backup_id": "snapshot-20240131-123000",
  "error": "Elasticsearch connection timeout",
  "index_pattern": "logs-*",
  "stacktrace": "..."
}
```

### 10.4 运维手册

#### 10.4.1 健康检查
```bash
# 检查API服务健康状态
curl http://localhost:8080/health

# 检查Elasticsearch连接
curl -u elastic:password http://localhost:9200/_cluster/health

# 检查PostgreSQL连接
psql -h localhost -U postgres -d log_management -c "SELECT 1"

# 检查备份仓库
curl -u elastic:password http://localhost:9200/_snapshot/log-backups
```

#### 10.4.2 常见问题处理

**问题1: 备份失败**
```bash
# 1. 查看备份日志
kubectl logs -f deployment/api-server | grep backup_id

# 2. 检查ES快照状态
curl -u elastic:password http://localhost:9200/_snapshot/log-backups/_all

# 3. 检查磁盘空间
df -h /var/lib/elasticsearch/backups

# 4. 手动重试备份
curl -X POST http://localhost:8080/api/v1/backups \
  -H "Content-Type: application/json" \
  -d '{"type":"full","index_pattern":"logs-*"}'
```

**问题2: API响应慢**
```bash
# 1. 查看API性能指标
curl http://localhost:8080/metrics | grep api_request_duration

# 2. 检查数据库连接池
curl http://localhost:8080/metrics | grep db_connections

# 3. 检查ES连接状态
curl http://localhost:8080/metrics | grep es_connection

# 4. 查看慢查询日志
kubectl logs deployment/api-server | grep "slow query"
```

**问题3: 磁盘空间不足**
```bash
# 1. 查看磁盘使用情况
df -h /var/lib/elasticsearch/backups

# 2. 清理旧备份（保留最近30天）
curl -X DELETE http://localhost:8080/api/v1/backups/cleanup?days=30

# 3. 手动删除指定备份
curl -X DELETE http://localhost:8080/api/v1/backups/{backup_id}

# 4. 扩展存储空间
kubectl patch pvc backup-data-pvc -p '{"spec":{"resources":{"requests":{"storage":"3Ti"}}}}'
```

#### 10.4.3 日常维护任务
```bash
# 每日任务
# 1. 检查备份状态
./scripts/check-backup-status.sh

# 2. 清理失败的备份
./scripts/cleanup-failed-backups.sh

# 每周任务
# 1. 验证备份完整性
./scripts/verify-backups.sh

# 2. 清理旧备份（保留90天）
./scripts/cleanup-old-backups.sh --days 90

# 每月任务
# 1. 生成备份报告
./scripts/generate-backup-report.sh --month $(date +%Y-%m)

# 2. 审查告警规则
./scripts/review-alert-rules.sh
```

#### 10.4.4 应急响应流程
```
1. 收到告警 → 2. 确认问题 → 3. 评估影响 → 4. 执行修复 → 5. 验证恢复 → 6. 记录总结

详细步骤:
1. 收到告警
   - 查看告警详情
   - 确认告警级别（Critical/Warning）

2. 确认问题
   - 查看监控指标
   - 查看日志
   - 确认影响范围

3. 评估影响
   - 是否影响业务
   - 是否需要紧急处理
   - 是否需要升级

4. 执行修复
   - 按照运维手册操作
   - 记录操作步骤
   - 保持沟通

5. 验证恢复
   - 检查服务状态
   - 验证功能正常
   - 确认告警解除

6. 记录总结
   - 记录问题原因
   - 记录解决方案
   - 更新运维文档
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

| 配置项 | 类型 | 默认值 | 热更新方式 | 生效时间 | 说明 |
|--------|------|--------|-----------|---------|------|
| max_concurrent_backups | int | 3 | API/Redis | 立即 | 最大并发备份数 |
| backup_timeout_minutes | int | 60 | API/Redis | 立即 | 备份超时时间 |
| retry_attempts | int | 3 | API/Redis | 立即 | 重试次数 |
| retry_interval_seconds | int | 5 | API/Redis | 立即 | 重试间隔 |
| enable_list_cache | bool | false | API/Redis | 立即 | 是否启用列表缓存 |
| list_cache_ttl_seconds | int | 30 | API/Redis | 立即 | 列表缓存时间 |
| enable_detail_cache | bool | true | API/Redis | 立即 | 是否启用详情缓存 |
| detail_cache_ttl_seconds | int | 60 | API/Redis | 立即 | 详情缓存时间 |
| enable_stats_cache | bool | true | API/Redis | 立即 | 是否启用统计缓存 |
| stats_cache_ttl_seconds | int | 300 | API/Redis | 立即 | 统计缓存时间 |
| **alert_rules** | **object** | **-** | **API/DB** | **< 5秒** | **告警规则配置（支持CRUD）** |
| alert_rule.enabled | bool | true | API | < 5秒 | 是否启用告警规则 |
| alert_rule.expr | string | - | API | < 5秒 | Prometheus表达式 |
| alert_rule.duration | string | "5m" | API | < 5秒 | 告警持续时间 |
| alert_rule.severity | string | "warning" | API | < 5秒 | 告警级别 |
| alert_rule.channels | []string | ["default"] | API | < 5秒 | 通知渠道 |

**注意**: 以下配置需要重启服务才能生效：
- ES_ADDRESSES
- ES_USERNAME
- ES_PASSWORD
- BACKUP_REPOSITORY
- BACKUP_METADATA_PATH
- DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD

### 11.2 热更新实现

#### 11.2.1 配置管理器
```go
// internal/config/manager.go

type ConfigManager struct {
    config     atomic.Value // *RuntimeConfig
    redis      *redis.Client
    updateChan chan *RuntimeConfig
    stopChan   chan struct{}
}

// 运行时配置（可热更新）
type RuntimeConfig struct {
    MaxConcurrentBackups  int  `json:"max_concurrent_backups"`
    BackupTimeoutMinutes  int  `json:"backup_timeout_minutes"`
    RetryAttempts         int  `json:"retry_attempts"`
    RetryIntervalSeconds  int  `json:"retry_interval_seconds"`
    EnableListCache       bool `json:"enable_list_cache"`
    ListCacheTTLSeconds   int  `json:"list_cache_ttl_seconds"`
    EnableDetailCache     bool `json:"enable_detail_cache"`
    DetailCacheTTLSeconds int  `json:"detail_cache_ttl_seconds"`
    EnableStatsCache      bool `json:"enable_stats_cache"`
    StatsCacheTTLSeconds  int  `json:"stats_cache_ttl_seconds"`
    UpdatedAt             time.Time `json:"updated_at"`
}

// 创建配置管理器
func NewConfigManager(redisClient *redis.Client) *ConfigManager {
    cm := &ConfigManager{
        redis:      redisClient,
        updateChan: make(chan *RuntimeConfig, 10),
        stopChan:   make(chan struct{}),
    }
    
    // 加载初始配置
    config := cm.loadDefaultConfig()
    cm.config.Store(config)
    
    // 启动配置监听
    go cm.watchConfigChanges()
    
    return cm
}

// 获取当前配置
func (cm *ConfigManager) GetConfig() *RuntimeConfig {
    return cm.config.Load().(*RuntimeConfig)
}

// 更新配置（通过API）
func (cm *ConfigManager) UpdateConfig(newConfig *RuntimeConfig) error {
    // 1. 验证配置
    if err := newConfig.Validate(); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 2. 保存到Redis
    newConfig.UpdatedAt = time.Now()
    data, err := json.Marshal(newConfig)
    if err != nil {
        return fmt.Errorf("序列化配置失败: %w", err)
    }
    
    if err := cm.redis.Set(context.Background(), "config:backup:runtime", data, 0).Err(); err != nil {
        return fmt.Errorf("保存配置到Redis失败: %w", err)
    }
    
    // 3. 发布配置变更通知
    if err := cm.redis.Publish(context.Background(), "config:backup:reload", data).Err(); err != nil {
        return fmt.Errorf("发布配置变更失败: %w", err)
    }
    
    log.Info("配置已更新",
        zap.Any("config", newConfig),
    )
    
    return nil
}

// 监听配置变更
func (cm *ConfigManager) watchConfigChanges() {
    // 订阅Redis配置变更通知
    pubsub := cm.redis.Subscribe(context.Background(), "config:backup:reload")
    defer pubsub.Close()
    
    ch := pubsub.Channel()
    
    for {
        select {
        case msg := <-ch:
            // 解析新配置
            var newConfig RuntimeConfig
            if err := json.Unmarshal([]byte(msg.Payload), &newConfig); err != nil {
                log.Error("解析配置失败", zap.Error(err))
                continue
            }
            
            // 验证配置
            if err := newConfig.Validate(); err != nil {
                log.Error("配置验证失败", zap.Error(err))
                continue
            }
            
            // 原子更新配置
            oldConfig := cm.GetConfig()
            cm.config.Store(&newConfig)
            
            log.Info("配置已热更新",
                zap.Any("old_config", oldConfig),
                zap.Any("new_config", &newConfig),
            )
            
            // 触发配置变更回调
            cm.onConfigChanged(oldConfig, &newConfig)
            
        case <-cm.stopChan:
            return
        }
    }
}

// 配置变更回调
func (cm *ConfigManager) onConfigChanged(oldConfig, newConfig *RuntimeConfig) {
    // 如果缓存配置变更，清除缓存
    if oldConfig.EnableListCache != newConfig.EnableListCache ||
       oldConfig.ListCacheTTLSeconds != newConfig.ListCacheTTLSeconds {
        log.Info("列表缓存配置已变更，清除缓存")
        // 清除列表缓存
    }
    
    if oldConfig.EnableDetailCache != newConfig.EnableDetailCache ||
       oldConfig.DetailCacheTTLSeconds != newConfig.DetailCacheTTLSeconds {
        log.Info("详情缓存配置已变更，清除缓存")
        // 清除详情缓存
    }
    
    if oldConfig.EnableStatsCache != newConfig.EnableStatsCache ||
       oldConfig.StatsCacheTTLSeconds != newConfig.StatsCacheTTLSeconds {
        log.Info("统计缓存配置已变更，清除缓存")
        // 清除统计缓存
    }
}

// 加载默认配置
func (cm *ConfigManager) loadDefaultConfig() *RuntimeConfig {
    return &RuntimeConfig{
        MaxConcurrentBackups:  3,
        BackupTimeoutMinutes:  60,
        RetryAttempts:         3,
        RetryIntervalSeconds:  5,
        EnableListCache:       false,
        ListCacheTTLSeconds:   30,
        EnableDetailCache:     true,
        DetailCacheTTLSeconds: 60,
        EnableStatsCache:      true,
        StatsCacheTTLSeconds:  300,
        UpdatedAt:             time.Now(),
    }
}

// 验证配置
func (c *RuntimeConfig) Validate() error {
    if c.MaxConcurrentBackups < 1 || c.MaxConcurrentBackups > 10 {
        return fmt.Errorf("max_concurrent_backups 必须在 1-10 之间")
    }
    
    if c.BackupTimeoutMinutes < 1 || c.BackupTimeoutMinutes > 1440 {
        return fmt.Errorf("backup_timeout_minutes 必须在 1-1440 之间")
    }
    
    if c.RetryAttempts < 0 || c.RetryAttempts > 10 {
        return fmt.Errorf("retry_attempts 必须在 0-10 之间")
    }
    
    if c.RetryIntervalSeconds < 1 || c.RetryIntervalSeconds > 300 {
        return fmt.Errorf("retry_interval_seconds 必须在 1-300 之间")
    }
    
    if c.ListCacheTTLSeconds < 0 || c.ListCacheTTLSeconds > 3600 {
        return fmt.Errorf("list_cache_ttl_seconds 必须在 0-3600 之间")
    }
    
    if c.DetailCacheTTLSeconds < 0 || c.DetailCacheTTLSeconds > 3600 {
        return fmt.Errorf("detail_cache_ttl_seconds 必须在 0-3600 之间")
    }
    
    if c.StatsCacheTTLSeconds < 0 || c.StatsCacheTTLSeconds > 3600 {
        return fmt.Errorf("stats_cache_ttl_seconds 必须在 0-3600 之间")
    }
    
    return nil
}

// 关闭配置管理器
func (cm *ConfigManager) Close() {
    close(cm.stopChan)
}
```

#### 11.2.2 配置更新API
```go
// internal/api/config_handler.go

// 获取当前配置
func getConfigHandler(c *gin.Context) {
    config := configManager.GetConfig()
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "查询成功",
        "data":    config,
    })
}

// 更新配置
func updateConfigHandler(c *gin.Context) {
    var req RuntimeConfig
    
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{
            "code":    400,
            "message": "请求参数错误",
            "error":   err.Error(),
        })
        return
    }
    
    // 更新配置
    if err := configManager.UpdateConfig(&req); err != nil {
        c.JSON(400, gin.H{
            "code":    400,
            "message": "更新配置失败",
            "error":   err.Error(),
        })
        return
    }
    
    c.JSON(200, gin.H{
        "code":    0,
        "message": "配置更新成功",
        "data":    &req,
    })
}

// 注册配置路由
func registerConfigRoutes(router *gin.Engine) {
    api := router.Group("/api/v1")
    api.Use(authMiddleware())
    
    config := api.Group("/config")
    {
        config.GET("/backup", requirePermission("config.read"), getConfigHandler)
        config.PUT("/backup", requirePermission("config.write"), updateConfigHandler)
    }
}
```

#### 11.2.3 使用热更新配置
```go
// internal/storage/backup/manager.go

type Manager struct {
    configManager *config.ConfigManager
    // ... 其他字段
}

// 创建备份（使用热更新配置）
func (m *Manager) CreateBackup(backupType BackupType, indices []string) (*Backup, error) {
    // 获取当前配置
    cfg := m.configManager.GetConfig()
    
    // 使用配置中的并发限制
    select {
    case m.semaphore <- struct{}{}:
        defer func() { <-m.semaphore }()
    case <-time.After(time.Duration(cfg.BackupTimeoutMinutes) * time.Minute):
        return nil, fmt.Errorf("等待备份槽位超时")
    }
    
    // 使用配置中的超时时间
    ctx, cancel := context.WithTimeout(
        context.Background(),
        time.Duration(cfg.BackupTimeoutMinutes)*time.Minute,
    )
    defer cancel()
    
    // 执行备份（带重试）
    var backup *Backup
    var err error
    
    for attempt := 0; attempt <= cfg.RetryAttempts; attempt++ {
        if attempt > 0 {
            log.Info("重试创建备份",
                zap.Int("attempt", attempt),
                zap.Int("max_attempts", cfg.RetryAttempts),
            )
            time.Sleep(time.Duration(cfg.RetryIntervalSeconds) * time.Second)
        }
        
        backup, err = m.doCreateBackup(ctx, backupType, indices)
        if err == nil {
            return backup, nil
        }
        
        log.Warn("创建备份失败",
            zap.Int("attempt", attempt),
            zap.Error(err),
        )
    }
    
    return nil, fmt.Errorf("创建备份失败，已重试%d次: %w", cfg.RetryAttempts, err)
}
```

### 11.3 热更新验收标准

#### 11.3.1 功能验收
```bash
# 1. 获取当前配置
curl http://localhost:8080/api/v1/config/backup

# 2. 更新配置
curl -X PUT http://localhost:8080/api/v1/config/backup \
  -H "Content-Type: application/json" \
  -d '{
    "max_concurrent_backups": 5,
    "backup_timeout_minutes": 90,
    "retry_attempts": 5
  }'

# 3. 验证配置已生效（查看日志）
kubectl logs -f deployment/api-server | grep "配置已热更新"

# 4. 验证新配置生效（创建备份测试）
curl -X POST http://localhost:8080/api/v1/backups \
  -H "Content-Type: application/json" \
  -d '{"type":"full","index_pattern":"logs-*"}'
```

#### 11.3.2 性能验收
- 配置更新响应时间 < 100ms
- 配置生效时间 < 1秒
- 配置更新不影响正在进行的备份
- 配置更新不导致服务重启

#### 11.3.3 安全验收
- 配置更新需要认证和授权
- 配置验证失败时保持原配置
- 配置变更记录审计日志
- 敏感配置不通过API暴露

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 | 应急方案 |
|------|------|------|----------|----------|
| Elasticsearch连接失败 | 中 | 高 | 连接池+重试机制 | 降级到只读模式 |
| 备份超时 | 中 | 中 | 超时配置+监控告警 | 取消备份任务 |
| 磁盘空间不足 | 高 | 高 | 磁盘监控+自动清理 | 拒绝新备份请求 |
| 数据库连接池耗尽 | 低 | 高 | 连接池配置+监控 | 限流+排队 |
| 并发备份过多 | 中 | 中 | 信号量限制 | 拒绝新备份请求 |
| 配置错误 | 低 | 中 | 配置验证 | 保持原配置 |
| API认证失败 | 低 | 低 | JWT验证 | 返回401错误 |
| 备份数据损坏 | 低 | 高 | 校验和验证 | 使用备份副本 |

### 12.2 回滚方案

#### 12.2.1 代码回滚
```bash
#!/bin/bash
# 回滚到上一个版本

# 1. 查看当前版本
kubectl get deployment api-server -o jsonpath='{.spec.template.spec.containers[0].image}'

# 2. 回滚到上一个版本
kubectl rollout undo deployment/api-server

# 3. 查看回滚状态
kubectl rollout status deployment/api-server

# 4. 验证回滚成功
./scripts/health-check.sh

# 5. 如果需要回滚到指定版本
# kubectl rollout undo deployment/api-server --to-revision=2
```

#### 12.2.2 配置回滚
```bash
#!/bin/bash
# 回滚配置

# 1. 查看配置历史
curl http://localhost:8080/api/v1/config/backup/history

# 2. 回滚到指定版本
curl -X POST http://localhost:8080/api/v1/config/backup/rollback \
  -H "Content-Type: application/json" \
  -d '{"version": "v1.0.0"}'

# 3. 验证配置
curl http://localhost:8080/api/v1/config/backup
```

#### 12.2.3 数据回滚
```bash
#!/bin/bash
# 回滚数据库变更

# 1. 备份当前数据
pg_dump -h localhost -U postgres log_management > backup_before_rollback.sql

# 2. 执行回滚SQL
psql -h localhost -U postgres log_management < rollback.sql

# 3. 验证数据
psql -h localhost -U postgres log_management -c "SELECT COUNT(*) FROM backups"
```

### 12.3 应急预案

#### 12.3.1 服务不可用
```
问题: API服务无法访问

应急步骤:
1. 检查服务状态
   kubectl get pods -l app=api-server
   
2. 查看Pod日志
   kubectl logs -f deployment/api-server
   
3. 检查资源使用
   kubectl top pods -l app=api-server
   
4. 如果Pod崩溃，重启服务
   kubectl rollout restart deployment/api-server
   
5. 如果问题持续，回滚到上一个版本
   kubectl rollout undo deployment/api-server
   
6. 通知相关人员
   ./scripts/send-alert.sh "API服务不可用"
```

#### 12.3.2 备份失败率高
```
问题: 备份成功率低于90%

应急步骤:
1. 查看失败的备份
   curl http://localhost:8080/api/v1/backups?status=failed
   
2. 分析失败原因
   kubectl logs deployment/api-server | grep "backup.*failed"
   
3. 检查Elasticsearch状态
   curl -u elastic:password http://localhost:9200/_cluster/health
   
4. 检查磁盘空间
   df -h /var/lib/elasticsearch/backups
   
5. 如果是磁盘空间问题，清理旧备份
   ./scripts/cleanup-old-backups.sh --days 30
   
6. 如果是ES问题，重启ES集群
   kubectl rollout restart statefulset/elasticsearch
   
7. 手动重试失败的备份
   ./scripts/retry-failed-backups.sh
```

#### 12.3.3 磁盘空间不足
```
问题: 备份磁盘使用率超过80%

应急步骤:
1. 查看磁盘使用情况
   df -h /var/lib/elasticsearch/backups
   
2. 查看备份列表和大小
   curl http://localhost:8080/api/v1/backups/stats
   
3. 清理失败的备份
   curl -X DELETE http://localhost:8080/api/v1/backups/cleanup?status=failed
   
4. 清理旧备份（保留最近30天）
   curl -X DELETE http://localhost:8080/api/v1/backups/cleanup?days=30
   
5. 如果仍不足，扩展存储空间
   kubectl patch pvc backup-data-pvc -p '{"spec":{"resources":{"requests":{"storage":"3Ti"}}}}'
   
6. 临时禁用新备份（紧急情况）
   curl -X PUT http://localhost:8080/api/v1/config/backup \
     -d '{"max_concurrent_backups": 0}'
```

#### 12.3.4 数据库连接失败
```
问题: 无法连接到PostgreSQL

应急步骤:
1. 检查PostgreSQL状态
   kubectl get pods -l app=postgresql
   
2. 查看PostgreSQL日志
   kubectl logs -f statefulset/postgresql
   
3. 检查连接配置
   echo $DB_HOST $DB_PORT $DB_NAME
   
4. 测试连接
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1"
   
5. 如果PostgreSQL崩溃，重启
   kubectl rollout restart statefulset/postgresql
   
6. 如果数据损坏，从备份恢复
   ./scripts/restore-postgres-backup.sh
   
7. 降级到只读模式（紧急情况）
   # 只允许查询操作，禁止创建/删除备份
```

### 12.4 灾难恢复

#### 12.4.1 完全恢复流程
```bash
#!/bin/bash
# 灾难恢复脚本

echo "开始灾难恢复..."

# 1. 恢复PostgreSQL数据
echo "恢复PostgreSQL数据..."
psql -h $DB_HOST -U $DB_USER -d $DB_NAME < backup_metadata.sql

# 2. 恢复Elasticsearch快照仓库配置
echo "恢复Elasticsearch快照仓库..."
curl -X PUT "http://$ES_HOST:9200/_snapshot/log-backups" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "fs",
    "settings": {
      "location": "/var/lib/elasticsearch/backups"
    }
  }'

# 3. 验证备份数据完整性
echo "验证备份数据..."
./scripts/verify-backups.sh

# 4. 重启API服务
echo "重启API服务..."
kubectl rollout restart deployment/api-server

# 5. 验证服务可用性
echo "验证服务..."
./scripts/health-check.sh

# 6. 验证备份功能
echo "测试备份功能..."
curl -X POST http://localhost:8080/api/v1/backups \
  -H "Content-Type: application/json" \
  -d '{"type":"full","index_pattern":"logs-test-*"}'

echo "灾难恢复完成！"
```

#### 12.4.2 RTO/RPO目标
| 指标 | 目标值 | 说明 |
|------|--------|------|
| RTO (恢复时间目标) | < 1小时 | 从故障到服务恢复的时间 |
| RPO (恢复点目标) | < 15分钟 | 可接受的数据丢失时间 |
| 备份频率 | 每日 | 全量备份频率 |
| 备份保留期 | 90天 | 备份数据保留时间 |
| 异地备份 | 是 | 备份数据异地存储 |

### 12.5 变更管理

#### 12.5.1 变更流程
```
1. 变更申请 → 2. 风险评估 → 3. 变更审批 → 4. 变更实施 → 5. 变更验证 → 6. 变更关闭

详细步骤:
1. 变更申请
   - 填写变更申请单
   - 说明变更内容和原因
   - 评估影响范围

2. 风险评估
   - 识别潜在风险
   - 制定缓解措施
   - 准备回滚方案

3. 变更审批
   - 技术负责人审批
   - 运维负责人审批
   - 业务负责人审批（重大变更）

4. 变更实施
   - 按照变更计划执行
   - 记录变更过程
   - 保持沟通

5. 变更验证
   - 验证功能正常
   - 验证性能指标
   - 验证监控告警

6. 变更关闭
   - 更新文档
   - 总结经验
   - 归档记录
```

#### 12.5.2 变更分类
| 变更类型 | 审批级别 | 实施窗口 | 回滚时间 |
|---------|---------|---------|---------|
| 紧急变更 | 运维负责人 | 立即 | < 5分钟 |
| 标准变更 | 技术负责人 | 维护窗口 | < 30分钟 |
| 重大变更 | 业务负责人 | 计划窗口 | < 1小时 |

---

## 13. 附录

### 13.1 术语表

| 术语 | 英文 | 说明 |
|------|------|------|
| 备份 | Backup | 数据的副本，用于灾难恢复 |
| 快照 | Snapshot | Elasticsearch的备份机制 |
| 全量备份 | Full Backup | 备份所有数据 |
| 增量备份 | Incremental Backup | 只备份变更的数据 |
| 仓库 | Repository | 存储快照的位置 |
| 元数据 | Metadata | 描述备份的信息 |
| 热更新 | Hot Reload | 不重启服务更新配置 |
| RTO | Recovery Time Objective | 恢复时间目标 |
| RPO | Recovery Point Objective | 恢复点目标 |
| RBAC | Role-Based Access Control | 基于角色的访问控制 |
| JWT | JSON Web Token | JSON格式的令牌 |
| HPA | Horizontal Pod Autoscaler | 水平Pod自动扩缩容 |
| PVC | Persistent Volume Claim | 持久卷声明 |

### 13.2 参考文档

#### 13.2.1 内部文档
- [需求文档 - 模块18](../requirements/requirements-module18.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2：日志存储](./design-module2.md)
- [模块17：备份系统增强](./design-module17.md)

#### 13.2.2 外部文档
- [Elasticsearch Snapshot API](https://www.elastic.co/guide/en/elasticsearch/reference/current/snapshot-restore.html)
- [Elasticsearch Snapshot Repository](https://www.elastic.co/guide/en/elasticsearch/reference/current/snapshots-register-repository.html)
- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
- [Gin Web Framework](https://gin-gonic.com/docs/)
- [Go Elasticsearch Client](https://github.com/elastic/go-elasticsearch)
- [Kubernetes Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Prometheus Monitoring](https://prometheus.io/docs/introduction/overview/)

#### 13.2.3 最佳实践
- [12-Factor App](https://12factor.net/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
- [RESTful API Design](https://restfulapi.net/)

### 13.3 配置示例

#### 13.3.1 环境变量配置
```bash
# .env.example

# ==================== Elasticsearch配置 ====================
# Elasticsearch地址（逗号分隔多个地址）
ES_ADDRESSES=http://elasticsearch:9200

# Elasticsearch认证
ES_USERNAME=elastic
ES_PASSWORD=your_password_here

# ==================== 备份配置 ====================
# 备份仓库名称
BACKUP_REPOSITORY=log-backups

# 备份元数据存储路径
BACKUP_METADATA_PATH=/var/lib/log-backup/metadata

# ==================== PostgreSQL配置 ====================
# 数据库连接信息
DB_HOST=postgresql
DB_PORT=5432
DB_NAME=log_management
DB_USER=postgres
DB_PASSWORD=your_db_password_here

# ==================== 性能配置 ====================
# 最大并发备份数（1-10）
MAX_CONCURRENT_BACKUPS=3

# 备份超时时间（分钟，1-1440）
BACKUP_TIMEOUT_MINUTES=60

# 重试次数（0-10）
RETRY_ATTEMPTS=3

# 重试间隔（秒，1-300）
RETRY_INTERVAL_SECONDS=5

# ==================== 缓存配置 ====================
# 是否启用列表缓存
ENABLE_LIST_CACHE=false

# 列表缓存时间（秒）
LIST_CACHE_TTL_SECONDS=30

# 是否启用详情缓存
ENABLE_DETAIL_CACHE=true

# 详情缓存时间（秒）
DETAIL_CACHE_TTL_SECONDS=60

# 是否启用统计缓存
ENABLE_STATS_CACHE=true

# 统计缓存时间（秒）
STATS_CACHE_TTL_SECONDS=300

# ==================== 日志配置 ====================
# 日志级别（debug/info/warn/error）
LOG_LEVEL=info

# 日志格式（json/console）
LOG_FORMAT=json

# ==================== 服务配置 ====================
# 服务监听端口
PORT=8080

# 服务运行模式（debug/release）
GIN_MODE=release
```

#### 13.3.2 Kubernetes ConfigMap
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: api-server-config
  namespace: log-management
data:
  # Elasticsearch配置
  ES_ADDRESSES: "http://elasticsearch:9200"
  BACKUP_REPOSITORY: "log-backups"
  BACKUP_METADATA_PATH: "/var/lib/log-backup/metadata"
  
  # PostgreSQL配置
  DB_HOST: "postgresql"
  DB_PORT: "5432"
  DB_NAME: "log_management"
  
  # 性能配置
  MAX_CONCURRENT_BACKUPS: "3"
  BACKUP_TIMEOUT_MINUTES: "60"
  RETRY_ATTEMPTS: "3"
  RETRY_INTERVAL_SECONDS: "5"
  
  # 缓存配置
  ENABLE_LIST_CACHE: "false"
  LIST_CACHE_TTL_SECONDS: "30"
  ENABLE_DETAIL_CACHE: "true"
  DETAIL_CACHE_TTL_SECONDS: "60"
  ENABLE_STATS_CACHE: "true"
  STATS_CACHE_TTL_SECONDS: "300"
  
  # 日志配置
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  
  # 服务配置
  PORT: "8080"
  GIN_MODE: "release"
```

#### 13.3.3 Kubernetes Secret
```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-server-secrets
  namespace: log-management
type: Opaque
stringData:
  # Elasticsearch认证
  ES_USERNAME: "elastic"
  ES_PASSWORD: "your_password_here"
  
  # PostgreSQL认证
  DB_USER: "postgres"
  DB_PASSWORD: "your_db_password_here"
```

### 13.4 常用命令

#### 13.4.1 开发命令
```bash
# 构建项目
make build

# 运行测试
make test

# 运行API服务器
./api-server

# 运行API服务器（开发模式）
go run cmd/api-server/main.go

# 代码格式化
go fmt ./...

# 代码检查
golangci-lint run

# 生成API文档
swag init -g cmd/api-server/main.go
```

#### 13.4.2 Docker命令
```bash
# 构建镜像
docker build -t log-management/api-server:latest .

# 运行容器
docker run -d \
  --name api-server \
  -p 8080:8080 \
  --env-file .env \
  log-management/api-server:latest

# 查看日志
docker logs -f api-server

# 进入容器
docker exec -it api-server sh

# 停止容器
docker stop api-server

# 删除容器
docker rm api-server
```

#### 13.4.3 Kubernetes命令
```bash
# 部署应用
kubectl apply -f deploy/kubernetes/

# 查看Pod状态
kubectl get pods -l app=api-server

# 查看Pod日志
kubectl logs -f deployment/api-server

# 查看Pod详情
kubectl describe pod <pod-name>

# 进入Pod
kubectl exec -it <pod-name> -- sh

# 查看服务
kubectl get svc api-server

# 查看配置
kubectl get configmap api-server-config -o yaml

# 更新配置
kubectl edit configmap api-server-config

# 重启服务
kubectl rollout restart deployment/api-server

# 查看回滚历史
kubectl rollout history deployment/api-server

# 回滚到上一个版本
kubectl rollout undo deployment/api-server

# 扩容
kubectl scale deployment api-server --replicas=5

# 查看资源使用
kubectl top pods -l app=api-server
```

#### 13.4.4 备份管理命令
```bash
# 创建全量备份
curl -X POST http://localhost:8080/api/v1/backups \
  -H "Content-Type: application/json" \
  -d '{"type":"full","index_pattern":"logs-*"}'

# 创建增量备份
curl -X POST http://localhost:8080/api/v1/backups \
  -H "Content-Type: application/json" \
  -d '{"type":"incremental","index_pattern":"logs-*"}'

# 列出所有备份
curl http://localhost:8080/api/v1/backups

# 获取备份详情
curl http://localhost:8080/api/v1/backups/{backup_id}

# 删除备份
curl -X DELETE http://localhost:8080/api/v1/backups/{backup_id}

# 获取备份统计
curl http://localhost:8080/api/v1/backups/stats

# 获取配置
curl http://localhost:8080/api/v1/config/backup

# 更新配置
curl -X PUT http://localhost:8080/api/v1/config/backup \
  -H "Content-Type: application/json" \
  -d '{"max_concurrent_backups":5}'
```

#### 13.4.5 告警规则管理命令（热更新）
```bash
# 创建自定义告警规则
curl -X POST http://localhost:8080/api/v1/alert-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "自定义备份告警",
    "description": "当备份失败超过3次时触发",
    "enabled": true,
    "expr": "backup_total{status=\"failed\"} > 3",
    "duration": "10m",
    "severity": "critical",
    "labels": {
      "component": "backup",
      "team": "ops"
    },
    "annotations": {
      "summary": "备份失败次数过多",
      "description": "过去10分钟内备份失败{{ $value }}次"
    },
    "channels": ["email", "dingtalk", "slack"]
  }'

# 列出所有告警规则
curl http://localhost:8080/api/v1/alert-rules \
  -H "Authorization: Bearer $TOKEN"

# 获取告警规则详情
curl http://localhost:8080/api/v1/alert-rules/{rule_id} \
  -H "Authorization: Bearer $TOKEN"

# 更新告警规则（热更新）
curl -X PUT http://localhost:8080/api/v1/alert-rules/{rule_id} \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expr": "backup_total{status=\"failed\"} > 5",
    "duration": "15m",
    "severity": "warning"
  }'

# 启用告警规则（热更新）
curl -X POST http://localhost:8080/api/v1/alert-rules/{rule_id}/toggle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": true}'

# 禁用告警规则（热更新）
curl -X POST http://localhost:8080/api/v1/alert-rules/{rule_id}/toggle \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": false}'

# 删除告警规则（热更新）
curl -X DELETE http://localhost:8080/api/v1/alert-rules/{rule_id} \
  -H "Authorization: Bearer $TOKEN"

# 批量更新告警规则阈值
curl -X PUT http://localhost:8080/api/v1/alert-rules/disk-space-low \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "expr": "disk_usage_percent{path=\"/var/lib/elasticsearch/backups\"} > 85"
  }'

# 查看告警历史
curl http://localhost:8080/api/v1/alert-history?limit=100 \
  -H "Authorization: Bearer $TOKEN"

# 查看特定规则的告警历史
curl http://localhost:8080/api/v1/alert-history?rule_id={rule_id} \
  -H "Authorization: Bearer $TOKEN"

# 备用方案：通过YAML文件更新（需要重启）
# 1. 编辑告警规则文件
kubectl edit configmap prometheus-alert-rules

# 2. 重载Prometheus配置
curl -X POST http://prometheus:9090/-/reload

# 或者重启Prometheus
kubectl rollout restart deployment/prometheus
```

### 13.5 故障排查

#### 13.5.1 常见问题
| 问题 | 可能原因 | 解决方案 |
|------|---------|---------|
| 备份创建失败 | ES连接失败 | 检查ES状态和网络连接 |
| 备份超时 | 数据量太大 | 增加超时时间或分批备份 |
| API响应慢 | 数据库查询慢 | 检查索引和查询优化 |
| 磁盘空间不足 | 备份数据过多 | 清理旧备份或扩展存储 |
| 配置更新失败 | 配置验证失败 | 检查配置参数范围 |
| 服务启动失败 | 配置错误 | 检查环境变量和日志 |

#### 13.5.2 调试技巧
```bash
# 1. 查看详细日志
kubectl logs -f deployment/api-server --tail=100

# 2. 查看事件
kubectl get events --sort-by='.lastTimestamp'

# 3. 查看资源使用
kubectl top pods

# 4. 查看网络连接
kubectl exec -it <pod-name> -- netstat -an

# 5. 查看环境变量
kubectl exec -it <pod-name> -- env

# 6. 测试ES连接
kubectl exec -it <pod-name> -- curl http://elasticsearch:9200

# 7. 测试数据库连接
kubectl exec -it <pod-name> -- psql -h postgresql -U postgres -d log_management -c "SELECT 1"

# 8. 查看Prometheus指标
curl http://localhost:8080/metrics
```

### 13.6 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

---

**文档结束**

如有疑问或需要补充，请联系系统架构团队。
