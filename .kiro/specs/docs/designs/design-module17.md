# 模块十七：备份系统增强 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-02-01  
> **状态**: 已发布  
> **相关需求**: [requirements-module17.md](../requirements/requirements-module17.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-02-01 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态

- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP (需求17-1至17-5, 17-7), Phase 2 (需求17-6, 17-8, 17-9)

### 1.3 相关文档
- [需求文档](../requirements/requirements-module17.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块2设计文档](./design-module2.md) - 参考存储架构

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                备份系统增强模块整体架构                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            前端层（React + Ant Design）                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │ │
│  │  │ 备份创建对话框│    │ 备份列表页面  │    │ 空间管理面板  │    │ 导入导出界面  │       │ │
│  │  │ • 名称/备注  │    │ • 筛选/排序  │    │ • 空间统计   │    │ • 上传/下载  │       │ │
│  │  │ • 路径选择   │    │ • 批量操作   │    │ • 清理策略   │    │ • 进度显示   │       │ │
│  │  │ • 索引模式   │    │ • 下载按钮   │    │ • 告警设置   │    │ • 断点续传   │       │ │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │ │
│  └─────────┼────────────────────┼────────────────────┼────────────────────┼─────────────┘ │
│            │                    │                    │                    │               │
│            ▼                    ▼                    ▼                    ▼               │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            API 层（RESTful API）                                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │  POST   /api/v1/backups              创建备份（支持自定义配置）              │    │ │
│  │  │  GET    /api/v1/backups              列出备份（支持筛选/排序）                │    │ │
│  │  │  GET    /api/v1/backups/{id}         获取备份详情                            │    │ │
│  │  │  PUT    /api/v1/backups/{id}         更新备份（名称/备注）                   │    │ │
│  │  │  DELETE /api/v1/backups/{id}         删除备份                                │    │ │
│  │  │  GET    /api/v1/backups/{id}/download 下载备份包                             │    │ │
│  │  │  POST   /api/v1/backups/import      导入备份包                              │    │ │
│  │  │  GET    /api/v1/backups/stats       获取备份统计                            │    │ │
│  │  │  GET    /api/v1/backups/paths       获取可用路径列表                        │    │ │
│  │  │  POST   /api/v1/backups/{id}/cancel 取消备份操作                            │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            业务逻辑层（Backup Manager）                                │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        增量备份管理器                                         │    │ │
│  │  │  • 基于时间戳的增量备份（只备份新增日志）                                    │    │ │
│  │  │  • 依赖关系追溯（BasedOn 字段）                                              │    │ │
│  │  │  • 恢复时的依赖检查                                                          │    │ │
│  │  │  • 备份链管理                                                                │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        路径管理器                                             │    │ │
│  │  │  • 自定义路径验证（存在性/权限/空间）                                        │    │ │
│  │  │  • 默认路径管理                                                              │    │ │
│  │  │  • 路径创建（如果不存在）                                                    │    │ │
│  │  │  • 磁盘空间监控                                                              │    │ │
│  │  │  • 多路径负载均衡                                                            │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        导出/导入管理器                                        │    │ │
│  │  │  • 备份打包（tar.gz 格式）                                                   │    │ │
│  │  │  • 元数据导出（JSON 格式）                                                   │    │ │
│  │  │  • 分块下载支持（>100MB）                                                    │    │ │
│  │  │  • 断点续传（HTTP Range）                                                    │    │ │
│  │  │  • 校验和验证（SHA-256）                                                     │    │ │
│  │  │  • 备份包解压和导入                                                          │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        命名与元数据管理器                                     │    │ │
│  │  │  • 自定义名称验证（格式/唯一性）                                             │    │ │
│  │  │  • 默认名称生成                                                              │    │ │
│  │  │  • 备注管理（最多 500 字符）                                                 │    │ │
│  │  │  • 修改历史记录                                                              │    │ │
│  │  │  • 实时名称验证                                                              │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        空间管理器                                             │    │ │
│  │  │  • 总空间统计                                                                │    │ │
│  │  │  • 路径级空间监控                                                            │    │ │
│  │  │  • 自动清理策略（保留N个/N天/最小空间）                                      │    │ │
│  │  │  • 空间告警（阈值监控）                                                      │    │ │
│  │  │  • 定期清理任务                                                              │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        错误处理管理器                                         │    │ │
│  │  │  • 结构化错误响应                                                            │    │ │
│  │  │  • 错误分类和处理                                                            │    │ │
│  │  │  • 操作取消支持                                                              │    │ │
│  │  │  • 临时文件清理                                                              │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            存储层                                                      │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Elasticsearch│───▶│ 文件系统     │───▶│ PostgreSQL   │                           │ │
│  │  │ Snapshot API │    │ (备份数据)   │    │ (元数据)     │                           │ │
│  │  │ (快照管理)   │    │ /var/lib/... │    │ 名称/备注/路径│                           │ │
│  │  │ • 全量快照   │    │ • tar.gz包   │    │ • 配置表     │                           │ │
│  │  │ • 增量快照   │    │ • 校验和     │    │ • 历史记录   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 增量备份管理器 | 管理增量备份逻辑 | 时间戳过滤、依赖追溯、备份链管理、恢复验证 |
| 路径管理器 | 管理备份存储路径 | 路径验证、空间检查、自动创建、多路径支持 |
| 导出/导入管理器 | 处理备份导入导出 | tar.gz打包、元数据导出、断点续传、校验和验证 |
| 命名与元数据管理器 | 管理备份元数据 | 名称验证、默认生成、备注管理、历史记录 |
| 空间管理器 | 监控和管理存储空间 | 空间统计、自动清理、告警通知、清理策略 |
| 错误处理管理器 | 统一错误处理 | 错误分类、结构化响应、操作取消、资源清理 |

### 2.3 关键路径

**创建增量备份路径**:
```
用户请求 → 验证配置 → 查找基准备份 → 计算时间范围 → 创建ES快照 
  → 保存元数据 → 更新统计 → 返回结果

备份延迟: < 30秒（小型备份），< 5分钟（大型备份）
```

**备份下载路径**:
```
下载请求 → 验证备份状态 → 导出备份包 → 计算校验和 → 分块传输 
  → 支持断点续传 → 清理临时文件

下载延迟: 取决于文件大小和网络带宽
```

**空间管理路径**:
```
定时任务(每小时) → 统计各路径空间 → 检查告警阈值 → 执行清理策略 
  → 删除过期备份 → 发送告警通知

清理延迟: < 5分钟
```

**配置热更新路径**:
```
配置变更 → 保存到PostgreSQL → 发布Redis Pub/Sub → 各节点订阅 
  → 验证配置 → 原子更新 → 记录审计日志

生效延迟: < 3秒
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、并发支持、丰富的标准库、适合系统级编程 |
| Gin | 1.9+ | 轻量级Web框架、高性能、中间件支持、易于使用 |
| Elasticsearch Snapshot API | 7.x/8.x | 官方快照API、可靠性高、支持增量备份、与ES深度集成 |
| PostgreSQL | 15+ | 元数据存储、ACID事务、JSON支持、丰富的数据类型 |
| Redis | 7.x | 配置缓存、Pub/Sub通知、高性能、数据结构丰富 |
| tar + gzip | - | 标准压缩格式、跨平台兼容、压缩率高、工具链成熟 |
| SHA-256 | - | 校验和算法、安全性高、碰撞概率低、广泛支持 |
| React | 18+ | 前端框架、组件化、虚拟DOM、生态丰富 |
| Ant Design | 5.x | UI组件库、企业级、中文友好、组件丰富 |
| syscall.Statfs | - | 系统调用、实时磁盘空间、跨平台、性能高 |

### 3.2 备份方式对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **Elasticsearch Snapshot API** (选用) | • 官方支持<br>• 可靠性高<br>• 支持增量<br>• 与ES深度集成 | • 依赖ES版本<br>• 需要配置仓库 | 生产环境、大规模数据 |
| 直接复制索引文件 | • 速度快<br>• 简单直接 | • 需要停止ES<br>• 不支持增量<br>• 可能损坏 | 小规模、测试环境 |
| Reindex API | • 灵活性高<br>• 可跨集群 | • 速度慢<br>• 占用资源多<br>• 不保留设置 | 数据迁移、索引重建 |
| 第三方工具(elasticdump) | • 功能丰富<br>• 易于使用 | • 性能较差<br>• 依赖外部工具<br>• 维护成本高 | 小规模数据、临时备份 |

### 3.3 压缩算法对比

| 算法 | 压缩率 | 压缩速度 | 解压速度 | CPU占用 | 选择理由 |
|------|--------|----------|----------|---------|----------|
| **gzip** (选用) | 中等(60-70%) | 中等 | 快 | 中等 | 平衡性能和压缩率、兼容性好 |
| lz4 | 低(50-60%) | 极快 | 极快 | 低 | 适合实时压缩 |
| zstd | 高(70-80%) | 快 | 快 | 中等 | 高压缩率场景 |
| bzip2 | 高(75-85%) | 慢 | 慢 | 高 | 存储空间受限场景 |

---

## 4. 关键流程设计

### 4.1 增量备份创建流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     增量备份创建流程                             │
└─────────────────────────────────────────────────────────────────┘

1. 用户发起增量备份请求
   ↓
2. 验证请求参数（名称、路径、索引模式）
   ↓
3. 查找最近的全量备份作为基准
   ├─ 如果不存在 → 返回错误，提示先创建全量备份
   └─ 如果存在 → 继续
   ↓
4. 计算增量时间范围
   • start_time = 基准备份的 end_time
   • end_time = 当前时间
   ↓
5. 构建时间范围查询
   • 使用 @timestamp 字段过滤
   • 只包含增量时间范围内的日志
   ↓
6. 调用 Elasticsearch Snapshot API
   • 创建快照
   • 设置 metadata (type=incremental, based_on=基准ID)
   ↓
7. 保存元数据到 PostgreSQL
   • 记录 BasedOn 字段
   • 记录时间范围
   ↓
8. 异步等待快照完成
   • 轮询快照状态
   • 更新统计信息（大小、文档数）
   ↓
9. 返回备份ID和状态
```

**时序图**:
```
用户      API Server    Backup Manager    Elasticsearch    PostgreSQL
 │            │               │                 │               │
 │─创建增量备份→│               │                 │               │
 │            │─验证参数───────→│                 │               │
 │            │               │─查找基准备份─────→│               │
 │            │               │←返回基准信息─────│               │
 │            │               │                 │               │
 │            │               │─创建快照─────────→│               │
 │            │               │                 │               │
 │            │               │─保存元数据───────────────────────→│
 │            │               │                 │               │
 │←返回备份ID──│←返回结果──────│                 │               │
 │            │               │                 │               │
 │            │               │─轮询状态─────────→│               │
 │            │               │←快照完成─────────│               │
 │            │               │                 │               │
 │            │               │─更新统计─────────────────────────→│
```

### 4.2 备份下载流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     备份下载流程                                 │
└─────────────────────────────────────────────────────────────────┘

1. 用户请求下载备份
   ↓
2. 验证备份是否存在
   ├─ 不存在 → 返回 404
   └─ 存在 → 继续
   ↓
3. 检查备份状态
   ├─ 状态不是 SUCCESS → 返回 400
   └─ 状态是 SUCCESS → 继续
   ↓
4. 检查是否已有导出文件
   ├─ 已存在 → 直接使用
   └─ 不存在 → 创建导出包
   ↓
5. 创建导出包（如果需要）
   ├─ 创建临时目录
   ├─ 导出元数据为 JSON
   ├─ 复制快照数据
   ├─ 打包为 tar.gz
   ├─ 计算 SHA-256 校验和
   └─ 清理临时目录
   ↓
6. 处理 HTTP Range 请求（断点续传）
   ├─ 有 Range 头 → 返回部分内容 (206)
   └─ 无 Range 头 → 返回完整文件 (200)
   ↓
7. 设置响应头
   • Content-Type: application/gzip
   • Content-Disposition: attachment
   • Accept-Ranges: bytes
   ↓
8. 流式传输文件
   ↓
9. 记录下载日志
```

### 4.3 空间自动清理流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     空间自动清理流程                             │
└─────────────────────────────────────────────────────────────────┘

1. 定时任务触发（每小时）
   ↓
2. 检查清理策略是否启用
   ├─ 未启用 → 退出
   └─ 已启用 → 继续
   ↓
3. 查询所有成功的备份（按时间排序）
   ↓
4. 遍历备份，应用清理规则
   ├─ 规则1: 保留最近 N 个备份
   │   • 超出数量的标记删除
   │
   ├─ 规则2: 保留 N 天内的备份
   │   • 超过天数的标记删除
   │
   └─ 规则3: 保证最小可用空间
       • 空间不足时删除最旧的备份
   ↓
5. 执行删除操作
   ├─ 删除 Elasticsearch 快照
   ├─ 删除文件系统数据
   └─ 删除数据库记录
   ↓
6. 记录清理日志
   • 删除的备份ID
   • 删除原因
   • 释放的空间
   ↓
7. 发送清理报告（如果配置）
```

### 4.4 配置热更新流程

```
┌─────────────────────────────────────────────────────────────────┐
│                     配置热更新流程                               │
└─────────────────────────────────────────────────────────────────┘

1. 管理员通过 API 更新配置
   ↓
2. 验证配置参数
   ├─ 验证失败 → 返回错误
   └─ 验证成功 → 继续
   ↓
3. 保存配置到 PostgreSQL
   • 更新配置表
   • 记录变更历史
   ↓
4. 更新 Redis 缓存
   • 设置新配置值
   • 设置过期时间
   ↓
5. 发布 Pub/Sub 通知
   • 频道: config:module17:reload
   • 消息: 配置变更事件
   ↓
6. 各节点订阅并处理
   ├─ 从 Redis 加载新配置
   ├─ 验证配置有效性
   ├─ 原子更新内存配置 (atomic.Value)
   └─ 记录更新日志
   ↓
7. 返回更新成功响应
   ↓
8. 记录审计日志
   • 操作人
   • 变更内容
   • 变更时间
```

### 4.5 异常处理流程

**备份创建失败**:
```
创建失败 → 识别错误类型 → 返回结构化错误 → 清理临时资源
  ├─ 路径无效 → 返回 400 + 具体原因
  ├─ 空间不足 → 返回 507 + 可用空间信息
  ├─ ES错误 → 返回 500 + ES错误信息
  └─ 其他错误 → 返回 500 + 通用错误信息
```

**下载中断**:
```
下载中断 → 客户端重试 → 发送 Range 请求 → 从断点继续传输
```

**导入失败**:
```
导入失败 → 识别失败原因 → 清理临时文件 → 返回错误信息
  ├─ 格式错误 → 返回 400
  ├─ 校验和不匹配 → 返回 400
  ├─ 解压失败 → 返回 400
  └─ ES注册失败 → 返回 500
```

---

## 5. 接口设计

详见 [API设计文档](./api-design.md) 模块17部分

### 5.1 核心API列表

| 接口 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 创建备份 | POST | /api/v1/backups | 创建全量或增量备份 |
| 列出备份 | GET | /api/v1/backups | 获取备份列表（支持筛选排序） |
| 获取备份详情 | GET | /api/v1/backups/{id} | 获取单个备份的详细信息 |
| 更新备份 | PUT | /api/v1/backups/{id} | 更新备份名称和备注 |
| 删除备份 | DELETE | /api/v1/backups/{id} | 删除指定备份 |
| 下载备份 | GET | /api/v1/backups/{id}/download | 下载备份包（支持断点续传） |
| 导入备份 | POST | /api/v1/backups/import | 导入备份包 |
| 获取统计 | GET | /api/v1/backups/stats | 获取备份空间统计 |
| 获取路径列表 | GET | /api/v1/backups/paths | 获取可用备份路径 |
| 验证路径 | POST | /api/v1/backups/paths/validate | 验证自定义路径 |
| 批量删除 | POST | /api/v1/backups/batch-delete | 批量删除备份 |
| 取消备份 | POST | /api/v1/backups/{id}/cancel | 取消进行中的备份 |
| 估算大小 | GET | /api/v1/backups/estimate | 估算备份大小和时间 |
| 列出告警规则 | GET | /api/v1/alerts/rules | 获取所有告警规则 |
| 创建告警规则 | POST | /api/v1/alerts/rules | 创建自定义告警规则 |
| 更新告警规则 | PUT | /api/v1/alerts/rules/{id} | 更新告警规则 |
| 删除告警规则 | DELETE | /api/v1/alerts/rules/{id} | 删除告警规则 |
| 启用/禁用规则 | POST | /api/v1/alerts/rules/{id}/toggle | 启用或禁用告警规则 |
| 测试告警规则 | POST | /api/v1/alerts/rules/{id}/test | 测试告警规则是否生效 |

### 5.2 请求/响应示例

**创建备份请求**:
```json
POST /api/v1/backups
{
  "type": "incremental",
  "name": "production-backup-20260201",
  "description": "每日增量备份",
  "custom_path": "/data/backups/production",
  "index_pattern": "logs-*"
}
```

**创建备份响应**:
```json
{
  "code": 0,
  "message": "备份创建成功",
  "data": {
    "id": "incremental_logs_1738368000",
    "name": "production-backup-20260201",
    "type": "incremental",
    "status": "IN_PROGRESS",
    "created_at": "2026-02-01T10:00:00Z"
  }
}
```

**列出备份响应**:
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "backup-1",
        "name": "production-backup-20260201",
        "description": "每日增量备份",
        "type": "incremental",
        "status": "SUCCESS",
        "path": "/data/backups/production",
        "size_gb": 15.5,
        "document_count": 1000000,
        "created_at": "2026-02-01T10:00:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "page_size": 20,
    "total_pages": 3
  }
}
```

---

## 6. 数据设计

### 6.1 数据模型

**备份元数据结构**:
```go
// 备份元数据
type BackupMetadata struct {
    ID              string    `json:"id" db:"id"`
    Name            string    `json:"name" db:"name"`
    Description     string    `json:"description" db:"description"`
    Type            string    `json:"type" db:"type"` // full/incremental
    BasedOn         string    `json:"based_on" db:"based_on"` // 基准备份ID
    Status          string    `json:"status" db:"status"` // IN_PROGRESS/SUCCESS/FAILED/CANCELLED
    Repository      string    `json:"repository" db:"repository"`
    Path            string    `json:"path" db:"path"`
    IndexPattern    string    `json:"index_pattern" db:"index_pattern"`
    StartTime       time.Time `json:"start_time" db:"start_time"`
    EndTime         time.Time `json:"end_time" db:"end_time"`
    SizeBytes       int64     `json:"size_bytes" db:"size_bytes"`
    DocumentCount   int64     `json:"document_count" db:"document_count"`
    Checksum        string    `json:"checksum" db:"checksum"` // SHA-256
    CreatedAt       time.Time `json:"created_at" db:"created_at"`
    UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
    CreatedBy       string    `json:"created_by" db:"created_by"`
    UpdatedBy       string    `json:"updated_by" db:"updated_by"`
}

