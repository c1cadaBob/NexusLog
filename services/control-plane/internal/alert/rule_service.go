package alert

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	cpMiddleware "github.com/nexuslog/control-plane/internal/middleware"
)

const (
	// MaxRulesPerTenant is the maximum number of alert rules allowed per tenant.
	MaxRulesPerTenant = 1000

	// RuleTypeKeyword is a keyword-based rule.
	RuleTypeKeyword = "keyword"
	// RuleTypeLevelCount is a level count rule.
	RuleTypeLevelCount = "level_count"
	// RuleTypeThreshold is a threshold-based rule.
	RuleTypeThreshold = "threshold"
)

var (
	// ErrRuleLimitExceeded indicates the tenant has reached the rule limit.
	ErrRuleLimitExceeded = errors.New("rule limit exceeded: max 1000 rules per tenant")
	// ErrInvalidCondition indicates the condition JSON is invalid.
	ErrInvalidCondition = errors.New("invalid condition: type must be one of keyword, level_count, threshold")
)

// RuleService provides business logic for alert rules.
type RuleService struct {
	repo RuleRepository
}

// NewRuleService creates a new rule service.
func NewRuleService(repo RuleRepository) *RuleService {
	return &RuleService{repo: repo}
}

// ListRules returns paginated rules for a tenant.
func (s *RuleService) ListRules(ctx context.Context, tenantID string, page, pageSize int) ([]AlertRule, int, error) {
	scope := cpMiddleware.TenantReadScope{TenantID: tenantID}
	if strings.TrimSpace(tenantID) == "" {
		scope.Global = true
	}
	return s.repo.ListRulesForScope(ctx, scope, page, pageSize)
}

// ListRulesForScope returns paginated rules for an explicit read scope.
func (s *RuleService) ListRulesForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, page, pageSize int) ([]AlertRule, int, error) {
	return s.repo.ListRulesForScope(ctx, scope, page, pageSize)
}

// GetRule returns a single rule by ID.
func (s *RuleService) GetRule(ctx context.Context, tenantID, ruleID string) (*AlertRule, error) {
	scope := cpMiddleware.TenantReadScope{TenantID: tenantID}
	if strings.TrimSpace(tenantID) == "" {
		scope.Global = true
	}
	return s.repo.GetRuleForScope(ctx, scope, ruleID)
}

// GetRuleForScope returns a single rule by ID for an explicit read scope.
func (s *RuleService) GetRuleForScope(ctx context.Context, scope cpMiddleware.TenantReadScope, ruleID string) (*AlertRule, error) {
	return s.repo.GetRuleForScope(ctx, scope, ruleID)
}

// CreateRule creates a new alert rule after validation.
func (s *RuleService) CreateRule(ctx context.Context, tenantID string, rule *AlertRule) (string, error) {
	if rule == nil {
		return "", fmt.Errorf("rule is required")
	}
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return "", fmt.Errorf("tenant_id is required")
	}

	if err := ValidateCondition(rule.Condition); err != nil {
		return "", err
	}

	count, err := s.repo.CountRules(ctx, tenantID)
	if err != nil {
		return "", err
	}
	if count >= MaxRulesPerTenant {
		return "", ErrRuleLimitExceeded
	}

	rule.TenantID = tenantID
	if rule.Severity == "" {
		rule.Severity = "WARNING"
	}
	return s.repo.CreateRule(ctx, rule)
}

// UpdateRule updates an existing rule.
func (s *RuleService) UpdateRule(ctx context.Context, tenantID, ruleID string, update *AlertRuleUpdate) error {
	if update == nil {
		return fmt.Errorf("update is required")
	}
	tenantID = strings.TrimSpace(tenantID)
	ruleID = strings.TrimSpace(ruleID)
	if tenantID == "" || ruleID == "" {
		return ErrRuleNotFound
	}

	if len(update.Condition) > 0 {
		if err := ValidateCondition(update.Condition); err != nil {
			return err
		}
	}

	return s.repo.UpdateRule(ctx, tenantID, ruleID, update)
}

// DeleteRule removes a rule.
func (s *RuleService) DeleteRule(ctx context.Context, tenantID, ruleID string) error {
	return s.repo.DeleteRule(ctx, tenantID, ruleID)
}

