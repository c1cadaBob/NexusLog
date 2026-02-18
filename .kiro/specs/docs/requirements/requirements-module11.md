# 模块十一：自动化运维

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块十一：自动化运维 
> **需求编号**: 

---

**模块概述**

自动化运维模块通过自动化部署、配置管理、健康检查与自愈等功能，降低运维复杂度，提高系统可靠性。支持一键部署、滚动升级、配置热更新、自动故障恢复，实现 DevOps 最佳实践。

**核心能力**:
- 一键部署和滚动升级
- GitOps 自动化部署
- 集中配置管理和版本控制
- 配置热更新无需重启
- 多层次健康检查
- 自动故障检测和修复
- 完整的审计日志

**技术栈选型**

| 技术类别 | 技术选型 | 版本要求 | 用途说明 |
|---------|---------|---------|---------|
| 部署工具 | Helm | 3.13+ | Kubernetes 包管理 |
| GitOps | ArgoCD | 2.9+ | 声明式持续部署 |
| 基础设施即代码 | Terraform | 1.6+ | 基础设施管理 |
| 配置管理 | Ansible | 2.15+ | 配置自动化 |
| CI/CD | GitLab CI | 16.x | 持续集成与部署 |
| CI/CD | GitHub Actions | - | 持续集成与部署 |
| 健康检查 | Kubernetes Probes | - | 存活性和就绪性检查 |
| 监控告警 | Prometheus + Alertmanager | 2.48+ | 健康监控与告警 |
| 配置中心 | PostgreSQL + Redis | 15+ / 7+ | 配置存储与分发 |
| 版本控制 | Git | 2.x | 配置版本管理 |

**架构设计**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        自动化运维架构                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      GitOps 层                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Git Repo    │  │   ArgoCD     │  │   Webhook    │          │  │
│  │  │ (配置源)      │─▶│ (同步引擎)    │─▶│  (通知)      │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                 │                                      │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                      部署管理层                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  Helm Charts                                                │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ Collector│  │API Server│  │ Storage  │  │ Monitor  │  │ │  │
│  │  │  │  Chart   │  │  Chart   │  │  Chart   │  │  Chart   │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  部署策略                                                    │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ 滚动升级  │  │ 蓝绿部署  │  │ 金丝雀   │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      配置管理层                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  配置中心                                                    │ │  │
│  │  │  ┌──────────────────┐        ┌──────────────────┐         │ │  │
│  │  │  │   PostgreSQL     │◄──────►│      Redis       │         │ │  │
│  │  │  │  (版本化存储)     │        │   (实时分发)      │         │ │  │
│  │  │  └──────────────────┘        └──────────────────┘         │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  配置管理功能                                                │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ 版本控制  │  │ 变更审计  │  │ 热更新   │  │ 加密存储  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      健康检查与自愈层                              │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  健康检查                                                    │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ Liveness │  │ Readiness│  │  Startup │                │ │  │
│  │  │  │  Probe   │  │  Probe   │  │  Probe   │                │ │  │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                │ │  │
│  │  │       └─────────────┴─────────────┘                       │ │  │
│  │  │                     │                                      │ │  │
│  │  │          ┌──────────▼──────────┐                          │ │  │
│  │  │          │  Health Monitor     │                          │ │  │
│  │  │          │  (健康状态聚合)      │                          │ │  │
│  │  │          └──────────┬──────────┘                          │ │  │
│  │  └─────────────────────┼─────────────────────────────────────┘ │  │
│  │                        │                                        │  │
│  │  ┌─────────────────────▼─────────────────────────────────────┐ │  │
│  │  │  自愈引擎                                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │ │  │
│  │  │  │ 重启服务  │  │ 扩容副本  │  │ 清理缓存  │  │ 切换流量  │ │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      监控与告警层                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │  │
│  │  │  Prometheus  │  │ Alertmanager │  │   Grafana    │          │  │
│  │  │  (指标采集)   │─▶│  (告警路由)   │─▶│  (可视化)    │          │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘          │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      审计日志层                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  审计日志记录                                                │ │  │
│  │  │  • 部署操作日志                                              │ │  │
│  │  │  • 配置变更日志                                              │ │  │
│  │  │  • 自愈操作日志                                              │ │  │
│  │  │  • 健康检查日志                                              │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:
1. **GitOps 层**: 使用 Git 作为配置源，ArgoCD 自动同步部署
2. **部署管理层**: Helm Charts 管理各组件，支持多种部署策略
3. **配置管理层**: PostgreSQL + Redis 实现配置版本控制和热更新
4. **健康检查层**: Kubernetes Probes + 自定义健康检查
5. **自愈层**: 自动检测问题并执行修复动作
6. **监控告警层**: Prometheus 监控，Alertmanager 告警
7. **审计层**: 记录所有运维操作的审计日志

**需求详情**

#### 需求 11-35: 自动化部署 [MVP]

**用户故事**:
作为运维工程师，我希望能够自动化部署和升级系统，以便降低部署复杂度和人为错误。

**验收标准**:

1. THE System SHALL 支持一键部署整个日志管理系统，部署时间 < 10 分钟
2. THE System SHALL 支持滚动升级，零停机时间，升级期间服务可用性 >= 99%
3. WHEN 部署失败时，THE System SHALL 在 5 分钟内自动回滚到上一个稳定版本
4. THE UI SHALL 提供部署状态仪表盘，实时显示部署进度和各组件状态
5. THE System SHALL 支持至少 3 种环境部署（开发、测试、生产），环境配置隔离
6. THE System SHALL 支持蓝绿部署和金丝雀发布两种高级部署策略
7. THE System SHALL 在部署前自动验证配置文件的正确性，验证失败时阻止部署
8. THE System SHALL 记录所有部署操作的审计日志，保留期至少 1 年
9. THE System SHALL 支持部署前后的自动化测试，测试失败时自动回滚
10. THE System SHALL 通过配置中心管理部署配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/automation/deployment/manager.go
package deployment

import (
    "context"
    "time"
)

// 部署管理器
type DeploymentManager struct {
    config         *DeploymentConfig
    helmClient     *HelmClient
    argocdClient   *ArgocdClient
    validator      *ConfigValidator
    testRunner     *AutomatedTestRunner
    rollbackManager *RollbackManager
    auditLogger    *AuditLogger
}

// 部署配置
type DeploymentConfig struct {
    Enabled          bool
    Strategy         DeploymentStrategy
    Environment      string
    Namespace        string
    Timeout          time.Duration
    HealthCheckDelay time.Duration
    AutoRollback     bool
    PreDeployTests   []string
    PostDeployTests  []string
}

// 部署策略
type DeploymentStrategy string

const (
    StrategyRolling    DeploymentStrategy = "rolling"     // 滚动升级
    StrategyBlueGreen  DeploymentStrategy = "blue_green"  // 蓝绿部署
    StrategyCanary     DeploymentStrategy = "canary"      // 金丝雀发布
    StrategyRecreate   DeploymentStrategy = "recreate"    // 重建部署
)

// 部署请求
type DeploymentRequest struct {
    ID          string
    Version     string
    Strategy    DeploymentStrategy
    Environment string
    Components  []string
    Config      map[string]interface{}
    DryRun      bool
}

// 部署响应
type DeploymentResponse struct {
    ID          string
    Status      DeploymentStatus
    StartTime   time.Time
    EndTime     time.Time
    Duration    time.Duration
    Components  []*ComponentStatus
    Logs        []string
    Error       string
}

// 部署状态
type DeploymentStatus string

const (
    StatusPending    DeploymentStatus = "pending"
    StatusValidating DeploymentStatus = "validating"
    StatusDeploying  DeploymentStatus = "deploying"
    StatusTesting    DeploymentStatus = "testing"
    StatusCompleted  DeploymentStatus = "completed"
    StatusFailed     DeploymentStatus = "failed"
    StatusRollingBack DeploymentStatus = "rolling_back"
    StatusRolledBack DeploymentStatus = "rolled_back"
)

