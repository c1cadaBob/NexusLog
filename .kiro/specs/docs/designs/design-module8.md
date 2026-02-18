# 模块8：合规与审计 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module8.md](../requirements/requirements-module8.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: Phase 2

### 1.3 评审记录
| 评审人 | 角色 | 评审日期 | 评审结果 | 意见 |
|--------|------|----------|----------|------|
| 技术委员会 | 架构评审 | 2026-01-31 | 通过 | 设计合理，可以实施 |

### 1.4 相关文档
- [需求文档](../requirements/requirements-module8.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2设计文档](./design-module2.md) - 日志存储
- [模块7设计文档](./design-module7.md) - 安全与访问控制

---

## 2. 总体架构

### 2.1 系统架构图
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
│  │  │  合规引擎 (Compliance Engine - Go)                                           │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ GDPR 检查    │───▶│ SOC 2 检查   │───▶│ HIPAA 检查   │                 │     │ │
│  │  │  │ (15项)       │    │ (20项)       │    │ (12项)       │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  策略评估器 (Policy Evaluator - OPA)                                         │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 策略加载     │───▶│ 策略评估     │───▶│ 决策记录     │                 │     │ │
│  │  │  │ (Rego)       │    │ (Evaluate)   │    │ (Decision)   │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据分类层（Data Classification）                           │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  自动分类器 (Auto Classifier - Go + ML)                                      │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 敏感数据检测  │───▶│ 数据分级     │───▶│ 标签管理     │                 │     │ │
│  │  │  │ (PII/PCI/PHI)│    │ (5 Levels)   │    │ (Tag)        │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  分类规则引擎 (Classification Rules)                                         │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 正则匹配     │───▶│ ML 模型      │───▶│ 缓存优化     │                 │     │ │
│  │  │  │ (Regex)      │    │ (ONNX)       │    │ (Redis)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据保留层（Data Retention）                                │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  保留策略管理 (Retention Policy Manager)                                     │     │ │
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
│  │  │  │ 热数据 (7天) │───▶│ 温数据(90天) │───▶│ 冷数据(1年+) │                 │     │ │
│  │  │  │ ES Hot       │    │ ES Warm      │    │ S3 Cold      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            合规报告层（Compliance Report）                             │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  报告生成器 (Report Generator - Go + Chromium)                               │     │ │
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

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 配置中心 | 策略配置管理 | PostgreSQL存储、Redis分发、Pub/Sub通知 |
| 合规检查引擎 | 自动化合规检查 | GDPR/SOC2/HIPAA检查、OPA策略评估、自定义规则 |
| 数据分类器 | 敏感数据识别 | PII/PCI/PHI检测、5级分类、ML模型、缓存优化 |
| 保留管理器 | 数据生命周期 | 保留策略、自动归档、自动删除、匿名化 |
| 报告生成器 | 合规报告生成 | 证据收集、报告渲染、多格式导出、数字签名 |
| 监控告警 | 合规状态监控 | 实时监控、违规告警、风险评估 |

### 2.3 关键路径
```
数据写入 → 分类检测(< 100ms) → 合规检查(定时) → 保留管理(定时) → 报告生成(按需)
       ↑                                                           ↓
       └──────────────── 配置中心（热更新）────────────────────────┘

合规检查路径:
调度触发 → 收集输入数据 → OPA策略评估 → 生成检查结果 → 
  发送告警(如需) → 保存历史 → 更新仪表盘

数据保留路径:
调度触发 → 查询到期数据 → 按分类分组 → 执行保留动作 → 
  记录审计日志 → 发送通知
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、并发友好、适合规则引擎 |
| Open Policy Agent (OPA) | 0.60+ | 策略即代码、Rego语言、云原生 |
| PostgreSQL | 16+ | 策略存储、审计日志、JSONB支持 |
| Redis | 7.2+ | 配置分发、缓存、Pub/Sub |
| Python | 3.11+ | ML模型训练、数据分析 |
| ONNX Runtime | 1.16+ | ML模型推理、跨平台 |
| Chromium | - | PDF报告生成、HTML渲染 |
| MinIO/S3 | - | 报告归档、冷数据存储 |

### 3.2 策略引擎选型对比

**策略引擎选型**:

| 维度 | OPA | Casbin | AWS Cedar | 选择 |
|------|-----|--------|-----------|------|
| 策略语言 | Rego | 配置文件 | Cedar | OPA ✅ |
| 灵活性 | 高 | 中 | 中 | OPA ✅ |
| 性能 | 优秀 | 优秀 | 优秀 | - |
| 云原生 | 是 | 否 | 是 | OPA ✅ |
| 社区活跃度 | 高 | 中 | 低 | OPA ✅ |
| 学习曲线 | 中等 | 平缓 | 陡峭 | Casbin ✅ |
| CNCF项目 | 是 | 否 | 否 | OPA ✅ |

**结论**: 选择 OPA，理由：策略即代码、灵活性高、CNCF毕业项目

### 3.3 ML框架选型对比

**机器学习框架选型**:

| 维度 | ONNX Runtime | TensorFlow Lite | PyTorch Mobile | 选择 |
|------|--------------|-----------------|----------------|------|
| 跨平台 | 优秀 | 良好 | 良好 | ONNX ✅ |
| 性能 | 优秀 | 优秀 | 良好 | ONNX ✅ |
| 模型兼容性 | 高 | 中 | 中 | ONNX ✅ |
| 包大小 | 小 | 中 | 大 | ONNX ✅ |
| Go集成 | 容易 | 困难 | 困难 | ONNX ✅ |
| 社区支持 | 高 | 高 | 中 | - |

**结论**: 选择 ONNX Runtime，理由：跨平台、Go集成容易、模型兼容性高

### 3.4 报告生成选型对比

**PDF生成工具选型**:

| 维度 | Chromium | wkhtmltopdf | PDFKit | 选择 |
|------|----------|-------------|--------|------|
| HTML支持 | 完整 | 部分 | 基础 | Chromium ✅ |
| CSS支持 | 完整 | 部分 | 基础 | Chromium ✅ |
| 图表支持 | 优秀 | 良好 | 差 | Chromium ✅ |
| 性能 | 中 | 快 | 快 | wkhtmltopdf ✅ |
| 维护状态 | 活跃 | 停止 | 活跃 | Chromium ✅ |
| 内存占用 | 高 | 低 | 低 | wkhtmltopdf ✅ |

**结论**: 选择 Chromium (Headless)，理由：HTML/CSS支持完整、图表渲染好

---

## 4. 关键流程设计

### 4.1 合规检查主流程

**合规检查流程**:

```
1. 调度器触发检查（定时或手动）
2. 选择合规标准（GDPR/SOC2/HIPAA）
3. 加载该标准的所有规则
4. 并发执行规则检查：
   a. 收集输入数据（配置、日志、用户等）
   b. 调用 OPA 评估策略
   c. 解析评估结果
   d. 收集证据
5. 汇总检查结果
6. 计算合规分数
7. 保存检查历史
8. 发送告警（如有违规）
9. 更新合规仪表盘
```

**时序图**:

```
调度器  检查器  OPA  数据源  存储  告警
  │      │     │     │      │     │
  │─触发→│     │     │      │     │
  │      │─加载规则→ │      │     │
  │      │     │     │      │     │
  │      │─收集数据──→│      │     │
  │      │◀─返回数据──│      │     │
  │      │     │     │      │     │
  │      │─评估策略→ │      │     │
  │      │◀─评估结果─│      │     │
  │      │     │     │      │     │
  │      │─保存结果──────────→│     │
  │      │     │     │      │     │
  │      │─发送告警──────────────────→│
  │      │     │     │      │     │
```

**OPA策略评估流程**:

```go
// OPA策略示例（Rego语言）
package gdpr.data_protection

import future.keywords.if

# 默认拒绝
default allow := false

# 数据加密检查
allow if {
    input.encryption.enabled == true
    input.encryption.algorithm == "aes-256-gcm"
    input.encryption.key_rotation_days <= 90
}

# 违规原因
deny[msg] {
    not input.encryption.enabled
    msg := "数据加密未启用"
}

deny[msg] {
    input.encryption.algorithm != "aes-256-gcm"
    msg := sprintf("加密算法不符合要求: %s", [input.encryption.algorithm])
}

deny[msg] {
    input.encryption.key_rotation_days > 90
    msg := sprintf("密钥轮换周期过长: %d天", [input.encryption.key_rotation_days])
}
```

### 4.2 数据分类流程

**数据分类流程**:

```
1. 日志写入时触发分类
2. 检查分类缓存（Redis）
3. 如果缓存命中，返回分类结果
4. 如果缓存未命中：
   a. 使用正则表达式检测敏感数据
   b. 如果启用ML，调用ML模型预测
   c. 根据检测结果确定分类级别
   d. 缓存分类结果
