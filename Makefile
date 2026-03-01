# NexusLog Makefile - 统一构建/测试命令入口
# ============================================

.PHONY: all bootstrap lint test build release rollback clean help
.PHONY: frontend-install frontend-lint frontend-test frontend-build
.PHONY: backend-lint backend-test backend-build
.PHONY: docker-build docker-push
.PHONY: db-migrate-up db-migrate-down db-migrate-version db-migrate-create
.PHONY: dev-up dev-down dev-logs dev-test-smoke

DB_MIGRATE_SCRIPT := ./scripts/db-migrate.sh
MIRROR_ENV_FILE := ./.env.mirrors
DEV_COMPOSE_FILES := -f docker-compose.yml -f docker-compose.dev.yml
DEV_SERVICES := \
	postgres redis elasticsearch zookeeper kafka kafka-init \
	control-plane api-service query-api audit-api export-api health-worker collector-agent \
	bff-service frontend-console
DEV_LOG_SERVICES := frontend-console bff-service control-plane api-service query-api audit-api export-api health-worker collector-agent

# 默认目标
all: lint test build

# ============================================
# 初始化
# ============================================

## 初始化项目，安装所有依赖
bootstrap:
	@echo "🚀 初始化 NexusLog 项目..."
	@./scripts/bootstrap.sh

# ============================================
# 代码检查
# ============================================

## 运行所有代码检查
lint: frontend-lint backend-lint
	@echo "✅ 所有代码检查完成"

## 前端代码检查
frontend-lint:
	@echo "🔍 检查前端代码..."
	@cd apps/frontend-console && pnpm lint

## 后端代码检查
backend-lint:
	@echo "🔍 检查后端代码..."
	@./scripts/lint.sh

# ============================================
# 测试
# ============================================

## 运行所有测试
test: frontend-test backend-test
	@echo "✅ 所有测试完成"

## 前端测试
frontend-test:
	@echo "🧪 运行前端测试..."
	@cd apps/frontend-console && pnpm test

## 后端测试
backend-test:
	@echo "🧪 运行后端测试..."
	@./scripts/test.sh

# ============================================
# 构建
# ============================================

## 构建所有组件
build: frontend-build backend-build
	@echo "✅ 所有构建完成"

## 构建前端
frontend-build:
	@echo "🔨 构建前端..."
	@cd apps/frontend-console && pnpm build

## 构建后端
backend-build:
	@echo "🔨 构建后端..."
	@./scripts/build.sh

# ============================================
# Docker
# ============================================

## 构建 Docker 镜像
docker-build:
	@echo "🐳 构建 Docker 镜像..."
	@./scripts/build.sh docker

## 推送 Docker 镜像
docker-push:
	@echo "🐳 推送 Docker 镜像..."
	@./scripts/build.sh push

# ============================================
# Dev hot-reload
# ============================================

## 启动开发热更新环境（任务2起默认）
dev-up:
	@echo "🔥 启动 dev 热更新环境..."
	@docker compose --env-file $(MIRROR_ENV_FILE) $(DEV_COMPOSE_FILES) pull $(DEV_SERVICES)
	@docker compose --env-file $(MIRROR_ENV_FILE) $(DEV_COMPOSE_FILES) up -d $(DEV_SERVICES)
	@echo "✅ dev 环境已启动"

## 关闭开发热更新环境
dev-down:
	@echo "🛑 停止 dev 热更新环境..."
	@docker compose --env-file $(MIRROR_ENV_FILE) $(DEV_COMPOSE_FILES) down --remove-orphans
	@echo "✅ dev 环境已停止"

## 查看开发环境日志（持续输出）
dev-logs:
	@echo "📜 查看 dev 热更新日志..."
	@docker compose --env-file $(MIRROR_ENV_FILE) $(DEV_COMPOSE_FILES) logs -f --tail=200 $(DEV_LOG_SERVICES)

