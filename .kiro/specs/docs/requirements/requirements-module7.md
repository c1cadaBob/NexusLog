# 模块七：安全与访问控制

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块七：安全与访问控制 
> **需求编号**: 

---

**模块概述**: 

提供完善的安全机制和访问控制功能，包括身份认证、权限管理、数据加密、审计日志和安全防护。

**模块技术栈**:
- 认证协议：OAuth 2.0 + JWT (标准认证)
- 权限模型：RBAC + ABAC (角色和属性访问控制)
- 加密算法：AES-256-GCM (数据加密)、RSA-2048 (密钥交换)
- 传输安全：TLS 1.3 (传输层加密)
- 密钥管理：HashiCorp Vault (密钥存储)
- 审计日志：PostgreSQL + Elasticsearch (审计存储)
- 配置管理：PostgreSQL + Redis 配置中心（热配置）

**模块架构**:

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

**架构说明**:

1. **配置中心层**: 使用 PostgreSQL 存储安全策略和权限规则，Redis 分发当前生效策略
2. **认证层**: OAuth 2.0 + JWT 认证，支持多种身份提供商（LDAP、SAML、OIDC、本地账户）
3. **授权层**: RBAC + ABAC 混合授权模型，支持角色和属性访问控制
4. **加密层**: 数据静态加密（AES-256-GCM）、传输加密（TLS 1.3）、字段级加密
5. **审计层**: 完整的审计日志收集、存储和分析，支持异常检测
6. **防护层**: 多层安全防护（限流、IP 过滤、SQL 注入、XSS、CSRF）
7. **监控告警层**: 安全事件监控、异常行为告警、合规性检查

**安全能力矩阵**:

| 能力 | 技术方案 | 安全等级 | 性能影响 |
|------|----------|----------|----------|
| 身份认证 | OAuth 2.0 + JWT | 高 | < 10ms |
| 权限控制 | RBAC + ABAC | 高 | < 5ms |
| 数据加密 | AES-256-GCM | 高 | < 20ms |
| 传输加密 | TLS 1.3 | 高 | < 15ms |
| 审计日志 | PostgreSQL + ES | 中 | < 5ms |
| 限流防护 | Token Bucket | 中 | < 1ms |

**数据流向**:

```
请求 → 认证网关 → 授权检查 → 加密处理 → 业务逻辑 → 审计记录
        ↑                                              ↓
        └──────────── 配置中心（热更新）────────────────┘
```

**需求列表**:
- 需求 7-24：身份认证与授权 [MVP]
- 需求 7-25：数据加密 [MVP]
- 需求 7-26：审计日志 [MVP]

---



#### 需求 7-24：身份认证与授权 [MVP]

**用户故事**: 

作为系统管理员，我希望系统提供完善的身份认证和权限控制，以便确保只有授权用户才能访问相应的资源。

**验收标准**:

1. THE Auth_System SHALL 支持 OAuth 2.0 授权码流程，符合 RFC 6749 标准
2. THE Auth_System SHALL 使用 JWT 令牌，令牌有效期可配置（默认 1 小时），支持刷新令牌
3. THE Auth_System SHALL 支持多种身份提供商（LDAP、SAML 2.0、OIDC、本地账户）
4. THE Auth_System SHALL 实现 RBAC 权限模型，支持角色继承和权限聚合
5. THE Auth_System SHALL 实现 ABAC 权限模型，支持基于属性的动态授权
6. THE Auth_System SHALL 支持单点登录（SSO），用户只需登录一次即可访问所有系统
7. THE Auth_System SHALL 支持多因素认证（MFA），提供 TOTP 和短信验证
8. THE Auth_System SHALL 实现会话管理，支持会话超时和强制登出
9. THE Auth_System SHALL 提供权限检查 API，响应时间 < 5ms
10. THE Auth_System SHALL 通过配置中心管理认证配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 认证服务
type AuthService struct {
    userStore      *UserStore           // 用户存储
    tokenManager   *TokenManager        // 令牌管理器
    sessionManager *SessionManager      // 会话管理器
    rbacEngine     *RBACEngine          // RBAC 引擎
    abacEngine     *ABACEngine          // ABAC 引擎
    mfaService     *MFAService          // 多因素认证服务
    config         atomic.Value         // 配置（支持热更新）
    metrics        *AuthMetrics         // 认证指标
}

// 认证配置
type AuthConfig struct {
    JWTSecret          string            // JWT 密钥
    AccessTokenTTL     int               // 访问令牌有效期（秒）
    RefreshTokenTTL    int               // 刷新令牌有效期（秒）
    SessionTimeout     int               // 会话超时（秒）
    MFAEnabled         bool              // 是否启用 MFA
    PasswordPolicy     *PasswordPolicy   // 密码策略
    IdentityProviders  []*IdentityProvider // 身份提供商
}

// 密码策略
type PasswordPolicy struct {
    MinLength      int  // 最小长度
    RequireUpper   bool // 需要大写字母
    RequireLower   bool // 需要小写字母
    RequireDigit   bool // 需要数字
    RequireSpecial bool // 需要特殊字符
    MaxAge         int  // 最大使用天数
}

// 身份提供商
type IdentityProvider struct {
    Type     string                 // 类型：ldap/saml/oidc/local
    Name     string                 // 名称
    Enabled  bool                   // 是否启用
    Config   map[string]interface{} // 配置
}

// 用户对象
type User struct {
    ID          string              `json:"id"`
    Username    string              `json:"username"`
    Email       string              `json:"email"`
    DisplayName string              `json:"display_name"`
    Roles       []string            `json:"roles"`
    Attributes  map[string]string   `json:"attributes"`
    MFAEnabled  bool                `json:"mfa_enabled"`
    CreatedAt   time.Time           `json:"created_at"`
    UpdatedAt   time.Time           `json:"updated_at"`
}