5. 返回分类结果（< 100ms）
6. 应用对应的保留策略
```

**敏感数据检测模式**:

| 数据类型 | 检测模式 | 示例 |
|---------|---------|------|
| SSN | `\b\d{3}-\d{2}-\d{4}\b` | 123-45-6789 |
| Email | `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}\b` | user@example.com |
| Phone | `\b\d{3}[-.]?\d{3}[-.]?\d{4}\b` | 123-456-7890 |
| Credit Card | `\b(?:4[0-9]{12}(?:[0-9]{3})?)\b` | 4111111111111111 |
| IP Address | `\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b` | 192.168.1.1 |

**分类级别决策树**:

```
检测到敏感数据？
    │
    ├─ 是 → 包含PHI？
    │         │
    │         ├─ 是 → Critical
    │         │
    │         └─ 否 → 包含PCI？
    │                   │
    │                   ├─ 是 → Restricted
    │                   │
    │                   └─ 否 → 包含Auth？
    │                             │
    │                             ├─ 是 → Confidential
    │                             │
    │                             └─ 否 → Internal
    │
    └─ 否 → Public
```

### 4.3 数据保留流程

**数据保留流程**:

```
1. 调度器触发保留检查（每日）
2. 查询到期数据（按最小保留期）
3. 按分类级别分组
4. 对每个分类级别：
   a. 获取保留策略
   b. 发送到期通知（提前7天）
   c. 执行保留动作：
      - Archive: 归档到S3冷存储
      - Delete: 从ES删除
      - Anonymize: 脱敏处理
   d. 记录审计日志
5. 更新保留统计
```

**保留策略映射**:

| 分类级别 | 保留期 | 动作 | 通知提前期 |
|---------|--------|------|-----------|
| Public | 7天 | Delete | 1天 |
| Internal | 90天 | Archive | 7天 |
| Confidential | 1年 | Archive | 14天 |
| Restricted | 3年 | Anonymize | 30天 |
| Critical | 10年 | Archive | 90天 |

### 4.4 报告生成流程

**报告生成流程**:

```
1. 接收报告生成请求（类型、周期）
2. 并发收集证据：
   a. 配置快照
   b. 审计日志
   c. 检查结果
   d. 用户活动
3. 计算报告指标：
   - 合规分数
   - 违规次数
   - 修复率
   - 平均修复时间
4. 分析合规发现
5. 生成修复建议
6. 使用模板渲染报告
7. 导出为指定格式（PDF/Excel/CSV/JSON）
8. 数字签名（如启用）
9. 加密报告（如启用）
10. 归档报告（保留7年）
11. 发送报告（邮件/API）
12. 记录审计日志
```

**报告生成时序**:

```
API  生成器  证据收集  模板引擎  导出器  归档器
 │     │        │         │        │       │
 │─请求→│        │         │        │       │
 │     │─收集证据→│         │        │       │
 │     │◀─返回证据─│         │        │       │
 │     │─计算指标  │         │        │       │
 │     │─渲染报告──→│         │        │       │
 │     │◀─HTML────│         │        │       │
 │     │─导出PDF──────────→│        │       │
 │     │◀─PDF数据──────────│        │       │
 │     │─归档报告──────────────────→│       │
 │     │◀─归档成功──────────────────│       │
 │◀─报告ID─│        │         │        │       │
```

### 4.5 异常流程

**异常分类与处理**:

| 异常类型 | 触发条件 | 处理策略 | 恢复机制 |
|----------|----------|----------|----------|
| OPA评估失败 | 策略语法错误 | 记录错误+跳过规则 | 修复策略后重新检查 |
| 数据收集失败 | 数据源不可用 | 使用缓存数据+告警 | 数据源恢复后补充 |
| 分类超时 | 处理时间>100ms | 使用默认分类 | 异步重新分类 |
| 归档失败 | S3不可用 | 重试队列+本地缓存 | 指数退避重试 |
| 报告生成失败 | 内存不足 | 分批处理+降级 | 增加资源 |
| 证据收集不完整 | 部分数据缺失 | 标记不完整+继续 | 补充证据 |

**OPA策略错误处理**:

```go
// 策略评估错误处理
func (cc *ComplianceChecker) checkRule(rule *ComplianceRule) *CheckItem {
    item := &CheckItem{
        RuleID:    rule.ID,
        RuleName:  rule.Name,
        CheckedAt: time.Now(),
    }
    
    // 收集输入数据
    input := cc.collectInput(rule)
    
    // 评估策略
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    result, err := cc.opaClient.Evaluate(ctx, rule.Policy, input)
    
    if err != nil {
        // 记录错误
        log.Error("OPA评估失败",
            "rule_id", rule.ID,
            "error", err,
        )
        
        // 标记为错误状态
        item.Status = "error"
        item.Message = fmt.Sprintf("评估失败: %v", err)
        
        // 发送告警
        cc.alertService.Send(&Alert{
            Type:     "compliance_check_error",
            Severity: "high",
            Message:  fmt.Sprintf("规则 %s 评估失败", rule.Name),
            Metadata: map[string]interface{}{
                "rule_id": rule.ID,
                "error":   err.Error(),
            },
        })
        
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
        item.Evidence = cc.collectEvidence(rule, input)
    }
    
    return item
}
```

---

## 5. 接口设计

详见 [API设计文档](./api-design.md) 模块8部分，共40个接口:

**合规检查接口** (10个):
- API-8-279: 执行合规检查
- API-8-280: 获取检查结果
- API-8-281: 列出检查历史
- API-8-282: 获取合规分数
- API-8-283: 配置检查规则
- API-8-284: 获取检查规则
- API-8-285: 启用/禁用规则
- API-8-286: 配置检查调度
- API-8-287: 获取检查调度
- API-8-288: 获取违规告警

**数据分类接口** (7个):
- API-8-289: 分类日志数据
- API-8-290: 获取分类结果
- API-8-291: 批量分类
- API-8-292: 配置分类规则
- API-8-293: 获取分类规则
- API-8-294: 训练ML模型
- API-8-295: 获取分类统计

**数据保留接口** (9个):
- API-8-296: 配置保留策略
- API-8-297: 获取保留策略
- API-8-298: 获取策略详情
- API-8-299: 执行保留动作
- API-8-300: 获取到期数据
- API-8-301: 归档数据
- API-8-302: 删除数据
- API-8-303: 匿名化数据
- API-8-304: 获取保留统计

**合规报告接口** (14个):
- API-8-305: 生成合规报告
- API-8-306: 获取报告详情
- API-8-307: 列出历史报告
- API-8-308: 导出报告
- API-8-309: 下载报告
- API-8-310: 发送报告
- API-8-311: 验证报告签名
- API-8-312: 配置报告模板
- API-8-313: 获取报告模板
- API-8-314: 获取报告指标
- API-8-315: 获取报告证据
- API-8-316: 归档报告
- API-8-317: 搜索报告
- API-8-318: 配置自动报告
- API-8-319: 获取报告调度

---

## 6. 数据设计

### 6.1 数据模型

**合规检查结果**:

```go
// 合规检查结果
type ComplianceCheckResult struct {
    ID           string                 `json:"id" db:"id"`
    Standard     string                 `json:"standard" db:"standard"`      // gdpr/soc2/hipaa
    StartTime    time.Time              `json:"start_time" db:"start_time"`
    EndTime      time.Time              `json:"end_time" db:"end_time"`
    Duration     float64                `json:"duration" db:"duration"`      // 秒
    PassCount    int                    `json:"pass_count" db:"pass_count"`
    FailCount    int                    `json:"fail_count" db:"fail_count"`
    WarningCount int                    `json:"warning_count" db:"warning_count"`
    Score        float64                `json:"score" db:"score"`            // 0-100
    Checks       []byte                 `json:"-" db:"checks"`               // JSON存储
    CreatedAt    time.Time              `json:"created_at" db:"created_at"`
}