// 组件状态
type ComponentStatus struct {
    Name      string
    Status    string
    Replicas  int
    Ready     int
    Message   string
}

// 创建部署管理器
func NewDeploymentManager(config *DeploymentConfig) (*DeploymentManager, error) {
    dm := &DeploymentManager{
        config: config,
    }
    
    // 初始化 Helm 客户端
    dm.helmClient = NewHelmClient()
    
    // 初始化 ArgoCD 客户端
    dm.argocdClient = NewArgocdClient()
    
    // 初始化配置验证器
    dm.validator = NewConfigValidator()
    
    // 初始化测试运行器
    dm.testRunner = NewAutomatedTestRunner()
    
    // 初始化回滚管理器
    dm.rollbackManager = NewRollbackManager()
    
    // 初始化审计日志记录器
    dm.auditLogger = NewAuditLogger()
    
    return dm, nil
}

// 执行部署
func (dm *DeploymentManager) Deploy(ctx context.Context, req *DeploymentRequest) (*DeploymentResponse, error) {
    startTime := time.Now()
    log.Infof("开始部署: version=%s, strategy=%s, env=%s", req.Version, req.Strategy, req.Environment)
    
    resp := &DeploymentResponse{
        ID:         req.ID,
        Status:     StatusPending,
        StartTime:  startTime,
        Components: []*ComponentStatus{},
        Logs:       []string{},
    }
    
    // 1. 验证配置
    resp.Status = StatusValidating
    resp.Logs = append(resp.Logs, "开始验证配置...")
    
    if err := dm.validator.Validate(req); err != nil {
        resp.Status = StatusFailed
        resp.Error = fmt.Sprintf("配置验证失败: %v", err)
        dm.auditLogger.Log(req, resp)
        return resp, err
    }
    resp.Logs = append(resp.Logs, "配置验证通过")
    
    // 2. 执行部署前测试
    if len(dm.config.PreDeployTests) > 0 {
        resp.Logs = append(resp.Logs, "开始执行部署前测试...")
        if err := dm.testRunner.RunTests(ctx, dm.config.PreDeployTests); err != nil {
            resp.Status = StatusFailed
            resp.Error = fmt.Sprintf("部署前测试失败: %v", err)
            dm.auditLogger.Log(req, resp)
            return resp, err
        }
        resp.Logs = append(resp.Logs, "部署前测试通过")
    }
    
    // 3. 执行部署
    resp.Status = StatusDeploying
    resp.Logs = append(resp.Logs, fmt.Sprintf("开始执行 %s 部署...", req.Strategy))
    
    var err error
    switch req.Strategy {
    case StrategyRolling:
        err = dm.deployRolling(ctx, req, resp)
    case StrategyBlueGreen:
        err = dm.deployBlueGreen(ctx, req, resp)
    case StrategyCanary:
        err = dm.deployCanary(ctx, req, resp)
    case StrategyRecreate:
        err = dm.deployRecreate(ctx, req, resp)
    default:
        err = fmt.Errorf("不支持的部署策略: %s", req.Strategy)
    }
    
    if err != nil {
        resp.Status = StatusFailed
        resp.Error = fmt.Sprintf("部署失败: %v", err)
        
        // 自动回滚
        if dm.config.AutoRollback {
            resp.Status = StatusRollingBack
            resp.Logs = append(resp.Logs, "开始自动回滚...")
            if rollbackErr := dm.rollbackManager.Rollback(ctx, req); rollbackErr != nil {
                resp.Logs = append(resp.Logs, fmt.Sprintf("回滚失败: %v", rollbackErr))
            } else {
                resp.Status = StatusRolledBack
                resp.Logs = append(resp.Logs, "回滚成功")
            }
        }
        
        dm.auditLogger.Log(req, resp)
        return resp, err
    }
    
    resp.Logs = append(resp.Logs, "部署完成")
    
    // 4. 等待健康检查
    resp.Logs = append(resp.Logs, "等待健康检查...")
    time.Sleep(dm.config.HealthCheckDelay)
    
    if err := dm.waitForHealthy(ctx, req); err != nil {
        resp.Status = StatusFailed
        resp.Error = fmt.Sprintf("健康检查失败: %v", err)
        
        // 自动回滚
        if dm.config.AutoRollback {
            resp.Status = StatusRollingBack
            resp.Logs = append(resp.Logs, "健康检查失败，开始自动回滚...")
            dm.rollbackManager.Rollback(ctx, req)
            resp.Status = StatusRolledBack
        }
        
        dm.auditLogger.Log(req, resp)
        return resp, err
    }
    resp.Logs = append(resp.Logs, "健康检查通过")
    
    // 5. 执行部署后测试
    if len(dm.config.PostDeployTests) > 0 {
        resp.Status = StatusTesting
        resp.Logs = append(resp.Logs, "开始执行部署后测试...")
        
        if err := dm.testRunner.RunTests(ctx, dm.config.PostDeployTests); err != nil {
            resp.Status = StatusFailed
            resp.Error = fmt.Sprintf("部署后测试失败: %v", err)
            
            // 自动回滚
            if dm.config.AutoRollback {
                resp.Status = StatusRollingBack
                resp.Logs = append(resp.Logs, "测试失败，开始自动回滚...")
                dm.rollbackManager.Rollback(ctx, req)
                resp.Status = StatusRolledBack
            }
            
            dm.auditLogger.Log(req, resp)
            return resp, err
        }
        resp.Logs = append(resp.Logs, "部署后测试通过")
    }
    
    // 6. 部署成功
    resp.Status = StatusCompleted
    resp.EndTime = time.Now()
    resp.Duration = resp.EndTime.Sub(resp.StartTime)
    resp.Logs = append(resp.Logs, fmt.Sprintf("部署成功完成，耗时: %v", resp.Duration))
    
    // 记录审计日志
    dm.auditLogger.Log(req, resp)
    
    log.Infof("部署完成: version=%s, duration=%v", req.Version, resp.Duration)
    return resp, nil
}


// 滚动升级部署
func (dm *DeploymentManager) deployRolling(ctx context.Context, req *DeploymentRequest, resp *DeploymentResponse) error {
    log.Info("执行滚动升级部署")
    
    for _, component := range req.Components {
        resp.Logs = append(resp.Logs, fmt.Sprintf("升级组件: %s", component))
        
        // 使用 Helm 升级
        if err := dm.helmClient.Upgrade(ctx, component, req.Version, req.Config); err != nil {
            return fmt.Errorf("升级组件 %s 失败: %w", component, err)
        }
        
        // 等待组件就绪
        if err := dm.waitForComponentReady(ctx, component); err != nil {
            return fmt.Errorf("组件 %s 未就绪: %w", component, err)
        }
        
        resp.Components = append(resp.Components, &ComponentStatus{
            Name:   component,
            Status: "ready",
        })
        
        resp.Logs = append(resp.Logs, fmt.Sprintf("组件 %s 升级完成", component))
    }
    
    return nil
}

