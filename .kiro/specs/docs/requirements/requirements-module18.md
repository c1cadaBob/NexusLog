# 模块十八：真实备份集成

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块十八：真实备份集成  
> **需求编号**: 

---

**模块概述**: 

将 API 服务器中的模拟备份数据替换为真实的 Elasticsearch 快照备份功能，集成已实现的 `backup.Manager` 模块，提供完整的备份生命周期管理。

**模块技术栈**:
- 后端框架：Go 1.21+ (Gin)
- 存储引擎：Elasticsearch Snapshot API
- 备份管理：internal/storage/backup/manager.go
- 元数据存储：PostgreSQL
- 配置管理：环境变量

**模块架构**:

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
│  │  │  2. 初始化 Backup_Manager                                                    │    │ │
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

**架构说明**:

1. **API Server**: 启动时初始化 Backup_Manager，注册 HTTP 路由，处理备份请求
2. **Backup Manager**: 核心备份管理逻辑，封装 Elasticsearch Snapshot API 调用
3. **存储层**: Elasticsearch 快照 + 文件系统 + PostgreSQL 元数据

**数据流向**:

```
HTTP 请求 → API Handler → Backup Manager → Elasticsearch Snapshot API → 文件系统
                                        ↓
                                   PostgreSQL (元数据)
```

**需求列表**:
- 需求 18-1：备份管理器初始化 [MVP]
- 需求 18-2：创建真实备份 [MVP]
- 需求 18-3：列出真实备份 [MVP]
- 需求 18-4：获取备份详情 [MVP]
- 需求 18-5：删除备份 [MVP]
- 需求 18-6：获取备份统计 [MVP]
- 需求 18-7：配置管理 [MVP]

---

## 需求 18-1：备份管理器初始化 [MVP]

**用户故事**: 

作为系统管理员，我希望 API 服务器在启动时初始化真实的备份管理器，以便备份操作与实际的 Elasticsearch 快照交互。

**验收标准**:

1. WHEN API_Server 启动时，THE API_Server SHALL 使用环境变量配置初始化 Backup_Manager
2. WHEN ES_ADDRESSES 环境变量已设置时，THE API_Server SHALL 使用它连接到 Elasticsearch
3. WHEN ES_ADDRESSES 环境变量未设置时，THE API_Server SHALL 使用默认地址 "http://elasticsearch:9200"
4. IF Backup_Manager 初始化失败，THEN THE API_Server SHALL 记录错误并以非零状态退出
5. WHEN API_Server 关闭时，THE API_Server SHALL 优雅地关闭 Backup_Manager

**实现方向**:

**实现方式**:

```go
// cmd/api-server/main.go

package main

import (
    "context"
    "fmt"
    "log"
    "net/http"
    "os"
    "os/signal"
    "strings"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"
    "your-project/internal/storage/backup"
)

// 全局备份管理器
var backupManager *backup.Manager

func main() {
    // 1. 加载配置
    config := loadBackupConfig()
    
    // 2. 初始化备份管理器
    var err error
    backupManager, err = initializeBackupManager(config)
    if err != nil {
        log.Fatalf("初始化备份管理器失败: %v", err)
    }
    defer backupManager.Close()
    
    log.Println("备份管理器初始化成功")
    
    // 3. 初始化 Gin 路由
    router := gin.Default()
    
    // 4. 注册备份相关路由
    registerBackupRoutes(router)
    
    // 5. 启动 HTTP 服务器
    srv := &http.Server{
        Addr:    ":8080",
        Handler: router,
    }
    
    // 6. 优雅关闭
    go func() {
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("启动服务器失败: %v", err)
        }
    }()
    
    log.Println("API 服务器已启动，监听端口 :8080")
    
    // 7. 等待中断信号
    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit
    
    log.Println("正在关闭服务器...")
    
    // 8. 优雅关闭服务器（5秒超时）
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    if err := srv.Shutdown(ctx); err != nil {
        log.Fatal("服务器强制关闭:", err)
    }
    
    log.Println("服务器已关闭")
}

// 加载备份配置
func loadBackupConfig() *BackupConfig {
    return &BackupConfig{
        ESAddresses:  getEnvList("ES_ADDRESSES", []string{"http://elasticsearch:9200"}),
        ESUsername:   os.Getenv("ES_USERNAME"),
        ESPassword:   os.Getenv("ES_PASSWORD"),
        Repository:   getEnvOrDefault("BACKUP_REPOSITORY", "log-backups"),
        MetadataPath: getEnvOrDefault("BACKUP_METADATA_PATH", "/var/lib/log-backup/metadata"),
    }
}

// 初始化备份管理器
func initializeBackupManager(config *BackupConfig) (*backup.Manager, error) {
    log.Printf("正在初始化备份管理器...")
    log.Printf("  ES地址: %v", config.ESAddresses)
    log.Printf("  仓库名称: %s", config.Repository)
    log.Printf("  元数据路径: %s", config.MetadataPath)
    
    // 创建备份管理器配置
    managerConfig := &backup.Config{
        ESAddresses:  config.ESAddresses,
        ESUsername:   config.ESUsername,
        ESPassword:   config.ESPassword,
        Repository:   config.Repository,
        MetadataPath: config.MetadataPath,
    }
    
    // 初始化管理器
    manager, err := backup.NewManager(managerConfig)
    if err != nil {
        return nil, fmt.Errorf("创建备份管理器失败: %w", err)
    }
    
    // 验证 Elasticsearch 连接
    if err := manager.HealthCheck(); err != nil {
        return nil, fmt.Errorf("Elasticsearch 健康检查失败: %w", err)
    }
    
    log.Println("Elasticsearch 连接正常")
    
    // 验证仓库是否存在，不存在则创建
    if err := manager.EnsureRepository(); err != nil {
        return nil, fmt.Errorf("确保仓库存在失败: %w", err)
    }
    
    log.Printf("备份仓库 '%s' 已就绪", config.Repository)
    
    return manager, nil
}

// 注册备份路由
func registerBackupRoutes(router *gin.Engine) {
    api := router.Group("/api/v1")
    {
        backups := api.Group("/backups")
        {
            backups.POST("", createBackupHandler)
            backups.GET("", listBackupsHandler)
            backups.GET("/:id", getBackupHandler)
            backups.DELETE("/:id", deleteBackupHandler)
            backups.GET("/stats", getBackupStatsHandler)
        }
    }
}

// 备份配置
type BackupConfig struct {
    ESAddresses  []string
    ESUsername   string
    ESPassword   string
    Repository   string
    MetadataPath string
}

// 获取环境变量（带默认值）
func getEnvOrDefault(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

// 获取环境变量列表（逗号分隔）
func getEnvList(key string, defaultValue []string) []string {
    value := os.Getenv(key)
    if value == "" {
        return defaultValue
    }
    return strings.Split(value, ",")
}
```

**关键实现点**:

1. 在 main 函数启动时初始化备份管理器，确保服务可用
2. 验证 Elasticsearch 连接和仓库状态，启动失败时快速失败
3. 使用 defer 确保备份管理器在程序退出时正确关闭
4. 实现优雅关闭，等待正在进行的备份操作完成
5. 详细的日志输出，方便排查初始化问题

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| health_check_interval | int | 60 | 健康检查间隔（秒） |
| connection_timeout | int | 10 | 连接超时时间（秒） |
| max_retries | int | 3 | 最大重试次数 |
| retry_interval | int | 5 | 重试间隔（秒） |

**热更新机制**:

- 更新方式: 环境变量 + 配置文件
- 生效时间: 需要重启服务
- 回滚策略: 启动失败时保持原配置

**热更新验收标准**:

1. WHEN 配置变更后重启服务，THE System SHALL 使用新配置初始化
2. IF 配置无效，THEN THE System SHALL 记录错误并退出
3. THE System SHALL 在启动日志中显示当前配置
4. THE System SHALL 支持通过健康检查端点验证配置

---

## 需求 18-2：创建真实备份 [MVP]

**用户故事**: 

