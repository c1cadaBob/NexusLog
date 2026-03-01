# api-service tests

## Register smoke script

`register_smoke.sh` verifies `POST /api/v1/auth/register` with six scenarios:

1. success register (`201`, `code=OK`)
2. duplicate username (`409`, `AUTH_REGISTER_USERNAME_CONFLICT`)
3. duplicate email (`409`, `AUTH_REGISTER_EMAIL_CONFLICT`)
4. missing `X-Tenant-ID` (`400`, `AUTH_REGISTER_TENANT_REQUIRED`)
5. invalid `X-Tenant-ID` (`400`, `AUTH_REGISTER_TENANT_INVALID`)
6. non-existing tenant (`404`, `AUTH_REGISTER_TENANT_NOT_FOUND`)

### Usage

```bash
API_BASE_URL=http://localhost:8085 \
SMOKE_TENANT_ID=<existing-active-tenant-uuid> \
services/api-service/tests/register_smoke.sh
```

Notes:
- `SMOKE_TENANT_ID` must already exist and be `active` in `obs.tenant`.
- Default `API_BASE_URL` is `http://localhost:8085`.
- Override path with `REGISTER_PATH` if needed.

## Auth storage verification (Task 2.8)

### Automated integration verification

`auth_register_integration_test.go` includes `TestAuthStorageWriteAndVerifyIntegration`, which verifies:

1. `user_sessions` is written with key fields (`refresh_token_hash`, `access_token_jti`, `session_status`, `expires_at`).
2. `password_reset_tokens` is written with key fields (`token_hash`, `expires_at`) and hash format.
3. `login_attempts` contains both `success` and `failed` records, and failed records include non-empty reason.

Run:

```bash
cd services/api-service
TEST_DB_DSN=postgres://user:pass@host:5432/db?sslmode=disable go test ./tests -run TestAuthStorageWriteAndVerifyIntegration -v
```

### SQL verification script

Use the SQL script to verify DB rows for a specific tenant/user after exercising auth APIs:

```bash
TEST_DB_DSN=postgres://user:pass@host:5432/db?sslmode=disable \
VERIFY_TENANT_ID=<tenant-uuid> \
VERIFY_USERNAME=<username> \
services/api-service/tests/verify_auth_storage.sh
```

The script executes `services/api-service/tests/sql/auth_storage_verification.sql` and fails fast when any required record/integrity check is missing.