// 路径配置
type PathConfig struct {
    ID          int64     `json:"id" db:"id"`
    Path        string    `json:"path" db:"path"`
    IsDefault   bool      `json:"is_default" db:"is_default"`
    MaxSizeGB   int64     `json:"max_size_gb" db:"max_size_gb"`
    Enabled     bool      `json:"enabled" db:"enabled"`
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// 备份历史记录
type BackupHistory struct {
    ID          int64     `json:"id" db:"id"`
    BackupID    string    `json:"backup_id" db:"backup_id"`
    Name        string    `json:"name" db:"name"`
    Description string    `json:"description" db:"description"`
    UpdatedBy   string    `json:"updated_by" db:"updated_by"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// 配置项
type BackupConfig struct {
    ID          int64     `json:"id" db:"id"`
    Key         string    `json:"key" db:"key"`
    Value       string    `json:"value" db:"value"`
    Type        string    `json:"type" db:"type"` // string/int/bool/float
    Description string    `json:"description" db:"description"`
    UpdatedBy   string    `json:"updated_by" db:"updated_by"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}
```

### 6.2 数据库设计

**backups 表**:
```sql
CREATE TABLE backups (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('full', 'incremental')),
    based_on VARCHAR(255),
    status VARCHAR(20) NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUCCESS', 'FAILED', 'CANCELLED')),
    repository VARCHAR(255) NOT NULL,
    path TEXT NOT NULL,
    index_pattern VARCHAR(255) NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    size_bytes BIGINT DEFAULT 0,
    document_count BIGINT DEFAULT 0,
    checksum VARCHAR(64),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    CONSTRAINT fk_based_on FOREIGN KEY (based_on) REFERENCES backups(id) ON DELETE SET NULL,
    CONSTRAINT unique_name_repo UNIQUE (name, repository)
);

CREATE INDEX idx_backups_type ON backups(type);
CREATE INDEX idx_backups_status ON backups(status);
CREATE INDEX idx_backups_created_at ON backups(created_at DESC);
CREATE INDEX idx_backups_path ON backups(path);
CREATE INDEX idx_backups_based_on ON backups(based_on);
```

**backup_paths 表**:
```sql
CREATE TABLE backup_paths (
    id SERIAL PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    is_default BOOLEAN DEFAULT FALSE,
    max_size_gb BIGINT DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_paths_enabled ON backup_paths(enabled);
CREATE INDEX idx_backup_paths_default ON backup_paths(is_default);
```

**backup_history 表**:
```sql
CREATE TABLE backup_history (
    id SERIAL PRIMARY KEY,
    backup_id VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    description TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_backup_history FOREIGN KEY (backup_id) REFERENCES backups(id) ON DELETE CASCADE
);

CREATE INDEX idx_backup_history_backup_id ON backup_history(backup_id);
CREATE INDEX idx_backup_history_updated_at ON backup_history(updated_at DESC);
```

**backup_config 表**:
```sql
CREATE TABLE backup_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('string', 'int', 'bool', 'float')),
    description TEXT,
    updated_by VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_backup_config_key ON backup_config(key);
