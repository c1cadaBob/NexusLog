# 模块20：ML/AI机器学习框架 - 技术设计文档

> **文档版本**: v1.0  
> **作者**: 系统架构团队  
> **更新日期**: 2026-01-31  
> **状态**: 已发布  
> **相关需求**: [requirements-module20.md](../requirements/requirements-module20.md)

---

## 1. 文档信息

### 1.1 版本历史
| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|----------|
| v1.0 | 2026-01-31 | 系统架构团队 | 初稿，完整设计方案 |

### 1.2 文档状态
- **当前状态**: 已发布
- **评审状态**: 已通过
- **实施阶段**: MVP + Phase 2

### 1.3 相关文档
- [需求文档](../requirements/requirements-module20.md)
- [API设计文档](./api-design.md)
- [项目总体设计](./project-design-overview.md)

---

## 2. 总体架构

### 2.1 系统架构图
```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            ML/AI机器学习框架整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            数据采集与特征工程层                                          │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  数据源                                                                        │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │   │ │
│  │  │  │  Kafka   │  │   ES     │  │  MinIO   │  │PostgreSQL│  │  Redis   │      │   │ │
│  │  │  │ 日志流   │  │ 历史日志  │  │ 备份数据  │  │ 元数据   │  │ 实时数据  │      │   │ │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │   │ │
│  │  │       └─────────────┴─────────────┴─────────────┴─────────────┘            │   │ │
│  │  └────────────────────────────────────┬───────────────────────────────────────┘   │ │
│  │                                       │                                            │ │
│  │  ┌────────────────────────────────────▼───────────────────────────────────────┐   │ │
│  │  │  Flink 特征工程                                                            │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 数据清洗  │─▶│ 特征提取  │─▶│ 特征转换  │─▶│ 特征存储  │                  │   │ │
│  │  │  │ 去重/过滤 │  │ 统计/聚合 │  │ 归一化   │  │ Feature  │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  │  Store   │                  │   │ │
│  │  │                                             └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            离线训练层（Python）                                      │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  训练环境                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ Jupyter  │  │ Python   │  │ PyTorch  │  │ scikit-  │                  │   │ │
│  │  │  │ Notebook │  │  3.11    │  │   2.1    │  │ learn    │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  模型训练流程                                                              │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │   │ │
│  │  │  │ 数据加载  │─▶│ 模型训练  │─▶│ 模型评估  │─▶│ 超参优化  │─▶│ ONNX导出 │  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  支持的模型类型                                                            │   │ │
│  │  │  • 异常检测：Isolation Forest, Autoencoder, One-Class SVM                 │   │ │
│  │  │  • 日志聚类：K-means, DBSCAN, Hierarchical Clustering                     │   │ │
│  │  │  • 时序预测：LSTM, GRU, Prophet, ARIMA                                    │   │ │
│  │  │  • 分类模型：Random Forest, XGBoost, LightGBM                             │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            模型管理层（MLflow）                                      │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  MLflow Tracking Server                                                    │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 实验管理  │  │ 指标记录  │  │ 参数记录  │  │ 模型注册  │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  MLflow Model Registry                                                     │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 版本管理  │  │ 阶段管理  │  │ A/B测试  │  │ 灰度发布  │                  │   │ │
│  │  │  │ v1/v2/v3 │  │Staging/  │  │ 流量分配  │  │ 10%→100% │                  │   │ │
│  │  │  │          │  │Production│  │          │  │          │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  模型存储                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                                │   │ │
│  │  │  │  MinIO   │  │PostgreSQL│  │  Redis   │                                │   │ │
│  │  │  │ 模型文件  │  │ 元数据   │  │ 缓存     │                                │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘                                │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            在线推理层（Go + ONNX Runtime）                           │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  推理服务（Go）                                                            │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 模型加载  │  │ 特征预处理│  │ ONNX推理 │  │ 结果后处理│                  │   │ │
│  │  │  │ 热更新   │  │ 归一化   │  │ Runtime  │  │ 阈值判断  │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  推理场景                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 实时异常  │  │ 日志聚类  │  │ 趋势预测  │  │ 智能告警  │                  │   │ │
│  │  │  │ 检测     │  │ 分类     │  │ 分析     │  │ 触发     │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  性能优化                                                                  │   │ │
│  │  │  • 模型缓存：Redis缓存热模型                                               │   │ │
│  │  │  • 批量推理：批量处理提升吞吐量                                            │   │ │
│  │  │  • 并发推理：Worker Pool并发处理                                          │   │ │
│  │  │  • 模型量化：INT8量化减少内存和延迟                                        │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            流式ML层（Flink ML）                                      │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  Flink ML Pipeline                                                         │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 流式特征  │─▶│ 在线学习  │─▶│ 模型更新  │─▶│ 实时推理  │                  │   │ │
│  │  │  │ 提取     │  │ 增量训练  │  │ 版本管理  │  │ 结果输出  │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  支持的流式算法                                                            │   │ │
│  │  │  • 流式聚类：StreamKMeans                                                  │   │ │
│  │  │  • 流式异常检测：Streaming Isolation Forest                                │   │ │
│  │  │  • 在线学习：SGD, FTRL                                                     │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与反馈层                                              │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  模型监控                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 准确率   │  │ 延迟监控  │  │ 数据漂移  │  │ 模型降级  │                  │   │ │
│  │  │  │ 监控     │  │ P95/P99  │  │ 检测     │  │ 检测     │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  │  ┌────────────────────────────────────────────────────────────────────────────┐   │ │
│  │  │  反馈学习                                                                  │   │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │   │ │
│  │  │  │ 用户标记  │─▶│ 样本收集  │─▶│ 模型重训  │─▶│ 模型更新  │                  │   │ │
│  │  │  │ 误报/漏报│  │ 正负样本  │  │ 增量训练  │  │ 自动部署  │                  │   │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘                  │   │ │
│  │  └────────────────────────────────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模块划分
| 子模块 | 职责 | 核心功能 |
|--------|------|----------|
| 数据采集与特征工程层 | 从多数据源采集数据并提取特征 | Kafka流式采集、ES历史查询、Flink特征工程、Feature Store |
| 离线训练层 | 模型训练和优化 | Jupyter开发环境、PyTorch/scikit-learn训练、超参优化、ONNX导出 |
| 模型管理层 | 模型版本管理和部署 | MLflow实验跟踪、模型注册、版本管理、A/B测试、灰度发布 |
| 在线推理层 | 实时推理服务 | Go推理服务、ONNX Runtime、模型热更新、批量推理 |
| 流式ML层 | 流式机器学习 | Flink ML、在线学习、增量训练、实时推理 |
| 监控与反馈层 | 模型监控和持续优化 | 准确率监控、数据漂移检测、反馈学习、自动重训 |

### 2.3 关键路径

**离线训练流程**:
```
数据采集(Kafka/ES) → 特征工程(Flink) → 模型训练(Python) → 模型评估 
  → ONNX导出 → MLflow注册 → 模型部署(5分钟)
```

**在线推理流程**:
```
日志流入(Kafka) → 特征提取(Go) → ONNX推理(<1s) → 结果输出 
  → 告警触发/分析展示
```

**反馈学习流程**:
```
用户标记误报 → 样本收集 → 增量训练 → 模型评估 → 自动部署 
  → 准确率提升
```

---

## 3. 技术选型

### 3.1 核心技术栈
| 技术 | 版本 | 选择理由 |
|------|------|----------|
| Python | 3.11+ | 丰富的ML库生态、Jupyter支持、社区活跃 |
| PyTorch | 2.1+ | 深度学习首选框架、动态图灵活、ONNX导出支持 |
| scikit-learn | 1.3+ | 经典ML算法库、API简洁、文档完善 |
| ONNX | 1.15+ | 跨平台模型格式、支持多框架、高性能推理 |
| ONNX Runtime | 1.16+ | 高性能推理引擎、支持多后端、Go绑定完善 |
| MLflow | 2.9+ | 端到端ML平台、实验跟踪、模型注册、部署管理 |
| Flink ML | 2.3+ | 流式ML框架、与Flink集成、支持在线学习 |
| Go | 1.21+ | 高性能推理服务、低延迟、并发友好 |
| Redis | 7+ | 模型缓存、特征存储、实时数据 |
| MinIO | latest | 模型文件存储、S3兼容、高可用 |
| PostgreSQL | 15+ | 元数据存储、实验记录、版本管理 |
| Prometheus | 2.48+ | 模型监控、指标采集、告警 |
| Grafana | 10+ | 可视化仪表盘、模型性能监控 |

### 3.2 异常检测算法对比

| 算法 | 优点 | 缺点 | 适用场景 | 选择 |
|------|------|------|----------|------|
| Isolation Forest | 无监督、快速、适合高维数据 | 对局部异常不敏感 | 日志异常检测 | ✅ MVP |
| Autoencoder | 深度学习、捕捉复杂模式 | 训练慢、需要大量数据 | 复杂异常模式 | ✅ Phase 2 |
| One-Class SVM | 理论完善、效果稳定 | 计算复杂度高 | 小数据集 | ❌ |
| LOF | 局部异常检测 | 计算复杂度O(n²) | 小规模数据 | ❌ |

**选择**: Isolation Forest（MVP）+ Autoencoder（Phase 2）

### 3.3 聚类算法对比

| 算法 | 优点 | 缺点 | 适用场景 | 选择 |
|------|------|------|----------|------|
| K-means | 简单快速、可扩展 | 需要预设K值 | 日志模式识别 | ✅ MVP |
| DBSCAN | 自动发现簇数、处理噪声 | 参数敏感 | 密度不均匀数据 | ✅ Phase 2 |
| Hierarchical | 层次结构、无需预设K | 计算复杂度高 | 小规模分析 | ❌ |
| Mean Shift | 自动发现簇数 | 计算慢 | - | ❌ |

**选择**: K-means（MVP）+ DBSCAN（Phase 2）

### 3.4 时序预测算法对比

| 算法 | 优点 | 缺点 | 适用场景 | 选择 |
|------|------|------|----------|------|
| LSTM | 捕捉长期依赖、效果好 | 训练慢、需要大量数据 | 日志量预测 | ✅ MVP |
| Prophet | 简单易用、自动处理季节性 | 灵活性差 | 业务指标预测 | ✅ Phase 2 |
| ARIMA | 经典方法、理论完善 | 需要平稳序列 | 简单时序 | ❌ |
| GRU | 比LSTM快、效果相近 | 长期依赖略差 | 备选方案 | ❌ |

**选择**: LSTM（MVP）+ Prophet（Phase 2）

### 3.5 推理引擎对比

| 引擎 | 优点 | 缺点 | 选择 |
|------|------|------|------|
| ONNX Runtime | 跨平台、高性能、多后端 | - | ✅ 采用 |
| TensorFlow Lite | 移动端优化 | 模型格式限制 | ❌ |
| TorchScript | PyTorch原生 | 仅支持PyTorch | ❌ |
| TensorRT | NVIDIA GPU加速 | 仅支持NVIDIA | ❌ |

**选择**: ONNX Runtime，跨平台、高性能、Go绑定完善

---

## 4. 关键流程设计

### 4.1 异常检测服务流程

**训练流程**:
```
1. 数据准备
   ├─ 从ES查询历史日志（最近30天）
   ├─ 提取特征：log_count, error_rate, avg_latency, unique_ips
   ├─ 数据清洗：去除异常值、填充缺失值
   └─ 数据归一化：StandardScaler

2. 模型训练
   ├─ 创建Isolation Forest模型
   │  ├─ n_estimators=100
   │  ├─ contamination=0.01（预期异常比例1%）
   │  └─ random_state=42
   ├─ 训练模型：model.fit(X_train)
   ├─ 模型评估：计算准确率、召回率、F1分数
   └─ 超参数优化：GridSearchCV调优

3. 模型导出
   ├─ 转换为ONNX格式：skl2onnx.convert_sklearn()
   ├─ 保存模型文件：anomaly_detector.onnx
   ├─ 保存预处理器：scaler.pkl
   └─ 注册到MLflow Model Registry

4. 模型部署
   ├─ 上传模型到MinIO
   ├─ 更新模型元数据到PostgreSQL
   ├─ 通知推理服务热更新（Redis Pub/Sub）
   └─ 推理服务加载新模型（< 5分钟）
```

**推理流程**:
```
1. 实时数据采集
   ├─ 从Kafka消费日志流
   ├─ 按时间窗口聚合（1分钟）
   └─ 提取特征：log_count, error_rate, avg_latency, unique_ips

2. 特征预处理
   ├─ 加载预处理器（scaler）
   ├─ 特征归一化：scaler.transform(features)
   └─ 转换为ONNX输入格式：[]float32