// 登录请求
type LoginRequest struct {
    Username string `json:"username"`
    Password string `json:"password"`
    Provider string `json:"provider"` // 身份提供商
    MFACode  string `json:"mfa_code,omitempty"` // MFA 验证码
}

// 登录响应
type LoginResponse struct {
    AccessToken  string `json:"access_token"`
    RefreshToken string `json:"refresh_token"`
    TokenType    string `json:"token_type"`
    ExpiresIn    int    `json:"expires_in"`
    User         *User  `json:"user"`
}

// 登录
func (as *AuthService) Login(req *LoginRequest) (*LoginResponse, error) {
    // 1. 验证用户凭证
    user, err := as.authenticateUser(req)
    if err != nil {
        return nil, fmt.Errorf("认证失败: %w", err)
    }
    
    // 2. 检查 MFA
    if user.MFAEnabled {
        if req.MFACode == "" {
            return nil, fmt.Errorf("需要 MFA 验证码")
        }
        
        if !as.mfaService.Verify(user.ID, req.MFACode) {
            return nil, fmt.Errorf("MFA 验证失败")
        }
    }
    
    // 3. 生成令牌
    accessToken, err := as.tokenManager.GenerateAccessToken(user)
    if err != nil {
        return nil, fmt.Errorf("生成访问令牌失败: %w", err)
    }
    
    refreshToken, err := as.tokenManager.GenerateRefreshToken(user)
    if err != nil {
        return nil, fmt.Errorf("生成刷新令牌失败: %w", err)
    }
    
    // 4. 创建会话
    session := &Session{
        UserID:       user.ID,
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        CreatedAt:    time.Now(),
        ExpiresAt:    time.Now().Add(time.Duration(as.config.Load().(*AuthConfig).SessionTimeout) * time.Second),
    }
    
    if err := as.sessionManager.CreateSession(session); err != nil {
        log.Warn("创建会话失败", "error", err)
    }
    
    // 5. 记录审计日志
    as.auditLog("login", user.ID, req)
    
    // 6. 返回响应
    config := as.config.Load().(*AuthConfig)
    return &LoginResponse{
        AccessToken:  accessToken,
        RefreshToken: refreshToken,
        TokenType:    "Bearer",
        ExpiresIn:    config.AccessTokenTTL,
        User:         user,
    }, nil
}

// 认证用户
func (as *AuthService) authenticateUser(req *LoginRequest) (*User, error) {
    config := as.config.Load().(*AuthConfig)
    
    // 根据身份提供商类型进行认证
    for _, provider := range config.IdentityProviders {
        if provider.Name == req.Provider && provider.Enabled {
            switch provider.Type {
            case "local":
                return as.authenticateLocal(req.Username, req.Password)
            case "ldap":
                return as.authenticateLDAP(req.Username, req.Password, provider.Config)
            case "saml":
                return as.authenticateSAML(req.Username, req.Password, provider.Config)
            case "oidc":
                return as.authenticateOIDC(req.Username, req.Password, provider.Config)
            }
        }
    }
    
    return nil, fmt.Errorf("不支持的身份提供商: %s", req.Provider)
}

// 本地认证
func (as *AuthService) authenticateLocal(username, password string) (*User, error) {
    // 1. 查询用户
    user, err := as.userStore.GetByUsername(username)
    if err != nil {
        return nil, fmt.Errorf("用户不存在")
    }
    
    // 2. 验证密码
    if !as.verifyPassword(password, user.PasswordHash) {
        return nil, fmt.Errorf("密码错误")
    }
    
    // 3. 检查密码是否过期
    config := as.config.Load().(*AuthConfig)
    if config.PasswordPolicy.MaxAge > 0 {
        daysSinceChange := int(time.Since(user.PasswordChangedAt).Hours() / 24)
        if daysSinceChange > config.PasswordPolicy.MaxAge {
            return nil, fmt.Errorf("密码已过期，请修改密码")
        }
    }
    
    return user, nil
}

// 令牌管理器
type TokenManager struct {
    jwtSecret []byte
    config    atomic.Value
}

// 生成访问令牌
func (tm *TokenManager) GenerateAccessToken(user *User) (string, error) {
    config := tm.config.Load().(*AuthConfig)
    
    // 创建 JWT Claims
    claims := jwt.MapClaims{
        "sub":   user.ID,
        "name":  user.DisplayName,
        "email": user.Email,
        "roles": user.Roles,
        "iat":   time.Now().Unix(),
        "exp":   time.Now().Add(time.Duration(config.AccessTokenTTL) * time.Second).Unix(),
    }
    
    // 生成令牌
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    return token.SignedString(tm.jwtSecret)
}

// 验证令牌
func (tm *TokenManager) VerifyToken(tokenString string) (*jwt.MapClaims, error) {
    // 解析令牌
    token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
        // 验证签名算法
        if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
            return nil, fmt.Errorf("无效的签名算法")
        }
        return tm.jwtSecret, nil
    })
    
    if err != nil {
        return nil, err
    }
    
    // 验证令牌
    if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
        return &claims, nil
    }
    
    return nil, fmt.Errorf("无效的令牌")
}

// RBAC 引擎
type RBACEngine struct {
    roleStore       *RoleStore
    permissionStore *PermissionStore
    cache           *lru.Cache
}

// 角色定义
type Role struct {
    ID          string   `json:"id"`
    Name        string   `json:"name"`
    Description string   `json:"description"`
    Permissions []string `json:"permissions"` // 权限 ID 列表
    ParentRoles []string `json:"parent_roles"` // 父角色 ID 列表（继承）
}

