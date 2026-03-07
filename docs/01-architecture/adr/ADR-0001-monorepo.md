# ADR-0001: 采用 Monorepo 架构

## 状态

已接受

## 上下文

NexusLog 是一个企业级日志管理系统，包含多个组件：
- 前端控制台（React）
- 多个后端微服务（Go）
- API 网关（OpenResty）
- 基础设施配置（Kubernetes、Helm、Terraform）
- 可观测性配置（Prometheus、Grafana）

我们需要决定代码仓库的组织方式：
1. **Polyrepo**：每个组件独立仓库
2. **Monorepo**：所有组件在同一仓库

## 决策

我们决定采用 **Monorepo** 架构，使用以下工具链：
- **pnpm workspace**：管理前端项目依赖
- **Go workspace (go.work)**：管理多个 Go 模块
- **Makefile**：统一构建入口

## 理由

### 选择 Monorepo 的原因

1. **原子性变更**
   - 跨组件的变更可以在单个 PR 中完成
   - 避免多仓库间的版本协调问题

2. **代码共享**
   - 共享类型定义、工具函数、配置模板
   - 减少重复代码

3. **统一工具链**
   - 统一的 CI/CD 流水线
   - 统一的代码规范和检查工具

4. **简化依赖管理**
   - 组件间依赖关系清晰可见
   - 避免版本不一致问题

5. **更好的可发现性**
   - 新成员更容易理解系统全貌
   - 代码搜索更方便

### 潜在风险及缓解措施

| 风险 | 缓解措施 |
|------|----------|
| 仓库体积过大 | 使用 Git LFS、定期清理历史 |
| CI 构建时间长 | 增量构建、并行执行、缓存 |
| 权限管理复杂 | CODEOWNERS、分支保护规则 |
| 合并冲突增多 | 模块化设计、清晰的目录边界 |

## 后果

### 正面影响

- 开发体验提升，跨组件协作更顺畅
- 重构更安全，可以一次性更新所有引用
- 文档和配置集中管理

### 负面影响

- 需要学习 pnpm workspace 和 Go workspace
- 初始 clone 时间较长
- 需要更严格的代码审查流程

## 参考

- [Monorepo Explained](https://monorepo.tools/)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Go Workspaces](https://go.dev/doc/tutorial/workspaces)
