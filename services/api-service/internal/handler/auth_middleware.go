package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/httpx"
	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

const (
	contextKeyUserID           = "user_id"
	contextKeyTenantID         = "tenant_id"
	contextKeyUserRoles        = "user_roles"
	contextKeyUserPermissions  = "user_permissions"
	contextKeyUserCapabilities = "user_capabilities"
	contextKeyUserScopes       = "user_scopes"
	contextKeyUserEntitlements = "user_entitlements"
	contextKeyUserFeatureFlags = "user_feature_flags"
	contextKeyUserAuthzEpoch   = "user_authz_epoch"
	contextKeyUserActorFlags   = "user_actor_flags"
)

// AuthRequired validates JWT token and sets user context.
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

		userRecord, err := userRepo.GetUser(c.Request.Context(), claims.TenantID, claims.UserID)
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
		permSet := make(map[string]struct{})
		for _, role := range roles {
			roleName := strings.TrimSpace(role.Name)
			if roleName != "" {
				roleNames = append(roleNames, roleName)
			}
			for _, permission := range parsePermissions(role.Permissions) {
				normalizedPermission := strings.TrimSpace(permission)
				if normalizedPermission == "" {
					continue
				}
				permSet[normalizedPermission] = struct{}{}
			}
		}
		sort.Strings(roleNames)

		permissions := make([]string, 0, len(permSet))
		for permission := range permSet {
			permissions = append(permissions, permission)
		}
		sort.Strings(permissions)

		authorizationContext := service.BuildAuthorizationContext(userRecord.Username, roleNames, permissions)

		c.Set(contextKeyUserID, claims.UserID)
		c.Set(contextKeyTenantID, claims.TenantID)
		c.Set(contextKeyUserRoles, roleNames)
		c.Set(contextKeyUserPermissions, permissions)
		c.Set(contextKeyUserCapabilities, authorizationContext.Capabilities)
		c.Set(contextKeyUserScopes, authorizationContext.Scopes)
		c.Set(contextKeyUserEntitlements, authorizationContext.Entitlements)
		c.Set(contextKeyUserFeatureFlags, authorizationContext.FeatureFlags)
		c.Set(contextKeyUserAuthzEpoch, authorizationContext.AuthzEpoch)
		c.Set(contextKeyUserActorFlags, authorizationContext.ActorFlags)

		requestContext := c.Request.Context()
		requestContext = context.WithValue(requestContext, contextKeyUserID, claims.UserID)
		requestContext = context.WithValue(requestContext, contextKeyTenantID, claims.TenantID)
		requestContext = context.WithValue(requestContext, contextKeyUserRoles, roleNames)
		requestContext = context.WithValue(requestContext, contextKeyUserPermissions, permissions)
		requestContext = context.WithValue(requestContext, contextKeyUserCapabilities, authorizationContext.Capabilities)
		requestContext = context.WithValue(requestContext, contextKeyUserScopes, authorizationContext.Scopes)
		requestContext = context.WithValue(requestContext, contextKeyUserEntitlements, authorizationContext.Entitlements)
		requestContext = context.WithValue(requestContext, contextKeyUserFeatureFlags, authorizationContext.FeatureFlags)
		requestContext = context.WithValue(requestContext, contextKeyUserAuthzEpoch, authorizationContext.AuthzEpoch)
		requestContext = context.WithValue(requestContext, contextKeyUserActorFlags, authorizationContext.ActorFlags)
		c.Request = c.Request.WithContext(requestContext)

		c.Request.Header.Set("X-Tenant-ID", claims.TenantID)
		c.Request.Header.Set("X-User-ID", claims.UserID)

		c.Next()
	}
}

// RequirePermission checks if the authenticated user has the required permission.
func RequirePermission(permission string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permissions, ok := readContextStringSlice(c, contextKeyUserPermissions)
		if !ok {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusForbidden,
				Code:       "FORBIDDEN",
				Message:    "permission check failed: auth context missing",
			})
			c.Abort()
			return
		}

		if hasAuthorizationValue(permissions, permission) {
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

// RequireCapability checks if the authenticated user has the required capability.
func RequireCapability(capability string) gin.HandlerFunc {
	return func(c *gin.Context) {
		capabilities, ok := readContextStringSlice(c, contextKeyUserCapabilities)
		if !ok {
			httpx.Error(c, &model.APIError{
				HTTPStatus: http.StatusForbidden,
				Code:       "FORBIDDEN",
				Message:    "capability check failed: auth context missing",
			})
			c.Abort()
			return
		}

		if hasAuthorizationValue(capabilities, capability) {
			c.Next()
			return
		}

		httpx.Error(c, &model.APIError{
			HTTPStatus: http.StatusForbidden,
			Code:       "FORBIDDEN",
			Message:    "insufficient capabilities",
		})
		c.Abort()
	}
}

func readContextStringSlice(c *gin.Context, key string) ([]string, bool) {
	if c == nil {
		return nil, false
	}
	value, exists := c.Get(key)
	if !exists {
		return nil, false
	}
	items, ok := value.([]string)
	if !ok {
		return nil, false
	}
	return items, true
}

func hasAuthorizationValue(values []string, required string) bool {
	for _, value := range values {
		if value == "*" || value == required {
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
			FROM user_sessions s
			JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
			WHERE s.tenant_id = $1::uuid
			  AND s.user_id = $2::uuid
			  AND s.access_token_jti = $3
			  AND s.session_status = 'active'
			  AND s.expires_at > $4
			  AND u.status = 'active'
		)
	`
	var active bool
	if err := db.QueryRowContext(ctx, q, tenantID, userID, accessTokenJTI, time.Now().UTC()).Scan(&active); err != nil {
		return false, err
	}
	return active, nil
}
