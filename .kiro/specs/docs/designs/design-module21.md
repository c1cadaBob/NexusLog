# 模块21：NLP自然语言处理 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module21.md](../requirements/requirements-module21.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP + Phase 2 + Phase 3

### 1.3 相关文档
- [需求文档](../requirements/requirements-module21.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)
- [模块11设计文档](./design-module11.md) - 智能日志分析

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            NLP自然语言处理整体架构                                           │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            用户输入层                                                   │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Web界面输入  │    │ API接口输入  │    │ 语音输入     │                           │ │
│  │  │ 自然语言查询  │    │ 自然语言查询  │    │ (Phase 3)    │                           │ │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                           │ │
│  │         └────────────────────┴────────────────────┘                                  │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            预处理层                                                    │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 文本清洗     │───▶│ 分词处理     │───▶│ 语言检测     │                           │ │
│  │  │ 去除特殊字符  │    │ 中英文分词   │    │ 中文/英文    │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            意图识别层（Intent Recognition）                            │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  MVP阶段：规则引擎 + 关键词匹配                                                │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 时间解析  │  │ 级别识别  │  │ 服务识别  │  │ 操作识别  │                      │   │ │
│  │  │  │ 昨天/今天 │  │ 错误/警告 │  │ 支付/订单 │  │ 查找/统计 │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  Phase 2阶段：LLM API（OpenAI/Claude）                                         │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ Prompt   │─▶│ LLM调用  │─▶│ 结果解析  │─▶│ 意图提取  │                      │   │ │
│  │  │  │ 构建     │  │ API请求  │  │ JSON解析 │  │ 结构化   │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  Phase 3阶段：本地微调模型                                                     │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 模型加载  │─▶│ 本地推理  │─▶│ 意图分类  │─▶│ 实体提取  │                      │   │ │
│  │  │  │ ONNX模型 │  │ 低延迟   │  │ 多标签   │  │ NER      │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            实体提取层（Entity Extraction）                             │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 时间实体     │    │ 服务实体     │    │ 指标实体     │                           │ │
│  │  │ 昨天下午3点  │    │ payment-svc  │    │ error_rate   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 日志级别     │    │ 用户实体     │    │ IP地址       │                           │ │
│  │  │ ERROR/WARN   │    │ user_id      │    │ 192.168.1.1  │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            查询生成层（Query Generation）                              │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  Elasticsearch查询生成                                                         │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 时间范围  │  │ 过滤条件  │  │ 聚合查询  │  │ 排序规则  │                      │   │ │
│  │  │  │ range    │  │ term/match│  │ aggs     │  │ sort     │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  SQL查询生成（PostgreSQL）                                                     │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ SELECT   │  │ WHERE    │  │ GROUP BY │  │ ORDER BY │                      │   │ │
│  │  │  │ 字段选择  │  │ 条件过滤  │  │ 分组聚合  │  │ 排序     │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  └─────────────────────────────────────────┬───────────────────────────────────────────┘ │
│                                            │                                             │
│                                            ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            查询执行层                                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ ES查询执行   │    │ SQL查询执行  │    │ 缓存查询     │                           │ │
│  │  │ 日志搜索     │    │ 元数据查询   │    │ Redis缓存    │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            结果处理层                                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 结果聚合     │───▶│ 结果排序     │───▶│ 结果格式化    │                           │ │
│  │  │ 多源合并     │    │ 相关性排序   │    │ JSON/表格    │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            智能增强层（Phase 2/3）                                     │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  智能告警描述生成                                                              │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 告警上下文│─▶│ LLM生成  │─▶│ 根因分析  │─▶│ 处理建议  │                      │   │ │
│  │  │  │ 收集     │  │ 描述生成  │  │ 推理     │  │ 推荐     │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  查询建议与自动补全                                                            │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 历史查询  │─▶│ 相似查询  │─▶│ 智能推荐  │─▶│ 自动补全  │                      │   │ │
│  │  │  │ 分析     │  │ 匹配     │  │ 排序     │  │ 提示     │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  多轮对话支持                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │   │ │
│  │  │  │ 上下文   │─▶│ 意图继承  │─▶│ 实体补全  │─▶│ 查询细化  │                      │   │ │
│  │  │  │ 管理     │  │ 追问理解  │  │ 引用解析  │  │ 迭代优化  │                      │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                      │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            学习与优化层                                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 查询历史记录  │───▶│ 用户反馈收集  │───▶│ 模型优化     │                           │ │
│  │  │ 日志存储     │    │ 点击/修改    │    │ 持续学习     │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 预处理层 | 文本清洗和标准化 | 文本清洗、分词处理、语言检测 |
| 意图识别层 | 理解用户查询意图 | 规则引擎、LLM调用、本地模型推理、意图分类 |
| 实体提取层 | 提取查询中的关键实体 | 时间实体、服务实体、指标实体、日志级别、用户实体、IP地址 |
| 查询生成层 | 将自然语言转换为结构化查询 | ES查询生成、SQL查询生成、查询优化 |
| 查询执行层 | 执行生成的查询 | ES查询执行、SQL查询执行、缓存查询 |
| 结果处理层 | 处理和格式化查询结果 | 结果聚合、结果排序、结果格式化 |
| 智能增强层 | 提供智能化功能 | 智能告警描述、查询建议、多轮对话、自动补全 |
| 学习与优化层 | 持续学习和优化 | 查询历史记录、用户反馈收集、模型优化 |

### 2.3 关键路径

**自然语言查询流程**:
```
用户输入 → 预处理 → 意图识别 → 实体提取 → 查询生成 → 查询执行 
  → 结果处理 → 结果返回（< 2秒）
```

**智能告警描述流程**:
```
告警触发 → 上下文收集 → LLM生成描述 → 根因分析 → 处理建议 
  → 告警推送（< 5秒）
```

**多轮对话流程**:
```
用户追问 → 上下文加载 → 意图继承 → 实体补全 → 查询细化 
  → 结果返回（< 2秒）
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Go | 1.21+ | 高性能、低延迟、并发友好 |
| Python | 3.11+ | 丰富的NLP库生态、LLM集成方便 |
| jieba | 0.42+ | 中文分词首选库、准确率高 |
| spaCy | 3.7+ | 英文NLP处理、实体识别 |
| OpenAI API | latest | GPT-4强大的语言理解能力 |
| Anthropic Claude API | latest | Claude 3.5高质量推理能力 |
| Redis | 7+ | 查询缓存、会话管理、热数据存储 |
| PostgreSQL | 15+ | 查询历史存储、用户反馈存储 |
| Elasticsearch | 8+ | 日志查询执行、全文搜索 |
| ONNX Runtime | 1.16+ | 本地模型推理（Phase 3） |
| Transformers | 4.35+ | 预训练模型加载和微调 |

### 3.2 NLP框架对比

| 框架 | 优点 | 缺点 | 适用场景 | 选择 |
|------|------|------|----------|------|
| 规则引擎 | 简单快速、可控性强、无需训练 | 覆盖面有限、维护成本高 | MVP阶段 | ✅ MVP |
| LLM API | 理解能力强、覆盖面广、快速上线 | 成本高、延迟较高、依赖外部服务 | Phase 2 | ✅ Phase 2 |
| 本地微调模型 | 低延迟、低成本、数据隐私 | 需要训练数据、维护成本高 | Phase 3 | ✅ Phase 3 |
| BERT | 理解能力好 | 推理慢、资源占用大 | 不适合实时场景 | ❌ |

**选择**: 分阶段实施，MVP使用规则引擎，Phase 2引入LLM API，Phase 3部署本地模型

### 3.3 LLM提供商对比

| 提供商 | 优点 | 缺点 | 成本 | 选择 |
|--------|------|------|------|------|
| OpenAI GPT-4 | 能力最强、生态完善 | 价格较高、国内访问受限 | $0.03/1K tokens | ✅ 支持 |
| Anthropic Claude | 推理能力强、安全性好 | 价格较高 | $0.025/1K tokens | ✅ 支持 |
| 本地开源模型 | 成本低、数据隐私 | 能力较弱、需要GPU | 硬件成本 | ✅ Phase 3 |
| 国内大模型 | 国内访问稳定 | 能力参差不齐 | 按需选择 | ✅ 可选 |

**选择**: 支持多个LLM提供商，可配置切换

### 3.4 时间解析库对比

| 库 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| dateparser (Python) | 支持多语言、格式丰富 | 性能一般 | ✅ 采用 |
| 自研规则引擎 | 性能好、可定制 | 开发成本高 | ✅ MVP阶段 |
| LLM解析 | 理解能力强 | 延迟高、成本高 | ✅ Phase 2补充 |

**选择**: MVP使用自研规则引擎，Phase 2结合LLM增强

---

## 4. 关键流程设计

### 4.1 自然语言查询流程（MVP阶段）

```
┌─────────────────────────────────────────────────────────────────┐
│                      规则引擎查询流程                            │
└─────────────────────────────────────────────────────────────────┘

1. 用户输入
   ├─ 输入: "查找昨天下午3点到5点之间的所有错误日志"
   └─ 语言: 中文

2. 文本预处理
   ├─ 文本清洗: 去除多余空格、标点符号
   ├─ 分词: ["查找", "昨天", "下午", "3点", "到", "5点", "之间", "的", "所有", "错误", "日志"]
   └─ 语言检测: 中文

3. 意图识别（规则匹配）
   ├─ 操作识别: "查找" → search
   ├─ 时间识别: "昨天下午3点到5点" → 时间范围
   ├─ 级别识别: "错误" → level:ERROR
   └─ 意图: 搜索错误日志

4. 实体提取
   ├─ 时间实体提取
   │  ├─ 模式匹配: "昨天下午3点到5点"
   │  ├─ 解析: 昨天 = 2026-01-30
   │  ├─ 解析: 下午3点 = 15:00
   │  ├─ 解析: 下午5点 = 17:00
   │  └─ 结果: start=2026-01-30T15:00:00Z, end=2026-01-30T17:00:00Z
   │
   ├─ 日志级别提取
   │  ├─ 关键词匹配: "错误" → ERROR
   │  └─ 结果: level=ERROR
   │
   └─ 其他实体: 无

5. 查询生成（Elasticsearch DSL）
   ├─ 构建查询条件
   │  {
   │    "query": {
   │      "bool": {
   │        "must": [
   │          {
   │            "term": {
   │              "level": "ERROR"
   │            }
   │          },
   │          {
   │            "range": {
   │              "@timestamp": {
   │                "gte": "2026-01-30T15:00:00Z",
   │                "lte": "2026-01-30T17:00:00Z"
   │              }
   │            }
   │          }
   │        ]
   │      }
   │    },
   │    "sort": [
   │      {
   │        "@timestamp": "desc"
   │      }
   │    ],
   │    "size": 100
   │  }
   │
   └─ 查询优化: 添加索引提示、限制返回字段

6. 查询执行
   ├─ 检查缓存: Redis查询缓存（key=query_hash）
   ├─ 缓存未命中 → 执行ES查询
   ├─ 查询延迟: < 500ms
   └─ 结果缓存: 缓存5分钟

7. 结果处理
   ├─ 结果聚合: 按时间分组统计
   ├─ 结果排序: 按时间倒序
   ├─ 结果格式化: JSON格式
   └─ 返回给用户

8. 查询历史记录
   ├─ 记录查询语句
   ├─ 记录查询结果数量
   ├─ 记录查询延迟
   └─ 存储到PostgreSQL
```

### 4.2 自然语言查询流程（Phase 2阶段）

```
┌─────────────────────────────────────────────────────────────────┐
│                      LLM增强查询流程                             │
└─────────────────────────────────────────────────────────────────┘

1. 用户输入
   ├─ 输入: "支付服务最近有什么异常吗？"
   └─ 语言: 中文

2. 文本预处理
   ├─ 文本清洗
   ├─ 分词
   └─ 语言检测

3. LLM意图识别
   ├─ 构建Prompt
   │  ```
   │  你是一个日志查询助手。请将以下自然语言查询转换为结构化的查询意图。
   │  
   │  用户查询: "支付服务最近有什么异常吗？"
   │  
   │  请返回JSON格式的查询意图，包含以下字段：
   │  - intent: 查询意图（search/stats/trend/compare）
   │  - time_range: 时间范围（相对时间或绝对时间）
   │  - service: 服务名称
   │  - level: 日志级别（可选）
   │  - keywords: 关键词列表（可选）
   │  - aggregation: 聚合类型（可选）
   │  
   │  示例输出：
   │  {
   │    "intent": "search",
   │    "time_range": "last_1h",
   │    "service": "payment",
   │    "level": "ERROR",
   │    "keywords": ["异常", "错误", "失败"]
   │  }
   │  ```
   │
   ├─ 调用LLM API
   │  ├─ 提供商: OpenAI GPT-4 / Claude 3.5
   │  ├─ 温度: 0.1（低温度保证稳定性）
   │  ├─ 最大tokens: 500
   │  └─ 超时: 5秒
   │
   ├─ 解析LLM响应
   │  {
   │    "intent": "search",
   │    "time_range": "last_1h",
   │    "service": "payment",
   │    "level": "ERROR",
   │    "keywords": ["异常", "错误", "失败", "超时"]
   │  }
   │
   └─ 验证结果: 检查JSON格式、必填字段

4. 实体标准化
   ├─ 时间标准化: "最近" → last_1h → 2026-01-31T09:00:00Z ~ 2026-01-31T10:00:00Z
   ├─ 服务标准化: "支付服务" → payment-service（查询服务映射表）
   ├─ 级别标准化: ERROR
   └─ 关键词扩展: ["异常", "错误", "失败", "超时", "exception", "error"]

