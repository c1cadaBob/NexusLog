#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${NEXUSLOG_HOST_META_DIR:-${ROOT_DIR}/.runtime/host-meta}"
mkdir -p "${OUT_DIR}"

trim() {
  sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

HOSTNAME_VALUE="${NEXUSLOG_SOURCE_HOSTNAME:-}"
if [[ -z "${HOSTNAME_VALUE}" ]]; then
  HOSTNAME_VALUE="$(hostnamectl --static 2>/dev/null || true)"
fi
if [[ -z "${HOSTNAME_VALUE}" ]]; then
  HOSTNAME_VALUE="$(hostname 2>/dev/null || true)"
fi
HOSTNAME_VALUE="$(printf '%s' "${HOSTNAME_VALUE}" | tr -d '\r' | trim)"

SOURCE_IP="${NEXUSLOG_SOURCE_IP:-}"
if [[ -z "${SOURCE_IP}" ]] && command -v ip >/dev/null 2>&1; then
  SOURCE_IP="$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i=="src") {print $(i+1); exit}}')"
fi
if [[ -z "${SOURCE_IP}" ]] && command -v ip >/dev/null 2>&1; then
  SOURCE_IP="$(ip -o -4 addr show up scope global 2>/dev/null | awk '
    $2 !~ /^(docker0|br-|veth|cni|flannel|virbr)/ {
      split($4, addr, "/");
      print addr[1];
      exit
    }
  ')"
fi
if [[ -z "${SOURCE_IP}" ]]; then
  SOURCE_IP="$(hostname -I 2>/dev/null | awk '{for (i=1;i<=NF;i++) if ($i !~ /^127\./ && $i !~ /^169\.254\./) {print $i; exit}}')"
fi
SOURCE_IP="$(printf '%s' "${SOURCE_IP}" | tr -d '\r' | trim)"

if [[ -z "${HOSTNAME_VALUE}" ]]; then
  echo "failed to determine source hostname; set NEXUSLOG_SOURCE_HOSTNAME explicitly" >&2
  exit 1
fi
if [[ -z "${SOURCE_IP}" ]]; then
  echo "failed to determine source IP; set NEXUSLOG_SOURCE_IP explicitly" >&2
  exit 1
fi

printf '%s\n' "${HOSTNAME_VALUE}" > "${OUT_DIR}/source_hostname"
printf '%s\n' "${SOURCE_IP}" > "${OUT_DIR}/source_ip"

echo "wrote host identity to ${OUT_DIR}" >&2
echo "hostname=${HOSTNAME_VALUE}" >&2
echo "source_ip=${SOURCE_IP}" >&2
