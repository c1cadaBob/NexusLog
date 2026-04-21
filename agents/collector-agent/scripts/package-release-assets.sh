#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
TARGET_MATRIX=("linux/amd64" "linux/arm64")
CHECKSUM_FILE="${DIST_DIR}/collector-agent-checksums.txt"
INSTALLER_ASSET="${DIST_DIR}/collector-agent-installer.sh"
ASSETS=()

echo "[release] root=${ROOT_DIR}"
rm -f "${CHECKSUM_FILE}" "${INSTALLER_ASSET}"

for target in "${TARGET_MATRIX[@]}"; do
  target_os="${target%%/*}"
  target_arch="${target##*/}"
  echo "[release] packaging ${target_os}/${target_arch}"
  TARGET_OS="${target_os}" TARGET_ARCH="${target_arch}" bash "${ROOT_DIR}/scripts/package-agent.sh"
  ASSETS+=("collector-agent-${target_os}-${target_arch}.tar.gz")
done

install -m 0755 "${ROOT_DIR}/scripts/install-release.sh" "${INSTALLER_ASSET}"

(
  cd "${DIST_DIR}"
  sha256sum "${ASSETS[@]}" "$(basename "${INSTALLER_ASSET}")" > "$(basename "${CHECKSUM_FILE}")"
)

echo "[release] assets:"
printf '  - %s\n' "${ASSETS[@]}"
echo "  - $(basename "${INSTALLER_ASSET}")"
echo "  - $(basename "${CHECKSUM_FILE}")"
