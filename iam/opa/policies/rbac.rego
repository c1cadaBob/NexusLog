# NexusLog RBAC 授权策略
# 基于角色的访问控制（Role-Based Access Control）
#
# 本策略定义了 NexusLog 系统的基础 RBAC 授权规则。
# OPA 通过 Policy Bundle 热更新机制加载策略，变更级别为 CAB。

package nexuslog.authz

import rego.v1

# 默认拒绝所有请求
default allow := false

# 管理员拥有所有权限
allow if {
    "admin" in input.user.roles
}

# 基于角色-资源-操作的权限映射
allow if {
    some role in input.user.roles
    some grant in role_permissions[role]
    grant.resource == input.resource
    grant.action == input.action
}

# 角色权限定义
role_permissions := {
    "log-viewer": [
        {"resource": "logs", "action": "read"},
        {"resource": "logs", "action": "search"},
        {"resource": "logs", "action": "export"},
        {"resource": "dashboards", "action": "read"},
    ],
    "alert-manager": [
        {"resource": "alerts", "action": "read"},
        {"resource": "alerts", "action": "create"},
        {"resource": "alerts", "action": "update"},
        {"resource": "alerts", "action": "delete"},
        {"resource": "alert-rules", "action": "read"},
        {"resource": "alert-rules", "action": "create"},
        {"resource": "alert-rules", "action": "update"},
        {"resource": "alert-rules", "action": "delete"},
        {"resource": "notifications", "action": "read"},
        {"resource": "notifications", "action": "update"},
    ],
    "user-manager": [
        {"resource": "users", "action": "read"},
        {"resource": "users", "action": "create"},
        {"resource": "users", "action": "update"},
        {"resource": "users", "action": "delete"},
        {"resource": "roles", "action": "read"},
        {"resource": "roles", "action": "assign"},
    ],
    "audit-viewer": [
        {"resource": "audit-logs", "action": "read"},
        {"resource": "audit-logs", "action": "export"},
        {"resource": "login-policies", "action": "read"},
    ],
    "config-manager": [
        {"resource": "system-config", "action": "read"},
        {"resource": "system-config", "action": "update"},
        {"resource": "ingestion-sources", "action": "read"},
        {"resource": "ingestion-sources", "action": "create"},
        {"resource": "ingestion-sources", "action": "update"},
        {"resource": "parsing-rules", "action": "read"},
        {"resource": "parsing-rules", "action": "create"},
        {"resource": "parsing-rules", "action": "update"},
    ],
}