作为用户，我希望通过 API 创建真实的备份，以便我的日志数据实际备份到 Elasticsearch 快照。

**验收标准**:

1. WHEN 收到 POST /api/v1/backups 请求且 type 为 "full" 时，THE API_Server SHALL 调用 Backup_Manager.CreateBackup 并传入 BackupTypeFull
2. WHEN 收到 POST /api/v1/backups 请求且 type 为 "incremental" 时，THE API_Server SHALL 调用 Backup_Manager.CreateBackup 并传入 BackupTypeIncremental
3. WHEN Backup_Manager.CreateBackup 成功时，THE API_Server SHALL 返回 HTTP 201 和备份详情
4. IF Backup_Manager.CreateBackup 失败，THEN THE API_Server SHALL 返回 HTTP 500 和错误消息
5. WHEN 创建备份时，THE API_Server SHALL 使用请求中的 index_pattern 或默认为 "logs-*"

**实现方向**:

**实现方式**:

```go
// 创建备份请求
type CreateBackupRequest struct {
    Type         string `json:"type" binding:"required,oneof=full incremental"`
    IndexPattern string `json:"index_pattern"`
    Name         string `json:"name"`
    Description  string `json:"description"`
}

// 创建备份处理器
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
    
    // 2. 设置默认索引模式
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
            "error":   fmt.Sprintf("类型必须是 'full' 或 'incremental'，收到: %s", req.Type),
        })
        return
    }
    
    log.Printf("开始创建备份: type=%s, index_pattern=%s", req.Type, req.IndexPattern)
    
    // 4. 调用备份管理器创建备份
    result, err := backupManager.CreateBackup(backupType, []string{req.IndexPattern})
    if err != nil {
        log.Printf("创建备份失败: %v", err)
        
        // 根据错误类型返回不同的状态码
        statusCode := 500
        if strings.Contains(err.Error(), "not found") {
            statusCode = 404
        } else if strings.Contains(err.Error(), "already exists") {
            statusCode = 409
        }
        
        c.JSON(statusCode, gin.H{
            "code":    statusCode,
            "message": "创建备份失败",
            "error":   err.Error(),
        })
        return
    }
    
    // 5. 如果提供了自定义名称或描述，更新元数据
    if req.Name != "" || req.Description != "" {
        if err := backupManager.UpdateMetadata(result.ID, req.Name, req.Description); err != nil {
            log.Printf("更新备份元数据失败: %v", err)
            // 不影响备份创建，只记录警告
        }
    }
    
    log.Printf("备份创建成功: id=%s, name=%s", result.ID, result.Name)
    
    // 6. 返回成功响应
    c.JSON(201, gin.H{
        "code":    0,
        "message": "备份创建成功",
        "data":    result,
    })
}

// 备份结果（与 backup.Manager 返回的结构对应）
type BackupResult struct {
    ID            string    `json:"id"`
    Name          string    `json:"name"`
    Type          string    `json:"type"`
    Status        string    `json:"status"`
    IndexPattern  string    `json:"index_pattern"`
    StartTime     time.Time `json:"start_time"`
    EstimatedTime int       `json:"estimated_time_minutes"`
}
```

**关键实现点**:

1. 使用 Gin 的数据绑定验证请求参数，确保类型正确
2. 根据备份类型调用不同的 BackupType 常量
3. 支持自定义名称和描述，创建后更新元数据
4. 详细的错误处理，根据错误类型返回合适的 HTTP 状态码
5. 完整的日志记录，方便追踪备份创建过程

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| default_index_pattern | string | "logs-*" | 默认索引模式 |
| max_concurrent_backups | int | 3 | 最大并发备份数 |
| backup_timeout_minutes | int | 60 | 备份超时时间（分钟） |
| enable_auto_naming | bool | true | 是否启用自动命名 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次备份创建）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 备份配置变更时，THE System SHALL 应用新配置
3. THE System SHALL 支持通过 API 查询当前生效的备份配置
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 18-3：列出真实备份 [MVP]

**用户故事**: 

作为用户，我希望列出所有真实的备份，以便查看实际的备份历史。