3. 模型推理
   ├─ 加载ONNX模型（从缓存或磁盘）
   ├─ 执行推理：session.Run(inputs)
   ├─ 获取异常分数：score < -0.5 为异常
   └─ 推理延迟：< 1s

4. 结果处理
   ├─ 判断是否异常：score < threshold
   ├─ 生成异常解释：哪些特征导致异常
   ├─ 发送告警：Kafka topic "anomaly-alerts"
   └─ 记录推理日志：PostgreSQL

5. 反馈学习
   ├─ 用户标记误报/漏报
   ├─ 收集标记样本
   ├─ 达到阈值（1000条）触发重训
   └─ 自动部署新模型
```

**时序图**:
```
Kafka  特征提取  预处理  ONNX推理  结果处理  告警
  │       │       │        │        │       │
  │─日志→│       │        │        │       │
  │       │─特征→│        │        │       │
  │       │       │─归一化→│        │       │
  │       │       │        │─推理→│       │
  │       │       │        │       │─判断→│
  │       │       │        │       │      │─告警→
  │       │       │        │       │←结果─│
```

### 4.2 日志聚类服务流程

**训练流程**:
```
1. 数据准备
   ├─ 从ES查询日志样本（10万条）
   ├─ 日志解析：提取日志模板
   ├─ 特征提取：TF-IDF向量化
   └─ 降维：PCA降到50维

2. 聚类训练
   ├─ 确定最优K值：Elbow Method
   ├─ K-means聚类：KMeans(n_clusters=K)
   ├─ 聚类评估：Silhouette Score
   └─ 提取聚类中心和模板

3. 模型导出
   ├─ 转换为ONNX格式
   ├─ 保存TF-IDF向量化器
   ├─ 保存聚类模板
   └─ 注册到MLflow

4. 增量聚类
   ├─ 新日志自动归类到最近簇
   ├─ 定期重新聚类（每天）
   └─ 自动发现新模式
```

**推理流程**:
```
1. 日志输入
   ├─ 接收新日志
   └─ 日志解析

2. 特征提取
   ├─ TF-IDF向量化
   └─ PCA降维

3. 聚类分类
   ├─ 计算到各簇中心的距离
   ├─ 分配到最近的簇
   └─ 返回簇ID和模板

4. 结果展示
   ├─ 聚类可视化（t-SNE降维）
   ├─ 模板展示
   └─ 统计信息
```

### 4.3 预测性分析服务流程

**LSTM训练流程**:
```
1. 数据准备
   ├─ 从ES查询历史日志量（最近90天）
   ├─ 按小时聚合
   ├─ 构造时序数据：滑动窗口（24小时预测未来1小时）
   └─ 数据归一化：MinMaxScaler

2. 模型训练
   ├─ 构建LSTM模型
   │  ├─ Input: (batch_size, 24, features)
   │  ├─ LSTM(128) → Dropout(0.2)
   │  ├─ LSTM(64) → Dropout(0.2)
   │  └─ Dense(1)
   ├─ 训练：Adam优化器、MSE损失
   ├─ 验证：计算RMSE、MAE
   └─ 早停：patience=10

3. 模型导出
   ├─ 转换为ONNX格式
   ├─ 保存归一化器
   └─ 注册到MLflow

4. 模型部署
   └─ 推理服务加载模型
```

**推理流程**:
```
1. 数据准备
   ├─ 获取最近24小时日志量
   ├─ 归一化
   └─ 构造输入张量

2. 模型推理
   ├─ ONNX推理
   ├─ 反归一化
   └─ 获取预测值

3. 结果输出
   ├─ 预测未来1h/6h/24h日志量
   ├─ 预测置信区间
   ├─ 趋势分析（上升/下降/平稳）
   └─ 容量规划建议
```

### 4.4 模型热更新流程

```
1. 模型训练完成
   ├─ 模型注册到MLflow
   ├─ 设置模型阶段为"Staging"
   └─ 触发部署流程

2. 模型验证
   ├─ 在Staging环境测试
   ├─ 对比新旧模型指标
   ├─ A/B测试（10%流量）
   └─ 验证通过后设置为"Production"

3. 模型部署
   ├─ 上传模型到MinIO
   ├─ 更新模型元数据到PostgreSQL
   ├─ 发布Redis Pub/Sub通知
   │  └─ 频道：model:reload
   │  └─ 消息：{model_name, version, path}
   └─ 推理服务订阅通知

4. 推理服务热更新
   ├─ 接收Redis通知
   ├─ 从MinIO下载新模型
   ├─ 验证模型文件（checksum）
   ├─ 加载新模型到内存
   ├─ 使用atomic.Value原子更新
   ├─ 释放旧模型资源
   └─ 记录更新日志

5. 灰度发布
   ├─ 10%流量使用新模型
   ├─ 监控指标（准确率、延迟）
   ├─ 逐步扩大（10% → 50% → 100%）
   └─ 发现问题立即回滚

6. 回滚机制
   ├─ 检测到准确率下降 > 5%
   ├─ 自动回滚到上一版本
   ├─ 发送告警通知
   └─ 记录回滚日志
```

### 4.5 异常流程

| 异常类型 | 处理策略 | 恢复机制 |
|----------|----------|----------|
| 模型加载失败 | 使用上一版本模型，记录错误 | 人工检查模型文件 |
| 推理超时 | 返回默认结果，记录日志 | 检查模型复杂度，优化推理 |
| 特征缺失 | 使用默认值填充 | 检查特征提取逻辑 |
| 数据漂移 | 触发模型重训告警 | 自动重训或人工介入 |
| 准确率下降 | 自动回滚模型 | 分析原因，重新训练 |
| MLflow不可用 | 使用本地缓存模型 | 自动重连，降级服务 |
| Redis不可用 | 模型热更新失败，保持原模型 | 自动重连，手动触发更新 |
| MinIO不可用 | 模型下载失败，使用缓存 | 自动重连，重试下载 |

---

## 5. 接口设计

### 5.1 API列表

详见 [API设计文档](./api-design.md) 模块20部分，共25个接口:

**模型训练接口** (5个):
- API-20-412: 创建训练任务 - POST /api/v1/ml/training/create
- API-20-413: 查询训练状态 - GET /api/v1/ml/training/status/{id}
- API-20-414: 停止训练任务 - POST /api/v1/ml/training/stop/{id}
- API-20-415: 查询训练历史 - GET /api/v1/ml/training/history
- API-20-416: 获取训练日志 - GET /api/v1/ml/training/logs/{id}

**模型管理接口** (7个):
- API-20-417: 注册模型 - POST /api/v1/ml/models/register
- API-20-418: 查询模型列表 - GET /api/v1/ml/models
- API-20-419: 获取模型详情 - GET /api/v1/ml/models/{id}
- API-20-420: 更新模型阶段 - PUT /api/v1/ml/models/{id}/stage
- API-20-421: 删除模型 - DELETE /api/v1/ml/models/{id}
- API-20-422: 下载模型 - GET /api/v1/ml/models/{id}/download
- API-20-423: 对比模型 - POST /api/v1/ml/models/compare

**异常检测接口** (4个):
- API-20-424: 实时异常检测 - POST /api/v1/ml/anomaly/detect
- API-20-425: 批量异常检测 - POST /api/v1/ml/anomaly/batch
- API-20-426: 查询异常历史 - GET /api/v1/ml/anomaly/history
- API-20-427: 标记误报 - POST /api/v1/ml/anomaly/feedback

**日志聚类接口** (4个):
- API-20-428: 日志聚类分析 - POST /api/v1/ml/clustering/analyze
- API-20-429: 查询聚类结果 - GET /api/v1/ml/clustering/results
- API-20-430: 获取聚类模板 - GET /api/v1/ml/clustering/templates
- API-20-431: 聚类可视化 - GET /api/v1/ml/clustering/visualize

**预测分析接口** (3个):
- API-20-432: 日志量预测 - POST /api/v1/ml/prediction/log-volume
- API-20-433: 错误率预测 - POST /api/v1/ml/prediction/error-rate
- API-20-434: 容量规划建议 - GET /api/v1/ml/prediction/capacity

**模型监控接口** (2个):
- API-20-435: 查询模型指标 - GET /api/v1/ml/monitoring/metrics
- API-20-436: 查询数据漂移 - GET /api/v1/ml/monitoring/drift

**告警规则管理接口** (6个):
- API-20-437: 创建告警规则 - POST /api/v1/ml/alerts/rules
- API-20-438: 查询告警规则列表 - GET /api/v1/ml/alerts/rules
- API-20-439: 获取告警规则详情 - GET /api/v1/ml/alerts/rules/{id}
- API-20-440: 更新告警规则 - PUT /api/v1/ml/alerts/rules/{id}
- API-20-441: 删除告警规则 - DELETE /api/v1/ml/alerts/rules/{id}
- API-20-442: 查询告警历史 - GET /api/v1/ml/alerts/history

### 5.2 内部接口

**模型训练器接口**:
```go
// 模型训练器接口
type ModelTrainer interface {
    // 训练模型
    Train(ctx context.Context, config *TrainingConfig) (*TrainingResult, error)
    
    // 评估模型
    Evaluate(ctx context.Context, modelPath string, testData []byte) (*EvaluationResult, error)
    
    // 导出ONNX
    ExportONNX(ctx context.Context, modelPath string) (string, error)
}

// 训练配置
type TrainingConfig struct {
    ModelType    string                 `json:"model_type"`    // anomaly/clustering/prediction
    Algorithm    string                 `json:"algorithm"`     // isolation_forest/kmeans/lstm
    DataSource   DataSourceConfig       `json:"data_source"`   // 数据源配置
    Hyperparams  map[string]interface{} `json:"hyperparams"`   // 超参数
    TrainRatio   float64                `json:"train_ratio"`   // 训练集比例
    RandomState  int                    `json:"random_state"`  // 随机种子
}

// 训练结果
type TrainingResult struct {
    ModelID      string                 `json:"model_id"`
    ModelPath    string                 `json:"model_path"`
    Metrics      map[string]float64     `json:"metrics"`       // 评估指标
    Duration     time.Duration          `json:"duration"`      // 训练时长
    Status       string                 `json:"status"`        // success/failed
    Error        string                 `json:"error"`         // 错误信息
}
```

**推理服务接口**:
```go
// 推理服务接口
type InferenceService interface {
    // 加载模型
    LoadModel(ctx context.Context, modelID string, modelPath string) error
    
    // 推理
    Predict(ctx context.Context, modelID string, features []float32) (*PredictionResult, error)
    
    // 批量推理
    BatchPredict(ctx context.Context, modelID string, features [][]float32) ([]*PredictionResult, error)
    
    // 卸载模型
    UnloadModel(ctx context.Context, modelID string) error
}

// 推理结果
type PredictionResult struct {
    ModelID     string                 `json:"model_id"`
    Prediction  interface{}            `json:"prediction"`    // 预测结果
    Score       float64                `json:"score"`         // 置信度分数
    Explanation map[string]interface{} `json:"explanation"`   // 解释
    Latency     time.Duration          `json:"latency"`       // 推理延迟
}
```

**特征提取器接口**:
```go
// 特征提取器接口
type FeatureExtractor interface {
    // 提取特征
    Extract(ctx context.Context, data interface{}) ([]float32, error)
    
    // 批量提取
    BatchExtract(ctx context.Context, data []interface{}) ([][]float32, error)
}

// 异常检测特征提取器
type AnomalyFeatureExtractor struct {
    window time.Duration // 时间窗口
}

func (e *AnomalyFeatureExtractor) Extract(ctx context.Context, data interface{}) ([]float32, error) {
    logs := data.([]*LogEntry)
    
    // 提取特征
    features := []float32{
        float32(len(logs)),                    // log_count
        calculateErrorRate(logs),              // error_rate
        calculateAvgLatency(logs),             // avg_latency
        float32(countUniqueIPs(logs)),         // unique_ips
    }
    
    return features, nil
}
```

**模型管理器接口**:
```go
// 模型管理器接口
type ModelManager interface {
    // 注册模型
    Register(ctx context.Context, model *Model) error
    
    // 获取模型
    Get(ctx context.Context, modelID string) (*Model, error)
    
    // 更新模型阶段
    UpdateStage(ctx context.Context, modelID string, stage ModelStage) error
    
    // 删除模型
    Delete(ctx context.Context, modelID string) error
    
    // 获取生产模型
    GetProductionModel(ctx context.Context, modelType string) (*Model, error)
}

// 模型阶段
type ModelStage string

