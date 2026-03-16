# NexusLog Makefile - 统一构建/测试命令入口
# ============================================

.PHONY: all bootstrap lint test build release rollback clean help
.PHONY: frontend-install frontend-lint frontend-test frontend-build
.PHONY: backend-lint backend-test backend-build
.PHONY: docker-build docker-push test-contracts stream-install-es stream-register-schemas stream-deploy-local stream-bootstrap-local stream-compare
.PHONY: db-migrate-up db-migrate-down db-migrate-version db-migrate-create
.PHONY: dev-up dev-up-lite dev-down dev-logs dev-test-smoke local-db-migrate-up local-bootstrap local-deploy api-register-smoke api-auth-storage-verify api-auth-chain-test gateway-auth-smoke-test m1-rollback-drill m1-post-release-observe m1-hot-reload-gate

DB_MIGRATE_SCRIPT := ./scripts/db-migrate.sh
MIRROR_ENV_FILE := ./.env.mirrors
LOCAL_DB_DSN ?= postgres://nexuslog:nexuslog_dev@localhost:5432/nexuslog?sslmode=disable
LOCAL_PG_CONTAINER ?= nexuslog-postgres-1
LOCAL_PG_USER ?= nexuslog
LOCAL_PG_DB ?= nexuslog
LOCAL_TENANT_CONFIG_SCRIPT ?= ./scripts/local/ensure-local-tenant-config.sh
DEV_COMPOSE_FILES := -f docker-compose.yml -f docker-compose.override.yml
DEV_SERVICES := \
	postgres redis elasticsearch elasticsearch-init zookeeper kafka kafka-init schema-registry schema-registry-init \
	flink-jobmanager flink-taskmanager flink-sql-init \
	control-plane api-service query-api audit-api export-api health-worker collector-agent \
	prometheus alertmanager grafana node-exporter elasticsearch-exporter kafka-exporter postgres-exporter redis-exporter \
	bff-service frontend-console
DEV_SERVICES_LITE := \
	postgres redis \
	control-plane api-service \
	bff-service frontend-console
DEV_LOG_SERVICES := frontend-console bff-service control-plane api-service query-api audit-api export-api health-worker collector-agent schema-registry flink-jobmanager flink-taskmanager prometheus alertmanager grafana

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

## Schema contracts 测试
test-contracts:
	@echo "🧪 校验 Schema contracts..."
	@bash ./contracts/schema-contracts/tests/validate-schemas.sh

## 安装 Stream 主链 Elasticsearch 模板与别名
stream-install-es:
	@echo "🗂️ 安装 Elasticsearch v2 模板与别名..."
	@ES_HOST="$(ES_HOST)" ./scripts/install-es-v2-template.sh

## 向 Schema Registry 注册 Stream 主链契约
stream-register-schemas:
	@echo "🧬 注册 Schema Registry 契约..."
	@SCHEMA_REGISTRY_URL="$(SCHEMA_REGISTRY_URL)" ./scripts/register-schema-registry-subjects.sh

## 在本地 Flink 提交流式 SQL 作业
stream-deploy-local:
	@echo "🌊 提交 Flink SQL 作业..."
	@FLINK_SQL_JOBS="$(FLINK_SQL_JOBS)" FLINK_REST_URL="$(FLINK_REST_URL)" SCHEMA_REGISTRY_URL="$(SCHEMA_REGISTRY_URL)" ./scripts/deploy-flink-sql-jobs.sh

## 在本地完成 Stream 主链 bootstrap
stream-bootstrap-local: stream-install-es stream-register-schemas stream-deploy-local
	@echo "✅ Stream 本地自举完成"

