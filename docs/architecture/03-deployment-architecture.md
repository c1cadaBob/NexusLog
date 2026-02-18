# 部署架构

## 概述

本文档描述 NexusLog 系统的部署架构，包括 Kubernetes 集群拓扑和资源规划。

## 集群拓扑

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes Cluster                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Ingress Controller                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    nexuslog-gateway                      │    │
│  │                    (OpenResty Pods)                      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ control-plane│ │ api-service  │ │ data-services│            │
│  │   (3 pods)   │ │   (3 pods)   │ │   (3 pods)   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
│                              │                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│  │ Elasticsearch│ │ PostgreSQL   │ │ Redis Cluster│            │
│  │  (3 nodes)   │ │  (Patroni)   │ │  (6 nodes)   │            │
│  └──────────────┘ └──────────────┘ └──────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Namespace 规划

| Namespace | 用途 | 组件 |
|-----------|------|------|
| nexuslog-gateway | API 网关 | OpenResty |
| nexuslog-services | 业务服务 | control-plane, api-service, data-services |
| nexuslog-storage | 存储组件 | Elasticsearch, PostgreSQL, Redis |
| nexuslog-messaging | 消息组件 | Kafka, Schema Registry |
| nexuslog-observability | 可观测性 | Prometheus, Grafana, Jaeger |
| nexuslog-iam | 身份认证 | Keycloak, OPA |

## 资源规划

### 生产环境最小配置

| 组件 | CPU | 内存 | 存储 | 副本数 |
|------|-----|------|------|--------|
| Frontend | 0.5 | 512Mi | - | 2 |
| API Gateway | 1 | 1Gi | - | 3 |
| Control Plane | 1 | 2Gi | - | 3 |
| API Service | 1 | 2Gi | - | 3 |
| Elasticsearch | 4 | 16Gi | 500Gi | 3 |
| PostgreSQL | 2 | 8Gi | 100Gi | 3 |
| Redis | 1 | 4Gi | 20Gi | 6 |
| Kafka | 2 | 8Gi | 200Gi | 3 |

## 待补充

- [ ] 网络策略
- [ ] 存储类配置
- [ ] 自动扩缩容策略
