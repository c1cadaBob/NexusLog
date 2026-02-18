# 模块八：合规与审计

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块八：合规与审计 
> **需求编号**: 

---

**模块概述**: 

提供完善的合规管理和审计功能，支持多种合规标准（GDPR、SOC 2、HIPAA），自动化合规检查和报告生成。

**模块技术栈**:
- 合规引擎：Go + 规则引擎 (合规检查)
- 策略管理：Open Policy Agent (OPA) (策略即代码)
- 数据分类：机器学习模型 (自动分类)
- 合规报告：Go + Chromium (PDF 生成)
- 数据保留：PostgreSQL + S3 (分层存储)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              合规与审计模块整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (合规策略/   │    │ (当前策略)   │    │ (策略变更)   │                           │ │
│  │  │  保留规则)   │    │              │    │              │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            合规检查层（Compliance Check）                              │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  合规引擎 (Compliance Engine)                                                │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ GDPR 检查    │───▶│ SOC 2 检查   │───▶│ HIPAA 检查   │                 │     │ │
│  │  │  │ (Privacy)    │    │ (Security)   │    │ (Healthcare) │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  策略评估器 (Policy Evaluator - OPA)                                         │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 策略加载     │───▶│ 策略评估     │───▶│ 决策记录     │                 │     │ │
│  │  │  │ (Load)       │    │ (Evaluate)   │    │ (Decision)   │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据分类层（Data Classification）                           │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  自动分类器 (Auto Classifier)                                                │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 敏感数据检测  │───▶│ 数据分级     │───▶│ 标签管理     │                 │     │ │
│  │  │  │ (PII/PHI)    │    │ (Level)      │    │ (Tag)        │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  分类规则引擎 (Classification Rules)                                         │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 正则匹配     │───▶│ ML 模型      │───▶│ 人工审核     │                 │     │ │
│  │  │  │ (Regex)      │    │ (ML)         │    │ (Manual)     │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据保留层（Data Retention）                                │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  保留策略管理 (Retention Policy)                                             │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 策略定义     │───▶│ 自动归档     │───▶│ 自动删除     │                 │     │ │
│  │  │  │ (Policy)     │    │ (Archive)    │    │ (Delete)     │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  生命周期管理 (Lifecycle Management)                                         │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 热数据       │───▶│ 温数据       │───▶│ 冷数据       │                 │     │ │
│  │  │  │ (Hot)        │    │ (Warm)       │    │ (Cold)       │                 │     │ │
│  │  │  │ 7 天         │    │ 30 天        │    │ 1 年+        │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            合规报告层（Compliance Report）                             │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  报告生成器 (Report Generator)                                               │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 合规报告     │───▶│ 审计报告     │───▶│ 风险报告     │                 │     │ │
│  │  │  │ (Compliance) │    │ (Audit)      │    │ (Risk)       │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  证据收集器 (Evidence Collector)                                             │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 日志证据     │───▶│ 配置证据     │───▶│ 操作证据     │                 │     │ │
│  │  │  │ (Logs)       │    │ (Config)     │    │ (Operation)  │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与告警                                              │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 合规状态监控  │    │ 违规告警     │    │ 风险评估     │                       │ │
│  │  │ (Monitor)    │    │ (Alert)      │    │ (Risk)       │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储合规策略和保留规则，Redis 分发当前生效策略
2. **合规检查层**: 支持多种合规标准（GDPR、SOC 2、HIPAA），使用 OPA 进行策略评估
3. **数据分类层**: 自动检测敏感数据（PII/PHI），使用 ML 模型和规则引擎进行分类
4. **数据保留层**: 实现数据生命周期管理，自动归档和删除过期数据
5. **合规报告层**: 生成合规报告、审计报告和风险报告，收集证据
6. **监控告警层**: 实时监控合规状态，发现违规行为并告警

**合规标准支持**:

| 标准 | 全称 | 主要要求 | 检查项 |
|------|------|----------|--------|
| GDPR | 通用数据保护条例 | 数据隐私保护 | 15 项 |
| SOC 2 | 服务组织控制 2 | 安全控制 | 20 项 |
| HIPAA | 健康保险流通与责任法案 | 医疗数据保护 | 12 项 |

**数据流向**:

```
数据 → 分类检测 → 合规检查 → 保留管理 → 报告生成
       ↑                                    ↓
       └──────── 配置中心（热更新）─────────┘
```

**需求列表**:
- 需求 8-27：合规检查 [Phase 2]
- 需求 8-28：数据分类与保留 [Phase 2]
- 需求 8-29：合规报告 [Phase 2]

---



#### 需求 8-27：合规检查 [Phase 2]

**用户故事**: 

作为合规官，我希望系统能够自动检查合规性，以便确保系统符合 GDPR、SOC 2、HIPAA 等合规标准。

**验收标准**:

1. THE Compliance_System SHALL 支持 GDPR、SOC 2、HIPAA 三种合规标准
2. THE Compliance_System SHALL 自动执行合规检查，每日至少检查一次
3. THE Compliance_System SHALL 检查至少 47 个合规项（GDPR 15 项、SOC 2 20 项、HIPAA 12 项）
4. THE Compliance_System SHALL 使用 Open Policy Agent (OPA) 实现策略即代码
5. THE Compliance_System SHALL 生成合规检查报告，包含通过/失败/警告状态
6. WHEN 发现合规违规时，THE Compliance_System SHALL 在 5 分钟内发送告警
7. THE Compliance_System SHALL 记录所有合规检查历史，保留至少 3 年
8. THE Compliance_System SHALL 支持自定义合规规则，规则可热加载
9. THE Compliance_System SHALL 提供合规仪表盘，实时展示合规状态
10. THE Compliance_System SHALL 通过配置中心管理合规配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 合规服务
type ComplianceService struct {
    opaClient   *opa.Client          // OPA 客户端
    checker     *ComplianceChecker   // 合规检查器
    scheduler   *ComplianceScheduler // 合规调度器
    reporter    *ComplianceReporter  // 合规报告器
    config      atomic.Value         // 配置（支持热更新）
    metrics     *ComplianceMetrics   // 合规指标
}

// 合规配置
type ComplianceConfig struct {
    Enabled         bool              // 是否启用合规检查
    Standards       []string          // 启用的合规标准
    CheckInterval   int               // 检查间隔（小时）
    AlertThreshold  int               // 告警阈值（违规数）
    RetentionYears  int               // 保留年限
    CustomRules     []*CustomRule     // 自定义规则
}

// 自定义规则
type CustomRule struct {
    ID          string `json:"id"`
    Name        string `json:"name"`
    Standard    string `json:"standard"` // gdpr/soc2/hipaa/custom
    Description string `json:"description"`
    Policy      string `json:"policy"` // OPA Rego 策略
    Severity    string `json:"severity"` // critical/high/medium/low
    Enabled     bool   `json:"enabled"`
}