const (
    ModelStageNone       ModelStage = "None"
    ModelStageStaging    ModelStage = "Staging"
    ModelStageProduction ModelStage = "Production"
    ModelStageArchived   ModelStage = "Archived"
)
```

### 5.3 数据格式

**训练请求格式**:
```json
{
  "model_type": "anomaly",
  "algorithm": "isolation_forest",
  "data_source": {
    "type": "elasticsearch",
    "query": {
      "index": "logs-*",
      "time_range": "30d",
      "filters": {
        "service": "api-server"
      }
    }
  },
  "hyperparams": {
    "n_estimators": 100,
    "contamination": 0.01,
    "random_state": 42
  },
  "train_ratio": 0.8,
  "auto_deploy": false
}
```

**推理请求格式**:
```json
{
  "model_id": "anomaly-detector-v1",
  "features": [1000, 0.05, 150.5, 50],
  "explain": true
}
```

**推理响应格式**:
```json
{
  "model_id": "anomaly-detector-v1",
  "prediction": {
    "is_anomaly": true,
    "score": -0.65,
    "threshold": -0.5
  },
  "explanation": {
    "feature_importance": {
      "log_count": 0.1,
      "error_rate": 0.6,
      "avg_latency": 0.2,
      "unique_ips": 0.1
    },
    "reason": "错误率异常高（0.05 > 正常值0.01）"
  },
  "latency": "50ms",
  "timestamp": "2026-01-31T10:00:00Z"
}
```

**模型元数据格式**:
```json
{
  "model_id": "anomaly-detector-v1",
  "name": "Anomaly Detector",
  "version": "1.0.0",
  "type": "anomaly",
  "algorithm": "isolation_forest",
  "stage": "Production",
  "metrics": {
    "accuracy": 0.95,
    "precision": 0.92,
    "recall": 0.88,
    "f1_score": 0.90
  },
  "hyperparams": {
    "n_estimators": 100,
    "contamination": 0.01
  },
  "created_at": "2026-01-31T10:00:00Z",
  "created_by": "admin",
  "deployed_at": "2026-01-31T10:05:00Z",
  "model_path": "s3://models/anomaly-detector-v1.onnx",
  "preprocessor_path": "s3://models/anomaly-detector-v1-scaler.pkl"
}
```

---

## 6. 数据设计

### 6.1 数据模型

**模型元数据**:
```go
// Model 模型元数据
type Model struct {
    ID              string                 `json:"id" db:"id"`
    Name            string                 `json:"name" db:"name"`
    Version         string                 `json:"version" db:"version"`
    Type            string                 `json:"type" db:"type"`           // anomaly/clustering/prediction
    Algorithm       string                 `json:"algorithm" db:"algorithm"` // isolation_forest/kmeans/lstm
    Stage           ModelStage             `json:"stage" db:"stage"`
    Metrics         map[string]float64     `json:"metrics" db:"metrics"`
    Hyperparams     map[string]interface{} `json:"hyperparams" db:"hyperparams"`
    CreatedAt       time.Time              `json:"created_at" db:"created_at"`
    CreatedBy       string                 `json:"created_by" db:"created_by"`
    DeployedAt      *time.Time             `json:"deployed_at,omitempty" db:"deployed_at"`
    ModelPath       string                 `json:"model_path" db:"model_path"`
    PreprocessorPath string                `json:"preprocessor_path" db:"preprocessor_path"`
    Description     string                 `json:"description" db:"description"`
    Tags            []string               `json:"tags" db:"tags"`
}

// TrainingJob 训练任务
type TrainingJob struct {
    ID          string                 `json:"id" db:"id"`
    ModelType   string                 `json:"model_type" db:"model_type"`
    Algorithm   string                 `json:"algorithm" db:"algorithm"`
    Config      map[string]interface{} `json:"config" db:"config"`
    Status      string                 `json:"status" db:"status"` // pending/running/success/failed
    Progress    float64                `json:"progress" db:"progress"`
    StartTime   time.Time              `json:"start_time" db:"start_time"`
    EndTime     *time.Time             `json:"end_time,omitempty" db:"end_time"`
    Duration    time.Duration          `json:"duration" db:"duration"`
    ModelID     string                 `json:"model_id" db:"model_id"`
    Metrics     map[string]float64     `json:"metrics" db:"metrics"`
    Error       string                 `json:"error" db:"error"`
    CreatedBy   string                 `json:"created_by" db:"created_by"`
    Logs        []string               `json:"logs" db:"logs"`
}

// PredictionRecord 推理记录
type PredictionRecord struct {
    ID          string                 `json:"id" db:"id"`
    ModelID     string                 `json:"model_id" db:"model_id"`
    Features    []float32              `json:"features" db:"features"`
    Prediction  interface{}            `json:"prediction" db:"prediction"`
    Score       float64                `json:"score" db:"score"`
    Explanation map[string]interface{} `json:"explanation" db:"explanation"`
    Latency     int64                  `json:"latency" db:"latency"` // 毫秒
    Timestamp   time.Time              `json:"timestamp" db:"timestamp"`
    Feedback    *string                `json:"feedback,omitempty" db:"feedback"` // correct/incorrect
}

// ModelMetrics 模型指标
type ModelMetrics struct {
    ModelID     string    `json:"model_id" db:"model_id"`
    Timestamp   time.Time `json:"timestamp" db:"timestamp"`
    Accuracy    float64   `json:"accuracy" db:"accuracy"`
    Precision   float64   `json:"precision" db:"precision"`
    Recall      float64   `json:"recall" db:"recall"`
    F1Score     float64   `json:"f1_score" db:"f1_score"`
    Latency     float64   `json:"latency" db:"latency"`       // 平均延迟（毫秒）
    Throughput  float64   `json:"throughput" db:"throughput"` // 吞吐量（次/秒）
    ErrorRate   float64   `json:"error_rate" db:"error_rate"`
}

// DataDrift 数据漂移
type DataDrift struct {
    ID          string                 `json:"id" db:"id"`
    ModelID     string                 `json:"model_id" db:"model_id"`
    FeatureName string                 `json:"feature_name" db:"feature_name"`
    DriftScore  float64                `json:"drift_score" db:"drift_score"`
    Threshold   float64                `json:"threshold" db:"threshold"`
    IsDrift     bool                   `json:"is_drift" db:"is_drift"`
    Statistics  map[string]interface{} `json:"statistics" db:"statistics"`
    Timestamp   time.Time              `json:"timestamp" db:"timestamp"`
}
```

### 6.2 数据库设计

**模型相关表**:
```sql
-- 模型表
CREATE TABLE ml_models (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(32) NOT NULL,
    type VARCHAR(32) NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    stage VARCHAR(32) NOT NULL DEFAULT 'None',
    metrics JSONB,
    hyperparams JSONB,
    created_at TIMESTAMP NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    deployed_at TIMESTAMP,
    model_path TEXT NOT NULL,
    preprocessor_path TEXT,
    description TEXT,
    tags TEXT[],
    UNIQUE(name, version)
);

CREATE INDEX idx_ml_models_type ON ml_models(type);
CREATE INDEX idx_ml_models_stage ON ml_models(stage);
CREATE INDEX idx_ml_models_created_at ON ml_models(created_at DESC);

-- 训练任务表
CREATE TABLE ml_training_jobs (
    id VARCHAR(64) PRIMARY KEY,
    model_type VARCHAR(32) NOT NULL,
    algorithm VARCHAR(64) NOT NULL,
    config JSONB NOT NULL,
    status VARCHAR(32) NOT NULL,
    progress FLOAT DEFAULT 0,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration BIGINT,
    model_id VARCHAR(64),
    metrics JSONB,
    error TEXT,
    created_by VARCHAR(64) NOT NULL,
    logs JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models(id)
);

CREATE INDEX idx_ml_training_jobs_status ON ml_training_jobs(status);
CREATE INDEX idx_ml_training_jobs_start_time ON ml_training_jobs(start_time DESC);

-- 推理记录表（保留30天）
CREATE TABLE ml_prediction_records (
    id VARCHAR(64) PRIMARY KEY,
    model_id VARCHAR(64) NOT NULL,
    features JSONB NOT NULL,
    prediction JSONB NOT NULL,
    score FLOAT NOT NULL,
    explanation JSONB,
    latency BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    feedback VARCHAR(32),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models(id)
);

CREATE INDEX idx_ml_prediction_records_model_id ON ml_prediction_records(model_id);
CREATE INDEX idx_ml_prediction_records_timestamp ON ml_prediction_records(timestamp DESC);
CREATE INDEX idx_ml_prediction_records_feedback ON ml_prediction_records(feedback);

-- 模型指标表（TimescaleDB时序表）
CREATE TABLE ml_model_metrics (
    time TIMESTAMPTZ NOT NULL,
    model_id VARCHAR(64) NOT NULL,
    accuracy DOUBLE PRECISION,
    precision DOUBLE PRECISION,
    recall DOUBLE PRECISION,
    f1_score DOUBLE PRECISION,
    latency DOUBLE PRECISION,
    throughput DOUBLE PRECISION,
    error_rate DOUBLE PRECISION
);

SELECT create_hypertable('ml_model_metrics', 'time');
CREATE INDEX idx_ml_model_metrics_model_id ON ml_model_metrics (model_id, time DESC);

-- 数据漂移表
CREATE TABLE ml_data_drift (
    id VARCHAR(64) PRIMARY KEY,
    model_id VARCHAR(64) NOT NULL,
    feature_name VARCHAR(255) NOT NULL,
    drift_score DOUBLE PRECISION NOT NULL,
    threshold DOUBLE PRECISION NOT NULL,
    is_drift BOOLEAN NOT NULL,
    statistics JSONB,
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (model_id) REFERENCES ml_models(id)
);

CREATE INDEX idx_ml_data_drift_model_id ON ml_data_drift(model_id);
CREATE INDEX idx_ml_data_drift_timestamp ON ml_data_drift(timestamp DESC);
CREATE INDEX idx_ml_data_drift_is_drift ON ml_data_drift(is_drift);
```

### 6.3 缓存设计

**Redis缓存策略**:

| 缓存键 | 数据类型 | TTL | 用途 |
|--------|----------|-----|------|
| `model:{model_id}` | Hash | 1小时 | 模型元数据缓存 |
| `model:production:{type}` | String | 10分钟 | 生产模型ID缓存 |
| `model:file:{model_id}` | String | 永久 | 模型文件路径缓存 |
| `features:{window}` | Hash | 5分钟 | 特征缓存 |
| `prediction:{hash}` | String | 1分钟 | 推理结果缓存（相同特征） |
| `metrics:{model_id}:{minute}` | Hash | 1小时 | 模型指标聚合 |

**模型文件缓存**:
- 本地磁盘缓存：/var/cache/ml-models/
- 缓存大小限制：10GB
- LRU淘汰策略
- 启动时预加载生产模型

**特征缓存**:
- 时间窗口特征缓存5分钟
- 避免重复计算
- 使用特征哈希作为Key

### 6.4 Feature Store设计

**特征存储**:
```go
// FeatureStore 特征存储
type FeatureStore struct {
    redis *redis.Client
    ttl   time.Duration
}

// 保存特征
func (fs *FeatureStore) Save(ctx context.Context, key string, features []float32) error {
    data, _ := json.Marshal(features)
    return fs.redis.Set(ctx, "features:"+key, data, fs.ttl).Err()
}

// 获取特征
func (fs *FeatureStore) Get(ctx context.Context, key string) ([]float32, error) {
    data, err := fs.redis.Get(ctx, "features:"+key).Bytes()
    if err != nil {
        return nil, err
    }
    
    var features []float32
    json.Unmarshal(data, &features)
    return features, nil
}
```

**特征定义**:
```yaml
# 异常检测特征
anomaly_features:
  - name: log_count
    type: int
    description: 时间窗口内日志数量
    aggregation: count
    window: 1m
  
  - name: error_rate
    type: float
    description: 错误率
    aggregation: ratio
    window: 1m
  
  - name: avg_latency
    type: float
    description: 平均延迟
    aggregation: avg
    window: 1m
  
  - name: unique_ips
    type: int
    description: 唯一IP数量
    aggregation: count_distinct
    window: 1m
```

---

## 7. 安全设计

### 7.1 模型安全

**模型文件安全**:
- 模型文件签名验证（SHA256）
- 模型文件加密存储（AES-256）
- 模型访问权限控制（RBAC）
- 模型下载审计日志

**模型投毒防护**:
- 训练数据验证和清洗
- 模型输出范围检查
- 异常模型行为检测
- 模型版本回滚机制

### 7.2 数据安全

**训练数据安全**:
- 敏感数据脱敏（PII、密码、密钥）
- 数据访问权限控制
- 数据传输加密（TLS 1.3）
- 数据存储加密

**特征数据安全**:
- 特征数据加密存储
- 特征访问日志记录
- 特征数据定期清理

### 7.3 推理安全

**输入验证**:
```go
// 输入验证器
type InputValidator struct {
    minValues []float32
    maxValues []float32
}

