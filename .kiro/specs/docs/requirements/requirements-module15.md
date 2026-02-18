# 模块十五：企业级功能

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块十五：企业级功能 
> **需求编号**: 

---

**模块概述**: 

提供面向企业级应用的高级功能，包括多租户支持、跨云管理、容器化优化、IoT 设备管理和成本优化等能力，满足大型企业和 SaaS 服务商的复杂需求。

**模块技术栈**:
- 多租户隔离：Kubernetes Namespace + Network Policy
- 跨云管理：Terraform + Cloud Provider SDK
- 容器编排：Kubernetes 1.28+ + Helm 3.x
- IoT 协议：MQTT + CoAP + LwM2M
- 成本分析：FinOps 工具链 + Prometheus + Grafana

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                企业级功能模块整体架构                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            多租户管理层                                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 租户管理     │    │ 资源配额     │    │ 数据隔离     │                           │ │
│  │  │ (Tenant Mgr) │    │ (Quota Mgr)  │    │ (Isolation)  │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            跨云管理层                                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ AWS 适配器   │    │ Azure 适配器 │    │ GCP 适配器   │                           │ │
│  │  │ (CloudWatch) │    │ (Monitor)    │    │ (Logging)    │                           │ │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                           │ │
│  │         └──────────────────┬──────────────────┘                                      │ │
│  │                            ▼                                                          │ │
│  │                  ┌──────────────────┐                                                │ │
│  │                  │ 统一日志接口     │                                                │ │
│  │                  │ (Unified API)    │                                                │ │
│  │                  └──────────────────┘                                                │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            容器化支持层                                                │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        Kubernetes 集成                                       │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ Pod 日志采集 │  │ 服务发现     │  │ 标签路由     │                      │    │ │
│  │  │  │ (DaemonSet)  │  │ (K8s API)    │  │ (Labels)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  │                                                                              │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ Service Mesh │  │ Helm Chart   │  │ Operator     │                      │    │ │
│  │  │  │ (Istio)      │  │ (部署)       │  │ (自动化)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            IoT 设备管理层                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        设备管理                                              │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ 设备发现     │  │ 设备注册     │  │ 设备监控     │                      │    │ │
│  │  │  │ (mDNS/SSDP)  │  │ (Auto Config)│  │ (Health)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │ │
│  │                                                                                       │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        边缘节点                                              │    │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                      │    │ │
│  │  │  │ 本地预处理   │  │ 数据压缩     │  │ 离线缓存     │                      │    │ │
│  │  │  │ (Filter)     │  │ (LZ4)        │  │ (SQLite)     │                      │    │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘                      │    │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘    │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            成本管理层                                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 成本采集     │    │ 成本分析     │    │ 成本优化     │                           │ │
│  │  │ (Metrics)    │───▶│ (Analytics)  │───▶│ (Advisor)    │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  │                                                                                       │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 成本分摊     │    │ 预算管理     │    │ 成本告警     │                           │ │
│  │  │ (Allocation) │    │ (Budget)     │    │ (Alert)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **多租户管理层**: 提供租户隔离、资源配额、数据隔离等多租户核心能力
2. **跨云管理层**: 统一管理多个云平台的日志数据，提供统一的 API 接口
3. **容器化支持层**: 深度集成 Kubernetes，支持 Pod 日志采集、Service Mesh、Helm 部署
4. **IoT 设备管理层**: 支持 IoT 设备的自动发现、注册、监控和边缘计算
5. **成本管理层**: 提供成本采集、分析、优化、分摊和预算管理能力

**数据流向**:

```
多云数据源 → 跨云适配器 → 统一日志接口 → 租户隔离 → 存储/分析
     ↓                                              ↓
IoT 设备 → 边缘节点 → 数据压缩 → 中央服务器 → 成本统计
```

**需求列表**:
- 需求 15-51：多租户支持 [Phase 3]
- 需求 15-52：跨云与混合云支持 [Phase 3]
- 需求 15-53：微服务与容器化优化 [Phase 2]
- 需求 15-54：IoT 与边缘设备管理 [Phase 3]
- 需求 15-55：成本管理与优化 [Phase 3]

---


#### 需求 15-51：多租户支持 [Phase 3]

**用户故事**: 

作为 SaaS 服务提供商，我希望系统支持多租户架构，以便为不同客户提供隔离的日志管理服务。

**验收标准**:

1. THE System SHALL 支持多租户架构，每个租户的数据完全隔离（数据库、索引、缓存）
2. THE System SHALL 支持为每个租户配置独立的存储配额（最小 10GB，最大 100TB）和资源限制（CPU、内存、网络带宽）
3. THE Dashboard SHALL 支持租户级别的自定义配置，包括品牌定制（Logo、颜色主题）和功能开关（启用/禁用特定功能）
4. THE System SHALL 支持租户级别的计费和用量统计，按存储量、日志条数、API 调用次数计费
5. WHEN 租户资源使用超过配额 90% 时，THE System SHALL 发送告警通知
6. WHEN 租户资源使用达到配额 100% 时，THE System SHALL 自动限流，拒绝新的日志写入请求
7. THE System SHALL 支持租户数据的独立备份和恢复，不影响其他租户
8. THE System SHALL 支持租户间的网络隔离，使用 Kubernetes Network Policy 实现
9. THE Dashboard SHALL 提供租户管理界面，支持创建、编辑、删除、暂停租户
10. THE System SHALL 记录所有租户操作的审计日志，包括配置变更、资源使用、数据访问

**实现方向**:

**实现方式**:

```go
// 租户管理器
type TenantManager struct {
	db          *sql.DB
	cache       *redis.Client
	quotaEngine *QuotaEngine
	config      atomic.Value
}

// 租户定义
type Tenant struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Status      TenantStatus           `json:"status"` // active, suspended, deleted
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
	
	// 资源配额
	Quota       TenantQuota            `json:"quota"`
	
	// 自定义配置
	Branding    TenantBranding         `json:"branding"`
	Features    map[string]bool        `json:"features"`
	
	// 隔离配置
	Namespace   string                 `json:"namespace"`   // Kubernetes namespace
	DatabaseID  string                 `json:"database_id"` // 独立数据库实例
	IndexPrefix string                 `json:"index_prefix"` // ES 索引前缀
}

// 租户配额
type TenantQuota struct {
	// 存储配额
	StorageQuotaGB      int64   `json:"storage_quota_gb"`
	StorageUsedGB       float64 `json:"storage_used_gb"`
	
	// 日志条数配额
	LogCountQuota       int64   `json:"log_count_quota"`
	LogCountUsed        int64   `json:"log_count_used"`
	
	// API 调用配额
	APICallQuota        int64   `json:"api_call_quota"`
	APICallUsed         int64   `json:"api_call_used"`
	
	// 资源限制
	CPULimit            string  `json:"cpu_limit"`      // "2000m"
	MemoryLimit         string  `json:"memory_limit"`   // "4Gi"
	BandwidthLimitMbps  int     `json:"bandwidth_limit_mbps"`
}

// 租户品牌定制
type TenantBranding struct {
	LogoURL      string            `json:"logo_url"`
	PrimaryColor string            `json:"primary_color"`
	Theme        string            `json:"theme"` // light, dark
	CustomCSS    string            `json:"custom_css"`
	CustomDomain string            `json:"custom_domain"`
}

// 创建租户
func (tm *TenantManager) CreateTenant(ctx context.Context, req *CreateTenantRequest) (*Tenant, error) {
	// 1. 生成租户 ID
	tenantID := generateTenantID()
	
	// 2. 创建 Kubernetes Namespace
	namespace := fmt.Sprintf("tenant-%s", tenantID)
	if err := tm.createK8sNamespace(ctx, namespace); err != nil {
		return nil, fmt.Errorf("创建 namespace 失败: %w", err)
	}
	
	// 3. 创建独立数据库实例（或 Schema）
	databaseID, err := tm.createTenantDatabase(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("创建数据库失败: %w", err)
	}
	
	// 4. 创建 Elasticsearch 索引模板
	indexPrefix := fmt.Sprintf("tenant-%s-logs", tenantID)
	if err := tm.createESIndexTemplate(ctx, indexPrefix); err != nil {
		return nil, fmt.Errorf("创建索引模板失败: %w", err)
	}
	
	// 5. 配置网络隔离策略
	if err := tm.applyNetworkPolicy(ctx, namespace); err != nil {
		return nil, fmt.Errorf("配置网络策略失败: %w", err)
	}
	
	// 6. 创建租户记录
	tenant := &Tenant{
		ID:          tenantID,
		Name:        req.Name,
		Status:      TenantStatusActive,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Quota:       req.Quota,
		Branding:    req.Branding,
		Features:    req.Features,
		Namespace:   namespace,
		DatabaseID:  databaseID,
		IndexPrefix: indexPrefix,
	}
	
	if err := tm.saveTenant(ctx, tenant); err != nil {
		return nil, fmt.Errorf("保存租户失败: %w", err)
	}
	
	// 7. 初始化配额监控
	tm.quotaEngine.StartMonitoring(tenantID)
	
	log.Info("租户创建成功", "tenant_id", tenantID, "name", req.Name)
	return tenant, nil
}

// 检查配额
func (tm *TenantManager) CheckQuota(ctx context.Context, tenantID string, resourceType string, amount int64) error {
	tenant, err := tm.GetTenant(ctx, tenantID)
	if err != nil {
		return err
	}
	
	// 检查租户状态
	if tenant.Status != TenantStatusActive {
		return fmt.Errorf("租户已暂停或删除")
	}
	
	// 检查配额
	switch resourceType {
	case "storage":
		if tenant.Quota.StorageUsedGB+float64(amount)/1024/1024/1024 > float64(tenant.Quota.StorageQuotaGB) {
			return fmt.Errorf("存储配额已满")
		}
	case "log_count":
		if tenant.Quota.LogCountUsed+amount > tenant.Quota.LogCountQuota {
			return fmt.Errorf("日志条数配额已满")
		}
	case "api_call":
		if tenant.Quota.APICallUsed+amount > tenant.Quota.APICallQuota {
			return fmt.Errorf("API 调用配额已满")
		}
	}
	
	return nil
}

// 更新配额使用量
func (tm *TenantManager) UpdateQuotaUsage(ctx context.Context, tenantID string, resourceType string, amount int64) error {
	// 使用 Redis 原子操作更新配额
	key := fmt.Sprintf("tenant:%s:quota:%s", tenantID, resourceType)
	newUsage, err := tm.cache.IncrBy(ctx, key, amount).Result()
	if err != nil {
		return err
	}
	
	// 检查是否超过阈值
	tenant, _ := tm.GetTenant(ctx, tenantID)
	if tenant != nil {
		var quota int64
		var usagePercent float64
		
		switch resourceType {
		case "storage":
			quota = tenant.Quota.StorageQuotaGB * 1024 * 1024 * 1024
			usagePercent = float64(newUsage) / float64(quota) * 100
		case "log_count":
			quota = tenant.Quota.LogCountQuota
			usagePercent = float64(newUsage) / float64(quota) * 100
		case "api_call":
			quota = tenant.Quota.APICallQuota
			usagePercent = float64(newUsage) / float64(quota) * 100
		}
		
		// 90% 告警
		if usagePercent >= 90 && usagePercent < 100 {
			tm.sendQuotaAlert(tenantID, resourceType, usagePercent)
		}
		
		// 100% 限流
		if usagePercent >= 100 {
			tm.enableRateLimit(tenantID, resourceType)
		}
	}
	
	return nil
}

// 创建 Kubernetes Namespace
func (tm *TenantManager) createK8sNamespace(ctx context.Context, namespace string) error {
	ns := &corev1.Namespace{
		ObjectMeta: metav1.ObjectMeta{
			Name: namespace,
			Labels: map[string]string{
				"tenant": "true",
				"managed-by": "log-management-system",
			},
		},
	}
	
	_, err := tm.k8sClient.CoreV1().Namespaces().Create(ctx, ns, metav1.CreateOptions{})
	return err
}

// 应用网络隔离策略
func (tm *TenantManager) applyNetworkPolicy(ctx context.Context, namespace string) error {
	policy := &networkingv1.NetworkPolicy{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "tenant-isolation",
			Namespace: namespace,
		},
		Spec: networkingv1.NetworkPolicySpec{
			// 默认拒绝所有入站流量
			PodSelector: metav1.LabelSelector{},
			PolicyTypes: []networkingv1.PolicyType{
				networkingv1.PolicyTypeIngress,
				networkingv1.PolicyTypeEgress,
			},
			Ingress: []networkingv1.NetworkPolicyIngressRule{
				{
					// 只允许来自同一 namespace 的流量
					From: []networkingv1.NetworkPolicyPeer{
						{
							PodSelector: &metav1.LabelSelector{},
						},
					},
				},
			},
			Egress: []networkingv1.NetworkPolicyEgressRule{
				{
					// 允许访问 DNS
					Ports: []networkingv1.NetworkPolicyPort{
						{
							Protocol: &[]corev1.Protocol{corev1.ProtocolUDP}[0],
							Port:     &intstr.IntOrString{IntVal: 53},
						},
					},
				},
				{
					// 允许访问共享服务（Kafka、ES 等）
					To: []networkingv1.NetworkPolicyPeer{
						{
							NamespaceSelector: &metav1.LabelSelector{
								MatchLabels: map[string]string{
									"name": "shared-services",
								},
							},
						},
					},
				},
			},
		},
	}
	
	_, err := tm.k8sClient.NetworkingV1().NetworkPolicies(namespace).Create(ctx, policy, metav1.CreateOptions{})
	return err
}

// 租户数据隔离中间件
func TenantIsolationMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 从 JWT 或 Header 中提取租户 ID
		tenantID := extractTenantID(c)
		if tenantID == "" {
			c.JSON(401, gin.H{"error": "缺少租户标识"})
			c.Abort()
			return
		}
		
		// 验证租户状态
		tenant, err := tenantManager.GetTenant(c.Request.Context(), tenantID)
		if err != nil {
			c.JSON(404, gin.H{"error": "租户不存在"})
			c.Abort()
			return
		}
		
		if tenant.Status != TenantStatusActive {
			c.JSON(403, gin.H{"error": "租户已暂停"})
			c.Abort()
			return
		}
		
		// 将租户信息注入上下文
		c.Set("tenant_id", tenantID)
		c.Set("tenant", tenant)
		
		c.Next()
	}
}
```

