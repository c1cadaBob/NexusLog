# Runbook: 安装并校验 NexusLog v2 Elasticsearch 模板

## 目的

用于为 Elasticsearch 安装 NexusLog v2 日志模板，并校验 `nexuslog-logs-v2` 是否会命中正确的 v2 模板。

## 前提

- Elasticsearch 可访问
- 本地已具备 `curl` 与 `python3`
- 仓库根目录存在以下文件：
  - `storage/elasticsearch/ilm-policies/nexuslog-logs-ilm.json`
  - `storage/elasticsearch/index-templates/nexuslog-logs-v2.json`

## 安装

```bash
export ES_HOST=http://localhost:9200
scripts/install-es-v2-template.sh
```

可选环境变量：

- `ES_HOST`
- `ILM_POLICY_NAME`
- `ILM_POLICY_FILE`
- `INDEX_TEMPLATE_NAME`
- `INDEX_TEMPLATE_FILE`

## 校验

```bash
export ES_HOST=http://localhost:9200
scripts/validate-es-v2-template.sh
```

可选环境变量：

- `ES_HOST`
- `INDEX_TEMPLATE_NAME`
- `INDEX_NAME`

## 校验内容

脚本会检查：

1. Elasticsearch 连通性正常
2. `nexuslog-logs-v2` 模板已安装
3. 模板 pattern 覆盖 `nexuslog-logs-v2`
4. `simulate_index` 结果中包含关键 v2 字段：
   - `@timestamp`
   - `message`
   - `event.id`
   - `log.level`
   - `service.name`
   - `nexuslog.ingest.schema_version`
5. `rollover_alias` 与 `nexuslog-logs-v2` 一致

## 常见问题

### 1. 模板存在，但写入仍未命中

优先检查：

- `INGEST_ES_INDEX` 是否为 `nexuslog-logs-v2`
- Query / Export 侧是否仍在读取旧索引名
- 集群中是否存在更高优先级的冲突模板

### 2. simulate 结果字段不完整

说明当前生效模板可能不是 v2 模板，或集群里存在冲突模板。建议执行：

```bash
curl -s "$ES_HOST/_index_template/nexuslog-logs-v2"
curl -s -X POST "$ES_HOST/_index_template/_simulate_index/nexuslog-logs-v2"
```

## 关联文件

- `scripts/install-es-v2-template.sh`
- `scripts/validate-es-v2-template.sh`
- `storage/elasticsearch/index-templates/nexuslog-logs-v2.json`
- `storage/elasticsearch/ilm-policies/nexuslog-logs-ilm.json`
