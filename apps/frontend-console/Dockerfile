# ============================================================
# 阶段 1: 依赖安装 + 构建
# ============================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# 先复制依赖清单，利用 Docker 缓存层
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# 复制源码并构建
COPY . .
RUN pnpm build

# ============================================================
# 阶段 2: Nginx 静态服务
# ============================================================
FROM nginx:1.25-alpine AS runner

# 复制 nginx 配置（已包含 SPA 路由支持）
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制运行时配置（可通过 ConfigMap/Volume 挂载覆盖）
COPY public/config /usr/share/nginx/html/config

# 以非 root 用户运行（安全最佳实践）
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
