#!/bin/bash
# NexusLog Collector Agent - 本地部署启动脚本
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
AGENT_DIR="$(dirname "$SCRIPT_DIR")"
BINARY="$AGENT_DIR/dist/collector-agent"
EXPORT_DIR="/tmp/nexuslog-agent/exported-logs"

if [ ! -f "$BINARY" ]; then
  echo "编译 agent 二进制..."
  cd "$AGENT_DIR"
  go build -o "$BINARY" ./cmd/agent/
fi

mkdir -p /tmp/nexuslog-agent/checkpoints /tmp/nexuslog-agent/cache "$EXPORT_DIR"

# 后台持续导出 journald 日志（每秒追加新日志）
journalctl -f --no-pager -o short-iso >> "$EXPORT_DIR/journal.log" 2>/dev/null &
JOURNAL_PID=$!

# 后台持续导出 Docker 容器日志
docker compose -f /opt/projects/NexusLog/docker-compose.yml logs -f --no-color >> "$EXPORT_DIR/docker-containers.log" 2>/dev/null &
DOCKER_LOG_PID=$!

cleanup() {
  kill "$JOURNAL_PID" 2>/dev/null || true
  kill "$DOCKER_LOG_PID" 2>/dev/null || true
}
trap cleanup EXIT

export AGENT_ID="${AGENT_ID:-local-collector-agent}"
export AGENT_VERSION="${AGENT_VERSION:-0.1.3}"
export CONFIG_PATH="${CONFIG_PATH:-$AGENT_DIR/configs/agent.yaml}"
export CHECKPOINT_DIR="${CHECKPOINT_DIR:-/tmp/nexuslog-agent/checkpoints}"
export CACHE_DIR="${CACHE_DIR:-/tmp/nexuslog-agent/cache}"
export HTTP_PORT="${HTTP_PORT:-9091}"

# 采集本地服务器所有可读日志 + 导出的 journald/Docker 日志
export COLLECTOR_INCLUDE_PATHS="/var/log/**/*.log,/var/log/messages,/var/log/secure,/var/log/cron,/var/log/maillog,/var/log/spooler,/var/log/boot.log,/var/log/command_audit.log,/var/log/kdump.log,/var/log/**/*_log,/var/log/tuned/*.log,/var/log/sunlogin/*.log,/tmp/nexuslog-agent/exported-logs/*.log"
export COLLECTOR_CRITICAL_INCLUDE_PATHS="/var/log/messages,/var/log/secure,/var/log/cron,/var/log/maillog,/var/log/spooler"
export COLLECTOR_EXCLUDE_PATHS="${COLLECTOR_EXCLUDE_PATHS:-}"
export COLLECTOR_FLUSH_INTERVAL="${COLLECTOR_FLUSH_INTERVAL:-3s}"
export COLLECTOR_BATCH_SIZE="${COLLECTOR_BATCH_SIZE:-500}"
export COLLECTOR_BUFFER_SIZE="${COLLECTOR_BUFFER_SIZE:-10000}"
export COLLECTOR_ENABLE_FSNOTIFY="${COLLECTOR_ENABLE_FSNOTIFY:-true}"

# Kafka 兼容链路（连接 Docker 内的 Kafka）
export DELIVERY_MODE="${DELIVERY_MODE:-dual}"
export ENABLE_KAFKA_PIPELINE="${ENABLE_KAFKA_PIPELINE:-true}"
export KAFKA_BROKERS="${KAFKA_BROKERS:-localhost:9092}"
export KAFKA_TOPIC="${KAFKA_TOPIC:-nexuslog.logs.raw}"

# Pull API 鉴权
export AGENT_API_KEY_ACTIVE_ID="active"
export AGENT_API_KEY_ACTIVE="nexuslog-local-dev-agent-key-20260314-change-before-production"

echo "========================================="
echo "NexusLog Collector Agent (本地部署)"
echo "Agent ID:  $AGENT_ID"
echo "采集路径:  $COLLECTOR_INCLUDE_PATHS"
echo "journald:  PID=$JOURNAL_PID -> $EXPORT_DIR/journal.log"
echo "Docker:    PID=$DOCKER_LOG_PID -> $EXPORT_DIR/docker-containers.log"
echo "Kafka:     $KAFKA_BROKERS -> $KAFKA_TOPIC"
echo "HTTP 端口: $HTTP_PORT"
echo "========================================="

exec "$BINARY"
