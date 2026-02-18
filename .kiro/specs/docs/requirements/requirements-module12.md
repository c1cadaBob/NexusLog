# 模块十二：集成与扩展

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块十二：集成与扩展  
> **需求编号**: 

---

**模块概述**

集成与扩展模块提供完整的 API 接口和插件机制，支持与外部系统集成。通过 RESTful API、Webhook、消息队列等方式，实现系统的可扩展性和互操作性。支持多语言 SDK、插件架构、自定义解析器，满足不同场景的集成需求。

**核心能力**:
- RESTful API 和 OpenAPI 文档
- 多语言 SDK（Python、Java、Go、JavaScript）
- Webhook 和消息队列集成
- 插件架构和自定义解析器
- API 安全认证和限流
- API 使用统计和监控

**技术栈选型**

| 技术类别 | 技术选型 | 版本要求 | 用途说明 |
|---------|---------|---------|---------|
| API 框架 | Gin | 1.9+ | Go Web 框架 |
| API 文档 | OpenAPI | 3.0+ | API 规范和文档 |
| API 文档 UI | Swagger UI | 5.x | API 文档界面 |
| SDK 生成 | OpenAPI Generator | 7.x | 多语言 SDK 生成 |
| API 网关 | Kong | 3.5+ | API 网关和限流 |
| 认证服务 | JWT | - | Token 认证 |
| 限流算法 | 令牌桶 | - | API 限流 |
| 限流存储 | Redis | 7+ | 分布式限流 |
| Webhook 引擎 | 自研 | - | Webhook 管理和重试 |
| 消息队列 | Kafka | 3.6+ | 异步集成 |
| 插件系统 | Go Plugin | - | 动态插件加载 |
| 脚本引擎 | Lua | 5.4+ | 自定义解析脚本 |