func (v *InputValidator) Validate(features []float32) error {
    if len(features) != len(v.minValues) {
        return errors.New("特征维度不匹配")
    }
    
    for i, val := range features {
        if val < v.minValues[i] || val > v.maxValues[i] {
            return fmt.Errorf("特征%d超出范围: %f", i, val)
        }
    }
    
    return nil
}
```

**输出验证**:
- 预测结果范围检查
- 异常输出告警
- 输出结果审计

### 7.4 访问控制

**RBAC权限模型**:

| 角色 | 权限范围 | 可执行操作 |
|------|----------|------------|
| 数据科学家 | 全部模型 | 训练、评估、注册、部署 |
| ML工程师 | 指定模型 | 部署、监控、回滚 |
| 运维工程师 | 全部模型 | 监控、告警、回滚 |
| 只读用户 | 全部模型 | 查看模型、查看指标 |

**API认证**:
- JWT Token认证
- API Key认证
- OAuth 2.0认证

### 7.5 审计日志

**审计事件**:
```go
// 审计日志
type AuditLog struct {
    Timestamp  time.Time              `json:"timestamp"`
    Module     string                 `json:"module"`     // ml
    Action     string                 `json:"action"`     // train/deploy/predict
    Resource   string                 `json:"resource"`   // 模型ID
    Operator   string                 `json:"operator"`   // 操作人
    IP         string                 `json:"ip"`         // 来源IP
    Before     map[string]interface{} `json:"before"`     // 变更前
    After      map[string]interface{} `json:"after"`      // 变更后
    Result     string                 `json:"result"`     // success/failed
    Error      string                 `json:"error"`      // 错误信息
}
```

**审计范围**:
- 模型训练、部署、删除
- 模型阶段变更
- 推理请求（采样记录）
- 反馈标记
- 配置变更

---

## 8. 性能设计

### 8.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 推理延迟 P95 | < 100ms | Prometheus histogram |
| 推理延迟 P99 | < 500ms | Prometheus histogram |
| 推理吞吐量 | > 1000 QPS | Prometheus counter |
| 模型加载时间 | < 5秒 | 启动时间统计 |
| 模型部署时间 | < 5分钟 | 端到端部署时长 |
| 训练时间（Isolation Forest） | < 10分钟 | 训练任务时长 |
| 训练时间（LSTM） | < 2小时 | 训练任务时长 |
| 特征提取延迟 | < 10ms | 特征提取耗时 |
| 模型准确率 | > 90% | 评估指标 |
| 误报率 | < 5% | 用户反馈统计 |

### 8.2 优化策略

**推理性能优化**:

1. **模型量化**:
```python
# INT8量化
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic

# 动态量化
quantize_dynamic(
    model_input='model.onnx',
    model_output='model_int8.onnx',
    weight_type=QuantType.QInt8
)

# 性能提升：2-4倍
# 内存减少：4倍
# 准确率损失：< 1%
```

2. **批量推理**:
```go
// 批量推理
type BatchInference struct {
    batchSize int
    timeout   time.Duration
    buffer    [][]float32
    mu        sync.Mutex
}

func (bi *BatchInference) Add(features []float32) <-chan *PredictionResult {
    bi.mu.Lock()
    defer bi.mu.Unlock()
    
    bi.buffer = append(bi.buffer, features)
    
    // 达到批次大小或超时，触发推理
    if len(bi.buffer) >= bi.batchSize {
        return bi.flush()
    }
    
    return nil
}

// 性能提升：3-5倍吞吐量
```

3. **模型缓存**:
```go
// 模型缓存
type ModelCache struct {
    cache *lru.Cache
    size  int
}

func (mc *ModelCache) Get(modelID string) (*onnxruntime.Session, error) {
    if session, ok := mc.cache.Get(modelID); ok {
        return session.(*onnxruntime.Session), nil
    }
    
    // 从磁盘加载
    session, err := loadModel(modelID)
    if err != nil {
        return nil, err
    }
    
    mc.cache.Add(modelID, session)
    return session, nil
}

// 性能提升：避免重复加载，减少延迟
```

4. **并发推理**:
```go
// Worker Pool
type InferenceWorkerPool struct {
    workers   int
    taskQueue chan *InferenceTask
    wg        sync.WaitGroup
}

func (iwp *InferenceWorkerPool) Start(ctx context.Context) {
    for i := 0; i < iwp.workers; i++ {
        iwp.wg.Add(1)
        go iwp.worker(ctx, i)
    }
}

// 性能提升：充分利用多核CPU
```

**训练性能优化**:

1. **数据采样**:
- 大数据集采样训练（10万条）
- 分层采样保证数据分布
- 增量训练减少重训时间

2. **并行训练**:
- 多进程并行训练
- GPU加速（PyTorch CUDA）
- 分布式训练（Horovod）

3. **超参数优化**:
- 使用Optuna自动调优
- 贝叶斯优化减少搜索次数
- 早停机制避免过拟合

### 8.3 容量规划

**单节点容量**:
- 推理QPS: 1000
- 并发推理: 100
- 内存占用: 4GB（含模型）
- CPU核心: 8核

**集群容量**:
- 推理节点: 3-10（根据负载动态扩缩容）
- 训练节点: 2（GPU节点）
- 总QPS: 3000-10000

**存储容量**:
- 模型文件: 100GB（MinIO）
- 训练数据: 1TB（ES）
- 元数据: 50GB（PostgreSQL）
- 特征缓存: 16GB（Redis）

---

## 9. 部署方案

### 9.1 部署架构

```
┌─────────────────────────────────────────────────────────┐
│                    负载均衡层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Nginx 1  │  │ Nginx 2  │  │ Nginx 3  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────────┐
│                    推理服务层                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Inference │  │Inference │  │Inference │              │
│  │ Server 1 │  │ Server 2 │  │ Server 3 │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────────┐
│                    训练服务层                            │
│  ┌──────────┐  ┌──────────┐                            │
│  │ Training │  │ Training │                            │
│  │ Server 1 │  │ Server 2 │                            │
│  │ (GPU)    │  │ (GPU)    │                            │
│  └──────────┘  └──────────┘                            │
└─────────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────────┐
│                    MLflow层                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ Tracking │  │  Model   │  │  UI      │              │
│  │ Server   │  │ Registry │  │ Server   │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────────────┐
│                    存储层                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │PostgreSQL│  │  MinIO   │  │  Redis   │              │
│  │ Cluster  │  │ Cluster  │  │ Cluster  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
```

### 9.2 资源配置

| 组件 | 副本数 | CPU | 内存 | 存储 | GPU | 备注 |
|------|--------|-----|------|------|-----|------|
| Inference Server | 3-10 | 8核 | 8GB | 50GB SSD | - | 自动扩缩容 |
| Training Server | 2 | 16核 | 32GB | 200GB SSD | 1x V100 | GPU节点 |
| MLflow Tracking | 2 | 4核 | 8GB | - | - | 高可用 |
| MLflow UI | 2 | 2核 | 4GB | - | - | 高可用 |
| PostgreSQL | 3 | 8核 | 16GB | 100GB SSD | - | 主从复制 |
| MinIO | 4 | 4核 | 8GB | 1TB HDD | - | 分布式存储 |
| Redis | 3 | 4核 | 16GB | - | - | 集群模式 |

### 9.3 配置管理

**配置热更新（推荐方式）**:

模块20支持通过Redis Pub/Sub实现配置热更新，无需重启服务。详细设计见第11节"配置热更新详细设计"。

**热更新优势**:
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（< 30秒，下次评估周期）
- ✅ 不影响正在进行的推理操作
- ✅ 支持配置验证和自动回滚
- ✅ 记录完整的审计日志

**热更新流程**:
1. 用户通过API修改配置
2. 配置验证（范围检查、规则检查）
3. 保存到PostgreSQL（版本化）
4. 更新Redis缓存
5. Redis发布Pub/Sub通知（`config:ml:reload`）
6. 所有服务实例订阅到通知
7. 重新加载配置并验证
8. 使用atomic.Value原子更新配置
9. 记录配置变更审计日志
10. 配置在30秒内生效

**支持热更新的配置项**（共30+项）:

| 配置组 | 配置项 | 热更新支持 |
|--------|--------|-----------|
| **推理服务配置** | batch_size、max_batch_wait_ms、model_cache_size、inference_timeout_ms、max_concurrent_requests | ✅ 支持 |
| **模型管理配置** | model_registry_url、model_storage_path、model_download_timeout、model_cache_ttl | ✅ 支持 |
| **特征工程配置** | feature_extraction_timeout、feature_cache_enabled、feature_cache_ttl | ✅ 支持 |
| **训练配置** | max_training_jobs、training_timeout、auto_deploy_enabled、hyperparameter_tuning_enabled | ✅ 支持 |
| **监控配置** | metrics_enabled、metrics_port、health_check_interval、data_drift_threshold | ✅ 支持 |
| **告警规则配置** | alert_rules、alert_evaluation_interval、alert_notification_enabled、alert_silence_duration | ✅ 支持 |

**ConfigMap（备选方式）**:

当热更新机制不可用时（如Redis故障），可以通过修改ConfigMap并重启Pod来更新配置：

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ml-config
  namespace: log-management
data:
  ml-config.yaml: |
    # 推理服务配置（✅ 支持热更新）
    inference:
      batch_size: 32                      # ✅ 支持热更新
      max_batch_wait_ms: 100              # ✅ 支持热更新
      model_cache_size: 10                # ✅ 支持热更新
      inference_timeout_ms: 1000          # ✅ 支持热更新
      max_concurrent_requests: 100        # ✅ 支持热更新
      enable_gpu: false                   # ❌ 不推荐热更新（需要重建推理引擎）
    
    # 模型管理配置
    model:
      registry_url: "http://mlflow:5000"  # ❌ 不推荐热更新（需要重建连接）
      storage_path: "s3://models"         # ❌ 不推荐热更新（需要重建存储客户端）
      download_timeout: 300               # ✅ 支持热更新
      cache_ttl: 3600                     # ✅ 支持热更新
      auto_reload: true                   # ✅ 支持热更新
    
    # 特征工程配置（✅ 支持热更新）
    feature:
      extraction_timeout: 5000            # ✅ 支持热更新
      cache_enabled: true                 # ✅ 支持热更新
      cache_ttl: 300                      # ✅ 支持热更新
      normalization_method: "standard"    # ✅ 支持热更新
    
    # 训练配置（✅ 支持热更新）
    training:
      max_training_jobs: 5                # ✅ 支持热更新
      training_timeout: 3600              # ✅ 支持热更新
      auto_deploy_enabled: false          # ✅ 支持热更新
      hyperparameter_tuning_enabled: true # ✅ 支持热更新
      early_stopping_patience: 10         # ✅ 支持热更新
    
    # 监控配置
    monitoring:
      metrics_enabled: true               # ✅ 支持热更新
      metrics_port: 9090                  # ❌ 不推荐热更新（需要重新绑定端口）
      health_check_interval: 30           # ✅ 支持热更新
      data_drift_threshold: 0.1           # ✅ 支持热更新
      model_performance_check_interval: 300  # ✅ 支持热更新
    
    # 告警配置（✅ 支持热更新）
    alerting:
      enabled: true                       # ✅ 支持热更新
      evaluation_interval: 30             # ✅ 支持热更新
      notification_enabled: true          # ✅ 支持热更新
      silence_duration: 3600              # ✅ 支持热更新
      
      # 告警规则（✅ 支持热更新 - 动态加载）
      rules:
        - id: "inference_latency_high"
          name: "推理延迟过高"
          metric: "ml_inference_duration_seconds"
          operator: ">"
          threshold: 1.0
          duration: 300
          severity: "warning"
          enabled: true
        
        - id: "model_accuracy_low"
          name: "模型准确率下降"
          metric: "ml_model_accuracy"
          operator: "<"
          threshold: 0.85
          duration: 600
          severity: "critical"
          enabled: true
    
    # 数据源配置（❌ 不推荐热更新）
    datasource:
      kafka_brokers:                      # ❌ 不推荐热更新（需要重建连接）
        - kafka-0:9092
        - kafka-1:9092
      elasticsearch_url: "http://es:9200"  # ❌ 不推荐热更新（需要重建连接）
      redis_url: "redis://redis:6379"     # ❌ 不推荐热更新（需要重建连接）
      postgres_url: "postgres://pg:5432"  # ❌ 不推荐热更新（需要重建连接）
```

**更新ConfigMap后重启Pod**:
```bash
# 编辑ConfigMap
kubectl edit configmap ml-config -n log-management

# 重启推理服务Pod
kubectl rollout restart deployment/ml-inference-server -n log-management

# 重启训练服务Pod
kubectl rollout restart deployment/ml-training-server -n log-management

# 查看重启状态
kubectl rollout status deployment/ml-inference-server -n log-management
```

**配置优先级**:

模块20的配置加载优先级（从高到低）：
1. **热更新配置**（PostgreSQL + Redis）- 最高优先级
2. **ConfigMap配置**（Kubernetes ConfigMap）- 中等优先级
3. **环境变量**（Kubernetes Env）- 较低优先级
4. **默认配置**（代码内置）- 最低优先级

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
| MLflow连接配置 | 需要重建MLflow客户端连接 | 修改ConfigMap并重启Pod |
| 数据源连接配置（Kafka/ES/Redis/PostgreSQL） | 需要重建数据源连接 | 修改ConfigMap并重启Pod |
| 模型存储路径 | 需要重建存储客户端 | 修改ConfigMap并重启Pod |
| GPU配置 | 需要重建推理引擎 | 修改ConfigMap并重启Pod |
| 监听端口 | 需要重新绑定端口 | 修改ConfigMap并重启Pod |
| 资源配额（CPU/内存/GPU） | 需要Pod重建 | 修改Deployment并滚动更新 |

**Secret管理**:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ml-secret
  namespace: log-management
type: Opaque
data:
  mlflow-username: <base64-encoded>
  mlflow-password: <base64-encoded>
  minio-access-key: <base64-encoded>
  minio-secret-key: <base64-encoded>
  postgres-password: <base64-encoded>
  redis-password: <base64-encoded>
  kafka-password: <base64-encoded>
```

**注意**: Secret中的敏感信息（数据库密码、API密钥等）不推荐热更新，建议通过Secret更新并重启服务。

**配置热更新API示例**:

```bash
# 查询当前配置
curl -X GET "http://api/v1/ml/config"

# 更新单个配置项
curl -X PUT "http://api/v1/ml/config" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_size": 64
  }'

# 批量更新配置
curl -X PUT "http://api/v1/ml/config" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_size": 64,
    "max_batch_wait_ms": 200,
    "inference_timeout_ms": 2000,
    "model_cache_size": 20
  }'

# 更新告警规则（热更新）
curl -X PUT "http://api/v1/ml/config/alert-rules" \
  -H "Content-Type: application/json" \
  -d '{
    "rules": [
      {
        "id": "inference_latency_high",
        "threshold": 2.0,
        "enabled": true
      }
    ]
  }'

# 查询配置历史
curl -X GET "http://api/v1/ml/config/history"

# 回滚配置
curl -X POST "http://api/v1/ml/config/rollback" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 5
  }'
```

### 9.4 发布策略

**配置更新策略**:

模块20的配置更新优先使用**热更新机制**，无需重启Pod：

| 更新场景 | 推荐方式 | 生效时间 | 服务影响 |
|---------|---------|---------|---------|
| 业务配置（推理参数、告警规则、监控配置等） | ✅ 热更新 | < 30秒 | 无影响 |
| 连接配置（MLflow、Kafka、ES、Redis、PostgreSQL） | ❌ ConfigMap + 重启 | 2-5分钟 | 滚动重启 |
| 资源配额（CPU、内存、GPU） | ❌ Deployment + 重启 | 3-10分钟 | 滚动重启 |
| 代码更新 | ❌ 镜像 + 滚动更新 | 5-15分钟 | 滚动重启 |

**热更新优势**:
- ✅ 无需重启Pod，服务不中断
- ✅ 生效速度快（< 30秒）
- ✅ 不影响正在进行的推理操作
- ✅ 支持配置验证和自动回滚

详细配置管理说明见第9.3节。

**灰度发布流程**（用于模型更新）:
```
1. 模型训练完成，注册到MLflow
2. 设置模型阶段为"Staging"
3. 在Staging环境测试（10%流量）
4. 监控指标24小时
   ├─ 准确率对比
   ├─ 延迟对比
   └─ 错误率对比
5. 指标正常，扩大到50%流量
6. 继续监控24小时
7. 指标正常，设置为"Production"（100%流量）
8. 旧模型设置为"Archived"
```

**滚动更新流程**（用于代码更新）:
```bash
# 1. 更新镜像
kubectl set image deployment/ml-inference-server \
  inference-server=log-management/ml-inference-server:v1.1.0 \
  -n log-management

# 2. 查看滚动更新状态
kubectl rollout status deployment/ml-inference-server -n log-management

# 3. 验证新版本
kubectl get pods -n log-management -l app=ml-inference-server

# 4. 如果需要回滚
kubectl rollout undo deployment/ml-inference-server -n log-management
```

**回滚策略**:
- 自动回滚条件：准确率下降 > 5% 或 延迟增加 > 50%
- 手动回滚：5分钟内完成
- 回滚验证：健康检查 + 推理测试

---

## 10. 监控与运维

### 10.1 监控指标

**推理服务指标**:
```prometheus
# 推理请求总数
ml_inference_requests_total{model_id="anomaly-detector-v1",status="success"}

# 推理延迟
ml_inference_duration_seconds{model_id="anomaly-detector-v1"}

# 推理错误率
ml_inference_errors_total{model_id="anomaly-detector-v1",error_type="timeout"}

# 模型加载次数
ml_model_loads_total{model_id="anomaly-detector-v1"}

# 批量推理大小
ml_batch_size{model_id="anomaly-detector-v1"}
```

**模型性能指标**:
```prometheus
# 模型准确率
ml_model_accuracy{model_id="anomaly-detector-v1"}

# 模型精确率
ml_model_precision{model_id="anomaly-detector-v1"}

# 模型召回率
ml_model_recall{model_id="anomaly-detector-v1"}

# 模型F1分数
ml_model_f1_score{model_id="anomaly-detector-v1"}

# 误报率
ml_false_positive_rate{model_id="anomaly-detector-v1"}
```

**训练任务指标**:
```prometheus
# 训练任务总数
ml_training_jobs_total{model_type="anomaly",status="success"}

# 训练时长
ml_training_duration_seconds{model_type="anomaly"}

# 训练失败次数
ml_training_failures_total{model_type="anomaly"}
```

**数据漂移指标**:
```prometheus
# 数据漂移检测
ml_data_drift_detected{model_id="anomaly-detector-v1",feature="error_rate"}

# 漂移分数
ml_drift_score{model_id="anomaly-detector-v1",feature="error_rate"}
```

### 10.2 告警规则（支持热更新）

**内置告警规则**:

| 告警 | 条件 | 级别 | 处理 | 热更新 |
|------|------|------|------|--------|
| 推理延迟过高 | P99 > 1s 持续5分钟 | Warning | 检查模型复杂度，增加节点 | ✅ 支持 |
| 推理错误率高 | 错误率 > 1% 持续5分钟 | Critical | 检查模型文件，回滚模型 | ✅ 支持 |
| 模型准确率下降 | 准确率下降 > 5% | Critical | 自动回滚，分析原因 | ✅ 支持 |
| 数据漂移检测 | 漂移分数 > 阈值 | Warning | 触发模型重训 | ✅ 支持 |
| 训练任务失败 | 训练失败 | Warning | 检查训练日志，重试 | ✅ 支持 |
| 模型加载失败 | 模型加载失败 | Critical | 检查模型文件，使用备份 | ✅ 支持 |
| 特征提取失败 | 特征提取失败率 > 1% | Warning | 检查数据源，修复逻辑 | ✅ 支持 |
| 反馈样本积累 | 反馈样本 > 1000 | Info | 触发增量训练 | ✅ 支持 |

**自定义告警规则示例**:

```yaml
# 示例1：模型精确率告警
- id: precision-drop-alert
  name: 模型精确率下降告警
  enabled: true
  model_type: anomaly
  metric: precision
  operator: "<"
  threshold: 0.90
  duration: 600
  severity: warning
  actions:
    - type: webhook
      config:
        url: https://alert.example.com/webhook
    - type: email
      config:
        to: ["ml-team@example.com"]

# 示例2：推理吞吐量告警
- id: throughput-low-alert
  name: 推理吞吐量过低告警
  enabled: true
  model_type: "*"
  metric: throughput
  operator: "<"
  threshold: 500  # QPS
  duration: 300
  severity: warning
  actions:
    - type: slack
      config:
        webhook_url: https://hooks.slack.com/services/xxx
        channel: "#ml-ops"

# 示例3：F1分数告警
- id: f1-score-drop-alert
  name: F1分数下降告警
  enabled: true
  model_type: clustering
  metric: f1_score
  operator: "<"
  threshold: 0.85
  duration: 600
  severity: critical
  actions:
    - type: auto_rollback
      config:
        enabled: true
    - type: webhook
      config:
        url: https://alert.example.com/webhook
```

**告警动作类型**:

| 动作类型 | 说明 | 配置示例 |
|---------|------|----------|
| webhook | HTTP回调通知 | `{"url": "https://...", "method": "POST"}` |
| email | 邮件通知 | `{"to": ["user@example.com"], "subject": "..."}` |
| slack | Slack通知 | `{"webhook_url": "https://...", "channel": "#alerts"}` |
| auto_rollback | 自动回滚模型 | `{"enabled": true}` |
| auto_retrain | 自动触发重训 | `{"enabled": true, "delay": 3600}` |

**告警规则热更新流程**:

```
1. 用户通过API创建/更新告警规则
2. 规则保存到PostgreSQL（版本化）
3. 规则同步到Redis
4. Redis发布Pub/Sub通知（alert:rules:reload）
5. 告警管理器订阅通知
6. 加载新规则并验证
7. 使用atomic.Value原子更新规则列表
8. 下次评估周期生效（30秒内）
9. 记录规则变更审计日志

热更新时间: < 30秒（下次评估周期）
```

### 10.3 Grafana仪表盘

**推理服务仪表盘**:
- 推理QPS趋势图
- 推理延迟分布图（P50/P95/P99）
- 推理错误率趋势图
- 模型版本分布图
- 批量推理大小分布图

**模型性能仪表盘**:
- 模型准确率趋势图
- 精确率/召回率/F1分数对比图
- 误报率/漏报率趋势图
- 用户反馈统计图
- 模型对比图（新旧版本）

**训练任务仪表盘**:
- 训练任务状态分布图
- 训练时长趋势图
- 训练成功率趋势图
- 模型指标对比图

**数据漂移仪表盘**:
- 特征分布对比图
- 漂移分数趋势图
- 漂移检测告警图

### 10.4 运维手册

**常见问题处理**:

1. **推理延迟过高**:
   - 检查模型是否量化
   - 检查批量推理配置
   - 增加推理节点
   - 检查网络延迟

2. **模型准确率下降**:
   - 检查数据漂移
   - 分析用户反馈
   - 回滚到上一版本
   - 触发模型重训

3. **训练任务失败**:
   - 检查训练日志
   - 检查数据源连接
   - 检查GPU资源
   - 调整超参数

4. **模型加载失败**:
   - 检查模型文件完整性
   - 检查MinIO连接
   - 检查磁盘空间
   - 使用备份模型

**健康检查**:
```bash
# 推理服务健康检查
curl http://inference-server:8080/health

# 响应示例
{
  "status": "healthy",
  "version": "1.0.0",
  "models_loaded": 3,
  "uptime": "72h30m",
  "dependencies": {
    "mlflow": "healthy",
    "minio": "healthy",
    "redis": "healthy"
  }
}
```

---

## 11. 配置热更新详细设计

### 11.1 可热更新配置项

**推理服务配置**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| inference_enabled | bool | true | 是否启用推理服务 |
| batch_size | int | 32 | 批量推理大小 |
| batch_timeout | int | 100 | 批量超时时间（毫秒） |
| max_workers | int | 10 | 推理Worker数量 |
| model_cache_size | int | 10 | 模型缓存大小 |
| quantization_enabled | bool | false | 是否启用模型量化 |
| anomaly_threshold | float | -0.5 | 异常检测阈值 |
| prediction_window | int | 3600 | 预测时间窗口（秒） |

**模型管理配置**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| auto_deploy | bool | false | 是否自动部署新模型 |
| staging_traffic_ratio | float | 0.1 | Staging环境流量比例 |
| rollback_threshold | float | 0.05 | 自动回滚阈值（准确率下降） |
| model_retention_days | int | 90 | 模型保留天数 |
| drift_detection_enabled | bool | true | 是否启用数据漂移检测 |
| drift_check_interval | int | 3600 | 漂移检测间隔（秒） |

**训练配置**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| training_enabled | bool | true | 是否启用训练服务 |
| max_concurrent_jobs | int | 2 | 最大并发训练任务数 |
| auto_retrain_enabled | bool | true | 是否启用自动重训 |
| retrain_sample_threshold | int | 1000 | 触发重训的样本数阈值 |
| retrain_interval_days | int | 7 | 定期重训间隔（天） |
| gpu_enabled | bool | true | 是否使用GPU训练 |

**特征工程配置**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| feature_cache_enabled | bool | true | 是否启用特征缓存 |
| feature_cache_ttl | int | 300 | 特征缓存TTL（秒） |
| feature_window | int | 60 | 特征时间窗口（秒） |
| feature_aggregation | string | "avg" | 特征聚合方式 |

**监控配置**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| metrics_enabled | bool | true | 是否启用指标采集 |
| metrics_interval | int | 60 | 指标采集间隔（秒） |
| prediction_sampling_rate | float | 0.1 | 推理记录采样率 |
| alert_enabled | bool | true | 是否启用告警 |

**告警规则配置（支持热更新）**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| alert_rules | array | [] | 告警规则列表（支持热更新） |
| alert_evaluation_interval | int | 30 | 告警评估间隔（秒） |
| alert_notification_enabled | bool | true | 是否启用告警通知 |
| alert_notification_channels | array | ["webhook"] | 告警通知渠道 |
| alert_aggregation_window | int | 300 | 告警聚合窗口（秒） |
| alert_silence_duration | int | 3600 | 告警静默时长（秒） |

### 11.2 热更新实现

**配置管理器**:
```go
// internal/ml/config/manager.go
package config

