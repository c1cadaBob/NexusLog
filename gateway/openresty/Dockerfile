# NexusLog API Gateway - OpenResty Dockerfile
# 基于 OpenResty 官方镜像，集成 JWT 认证、限流、多租户路由
# change_level: cab（涉及全局流量策略）
FROM openresty/openresty:1.25.3.2-alpine

LABEL maintainer="NexusLog Team"
LABEL description="NexusLog API Gateway - OpenResty with Lua extensions"

# 安装系统依赖和 Lua 模块
RUN apk add --no-cache \
        curl \
        perl \
        openssl \
        openssl-dev \
    && opm get SkyLothar/lua-resty-jwt \
    && opm get ledgetech/lua-resty-http \
    && opm get bungle/lua-resty-template

# 创建必要目录
RUN mkdir -p /var/log/openresty \
    && mkdir -p /etc/openresty/conf.d \
    && mkdir -p /etc/openresty/lua \
    && mkdir -p /etc/openresty/tenants \
    && mkdir -p /etc/openresty/policies \
    && mkdir -p /etc/openresty/certs

# 复制配置文件
COPY nginx.conf /usr/local/openresty/nginx/conf/nginx.conf
COPY conf.d/ /etc/openresty/conf.d/
COPY lua/ /etc/openresty/lua/
COPY tenants/ /etc/openresty/tenants/
COPY policies/ /etc/openresty/policies/

# 健康检查
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

EXPOSE 80 443

CMD ["openresty", "-g", "daemon off;"]
