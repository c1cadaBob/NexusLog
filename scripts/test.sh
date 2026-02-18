#!/bin/bash
# NexusLog 测试脚本
# 运行所有后端测试

set -e

echo "🧪 开始运行测试..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 解析参数
COVERAGE=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --coverage|-c)
            COVERAGE=true
            shift
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        *)
            shift
            ;;
    esac
done

# Go 模块列表
GO_MODULES=(
    "services/control-plane"
    "services/health-worker"
    "services/api-service"
    "agents/collector-agent"
)

TEST_FAILED=0
TOTAL_TESTS=0
PASSED_TESTS=0

# 构建测试参数
TEST_FLAGS="-race"
if [ "$VERBOSE" = true ]; then
    TEST_FLAGS="$TEST_FLAGS -v"
fi
if [ "$COVERAGE" = true ]; then
    mkdir -p coverage
    TEST_FLAGS="$TEST_FLAGS -coverprofile=coverage/coverage.out"
fi

echo ""
echo "📋 运行 Go 测试..."

for module in "${GO_MODULES[@]}"; do
    if [ -d "$module" ] && [ -f "$module/go.mod" ]; then
        echo "  测试 $module..."
        cd "$module"

        if [ "$COVERAGE" = true ]; then
            COVER_FILE="../../coverage/$(echo $module | tr '/' '-').out"
            if go test $TEST_FLAGS -coverprofile="$COVER_FILE" ./... 2>/dev/null; then
                echo -e "  ${GREEN}✓ $module 测试通过${NC}"
                ((PASSED_TESTS++))
            else
                echo -e "  ${RED}✗ $module 测试失败${NC}"
                TEST_FAILED=1
            fi
        else
            if go test $TEST_FLAGS ./... 2>/dev/null; then
                echo -e "  ${GREEN}✓ $module 测试通过${NC}"
                ((PASSED_TESTS++))
            else
                echo -e "  ${RED}✗ $module 测试失败${NC}"
                TEST_FAILED=1
            fi
        fi

        ((TOTAL_TESTS++))
        cd - > /dev/null
    else
        echo -e "  ${YELLOW}⚠ $module 不存在或无 go.mod，跳过${NC}"
    fi
done

# 生成覆盖率报告
if [ "$COVERAGE" = true ] && [ -d "coverage" ]; then
    echo ""
    echo "📊 生成覆盖率报告..."
    # 合并覆盖率文件
    echo "mode: atomic" > coverage/coverage.out
    for f in coverage/*.out; do
        if [ "$f" != "coverage/coverage.out" ]; then
            tail -n +2 "$f" >> coverage/coverage.out 2>/dev/null || true
        fi
    done

    if [ -s "coverage/coverage.out" ]; then
        go tool cover -func=coverage/coverage.out | tail -1
        echo -e "${GREEN}✓ 覆盖率报告已生成: coverage/coverage.out${NC}"
    fi
fi

echo ""
echo "📊 测试结果: $PASSED_TESTS/$TOTAL_TESTS 模块通过"

if [ $TEST_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过${NC}"
else
    echo -e "${RED}❌ 部分测试失败${NC}"
    exit 1
fi
