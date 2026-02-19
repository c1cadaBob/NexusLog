# NexusLog RBAC 策略单元测试

package nexuslog.authz_test

import rego.v1

import data.nexuslog.authz

# 测试：管理员应拥有所有权限
test_admin_allow if {
    authz.allow with input as {
        "user": {"roles": ["admin"]},
        "resource": "logs",
        "action": "read",
    }
}

# 测试：无角色用户应被拒绝
test_no_role_deny if {
    not authz.allow with input as {
        "user": {"roles": []},
        "resource": "logs",
        "action": "read",
    }
}

# 测试：log-viewer 可以读取日志
test_log_viewer_read_logs if {
    authz.allow with input as {
        "user": {"roles": ["log-viewer"]},
        "resource": "logs",
        "action": "read",
    }
}

# 测试：log-viewer 不能删除告警
test_log_viewer_cannot_delete_alerts if {
    not authz.allow with input as {
        "user": {"roles": ["log-viewer"]},
        "resource": "alerts",
        "action": "delete",
    }
}

# 测试：alert-manager 可以创建告警规则
test_alert_manager_create_rules if {
    authz.allow with input as {
        "user": {"roles": ["alert-manager"]},
        "resource": "alert-rules",
        "action": "create",
    }
}

# 测试：user-manager 可以管理用户
test_user_manager_manage_users if {
    authz.allow with input as {
        "user": {"roles": ["user-manager"]},
        "resource": "users",
        "action": "create",
    }
}

# 测试：audit-viewer 可以读取审计日志
test_audit_viewer_read_audit if {
    authz.allow with input as {
        "user": {"roles": ["audit-viewer"]},
        "resource": "audit-logs",
        "action": "read",
    }
}

# 测试：audit-viewer 不能修改系统配置
test_audit_viewer_cannot_update_config if {
    not authz.allow with input as {
        "user": {"roles": ["audit-viewer"]},
        "resource": "system-config",
        "action": "update",
    }
}
