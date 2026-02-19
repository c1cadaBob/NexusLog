# ============================================
# NexusLog BFF 服务 - 多阶段构建
# ============================================

# --- 阶段一：构建 ---
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖（利用 Docker 缓存层）
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# 复制源码并构建
COPY . .
RUN npm run build

# --- 阶段二：运行 ---
FROM node:20-alpine

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# 仅复制生产依赖和构建产物
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 非 root 用户运行
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

ENTRYPOINT ["node", "dist/main"]
