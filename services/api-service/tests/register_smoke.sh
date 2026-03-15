#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:8085}"
REGISTER_PATH="${REGISTER_PATH:-/api/v1/auth/register}"
REGISTER_URL="${API_BASE_URL}${REGISTER_PATH}"
TENANT_ID="${SMOKE_TENANT_ID:-}"

if [[ -z "${TENANT_ID}" ]]; then
  echo "ERROR: SMOKE_TENANT_ID is required." >&2
  echo "Example:" >&2
  echo "  SMOKE_TENANT_ID=<tenant-uuid> $0" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl is required." >&2
  exit 1
fi

if command -v uuidgen >/dev/null 2>&1; then
  random_uuid() {
    uuidgen | tr '[:upper:]' '[:lower:]'
  }
else
  random_uuid() {
    cat /proc/sys/kernel/random/uuid
  }
fi

suffix="$(random_uuid | cut -c1-8)"
username="smoke_user_${suffix}"
email="${username}@example.com"
password="Password123"

print_case() {
  printf '\n==> %s\n' "$1"
}

call_register() {
  local tenant="$1"
  local body="$2"

  local tmp_body
  tmp_body="$(mktemp)"
  local status

  if [[ -n "${tenant}" ]]; then
    status="$(curl -sS -o "${tmp_body}" -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -H "X-Tenant-ID: ${tenant}" \
      -X POST "${REGISTER_URL}" \
      -d "${body}")"
  else
    status="$(curl -sS -o "${tmp_body}" -w "%{http_code}" \
      -H "Content-Type: application/json" \
      -X POST "${REGISTER_URL}" \
      -d "${body}")"
  fi

  printf '%s\n' "${status}"
  cat "${tmp_body}"
  rm -f "${tmp_body}"
}

assert_status_code() {
  local actual="$1"
  local expected="$2"
  local name="$3"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "[FAIL] ${name}: expected status ${expected}, got ${actual}" >&2
    return 1
  fi
  echo "[PASS] ${name}: status ${actual}"
}

assert_contains() {
  local text="$1"
  local needle="$2"
  local name="$3"
  if ! grep -q "${needle}" <<<"${text}"; then
    echo "[FAIL] ${name}: response does not contain '${needle}'" >&2
    return 1
  fi
  echo "[PASS] ${name}: contains '${needle}'"
}

main() {
  local output status body

  print_case "1) success register"
  output="$(call_register "${TENANT_ID}" "{\"username\":\"${username}\",\"password\":\"${password}\",\"email\":\"${email}\",\"display_name\":\"Smoke User\"}")"
  status="$(head -n1 <<<"${output}")"
  body="$(tail -n +2 <<<"${output}")"
  assert_status_code "${status}" "201" "success register"
  assert_contains "${body}" '"code":"OK"' "success register"

  print_case "2) duplicate username"
  output="$(call_register "${TENANT_ID}" "{\"username\":\"${username}\",\"password\":\"${password}\",\"email\":\"other_${email}\",\"display_name\":\"Dup User\"}")"
  status="$(head -n1 <<<"${output}")"
  body="$(tail -n +2 <<<"${output}")"
  assert_status_code "${status}" "409" "duplicate username"
  assert_contains "${body}" 'AUTH_REGISTER_USERNAME_CONFLICT' "duplicate username"

  print_case "3) duplicate email"
  output="$(call_register "${TENANT_ID}" "{\"username\":\"other_${username}\",\"password\":\"${password}\",\"email\":\"${email}\",\"display_name\":\"Dup Email\"}")"
  status="$(head -n1 <<<"${output}")"
  body="$(tail -n +2 <<<"${output}")"
  assert_status_code "${status}" "409" "duplicate email"
  assert_contains "${body}" 'AUTH_REGISTER_EMAIL_CONFLICT' "duplicate email"

  print_case "4) missing tenant header"
  output="$(call_register "" "{\"username\":\"m_${username}\",\"password\":\"${password}\",\"email\":\"m_${email}\",\"display_name\":\"No Tenant\"}")"
  status="$(head -n1 <<<"${output}")"
  body="$(tail -n +2 <<<"${output}")"
  assert_status_code "${status}" "400" "missing tenant"
  assert_contains "${body}" 'AUTH_REGISTER_TENANT_REQUIRED' "missing tenant"

  print_case "5) invalid tenant header"
  output="$(call_register "invalid-tenant" "{\"username\":\"i_${username}\",\"password\":\"${password}\",\"email\":\"i_${email}\",\"display_name\":\"Invalid Tenant\"}")"
  status="$(head -n1 <<<"${output}")"
  body="$(tail -n +2 <<<"${output}")"
  assert_status_code "${status}" "400" "invalid tenant"
  assert_contains "${body}" 'AUTH_REGISTER_TENANT_INVALID' "invalid tenant"

  print_case "6) tenant not found"
  output="$(call_register "$(random_uuid)" "{\"username\":\"n_${username}\",\"password\":\"${password}\",\"email\":\"n_${email}\",\"display_name\":\"Unknown Tenant\"}")"
  status="$(head -n1 <<<"${output}")"
  body="$(tail -n +2 <<<"${output}")"
  assert_status_code "${status}" "404" "tenant not found"
  assert_contains "${body}" 'AUTH_REGISTER_TENANT_NOT_FOUND' "tenant not found"

  printf '\nAll register smoke checks passed.\n'
}

main "$@"
