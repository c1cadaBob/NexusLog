# 模块二十一：NLP 自然语言处理

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块二十一：NLP 自然语言处理  
> **实施阶段**: Phase 2/Phase 3

---

## 模块概述

提供自然语言处理能力，支持自然语言查询、智能告警描述和查询意图理解等功能。

**模块技术栈**:
- MVP: 规则引擎 + 关键词匹配
- Phase 2: LLM API（OpenAI/Claude，可配置）
- Phase 3: 本地微调模型

**模块架构**:

```
┌─────────────────────────────────────────────────────────────┐
│                   NLP Query Engine                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  用户输入: "查找昨天下午3点到5点之间的所有错误日志"            │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   意图识别层                          │   │
│  │  - 时间解析: 昨天下午3点-5点 → timestamp range        │   │
│  │  - 级别识别: 错误 → level:ERROR                       │   │
│  │  - 操作识别: 查找 → search                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   查询生成层                          │   │
│  │  ES Query:                                            │   │
│  │  {                                                    │   │
│  │    "query": {                                         │   │
│  │      "bool": {                                        │   │
│  │        "must": [                                      │   │
│  │          {"term": {"level": "ERROR"}},                │   │
│  │          {"range": {"@timestamp": {...}}}             │   │
│  │        ]                                              │   │
│  │      }                                                │   │
│  │    }                                                  │   │
│  │  }                                                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 需求 21-1：自然语言查询引擎 [Phase 2]

**用户故事**: 

作为运维工程师，我希望能够使用自然语言描述查询意图，而不需要学习复杂的查询语法。

**验收标准**:

1. THE Engine SHALL 支持中英文自然语言输入
2. THE Engine SHALL 支持时间表达式解析（昨天、上周、最近1小时）
3. THE Engine SHALL 支持日志级别识别（错误、警告、信息）
4. THE Engine SHALL 支持服务/应用名称识别
5. THE Engine SHALL 支持查询建议和自动补全

**示例查询转换**:

| 自然语言 | 转换结果 |
|----------|----------|
| 最近1小时的错误日志 | `level:ERROR AND @timestamp:[now-1h TO now]` |
| 支付服务的超时错误 | `service:payment AND message:*timeout*` |
| 昨天用户登录失败次数 | `action:login AND status:failed` + 聚合 |

**实现方向**:

```go
// 时间表达式解析
type TimeParser struct {
    patterns map[string]func() (time.Time, time.Time)
}

func NewTimeParser() *TimeParser {
    return &TimeParser{
        patterns: map[string]func() (time.Time, time.Time){
            "最近1小时": func() (time.Time, time.Time) {
                now := time.Now()
                return now.Add(-1 * time.Hour), now
            },
            "昨天": func() (time.Time, time.Time) {
                now := time.Now()
                yesterday := now.AddDate(0, 0, -1)
                start := time.Date(yesterday.Year(), yesterday.Month(),
                    yesterday.Day(), 0, 0, 0, 0, yesterday.Location())
                end := start.AddDate(0, 0, 1)
                return start, end
            },
            // 更多模式...
        },
    }
}
```

---

## 需求 21-2：查询意图理解 [Phase 2]

**用户故事**: 

作为开发工程师，我希望系统能够理解我的查询意图，并提供智能建议。

**验收标准**:

1. THE System SHALL 识别查询类型（搜索、统计、趋势、对比）
2. THE System SHALL 自动推荐相关查询
3. THE System SHALL 支持多轮对话（追问细化）
4. THE System SHALL 支持查询历史学习

**实现方向**:

使用 LLM API 进行意图理解，结合规则引擎进行查询转换。

```go
// LLM 查询转换
type LLMQueryConverter struct {
    client *anthropic.Client
}

func (c *LLMQueryConverter) Convert(naturalQuery string) (*ESQuery, error) {
    prompt := fmt.Sprintf(`将以下自然语言查询转换为 Elasticsearch 查询:

用户查询: %s

请返回 JSON 格式的 ES 查询。`, naturalQuery)

    response, err := c.client.CreateMessage(prompt)
    // 解析响应...
}
```

---

## 需求 21-3：智能告警描述 [Phase 3]

**用户故事**: 

作为运维工程师，我希望告警能够自动生成人类可读的描述和根因分析，以便快速理解问题。

**验收标准**:

1. THE System SHALL 自动总结告警上下文
2. THE System SHALL 生成可能的根因分析
3. THE System SHALL 推荐处理建议
4. THE System SHALL 支持多语言输出

**实现方向**:

使用 LLM 生成告警描述和根因分析，结合历史数据提供处理建议。

---

## 配置热更新

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| nlp_enabled | bool | false | 是否启用 NLP |
| llm_provider | string | none | LLM 提供商（openai/claude/none） |
| llm_api_key | string | - | LLM API 密钥 |
| time_patterns | array | [] | 时间表达式模式 |

**热更新机制**:
- 更新方式: Redis Pub/Sub + API
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置

---

## 相关需求

- 需求 11: 智能日志分析（自然语言查询）
