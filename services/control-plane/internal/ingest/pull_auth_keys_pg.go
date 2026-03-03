package ingest

import (
	"context"
	"fmt"
	"strings"
	"time"
)

func (s *AgentAuthKeyStore) resolveFromDB(ctx context.Context, keyRef string) (AgentAuthCredential, bool) {
	keyRef = strings.TrimSpace(keyRef)
	if keyRef == "" {
		return AgentAuthCredential{}, false
	}
	query := `
SELECT
    active_key_id,
    active_key_ciphertext
FROM agent_pull_auth_keys
WHERE key_ref = $1
  AND status IN ('active', 'rotating')
ORDER BY updated_at DESC
LIMIT 1
`
	var (
		keyID string
		key   string
	)
	if err := s.backend.DB().QueryRowContext(ctx, query, keyRef).Scan(&keyID, &key); err != nil {
		return AgentAuthCredential{}, false
	}
	keyID = strings.TrimSpace(keyID)
	key = strings.TrimSpace(key)
	if keyID == "" || key == "" {
		return AgentAuthCredential{}, false
	}
	// 当前阶段先以明文兼容方式存储密钥材料，后续可替换为 KMS 解密流程。
	return AgentAuthCredential{KeyID: keyID, Key: key}, true
}

func (s *AgentAuthKeyStore) upsertFromDB(ctx context.Context, key AgentAuthKey) error {
	if s.backend == nil || s.backend.DB() == nil {
		return fmt.Errorf("postgres backend is not configured")
	}
	normalized, err := normalizeAuthKey(key)
	if err != nil {
		return err
	}
	query := `
INSERT INTO agent_pull_auth_keys (
    tenant_id,
    key_ref,
    active_key_id,
    active_key_ciphertext,
    next_key_id,
    next_key_ciphertext,
    status,
    rotated_at,
    updated_at
) VALUES (
    $1::uuid,
    $2,
    $3,
    $4,
    NULLIF($5, ''),
    NULLIF($6, ''),
    $7,
    $8,
    $8
)
ON CONFLICT (key_ref) DO UPDATE SET
    active_key_id = EXCLUDED.active_key_id,
    active_key_ciphertext = EXCLUDED.active_key_ciphertext,
    next_key_id = EXCLUDED.next_key_id,
    next_key_ciphertext = EXCLUDED.next_key_ciphertext,
    status = EXCLUDED.status,
    rotated_at = EXCLUDED.rotated_at,
    updated_at = EXCLUDED.updated_at
`
	now := time.Now().UTC()
	_, err = s.backend.DB().ExecContext(
		ctx,
		query,
		s.backend.ResolveTenantID(ctx),
		normalized.KeyRef,
		normalized.ActiveKeyID,
		normalized.ActiveKeyMaterial,
		normalized.NextKeyID,
		normalized.NextKeyMaterial,
		normalized.Status,
		now,
	)
	return wrapDBError("upsert auth key", err)
}
