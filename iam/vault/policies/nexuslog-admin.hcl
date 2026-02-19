# NexusLog 管理员 Vault 策略
# 允许管理员管理密钥和配置
# 变更级别: CAB

# 管理应用密钥
path "secret/data/nexuslog/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

path "secret/metadata/nexuslog/*" {
  capabilities = ["read", "list", "delete"]
}

# 管理数据库角色
path "database/roles/nexuslog-*" {
  capabilities = ["create", "read", "update", "delete"]
}

# 签发 TLS 证书
path "pki/issue/nexuslog-*" {
  capabilities = ["create", "update"]
}

path "pki/roles/nexuslog-*" {
  capabilities = ["create", "read", "update", "delete"]
}

# 查看审计日志
path "sys/audit" {
  capabilities = ["read", "list"]
}

# 管理策略（仅读取，修改需要 root）
path "sys/policies/acl/nexuslog-*" {
  capabilities = ["read", "list"]
}
