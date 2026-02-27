#!/bin/bash
# CP-8: CI 流水线覆盖性属性测试
# 验证 GitHub Actions 覆盖前端、后端、镜像三条流水线
# 需求: 5

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

ROOT_DIR="${PROJECT_ROOT:-.}"
FAILED=0
TOTAL=0

check_file_exists() {
  local file="$1"
  local desc="$2"
  TOTAL=$((TOTAL + 1))
  if [ -f "$ROOT_DIR/$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file ($desc)"
  else
    echo -e "  ${RED}✗${NC} $file ($desc) — 文件不存在"
    FAILED=1
  fi
}

check_pattern() {
  local file="$1"
  local pattern="$2"
  local desc="$3"
  TOTAL=$((TOTAL + 1))
  if grep -Eq "$pattern" "$ROOT_DIR/$file"; then
    echo -e "  ${GREEN}✓${NC} $desc"
  else
    echo -e "  ${RED}✗${NC} $desc — 未匹配到规则: $pattern"
    FAILED=1
  fi
}

echo "🔍 CP-8: CI 流水线覆盖性验证"
echo ""

echo "📄 验证核心工作流文件存在..."
check_file_exists ".github/workflows/frontend-ci.yml" "前端 CI 工作流"
check_file_exists ".github/workflows/backend-ci.yml" "后端 CI 工作流"
check_file_exists ".github/workflows/docker-build.yml" "镜像构建与推送工作流"
echo ""

echo "🧪 验证前端流水线包含关键阶段..."
check_pattern ".github/workflows/frontend-ci.yml" "name:\\s*Frontend CI" "Frontend CI 名称定义"
check_pattern ".github/workflows/frontend-ci.yml" "pnpm --filter @nexuslog/frontend-console test" "前端测试步骤"
check_pattern ".github/workflows/frontend-ci.yml" "pnpm --filter @nexuslog/frontend-console build" "前端构建步骤"
echo ""

echo "🧪 验证后端流水线包含关键阶段..."
check_pattern ".github/workflows/backend-ci.yml" "name:\\s*Backend CI" "Backend CI 名称定义"
check_pattern ".github/workflows/backend-ci.yml" "go test -v -race" "后端测试步骤"
check_pattern ".github/workflows/backend-ci.yml" "go build" "后端构建步骤"
echo ""

echo "🐳 验证镜像流水线包含关键阶段..."
check_pattern ".github/workflows/docker-build.yml" "name:\\s*Docker Build & Security Scan" "Docker 流水线名称定义"
check_pattern ".github/workflows/docker-build.yml" "docker/build-push-action@v6" "镜像构建推送步骤"
check_pattern ".github/workflows/docker-build.yml" "aquasecurity/trivy-action@master" "Trivy 安全扫描步骤"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ CP-8 通过: 全部 $TOTAL 项检查通过${NC}"
  exit 0
else
  echo -e "${RED}❌ CP-8 失败: CI 流水线覆盖不完整（共 $TOTAL 项）${NC}"
  exit 1
fi