// 蓝绿部署
func (dm *DeploymentManager) deployBlueGreen(ctx context.Context, req *DeploymentRequest, resp *DeploymentResponse) error {
    log.Info("执行蓝绿部署")
    
    // 1. 部署绿色环境（新版本）
    resp.Logs = append(resp.Logs, "部署绿色环境...")
    greenEnv := fmt.Sprintf("%s-green", req.Environment)
    
    for _, component := range req.Components {
        if err := dm.helmClient.Install(ctx, component, req.Version, greenEnv, req.Config); err != nil {
            return fmt.Errorf("部署绿色环境失败: %w", err)
        }
    }
    
    // 2. 等待绿色环境就绪
    resp.Logs = append(resp.Logs, "等待绿色环境就绪...")
    if err := dm.waitForEnvironmentReady(ctx, greenEnv); err != nil {
        return fmt.Errorf("绿色环境未就绪: %w", err)
    }
    
    // 3. 切换流量到绿色环境
    resp.Logs = append(resp.Logs, "切换流量到绿色环境...")
    if err := dm.switchTraffic(ctx, req.Environment, greenEnv); err != nil {
        return fmt.Errorf("切换流量失败: %w", err)
    }
    
    // 4. 删除蓝色环境（旧版本）
    resp.Logs = append(resp.Logs, "删除蓝色环境...")
    blueEnv := fmt.Sprintf("%s-blue", req.Environment)
    dm.helmClient.Uninstall(ctx, blueEnv)
    
    // 5. 重命名绿色环境为蓝色环境
    resp.Logs = append(resp.Logs, "重命名环境...")
    dm.renameEnvironment(ctx, greenEnv, blueEnv)
    
    return nil
}

// 金丝雀发布
func (dm *DeploymentManager) deployCanary(ctx context.Context, req *DeploymentRequest, resp *DeploymentResponse) error {
    log.Info("执行金丝雀发布")
    
    // 1. 部署金丝雀版本（10% 流量）
    resp.Logs = append(resp.Logs, "部署金丝雀版本（10% 流量）...")
    canaryEnv := fmt.Sprintf("%s-canary", req.Environment)
    
    for _, component := range req.Components {
        if err := dm.helmClient.Install(ctx, component, req.Version, canaryEnv, req.Config); err != nil {
            return fmt.Errorf("部署金丝雀版本失败: %w", err)
        }
    }
    
    // 2. 切换 10% 流量到金丝雀
    resp.Logs = append(resp.Logs, "切换 10% 流量到金丝雀...")
    if err := dm.switchTrafficPercentage(ctx, req.Environment, canaryEnv, 10); err != nil {
        return fmt.Errorf("切换流量失败: %w", err)
    }
    
    // 3. 监控金丝雀指标（5 分钟）
    resp.Logs = append(resp.Logs, "监控金丝雀指标...")
    if err := dm.monitorCanary(ctx, canaryEnv, 5*time.Minute); err != nil {
        return fmt.Errorf("金丝雀监控失败: %w", err)
    }
    
    // 4. 逐步增加流量（50%）
    resp.Logs = append(resp.Logs, "增加流量到 50%...")
    if err := dm.switchTrafficPercentage(ctx, req.Environment, canaryEnv, 50); err != nil {
        return fmt.Errorf("切换流量失败: %w", err)
    }
    
    // 5. 继续监控（5 分钟）
    if err := dm.monitorCanary(ctx, canaryEnv, 5*time.Minute); err != nil {
        return fmt.Errorf("金丝雀监控失败: %w", err)
    }
    
    // 6. 切换全部流量（100%）
    resp.Logs = append(resp.Logs, "切换全部流量到新版本...")
    if err := dm.switchTrafficPercentage(ctx, req.Environment, canaryEnv, 100); err != nil {
        return fmt.Errorf("切换流量失败: %w", err)
    }
    
    // 7. 删除旧版本
    resp.Logs = append(resp.Logs, "删除旧版本...")
    dm.helmClient.Uninstall(ctx, req.Environment)
    
    // 8. 重命名金丝雀为正式环境
    dm.renameEnvironment(ctx, canaryEnv, req.Environment)
    
    return nil
}

// 配置验证器
type ConfigValidator struct {
    rules []ValidationRule
}

// 验证配置
func (cv *ConfigValidator) Validate(req *DeploymentRequest) error {
    // 验证版本号
    if req.Version == "" {
        return fmt.Errorf("版本号不能为空")
    }
    
    // 验证环境
    validEnvs := []string{"dev", "test", "prod"}
    if !contains(validEnvs, req.Environment) {
        return fmt.Errorf("无效的环境: %s", req.Environment)
    }
    
    // 验证组件
    if len(req.Components) == 0 {
        return fmt.Errorf("至少需要指定一个组件")
    }
    
    // 验证配置
    for key, value := range req.Config {
        if err := cv.validateConfigItem(key, value); err != nil {
            return fmt.Errorf("配置项 %s 验证失败: %w", key, err)
        }
    }
    
    return nil
}

// 回滚管理器
type RollbackManager struct {
    historyStore *DeploymentHistoryStore
}

// 回滚部署
func (rm *RollbackManager) Rollback(ctx context.Context, req *DeploymentRequest) error {
    log.Infof("开始回滚部署: env=%s", req.Environment)
    
    // 获取上一个稳定版本
    lastStable := rm.historyStore.GetLastStable(req.Environment)
    if lastStable == nil {
        return fmt.Errorf("未找到可回滚的版本")
    }
    
    log.Infof("回滚到版本: %s", lastStable.Version)
    
    // 创建回滚请求
    rollbackReq := &DeploymentRequest{
        ID:          generateID(),
        Version:     lastStable.Version,
        Strategy:    StrategyRolling,
        Environment: req.Environment,
        Components:  req.Components,
        Config:      lastStable.Config,
    }
    
    // 执行回滚部署
    dm := &DeploymentManager{}
    _, err := dm.Deploy(ctx, rollbackReq)
    
    return err
}
```

**关键实现点**:

1. 使用 Helm Charts 实现一键部署，部署时间 < 10 分钟
2. 支持滚动升级、蓝绿部署、金丝雀发布三种部署策略
3. 自动回滚机制：部署失败、健康检查失败、测试失败时自动回滚
4. 部署前配置验证，确保配置正确性
5. 支持部署前后自动化测试，测试失败时阻止部署或触发回滚
6. 完整的部署状态跟踪和日志记录
7. 审计日志记录所有部署操作，保留期 1 年

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| deployment_enabled | bool | true | 是否启用自动化部署 |
| strategy | string | "rolling" | 默认部署策略 |
| timeout | int | 600 | 部署超时时间（秒） |
| health_check_delay | int | 30 | 健康检查延迟（秒） |
| auto_rollback | bool | true | 是否自动回滚 |
| pre_deploy_tests | array | [] | 部署前测试列表 |
| post_deploy_tests | array | [] | 部署后测试列表 |
| canary_traffic_steps | array | [10,50,100] | 金丝雀流量步骤（%） |
| canary_monitor_duration | int | 300 | 金丝雀监控时长（秒） |
| rollback_timeout | int | 300 | 回滚超时时间（秒） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下次部署生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的部署策略
2. WHEN 测试列表变更时，THE System SHALL 在下次部署时生效
3. THE System SHALL 支持通过 API 查询当前生效的部署配置
4. THE System SHALL 记录所有部署配置变更的审计日志
5. WHEN 超时时间变更时，THE System SHALL 验证配置的合理性（>= 60 秒）

---


#### 需求 11-36: 配置管理 [MVP]

**用户故事**:
作为运维工程师，我希望集中管理系统配置，以便统一管理、版本控制和快速回滚配置变更。

**验收标准**:

1. THE System SHALL 支持配置版本管理，保留至少 100 个历史版本
2. THE System SHALL 记录所有配置变更的审计日志，包含变更人、时间、内容、原因
3. THE System SHALL 支持配置热更新，配置变更后 10 秒内生效，无需重启服务
4. THE System SHALL 支持配置模板和环境变量，支持至少 5 种环境（dev/test/staging/prod/dr）
5. THE System SHALL 支持配置加密存储，使用 AES-256-GCM 加密敏感配置
6. THE System SHALL 支持配置导入导出，支持 JSON、YAML、TOML 三种格式
7. THE System SHALL 支持配置对比和差异分析，可对比任意两个版本的差异
8. THE System SHALL 在配置变更前进行语法和语义验证，验证失败时阻止变更
9. THE System SHALL 支持配置回滚，可回滚到任意历史版本，回滚时间 < 30 秒
10. THE System SHALL 通过配置中心（PostgreSQL + Redis）管理所有配置，支持热更新

**实现方向**:

**实现方式**:

```go
// internal/automation/config/manager.go
package config

