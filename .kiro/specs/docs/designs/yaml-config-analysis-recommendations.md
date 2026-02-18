# YAML配置热更新建议与最佳实践

## 一、配置分类与热更新策略

### 1. 基础设施层配置（Kubernetes资源）

**特征**:
- Deployment、StatefulSet、Service、ConfigMap、Secret
- 镜像版本、资源限制、环境变量、卷挂载

**热更新建议**: ❌ 不支持热更新

**原因**:
- 需要通过 `kubectl apply` 更新
- 会触发Pod滚动重启
- 属于Kubernetes资源定义层面

**更新方式**:
```bash
# 更新Deployment
kubectl apply -f deployment.yaml

# 查看滚动更新状态
kubectl rollout status deployment/log-collector

# 如需回滚
kubectl rollout undo deployment/log-collector
```

**影响范围**: 
- 服务会短暂不可用（滚动更新期间）
- 建议在低峰期执行
- 需要配置合理的滚动更新策略（maxSurge、maxUnavailable）

---

### 2. 连接层配置（基础服务连接）

**特征**:
- Kafka连接配置（brokers、认证、TLS）
- Redis连接配置（host、port、密码）
- PostgreSQL连接配置（DSN、连接池）
- Elasticsearch连接配置（endpoints、认证）

**热更新建议**: ⚠️ 不推荐热更新

**原因**:
1. **Kafka连接配置**:
   - 需要关闭现有Kafka生产者
   - 重建连接池和生产者实例
   - 可能导致短暂的消息发送失败

2. **Redis连接配置**:
   - 需要重建Redis客户端连接
   - 影响配置热更新机制本身（Redis是配置分发通道）

3. **PostgreSQL连接配置**:
   - 需要重建数据库连接池
   - 可能导致正在执行的查询失败

4. **Elasticsearch连接配置**:
   - 需要重建ES客户端
   - 影响日志写入和查询

**推荐更新方式**:
1. 修改YAML配置文件
2. 通过CI/CD流水线部署
3. 执行滚动重启
4. 验证服务健康状态

**备用热更新方式**（仅在紧急情况）:
```go
// 支持连接配置热更新的实现示例
type ConnectionManager struct {
    kafkaProducer atomic.Value  // *kafka.Producer
    redisClient   atomic.Value  // *redis.Client
    pgPool        atomic.Value  // *pgxpool.Pool
}

func (cm *ConnectionManager) UpdateKafkaConfig(newConfig *KafkaConfig) error {
    // 1. 创建新的Kafka生产者
    newProducer, err := kafka.NewProducer(newConfig)
    if err != nil {
        return err
    }
    
    // 2. 原子替换
    oldProducer := cm.kafkaProducer.Swap(newProducer).(*kafka.Producer)
    
    // 3. 优雅关闭旧生产者（等待消息发送完成）
    go func() {
        time.Sleep(30 * time.Second)  // 等待旧连接排空
        oldProducer.Close()
    }()
    
    return nil
}
```

**注意事项**:
- 热更新连接配置有风险，可能导致数据丢失
- 建议在维护窗口期执行
- 需要充分测试和验证

---

### 3. 应用层配置（业务配置）

**特征**:
- 数据源配置（采集源、过滤规则）
- 处理规则配置（清洗、脱敏、去重）
- 业务参数配置（阈值、开关、策略）
- 告警规则配置（条件、通知）

**热更新建议**: ✅ 推荐热更新

**原因**:
- 不影响服务运行
- 配置变更频繁
- 需要快速响应业务需求

**实现机制**:
```
用户修改配置 → PostgreSQL持久化（版本化） → Redis同步 
→ Redis Pub/Sub通知 → 服务订阅 → 配置验证 
→ atomic.Value原子更新 → 审计日志 → 生效
```

**生效时间**: < 30秒

**标准实现模式**:
```go
type ConfigManager struct {
    config atomic.Value  // 存储当前配置
    redis  *redis.Client
    db     *sql.DB
}

// 订阅配置变更
func (cm *ConfigManager) SubscribeConfigChanges() {
    pubsub := cm.redis.Subscribe(context.Background(), "config:module:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        // 1. 从Redis加载最新配置
        newConfig, err := cm.loadConfigFromRedis()
        if err != nil {
            log.Error("加载配置失败", "error", err)
            continue
        }
        
        // 2. 验证配置
        if err := cm.validateConfig(newConfig); err != nil {
            log.Error("配置验证失败", "error", err)
            continue
        }
        
        // 3. 获取旧配置
        oldConfig := cm.getConfig()
        
        // 4. 执行配置变更钩子
        for _, hook := range cm.configHooks {
            if err := hook.OnConfigChange(oldConfig, newConfig); err != nil {
                log.Error("配置钩子执行失败", "error", err)
                return
            }
        }
        
        // 5. 原子更新配置
        cm.config.Store(newConfig)
        
        // 6. 应用配置变更
        cm.applyConfigChanges(oldConfig, newConfig)
        
        // 7. 记录审计日志
        cm.auditConfigChange(oldConfig, newConfig)
        
        log.Info("配置已更新", "version", newConfig.Version)
    }
}
```

**扩展接口设计**:
```go
// 配置变更钩子接口
type ConfigHook interface {
    OnConfigChange(oldConfig, newConfig *Config) error
    Name() string
}

// 注册配置钩子
func (cm *ConfigManager) RegisterConfigHook(hook ConfigHook) {
    cm.configHooks = append(cm.configHooks, hook)
}
```

---

