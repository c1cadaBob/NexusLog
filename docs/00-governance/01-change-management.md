# NexusLog 变更管理规范

## 1. 概述

本文档定义 NexusLog 项目所有组件配置变更的审批流程、风险评估方法和回滚规范。所有变更必须遵循本规范执行。

## 2. 三级审批体系

所有组件配置变更通过 `change_level` 字段分为三个级别：

| 级别 | 字段值 | 审批人 | 时间窗口 | 发布前要求 | 发布后要求 |
|------|--------|--------|----------|------------|------------|
| 无需审批 | `none` | 值班负责人备案 | 工作时段 | 自测 + 监控检查 | 15 分钟观察 |
| 常规审批 | `normal` | 技术负责人 / 模块 Owner | 常规发布窗口 | 测试通过、回滚脚本、变更单 | 30 分钟观察 + 记录 |
| 高危变更 | `cab` | CAB 委员会（研发 + 运维 + 安全 + 业务） | 固定发布窗口 | 压测/演练报告、灰度方案、回滚预案、业务确认 | 60 分钟护航 + 复盘 |

### 2.1 无需审批（none）

适用于低风险、可快速回滚的配置变更，例如：

- Prometheus 告警规则调整
- Grafana Dashboard 更新
- ECharts 图表配置变更
- Zustand 运行时状态配置
- Alertmanager 通知渠道调整

流程：变更人自测 → 值班负责人备案 → 执行变更 → 15 分钟观察期

### 2.2 常规审批（normal）

适用于中等风险、有标准回滚方案的变更，例如：

- Go 微服务参数调整和镜像滚动更新
- 前端版本发布
- Helm Chart values 更新
- Argo CD 应用配置变更
- 采集代理规则更新
- PgBouncer 连接池配置 reload

流程：提交变更单 → 技术负责人审批 → 测试环境验证 → 执行变更 → 30 分钟观察期

### 2.3 高危变更（cab）

适用于高风险、影响面广、回滚复杂的变更，例如：

- Keycloak Realm / 认证策略变更
- OPA 全局策略变更
- Kafka 集群拓扑 / 分区调整
- Elasticsearch 集群节点 / 分片变更
- PostgreSQL 主从切换 / Schema 不兼容变更
- Redis Cluster 拓扑变更
- OpenResty 网关全局策略变更
- Vault 密钥 / 证书策略变更
- Kubernetes 集群级变更

流程：提交变更单 → 风险评分 → CAB 委员会评审 → 灰度方案确认 → 压测/演练 → 固定窗口执行 → 60 分钟护航 → 复盘报告

## 3. CAB 判定规则表

满足以下 **任意一条** 硬规则，变更级别直接判定为 `cab`，无论风险评分结果如何：

| 编号 | 硬规则描述 | 典型场景 |
|------|-----------|----------|
| R1 | 涉及认证鉴权链路（IdP、JWT 校验、OPA 策略默认拒绝逻辑） | Keycloak Realm 配置、OPA deny-by-default 策略、JWT 签名算法变更 |
| R2 | 涉及数据存储引擎或集群拓扑（ES/Kafka/PG/Redis 主从、分片、副本） | ES 分片迁移、Kafka 分区重分配、PG 主从切换、Redis Cluster 节点增减 |
| R3 | 涉及网络入口与流量总闸（网关、Service Mesh 全局策略、全局限流） | OpenResty upstream 变更、Istio 全局 VirtualService、全局限流阈值 |
| R4 | 涉及密钥、证书、加密算法、KMS/Vault 策略 | TLS 证书轮换、Vault 策略变更、加密算法升级 |
| R5 | 涉及不可逆数据变更（删库删索引、Schema 不兼容变更） | ES 索引删除、PG 表结构不兼容迁移、Avro Schema BREAKING 变更 |
| R6 | 涉及跨区域/跨机房主链路切换 | 多活切换、灾备切换、DNS 全局切换 |
| R7 | 无法在 5 分钟内可验证回滚 | 大规模数据迁移、不可逆 DDL、全量索引重建 |


## 4. 风险评分矩阵

风险总分 = 影响范围 + 业务关键性 + 变更复杂度 + 可回滚性 + 可观测性（各维度 0-3 分，满分 15 分）

### 4.1 评分维度

#### 影响范围（Blast Radius）

| 分值 | 描述 |
|------|------|
| 0 | 单个非核心组件，无用户感知 |
| 1 | 单个核心组件，少量用户可能感知 |
| 2 | 多个组件联动，部分用户受影响 |
| 3 | 全局性变更，所有用户受影响 |

#### 业务关键性（Business Criticality）