## 按 event_id 对比 Pull / Stream 双路样本
stream-compare:
	@echo "🔎 对比 Pull / Stream 双路样本..."
	@ES_HOST="$(ES_HOST)" PULL_INDEX="$(PULL_INDEX)" STREAM_INDEX="$(STREAM_INDEX)" SINCE_MINUTES="$(SINCE_MINUTES)" SAMPLE_SIZE="$(SAMPLE_SIZE)" ./scripts/compare-pull-stream-by-event-id.sh

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
	@set -e; \
	tenant_id="$$($(LOCAL_TENANT_CONFIG_SCRIPT))"; \
	echo "🔐 使用本地租户 $$tenant_id"; \
	set -a; . $(MIRROR_ENV_FILE); set +a; \
	docker compose $(DEV_COMPOSE_FILES) up -d postgres; \
	for attempt in $$(seq 1 60); do \
		if docker compose $(DEV_COMPOSE_FILES) exec -T postgres pg_isready -U $(LOCAL_PG_USER) -d $(LOCAL_PG_DB) >/dev/null 2>&1; then \
			break; \
		fi; \
		if [ "$$attempt" -eq 60 ]; then \
			echo "ERROR: postgres not ready for local tenant sync"; \
			exit 1; \
		fi; \
		sleep 1; \
	done; \
	tenant_id="$$($(LOCAL_TENANT_CONFIG_SCRIPT))"; \
	echo "🔐 已同步本地租户 $$tenant_id"; \
	docker compose $(DEV_COMPOSE_FILES) pull $(DEV_SERVICES); \
	docker compose $(DEV_COMPOSE_FILES) up -d $(DEV_SERVICES)
	@echo "✅ dev 环境已启动"

## 启动轻量开发热更新环境（低资源，占用更小）
dev-up-lite:
	@echo "🔥 启动 dev 轻量热更新环境..."
	@set -e; \
	tenant_id="$$($(LOCAL_TENANT_CONFIG_SCRIPT))"; \
	echo "🔐 使用本地租户 $$tenant_id"; \
	set -a; . $(MIRROR_ENV_FILE); set +a; \
	docker compose $(DEV_COMPOSE_FILES) up -d postgres; \
	for attempt in $$(seq 1 60); do \
		if docker compose $(DEV_COMPOSE_FILES) exec -T postgres pg_isready -U $(LOCAL_PG_USER) -d $(LOCAL_PG_DB) >/dev/null 2>&1; then \
			break; \
		fi; \
		if [ "$$attempt" -eq 60 ]; then \
			echo "ERROR: postgres not ready for local tenant sync"; \
			exit 1; \
		fi; \
		sleep 1; \
	done; \
	tenant_id="$$($(LOCAL_TENANT_CONFIG_SCRIPT))"; \
	echo "🔐 已同步本地租户 $$tenant_id"; \
	docker compose $(DEV_COMPOSE_FILES) pull $(DEV_SERVICES_LITE); \
	docker compose $(DEV_COMPOSE_FILES) up -d $(DEV_SERVICES_LITE)
	@echo "✅ dev 轻量环境已启动"

## 关闭开发热更新环境
dev-down:
	@echo "🛑 停止 dev 热更新环境..."
	@set -a; . $(MIRROR_ENV_FILE); set +a; docker compose $(DEV_COMPOSE_FILES) down --remove-orphans
	@echo "✅ dev 环境已停止"

## 查看开发环境日志（持续输出）
dev-logs:
	@echo "📜 查看 dev 热更新日志..."
	@set -a; . $(MIRROR_ENV_FILE); set +a; docker compose $(DEV_COMPOSE_FILES) logs -f --tail=200 $(DEV_LOG_SERVICES)

