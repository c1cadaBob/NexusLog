# NexusLog 应用服务 Vault 策略
# 允许应用服务读取所需的密钥和配置
# 变更级别: CAB（涉及密钥管理）

# 读取数据库凭证
path "database/creds/nexuslog-*" {
  capabilities = ["read"]
}

# 读取应用密钥（API 密钥、JWT 签名密钥等）
path "secret/data/nexuslog/app/*" {
  capabilities = ["read", "list"]
}

# 读取 TLS 证书
path "pki/issue/nexuslog-internal" {
  capabilities = ["create", "update"]
}

# 读取 Kafka 凭证
path "secret/data/nexuslog/kafka/*" {
  capabilities = ["read"]
}

# 读取 Elasticsearch 凭证
path "secret/data/nexuslog/elasticsearch/*" {
  capabilities = ["read"]
}

# 读取 Redis 凭证
path "secret/data/nexuslog/redis/*" {
  capabilities = ["read"]
}

# 读取 Keycloak 客户端密钥
path "secret/data/nexuslog/keycloak/*" {
  capabilities = ["read"]
}

# 禁止访问其他路径
path "secret/data/nexuslog/admin/*" {
  capabilities = ["deny"]
}
