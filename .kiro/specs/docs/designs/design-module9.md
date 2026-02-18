# 模块9：高可用与容灾 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module9.md](../requirements/requirements-module9.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP

### 1.3 评审记录
| 评审人 | 角色 | 评审日期 | 评审结果 | 意见 |
|--------|------|----------|----------|------|
| 技术委员会 | 架构评审 | 2026-01-31 | 通过 | 设计合理，可以实施 |

### 1.4 相关文档
- [需求文档](../requirements/requirements-module9.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2设计文档](./design-module2.md) - 日志存储
- [模块3设计文档](./design-module3.md) - 日志查询

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              高可用与容灾模块整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                      区域 A (主区域 - Primary Region)                                  │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Kubernetes 集群 A                                                              │  │ │
│  │  │  ┌──────────────────────────────────────────────────────────────────────┐     │  │ │
│  │  │  │  应用层 (3副本 + HPA)                                                 │     │  │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                           │     │  │ │
│  │  │  │  │Collector │  │Collector │  │Collector │  (DaemonSet)              │     │  │ │
│  │  │  │  │  Pod-1   │  │  Pod-2   │  │  Pod-3   │                           │     │  │ │
│  │  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                           │     │  │ │
│  │  │  │       │             │             │                                  │     │  │ │
│  │  │  │  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐                           │     │  │ │
│  │  │  │  │API Server│  │API Server│  │API Server│  (Deployment 3副本)       │     │  │ │
│  │  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                           │     │  │ │
│  │  │  └───────┼──────────────┼──────────────┼────────────────────────────────┘     │  │ │
│  │  │          │              │              │                                      │  │ │
│  │  │  ┌───────▼──────────────▼──────────────▼────────────────────────────────┐     │  │ │
│  │  │  │  负载均衡层 (Nginx Ingress + Service Mesh)                            │     │  │ │
│  │  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                           │     │  │ │
│  │  │  │  │  Nginx   │  │  Nginx   │  │  Nginx   │  (3副本)                  │     │  │ │
│  │  │  │  │ Ingress  │  │ Ingress  │  │ Ingress  │                           │     │  │ │
│  │  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘                           │     │  │ │
│  │  │  └───────┼──────────────┼──────────────┼────────────────────────────────┘     │  │ │
│  │  │          │              │              │                                      │  │ │
│  │  │  ┌───────▼──────────────▼──────────────▼────────────────────────────────┐     │  │ │
│  │  │  │  数据层 (StatefulSet)                                                 │     │  │ │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐         │     │  │ │
│  │  │  │  │  Kafka 集群 (3节点 + Zookeeper 3节点)                    │         │     │  │ │
│  │  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │         │     │  │ │
│  │  │  │  │  │ Broker-1│  │ Broker-2│  │ Broker-3│  (RF=3)         │         │     │  │ │
│  │  │  │  │  └─────────┘  └─────────┘  └─────────┘                 │         │     │  │ │
│  │  │  │  └─────────────────────────────────────────────────────────┘         │     │  │ │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐         │     │  │ │
│  │  │  │  │  Elasticsearch 集群 (3 Master + 6 Data + 2 Coordinating)│         │     │  │ │
│  │  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │         │     │  │ │
│  │  │  │  │  │  ES-M1  │  │  ES-M2  │  │  ES-M3  │  (Master)       │         │     │  │ │
│  │  │  │  │  └─────────┘  └─────────┘  └─────────┘                 │         │     │  │ │
│  │  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │         │     │  │ │
│  │  │  │  │  │  ES-D1  │  │  ES-D2  │  │  ES-D3  │  (Data Hot)     │         │     │  │ │
│  │  │  │  │  └─────────┘  └─────────┘  └─────────┘                 │         │     │  │ │
│  │  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │         │     │  │ │
│  │  │  │  │  │  ES-D4  │  │  ES-D5  │  │  ES-D6  │  (Data Warm)    │         │     │  │ │
│  │  │  │  │  └─────────┘  └─────────┘  └─────────┘                 │         │     │  │ │
│  │  │  │  └─────────────────────────────────────────────────────────┘         │     │  │ │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐         │     │  │ │
│  │  │  │  │  PostgreSQL 集群 (1 Primary + 2 Standby)                │         │     │  │ │
│  │  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │         │     │  │ │
│  │  │  │  │  │   PG-1  │─▶│   PG-2  │  │   PG-3  │  (Streaming)    │         │     │  │ │
│  │  │  │  │  │(Primary)│  │(Standby)│  │(Standby)│  (Replication)  │         │     │  │ │
│  │  │  │  │  └─────────┘  └─────────┘  └─────────┘                 │         │     │  │ │
│  │  │  │  └─────────────────────────────────────────────────────────┘         │     │  │ │
│  │  │  │  ┌─────────────────────────────────────────────────────────┐         │     │  │ │
│  │  │  │  │  Redis 集群 (3 Master + 3 Replica)                       │         │     │  │ │
│  │  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │         │     │  │ │
│  │  │  │  │  │ Redis-M1│  │ Redis-M2│  │ Redis-M3│  (Master)       │         │     │  │ │
│  │  │  │  │  └────┬────┘  └────┬────┘  └────┬────┘                 │         │     │  │ │
│  │  │  │  │       │            │            │                       │         │     │  │ │
│  │  │  │  │  ┌────▼────┐  ┌────▼────┐  ┌────▼────┐                 │         │     │  │ │
│  │  │  │  │  │ Redis-R1│  │ Redis-R2│  │ Redis-R3│  (Replica)      │         │     │  │ │
│  │  │  │  │  └─────────┘  └─────────┘  └─────────┘                 │         │     │  │ │
│  │  │  │  └─────────────────────────────────────────────────────────┘         │     │  │ │
│  │  │  └─────────────────────────────────────────────────────────────────────┘     │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────┼─────────────────────────────────────────┘ │
│                                           │                                           │
│                                           │ 跨区域复制                                 │
│                                           │ (MirrorMaker2 + CCR + Streaming Rep)      │
│                                           │ 延迟 < 5秒                                 │
│                                           │                                           │
│  ┌────────────────────────────────────────▼─────────────────────────────────────────┐ │
│  │                      区域 B (备用区域 - Standby Region)                           │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐  │ │
│  │  │  Kubernetes 集群 B (相同架构)                                               │  │ │
│  │  │  - 应用层: 3副本 (热备)                                                     │  │ │
│  │  │  - Kafka: 3节点 (接收复制数据)                                              │  │ │
│  │  │  - Elasticsearch: 11节点 (CCR Follower)                                    │  │ │
│  │  │  - PostgreSQL: 3节点 (Streaming Standby)                                   │  │ │
│  │  │  - Redis: 6节点 (Sentinel模式)                                             │  │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                      监控与故障转移层 (跨区域)                                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │ │
│  │  │  Prometheus  │  │ Alertmanager │  │   Operator   │  │     etcd     │        │ │
│  │  │  (监控指标)   │  │  (告警通知)   │  │ (自动故障转移)│  │ (服务发现)    │        │ │
│  │  │  (HA部署)    │  │  (HA部署)    │  │  (HA部署)    │  │  (3节点)     │        │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘        │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                      配置中心 (热更新 - 跨区域同步)                                  │ │
│  │  ┌──────────────────┐        ┌──────────────────┐                                │ │
│  │  │   PostgreSQL     │◄──────►│      Redis       │                                │ │
│  │  │  (配置持久化)     │        │   (配置缓存)      │                                │ │
│  │  │  (主从复制)      │        │  (Pub/Sub通知)   │                                │ │
│  │  └──────────────────┘        └──────────────────┘                                │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 集群管理 | 节点管理与协调 | 节点注册/注销、健康检查、Master选举、负载均衡 |
| 故障转移 | 自动故障检测与切换 | 故障检测、流量切换、Master选举、审计日志 |
| 跨区域复制 | 数据同步与一致性 | Kafka MirrorMaker 2、ES CCR、PG Streaming、延迟监控 |
| 健康检查 | 服务健康监控 | /health、/ready、/live端点、指标收集 |
| 灾难恢复 | 备份与恢复管理 | 备份管理、恢复计划、演练调度、验证器 |
| 配置中心 | 配置管理与热更新 | PostgreSQL存储、Redis分发、Pub/Sub通知 |

### 2.3 关键路径

**正常运行路径**:
```
请求 → Nginx Ingress → Service Mesh → API Server (3副本) → 
  Kafka (3副本) → Elasticsearch (11节点) → 响应

健康检查: 每10秒检查一次所有节点
数据复制: 实时同步到备用区域（延迟 < 5秒）
配置更新: PostgreSQL → Redis → Pub/Sub → 服务实例（10秒内生效）
```

**故障转移路径**:
```
故障检测（30秒内） → 标记节点不健康 → 从负载均衡移除 → 
  流量切换到健康节点 → Master选举（如需） → 审计日志 → 告警通知

区域故障: 检测主区域不可用 → DNS切换到备用区域 → 
  激活备用区域服务 → 数据验证 → 完成切换（5分钟内）
```

**灾难恢复路径**:
```
触发恢复 → 验证备份可用性 → 执行恢复步骤 → 
  数据恢复 → 服务启动 → 验证完整性 → 切换流量（30分钟内）
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Kubernetes | 1.28+ | 容器编排、自动故障转移、滚动升级、HPA |
| etcd | 3.5+ | 服务发现、配置管理、分布式锁、高可用 |
| Kafka MirrorMaker 2 | 3.6+ | 跨区域日志复制、低延迟、高吞吐 |
| Elasticsearch CCR | 8.11+ | 跨集群索引复制、自动同步、故障恢复 |
| PostgreSQL Streaming | 16+ | 主从复制、自动故障转移、数据一致性 |
| Redis Sentinel | 7.2+ | 主从切换、故障检测、配置分发 |
| Nginx Ingress | 1.9+ | 负载均衡、健康检查、SSL终止 |
| Prometheus | 2.48+ | 监控指标、告警规则、高可用 |
| Alertmanager | 0.26+ | 告警聚合、通知路由、静默规则 |

### 3.2 容器编排选型对比

| 维度 | Kubernetes | Docker Swarm | Nomad | 选择 |
|------|-----------|--------------|-------|------|
| 成熟度 | 高 | 中 | 中 | Kubernetes ✅ |
| 社区活跃度 | 非常高 | 低 | 中 | Kubernetes ✅ |
| 功能完整性 | 完整 | 基础 | 中等 | Kubernetes ✅ |
| 自动故障转移 | 优秀 | 良好 | 良好 | Kubernetes ✅ |
| 滚动升级 | 优秀 | 良好 | 良好 | Kubernetes ✅ |
| HPA支持 | 原生支持 | 不支持 | 需插件 | Kubernetes ✅ |
| 生态系统 | 丰富 | 有限 | 有限 | Kubernetes ✅ |
| 学习曲线 | 陡峭 | 平缓 | 中等 | - |

**结论**: 选择Kubernetes，理由：成熟稳定、功能完整、生态丰富、社区活跃

### 3.3 服务发现选型对比

| 维度 | etcd | Consul | Zookeeper | 选择 |
|------|------|--------|-----------|------|
| 一致性算法 | Raft | Raft | ZAB | - |
| 性能 | 优秀 | 优秀 | 良好 | etcd ✅ |
| K8s集成 | 原生 | 需插件 | 需插件 | etcd ✅ |
| 健康检查 | 支持 | 优秀 | 基础 | Consul ✅ |
| 多数据中心 | 支持 | 优秀 | 支持 | Consul ✅ |
| 运维复杂度 | 低 | 中 | 高 | etcd ✅ |
| 社区支持 | 高 | 高 | 中 | - |

**结论**: 选择etcd，理由：Kubernetes原生支持、性能优秀、运维简单

### 3.4 跨区域复制选型对比

**Kafka复制方案**:

| 维度 | MirrorMaker 2 | MirrorMaker 1 | Confluent Replicator | 选择 |
|------|---------------|---------------|---------------------|------|
| 性能 | 优秀 | 良好 | 优秀 | MM2 ✅ |
| 配置复杂度 | 低 | 中 | 低 | MM2 ✅ |
| Topic自动创建 | 支持 | 不支持 | 支持 | MM2 ✅ |
| 偏移量同步 | 支持 | 不支持 | 支持 | MM2 ✅ |
| 开源 | 是 | 是 | 否 | MM2 ✅ |
| 社区支持 | 高 | 中 | 中 | MM2 ✅ |

**结论**: 选择MirrorMaker 2，理由：性能优秀、配置简单、功能完整、开源免费

**Elasticsearch复制方案**:

| 维度 | CCR | Snapshot/Restore | Logstash | 选择 |
|------|-----|------------------|----------|------|
| 实时性 | 优秀 | 差 | 良好 | CCR ✅ |
| 自动同步 | 是 | 否 | 需配置 | CCR ✅ |
| 故障恢复 | 自动 | 手动 | 手动 | CCR ✅ |
| 性能影响 | 低 | 中 | 中 | CCR ✅ |
| 配置复杂度 | 低 | 低 | 高 | CCR ✅ |
| 许可证 | 白金版 | 基础版 | 开源 | - |

**结论**: 选择CCR（Cross-Cluster Replication），理由：实时同步、自动故障恢复、性能优秀

---

## 4. 关键流程设计

### 4.1 集群节点管理流程

**节点注册流程**:

```
1. 节点启动
2. 生成节点ID和地址信息
3. 确定节点角色（Master/Replica/Standby）
4. 注册到etcd服务发现
5. 加入集群管理器
6. 开始发送心跳
7. 更新节点状态为Healthy
```

**时序图**:

```
节点  集群管理器  etcd  负载均衡器
 │       │       │       │
 │─启动──→│       │       │
 │       │─注册──→│       │
 │       │◀─确认──│       │
 │       │───────────注册→│
 │       │◀──────────确认─│
 │◀─就绪─│       │       │
 │       │       │       │
 │─心跳──→│       │       │
 │       │─更新──→│       │
 │       │       │       │