// 合规检查器
type ComplianceChecker struct {
    opaClient *opa.Client
    rules     map[string][]*ComplianceRule // 按标准分组的规则
}

// 合规规则
type ComplianceRule struct {
    ID          string `json:"id"`
    Standard    string `json:"standard"`
    Category    string `json:"category"`
    Name        string `json:"name"`
    Description string `json:"description"`
    Policy      string `json:"policy"` // OPA Rego 策略
    Severity    string `json:"severity"`
    Remediation string `json:"remediation"` // 修复建议
}

// 执行合规检查
func (cc *ComplianceChecker) Check(standard string) (*ComplianceCheckResult, error) {
    startTime := time.Now()
    
    result := &ComplianceCheckResult{
        Standard:  standard,
        StartTime: startTime,
        Checks:    make([]*CheckItem, 0),
    }
    
    // 获取该标准的所有规则
    rules, ok := cc.rules[standard]
    if !ok {
        return nil, fmt.Errorf("不支持的合规标准: %s", standard)
    }
    
    // 执行每个规则检查
    for _, rule := range rules {
        checkItem := cc.checkRule(rule)
        result.Checks = append(result.Checks, checkItem)
        
        // 统计结果
        switch checkItem.Status {
        case "pass":
            result.PassCount++
        case "fail":
            result.FailCount++
        case "warning":
            result.WarningCount++
        }
    }
    
    // 计算合规分数
    total := len(result.Checks)
    if total > 0 {
        result.Score = float64(result.PassCount) / float64(total) * 100
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime).Seconds()
    
    return result, nil
}

// 检查单个规则
func (cc *ComplianceChecker) checkRule(rule *ComplianceRule) *CheckItem {
    item := &CheckItem{
        RuleID:      rule.ID,
        RuleName:    rule.Name,
        Category:    rule.Category,
        Severity:    rule.Severity,
        CheckedAt:   time.Now(),
    }
    
    // 收集输入数据
    input := cc.collectInput(rule)
    
    // 使用 OPA 评估策略
    ctx := context.Background()
    result, err := cc.opaClient.Evaluate(ctx, rule.Policy, input)
    
    if err != nil {
        item.Status = "error"
        item.Message = fmt.Sprintf("评估失败: %v", err)
        return item
    }
    
    // 解析结果
    if result.Allowed {
        item.Status = "pass"
        item.Message = "检查通过"
    } else {
        item.Status = "fail"
        item.Message = result.Reason
        item.Remediation = rule.Remediation
        
        // 收集证据
        item.Evidence = cc.collectEvidence(rule, input)
    }
    
    return item
}

// 合规检查结果
type ComplianceCheckResult struct {
    Standard     string       `json:"standard"`
    StartTime    time.Time    `json:"start_time"`
    EndTime      time.Time    `json:"end_time"`
    Duration     float64      `json:"duration"` // 秒
    Checks       []*CheckItem `json:"checks"`
    PassCount    int          `json:"pass_count"`
    FailCount    int          `json:"fail_count"`
    WarningCount int          `json:"warning_count"`
    Score        float64      `json:"score"` // 0-100
}

// 检查项
type CheckItem struct {
    RuleID      string                 `json:"rule_id"`
    RuleName    string                 `json:"rule_name"`
    Category    string                 `json:"category"`
    Severity    string                 `json:"severity"`
    Status      string                 `json:"status"` // pass/fail/warning/error
    Message     string                 `json:"message"`
    Remediation string                 `json:"remediation,omitempty"`
    Evidence    map[string]interface{} `json:"evidence,omitempty"`
    CheckedAt   time.Time              `json:"checked_at"`
}

// 收集输入数据
func (cc *ComplianceChecker) collectInput(rule *ComplianceRule) map[string]interface{} {
    input := make(map[string]interface{})
    
    // 根据规则类别收集不同的数据
    switch rule.Category {
    case "access_control":
        input["users"] = cc.getUsersData()
        input["roles"] = cc.getRolesData()
        input["permissions"] = cc.getPermissionsData()
        
    case "data_protection":
        input["encryption"] = cc.getEncryptionStatus()
        input["backup"] = cc.getBackupStatus()
        
    case "audit":
        input["audit_logs"] = cc.getAuditLogsStatus()
        input["retention"] = cc.getRetentionPolicy()
        
    case "network_security":
        input["tls"] = cc.getTLSConfig()
        input["firewall"] = cc.getFirewallRules()
    }
    
    return input
}

// GDPR 合规规则示例
var gdprRules = []*ComplianceRule{
    {
        ID:          "gdpr-001",
        Standard:    "gdpr",
        Category:    "data_protection",
        Name:        "数据加密",
        Description: "个人数据必须加密存储",
        Policy: `
            package gdpr.data_protection
            
            default allow = false
            
            allow {
                input.encryption.enabled == true
                input.encryption.algorithm == "aes-256-gcm"
            }
        `,
        Severity:    "critical",
        Remediation: "启用 AES-256-GCM 加密",
    },
    {
        ID:          "gdpr-002",
        Standard:    "gdpr",
        Category:    "access_control",
        Name:        "访问控制",
        Description: "必须实施基于角色的访问控制",
        Policy: `
            package gdpr.access_control
            
            default allow = false
            
            allow {
                input.rbac.enabled == true
                count(input.roles) > 0
            }
        `,
        Severity:    "high",
        Remediation: "配置 RBAC 权限模型",
    },
    {
        ID:          "gdpr-003",
        Standard:    "gdpr",
        Category:    "audit",
        Name:        "审计日志",
        Description: "必须记录所有数据访问操作",
        Policy: `
            package gdpr.audit
            
            default allow = false
            
            allow {
                input.audit_logs.enabled == true
                input.audit_logs.retention_days >= 365
            }
        `,
        Severity:    "high",
        Remediation: "启用审计日志并设置保留期至少 1 年",
    },
}

// SOC 2 合规规则示例
var soc2Rules = []*ComplianceRule{
    {
        ID:          "soc2-001",
        Standard:    "soc2",
        Category:    "network_security",
        Name:        "传输加密",
        Description: "必须使用 TLS 1.3 加密传输",
        Policy: `
            package soc2.network_security
            
            default allow = false
            
            allow {
                input.tls.enabled == true
                input.tls.version == "1.3"
            }
        `,
        Severity:    "critical",
        Remediation: "启用 TLS 1.3",
    },
    {
        ID:          "soc2-002",
        Standard:    "soc2",
        Category:    "access_control",
        Name:        "多因素认证",
        Description: "管理员账户必须启用 MFA",
        Policy: `
            package soc2.access_control
            
            default allow = false
            
            allow {
                admin_users := [user | user := input.users[_]; user.role == "admin"]
                mfa_enabled := [user | user := admin_users[_]; user.mfa_enabled == true]
                count(admin_users) == count(mfa_enabled)
            }
        `,
        Severity:    "high",
        Remediation: "为所有管理员账户启用 MFA",
    },
}

