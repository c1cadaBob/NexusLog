# Schema 契约测试

## 概述

本目录存放 Schema 契约的兼容性测试和验证脚本。

## 测试内容

- Avro Schema 兼容性验证
- Protobuf Schema 向后兼容性检查
- JSON Schema 演进验证
- 跨格式一致性验证（Avro ↔ Protobuf ↔ JSON Schema 字段映射）

## 运行测试

```bash
# 从项目根目录运行
make test-contracts
```