```

**节点健康检查流程**:

```go
// 健康检查实现
func (cm *ClusterManager) checkNodeHealth(ctx context.Context) {
    cm.mu.RLock()
    nodes := make([]*Node, 0, len(cm.nodes))
    for _, node := range cm.nodes {
        nodes = append(nodes, node)
    }
    cm.mu.RUnlock()
    
    for _, node := range nodes {
        // 1. 检查心跳超时
        if time.Since(node.LastHeartbeat) > cm.config.HealthCheckInterval*3 {
            cm.markNodeUnhealthy(node, "心跳超时")
            continue
        }
        
        // 2. 检查健康端点
        healthStatus := cm.checkHealthEndpoints(node)
        if !healthStatus.Healthy {
            cm.markNodeUnhealthy(node, healthStatus.Reason)
            continue
        }
        
        // 3. 检查节点指标
        metrics := cm.collectNodeMetrics(node)
        if cm.isNodeDegraded(metrics) {
            cm.markNodeDegraded(node, "性能下降")
        } else {
            cm.markNodeHealthy(node)
        }
    }
}

// 检查健康端点
func (cm *ClusterManager) checkHealthEndpoints(node *Node) *HealthStatus {
    endpoints := []string{"/health", "/ready", "/live"}
    
    for _, endpoint := range endpoints {
        url := fmt.Sprintf("http://%s%s", node.Address, endpoint)
        
        ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
        defer cancel()
        
        req, _ := http.NewRequestWithContext(ctx, "GET", url, nil)
        resp, err := http.DefaultClient.Do(req)
        
        if err != nil {
            return &HealthStatus{
                Healthy: false,
                Reason:  fmt.Sprintf("%s 检查失败: %v", endpoint, err),
            }
        }
        resp.Body.Close()
        
        if resp.StatusCode != http.StatusOK {
            return &HealthStatus{
                Healthy: false,
                Reason:  fmt.Sprintf("%s 返回状态码: %d", endpoint, resp.StatusCode),
            }
        }
    }
    
    return &HealthStatus{Healthy: true}
}
```

### 4.2 故障转移流程

**自动故障转移流程**:

```
1. 健康检查检测到节点故障
2. 标记节点状态为Unhealthy
3. 从负载均衡器移除节点
4. 如果是Master节点，触发Master选举
5. 重新分配流量到健康节点
6. 记录故障转移事件到审计日志
7. 发送告警通知
8. 更新监控仪表盘
```

**Master选举流程**:

```
1. 检测到Master节点故障
2. 获取所有健康的Replica节点
3. 按以下标准排序候选节点：
   - CPU使用率（越低越好）
   - 内存使用率（越低越好）
   - 网络延迟（越低越好）
   - 运行时长（越长越好）
4. 选择得分最高的节点
5. 将该节点角色提升为Master
6. 通知所有节点Master变更
7. 更新etcd中的Master信息
8. 记录选举事件
```

**区域故障转移流程**:

```
1. 检测到主区域不可用（多个节点同时故障）
2. 验证备用区域健康状态
3. 更新DNS记录指向备用区域
4. 激活备用区域的服务实例
5. 验证数据完整性
6. 切换流量到备用区域
7. 通知所有相关人员
8. 记录区域故障转移事件
```

**故障转移时序图**:

```
监控  集群管理器  负载均衡  etcd  告警
 │       │         │       │     │
 │─检测故障→│         │       │     │
 │       │─移除节点──→│       │     │
 │       │─选举Master─→│       │     │
 │       │◀─更新Master─│       │     │
 │       │─发送告警──────────────────→│
 │       │         │       │     │
```

**故障转移代码实现**:

```go
// 处理节点故障
func (cm *ClusterManager) handleNodeFailure(ctx context.Context, node *Node) error {
    log.Errorf("处理节点故障: %s", node.ID)
    
    // 1. 从负载均衡器移除节点
    cm.loadBalancer.RemoveNode(node)
    
    // 2. 重新分配流量到健康节点
    healthyNodes := cm.getHealthyNodes()
    if len(healthyNodes) == 0 {
        return fmt.Errorf("没有可用的健康节点")
    }
    
    // 3. 如果是 Master 节点故障，选举新的 Master
    if node.Role == NodeRoleMaster {
        if err := cm.electNewMaster(ctx); err != nil {
            return err
        }
    }
    
    // 4. 记录故障转移事件
    cm.auditFailoverEvent(node, healthyNodes)
    
    // 5. 发送告警
    cm.sendFailoverAlert(node)
    
    return nil
}

// 选举新的 Master
func (cm *ClusterManager) electNewMaster(ctx context.Context) error {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    // 从健康的 Replica 节点中选择
    var candidates []*Node
    for _, node := range cm.nodes {
        if node.Status == NodeStatusHealthy && node.Role == NodeRoleReplica {
            candidates = append(candidates, node)
        }
    }
    
    if len(candidates) == 0 {
        return fmt.Errorf("没有可用的候选节点")
    }
    
    // 选择指标最好的节点
    newMaster := cm.selectBestCandidate(candidates)
    newMaster.Role = NodeRoleMaster
    
    log.Infof("选举新的 Master 节点: %s", newMaster.ID)
    
    // 通知所有节点
    cm.notifyMasterChange(newMaster)
    
    return nil
}
```

### 4.3 跨区域复制流程

**Kafka跨区域复制**:

```
1. MirrorMaker 2 连接源集群和目标集群
2. 订阅源集群的所有Topic
3. 实时拉取消息
4. 转换消息格式（如需）
5. 写入目标集群
6. 同步消费者组偏移量
7. 监控复制延迟
8. 如果延迟 > 5秒，发送告警
```

**Elasticsearch跨集群复制**:

```
1. 在目标集群配置CCR Follower索引
2. 指定源集群的Leader索引
3. 自动同步索引设置和映射
4. 实时复制文档变更
5. 处理冲突（使用版本号）
6. 监控复制延迟和错误
7. 自动重试失败的操作
8. 定期验证数据一致性
```

**PostgreSQL流复制**:

```
1. Primary节点生成WAL日志
2. WAL Sender进程发送日志到Standby
3. Standby的WAL Receiver接收日志
4. 应用WAL日志到本地数据库
5. 更新复制槽位置
6. 发送反馈给Primary
7. 监控复制延迟
8. 如果延迟过大，发送告警
```

**跨区域复制代码实现**:

```go
// 跨区域复制管理器
type ReplicationManager struct {
    config         *ReplicationConfig
    kafkaMirror    *KafkaMirrorMaker
    esCCR          *ElasticsearchCCR
    pgStreaming    *PostgreSQLStreaming
    healthMonitor  *ReplicationHealthMonitor
}

// 启动跨区域复制
func (rm *ReplicationManager) Start(ctx context.Context) error {
    // 启动 Kafka 复制
    if err := rm.kafkaMirror.Start(ctx); err != nil {
        return err
    }
    
    // 启动 ES 复制
    if err := rm.esCCR.Start(ctx); err != nil {
        return err
    }
    
    // 启动 PostgreSQL 复制
    if err := rm.pgStreaming.Start(ctx); err != nil {
        return err
    }
    
    // 启动健康监控
    go rm.healthMonitor.Monitor(ctx, rm.checkReplicationHealth)
    
    log.Info("跨区域复制已启动")
    return nil
}

// 检查复制健康状态
func (rm *ReplicationManager) checkReplicationHealth(ctx context.Context) {
    // 检查 Kafka 复制延迟
    kafkaLag := rm.kafkaMirror.GetReplicationLag()
    if kafkaLag > rm.config.MaxLag {
        log.Warnf("Kafka 复制延迟过高: %v", kafkaLag)
        rm.sendReplicationAlert("kafka", kafkaLag)
    }
    
    // 检查 ES 复制延迟
    esLag := rm.esCCR.GetReplicationLag()
    if esLag > rm.config.MaxLag {
        log.Warnf("ES 复制延迟过高: %v", esLag)
        rm.sendReplicationAlert("elasticsearch", esLag)
    }
    
    // 检查 PostgreSQL 复制延迟
    pgLag := rm.pgStreaming.GetReplicationLag()
    if pgLag > rm.config.MaxLag {
        log.Warnf("PostgreSQL 复制延迟过高: %v", pgLag)
        rm.sendReplicationAlert("postgresql", pgLag)
    }
}
```

### 4.4 滚动升级流程

**无停机滚动升级**:

```
1. 准备新版本镜像
2. 更新Deployment配置
3. Kubernetes开始滚动更新：
   a. 创建新版本Pod
   b. 等待新Pod就绪（健康检查通过）
   c. 将流量切换到新Pod
   d. 终止旧版本Pod
   e. 重复步骤a-d，直到所有Pod更新完成
4. 验证升级成功
5. 如果失败，自动回滚
6. 记录升级事件
```

**滚动升级策略**:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # 最多额外创建1个Pod
    maxUnavailable: 0  # 最多0个Pod不可用（保证可用性）
```

**滚动升级代码实现**:

```go
// 执行滚动升级
func (um *UpgradeManager) ExecuteRollingUpgrade(ctx context.Context, version string) error {
    log.Infof("开始滚动升级到版本: %s", version)
    
    // 1. 验证新版本镜像
    if err := um.validateImage(version); err != nil {
        return fmt.Errorf("镜像验证失败: %w", err)
    }
    
    // 2. 更新Deployment
    if err := um.updateDeployment(ctx, version); err != nil {
        return fmt.Errorf("更新Deployment失败: %w", err)
    }
    
    // 3. 监控升级进度
    if err := um.monitorUpgradeProgress(ctx); err != nil {
        log.Errorf("升级失败: %v", err)
        // 自动回滚
        if rollbackErr := um.rollback(ctx); rollbackErr != nil {
            return fmt.Errorf("升级失败且回滚失败: %v, %v", err, rollbackErr)
        }
        return err
    }
    
    // 4. 验证升级结果
    if err := um.validateUpgrade(ctx); err != nil {
        return fmt.Errorf("升级验证失败: %w", err)
    }
    
    // 5. 记录升级事件
    um.auditUpgradeEvent(version, true)
    
    log.Infof("滚动升级完成: %s", version)
    return nil
}
```

### 4.5 灾难恢复流程

**完整恢复流程**:

```
1. 触发灾难恢复（手动或自动）
2. 验证备份可用性
3. 停止主区域服务（如仍在运行）
4. 从备份恢复数据：
   a. 恢复Kafka数据（从MirrorMaker 2）
   b. 恢复Elasticsearch数据（从CCR或快照）
   c. 恢复PostgreSQL数据（从Streaming或备份）
   d. 恢复Redis数据（从RDB或AOF）
5. 启动备用区域服务
6. 验证数据完整性
7. 执行健康检查
8. 切换DNS到备用区域
9. 验证服务可用性
10. 通知相关人员
11. 记录恢复事件
```

**部分恢复流程**:

```
1. 确定需要恢复的组件
2. 验证该组件的备份
3. 停止该组件
4. 恢复数据
5. 启动组件
6. 验证功能
7. 记录恢复事件
```

**灾难恢复代码实现**:

```go
// 执行灾难恢复
func (drm *DisasterRecoveryManager) ExecuteRecovery(ctx context.Context, scenario DisasterScenario, mode RecoveryMode) (*RecoveryResult, error) {
    startTime := time.Now()
    log.Infof("开始执行灾难恢复: scenario=%s, mode=%s", scenario, mode)
    
    // 1. 获取恢复计划
    plan := drm.getRecoveryPlan(scenario)
    if plan == nil {
        return nil, fmt.Errorf("未找到恢复计划: %s", scenario)
    }
    
    // 2. 验证备份可用性
    if err := drm.verifyBackupAvailability(ctx); err != nil {
        return nil, fmt.Errorf("备份验证失败: %v", err)
    }
    
    // 3. 执行恢复步骤
    result := &RecoveryResult{
        Scenario:  scenario,
        Mode:      mode,
        StartTime: startTime,
        Steps:     make([]*StepResult, 0),
    }
    
    for _, step := range plan.Steps {
        stepResult := drm.executeRecoveryStep(ctx, step, mode)
        result.Steps = append(result.Steps, stepResult)
        
        if !stepResult.Success {
            // 执行回滚
            drm.rollbackRecovery(ctx, result.Steps)
            result.Success = false
            result.Error = stepResult.Error
            break
        }
    }
    
    // 4. 验证恢复结果
    if result.Success {
        if err := drm.validateRecovery(ctx); err != nil {
            result.Success = false
            result.Error = err.Error()
        }
    }
    
    result.EndTime = time.Now()
    result.Duration = result.EndTime.Sub(result.StartTime)
    
    // 5. 记录审计日志
    drm.auditRecoveryOperation(result)
    
    // 6. 更新仪表盘
    drm.dashboard.UpdateRecoveryStatus(result)
    
    log.Infof("灾难恢复完成: success=%v, duration=%v", result.Success, result.Duration)
    return result, nil
}
```

### 4.6 异常流程

**异常分类与处理**:

| 异常类型 | 触发条件 | 处理策略 | 恢复机制 |
|----------|----------|----------|----------|
| 节点心跳超时 | 30秒无心跳 | 标记不健康+移除 | 节点恢复后自动重新加入 |
| 健康检查失败 | 端点返回非200 | 标记不健康+移除 | 修复后自动恢复 |
| Master节点故障 | Master不可用 | 立即选举新Master | 旧Master恢复后降级为Replica |
| 区域故障 | 多节点同时故障 | 切换到备用区域 | 主区域恢复后手动切回 |
| 复制延迟过高 | 延迟 > 5秒 | 发送告警+监控 | 自动追赶或手动干预 |
| 数据不一致 | 验证失败 | 停止服务+告警 | 从备份重新同步 |
| 备份验证失败 | 恢复测试失败 | 告警+重新备份 | 修复备份流程 |
| 演练失败 | 恢复时间超标 | 分析原因+优化 | 更新恢复计划 |

---

## 5. 接口设计

详见 [API设计文档](./api-design.md) 模块9部分，共33个接口:

**高可用管理接口** (15个):
- API-9-320: 获取集群状态
- API-9-321: 列出集群节点
- API-9-322: 获取节点详情
- API-9-323: 注册节点
- API-9-324: 注销节点
- API-9-325: 触发故障转移
- API-9-326: 获取故障转移历史
- API-9-327: 获取健康检查结果
- API-9-328: 配置健康检查
- API-9-329: 获取复制状态
- API-9-330: 配置复制策略
- API-9-331: 获取复制延迟
- API-9-332: 执行滚动升级
- API-9-333: 获取升级状态
- API-9-334: 优雅关闭节点

