# 模块十六：高级功能补充 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-02-01  
> **状态**: 已发布  
> **相关需求**: [requirements-module16.md](../requirements/requirements-module16.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-02-01 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态

- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: Phase 2 (需求60-66), Phase 3 (需求56-59, 67-70)

### 1.3 相关文档
- [需求文档](../requirements/requirements-module16.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块15设计文档](./design-module15.md) - 参考热更新实现

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              高级功能补充模块整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            配置中心（控制面）                                          │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ PostgreSQL   │───▶│    Redis     │───▶│   Pub/Sub    │                           │ │
│  │  │ (规则配置)   │    │ (当前规则)   │    │ (变更通知)   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────┬───────┘                           │ │
│  └────────────────────────────────────────────────────┼─────────────────────────────────┘ │
│                                                       │                                   │
│                                                       ▼                                   │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         事件关联引擎（Correlation Engine）                             │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Flink Stream │───▶│ 规则匹配器    │───▶│ 关联图谱     │                           │ │
│  │  │ (流式处理)   │    │ (Drools)     │    │ (Neo4j)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         语义分析引擎（Semantic Engine）                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ NLP 处理器   │───▶│ 实体识别     │───▶│ 知识图谱     │                           │ │
│  │  │ (spaCy/BERT) │    │ (NER)        │    │ (Neo4j)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         数据血缘追踪（Lineage Tracker）                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 元数据采集    │───▶│ 血缘分析     │───▶│ 影响分析     │                           │ │
│  │  │ (Atlas)      │    │ (Graph)      │    │ (Impact)     │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         审计取证系统（Forensics System）                               │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 证据保全     │───▶│ 时间线重建    │───▶│ 取证报告     │                           │ │
│  │  │ (Immutable)  │    │ (Timeline)   │    │ (Report)     │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                          │                                                 │
│                                          ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         健康评分系统（Health Scoring）                                 │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 指标采集     │───▶│ 评分计算     │───▶│ 趋势分析     │                           │ │
│  │  │ (Metrics)    │    │ (Scoring)    │    │ (Trend)      │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                         智能优化层（Optimization Layer）                               │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 采样控制     │    │ 压缩策略     │    │ 成本优化     │                           │ │
│  │  │ (Sampling)   │    │ (Compression)│    │ (Cost)       │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  │                                                                                       │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 智能路由     │    │ 质量评估     │    │ 智能推荐     │                           │ │
│  │  │ (Routing)    │    │ (Quality)    │    │ (Recommend)  │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 事件关联引擎 | 自动关联相关日志事件 | 时间窗口关联、实体关联、因果关联、规则匹配、ML关联、风险评分 |
| 语义分析引擎 | 理解日志语义含义 | NLP处理、实体识别、情感分析、知识图谱、语义搜索、多语言支持 |
| 数据血缘追踪 | 追踪日志数据流转路径 | 元数据采集、血缘分析、影响分析、版本管理、血缘可视化 |
| 审计取证系统 | 支持安全事件调查 | 证据保全、数字签名、时间线重建、取证报告、案件管理 |
| 健康评分系统 | 评估系统健康状态 | 多维度指标采集、综合评分计算、趋势分析、健康预警 |
| 采样控制 | 智能日志采样 | 动态采样率、重要性评估、采样策略、流量控制 |
| 模板管理 | 日志模板管理 | 模板识别、模板提取、模板匹配、模板库管理 |
| 质量评估 | 评估日志质量 | 完整性检查、准确性验证、一致性检查、质量评分 |
| 智能路由 | 智能日志路由 | 内容路由、优先级路由、负载均衡、故障转移 |
| 压缩策略 | 日志压缩管理 | 压缩算法选择、压缩率优化、解压性能、存储优化 |
| 标准化导出 | 标准格式导出 | 多格式支持、数据转换、批量导出、增量导出 |
| 脱敏审计 | 脱敏操作审计 | 脱敏记录、审计追踪、合规检查、脱敏验证 |
| 异常修复 | 自动修复异常 | 异常检测、修复策略、自动执行、修复验证 |
| 成本优化 | 优化日志成本 | 成本分析、优化建议、自动优化、成本预测 |
| 智能推荐 | 智能功能推荐 | 使用分析、推荐算法、个性化推荐、推荐评估 |

### 2.3 关键路径

**事件关联分析路径**:
```
日志流 → Kafka → Flink流处理 → 时间窗口分组 → 规则匹配(Drools) 
  → 实体关联 → 因果关联 → ML关联 → 风险评分 → Neo4j存储 → 告警生成

关联延迟: < 5秒 (P95)
```

**语义分析路径**:
```
日志消息 → 语言检测 → NLP处理(spaCy/BERT) → 实体提取(NER) 
  → 情感分析 → 关键词提取 → 语义向量化 → 知识图谱更新(Neo4j)

分析延迟: < 500ms (P95)
```

**数据血缘追踪路径**:
```
日志数据 → 元数据采集(Atlas) → 血缘关系构建 → 图数据库存储(Neo4j) 
  → 影响分析 → 血缘可视化(DAG)

追踪延迟: < 1秒
```

**审计取证路径**:
```
日志保全请求 → 数据哈希(SHA-256) → 数字签名(RSA/ECDSA) 
  → 可信时间戳(TSA) → 不可变存储(WORM) → 保管链记录

保全延迟: < 2秒
```

**健康评分路径**:
```
系统指标采集(1分钟) → 多维度评分计算 → 加权综合评分 
  → 趋势分析 → 健康预警 → Dashboard展示

评分更新: 每1分钟
```

**智能路由路径**:
```
日志接收 → 内容分析 → 优先级评估 → 路由规则匹配 
  → 目标选择 → 负载均衡 → 发送

路由延迟: < 50ms (P99)
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Apache Flink | 1.17+ | 流式事件关联处理、低延迟、高吞吐、状态管理、时间窗口支持 |
| Neo4j | 5.x | 图数据库、事件关联图谱、知识图谱、血缘关系存储、高性能图查询 |
| Apache Atlas | 2.x | 元数据管理、数据血缘追踪、数据治理、与Hadoop生态集成 |
| spaCy | 3.x | NLP处理、命名实体识别、多语言支持、高性能、易于集成 |
| BERT | - | 语义向量化、语义相似度、预训练模型、高准确率 |
| Drools | 8.x | 规则引擎、复杂规则匹配、动态规则更新、高性能 |
| TensorFlow/PyTorch | 2.x | 机器学习、异常检测、预测分析、模型训练和推理 |
| InfluxDB | 2.x | 时序数据库、指标存储、高性能写入、数据聚合 |
| Prometheus | 2.x | 指标采集、监控告警、时序数据、服务发现 |
| Grafana | 10.x | 可视化、仪表盘、告警、多数据源支持 |
| PostgreSQL | 15+ | 配置存储、元数据存储、ACID事务、JSON支持 |
| Redis | 7.x | 配置缓存、Pub/Sub、高性能、数据结构丰富 |
| LZ4/Zstd | - | 日志压缩、高压缩比、快速压缩解压、CPU友好 |
| Faiss | - | 向量索引、相似度搜索、高性能、支持GPU加速 |

### 3.2 事件关联技术对比

| 方案 | 延迟 | 准确率 | 复杂度 | 选择 |
|------|------|--------|--------|------|
| 基于规则 | 低 | 中 | 低 | ✅ |
| 基于统计 | 中 | 中 | 中 | ✅ |
| 基于机器学习 | 高 | 高 | 高 | ✅ (可选) |
| 基于图分析 | 中 | 高 | 中 | ✅ |

**选择策略**:
- 基础关联: 规则引擎(Drools) + 时间窗口(Flink)
- 高级关联: 图分析(Neo4j) + 机器学习(TensorFlow)
- 实时关联: Flink流处理 + 状态管理
- 离线关联: Spark批处理 + 图计算

### 3.3 NLP技术选型

| 技术 | 准确率 | 性能 | 多语言 | 选择 |
|------|--------|------|--------|------|
| spaCy | 高 | 高 | 是 | ✅ |
| NLTK | 中 | 低 | 是 | ❌ |
| Stanford NLP | 高 | 低 | 是 | ❌ |
| BERT | 很高 | 中 | 是 | ✅ (语义向量) |
| GPT | 很高 | 低 | 是 | ⚠️ (成本高) |

**选择理由**:
1. spaCy提供高性能的NLP处理，支持中英日等多语言
2. BERT用于生成高质量的语义向量，支持语义搜索
3. 自定义规则引擎处理特定领域的实体识别
4. 结合统计方法和深度学习，平衡准确率和性能

### 3.4 压缩算法对比

| 算法 | 压缩比 | 压缩速度 | 解压速度 | CPU占用 | 选择 |
|------|--------|----------|----------|---------|------|
| Gzip | 3-5x | 中 | 中 | 中 | ✅ |
| LZ4 | 2-3x | 很快 | 很快 | 低 | ✅ (默认) |
| Zstd | 3-4x | 快 | 快 | 中 | ✅ |
| Brotli | 4-6x | 慢 | 中 | 高 | ⚠️ (冷存储) |
| Snappy | 2x | 很快 | 很快 | 低 | ✅ (实时) |

**选择策略**:
- 实时日志: LZ4/Snappy (低延迟)
- 热存储: Zstd (平衡压缩比和性能)
- 温存储: Gzip (标准压缩)
- 冷存储: Brotli (高压缩比)

### 3.5 向量索引技术

| 技术 | 性能 | 准确率 | 内存占用 | 选择 |
|------|------|--------|----------|------|
| Faiss | 很高 | 高 | 中 | ✅ |
| Annoy | 高 | 中 | 低 | ⚠️ |
| HNSW | 很高 | 很高 | 高 | ✅ (精确搜索) |
| LSH | 中 | 中 | 低 | ❌ |

**选择理由**:
1. Faiss提供GPU加速，适合大规模向量搜索
2. HNSW算法提供高准确率的近似最近邻搜索
3. 支持多种索引类型，可根据数据规模选择
4. 与BERT语义向量无缝集成

---

## 4. 关键流程设计

### 4.1 事件关联分析流程

```
1. 日志流接入 Kafka
2. Flink消费日志流
3. 按实体分组（用户、IP、会话ID）
4. 应用时间窗口（滚动/滑动/会话窗口）
5. 规则引擎匹配（Drools）
   - 多步骤攻击模式
   - 级联故障模式
   - 业务异常模式
6. 实体关联分析
   - 提取共同实体
   - 构建实体关系
7. 因果关联分析
   - 检查请求ID/追踪ID
   - 识别父子关系
8. 机器学习关联（可选）
   - 特征提取
   - 模型推理
   - 异常模式识别
9. 风险评分计算
   - 事件数量权重
   - 事件级别权重
   - 时间跨度权重
   - 关联类型权重
10. 构建事件关联图
11. 保存到Neo4j
12. 高风险事件生成告警

总耗时: < 5秒 (P95)
```

### 4.2 语义分析流程

```
1. 接收日志消息
2. 语言检测（lingua-go）
3. NLP预处理
   - 分词
   - 词性标注
   - 依存句法分析
4. 命名实体识别（NER）
   - 正则表达式匹配（IP、URL、邮箱）
   - spaCy NER（人名、地名、组织）
   - 自定义规则（文件路径、会话ID）
5. 情感分析
   - 关键词匹配
   - 情感分类（错误/警告/成功/中性）
   - 情感得分计算
6. 关键词提取
   - TF-IDF算法
   - TextRank算法
   - 词频统计
7. 摘要生成
   - 提取第一句
   - 关键信息提取
8. 语义向量化
   - BERT编码
   - 向量归一化
9. 知识图谱更新
   - 创建日志节点
   - 创建实体节点
   - 建立关联关系
10. 向量索引更新（Faiss）
11. 返回分析结果

总耗时: < 500ms (P95)
```

### 4.3 数据血缘追踪流程

```
1. 日志数据产生
2. 采集元数据
   - 数据来源（主机、应用、文件）
   - 采集节点信息
   - 采集时间戳
3. 记录处理步骤
   - 清洗操作（字段提取、格式转换）
   - 转换操作（数据类型转换、编码转换）
   - 聚合操作（统计、分组）
   - 脱敏操作（字段脱敏、规则应用）
4. 记录存储位置
   - Elasticsearch索引
   - 对象存储路径
   - 备份位置
5. 构建血缘关系
   - 上游依赖（数据源）
   - 下游依赖（派生数据）
   - 处理节点（中间步骤）
6. 保存到Atlas/Neo4j
7. 版本管理
   - 记录血缘版本
   - 保留历史血缘
8. 影响分析
   - 上游影响评估
   - 下游影响评估
   - 依赖链分析

追踪延迟: < 1秒
```

### 4.4 审计取证流程

```
证据保全流程:
1. 接收保全请求（案件ID、日志ID列表）
2. 获取日志数据
3. 计算数据哈希（SHA-256）
4. 生成数字签名（RSA/ECDSA）
5. 获取可信时间戳（TSA）
6. 记录保管链
   - 采集时间
   - 操作员
   - 操作类型
7. 写入不可变存储（WORM）
8. 更新案件证据链
9. 记录审计日志

时间线重建流程:
1. 获取案件时间范围
2. 查询相关日志事件
3. 按时间排序
4. 识别事件关联
5. 构建时间线
6. 标注关键事件
7. 生成可视化时间线

取证报告生成流程:
1. 获取案件信息
2. 收集证据列表
3. 构建事件时间线
4. 分析调查发现
5. 生成结论和建议
6. 根据格式生成报告内容
   - JSON: 结构化数据
   - PDF: 可打印报告
   - CSV: 表格数据
7. 对报告进行数字签名
8. 保存报告到案件
9. 记录审计日志

保全延迟: < 2秒
```

### 4.5 健康评分流程

```
1. 指标采集（每1分钟）
   - 系统指标（CPU、内存、磁盘、网络）
   - 应用指标（QPS、延迟、错误率）
   - 业务指标（日志量、告警数、异常数）
   - 依赖指标（数据库、缓存、消息队列）
2. 指标预处理
   - 数据清洗
   - 异常值过滤
   - 数据归一化
3. 多维度评分计算
   - 可用性评分（0-100）
   - 性能评分（0-100）
   - 稳定性评分（0-100）
   - 安全性评分（0-100）
4. 加权综合评分
   - 可用性权重: 30%
   - 性能权重: 25%
   - 稳定性权重: 25%
   - 安全性权重: 20%
5. 趋势分析
   - 计算评分变化率
   - 识别下降趋势
   - 预测未来评分
6. 健康预警
   - 评分 < 60: 严重告警
   - 评分 60-80: 警告告警
   - 评分 > 80: 正常
7. 保存评分历史（InfluxDB）
8. 更新Dashboard展示

评分更新: 每1分钟
```

### 4.6 智能路由流程

```
1. 接收日志
2. 内容分析
   - 提取日志级别
   - 提取应用名称
   - 提取关键字段
3. 优先级评估
   - FATAL/ERROR: 高优先级
   - WARN: 中优先级
   - INFO/DEBUG: 低优先级
4. 路由规则匹配
   - 按内容路由（正则匹配）
   - 按标签路由（标签匹配）
   - 按优先级路由（优先级队列）
5. 目标选择
   - 查询可用目标
   - 检查目标健康状态
   - 检查目标容量
6. 负载均衡
   - 轮询（Round Robin）
   - 最少连接（Least Connections）
   - 加权轮询（Weighted Round Robin）
   - 一致性哈希（Consistent Hashing）
7. 发送日志
8. 失败重试
   - 最多重试3次
   - 指数退避
9. 故障转移
   - 切换到备用目标
   - 记录故障事件
10. 记录路由指标

路由延迟: < 50ms (P99)
```

### 4.7 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| Flink作业失败 | 自动重启 | Checkpoint恢复 |
| Neo4j连接失败 | 重试连接 | 降级到本地缓存 |
| NLP处理超时 | 跳过语义分析 | 记录失败日志 |
| 向量索引损坏 | 重建索引 | 从备份恢复 |
| 配置验证失败 | 保持原配置 | 发送告警通知 |
| 存储空间不足 | 触发清理 | 扩容或迁移 |
| 证据签名失败 | 重试签名 | 记录失败原因 |
| 健康评分异常 | 发送告警 | 人工介入 |

### 4.8 配置热更新流程

```
1. 用户在Web Console修改配置
2. 配置验证
   - 语法检查
   - 范围检查
   - 依赖检查
3. 保存到PostgreSQL（版本化）
4. 同步到Redis
5. Redis发布Pub/Sub通知
   - config:module16:correlation:reload
   - config:module16:semantic:reload
   - config:module16:lineage:reload
   - config:module16:forensics:reload
   - config:module16:health:reload
   - config:module16:sampling:reload
   - config:module16:routing:reload
   - config:module16:compression:reload
   - config:module16:quality:reload
   - config:module16:cost:reload
6. 所有实例订阅到通知
7. 重新加载配置
8. 配置验证
9. 使用atomic.Value原子更新
10. 记录审计日志
11. 返回更新成功响应

生效时间: < 5秒
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块16部分，共计约100个接口（API-16-572 ~ API-16-671）:

**事件关联接口** (API-16-572 ~ API-16-585): 14个接口
- POST /api/v1/correlation/rules - 创建关联规则
- GET /api/v1/correlation/rules - 获取关联规则列表
- GET /api/v1/correlation/rules/{id} - 获取关联规则详情
- PUT /api/v1/correlation/rules/{id} - 更新关联规则
- DELETE /api/v1/correlation/rules/{id} - 删除关联规则
- PUT /api/v1/correlation/rules/{id}/toggle - 启用/禁用关联规则
- GET /api/v1/correlation/events - 获取关联事件列表
- GET /api/v1/correlation/events/{id} - 获取关联事件详情
- GET /api/v1/correlation/events/{id}/graph - 获取事件关联图
- GET /api/v1/correlation/stats - 获取关联统计信息
- POST /api/v1/correlation/analyze - 手动触发关联分析
- GET /api/v1/correlation/windows - 获取时间窗口配置
- PUT /api/v1/correlation/windows - 更新时间窗口配置
- GET /api/v1/correlation/ml/status - 获取ML模型状态

**语义分析接口** (API-16-586 ~ API-16-598): 13个接口
- POST /api/v1/semantic/analyze - 分析日志语义
- GET /api/v1/semantic/results/{log_id} - 获取语义分析结果
- GET /api/v1/semantic/entities - 获取实体列表
- GET /api/v1/semantic/entities/{type} - 获取指定类型实体
- GET /api/v1/semantic/knowledge-graph - 获取知识图谱
- GET /api/v1/semantic/knowledge-graph/query - 查询知识图谱
- POST /api/v1/semantic/search - 语义搜索
- GET /api/v1/semantic/similar/{log_id} - 查找相似日志
- GET /api/v1/semantic/keywords - 获取关键词统计
- GET /api/v1/semantic/sentiment/stats - 获取情感分析统计
- GET /api/v1/semantic/languages - 获取支持的语言列表
- PUT /api/v1/semantic/config - 更新语义分析配置
- GET /api/v1/semantic/config - 获取语义分析配置

**数据血缘接口** (API-16-599 ~ API-16-610): 12个接口
- GET /api/v1/lineage/{log_id} - 获取日志血缘信息
- GET /api/v1/lineage/{log_id}/upstream - 获取上游血缘
- GET /api/v1/lineage/{log_id}/downstream - 获取下游血缘
- GET /api/v1/lineage/{log_id}/graph - 获取血缘图谱
- POST /api/v1/lineage/impact-analysis - 执行影响分析
- GET /api/v1/lineage/versions/{log_id} - 获取血缘版本历史
- POST /api/v1/lineage/export - 导出血缘数据
- GET /api/v1/lineage/metadata/{entity_id} - 获取实体元数据
- PUT /api/v1/lineage/metadata/{entity_id} - 更新实体元数据
- GET /api/v1/lineage/stats - 获取血缘统计信息
- PUT /api/v1/lineage/config - 更新血缘追踪配置
- GET /api/v1/lineage/config - 获取血缘追踪配置

**审计取证接口** (API-16-611 ~ API-16-625): 15个接口
- POST /api/v1/forensics/cases - 创建取证案件
- GET /api/v1/forensics/cases - 获取案件列表
- GET /api/v1/forensics/cases/{id} - 获取案件详情
- PUT /api/v1/forensics/cases/{id} - 更新案件信息
- DELETE /api/v1/forensics/cases/{id} - 删除案件
- POST /api/v1/forensics/cases/{id}/preserve - 保全日志数据
- GET /api/v1/forensics/cases/{id}/evidence - 获取证据列表
- GET /api/v1/forensics/cases/{id}/timeline - 获取事件时间线
- POST /api/v1/forensics/cases/{id}/report - 生成取证报告
- GET /api/v1/forensics/cases/{id}/report - 获取取证报告
- POST /api/v1/forensics/cases/{id}/export - 导出证据包
- POST /api/v1/forensics/evidence/{id}/verify - 验证证据完整性
- GET /api/v1/forensics/evidence/{id}/chain - 获取保管链
- PUT /api/v1/forensics/config - 更新取证配置
- GET /api/v1/forensics/config - 获取取证配置

**健康评分接口** (API-16-626 ~ API-16-635): 10个接口
- GET /api/v1/health/score - 获取当前健康评分
- GET /api/v1/health/score/history - 获取评分历史
- GET /api/v1/health/score/trend - 获取评分趋势
- GET /api/v1/health/dimensions - 获取各维度评分
- GET /api/v1/health/metrics - 获取健康指标
- POST /api/v1/health/weights - 更新评分权重
- GET /api/v1/health/weights - 获取评分权重
- GET /api/v1/health/alerts - 获取健康告警
- PUT /api/v1/health/config - 更新健康评分配置
- GET /api/v1/health/config - 获取健康评分配置

**采样控制接口** (API-16-636 ~ API-16-644): 9个接口
- POST /api/v1/sampling/rules - 创建采样规则
- GET /api/v1/sampling/rules - 获取采样规则列表
- PUT /api/v1/sampling/rules/{id} - 更新采样规则
- DELETE /api/v1/sampling/rules/{id} - 删除采样规则
- GET /api/v1/sampling/stats - 获取采样统计
- GET /api/v1/sampling/rate - 获取当前采样率
- PUT /api/v1/sampling/rate - 更新采样率
- PUT /api/v1/sampling/config - 更新采样配置
- GET /api/v1/sampling/config - 获取采样配置

**模板管理接口** (API-16-645 ~ API-16-653): 9个接口
- POST /api/v1/templates - 创建日志模板
- GET /api/v1/templates - 获取模板列表
- GET /api/v1/templates/{id} - 获取模板详情
- PUT /api/v1/templates/{id} - 更新模板
- DELETE /api/v1/templates/{id} - 删除模板
- POST /api/v1/templates/extract - 自动提取模板
- POST /api/v1/templates/match - 匹配日志模板
- GET /api/v1/templates/stats - 获取模板统计
- PUT /api/v1/templates/config - 更新模板配置

**质量评估接口** (API-16-654 ~ API-16-660): 7个接口
- POST /api/v1/quality/assess - 评估日志质量
- GET /api/v1/quality/reports - 获取质量报告列表
- GET /api/v1/quality/reports/{id} - 获取质量报告详情
- GET /api/v1/quality/score - 获取质量评分
- GET /api/v1/quality/issues - 获取质量问题列表
- PUT /api/v1/quality/config - 更新质量评估配置
- GET /api/v1/quality/config - 获取质量评估配置

**智能路由接口** (API-16-661 ~ API-16-668): 8个接口
- POST /api/v1/routing/rules - 创建路由规则
- GET /api/v1/routing/rules - 获取路由规则列表
- PUT /api/v1/routing/rules/{id} - 更新路由规则
- DELETE /api/v1/routing/rules/{id} - 删除路由规则
- GET /api/v1/routing/stats - 获取路由统计
- GET /api/v1/routing/targets - 获取路由目标列表
- PUT /api/v1/routing/config - 更新路由配置
- GET /api/v1/routing/config - 获取路由配置

**压缩策略接口** (API-16-669 ~ API-16-675): 7个接口
- POST /api/v1/compression/policies - 创建压缩策略
- GET /api/v1/compression/policies - 获取压缩策略列表
- PUT /api/v1/compression/policies/{id} - 更新压缩策略
- DELETE /api/v1/compression/policies/{id} - 删除压缩策略
- GET /api/v1/compression/stats - 获取压缩统计
- PUT /api/v1/compression/config - 更新压缩配置
- GET /api/v1/compression/config - 获取压缩配置

**标准化导出接口** (API-16-676 ~ API-16-682): 7个接口
- POST /api/v1/export/jobs - 创建导出任务
- GET /api/v1/export/jobs - 获取导出任务列表
- GET /api/v1/export/jobs/{id} - 获取导出任务详情
- DELETE /api/v1/export/jobs/{id} - 取消导出任务
- GET /api/v1/export/formats - 获取支持的导出格式
- PUT /api/v1/export/config - 更新导出配置
- GET /api/v1/export/config - 获取导出配置

**脱敏审计接口** (API-16-683 ~ API-16-688): 6个接口
- GET /api/v1/masking/audit - 获取脱敏审计日志
- GET /api/v1/masking/audit/{id} - 获取脱敏审计详情
- GET /api/v1/masking/stats - 获取脱敏统计
- POST /api/v1/masking/verify - 验证脱敏操作
- PUT /api/v1/masking/config - 更新脱敏审计配置
- GET /api/v1/masking/config - 获取脱敏审计配置

**异常修复接口** (API-16-689 ~ API-16-696): 8个接口
- GET /api/v1/auto-fix/anomalies - 获取检测到的异常
- POST /api/v1/auto-fix/strategies - 创建修复策略
- GET /api/v1/auto-fix/strategies - 获取修复策略列表
- PUT /api/v1/auto-fix/strategies/{id} - 更新修复策略
- POST /api/v1/auto-fix/execute - 执行自动修复
- GET /api/v1/auto-fix/history - 获取修复历史
- PUT /api/v1/auto-fix/config - 更新自动修复配置
- GET /api/v1/auto-fix/config - 获取自动修复配置

**成本优化接口** (API-16-697 ~ API-16-705): 9个接口
- GET /api/v1/cost-optimization/opportunities - 获取优化机会
- POST /api/v1/cost-optimization/execute - 执行成本优化
- GET /api/v1/cost-optimization/history - 获取优化历史
- GET /api/v1/cost-optimization/savings - 获取节省金额
- GET /api/v1/cost-optimization/forecast - 获取成本预测
- POST /api/v1/cost-optimization/policies - 创建优化策略
- GET /api/v1/cost-optimization/policies - 获取优化策略列表
- PUT /api/v1/cost-optimization/config - 更新成本优化配置
- GET /api/v1/cost-optimization/config - 获取成本优化配置

**智能推荐接口** (API-16-706 ~ API-16-712): 7个接口
- GET /api/v1/recommendations - 获取推荐列表
- GET /api/v1/recommendations/{id} - 获取推荐详情
- POST /api/v1/recommendations/{id}/feedback - 提交推荐反馈
- GET /api/v1/recommendations/stats - 获取推荐统计
- GET /api/v1/recommendations/personalized - 获取个性化推荐
- PUT /api/v1/recommendations/config - 更新推荐配置
- GET /api/v1/recommendations/config - 获取推荐配置

**告警规则管理接口** (API-16-713 ~ API-16-725): 13个接口 - 新增
- POST /api/v1/alert-rules - 创建告警规则（热更新）
- GET /api/v1/alert-rules - 获取告警规则列表
- GET /api/v1/alert-rules/{id} - 获取告警规则详情
- PUT /api/v1/alert-rules/{id} - 更新告警规则（热更新）
- DELETE /api/v1/alert-rules/{id} - 删除告警规则（热更新）
- PATCH /api/v1/alert-rules/{id}/toggle - 启用/禁用告警规则（热更新）
- POST /api/v1/alert-rules/{id}/test - 测试告警规则
- GET /api/v1/alert-rules/{id}/history - 获取告警规则历史版本
- POST /api/v1/alert-rules/{id}/rollback - 回滚告警规则到指定版本
- GET /api/v1/alert-triggers - 获取告警触发记录
- GET /api/v1/alert-triggers/{id} - 获取告警触发详情
- POST /api/v1/alert-triggers/{id}/resolve - 手动解决告警
- GET /api/v1/alert-triggers/stats - 获取告警统计信息

**总计**: 约113个API接口（API-16-572 ~ API-16-725）

### 5.2 内部接口

**事件关联引擎接口**:

```go
type CorrelationEngine interface {
    // 启动关联分析
    Start(ctx context.Context) error
    
    // 停止关联分析
    Stop(ctx context.Context) error
    
    // 关联事件
    CorrelateEvents(ctx context.Context, events []*LogEntry, window TimeWindow) ([]*CorrelatedEvent, error)
    
    // 计算风险评分
    CalculateRiskScore(event *CorrelatedEvent) float64
    
    // 保存关联事件
    SaveCorrelatedEvent(ctx context.Context, event *CorrelatedEvent) error
}
```

**语义分析引擎接口**:

```go
type SemanticEngine interface {
    // 分析日志语义
    Analyze(ctx context.Context, log *LogEntry) (*SemanticAnalysisResult, error)
    
    // 提取实体
    ExtractEntities(text, language string) ([]*Entity, error)
    
    // 情感分析
    AnalyzeSentiment(text, language string) (*Sentiment, error)
    
    // 生成语义向量
    GenerateEmbedding(text, language string) ([]float64, error)
    
    // 语义搜索
    SemanticSearch(ctx context.Context, query string, limit int) ([]*SemanticAnalysisResult, error)
}
```

**数据血缘追踪器接口**:

```go
type LineageTracker interface {
    // 记录血缘信息
    RecordLineage(ctx context.Context, log *LogEntry, metadata *LineageMetadata) error
    
    // 获取血缘信息
    GetLineage(ctx context.Context, logID string) (*LineageInfo, error)
    
    // 影响分析
    AnalyzeImpact(ctx context.Context, entityID string) (*ImpactAnalysis, error)
    
    // 导出血缘数据
    ExportLineage(ctx context.Context, format string) ([]byte, error)
}
```

**取证管理器接口**:

```go
type ForensicsManager interface {
    // 创建取证案件
    CreateCase(ctx context.Context, req *CreateCaseRequest) (*ForensicsCase, error)
    
    // 保全日志数据
    PreserveLogs(ctx context.Context, caseID string, logIDs []string) error
    
    // 构建时间线
    BuildTimeline(ctx context.Context, caseID string) (*EventTimeline, error)
    
    // 生成取证报告
    GenerateReport(ctx context.Context, caseID string, format string) (*ForensicsReport, error)
    
    // 验证证据完整性
    VerifyEvidence(ctx context.Context, evidenceID string) (bool, error)
}
```

**健康评分器接口**:

```go
type HealthScorer interface {
    // 计算健康评分
    CalculateScore(ctx context.Context) (*HealthScore, error)
    
    // 获取评分历史
    GetScoreHistory(ctx context.Context, timeRange TimeRange) ([]*HealthScore, error)
    
    // 分析评分趋势
    AnalyzeTrend(ctx context.Context) (*ScoreTrend, error)
    
    // 更新评分权重
    UpdateWeights(ctx context.Context, weights map[string]float64) error
}
```

**采样控制器接口**:

```go
type SamplingController interface {
    // 判断是否采样
    ShouldSample(log *LogEntry) bool
    
    // 更新采样率
    UpdateSamplingRate(rate float64) error
    
    // 获取采样统计
    GetSamplingStats() *SamplingStats
}
```

**智能路由器接口**:

```go
type IntelligentRouter interface {
    // 路由日志
    Route(ctx context.Context, log *LogEntry) ([]string, error)
    
    // 选择目标
    SelectTarget(ctx context.Context, targets []string) (string, error)
    
    // 获取路由统计
    GetRoutingStats() *RoutingStats
}
```

**告警规则管理器接口** - 新增:

```go
type AlertRuleManager interface {
    // 启动告警规则管理器
    Start() error
    
    // 停止告警规则管理器
    Stop() error
    
    // 创建或更新规则
    CreateOrUpdateRule(ctx context.Context, rule *AlertRule) error
    
    // 删除规则
    DeleteRule(ctx context.Context, ruleID string) error
    
    // 启用/禁用规则
    ToggleRule(ctx context.Context, ruleID string, enabled bool) error
    
    // 获取所有规则
    GetRules() []*AlertRule
    
    // 获取单个规则
    GetRule(ruleID string) (*AlertRule, error)
    
    // 获取规则历史版本
    GetRuleHistory(ruleID string) ([]*AlertRuleHistory, error)
    
    // 回滚规则到指定版本
    RollbackRule(ctx context.Context, ruleID string, version int) error
    
    // 测试规则
    TestRule(ctx context.Context, rule *AlertRule) (*TestResult, error)
    
    // 验证规则
    ValidateRules(rules []*AlertRule) error
    
    // 同步到Prometheus
    SyncToPrometheus(rules []*AlertRule) error
}
```

---

## 6. 数据设计

### 6.1 核心数据模型

**关联事件模型**:

```go
// 关联事件
type CorrelatedEvent struct {
    ID              string                 `json:"id" db:"id"`
    CorrelationType string                 `json:"correlation_type" db:"correlation_type"` // temporal/entity/causal
    RiskScore       float64                `json:"risk_score" db:"risk_score"`
    EventCount      int                    `json:"event_count" db:"event_count"`
    Entities        map[string]string      `json:"entities" db:"entities"`
    Timeline        []time.Time            `json:"timeline" db:"timeline"`
    GraphData       []byte                 `json:"graph_data" db:"graph_data"` // 序列化的图数据
    Metadata        map[string]interface{} `json:"metadata" db:"metadata"`
    CreatedAt       time.Time              `json:"created_at" db:"created_at"`
}

// 关联规则
type CorrelationRule struct {
    ID          string              `json:"id" db:"id"`
    Name        string              `json:"name" db:"name"`
    Description string              `json:"description" db:"description"`
    Pattern     []byte              `json:"pattern" db:"pattern"` // 序列化的事件模式
    TimeWindow  int64               `json:"time_window" db:"time_window"` // 秒
    Conditions  []byte              `json:"conditions" db:"conditions"` // 序列化的条件
    RiskScore   float64             `json:"risk_score" db:"risk_score"`
    Enabled     bool                `json:"enabled" db:"enabled"`
    CreatedAt   time.Time           `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time           `json:"updated_at" db:"updated_at"`
}
```

**语义分析模型**:

```go
// 语义分析结果
type SemanticAnalysisResult struct {
    ID          int64                  `json:"id" db:"id"`
    LogID       string                 `json:"log_id" db:"log_id"`
    Language    string                 `json:"language" db:"language"`
    Entities    []byte                 `json:"entities" db:"entities"` // JSON序列化
    Sentiment   string                 `json:"sentiment" db:"sentiment"`
    SentimentScore float64             `json:"sentiment_score" db:"sentiment_score"`
    Keywords    []string               `json:"keywords" db:"keywords"`
    Summary     string                 `json:"summary" db:"summary"`
    Embedding   []byte                 `json:"embedding" db:"embedding"` // 二进制向量
    AnalyzedAt  time.Time              `json:"analyzed_at" db:"analyzed_at"`
}

