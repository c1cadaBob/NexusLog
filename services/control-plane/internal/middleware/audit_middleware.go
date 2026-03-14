package middleware

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

type AuditEvent struct {
	Action       string
	ResourceType string
	ResourceID   string
	UserID       string
	Details      map[string]any
	Skip         bool
}

// AuditMiddleware creates a Gin middleware that audits write operations by default,
// and also supports explicit handler-driven audit events for read flows.
func AuditMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := strings.ToUpper(strings.TrimSpace(c.Request.Method))
		if !shouldAutoAuditMethod(method) && method != http.MethodGet {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		ip := c.ClientIP()
		userAgent := c.Request.UserAgent()

		c.Next()

		auditEntry, hasOverride := GetAuditEvent(c)
		tenantID := resolveTenantID(c)
		userID := resolveUserID(c)
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

		// Insert audit log asynchronously (do not block response)
		go func() {
			action, resourceType, resourceID := deriveAuditFields(method, path, c)
			if action == "" || resourceType == "" {
				return
			}
			insertAuditLog(db, tenantID, userID, action, resourceType, resourceID, ip, userAgent, nil)
		}()
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

func SetAuditEvent(c *gin.Context, event AuditEvent) {
	if c == nil {
		return
	}
	c.Set(auditContextKey, event)
}

func GetAuditEvent(c *gin.Context) (AuditEvent, bool) {
	if c == nil {
		return AuditEvent{}, false
	}
	value, exists := c.Get(auditContextKey)
	if !exists {
		return AuditEvent{}, false
	}
	event, ok := value.(AuditEvent)
	if !ok {
		return AuditEvent{}, false
	}
	return event, true
}

func resolveTenantID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString(authContextKeyTenantID))
}

func resolveUserID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString(authContextKeyUserID))
}

func deriveAuditFields(method, path string, c *gin.Context) (action, resourceType, resourceID string) {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 2 {
		return "", "", ""
	}
	start := 0
	for i, p := range parts {
		if p == "api" && i+1 < len(parts) && parts[i+1] == "v1" {
			start = i + 2
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
	if resourceID == "" {
		resourceID = strings.TrimSpace(c.Param("source_id"))
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
		"metrics": true, "latency": true, "health": true, "healthz": true,
	}
	return nonIDSegments[strings.ToLower(s)]
}

func insertAuditLog(db *sql.DB, tenantID, userID, action, resourceType, resourceID, ip, userAgent string, details map[string]interface{}) {
	if db == nil {
		return
	}
	detailsJSON := "{}"
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			detailsJSON = string(b)
		}
	}

	query := `
INSERT INTO audit_logs (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
VALUES ($1::uuid, $2::uuid, $3, $4, NULLIF($5,''), $6::jsonb, NULLIF($7,'')::inet, NULLIF($8,''), NOW())
`
	var tenantArg, userArg interface{}
	if tenantID != "" {
		tenantArg = tenantID
	} else {
		tenantArg = nil
	}
	if userID != "" {
		userArg = userID
	} else {
		userArg = nil
	}

	_, _ = db.Exec(query, tenantArg, userArg, action, resourceType, resourceID, detailsJSON, ip, userAgent)
}
