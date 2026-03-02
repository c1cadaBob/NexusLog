# Task 5.5 容器热更新门禁报告

- 日期：2026-03-02
- 观测窗口：2026-03-02T09:54:38Z ~ 2026-03-02T09:55:23Z
- 执行时长（秒）：45
- dev compose：`docker-compose.yml + docker-compose.override.yml`
- prod compose：`docker-compose.yml`

## 门禁结果

| 检查项 | 结果 | 说明 |
|---|---|---|
| frontend 热更新生效 | PASS | 通过修改 `apps/frontend-console/src/App.tsx` 并验证 dev 响应已生效 |
| api-service 热更新生效 | PASS | 通过修改 `services/api-service/cmd/api/main.go` 触发 air 重编译 |
| dev/prod compose 路径隔离 | PASS | dev 含 watcher，prod 不含 dev watcher 命令 |

## 关键证据

1. frontend 探针命中耗时：1s  
   日志：`frontend-console-1  | 9:55:17 AM [vite] (client) page reload src/App.tsx`
2. api-service 探针命中耗时：2s  
   日志：`api-service-1  | [GIN-debug] POST   /api/v1/auth/register     --> github.com/nexuslog/api-service/internal/handler.(*AuthHandler).Register-fm (4 handlers)cmd/api/main.go has changed`
3. 可用性检查：
   - frontend: `GET http://127.0.0.1:3000`（探针前后 2xx）
   - api-service: `GET http://127.0.0.1:8085/healthz`（探针前后 2xx）

## 结论

- frontend 与 api-service 在 dev 容器路径下均可自动热更新生效。
- 生产式 compose 路径未包含 dev watcher 配置，满足“热更新门禁通过且不影响生产式 compose 路径”。

## 附件

- 执行命令：`make m1-hot-reload-gate`
- 脚本路径：`tests/integration/run_m1_hot_reload_gate.sh`