5. 查询生成
   ├─ 构建ES查询
   │  {
   │    "query": {
   │      "bool": {
   │        "must": [
   │          {"term": {"service": "payment-service"}},
   │          {"term": {"level": "ERROR"}},
   │          {"range": {"@timestamp": {"gte": "now-1h", "lte": "now"}}},
   │          {
   │            "multi_match": {
   │              "query": "异常 错误 失败 超时",
   │              "fields": ["message", "error.message"],
   │              "type": "best_fields"
   │            }
   │          }
   │        ]
   │      }
   │    },
   │    "aggs": {
   │      "error_types": {
   │        "terms": {
   │          "field": "error.type",
   │          "size": 10
   │        }
   │      },
   │      "timeline": {
   │        "date_histogram": {
   │          "field": "@timestamp",
   │          "interval": "5m"
   │        }
   │      }
   │    },
   │    "sort": [{"@timestamp": "desc"}],
   │    "size": 100
   │  }
   │
   └─ 查询优化

6. 查询执行
   ├─ 检查缓存
   ├─ 执行ES查询
   └─ 结果缓存

7. 智能结果总结（LLM生成）
   ├─ 构建总结Prompt
   │  ```
   │  请根据以下查询结果，生成一个简洁的中文总结：
   │  
   │  查询: "支付服务最近有什么异常吗？"
   │  时间范围: 最近1小时
   │  
   │  查询结果:
   │  - 总错误数: 156条
   │  - 主要错误类型:
   │    1. TimeoutException: 89条 (57%)
   │    2. DatabaseConnectionException: 45条 (29%)
   │    3. PaymentGatewayException: 22条 (14%)
   │  - 错误趋势: 最近15分钟错误率上升
   │  
   │  请生成一个简洁的总结，包括：
   │  1. 是否有异常
   │  2. 主要异常类型
   │  3. 严重程度评估
   │  4. 建议的处理措施
   │  ```
   │
   ├─ 调用LLM生成总结
   │  "支付服务在最近1小时内出现了156条错误日志，主要是超时异常（57%）和数据库连接异常（29%）。
   │   错误率在最近15分钟有上升趋势，建议立即检查数据库连接池配置和支付网关响应时间。"
   │
   └─ 返回总结和详细结果

8. 查询历史和反馈
   ├─ 记录查询
   ├─ 记录LLM调用
   └─ 等待用户反馈（点赞/点踩）
```

### 4.3 智能告警描述生成流程（Phase 3）

```
┌─────────────────────────────────────────────────────────────────┐
│                      智能告警描述流程                            │
└─────────────────────────────────────────────────────────────────┘

1. 告警触发
   ├─ 告警规则: error_rate > 5% for 5m
   ├─ 触发时间: 2026-01-31T10:00:00Z
   ├─ 服务: payment-service
   └─ 当前错误率: 8.5%

2. 上下文收集
   ├─ 收集最近15分钟的错误日志（样本）
   │  ├─ 错误类型分布
   │  ├─ 错误消息示例
   │  └─ 受影响的用户数
   │
   ├─ 收集历史趋势数据
   │  ├─ 过去24小时错误率趋势
   │  ├─ 同比数据（上周同时段）
   │  └─ 基线值
   │
   ├─ 收集相关指标
   │  ├─ 服务响应时间
   │  ├─ 数据库连接数
   │  ├─ 队列长度
   │  └─ CPU/内存使用率
   │
   └─ 收集依赖服务状态
      ├─ 数据库状态
      ├─ 缓存状态
      └─ 第三方API状态

3. LLM生成告警描述
   ├─ 构建Prompt
   │  ```
   │  你是一个运维专家。请根据以下告警信息，生成一个详细的告警描述。
   │  
   │  告警信息:
   │  - 服务: payment-service
   │  - 告警规则: 错误率超过5%持续5分钟
   │  - 当前错误率: 8.5%
   │  - 基线错误率: 0.5%
   │  - 触发时间: 2026-01-31 10:00:00
   │  
   │  错误分布:
   │  - TimeoutException: 89条 (57%)
   │  - DatabaseConnectionException: 45条 (29%)
   │  - PaymentGatewayException: 22条 (14%)
   │  
   │  相关指标:
   │  - 平均响应时间: 从150ms上升到850ms
   │  - 数据库连接数: 从50上升到95（最大100）
   │  - 队列长度: 从10上升到500
   │  
   │  依赖服务:
   │  - 数据库: 正常
   │  - Redis: 正常
   │  - 支付网关API: 响应时间从100ms上升到600ms
   │  
   │  请生成包含以下内容的告警描述：
   │  1. 问题概述（1-2句话）
   │  2. 影响范围
   │  3. 可能的根因分析（2-3个）
   │  4. 建议的处理措施（优先级排序）
   │  5. 严重程度评估（低/中/高/紧急）
   │  ```
   │
   ├─ 调用LLM API
   │  ├─ 提供商: Claude 3.5（推理能力强）
   │  ├─ 温度: 0.3
   │  ├─ 最大tokens: 1000
   │  └─ 超时: 10秒
   │
   └─ 解析LLM响应

4. 生成告警描述
   ```
   【问题概述】
   支付服务在10:00出现错误率异常上升，从基线0.5%上升到8.5%，主要表现为超时异常和数据库连接异常。
   
   【影响范围】
   - 受影响的支付请求: 约156笔（最近15分钟）
   - 预估影响用户数: 约120人
   - 业务影响: 支付成功率下降，用户体验受损
   
   【根因分析】
   1. 支付网关API响应时间从100ms上升到600ms（可能性: 高）
      - 建议检查支付网关服务状态
      - 检查网络连接质量
   
   2. 数据库连接池接近饱和（95/100）（可能性: 中）
      - 建议检查慢查询
      - 考虑扩大连接池大小
   
   3. 队列积压导致超时（队列长度500）（可能性: 中）
      - 建议检查消费者处理能力
      - 考虑增加消费者实例
   
   【处理建议】
   1. 【紧急】联系支付网关服务商，确认服务状态
   2. 【高优先级】检查数据库慢查询，优化SQL
   3. 【高优先级】临时扩容支付服务实例（2→4）
   4. 【中优先级】增加数据库连接池大小（100→200）
   5. 【中优先级】启用降级策略，使用备用支付通道
   
   【严重程度】高
   - 影响核心业务功能
   - 错误率持续上升
   - 建议立即处理
   ```

5. 告警推送
   ├─ 推送到告警通道（钉钉/企业微信/邮件）
   ├─ 创建工单
   ├─ 记录告警历史
   └─ 启动自动响应（如果配置）

6. 持续监控
   ├─ 监控错误率变化
   ├─ 监控处理措施效果
   └─ 自动更新告警状态
```

### 4.4 多轮对话流程

```
┌─────────────────────────────────────────────────────────────────┐
│                      多轮对话流程                                │
└─────────────────────────────────────────────────────────────────┘

1. 第一轮查询
   ├─ 用户: "查找支付服务的错误日志"
   ├─ 意图识别: search, service=payment, level=ERROR
   ├─ 查询执行: 返回100条结果
   ├─ 会话ID: session-12345
   └─ 上下文保存: Redis存储（TTL=30分钟）
      {
        "session_id": "session-12345",
        "history": [
          {
            "query": "查找支付服务的错误日志",
            "intent": "search",
            "entities": {
              "service": "payment",
              "level": "ERROR"
            },
            "result_count": 100,
            "timestamp": "2026-01-31T10:00:00Z"
          }
        ]
      }

2. 第二轮追问
   ├─ 用户: "最近1小时的"
   ├─ 上下文加载: 从Redis加载session-12345
   ├─ 意图继承: search（继承上一轮）
   ├─ 实体补全:
   │  ├─ 继承: service=payment, level=ERROR
   │  └─ 新增: time_range=last_1h
   ├─ 查询执行: 返回25条结果
   └─ 上下文更新:
      {
        "session_id": "session-12345",
        "history": [
          {...},  // 第一轮
          {
            "query": "最近1小时的",
            "intent": "search",
            "entities": {
              "service": "payment",
              "level": "ERROR",
              "time_range": "last_1h"
            },
            "result_count": 25,
            "timestamp": "2026-01-31T10:01:00Z"
          }
        ]
      }

3. 第三轮细化
   ├─ 用户: "按错误类型分组统计"
   ├─ 上下文加载
   ├─ 意图转换: search → stats（操作变更）
   ├─ 实体继承: service=payment, level=ERROR, time_range=last_1h
   ├─ 新增聚合: group_by=error_type
   ├─ 查询执行: 返回聚合结果
   │  {
   │    "TimeoutException": 15,
   │    "DatabaseException": 8,
   │    "PaymentGatewayException": 2
   │  }
   └─ 上下文更新

4. 第四轮对比
   ├─ 用户: "和昨天同时段对比"
   ├─ 上下文加载
   ├─ 意图转换: stats → compare
   ├─ 实体继承: service=payment, level=ERROR, group_by=error_type
   ├─ 时间扩展:
   │  ├─ 当前: 2026-01-31 09:00-10:00
   │  └─ 对比: 2026-01-30 09:00-10:00
   ├─ 查询执行: 返回对比结果
   │  {
   │    "current": {
   │      "TimeoutException": 15,
   │      "DatabaseException": 8,
   │      "PaymentGatewayException": 2
   │    },
   │    "previous": {
   │      "TimeoutException": 5,
   │      "DatabaseException": 3,
   │      "PaymentGatewayException": 1
   │    },
   │    "change": {
   │      "TimeoutException": "+200%",
   │      "DatabaseException": "+167%",
   │      "PaymentGatewayException": "+100%"
   │    }
   │  }
   └─ 智能总结: "超时异常增长最明显，增长了200%，建议重点关注"

5. 会话管理
   ├─ 会话超时: 30分钟无操作自动清理
   ├─ 会话持久化: 重要会话保存到PostgreSQL
   ├─ 会话恢复: 用户可以恢复历史会话
   └─ 会话分享: 生成分享链接
```

### 4.5 异常流程

**LLM调用失败**:
```
1. 检测LLM API调用失败
   ├─ 超时（> 10秒）
   ├─ 网络错误
   ├─ API限流
   └─ 返回错误

2. 降级策略
   ├─ 切换到备用LLM提供商
   ├─ 如果所有LLM都失败 → 降级到规则引擎
   ├─ 返回基础查询结果（无智能总结）
   └─ 记录错误日志

3. 用户提示
   ├─ 提示: "智能分析暂时不可用，已为您返回基础查询结果"
   └─ 建议: "您可以稍后重试或使用高级查询语法"

4. 监控告警
   ├─ 记录LLM失败率
   ├─ 失败率 > 10% → 触发告警
   └─ 自动切换到降级模式
```

**查询解析失败**:
```
1. 检测查询解析失败
   ├─ 无法识别意图
   ├─ 实体提取失败
   └─ 查询生成失败

2. 智能提示
   ├─ 分析失败原因
   ├─ 提供查询建议
   │  "您是想查询错误日志吗？请尝试：
   │   - 查找最近1小时的错误日志
   │   - 统计支付服务的错误数量
   │   - 对比今天和昨天的错误率"
   └─ 提供查询模板

3. 查询历史推荐
   ├─ 查询相似的历史查询
   ├─ 推荐热门查询
   └─ 提供快捷查询按钮

4. 用户反馈收集
   ├─ 记录失败的查询
   ├─ 收集用户反馈
   └─ 用于模型优化
```

**查询结果为空**:
```
1. 检测查询结果为空
2. 智能建议
   ├─ 扩大时间范围
   ├─ 放宽过滤条件
   ├─ 检查服务名称是否正确
   └─ 提供相似查询建议
3. 返回友好提示
   "未找到符合条件的日志。建议：
    - 扩大时间范围到最近24小时
    - 检查服务名称是否正确
    - 尝试使用更宽松的过滤条件"