**架构设计**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        集成与扩展架构                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      API Gateway 层                               │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  请求处理流程                                              │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ IP 过滤  │─▶│ 身份认证  │─▶│ 限流检查  │─▶│ 路由转发  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  认证方式                                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ API Key  │  │   JWT    │  │ OAuth2.0 │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      RESTful API 层                               │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  核心 API 模块                                             │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ Logs API │  │Alerts API│  │Config API│  │Users API │  │ │  │
│  │  │  │ /logs/*  │  │/alerts/* │  │/config/* │  │/users/*  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │Reports   │  │Webhooks  │  │Plugins   │  │Stats API │  │ │  │
│  │  │  │API       │  │API       │  │API       │  │          │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  OpenAPI 3.0 文档                                          │ │  │
│  │  │  • Swagger UI 交互式文档                                   │ │  │
│  │  │  • ReDoc 静态文档                                          │ │  │
│  │  │  • API Playground 测试环境                                 │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      SDK 层                                       │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  多语言 SDK                                                │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ Python   │  │   Java   │  │    Go    │  │JavaScript│  │ │  │
│  │  │  │   SDK    │  │   SDK    │  │   SDK    │  │   SDK    │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  SDK 功能                                                  │ │  │
│  │  │  • 日志搜索和写入                                          │ │  │
│  │  │  • 告警规则管理                                            │ │  │
│  │  │  • 配置管理                                                │ │  │
│  │  │  • 自动重试和错误处理                                      │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      Webhook 引擎层                               │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  事件触发流程                                              │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ 事件触发  │─▶│ 消息队列  │─▶│ 重试机制  │─▶│ 外部系统  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  支持的事件类型                                            │ │  │
│  │  │  • 告警事件（触发、恢复、升级）                            │ │  │
│  │  │  • 日志事件（高优先级日志、异常日志）                      │ │  │
│  │  │  • 系统事件（部署、配置变更、健康检查）                    │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      插件系统层                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  插件类型                                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ 解析器   │  │ 处理器   │  │ 输出器   │  │ 分析器   │  │ │  │
│  │  │  │ Plugin   │  │ Plugin   │  │ Plugin   │  │ Plugin   │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  插件管理                                                  │ │  │
│  │  │  • 动态加载和卸载                                          │ │  │
│  │  │  • 版本管理和依赖检查                                      │ │  │
│  │  │  • 插件市场和安装                                          │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      限流与监控层                                 │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  限流策略                                                  │ │  │
│  │  │  • 用户级别限流（免费/标准/企业）                          │ │  │
│  │  │  • API 级别限流（读/写/计算密集）                          │ │  │
│  │  │  • IP 级别限流                                             │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  API 监控指标                                              │ │  │
│  │  │  • QPS、响应时间、错误率                                   │ │  │
│  │  │  • 限流触发次数                                            │ │  │
│  │  │  • 各用户/应用调用量                                       │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:
1. **API Gateway 层**: 统一入口，处理认证、限流、路由
2. **RESTful API 层**: 提供完整的 API 接口和 OpenAPI 文档
3. **SDK 层**: 多语言 SDK，简化客户端集成
4. **Webhook 引擎层**: 事件驱动的外部系统集成
5. **插件系统层**: 支持自定义解析器、处理器、输出器
6. **限流与监控层**: API 限流和使用统计

**需求详情**

#### 需求 12-38: RESTful API [MVP]

**用户故事**:
作为开发者，我希望通过 RESTful API 访问系统功能，以便将日志系统与其他业务系统集成。

**验收标准**:

1. THE System SHALL 为所有核心功能提供 RESTful API，遵循 REST 规范
2. THE System SHALL 提供 OpenAPI 3.0 规范文档，包含所有 API 的详细说明
3. THE System SHALL 提供 Swagger UI 交互式文档，支持在线测试 API
4. THE System SHALL 支持 API 版本管理，至少支持 v1 和 v2 两个版本
5. THE System SHALL 提供 Python、Java、Go、JavaScript 四种语言的 SDK
6. THE System SHALL 支持通过 Webhook 向外部系统推送事件，支持至少 10 种事件类型
7. THE System SHALL 支持通过 Kafka 消息队列与外部系统集成
8. THE System SHALL 的 API 响应时间 P95 < 500ms，P99 < 1000ms
9. THE System SHALL 支持 API 批量操作，单次批量操作支持至少 1000 条记录
10. THE System SHALL 通过配置中心管理 API 配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/api/v1/router.go
package v1

import (
    "github.com/gin-gonic/gin"
)

// 注册 API 路由
func RegisterRoutes(r *gin.Engine) {
    // API v1 路由组
    v1 := r.Group("/api/v1")
    {
        // 日志 API
        logs := v1.Group("/logs")
        {
            logs.POST("/search", SearchLogs)
            logs.POST("/ingest", IngestLogs)
            logs.GET("/:id", GetLog)
            logs.DELETE("/:id", DeleteLog)
            logs.POST("/export", ExportLogs)
        }
        
        // 告警 API
        alerts := v1.Group("/alerts")
        {
            alerts.GET("", ListAlerts)
            alerts.POST("", CreateAlert)
            alerts.GET("/:id", GetAlert)
            alerts.PUT("/:id", UpdateAlert)
            alerts.DELETE("/:id", DeleteAlert)
            alerts.POST("/:id/acknowledge", AcknowledgeAlert)
            alerts.POST("/:id/resolve", ResolveAlert)
        }
        
        // 告警规则 API
        rules := v1.Group("/alerts/rules")
        {
            rules.GET("", ListAlertRules)
            rules.POST("", CreateAlertRule)
            rules.GET("/:id", GetAlertRule)
            rules.PUT("/:id", UpdateAlertRule)
            rules.DELETE("/:id", DeleteAlertRule)
            rules.POST("/:id/enable", EnableAlertRule)
            rules.POST("/:id/disable", DisableAlertRule)
        }
        
        // 配置 API
        config := v1.Group("/config")
        {
            config.GET("", GetConfig)
            config.POST("", SetConfig)
            config.DELETE("/:key", DeleteConfig)
            config.GET("/versions", GetConfigVersions)
            config.POST("/rollback", RollbackConfig)
            config.GET("/export", ExportConfig)
            config.POST("/import", ImportConfig)
        }
        
        // Webhook API
        webhooks := v1.Group("/webhooks")
        {
            webhooks.GET("", ListWebhooks)
            webhooks.POST("", CreateWebhook)
            webhooks.GET("/:id", GetWebhook)
            webhooks.PUT("/:id", UpdateWebhook)
            webhooks.DELETE("/:id", DeleteWebhook)
            webhooks.POST("/:id/test", TestWebhook)
            webhooks.GET("/:id/logs", GetWebhookLogs)
        }
        
        // 插件 API
        plugins := v1.Group("/plugins")
        {
            plugins.GET("", ListPlugins)
            plugins.POST("", InstallPlugin)
            plugins.GET("/:id", GetPlugin)
            plugins.DELETE("/:id", UninstallPlugin)
            plugins.POST("/:id/enable", EnablePlugin)
            plugins.POST("/:id/disable", DisablePlugin)
        }
        
        // 统计 API
        stats := v1.Group("/stats")
        {
            stats.GET("/api", GetAPIStats)
            stats.GET("/logs", GetLogStats)
            stats.GET("/alerts", GetAlertStats)
            stats.GET("/system", GetSystemStats)
        }
    }
}


// internal/api/v1/logs.go
package v1

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// 日志搜索请求
type LogSearchRequest struct {
    Query      string                 `json:"query" binding:"required"`
    TimeRange  TimeRange              `json:"timeRange" binding:"required"`
    Filters    []Filter               `json:"filters"`
    Pagination Pagination             `json:"pagination"`
    Sort       []SortField            `json:"sort"`
}

// 时间范围
type TimeRange struct {
    Start string `json:"start" binding:"required"`
    End   string `json:"end" binding:"required"`
}

// 过滤器
type Filter struct {
    Field    string      `json:"field" binding:"required"`
    Operator string      `json:"operator" binding:"required"`
    Value    interface{} `json:"value" binding:"required"`
}

// 分页
type Pagination struct {
    Limit  int `json:"limit" binding:"min=1,max=10000"`
    Offset int `json:"offset" binding:"min=0"`
}

// 排序字段
type SortField struct {
    Field string `json:"field" binding:"required"`
    Order string `json:"order" binding:"oneof=asc desc"`
}

// 日志搜索响应
type LogSearchResponse struct {
    Total   int64       `json:"total"`
    Logs    []LogEntry  `json:"logs"`
    Took    int64       `json:"took"` // 查询耗时（毫秒）
    HasMore bool        `json:"hasMore"`
}

// 日志条目
type LogEntry struct {
    ID        string                 `json:"id"`
    Timestamp string                 `json:"timestamp"`
    Level     string                 `json:"level"`
    Service   string                 `json:"service"`
    Message   string                 `json:"message"`
    Fields    map[string]interface{} `json:"fields"`
    Tags      []string               `json:"tags"`
}

// 搜索日志
func SearchLogs(c *gin.Context) {
    var req LogSearchRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // 设置默认分页
    if req.Pagination.Limit == 0 {
        req.Pagination.Limit = 100
    }
    
    // 执行搜索
    startTime := time.Now()
    logs, total, err := searchService.Search(c.Request.Context(), &req)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    took := time.Since(startTime).Milliseconds()
    
    // 返回结果
    c.JSON(http.StatusOK, LogSearchResponse{
        Total:   total,
        Logs:    logs,
        Took:    took,
        HasMore: int64(req.Pagination.Offset+req.Pagination.Limit) < total,
    })
}

// 批量写入日志
func IngestLogs(c *gin.Context) {
    var logs []LogEntry
    if err := c.ShouldBindJSON(&logs); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // 验证批量大小
    if len(logs) > 1000 {
        c.JSON(http.StatusBadRequest, gin.H{"error": "批量大小不能超过 1000"})
        return
    }
    
    // 批量写入
    result, err := ingestService.IngestBatch(c.Request.Context(), logs)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusCreated, gin.H{
        "success": result.Success,
        "failed":  result.Failed,
        "total":   len(logs),
    })
}


// internal/api/v1/webhooks.go
package v1

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// Webhook 配置
type Webhook struct {
    ID              string            `json:"id"`
    Name            string            `json:"name" binding:"required"`
    URL             string            `json:"url" binding:"required,url"`
    Events          []string          `json:"events" binding:"required,min=1"`
    Headers         map[string]string `json:"headers"`
    PayloadTemplate string            `json:"payloadTemplate"`
    Enabled         bool              `json:"enabled"`
    Retry           RetryConfig       `json:"retry"`
    CreatedAt       string            `json:"createdAt"`
    UpdatedAt       string            `json:"updatedAt"`
}

// 重试配置
type RetryConfig struct {
    MaxAttempts  int    `json:"maxAttempts" binding:"min=1,max=10"`
    Backoff      string `json:"backoff" binding:"oneof=fixed exponential"`
    InitialDelay int    `json:"initialDelay" binding:"min=1"` // 秒
}

// Webhook 事件类型
const (
    EventAlertTriggered  = "alert.triggered"
    EventAlertResolved   = "alert.resolved"
    EventAlertEscalated  = "alert.escalated"
    EventLogHighPriority = "log.high_priority"
    EventLogAnomaly      = "log.anomaly"
    EventSystemDeployed  = "system.deployed"
    EventSystemConfigChanged = "system.config_changed"
    EventSystemHealthCheck = "system.health_check"
    EventBackupCompleted = "backup.completed"
    EventBackupFailed    = "backup.failed"
)

// 创建 Webhook
func CreateWebhook(c *gin.Context) {
    var webhook Webhook
    if err := c.ShouldBindJSON(&webhook); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }
    
    // 验证事件类型
    validEvents := []string{
        EventAlertTriggered, EventAlertResolved, EventAlertEscalated,
        EventLogHighPriority, EventLogAnomaly,
        EventSystemDeployed, EventSystemConfigChanged, EventSystemHealthCheck,
        EventBackupCompleted, EventBackupFailed,
    }
    
    for _, event := range webhook.Events {
        if !contains(validEvents, event) {
            c.JSON(http.StatusBadRequest, gin.H{"error": "无效的事件类型: " + event})
            return
        }
    }
    
    // 创建 Webhook
    webhook.ID = generateID()
    webhook.CreatedAt = time.Now().Format(time.RFC3339)
    webhook.UpdatedAt = webhook.CreatedAt
    
    if err := webhookService.Create(c.Request.Context(), &webhook); err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(http.StatusCreated, webhook)
}

// 测试 Webhook
func TestWebhook(c *gin.Context) {
    id := c.Param("id")
    
    // 获取 Webhook
    webhook, err := webhookService.Get(c.Request.Context(), id)
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Webhook 不存在"})
        return
    }
    
    // 发送测试事件
    testEvent := map[string]interface{}{
        "type":      "test",
        "timestamp": time.Now().Format(time.RFC3339),
        "message":   "这是一个测试事件",
    }
    
    err = webhookService.Send(c.Request.Context(), webhook, testEvent)
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "success": false,
            "error":   err.Error(),
        })
        return
    }
    
    c.JSON(http.StatusOK, gin.H{
        "success": true,
        "message": "测试事件已发送",
    })
}


// pkg/sdk/python/log_system_client.py
"""
企业级日志管理系统 Python SDK
"""

from typing import List, Dict, Optional
import requests
from datetime import datetime

class LogSystemClient:
    """日志系统客户端"""
    
    def __init__(self, base_url: str, api_key: str, timeout: int = 30):
        """
        初始化客户端
        
        Args:
            base_url: API 基础 URL
            api_key: API 密钥
            timeout: 请求超时时间（秒）
        """
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': api_key,
            'Content-Type': 'application/json',
            'User-Agent': 'LogSystemSDK-Python/1.0.0'
        })
        self.timeout = timeout
    
    def search_logs(
        self,
        query: str,
        start_time: str,
        end_time: str,
        filters: Optional[List[Dict]] = None,
        limit: int = 100,
        offset: int = 0,
        sort: Optional[List[Dict]] = None
    ) -> Dict:
        """
        搜索日志
        
        Args:
            query: 搜索查询语句
            start_time: 开始时间（ISO 8601 格式）
            end_time: 结束时间（ISO 8601 格式）
            filters: 过滤条件列表
            limit: 返回记录数
            offset: 偏移量
            sort: 排序字段列表
            
        Returns:
            搜索结果字典
        """
        payload = {
            'query': query,
            'timeRange': {'start': start_time, 'end': end_time},
            'filters': filters or [],
            'pagination': {'limit': limit, 'offset': offset},
            'sort': sort or []
        }
        
        response = self.session.post(
            f'{self.base_url}/api/v1/logs/search',
            json=payload,
            timeout=self.timeout
        )
        response.raise_for_status()
        return response.json()
    
    def ingest_logs(self, logs: List[Dict]) -> Dict:
        """
        批量写入日志
        
        Args:
            logs: 日志列表
            
        Returns:
            写入结果字典
        """
        if len(logs) > 1000:
            raise ValueError("批量大小不能超过 1000")
        
        response = self.session.post(
            f'{self.base_url}/api/v1/logs/ingest',
            json=logs,
            timeout=self.timeout
        )
        response.raise_for_status()
        return response.json()
    
    def create_alert_rule(self, rule: Dict) -> Dict:
        """
        创建告警规则
        
        Args:
            rule: 告警规则配置
            
        Returns:
            创建的告警规则
        """
        response = self.session.post(
            f'{self.base_url}/api/v1/alerts/rules',
            json=rule,
            timeout=self.timeout
        )
        response.raise_for_status()
        return response.json()
    
    def create_webhook(self, webhook: Dict) -> Dict:
        """
        创建 Webhook
        
        Args:
            webhook: Webhook 配置
            
        Returns:
            创建的 Webhook
        """
        response = self.session.post(
            f'{self.base_url}/api/v1/webhooks',
            json=webhook,
            timeout=self.timeout
        )
        response.raise_for_status()
        return response.json()
    
    def get_api_stats(self) -> Dict:
        """
        获取 API 使用统计
        
        Returns:
            API 统计数据
        """
        response = self.session.get(
            f'{self.base_url}/api/v1/stats/api',
            timeout=self.timeout
        )
        response.raise_for_status()
        return response.json()

**使用示例**
if __name__ == '__main__':
    # 初始化客户端
    client = LogSystemClient(
        base_url='https://api.logsystem.example.com',
        api_key='your-api-key-here'
    )
    
    # 搜索日志
    results = client.search_logs(
        query='level:ERROR AND service:payment',
        start_time='2024-12-27T00:00:00Z',
        end_time='2024-12-28T00:00:00Z',
        limit=50
    )
    
    print(f"找到 {results['total']} 条日志")
    for log in results['logs']:
        print(f"{log['timestamp']} [{log['level']}] {log['message']}")
    
    # 批量写入日志
    logs = [
        {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': 'INFO',
            'service': 'api-server',
            'message': '用户登录成功',
            'fields': {'user_id': '12345', 'ip': '192.168.1.100'}
        }
    ]
    
    result = client.ingest_logs(logs)
    print(f"写入成功: {result['success']} 条")
```


**关键实现点**:

1. 使用 Gin 框架实现 RESTful API，遵循 REST 规范和最佳实践
2. 提供 OpenAPI 3.0 规范文档和 Swagger UI 交互式文档
3. 支持 API 版本管理（/api/v1、/api/v2），实现平滑升级
4. 使用 OpenAPI Generator 自动生成 Python、Java、Go、JavaScript 四种语言的 SDK
5. Webhook 支持 10 种事件类型，包含重试机制和失败告警
6. 支持 Kafka 消息队列集成，实现异步事件推送
7. API 批量操作支持最多 1000 条记录，优化批量写入性能

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| api_enabled | bool | true | 是否启用 API |
| api_version | string | "v1" | 默认 API 版本 |
| batch_size_limit | int | 1000 | 批量操作最大记录数 |
| response_timeout | int | 30 | API 响应超时（秒） |
| webhook_enabled | bool | true | 是否启用 Webhook |
| webhook_retry_max | int | 3 | Webhook 最大重试次数 |
| webhook_timeout | int | 10 | Webhook 请求超时（秒） |
| kafka_enabled | bool | true | 是否启用 Kafka 集成 |
| kafka_topic | string | "log-events" | Kafka 主题名称 |
| sdk_download_enabled | bool | true | 是否启用 SDK 下载 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次请求生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的批量大小限制和超时设置
2. WHEN Webhook 配置变更时，THE System SHALL 在下次事件触发时生效
3. THE System SHALL 支持通过 API 查询当前生效的 API 配置
4. THE System SHALL 记录所有 API 配置变更的审计日志
5. WHEN 超时时间变更时，THE System SHALL 验证配置的合理性（>= 5 秒）

---

#### 需求 12-39: API 安全与限流 [MVP]

**用户故事**:
作为安全管理员，我希望能够控制 API 的访问安全和调用频率，以便防止 API 滥用和保护系统资源。

**验收标准**:

1. THE System SHALL 支持三种 API 认证方式（API Key、JWT、OAuth 2.0）
2. THE System SHALL 支持 API 调用频率限制，默认 1000 次/分钟/用户
3. WHEN API 调用超过限制时，THE System SHALL 返回 429 错误并记录日志
4. THE System SHALL 支持为不同用户配置差异化的 API 配额（免费/标准/企业）
5. THE System SHALL 支持 IP 白名单和黑名单配置，黑名单 IP 直接拒绝访问
6. THE System SHALL 提供 API 使用统计，展示 QPS、响应时间、错误率等指标
7. THE System SHALL 支持 API 级别的限流配置，不同 API 可设置不同限流策略
8. THE System SHALL 使用分布式限流算法（基于 Redis），支持多节点部署
9. THE System SHALL 在限流触发时记录详细日志，包含用户、API、时间等信息
10. THE System SHALL 通过配置中心管理限流配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/api/middleware/auth.go
package middleware

import (
    "net/http"
    "strings"
    "github.com/gin-gonic/gin"
    "github.com/golang-jwt/jwt/v5"
)

// 认证中间件
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. 检查 API Key
        apiKey := c.GetHeader("X-API-Key")
        if apiKey != "" {
            user, err := validateAPIKey(c.Request.Context(), apiKey)
            if err == nil {
                c.Set("user", user)
                c.Set("auth_method", "api_key")
                c.Next()
                return
            }
        }
        
        // 2. 检查 JWT Token
        authHeader := c.GetHeader("Authorization")
        if strings.HasPrefix(authHeader, "Bearer ") {
            token := strings.TrimPrefix(authHeader, "Bearer ")
            user, err := validateJWT(token)
            if err == nil {
                c.Set("user", user)
                c.Set("auth_method", "jwt")
                c.Next()
                return
            }
        }
        
        // 3. 检查 OAuth 2.0 Token
        if strings.HasPrefix(authHeader, "OAuth ") {
            token := strings.TrimPrefix(authHeader, "OAuth ")
            user, err := validateOAuth(c.Request.Context(), token)
            if err == nil {
                c.Set("user", user)
                c.Set("auth_method", "oauth")
                c.Next()
                return
            }
        }
        
        // 认证失败
        c.JSON(http.StatusUnauthorized, gin.H{
            "error": "未授权访问",
            "message": "请提供有效的认证凭证",
        })
        c.Abort()
    }
}

// 验证 API Key
func validateAPIKey(ctx context.Context, apiKey string) (*User, error) {
    // 从 Redis 缓存获取
    cacheKey := "api_key:" + apiKey
    if cached, err := redisClient.Get(ctx, cacheKey).Result(); err == nil {
        var user User
        if err := json.Unmarshal([]byte(cached), &user); err == nil {
            return &user, nil
        }
    }
    
    // 从数据库查询
    user, err := userRepo.GetByAPIKey(ctx, apiKey)
    if err != nil {
        return nil, err
    }
    
    // 缓存到 Redis（5 分钟）
    if data, err := json.Marshal(user); err == nil {
        redisClient.Set(ctx, cacheKey, data, 5*time.Minute)
    }
    
    return user, nil
}

// 验证 JWT Token
func validateJWT(tokenString string) (*User, error) {
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        // 验证签名算法
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("无效的签名算法")
        }
        return []byte(jwtSecret), nil
    })
    
    if err != nil {
        return nil, err
    }
    
    if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
        user := &User{
            ID:       claims["user_id"].(string),
            Username: claims["username"].(string),
            Role:     claims["role"].(string),
        }
        return user, nil
    }
    
    return nil, fmt.Errorf("无效的 Token")
}

// 验证 OAuth 2.0 Token
func validateOAuth(ctx context.Context, token string) (*User, error) {
    // 调用 OAuth 服务验证 Token
    resp, err := http.Get(oauthIntrospectURL + "?token=" + token)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("Token 验证失败")
    }
    
    var result struct {
        Active   bool   `json:"active"`
        UserID   string `json:"user_id"`
        Username string `json:"username"`
        Role     string `json:"role"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    if !result.Active {
        return nil, fmt.Errorf("Token 已失效")
    }
    
    user := &User{
        ID:       result.UserID,
        Username: result.Username,
        Role:     result.Role,
    }
    
    return user, nil
}


// internal/api/middleware/ratelimit.go
package middleware

import (
    "context"
    "fmt"
    "net/http"
    "time"
    "github.com/gin-gonic/gin"
    "github.com/redis/go-redis/v9"
)

// 限流中间件
func RateLimitMiddleware(limiter *RateLimiter) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 获取用户信息
        user, exists := c.Get("user")
        if !exists {
            c.Next()
            return
        }
        
        u := user.(*User)
        
        // 检查 IP 黑名单
        clientIP := c.ClientIP()
        if limiter.IsBlacklisted(clientIP) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": "访问被拒绝",
                "message": "您的 IP 地址已被列入黑名单",
            })
            c.Abort()
            return
        }
        
        // 检查 IP 白名单
        if limiter.HasWhitelist() && !limiter.IsWhitelisted(clientIP) {
            c.JSON(http.StatusForbidden, gin.H{
                "error": "访问被拒绝",
                "message": "您的 IP 地址不在白名单中",
            })
            c.Abort()
            return
        }
        
        // 获取限流配置
        limit := limiter.GetUserLimit(u)
        apiPath := c.Request.URL.Path
        apiLimit := limiter.GetAPILimit(apiPath)
        
        // 使用较小的限流值
        if apiLimit > 0 && apiLimit < limit {
            limit = apiLimit
        }
        
        // 执行限流检查
        key := fmt.Sprintf("ratelimit:%s:%s", u.ID, apiPath)
        allowed, remaining, resetTime, err := limiter.Allow(c.Request.Context(), key, limit)
        
        if err != nil {
            log.Errorf("限流检查失败: %v", err)
            c.Next()
            return
        }
        
        // 设置响应头
        c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
        c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))
        c.Header("X-RateLimit-Reset", fmt.Sprintf("%d", resetTime.Unix()))
        
        if !allowed {
            // 记录限流日志
            log.Warnf("API 限流触发: user=%s, api=%s, limit=%d", u.ID, apiPath, limit)
            
            // 记录到审计日志
            auditLogger.LogRateLimit(u.ID, apiPath, clientIP)
            
            c.JSON(http.StatusTooManyRequests, gin.H{
                "error": "请求过于频繁",
                "message": fmt.Sprintf("您已超过 API 调用限制（%d 次/分钟）", limit),
                "retry_after": int(time.Until(resetTime).Seconds()),
            })
            c.Abort()
            return
        }
        
        c.Next()
    }
}

// 限流器
type RateLimiter struct {
    redis      *redis.Client
    config     *RateLimitConfig
    whitelist  map[string]bool
    blacklist  map[string]bool
}

// 限流配置
type RateLimitConfig struct {
    DefaultLimit int
    UserLimits   map[string]int // 用户级别限流
    APILimits    map[string]int // API 级别限流
    Window       time.Duration
}

// 创建限流器
func NewRateLimiter(redis *redis.Client, config *RateLimitConfig) *RateLimiter {
    return &RateLimiter{
        redis:     redis,
        config:    config,
        whitelist: make(map[string]bool),
        blacklist: make(map[string]bool),
    }
}

// 检查是否允许请求（分布式令牌桶算法）
func (rl *RateLimiter) Allow(ctx context.Context, key string, limit int64) (bool, int64, time.Time, error) {
    now := time.Now()
    window := int64(rl.config.Window.Seconds())
    
    // Lua 脚本实现滑动窗口限流
    luaScript := `
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local now = tonumber(ARGV[3])
        
        -- 删除过期的记录
        redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
        
        -- 获取当前窗口内的请求数
        local current = redis.call('ZCARD', key)
        
        if current < limit then
            -- 添加当前请求
            redis.call('ZADD', key, now, now)
            redis.call('EXPIRE', key, window)
            return {1, limit - current - 1, now + window}
        else
            -- 获取最早的请求时间
            local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
            local reset_time = tonumber(oldest[2]) + window
            return {0, 0, reset_time}
        end
    `
    
    result, err := rl.redis.Eval(ctx, luaScript, 
        []string{key}, 
        limit, 
        window, 
        now.Unix(),
    ).Result()
    
    if err != nil {
        return false, 0, now, err
    }
    
    values := result.([]interface{})
    allowed := values[0].(int64) == 1
    remaining := values[1].(int64)
    resetTime := time.Unix(values[2].(int64), 0)
    
    return allowed, remaining, resetTime, nil
}

// 获取用户限流配置
func (rl *RateLimiter) GetUserLimit(user *User) int64 {
    // 根据用户角色获取限流配置
    switch user.Role {
    case "free":
        return 100 // 免费用户：100 次/分钟
    case "standard":
        return 1000 // 标准用户：1000 次/分钟
    case "enterprise":
        return 10000 // 企业用户：10000 次/分钟
    default:
        return int64(rl.config.DefaultLimit)
    }
}

// 获取 API 限流配置
func (rl *RateLimiter) GetAPILimit(apiPath string) int64 {
    if limit, exists := rl.config.APILimits[apiPath]; exists {
        return int64(limit)
    }
    return 0 // 0 表示不限制
}

// 检查 IP 是否在白名单
func (rl *RateLimiter) IsWhitelisted(ip string) bool {
    return rl.whitelist[ip]
}

// 检查 IP 是否在黑名单
func (rl *RateLimiter) IsBlacklisted(ip string) bool {
    return rl.blacklist[ip]
}

// 是否有白名单
func (rl *RateLimiter) HasWhitelist() bool {
    return len(rl.whitelist) > 0
}

// 添加到白名单
func (rl *RateLimiter) AddToWhitelist(ip string) {
    rl.whitelist[ip] = true
}

// 添加到黑名单
func (rl *RateLimiter) AddToBlacklist(ip string) {
    rl.blacklist[ip] = true
}


// internal/api/stats/collector.go
package stats

import (
    "context"
    "time"
    "github.com/prometheus/client_golang/prometheus"
)

// API 统计收集器
type StatsCollector struct {
    // Prometheus 指标
    requestTotal    *prometheus.CounterVec
    requestDuration *prometheus.HistogramVec
    requestSize     *prometheus.HistogramVec
    responseSize    *prometheus.HistogramVec
    rateLimitHits   *prometheus.CounterVec
}

// 创建统计收集器
func NewStatsCollector() *StatsCollector {
    sc := &StatsCollector{
        requestTotal: prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Name: "api_requests_total",
                Help: "API 请求总数",
            },
            []string{"method", "path", "status", "user_role"},
        ),
        
        requestDuration: prometheus.NewHistogramVec(
            prometheus.HistogramOpts{
                Name:    "api_request_duration_seconds",
                Help:    "API 请求响应时间",
                Buckets: []float64{0.01, 0.05, 0.1, 0.5, 1, 2, 5},
            },
            []string{"method", "path", "user_role"},
        ),
        
        requestSize: prometheus.NewHistogramVec(
            prometheus.HistogramOpts{
                Name:    "api_request_size_bytes",
                Help:    "API 请求大小",
                Buckets: prometheus.ExponentialBuckets(100, 10, 7),
            },
            []string{"method", "path"},
        ),
        
        responseSize: prometheus.NewHistogramVec(
            prometheus.HistogramOpts{
                Name:    "api_response_size_bytes",
                Help:    "API 响应大小",
                Buckets: prometheus.ExponentialBuckets(100, 10, 7),
            },
            []string{"method", "path"},
        ),
        
        rateLimitHits: prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Name: "api_rate_limit_hits_total",
                Help: "API 限流触发次数",
            },
            []string{"user_id", "path"},
        ),
    }
    
    // 注册指标
    prometheus.MustRegister(
        sc.requestTotal,
        sc.requestDuration,
        sc.requestSize,
        sc.responseSize,
        sc.rateLimitHits,
    )
    
    return sc
}

// 记录请求
func (sc *StatsCollector) RecordRequest(
    method, path, status, userRole string,
    duration time.Duration,
    requestSize, responseSize int64,
) {
    sc.requestTotal.WithLabelValues(method, path, status, userRole).Inc()
    sc.requestDuration.WithLabelValues(method, path, userRole).Observe(duration.Seconds())
    sc.requestSize.WithLabelValues(method, path).Observe(float64(requestSize))
    sc.responseSize.WithLabelValues(method, path).Observe(float64(responseSize))
}

// 记录限流
func (sc *StatsCollector) RecordRateLimit(userID, path string) {
    sc.rateLimitHits.WithLabelValues(userID, path).Inc()
}

// 统计中间件
func StatsMiddleware(collector *StatsCollector) gin.HandlerFunc {
    return func(c *gin.Context) {
        startTime := time.Now()
        
        // 获取请求大小
        requestSize := c.Request.ContentLength
        
        // 处理请求
        c.Next()
        
        // 计算响应时间
        duration := time.Since(startTime)
        
        // 获取用户角色
        userRole := "anonymous"
        if user, exists := c.Get("user"); exists {
            userRole = user.(*User).Role
        }
        
        // 获取响应大小
        responseSize := int64(c.Writer.Size())
        
        // 记录统计
        collector.RecordRequest(
            c.Request.Method,
            c.Request.URL.Path,
            fmt.Sprintf("%d", c.Writer.Status()),
            userRole,
            duration,
            requestSize,
            responseSize,
        )
    }
}

// API 统计响应
type APIStatsResponse struct {
    TotalRequests   int64              `json:"totalRequests"`
    QPS             float64            `json:"qps"`
    AvgResponseTime float64            `json:"avgResponseTime"` // 毫秒
    P50ResponseTime float64            `json:"p50ResponseTime"` // 毫秒
    P95ResponseTime float64            `json:"p95ResponseTime"` // 毫秒
    P99ResponseTime float64            `json:"p99ResponseTime"` // 毫秒
    ErrorRate       float64            `json:"errorRate"`       // 百分比
    RateLimitHits   int64              `json:"rateLimitHits"`
    TopAPIs         []APIUsage         `json:"topAPIs"`
    TopUsers        []UserUsage        `json:"topUsers"`
}

// API 使用情况
type APIUsage struct {
    Path         string  `json:"path"`
    RequestCount int64   `json:"requestCount"`
    AvgDuration  float64 `json:"avgDuration"` // 毫秒
    ErrorRate    float64 `json:"errorRate"`   // 百分比
}

// 用户使用情况
type UserUsage struct {
    UserID       string `json:"userId"`
    Username     string `json:"username"`
    RequestCount int64  `json:"requestCount"`
    RateLimitHits int64 `json:"rateLimitHits"`
}
```


**关键实现点**:

1. 支持三种认证方式（API Key、JWT、OAuth 2.0），API Key 缓存到 Redis 提升性能
2. 使用 Redis + Lua 脚本实现分布式滑动窗口限流算法，支持多节点部署
3. 支持用户级别限流（免费 100/分钟、标准 1000/分钟、企业 10000/分钟）
4. 支持 API 级别限流，不同 API 可配置不同限流策略
5. 支持 IP 白名单和黑名单，黑名单 IP 直接拒绝访问
6. 使用 Prometheus 收集 API 统计指标（QPS、响应时间、错误率）
7. 限流触发时记录详细审计日志，包含用户、API、IP、时间等信息

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| ratelimit_enabled | bool | true | 是否启用限流 |
| default_limit | int | 1000 | 默认限流（次/分钟） |
| free_user_limit | int | 100 | 免费用户限流 |
| standard_user_limit | int | 1000 | 标准用户限流 |
| enterprise_user_limit | int | 10000 | 企业用户限流 |
| api_limits | map | {} | API 级别限流配置 |
| ip_whitelist | array | [] | IP 白名单 |
| ip_blacklist | array | [] | IP 黑名单 |
| auth_methods | array | ["api_key","jwt","oauth"] | 启用的认证方式 |
| jwt_secret | string | "" | JWT 密钥（加密存储） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次请求生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的限流配置
2. WHEN IP 黑名单变更时，THE System SHALL 在下次请求时生效
3. THE System SHALL 支持通过 API 查询当前生效的限流配置
4. THE System SHALL 记录所有限流配置变更的审计日志
5. WHEN 限流值变更时，THE System SHALL 验证配置的合理性（>= 1）

---

#### 需求 12-40: 协作平台集成 [Phase 2]

**用户故事**:
作为运维团队成员，我希望能够通过常用的协作平台接收告警和协作处理问题，以便提高团队协作效率。

**验收标准**:

1. THE System SHALL 支持与 Slack、Microsoft Teams 集成，在指定频道发送告警通知
2. THE System SHALL 支持与钉钉、飞书等国内协作平台集成
3. WHEN 告警发送到协作平台时，THE System SHALL 包含告警详情、相关日志链接和快速操作按钮
4. THE System SHALL 支持在协作平台中直接确认、升级或关闭告警
5. THE System SHALL 记录协作平台中的告警处理操作，保持操作历史的完整性
6. THE System SHALL 支持配置不同告警级别到不同协作平台频道
7. THE System SHALL 在告警消息中包含@提及功能，通知相关负责人
8. THE System SHALL 支持协作平台消息模板自定义，适配不同团队需求
9. THE System SHALL 在协作平台消息发送失败时自动重试，最多重试 3 次
10. THE System SHALL 通过配置中心管理协作平台集成配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/integration/collaboration/manager.go
package collaboration

import (
    "context"
    "fmt"
    "time"
)

// 协作平台管理器
type CollaborationManager struct {
    config     *CollaborationConfig
    platforms  map[string]Platform
    templates  *TemplateManager
    auditLogger *AuditLogger
}

// 协作平台配置
type CollaborationConfig struct {
    Enabled   bool
    Platforms []PlatformConfig
    Retry     RetryConfig
}

// 平台配置
type PlatformConfig struct {
    Type     PlatformType
    Name     string
    Enabled  bool
    Webhook  string
    Token    string
    Channels map[string]string // 告警级别 -> 频道映射
}

// 平台类型
type PlatformType string

const (
    PlatformSlack     PlatformType = "slack"
    PlatformTeams     PlatformType = "teams"
    PlatformDingTalk  PlatformType = "dingtalk"
    PlatformFeishu    PlatformType = "feishu"
)

// 重试配置
type RetryConfig struct {
    MaxAttempts int
    InitialDelay time.Duration
    MaxDelay     time.Duration
}

// 平台接口
type Platform interface {
    SendAlert(ctx context.Context, alert *Alert) error
    SendMessage(ctx context.Context, message *Message) error
    HandleCallback(ctx context.Context, callback *Callback) error
}

// 告警消息
type Alert struct {
    ID          string
    Title       string
    Severity    string
    Service     string
    Message     string
    Timestamp   time.Time
    LogsURL     string
    Assignees   []string
    Actions     []Action
}

// 快速操作
type Action struct {
    Type  string
    Label string
    URL   string
}

// 创建协作平台管理器
func NewCollaborationManager(config *CollaborationConfig) (*CollaborationManager, error) {
    cm := &CollaborationManager{
        config:    config,
        platforms: make(map[string]Platform),
        templates: NewTemplateManager(),
        auditLogger: NewAuditLogger(),
    }
    
    // 初始化各个平台
    for _, platformConfig := range config.Platforms {
        if !platformConfig.Enabled {
            continue
        }
        
        var platform Platform
        var err error
        
        switch platformConfig.Type {
        case PlatformSlack:
            platform, err = NewSlackPlatform(&platformConfig)
        case PlatformTeams:
            platform, err = NewTeamsPlatform(&platformConfig)
        case PlatformDingTalk:
            platform, err = NewDingTalkPlatform(&platformConfig)
        case PlatformFeishu:
            platform, err = NewFeishuPlatform(&platformConfig)
        default:
            return nil, fmt.Errorf("不支持的平台类型: %s", platformConfig.Type)
        }
        
        if err != nil {
            return nil, fmt.Errorf("初始化平台 %s 失败: %w", platformConfig.Name, err)
        }
        
        cm.platforms[platformConfig.Name] = platform
    }
    
    return cm, nil
}

// 发送告警
func (cm *CollaborationManager) SendAlert(ctx context.Context, alert *Alert) error {
    log.Infof("发送告警到协作平台: alert=%s, severity=%s", alert.ID, alert.Severity)
    
    // 获取目标平台和频道
    targets := cm.getTargets(alert.Severity)
    
    var lastErr error
    successCount := 0
    
    for _, target := range targets {
        platform, exists := cm.platforms[target.Platform]
        if !exists {
            log.Warnf("平台不存在: %s", target.Platform)
            continue
        }
        
        // 设置频道
        alert.Actions = cm.buildActions(alert)
        
        // 发送告警（带重试）
        err := cm.sendWithRetry(ctx, platform, alert)
        if err != nil {
            log.Errorf("发送告警失败: platform=%s, err=%v", target.Platform, err)
            lastErr = err
        } else {
            successCount++
            log.Infof("发送告警成功: platform=%s", target.Platform)
        }
    }
    
    // 记录审计日志
    cm.auditLogger.LogAlertSent(alert, successCount, len(targets))
    
    if successCount == 0 && lastErr != nil {
        return fmt.Errorf("所有平台发送失败: %w", lastErr)
    }
    
    return nil
}


// 带重试的发送
func (cm *CollaborationManager) sendWithRetry(ctx context.Context, platform Platform, alert *Alert) error {
    var lastErr error
    delay := cm.config.Retry.InitialDelay
    
    for attempt := 1; attempt <= cm.config.Retry.MaxAttempts; attempt++ {
        err := platform.SendAlert(ctx, alert)
        if err == nil {
            return nil
        }
        
        lastErr = err
        log.Warnf("发送失败，第 %d 次重试: %v", attempt, err)
        
        if attempt < cm.config.Retry.MaxAttempts {
            time.Sleep(delay)
            delay = min(delay*2, cm.config.Retry.MaxDelay)
        }
    }
    
    return fmt.Errorf("重试 %d 次后仍然失败: %w", cm.config.Retry.MaxAttempts, lastErr)
}

// 构建快速操作
func (cm *CollaborationManager) buildActions(alert *Alert) []Action {
    baseURL := "https://logsystem.example.com"
    
    return []Action{
        {
            Type:  "acknowledge",
            Label: "确认告警",
            URL:   fmt.Sprintf("%s/api/v1/alerts/%s/acknowledge", baseURL, alert.ID),
        },
        {
            Type:  "escalate",
            Label: "升级告警",
            URL:   fmt.Sprintf("%s/api/v1/alerts/%s/escalate", baseURL, alert.ID),
        },
        {
            Type:  "resolve",
            Label: "关闭告警",
            URL:   fmt.Sprintf("%s/api/v1/alerts/%s/resolve", baseURL, alert.ID),
        },
        {
            Type:  "view_logs",
            Label: "查看日志",
            URL:   alert.LogsURL,
        },
    }
}

// Slack 平台实现
type SlackPlatform struct {
    config  *PlatformConfig
    client  *http.Client
}

func NewSlackPlatform(config *PlatformConfig) (*SlackPlatform, error) {
    return &SlackPlatform{
        config: config,
        client: &http.Client{Timeout: 10 * time.Second},
    }, nil
}

func (sp *SlackPlatform) SendAlert(ctx context.Context, alert *Alert) error {
    // 构建 Slack 消息
    message := sp.buildSlackMessage(alert)
    
    // 发送到 Webhook
    data, err := json.Marshal(message)
    if err != nil {
        return err
    }
    
    req, err := http.NewRequestWithContext(ctx, "POST", sp.config.Webhook, bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := sp.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("Slack 返回错误: %d", resp.StatusCode)
    }
    
    return nil
}

func (sp *SlackPlatform) buildSlackMessage(alert *Alert) map[string]interface{} {
    // 颜色映射
    colorMap := map[string]string{
        "critical": "danger",
        "warning":  "warning",
        "info":     "good",
    }
    
    color := colorMap[alert.Severity]
    if color == "" {
        color = "#808080"
    }
    
    // 构建 @ 提及
    mentions := ""
    if len(alert.Assignees) > 0 {
        for _, assignee := range alert.Assignees {
            mentions += fmt.Sprintf("<@%s> ", assignee)
        }
    }
    
    // 构建操作按钮
    actions := []map[string]interface{}{}
    for _, action := range alert.Actions {
        actions = append(actions, map[string]interface{}{
            "type": "button",
            "text": map[string]string{
                "type": "plain_text",
                "text": action.Label,
            },
            "url": action.URL,
        })
    }
    
    return map[string]interface{}{
        "text": fmt.Sprintf("%s告警: %s", mentions, alert.Title),
        "attachments": []map[string]interface{}{
            {
                "color": color,
                "title": alert.Title,
                "text":  alert.Message,
                "fields": []map[string]interface{}{
                    {
                        "title": "服务",
                        "value": alert.Service,
                        "short": true,
                    },
                    {
                        "title": "级别",
                        "value": alert.Severity,
                        "short": true,
                    },
                    {
                        "title": "时间",
                        "value": alert.Timestamp.Format(time.RFC3339),
                        "short": true,
                    },
                },
                "actions": actions,
            },
        },
    }
}

// 钉钉平台实现
type DingTalkPlatform struct {
    config *PlatformConfig
    client *http.Client
}

func NewDingTalkPlatform(config *PlatformConfig) (*DingTalkPlatform, error) {
    return &DingTalkPlatform{
        config: config,
        client: &http.Client{Timeout: 10 * time.Second},
    }, nil
}

func (dp *DingTalkPlatform) SendAlert(ctx context.Context, alert *Alert) error {
    // 构建钉钉消息
    message := dp.buildDingTalkMessage(alert)
    
    // 发送到 Webhook
    data, err := json.Marshal(message)
    if err != nil {
        return err
    }
    
    req, err := http.NewRequestWithContext(ctx, "POST", dp.config.Webhook, bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := dp.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("钉钉返回错误: %d", resp.StatusCode)
    }
    
    return nil
}

func (dp *DingTalkPlatform) buildDingTalkMessage(alert *Alert) map[string]interface{} {
    // 构建 @ 提及
    atMobiles := []string{}
    for _, assignee := range alert.Assignees {
        atMobiles = append(atMobiles, assignee)
    }
    
    // 构建 Markdown 消息
    markdown := fmt.Sprintf(`### %s

**服务**: %s  
**级别**: %s  
**时间**: %s  

%s

[查看日志](%s)
`, alert.Title, alert.Service, alert.Severity, alert.Timestamp.Format("2006-01-02 15:04:05"), alert.Message, alert.LogsURL)
    
    return map[string]interface{}{
        "msgtype": "markdown",
        "markdown": map[string]interface{}{
            "title": alert.Title,
            "text":  markdown,
        },
        "at": map[string]interface{}{
            "atMobiles": atMobiles,
            "isAtAll":   false,
        },
    }
}

// 处理回调
func (cm *CollaborationManager) HandleCallback(ctx context.Context, platformName string, callback *Callback) error {
    platform, exists := cm.platforms[platformName]
    if !exists {
        return fmt.Errorf("平台不存在: %s", platformName)
    }
    
    // 处理回调
    err := platform.HandleCallback(ctx, callback)
    if err != nil {
        return err
    }
    
    // 记录审计日志
    cm.auditLogger.LogCallback(platformName, callback)
    
    return nil
}

// 回调数据
type Callback struct {
    AlertID string
    Action  string
    User    string
    Data    map[string]interface{}
}
```


**关键实现点**:

1. 支持 Slack、Microsoft Teams、钉钉、飞书四种主流协作平台
2. 告警消息包含详情、日志链接、快速操作按钮（确认、升级、关闭）
3. 支持 @ 提及功能，自动通知相关负责人
4. 消息发送失败时自动重试，最多重试 3 次，使用指数退避策略
5. 支持配置不同告警级别到不同频道，实现告警分级通知
6. 支持自定义消息模板，适配不同团队的通知需求
7. 记录所有协作平台操作的审计日志，保持操作历史完整性

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| collaboration_enabled | bool | true | 是否启用协作平台集成 |
| platforms | array | [] | 启用的平台列表 |
| retry_max_attempts | int | 3 | 最大重试次数 |
| retry_initial_delay | int | 1 | 初始重试延迟（秒） |
| retry_max_delay | int | 30 | 最大重试延迟（秒） |
| channel_mapping | map | {} | 告警级别到频道的映射 |
| message_templates | map | {} | 自定义消息模板 |
| mention_enabled | bool | true | 是否启用 @ 提及 |
| action_buttons_enabled | bool | true | 是否显示快速操作按钮 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次告警生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的平台配置和频道映射
2. WHEN 消息模板变更时，THE System SHALL 在下次告警时使用新模板
3. THE System SHALL 支持通过 API 查询当前生效的协作平台配置
4. THE System SHALL 记录所有协作平台配置变更的审计日志
5. WHEN Webhook URL 变更时，THE System SHALL 验证 URL 的有效性

---



#### 需求 12-41: DevOps 工具链集成 [Phase 2]

**用户故事**:
作为 DevOps 工程师，我希望将日志系统与 CI/CD 工具链集成，以便在构建和部署过程中自动采集和分析日志。

**验收标准**:

1. THE System SHALL 支持与 Jenkins、GitLab CI/CD、GitHub Actions 三种主流 CI/CD 工具集成
2. THE System SHALL 在构建或部署失败时自动关联相关日志并发送告警
3. THE System SHALL 提供 CI/CD 流水线的日志视图，展示构建历史和状态
4. THE System SHALL 支持在 CI/CD 流程中通过 API 推送自定义日志事件
5. THE System SHALL 支持构建日志的自动归档，保留期至少 90 天
6. THE System SHALL 支持配置不同项目的日志采集规则和告警策略
7. THE System SHALL 在构建成功后自动标记相关日志，便于追溯
8. THE System SHALL 支持构建日志的全文搜索和过滤，响应时间 < 2 秒
9. THE System SHALL 提供构建日志的统计分析，包括成功率、失败原因分布等
10. THE System SHALL 通过配置中心管理 CI/CD 集成配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/integration/cicd/manager.go
package cicd

import (
    "context"
    "time"
)

// CI/CD 集成管理器
type CICDManager struct {
    config      *CICDConfig
    jenkins     *JenkinsIntegration
    gitlab      *GitLabIntegration
    github      *GitHubIntegration
    logCollector *LogCollector
    alertManager *AlertManager
    auditLogger  *AuditLogger
}

// CI/CD 配置
type CICDConfig struct {
    Enabled          bool
    Platforms        []string
    LogRetentionDays int
    AutoAlert        bool
    AlertOnFailure   bool
    AlertOnSuccess   bool
}

// 构建事件
type BuildEvent struct {
    ID          string
    Platform    string
    Project     string
    Branch      string
    Commit      string
    Status      BuildStatus
    StartTime   time.Time
    EndTime     time.Time
    Duration    time.Duration
    Logs        []string
    Artifacts   []string
    Metadata    map[string]interface{}
}

// 构建状态
type BuildStatus string

const (
    StatusPending   BuildStatus = "pending"
    StatusRunning   BuildStatus = "running"
    StatusSuccess   BuildStatus = "success"
    StatusFailed    BuildStatus = "failed"
    StatusCancelled BuildStatus = "cancelled"
)

// 创建 CI/CD 管理器
func NewCICDManager(config *CICDConfig) (*CICDManager, error) {
    cm := &CICDManager{
        config: config,
    }
    
    // 初始化各平台集成
    if contains(config.Platforms, "jenkins") {
        cm.jenkins = NewJenkinsIntegration()
    }
    
    if contains(config.Platforms, "gitlab") {
        cm.gitlab = NewGitLabIntegration()
    }
    
    if contains(config.Platforms, "github") {
        cm.github = NewGitHubIntegration()
    }
    
    // 初始化日志收集器
    cm.logCollector = NewLogCollector()
    
    // 初始化告警管理器
    cm.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    cm.auditLogger = NewAuditLogger()
    
    return cm, nil
}

// 处理构建事件
func (cm *CICDManager) HandleBuildEvent(ctx context.Context, event *BuildEvent) error {
    log.Infof("处理构建事件: platform=%s, project=%s, status=%s", 
        event.Platform, event.Project, event.Status)
    
    // 1. 收集构建日志
    if err := cm.collectBuildLogs(ctx, event); err != nil {
        log.Errorf("收集构建日志失败: %v", err)
    }
    
    // 2. 标记日志
    if err := cm.tagBuildLogs(ctx, event); err != nil {
        log.Errorf("标记构建日志失败: %v", err)
    }
    
    // 3. 检查是否需要告警
    if cm.shouldAlert(event) {
        if err := cm.sendBuildAlert(ctx, event); err != nil {
            log.Errorf("发送构建告警失败: %v", err)
        }
    }
    
    // 4. 记录审计日志
    cm.auditLogger.LogBuildEvent(event)
    
    return nil
}

// 收集构建日志
func (cm *CICDManager) collectBuildLogs(ctx context.Context, event *BuildEvent) error {
    log.Infof("收集构建日志: build=%s", event.ID)
    
    var logs []string
    var err error
    
    // 根据平台获取日志
    switch event.Platform {
    case "jenkins":
        logs, err = cm.jenkins.GetBuildLogs(ctx, event.ID)
    case "gitlab":
        logs, err = cm.gitlab.GetBuildLogs(ctx, event.ID)
    case "github":
        logs, err = cm.github.GetBuildLogs(ctx, event.ID)
    default:
        return fmt.Errorf("不支持的平台: %s", event.Platform)
    }
    
    if err != nil {
        return err
    }
    
    // 解析和存储日志
    for _, logLine := range logs {
        logEntry := &LogEntry{
            Timestamp: time.Now(),
            Level:     parseLogLevel(logLine),
            Service:   "cicd",
            Message:   logLine,
            Fields: map[string]interface{}{
                "build_id":  event.ID,
                "platform":  event.Platform,
                "project":   event.Project,
                "branch":    event.Branch,
                "commit":    event.Commit,
                "status":    event.Status,
            },
            Tags: []string{"cicd", event.Platform, event.Project},
        }
        
        cm.logCollector.Collect(ctx, logEntry)
    }
    
    return nil
}

// 标记构建日志
func (cm *CICDManager) tagBuildLogs(ctx context.Context, event *BuildEvent) error {
    log.Infof("标记构建日志: build=%s, status=%s", event.ID, event.Status)
    
    // 根据构建状态添加标签
    tags := []string{
        fmt.Sprintf("build:%s", event.ID),
        fmt.Sprintf("status:%s", event.Status),
        fmt.Sprintf("project:%s", event.Project),
        fmt.Sprintf("branch:%s", event.Branch),
    }
    
    // 更新日志标签
    return cm.logCollector.UpdateTags(ctx, event.ID, tags)
}

// 判断是否需要告警
func (cm *CICDManager) shouldAlert(event *BuildEvent) bool {
    if !cm.config.AutoAlert {
        return false
    }
    
    // 构建失败时告警
    if event.Status == StatusFailed && cm.config.AlertOnFailure {
        return true
    }
    
    // 构建成功时告警（可选）
    if event.Status == StatusSuccess && cm.config.AlertOnSuccess {
        return true
    }
    
    return false
}

// 发送构建告警
func (cm *CICDManager) sendBuildAlert(ctx context.Context, event *BuildEvent) error {
    log.Infof("发送构建告警: build=%s, status=%s", event.ID, event.Status)
    
    // 构建告警消息
    alert := &Alert{
        Level:   getAlertLevel(event.Status),
        Title:   fmt.Sprintf("构建%s: %s", getStatusText(event.Status), event.Project),
        Message: fmt.Sprintf("项目 %s 在分支 %s 的构建%s", 
            event.Project, event.Branch, getStatusText(event.Status)),
        Fields: map[string]interface{}{
            "build_id":  event.ID,
            "platform":  event.Platform,
            "project":   event.Project,
            "branch":    event.Branch,
            "commit":    event.Commit,
            "duration":  event.Duration.String(),
            "log_link":  fmt.Sprintf("/logs?build_id=%s", event.ID),
        },
        Timestamp: time.Now(),
    }
    
    return cm.alertManager.Send(ctx, alert)
}

// Jenkins 集成
type JenkinsIntegration struct {
    baseURL string
    token   string
    client  *http.Client
}

// 获取 Jenkins 构建日志
func (ji *JenkinsIntegration) GetBuildLogs(ctx context.Context, buildID string) ([]string, error) {
    url := fmt.Sprintf("%s/job/%s/consoleText", ji.baseURL, buildID)
    
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+ji.token)
    
    resp, err := ji.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("获取构建日志失败: status=%d", resp.StatusCode)
    }
    
    // 读取日志内容
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    // 按行分割
    logs := strings.Split(string(body), "\n")
    return logs, nil
}

// GitLab 集成
type GitLabIntegration struct {
    baseURL string
    token   string
    client  *http.Client
}

// 获取 GitLab 构建日志
func (gi *GitLabIntegration) GetBuildLogs(ctx context.Context, buildID string) ([]string, error) {
    url := fmt.Sprintf("%s/api/v4/projects/%s/jobs/%s/trace", gi.baseURL, buildID)
    
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("PRIVATE-TOKEN", gi.token)
    
    resp, err := gi.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("获取构建日志失败: status=%d", resp.StatusCode)
    }
    
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    logs := strings.Split(string(body), "\n")
    return logs, nil
}

// GitHub Actions 集成
type GitHubIntegration struct {
    baseURL string
    token   string
    client  *http.Client
}

// 获取 GitHub Actions 构建日志
func (ghi *GitHubIntegration) GetBuildLogs(ctx context.Context, buildID string) ([]string, error) {
    url := fmt.Sprintf("%s/repos/%s/actions/runs/%s/logs", ghi.baseURL, buildID)
    
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "token "+ghi.token)
    req.Header.Set("Accept", "application/vnd.github.v3+json")
    
    resp, err := ghi.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("获取构建日志失败: status=%d", resp.StatusCode)
    }
    
    // GitHub 返回的是 zip 文件，需要解压
    zipReader, err := zip.NewReader(resp.Body, resp.ContentLength)
    if err != nil {
        return nil, err
    }
    
    var logs []string
    for _, file := range zipReader.File {
        rc, err := file.Open()
        if err != nil {
            continue
        }
        
        content, err := io.ReadAll(rc)
        rc.Close()
        
        if err != nil {
            continue
        }
        
        logs = append(logs, strings.Split(string(content), "\n")...)
    }
    
    return logs, nil
}
```

**关键实现点**:

1. 支持 Jenkins、GitLab CI/CD、GitHub Actions 三种主流 CI/CD 工具集成
2. 自动收集构建日志并关联构建信息（项目、分支、提交、状态）
3. 构建失败时自动发送告警，包含日志链接和构建详情
4. 支持构建日志的自动标记和分类，便于搜索和追溯
5. 构建日志保留期 90 天，支持自动归档
6. 提供构建日志的统计分析，包括成功率、失败原因分布
7. 通过 Webhook 接收 CI/CD 平台的构建事件，实时处理

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| cicd_enabled | bool | true | 是否启用 CI/CD 集成 |
| platforms | array | ["jenkins","gitlab","github"] | 启用的平台列表 |
| log_retention_days | int | 90 | 日志保留天数 |
| auto_alert | bool | true | 是否自动告警 |
| alert_on_failure | bool | true | 构建失败时告警 |
| alert_on_success | bool | false | 构建成功时告警 |
| collect_artifacts | bool | true | 是否收集构建产物 |
| max_log_size | int | 10485760 | 单次构建最大日志大小（字节） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次构建生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的平台配置和告警策略
2. WHEN 日志保留期变更时，THE System SHALL 在下次归档任务时生效
3. THE System SHALL 支持通过 API 查询当前生效的 CI/CD 集成配置
4. THE System SHALL 记录所有 CI/CD 配置变更的审计日志
5. WHEN 平台凭证变更时，THE System SHALL 验证凭证的有效性

---



#### 需求 12-42: 外部告警平台集成 [Phase 2]

**用户故事**:
作为运维工程师，我希望将日志系统与专业告警平台集成，以便统一管理所有系统的告警。

**验收标准**:

1. THE System SHALL 支持与 PagerDuty、OpsGenie、Zabbix、ServiceNow 四种告警平台集成
2. THE System SHALL 在触发告警时自动推送到外部告警平台
3. WHEN 告警状态在外部平台更新时，THE System SHALL 同步更新本地告警状态
4. THE System SHALL 支持配置告警到不同平台的路由规则（按级别、服务、标签）
5. THE System SHALL 提供告警同步状态监控，显示同步成功率和失败原因
6. THE System SHALL 支持告警的双向同步，保持状态一致性
7. THE System SHALL 在外部平台集成失败时记录错误日志并发送通知
8. THE System SHALL 支持告警的优先级映射，适配不同平台的优先级体系
9. THE System SHALL 提供外部平台的告警处理历史记录
10. THE System SHALL 通过配置中心管理外部平台集成配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/integration/alerting/manager.go
package alerting

import (
    "context"
    "time"
)

// 告警平台集成管理器
type AlertPlatformManager struct {
    config       *PlatformConfig
    pagerduty    *PagerDutyIntegration
    opsgenie     *OpsGenieIntegration
    zabbix       *ZabbixIntegration
    servicenow   *ServiceNowIntegration
    syncManager  *SyncManager
    routingEngine *RoutingEngine
    auditLogger  *AuditLogger
}

// 平台配置
type PlatformConfig struct {
    Enabled       bool
    Platforms     []string
    SyncInterval  time.Duration
    RetryAttempts int
    Timeout       time.Duration
}

// 告警路由规则
type RoutingRule struct {
    ID          string
    Name        string
    Platform    string
    Conditions  []Condition
    Priority    int
    Enabled     bool
}

// 条件
type Condition struct {
    Field    string
    Operator string
    Value    interface{}
}

// 告警同步记录
type SyncRecord struct {
    ID           string
    AlertID      string
    Platform     string
    ExternalID   string
    Status       SyncStatus
    LastSyncTime time.Time
    ErrorMessage string
    RetryCount   int
}

// 同步状态
type SyncStatus string

const (
    SyncStatusPending   SyncStatus = "pending"
    SyncStatusSuccess   SyncStatus = "success"
    SyncStatusFailed    SyncStatus = "failed"
    SyncStatusRetrying  SyncStatus = "retrying"
)

// 创建告警平台管理器
func NewAlertPlatformManager(config *PlatformConfig) (*AlertPlatformManager, error) {
    apm := &AlertPlatformManager{
        config: config,
    }
    
    // 初始化各平台集成
    if contains(config.Platforms, "pagerduty") {
        apm.pagerduty = NewPagerDutyIntegration()
    }
    
    if contains(config.Platforms, "opsgenie") {
        apm.opsgenie = NewOpsGenieIntegration()
    }
    
    if contains(config.Platforms, "zabbix") {
        apm.zabbix = NewZabbixIntegration()
    }
    
    if contains(config.Platforms, "servicenow") {
        apm.servicenow = NewServiceNowIntegration()
    }
    
    // 初始化同步管理器
    apm.syncManager = NewSyncManager()
    
    // 初始化路由引擎
    apm.routingEngine = NewRoutingEngine()
    
    // 初始化审计日志记录器
    apm.auditLogger = NewAuditLogger()
    
    return apm, nil
}

// 推送告警到外部平台
func (apm *AlertPlatformManager) PushAlert(ctx context.Context, alert *Alert) error {
    log.Infof("推送告警到外部平台: alert=%s", alert.ID)
    
    // 1. 根据路由规则确定目标平台
    platforms := apm.routingEngine.Route(alert)
    if len(platforms) == 0 {
        log.Warnf("没有匹配的路由规则: alert=%s", alert.ID)
        return nil
    }
    
    // 2. 推送到各个平台
    for _, platform := range platforms {
        go func(platform string) {
            if err := apm.pushToPlatform(ctx, alert, platform); err != nil {
                log.Errorf("推送告警失败: platform=%s, err=%v", platform, err)
                
                // 记录同步失败
                apm.syncManager.RecordFailure(alert.ID, platform, err)
            } else {
                log.Infof("推送告警成功: platform=%s, alert=%s", platform, alert.ID)
                
                // 记录同步成功
                apm.syncManager.RecordSuccess(alert.ID, platform)
            }
        }(platform)
    }
    
    return nil
}

// 推送到指定平台
func (apm *AlertPlatformManager) pushToPlatform(ctx context.Context, alert *Alert, platform string) error {
    // 映射告警优先级
    priority := apm.mapPriority(alert.Level, platform)
    
    // 构建外部告警
    externalAlert := &ExternalAlert{
        Title:       alert.Title,
        Description: alert.Message,
        Priority:    priority,
        Source:      "log-management-system",
        Timestamp:   alert.Timestamp,
        Fields:      alert.Fields,
        Tags:        alert.Tags,
    }
    
    var externalID string
    var err error
    
    // 根据平台推送
    switch platform {
    case "pagerduty":
        externalID, err = apm.pagerduty.CreateIncident(ctx, externalAlert)
    case "opsgenie":
        externalID, err = apm.opsgenie.CreateAlert(ctx, externalAlert)
    case "zabbix":
        externalID, err = apm.zabbix.SendAlert(ctx, externalAlert)
    case "servicenow":
        externalID, err = apm.servicenow.CreateIncident(ctx, externalAlert)
    default:
        return fmt.Errorf("不支持的平台: %s", platform)
    }
    
    if err != nil {
        return err
    }
    
    // 保存外部 ID
    apm.syncManager.SaveExternalID(alert.ID, platform, externalID)
    
    return nil
}

// 同步告警状态
func (apm *AlertPlatformManager) SyncAlertStatus(ctx context.Context) error {
    log.Info("开始同步告警状态")
    
    // 获取所有待同步的告警
    records := apm.syncManager.GetPendingSync()
    
    for _, record := range records {
        // 从外部平台获取状态
        status, err := apm.getExternalStatus(ctx, record)
        if err != nil {
            log.Errorf("获取外部状态失败: platform=%s, err=%v", record.Platform, err)
            continue
        }
        
        // 更新本地告警状态
        if err := apm.updateLocalStatus(ctx, record.AlertID, status); err != nil {
            log.Errorf("更新本地状态失败: alert=%s, err=%v", record.AlertID, err)
            continue
        }
        
        // 更新同步记录
        record.Status = SyncStatusSuccess
        record.LastSyncTime = time.Now()
        apm.syncManager.UpdateRecord(record)
        
        log.Infof("同步告警状态成功: alert=%s, platform=%s, status=%s", 
            record.AlertID, record.Platform, status)
    }
    
    return nil
}

// 获取外部平台状态
func (apm *AlertPlatformManager) getExternalStatus(ctx context.Context, record *SyncRecord) (string, error) {
    switch record.Platform {
    case "pagerduty":
        return apm.pagerduty.GetIncidentStatus(ctx, record.ExternalID)
    case "opsgenie":
        return apm.opsgenie.GetAlertStatus(ctx, record.ExternalID)
    case "zabbix":
        return apm.zabbix.GetAlertStatus(ctx, record.ExternalID)
    case "servicenow":
        return apm.servicenow.GetIncidentStatus(ctx, record.ExternalID)
    default:
        return "", fmt.Errorf("不支持的平台: %s", record.Platform)
    }
}

// 映射告警优先级
func (apm *AlertPlatformManager) mapPriority(level string, platform string) string {
    // 不同平台的优先级映射
    priorityMap := map[string]map[string]string{
        "pagerduty": {
            "critical": "critical",
            "error":    "error",
            "warning":  "warning",
            "info":     "info",
        },
        "opsgenie": {
            "critical": "P1",
            "error":    "P2",
            "warning":  "P3",
            "info":     "P4",
        },
        "zabbix": {
            "critical": "5",
            "error":    "4",
            "warning":  "3",
            "info":     "2",
        },
        "servicenow": {
            "critical": "1",
            "error":    "2",
            "warning":  "3",
            "info":     "4",
        },
    }
    
    if platformMap, exists := priorityMap[platform]; exists {
        if priority, exists := platformMap[level]; exists {
            return priority
        }
    }
    
    return "info"
}

// PagerDuty 集成
type PagerDutyIntegration struct {
    apiKey     string
    serviceKey string
    client     *http.Client
}

// 创建 PagerDuty 事件
func (pdi *PagerDutyIntegration) CreateIncident(ctx context.Context, alert *ExternalAlert) (string, error) {
    url := "https://api.pagerduty.com/incidents"
    
    payload := map[string]interface{}{
        "incident": map[string]interface{}{
            "type":    "incident",
            "title":   alert.Title,
            "service": map[string]string{"id": pdi.serviceKey, "type": "service_reference"},
            "urgency": alert.Priority,
            "body": map[string]interface{}{
                "type":    "incident_body",
                "details": alert.Description,
            },
        },
    }
    
    data, err := json.Marshal(payload)
    if err != nil {
        return "", err
    }
    
    req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
    if err != nil {
        return "", err
    }
    
    req.Header.Set("Authorization", "Token token="+pdi.apiKey)
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("Accept", "application/vnd.pagerduty+json;version=2")
    
    resp, err := pdi.client.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusCreated {
        return "", fmt.Errorf("创建事件失败: status=%d", resp.StatusCode)
    }
    
    var result struct {
        Incident struct {
            ID string `json:"id"`
        } `json:"incident"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return "", err
    }
    
    return result.Incident.ID, nil
}

// 获取 PagerDuty 事件状态
func (pdi *PagerDutyIntegration) GetIncidentStatus(ctx context.Context, incidentID string) (string, error) {
    url := fmt.Sprintf("https://api.pagerduty.com/incidents/%s", incidentID)
    
    req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
    if err != nil {
        return "", err
    }
    
    req.Header.Set("Authorization", "Token token="+pdi.apiKey)
    req.Header.Set("Accept", "application/vnd.pagerduty+json;version=2")
    
    resp, err := pdi.client.Do(req)
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return "", fmt.Errorf("获取事件状态失败: status=%d", resp.StatusCode)
    }
    
    var result struct {
        Incident struct {
            Status string `json:"status"`
        } `json:"incident"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return "", err
    }
    
    return result.Incident.Status, nil
}

// 路由引擎
type RoutingEngine struct {
    rules []*RoutingRule
}

// 路由告警
func (re *RoutingEngine) Route(alert *Alert) []string {
    var platforms []string
    
    for _, rule := range re.rules {
        if !rule.Enabled {
            continue
        }
        
        // 检查条件是否匹配
        if re.matchConditions(alert, rule.Conditions) {
            platforms = append(platforms, rule.Platform)
        }
    }
    
    return platforms
}

// 匹配条件
func (re *RoutingEngine) matchConditions(alert *Alert, conditions []Condition) bool {
    for _, condition := range conditions {
        if !re.matchCondition(alert, condition) {
            return false
        }
    }
    return true
}

// 匹配单个条件
func (re *RoutingEngine) matchCondition(alert *Alert, condition Condition) bool {
    var value interface{}
    
    // 获取字段值
    switch condition.Field {
    case "level":
        value = alert.Level
    case "service":
        value = alert.Service
    case "tags":
        value = alert.Tags
    default:
        if v, exists := alert.Fields[condition.Field]; exists {
            value = v
        }
    }
    
    // 根据操作符判断
    switch condition.Operator {
    case "eq":
        return value == condition.Value
    case "ne":
        return value != condition.Value
    case "contains":
        if str, ok := value.(string); ok {
            return strings.Contains(str, condition.Value.(string))
        }
    case "in":
        if arr, ok := condition.Value.([]interface{}); ok {
            for _, v := range arr {
                if v == value {
                    return true
                }
            }
        }
    }
    
    return false
}
```

**关键实现点**:

1. 支持 PagerDuty、OpsGenie、Zabbix、ServiceNow 四种主流告警平台
2. 基于路由规则自动推送告警到不同平台（按级别、服务、标签）
3. 支持告警状态的双向同步，保持本地和外部平台状态一致
4. 自动映射告警优先级，适配不同平台的优先级体系
5. 推送失败时自动重试，最多重试 3 次，使用指数退避策略
6. 提供告警同步状态监控，显示成功率和失败原因
7. 记录所有外部平台操作的审计日志

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| alerting_enabled | bool | true | 是否启用外部告警平台集成 |
| platforms | array | [] | 启用的平台列表 |
| sync_interval | int | 60 | 状态同步间隔（秒） |
| retry_attempts | int | 3 | 最大重试次数 |
| timeout | int | 30 | 请求超时时间（秒） |
| routing_rules | array | [] | 告警路由规则 |
| priority_mapping | map | {} | 优先级映射配置 |
| auto_sync | bool | true | 是否自动同步状态 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次告警生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的平台配置和路由规则
2. WHEN 路由规则变更时，THE System SHALL 在下次告警时使用新规则
3. THE System SHALL 支持通过 API 查询当前生效的外部平台配置
4. THE System SHALL 记录所有外部平台配置变更的审计日志
5. WHEN 平台凭证变更时，THE System SHALL 验证凭证的有效性

---

#### 需求 12-43: 性能监控集成 [Phase 2]

**用户故事**:
作为运维工程师，我希望将日志系统与性能监控工具集成，以便关联分析日志和系统性能指标。

**验收标准**:

1. THE System SHALL 支持与 Prometheus、Grafana 集成，提供统一的监控仪表盘
2. THE System SHALL 支持将日志数据与性能指标（CPU、内存、磁盘、网络）关联展示
3. WHEN 性能指标异常时，THE System SHALL 自动关联相关时间段的日志数据
4. THE System SHALL 支持自定义性能指标的采集和告警规则
5. THE System SHALL 提供预置的 Grafana 仪表盘模板，包含日志和性能指标
6. THE System SHALL 支持导出性能监控数据，用于离线分析和报告生成
7. THE System SHALL 支持性能指标的历史趋势分析，时间跨度至少 30 天
8. THE System SHALL 在性能指标超过阈值时自动触发告警并关联日志
9. THE System SHALL 提供性能指标与日志的关联查询 API
10. THE System SHALL 通过配置中心管理性能监控配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/integration/monitoring/manager.go
package monitoring

import (
    "context"
    "time"
    "github.com/prometheus/client_golang/prometheus"
)

// 性能监控管理器
type MonitoringManager struct {
    config          *MonitoringConfig
    prometheus      *PrometheusIntegration
    grafana         *GrafanaIntegration
    metricsCollector *MetricsCollector
    correlator      *LogMetricsCorrelator
    alertManager    *AlertManager
    auditLogger     *AuditLogger
}

// 监控配置
type MonitoringConfig struct {
    Enabled            bool
    PrometheusURL      string
    GrafanaURL         string
    ScrapeInterval     time.Duration
    RetentionDays      int
    CustomMetrics      []CustomMetric
    AlertRules         []AlertRule
}

// 自定义指标
type CustomMetric struct {
    Name        string
    Type        string
    Description string
    Labels      []string
    Collector   func() float64
}

// 告警规则
type AlertRule struct {
    Name        string
    Metric      string
    Operator    string
    Threshold   float64
    Duration    time.Duration
    Severity    string
    Enabled     bool
}

// 性能指标
type PerformanceMetrics struct {
    Timestamp   time.Time
    CPU         float64
    Memory      float64
    Disk        float64
    Network     float64
    Custom      map[string]float64
}

// 创建性能监控管理器
func NewMonitoringManager(config *MonitoringConfig) (*MonitoringManager, error) {
    mm := &MonitoringManager{
        config: config,
    }
    
    // 初始化 Prometheus 集成
    mm.prometheus = NewPrometheusIntegration(config.PrometheusURL)
    
    // 初始化 Grafana 集成
    mm.grafana = NewGrafanaIntegration(config.GrafanaURL)
    
    // 初始化指标收集器
    mm.metricsCollector = NewMetricsCollector()
    
    // 初始化日志指标关联器
    mm.correlator = NewLogMetricsCorrelator()
    
    // 初始化告警管理器
    mm.alertManager = NewAlertManager()
    
    // 初始化审计日志记录器
    mm.auditLogger = NewAuditLogger()
    
    // 注册自定义指标
    mm.registerCustomMetrics()
    
    return mm, nil
}

// 注册自定义指标
func (mm *MonitoringManager) registerCustomMetrics() {
    for _, metric := range mm.config.CustomMetrics {
        switch metric.Type {
        case "counter":
            mm.metricsCollector.RegisterCounter(metric.Name, metric.Description, metric.Labels)
        case "gauge":
            mm.metricsCollector.RegisterGauge(metric.Name, metric.Description, metric.Labels)
        case "histogram":
            mm.metricsCollector.RegisterHistogram(metric.Name, metric.Description, metric.Labels)
        case "summary":
            mm.metricsCollector.RegisterSummary(metric.Name, metric.Description, metric.Labels)
        }
    }
}

// 采集性能指标
func (mm *MonitoringManager) CollectMetrics(ctx context.Context) (*PerformanceMetrics, error) {
    metrics := &PerformanceMetrics{
        Timestamp: time.Now(),
        Custom:    make(map[string]float64),
    }
    
    // 采集系统指标
    metrics.CPU = mm.getCPUUsage()
    metrics.Memory = mm.getMemoryUsage()
    metrics.Disk = mm.getDiskUsage()
    metrics.Network = mm.getNetworkUsage()
    
    // 采集自定义指标
    for _, metric := range mm.config.CustomMetrics {
        if metric.Collector != nil {
            metrics.Custom[metric.Name] = metric.Collector()
        }
    }
    
    // 推送到 Prometheus
    if err := mm.prometheus.PushMetrics(ctx, metrics); err != nil {
        log.Errorf("推送指标失败: %v", err)
    }
    
    // 检查告警规则
    mm.checkAlertRules(ctx, metrics)
    
    return metrics, nil
}

// 关联日志和指标
func (mm *MonitoringManager) CorrelateLogsAndMetrics(ctx context.Context, timeRange TimeRange) (*CorrelationResult, error) {
    log.Infof("关联日志和指标: start=%s, end=%s", timeRange.Start, timeRange.End)
    
    // 1. 获取时间范围内的性能指标
    metrics, err := mm.prometheus.QueryRange(ctx, timeRange)
    if err != nil {
        return nil, fmt.Errorf("查询指标失败: %w", err)
    }
    
    // 2. 获取时间范围内的日志
    logs, err := mm.correlator.GetLogs(ctx, timeRange)
    if err != nil {
        return nil, fmt.Errorf("查询日志失败: %w", err)
    }
    
    // 3. 关联分析
    result := mm.correlator.Correlate(metrics, logs)
    
    return result, nil
}

// 检查告警规则
func (mm *MonitoringManager) checkAlertRules(ctx context.Context, metrics *PerformanceMetrics) {
    for _, rule := range mm.config.AlertRules {
        if !rule.Enabled {
            continue
        }
        
        // 获取指标值
        var value float64
        switch rule.Metric {
        case "cpu":
            value = metrics.CPU
        case "memory":
            value = metrics.Memory
        case "disk":
            value = metrics.Disk
        case "network":
            value = metrics.Network
        default:
            if v, exists := metrics.Custom[rule.Metric]; exists {
                value = v
            }
        }
        
        // 检查是否超过阈值
        if mm.checkThreshold(value, rule.Operator, rule.Threshold) {
            // 触发告警
            mm.triggerMetricAlert(ctx, rule, value, metrics.Timestamp)
        }
    }
}

// 检查阈值
func (mm *MonitoringManager) checkThreshold(value float64, operator string, threshold float64) bool {
    switch operator {
    case ">":
        return value > threshold
    case ">=":
        return value >= threshold
    case "<":
        return value < threshold
    case "<=":
        return value <= threshold
    case "==":
        return value == threshold
    case "!=":
        return value != threshold
    }
    return false
}

// 触发指标告警
func (mm *MonitoringManager) triggerMetricAlert(ctx context.Context, rule *AlertRule, value float64, timestamp time.Time) {
    log.Warnf("触发指标告警: rule=%s, value=%.2f, threshold=%.2f", rule.Name, value, rule.Threshold)
    
    // 关联相关日志
    timeRange := TimeRange{
        Start: timestamp.Add(-5 * time.Minute),
        End:   timestamp.Add(5 * time.Minute),
    }
    
    logs, err := mm.correlator.GetLogs(ctx, timeRange)
    if err != nil {
        log.Errorf("获取关联日志失败: %v", err)
    }
    
    // 构建告警
    alert := &Alert{
        Level:   rule.Severity,
        Title:   fmt.Sprintf("性能指标告警: %s", rule.Name),
        Message: fmt.Sprintf("指标 %s 当前值 %.2f %s 阈值 %.2f", 
            rule.Metric, value, rule.Operator, rule.Threshold),
        Fields: map[string]interface{}{
            "metric":    rule.Metric,
            "value":     value,
            "threshold": rule.Threshold,
            "operator":  rule.Operator,
            "logs_count": len(logs),
        },
        Timestamp: timestamp,
    }
    
    // 发送告警
    mm.alertManager.Send(ctx, alert)
}

// Prometheus 集成
type PrometheusIntegration struct {
    baseURL string
    client  *http.Client
}

// 推送指标到 Prometheus
func (pi *PrometheusIntegration) PushMetrics(ctx context.Context, metrics *PerformanceMetrics) error {
    // 使用 Pushgateway 推送指标
    url := fmt.Sprintf("%s/metrics/job/log-management", pi.baseURL)
    
    // 构建 Prometheus 格式的指标
    var buffer bytes.Buffer
    buffer.WriteString(fmt.Sprintf("# HELP system_cpu_usage CPU usage percentage\n"))
    buffer.WriteString(fmt.Sprintf("# TYPE system_cpu_usage gauge\n"))
    buffer.WriteString(fmt.Sprintf("system_cpu_usage %.2f %d\n", metrics.CPU, metrics.Timestamp.Unix()))
    
    buffer.WriteString(fmt.Sprintf("# HELP system_memory_usage Memory usage percentage\n"))
    buffer.WriteString(fmt.Sprintf("# TYPE system_memory_usage gauge\n"))
    buffer.WriteString(fmt.Sprintf("system_memory_usage %.2f %d\n", metrics.Memory, metrics.Timestamp.Unix()))
    
    buffer.WriteString(fmt.Sprintf("# HELP system_disk_usage Disk usage percentage\n"))
    buffer.WriteString(fmt.Sprintf("# TYPE system_disk_usage gauge\n"))
    buffer.WriteString(fmt.Sprintf("system_disk_usage %.2f %d\n", metrics.Disk, metrics.Timestamp.Unix()))
    
    buffer.WriteString(fmt.Sprintf("# HELP system_network_usage Network usage MB/s\n"))
    buffer.WriteString(fmt.Sprintf("# TYPE system_network_usage gauge\n"))
    buffer.WriteString(fmt.Sprintf("system_network_usage %.2f %d\n", metrics.Network, metrics.Timestamp.Unix()))
    
    // 自定义指标
    for name, value := range metrics.Custom {
        buffer.WriteString(fmt.Sprintf("# HELP %s Custom metric\n", name))
        buffer.WriteString(fmt.Sprintf("# TYPE %s gauge\n", name))
        buffer.WriteString(fmt.Sprintf("%s %.2f %d\n", name, value, metrics.Timestamp.Unix()))
    }
    
    req, err := http.NewRequestWithContext(ctx, "POST", url, &buffer)
    if err != nil {
        return err
    }
    
    req.Header.Set("Content-Type", "text/plain")
    
    resp, err := pi.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
        return fmt.Errorf("推送指标失败: status=%d", resp.StatusCode)
    }
    
    return nil
}

// 查询指标范围
func (pi *PrometheusIntegration) QueryRange(ctx context.Context, timeRange TimeRange) ([]PerformanceMetrics, error) {
    url := fmt.Sprintf("%s/api/v1/query_range", pi.baseURL)
    
    // 构建查询参数
    params := url.Values{}
    params.Set("query", "system_cpu_usage")
    params.Set("start", timeRange.Start.Format(time.RFC3339))
    params.Set("end", timeRange.End.Format(time.RFC3339))
    params.Set("step", "60s")
    
    req, err := http.NewRequestWithContext(ctx, "GET", url+"?"+params.Encode(), nil)
    if err != nil {
        return nil, err
    }
    
    resp, err := pi.client.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("查询指标失败: status=%d", resp.StatusCode)
    }
    
    var result struct {
        Data struct {
            Result []struct {
                Values [][]interface{} `json:"values"`
            } `json:"result"`
        } `json:"data"`
    }
    
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    // 解析结果
    var metrics []PerformanceMetrics
    for _, r := range result.Data.Result {
        for _, v := range r.Values {
            timestamp := time.Unix(int64(v[0].(float64)), 0)
            value, _ := strconv.ParseFloat(v[1].(string), 64)
            
            metrics = append(metrics, PerformanceMetrics{
                Timestamp: timestamp,
                CPU:       value,
            })
        }
    }
    
    return metrics, nil
}

// Grafana 集成
type GrafanaIntegration struct {
    baseURL string
    apiKey  string
    client  *http.Client
}

// 创建仪表盘
func (gi *GrafanaIntegration) CreateDashboard(ctx context.Context, dashboard *Dashboard) error {
    url := fmt.Sprintf("%s/api/dashboards/db", gi.baseURL)
    
    data, err := json.Marshal(dashboard)
    if err != nil {
        return err
    }
    
    req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    
    req.Header.Set("Authorization", "Bearer "+gi.apiKey)
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := gi.client.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("创建仪表盘失败: status=%d", resp.StatusCode)
    }
    
    return nil
}

// 日志指标关联器
type LogMetricsCorrelator struct {
    logStore    *LogStore
    metricStore *MetricStore
}

// 关联分析
func (lmc *LogMetricsCorrelator) Correlate(metrics []PerformanceMetrics, logs []LogEntry) *CorrelationResult {
    result := &CorrelationResult{
        Correlations: []Correlation{},
    }
    
    // 分析指标异常时间点
    anomalyPoints := lmc.detectAnomalies(metrics)
    
    // 关联异常时间点的日志
    for _, point := range anomalyPoints {
        // 获取异常时间点前后的日志
        relatedLogs := lmc.getLogsNearTime(logs, point.Timestamp, 5*time.Minute)
        
        if len(relatedLogs) > 0 {
            result.Correlations = append(result.Correlations, Correlation{
                Timestamp:   point.Timestamp,
                MetricValue: point.Value,
                MetricName:  point.MetricName,
                Logs:        relatedLogs,
                Confidence:  lmc.calculateConfidence(point, relatedLogs),
            })
        }
    }
    
    return result
}

// 检测异常点
func (lmc *LogMetricsCorrelator) detectAnomalies(metrics []PerformanceMetrics) []AnomalyPoint {
    var anomalies []AnomalyPoint
    
    // 简单的阈值检测
    for _, m := range metrics {
        if m.CPU > 80 {
            anomalies = append(anomalies, AnomalyPoint{
                Timestamp:  m.Timestamp,
                MetricName: "cpu",
                Value:      m.CPU,
            })
        }
        
        if m.Memory > 80 {
            anomalies = append(anomalies, AnomalyPoint{
                Timestamp:  m.Timestamp,
                MetricName: "memory",
                Value:      m.Memory,
            })
        }
    }
    
    return anomalies
}
```

**关键实现点**:

1. 支持 Prometheus 和 Grafana 集成，提供统一的监控仪表盘
2. 自动采集系统性能指标（CPU、内存、磁盘、网络）和自定义指标
3. 支持性能指标与日志的关联分析，自动检测异常时间点
4. 性能指标超过阈值时自动触发告警并关联相关日志
5. 提供预置的 Grafana 仪表盘模板，包含日志和性能指标
6. 支持自定义性能指标的采集和告警规则配置
7. 性能监控数据保留期 30 天，支持历史趋势分析

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| monitoring_enabled | bool | true | 是否启用性能监控集成 |
| prometheus_url | string | "" | Prometheus 服务地址 |
| grafana_url | string | "" | Grafana 服务地址 |
| scrape_interval | int | 60 | 指标采集间隔（秒） |
| retention_days | int | 30 | 数据保留天数 |
| custom_metrics | array | [] | 自定义指标配置 |
| alert_rules | array | [] | 告警规则配置 |
| correlation_enabled | bool | true | 是否启用日志指标关联 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次采集生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的采集间隔和告警规则
2. WHEN 自定义指标变更时，THE System SHALL 在下次采集时生效
3. THE System SHALL 支持通过 API 查询当前生效的性能监控配置
4. THE System SHALL 记录所有性能监控配置变更的审计日志
5. WHEN 告警阈值变更时，THE System SHALL 验证阈值的合理性（>= 0）

---



### API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-12-412 | 搜索日志 | API | POST | /api/v1/logs/search | logs.read | Body: query_request | {code:0,data:{items:[],total:0}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-12-413 | 批量写入日志 | API | POST | /api/v1/logs/ingest | logs.write | Body: {logs:[]} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-414 | 获取日志详情 | API | GET | /api/v1/logs/{id} | logs.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-12-415 | 删除日志 | API | DELETE | /api/v1/logs/{id} | logs.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-12-416 | 导出日志 | API | POST | /api/v1/logs/export | logs.read | Body: {query,format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回文件 |
| API-12-417 | 查询告警列表 | API | GET | /api/v1/alerts | alert.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-12-418 | 创建告警 | API | POST | /api/v1/alerts | alert.write | Body: alert_data | {code:0,data:{id:"alert-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-419 | 获取告警详情 | API | GET | /api/v1/alerts/{id} | alert.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-12-420 | 更新告警 | API | PUT | /api/v1/alerts/{id} | alert.write | Body: alert_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-12-421 | 删除告警 | API | DELETE | /api/v1/alerts/{id} | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-12-422 | 查询告警规则列表 | API | GET | /api/v1/alerts/rules | alert.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-12-423 | 创建告警规则 | API | POST | /api/v1/alerts/rules | alert.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-424 | 查询Webhook列表 | Webhook | GET | /api/v1/webhooks | webhook.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-12-425 | 创建Webhook | Webhook | POST | /api/v1/webhooks | webhook.write | Body: webhook_config | {code:0,data:{id:"wh-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-426 | 获取Webhook详情 | Webhook | GET | /api/v1/webhooks/{id} | webhook.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-12-427 | 更新Webhook | Webhook | PUT | /api/v1/webhooks/{id} | webhook.write | Body: webhook_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-12-428 | 删除Webhook | Webhook | DELETE | /api/v1/webhooks/{id} | webhook.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-12-429 | 测试Webhook | Webhook | POST | /api/v1/webhooks/{id}/test | webhook.write | 无 | {code:0,data:{success:true}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-12-430 | 获取API使用统计 | Stats | GET | /api/v1/stats/api | stats.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-12-431 | 获取日志统计 | Stats | GET | /api/v1/stats/logs | stats.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-12-432 | 获取告警统计 | Stats | GET | /api/v1/stats/alerts | stats.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-12-433 | 查询API配额 | RateLimit | GET | /api/v1/ratelimit/quota | ratelimit.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-12-434 | 更新API配额 | RateLimit | PUT | /api/v1/ratelimit/quota | ratelimit.admin | Body: quota_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | 仅管理员 |
| API-12-435 | 发送Slack消息 | Collaboration | POST | /api/v1/collaboration/slack | collaboration.write | Body: message_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-436 | 发送Teams消息 | Collaboration | POST | /api/v1/collaboration/teams | collaboration.write | Body: message_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-437 | 发送钉钉消息 | Collaboration | POST | /api/v1/collaboration/dingtalk | collaboration.write | Body: message_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-438 | 发送飞书消息 | Collaboration | POST | /api/v1/collaboration/feishu | collaboration.write | Body: message_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-439 | 查询构建列表 | CICD | GET | /api/v1/cicd/builds | cicd.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-12-440 | 获取构建详情 | CICD | GET | /api/v1/cicd/builds/{id} | cicd.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-12-441 | 获取构建日志 | CICD | GET | /api/v1/cicd/builds/{id}/logs | cicd.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-12-442 | 接收CI/CD Webhook | CICD | POST | /api/v1/cicd/webhook | 无 | Body: webhook_data | {code:0,message:"ok"} | 200/400/500 | v1 | 否 | 否 | - | 公开接口 |
| API-12-443 | 推送到PagerDuty | ExternalAlert | POST | /api/v1/external-alerts/pagerduty | alert.write | Body: alert_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-444 | 推送到OpsGenie | ExternalAlert | POST | /api/v1/external-alerts/opsgenie | alert.write | Body: alert_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-445 | 推送到Zabbix | ExternalAlert | POST | /api/v1/external-alerts/zabbix | alert.write | Body: alert_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-446 | 推送到ServiceNow | ExternalAlert | POST | /api/v1/external-alerts/servicenow | alert.write | Body: alert_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-447 | 同步告警状态 | ExternalAlert | POST | /api/v1/external-alerts/sync | alert.write | Body: {alert_id,status} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-12-448 | 查询性能指标 | Monitoring | GET | /api/v1/monitoring/metrics | monitoring.read | Query: metric_name, time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-12-449 | 推送性能指标 | Monitoring | POST | /api/v1/monitoring/metrics | monitoring.write | Body: metrics_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-12-450 | 关联日志和指标 | Monitoring | POST | /api/v1/monitoring/correlate | monitoring.write | Body: {log_id,metric_name} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-12-451 | 查询仪表盘列表 | Monitoring | GET | /api/v1/monitoring/dashboards | monitoring.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-12-452 | 创建仪表盘 | Monitoring | POST | /api/v1/monitoring/dashboards | monitoring.write | Body: dashboard_config | {code:0,data:{id:"dash-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |

---