// 实体
type Entity struct {
    ID         int64     `json:"id" db:"id"`
    Type       string    `json:"type" db:"type"` // person/ip/url/email/file/location
    Value      string    `json:"value" db:"value"`
    Confidence float64   `json:"confidence" db:"confidence"`
    FirstSeen  time.Time `json:"first_seen" db:"first_seen"`
    LastSeen   time.Time `json:"last_seen" db:"last_seen"`
    Count      int64     `json:"count" db:"count"`
}
```

**数据血缘模型**:

```go
// 血缘信息
type LineageInfo struct {
    ID           string                 `json:"id" db:"id"`
    LogID        string                 `json:"log_id" db:"log_id"`
    Source       LineageSource          `json:"source" db:"source"`
    Processors   []LineageProcessor     `json:"processors" db:"processors"`
    Destinations []LineageDestination   `json:"destinations" db:"destinations"`
    Version      int                    `json:"version" db:"version"`
    CreatedAt    time.Time              `json:"created_at" db:"created_at"`
}

// 血缘来源
type LineageSource struct {
    Type     string                 `json:"type"` // file/api/stream
    Location string                 `json:"location"`
    Host     string                 `json:"host"`
    Metadata map[string]interface{} `json:"metadata"`
}

// 血缘处理器
type LineageProcessor struct {
    Name      string                 `json:"name"`
    Type      string                 `json:"type"` // cleaner/transformer/aggregator/masker
    Operation string                 `json:"operation"`
    Timestamp time.Time              `json:"timestamp"`
    Metadata  map[string]interface{} `json:"metadata"`
}

