非常认同，这个方向是对的：**生产环境默认“热更新优先”**，把重启当成**人工兜底**，不是自动路径。

我给你一个可直接执行的策略（兼容你现在的部署体系）：

---

## 推荐策略（默认行为）

1. **离线校验**：`promtool/amtool` 先过
2. **发布文件**：原子替换到目标目录
3. **优先热更新**：调用 `/-/reload`
4. **强校验热更新结果**：检查 reload success 指标
5. **失败自动回滚**：回到上一个版本，再次热更新
6. **不自动重启**：除非你显式传 `--allow-restart-fallback`

---

## 脚本关键实现（建议补到 `deploy-monitoring-v2.sh`）

> 前提：Prometheus/Alertmanager 启用了 `--web.enable-lifecycle`

```bash
PROM_URL="${PROM_URL:-http://127.0.0.1:9090}"
AM_URL="${AM_URL:-http://127.0.0.1:9093}"
ALLOW_RESTART_FALLBACK="${ALLOW_RESTART_FALLBACK:-0}"  # 默认禁止自动重启

retry() {
  local n=0 max="${2:-5}" sleep_s="${3:-1}"
  local cmd="$1"
  until eval "$cmd"; do
    n=$((n+1))
    [[ $n -ge $max ]] && return 1
    sleep "$sleep_s"
  done
}

hot_reload_prometheus() {
  curl -fsS -X POST "${PROM_URL}/-/reload" >/dev/null
  retry "test \"\$(curl -fsS ${PROM_URL}/metrics | awk '/^prometheus_config_last_reload_successful /{print \$2}')\" = \"1\"" 6 1
}

hot_reload_alertmanager() {
  curl -fsS -X POST "${AM_URL}/-/reload" >/dev/null
  retry "test \"\$(curl -fsS ${AM_URL}/metrics | awk '/^alertmanager_config_last_reload_successful /{print \$2}')\" = \"1\"" 6 1
}

hot_reload_all() {
  hot_reload_prometheus && hot_reload_alertmanager
}

reload_with_optional_fallback() {
  if hot_reload_all; then
    log "hot reload success"
    return 0
  fi

  log "hot reload failed"
  if [[ "$ALLOW_RESTART_FALLBACK" == "1" ]]; then
    log "trying restart fallback (explicitly enabled)"
    systemctl restart prometheus alertmanager
    return 0
  fi
  return 1
}
```

在 `apply_release` 最后改成：

```bash
# 配置文件已替换后
reload_with_optional_fallback
```

---

## CI 调用建议（保持热更新优先）

默认不允许自动重启：

```bash
sudo ALLOW_RESTART_FALLBACK=0 /usr/local/sbin/deploy-monitoring.sh deploy "$VERSION"
```

紧急手工发布才开启兜底：

```bash
sudo ALLOW_RESTART_FALLBACK=1 /usr/local/sbin/deploy-monitoring.sh deploy "$VERSION"
```

---

如果你愿意，我可以下一条直接给你一份**完整可粘贴的 deploy 脚本版本**（含：热更新优先、失败回滚、指标校验、日志更清晰）。非常好，这个选择很专业。
下面是你要的 **完整可粘贴版 `deploy-monitoring-v2.sh`**：默认 **热更新优先**、失败自动回滚、并且 **不自动重启**（除非显式开启）。

> 建议路径：`/opt/monitoring-release/scripts/deploy-monitoring-v2.sh`
> 权限：`root:root`, `0750`