```

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块21部分，共21个接口:

**自然语言查询接口** (4个):
- API-21-443: 自然语言查询 - POST /api/v1/nlp/query
- API-21-444: 查询建议 - GET /api/v1/nlp/suggestions
- API-21-445: 查询历史 - GET /api/v1/nlp/history
- API-21-446: 查询反馈 - POST /api/v1/nlp/feedback

**智能告警接口** (3个):
- API-21-447: 生成告警描述 - POST /api/v1/nlp/alert/describe
- API-21-448: 根因分析 - POST /api/v1/nlp/alert/root-cause
- API-21-449: 处理建议 - POST /api/v1/nlp/alert/suggestions

**会话管理接口** (3个):
- API-21-450: 创建会话 - POST /api/v1/nlp/sessions
- API-21-451: 获取会话 - GET /api/v1/nlp/sessions/{id}
- API-21-452: 删除会话 - DELETE /api/v1/nlp/sessions/{id}

**配置管理接口** (2个):
- API-21-453: 更新NLP配置 - PUT /api/v1/nlp/config
- API-21-454: 获取NLP配置 - GET /api/v1/nlp/config

**告警规则管理接口** (9个) - 支持热更新:
- API-21-455: 创建告警规则 - POST /api/v1/nlp/alert-rules（热更新）
- API-21-456: 获取告警规则列表 - GET /api/v1/nlp/alert-rules
- API-21-457: 获取告警规则详情 - GET /api/v1/nlp/alert-rules/{id}
- API-21-458: 更新告警规则 - PUT /api/v1/nlp/alert-rules/{id}（热更新）
- API-21-459: 删除告警规则 - DELETE /api/v1/nlp/alert-rules/{id}（热更新）
- API-21-460: 启用/禁用告警规则 - PATCH /api/v1/nlp/alert-rules/{id}/toggle（热更新）
- API-21-461: 测试告警规则 - POST /api/v1/nlp/alert-rules/{id}/test
- API-21-462: 获取告警规则历史 - GET /api/v1/nlp/alert-rules/{id}/history
- API-21-463: 回滚告警规则 - POST /api/v1/nlp/alert-rules/{id}/rollback（热更新）

### 5.2 核心接口详细设计

**API-21-443: 自然语言查询**

请求:
```json
{
  "query": "查找昨天下午3点到5点之间的所有错误日志",
  "session_id": "session-12345",
  "language": "zh",
  "options": {
    "enable_llm": true,
    "enable_summary": true,
    "max_results": 100
  }
}
```

响应:
```json
{
  "query_id": "query-67890",
  "session_id": "session-12345",
  "intent": {
    "type": "search",
    "confidence": 0.95
  },
  "entities": {
    "time_range": {
      "start": "2026-01-30T15:00:00Z",
      "end": "2026-01-30T17:00:00Z",
      "original": "昨天下午3点到5点"
    },
    "level": "ERROR",
    "service": null,
    "keywords": []
  },
  "generated_query": {
    "type": "elasticsearch",
    "query": {
      "query": {
        "bool": {
          "must": [
            {"term": {"level": "ERROR"}},
            {"range": {"@timestamp": {"gte": "2026-01-30T15:00:00Z", "lte": "2026-01-30T17:00:00Z"}}}
          ]
        }
      }
    }
  },
  "results": {
    "total": 156,
    "hits": [
      {
        "timestamp": "2026-01-30T16:45:23Z",
        "level": "ERROR",
        "service": "payment-service",
        "message": "Payment timeout after 30s",
        "trace_id": "abc123"
      }
    ]
  },
  "summary": {
    "enabled": true,
    "text": "在昨天下午3点到5点期间，系统共记录了156条错误日志，主要来自支付服务（89条）和订单服务（45条）。错误类型以超时异常为主（57%），建议检查服务响应时间。",
    "generated_by": "claude-3.5"
  },
  "suggestions": [
    "按服务分组统计",
    "查看错误趋势",
    "对比前一天同时段"
  ],
  "latency": {
    "total_ms": 1250,
    "parse_ms": 50,
    "llm_ms": 800,
    "query_ms": 350,
    "summary_ms": 50
  }
}
```

**API-21-447: 生成告警描述**

请求:
```json
{
  "alert_id": "alert-12345",
  "alert_rule": "error_rate > 5% for 5m",
  "service": "payment-service",
  "current_value": 8.5,
  "threshold": 5.0,
  "context": {
    "error_samples": [
      {
        "type": "TimeoutException",
        "count": 89,
        "percentage": 57
      },
      {
        "type": "DatabaseConnectionException",
        "count": 45,
        "percentage": 29
      }
    ],
    "metrics": {
      "avg_response_time": 850,
      "baseline_response_time": 150,
      "db_connections": 95,
      "max_db_connections": 100
    },
    "dependencies": {
      "database": "healthy",
      "redis": "healthy",
      "payment_gateway": "degraded"
    }
  },
  "options": {
    "language": "zh",
    "include_root_cause": true,
    "include_suggestions": true
  }
}
```

响应:
```json
{
  "alert_id": "alert-12345",
  "description": {
    "summary": "支付服务在10:00出现错误率异常上升，从基线0.5%上升到8.5%，主要表现为超时异常和数据库连接异常。",
    "impact": {
      "affected_requests": 156,
      "affected_users": 120,
      "business_impact": "支付成功率下降，用户体验受损"
    },
    "severity": "high",
    "severity_score": 8.5
  },
  "root_cause_analysis": [
    {
      "cause": "支付网关API响应时间异常",
      "probability": "high",
      "evidence": [
        "支付网关响应时间从100ms上升到600ms",
        "超时异常占比57%"
      ],
      "recommendations": [
        "联系支付网关服务商确认服务状态",
        "检查网络连接质量"
      ]
    },
    {
      "cause": "数据库连接池接近饱和",
      "probability": "medium",
      "evidence": [
        "数据库连接数95/100",
        "数据库连接异常占比29%"
      ],
      "recommendations": [
        "检查慢查询",
        "扩大连接池大小"
      ]
    }
  ],
  "suggestions": [
    {
      "priority": "urgent",
      "action": "联系支付网关服务商，确认服务状态",
      "estimated_time": "5分钟"
    },
    {
      "priority": "high",
      "action": "检查数据库慢查询，优化SQL",
      "estimated_time": "15分钟"
    },
    {
      "priority": "high",
      "action": "临时扩容支付服务实例（2→4）",
      "estimated_time": "10分钟"
    }
  ],
  "generated_by": "claude-3.5",
  "generated_at": "2026-01-31T10:00:05Z",
  "latency_ms": 3500
}
```

### 5.3 内部接口

**意图识别器接口**:
```go
// IntentRecognizer 意图识别器接口
type IntentRecognizer interface {
    // 识别意图
    Recognize(ctx context.Context, query string, language string) (*Intent, error)
    
    // 批量识别
    BatchRecognize(ctx context.Context, queries []string, language string) ([]*Intent, error)
}

// Intent 查询意图
type Intent struct {
    Type       IntentType             `json:"type"`        // search/stats/trend/compare
    Confidence float64                `json:"confidence"`  // 置信度 0-1
    Entities   map[string]interface{} `json:"entities"`    // 提取的实体
    Original   string                 `json:"original"`    // 原始查询
}

// IntentType 意图类型
type IntentType string

const (
    IntentTypeSearch  IntentType = "search"  // 搜索查询
    IntentTypeStats   IntentType = "stats"   // 统计查询
    IntentTypeTrend   IntentType = "trend"   // 趋势分析
    IntentTypeCompare IntentType = "compare" // 对比分析
)
```

**实体提取器接口**:
```go
// EntityExtractor 实体提取器接口
type EntityExtractor interface {
    // 提取实体
    Extract(ctx context.Context, query string, language string) (*Entities, error)
}

// Entities 提取的实体
type Entities struct {
    TimeRange *TimeRange             `json:"time_range,omitempty"` // 时间范围
    Service   string                 `json:"service,omitempty"`    // 服务名称
    Level     string                 `json:"level,omitempty"`      // 日志级别
    Keywords  []string               `json:"keywords,omitempty"`   // 关键词
    UserID    string                 `json:"user_id,omitempty"`    // 用户ID
    IP        string                 `json:"ip,omitempty"`         // IP地址
    Custom    map[string]interface{} `json:"custom,omitempty"`     // 自定义实体
}

// TimeRange 时间范围
type TimeRange struct {
    Start    time.Time `json:"start"`              // 开始时间
    End      time.Time `json:"end"`                // 结束时间
    Original string    `json:"original"`           // 原始表达式
    Type     string    `json:"type"`               // relative/absolute
}
```

**查询生成器接口**:
```go
// QueryGenerator 查询生成器接口
type QueryGenerator interface {
    // 生成ES查询
    GenerateESQuery(ctx context.Context, intent *Intent, entities *Entities) (map[string]interface{}, error)
    
    // 生成SQL查询
    GenerateSQL(ctx context.Context, intent *Intent, entities *Entities) (string, []interface{}, error)
}
```

**LLM客户端接口**:
```go
// LLMClient LLM客户端接口
type LLMClient interface {
    // 调用LLM
    Call(ctx context.Context, prompt string, options *LLMOptions) (*LLMResponse, error)
    
    // 流式调用
    StreamCall(ctx context.Context, prompt string, options *LLMOptions) (<-chan *LLMChunk, error)
}

// LLMOptions LLM调用选项
type LLMOptions struct {
    Model       string  `json:"model"`        // 模型名称
    Temperature float64 `json:"temperature"`  // 温度 0-1
    MaxTokens   int     `json:"max_tokens"`   // 最大tokens
    Timeout     int     `json:"timeout"`      // 超时时间（秒）
}

// LLMResponse LLM响应
type LLMResponse struct {
    Content      string                 `json:"content"`       // 生成的内容
    Model        string                 `json:"model"`         // 使用的模型
    Usage        *TokenUsage            `json:"usage"`         // Token使用情况
    FinishReason string                 `json:"finish_reason"` // 完成原因
    Metadata     map[string]interface{} `json:"metadata"`      // 元数据
}

// TokenUsage Token使用情况
type TokenUsage struct {
    PromptTokens     int `json:"prompt_tokens"`
    CompletionTokens int `json:"completion_tokens"`
    TotalTokens      int `json:"total_tokens"`
}
```

### 5.4 数据格式

**时间表达式映射**:
```yaml
time_patterns:
  # 相对时间
  - pattern: "最近(\d+)(分钟|小时|天)"
    type: relative
    examples:
      - "最近1小时" -> "now-1h"
      - "最近30分钟" -> "now-30m"
      - "最近7天" -> "now-7d"
  
  # 绝对时间
  - pattern: "昨天"
    type: absolute
    value: "yesterday"
  
  - pattern: "今天"
    type: absolute
    value: "today"
  
  - pattern: "上周"
    type: absolute
    value: "last_week"
  
  # 时间范围
  - pattern: "(\d+)点到(\d+)点"
    type: range
    examples:
      - "3点到5点" -> "03:00-05:00"
```

**日志级别映射**:
```yaml
level_mappings:
  zh:
    - keywords: ["错误", "异常", "失败"]
      level: ERROR
    - keywords: ["警告", "告警"]
      level: WARN
    - keywords: ["信息", "正常"]
      level: INFO
    - keywords: ["调试", "debug"]
      level: DEBUG
  
  en:
    - keywords: ["error", "exception", "fail"]
      level: ERROR
    - keywords: ["warn", "warning"]
      level: WARN
    - keywords: ["info", "information"]
      level: INFO
    - keywords: ["debug"]
      level: DEBUG
```

**服务名称映射**:
```yaml
service_mappings:
  - aliases: ["支付", "支付服务", "payment"]
    service_name: payment-service
  
  - aliases: ["订单", "订单服务", "order"]
    service_name: order-service
  
  - aliases: ["用户", "用户服务", "user"]
    service_name: user-service
```

---

## 6. 数据设计

### 6.1 数据模型

**查询历史**:
```go
// QueryHistory 查询历史
type QueryHistory struct {
    ID           string                 `json:"id" db:"id"`
    SessionID    string                 `json:"session_id" db:"session_id"`
    UserID       string                 `json:"user_id" db:"user_id"`
    Query        string                 `json:"query" db:"query"`
    Language     string                 `json:"language" db:"language"`
    Intent       string                 `json:"intent" db:"intent"`
    Entities     map[string]interface{} `json:"entities" db:"entities"`
    GeneratedQuery string               `json:"generated_query" db:"generated_query"`
    ResultCount  int                    `json:"result_count" db:"result_count"`
    Latency      int                    `json:"latency" db:"latency"` // 毫秒
    LLMProvider  string                 `json:"llm_provider" db:"llm_provider"`
    LLMTokens    int                    `json:"llm_tokens" db:"llm_tokens"`
    Success      bool                   `json:"success" db:"success"`
    Error        string                 `json:"error" db:"error"`
    Feedback     *string                `json:"feedback" db:"feedback"` // thumbs_up/thumbs_down
    CreatedAt    time.Time              `json:"created_at" db:"created_at"`
}

// Session 会话
type Session struct {
    ID        string                   `json:"id" db:"id"`
    UserID    string                   `json:"user_id" db:"user_id"`
    Context   map[string]interface{}   `json:"context" db:"context"`
    History   []QueryHistory           `json:"history" db:"-"`
    CreatedAt time.Time                `json:"created_at" db:"created_at"`
    UpdatedAt time.Time                `json:"updated_at" db:"updated_at"`
    ExpiresAt time.Time                `json:"expires_at" db:"expires_at"`
}

// AlertDescription 告警描述
type AlertDescription struct {
    ID              string                 `json:"id" db:"id"`
    AlertID         string                 `json:"alert_id" db:"alert_id"`
    Summary         string                 `json:"summary" db:"summary"`
    Impact          map[string]interface{} `json:"impact" db:"impact"`
    Severity        string                 `json:"severity" db:"severity"`
    SeverityScore   float64                `json:"severity_score" db:"severity_score"`
    RootCauses      []RootCause            `json:"root_causes" db:"root_causes"`
    Suggestions     []Suggestion           `json:"suggestions" db:"suggestions"`
    GeneratedBy     string                 `json:"generated_by" db:"generated_by"`
    GeneratedAt     time.Time              `json:"generated_at" db:"generated_at"`
    Latency         int                    `json:"latency" db:"latency"`
    UserFeedback    *string                `json:"user_feedback" db:"user_feedback"`
}

// RootCause 根因
type RootCause struct {
    Cause         string   `json:"cause"`
    Probability   string   `json:"probability"`   // high/medium/low
    Evidence      []string `json:"evidence"`
    Recommendations []string `json:"recommendations"`
}

// Suggestion 建议
type Suggestion struct {
    Priority      string `json:"priority"`       // urgent/high/medium/low
    Action        string `json:"action"`
    EstimatedTime string `json:"estimated_time"`
}

// NLPConfig NLP配置
type NLPConfig struct {
    ID              string                 `json:"id" db:"id"`
    Enabled         bool                   `json:"enabled" db:"enabled"`
    LLMProvider     string                 `json:"llm_provider" db:"llm_provider"` // openai/claude/local
    LLMModel        string                 `json:"llm_model" db:"llm_model"`
    LLMAPIKey       string                 `json:"llm_api_key" db:"llm_api_key"`
    LLMEndpoint     string                 `json:"llm_endpoint" db:"llm_endpoint"`
    Temperature     float64                `json:"temperature" db:"temperature"`
    MaxTokens       int                    `json:"max_tokens" db:"max_tokens"`
    Timeout         int                    `json:"timeout" db:"timeout"`
    EnableCache     bool                   `json:"enable_cache" db:"enable_cache"`
    CacheTTL        int                    `json:"cache_ttl" db:"cache_ttl"`
    TimePatterns    []TimePattern          `json:"time_patterns" db:"time_patterns"`
    LevelMappings   map[string][]LevelMapping `json:"level_mappings" db:"level_mappings"`
    ServiceMappings []ServiceMapping       `json:"service_mappings" db:"service_mappings"`
    UpdatedAt       time.Time              `json:"updated_at" db:"updated_at"`
    UpdatedBy       string                 `json:"updated_by" db:"updated_by"`
}