import (
    "context"
    "crypto/aes"
    "crypto/cipher"
    "encoding/json"
    "time"
)

// 配置管理器
type ConfigManager struct {
    config         *ManagerConfig
    store          *ConfigStore
    versionControl *VersionControl
    validator      *ConfigValidator
    encryptor      *ConfigEncryptor
    distributor    *ConfigDistributor
    auditLogger    *AuditLogger
}

// 管理器配置
type ManagerConfig struct {
    Enabled           bool
    MaxVersions       int
    EncryptionEnabled bool
    EncryptionKey     []byte
    HotReloadEnabled  bool
    ValidationEnabled bool
}

// 配置项
type ConfigItem struct {
    ID          string
    Key         string
    Value       interface{}
    Environment string
    Version     int
    Encrypted   bool
    CreatedAt   time.Time
    CreatedBy   string
    UpdatedAt   time.Time
    UpdatedBy   string
    Description string
    Tags        []string
}

// 配置版本
type ConfigVersion struct {
    Version     int
    Timestamp   time.Time
    Author      string
    Message     string
    Changes     []*ConfigChange
    Checksum    string
}

// 配置变更
type ConfigChange struct {
    Type     ChangeType
    Key      string
    OldValue interface{}
    NewValue interface{}
}

// 变更类型
type ChangeType string

const (
    ChangeTypeAdd    ChangeType = "add"
    ChangeTypeUpdate ChangeType = "update"
    ChangeTypeDelete ChangeType = "delete"
)

// 创建配置管理器
func NewConfigManager(config *ManagerConfig) (*ConfigManager, error) {
    cm := &ConfigManager{
        config: config,
    }
    
    // 初始化配置存储（PostgreSQL）
    cm.store = NewConfigStore()
    
    // 初始化版本控制
    cm.versionControl = NewVersionControl(config.MaxVersions)
    
    // 初始化配置验证器
    if config.ValidationEnabled {
        cm.validator = NewConfigValidator()
    }
    
    // 初始化配置加密器
    if config.EncryptionEnabled {
        cm.encryptor = NewConfigEncryptor(config.EncryptionKey)
    }
    
    // 初始化配置分发器（Redis Pub/Sub）
    if config.HotReloadEnabled {
        cm.distributor = NewConfigDistributor()
    }
    
    // 初始化审计日志记录器
    cm.auditLogger = NewAuditLogger()
    
    return cm, nil
}

// 获取配置
func (cm *ConfigManager) Get(ctx context.Context, key string, environment string) (*ConfigItem, error) {
    // 从存储获取配置
    item, err := cm.store.Get(ctx, key, environment)
    if err != nil {
        return nil, err
    }
    
    // 解密（如果需要）
    if item.Encrypted && cm.config.EncryptionEnabled {
        decrypted, err := cm.encryptor.Decrypt(item.Value.(string))
        if err != nil {
            return nil, fmt.Errorf("解密配置失败: %w", err)
        }
        item.Value = decrypted
    }
    
    return item, nil
}

// 设置配置
func (cm *ConfigManager) Set(ctx context.Context, item *ConfigItem) error {
    log.Infof("设置配置: key=%s, env=%s", item.Key, item.Environment)
    
    // 1. 验证配置
    if cm.config.ValidationEnabled {
        if err := cm.validator.Validate(item); err != nil {
            return fmt.Errorf("配置验证失败: %w", err)
        }
    }
    
    // 2. 获取旧配置（用于版本控制）
    oldItem, _ := cm.store.Get(ctx, item.Key, item.Environment)
    
    // 3. 加密（如果需要）
    if item.Encrypted && cm.config.EncryptionEnabled {
        encrypted, err := cm.encryptor.Encrypt(item.Value.(string))
        if err != nil {
            return fmt.Errorf("加密配置失败: %w", err)
        }
        item.Value = encrypted
    }
    
    // 4. 保存配置到 PostgreSQL
    if err := cm.store.Set(ctx, item); err != nil {
        return fmt.Errorf("保存配置失败: %w", err)
    }
    
    // 5. 创建版本记录
    change := &ConfigChange{
        Key:      item.Key,
        NewValue: item.Value,
    }
    
    if oldItem != nil {
        change.Type = ChangeTypeUpdate
        change.OldValue = oldItem.Value
    } else {
        change.Type = ChangeTypeAdd
    }
    
    version := &ConfigVersion{
        Version:   cm.versionControl.GetNextVersion(),
        Timestamp: time.Now(),
        Author:    item.UpdatedBy,
        Message:   fmt.Sprintf("更新配置: %s", item.Key),
        Changes:   []*ConfigChange{change},
    }
    
    if err := cm.versionControl.Save(version); err != nil {
        log.Errorf("保存版本失败: %v", err)
    }
    
    // 6. 分发配置变更（Redis Pub/Sub）
    if cm.config.HotReloadEnabled {
        if err := cm.distributor.Publish(ctx, item); err != nil {
            log.Errorf("分发配置失败: %v", err)
        }
    }
    
    // 7. 记录审计日志
    cm.auditLogger.LogConfigChange(item, oldItem)
    
    log.Infof("配置设置成功: key=%s", item.Key)
    return nil
}

// 删除配置
func (cm *ConfigManager) Delete(ctx context.Context, key string, environment string) error {
    log.Infof("删除配置: key=%s, env=%s", key, environment)
    
    // 获取旧配置
    oldItem, err := cm.store.Get(ctx, key, environment)
    if err != nil {
        return err
    }
    
    // 删除配置
    if err := cm.store.Delete(ctx, key, environment); err != nil {
        return err
    }
    
    // 创建版本记录
    change := &ConfigChange{
        Type:     ChangeTypeDelete,
        Key:      key,
        OldValue: oldItem.Value,
    }
    
    version := &ConfigVersion{
        Version:   cm.versionControl.GetNextVersion(),
        Timestamp: time.Now(),
        Message:   fmt.Sprintf("删除配置: %s", key),
        Changes:   []*ConfigChange{change},
    }
    
    cm.versionControl.Save(version)
    
    // 分发配置变更
    if cm.config.HotReloadEnabled {
        cm.distributor.PublishDelete(ctx, key, environment)
    }
    
    // 记录审计日志
    cm.auditLogger.LogConfigDelete(oldItem)
    
    return nil
}

// 配置对比
func (cm *ConfigManager) Compare(ctx context.Context, version1, version2 int) ([]*ConfigChange, error) {
    log.Infof("对比配置版本: v%d vs v%d", version1, version2)
    
    // 获取两个版本的配置
    v1, err := cm.versionControl.GetVersion(version1)
    if err != nil {
        return nil, fmt.Errorf("获取版本 %d 失败: %w", version1, err)
    }
    
    v2, err := cm.versionControl.GetVersion(version2)
    if err != nil {
        return nil, fmt.Errorf("获取版本 %d 失败: %w", version2, err)
    }
    
    // 对比配置
    changes := []*ConfigChange{}
    
    // 构建配置映射
    v1Configs := make(map[string]interface{})
    v2Configs := make(map[string]interface{})
    
    for _, change := range v1.Changes {
        v1Configs[change.Key] = change.NewValue
    }
    
    for _, change := range v2.Changes {
        v2Configs[change.Key] = change.NewValue
    }
    
    // 查找新增和修改的配置
    for key, v2Value := range v2Configs {
        if v1Value, exists := v1Configs[key]; exists {
            if !reflect.DeepEqual(v1Value, v2Value) {
                changes = append(changes, &ConfigChange{
                    Type:     ChangeTypeUpdate,
                    Key:      key,
                    OldValue: v1Value,
                    NewValue: v2Value,
                })
            }
        } else {
            changes = append(changes, &ConfigChange{
                Type:     ChangeTypeAdd,
                Key:      key,
                NewValue: v2Value,
            })
        }
    }
    
    // 查找删除的配置
    for key, v1Value := range v1Configs {
        if _, exists := v2Configs[key]; !exists {
            changes = append(changes, &ConfigChange{
                Type:     ChangeTypeDelete,
                Key:      key,
                OldValue: v1Value,
            })
        }
    }
    
    return changes, nil
}

