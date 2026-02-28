# 当前项目适配任务文档（任务基线）

## 1. 概述

本任务文档将需求 `R1~R9` 和差异项 `GAP-001~GAP-018` 转化为可执行任务。  
任务按 `M1 -> M2 -> M3` 编排，按周推进，遵循：

1. 先清 P0，再处理 P1/P2
2. 每条任务都要有验证证据
3. 每周必须具备回滚方案

## 2. 状态说明

- `[ ]` 未开始
- `[~]` 进行中
- `[x]` 已完成
- `[-]` 阻塞

## 3. 任务清单

### M1：认证与迁移一致性（Week1~Week2）

- [ ] 1. 统一迁移真相源并完成演练（R1）
  - [ ] 1.1 确认 `storage/postgresql/migrations` 为唯一迁移入口
  - [ ] 1.2 执行 `000012`、`000015` 的 `up/down` 演练并归档日志
  - [ ] 1.3 更新相关文档中“迁移执行态”说明（对应 GAP-015）
  - 关联差异：GAP-015

- [ ] 2. 实现认证最小闭环 API（R2）
  - [ ] 2.1 在 `api-service` 实现 `/api/v1/auth/register`、`/login`
  - [ ] 2.2 实现 `/refresh`、`/logout`、`/password/reset-request`、`/password/reset-confirm`
  - [ ] 2.3 完成 `user_sessions/password_reset_tokens/login_attempts` 落库逻辑
  - 关联差异：GAP-001, GAP-008

- [ ] 3. 改造前端认证主路径（R2）
  - [ ] 3.1 `LoginForm` 从本地状态改为真实接口调用
  - [ ] 3.2 `ProtectedRoute` 加入 token 失效处理与重定向
  - [ ] 3.3 `/forgot-password` 对接真实接口
  - 关联差异：GAP-001

- [ ] 4. 修正网关路由与白名单一致性（R3）
  - [ ] 4.1 统一 `/api/v1/query|audit|export|auth|bff/*` 路由规则
  - [ ] 4.2 修复 upstream 服务名/端口与 compose 不一致问题
  - [ ] 4.3 同步白名单为 `password/reset-request` 与 `reset-confirm`
  - 关联差异：GAP-002, GAP-011, GAP-012

- [ ] 5. M1 测试与发布门禁（R8）
  - [ ] 5.1 认证链路自动化：成功/失败各 1 条
  - [ ] 5.2 网关路由冒烟与统一错误码测试
  - [ ] 5.3 发布后 30 分钟观察并形成报告
  - 关联差异：GAP-016

### M2：接入与可追溯闭环（Week3~Week4）

- [ ] 6. 实现接入控制面接口（R4）
  - [ ] 6.1 `control-plane` 实现 `pull-sources` 管理接口
  - [ ] 6.2 实现 `pull-tasks/run` 与 `pull-tasks` 状态查询
  - [ ] 6.3 实现 `packages`、`receipts`、`dead-letters/replay` 接口
  - 关联差异：GAP-009

- [ ] 7. 实现 Agent 主路径能力（R4）
  - [ ] 7.1 完成文件增量读取逻辑（替换 TODO）
  - [ ] 7.2 完成 syslog listener（UDP/TCP）
  - [ ] 7.3 完成 Kafka 真发送主路径（替换模拟发送）
  - [ ] 7.4 验证重试与缓存重放
  - 关联差异：GAP-018

- [ ] 8. 完成接入链路落库与幂等（R4）
  - [ ] 8.1 打通 `ingest_pull_sources/ingest_pull_tasks`
  - [ ] 8.2 打通 `agent_incremental_packages/agent_package_files`
  - [ ] 8.3 打通 `ingest_delivery_receipts/ingest_file_checkpoints/ingest_dead_letters`
  - [ ] 8.4 验证 `package_no + checksum` 幂等约束
  - 关联差异：GAP-018

- [ ] 9. 健康检测目标动态化（R8）
  - [ ] 9.1 `health-worker` 从配置中心或数据库读取目标列表
  - [ ] 9.2 实现动态刷新与失败兜底
  - 关联差异：GAP-017

- [ ] 10. M2 测试与发布门禁（R8）
  - [ ] 10.1 拉取任务成功/失败/重试测试
  - [ ] 10.2 ACK/NACK、死信重放测试
  - [ ] 10.3 At-least-once 场景验证与链路追踪报告
  - 关联差异：GAP-016, GAP-018