**关键实现点**:

1. 使用 Kubernetes Namespace 实现租户物理隔离，每个租户独立的命名空间
2. 使用 Network Policy 实现租户间网络隔离，防止跨租户访问
3. 为每个租户创建独立的数据库实例或 Schema，确保数据完全隔离
4. 使用 Elasticsearch 索引前缀区分租户数据，支持独立的索引生命周期管理
5. 实现配额监控和限流机制，使用 Redis 原子操作保证并发安全
6. 支持租户级别的品牌定制，包括 Logo、颜色主题、自定义域名
7. 记录所有租户操作的审计日志，满足合规要求

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| multi_tenant_enabled | bool | true | 是否启用多租户功能 |
| default_storage_quota_gb | int | 100 | 默认存储配额（GB） |
| default_log_count_quota | int | 10000000 | 默认日志条数配额 |
| default_api_call_quota | int | 1000000 | 默认 API 调用配额 |
| quota_alert_threshold | float | 90.0 | 配额告警阈值（%） |
| quota_limit_threshold | float | 100.0 | 配额限流阈值（%） |
| enable_network_isolation | bool | true | 是否启用网络隔离 |
| enable_custom_branding | bool | true | 是否启用品牌定制 |
| tenant_idle_timeout_days | int | 90 | 租户闲置超时天数 |
| max_tenants_per_cluster | int | 1000 | 每个集群最大租户数 |

**热更新机制**:

- 更新方式: PostgreSQL 配置表 + Redis 发布订阅
- 生效时间: 配置变更后 3 秒内生效（对新请求生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内应用新的租户配置
2. WHEN 配额阈值变更时，THE System SHALL 重新评估所有租户的配额状态
3. THE System SHALL 支持通过 API 查询当前生效的租户配置
4. THE System SHALL 记录所有租户配置变更的审计日志
5. WHEN 多租户功能禁用时，THE System SHALL 切换到单租户模式，所有数据归属默认租户
6. WHEN 网络隔离配置变更时，THE System SHALL 自动更新 Kubernetes Network Policy

---



#### 需求 15-52：跨云与混合云支持 [Phase 3]

**用户故事**: 

作为云架构师，我希望系统能够支持跨云和混合云环境，以便统一管理分布在不同云平台的日志数据。

**验收标准**:

1. THE Log_Collector SHALL 支持同时从 AWS、Azure、Google Cloud、阿里云等多个云平台采集日志
2. THE System SHALL 支持跨云的日志数据同步和复制，数据同步延迟不超过 5 秒
3. THE Dashboard SHALL 提供统一的跨云日志视图，支持按云平台筛选和对比分析
4. THE System SHALL 支持混合云环境，同时管理公有云和私有云的日志数据
5. THE System SHALL 支持云平台原生日志服务的集成（AWS CloudWatch、Azure Monitor、GCP Cloud Logging、阿里云 SLS）
6. THE Log_Storage SHALL 支持跨云的数据备份和灾难恢复，RTO ≤ 15 分钟，RPO ≤ 5 分钟
7. THE System SHALL 支持跨云的成本对比分析，展示不同云平台的日志存储和传输成本
8. THE System SHALL 支持云平台间的自动故障转移，当主云平台不可用时自动切换到备用云平台
9. THE Dashboard SHALL 提供云平台拓扑视图，展示跨云架构和数据流向
10. THE System SHALL 支持跨云的统一认证和授权，使用联邦身份管理（SAML/OIDC）

**实现方向**:

**实现方式**:

```go
// 跨云管理器
type MultiCloudManager struct {
	providers map[string]CloudProvider // 云平台适配器
	router    *CloudRouter             // 云路由器
	sync      *CloudSyncEngine         // 跨云同步引擎
	config    atomic.Value             // 配置
}

// 云平台接口
type CloudProvider interface {
	// 基础信息
	Name() string
	Region() string
	
	// 日志采集
	CollectLogs(ctx context.Context, query *LogQuery) ([]*LogEntry, error)
	StreamLogs(ctx context.Context, query *LogQuery) (<-chan *LogEntry, error)
	
	// 日志写入
	WriteLogs(ctx context.Context, logs []*LogEntry) error
	
	// 资源管理
	ListResources(ctx context.Context) ([]*CloudResource, error)
	GetMetrics(ctx context.Context, resource string) (*CloudMetrics, error)
	
	// 成本信息
	GetCostInfo(ctx context.Context, timeRange TimeRange) (*CostInfo, error)
}

// AWS CloudWatch 适配器
type AWSCloudWatchProvider struct {
	client    *cloudwatchlogs.Client
	region    string
	accountID string
}

func (p *AWSCloudWatchProvider) CollectLogs(ctx context.Context, query *LogQuery) ([]*LogEntry, error) {
	// 构造 CloudWatch Logs Insights 查询
	input := &cloudwatchlogs.StartQueryInput{
		LogGroupName: aws.String(query.LogGroup),
		StartTime:    aws.Int64(query.StartTime.Unix()),
		EndTime:      aws.Int64(query.EndTime.Unix()),
		QueryString:  aws.String(query.QueryString),
	}
	
	// 启动查询
	result, err := p.client.StartQuery(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("启动查询失败: %w", err)
	}
	
	// 等待查询完成
	queryID := result.QueryId
	for {
		status, err := p.client.GetQueryResults(ctx, &cloudwatchlogs.GetQueryResultsInput{
			QueryId: queryID,
		})
		if err != nil {
			return nil, err
		}
		
		if status.Status == types.QueryStatusComplete {
			// 转换结果为统一格式
			return p.convertResults(status.Results), nil
		}
		
		if status.Status == types.QueryStatusFailed {
			return nil, fmt.Errorf("查询失败")
		}
		
		time.Sleep(1 * time.Second)
	}
}

func (p *AWSCloudWatchProvider) StreamLogs(ctx context.Context, query *LogQuery) (<-chan *LogEntry, error) {
	logChan := make(chan *LogEntry, 1000)
	
	go func() {
		defer close(logChan)
		
		// 使用 FilterLogEvents API 实现流式读取
		input := &cloudwatchlogs.FilterLogEventsInput{
			LogGroupName: aws.String(query.LogGroup),
			StartTime:    aws.Int64(query.StartTime.UnixMilli()),
			EndTime:      aws.Int64(query.EndTime.UnixMilli()),
		}
		
		paginator := cloudwatchlogs.NewFilterLogEventsPaginator(p.client, input)
		for paginator.HasMorePages() {
			page, err := paginator.NextPage(ctx)
			if err != nil {
				log.Error("读取日志失败", "error", err)
				return
			}
			
			for _, event := range page.Events {
				entry := p.convertEvent(event)
				select {
				case logChan <- entry:
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	
	return logChan, nil
}

// Azure Monitor 适配器
type AzureMonitorProvider struct {
	client       *azquery.LogsClient
	workspaceID  string
	subscription string
}

func (p *AzureMonitorProvider) CollectLogs(ctx context.Context, query *LogQuery) ([]*LogEntry, error) {
	// 构造 KQL 查询
	kqlQuery := p.buildKQLQuery(query)
	
	// 执行查询
	result, err := p.client.QueryWorkspace(ctx, p.workspaceID, azquery.Body{
		Query:    &kqlQuery,
		Timespan: &azquery.TimeInterval{
			Start: query.StartTime,
			End:   query.EndTime,
		},
	}, nil)
	
	if err != nil {
		return nil, fmt.Errorf("查询失败: %w", err)
	}
	
	// 转换结果
	return p.convertResults(result.Tables), nil
}

// GCP Cloud Logging 适配器
type GCPCloudLoggingProvider struct {
	client    *logging.Client
	projectID string
}

func (p *GCPCloudLoggingProvider) CollectLogs(ctx context.Context, query *LogQuery) ([]*LogEntry, error) {
	// 构造过滤器
	filter := p.buildFilter(query)
	
	// 创建迭代器
	iter := p.client.Entries(ctx,
		logging.Filter(filter),
		logging.OrderBy("timestamp desc"),
	)
	
	var entries []*LogEntry
	for {
		entry, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, err
		}
		
		entries = append(entries, p.convertEntry(entry))
	}
	
	return entries, nil
}

// 跨云同步引擎
type CloudSyncEngine struct {
	sources      []CloudProvider
	destinations []CloudProvider
	syncRules    []*SyncRule
	metrics      *SyncMetrics
}

// 同步规则
type SyncRule struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Enabled     bool                `json:"enabled"`
	Source      CloudProviderConfig `json:"source"`
	Destination CloudProviderConfig `json:"destination"`
	Filter      string              `json:"filter"`      // 日志过滤条件
	Transform   string              `json:"transform"`   // 数据转换规则
	Schedule    string              `json:"schedule"`    // 同步调度（cron 表达式）
	SyncMode    string              `json:"sync_mode"`   // realtime, batch
}

// 启动实时同步
func (e *CloudSyncEngine) StartRealtimeSync(ctx context.Context, rule *SyncRule) error {
	source := e.getProvider(rule.Source)
	destination := e.getProvider(rule.Destination)
	
	// 创建日志流
	logStream, err := source.StreamLogs(ctx, &LogQuery{
		Filter:    rule.Filter,
		StartTime: time.Now(),
	})
	if err != nil {
		return err
	}
	
	// 启动同步协程
	go func() {
		batch := make([]*LogEntry, 0, 1000)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		
		for {
			select {
			case entry, ok := <-logStream:
				if !ok {
					// 流关闭，刷新剩余数据
					if len(batch) > 0 {
						e.syncBatch(ctx, destination, batch)
					}
					return
				}
				
				// 应用转换规则
				if rule.Transform != "" {
					entry = e.applyTransform(entry, rule.Transform)
				}
				
				batch = append(batch, entry)
				
				// 批量写入
				if len(batch) >= 1000 {
					if err := e.syncBatch(ctx, destination, batch); err != nil {
						log.Error("同步失败", "error", err)
						e.metrics.RecordError(rule.ID)
					} else {
						e.metrics.RecordSuccess(rule.ID, len(batch))
					}
					batch = batch[:0]
				}
				
			case <-ticker.C:
				// 定时刷新
				if len(batch) > 0 {
					if err := e.syncBatch(ctx, destination, batch); err != nil {
						log.Error("同步失败", "error", err)
					}
					batch = batch[:0]
				}
				
			case <-ctx.Done():
				return
			}
		}
	}()
	
	return nil
}

// 同步批次
func (e *CloudSyncEngine) syncBatch(ctx context.Context, destination CloudProvider, logs []*LogEntry) error {
	// 重试逻辑
	maxRetries := 3
	for i := 0; i < maxRetries; i++ {
		err := destination.WriteLogs(ctx, logs)
		if err == nil {
			return nil
		}
		
		log.Warn("同步失败，重试", "attempt", i+1, "error", err)
		time.Sleep(time.Duration(i+1) * time.Second)
	}
	
	return fmt.Errorf("同步失败，已重试 %d 次", maxRetries)
}

// 云路由器（智能路由）
type CloudRouter struct {
	providers map[string]CloudProvider
	rules     []*RoutingRule
	health    *HealthChecker
}

// 路由规则
type RoutingRule struct {
	Priority    int      `json:"priority"`
	Condition   string   `json:"condition"`   // 路由条件
	Primary     string   `json:"primary"`     // 主云平台
	Fallback    []string `json:"fallback"`    // 备用云平台
	LoadBalance string   `json:"load_balance"` // round_robin, least_latency, cost_optimized
}

// 智能路由
func (r *CloudRouter) Route(ctx context.Context, operation string, data interface{}) (CloudProvider, error) {
	// 1. 评估路由规则
	for _, rule := range r.rules {
		if r.evaluateCondition(rule.Condition, operation, data) {
			// 2. 检查主云平台健康状态
			primary := r.providers[rule.Primary]
			if r.health.IsHealthy(rule.Primary) {
				return primary, nil
			}
			
			// 3. 故障转移到备用云平台
			for _, fallback := range rule.Fallback {
				if r.health.IsHealthy(fallback) {
					log.Warn("主云平台不可用，切换到备用", 
						"primary", rule.Primary, 
						"fallback", fallback)
					return r.providers[fallback], nil
				}
			}
			
			return nil, fmt.Errorf("所有云平台不可用")
		}
	}
	
	// 4. 默认负载均衡
	return r.selectByLoadBalance(ctx)
}

// 健康检查器
type HealthChecker struct {
	providers map[string]CloudProvider
	status    map[string]*HealthStatus
	mu        sync.RWMutex
}

type HealthStatus struct {
	Healthy      bool      `json:"healthy"`
	LastCheck    time.Time `json:"last_check"`
	Latency      int64     `json:"latency_ms"`
	ErrorRate    float64   `json:"error_rate"`
	Availability float64   `json:"availability"`
}

// 启动健康检查
func (h *HealthChecker) Start(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			for name, provider := range h.providers {
				go h.checkHealth(ctx, name, provider)
			}
		case <-ctx.Done():
			return
		}
	}
}

func (h *HealthChecker) checkHealth(ctx context.Context, name string, provider CloudProvider) {
	start := time.Now()
	
	// 执行健康检查（简单的资源列表查询）
	_, err := provider.ListResources(ctx)
	
	latency := time.Since(start).Milliseconds()
	
	h.mu.Lock()
	defer h.mu.Unlock()
	
	status := h.status[name]
	if status == nil {
		status = &HealthStatus{}
		h.status[name] = status
	}
	
	status.LastCheck = time.Now()
	status.Latency = latency
	status.Healthy = (err == nil && latency < 5000) // 5秒超时
	
	// 更新可用性（滑动窗口）
	if status.Healthy {
		status.Availability = status.Availability*0.9 + 0.1
	} else {
		status.Availability = status.Availability * 0.9
	}
}

// 跨云成本分析
type MultiCloudCostAnalyzer struct {
	providers map[string]CloudProvider
	cache     *redis.Client
}

func (a *MultiCloudCostAnalyzer) CompareCosts(ctx context.Context, timeRange TimeRange) (*CostComparison, error) {
	var wg sync.WaitGroup
	results := make(map[string]*CostInfo)
	mu := sync.Mutex{}
	
	for name, provider := range a.providers {
		wg.Add(1)
		go func(n string, p CloudProvider) {
			defer wg.Done()
			
			cost, err := p.GetCostInfo(ctx, timeRange)
			if err != nil {
				log.Error("获取成本信息失败", "provider", n, "error", err)
				return
			}
			
			mu.Lock()
			results[n] = cost
			mu.Unlock()
		}(name, provider)
	}
	
	wg.Wait()
	
	// 计算对比结果
	comparison := &CostComparison{
		TimeRange: timeRange,
		Providers: results,
		Summary:   a.calculateSummary(results),
	}
	
	return comparison, nil
}
```