## 二、热更新最佳实践

### 1. 配置验证

**必须验证的内容**:
- 必填字段检查
- 数据类型验证
- 数值范围验证
- 格式正确性验证
- 业务逻辑验证

**验证失败处理**:
- 保持原配置不变
- 记录错误日志
- 发送告警通知
- 返回详细错误信息

### 2. 原子更新

**使用atomic.Value**:
```go
type Config struct {
    // 配置字段
}

type Service struct {
    config atomic.Value  // 存储*Config
}

// 读取配置（无锁）
func (s *Service) GetConfig() *Config {
    return s.config.Load().(*Config)
}

// 更新配置（原子操作）
func (s *Service) UpdateConfig(newConfig *Config) {
    s.config.Store(newConfig)
}
```

**优点**:
- 无锁读取，性能高
- 原子操作，线程安全
- 不阻塞业务逻辑

### 3. 审计日志

**记录内容**:
- 操作人
- 操作时间
- 配置变更前后值
- 变更原因
- 操作结果

**审计日志格式**:
```json
{
  "event_id": "config-change-123456",
  "timestamp": "2026-01-31T10:30:00Z",
  "user_id": "admin",
  "module": "log-collector",
  "action": "update_config",
  "changes": {
    "sources": {
      "old": [...],
      "new": [...]
    }
  },
  "result": "success"
}
```

### 4. 配置回滚

**回滚机制**:
1. 保存配置历史版本（PostgreSQL）
2. 检测到异常时自动回滚
3. 支持手动回滚到指定版本

**回滚触发条件**:
- 配置验证失败
- 应用配置后错误率上升
- 性能指标下降
- 人工触发

### 5. 灰度发布

**配置灰度策略**:
1. 先在1个实例上应用新配置
2. 观察5分钟，检查指标
3. 如果正常，逐步扩大范围
4. 最终应用到所有实例

**实现方式**:
```go
func (cm *ConfigManager) GradualRollout(newConfig *Config) error {
    instances := cm.getAllInstances()
    
    // 第1阶段：10%实例
    phase1 := instances[:len(instances)/10]
    cm.applyToInstances(phase1, newConfig)
    time.Sleep(5 * time.Minute)
    if !cm.checkHealth() {
        return cm.rollback()
    }
    
    // 第2阶段：50%实例
    phase2 := instances[:len(instances)/2]
    cm.applyToInstances(phase2, newConfig)
    time.Sleep(5 * time.Minute)
    if !cm.checkHealth() {
        return cm.rollback()
    }
    
    // 第3阶段：100%实例
    cm.applyToInstances(instances, newConfig)
    return nil
}
```

---

## 三、不同模块的热更新策略

### 模块1：日志采集
- ✅ 数据源配置：推荐热更新
- ✅ 处理规则：推荐热更新
- ✅ 优先级规则：推荐热更新
- ⚠️ Kafka连接：不推荐热更新
- ❌ Kubernetes部署：不支持热更新

### 模块6：可视化与报告
- ✅ 仪表盘配置：推荐热更新
- ✅ 日志查看器配置：推荐热更新
- ✅ 报告模板：推荐热更新
- ✅ 告警规则：推荐热更新（Prometheus规则重载）
- ❌ 前端部署配置：不支持热更新

### 模块7：安全与访问控制
- ✅ 认证策略：推荐热更新
- ✅ 权限规则：推荐热更新
- ✅ 审计规则：推荐热更新
- ⚠️ 加密配置：部分支持（密钥轮换除外）
- ❌ 服务部署配置：不支持热更新

### 模块10：性能与资源优化
- ✅ HPA配置：支持热更新（Kubernetes原生）
- ✅ 查询优化配置：推荐热更新
- ✅ 监控配置：推荐热更新
- ✅ 告警规则：推荐热更新
- ⚠️ VPA配置：需要重启Pod

---

## 四、热更新监控与告警

### 监控指标

```yaml
# Prometheus指标
config_reload_total{module="log-collector",status="success|failed"}
config_reload_duration_seconds{module="log-collector"}
config_version{module="log-collector"}
config_validation_errors_total{module="log-collector"}
```

### 告警规则

```yaml
groups:
  - name: config_hot_reload
    rules:
      - alert: ConfigReloadFailed
        expr: rate(config_reload_total{status="failed"}[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "配置热更新失败"
          description: "模块 {{ $labels.module }} 配置热更新失败"
      
      - alert: ConfigValidationErrors
        expr: rate(config_validation_errors_total[5m]) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "配置验证失败"
          description: "模块 {{ $labels.module }} 配置验证失败"
```

---

## 五、总结

### 热更新支持情况

| 配置层次 | 热更新支持 | 更新方式 | 生效时间 |
|---------|-----------|---------|---------|
| 基础设施层 | ❌ 不支持 | kubectl apply + 滚动重启 | 2-5分钟 |
| 连接层 | ⚠️ 不推荐 | YAML文件 + 重启服务 | 1-2分钟 |
| 应用层 | ✅ 推荐 | PostgreSQL + Redis + Pub/Sub | < 30秒 |

### 关键建议

1. **优先使用应用层配置热更新**：快速响应业务需求
2. **连接层配置谨慎更新**：避免服务中断
3. **基础设施层配置计划更新**：在维护窗口期执行
4. **完善配置验证机制**：防止错误配置导致故障
5. **建立配置审计体系**：追踪所有配置变更
6. **实施配置灰度发布**：降低配置变更风险
7. **预留扩展接口**：支持自定义配置钩子