import (
    "context"
    "encoding/json"
    "sync/atomic"
    "time"
    
    "github.com/redis/go-redis/v9"
)

// MLConfig ML配置
type MLConfig struct {
    // 推理配置
    InferenceEnabled      bool    `json:"inference_enabled"`
    BatchSize             int     `json:"batch_size"`
    BatchTimeout          int     `json:"batch_timeout"`
    MaxWorkers            int     `json:"max_workers"`
    ModelCacheSize        int     `json:"model_cache_size"`
    QuantizationEnabled   bool    `json:"quantization_enabled"`
    AnomalyThreshold      float64 `json:"anomaly_threshold"`
    PredictionWindow      int     `json:"prediction_window"`
    
    // 模型管理配置
    AutoDeploy            bool    `json:"auto_deploy"`
    StagingTrafficRatio   float64 `json:"staging_traffic_ratio"`
    RollbackThreshold     float64 `json:"rollback_threshold"`
    ModelRetentionDays    int     `json:"model_retention_days"`
    DriftDetectionEnabled bool    `json:"drift_detection_enabled"`
    DriftCheckInterval    int     `json:"drift_check_interval"`
    
    // 训练配置
    TrainingEnabled       bool    `json:"training_enabled"`
    MaxConcurrentJobs     int     `json:"max_concurrent_jobs"`
    AutoRetrainEnabled    bool    `json:"auto_retrain_enabled"`
    RetrainSampleThreshold int    `json:"retrain_sample_threshold"`
    RetrainIntervalDays   int     `json:"retrain_interval_days"`
    GPUEnabled            bool    `json:"gpu_enabled"`
    
    // 特征工程配置
    FeatureCacheEnabled   bool    `json:"feature_cache_enabled"`
    FeatureCacheTTL       int     `json:"feature_cache_ttl"`
    FeatureWindow         int     `json:"feature_window"`
    FeatureAggregation    string  `json:"feature_aggregation"`
    
    // 监控配置
    MetricsEnabled        bool    `json:"metrics_enabled"`
    MetricsInterval       int     `json:"metrics_interval"`
    PredictionSamplingRate float64 `json:"prediction_sampling_rate"`
    AlertEnabled          bool    `json:"alert_enabled"`
    
    // 告警规则配置（支持热更新）
    AlertRules            []AlertRule `json:"alert_rules"`
    AlertEvaluationInterval int       `json:"alert_evaluation_interval"`
    AlertNotificationEnabled bool     `json:"alert_notification_enabled"`
    AlertNotificationChannels []string `json:"alert_notification_channels"`
    AlertAggregationWindow int        `json:"alert_aggregation_window"`
    AlertSilenceDuration  int         `json:"alert_silence_duration"`
}

// AlertRule 告警规则
type AlertRule struct {
    ID          string                 `json:"id"`
    Name        string                 `json:"name"`
    Enabled     bool                   `json:"enabled"`
    ModelType   string                 `json:"model_type"`   // anomaly/clustering/prediction
    Metric      string                 `json:"metric"`       // accuracy/latency/error_rate/drift_score
    Operator    string                 `json:"operator"`     // >, <, >=, <=, ==
    Threshold   float64                `json:"threshold"`
    Duration    int                    `json:"duration"`     // 持续时间（秒）
    Severity    string                 `json:"severity"`     // critical/warning/info
    Description string                 `json:"description"`
    Labels      map[string]string      `json:"labels"`
    Annotations map[string]string      `json:"annotations"`
    Actions     []AlertAction          `json:"actions"`      // 告警动作
}

// AlertAction 告警动作
type AlertAction struct {
    Type   string                 `json:"type"`   // webhook/email/slack/auto_rollback/auto_retrain
    Config map[string]interface{} `json:"config"` // 动作配置
}

// ConfigManager 配置管理器
type ConfigManager struct {
    config      atomic.Value // 存储 *MLConfig
    redis       *redis.Client
    db          *sql.DB
    subscribers []chan *MLConfig
    mu          sync.RWMutex
}

// NewConfigManager 创建配置管理器
func NewConfigManager(redis *redis.Client, db *sql.DB) *ConfigManager {
    cm := &ConfigManager{
        redis:       redis,
        db:          db,
        subscribers: make([]chan *MLConfig, 0),
    }
    
    // 加载初始配置
    config, err := cm.loadConfigFromDB()
    if err != nil {
        log.Fatal("加载配置失败", err)
    }
    cm.config.Store(config)
    
    // 启动配置监听
    go cm.subscribeConfigChanges()
    
    return cm
}

// GetConfig 获取当前配置
func (cm *ConfigManager) GetConfig() *MLConfig {
    return cm.config.Load().(*MLConfig)
}

// UpdateConfig 更新配置
func (cm *ConfigManager) UpdateConfig(ctx context.Context, newConfig *MLConfig) error {
    // 验证配置
    if err := cm.validateConfig(newConfig); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 保存到数据库（版本化）
    if err := cm.saveConfigToDB(ctx, newConfig); err != nil {
        return fmt.Errorf("保存配置失败: %w", err)
    }
    
    // 发布到Redis
    if err := cm.publishConfig(ctx, newConfig); err != nil {
        return fmt.Errorf("发布配置失败: %w", err)
    }
    
    // 记录审计日志
    cm.logConfigChange(cm.GetConfig(), newConfig)
    
    return nil
}

// subscribeConfigChanges 订阅配置变更
func (cm *ConfigManager) subscribeConfigChanges() {
    pubsub := cm.redis.Subscribe(context.Background(), "config:ml:reload")
    defer pubsub.Close()
    
    for msg := range pubsub.Channel() {
        // 从Redis加载新配置
        newConfig, err := cm.loadConfigFromRedis()
        if err != nil {
            log.Error("加载配置失败", err)
            continue
        }
        
        // 验证配置
        if err := cm.validateConfig(newConfig); err != nil {
            log.Error("配置验证失败", err)
            continue
        }
        
        // 原子更新配置
        oldConfig := cm.GetConfig()
        cm.config.Store(newConfig)
        
        log.Info("配置已更新",
            "old_batch_size", oldConfig.BatchSize,
            "new_batch_size", newConfig.BatchSize,
            "old_threshold", oldConfig.AnomalyThreshold,
            "new_threshold", newConfig.AnomalyThreshold,
            "alert_rules_count", len(newConfig.AlertRules))
        
        // 通知订阅者
        cm.notifySubscribers(newConfig)
    }
}

// Subscribe 订阅配置变更
func (cm *ConfigManager) Subscribe() <-chan *MLConfig {
    cm.mu.Lock()
    defer cm.mu.Unlock()
    
    ch := make(chan *MLConfig, 1)
    cm.subscribers = append(cm.subscribers, ch)
    return ch
}

