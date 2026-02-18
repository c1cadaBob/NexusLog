#!/bin/bash
# NexusLog 回滚脚本
# 快速回滚到上一个版本

set -e

echo "⏪ 开始回滚流程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 参数
TARGET_VERSION=${1:-""}
COMPONENT=${2:-"all"}
NAMESPACE=${NAMESPACE:-"nexuslog"}

# 获取可用版本
echo ""
echo "📋 可用版本:"
git tag --sort=-version:refname | head -10

if [ -z "$TARGET_VERSION" ]; then
    echo ""
    read -p "输入目标版本 (例如 v1.2.3): " TARGET_VERSION
fi

# 验证版本存在
if ! git rev-parse "$TARGET_VERSION" >/dev/null 2>&1; then
    echo -e "${RED}❌ 版本 $TARGET_VERSION 不存在${NC}"
    exit 1
fi

echo ""
echo "回滚目标: $TARGET_VERSION"
echo "回滚组件: $COMPONENT"
read -p "确认回滚? [y/N]: " confirm
if [[ ! $confirm =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 记录回滚开始时间
START_TIME=$(date +%s)
echo ""
echo "⏱️ 回滚开始时间: $(date)"

rollback_k8s() {
    local deployment=$1
    local ns=$2

    echo "  回滚 $deployment..."
    if kubectl rollout undo deployment/$deployment -n $ns 2>/dev/null; then
        kubectl rollout status deployment/$deployment -n $ns --timeout=300s
        echo -e "  ${GREEN}✓ $deployment 回滚完成${NC}"
    else
        echo -e "  ${YELLOW}⚠ $deployment 回滚失败或不存在${NC}"
    fi
}

rollback_argocd() {
    local app=$1
    local revision=$2

    echo "  回滚 Argo CD 应用 $app..."
    if command -v argocd &> /dev/null; then
        argocd app rollback $app $revision 2>/dev/null || {
            echo -e "  ${YELLOW}⚠ Argo CD 回滚失败${NC}"
        }
    else
        echo -e "  ${YELLOW}⚠ argocd CLI 未安装${NC}"
    fi
}

case $COMPONENT in
    all)
        echo ""
        echo "🔄 回滚所有组件..."

        # 前端
        rollback_k8s "frontend-console" "$NAMESPACE-apps"

        # 后端服务
        rollback_k8s "control-plane" "$NAMESPACE-services"
        rollback_k8s "api-service" "$NAMESPACE-services"
        rollback_k8s "health-worker" "$NAMESPACE-services"
        ;;

    frontend)
        echo ""
        echo "🔄 回滚前端..."
        rollback_k8s "frontend-console" "$NAMESPACE-apps"
        ;;

    control-plane)
        echo ""
        echo "🔄 回滚 Control Plane..."
        rollback_k8s "control-plane" "$NAMESPACE-services"
        ;;

    api-service)
        echo ""
        echo "🔄 回滚 API Service..."
        rollback_k8s "api-service" "$NAMESPACE-services"
        ;;

    *)
        echo -e "${RED}❌ 未知组件: $COMPONENT${NC}"
        echo "可用组件: all, frontend, control-plane, api-service"
        exit 1
        ;;
esac

# 计算回滚耗时
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "⏱️ 回滚结束时间: $(date)"
echo "⏱️ 回滚耗时: ${DURATION}秒"

# 健康检查
echo ""
echo "🏥 执行健康检查..."
sleep 10

# 检查 Pod 状态
echo "  检查 Pod 状态..."
kubectl get pods -n $NAMESPACE-apps -l app=frontend-console 2>/dev/null || true
kubectl get pods -n $NAMESPACE-services 2>/dev/null || true

echo ""
echo -e "${GREEN}✅ 回滚完成${NC}"
echo ""
echo "后续步骤:"
echo "  1. 验证服务功能正常"
echo "  2. 检查监控指标"
echo "  3. 记录回滚原因"
echo "  4. 安排复盘会议"