**关键实现点**:

1. 实现统一的云平台接口，支持 AWS、Azure、GCP、阿里云等主流云平台
2. 为每个云平台实现专用适配器，封装原生 API 调用
3. 实现跨云同步引擎，支持实时同步和批量同步两种模式
4. 使用智能路由器实现云平台间的自动故障转移和负载均衡
5. 实现健康检查机制，定期检测云平台可用性和延迟
6. 支持跨云成本对比分析，帮助用户优化云资源使用
7. 使用联邦身份管理实现跨云统一认证和授权

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| multi_cloud_enabled | bool | true | 是否启用跨云功能 |
| enabled_providers | array | ["aws","azure","gcp"] | 启用的云平台列表 |
| sync_mode | string | "realtime" | 同步模式（realtime/batch） |
| sync_batch_size | int | 1000 | 批量同步大小 |
| sync_interval_seconds | int | 5 | 同步间隔（秒） |
| health_check_interval_seconds | int | 30 | 健康检查间隔（秒） |
| health_check_timeout_ms | int | 5000 | 健康检查超时（毫秒） |
| auto_failover_enabled | bool | true | 是否启用自动故障转移 |
| failover_threshold | float | 0.8 | 故障转移阈值（可用性） |
| load_balance_strategy | string | "least_latency" | 负载均衡策略 |
| cost_analysis_enabled | bool | true | 是否启用成本分析 |
| max_sync_retries | int | 3 | 最大同步重试次数 |

**热更新机制**:

- 更新方式: PostgreSQL 配置表 + Redis 发布订阅
- 生效时间: 配置变更后 5 秒内生效（对新同步任务生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 5 秒内应用新的跨云配置
2. WHEN 云平台列表变更时，THE System SHALL 自动初始化或停止相应的云平台适配器
3. THE System SHALL 支持通过 API 查询当前生效的跨云配置和各云平台状态
4. THE System SHALL 记录所有跨云配置变更的审计日志
5. WHEN 同步模式变更时，THE System SHALL 平滑切换，不丢失数据
6. WHEN 自动故障转移禁用时，THE System SHALL 停止健康检查和自动切换，但保持手动切换能力

---



#### 需求 15-53：微服务与容器化优化 [Phase 2]

**用户故事**: 

作为 DevOps 工程师，我希望系统针对微服务和容器化环境进行优化，以便更好地支持云原生架构。

**验收标准**:

1. THE Log_Collector SHALL 支持 Kubernetes 原生日志采集，自动发现和采集 Pod 日志，无需手动配置
2. THE Log_Collector SHALL 支持 Docker 容器日志的自动采集，并自动关联容器标签（镜像、版本、环境）
3. THE System SHALL 支持基于 Kubernetes 标签（labels）和注解（annotations）的日志过滤和路由
4. THE System SHALL 支持 Service Mesh（Istio、Linkerd）的日志采集和分析，包括 Envoy 访问日志和追踪数据
5. THE Log_Analyzer SHALL 支持容器生命周期事件的关联分析，关联 Pod 创建、重启、终止事件与日志
6. THE System SHALL 支持 Helm Chart 部署，提供一键安装和配置能力
7. THE Log_Collector SHALL 以 DaemonSet 方式部署，确保每个节点都有日志采集代理
8. THE System SHALL 支持 Kubernetes CRD（Custom Resource Definition），允许通过 K8s 资源定义日志采集规则
9. THE Dashboard SHALL 提供 Kubernetes 集群视图，展示 Namespace、Pod、Service 的日志分布
10. THE System SHALL 支持容器日志的多行合并，正确处理堆栈跟踪和多行日志

**实现方向**:

**实现方式**:

```go
// Kubernetes 日志采集器
type KubernetesCollector struct {
	clientset    *kubernetes.Clientset
	dynamicClient dynamic.Interface
	informers    map[string]cache.SharedIndexInformer
	config       atomic.Value
}

// 启动 Kubernetes 日志采集
func (k *KubernetesCollector) Start(ctx context.Context) error {
	// 1. 创建 Pod Informer，监听 Pod 变化
	podInformer := k.createPodInformer()
	
	// 2. 注册事件处理器
	podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			pod := obj.(*corev1.Pod)
			k.onPodAdded(ctx, pod)
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			pod := newObj.(*corev1.Pod)
			k.onPodUpdated(ctx, pod)
		},
		DeleteFunc: func(obj interface{}) {
			pod := obj.(*corev1.Pod)
			k.onPodDeleted(ctx, pod)
		},
	})
	
	// 3. 启动 Informer
	go podInformer.Run(ctx.Done())
	
	// 4. 等待缓存同步
	if !cache.WaitForCacheSync(ctx.Done(), podInformer.HasSynced) {
		return fmt.Errorf("等待缓存同步失败")
	}
	
	log.Info("Kubernetes 日志采集器启动成功")
	return nil
}

// Pod 添加事件处理
func (k *KubernetesCollector) onPodAdded(ctx context.Context, pod *corev1.Pod) {
	// 检查是否需要采集此 Pod 的日志
	if !k.shouldCollect(pod) {
		return
	}
	
	log.Info("发现新 Pod", 
		"namespace", pod.Namespace, 
		"name", pod.Name,
		"labels", pod.Labels)
	
	// 为每个容器创建日志采集任务
	for _, container := range pod.Spec.Containers {
		go k.collectContainerLogs(ctx, pod, container.Name)
	}
}

// 判断是否需要采集 Pod 日志
func (k *KubernetesCollector) shouldCollect(pod *corev1.Pod) bool {
	config := k.config.Load().(*K8sCollectorConfig)
	
	// 1. 检查 Namespace 过滤
	if len(config.IncludeNamespaces) > 0 {
		if !contains(config.IncludeNamespaces, pod.Namespace) {
			return false
		}
	}
	
	if len(config.ExcludeNamespaces) > 0 {
		if contains(config.ExcludeNamespaces, pod.Namespace) {
			return false
		}
	}
	
	// 2. 检查标签选择器
	if config.LabelSelector != "" {
		selector, err := labels.Parse(config.LabelSelector)
		if err != nil {
			log.Error("解析标签选择器失败", "error", err)
			return false
		}
		
		if !selector.Matches(labels.Set(pod.Labels)) {
			return false
		}
	}
	
	// 3. 检查注解
	if annotationValue, ok := pod.Annotations["log-management.io/collect"]; ok {
		return annotationValue == "true"
	}
	
	// 默认采集
	return true
}

// 采集容器日志
func (k *KubernetesCollector) collectContainerLogs(ctx context.Context, pod *corev1.Pod, containerName string) {
	// 构造日志流请求
	req := k.clientset.CoreV1().Pods(pod.Namespace).GetLogs(pod.Name, &corev1.PodLogOptions{
		Container:  containerName,
		Follow:     true,
		Timestamps: true,
		TailLines:  ptr.Int64(100), // 初始读取最后 100 行
	})
	
	// 打开日志流
	stream, err := req.Stream(ctx)
	if err != nil {
		log.Error("打开日志流失败", 
			"pod", pod.Name, 
			"container", containerName, 
			"error", err)
		return
	}
	defer stream.Close()
	
	// 读取日志
	scanner := bufio.NewScanner(stream)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024) // 1MB 缓冲区
	
	multilineBuffer := &MultilineBuffer{
		Pattern: k.getMultilinePattern(pod, containerName),
	}
	
	for scanner.Scan() {
		line := scanner.Text()
		
		// 解析时间戳
		timestamp, message := k.parseLogLine(line)
		
		// 多行合并
		if multilineBuffer.ShouldMerge(message) {
			multilineBuffer.Append(message)
			continue
		}
		
		// 发送之前的多行日志
		if multilineBuffer.HasContent() {
			k.sendLog(ctx, pod, containerName, timestamp, multilineBuffer.Flush())
		}
		
		// 发送当前日志
		k.sendLog(ctx, pod, containerName, timestamp, message)
	}
	
	if err := scanner.Err(); err != nil {
		log.Error("读取日志失败", "error", err)
	}
}

// 发送日志
func (k *KubernetesCollector) sendLog(ctx context.Context, pod *corev1.Pod, containerName string, timestamp time.Time, message string) {
	entry := &LogEntry{
		Timestamp: timestamp,
		Message:   message,
		Level:     k.detectLogLevel(message),
		Source:    fmt.Sprintf("%s/%s/%s", pod.Namespace, pod.Name, containerName),
		
		// Kubernetes 元数据
		Metadata: map[string]interface{}{
			"kubernetes": map[string]interface{}{
				"namespace":      pod.Namespace,
				"pod_name":       pod.Name,
				"pod_uid":        string(pod.UID),
				"container_name": containerName,
				"labels":         pod.Labels,
				"annotations":    pod.Annotations,
				"node_name":      pod.Spec.NodeName,
				"host_ip":        pod.Status.HostIP,
				"pod_ip":         pod.Status.PodIP,
			},
		},
	}
	
	// 添加容器信息
	for _, container := range pod.Spec.Containers {
		if container.Name == containerName {
			entry.Metadata["container"] = map[string]interface{}{
				"image":   container.Image,
				"image_id": k.getContainerImageID(pod, containerName),
			}
			break
		}
	}
	
	// 发送到处理管道
	k.pipeline.Process(ctx, entry)
}

// 多行日志缓冲区
type MultilineBuffer struct {
	Pattern *regexp.Regexp
	lines   []string
}

func (m *MultilineBuffer) ShouldMerge(line string) bool {
	if m.Pattern == nil {
		return false
	}
	
	// 如果匹配模式，说明是新的日志开始
	if m.Pattern.MatchString(line) {
		return false
	}
	
	// 否则是续行
	return len(m.lines) > 0
}

func (m *MultilineBuffer) Append(line string) {
	m.lines = append(m.lines, line)
}

func (m *MultilineBuffer) HasContent() bool {
	return len(m.lines) > 0
}

func (m *MultilineBuffer) Flush() string {
	if len(m.lines) == 0 {
		return ""
	}
	
	result := strings.Join(m.lines, "\n")
	m.lines = m.lines[:0]
	return result
}

// Service Mesh 集成
type ServiceMeshCollector struct {
	meshType string // istio, linkerd
	config   atomic.Value
}

// 采集 Istio Envoy 日志
func (s *ServiceMeshCollector) CollectIstioLogs(ctx context.Context) error {
	// 1. 监听 Envoy 访问日志
	// Istio 默认将访问日志输出到 stdout
	// 格式: [%START_TIME%] "%REQ(:METHOD)% %REQ(X-ENVOY-ORIGINAL-PATH?:PATH)% %PROTOCOL%" ...
	
	// 2. 解析 Envoy 日志格式
	parser := &EnvoyLogParser{
		Format: s.getEnvoyLogFormat(),
	}
	
	// 3. 提取追踪信息
	// Istio 在 HTTP Header 中注入追踪 ID
	// x-request-id, x-b3-traceid, x-b3-spanid
	
	return nil
}

// Kubernetes CRD 定义
type LogCollectionRule struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	
	Spec   LogCollectionRuleSpec   `json:"spec"`
	Status LogCollectionRuleStatus `json:"status,omitempty"`
}

type LogCollectionRuleSpec struct {
	// 选择器
	Selector LogSelector `json:"selector"`
	
	// 采集配置
	Collection CollectionConfig `json:"collection"`
	
	// 处理配置
	Processing ProcessingConfig `json:"processing"`
	
	// 输出配置
	Output OutputConfig `json:"output"`
}

type LogSelector struct {
	// Namespace 选择器
	Namespaces []string `json:"namespaces,omitempty"`
	
	// 标签选择器
	LabelSelector string `json:"labelSelector,omitempty"`
	
	// Pod 名称模式
	PodNamePattern string `json:"podNamePattern,omitempty"`
}

type CollectionConfig struct {
	// 是否跟随日志流
	Follow bool `json:"follow"`
	
	// 初始读取行数
	TailLines int64 `json:"tailLines"`
	
	// 多行合并模式
	MultilinePattern string `json:"multilinePattern,omitempty"`
	
	// 采集间隔
	Interval string `json:"interval,omitempty"`
}

// CRD 示例
/*
apiVersion: log-management.io/v1
kind: LogCollectionRule
metadata:
  name: collect-payment-service
  namespace: production
spec:
  selector:
    labelSelector: "app=payment-service"
  collection:
    follow: true
    tailLines: 100
    multilinePattern: '^\d{4}-\d{2}-\d{2}'
  processing:
    filters:
      - type: level
        value: ERROR,WARN,INFO
    parsers:
      - type: json
    enrichments:
      - type: kubernetes
      - type: geo_ip
  output:
    type: kafka
    config:
      brokers: ["kafka-1:9092", "kafka-2:9092"]
      topic: logs-payment
*/

// Helm Chart 部署配置
/*
**values.yaml**
replicaCount: 1

image:
  repository: log-management/collector
  tag: "1.0.0"
  pullPolicy: IfNotPresent

**DaemonSet 配置**
daemonset:
  enabled: true
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1

**资源限制**
resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 128Mi

**Kubernetes 配置**
kubernetes:
  # 采集配置
  collection:
    includeNamespaces: []
    excludeNamespaces: ["kube-system", "kube-public"]
    labelSelector: ""
  
  # 多行日志配置
  multiline:
    enabled: true
    patterns:
      java: '^\d{4}-\d{2}-\d{2}'
      python: '^Traceback'
      go: '^panic:'

**Service Mesh 集成**
serviceMesh:
  enabled: true
  type: istio  # istio, linkerd
  
  istio:
    accessLogFormat: |
      [%START_TIME%] "%REQ(:METHOD)% %REQ(X-ENVOY-ORIGINAL-PATH?:PATH)% %PROTOCOL%"
      %RESPONSE_CODE% %RESPONSE_FLAGS% %BYTES_RECEIVED% %BYTES_SENT%
      %DURATION% %RESP(X-ENVOY-UPSTREAM-SERVICE-TIME)%
      "%REQ(X-FORWARDED-FOR)%" "%REQ(USER-AGENT)%"
      "%REQ(X-REQUEST-ID)%" "%REQ(:AUTHORITY)%" "%UPSTREAM_HOST%"

**输出配置**
output:
  kafka:
    brokers: ["kafka:9092"]
    topic: logs-kubernetes
    compression: lz4
*/

// Kubernetes Operator
type LogCollectorOperator struct {
	client    client.Client
	scheme    *runtime.Scheme
	recorder  record.EventRecorder
}

// Reconcile 处理 LogCollectionRule 资源变化
func (r *LogCollectorOperator) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
	log := log.FromContext(ctx)
	
	// 获取 LogCollectionRule 资源
	var rule logmanagementv1.LogCollectionRule
	if err := r.client.Get(ctx, req.NamespacedName, &rule); err != nil {
		if errors.IsNotFound(err) {
			// 资源已删除，清理采集任务
			return ctrl.Result{}, r.cleanupCollectionTask(ctx, req.NamespacedName)
		}
		return ctrl.Result{}, err
	}
	
	// 创建或更新采集任务
	if err := r.reconcileCollectionTask(ctx, &rule); err != nil {
		log.Error(err, "协调采集任务失败")
		return ctrl.Result{}, err
	}
	
	// 更新状态
	rule.Status.Phase = "Running"
	rule.Status.LastUpdateTime = metav1.Now()
	if err := r.client.Status().Update(ctx, &rule); err != nil {
		return ctrl.Result{}, err
	}
	
	return ctrl.Result{}, nil
}

func (r *LogCollectorOperator) reconcileCollectionTask(ctx context.Context, rule *logmanagementv1.LogCollectionRule) error {
	// 1. 根据选择器查找匹配的 Pod
	pods, err := r.findMatchingPods(ctx, rule)
	if err != nil {
		return err
	}
	
	// 2. 为每个 Pod 创建采集任务
	for _, pod := range pods {
		task := &CollectionTask{
			RuleName:   rule.Name,
			Namespace:  pod.Namespace,
			PodName:    pod.Name,
			Config:     rule.Spec.Collection,
			Processing: rule.Spec.Processing,
			Output:     rule.Spec.Output,
		}
		
		if err := r.createOrUpdateTask(ctx, task); err != nil {
			log.Error(err, "创建采集任务失败", "pod", pod.Name)
			continue
		}
	}
	
	return nil
}
```

**关键实现点**:

1. 使用 Kubernetes Informer 机制实时监听 Pod 变化，自动发现和采集新 Pod 日志
2. 支持基于 Namespace、Label、Annotation 的灵活过滤规则
3. 实现多行日志合并，正确处理 Java 堆栈跟踪、Python Traceback 等多行日志
4. 以 DaemonSet 方式部署，确保每个节点都有采集代理，实现全覆盖
5. 支持 Kubernetes CRD，允许通过声明式配置管理日志采集规则
6. 集成 Service Mesh（Istio/Linkerd），采集 Envoy 访问日志和追踪数据
7. 提供 Helm Chart 和 Operator，简化部署和运维

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| kubernetes_enabled | bool | true | 是否启用 Kubernetes 集成 |
| include_namespaces | array | [] | 包含的 Namespace 列表（空表示全部） |
| exclude_namespaces | array | ["kube-system","kube-public"] | 排除的 Namespace 列表 |
| label_selector | string | "" | 标签选择器 |
| tail_lines | int | 100 | 初始读取行数 |
| follow_logs | bool | true | 是否跟随日志流 |
| multiline_enabled | bool | true | 是否启用多行合并 |
| multiline_patterns | map | {} | 多行合并模式（语言 -> 正则） |
| service_mesh_enabled | bool | false | 是否启用 Service Mesh 集成 |
| service_mesh_type | string | "istio" | Service Mesh 类型 |
| collect_container_metadata | bool | true | 是否采集容器元数据 |
| buffer_size_mb | int | 64 | 日志缓冲区大小（MB） |

**热更新机制**:

- 更新方式: Kubernetes ConfigMap + Watch 机制
- 生效时间: 配置变更后 3 秒内生效（对新 Pod 生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在 ConfigMap 变更后 3 秒内重新加载配置
2. WHEN Namespace 过滤规则变更时，THE System SHALL 自动调整采集范围，停止不匹配的采集任务
3. THE System SHALL 支持通过 Kubernetes API 查询当前生效的配置
4. THE System SHALL 记录所有配置变更的审计日志到 Kubernetes Event
5. WHEN 多行合并模式变更时，THE System SHALL 对新日志流生效，不影响已有流
6. WHEN Service Mesh 集成禁用时，THE System SHALL 停止采集 Envoy 日志，但保持 Pod 日志采集

---



#### 需求 15-54：IoT 与边缘设备管理 [Phase 3]

**用户故事**: 

作为物联网运维工程师，我希望系统能够自动发现和管理 IoT 设备的日志采集，以便统一监控大规模边缘设备。

**验收标准**:

1. THE Log_Collector SHALL 支持自动发现网络中的 IoT 设备和边缘计算节点，使用 mDNS、SSDP、MQTT 等协议
2. WHEN 新设备接入网络时，THE System SHALL 在 30 秒内自动发现设备，并在 2 分钟内完成配置和开始采集
3. THE Edge_Node SHALL 支持在本地进行日志预处理（过滤、聚合、压缩），仅上传关键日志以节省带宽
4. THE Dashboard SHALL 提供设备拓扑视图，展示所有 IoT 设备的连接状态、位置信息和日志采集情况
5. WHEN 设备离线超过 5 分钟时，THE System SHALL 自动发送告警通知，并标记设备状态为离线
6. THE Log_Collector SHALL 支持低功耗模式，在边缘设备上运行时 CPU 占用 < 2%，内存占用 < 50MB
7. THE System SHALL 支持设备分组管理，按地理位置、设备类型、功能分组
8. THE Edge_Node SHALL 支持离线缓存，网络断开时本地缓存最多 7 天的日志数据
9. THE System SHALL 支持 MQTT、CoAP、LwM2M 等 IoT 协议的日志采集
10. THE Dashboard SHALL 提供设备健康评分，基于日志质量、连接稳定性、资源使用率综合评估