// 合规规则
type ComplianceRule struct {
    ID          string    `json:"id" db:"id"`
    Standard    string    `json:"standard" db:"standard"`
    Category    string    `json:"category" db:"category"`
    Name        string    `json:"name" db:"name"`
    Description string    `json:"description" db:"description"`
    Policy      string    `json:"policy" db:"policy"`           // OPA Rego策略
    Severity    string    `json:"severity" db:"severity"`       // critical/high/medium/low
    Remediation string    `json:"remediation" db:"remediation"`
    Enabled     bool      `json:"enabled" db:"enabled"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
```

**数据分类**:

```go
// 分类结果
type ClassificationResult struct {
    ID              string                 `json:"id" db:"id"`
    LogID           string                 `json:"log_id" db:"log_id"`
    Level           string                 `json:"level" db:"level"`              // public/internal/confidential/restricted/critical
    SensitiveTypes  []string               `json:"sensitive_types" db:"-"`        // pii/pci/phi/auth
    Confidence      float64                `json:"confidence" db:"confidence"`
    Reason          string                 `json:"reason" db:"reason"`
    DetectedPatterns map[string][]string   `json:"detected_patterns" db:"-"`
    ClassifiedAt    time.Time              `json:"classified_at" db:"classified_at"`
}

// 分类规则
type ClassificationRule struct {
    ID          string    `json:"id" db:"id"`
    Name        string    `json:"name" db:"name"`
    DataType    string    `json:"data_type" db:"data_type"`     // pii/pci/phi/auth
    Pattern     string    `json:"pattern" db:"pattern"`         // 正则表达式
    Level       string    `json:"level" db:"level"`             // 分类级别
    Priority    int       `json:"priority" db:"priority"`       // 优先级
    Enabled     bool      `json:"enabled" db:"enabled"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
```

**数据保留**:

```go
// 保留策略
type RetentionPolicy struct {
    ID                  string    `json:"id" db:"id"`
    Name                string    `json:"name" db:"name"`
    ClassificationLevel string    `json:"classification_level" db:"classification_level"`
    RetentionDays       int       `json:"retention_days" db:"retention_days"`
    Action              string    `json:"action" db:"action"`                // archive/delete/anonymize
    NotifyBeforeDays    int       `json:"notify_before_days" db:"notify_before_days"`
    Enabled             bool      `json:"enabled" db:"enabled"`
    CreatedAt           time.Time `json:"created_at" db:"created_at"`
    UpdatedAt           time.Time `json:"updated_at" db:"updated_at"`
}

// 保留任务
type RetentionTask struct {
    ID          string    `json:"id" db:"id"`
    PolicyID    string    `json:"policy_id" db:"policy_id"`
    Action      string    `json:"action" db:"action"`
    DataCount   int       `json:"data_count" db:"data_count"`
    Status      string    `json:"status" db:"status"`           // pending/running/completed/failed
    StartTime   time.Time `json:"start_time" db:"start_time"`
    EndTime     time.Time `json:"end_time" db:"end_time"`
    Error       string    `json:"error" db:"error"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
}
```

**合规报告**:

```go
// 合规报告
type ComplianceReport struct {
    ID            string    `json:"id" db:"id"`
    Type          string    `json:"type" db:"type"`               // daily/weekly/monthly/quarterly/annual
    PeriodStart   time.Time `json:"period_start" db:"period_start"`
    PeriodEnd     time.Time `json:"period_end" db:"period_end"`
    GeneratedAt   time.Time `json:"generated_at" db:"generated_at"`
    GeneratedBy   string    `json:"generated_by" db:"generated_by"`
    Metrics       []byte    `json:"-" db:"metrics"`               // JSON存储
    Evidence      []byte    `json:"-" db:"evidence"`              // JSON存储
    Findings      []byte    `json:"-" db:"findings"`              // JSON存储
    Signature     string    `json:"signature" db:"signature"`
    Status        string    `json:"status" db:"status"`           // draft/published/archived
    CreatedAt     time.Time `json:"created_at" db:"created_at"`
}

// 报告模板
type ReportTemplate struct {
    ID          string    `json:"id" db:"id"`
    Name        string    `json:"name" db:"name"`
    Type        string    `json:"type" db:"type"`
    Content     string    `json:"content" db:"content"`         // HTML模板
    Variables   []byte    `json:"variables" db:"variables"`     // JSON存储
    Enabled     bool      `json:"enabled" db:"enabled"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
```

### 6.2 数据库设计

**PostgreSQL表结构**:

```sql
-- 合规检查结果表
CREATE TABLE compliance_check_results (
    id VARCHAR(64) PRIMARY KEY,
    standard VARCHAR(32) NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration FLOAT NOT NULL,
    pass_count INT NOT NULL DEFAULT 0,
    fail_count INT NOT NULL DEFAULT 0,
    warning_count INT NOT NULL DEFAULT 0,
    score FLOAT NOT NULL DEFAULT 0,
    checks JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_standard (standard),
    INDEX idx_created_at (created_at DESC)
);

-- 合规规则表
CREATE TABLE compliance_rules (
    id VARCHAR(64) PRIMARY KEY,
    standard VARCHAR(32) NOT NULL,
    category VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    policy TEXT NOT NULL,
    severity VARCHAR(16) NOT NULL,
    remediation TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_standard (standard),
    INDEX idx_enabled (enabled)
);

-- 分类结果表
CREATE TABLE classification_results (
    id VARCHAR(64) PRIMARY KEY,
    log_id VARCHAR(64) NOT NULL,
    level VARCHAR(32) NOT NULL,
    confidence FLOAT NOT NULL,
    reason VARCHAR(255),
    classified_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_log_id (log_id),
    INDEX idx_level (level),
    INDEX idx_classified_at (classified_at DESC)
);

-- 分类规则表
CREATE TABLE classification_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    data_type VARCHAR(32) NOT NULL,
    pattern TEXT NOT NULL,
    level VARCHAR(32) NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_data_type (data_type),
    INDEX idx_priority (priority DESC)
);

-- 保留策略表
CREATE TABLE retention_policies (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    classification_level VARCHAR(32) NOT NULL,
    retention_days INT NOT NULL,
    action VARCHAR(32) NOT NULL,
    notify_before_days INT NOT NULL DEFAULT 7,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE INDEX idx_level (classification_level)
);

-- 保留任务表
CREATE TABLE retention_tasks (
    id VARCHAR(64) PRIMARY KEY,
    policy_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    data_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_policy_id (policy_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at DESC)
);

-- 合规报告表
CREATE TABLE compliance_reports (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    generated_by VARCHAR(255) NOT NULL,
    metrics JSONB NOT NULL,
    evidence JSONB NOT NULL,
    findings JSONB NOT NULL,
    signature TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_type (type),
    INDEX idx_period (period_start, period_end),
    INDEX idx_generated_at (generated_at DESC)
);

-- 报告模板表
CREATE TABLE report_templates (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    variables JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_type (type),
    INDEX idx_enabled (enabled)
);

-- 审计日志表
CREATE TABLE compliance_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64),
    user_id VARCHAR(64) NOT NULL,
    user_ip VARCHAR(64),
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_timestamp (timestamp DESC),
    INDEX idx_action (action),
    INDEX idx_user_id (user_id)
);
```

### 6.3 缓存设计

**Redis缓存策略**:

| 缓存类型 | Key格式 | TTL | 说明 |
|---------|---------|-----|------|
| 分类结果 | `classification:result:{log_id}` | 3600s | 日志分类结果缓存 |
| 分类规则 | `classification:rules` | 永久 | 分类规则列表 |
| 合规规则 | `compliance:rules:{standard}` | 永久 | 合规规则列表 |
| 保留策略 | `retention:policies` | 永久 | 保留策略列表 |
| 合规分数 | `compliance:score:{standard}` | 300s | 最新合规分数 |
| 报告模板 | `report:template:{type}` | 永久 | 报告模板内容 |
| 配置项 | `config:compliance:{key}` | 永久 | 合规配置项 |

**缓存更新策略**:

```go
// 缓存更新示例
func (s *ComplianceService) UpdateRule(rule *ComplianceRule) error {
    // 1. 更新数据库
    if err := s.db.UpdateRule(rule); err != nil {
        return err
    }
    
    // 2. 删除缓存
    cacheKey := fmt.Sprintf("compliance:rules:%s", rule.Standard)
    s.redis.Del(cacheKey)
    
    // 3. 发布配置变更通知
    s.redis.Publish("config:compliance:reload", rule.Standard)
    
    return nil
}
```

---

## 7. 安全设计

### 7.1 认证与授权

**权限模型**:

| 权限 | 说明 | 适用角色 |
|------|------|----------|
| compliance.read | 查看合规检查结果 | 合规官、审计员、管理员 |
| compliance.write | 执行合规检查、配置规则 | 合规官、管理员 |
| compliance.admin | 管理合规策略、自定义规则 | 管理员 |
| classification.read | 查看分类结果 | 合规官、审计员、管理员 |
| classification.write | 执行分类、配置规则 | 合规官、管理员 |
| classification.admin | 训练ML模型 | 管理员 |
| retention.read | 查看保留策略 | 合规官、审计员、管理员 |
| retention.write | 配置保留策略、执行保留动作 | 合规官、管理员 |
| report.read | 查看合规报告 | 合规官、审计员、管理员 |
| report.write | 生成报告、配置模板 | 合规官、管理员 |

**认证机制**:

```go
// JWT Token验证
func (s *ComplianceService) ValidateToken(token string) (*User, error) {
    claims, err := jwt.Parse(token, s.jwtSecret)
    if err != nil {
        return nil, err
    }
    
    // 验证权限
    if !claims.HasPermission("compliance.read") {
        return nil, ErrUnauthorized
    }
    
    return &User{
        ID:          claims.UserID,
        Username:    claims.Username,
        Permissions: claims.Permissions,
    }, nil
}
```

### 7.2 数据安全

**敏感数据保护**:

| 数据类型 | 保护措施 | 实现方式 |
|---------|---------|----------|
| OPA策略 | 加密存储 | AES-256-GCM |
| 合规报告 | 加密+签名 | AES-256-GCM + RSA-2048 |
| 审计日志 | 不可篡改 | 哈希链 + 时间戳 |
| 分类结果 | 访问控制 | RBAC |
| 保留策略 | 版本控制 | PostgreSQL版本表 |

**加密实现**:

```go
// 报告加密
func (rg *ReportGenerator) encryptReport(data []byte) ([]byte, error) {
    // 生成随机密钥
    key := make([]byte, 32)
    if _, err := rand.Read(key); err != nil {
        return nil, err
    }
    
    // AES-256-GCM加密
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := rand.Read(nonce); err != nil {
        return nil, err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, data, nil)
    
    // 使用RSA加密密钥
    encryptedKey, err := rsa.EncryptOAEP(
        sha256.New(),
        rand.Reader,
        rg.publicKey,
        key,
        nil,
    )
    
    // 组合加密密钥和密文
    return append(encryptedKey, ciphertext...), nil
}
```

### 7.3 审计日志

**审计事件**:

| 事件类型 | 记录内容 | 保留期 |
|---------|---------|--------|
| 合规检查 | 检查时间、标准、结果、执行人 | 3年 |
| 规则变更 | 变更前后、变更人、变更时间 | 3年 |
| 数据分类 | 分类结果、置信度、时间 | 1年 |
| 保留动作 | 动作类型、数据量、执行人 | 7年 |
| 报告生成 | 报告类型、周期、生成人 | 7年 |
| 报告访问 | 访问人、访问时间、IP地址 | 7年 |
| 配置变更 | 配置项、变更前后、变更人 | 3年 |

**审计日志实现**:

```go
// 审计日志记录
func (s *ComplianceService) AuditLog(event *AuditEvent) error {
    log := &AuditLog{
        ID:           generateID(),
        Timestamp:    time.Now(),
        Action:       event.Action,
        ResourceType: event.ResourceType,
        ResourceID:   event.ResourceID,
        UserID:       event.UserID,
        UserIP:       event.UserIP,
        Details:      event.Details,
        PrevHash:     s.getLastLogHash(),
    }
    
    // 计算当前日志哈希（包含前一条日志哈希）
    log.Hash = s.calculateHash(log)
    
    // 保存到数据库
    if err := s.db.SaveAuditLog(log); err != nil {
        return err
    }
    
    // 异步发送到审计系统
    go s.sendToAuditSystem(log)
    
    return nil
}

