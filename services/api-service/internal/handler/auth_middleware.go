package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/httpx"
	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

const (
	contextKeyUserID          = "user_id"
	contextKeyTenantID        = "tenant_id"
	contextKeyUserRoles       = "user_roles"
	contextKeyUserPermissions = "user_permissions"
)

// AuthRequired validates JWT token and sets user context (user_id, tenant_id, user_roles, user_permissions).
func AuthRequired(db *sql.DB, jwtSecret string) gin.HandlerFunc {
	authService := service.NewAuthService(nil, jwtSecret)
	userRepo := repository.NewUserRepository(db)

	return func(c *gin.Context) {
		authz := c.GetHeader("Authorization")
		if authz == "" {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "UNAUTHORIZED",
				Message:    "missing authorization header",
			})
			c.Abort()
			return
		}

		parts := strings.SplitN(authz, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "UNAUTHORIZED",
				Message:    "invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := strings.TrimSpace(parts[1])
		if tokenString == "" {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "UNAUTHORIZED",
				Message:    "missing bearer token",
			})
			c.Abort()
			return
		}

		claims, err := authService.ValidateAccessToken(tokenString)
		if err != nil {
			msg := "invalid or expired token"
			if strings.Contains(err.Error(), "expired") {
				msg = "token has expired"
			}
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "UNAUTHORIZED",
				Message:    msg,
			})
			c.Abort()
			return
		}

		if strings.TrimSpace(claims.ID) == "" {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "UNAUTHORIZED",
				Message:    "token jti is required",
			})
			c.Abort()
			return
		}

		active, sessionErr := isAccessTokenSessionActive(c.Request.Context(), db, claims.TenantID, claims.UserID, claims.ID)
		if sessionErr != nil {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusInternalServerError,
				Code:       "INTERNAL_ERROR",
				Message:    "failed to validate session",
			})
			c.Abort()
			return
		}
		if !active {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "UNAUTHORIZED",
				Message:    "session is revoked or expired",
			})
			c.Abort()
			return
		}

		// Verify user exists and get roles/permissions
		_, err = userRepo.GetUser(c.Request.Context(), claims.TenantID, claims.UserID)
		if err != nil {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusUnauthorized,
				Code:       "UNAUTHORIZED",
				Message:    "user not found",
			})
			c.Abort()
			return
		}

		roles, err := userRepo.GetUserRoles(c.Request.Context(), claims.TenantID, claims.UserID)
		if err != nil {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusInternalServerError,
				Code:       "INTERNAL_ERROR",
				Message:    "failed to load user roles",
			})
			c.Abort()
			return
		}

		roleNames := make([]string, 0, len(roles))
		permSet := make(map[string]bool)
		for _, r := range roles {
			roleNames = append(roleNames, r.Name)
			perms := parsePermissions(r.Permissions)
			for _, p := range perms {
				permSet[p] = true
			}
		}

		permissions := make([]string, 0, len(permSet))
		for p := range permSet {
			permissions = append(permissions, p)
		}

		c.Set(contextKeyUserID, claims.UserID)
		c.Set(contextKeyTenantID, claims.TenantID)
		c.Set(contextKeyUserRoles, roleNames)
		c.Set(contextKeyUserPermissions, permissions)
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), contextKeyUserID, claims.UserID))
		c.Request = c.Request.WithContext(context.WithValue(c.Request.Context(), contextKeyTenantID, claims.TenantID))

		// Override X-Tenant-ID from token for tenant isolation
		c.Request.Header.Set("X-Tenant-ID", claims.TenantID)
		c.Request.Header.Set("X-User-ID", claims.UserID)

		c.Next()
	}
}

// RequirePermission checks if the authenticated user has the required permission.
// Must be used after AuthRequired. Returns 403 with unified error body if denied.
func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permsVal, exists := c.Get(contextKeyUserPermissions)
		if !exists {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusForbidden,
				Code:       "FORBIDDEN",
				Message:    "permission check failed: auth context missing",
			})
			c.Abort()
			return
		}

		permissions, ok := permsVal.([]string)
		if !ok {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusForbidden,
				Code:       "FORBIDDEN",
				Message:    "permission check failed",
			})
			c.Abort()
			return
		}

		if hasPermission(permissions, permission) {
			c.Next()
			return
		}

		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusForbidden,
			Code:       "FORBIDDEN",
			Message:    "insufficient permissions",
		})
		c.Abort()
	}
}

func hasPermission(permissions []string, required string) bool {
	for _, p := range permissions {
		if p == "*" {
			return true
		}
		if p == required {
			return true
		}
	}
	return false
}

func parsePermissions(raw []byte) []string {
	if len(raw) == 0 {
		return nil
	}
	var arr []string
	if err := json.Unmarshal(raw, &arr); err != nil {
		return nil
	}
	return arr
}

func isAccessTokenSessionActive(ctx context.Context, db *sql.DB, tenantID, userID, accessTokenJTI string) (bool, error) {
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions
			WHERE tenant_id = $1::uuid
			  AND user_id = $2::uuid
			  AND access_token_jti = $3
			  AND session_status = 'active'
			  AND expires_at > $4
		)
	`
	var active bool
	if err := db.QueryRowContext(ctx, q, tenantID, userID, accessTokenJTI, time.Now().UTC()).Scan(&active); err != nil {
		return false, err
	}
	return active, nil
}
