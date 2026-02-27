# NexusLog Vault 密钥管理服务
# 基于 HashiCorp Vault 官方镜像，预加载策略和配置
# 变更级别: CAB（涉及密钥证书管理）

FROM hashicorp/vault:1.15

# 复制 Vault 服务端配置
COPY config/ /vault/config/

# 复制策略文件（启动后通过脚本加载）
COPY policies/ /vault/policies/

# 复制认证方法配置模板
COPY auth/ /vault/auth/

# 复制 Secrets Engine 配置模板
COPY engines/ /vault/engines/

# Vault API 和集群端口
EXPOSE 8200 8201

# 健康检查
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD ["vault", "status", "-format=json"]

# 以服务模式启动
ENTRYPOINT ["vault"]
CMD ["server", "-config=/vault/config/vault.hcl"]