// 计算哈希（防篡改）
func (s *ComplianceService) calculateHash(log *AuditLog) string {
    data := fmt.Sprintf("%s|%s|%s|%s|%s|%s",
        log.Timestamp.Format(time.RFC3339Nano),
        log.Action,
        log.ResourceType,
        log.ResourceID,
        log.UserID,
        log.PrevHash,
    )
    
    hash := sha256.Sum256([]byte(data))
    return hex.EncodeToString(hash[:])
}
```

### 7.4 安全合规

**符合的安全标准**:

- GDPR: 数据保护、隐私权、数据可携权
- SOC 2: 安全控制、访问控制、变更管理
- HIPAA: PHI保护、访问审计、加密传输
- ISO 27001: 信息安全管理体系

**安全检查清单**:

- [x] 所有API需要身份认证
- [x] 敏感数据加密存储
- [x] 传输层使用TLS 1.3
- [x] 审计日志不可篡改
- [x] 定期安全扫描
- [x] 最小权限原则
- [x] 密钥定期轮换
- [x] 安全配置基线

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 合规检查延迟 | < 30s (47项检查) | 时间戳差值 |
| 数据分类延迟 | < 100ms | 时间戳差值 |
| 报告生成时间 | < 30s (1000条记录) | 时间戳差值 |
| OPA策略评估 | < 10ms/规则 | Prometheus监控 |
| 分类缓存命中率 | > 80% | Redis统计 |
| 保留任务吞吐 | 10000条/分钟 | 计数器统计 |
| API响应时间 | P95 < 500ms | Prometheus监控 |
| 并发检查数 | 支持10个并发 | 压力测试 |

### 8.2 优化策略

**合规检查优化**:

```go
// 并发执行规则检查
func (cc *ComplianceChecker) checkRulesConcurrently(rules []*ComplianceRule) []*CheckItem {
    results := make([]*CheckItem, len(rules))
    var wg sync.WaitGroup
    
    // 使用worker池限制并发数
    workerPool := make(chan struct{}, 10)
    
    for i, rule := range rules {
        wg.Add(1)
        go func(idx int, r *ComplianceRule) {
            defer wg.Done()
            
            workerPool <- struct{}{}        // 获取worker
            defer func() { <-workerPool }() // 释放worker
            
            results[idx] = cc.checkRule(r)
        }(i, rule)
    }
    
    wg.Wait()
    return results
}
```

**数据分类优化**:

1. **缓存优化**: Redis缓存分类结果，TTL 1小时
2. **批量处理**: 批量分类1000条日志，减少网络开销
3. **正则预编译**: 启动时预编译所有正则表达式
4. **ML模型优化**: 使用ONNX Runtime加速推理

```go
// 批量分类优化
func (dc *DataClassifier) ClassifyBatch(logs []*LogEntry) ([]*ClassificationResult, error) {
    results := make([]*ClassificationResult, len(logs))
    
    // 1. 批量检查缓存
    cacheKeys := make([]string, len(logs))
    for i, log := range logs {
        cacheKeys[i] = fmt.Sprintf("classification:result:%s", log.ID)
    }
    
    cached := dc.cache.MGet(cacheKeys)
    
    // 2. 只处理未缓存的日志
    var uncached []*LogEntry
    var uncachedIdx []int
    
    for i, log := range logs {
        if cached[i] != nil {
            results[i] = cached[i].(*ClassificationResult)
        } else {
            uncached = append(uncached, log)
            uncachedIdx = append(uncachedIdx, i)
        }
    }
    
    // 3. 批量分类未缓存的日志
    if len(uncached) > 0 {
        classified := dc.classifyBatchInternal(uncached)
        
        // 4. 批量写入缓存
        for i, result := range classified {
            idx := uncachedIdx[i]
            results[idx] = result
            dc.cache.Set(cacheKeys[idx], result, 3600)
        }
    }
    
    return results, nil
}
```

**报告生成优化**:

1. **并发收集证据**: 4个goroutine并发收集不同类型证据
2. **流式处理**: 大数据量使用流式处理，避免内存溢出
3. **模板缓存**: 缓存编译后的模板，避免重复解析
4. **异步归档**: 报告归档异步执行，不阻塞响应

```go
// 流式报告生成
func (rg *ReportGenerator) GenerateStreamingReport(ctx context.Context, period ReportPeriod) error {
    // 创建输出流
    writer := rg.createWriter()
    defer writer.Close()
    
    // 写入报告头
    writer.WriteHeader(period)
    
    // 流式处理检查结果
    cursor := rg.checkStore.StreamResults(ctx, period)
    defer cursor.Close()
    
    for cursor.Next() {
        result := cursor.Value()
        
        // 增量计算指标
        rg.updateMetrics(result)
        
        // 写入报告内容
        writer.WriteResult(result)
    }
    
    // 写入报告尾
    writer.WriteFooter(rg.getMetrics())
    
    return nil
}
```

**保留任务优化**:

1. **批量删除**: 每批1000条，减少数据库压力
2. **分片处理**: 按时间分片，避免长事务
3. **异步执行**: 保留任务异步执行，不阻塞主流程
4. **限流控制**: 限制删除速率，避免影响在线服务

### 8.3 性能监控

**关键性能指标**:

```go
// Prometheus指标定义
var (
    // 合规检查指标
    complianceCheckDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "compliance_check_duration_seconds",
            Help:    "合规检查耗时",
            Buckets: []float64{1, 5, 10, 30, 60},
        },
        []string{"standard"},
    )
    
    complianceCheckTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "compliance_check_total",
            Help: "合规检查总数",
        },
        []string{"standard", "status"},
    )
    
    // 数据分类指标
    classificationDuration = prometheus.NewHistogram(
        prometheus.HistogramOpts{
            Name:    "classification_duration_milliseconds",
            Help:    "数据分类耗时",
            Buckets: []float64{10, 50, 100, 200, 500},
        },
    )
    
    classificationCacheHitRate = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "classification_cache_hit_rate",
            Help: "分类缓存命中率",
        },
    )
    
    // 报告生成指标
    reportGenerationDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "report_generation_duration_seconds",
            Help:    "报告生成耗时",
            Buckets: []float64{5, 10, 30, 60, 120},
        },
        []string{"type"},
    )
    
    // 保留任务指标
    retentionTaskDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "retention_task_duration_seconds",
            Help:    "保留任务耗时",
            Buckets: []float64{10, 30, 60, 300, 600},
        },
        []string{"action"},
    )
    
    retentionDataProcessed = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "retention_data_processed_total",
            Help: "保留任务处理数据量",
        },
        []string{"action", "status"},
    )
)
```

---

## 9. 部署方案

### 9.1 部署架构

**Kubernetes部署**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: compliance-service
  namespace: log-management
spec:
  replicas: 3
  selector:
    matchLabels:
      app: compliance-service
  template:
    metadata:
      labels:
        app: compliance-service
    spec:
      containers:
      - name: compliance
        image: log-management/compliance:v1.0
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: POSTGRES_HOST
          value: postgres-service
        - name: REDIS_HOST
          value: redis-service
        - name: OPA_URL
          value: http://opa-service:8181
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
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
        volumeMounts:
        - name: config
          mountPath: /etc/compliance
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: compliance-config
---
apiVersion: v1
kind: Service
metadata:
  name: compliance-service
  namespace: log-management
spec:
  selector:
    app: compliance-service
  ports:
  - name: http
    port: 8080
    targetPort: 8080
  - name: metrics
    port: 9090
    targetPort: 9090
  type: ClusterIP
```

