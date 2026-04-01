const { runSql, sqlLiteral } = require("./runtimeDb");

const TEST_USER_PREDICATE = `(
  username LIKE 'e2e_login_%'
  OR username LIKE 'e2e_reg_%'
  OR username LIKE 'e2e_reset_%'
)`;

function purgeRuntimeTestUserById({ tenantId, userId, username = "" }) {
  if (!tenantId || !userId) {
    return false;
  }

  if (username && !/^e2e_(login|reg|reset)_/.test(username)) {
    throw new Error(`refusing to purge non-e2e user: ${username}`);
  }

  runSql(`
BEGIN;
UPDATE audit_logs
SET user_id = NULL
WHERE user_id IN (
  SELECT id
  FROM users
  WHERE tenant_id = ${sqlLiteral(tenantId)}::uuid
    AND id = ${sqlLiteral(userId)}::uuid
    AND ${TEST_USER_PREDICATE}
);

DELETE FROM users
WHERE tenant_id = ${sqlLiteral(tenantId)}::uuid
  AND id = ${sqlLiteral(userId)}::uuid
  AND ${TEST_USER_PREDICATE};
COMMIT;
`);

  return true;
}

module.exports = {
  purgeRuntimeTestUserById,
};