// TimePattern 时间模式
type TimePattern struct {
    Pattern  string   `json:"pattern"`
    Type     string   `json:"type"`     // relative/absolute/range
    Examples []string `json:"examples"`
}

// LevelMapping 级别映射
type LevelMapping struct {
    Keywords []string `json:"keywords"`
    Level    string   `json:"level"`
}

// ServiceMapping 服务映射
type ServiceMapping struct {
    Aliases     []string `json:"aliases"`
    ServiceName string   `json:"service_name"`
}
```

### 6.2 数据库设计

**PostgreSQL表设计**:

```sql
-- 查询历史表
CREATE TABLE nlp_query_history (
    id VARCHAR(64) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(64) NOT NULL,
    query TEXT NOT NULL,
    language VARCHAR(10) NOT NULL,
    intent VARCHAR(50),
    entities JSONB,
    generated_query TEXT,
    result_count INTEGER,
    latency INTEGER,
    llm_provider VARCHAR(50),
    llm_tokens INTEGER,
    success BOOLEAN DEFAULT true,
    error TEXT,
    feedback VARCHAR(20),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    INDEX idx_session_id (session_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- 会话表
CREATE TABLE nlp_sessions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    context JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_expires_at (expires_at)
);

-- 告警描述表
CREATE TABLE nlp_alert_descriptions (
    id VARCHAR(64) PRIMARY KEY,
    alert_id VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    impact JSONB,
    severity VARCHAR(20),
    severity_score FLOAT,
    root_causes JSONB,
    suggestions JSONB,
    generated_by VARCHAR(50),
    generated_at TIMESTAMP NOT NULL,
    latency INTEGER,
    user_feedback VARCHAR(20),
    INDEX idx_alert_id (alert_id),
    INDEX idx_generated_at (generated_at)
);

-- NLP配置表
CREATE TABLE nlp_config (
    id VARCHAR(64) PRIMARY KEY,
    enabled BOOLEAN DEFAULT false,
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    llm_api_key TEXT,
    llm_endpoint VARCHAR(255),
    temperature FLOAT DEFAULT 0.1,
    max_tokens INTEGER DEFAULT 1000,
    timeout INTEGER DEFAULT 10,
    enable_cache BOOLEAN DEFAULT true,
    cache_ttl INTEGER DEFAULT 300,
    time_patterns JSONB,
    level_mappings JSONB,
    service_mappings JSONB,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by VARCHAR(64)
);
```

### 6.3 缓存设计

**Redis缓存策略**:

```go
// 查询结果缓存
type QueryCache struct {
    redis *redis.Client
}

// 缓存Key格式
func (c *QueryCache) getCacheKey(query string, entities *Entities) string {
    // 使用查询和实体生成唯一Key
    data := fmt.Sprintf("%s:%v", query, entities)
    hash := sha256.Sum256([]byte(data))
    return fmt.Sprintf("nlp:query:%x", hash)
}

// 缓存查询结果
func (c *QueryCache) Set(ctx context.Context, query string, entities *Entities, result interface{}, ttl time.Duration) error {
    key := c.getCacheKey(query, entities)
    data, err := json.Marshal(result)
    if err != nil {
        return err
    }
    return c.redis.Set(ctx, key, data, ttl).Err()
}

// 获取缓存结果
func (c *QueryCache) Get(ctx context.Context, query string, entities *Entities) (interface{}, error) {
    key := c.getCacheKey(query, entities)
    data, err := c.redis.Get(ctx, key).Bytes()
    if err != nil {
        return nil, err
    }
    
    var result interface{}
    err = json.Unmarshal(data, &result)
    return result, err
}

// 会话缓存
func (c *QueryCache) SetSession(ctx context.Context, sessionID string, session *Session, ttl time.Duration) error {
    key := fmt.Sprintf("nlp:session:%s", sessionID)
    data, err := json.Marshal(session)
    if err != nil {
        return err
    }
    return c.redis.Set(ctx, key, data, ttl).Err()
}

// LLM响应缓存
func (c *QueryCache) SetLLMResponse(ctx context.Context, prompt string, response *LLMResponse, ttl time.Duration) error {
    hash := sha256.Sum256([]byte(prompt))
    key := fmt.Sprintf("nlp:llm:%x", hash)
    data, err := json.Marshal(response)
    if err != nil {
        return err
    }
    return c.redis.Set(ctx, key, data, ttl).Err()
}
```

**缓存策略**:
| 缓存类型 | TTL | 说明 |
|---------|-----|------|
| 查询结果 | 5分钟 | 相同查询5分钟内返回缓存结果 |
| 会话上下文 | 30分钟 | 会话30分钟无操作自动过期 |
| LLM响应 | 1小时 | 相同Prompt 1小时内返回缓存结果 |
| 服务映射 | 24小时 | 服务名称映射关系 |
| 时间模式 | 24小时 | 时间表达式解析规则 |

### 6.4 索引设计

**Elasticsearch索引优化**:
```json
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1,
    "index": {
      "max_result_window": 10000
    }
  },
  "mappings": {
    "properties": {
      "@timestamp": {
        "type": "date"
      },
      "level": {
        "type": "keyword"
      },
      "service": {
        "type": "keyword"
      },
      "message": {
        "type": "text",
        "analyzer": "ik_max_word",
        "search_analyzer": "ik_smart",
        "fields": {
          "keyword": {
            "type": "keyword",
            "ignore_above": 256
          }
        }
      },
      "trace_id": {
        "type": "keyword"
      },
      "user_id": {
        "type": "keyword"
      },
      "ip": {
        "type": "ip"
      }
    }
  }
}
```

**PostgreSQL索引优化**:
```sql
-- 查询历史表索引
CREATE INDEX idx_query_history_session ON nlp_query_history(session_id);
CREATE INDEX idx_query_history_user ON nlp_query_history(user_id);
CREATE INDEX idx_query_history_created ON nlp_query_history(created_at DESC);
CREATE INDEX idx_query_history_success ON nlp_query_history(success) WHERE success = false;

-- 会话表索引
CREATE INDEX idx_sessions_user ON nlp_sessions(user_id);
CREATE INDEX idx_sessions_expires ON nlp_sessions(expires_at) WHERE expires_at > NOW();

-- 告警描述表索引
CREATE INDEX idx_alert_desc_alert ON nlp_alert_descriptions(alert_id);
CREATE INDEX idx_alert_desc_generated ON nlp_alert_descriptions(generated_at DESC);
```

---

## 7. 安全设计

### 7.1 安全措施
- 认证授权
- 数据加密
- 审计日志

---

## 8. 性能设计

### 8.1 性能指标
| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 指标1 | 值 | 方式 |

### 8.2 优化策略
- 优化策略1
- 优化策略2

---

## 9. 部署方案

### 9.1 部署架构
根据需求文档填充部署架构

### 9.2 资源配置
| 组件 | 副本数 | CPU | 内存 | 存储 |
|------|--------|-----|------|------|
| 组件1 | 3 | 2核 | 4GB | - |

---

## 10. 监控与运维

### 10.1 监控指标
```
# 根据需求文档填充监控指标
metric_name_total
metric_duration_seconds
```

### 10.2 告警规则
| 告警 | 条件 | 级别 | 处理 |
|------|------|------|------|
| 告警1 | 条件 | Warning | 处理方式 |

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项
| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| config_item | type | value | 说明 |

### 11.2 热更新实现
```go
// 配置热更新实现示例
type Manager struct {
    config atomic.Value
}

func (m *Manager) subscribeConfigChanges() {
    // 订阅Redis配置变更
    pubsub := m.redis.Subscribe("config:module21:reload")
    
    for msg := range pubsub.Channel() {
        newConfig, err := m.loadConfigFromRedis()
        if err != nil {
            log.Error("加载配置失败", err)
            continue
        }
        
        // 验证配置
        if err := newConfig.Validate(); err != nil {
            log.Error("配置验证失败", err)
            continue
        }
        
        // 原子更新
        m.config.Store(newConfig)
        
        log.Info("配置已更新")
    }
}
```

---

## 12. 风险与回滚

### 12.1 风险识别
| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 风险1 | 中 | 高 | 措施 |

### 12.2 回滚方案
根据需求文档填充回滚方案

---

## 13. 附录

### 13.1 术语表
| 术语 | 说明 |
|------|------|
| 术语1 | 说明 |

### 13.2 参考文档
- 参考文档链接

### 13.3 变更记录
| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿 | 系统架构团队 |


---

## 7. 安全设计

### 7.1 认证授权

**API认证**:
```go
// NLP API需要认证
// 使用JWT Token或API Key
Authorization: Bearer <token>
X-API-Key: <api_key>
```

**权限控制**:
- 查询权限: 用户只能查询自己有权限的服务日志
- 配置权限: 只有管理员可以修改NLP配置
- 会话隔离: 用户只能访问自己的会话

### 7.2 数据安全

**敏感数据保护**:
```go
// LLM API Key加密存储
type ConfigEncryptor struct {
    key []byte
}

func (e *ConfigEncryptor) EncryptAPIKey(apiKey string) (string, error) {
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonce := make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return "", err
    }
    
    ciphertext := gcm.Seal(nonce, nonce, []byte(apiKey), nil)
    return base64.StdEncoding.EncodeToString(ciphertext), nil
}

func (e *ConfigEncryptor) DecryptAPIKey(encrypted string) (string, error) {
    data, err := base64.StdEncoding.DecodeString(encrypted)
    if err != nil {
        return "", err
    }
    
    block, err := aes.NewCipher(e.key)
    if err != nil {
        return "", err
    }
    
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return "", err
    }
    
    nonceSize := gcm.NonceSize()
    nonce, ciphertext := data[:nonceSize], data[nonceSize:]
    
    plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
    if err != nil {
        return "", err
    }
    
    return string(plaintext), nil
}
```

**查询日志脱敏**:
```go
// 记录查询历史时脱敏敏感信息
func maskSensitiveData(query string) string {
    // 脱敏手机号
    query = regexp.MustCompile(`1[3-9]\d{9}`).ReplaceAllString(query, "***********")
    
    // 脱敏身份证号
    query = regexp.MustCompile(`\d{17}[\dXx]`).ReplaceAllString(query, "******************")
    
    // 脱敏邮箱
    query = regexp.MustCompile(`[\w.-]+@[\w.-]+\.\w+`).ReplaceAllString(query, "***@***.***")
    
    return query
}
```

### 7.3 LLM安全

**Prompt注入防护**:
```go
// 检测Prompt注入攻击
func detectPromptInjection(query string) bool {
    // 检测常见的注入模式
    injectionPatterns := []string{
        "ignore previous instructions",
        "忽略之前的指令",
        "system:",
        "assistant:",
        "你现在是",
        "pretend you are",
    }
    
    lowerQuery := strings.ToLower(query)
    for _, pattern := range injectionPatterns {
        if strings.Contains(lowerQuery, pattern) {
            return true
        }
    }
    
    return false
}

// 清理用户输入
func sanitizeUserInput(query string) string {
    // 移除特殊字符
    query = strings.TrimSpace(query)
    
    // 限制长度
    if len(query) > 1000 {
        query = query[:1000]
    }
    
    return query
}
```

**LLM输出验证**:
```go
// 验证LLM输出
func validateLLMOutput(output string) error {
    // 检查输出长度
    if len(output) > 10000 {
        return errors.New("LLM output too long")
    }
    
    // 检查是否包含敏感信息
    if containsSensitiveInfo(output) {
        return errors.New("LLM output contains sensitive information")
    }
    
    // 检查JSON格式（如果需要）
    if !isValidJSON(output) {
        return errors.New("LLM output is not valid JSON")
    }
    
    return nil
}
```

### 7.4 审计日志

**审计事件记录**:
```go
// AuditLog 审计日志
type AuditLog struct {
    Timestamp   time.Time              `json:"timestamp"`
    Event       string                 `json:"event"`
    UserID      string                 `json:"user_id"`
    Action      string                 `json:"action"`
    Resource    string                 `json:"resource"`
    Result      string                 `json:"result"`
    Details     map[string]interface{} `json:"details"`
    IP          string                 `json:"ip"`
    UserAgent   string                 `json:"user_agent"`
}

// 记录查询审计
func logQueryAudit(userID, query string, success bool) {
    audit := &AuditLog{
        Timestamp: time.Now(),
        Event:     "nlp_query",
        UserID:    userID,
        Action:    "query",
        Resource:  "logs",
        Result:    ternary(success, "success", "failure"),
        Details: map[string]interface{}{
            "query": maskSensitiveData(query),
        },
    }
    writeAuditLog(audit)
}