**实现方向**:

**实现方式**:

```go
// IoT 设备管理器
type IoTDeviceManager struct {
	discovery    *DeviceDiscovery      // 设备发现
	registry     *DeviceRegistry       // 设备注册表
	provisioner  *DeviceProvisioner    // 设备配置器
	monitor      *DeviceMonitor        // 设备监控
	topology     *TopologyManager      // 拓扑管理
	config       atomic.Value          // 配置
}

// 设备定义
type IoTDevice struct {
	ID           string                 `json:"id"`
	Name         string                 `json:"name"`
	Type         string                 `json:"type"`         // sensor, gateway, edge_node
	Status       DeviceStatus           `json:"status"`       // online, offline, error
	IPAddress    string                 `json:"ip_address"`
	MACAddress   string                 `json:"mac_address"`
	Location     *GeoLocation           `json:"location"`
	Metadata     map[string]interface{} `json:"metadata"`
	
	// 能力信息
	Capabilities DeviceCapabilities     `json:"capabilities"`
	
	// 连接信息
	Protocol     string                 `json:"protocol"`     // mqtt, coap, lwm2m, http
	LastSeen     time.Time              `json:"last_seen"`
	
	// 资源使用
	Resources    DeviceResources        `json:"resources"`
	
	// 健康评分
	HealthScore  float64                `json:"health_score"`
	
	// 分组
	Groups       []string               `json:"groups"`
}

// 设备能力
type DeviceCapabilities struct {
	LogCollection  bool   `json:"log_collection"`
	LocalProcessing bool  `json:"local_processing"`
	OfflineCache   bool   `json:"offline_cache"`
	Compression    bool   `json:"compression"`
	Encryption     bool   `json:"encryption"`
	
	// 资源限制
	MaxCPUPercent    float64 `json:"max_cpu_percent"`
	MaxMemoryMB      int     `json:"max_memory_mb"`
	MaxStorageGB     int     `json:"max_storage_gb"`
	MaxBandwidthKbps int     `json:"max_bandwidth_kbps"`
}

// 设备发现服务
type DeviceDiscovery struct {
	mdns     *MDNSDiscovery
	ssdp     *SSDPDiscovery
	mqtt     *MQTTDiscovery
	manual   *ManualRegistry
	callback func(*IoTDevice)
}

// 启动设备发现
func (d *DeviceDiscovery) Start(ctx context.Context) error {
	// 1. 启动 mDNS 发现（用于本地网络）
	go d.mdns.Discover(ctx, func(device *IoTDevice) {
		log.Info("通过 mDNS 发现设备", "device", device.Name, "ip", device.IPAddress)
		d.callback(device)
	})
	
	// 2. 启动 SSDP 发现（用于 UPnP 设备）
	go d.ssdp.Discover(ctx, func(device *IoTDevice) {
		log.Info("通过 SSDP 发现设备", "device", device.Name, "ip", device.IPAddress)
		d.callback(device)
	})
	
	// 3. 启动 MQTT 发现（设备主动上报）
	go d.mqtt.Subscribe(ctx, "devices/+/announce", func(device *IoTDevice) {
		log.Info("通过 MQTT 发现设备", "device", device.Name)
		d.callback(device)
	})
	
	return nil
}

// mDNS 发现
type MDNSDiscovery struct {
	serviceType string // "_log-collector._tcp"
}

func (m *MDNSDiscovery) Discover(ctx context.Context, callback func(*IoTDevice)) {
	// 创建 mDNS 客户端
	resolver, err := zeroconf.NewResolver(nil)
	if err != nil {
		log.Error("创建 mDNS 解析器失败", "error", err)
		return
	}
	
	// 发现服务
	entries := make(chan *zeroconf.ServiceEntry)
	go func() {
		for entry := range entries {
			device := &IoTDevice{
				ID:         generateDeviceID(entry),
				Name:       entry.Instance,
				IPAddress:  entry.AddrIPv4[0].String(),
				Protocol:   "mdns",
				LastSeen:   time.Now(),
				Status:     DeviceStatusOnline,
			}
			
			// 解析 TXT 记录获取设备信息
			for _, txt := range entry.Text {
				parts := strings.SplitN(txt, "=", 2)
				if len(parts) == 2 {
					switch parts[0] {
					case "type":
						device.Type = parts[1]
					case "version":
						device.Metadata["version"] = parts[1]
					case "capabilities":
						device.Metadata["capabilities"] = parts[1]
					}
				}
			}
			
			callback(device)
		}
	}()
	
	// 开始浏览服务
	err = resolver.Browse(ctx, m.serviceType, "local.", entries)
	if err != nil {
		log.Error("浏览 mDNS 服务失败", "error", err)
	}
}

// MQTT 发现（设备主动上报）
type MQTTDiscovery struct {
	client mqtt.Client
}

func (m *MQTTDiscovery) Subscribe(ctx context.Context, topic string, callback func(*IoTDevice)) {
	token := m.client.Subscribe(topic, 1, func(client mqtt.Client, msg mqtt.Message) {
		// 解析设备信息
		var announcement DeviceAnnouncement
		if err := json.Unmarshal(msg.Payload(), &announcement); err != nil {
			log.Error("解析设备公告失败", "error", err)
			return
		}
		
		device := &IoTDevice{
			ID:        announcement.DeviceID,
			Name:      announcement.DeviceName,
			Type:      announcement.DeviceType,
			IPAddress: announcement.IPAddress,
			Protocol:  "mqtt",
			LastSeen:  time.Now(),
			Status:    DeviceStatusOnline,
			Metadata:  announcement.Metadata,
		}
		
		callback(device)
	})
	
	if token.Wait() && token.Error() != nil {
		log.Error("订阅 MQTT 主题失败", "error", token.Error())
	}
}

// 设备配置器（自动配置）
type DeviceProvisioner struct {
	templates map[string]*ConfigTemplate
	client    *http.Client
}

// 自动配置设备
func (p *DeviceProvisioner) ProvisionDevice(ctx context.Context, device *IoTDevice) error {
	log.Info("开始配置设备", "device", device.Name)
	
	// 1. 选择配置模板
	template := p.selectTemplate(device)
	if template == nil {
		return fmt.Errorf("未找到适合的配置模板")
	}
	
	// 2. 生成设备配置
	config := p.generateConfig(device, template)
	
	// 3. 推送配置到设备
	if err := p.pushConfig(ctx, device, config); err != nil {
		return fmt.Errorf("推送配置失败: %w", err)
	}
	
	// 4. 验证配置
	if err := p.verifyConfig(ctx, device); err != nil {
		return fmt.Errorf("验证配置失败: %w", err)
	}
	
	log.Info("设备配置完成", "device", device.Name)
	return nil
}

func (p *DeviceProvisioner) pushConfig(ctx context.Context, device *IoTDevice, config *DeviceConfig) error {
	switch device.Protocol {
	case "mqtt":
		return p.pushConfigViaMQTT(ctx, device, config)
	case "coap":
		return p.pushConfigViaCoAP(ctx, device, config)
	case "http":
		return p.pushConfigViaHTTP(ctx, device, config)
	default:
		return fmt.Errorf("不支持的协议: %s", device.Protocol)
	}
}

// 边缘节点日志处理器
type EdgeLogProcessor struct {
	filters     []LogFilter
	aggregators []LogAggregator
	compressor  *Compressor
	cache       *OfflineCache
	uploader    *LogUploader
	config      atomic.Value
}

// 处理日志
func (e *EdgeLogProcessor) Process(ctx context.Context, entry *LogEntry) error {
	config := e.config.Load().(*EdgeProcessorConfig)
	
	// 1. 应用过滤规则（减少数据量）
	for _, filter := range e.filters {
		if !filter.Match(entry) {
			return nil // 过滤掉
		}
	}
	
	// 2. 本地聚合（减少传输次数）
	if config.AggregationEnabled {
		for _, aggregator := range e.aggregators {
			if aggregator.ShouldAggregate(entry) {
				aggregator.Add(entry)
				return nil // 暂不上传，等待聚合
			}
		}
	}
	
	// 3. 压缩（减少带宽）
	if config.CompressionEnabled {
		compressed, err := e.compressor.Compress(entry)
		if err != nil {
			log.Warn("压缩失败", "error", err)
		} else {
			entry.Data = compressed
			entry.Compressed = true
		}
	}
	
	// 4. 上传或缓存
	if e.uploader.IsOnline() {
		// 在线，直接上传
		if err := e.uploader.Upload(ctx, entry); err != nil {
			// 上传失败，写入离线缓存
			e.cache.Store(entry)
		}
	} else {
		// 离线，写入缓存
		e.cache.Store(entry)
	}
	
	return nil
}

// 离线缓存
type OfflineCache struct {
	db          *bolt.DB
	maxSize     int64  // 最大缓存大小（字节）
	currentSize int64
	retention   time.Duration // 保留时间
	mu          sync.RWMutex
}

func (c *OfflineCache) Store(entry *LogEntry) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	// 检查缓存大小
	if c.currentSize >= c.maxSize {
		// 删除最旧的数据
		if err := c.evictOldest(); err != nil {
			return err
		}
	}
	
	// 序列化日志
	data, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	
	// 存储到 BoltDB
	return c.db.Update(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("logs"))
		key := []byte(fmt.Sprintf("%d-%s", entry.Timestamp.Unix(), entry.ID))
		
		if err := bucket.Put(key, data); err != nil {
			return err
		}
		
		c.currentSize += int64(len(data))
		return nil
	})
}

// 恢复在线后同步缓存数据
func (c *OfflineCache) Sync(ctx context.Context, uploader *LogUploader) error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	batch := make([]*LogEntry, 0, 100)
	
	err := c.db.View(func(tx *bolt.Tx) error {
		bucket := tx.Bucket([]byte("logs"))
		cursor := bucket.Cursor()
		
		for k, v := cursor.First(); k != nil; k, v = cursor.Next() {
			var entry LogEntry
			if err := json.Unmarshal(v, &entry); err != nil {
				log.Error("反序列化日志失败", "error", err)
				continue
			}
			
			batch = append(batch, &entry)
			
			// 批量上传
			if len(batch) >= 100 {
				if err := uploader.UploadBatch(ctx, batch); err != nil {
					return err
				}
				
				// 删除已上传的数据
				for _, e := range batch {
					key := []byte(fmt.Sprintf("%d-%s", e.Timestamp.Unix(), e.ID))
					bucket.Delete(key)
				}
				
				batch = batch[:0]
			}
		}
		
		// 上传剩余数据
		if len(batch) > 0 {
			if err := uploader.UploadBatch(ctx, batch); err != nil {
				return err
			}
		}
		
		return nil
	})
	
	if err == nil {
		c.currentSize = 0
		log.Info("离线缓存同步完成")
	}
	
	return err
}

// 设备监控器
type DeviceMonitor struct {
	devices  map[string]*IoTDevice
	mu       sync.RWMutex
	alerter  *Alerter
}

// 启动监控
func (m *DeviceMonitor) Start(ctx context.Context) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			m.checkDevices(ctx)
		case <-ctx.Done():
			return
		}
	}
}

func (m *DeviceMonitor) checkDevices(ctx context.Context) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	now := time.Now()
	
	for _, device := range m.devices {
		// 检查设备是否离线
		if now.Sub(device.LastSeen) > 5*time.Minute {
			if device.Status != DeviceStatusOffline {
				device.Status = DeviceStatusOffline
				
				// 发送告警
				m.alerter.Send(&Alert{
					Level:   AlertLevelWarning,
					Title:   "设备离线",
					Message: fmt.Sprintf("设备 %s 已离线超过 5 分钟", device.Name),
					Tags:    []string{"device", "offline"},
					Metadata: map[string]interface{}{
						"device_id":   device.ID,
						"device_name": device.Name,
						"last_seen":   device.LastSeen,
					},
				})
			}
		}
		
		// 计算健康评分
		device.HealthScore = m.calculateHealthScore(device)
	}
}

// 计算设备健康评分
func (m *DeviceMonitor) calculateHealthScore(device *IoTDevice) float64 {
	score := 100.0
	
	// 1. 连接稳定性（40%）
	uptime := m.calculateUptime(device)
	score -= (1.0 - uptime) * 40
	
	// 2. 资源使用率（30%）
	if device.Resources.CPUPercent > 80 {
		score -= 15
	} else if device.Resources.CPUPercent > 60 {
		score -= 5
	}
	
	if device.Resources.MemoryPercent > 80 {
		score -= 15
	} else if device.Resources.MemoryPercent > 60 {
		score -= 5
	}
	
	// 3. 日志质量（30%）
	logQuality := m.calculateLogQuality(device)
	score -= (1.0 - logQuality) * 30
	
	if score < 0 {
		score = 0
	}
	
	return score
}

// 拓扑管理器
type TopologyManager struct {
	devices  map[string]*IoTDevice
	edges    []*TopologyEdge
	groups   map[string]*DeviceGroup
}

type TopologyEdge struct {
	Source string `json:"source"` // 设备 ID
	Target string `json:"target"` // 设备 ID
	Type   string `json:"type"`   // parent, peer, gateway
}

type DeviceGroup struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Type     string   `json:"type"` // location, function, type
	Devices  []string `json:"devices"`
	Metadata map[string]interface{} `json:"metadata"`
}

// 生成拓扑图
func (t *TopologyManager) GenerateTopology() *Topology {
	return &Topology{
		Nodes:  t.getNodes(),
		Edges:  t.edges,
		Groups: t.getGroups(),
	}
}
```

