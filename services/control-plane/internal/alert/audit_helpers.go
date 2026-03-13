package alert

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/control-plane/internal/middleware"
)

func setAlertRuleAuditEvent(c *gin.Context, action, resourceID string, details map[string]any) {
	middleware.SetAuditEvent(c, middleware.AuditEvent{
		Action:       action,
		ResourceType: "alert_rules",
		ResourceID:   strings.TrimSpace(resourceID),
		Details:      details,
	})
}

func setAlertSilenceAuditEvent(c *gin.Context, action, resourceID string, details map[string]any) {
	middleware.SetAuditEvent(c, middleware.AuditEvent{
		Action:       action,
		ResourceType: "alert_silences",
		ResourceID:   strings.TrimSpace(resourceID),
		Details:      details,
	})
}

func ruleUpdatedFields(req UpdateRuleRequest) []string {
	fields := make([]string, 0, 6)
	if req.Name != nil {
		fields = append(fields, "name")
	}
	if req.Description != nil {
		fields = append(fields, "description")
	}
	if len(req.Condition) > 0 {
		fields = append(fields, "condition")
	}
	if req.Severity != nil {
		fields = append(fields, "severity")
	}
	if req.Enabled != nil {
		fields = append(fields, "enabled")
	}
	if len(req.NotificationChannels) > 0 {
		fields = append(fields, "notification_channels")
	}
	return fields
}

func buildRuleListAuditDetails(page, pageSize, total, resultCount, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":       result,
		"page":         page,
		"page_size":    pageSize,
		"total":        total,
		"result_count": resultCount,
		"http_status":  statusCode,
		"error_code":   errorCode,
	})
}

func buildRuleAuditDetails(rule *AlertRule, statusCode int, result, errorCode string, updatedFields []string) map[string]any {
	details := map[string]any{
		"result":         result,
		"http_status":    statusCode,
		"error_code":     errorCode,
		"updated_fields": updatedFields,
	}
	if rule != nil {
		details["rule_name"] = strings.TrimSpace(rule.Name)
		details["severity"] = strings.TrimSpace(rule.Severity)
		details["enabled"] = rule.Enabled
	}
	return middleware.BuildAuditDetails(details)
}

func buildRuleCreateRequestAuditDetails(req CreateRuleRequest, statusCode int, result, errorCode string) map[string]any {
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	return middleware.BuildAuditDetails(map[string]any{
		"result":      result,
		"rule_name":   strings.TrimSpace(req.Name),
		"severity":    strings.TrimSpace(req.Severity),
		"enabled":     enabled,
		"http_status": statusCode,
		"error_code":  errorCode,
	})
}

func buildRuleUpdateAuditDetails(ruleID string, req UpdateRuleRequest, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":         result,
		"target_rule_id": strings.TrimSpace(ruleID),
		"rule_name":      req.Name,
		"severity":       req.Severity,
		"enabled":        boolValue(req.Enabled),
		"updated_fields": ruleUpdatedFields(req),
		"http_status":    statusCode,
		"error_code":     errorCode,
	})
}

func buildRuleReadAuditDetails(rule *AlertRule, statusCode int, result, errorCode string) map[string]any {
	return buildRuleAuditDetails(rule, statusCode, result, errorCode, nil)
}

func buildRuleToggleAuditDetails(ruleID string, enabled bool, statusCode int, result, errorCode string) map[string]any {
	action := "disable"
	if enabled {
		action = "enable"
	}
	return middleware.BuildAuditDetails(map[string]any{
		"result":         result,
		"target_rule_id": strings.TrimSpace(ruleID),
		"operation":      action,
		"enabled":        enabled,
		"http_status":    statusCode,
		"error_code":     errorCode,
	})
}

func buildRuleDeleteAuditDetails(ruleID string, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":         result,
		"target_rule_id": strings.TrimSpace(ruleID),
		"operation":      "delete",
		"http_status":    statusCode,
		"error_code":     errorCode,
	})
}

func silenceUpdatedFields(req UpdateSilenceRequest) []string {
	fields := make([]string, 0, 4)
	if req.Matchers != nil {
		fields = append(fields, "matchers")
	}
	if strings.TrimSpace(req.Reason) != "" {
		fields = append(fields, "reason")
	}
	if strings.TrimSpace(req.StartsAt) != "" {
		fields = append(fields, "starts_at")
	}
	if strings.TrimSpace(req.EndsAt) != "" {
		fields = append(fields, "ends_at")
	}
	return fields
}

func buildSilenceListAuditDetails(resultCount, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":       result,
		"result_count": resultCount,
		"http_status":  statusCode,
		"error_code":   errorCode,
	})
}

func buildSilenceAuditDetails(silence *Silence, statusCode int, result, errorCode string, updatedFields []string) map[string]any {
	details := map[string]any{
		"result":         result,
		"http_status":    statusCode,
		"error_code":     errorCode,
		"updated_fields": updatedFields,
	}
	if silence != nil {
		details["reason"] = strings.TrimSpace(silence.Reason)
		details["matcher_count"] = len(silence.Matchers)
		details["starts_at"] = silence.StartsAt.UTC().Format(http.TimeFormat)
		details["ends_at"] = silence.EndsAt.UTC().Format(http.TimeFormat)
		details["created_by"] = strings.TrimSpace(silence.CreatedBy)
	}
	return middleware.BuildAuditDetails(details)
}

func buildSilenceCreateRequestAuditDetails(req CreateSilenceRequest, createdBy string, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":        result,
		"reason":        strings.TrimSpace(req.Reason),
		"matcher_count": len(req.Matchers),
		"starts_at":     strings.TrimSpace(req.StartsAt),
		"ends_at":       strings.TrimSpace(req.EndsAt),
		"created_by":    strings.TrimSpace(createdBy),
		"http_status":   statusCode,
		"error_code":    errorCode,
	})
}

func buildSilenceUpdateAuditDetails(silenceID string, req UpdateSilenceRequest, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":            result,
		"target_silence_id": strings.TrimSpace(silenceID),
		"reason":            strings.TrimSpace(req.Reason),
		"matcher_count":     len(req.Matchers),
		"starts_at":         strings.TrimSpace(req.StartsAt),
		"ends_at":           strings.TrimSpace(req.EndsAt),
		"updated_fields":    silenceUpdatedFields(req),
		"http_status":       statusCode,
		"error_code":        errorCode,
	})
}

func buildSilenceDeleteAuditDetails(silenceID string, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":            result,
		"target_silence_id": strings.TrimSpace(silenceID),
		"http_status":       statusCode,
		"error_code":        errorCode,
	})
}

func boolValue(value *bool) any {
	if value == nil {
		return nil
	}
	return *value
}
