#!/usr/bin/env bash
set -euo pipefail

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[install] missing required command: $1" >&2
    exit 1
  fi
}

run_as_root() {
  if [[ "${EUID}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

resolve_metrics_report_enabled() {
  local configured
  configured="$(printf '%s' "${AGENT_METRICS_REPORT_ENABLED}" | tr '[:upper:]' '[:lower:]')"

  case "${configured}" in
    true|false)
      printf '%s' "${configured}"
      ;;
    auto|"")
      if [[ -z "${CONTROL_PLANE_BASE_URL}" ]]; then
        echo '[install] metrics reporting disabled: CONTROL_PLANE_BASE_URL is empty' >&2
        printf 'false'
        return 0
      fi
      if curl --silent --output /dev/null --connect-timeout 3 --max-time 5 --insecure "${CONTROL_PLANE_BASE_URL}"; then
        echo '[install] metrics reporting enabled: control plane reachable' >&2
        printf 'true'
      else
        echo '[install] metrics reporting disabled: control plane not reachable from target host' >&2
        printf 'false'
      fi
      ;;
    *)
      echo "[install] invalid AGENT_METRICS_REPORT_ENABLED: ${AGENT_METRICS_REPORT_ENABLED} (expected true|false|auto)" >&2
      exit 1
      ;;
  esac
}

ASSET_URL="${ASSET_URL:-}"
AGENT_ID="${AGENT_ID:-collector-agent-node-01}"
AGENT_VERSION="${AGENT_VERSION:-latest}"
CONTROL_PLANE_BASE_URL="${CONTROL_PLANE_BASE_URL:-http://127.0.0.1:8080}"
AGENT_METRICS_REPORT_ENABLED="${AGENT_METRICS_REPORT_ENABLED:-auto}"
AGENT_API_KEY_ACTIVE_ID="${AGENT_API_KEY_ACTIVE_ID:-active}"
AGENT_API_KEY_ACTIVE="${AGENT_API_KEY_ACTIVE:-}"
DELIVERY_MODE="${DELIVERY_MODE:-pull}"
ENABLE_KAFKA_PIPELINE="${ENABLE_KAFKA_PIPELINE:-false}"
KAFKA_BROKERS="${KAFKA_BROKERS:-127.0.0.1:9092}"
KAFKA_TOPIC="${KAFKA_TOPIC:-nexuslog.logs.raw}"
KAFKA_SCHEMA_REGISTRY_URL="${KAFKA_SCHEMA_REGISTRY_URL:-http://127.0.0.1:18081}"
KAFKA_SCHEMA_SUBJECT="${KAFKA_SCHEMA_SUBJECT:-nexuslog.logs.raw-value}"
KAFKA_REQUIRED_ACKS="${KAFKA_REQUIRED_ACKS:-all}"
COLLECTOR_INCLUDE_PATHS="${COLLECTOR_INCLUDE_PATHS:-/var/**/*.log}"
COLLECTOR_EXCLUDE_PATHS="${COLLECTOR_EXCLUDE_PATHS:-}"
COLLECTOR_PATH_LABEL_RULES="${COLLECTOR_PATH_LABEL_RULES:-[]}"
COLLECTOR_SYSLOG_LISTENERS_JSON="${COLLECTOR_SYSLOG_LISTENERS_JSON:-[]}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/nexuslog/collector-agent}"
STATE_ROOT="${STATE_ROOT:-/var/lib/collector-agent}"
ENV_FILE="${ENV_FILE:-/etc/nexuslog/collector-agent.env}"
SERVICE_FILE="${SERVICE_FILE:-/etc/systemd/system/collector-agent.service}"
HTTP_PORT="${HTTP_PORT:-9091}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

if [[ -z "${ASSET_URL}" ]]; then
  echo '[install] ASSET_URL is required' >&2
  exit 1
fi

if [[ -z "${AGENT_API_KEY_ACTIVE}" ]]; then
  echo '[install] AGENT_API_KEY_ACTIVE is required' >&2
  exit 1
fi

for cmd in curl tar find install systemctl; do
  require_command "$cmd"
done

if [[ "${EUID}" -ne 0 ]]; then
  require_command sudo
fi

METRICS_REPORT_ENABLED="$(resolve_metrics_report_enabled)"

echo "[install] download asset: ${ASSET_URL}"
curl -fsSL "${ASSET_URL}" -o "${TMP_DIR}/collector-agent.tgz"
tar -xzf "${TMP_DIR}/collector-agent.tgz" -C "${TMP_DIR}"

PACKAGE_ROOT="$(find "${TMP_DIR}" -maxdepth 1 -mindepth 1 -type d -name 'collector-agent-*' | head -n 1)"
if [[ -z "${PACKAGE_ROOT}" ]]; then
  PACKAGE_ROOT="${TMP_DIR}"