```

**audit_logs 表** (共享表):
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

**alert_rules 表** (告警规则):
```sql
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    metric TEXT NOT NULL,
    operator VARCHAR(10) NOT NULL CHECK (operator IN ('>', '<', '==', '>=', '<=', '!=')),
    threshold DOUBLE PRECISION NOT NULL,
    duration INTEGER NOT NULL DEFAULT 60,
    message TEXT NOT NULL,
    channels JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_type ON alert_rules(type);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity);
```

**alert_history 表** (告警历史):
```sql
CREATE TABLE alert_history (
    id SERIAL PRIMARY KEY,
    rule_id INTEGER NOT NULL,
    rule_name VARCHAR(200) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    metric_value DOUBLE PRECISION,
    triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'firing' CHECK (status IN ('firing', 'resolved')),
    
    CONSTRAINT fk_alert_rule FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

CREATE INDEX idx_alert_history_rule_id ON alert_history(rule_id);
CREATE INDEX idx_alert_history_triggered_at ON alert_history(triggered_at DESC);
CREATE INDEX idx_alert_history_status ON alert_history(status);
```

### 6.3 缓存设计

**Redis 缓存策略**:

| 缓存键 | 数据类型 | TTL | 说明 |
|--------|----------|-----|------|
| `backup:config:{key}` | String | 1小时 | 配置项缓存 |
| `backup:paths` | List | 5分钟 | 可用路径列表 |
| `backup:stats` | Hash | 5分钟 | 空间统计信息 |
| `backup:export:{id}` | String | 24小时 | 导出文件路径 |
| `backup:lock:{id}` | String | 30分钟 | 备份操作锁 |
| `backup:alert:rules` | String | 5分钟 | 告警规则列表（JSON） |

**Pub/Sub 频道**:
- `config:module17:reload` - 配置变更通知
- `backup:status:{id}` - 备份状态变更通知
- `backup:space:alert` - 空间告警通知
- `alert:rules:reload` - 告警规则变更通知

**缓存更新策略**:
```go
// 配置变更时更新缓存
func (m *Manager) UpdateConfig(key, value string) error {
    // 1. 更新数据库
    if err := m.db.UpdateConfig(key, value); err != nil {
        return err
    }
    
    // 2. 更新 Redis 缓存
    cacheKey := fmt.Sprintf("backup:config:%s", key)
    if err := m.redis.Set(cacheKey, value, time.Hour).Err(); err != nil {
        log.Warn("更新缓存失败", "error", err)
    }
    
    // 3. 发布变更通知
    if err := m.redis.Publish("config:module17:reload", key).Err(); err != nil {
        log.Warn("发布通知失败", "error", err)
    }
    
    return nil
}

// 订阅配置变更
func (m *Manager) SubscribeConfigChanges() {
    pubsub := m.redis.Subscribe("config:module17:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        key := msg.Payload
        
        // 从 Redis 加载新配置
        cacheKey := fmt.Sprintf("backup:config:%s", key)
        value, err := m.redis.Get(cacheKey).Result()
        if err != nil {
            log.Error("加载配置失败", "key", key, "error", err)
            continue
        }
        
        // 原子更新内存配置
        m.updateMemoryConfig(key, value)
        
        log.Info("配置已更新", "key", key, "value", value)
    }
}
```

### 6.4 索引设计

**Elasticsearch 索引模式**:
- `logs-*` - 默认日志索引模式
- 支持自定义索引模式（通配符）

**备份快照命名规则**:
- 全量备份: `full_{index_pattern}_{timestamp}`
- 增量备份: `incremental_{index_pattern}_{timestamp}`

**快照仓库配置**:
```json
{
  "type": "fs",
  "settings": {
    "location": "/var/lib/elasticsearch/snapshots",
    "compress": true,
    "chunk_size": "100mb",
    "max_restore_bytes_per_sec": "100mb",
    "max_snapshot_bytes_per_sec": "100mb"
  }
}
```

---

## 7. 安全设计

### 7.1 认证授权

**权限定义**:
| 权限 | 说明 | 操作 |
|------|------|------|
| backup.read | 查看备份 | 列表、详情、下载 |
| backup.write | 管理备份 | 创建、更新、删除 |
| backup.admin | 备份管理员 | 所有操作 + 配置管理 |

**权限验证**:
```go
// 中间件验证权限
func RequirePermission(permission string) gin.HandlerFunc {
    return func(c *gin.Context) {
        user := c.MustGet("user").(*User)
        
        if !user.HasPermission(permission) {
            c.JSON(403, gin.H{
                "code": "FORBIDDEN",
                "message": "权限不足",
            })
            c.Abort()
            return
        }
        
        c.Next()
    }
}

// 路由配置
router.POST("/backups", RequirePermission("backup.write"), CreateBackup)
router.GET("/backups", RequirePermission("backup.read"), ListBackups)
router.DELETE("/backups/:id", RequirePermission("backup.write"), DeleteBackup)
```

### 7.2 数据安全

**备份数据加密** (可选):
```go
// 使用 AES-256-GCM 加密备份包
func (em *ExportManager) EncryptBackup(inputFile, outputFile, key string) error {
    // 1. 生成密钥
    keyBytes := sha256.Sum256([]byte(key))
    
    // 2. 创建 AES cipher
    block, err := aes.NewCipher(keyBytes[:])
    if err != nil {
        return err
    }
    
    // 3. 创建 GCM mode
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return err
    }
    
    // 4. 读取原文件
    plaintext, err := os.ReadFile(inputFile)
    if err != nil {
        return err
    }
    
    // 5. 生成 nonce
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return err
    }
    
    // 6. 加密
    ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
    
    // 7. 写入加密文件
    return os.WriteFile(outputFile, ciphertext, 0600)
}
```

**路径安全验证**:
```go
// 防止路径遍历攻击
func (pm *PathManager) ValidatePathSecurity(path string) error {
    // 1. 清理路径
    cleanPath := filepath.Clean(path)
    
    // 2. 转换为绝对路径
    absPath, err := filepath.Abs(cleanPath)
    if err != nil {
        return fmt.Errorf("无效的路径: %w", err)
    }
    
    // 3. 检查是否在允许的根目录下
    allowedRoots := []string{
        "/var/lib/elasticsearch/snapshots",
        "/data/backups",
    }
    
    allowed := false
    for _, root := range allowedRoots {
        if strings.HasPrefix(absPath, root) {
            allowed = true
            break
        }
    }
    
    if !allowed {
        return fmt.Errorf("路径不在允许的目录下: %s", absPath)
    }
    
    return nil
}
```

### 7.3 审计日志

**审计事件**:
| 事件 | 说明 | 记录内容 |
|------|------|----------|
| backup.create | 创建备份 | 用户、备份类型、索引模式、路径 |
| backup.delete | 删除备份 | 用户、备份ID、备份名称 |
| backup.download | 下载备份 | 用户、备份ID、文件大小 |
| backup.import | 导入备份 | 用户、文件名、文件大小 |
| backup.update | 更新备份 | 用户、备份ID、变更内容 |
| backup.cancel | 取消备份 | 用户、备份ID |
| config.update | 更新配置 | 用户、配置项、新值、旧值 |

**审计日志记录**:
```go
func (al *AuditLogger) Log(action, resourceType, resourceID, userID string, details map[string]interface{}) error {
    query := `
        INSERT INTO audit_logs (action, resource_type, resource_id, user_id, details, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
    `
    
    detailsJSON, _ := json.Marshal(details)
    
    _, err := al.db.Exec(query, action, resourceType, resourceID, userID, detailsJSON, time.Now())
    return err
}

// 使用示例
auditLogger.Log("backup.create", "backup", backupID, userID, map[string]interface{}{
    "type": "incremental",
    "index_pattern": "logs-*",
    "path": "/data/backups",
})
```

### 7.4 安全配置

**安全配置项**:
```yaml
security:
  # 启用备份加密（✅ 支持热更新）
  enable_encryption: false
  # 加密密钥（❌ 不推荐热更新，建议通过Secret更新并重启）
  encryption_key_source: "env:BACKUP_ENCRYPTION_KEY"
  
  # 路径白名单（✅ 支持热更新）
  allowed_paths:
    - /var/lib/elasticsearch/snapshots
    - /data/backups
  
  # 最大文件大小（GB）（✅ 支持热更新）
  max_backup_size_gb: 100
  max_upload_size_gb: 10
  
  # 下载限流（✅ 支持热更新）
  download_rate_limit: "100MB/s"
  
  # 审计日志保留期（天）（✅ 支持热更新）
  audit_log_retention_days: 90
```

**热更新说明**:
- ✅ **推荐热更新**: enable_encryption、allowed_paths、max_backup_size_gb、max_upload_size_gb、download_rate_limit、audit_log_retention_days
- ❌ **不推荐热更新**: encryption_key_source（涉及安全凭证，建议通过Secret更新并重启）

**热更新方式**:
```bash
# 更新安全配置
curl -X PUT "http://api/v1/backup/config" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "max_backup_size_gb",
    "value": "200"
  }'

# 更新路径白名单
curl -X PUT "http://api/v1/backup/config" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "allowed_paths",
    "value": "[/var/lib/elasticsearch/snapshots,/data/backups,/mnt/backup]"
  }'
