# 模块7：安全与访问控制 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module7.md](../requirements/requirements-module7.md)

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

### 1.3 相关文档
- [需求文档](../requirements/requirements-module7.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            安全与访问控制模块整体架构                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (安全策略/   │    │ (当前策略)   │    │ (策略变更)   │                           │ │
│  │  │  权限规则)   │    │              │    │              │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            认证层（Authentication）                                    │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  认证网关 (Auth Gateway)                                                     │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ OAuth 2.0    │───▶│ JWT 验证     │───▶│ Session 管理  │                 │     │ │
│  │  │  │ (授权码流程) │    │ (Token)      │    │ (Redis)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  身份提供商集成 (Identity Providers)                                         │     │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │     │ │
│  │  │  │ LDAP/AD      │  │ SAML 2.0     │  │ OIDC         │  │ 本地账户     │   │     │ │
│  │  │  │ (企业目录)   │  │ (单点登录)   │  │ (OpenID)     │  │ (Database)   │   │     │ │
│  │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            授权层（Authorization）                                     │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  RBAC 引擎 (Role-Based Access Control)                                       │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 角色管理     │───▶│ 权限分配     │───▶│ 权限检查     │                 │     │ │
│  │  │  │ (Role)       │    │ (Permission) │    │ (Check)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  ABAC 引擎 (Attribute-Based Access Control)                                  │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 属性提取     │───▶│ 策略评估     │───▶│ 决策引擎     │                 │     │ │
│  │  │  │ (Attribute)  │    │ (Policy)     │    │ (Decision)   │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            加密层（Encryption）                                        │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  数据加密 (Data Encryption)                                                  │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 静态加密     │───▶│ 传输加密     │───▶│ 字段加密     │                 │     │ │
│  │  │  │ (At Rest)    │    │ (In Transit) │    │ (Field)      │                 │     │ │
│  │  │  │ AES-256-GCM  │    │ TLS 1.3      │    │ AES-256      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  密钥管理 (Key Management)                                                   │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ Vault 集成   │───▶│ 密钥轮换     │───▶│ 密钥审计     │                 │     │ │
│  │  │  │ (Storage)    │    │ (Rotation)   │    │ (Audit)      │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            审计层（Audit）                                             │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  审计日志收集 (Audit Log Collection)                                         │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 登录审计     │───▶│ 操作审计     │───▶│ 访问审计     │                 │     │ │
│  │  │  │ (Login)      │    │ (Operation)  │    │ (Access)     │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────┬───────────────────────────────────────┘     │ │
│  │                                        │                                              │ │
│  │                                        ▼                                              │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  审计日志存储与分析 (Audit Storage & Analysis)                               │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ PostgreSQL   │───▶│ Elasticsearch│───▶│ 异常检测     │                 │     │ │
│  │  │  │ (结构化)     │    │ (全文搜索)   │    │ (Anomaly)    │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────┼──────────────────────────────────────────┘ │
│                                           │                                             │
│                                           ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            防护层（Protection）                                        │ │
│  │                                                                                        │ │
│  │  ┌─────────────────────────────────────────────────────────────────────────────┐     │ │
│  │  │  安全防护 (Security Protection)                                              │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ 限流防护     │───▶│ IP 黑白名单  │───▶│ 异常检测     │                 │     │ │
│  │  │  │ (Rate Limit) │    │ (IP Filter)  │    │ (Anomaly)    │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                 │     │ │
│  │  │  │ SQL 注入防护 │───▶│ XSS 防护     │───▶│ CSRF 防护    │                 │     │ │
│  │  │  │ (SQL Inject) │    │ (XSS)        │    │ (CSRF)       │                 │     │ │
│  │  │  └──────────────┘    └──────────────┘    └──────────────┘                 │     │ │
│  │  └─────────────────────────────────────────────────────────────────────────────┘     │ │
│  └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与告警                                              │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                       │ │
│  │  │ 安全事件监控  │    │ 异常行为告警  │    │ 合规性检查   │                       │ │
│  │  │ (Monitor)    │    │ (Alert)      │    │ (Compliance) │                       │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                       │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分

| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 配置中心 | 安全策略管理 | PostgreSQL持久化、Redis缓存、Pub/Sub热更新 |
| 认证层 | 身份验证 | OAuth 2.0、JWT、MFA、Session管理、多身份提供商 |
| 授权层 | 权限控制 | RBAC引擎、ABAC引擎、权限检查、角色继承 |
| 加密层 | 数据保护 | AES-256-GCM加密、TLS 1.3传输、Vault密钥管理、自动轮换 |
| 审计层 | 操作追踪 | 审计日志收集、双写存储、异常检测、报告生成 |
| 防护层 | 安全防护 | 限流、IP过滤、SQL注入防护、XSS/CSRF防护 |

### 2.3 关键路径

**认证路径**:
```
登录请求 → 身份验证(50ms) → MFA验证(100ms) → JWT生成(10ms) → Session创建(20ms)
总延迟: < 200ms
```

**授权路径**:
```
API请求 → JWT验证(5ms) → RBAC检查(3ms) → ABAC评估(2ms) → 业务逻辑
总延迟: < 10ms
```

**加密路径**:
```
数据写入 → 字段加密(15ms) → 数据库存储(10ms)
数据读取 → 数据库查询(10ms) → 字段解密(15ms)
总延迟: < 20ms
```

**审计路径**:
```
操作执行 → 审计记录(5ms) → 异步缓冲 → 批量写入(100ms) → 双写存储
实时性: < 5秒
```

---

## 3. 技术选型

### 3.1 核心技术栈

| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、并发友好、类型安全 |
| OAuth 2.0 | RFC 6749 | 标准授权协议、生态完善 |
| JWT | RFC 7519 | 无状态令牌、易于扩展 |
| PostgreSQL | 15+ | 可靠的关系型数据库、支持JSONB |
| Redis | 7.2+ | 高性能缓存、Pub/Sub支持 |
| HashiCorp Vault | 1.15+ | 专业密钥管理、安全可靠 |
| Elasticsearch | 8.x | 全文搜索、审计日志查询 |
| TLS | 1.3 | 最新传输加密标准 |
| AES-256-GCM | - | FIPS 140-2认证、高安全性 |

### 3.2 认证协议对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| OAuth 2.0 + JWT | 标准协议、无状态、易扩展 | 令牌撤销复杂 | ✅ 采用 |
| Session Cookie | 简单、易撤销 | 有状态、不易扩展 | ❌ 不采用 |
| Basic Auth | 简单 | 不安全、无过期机制 | ❌ 不采用 |

### 3.3 权限模型对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| RBAC | 简单易懂、易管理 | 灵活性有限 | ✅ 采用 |
| ABAC | 灵活、细粒度控制 | 复杂度高 | ✅ 采用 |
| ACL | 简单直接 | 难以维护、扩展性差 | ❌ 不采用 |

**选择策略**: RBAC + ABAC混合模型，RBAC处理常规权限，ABAC处理复杂场景

### 3.4 加密算法对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| AES-256-GCM | 安全性高、性能好、认证加密 | - | ✅ 采用 |
| AES-256-CBC | 成熟稳定 | 需要额外HMAC、易受填充攻击 | ❌ 不采用 |
| ChaCha20-Poly1305 | 性能好 | 硬件加速支持较少 | ❌ 不采用 |

### 3.5 密钥管理对比

| 方案 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| HashiCorp Vault | 专业、功能完善、审计完整 | 需要额外部署 | ✅ 采用 |
| AWS KMS | 云原生、易用 | 厂商锁定、成本高 | ❌ 不采用 |
| 本地文件 | 简单 | 不安全、无审计 | ❌ 不采用 |

---

## 4. 关键流程设计

### 4.1 用户登录流程

**流程步骤**:

```
1. 用户提交登录凭证（用户名/密码）
2. 验证用户凭证（支持多身份提供商）
3. 检查MFA是否启用
4. 如果启用MFA，验证MFA代码
5. 生成JWT访问令牌（有效期1小时）
6. 生成刷新令牌（有效期7天）
7. 创建Session记录到Redis
8. 记录登录审计日志
9. 返回令牌和用户信息
```

**时序图**:

```
用户  前端  API  AuthService  UserStore  MFA  TokenMgr  Redis  AuditLog
 │     │    │        │           │        │      │       │       │
 │─登录→│    │        │           │        │      │       │       │
 │     │─请求→        │           │        │      │       │       │
 │     │    │─验证凭证→           │        │      │       │       │
 │     │    │        │─查询用户──→│        │      │       │       │
 │     │    │        │←─返回用户──│        │      │       │       │
 │     │    │        │─验证密码──→│        │      │       │       │
 │     │    │        │─检查MFA───→│        │      │       │       │
 │     │    │        │←─需要MFA───│        │      │       │       │
 │     │    │        │─验证MFA────────────→│      │       │       │
 │     │    │        │←─验证通过───────────│      │       │       │
 │     │    │        │─生成令牌──────────────────→│       │       │
 │     │    │        │←─返回令牌──────────────────│       │       │
 │     │    │        │─创建Session────────────────────────→       │
 │     │    │        │─记录审计────────────────────────────────────→
 │     │    │←─返回令牌│           │        │      │       │       │
 │     │←─成功│        │           │        │      │       │       │
 │←─显示│    │        │           │        │      │       │       │
```

### 4.2 权限检查流程

**流程步骤**:

```
1. API请求携带JWT令牌
2. 验证JWT签名和有效期
3. 从JWT提取用户ID和角色
4. 检查Session是否有效（Redis）
5. RBAC检查：查询用户角色权限（带缓存）
6. ABAC评估：基于属性动态判断
7. 返回授权结果
8. 记录访问审计日志
```

**时序图**:

```
API  Middleware  TokenMgr  Redis  RBACEngine  ABACEngine  AuditLog
 │       │          │       │        │           │           │
 │─请求─→│          │       │        │           │           │
 │       │─验证JWT─→│       │        │           │           │
 │       │←─用户信息│       │        │           │           │
 │       │─检查Session─────→│        │           │           │
 │       │←─有效────────────│        │           │           │
 │       │─RBAC检查────────────────→│           │           │
 │       │←─权限列表────────────────│           │           │
 │       │─ABAC评估────────────────────────────→│           │
 │       │←─允许/拒绝──────────────────────────│           │
 │       │─记录审计──────────────────────────────────────────→
 │←─继续/拒绝│          │       │        │           │           │
```

### 4.3 数据加密流程

**加密流程**:

```
1. 应用层写入数据
2. 拦截器检查字段加密规则
3. 从Vault获取当前加密密钥（带缓存）
4. 使用AES-256-GCM加密敏感字段
5. 在密文前添加密钥版本标识
6. Base64编码密文
7. 写入数据库
8. 记录加密操作审计日志
```

**解密流程**:

```
1. 应用层读取数据
2. 拦截器检查字段加密规则
3. Base64解码密文
4. 提取密钥版本标识
5. 从Vault获取对应版本密钥
6. 使用AES-256-GCM解密
7. 返回明文数据
8. 记录解密操作审计日志
```

**时序图**:

```
App  Interceptor  FieldEncrypt  KeyMgr  Vault  DB  AuditLog
 │        │            │          │       │     │      │
 │─写入数据→            │          │       │     │      │
 │        │─检查规则───→│          │       │     │      │
 │        │            │─获取密钥─→│       │     │      │
 │        │            │          │─读取─→│     │      │
 │        │            │          │←─密钥─│     │      │
 │        │            │─加密────→│       │     │      │
 │        │            │←─密文────│       │     │      │
 │        │─────────────写入──────────────→     │      │
 │        │─────────────记录审计──────────────────────→│
 │←─完成──│            │          │       │     │      │
```

### 4.4 密钥轮换流程

**流程步骤**:

```
1. 调度器每天检查密钥年龄
2. 如果超过轮换周期（默认90天）
3. 生成新的256位随机密钥
4. 保存新密钥到Vault（版本号+1）
5. 标记旧密钥为"已轮换"状态
6. 保留旧密钥版本（用于解密历史数据）
7. 清除密钥缓存
8. 记录密钥轮换审计日志
9. 发送轮换完成通知
```

**时序图**:

```
Scheduler  KeyMgr  Vault  Cache  AuditLog  Notifier
    │         │      │      │        │         │
    │─检查年龄→│      │      │        │         │
    │         │─获取当前密钥→│        │         │
    │         │←─密钥元数据──│        │         │
    │         │─生成新密钥──→│        │         │
    │         │─保存新密钥──→│        │         │
    │         │─标记旧密钥──→│        │         │
    │         │─清除缓存────────────→│         │
    │         │─记录审计────────────────────→   │
    │         │─发送通知────────────────────────────→│
    │←─完成───│      │      │        │         │
```

### 4.5 审计日志记录流程

**流程步骤**:

```
1. 业务操作触发审计记录
2. 构建审计日志对象（时间戳、用户、操作、资源、结果）
3. 检查审计配置（是否启用、类别过滤）
4. 写入异步缓冲区（非阻塞）
5. 后台协程批量处理（每100条或5秒）
6. 双写PostgreSQL和Elasticsearch
7. 异常检测器分析审计模式
8. 如果检测到异常，触发告警
```

**时序图**:

```
Business  AuditSvc  Buffer  Worker  PG  ES  Detector  Alert
   │         │        │       │     │   │      │        │
   │─操作────→│        │       │     │   │      │        │
   │         │─构建日志│       │     │   │      │        │
   │         │─检查配置│       │     │   │      │        │
   │         │─写缓冲─→│       │     │   │      │        │
   │←─返回───│        │       │     │   │      │        │
   │         │        │       │     │   │      │        │
   │         │        │─定时触发────→│   │      │        │
   │         │        │       │─写入→   │      │        │
   │         │        │       │─写入────→      │        │
   │         │        │       │─检测异常───────→        │
   │         │        │       │        │   │      │─告警→│
```

### 4.6 配置热更新流程

**流程步骤**:

```
1. 管理员通过API修改安全配置
2. 配置保存到PostgreSQL（版本化）
3. 配置同步到Redis
4. Redis发布Pub/Sub通知（config:module7:reload）
5. 各安全服务订阅通知
6. 从Redis加载最新配置
7. 验证配置合法性（必填项、格式、范围）
8. 使用atomic.Value原子更新配置
9. 记录配置变更审计日志
10. 下次操作时使用新配置
```

**时序图**:

```
Admin  API  PostgreSQL  Redis  AuthSvc  EncryptSvc  AuditSvc
  │     │        │        │       │         │          │
  │─修改配置→     │        │       │         │          │
  │     │─保存──→│        │       │         │          │
  │     │─同步──────────→│       │         │          │
  │     │─发布通知───────→│       │         │          │
  │     │        │        │─订阅→│         │          │
  │     │        │        │       │─加载配置→          │
  │     │        │        │       │─验证───→          │
  │     │        │        │       │─原子更新│          │
  │     │        │        │       │         │─订阅────→│
  │     │        │        │       │         │─加载配置→│
  │     │        │        │       │         │─验证────→│
  │     │        │        │       │         │─原子更新─│
  │←─成功│        │        │       │         │          │
```

### 4.7 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| JWT过期 | 返回401，提示刷新令牌 | 使用刷新令牌获取新令牌 |
| MFA验证失败 | 返回401，记录失败次数 | 3次失败后锁定账户15分钟 |
| 权限不足 | 返回403，记录访问尝试 | 管理员授权后重试 |
| Vault不可用 | 使用缓存密钥（10分钟） | 自动重连Vault |
| 加密失败 | 拒绝写入，返回错误 | 检查密钥状态，重试 |
| 审计写入失败 | 记录到本地文件 | 后台重试写入 |
| Session过期 | 返回401，清除前端状态 | 重新登录 |
| 配置验证失败 | 保持原配置，记录错误 | 修正配置后重新发布 |

---

## 5. 接口设计

详见 [API设计文档](./api-design.md) 模块7部分

### 5.1 API列表概览

模块7共提供 **50个API接口**，分为以下类别：

**认证管理** (10个接口):
- API-7-237: 用户登录
- API-7-238: 用户登出
- API-7-239: 刷新令牌
- API-7-240: 验证令牌
- API-7-241: 修改密码
- API-7-242: 重置密码
- API-7-243: 启用MFA
- API-7-244: 禁用MFA
- API-7-245: 验证MFA代码
- API-7-246: 获取TOTP二维码

**用户管理** (5个接口):
- API-7-247: 查询用户列表
- API-7-248: 创建用户
- API-7-249: 获取用户详情
- API-7-250: 更新用户
- API-7-251: 删除用户

**角色管理** (6个接口):
- API-7-252: 查询角色列表
- API-7-253: 创建角色
- API-7-254: 获取角色详情
- API-7-255: 更新角色
- API-7-256: 删除角色
- API-7-257: 分配权限

**权限管理** (3个接口):
- API-7-258: 查询权限列表
- API-7-259: 检查权限
- API-7-260: 获取用户权限

**会话管理** (3个接口):
- API-7-261: 查询会话列表
- API-7-262: 删除会话
- API-7-263: 删除用户所有会话

**加密管理** (7个接口):
- API-7-264: 加密数据
- API-7-265: 解密数据
- API-7-266: 获取密钥列表
- API-7-267: 获取当前密钥
- API-7-268: 轮换密钥
- API-7-269: 获取加密配置
- API-7-270: 更新加密配置

**审计管理** (8个接口):
- API-7-271: 查询审计日志
- API-7-272: 获取审计日志详情
- API-7-273: 导出审计日志
- API-7-274: 生成审计报告
- API-7-275: 获取审计统计
- API-7-276: 获取异常审计
- API-7-277: 获取审计配置
- API-7-278: 更新审计配置

**告警规则管理（支持热更新）** (8个接口):
- API-7-279: 创建告警规则
- API-7-280: 更新告警规则
- API-7-281: 删除告警规则
- API-7-282: 获取告警规则列表
- API-7-283: 获取单个告警规则
- API-7-284: 启用/禁用告警规则
- API-7-285: 验证告警规则表达式
- API-7-286: 获取告警规则历史版本

### 5.2 核心接口示例

**用户登录接口**:

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123",
  "provider": "local",
  "mfa_code": "123456"
}

