# NexusLog BFF Service

NestJS-based BFF (Backend For Frontend) service for aggregating backend APIs.

## Endpoints

- `GET /healthz`: health check
- `GET /api/v1/bff/overview`: aggregate Control Plane, API Service, and Data Services status
  - `refresh=true|1`: bypass cache

## Runtime Env

- `BFF_PORT` (default: `3000`)
- `CONTROL_PLANE_BASE_URL` (default: `http://control-plane:8080`)
- `API_SERVICE_BASE_URL` (default: `http://api-service:8080`)
- `DATA_QUERY_BASE_URL` (default: `http://query-api:8082`)
- `DATA_AUDIT_BASE_URL` (default: `http://audit-api:8083`)
- `DATA_EXPORT_BASE_URL` (default: `http://export-api:8084`)
- `BFF_REQUEST_TIMEOUT_MS` (default: `2500`)
- `BFF_CACHE_TTL_MS` (default: `10000`)
