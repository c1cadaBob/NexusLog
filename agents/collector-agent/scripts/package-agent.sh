#!/usr/bin/env bash
set -euo pipefail

# 预编译打包脚本：输出可直接分发的 Linux 二进制与安装资产。
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"
TARGET_OS="${TARGET_OS:-linux}"
TARGET_ARCH="${TARGET_ARCH:-amd64}"
PKG_NAME="collector-agent-${TARGET_OS}-${TARGET_ARCH}"
OUT_DIR="${DIST_DIR}/${PKG_NAME}"
ARCHIVE_PATH="${DIST_DIR}/${PKG_NAME}.tar.gz"

echo "[package] root=${ROOT_DIR}"
echo "[package] target=${TARGET_OS}/${TARGET_ARCH}"

rm -rf "${OUT_DIR}"
mkdir -p "${OUT_DIR}" "${OUT_DIR}/deploy/systemd" "${OUT_DIR}/deploy/docker"

cd "${ROOT_DIR}"
CGO_ENABLED=0 GOOS="${TARGET_OS}" GOARCH="${TARGET_ARCH}" go build -ldflags="-s -w" -o "${OUT_DIR}/collector-agent" ./cmd/agent

cp -R configs "${OUT_DIR}/configs"
cp deploy/systemd/collector-agent.service "${OUT_DIR}/deploy/systemd/"
cp deploy/systemd/collector-agent.env.example "${OUT_DIR}/deploy/systemd/"
install -m 0755 scripts/install-release.sh "${OUT_DIR}/deploy/systemd/collector-agent-installer.sh"
cp deploy/docker/docker-compose.agent.yml "${OUT_DIR}/deploy/docker/"

tar -C "${DIST_DIR}" -czf "${ARCHIVE_PATH}" "${PKG_NAME}"

echo "[package] binary: ${OUT_DIR}/collector-agent"
echo "[package] archive: ${ARCHIVE_PATH}"