// 血缘目标
type LineageDestination struct {
    Type     string                 `json:"type"` // elasticsearch/s3/kafka
    Location string                 `json:"location"`
    Metadata map[string]interface{} `json:"metadata"`
}
```

**取证案件模型**:

```go
// 取证案件
type ForensicsCase struct {
    ID            string                 `json:"id" db:"id"`
    Name          string                 `json:"name" db:"name"`
    Description   string                 `json:"description" db:"description"`
    Investigator  string                 `json:"investigator" db:"investigator"`
    Status        string                 `json:"status" db:"status"` // open/in_progress/closed/archived
    StartTime     time.Time              `json:"start_time" db:"start_time"`
    EndTime       time.Time              `json:"end_time" db:"end_time"`
    PreservedLogs []string               `json:"preserved_logs" db:"preserved_logs"`
    Metadata      map[string]interface{} `json:"metadata" db:"metadata"`
    CreatedAt     time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt     time.Time              `json:"updated_at" db:"updated_at"`
}

// 证据
type Evidence struct {
    ID            string                 `json:"id" db:"id"`
    CaseID        string                 `json:"case_id" db:"case_id"`
    Type          string                 `json:"type" db:"type"` // log/file/network
    Source        string                 `json:"source" db:"source"`
    Hash          string                 `json:"hash" db:"hash"`
    Signature     string                 `json:"signature" db:"signature"`
    TimestampData []byte                 `json:"timestamp_data" db:"timestamp_data"`
    ChainOfCustody []byte                `json:"chain_of_custody" db:"chain_of_custody"`
    Metadata      map[string]interface{} `json:"metadata" db:"metadata"`
    CollectedAt   time.Time              `json:"collected_at" db:"collected_at"`
}
```

**健康评分模型**:

```go
// 健康评分
type HealthScore struct {
    ID              int64              `json:"id" db:"id"`
    TotalScore      float64            `json:"total_score" db:"total_score"`
    AvailabilityScore float64          `json:"availability_score" db:"availability_score"`
    PerformanceScore  float64          `json:"performance_score" db:"performance_score"`
    StabilityScore    float64          `json:"stability_score" db:"stability_score"`
    SecurityScore     float64          `json:"security_score" db:"security_score"`
    Metrics         map[string]float64 `json:"metrics" db:"metrics"`
    Timestamp       time.Time          `json:"timestamp" db:"timestamp"`
}