**验收标准**:

1. WHEN 收到 GET /api/v1/backups 请求时，THE API_Server SHALL 调用 Backup_Manager.ListBackups
2. WHEN Backup_Manager.ListBackups 返回结果时，THE API_Server SHALL 返回 HTTP 200 和备份列表
3. IF Backup_Manager.ListBackups 失败，THEN THE API_Server SHALL 返回 HTTP 500 和错误消息

**实现方向**:

**实现方式**:

```go
// 列出备份处理器
func listBackupsHandler(c *gin.Context) {
    log.Println("查询备份列表")
    
    // 1. 调用备份管理器获取备份列表
    backups, err := backupManager.ListBackups()
    if err != nil {
        log.Printf("查询备份列表失败: %v", err)
        c.JSON(500, gin.H{
            "code":    500,
            "message": "查询备份列表失败",
            "error":   err.Error(),
        })
        return
    }
    
    log.Printf("查询到 %d 个备份", len(backups))
    
    // 2. 返回成功响应
    c.JSON(200, gin.H{
        "code":    0,
        "message": "查询成功",
        "data": gin.H{
            "items": backups,
            "total": len(backups),
        },
    })
}
```

**关键实现点**:

1. 直接调用 backup.Manager.ListBackups() 获取所有备份
2. 返回统一的响应格式，包含备份列表和总数
3. 完整的错误处理和日志记录
4. 简洁的实现，无需额外的数据转换

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| list_cache_ttl_seconds | int | 30 | 列表缓存时间（秒） |
| enable_list_cache | bool | false | 是否启用列表缓存 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次查询）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 缓存配置变更时，THE System SHALL 清除现有缓存
3. THE System SHALL 支持通过 API 查询当前生效的缓存配置

---

## 需求 18-4：获取备份详情 [MVP]

**用户故事**: 

作为用户，我希望获取特定备份的详情，以便查看其状态和元数据。

**验收标准**:

1. WHEN 收到 GET /api/v1/backups/{id} 请求时，THE API_Server SHALL 调用 Backup_Manager.GetBackup 并传入备份 ID
2. WHEN Backup_Manager.GetBackup 返回备份时，THE API_Server SHALL 返回 HTTP 200 和备份详情
3. IF Backup_Manager.GetBackup 返回 ErrBackupNotFound，THEN THE API_Server SHALL 返回 HTTP 404

**实现方向**:

**实现方式**:

```go
// 获取备份详情处理器
func getBackupHandler(c *gin.Context) {
    // 1. 获取备份 ID
    id := c.Param("id")
    
    log.Printf("查询备份详情: id=%s", id)
    
    // 2. 调用备份管理器获取备份
    backup, err := backupManager.GetBackup(id)
    if err != nil {
        log.Printf("查询备份详情失败: %v", err)
        
        // 3. 判断错误类型
        if errors.Is(err, backup.ErrBackupNotFound) {
            c.JSON(404, gin.H{
                "code":    404,
                "message": "备份不存在",
                "error":   fmt.Sprintf("未找到ID为 %s 的备份", id),
            })
            return
        }
        
        c.JSON(500, gin.H{
            "code":    500,
            "message": "查询备份详情失败",
            "error":   err.Error(),
        })
        return
    }
    
    log.Printf("查询备份详情成功: id=%s, name=%s, status=%s", backup.ID, backup.Name, backup.Status)
    
    // 4. 返回成功响应
    c.JSON(200, gin.H{
        "code":    0,
        "message": "查询成功",
        "data":    backup,
    })
}
```

**关键实现点**:

1. 使用 errors.Is 判断错误类型，返回合适的 HTTP 状态码
2. 404 错误返回友好的错误消息
3. 完整的日志记录，包含备份的关键信息
4. 统一的响应格式

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| detail_cache_ttl_seconds | int | 60 | 详情缓存时间（秒） |
| enable_detail_cache | bool | true | 是否启用详情缓存 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次查询）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 缓存配置变更时，THE System SHALL 清除现有缓存
3. THE System SHALL 支持通过 API 查询当前生效的缓存配置