Response 200:
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 3600,
    "user": {
      "id": "user-001",
      "username": "admin",
      "email": "admin@example.com",
      "display_name": "管理员",
      "roles": ["admin", "operator"]
    }
  }
}
```

**权限检查接口**:

```http
POST /api/v1/permissions/check
Content-Type: application/json
Authorization: Bearer <token>

{
  "resource": "logs",
  "action": "read"
}

Response 200:
{
  "code": 0,
  "message": "权限检查成功",
  "data": {
    "allowed": true,
    "reason": "用户具有 logs:read 权限"
  }
}
```

**加密数据接口**:

```http
POST /api/v1/encryption/encrypt
Content-Type: application/json
Authorization: Bearer <token>

{
  "data": "sensitive information"
}

Response 200:
{
  "code": 0,
  "message": "加密成功",
  "data": {
    "encrypted": "djE6YWJjZGVmZ2hpams..."
  }
}
```

**创建告警规则接口**:

```http
POST /api/v1/alert-rules
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "name": "CustomHighLoginFailure",
  "category": "auth",
  "expression": "rate(auth_login_total{status=\"failure\"}[5m]) > 20",
  "duration": "3m",
  "severity": "critical",
  "labels": {
    "component": "auth",
    "team": "security"
  },
  "annotations": {
    "summary": "自定义登录失败告警",
    "description": "最近5分钟登录失败率超过20次/秒"
  },
  "enabled": true
}

Response 200:
{
  "code": 0,
  "message": "告警规则创建成功",
  "data": {
    "id": "rule-001",
    "name": "CustomHighLoginFailure",
    "version": 1,
    "created_at": "2026-01-31T12:00:00Z"
  }
}
```

**更新告警规则接口**:

```http
PUT /api/v1/alert-rules/rule-001
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "expression": "rate(auth_login_total{status=\"failure\"}[5m]) > 15",
  "duration": "5m",
  "severity": "warning"
}

Response 200:
{
  "code": 0,
  "message": "告警规则更新成功",
  "data": {
    "id": "rule-001",
    "version": 2,
    "updated_at": "2026-01-31T12:30:00Z"
  }
}
```

**验证告警规则表达式接口**:

```http
POST /api/v1/alert-rules/validate
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "expression": "rate(auth_login_total{status=\"failure\"}[5m]) > 10"
}

Response 200:
{
  "code": 0,
  "message": "表达式验证成功",
  "data": {
    "valid": true,
    "metric_type": "gauge",
    "sample_value": 5.2
  }
}
```

---

## 6. 数据设计

### 6.1 数据模型

**用户模型**:

```go
// 用户对象
type User struct {
    ID                string              `json:"id" db:"id"`
    Username          string              `json:"username" db:"username"`
    Email             string              `json:"email" db:"email"`
    DisplayName       string              `json:"display_name" db:"display_name"`
    PasswordHash      string              `json:"-" db:"password_hash"`
    PasswordChangedAt time.Time           `json:"-" db:"password_changed_at"`
    Roles             []string            `json:"roles" db:"-"`
    Attributes        map[string]string   `json:"attributes" db:"attributes"`
    MFAEnabled        bool                `json:"mfa_enabled" db:"mfa_enabled"`
    MFASecret         string              `json:"-" db:"mfa_secret"`
    Status            string              `json:"status" db:"status"` // active/locked/disabled
    LastLoginAt       *time.Time          `json:"last_login_at" db:"last_login_at"`
    FailedLoginCount  int                 `json:"-" db:"failed_login_count"`
    LockedUntil       *time.Time          `json:"-" db:"locked_until"`
    CreatedAt         time.Time           `json:"created_at" db:"created_at"`
    UpdatedAt         time.Time           `json:"updated_at" db:"updated_at"`
}