### M3：检索与治理闭环（Week5~Week6）

- [ ] 11. 实现 query-api 真实检索接口（R5）
  - [ ] 11.1 实现 `POST /api/v1/query/logs`
  - [ ] 11.2 实现 `GET/DELETE /api/v1/query/history`
  - [ ] 11.3 实现 `GET/POST/PUT/DELETE /api/v1/query/saved`
  - 关联差异：GAP-005, GAP-006, GAP-010

- [ ] 12. 完成前端检索模块去 Mock（R5）
  - [ ] 12.1 `/search/realtime` 去 `MOCK_*` 主路径
  - [ ] 12.2 `/search/history` 接真实接口
  - [ ] 12.3 `/search/saved` 接真实接口
  - 关联差异：GAP-005, GAP-006

- [ ] 13. 统一检索接口命名并修正文档（R5/R9）
  - [ ] 13.1 统一采用 `/api/v1/query/*`
  - [ ] 13.2 同步更新 `04/05/06/07/08/09/10` 文档
  - 关联差异：GAP-003

- [ ] 14. 实现治理最小闭环 API（R6）
  - [ ] 14.1 `audit-api` 实现 `GET /api/v1/audit/logs`
  - [ ] 14.2 `api-service` 实现 `alerts/rules` CRUD
  - [ ] 14.3 `api-service` 实现 `security/users`、`security/roles` 管理接口
  - 关联差异：GAP-007, GAP-010

- [ ] 15. 完成前端治理模块接入（R6）
  - [ ] 15.1 `/security/audit` 对接审计查询
  - [ ] 15.2 `/alerts/rules` 对接规则 CRUD
  - [ ] 15.3 `/security/users`、`/security/roles` 对接真实接口
  - 关联差异：GAP-007

- [ ] 16. Dashboard 聚合能力对齐（R6/R9）
  - [ ] 16.1 以 `bff/overview` 为主接入 Dashboard
  - [ ] 16.2 明确是否保留 `/api/v1/dashboard/overview` 命名并统一文档
  - 关联差异：GAP-004

- [ ] 17. M3 测试与发布门禁（R8）
  - [ ] 17.1 检索链路：成功/超时/鉴权失败测试
  - [ ] 17.2 治理链路：用户角色、告警规则、审计查询测试
  - [ ] 17.3 端到端：`/login -> / -> /search/realtime` + `/security/*` + `/alerts/rules`
  - 关联差异：GAP-016

## 4. 文档与治理任务（跨里程碑）

- [ ] 18. 修正 README 与本地运行事实一致性（R9）
  - [ ] 18.1 明确 gateway 在本地 compose 的运行模式说明
  - [ ] 18.2 修正 frontend `src/services/hooks/utils` 结构描述偏差
  - 关联差异：GAP-013, GAP-014

- [ ] 19. 每周更新差异状态与证据（R9）
  - [ ] 19.1 更新 `07` 中 `GAP-001~018` 的 `open/in-progress/closed`
  - [ ] 19.2 补充 PR、测试报告、监控截图链接
  - [ ] 19.3 未关闭 P0 项时阻断里程碑“完成”标记
  - 关联差异：GAP-001~GAP-018

## 5. 验收清单（里程碑级）

- [ ] 20. M1 验收
  - [ ] 20.1 认证全流程可用
  - [ ] 20.2 网关鉴权与路由一致
  - [ ] 20.3 迁移单入口且可回滚演练

- [ ] 21. M2 验收
  - [ ] 21.1 主动拉取链路可用
  - [ ] 21.2 增量包 + ACK/NACK + 死信重放可用
  - [ ] 21.3 接入链路可追溯且满足 at-least-once

- [ ] 22. M3 验收
  - [ ] 22.1 检索闭环可用且前端去 mock
  - [ ] 22.2 审计/告警/用户角色闭环可用
  - [ ] 22.3 关键 P0 差异项全部关闭

## 6. 执行规则

1. 任何任务标记 `[x]` 前必须附证据（PR、测试、监控、回滚演练）。
2. 发布任务必须包含回滚动作和触发条件。
3. 接口与数据表变更必须同步更新 `08/09/10` 文档基线。

## 7. 版本记录

- `v1.0`（2026-02-28）：首次生成当前项目适配任务基线，映射 M1~M3 与 GAP 闭环。

