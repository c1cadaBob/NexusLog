#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

SERVICES=(
  collector-agent
  collector-agent-remote
  control-plane
  query-api
  frontend-console
)

echo "[rewrite] stopping legacy log chain services: ${SERVICES[*]}"
docker compose stop "${SERVICES[@]}"
echo "[rewrite] legacy log chain stopped"