// HIPAA 合规规则示例
var hipaaRules = []*ComplianceRule{
    {
        ID:          "hipaa-001",
        Standard:    "hipaa",
        Category:    "data_protection",
        Name:        "PHI 加密",
        Description: "受保护的健康信息（PHI）必须加密",
        Policy: `
            package hipaa.data_protection
            
            default allow = false
            
            allow {
                input.encryption.enabled == true
                input.encryption.phi_fields_encrypted == true
            }
        `,
        Severity:    "critical",
        Remediation: "对所有 PHI 字段启用加密",
    },
    {
        ID:          "hipaa-002",
        Standard:    "hipaa",
        Category:    "audit",
        Name:        "访问日志",
        Description: "必须记录所有 PHI 访问",
        Policy: `
            package hipaa.audit
            
            default allow = false
            
            allow {
                input.audit_logs.enabled == true
                input.audit_logs.phi_access_logged == true
                input.audit_logs.retention_days >= 2190  # 6 年
            }
        `,
        Severity:    "critical",
        Remediation: "启用 PHI 访问日志并保留至少 6 年",
    },
}

// 合规调度器
type ComplianceScheduler struct {
    checker *ComplianceChecker
    config  atomic.Value
}

// 启动调度器
func (cs *ComplianceScheduler) Start() {
    config := cs.config.Load().(*ComplianceConfig)
    
    // 定时执行合规检查
    ticker := time.NewTicker(time.Duration(config.CheckInterval) * time.Hour)
    defer ticker.Stop()
    
    // 立即执行一次
    cs.runChecks()
    
    for range ticker.C {
        cs.runChecks()
    }
}

// 执行检查
func (cs *ComplianceScheduler) runChecks() {
    config := cs.config.Load().(*ComplianceConfig)
    
    for _, standard := range config.Standards {
        log.Info("开始合规检查", "standard", standard)
        
        result, err := cs.checker.Check(standard)
        if err != nil {
            log.Error("合规检查失败", "standard", standard, "error", err)
            continue
        }
        
        // 保存结果
        cs.saveResult(result)
        
        // 检查是否需要告警
        if result.FailCount >= config.AlertThreshold {
            cs.sendAlert(result)
        }
        
        log.Info("合规检查完成",
            "standard", standard,
            "score", result.Score,
            "pass", result.PassCount,
            "fail", result.FailCount,
        )
    }
}

// 保存检查结果
func (cs *ComplianceScheduler) saveResult(result *ComplianceCheckResult) error {
    // 保存到数据库
    query := `
        INSERT INTO compliance_check_results (standard, start_time, end_time, duration, pass_count, fail_count, warning_count, score, checks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `
    
    checksJSON, _ := json.Marshal(result.Checks)
    
    _, err := db.Exec(query,
        result.Standard,
        result.StartTime,
        result.EndTime,
        result.Duration,
        result.PassCount,
        result.FailCount,
        result.WarningCount,
        result.Score,
        checksJSON,
    )
    
    return err
}

// 发送告警
func (cs *ComplianceScheduler) sendAlert(result *ComplianceCheckResult) {
    alert := &Alert{
        Type:     "compliance_violation",
        Severity: "high",
        Title:    fmt.Sprintf("合规检查失败: %s", result.Standard),
        Message: fmt.Sprintf(
            "合规检查发现 %d 个违规项，合规分数: %.2f%%",
            result.FailCount,
            result.Score,
        ),
        Metadata: map[string]interface{}{
            "standard":      result.Standard,
            "fail_count":    result.FailCount,
            "score":         result.Score,
            "failed_checks": cs.getFailedChecks(result),
        },
    }
    
    // 发送告警（通过告警系统）
    alertService.Send(alert)
}

// 获取失败的检查项
func (cs *ComplianceScheduler) getFailedChecks(result *ComplianceCheckResult) []*CheckItem {
    var failed []*CheckItem
    for _, check := range result.Checks {
        if check.Status == "fail" {
            failed = append(failed, check)
        }
    }
    return failed
}
```

**关键实现点**:

1. 使用 Open Policy Agent (OPA) 实现策略即代码，支持灵活的合规规则定义
2. 支持三种主流合规标准（GDPR、SOC 2、HIPAA），共 47 个检查项
3. 实现自动化合规检查调度器，可配置检查间隔
4. 收集多维度证据（用户、角色、权限、加密、审计等）
5. 计算合规分数，直观展示合规状态
6. 自动发送合规违规告警，及时通知相关人员
7. 支持自定义合规规则，规则可热加载

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | bool | true | 是否启用合规检查 |
| standards | array | ["gdpr","soc2","hipaa"] | 启用的合规标准 |
| check_interval | int | 24 | 检查间隔（小时） |
| alert_threshold | int | 5 | 告警阈值（违规数） |
| retention_years | int | 3 | 保留年限 |
| custom_rules | array | [] | 自定义规则列表 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次合规检查）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 自定义规则变更时，THE System SHALL 验证 OPA 策略语法的正确性

---

#### 需求 8-28: 数据分类与保留 [Phase 2]

**用户故事**:
作为合规管理员，我希望系统能够自动对日志数据进行分类并按照保留策略管理，以便满足不同合规标准的数据保留要求。

**验收标准**:

1. THE System SHALL 支持至少 5 种数据分类级别（Public、Internal、Confidential、Restricted、Critical）
2. THE System SHALL 自动检测并标记包含敏感信息的日志（PII、PCI、PHI）
3. WHEN 日志写入时，THE System SHALL 在 100ms 内完成数据分类
4. THE System SHALL 根据数据分类自动应用不同的保留策略（7天至10年）
5. THE System SHALL 支持至少 3 种保留动作（Archive、Delete、Anonymize）
6. THE System SHALL 在数据保留期到期前 7 天发送通知
7. THE System SHALL 自动归档到期数据到冷存储，归档成功率 >= 99.9%
8. THE System SHALL 自动删除超过保留期的数据，删除准确率 100%
9. THE System SHALL 记录所有数据分类和保留操作的审计日志
10. THE System SHALL 支持手动调整数据分类和保留策略，变更需经过审批流程

**实现方向**:

**实现方式**:

```go
// internal/compliance/classification/classifier.go
package classification

import (
    "context"
    "regexp"
    "time"
)

// 数据分类级别
type ClassificationLevel string

