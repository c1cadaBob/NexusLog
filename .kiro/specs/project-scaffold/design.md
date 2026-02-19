# 设计文档：NexusLog 项目目录结构补全

## 概述

本设计文档描述如何补全 NexusLog 项目仓库中缺失的目录结构。核心策略是：
- 空目录使用 `.gitkeep` 占位
- 配置文件生成带中文注释的模板
- Go 服务生成 `go.mod` 和 `main.go` 基础骨架
- Dockerfile 生成多阶段构建模板
- 所有操作通过直接创建文件完成，无需额外工具或脚本

## 架构

本任务不涉及运行时架构设计，而是仓库目录结构的物理布局。目录结构按照架构文档中的业务域划分组织：

```
NexusLog/
├── apps/                    # 应用层（前端、BFF）
├── agents/                  # 采集代理
├── contracts/               # 契约定义
├── edge/                    # 边缘计算（可选）
├── gateway/                 # API 网关（已有）
├── iam/                     # 身份认证与授权
├── infra/                   # 基础设施即代码
├── messaging/               # 消息传输
├── ml/                      # 机器学习（可选）
├── observability/           # 可观测性
├── platform/                # 平台治理
├── services/                # 微服务（已有，需补全）
├── storage/                 # 存储配置
├── stream/                  # 流计算
├── configs/                 # 环境配置（已有）
├── docs/                    # 文档（已有）
├── scripts/                 # 脚本（已有）
├── tests/                   # 测试（已有）
└── .github/workflows/       # CI/CD 流水线
```

## 组件与接口

### 1. 目录创建策略

每个模块的目录创建遵循统一模式：
- 叶子目录放置 `.gitkeep` 文件（内容为空）
- 需要配置模板的目录放置带注释的 YAML/配置文件
- Go 服务目录包含 `go.mod`、`main.go`、`Dockerfile`

### 2. 配置模板规范

| 模板类型 | 文件 | 内容要求 |
|----------|------|----------|
| Prometheus | `prometheus.yml` | 全局配置、抓取目标、规则文件引用 |
| Alertmanager | `alertmanager.yml` | 路由配置、接收器定义、抑制规则 |
| Dockerfile (Go) | `Dockerfile` | 多阶段构建：编译 + 运行 |
| Dockerfile (Node) | `Dockerfile` | 多阶段构建：构建 + 运行 |
| Go 入口 | `main.go` | package main + 基础启动逻辑 |
| Go 模块 | `go.mod` | module 声明 + Go 版本 |
| Node 包 | `package.json` | name + version + scripts |

### 3. Go 服务模板

```go
// main.go 模板
package main

import (
    "fmt"
    "os"
)

func main() {
    fmt.Println("服务启动中...")
    os.Exit(0)
}
```

```dockerfile
# Go Dockerfile 模板
FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /bin/service ./cmd/*/main.go

FROM alpine:3.19
RUN apk --no-cache add ca-certificates tzdata
COPY --from=builder /bin/service /bin/service
ENTRYPOINT ["/bin/service"]
```

## 数据模型

本任务不涉及运行时数据模型。文件系统结构即为"数据模型"：

- `.gitkeep`: 空文件，用于 Git 追踪空目录
- 配置模板: YAML 格式，包含中文注释和占位值
- Go 源码: 最小可编译的骨架代码
- Dockerfile: 多阶段构建模板

## 正确性属性

*正确性属性是指在系统所有有效执行中都应成立的特征或行为——本质上是关于系统应该做什么的形式化陈述。属性是人类可读规范与机器可验证正确性保证之间的桥梁。*

经过 prework 分析和属性反射，大量目录存在性验证可以合并为少数综合属性：

Property 1: 目录结构完整性
*For any* 架构文档中定义的必需目录路径，该路径在文件系统中应存在，且如果该目录为叶子目录（不包含子目录或非 .gitkeep 文件），则应包含 `.gitkeep` 文件。
**Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 4.1, 4.2, 4.3, 5.1, 6.1, 6.2, 6.3, 6.4, 6.5, 7.3, 7.4, 7.5, 7.6, 8.1, 8.2, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 10.1, 10.2, 11.1, 12.1, 13.1, 13.2, 13.3, 13.4, 14.1**

Property 2: 配置模板包含中文注释
*For any* 生成的配置模板文件（prometheus.yml、alertmanager.yml），文件内容应包含中文注释说明各配置段的用途。
**Validates: Requirements 7.1, 7.2, 14.2**

Property 3: Go 模块文件有效性
*For any* 包含 go.mod 的 Go 服务目录，go.mod 文件应包含有效的 `module` 声明和 `go` 版本声明。
**Validates: Requirements 2.4, 14.3**

Property 4: Dockerfile 模板有效性
*For any* 生成的 Dockerfile，文件应包含至少一个 `FROM` 指令定义构建阶段。
**Validates: Requirements 2.4, 12.2, 14.4**

## 错误处理

本任务为目录和文件创建，错误场景有限：
- 目录已存在：跳过创建，不覆盖
- 文件已存在：跳过创建，保留现有内容
- 权限不足：报告错误并继续处理其他目录

## 测试策略

由于本任务主要是文件系统操作（创建目录和文件），测试策略以验证脚本为主：

- **验证脚本**: 编写 shell 脚本遍历所有预期路径，检查目录和文件是否存在
- **内容检查**: 验证配置模板文件包含必要的配置段和中文注释
- **Go 编译检查**: 对包含 Go 代码的目录执行 `go build` 验证语法正确性

属性测试在本场景中不适用，因为操作是确定性的文件创建，不涉及随机输入。验证通过遍历预定义的路径清单完成。