// 记录配置变更审计
func logConfigChangeAudit(userID string, oldConfig, newConfig *NLPConfig) {
    audit := &AuditLog{
        Timestamp: time.Now(),
        Event:     "nlp_config_change",
        UserID:    userID,
        Action:    "update",
        Resource:  "nlp_config",
        Result:    "success",
        Details: map[string]interface{}{
            "old_provider": oldConfig.LLMProvider,
            "new_provider": newConfig.LLMProvider,
            "old_model":    oldConfig.LLMModel,
            "new_model":    newConfig.LLMModel,
        },
    }
    writeAuditLog(audit)
}
```

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 查询响应时间（MVP） | < 1秒 | 从请求到返回结果的时间 |
| 查询响应时间（Phase 2） | < 2秒 | 包含LLM调用的总时间 |
| LLM调用延迟 | < 1秒 | LLM API调用时间 |
| 查询缓存命中率 | > 60% | 缓存命中次数/总查询次数 |
| 并发查询数 | 100 QPS | 每秒处理的查询数 |
| 意图识别准确率（MVP） | > 80% | 正确识别的查询数/总查询数 |
| 意图识别准确率（Phase 2） | > 95% | 使用LLM后的准确率 |
| 实体提取准确率 | > 90% | 正确提取的实体数/总实体数 |

### 8.2 性能优化策略

**1. 查询缓存**:
```go
// 多级缓存策略
type MultiLevelCache struct {
    l1Cache *sync.Map          // 内存缓存（最热数据）
    l2Cache *redis.Client      // Redis缓存（热数据）
    l3Cache *PostgreSQLClient  // 数据库（冷数据）
}

func (c *MultiLevelCache) Get(key string) (interface{}, error) {
    // L1缓存查询
    if value, ok := c.l1Cache.Load(key); ok {
        return value, nil
    }
    
    // L2缓存查询
    value, err := c.l2Cache.Get(context.Background(), key).Result()
    if err == nil {
        // 回填L1缓存
        c.l1Cache.Store(key, value)
        return value, nil
    }
    
    // L3缓存查询
    value, err = c.l3Cache.Query(key)
    if err == nil {
        // 回填L2和L1缓存
        c.l2Cache.Set(context.Background(), key, value, 5*time.Minute)
        c.l1Cache.Store(key, value)
        return value, nil
    }
    
    return nil, errors.New("cache miss")
}
```

**2. LLM调用优化**:
```go
// LLM调用池
type LLMPool struct {
    clients []LLMClient
    index   atomic.Uint32
}

// 轮询选择LLM客户端
func (p *LLMPool) GetClient() LLMClient {
    idx := p.index.Add(1) % uint32(len(p.clients))
    return p.clients[idx]
}

// 并发调用多个LLM（取最快响应）
func (p *LLMPool) RaceCall(ctx context.Context, prompt string) (*LLMResponse, error) {
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    
    resultChan := make(chan *LLMResponse, len(p.clients))
    errorChan := make(chan error, len(p.clients))
    
    for _, client := range p.clients {
        go func(c LLMClient) {
            resp, err := c.Call(ctx, prompt, &LLMOptions{
                Temperature: 0.1,
                MaxTokens:   500,
            })
            if err != nil {
                errorChan <- err
            } else {
                resultChan <- resp
            }
        }(client)
    }
    
    select {
    case resp := <-resultChan:
        return resp, nil
    case <-ctx.Done():
        return nil, ctx.Err()
    }
}
```

**3. 批量处理**:
```go
// 批量查询处理
type BatchProcessor struct {
    batchSize int
    timeout   time.Duration
    buffer    []*QueryRequest
    mu        sync.Mutex
}

func (p *BatchProcessor) Add(req *QueryRequest) <-chan *QueryResponse {
    p.mu.Lock()
    defer p.mu.Unlock()
    
    respChan := make(chan *QueryResponse, 1)
    req.respChan = respChan
    
    p.buffer = append(p.buffer, req)
    
    // 达到批次大小，立即处理
    if len(p.buffer) >= p.batchSize {
        go p.processBatch()
    }
    
    return respChan
}

func (p *BatchProcessor) processBatch() {
    p.mu.Lock()
    batch := p.buffer
    p.buffer = nil
    p.mu.Unlock()
    
    // 批量调用LLM
    responses := p.batchCallLLM(batch)
    
    // 分发响应
    for i, resp := range responses {
        batch[i].respChan <- resp
    }
}
```

**4. 异步处理**:
```go
// 异步生成告警描述
func (s *NLPService) GenerateAlertDescriptionAsync(alertID string) error {
    // 立即返回，后台生成
    go func() {
        ctx := context.Background()
        
        // 收集上下文
        context, err := s.collectAlertContext(ctx, alertID)
        if err != nil {
            log.Error("Failed to collect alert context", err)
            return
        }
        
        // 调用LLM生成描述
        description, err := s.generateDescription(ctx, context)
        if err != nil {
            log.Error("Failed to generate alert description", err)
            return
        }
        
        // 保存描述
        err = s.saveAlertDescription(ctx, alertID, description)
        if err != nil {
            log.Error("Failed to save alert description", err)
            return
        }
        
        // 推送通知
        s.notifyAlertDescription(alertID, description)
    }()
    
    return nil
}
```

**5. 预热和预加载**:
```go
// 启动时预热常用查询
func (s *NLPService) Warmup() error {
    commonQueries := []string{
        "查找最近1小时的错误日志",
        "统计今天的错误数量",
        "查看支付服务的日志",
    }
    
    for _, query := range commonQueries {
        // 预先解析和缓存
        intent, entities, err := s.parseQuery(context.Background(), query)
        if err != nil {
            continue
        }
        
        // 缓存解析结果
        s.cache.Set(query, &ParseResult{
            Intent:   intent,
            Entities: entities,
        }, 24*time.Hour)
    }
    
    return nil
}
```

### 8.3 容量规划

**资源需求估算**:
```
假设：
- 日活用户: 1000人
- 每人每天查询: 20次
- 总查询量: 20000次/天 ≈ 0.23 QPS（平均）
- 峰值QPS: 10 QPS（按平均值的50倍估算）

资源配置：
- NLP服务: 2副本 × (2核CPU + 4GB内存)
- Redis: 1副本 × (2核CPU + 8GB内存)
- PostgreSQL: 1副本 × (4核CPU + 16GB内存)

LLM成本估算（Phase 2）：
- 每次查询平均tokens: 1000（prompt 500 + completion 500）
- 每天总tokens: 20000 × 1000 = 20M tokens
- 成本（GPT-4）: 20M × $0.03/1K = $600/天
- 成本（Claude）: 20M × $0.025/1K = $500/天
- 月成本: $15000-$18000

优化建议：
- 使用缓存减少LLM调用（预计减少60%）
- 优化后月成本: $6000-$7200
```

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Kubernetes集群                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  NLP服务 (Deployment)                                   │   │
│  │  ┌──────────┐  ┌──────────┐                             │   │
│  │  │ Pod 1    │  │ Pod 2    │                             │   │
│  │  │ 2C/4G    │  │ 2C/4G    │                             │   │
│  │  └──────────┘  └──────────┘                             │   │
│  │  HPA: 2-10副本（基于CPU和QPS）                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Redis (StatefulSet)                                    │   │
│  │  ┌──────────┐                                            │   │
│  │  │ Master   │                                            │   │
│  │  │ 2C/8G    │                                            │   │
│  │  └──────────┘                                            │   │
│  │  持久化存储: 50GB                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  PostgreSQL (StatefulSet)                               │   │
│  │  ┌──────────┐                                            │   │
│  │  │ Primary  │                                            │   │
│  │  │ 4C/16G   │                                            │   │
│  │  └──────────┘                                            │   │
│  │  持久化存储: 200GB                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 | 说明 |
|------|--------|-----|------|------|------|
| NLP服务 | 2-10 | 2核 | 4GB | - | HPA自动扩缩容 |
| Redis | 1 | 2核 | 8GB | 50GB | 缓存和会话存储 |
| PostgreSQL | 1 | 4核 | 16GB | 200GB | 查询历史和配置存储 |

### 9.3 Kubernetes配置

**Deployment配置**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nlp-service
  namespace: log-management
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nlp-service
  template:
    metadata:
      labels:
        app: nlp-service
    spec:
      containers:
      - name: nlp-service
        image: log-management/nlp-service:v1.0.0
        ports:
        - containerPort: 8080
        env:
        - name: LLM_PROVIDER
          valueFrom:
            configMapKeyRef:
              name: nlp-config
              key: llm_provider
        - name: LLM_API_KEY
          valueFrom:
            secretKeyRef:
              name: nlp-secrets
              key: llm_api_key
        - name: REDIS_HOST
          value: redis-service
        - name: POSTGRES_HOST
          value: postgres-service
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

**HPA配置**:
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nlp-service-hpa
  namespace: log-management
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nlp-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: nlp_queries_per_second
      target:
        type: AverageValue
        averageValue: "10"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
      selectPolicy: Max
```

### 9.4 发布策略

**灰度发布**:
```yaml
# 使用Istio进行灰度发布
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: nlp-service
spec:
  hosts:
  - nlp-service
  http:
  - match:
    - headers:
        x-canary:
          exact: "true"
    route:
    - destination:
        host: nlp-service
        subset: v2
      weight: 100
  - route:
    - destination:
        host: nlp-service
        subset: v1
      weight: 90
    - destination:
        host: nlp-service
        subset: v2
      weight: 10
```

**发布流程**:
```
1. 部署新版本（v2）
   ├─ 创建新的Deployment（nlp-service-v2）
   ├─ 副本数: 1
   └─ 流量权重: 0%

2. 灰度测试
   ├─ 内部测试用户（x-canary: true）
   ├─ 验证功能正常
   └─ 监控指标

3. 逐步放量
   ├─ 10%流量 → 监控30分钟
   ├─ 50%流量 → 监控30分钟
   └─ 100%流量 → 监控1小时

4. 清理旧版本
   ├─ 删除旧版本Deployment
   └─ 更新VirtualService
```

---

## 10. 监控与运维

### 10.1 监控指标

**业务指标**:
```
# 查询总数
nlp_queries_total{language="zh",intent="search"} 1000

# 查询延迟
nlp_query_duration_seconds{language="zh",intent="search",quantile="0.5"} 0.5
nlp_query_duration_seconds{language="zh",intent="search",quantile="0.95"} 1.2
nlp_query_duration_seconds{language="zh",intent="search",quantile="0.99"} 2.0

# 意图识别准确率
nlp_intent_accuracy_ratio{language="zh"} 0.95

# 实体提取准确率
nlp_entity_extraction_accuracy_ratio{language="zh"} 0.92

# 查询成功率
nlp_query_success_ratio{language="zh"} 0.98

# 缓存命中率
nlp_cache_hit_ratio{cache_type="query"} 0.65
nlp_cache_hit_ratio{cache_type="llm"} 0.40

# 用户反馈
nlp_user_feedback_total{feedback="thumbs_up"} 850
nlp_user_feedback_total{feedback="thumbs_down"} 50
```

**LLM指标**:
```
# LLM调用总数
nlp_llm_calls_total{provider="openai",model="gpt-4"} 500

# LLM调用延迟
nlp_llm_duration_seconds{provider="openai",model="gpt-4",quantile="0.95"} 0.8

# LLM调用成功率
nlp_llm_success_ratio{provider="openai",model="gpt-4"} 0.99

# LLM Token使用量
nlp_llm_tokens_total{provider="openai",model="gpt-4",type="prompt"} 500000
nlp_llm_tokens_total{provider="openai",model="gpt-4",type="completion"} 300000

# LLM成本
nlp_llm_cost_dollars{provider="openai",model="gpt-4"} 24.0
```

**系统指标**:
```
# CPU使用率
process_cpu_usage_percent 45.2

# 内存使用量
process_memory_usage_bytes 2147483648

# Goroutine数量
go_goroutines 150

# GC暂停时间
go_gc_pause_seconds{quantile="0.99"} 0.005
```

### 10.2 告警规则（支持热更新）

**告警规则支持热更新**，通过配置中心管理，无需重启Prometheus。

**内置告警规则**:

| 告警名称 | 表达式 | 持续时间 | 严重级别 | 说明 | 热更新 |
|---------|--------|---------|---------|------|--------|
| NLPQueryLatencyHigh | histogram_quantile(0.95, nlp_query_duration_seconds) > 3 | 5m | warning | 查询延迟过高 | ✅ 支持 |
| NLPQuerySuccessRateLow | nlp_query_success_ratio < 0.95 | 5m | critical | 查询成功率过低 | ✅ 支持 |
| LLMCallFailureRateHigh | rate(nlp_llm_calls_total{status="error"}[5m]) / rate(nlp_llm_calls_total[5m]) > 0.1 | 5m | warning | LLM调用失败率过高 | ✅ 支持 |
| LLMCostHigh | increase(nlp_llm_cost_dollars[1h]) > 10 | - | warning | LLM成本过高 | ✅ 支持 |
| CacheHitRateLow | nlp_cache_hit_ratio{cache_type="query"} < 0.5 | 10m | warning | 缓存命中率过低 | ✅ 支持 |
| IntentAccuracyLow | nlp_intent_accuracy_ratio < 0.8 | 10m | warning | 意图识别准确率过低 | ✅ 支持 |
| SessionMemoryHigh | nlp_session_memory_bytes > 1073741824 | 5m | warning | 会话内存占用过高 | ✅ 支持 |

**告警规则热更新实现**:

```go
// AlertRuleManager 告警规则管理器
type AlertRuleManager struct {
    db              *sql.DB
    redis           *redis.Client
    prometheusURL   string
    rules           atomic.Value  // []*AlertRule
    pubsub          *redis.PubSub
    mu              sync.RWMutex
}

// AlertRule 告警规则
type AlertRule struct {
    ID          string            `json:"id" db:"id"`
    Name        string            `json:"name" db:"name"`
    Category    string            `json:"category" db:"category"`  // nlp/llm/cache/system
    Expression  string            `json:"expression" db:"expression"`
    Duration    string            `json:"duration" db:"duration"`
    Severity    string            `json:"severity" db:"severity"`  // critical/warning/info
    Annotations map[string]string `json:"annotations" db:"annotations"`
    Labels      map[string]string `json:"labels" db:"labels"`
    Enabled     bool              `json:"enabled" db:"enabled"`
    CreatedAt   time.Time         `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time         `json:"updated_at" db:"updated_at"`
    CreatedBy   string            `json:"created_by" db:"created_by"`
    Version     int               `json:"version" db:"version"`
}