// 权限定义
type Permission struct {
    ID          string `json:"id"`
    Resource    string `json:"resource"` // 资源：logs/dashboards/reports
    Action      string `json:"action"`   // 操作：read/write/delete
    Description string `json:"description"`
}

// 检查权限
func (re *RBACEngine) CheckPermission(userID, resource, action string) (bool, error) {
    // 1. 从缓存获取
    cacheKey := fmt.Sprintf("perm:%s:%s:%s", userID, resource, action)
    if cached, ok := re.cache.Get(cacheKey); ok {
        return cached.(bool), nil
    }
    
    // 2. 获取用户角色
    user, err := re.getUserRoles(userID)
    if err != nil {
        return false, err
    }
    
    // 3. 获取所有权限（包括继承的）
    permissions := re.getAllPermissions(user.Roles)
    
    // 4. 检查权限
    hasPermission := false
    for _, perm := range permissions {
        if perm.Resource == resource && perm.Action == action {
            hasPermission = true
            break
        }
        
        // 支持通配符
        if perm.Resource == "*" || perm.Action == "*" {
            hasPermission = true
            break
        }
    }
    
    // 5. 缓存结果（5 分钟）
    re.cache.Add(cacheKey, hasPermission)
    
    return hasPermission, nil
}

// 获取所有权限（包括继承）
func (re *RBACEngine) getAllPermissions(roleIDs []string) []*Permission {
    var allPermissions []*Permission
    visited := make(map[string]bool)
    
    var collectPermissions func(roleID string)
    collectPermissions = func(roleID string) {
        if visited[roleID] {
            return
        }
        visited[roleID] = true
        
        // 获取角色
        role, err := re.roleStore.Get(roleID)
        if err != nil {
            return
        }
        
        // 添加角色的权限
        for _, permID := range role.Permissions {
            perm, err := re.permissionStore.Get(permID)
            if err != nil {
                continue
            }
            allPermissions = append(allPermissions, perm)
        }
        
        // 递归处理父角色
        for _, parentID := range role.ParentRoles {
            collectPermissions(parentID)
        }
    }
    
    // 收集所有角色的权限
    for _, roleID := range roleIDs {
        collectPermissions(roleID)
    }
    
    return allPermissions
}

// ABAC 引擎
type ABACEngine struct {
    policyStore *PolicyStore
    evaluator   *PolicyEvaluator
}

// ABAC 策略
type ABACPolicy struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Description string                 `json:"description"`
    Rules       []*ABACRule            `json:"rules"`
    Effect      string                 `json:"effect"` // allow/deny
}

// ABAC 规则
type ABACRule struct {
    Subject  map[string]interface{} `json:"subject"`  // 主体属性
    Resource map[string]interface{} `json:"resource"` // 资源属性
    Action   string                 `json:"action"`   // 操作
    Condition string                `json:"condition"` // 条件表达式
}

// 检查权限
func (ae *ABACEngine) CheckPermission(subject, resource map[string]interface{}, action string) (bool, error) {
    // 1. 获取所有策略
    policies, err := ae.policyStore.GetAll()
    if err != nil {
        return false, err
    }
    
    // 2. 评估策略
    for _, policy := range policies {
        for _, rule := range policy.Rules {
            // 检查操作是否匹配
            if rule.Action != action && rule.Action != "*" {
                continue
            }
            
            // 评估规则
            if ae.evaluator.Evaluate(rule, subject, resource) {
                return policy.Effect == "allow", nil
            }
        }
    }
    
    // 默认拒绝
    return false, nil
}

// MFA 服务
type MFAService struct {
    totpGenerator *TOTPGenerator
    smsService    *SMSService
}

// 生成 TOTP 密钥
func (ms *MFAService) GenerateTOTPSecret(userID string) (string, error) {
    return ms.totpGenerator.GenerateSecret(userID)
}

