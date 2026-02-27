太好了，继续推进 👇
你这个“**热更新 + 可审计 + 可指定版本回滚**”思路非常专业。

下面给你 **V2 增强版**（直接可用）：

---

## 1) 在 Prometheus 配置里预留版本占位符

`monitoring/prometheus/prometheus.yml`（示例）：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: prod
    config_version: "__CONFIG_VERSION__"
```

> 这样每条告警都会带上 `config_version`，Alertmanager 模板里可直接展示。

---

## 2) 告警模板里显示版本号

`monitoring/alertmanager/templates/alert.tmpl` 增加：

```tmpl
{{- if .CommonLabels.config_version }}
*ConfigVersion:* {{ .CommonLabels.config_version }}
{{- end }}
```

---

## 3) 部署脚本（支持 deploy/list/current/rollback）

`scripts/deploy-monitoring-v2.sh`：

```bash
#!/usr/bin/env bash
set -Eeuo pipefail

ACTION="${1:-help}"
ARG_VERSION="${2:-}"

SRC_ROOT="${SRC_ROOT:-$(pwd)/monitoring}"

PROM_DIR="${PROM_DIR:-/etc/prometheus}"
PROM_CONFIG="${PROM_CONFIG:-$PROM_DIR/prometheus.yml}"
PROM_RULES_DIR="${PROM_RULES_DIR:-$PROM_DIR/rules}"

AM_DIR="${AM_DIR:-/etc/alertmanager}"
AM_CONFIG="${AM_CONFIG:-$AM_DIR/alertmanager.yml}"
AM_TEMPLATES_DIR="${AM_TEMPLATES_DIR:-$AM_DIR/templates}"

PROM_URL="${PROM_URL:-http://127.0.0.1:9090}"
AM_URL="${AM_URL:-http://127.0.0.1:9093}"

RELEASE_ROOT="${RELEASE_ROOT:-/var/lib/monitoring-releases}"
RELEASES_DIR="$RELEASE_ROOT/releases"
CURRENT_FILE="$RELEASE_ROOT/CURRENT_VERSION"

log(){ echo "[$(date +'%F %T')] $*"; }
die(){ echo "ERROR: $*" >&2; exit 1; }