// 导出配置
func (cm *ConfigManager) Export(ctx context.Context, environment string, format string) ([]byte, error) {
    log.Infof("导出配置: env=%s, format=%s", environment, format)
    
    // 获取所有配置
    items, err := cm.store.GetAll(ctx, environment)
    if err != nil {
        return nil, err
    }
    
    // 解密配置
    for _, item := range items {
        if item.Encrypted && cm.config.EncryptionEnabled {
            decrypted, err := cm.encryptor.Decrypt(item.Value.(string))
            if err != nil {
                log.Errorf("解密配置失败: key=%s, err=%v", item.Key, err)
                continue
            }
            item.Value = decrypted
        }
    }

    
    // 根据格式导出
    var data []byte
    switch format {
    case "json":
        data, err = json.MarshalIndent(items, "", "  ")
    case "yaml":
        data, err = yaml.Marshal(items)
    case "toml":
        data, err = toml.Marshal(items)
    default:
        return nil, fmt.Errorf("不支持的格式: %s", format)
    }
    
    if err != nil {
        return nil, fmt.Errorf("序列化配置失败: %w", err)
    }
    
    // 记录审计日志
    cm.auditLogger.LogConfigExport(environment, format)
    
    return data, nil
}

// 导入配置
func (cm *ConfigManager) Import(ctx context.Context, environment string, format string, data []byte) error {
    log.Infof("导入配置: env=%s, format=%s", environment, format)
    
    // 解析配置
    var items []*ConfigItem
    var err error
    
    switch format {
    case "json":
        err = json.Unmarshal(data, &items)
    case "yaml":
        err = yaml.Unmarshal(data, &items)
    case "toml":
        err = toml.Unmarshal(data, &items)
    default:
        return fmt.Errorf("不支持的格式: %s", format)
    }
    
    if err != nil {
        return fmt.Errorf("解析配置失败: %w", err)
    }
    
    // 验证配置
    if cm.config.ValidationEnabled {
        for _, item := range items {
            if err := cm.validator.Validate(item); err != nil {
                return fmt.Errorf("配置验证失败: key=%s, err=%w", item.Key, err)
            }
        }
    }
    
    // 导入配置
    for _, item := range items {
        item.Environment = environment
        if err := cm.Set(ctx, item); err != nil {
            log.Errorf("导入配置失败: key=%s, err=%v", item.Key, err)
        }
    }
    
    // 记录审计日志
    cm.auditLogger.LogConfigImport(environment, format, len(items))
    
    return nil
}


// 回滚配置
func (cm *ConfigManager) Rollback(ctx context.Context, environment string, version int) error {
    log.Infof("回滚配置: env=%s, version=%d", environment, version)
    
    startTime := time.Now()
    
    // 获取目标版本
    targetVersion, err := cm.versionControl.GetVersion(version)
    if err != nil {
        return fmt.Errorf("获取版本失败: %w", err)
    }
    
    // 应用配置变更
    for _, change := range targetVersion.Changes {
        item := &ConfigItem{
            Key:         change.Key,
            Value:       change.NewValue,
            Environment: environment,
            UpdatedBy:   "system",
            UpdatedAt:   time.Now(),
        }
        
        switch change.Type {
        case ChangeTypeAdd, ChangeTypeUpdate:
            if err := cm.Set(ctx, item); err != nil {
                log.Errorf("回滚配置失败: key=%s, err=%v", change.Key, err)
            }
        case ChangeTypeDelete:
            if err := cm.Delete(ctx, change.Key, environment); err != nil {
                log.Errorf("删除配置失败: key=%s, err=%v", change.Key, err)
            }
        }
    }
    
    duration := time.Since(startTime)
    log.Infof("配置回滚完成: env=%s, version=%d, duration=%v", environment, version, duration)
    
    // 记录审计日志
    cm.auditLogger.LogConfigRollback(environment, version, duration)
    
    return nil
}

// 配置验证器
type ConfigValidator struct {
    rules map[string]ValidationRule
}

// 验证规则
type ValidationRule struct {
    Type     string
    Required bool
    Min      interface{}
    Max      interface{}
    Pattern  string
    Enum     []interface{}
}

// 创建配置验证器
func NewConfigValidator() *ConfigValidator {
    return &ConfigValidator{
        rules: make(map[string]ValidationRule),
    }
}

// 验证配置
func (cv *ConfigValidator) Validate(item *ConfigItem) error {
    // 验证键名
    if item.Key == "" {
        return fmt.Errorf("配置键名不能为空")
    }
    
    // 验证环境
    validEnvs := []string{"dev", "test", "staging", "prod", "dr"}
    if !contains(validEnvs, item.Environment) {
        return fmt.Errorf("无效的环境: %s", item.Environment)
    }

    
    // 获取验证规则
    rule, exists := cv.rules[item.Key]
    if !exists {
        return nil // 没有规则，跳过验证
    }
    
    // 验证必填
    if rule.Required && item.Value == nil {
        return fmt.Errorf("配置 %s 不能为空", item.Key)
    }
    
    // 验证类型
    if err := cv.validateType(item.Value, rule.Type); err != nil {
        return fmt.Errorf("配置 %s 类型错误: %w", item.Key, err)
    }
    
    // 验证范围
    if rule.Min != nil || rule.Max != nil {
        if err := cv.validateRange(item.Value, rule.Min, rule.Max); err != nil {
            return fmt.Errorf("配置 %s 范围错误: %w", item.Key, err)
        }
    }
    
    // 验证枚举
    if len(rule.Enum) > 0 {
        if !contains(rule.Enum, item.Value) {
            return fmt.Errorf("配置 %s 值必须是 %v 之一", item.Key, rule.Enum)
        }
    }
    
    // 验证正则表达式
    if rule.Pattern != "" {
        matched, err := regexp.MatchString(rule.Pattern, fmt.Sprint(item.Value))
        if err != nil || !matched {
            return fmt.Errorf("配置 %s 格式错误", item.Key)
        }
    }
    
    return nil
}

// 配置加密器
type ConfigEncryptor struct {
    key    []byte
    cipher cipher.AEAD
}

// 创建配置加密器
func NewConfigEncryptor(key []byte) *ConfigEncryptor {
    // 创建 AES-256-GCM 加密器
    block, err := aes.NewCipher(key)
    if err != nil {
        log.Fatalf("创建加密器失败: %v", err)
    }
    
    aesgcm, err := cipher.NewGCM(block)
    if err != nil {
        log.Fatalf("创建 GCM 失败: %v", err)
    }
    
    return &ConfigEncryptor{
        key:    key,
        cipher: aesgcm,
    }
}