// 验证 TOTP 代码
func (ms *MFAService) Verify(userID, code string) bool {
    secret, err := ms.getTOTPSecret(userID)
    if err != nil {
        return false
    }
    
    return ms.totpGenerator.Verify(secret, code)
}
```

**关键实现点**:

1. 使用 JWT 实现无状态认证，支持访问令牌和刷新令牌
2. 支持多种身份提供商（LDAP、SAML、OIDC、本地账户）
3. 实现 RBAC 权限模型，支持角色继承和权限聚合
4. 实现 ABAC 权限模型，支持基于属性的动态授权
5. 使用 LRU 缓存优化权限检查性能（5 分钟缓存）
6. 支持多因素认证（TOTP 和短信验证）
7. 实现会话管理，支持会话超时和强制登出

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| jwt_secret | string | "" | JWT 密钥 |
| access_token_ttl | int | 3600 | 访问令牌有效期（秒） |
| refresh_token_ttl | int | 604800 | 刷新令牌有效期（秒） |
| session_timeout | int | 86400 | 会话超时（秒） |
| mfa_enabled | bool | false | 是否启用 MFA |
| password_min_length | int | 8 | 密码最小长度 |
| password_max_age | int | 90 | 密码最大使用天数 |
| identity_providers | array | [] | 身份提供商列表 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次认证）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN JWT 密钥变更时，THE System SHALL 使现有令牌失效并通知用户重新登录

---


#### 需求 7-25：数据加密 [MVP]

**用户故事**: 

作为安全工程师，我希望系统对敏感数据进行加密，以便保护数据安全和满足合规要求。

**验收标准**:

1. THE Encryption_System SHALL 使用 AES-256-GCM 算法加密静态数据，符合 FIPS 140-2 标准
2. THE Encryption_System SHALL 使用 TLS 1.3 加密传输数据，禁用 TLS 1.0/1.1
3. THE Encryption_System SHALL 支持字段级加密，对敏感字段（密码、密钥、个人信息）进行加密
4. THE Encryption_System SHALL 集成 HashiCorp Vault 进行密钥管理
5. THE Encryption_System SHALL 支持密钥轮换，自动轮换周期可配置（默认 90 天）
6. THE Encryption_System SHALL 支持密钥版本管理，保留最近 3 个版本
7. THE Encryption_System SHALL 对加密操作进行审计，记录所有密钥访问
8. THE Encryption_System SHALL 提供加密性能监控，加密延迟 < 20ms
9. THE Encryption_System SHALL 支持数据库透明加密（TDE）
10. THE Encryption_System SHALL 通过配置中心管理加密配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 加密服务
type EncryptionService struct {
    vaultClient *vault.Client        // Vault 客户端
    keyManager  *KeyManager          // 密钥管理器
    cipher      *AESGCMCipher        // AES-GCM 加密器
    config      atomic.Value         // 配置（支持热更新）
    metrics     *EncryptionMetrics   // 加密指标
}

// 加密配置
type EncryptionConfig struct {
    Enabled            bool              // 是否启用加密
    Algorithm          string            // 算法：aes-256-gcm
    KeyRotationDays    int               // 密钥轮换周期（天）
    KeyVersions        int               // 保留的密钥版本数
    VaultAddress       string            // Vault 地址
    VaultToken         string            // Vault 令牌
    FieldEncryption    []*FieldEncryptionRule // 字段加密规则
}

// 字段加密规则
type FieldEncryptionRule struct {
    Table   string   // 表名
    Fields  []string // 字段列表
    Enabled bool     // 是否启用
}

// 密钥管理器
type KeyManager struct {
    vaultClient *vault.Client
    cache       *lru.Cache
    config      atomic.Value
}

// 密钥元数据
type KeyMetadata struct {
    ID          string    `json:"id"`
    Version     int       `json:"version"`
    Algorithm   string    `json:"algorithm"`
    CreatedAt   time.Time `json:"created_at"`
    RotatedAt   time.Time `json:"rotated_at,omitempty"`
    Status      string    `json:"status"` // active/rotated/revoked
}

// 获取当前密钥
func (km *KeyManager) GetCurrentKey() ([]byte, *KeyMetadata, error) {
    // 1. 从缓存获取
    cacheKey := "current_key"
    if cached, ok := km.cache.Get(cacheKey); ok {
        entry := cached.(*KeyCacheEntry)
        return entry.Key, entry.Metadata, nil
    }
    
    // 2. 从 Vault 获取
    secret, err := km.vaultClient.Logical().Read("secret/data/encryption-key")
    if err != nil {
        return nil, nil, fmt.Errorf("读取密钥失败: %w", err)
    }
    
    if secret == nil || secret.Data == nil {
        return nil, nil, fmt.Errorf("密钥不存在")
    }
    
    // 3. 解析密钥
    data := secret.Data["data"].(map[string]interface{})
    keyBase64 := data["key"].(string)
    key, err := base64.StdEncoding.DecodeString(keyBase64)
    if err != nil {
        return nil, nil, fmt.Errorf("解码密钥失败: %w", err)
    }
    
    // 4. 解析元数据
    metadata := &KeyMetadata{
        ID:        data["id"].(string),
        Version:   int(data["version"].(float64)),
        Algorithm: data["algorithm"].(string),
        Status:    data["status"].(string),
    }
    
    // 5. 缓存密钥（10 分钟）
    km.cache.Add(cacheKey, &KeyCacheEntry{
        Key:      key,
        Metadata: metadata,
    })
    
    return key, metadata, nil
}

// 密钥缓存条目
type KeyCacheEntry struct {
    Key      []byte
    Metadata *KeyMetadata
}

// 轮换密钥
func (km *KeyManager) RotateKey() error {
    // 1. 生成新密钥
    newKey := make([]byte, 32) // 256 位
    if _, err := rand.Read(newKey); err != nil {
        return fmt.Errorf("生成密钥失败: %w", err)
    }
    
    // 2. 获取当前密钥版本
    _, currentMetadata, err := km.GetCurrentKey()
    if err != nil {
        return err
    }
    
    // 3. 保存新密钥到 Vault
    newVersion := currentMetadata.Version + 1
    newMetadata := &KeyMetadata{
        ID:        generateKeyID(),
        Version:   newVersion,
        Algorithm: "aes-256-gcm",
        CreatedAt: time.Now(),
        Status:    "active",
    }
    
    data := map[string]interface{}{
        "key":       base64.StdEncoding.EncodeToString(newKey),
        "id":        newMetadata.ID,
        "version":   newMetadata.Version,
        "algorithm": newMetadata.Algorithm,
        "status":    newMetadata.Status,
    }
    
    _, err = km.vaultClient.Logical().Write("secret/data/encryption-key", map[string]interface{}{
        "data": data,
    })
    
    if err != nil {
        return fmt.Errorf("保存密钥失败: %w", err)
    }
    
    // 4. 标记旧密钥为已轮换
    currentMetadata.Status = "rotated"
    currentMetadata.RotatedAt = time.Now()
    
    // 5. 保存旧密钥版本
    versionPath := fmt.Sprintf("secret/data/encryption-key-v%d", currentMetadata.Version)
    km.vaultClient.Logical().Write(versionPath, map[string]interface{}{
        "data": map[string]interface{}{
            "key":        base64.StdEncoding.EncodeToString(newKey),
            "id":         currentMetadata.ID,
            "version":    currentMetadata.Version,
            "algorithm":  currentMetadata.Algorithm,
            "status":     currentMetadata.Status,
            "rotated_at": currentMetadata.RotatedAt.Format(time.RFC3339),
        },
    })
    
    // 6. 清除缓存
    km.cache.Remove("current_key")
    
    // 7. 记录审计日志
    km.auditLog("key_rotation", newMetadata)
    
    log.Info("密钥轮换成功", "old_version", currentMetadata.Version, "new_version", newVersion)
    
    return nil
}

// AES-GCM 加密器
type AESGCMCipher struct {
    keyManager *KeyManager
}

// 加密数据
func (ac *AESGCMCipher) Encrypt(plaintext []byte) ([]byte, error) {
    startTime := time.Now()
    
    // 1. 获取当前密钥
    key, metadata, err := ac.keyManager.GetCurrentKey()
    if err != nil {
        return nil, err
    }
    
    // 2. 创建 AES-GCM 加密器
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, fmt.Errorf("创建加密器失败: %w", err)
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, fmt.Errorf("创建 GCM 失败: %w", err)
    }
    
    // 3. 生成随机 nonce
    nonce := make([]byte, gcm.NonceSize())
    if _, err := rand.Read(nonce); err != nil {
        return nil, fmt.Errorf("生成 nonce 失败: %w", err)
    }
    
    // 4. 加密数据
    ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
    
    // 5. 添加密钥版本前缀
    result := append([]byte(fmt.Sprintf("v%d:", metadata.Version)), ciphertext...)
    
    // 6. 记录指标
    ac.recordMetrics("encrypt", time.Since(startTime))
    
    return result, nil
}

// 解密数据
func (ac *AESGCMCipher) Decrypt(ciphertext []byte) ([]byte, error) {
    startTime := time.Now()
    
    // 1. 提取密钥版本
    version, data, err := ac.extractVersion(ciphertext)
    if err != nil {
        return nil, err
    }
    
    // 2. 获取对应版本的密钥
    key, err := ac.keyManager.GetKeyByVersion(version)
    if err != nil {
        return nil, err
    }
    
    // 3. 创建 AES-GCM 解密器
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, fmt.Errorf("创建解密器失败: %w", err)
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, fmt.Errorf("创建 GCM 失败: %w", err)
    }
    
    // 4. 提取 nonce
    nonceSize := gcm.NonceSize()
    if len(data) < nonceSize {
        return nil, fmt.Errorf("密文太短")
    }
    
    nonce, ciphertextData := data[:nonceSize], data[nonceSize:]
    
    // 5. 解密数据
    plaintext, err := gcm.Open(nil, nonce, ciphertextData, nil)
    if err != nil {
        return nil, fmt.Errorf("解密失败: %w", err)
    }
    
    // 6. 记录指标
    ac.recordMetrics("decrypt", time.Since(startTime))
    
    return plaintext, nil
}

// 提取密钥版本
func (ac *AESGCMCipher) extractVersion(data []byte) (int, []byte, error) {
    // 查找版本前缀 "vN:"
    colonIndex := bytes.IndexByte(data, ':')
    if colonIndex == -1 || colonIndex < 2 {
        return 0, nil, fmt.Errorf("无效的密文格式")
    }
    
    versionStr := string(data[1:colonIndex])
    version, err := strconv.Atoi(versionStr)
    if err != nil {
        return 0, nil, fmt.Errorf("无效的版本号: %s", versionStr)
    }
    
    return version, data[colonIndex+1:], nil
}

// 字段加密服务
type FieldEncryptionService struct {
    cipher *AESGCMCipher
    config atomic.Value
}

// 加密字段
func (fes *FieldEncryptionService) EncryptField(table, field string, value interface{}) (interface{}, error) {
    config := fes.config.Load().(*EncryptionConfig)
    
    // 1. 检查是否需要加密
    if !fes.shouldEncrypt(table, field, config) {
        return value, nil
    }
    
    // 2. 转换为字节数组
    var plaintext []byte
    switch v := value.(type) {
    case string:
        plaintext = []byte(v)
    case []byte:
        plaintext = v
    default:
        jsonData, err := json.Marshal(v)
        if err != nil {
            return nil, fmt.Errorf("序列化失败: %w", err)
        }
        plaintext = jsonData
    }
    
    // 3. 加密
    ciphertext, err := fes.cipher.Encrypt(plaintext)
    if err != nil {
        return nil, err
    }
    
    // 4. Base64 编码
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// 解密字段
func (fes *FieldEncryptionService) DecryptField(table, field string, value interface{}) (interface{}, error) {
    config := fes.config.Load().(*EncryptionConfig)
    
    // 1. 检查是否需要解密
    if !fes.shouldEncrypt(table, field, config) {
        return value, nil
    }
    
    // 2. Base64 解码
    valueStr, ok := value.(string)
    if !ok {
        return nil, fmt.Errorf("无效的加密值类型")
    }
    
    ciphertext, err := base64.StdEncoding.DecodeString(valueStr)
    if err != nil {
        return nil, fmt.Errorf("Base64 解码失败: %w", err)
    }
    
    // 3. 解密
    plaintext, err := fes.cipher.Decrypt(ciphertext)
    if err != nil {
        return nil, err
    }
    
    return string(plaintext), nil
}

// 检查是否需要加密
func (fes *FieldEncryptionService) shouldEncrypt(table, field string, config *EncryptionConfig) bool {
    for _, rule := range config.FieldEncryption {
        if rule.Table == table && rule.Enabled {
            for _, f := range rule.Fields {
                if f == field {
                    return true
                }
            }
        }
    }
    return false
}

// 数据库加密拦截器
type EncryptionInterceptor struct {
    fieldEncryption *FieldEncryptionService
}

// 拦截插入操作
func (ei *EncryptionInterceptor) BeforeInsert(table string, data map[string]interface{}) error {
    for field, value := range data {
        encrypted, err := ei.fieldEncryption.EncryptField(table, field, value)
        if err != nil {
            return fmt.Errorf("加密字段失败: %s.%s: %w", table, field, err)
        }
        data[field] = encrypted
    }
    return nil
}

// 拦截查询操作
func (ei *EncryptionInterceptor) AfterQuery(table string, data map[string]interface{}) error {
    for field, value := range data {
        decrypted, err := ei.fieldEncryption.DecryptField(table, field, value)
        if err != nil {
            return fmt.Errorf("解密字段失败: %s.%s: %w", table, field, err)
        }
        data[field] = decrypted
    }
    return nil
}

// 密钥轮换调度器
type KeyRotationScheduler struct {
    keyManager *KeyManager
    config     atomic.Value
}

// 启动调度器
func (krs *KeyRotationScheduler) Start() {
    config := krs.config.Load().(*EncryptionConfig)
    
    // 每天检查一次是否需要轮换
    ticker := time.NewTicker(24 * time.Hour)
    defer ticker.Stop()
    
    for range ticker.C {
        if err := krs.checkAndRotate(); err != nil {
            log.Error("密钥轮换失败", "error", err)
        }
    }
}

// 检查并轮换密钥
func (krs *KeyRotationScheduler) checkAndRotate() error {
    config := krs.config.Load().(*EncryptionConfig)
    
    // 获取当前密钥
    _, metadata, err := krs.keyManager.GetCurrentKey()
    if err != nil {
        return err
    }
    
    // 检查是否需要轮换
    daysSinceCreation := int(time.Since(metadata.CreatedAt).Hours() / 24)
    if daysSinceCreation >= config.KeyRotationDays {
        log.Info("开始密钥轮换", "days_since_creation", daysSinceCreation)
        return krs.keyManager.RotateKey()
    }
    
    return nil
}
```