## 开发环境冒烟检查
dev-test-smoke:
	@echo "🧪 执行 dev 冒烟检查..."
	@set -e; \
	for url in \
		http://localhost:3000 \
		http://localhost:3002/api/health \
		http://localhost:8080/healthz \
		http://localhost:8085/healthz \
		http://localhost:8082/healthz \
		http://localhost:8083/healthz \
		http://localhost:8084/healthz \
		http://localhost:8081/healthz \
		http://localhost:9091/healthz \
		http://localhost:18081/subjects \
		http://localhost:8088/overview \
		http://localhost:19090/-/ready \
		http://localhost:19093/-/ready; do \
		echo "checking $$url"; \
		ok=0; \
		for attempt in $$(seq 1 240); do \
			if curl --noproxy '*' -fsS "$$url" >/dev/null; then \
				ok=1; \
				break; \
			fi; \
			sleep 1; \
		done; \
		if [ "$$ok" -ne 1 ]; then \
			echo "ERROR: smoke check failed for $$url"; \
			exit 1; \
		fi; \
	done; \
	echo "checking optional http://localhost:3001/healthz"; \
	if ! curl --noproxy '*' -fsS --max-time 5 "http://localhost:3001/healthz" >/dev/null; then \
		echo "WARN: optional bff health check not ready yet (http://localhost:3001/healthz)"; \
	fi; \
	echo "✅ dev 冒烟检查通过"

## 对正在运行的本地环境补齐数据库迁移（等待 postgres ready 后执行）
local-db-migrate-up:
	@echo "🗃️ 确保本地数据库迁移已执行..."
	@set -e; \
	for attempt in $$(seq 1 60); do \
		if docker exec $(LOCAL_PG_CONTAINER) pg_isready -U $(LOCAL_PG_USER) -d $(LOCAL_PG_DB) >/dev/null 2>&1; then \
			break; \
		fi; \
		if [ "$$attempt" -eq 60 ]; then \
			echo "ERROR: postgres not ready for migrations ($(LOCAL_PG_CONTAINER))"; \
			exit 1; \
		fi; \
		sleep 1; \
	done; \
	DB_DSN="$${DB_DSN:-$(LOCAL_DB_DSN)}" $(DB_MIGRATE_SCRIPT) up

## 对正在运行的本地环境执行链路自举（schema / alias / pull source / alert rule）
local-bootstrap:
	@echo "🧩 自举本地日志全链路..."
	@bash ./scripts/bootstrap-local-log-chain.sh

## 一键启动并完成本地持久化部署
local-deploy: dev-up local-db-migrate-up local-bootstrap
	@echo "✅ 本地持久化部署完成"

## api-service register 冒烟检查（需 SMOKE_TENANT_ID）
api-register-smoke:
	@if [ -z "$(SMOKE_TENANT_ID)" ]; then \
		echo "Usage: make api-register-smoke SMOKE_TENANT_ID=<tenant_uuid> [API_BASE_URL=http://localhost:8085]"; \
		exit 1; \
	fi
	@API_BASE_URL="$(API_BASE_URL)" SMOKE_TENANT_ID="$(SMOKE_TENANT_ID)" \
		./services/api-service/tests/register_smoke.sh

## api-service 认证落库核验（需 TEST_DB_DSN/VERIFY_TENANT_ID/VERIFY_USERNAME）
api-auth-storage-verify:
	@if [ -z "$(TEST_DB_DSN)" ] || [ -z "$(VERIFY_TENANT_ID)" ] || [ -z "$(VERIFY_USERNAME)" ]; then \
		echo "Usage: make api-auth-storage-verify TEST_DB_DSN=<postgres_dsn> VERIFY_TENANT_ID=<tenant_uuid> VERIFY_USERNAME=<username>"; \
		exit 1; \
	fi
	@TEST_DB_DSN="$(TEST_DB_DSN)" VERIFY_TENANT_ID="$(VERIFY_TENANT_ID)" VERIFY_USERNAME="$(VERIFY_USERNAME)" \
		./services/api-service/tests/verify_auth_storage.sh

## api-service 认证链路自动化测试（成功/失败）
api-auth-chain-test:
	@TEST_DB_DSN="$(TEST_DB_DSN)" TEST_REGEX="$(TEST_REGEX)" KEEP_ENV="$(KEEP_ENV)" \
		./tests/integration/run_auth_chain.sh

## gateway 路由与鉴权冒烟测试（任务 5.2）
gateway-auth-smoke-test:
	@GATEWAY_BASE_URL="$(GATEWAY_BASE_URL)" KEEP_ENV="$(KEEP_ENV)" \
		./tests/integration/run_gateway_auth_smoke.sh

