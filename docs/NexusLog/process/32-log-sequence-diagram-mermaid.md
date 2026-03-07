# NexusLog Markdown 时序图（Mermaid 版）

## 文档目的

本文档用于以 **Markdown + Mermaid `sequenceDiagram`** 的方式，生成一套更接近“架构图片风格”的时序图，帮助快速理解 NexusLog 的完整日志链路：

- 日志生成 → Agent 采集 → Control-plane → ES 入库
- ES → Query API → 前端展示 → 告警评估
- 热 / 温 / 冷 / 归档 / 恢复在链路中的位置与触发时机

> 本文档只描述**文档视图**，不改任何运行时代码、接口或 ES 模板。  
> 如果图示与代码实现存在冲突，以代码和 `docs/NexusLog/process/31-log-end-to-end-lifecycle-and-uml.md` 为准。

---

## 使用说明

- 本文档所有图均使用 `Mermaid sequenceDiagram` 语法。
- 推荐在支持 Mermaid 的 Markdown 预览器中查看，例如 VS Code Mermaid Preview。
- 为兼容不同渲染器，参与者名称统一使用带引号的短标签，例如：`"Agent/采集代理"`。
- 图中采用 `== 阶段 x：... ==` 作为横向分隔，尽量模拟传统架构图里“按阶段阅读”的体验。
- 分支通过 `alt / else / end` 表示，周期性任务通过 `loop` 表示。

---

## 1. 全链路总图

> 这张图用于从全局视角展示 NexusLog 的完整日志主链路与存储生命周期，适合先整体浏览，再进入后面的两张分图。

```mermaid
sequenceDiagram
    autonumber
    actor App as "App/应用"
    participant Source as "Source/日志源"
    participant Agent as "Agent/采集代理"
    participant PullAPI as "PullAPI/拉取接口"
    participant CP as "CP/控制面"
    participant Norm as "Norm/归一化"
    participant ES as "ES/日志存储"
    participant Query as "Query/查询接口"
    participant UI as "UI/前端页面"
    participant Alert as "Alert/告警引擎"
    participant ILM as "ILM/生命周期"
    participant Snap as "Snap/快照仓库"
    participant Archive as "Archive/归档存储"

    Note over Agent: 负责采集、清洗、多行合并、第一层去重
    Note over CP,Norm: 负责调度、幂等、归一化、第二层语义去重
    Note over ES,Alert: 负责实时检索、规则评估、事件生成
    Note over ILM,Snap,Archive: 负责热温冷迁移、快照、长期归档与恢复

    == 阶段 1：日志生成与采集 ==
    App->>Source: 生成原始日志行
    Source->>Agent: 暴露增量日志内容
    Agent->>Agent: 增量读取文件 / 容器 / 系统日志

    == 阶段 2：Agent 预处理 ==
    Agent->>Agent: 去空行 / 去空前缀
    Agent->>Agent: 拆 service.name / instance.id
    Agent->>Agent: 识别 severity
    Agent->>Agent: 合并多行异常块
    Agent->>Agent: 第一层短窗去重
    Agent->>PullAPI: 暴露 batch_id / cursor / records

    == 阶段 3：Control-plane 拉取与入库 ==
    CP->>PullAPI: 发起 logs/pull(cursor)
    PullAPI-->>CP: 返回结构化 records
    CP->>Norm: 构建 PullPackage
    Norm->>Norm: 生成 event.id
    Norm->>Norm: 生成 dedup fingerprint
    Norm->>Norm: 第二层语义去重
    Norm->>Norm: 结构化 message / error.*
    Norm->>ES: Bulk 写入 data stream
    alt ES 写入成功
        ES-->>Norm: indexed / version_conflict
        Norm-->>CP: 返回成功结果
        CP->>PullAPI: ACK + committed_cursor
        PullAPI-->>Agent: 提交游标
    else ES 写入失败
        ES-->>Norm: mapper / bulk failure
        Norm-->>CP: 返回失败详情
        CP->>CP: retry / nack / dead letter
    end

    == 阶段 4：查询与前端展示 ==
    UI->>Query: POST /api/v1/query/logs
    Query->>ES: 按 v2 字段检索
    ES-->>Query: hits / total / took
    Query-->>UI: 返回标准化 hits + fields
    UI->>UI: 展示列表 / 详情抽屉 / 趋势图

    == 阶段 5：告警评估 ==
    loop 每 30 秒规则评估
        Alert->>ES: 执行 keyword / level_count / threshold 查询
        ES-->>Alert: 返回命中结果或聚合结果
        alt 告警命中
            Alert->>Alert: 抑制判断 / 静默判断
            Alert->>Alert: 创建 alert_event
            Alert->>Alert: critical 时升级 incident
        else 未命中
            Alert->>Alert: 记录本轮无事件
        end
    end

    == 阶段 6：热温冷归档生命周期 ==
    ILM->>ES: Hot rollover 检查
    ILM->>ES: 3d 迁移到 Warm
    ILM->>Snap: 30d 后创建 searchable snapshot
    Snap-->>ILM: 返回快照句柄
    ILM->>ES: 30d 迁移到 Cold
    ILM->>Archive: 90d+ 触发长期归档
    alt 需要恢复归档日志
        Archive-->>ILM: 返回归档对象位置
        ILM->>Snap: 发起恢复流程
        Snap-->>ES: 恢复到可检索层
    else 仅在线查询热 / 温 / 冷数据
        UI->>Query: 查询在线可检索历史日志
    end
```

