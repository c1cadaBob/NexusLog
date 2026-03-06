package alert

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
)

// mockRuleRepo is an in-memory RuleRepository for testing.
type mockRuleRepo struct {
	rules map[string]AlertRule
}

func newMockRuleRepo() *mockRuleRepo {
	return &mockRuleRepo{
		rules: make(map[string]AlertRule),
	}
}

func (m *mockRuleRepo) ListRules(ctx context.Context, tenantID string, page, pageSize int) ([]AlertRule, int, error) {
	var items []AlertRule
	for _, r := range m.rules {
		if r.TenantID == tenantID {
			items = append(items, r)
		}
	}
	total := len(items)
	start := (page - 1) * pageSize
	if start >= total {
		return []AlertRule{}, total, nil
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return items[start:end], total, nil
}

func (m *mockRuleRepo) GetRule(ctx context.Context, tenantID, ruleID string) (*AlertRule, error) {
	r, ok := m.rules[ruleID]
	if !ok || r.TenantID != tenantID {
		return nil, ErrRuleNotFound
	}
	return &r, nil
}

func (m *mockRuleRepo) CreateRule(ctx context.Context, rule *AlertRule) (string, error) {
	id := "rule-1"
	if len(m.rules) > 0 {
		id = "rule-2"
	}
	rule.ID = id
	m.rules[id] = *rule
	return id, nil
}

func (m *mockRuleRepo) UpdateRule(ctx context.Context, tenantID, ruleID string, update *AlertRuleUpdate) error {
	r, ok := m.rules[ruleID]
	if !ok || r.TenantID != tenantID {
		return ErrRuleNotFound
	}
	if update.Name != nil {
		r.Name = *update.Name
	}
	if update.Enabled != nil {
		r.Enabled = *update.Enabled
	}
	m.rules[ruleID] = r
	return nil
}

func (m *mockRuleRepo) DeleteRule(ctx context.Context, tenantID, ruleID string) error {
	r, ok := m.rules[ruleID]
	if !ok || r.TenantID != tenantID {
		return ErrRuleNotFound
	}
	delete(m.rules, ruleID)
	_ = r
	return nil
}

func (m *mockRuleRepo) CountRules(ctx context.Context, tenantID string) (int, error) {
	count := 0
	for _, r := range m.rules {
		if r.TenantID == tenantID {
			count++
		}
	}
	return count, nil
}

func TestValidateCondition_Keyword(t *testing.T) {
	tests := []struct {
		name      string
		condition string
		wantErr   bool
	}{
		{"valid", `{"type":"keyword","keyword":"error","field":"message"}`, false},
		{"valid no field", `{"type":"keyword","keyword":"error"}`, false},
		{"missing keyword", `{"type":"keyword","field":"message"}`, true},
		{"empty keyword", `{"type":"keyword","keyword":"","field":"message"}`, true},
		{"wrong type", `{"type":"unknown"}`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCondition(json.RawMessage(tt.condition))
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCondition() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateCondition_LevelCount(t *testing.T) {
	tests := []struct {
		name      string
		condition string
		wantErr   bool
	}{
		{"valid", `{"type":"level_count","level":"ERROR","threshold":10,"window_seconds":300}`, false},
		{"valid no window", `{"type":"level_count","level":"ERROR","threshold":5}`, false},
		{"missing level", `{"type":"level_count","threshold":10}`, true},
		{"missing threshold", `{"type":"level_count","level":"ERROR"}`, true},
		{"zero threshold", `{"type":"level_count","level":"ERROR","threshold":0}`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCondition(json.RawMessage(tt.condition))
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCondition() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateCondition_Threshold(t *testing.T) {
	tests := []struct {
		name      string
		condition string
		wantErr   bool
	}{
		{"valid", `{"type":"threshold","metric":"cpu_usage","operator":">","value":90}`, false},
		{"valid le", `{"type":"threshold","metric":"mem","operator":"<=","value":80}`, false},
		{"missing metric", `{"type":"threshold","operator":">","value":90}`, true},
		{"missing operator", `{"type":"threshold","metric":"cpu","value":90}`, true},
		{"invalid operator", `{"type":"threshold","metric":"cpu","operator":"~","value":90}`, true},
		{"missing value", `{"type":"threshold","metric":"cpu","operator":">"}`, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateCondition(json.RawMessage(tt.condition))
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateCondition() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestRuleService_CreateRule_LimitExceeded(t *testing.T) {
	repo := newMockRuleRepo()
	// Pre-populate to hit limit
	for i := 0; i < MaxRulesPerTenant; i++ {
		repo.rules[fmt.Sprintf("rule-%d", i)] = AlertRule{
			ID:       fmt.Sprintf("rule-%d", i),
			TenantID: "tenant-1",
			Name:     "rule",
		}
	}
	svc := NewRuleService(repo)

	rule := &AlertRule{
		Name:      "new",
		Condition: json.RawMessage(`{"type":"keyword","keyword":"error"}`),
	}
	_, err := svc.CreateRule(context.Background(), "tenant-1", rule)
	if err != ErrRuleLimitExceeded {
		t.Errorf("expected ErrRuleLimitExceeded, got %v", err)
	}
}

func TestRuleService_EnableDisable(t *testing.T) {
	repo := newMockRuleRepo()
	rule := AlertRule{
		ID:       "rule-1",
		TenantID: "tenant-1",
		Name:     "test",
		Enabled:  true,
	}
	repo.rules["rule-1"] = rule

	svc := NewRuleService(repo)

	if err := svc.DisableRule(context.Background(), "tenant-1", "rule-1"); err != nil {
		t.Fatalf("DisableRule: %v", err)
	}
	r, _ := repo.GetRule(context.Background(), "tenant-1", "rule-1")
	if r.Enabled {
		t.Error("expected rule to be disabled")
	}

	if err := svc.EnableRule(context.Background(), "tenant-1", "rule-1"); err != nil {
		t.Fatalf("EnableRule: %v", err)
	}
	r, _ = repo.GetRule(context.Background(), "tenant-1", "rule-1")
	if !r.Enabled {
		t.Error("expected rule to be enabled")
	}
}

func TestRuleService_DeleteRule(t *testing.T) {
	repo := newMockRuleRepo()
	rule := AlertRule{
		ID:       "rule-1",
		TenantID: "tenant-1",
		Name:     "test",
	}
	repo.rules["rule-1"] = rule

	svc := NewRuleService(repo)
	if err := svc.DeleteRule(context.Background(), "tenant-1", "rule-1"); err != nil {
		t.Fatalf("DeleteRule: %v", err)
	}
	r, err := repo.GetRule(context.Background(), "tenant-1", "rule-1")
	if err != ErrRuleNotFound || r != nil {
		t.Errorf("expected ErrRuleNotFound after delete, got: %v, %v", err, r)
	}
}
