# NexusLog Integration Tests

本目录用于维护后端集成测试框架与测试环境配置。

## 目录说明

- `docker-compose.test.yml`: 集成测试依赖环境（PostgreSQL + Redis）
- `docker-compose.gateway-smoke.yml`: 网关路由与鉴权冒烟依赖环境（Gateway + Mock Upstreams）
- `gateway-mock/`: 网关冒烟测试使用的轻量上游 Mock 服务
- `integration-test.config.yaml`: 集成测试框架基础配置
- `run.sh`: 一键启动环境并执行基础连通性检查
- `run_auth_chain.sh`: 一键执行认证链路自动化测试（成功/失败）
- `run_gateway_auth_smoke.sh`: 一键执行网关路由与鉴权冒烟测试
- `run_m1_pre_release_rollback_drill.sh`: 一键执行 M1 发布前回滚演练（服务与配置）
- `run_m1_post_release_observation.sh`: 一键执行 M1 发布后指标观察（错误率、延迟、登录成功率）
- `run_m1_hot_reload_gate.sh`: 一键执行 M1 容器热更新门禁（frontend + api-service）

## 本地执行

```bash
bash tests/integration/run.sh
```

认证链路（任务 5.1）：

```bash
bash tests/integration/run_auth_chain.sh
```

网关路由与鉴权（任务 5.2）：

```bash
bash tests/integration/run_gateway_auth_smoke.sh
```

M1 发布前回滚演练（任务 5.3）：

```bash
bash tests/integration/run_m1_pre_release_rollback_drill.sh
```

M1 发布后观察（任务 5.4）：

```bash
bash tests/integration/run_m1_post_release_observation.sh
```

M1 容器热更新门禁（任务 5.5）：

```bash
bash tests/integration/run_m1_hot_reload_gate.sh
```

## CI 执行

在 GitHub Actions `Backend CI` 流水线中执行：

```bash
bash tests/integration/run.sh
```