// 评分权重
type ScoreWeights struct {
    ID           int       `json:"id" db:"id"`
    Availability float64   `json:"availability" db:"availability"`
    Performance  float64   `json:"performance" db:"performance"`
    Stability    float64   `json:"stability" db:"stability"`
    Security     float64   `json:"security" db:"security"`
    UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}
```

### 6.2 数据库设计

**关联事件表 (correlated_events)**:

```sql
CREATE TABLE correlated_events (
    id VARCHAR(36) PRIMARY KEY,
    correlation_type VARCHAR(20) NOT NULL, -- temporal/entity/causal
    risk_score DECIMAL(5,2) NOT NULL,
    event_count INT NOT NULL,
    entities JSONB,
    timeline JSONB,
    graph_data BYTEA,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_correlation_type (correlation_type),
    INDEX idx_risk_score (risk_score DESC),
    INDEX idx_created_at (created_at DESC)
);

-- 关联规则表
CREATE TABLE correlation_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    pattern JSONB NOT NULL,
    time_window BIGINT NOT NULL, -- 秒
    conditions JSONB,
    risk_score DECIMAL(5,2) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_enabled (enabled),
    INDEX idx_name (name)
);
```

**语义分析表 (semantic_analysis_results)**:

```sql
CREATE TABLE semantic_analysis_results (
    id BIGSERIAL PRIMARY KEY,
    log_id VARCHAR(36) NOT NULL,
    language VARCHAR(10) NOT NULL,
    entities JSONB,
    sentiment VARCHAR(20),
    sentiment_score DECIMAL(5,2),
    keywords TEXT[],
    summary TEXT,
    embedding BYTEA, -- 向量数据
    analyzed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_log_id (log_id),
    INDEX idx_language (language),
    INDEX idx_sentiment (sentiment),
    INDEX idx_analyzed_at (analyzed_at DESC)
);

-- 实体表
CREATE TABLE entities (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    value VARCHAR(500) NOT NULL,
    confidence DECIMAL(5,2),
    first_seen TIMESTAMP NOT NULL,
    last_seen TIMESTAMP NOT NULL,
    count BIGINT DEFAULT 1,
    
    INDEX idx_type (type),
    INDEX idx_value (value),
    INDEX idx_last_seen (last_seen DESC),
    UNIQUE (type, value)
);
```

**数据血缘表 (lineage_info)**:

```sql
CREATE TABLE lineage_info (
    id VARCHAR(36) PRIMARY KEY,
    log_id VARCHAR(36) NOT NULL,
    source JSONB NOT NULL,
    processors JSONB,
    destinations JSONB,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_log_id (log_id),
    INDEX idx_version (version),
    INDEX idx_created_at (created_at DESC)
);

-- 血缘版本历史表
CREATE TABLE lineage_history (
    id BIGSERIAL PRIMARY KEY,
    lineage_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    changes JSONB NOT NULL,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_lineage_id (lineage_id),
    INDEX idx_version (version),
    FOREIGN KEY (lineage_id) REFERENCES lineage_info(id) ON DELETE CASCADE
);
```

**取证案件表 (forensics_cases)**:

```sql
CREATE TABLE forensics_cases (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    investigator VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    preserved_logs TEXT[],
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_status (status),
    INDEX idx_investigator (investigator),
    INDEX idx_created_at (created_at DESC)
);

-- 证据表
CREATE TABLE evidence (
    id VARCHAR(36) PRIMARY KEY,
    case_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    source VARCHAR(500) NOT NULL,
    hash VARCHAR(64) NOT NULL, -- SHA-256
    signature TEXT NOT NULL,
    timestamp_data BYTEA,
    chain_of_custody JSONB,
    metadata JSONB,
    collected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_case_id (case_id),
    INDEX idx_type (type),
    INDEX idx_hash (hash),
    INDEX idx_collected_at (collected_at DESC),
    FOREIGN KEY (case_id) REFERENCES forensics_cases(id) ON DELETE CASCADE
);
```

**健康评分表 (health_scores)**:

```sql
CREATE TABLE health_scores (
    id BIGSERIAL PRIMARY KEY,
    total_score DECIMAL(5,2) NOT NULL,
    availability_score DECIMAL(5,2) NOT NULL,
    performance_score DECIMAL(5,2) NOT NULL,
    stability_score DECIMAL(5,2) NOT NULL,
    security_score DECIMAL(5,2) NOT NULL,
    metrics JSONB,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_total_score (total_score DESC),
    INDEX idx_timestamp (timestamp DESC)
);

-- 评分权重表
CREATE TABLE score_weights (
    id SERIAL PRIMARY KEY,
    availability DECIMAL(5,2) NOT NULL DEFAULT 0.30,
    performance DECIMAL(5,2) NOT NULL DEFAULT 0.25,
    stability DECIMAL(5,2) NOT NULL DEFAULT 0.25,
    security DECIMAL(5,2) NOT NULL DEFAULT 0.20,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (availability + performance + stability + security = 1.0)
);
```

**告警规则表 (alert_rules)** - 新增:

```sql
CREATE TABLE alert_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL, -- correlation/semantic/lineage/forensics/health/system
    expression TEXT NOT NULL, -- PromQL表达式
    duration VARCHAR(20) NOT NULL, -- 持续时间，如"5m"
    severity VARCHAR(20) NOT NULL, -- critical/warning/info
    description TEXT,
    labels JSONB,
    annotations JSONB,
    actions JSONB, -- 告警动作配置
    enabled BOOLEAN NOT NULL DEFAULT true,
    version INT NOT NULL DEFAULT 1,
    created_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_category (category),
    INDEX idx_enabled (enabled),
    INDEX idx_name (name),
    INDEX idx_created_at (created_at DESC)
);

-- 告警规则变更历史表
CREATE TABLE alert_rule_history (
    id BIGSERIAL PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    version INT NOT NULL,
    changes JSONB NOT NULL,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_rule_id (rule_id),
    INDEX idx_version (version),
    INDEX idx_changed_at (changed_at DESC),
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);

-- 告警触发记录表
CREATE TABLE alert_triggers (
    id BIGSERIAL PRIMARY KEY,
    rule_id VARCHAR(36) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL, -- firing/resolved
    labels JSONB,
    annotations JSONB,
    started_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    duration INT, -- 持续时间（秒）
    
    INDEX idx_rule_id (rule_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at DESC),
    FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
);
```

**采样规则表 (sampling_rules)**:

```sql
CREATE TABLE sampling_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    condition JSONB NOT NULL,
    sampling_rate DECIMAL(5,4) NOT NULL, -- 0.0001 - 1.0
    priority INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_priority (priority DESC),
    INDEX idx_enabled (enabled)
);
```

**日志模板表 (log_templates)**:

```sql
CREATE TABLE log_templates (
    id VARCHAR(36) PRIMARY KEY,
    pattern TEXT NOT NULL,
    variables TEXT[],
    example TEXT,
    match_count BIGINT DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_match_count (match_count DESC),
    INDEX idx_created_at (created_at DESC)
);
```

**路由规则表 (routing_rules)**:

```sql
CREATE TABLE routing_rules (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    condition JSONB NOT NULL,
    targets TEXT[] NOT NULL,
    load_balance_method VARCHAR(50) NOT NULL DEFAULT 'round_robin',
    priority INT NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_priority (priority DESC),
    INDEX idx_enabled (enabled)
);
```

### 6.3 缓存设计

**Redis缓存策略**:

| 缓存键 | 数据类型 | TTL | 说明 |
|--------|---------|-----|------|
| config:module16:correlation | Hash | - | 关联引擎配置（热更新） |
| config:module16:semantic | Hash | - | 语义分析配置（热更新） |
| config:module16:lineage | Hash | - | 血缘追踪配置（热更新） |
| config:module16:forensics | Hash | - | 取证配置（热更新） |
| config:module16:health | Hash | - | 健康评分配置（热更新） |
| config:module16:sampling | Hash | - | 采样配置（热更新） |
| config:module16:routing | Hash | - | 路由配置（热更新） |
| correlation:rules:{id} | String | 1h | 关联规则缓存 |
| semantic:result:{log_id} | String | 24h | 语义分析结果缓存 |
| entity:{type}:{value} | String | 1h | 实体信息缓存 |
| lineage:{log_id} | String | 1h | 血缘信息缓存 |
| health:score:latest | String | 1m | 最新健康评分 |
| sampling:rate | String | 5m | 当前采样率 |
| routing:targets | Set | 1m | 可用路由目标 |
| template:{id} | String | 1h | 日志模板缓存 |

**缓存更新策略**:

1. **配置缓存**: 通过Pub/Sub实时更新，永不过期
2. **结果缓存**: 写入时更新，设置TTL自动过期
3. **统计缓存**: 定期聚合更新，短TTL
4. **规则缓存**: 规则变更时主动失效

### 6.4 Neo4j图数据库设计

**节点类型**:

```cypher
// 日志事件节点
(:Event {
    id: string,
    timestamp: long,
    level: string,
    message: string,
    source: string
})

// 实体节点
(:Entity {
    type: string,
    value: string,
    confidence: float
})

// 数据源节点
(:DataSource {
    type: string,
    location: string,
    host: string
})

// 处理器节点
(:Processor {
    name: string,
    type: string,
    operation: string
})
```

**关系类型**:

```cypher
// 事件关联关系
(:Event)-[:CORRELATES {
    type: string,
    weight: float,
    timestamp: long
}]->(:Event)

// 实体包含关系
(:Event)-[:CONTAINS {
    confidence: float,
    position: int
}]->(:Entity)

// 血缘关系
(:DataSource)-[:PRODUCES]->(:Event)
(:Event)-[:PROCESSED_BY]->(:Processor)
(:Processor)-[:OUTPUTS]->(:Event)

