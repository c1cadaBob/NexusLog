# API 接口设计文档

> **文档版本**：v1.0  
> **作者**：系统架构团队  
> **评审人**：技术委员会  
> **更新日期**：2026-01-30  
> **状态**：已发布

---

## 1. 变更记录

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-30 | 系统架构团队 | 初稿，包含16个模块共689个API接口 |
| v1.1 | 2026-01-31 | 系统架构团队 | 新增模块17-25，共增加25个API接口，总计714个接口 |

---

## 2. 背景与目标

**背景：**

本文档为企业级日志管理系统的完整API接口设计文档，涵盖日志采集、存储、分析、告警、可视化、安全、性能优化等全方位功能。系统采用微服务架构，支持高并发、高可用、可扩展的日志处理能力。

**目标：**

- 提供统一、规范的API接口设计标准
- 支持RESTful风格的API设计
- 确保接口的安全性、稳定性和可维护性
- 支持多租户、跨云、容器化等企业级特性
- 提供完整的接口文档，便于前后端协作和第三方集成

**非目标：**

- 不包含内部服务间的RPC接口
- 不包含数据库设计细节
- 不包含具体的实现代码

---

## 3. 总体设计

### 3.1 接口风格

- **风格**：RESTful API
- **协议**：HTTPS
- **数据格式**：JSON
- **字符编码**：UTF-8

### 3.2 版本策略

- **版本控制**：URL路径版本控制
- **当前版本**：v1
- **版本格式**：`/api/v1/...`
- **向后兼容**：至少支持2个主版本
- **废弃通知**：提前6个月通知

### 3.3 认证方式

- **认证方式**：JWT (JSON Web Token)
- **传递方式**：HTTP Header `Authorization: Bearer <token>`
- **Token有效期**：2小时
- **刷新机制**：支持refresh token
- **权限模型**：基于RBAC的权限控制

### 3.4 通用响应结构

**成功响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {},
  "timestamp": "2026-01-30T10:00:00Z",
  "request_id": "req-123456"
}
```

**分页响应：**

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "size": 20,
    "pages": 5
  },
  "timestamp": "2026-01-30T10:00:00Z",
  "request_id": "req-123456"
}
```

**错误响应：**

```json
{
  "code": 400,
  "message": "Invalid parameter",
  "error": "field 'name' is required",
  "timestamp": "2026-01-30T10:00:00Z",
  "request_id": "req-123456"
}
```

### 3.5 错误码规范

| code | HTTP状态码 | 含义 | 解决方案 |
|------|-----------|------|----------|
| 0 | 200 | 成功 | - |
| 400 | 400 | 请求参数错误 | 检查请求参数格式和必填字段 |
| 401 | 401 | 未认证 | 重新登录获取token |
| 403 | 403 | 无权限 | 联系管理员分配权限 |
| 404 | 404 | 资源不存在 | 检查资源ID是否正确 |
| 409 | 409 | 资源冲突 | 检查资源是否已存在 |
| 422 | 422 | 业务逻辑错误 | 根据error字段提示处理 |
| 429 | 429 | 请求过于频繁 | 降低请求频率或联系管理员提升限额 |
| 500 | 500 | 服务器内部错误 | 联系技术支持 |
| 503 | 503 | 服务不可用 | 稍后重试或联系技术支持 |

### 3.6 其他说明

**幂等性策略：**
- GET、PUT、DELETE操作天然幂等
- POST操作通过业务ID或幂等键保证幂等性

**限流策略：**
- 默认限流：100 请求/分钟/用户
- 批量操作：10 请求/分钟/用户
- 查询接口：200 请求/分钟/用户
- 报告生成：5 请求/小时/用户
- 实现方式：Redis令牌桶算法

**日志与监控：**
- 记录所有API调用日志
- 监控API响应时间（P95 < 500ms, P99 < 1s）
- 监控API错误率（< 0.1%）
- 支持分布式追踪（OpenTelemetry）

**安全措施：**
- 所有接口强制HTTPS
- 敏感数据加密传输
- SQL注入防护
- XSS防护
- CSRF防护
- 请求参数严格验证

---

## 4. 接口清单

### 4.1 模块概览

| 模块编号 | 模块名称 | 接口数量 | 接口编号范围 |
|---------|---------|---------|-------------|
| 模块1 | 日志采集 | 31 | API-1-01 ~ API-1-31 |
| 模块2 | 日志存储 | 34 | API-2-32 ~ API-2-65 |
| 模块3 | 日志查询与检索 | 36 | API-3-66 ~ API-3-101 |
| 模块4 | 日志分析 | 53 | API-4-102 ~ API-4-154 |
| 模块5 | 告警与通知 | 35 | API-5-155 ~ API-5-189 |
| 模块6 | 可视化与报表 | 47 | API-6-190 ~ API-6-236 |
| 模块7 | 用户与权限管理 | 42 | API-7-237 ~ API-7-278 |
| 模块8 | 系统配置与管理 | 41 | API-8-279 ~ API-8-319 |
| 模块9 | 日志安全 | 33 | API-9-320 ~ API-9-352 |
| 模块10 | 性能优化 | 39 | API-10-353 ~ API-10-391 |
| 模块11 | 集成与扩展 | 20 | API-11-392 ~ API-11-411 |
| 模块12 | 监控与运维 | 41 | API-12-412 ~ API-12-452 |
| 模块13 | 日志生命周期管理 | 17 | API-13-453 ~ API-13-469 |
| 模块14 | 高可用与容灾 | 33 | API-14-470 ~ API-14-502 |
| 模块15 | 企业级功能 | 65 | API-15-503 ~ API-15-567 |
| 模块16 | 高级功能补充 | 122 | API-16-568 ~ API-16-689 |
| 模块17 | 备份系统增强 | 12 | API-17-01 ~ API-17-12 |
| 模块18 | 真实备份集成 | 5 | API-18-01 ~ API-18-05 |
| 模块19 | 通用日志采集代理 | 8 | API-19-01 ~ API-19-08 |
| 模块20 | ML/AI 机器学习框架 | 0 | - |
| 模块21 | NLP 自然语言处理 | 0 | - |
| 模块22 | 多租户架构 | 0 | - |
| 模块23 | 边缘计算 | 0 | - |
| 模块24 | 成本管理 | 0 | - |
| 模块25 | 数据模型与系统接口 | 0 | - |
| **总计** | **25个模块** | **714个接口** | **API-1-01 ~ API-19-08** |


