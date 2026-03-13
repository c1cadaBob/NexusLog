package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	auditActionCreate = "create"
	auditActionUpdate = "update"
	auditActionDelete = "delete"
	auditContextKey   = "_nexuslog_audit_event"
)

type auditEvent struct {
	Action       string
	ResourceType string
	ResourceID   string
	UserID       string
	Details      map[string]any
	Skip         bool
}

// AuditMiddleware creates a Gin middleware that audits write operations by default,
// and also supports explicit handler-driven audit events for login/read flows.
func AuditMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := strings.ToUpper(strings.TrimSpace(c.Request.Method))
		path := c.Request.URL.Path
		ip := c.ClientIP()
		userAgent := c.Request.UserAgent()

		c.Next()

		tenantID := resolveTenantID(c)
		userID := resolveUserID(c)
		auditEntry, hasOverride := getAuditEvent(c)
		if hasOverride {
			if auditEntry.Skip {
				return
			}
			if overrideUserID := strings.TrimSpace(auditEntry.UserID); overrideUserID != "" {
				userID = overrideUserID
			}
			action := strings.TrimSpace(auditEntry.Action)
			resourceType := strings.TrimSpace(auditEntry.ResourceType)
			resourceID := strings.TrimSpace(auditEntry.ResourceID)
			if action == "" || resourceType == "" {
				return
			}
			go insertAuditLog(db, tenantID, userID, action, resourceType, resourceID, ip, userAgent, auditEntry.Details)
			return
		}

		if !shouldAutoAuditMethod(method) {
			return
		}

		action, resourceType, resourceID := deriveAuditFields(method, path, c)
		if action == "" || resourceType == "" {
			return
		}
		go insertAuditLog(db, tenantID, userID, action, resourceType, resourceID, ip, userAgent, nil)
	}
}

func shouldAutoAuditMethod(method string) bool {
	switch method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func setAuditEvent(c *gin.Context, event auditEvent) {
	if c == nil {
		return
	}
	c.Set(auditContextKey, event)
}

func getAuditEvent(c *gin.Context) (auditEvent, bool) {
	if c == nil {
		return auditEvent{}, false
	}
	value, exists := c.Get(auditContextKey)
	if !exists {
		return auditEvent{}, false
	}
	event, ok := value.(auditEvent)
	if !ok {
		return auditEvent{}, false
	}
	return event, true
}

func resolveTenantID(c *gin.Context) string {
	if tenantID := strings.TrimSpace(c.GetHeader("X-Tenant-ID")); tenantID != "" {
		return tenantID
	}
	if tenantID := strings.TrimSpace(c.GetHeader("X-Tenant-Id")); tenantID != "" {
		return tenantID
	}
	if tenantID := strings.TrimSpace(c.GetString(contextKeyTenantID)); tenantID != "" {
		return tenantID
	}
	return ""
}

func resolveUserID(c *gin.Context) string {
	if uid := strings.TrimSpace(c.GetHeader("X-User-ID")); uid != "" {
		return uid
	}
	if v, exists := c.Get("user_id"); exists {
		if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

func deriveAuditFields(method, path string, c *gin.Context) (action, resourceType, resourceID string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 2 {
		return "", "", ""
	}
	start := 0
	for index, part := range parts {
		if part == "api" && index+1 < len(parts) && parts[index+1] == "v1" {
			start = index + 2
			break
		}
	}
	if start >= len(parts) {
		return "", "", ""
	}
	resourceType = parts[start]
	if len(parts) > start+1 {
		next := parts[start+1]
		if next != "" && !isPathSegment(next) {
			resourceID = next
		}
	}
	if resourceID == "" {
		resourceID = strings.TrimSpace(c.Param("id"))
	}

	switch method {
	case http.MethodPost:
		action = resourceType + "." + auditActionCreate
	case http.MethodPut, http.MethodPatch:
		action = resourceType + "." + auditActionUpdate
	case http.MethodDelete:
		action = resourceType + "." + auditActionDelete
	default:
		return "", "", ""
	}
	return action, resourceType, resourceID
}

func isPathSegment(s string) bool {
	nonIDSegments := map[string]bool{
		"login": true, "register": true, "refresh": true, "logout": true,
		"test": true, "password": true, "reset-request": true, "reset-confirm": true,
	}
	return nonIDSegments[strings.ToLower(s)]
}

func insertAuditLog(db *sql.DB, tenantID, userID, action, resourceType, resourceID, ip, userAgent string, details map[string]any) {
	if db == nil {
		return
	}
	detailsJSON := "{}"
	if details != nil {
		if encoded, err := json.Marshal(details); err == nil {
			detailsJSON = string(encoded)
		}
	}

	query := `
INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
VALUES ($1::uuid, $2::uuid, $3, $4, NULLIF($5,''), $6::jsonb, NULLIF($7,'')::inet, NULLIF($8,''), NOW())
`
	var tenantArg, userArg any
	if tenantID != "" {
		tenantArg = tenantID
	}
	if userID != "" {
		userArg = userID
	}

	_, _ = db.Exec(query, tenantArg, userArg, action, resourceType, resourceID, detailsJSON, ip, userAgent)
}
