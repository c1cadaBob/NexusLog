# NexusLog Vault 开发环境配置
# 简化配置，禁用 TLS，使用文件存储
# 变更级别: none（仅开发环境）

storage "file" {
  path = "/vault/data"
}

listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

api_addr = "http://vault:8200"

ui = true

telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

max_lease_ttl     = "768h"
default_lease_ttl = "1h"