---

## 需求 18-5：删除备份 [MVP]

**用户故事**: 

作为用户，我希望删除备份，以便移除旧的或不必要的备份。

**验收标准**:

1. WHEN 收到 DELETE /api/v1/backups/{id} 请求时，THE API_Server SHALL 调用 Backup_Manager.DeleteBackup 并传入备份 ID
2. WHEN Backup_Manager.DeleteBackup 成功时，THE API_Server SHALL 返回 HTTP 204
3. IF Backup_Manager.DeleteBackup 返回 ErrBackupNotFound，THEN THE API_Server SHALL 返回 HTTP 404

**实现方向**:

**实现方式**:

```go
// 删除备份处理器
func deleteBackupHandler(c *gin.Context) {
    // 1. 获取备份 ID
    id := c.Param("id")
    
    log.Printf("删除备份: id=%s", id)
    
    // 2. 调用备份管理器删除备份
    err := backupManager.DeleteBackup(id)
    if err != nil {
        log.Printf("删除备份失败: %v", err)
        
        // 3. 判断错误类型
        if errors.Is(err, backup.ErrBackupNotFound) {
            c.JSON(404, gin.H{
                "code":    404,
                "message": "备份不存在",
                "error":   fmt.Sprintf("未找到ID为 %s 的备份", id),
            })
            return
        }
        
        c.JSON(500, gin.H{
            "code":    500,
            "message": "删除备份失败",
            "error":   err.Error(),
        })
        return
    }
    
    log.Printf("备份删除成功: id=%s", id)
    
    // 4. 返回成功响应（204 No Content）
    c.Status(204)
}
```

**关键实现点**:

1. 使用 HTTP 204 状态码表示删除成功且无内容返回
2. 使用 errors.Is 判断备份是否存在
3. 完整的日志记录，方便审计
4. 简洁的错误处理

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enable_soft_delete | bool | false | 是否启用软删除 |
| soft_delete_retention_days | int | 30 | 软删除保留天数 |
| require_confirmation | bool | true | 是否需要二次确认 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次删除操作）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 删除策略变更时，THE System SHALL 应用新策略
3. THE System SHALL 支持通过 API 查询当前生效的删除配置
4. THE System SHALL 记录所有删除操作的审计日志

---

## 需求 18-6：获取备份统计 [MVP]

**用户故事**: 

作为用户，我希望查看备份统计信息，以便监控备份系统健康状况。

**验收标准**:

1. WHEN 收到 GET /api/v1/backups/stats 请求时，THE API_Server SHALL 调用 Backup_Manager.GetStats
2. WHEN Backup_Manager.GetStats 返回统计信息时，THE API_Server SHALL 返回 HTTP 200 和统计数据（包括 total_backups、successful_backups、failed_backups、total_size_bytes）
3. IF Backup_Manager.GetStats 失败，THEN THE API_Server SHALL 返回 HTTP 500 和错误消息

**实现方向**:

**实现方式**:

```go
// 获取备份统计处理器
func getBackupStatsHandler(c *gin.Context) {
    log.Println("查询备份统计")
    
    // 1. 调用备份管理器获取统计信息
    stats, err := backupManager.GetStats()
    if err != nil {
        log.Printf("查询备份统计失败: %v", err)
        c.JSON(500, gin.H{
            "code":    500,
            "message": "查询备份统计失败",
            "error":   err.Error(),
        })
        return
    }
    
    log.Printf("查询备份统计成功: total=%d, successful=%d, failed=%d, size=%.2fGB",
        stats.TotalBackups,
        stats.SuccessfulBackups,
        stats.FailedBackups,
        float64(stats.TotalSizeBytes)/(1024*1024*1024))
    
    // 2. 返回成功响应
    c.JSON(200, gin.H{
        "code":    0,
        "message": "查询成功",
        "data":    stats,
    })
}

// 备份统计（与 backup.Manager 返回的结构对应）
type BackupStats struct {
    TotalBackups      int   `json:"total_backups"`
    SuccessfulBackups int   `json:"successful_backups"`
    FailedBackups     int   `json:"failed_backups"`
    InProgressBackups int   `json:"in_progress_backups"`
    TotalSizeBytes    int64 `json:"total_size_bytes"`
    TotalSizeGB       float64 `json:"total_size_gb"`
    OldestBackup      *time.Time `json:"oldest_backup,omitempty"`
    NewestBackup      *time.Time `json:"newest_backup,omitempty"`
}
```

