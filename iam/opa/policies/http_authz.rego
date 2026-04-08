# NexusLog HTTP API 路径级授权策略
# 与 OpenResty Gateway 的 auth_check.lua 配合使用
# Gateway 将请求信息发送到 OPA，OPA 返回授权决策

package nexuslog.http_authz

import rego.v1
import data.nexuslog.authz

# 默认拒绝
default allow := false

# 公开端点无需授权
allow if {
    is_public_endpoint
}

# 已认证用户 + RBAC 授权通过
allow if {
    input.user.authenticated == true
    api_permission_granted
}

# 公开端点列表（健康检查、登录等）
is_public_endpoint if {
    public_paths[input.path]
}

public_paths := {
    "/healthz",
    "/readyz",
    "/api/v1/auth/login",
    "/api/v1/auth/callback"
}

# API 路径到资源的映射
api_resource := resource if {
    # /api/v1/logs/* -> logs
    parts := split(trim_prefix(input.path, "/api/v1/"), "/")
    count(parts) > 0
    resource := parts[0]
}

# HTTP 方法到操作的映射
http_action := "read" if { input.method == "GET" }
http_action := "create" if { input.method == "POST" }
http_action := "update" if { input.method == "PUT" }
http_action := "update" if { input.method == "PATCH" }
http_action := "delete" if { input.method == "DELETE" }
http_action := "search" if {
    input.method == "POST"
    endswith(input.path, "/search")
}

# 调用 RBAC 策略进行授权检查
api_permission_granted if {
    authz.allow with input as {
        "user": input.user,
        "resource": api_resource,
        "action": http_action,
    }
}