### 4.1 模块1：日志采集 (31个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-1-01 | 获取数据源列表 | Collector | GET | /api/v1/collector/sources | collector.read | Query: tenant_id, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-1-02 | 添加数据源 | Collector | POST | /api/v1/collector/sources | collector.write | Body: source_config | {code:0,data:{id:"src-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-03 | 更新数据源配置 | Collector | PUT | /api/v1/collector/sources/{id} | collector.write | Body: source_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-04 | 删除数据源 | Collector | DELETE | /api/v1/collector/sources/{id} | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-05 | 启用数据源 | Collector | POST | /api/v1/collector/sources/{id}/enable | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-06 | 禁用数据源 | Collector | POST | /api/v1/collector/sources/{id}/disable | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-07 | 获取优先级规则 | Collector | GET | /api/v1/collector/priority/rules | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-08 | 添加优先级规则 | Collector | POST | /api/v1/collector/priority/rules | collector.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-09 | 更新优先级规则 | Collector | PUT | /api/v1/collector/priority/rules/{id} | collector.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-10 | 删除优先级规则 | Collector | DELETE | /api/v1/collector/priority/rules/{id} | collector.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-11 | 获取优先级统计 | Collector | GET | /api/v1/collector/priority/stats | collector.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-12 | 获取处理规则 | Collector | GET | /api/v1/collector/processor/rules | collector.read | Query: type | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-13 | 添加处理规则 | Collector | POST | /api/v1/collector/processor/rules | collector.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-14 | 获取脱敏规则 | Collector | GET | /api/v1/collector/processor/masking | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-15 | 更新脱敏规则 | Collector | PUT | /api/v1/collector/processor/masking | collector.write | Body: masking_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-16 | 获取流配置 | Collector | GET | /api/v1/collector/stream/config | collector.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-17 | 更新流配置 | Collector | PUT | /api/v1/collector/stream/config | collector.write | Body: stream_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-18 | 获取流目标列表 | Collector | GET | /api/v1/collector/stream/targets | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-19 | 更新流目标配置 | Collector | PUT | /api/v1/collector/stream/targets/{name} | collector.write | Body: target_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-1-20 | 触发日志回放 | Collector | POST | /api/v1/collector/stream/replay | collector.write | Body: {start_time,end_time,filter} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-21 | 获取流指标 | Collector | GET | /api/v1/collector/stream/metrics | collector.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-22 | 获取支持的格式列表 | Collector | GET | /api/v1/collector/parser/formats | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-23 | 检测日志格式 | Collector | POST | /api/v1/collector/parser/detect | collector.read | Body: log_sample | {code:0,data:{format:"json"}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-24 | 预览解析结果 | Collector | POST | /api/v1/collector/parser/preview | collector.read | Body: {log_sample,format} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-25 | 获取自定义解析规则 | Collector | GET | /api/v1/collector/parser/rules | collector.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-1-26 | 添加自定义解析规则 | Collector | POST | /api/v1/collector/parser/rules | collector.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-1-27 | 批量格式转换 | Collector | POST | /api/v1/collector/parser/convert | collector.write | Body: {logs,target_format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回二进制数据 |
| API-1-28 | 触发配置热更新 | Collector | POST | /api/v1/collector/config/reload | collector.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-1-29 | 获取当前配置版本 | Collector | GET | /api/v1/collector/config/version | collector.read | Query: component | {code:0,data:{version:"v1.0"}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-1-30 | 健康检查 | Collector | GET | /api/v1/collector/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-1-31 | 获取采集指标 | Collector | GET | /api/v1/collector/metrics | collector.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

### 4.2 模块2：日志存储 (34个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-2-32 | 获取ILM策略列表 | Storage | GET | /api/v1/storage/ilm/policies | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-33 | 创建ILM策略 | Storage | POST | /api/v1/storage/ilm/policies | storage.write | Body: policy_config | {code:0,data:{id:"ilm-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-34 | 更新ILM策略 | Storage | PUT | /api/v1/storage/ilm/policies/{id} | storage.write | Body: policy_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-35 | 删除ILM策略 | Storage | DELETE | /api/v1/storage/ilm/policies/{id} | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-36 | 启用ILM策略 | Storage | POST | /api/v1/storage/ilm/policies/{id}/enable | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-37 | 禁用ILM策略 | Storage | POST | /api/v1/storage/ilm/policies/{id}/disable | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-38 | 获取存储层级信息 | Storage | GET | /api/v1/storage/tiers | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-39 | 获取存储层级使用率 | Storage | GET | /api/v1/storage/tiers/{tier}/usage | storage.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-40 | 获取迁移任务状态 | Storage | GET | /api/v1/storage/migration/status | storage.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-41 | 手动触发数据迁移 | Storage | POST | /api/v1/storage/migration/trigger | storage.write | Body: {tier,query} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-42 | 获取备份策略列表 | Storage | GET | /api/v1/storage/backup/policies | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-43 | 创建备份策略 | Storage | POST | /api/v1/storage/backup/policies | storage.write | Body: policy_config | {code:0,data:{id:"backup-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-44 | 更新备份策略 | Storage | PUT | /api/v1/storage/backup/policies/{id} | storage.write | Body: policy_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-45 | 删除备份策略 | Storage | DELETE | /api/v1/storage/backup/policies/{id} | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-46 | 手动执行备份 | Storage | POST | /api/v1/storage/backup/execute | storage.write | Body: {type} | {code:0,data:{backup_id:"bak-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-47 | 获取备份列表 | Storage | GET | /api/v1/storage/backup/list | storage.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-2-48 | 获取备份详情 | Storage | GET | /api/v1/storage/backup/{id} | storage.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-2-49 | 验证备份完整性 | Storage | POST | /api/v1/storage/backup/{id}/verify | storage.read | 无 | {code:0,data:{valid:true}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-50 | 恢复备份 | Storage | POST | /api/v1/storage/restore | storage.write | Body: {backup_id,target_time} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-51 | 获取恢复任务状态 | Storage | GET | /api/v1/storage/restore/status | storage.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-52 | 执行恢复演练 | Storage | POST | /api/v1/storage/restore/drill | storage.write | 无 | {code:0,data:{drill_id:"drill-1"}} | 200/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-53 | 获取生命周期策略列表 | Storage | GET | /api/v1/storage/lifecycle/policies | storage.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-2-54 | 创建生命周期策略 | Storage | POST | /api/v1/storage/lifecycle/policies | storage.write | Body: policy_config | {code:0,data:{id:"lc-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-2-55 | 更新生命周期策略 | Storage | PUT | /api/v1/storage/lifecycle/policies/{id} | storage.write | Body: policy_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-56 | 删除生命周期策略 | Storage | DELETE | /api/v1/storage/lifecycle/policies/{id} | storage.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-57 | 评估策略影响 | Storage | POST | /api/v1/storage/lifecycle/policies/{id}/evaluate | storage.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-2-58 | 执行生命周期策略 | Storage | POST | /api/v1/storage/lifecycle/policies/{id}/execute | storage.write | Body: {dry_run} | {code:0,data:{task_id:"task-1"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-2-59 | 获取策略版本历史 | Storage | GET | /api/v1/storage/lifecycle/policies/{id}/versions | storage.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-2-60 | 回滚策略版本 | Storage | POST | /api/v1/storage/lifecycle/policies/{id}/rollback | storage.write | Body: {version} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-2-61 | 获取审计日志 | Storage | GET | /api/v1/storage/lifecycle/audit | storage.read | Query: start_time, end_time | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-62 | 获取执行报告 | Storage | GET | /api/v1/storage/lifecycle/report | storage.read | Query: policy_id, time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-2-63 | 触发配置热更新 | Storage | POST | /api/v1/storage/config/reload | storage.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-2-64 | 健康检查 | Storage | GET | /api/v1/storage/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-2-65 | 获取存储指标 | Storage | GET | /api/v1/storage/metrics | storage.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

### 4.3 模块3：日志查询与检索 (36个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-3-66 | 获取分析规则列表 | Analysis | GET | /api/v1/analysis/rules | analysis.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-67 | 创建分析规则 | Analysis | POST | /api/v1/analysis/rules | analysis.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-3-68 | 更新分析规则 | Analysis | PUT | /api/v1/analysis/rules/{id} | analysis.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-69 | 删除分析规则 | Analysis | DELETE | /api/v1/analysis/rules/{id} | analysis.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-70 | 启用分析规则 | Analysis | POST | /api/v1/analysis/rules/{id}/enable | analysis.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-71 | 禁用分析规则 | Analysis | POST | /api/v1/analysis/rules/{id}/disable | analysis.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-72 | 获取流处理状态 | Analysis | GET | /api/v1/analysis/stream/status | analysis.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-73 | 获取聚合统计 | Analysis | GET | /api/v1/analysis/aggregations | analysis.read | Query: time_range, group_by | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-74 | 执行日志查询 | Query | POST | /api/v1/query/search | query.read | Body: query_request | {code:0,data:{items:[],total:0}} | 200/400/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-75 | 执行SQL查询 | Query | POST | /api/v1/query/sql | query.read | Body: {sql} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-76 | 获取字段自动补全 | Query | GET | /api/v1/query/autocomplete/fields | query.read | Query: prefix | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-77 | 获取值自动补全 | Query | GET | /api/v1/query/autocomplete/values | query.read | Query: field, prefix | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-78 | 获取搜索历史 | Query | GET | /api/v1/query/history | query.read | Query: limit | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-79 | 获取查询模板列表 | Query | GET | /api/v1/query/templates | query.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-80 | 保存查询模板 | Query | POST | /api/v1/query/templates | query.write | Body: template | {code:0,data:{id:"tpl-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-3-81 | 删除查询模板 | Query | DELETE | /api/v1/query/templates/{id} | query.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-82 | 导出查询结果 | Query | POST | /api/v1/query/export | query.read | Body: {query_request,format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回二进制数据 |
| API-3-83 | 自然语言查询 | NLP | POST | /api/v1/nlp/query | query.read | Body: {input,user_id} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-84 | 获取查询建议 | NLP | GET | /api/v1/nlp/suggestions | query.read | Query: input, user_id | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-85 | 获取查询示例 | NLP | GET | /api/v1/nlp/examples | query.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-86 | 检测异常 | ML | POST | /api/v1/ml/anomaly/detect | ml.read | Body: log_entry | {code:0,data:{is_anomaly:false}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-87 | 获取异常列表 | ML | GET | /api/v1/ml/anomaly/list | ml.read | Query: time_range, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-3-88 | 提交异常反馈 | ML | POST | /api/v1/ml/anomaly/{id}/feedback | ml.write | Body: {is_false_positive} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-89 | 获取模型列表 | ML | GET | /api/v1/ml/models | ml.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-90 | 获取模型指标 | ML | GET | /api/v1/ml/models/{name}/metrics | ml.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-3-91 | 更新模型 | ML | POST | /api/v1/ml/models/{name}/update | ml.write | Body: training_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-3-92 | 执行聚类分析 | Clustering | POST | /api/v1/clustering/analyze | ml.write | Body: {logs,algorithm} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-93 | 增量聚类 | Clustering | POST | /api/v1/clustering/incremental | ml.write | Body: log_entry | {code:0,data:{cluster_id:1}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-3-94 | 获取聚类列表 | Clustering | GET | /api/v1/clustering/list | ml.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-95 | 获取聚类详情 | Clustering | GET | /api/v1/clustering/{id} | ml.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-3-96 | 获取聚类摘要 | Clustering | GET | /api/v1/clustering/{id}/summary | ml.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-3-97 | 获取聚类可视化数据 | Clustering | GET | /api/v1/clustering/visualize | ml.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-3-98 | 获取聚类趋势 | Clustering | GET | /api/v1/clustering/trends | ml.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-3-99 | 触发配置热更新 | Analysis | POST | /api/v1/analysis/config/reload | analysis.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-3-100 | 健康检查 | Analysis | GET | /api/v1/analysis/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-3-101 | 获取分析指标 | Analysis | GET | /api/v1/analysis/metrics | analysis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

### 4.4 模块4：日志分析 (53个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-4-102 | 获取告警规则列表 | Alert | GET | /api/v1/alert/rules | alert.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-103 | 创建告警规则 | Alert | POST | /api/v1/alert/rules | alert.write | Body: rule_config | {code:0,data:{id:"rule-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-104 | 更新告警规则 | Alert | PUT | /api/v1/alert/rules/{id} | alert.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-105 | 删除告警规则 | Alert | DELETE | /api/v1/alert/rules/{id} | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-106 | 启用告警规则 | Alert | POST | /api/v1/alert/rules/{id}/enable | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-107 | 禁用告警规则 | Alert | POST | /api/v1/alert/rules/{id}/disable | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-108 | 获取告警列表 | Alert | GET | /api/v1/alert/list | alert.read | Query: time_range, severity, status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-4-109 | 获取告警详情 | Alert | GET | /api/v1/alert/{id} | alert.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-4-110 | 确认告警 | Alert | POST | /api/v1/alert/{id}/acknowledge | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-111 | 解决告警 | Alert | POST | /api/v1/alert/{id}/resolve | alert.write | Body: {resolution} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-112 | 获取告警历史 | Alert | GET | /api/v1/alert/history | alert.read | Query: time_range, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-4-113 | 获取告警统计 | Alert | GET | /api/v1/alert/statistics | alert.read | Query: time_range, group_by | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-114 | 获取抑制规则列表 | Suppression | GET | /api/v1/suppression/rules | alert.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-115 | 创建抑制规则 | Suppression | POST | /api/v1/suppression/rules | alert.write | Body: rule_config | {code:0,data:{id:"sup-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-116 | 更新抑制规则 | Suppression | PUT | /api/v1/suppression/rules/{id} | alert.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-117 | 删除抑制规则 | Suppression | DELETE | /api/v1/suppression/rules/{id} | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-118 | 获取静默规则列表 | Silence | GET | /api/v1/silence/list | alert.read | Query: status | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-119 | 创建静默规则 | Silence | POST | /api/v1/silence | alert.write | Body: silence_config | {code:0,data:{id:"sil-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-120 | 更新静默规则 | Silence | PUT | /api/v1/silence/{id} | alert.write | Body: silence_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-121 | 删除静默规则 | Silence | DELETE | /api/v1/silence/{id} | alert.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-122 | 获取当前生效的静默规则 | Silence | GET | /api/v1/silence/active | alert.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-123 | 获取抑制历史 | Suppression | GET | /api/v1/suppression/history | alert.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-124 | 获取响应规则列表 | Response | GET | /api/v1/response/rules | response.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-125 | 创建响应规则 | Response | POST | /api/v1/response/rules | response.write | Body: rule_config | {code:0,data:{id:"resp-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-126 | 更新响应规则 | Response | PUT | /api/v1/response/rules/{id} | response.write | Body: rule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-127 | 删除响应规则 | Response | DELETE | /api/v1/response/rules/{id} | response.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-128 | 获取可用动作列表 | Response | GET | /api/v1/response/actions | response.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-129 | 获取工作流列表 | Response | GET | /api/v1/response/workflows | response.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-130 | 创建工作流 | Response | POST | /api/v1/response/workflows | response.write | Body: workflow_config | {code:0,data:{id:"wf-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-131 | 获取响应历史 | Response | GET | /api/v1/response/history | response.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-132 | 模拟执行响应 | Response | POST | /api/v1/response/dry-run | response.write | Body: {alert,rule_id} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-133 | 回滚响应操作 | Response | POST | /api/v1/response/rollback/{id} | response.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-4-134 | 获取审批请求列表 | Approval | GET | /api/v1/approval/requests | approval.read | Query: status | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-135 | 批准审批请求 | Approval | POST | /api/v1/approval/{id}/approve | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-136 | 拒绝审批请求 | Approval | POST | /api/v1/approval/{id}/reject | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-137 | 获取值班计划列表 | OnCall | GET | /api/v1/oncall/schedules | oncall.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-138 | 创建值班计划 | OnCall | POST | /api/v1/oncall/schedules | oncall.write | Body: schedule_config | {code:0,data:{id:"sch-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-139 | 更新值班计划 | OnCall | PUT | /api/v1/oncall/schedules/{id} | oncall.write | Body: schedule_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-140 | 删除值班计划 | OnCall | DELETE | /api/v1/oncall/schedules/{id} | oncall.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-141 | 获取当前值班人员 | OnCall | GET | /api/v1/oncall/current | oncall.read | Query: schedule_id | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-142 | 获取值班日历 | OnCall | GET | /api/v1/oncall/calendar | oncall.read | Query: schedule_id, start_date, end_date | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-143 | 获取临时调整列表 | OnCall | GET | /api/v1/oncall/overrides | oncall.read | Query: schedule_id | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-144 | 创建临时调整 | OnCall | POST | /api/v1/oncall/overrides | oncall.write | Body: override_config | {code:0,data:{id:"ovr-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-145 | 删除临时调整 | OnCall | DELETE | /api/v1/oncall/overrides/{id} | oncall.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-146 | 获取交接记录列表 | OnCall | GET | /api/v1/oncall/handoffs | oncall.read | Query: schedule_id | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-147 | 创建交接记录 | OnCall | POST | /api/v1/oncall/handoffs | oncall.write | Body: handoff_config | {code:0,data:{id:"hnd-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-4-148 | 完成交接 | OnCall | POST | /api/v1/oncall/handoffs/{id}/complete | oncall.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-4-149 | 获取值班统计 | OnCall | GET | /api/v1/oncall/statistics | oncall.read | Query: start_date, end_date | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-4-150 | 获取通知渠道列表 | Notification | GET | /api/v1/notification/channels | notification.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-4-151 | 测试通知渠道 | Notification | POST | /api/v1/notification/channels/{name}/test | notification.write | Body: {test_message} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-4-152 | 触发配置热更新 | Alert | POST | /api/v1/alert/config/reload | alert.admin | Body: {component} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-4-153 | 健康检查 | Alert | GET | /api/v1/alert/health | 无 | 无 | {code:0,data:{status:"healthy"}} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-4-154 | 获取告警指标 | Alert | GET | /api/v1/alert/metrics | alert.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

### 4.5 模块5：告警与通知 (35个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-5-155 | 查询追踪列表 | Tracing | GET | /api/v1/traces | tracing.read | Query: time_range, service, status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-5-156 | 获取追踪详情 | Tracing | GET | /api/v1/traces/{traceId} | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-157 | 获取Span列表 | Tracing | GET | /api/v1/traces/{traceId}/spans | tracing.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-158 | 获取调用树 | Tracing | GET | /api/v1/traces/{traceId}/tree | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-159 | 获取关联日志 | Tracing | GET | /api/v1/traces/{traceId}/logs | tracing.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-160 | 获取性能分析 | Tracing | GET | /api/v1/traces/{traceId}/analysis | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-161 | 获取服务拓扑图 | Topology | GET | /api/v1/topology | topology.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-162 | 获取服务列表 | Topology | GET | /api/v1/topology/services | topology.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-163 | 获取服务详情 | Topology | GET | /api/v1/topology/services/{serviceName} | topology.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-164 | 获取服务依赖 | Topology | GET | /api/v1/topology/services/{serviceName}/dependencies | topology.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-165 | 获取服务调用关系 | Topology | GET | /api/v1/topology/edges | topology.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-166 | 获取采样配置 | Tracing | GET | /api/v1/tracing/sampling/config | tracing.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-167 | 更新采样配置 | Tracing | PUT | /api/v1/tracing/sampling/config | tracing.write | Body: sampling_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-168 | 获取采样统计 | Tracing | GET | /api/v1/tracing/sampling/stats | tracing.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-169 | 查询异常列表 | Diagnosis | GET | /api/v1/diagnosis/anomalies | diagnosis.read | Query: time_range, severity | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-5-170 | 获取异常详情 | Diagnosis | GET | /api/v1/diagnosis/anomalies/{anomalyId} | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-171 | 触发根因分析 | Diagnosis | POST | /api/v1/diagnosis/anomalies/{anomalyId}/analyze | diagnosis.write | 无 | {code:0,data:{task_id:"task-1"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-5-172 | 获取根因分析结果 | Diagnosis | GET | /api/v1/diagnosis/anomalies/{anomalyId}/root-cause | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-173 | 获取故障传播路径 | Diagnosis | GET | /api/v1/diagnosis/anomalies/{anomalyId}/propagation | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-174 | 获取故障预测列表 | Diagnosis | GET | /api/v1/diagnosis/predictions | diagnosis.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-175 | 获取服务故障预测 | Diagnosis | GET | /api/v1/diagnosis/predictions/{serviceName} | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-176 | 触发故障预测 | Diagnosis | POST | /api/v1/diagnosis/predictions/{serviceName}/trigger | diagnosis.write | 无 | {code:0,data:{task_id:"task-1"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-5-177 | 查询知识案例 | Knowledge | GET | /api/v1/diagnosis/knowledge/cases | knowledge.read | Query: keyword, category | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-5-178 | 获取案例详情 | Knowledge | GET | /api/v1/diagnosis/knowledge/cases/{caseId} | knowledge.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-5-179 | 创建知识案例 | Knowledge | POST | /api/v1/diagnosis/knowledge/cases | knowledge.write | Body: case_data | {code:0,data:{id:"case-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-5-180 | 更新知识案例 | Knowledge | PUT | /api/v1/diagnosis/knowledge/cases/{caseId} | knowledge.write | Body: case_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-181 | 删除知识案例 | Knowledge | DELETE | /api/v1/diagnosis/knowledge/cases/{caseId} | knowledge.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-5-182 | 匹配相似案例 | Knowledge | POST | /api/v1/diagnosis/knowledge/match | knowledge.read | Body: {symptoms} | {code:0,data:[...]} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-183 | 获取诊断配置 | Diagnosis | GET | /api/v1/diagnosis/config | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-184 | 更新诊断配置 | Diagnosis | PUT | /api/v1/diagnosis/config | diagnosis.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-185 | 获取异常阈值配置 | Diagnosis | GET | /api/v1/diagnosis/config/thresholds | diagnosis.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-5-186 | 更新异常阈值配置 | Diagnosis | PUT | /api/v1/diagnosis/config/thresholds | diagnosis.write | Body: thresholds | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-187 | 获取诊断统计 | Diagnosis | GET | /api/v1/diagnosis/stats | diagnosis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-188 | 获取诊断准确率 | Diagnosis | GET | /api/v1/diagnosis/stats/accuracy | diagnosis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-5-189 | 获取诊断性能指标 | Diagnosis | GET | /api/v1/diagnosis/stats/performance | diagnosis.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |

### 4.6 模块6：可视化与报表 (47个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-6-190 | 获取实时仪表盘数据 | Dashboard | GET | /api/v1/dashboard/realtime | dashboard.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | 实时数据 |
| API-6-191 | WebSocket实时数据推送 | Dashboard | WS | /api/v1/dashboard/ws | dashboard.read | 无 | WebSocket消息流 | 101/401/403/500 | v1 | 否 | 否 | - | WebSocket连接 |
| API-6-192 | 获取系统指标 | Dashboard | GET | /api/v1/dashboard/metrics | dashboard.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-193 | 获取指定类型图表数据 | Dashboard | GET | /api/v1/dashboard/charts/{type} | dashboard.read | Query: time_range | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-194 | 更新仪表盘配置 | Dashboard | PUT | /api/v1/dashboard/config | dashboard.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-195 | 查询仪表盘列表 | Dashboard | GET | /api/v1/dashboards | dashboard.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-6-196 | 创建仪表盘 | Dashboard | POST | /api/v1/dashboards | dashboard.write | Body: dashboard_data | {code:0,data:{id:"dash-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-197 | 获取仪表盘详情 | Dashboard | GET | /api/v1/dashboards/{id} | dashboard.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-198 | 更新仪表盘 | Dashboard | PUT | /api/v1/dashboards/{id} | dashboard.write | Body: dashboard_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-199 | 删除仪表盘 | Dashboard | DELETE | /api/v1/dashboards/{id} | dashboard.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-200 | 复制仪表盘 | Dashboard | POST | /api/v1/dashboards/{id}/duplicate | dashboard.write | 无 | {code:0,data:{id:"dash-2"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-201 | 分享仪表盘 | Dashboard | POST | /api/v1/dashboards/{id}/share | dashboard.write | Body: {expire_time} | {code:0,data:{token:"abc123"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-202 | 获取分享的仪表盘 | Dashboard | GET | /api/v1/dashboards/shared/{token} | 无 | 无 | {code:0,data:{...}} | 200/404/410/500 | v1 | 是 | 是 | - | 公开接口 |
| API-6-203 | 导出仪表盘 | Dashboard | GET | /api/v1/dashboards/{id}/export | dashboard.read | 无 | Binary | 200/401/403/404/500 | v1 | 是 | 否 | - | 返回JSON文件 |
| API-6-204 | 导入仪表盘 | Dashboard | POST | /api/v1/dashboards/import | dashboard.write | Body: dashboard_json | {code:0,data:{id:"dash-3"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-205 | 获取历史版本列表 | Dashboard | GET | /api/v1/dashboards/{id}/versions | dashboard.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-206 | 恢复历史版本 | Dashboard | POST | /api/v1/dashboards/{id}/versions/{version}/restore | dashboard.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-207 | 获取模板列表 | Dashboard | GET | /api/v1/dashboard-templates | dashboard.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-208 | 获取模板详情 | Dashboard | GET | /api/v1/dashboard-templates/{id} | dashboard.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-209 | 应用模板 | Dashboard | POST | /api/v1/dashboard-templates/{id}/apply | dashboard.write | Body: {name} | {code:0,data:{id:"dash-4"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-210 | 查询日志 | Logs | POST | /api/v1/logs/query | logs.read | Body: query_request | {code:0,data:{items:[],total:0}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-211 | 获取日志详情 | Logs | GET | /api/v1/logs/{id} | logs.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-212 | 获取日志上下文 | Logs | GET | /api/v1/logs/{id}/context | logs.read | Query: before, after | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-213 | 导出日志 | Logs | POST | /api/v1/logs/export | logs.read | Body: {query,format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回文件 |
| API-6-214 | 获取日志聚合统计 | Logs | GET | /api/v1/logs/aggregations | logs.read | Query: time_range, group_by | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-215 | 获取书签列表 | Logs | GET | /api/v1/log-bookmarks | logs.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-216 | 创建书签 | Logs | POST | /api/v1/log-bookmarks | logs.write | Body: {log_id,note} | {code:0,data:{id:"bm-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-217 | 删除书签 | Logs | DELETE | /api/v1/log-bookmarks/{id} | logs.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-218 | 查询报告列表 | Report | GET | /api/v1/reports | report.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-6-219 | 创建报告 | Report | POST | /api/v1/reports | report.write | Body: report_config | {code:0,data:{id:"rpt-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-220 | 获取报告详情 | Report | GET | /api/v1/reports/{id} | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-221 | 更新报告 | Report | PUT | /api/v1/reports/{id} | report.write | Body: report_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-222 | 删除报告 | Report | DELETE | /api/v1/reports/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-223 | 手动生成报告 | Report | POST | /api/v1/reports/{id}/generate | report.write | 无 | {code:0,data:{record_id:"rec-1"}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-6-224 | 预览报告 | Report | GET | /api/v1/reports/{id}/preview | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-225 | 查询报告记录 | Report | GET | /api/v1/report-records | report.read | Query: report_id, page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-6-226 | 获取报告记录详情 | Report | GET | /api/v1/report-records/{id} | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-227 | 下载报告文件 | Report | GET | /api/v1/report-records/{id}/download | report.read | 无 | Binary | 200/401/403/404/500 | v1 | 是 | 否 | - | 返回文件 |
| API-6-228 | 删除报告记录 | Report | DELETE | /api/v1/report-records/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-229 | 获取订阅列表 | Report | GET | /api/v1/report-subscriptions | report.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-6-230 | 创建订阅 | Report | POST | /api/v1/report-subscriptions | report.write | Body: {report_id,channel} | {code:0,data:{id:"sub-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-231 | 取消订阅 | Report | DELETE | /api/v1/report-subscriptions/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-232 | 获取报告模板列表 | Report | GET | /api/v1/report-templates | report.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-6-233 | 获取报告模板详情 | Report | GET | /api/v1/report-templates/{id} | report.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-6-234 | 创建报告模板 | Report | POST | /api/v1/report-templates | report.write | Body: template_data | {code:0,data:{id:"tpl-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-6-235 | 更新报告模板 | Report | PUT | /api/v1/report-templates/{id} | report.write | Body: template_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-6-236 | 删除报告模板 | Report | DELETE | /api/v1/report-templates/{id} | report.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |

### 4.7 模块7：用户与权限管理 (42个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-7-237 | 用户登录 | Auth | POST | /api/v1/auth/login | 无 | Body: {username,password} | {code:0,data:{token:"..."}} | 200/400/401/500 | v1 | 否 | 否 | - | 公开接口 |
| API-7-238 | 用户登出 | Auth | POST | /api/v1/auth/logout | auth.user | 无 | {code:0,message:"ok"} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-7-239 | 刷新令牌 | Auth | POST | /api/v1/auth/refresh | 无 | Body: {refresh_token} | {code:0,data:{token:"..."}} | 200/400/401/500 | v1 | 否 | 否 | - | - |
| API-7-240 | 验证令牌 | Auth | POST | /api/v1/auth/verify | 无 | Body: {token} | {code:0,data:{valid:true}} | 200/400/500 | v1 | 是 | 否 | - | - |
| API-7-241 | 修改密码 | Auth | POST | /api/v1/auth/password/change | auth.user | Body: {old_password,new_password} | {code:0,message:"ok"} | 200/400/401/500 | v1 | 否 | 否 | - | - |
| API-7-242 | 重置密码 | Auth | POST | /api/v1/auth/password/reset | 无 | Body: {email} | {code:0,message:"ok"} | 200/400/500 | v1 | 否 | 否 | - | 公开接口 |
| API-7-243 | 启用MFA | Auth | POST | /api/v1/auth/mfa/enable | auth.user | 无 | {code:0,data:{secret:"..."}} | 200/401/500 | v1 | 否 | 否 | - | - |
| API-7-244 | 禁用MFA | Auth | POST | /api/v1/auth/mfa/disable | auth.user | Body: {code} | {code:0,message:"ok"} | 200/400/401/500 | v1 | 否 | 否 | - | - |
| API-7-245 | 验证MFA代码 | Auth | POST | /api/v1/auth/mfa/verify | auth.user | Body: {code} | {code:0,data:{valid:true}} | 200/400/401/500 | v1 | 是 | 否 | - | - |
| API-7-246 | 获取TOTP二维码 | Auth | GET | /api/v1/auth/mfa/qrcode | auth.user | 无 | {code:0,data:{qrcode:"..."}} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-7-247 | 查询用户列表 | User | GET | /api/v1/users | user.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-7-248 | 创建用户 | User | POST | /api/v1/users | user.write | Body: user_data | {code:0,data:{id:"user-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-7-249 | 获取用户详情 | User | GET | /api/v1/users/{id} | user.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-7-250 | 更新用户 | User | PUT | /api/v1/users/{id} | user.write | Body: user_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-7-251 | 删除用户 | User | DELETE | /api/v1/users/{id} | user.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-7-252 | 查询角色列表 | Role | GET | /api/v1/roles | role.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-7-253 | 创建角色 | Role | POST | /api/v1/roles | role.write | Body: role_data | {code:0,data:{id:"role-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-7-254 | 获取角色详情 | Role | GET | /api/v1/roles/{id} | role.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-7-255 | 更新角色 | Role | PUT | /api/v1/roles/{id} | role.write | Body: role_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-7-256 | 删除角色 | Role | DELETE | /api/v1/roles/{id} | role.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-7-257 | 分配权限 | Role | POST | /api/v1/roles/{id}/permissions | role.write | Body: {permissions:[]} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-7-258 | 查询权限列表 | Permission | GET | /api/v1/permissions | permission.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-7-259 | 检查权限 | Permission | POST | /api/v1/permissions/check | auth.user | Body: {resource,action} | {code:0,data:{allowed:true}} | 200/400/401/500 | v1 | 是 | 否 | - | - |
| API-7-260 | 获取用户权限 | Permission | GET | /api/v1/users/{id}/permissions | permission.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-7-261 | 查询会话列表 | Session | GET | /api/v1/sessions | session.read | Query: user_id | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-7-262 | 删除会话 | Session | DELETE | /api/v1/sessions/{id} | session.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-7-263 | 删除用户所有会话 | Session | DELETE | /api/v1/sessions/user/{userId} | session.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-7-264 | 加密数据 | Encryption | POST | /api/v1/encryption/encrypt | encryption.write | Body: {data} | {code:0,data:{encrypted:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-7-265 | 解密数据 | Encryption | POST | /api/v1/encryption/decrypt | encryption.write | Body: {encrypted} | {code:0,data:{data:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-7-266 | 获取密钥列表 | Encryption | GET | /api/v1/encryption/keys | encryption.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-7-267 | 获取当前密钥 | Encryption | GET | /api/v1/encryption/keys/current | encryption.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-7-268 | 轮换密钥 | Encryption | POST | /api/v1/encryption/keys/rotate | encryption.admin | 无 | {code:0,message:"ok"} | 200/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-7-269 | 获取加密配置 | Encryption | GET | /api/v1/encryption/config | encryption.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-7-270 | 更新加密配置 | Encryption | PUT | /api/v1/encryption/config | encryption.admin | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | 仅管理员 |
| API-7-271 | 查询审计日志 | Audit | POST | /api/v1/audit/query | audit.read | Body: query_request | {code:0,data:{items:[],total:0}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-7-272 | 获取审计日志详情 | Audit | GET | /api/v1/audit/{id} | audit.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-7-273 | 导出审计日志 | Audit | POST | /api/v1/audit/export | audit.read | Body: {query,format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回文件 |
| API-7-274 | 生成审计报告 | Audit | POST | /api/v1/audit/report | audit.read | Body: {time_range,type} | {code:0,data:{report_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-7-275 | 获取审计统计 | Audit | GET | /api/v1/audit/stats | audit.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-7-276 | 获取异常审计 | Audit | GET | /api/v1/audit/anomalies | audit.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-7-277 | 获取审计配置 | Audit | GET | /api/v1/audit/config | audit.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-7-278 | 更新审计配置 | Audit | PUT | /api/v1/audit/config | audit.admin | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | 仅管理员 |

### 4.8 模块8：系统配置与管理 (41个接口)

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

### 4.9 模块9：日志安全 (33个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-9-320 | 获取集群状态 | HA | GET | /api/v1/ha/cluster/status | ha.read | 无 | {code:0,data:{status:"healthy"}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-321 | 列出集群节点 | HA | GET | /api/v1/ha/cluster/nodes | ha.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-9-322 | 获取节点详情 | HA | GET | /api/v1/ha/cluster/nodes/{id} | ha.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-9-323 | 注册节点 | HA | POST | /api/v1/ha/cluster/nodes | ha.write | Body: node_config | {code:0,data:{id:"node-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-9-324 | 注销节点 | HA | DELETE | /api/v1/ha/cluster/nodes/{id} | ha.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-9-325 | 触发故障转移 | HA | POST | /api/v1/ha/failover | ha.admin | Body: {target_node} | {code:0,data:{task_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-9-326 | 获取故障转移历史 | HA | GET | /api/v1/ha/failover/history | ha.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-9-327 | 获取健康检查结果 | HA | GET | /api/v1/ha/health | ha.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-328 | 配置健康检查 | HA | PUT | /api/v1/ha/health/config | ha.write | Body: health_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-329 | 获取复制状态 | HA | GET | /api/v1/ha/replication/status | ha.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-330 | 配置复制策略 | HA | PUT | /api/v1/ha/replication/config | ha.write | Body: replication_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-331 | 获取复制延迟 | HA | GET | /api/v1/ha/replication/lag | ha.read | 无 | {code:0,data:{lag_ms:100}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-332 | 执行滚动升级 | HA | POST | /api/v1/ha/upgrade | ha.admin | Body: {version} | {code:0,data:{task_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-9-333 | 获取升级状态 | HA | GET | /api/v1/ha/upgrade/status | ha.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-334 | 优雅关闭节点 | HA | POST | /api/v1/ha/nodes/{id}/shutdown | ha.admin | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-9-335 | 执行灾难恢复 | DR | POST | /api/v1/dr/recovery | dr.admin | Body: recovery_plan | {code:0,data:{recovery_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-9-336 | 获取恢复状态 | DR | GET | /api/v1/dr/recovery/{id} | dr.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-9-337 | 列出恢复历史 | DR | GET | /api/v1/dr/recovery/history | dr.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-9-338 | 获取恢复计划 | DR | GET | /api/v1/dr/plans | dr.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-9-339 | 创建恢复计划 | DR | POST | /api/v1/dr/plans | dr.write | Body: plan_config | {code:0,data:{id:"plan-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-9-340 | 更新恢复计划 | DR | PUT | /api/v1/dr/plans/{id} | dr.write | Body: plan_config | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-9-341 | 删除恢复计划 | DR | DELETE | /api/v1/dr/plans/{id} | dr.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-9-342 | 执行恢复演练 | DR | POST | /api/v1/dr/drill | dr.write | Body: {plan_id} | {code:0,data:{drill_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-9-343 | 获取演练报告 | DR | GET | /api/v1/dr/drill/{id} | dr.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-9-344 | 列出演练历史 | DR | GET | /api/v1/dr/drill/history | dr.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-9-345 | 验证备份 | DR | POST | /api/v1/dr/backup/validate | dr.write | Body: {backup_id} | {code:0,data:{valid:true}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-346 | 获取验证报告 | DR | GET | /api/v1/dr/backup/validation | dr.read | Query: backup_id | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-9-347 | 获取DR仪表盘 | DR | GET | /api/v1/dr/dashboard | dr.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-348 | 获取RTO/RPO指标 | DR | GET | /api/v1/dr/metrics | dr.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-9-349 | 配置DR策略 | DR | PUT | /api/v1/dr/config | dr.admin | Body: dr_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | 仅管理员 |
| API-9-350 | 获取DR配置 | DR | GET | /api/v1/dr/config | dr.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-9-351 | 测试故障场景 | DR | POST | /api/v1/dr/test/{scenario} | dr.write | 无 | {code:0,data:{test_id:"..."}} | 200/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-9-352 | 回滚恢复操作 | DR | POST | /api/v1/dr/recovery/{id}/rollback | dr.admin | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | - | 仅管理员 |

### 4.10 模块10：性能优化 (39个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-10-353 | 获取扩缩容状态 | Autoscaling | GET | /api/v1/autoscaling/status | autoscaling.read | 无 | {code:0,data:{status:"running"}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-354 | 配置扩缩容策略 | Autoscaling | PUT | /api/v1/autoscaling/config | autoscaling.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-355 | 获取扩缩容配置 | Autoscaling | GET | /api/v1/autoscaling/config | autoscaling.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-356 | 手动触发扩容 | Autoscaling | POST | /api/v1/autoscaling/scale-up | autoscaling.write | Body: {replicas} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-357 | 手动触发缩容 | Autoscaling | POST | /api/v1/autoscaling/scale-down | autoscaling.write | Body: {replicas} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-358 | 获取扩缩容历史 | Autoscaling | GET | /api/v1/autoscaling/history | autoscaling.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-10-359 | 获取扩缩容事件 | Autoscaling | GET | /api/v1/autoscaling/events | autoscaling.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-360 | 获取分析报告 | Autoscaling | GET | /api/v1/autoscaling/report | autoscaling.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-361 | 配置定时扩缩容 | Autoscaling | PUT | /api/v1/autoscaling/schedule | autoscaling.write | Body: schedule_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-362 | 获取定时配置 | Autoscaling | GET | /api/v1/autoscaling/schedule | autoscaling.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-363 | 获取资源指标 | Monitoring | GET | /api/v1/monitoring/metrics | monitoring.read | Query: resource_type | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-364 | 获取历史指标 | Monitoring | GET | /api/v1/monitoring/metrics/history | monitoring.read | Query: time_range | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-365 | 获取趋势预测 | Monitoring | GET | /api/v1/monitoring/prediction | monitoring.read | Query: metric | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-366 | 配置监控策略 | Monitoring | PUT | /api/v1/monitoring/config | monitoring.write | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-367 | 获取监控配置 | Monitoring | GET | /api/v1/monitoring/config | monitoring.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-368 | 获取告警列表 | Monitoring | GET | /api/v1/monitoring/alerts | monitoring.read | Query: severity | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-369 | 配置告警阈值 | Monitoring | PUT | /api/v1/monitoring/thresholds | monitoring.write | Body: thresholds | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-370 | 获取每日报告 | Monitoring | GET | /api/v1/monitoring/report/daily | monitoring.read | Query: date | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-371 | 获取热力图数据 | Monitoring | GET | /api/v1/monitoring/heatmap | monitoring.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-372 | 获取优化建议 | Monitoring | GET | /api/v1/monitoring/recommendations | monitoring.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-373 | 添加自定义指标 | Monitoring | POST | /api/v1/monitoring/metrics/custom | monitoring.write | Body: metric_config | {code:0,data:{id:"metric-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-374 | 删除自定义指标 | Monitoring | DELETE | /api/v1/monitoring/metrics/custom/{id} | monitoring.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-10-375 | 获取性能指标 | Monitoring | GET | /api/v1/monitoring/performance | monitoring.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-376 | 对比分析 | Monitoring | POST | /api/v1/monitoring/compare | monitoring.read | Body: {periods:[]} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-377 | 执行查询 | Query | POST | /api/v1/query/execute | query.read | Body: query_request | {code:0,data:{query_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-10-378 | 获取查询结果 | Query | GET | /api/v1/query/{id} | query.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-10-379 | 取消查询 | Query | DELETE | /api/v1/query/{id} | query.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-10-380 | 获取查询计划 | Query | POST | /api/v1/query/explain | query.read | Body: {query} | {code:0,data:{...}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-381 | 清除查询缓存 | Query | DELETE | /api/v1/query/cache | query.admin | 无 | {code:0,message:"ok"} | 200/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-10-382 | 获取缓存统计 | Query | GET | /api/v1/query/cache/stats | query.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-383 | 获取慢查询列表 | Query | GET | /api/v1/query/slow | query.read | Query: threshold | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-384 | 获取查询统计 | Query | GET | /api/v1/query/stats | query.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-385 | 配置查询优化 | Query | PUT | /api/v1/query/config | query.admin | Body: config_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | 仅管理员 |
| API-10-386 | 获取优化配置 | Query | GET | /api/v1/query/config | query.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-10-387 | 获取索引建议 | Query | GET | /api/v1/query/index/suggestions | query.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-388 | 创建索引 | Query | POST | /api/v1/query/index | query.admin | Body: index_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | 仅管理员 |
| API-10-389 | 删除索引 | Query | DELETE | /api/v1/query/index/{name} | query.admin | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | 仅管理员 |
| API-10-390 | 获取性能报告 | Query | GET | /api/v1/query/report | query.read | Query: time_range | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-10-391 | 流式查询 | Query | GET | /api/v1/query/stream | query.read | Query: query_id | Stream | 200/401/403/404/500 | v1 | 是 | 否 | - | 流式返回 |

### 4.11 模块11：集成与扩展 (20个接口)

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

### 4.12 模块12：监控与运维 (41个接口)

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

### 4.13 模块13：日志生命周期管理 (17个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-13-453 | 获取主题配置 | UI | GET | /api/v1/ui/theme | ui.read | 无 | {code:0,data:{theme:"light"}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-454 | 更新主题配置 | UI | PUT | /api/v1/ui/theme | ui.write | Body: {theme} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-455 | 批量标记日志 | Logs | POST | /api/v1/logs/batch/mark | logs.write | Body: {log_ids:[],mark} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-456 | 批量删除日志 | Logs | POST | /api/v1/logs/batch/delete | logs.write | Body: {log_ids:[]} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-457 | 批量导出日志 | Logs | POST | /api/v1/logs/batch/export | logs.read | Body: {log_ids:[],format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回文件 |
| API-13-458 | 获取搜索建议 | Search | GET | /api/v1/search/suggestions | search.read | Query: keyword | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-459 | 获取搜索历史 | Search | GET | /api/v1/search/history | search.read | Query: limit | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-460 | 获取保存的过滤器 | Search | GET | /api/v1/search/filters | search.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-461 | 保存过滤器 | Search | POST | /api/v1/search/filters | search.write | Body: filter_config | {code:0,data:{id:"filter-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-13-462 | 订阅实时日志流 | Realtime | WS | /api/v1/realtime/subscribe | realtime.read | WebSocket消息 | WebSocket消息流 | 101/401/403/500 | v1 | 否 | 否 | - | WebSocket连接 |
| API-13-463 | 取消订阅 | Realtime | WS | /api/v1/realtime/unsubscribe | realtime.read | WebSocket消息 | WebSocket消息 | 101/401/403/500 | v1 | 是 | 否 | - | WebSocket连接 |
| API-13-464 | 获取用户偏好设置 | Preferences | GET | /api/v1/preferences | preferences.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-465 | 更新用户偏好设置 | Preferences | PUT | /api/v1/preferences | preferences.write | Body: preferences_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-466 | 导出用户配置 | Preferences | GET | /api/v1/preferences/export | preferences.read | 无 | Binary | 200/401/403/500 | v1 | 是 | 否 | - | 返回JSON文件 |
| API-13-467 | 导入用户配置 | Preferences | POST | /api/v1/preferences/import | preferences.write | Body: config_file | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-13-468 | 获取快捷键配置 | Shortcuts | GET | /api/v1/shortcuts | shortcuts.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-469 | 更新快捷键配置 | Shortcuts | PUT | /api/v1/shortcuts | shortcuts.write | Body: shortcuts_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |

### 4.14 模块14：高可用与容灾 (33个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-14-470 | 创建任务 | Task | POST | /api/v1/tasks | task.write | Body: task_data | {code:0,data:{id:"task-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-471 | 查询任务列表 | Task | GET | /api/v1/tasks | task.read | Query: page, size, status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-14-472 | 获取任务详情 | Task | GET | /api/v1/tasks/{id} | task.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-14-473 | 更新任务 | Task | PUT | /api/v1/tasks/{id} | task.write | Body: task_data | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-474 | 删除任务 | Task | DELETE | /api/v1/tasks/{id} | task.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-475 | 分配任务 | Task | PUT | /api/v1/tasks/{id}/assign | task.write | Body: {assignee_id} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-476 | 更新任务状态 | Task | PUT | /api/v1/tasks/{id}/status | task.write | Body: {status} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-477 | 获取任务历史 | Task | GET | /api/v1/tasks/{id}/history | task.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-478 | 添加评论 | Task | POST | /api/v1/tasks/{id}/comments | task.write | Body: {content} | {code:0,data:{id:"comment-1"}} | 200/400/401/403/404/500 | v1 | 否 | 否 | - | - |
| API-14-479 | 获取评论列表 | Task | GET | /api/v1/tasks/{id}/comments | task.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-480 | 更新评论 | Task | PUT | /api/v1/comments/{id} | task.write | Body: {content} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-481 | 删除评论 | Task | DELETE | /api/v1/comments/{id} | task.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-482 | 获取任务模板列表 | Task | GET | /api/v1/task-templates | task.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-14-483 | 获取任务模板详情 | Task | GET | /api/v1/task-templates/{id} | task.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-14-484 | 从模板创建任务 | Task | POST | /api/v1/tasks/from-template | task.write | Body: {template_id} | {code:0,data:{id:"task-2"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-485 | 获取在线用户列表 | Presence | GET | /api/v1/presence/online-users | presence.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-14-486 | 更新在线状态 | Presence | PUT | /api/v1/presence/status | presence.write | Body: {status} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-14-487 | 创建工作流定义 | Workflow | POST | /api/v1/workflows | workflow.write | Body: workflow_definition | {code:0,data:{id:"wf-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-488 | 获取工作流列表 | Workflow | GET | /api/v1/workflows | workflow.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | - | 支持分页 |
| API-14-489 | 获取工作流详情 | Workflow | GET | /api/v1/workflows/{id} | workflow.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-14-490 | 更新工作流定义 | Workflow | PUT | /api/v1/workflows/{id} | workflow.write | Body: workflow_definition | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-491 | 删除工作流定义 | Workflow | DELETE | /api/v1/workflows/{id} | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-492 | 启动工作流实例 | Workflow | POST | /api/v1/workflow-instances | workflow.write | Body: {workflow_id,params} | {code:0,data:{instance_id:"..."}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-14-493 | 获取工作流实例列表 | Workflow | GET | /api/v1/workflow-instances | workflow.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |
| API-14-494 | 获取工作流实例详情 | Workflow | GET | /api/v1/workflow-instances/{id} | workflow.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-495 | 暂停工作流 | Workflow | PUT | /api/v1/workflow-instances/{id}/pause | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-496 | 恢复工作流 | Workflow | PUT | /api/v1/workflow-instances/{id}/resume | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-497 | 终止工作流 | Workflow | PUT | /api/v1/workflow-instances/{id}/terminate | workflow.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-498 | 获取工作流状态 | Workflow | GET | /api/v1/workflow-instances/{id}/status | workflow.read | 无 | {code:0,data:{status:"running"}} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-499 | 获取工作流执行历史 | Workflow | GET | /api/v1/workflow-instances/{id}/history | workflow.read | 无 | {code:0,data:[...]} | 200/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-500 | 审批通过 | Approval | POST | /api/v1/approvals/{id}/approve | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-501 | 审批拒绝 | Approval | POST | /api/v1/approvals/{id}/reject | approval.write | Body: {comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-14-502 | 获取待审批列表 | Approval | GET | /api/v1/approvals/pending | approval.read | Query: page, size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持分页 |

### 4.15 模块15：企业级功能 (65个接口)

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

### 4.16 模块16：高级功能补充 (122个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-16-568 | 获取模板列表 | 高级功能补充 | GET | /api/v1/templates | template.read | Query: page,size,category | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 张三 | 需求16-62 |

### 4.17 模块17：备份系统增强 (12个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-17-01 | 创建备份 | Backup | POST | /api/v1/backups | backup.write | Body: {type,name,description,custom_path,index_pattern} | {code:0,data:{id:"backup-1"}} | 201/400/401/403/500 | v1 | 否 | 否 | - | 支持自定义配置 |
| API-17-02 | 列出备份 | Backup | GET | /api/v1/backups | backup.read | Query: filter,sort,page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持筛选排序 |
| API-17-03 | 获取备份详情 | Backup | GET | /api/v1/backups/{id} | backup.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-17-04 | 更新备份 | Backup | PUT | /api/v1/backups/{id} | backup.write | Body: {name,description} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | 仅更新元数据 |
| API-17-05 | 删除备份 | Backup | DELETE | /api/v1/backups/{id} | backup.write | 无 | {code:0,message:"ok"} | 204/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-17-06 | 下载备份 | Backup | GET | /api/v1/backups/{id}/download | backup.read | Query: range | Binary | 200/206/401/403/404/500 | v1 | 是 | 否 | - | 支持断点续传 |
| API-17-07 | 导入备份 | Backup | POST | /api/v1/backups/import | backup.write | Body: multipart/form-data | {code:0,data:{id:"backup-1"}} | 201/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-17-08 | 获取备份统计 | Backup | GET | /api/v1/backups/stats | backup.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-17-09 | 获取可用路径 | Backup | GET | /api/v1/backups/paths | backup.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | 包含空间信息 |
| API-17-10 | 验证路径 | Backup | POST | /api/v1/backups/paths/validate | backup.read | Body: {path} | {code:0,data:{valid:true}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-17-11 | 批量删除备份 | Backup | POST | /api/v1/backups/batch-delete | backup.write | Body: {ids:[]} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-17-12 | 取消备份 | Backup | POST | /api/v1/backups/{id}/cancel | backup.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | 仅进行中的备份 |

### 4.18 模块18：真实备份集成 (5个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-18-01 | 创建备份 | Backup | POST | /api/v1/backups | backup.write | Body: {type,index_pattern} | {code:0,data:{id:"backup-1"}} | 201/400/500 | v1 | 否 | 否 | - | 集成真实 Manager |
| API-18-02 | 列出备份 | Backup | GET | /api/v1/backups | backup.read | 无 | {code:0,data:[...]} | 200/500 | v1 | 是 | 否 | - | 集成真实 Manager |
| API-18-03 | 获取备份详情 | Backup | GET | /api/v1/backups/{id} | backup.read | 无 | {code:0,data:{...}} | 200/404/500 | v1 | 是 | 是 | - | 集成真实 Manager |
| API-18-04 | 删除备份 | Backup | DELETE | /api/v1/backups/{id} | backup.write | 无 | {code:0,message:"ok"} | 204/404/500 | v1 | 是 | 否 | - | 集成真实 Manager |
| API-18-05 | 获取备份统计 | Backup | GET | /api/v1/backups/stats | backup.read | 无 | {code:0,data:{...}} | 200/500 | v1 | 是 | 否 | - | 集成真实 Manager |

### 4.19 模块19：通用日志采集代理 (8个接口)

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-19-01 | 健康检查 | LogAgent | GET | /health | 无 | 无 | {status:"healthy"} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-19-02 | 获取指标 | LogAgent | GET | /metrics | agent.read | 无 | Prometheus 格式 | 200/401/500 | v1 | 是 | 否 | - | Prometheus 端点 |
| API-19-03 | 获取配置 | LogAgent | GET | /api/v1/config | agent.read | 无 | {code:0,data:{...}} | 200/401/500 | v1 | 是 | 是 | - | - |
| API-19-04 | 更新配置 | LogAgent | PUT | /api/v1/config | agent.write | Body: config | {code:0,message:"ok"} | 200/400/401/500 | v1 | 是 | 否 | - | 触发热加载 |
| API-19-05 | 重载配置 | LogAgent | POST | /api/v1/config/reload | agent.write | 无 | {code:0,message:"ok"} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-19-06 | 获取输入状态 | LogAgent | GET | /api/v1/inputs | agent.read | 无 | {code:0,data:[...]} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-19-07 | 获取输出状态 | LogAgent | GET | /api/v1/outputs | agent.read | 无 | {code:0,data:[...]} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-19-08 | 获取缓冲区状态 | LogAgent | GET | /api/v1/buffer/stats | agent.read | 无 | {code:0,data:{...}} | 200/401/500 | v1 | 是 | 否 | - | - |

### 4.20 模块20：ML/AI 机器学习框架 (0个接口)

模块20为机器学习框架模块,主要提供离线训练和在线推理能力,不直接暴露REST API接口,通过内部服务调用方式集成。

### 4.21 模块21：NLP 自然语言处理 (0个接口)

模块21为NLP自然语言处理模块,主要提供自然语言查询和智能告警描述能力,已集成到查询和告警模块的API中,不单独提供接口。

### 4.22 模块22：多租户架构 (0个接口)

模块22为多租户架构模块,通过在现有API中添加tenant_id参数和JWT Claims实现租户隔离,不单独提供接口。

### 4.23 模块23：边缘计算 (0个接口)

模块23为边缘计算模块,边缘采集器通过模块19的LogAgent接口进行管理,边缘节点管理集成到系统配置模块中,不单独提供接口。

### 4.24 模块24：成本管理 (0个接口)

模块24为成本管理模块,成本追踪和优化功能集成到监控和报表模块中,不单独提供接口。

### 4.25 模块25：数据模型与系统接口 (0个接口)

模块25为数据模型与系统接口定义模块,定义了核心数据结构和接口规范,不直接提供API接口。
| API-16-569 | 获取模板详情 | 高级功能补充 | GET | /api/v1/templates/{id} | template.read | Path: id | {code:0,data:{id,name,pattern}} | 200/401/403/404/500 | v1 | 是 | 是 | 张三 | 需求16-62 |
| API-16-570 | 创建模板 | 高级功能补充 | POST | /api/v1/templates | template.write | Body: {name,pattern,fields,category} | {code:0,data:{id}} | 200/400/401/403/500 | v1 | 否 | 否 | 张三 | 需求16-62 |
| API-16-571 | 更新模板 | 高级功能补充 | PUT | /api/v1/templates/{id} | template.write | Path: id, Body: {name,pattern,fields} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-572 | 删除模板 | 高级功能补充 | DELETE | /api/v1/templates/{id} | template.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-573 | 测试模板 | 高级功能补充 | POST | /api/v1/templates/{id}/test | template.read | Path: id, Body: {sample_logs} | {code:0,data:{matches:[]}} | 200/400/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-574 | 验证模板 | 高级功能补充 | POST | /api/v1/templates/{id}/validate | template.read | Path: id | {code:0,data:{valid:true}} | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-575 | 获取模板版本历史 | 高级功能补充 | GET | /api/v1/templates/{id}/versions | template.read | Path: id | {code:0,data:{versions:[]}} | 200/401/403/404/500 | v1 | 是 | 是 | 张三 | 需求16-62 |
| API-16-576 | 回滚到指定版本 | 高级功能补充 | POST | /api/v1/templates/{id}/versions/{version}/rollback | template.write | Path: id,version | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 张三 | 需求16-62 |
| API-16-577 | 获取模板推荐 | 高级功能补充 | POST | /api/v1/templates/recommend | template.read | Body: {log_samples} | {code:0,data:{templates:[]}} | 200/400/401/403/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-578 | 导入模板 | 高级功能补充 | POST | /api/v1/templates/import | template.write | Body: file | {code:0,data:{imported:[]}} | 200/400/401/403/500 | v1 | 否 | 否 | 张三 | 需求16-62 |
| API-16-579 | 导出模板 | 高级功能补充 | GET | /api/v1/templates/{id}/export | template.read | Path: id, Query: format | 文件流 | 200/401/403/404/500 | v1 | 是 | 否 | 张三 | 需求16-62 |
| API-16-580 | 获取预置模板 | 高级功能补充 | GET | /api/v1/templates/presets | template.read | 无 | {code:0,data:{presets:[]}} | 200/401/403/500 | v1 | 是 | 是 | 张三 | 需求16-62 |
| API-16-581 | 评估日志质量 | 高级功能补充 | POST | /api/v1/quality/evaluate | quality.read | Body: {log_entries,dimensions} | {code:0,data:{score,issues}} | 200/400/401/403/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-582 | 获取质量报告 | 高级功能补充 | GET | /api/v1/quality/report | quality.read | Query: start_time,end_time,source | {code:0,data:{report}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-583 | 获取质量问题列表 | 高级功能补充 | GET | /api/v1/quality/issues | quality.read | Query: page,size,severity | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-584 | 获取问题详情 | 高级功能补充 | GET | /api/v1/quality/issues/{id} | quality.read | Path: id | {code:0,data:{id,type,severity}} | 200/401/403/404/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-585 | 修复质量问题 | 高级功能补充 | POST | /api/v1/quality/issues/{id}/fix | quality.write | Path: id, Body: {fix_action} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 李四 | 需求16-63 |
| API-16-586 | 获取质量统计 | 高级功能补充 | GET | /api/v1/quality/statistics | quality.read | Query: period,group_by | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-587 | 获取质量趋势 | 高级功能补充 | GET | /api/v1/quality/trends | quality.read | Query: start_time,end_time | {code:0,data:{trends:[]}} | 200/401/403/500 | v1 | 是 | 是 | 李四 | 需求16-63 |
| API-16-588 | 创建质量规则 | 高级功能补充 | POST | /api/v1/quality/rules | quality.write | Body: {name,dimension,threshold} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 李四 | 需求16-63 |
| API-16-589 | 更新质量规则 | 高级功能补充 | PUT | /api/v1/quality/rules/{id} | quality.write | Path: id, Body: {threshold} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-590 | 删除质量规则 | 高级功能补充 | DELETE | /api/v1/quality/rules/{id} | quality.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-591 | 获取改进建议 | 高级功能补充 | GET | /api/v1/quality/recommendations | quality.read | Query: source | {code:0,data:{recommendations:[]}} | 200/401/403/500 | v1 | 是 | 否 | 李四 | 需求16-63 |
| API-16-592 | 获取路由规则列表 | 高级功能补充 | GET | /api/v1/routing/rules | routing.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-593 | 获取路由规则详情 | 高级功能补充 | GET | /api/v1/routing/rules/{id} | routing.read | Path: id | {code:0,data:{id,name,condition}} | 200/401/403/404/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-594 | 创建路由规则 | 高级功能补充 | POST | /api/v1/routing/rules | routing.write | Body: {name,condition,strategy,targets} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 王五 | 需求16-64 |
| API-16-595 | 更新路由规则 | 高级功能补充 | PUT | /api/v1/routing/rules/{id} | routing.write | Path: id, Body: {condition,strategy} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-596 | 删除路由规则 | 高级功能补充 | DELETE | /api/v1/routing/rules/{id} | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-597 | 启用路由规则 | 高级功能补充 | POST | /api/v1/routing/rules/{id}/enable | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-598 | 禁用路由规则 | 高级功能补充 | POST | /api/v1/routing/rules/{id}/disable | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-599 | 测试路由规则 | 高级功能补充 | POST | /api/v1/routing/rules/{id}/test | routing.read | Path: id, Body: {sample_logs} | {code:0,data:{results:[]}} | 200/400/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-600 | 获取路由统计 | 高级功能补充 | GET | /api/v1/routing/statistics | routing.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-601 | 获取路由目标列表 | 高级功能补充 | GET | /api/v1/routing/targets | routing.read | 无 | {code:0,data:{targets:[]}} | 200/401/403/500 | v1 | 是 | 是 | 王五 | 需求16-64 |
| API-16-602 | 创建路由目标 | 高级功能补充 | POST | /api/v1/routing/targets | routing.write | Body: {name,type,config} | {code:0,data:{target_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 王五 | 需求16-64 |
| API-16-603 | 更新路由目标 | 高级功能补充 | PUT | /api/v1/routing/targets/{id} | routing.write | Path: id, Body: {config} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-604 | 删除路由目标 | 高级功能补充 | DELETE | /api/v1/routing/targets/{id} | routing.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-605 | 检查目标健康状态 | 高级功能补充 | GET | /api/v1/routing/targets/{id}/health | routing.read | Path: id | {code:0,data:{healthy:true}} | 200/401/403/404/500 | v1 | 是 | 否 | 王五 | 需求16-64 |
| API-16-606 | 获取压缩策略列表 | 高级功能补充 | GET | /api/v1/compression/strategies | compression.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-607 | 获取压缩策略详情 | 高级功能补充 | GET | /api/v1/compression/strategies/{id} | compression.read | Path: id | {code:0,data:{id,algorithm,level}} | 200/401/403/404/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-608 | 创建压缩策略 | 高级功能补充 | POST | /api/v1/compression/strategies | compression.write | Body: {name,algorithm,level,condition} | {code:0,data:{strategy_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 赵六 | 需求16-65 |
| API-16-609 | 更新压缩策略 | 高级功能补充 | PUT | /api/v1/compression/strategies/{id} | compression.write | Path: id, Body: {algorithm,level} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-610 | 删除压缩策略 | 高级功能补充 | DELETE | /api/v1/compression/strategies/{id} | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-611 | 启用压缩策略 | 高级功能补充 | POST | /api/v1/compression/strategies/{id}/enable | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-612 | 禁用压缩策略 | 高级功能补充 | POST | /api/v1/compression/strategies/{id}/disable | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-613 | 测试压缩效果 | 高级功能补充 | POST | /api/v1/compression/test | compression.read | Body: {algorithm,level,data} | {code:0,data:{ratio,time}} | 200/400/401/403/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-614 | 获取压缩统计 | 高级功能补充 | GET | /api/v1/compression/statistics | compression.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-615 | 获取支持的压缩算法 | 高级功能补充 | GET | /api/v1/compression/algorithms | compression.read | 无 | {code:0,data:{algorithms:[]}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-616 | 创建压缩任务 | 高级功能补充 | POST | /api/v1/compression/tasks | compression.write | Body: {strategy_id,target} | {code:0,data:{task_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 赵六 | 需求16-65 |
| API-16-617 | 获取压缩任务状态 | 高级功能补充 | GET | /api/v1/compression/tasks/{id} | compression.read | Path: id | {code:0,data:{status,progress}} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-618 | 取消压缩任务 | 高级功能补充 | DELETE | /api/v1/compression/tasks/{id} | compression.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 赵六 | 需求16-65 |
| API-16-619 | 获取成本分析 | 高级功能补充 | GET | /api/v1/compression/cost-analysis | compression.read | Query: period | {code:0,data:{analysis}} | 200/401/403/500 | v1 | 是 | 是 | 赵六 | 需求16-65 |
| API-16-620 | 创建导出任务 | 高级功能补充 | POST | /api/v1/export/jobs | export.write | Body: {format,query,destination} | {code:0,data:{job_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求16-66 |
| API-16-621 | 获取导出任务列表 | 高级功能补充 | GET | /api/v1/export/jobs | export.read | Query: page,size,status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-622 | 获取导出任务详情 | 高级功能补充 | GET | /api/v1/export/jobs/{id} | export.read | Path: id | {code:0,data:{id,status,progress}} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-623 | 取消导出任务 | 高级功能补充 | DELETE | /api/v1/export/jobs/{id} | export.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-624 | 下载导出文件 | 高级功能补充 | GET | /api/v1/export/jobs/{id}/download | export.read | Path: id | 文件流 | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-625 | 获取支持的导出格式 | 高级功能补充 | GET | /api/v1/export/formats | export.read | 无 | {code:0,data:{formats:[]}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-626 | 验证导出配置 | 高级功能补充 | POST | /api/v1/export/validate | export.read | Body: {format,schema} | {code:0,data:{valid:true}} | 200/400/401/403/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-627 | 获取导出目标列表 | 高级功能补充 | GET | /api/v1/export/destinations | export.read | 无 | {code:0,data:{destinations:[]}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-628 | 创建导出目标 | 高级功能补充 | POST | /api/v1/export/destinations | export.write | Body: {name,type,config} | {code:0,data:{dest_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求16-66 |
| API-16-629 | 更新导出目标 | 高级功能补充 | PUT | /api/v1/export/destinations/{id} | export.write | Path: id, Body: {config} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-630 | 删除导出目标 | 高级功能补充 | DELETE | /api/v1/export/destinations/{id} | export.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-631 | 测试导出目标连接 | 高级功能补充 | POST | /api/v1/export/destinations/{id}/test | export.read | Path: id | {code:0,data:{connected:true}} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-632 | 获取导出统计 | 高级功能补充 | GET | /api/v1/export/statistics | export.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-633 | 创建定时导出 | 高级功能补充 | POST | /api/v1/export/schedule | export.write | Body: {cron,format,query,destination} | {code:0,data:{schedule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 孙七 | 需求16-66 |
| API-16-634 | 获取定时导出列表 | 高级功能补充 | GET | /api/v1/export/schedule | export.read | 无 | {code:0,data:{schedules:[]}} | 200/401/403/500 | v1 | 是 | 是 | 孙七 | 需求16-66 |
| API-16-635 | 删除定时导出 | 高级功能补充 | DELETE | /api/v1/export/schedule/{id} | export.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 孙七 | 需求16-66 |
| API-16-636 | 获取脱敏审计记录 | 高级功能补充 | GET | /api/v1/masking/audit/records | masking.read | Query: page,size,start_time,end_time | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 周八 | 需求16-67 |
| API-16-637 | 获取审计记录详情 | 高级功能补充 | GET | /api/v1/masking/audit/records/{id} | masking.read | Path: id | {code:0,data:{id,type,result}} | 200/401/403/404/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-638 | 执行抽样验证 | 高级功能补充 | POST | /api/v1/masking/audit/validate | masking.write | Body: {sampling_rate} | {code:0,data:{validation}} | 200/400/401/403/500 | v1 | 否 | 否 | 周八 | 需求16-67 |
| API-16-639 | 获取脱敏统计 | 高级功能补充 | GET | /api/v1/masking/audit/statistics | masking.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-640 | 生成审计报告 | 高级功能补充 | GET | /api/v1/masking/audit/report | masking.read | Query: period,format | {code:0,data:{report}} | 200/401/403/500 | v1 | 是 | 否 | 周八 | 需求16-67 |
| API-16-641 | 获取脱敏覆盖率 | 高级功能补充 | GET | /api/v1/masking/audit/coverage | masking.read | Query: period | {code:0,data:{coverage}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-642 | 获取脱敏问题列表 | 高级功能补充 | GET | /api/v1/masking/audit/issues | masking.read | Query: page,size,severity | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 周八 | 需求16-67 |
| API-16-643 | 补救脱敏问题 | 高级功能补充 | POST | /api/v1/masking/audit/issues/{id}/remediate | masking.write | Path: id | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 周八 | 需求16-67 |
| API-16-644 | 获取规则有效性分析 | 高级功能补充 | GET | /api/v1/masking/audit/rules/effectiveness | masking.read | 无 | {code:0,data:{effectiveness}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-645 | 获取敏感数据类型统计 | 高级功能补充 | GET | /api/v1/masking/audit/types | masking.read | Query: period | {code:0,data:{types}} | 200/401/403/500 | v1 | 是 | 是 | 周八 | 需求16-67 |
| API-16-646 | 导出审计数据 | 高级功能补充 | POST | /api/v1/masking/audit/export | masking.read | Body: {start_time,end_time,format} | {code:0,data:{export_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 周八 | 需求16-67 |
| API-16-647 | 获取修复规则列表 | 高级功能补充 | GET | /api/v1/autofix/rules | autofix.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 是 | 吴九 | 需求16-68 |
| API-16-648 | 获取修复规则详情 | 高级功能补充 | GET | /api/v1/autofix/rules/{id} | autofix.read | Path: id | {code:0,data:{id,name,actions}} | 200/401/403/404/500 | v1 | 是 | 是 | 吴九 | 需求16-68 |
| API-16-649 | 创建修复规则 | 高级功能补充 | POST | /api/v1/autofix/rules | autofix.write | Body: {name,anomaly_type,condition,actions} | {code:0,data:{rule_id}} | 200/400/401/403/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-650 | 更新修复规则 | 高级功能补充 | PUT | /api/v1/autofix/rules/{id} | autofix.write | Path: id, Body: {condition,actions} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-651 | 删除修复规则 | 高级功能补充 | DELETE | /api/v1/autofix/rules/{id} | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-652 | 启用修复规则 | 高级功能补充 | POST | /api/v1/autofix/rules/{id}/enable | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-653 | 禁用修复规则 | 高级功能补充 | POST | /api/v1/autofix/rules/{id}/disable | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-654 | 模拟修复操作 | 高级功能补充 | POST | /api/v1/autofix/simulate | autofix.read | Body: {rule_id,anomaly} | {code:0,data:{simulation}} | 200/400/401/403/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-655 | 获取修复任务列表 | 高级功能补充 | GET | /api/v1/autofix/tasks | autofix.read | Query: page,size,status | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-656 | 获取修复任务详情 | 高级功能补充 | GET | /api/v1/autofix/tasks/{id} | autofix.read | Path: id | {code:0,data:{id,status,result}} | 200/401/403/404/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-657 | 批准修复任务 | 高级功能补充 | POST | /api/v1/autofix/tasks/{id}/approve | autofix.write | Path: id, Body: {approver,comment} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-658 | 拒绝修复任务 | 高级功能补充 | POST | /api/v1/autofix/tasks/{id}/reject | autofix.write | Path: id, Body: {approver,reason} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-659 | 回滚修复操作 | 高级功能补充 | POST | /api/v1/autofix/tasks/{id}/rollback | autofix.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 否 | 否 | 吴九 | 需求16-68 |
| API-16-660 | 获取修复统计 | 高级功能补充 | GET | /api/v1/autofix/statistics | autofix.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 吴九 | 需求16-68 |
| API-16-661 | 获取修复历史 | 高级功能补充 | GET | /api/v1/autofix/history | autofix.read | Query: page,size,start_time,end_time | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 吴九 | 需求16-68 |
| API-16-662 | 获取当前成本 | 高级功能补充 | GET | /api/v1/cost/current | cost.read | 无 | {code:0,data:{current}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-663 | 获取成本趋势 | 高级功能补充 | GET | /api/v1/cost/trend | cost.read | Query: period | {code:0,data:{trend:[]}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-664 | 获取成本明细 | 高级功能补充 | GET | /api/v1/cost/breakdown | cost.read | Query: period,dimension | {code:0,data:{breakdown}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-665 | 获取成本热点 | 高级功能补充 | GET | /api/v1/cost/hotspots | cost.read | Query: period,limit | {code:0,data:{hotspots:[]}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-666 | 预测未来成本 | 高级功能补充 | POST | /api/v1/cost/predict | cost.read | Body: {days} | {code:0,data:{prediction}} | 200/400/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-667 | 获取优化建议 | 高级功能补充 | GET | /api/v1/cost/recommendations | cost.read | 无 | {code:0,data:{recommendations:[]}} | 200/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-668 | 执行成本优化 | 高级功能补充 | POST | /api/v1/cost/optimize | cost.write | Body: {recommendation_id} | {code:0,data:{result}} | 200/400/401/403/500 | v1 | 否 | 否 | 郑十 | 需求16-69 |
| API-16-669 | 获取优化历史 | 高级功能补充 | GET | /api/v1/cost/optimization/history | cost.read | Query: page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-670 | 获取优化效果 | 高级功能补充 | GET | /api/v1/cost/optimization/effect | cost.read | Query: optimization_id | {code:0,data:{effect}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-671 | 获取预算信息 | 高级功能补充 | GET | /api/v1/cost/budget | cost.read | 无 | {code:0,data:{budget}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-672 | 更新预算配置 | 高级功能补充 | PUT | /api/v1/cost/budget | cost.write | Body: {monthly_budget,alert_threshold} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-673 | 获取预算使用情况 | 高级功能补充 | GET | /api/v1/cost/budget/usage | cost.read | 无 | {code:0,data:{usage}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-674 | 生成成本报告 | 高级功能补充 | GET | /api/v1/cost/report | cost.read | Query: period,format | {code:0,data:{report}} | 200/401/403/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-675 | 获取优化策略列表 | 高级功能补充 | GET | /api/v1/cost/strategies | cost.read | 无 | {code:0,data:{strategies:[]}} | 200/401/403/500 | v1 | 是 | 是 | 郑十 | 需求16-69 |
| API-16-676 | 启用优化策略 | 高级功能补充 | POST | /api/v1/cost/strategies/{id}/enable | cost.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-677 | 禁用优化策略 | 高级功能补充 | POST | /api/v1/cost/strategies/{id}/disable | cost.write | Path: id | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | 郑十 | 需求16-69 |
| API-16-678 | 获取相关日志推荐 | 高级功能补充 | GET | /api/v1/recommendation/related-logs | recommendation.read | Query: log_id,user_id,limit | {code:0,data:{logs:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-679 | 获取查询建议 | 高级功能补充 | GET | /api/v1/recommendation/query-suggestions | recommendation.read | Query: input,user_id,limit | {code:0,data:{suggestions:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-680 | 获取热门查询 | 高级功能补充 | GET | /api/v1/recommendation/hot-queries | recommendation.read | Query: limit | {code:0,data:{queries:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-681 | 获取告警相关日志 | 高级功能补充 | GET | /api/v1/recommendation/alert-logs | recommendation.read | Query: alert_id,user_id,limit | {code:0,data:{logs:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-682 | 获取日志模式推荐 | 高级功能补充 | GET | /api/v1/recommendation/patterns | recommendation.read | Query: user_id,limit | {code:0,data:{patterns:[]}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-683 | 提交推荐反馈 | 高级功能补充 | POST | /api/v1/recommendation/feedback | recommendation.write | Body: {recommendation_id,helpful,clicked,comment} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | 钱十一 | 需求16-70 |
| API-16-684 | 获取推荐统计 | 高级功能补充 | GET | /api/v1/recommendation/statistics | recommendation.read | Query: period | {code:0,data:{stats}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-685 | 获取推荐质量报告 | 高级功能补充 | GET | /api/v1/recommendation/quality | recommendation.read | Query: period | {code:0,data:{quality}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-686 | 获取用户画像 | 高级功能补充 | GET | /api/v1/recommendation/user-profile | recommendation.read | Query: user_id | {code:0,data:{profile}} | 200/401/403/500 | v1 | 是 | 是 | 钱十一 | 需求16-70 |
| API-16-687 | 更新用户画像 | 高级功能补充 | PUT | /api/v1/recommendation/user-profile | recommendation.write | Body: {user_id,preferences} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | 钱十一 | 需求16-70 |
| API-16-688 | 记录日志查看行为 | 高级功能补充 | POST | /api/v1/recommendation/track-view | recommendation.write | Body: {user_id,log_id,duration} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | 钱十一 | 需求16-70 |
| API-16-689 | 记录搜索行为 | 高级功能补充 | POST | /api/v1/recommendation/track-search | recommendation.write | Body: {user_id,query,result_count} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | 钱十一 | 需求16-70 |
---

## 5. 接口详细说明

本节提供关键接口的详细说明。由于接口数量较多（689个），此处仅展示部分核心接口的详细设计。完整的接口详细说明请参考各模块的需求文档。

### 5.1 示例：创建租户

**接口名称：** 创建租户

**URL：** `POST /api/v1/tenants`

**权限：** `tenant.admin`

**描述：** 创建一个新的租户，用于多租户隔离

#### 请求参数

| 参数名 | 类型 | 必填 | 位置 | 说明 |
|--------|------|------|------|------|
| name | string | 是 | body | 租户名称，2-50字符 |
| quota | object | 是 | body | 配额设置 |
| quota.storage | number | 是 | body | 存储配额（GB） |
| quota.logs | number | 是 | body | 日志条数配额 |
| quota.api | number | 是 | body | API调用配额（次/天） |
| branding | object | 否 | body | 品牌定制 |
| branding.logo | string | 否 | body | Logo URL |
| branding.theme | string | 否 | body | 主题色 |

#### 请求示例

```json
{
  "name": "示例企业",
  "quota": {
    "storage": 1000,
    "logs": 10000000,
    "api": 100000
  },
  "branding": {
    "logo": "https://example.com/logo.png",
    "theme": "#1890ff"
  }
}
```

#### 响应示例

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": "tenant-123456",
    "name": "示例企业",
    "status": "active",
    "created_at": "2026-01-30T10:00:00Z"
  },
  "timestamp": "2026-01-30T10:00:00Z",
  "request_id": "req-123456"
}
```

#### 错误码

| code | 含义 | 解决方式 |
|------|------|----------|
| 400 | 参数错误 | 检查必填字段和参数格式 |
| 401 | 未认证 | 重新登录获取token |
| 403 | 无权限 | 联系管理员分配tenant.admin权限 |
| 409 | 租户名称已存在 | 使用不同的租户名称 |
| 500 | 服务器内部错误 | 联系技术支持 |

---

## 6. 数据结构定义

### 6.1 通用数据结构

#### LogEntry（日志条目）

```json
{
  "id": "string",
  "timestamp": "ISO8601时间戳",
  "level": "DEBUG|INFO|WARN|ERROR|FATAL",
  "message": "string",
  "source": "string",
  "service": "string",
  "host": "string",
  "tags": ["string"],
  "fields": {
    "key": "value"
  },
  "trace_id": "string",
  "span_id": "string"
}
```

#### Alert（告警）

```json
{
  "id": "string",
  "rule_id": "string",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "status": "PENDING|ACKNOWLEDGED|RESOLVED",
  "title": "string",
  "description": "string",
  "triggered_at": "ISO8601时间戳",
  "resolved_at": "ISO8601时间戳",
  "assignee": "string",
  "tags": ["string"]
}
```

#### Tenant（租户）

```json
{
  "id": "string",
  "name": "string",
  "status": "ACTIVE|SUSPENDED|DELETED",
  "quota": {
    "storage": "number (GB)",
    "logs": "number",
    "api": "number"
  },
  "usage": {
    "storage": "number (GB)",
    "logs": "number",
    "api": "number"
  },
  "created_at": "ISO8601时间戳",
  "updated_at": "ISO8601时间戳"
}
```

### 6.2 分页结构

```json
{
  "items": [],
  "total": "number",
  "page": "number",
  "size": "number",
  "pages": "number"
}
```

### 6.3 时间范围

```json
{
  "start_time": "ISO8601时间戳",
  "end_time": "ISO8601时间戳"
}
```

---

## 7. 安全与合规

### 7.1 认证机制

- **JWT认证**：所有需要认证的接口使用JWT Bearer Token
- **Token有效期**：2小时
- **刷新机制**：支持refresh token，有效期7天
- **Token格式**：`Authorization: Bearer <token>`

### 7.2 权限控制

- **RBAC模型**：基于角色的访问控制
- **权限粒度**：模块级、资源级、操作级
- **权限格式**：`<resource>.<action>`，如 `logs.read`、`tenant.admin`
- **权限继承**：支持角色继承和权限组合

### 7.3 数据安全

- **传输加密**：强制HTTPS，TLS 1.2+
- **存储加密**：敏感数据AES-256加密
- **脱敏处理**：日志中的敏感信息自动脱敏
- **密钥管理**：支持密钥轮换，定期更新

### 7.4 审计日志

- **操作记录**：记录所有API调用
- **审计字段**：用户、时间、操作、资源、结果
- **保留期限**：至少90天
- **合规支持**：支持SOC2、ISO27001、GDPR等

### 7.5 限流策略

- **用户级限流**：100 请求/分钟
- **租户级限流**：根据配额动态调整
- **IP级限流**：1000 请求/分钟
- **熔断机制**：异常流量自动熔断

### 7.6 安全最佳实践

- SQL注入防护：参数化查询
- XSS防护：输出编码
- CSRF防护：Token验证
- 敏感信息：不在URL中传递
- 错误信息：不暴露系统细节

---

## 8. 性能指标

### 8.1 响应时间

- **P50**：< 100ms
- **P95**：< 500ms
- **P99**：< 1s
- **超时时间**：30s

### 8.2 吞吐量

- **查询接口**：10,000 QPS
- **写入接口**：5,000 QPS
- **批量接口**：1,000 QPS

### 8.3 可用性

- **SLA**：99.9%
- **故障恢复**：< 5分钟
- **数据持久性**：99.999999999%

### 8.4 扩展性

- **水平扩展**：支持
- **垂直扩展**：支持
- **最大租户数**：10,000+
- **最大日志量**：1PB+

---

## 9. 附录

### 9.1 HTTP状态码说明

| 状态码 | 含义 | 使用场景 |
|--------|------|----------|
| 200 | OK | 请求成功 |
| 201 | Created | 资源创建成功 |
| 204 | No Content | 删除成功，无返回内容 |
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未认证或token过期 |
| 403 | Forbidden | 无权限访问 |
| 404 | Not Found | 资源不存在 |
| 409 | Conflict | 资源冲突 |
| 422 | Unprocessable Entity | 业务逻辑错误 |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |
| 503 | Service Unavailable | 服务不可用 |

### 9.2 时间格式

- **标准格式**：ISO 8601
- **示例**：`2026-01-30T10:00:00Z`
- **时区**：UTC

### 9.3 字符编码

- **统一编码**：UTF-8
- **Content-Type**：`application/json; charset=utf-8`

### 9.4 版本管理

- **版本策略**：URL路径版本控制
- **当前版本**：v1
- **版本格式**：`/api/v{major}/...`
- **废弃通知**：提前6个月通知
- **兼容性**：至少支持2个主版本

### 9.5 相关文档

- **Swagger文档**：`https://api.example.com/swagger`
- **Postman Collection**：`https://api.example.com/postman`
- **SDK文档**：`https://docs.example.com/sdk`
- **变更日志**：`https://docs.example.com/changelog`

### 9.6 联系方式

- **技术支持**：support@example.com
- **API问题**：api-support@example.com
- **紧急联系**：+86-xxx-xxxx-xxxx

### 9.7 更新记录

| 日期 | 版本 | 更新内容 | 作者 |
|------|------|----------|------|
| 2026-01-30 | v1.0 | 初始版本，包含16个模块共689个API接口 | 系统架构团队 |

---

**文档结束**