**关键实现点**:

1. 实现多协议设备发现（mDNS、SSDP、MQTT），支持自动发现和注册
2. 支持设备自动配置，根据设备类型选择合适的配置模板
3. 边缘节点实现本地日志预处理，包括过滤、聚合、压缩，减少带宽消耗
4. 使用 BoltDB 实现离线缓存，支持最多 7 天的本地存储
5. 实现设备健康评分算法，综合连接稳定性、资源使用、日志质量
6. 支持设备分组和拓扑管理，提供可视化的设备关系图
7. 低功耗模式优化，适配资源受限的边缘设备

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| iot_enabled | bool | false | 是否启用 IoT 功能 |
| discovery_protocols | array | ["mdns","mqtt"] | 启用的发现协议 |
| auto_provision_enabled | bool | true | 是否启用自动配置 |
| provision_timeout_seconds | int | 120 | 配置超时时间（秒） |
| offline_cache_enabled | bool | true | 是否启用离线缓存 |
| offline_cache_max_size_gb | int | 10 | 离线缓存最大大小（GB） |
| offline_cache_retention_days | int | 7 | 离线缓存保留天数 |
| device_offline_threshold_minutes | int | 5 | 设备离线阈值（分钟） |
| health_check_interval_seconds | int | 30 | 健康检查间隔（秒） |
| low_power_mode_enabled | bool | false | 是否启用低功耗模式 |
| edge_processing_enabled | bool | true | 是否启用边缘处理 |
| compression_enabled | bool | true | 是否启用压缩 |
| aggregation_enabled | bool | true | 是否启用聚合 |
| aggregation_window_seconds | int | 60 | 聚合时间窗口（秒） |

**热更新机制**:

- 更新方式: MQTT 配置推送 + 本地配置文件监听
- 生效时间: 配置变更后 5 秒内生效
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 5 秒内应用新的 IoT 配置
2. WHEN 发现协议变更时，THE System SHALL 自动启动或停止相应的发现服务
3. THE System SHALL 支持通过 MQTT 远程查询边缘节点的当前配置
4. THE System SHALL 记录所有配置变更的审计日志到本地和中央服务器
5. WHEN 离线缓存大小变更时，THE System SHALL 自动调整缓存空间，必要时清理旧数据
6. WHEN 低功耗模式启用时，THE System SHALL 降低采集频率和处理强度，延长电池寿命

---


#### 需求 15-55：成本管理与优化 [Phase 3]

**用户故事**: 

作为财务管理人员，我希望能够监控和优化日志系统的运营成本，以便控制 IT 支出并提高资源利用效率。

**验收标准**:

1. THE Dashboard SHALL 提供成本分析仪表盘，展示存储、计算、网络等各项成本明细，数据更新延迟不超过 1 小时
2. THE System SHALL 支持按部门、项目、应用、环境等维度进行成本分摊，支持自定义分摊规则
3. THE Log_Analyzer SHALL 识别成本优化机会，包括低价值日志（访问频率 < 1次/月）、过度保留的数据（超过合规要求）
4. THE System SHALL 提供成本优化建议，包括存储层级调整、采样策略优化、数据压缩、保留期调整
5. THE Dashboard SHALL 支持设置成本预算和告警阈值，按月度、季度、年度设置预算
6. WHEN 成本超出预算 80% 时，THE System SHALL 发送预警通知
7. WHEN 成本超出预算 100% 时，THE System SHALL 发送紧急告警并提供成本控制建议（如启用采样、降低保留期）
8. THE System SHALL 提供成本趋势预测，基于历史数据预测未来 3 个月的成本
9. THE Dashboard SHALL 展示成本优化效果对比，显示优化前后的成本节省金额和百分比
10. THE System SHALL 支持导出成本报告（PDF、Excel），包含详细的成本明细和分析图表

**实现方向**:

**实现方式**:

```go
// 成本管理器
type CostManager struct {
	collector   *CostCollector       // 成本采集器
	analyzer    *CostAnalyzer        // 成本分析器
	allocator   *CostAllocator       // 成本分摊器
	optimizer   *CostOptimizer       // 成本优化器
	budgetMgr   *BudgetManager       // 预算管理器
	forecaster  *CostForecaster      // 成本预测器
	config      atomic.Value         // 配置
}

// 成本数据结构
type CostData struct {
	Period      TimePeriod             `json:"period"`
	TotalCost   float64                `json:"total_cost"`
	Currency    string                 `json:"currency"` // USD, CNY
	
	// 成本分类
	Breakdown   CostBreakdown          `json:"breakdown"`
	
	// 成本分摊
	Allocation  map[string]float64     `json:"allocation"` // 维度 -> 成本
	
	// 优化建议
	Opportunities []OptimizationOpportunity `json:"opportunities"`
}

// 成本分类
type CostBreakdown struct {
	Storage     StorageCost    `json:"storage"`
	Compute     ComputeCost    `json:"compute"`
	Network     NetworkCost    `json:"network"`
	License     float64        `json:"license"`
	Support     float64        `json:"support"`
	Other       float64        `json:"other"`
}

// 存储成本
type StorageCost struct {
	HotStorage  float64 `json:"hot_storage"`   // 热存储成本
	WarmStorage float64 `json:"warm_storage"`  // 温存储成本
	ColdStorage float64 `json:"cold_storage"`  // 冷存储成本
	Backup      float64 `json:"backup"`        // 备份成本
	Total       float64 `json:"total"`
}

// 计算成本
type ComputeCost struct {
	Processing  float64 `json:"processing"`    // 日志处理成本
	Analysis    float64 `json:"analysis"`      // 日志分析成本
	Indexing    float64 `json:"indexing"`      // 索引成本
	Query       float64 `json:"query"`         // 查询成本
	Total       float64 `json:"total"`
}

// 网络成本
type NetworkCost struct {
	Ingress     float64 `json:"ingress"`       // 入站流量成本
	Egress      float64 `json:"egress"`        // 出站流量成本
	CrossRegion float64 `json:"cross_region"`  // 跨区域传输成本
	Total       float64 `json:"total"`
}

// 成本采集器
type CostCollector struct {
	providers map[string]CostProvider // 成本数据源
	cache     *redis.Client
}

// 成本数据源接口
type CostProvider interface {
	GetCost(ctx context.Context, period TimePeriod) (*CostData, error)
	GetResourceCost(ctx context.Context, resourceID string, period TimePeriod) (float64, error)
}

// AWS 成本数据源
type AWSCostProvider struct {
	client *costexplorer.Client
}

func (p *AWSCostProvider) GetCost(ctx context.Context, period TimePeriod) (*CostData, error) {
	// 使用 AWS Cost Explorer API 获取成本数据
	input := &costexplorer.GetCostAndUsageInput{
		TimePeriod: &types.DateInterval{
			Start: aws.String(period.Start.Format("2006-01-02")),
			End:   aws.String(period.End.Format("2006-01-02")),
		},
		Granularity: types.GranularityDaily,
		Metrics:     []string{"UnblendedCost"},
		GroupBy: []types.GroupDefinition{
			{
				Type: types.GroupDefinitionTypeDimension,
				Key:  aws.String("SERVICE"),
			},
		},
	}
	
	result, err := p.client.GetCostAndUsage(ctx, input)
	if err != nil {
		return nil, err
	}
	
	// 解析结果
	costData := &CostData{
		Period:   period,
		Currency: "USD",
	}
	
	for _, resultByTime := range result.ResultsByTime {
		for _, group := range resultByTime.Groups {
			service := group.Keys[0]
			amount, _ := strconv.ParseFloat(*group.Metrics["UnblendedCost"].Amount, 64)
			
			// 分类成本
			switch service {
			case "Amazon Elastic Compute Cloud":
				costData.Breakdown.Compute.Total += amount
			case "Amazon Simple Storage Service":
				costData.Breakdown.Storage.HotStorage += amount
			case "Amazon CloudWatch":
				costData.Breakdown.Compute.Processing += amount
			}
		}
	}
	
	costData.TotalCost = p.calculateTotal(&costData.Breakdown)
	return costData, nil
}

// 成本分摊器
type CostAllocator struct {
	rules []AllocationRule
}

// 分摊规则
type AllocationRule struct {
	Dimension   string             `json:"dimension"`   // department, project, application, environment
	Method      string             `json:"method"`      // proportional, fixed, custom
	Weights     map[string]float64 `json:"weights"`     // 权重配置
	Tags        map[string]string  `json:"tags"`        // 标签匹配
}

// 执行成本分摊
func (a *CostAllocator) Allocate(ctx context.Context, costData *CostData) (map[string]float64, error) {
	allocation := make(map[string]float64)
	
	for _, rule := range a.rules {
		switch rule.Method {
		case "proportional":
			// 按比例分摊
			a.allocateProportional(costData, rule, allocation)
		case "fixed":
			// 固定金额分摊
			a.allocateFixed(costData, rule, allocation)
		case "custom":
			// 自定义分摊逻辑
			a.allocateCustom(costData, rule, allocation)
		}
	}
	
	return allocation, nil
}

// 按比例分摊
func (a *CostAllocator) allocateProportional(costData *CostData, rule AllocationRule, allocation map[string]float64) {
	// 获取各维度的使用量
	usage := a.getUsageByDimension(rule.Dimension)
	
	totalUsage := 0.0
	for _, u := range usage {
		totalUsage += u
	}
	
	// 按使用量比例分摊成本
	for key, u := range usage {
		proportion := u / totalUsage
		cost := costData.TotalCost * proportion
		allocation[fmt.Sprintf("%s:%s", rule.Dimension, key)] = cost
	}
}

// 成本分析器
type CostAnalyzer struct {
	db    *sql.DB
	cache *redis.Client
}

// 识别成本优化机会
func (a *CostAnalyzer) IdentifyOpportunities(ctx context.Context, period TimePeriod) ([]OptimizationOpportunity, error) {
	opportunities := []OptimizationOpportunity{}
	
	// 1. 识别低价值日志
	lowValueLogs, err := a.findLowValueLogs(ctx, period)
	if err != nil {
		log.Error("识别低价值日志失败", "error", err)
	} else {
		for _, log := range lowValueLogs {
			opportunities = append(opportunities, OptimizationOpportunity{
				Type:        "low_value_logs",
				Description: fmt.Sprintf("日志源 %s 访问频率低（%d 次/月），建议降低采样率或停止采集", log.Source, log.AccessCount),
				Savings:     log.EstimatedCost,
				Impact:      "low",
				Actions: []string{
					fmt.Sprintf("降低采样率至 10%%"),
					fmt.Sprintf("停止采集此日志源"),
				},
			})
		}
	}
	
	// 2. 识别过度保留的数据
	overRetainedData, err := a.findOverRetainedData(ctx, period)
	if err != nil {
		log.Error("识别过度保留数据失败", "error", err)
	} else {
		for _, data := range overRetainedData {
			opportunities = append(opportunities, OptimizationOpportunity{
				Type:        "over_retention",
				Description: fmt.Sprintf("数据 %s 保留期为 %d 天，超过合规要求（%d 天）", data.Index, data.CurrentRetention, data.RequiredRetention),
				Savings:     data.EstimatedCost,
				Impact:      "medium",
				Actions: []string{
					fmt.Sprintf("调整保留期至 %d 天", data.RequiredRetention),
					fmt.Sprintf("迁移至冷存储"),
				},
			})
		}
	}
	
	// 3. 识别未压缩的数据
	uncompressedData, err := a.findUncompressedData(ctx, period)
	if err != nil {
		log.Error("识别未压缩数据失败", "error", err)
	} else {
		if uncompressedData.Size > 0 {
			opportunities = append(opportunities, OptimizationOpportunity{
				Type:        "compression",
				Description: fmt.Sprintf("发现 %.2f GB 未压缩数据，启用压缩可节省 70%% 存储空间", uncompressedData.Size),
				Savings:     uncompressedData.EstimatedCost * 0.7,
				Impact:      "high",
				Actions: []string{
					"启用 LZ4 压缩",
					"启用 Zstd 压缩（更高压缩率）",
				},
			})
		}
	}
	
	// 4. 识别存储层级优化机会
	tieringOpportunities, err := a.findTieringOpportunities(ctx, period)
	if err != nil {
		log.Error("识别存储层级优化机会失败", "error", err)
	} else {
		opportunities = append(opportunities, tieringOpportunities...)
	}
	
	return opportunities, nil
}

// 优化机会
type OptimizationOpportunity struct {
	Type        string   `json:"type"`        // low_value_logs, over_retention, compression, tiering
	Description string   `json:"description"`
	Savings     float64  `json:"savings"`     // 预计节省金额
	Impact      string   `json:"impact"`      // low, medium, high
	Actions     []string `json:"actions"`     // 可执行的优化操作
}

// 预算管理器
type BudgetManager struct {
	db      *sql.DB
	alerter *Alerter
}

// 预算定义
type Budget struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Period      string      `json:"period"`      // monthly, quarterly, yearly
	Amount      float64     `json:"amount"`
	Currency    string      `json:"currency"`
	
	// 告警阈值
	Thresholds  []BudgetThreshold `json:"thresholds"`
	
	// 当前使用
	CurrentSpend float64    `json:"current_spend"`
	Percentage   float64    `json:"percentage"`
	
	// 范围
	Scope       BudgetScope `json:"scope"`
}

type BudgetThreshold struct {
	Percentage float64 `json:"percentage"` // 80, 100
	Action     string  `json:"action"`     // alert, notify, restrict
}

type BudgetScope struct {
	Departments  []string `json:"departments"`
	Projects     []string `json:"projects"`
	Applications []string `json:"applications"`
}

// 检查预算
func (b *BudgetManager) CheckBudget(ctx context.Context, budget *Budget, currentCost float64) error {
	budget.CurrentSpend = currentCost
	budget.Percentage = (currentCost / budget.Amount) * 100
	
	// 检查阈值
	for _, threshold := range budget.Thresholds {
		if budget.Percentage >= threshold.Percentage {
			switch threshold.Action {
			case "alert":
				b.sendBudgetAlert(budget, threshold)
			case "notify":
				b.sendBudgetNotification(budget, threshold)
			case "restrict":
				b.applyRestrictions(budget)
			}
		}
	}
	
	return nil
}

func (b *BudgetManager) sendBudgetAlert(budget *Budget, threshold BudgetThreshold) {
	level := AlertLevelWarning
	if threshold.Percentage >= 100 {
		level = AlertLevelCritical
	}
	
	b.alerter.Send(&Alert{
		Level:   level,
		Title:   "预算告警",
		Message: fmt.Sprintf("预算 %s 已使用 %.1f%%（%.2f / %.2f %s）", 
			budget.Name, budget.Percentage, budget.CurrentSpend, budget.Amount, budget.Currency),
		Tags:    []string{"budget", "cost"},
		Metadata: map[string]interface{}{
			"budget_id":      budget.ID,
			"budget_name":    budget.Name,
			"current_spend":  budget.CurrentSpend,
			"budget_amount":  budget.Amount,
			"percentage":     budget.Percentage,
		},
	})
}

// 成本预测器
type CostForecaster struct {
	db    *sql.DB
	model *ForecastModel
}

// 预测未来成本
func (f *CostForecaster) Forecast(ctx context.Context, months int) (*CostForecast, error) {
	// 1. 获取历史成本数据
	historicalData, err := f.getHistoricalCost(ctx, 12) // 最近 12 个月
	if err != nil {
		return nil, err
	}
	
	// 2. 使用时间序列模型预测
	// 这里使用简单的线性回归，实际可以使用 ARIMA、Prophet 等更复杂的模型
	forecast := &CostForecast{
		Months: make([]MonthlyForecast, months),
	}
	
	// 计算趋势
	trend := f.calculateTrend(historicalData)
	lastCost := historicalData[len(historicalData)-1].Cost
	
	for i := 0; i < months; i++ {
		predictedCost := lastCost + trend*float64(i+1)
		
		// 添加季节性因素
		seasonalFactor := f.getSeasonalFactor(i + 1)
		predictedCost *= seasonalFactor
		
		forecast.Months[i] = MonthlyForecast{
			Month:         time.Now().AddDate(0, i+1, 0),
			PredictedCost: predictedCost,
			LowerBound:    predictedCost * 0.9, // 90% 置信区间
			UpperBound:    predictedCost * 1.1,
		}
	}
	
	return forecast, nil
}

// 成本预测结果
type CostForecast struct {
	Months []MonthlyForecast `json:"months"`
}

type MonthlyForecast struct {
	Month         time.Time `json:"month"`
	PredictedCost float64   `json:"predicted_cost"`
	LowerBound    float64   `json:"lower_bound"`
	UpperBound    float64   `json:"upper_bound"`
}

// 成本优化器
type CostOptimizer struct {
	analyzer *CostAnalyzer
	executor *OptimizationExecutor
}

// 执行优化
func (o *CostOptimizer) Optimize(ctx context.Context, opportunity OptimizationOpportunity) (*OptimizationResult, error) {
	log.Info("执行成本优化", "type", opportunity.Type)
	
	result := &OptimizationResult{
		OpportunityType: opportunity.Type,
		StartTime:       time.Now(),
	}
	
	switch opportunity.Type {
	case "low_value_logs":
		err := o.executor.ReduceSamplingRate(ctx, opportunity)
		result.Success = (err == nil)
		result.Error = err
		
	case "over_retention":
		err := o.executor.AdjustRetention(ctx, opportunity)
		result.Success = (err == nil)
		result.Error = err
		
	case "compression":
		err := o.executor.EnableCompression(ctx, opportunity)
		result.Success = (err == nil)
		result.Error = err
		
	case "tiering":
		err := o.executor.MigrateToLowerTier(ctx, opportunity)
		result.Success = (err == nil)
		result.Error = err
	}
	
	result.EndTime = time.Now()
	result.Duration = result.EndTime.Sub(result.StartTime)
	
	if result.Success {
		result.ActualSavings = opportunity.Savings
	}
	
	return result, nil
}

// 优化结果
type OptimizationResult struct {
	OpportunityType string        `json:"opportunity_type"`
	Success         bool          `json:"success"`
	Error           error         `json:"error,omitempty"`
	StartTime       time.Time     `json:"start_time"`
	EndTime         time.Time     `json:"end_time"`
	Duration        time.Duration `json:"duration"`
	ActualSavings   float64       `json:"actual_savings"`
}

// 成本报告生成器
type CostReportGenerator struct {
	manager *CostManager
}

// 生成成本报告
func (g *CostReportGenerator) GenerateReport(ctx context.Context, period TimePeriod, format string) ([]byte, error) {
	// 1. 收集成本数据
	costData, err := g.manager.collector.CollectCost(ctx, period)
	if err != nil {
		return nil, err
	}
	
	// 2. 生成报告
	switch format {
	case "pdf":
		return g.generatePDFReport(costData)
	case "excel":
		return g.generateExcelReport(costData)
	case "json":
		return json.Marshal(costData)
	default:
		return nil, fmt.Errorf("不支持的格式: %s", format)
	}
}

func (g *CostReportGenerator) generatePDFReport(costData *CostData) ([]byte, error) {
	// 使用 PDF 库生成报告
	// 包含：成本概览、成本分类、成本趋势图、优化建议等
	return nil, nil
}
```

**关键实现点**:

1. 集成多个云平台的成本 API（AWS Cost Explorer、Azure Cost Management、GCP Billing），统一采集成本数据
2. 实现灵活的成本分摊机制，支持按比例、固定金额、自定义规则分摊
3. 使用机器学习算法识别成本优化机会，包括低价值日志、过度保留、未压缩数据
4. 实现预算管理和多级告警机制（80% 预警、100% 紧急告警）
5. 使用时间序列模型预测未来成本，支持趋势分析和季节性调整
6. 提供自动化成本优化执行器，可自动应用优化建议
7. 支持生成多格式成本报告（PDF、Excel、JSON），包含详细图表和分析

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| cost_management_enabled | bool | true | 是否启用成本管理 |
| cost_collection_interval_hours | int | 1 | 成本采集间隔（小时） |
| enabled_cost_providers | array | ["aws","azure","gcp"] | 启用的成本数据源 |
| allocation_rules | array | [] | 成本分摊规则列表 |
| budget_check_interval_hours | int | 6 | 预算检查间隔（小时） |
| optimization_auto_execute | bool | false | 是否自动执行优化 |
| optimization_approval_required | bool | true | 优化是否需要审批 |
| forecast_months | int | 3 | 成本预测月数 |
| low_value_threshold_access_per_month | int | 1 | 低价值日志阈值（访问次数/月） |
| over_retention_check_enabled | bool | true | 是否检查过度保留 |
| compression_recommendation_enabled | bool | true | 是否推荐压缩 |
| report_generation_enabled | bool | true | 是否启用报告生成 |
| currency | string | "USD" | 货币单位 |

**热更新机制**:

- 更新方式: PostgreSQL 配置表 + Redis 发布订阅
- 生效时间: 配置变更后 5 秒内生效
- 回滚策略: 配置验证失败时保持原配置，记录错误日志并发送告警

**热更新验收标准**:

1. THE System SHALL 在配置变更后 5 秒内应用新的成本管理配置
2. WHEN 分摊规则变更时，THE System SHALL 重新计算所有维度的成本分摊
3. THE System SHALL 支持通过 API 查询当前生效的成本管理配置
4. THE System SHALL 记录所有成本管理配置变更的审计日志
5. WHEN 自动执行优化启用时，THE System SHALL 在执行前验证优化操作的安全性
6. WHEN 预算阈值变更时，THE System SHALL 立即重新评估所有预算的告警状态

---



### 15.5 API 接口汇总

