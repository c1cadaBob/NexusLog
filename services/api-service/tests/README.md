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