// EnableRule updates a rule to enabled.
func (s *RuleService) EnableRule(ctx context.Context, tenantID, ruleID string) error {
	enabled := true
	return s.repo.UpdateRule(ctx, tenantID, ruleID, &AlertRuleUpdate{Enabled: &enabled})
}

// DisableRule updates a rule to disabled.
func (s *RuleService) DisableRule(ctx context.Context, tenantID, ruleID string) error {
	enabled := false
	return s.repo.UpdateRule(ctx, tenantID, ruleID, &AlertRuleUpdate{Enabled: &enabled})
}

// ValidateCondition validates the condition JSONB structure.
func ValidateCondition(condition json.RawMessage) error {
	if len(condition) == 0 {
		return ErrInvalidCondition
	}
	var m map[string]interface{}
	if err := json.Unmarshal(condition, &m); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidCondition, err)
	}
	typ, ok := m["type"].(string)
	if !ok || typ == "" {
		return ErrInvalidCondition
	}
	typ = strings.ToLower(strings.TrimSpace(typ))
	switch typ {
	case RuleTypeKeyword:
		return validateKeywordCondition(m)
	case RuleTypeLevelCount:
		return validateLevelCountCondition(m)
	case RuleTypeThreshold:
		return validateThresholdCondition(m)
	default:
		return ErrInvalidCondition
	}
}

func validateKeywordCondition(m map[string]interface{}) error {
	keyword, ok := m["keyword"].(string)
	if !ok || strings.TrimSpace(keyword) == "" {
		return fmt.Errorf("%w: keyword type requires non-empty keyword", ErrInvalidCondition)
	}
	field, _ := m["field"].(string)
	if field == "" {
		m["field"] = "message"
	}
	return nil
}

func validateLevelCountCondition(m map[string]interface{}) error {
	level, ok := m["level"].(string)
	if !ok || strings.TrimSpace(level) == "" {
		return fmt.Errorf("%w: level_count type requires level", ErrInvalidCondition)
	}
	threshold, ok := m["threshold"]
	if !ok {
		return fmt.Errorf("%w: level_count type requires threshold", ErrInvalidCondition)
	}
	// Accept both float64 (from JSON) and int
	var th int
	switch v := threshold.(type) {
	case float64:
		th = int(v)
	case int:
		th = v
	default:
		return fmt.Errorf("%w: level_count threshold must be a number", ErrInvalidCondition)
	}
	if th <= 0 {
		return fmt.Errorf("%w: level_count threshold must be positive", ErrInvalidCondition)
	}
	window, ok := m["window_seconds"]
	if ok {
		var w int
		switch v := window.(type) {
		case float64:
			w = int(v)
		case int:
			w = v
		default:
			return fmt.Errorf("%w: level_count window_seconds must be a number", ErrInvalidCondition)
		}
		if w <= 0 {
			return fmt.Errorf("%w: level_count window_seconds must be positive", ErrInvalidCondition)
		}
	}
	_ = level
	return nil
}

func validateThresholdCondition(m map[string]interface{}) error {
	metric, ok := m["metric"].(string)
	if !ok || strings.TrimSpace(metric) == "" {
		return fmt.Errorf("%w: threshold type requires metric", ErrInvalidCondition)
	}
	op, ok := m["operator"].(string)
	if !ok || strings.TrimSpace(op) == "" {
		return fmt.Errorf("%w: threshold type requires operator", ErrInvalidCondition)
	}
	allowedOps := map[string]struct{}{">": {}, "<": {}, ">=": {}, "<=": {}, "==": {}, "!=": {}}
	if _, ok := allowedOps[strings.TrimSpace(op)]; !ok {
		return fmt.Errorf("%w: threshold operator must be one of >, <, >=, <=, ==, !=", ErrInvalidCondition)
	}
	value, ok := m["value"]
	if !ok {
		return fmt.Errorf("%w: threshold type requires value", ErrInvalidCondition)
	}
	// Value must be numeric
	switch value.(type) {
	case float64, int:
		// ok
	default:
		return fmt.Errorf("%w: threshold value must be a number", ErrInvalidCondition)
	}
	_ = metric
	return nil
}
