# NexusLog API Gateway - OpenResty Dockerfile
# 基于 OpenResty 官方镜像
FROM openresty/openresty:1.25.3.2-alpine

LABEL maintainer="NexusLog Team"
LABEL description="NexusLog API Gateway based on OpenResty"

# 安装依赖
RUN apk add --no-cache curl

# 创建日志目录
RUN mkdir -p /var/log/openresty

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