// notifySubscribers 通知订阅者
func (cm *ConfigManager) notifySubscribers(config *MLConfig) {
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

// validateConfig 验证配置
func (cm *ConfigManager) validateConfig(config *MLConfig) error {
    if config.BatchSize <= 0 || config.BatchSize > 1000 {
        return errors.New("batch_size必须在1-1000之间")
    }
    
    if config.BatchTimeout <= 0 || config.BatchTimeout > 10000 {
        return errors.New("batch_timeout必须在1-10000毫秒之间")
    }
    
    if config.MaxWorkers <= 0 || config.MaxWorkers > 100 {
        return errors.New("max_workers必须在1-100之间")
    }
    
    if config.AnomalyThreshold < -1.0 || config.AnomalyThreshold > 1.0 {
        return errors.New("anomaly_threshold必须在-1.0到1.0之间")
    }
    
    if config.StagingTrafficRatio < 0.0 || config.StagingTrafficRatio > 1.0 {
        return errors.New("staging_traffic_ratio必须在0.0到1.0之间")
    }
    
    // 验证告警规则
    for i, rule := range config.AlertRules {
        if err := cm.validateAlertRule(&rule); err != nil {
            return fmt.Errorf("告警规则[%d]验证失败: %w", i, err)
        }
    }
    
    return nil
}

// validateAlertRule 验证告警规则
func (cm *ConfigManager) validateAlertRule(rule *AlertRule) error {
    if rule.ID == "" {
        return errors.New("告警规则ID不能为空")
    }
    
    if rule.Name == "" {
        return errors.New("告警规则名称不能为空")
    }
    
    validMetrics := map[string]bool{
        "accuracy": true, "precision": true, "recall": true, "f1_score": true,
        "latency": true, "error_rate": true, "drift_score": true,
    }
    if !validMetrics[rule.Metric] {
        return fmt.Errorf("不支持的指标: %s", rule.Metric)
    }
    
    validOperators := map[string]bool{
        ">": true, "<": true, ">=": true, "<=": true, "==": true,
    }
    if !validOperators[rule.Operator] {
        return fmt.Errorf("不支持的操作符: %s", rule.Operator)
    }
    
    if rule.Duration <= 0 {
        return errors.New("持续时间必须大于0")
    }
    
    validSeverities := map[string]bool{
        "critical": true, "warning": true, "info": true,
    }
    if !validSeverities[rule.Severity] {
        return fmt.Errorf("不支持的严重级别: %s", rule.Severity)
    }
    
    // 验证告警动作
    for i, action := range rule.Actions {
        if err := cm.validateAlertAction(&action); err != nil {
            return fmt.Errorf("告警动作[%d]验证失败: %w", i, err)
        }
    }
    
    return nil
}

// validateAlertAction 验证告警动作
func (cm *ConfigManager) validateAlertAction(action *AlertAction) error {
    validActions := map[string]bool{
        "webhook": true, "email": true, "slack": true,
        "auto_rollback": true, "auto_retrain": true,
    }
    if !validActions[action.Type] {
        return fmt.Errorf("不支持的告警动作: %s", action.Type)
    }
    
    // 验证动作配置
    switch action.Type {
    case "webhook":
        if _, ok := action.Config["url"]; !ok {
            return errors.New("webhook动作缺少url配置")
        }
    case "email":
        if _, ok := action.Config["to"]; !ok {
            return errors.New("email动作缺少to配置")
        }
    case "slack":
        if _, ok := action.Config["webhook_url"]; !ok {
            return errors.New("slack动作缺少webhook_url配置")
        }
    }
    
    return nil
}

// loadConfigFromDB 从数据库加载配置
func (cm *ConfigManager) loadConfigFromDB() (*MLConfig, error) {
    var configJSON string
    err := cm.db.QueryRow(`
        SELECT config FROM ml_configs 
        WHERE id = 'default' 
        ORDER BY version DESC 
        LIMIT 1
    `).Scan(&configJSON)
    
    if err != nil {
        return nil, err
    }
    
    var config MLConfig
    if err := json.Unmarshal([]byte(configJSON), &config); err != nil {
        return nil, err
    }
    
    return &config, nil
}

// saveConfigToDB 保存配置到数据库
func (cm *ConfigManager) saveConfigToDB(ctx context.Context, config *MLConfig) error {
    configJSON, err := json.Marshal(config)
    if err != nil {
        return err
    }
    
    _, err = cm.db.ExecContext(ctx, `
        INSERT INTO ml_configs (id, config, version, created_at, created_by)
        VALUES ('default', $1, 
                (SELECT COALESCE(MAX(version), 0) + 1 FROM ml_configs WHERE id = 'default'),
                NOW(), 'system')
    `, string(configJSON))
    
    return err
}

// publishConfig 发布配置到Redis
func (cm *ConfigManager) publishConfig(ctx context.Context, config *MLConfig) error {
    configJSON, err := json.Marshal(config)
    if err != nil {
        return err
    }
    
    // 保存到Redis
    if err := cm.redis.Set(ctx, "config:ml", string(configJSON), 0).Err(); err != nil {
        return err
    }
    
    // 发布通知
    return cm.redis.Publish(ctx, "config:ml:reload", "reload").Err()
}

// logConfigChange 记录配置变更
func (cm *ConfigManager) logConfigChange(oldConfig, newConfig *MLConfig) {
    auditLog := &AuditLog{
        Timestamp: time.Now(),
        Module:    "ml",
        Action:    "config_update",
        Resource:  "ml_config",
        Operator:  "system",
        Before:    configToMap(oldConfig),
        After:     configToMap(newConfig),
        Result:    "success",
    }
    
    logAudit(auditLog)
}
```

**告警规则管理器（支持热更新）**:
```go
// internal/ml/alert/manager.go
package alert

import (
    "context"
    "sync"
    "sync/atomic"
    "time"
    
    "github.com/your-org/log-management/internal/ml/config"
)

// AlertManager 告警管理器
type AlertManager struct {
    config        atomic.Value // 存储 []config.AlertRule
    configManager *config.ConfigManager
    evaluator     *AlertEvaluator
    notifier      *AlertNotifier
    silences      sync.Map // 告警静默记录
    mu            sync.RWMutex
}

// NewAlertManager 创建告警管理器
func NewAlertManager(configManager *config.ConfigManager) *AlertManager {
    am := &AlertManager{
        configManager: configManager,
        evaluator:     NewAlertEvaluator(),
        notifier:      NewAlertNotifier(),
    }
    
    // 加载初始告警规则
    am.config.Store(configManager.GetConfig().AlertRules)
    
    // 订阅配置变更
    go am.watchConfigChanges()
    
    // 启动告警评估
    go am.startEvaluation()
    
    return am
}

// watchConfigChanges 监听配置变更
func (am *AlertManager) watchConfigChanges() {
    configChan := am.configManager.Subscribe()
    
    for newConfig := range configChan {
        oldRules := am.GetAlertRules()
        newRules := newConfig.AlertRules
        
        // 原子更新告警规则
        am.config.Store(newRules)
        
        log.Info("告警规则已更新",
            "old_count", len(oldRules),
            "new_count", len(newRules))
        
        // 记录规则变更
        am.logRuleChanges(oldRules, newRules)
    }
}

// GetAlertRules 获取当前告警规则
func (am *AlertManager) GetAlertRules() []config.AlertRule {
    return am.config.Load().([]config.AlertRule)
}

// startEvaluation 启动告警评估
func (am *AlertManager) startEvaluation() {
    ticker := time.NewTicker(30 * time.Second)
    defer ticker.Stop()
    
    for range ticker.C {
        rules := am.GetAlertRules()
        
        for _, rule := range rules {
            if !rule.Enabled {
                continue
            }
            
            // 检查是否在静默期
            if am.isSilenced(rule.ID) {
                continue
            }
            
            // 评估告警规则
            if am.evaluator.Evaluate(&rule) {
                // 触发告警
                am.triggerAlert(&rule)
            }
        }
    }
}

// triggerAlert 触发告警
func (am *AlertManager) triggerAlert(rule *config.AlertRule) {
    log.Warn("告警触发",
        "rule_id", rule.ID,
        "rule_name", rule.Name,
        "severity", rule.Severity)
    
    // 执行告警动作
    for _, action := range rule.Actions {
        if err := am.executeAction(rule, &action); err != nil {
            log.Error("执行告警动作失败",
                "rule_id", rule.ID,
                "action_type", action.Type,
                "error", err)
        }
    }
    
    // 设置静默期
    am.setSilence(rule.ID, time.Duration(am.configManager.GetConfig().AlertSilenceDuration)*time.Second)
}

// executeAction 执行告警动作
func (am *AlertManager) executeAction(rule *config.AlertRule, action *config.AlertAction) error {
    switch action.Type {
    case "webhook":
        return am.notifier.SendWebhook(rule, action.Config)
    case "email":
        return am.notifier.SendEmail(rule, action.Config)
    case "slack":
        return am.notifier.SendSlack(rule, action.Config)
    case "auto_rollback":
        return am.executeAutoRollback(rule)
    case "auto_retrain":
        return am.executeAutoRetrain(rule)
    default:
        return fmt.Errorf("不支持的告警动作: %s", action.Type)
    }
}

// executeAutoRollback 执行自动回滚
func (am *AlertManager) executeAutoRollback(rule *config.AlertRule) error {
    log.Info("执行自动回滚", "rule_id", rule.ID)
    
    // 调用模型管理器执行回滚
    // modelManager.Rollback(ctx, rule.ModelType)
    
    return nil
}

// executeAutoRetrain 执行自动重训
func (am *AlertManager) executeAutoRetrain(rule *config.AlertRule) error {
    log.Info("触发自动重训", "rule_id", rule.ID)
    
    // 调用训练服务触发重训
    // trainingService.TriggerRetrain(ctx, rule.ModelType)
    
    return nil
}

// isSilenced 检查是否在静默期
func (am *AlertManager) isSilenced(ruleID string) bool {
    if val, ok := am.silences.Load(ruleID); ok {
        silenceUntil := val.(time.Time)
        return time.Now().Before(silenceUntil)
    }
    return false
}

// setSilence 设置静默期
func (am *AlertManager) setSilence(ruleID string, duration time.Duration) {
    am.silences.Store(ruleID, time.Now().Add(duration))
}

// logRuleChanges 记录规则变更
func (am *AlertManager) logRuleChanges(oldRules, newRules []config.AlertRule) {
    // 构建规则映射
    oldMap := make(map[string]config.AlertRule)
    for _, rule := range oldRules {
        oldMap[rule.ID] = rule
    }
    
    newMap := make(map[string]config.AlertRule)
    for _, rule := range newRules {
        newMap[rule.ID] = rule
    }
    
    // 检测新增规则
    for id, rule := range newMap {
        if _, exists := oldMap[id]; !exists {
            log.Info("新增告警规则", "rule_id", id, "rule_name", rule.Name)
        }
    }
    
    // 检测删除规则
    for id, rule := range oldMap {
        if _, exists := newMap[id]; !exists {
            log.Info("删除告警规则", "rule_id", id, "rule_name", rule.Name)
        }
    }
    
    // 检测修改规则
    for id, newRule := range newMap {
        if oldRule, exists := oldMap[id]; exists {
            if !rulesEqual(oldRule, newRule) {
                log.Info("修改告警规则", "rule_id", id, "rule_name", newRule.Name)
            }
        }
    }
}

// AlertEvaluator 告警评估器
type AlertEvaluator struct {
    metricsCache sync.Map
}

func NewAlertEvaluator() *AlertEvaluator {
    return &AlertEvaluator{}
}

// Evaluate 评估告警规则
func (ae *AlertEvaluator) Evaluate(rule *config.AlertRule) bool {
    // 获取指标值
    metricValue, err := ae.getMetricValue(rule.ModelType, rule.Metric)
    if err != nil {
        log.Error("获取指标值失败", "error", err)
        return false
    }
    
    // 评估条件
    result := ae.evaluateCondition(metricValue, rule.Operator, rule.Threshold)
    
    if result {
        // 检查持续时间
        return ae.checkDuration(rule.ID, rule.Duration)
    }
    
    return false
}

// getMetricValue 获取指标值
func (ae *AlertEvaluator) getMetricValue(modelType, metric string) (float64, error) {
    // 从Prometheus或数据库查询指标值
    // 这里简化处理
    return 0.0, nil
}

// evaluateCondition 评估条件
func (ae *AlertEvaluator) evaluateCondition(value float64, operator string, threshold float64) bool {
    switch operator {
    case ">":
        return value > threshold
    case "<":
        return value < threshold
    case ">=":
        return value >= threshold
    case "<=":
        return value <= threshold
    case "==":
        return value == threshold
    default:
        return false
    }
}

// checkDuration 检查持续时间
func (ae *AlertEvaluator) checkDuration(ruleID string, duration int) bool {
    // 检查告警是否持续了指定时间
    // 这里简化处理
    return true
}

// AlertNotifier 告警通知器
type AlertNotifier struct {
    httpClient *http.Client
}

func NewAlertNotifier() *AlertNotifier {
    return &AlertNotifier{
        httpClient: &http.Client{Timeout: 10 * time.Second},
    }
}

// SendWebhook 发送Webhook通知
func (an *AlertNotifier) SendWebhook(rule *config.AlertRule, config map[string]interface{}) error {
    url := config["url"].(string)
    
    payload := map[string]interface{}{
        "rule_id":     rule.ID,
        "rule_name":   rule.Name,
        "severity":    rule.Severity,
        "description": rule.Description,
        "timestamp":   time.Now().Format(time.RFC3339),
    }
    
    data, _ := json.Marshal(payload)
    resp, err := an.httpClient.Post(url, "application/json", bytes.NewBuffer(data))
    if err != nil {
        return err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode >= 400 {
        return fmt.Errorf("webhook返回错误状态码: %d", resp.StatusCode)
    }
    
    return nil
}

// SendEmail 发送邮件通知
func (an *AlertNotifier) SendEmail(rule *config.AlertRule, config map[string]interface{}) error {
    // 实现邮件发送逻辑
    log.Info("发送邮件通知", "rule_id", rule.ID, "to", config["to"])
    return nil
}

// SendSlack 发送Slack通知
func (an *AlertNotifier) SendSlack(rule *config.AlertRule, config map[string]interface{}) error {
    // 实现Slack通知逻辑
    log.Info("发送Slack通知", "rule_id", rule.ID)
    return nil
}
```

**推理服务热更新**:
```go
// internal/ml/inference/service.go
package inference

import (
    "context"
    "sync/atomic"
    
    "github.com/your-org/log-management/internal/ml/config"
)

// InferenceService 推理服务
type InferenceService struct {
    config        atomic.Value // 存储 *config.MLConfig
    configManager *config.ConfigManager
    modelCache    *ModelCache
    workerPool    *WorkerPool
}

// NewInferenceService 创建推理服务
func NewInferenceService(configManager *config.ConfigManager) *InferenceService {
    is := &InferenceService{
        configManager: configManager,
    }
    
    // 加载初始配置
    is.config.Store(configManager.GetConfig())
    
    // 初始化组件
    is.initComponents()
    
    // 订阅配置变更
    go is.watchConfigChanges()
    
    return is
}

// watchConfigChanges 监听配置变更
func (is *InferenceService) watchConfigChanges() {
    configChan := is.configManager.Subscribe()
    
    for newConfig := range configChan {
        oldConfig := is.config.Load().(*config.MLConfig)
        
        // 原子更新配置
        is.config.Store(newConfig)
        
        // 应用配置变更
        is.applyConfigChanges(oldConfig, newConfig)
        
        log.Info("推理服务配置已更新",
            "batch_size", newConfig.BatchSize,
            "threshold", newConfig.AnomalyThreshold)
    }
}

// applyConfigChanges 应用配置变更
func (is *InferenceService) applyConfigChanges(oldConfig, newConfig *config.MLConfig) {
    // 更新批量推理配置
    if oldConfig.BatchSize != newConfig.BatchSize || 
       oldConfig.BatchTimeout != newConfig.BatchTimeout {
        is.updateBatchConfig(newConfig)
    }
    
    // 更新Worker Pool
    if oldConfig.MaxWorkers != newConfig.MaxWorkers {
        is.updateWorkerPool(newConfig)
    }
    
    // 更新模型缓存
    if oldConfig.ModelCacheSize != newConfig.ModelCacheSize {
        is.updateModelCache(newConfig)
    }
    
    // 更新异常检测阈值（立即生效）
    // 无需重启，下次推理时使用新阈值
}

// GetConfig 获取当前配置
func (is *InferenceService) GetConfig() *config.MLConfig {
    return is.config.Load().(*config.MLConfig)
}

// Predict 推理（使用最新配置）
func (is *InferenceService) Predict(ctx context.Context, modelID string, features []float32) (*PredictionResult, error) {
    config := is.GetConfig()
    
    // 使用最新的阈值
    threshold := config.AnomalyThreshold
    
    // 执行推理
    result, err := is.doPredict(ctx, modelID, features)
    if err != nil {
        return nil, err
    }
    
    // 应用阈值判断
    result.IsAnomaly = result.Score < threshold
    
    return result, nil
}
```

### 11.3 配置热更新API

**更新配置接口**:
```bash
# 更新配置
curl -X PUT http://api-server:8080/api/v1/ml/config \
  -H "Content-Type: application/json" \
  -d '{
    "batch_size": 64,
    "anomaly_threshold": -0.6,
    "auto_deploy": true
  }'

# 响应
{
  "code": 0,
  "message": "配置更新成功",
  "data": {
    "version": 5,
    "updated_at": "2026-01-31T10:00:00Z"
  }
}
```

**查询配置接口**:
```bash
# 查询当前配置
curl http://api-server:8080/api/v1/ml/config

# 响应
{
  "code": 0,
  "message": "success",
  "data": {
    "version": 5,
    "config": {
      "batch_size": 64,
      "anomaly_threshold": -0.6,
      "auto_deploy": true,
      ...
    },
    "updated_at": "2026-01-31T10:00:00Z"
  }
}
```

**配置历史接口**:
```bash
# 查询配置历史
curl http://api-server:8080/api/v1/ml/config/history

# 响应
{
  "code": 0,
  "message": "success",
  "data": {
    "versions": [
      {
        "version": 5,
        "changes": ["batch_size: 32 -> 64", "anomaly_threshold: -0.5 -> -0.6"],
        "created_at": "2026-01-31T10:00:00Z",
        "created_by": "admin"
      },
      {
        "version": 4,
        "changes": ["auto_deploy: false -> true"],
        "created_at": "2026-01-30T15:00:00Z",
        "created_by": "admin"
      }
    ]
  }
}
```

### 11.4 告警规则热更新API

**创建告警规则（热更新）**:
```bash
# 创建告警规则
curl -X POST http://api-server:8080/api/v1/ml/alerts/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "模型准确率下降告警",
    "enabled": true,
    "model_type": "anomaly",
    "metric": "accuracy",
    "operator": "<",
    "threshold": 0.85,
    "duration": 300,
    "severity": "critical",
    "description": "当模型准确率低于85%持续5分钟时触发告警",
    "labels": {
      "team": "ml-ops",
      "env": "production"
    },
    "actions": [
      {
        "type": "webhook",
        "config": {
          "url": "https://alert.example.com/webhook"
        }
      },
      {
        "type": "auto_rollback",
        "config": {}
      }
    ]
  }'