**Markdown 版（类图片样式）**

```text
┌────────────────────────────────────────────────────────────────────┐
│                     NexusLog 全链路总览（类图片样式）             │
├────────────────────────────────────────────────────────────────────┤
│ 阶段 1  日志生成与采集                                            │
│   App / Source → Agent                                            │
│   Agent 增量读取文件、容器与系统日志                              │
├────────────────────────────────────────────────────────────────────┤
│ 阶段 2  Agent 预处理                                              │
│   去空行 / 去空前缀 / 拆 service / 识别 severity                  │
│   多行异常合并 / 第一层短窗去重                                   │
│   输出 batch_id / cursor / records                                │
├────────────────────────────────────────────────────────────────────┤
│ 阶段 3  Control-plane 拉取与入库                                  │
│   CP → PullAPI → PullPackage → 归一化层                           │
│   生成 event.id / fingerprint / message / error.*                 │
│   第二层语义去重后 Bulk 写入 ES data stream                       │
│   成功：ACK + committed_cursor                                    │
│   失败：retry / nack / dead letter                                │
├────────────────────────────────────────────────────────────────────┤
│ 阶段 4  查询与前端展示                                            │
│   UI → Query API → ES                                             │
│   返回标准化 hits + fields                                        │
│   UI 展示列表 / 详情抽屉 / 趋势图                                  │
├────────────────────────────────────────────────────────────────────┤
│ 阶段 5  告警评估                                                  │
│   Alert Evaluator 每 30 秒扫描 ES                                 │
│   命中后执行抑制 / 静默 / alert_event / incident 升级             │
├────────────────────────────────────────────────────────────────────┤
│ 阶段 6  生命周期                                                  │
│   ILM: Hot → Warm(3d) → Cold(30d)                                 │
│   Snapshot / Archive(90d+) / Restore                              │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. 分图一：采集与入库

> 这张图对应你给的示例图片上半部分风格：围绕“日志如何被清洗并成功写入 ES”展开，把采集、预处理、拉取、归一化、写入、ACK / NACK 细节拆得更清楚。

```mermaid
sequenceDiagram
    autonumber
    actor App as "App/应用"
    participant Source as "Source/日志源"
    participant Agent as "Agent/采集代理"
    participant PullAPI as "PullAPI/拉取接口"
    participant CP as "CP/控制面"
    participant Norm as "Norm/归一化"
    participant ES as "ES/日志存储"

    Note over Agent: 采集、清洗、多行合并、第一层去重
    Note over CP,Norm: 调度、归一化、幂等、入库
    Note over ES: 实时检索与规则评估的数据面

    == 阶段 1：日志生成与暴露 ==
    App->>Source: 1. 写出原始日志
    Source-->>Agent: 2. 暴露增量日志内容
    Agent->>Agent: 3. 读取增量日志

    == 阶段 2：Agent 预处理 ==
    activate Agent
    Agent->>Agent: 4.1 空行过滤
    Agent->>Agent: 4.2 空前缀过滤
    Agent->>Agent: 4.3 服务名前缀拆分
    Agent->>Agent: 4.4 severity 识别
    Agent->>Agent: 4.5 多行异常合并
    Agent->>Agent: 4.6 第一层短窗去重
    Agent->>PullAPI: 5. 暴露 batch_id / cursor / records
    deactivate Agent

    == 阶段 3：Control-plane 拉取 ==
    activate CP
    CP->>PullAPI: 6. 发起 logs/pull(cursor)
    activate PullAPI
    PullAPI-->>CP: 7. 返回结构化 records
    deactivate PullAPI
    CP->>CP: 8. 构建 PullPackage / PullBatch

    == 阶段 4：归一化与第二层去重 ==
    CP->>Norm: 9. 交给归一化层处理
    activate Norm
    Norm->>Norm: 9.1 生成 event.id
    Norm->>Norm: 9.2 生成 dedup fingerprint
    Norm->>Norm: 9.3 生成 message / error.*
    Norm->>Norm: 10. 执行第二层语义去重

    == 阶段 5：写入 ES ==
    Norm->>ES: 11. Bulk 写入 data stream
    activate ES
    alt ES 写入成功
        ES-->>Norm: 12.1 返回 indexed / version_conflict
        Norm-->>CP: 12.2 返回成功结果
        CP->>PullAPI: 12.3 发送 ACK + committed_cursor
        PullAPI-->>Agent: 12.4 提交游标
        CP->>CP: 12.5 更新 task success / receipt / cursor
    else ES 写入失败
        ES-->>Norm: 13.1 返回 bulk failure
        Norm-->>CP: 13.2 返回失败详情
        CP->>CP: 13.3 retry
        CP->>PullAPI: 13.4 发送 NACK
        CP->>CP: 13.5 写 dead letter / task failed
    end
    deactivate ES
    deactivate Norm
    deactivate CP