// 实体关联关系
(:Entity)-[:RELATED_TO {
    type: string,
    strength: float
}]->(:Entity)
```

---

## 7. 安全设计

### 7.1 认证授权

**认证机制**:
- JWT Token认证，支持Token刷新
- API Key认证，用于服务间调用
- RBAC权限控制，细粒度权限管理

**权限定义**:

| 权限 | 说明 | 适用角色 |
|------|------|----------|
| correlation:read | 查看关联事件 | 安全分析师、管理员 |
| correlation:write | 创建/修改关联规则 | 安全架构师、管理员 |
| semantic:read | 查看语义分析结果 | 所有用户 |
| semantic:write | 修改语义分析配置 | 系统管理员 |
| lineage:read | 查看数据血缘 | 数据治理专员、管理员 |
| lineage:write | 修改血缘配置 | 数据治理专员、管理员 |
| forensics:read | 查看取证案件 | 安全调查员、管理员 |
| forensics:write | 创建/修改取证案件 | 安全调查员、管理员 |
| forensics:preserve | 保全证据 | 安全调查员、管理员 |
| health:read | 查看健康评分 | 所有用户 |
| health:write | 修改健康配置 | 系统管理员 |
| config:read | 查看配置 | 所有用户 |
| config:write | 修改配置 | 系统管理员 |

### 7.2 数据安全

**传输加密**:
- 所有API通信使用TLS 1.3
- 内部服务间通信使用mTLS
- 敏感数据传输使用端到端加密

**存储加密**:
- 证据数据使用AES-256加密存储
- 数据库连接使用SSL/TLS
- 备份数据加密存储

**数据脱敏**:
- 日志中的敏感信息自动脱敏
- 支持自定义脱敏规则
- 脱敏操作记录审计日志

### 7.3 审计日志

**审计事件**:

| 事件类型 | 记录内容 | 保留期 |
|----------|----------|--------|
| 配置变更 | 变更前后值、操作人、时间 | 365天 |
| 规则创建/修改/删除 | 规则内容、操作人、时间 | 365天 |
| 案件创建/修改 | 案件信息、操作人、时间 | 永久 |
| 证据保全 | 证据ID、哈希值、操作人、时间 | 永久 |
| 证据访问 | 证据ID、访问人、时间 | 365天 |
| 权限变更 | 用户、权限、操作人、时间 | 365天 |
| 敏感操作 | 操作类型、参数、操作人、时间 | 365天 |

**审计日志格式**:

```json
{
  "event_id": "audit-123456",
  "event_type": "config_change",
  "timestamp": "2026-02-01T10:30:00Z",
  "user": "admin@example.com",
  "ip_address": "192.168.1.100",
  "action": "update_correlation_config",
  "resource": "correlation_rules/rule-001",
  "changes": {
    "before": {"enabled": true},
    "after": {"enabled": false}
  },
  "result": "success"
}
```

### 7.4 安全加固

**输入验证**:
- 所有API输入进行严格验证
- 防止SQL注入、XSS攻击
- 限制输入长度和格式

**访问控制**:
- IP白名单限制
- API调用频率限制
- 异常访问检测和阻断

**密钥管理**:
- 使用HashiCorp Vault管理密钥
- 定期轮换密钥
- 密钥访问审计

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 事件关联延迟 | < 5秒 (P95) | Flink作业延迟监控 |
| 语义分析延迟 | < 500ms (P95) | API响应时间 |
| 血缘追踪延迟 | < 1秒 | 血缘记录写入延迟 |
| 证据保全延迟 | < 2秒 | 保全操作完成时间 |
| 健康评分更新 | 每1分钟 | 评分计算周期 |
| 智能路由延迟 | < 50ms (P99) | 路由决策时间 |
| 语义搜索延迟 | < 200ms (P95) | 向量搜索时间 |
| 配置热更新生效 | < 5秒 | Pub/Sub传播延迟 |
| API吞吐量 | > 10000 QPS | 压测结果 |
| 并发用户数 | > 1000 | 负载测试 |

### 8.2 优化策略

**Flink流处理优化**:
- 合理设置并行度（根据CPU核数）
- 启用Checkpoint（间隔60秒）
- 使用RocksDB状态后端
- 配置合适的时间窗口大小
- 启用增量Checkpoint

**Neo4j图数据库优化**:
- 为常用查询创建索引
- 使用参数化查询避免重复编译
- 批量写入优化（每批1000条）
- 定期压缩数据库
- 配置足够的堆内存（建议16GB+）

**语义分析优化**:
- 使用GPU加速BERT推理
- 批量处理日志（每批100条）
- 缓存常见实体识别结果
- 异步处理非关键路径
- 使用轻量级模型（DistilBERT）

**向量搜索优化**:
- 使用Faiss GPU索引
- 选择合适的索引类型（IVF、HNSW）
- 定期重建索引优化性能
- 使用量化技术减少内存占用
- 分片存储大规模向量

**缓存优化**:
- 热点数据预加载
- 使用Redis Cluster提高吞吐
- 合理设置TTL避免缓存雪崩
- 使用本地缓存减少网络开销
- 缓存穿透保护

### 8.3 容量规划

**存储容量**:

| 数据类型 | 日增量 | 保留期 | 总容量 |
|----------|--------|--------|--------|
| 关联事件 | 10GB | 90天 | 900GB |
| 语义分析结果 | 50GB | 30天 | 1.5TB |
| 血缘信息 | 5GB | 365天 | 1.8TB |
| 证据数据 | 1GB | 永久 | 持续增长 |
| 健康评分 | 100MB | 365天 | 36GB |
| Neo4j图数据 | 20GB | 90天 | 1.8TB |
| 向量索引 | 100GB | 30天 | 3TB |

**计算资源**:

| 组件 | CPU | 内存 | 副本数 |
|------|-----|------|--------|
| Flink JobManager | 4核 | 8GB | 2 |
| Flink TaskManager | 8核 | 16GB | 4 |
| Neo4j | 8核 | 32GB | 3 |
| NLP服务 | 8核+GPU | 32GB | 3 |
| 向量搜索服务 | 4核+GPU | 16GB | 2 |
| API服务 | 4核 | 8GB | 5 |

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Kubernetes Cluster                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Namespace: log-advanced                 │  │
│  │                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │  │
│  │  │ Flink        │  │ Neo4j        │  │ NLP      │  │  │
│  │  │ StatefulSet  │  │ StatefulSet  │  │ Deploy   │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │  │
│  │                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │  │
│  │  │ Vector       │  │ API          │  │ Config   │  │  │
│  │  │ Deploy       │  │ Deploy       │  │ ConfigMap│  │  │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Namespace: data-storage                 │  │
│  │                                                      │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │  │
│  │  │ PostgreSQL   │  │ Redis        │  │ InfluxDB │  │  │
│  │  │ StatefulSet  │  │ StatefulSet  │  │ StatefulSet│ │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

**Flink部署配置**:

```yaml
apiVersion: flink.apache.org/v1beta1
kind: FlinkDeployment
metadata:
  name: correlation-engine
  namespace: log-advanced
spec:
  image: flink:1.17
  flinkVersion: v1_17
  jobManager:
    replicas: 2
    resource:
      memory: "8Gi"
      cpu: 4
  taskManager:
    replicas: 4
    resource:
      memory: "16Gi"
      cpu: 8
  job:
    jarURI: local:///opt/flink/usrlib/correlation-engine.jar
    parallelism: 16
    upgradeMode: savepoint
```

**Neo4j部署配置**:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: neo4j
  namespace: log-advanced
spec:
  serviceName: neo4j
  replicas: 3
  template:
    spec:
      containers:
      - name: neo4j
        image: neo4j:5.15-enterprise
        resources:
          requests:
            memory: "32Gi"
            cpu: "8"
          limits:
            memory: "32Gi"
            cpu: "8"
        env:
        - name: NEO4J_dbms_memory_heap_max__size
          value: "16G"
        - name: NEO4J_dbms_memory_pagecache_size
          value: "12G"
```

### 9.3 配置管理

**配置热更新（推荐方式）**:

模块16的所有配置支持通过Redis Pub/Sub实现热更新，无需重启服务。详细设计见第11节"配置热更新详细设计"。

**热更新优势**:
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（3-5秒）
- ✅ 支持配置验证和回滚
- ✅ 记录完整的审计日志
- ✅ 支持82个配置项的动态更新

**热更新流程**:
1. 用户通过API或Web Console修改配置
2. 配置验证（语法、范围、依赖检查）
3. 保存到PostgreSQL（版本化）
4. 同步到Redis缓存
5. Redis发布Pub/Sub通知（`config:module16:{module}:reload`）
6. 所有服务实例订阅到通知
7. 重新加载配置并验证
8. 使用atomic.Value原子更新配置
9. 记录配置变更审计日志
10. 配置在3-5秒内生效

**支持热更新的配置模块**:
- 事件关联配置（correlation）
- 语义分析配置（semantic）
- 数据血缘配置（lineage）
- 审计取证配置（forensics）
- 健康评分配置（health）
- 采样控制配置（sampling）
- 模板管理配置（template）
- 质量评估配置（quality）
- 智能路由配置（routing）
- 压缩策略配置（compression）
- 成本优化配置（cost）
- 智能推荐配置（recommendation）
- 告警规则配置（alert_rules）

**ConfigMap（备选方式）**:

当热更新机制不可用时（如Redis故障），可以通过修改ConfigMap并重启Pod来更新配置：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: module16-config
  namespace: log-advanced
data:
  correlation.yaml: |
    enabled: true
    time_windows:
      - name: "1m"
        duration: "1m"
      - name: "5m"
        duration: "5m"
    entity_types:
      - user
      - ip
      - session
    ml_enabled: false
    risk_threshold: 80.0
    max_events_per_correlation: 100
    retention_days: 90
    alert_enabled: true
  
  semantic.yaml: |
    enabled: true
    nlp_enabled: true
    languages:
      - en
      - zh
      - ja
    entity_types:
      - person
      - ip
      - url
      - email
      - file
    sentiment_enabled: true
    knowledge_graph_enabled: true
    similarity_threshold: 0.7
    max_entities_per_log: 50
  
  health.yaml: |
    enabled: true
    update_interval: 60
    availability_weight: 0.30
    performance_weight: 0.25
    stability_weight: 0.25
    security_weight: 0.20
    alert_threshold: 60.0
  
  alert_rules.yaml: |
    enabled: true
    evaluation_interval: 30
    notification_enabled: true
    notification_channels:
      - email
      - slack
    aggregation_enabled: true
    aggregation_window: 300
    silence_enabled: true
    auto_resolve: true
```

**更新ConfigMap后重启Pod**:
```bash
# 编辑ConfigMap
kubectl edit configmap module16-config -n log-advanced

# 重启相关Pod使配置生效
kubectl rollout restart deployment/correlation-engine -n log-advanced
kubectl rollout restart deployment/semantic-analyzer -n log-advanced
kubectl rollout restart deployment/health-scorer -n log-advanced

# 查看重启状态
kubectl rollout status deployment/correlation-engine -n log-advanced
```

**配置优先级**:

模块16的配置加载优先级（从高到低）：
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
| Flink作业配置 | 需要重启作业 | 修改FlinkDeployment并重启 |
| Neo4j连接配置 | 需要重建连接池 | 修改ConfigMap并重启Pod |
| 资源配额（CPU/内存） | 需要Pod重建 | 修改Deployment并滚动更新 |
| 镜像版本 | 需要Pod重建 | 修改Deployment并滚动更新 |
| 端口配置 | 需要Service更新 | 修改Service配置 |
| TLS证书 | 需要重新加载证书 | 修改Secret并重启Pod |

**Secret管理**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: module16-secret
  namespace: log-advanced
type: Opaque
data:
  neo4j-password: <base64-encoded>
  postgres-password: <base64-encoded>
  redis-password: <base64-encoded>
  tsa-api-key: <base64-encoded>  # 时间戳认证机构API密钥
  signature-private-key: <base64-encoded>  # 数字签名私钥
```

**注意**: Secret中的敏感信息（数据库密码、API密钥、私钥等）不推荐热更新，建议通过Secret更新并重启服务。

### 9.4 发布策略

**滚动更新**:
- 使用Kubernetes滚动更新
- 每次更新1个Pod
- 健康检查通过后继续
- 支持快速回滚

**灰度发布**:
- 使用Istio流量管理
- 10% → 50% → 100%
- 监控关键指标
- 异常自动回滚

**蓝绿部署**:
- 关键组件使用蓝绿部署
- 快速切换流量
- 零停机时间
- 快速回滚能力

---

## 10. 监控与运维

### 10.1 监控指标

**Flink作业监控**:

```yaml
# Prometheus指标
flink_taskmanager_job_task_operator_numRecordsIn
flink_taskmanager_job_task_operator_numRecordsOut
flink_taskmanager_job_task_checkpointAlignmentTime
flink_jobmanager_job_lastCheckpointDuration
flink_jobmanager_job_numberOfFailedCheckpoints
```

**Neo4j监控**:

```yaml
# Prometheus指标
neo4j_database_store_size_total
neo4j_database_transaction_active_read
neo4j_database_transaction_active_write
neo4j_database_cypher_replan_events_total
neo4j_database_pool_total_used
```

**NLP服务监控**:

```yaml
# 自定义指标
nlp_analysis_duration_seconds
nlp_entity_extraction_total
nlp_sentiment_analysis_total
nlp_embedding_generation_duration_seconds
nlp_model_inference_errors_total
```

**向量搜索监控**:

```yaml
# 自定义指标
vector_search_duration_seconds
vector_index_size_bytes
vector_search_results_total
vector_index_rebuild_duration_seconds
```

### 10.2 告警规则（支持热更新）

**告警规则支持热更新**，通过配置中心管理，无需重启Prometheus。

**内置告警规则**:

| 告警名称 | 表达式 | 持续时间 | 严重级别 | 说明 | 热更新 |
|---------|--------|----------|----------|------|--------|
| FlinkJobDown | flink_jobmanager_job_uptime == 0 | 1m | critical | Flink作业停止 | ✅ 支持 |
| FlinkCheckpointFailed | rate(flink_jobmanager_job_numberOfFailedCheckpoints[5m]) > 0 | 5m | warning | Checkpoint失败 | ✅ 支持 |
| Neo4jHighMemoryUsage | neo4j_database_pool_total_used / neo4j_database_pool_total_size > 0.9 | 5m | warning | Neo4j内存使用率过高 | ✅ 支持 |
| HighRiskCorrelationDetected | correlation_high_risk_events_total > 10 | 1m | critical | 检测到高风险关联事件 | ✅ 支持 |
| SystemHealthScoreLow | health_score_total < 60 | 5m | critical | 系统健康评分过低 | ✅ 支持 |
| SemanticAnalysisTimeout | semantic_analysis_duration_seconds > 1 | 5m | warning | 语义分析超时 | ✅ 支持 |
| VectorSearchSlow | vector_search_duration_seconds > 0.5 | 5m | warning | 向量搜索慢 | ✅ 支持 |
| LineageTrackingFailed | rate(lineage_tracking_errors_total[5m]) > 0.1 | 5m | warning | 血缘追踪失败率高 | ✅ 支持 |
| ForensicsSignatureFailed | rate(forensics_signature_errors_total[5m]) > 0 | 1m | critical | 证据签名失败 | ✅ 支持 |
| SamplingRateAbnormal | sampling_rate < 0.01 OR sampling_rate > 1 | 1m | warning | 采样率异常 | ✅ 支持 |
| RoutingTargetDown | routing_target_health == 0 | 1m | critical | 路由目标不可用 | ✅ 支持 |
| CompressionRatioLow | compression_ratio < 2 | 10m | info | 压缩比过低 | ✅ 支持 |

**告警规则热更新实现**:

```go
// internal/alert/rule_manager.go
package alert

import (
    "context"
    "encoding/json"
    "fmt"
    "sync/atomic"
    "time"
    "github.com/go-redis/redis/v8"
    "gorm.io/gorm"
)

// 告警规则管理器
type AlertRuleManager struct {
    db              *gorm.DB
    redis           *redis.Client
    rules           atomic.Value // []*AlertRule
    pubsub          *redis.PubSub
    prometheusURL   string
}

// 告警规则结构
type AlertRule struct {
    ID          string            `json:"id" db:"id"`
    Name        string            `json:"name" db:"name"`
    Category    string            `json:"category" db:"category"` // correlation/semantic/lineage/forensics/health/system
    Expression  string            `json:"expression" db:"expression"` // PromQL表达式
    Duration    string            `json:"duration" db:"duration"` // 持续时间，如"5m"
    Severity    string            `json:"severity" db:"severity"` // critical/warning/info
    Description string            `json:"description" db:"description"`
    Labels      map[string]string `json:"labels" db:"labels"`
    Annotations map[string]string `json:"annotations" db:"annotations"`
    Actions     []AlertAction     `json:"actions" db:"actions"` // 告警动作
    Enabled     bool              `json:"enabled" db:"enabled"`
    Version     int               `json:"version" db:"version"`
    CreatedBy   string            `json:"created_by" db:"created_by"`
    CreatedAt   time.Time         `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
}

// 告警动作
type AlertAction struct {
    Type   string                 `json:"type"` // email/slack/webhook/dingtalk/custom
    Config map[string]interface{} `json:"config"`
}

// 创建告警规则管理器
func NewAlertRuleManager(db *gorm.DB, redis *redis.Client, prometheusURL string) *AlertRuleManager {
    arm := &AlertRuleManager{
        db:            db,
        redis:         redis,
        prometheusURL: prometheusURL,
    }
    return arm
}

// 启动告警规则管理器
func (arm *AlertRuleManager) Start() error {
    log.Info("启动告警规则管理器")
    
    // 1. 从PostgreSQL加载告警规则
    rules, err := arm.loadRulesFromDB()
    if err != nil {
        // 如果数据库加载失败，从YAML文件加载默认规则
        log.Warnf("从数据库加载告警规则失败: %v，尝试从YAML加载", err)
        rules, err = arm.loadRulesFromYAML()
        if err != nil {
            return fmt.Errorf("加载告警规则失败: %w", err)
        }
    }
    arm.rules.Store(rules)
    
    // 2. 同步到Redis
    if err := arm.syncRulesToRedis(rules); err != nil {
        log.Warnf("同步告警规则到Redis失败: %v", err)
    }
    
    // 3. 同步到Prometheus
    if err := arm.syncToPrometheus(rules); err != nil {
        log.Warnf("同步告警规则到Prometheus失败: %v", err)
    }
    
    // 4. 订阅配置变更
    arm.pubsub = arm.redis.Subscribe(context.Background(), "config:module16:alert_rules:reload")
    go arm.watchRuleChanges()
    
    log.Info("告警规则管理器已启动")
    return nil
}

// 监听规则变更
func (arm *AlertRuleManager) watchRuleChanges() {
    for msg := range arm.pubsub.Channel() {
        log.Infof("收到告警规则变更通知: %s", msg.Payload)
        
        // 从Redis加载新规则
        newRules, err := arm.loadRulesFromRedis()
        if err != nil {
            log.Errorf("加载新告警规则失败: %v", err)
            continue
        }
        
        // 验证规则
        if err := arm.validateRules(newRules); err != nil {
            log.Errorf("告警规则验证失败: %v", err)
            // 发送告警通知
            arm.sendAlert("告警规则验证失败", err.Error())
            continue
        }
        
        // 同步到Prometheus
        if err := arm.syncToPrometheus(newRules); err != nil {
            log.Errorf("同步告警规则到Prometheus失败: %v", err)
            continue
        }
        
        // 原子更新规则
        arm.rules.Store(newRules)
        
        log.Infof("告警规则已更新: %d条规则", len(newRules))
    }
}

// 从数据库加载规则
func (arm *AlertRuleManager) loadRulesFromDB() ([]*AlertRule, error) {
    var rules []*AlertRule
    err := arm.db.Where("enabled = ?", true).Find(&rules).Error
    if err != nil {
        return nil, err
    }
    return rules, nil
}

// 从YAML加载默认规则
func (arm *AlertRuleManager) loadRulesFromYAML() ([]*AlertRule, error) {
    // 读取YAML文件
    data, err := os.ReadFile("configs/alert_rules.yaml")
    if err != nil {
        return nil, err
    }
    
    var config struct {
        Rules []*AlertRule `yaml:"rules"`
    }
    
    if err := yaml.Unmarshal(data, &config); err != nil {
        return nil, err
    }
    
    return config.Rules, nil
}

// 从Redis加载规则
func (arm *AlertRuleManager) loadRulesFromRedis() ([]*AlertRule, error) {
    data, err := arm.redis.Get(context.Background(), "config:module16:alert_rules").Bytes()
    if err != nil {
        return nil, err
    }
    
    var rules []*AlertRule
    if err := json.Unmarshal(data, &rules); err != nil {
        return nil, err
    }
    
    return rules, nil
}

// 同步规则到Redis
func (arm *AlertRuleManager) syncRulesToRedis(rules []*AlertRule) error {
    data, err := json.Marshal(rules)
    if err != nil {
        return err
    }
    
    return arm.redis.Set(context.Background(), "config:module16:alert_rules", data, 0).Err()
}

// 同步到Prometheus
func (arm *AlertRuleManager) syncToPrometheus(rules []*AlertRule) error {
    // 生成Prometheus告警规则配置
    promConfig := arm.generatePrometheusConfig(rules)
    
    // 调用Prometheus API更新规则
    // POST /-/reload
    url := fmt.Sprintf("%s/-/reload", arm.prometheusURL)
    resp, err := http.Post(url, "application/json", nil)
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("Prometheus返回错误: %d", resp.StatusCode)
    }
    
    log.Info("告警规则已同步到Prometheus")
    return nil
}

// 生成Prometheus配置
func (arm *AlertRuleManager) generatePrometheusConfig(rules []*AlertRule) string {
    var groups []map[string]interface{}
    
    // 按分类分组
    rulesByCategory := make(map[string][]*AlertRule)
    for _, rule := range rules {
        if rule.Enabled {
            rulesByCategory[rule.Category] = append(rulesByCategory[rule.Category], rule)
        }
    }
    
    // 生成每个分组的规则
    for category, categoryRules := range rulesByCategory {
        group := map[string]interface{}{
            "name":  fmt.Sprintf("module16_%s_alerts", category),
            "rules": []map[string]interface{}{},
        }
        
        for _, rule := range categoryRules {
            promRule := map[string]interface{}{
                "alert":       rule.Name,
                "expr":        rule.Expression,
                "for":         rule.Duration,
                "labels":      rule.Labels,
                "annotations": rule.Annotations,
            }
            group["rules"] = append(group["rules"].([]map[string]interface{}), promRule)
        }
        
        groups = append(groups, group)
    }
    
    config := map[string]interface{}{
        "groups": groups,
    }
    
    data, _ := yaml.Marshal(config)
    return string(data)
}

// 验证规则
func (arm *AlertRuleManager) validateRules(rules []*AlertRule) error {
    for _, rule := range rules {
        // 验证必填字段
        if rule.Name == "" {
            return fmt.Errorf("规则名称不能为空")
        }
        if rule.Expression == "" {
            return fmt.Errorf("规则表达式不能为空: %s", rule.Name)
        }
        
        // 验证持续时间格式
        if _, err := time.ParseDuration(rule.Duration); err != nil {
            return fmt.Errorf("持续时间格式错误: %s, %v", rule.Name, err)
        }
        
        // 验证严重级别
        validSeverities := map[string]bool{"critical": true, "warning": true, "info": true}
        if !validSeverities[rule.Severity] {
            return fmt.Errorf("严重级别无效: %s, 必须是critical/warning/info之一", rule.Name)
        }
        
        // 验证告警动作
        for _, action := range rule.Actions {
            if err := arm.validateAction(action); err != nil {
                return fmt.Errorf("告警动作验证失败: %s, %v", rule.Name, err)
            }
        }
    }
    
    return nil
}

// 验证告警动作
func (arm *AlertRuleManager) validateAction(action AlertAction) error {
    validTypes := map[string]bool{
        "email": true, "slack": true, "webhook": true, 
        "dingtalk": true, "custom": true,
    }
    
    if !validTypes[action.Type] {
        return fmt.Errorf("告警动作类型无效: %s", action.Type)
    }
    
    // 验证配置
    switch action.Type {
    case "email":
        if _, ok := action.Config["to"]; !ok {
            return fmt.Errorf("邮件告警缺少收件人配置")
        }
    case "webhook":
        if _, ok := action.Config["url"]; !ok {
            return fmt.Errorf("Webhook告警缺少URL配置")
        }
    case "dingtalk":
        if _, ok := action.Config["webhook_url"]; !ok {
            return fmt.Errorf("钉钉告警缺少Webhook URL配置")
        }
    }
    
    return nil
}

// 创建或更新规则（API调用）
func (arm *AlertRuleManager) CreateOrUpdateRule(ctx context.Context, rule *AlertRule) error {
    log.Infof("创建/更新告警规则: %s", rule.Name)
    
    // 验证规则
    if err := arm.validateRules([]*AlertRule{rule}); err != nil {
        return fmt.Errorf("规则验证失败: %w", err)
    }
    
    // 设置版本号
    if rule.ID == "" {
        rule.ID = generateID()
        rule.Version = 1
        rule.CreatedAt = time.Now()
    } else {
        // 加载旧规则
        var oldRule AlertRule
        if err := arm.db.First(&oldRule, "id = ?", rule.ID).Error; err != nil {
            return fmt.Errorf("规则不存在: %s", rule.ID)
        }
        rule.Version = oldRule.Version + 1
    }
    rule.UpdatedAt = time.Now()
    
    // 保存到数据库
    if err := arm.db.Save(rule).Error; err != nil {
        return fmt.Errorf("保存规则失败: %w", err)
    }
    
    // 记录变更历史
    history := &AlertRuleHistory{
        RuleID:    rule.ID,
        Version:   rule.Version,
        Changes:   rule,
        ChangedBy: rule.CreatedBy,
        ChangedAt: time.Now(),
    }
    arm.db.Create(history)
    
    // 重新加载所有规则
    rules, err := arm.loadRulesFromDB()
    if err != nil {
        return fmt.Errorf("重新加载规则失败: %w", err)
    }
    
    // 同步到Redis
    if err := arm.syncRulesToRedis(rules); err != nil {
        return fmt.Errorf("同步到Redis失败: %w", err)
    }
    
    // 发布变更通知
    arm.redis.Publish(ctx, "config:module16:alert_rules:reload", rule.Version)
    
    log.Infof("告警规则已更新: %s, version=%d", rule.Name, rule.Version)
    return nil
}

// 删除规则
func (arm *AlertRuleManager) DeleteRule(ctx context.Context, ruleID string) error {
    log.Infof("删除告警规则: %s", ruleID)
    
    // 删除数据库记录
    if err := arm.db.Delete(&AlertRule{}, "id = ?", ruleID).Error; err != nil {
        return fmt.Errorf("删除规则失败: %w", err)
    }
    
    // 重新加载所有规则
    rules, err := arm.loadRulesFromDB()
    if err != nil {
        return fmt.Errorf("重新加载规则失败: %w", err)
    }
    
    // 同步到Redis
    if err := arm.syncRulesToRedis(rules); err != nil {
        return fmt.Errorf("同步到Redis失败: %w", err)
    }
    
    // 发布变更通知
    arm.redis.Publish(ctx, "config:module16:alert_rules:reload", time.Now().Unix())
    
    log.Infof("告警规则已删除: %s", ruleID)
    return nil
}

// 启用/禁用规则
func (arm *AlertRuleManager) ToggleRule(ctx context.Context, ruleID string, enabled bool) error {
    log.Infof("切换告警规则状态: %s, enabled=%v", ruleID, enabled)
    
    // 更新数据库
    if err := arm.db.Model(&AlertRule{}).Where("id = ?", ruleID).Update("enabled", enabled).Error; err != nil {
        return fmt.Errorf("更新规则状态失败: %w", err)
    }
    
    // 重新加载所有规则
    rules, err := arm.loadRulesFromDB()
    if err != nil {
        return fmt.Errorf("重新加载规则失败: %w", err)
    }
    
    // 同步到Redis
    if err := arm.syncRulesToRedis(rules); err != nil {
        return fmt.Errorf("同步到Redis失败: %w", err)
    }
    
    // 发布变更通知
    arm.redis.Publish(ctx, "config:module16:alert_rules:reload", time.Now().Unix())
    
    log.Infof("告警规则状态已更新: %s, enabled=%v", ruleID, enabled)
    return nil
}