**OPA部署**:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: opa
  namespace: log-management
spec:
  replicas: 2
  selector:
    matchLabels:
      app: opa
  template:
    metadata:
      labels:
        app: opa
    spec:
      containers:
      - name: opa
        image: openpolicyagent/opa:0.60.0
        args:
        - "run"
        - "--server"
        - "--addr=0.0.0.0:8181"
        - "--log-level=info"
        ports:
        - containerPort: 8181
          name: http
        resources:
          requests:
            cpu: 200m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 2Gi
        volumeMounts:
        - name: policies
          mountPath: /policies
          readOnly: true
      volumes:
      - name: policies
        configMap:
          name: opa-policies
```

### 9.2 资源配置

| 环境 | 组件 | 副本数 | CPU | 内存 | 存储 |
|------|------|--------|-----|------|------|
| 开发 | Compliance Service | 1 | 0.5核 | 1GB | - |
| 开发 | OPA | 1 | 0.2核 | 512MB | - |
| 测试 | Compliance Service | 2 | 1核 | 2GB | - |
| 测试 | OPA | 2 | 0.5核 | 1GB | - |
| 生产 | Compliance Service | 3 | 2核 | 4GB | - |
| 生产 | OPA | 2 | 1核 | 2GB | - |
| 生产 | PostgreSQL | 3 | 4核 | 8GB | 500GB SSD |
| 生产 | Redis | 3 | 2核 | 4GB | 100GB SSD |

### 9.3 配置管理

**ConfigMap配置**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: compliance-config
  namespace: log-management
data:
  config.yaml: |
    compliance:
      enabled: true
      standards:
        - gdpr
        - soc2
        - hipaa
      check_interval: 24h
      alert_threshold: 5
      retention_years: 3
    
    classification:
      enabled: true
      ml_enabled: false
      cache_enabled: true
      cache_ttl: 3600
      confidence_threshold: 0.8
    
    retention:
      enabled: true
      check_interval: 24h
      batch_size: 1000
      notify_enabled: true
      approval_required: false
    
    report:
      enabled: true
      template_dir: /templates
      output_dir: /reports
      archive_enabled: true
      archive_retention: 2555d  # 7年
      sign_enabled: true
      encrypt_enabled: true
```

**Secret配置**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: compliance-secrets
  namespace: log-management
type: Opaque
data:
  postgres-password: <base64-encoded>
  redis-password: <base64-encoded>
  jwt-secret: <base64-encoded>
  encryption-key: <base64-encoded>
  signing-key: <base64-encoded>
```

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus指标**:

```
# 合规检查指标
compliance_check_duration_seconds{standard="gdpr"} 25.3
compliance_check_total{standard="gdpr",status="success"} 150
compliance_check_total{standard="gdpr",status="failed"} 5
compliance_score{standard="gdpr"} 95.5
compliance_violations_total{standard="gdpr",severity="critical"} 2

# 数据分类指标
classification_duration_milliseconds 85
classification_total{level="confidential"} 1500
classification_cache_hit_rate 0.85
classification_ml_predictions_total 500

# 保留任务指标
retention_task_duration_seconds{action="archive"} 120
retention_data_processed_total{action="archive",status="success"} 50000
retention_data_processed_total{action="delete",status="success"} 10000
retention_task_errors_total{action="archive"} 2

# 报告生成指标
report_generation_duration_seconds{type="monthly"} 28
report_generation_total{type="monthly",status="success"} 12
report_size_bytes{type="monthly"} 5242880
report_evidence_items_total{type="monthly"} 1000

# OPA指标
opa_policy_evaluation_duration_seconds 0.008
opa_policy_evaluation_total{decision="allow"} 1000
opa_policy_evaluation_total{decision="deny"} 50