fi

BIN_PATH="$(find "${PACKAGE_ROOT}" -type f -name collector-agent | head -n 1)"
CONFIG_DIR="${PACKAGE_ROOT}/configs"
SERVICE_TEMPLATE="${PACKAGE_ROOT}/deploy/systemd/collector-agent.service"

if [[ -z "${BIN_PATH}" ]]; then
  echo '[install] collector-agent binary not found in archive' >&2
  exit 1
fi

if [[ ! -d "${CONFIG_DIR}" ]]; then
  echo "[install] configs directory not found in archive: ${CONFIG_DIR}" >&2
  exit 1
fi

run_as_root useradd --system --no-create-home --shell /usr/sbin/nologin collector >/dev/null 2>&1 || true
run_as_root mkdir -p "${INSTALL_ROOT}" /etc/nexuslog "${STATE_ROOT}/checkpoints" "${STATE_ROOT}/cache"
run_as_root install -m 0755 "${BIN_PATH}" /usr/local/bin/collector-agent
run_as_root rm -rf "${INSTALL_ROOT}/configs"
run_as_root cp -R "${CONFIG_DIR}" "${INSTALL_ROOT}/"

if [[ -f "${SERVICE_TEMPLATE}" ]]; then
  run_as_root install -m 0644 "${SERVICE_TEMPLATE}" "${SERVICE_FILE}"
else
  cat <<'EOF' | run_as_root tee "${SERVICE_FILE}" >/dev/null
[Unit]
Description=NexusLog Collector Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=collector
Group=collector
AmbientCapabilities=CAP_DAC_READ_SEARCH
CapabilityBoundingSet=CAP_DAC_READ_SEARCH
WorkingDirectory=/opt/nexuslog/collector-agent
EnvironmentFile=-/etc/nexuslog/collector-agent.env
ExecStart=/usr/local/bin/collector-agent
Restart=always
RestartSec=5
LimitNOFILE=65535
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/var/lib/collector-agent /var/log

[Install]
WantedBy=multi-user.target
EOF
fi

cat <<EOF | run_as_root tee "${ENV_FILE}" >/dev/null
HTTP_PORT=${HTTP_PORT}
AGENT_ID=${AGENT_ID}
AGENT_VERSION=${AGENT_VERSION}
CONFIG_PATH=${INSTALL_ROOT}/configs/agent.yaml
AGENT_API_KEY_ACTIVE_ID=${AGENT_API_KEY_ACTIVE_ID}
AGENT_API_KEY_ACTIVE=${AGENT_API_KEY_ACTIVE}
CHECKPOINT_DIR=${STATE_ROOT}/checkpoints
CACHE_DIR=${STATE_ROOT}/cache
COLLECTOR_INCLUDE_PATHS=${COLLECTOR_INCLUDE_PATHS}
COLLECTOR_EXCLUDE_PATHS=${COLLECTOR_EXCLUDE_PATHS}
COLLECTOR_PATH_LABEL_RULES=${COLLECTOR_PATH_LABEL_RULES}
COLLECTOR_SYSLOG_LISTENERS_JSON=${COLLECTOR_SYSLOG_LISTENERS_JSON}
DELIVERY_MODE=${DELIVERY_MODE}
ENABLE_KAFKA_PIPELINE=${ENABLE_KAFKA_PIPELINE}
LEGACY_LOG_PIPELINE_ENABLED=false
CONTROL_PLANE_BASE_URL=${CONTROL_PLANE_BASE_URL}
AGENT_METRICS_REPORT_ENABLED=${METRICS_REPORT_ENABLED}
AGENT_METRICS_REPORT_INTERVAL=30s
AGENT_METRICS_REPORT_TIMEOUT=10s
KAFKA_BROKERS=${KAFKA_BROKERS}
KAFKA_TOPIC=${KAFKA_TOPIC}
KAFKA_SCHEMA_REGISTRY_URL=${KAFKA_SCHEMA_REGISTRY_URL}
KAFKA_SCHEMA_SUBJECT=${KAFKA_SCHEMA_SUBJECT}
KAFKA_REQUIRED_ACKS=${KAFKA_REQUIRED_ACKS}
EOF

run_as_root chown -R collector:collector "${INSTALL_ROOT}" "${STATE_ROOT}"
run_as_root systemctl daemon-reload
run_as_root systemctl enable --now collector-agent
run_as_root systemctl status collector-agent --no-pager || true
curl -fsSL "http://127.0.0.1:${HTTP_PORT}/healthz" || true

echo '[install] collector-agent deployed successfully'
