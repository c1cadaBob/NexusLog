# NexusLog Makefile - 统一构建/测试命令入口
# ============================================

.PHONY: all bootstrap lint test build release rollback clean help
.PHONY: frontend-install frontend-lint frontend-test frontend-build
.PHONY: backend-lint backend-test backend-build
.PHONY: docker-build docker-push

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
	@echo "发布:"
	@echo "  make release        - 发布新版本"
	@echo "  make rollback       - 回滚到上一版本"
	@echo ""
	@echo "其他:"
	@echo "  make clean          - 清理构建产物"
	@echo "  make help           - 显示此帮助信息"