// 获取所有规则
func (arm *AlertRuleManager) GetRules() []*AlertRule {
    rules := arm.rules.Load()
    if rules == nil {
        return []*AlertRule{}
    }
    return rules.([]*AlertRule)
}

// 获取单个规则
func (arm *AlertRuleManager) GetRule(ruleID string) (*AlertRule, error) {
    var rule AlertRule
    if err := arm.db.First(&rule, "id = ?", ruleID).Error; err != nil {
        return nil, err
    }
    return &rule, nil
}

// 发送告警
func (arm *AlertRuleManager) sendAlert(title, message string) {
    // 实现告警发送逻辑
    log.Warnf("告警: %s - %s", title, message)
}
```

**自定义告警规则API**:

```bash
# 1. 获取所有告警规则
curl "http://api/v1/alert-rules?category=correlation&enabled=true" \
  -H "Authorization: Bearer $TOKEN"

# 2. 获取单个告警规则
curl "http://api/v1/alert-rules/HighRiskCorrelationDetected" \
  -H "Authorization: Bearer $TOKEN"

# 3. 创建自定义告警规则（热更新）
curl -X POST "http://api/v1/alert-rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CustomSemanticAnalysisSlow",
    "category": "semantic",
    "expression": "semantic_analysis_duration_seconds > 2",
    "duration": "10m",
    "severity": "warning",
    "description": "自定义语义分析慢告警",
    "labels": {
      "team": "data-team",
      "env": "production"
    },
    "annotations": {
      "summary": "语义分析耗时超过2秒",
      "description": "语义分析性能下降，需要优化"
    },
    "actions": [
      {
        "type": "email",
        "config": {
          "to": "team@example.com",
          "subject": "语义分析性能告警"
        }
      },
      {
        "type": "dingtalk",
        "config": {
          "webhook_url": "https://oapi.dingtalk.com/robot/send?access_token=xxx",
          "at_mobiles": ["13800138000"]
        }
      }
    ],
    "enabled": true
  }'

# 4. 更新告警规则（热更新）
curl -X PUT "http://api/v1/alert-rules/CustomSemanticAnalysisSlow" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expression": "semantic_analysis_duration_seconds > 3",
    "duration": "5m"
  }'

# 5. 启用/禁用告警规则（热更新）
curl -X PATCH "http://api/v1/alert-rules/CustomSemanticAnalysisSlow/toggle" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": false}'

# 6. 删除自定义告警规则（热更新）
curl -X DELETE "http://api/v1/alert-rules/CustomSemanticAnalysisSlow" \
  -H "Authorization: Bearer $TOKEN"

# 7. 测试告警规则（不实际触发告警）
curl -X POST "http://api/v1/alert-rules/CustomSemanticAnalysisSlow/test" \
  -H "Authorization: Bearer $TOKEN"

# 8. 获取告警规则历史版本
curl "http://api/v1/alert-rules/CustomSemanticAnalysisSlow/history" \
  -H "Authorization: Bearer $TOKEN"

# 9. 回滚到历史版本
curl -X POST "http://api/v1/alert-rules/CustomSemanticAnalysisSlow/rollback" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"version": 3}'
```

**YAML配置文件（备选方式）**:

```yaml
# configs/alert_rules.yaml
rules:
  # 事件关联告警
  - id: "rule-flink-job-down"
    name: "FlinkJobDown"
    category: "correlation"
    expression: "flink_jobmanager_job_uptime == 0"
    duration: "1m"
    severity: "critical"
    description: "Flink作业停止"
    labels:
      component: "flink"
    annotations:
      summary: "Flink作业停止"
      description: "Flink作业已停止运行，需要立即检查"
    actions:
      - type: "email"
        config:
          to: "ops@example.com"
      - type: "slack"
        config:
          channel: "#alerts"
    enabled: true
    
  # 语义分析告警
  - id: "rule-semantic-timeout"
    name: "SemanticAnalysisTimeout"
    category: "semantic"
    expression: "semantic_analysis_duration_seconds > 1"
    duration: "5m"
    severity: "warning"
    description: "语义分析超时"
    labels:
      component: "semantic"
    annotations:
      summary: "语义分析超时"
      description: "语义分析耗时超过1秒，可能影响性能"
    actions:
      - type: "webhook"
        config:
          url: "https://hooks.example.com/alert"
    enabled: true
```

### 10.3 日志规范

**日志级别**:
- FATAL: 系统崩溃级别错误
- ERROR: 功能错误，需要人工介入
- WARN: 警告信息，可能影响功能
- INFO: 重要业务信息
- DEBUG: 调试信息（生产环境关闭）

**日志格式**:

```json
{
  "timestamp": "2026-02-01T10:30:00.123Z",
  "level": "INFO",
  "logger": "correlation.engine",
  "message": "关联事件已保存",
  "correlation_id": "corr-123456",
  "risk_score": 85.5,
  "event_count": 5,
  "trace_id": "trace-abc123",
  "span_id": "span-def456"
}
```

### 10.4 运维手册

**常见问题处理**:

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| Flink作业失败 | Checkpoint超时 | 增加Checkpoint超时时间，检查状态后端 |
| Neo4j查询慢 | 缺少索引 | 创建索引，优化查询语句 |
| NLP分析超时 | 模型加载慢 | 预加载模型，增加超时时间 |
| 向量搜索慢 | 索引未优化 | 重建索引，使用GPU加速 |
| 配置更新不生效 | Redis连接失败 | 检查Redis连接，重启服务 |
| 内存溢出 | 数据量过大 | 增加内存限制，优化批处理大小 |

**备份恢复**:

1. **PostgreSQL备份**: 每天全量备份，每小时增量备份
2. **Neo4j备份**: 每天全量备份，保留7天
3. **配置备份**: 每次变更自动备份到Git
4. **证据备份**: 实时同步到对象存储，永久保留

**扩容方案**:

1. **水平扩容**: 增加Pod副本数
2. **垂直扩容**: 增加CPU/内存资源
3. **存储扩容**: 扩展PVC容量
4. **数据库扩容**: 增加Neo4j集群节点

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

**事件关联配置** (8项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| correlation_enabled | bool | true | 是否启用事件关联 |
| time_windows | array | [{"name":"1m","duration":"1m"}] | 时间窗口配置列表 |
| entity_types | array | ["user","ip","session"] | 实体类型列表 |
| ml_enabled | bool | false | 是否启用机器学习关联 |
| risk_threshold | float | 80.0 | 风险阈值（0-100） |
| max_events_per_correlation | int | 100 | 单个关联事件最大事件数 |
| retention_days | int | 90 | 关联结果保留天数 |
| alert_enabled | bool | true | 是否启用高风险告警 |

**语义分析配置** (8项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| semantic_enabled | bool | true | 是否启用语义分析 |
| nlp_enabled | bool | true | 是否启用NLP处理 |
| languages | array | ["en","zh","ja"] | 支持的语言列表 |
| entity_types | array | ["person","ip","url","email","file"] | 实体类型列表 |
| sentiment_enabled | bool | true | 是否启用情感分析 |
| knowledge_graph_enabled | bool | true | 是否启用知识图谱 |
| similarity_threshold | float | 0.7 | 相似度阈值（0-1） |
| max_entities_per_log | int | 50 | 每条日志最大实体数 |

**数据血缘配置** (6项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| lineage_enabled | bool | true | 是否启用血缘追踪 |
| track_processors | bool | true | 是否追踪处理步骤 |
| track_transformations | bool | true | 是否追踪数据转换 |
| version_retention | int | 10 | 保留的血缘版本数 |
| impact_analysis_enabled | bool | true | 是否启用影响分析 |
| export_formats | array | ["json","csv","graphml"] | 支持的导出格式 |

**审计取证配置** (8项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| forensics_enabled | bool | false | 是否启用取证功能 |
| preservation_enabled | bool | true | 是否启用数据保全 |
| signature_algorithm | string | "RSA" | 签名算法（RSA/ECDSA） |
| timestamp_authority | string | "" | 时间戳认证机构URL |
| export_formats | array | ["json","pdf","csv"] | 支持的导出格式 |
| retention_days | int | 365 | 取证数据保留天数 |
| case_management_enabled | bool | true | 是否启用案件管理 |
| auto_verification | bool | true | 是否自动验证证据完整性 |

**健康评分配置** (7项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| health_enabled | bool | true | 是否启用健康评分 |
| update_interval | int | 60 | 评分更新间隔（秒） |
| availability_weight | float | 0.30 | 可用性权重 |
| performance_weight | float | 0.25 | 性能权重 |
| stability_weight | float | 0.25 | 稳定性权重 |
| security_weight | float | 0.20 | 安全性权重 |
| alert_threshold | float | 60.0 | 告警阈值 |

**采样控制配置** (6项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| sampling_enabled | bool | true | 是否启用采样 |
| default_sampling_rate | float | 1.0 | 默认采样率（0-1） |
| adaptive_sampling | bool | true | 是否启用自适应采样 |
| importance_based | bool | true | 是否基于重要性采样 |
| min_sampling_rate | float | 0.01 | 最小采样率 |
| max_sampling_rate | float | 1.0 | 最大采样率 |

**模板管理配置** (5项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| template_enabled | bool | true | 是否启用模板管理 |
| auto_extraction | bool | true | 是否自动提取模板 |
| similarity_threshold | float | 0.8 | 模板相似度阈值 |
| max_templates | int | 10000 | 最大模板数量 |
| template_ttl | int | 30 | 模板过期时间（天） |

**质量评估配置** (6项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| quality_enabled | bool | true | 是否启用质量评估 |
| completeness_check | bool | true | 是否检查完整性 |
| accuracy_check | bool | true | 是否检查准确性 |
| consistency_check | bool | true | 是否检查一致性 |
| quality_threshold | float | 70.0 | 质量阈值 |
| report_interval | int | 3600 | 报告生成间隔（秒） |

**智能路由配置** (7项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| routing_enabled | bool | true | 是否启用智能路由 |
| load_balance_method | string | "round_robin" | 负载均衡方法 |
| health_check_enabled | bool | true | 是否启用健康检查 |
| health_check_interval | int | 30 | 健康检查间隔（秒） |
| failover_enabled | bool | true | 是否启用故障转移 |
| max_retries | int | 3 | 最大重试次数 |
| retry_backoff | int | 1000 | 重试退避时间（毫秒） |

**压缩策略配置** (6项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| compression_enabled | bool | true | 是否启用压缩 |
| default_algorithm | string | "lz4" | 默认压缩算法 |
| compression_level | int | 3 | 压缩级别（1-9） |
| auto_selection | bool | true | 是否自动选择算法 |
| min_size_threshold | int | 1024 | 最小压缩阈值（字节） |
| compression_ratio_target | float | 3.0 | 目标压缩比 |

**成本优化配置** (7项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| cost_optimization_enabled | bool | true | 是否启用成本优化 |
| auto_optimization | bool | false | 是否自动执行优化 |
| optimization_threshold | float | 1000.0 | 优化阈值（节省金额） |
| analysis_interval | int | 3600 | 分析间隔（秒） |
| forecast_months | int | 3 | 预测月数 |
| approval_required | bool | true | 是否需要审批 |
| notification_enabled | bool | true | 是否启用通知 |

**智能推荐配置** (6项):

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| recommendation_enabled | bool | true | 是否启用智能推荐 |
| personalized | bool | true | 是否个性化推荐 |
| max_recommendations | int | 10 | 最大推荐数量 |
| min_confidence | float | 0.6 | 最小置信度 |
| update_interval | int | 3600 | 更新间隔（秒） |
| feedback_enabled | bool | true | 是否启用反馈 |

**告警规则配置** (8项) - 新增:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| alert_rules_enabled | bool | true | 是否启用告警规则 |
| alert_evaluation_interval | int | 30 | 告警评估间隔（秒） |
| alert_notification_enabled | bool | true | 是否启用告警通知 |
| alert_notification_channels | array | ["email","slack"] | 告警通知渠道 |
| alert_aggregation_enabled | bool | true | 是否启用告警聚合 |
| alert_aggregation_window | int | 300 | 告警聚合窗口（秒） |
| alert_silence_enabled | bool | true | 是否支持告警静默 |
| alert_auto_resolve | bool | true | 是否自动解决告警 |

**总计**: 69个可热更新配置项（12个配置组）

### 11.2 热更新实现

**配置管理器**:

```go
// internal/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "github.com/go-redis/redis/v8"
    "gorm.io/gorm"
)

// 配置管理器
type ConfigManager struct {
    db          *gorm.DB
    redis       *redis.Client
    configs     map[string]*atomic.Value // 各模块配置
    subscribers map[string]chan struct{} // 订阅通知
}

// 创建配置管理器
func NewConfigManager(db *gorm.DB, redis *redis.Client) *ConfigManager {
    cm := &ConfigManager{
        db:          db,
        redis:       redis,
        configs:     make(map[string]*atomic.Value),
        subscribers: make(map[string]chan struct{}),
    }
    
    // 初始化各模块配置
    cm.initModuleConfigs()
    
    // 启动配置订阅
    go cm.subscribeConfigChanges()
    
    return cm
}

