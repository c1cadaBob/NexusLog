# NexusLog Vault 服务端配置
# 变更级别: CAB（涉及密钥管理后端配置）

# 存储后端 - 生产环境使用 Consul 或 Raft
storage "raft" {
  path    = "/vault/data"
  node_id = "vault-node-1"
}

# 监听地址
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = false

  # TLS 配置（生产环境必须启用）
  tls_cert_file = "/vault/tls/tls.crt"
  tls_key_file  = "/vault/tls/tls.key"
}

# 集群通信地址
cluster_addr  = "https://vault:8201"
api_addr      = "https://vault:8200"

# 审计日志
# 启动后通过 CLI 启用: vault audit enable file file_path=/vault/logs/audit.log

# UI 界面（开发环境可启用）
ui = false

# 遥测配置 - 对接 Prometheus
telemetry {
  prometheus_retention_time = "30s"
  disable_hostname          = true
}

# 密钥自动解封（生产环境推荐使用 KMS 或 Transit Auto-Unseal）
# seal "awskms" {
#   region     = "ap-east-1"
#   kms_key_id = "alias/nexuslog-vault-unseal"
# }

# 最大租约 TTL
max_lease_ttl = "768h"
default_lease_ttl = "1h"
