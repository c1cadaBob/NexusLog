package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"strings"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

type LoginPolicyIPWhitelistItem struct {
	IP   string `json:"ip"`
	Note string `json:"note"`
}

type LoginPolicySettings struct {
	TotpEnabled           bool                         `json:"totpEnabled"`
	SmsEnabled            bool                         `json:"smsEnabled"`
	MinLength             int                          `json:"minLength"`
	PasswordExpiry        int                          `json:"passwordExpiry"`
	RequireUppercase      bool                         `json:"requireUppercase"`
	RequireLowercase      bool                         `json:"requireLowercase"`
	RequireNumbers        bool                         `json:"requireNumbers"`
	RequireSpecialChars   bool                         `json:"requireSpecialChars"`
	HistoryCheck          string                       `json:"historyCheck"`
	IdleTimeout           int                          `json:"idleTimeout"`
	MaxConcurrentSessions int                          `json:"maxConcurrentSessions"`
	MaxLoginAttempts      int                          `json:"maxLoginAttempts"`
	LockoutDuration       int                          `json:"lockoutDuration"`
	IPWhitelistEnabled    bool                         `json:"ipWhitelistEnabled"`
	IPWhitelist           []LoginPolicyIPWhitelistItem `json:"ipWhitelist"`
}

type LoginPolicyResponseData struct {
	Settings  LoginPolicySettings `json:"settings"`
	UpdatedAt string              `json:"updated_at,omitempty"`
	UpdatedBy string              `json:"updated_by,omitempty"`
}

type LoginPolicyService struct {
	repo *repository.LoginPolicyRepository
}

func NewLoginPolicyService(repo *repository.LoginPolicyRepository) *LoginPolicyService {
	return &LoginPolicyService{repo: repo}
}

func DefaultLoginPolicySettings() LoginPolicySettings {
	return LoginPolicySettings{
		TotpEnabled:           true,
		SmsEnabled:            false,
		MinLength:             12,
		PasswordExpiry:        90,
		RequireUppercase:      true,
		RequireLowercase:      true,
		RequireNumbers:        true,
		RequireSpecialChars:   false,
		HistoryCheck:          "3",
		IdleTimeout:           30,
		MaxConcurrentSessions: 3,
		MaxLoginAttempts:      5,
		LockoutDuration:       30,
		IPWhitelistEnabled:    true,
		IPWhitelist: []LoginPolicyIPWhitelistItem{
			{IP: "10.0.0.0/8", Note: "内网办公段"},
			{IP: "192.168.1.10", Note: "管理员固定 IP"},
			{IP: "203.0.113.5", Note: "VPN 网关"},
		},
	}
}

