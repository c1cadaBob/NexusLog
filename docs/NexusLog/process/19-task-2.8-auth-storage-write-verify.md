# 任务 2.8 执行记录：认证安全表写入与核验

日期：2026-03-01  
任务：`2.8 写入并验证 user_sessions/password_reset_tokens/login_attempts`

## 1. 目标

在已完成 `2.1~2.7` 认证接口闭环基础上，固化以下验证能力：

1. `user_sessions` 有稳定写入，并可验证关键字段完整性。
2. `password_reset_tokens` 有稳定写入，并可验证哈希与过期字段完整性。
3. `login_attempts` 有稳定写入（`success` 与 `failed`），失败记录包含 reason。

## 2. 新增核验资产

1. SQL 核验脚本：`services/api-service/tests/sql/auth_storage_verification.sql`
2. 一键核验脚本：`services/api-service/tests/verify_auth_storage.sh`
3. Make 入口：`make api-auth-storage-verify`
4. 集成测试：`TestAuthStorageWriteAndVerifyIntegration`（`services/api-service/tests/auth_register_integration_test.go`）

## 3. 核验命令

### 3.1 自动化集成验证（推荐）

```bash
cd services/api-service
TEST_DB_DSN=postgres://user:pass@host:5432/db?sslmode=disable \
go test ./tests -run TestAuthStorageWriteAndVerifyIntegration -v
```

### 3.2 SQL 直接核验（针对指定租户与用户）

```bash
TEST_DB_DSN=postgres://user:pass@host:5432/db?sslmode=disable \
VERIFY_TENANT_ID=<tenant-uuid> \
VERIFY_USERNAME=<username> \
services/api-service/tests/verify_auth_storage.sh
```

或使用 Make：

```bash
make api-auth-storage-verify \
  TEST_DB_DSN=postgres://user:pass@host:5432/db?sslmode=disable \
  VERIFY_TENANT_ID=<tenant-uuid> \
  VERIFY_USERNAME=<username>
```

## 4. 字段完整性规则

### 4.1 `user_sessions`

1. `refresh_token_hash` 非空；
2. `access_token_jti` 非空；
3. `session_status` 属于 `active/revoked`；
4. `expires_at` 非空且晚于 `created_at`。

### 4.2 `password_reset_tokens`

1. `token_hash` 非空；
2. `token_hash` 长度为 64（sha256 hex）；
3. `expires_at` 晚于 `created_at`。

### 4.3 `login_attempts`

1. 至少存在 1 条 `success`；
2. 至少存在 1 条 `failed`；
3. `failed` 记录 `reason` 非空。

## 5. 结果说明

1. 认证闭环写入验证已沉淀为“测试 + SQL 脚本 + Make 命令”三层复验路径。
2. 满足任务清单中“数据库核验 SQL 结果（会话、重置、登录尝试）”的执行前提与可复验性要求。
