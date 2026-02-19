# ML - 机器学习域（可选）

NexusLog 机器学习相关模块，用于日志异常检测、智能分析等场景。

## 目录结构

```
ml/
├── training/       # 模型训练脚本和配置
├── inference/      # 模型推理服务
├── models/         # 训练好的模型文件
├── mlflow/         # MLflow 实验追踪配置
└── nlp/            # 自然语言处理
    ├── prompts/    # LLM Prompt 模板
    └── rules/      # 规则引擎配置
```

## 技术栈

| 组件 | 版本 | 审批级别 | 配置策略 |
|------|------|----------|----------|
| Python + sklearn + PyTorch + ONNX | Py3.11+ | 常规 | 模型热切换；服务滚动 |
| MLflow | 稳定版 | 常规 | 实验追踪 |
| LLM API + 规则引擎 | - | 常规 | Prompt/规则热更 |