**关键实现点**:

1. 使用 AES-256-GCM 算法实现数据加密，符合 FIPS 140-2 标准
2. 集成 HashiCorp Vault 进行密钥管理，支持密钥版本控制
3. 实现自动密钥轮换机制，可配置轮换周期
4. 支持字段级加密，通过拦截器自动加密/解密数据库字段
5. 在密文中包含密钥版本信息，支持使用旧密钥解密历史数据
6. 使用 LRU 缓存优化密钥获取性能（10 分钟缓存）
7. 记录所有加密操作的性能指标和审计日志

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | bool | true | 是否启用加密 |
| algorithm | string | "aes-256-gcm" | 加密算法 |
| key_rotation_days | int | 90 | 密钥轮换周期（天） |
| key_versions | int | 3 | 保留的密钥版本数 |
| vault_address | string | "" | Vault 地址 |
| field_encryption | array | [] | 字段加密规则 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次加密操作）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 字段加密规则变更时，THE System SHALL 不影响已加密的历史数据

---


#### 需求 7-26：审计日志 [MVP]

**用户故事**: 

作为合规审计员，我希望系统记录所有关键操作的审计日志，以便进行安全审计和合规检查。

**验收标准**:

1. THE Audit_System SHALL 记录所有用户登录、登出、权限变更操作
2. THE Audit_System SHALL 记录所有数据访问、修改、删除操作
3. THE Audit_System SHALL 记录所有配置变更操作
4. THE Audit_System SHALL 记录所有密钥访问和轮换操作
5. THE Audit_Log SHALL 包含时间戳、用户 ID、操作类型、资源、结果、IP 地址、User-Agent
6. THE Audit_System SHALL 将审计日志存储到 PostgreSQL 和 Elasticsearch，保留至少 1 年
7. THE Audit_System SHALL 支持审计日志查询和导出，查询响应时间 < 2 秒
8. THE Audit_System SHALL 检测异常审计模式（如频繁失败登录、异常时间访问），准确率 ≥ 85%
9. THE Audit_System SHALL 生成审计报告，支持按时间、用户、操作类型统计
10. THE Audit_System SHALL 通过配置中心管理审计配置，支持热更新

