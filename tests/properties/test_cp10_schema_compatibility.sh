#!/bin/bash
# CP-10: Schema 契约兼容性属性测试
# 验证 contracts/schema-contracts 下的 Schema 定义通过兼容性校验（向后兼容）
# 需求: 11

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ROOT_DIR="${PROJECT_ROOT:-.}"
FAILED=0
TOTAL=0

echo "🔍 CP-10: Schema 契约兼容性验证"
echo ""

POLICY_FILE="$ROOT_DIR/contracts/schema-contracts/compatibility/compatibility-policy.yaml"
VALIDATE_SCRIPT="$ROOT_DIR/contracts/schema-contracts/tests/validate-schemas.sh"

TOTAL=$((TOTAL + 1))
if [ -f "$POLICY_FILE" ]; then
  echo -e "  ${GREEN}✓${NC} compatibility-policy.yaml 存在"
else
  echo -e "  ${RED}✗${NC} compatibility-policy.yaml 缺失"
  FAILED=1
fi

TOTAL=$((TOTAL + 1))
if [ -f "$VALIDATE_SCRIPT" ]; then
  echo -e "  ${GREEN}✓${NC} validate-schemas.sh 存在"
else
  echo -e "  ${RED}✗${NC} validate-schemas.sh 缺失"
  FAILED=1
fi

if [ $FAILED -eq 1 ]; then
  echo ""
  echo -e "${RED}❌ CP-10 失败: 基础文件缺失${NC}"
  exit 1
fi

echo ""
echo "📜 校验兼容性策略..."
TOTAL=$((TOTAL + 1))
if grep -Eq 'default_level:\s*BACKWARD' "$POLICY_FILE"; then
  echo -e "  ${GREEN}✓${NC} 默认兼容级别为 BACKWARD"
else
  echo -e "  ${RED}✗${NC} default_level 不是 BACKWARD"
  FAILED=1
fi

TOTAL=$((TOTAL + 1))
if grep -Eq 'fail_on_incompatible:\s*true' "$POLICY_FILE"; then
  echo -e "  ${GREEN}✓${NC} 兼容性不通过会阻断流程"
else
  echo -e "  ${RED}✗${NC} fail_on_incompatible 未设置为 true"
  FAILED=1
fi

echo ""
echo "🧪 执行 Schema 兼容性脚本..."
TOTAL=$((TOTAL + 1))
if bash "$VALIDATE_SCRIPT"; then
  echo -e "  ${GREEN}✓${NC} validate-schemas.sh 执行通过"
else
  echo -e "  ${RED}✗${NC} validate-schemas.sh 执行失败"
  FAILED=1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ CP-10 通过: 全部 $TOTAL 项检查通过${NC}"
  exit 0
else
  echo -e "${RED}❌ CP-10 失败: Schema 契约兼容性检查未通过（共 $TOTAL 项）${NC}"
  exit 1
fi