| 分值 | 描述 |
|------|------|
| 0 | 开发/测试辅助功能（监控 Dashboard、文档） |
| 1 | 非核心业务功能（报表导出、帮助中心） |
| 2 | 核心业务功能（日志检索、告警、采集） |
| 3 | 基础设施 / 安全 / 认证链路 |

#### 变更复杂度（Change Complexity）

| 分值 | 描述 |
|------|------|
| 0 | 单一配置项修改，无依赖 |
| 1 | 少量配置项修改，依赖关系明确 |
| 2 | 多组件协调变更，需按顺序执行 |
| 3 | 跨域协调变更，涉及数据迁移或状态转换 |

#### 可回滚性（Rollback Capability）

| 分值 | 描述 |
|------|------|
| 0 | 秒级自动回滚（配置热更新、Feature Flag） |
| 1 | 分钟级手动回滚（镜像回退、Helm rollback） |
| 2 | 需要额外操作才能回滚（数据库迁移 down、缓存清理） |
| 3 | 不可回滚或回滚代价极高（不可逆 DDL、数据删除） |

#### 可观测性（Observability）

| 分值 | 描述 |
|------|------|
| 0 | 完善的指标、日志、告警，变更效果可立即验证 |
| 1 | 有基本监控，需要手动检查部分指标 |
| 2 | 监控覆盖不完整，部分影响需要用户反馈确认 |
| 3 | 无有效监控手段，变更效果难以量化评估 |

### 4.2 评分阈值与审批级别映射

| 总分范围 | 审批级别 | 说明 |
|----------|----------|------|
| 0 - 5 | `none`（无需审批） | 低风险变更，值班负责人备案即可 |
| 6 - 10 | `normal`（常规审批） | 中等风险，需技术负责人审批 |
| 11 - 15 | `cab`（高危变更） | 高风险，需 CAB 委员会评审 |

> **注意**：即使评分低于 11 分，若触发第 3 节中任一 CAB 硬规则，仍直接判定为 `cab`。

## 5. 回滚 SLA 模板

| 时间节点 | 要求 | 责任人 |
|----------|------|--------|
| T+5 分钟 | 完成回滚决策并触发止血动作（回滚部署 / 切流量 / 降级开关） | 值班工程师 |
| T+15 分钟 | 核心服务恢复（错误率回落至基线、可用性恢复至 SLA 目标） | 值班工程师 + 模块 Owner |
| T+30 分钟 | 根因初判 + 影响面确认 + 对内通报（邮件/IM 群组） | 模块 Owner |
| T+24 小时 | 提交复盘报告（含时间线、根因分析、改进项、Action Owner、截止日期） | 变更发起人 |

### 5.1 止血动作优先级

1. **立即回滚**：Helm rollback / Argo CD sync 到上一版本 / 配置热回退
2. **流量切换**：Istio 流量权重切回旧版本 / OpenResty upstream 切换
3. **降级开关**：Feature Flag 关闭新功能 / 熔断器触发
4. **紧急扩容**：HPA 手动扩容 / 节点池扩展

## 6. 变更单模板

可直接使用独立模板文件：`docs/change-request-template.yaml`（适用于 CI 校验和审批系统自动解析）。

### 6.1 变更单字段定义

```yaml
# 变更单模板
change_request:
  # === 基本信息 ===
  id: "CR-YYYYMMDD-NNN"              # 变更单编号（自动生成）
  title: ""                           # 变更标题
  description: ""                     # 变更描述
  requester: ""                       # 申请人
  created_at: ""                      # 创建时间（自动填充）

  # === 变更范围 ===
  affected_components: []             # 受影响组件列表
  affected_environments: []           # 受影响环境（dev/staging/prod）
  change_type: ""                     # 变更类型（config/deploy/schema/infra/security）

  # === 风险评估 ===
  risk_scores:
    blast_radius: 0                   # 影响范围（0-3）
    business_criticality: 0           # 业务关键性（0-3）
    change_complexity: 0              # 变更复杂度（0-3）
    rollback_capability: 0            # 可回滚性（0-3）
    observability: 0                  # 可观测性（0-3）
  risk_total: 0                       # 风险总分（自动计算）
  cab_hard_rules_triggered: []        # 触发的 CAB 硬规则编号列表

  # === 审批路由（自动计算） ===
  change_level: ""                    # 自动判定：none / normal / cab
  approvers: []                       # 审批人列表（根据 change_level 自动填充）

  # === 执行计划 ===
  scheduled_window: ""                # 计划执行窗口
  execution_steps: []                 # 执行步骤列表
  rollback_plan: ""                   # 回滚方案
  rollback_estimated_time: ""         # 预计回滚耗时
  verification_steps: []              # 验证步骤

  # === 发布后 ===
  observation_period: ""              # 观察期时长（自动根据 change_level 填充）
  post_change_checklist: []           # 发布后检查清单
```