func (s *LoginPolicyService) GetLoginPolicy(ctx context.Context, tenantID string) (LoginPolicyResponseData, *model.APIError) {
	if s == nil || s.repo == nil || !s.repo.IsConfigured() {
		return LoginPolicyResponseData{}, &model.APIError{HTTPStatus: http.StatusServiceUnavailable, Code: "LOGIN_POLICY_UNAVAILABLE", Message: "login policy service unavailable"}
	}
	trimmedTenantID := strings.TrimSpace(tenantID)
	if trimmedTenantID == "" {
		return LoginPolicyResponseData{}, &model.APIError{HTTPStatus: http.StatusUnauthorized, Code: "LOGIN_POLICY_TENANT_REQUIRED", Message: "tenant context required"}
	}
	record, err := s.repo.Get(ctx, trimmedTenantID)
	if err != nil {
		if err == repository.ErrLoginPolicyNotFound {
			return LoginPolicyResponseData{Settings: DefaultLoginPolicySettings()}, nil
		}
		return LoginPolicyResponseData{}, &model.APIError{HTTPStatus: http.StatusInternalServerError, Code: "LOGIN_POLICY_GET_FAILED", Message: "failed to load login policy"}
	}
	settings := normalizeLoginPolicySettings(record.Settings)
	return LoginPolicyResponseData{Settings: settings, UpdatedAt: record.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"), UpdatedBy: record.UpdatedBy}, nil
}

func (s *LoginPolicyService) UpdateLoginPolicy(ctx context.Context, tenantID, actorID string, settings LoginPolicySettings) (LoginPolicyResponseData, *model.APIError) {
	if s == nil || s.repo == nil || !s.repo.IsConfigured() {
		return LoginPolicyResponseData{}, &model.APIError{HTTPStatus: http.StatusServiceUnavailable, Code: "LOGIN_POLICY_UNAVAILABLE", Message: "login policy service unavailable"}
	}
	trimmedTenantID := strings.TrimSpace(tenantID)
	if trimmedTenantID == "" {
		return LoginPolicyResponseData{}, &model.APIError{HTTPStatus: http.StatusUnauthorized, Code: "LOGIN_POLICY_TENANT_REQUIRED", Message: "tenant context required"}
	}
	normalized := normalizeLoginPolicySettings(toLoginPolicyMap(settings))
	if err := validateLoginPolicySettings(normalized); err != nil {
		return LoginPolicyResponseData{}, &model.APIError{HTTPStatus: http.StatusBadRequest, Code: "LOGIN_POLICY_INVALID_ARGUMENT", Message: err.Error()}
	}
	record, err := s.repo.Upsert(ctx, trimmedTenantID, strings.TrimSpace(actorID), toLoginPolicyMap(normalized))
	if err != nil {
		return LoginPolicyResponseData{}, &model.APIError{HTTPStatus: http.StatusInternalServerError, Code: "LOGIN_POLICY_UPDATE_FAILED", Message: "failed to save login policy"}
	}
	return LoginPolicyResponseData{Settings: normalizeLoginPolicySettings(record.Settings), UpdatedAt: record.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"), UpdatedBy: record.UpdatedBy}, nil
}

func normalizeLoginPolicySettings(raw map[string]any) LoginPolicySettings {
	defaults := DefaultLoginPolicySettings()
	settings := defaults
	settings.TotpEnabled = readBool(raw, "totpEnabled", defaults.TotpEnabled)
	settings.SmsEnabled = readBool(raw, "smsEnabled", defaults.SmsEnabled)
	settings.MinLength = maxInt(readInt(raw, "minLength", defaults.MinLength), 8)
	settings.PasswordExpiry = clampInt(readInt(raw, "passwordExpiry", defaults.PasswordExpiry), 0, 365)
	settings.RequireUppercase = readBool(raw, "requireUppercase", defaults.RequireUppercase)
	settings.RequireLowercase = readBool(raw, "requireLowercase", defaults.RequireLowercase)
	settings.RequireNumbers = readBool(raw, "requireNumbers", defaults.RequireNumbers)
	settings.RequireSpecialChars = readBool(raw, "requireSpecialChars", defaults.RequireSpecialChars)
	settings.HistoryCheck = normalizeHistoryCheck(readString(raw, "historyCheck", defaults.HistoryCheck))
	settings.IdleTimeout = clampInt(readInt(raw, "idleTimeout", defaults.IdleTimeout), 1, 480)
	settings.MaxConcurrentSessions = clampInt(readInt(raw, "maxConcurrentSessions", defaults.MaxConcurrentSessions), 1, 10)
	settings.MaxLoginAttempts = clampInt(readInt(raw, "maxLoginAttempts", defaults.MaxLoginAttempts), 1, 20)
	settings.LockoutDuration = clampInt(readInt(raw, "lockoutDuration", defaults.LockoutDuration), 1, 1440)
	settings.IPWhitelistEnabled = readBool(raw, "ipWhitelistEnabled", defaults.IPWhitelistEnabled)
	settings.IPWhitelist = normalizeIPWhitelist(raw["ipWhitelist"], defaults.IPWhitelist)
	return settings
}

func validateLoginPolicySettings(settings LoginPolicySettings) error {
	complexityEnabledCount := 0
	for _, enabled := range []bool{settings.RequireUppercase, settings.RequireLowercase, settings.RequireNumbers, settings.RequireSpecialChars} {
		if enabled {
			complexityEnabledCount++
		}
	}
	if complexityEnabledCount < 3 {
		return fmt.Errorf("请至少启用 3 项密码复杂度要求")
	}
	if settings.IPWhitelistEnabled && len(settings.IPWhitelist) == 0 {
		return fmt.Errorf("启用 IP 白名单时，至少保留一条允许规则")
	}
	for _, item := range settings.IPWhitelist {
		ipValue := strings.TrimSpace(item.IP)
		if ipValue == "" {
			return fmt.Errorf("白名单 IP 不能为空")
		}
		if !isValidIPOrCIDR(ipValue) {
			return fmt.Errorf("白名单 IP 格式无效：%s", ipValue)
		}
	}
	return nil
}

func normalizeIPWhitelist(raw any, fallback []LoginPolicyIPWhitelistItem) []LoginPolicyIPWhitelistItem {
	items, ok := raw.([]any)
	if !ok {
		if len(fallback) == 0 {
			return []LoginPolicyIPWhitelistItem{}
		}
		cloned := make([]LoginPolicyIPWhitelistItem, 0, len(fallback))
		cloned = append(cloned, fallback...)
		return cloned
	}
	result := make([]LoginPolicyIPWhitelistItem, 0, len(items))
	for _, item := range items {
		candidate, ok := item.(map[string]any)
		if !ok {
			continue
		}
		ipValue := strings.TrimSpace(readString(candidate, "ip", ""))
		if ipValue == "" {
			continue
		}
		result = append(result, LoginPolicyIPWhitelistItem{IP: ipValue, Note: strings.TrimSpace(readString(candidate, "note", ""))})
	}
	return result
}

func toLoginPolicyMap(settings LoginPolicySettings) map[string]any {
	whitelist := make([]map[string]any, 0, len(settings.IPWhitelist))
	for _, item := range settings.IPWhitelist {
		whitelist = append(whitelist, map[string]any{"ip": strings.TrimSpace(item.IP), "note": strings.TrimSpace(item.Note)})
	}
	return map[string]any{
		"totpEnabled": settings.TotpEnabled,
		"smsEnabled": settings.SmsEnabled,
		"minLength": settings.MinLength,
		"passwordExpiry": settings.PasswordExpiry,
		"requireUppercase": settings.RequireUppercase,
		"requireLowercase": settings.RequireLowercase,
		"requireNumbers": settings.RequireNumbers,
		"requireSpecialChars": settings.RequireSpecialChars,
		"historyCheck": settings.HistoryCheck,
		"idleTimeout": settings.IdleTimeout,
		"maxConcurrentSessions": settings.MaxConcurrentSessions,
		"maxLoginAttempts": settings.MaxLoginAttempts,
		"lockoutDuration": settings.LockoutDuration,
		"ipWhitelistEnabled": settings.IPWhitelistEnabled,
		"ipWhitelist": whitelist,
	}
}

func normalizeHistoryCheck(value string) string {
	switch strings.TrimSpace(value) {
	case "0", "3", "5":
		return strings.TrimSpace(value)
	default:
		return "3"
	}
}

func readString(raw map[string]any, key string, fallback string) string {
	if value, ok := raw[key].(string); ok {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return fallback
}

func readBool(raw map[string]any, key string, fallback bool) bool {
	if value, ok := raw[key].(bool); ok {
		return value
	}
	return fallback
}

func readInt(raw map[string]any, key string, fallback int) int {
	switch value := raw[key].(type) {
	case int:
		return value
	case int32:
		return int(value)
	case int64:
		return int(value)
	case float64:
		return int(value)
	default:
		return fallback
	}
}

func clampInt(value, minValue, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func maxInt(value, minValue int) int {
	if value < minValue {
		return minValue
	}
	return value
}

func isValidIPOrCIDR(value string) bool {
	if ip := net.ParseIP(strings.TrimSpace(value)); ip != nil {
		return true
	}
	_, _, err := net.ParseCIDR(strings.TrimSpace(value))
	return err == nil
}