const (
    LevelPublic       ClassificationLevel = "public"        // 公开
    LevelInternal     ClassificationLevel = "internal"      // 内部
    LevelConfidential ClassificationLevel = "confidential"  // 机密
    LevelRestricted   ClassificationLevel = "restricted"    // 限制
    LevelCritical     ClassificationLevel = "critical"      // 关键
)

// 敏感数据类型
type SensitiveDataType string

const (
    TypePII  SensitiveDataType = "pii"   // 个人身份信息
    TypePCI  SensitiveDataType = "pci"   // 支付卡信息
    TypePHI  SensitiveDataType = "phi"   // 健康信息
    TypeAuth SensitiveDataType = "auth"  // 认证信息
)

// 数据分类器
type DataClassifier struct {
    config    *ClassifierConfig
    patterns  map[SensitiveDataType][]*regexp.Regexp
    mlModel   *MLClassifier  // 机器学习分类器
    cache     *ClassificationCache
}

// 分类配置
type ClassifierConfig struct {
    Enabled           bool
    MLEnabled         bool
    CacheEnabled      bool
    CacheTTL          time.Duration
    ConfidenceThreshold float64
}

// 分类结果
type ClassificationResult struct {
    Level           ClassificationLevel
    SensitiveTypes  []SensitiveDataType
    Confidence      float64
    Reason          string
    DetectedPatterns map[SensitiveDataType][]string
}

// 创建数据分类器
func NewDataClassifier(config *ClassifierConfig) (*DataClassifier, error) {
    dc := &DataClassifier{
        config:   config,
        patterns: make(map[SensitiveDataType][]*regexp.Regexp),
    }
    
    // 初始化敏感数据检测模式

    dc.initPatterns()
    
    // 初始化机器学习分类器
    if config.MLEnabled {
        mlModel, err := NewMLClassifier()
        if err != nil {
            return nil, err
        }
        dc.mlModel = mlModel
    }
    
    // 初始化缓存
    if config.CacheEnabled {
        dc.cache = NewClassificationCache(config.CacheTTL)
    }
    
    return dc, nil
}