**实现方向**:

**实现方式**:

```go
// 审计服务
type AuditService struct {
    pgClient   *sql.DB
    esClient   *elasticsearch.Client
    detector   *AnomalyDetector      // 异常检测器
    config     atomic.Value          // 配置（支持热更新）
    metrics    *AuditMetrics         // 审计指标
    buffer     chan *AuditLog        // 异步缓冲区
}

// 审计配置
type AuditConfig struct {
    Enabled          bool              // 是否启用审计
    BufferSize       int               // 缓冲区大小
    FlushInterval    int               // 刷新间隔（秒）
    RetentionDays    int               // 保留天数
    AnomalyDetection bool              // 是否启用异常检测
    Categories       []string          // 审计类别
}

// 审计日志
type AuditLog struct {
    ID          string                 `json:"id"`
    Timestamp   time.Time              `json:"timestamp"`
    Category    string                 `json:"category"` // auth/data/config/key
    Action      string                 `json:"action"`   // login/read/update/rotate
    UserID      string                 `json:"user_id"`
    Username    string                 `json:"username"`
    Resource    string                 `json:"resource"` // 资源标识
    Result      string                 `json:"result"`   // success/failure
    ErrorMsg    string                 `json:"error_msg,omitempty"`
    IPAddress   string                 `json:"ip_address"`
    UserAgent   string                 `json:"user_agent"`
    RequestID   string                 `json:"request_id"`
    Duration    int64                  `json:"duration"` // 毫秒
    Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// 记录审计日志
func (as *AuditService) Log(log *AuditLog) error {
    config := as.config.Load().(*AuditConfig)
    
    // 1. 检查是否启用
    if !config.Enabled {
        return nil
    }
    
    // 2. 检查类别是否启用
    if !as.isCategoryEnabled(log.Category, config) {
        return nil
    }
    
    // 3. 填充默认值
    if log.ID == "" {
        log.ID = generateID()
    }
    if log.Timestamp.IsZero() {
        log.Timestamp = time.Now()
    }
    
    // 4. 异步写入缓冲区
    select {
    case as.buffer <- log:
        return nil
    default:
        // 缓冲区满，同步写入
        return as.writeLog(log)
    }
}

// 启动审计服务
func (as *AuditService) Start() {
    config := as.config.Load().(*AuditConfig)
    
    // 启动刷新协程
    go as.flushWorker(config.FlushInterval)
    
    // 启动异常检测协程
    if config.AnomalyDetection {
        go as.anomalyDetectionWorker()
    }
}

// 刷新工作协程
func (as *AuditService) flushWorker(interval int) {
    ticker := time.NewTicker(time.Duration(interval) * time.Second)
    defer ticker.Stop()
    
    batch := make([]*AuditLog, 0, 100)
    
    for {
        select {
        case log := <-as.buffer:
            batch = append(batch, log)
            
            // 批量写入
            if len(batch) >= 100 {
                as.writeBatch(batch)
                batch = batch[:0]
            }
            
        case <-ticker.C:
            // 定时刷新
            if len(batch) > 0 {
                as.writeBatch(batch)
                batch = batch[:0]
            }
        }
    }
}

// 写入单条日志
func (as *AuditService) writeLog(log *AuditLog) error {
    // 1. 写入 PostgreSQL
    query := `
        INSERT INTO audit_logs (id, timestamp, category, action, user_id, username, resource, result, error_msg, ip_address, user_agent, request_id, duration, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `
    
    metadataJSON, _ := json.Marshal(log.Metadata)
    
    _, err := as.pgClient.Exec(query,
        log.ID,
        log.Timestamp,
        log.Category,
        log.Action,
        log.UserID,
        log.Username,
        log.Resource,
        log.Result,
        log.ErrorMsg,
        log.IPAddress,
        log.UserAgent,
        log.RequestID,
        log.Duration,
        metadataJSON,
    )
    
    if err != nil {
        log.Error("写入 PostgreSQL 失败", "error", err)
    }
    
    // 2. 写入 Elasticsearch
    jsonData, _ := json.Marshal(log)
    _, err = as.esClient.Index(
        "audit-logs",
        bytes.NewReader(jsonData),
        as.esClient.Index.WithDocumentID(log.ID),
    )
    
    if err != nil {
        log.Error("写入 Elasticsearch 失败", "error", err)
    }
    
    return err
}

// 批量写入日志
func (as *AuditService) writeBatch(logs []*AuditLog) error {
    if len(logs) == 0 {
        return nil
    }
    
    // 1. 批量写入 PostgreSQL
    tx, err := as.pgClient.Begin()
    if err != nil {
        return err
    }
    defer tx.Rollback()
    
    stmt, err := tx.Prepare(`
        INSERT INTO audit_logs (id, timestamp, category, action, user_id, username, resource, result, error_msg, ip_address, user_agent, request_id, duration, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `)
    if err != nil {
        return err
    }
    defer stmt.Close()
    
    for _, log := range logs {
        metadataJSON, _ := json.Marshal(log.Metadata)
        _, err := stmt.Exec(
            log.ID,
            log.Timestamp,
            log.Category,
            log.Action,
            log.UserID,
            log.Username,
            log.Resource,
            log.Result,
            log.ErrorMsg,
            log.IPAddress,
            log.UserAgent,
            log.RequestID,
            log.Duration,
            metadataJSON,
        )
        if err != nil {
            log.Error("批量写入失败", "error", err)
        }
    }
    
    tx.Commit()
    
    // 2. 批量写入 Elasticsearch
    var buf bytes.Buffer
    for _, log := range logs {
        // 写入元数据
        meta := map[string]interface{}{
            "index": map[string]interface{}{
                "_index": "audit-logs",
                "_id":    log.ID,
            },
        }
        metaJSON, _ := json.Marshal(meta)
        buf.Write(metaJSON)
        buf.WriteByte('\n')
        
        // 写入文档
        docJSON, _ := json.Marshal(log)
        buf.Write(docJSON)
        buf.WriteByte('\n')
    }
    
    _, err = as.esClient.Bulk(bytes.NewReader(buf.Bytes()))
    if err != nil {
        log.Error("批量写入 Elasticsearch 失败", "error", err)
    }
    
    return nil
}

// 查询审计日志
func (as *AuditService) Query(req *AuditQueryRequest) (*AuditQueryResponse, error) {
    // 构建查询
    query := as.buildQuery(req)
    
    // 执行查询
    result, err := as.esClient.Search(
        as.esClient.Search.WithContext(context.Background()),
        as.esClient.Search.WithIndex("audit-logs"),
        as.esClient.Search.WithBody(query),
        as.esClient.Search.WithFrom(req.Page*req.PageSize),
        as.esClient.Search.WithSize(req.PageSize),
    )
    
    if err != nil {
        return nil, err
    }
    defer result.Body.Close()
    
    // 解析结果
    var esResponse ESSearchResponse
    if err := json.NewDecoder(result.Body).Decode(&esResponse); err != nil {
        return nil, err
    }
    
    // 转换为审计日志
    logs := make([]*AuditLog, 0, len(esResponse.Hits.Hits))
    for _, hit := range esResponse.Hits.Hits {
        var log AuditLog
        if err := json.Unmarshal(hit.Source, &log); err != nil {
            continue
        }
        logs = append(logs, &log)
    }
    
    return &AuditQueryResponse{
        Total: esResponse.Hits.Total.Value,
        Logs:  logs,
    }, nil
}

// 审计查询请求
type AuditQueryRequest struct {
    TimeRange  *TimeRange `json:"time_range"`
    Category   string     `json:"category,omitempty"`
    Action     string     `json:"action,omitempty"`
    UserID     string     `json:"user_id,omitempty"`
    Resource   string     `json:"resource,omitempty"`
    Result     string     `json:"result,omitempty"`
    Page       int        `json:"page"`
    PageSize   int        `json:"page_size"`
}

// 审计查询响应
type AuditQueryResponse struct {
    Total int64       `json:"total"`
    Logs  []*AuditLog `json:"logs"`
}

// 异常检测器
type AnomalyDetector struct {
    rules []*AnomalyRule
}

// 异常规则
type AnomalyRule struct {
    Name        string  // 规则名称
    Category    string  // 类别
    Action      string  // 操作
    Threshold   int     // 阈值
    WindowSize  int     // 时间窗口（秒）
    Description string  // 描述
}

// 异常检测工作协程
func (as *AuditService) anomalyDetectionWorker() {
    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()
    
    for range ticker.C {
        anomalies := as.detector.Detect()
        for _, anomaly := range anomalies {
            log.Warn("检测到异常审计模式", "anomaly", anomaly)
            
            // 发送告警
            as.sendAlert(anomaly)
        }
    }
}

// 检测异常
func (ad *AnomalyDetector) Detect() []*Anomaly {
    var anomalies []*Anomaly
    
    for _, rule := range ad.rules {
        // 查询时间窗口内的日志
        count := ad.countLogs(rule)
        
        // 检查是否超过阈值
        if count > rule.Threshold {
            anomalies = append(anomalies, &Anomaly{
                Rule:        rule.Name,
                Description: rule.Description,
                Count:       count,
                Threshold:   rule.Threshold,
                DetectedAt:  time.Now(),
            })
        }
    }
    
    return anomalies
}

// 异常对象
type Anomaly struct {
    Rule        string    `json:"rule"`
    Description string    `json:"description"`
    Count       int       `json:"count"`
    Threshold   int       `json:"threshold"`
    DetectedAt  time.Time `json:"detected_at"`
}

// 生成审计报告
func (as *AuditService) GenerateReport(req *ReportRequest) (*AuditReport, error) {
    report := &AuditReport{
        TimeRange:   req.TimeRange,
        GeneratedAt: time.Now(),
    }
    
    // 1. 统计总数
    report.TotalCount = as.countTotal(req.TimeRange)
    
    // 2. 按类别统计
    report.ByCategory = as.countByCategory(req.TimeRange)
    
    // 3. 按操作统计
    report.ByAction = as.countByAction(req.TimeRange)
    
    // 4. 按用户统计
    report.TopUsers = as.getTopUsers(req.TimeRange, 10)
    
    // 5. 按结果统计
    report.ByResult = as.countByResult(req.TimeRange)
    
    // 6. 失败操作列表
    report.FailedOperations = as.getFailedOperations(req.TimeRange, 20)
    
    return report, nil
}

// 审计报告
type AuditReport struct {
    TimeRange        *TimeRange              `json:"time_range"`
    GeneratedAt      time.Time               `json:"generated_at"`
    TotalCount       int64                   `json:"total_count"`
    ByCategory       map[string]int64        `json:"by_category"`
    ByAction         map[string]int64        `json:"by_action"`
    TopUsers         []*UserStats            `json:"top_users"`
    ByResult         map[string]int64        `json:"by_result"`
    FailedOperations []*AuditLog             `json:"failed_operations"`
}

// 用户统计
type UserStats struct {
    UserID   string `json:"user_id"`
    Username string `json:"username"`
    Count    int64  `json:"count"`
}

// 导出审计日志
func (as *AuditService) Export(req *AuditQueryRequest, format string) ([]byte, error) {
    // 查询日志
    response, err := as.Query(req)
    if err != nil {
        return nil, err
    }
    
    // 根据格式导出
    switch format {
    case "csv":
        return as.exportToCSV(response.Logs), nil
    case "json":
        return as.exportToJSON(response.Logs), nil
    default:
        return nil, fmt.Errorf("不支持的格式: %s", format)
    }
}

// 导出为 CSV
func (as *AuditService) exportToCSV(logs []*AuditLog) []byte {
    var buf bytes.Buffer
    writer := csv.NewWriter(&buf)
    
    // 写入表头
    writer.Write([]string{
        "Timestamp", "Category", "Action", "User", "Resource", "Result", "IP Address",
    })
    
    // 写入数据
    for _, log := range logs {
        writer.Write([]string{
            log.Timestamp.Format(time.RFC3339),
            log.Category,
            log.Action,
            log.Username,
            log.Resource,
            log.Result,
            log.IPAddress,
        })
    }
    
    writer.Flush()
    return buf.Bytes()
}

// 导出为 JSON
func (as *AuditService) exportToJSON(logs []*AuditLog) []byte {
    jsonData, _ := json.MarshalIndent(logs, "", "  ")
    return jsonData
}
```

**关键实现点**:

1. 使用异步缓冲区和批量写入优化审计日志性能
2. 双写 PostgreSQL 和 Elasticsearch，提供结构化查询和全文搜索
3. 实现异常检测器，自动识别异常审计模式（如频繁失败登录）
4. 支持审计日志查询、导出和报告生成
5. 记录完整的审计信息（时间戳、用户、操作、资源、结果、IP、User-Agent）
6. 使用定时刷新机制，平衡性能和实时性
7. 支持审计类别和保留期配置，满足不同合规要求

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enabled | bool | true | 是否启用审计 |
| buffer_size | int | 1000 | 缓冲区大小 |
| flush_interval | int | 5 | 刷新间隔（秒） |
| retention_days | int | 365 | 保留天数 |
| anomaly_detection | bool | true | 是否启用异常检测 |
| categories | array | ["auth","data","config","key"] | 审计类别 |

**热更新机制**:

- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效（下一次审计记录）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 保留天数变更时，THE System SHALL 触发清理任务，删除超出保留期的审计日志

---

### API 接口汇总

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

---