```

**Markdown 版（类图片样式）**

```text
┌────────────────────────────────────────────────────────────────────┐
│                    采集与入库细化路径（类图片样式）               │
├────────────────────────────────────────────────────────────────────┤
│ App / 应用                                                        │
│   ↓ 写出原始日志                                                  │
│ Source / 日志源                                                   │
│   ↓ 暴露增量内容                                                  │
│ Agent / 采集代理                                                  │
│   ├─ 空行过滤                                                     │
│   ├─ 空前缀过滤                                                   │
│   ├─ 服务名前缀拆分                                               │
│   ├─ severity 识别                                                │
│   ├─ 多行异常合并                                                 │
│   └─ 第一层短窗去重                                               │
│   ↓ 输出 batch_id / cursor / records                              │
│ Pull API                                                          │
│   ↓ logs/pull(cursor)                                             │
│ Control-plane                                                     │
│   ↓ 构建 PullPackage / PullBatch                                  │
│ 归一化层                                                          │
│   ├─ 生成 event.id                                                │
│   ├─ 生成 dedup fingerprint                                       │
│   ├─ 结构化 message / error.*                                     │
│   └─ 第二层语义去重                                               │
│   ↓ Bulk 写入 ES                                                  │
├────────────────────── 成功 / 失败 分支 ────────────────────────────┤
│ 成功：indexed / version_conflict → ACK → committed_cursor         │
│       更新 receipt / cursor / task success                        │
│ 失败：bulk failure → retry → NACK → dead letter / task failed     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. 分图二：查询、展示、告警与生命周期

> 这张图对应你给的示例图片下半部分风格：围绕“数据已经在 ES 中，前端如何查询、告警如何扫描、旧数据如何迁移与恢复”展开。

```mermaid
sequenceDiagram
    autonumber
    participant ES as "ES/日志存储"
    participant Query as "Query/查询接口"
    participant UI as "UI/前端页面"
    participant Alert as "Alert/告警引擎"
    participant ILM as "ILM/生命周期"
    participant Snap as "Snap/快照仓库"
    participant Archive as "Archive/归档存储"
    participant Restore as "Restore/恢复流程"

    Note over Query,UI: 查询、标准化返回、列表与详情展示
    Note over Alert: 周期性规则评估、抑制、静默、事件升级
    Note over ILM,Snap,Archive,Restore: 热温冷迁移、快照、归档、恢复

    == 阶段 1：查询与前端展示 ==
    UI->>Query: 1. POST /api/v1/query/logs
    activate Query
    Query->>ES: 2. 按 v2 字段查询 ES
    activate ES
    ES-->>Query: 3. 返回 hits / total / took
    deactivate ES
    Query-->>UI: 4. 返回 id / timestamp / level / service / message / raw_log / fields
    deactivate Query
    UI->>UI: 5. 展示实时日志列表
    UI->>UI: 6. 打开详情抽屉
    UI->>UI: 7. 显示 event_id / batch_id / source / schema_version / pipeline_version

    == 阶段 2：告警评估 ==
    loop 每 30 秒规则评估
        activate Alert
        Alert->>ES: 8. 扫描 keyword / level_count / threshold 规则
        activate ES
        ES-->>Alert: 9. 返回命中数或聚合结果
        deactivate ES
        alt 告警命中
            Alert->>Alert: 10.1 抑制判断
            Alert->>Alert: 10.2 静默判断
            Alert->>Alert: 10.3 创建 alert_event
            Alert->>Alert: 10.4 critical 时升级 incident
        else 未命中
            Alert->>Alert: 10.5 记录本轮无事件
        end
        deactivate Alert
    end

    == 阶段 3：生命周期与归档 ==
    activate ILM
    ILM->>ES: 11. Hot rollover 检查
    ILM->>ES: 12. 3d 迁移到 Warm
    ILM->>Snap: 13. 30d 创建 searchable snapshot
    activate Snap
    Snap-->>ILM: 14. 返回 snapshot 句柄
    deactivate Snap
    ILM->>ES: 15. 30d 迁移到 Cold
    ILM->>Archive: 16. 90d+ 归档到对象存储

    alt 需要恢复归档日志
        Archive-->>Restore: 17.1 返回归档对象位置
        activate Restore
        Restore->>Snap: 17.2 发起恢复请求
        activate Snap
        Snap-->>Restore: 17.3 返回恢复结果
        deactivate Snap
        Restore->>ES: 17.4 恢复到可检索层
        deactivate Restore
    else 仅在线查询热 / 温 / 冷数据
        UI->>Query: 17.5 继续查询在线可检索数据
    end
    deactivate ILM
```

