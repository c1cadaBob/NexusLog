非常好，我们把它做成“**默认热更新、失败自动回滚**”的标准化脚本。
你可以直接落地下面这套：

---

## 目录结构建议

```bash
.
├── Makefile
├── scripts/
│   └── deploy-monitoring.sh
└── monitoring/
    ├── prometheus/
    │   ├── prometheus.yml
    │   └── rules/
    │       └── audit-export-alerts.yml
    └── alertmanager/
        ├── alertmanager.yml
        └── templates/
            └── alert.tmpl
```

---

## 1) `scripts/deploy-monitoring.sh`

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-deploy}"

# ===== 可通过环境变量覆盖 =====
SRC_ROOT="${SRC_ROOT:-$(pwd)/monitoring}"

PROM_DIR="${PROM_DIR:-/etc/prometheus}"
PROM_CONFIG="${PROM_CONFIG:-$PROM_DIR/prometheus.yml}"
PROM_RULES_DIR="${PROM_RULES_DIR:-$PROM_DIR/rules}"

AM_DIR="${AM_DIR:-/etc/alertmanager}"
AM_CONFIG="${AM_CONFIG:-$AM_DIR/alertmanager.yml}"
AM_TEMPLATES_DIR="${AM_TEMPLATES_DIR:-$AM_DIR/templates}"

PROM_URL="${PROM_URL:-http://127.0.0.1:9090}"
AM_URL="${AM_URL:-http://127.0.0.1:9093}"

BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/monitoring-hotreload}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

DEPLOY_STARTED=0
BACKUP_DIR=""

log() { echo "[$(date +'%F %T')] $*"; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "missing command: $1"; exit 1; }
}

atomic_install_file() {
  local src="$1" dst="$2" mode="${3:-0644}"
  local dir tmp
  dir="$(dirname "$dst")"
  mkdir -p "$dir"
  tmp="$(mktemp "${dst}.tmp.XXXXXX")"
  install -m "$mode" "$src" "$tmp"
  mv -f "$tmp" "$dst"
}

sync_dir_atomic_files() {
  # 原子到“单文件粒度”：每个文件 tmp + mv；最后清理已删除文件
  local src="$1" dst="$2" mode="${3:-0644}"
  mkdir -p "$dst"

  # copy/update
  while IFS= read -r -d '' file; do
    rel="${file#"$src"/}"
    target="$dst/$rel"
    mkdir -p "$(dirname "$target")"
    tmp="$(mktemp "${target}.tmp.XXXXXX")"
    install -m "$mode" "$file" "$tmp"
    mv -f "$tmp" "$target"
  done < <(find "$src" -type f -print0)

  # delete stale
  while IFS= read -r -d '' file; do
    rel="${file#"$dst"/}"
    [[ -f "$src/$rel" ]] || rm -f "$file"
  done < <(find "$dst" -type f -print0)
}