# 系统指标
compliance_service_up 1
compliance_service_cpu_usage_percent 45
compliance_service_memory_usage_bytes 2147483648
compliance_service_goroutines 150
```

### 10.2 告警规则

**Prometheus告警规则**:

```yaml
groups:
- name: compliance_alerts
  interval: 30s
  rules:
  # 合规分数告警
  - alert: ComplianceScoreLow
    expr: compliance_score < 80
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "合规分数过低"
      description: "{{ $labels.standard }} 合规分数为 {{ $value }}%，低于80%阈值"
  
  # 严重违规告警
  - alert: CriticalViolations
    expr: compliance_violations_total{severity="critical"} > 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "发现严重合规违规"
      description: "{{ $labels.standard }} 发现 {{ $value }} 个严重违规项"
  
  # 合规检查失败告警
  - alert: ComplianceCheckFailed
    expr: rate(compliance_check_total{status="failed"}[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "合规检查失败率过高"
      description: "{{ $labels.standard }} 检查失败率为 {{ $value | humanizePercentage }}"
  
  # 分类延迟告警
  - alert: ClassificationLatencyHigh
    expr: histogram_quantile(0.95, classification_duration_milliseconds) > 200
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "数据分类延迟过高"
      description: "P95分类延迟为 {{ $value }}ms，超过200ms阈值"
  
  # 缓存命中率告警
  - alert: CacheHitRateLow
    expr: classification_cache_hit_rate < 0.7
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "分类缓存命中率过低"
      description: "缓存命中率为 {{ $value | humanizePercentage }}，低于70%"
  
  # 保留任务失败告警
  - alert: RetentionTaskFailed
    expr: rate(retention_task_errors_total[5m]) > 0
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "保留任务执行失败"
      description: "{{ $labels.action }} 任务失败率为 {{ $value }}"
  
  # 报告生成超时告警
  - alert: ReportGenerationTimeout
    expr: report_generation_duration_seconds > 60
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "报告生成超时"
      description: "{{ $labels.type }} 报告生成耗时 {{ $value }}s，超过60s阈值"
  
  # OPA评估延迟告警
  - alert: OPAEvaluationSlow
    expr: histogram_quantile(0.95, opa_policy_evaluation_duration_seconds) > 0.05
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "OPA策略评估延迟过高"
      description: "P95评估延迟为 {{ $value }}s，超过50ms阈值"
  
  # 服务不可用告警
  - alert: ComplianceServiceDown
    expr: up{job="compliance-service"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "合规服务不可用"
      description: "合规服务已停止响应超过1分钟"
```

### 10.3 日志规范

**日志级别**:

- DEBUG: 详细调试信息（开发环境）
- INFO: 正常运行信息（生产环境默认）
- WARN: 警告信息（不影响功能）
- ERROR: 错误信息（需要关注）
- FATAL: 致命错误（服务退出）

**日志格式**:

```json
{
  "timestamp": "2026-01-31T12:00:00Z",
  "level": "INFO",
  "service": "compliance",
  "component": "checker",
  "message": "合规检查完成",
  "standard": "gdpr",
  "duration_ms": 25300,
  "pass_count": 14,
  "fail_count": 1,
  "score": 93.3,
  "trace_id": "abc123",
  "user_id": "user-001"
}
```

### 10.4 运维操作

**常见运维任务**:

1. **手动触发合规检查**:
```bash
curl -X POST http://compliance-service:8080/api/v1/compliance/check \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"standard":"gdpr","scope":"all"}'
```

2. **查看合规分数**:
```bash
curl http://compliance-service:8080/api/v1/compliance/score \
  -H "Authorization: Bearer $TOKEN"
```

3. **生成合规报告**:
```bash
curl -X POST http://compliance-service:8080/api/v1/reports/generate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"monthly","period":{"start":"2026-01-01","end":"2026-01-31"}}'
```

4. **查看保留任务状态**:
```bash
kubectl logs -n log-management -l app=compliance-service --tail=100 | grep retention
```

5. **重启服务**:
```bash
kubectl rollout restart deployment/compliance-service -n log-management
```

6. **扩容服务**:
```bash
kubectl scale deployment/compliance-service --replicas=5 -n log-management
```

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

```
┌─────────────────────────────────────────────────────────────┐
│  基础设施层 (Kubernetes + OPA + PostgreSQL)                 │
│  ❌ 不支持热更新，需要 kubectl apply + 滚动重启              │
│  - OPA服务器配置、PostgreSQL部署配置、资源限制               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  连接层 (基础服务连接)                                       │
│  ⚠️ 不推荐热更新，建议通过YAML文件更新并重启服务             │
│  - PostgreSQL连接、Redis连接、OPA服务地址                   │
│  原因：需要重建连接池和客户端，可能导致合规检查中断          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  应用层 (业务配置)                                           │
│  ✅ 推荐热更新，通过Redis Pub/Sub立即生效                    │
│  - 合规规则、数据分类、保留策略、报告配置                    │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| **合规检查配置** |
| compliance_enabled | bool | true | 是否启用合规检查 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| compliance_standards | array | ["gdpr","soc2","hipaa"] | 启用的合规标准 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| check_interval | int | 24 | 检查间隔(小时) | Redis Pub/Sub | 下次调度 | ✅ 推荐 |
| alert_threshold | int | 5 | 告警阈值(违规数) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| retention_years | int | 3 | 检查结果保留年限 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| custom_rules | array | [] | 自定义OPA规则列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **数据分类配置** |
| classification_enabled | bool | true | 是否启用数据分类 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| ml_enabled | bool | false | 是否启用ML分类 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| cache_enabled | bool | true | 是否启用分类缓存 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| cache_ttl | int | 3600 | 缓存过期时间(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| confidence_threshold | float | 0.8 | ML分类置信度阈值 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| patterns | object | {} | 敏感数据检测模式 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **数据保留配置** |
| retention_enabled | bool | true | 是否启用保留管理 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| retention_check_interval | int | 24 | 保留检查间隔(小时) | Redis Pub/Sub | 下次调度 | ✅ 推荐 |
| retention_batch_size | int | 1000 | 批量处理大小 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| notify_enabled | bool | true | 是否启用到期通知 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| approval_required | bool | false | 是否需要审批 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| retention_policies | array | [] | 保留策略列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **合规报告配置** |
| report_enabled | bool | true | 是否启用报告生成 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| report_template_dir | string | "/templates" | 报告模板目录 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| report_output_dir | string | "/reports" | 报告输出目录 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| archive_enabled | bool | true | 是否启用报告归档 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| archive_retention | int | 2555 | 归档保留天数(7年) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| sign_enabled | bool | true | 是否启用数字签名 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| encrypt_enabled | bool | true | 是否启用报告加密 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| auto_send_enabled | bool | false | 是否自动发送报告 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| recipients | array | [] | 报告接收人列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| report_formats | array | ["pdf","excel"] | 默认导出格式 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **连接配置(不推荐热更新)** |
| postgresql_host | string | "postgres" | PostgreSQL主机 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| postgresql_port | int | 5432 | PostgreSQL端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| postgresql_max_connections | int | 100 | 最大连接数 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| opa_url | string | "http://opa:8181" | OPA服务地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| elasticsearch_urls | array | [] | ES集群地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |

**不推荐热更新的原因说明**:

1. **PostgreSQL连接配置**:
   - 需要重建数据库连接池
   - 可能导致正在进行的合规检查失败
   - 建议：通过YAML文件更新并滚动重启

2. **Redis连接配置**:
   - 需要重建Redis客户端连接
   - 可能导致配置缓存访问失败
   - 建议：通过YAML文件更新并滚动重启

3. **OPA服务地址**:
   - 需要重新初始化OPA客户端
   - 可能导致策略评估失败
   - 建议：通过YAML文件更新并滚动重启

4. **Elasticsearch连接配置**:
   - 需要重建ES客户端连接
   - 可能导致审计日志写入失败
   - 建议：通过YAML文件更新并滚动重启

**备用更新方式**:
- 如果Redis不可用，支持通过YAML配置文件更新，需要重启服务
- 配置文件路径: `/etc/compliance-manager/config.yaml`
- 重启命令: `kubectl rollout restart deployment/compliance-service`

### 11.3 热更新实现

由于代码较长，这里提供核心实现框架。完整实现请参考模块2和模块7的热更新实现模式。

**核心配置管理器**:

```go
// ComplianceConfigManager 合规配置管理器
type ComplianceConfigManager struct {
    // 使用atomic.Value实现无锁读取
    complianceConfig   atomic.Value  // *ComplianceCheckConfig
    classificationConfig atomic.Value  // *ClassificationConfig
    retentionConfig    atomic.Value  // *RetentionConfig
    reportConfig       atomic.Value  // *ReportConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
    opa    *OPAClient
    
    // 扩展接口
    configHooks  []ConfigHook  // 配置变更钩子
    validators   []ConfigValidator  // 配置验证器
}

// ConfigHook 配置变更钩子接口(扩展点)
type ConfigHook interface {
    OnConfigChange(configType string, oldConfig, newConfig interface{}) error
    Name() string
}

// ConfigValidator 配置验证器接口(扩展点)
type ConfigValidator interface {
    Validate(configType string, config interface{}) error
    Name() string
}
```

**配置结构定义**:

```go
// ComplianceCheckConfig 合规检查配置
type ComplianceCheckConfig struct {
    Enabled         bool              `json:"enabled"`
    Standards       []string          `json:"standards"`
    CheckInterval   int               `json:"check_interval"`
    AlertThreshold  int               `json:"alert_threshold"`
    RetentionYears  int               `json:"retention_years"`
    CustomRules     []ComplianceRule  `json:"custom_rules"`
    UpdatedAt       time.Time         `json:"updated_at"`
}

// ComplianceRule 合规规则
type ComplianceRule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Standard    string                 `json:"standard"`  // gdpr/soc2/hipaa/custom
    Severity    string                 `json:"severity"`  // critical/high/medium/low
    Policy      string                 `json:"policy"`    // OPA策略代码
    Enabled     bool                   `json:"enabled"`
    UpdatedAt   time.Time              `json:"updated_at"`
}

// ClassificationConfig 数据分类配置
type ClassificationConfig struct {
    Enabled             bool              `json:"enabled"`
    MLEnabled           bool              `json:"ml_enabled"`
    CacheEnabled        bool              `json:"cache_enabled"`
    CacheTTL            int               `json:"cache_ttl"`
    ConfidenceThreshold float64           `json:"confidence_threshold"`
    Patterns            map[string]string `json:"patterns"`
    UpdatedAt           time.Time         `json:"updated_at"`
}

// RetentionConfig 数据保留配置
type RetentionConfig struct {
    Enabled         bool              `json:"enabled"`
    CheckInterval   int               `json:"check_interval"`
    BatchSize       int               `json:"batch_size"`
    NotifyEnabled   bool              `json:"notify_enabled"`
    ApprovalRequired bool             `json:"approval_required"`
    Policies        []RetentionPolicy `json:"policies"`
    UpdatedAt       time.Time         `json:"updated_at"`
}

// RetentionPolicy 保留策略
type RetentionPolicy struct {
    ID            string    `json:"id"`
    Name          string    `json:"name"`
    DataType      string    `json:"data_type"`
    RetentionDays int       `json:"retention_days"`
    Action        string    `json:"action"`  // archive/delete/anonymize
    Enabled       bool      `json:"enabled"`
    Priority      int       `json:"priority"`
    UpdatedAt     time.Time `json:"updated_at"`
}
```

**配置热更新流程**:

```go
// Start 启动配置热更新监听
func (ccm *ComplianceConfigManager) Start(ctx context.Context) error {
    go ccm.watchConfigChanges(ctx)
    log.Info("合规配置热更新监听已启动")
    return nil
}

// watchConfigChanges 监听配置变更
func (ccm *ComplianceConfigManager) watchConfigChanges(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-ccm.pubsub.Channel():
            ccm.handleConfigChange(msg)
        }
    }
}

// handleConfigChange 处理配置变更
func (ccm *ComplianceConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到合规配置变更通知: %s", msg.Payload)
    
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型重新加载
    switch change.Type {
    case "compliance":
        ccm.reloadComplianceConfig()
    case "classification":
        ccm.reloadClassificationConfig()
    case "retention":
        ccm.reloadRetentionConfig()
    case "report":
        ccm.reloadReportConfig()
    case "all":
        ccm.reloadAllConfig()
    }
}

// reloadComplianceConfig 重新加载合规检查配置
func (ccm *ComplianceConfigManager) reloadComplianceConfig() {
    log.Info("开始重新加载合规检查配置")
    
    // 1. 从Redis加载配置
    configJSON, err := ccm.redis.Get("config:compliance:check")
    if err != nil {
        log.Errorf("从Redis加载合规配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig ComplianceCheckConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析合规配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := ccm.validateComplianceConfig(&newConfig); err != nil {
        log.Errorf("合规配置验证失败: %v", err)
        return
    }
    
    // 4. 验证OPA策略
    for _, rule := range newConfig.CustomRules {
        if err := ccm.validateOPAPolicy(rule.Policy); err != nil {
            log.Errorf("OPA策略验证失败: rule=%s, error=%v", rule.ID, err)
            return
        }
    }
    
    // 5. 执行配置变更钩子
    oldConfig := ccm.GetComplianceConfig()
    for _, hook := range ccm.configHooks {
        if err := hook.OnConfigChange("compliance", oldConfig, &newConfig); err != nil {
            log.Errorf("配置钩子执行失败: %s, error: %v", hook.Name(), err)
            return
        }
    }
    
    // 6. 原子更新配置
    ccm.complianceConfig.Store(&newConfig)
    
    // 7. 重新加载OPA策略
    if err := ccm.reloadOPAPolicies(&newConfig); err != nil {
        log.Errorf("重新加载OPA策略失败: %v", err)
    }
    
    // 8. 记录审计日志
    ccm.logConfigChange("compliance", &newConfig)
    
    log.Info("合规检查配置重新加载完成")
}
```

**配置验证**:

```go
// validateComplianceConfig 验证合规检查配置
func (ccm *ComplianceConfigManager) validateComplianceConfig(config *ComplianceCheckConfig) error {
    if config.CheckInterval < 1 || config.CheckInterval > 168 {
        return fmt.Errorf("检查间隔必须在1-168小时之间")
    }
    
    validStandards := map[string]bool{"gdpr": true, "soc2": true, "hipaa": true, "pci-dss": true}
    for _, std := range config.Standards {
        if !validStandards[std] {
            return fmt.Errorf("不支持的合规标准: %s", std)
        }
    }
    
    return nil
}

// validateOPAPolicy 验证OPA策略
func (ccm *ComplianceConfigManager) validateOPAPolicy(policy string) error {
    return ccm.opa.ValidatePolicy(policy)
}
```

**配置获取方法（无锁读取）**:

```go
func (ccm *ComplianceConfigManager) GetComplianceConfig() *ComplianceCheckConfig {
    if config := ccm.complianceConfig.Load(); config != nil {
        return config.(*ComplianceCheckConfig)
    }
    return &ComplianceCheckConfig{}
}

func (ccm *ComplianceConfigManager) GetClassificationConfig() *ClassificationConfig {
    if config := ccm.classificationConfig.Load(); config != nil {
        return config.(*ClassificationConfig)
    }
    return &ClassificationConfig{}
}

func (ccm *ComplianceConfigManager) GetRetentionConfig() *RetentionConfig {
    if config := ccm.retentionConfig.Load(); config != nil {
        return config.(*RetentionConfig)
    }
    return &RetentionConfig{}
}
```

### 11.4 YAML配置文件备用方案

**配置文件结构** (`/etc/compliance-manager/config.yaml`):

```yaml
# 合规管理器配置文件
# 注意: 此配置文件仅在Redis不可用时使用，需要重启服务生效

# 合规检查配置 (✅ 支持热更新)
compliance:
  enabled: true
  standards: [gdpr, soc2, hipaa]
  check_interval: 24  # 小时
  alert_threshold: 5
  retention_years: 3
  custom_rules:
    - id: "rule-001"
      name: "PII数据访问审计"
      standard: "gdpr"
      severity: "critical"
      policy: |
        package compliance.pii_access
        default allow = false
        allow {
          input.action == "read"
          input.resource.type == "pii"
          input.audit_enabled == true
        }
      enabled: true

# 数据分类配置 (✅ 支持热更新)
classification:
  enabled: true
  ml_enabled: false
  cache_enabled: true
  cache_ttl: 3600
  confidence_threshold: 0.8
  patterns:
    email: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
    phone: "\\+?[1-9]\\d{1,14}"
    ssn: "\\d{3}-\\d{2}-\\d{4}"
    credit_card: "\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}"

# 数据保留配置 (✅ 支持热更新)
retention:
  enabled: true
  check_interval: 24
  batch_size: 1000
  notify_enabled: true
  approval_required: false
  policies:
    - id: "policy-001"
      name: "日志数据保留"
      data_type: "logs"
      retention_days: 90
      action: "archive"
      enabled: true
      priority: 100

# 报告配置 (✅ 支持热更新)
report:
  enabled: true
  template_dir: "/etc/compliance-manager/templates"
  output_dir: "/var/compliance-manager/reports"
  archive_enabled: true
  archive_retention: 2555  # 7年
  sign_enabled: true
  encrypt_enabled: true
  auto_send_enabled: false
  recipients: [compliance@example.com]
  formats: [pdf, excel]

# PostgreSQL连接配置 (⚠️ 不推荐热更新)
postgresql:
  host: "postgres"
  port: 5432
  database: "logdb"
  username: "admin"
  password: "${POSTGRES_PASSWORD}"
  max_connections: 100

# Redis连接配置 (⚠️ 不推荐热更新)
redis:
  address: "redis:6379"
  password: "${REDIS_PASSWORD}"
  db: 0
  pool_size: 100

# OPA配置 (⚠️ 不推荐热更新)
opa:
  url: "http://opa:8181"
  timeout: 5000

# Elasticsearch配置 (⚠️ 不推荐热更新)
elasticsearch:
  urls: ["http://es-node1:9200"]
  username: "elastic"
  password: "${ES_PASSWORD}"
```

### 11.5 热更新验收标准

1. ✅ **配置变更后3秒内生效**: 通过Redis Pub/Sub实现，延迟< 1秒
2. ✅ **配置无效时保持原配置**: 验证失败时不更新atomic.Value
3. ✅ **支持API查询当前配置**: 提供GET /api/v1/compliance/config接口
4. ✅ **记录配置变更审计日志**: 所有变更记录到audit_logs表
5. ✅ **OPA策略验证**: 策略变更前验证语法正确性
6. ✅ **合规规则变更立即生效**: 下次检查时使用新规则
7. ✅ **保留策略变更立即生效**: 下次保留检查时使用新策略
8. ✅ **数据分类模式变更立即生效**: 下次分类时使用新模式
9. ✅ **报告配置变更立即生效**: 下次生成报告时使用新配置
10. ✅ **支持扩展接口**: 提供ConfigHook和ConfigValidator扩展点

// 获取当前配置（无锁读取）
func (cm *ComplianceConfigManager) GetConfig() *ComplianceConfig {
    return cm.config.Load().(*ComplianceConfig)
}

// 审计配置变更
func (cm *ComplianceConfigManager) auditConfigChange(oldConfig, newConfig *ComplianceConfig) {
    auditLog := &AuditLog{
        Timestamp:    time.Now(),
        Action:       "config_change",
        ResourceType: "compliance_config",
        ResourceID:   fmt.Sprintf("v%d", newConfig.Version),
        Details: map[string]interface{}{
            "old_version": oldConfig.Version,
            "new_version": newConfig.Version,
            "changes":     cm.diffConfig(oldConfig, newConfig),
        },
    }
    
    auditService.Log(auditLog)
}

// 对比配置差异
func (cm *ComplianceConfigManager) diffConfig(oldConfig, newConfig *ComplianceConfig) []string {
    var changes []string
    
    if !reflect.DeepEqual(oldConfig.Compliance, newConfig.Compliance) {
        changes = append(changes, "compliance")
    }
    if !reflect.DeepEqual(oldConfig.Classification, newConfig.Classification) {
        changes = append(changes, "classification")
    }
    if !reflect.DeepEqual(oldConfig.Retention, newConfig.Retention) {
        changes = append(changes, "retention")
    }
    if !reflect.DeepEqual(oldConfig.Report, newConfig.Report) {
        changes = append(changes, "report")
    }
    
    return changes
}
```

### 11.3 热更新验收标准

1. ✅ **生效时间**: 配置变更后3秒内生效
2. ✅ **配置验证**: 配置无效时保持原配置并记录错误日志
3. ✅ **API查询**: 支持通过API查询当前生效的配置值
4. ✅ **审计日志**: 记录所有配置变更的审计日志
5. ✅ **策略验证**: 自定义规则变更时验证OPA策略语法
6. ✅ **正则验证**: 敏感数据检测模式变更时验证正则表达式
7. ✅ **零停机**: 配置更新不影响正在执行的任务
8. ✅ **回滚支持**: 支持快速回滚到上一版本配置

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| OPA策略错误导致检查失败 | 中 | 高 | 策略语法验证、灰度发布、自动回滚 |
| 数据分类误判 | 中 | 中 | ML模型定期训练、人工审核、置信度阈值 |
| 保留任务误删数据 | 低 | 高 | 多重确认、软删除、备份恢复 |
| 报告生成内存溢出 | 低 | 中 | 流式处理、分批生成、资源限制 |
| 合规检查性能下降 | 中 | 中 | 并发控制、超时机制、降级策略 |
| 配置变更导致服务异常 | 低 | 高 | 配置验证、灰度发布、快速回滚 |
| 审计日志丢失 | 低 | 高 | 多副本存储、定期备份、哈希链验证 |
| 敏感数据泄露 | 低 | 高 | 加密存储、访问控制、审计监控 |

### 12.2 回滚方案

**配置回滚**:

```go
// 配置回滚服务
type ConfigRollbackService struct {
    db    *sql.DB
    redis *redis.Client
}

// 回滚到指定版本
func (rs *ConfigRollbackService) RollbackToVersion(version int64) error {
    // 1. 从数据库获取指定版本配置
    query := `
        SELECT config_data, updated_at
        FROM compliance_configs
        WHERE version = $1
    `
    
    var configData []byte
    var updatedAt time.Time
    
    err := rs.db.QueryRow(query, version).Scan(&configData, &updatedAt)
    if err != nil {
        return fmt.Errorf("获取配置版本失败: %w", err)
    }
    
    var config ComplianceConfig
    if err := json.Unmarshal(configData, &config); err != nil {
        return fmt.Errorf("解析配置失败: %w", err)
    }
    
    // 2. 验证配置
    if err := rs.validateConfig(&config); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 3. 更新Redis
    if err := rs.syncToRedis(&config); err != nil {
        return fmt.Errorf("同步配置到Redis失败: %w", err)
    }
    
    // 4. 发布配置变更通知
    if err := rs.redis.Publish("config:compliance:reload", version).Err(); err != nil {
        return fmt.Errorf("发布配置变更通知失败: %w", err)
    }
    
    // 5. 记录回滚操作
    rs.auditRollback(version)
    
    log.Info("配置已回滚", "version", version)
    return nil
}

// 自动回滚（检测到异常时）
func (rs *ConfigRollbackService) AutoRollback() error {
    // 1. 获取当前版本
    currentVersion := rs.getCurrentVersion()
    
    // 2. 获取上一个稳定版本
    previousVersion := rs.getPreviousStableVersion(currentVersion)
    
    // 3. 执行回滚
    if err := rs.RollbackToVersion(previousVersion); err != nil {
        return err
    }
    
    // 4. 发送告警
    rs.sendAlert("配置自动回滚", fmt.Sprintf("从版本 %d 回滚到 %d", currentVersion, previousVersion))
    
    return nil
}
```

**数据回滚**:

```go
// 数据回滚服务
type DataRollbackService struct {
    es     *elasticsearch.Client
    backup *BackupService
}

// 回滚误删除的数据
func (drs *DataRollbackService) RollbackDeletedData(taskID string) error {
    // 1. 从备份中查找删除的数据
    deletedData, err := drs.backup.GetDeletedData(taskID)
    if err != nil {
        return fmt.Errorf("获取删除数据失败: %w", err)
    }
    
    // 2. 恢复数据到Elasticsearch
    for _, data := range deletedData {
        if err := drs.es.Index(data); err != nil {
            log.Error("恢复数据失败", "id", data.ID, "error", err)
            continue
        }
    }
    
    // 3. 记录恢复操作
    drs.auditRestore(taskID, len(deletedData))
    
    log.Info("数据已恢复", "task_id", taskID, "count", len(deletedData))
    return nil
}
```

**服务回滚**:

```bash
# Kubernetes滚动更新回滚
kubectl rollout undo deployment/compliance-service -n log-management

# 回滚到指定版本
kubectl rollout undo deployment/compliance-service --to-revision=2 -n log-management

# 查看回滚状态
kubectl rollout status deployment/compliance-service -n log-management
```

### 12.3 应急预案

**合规检查失败应急**:

1. 立即停止自动检查
2. 检查OPA服务状态
3. 验证策略配置
4. 回滚到上一版本配置
5. 手动执行单项检查验证
6. 恢复自动检查

**数据误删应急**:

1. 立即停止保留任务
2. 查询备份系统
3. 确认删除范围
4. 从备份恢复数据
5. 验证数据完整性
6. 调整保留策略

**服务不可用应急**:

1. 检查服务健康状态
2. 查看错误日志
3. 检查依赖服务（PostgreSQL、Redis、OPA）
4. 回滚到上一稳定版本
5. 扩容服务实例
6. 验证服务恢复

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| GDPR | 通用数据保护条例（General Data Protection Regulation），欧盟数据隐私法规 |
| SOC 2 | 服务组织控制2（Service Organization Control 2），安全控制审计标准 |
| HIPAA | 健康保险流通与责任法案（Health Insurance Portability and Accountability Act），美国医疗数据保护法规 |
| OPA | Open Policy Agent，开源策略引擎，支持策略即代码 |
| Rego | OPA的策略语言，用于定义授权和合规规则 |
| PII | 个人身份信息（Personally Identifiable Information），如姓名、邮箱、电话等 |
| PCI | 支付卡信息（Payment Card Information），如信用卡号、CVV等 |
| PHI | 受保护的健康信息（Protected Health Information），如病历、诊断等 |
| RBAC | 基于角色的访问控制（Role-Based Access Control） |
| JWT | JSON Web Token，用于身份认证的令牌格式 |
| AES-256-GCM | 高级加密标准256位伽罗瓦计数器模式，对称加密算法 |
| RSA-2048 | 2048位RSA非对称加密算法 |
| ONNX | Open Neural Network Exchange，开放神经网络交换格式 |
| ML | 机器学习（Machine Learning） |
| ILM | 索引生命周期管理（Index Lifecycle Management） |

### 13.2 参考文档

**合规标准文档**:
- [GDPR官方文档](https://gdpr.eu/)
- [SOC 2合规指南](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/sorhome.html)
- [HIPAA合规要求](https://www.hhs.gov/hipaa/index.html)

**技术文档**:
- [Open Policy Agent文档](https://www.openpolicyagent.org/docs/latest/)
- [Rego语言参考](https://www.openpolicyagent.org/docs/latest/policy-language/)
- [ONNX Runtime文档](https://onnxruntime.ai/docs/)
- [Elasticsearch ILM](https://www.elastic.co/guide/en/elasticsearch/reference/current/index-lifecycle-management.html)

**内部文档**:
- [需求文档](../requirements/requirements-module8.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2设计文档](./design-module2.md) - 日志存储
- [模块7设计文档](./design-module7.md) - 安全与访问控制

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案，包含13个标准章节 | 系统架构团队 |