// 角色对象
type Role struct {
    ID          string    `json:"id" db:"id"`
    Name        string    `json:"name" db:"name"`
    Description string    `json:"description" db:"description"`
    Permissions []string  `json:"permissions" db:"-"`
    ParentRoles []string  `json:"parent_roles" db:"-"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// 权限对象
type Permission struct {
    ID          string `json:"id" db:"id"`
    Resource    string `json:"resource" db:"resource"`
    Action      string `json:"action" db:"action"`
    Description string `json:"description" db:"description"`
}

// 会话对象
type Session struct {
    ID           string    `json:"id"`
    UserID       string    `json:"user_id"`
    AccessToken  string    `json:"-"`
    RefreshToken string    `json:"-"`
    IPAddress    string    `json:"ip_address"`
    UserAgent    string    `json:"user_agent"`
    CreatedAt    time.Time `json:"created_at"`
    ExpiresAt    time.Time `json:"expires_at"`
    LastActiveAt time.Time `json:"last_active_at"`
}

// 审计日志对象
type AuditLog struct {
    ID        string                 `json:"id" db:"id"`
    Timestamp time.Time              `json:"timestamp" db:"timestamp"`
    Category  string                 `json:"category" db:"category"` // auth/data/config/key
    Action    string                 `json:"action" db:"action"`
    UserID    string                 `json:"user_id" db:"user_id"`
    Username  string                 `json:"username" db:"username"`
    Resource  string                 `json:"resource" db:"resource"`
    Result    string                 `json:"result" db:"result"` // success/failure
    ErrorMsg  string                 `json:"error_msg,omitempty" db:"error_msg"`
    IPAddress string                 `json:"ip_address" db:"ip_address"`
    UserAgent string                 `json:"user_agent" db:"user_agent"`
    RequestID string                 `json:"request_id" db:"request_id"`
    Duration  int64                  `json:"duration" db:"duration"` // 毫秒
    Metadata  map[string]interface{} `json:"metadata,omitempty" db:"metadata"`
}
```

### 6.2 数据库设计

**用户表 (users)**:

```sql
CREATE TABLE users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    password_changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    attributes JSONB DEFAULT '{}',
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    last_login_at TIMESTAMP,
    failed_login_count INT DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

**角色表 (roles)**:

```sql
CREATE TABLE roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_name ON roles(name);
```

**权限表 (permissions)**:

```sql
CREATE TABLE permissions (
    id VARCHAR(64) PRIMARY KEY,
    resource VARCHAR(255) NOT NULL,
    action VARCHAR(255) NOT NULL,
    description TEXT,
    UNIQUE(resource, action)
);

CREATE INDEX idx_permissions_resource ON permissions(resource);
```

**用户角色关联表 (user_roles)**:

```sql
CREATE TABLE user_roles (
    user_id VARCHAR(64) NOT NULL,
    role_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

**角色权限关联表 (role_permissions)**:

```sql
CREATE TABLE role_permissions (
    role_id VARCHAR(64) NOT NULL,
    permission_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
```

**角色继承表 (role_inheritance)**:

```sql
CREATE TABLE role_inheritance (
    role_id VARCHAR(64) NOT NULL,
    parent_role_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, parent_role_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

**审计日志表 (audit_logs)**:

```sql
CREATE TABLE audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    timestamp TIMESTAMP NOT NULL,
    category VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    user_id VARCHAR(64),
    username VARCHAR(255),
    resource VARCHAR(255),
    result VARCHAR(20) NOT NULL,
    error_msg TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(64),
    duration BIGINT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_category ON audit_logs(category);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_result ON audit_logs(result);

-- 分区表（按月分区）
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

**密钥元数据表 (encryption_keys)**:

```sql
CREATE TABLE encryption_keys (
    id VARCHAR(64) PRIMARY KEY,
    version INT NOT NULL,
    algorithm VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- active/rotated/revoked
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    rotated_at TIMESTAMP,
    UNIQUE(version)
);

CREATE INDEX idx_encryption_keys_version ON encryption_keys(version DESC);
CREATE INDEX idx_encryption_keys_status ON encryption_keys(status);
```

**配置表 (security_configs)**:

```sql
CREATE TABLE security_configs (
    id VARCHAR(64) PRIMARY KEY,
    module VARCHAR(50) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_value JSONB NOT NULL,
    version INT NOT NULL DEFAULT 1,
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(module, config_key)
);

CREATE INDEX idx_security_configs_module ON security_configs(module);
```

### 6.3 缓存设计

**Redis缓存策略**:

| 缓存Key | 数据类型 | TTL | 说明 |
|---------|---------|-----|------|
| `session:{session_id}` | Hash | 24小时 | 会话信息 |
| `user:{user_id}` | Hash | 1小时 | 用户基本信息 |
| `user:roles:{user_id}` | Set | 5分钟 | 用户角色列表 |
| `role:permissions:{role_id}` | Set | 5分钟 | 角色权限列表 |
| `permission:check:{user_id}:{resource}:{action}` | String | 5分钟 | 权限检查结果 |
| `encryption:key:current` | Hash | 10分钟 | 当前加密密钥 |
| `config:module7:{component}` | Hash | 永久 | 安全配置（手动更新） |
| `mfa:secret:{user_id}` | String | 永久 | MFA密钥 |
| `login:failed:{username}` | String | 15分钟 | 登录失败次数 |

**缓存更新策略**:

- **Write-Through**: 配置变更时同步更新Redis和PostgreSQL
- **Cache-Aside**: 权限检查结果按需加载，5分钟过期
- **Pub/Sub**: 配置变更通过Redis Pub/Sub通知所有服务实例

### 6.4 Elasticsearch索引设计

**审计日志索引**:

```json
{
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "timestamp": { "type": "date" },
      "category": { "type": "keyword" },
      "action": { "type": "keyword" },
      "user_id": { "type": "keyword" },
      "username": { "type": "keyword" },
      "resource": { "type": "keyword" },
      "result": { "type": "keyword" },
      "error_msg": { "type": "text" },
      "ip_address": { "type": "ip" },
      "user_agent": { "type": "text" },
      "request_id": { "type": "keyword" },
      "duration": { "type": "long" },
      "metadata": { "type": "object", "enabled": false }
    }
  },
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "index.lifecycle.name": "audit-logs-policy",
    "index.lifecycle.rollover_alias": "audit-logs"
  }
}
```

**ILM策略**:

```json
{
  "policy": {
    "phases": {
      "hot": {
        "actions": {
          "rollover": {
            "max_size": "50GB",
            "max_age": "30d"
          }
        }
      },
      "warm": {
        "min_age": "30d",
        "actions": {
          "shrink": {
            "number_of_shards": 1
          },
          "forcemerge": {
            "max_num_segments": 1
          }
        }
      },
      "delete": {
        "min_age": "365d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

---

## 7. 安全设计

### 7.1 认证安全

**密码安全**:
- 使用bcrypt算法存储密码哈希（cost=12）
- 密码策略：最小8位、包含大小写字母、数字、特殊字符
- 密码最大使用期限：90天（可配置）
- 密码历史：禁止重复使用最近5个密码

**令牌安全**:
- JWT使用HS256签名算法
- 访问令牌有效期：1小时（可配置）
- 刷新令牌有效期：7天（可配置）
- 令牌包含签发时间、过期时间、用户ID、角色信息
- 支持令牌黑名单（用于强制登出）

**MFA安全**:
- 支持TOTP（Time-based One-Time Password）
- 使用SHA-1算法，6位数字，30秒有效期
- 备用恢复码：10个一次性使用码
- MFA验证失败3次后锁定账户15分钟

**会话安全**:
- Session存储在Redis，支持分布式
- 会话超时：24小时无活动自动过期
- 支持单点登出（删除所有会话）
- 记录会话创建、活动、销毁审计日志

### 7.2 授权安全

**RBAC安全**:
- 最小权限原则：默认无权限，显式授权
- 角色继承：支持多级继承，最多5级
- 权限聚合：自动聚合所有父角色权限
- 权限缓存：5分钟过期，配置变更立即失效

**ABAC安全**:
- 策略隔离：不同租户策略完全隔离
- 策略验证：部署前验证策略语法和逻辑
- 默认拒绝：未匹配任何策略时拒绝访问
- 策略审计：记录所有策略评估结果

### 7.3 数据安全

**静态数据加密**:
- 算法：AES-256-GCM（符合FIPS 140-2）
- 密钥长度：256位
- 认证加密：同时提供机密性和完整性
- 字段级加密：敏感字段（密码、密钥、个人信息）

**传输数据加密**:
- 协议：TLS 1.3
- 禁用：TLS 1.0、TLS 1.1、SSL
- 密码套件：仅允许强加密套件
- 证书验证：强制验证服务器证书

**密钥管理安全**:
- 密钥存储：HashiCorp Vault
- 密钥轮换：自动轮换，默认90天
- 密钥版本：保留最近3个版本
- 密钥访问：所有访问记录审计日志
- 密钥备份：加密备份到对象存储

### 7.4 审计安全

**审计完整性**:
- 双写存储：PostgreSQL + Elasticsearch
- 只追加：审计日志不可修改或删除
- 完整性校验：使用HMAC验证日志完整性
- 防篡改：审计日志表禁止UPDATE和DELETE

**审计覆盖**:
- 认证事件：登录、登出、密码修改、MFA操作
- 授权事件：权限检查、角色变更、策略评估
- 数据事件：敏感数据访问、修改、删除
- 配置事件：安全配置变更、策略更新
- 密钥事件：密钥访问、轮换、备份

**审计保留**:
- 保留期限：至少365天
- 归档策略：超过90天的日志归档到冷存储
- 删除策略：超过保留期限自动删除
- 合规要求：满足SOC 2、ISO 27001要求

### 7.5 防护措施

**限流防护**:
- 算法：令牌桶（Token Bucket）
- 登录限流：每IP每分钟最多5次
- API限流：每用户每秒最多100次
- 全局限流：每秒最多10000次请求

**IP过滤**:
- 黑名单：自动封禁异常IP（1小时）
- 白名单：管理员IP白名单（绕过限流）
- 地理位置：支持按国家/地区过滤

**攻击防护**:
- SQL注入：使用参数化查询，禁止拼接SQL
- XSS防护：输出转义，CSP策略
- CSRF防护：双重Cookie验证，SameSite属性
- 暴力破解：登录失败3次锁定15分钟

### 7.6 合规性

**数据保护**:
- GDPR：支持数据导出、删除、访问权
- CCPA：支持数据披露、删除请求
- 数据分类：敏感数据标记和加密
- 数据脱敏：日志中自动脱敏敏感信息

**安全标准**:
- ISO 27001：信息安全管理体系
- SOC 2 Type II：安全、可用性、机密性
- FIPS 140-2：加密模块安全要求
- OWASP Top 10：防护常见Web安全风险

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 登录延迟 | < 200ms (P95) | 时间戳差值 |
| JWT验证延迟 | < 5ms (P99) | 中间件计时 |
| 权限检查延迟 | < 5ms (P99) | RBAC引擎计时 |
| 加密延迟 | < 20ms (P95) | 加密操作计时 |
| 解密延迟 | < 20ms (P95) | 解密操作计时 |
| 审计写入延迟 | < 5ms (P95) | 异步缓冲 |
| 并发登录 | 1000 TPS | 压力测试 |
| 并发API请求 | 10000 TPS | 压力测试 |

### 8.2 优化策略

**认证优化**:
- JWT无状态验证，无需查询数据库
- Session使用Redis集群，支持高并发
- 密码哈希使用bcrypt，平衡安全性和性能
- MFA验证码缓存，避免重复计算

**授权优化**:
- 权限检查结果缓存5分钟（LRU Cache）
- 角色权限预加载到内存
- RBAC使用位图优化权限检查
- ABAC策略编译为字节码，加速评估

**加密优化**:
- 密钥缓存10分钟，减少Vault访问
- 使用AES-NI硬件加速
- 批量加密/解密操作
- 异步加密，不阻塞主流程

**审计优化**:
- 异步缓冲区，批量写入（每100条或5秒）
- 双写并行执行，不阻塞业务
- Elasticsearch批量索引，提高吞吐
- 审计日志分区表，优化查询性能

**缓存优化**:
- Redis集群模式，支持水平扩展
- 缓存预热，启动时加载热点数据
- 缓存分层：L1内存缓存 + L2 Redis缓存
- 缓存穿透防护：布隆过滤器

### 8.3 容量规划

**用户规模**:
- 支持用户数：100万
- 并发在线用户：10万
- 日活跃用户：50万
- 峰值QPS：10000

**存储容量**:
- 用户数据：100万用户 × 1KB = 1GB
- 审计日志：1000万条/天 × 1KB × 365天 = 3.6TB/年
- 会话数据：10万会话 × 1KB = 100MB
- 配置数据：< 100MB

**计算资源**:
- 认证服务：4核8GB × 3副本
- 授权服务：4核8GB × 3副本
- 加密服务：4核8GB × 3副本
- 审计服务：4核8GB × 3副本

**网络带宽**:
- 入站：100Mbps
- 出站：100Mbps
- 内网：1Gbps

### 8.4 性能测试

**压力测试场景**:

1. **登录压力测试**:
   - 并发用户：1000
   - 持续时间：10分钟
   - 目标TPS：1000
   - 成功率：> 99.9%

2. **API压力测试**:
   - 并发请求：10000
   - 持续时间：30分钟
   - 目标TPS：10000
   - 成功率：> 99.9%

3. **加密压力测试**:
   - 并发加密：1000
   - 数据大小：1KB-10KB
   - 目标延迟：< 20ms (P95)

4. **审计压力测试**:
   - 写入速率：10000条/秒
   - 持续时间：1小时
   - 目标延迟：< 5ms (P95)

**性能基准**:

```bash
# 登录性能测试
ab -n 10000 -c 100 -p login.json -T application/json \
   http://api-server/api/v1/auth/login

# API性能测试
ab -n 100000 -c 1000 -H "Authorization: Bearer <token>" \
   http://api-server/api/v1/users

# 权限检查性能测试
ab -n 100000 -c 1000 -p check.json -T application/json \
   -H "Authorization: Bearer <token>" \
   http://api-server/api/v1/permissions/check
```

---

## 9. 部署方案

### 9.1 部署架构

**Kubernetes部署架构**:

```yaml
┌─────────────────────────────────────────────────────┐
│                   Ingress (Nginx)                   │
│                  TLS Termination                    │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐   ┌────▼────┐   ┌───▼─────┐
    │  Auth   │   │ Encrypt │   │  Audit  │
    │ Service │   │ Service │   │ Service │
    │  (3副本) │   │  (3副本) │   │  (3副本) │
    └────┬────┘   └────┬────┘   └───┬─────┘
         │             │             │
         └─────────────┼─────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
    ┌────▼────┐   ┌────▼────┐   ┌───▼─────┐
    │  Redis  │   │   PG    │   │   ES    │
    │ Cluster │   │ Cluster │   │ Cluster │
    └─────────┘   └─────────┘   └─────────┘
```

**部署清单**:

```yaml
# auth-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: log-management
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: auth-service:v1.0
        ports:
        - containerPort: 8080
        env:
        - name: POSTGRES_HOST
          value: "postgres-service"
        - name: REDIS_HOST
          value: "redis-service"
        - name: VAULT_ADDR
          value: "http://vault:8200"
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
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
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
  namespace: log-management
spec:
  selector:
    app: auth-service
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
```

### 9.2 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| Auth Service | 3 | 2核 | 2GB | - | 认证服务 |
| Encryption Service | 3 | 2核 | 2GB | - | 加密服务 |
| Audit Service | 3 | 2核 | 2GB | - | 审计服务 |
| PostgreSQL | 3 | 4核 | 8GB | 100GB SSD | 主数据库 |
| Redis Cluster | 6 | 2核 | 4GB | 20GB SSD | 缓存集群 |
| Elasticsearch | 3 | 4核 | 16GB | 500GB SSD | 审计日志 |
| Vault | 3 | 2核 | 2GB | 10GB SSD | 密钥管理 |

### 9.3 高可用配置

**服务高可用**:
- 每个服务至少3个副本
- 跨可用区部署（3个AZ）
- 自动故障转移（< 30秒）
- 滚动更新，零停机部署

**数据库高可用**:
- PostgreSQL主从复制（1主2从）
- 自动故障转移（Patroni）
- 同步复制，数据零丢失
- 定时备份（每天凌晨2点）

**Redis高可用**:
- Redis Cluster模式（3主3从）
- 自动分片和故障转移
- 持久化：RDB + AOF
- 哨兵模式监控

**Vault高可用**:
- Raft共识算法（3节点）
- 自动选主和故障转移
- 加密存储后端
- 自动解封（Auto-unseal）

### 9.4 发布策略

**灰度发布**:

```yaml
# 第1阶段：10%流量
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: auth-service
spec:
  hosts:
  - auth-service
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: auth-service
        subset: v2
      weight: 10
    - destination:
        host: auth-service
        subset: v1
      weight: 90

# 第2阶段：50%流量（观察1小时）
# 第3阶段：100%流量（全量发布）
```

**回滚策略**:

```bash
# 快速回滚到上一版本
kubectl rollout undo deployment/auth-service -n log-management

# 回滚到指定版本
kubectl rollout undo deployment/auth-service --to-revision=2 -n log-management

# 查看回滚状态
kubectl rollout status deployment/auth-service -n log-management
```

### 9.5 配置管理

**ConfigMap配置**:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: auth-config
  namespace: log-management
data:
  config.yaml: |
    auth:
      jwt_ttl: 3600
      refresh_ttl: 604800
      mfa_enabled: true
      password_policy:
        min_length: 8
        require_upper: true
        require_lower: true
        require_digit: true
        require_special: true
        max_age_days: 90
```

**Secret配置**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: auth-secrets
  namespace: log-management
type: Opaque
data:
  jwt_secret: <base64-encoded>
  postgres_password: <base64-encoded>
  redis_password: <base64-encoded>
  vault_token: <base64-encoded>
```

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus指标**:

```prometheus
# 认证指标
auth_login_total{status="success|failure",provider="local|ldap|saml|oidc"}
auth_login_duration_seconds{quantile="0.5|0.95|0.99"}
auth_jwt_verify_total{status="success|failure"}
auth_jwt_verify_duration_seconds{quantile="0.95|0.99"}
auth_mfa_verify_total{status="success|failure"}
auth_session_active_total
auth_session_created_total
auth_session_expired_total

# 授权指标
authz_permission_check_total{result="allow|deny"}
authz_permission_check_duration_seconds{quantile="0.95|0.99"}
authz_rbac_cache_hit_total
authz_rbac_cache_miss_total
authz_abac_policy_eval_total{result="allow|deny"}

# 加密指标
encryption_encrypt_total{status="success|failure"}
encryption_encrypt_duration_seconds{quantile="0.95|0.99"}
encryption_decrypt_total{status="success|failure"}
encryption_decrypt_duration_seconds{quantile="0.95|0.99"}
encryption_key_rotation_total
encryption_key_age_days

# 审计指标
audit_log_written_total{category="auth|data|config|key"}
audit_log_write_duration_seconds{quantile="0.95|0.99"}
audit_log_buffer_size
audit_log_buffer_full_total
audit_anomaly_detected_total{rule="login_failure|unusual_time|unusual_location"}

# 系统指标
security_config_reload_total{status="success|failure"}
security_config_version
security_vault_connection_status{status="up|down"}
```

### 10.2 告警规则

**Prometheus告警规则**:

```yaml
groups:
- name: security_alerts
  interval: 30s
  rules:
  # 登录失败率高
  - alert: HighLoginFailureRate
    expr: |
      rate(auth_login_total{status="failure"}[5m]) > 10
    for: 5m
    labels:
      severity: warning
      component: auth
    annotations:
      summary: "登录失败率过高"
      description: "最近5分钟登录失败率超过10次/秒，可能存在暴力破解攻击"
      
  # JWT验证失败率高
  - alert: HighJWTVerifyFailureRate
    expr: |
      rate(auth_jwt_verify_total{status="failure"}[5m]) > 50
    for: 5m
    labels:
      severity: warning
      component: auth
    annotations:
      summary: "JWT验证失败率过高"
      description: "最近5分钟JWT验证失败率超过50次/秒"
      
  # 权限检查延迟高
  - alert: HighPermissionCheckLatency
    expr: |
      histogram_quantile(0.95, 
        rate(authz_permission_check_duration_seconds_bucket[5m])
      ) > 0.01
    for: 5m
    labels:
      severity: warning
      component: authz
    annotations:
      summary: "权限检查延迟过高"
      description: "P95权限检查延迟超过10ms"
      
  # 加密操作失败率高
  - alert: HighEncryptionFailureRate
    expr: |
      rate(encryption_encrypt_total{status="failure"}[5m]) > 1
    for: 5m
    labels:
      severity: critical
      component: encryption
    annotations:
      summary: "加密操作失败率过高"
      description: "最近5分钟加密失败率超过1次/秒，请检查Vault连接"
      
  # 密钥年龄过大
  - alert: EncryptionKeyTooOld
    expr: |
      encryption_key_age_days > 90
    for: 1h
    labels:
      severity: warning
      component: encryption
    annotations:
      summary: "加密密钥需要轮换"
      description: "当前密钥已使用超过90天，建议进行密钥轮换"
      
  # 审计日志缓冲区满
  - alert: AuditLogBufferFull
    expr: |
      rate(audit_log_buffer_full_total[5m]) > 0
    for: 1m
    labels:
      severity: critical
      component: audit
    annotations:
      summary: "审计日志缓冲区已满"
      description: "审计日志缓冲区已满，可能导致日志丢失"
      
  # 检测到异常审计模式
  - alert: AuditAnomalyDetected
    expr: |
      rate(audit_anomaly_detected_total[5m]) > 0
    for: 1m
    labels:
      severity: warning
      component: audit
    annotations:
      summary: "检测到异常审计模式"
      description: "检测到异常审计模式：{{ $labels.rule }}"
      
  # Vault连接断开
  - alert: VaultConnectionDown
    expr: |
      security_vault_connection_status{status="down"} == 1
    for: 1m
    labels:
      severity: critical
      component: encryption
    annotations:
      summary: "Vault连接断开"
      description: "无法连接到Vault，加密服务可能受影响"
      
  # 活跃会话数过高
  - alert: HighActiveSessionCount
    expr: |
      auth_session_active_total > 100000
    for: 5m
    labels:
      severity: warning
      component: auth
    annotations:
      summary: "活跃会话数过高"
      description: "当前活跃会话数超过10万，可能需要扩容"
```

### 10.3 告警规则热更新

**告警规则管理器**:

```go
// 告警规则管理器
type AlertRuleManager struct {
    db              *sql.DB
    redis           *redis.Client
    prometheusURL   string
    rules           atomic.Value  // 存储[]*AlertRule
    mu              sync.RWMutex
}

// 告警规则
type AlertRule struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Category    string                 `json:"category" db:"category"` // auth/authz/encryption/audit
    Expression  string                 `json:"expression" db:"expression"` // PromQL表达式
    Duration    string                 `json:"duration" db:"duration"` // 持续时间，如"5m"
    Severity    string                 `json:"severity" db:"severity"` // critical/warning/info
    Labels      map[string]string      `json:"labels" db:"labels"`
    Annotations map[string]string      `json:"annotations" db:"annotations"`
    Enabled     bool                   `json:"enabled" db:"enabled"`
    Version     int                    `json:"version" db:"version"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

// 初始化告警规则管理器
func NewAlertRuleManager(db *sql.DB, redis *redis.Client, prometheusURL string) *AlertRuleManager {
    arm := &AlertRuleManager{
        db:            db,
        redis:         redis,
        prometheusURL: prometheusURL,
    }
    
    // 从数据库加载规则
    rules, err := arm.loadRulesFromDB()
    if err != nil {
        log.Fatal("加载告警规则失败", "error", err)
    }
    arm.rules.Store(rules)
    
    // 同步到Prometheus
    if err := arm.syncToPrometheus(rules); err != nil {
        log.Error("同步告警规则到Prometheus失败", "error", err)
    }
    
    // 启动规则变更监听
    go arm.watchRuleChanges()
    
    return arm
}

// 监听规则变更
func (arm *AlertRuleManager) watchRuleChanges() {
    pubsub := arm.redis.Subscribe("alert:rules:module7:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        log.Info("收到告警规则变更通知", "message", msg.Payload)
        
        // 从数据库重新加载规则
        newRules, err := arm.loadRulesFromDB()
        if err != nil {
            log.Error("加载告警规则失败", "error", err)
            continue
        }
        
        // 验证规则
        if err := arm.validateRules(newRules); err != nil {
            log.Error("告警规则验证失败", "error", err)
            continue
        }
        
        // 同步到Prometheus
        if err := arm.syncToPrometheus(newRules); err != nil {
            log.Error("同步告警规则失败", "error", err)
            continue
        }
        
        // 原子更新规则
        arm.rules.Store(newRules)
        
        log.Info("告警规则已更新", "count", len(newRules))
    }
}

// 创建告警规则
func (arm *AlertRuleManager) CreateRule(rule *AlertRule) error {
    // 1. 验证规则
    if err := arm.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 保存到数据库
    rule.ID = generateID()
    rule.Version = 1
    rule.CreatedAt = time.Now()
    rule.UpdatedAt = time.Now()
    
    query := `
        INSERT INTO alert_rules (id, name, category, expression, duration, severity, labels, annotations, enabled, version, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `
    
    labelsJSON, _ := json.Marshal(rule.Labels)
    annotationsJSON, _ := json.Marshal(rule.Annotations)
    
    _, err := arm.db.Exec(query,
        rule.ID, rule.Name, rule.Category, rule.Expression, rule.Duration,
        rule.Severity, labelsJSON, annotationsJSON, rule.Enabled,
        rule.Version, rule.CreatedBy, rule.CreatedAt, rule.UpdatedAt)
    
    if err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 3. 发布变更通知
    if err := arm.redis.Publish("alert:rules:module7:reload", "create").Err(); err != nil {
        return fmt.Errorf("发布通知失败: %w", err)
    }
    
    log.Info("告警规则创建成功", "id", rule.ID, "name", rule.Name)
    
    return nil
}

// 更新告警规则
func (arm *AlertRuleManager) UpdateRule(id string, updates *AlertRule) error {
    // 1. 验证规则
    if err := arm.validateRule(updates); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 更新数据库
    updates.UpdatedAt = time.Now()
    
    query := `
        UPDATE alert_rules
        SET name = $1, category = $2, expression = $3, duration = $4,
            severity = $5, labels = $6, annotations = $7, enabled = $8,
            version = version + 1, updated_at = $9
        WHERE id = $10
    `
    
    labelsJSON, _ := json.Marshal(updates.Labels)
    annotationsJSON, _ := json.Marshal(updates.Annotations)
    
    _, err := arm.db.Exec(query,
        updates.Name, updates.Category, updates.Expression, updates.Duration,
        updates.Severity, labelsJSON, annotationsJSON, updates.Enabled,
        updates.UpdatedAt, id)
    
    if err != nil {
        return fmt.Errorf("更新规则失败: %w", err)
    }
    
    // 3. 保存历史版本
    arm.saveRuleHistory(id)
    
    // 4. 发布变更通知
    if err := arm.redis.Publish("alert:rules:module7:reload", "update").Err(); err != nil {
        return fmt.Errorf("发布通知失败: %w", err)
    }
    
    log.Info("告警规则更新成功", "id", id)
    
    return nil
}

// 删除告警规则
func (arm *AlertRuleManager) DeleteRule(id string) error {
    // 1. 删除数据库记录
    query := `DELETE FROM alert_rules WHERE id = $1`
    
    _, err := arm.db.Exec(query, id)
    if err != nil {
        return fmt.Errorf("删除规则失败: %w", err)
    }
    
    // 2. 发布变更通知
    if err := arm.redis.Publish("alert:rules:module7:reload", "delete").Err(); err != nil {
        return fmt.Errorf("发布通知失败: %w", err)
    }
    
    log.Info("告警规则删除成功", "id", id)
    
    return nil
}

// 验证告警规则
func (arm *AlertRuleManager) validateRule(rule *AlertRule) error {
    // 验证必填字段
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    if rule.Expression == "" {
        return fmt.Errorf("PromQL表达式不能为空")
    }
    if rule.Category == "" {
        return fmt.Errorf("规则类别不能为空")
    }
    
    // 验证类别
    validCategories := map[string]bool{
        "auth": true, "authz": true, "encryption": true, "audit": true,
    }
    if !validCategories[rule.Category] {
        return fmt.Errorf("无效的规则类别: %s", rule.Category)
    }
    
    // 验证严重级别
    validSeverities := map[string]bool{
        "critical": true, "warning": true, "info": true,
    }
    if !validSeverities[rule.Severity] {
        return fmt.Errorf("无效的严重级别: %s", rule.Severity)
    }
    
    // 验证PromQL表达式
    if err := arm.validatePromQL(rule.Expression); err != nil {
        return fmt.Errorf("PromQL表达式验证失败: %w", err)
    }
    
    return nil
}

// 验证PromQL表达式
func (arm *AlertRuleManager) validatePromQL(expr string) error {
    // 调用Prometheus API验证表达式
    url := fmt.Sprintf("%s/api/v1/query?query=%s", arm.prometheusURL, url.QueryEscape(expr))
    
    resp, err := http.Get(url)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("PromQL表达式无效")
    }
    
    return nil
}

// 同步到Prometheus
func (arm *AlertRuleManager) syncToPrometheus(rules []*AlertRule) error {
    // 1. 生成Prometheus告警规则YAML
    yamlContent := arm.generatePrometheusRules(rules)
    
    // 2. 写入规则文件
    rulesFile := "/etc/prometheus/rules/module7_alerts.yml"
    if err := ioutil.WriteFile(rulesFile, []byte(yamlContent), 0644); err != nil {
        return fmt.Errorf("写入规则文件失败: %w", err)
    }
    
    // 3. 重载Prometheus配置
    reloadURL := fmt.Sprintf("%s/-/reload", arm.prometheusURL)
    resp, err := http.Post(reloadURL, "application/json", nil)
    if err != nil {
        return fmt.Errorf("重载Prometheus配置失败: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("Prometheus配置重载失败，状态码: %d", resp.StatusCode)
    }
    
    log.Info("告警规则已同步到Prometheus", "count", len(rules))
    
    return nil
}

// 生成Prometheus规则YAML
func (arm *AlertRuleManager) generatePrometheusRules(rules []*AlertRule) string {
    var buf bytes.Buffer
    
    buf.WriteString("groups:\n")
    buf.WriteString("- name: module7_security_alerts\n")
    buf.WriteString("  interval: 30s\n")
    buf.WriteString("  rules:\n")
    
    for _, rule := range rules {
        if !rule.Enabled {
            continue
        }
        
        buf.WriteString(fmt.Sprintf("  - alert: %s\n", rule.Name))
        buf.WriteString(fmt.Sprintf("    expr: |\n      %s\n", rule.Expression))
        
        if rule.Duration != "" {
            buf.WriteString(fmt.Sprintf("    for: %s\n", rule.Duration))
        }
        
        buf.WriteString("    labels:\n")
        buf.WriteString(fmt.Sprintf("      severity: %s\n", rule.Severity))
        buf.WriteString(fmt.Sprintf("      category: %s\n", rule.Category))
        for k, v := range rule.Labels {
            buf.WriteString(fmt.Sprintf("      %s: %s\n", k, v))
        }
        
        buf.WriteString("    annotations:\n")
        for k, v := range rule.Annotations {
            buf.WriteString(fmt.Sprintf("      %s: \"%s\"\n", k, v))
        }
        buf.WriteString("\n")
    }
    
    return buf.String()
}

// 从数据库加载规则
func (arm *AlertRuleManager) loadRulesFromDB() ([]*AlertRule, error) {
    query := `
        SELECT id, name, category, expression, duration, severity, labels, annotations, enabled, version, created_by, created_at, updated_at
        FROM alert_rules
        ORDER BY category, name
    `
    
    rows, err := arm.db.Query(query)
    if err != nil {
        return nil, err
    }
    defer rows.Close()
    
    var rules []*AlertRule
    for rows.Next() {
        var rule AlertRule
        var labelsJSON, annotationsJSON []byte
        
        err := rows.Scan(
            &rule.ID, &rule.Name, &rule.Category, &rule.Expression, &rule.Duration,
            &rule.Severity, &labelsJSON, &annotationsJSON, &rule.Enabled,
            &rule.Version, &rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt,
        )
        if err != nil {
            return nil, err
        }
        
        json.Unmarshal(labelsJSON, &rule.Labels)
        json.Unmarshal(annotationsJSON, &rule.Annotations)
        
        rules = append(rules, &rule)
    }
    
    return rules, nil
}
```

**告警规则数据库表**:

```sql
-- 告警规则表
CREATE TABLE alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    expression TEXT NOT NULL,
    duration VARCHAR(20),
    severity VARCHAR(20) NOT NULL,
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    version INT DEFAULT 1,
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name)
);

CREATE INDEX idx_alert_rules_category ON alert_rules(category);
CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);

-- 告警规则历史表
CREATE TABLE alert_rule_history (
    id VARCHAR(64) PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    expression TEXT NOT NULL,
    duration VARCHAR(20),
    severity VARCHAR(20) NOT NULL,
    labels JSONB DEFAULT '{}',
    annotations JSONB DEFAULT '{}',
    enabled BOOLEAN DEFAULT TRUE,
    version INT NOT NULL,
    created_by VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

CREATE INDEX idx_alert_rule_history_rule_id ON alert_rule_history(rule_id);
CREATE INDEX idx_alert_rule_history_version ON alert_rule_history(version DESC);
```

**告警规则API接口**:

| 接口编号 | 接口名称 | HTTP方法 | 路径 | 说明 |
|---------|---------|----------|------|------|
| API-7-279 | 创建告警规则 | POST | /api/v1/alert-rules | 创建新的告警规则 |
| API-7-280 | 更新告警规则 | PUT | /api/v1/alert-rules/{id} | 更新现有告警规则 |
| API-7-281 | 删除告警规则 | DELETE | /api/v1/alert-rules/{id} | 删除告警规则 |
| API-7-282 | 获取告警规则列表 | GET | /api/v1/alert-rules | 查询所有告警规则 |
| API-7-283 | 获取单个告警规则 | GET | /api/v1/alert-rules/{id} | 获取规则详情 |
| API-7-284 | 启用/禁用告警规则 | PATCH | /api/v1/alert-rules/{id}/toggle | 切换规则状态 |
| API-7-285 | 验证告警规则表达式 | POST | /api/v1/alert-rules/validate | 验证PromQL表达式 |
| API-7-286 | 获取告警规则历史版本 | GET | /api/v1/alert-rules/{id}/history | 查询历史版本 |

**预置告警规则示例**:

```json
{
  "name": "HighLoginFailureRate",
  "category": "auth",
  "expression": "rate(auth_login_total{status=\"failure\"}[5m]) > 10",
  "duration": "5m",
  "severity": "warning",
  "labels": {
    "component": "auth"
  },
  "annotations": {
    "summary": "登录失败率过高",
    "description": "最近5分钟登录失败率超过10次/秒，可能存在暴力破解攻击"
  },
  "enabled": true
}
```

**热更新流程**:

```
1. 用户通过API创建/修改告警规则
2. 规则保存到PostgreSQL（版本化）
3. 发布Redis Pub/Sub通知（alert:rules:module7:reload）
4. AlertRuleManager订阅通知
5. 从数据库重新加载所有规则
6. 验证规则合法性（PromQL语法）
7. 生成Prometheus规则YAML文件
8. 调用Prometheus HTTP API重载配置
9. 原子更新内存中的规则列表
10. 记录规则变更审计日志
```

**热更新验收标准**:

1. ✅ **规则变更后30秒内生效**: Prometheus重载配置延迟< 10秒
2. ✅ **规则无效时保持原规则**: 验证失败时不更新Prometheus
3. ✅ **支持API查询当前规则**: 提供完整的CRUD接口
4. ✅ **记录规则变更审计日志**: 所有变更记录到audit_logs表
5. ✅ **支持规则版本管理**: 保留所有历史版本
6. ✅ **支持自定义告警规则**: 用户可自定义PromQL表达式
7. ✅ **支持规则启用/禁用**: 无需删除即可临时禁用规则

### 10.4 日志规范

**日志级别**:
- **DEBUG**: 详细调试信息（开发环境）
- **INFO**: 正常运行信息（生产环境默认）
- **WARN**: 警告信息（不影响运行）
- **ERROR**: 错误信息（需要关注）
- **FATAL**: 致命错误（程序退出）

**日志格式（JSON）**:

```json
{
  "timestamp": "2026-01-31T12:00:00Z",
  "level": "INFO",
  "component": "auth-service",
  "message": "用户登录成功",
  "user_id": "user-001",
  "username": "admin",
  "ip_address": "192.168.1.100",
  "request_id": "req-12345",
  "duration_ms": 45,
  "metadata": {
    "provider": "local",
    "mfa_enabled": true
  }
}
```

**敏感信息脱敏**:
- 密码：完全隐藏
- 令牌：只显示前8位和后4位
- IP地址：保留前两段
- 邮箱：只显示首字母和域名

### 10.4 运维手册

**日常运维任务**:

1. **健康检查**（每天）:
   ```bash
   # 检查服务状态
   kubectl get pods -n log-management | grep auth
   
   # 检查服务健康
   curl http://auth-service:8080/health
   
   # 检查Vault状态
   vault status
   ```

2. **密钥轮换**（每90天）:
   ```bash
   # 手动触发密钥轮换
   curl -X POST http://auth-service:8080/api/v1/encryption/keys/rotate \
     -H "Authorization: Bearer <admin-token>"
   
   # 验证新密钥
   curl http://auth-service:8080/api/v1/encryption/keys/current \
     -H "Authorization: Bearer <admin-token>"
   ```

3. **审计日志清理**（每月）:
   ```bash
   # 清理超过365天的审计日志
   psql -h postgres -U admin -d logdb -c \
     "DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '365 days';"
   
   # 清理Elasticsearch旧索引
   curl -X DELETE "http://elasticsearch:9200/audit-logs-2025-*"
   ```

4. **配置备份**（每周）:
   ```bash
   # 备份PostgreSQL配置
   pg_dump -h postgres -U admin -d logdb \
     -t security_configs > security_configs_backup.sql
   
   # 备份Vault密钥
   vault operator raft snapshot save vault_backup.snap
   ```

**应急处理**:

1. **密码重置**:
   ```bash
   # 重置用户密码
   psql -h postgres -U admin -d logdb -c \
     "UPDATE users SET password_hash = '<new-hash>', \
      password_changed_at = NOW() WHERE username = 'admin';"
   ```

2. **强制登出**:
   ```bash
   # 删除用户所有会话
   redis-cli -h redis DEL "session:*:user-001"
   ```

3. **解锁账户**:
   ```bash
   # 解锁被锁定的账户
   psql -h postgres -U admin -d logdb -c \
     "UPDATE users SET status = 'active', \
      failed_login_count = 0, locked_until = NULL \
      WHERE username = 'admin';"
   ```

4. **配置回滚**:
   ```bash
   # 回滚到上一版本配置
   psql -h postgres -U admin -d logdb -c \
     "UPDATE security_configs SET config_value = \
      (SELECT config_value FROM security_configs_history \
       WHERE id = '<config-id>' ORDER BY version DESC LIMIT 1 OFFSET 1) \
      WHERE id = '<config-id>';"
   
   # 发布配置更新通知
   redis-cli -h redis PUBLISH "config:module7:reload" "rollback"
   ```

---

## 11. 配置热更新详细设计

### 11.1 配置分层说明

```
┌─────────────────────────────────────────────────────────────┐
│  基础设施层 (Kubernetes + Keycloak + Vault)                 │
│  ❌ 不支持热更新，需要 kubectl apply + 滚动重启              │
│  - Keycloak部署配置、Vault集群配置、资源限制                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  连接层 (基础服务连接)                                       │
│  ⚠️ 不推荐热更新，建议通过YAML文件更新并重启服务             │
│  - PostgreSQL连接、Redis连接、LDAP连接、OAuth2配置          │
│  原因：需要重建连接池和客户端，可能导致认证失败              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  应用层 (业务配置)                                           │
│  ✅ 推荐热更新，通过Redis Pub/Sub立即生效                    │
│  - 会话配置、密码策略、RBAC规则、审计策略、MFA配置          │
└─────────────────────────────────────────────────────────────┘
```

### 11.2 可热更新配置项

### 11.2 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 更新方式 | 生效时间 | 是否推荐热更新 |
|--------|------|--------|------|----------|----------|---------------|
| **认证配置** |
| session_timeout | int | 3600 | 会话超时(秒) | Redis Pub/Sub | 新会话生效 | ✅ 推荐 |
| session_refresh_enabled | bool | true | 是否启用会话刷新 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| access_token_ttl | int | 3600 | 访问令牌有效期(秒) | Redis Pub/Sub | 新令牌生效 | ✅ 推荐 |
| refresh_token_ttl | int | 604800 | 刷新令牌有效期(秒) | Redis Pub/Sub | 新令牌生效 | ✅ 推荐 |
| max_login_attempts | int | 5 | 最大登录尝试次数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| lockout_duration | int | 300 | 账户锁定时长(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| mfa_enabled | bool | false | 是否启用MFA | Redis Pub/Sub | 下次登录 | ✅ 推荐 |
| mfa_required_roles | array | [] | 需要MFA的角色 | Redis Pub/Sub | 下次登录 | ✅ 推荐 |
| **密码策略配置** |
| password_min_length | int | 8 | 密码最小长度 | Redis Pub/Sub | 下次密码修改 | ✅ 推荐 |
| password_require_uppercase | bool | true | 密码需要大写字母 | Redis Pub/Sub | 下次密码修改 | ✅ 推荐 |
| password_require_lowercase | bool | true | 密码需要小写字母 | Redis Pub/Sub | 下次密码修改 | ✅ 推荐 |
| password_require_number | bool | true | 密码需要数字 | Redis Pub/Sub | 下次密码修改 | ✅ 推荐 |
| password_require_special | bool | true | 密码需要特殊字符 | Redis Pub/Sub | 下次密码修改 | ✅ 推荐 |
| password_expiry_days | int | 90 | 密码过期天数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| password_history_count | int | 5 | 密码历史记录数 | Redis Pub/Sub | 下次密码修改 | ✅ 推荐 |
| **授权配置** |
| rbac_rules | array | [] | RBAC规则列表 | Redis Pub/Sub | 下次权限检查 | ✅ 推荐 |
| rbac_cache_ttl | int | 300 | RBAC缓存有效期(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| abac_enabled | bool | true | 是否启用ABAC | Redis Pub/Sub | 立即 | ✅ 推荐 |
| permission_check_timeout | int | 5000 | 权限检查超时(毫秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| role_inheritance_max_depth | int | 5 | 角色继承最大深度 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **审计配置** |
| audit_enabled | bool | true | 是否启用审计 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| audit_retention_days | int | 365 | 审计日志保留天数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| audit_buffer_size | int | 1000 | 审计缓冲区大小 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| audit_flush_interval | int | 5 | 审计刷新间隔(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| audit_anomaly_detection | bool | true | 是否启用异常检测 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| audit_categories | array | ["auth","data","config","key"] | 审计类别 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **加密配置** |
| encryption_enabled | bool | true | 是否启用加密 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| key_rotation_days | int | 90 | 密钥轮换周期(天) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| key_versions | int | 3 | 保留的密钥版本数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| field_encryption_rules | array | [] | 字段加密规则 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **防护配置** |
| rate_limit_enabled | bool | true | 是否启用限流 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| rate_limit_requests | int | 100 | 限流请求数 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| rate_limit_window | int | 60 | 限流时间窗口(秒) | Redis Pub/Sub | 立即 | ✅ 推荐 |
| ip_whitelist | array | [] | IP白名单 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| ip_blacklist | array | [] | IP黑名单 | Redis Pub/Sub | 立即 | ✅ 推荐 |
| **连接配置(不推荐热更新)** |
| postgresql_host | string | "postgres" | PostgreSQL主机 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| postgresql_port | int | 5432 | PostgreSQL端口 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| postgresql_max_connections | int | 100 | 最大连接数 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| redis_address | string | "redis:6379" | Redis地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| ldap_url | string | "" | LDAP服务器地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| oauth2_providers | object | {} | OAuth2提供商配置 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |
| vault_address | string | "" | Vault地址 | YAML + 重启 | 重启后 | ⚠️ 不推荐 |

**不推荐热更新的原因说明**:

1. **PostgreSQL连接配置**:
   - 需要重建数据库连接池
   - 可能导致正在进行的事务失败
   - 建议：通过YAML文件更新并滚动重启

2. **Redis连接配置**:
   - 需要重建Redis客户端连接
   - 可能导致会话数据访问失败
   - 建议：通过YAML文件更新并滚动重启

3. **LDAP/OAuth2连接配置**:
   - 需要重新初始化认证客户端
   - 可能导致正在进行的认证失败
   - 建议：通过YAML文件更新并滚动重启

4. **Vault连接配置**:
   - 需要重新建立Vault连接
   - 可能导致密钥获取失败
   - 建议：通过YAML文件更新并滚动重启

**备用更新方式**:
- 如果Redis不可用，支持通过YAML配置文件更新，需要重启服务
- 配置文件路径: `/etc/security-manager/config.yaml`
- 重启命令: `kubectl rollout restart deployment/auth-service`

### 11.3 热更新实现

由于代码较长，我将其分为多个部分。完整实现请参考模块2的热更新实现模式。

**核心配置管理器**:

```go
// SecurityConfigManager 安全配置管理器
type SecurityConfigManager struct {
    // 使用atomic.Value实现无锁读取
    sessionConfig   atomic.Value  // *SessionConfig
    passwordPolicy  atomic.Value  // *PasswordPolicy
    rbacRules       atomic.Value  // []RBACRule
    auditConfig     atomic.Value  // *AuditConfig
    mfaConfig       atomic.Value  // *MFAConfig
    ipFilterConfig  atomic.Value  // *IPFilterConfig
    rateLimitConfig atomic.Value  // *RateLimitConfig
    encryptionConfig atomic.Value // *EncryptionConfig
    
    db     *PostgreSQL
    redis  *Redis
    pubsub *redis.PubSub
    
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
// SessionConfig 会话配置
type SessionConfig struct {
    Timeout              int       `json:"timeout"`
    RefreshEnabled       bool      `json:"refresh_enabled"`
    MaxConcurrentSessions int      `json:"max_concurrent_sessions"`
    UpdatedAt            time.Time `json:"updated_at"`
}

// PasswordPolicy 密码策略
type PasswordPolicy struct {
    MinLength         int       `json:"min_length"`
    RequireUppercase  bool      `json:"require_uppercase"`
    RequireLowercase  bool      `json:"require_lowercase"`
    RequireNumber     bool      `json:"require_number"`
    RequireSpecial    bool      `json:"require_special"`
    ExpiryDays        int       `json:"expiry_days"`
    HistoryCount      int       `json:"history_count"`
    UpdatedAt         time.Time `json:"updated_at"`
}

// RBACRule RBAC规则
type RBACRule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Enabled     bool                   `json:"enabled"`
    Subject     string                 `json:"subject"`  // user/role/group
    Resource    string                 `json:"resource"`
    Action      string                 `json:"action"`
    Effect      string                 `json:"effect"`   // allow/deny
    Conditions  map[string]interface{} `json:"conditions"`
    Priority    int                    `json:"priority"`
    UpdatedAt   time.Time              `json:"updated_at"`
}
```

**配置热更新流程**:

```go
// Start 启动配置热更新监听
func (scm *SecurityConfigManager) Start(ctx context.Context) error {
    go scm.watchConfigChanges(ctx)
    log.Info("安全配置热更新监听已启动")
    return nil
}

// watchConfigChanges 监听配置变更
func (scm *SecurityConfigManager) watchConfigChanges(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case msg := <-scm.pubsub.Channel():
            scm.handleConfigChange(msg)
        }
    }
}

// handleConfigChange 处理配置变更
func (scm *SecurityConfigManager) handleConfigChange(msg *redis.Message) {
    log.Infof("收到安全配置变更通知: %s", msg.Payload)
    
    var change ConfigChange
    if err := json.Unmarshal([]byte(msg.Payload), &change); err != nil {
        log.Errorf("解析配置变更失败: %v", err)
        return
    }
    
    // 根据配置类型重新加载
    switch change.Type {
    case "session":
        scm.reloadSessionConfig()
    case "password_policy":
        scm.reloadPasswordPolicy()
    case "rbac_rules":
        scm.reloadRBACRules()
    case "audit":
        scm.reloadAuditConfig()
    case "mfa":
        scm.reloadMFAConfig()
    case "ip_filter":
        scm.reloadIPFilterConfig()
    case "rate_limit":
        scm.reloadRateLimitConfig()
    case "encryption":
        scm.reloadEncryptionConfig()
    case "all":
        scm.reloadAllConfig()
    }
}

// reloadSessionConfig 重新加载会话配置
func (scm *SecurityConfigManager) reloadSessionConfig() {
    log.Info("开始重新加载会话配置")
    
    // 1. 从Redis加载配置
    configJSON, err := scm.redis.Get("config:security:session")
    if err != nil {
        log.Errorf("从Redis加载会话配置失败: %v", err)
        return
    }
    
    // 2. 解析配置
    var newConfig SessionConfig
    if err := json.Unmarshal([]byte(configJSON), &newConfig); err != nil {
        log.Errorf("解析会话配置失败: %v", err)
        return
    }
    
    // 3. 验证配置
    if err := scm.validateSessionConfig(&newConfig); err != nil {
        log.Errorf("会话配置验证失败: %v", err)
        return
    }
    
    // 4. 执行配置变更钩子
    oldConfig := scm.GetSessionConfig()
    for _, hook := range scm.configHooks {
        if err := hook.OnConfigChange("session", oldConfig, &newConfig); err != nil {
            log.Errorf("配置钩子执行失败: %s, error: %v", hook.Name(), err)
            return
        }
    }
    
    // 5. 原子更新配置
    scm.sessionConfig.Store(&newConfig)
    
    // 6. 记录审计日志
    scm.logConfigChange("session", &newConfig)
    
    log.Info("会话配置重新加载完成")
}
```

**配置验证**:

```go
// validateSessionConfig 验证会话配置
func (scm *SecurityConfigManager) validateSessionConfig(config *SessionConfig) error {
    if config.Timeout < 60 || config.Timeout > 86400 {
        return fmt.Errorf("会话超时必须在60-86400秒之间")
    }
    if config.MaxConcurrentSessions < 1 || config.MaxConcurrentSessions > 100 {
        return fmt.Errorf("最大并发会话数必须在1-100之间")
    }
    return nil
}

// validatePasswordPolicy 验证密码策略
func (scm *SecurityConfigManager) validatePasswordPolicy(policy *PasswordPolicy) error {
    if policy.MinLength < 6 || policy.MinLength > 128 {
        return fmt.Errorf("密码最小长度必须在6-128之间")
    }
    if policy.ExpiryDays < 0 || policy.ExpiryDays > 365 {
        return fmt.Errorf("密码过期天数必须在0-365之间")
    }
    if policy.HistoryCount < 0 || policy.HistoryCount > 24 {
        return fmt.Errorf("密码历史记录数必须在0-24之间")
    }
    return nil
}

// validateRBACRule 验证RBAC规则
func (scm *SecurityConfigManager) validateRBACRule(rule *RBACRule) error {
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    validSubjects := map[string]bool{"user": true, "role": true, "group": true}
    if !validSubjects[rule.Subject] {
        return fmt.Errorf("无效的主体类型: %s", rule.Subject)
    }
    validEffects := map[string]bool{"allow": true, "deny": true}
    if !validEffects[rule.Effect] {
        return fmt.Errorf("无效的效果类型: %s", rule.Effect)
    }
    return nil
}
```

**配置获取方法（无锁读取）**:

```go
func (scm *SecurityConfigManager) GetSessionConfig() *SessionConfig {
    if config := scm.sessionConfig.Load(); config != nil {
        return config.(*SessionConfig)
    }
    return &SessionConfig{}
}

func (scm *SecurityConfigManager) GetPasswordPolicy() *PasswordPolicy {
    if policy := scm.passwordPolicy.Load(); policy != nil {
        return policy.(*PasswordPolicy)
    }
    return &PasswordPolicy{}
}

func (scm *SecurityConfigManager) GetRBACRules() []RBACRule {
    if rules := scm.rbacRules.Load(); rules != nil {
        return rules.([]RBACRule)
    }
    return []RBACRule{}
}
```

### 11.4 YAML配置文件备用方案

**配置文件结构** (`/etc/security-manager/config.yaml`):

```yaml
# 安全管理器配置文件
# 注意: 此配置文件仅在Redis不可用时使用，需要重启服务生效

# 会话配置 (✅ 支持热更新)
session:
  timeout: 3600  # 会话超时(秒)
  refresh_enabled: true
  max_concurrent_sessions: 5

# 令牌配置 (✅ 支持热更新)
token:
  access_token_ttl: 3600
  refresh_token_ttl: 604800
  jwt_secret: "${JWT_SECRET}"  # 支持环境变量

# 密码策略 (✅ 支持热更新)
password_policy:
  min_length: 8
  require_uppercase: true
  require_lowercase: true
  require_number: true
  require_special: true
  expiry_days: 90
  history_count: 5

# 登录保护 (✅ 支持热更新)
login_protection:
  max_attempts: 5
  lockout_duration: 300

# MFA配置 (✅ 支持热更新)
mfa:
  enabled: false
  required_roles: [admin, security_admin]
  methods: [totp, sms]
  grace_period: 300

# RBAC配置 (✅ 支持热更新)
rbac:
  cache_ttl: 300
  rules:
    - id: "rule-001"
      name: "管理员全部权限"
      enabled: true
      subject: "role"
      resource: "*"
      action: "*"
      effect: "allow"
      priority: 100

# 审计配置 (✅ 支持热更新)
audit:
  enabled: true
  retention_days: 365
  buffer_size: 1000
  flush_interval: 5
  anomaly_detection: true
  categories: [auth, data, config, key]

# 加密配置 (✅ 支持热更新)
encryption:
  enabled: true
  key_rotation_days: 90
  key_versions: 3
  field_encryption_rules:
    - table_name: "users"
      column_name: "password"
      algorithm: "bcrypt"
      enabled: true

# 限流配置 (✅ 支持热更新)
rate_limit:
  enabled: true
  requests: 100
  window: 60

# IP过滤配置 (✅ 支持热更新)
ip_filter:
  enabled: false
  whitelist: ["10.0.0.0/8", "172.16.0.0/12"]
  blacklist: []

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

# LDAP配置 (⚠️ 不推荐热更新)
ldap:
  enabled: false
  url: "ldap://ldap:389"
  bind_dn: "cn=admin,dc=example,dc=com"
  bind_password: "${LDAP_PASSWORD}"

# OAuth2配置 (⚠️ 不推荐热更新)
oauth2:
  google:
    enabled: false
    client_id: "${GOOGLE_CLIENT_ID}"
    client_secret: "${GOOGLE_CLIENT_SECRET}"
  github:
    enabled: false
    client_id: "${GITHUB_CLIENT_ID}"
    client_secret: "${GITHUB_CLIENT_SECRET}"

# Vault配置 (⚠️ 不推荐热更新)
vault:
  address: "http://vault:8200"
  token: "${VAULT_TOKEN}"
  namespace: "log-management"
```

### 11.5 热更新验收标准

1. ✅ **配置变更后3秒内生效**: 通过Redis Pub/Sub实现，延迟< 1秒
2. ✅ **配置无效时保持原配置**: 验证失败时不更新atomic.Value
3. ✅ **支持API查询当前配置**: 提供GET /api/v1/security/config接口
4. ✅ **记录配置变更审计日志**: 所有变更记录到audit_logs表
5. ✅ **密码策略变更不影响现有密码**: 仅在下次密码修改时生效
6. ✅ **RBAC规则变更立即生效**: 下次权限检查时使用新规则
7. ✅ **审计保留天数变更触发清理**: 后台任务自动清理超期日志
8. ✅ **MFA配置变更不影响已登录用户**: 下次登录时生效
9. ✅ **限流配置变更立即生效**: 使用新的限流参数
10. ✅ **IP过滤规则变更立即生效**: 下次请求时检查新规则

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| JWT密钥泄露 | 低 | 高 | 定期轮换密钥、使用Vault存储、访问审计 |
| 密码数据库泄露 | 低 | 高 | 使用bcrypt哈希、数据库加密、访问控制 |
| Vault不可用 | 中 | 高 | 密钥缓存10分钟、Vault高可用部署、自动故障转移 |
| Redis不可用 | 中 | 中 | 降级为直接查询数据库、Redis集群部署 |
| 权限配置错误 | 中 | 中 | 配置验证、灰度发布、快速回滚 |
| 审计日志丢失 | 低 | 中 | 双写存储、异步缓冲、本地备份 |
| MFA设备丢失 | 中 | 低 | 备用恢复码、管理员重置 |
| 性能下降 | 中 | 中 | 缓存优化、限流保护、水平扩展 |
| 配置热更新失败 | 低 | 中 | 配置验证、保持原配置、告警通知 |
| 密钥轮换失败 | 低 | 高 | 保留旧密钥、自动重试、人工介入 |

### 12.2 回滚方案

**配置回滚**:

```bash
# 1. 查询配置历史版本
psql -h postgres -U admin -d logdb -c \
  "SELECT version, updated_at FROM security_configs \
   WHERE module = 'security' ORDER BY version DESC LIMIT 5;"

# 2. 回滚到指定版本
psql -h postgres -U admin -d logdb -c \
  "UPDATE security_configs SET 
   config_value = (SELECT config_value FROM security_configs_history 
                   WHERE version = <target_version>),
   version = version + 1,
   updated_at = NOW()
   WHERE module = 'security' AND config_key = 'main';"

# 3. 同步到Redis
redis-cli -h redis SET "config:module7:main" "$(psql -h postgres -U admin -d logdb -t -c \
  "SELECT config_value FROM security_configs WHERE module = 'security';")"

# 4. 发布更新通知
redis-cli -h redis PUBLISH "config:module7:reload" "rollback"

# 5. 验证回滚结果
curl http://auth-service:8080/api/v1/config \
  -H "Authorization: Bearer <admin-token>"
```

**服务回滚**:

```bash
# 1. 查看部署历史
kubectl rollout history deployment/auth-service -n log-management

# 2. 回滚到上一版本
kubectl rollout undo deployment/auth-service -n log-management

# 3. 回滚到指定版本
kubectl rollout undo deployment/auth-service \
  --to-revision=<revision> -n log-management

# 4. 验证回滚状态
kubectl rollout status deployment/auth-service -n log-management

# 5. 检查Pod状态
kubectl get pods -n log-management -l app=auth-service
```

**数据库回滚**:

```bash
# 1. 停止应用写入
kubectl scale deployment/auth-service --replicas=0 -n log-management

# 2. 恢复数据库备份
pg_restore -h postgres -U admin -d logdb \
  -c security_backup_<timestamp>.dump

# 3. 验证数据完整性
psql -h postgres -U admin -d logdb -c \
  "SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM roles;"

# 4. 重启应用
kubectl scale deployment/auth-service --replicas=3 -n log-management
```

**密钥回滚**:

```bash
# 1. 查看密钥版本历史
vault kv metadata get secret/encryption-key

# 2. 回滚到上一版本
vault kv rollback -version=<version> secret/encryption-key

# 3. 验证密钥版本
vault kv get secret/encryption-key

# 4. 清除密钥缓存
redis-cli -h redis DEL "encryption:key:current"

# 5. 重启加密服务
kubectl rollout restart deployment/encryption-service -n log-management
```

### 12.3 应急预案

**场景1：大量登录失败**

```
1. 确认是否为攻击：检查IP分布、失败模式
2. 启用IP黑名单：封禁异常IP
3. 提高限流阈值：临时降低登录限流
4. 通知安全团队：分析攻击来源
5. 生成安全报告：记录事件详情
```

**场景2：Vault完全不可用**

```
1. 检查Vault集群状态：vault status
2. 尝试自动恢复：重启Vault服务
3. 使用缓存密钥：10分钟内可继续服务
4. 降级为只读模式：禁止加密写入
5. 恢复Vault服务：从备份恢复
6. 验证密钥完整性：测试加密解密
7. 恢复正常服务：解除只读模式
```

**场景3：审计日志丢失**

```
1. 检查缓冲区状态：audit_log_buffer_size
2. 检查存储状态：PostgreSQL和Elasticsearch
3. 从本地备份恢复：/var/log/audit-backup
4. 重放缓冲区日志：重新写入存储
5. 验证日志完整性：对比时间戳
6. 生成事故报告：记录丢失范围
```

**场景4：权限配置错误导致服务不可用**

```
1. 立即回滚配置：使用上一版本
2. 验证服务恢复：测试关键功能
3. 分析错误原因：检查配置差异
4. 修正配置错误：重新验证
5. 灰度发布修正：10% → 50% → 100%
6. 加强配置验证：增加测试用例
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| OAuth 2.0 | 开放授权标准，用于授权第三方应用访问用户资源 |
| JWT | JSON Web Token，一种无状态的令牌格式 |
| RBAC | Role-Based Access Control，基于角色的访问控制 |
| ABAC | Attribute-Based Access Control，基于属性的访问控制 |
| MFA | Multi-Factor Authentication，多因素认证 |
| TOTP | Time-based One-Time Password，基于时间的一次性密码 |
| AES-256-GCM | 高级加密标准，256位密钥，GCM认证加密模式 |
| TLS 1.3 | 传输层安全协议，最新版本 |
| Vault | HashiCorp开发的密钥管理工具 |
| bcrypt | 密码哈希算法，基于Blowfish加密算法 |
| FIPS 140-2 | 美国联邦信息处理标准，加密模块安全要求 |
| GDPR | 欧盟通用数据保护条例 |
| CCPA | 加州消费者隐私法案 |
| SOC 2 | 服务组织控制报告，安全审计标准 |
| ISO 27001 | 信息安全管理体系国际标准 |
| OWASP | 开放Web应用安全项目 |
| LDAP | 轻量级目录访问协议 |
| SAML | 安全断言标记语言，用于单点登录 |
| OIDC | OpenID Connect，基于OAuth 2.0的身份认证层 |

### 13.2 参考文档

**标准规范**:
- [RFC 6749: OAuth 2.0 Authorization Framework](https://tools.ietf.org/html/rfc6749)
- [RFC 7519: JSON Web Token (JWT)](https://tools.ietf.org/html/rfc7519)
- [RFC 8446: TLS 1.3](https://tools.ietf.org/html/rfc8446)
- [FIPS 140-2: Security Requirements for Cryptographic Modules](https://csrc.nist.gov/publications/detail/fips/140/2/final)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

**技术文档**:
- [HashiCorp Vault Documentation](https://www.vaultproject.io/docs)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)
- [Redis Security](https://redis.io/topics/security)
- [Elasticsearch Security](https://www.elastic.co/guide/en/elasticsearch/reference/current/security-settings.html)

**最佳实践**:
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CIS Controls](https://www.cisecurity.org/controls/)
- [SANS Security Policies](https://www.sans.org/information-security-policy/)

**合规指南**:
- [GDPR Compliance Checklist](https://gdpr.eu/checklist/)
- [SOC 2 Compliance Guide](https://www.aicpa.org/interestareas/frc/assuranceadvisoryservices/sorhome.html)
- [ISO 27001 Standard](https://www.iso.org/isoiec-27001-information-security.html)

### 13.3 配置示例

**完整配置示例**:

```yaml
# security-config.yaml
security:
  # 认证配置
  auth:
    jwt_secret: "your-secret-key-here"
    access_token_ttl: 3600
    refresh_token_ttl: 604800
    session_timeout: 86400
    mfa_enabled: true
    password_policy:
      min_length: 8
      require_upper: true
      require_lower: true
      require_digit: true
      require_special: true
      max_age_days: 90
    login_policy:
      max_attempts: 3
      lockout_duration: 900
    identity_providers:
      - name: "local"
        type: "local"
        enabled: true
      - name: "ldap"
        type: "ldap"
        enabled: true
        config:
          host: "ldap.example.com"
          port: 389
          base_dn: "dc=example,dc=com"
  
  # 授权配置
  authz:
    rbac_cache_ttl: 300
    abac_enabled: true
    permission_check_timeout: 5000
    role_inheritance_max_depth: 5
  
  # 加密配置
  encryption:
    enabled: true
    algorithm: "aes-256-gcm"
    key_rotation_days: 90
    key_versions: 3
    vault_address: "http://vault:8200"
    field_encryption_rules:
      - table: "users"
        fields: ["password_hash", "mfa_secret"]
        enabled: true
      - table: "audit_logs"
        fields: ["metadata"]
        enabled: false
  
  # 审计配置
  audit:
    enabled: true
    buffer_size: 1000
    flush_interval: 5
    retention_days: 365
    anomaly_detection: true
    categories:
      - "auth"
      - "data"
      - "config"
      - "key"
  
  # 防护配置
  protection:
    rate_limit_enabled: true
    rate_limit_login: 5
    rate_limit_api: 100
    ip_whitelist: []
    ip_blacklist: []
```

### 13.4 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| - | - | - | - |

---

**文档结束**
