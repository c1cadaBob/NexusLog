# 任务 2.7 执行记录：认证接口统一响应结构与错误码

日期：2026-03-01  
范围：`services/api-service` 认证接口（`register/login/refresh/logout/reset-request/reset-confirm`）

## 1. 统一响应结构

成功响应统一为：

```json
{
  "code": "OK",
  "message": "success",
  "request_id": "gw-1700000000-127.0.0.1",
  "data": {},
  "meta": {}
}
```

失败响应统一为：

```json
{
  "code": "AUTH_LOGIN_INVALID_CREDENTIALS",
  "message": "username or password is incorrect",
  "request_id": "gw-1700000000-127.0.0.1",
  "details": {}
}
```

说明：
1. 所有错误响应固定包含 `code/message/request_id/details` 四个字段。
2. `details` 不再省略，缺省时返回空对象 `{}`。
3. `request_id` 优先使用 `X-Request-ID`，缺失时服务端生成 fallback。

## 2. 认证错误码对照表（Task 2.1~2.6 覆盖范围）

### 2.1 Register

| HTTP | 业务码 |
|---|---|
| 400 | `AUTH_REGISTER_INVALID_ARGUMENT` |
| 400 | `AUTH_REGISTER_TENANT_REQUIRED` |
| 400 | `AUTH_REGISTER_TENANT_INVALID` |
| 404 | `AUTH_REGISTER_TENANT_NOT_FOUND` |
| 409 | `AUTH_REGISTER_USERNAME_CONFLICT` |
| 409 | `AUTH_REGISTER_EMAIL_CONFLICT` |
| 500 | `AUTH_REGISTER_INTERNAL_ERROR` |

### 2.2 Login

| HTTP | 业务码 |
|---|---|
| 400 | `AUTH_LOGIN_INVALID_ARGUMENT` |
| 400 | `AUTH_LOGIN_TENANT_REQUIRED` |
| 400 | `AUTH_LOGIN_TENANT_INVALID` |
| 404 | `AUTH_LOGIN_TENANT_NOT_FOUND` |
| 401 | `AUTH_LOGIN_INVALID_CREDENTIALS` |
| 500 | `AUTH_LOGIN_INTERNAL_ERROR` |

### 2.3 Refresh

| HTTP | 业务码 |
|---|---|
| 400 | `AUTH_REFRESH_INVALID_ARGUMENT` |
| 400 | `AUTH_REFRESH_TENANT_REQUIRED` |
| 400 | `AUTH_REFRESH_TENANT_INVALID` |
| 404 | `AUTH_REFRESH_TENANT_NOT_FOUND` |
| 401 | `AUTH_REFRESH_INVALID_TOKEN` |
| 500 | `AUTH_REFRESH_INTERNAL_ERROR` |

### 2.4 Logout

| HTTP | 业务码 |
|---|---|
| 400 | `AUTH_LOGOUT_INVALID_ARGUMENT` |
| 400 | `AUTH_LOGOUT_TENANT_REQUIRED` |
| 400 | `AUTH_LOGOUT_TENANT_INVALID` |
| 404 | `AUTH_LOGOUT_TENANT_NOT_FOUND` |
| 401 | `AUTH_LOGOUT_INVALID_TOKEN` |
| 500 | `AUTH_LOGOUT_INTERNAL_ERROR` |

### 2.5 Password Reset Request

| HTTP | 业务码 |
|---|---|
| 400 | `AUTH_RESET_REQUEST_INVALID_ARGUMENT` |
| 400 | `AUTH_RESET_REQUEST_TENANT_REQUIRED` |
| 400 | `AUTH_RESET_REQUEST_TENANT_INVALID` |
| 404 | `AUTH_RESET_REQUEST_TENANT_NOT_FOUND` |
| 500 | `AUTH_RESET_REQUEST_INTERNAL_ERROR` |

### 2.6 Password Reset Confirm

| HTTP | 业务码 |
|---|---|
| 400 | `AUTH_RESET_CONFIRM_INVALID_ARGUMENT` |
| 400 | `AUTH_RESET_CONFIRM_TENANT_REQUIRED` |
| 400 | `AUTH_RESET_CONFIRM_TENANT_INVALID` |
| 404 | `AUTH_RESET_CONFIRM_TENANT_NOT_FOUND` |
| 400 | `AUTH_RESET_CONFIRM_INVALID_TOKEN` |
| 500 | `AUTH_RESET_CONFIRM_INTERNAL_ERROR` |

## 3. 代码落点

1. 错误码目录与标准化：`services/api-service/internal/model/api_error_catalog.go`
2. 统一错误输出：`services/api-service/internal/httpx/response.go`
3. 统一性测试：
   - `services/api-service/internal/model/api_error_catalog_test.go`
   - `services/api-service/internal/handler/auth_handler_test.go`（错误 envelope 含 `details`）

