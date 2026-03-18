package alert

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

func TestEvaluator_checkKeyword(t *testing.T) {
	ctx := context.Background()
	mockES := &mockESSearchClient{count: 1}
	repo := &evalMockRuleRepo{}
	var db *sql.DB // not used for checkKeyword
	e := NewEvaluator(repo, mockES, db, "logs").WithSuppressor(nil)

	rule := &AlertRule{
		ID:        "r1",
		TenantID:  "t1",
		Name:      "test",
		Condition: json.RawMessage(`{"type":"keyword","keyword":"error","field":"message","window_seconds":300}`),
	}
	matched, _, err := e.checkCondition(ctx, rule)
	if err != nil {
		t.Fatalf("checkCondition: %v", err)
	}
	if !matched {
		t.Error("expected matched")
	}
}

func TestEvaluator_checkKeyword_noMatch(t *testing.T) {
	ctx := context.Background()
	mockES := &mockESSearchClient{count: 0}
	repo := &evalMockRuleRepo{}
	e := NewEvaluator(repo, mockES, nil, "logs").WithSuppressor(nil)

	rule := &AlertRule{
		ID:        "r1",
		TenantID:  "t1",
		Condition: json.RawMessage(`{"type":"keyword","keyword":"error"}`),
	}
	matched, _, err := e.checkCondition(ctx, rule)
	if err != nil {
		t.Fatalf("checkCondition: %v", err)
	}
	if matched {
		t.Error("expected not matched")
	}
}

func TestEvaluator_checkLevelCount(t *testing.T) {
	ctx := context.Background()
	mockES := &mockESSearchClient{count: 10}
	repo := &evalMockRuleRepo{}
	e := NewEvaluator(repo, mockES, nil, "logs").WithSuppressor(nil)

	rule := &AlertRule{
		ID:        "r1",
		TenantID:  "t1",
		Condition: json.RawMessage(`{"type":"level_count","level":"error","threshold":5,"window_seconds":300}`),
	}
	matched, _, err := e.checkCondition(ctx, rule)
	if err != nil {
		t.Fatalf("checkCondition: %v", err)
	}
	if !matched {
		t.Error("expected matched (10 >= 5)")
	}
}

func TestEvaluator_checkLevelCount_noMatch(t *testing.T) {
	ctx := context.Background()
	mockES := &mockESSearchClient{count: 2}
	repo := &evalMockRuleRepo{}
	e := NewEvaluator(repo, mockES, nil, "logs").WithSuppressor(nil)

	rule := &AlertRule{
		ID:        "r1",
		TenantID:  "t1",
		Condition: json.RawMessage(`{"type":"level_count","level":"error","threshold":5}`),
	}
	matched, _, err := e.checkCondition(ctx, rule)
	if err != nil {
		t.Fatalf("checkCondition: %v", err)
	}
	if matched {
		t.Error("expected not matched (2 < 5)")
	}
}

func TestEvaluator_checkThreshold(t *testing.T) {
	ctx := context.Background()
	mockES := &mockESSearchClient{count: 100}
	repo := &evalMockRuleRepo{}
	e := NewEvaluator(repo, mockES, nil, "logs").WithSuppressor(nil)

	rule := &AlertRule{
		ID:        "r1",
		TenantID:  "t1",
		Condition: json.RawMessage(`{"type":"threshold","metric":"count","operator":">","value":50}`),
	}
	matched, _, err := e.checkCondition(ctx, rule)
	if err != nil {
		t.Fatalf("checkCondition: %v", err)
	}
	if !matched {
		t.Error("expected matched (100 > 50)")
	}
}

func TestEvaluator_checkThreshold_noMatch(t *testing.T) {
	ctx := context.Background()
	mockES := &mockESSearchClient{count: 10}
	repo := &evalMockRuleRepo{}
	e := NewEvaluator(repo, mockES, nil, "logs").WithSuppressor(nil)

	rule := &AlertRule{
		ID:        "r1",
		TenantID:  "t1",
		Condition: json.RawMessage(`{"type":"threshold","metric":"count","operator":">","value":50}`),
	}
	matched, _, err := e.checkCondition(ctx, rule)
	if err != nil {
		t.Fatalf("checkCondition: %v", err)
	}
	if matched {
		t.Error("expected not matched (10 <= 50)")
	}
}

func TestEvaluator_unknownType(t *testing.T) {
	ctx := context.Background()
	mockES := &mockESSearchClient{}
	repo := &evalMockRuleRepo{}
	e := NewEvaluator(repo, mockES, nil, "logs")

	rule := &AlertRule{
		ID:        "r1",
		Condition: json.RawMessage(`{"type":"unknown"}`),
	}
	matched, _, err := e.checkCondition(ctx, rule)
	if err != nil {
		t.Fatalf("checkCondition: %v", err)
	}
	if matched {
		t.Error("expected not matched for unknown type")
	}
}

func TestEvaluator_Stop(t *testing.T) {
	e := NewEvaluator(nil, nil, nil, "logs")
	done := make(chan struct{})
	go func() {
		e.Start()
		close(done)
	}()
	time.Sleep(50 * time.Millisecond)
	e.Stop()
	select {
	case <-done:
		// ok
	case <-time.After(2 * time.Second):
		t.Error("Start did not exit after Stop")
	}
}

type mockESSearchClient struct {
	count int64
}

func (m *mockESSearchClient) Search(ctx context.Context, index string, body []byte) (int64, error) {
	return m.count, nil
}

type evalMockRuleRepo struct{}

func (m *evalMockRuleRepo) ListRules(ctx context.Context, tenantID string, page, pageSize int) ([]AlertRule, int, error) {
	return nil, 0, nil
}

func (m *evalMockRuleRepo) ListRulesForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, page, pageSize int) ([]AlertRule, int, error) {
	return nil, 0, nil
}

func (m *evalMockRuleRepo) ListEnabledRules(ctx context.Context) ([]AlertRule, error) {
	return nil, nil
}

func (m *evalMockRuleRepo) GetRule(ctx context.Context, tenantID, ruleID string) (*AlertRule, error) {
	return nil, nil
}

func (m *evalMockRuleRepo) GetRuleForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, ruleID string) (*AlertRule, error) {
	return nil, nil
}

func (m *evalMockRuleRepo) CreateRule(ctx context.Context, rule *AlertRule) (string, error) {
	return "", nil
}

func (m *evalMockRuleRepo) UpdateRule(ctx context.Context, tenantID, ruleID string, update *AlertRuleUpdate) error {
	return nil
}

func (m *evalMockRuleRepo) DeleteRule(ctx context.Context, tenantID, ruleID string) error {
	return nil
}

func (m *evalMockRuleRepo) CountRules(ctx context.Context, tenantID string) (int, error) {
	return 0, nil
}