**灾难恢复接口** (18个):
- API-9-335: 执行灾难恢复
- API-9-336: 获取恢复状态
- API-9-337: 列出恢复历史
- API-9-338: 获取恢复计划
- API-9-339: 创建恢复计划
- API-9-340: 更新恢复计划
- API-9-341: 删除恢复计划
- API-9-342: 执行恢复演练
- API-9-343: 获取演练报告
- API-9-344: 列出演练历史
- API-9-345: 验证备份
- API-9-346: 获取验证报告
- API-9-347: 获取DR仪表盘
- API-9-348: 获取RTO/RPO指标
- API-9-349: 配置DR策略
- API-9-350: 获取DR配置
- API-9-351: 测试故障场景
- API-9-352: 回滚恢复操作

---

## 6. 数据设计

### 6.1 数据模型

**集群节点信息**:

```go
// 节点信息
type Node struct {
    ID            string    `json:"id" db:"id"`
    Address       string    `json:"address" db:"address"`
    Region        string    `json:"region" db:"region"`
    Zone          string    `json:"zone" db:"zone"`
    Status        string    `json:"status" db:"status"`           // healthy/degraded/unhealthy/offline
    Role          string    `json:"role" db:"role"`               // master/replica/standby
    Version       string    `json:"version" db:"version"`
    LastHeartbeat time.Time `json:"last_heartbeat" db:"last_heartbeat"`
    Metrics       []byte    `json:"-" db:"metrics"`               // JSON存储
    CreatedAt     time.Time `json:"created_at" db:"created_at"`
    UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// 节点指标
type NodeMetrics struct {
    CPUUsage       float64       `json:"cpu_usage"`
    MemoryUsage    float64       `json:"memory_usage"`
    DiskUsage      float64       `json:"disk_usage"`
    NetworkLatency time.Duration `json:"network_latency"`
    RequestRate    float64       `json:"request_rate"`
    ErrorRate      float64       `json:"error_rate"`
    Timestamp      time.Time     `json:"timestamp"`
}
```

**故障转移记录**:

```go
// 故障转移事件
type FailoverEvent struct {
    ID            string    `json:"id" db:"id"`
    EventType     string    `json:"event_type" db:"event_type"`   // node_failover/region_failover/master_election
    FailedNode    string    `json:"failed_node" db:"failed_node"`
    TargetNode    string    `json:"target_node" db:"target_node"`
    Reason        string    `json:"reason" db:"reason"`
    Status        string    `json:"status" db:"status"`           // initiated/in_progress/completed/failed
    StartTime     time.Time `json:"start_time" db:"start_time"`
    EndTime       time.Time `json:"end_time" db:"end_time"`
    Duration      float64   `json:"duration" db:"duration"`       // 秒
    Impact        string    `json:"impact" db:"impact"`
    Details       []byte    `json:"-" db:"details"`               // JSON存储
    CreatedAt     time.Time `json:"created_at" db:"created_at"`
}
```

**灾难恢复计划**:

```go
// 灾难恢复计划
type DisasterRecoveryPlan struct {
    ID          string    `json:"id" db:"id"`
    Name        string    `json:"name" db:"name"`
    Scenario    string    `json:"scenario" db:"scenario"`       // datacenter_failure/region_failure等
    Description string    `json:"description" db:"description"`
    Steps       []byte    `json:"-" db:"steps"`                 // JSON存储
    RTO         int       `json:"rto" db:"rto"`                 // 分钟
    RPO         int       `json:"rpo" db:"rpo"`                 // 分钟
    Priority    int       `json:"priority" db:"priority"`
    Enabled     bool      `json:"enabled" db:"enabled"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// 恢复步骤
type RecoveryStep struct {
    Order       int           `json:"order"`
    Name        string        `json:"name"`
    Description string        `json:"description"`
    Action      string        `json:"action"`
    Timeout     time.Duration `json:"timeout"`
    Rollback    string        `json:"rollback"`
}
```

**演练报告**:

```go
// 演练报告
type DrillReport struct {
    ID            string    `json:"id" db:"id"`
    StartTime     time.Time `json:"start_time" db:"start_time"`
    EndTime       time.Time `json:"end_time" db:"end_time"`
    Duration      float64   `json:"duration" db:"duration"`
    Scenarios     []byte    `json:"-" db:"scenarios"`           // JSON存储
    SuccessCount  int       `json:"success_count" db:"success_count"`
    FailureCount  int       `json:"failure_count" db:"failure_count"`
    AvgRecoveryTime float64 `json:"avg_recovery_time" db:"avg_recovery_time"`
    DataIntegrity float64   `json:"data_integrity" db:"data_integrity"`
    Status        string    `json:"status" db:"status"`
    CreatedAt     time.Time `json:"created_at" db:"created_at"`
}
```

### 6.2 数据库设计

**PostgreSQL表结构**:

```sql
-- 集群节点表
CREATE TABLE ha_nodes (
    id VARCHAR(64) PRIMARY KEY,
    address VARCHAR(255) NOT NULL,
    region VARCHAR(64) NOT NULL,
    zone VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'healthy',
    role VARCHAR(32) NOT NULL DEFAULT 'replica',
    version VARCHAR(32),
    last_heartbeat TIMESTAMP NOT NULL DEFAULT NOW(),
    metrics JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ha_nodes_status ON ha_nodes(status);
CREATE INDEX idx_ha_nodes_region ON ha_nodes(region);
CREATE INDEX idx_ha_nodes_last_heartbeat ON ha_nodes(last_heartbeat DESC);

-- 故障转移事件表
CREATE TABLE ha_failover_events (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    failed_node VARCHAR(64),
    target_node VARCHAR(64),
    reason TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'initiated',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration FLOAT,
    impact TEXT,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ha_failover_events_event_type ON ha_failover_events(event_type);
CREATE INDEX idx_ha_failover_events_status ON ha_failover_events(status);
CREATE INDEX idx_ha_failover_events_start_time ON ha_failover_events(start_time DESC);

-- 灾难恢复计划表
CREATE TABLE dr_plans (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    scenario VARCHAR(64) NOT NULL,
    description TEXT,
    steps JSONB NOT NULL,
    rto INT NOT NULL,
    rpo INT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dr_plans_scenario ON dr_plans(scenario);
CREATE INDEX idx_dr_plans_enabled ON dr_plans(enabled);
CREATE INDEX idx_dr_plans_priority ON dr_plans(priority DESC);

-- 恢复执行记录表
CREATE TABLE dr_recovery_executions (
    id VARCHAR(64) PRIMARY KEY,
    plan_id VARCHAR(64) NOT NULL,
    scenario VARCHAR(64) NOT NULL,
    mode VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'initiated',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration FLOAT,
    success BOOLEAN,
    error TEXT,
    steps JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (plan_id) REFERENCES dr_plans(id)
);

CREATE INDEX idx_dr_recovery_executions_plan_id ON dr_recovery_executions(plan_id);
CREATE INDEX idx_dr_recovery_executions_status ON dr_recovery_executions(status);
CREATE INDEX idx_dr_recovery_executions_start_time ON dr_recovery_executions(start_time DESC);

-- 演练报告表
CREATE TABLE dr_drill_reports (
    id VARCHAR(64) PRIMARY KEY,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration FLOAT NOT NULL,
    scenarios JSONB NOT NULL,
    success_count INT NOT NULL DEFAULT 0,
    failure_count INT NOT NULL DEFAULT 0,
    avg_recovery_time FLOAT,
    data_integrity FLOAT,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dr_drill_reports_start_time ON dr_drill_reports(start_time DESC);
CREATE INDEX idx_dr_drill_reports_status ON dr_drill_reports(status);

-- 备份验证记录表
CREATE TABLE dr_backup_validations (
    id VARCHAR(64) PRIMARY KEY,
    backup_id VARCHAR(64) NOT NULL,
    validation_time TIMESTAMP NOT NULL,
    checksum_valid BOOLEAN NOT NULL,
    restore_test_passed BOOLEAN NOT NULL,
    data_integrity_score FLOAT,
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dr_backup_validations_backup_id ON dr_backup_validations(backup_id);
CREATE INDEX idx_dr_backup_validations_validation_time ON dr_backup_validations(validation_time DESC);

-- 健康检查历史表
CREATE TABLE ha_health_checks (
    id VARCHAR(64) PRIMARY KEY,
    node_id VARCHAR(64) NOT NULL,
    check_time TIMESTAMP NOT NULL,
    endpoint VARCHAR(64) NOT NULL,
    status_code INT,
    response_time_ms FLOAT,
    success BOOLEAN NOT NULL,
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (node_id) REFERENCES ha_nodes(id)
);

CREATE INDEX idx_ha_health_checks_node_id ON ha_health_checks(node_id);
CREATE INDEX idx_ha_health_checks_check_time ON ha_health_checks(check_time DESC);

-- 告警规则表
CREATE TABLE ha_alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(32) NOT NULL DEFAULT 'custom',
    expression TEXT NOT NULL,
    duration VARCHAR(32) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    threshold FLOAT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    summary TEXT NOT NULL,
    description TEXT,
    labels JSONB,
    annotations JSONB,
    notify_channels JSONB,
    created_by VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX idx_ha_alert_rules_category ON ha_alert_rules(category);
CREATE INDEX idx_ha_alert_rules_enabled ON ha_alert_rules(enabled);
CREATE INDEX idx_ha_alert_rules_name ON ha_alert_rules(name);

-- 告警规则变更历史表
CREATE TABLE ha_alert_rule_history (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    version BIGINT NOT NULL,
    changes JSONB NOT NULL,
    changed_by VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (rule_id) REFERENCES ha_alert_rules(id)
);

CREATE INDEX idx_ha_alert_rule_history_rule_id ON ha_alert_rule_history(rule_id);
CREATE INDEX idx_ha_alert_rule_history_changed_at ON ha_alert_rule_history(changed_at DESC);

-- 通知渠道表
CREATE TABLE ha_notify_channels (
    id VARCHAR(64) PRIMARY KEY,
    type VARCHAR(32) NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    config JSONB NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ha_notify_channels_type ON ha_notify_channels(type);
CREATE INDEX idx_ha_notify_channels_enabled ON ha_notify_channels(enabled);

-- 告警触发历史表
CREATE TABLE ha_alert_triggers (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    severity VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL,
    triggered_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    duration FLOAT,
    labels JSONB,
    annotations JSONB,
    value FLOAT,
    threshold FLOAT,
    notified_channels JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    FOREIGN KEY (rule_id) REFERENCES ha_alert_rules(id)
);

CREATE INDEX idx_ha_alert_triggers_rule_id ON ha_alert_triggers(rule_id);
CREATE INDEX idx_ha_alert_triggers_triggered_at ON ha_alert_triggers(triggered_at DESC);
CREATE INDEX idx_ha_alert_triggers_status ON ha_alert_triggers(status);

-- 告警规则模板表
CREATE TABLE ha_alert_rule_templates (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(32) NOT NULL,
    expression TEXT NOT NULL,
    suggested_threshold FLOAT,
    suggested_duration VARCHAR(32),
    suggested_severity VARCHAR(32),
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ha_alert_rule_templates_category ON ha_alert_rule_templates(category);
```

### 6.3 缓存设计

**Redis缓存策略**:

| 缓存类型 | Key格式 | TTL | 说明 |
|---------|---------|-----|------|
| 节点状态 | `ha:node:{id}:status` | 60s | 节点当前状态 |
| 节点指标 | `ha:node:{id}:metrics` | 30s | 节点性能指标 |
| 集群状态 | `ha:cluster:status` | 10s | 集群整体状态 |
| Master节点 | `ha:cluster:master` | 永久 | 当前Master节点ID |
| 故障转移状态 | `ha:failover:{id}:status` | 3600s | 故障转移进度 |
| 复制延迟 | `ha:replication:lag:{component}` | 10s | 各组件复制延迟 |
| DR配置 | `dr:config` | 永久 | 灾难恢复配置 |
| 恢复计划 | `dr:plan:{id}` | 永久 | 恢复计划详情 |
| 演练状态 | `dr:drill:{id}:status` | 7200s | 演练执行状态 |

**缓存更新策略**:

```go
// 更新节点状态缓存
func (cm *ClusterManager) updateNodeStatusCache(node *Node) error {
    key := fmt.Sprintf("ha:node:%s:status", node.ID)
    
    data, err := json.Marshal(node)
    if err != nil {
        return err
    }
    
    // 设置缓存，TTL 60秒
    if err := cm.redis.Set(key, data, 60*time.Second).Err(); err != nil {
        return err
    }
    
    // 发布节点状态变更事件
    cm.redis.Publish("ha:node:status:changed", node.ID)
    
    return nil
}

// 从缓存获取节点状态
func (cm *ClusterManager) getNodeStatusFromCache(nodeID string) (*Node, error) {
    key := fmt.Sprintf("ha:node:%s:status", nodeID)
    
    data, err := cm.redis.Get(key).Bytes()
    if err == redis.Nil {
        // 缓存未命中，从数据库加载
        return cm.loadNodeFromDB(nodeID)
    } else if err != nil {
        return nil, err
    }
    
    var node Node
    if err := json.Unmarshal(data, &node); err != nil {
        return nil, err
    }
    
    return &node, nil
}
```

---

## 7. 安全设计

### 7.1 认证与授权

**权限模型**:

| 权限 | 说明 | 适用角色 |
|------|------|----------|
| ha.read | 查看集群状态、节点信息 | 运维人员、管理员 |
| ha.write | 配置健康检查、复制策略 | 运维人员、管理员 |
| ha.admin | 触发故障转移、执行升级 | 管理员 |
| dr.read | 查看恢复计划、演练报告 | 运维人员、管理员 |
| dr.write | 创建恢复计划、执行演练 | 运维人员、管理员 |
| dr.admin | 执行灾难恢复、回滚操作 | 管理员 |

**双因素认证**:

```go
// 关键操作需要双因素认证
func (hm *HAManager) TriggerFailover(ctx context.Context, nodeID string) error {
    // 1. 验证JWT Token
    user, err := hm.auth.ValidateToken(ctx)
    if err != nil {
        return ErrUnauthorized
    }
    
    // 2. 验证权限
    if !user.HasPermission("ha.admin") {
        return ErrForbidden
    }
    
    // 3. 要求双因素认证
    if !hm.auth.Verify2FA(ctx, user.ID) {
        return ErrRequire2FA
    }
    
    // 4. 执行故障转移
    return hm.executeFailover(ctx, nodeID)
}
```

### 7.2 数据安全

**敏感数据保护**:

| 数据类型 | 保护措施 | 实现方式 |
|---------|---------|----------|
| 节点凭证 | 加密存储 | AES-256-GCM |
| etcd数据 | TLS加密 | TLS 1.3 |
| 跨区域通信 | 加密传输 | TLS 1.3 + mTLS |
| 备份数据 | 加密存储 | AES-256-GCM |
| 审计日志 | 不可篡改 | 哈希链 |

**网络隔离**:

```yaml
# Kubernetes NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ha-network-policy
spec:
  podSelector:
    matchLabels:
      app: log-management
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          role: api-server
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - podSelector:
        matchLabels:
          role: database
    ports:
    - protocol: TCP
      port: 5432
```

### 7.3 审计日志

**审计事件**:

| 事件类型 | 记录内容 | 保留期 |
|---------|---------|--------|
| 节点注册/注销 | 节点ID、时间、操作人 | 3年 |
| 故障转移 | 故障节点、目标节点、原因、时间 | 7年 |
| Master选举 | 旧Master、新Master、时间 | 7年 |
| 配置变更 | 配置项、变更前后、操作人 | 3年 |
| 灾难恢复 | 场景、模式、结果、时间 | 7年 |
| 演练执行 | 演练ID、结果、时间 | 7年 |
| 备份验证 | 备份ID、验证结果、时间 | 3年 |

**审计日志实现**:

```go
// 审计故障转移事件
func (cm *ClusterManager) auditFailoverEvent(event *FailoverEvent) {
    auditLog := &AuditLog{
        Timestamp:    time.Now(),
        Action:       "node_failover",
        ResourceType: "node",
        ResourceID:   event.FailedNode,
        UserID:       "system",
        Details: map[string]interface{}{
            "event_type":  event.EventType,
            "failed_node": event.FailedNode,
            "target_node": event.TargetNode,
            "reason":      event.Reason,
            "duration":    event.Duration,
            "impact":      event.Impact,
        },
        PrevHash: cm.getLastAuditLogHash(),
    }
    
    // 计算哈希（防篡改）
    auditLog.Hash = cm.calculateAuditLogHash(auditLog)
    
    // 保存到数据库（保留7年）
    auditService.LogWithRetention(auditLog, 7*365*24*time.Hour)
}
```

### 7.4 安全合规

**符合的安全标准**:

- ISO 27001: 信息安全管理体系
- SOC 2: 安全控制审计
- PCI DSS: 支付卡行业数据安全标准
- GDPR: 数据保护条例

**安全检查清单**:

- [x] 所有API需要身份认证
- [x] 关键操作需要双因素认证
- [x] 跨区域通信使用mTLS
- [x] 敏感数据加密存储
- [x] 审计日志不可篡改
- [x] 网络隔离和访问控制
- [x] 定期安全扫描
- [x] 最小权限原则

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 系统可用性 | 99.99% | Prometheus监控 |
| 故障转移时间 | < 30秒 | 时间戳差值 |
| 区域故障转移时间 | < 5分钟 | 时间戳差值 |
| 健康检查响应时间 | < 100ms | HTTP请求耗时 |
| 跨区域复制延迟 | < 5秒 | 监控指标 |
| 灾难恢复时间 | < 30分钟 | 时间戳差值 |
| 备份验证成功率 | >= 99% | 统计计算 |
| 滚动升级期间可用性 | >= 99% | Prometheus监控 |

### 8.2 优化策略

**故障检测优化**:

```go
// 使用多级健康检查，减少误判
func (cm *ClusterManager) advancedHealthCheck(node *Node) bool {
    // 1. 快速检查（心跳）
    if time.Since(node.LastHeartbeat) > cm.config.HealthCheckInterval*3 {
        // 2. 二次确认（健康端点）
        if !cm.checkHealthEndpoints(node) {
            // 3. 三次确认（Ping测试）
            if !cm.pingNode(node) {
                return false
            }
        }
    }
    return true
}
```

**故障转移优化**:

1. **预热备用节点**: 备用节点保持热备状态，减少切换时间
2. **连接池预建**: 提前建立到备用节点的连接池
3. **DNS预解析**: 缓存备用区域的DNS记录
4. **并行切换**: 多个组件并行执行故障转移

```go
// 并行故障转移
func (cm *ClusterManager) parallelFailover(failedNodes []*Node) error {
    var wg sync.WaitGroup
    errChan := make(chan error, len(failedNodes))
    
    for _, node := range failedNodes {
        wg.Add(1)
        go func(n *Node) {
            defer wg.Done()
            if err := cm.handleNodeFailure(context.Background(), n); err != nil {
                errChan <- err
            }
        }(node)
    }
    
    wg.Wait()
    close(errChan)
    
    // 收集错误
    var errors []error
    for err := range errChan {
        errors = append(errors, err)
    }
    
    if len(errors) > 0 {
        return fmt.Errorf("部分故障转移失败: %v", errors)
    }
    
    return nil
}
```

**跨区域复制优化**:

1. **批量复制**: 批量发送数据，减少网络往返
2. **压缩传输**: 使用LZ4压缩，减少带宽占用
3. **增量复制**: 只复制变更数据，减少传输量
4. **并行复制**: 多个复制线程并行工作

```properties
# Kafka MirrorMaker 2 优化配置
tasks.max=8                          # 8个并行任务
replication.factor=3                 # 3副本
compression.type=lz4                 # LZ4压缩
batch.size=16384                     # 16KB批量大小
linger.ms=10                         # 10ms延迟
buffer.memory=33554432               # 32MB缓冲区
```

**灾难恢复优化**:

1. **增量备份**: 只备份变更数据，减少备份时间
2. **并行恢复**: 多个组件并行恢复
3. **流式恢复**: 边恢复边验证，减少总时间
4. **预演练**: 定期演练，优化恢复流程

### 8.3 性能监控

**Prometheus指标**:

```go
var (
    // 可用性指标
    systemUptime = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "ha_system_uptime_seconds",
            Help: "系统运行时间",
        },
    )
    
    systemAvailability = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "ha_system_availability_percent",
            Help: "系统可用性百分比",
        },
    )
    
    // 故障转移指标
    failoverDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "ha_failover_duration_seconds",
            Help:    "故障转移耗时",
            Buckets: []float64{1, 5, 10, 30, 60, 300},
        },
        []string{"type"},
    )
    
    failoverTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "ha_failover_total",
            Help: "故障转移总数",
        },
        []string{"type", "status"},
    )
    
    // 健康检查指标
    healthCheckDuration = prometheus.NewHistogram(
        prometheus.HistogramOpts{
            Name:    "ha_health_check_duration_milliseconds",
            Help:    "健康检查耗时",
            Buckets: []float64{10, 50, 100, 200, 500},
        },
    )
    
    healthCheckTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "ha_health_check_total",
            Help: "健康检查总数",
        },
        []string{"node", "status"},
    )
    
    // 复制延迟指标
    replicationLag = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "ha_replication_lag_seconds",
            Help: "跨区域复制延迟",
        },
        []string{"component", "source_region", "target_region"},
    )
    
    // 灾难恢复指标
    drRecoveryDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "dr_recovery_duration_seconds",
            Help:    "灾难恢复耗时",
            Buckets: []float64{60, 300, 600, 1200, 1800},
        },
        []string{"scenario", "mode"},
    )
    
    drDrillSuccessRate = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "dr_drill_success_rate_percent",
            Help: "演练成功率",
        },
    )
    
    drBackupValidationRate = prometheus.NewGauge(
        prometheus.GaugeOpts{
            Name: "dr_backup_validation_rate_percent",
            Help: "备份验证成功率",
        },
    )
)
```

---

## 9. 部署方案

### 9.1 部署架构

**Kubernetes多区域部署**:

```yaml
# 区域A - 主区域
apiVersion: v1
kind: Namespace
metadata:
  name: log-management-region-a
  labels:
    region: region-a
    role: primary