## 开发环境冒烟检查
dev-test-smoke:
	@echo "🧪 执行 dev 冒烟检查..."
	@set -e; \
	for url in \
		http://localhost:3000 \
		http://localhost:3001/healthz \
		http://localhost:8080/healthz \
		http://localhost:8085/healthz \
		http://localhost:8082/healthz \
		http://localhost:8083/healthz \
		http://localhost:8084/healthz \
		http://localhost:8081/healthz \
		http://localhost:9091/healthz; do \
		echo "checking $$url"; \
		curl -fsS "$$url" >/dev/null; \
	done; \
	echo "✅ dev 冒烟检查通过"

# ============================================
# Database migration
# ============================================

## 执行数据库迁移 up（可选：STEPS=1）
db-migrate-up:
	@$(DB_MIGRATE_SCRIPT) up $(STEPS)

## 执行数据库迁移 down（可选：STEPS=1）
db-migrate-down:
	@$(DB_MIGRATE_SCRIPT) down $(STEPS)

## 查看当前数据库迁移版本
db-migrate-version:
	@$(DB_MIGRATE_SCRIPT) version

## 创建新的迁移文件（必填：NAME=xxx）
db-migrate-create:
	@if [ -z "$(NAME)" ]; then echo "Usage: make db-migrate-create NAME=add_xxx"; exit 1; fi
	@$(DB_MIGRATE_SCRIPT) create "$(NAME)"

# ============================================
# 发布
# ============================================

## 发布新版本
release:
	@echo "📦 发布新版本..."
	@./scripts/release.sh

## 回滚到上一版本
rollback:
	@echo "⏪ 回滚到上一版本..."
	@./scripts/rollback.sh

# ============================================
# 清理
# ============================================

## 清理构建产物
clean:
	@echo "🧹 清理构建产物..."
	@rm -rf dist/ build/ bin/
	@rm -rf apps/frontend-console/dist
	@rm -rf coverage/
	@echo "✅ 清理完成"

# ============================================
# 帮助
# ============================================

## 显示帮助信息
help:
	@echo "NexusLog Makefile 命令列表"
	@echo "=========================="
	@echo ""
	@echo "初始化:"
	@echo "  make bootstrap      - 初始化项目，安装所有依赖"
	@echo ""
	@echo "代码检查:"
	@echo "  make lint           - 运行所有代码检查"
	@echo "  make frontend-lint  - 前端代码检查"
	@echo "  make backend-lint   - 后端代码检查"
	@echo ""
	@echo "测试:"
	@echo "  make test           - 运行所有测试"
	@echo "  make frontend-test  - 前端测试"
	@echo "  make backend-test   - 后端测试"
	@echo ""
	@echo "构建:"
	@echo "  make build          - 构建所有组件"
	@echo "  make frontend-build - 构建前端"
	@echo "  make backend-build  - 构建后端"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-build   - 构建 Docker 镜像"
	@echo "  make docker-push    - 推送 Docker 镜像"
	@echo ""
	@echo "开发热更新:"
	@echo "  make dev-up         - 启动 dev 热更新环境"
	@echo "  make dev-down       - 停止 dev 热更新环境"
	@echo "  make dev-logs       - 查看 dev 热更新日志"
	@echo "  make dev-test-smoke - 执行 dev 冒烟检查"
	@echo ""
	@echo "数据库迁移:"
	@echo "  make db-migrate-up [STEPS=N]      - 执行迁移 up"
	@echo "  make db-migrate-down [STEPS=N]    - 执行迁移 down"
	@echo "  make db-migrate-version           - 查看迁移版本"
	@echo "  make db-migrate-create NAME=xxx   - 创建新迁移"
	@echo ""
	@echo "发布:"
	@echo "  make release        - 发布新版本"
	@echo "  make rollback       - 回滚到上一版本"
	@echo ""
	@echo "其他:"
	@echo "  make clean          - 清理构建产物"
	@echo "  make help           - 显示此帮助信息"
