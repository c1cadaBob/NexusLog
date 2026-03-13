package backup

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/control-plane/internal/middleware"
)

func setBackupRepositoryAuditEvent(c *gin.Context, action, resourceID string, details map[string]any) {
	middleware.SetAuditEvent(c, middleware.AuditEvent{
		Action:       action,
		ResourceType: "backup_repositories",
		ResourceID:   strings.TrimSpace(resourceID),
		Details:      details,
	})
}

func setBackupSnapshotAuditEvent(c *gin.Context, action, resourceID string, details map[string]any) {
	middleware.SetAuditEvent(c, middleware.AuditEvent{
		Action:       action,
		ResourceType: "backup_snapshots",
		ResourceID:   strings.TrimSpace(resourceID),
		Details:      details,
	})
}

func buildBackupRepositoryListAuditDetails(resultCount, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":       result,
		"result_count": resultCount,
		"http_status":  statusCode,
		"error_code":   errorCode,
	})
}

func buildBackupRepositoryAuditDetails(name, location string, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":      result,
		"repository":  strings.TrimSpace(name),
		"location":    strings.TrimSpace(location),
		"http_status": statusCode,
		"error_code":  errorCode,
	})
}

func buildBackupSnapshotListAuditDetails(repository string, resultCount, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":       result,
		"repository":   strings.TrimSpace(repository),
		"result_count": resultCount,
		"http_status":  statusCode,
		"error_code":   errorCode,
	})
}

func buildBackupSnapshotAuditDetails(repository, snapshot, operation string, indices any, state, description string, statusCode int, result, errorCode string) map[string]any {
	return middleware.BuildAuditDetails(map[string]any{
		"result":      result,
		"repository":  strings.TrimSpace(repository),
		"snapshot":    strings.TrimSpace(snapshot),
		"operation":   strings.TrimSpace(operation),
		"indices":     indices,
		"state":       strings.TrimSpace(state),
		"description": strings.TrimSpace(description),
		"http_status": statusCode,
		"error_code":  errorCode,
	})
}