## M1 发布前回滚演练（任务 5.3，服务与配置）
m1-rollback-drill:
	@GATEWAY_BASE_URL="$(GATEWAY_BASE_URL)" KEEP_ENV="$(KEEP_ENV)" \
		./tests/integration/run_m1_pre_release_rollback_drill.sh

## M1 发布后 30 分钟观察（任务 5.4）
m1-post-release-observe:
	@GATEWAY_BASE_URL="$(GATEWAY_BASE_URL)" OBSERVE_MINUTES="$(OBSERVE_MINUTES)" SAMPLE_INTERVAL_SEC="$(SAMPLE_INTERVAL_SEC)" REPORT_FILE="$(REPORT_FILE)" KEEP_ENV="$(KEEP_ENV)" \
		./tests/integration/run_m1_post_release_observation.sh

## M1 容器热更新门禁（任务 5.5）
m1-hot-reload-gate:
	@REPORT_FILE="$(REPORT_FILE)" KEEP_ENV="$(KEEP_ENV)" DEV_START_TIMEOUT_SEC="$(DEV_START_TIMEOUT_SEC)" HOT_RELOAD_TIMEOUT_SEC="$(HOT_RELOAD_TIMEOUT_SEC)" POLL_INTERVAL_SEC="$(POLL_INTERVAL_SEC)" \
		bash ./tests/integration/run_m1_hot_reload_gate.sh

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
	@echo "  make test                 - 运行所有测试"
	@echo "  make frontend-test        - 前端测试"
	@echo "  make backend-test         - 后端测试"
	@echo "  make test-contracts       - 校验 Schema contracts"
	@echo "  make stream-install-es    - 安装 ES v2 模板与读写别名"
	@echo "  make stream-register-schemas - 注册 Stream 主链 Schema Registry 契约"
	@echo "  make stream-deploy-local  - 向本地 Flink 提交 SQL 作业"
	@echo "  make stream-bootstrap-local - 完成本地 Stream 主链自举"
	@echo "  make stream-compare       - 对比 Pull / Stream 双路 event_id 样本"
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
	@echo "  make dev-up-lite    - 启动 dev 轻量热更新环境（低资源）"
	@echo "  make local-db-migrate-up - 对本地 postgres 执行迁移 up"
	@echo "  make dev-down       - 停止 dev 热更新环境"
	@echo "  make dev-logs       - 查看 dev 热更新日志"
	@echo "  make dev-test-smoke - 执行 dev 冒烟检查"
	@echo "  make api-register-smoke SMOKE_TENANT_ID=<uuid> [API_BASE_URL=http://localhost:8085] - 执行注册接口冒烟"
	@echo "  make api-auth-storage-verify TEST_DB_DSN=<dsn> VERIFY_TENANT_ID=<uuid> VERIFY_USERNAME=<name> - 执行认证落库核验"
	@echo "  make api-auth-chain-test [TEST_DB_DSN=<dsn>] [TEST_REGEX=<regex>] [KEEP_ENV=1] - 执行认证链路自动化测试（成功/失败）"
	@echo "  make gateway-auth-smoke-test [GATEWAY_BASE_URL=http://localhost:18080] [KEEP_ENV=1] - 执行网关路由与鉴权冒烟测试"
	@echo "  make m1-rollback-drill [GATEWAY_BASE_URL=http://localhost:18080] [KEEP_ENV=1] - 执行 M1 发布前回滚演练（服务与配置）"
	@echo "  make m1-post-release-observe [OBSERVE_MINUTES=30] [SAMPLE_INTERVAL_SEC=10] [REPORT_FILE=<path>] [KEEP_ENV=1] - 执行 M1 发布后指标观察"
	@echo "  make m1-hot-reload-gate [REPORT_FILE=<path>] [DEV_START_TIMEOUT_SEC=300] [HOT_RELOAD_TIMEOUT_SEC=120] [KEEP_ENV=1] - 执行 M1 容器热更新门禁"
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