// 加密配置
func (ce *ConfigEncryptor) Encrypt(plaintext string) (string, error) {
    // 生成随机 nonce
    nonce := make([]byte, ce.cipher.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    // 加密
    ciphertext := ce.cipher.Seal(nonce, nonce, []byte(plaintext), nil)
    
    // Base64 编码
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}


// 解密配置
func (ce *ConfigEncryptor) Decrypt(ciphertext string) (string, error) {
    // Base64 解码
    data, err := base64.StdEncoding.DecodeString(ciphertext)
    if err != nil {
        return "", err
    }
    
    // 提取 nonce
    nonceSize := ce.cipher.NonceSize()
    if len(data) < nonceSize {
        return "", fmt.Errorf("密文太短")
    }
    
    nonce, ciphertext := data[:nonceSize], data[nonceSize:]
    
    // 解密
    plaintext, err := ce.cipher.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }
    
    return string(plaintext), nil
}

// 配置分发器
type ConfigDistributor struct {
    redisClient *redis.Client
    pubsub      *redis.PubSub
}

// 创建配置分发器
func NewConfigDistributor() *ConfigDistributor {
    client := redis.NewClient(&redis.Options{
        Addr: "localhost:6379",
    })
    
    return &ConfigDistributor{
        redisClient: client,
    }
}

// 发布配置变更
func (cd *ConfigDistributor) Publish(ctx context.Context, item *ConfigItem) error {
    // 序列化配置
    data, err := json.Marshal(item)
    if err != nil {
        return err
    }
    
    // 发布到 Redis
    channel := fmt.Sprintf("config:%s", item.Environment)
    return cd.redisClient.Publish(ctx, channel, data).Err()
}

// 发布配置删除
func (cd *ConfigDistributor) PublishDelete(ctx context.Context, key string, environment string) error {
    message := map[string]string{
        "action": "delete",
        "key":    key,
    }
    
    data, err := json.Marshal(message)
    if err != nil {
        return err
    }
    
    channel := fmt.Sprintf("config:%s", environment)
    return cd.redisClient.Publish(ctx, channel, data).Err()
}

// 订阅配置变更
func (cd *ConfigDistributor) Subscribe(ctx context.Context, environment string, handler func(*ConfigItem)) error {
    channel := fmt.Sprintf("config:%s", environment)
    cd.pubsub = cd.redisClient.Subscribe(ctx, channel)
    
    // 监听消息
    go func() {
        for msg := range cd.pubsub.Channel() {
            var item ConfigItem
            if err := json.Unmarshal([]byte(msg.Payload), &item); err != nil {
                log.Errorf("解析配置失败: %v", err)
                continue
            }
            
            handler(&item)
        }
    }()
    
    return nil
}
```


**关键实现点**:

1. 使用 PostgreSQL 存储配置和版本历史，保留至少 100 个历史版本
2. 使用 Redis Pub/Sub 实现配置热更新，配置变更后 10 秒内生效
3. 使用 AES-256-GCM 加密敏感配置，确保配置安全
4. 支持配置版本控制、对比、回滚，回滚时间 < 30 秒
5. 支持 JSON、YAML、TOML 三种格式的配置导入导出
6. 配置变更前进行语法和语义验证，验证失败时阻止变更
7. 记录所有配置变更的审计日志，包含变更人、时间、内容、原因


**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| config_enabled | bool | true | 是否启用配置管理 |
| max_versions | int | 100 | 最大版本数 |
| encryption_enabled | bool | true | 是否启用加密 |
| hot_reload_enabled | bool | true | 是否启用热更新 |
| validation_enabled | bool | true | 是否启用验证 |
| export_formats | array | ["json","yaml","toml"] | 支持的导出格式 |
| rollback_timeout | int | 30 | 回滚超时时间（秒） |
| audit_retention_days | int | 365 | 审计日志保留天数 |
| redis_channel_prefix | string | "config" | Redis 频道前缀 |
| sync_interval | int | 10 | 配置同步间隔（秒） |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 10 秒内生效
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 10 秒内通过 Redis Pub/Sub 分发到所有节点
2. WHEN 配置验证失败时，THE System SHALL 保持原配置不变并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置和版本号
4. THE System SHALL 记录所有配置热更新的审计日志，包含生效时间和节点信息
5. WHEN 加密配置变更时，THE System SHALL 自动重新加密并分发到所有节点

---



#### 需求 11-37: 健康检查与自愈 [Phase 2]

**用户故事**:
作为运维工程师，我希望系统能够自动检测故障并自愈，以便减少人工干预，提高系统可用性。

**验收标准**:

1. THE System SHALL 支持多层次健康检查（存活性、就绪性、启动探针），检查间隔 <= 10 秒
2. THE System SHALL 在检测到服务不健康时，30 秒内自动执行修复动作
3. THE System SHALL 支持至少 5 种自愈策略（重启服务、扩容副本、清理缓存、切换流量、降级服务）
4. THE System SHALL 记录所有健康检查和自愈操作的日志，保留期至少 90 天
5. THE System SHALL 在自愈失败时发送告警通知，通知延迟 < 1 分钟
6. THE System SHALL 支持自定义健康检查规则，支持 HTTP、TCP、gRPC 三种协议
7. THE System SHALL 在连续 3 次健康检查失败后触发自愈，避免误判
8. THE System SHALL 支持自愈操作的熔断机制，防止频繁自愈导致系统不稳定
9. THE System SHALL 提供健康状态仪表盘，实时显示所有服务的健康状态
10. THE System SHALL 通过配置中心管理健康检查和自愈配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```go
// internal/automation/health/monitor.go
package health

import (
    "context"
    "net/http"
    "time"
)

// 健康监控器
type HealthMonitor struct {
    config      *MonitorConfig
    checkers    map[string]*HealthChecker
    healers     map[string]*SelfHealer
    circuitBreaker *CircuitBreaker
    alertManager *AlertManager
    auditLogger  *AuditLogger
}

// 监控配置
type MonitorConfig struct {
    Enabled           bool
    CheckInterval     time.Duration
    FailureThreshold  int
    SuccessThreshold  int
    Timeout           time.Duration
    CircuitBreakerEnabled bool
    AlertEnabled      bool
}

// 健康检查器
type HealthChecker struct {
    Name     string
    Type     CheckType
    Target   string
    Interval time.Duration
    Timeout  time.Duration
    Status   HealthStatus
    LastCheck time.Time
    FailureCount int
}

// 检查类型
type CheckType string

const (
    CheckTypeLiveness  CheckType = "liveness"   // 存活性检查
    CheckTypeReadiness CheckType = "readiness"  // 就绪性检查
    CheckTypeStartup   CheckType = "startup"    // 启动探针
)

// 健康状态
type HealthStatus string

const (
    StatusHealthy   HealthStatus = "healthy"
    StatusUnhealthy HealthStatus = "unhealthy"
    StatusUnknown   HealthStatus = "unknown"
)


// 自愈器
type SelfHealer struct {
    Name     string
    Strategy HealStrategy
    Enabled  bool
    MaxRetries int
    RetryCount int
    LastHeal time.Time
}

// 自愈策略
type HealStrategy string

const (
    StrategyRestart      HealStrategy = "restart"       // 重启服务
    StrategyScale        HealStrategy = "scale"         // 扩容副本
    StrategyClearCache   HealStrategy = "clear_cache"   // 清理缓存
    StrategySwitchTraffic HealStrategy = "switch_traffic" // 切换流量
    StrategyDegrade      HealStrategy = "degrade"       // 降级服务
)

// 健康检查结果
type HealthCheckResult struct {
    CheckerName string
    Status      HealthStatus
    Message     string
    Timestamp   time.Time
    Duration    time.Duration
}

// 自愈结果
type HealResult struct {
    HealerName string
    Strategy   HealStrategy
    Success    bool
    Message    string
    Timestamp  time.Time
    Duration   time.Duration
}