// 初始化敏感数据检测模式
func (dc *DataClassifier) initPatterns() {
    // PII 模式
    dc.patterns[TypePII] = []*regexp.Regexp{
        regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),                    // SSN
        regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`), // Email
        regexp.MustCompile(`\b\d{3}[-.]?\d{3}[-.]?\d{4}\b`),           // Phone
        regexp.MustCompile(`\b\d{15,16}\b`),                           // ID Card
    }
    
    // PCI 模式
    dc.patterns[TypePCI] = []*regexp.Regexp{
        regexp.MustCompile(`\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b`), // Credit Card
        regexp.MustCompile(`\b\d{3,4}\b`),                             // CVV
    }
    
    // PHI 模式
    dc.patterns[TypePHI] = []*regexp.Regexp{
        regexp.MustCompile(`(?i)\b(patient|diagnosis|prescription|medical)\b`),
        regexp.MustCompile(`\b[A-Z]\d{2}[.-]?\d{3}\b`),               // ICD Code
    }
    
    // Auth 模式
    dc.patterns[TypeAuth] = []*regexp.Regexp{
        regexp.MustCompile(`(?i)(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*\S+`),
        regexp.MustCompile(`Bearer\s+[A-Za-z0-9\-._~+/]+=*`),
    }
}

// 分类日志数据
func (dc *DataClassifier) Classify(ctx context.Context, logEntry *LogEntry) (*ClassificationResult, error) {
    // 检查缓存
    if dc.config.CacheEnabled {
        if cached := dc.cache.Get(logEntry.ID); cached != nil {
            return cached, nil
        }
    }
    
    result := &ClassificationResult{
        Level:            LevelPublic,
        SensitiveTypes:   []SensitiveDataType{},
        DetectedPatterns: make(map[SensitiveDataType][]string),
    }

    
    // 1. 基于规则的检测
    dc.detectSensitiveData(logEntry, result)
    
    // 2. 机器学习分类（如果启用）
    if dc.config.MLEnabled && dc.mlModel != nil {
        mlResult := dc.mlModel.Predict(logEntry)
        if mlResult.Confidence >= dc.config.ConfidenceThreshold {
            result.Level = mlResult.Level
            result.Confidence = mlResult.Confidence
            result.Reason = "ML Classification"
        }
    }
    
    // 3. 根据敏感数据类型确定分类级别
    if len(result.SensitiveTypes) > 0 {
        result.Level = dc.determineLevelBySensitivity(result.SensitiveTypes)
        result.Reason = "Sensitive Data Detected"
    }
    
    // 4. 缓存结果
    if dc.config.CacheEnabled {
        dc.cache.Set(logEntry.ID, result)
    }
    
    return result, nil
}

// 检测敏感数据
func (dc *DataClassifier) detectSensitiveData(logEntry *LogEntry, result *ClassificationResult) {
    content := logEntry.Message + " " + logEntry.RawLog
    
    for dataType, patterns := range dc.patterns {
        var matches []string
        for _, pattern := range patterns {
            if pattern.MatchString(content) {
                matches = append(matches, pattern.String())
            }
        }
        
        if len(matches) > 0 {
            result.SensitiveTypes = append(result.SensitiveTypes, dataType)
            result.DetectedPatterns[dataType] = matches
        }
    }
}

// 根据敏感数据类型确定分类级别
func (dc *DataClassifier) determineLevelBySensitivity(types []SensitiveDataType) ClassificationLevel {
    // 优先级: PHI > PCI > Auth > PII
    for _, t := range types {
        switch t {
        case TypePHI:
            return LevelCritical
        case TypePCI:
            return LevelRestricted
        case TypeAuth:
            return LevelConfidential
        case TypePII:
            return LevelInternal
        }
    }
    return LevelPublic
}
```

```go
// internal/compliance/retention/manager.go
package retention

import (
    "context"
    "time"
)

// 保留动作
type RetentionAction string

const (
    ActionArchive    RetentionAction = "archive"     // 归档
    ActionDelete     RetentionAction = "delete"      // 删除
    ActionAnonymize  RetentionAction = "anonymize"   // 匿名化
)


// 保留策略
type RetentionPolicy struct {
    ID                string
    Name              string
    ClassificationLevel ClassificationLevel
    RetentionPeriod   time.Duration
    Action            RetentionAction
    NotifyBeforeDays  int
    Enabled           bool
}

// 保留管理器
type RetentionManager struct {
    config       *RetentionConfig
    policies     map[ClassificationLevel]*RetentionPolicy
    scheduler    *RetentionScheduler
    archiver     *ColdStorageArchiver
    anonymizer   *DataAnonymizer
    notifier     *RetentionNotifier
}

// 保留配置
type RetentionConfig struct {
    Enabled          bool
    CheckInterval    time.Duration
    BatchSize        int
    NotifyEnabled    bool
    ApprovalRequired bool
}

// 创建保留管理器
func NewRetentionManager(config *RetentionConfig) (*RetentionManager, error) {
    rm := &RetentionManager{
        config:   config,
        policies: make(map[ClassificationLevel]*RetentionPolicy),
    }
    
    // 初始化默认策略
    rm.initDefaultPolicies()
    
    // 初始化调度器
    rm.scheduler = NewRetentionScheduler(config.CheckInterval)
    
    // 初始化归档器
    rm.archiver = NewColdStorageArchiver()
    
    // 初始化匿名化器
    rm.anonymizer = NewDataAnonymizer()
    
    // 初始化通知器
    if config.NotifyEnabled {
        rm.notifier = NewRetentionNotifier()
    }
    
    return rm, nil
}

// 初始化默认策略
func (rm *RetentionManager) initDefaultPolicies() {
    rm.policies[LevelPublic] = &RetentionPolicy{
        ID:                "policy-public",
        Name:              "公开数据保留策略",
        ClassificationLevel: LevelPublic,
        RetentionPeriod:   7 * 24 * time.Hour,  // 7天
        Action:            ActionDelete,
        NotifyBeforeDays:  1,
        Enabled:           true,
    }
    
    rm.policies[LevelInternal] = &RetentionPolicy{
        ID:                "policy-internal",
        Name:              "内部数据保留策略",
        ClassificationLevel: LevelInternal,
        RetentionPeriod:   90 * 24 * time.Hour,  // 90天
        Action:            ActionArchive,
        NotifyBeforeDays:  7,
        Enabled:           true,
    }

    
    rm.policies[LevelConfidential] = &RetentionPolicy{
        ID:                "policy-confidential",
        Name:              "机密数据保留策略",
        ClassificationLevel: LevelConfidential,
        RetentionPeriod:   365 * 24 * time.Hour,  // 1年
        Action:            ActionArchive,
        NotifyBeforeDays:  14,
        Enabled:           true,
    }
    
    rm.policies[LevelRestricted] = &RetentionPolicy{
        ID:                "policy-restricted",
        Name:              "限制数据保留策略",
        ClassificationLevel: LevelRestricted,
        RetentionPeriod:   3 * 365 * 24 * time.Hour,  // 3年
        Action:            ActionAnonymize,
        NotifyBeforeDays:  30,
        Enabled:           true,
    }
    
    rm.policies[LevelCritical] = &RetentionPolicy{
        ID:                "policy-critical",
        Name:              "关键数据保留策略",
        ClassificationLevel: LevelCritical,
        RetentionPeriod:   10 * 365 * 24 * time.Hour,  // 10年
        Action:            ActionArchive,
        NotifyBeforeDays:  90,
        Enabled:           true,
    }
}

// 应用保留策略
func (rm *RetentionManager) ApplyRetention(ctx context.Context) error {
    // 查询到期数据
    expiredData, err := rm.findExpiredData(ctx)
    if err != nil {
        return err
    }
    
    // 按分类级别分组
    grouped := rm.groupByClassification(expiredData)
    
    // 对每个分类级别应用策略
    for level, data := range grouped {
        policy := rm.policies[level]
        if !policy.Enabled {
            continue
        }
        
        // 发送通知
        if rm.config.NotifyEnabled {
            rm.notifier.NotifyExpiration(policy, data)
        }
        
        // 执行保留动作
        switch policy.Action {
        case ActionArchive:
            err = rm.archiver.Archive(ctx, data)
        case ActionDelete:
            err = rm.deleteData(ctx, data)
        case ActionAnonymize:
            err = rm.anonymizer.Anonymize(ctx, data)
        }
        
        if err != nil {
            return err
        }
        
        // 记录审计日志
        rm.auditRetentionAction(policy, data, err)
    }
    
    return nil
}

// 查询到期数据
func (rm *RetentionManager) findExpiredData(ctx context.Context) ([]*LogEntry, error) {
    // 从 Elasticsearch 查询到期数据
    query := map[string]interface{}{
        "query": map[string]interface{}{
            "range": map[string]interface{}{
                "timestamp": map[string]interface{}{
                    "lte": time.Now().Add(-rm.getMinRetentionPeriod()),
                },
            },
        },
    }
    
    // 执行查询...
    return nil, nil
}


// 获取最小保留期
func (rm *RetentionManager) getMinRetentionPeriod() time.Duration {
    minPeriod := time.Duration(0)
    for _, policy := range rm.policies {
        if policy.Enabled && (minPeriod == 0 || policy.RetentionPeriod < minPeriod) {
            minPeriod = policy.RetentionPeriod
        }
    }
    return minPeriod
}

// 按分类级别分组
func (rm *RetentionManager) groupByClassification(data []*LogEntry) map[ClassificationLevel][]*LogEntry {
    grouped := make(map[ClassificationLevel][]*LogEntry)
    for _, entry := range data {
        level := entry.Classification.Level
        grouped[level] = append(grouped[level], entry)
    }
    return grouped
}

// 删除数据
func (rm *RetentionManager) deleteData(ctx context.Context, data []*LogEntry) error {
    // 批量删除
    for i := 0; i < len(data); i += rm.config.BatchSize {
        end := i + rm.config.BatchSize
        if end > len(data) {
            end = len(data)
        }
        batch := data[i:end]
        
        // 从 Elasticsearch 删除
        if err := rm.deleteBatch(ctx, batch); err != nil {
            return err
        }
    }
    return nil
}

// 审计保留动作
func (rm *RetentionManager) auditRetentionAction(policy *RetentionPolicy, data []*LogEntry, err error) {
    auditLog := &AuditLog{
        Timestamp:  time.Now(),
        Action:     "retention_action",
        PolicyID:   policy.ID,
        PolicyName: policy.Name,
        DataCount:  len(data),
        Success:    err == nil,
        Error:      err,
    }
    
    // 记录到审计日志系统
    auditService.Log(auditLog)
}

// 启动保留管理器
func (rm *RetentionManager) Start(ctx context.Context) error {
    return rm.scheduler.Start(ctx, func() {
        if err := rm.ApplyRetention(ctx); err != nil {
            log.Errorf("应用保留策略失败: %v", err)
        }
    })
}
```

**关键实现点**:

1. 支持 5 种数据分类级别（Public、Internal、Confidential、Restricted、Critical）
2. 使用正则表达式和机器学习模型自动检测敏感数据（PII、PCI、PHI、Auth）
3. 分类性能优化：缓存机制、批量处理，分类延迟 < 100ms
4. 为每个分类级别配置不同的保留策略（7天至10年）
5. 支持 3 种保留动作：归档到冷存储、删除、匿名化处理
6. 到期前自动通知机制，支持多渠道通知（邮件、Webhook）
7. 完整的审计日志记录，包括分类决策、保留动作、数据变更

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| classification_enabled | bool | true | 是否启用数据分类 |
| ml_enabled | bool | false | 是否启用机器学习分类 |
| cache_enabled | bool | true | 是否启用分类缓存 |
| cache_ttl | int | 3600 | 缓存过期时间（秒） |
| confidence_threshold | float | 0.8 | ML分类置信度阈值 |
| retention_enabled | bool | true | 是否启用保留管理 |
| check_interval | int | 24 | 保留检查间隔（小时） |
| batch_size | int | 1000 | 批量处理大小 |
| notify_enabled | bool | true | 是否启用到期通知 |
| approval_required | bool | false | 是否需要审批 |


**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（分类器重新初始化，保留策略下次检查生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 5 秒内重新加载分类规则
2. WHEN 保留策略变更时，THE System SHALL 在下一次检查周期生效
3. THE System SHALL 支持通过 API 查询当前生效的分类和保留策略
4. THE System SHALL 记录所有策略变更的审计日志
5. WHEN 敏感数据检测模式变更时，THE System SHALL 验证正则表达式的有效性

---


#### 需求 8-29: 合规报告 [Phase 2]

**用户故事**:
作为合规管理员，我希望系统能够自动生成合规报告并收集证据，以便向审计人员和监管机构提供合规证明。

**验收标准**:

1. THE System SHALL 支持至少 5 种合规报告类型（日报、周报、月报、季报、年报）
2. THE System SHALL 自动收集合规证据（配置快照、审计日志、检查结果、用户活动）
3. THE System SHALL 在 30 秒内生成包含 1000 条记录的合规报告
4. THE System SHALL 支持至少 4 种导出格式（PDF、Excel、CSV、JSON）
5. THE System SHALL 在报告中包含至少 8 个关键指标（合规分数、违规次数、修复率等）
6. THE System SHALL 支持自定义报告模板，模板可包含公司 Logo 和品牌元素
7. THE System SHALL 自动归档历史报告，保留期至少 7 年
8. THE System SHALL 支持报告加密和数字签名，确保报告完整性
9. THE System SHALL 支持通过邮件、API、下载等方式分发报告
10. THE System SHALL 记录所有报告生成和访问的审计日志

**实现方向**:

**实现方式**:

```go
// internal/compliance/report/generator.go
package report

import (
    "context"
    "time"
)

// 报告类型
type ReportType string

const (
    ReportDaily     ReportType = "daily"      // 日报
    ReportWeekly    ReportType = "weekly"     // 周报
    ReportMonthly   ReportType = "monthly"    // 月报
    ReportQuarterly ReportType = "quarterly"  // 季报
    ReportAnnual    ReportType = "annual"     // 年报
)

// 导出格式
type ExportFormat string

const (
    FormatPDF   ExportFormat = "pdf"
    FormatExcel ExportFormat = "excel"
    FormatCSV   ExportFormat = "csv"
    FormatJSON  ExportFormat = "json"
)

// 合规报告生成器
type ComplianceReportGenerator struct {
    config          *ReportConfig
    evidenceCollector *EvidenceCollector
    templateEngine  *TemplateEngine
    exporters       map[ExportFormat]Exporter
    archiver        *ReportArchiver
    signer          *DigitalSigner
}

// 报告配置
type ReportConfig struct {
    Enabled          bool
    TemplateDir      string
    OutputDir        string
    ArchiveEnabled   bool
    ArchiveRetention time.Duration
    SignEnabled      bool
    EncryptEnabled   bool
}


// 合规报告
type ComplianceReport struct {
    ID            string
    Type          ReportType
    Period        ReportPeriod
    GeneratedAt   time.Time
    GeneratedBy   string
    Metrics       *ReportMetrics
    Evidence      *ReportEvidence
    Findings      []*ComplianceFinding
    Recommendations []string
    Signature     string
}

// 报告周期
type ReportPeriod struct {
    StartTime time.Time
    EndTime   time.Time
}

// 报告指标
type ReportMetrics struct {
    ComplianceScore    float64  // 合规分数
    ViolationCount     int      // 违规次数
    ResolvedCount      int      // 已修复次数
    ResolutionRate     float64  // 修复率
    AverageResolutionTime time.Duration  // 平均修复时间
    CriticalIssues     int      // 严重问题数
    HighRiskAssets     int      // 高风险资产数
    AuditLogVolume     int64    // 审计日志量
}

// 报告证据
type ReportEvidence struct {
    ConfigSnapshots  []*ConfigSnapshot
    AuditLogs        []*AuditLog
    CheckResults     []*ComplianceCheckResult
    UserActivities   []*UserActivity
    SystemEvents     []*SystemEvent
}

// 合规发现
type ComplianceFinding struct {
    ID          string
    Severity    string
    Standard    string
    Requirement string
    Status      string
    Description string
    Evidence    []string
    Remediation string
}

// 创建报告生成器
func NewComplianceReportGenerator(config *ReportConfig) (*ComplianceReportGenerator, error) {
    crg := &ComplianceReportGenerator{
        config:    config,
        exporters: make(map[ExportFormat]Exporter),
    }
    
    // 初始化证据收集器
    crg.evidenceCollector = NewEvidenceCollector()
    
    // 初始化模板引擎
    crg.templateEngine = NewTemplateEngine(config.TemplateDir)
    
    // 初始化导出器
    crg.exporters[FormatPDF] = NewPDFExporter()
    crg.exporters[FormatExcel] = NewExcelExporter()
    crg.exporters[FormatCSV] = NewCSVExporter()
    crg.exporters[FormatJSON] = NewJSONExporter()
    
    // 初始化归档器
    if config.ArchiveEnabled {
        crg.archiver = NewReportArchiver(config.ArchiveRetention)
    }
    
    // 初始化数字签名器
    if config.SignEnabled {
        crg.signer = NewDigitalSigner()
    }
    
    return crg, nil
}


// 生成合规报告
func (crg *ComplianceReportGenerator) Generate(ctx context.Context, reportType ReportType, period ReportPeriod) (*ComplianceReport, error) {
    startTime := time.Now()
    
    // 1. 收集证据
    evidence, err := crg.evidenceCollector.Collect(ctx, period)
    if err != nil {
        return nil, err
    }
    
    // 2. 计算指标
    metrics := crg.calculateMetrics(evidence)
    
    // 3. 分析发现
    findings := crg.analyzeFindings(evidence)
    
    // 4. 生成建议
    recommendations := crg.generateRecommendations(findings)
    
    // 5. 创建报告
    report := &ComplianceReport{
        ID:              generateReportID(),
        Type:            reportType,
        Period:          period,
        GeneratedAt:     time.Now(),
        GeneratedBy:     getCurrentUser(ctx),
        Metrics:         metrics,
        Evidence:        evidence,
        Findings:        findings,
        Recommendations: recommendations,
    }
    
    // 6. 数字签名
    if crg.config.SignEnabled {
        signature, err := crg.signer.Sign(report)
        if err != nil {
            return nil, err
        }
        report.Signature = signature
    }
    
    // 7. 归档报告
    if crg.config.ArchiveEnabled {
        if err := crg.archiver.Archive(report); err != nil {
            log.Errorf("归档报告失败: %v", err)
        }
    }
    
    // 8. 记录审计日志
    crg.auditReportGeneration(report, time.Since(startTime))
    
    return report, nil
}

// 计算报告指标
func (crg *ComplianceReportGenerator) calculateMetrics(evidence *ReportEvidence) *ReportMetrics {
    metrics := &ReportMetrics{}
    
    // 计算合规分数
    totalChecks := 0
    passedChecks := 0
    for _, result := range evidence.CheckResults {
        totalChecks += len(result.Checks)
        for _, check := range result.Checks {
            if check.Status == "pass" {
                passedChecks++
            }
        }
    }
    if totalChecks > 0 {
        metrics.ComplianceScore = float64(passedChecks) / float64(totalChecks) * 100
    }
    
    // 统计违规次数
    metrics.ViolationCount = totalChecks - passedChecks
    
    // 统计已修复次数
    for _, finding := range evidence.CheckResults {
        if finding.Status == "resolved" {
            metrics.ResolvedCount++
        }
    }
    
    // 计算修复率
    if metrics.ViolationCount > 0 {
        metrics.ResolutionRate = float64(metrics.ResolvedCount) / float64(metrics.ViolationCount) * 100
    }
    
    // 统计严重问题
    for _, result := range evidence.CheckResults {
        for _, check := range result.Checks {
            if check.Severity == "critical" && check.Status == "fail" {
                metrics.CriticalIssues++
            }
        }
    }
    
    // 统计审计日志量
    metrics.AuditLogVolume = int64(len(evidence.AuditLogs))
    
    return metrics
}


// 分析发现
func (crg *ComplianceReportGenerator) analyzeFindings(evidence *ReportEvidence) []*ComplianceFinding {
    var findings []*ComplianceFinding
    
    for _, result := range evidence.CheckResults {
        for _, check := range result.Checks {
            if check.Status == "fail" {
                finding := &ComplianceFinding{
                    ID:          generateFindingID(),
                    Severity:    check.Severity,
                    Standard:    result.Standard,
                    Requirement: check.Name,
                    Status:      "open",
                    Description: check.Description,
                    Evidence:    []string{check.Details},
                    Remediation: check.Remediation,
                }
                findings = append(findings, finding)
            }
        }
    }
    
    return findings
}

// 生成建议
func (crg *ComplianceReportGenerator) generateRecommendations(findings []*ComplianceFinding) []string {
    recommendations := []string{}
    
    // 根据发现生成建议
    criticalCount := 0
    for _, finding := range findings {
        if finding.Severity == "critical" {
            criticalCount++
        }
    }
    
    if criticalCount > 0 {
        recommendations = append(recommendations, 
            fmt.Sprintf("立即处理 %d 个严重合规问题", criticalCount))
    }
    
    recommendations = append(recommendations,
        "定期审查和更新合规策略",
        "加强员工合规培训",
        "实施自动化合规检查",
        "建立合规问题快速响应机制",
    )
    
    return recommendations
}

// 导出报告
func (crg *ComplianceReportGenerator) Export(report *ComplianceReport, format ExportFormat) ([]byte, error) {
    exporter, ok := crg.exporters[format]
    if !ok {
        return nil, fmt.Errorf("不支持的导出格式: %s", format)
    }
    
    // 使用模板渲染报告
    rendered, err := crg.templateEngine.Render(report)
    if err != nil {
        return nil, err
    }
    
    // 导出为指定格式
    data, err := exporter.Export(rendered)
    if err != nil {
        return nil, err
    }
    
    // 加密（如果启用）
    if crg.config.EncryptEnabled {
        data, err = crg.encrypt(data)
        if err != nil {
            return nil, err
        }
    }
    
    return data, nil
}

// 审计报告生成
func (crg *ComplianceReportGenerator) auditReportGeneration(report *ComplianceReport, duration time.Duration) {
    auditLog := &AuditLog{
        Timestamp: time.Now(),
        Action:    "generate_compliance_report",
        ReportID:  report.ID,
        ReportType: string(report.Type),
        Duration:  duration,
        User:      report.GeneratedBy,
    }
    
    auditService.Log(auditLog)
}
```


```go
// internal/compliance/report/evidence.go
package report

// 证据收集器
type EvidenceCollector struct {
    configStore  *ConfigStore
    auditStore   *AuditStore
    checkStore   *ComplianceCheckStore
    activityStore *UserActivityStore
}

// 收集证据
func (ec *EvidenceCollector) Collect(ctx context.Context, period ReportPeriod) (*ReportEvidence, error) {
    evidence := &ReportEvidence{}
    
    // 并发收集各类证据
    errChan := make(chan error, 4)
    
    // 收集配置快照
    go func() {
        snapshots, err := ec.configStore.GetSnapshots(ctx, period.StartTime, period.EndTime)
        if err != nil {
            errChan <- err
            return
        }
        evidence.ConfigSnapshots = snapshots
        errChan <- nil
    }()
    
    // 收集审计日志
    go func() {
        logs, err := ec.auditStore.GetLogs(ctx, period.StartTime, period.EndTime)
        if err != nil {
            errChan <- err
            return
        }
        evidence.AuditLogs = logs
        errChan <- nil
    }()
    
    // 收集检查结果
    go func() {
        results, err := ec.checkStore.GetResults(ctx, period.StartTime, period.EndTime)
        if err != nil {
            errChan <- err
            return
        }
        evidence.CheckResults = results
        errChan <- nil
    }()
    
    // 收集用户活动
    go func() {
        activities, err := ec.activityStore.GetActivities(ctx, period.StartTime, period.EndTime)
        if err != nil {
            errChan <- err
            return
        }
        evidence.UserActivities = activities
        errChan <- nil
    }()
    
    // 等待所有收集完成
    for i := 0; i < 4; i++ {
        if err := <-errChan; err != nil {
            return nil, err
        }
    }
    
    return evidence, nil
}
```

**关键实现点**:

1. 支持 5 种报告类型（日报、周报、月报、季报、年报），满足不同审计需求
2. 自动收集 4 类证据（配置快照、审计日志、检查结果、用户活动），并发收集提升性能
3. 计算 8 个关键指标：合规分数、违规次数、修复率、平均修复时间、严重问题数等
4. 支持 4 种导出格式（PDF、Excel、CSV、JSON），使用模板引擎自定义报告样式
5. 实现数字签名和加密功能，确保报告完整性和机密性
6. 自动归档历史报告，保留期 7 年，支持快速检索
7. 完整的审计日志记录，包括报告生成、访问、导出、分发等操作

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| report_enabled | bool | true | 是否启用报告生成 |
| template_dir | string | "/templates" | 报告模板目录 |
| output_dir | string | "/reports" | 报告输出目录 |
| archive_enabled | bool | true | 是否启用报告归档 |
| archive_retention | int | 2555 | 归档保留天数（7年） |
| sign_enabled | bool | true | 是否启用数字签名 |
| encrypt_enabled | bool | true | 是否启用报告加密 |
| auto_send_enabled | bool | false | 是否自动发送报告 |
| recipients | array | [] | 报告接收人列表 |
| formats | array | ["pdf","excel"] | 默认导出格式 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（模板重新加载，下次报告生成生效）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 5 秒内重新加载报告模板
2. WHEN 归档策略变更时，THE System SHALL 在下次归档任务生效
3. THE System SHALL 支持通过 API 查询当前生效的报告配置
4. THE System SHALL 记录所有报告配置变更的审计日志
5. WHEN 模板变更时，THE System SHALL 验证模板语法的正确性

---


### 8.5 API 接口汇总

模块八提供以下 API 接口：

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-8-279 | 执行合规检查 | Compliance | POST | /api/v1/compliance/check | compliance.write | Body: {standard,scope} | {code:0,data:{check_id:"chk-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-8-280 | 获取检查结果 | Compliance | GET | /api/v1/compliance/check/{id} | compliance.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-8-281 | 列出检查历史 | Compliance | GET | /api/v1/compliance/checks | compliance.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-8-282 | 获取合规分数 | Compliance | GET | /api/v1/compliance/score | compliance.read | 无 | {code:0,data:{score:85}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-8-283 | 配置检查规则 | Compliance | PUT | /api/v1/compliance/rules | compliance.write | Body: rules_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-284 | 获取检查规则 | Compliance | GET | /api/v1/compliance/rules | compliance.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-8-285 | 启用/禁用规则 | Compliance | PATCH | /api/v1/compliance/rules/{id} | compliance.write | Body: {enabled} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-8-286 | 配置检查调度 | Compliance | PUT | /api/v1/compliance/schedule | compliance.write | Body: schedule_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-287 | 获取检查调度 | Compliance | GET | /api/v1/compliance/schedule | compliance.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-8-288 | 获取违规告警 | Compliance | GET | /api/v1/compliance/alerts | compliance.read | Query: severity | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-289 | 分类日志数据 | Classification | POST | /api/v1/classification/classify | classification.write | Body: log_data | {code:0,data:{category:"..."}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-290 | 获取分类结果 | Classification | GET | /api/v1/classification/{id} | classification.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-8-291 | 批量分类 | Classification | POST | /api/v1/classification/batch | classification.write | Body: {logs:[]} | {code:0,data:[...]} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-292 | 配置分类规则 | Classification | PUT | /api/v1/classification/rules | classification.write | Body: rules_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-293 | 获取分类规则 | Classification | GET | /api/v1/classification/rules | classification.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-8-294 | 训练ML模型 | Classification | POST | /api/v1/classification/train | classification.admin | Body: training_data | {code:0,data:{model_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-8-295 | 获取分类统计 | Classification | GET | /api/v1/classification/stats | classification.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-296 | 配置保留策略 | Retention | PUT | /api/v1/retention/policies | retention.write | Body: policies | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-297 | 获取保留策略 | Retention | GET | /api/v1/retention/policies | retention.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-8-298 | 获取策略详情 | Retention | GET | /api/v1/retention/policies/{id} | retention.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-8-299 | 执行保留动作 | Retention | POST | /api/v1/retention/apply | retention.write | Body: {policy_id} | {code:0,data:{task_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-8-300 | 获取到期数据 | Retention | GET | /api/v1/retention/expiring | retention.read | Query: days | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-301 | 归档数据 | Retention | POST | /api/v1/retention/archive | retention.write | Body: {query} | {code:0,data:{task_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-8-302 | 删除数据 | Retention | DELETE | /api/v1/retention/delete | retention.write | Body: {query} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-8-303 | 匿名化数据 | Retention | POST | /api/v1/retention/anonymize | retention.write | Body: {query} | {code:0,data:{task_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-8-304 | 获取保留统计 | Retention | GET | /api/v1/retention/stats | retention.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-305 | 生成合规报告 | ComplianceReport | POST | /api/v1/reports/generate | report.write | Body: {type,period} | {code:0,data:{report_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-8-306 | 获取报告详情 | ComplianceReport | GET | /api/v1/reports/{id} | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-8-307 | 列出历史报告 | ComplianceReport | GET | /api/v1/reports | report.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-8-308 | 导出报告 | ComplianceReport | GET | /api/v1/reports/{id}/export | report.read | Query: format | Binary | 200/401/403/404/500 | v1 | 是 | 否 | - | 返回文件 |
| API-8-309 | 下载报告 | ComplianceReport | GET | /api/v1/reports/{id}/download | report.read | 无 | Binary | 200/401/403/404/500 | v1 | 是 | 否 | - | 返回文件 |
| API-8-310 | 发送报告 | ComplianceReport | POST | /api/v1/reports/{id}/send | report.write | Body: {recipients:[]} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-8-311 | 验证报告签名 | ComplianceReport | POST | /api/v1/reports/{id}/verify | report.read | 无 | {code:0,data:{valid:true}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-8-312 | 配置报告模板 | ComplianceReport | PUT | /api/v1/reports/templates | report.write | Body: templates | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-313 | 获取报告模板 | ComplianceReport | GET | /api/v1/reports/templates | report.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-8-314 | 获取报告指标 | ComplianceReport | GET | /api/v1/reports/{id}/metrics | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-8-315 | 获取报告证据 | ComplianceReport | GET | /api/v1/reports/{id}/evidence | report.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-8-316 | 归档报告 | ComplianceReport | POST | /api/v1/reports/{id}/archive | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-8-317 | 搜索报告 | ComplianceReport | GET | /api/v1/reports/search | report.read | Query: keyword | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-318 | 配置自动报告 | ComplianceReport | PUT | /api/v1/reports/schedule | report.write | Body: schedule_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-8-319 | 获取报告调度 | ComplianceReport | GET | /api/v1/reports/schedule | report.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |

**接口说明**:
- 所有接口均需要身份认证（JWT Token）
- 合规管理接口需要 `compliance:manage` 权限
- 报告生成和导出需要 `report:generate` 权限
- 支持 API 限流：100 请求/分钟/用户
- 所有接口调用均记录审计日志

---