**关键实现点**:

1. 直接调用 backup.Manager.GetStats() 获取统计信息
2. 在日志中输出关键统计数据，方便监控
3. 返回完整的统计信息，包括备份数量、大小、时间等
4. 统一的响应格式

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| stats_cache_ttl_seconds | int | 300 | 统计缓存时间（秒） |
| enable_stats_cache | bool | true | 是否启用统计缓存 |
| include_size_calculation | bool | true | 是否包含大小计算 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次查询）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 统计配置变更时，THE System SHALL 清除现有缓存
3. THE System SHALL 支持通过 API 查询当前生效的统计配置
4. THE System SHALL 记录统计查询的性能指标

---

## 需求 18-7：配置管理 [MVP]

**用户故事**: 

作为系统管理员，我希望通过环境变量配置备份系统，以便在不同环境中轻松部署。

**验收标准**:

1. THE API_Server SHALL 从环境变量读取 ES_ADDRESSES 用于 Elasticsearch 连接
2. THE API_Server SHALL 从环境变量读取 ES_USERNAME 用于认证
3. THE API_Server SHALL 从环境变量读取 ES_PASSWORD 用于认证
4. THE API_Server SHALL 从环境变量读取 BACKUP_REPOSITORY 或默认为 "log-backups"
5. THE API_Server SHALL 从环境变量读取 BACKUP_METADATA_PATH 或默认为 "/var/lib/log-backup/metadata"

**实现方向**:

**实现方式**:

```go
// 配置管理器
type ConfigManager struct {
    config atomic.Value
}

// 备份系统配置
type BackupSystemConfig struct {
    ESAddresses  []string `json:"es_addresses"`
    ESUsername   string   `json:"es_username"`
    ESPassword   string   `json:"-"` // 不在 JSON 中显示密码
    Repository   string   `json:"repository"`
    MetadataPath string   `json:"metadata_path"`
    
    // 运行时配置
    MaxConcurrentBackups int `json:"max_concurrent_backups"`
    BackupTimeout        int `json:"backup_timeout_minutes"`
    RetryAttempts        int `json:"retry_attempts"`
    RetryInterval        int `json:"retry_interval_seconds"`
}

// 从环境变量加载配置
func LoadBackupConfigFromEnv() *BackupSystemConfig {
    config := &BackupSystemConfig{
        // 必需配置
        ESAddresses:  parseESAddresses(),
        ESUsername:   os.Getenv("ES_USERNAME"),
        ESPassword:   os.Getenv("ES_PASSWORD"),
        Repository:   getEnvOrDefault("BACKUP_REPOSITORY", "log-backups"),
        MetadataPath: getEnvOrDefault("BACKUP_METADATA_PATH", "/var/lib/log-backup/metadata"),
        
        // 可选配置（带默认值）
        MaxConcurrentBackups: getEnvAsInt("MAX_CONCURRENT_BACKUPS", 3),
        BackupTimeout:        getEnvAsInt("BACKUP_TIMEOUT_MINUTES", 60),
        RetryAttempts:        getEnvAsInt("RETRY_ATTEMPTS", 3),
        RetryInterval:        getEnvAsInt("RETRY_INTERVAL_SECONDS", 5),
    }
    
    return config
}

// 解析 Elasticsearch 地址
func parseESAddresses() []string {
    addresses := os.Getenv("ES_ADDRESSES")
    if addresses == "" {
        // 默认地址
        return []string{"http://elasticsearch:9200"}
    }
    
    // 支持逗号分隔的多个地址
    parts := strings.Split(addresses, ",")
    result := make([]string, 0, len(parts))
    
    for _, addr := range parts {
        addr = strings.TrimSpace(addr)
        if addr != "" {
            result = append(result, addr)
        }
    }
    
    return result
}

// 获取环境变量（带默认值）
func getEnvOrDefault(key, defaultValue string) string {
    if value := os.Getenv(key); value != "" {
        return value
    }
    return defaultValue
}

// 获取环境变量（整数类型）
func getEnvAsInt(key string, defaultValue int) int {
    if value := os.Getenv(key); value != "" {
        if intValue, err := strconv.Atoi(value); err == nil {
            return intValue
        }
        log.Printf("警告: 环境变量 %s 的值 '%s' 不是有效的整数，使用默认值 %d", key, value, defaultValue)
    }
    return defaultValue
}

// 验证配置
func (c *BackupSystemConfig) Validate() error {
    // 1. 验证 Elasticsearch 地址
    if len(c.ESAddresses) == 0 {
        return fmt.Errorf("ES_ADDRESSES 不能为空")
    }
    
    for _, addr := range c.ESAddresses {
        if !strings.HasPrefix(addr, "http://") && !strings.HasPrefix(addr, "https://") {
            return fmt.Errorf("无效的 Elasticsearch 地址: %s（必须以 http:// 或 https:// 开头）", addr)
        }
    }
    
    // 2. 验证仓库名称
    if c.Repository == "" {
        return fmt.Errorf("BACKUP_REPOSITORY 不能为空")
    }
    
    // 仓库名称只能包含小写字母、数字、连字符和下划线
    repoPattern := regexp.MustCompile(`^[a-z0-9_-]+$`)
    if !repoPattern.MatchString(c.Repository) {
        return fmt.Errorf("无效的仓库名称: %s（只能包含小写字母、数字、连字符和下划线）", c.Repository)
    }
    
    // 3. 验证元数据路径
    if c.MetadataPath == "" {
        return fmt.Errorf("BACKUP_METADATA_PATH 不能为空")
    }
    
    // 检查路径是否为绝对路径
    if !filepath.IsAbs(c.MetadataPath) {
        return fmt.Errorf("BACKUP_METADATA_PATH 必须是绝对路径: %s", c.MetadataPath)
    }
    
    // 4. 验证数值范围
    if c.MaxConcurrentBackups < 1 || c.MaxConcurrentBackups > 10 {
        return fmt.Errorf("MAX_CONCURRENT_BACKUPS 必须在 1-10 之间，当前值: %d", c.MaxConcurrentBackups)
    }
    
    if c.BackupTimeout < 1 || c.BackupTimeout > 1440 {
        return fmt.Errorf("BACKUP_TIMEOUT_MINUTES 必须在 1-1440 之间，当前值: %d", c.BackupTimeout)
    }
    
    if c.RetryAttempts < 0 || c.RetryAttempts > 10 {
        return fmt.Errorf("RETRY_ATTEMPTS 必须在 0-10 之间，当前值: %d", c.RetryAttempts)
    }
    
    if c.RetryInterval < 1 || c.RetryInterval > 300 {
        return fmt.Errorf("RETRY_INTERVAL_SECONDS 必须在 1-300 之间，当前值: %d", c.RetryInterval)
    }
    
    return nil
}

// 打印配置（隐藏敏感信息）
func (c *BackupSystemConfig) Print() {
    log.Println("=== 备份系统配置 ===")
    log.Printf("  Elasticsearch 地址: %v", c.ESAddresses)
    log.Printf("  Elasticsearch 用户名: %s", c.ESUsername)
    log.Printf("  Elasticsearch 密码: %s", maskPassword(c.ESPassword))
    log.Printf("  备份仓库: %s", c.Repository)
    log.Printf("  元数据路径: %s", c.MetadataPath)
    log.Printf("  最大并发备份数: %d", c.MaxConcurrentBackups)
    log.Printf("  备份超时时间: %d 分钟", c.BackupTimeout)
    log.Printf("  重试次数: %d", c.RetryAttempts)
    log.Printf("  重试间隔: %d 秒", c.RetryInterval)
    log.Println("=====================")
}

// 隐藏密码
func maskPassword(password string) string {
    if password == "" {
        return "<未设置>"
    }
    if len(password) <= 4 {
        return "****"
    }
    return password[:2] + "****" + password[len(password)-2:]
}

// 配置示例文件（.env.example）
/*
# Elasticsearch 配置
ES_ADDRESSES=http://elasticsearch:9200
ES_USERNAME=elastic
ES_PASSWORD=your_password_here

# 备份配置
BACKUP_REPOSITORY=log-backups
BACKUP_METADATA_PATH=/var/lib/log-backup/metadata

# 可选配置
MAX_CONCURRENT_BACKUPS=3
BACKUP_TIMEOUT_MINUTES=60
RETRY_ATTEMPTS=3
RETRY_INTERVAL_SECONDS=5
*/

// Docker Compose 配置示例
/*
version: '3.8'

services:
  api-server:
    image: log-monitoring/api-server:latest
    environment:
      # Elasticsearch 配置
      ES_ADDRESSES: "http://elasticsearch:9200"
      ES_USERNAME: "elastic"
      ES_PASSWORD: "${ES_PASSWORD}"
      
      # 备份配置
      BACKUP_REPOSITORY: "log-backups"
      BACKUP_METADATA_PATH: "/var/lib/log-backup/metadata"
      
      # 可选配置
      MAX_CONCURRENT_BACKUPS: "3"
      BACKUP_TIMEOUT_MINUTES: "60"
      RETRY_ATTEMPTS: "3"
      RETRY_INTERVAL_SECONDS: "5"
    volumes:
      - backup-metadata:/var/lib/log-backup/metadata
    ports:
      - "8080:8080"
    depends_on:
      - elasticsearch

volumes:
  backup-metadata:
*/
```