---
# API Server Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-server
  namespace: log-management-region-a
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-server
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: api-server
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - api-server
            topologyKey: kubernetes.io/hostname
      containers:
      - name: api-server
        image: log-management/api-server:v1.0
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: REGION
          value: "region-a"
        - name: ROLE
          value: "primary"
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /live
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 2
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sh", "-c", "sleep 15"]

---
# HPA配置
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-server-hpa
  namespace: log-management-region-a
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
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
        periodSeconds: 15

---
# PDB配置
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-server-pdb
  namespace: log-management-region-a
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: api-server
```

**Kafka集群部署**:

```yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: log-kafka
  namespace: log-management-region-a
spec:
  kafka:
    version: 3.6.0
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      inter.broker.protocol.version: "3.6"
    storage:
      type: jbod
      volumes:
      - id: 0
        type: persistent-claim
        size: 500Gi
        class: fast-ssd
        deleteClaim: false
    resources:
      requests:
        memory: 4Gi
        cpu: 2000m
      limits:
        memory: 8Gi
        cpu: 4000m
  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 100Gi
      class: fast-ssd
      deleteClaim: false
    resources:
      requests:
        memory: 2Gi
        cpu: 1000m
      limits:
        memory: 4Gi
        cpu: 2000m
  entityOperator:
    topicOperator: {}
    userOperator: {}
```

**Elasticsearch集群部署**:

```yaml
apiVersion: elasticsearch.k8s.elastic.co/v1
kind: Elasticsearch
metadata:
  name: log-es
  namespace: log-management-region-a
spec:
  version: 8.11.0
  nodeSets:
  # Master节点
  - name: master
    count: 3
    config:
      node.roles: ["master"]
      xpack.security.enabled: true
      xpack.security.transport.ssl.enabled: true
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 4Gi
              cpu: 2000m
            limits:
              memory: 8Gi
              cpu: 4000m
    volumeClaimTemplates:
    - metadata:
        name: elasticsearch-data
      spec:
        accessModes:
        - ReadWriteOnce
        resources:
          requests:
            storage: 100Gi
        storageClassName: fast-ssd
  
  # Data Hot节点
  - name: data-hot
    count: 3
    config:
      node.roles: ["data_hot", "data_content"]
      xpack.security.enabled: true
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 16Gi
              cpu: 4000m
            limits:
              memory: 32Gi
              cpu: 8000m
    volumeClaimTemplates:
    - metadata:
        name: elasticsearch-data
      spec:
        accessModes:
        - ReadWriteOnce
        resources:
          requests:
            storage: 2Ti
        storageClassName: fast-ssd
  
  # Data Warm节点
  - name: data-warm
    count: 3
    config:
      node.roles: ["data_warm"]
      xpack.security.enabled: true
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 8Gi
              cpu: 2000m
            limits:
              memory: 16Gi
              cpu: 4000m
    volumeClaimTemplates:
    - metadata:
        name: elasticsearch-data
      spec:
        accessModes:
        - ReadWriteOnce
        resources:
          requests:
            storage: 5Ti
        storageClassName: standard-ssd
  
  # Coordinating节点
  - name: coordinating
    count: 2
    config:
      node.roles: []
      xpack.security.enabled: true
    podTemplate:
      spec:
        containers:
        - name: elasticsearch
          resources:
            requests:
              memory: 4Gi
              cpu: 2000m
            limits:
              memory: 8Gi
              cpu: 4000m
```

### 9.2 资源配置

| 环境 | 组件 | 副本数 | CPU | 内存 | 存储 |
|------|------|--------|-----|------|------|
| 开发 | API Server | 2 | 0.5核 | 1GB | - |
| 开发 | Kafka | 1 | 1核 | 2GB | 100GB |
| 开发 | Elasticsearch | 3 | 1核 | 4GB | 500GB |
| 开发 | PostgreSQL | 1 | 1核 | 2GB | 50GB |
| 开发 | Redis | 1 | 0.5核 | 1GB | 10GB |
| 测试 | API Server | 3 | 1核 | 2GB | - |
| 测试 | Kafka | 3 | 2核 | 4GB | 500GB |
| 测试 | Elasticsearch | 6 | 2核 | 8GB | 2TB |
| 测试 | PostgreSQL | 3 | 2核 | 4GB | 200GB |
| 测试 | Redis | 3 | 1核 | 2GB | 50GB |
| 生产 | API Server | 3-10 (HPA) | 2核 | 4GB | - |
| 生产 | Kafka | 3 | 4核 | 8GB | 2TB |
| 生产 | Elasticsearch | 11 | 4-8核 | 16-32GB | 10TB |
| 生产 | PostgreSQL | 3 | 4核 | 8GB | 1TB |
| 生产 | Redis | 6 | 2核 | 4GB | 200GB |

### 9.3 跨区域复制配置

**Kafka MirrorMaker 2配置**:

```properties
# MirrorMaker 2配置
clusters = region-a, region-b
region-a.bootstrap.servers = kafka-region-a:9092
region-b.bootstrap.servers = kafka-region-b:9092

# 复制流配置
region-a->region-b.enabled = true
region-a->region-b.topics = .*
region-a->region-b.groups = .*

# 性能配置
tasks.max = 8
replication.factor = 3
refresh.topics.enabled = true
refresh.topics.interval.seconds = 60
sync.topic.configs.enabled = true
sync.topic.acls.enabled = true

# 偏移量同步
checkpoints.topic.replication.factor = 3
heartbeats.topic.replication.factor = 3
offset-syncs.topic.replication.factor = 3
```

**Elasticsearch CCR配置**:

```json
{
  "remote_cluster": "region-b",
  "leader_index": "logs-*",
  "max_read_request_operation_count": 5120,
  "max_outstanding_read_requests": 12,
  "max_read_request_size": "32mb",
  "max_write_request_operation_count": 5120,
  "max_write_request_size": "9mb",
  "max_outstanding_write_requests": 9,
  "max_write_buffer_count": 2147483647,
  "max_write_buffer_size": "512mb",
  "max_retry_delay": "500ms",
  "read_poll_timeout": "1m"
}
```

**PostgreSQL流复制配置**:

```ini
# postgresql.conf (Primary)
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
synchronous_commit = on
synchronous_standby_names = 'standby1,standby2'