// 创建健康监控器
func NewHealthMonitor(config *MonitorConfig) (*HealthMonitor, error) {
    hm := &HealthMonitor{
        config:   config,
        checkers: make(map[string]*HealthChecker),
        healers:  make(map[string]*SelfHealer),
    }
    
    // 初始化熔断器
    if config.CircuitBreakerEnabled {
        hm.circuitBreaker = NewCircuitBreaker()
    }
    
    // 初始化告警管理器
    if config.AlertEnabled {
        hm.alertManager = NewAlertManager()
    }
    
    // 初始化审计日志记录器
    hm.auditLogger = NewAuditLogger()
    
    return hm, nil
}

// 启动健康监控
func (hm *HealthMonitor) Start(ctx context.Context) error {
    log.Info("启动健康监控")
    
    // 启动健康检查循环
    go hm.healthCheckLoop(ctx)
    
    return nil
}

// 健康检查循环
func (hm *HealthMonitor) healthCheckLoop(ctx context.Context) {
    ticker := time.NewTicker(hm.config.CheckInterval)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            log.Info("停止健康监控")
            return
        case <-ticker.C:
            hm.performHealthChecks(ctx)
        }
    }
}

// 执行健康检查
func (hm *HealthMonitor) performHealthChecks(ctx context.Context) {
    for name, checker := range hm.checkers {
        go func(name string, checker *HealthChecker) {
            result := hm.checkHealth(ctx, checker)
            
            // 更新检查器状态
            checker.LastCheck = result.Timestamp
            checker.Status = result.Status
            
            // 处理检查结果
            hm.handleCheckResult(ctx, checker, result)
        }(name, checker)
    }
}


// 检查健康状态
func (hm *HealthMonitor) checkHealth(ctx context.Context, checker *HealthChecker) *HealthCheckResult {
    startTime := time.Now()
    
    result := &HealthCheckResult{
        CheckerName: checker.Name,
        Timestamp:   startTime,
    }
    
    // 创建超时上下文
    checkCtx, cancel := context.WithTimeout(ctx, checker.Timeout)
    defer cancel()
    
    // 根据检查类型执行检查
    var err error
    switch checker.Type {
    case CheckTypeLiveness:
        err = hm.checkLiveness(checkCtx, checker)
    case CheckTypeReadiness:
        err = hm.checkReadiness(checkCtx, checker)
    case CheckTypeStartup:
        err = hm.checkStartup(checkCtx, checker)
    }
    
    result.Duration = time.Since(startTime)
    
    if err != nil {
        result.Status = StatusUnhealthy
        result.Message = err.Error()
    } else {
        result.Status = StatusHealthy
        result.Message = "健康检查通过"
    }
    
    return result
}

// 存活性检查
func (hm *HealthMonitor) checkLiveness(ctx context.Context, checker *HealthChecker) error {
    // HTTP 健康检查
    req, err := http.NewRequestWithContext(ctx, "GET", checker.Target+"/health/live", nil)
    if err != nil {
        return err
    }
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("健康检查失败: status=%d", resp.StatusCode)
    }
    
    return nil
}

// 就绪性检查
func (hm *HealthMonitor) checkReadiness(ctx context.Context, checker *HealthChecker) error {
    // HTTP 健康检查
    req, err := http.NewRequestWithContext(ctx, "GET", checker.Target+"/health/ready", nil)
    if err != nil {
        return err
    }
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("就绪检查失败: status=%d", resp.StatusCode)
    }
    
    return nil
}

// 启动探针检查
func (hm *HealthMonitor) checkStartup(ctx context.Context, checker *HealthChecker) error {
    // HTTP 健康检查
    req, err := http.NewRequestWithContext(ctx, "GET", checker.Target+"/health/startup", nil)
    if err != nil {
        return err
    }
    
    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("启动检查失败: status=%d", resp.StatusCode)
    }
    
    return nil
}


// 处理检查结果
func (hm *HealthMonitor) handleCheckResult(ctx context.Context, checker *HealthChecker, result *HealthCheckResult) {
    // 记录审计日志
    hm.auditLogger.LogHealthCheck(result)
    
    if result.Status == StatusUnhealthy {
        checker.FailureCount++
        log.Warnf("健康检查失败: checker=%s, failures=%d", checker.Name, checker.FailureCount)
        
        // 连续失败达到阈值，触发自愈
        if checker.FailureCount >= hm.config.FailureThreshold {
            log.Errorf("健康检查连续失败 %d 次，触发自愈: checker=%s", checker.FailureCount, checker.Name)
            
            // 检查熔断器状态
            if hm.config.CircuitBreakerEnabled && hm.circuitBreaker.IsOpen(checker.Name) {
                log.Warnf("熔断器已打开，跳过自愈: checker=%s", checker.Name)
                return
            }
            
            // 执行自愈
            hm.performSelfHealing(ctx, checker)
        }
    } else {
        // 健康检查成功，重置失败计数
        if checker.FailureCount > 0 {
            log.Infof("健康检查恢复: checker=%s", checker.Name)
            checker.FailureCount = 0
            
            // 重置熔断器
            if hm.config.CircuitBreakerEnabled {
                hm.circuitBreaker.Reset(checker.Name)
            }
        }
    }
}

// 执行自愈
func (hm *HealthMonitor) performSelfHealing(ctx context.Context, checker *HealthChecker) {
    startTime := time.Now()
    log.Infof("开始自愈: checker=%s", checker.Name)
    
    // 获取对应的自愈器
    healer, exists := hm.healers[checker.Name]
    if !exists || !healer.Enabled {
        log.Warnf("未找到可用的自愈器: checker=%s", checker.Name)
        return
    }
    
    // 检查重试次数
    if healer.RetryCount >= healer.MaxRetries {
        log.Errorf("自愈重试次数已达上限: checker=%s, retries=%d", checker.Name, healer.RetryCount)
        
        // 发送告警
        if hm.config.AlertEnabled {
            hm.alertManager.SendAlert(ctx, &Alert{
                Level:   "critical",
                Title:   "自愈失败",
                Message: fmt.Sprintf("服务 %s 自愈失败，已达最大重试次数", checker.Name),
            })
        }
        
        return
    }
    
    // 执行自愈策略
    var err error
    switch healer.Strategy {
    case StrategyRestart:
        err = hm.restartService(ctx, checker.Name)
    case StrategyScale:
        err = hm.scaleService(ctx, checker.Name)
    case StrategyClearCache:
        err = hm.clearCache(ctx, checker.Name)
    case StrategySwitchTraffic:
        err = hm.switchTraffic(ctx, checker.Name)
    case StrategyDegrade:
        err = hm.degradeService(ctx, checker.Name)
    default:
        err = fmt.Errorf("不支持的自愈策略: %s", healer.Strategy)
    }
    
    duration := time.Since(startTime)
    
    // 记录自愈结果
    result := &HealResult{
        HealerName: healer.Name,
        Strategy:   healer.Strategy,
        Success:    err == nil,
        Timestamp:  startTime,
        Duration:   duration,
    }
    
    if err != nil {
        result.Message = err.Error()
        healer.RetryCount++
        
        log.Errorf("自愈失败: checker=%s, strategy=%s, err=%v", checker.Name, healer.Strategy, err)
        
        // 更新熔断器
        if hm.config.CircuitBreakerEnabled {
            hm.circuitBreaker.RecordFailure(checker.Name)
        }
        
        // 发送告警
        if hm.config.AlertEnabled {
            hm.alertManager.SendAlert(ctx, &Alert{
                Level:   "warning",
                Title:   "自愈失败",
                Message: fmt.Sprintf("服务 %s 自愈失败: %v", checker.Name, err),
            })
        }
    } else {
        result.Message = "自愈成功"
        healer.RetryCount = 0
        healer.LastHeal = time.Now()
        
        log.Infof("自愈成功: checker=%s, strategy=%s, duration=%v", checker.Name, healer.Strategy, duration)
        
        // 重置熔断器
        if hm.config.CircuitBreakerEnabled {
            hm.circuitBreaker.Reset(checker.Name)
        }
    }
    
    // 记录审计日志
    hm.auditLogger.LogSelfHealing(result)
}