validate_source() {
  log "validate source files..."
  [[ -f "$SRC_ROOT/prometheus/prometheus.yml" ]] || { echo "missing prometheus.yml"; exit 1; }
  [[ -d "$SRC_ROOT/prometheus/rules" ]] || { echo "missing prometheus/rules"; exit 1; }
  [[ -f "$SRC_ROOT/alertmanager/alertmanager.yml" ]] || { echo "missing alertmanager.yml"; exit 1; }
  [[ -d "$SRC_ROOT/alertmanager/templates" ]] || { echo "missing alertmanager/templates"; exit 1; }

  promtool check config "$SRC_ROOT/prometheus/prometheus.yml"

  shopt -s nullglob
  rules=("$SRC_ROOT"/prometheus/rules/*.yml)
  (( ${#rules[@]} > 0 )) || { echo "no rule files found"; exit 1; }
  for f in "${rules[@]}"; do
    promtool check rules "$f"
  done
  shopt -u nullglob

  amtool check-config "$SRC_ROOT/alertmanager/alertmanager.yml"
  log "validation passed."
}

backup_current() {
  mkdir -p "$BACKUP_ROOT"
  BACKUP_DIR="$BACKUP_ROOT/$(date +'%Y%m%d_%H%M%S')"
  mkdir -p "$BACKUP_DIR"

  log "backup current config -> $BACKUP_DIR"
  [[ -f "$PROM_CONFIG" ]] && cp -a "$PROM_CONFIG" "$BACKUP_DIR/prometheus.yml" || true
  [[ -d "$PROM_RULES_DIR" ]] && cp -a "$PROM_RULES_DIR" "$BACKUP_DIR/rules" || true
  [[ -f "$AM_CONFIG" ]] && cp -a "$AM_CONFIG" "$BACKUP_DIR/alertmanager.yml" || true
  [[ -d "$AM_TEMPLATES_DIR" ]] && cp -a "$AM_TEMPLATES_DIR" "$BACKUP_DIR/templates" || true
}

restore_backup() {
  [[ -n "$BACKUP_DIR" ]] || return 0
  log "rollback from backup: $BACKUP_DIR"

  [[ -f "$BACKUP_DIR/prometheus.yml" ]] && atomic_install_file "$BACKUP_DIR/prometheus.yml" "$PROM_CONFIG"
  if [[ -d "$BACKUP_DIR/rules" ]]; then
    rm -rf "$PROM_RULES_DIR"
    cp -a "$BACKUP_DIR/rules" "$PROM_RULES_DIR"
  fi

  [[ -f "$BACKUP_DIR/alertmanager.yml" ]] && atomic_install_file "$BACKUP_DIR/alertmanager.yml" "$AM_CONFIG"
  if [[ -d "$BACKUP_DIR/templates" ]]; then
    rm -rf "$AM_TEMPLATES_DIR"
    cp -a "$BACKUP_DIR/templates" "$AM_TEMPLATES_DIR"
  fi

  reload_services || true
}

reload_services() {
  log "reload Prometheus..."
  curl -fsS -X POST "$PROM_URL/-/reload" >/dev/null
  log "reload Alertmanager..."
  curl -fsS -X POST "$AM_URL/-/reload" >/dev/null

  # 健康检查
  curl -fsS "$PROM_URL/-/ready" >/dev/null
  curl -fsS "$AM_URL/-/ready" >/dev/null
  log "reload and readiness check passed."
}

cleanup_old_backups() {
  [[ -d "$BACKUP_ROOT" ]] || return 0
  mapfile -t all_backups < <(ls -1dt "$BACKUP_ROOT"/* 2>/dev/null || true)
  if (( ${#all_backups[@]} > KEEP_BACKUPS )); then
    for d in "${all_backups[@]:KEEP_BACKUPS}"; do
      rm -rf "$d"
    done
  fi
}

on_error() {
  local exit_code=$?
  if [[ "$DEPLOY_STARTED" -eq 1 ]]; then
    log "deploy failed, start rollback..."
    restore_backup
  fi
  log "exit with code $exit_code"
  exit "$exit_code"
}
trap on_error ERR

main() {
  require_cmd promtool
  require_cmd amtool
  require_cmd curl
  require_cmd find
  require_cmd install
  require_cmd mktemp

  case "$ACTION" in
    check)
      validate_source
      ;;
    deploy)
      validate_source
      backup_current
      DEPLOY_STARTED=1

      log "deploy prometheus config..."
      atomic_install_file "$SRC_ROOT/prometheus/prometheus.yml" "$PROM_CONFIG"

      log "deploy prometheus rules..."
      sync_dir_atomic_files "$SRC_ROOT/prometheus/rules" "$PROM_RULES_DIR"

      log "deploy alertmanager config..."
      atomic_install_file "$SRC_ROOT/alertmanager/alertmanager.yml" "$AM_CONFIG"

      log "deploy alertmanager templates..."
      sync_dir_atomic_files "$SRC_ROOT/alertmanager/templates" "$AM_TEMPLATES_DIR"

      reload_services
      DEPLOY_STARTED=0
      cleanup_old_backups
      log "deploy success."
      ;;
    reload)
      reload_services
      ;;
    *)
      echo "usage: $0 [check|deploy|reload]"
      exit 1
      ;;
  esac
}

main "$@"
```

---

## 2) `Makefile`

```makefile
SHELL := /bin/bash

SRC_ROOT ?= $(CURDIR)/monitoring
PROM_URL ?= http://127.0.0.1:9090
AM_URL   ?= http://127.0.0.1:9093

SCRIPT := ./scripts/deploy-monitoring.sh

.PHONY: check deploy reload status

check:
	SRC_ROOT=$(SRC_ROOT) $(SCRIPT) check

deploy:
	sudo SRC_ROOT=$(SRC_ROOT) PROM_URL=$(PROM_URL) AM_URL=$(AM_URL) $(SCRIPT) deploy

reload:
	curl -fsS -X POST $(PROM_URL)/-/reload >/dev/null
	curl -fsS -X POST $(AM_URL)/-/reload >/dev/null
	@echo "reload done"

status:
	curl -fsS $(PROM_URL)/-/ready >/dev/null && echo "Prometheus: ready"
	curl -fsS $(AM_URL)/-/ready >/dev/null && echo "Alertmanager: ready"
```

---

## 3) 使用方式

```bash
chmod +x scripts/deploy-monitoring.sh

# 只校验，不改线上
make check

# 部署 + 热更新 + 失败自动回滚
make deploy

# 查看就绪状态
make status
```

---

## 4) 一个关键前提（务必确认）

Prometheus / Alertmanager 启动参数包含：

- `--web.enable-lifecycle`

否则 `/-/reload` 不会生效。

---

如果你愿意，我下一步可以给你再加一版：
**“Git 提交哈希写入告警模板 + 回滚到指定版本（而不是最近备份）”**，这样排障和审计会更稳。