require_cmd(){ command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

atomic_install_file() {
  local src="$1" dst="$2" mode="${3:-0644}"
  local tmp
  mkdir -p "$(dirname "$dst")"
  tmp="$(mktemp "${dst}.tmp.XXXXXX")"
  install -m "$mode" "$src" "$tmp"
  mv -f "$tmp" "$dst"
}

sync_dir_atomic_files() {
  local src="$1" dst="$2" mode="${3:-0644}"
  mkdir -p "$dst"

  while IFS= read -r -d '' f; do
    rel="${f#"$src"/}"
    target="$dst/$rel"
    mkdir -p "$(dirname "$target")"
    tmp="$(mktemp "${target}.tmp.XXXXXX")"
    install -m "$mode" "$f" "$tmp"
    mv -f "$tmp" "$target"
  done < <(find "$src" -type f -print0)

  while IFS= read -r -d '' f; do
    rel="${f#"$dst"/}"
    [[ -f "$src/$rel" ]] || rm -f "$f"
  done < <(find "$dst" -type f -print0)
}

gen_version() {
  if [[ -n "$ARG_VERSION" ]]; then
    echo "$ARG_VERSION"; return
  fi
  if git -C "$SRC_ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
    echo "$(git -C "$SRC_ROOT" rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
  else
    echo "manual-$(date +%Y%m%d%H%M%S)"
  fi
}

build_release() {
  local version="$1"
  local dir="$RELEASES_DIR/$version"
  [[ ! -e "$dir" ]] || die "release exists: $version"

  mkdir -p "$dir/prometheus/rules" "$dir/alertmanager/templates"

  # 渲染 prometheus.yml（注入 CONFIG_VERSION）
  sed "s/__CONFIG_VERSION__/$version/g" \
    "$SRC_ROOT/prometheus/prometheus.yml" > "$dir/prometheus/prometheus.yml"

  cp -a "$SRC_ROOT/prometheus/rules/." "$dir/prometheus/rules/"
  cp -a "$SRC_ROOT/alertmanager/alertmanager.yml" "$dir/alertmanager/alertmanager.yml"
  cp -a "$SRC_ROOT/alertmanager/templates/." "$dir/alertmanager/templates/"

  cat > "$dir/metadata.txt" <<EOF
version=$version
built_at=$(date -Iseconds)
source_root=$SRC_ROOT
EOF

  echo "$dir"
}

validate_release() {
  local dir="$1"
  promtool check config "$dir/prometheus/prometheus.yml" >/dev/null

  shopt -s nullglob
  local rules=("$dir"/prometheus/rules/*.yml "$dir"/prometheus/rules/*.yaml)
  (( ${#rules[@]} > 0 )) || die "no rule files in release"
  for f in "${rules[@]}"; do
    promtool check rules "$f" >/dev/null
  done
  shopt -u nullglob

  amtool check-config "$dir/alertmanager/alertmanager.yml" >/dev/null
}

reload_services() {
  curl -fsS -X POST "$PROM_URL/-/reload" >/dev/null
  curl -fsS -X POST "$AM_URL/-/reload" >/dev/null
  curl -fsS "$PROM_URL/-/ready" >/dev/null
  curl -fsS "$AM_URL/-/ready" >/dev/null
}

apply_release() {
  local dir="$1"
  local version="$2"

  atomic_install_file "$dir/prometheus/prometheus.yml" "$PROM_CONFIG"
  sync_dir_atomic_files "$dir/prometheus/rules" "$PROM_RULES_DIR"

  atomic_install_file "$dir/alertmanager/alertmanager.yml" "$AM_CONFIG"
  sync_dir_atomic_files "$dir/alertmanager/templates" "$AM_TEMPLATES_DIR"

  reload_services

  mkdir -p "$RELEASE_ROOT"
  echo "$version" > "$CURRENT_FILE"
  log "current version => $version"
}

cmd_deploy() {
  local version
  version="$(gen_version)"
  mkdir -p "$RELEASES_DIR"

  log "build release: $version"
  local dir
  dir="$(build_release "$version")"

  log "validate release..."
  validate_release "$dir"

  log "apply release..."
  apply_release "$dir" "$version"

  log "deploy success: $version"
}

cmd_rollback() {
  local version="${ARG_VERSION:-}"
  [[ -n "$version" ]] || die "usage: $0 rollback <version>"
  local dir="$RELEASES_DIR/$version"
  [[ -d "$dir" ]] || die "release not found: $version"

  log "validate target rollback release..."
  validate_release "$dir"

  log "rollback to $version ..."
  apply_release "$dir" "$version"

  log "rollback success: $version"
}

cmd_list() {
  [[ -d "$RELEASES_DIR" ]] || { echo "(no releases)"; return; }
  ls -1dt "$RELEASES_DIR"/* | xargs -n1 basename
}

cmd_current() {
  [[ -f "$CURRENT_FILE" ]] && cat "$CURRENT_FILE" || echo "(unknown)"
}

main() {
  require_cmd promtool
  require_cmd amtool
  require_cmd curl
  require_cmd sed
  require_cmd find
  require_cmd install
  require_cmd mktemp

  case "$ACTION" in
    deploy)   cmd_deploy ;;
    rollback) cmd_rollback ;;
    list)     cmd_list ;;
    current)  cmd_current ;;
    *)
      cat <<EOF
usage:
  $0 deploy [version]
  $0 rollback <version>
  $0 list
  $0 current
EOF
      ;;
  esac
}
main "$@"
```

---

## 4) Makefile（新增版本化命令）

```makefile
SHELL := /bin/bash
SCRIPT := ./scripts/deploy-monitoring-v2.sh

SRC_ROOT ?= $(CURDIR)/monitoring
PROM_URL ?= http://127.0.0.1:9090
AM_URL   ?= http://127.0.0.1:9093

.PHONY: deploy list current rollback

deploy:
	sudo SRC_ROOT=$(SRC_ROOT) PROM_URL=$(PROM_URL) AM_URL=$(AM_URL) $(SCRIPT) deploy

list:
	sudo $(SCRIPT) list

current:
	sudo $(SCRIPT) current

# 用法：make rollback VERSION=abc123-20260219103000
rollback:
	test -n "$(VERSION)" || (echo "VERSION is required"; exit 1)
	sudo PROM_URL=$(PROM_URL) AM_URL=$(AM_URL) $(SCRIPT) rollback $(VERSION)
```

---

## 5) 使用示例

```bash
chmod +x scripts/deploy-monitoring-v2.sh

make deploy
make list
make current
make rollback VERSION=<你要回滚的版本号>
```

---

如果你愿意，下一步我给你再补一个 **GitHub Actions / GitLab CI** 流水线版：
提交后自动 `check -> deploy`，并把版本号回写到变更记录里。这样团队协作会更稳。