// NewAlertRuleManager 创建告警规则管理器
func NewAlertRuleManager(db *sql.DB, redis *redis.Client, prometheusURL string) *AlertRuleManager {
    arm := &AlertRuleManager{
        db:            db,
        redis:         redis,
        prometheusURL: prometheusURL,
    }
    return arm
}

// Start 启动告警规则管理器
func (arm *AlertRuleManager) Start() error {
    log.Info("启动告警规则管理器")
    
    // 1. 从PostgreSQL加载告警规则
    rules, err := arm.loadRulesFromDB()
    if err != nil {
        log.Warnf("从数据库加载告警规则失败: %v，尝试从YAML加载", err)
        // 如果数据库加载失败，从YAML文件加载默认规则
        rules, err = arm.loadRulesFromYAML()
        if err != nil {
            return fmt.Errorf("加载告警规则失败: %w", err)
        }
    }
    
    // 2. 同步到Redis
    if err := arm.syncRulesToRedis(rules); err != nil {
        log.Warnf("同步告警规则到Redis失败: %v", err)
    }
    
    // 3. 同步到Prometheus
    if err := arm.syncToPrometheus(rules); err != nil {
        log.Warnf("同步告警规则到Prometheus失败: %v", err)
    }
    
    // 4. 订阅配置变更
    arm.pubsub = arm.redis.Subscribe(context.Background(), "config:nlp:alert_rules:reload")
    go arm.watchRuleChanges()
    
    log.Info("告警规则管理器已启动")
    return nil
}

// watchRuleChanges 监听告警规则变更
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

// validateRules 验证告警规则
func (arm *AlertRuleManager) validateRules(rules []*AlertRule) error {
    for _, rule := range rules {
        // 验证表达式语法
        if err := arm.validateExpression(rule.Expression); err != nil {
            return fmt.Errorf("规则 %s 表达式无效: %w", rule.Name, err)
        }
        
        // 验证持续时间格式
        if rule.Duration != "" {
            if _, err := time.ParseDuration(rule.Duration); err != nil {
                return fmt.Errorf("规则 %s 持续时间格式无效: %w", rule.Name, err)
            }
        }
        
        // 验证严重级别
        validSeverities := []string{"critical", "warning", "info"}
        if !contains(validSeverities, rule.Severity) {
            return fmt.Errorf("规则 %s 严重级别无效: %s", rule.Name, rule.Severity)
        }
    }
    return nil
}

// syncToPrometheus 同步到Prometheus
func (arm *AlertRuleManager) syncToPrometheus(rules []*AlertRule) error {
    // 生成Prometheus告警规则配置
    promConfig := arm.generatePrometheusConfig(rules)
    
    // 通过Prometheus API更新规则
    url := fmt.Sprintf("%s/-/reload", arm.prometheusURL)
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(promConfig))
    if err != nil {
        return fmt.Errorf("同步到Prometheus失败: %w", err)
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return fmt.Errorf("Prometheus返回错误状态码: %d", resp.StatusCode)
    }
    
    log.Info("告警规则已同步到Prometheus")
    return nil
}

// generatePrometheusConfig 生成Prometheus配置
func (arm *AlertRuleManager) generatePrometheusConfig(rules []*AlertRule) []byte {
    config := map[string]interface{}{
        "groups": []map[string]interface{}{
            {
                "name":     "nlp_alerts",
                "interval": "30s",
                "rules":    arm.convertToPrometheusRules(rules),
            },
        },
    }
    
    data, _ := yaml.Marshal(config)
    return data
}