// 重启服务
func (hm *HealthMonitor) restartService(ctx context.Context, serviceName string) error {
    log.Infof("重启服务: %s", serviceName)
    
    // 使用 Kubernetes API 重启 Pod
    // kubectl rollout restart deployment/<serviceName>
    
    return nil
}

// 扩容服务
func (hm *HealthMonitor) scaleService(ctx context.Context, serviceName string) error {
    log.Infof("扩容服务: %s", serviceName)
    
    // 使用 Kubernetes API 扩容副本
    // kubectl scale deployment/<serviceName> --replicas=<current+1>
    
    return nil
}

// 清理缓存
func (hm *HealthMonitor) clearCache(ctx context.Context, serviceName string) error {
    log.Infof("清理缓存: %s", serviceName)
    
    // 调用服务的缓存清理接口
    // POST /admin/cache/clear
    
    return nil
}

// 切换流量
func (hm *HealthMonitor) switchTraffic(ctx context.Context, serviceName string) error {
    log.Infof("切换流量: %s", serviceName)
    
    // 使用 Kubernetes Service 切换流量到备用实例
    // kubectl patch service/<serviceName> -p '{"spec":{"selector":{"version":"backup"}}}'
    
    return nil
}

// 降级服务
func (hm *HealthMonitor) degradeService(ctx context.Context, serviceName string) error {
    log.Infof("降级服务: %s", serviceName)
    
    // 启用服务降级模式
    // POST /admin/degrade/enable
    
    return nil
}

// 熔断器
type CircuitBreaker struct {
    states map[string]*CircuitState
    mu     sync.RWMutex
}

// 熔断器状态
type CircuitState struct {
    State        string
    FailureCount int
    LastFailure  time.Time
    OpenedAt     time.Time
}

// 创建熔断器
func NewCircuitBreaker() *CircuitBreaker {
    return &CircuitBreaker{
        states: make(map[string]*CircuitState),
    }
}

// 检查熔断器是否打开
func (cb *CircuitBreaker) IsOpen(name string) bool {
    cb.mu.RLock()
    defer cb.mu.RUnlock()
    
    state, exists := cb.states[name]
    if !exists {
        return false
    }
    
    // 熔断器打开状态，检查是否可以尝试恢复
    if state.State == "open" {
        // 打开 5 分钟后尝试半开
        if time.Since(state.OpenedAt) > 5*time.Minute {
            state.State = "half_open"
            return false
        }
        return true
    }
    
    return false
}

// 记录失败
func (cb *CircuitBreaker) RecordFailure(name string) {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    state, exists := cb.states[name]
    if !exists {
        state = &CircuitState{
            State: "closed",
        }
        cb.states[name] = state
    }
    
    state.FailureCount++
    state.LastFailure = time.Now()
    
    // 连续失败 5 次，打开熔断器
    if state.FailureCount >= 5 {
        state.State = "open"
        state.OpenedAt = time.Now()
        log.Warnf("熔断器打开: %s", name)
    }
}

// 重置熔断器
func (cb *CircuitBreaker) Reset(name string) {
    cb.mu.Lock()
    defer cb.mu.Unlock()
    
    state, exists := cb.states[name]
    if !exists {
        return
    }
    
    state.State = "closed"
    state.FailureCount = 0
    log.Infof("熔断器重置: %s", name)
}
```


**关键实现点**:

1. 支持多层次健康检查（存活性、就绪性、启动探针），检查间隔 10 秒
2. 连续 3 次健康检查失败后触发自愈，避免误判
3. 支持 5 种自愈策略：重启服务、扩容副本、清理缓存、切换流量、降级服务
4. 使用熔断器机制防止频繁自愈，连续失败 5 次后打开熔断器，5 分钟后尝试恢复
5. 自愈失败时发送告警通知，通知延迟 < 1 分钟
6. 支持 HTTP、TCP、gRPC 三种协议的健康检查
7. 记录所有健康检查和自愈操作的审计日志，保留期 90 天


**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| health_check_enabled | bool | true | 是否启用健康检查 |
| check_interval | int | 10 | 健康检查间隔（秒） |
| failure_threshold | int | 3 | 失败阈值（次） |
| success_threshold | int | 1 | 成功阈值（次） |
| timeout | int | 5 | 健康检查超时（秒） |
| circuit_breaker_enabled | bool | true | 是否启用熔断器 |
| circuit_breaker_threshold | int | 5 | 熔断器阈值（次） |
| circuit_breaker_timeout | int | 300 | 熔断器超时（秒） |
| alert_enabled | bool | true | 是否启用告警 |
| self_healing_enabled | bool | true | 是否启用自愈 |
| max_retries | int | 3 | 最大重试次数 |
| heal_strategies | array | ["restart","scale"] | 启用的自愈策略 |
| audit_retention_days | int | 90 | 审计日志保留天数 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + PostgreSQL
- 生效时间: 立即生效（下次检查生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的健康检查间隔和阈值
2. WHEN 自愈策略变更时，THE System SHALL 在下次自愈时生效
3. THE System SHALL 支持通过 API 查询当前生效的健康检查配置
4. THE System SHALL 记录所有健康检查配置变更的审计日志
5. WHEN 熔断器配置变更时，THE System SHALL 验证配置的合理性（阈值 >= 1）

---



### API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-11-392 | 执行部署 | Deployment | POST | /api/v1/deployment/deploy | deployment.write | Body: deploy_config | {code:0,data:{deployment_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-11-393 | 查询部署状态 | Deployment | GET | /api/v1/deployment/status/{id} | deployment.read | 无 | {code:0,data:{status:"running"}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-11-394 | 回滚部署 | Deployment | POST | /api/v1/deployment/rollback | deployment.write | Body: {deployment_id,version} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-11-395 | 查询部署历史 | Deployment | GET | /api/v1/deployment/history | deployment.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-11-396 | 验证部署配置 | Deployment | POST | /api/v1/deployment/validate | deployment.read | Body: deploy_config | {code:0,data:{valid:true}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-11-397 | 获取配置 | Config | GET | /api/v1/config/get | config.read | Query: key | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-11-398 | 设置配置 | Config | POST | /api/v1/config/set | config.write | Body: {key,value} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-11-399 | 删除配置 | Config | DELETE | /api/v1/config/delete | config.write | Query: key | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-11-400 | 查询配置版本 | Config | GET | /api/v1/config/versions | config.read | Query: key | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-11-401 | 对比配置版本 | Config | GET | /api/v1/config/compare | config.read | Query: key, v1, v2 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-11-402 | 回滚配置 | Config | POST | /api/v1/config/rollback | config.write | Body: {key,version} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-11-403 | 导出配置 | Config | GET | /api/v1/config/export | config.read | Query: format | Binary | 200/401/403/500 | v1 | 是 | 否 | - | 返回文件 |
| API-11-404 | 导入配置 | Config | POST | /api/v1/config/import | config.write | Body: config_file | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-11-405 | 查询健康状态 | Health | GET | /api/v1/health/status | health.read | 无 | {code:0,data:{status:"healthy"}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-11-406 | 查询健康检查器列表 | Health | GET | /api/v1/health/checkers | health.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-11-407 | 查询健康检查器详情 | Health | GET | /api/v1/health/checkers/{name} | health.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-11-408 | 查询自愈器列表 | Health | GET | /api/v1/health/healers | health.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-11-409 | 查询自愈器详情 | Health | GET | /api/v1/health/healers/{name} | health.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-11-410 | 手动触发自愈 | Health | POST | /api/v1/health/heal | health.write | Body: {target,strategy} | {code:0,data:{task_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-11-411 | 查询健康检查历史 | Health | GET | /api/v1/health/history | health.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |

---