// 初始化模块配置
func (cm *ConfigManager) initModuleConfigs() {
    modules := []string{
        "correlation", "semantic", "lineage", "forensics",
        "health", "sampling", "template", "quality",
        "routing", "compression", "cost", "recommendation",
    }
    
    for _, module := range modules {
        cm.configs[module] = &atomic.Value{}
        
        // 从数据库加载配置
        config, err := cm.loadConfigFromDB(module)
        if err != nil {
            log.Errorf("加载%s配置失败: %v", module, err)
            continue
        }
        
        // 存储到atomic.Value
        cm.configs[module].Store(config)
        
        // 同步到Redis
        cm.syncConfigToRedis(module, config)
    }
}

// 订阅配置变更
func (cm *ConfigManager) subscribeConfigChanges() {
    pubsub := cm.redis.Subscribe(context.Background(), "config:module16:*")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        // 解析模块名称
        module := cm.parseModuleName(msg.Channel)
        
        log.Infof("收到配置变更通知: module=%s", module)
        
        // 从Redis加载新配置
        newConfig, err := cm.loadConfigFromRedis(module)
        if err != nil {
            log.Errorf("从Redis加载配置失败: %v", err)
            continue
        }
        
        // 验证配置
        if err := cm.validateConfig(module, newConfig); err != nil {
            log.Errorf("配置验证失败: %v", err)
            // 发送告警
            cm.sendAlert(module, err)
            continue
        }
        
        // 原子更新配置
        cm.configs[module].Store(newConfig)
        
        // 通知订阅者
        if ch, ok := cm.subscribers[module]; ok {
            select {
            case ch <- struct{}{}:
            default:
            }
        }
        
        // 记录审计日志
        cm.logConfigChange(module, newConfig)
        
        log.Infof("配置已更新: module=%s", module)
    }
}

// 更新配置
func (cm *ConfigManager) UpdateConfig(ctx context.Context, module string, config interface{}) error {
    log.Infof("更新配置: module=%s", module)
    
    // 1. 验证配置
    if err := cm.validateConfig(module, config); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 2. 保存到数据库（版本化）
    if err := cm.saveConfigToDB(ctx, module, config); err != nil {
        return fmt.Errorf("保存配置到数据库失败: %w", err)
    }
    
    // 3. 同步到Redis
    if err := cm.syncConfigToRedis(module, config); err != nil {
        return fmt.Errorf("同步配置到Redis失败: %w", err)
    }
    
    // 4. 发布Pub/Sub通知
    channel := fmt.Sprintf("config:module16:%s:reload", module)
    if err := cm.redis.Publish(ctx, channel, "reload").Err(); err != nil {
        return fmt.Errorf("发布配置变更通知失败: %w", err)
    }
    
    log.Infof("配置更新成功: module=%s", module)
    return nil
}

// 获取配置
func (cm *ConfigManager) GetConfig(module string) interface{} {
    if config, ok := cm.configs[module]; ok {
        return config.Load()
    }
    return nil
}

// 订阅配置变更
func (cm *ConfigManager) Subscribe(module string) <-chan struct{} {
    if _, ok := cm.subscribers[module]; !ok {
        cm.subscribers[module] = make(chan struct{}, 1)
    }
    return cm.subscribers[module]
}

// 验证配置
func (cm *ConfigManager) validateConfig(module string, config interface{}) error {
    switch module {
    case "correlation":
        return cm.validateCorrelationConfig(config)
    case "semantic":
        return cm.validateSemanticConfig(config)
    case "health":
        return cm.validateHealthConfig(config)
    // ... 其他模块验证
    default:
        return nil
    }
}

// 验证关联配置
func (cm *ConfigManager) validateCorrelationConfig(config interface{}) error {
    cfg, ok := config.(*CorrelationConfig)
    if !ok {
        return fmt.Errorf("配置类型错误")
    }
    
    // 验证风险阈值
    if cfg.RiskThreshold < 0 || cfg.RiskThreshold > 100 {
        return fmt.Errorf("风险阈值必须在0-100之间")
    }
    
    // 验证保留天数
    if cfg.RetentionDays < 1 || cfg.RetentionDays > 365 {
        return fmt.Errorf("保留天数必须在1-365之间")
    }
    
    // 验证时间窗口
    for _, window := range cfg.TimeWindows {
        if window.Duration < time.Second || window.Duration > 24*time.Hour {
            return fmt.Errorf("时间窗口必须在1秒-24小时之间")
        }
    }
    
    return nil
}

// 验证健康配置
func (cm *ConfigManager) validateHealthConfig(config interface{}) error {
    cfg, ok := config.(*HealthConfig)
    if !ok {
        return fmt.Errorf("配置类型错误")
    }
    
    // 验证权重总和为1
    total := cfg.AvailabilityWeight + cfg.PerformanceWeight + 
             cfg.StabilityWeight + cfg.SecurityWeight
    if total != 1.0 {
        return fmt.Errorf("权重总和必须为1.0，当前为%.2f", total)
    }
    
    // 验证更新间隔
    if cfg.UpdateInterval < 10 || cfg.UpdateInterval > 3600 {
        return fmt.Errorf("更新间隔必须在10-3600秒之间")
    }
    
    return nil
}
```

### 11.3 热更新验收标准

**功能验收**:

1. THE System SHALL 在配置变更后5秒内应用新配置到所有实例
2. WHEN 配置验证失败时，THE System SHALL 保持原配置不变并记录错误日志
3. THE System SHALL 支持通过API查询当前生效的配置
4. THE System SHALL 记录所有配置变更的审计日志，包含变更前后值、操作人、时间
5. WHEN 配置回滚时，THE System SHALL 能够恢复到任意历史版本

**告警规则热更新验收** - 新增:

1. THE System SHALL 支持通过API创建、编辑、删除告警规则
2. WHEN 告警规则变更时，THE System SHALL 通过Redis Pub/Sub立即通知所有实例
3. THE System SHALL 在告警规则更新后5秒内同步到Prometheus并生效
4. THE System SHALL 支持启用/禁用告警规则，变更立即生效
5. THE System SHALL 验证告警规则的合理性（表达式、持续时间、严重级别等）
6. WHEN 告警规则验证失败时，THE System SHALL 拒绝更新并返回错误信息
7. THE System SHALL 记录所有告警规则变更的审计日志（包含版本历史）
8. THE System SHALL 支持自定义告警动作（邮件/Slack/Webhook/钉钉/自定义）
9. THE System SHALL 支持自定义告警级别（critical/warning/info）
10. WHEN Redis不可用时，THE System SHALL 从PostgreSQL加载告警规则
11. WHEN PostgreSQL不可用时，THE System SHALL 从YAML文件加载默认告警规则
12. THE System SHALL 支持告警规则的测试功能，不实际触发告警
13. THE System SHALL 支持告警规则的版本回滚
14. THE System SHALL 支持按分类（category）筛选和管理告警规则
15. THE System SHALL 记录告警触发历史，包含触发时间、持续时间、解决时间

**性能验收**:

1. 配置更新延迟 < 5秒 (P95)
2. 配置读取延迟 < 1ms (使用atomic.Value)
3. 支持1000+ QPS的配置查询
4. Redis Pub/Sub传播延迟 < 100ms
5. 告警规则推送延迟 < 100ms
6. 告警规则评估时间 < 50ms（单个规则）
7. Prometheus规则同步时间 < 2秒

**可靠性验收**:

1. 配置更新成功率 > 99.9%
2. 配置验证准确率 100%
3. 支持配置回滚，回滚成功率 100%
4. 配置丢失自动恢复
5. 告警规则更新成功率 > 99.9%
6. 告警规则更新失败时保持原规则
7. 告警规则支持版本管理和回滚
8. 数据库故障时从YAML文件加载默认配置
9. 告警规则验证失败时发送通知
10. 支持告警规则的灰度发布（按分类逐步启用）

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Flink作业失败导致关联分析中断 | 中 | 高 | Checkpoint机制、自动重启、降级到批处理 |
| Neo4j性能瓶颈影响查询速度 | 中 | 中 | 索引优化、查询优化、集群扩容 |
| NLP模型推理超时 | 中 | 中 | 超时保护、异步处理、降级到规则匹配 |
| 向量索引损坏导致搜索失败 | 低 | 高 | 定期备份、自动重建、降级到关键词搜索 |
| 证据签名失败影响取证 | 低 | 高 | 重试机制、备用签名服务、离线签名 |
| 配置错误导致功能异常 | 中 | 中 | 配置验证、灰度发布、快速回滚 |
| 存储空间不足 | 中 | 高 | 监控告警、自动清理、弹性扩容 |
| 依赖服务不可用 | 中 | 高 | 熔断降级、重试机制、本地缓存 |

### 12.2 回滚方案

**配置回滚**:

```bash
# 1. 查询配置历史
curl -X GET "http://api/v1/config/history?module=correlation&limit=10"

# 2. 回滚到指定版本
curl -X POST "http://api/v1/config/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "module": "correlation",
    "version": 5
  }'

# 3. 验证回滚结果
curl -X GET "http://api/v1/config/current?module=correlation"
```

**服务回滚**:

```bash
# Kubernetes滚动回滚
kubectl rollout undo deployment/correlation-engine -n log-advanced

# 查看回滚状态
kubectl rollout status deployment/correlation-engine -n log-advanced

# 回滚到指定版本
kubectl rollout undo deployment/correlation-engine --to-revision=3 -n log-advanced
```

**数据回滚**:

```bash
# 1. 停止写入
kubectl scale deployment/api-server --replicas=0 -n log-advanced

# 2. 恢复数据库备份
pg_restore -d logdb backup_20260201.dump

# 3. 恢复Neo4j备份
neo4j-admin restore --from=/backup/neo4j-20260201

# 4. 恢复服务
kubectl scale deployment/api-server --replicas=5 -n log-advanced
```

### 12.3 应急预案

**Flink作业失败**:

1. 检查Checkpoint状态
2. 查看TaskManager日志
3. 从最近的Checkpoint恢复
4. 如果无法恢复，降级到批处理模式
5. 通知相关人员

**Neo4j集群故障**:

1. 检查集群状态
2. 识别故障节点
3. 隔离故障节点
4. 从备份恢复数据
5. 重新加入集群
6. 验证数据一致性

**存储空间不足**:

1. 触发紧急清理
2. 删除过期数据
3. 压缩历史数据
4. 迁移冷数据到对象存储
5. 申请存储扩容

**依赖服务不可用**:

1. 触发熔断机制
2. 启用本地缓存
3. 降级到基础功能
4. 通知用户服务受限
5. 监控服务恢复

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| 事件关联 | 自动识别和关联相关日志事件的过程 |
| 语义分析 | 使用NLP技术理解日志消息含义的过程 |
| 数据血缘 | 追踪数据从源头到目标的完整流转路径 |
| 审计取证 | 为安全调查和法律诉讼保全和分析证据的过程 |
| 健康评分 | 综合评估系统健康状态的量化指标 |
| 智能采样 | 根据日志重要性动态调整采样率的技术 |
| 日志模板 | 从日志中提取的通用模式，用于日志分类和压缩 |
| 质量评估 | 评估日志数据完整性、准确性、一致性的过程 |
| 智能路由 | 根据日志内容和优先级智能选择目标的技术 |
| 向量化 | 将文本转换为数值向量的过程，用于语义搜索 |
| 知识图谱 | 使用图结构存储实体和关系的知识库 |
| 时间窗口 | Flink流处理中用于聚合事件的时间范围 |
| Checkpoint | Flink作业的状态快照，用于故障恢复 |
| 热更新 | 在不重启服务的情况下更新配置的技术 |

### 13.2 参考文档

**技术文档**:
- [Apache Flink官方文档](https://flink.apache.org/docs/)
- [Neo4j开发者指南](https://neo4j.com/developer/)
- [Apache Atlas用户指南](https://atlas.apache.org/)
- [spaCy文档](https://spacy.io/usage)
- [BERT论文](https://arxiv.org/abs/1810.04805)
- [Faiss Wiki](https://github.com/facebookresearch/faiss/wiki)

**标准规范**:
- ISO/IEC 27037:2012 - 数字证据识别、收集、获取和保存指南
- ISO/IEC 27043:2015 - 事件调查原则和过程
- RFC 3161 - 时间戳协议（TSP）
- RFC 5280 - X.509公钥基础设施证书和CRL配置文件

**相关项目**:
- [Elastic Common Schema](https://www.elastic.co/guide/en/ecs/current/index.html)
- [OpenTelemetry](https://opentelemetry.io/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-02-01 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-02-01 | v1.0 | 补充15个子需求的详细设计 | 系统架构团队 |
| 2026-02-01 | v1.0 | 完善配置热更新机制 | 系统架构团队 |
| 2026-02-01 | v1.0 | 添加100+个API接口设计 | 系统架构团队 |
| 2026-02-01 | v1.0 | 完善数据模型和数据库设计 | 系统架构团队 |
| 2026-02-01 | v1.0 | 补充监控告警和运维方案 | 系统架构团队 |
