#!/bin/bash
# NexusLog Schema 契约兼容性校验脚本
# 用于 CI 流水线中验证 Schema 变更的向后兼容性
# 用法: ./validate-schemas.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTRACTS_DIR="$(dirname "$SCRIPT_DIR")"
EXIT_CODE=0

echo "============================================"
echo " NexusLog Schema 契约校验"
echo "============================================"

# --------------------------------------------------
# 1. 验证 Avro Schema 语法正确性
# --------------------------------------------------
echo ""
echo "[1/4] 验证 Avro Schema 语法..."
AVRO_DIR="$CONTRACTS_DIR/avro"
AVRO_COUNT=0
AVRO_FAIL=0

for schema_file in "$AVRO_DIR"/*.avsc; do
    [ -f "$schema_file" ] || continue
    filename=$(basename "$schema_file")
    AVRO_COUNT=$((AVRO_COUNT + 1))

    # 基础 JSON 语法校验
    if ! python3 -c "import json; json.load(open('$schema_file'))" 2>/dev/null; then
        echo "  ✗ $filename - JSON 语法错误"
        AVRO_FAIL=$((AVRO_FAIL + 1))
        EXIT_CODE=1
        continue
    fi

    # 验证必需字段
    has_type=$(python3 -c "import json; d=json.load(open('$schema_file')); print('type' in d)" 2>/dev/null)
    has_name=$(python3 -c "import json; d=json.load(open('$schema_file')); print('name' in d)" 2>/dev/null)
    has_fields=$(python3 -c "import json; d=json.load(open('$schema_file')); print('fields' in d)" 2>/dev/null)

    if [ "$has_type" = "True" ] && [ "$has_name" = "True" ] && [ "$has_fields" = "True" ]; then
        echo "  ✓ $filename"
    else
        echo "  ✗ $filename - 缺少必需字段 (type/name/fields)"
        AVRO_FAIL=$((AVRO_FAIL + 1))
        EXIT_CODE=1
    fi
done
echo "  Avro: $AVRO_COUNT 个文件, $AVRO_FAIL 个失败"

# --------------------------------------------------
# 2. 验证 Protobuf Schema 语法正确性
# --------------------------------------------------
echo ""
echo "[2/4] 验证 Protobuf Schema 语法..."
PROTO_DIR="$CONTRACTS_DIR/protobuf"
PROTO_COUNT=0
PROTO_FAIL=0

for proto_file in "$PROTO_DIR"/*.proto; do
    [ -f "$proto_file" ] || continue
    filename=$(basename "$proto_file")
    PROTO_COUNT=$((PROTO_COUNT + 1))

    # 检查 syntax 声明
    if grep -q 'syntax = "proto3"' "$proto_file"; then
        echo "  ✓ $filename"
    else
        echo "  ✗ $filename - 缺少 proto3 syntax 声明"
        PROTO_FAIL=$((PROTO_FAIL + 1))
        EXIT_CODE=1
    fi
done
echo "  Protobuf: $PROTO_COUNT 个文件, $PROTO_FAIL 个失败"

# --------------------------------------------------
# 3. 验证 JSON Schema 语法正确性
# --------------------------------------------------
echo ""
echo "[3/4] 验证 JSON Schema 语法..."
JSON_DIR="$CONTRACTS_DIR/jsonschema"
JSON_COUNT=0
JSON_FAIL=0

for schema_file in "$JSON_DIR"/*.schema.json; do
    [ -f "$schema_file" ] || continue
    filename=$(basename "$schema_file")
    JSON_COUNT=$((JSON_COUNT + 1))

    # JSON 语法校验
    if ! python3 -c "import json; json.load(open('$schema_file'))" 2>/dev/null; then
        echo "  ✗ $filename - JSON 语法错误"
        JSON_FAIL=$((JSON_FAIL + 1))
        EXIT_CODE=1
        continue
    fi

    # 验证 $schema 字段存在
    has_schema=$(python3 -c "import json; d=json.load(open('$schema_file')); print('\$schema' in d)" 2>/dev/null)
    if [ "$has_schema" = "True" ]; then
        echo "  ✓ $filename"
    else
        echo "  ✗ $filename - 缺少 \$schema 字段"
        JSON_FAIL=$((JSON_FAIL + 1))
        EXIT_CODE=1
    fi
done
echo "  JSON Schema: $JSON_COUNT 个文件, $JSON_FAIL 个失败"

# --------------------------------------------------
# 4. 跨格式一致性校验
# --------------------------------------------------
echo ""
echo "[4/4] 跨格式一致性校验..."

# 验证 Avro 和 Protobuf 中定义的消息类型一致
AVRO_TYPES=$(find "$AVRO_DIR" -name "*.avsc" -exec python3 -c "import json,sys; d=json.load(open(sys.argv[1])); print(d.get('name',''))" {} \; 2>/dev/null | sort)
echo "  Avro 消息类型: $(echo $AVRO_TYPES | tr '\n' ', ')"

PROTO_MESSAGES=$(grep -h "^message " "$PROTO_DIR"/*.proto 2>/dev/null | sed 's/message \([^ ]*\).*/\1/' | sort)
echo "  Protobuf 消息类型: $(echo $PROTO_MESSAGES | tr '\n' ', ')"

# --------------------------------------------------
# 结果汇总
# --------------------------------------------------
echo ""
echo "============================================"
TOTAL=$((AVRO_COUNT + PROTO_COUNT + JSON_COUNT))
TOTAL_FAIL=$((AVRO_FAIL + PROTO_FAIL + JSON_FAIL))
if [ $EXIT_CODE -eq 0 ]; then
    echo " ✓ 全部通过: $TOTAL 个 Schema 文件校验成功"
else
    echo " ✗ 校验失败: $TOTAL 个文件中 $TOTAL_FAIL 个失败"
fi
echo "============================================"

exit $EXIT_CODE