```

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 备份创建延迟 | < 30秒（小型）<br>< 5分钟（大型） | 从请求到快照开始 |
| 增量备份大小 | < 全量备份的30% | 对比文件大小 |
| 下载速度 | > 50MB/s | 网络传输速率 |
| 断点续传成功率 | > 99% | 重试成功次数/总次数 |
| 路径验证延迟 | < 100ms | API响应时间 |
| 配置热更新延迟 | < 3秒 | 从变更到生效 |
| 空间统计延迟 | < 1秒 | API响应时间 |
| 并发备份数 | 支持5个 | 同时进行的备份操作 |
| 列表查询延迟 | < 200ms | API响应时间（100条） |

### 8.2 性能优化策略

**1. 增量备份优化**:
```go
// 使用时间戳索引加速查询
func (m *IncrementalBackupManager) CreateIncrementalBackup(indexPattern string) error {
    // 构建高效的时间范围查询
    query := map[string]interface{}{
        "query": map[string]interface{}{
            "bool": map[string]interface{}{
                "filter": []map[string]interface{}{
                    {
                        "range": map[string]interface{}{
                            "@timestamp": map[string]interface{}{
                                "gte": startTime.Format(time.RFC3339),
                                "lt":  endTime.Format(time.RFC3339),
                                "format": "strict_date_optional_time",
                            },
                        },
                    },
                },
            },
        },
        // 只返回必要的字段
        "_source": false,
    }
    
    // 使用 Elasticsearch 的快照 API，避免数据传输
    // ...
}
```

**2. 下载性能优化**:
```go
// 使用流式传输，避免内存占用
func (em *ExportManager) StreamDownload(c *gin.Context, filePath string) error {
    file, err := os.Open(filePath)
    if err != nil {
        return err
    }
    defer file.Close()
    
    // 设置缓冲区大小（1MB）
    buffer := make([]byte, 1024*1024)
    
    // 流式传输
    _, err = io.CopyBuffer(c.Writer, file, buffer)
    return err
}
```

**3. 并发控制**:
```go
// 使用信号量限制并发备份数
type BackupSemaphore struct {
    sem chan struct{}
}

func NewBackupSemaphore(maxConcurrent int) *BackupSemaphore {
    return &BackupSemaphore{
        sem: make(chan struct{}, maxConcurrent),
    }
}

func (s *BackupSemaphore) Acquire() {
    s.sem <- struct{}{}
}

func (s *BackupSemaphore) Release() {
    <-s.sem
}

// 使用示例
func (m *BackupManager) CreateBackup(config *BackupConfig) error {
    // 获取信号量
    m.semaphore.Acquire()
    defer m.semaphore.Release()
    
    // 执行备份
    return m.doCreateBackup(config)
}
```

**4. 缓存优化**:
```go
// 使用本地缓存减少数据库查询
type CachedPathManager struct {
    cache *lru.Cache
    db    *sql.DB
}

func (pm *CachedPathManager) GetAvailablePaths() ([]*PathInfo, error) {
    // 检查缓存
    if cached, ok := pm.cache.Get("available_paths"); ok {
        return cached.([]*PathInfo), nil
    }
    
    // 查询数据库
    paths, err := pm.queryPathsFromDB()
    if err != nil {
        return nil, err
    }
    
    // 更新缓存（5分钟）
    pm.cache.Add("available_paths", paths)
    
    return paths, nil
}
```

**5. 数据库查询优化**:
```sql
-- 使用覆盖索引避免回表
CREATE INDEX idx_backups_list ON backups(created_at DESC, id, name, type, status, size_bytes);

-- 使用分区表优化大表查询
CREATE TABLE backups (
    ...
) PARTITION BY RANGE (created_at);

CREATE TABLE backups_2026_01 PARTITION OF backups
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

### 8.3 容量规划

**存储容量估算**:
```
假设：
- 日志量: 100GB/天
- 全量备份: 每周1次
- 增量备份: 每天1次
- 保留期: 30天

存储需求:
- 全量备份: 100GB × 7天 × 4周 = 2.8TB
- 增量备份: 100GB × 0.3 × 23天 = 690GB
- 总计: 约 3.5TB

建议配置: 5TB 存储空间（留有40%余量）
```

**性能容量**:
```
- 备份并发数: 5个
- 下载并发数: 10个
- 每秒备份请求: 10 QPS
- 每秒下载请求: 50 QPS
- 网络带宽: 1Gbps（125MB/s）
```

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                     Kubernetes 集群                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Server Pod (3 replicas)                             │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │  │
│  │  │ api-server │  │ api-server │  │ api-server │         │  │
│  │  │ + backup   │  │ + backup   │  │ + backup   │         │  │
│  │  │   manager  │  │   manager  │  │   manager  │         │  │
│  │  └────────────┘  └────────────┘  └────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
│                           │                                     │
│                           ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Persistent Volume (NFS/Ceph)                            │  │
│  │  /var/lib/elasticsearch/snapshots                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL (StatefulSet)                                │  │
│  │  • 主从复制                                              │  │
│  │  • 自动故障转移                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Redis (StatefulSet)                                     │  │
│  │  • 哨兵模式                                              │  │
│  │  • 高可用                                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Elasticsearch Cluster                                   │  │
│  │  • 3个主节点                                             │  │
│  │  • 快照仓库配置                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**API Server Pod**:
```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi

replicas: 3

volumeMounts:
  - name: backup-storage
    mountPath: /var/lib/elasticsearch/snapshots
  - name: temp-storage
    mountPath: /tmp/backup-exports
```

**PostgreSQL**:
```yaml
resources:
  requests:
    cpu: 1000m
    memory: 2Gi
  limits:
    cpu: 4000m
    memory: 8Gi

storage: 100Gi
```

**Redis**:
```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi
```

### 9.3 配置管理

**配置热更新（推荐方式）**:

模块17的所有配置支持通过Redis Pub/Sub实现热更新，无需重启服务。详细设计见第11节"配置热更新详细设计"。

**热更新优势**:
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（< 3秒）
- ✅ 不影响正在进行的备份操作
- ✅ 支持配置验证和自动回滚
- ✅ 记录完整的审计日志

**热更新流程**:
1. 用户通过API或Web Console修改配置
2. 配置验证（范围检查、依赖检查）
3. 保存到PostgreSQL（版本化）
4. 更新Redis缓存
5. Redis发布Pub/Sub通知（`config:module17:reload`）
6. 所有服务实例订阅到通知
7. 重新加载配置并验证
8. 使用atomic.Value原子更新配置
9. 记录配置变更审计日志
10. 配置在3秒内生效

**支持热更新的配置组**:
- 增量备份配置（5项）
- 路径管理配置（5项）
- 导出导入配置（6项）
- 命名管理配置（5项）
- 空间管理配置（5项）
- 错误处理配置（5项）
- 告警规则配置（7项）

**ConfigMap（备选方式）**:

当热更新机制不可用时（如Redis故障），可以通过修改ConfigMap并重启Pod来更新配置：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backup-config
  namespace: log-management
data:
  backup.yaml: |
    # 增量备份配置
    incremental:
      enabled: true
      auto_base_backup: true
      max_incremental_chain: 10
      interval_hours: 24
      verify_base_on_restore: true
    
    # 路径管理配置
    path:
      default_path: "/var/lib/elasticsearch/snapshots"
      min_free_space_gb: 10.0
      warning_threshold: 0.9
      auto_create_path: true
      check_interval_seconds: 300
    
    # 导出导入配置
    export:
      temp_dir: "/tmp/backup-exports"
      cache_ttl_hours: 24
      max_concurrent_exports: 3
      chunk_size_mb: 10
      enable_checksum: true
      max_upload_size_gb: 10
    
    # 命名管理配置
    naming:
      name_max_length: 100
      description_max_length: 500
      enable_name_validation: true
      enable_history_tracking: true
      default_name_format: "{repository}_{type}_{timestamp}"
    
    # 空间管理配置
    cleanup:
      enabled: false
      keep_last_n: 10
      keep_days: 30
      min_free_space_gb: 50.0
      interval_hours: 24
    
    # 错误处理配置
    error:
      log_level: "error"
      enable_detailed_errors: true
      notification_duration: 10
      enable_auto_retry: false
      max_retry_attempts: 3
    
    # 告警配置
    alert:
      enabled: true
      evaluation_interval: 30
      channels:
        - email
      email:
        smtp_host: "smtp.example.com"
        smtp_port: 587
      webhook_url: ""
      dingtalk_token: ""
```

**更新ConfigMap后重启Pod**:
```bash
# 编辑ConfigMap
kubectl edit configmap backup-config -n log-management

# 重启Pod使配置生效
kubectl rollout restart deployment/api-server -n log-management

# 查看重启状态
kubectl rollout status deployment/api-server -n log-management
```

**配置优先级**:

模块17的配置加载优先级（从高到低）：
1. **热更新配置**（PostgreSQL + Redis）- 最高优先级
2. **ConfigMap配置**（Kubernetes ConfigMap）- 中等优先级
3. **默认配置**（代码内置）- 最低优先级

**配置降级策略**:

```
正常情况:
PostgreSQL → Redis → 服务实例（热更新）

Redis故障:
PostgreSQL → 服务实例（直接读取数据库）

PostgreSQL故障:
ConfigMap → 服务实例（从ConfigMap读取）

全部故障:
默认配置 → 服务实例（使用内置默认值）
```

**不推荐热更新的配置**:

以下配置不推荐热更新，建议通过ConfigMap更新并重启服务：

| 配置类型 | 原因 | 更新方式 |
|---------|------|---------|
| Elasticsearch连接配置 | 需要重建快照仓库连接 | 修改ConfigMap并重启Pod |
| PostgreSQL连接配置 | 需要重建数据库连接池 | 修改ConfigMap并重启Pod |
| Redis连接配置 | 需要重建Redis连接 | 修改ConfigMap并重启Pod |
| 存储卷挂载路径 | 需要Pod重建 | 修改Deployment并滚动更新 |
| 资源配额（CPU/内存） | 需要Pod重建 | 修改Deployment并滚动更新 |
| 端口配置 | 需要Service更新 | 修改Service配置 |

**Secret管理**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: backup-secret
  namespace: log-management
type: Opaque
data:
  postgres-password: <base64-encoded>
  redis-password: <base64-encoded>
  es-password: <base64-encoded>
  smtp-password: <base64-encoded>
  webhook-token: <base64-encoded>
  dingtalk-token: <base64-encoded>
```

**注意**: Secret中的敏感信息（数据库密码、API密钥等）不推荐热更新，建议通过Secret更新并重启服务。

**配置热更新API示例**:

```bash
# 查询当前配置
curl -X GET "http://api/v1/backup/config"

# 更新单个配置项
curl -X PUT "http://api/v1/backup/config" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "max_incremental_chain",
    "value": "15"
  }'

# 批量更新配置
curl -X PUT "http://api/v1/backup/config/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "incremental_enabled": true,
    "max_incremental_chain": 15,
    "cleanup_enabled": true,
    "keep_last_n": 20
  }'

# 查询配置历史
curl -X GET "http://api/v1/backup/config/history?key=max_incremental_chain"

# 回滚配置
curl -X POST "http://api/v1/backup/config/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "max_incremental_chain",
    "version": 5
  }'
```

### 9.4 发布策略

**滚动更新**:
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0

# 确保零停机部署
readinessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 10
  periodSeconds: 5

livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
```

**配置更新策略**:

模块17的配置更新优先使用**热更新机制**，无需重启Pod：

| 更新场景 | 推荐方式 | 生效时间 | 服务影响 |
|---------|---------|---------|---------|
| 业务配置（增量备份、空间管理、告警规则等） | ✅ 热更新 | < 3秒 | 无影响 |
| 连接配置（Elasticsearch、PostgreSQL、Redis） | ❌ ConfigMap + 重启 | 1-2分钟 | 滚动重启 |
| 资源配额（CPU、内存） | ❌ Deployment + 重启 | 2-5分钟 | 滚动重启 |
| 代码更新 | ❌ 镜像 + 滚动更新 | 3-10分钟 | 滚动重启 |

**热更新优势**:
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（< 3秒）
- ✅ 不影响正在进行的备份操作
- ✅ 支持配置验证和自动回滚
- ✅ 记录完整的审计日志

**热更新流程**:
```
配置变更 → 验证 → 保存PostgreSQL → 更新Redis → 发布Pub/Sub 
  → 各节点订阅 → 原子更新 → 记录审计 → 3秒内生效
```

**滚动更新流程**（仅用于不支持热更新的配置）:
```
更新ConfigMap/Deployment → kubectl apply → 滚动重启Pod 
  → 健康检查 → 流量切换 → 旧Pod下线
```

**灰度发布**:
```yaml
# 使用 Istio 进行流量分割
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: backup-api
spec:
  hosts:
    - backup-api
  http:
    - match:
        - headers:
            x-version:
              exact: "v2"
      route:
        - destination:
            host: backup-api
            subset: v2
    - route:
        - destination:
            host: backup-api
            subset: v1
          weight: 90
        - destination:
            host: backup-api
            subset: v2
          weight: 10
```

**发布检查清单**:
- [ ] 配置验证通过
- [ ] 数据库迁移完成（如有）
- [ ] 健康检查配置正确
- [ ] 监控告警已配置
- [ ] 回滚方案已准备
- [ ] 优先使用热更新（业务配置）
- [ ] 必要时使用滚动更新（连接配置）

---

## 10. 监控与运维

### 10.1 监控指标

**Prometheus 指标**:
```prometheus
# 备份操作指标
backup_operations_total{type="full|incremental",status="success|failed"} - 备份操作总数
backup_operation_duration_seconds{type="full|incremental"} - 备份操作耗时
backup_size_bytes{type="full|incremental"} - 备份大小
backup_document_count{type="full|incremental"} - 备份文档数

# 下载指标
backup_downloads_total{status="success|failed"} - 下载总数
backup_download_duration_seconds - 下载耗时
backup_download_bytes_total - 下载字节数

# 空间指标
backup_storage_used_bytes{path="/path"} - 已用存储空间
backup_storage_available_bytes{path="/path"} - 可用存储空间
backup_storage_usage_percent{path="/path"} - 存储使用率

# 清理指标
backup_cleanup_operations_total - 清理操作总数
backup_cleanup_deleted_count - 清理删除的备份数
backup_cleanup_freed_bytes - 清理释放的空间

# 配置热更新指标
backup_config_reload_total{status="success|failed"} - 配置重载总数
backup_config_reload_duration_seconds - 配置重载耗时

# 错误指标
backup_errors_total{type="create|download|import|delete"} - 错误总数
```

**采集配置**:
```go
// Prometheus 指标定义
var (
    backupOperationsTotal = prometheus.NewCounterVec(
        prometheus.CounterOpts{
            Name: "backup_operations_total",
            Help: "备份操作总数",
        },
        []string{"type", "status"},
    )
    
    backupOperationDuration = prometheus.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "backup_operation_duration_seconds",
            Help:    "备份操作耗时",
            Buckets: []float64{1, 5, 10, 30, 60, 300, 600},
        },
        []string{"type"},
    )
    
    backupStorageUsagePercent = prometheus.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "backup_storage_usage_percent",
            Help: "存储使用率",
        },
        []string{"path"},
    )
)

// 注册指标
func init() {
    prometheus.MustRegister(backupOperationsTotal)
    prometheus.MustRegister(backupOperationDuration)
    prometheus.MustRegister(backupStorageUsagePercent)
}

