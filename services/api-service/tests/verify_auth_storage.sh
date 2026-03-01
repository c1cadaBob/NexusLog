#!/usr/bin/env bash
set -euo pipefail

# Usage:
# TEST_DB_DSN=postgres://... \
# VERIFY_TENANT_ID=<tenant-uuid> \
# VERIFY_USERNAME=<username> \
# services/api-service/tests/verify_auth_storage.sh

if [[ -z "${TEST_DB_DSN:-}" ]]; then
  echo "TEST_DB_DSN is required"
  exit 1
fi

if [[ -z "${VERIFY_TENANT_ID:-}" ]]; then
  echo "VERIFY_TENANT_ID is required"
  exit 1
fi

if [[ -z "${VERIFY_USERNAME:-}" ]]; then
  echo "VERIFY_USERNAME is required"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="${SCRIPT_DIR}/sql/auth_storage_verification.sql"

if [[ ! -f "${SQL_FILE}" ]]; then
  echo "verification sql not found: ${SQL_FILE}"
  exit 1
fi

echo "==> verifying auth storage tables"
echo "tenant_id=${VERIFY_TENANT_ID}"
echo "username=${VERIFY_USERNAME}"

psql "${TEST_DB_DSN}" \
  -v ON_ERROR_STOP=1 \
  -v tenant_id="${VERIFY_TENANT_ID}" \
  -v username="${VERIFY_USERNAME}" \
  -f "${SQL_FILE}"

echo "✅ auth storage verification passed"
