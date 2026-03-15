const fs = require("fs");
const path = require("path");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RUNTIME_TENANT_ID_FILE = path.resolve(
  __dirname,
  "../../../../.runtime/tenant/local-tenant-id",
);

function normalizeTenantId(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function assertTenantId(value, source) {
  const tenantId = normalizeTenantId(value);
  if (!tenantId) {
    return "";
  }

  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error(`invalid tenant id from ${source}: ${value}`);
  }

  return tenantId;
}

function readRuntimeTenantId() {
  if (!fs.existsSync(RUNTIME_TENANT_ID_FILE)) {
    return "";
  }

  const fileContent = fs.readFileSync(RUNTIME_TENANT_ID_FILE, "utf8");
  return assertTenantId(fileContent, RUNTIME_TENANT_ID_FILE);
}

function resolveE2ETenantId() {
  const envTenantId =
    assertTenantId(process.env.E2E_TENANT_ID, "E2E_TENANT_ID") ||
    assertTenantId(process.env.INGEST_DEFAULT_TENANT_ID, "INGEST_DEFAULT_TENANT_ID");

  if (envTenantId) {
    return envTenantId;
  }

  const runtimeTenantId = readRuntimeTenantId();
  if (runtimeTenantId) {
    return runtimeTenantId;
  }

  throw new Error(
    `missing E2E tenant id: set E2E_TENANT_ID or INGEST_DEFAULT_TENANT_ID, or create ${RUNTIME_TENANT_ID_FILE}`,
  );
}

module.exports = {
  RUNTIME_TENANT_ID_FILE,
  resolveE2ETenantId,
};