# recovery.conf (Standby)
standby_mode = on
primary_conninfo = 'host=primary-host port=5432 user=replicator password=xxx'
primary_slot_name = 'standby_slot'
```

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus指标**:

```
# 系统可用性指标
ha_system_uptime_seconds 86400
ha_system_availability_percent 99.99
ha_nodes_total{status="healthy"} 9
ha_nodes_total{status="unhealthy"} 0

# 故障转移指标
ha_failover_duration_seconds{type="node_failover",quantile="0.95"} 25
ha_failover_total{type="node_failover",status="success"} 5
ha_failover_total{type="region_failover",status="success"} 0

# 健康检查指标
ha_health_check_duration_milliseconds{quantile="0.95"} 85
ha_health_check_total{node="node-1",status="success"} 8640
ha_health_check_total{node="node-1",status="failed"} 0

# 复制延迟指标
ha_replication_lag_seconds{component="kafka",source_region="region-a",target_region="region-b"} 2.5
ha_replication_lag_seconds{component="elasticsearch",source_region="region-a",target_region="region-b"} 3.2
ha_replication_lag_seconds{component="postgresql",source_region="region-a",target_region="region-b"} 1.8

# 灾难恢复指标
dr_recovery_duration_seconds{scenario="datacenter_failure",mode="full",quantile="0.95"} 1200
dr_drill_success_rate_percent 100
dr_backup_validation_rate_percent 99.5
dr_rto_seconds 1800
dr_rpo_seconds 60
```

### 10.2 告警规则

**告警规则支持热更新**，通过配置中心管理，无需重启Prometheus。

**告警规则定义**:

| 告警名称 | 表达式 | 持续时间 | 严重级别 | 阈值 | 是否启用 |
|---------|--------|----------|----------|------|---------|
| SystemAvailabilityLow | ha_system_availability_percent < threshold | 5m | critical | 99.9 | 是 |
| UnhealthyNodesDetected | ha_nodes_total{status="unhealthy"} > 0 | 1m | warning | 0 | 是 |
| FailoverFailed | rate(ha_failover_total{status="failed"}[5m]) > 0 | 1m | critical | 0 | 是 |
| HealthCheckFailureRateHigh | rate(ha_health_check_total{status="failed"}[5m]) > threshold | 5m | warning | 0.1 | 是 |
| ReplicationLagHigh | ha_replication_lag_seconds > threshold | 5m | warning | 10 | 是 |
| RTOExceeded | dr_rto_seconds > threshold | 1m | critical | 1800 | 是 |
| RPOExceeded | dr_rpo_seconds > threshold | 1m | critical | 60 | 是 |
| BackupValidationRateLow | dr_backup_validation_rate_percent < threshold | 10m | warning | 99 | 是 |
| DrillFailed | dr_drill_success_rate_percent < 100 | 1m | warning | 100 | 是 |

**告警规则热更新实现**:

```go
// 告警规则管理器
type AlertRuleManager struct {
    db              *sql.DB
    redis           *redis.Client
    prometheus      *PrometheusClient
    rules           atomic.Value  // 存储[]*AlertRule
    pubsub          *redis.PubSub
}

// 告警规则结构
type AlertRule struct {
    ID          string        `json:"id" db:"id"`
    Name        string        `json:"name" db:"name"`
    Expression  string        `json:"expression" db:"expression"`
    Duration    string        `json:"duration" db:"duration"`
    Severity    string        `json:"severity" db:"severity"`
    Threshold   float64       `json:"threshold" db:"threshold"`
    Enabled     bool          `json:"enabled" db:"enabled"`
    Summary     string        `json:"summary" db:"summary"`
    Description string        `json:"description" db:"description"`
    Version     int64         `json:"version" db:"version"`
    UpdatedAt   time.Time     `json:"updated_at" db:"updated_at"`
}

// 启动告警规则管理器
func (arm *AlertRuleManager) Start() error {
    // 1. 从PostgreSQL加载告警规则
    rules, err := arm.loadRulesFromDB()
    if err != nil {
        return fmt.Errorf("加载告警规则失败: %w", err)
    }
    arm.rules.Store(rules)
    
    // 2. 同步到Prometheus
    if err := arm.syncToPrometheus(rules); err != nil {
        log.Warn("同步告警规则到Prometheus失败", err)
    }
    
    // 3. 订阅规则变更通知
    arm.pubsub = arm.redis.Subscribe("config:module9:alert_rules:reload")
    
    // 4. 启动规则监听协程
    go arm.watchRuleChanges()
    
    log.Info("告警规则管理器已启动")
    return nil
}

// 监听规则变更
func (arm *AlertRuleManager) watchRuleChanges() {
    for {
        select {
        case msg := <-arm.pubsub.Channel():
            log.Infof("收到告警规则变更通知: %s", msg.Payload)
            
            // 从Redis加载新规则
            newRules, err := arm.loadRulesFromRedis()
            if err != nil {
                log.Error("加载新告警规则失败", err)
                continue
            }
            
            // 验证规则
            if err := arm.validateRules(newRules); err != nil {
                log.Error("告警规则验证失败", err)
                continue
            }
            
            // 同步到Prometheus
            if err := arm.syncToPrometheus(newRules); err != nil {
                log.Error("同步告警规则到Prometheus失败", err)
                continue
            }
            
            // 原子更新规则
            arm.rules.Store(newRules)
            
            log.Infof("告警规则已更新: %d条规则", len(newRules))
        }
    }
}

// 同步规则到Prometheus
func (arm *AlertRuleManager) syncToPrometheus(rules []*AlertRule) error {
    // 生成Prometheus规则配置
    promRules := arm.generatePrometheusRules(rules)
    
    // 通过Prometheus API更新规则
    // 使用Prometheus的配置热加载功能
    if err := arm.prometheus.ReloadRules(promRules); err != nil {
        return err
    }
    
    log.Info("告警规则已同步到Prometheus")
    return nil
}

// 生成Prometheus规则配置
func (arm *AlertRuleManager) generatePrometheusRules(rules []*AlertRule) string {
    var groups []map[string]interface{}
    
    ruleGroup := map[string]interface{}{
        "name":     "ha_alerts",
        "interval": "30s",
        "rules":    []map[string]interface{}{},
    }
    
    for _, rule := range rules {
        if !rule.Enabled {
            continue
        }
        
        // 替换表达式中的阈值占位符
        expr := strings.ReplaceAll(rule.Expression, "threshold", fmt.Sprintf("%v", rule.Threshold))
        
        promRule := map[string]interface{}{
            "alert": rule.Name,
            "expr":  expr,
            "for":   rule.Duration,
            "labels": map[string]string{
                "severity": rule.Severity,
            },
            "annotations": map[string]string{
                "summary":     rule.Summary,
                "description": rule.Description,
            },
        }
        
        ruleGroup["rules"] = append(ruleGroup["rules"].([]map[string]interface{}), promRule)
    }
    
    groups = append(groups, ruleGroup)
    
    config := map[string]interface{}{
        "groups": groups,
    }
    
    yamlData, _ := yaml.Marshal(config)
    return string(yamlData)
}