// 使用示例
func (m *BackupManager) CreateBackup(config *BackupConfig) error {
    start := time.Now()
    
    err := m.doCreateBackup(config)
    
    // 记录指标
    status := "success"
    if err != nil {
        status = "failed"
    }
    
    backupOperationsTotal.WithLabelValues(config.Type, status).Inc()
    backupOperationDuration.WithLabelValues(config.Type).Observe(time.Since(start).Seconds())
    
    return err
}
```

### 10.2 告警规则（支持热更新）

**告警规则数据模型**:
```go
// 告警规则
type AlertRule struct {
    ID          int64     `json:"id" db:"id"`
    Name        string    `json:"name" db:"name"`
    Type        string    `json:"type" db:"type"` // backup_failed/storage_low/operation_slow/download_failed
    Enabled     bool      `json:"enabled" db:"enabled"`
    Severity    string    `json:"severity" db:"severity"` // info/warning/critical
    Metric      string    `json:"metric" db:"metric"` // 监控指标
    Operator    string    `json:"operator" db:"operator"` // >/</==/>=/<=/!=
    Threshold   float64   `json:"threshold" db:"threshold"` // 阈值
    Duration    int       `json:"duration" db:"duration"` // 持续时间（秒）
    Message     string    `json:"message" db:"message"` // 告警消息模板
    Channels    []string  `json:"channels" db:"channels"` // 通知渠道（email/webhook/钉钉）
    CreatedAt   time.Time `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
    CreatedBy   string    `json:"created_by" db:"created_by"`
}

// 告警规则管理器
type AlertRuleManager struct {
    db          *sql.DB
    redis       *redis.Client
    rules       atomic.Value // 存储当前规则列表
    evaluator   *AlertEvaluator
}
```

**默认告警规则**:
```go
var defaultAlertRules = []*AlertRule{
    {
        Name:      "备份操作失败率过高",
        Type:      "backup_failed",
        Enabled:   true,
        Severity:  "warning",
        Metric:    "rate(backup_operations_total{status=\"failed\"}[5m])",
        Operator:  ">",
        Threshold: 0.1,
        Duration:  300, // 5分钟
        Message:   "最近5分钟备份失败率超过10%",
        Channels:  []string{"email", "webhook"},
    },
    {
        Name:      "存储空间不足",
        Type:      "storage_low",
        Enabled:   true,
        Severity:  "warning",
        Metric:    "backup_storage_usage_percent",
        Operator:  ">",
        Threshold: 90,
        Duration:  300, // 5分钟
        Message:   "路径 {{.Path}} 的存储使用率为 {{.Value}}%",
        Channels:  []string{"email", "webhook"},
    },
    {
        Name:      "存储空间严重不足",
        Type:      "storage_critical",
        Enabled:   true,
        Severity:  "critical",
        Metric:    "backup_storage_usage_percent",
        Operator:  ">",
        Threshold: 95,
        Duration:  60, // 1分钟
        Message:   "路径 {{.Path}} 的存储使用率为 {{.Value}}%，请立即清理",
        Channels:  []string{"email", "webhook", "dingtalk"},
    },
    {
        Name:      "备份操作耗时过长",
        Type:      "operation_slow",
        Enabled:   true,
        Severity:  "warning",
        Metric:    "histogram_quantile(0.95, rate(backup_operation_duration_seconds_bucket[5m]))",
        Operator:  ">",
        Threshold: 600, // 10分钟
        Duration:  600,
        Message:   "P95备份耗时超过10分钟",
        Channels:  []string{"email"},
    },
    {
        Name:      "下载失败率过高",
        Type:      "download_failed",
        Enabled:   true,
        Severity:  "warning",
        Metric:    "rate(backup_downloads_total{status=\"failed\"}[5m])",
        Operator:  ">",
        Threshold: 0.2,
        Duration:  300,
        Message:   "最近5分钟下载失败率超过20%",
        Channels:  []string{"email", "webhook"},
    },
    {
        Name:      "配置重载失败",
        Type:      "config_reload_failed",
        Enabled:   true,
        Severity:  "warning",
        Metric:    "rate(backup_config_reload_total{status=\"failed\"}[5m])",
        Operator:  ">",
        Threshold: 0,
        Duration:  60,
        Message:   "配置热更新失败，请检查配置有效性",
        Channels:  []string{"email", "webhook"},
    },
}
```

**告警规则热更新实现**:
```go
// 加载告警规则
func (arm *AlertRuleManager) LoadRules() ([]*AlertRule, error) {
    // 1. 尝试从 Redis 缓存加载
    cached, err := arm.redis.Get("backup:alert:rules").Result()
    if err == nil {
        var rules []*AlertRule
        if err := json.Unmarshal([]byte(cached), &rules); err == nil {
            return rules, nil
        }
    }
    
    // 2. 从数据库加载
    query := `
        SELECT id, name, type, enabled, severity, metric, operator, 
               threshold, duration, message, channels
        FROM alert_rules
        WHERE enabled = true
        ORDER BY severity DESC, id ASC
    `
    
    rows, err := arm.db.Query(query)
    if err != nil {
        return nil, fmt.Errorf("查询告警规则失败: %w", err)
    }
    defer rows.Close()
    
    rules := make([]*AlertRule, 0)
    for rows.Next() {
        var rule AlertRule
        var channelsJSON string
        
        err := rows.Scan(
            &rule.ID, &rule.Name, &rule.Type, &rule.Enabled,
            &rule.Severity, &rule.Metric, &rule.Operator,
            &rule.Threshold, &rule.Duration, &rule.Message,
            &channelsJSON,
        )
        if err != nil {
            log.Error("扫描告警规则失败", "error", err)
            continue
        }
        
        // 解析通知渠道
        json.Unmarshal([]byte(channelsJSON), &rule.Channels)
        rules = append(rules, &rule)
    }
    
    // 3. 缓存到 Redis（5分钟）
    rulesJSON, _ := json.Marshal(rules)
    arm.redis.Set("backup:alert:rules", rulesJSON, 5*time.Minute)
    
    return rules, nil
}

// 创建告警规则
func (arm *AlertRuleManager) CreateRule(rule *AlertRule, userID string) error {
    // 1. 验证规则
    if err := arm.validateRule(rule); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 2. 插入数据库
    channelsJSON, _ := json.Marshal(rule.Channels)
    
    query := `
        INSERT INTO alert_rules (
            name, type, enabled, severity, metric, operator,
            threshold, duration, message, channels, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
    `
    
    err := arm.db.QueryRow(query,
        rule.Name, rule.Type, rule.Enabled, rule.Severity,
        rule.Metric, rule.Operator, rule.Threshold, rule.Duration,
        rule.Message, channelsJSON, userID, time.Now(),
    ).Scan(&rule.ID)
    
    if err != nil {
        return fmt.Errorf("创建告警规则失败: %w", err)
    }
    
    // 3. 触发热更新
    if err := arm.reloadRules(); err != nil {
        log.Warn("重载告警规则失败", "error", err)
    }
    
    log.Info("告警规则已创建", "rule_id", rule.ID, "name", rule.Name, "user_id", userID)
    return nil
}

// 更新告警规则
func (arm *AlertRuleManager) UpdateRule(ruleID int64, updates map[string]interface{}, userID string) error {
    // 1. 构建更新语句
    setClauses := make([]string, 0)
    args := make([]interface{}, 0)
    argIndex := 1
    
    for key, value := range updates {
        setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, argIndex))
        args = append(args, value)
        argIndex++
    }
    
    // 添加更新时间和更新人
    setClauses = append(setClauses, fmt.Sprintf("updated_at = $%d", argIndex))
    args = append(args, time.Now())
    argIndex++
    
    setClauses = append(setClauses, fmt.Sprintf("updated_by = $%d", argIndex))
    args = append(args, userID)
    argIndex++
    
    // 添加 WHERE 条件
    args = append(args, ruleID)
    
    query := fmt.Sprintf(`
        UPDATE alert_rules 
        SET %s
        WHERE id = $%d
    `, strings.Join(setClauses, ", "), argIndex)
    
    // 2. 执行更新
    result, err := arm.db.Exec(query, args...)
    if err != nil {
        return fmt.Errorf("更新告警规则失败: %w", err)
    }
    
    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return fmt.Errorf("告警规则不存在: %d", ruleID)
    }
    
    // 3. 触发热更新
    if err := arm.reloadRules(); err != nil {
        log.Warn("重载告警规则失败", "error", err)
    }
    
    log.Info("告警规则已更新", "rule_id", ruleID, "user_id", userID)
    return nil
}

// 删除告警规则
func (arm *AlertRuleManager) DeleteRule(ruleID int64, userID string) error {
    query := `DELETE FROM alert_rules WHERE id = $1`
    
    result, err := arm.db.Exec(query, ruleID)
    if err != nil {
        return fmt.Errorf("删除告警规则失败: %w", err)
    }
    
    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return fmt.Errorf("告警规则不存在: %d", ruleID)
    }
    
    // 触发热更新
    if err := arm.reloadRules(); err != nil {
        log.Warn("重载告警规则失败", "error", err)
    }
    
    log.Info("告警规则已删除", "rule_id", ruleID, "user_id", userID)
    return nil
}

// 重载告警规则（热更新）
func (arm *AlertRuleManager) reloadRules() error {
    // 1. 加载新规则
    newRules, err := arm.LoadRules()
    if err != nil {
        return err
    }
    
    // 2. 原子更新内存规则
    arm.rules.Store(newRules)
    
    // 3. 清除 Redis 缓存
    arm.redis.Del("backup:alert:rules")
    
    // 4. 发布变更通知
    arm.redis.Publish("alert:rules:reload", time.Now().Unix())
    
    log.Info("告警规则已重载", "count", len(newRules))
    return nil
}

// 订阅告警规则变更
func (arm *AlertRuleManager) SubscribeRuleChanges() {
    pubsub := arm.redis.Subscribe("alert:rules:reload")
    defer pubsub.Close()
    
    for range pubsub.Channel() {
        // 重新加载规则
        newRules, err := arm.LoadRules()
        if err != nil {
            log.Error("加载告警规则失败", "error", err)
            continue
        }
        
        // 原子更新
        arm.rules.Store(newRules)
        
        log.Info("告警规则已热更新", "count", len(newRules))
    }
}

// 获取当前规则
func (arm *AlertRuleManager) GetRules() []*AlertRule {
    return arm.rules.Load().([]*AlertRule)
}

// 验证规则
func (arm *AlertRuleManager) validateRule(rule *AlertRule) error {
    if rule.Name == "" {
        return fmt.Errorf("规则名称不能为空")
    }
    
    if rule.Metric == "" {
        return fmt.Errorf("监控指标不能为空")
    }
    
    validOperators := []string{">", "<", "==", ">=", "<=", "!="}
    if !contains(validOperators, rule.Operator) {
        return fmt.Errorf("无效的操作符: %s", rule.Operator)
    }
    
    validSeverities := []string{"info", "warning", "critical"}
    if !contains(validSeverities, rule.Severity) {
        return fmt.Errorf("无效的严重级别: %s", rule.Severity)
    }
    
    if rule.Duration < 0 {
        return fmt.Errorf("持续时间不能为负数")
    }
    
    if len(rule.Channels) == 0 {
        return fmt.Errorf("至少需要一个通知渠道")
    }
    
    return nil
}
```

**告警规则 API**:
```go
// 列出告警规则
// GET /api/v1/alerts/rules
func (h *AlertHandler) ListRules(c *gin.Context) {
    rules := h.ruleManager.GetRules()
    
    c.JSON(200, gin.H{
        "code": 0,
        "data": rules,
    })
}

// 创建告警规则
// POST /api/v1/alerts/rules
func (h *AlertHandler) CreateRule(c *gin.Context) {
    var rule AlertRule
    if err := c.ShouldBindJSON(&rule); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    userID := c.GetString("user_id")
    if err := h.ruleManager.CreateRule(&rule, userID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(201, gin.H{
        "code": 0,
        "message": "告警规则创建成功",
        "data": rule,
    })
}

// 更新告警规则
// PUT /api/v1/alerts/rules/:id
func (h *AlertHandler) UpdateRule(c *gin.Context) {
    ruleID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
    
    var updates map[string]interface{}
    if err := c.ShouldBindJSON(&updates); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    userID := c.GetString("user_id")
    if err := h.ruleManager.UpdateRule(ruleID, updates, userID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "message": "告警规则更新成功",
    })
}

// 删除告警规则
// DELETE /api/v1/alerts/rules/:id
func (h *AlertHandler) DeleteRule(c *gin.Context) {
    ruleID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
    
    userID := c.GetString("user_id")
    if err := h.ruleManager.DeleteRule(ruleID, userID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "message": "告警规则删除成功",
    })
}

// 启用/禁用告警规则
// POST /api/v1/alerts/rules/:id/toggle
func (h *AlertHandler) ToggleRule(c *gin.Context) {
    ruleID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
    
    var req struct {
        Enabled bool `json:"enabled"`
    }
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": "无效的请求参数"})
        return
    }
    
    userID := c.GetString("user_id")
    updates := map[string]interface{}{
        "enabled": req.Enabled,
    }
    
    if err := h.ruleManager.UpdateRule(ruleID, updates, userID); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    c.JSON(200, gin.H{
        "code": 0,
        "message": "告警规则状态已更新",
    })
}
```

**数据库表设计**:
```sql
CREATE TABLE alert_rules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    metric TEXT NOT NULL,
    operator VARCHAR(10) NOT NULL CHECK (operator IN ('>', '<', '==', '>=', '<=', '!=')),
    threshold DOUBLE PRECISION NOT NULL,
    duration INTEGER NOT NULL DEFAULT 60,
    message TEXT NOT NULL,
    channels JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100)
);

CREATE INDEX idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX idx_alert_rules_type ON alert_rules(type);
CREATE INDEX idx_alert_rules_severity ON alert_rules(severity);
```

**YAML 配置文件（备用方案）**:
```yaml
# configs/alert_rules.yaml
alert_rules:
  - name: "备份操作失败率过高"
    type: "backup_failed"
    enabled: true
    severity: "warning"
    metric: "rate(backup_operations_total{status=\"failed\"}[5m])"
    operator: ">"
    threshold: 0.1
    duration: 300
    message: "最近5分钟备份失败率超过10%"
    channels:
      - email
      - webhook
  
  - name: "存储空间不足"
    type: "storage_low"
    enabled: true
    severity: "warning"
    metric: "backup_storage_usage_percent"
    operator: ">"
    threshold: 90
    duration: 300
    message: "路径 {{.Path}} 的存储使用率为 {{.Value}}%"
    channels:
      - email
      - webhook
```

**热更新优先级**:
1. **优先**: 通过 API 热更新（立即生效，无需重启）
2. **备用**: 修改 YAML 文件后重启服务（需要重启）
3. **初始化**: 首次启动时从 YAML 加载默认规则到数据库

### 10.3 日志规范

**日志级别**:
- **DEBUG**: 详细的调试信息（开发环境）
- **INFO**: 正常操作信息（备份创建、完成、删除等）
- **WARN**: 警告信息（空间不足、配置异常等）
- **ERROR**: 错误信息（操作失败、系统错误等）

**日志格式**:
```json
{
  "timestamp": "2026-02-01T10:00:00Z",
  "level": "INFO",
  "module": "backup",
  "operation": "create_backup",
  "backup_id": "incremental_logs_1738368000",
  "backup_type": "incremental",
  "user_id": "admin",
  "duration_ms": 15000,
  "size_bytes": 16642998272,
  "message": "备份创建成功"
}
```

**关键操作日志**:
```go
// 备份创建
log.Info("开始创建备份",
    "backup_id", backupID,
    "type", backupType,
    "index_pattern", indexPattern,
    "user_id", userID)

// 备份完成
log.Info("备份创建成功",
    "backup_id", backupID,
    "duration_ms", duration.Milliseconds(),
    "size_bytes", sizeBytes,
    "document_count", docCount)

// 备份失败
log.Error("备份创建失败",
    "backup_id", backupID,
    "error", err,
    "duration_ms", duration.Milliseconds())

// 空间告警
log.Warn("存储空间不足",
    "path", path,
    "usage_percent", usagePercent,
    "available_gb", availableGB)

// 配置更新
log.Info("配置已更新",
    "key", configKey,
    "old_value", oldValue,
    "new_value", newValue,
    "updated_by", userID)
```

### 10.4 运维手册

**日常运维任务**:

1. **监控备份状态**:
```bash
# 查看最近的备份
curl -X GET "http://api-server:8080/api/v1/backups?page=1&page_size=10&sort_by=date&sort_order=desc"

# 查看失败的备份
curl -X GET "http://api-server:8080/api/v1/backups?status=FAILED"
```

2. **检查存储空间**:
```bash
# 查看空间统计
curl -X GET "http://api-server:8080/api/v1/backups/stats"

# 检查各路径空间
df -h /var/lib/elasticsearch/snapshots
df -h /data/backups
```

3. **手动清理备份**:
```bash
# 删除指定备份
curl -X DELETE "http://api-server:8080/api/v1/backups/{backup_id}"

# 批量删除
curl -X POST "http://api-server:8080/api/v1/backups/batch-delete" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["backup-1", "backup-2"]}'
```

4. **配置热更新**:
```bash
# 更新配置
curl -X PUT "http://api-server:8080/api/v1/config/backup" \
  -H "Content-Type: application/json" \
  -d '{"keep_last_n": 15}'

# 验证配置生效
curl -X GET "http://api-server:8080/api/v1/config/backup"
```

**故障排查**:

1. **备份创建失败**:
```bash
# 检查 Elasticsearch 状态
curl -X GET "http://elasticsearch:9200/_cluster/health"

# 检查快照仓库
curl -X GET "http://elasticsearch:9200/_snapshot/_all"

# 查看错误日志
kubectl logs -l app=api-server --tail=100 | grep "backup.*error"
```

2. **下载失败**:
```bash
# 检查导出文件是否存在
ls -lh /tmp/backup-exports/

# 检查磁盘空间
df -h /tmp

# 查看下载日志
kubectl logs -l app=api-server --tail=100 | grep "download.*error"
```

3. **空间不足**:
```bash
# 执行手动清理
curl -X POST "http://api-server:8080/api/v1/backups/cleanup"

# 检查清理结果
curl -X GET "http://api-server:8080/api/v1/backups/stats"
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

**增量备份配置**:
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| incremental_enabled | bool | true | 是否启用增量备份 |
| auto_base_backup | bool | true | 无基准备份时自动创建全量备份 |
| max_incremental_chain | int | 10 | 最大增量备份链长度 |
| incremental_interval_hours | int | 24 | 增量备份间隔（小时） |
| verify_base_on_restore | bool | true | 恢复时验证基准备份 |

**路径管理配置**:
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| default_path | string | "/var/lib/elasticsearch/snapshots" | 默认备份路径 |
| min_free_space_gb | float64 | 10.0 | 最小可用空间（GB） |
| warning_threshold | float64 | 0.9 | 空间告警阈值（90%） |
| auto_create_path | bool | true | 自动创建不存在的路径 |
| path_check_interval_seconds | int | 300 | 路径检查间隔（秒） |

**导出导入配置**:
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| export_temp_dir | string | "/tmp/backup-exports" | 导出临时目录 |
| export_cache_ttl_hours | int | 24 | 导出文件缓存时间（小时） |
| max_concurrent_exports | int | 3 | 最大并发导出数 |
| chunk_size_mb | int | 10 | 分块下载大小（MB） |
| enable_checksum | bool | true | 是否计算校验和 |
| max_upload_size_gb | int | 10 | 最大上传文件大小（GB） |

**命名管理配置**:
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| name_max_length | int | 100 | 名称最大长度 |
| description_max_length | int | 500 | 描述最大长度 |
| enable_name_validation | bool | true | 是否启用名称验证 |
| enable_history_tracking | bool | true | 是否记录修改历史 |
| default_name_format | string | "{repository}_{type}_{timestamp}" | 默认名称格式 |

**空间管理配置**:
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| cleanup_enabled | bool | false | 是否启用自动清理 |
| keep_last_n | int | 10 | 保留最近N个备份 |
| keep_days | int | 30 | 保留N天内的备份 |
| min_free_space_gb | float64 | 50.0 | 最小可用空间（GB） |
| cleanup_interval_hours | int | 24 | 清理任务执行间隔（小时） |

**错误处理配置**:
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| error_log_level | string | "error" | 错误日志级别 |
| enable_detailed_errors | bool | true | 是否返回详细错误信息 |
| error_notification_duration | int | 10 | 错误通知显示时长（秒） |
| enable_auto_retry | bool | false | 是否启用自动重试 |
| max_retry_attempts | int | 3 | 最大重试次数 |

**告警规则配置** (支持热更新):
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| alert_enabled | bool | true | 是否启用告警 |
| alert_evaluation_interval | int | 30 | 告警评估间隔（秒） |
| alert_channels | []string | ["email"] | 默认通知渠道 |
| email_smtp_host | string | "smtp.example.com" | SMTP服务器地址 |
| email_smtp_port | int | 587 | SMTP服务器端口 |
| webhook_url | string | "" | Webhook URL |
| dingtalk_token | string | "" | 钉钉机器人Token |

**注意**: 告警规则本身（规则名称、阈值、条件等）通过 API 管理，支持完全热更新，无需重启服务。

### 11.2 热更新实现

**配置管理器**:
```go
// 配置管理器
type ConfigManager struct {
    db     *sql.DB
    redis  *redis.Client
    config atomic.Value // 存储当前配置
}

// 配置结构
type BackupConfig struct {
    // 增量备份配置
    IncrementalEnabled      bool    `json:"incremental_enabled"`
    AutoBaseBackup          bool    `json:"auto_base_backup"`
    MaxIncrementalChain     int     `json:"max_incremental_chain"`
    
    // 路径管理配置
    DefaultPath             string  `json:"default_path"`
    MinFreeSpaceGB          float64 `json:"min_free_space_gb"`
    WarningThreshold        float64 `json:"warning_threshold"`
    
    // 空间管理配置
    CleanupEnabled          bool    `json:"cleanup_enabled"`
    KeepLastN               int     `json:"keep_last_n"`
    KeepDays                int     `json:"keep_days"`
    
    // ... 其他配置项
}

// 验证配置
func (c *BackupConfig) Validate() error {
    if c.MaxIncrementalChain < 1 || c.MaxIncrementalChain > 100 {
        return fmt.Errorf("max_incremental_chain 必须在 1-100 之间")
    }
    
    if c.MinFreeSpaceGB < 1 {
        return fmt.Errorf("min_free_space_gb 必须大于 1")
    }
    
    if c.WarningThreshold < 0.5 || c.WarningThreshold > 1.0 {
        return fmt.Errorf("warning_threshold 必须在 0.5-1.0 之间")
    }
    
    if c.KeepLastN < 1 {
        return fmt.Errorf("keep_last_n 必须大于 0")
    }
    
    return nil
}

// 加载配置
func (cm *ConfigManager) LoadConfig() (*BackupConfig, error) {
    // 1. 尝试从 Redis 缓存加载
    cached, err := cm.redis.Get("backup:config:all").Result()
    if err == nil {
        var config BackupConfig
        if err := json.Unmarshal([]byte(cached), &config); err == nil {
            return &config, nil
        }
    }
    
    // 2. 从数据库加载
    query := `SELECT key, value, type FROM backup_config`
    rows, err := cm.db.Query(query)
    if err != nil {
        return nil, fmt.Errorf("查询配置失败: %w", err)
    }
    defer rows.Close()
    
    config := &BackupConfig{}
    configMap := make(map[string]interface{})
    
    for rows.Next() {
        var key, value, typ string
        if err := rows.Scan(&key, &value, &typ); err != nil {
            continue
        }
        
        // 根据类型转换值
        switch typ {
        case "bool":
            configMap[key], _ = strconv.ParseBool(value)
        case "int":
            configMap[key], _ = strconv.Atoi(value)
        case "float":
            configMap[key], _ = strconv.ParseFloat(value, 64)
        default:
            configMap[key] = value
        }
    }
    
    // 3. 映射到配置结构
    configJSON, _ := json.Marshal(configMap)
    json.Unmarshal(configJSON, config)
    
    // 4. 缓存到 Redis（1小时）
    configBytes, _ := json.Marshal(config)
    cm.redis.Set("backup:config:all", configBytes, time.Hour)
    
    return config, nil
}

// 更新配置
func (cm *ConfigManager) UpdateConfig(key, value string, userID string) error {
    // 1. 验证配置项是否存在
    var exists bool
    err := cm.db.QueryRow("SELECT EXISTS(SELECT 1 FROM backup_config WHERE key = $1)", key).Scan(&exists)
    if err != nil || !exists {
        return fmt.Errorf("配置项不存在: %s", key)
    }
    
    // 2. 更新数据库
    query := `
        UPDATE backup_config 
        SET value = $1, updated_by = $2, updated_at = $3
        WHERE key = $4
    `
    
    _, err = cm.db.Exec(query, value, userID, time.Now(), key)
    if err != nil {
        return fmt.Errorf("更新配置失败: %w", err)
    }
    
    // 3. 重新加载配置
    newConfig, err := cm.LoadConfig()
    if err != nil {
        return fmt.Errorf("加载新配置失败: %w", err)
    }
    
    // 4. 验证配置
    if err := newConfig.Validate(); err != nil {
        // 回滚数据库更新
        cm.db.Exec("UPDATE backup_config SET value = (SELECT value FROM backup_config WHERE key = $1) WHERE key = $1", key)
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 5. 更新 Redis 缓存
    configBytes, _ := json.Marshal(newConfig)
    cm.redis.Set("backup:config:all", configBytes, time.Hour)
    
    // 6. 发布变更通知
    cm.redis.Publish("config:module17:reload", key)
    
    // 7. 记录审计日志
    cm.logConfigChange(key, value, userID)
    
    log.Info("配置已更新", "key", key, "value", value, "user_id", userID)
    return nil
}

// 订阅配置变更
func (cm *ConfigManager) SubscribeConfigChanges() {
    pubsub := cm.redis.Subscribe("config:module17:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        key := msg.Payload
        
        // 重新加载配置
        newConfig, err := cm.LoadConfig()
        if err != nil {
            log.Error("加载配置失败", "key", key, "error", err)
            continue
        }
        
        // 验证配置
        if err := newConfig.Validate(); err != nil {
            log.Error("配置验证失败", "key", key, "error", err)
            continue
        }
        
        // 原子更新内存配置
        cm.config.Store(newConfig)
        
        log.Info("配置已热更新", "key", key)
    }
}

// 获取当前配置
func (cm *ConfigManager) GetConfig() *BackupConfig {
    return cm.config.Load().(*BackupConfig)
}
```

### 11.3 热更新验收标准

1. **生效时间**: 配置变更后 3 秒内在所有节点生效
2. **配置验证**: 无效配置不会被应用，保持原配置
3. **配置查询**: 支持通过 API 查询当前生效的配置值
4. **审计日志**: 记录所有配置变更的审计日志（操作人、时间、变更内容）
5. **回滚支持**: 配置验证失败时自动回滚到上一个有效配置
6. **零停机**: 配置更新不影响正在进行的备份操作
7. **一致性**: 所有节点的配置保持一致

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| **磁盘空间耗尽** | 中 | 高 | • 实时监控磁盘使用率<br>• 设置告警阈值（90%）<br>• 自动清理策略<br>• 多路径负载均衡 |
| **备份数据损坏** | 低 | 高 | • 使用 SHA-256 校验和<br>• 定期验证备份完整性<br>• 保留多个备份副本<br>• 异地备份 |
| **Elasticsearch 快照失败** | 中 | 中 | • 监控 ES 集群健康状态<br>• 重试机制<br>• 降级到文件系统备份<br>• 告警通知 |
| **下载中断** | 中 | 低 | • 支持断点续传<br>• HTTP Range 请求<br>• 客户端重试机制<br>• 超时配置优化 |
| **配置热更新失败** | 低 | 中 | • 配置验证机制<br>• 自动回滚到上一版本<br>• 保留配置历史<br>• 审计日志记录 |
| **并发备份冲突** | 低 | 中 | • 使用分布式锁<br>• 限制并发数量<br>• 队列机制<br>• 冲突检测 |
| **路径权限问题** | 中 | 中 | • 启动时权限检查<br>• 自动创建目录<br>• 权限修复脚本<br>• 详细错误提示 |
| **大文件上传超时** | 中 | 低 | • 分块上传<br>• 超时时间配置<br>• 进度反馈<br>• 断点续传 |
| **增量备份链断裂** | 低 | 高 | • 依赖关系验证<br>• 自动创建全量备份<br>• 备份链完整性检查<br>• 告警通知 |
| **元数据不一致** | 低 | 中 | • 数据库事务<br>• 定期一致性检查<br>• 自动修复机制<br>• 审计日志 |

### 12.2 回滚方案

**1. 代码回滚**:
```bash
# 使用 Kubernetes 回滚到上一版本
kubectl rollout undo deployment/api-server -n log-management

# 回滚到指定版本
kubectl rollout undo deployment/api-server --to-revision=2 -n log-management

# 验证回滚状态
kubectl rollout status deployment/api-server -n log-management
```

**2. 配置回滚**:
```sql
-- 查询配置历史
SELECT key, value, updated_by, updated_at 
FROM backup_config_history 
WHERE key = 'cleanup_enabled' 
ORDER BY updated_at DESC 
LIMIT 5;

-- 回滚到上一版本
UPDATE backup_config 
SET value = (
    SELECT value 
    FROM backup_config_history 
    WHERE key = 'cleanup_enabled' 
    ORDER BY updated_at DESC 
    OFFSET 1 LIMIT 1
)
WHERE key = 'cleanup_enabled';

-- 发布配置变更通知
-- 通过 Redis Pub/Sub 通知所有节点
```

**3. 数据回滚**:
```bash
# 如果误删除备份，从数据库恢复元数据
# 1. 查询删除记录
SELECT * FROM audit_logs 
WHERE action = 'delete' AND resource_type = 'backup' 
ORDER BY created_at DESC LIMIT 10;

# 2. 检查 Elasticsearch 快照是否还存在
curl -X GET "http://elasticsearch:9200/_snapshot/backup_repo/{snapshot_id}"

# 3. 如果快照存在，恢复元数据
INSERT INTO backups (id, name, type, status, ...) 
VALUES (...);
```

**4. 紧急回滚流程**:
```
1. 发现问题 → 立即停止新版本部署
   ↓
2. 评估影响范围 → 确定是否需要回滚
   ↓
3. 执行回滚操作 → kubectl rollout undo
   ↓
4. 验证回滚结果 → 检查服务状态和功能
   ↓
5. 通知相关人员 → 发送回滚通知
   ↓
6. 问题分析 → 记录问题原因和解决方案
```

**5. 回滚验证清单**:
- [ ] API 服务正常响应
- [ ] 备份创建功能正常
- [ ] 备份下载功能正常
- [ ] 配置热更新功能正常
- [ ] 监控指标正常上报
- [ ] 告警规则正常触发
- [ ] 数据库连接正常
- [ ] Redis 连接正常
- [ ] Elasticsearch 连接正常

### 12.3 应急预案

**磁盘空间耗尽应急处理**:
```bash
# 1. 立即停止新备份创建
kubectl scale deployment/api-server --replicas=0

# 2. 手动清理最旧的备份
curl -X POST "http://api-server:8080/api/v1/backups/cleanup" \
  -H "Authorization: Bearer $TOKEN"

# 3. 检查空间释放情况
df -h /var/lib/elasticsearch/snapshots

# 4. 恢复服务
kubectl scale deployment/api-server --replicas=3
```

**Elasticsearch 集群故障应急处理**:
```bash
# 1. 检查集群状态
curl -X GET "http://elasticsearch:9200/_cluster/health"

# 2. 如果集群不可用，切换到降级模式
# 修改配置，禁用备份功能
kubectl set env deployment/api-server BACKUP_ENABLED=false

# 3. 等待 ES 集群恢复
# 监控集群状态

# 4. 恢复备份功能
kubectl set env deployment/api-server BACKUP_ENABLED=true
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| **全量备份** | 备份所有数据的完整副本 |
| **增量备份** | 只备份自上次备份以来变更的数据 |
| **快照 (Snapshot)** | Elasticsearch 的备份机制，创建索引的时间点副本 |
| **仓库 (Repository)** | Elasticsearch 快照的存储位置 |
| **BasedOn** | 增量备份依赖的基准备份ID |
| **备份链** | 一个全量备份及其后续的增量备份序列 |
| **断点续传** | 支持从中断点继续传输文件的技术 |
| **HTTP Range** | HTTP 协议中用于请求部分内容的头部 |
| **校验和 (Checksum)** | 用于验证数据完整性的哈希值 |
| **SHA-256** | 一种加密哈希算法，生成256位的哈希值 |
| **tar.gz** | 使用 tar 打包并用 gzip 压缩的文件格式 |
| **热更新** | 在不重启服务的情况下更新配置 |
| **原子操作** | 不可分割的操作，要么全部成功要么全部失败 |
| **Pub/Sub** | 发布/订阅消息模式 |
| **元数据** | 描述数据的数据，如备份名称、大小、创建时间等 |
| **审计日志** | 记录系统操作的日志，用于安全审计和问题追溯 |
| **告警规则** | 定义触发告警的条件和阈值 |
| **告警阈值** | 触发告警的临界值 |
| **告警评估** | 定期检查指标是否满足告警条件的过程 |
| **告警通道** | 发送告警通知的方式，如邮件、Webhook、钉钉等 |
| **热更新** | 在不重启服务的情况下更新配置或规则 |

### 13.2 参考文档

**Elasticsearch 官方文档**:
- [Snapshot and Restore](https://www.elastic.co/guide/en/elasticsearch/reference/current/snapshot-restore.html)
- [Snapshot Repository](https://www.elastic.co/guide/en/elasticsearch/reference/current/snapshots-register-repository.html)
- [Snapshot Lifecycle Management](https://www.elastic.co/guide/en/elasticsearch/reference/current/snapshot-lifecycle-management.html)

**Go 标准库文档**:
- [archive/tar](https://pkg.go.dev/archive/tar) - tar 文件处理
- [compress/gzip](https://pkg.go.dev/compress/gzip) - gzip 压缩
- [crypto/sha256](https://pkg.go.dev/crypto/sha256) - SHA-256 哈希
- [syscall](https://pkg.go.dev/syscall) - 系统调用

**相关设计文档**:
- [模块2：日志存储设计文档](./design-module2.md) - 存储架构参考
- [模块9：高可用与灾备设计文档](./design-module9.md) - 灾备策略参考
- [API设计文档](./api-design.md) - 接口规范

**技术规范**:
- [RFC 7233 - HTTP Range Requests](https://tools.ietf.org/html/rfc7233)
- [RFC 6749 - OAuth 2.0](https://tools.ietf.org/html/rfc6749)
- [OpenAPI Specification](https://swagger.io/specification/)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-02-01 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-02-01 | v1.0 | 补充增量备份、路径管理、导出导入详细设计 | 系统架构团队 |
| 2026-02-01 | v1.0 | 补充配置热更新、监控运维、风险回滚章节 | 系统架构团队 |

### 13.4 FAQ

**Q1: 增量备份和全量备份的区别是什么？**

A: 全量备份会备份所有数据，而增量备份只备份自上次备份以来新增或变更的数据。增量备份的优点是速度快、占用空间小，但恢复时需要先恢复基准备份。

**Q2: 如何选择合适的备份路径？**

A: 建议选择：
- 有足够可用空间的路径（至少预留50GB）
- 高性能存储（SSD优于HDD）
- 独立的磁盘分区（避免影响系统盘）
- 支持网络存储（NFS、Ceph等）用于异地备份

**Q3: 备份失败如何排查？**

A: 按以下步骤排查：
1. 检查 Elasticsearch 集群状态
2. 检查磁盘空间是否充足
3. 检查路径权限是否正确
4. 查看错误日志获取详细信息
5. 检查网络连接是否正常

**Q4: 如何验证备份的完整性？**

A: 系统提供多种验证方式：
- SHA-256 校验和验证
- 备份元数据验证
- 定期恢复测试
- Elasticsearch 快照状态检查

**Q5: 配置热更新会影响正在进行的备份吗？**

A: 不会。配置热更新只影响新的备份操作，正在进行的备份会继续使用原配置完成。

**Q6: 如何实现异地备份？**

A: 可以通过以下方式：
- 配置多个备份路径，其中一个指向远程存储
- 使用备份导出功能，手动传输到异地
- 配置云存储路径（S3、OSS等）
- 使用文件同步工具（rsync、rclone等）

**Q7: 备份数据可以加密吗？**

A: 当前版本支持传输层加密（HTTPS），存储层加密可以通过：
- 使用加密的文件系统（LUKS、eCryptfs）
- 配置 Elasticsearch 的加密快照功能
- 在导出时使用加密选项（需要配置）

**Q8: 如何优化大型备份的性能？**

A: 优化建议：
- 使用增量备份减少数据量
- 选择高性能存储
- 调整 Elasticsearch 快照参数（chunk_size、max_snapshot_bytes_per_sec）
- 避免在业务高峰期执行备份
- 使用多路径并行备份

**Q9: 如何自定义告警规则？**

A: 通过以下方式自定义告警规则：
- **热更新方式**（推荐）：通过 API 创建/更新告警规则，立即生效无需重启
  ```bash
  # 创建自定义告警规则
  curl -X POST "http://api-server:8080/api/v1/alerts/rules" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "自定义存储告警",
      "type": "storage_custom",
      "enabled": true,
      "severity": "warning",
      "metric": "backup_storage_usage_percent",
      "operator": ">",
      "threshold": 85,
      "duration": 300,
      "message": "存储使用率超过85%",
      "channels": ["email", "webhook"]
    }'
  ```
- **YAML 配置方式**（备用）：修改 `configs/alert_rules.yaml` 后重启服务

**Q10: 告警规则热更新会影响正在运行的告警吗？**

A: 不会。告警规则热更新采用原子操作，新规则会在下一个评估周期（默认30秒）生效，不会影响正在触发的告警。已触发的告警会继续按原规则处理直到解决。

**Q11: 如何测试告警规则是否生效？**

A: 可以通过以下方式测试：
```bash
# 测试告警规则
curl -X POST "http://api-server:8080/api/v1/alerts/rules/{rule_id}/test"

# 查看告警历史
curl -X GET "http://api-server:8080/api/v1/alerts/history?rule_id={rule_id}"

# 临时降低阈值触发告警
curl -X PUT "http://api-server:8080/api/v1/alerts/rules/{rule_id}" \
  -H "Content-Type: application/json" \
  -d '{"threshold": 1}'
```

---

**文档完成日期**: 2026-02-01  
**文档状态**: 已发布  
**下次评审日期**: 2026-03-01
