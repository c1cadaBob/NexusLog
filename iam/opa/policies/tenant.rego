# NexusLog 多租户隔离策略
# 确保用户只能访问其所属租户的资源

package nexuslog.tenant

import rego.v1

# 默认拒绝跨租户访问
default allow := false

# 允许访问自身租户的资源
allow if {
    input.user.tenant_id == input.resource_tenant_id
}

# 超级管理员可跨租户访问
allow if {
    "admin" in input.user.roles
    input.user.attributes.super_admin == true
}
