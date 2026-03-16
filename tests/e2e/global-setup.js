const { resolveE2ETenantId } = require("./tests/support/runtimeTenant");

async function globalSetup() {
  const tenantId = resolveE2ETenantId();
  process.env.E2E_TENANT_ID = tenantId;
  console.info(`[e2e-global-setup] using tenant: ${tenantId}`);
}

module.exports = globalSetup;