模块十五提供以下 API 接口（从API-15-503开始，延续模块14的编号）：

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-15-503 | 创建租户 | 企业级功能 | POST | /api/v1/tenants | tenant.admin | Body: {name,quota,branding} | {code:0,data:{id:"tenant-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | 张三 | 需求15-51 |
| API-15-504 | 获取租户列表 | 企业级功能 | GET | /api/v1/tenants | tenant.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 张三 | 需求15-51 |
| API-15-505 | 获取租户详情 | 企业级功能 | GET | /api/v1/tenants/{id} | tenant.read | Path: id | {code:0,data:{id,name,quota}} | 200/401/403/404/500 | v1 | 是 | 是 | 张三 | 需求15-51 |
| API-15-506 | 更新租户配置 | 企业级功能 | PUT | /api/v1/tenants/{id} | tenant.admin | Path: id, Body: {name,quota} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求15-51 |
| API-15-507 | 删除租户 | 企业级功能 | DELETE | /api/v1/tenants/{id} | tenant.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求15-51 |
| API-15-508 | 获取租户配额使用情况 | 企业级功能 | GET | /api/v1/tenants/{id}/quota | tenant.read | Path: id | {code:0,data:{used,total,percent}} | 200/401/403/404/500 | v1 | 是 | 是 | 张三 | 需求15-51 |
| API-15-509 | 更新租户配额 | 企业级功能 | PUT | /api/v1/tenants/{id}/quota | tenant.admin | Path: id, Body: {storage,logs,api} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求15-51 |
| API-15-510 | 暂停租户 | 企业级功能 | PUT | /api/v1/tenants/{id}/suspend | tenant.admin | Path: id, Body: {reason} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求15-51 |
| API-15-511 | 恢复租户 | 企业级功能 | PUT | /api/v1/tenants/{id}/resume | tenant.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求15-51 |
| API-15-512 | 更新租户品牌定制 | 企业级功能 | PUT | /api/v1/tenants/{id}/branding | tenant.admin | Path: id, Body: {logo,theme,css} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求15-51 |
| API-15-513 | 更新租户功能开关 | 企业级功能 | PUT | /api/v1/tenants/{id}/features | tenant.admin | Path: id, Body: {features:{}} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求15-51 |
| API-15-514 | 备份租户数据 | 企业级功能 | POST | /api/v1/tenants/{id}/backup | tenant.admin | Path: id, Body: {type,destination} | {code:0,data:{backup_id}} | 200/400/401/403/404/500 | v1 | 否 | 否 | 张三 | 需求15-51 |
| API-15-515 | 恢复租户数据 | 企业级功能 | POST | /api/v1/tenants/{id}/restore | tenant.admin | Path: id, Body: {backup_id} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 张三 | 需求15-51 |
| API-15-516 | 获取云平台列表 | 企业级功能 | GET | /api/v1/cloud-providers | cloud.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求15-52 |
| API-15-517 | 获取云平台详情 | 企业级功能 | GET | /api/v1/cloud-providers/{id} | cloud.read | Path: id | {code:0,data:{id,name,type,status}} | 200/401/403/404/500 | v1 | 是 | 是 | 李四 | 需求15-52 |
| API-15-518 | 从云平台采集日志 | 企业级功能 | GET | /api/v1/cloud-providers/{id}/logs | cloud.read | Path: id, Query: start,end,query | {code:0,data:{logs:[]}} | 200/401/403/404/500 | v1 | 是 | 否 | 李四 | 需求15-52 |
| API-15-519 | 创建跨云同步规则 | 企业级功能 | POST | /api/v1/cloud-sync/rules | cloud.admin | Body: {name,source,dest,filter} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 李四 | 需求15-52 |
| API-15-520 | 获取同步规则列表 | 企业级功能 | GET | /api/v1/cloud-sync/rules | cloud.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求15-52 |
| API-15-521 | 更新同步规则 | 企业级功能 | PUT | /api/v1/cloud-sync/rules/{id} | cloud.admin | Path: id, Body: {filter,schedule} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 李四 | 需求15-52 |
| API-15-522 | 删除同步规则 | 企业级功能 | DELETE | /api/v1/cloud-sync/rules/{id} | cloud.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 李四 | 需求15-52 |
| API-15-523 | 获取同步状态 | 企业级功能 | GET | /api/v1/cloud-sync/status | cloud.read | Query: rule_id | {code:0,data:{status,synced,failed}} | 200/401/403/500 | v1 | 是 | 否 | 李四 | 需求15-52 |
| API-15-524 | 获取云平台健康状态 | 企业级功能 | GET | /api/v1/cloud-health | cloud.read | 无 | {code:0,data:{providers:[]}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求15-52 |
| API-15-525 | 获取跨云成本对比 | 企业级功能 | GET | /api/v1/cloud-costs | cloud.read | Query: period | {code:0,data:{comparison:{}}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求15-52 |
| API-15-526 | 获取跨云拓扑视图 | 企业级功能 | GET | /api/v1/cloud-topology | cloud.read | 无 | {code:0,data:{nodes:[],edges:[]}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求15-52 |
| API-15-527 | 获取Kubernetes Namespace列表 | 企业级功能 | GET | /api/v1/kubernetes/namespaces | k8s.read | Query: cluster | {code:0,data:{items:[]}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求15-53 |
| API-15-528 | 获取Pod列表 | 企业级功能 | GET | /api/v1/kubernetes/pods | k8s.read | Query: namespace,labels | {code:0,data:{items:[]}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求15-53 |
| API-15-529 | 获取Pod日志 | 企业级功能 | GET | /api/v1/kubernetes/pods/{name}/logs | k8s.read | Path: name, Query: container,tail | {code:0,data:{logs:[]}} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求15-53 |
| API-15-530 | 创建日志采集规则(CRD) | 企业级功能 | POST | /api/v1/kubernetes/collection-rules | k8s.admin | Body: {name,selector,collection} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 王五 | 需求15-53 |
| API-15-531 | 获取采集规则列表 | 企业级功能 | GET | /api/v1/kubernetes/collection-rules | k8s.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求15-53 |
| API-15-532 | 更新采集规则 | 企业级功能 | PUT | /api/v1/kubernetes/collection-rules/{id} | k8s.admin | Path: id, Body: {selector,config} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求15-53 |
| API-15-533 | 删除采集规则 | 企业级功能 | DELETE | /api/v1/kubernetes/collection-rules/{id} | k8s.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求15-53 |
| API-15-534 | 获取Service Mesh日志 | 企业级功能 | GET | /api/v1/kubernetes/service-mesh/logs | k8s.read | Query: service,start,end | {code:0,data:{logs:[]}} | 200/401/403/500 | v1 | 是 | 否 | 王五 | 需求15-53 |
| API-15-535 | 获取集群视图 | 企业级功能 | GET | /api/v1/kubernetes/cluster-view | k8s.read | Query: cluster | {code:0,data:{namespaces:[],pods:[]}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求15-53 |
| API-15-536 | 获取IoT设备列表 | 企业级功能 | GET | /api/v1/iot/devices | iot.read | Query: page,size,status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求15-54 |
| API-15-537 | 获取设备详情 | 企业级功能 | GET | /api/v1/iot/devices/{id} | iot.read | Path: id | {code:0,data:{id,name,status,health}} | 200/401/403/404/500 | v1 | 是 | 是 | 赵六 | 需求15-54 |
| API-15-538 | 更新设备配置 | 企业级功能 | PUT | /api/v1/iot/devices/{id} | iot.admin | Path: id, Body: {config} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求15-54 |
| API-15-539 | 删除设备 | 企业级功能 | DELETE | /api/v1/iot/devices/{id} | iot.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求15-54 |
| API-15-540 | 手动触发设备发现 | 企业级功能 | POST | /api/v1/iot/devices/discover | iot.admin | Body: {protocol,network} | {code:0,data:{discovered:[]}} | 200/400/401/403/500 | v1 | 否 | 否 | 赵六 | 需求15-54 |
| API-15-541 | 配置设备 | 企业级功能 | POST | /api/v1/iot/devices/{id}/provision | iot.admin | Path: id, Body: {template,params} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 赵六 | 需求15-54 |
| API-15-542 | 获取设备健康状态 | 企业级功能 | GET | /api/v1/iot/devices/{id}/health | iot.read | Path: id | {code:0,data:{score,uptime,issues}} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求15-54 |
| API-15-543 | 获取设备日志 | 企业级功能 | GET | /api/v1/iot/devices/{id}/logs | iot.read | Path: id, Query: start,end,level | {code:0,data:{logs:[]}} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求15-54 |
| API-15-544 | 创建设备分组 | 企业级功能 | POST | /api/v1/iot/groups | iot.admin | Body: {name,type,devices} | {code:0,data:{group_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 赵六 | 需求15-54 |
| API-15-545 | 获取设备分组列表 | 企业级功能 | GET | /api/v1/iot/groups | iot.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求15-54 |
| API-15-546 | 更新设备分组 | 企业级功能 | PUT | /api/v1/iot/groups/{id} | iot.admin | Path: id, Body: {name,devices} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求15-54 |
| API-15-547 | 删除设备分组 | 企业级功能 | DELETE | /api/v1/iot/groups/{id} | iot.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求15-54 |
| API-15-548 | 获取设备拓扑视图 | 企业级功能 | GET | /api/v1/iot/topology | iot.read | Query: group_id | {code:0,data:{nodes:[],edges:[]}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求15-54 |
| API-15-549 | 获取边缘节点缓存状态 | 企业级功能 | GET | /api/v1/iot/edge-nodes/{id}/cache | iot.read | Path: id | {code:0,data:{size,count,oldest}} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求15-54 |
| API-15-550 | 同步边缘节点缓存 | 企业级功能 | POST | /api/v1/iot/edge-nodes/{id}/sync | iot.admin | Path: id | {code:0,data:{synced,failed}} | 200/401/403/404/500 | v1 | 否 | 否 | 赵六 | 需求15-54 |
| API-15-551 | 获取成本仪表盘数据 | 企业级功能 | GET | /api/v1/costs/dashboard | cost.read | Query: period | {code:0,data:{total,breakdown}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求15-55 |
| API-15-552 | 获取成本分类明细 | 企业级功能 | GET | /api/v1/costs/breakdown | cost.read | Query: period,dimension | {code:0,data:{storage,compute,network}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求15-55 |
| API-15-553 | 获取成本分摊数据 | 企业级功能 | GET | /api/v1/costs/allocation | cost.read | Query: period,dimension | {code:0,data:{allocations:{}}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求15-55 |
| API-15-554 | 创建成本分摊规则 | 企业级功能 | POST | /api/v1/costs/allocation/rules | cost.admin | Body: {dimension,method,weights} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求15-55 |
| API-15-555 | 获取分摊规则列表 | 企业级功能 | GET | /api/v1/costs/allocation/rules | cost.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求15-55 |
| API-15-556 | 更新分摊规则 | 企业级功能 | PUT | /api/v1/costs/allocation/rules/{id} | cost.admin | Path: id, Body: {method,weights} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求15-55 |
| API-15-557 | 删除分摊规则 | 企业级功能 | DELETE | /api/v1/costs/allocation/rules/{id} | cost.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求15-55 |
| API-15-558 | 获取成本优化机会 | 企业级功能 | GET | /api/v1/costs/opportunities | cost.read | Query: period | {code:0,data:{opportunities:[]}} | 200/401/403/500 | v1 | 是 | 否 | 孙七 | 需求15-55 |
| API-15-559 | 执行成本优化 | 企业级功能 | POST | /api/v1/costs/optimize | cost.admin | Body: {opportunity_id,action} | {code:0,data:{result}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求15-55 |
| API-15-560 | 创建预算 | 企业级功能 | POST | /api/v1/costs/budgets | cost.admin | Body: {name,period,amount,scope} | {code:0,data:{budget_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求15-55 |
| API-15-561 | 获取预算列表 | 企业级功能 | GET | /api/v1/costs/budgets | cost.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求15-55 |
| API-15-562 | 获取预算详情 | 企业级功能 | GET | /api/v1/costs/budgets/{id} | cost.read | Path: id | {code:0,data:{id,amount,spent,percent}} | 200/401/403/404/500 | v1 | 是 | 是 | 孙七 | 需求15-55 |
| API-15-563 | 更新预算 | 企业级功能 | PUT | /api/v1/costs/budgets/{id} | cost.admin | Path: id, Body: {amount,thresholds} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求15-55 |
| API-15-564 | 删除预算 | 企业级功能 | DELETE | /api/v1/costs/budgets/{id} | cost.admin | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求15-55 |
| API-15-565 | 获取成本预测 | 企业级功能 | GET | /api/v1/costs/forecast | cost.read | Query: months | {code:0,data:{forecast:[]}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求15-55 |
| API-15-566 | 生成成本报告 | 企业级功能 | POST | /api/v1/costs/reports | cost.read | Body: {period,format,sections} | {code:0,data:{report_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求15-55 |
| API-15-567 | 下载成本报告 | 企业级功能 | GET | /api/v1/costs/reports/{id} | cost.read | Path: id | 文件流 | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求15-55 |

**接口统计**:
- 总接口数: 65个
- 接口编号范围: API-15-503 至 API-15-567
- GET接口: 35个 (53.8%)
- POST接口: 16个 (24.6%)
- PUT接口: 11个 (16.9%)
- DELETE接口: 3个 (4.6%)

**接口分类**:
1. 多租户管理 (API-15-503 ~ API-15-515): 13个接口
2. 跨云管理 (API-15-516 ~ API-15-526): 11个接口
3. Kubernetes集成 (API-15-527 ~ API-15-535): 9个接口
4. IoT设备管理 (API-15-536 ~ API-15-550): 15个接口
5. 成本管理 (API-15-551 ~ API-15-567): 17个接口

---
