const crypto = require("crypto");
const { runSql, sqlLiteral } = require("./runtimeDb");

const DEFAULT_JWT_SECRET =
  process.env.JWT_SECRET || "nexuslog-local-dev-jwt-secret-20260314-change-before-production";
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

const cachedSessions = new Map();

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const encodedHeader = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function hashToken(raw) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function resolveRuntimeUserRecord(tenantId, username) {
  const query = `
SELECT id::text, COALESCE(email, '')
FROM users
WHERE tenant_id = ${sqlLiteral(tenantId)}::uuid
  AND username = ${sqlLiteral(username)}
  AND status = 'active'
ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
LIMIT 1;
`;

  const raw = runSql(query);
  const [userId = "", email = ""] = raw.split("|");
  if (!userId) {
    throw new Error(`runtime auth session user not found: tenant=${tenantId} username=${username}`);
  }

  return {
    userId: userId.trim(),
    email: (email || `${username}@nexuslog.local`).trim(),
  };
}

function persistRuntimeSession(tenantId, userId, refreshTokenHash, accessTokenJti, expiresAtIso, sessionId) {
  const sql = `
INSERT INTO user_sessions (
  id,
  tenant_id,
  user_id,
  refresh_token_hash,
  access_token_jti,
  session_family_id,
  session_status,
  client_ip,
  user_agent,
  expires_at,
  last_seen_at,
  created_at,
  updated_at
)
VALUES (
  ${sqlLiteral(sessionId)}::uuid,
  ${sqlLiteral(tenantId)}::uuid,
  ${sqlLiteral(userId)}::uuid,
  ${sqlLiteral(refreshTokenHash)},
  ${sqlLiteral(accessTokenJti)},
  ${sqlLiteral(sessionId)}::uuid,
  'active',
  NULL,
  'e2e-runtime-session',
  ${sqlLiteral(expiresAtIso)}::timestamptz,
  NOW(),
  NOW(),
  NOW()
);
`;

  runSql(sql);
}

function resolveRuntimeAuthSession({ tenantId, username }) {
  const cacheKey = `${tenantId}:${username}`;
  const cached = cachedSessions.get(cacheKey);
  if (cached && cached.expiresAtMs > Date.now() + 60_000) {
    return cached;
  }

  const userRecord = resolveRuntimeUserRecord(tenantId, username);
  const sessionId = crypto.randomUUID();
  const accessTokenJti = crypto.randomUUID();
  const refreshToken = `e2e-refresh-${crypto.randomUUID()}`;
  const refreshTokenHash = hashToken(refreshToken);
  const issuedAtSeconds = Math.floor(Date.now() / 1000);
  const expiresAtMs = Date.now() + SESSION_TTL_MS;
  const expiresAtSeconds = Math.floor(expiresAtMs / 1000);
  const expiresAtIso = new Date(expiresAtMs).toISOString();
  const accessToken = signJwt(
    {
      user_id: userRecord.userId,
      tenant_id: tenantId,
      iat: issuedAtSeconds,
      exp: expiresAtSeconds,
      jti: accessTokenJti,
    },
    DEFAULT_JWT_SECRET,
  );

  persistRuntimeSession(
    tenantId,
    userRecord.userId,
    refreshTokenHash,
    accessTokenJti,
    expiresAtIso,
    sessionId,
  );

  const session = {
    tenantId,
    userId: userRecord.userId,
    username,
    email: userRecord.email,
    role: "admin",
    accessToken,
    refreshToken,
    expiresAtMs,
  };
  cachedSessions.set(cacheKey, session);
  return session;
}

module.exports = {
  resolveRuntimeAuthSession,
};
