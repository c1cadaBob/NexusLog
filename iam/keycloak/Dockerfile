# NexusLog Keycloak 身份认证服务
# 基于 Keycloak 24+ 官方镜像，预加载 Realm 配置和自定义主题
# 变更级别: CAB（涉及认证鉴权链路）

FROM quay.io/keycloak/keycloak:24.0 AS builder

# 复制 Realm 配置用于构建阶段优化
COPY realms/ /opt/keycloak/data/import/
COPY clients/ /opt/keycloak/data/import/clients/
COPY roles/ /opt/keycloak/data/import/roles/
COPY mappers/ /opt/keycloak/data/import/mappers/

# 复制自定义主题
COPY themes/nexuslog/ /opt/keycloak/themes/nexuslog/

# 构建优化后的 Keycloak 镜像
RUN /opt/keycloak/bin/kc.sh build \
    --db=postgres \
    --health-enabled=true \
    --metrics-enabled=true

# --- 运行阶段 ---
FROM quay.io/keycloak/keycloak:24.0

COPY --from=builder /opt/keycloak/ /opt/keycloak/

# 复制 Realm 导入文件
COPY realms/ /opt/keycloak/data/import/
COPY clients/ /opt/keycloak/data/import/clients/
COPY roles/ /opt/keycloak/data/import/roles/
COPY mappers/ /opt/keycloak/data/import/mappers/

# 复制自定义主题
COPY themes/nexuslog/ /opt/keycloak/themes/nexuslog/

# 环境变量（运行时通过 docker-compose 或 K8s 覆盖）
ENV KC_DB=postgres
ENV KC_DB_URL_HOST=postgresql
ENV KC_DB_URL_DATABASE=keycloak
ENV KC_DB_USERNAME=keycloak
ENV KC_DB_PASSWORD=changeme
ENV KC_HOSTNAME_STRICT=false
ENV KC_PROXY_HEADERS=xforwarded
ENV KC_HTTP_ENABLED=true
ENV KC_HEALTH_ENABLED=true
ENV KC_METRICS_ENABLED=true

EXPOSE 8080 8443

# 启动时自动导入 Realm 配置
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--import-realm", "--optimized"]