### 6.2 风险评分自动计算规则

```
risk_total = blast_radius + business_criticality + change_complexity
             + rollback_capability + observability
```

计算逻辑：

1. 各维度分值取值范围 `[0, 3]`，超出范围视为无效
2. `risk_total` 为五个维度分值之和，取值范围 `[0, 15]`

### 6.3 CAB 自动路由逻辑

变更级别判定按以下优先级执行：

```
IF cab_hard_rules_triggered 不为空:
    change_level = "cab"
ELSE IF risk_total >= 11:
    change_level = "cab"
ELSE IF risk_total >= 6:
    change_level = "normal"
ELSE:
    change_level = "none"
```

审批人自动填充规则：

| change_level | approvers |
|-------------|-----------|
| `none` | 值班负责人（自动备案） |
| `normal` | 技术负责人 + 模块 Owner |
| `cab` | CAB 委员会全体成员（研发负责人 + 运维负责人 + 安全负责人 + 业务负责人） |

观察期自动填充规则：

| change_level | observation_period |
|-------------|-------------------|
| `none` | 15 分钟 |
| `normal` | 30 分钟 |
| `cab` | 60 分钟 |

### 6.4 非窗口发布判定规则

以下情况允许在固定发布窗口之外执行变更：

1. **紧急安全修复**：CVE 评分 ≥ 9.0 或已被利用的漏洞，需安全负责人批准
2. **P0 级故障修复**：核心服务不可用，需值班负责人 + 技术负责人双重批准
3. **数据泄露止血**：需安全负责人 + 业务负责人批准

非窗口发布额外要求：

- 必须有至少一名 SRE 在线护航
- 回滚方案必须经过验证
- 变更完成后 24 小时内补提变更单和复盘报告

## 7. 组件变更级别速查表

| 组件 | change_level | 配置策略 | 推荐生效时间 |
|------|-------------|----------|-------------|
| OpenResty 网关 | `cab` | 热更新优先；核心参数滚动 | 分钟级 |
| Keycloak | `cab` | Realm/策略热更；SPI 重启 | 分钟级 |
| OPA | `cab` | Policy Bundle 热更新 | 秒级 |
| Kafka | `cab` | 动态配置 + 核心参数重启 | 发布窗口 |
| Schema Registry | `cab` | Schema/兼容策略热更 | 分钟级 |
| Flink | `cab` | 参数热更；作业 Savepoint 发布 | 发布窗口 |
| Elasticsearch | `cab` | ILM 热更；节点参数重启 | 发布窗口 |
| PostgreSQL | `cab` | 业务配置热生效；核心参数重启 | 发布窗口 |
| Patroni + etcd | `cab` | 拓扑变更维护窗口 | 发布窗口 |
| Redis Cluster | `cab` | TTL 热更；拓扑变更重启 | 分钟级 |
| Vault | `cab` | Secret 热更；后端变更重启 | 分钟级 |
| Kubernetes | `cab` | 声明式变更 + 滚动 | 发布窗口 |
| Control Plane 服务 | `normal` | 参数热更；镜像滚动 | 分钟级 |
| API Service | `normal` | 开关热更；版本滚动 | 分钟级 |
| Go Agent + 插件 | `normal` | 规则热更；插件升级重启 | 分钟级 |
| PgBouncer | `normal` | reload 优先 | 分钟级 |
| Helm Charts | `normal` | YAML 主通道 | 发布窗口 |
| Argo CD | `normal` | Git 为准，防配置漂移 | 发布窗口 |
| Jaeger + OTel | `normal` | 采样热更；结构变更滚动 | 分钟级 |
| 前端 React + AntD | `normal` | 远程配置热更；其余发版 | 发布窗口 |
| CI/CD Pipeline | `normal` | Pipeline 即代码 | 分钟级 |
| Harbor | `normal` | 策略热更 | 分钟级 |
| MinIO/S3 | `normal` | 生命周期策略热更 | 分钟级 |
| NestJS BFF（可选） | `normal` | 配置热更；升级重启 | 分钟级 |
| ML 服务（可选） | `normal` | 模型热切换；服务滚动 | 分钟级 |
| 边缘计算（可选） | `normal` | 规则热更；分批升级 | 分钟级 |
| Health Worker | `none` | 目标/阈值热更 | 分钟级 |
| Prometheus | `none` | 规则/目标 reload | 分钟级 |
| Alertmanager | `none` | 配置热重载 | 秒级 |
| Grafana | `none` | Dashboard/规则热更 | 秒级 |
| ECharts | `none` | 图表配置热更 | 秒级 |
| Zustand | `none` | 运行时热更新 | 秒级 |
| Trivy + SAST | `none` | 规则库热更 | 分钟级 |