// 更新告警规则（通过API）
func (arm *AlertRuleManager) UpdateRule(ctx context.Context, ruleID string, updates map[string]interface{}) error {
    // 1. 加载当前规则
    rules := arm.GetRules()
    var targetRule *AlertRule
    for _, rule := range rules {
        if rule.ID == ruleID {
            targetRule = rule
            break
        }
    }
    
    if targetRule == nil {
        return fmt.Errorf("规则不存在: %s", ruleID)
    }
    
    // 2. 应用更新
    newRule := *targetRule
    newRule.Version++
    newRule.UpdatedAt = time.Now()
    
    for key, value := range updates {
        switch key {
        case "threshold":
            newRule.Threshold = value.(float64)
        case "duration":
            newRule.Duration = value.(string)
        case "severity":
            newRule.Severity = value.(string)
        case "enabled":
            newRule.Enabled = value.(bool)
        case "summary":
            newRule.Summary = value.(string)
        case "description":
            newRule.Description = value.(string)
        }
    }
    
    // 3. 验证新规则
    if err := arm.validateRule(&newRule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 4. 保存到PostgreSQL
    if err := arm.saveRuleToDB(&newRule); err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 5. 同步到Redis
    if err := arm.syncRulesToRedis(); err != nil {
        return fmt.Errorf("同步规则失败: %w", err)
    }
    
    // 6. 发布规则变更通知
    arm.redis.Publish("config:module9:alert_rules:reload", newRule.Version)
    
    log.Infof("告警规则已更新: %s, version=%d", ruleID, newRule.Version)
    return nil
}

// 获取当前规则
func (arm *AlertRuleManager) GetRules() []*AlertRule {
    return arm.rules.Load().([]*AlertRule)
}
```

**自定义告警功能**:

系统支持用户创建、修改、删除自定义告警规则，满足不同业务场景的监控需求。

**自定义告警规则结构**:

```go
// 自定义告警规则
type CustomAlertRule struct {
    ID          string            `json:"id" db:"id"`
    Name        string            `json:"name" db:"name"`
    Category    string            `json:"category" db:"category"`      // ha/dr/custom
    Expression  string            `json:"expression" db:"expression"`
    Duration    string            `json:"duration" db:"duration"`
    Severity    string            `json:"severity" db:"severity"`      // critical/warning/info
    Threshold   float64           `json:"threshold" db:"threshold"`
    Enabled     bool              `json:"enabled" db:"enabled"`
    Summary     string            `json:"summary" db:"summary"`
    Description string            `json:"description" db:"description"`
    Labels      map[string]string `json:"labels" db:"labels"`          // 自定义标签
    Annotations map[string]string `json:"annotations" db:"annotations"` // 自定义注解
    NotifyChannels []string       `json:"notify_channels" db:"notify_channels"` // 通知渠道
    CreatedBy   string            `json:"created_by" db:"created_by"`
    CreatedAt   time.Time         `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
    Version     int64             `json:"version" db:"version"`
}

// 告警通知渠道
type NotifyChannel struct {
    ID       string `json:"id"`
    Type     string `json:"type"`      // email/slack/webhook/sms/dingtalk
    Name     string `json:"name"`
    Config   map[string]interface{} `json:"config"`
    Enabled  bool   `json:"enabled"`
}
```

**告警规则API接口**:

```bash
# 1. 获取所有告警规则（支持分类筛选）
curl "http://ha-manager:8080/api/v1/ha/alert-rules?category=ha&enabled=true" \
  -H "Authorization: Bearer $TOKEN"

# 响应示例：
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "rule-001",
        "name": "SystemAvailabilityLow",
        "category": "ha",
        "expression": "ha_system_availability_percent < threshold",
        "duration": "5m",
        "severity": "critical",
        "threshold": 99.9,
        "enabled": true,
        "summary": "系统可用性过低",
        "description": "系统可用性为 {{ $value }}%，低于阈值",
        "labels": {"team": "sre", "service": "ha"},
        "notify_channels": ["email-ops", "slack-alerts"],
        "created_by": "system",
        "version": 1
      }
    ],
    "total": 9
  }
}

# 2. 获取单个告警规则详情
curl http://ha-manager:8080/api/v1/ha/alert-rules/ReplicationLagHigh \
  -H "Authorization: Bearer $TOKEN"

# 3. 创建自定义告警规则（热更新）
curl -X POST http://ha-manager:8080/api/v1/ha/alert-rules \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CustomNodeCPUHigh",
    "category": "custom",
    "expression": "ha_node_cpu_usage{node=\"{{$labels.node}}\"} > threshold",
    "duration": "5m",
    "severity": "warning",
    "threshold": 80,
    "enabled": true,
    "summary": "节点CPU使用率过高",
    "description": "节点 {{ $labels.node }} CPU使用率为 {{ $value }}%，超过阈值 {{ $threshold }}%",
    "labels": {
      "team": "ops",
      "service": "monitoring",
      "priority": "high"
    },
    "annotations": {
      "runbook": "https://wiki.example.com/runbook/cpu-high",
      "dashboard": "https://grafana.example.com/d/node-metrics"
    },
    "notify_channels": ["email-ops", "slack-alerts", "webhook-oncall"]
  }'

# 响应示例：
{
  "code": 0,
  "data": {
    "id": "rule-custom-001",
    "name": "CustomNodeCPUHigh",
    "version": 1,
    "created_at": "2026-01-31T12:00:00Z"
  },
  "message": "告警规则创建成功，已自动同步到Prometheus"
}

# 4. 更新告警规则（热更新）
curl -X PUT http://ha-manager:8080/api/v1/ha/alert-rules/ReplicationLagHigh \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 15,
    "duration": "10m",
    "severity": "critical",
    "notify_channels": ["email-ops", "slack-critical", "sms-oncall"]
  }'

# 5. 批量更新告警规则
curl -X PUT http://ha-manager:8080/api/v1/ha/alert-rules/batch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {"id": "rule-001", "threshold": 99.95},
      {"id": "rule-002", "enabled": false},
      {"id": "rule-003", "duration": "10m"}
    ]
  }'

# 6. 启用/禁用告警规则（热更新）
curl -X PATCH http://ha-manager:8080/api/v1/ha/alert-rules/DrillFailed/status \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled":false}'

# 7. 删除自定义告警规则（热更新）
curl -X DELETE http://ha-manager:8080/api/v1/ha/alert-rules/CustomNodeCPUHigh \
  -H "Authorization: Bearer $TOKEN"

# 8. 测试告警规则（不实际触发告警）
curl -X POST http://ha-manager:8080/api/v1/ha/alert-rules/CustomNodeCPUHigh/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "test_data": {
      "node": "node-1",
      "value": 85
    }
  }'

# 响应示例：
{
  "code": 0,
  "data": {
    "would_trigger": true,
    "matched_expression": "ha_node_cpu_usage{node=\"node-1\"} > 80",
    "actual_value": 85,
    "threshold": 80,
    "message": "告警将会触发：节点 node-1 CPU使用率为 85%，超过阈值 80%"
  }
}

# 9. 获取告警规则模板
curl http://ha-manager:8080/api/v1/ha/alert-rules/templates \
  -H "Authorization: Bearer $TOKEN"

# 响应示例：
{
  "code": 0,
  "data": {
    "templates": [
      {
        "id": "template-cpu",
        "name": "CPU使用率告警",
        "category": "resource",
        "expression": "node_cpu_usage > threshold",
        "suggested_threshold": 80,
        "suggested_duration": "5m"
      },
      {
        "id": "template-memory",
        "name": "内存使用率告警",
        "category": "resource",
        "expression": "node_memory_usage > threshold",
        "suggested_threshold": 85,
        "suggested_duration": "5m"
      },
      {
        "id": "template-disk",
        "name": "磁盘使用率告警",
        "category": "resource",
        "expression": "node_disk_usage > threshold",
        "suggested_threshold": 90,
        "suggested_duration": "10m"
      }
    ]
  }
}

# 10. 从模板创建告警规则
curl -X POST http://ha-manager:8080/api/v1/ha/alert-rules/from-template \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "template_id": "template-cpu",
    "name": "ProductionNodeCPUAlert",
    "threshold": 75,
    "duration": "3m",
    "labels": {"env": "production"},
    "notify_channels": ["email-ops"]
  }'

# 11. 导出告警规则（YAML格式）
curl http://ha-manager:8080/api/v1/ha/alert-rules/export?format=yaml \
  -H "Authorization: Bearer $TOKEN" \
  > alert-rules-backup.yaml

# 12. 导入告警规则（批量创建）
curl -X POST http://ha-manager:8080/api/v1/ha/alert-rules/import \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@alert-rules-backup.yaml"

# 13. 获取告警规则变更历史
curl http://ha-manager:8080/api/v1/ha/alert-rules/ReplicationLagHigh/history \
  -H "Authorization: Bearer $TOKEN"

# 响应示例：
{
  "code": 0,
  "data": {
    "history": [
      {
        "version": 3,
        "changed_by": "admin@example.com",
        "changed_at": "2026-01-31T12:00:00Z",
        "changes": {
          "threshold": {"old": 10, "new": 15},
          "duration": {"old": "5m", "new": "10m"}
        }
      },
      {
        "version": 2,
        "changed_by": "ops@example.com",
        "changed_at": "2026-01-30T10:00:00Z",
        "changes": {
          "enabled": {"old": false, "new": true}
        }
      }
    ]
  }
}

# 14. 回滚告警规则到指定版本
curl -X POST http://ha-manager:8080/api/v1/ha/alert-rules/ReplicationLagHigh/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"version": 2}'
```

**告警通知渠道管理**:

```bash
# 1. 获取所有通知渠道
curl http://ha-manager:8080/api/v1/ha/notify-channels \
  -H "Authorization: Bearer $TOKEN"

# 2. 创建通知渠道
curl -X POST http://ha-manager:8080/api/v1/ha/notify-channels \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "type": "slack",
    "name": "slack-critical",
    "config": {
      "webhook_url": "https://hooks.slack.com/services/xxx",
      "channel": "#alerts-critical",
      "username": "AlertBot"
    },
    "enabled": true
  }'

# 3. 测试通知渠道
curl -X POST http://ha-manager:8080/api/v1/ha/notify-channels/slack-critical/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "message": "这是一条测试告警消息"
  }'

# 4. 更新通知渠道
curl -X PUT http://ha-manager:8080/api/v1/ha/notify-channels/slack-critical \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "config": {
      "channel": "#alerts-all"
    }
  }'

# 5. 删除通知渠道
curl -X DELETE http://ha-manager:8080/api/v1/ha/notify-channels/slack-critical \
  -H "Authorization: Bearer $TOKEN"
```

**告警规则验证**:

```go
// 验证自定义告警规则
func (arm *AlertRuleManager) validateCustomRule(rule *CustomAlertRule) error {
    // 1. 验证必填字段
    if rule.Name == "" {
        return fmt.Errorf("告警规则名称不能为空")
    }
    
    if rule.Expression == "" {
        return fmt.Errorf("告警表达式不能为空")
    }
    
    // 2. 验证表达式语法（PromQL）
    if err := arm.validatePromQLExpression(rule.Expression); err != nil {
        return fmt.Errorf("告警表达式语法错误: %w", err)
    }
    
    // 3. 验证持续时间格式
    if _, err := time.ParseDuration(rule.Duration); err != nil {
        return fmt.Errorf("持续时间格式错误: %w", err)
    }
    
    // 4. 验证严重级别
    validSeverities := []string{"critical", "warning", "info"}
    if !contains(validSeverities, rule.Severity) {
        return fmt.Errorf("严重级别必须是: %v", validSeverities)
    }
    
    // 5. 验证通知渠道存在
    for _, channel := range rule.NotifyChannels {
        if !arm.notifyChannelExists(channel) {
            return fmt.Errorf("通知渠道不存在: %s", channel)
        }
    }
    
    // 6. 验证规则名称唯一性
    if arm.ruleNameExists(rule.Name) && rule.ID == "" {
        return fmt.Errorf("告警规则名称已存在: %s", rule.Name)
    }
    
    return nil
}

// 验证PromQL表达式
func (arm *AlertRuleManager) validatePromQLExpression(expr string) error {
    // 使用Prometheus API验证表达式
    _, err := arm.prometheus.Query(context.Background(), expr, time.Now())
    return err
}
```

**备用方案：YAML文件更新**

如果热更新失败或需要批量更新，可以使用YAML文件 + 重启方式：

```yaml
# deploy/monitoring/prometheus-rules.yaml
groups:
- name: ha_alerts
  interval: 30s
  rules:
  - alert: SystemAvailabilityLow
    expr: ha_system_availability_percent < 99.9
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "系统可用性过低"
      description: "系统可用性为 {{ $value }}%，低于99.9%阈值"
  # ... 其他规则
```

```bash
# 应用YAML配置并重启Prometheus
kubectl apply -f deploy/monitoring/prometheus-rules.yaml
kubectl rollout restart deployment/prometheus -n monitoring
```

### 10.3 日志规范

**日志级别**:

- DEBUG: 详细调试信息
- INFO: 正常运行信息
- WARN: 警告信息（不影响功能）
- ERROR: 错误信息（需要关注）
- FATAL: 致命错误（服务退出）

**日志格式**:

```json
{
  "timestamp": "2026-01-31T12:00:00Z",
  "level": "INFO",
  "service": "ha-manager",
  "component": "cluster",
  "message": "节点故障转移完成",
  "failed_node": "node-1",
  "target_node": "node-2",
  "duration_ms": 25000,
  "trace_id": "abc123",
  "region": "region-a"
}
```

### 10.4 运维操作

**常见运维任务**:

1. **手动触发故障转移**:
```bash
curl -X POST http://ha-manager:8080/api/v1/ha/failover \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_node":"node-1","reason":"planned_maintenance"}'
```

2. **查看集群状态**:
```bash
curl http://ha-manager:8080/api/v1/ha/cluster/status \
  -H "Authorization: Bearer $TOKEN"
```

3. **执行滚动升级**:
```bash
kubectl set image deployment/api-server \
  api-server=log-management/api-server:v1.1 \
  -n log-management-region-a
```

4. **查看升级状态**:
```bash
kubectl rollout status deployment/api-server -n log-management-region-a
```

5. **执行灾难恢复演练**:
```bash
curl -X POST http://dr-manager:8080/api/v1/dr/drill \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"plan_id":"plan-datacenter-failure"}'
```

6. **查看复制延迟**:
```bash
curl http://ha-manager:8080/api/v1/ha/replication/lag \
  -H "Authorization: Bearer $TOKEN"
```

7. **验证备份**:
```bash
curl -X POST http://dr-manager:8080/api/v1/dr/backup/validate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"backup_id":"backup-20260131"}'
```

8. **优雅关闭节点**:
```bash
curl -X POST http://ha-manager:8080/api/v1/ha/nodes/node-1/shutdown \
  -H "Authorization: Bearer $TOKEN"
```

9. **查看演练报告**:
```bash
curl http://dr-manager:8080/api/v1/dr/drill/drill-20260131 \
  -H "Authorization: Bearer $TOKEN"
```

10. **配置健康检查**:
```bash
curl -X PUT http://ha-manager:8080/api/v1/ha/health/config \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"interval":10,"timeout":5,"failure_threshold":3}'
```

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

```
┌─────────────────────────────────────────────────────────────┐
│  基础设施层 (Kubernetes + 多区域部署)                        │
│  ❌ 不支持热更新，需要 kubectl apply + 滚动重启              │
│  - StatefulSet配置、跨区域网络配置、资源限制                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  连接层 (基础服务连接)                                       │
│  ⚠️ 不推荐热更新，建议通过YAML文件更新并重启服务             │
│  - PostgreSQL连接、Redis连接、跨区域复制连接                │
│  原因：需要重建连接池，可能导致高可用服务中断                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  应用层 (业务配置)                                           │
│  ✅ 推荐热更新，通过Redis Pub/Sub立即生效                    │
│  - 健康检查配置、故障转移配置、告警阈值、监控配置            │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| **高可用配置** |
| ha_enabled | bool | true | 是否启用高可用 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| health_check_interval | int | 10 | 健康检查间隔(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| health_check_timeout | int | 5 | 健康检查超时(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| failover_timeout | int | 30 | 故障转移超时(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| max_replication_lag | int | 5 | 最大复制延迟(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| local_buffer_size | int | 1073741824 | 本地缓冲大小(字节) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| graceful_shutdown_timeout | int | 30 | 优雅关闭超时(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **灾难恢复配置** |
| dr_enabled | bool | true | 是否启用灾难恢复 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| rpo_minutes | int | 1 | 恢复点目标(分钟) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| rto_minutes | int | 30 | 恢复时间目标(分钟) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| drill_interval_days | int | 30 | 演练间隔(天) | Redis Pub/Sub | 下次调度 | ✅ 推荐 |
| validation_interval_hours | int | 24 | 验证间隔(小时) | Redis Pub/Sub | 下次调度 | ✅ 推荐 |
| retention_years | int | 7 | 审计日志保留年限 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| auto_failover_enabled | bool | true | 是否启用自动故障转移 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| failover_timeout_minutes | int | 5 | 故障转移超时(分钟) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **告警配置** |
| system_availability_threshold | float | 99.9 | 系统可用性告警阈值(%) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| health_check_failure_threshold | float | 0.1 | 健康检查失败率阈值 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| replication_lag_threshold | int | 10 | 复制延迟告警阈值(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| rto_threshold | int | 1800 | RTO告警阈值(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| rpo_threshold | int | 60 | RPO告警阈值(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| backup_validation_threshold | float | 99.0 | 备份验证成功率阈值(%) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| enabled_alert_rules | array | ["all"] | 启用的告警规则列表 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **监控配置** |
| scrape_interval | int | 15 | Prometheus抓取间隔(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| evaluation_interval | int | 30 | 告警评估间隔(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| retention_days | int | 30 | 监控数据保留天数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| log_level | string | "info" | 日志级别 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **集群配置(不推荐热更新)** |
| min_nodes | int | 3 | 最小节点数 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| max_nodes | int | 10 | 最大节点数 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| replication_factor | int | 3 | 数据副本数 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| replication_enabled | bool | true | 是否启用跨区域复制 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| target_regions | array | ["region-b"] | 目标复制区域 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| backup_regions | array | ["region-b","region-c"] | 备份区域列表 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| **连接配置(不推荐热更新)** |
| postgresql_host | string | "postgres" | PostgreSQL主机 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| postgresql_port | int | 5432 | PostgreSQL端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |

**不推荐热更新的原因说明**:

1. **集群节点配置** (min_nodes, max_nodes):
   - 需要重新调整集群拓扑
   - 可能触发节点的增加或减少
   - 建议：通过Kubernetes HPA或手动扩缩容

2. **复制配置** (replication_factor, replication_enabled, target_regions):
   - 需要重建跨区域复制连接
   - 需要重新分配数据副本
   - 可能导致大量数据传输
   - 建议：通过YAML文件更新并滚动重启

3. **备份区域配置** (backup_regions):
   - 需要重新建立跨区域备份通道
   - 涉及网络配置变更
   - 建议：通过YAML文件更新并滚动重启

4. **数据库连接配置**:
   - 需要重建数据库连接池
   - 可能导致正在进行的高可用操作失败
   - 建议：通过YAML文件更新并滚动重启

**备用更新方式**:
- 如果Redis不可用，支持通过YAML配置文件更新，需要重启服务
- 配置文件路径: `/etc/ha-manager/config.yaml`
- 重启命令: `kubectl rollout restart deployment/ha-service`

### 11.2 热更新实现

**配置中心架构**:

```
PostgreSQL (配置源) → Redis (配置分发) → Pub/Sub (变更通知) → 服务实例
```

**热更新流程**:

```go
// 高可用配置管理器
type HAConfigManager struct {
    db       *sql.DB
    redis    *redis.Client
    config   atomic.Value  // 存储*HAConfig
    pubsub   *redis.PubSub
    stopCh   chan struct{}
}

// 高可用配置结构
type HAConfig struct {
    Version              int64     `json:"version"`
    UpdatedAt            time.Time `json:"updated_at"`
    Enabled              bool      `json:"enabled"`
    MinNodes             int       `json:"min_nodes"`
    MaxNodes             int       `json:"max_nodes"`
    HealthCheckInterval  int       `json:"health_check_interval"`
    HealthCheckTimeout   int       `json:"health_check_timeout"`
    FailoverTimeout      int       `json:"failover_timeout"`
    ReplicationFactor    int       `json:"replication_factor"`
    ReplicationEnabled   bool      `json:"replication_enabled"`
    TargetRegions        []string  `json:"target_regions"`
    MaxReplicationLag    int       `json:"max_replication_lag"`
    LocalBufferSize      int64     `json:"local_buffer_size"`
    GracefulShutdownTimeout int    `json:"graceful_shutdown_timeout"`
}

// 启动配置管理器
func (cm *HAConfigManager) Start() error {
    // 1. 从PostgreSQL加载初始配置
    config, err := cm.loadConfigFromDB()
    if err != nil {
        return fmt.Errorf("加载初始配置失败: %w", err)
    }
    cm.config.Store(config)
    
    // 2. 同步到Redis
    if err := cm.syncToRedis(config); err != nil {
        log.Warn("同步配置到Redis失败", err)
    }
    
    // 3. 订阅配置变更通知
    cm.pubsub = cm.redis.Subscribe("config:module9:ha:reload")
    
    // 4. 启动配置监听协程
    go cm.watchConfigChanges()
    
    log.Info("配置管理器已启动")
    return nil
}

// 监听配置变更
func (cm *HAConfigManager) watchConfigChanges() {
    for {
        select {
        case msg := <-cm.pubsub.Channel():
            log.Infof("收到配置变更通知: %s", msg.Payload)
            
            // 从Redis加载新配置
            newConfig, err := cm.loadConfigFromRedis()
            if err != nil {
                log.Error("加载新配置失败", err)
                continue
            }
            
            // 验证配置
            if err := cm.validateConfig(newConfig); err != nil {
                log.Error("配置验证失败", err)
                continue
            }
            
            // 原子更新配置
            oldConfig := cm.config.Load().(*HAConfig)
            cm.config.Store(newConfig)
            
            // 应用配置变更
            cm.applyConfigChanges(oldConfig, newConfig)
            
            log.Infof("配置已更新: version=%d", newConfig.Version)
            
        case <-cm.stopCh:
            return
        }
    }
}

// 从PostgreSQL加载配置
func (cm *HAConfigManager) loadConfigFromDB() (*HAConfig, error) {
    var config HAConfig
    
    query := `
        SELECT version, updated_at, enabled, min_nodes, max_nodes,
               health_check_interval, health_check_timeout, failover_timeout,
               replication_factor, replication_enabled, target_regions,
               max_replication_lag, local_buffer_size, graceful_shutdown_timeout
        FROM ha_config
        WHERE id = 'default'
    `
    
    var targetRegionsJSON []byte
    err := cm.db.QueryRow(query).Scan(
        &config.Version,
        &config.UpdatedAt,
        &config.Enabled,
        &config.MinNodes,
        &config.MaxNodes,
        &config.HealthCheckInterval,
        &config.HealthCheckTimeout,
        &config.FailoverTimeout,
        &config.ReplicationFactor,
        &config.ReplicationEnabled,
        &targetRegionsJSON,
        &config.MaxReplicationLag,
        &config.LocalBufferSize,
        &config.GracefulShutdownTimeout,
    )
    
    if err != nil {
        return nil, err
    }
    
    // 解析JSON数组
    if err := json.Unmarshal(targetRegionsJSON, &config.TargetRegions); err != nil {
        return nil, err
    }
    
    return &config, nil
}

// 同步配置到Redis
func (cm *HAConfigManager) syncToRedis(config *HAConfig) error {
    data, err := json.Marshal(config)
    if err != nil {
        return err
    }
    
    // 存储到Redis
    key := "config:module9:ha"
    if err := cm.redis.Set(key, data, 0).Err(); err != nil {
        return err
    }
    
    return nil
}

// 从Redis加载配置
func (cm *HAConfigManager) loadConfigFromRedis() (*HAConfig, error) {
    key := "config:module9:ha"
    
    data, err := cm.redis.Get(key).Bytes()
    if err != nil {
        return nil, err
    }
    
    var config HAConfig
    if err := json.Unmarshal(data, &config); err != nil {
        return nil, err
    }
    
    return &config, nil
}

// 验证配置
func (cm *HAConfigManager) validateConfig(config *HAConfig) error {
    // 验证节点数配置
    if config.MinNodes > config.MaxNodes {
        return fmt.Errorf("min_nodes (%d) 不能大于 max_nodes (%d)", 
            config.MinNodes, config.MaxNodes)
    }
    
    if config.MinNodes < 1 {
        return fmt.Errorf("min_nodes 必须至少为 1")
    }
    
    // 验证健康检查配置
    if config.HealthCheckInterval < 1 {
        return fmt.Errorf("health_check_interval 必须至少为 1 秒")
    }
    
    if config.HealthCheckTimeout >= config.HealthCheckInterval {
        return fmt.Errorf("health_check_timeout 必须小于 health_check_interval")
    }
    
    // 验证复制因子
    if config.ReplicationFactor < 1 || config.ReplicationFactor > 5 {
        return fmt.Errorf("replication_factor 必须在 1-5 之间")
    }
    
    // 验证目标区域
    if config.ReplicationEnabled && len(config.TargetRegions) == 0 {
        return fmt.Errorf("启用复制时必须指定至少一个目标区域")
    }
    
    return nil
}

// 应用配置变更
func (cm *HAConfigManager) applyConfigChanges(oldConfig, newConfig *HAConfig) {
    // 1. 健康检查间隔变更
    if oldConfig.HealthCheckInterval != newConfig.HealthCheckInterval {
        log.Infof("健康检查间隔变更: %d -> %d 秒", 
            oldConfig.HealthCheckInterval, newConfig.HealthCheckInterval)
        cm.updateHealthCheckInterval(newConfig.HealthCheckInterval)
    }
    
    // 2. 故障转移超时变更
    if oldConfig.FailoverTimeout != newConfig.FailoverTimeout {
        log.Infof("故障转移超时变更: %d -> %d 秒", 
            oldConfig.FailoverTimeout, newConfig.FailoverTimeout)
        cm.updateFailoverTimeout(newConfig.FailoverTimeout)
    }
    
    // 3. 复制配置变更
    if oldConfig.ReplicationEnabled != newConfig.ReplicationEnabled {
        log.Infof("复制状态变更: %v -> %v", 
            oldConfig.ReplicationEnabled, newConfig.ReplicationEnabled)
        if newConfig.ReplicationEnabled {
            cm.enableReplication(newConfig.TargetRegions)
        } else {
            cm.disableReplication()
        }
    }
    
    // 4. 目标区域变更
    if !reflect.DeepEqual(oldConfig.TargetRegions, newConfig.TargetRegions) {
        log.Infof("目标区域变更: %v -> %v", 
            oldConfig.TargetRegions, newConfig.TargetRegions)
        cm.updateTargetRegions(newConfig.TargetRegions)
    }
    
    // 5. 记录配置变更审计日志
    cm.auditConfigChange(oldConfig, newConfig)
}

// 获取当前配置
func (cm *HAConfigManager) GetConfig() *HAConfig {
    return cm.config.Load().(*HAConfig)
}

// 更新配置（通过API）
func (cm *HAConfigManager) UpdateConfig(ctx context.Context, updates map[string]interface{}) error {
    // 1. 加载当前配置
    currentConfig := cm.GetConfig()
    
    // 2. 应用更新
    newConfig := *currentConfig
    newConfig.Version++
    newConfig.UpdatedAt = time.Now()
    
    for key, value := range updates {
        switch key {
        case "enabled":
            newConfig.Enabled = value.(bool)
        case "min_nodes":
            newConfig.MinNodes = int(value.(float64))
        case "max_nodes":
            newConfig.MaxNodes = int(value.(float64))
        case "health_check_interval":
            newConfig.HealthCheckInterval = int(value.(float64))
        case "failover_timeout":
            newConfig.FailoverTimeout = int(value.(float64))
        case "replication_enabled":
            newConfig.ReplicationEnabled = value.(bool)
        case "target_regions":
            newConfig.TargetRegions = value.([]string)
        // ... 其他配置项
        }
    }
    
    // 3. 验证新配置
    if err := cm.validateConfig(&newConfig); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 4. 保存到PostgreSQL
    if err := cm.saveConfigToDB(&newConfig); err != nil {
        return fmt.Errorf("保存配置失败: %w", err)
    }
    
    // 5. 同步到Redis
    if err := cm.syncToRedis(&newConfig); err != nil {
        return fmt.Errorf("同步配置失败: %w", err)
    }
    
    // 6. 发布配置变更通知
    cm.redis.Publish("config:module9:ha:reload", newConfig.Version)
    
    log.Infof("配置已更新并发布: version=%d", newConfig.Version)
    return nil
}
```

### 11.3 配置变更验收标准

**验收测试用例**:

```go
// 测试配置热更新
func TestConfigHotReload(t *testing.T) {
    // 1. 更新健康检查间隔
    updates := map[string]interface{}{
        "health_check_interval": 15,
    }
    
    err := configManager.UpdateConfig(context.Background(), updates)
    assert.NoError(t, err)
    
    // 2. 等待配置生效（最多10秒）
    time.Sleep(10 * time.Second)
    
    // 3. 验证新配置已生效
    config := configManager.GetConfig()
    assert.Equal(t, 15, config.HealthCheckInterval)
    
    // 4. 验证健康检查器使用了新间隔
    // （通过监控指标验证）
}

// 测试告警规则热更新
func TestAlertRuleHotReload(t *testing.T) {
    // 1. 更新告警阈值
    updates := map[string]interface{}{
        "threshold": 15.0,
        "duration":  "10m",
    }
    
    err := alertRuleManager.UpdateRule(context.Background(), "ReplicationLagHigh", updates)
    assert.NoError(t, err)
    
    // 2. 等待规则生效（最多10秒）
    time.Sleep(10 * time.Second)
    
    // 3. 验证Prometheus已应用新规则
    rules := alertRuleManager.GetRules()
    for _, rule := range rules {
        if rule.Name == "ReplicationLagHigh" {
            assert.Equal(t, 15.0, rule.Threshold)
            assert.Equal(t, "10m", rule.Duration)
        }
    }
}

// 测试配置验证
func TestConfigValidation(t *testing.T) {
    // 测试无效配置：min_nodes > max_nodes
    updates := map[string]interface{}{
        "min_nodes": 10,
        "max_nodes": 5,
    }
    
    err := configManager.UpdateConfig(context.Background(), updates)
    assert.Error(t, err)
    assert.Contains(t, err.Error(), "min_nodes")
}

// 测试监控配置热更新
func TestMonitoringConfigHotReload(t *testing.T) {
    // 1. 更新抓取间隔
    updates := map[string]interface{}{
        "scrape_interval": 30,
    }
    
    err := monitoringConfigManager.UpdateConfig(context.Background(), updates)
    assert.NoError(t, err)
    
    // 2. 验证Prometheus配置已更新
    time.Sleep(10 * time.Second)
    config := monitoringConfigManager.GetConfig()
    assert.Equal(t, 30, config.ScrapeInterval)
}
```

**热更新优先级**:

1. **优先使用热更新**（推荐）:
   - 配置变更通过API立即生效
   - 无需重启服务
   - 支持配置验证和自动回滚
   - 记录完整的变更审计日志

2. **备用方案：YAML文件 + 重启**:
   - 仅在热更新失败时使用
   - 适用于批量配置变更
   - 需要重启相关服务
   - 适用于初始化部署

**热更新支持的操作**:

| 操作类型 | 热更新支持 | 备用方案 |
|---------|-----------|---------|
| 高可用配置变更 | ✅ 是 | YAML + 重启 |
| 灾难恢复配置变更 | ✅ 是 | YAML + 重启 |
| 告警规则变更 | ✅ 是 | YAML + 重启 |
| 告警阈值调整 | ✅ 是 | YAML + 重启 |
| 监控配置变更 | ✅ 是 | YAML + 重启 |
| 日志级别调整 | ✅ 是 | YAML + 重启 |
| 资源限制调整 | ❌ 否 | YAML + 滚动重启 |
| 镜像版本升级 | ❌ 否 | YAML + 滚动升级 |

### 11.4 配置回滚机制

```go
// 配置回滚
func (cm *HAConfigManager) RollbackConfig(ctx context.Context, targetVersion int64) error {
    // 1. 从历史记录加载目标版本配置
    config, err := cm.loadConfigVersion(targetVersion)
    if err != nil {
        return fmt.Errorf("加载历史配置失败: %w", err)
    }
    
    // 2. 验证配置
    if err := cm.validateConfig(config); err != nil {
        return fmt.Errorf("历史配置验证失败: %w", err)
    }
    
    // 3. 更新版本号
    config.Version = cm.GetConfig().Version + 1
    config.UpdatedAt = time.Now()
    
    // 4. 保存并发布
    if err := cm.saveConfigToDB(config); err != nil {
        return err
    }
    
    if err := cm.syncToRedis(config); err != nil {
        return err
    }
    
    cm.redis.Publish("config:module9:ha:reload", config.Version)
    
    log.Infof("配置已回滚到版本: %d", targetVersion)
    return nil
}
```

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 节点故障导致服务中断 | 中 | 高 | 多副本部署+自动故障转移 |
| 区域故障导致数据丢失 | 低 | 极高 | 跨区域复制+定期备份 |
| 故障转移失败 | 低 | 高 | 多级健康检查+手动故障转移 |
| 复制延迟过高 | 中 | 中 | 监控告警+带宽优化 |
| 配置错误导致系统异常 | 中 | 高 | 配置验证+自动回滚 |
| 备份数据损坏 | 低 | 高 | 定期验证+多副本备份 |
| 演练影响生产环境 | 低 | 中 | 隔离测试环境+只读验证 |
| 网络分区导致脑裂 | 低 | 极高 | Quorum机制+Fencing |
| 升级失败导致服务不可用 | 中 | 高 | 滚动升级+自动回滚 |
| 审计日志丢失 | 低 | 高 | 多副本存储+定期归档 |

### 12.2 配置回滚

**回滚触发条件**:

1. 配置验证失败
2. 应用配置后系统异常
3. 监控指标异常（可用性下降、错误率上升）
4. 手动触发回滚

**自动回滚机制**:

```go
// 配置回滚管理器
type ConfigRollbackManager struct {
    configManager *HAConfigManager
    monitor       *HealthMonitor
    history       *ConfigHistory
}

// 监控配置变更后的系统健康状态
func (rm *ConfigRollbackManager) MonitorAfterConfigChange(configVersion int64) {
    // 等待配置生效
    time.Sleep(10 * time.Second)
    
    // 监控5分钟
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    
    startTime := time.Now()
    for {
        select {
        case <-ticker.C:
            // 检查系统健康状态
            if !rm.monitor.IsHealthy() {
                log.Errorf("配置变更后系统异常，触发自动回滚")
                
                // 获取上一个版本
                prevVersion := configVersion - 1
                if err := rm.configManager.RollbackConfig(context.Background(), prevVersion); err != nil {
                    log.Errorf("自动回滚失败: %v", err)
                    rm.sendCriticalAlert("配置回滚失败")
                } else {
                    log.Infof("已自动回滚到版本: %d", prevVersion)
                    rm.sendAlert("配置已自动回滚")
                }
                return
            }
            
            // 监控5分钟后结束
            if time.Since(startTime) > 5*time.Minute {
                log.Info("配置变更后系统运行正常")
                return
            }
        }
    }
}

// 手动回滚配置
func (rm *ConfigRollbackManager) ManualRollback(ctx context.Context, targetVersion int64) error {
    log.Infof("手动回滚配置到版本: %d", targetVersion)
    
    // 1. 验证目标版本存在
    if !rm.history.VersionExists(targetVersion) {
        return fmt.Errorf("版本 %d 不存在", targetVersion)
    }
    
    // 2. 执行回滚
    if err := rm.configManager.RollbackConfig(ctx, targetVersion); err != nil {
        return fmt.Errorf("回滚失败: %w", err)
    }
    
    // 3. 记录回滚事件
    rm.auditRollback(targetVersion)
    
    return nil
}
```

### 12.3 数据回滚

**数据回滚场景**:

1. 数据损坏或不一致
2. 误操作导致数据丢失
3. 灾难恢复失败
4. 升级后数据异常

**数据回滚流程**:

```go
// 数据回滚管理器
type DataRollbackManager struct {
    backupManager *BackupManager
    validator     *DataValidator
}

// 执行数据回滚
func (drm *DataRollbackManager) RollbackData(ctx context.Context, backupID string) error {
    log.Infof("开始数据回滚: backup_id=%s", backupID)
    
    // 1. 验证备份可用性
    backup, err := drm.backupManager.GetBackup(backupID)
    if err != nil {
        return fmt.Errorf("获取备份失败: %w", err)
    }
    
    if !drm.validator.ValidateBackup(backup) {
        return fmt.Errorf("备份验证失败")
    }
    
    // 2. 停止写入操作
    if err := drm.stopWrites(); err != nil {
        return fmt.Errorf("停止写入失败: %w", err)
    }
    defer drm.resumeWrites()
    
    // 3. 创建当前数据快照（以防回滚失败）
    snapshotID, err := drm.createSnapshot()
    if err != nil {
        log.Errorf("创建快照失败: %v", err)
    }
    
    // 4. 执行数据恢复
    if err := drm.restoreFromBackup(ctx, backup); err != nil {
        log.Errorf("数据恢复失败: %v", err)
        
        // 尝试恢复到快照
        if snapshotID != "" {
            drm.restoreFromSnapshot(ctx, snapshotID)
        }
        
        return fmt.Errorf("数据回滚失败: %w", err)
    }
    
    // 5. 验证数据完整性
    if !drm.validator.ValidateData() {
        return fmt.Errorf("数据验证失败")
    }
    
    // 6. 记录回滚事件
    drm.auditDataRollback(backupID)
    
    log.Infof("数据回滚完成: backup_id=%s", backupID)
    return nil
}
```

### 12.4 应急预案

**应急响应流程**:

```
1. 故障检测与告警
2. 评估影响范围和严重程度
3. 启动应急响应团队
4. 执行应急措施：
   - 轻微故障：自动故障转移
   - 中等故障：手动故障转移+数据验证
   - 严重故障：启动灾难恢复流程
5. 恢复服务
6. 验证系统功能
7. 事后分析和改进
```

**应急联系人**:

| 角色 | 姓名 | 联系方式 | 职责 |
|------|------|----------|------|
| 应急响应负责人 | - | - | 统筹应急响应 |
| 系统架构师 | - | - | 技术决策 |
| 运维工程师 | - | - | 执行恢复操作 |
| DBA | - | - | 数据库恢复 |
| 网络工程师 | - | - | 网络问题排查 |

**应急操作手册**:

```bash
# 1. 快速诊断
./scripts/diagnose.sh

# 2. 查看集群状态
kubectl get pods -n log-management-region-a
curl http://ha-manager:8080/api/v1/ha/cluster/status

# 3. 手动故障转移
curl -X POST http://ha-manager:8080/api/v1/ha/failover \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"target_node":"node-1","reason":"emergency"}'

# 4. 切换到备用区域
./scripts/switch-to-standby-region.sh region-b

# 5. 执行灾难恢复
curl -X POST http://dr-manager:8080/api/v1/dr/recovery \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"scenario":"datacenter_failure","mode":"full"}'

# 6. 数据回滚
curl -X POST http://dr-manager:8080/api/v1/dr/recovery/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"backup_id":"backup-20260131"}'

# 7. 配置回滚
curl -X POST http://ha-manager:8080/api/v1/ha/config/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"version":123}'
```

### 12.5 事后分析

**事后分析流程**:

1. 收集故障数据（日志、监控指标、告警记录）
2. 时间线重建
3. 根因分析（5 Why分析法）
4. 影响评估
5. 改进措施制定
6. 文档更新
7. 知识分享

**事后分析报告模板**:

```markdown
# 故障事后分析报告

## 基本信息
- 故障时间: 2026-01-31 10:00:00 - 10:30:00
- 故障时长: 30分钟
- 影响范围: 区域A所有服务
- 严重程度: P1（严重）

## 故障描述
[详细描述故障现象]

## 时间线
- 10:00:00 - 检测到节点node-1心跳超时
- 10:00:30 - 自动故障转移启动
- 10:01:00 - 故障转移失败
- 10:05:00 - 手动触发区域故障转移
- 10:30:00 - 服务恢复正常

## 根因分析
[使用5 Why分析法找出根本原因]

## 影响评估
- 受影响用户数: 1000
- 数据丢失: 无
- 财务损失: 估算

## 改进措施
1. 短期措施（1周内）
2. 中期措施（1月内）
3. 长期措施（3月内）

## 经验教训
[总结经验教训]
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| HA | High Availability，高可用性 |
| DR | Disaster Recovery，灾难恢复 |
| RTO | Recovery Time Objective，恢复时间目标 |
| RPO | Recovery Point Objective，恢复点目标 |
| Failover | 故障转移，从故障节点切换到健康节点 |
| Master | 主节点，负责协调和管理的节点 |
| Replica | 副本节点，主节点的备份 |
| Standby | 备用节点，热备或冷备节点 |
| CCR | Cross-Cluster Replication，跨集群复制 |
| MirrorMaker | Kafka的跨集群复制工具 |
| Streaming Replication | PostgreSQL的流复制 |
| Quorum | 法定人数，分布式系统中的多数派 |
| Split-Brain | 脑裂，网络分区导致多个Master |
| Fencing | 隔离机制，防止脑裂 |
| HPA | Horizontal Pod Autoscaler，水平Pod自动扩缩容 |
| PDB | Pod Disruption Budget，Pod中断预算 |
| etcd | 分布式键值存储，用于服务发现和配置管理 |
| Prometheus | 开源监控系统 |
| Alertmanager | Prometheus的告警管理组件 |
| Grafana | 可视化监控仪表盘 |

### 13.2 参考文档

**官方文档**:

- [Kubernetes官方文档](https://kubernetes.io/docs/)
- [Kafka官方文档](https://kafka.apache.org/documentation/)
- [Elasticsearch官方文档](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [PostgreSQL官方文档](https://www.postgresql.org/docs/)
- [Redis官方文档](https://redis.io/documentation)
- [Prometheus官方文档](https://prometheus.io/docs/)
- [etcd官方文档](https://etcd.io/docs/)

**技术规范**:

- [Raft共识算法](https://raft.github.io/)
- [CAP定理](https://en.wikipedia.org/wiki/CAP_theorem)
- [两阶段提交协议](https://en.wikipedia.org/wiki/Two-phase_commit_protocol)
- [Paxos算法](https://en.wikipedia.org/wiki/Paxos_(computer_science))

**最佳实践**:

- [Google SRE Book](https://sre.google/books/)
- [The Twelve-Factor App](https://12factor.net/)
- [Kubernetes生产最佳实践](https://kubernetes.io/docs/setup/best-practices/)
- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)

**相关设计文档**:

- [模块1设计文档](./design-module1.md) - 日志采集
- [模块2设计文档](./design-module2.md) - 日志存储
- [模块3设计文档](./design-module3.md) - 日志查询
- [模块8设计文档](./design-module8.md) - 合规与审计
- [项目总体设计](./project-design-overview.md)
- [API设计文档](./api-design.md)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| - | - | - | - |

### 13.4 审批记录

| 审批人 | 角色 | 审批日期 | 审批结果 | 意见 |
|--------|------|----------|----------|------|
| 技术委员会 | 架构评审 | 2026-01-31 | 通过 | 设计合理，可以实施 |
| - | - | - | - | - |

### 13.5 附件清单

1. **部署脚本**:
   - `deploy/kubernetes/ha-deployment.yaml` - 高可用部署配置
   - `deploy/kubernetes/dr-deployment.yaml` - 灾难恢复部署配置
   - `scripts/failover.sh` - 故障转移脚本
   - `scripts/recovery.sh` - 灾难恢复脚本

2. **配置文件**:
   - `configs/ha-config.yaml` - 高可用配置
   - `configs/dr-config.yaml` - 灾难恢复配置
   - `configs/replication-config.yaml` - 跨区域复制配置

3. **监控配置**:
   - `deploy/monitoring/prometheus-rules.yaml` - Prometheus告警规则
   - `deploy/monitoring/grafana-dashboards/ha-dashboard.json` - 高可用仪表盘
   - `deploy/monitoring/grafana-dashboards/dr-dashboard.json` - 灾难恢复仪表盘

4. **测试用例**:
   - `tests/ha/failover_test.go` - 故障转移测试
   - `tests/ha/replication_test.go` - 跨区域复制测试
   - `tests/dr/recovery_test.go` - 灾难恢复测试
   - `tests/dr/drill_test.go` - 演练测试

5. **运维手册**:
   - `docs/ha-operations.md` - 高可用运维手册
   - `docs/dr-operations.md` - 灾难恢复运维手册
   - `docs/emergency-response.md` - 应急响应手册

### 13.6 FAQ

**Q1: 如何判断系统是否达到99.99%可用性？**

A: 通过Prometheus监控指标`ha_system_availability_percent`计算，公式为：
```
可用性 = (总时间 - 故障时间) / 总时间 × 100%
99.99% = 年度故障时间 < 52.56分钟
```

**Q2: 故障转移为什么需要30秒？**

A: 故障转移时间包括：
- 故障检测：10秒（3次健康检查失败）
- Master选举：5秒
- 流量切换：10秒
- 验证：5秒

**Q3: 跨区域复制延迟如何优化？**

A: 优化措施：
- 使用专线或VPN提高网络质量
- 启用压缩减少传输量
- 增加并行复制任务数
- 优化批量大小和延迟参数

**Q4: 如何验证灾难恢复计划的有效性？**

A: 通过定期演练验证：
- 每月自动执行演练
- 覆盖5种灾难场景
- 验证RTO/RPO是否达标
- 检查数据完整性
- 生成演练报告

**Q5: 配置热更新会影响服务吗？**

A: 不会，配置热更新采用原子操作：
- 使用`atomic.Value`保证并发安全
- 配置验证失败时保持原配置
- 变更通过Pub/Sub异步通知
- 10秒内生效，无需重启服务

**Q6: 如何处理网络分区导致的脑裂？**

A: 使用Quorum机制和Fencing：
- etcd使用Raft算法，要求多数派同意
- Kubernetes使用Leader Election
- PostgreSQL使用同步复制和Fencing
- 监控网络分区并及时告警

**Q7: 备份数据如何保证安全？**

A: 多层安全措施：
- AES-256-GCM加密存储
- 多区域多副本
- 定期验证备份可恢复性
- 访问控制和审计日志
- 7年保留期满足合规要求

**Q8: 如何回滚失败的升级？**

A: Kubernetes自动回滚机制：
- 设置`progressDeadlineSeconds`
- 健康检查失败时自动回滚
- 也可手动执行：`kubectl rollout undo deployment/api-server`

**Q9: 如何创建自定义告警规则？**

A: 通过API创建自定义告警：
```bash
curl -X POST http://ha-manager:8080/api/v1/ha/alert-rules \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "CustomNodeCPUHigh",
    "expression": "ha_node_cpu_usage > threshold",
    "threshold": 80,
    "duration": "5m",
    "severity": "warning",
    "notify_channels": ["email-ops"]
  }'
```
也可以从模板创建，或通过Web UI配置。

**Q10: 自定义告警支持哪些通知渠道？**

A: 支持多种通知渠道：
- Email（邮件）
- Slack（即时通讯）
- Webhook（自定义HTTP回调）
- SMS（短信）
- DingTalk（钉钉）
- 可以为每个告警规则配置多个通知渠道

**Q11: 如何测试告警规则是否正确？**

A: 使用测试接口验证：
```bash
curl -X POST http://ha-manager:8080/api/v1/ha/alert-rules/CustomNodeCPUHigh/test \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"test_data": {"node": "node-1", "value": 85}}'
```
系统会模拟告警触发，但不会实际发送通知。

**Q12: 告警规则可以回滚吗？**

A: 可以，系统记录所有变更历史：
- 查看历史版本：`GET /api/v1/ha/alert-rules/{id}/history`
- 回滚到指定版本：`POST /api/v1/ha/alert-rules/{id}/rollback`
- 每次变更都有审计日志

**Q13: 如何批量管理告警规则？**

A: 支持批量操作：
- 导出规则：`GET /api/v1/ha/alert-rules/export?format=yaml`
- 导入规则：`POST /api/v1/ha/alert-rules/import`
- 批量更新：`PUT /api/v1/ha/alert-rules/batch`
- 适用于环境迁移和备份恢复

---

**文档结束**


---