**Markdown 版（类图片样式）**

```text
┌────────────────────────────────────────────────────────────────────┐
│               查询、展示、告警与生命周期（类图片样式）            │
├────────────────────────────────────────────────────────────────────┤
│ 查询与展示                                                        │
│   UI → Query API → ES                                             │
│   ES 返回 hits / total / took                                     │
│   Query API 返回 id / timestamp / level / service / fields        │
│   UI 展示列表、详情抽屉与关键字段                                 │
├────────────────────────────────────────────────────────────────────┤
│ 告警评估                                                          │
│   Scheduler / Alert Evaluator 每 30 秒扫描 ES                     │
│   规则类型：keyword / level_count / threshold                     │
│   命中：抑制判断 → 静默判断 → alert_event → critical 升级         │
│   未命中：记录本轮无事件                                          │
├────────────────────────────────────────────────────────────────────┤
│ 生命周期                                                          │
│   ILM 执行 Hot rollover                                           │
│   3d → Warm                                                       │
│   30d → searchable snapshot + Cold                                │
│   90d+ → Archive                                                  │
│   如需恢复：Archive → Restore → Snapshot → ES 可检索层            │
│   如无需恢复：UI 继续查询在线热 / 温 / 冷数据                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 图例说明

| 图例元素 | 含义 |
|---|---|
| `->>` | 同步请求 / 调用 |
| `-->>` | 返回结果 / 异步响应 |
| `Note over` | 组件职责说明 |
| `activate / deactivate` | 激活期，模拟传统时序图中的执行条 |
| `alt / else` | 分支路径 |
| `loop` | 周期性动作 |
| `== 阶段 ==` | 时序阶段分隔 |

> 实际渲染时箭头样式以 Mermaid 兼容语法为准，不再额外扩展自定义样式。

---

## 关键触发点说明

| 能力 | 触发点 | 所在层 |
|---|---|---|
| 多行合并 | Agent 采集后、输出 records 前 | Agent |
| 第一层去重 | Agent 完成多行合并后 | Agent |
| 第二层语义去重 | Control-plane 写 ES bulk 前 | Control-plane |
| 告警评估 | ES 落库后定时扫描 | Alert Evaluator |
| 热 → 温迁移 | `3d` | ILM |
| 温 → 冷迁移 | `30d` | ILM |
| 快照等待 | 删除前 / 冷阶段前后 | ILM / Snapshot |
| 长期归档 | `90d+` | Archive |
| 归档恢复 | 需要回查历史冷数据时 | Restore |

---

## 渲染兼容性说明

- 本文档优先追求“Markdown 直接可渲染”，因此统一使用 Mermaid，而不是 PlantUML。
- 为降低渲染差异风险，参与者名称使用了引号包裹，例如：`"Agent/采集代理"`。
- 若某些 Markdown 渲染器对中文或斜杠表现不佳，可将参与者名称进一步简化为：`Agent`、`CP`、`ES` 等短名。
- 若某些预览器对超宽图支持不好，优先阅读本文件中的两张分图；总图用于全景理解。
- 本文档不依赖外链图片、不依赖自定义 CSS、不依赖实验性 Mermaid 语法。

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|---|---|---|
| 2026-03-07 | v1.1 | 在每个 Mermaid 图下补充纯 Markdown / ASCII 的类图片样式图，便于在不支持 Mermaid 的环境中阅读 |
| 2026-03-07 | v1.0 | 初始版本。新增 Mermaid 版 Markdown 时序图，包含总图、采集入库分图、查询展示告警生命周期分图，以及图例和关键触发点说明 |