```bash
#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

# =========================
# Config (override by env)
# =========================
BASE_DIR="${BASE_DIR:-/opt/monitoring-release}"
SRC_ROOT="${SRC_ROOT:-$BASE_DIR/monitoring}"
RELEASES_DIR="${RELEASES_DIR:-$BASE_DIR/releases}"
STATE_DIR="${STATE_DIR:-$BASE_DIR/state}"
CURRENT_FILE="${CURRENT_FILE:-$STATE_DIR/current_version}"
LOCK_FILE="${LOCK_FILE:-/var/lock/monitoring-deploy.lock}"

LIVE_PROM_DIR="${LIVE_PROM_DIR:-/etc/prometheus}"
LIVE_AM_DIR="${LIVE_AM_DIR:-/etc/alertmanager}"

PROM_URL="${PROM_URL:-http://127.0.0.1:9090}"
AM_URL="${AM_URL:-http://127.0.0.1:9093}"

PROM_SERVICE="${PROM_SERVICE:-prometheus}"
AM_SERVICE="${AM_SERVICE:-alertmanager}"

# 默认禁止自动重启兜底；仅热更新
ALLOW_RESTART_FALLBACK="${ALLOW_RESTART_FALLBACK:-0}"

RELOAD_RETRIES="${RELOAD_RETRIES:-6}"
RELOAD_DELAY_SEC="${RELOAD_DELAY_SEC:-1}"

# =========================
# Globals
# =========================
DEPLOY_IN_PROGRESS=0
PREV_VERSION=""

# =========================
# Utils
# =========================
log() {
  echo "[$(date '+%F %T%z')] $*"
}

fatal() {
  log "ERROR: $*"
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fatal "missing command: $1"
}

ensure_root() {
  [[ "${EUID:-$(id -u)}" -eq 0 ]] || fatal "must run as root (use sudo)"
}

acquire_lock() {
  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 200>"$LOCK_FILE"
  flock -n 200 || fatal "another deploy/rollback is running"
}

usage() {
  cat <<EOF
Usage:
  $0 deploy [version]
  $0 rollback <version>
  $0 list
  $0 current

Env:
  ALLOW_RESTART_FALLBACK=0|1   # default 0 (hot-reload only)
  SRC_ROOT, BASE_DIR, RELEASES_DIR, LIVE_PROM_DIR, LIVE_AM_DIR, PROM_URL, AM_URL ...
EOF
}

gen_version() {
  date +%Y%m%d%H%M%S
}

set_current() {
  local v="$1"
  mkdir -p "$STATE_DIR"
  local tmp="$CURRENT_FILE.tmp.$$"
  echo "$v" >"$tmp"
  mv -f "$tmp" "$CURRENT_FILE"
}

cmd_current() {
  if [[ -s "$CURRENT_FILE" ]]; then
    cat "$CURRENT_FILE"
  else
    echo "(unknown)"
  fi
}

cmd_list() {
  if [[ ! -d "$RELEASES_DIR" ]]; then
    return 0
  fi
  find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort
}

# =========================
# Validation
# =========================
validate_release() {
  local dir="$1"

  [[ -d "$dir/prometheus" ]] || fatal "release missing prometheus dir: $dir/prometheus"
  [[ -d "$dir/alertmanager" ]] || fatal "release missing alertmanager dir: $dir/alertmanager"
  [[ -f "$dir/prometheus/prometheus.yml" ]] || fatal "missing prometheus.yml"
  [[ -f "$dir/alertmanager/alertmanager.yml" ]] || fatal "missing alertmanager.yml"

  log "validate prometheus config"
  promtool check config "$dir/prometheus/prometheus.yml"

  local cnt=0
  while IFS= read -r -d '' f; do
    cnt=$((cnt + 1))
    promtool check rules "$f"
  done < <(find "$dir/prometheus/rules" -type f \( -name "*.yml" -o -name "*.yaml" \) -print0 2>/dev/null || true)

  if [[ "$cnt" -eq 0 ]]; then
    log "WARN: no Prometheus rule files found under $dir/prometheus/rules"
  else
    log "checked $cnt rule files"
  fi

  log "validate alertmanager config"
  amtool check-config "$dir/alertmanager/alertmanager.yml"
}

# =========================
# Reload
# =========================
metric_value() {
  local base_url="$1"
  local metric="$2"
  curl -fsS "$base_url/metrics" | awk -v m="$metric" '$1==m {print $2; exit}'
}

wait_metric_success() {
  local base_url="$1"
  local metric="$2"
  local tries="${3:-6}"
  local delay="${4:-1}"
  local i val

  for ((i=1; i<=tries; i++)); do
    val="$(metric_value "$base_url" "$metric" || true)"
    if [[ "$val" == "1" || "$val" == "1.0" ]]; then
      return 0
    fi
    sleep "$delay"
  done
  return 1
}

hot_reload_prometheus() {
  log "hot reload prometheus"
  curl -fsS -X POST "$PROM_URL/-/reload" >/dev/null
  wait_metric_success "$PROM_URL" "prometheus_config_last_reload_successful" "$RELOAD_RETRIES" "$RELOAD_DELAY_SEC"
}

hot_reload_alertmanager() {
  log "hot reload alertmanager"
  curl -fsS -X POST "$AM_URL/-/reload" >/dev/null
  wait_metric_success "$AM_URL" "alertmanager_config_last_reload_successful" "$RELOAD_RETRIES" "$RELOAD_DELAY_SEC"
}

hot_reload_all() {
  hot_reload_prometheus && hot_reload_alertmanager
}

restart_fallback() {
  log "restart fallback enabled, restarting services..."
  systemctl restart "$PROM_SERVICE" "$AM_SERVICE"
  systemctl is-active --quiet "$PROM_SERVICE"
  systemctl is-active --quiet "$AM_SERVICE"
}

reload_with_optional_fallback() {
  if hot_reload_all; then
    log "hot reload success"
    return 0
  fi

  log "hot reload failed"
  if [[ "$ALLOW_RESTART_FALLBACK" == "1" ]]; then
    restart_fallback
    log "restart fallback success"
    return 0
  fi

  return 1
}

# =========================
# Release flow
# =========================
build_release() {
  local version="$1"
  local out="$RELEASES_DIR/$version"

  [[ -d "$SRC_ROOT/prometheus" ]] || fatal "source missing: $SRC_ROOT/prometheus"
  [[ -d "$SRC_ROOT/alertmanager" ]] || fatal "source missing: $SRC_ROOT/alertmanager"
  [[ ! -e "$out" ]] || fatal "release already exists: $version"

  mkdir -p "$RELEASES_DIR"
  mkdir -p "$out"

  rsync -a --delete "$SRC_ROOT/prometheus/" "$out/prometheus/"
  rsync -a --delete "$SRC_ROOT/alertmanager/" "$out/alertmanager/"

  echo "$out"
}

sync_to_live() {
  local dir="$1"
  mkdir -p "$LIVE_PROM_DIR" "$LIVE_AM_DIR"
  rsync -a --delete "$dir/prometheus/" "$LIVE_PROM_DIR/"
  rsync -a --delete "$dir/alertmanager/" "$LIVE_AM_DIR/"
}

apply_release() {
  local dir="$1"
  local version="$2"

  [[ -d "$dir" ]] || fatal "release dir not found: $dir"

  validate_release "$dir"
  log "sync release -> live (version=$version)"
  sync_to_live "$dir"

  reload_with_optional_fallback || fatal "reload failed after applying version=$version"

  set_current "$version"
  log "apply success: $version"
}

cmd_deploy() {
  local version="${1:-$(gen_version)}"
  PREV_VERSION="$(cmd_current || true)"
  [[ "$PREV_VERSION" == "(unknown)" ]] && PREV_VERSION=""

  log "start deploy version=$version prev=${PREV_VERSION:-none}"

  local dir
  dir="$(build_release "$version")"

  DEPLOY_IN_PROGRESS=1
  apply_release "$dir" "$version"
  DEPLOY_IN_PROGRESS=0

  log "deploy done: $version"
}

cmd_rollback() {
  local version="${1:-}"
  [[ -n "$version" ]] || fatal "rollback requires version"
  local dir="$RELEASES_DIR/$version"
  [[ -d "$dir" ]] || fatal "release version not found: $version"

  log "start rollback -> $version"
  apply_release "$dir" "$version"
  log "rollback done: $version"
}

on_err() {
  local code=$?
  trap - ERR

  if [[ "$DEPLOY_IN_PROGRESS" -eq 1 && -n "$PREV_VERSION" && -d "$RELEASES_DIR/$PREV_VERSION" ]]; then
    log "deploy failed, auto rollback to previous version: $PREV_VERSION"
    DEPLOY_IN_PROGRESS=0
    set +e
    apply_release "$RELEASES_DIR/$PREV_VERSION" "$PREV_VERSION"
    local rb=$?
    set -e
    if [[ "$rb" -ne 0 ]]; then
      log "CRITICAL: auto rollback also failed"
    fi
  fi

  exit "$code"
}
trap on_err ERR

ensure_runtime_for_apply() {
  require_cmd rsync
  require_cmd curl
  require_cmd awk
  require_cmd promtool
  require_cmd amtool
  if [[ "$ALLOW_RESTART_FALLBACK" == "1" ]]; then
    require_cmd systemctl
  fi
}

main() {
  local cmd="${1:-}"
  shift || true

  case "$cmd" in
    deploy)
      ensure_root
      ensure_runtime_for_apply
      acquire_lock
      cmd_deploy "${1:-}"
      ;;
    rollback)
      ensure_root
      ensure_runtime_for_apply
      acquire_lock
      cmd_rollback "${1:-}"
      ;;
    list)
      cmd_list
      ;;
    current)
      cmd_current
      ;;
    *)
      usage
      exit 2
      ;;
  esac
}

main "$@"
```

---

### CI 调用方式（热更新优先）
```bash
sudo ALLOW_RESTART_FALLBACK=0 /usr/local/sbin/deploy-monitoring.sh deploy "$VERSION"
```

### 紧急人工兜底（允许重启）
```bash
sudo ALLOW_RESTART_FALLBACK=1 /usr/local/sbin/deploy-monitoring.sh deploy "$VERSION"
```

如果你愿意，我下一步可以把你现有 GitHub Actions 也对应改成一份**完全匹配这个脚本的最终 YAML**（含审批、失败回滚、Slack/飞书通知）。