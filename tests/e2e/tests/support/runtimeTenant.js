const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROOT_DIR = path.resolve(__dirname, "../../../../");
const RUNTIME_TENANT_ID_FILE = path.resolve(
  process.env.E2E_RUNTIME_TENANT_ID_FILE || path.join(ROOT_DIR, ".runtime/tenant/local-tenant-id"),
);
const FRONTEND_OVERRIDE_CONFIG_PATH = path.resolve(
  process.env.E2E_FRONTEND_TENANT_OVERRIDE_PATH ||
    path.join(ROOT_DIR, "apps/frontend-console/public/config/app-config.local.json"),
);
const TENANT_SYNC_SCRIPT = path.resolve(
  process.env.E2E_TENANT_SYNC_SCRIPT || path.join(ROOT_DIR, "scripts/local/ensure-local-tenant-config.sh"),
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

function isTruthy(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isTenantAutoSyncDisabled() {
  const value = process.env.E2E_TENANT_AUTO_SYNC;
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }

  return !isTruthy(value);
}

function readRuntimeTenantId() {
  if (!fs.existsSync(RUNTIME_TENANT_ID_FILE)) {
    return "";
  }

  const fileContent = fs.readFileSync(RUNTIME_TENANT_ID_FILE, "utf8");
  return assertTenantId(fileContent, RUNTIME_TENANT_ID_FILE);
}

function syncRuntimeTenantId() {
  if (isTenantAutoSyncDisabled()) {
    return "";
  }

  if (!fs.existsSync(TENANT_SYNC_SCRIPT)) {
    return "";
  }

  try {
    const output = execFileSync("bash", [TENANT_SYNC_SCRIPT], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      env: {
        ...process.env,
        NEXUSLOG_LOCAL_TENANT_ID_FILE:
          process.env.NEXUSLOG_LOCAL_TENANT_ID_FILE || RUNTIME_TENANT_ID_FILE,
        NEXUSLOG_FRONTEND_TENANT_OVERRIDE_PATH:
          process.env.NEXUSLOG_FRONTEND_TENANT_OVERRIDE_PATH || FRONTEND_OVERRIDE_CONFIG_PATH,
      },
    });

    const tenantId = assertTenantId(output, TENANT_SYNC_SCRIPT);
    if (tenantId) {
      process.env.E2E_TENANT_ID = tenantId;
    }
    return tenantId;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[e2e-runtime-tenant] tenant sync skipped: ${message}`);
    return "";
  }
}

function resolveE2ETenantId() {
  const explicitTenantId = assertTenantId(process.env.E2E_TENANT_ID, "E2E_TENANT_ID");
  if (explicitTenantId) {
    return explicitTenantId;
  }

  const syncedTenantId = syncRuntimeTenantId();
  if (syncedTenantId) {
    return syncedTenantId;
  }

  const ingestTenantId = assertTenantId(
    process.env.INGEST_DEFAULT_TENANT_ID,
    "INGEST_DEFAULT_TENANT_ID",
  );
  if (ingestTenantId) {
    return ingestTenantId;
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
  FRONTEND_OVERRIDE_CONFIG_PATH,
  ROOT_DIR,
  RUNTIME_TENANT_ID_FILE,
  TENANT_SYNC_SCRIPT,
  readRuntimeTenantId,
  resolveE2ETenantId,
  syncRuntimeTenantId,
};