// CreateOrUpdateRule 创建或更新规则（API调用）
func (arm *AlertRuleManager) CreateOrUpdateRule(ctx context.Context, rule *AlertRule) error {
    log.Infof("创建/更新告警规则: %s", rule.Name)
    
    // 验证规则
    if err := arm.validateRules([]*AlertRule{rule}); err != nil {
        return err
    }
    
    // 保存到数据库
    if rule.ID == "" {
        // 创建新规则
        rule.ID = generateID()
        rule.CreatedAt = time.Now()
        rule.Version = 1
        
        _, err := arm.db.ExecContext(ctx, `
            INSERT INTO nlp_alert_rules 
            (id, name, category, expression, duration, severity, annotations, labels, enabled, created_at, updated_at, created_by, version)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, rule.ID, rule.Name, rule.Category, rule.Expression, rule.Duration, rule.Severity,
            rule.Annotations, rule.Labels, rule.Enabled, rule.CreatedAt, rule.UpdatedAt, rule.CreatedBy, rule.Version)
        
        if err != nil {
            return fmt.Errorf("创建告警规则失败: %w", err)
        }
    } else {
        // 更新现有规则
        rule.UpdatedAt = time.Now()
        rule.Version++
        
        _, err := arm.db.ExecContext(ctx, `
            UPDATE nlp_alert_rules 
            SET name=$2, category=$3, expression=$4, duration=$5, severity=$6, 
                annotations=$7, labels=$8, enabled=$9, updated_at=$10, version=$11
            WHERE id=$1
        `, rule.ID, rule.Name, rule.Category, rule.Expression, rule.Duration, rule.Severity,
            rule.Annotations, rule.Labels, rule.Enabled, rule.UpdatedAt, rule.Version)
        
        if err != nil {
            return fmt.Errorf("更新告警规则失败: %w", err)
        }
    }
    
    // 同步到Redis
    ruleJSON, _ := json.Marshal(rule)
    arm.redis.HSet(ctx, "nlp:alert_rules", rule.ID, ruleJSON)
    
    // 发布变更通知
    arm.redis.Publish(ctx, "config:nlp:alert_rules:reload", rule.Version)
    
    log.Infof("告警规则已更新: %s, version=%d", rule.Name, rule.Version)
    return nil
}

// DeleteRule 删除规则
func (arm *AlertRuleManager) DeleteRule(ctx context.Context, ruleID string) error {
    log.Infof("删除告警规则: %s", ruleID)
    
    // 删除数据库记录
    _, err := arm.db.ExecContext(ctx, "DELETE FROM nlp_alert_rules WHERE id=$1", ruleID)
    if err != nil {
        return fmt.Errorf("删除告警规则失败: %w", err)
    }
    
    // 删除Redis记录
    arm.redis.HDel(ctx, "nlp:alert_rules", ruleID)
    
    // 发布变更通知
    arm.redis.Publish(ctx, "config:nlp:alert_rules:reload", time.Now().Unix())
    
    log.Infof("告警规则已删除: %s", ruleID)
    return nil
}

// ToggleRule 启用/禁用规则
func (arm *AlertRuleManager) ToggleRule(ctx context.Context, ruleID string, enabled bool) error {
    log.Infof("切换告警规则状态: %s, enabled=%v", ruleID, enabled)
    
    // 更新数据库
    _, err := arm.db.ExecContext(ctx, `
        UPDATE nlp_alert_rules SET enabled=$2, updated_at=$3, version=version+1 WHERE id=$1
    `, ruleID, enabled, time.Now())
    
    if err != nil {
        return fmt.Errorf("更新告警规则状态失败: %w", err)
    }
    
    // 更新Redis
    ruleJSON, _ := arm.redis.HGet(ctx, "nlp:alert_rules", ruleID).Result()
    var rule AlertRule
    json.Unmarshal([]byte(ruleJSON), &rule)
    rule.Enabled = enabled
    rule.UpdatedAt = time.Now()
    rule.Version++
    
    updatedJSON, _ := json.Marshal(rule)
    arm.redis.HSet(ctx, "nlp:alert_rules", ruleID, updatedJSON)
    
    // 发布变更通知
    arm.redis.Publish(ctx, "config:nlp:alert_rules:reload", time.Now().Unix())
    
    log.Infof("告警规则状态已更新: %s, enabled=%v", ruleID, enabled)
    return nil
}
```

**自定义告警规则API**:

```bash
# 1. 获取所有告警规则
curl "http://api/v1/nlp/alert-rules?category=llm&enabled=true" \
  -H "Authorization: Bearer $TOKEN"

# 2. 获取单个告警规则
curl "http://api/v1/nlp/alert-rules/NLPQueryLatencyHigh" \
  -H "Authorization: Bearer $TOKEN"

# 3. 创建自定义告警规则（热更新）
curl -X POST "http://api/v1/nlp/alert-rules" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CustomLLMTokensHigh",
    "category": "llm",
    "expression": "increase(nlp_llm_tokens_total[1h]) > 1000000",
    "duration": "5m",
    "severity": "warning",
    "annotations": {
      "summary": "LLM Token使用量过高",
      "description": "最近1小时Token使用量超过100万"
    },
    "labels": {
      "team": "nlp",
      "service": "nlp-service"
    },
    "enabled": true
  }'

# 4. 更新告警规则（热更新）
curl -X PUT "http://api/v1/nlp/alert-rules/CustomLLMTokensHigh" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expression": "increase(nlp_llm_tokens_total[1h]) > 2000000",
    "severity": "critical"
  }'

# 5. 启用/禁用告警规则（热更新）
curl -X PATCH "http://api/v1/nlp/alert-rules/CustomLLMTokensHigh/toggle" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"enabled": false}'

# 6. 删除告警规则（热更新）
curl -X DELETE "http://api/v1/nlp/alert-rules/CustomLLMTokensHigh" \
  -H "Authorization: Bearer $TOKEN"

# 7. 测试告警规则
curl -X POST "http://api/v1/nlp/alert-rules/CustomLLMTokensHigh/test" \
  -H "Authorization: Bearer $TOKEN"

# 8. 获取告警规则历史版本
curl "http://api/v1/nlp/alert-rules/CustomLLMTokensHigh/history" \
  -H "Authorization: Bearer $TOKEN"

# 9. 回滚告警规则到指定版本
curl -X POST "http://api/v1/nlp/alert-rules/CustomLLMTokensHigh/rollback" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"version": 3}'
```

**告警规则热更新流程**:

```
1. 用户通过API创建/更新告警规则
   ├─ POST/PUT /api/v1/nlp/alert-rules
   └─ 认证: 需要管理员权限

2. 规则验证
   ├─ 验证表达式语法（PromQL）
   ├─ 验证持续时间格式
   ├─ 验证严重级别
   └─ 验证失败 → 返回错误

3. 规则持久化
   ├─ 保存到PostgreSQL
   ├─ 记录规则版本
   ├─ 保存历史版本
   └─ 同步到Redis

4. 发布变更通知
   ├─ 发布到Redis频道: config:nlp:alert_rules:reload
   └─ 所有NLP服务实例订阅该频道

5. 各实例接收通知
   ├─ 从Redis加载新规则
   ├─ 验证规则有效性
   ├─ 生成Prometheus配置
   └─ 同步到Prometheus

6. Prometheus重新加载规则
   ├─ 调用Prometheus /-/reload API
   ├─ Prometheus验证规则
   └─ 规则生效

7. 验证规则生效
   ├─ 检查Prometheus规则列表
   ├─ 测试规则触发
   └─ 记录变更审计日志

8. 规则生效时间
   ├─ 规则更新: < 1秒
   ├─ 通知传播: < 1秒
   ├─ Prometheus重载: < 5秒
   └─ 总计: < 10秒
```

**告警规则数据库表**:

```sql
-- 告警规则表
CREATE TABLE nlp_alert_rules (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL,  -- nlp/llm/cache/system
    expression TEXT NOT NULL,
    duration VARCHAR(20),
    severity VARCHAR(20) NOT NULL,  -- critical/warning/info
    annotations JSONB,
    labels JSONB,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by VARCHAR(64),
    version INTEGER DEFAULT 1,
    INDEX idx_category (category),
    INDEX idx_enabled (enabled),
    INDEX idx_created_at (created_at)
);

-- 告警规则历史表
CREATE TABLE nlp_alert_rule_history (
    id BIGSERIAL PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    expression TEXT NOT NULL,
    duration VARCHAR(20),
    severity VARCHAR(20) NOT NULL,
    annotations JSONB,
    labels JSONB,
    enabled BOOLEAN,
    version INTEGER,
    changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    changed_by VARCHAR(64),
    change_type VARCHAR(20),  -- create/update/delete/toggle
    INDEX idx_rule_id (rule_id),
    INDEX idx_changed_at (changed_at)
);

-- 告警触发记录表
CREATE TABLE nlp_alert_triggers (
    id BIGSERIAL PRIMARY KEY,
    rule_id VARCHAR(64) NOT NULL,
    rule_name VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,  -- firing/resolved
    value FLOAT,
    labels JSONB,
    annotations JSONB,
    started_at TIMESTAMP NOT NULL,
    resolved_at TIMESTAMP,
    notified BOOLEAN DEFAULT false,
    INDEX idx_rule_id (rule_id),
    INDEX idx_status (status),
    INDEX idx_started_at (started_at)
);
```

### 10.3 日志规范

**日志格式**:
```json
{
  "timestamp": "2026-01-31T10:00:00.123Z",
  "level": "INFO",
  "service": "nlp-service",
  "trace_id": "abc123",
  "span_id": "def456",
  "message": "Query processed successfully",
  "query_id": "query-67890",
  "user_id": "user-12345",
  "intent": "search",
  "latency_ms": 1250,
  "llm_provider": "openai",
  "llm_tokens": 1000,
  "cache_hit": true
}
```

**日志级别**:
- DEBUG: 详细的调试信息（开发环境）
- INFO: 正常的业务日志（查询处理、LLM调用）
- WARN: 警告信息（LLM调用慢、缓存未命中）
- ERROR: 错误信息（查询失败、LLM调用失败）
- FATAL: 致命错误（服务启动失败）

### 10.4 运维手册

**常见问题处理**:

1. **LLM调用失败**
   ```bash
   # 检查LLM配置
   kubectl get configmap nlp-config -o yaml
   
   # 检查API Key
   kubectl get secret nlp-secrets -o yaml
   
   # 切换到备用LLM提供商
   kubectl edit configmap nlp-config
   # 修改 llm_provider: claude
   
   # 重启服务
   kubectl rollout restart deployment nlp-service
   ```

2. **查询延迟过高**
   ```bash
   # 检查Redis连接
   kubectl exec -it redis-0 -- redis-cli ping
   
   # 检查缓存命中率
   curl http://nlp-service:8080/metrics | grep cache_hit_ratio
   
   # 扩容服务
   kubectl scale deployment nlp-service --replicas=5
   ```

3. **内存占用过高**
   ```bash
   # 检查内存使用
   kubectl top pod -l app=nlp-service
   
   # 查看内存泄漏
   kubectl exec -it nlp-service-xxx -- curl http://localhost:6060/debug/pprof/heap
   
   # 重启Pod
   kubectl delete pod nlp-service-xxx
   ```

4. **配置热更新**
   ```bash
   # 更新配置
   kubectl edit configmap nlp-config
   
   # 触发热更新（通过Redis Pub/Sub）
   kubectl exec -it redis-0 -- redis-cli PUBLISH config:nlp:reload "reload"
   
   # 验证配置生效
   curl http://nlp-service:8080/api/v1/nlp/config
   ```



---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

| 配置项 | 类型 | 默认值 | 说明 | 热更新方式 |
|--------|------|--------|------|-----------|
| nlp_enabled | bool | false | 是否启用NLP功能 | Redis Pub/Sub |
| llm_provider | string | none | LLM提供商（openai/claude/local/none） | Redis Pub/Sub |
| llm_model | string | gpt-4 | LLM模型名称 | Redis Pub/Sub |
| llm_api_key | string | - | LLM API密钥（加密存储） | Redis Pub/Sub |
| llm_endpoint | string | - | LLM API端点（自定义） | Redis Pub/Sub |
| temperature | float | 0.1 | LLM温度参数 | Redis Pub/Sub |
| max_tokens | int | 1000 | LLM最大tokens | Redis Pub/Sub |
| timeout | int | 10 | LLM调用超时（秒） | Redis Pub/Sub |
| enable_cache | bool | true | 是否启用缓存 | Redis Pub/Sub |
| cache_ttl | int | 300 | 缓存TTL（秒） | Redis Pub/Sub |
| time_patterns | array | [] | 时间表达式模式 | Redis Pub/Sub |
| level_mappings | map | {} | 日志级别映射 | Redis Pub/Sub |
| service_mappings | array | [] | 服务名称映射 | Redis Pub/Sub |
| enable_summary | bool | true | 是否启用智能总结 | Redis Pub/Sub |
| enable_suggestions | bool | true | 是否启用查询建议 | Redis Pub/Sub |
| max_history | int | 10 | 会话最大历史记录数 | Redis Pub/Sub |
| session_ttl | int | 1800 | 会话TTL（秒） | Redis Pub/Sub |
| **alert_rules** | **array** | **[]** | **告警规则列表** | **Redis Pub/Sub** |
| **alert_enabled** | **bool** | **true** | **是否启用告警** | **Redis Pub/Sub** |
| **alert_channels** | **array** | **[]** | **告警通道配置** | **Redis Pub/Sub** |

### 11.2 热更新实现

**配置管理器**:
```go
// ConfigManager 配置管理器
type ConfigManager struct {
    config      atomic.Value  // 当前配置
    redis       *redis.Client
    db          *sql.DB
    subscribers []chan *NLPConfig
    mu          sync.RWMutex
}

// NewConfigManager 创建配置管理器
func NewConfigManager(redis *redis.Client, db *sql.DB) *ConfigManager {
    cm := &ConfigManager{
        redis:       redis,
        db:          db,
        subscribers: make([]chan *NLPConfig, 0),
    }
    
    // 加载初始配置
    config, err := cm.loadConfigFromDB()
    if err != nil {
        log.Fatal("Failed to load config", err)
    }
    cm.config.Store(config)
    
    // 订阅配置变更
    go cm.subscribeConfigChanges()
    
    return cm
}

// GetConfig 获取当前配置
func (cm *ConfigManager) GetConfig() *NLPConfig {
    return cm.config.Load().(*NLPConfig)
}

// UpdateConfig 更新配置
func (cm *ConfigManager) UpdateConfig(ctx context.Context, newConfig *NLPConfig) error {
    // 验证配置
    if err := cm.validateConfig(newConfig); err != nil {
        return fmt.Errorf("invalid config: %w", err)
    }
    
    // 保存到数据库
    if err := cm.saveConfigToDB(ctx, newConfig); err != nil {
        return fmt.Errorf("failed to save config: %w", err)
    }
    
    // 发布配置变更通知
    configJSON, err := json.Marshal(newConfig)
    if err != nil {
        return fmt.Errorf("failed to marshal config: %w", err)
    }
    
    err = cm.redis.Publish(ctx, "config:nlp:reload", configJSON).Err()
    if err != nil {
        return fmt.Errorf("failed to publish config change: %w", err)
    }
    
    log.Info("Config updated and published", "config_id", newConfig.ID)
    return nil
}

// subscribeConfigChanges 订阅配置变更
func (cm *ConfigManager) subscribeConfigChanges() {
    pubsub := cm.redis.Subscribe(context.Background(), "config:nlp:reload")
    defer pubsub.Close()
    
    ch := pubsub.Channel()
    
    for msg := range ch {
        log.Info("Received config change notification")
        
        // 解析新配置
        var newConfig NLPConfig
        if err := json.Unmarshal([]byte(msg.Payload), &newConfig); err != nil {
            log.Error("Failed to unmarshal config", err)
            continue
        }
        
        // 验证配置
        if err := cm.validateConfig(&newConfig); err != nil {
            log.Error("Invalid config", err)
            continue
        }
        
        // 原子更新配置
        oldConfig := cm.config.Load().(*NLPConfig)
        cm.config.Store(&newConfig)
        
        log.Info("Config updated successfully",
            "old_provider", oldConfig.LLMProvider,
            "new_provider", newConfig.LLMProvider,
            "old_model", oldConfig.LLMModel,
            "new_model", newConfig.LLMModel)
        
        // 通知订阅者
        cm.notifySubscribers(&newConfig)
        
        // 记录审计日志
        cm.logConfigChange(oldConfig, &newConfig)
    }
}

// validateConfig 验证配置
func (cm *ConfigManager) validateConfig(config *NLPConfig) error {
    // 验证LLM提供商
    validProviders := []string{"openai", "claude", "local", "none"}
    if !contains(validProviders, config.LLMProvider) {
        return fmt.Errorf("invalid llm_provider: %s", config.LLMProvider)
    }
    
    // 验证温度参数
    if config.Temperature < 0 || config.Temperature > 1 {
        return fmt.Errorf("temperature must be between 0 and 1")
    }
    
    // 验证最大tokens
    if config.MaxTokens < 100 || config.MaxTokens > 10000 {
        return fmt.Errorf("max_tokens must be between 100 and 10000")
    }
    
    // 验证超时时间
    if config.Timeout < 1 || config.Timeout > 60 {
        return fmt.Errorf("timeout must be between 1 and 60 seconds")
    }
    
    // 如果启用LLM，必须提供API Key
    if config.LLMProvider != "none" && config.LLMProvider != "local" {
        if config.LLMAPIKey == "" {
            return fmt.Errorf("llm_api_key is required when llm_provider is %s", config.LLMProvider)
        }
    }
    
    return nil
}

// Subscribe 订阅配置变更
func (cm *ConfigManager) Subscribe() <-chan *NLPConfig {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    ch := make(chan *NLPConfig, 1)
    cm.subscribers = append(cm.subscribers, ch)
    
    return ch
}

// notifySubscribers 通知订阅者
func (cm *ConfigManager) notifySubscribers(config *NLPConfig) {
    cm.mu.RLock()
    defer cm.mu.RUnlock()
    
    for _, ch := range cm.subscribers {
        select {
        case ch <- config:
        default:
            // 非阻塞发送
        }
    }
}
```

**LLM客户端热更新**:
```go
// LLMClientManager LLM客户端管理器
type LLMClientManager struct {
    client atomic.Value  // 当前LLM客户端
    config *ConfigManager
}

// NewLLMClientManager 创建LLM客户端管理器
func NewLLMClientManager(config *ConfigManager) *LLMClientManager {
    manager := &LLMClientManager{
        config: config,
    }
    
    // 创建初始客户端
    client := manager.createClient(config.GetConfig())
    manager.client.Store(client)
    
    // 订阅配置变更
    go manager.watchConfigChanges()
    
    return manager
}

// GetClient 获取当前LLM客户端
func (m *LLMClientManager) GetClient() LLMClient {
    return m.client.Load().(LLMClient)
}

// watchConfigChanges 监听配置变更
func (m *LLMClientManager) watchConfigChanges() {
    configCh := m.config.Subscribe()
    
    for newConfig := range configCh {
        log.Info("LLM config changed, recreating client",
            "provider", newConfig.LLMProvider,
            "model", newConfig.LLMModel)
        
        // 创建新客户端
        newClient := m.createClient(newConfig)
        
        // 原子更新客户端
        oldClient := m.client.Load().(LLMClient)
        m.client.Store(newClient)
        
        // 关闭旧客户端（延迟关闭，等待正在进行的请求完成）
        go func() {
            time.Sleep(30 * time.Second)
            if closer, ok := oldClient.(io.Closer); ok {
                closer.Close()
            }
        }()
        
        log.Info("LLM client updated successfully")
    }
}

// createClient 创建LLM客户端
func (m *LLMClientManager) createClient(config *NLPConfig) LLMClient {
    switch config.LLMProvider {
    case "openai":
        return NewOpenAIClient(config)
    case "claude":
        return NewClaudeClient(config)
    case "local":
        return NewLocalModelClient(config)
    default:
        return NewNoOpClient()
    }
}
```

### 11.3 热更新流程

```
1. 用户通过API更新配置
   ├─ POST /api/v1/nlp/config
   ├─ 请求体: 新配置JSON
   └─ 认证: 需要管理员权限

2. 配置验证
   ├─ 验证配置格式
   ├─ 验证配置值范围
   ├─ 验证必填字段
   └─ 验证失败 → 返回错误，保持原配置

3. 配置持久化
   ├─ 保存到PostgreSQL
   ├─ 记录配置版本
   └─ 记录更新人和更新时间

4. 发布配置变更通知
   ├─ 序列化新配置为JSON
   ├─ 发布到Redis频道: config:nlp:reload
   └─ 所有NLP服务实例订阅该频道

5. 各实例接收通知
   ├─ 解析新配置
   ├─ 验证配置有效性
   ├─ 原子更新内存配置（atomic.Value）
   └─ 通知内部订阅者

6. 组件响应配置变更
   ├─ LLM客户端: 重新创建客户端
   ├─ 缓存管理器: 更新缓存TTL
   ├─ 时间解析器: 重新加载时间模式
   └─ 实体提取器: 重新加载映射规则

7. 验证配置生效
   ├─ 检查配置版本号
   ├─ 检查LLM客户端类型
   ├─ 测试查询功能
   └─ 记录配置变更审计日志

8. 配置生效时间
   ├─ 配置更新: < 1秒
   ├─ 通知传播: < 1秒
   ├─ 客户端重建: < 5秒
   └─ 总计: < 10秒
```

### 11.4 配置回滚

**自动回滚**:
```go
// ConfigRollback 配置回滚
func (cm *ConfigManager) Rollback(ctx context.Context) error {
    // 获取上一个配置版本
    previousConfig, err := cm.getPreviousConfig(ctx)
    if err != nil {
        return fmt.Errorf("failed to get previous config: %w", err)
    }
    
    log.Warn("Rolling back to previous config",
        "previous_version", previousConfig.Version)
    
    // 更新配置（触发热更新）
    return cm.UpdateConfig(ctx, previousConfig)
}

// 监控配置变更后的指标
func (cm *ConfigManager) monitorConfigChange(oldConfig, newConfig *NLPConfig) {
    go func() {
        time.Sleep(5 * time.Minute)
        
        // 检查错误率
        errorRate := cm.getErrorRate()
        if errorRate > 0.1 {
            log.Error("Error rate increased after config change, rolling back",
                "error_rate", errorRate)
            cm.Rollback(context.Background())
            return
        }
        
        // 检查延迟
        latency := cm.getP95Latency()
        if latency > 5*time.Second {
            log.Error("Latency increased after config change, rolling back",
                "p95_latency", latency)
            cm.Rollback(context.Background())
            return
        }
        
        log.Info("Config change validated successfully")
    }()
}
```

### 11.5 验收标准

**功能验收**:
- ✅ 配置更新后10秒内所有实例生效
- ✅ 配置验证失败时保持原配置不变
- ✅ 支持配置回滚到上一版本
- ✅ 配置变更不影响正在进行的查询
- ✅ 配置变更记录审计日志
- ✅ **告警规则更新后10秒内Prometheus生效**
- ✅ **支持自定义告警规则创建、更新、删除**
- ✅ **告警规则支持启用/禁用切换**
- ✅ **告警规则支持版本管理和回滚**
- ✅ **告警规则验证失败时保持原规则不变**

**性能验收**:
- ✅ 配置更新延迟 < 10秒
- ✅ 配置更新不导致服务中断
- ✅ 配置更新不导致内存泄漏
- ✅ 配置更新不导致性能下降
- ✅ **告警规则更新延迟 < 10秒**
- ✅ **告警规则更新不影响现有告警**

**安全验收**:
- ✅ 配置更新需要管理员权限
- ✅ API Key加密存储
- ✅ 配置变更记录审计日志
- ✅ 敏感配置不在日志中明文显示
- ✅ **告警规则更新需要管理员权限**
- ✅ **告警规则变更记录审计日志**

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| LLM API不可用 | 中 | 高 | 降级到规则引擎，支持多LLM提供商 |
| LLM成本超预算 | 中 | 中 | 设置成本告警，启用缓存，限制调用频率 |
| 意图识别准确率低 | 低 | 中 | 持续优化规则，收集用户反馈，模型微调 |
| 查询延迟过高 | 低 | 中 | 启用缓存，异步处理，优化LLM调用 |
| 数据隐私泄露 | 低 | 高 | 数据脱敏，本地模型（Phase 3），审计日志 |
| Prompt注入攻击 | 低 | 中 | 输入验证，输出验证，安全审计 |
| 配置错误导致服务异常 | 低 | 高 | 配置验证，自动回滚，灰度发布 |

### 12.2 回滚方案

**LLM提供商切换回滚**:
```bash
# 场景：切换到新LLM提供商后发现问题

# 1. 通过API回滚配置
curl -X PUT http://nlp-service:8080/api/v1/nlp/config \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "llm_provider": "openai",
    "llm_model": "gpt-4"
  }'

# 2. 验证配置生效
curl http://nlp-service:8080/api/v1/nlp/config

# 3. 测试查询功能
curl -X POST http://nlp-service:8080/api/v1/nlp/query \
  -d '{"query": "查找最近1小时的错误日志"}'

# 4. 监控指标恢复
# 检查错误率、延迟、成功率
```

**服务版本回滚**:
```bash
# 场景：新版本部署后发现严重问题

# 1. 回滚到上一版本
kubectl rollout undo deployment nlp-service

# 2. 检查回滚状态
kubectl rollout status deployment nlp-service

# 3. 验证服务正常
kubectl get pods -l app=nlp-service

# 4. 测试功能
curl http://nlp-service:8080/health
```

**数据库回滚**:
```sql
-- 场景：配置表结构变更导致问题

-- 1. 恢复配置表快照
BEGIN;

-- 备份当前配置
CREATE TABLE nlp_config_backup AS SELECT * FROM nlp_config;

-- 恢复到上一版本
DELETE FROM nlp_config;
INSERT INTO nlp_config SELECT * FROM nlp_config_history 
WHERE version = (SELECT MAX(version) - 1 FROM nlp_config_history);

COMMIT;

-- 2. 触发配置热更新
-- 通过Redis发布配置变更通知
```

### 12.3 应急预案

**LLM服务完全不可用**:
```
1. 检测到LLM调用失败率 > 50%
2. 自动切换到降级模式
   ├─ 禁用LLM调用
   ├─ 使用规则引擎处理查询
   ├─ 禁用智能总结功能
   └─ 禁用智能告警描述
3. 通知运维团队
4. 用户提示: "智能分析功能暂时不可用"
5. 监控LLM服务恢复
6. 服务恢复后自动切换回正常模式
```

**查询延迟过高**:
```
1. 检测到P95延迟 > 5秒
2. 启用紧急优化措施
   ├─ 增加缓存TTL（5分钟 → 30分钟）
   ├─ 降低LLM温度（提高缓存命中率）
   ├─ 限制LLM最大tokens（1000 → 500）
   ├─ 禁用智能总结（可选）
   └─ 扩容服务实例
3. 监控延迟变化
4. 延迟恢复后逐步恢复正常配置
```

**成本超预算**:
```
1. 检测到小时成本 > $10
2. 启用成本控制措施
   ├─ 增加缓存TTL（减少LLM调用）
   ├─ 限制每用户查询频率（10次/分钟）
   ├─ 切换到更便宜的LLM模型
   ├─ 禁用智能总结（可选）
   └─ 仅对VIP用户启用LLM
3. 通知财务团队
4. 分析成本异常原因
5. 调整成本控制策略
```

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| NLP | Natural Language Processing，自然语言处理 |
| LLM | Large Language Model，大语言模型 |
| Intent | 意图，用户查询的目的（搜索/统计/趋势/对比） |
| Entity | 实体，查询中的关键信息（时间/服务/级别等） |
| Prompt | 提示词，发送给LLM的输入文本 |
| Token | LLM处理的最小单位，约等于0.75个英文单词 |
| Temperature | 温度参数，控制LLM输出的随机性（0-1） |
| Embedding | 向量嵌入，将文本转换为数值向量 |
| Fine-tuning | 微调，在预训练模型基础上针对特定任务训练 |
| ONNX | Open Neural Network Exchange，开放神经网络交换格式 |
| Prompt Injection | Prompt注入，通过特殊输入操纵LLM行为的攻击 |

### 13.2 参考文档

**LLM API文档**:
- OpenAI API: https://platform.openai.com/docs/api-reference
- Anthropic Claude API: https://docs.anthropic.com/claude/reference
- Azure OpenAI: https://learn.microsoft.com/azure/ai-services/openai/

**NLP库文档**:
- jieba中文分词: https://github.com/fxsjy/jieba
- spaCy: https://spacy.io/
- Transformers: https://huggingface.co/docs/transformers

**相关标准**:
- ISO/IEC 24765: 软件工程术语
- RFC 3339: 日期和时间格式
- JSON Schema: JSON数据验证

**内部文档**:
- [模块11设计文档](./design-module11.md) - 智能日志分析
- [模块20设计文档](./design-module20.md) - ML/AI机器学习框架
- [API设计文档](./api-design.md) - 统一API规范

### 13.3 不推荐热更新的配置说明

虽然模块21的大部分配置都支持热更新，但以下配置不推荐使用热更新：

| 配置项 | 不推荐原因 | 推荐更新方式 |
|--------|-----------|-------------|
| 无 | 模块21所有配置都适合热更新 | - |

**说明**：
- NLP模块的所有配置都是运行时可变的，不涉及底层连接池或系统资源重建
- LLM客户端切换通过延迟关闭旧客户端的方式，确保平滑过渡
- 告警规则更新通过Redis Pub/Sub实时推送，无需重启服务
- 所有配置变更都经过验证，失败时自动保持原配置

### 13.4 配置热更新扩展接口

**扩展接口定义**:
```go
// ConfigHook 配置变更钩子接口
type ConfigHook interface {
    // OnConfigChange 配置变更时调用
    OnConfigChange(oldConfig, newConfig *NLPConfig) error
    
    // OnConfigValidate 配置验证时调用
    OnConfigValidate(config *NLPConfig) error
    
    // OnConfigRollback 配置回滚时调用
    OnConfigRollback(config *NLPConfig) error
}

// RegisterConfigHook 注册配置钩子
func (cm *ConfigManager) RegisterConfigHook(hook ConfigHook) {
    cm.hooks = append(cm.hooks, hook)
}

// 使用示例：自定义LLM提供商
type CustomLLMHook struct {
    client *CustomLLMClient
}

func (h *CustomLLMHook) OnConfigChange(oldConfig, newConfig *NLPConfig) error {
    if newConfig.LLMProvider == "custom" {
        // 创建自定义LLM客户端
        h.client = NewCustomLLMClient(newConfig.LLMEndpoint, newConfig.LLMAPIKey)
        log.Info("Custom LLM client created")
    }
    return nil
}

func (h *CustomLLMHook) OnConfigValidate(config *NLPConfig) error {
    if config.LLMProvider == "custom" {
        // 验证自定义配置
        if config.LLMEndpoint == "" {
            return fmt.Errorf("llm_endpoint is required for custom provider")
        }
    }
    return nil
}

func (h *CustomLLMHook) OnConfigRollback(config *NLPConfig) error {
    // 清理资源
    if h.client != nil {
        h.client.Close()
    }
    return nil
}
```

**扩展点说明**:

| 扩展点 | 用途 | 使用场景 |
|--------|------|----------|
| ConfigHook | 配置变更钩子 | 自定义LLM提供商、自定义实体提取器、自定义缓存策略 |
| LLMClient接口 | 自定义LLM客户端 | 接入新的LLM提供商、本地模型、私有化部署 |
| EntityExtractor接口 | 自定义实体提取器 | 特定领域实体识别、自定义NER模型 |
| QueryGenerator接口 | 自定义查询生成器 | 支持新的存储引擎、自定义查询语法 |
| CacheProvider接口 | 自定义缓存提供商 | 使用其他缓存系统（Memcached/本地缓存） |

**扩展接口完整示例**:
```go
// 1. 自定义LLM客户端接口
type LLMClient interface {
    // Query 发送查询到LLM
    Query(ctx context.Context, prompt string, options *QueryOptions) (*LLMResponse, error)
    
    // Stream 流式查询
    Stream(ctx context.Context, prompt string, options *QueryOptions) (<-chan string, error)
    
    // Close 关闭客户端
    Close() error
}

// 2. 自定义实体提取器接口
type EntityExtractor interface {
    // Extract 提取实体
    Extract(ctx context.Context, text string) (*ExtractedEntities, error)
    
    // AddPattern 添加提取模式
    AddPattern(entityType string, pattern *regexp.Regexp)
    
    // RemovePattern 移除提取模式
    RemovePattern(entityType string, patternID string)
}

// 3. 自定义查询生成器接口
type QueryGenerator interface {
    // Generate 生成查询
    Generate(ctx context.Context, intent *Intent, entities *ExtractedEntities) (interface{}, error)
    
    // Validate 验证生成的查询
    Validate(query interface{}) error
    
    // Optimize 优化查询
    Optimize(query interface{}) (interface{}, error)
}

// 4. 自定义缓存提供商接口
type CacheProvider interface {
    // Get 获取缓存
    Get(ctx context.Context, key string) (interface{}, error)
    
    // Set 设置缓存
    Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error
    
    // Delete 删除缓存
    Delete(ctx context.Context, key string) error
    
    // Clear 清空缓存
    Clear(ctx context.Context) error
}

// 扩展注册示例
func RegisterExtensions(nlpService *NLPService) {
    // 注册自定义LLM客户端
    nlpService.RegisterLLMClient("custom", func(config *NLPConfig) LLMClient {
        return NewCustomLLMClient(config)
    })
    
    // 注册自定义实体提取器
    nlpService.RegisterEntityExtractor("custom", func(config *NLPConfig) EntityExtractor {
        return NewCustomEntityExtractor(config)
    })
    
    // 注册自定义查询生成器
    nlpService.RegisterQueryGenerator("custom", func(config *NLPConfig) QueryGenerator {
        return NewCustomQueryGenerator(config)
    })
    
    // 注册自定义缓存提供商
    nlpService.RegisterCacheProvider("custom", func(config *NLPConfig) CacheProvider {
        return NewCustomCacheProvider(config)
    })
}
```

### 13.5 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |
| 2026-02-01 | v1.1 | 补充配置热更新扩展接口、不推荐热更新配置说明 | 系统架构团队 |

### 13.4 示例查询

**中文查询示例**:
```
1. 时间查询
   - "查找昨天的错误日志"
   - "最近1小时的警告日志"
   - "今天下午3点到5点的日志"
   - "上周一到周五的日志"

2. 服务查询
   - "支付服务的错误日志"
   - "订单服务最近有什么异常"
   - "用户服务的超时错误"

3. 统计查询
   - "统计今天的错误数量"
   - "按服务分组统计错误"
   - "错误率最高的前10个服务"

4. 趋势查询
   - "最近24小时的错误趋势"
   - "支付服务的错误率变化"
   - "预测明天的日志量"

5. 对比查询
   - "对比今天和昨天的错误数量"
   - "对比本周和上周的错误率"
   - "对比不同服务的错误分布"

6. 复杂查询
   - "查找支付服务昨天下午3点到5点之间的超时错误，按错误类型分组统计"
   - "对比支付服务和订单服务最近1小时的错误率，并显示趋势图"
```

**英文查询示例**:
```
1. Time queries
   - "Find error logs from yesterday"
   - "Show warnings from the last hour"
   - "Logs between 3pm and 5pm today"

2. Service queries
   - "Payment service error logs"
   - "Any anomalies in order service"
   - "User service timeout errors"

3. Statistical queries
   - "Count errors today"
   - "Group errors by service"
   - "Top 10 services by error rate"

4. Trend queries
   - "Error trend in last 24 hours"
   - "Payment service error rate changes"
   - "Predict tomorrow's log volume"

5. Comparison queries
   - "Compare errors today vs yesterday"
   - "Compare error rates this week vs last week"
   - "Compare error distribution across services"
```

### 13.5 最佳实践

**查询优化建议**:
1. 使用具体的时间范围（避免"很久以前"）
2. 指定服务名称（避免全局搜索）
3. 使用明确的日志级别（ERROR/WARN/INFO）
4. 善用缓存（相同查询5分钟内返回缓存）
5. 使用多轮对话细化查询（而非一次性复杂查询）

**LLM使用建议**:
1. 启用缓存减少重复调用
2. 设置合理的温度参数（0.1-0.3）
3. 限制最大tokens（500-1000）
4. 监控成本和调用频率
5. 准备降级方案（规则引擎）

**安全建议**:
1. 定期轮换API Key
2. 使用环境变量存储敏感配置
3. 启用审计日志
4. 验证用户输入
5. 脱敏敏感数据

---

**文档完成日期**: 2026-01-31  
**文档状态**: 已发布  
**下次评审日期**: 2026-02-28
