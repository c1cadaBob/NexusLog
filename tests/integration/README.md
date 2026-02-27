# NexusLog Integration Tests

本目录用于维护后端集成测试框架与测试环境配置。

## 目录说明

- `docker-compose.test.yml`: 集成测试依赖环境（PostgreSQL + Redis）
- `integration-test.config.yaml`: 集成测试框架基础配置
- `run.sh`: 一键启动环境并执行基础连通性检查

## 本地执行

```bash
bash tests/integration/run.sh
```

## CI 执行

在 GitHub Actions `Backend CI` 流水线中执行：

```bash
bash tests/integration/run.sh
```
