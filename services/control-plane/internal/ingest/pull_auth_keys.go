package ingest

import (
	"context"
	"fmt"
	"strings"
	"sync"
)

// AgentAuthKey 定义 agent 拉取鉴权 key_ref 映射。
type AgentAuthKey struct {
	KeyRef            string `json:"key_ref"`
	ActiveKeyID       string `json:"active_key_id"`
	ActiveKeyMaterial string `json:"active_key_material"`
	NextKeyID         string `json:"next_key_id,omitempty"`
	NextKeyMaterial   string `json:"next_key_material,omitempty"`
	Status            string `json:"status"`
}

// AgentAuthCredential 为执行器提供可直接用于请求头的鉴权信息。
type AgentAuthCredential struct {
	KeyID string
	Key   string
}

// AgentAuthKeyStore 负责 key_ref -> key material 解析。
type AgentAuthKeyStore struct {
	mu      sync.RWMutex
	items   map[string]AgentAuthKey
	backend *PGBackend
}

// NewAgentAuthKeyStore 创建内存仓储。
func NewAgentAuthKeyStore() *AgentAuthKeyStore {
	return &AgentAuthKeyStore{
		items: make(map[string]AgentAuthKey),
	}
}

// NewAgentAuthKeyStoreWithPG 创建 PostgreSQL 仓储。
func NewAgentAuthKeyStoreWithPG(backend *PGBackend) *AgentAuthKeyStore {
	return &AgentAuthKeyStore{
		items:   make(map[string]AgentAuthKey),
		backend: backend,
	}
}

// ResolveCredential 返回 key_ref 当前可用的 active key。
func (s *AgentAuthKeyStore) ResolveCredential(keyRef string) (AgentAuthCredential, bool) {
	if s.backend != nil {
		return s.resolveFromDB(context.Background(), keyRef)
	}

	keyRef = strings.TrimSpace(keyRef)
	if keyRef == "" {
		return AgentAuthCredential{}, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	item, ok := s.items[keyRef]
	if !ok {
		return AgentAuthCredential{}, false
	}
	if strings.TrimSpace(item.ActiveKeyID) == "" || strings.TrimSpace(item.ActiveKeyMaterial) == "" {
		return AgentAuthCredential{}, false
	}
	return AgentAuthCredential{
		KeyID: strings.TrimSpace(item.ActiveKeyID),
		Key:   strings.TrimSpace(item.ActiveKeyMaterial),
	}, true
}

// Upsert 仅用于测试或本地开发注入密钥映射。
func (s *AgentAuthKeyStore) Upsert(key AgentAuthKey) error {
	if s.backend != nil {
		return s.upsertFromDB(context.Background(), key)
	}

	normalized, err := normalizeAuthKey(key)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[normalized.KeyRef] = normalized
	return nil
}

func normalizeAuthKey(key AgentAuthKey) (AgentAuthKey, error) {
	key.KeyRef = strings.TrimSpace(key.KeyRef)
	key.ActiveKeyID = strings.TrimSpace(key.ActiveKeyID)
	key.ActiveKeyMaterial = strings.TrimSpace(key.ActiveKeyMaterial)
	key.NextKeyID = strings.TrimSpace(key.NextKeyID)
	key.NextKeyMaterial = strings.TrimSpace(key.NextKeyMaterial)
	key.Status = strings.ToLower(strings.TrimSpace(key.Status))
	if key.Status == "" {
		key.Status = "active"
	}
	if key.KeyRef == "" {
		return AgentAuthKey{}, fmt.Errorf("key_ref is required")
	}
	if key.ActiveKeyID == "" {
		return AgentAuthKey{}, fmt.Errorf("active_key_id is required")
	}
	if key.ActiveKeyMaterial == "" {
		return AgentAuthKey{}, fmt.Errorf("active_key_material is required")
	}
	return key, nil
}