**关键实现点**:

1. 支持从环境变量读取所有配置，方便容器化部署
2. 提供合理的默认值，减少必需配置项
3. 完整的配置验证，启动时快速失败
4. 隐藏敏感信息（密码）的日志输出
5. 提供配置示例文件，方便用户参考

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| max_concurrent_backups | int | 3 | 最大并发备份数 |
| backup_timeout_minutes | int | 60 | 备份超时时间（分钟） |
| retry_attempts | int | 3 | 重试次数 |
| retry_interval_seconds | int | 5 | 重试间隔（秒） |

**注意**: ES_ADDRESSES、ES_USERNAME、ES_PASSWORD、BACKUP_REPOSITORY、BACKUP_METADATA_PATH 等核心配置需要重启服务才能生效。

**热更新机制**:

- 更新方式: 环境变量（需要重启）
- 生效时间: 服务重启后
- 回滚策略: 启动失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在启动时读取所有环境变量
2. WHEN 配置无效时，THE System SHALL 记录详细错误并退出
3. THE System SHALL 在启动日志中显示当前配置（隐藏敏感信息）
4. THE System SHALL 提供配置示例文件供用户参考

---

# 模块十八 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-18-01 | 创建备份 | Backup | POST | /api/v1/backups | backup.write | Body: {type,index_pattern} | {code:0,data:{id:"backup-1"}} | 201/400/500 | v1 | 否 | 否 | - | 集成真实 Manager |
| API-18-02 | 列出备份 | Backup | GET | /api/v1/backups | backup.read | 无 | {code:0,data:[...]} | 200/500 | v1 | 是 | 否 | - | 集成真实 Manager |
| API-18-03 | 获取备份详情 | Backup | GET | /api/v1/backups/{id} | backup.read | 无 | {code:0,data:{...}} | 200/404/500 | v1 | 是 | 是 | - | 集成真实 Manager |
| API-18-04 | 删除备份 | Backup | DELETE | /api/v1/backups/{id} | backup.write | 无 | {code:0,message:"ok"} | 204/404/500 | v1 | 是 | 否 | - | 集成真实 Manager |
| API-18-05 | 获取备份统计 | Backup | GET | /api/v1/backups/stats | backup.read | 无 | {code:0,data:{...}} | 200/500 | v1 | 是 | 否 | - | 集成真实 Manager |
