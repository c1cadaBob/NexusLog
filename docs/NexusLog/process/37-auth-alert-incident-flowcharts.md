# NexusLog 认证、告警与 Incident 流程图

## 文档目的

本文档用于把 NexusLog 中最接近“业务时序图”风格的三类流程单独拆出来：

- 登录 / 会话建立
- 页面访问与 RBAC 鉴权
- 告警规则与通知闭环
- Incident 生命周期

> 适用口径：以当前实现和当前文档基线为主，必要时补充目标扩展说明。  
> 若某段流程仍偏目标态，会在图下明确说明。

---

## 1. 登录 / 会话建立流程图

> 口径：当前实现优先。  
> 该图不强制绑定 Keycloak，而描述当前系统需要的登录与会话建立闭环。

```mermaid
sequenceDiagram
    autonumber
    actor User as "User/用户"
    participant UI as "UI/前端登录页"
    participant Auth as "Auth/API Service"
    participant PG as "PostgreSQL/用户角色数据"
    participant Session as "Session/JWT/Redis"

    User->>UI: 输入账号密码并提交
    UI->>Auth: POST /api/v1/auth/login
    Auth->>PG: 查询用户、角色、状态
    PG-->>Auth: 返回用户与角色信息
    alt 校验成功
        Auth->>Session: 生成 token / session
        Session-->>Auth: 返回凭证
        Auth-->>UI: 返回登录成功 + 会话信息
        UI->>UI: 存储会话并跳转 Dashboard
    else 校验失败
        Auth-->>UI: 返回账号或密码错误
        UI->>UI: 展示错误提示
    end
```

**说明**：

- 当前图只表达登录闭环，不强制规定具体 IAM 产品实现
- 若未来统一切换到 Keycloak / OIDC，应在目标蓝图文档中体现，而不是回写成当前事实

---

## 2. 页面访问与 RBAC 鉴权流程图

> 口径：当前实现优先。  
> 该图表达“用户访问页面时，系统如何完成会话和角色权限检查”。

```mermaid
sequenceDiagram
    autonumber
    actor User as "User/用户"
    participant UI as "UI/前端页面"
    participant API as "API Service / Gateway"
    participant AuthZ as "RBAC/权限判断"
    participant PG as "PostgreSQL/角色权限数据"

    User->>UI: 访问受保护页面
    UI->>API: 携带 token 发起请求
    API->>API: 校验 token / session
    alt 会话有效
        API->>AuthZ: 解析租户 / 角色 / 菜单权限
        AuthZ->>PG: 查询用户权限映射
        PG-->>AuthZ: 返回权限结果
        alt 有权限
            AuthZ-->>API: 允许访问
            API-->>UI: 返回页面数据
            UI->>UI: 渲染页面
        else 无权限
            AuthZ-->>API: 拒绝访问
            API-->>UI: 返回 403 / 权限不足
            UI->>UI: 展示无权限提示
        end
    else 会话无效
        API-->>UI: 返回 401 / 登录失效
        UI->>UI: 清理会话并跳转登录页
    end
```

**说明**：

- 这张图强调当前权限闭环
- 若未来引入更完整的 OPA / IAM / 外部 IdP，应在目标蓝图中进一步展开

---

## 3. 告警规则生命周期流程图

> 口径：当前实现 + 目标收口。  
> 用于描述一条告警规则从创建到停用/删除的完整生命周期。

```mermaid
flowchart TD
    A["创建规则"] --> B["填写条件 / 阈值 / 严重级别 / 通知配置"]
    B --> C["保存规则"]
    C --> D["规则验证"]
    D -->|通过| E["规则生效"]
    D -->|失败| X1["返回错误并修改"]
    E --> F["启用规则"]
    F --> G["参与周期性评估"]
    G --> H["编辑规则"]
    H --> I["重新验证并覆盖生效"]
    G --> J["停用规则"]
    J --> K["退出评估但保留记录"]
    K --> L["删除规则"]
```

**说明**：

- 当前规则能力已覆盖 keyword / level_count / threshold 等类型
- 通知渠道和静默策略与规则生命周期密切相关，但在评估流程图里继续展开

---

## 4. 告警评估与通知流程图

> 口径：当前实现主流程。  
> 该图重点模拟“定时评估 → 规则命中 → 抑制 / 静默 → 通知 / 事件”的完整闭环。

```mermaid
sequenceDiagram
    autonumber
    participant Scheduler as "Scheduler/定时器"
    participant Evaluator as "Alert Evaluator"
    participant ES as "Elasticsearch"
    participant Rule as "Rule Repository"
    participant Event as "alert_event"
    participant Notify as "Notification Channel"
    participant Incident as "Incident Creator"

    loop 周期性评估
        Scheduler->>Evaluator: 触发规则评估
        Evaluator->>Rule: 读取启用规则
        Rule-->>Evaluator: 返回规则列表
        Evaluator->>ES: 按规则查询 ES
        ES-->>Evaluator: 返回命中数 / 聚合结果
        alt 规则命中
            Evaluator->>Evaluator: 抑制判断
            Evaluator->>Evaluator: 静默判断
            Evaluator->>Event: 创建 alert_event
            alt 不在静默期
                Evaluator->>Notify: 发送通知
                Notify-->>Evaluator: 返回成功 / 失败回执
            else 在静默期
                Evaluator->>Evaluator: 跳过通知但保留事件
            end
            alt critical 告警
                Evaluator->>Incident: 自动创建 Incident
                Incident-->>Evaluator: 返回 incident 引用
            else 非 critical
                Evaluator->>Evaluator: 仅保留告警事件
            end
        else 未命中
            Evaluator->>Evaluator: 结束本轮评估
        end
    end
```

**说明**：

- 当前实现已经有抑制、静默、critical 升级 Incident 的基础能力
- 通知渠道细节可随具体渠道实现进一步扩展，但不改变主流程

---

## 5. Incident 生命周期状态图

> 口径：当前实现 + 目标收口。  
> 状态机用于统一事件处理阶段的语义。

```mermaid
stateDiagram-v2
    [*] --> open: critical alert 自动创建 / 手动创建
    open --> acked: ACK
    acked --> investigating: 开始调查
    investigating --> mitigated: 已缓解
    investigating --> resolved: 已确认解决
    mitigated --> resolved: 验证完成
    resolved --> closed: 关闭事件
    closed --> archived: 归档
    archived --> [*]
```

**说明**：

- 当前实现至少需要支持从 alert_event 升级到 Incident 的闭环
- 更复杂的 SLA、升级路径、postmortem 可在后续专题文档补充

---

## 参考资料

- `docs/NexusLog/process/04-frontend-pages-functional-workflow-dataflow.md`
- `docs/NexusLog/process/23-project-master-plan-and-task-registry.md`
- `docs/NexusLog/process/25-full-lifecycle-task-registry.md`
- `docs/architecture/05-security-architecture.md`
- `services/control-plane/internal/alert/evaluator.go`

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|---|---|---|
| 2026-03-07 | v1.0 | 初始版本。新增登录、RBAC 鉴权、告警规则生命周期、告警评估通知、Incident 生命周期状态图 |
