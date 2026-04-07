package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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
	return AuditMiddlewareWithIndexer(db, newAuditIndexerFromEnv())
}

func AuditMiddlewareWithIndexer(db *sql.DB, indexer *auditIndexer) gin.HandlerFunc {
	return func(c *gin.Context) {
		method := strings.ToUpper(strings.TrimSpace(c.Request.Method))
		path := c.Request.URL.Path
		ip := c.ClientIP()
		userAgent := c.Request.UserAgent()

		c.Next()

		auditEntry, hasOverride := getAuditEvent(c)
		tenantID := resolveTenantID(c, hasOverride)
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
			go insertAuditLog(db, indexer, tenantID, userID, action, resourceType, resourceID, ip, userAgent, auditEntry.Details)
			return
		}

		if !shouldAutoAuditMethod(method) {
			return
		}

		action, resourceType, resourceID := deriveAuditFields(method, path, c)
		if action == "" || resourceType == "" {
			return
		}
		go insertAuditLog(db, indexer, tenantID, userID, action, resourceType, resourceID, ip, userAgent, nil)
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

func resolveTenantID(c *gin.Context, allowHeaderFallback bool) string {
	if tenantID := strings.TrimSpace(c.GetString(contextKeyTenantID)); tenantID != "" {
		return tenantID
	}
	if !allowHeaderFallback {
		return ""
	}
	if tenantID := strings.TrimSpace(c.GetHeader("X-Tenant-ID")); tenantID != "" {
		return tenantID
	}
	if tenantID := strings.TrimSpace(c.GetHeader("X-Tenant-Id")); tenantID != "" {
		return tenantID
	}
	return ""
}

func resolveUserID(c *gin.Context) string {
	return strings.TrimSpace(c.GetString(contextKeyUserID))
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

func insertAuditLog(db *sql.DB, indexer *auditIndexer, tenantID, userID, action, resourceType, resourceID, ip, userAgent string, details map[string]any) {
	if db == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	detailsJSON := "{}"
	if details != nil {
		if encoded, err := json.Marshal(details); err == nil {
			detailsJSON = string(encoded)
		}
	}

	auditID := uuid.NewString()
	createdAt := time.Now().UTC()
	query := `
INSERT INTO audit_logs (id, tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, NULLIF($6,''), $7::jsonb, NULLIF($8,'')::inet, NULLIF($9,''), NOW())
`
	var tenantArg, userArg any
	if tenantID != "" {
		tenantArg = tenantID
	}
	if userID != "" {
		userArg = userID
	}

	if _, err := db.ExecContext(ctx, query, auditID, tenantArg, userArg, action, resourceType, resourceID, detailsJSON, ip, userAgent); err != nil {
		log.Printf("audit middleware: insert audit log failed: %v", err)
		return
	}
	if indexer == nil {
		return
	}
	if err := indexer.Index(ctx, auditIndexDocument{
		ID:           auditID,
		TenantID:     strings.TrimSpace(tenantID),
		UserID:       strings.TrimSpace(userID),
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Details:      cloneMap(details),
		IPAddress:    ip,
		UserAgent:    userAgent,
		CreatedAt:    createdAt,
	}); err != nil {
		log.Printf("audit middleware: index audit log failed: %v", err)
	}
}