# 响应
{
  "code": 0,
  "message": "告警规则创建成功",
  "data": {
    "rule_id": "alert-rule-001",
    "created_at": "2026-01-31T10:00:00Z"
  }
}
```

**更新告警规则（热更新）**:
```bash
# 更新告警规则
curl -X PUT http://api-server:8080/api/v1/ml/alerts/rules/alert-rule-001 \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 0.80,
    "enabled": true
  }'

# 响应
{
  "code": 0,
  "message": "告警规则更新成功，已热更新生效",
  "data": {
    "rule_id": "alert-rule-001",
    "updated_at": "2026-01-31T10:05:00Z"
  }
}
```

**查询告警规则列表**:
```bash
# 查询告警规则
curl http://api-server:8080/api/v1/ml/alerts/rules

# 响应
{
  "code": 0,
  "message": "success",
  "data": {
    "rules": [
      {
        "id": "alert-rule-001",
        "name": "模型准确率下降告警",
        "enabled": true,
        "model_type": "anomaly",
        "metric": "accuracy",
        "operator": "<",
        "threshold": 0.80,
        "duration": 300,
        "severity": "critical",
        "created_at": "2026-01-31T10:00:00Z",
        "updated_at": "2026-01-31T10:05:00Z"
      }
    ],
    "total": 1
  }
}
```

**删除告警规则（热更新）**:
```bash
# 删除告警规则
curl -X DELETE http://api-server:8080/api/v1/ml/alerts/rules/alert-rule-001

# 响应
{
  "code": 0,
  "message": "告警规则删除成功，已热更新生效",
  "data": {
    "rule_id": "alert-rule-001",
    "deleted_at": "2026-01-31T10:10:00Z"
  }
}
```

### 11.5 YAML配置文件支持（备用方案）

**告警规则YAML配置文件**: `/etc/ml-service/alert_rules.yaml`

```yaml
# ML告警规则配置
# 支持热更新：修改后发送SIGHUP信号或调用API重载
# 优先级：API配置 > YAML配置

alert_rules:
  # 模型准确率告警
  - id: accuracy-drop-alert
    name: 模型准确率下降告警
    enabled: true
    model_type: anomaly
    metric: accuracy
    operator: "<"
    threshold: 0.85
    duration: 300  # 持续5分钟
    severity: critical
    description: 当模型准确率低于85%持续5分钟时触发告警
    labels:
      team: ml-ops
      env: production
    annotations:
      runbook_url: https://wiki.example.com/ml-ops/accuracy-drop
    actions:
      - type: webhook
        config:
          url: https://alert.example.com/webhook
          method: POST
          timeout: 10s
      - type: auto_rollback
        config:
          enabled: true
      - type: slack
        config:
          webhook_url: https://hooks.slack.com/services/xxx
          channel: "#ml-alerts"
  
  # 推理延迟告警
  - id: latency-high-alert
    name: 推理延迟过高告警
    enabled: true
    model_type: "*"  # 所有模型类型
    metric: latency
    operator: ">"
    threshold: 500  # 毫秒
    duration: 300
    severity: warning
    description: 当推理延迟P99超过500ms持续5分钟时触发告警
    labels:
      team: ml-ops
      env: production
    actions:
      - type: webhook
        config:
          url: https://alert.example.com/webhook
      - type: email
        config:
          to:
            - ml-ops@example.com
            - oncall@example.com
          subject: "[ML告警] 推理延迟过高"
  
  # 数据漂移告警
  - id: data-drift-alert
    name: 数据漂移检测告警
    enabled: true
    model_type: anomaly
    metric: drift_score
    operator: ">"
    threshold: 0.3
    duration: 600  # 持续10分钟
    severity: warning
    description: 当数据漂移分数超过0.3持续10分钟时触发告警
    labels:
      team: ml-ops
      env: production
    actions:
      - type: webhook
        config:
          url: https://alert.example.com/webhook
      - type: auto_retrain
        config:
          enabled: true
          delay: 3600  # 1小时后触发重训
  
  # 推理错误率告警
  - id: error-rate-high-alert
    name: 推理错误率过高告警
    enabled: true
    model_type: "*"
    metric: error_rate
    operator: ">"
    threshold: 0.01  # 1%
    duration: 180  # 持续3分钟
    severity: critical
    description: 当推理错误率超过1%持续3分钟时触发告警
    labels:
      team: ml-ops
      env: production
    actions:
      - type: webhook
        config:
          url: https://alert.example.com/webhook
      - type: auto_rollback
        config:
          enabled: true
      - type: slack
        config:
          webhook_url: https://hooks.slack.com/services/xxx
          channel: "#ml-alerts"
          mention_users:
            - "@ml-oncall"

# 告警全局配置
alert_config:
  evaluation_interval: 30  # 评估间隔（秒）
  notification_enabled: true
  notification_channels:
    - webhook
    - email
    - slack
  aggregation_window: 300  # 聚合窗口（秒）
  silence_duration: 3600  # 静默时长（秒）
  
  # 通知渠道配置
  channels:
    webhook:
      timeout: 10s
      retry: 3
    email:
      smtp_host: smtp.example.com
      smtp_port: 587
      username: alert@example.com
      password: "${SMTP_PASSWORD}"
      from: alert@example.com
    slack:
      default_channel: "#ml-alerts"
      username: "ML Alert Bot"
      icon_emoji: ":robot_face:"
```

**YAML配置热加载**:
```bash
# 方式1：发送SIGHUP信号
kill -HUP $(pidof ml-service)

# 方式2：调用API重载
curl -X POST http://api-server:8080/api/v1/ml/alerts/rules/reload

# 响应
{
  "code": 0,
  "message": "告警规则已重新加载",
  "data": {
    "rules_loaded": 4,
    "rules_enabled": 4,
    "reload_time": "2026-01-31T10:15:00Z"
  }
}
```

**配置优先级**:
1. **API动态配置**（最高优先级）：通过API创建/更新的规则，存储在数据库，支持实时热更新
2. **YAML文件配置**（备用方案）：服务启动时加载，支持SIGHUP信号热加载
3. **默认配置**（最低优先级）：代码中的默认配置

**配置合并策略**:
- API配置和YAML配置按规则ID合并
- 相同ID的规则，API配置覆盖YAML配置
- 删除API配置后，自动回退到YAML配置（如果存在）

---

## 12. 风险与回滚

### 12.1 风险识别

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 模型准确率下降 | 中 | 高 | 自动回滚、A/B测试、灰度发布 |
| 推理延迟增加 | 中 | 中 | 模型量化、批量推理、性能监控 |
| 数据漂移 | 高 | 中 | 漂移检测、自动重训、告警通知 |
| 训练任务失败 | 中 | 低 | 自动重试、错误日志、人工介入 |
| 模型文件损坏 | 低 | 高 | 文件校验、备份恢复、多副本存储 |
| MLflow不可用 | 低 | 中 | 本地缓存、降级服务、高可用部署 |
| GPU资源不足 | 中 | 中 | 任务队列、资源监控、弹性扩容 |
| 特征提取失败 | 中 | 中 | 默认值填充、错误日志、告警 |

### 12.2 回滚方案

**模型回滚流程**:
```
1. 检测到模型问题
   ├─ 准确率下降 > 5%
   ├─ 推理延迟增加 > 50%
   └─ 错误率 > 1%

2. 触发自动回滚
   ├─ 获取上一版本模型ID
   ├─ 从MLflow加载模型元数据
   └─ 验证模型文件存在

3. 执行回滚
   ├─ 更新模型阶段：Production → Archived
   ├─ 更新上一版本：Archived → Production
   ├─ 发布Redis通知
   └─ 推理服务加载旧模型

4. 验证回滚
   ├─ 健康检查
   ├─ 推理测试
   ├─ 指标监控
   └─ 确认恢复正常

5. 通知告警
   ├─ 发送回滚通知
   ├─ 记录回滚日志
   └─ 分析回滚原因

回滚时间: < 5分钟
```

**配置回滚流程**:
```
1. 配置变更导致问题
2. 从PostgreSQL查询上一版本配置
3. 验证配置有效性
4. 发布Redis通知
5. 各服务加载旧配置
6. 记录回滚日志

回滚时间: < 1分钟
```

**数据回滚**:
- 训练数据：从备份恢复
- 模型文件：从MinIO历史版本恢复
- 元数据：从PostgreSQL历史版本恢复

### 12.3 应急预案

**模型服务不可用**:
1. 切换到备用模型
2. 降级为规则引擎
3. 返回默认结果
4. 发送告警通知

**训练服务不可用**:
1. 使用现有模型
2. 延迟训练任务
3. 人工介入训练
4. 修复训练服务

**存储服务不可用**:
1. 使用本地缓存模型
2. 降级服务功能
3. 等待服务恢复
4. 切换备用存储

---

## 13. 附录

### 13.1 术语表

| 术语 | 说明 |
|------|------|
| ONNX | Open Neural Network Exchange，开放神经网络交换格式 |
| MLflow | 端到端机器学习平台 |
| Isolation Forest | 孤立森林，无监督异常检测算法 |
| K-means | K均值聚类算法 |
| LSTM | Long Short-Term Memory，长短期记忆网络 |
| Feature Store | 特征存储，集中管理ML特征 |
| Model Registry | 模型注册表，管理模型版本 |
| A/B Testing | A/B测试，对比两个版本的效果 |
| Data Drift | 数据漂移，数据分布随时间变化 |
| Model Quantization | 模型量化，降低模型精度以提升性能 |
| Batch Inference | 批量推理，批量处理提升吞吐量 |
| Online Learning | 在线学习，增量更新模型 |
| Hyperparameter Tuning | 超参数调优，优化模型参数 |
| Feature Engineering | 特征工程，提取和转换特征 |

### 13.2 参考文档

**技术文档**:
- [ONNX官方文档](https://onnx.ai/onnx/)
- [ONNX Runtime文档](https://onnxruntime.ai/)
- [MLflow文档](https://mlflow.org/docs/latest/index.html)
- [PyTorch文档](https://pytorch.org/docs/stable/index.html)
- [scikit-learn文档](https://scikit-learn.org/stable/)
- [Flink ML文档](https://nightlies.apache.org/flink/flink-ml-docs-stable/)

**算法论文**:
- Isolation Forest: Liu, F. T., Ting, K. M., & Zhou, Z. H. (2008)
- K-means: MacQueen, J. (1967)
- LSTM: Hochreiter, S., & Schmidhuber, J. (1997)

**最佳实践**:
- [Google ML Best Practices](https://developers.google.com/machine-learning/guides/rules-of-ml)
- [AWS ML Best Practices](https://docs.aws.amazon.com/wellarchitected/latest/machine-learning-lens/machine-learning-lens.html)
- [Microsoft ML Best Practices](https://docs.microsoft.com/en-us/azure/architecture/data-guide/technology-choices/machine-learning)

### 13.3 变更记录

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|----------|------|
| 2026-01-31 | v1.0 | 初稿，完整设计方案 | 系统架构团队 |

---

**文档完成，已包含所有章节的详细设计！**
