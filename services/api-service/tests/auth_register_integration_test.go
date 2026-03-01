package tests

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"

	"github.com/nexuslog/api-service/internal/handler"
	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

func TestRegisterIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("TEST_DB_DSN is not set")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	tenantA := mustCreateTenant(t, ctx, db, "tenant-a")
	tenantB := mustCreateTenant(t, ctx, db, "tenant-b")

	router := buildRouter(db)

	username := "user_" + uuid.NewString()[:8]
	email := fmt.Sprintf("%s@example.com", username)

	status, body := callRegister(t, router, tenantA, model.RegisterRequest{Username: username, Password: "Password123", Email: email, DisplayName: "User A"})
	if status != http.StatusCreated || body["code"] != "OK" {
		t.Fatalf("expected register success, status=%d body=%#v", status, body)
	}

	if !hasUser(t, ctx, db, tenantA, username, email) {
		t.Fatalf("expected users row exists")
	}
	if !hasCredential(t, ctx, db, tenantA, username) {
		t.Fatalf("expected user_credentials row exists")
	}

	status, body = callRegister(t, router, tenantA, model.RegisterRequest{Username: username, Password: "Password123", Email: "other@example.com", DisplayName: "Dup User"})
	if status != http.StatusConflict || body["code"] != "AUTH_REGISTER_USERNAME_CONFLICT" {
		t.Fatalf("expected username conflict, status=%d body=%#v", status, body)
	}

	status, body = callRegister(t, router, tenantA, model.RegisterRequest{Username: "other_" + uuid.NewString()[:8], Password: "Password123", Email: email, DisplayName: "Dup Email"})
	if status != http.StatusConflict || body["code"] != "AUTH_REGISTER_EMAIL_CONFLICT" {
		t.Fatalf("expected email conflict, status=%d body=%#v", status, body)
	}

	status, body = callRegister(t, router, tenantB, model.RegisterRequest{Username: username, Password: "Password123", Email: email, DisplayName: "Cross Tenant"})
	if status != http.StatusCreated || body["code"] != "OK" {
		t.Fatalf("expected cross-tenant success, status=%d body=%#v", status, body)
	}

	status, body = callRegister(t, router, uuid.NewString(), model.RegisterRequest{Username: "ghost_" + uuid.NewString()[:8], Password: "Password123", Email: "ghost@example.com", DisplayName: "Ghost"})
	if status != http.StatusNotFound || body["code"] != "AUTH_REGISTER_TENANT_NOT_FOUND" {
		t.Fatalf("expected tenant not found, status=%d body=%#v", status, body)
	}
}

func TestLoginIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("TEST_DB_DSN is not set")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	tenantID := mustCreateTenant(t, ctx, db, "tenant-login")
	router := buildRouter(db)

	username := "login_" + uuid.NewString()[:8]
	email := fmt.Sprintf("%s@example.com", username)

	registerStatus, registerBody := callRegister(t, router, tenantID, model.RegisterRequest{
		Username:    username,
		Password:    "Password123",
		Email:       email,
		DisplayName: "Login User",
	})
	if registerStatus != http.StatusCreated || registerBody["code"] != "OK" {
		t.Fatalf("register setup failed, status=%d body=%#v", registerStatus, registerBody)
	}

	status, body := callLogin(t, router, tenantID, model.LoginRequest{
		Username:   username,
		Password:   "Password123",
		RememberMe: true,
	})
	if status != http.StatusOK || body["code"] != "OK" {
		t.Fatalf("expected login success, status=%d body=%#v", status, body)
	}

	if !hasSession(t, ctx, db, tenantID, username) {
		t.Fatalf("expected user_sessions row exists")
	}
	if !hasLoginAttempt(t, ctx, db, tenantID, username, "success") {
		t.Fatalf("expected successful login_attempt")
	}

	status, body = callLogin(t, router, tenantID, model.LoginRequest{
		Username: username,
		Password: "bad-password",
	})
	if status != http.StatusUnauthorized || body["code"] != "AUTH_LOGIN_INVALID_CREDENTIALS" {
		t.Fatalf("expected invalid credentials, status=%d body=%#v", status, body)
	}
	if !hasLoginAttempt(t, ctx, db, tenantID, username, "failed") {
		t.Fatalf("expected failed login_attempt")
	}

	status, body = callLogin(t, router, uuid.NewString(), model.LoginRequest{
		Username: username,
		Password: "Password123",
	})
	if status != http.StatusNotFound || body["code"] != "AUTH_LOGIN_TENANT_NOT_FOUND" {
		t.Fatalf("expected tenant not found on login, status=%d body=%#v", status, body)
	}
}

func TestRefreshIntegration(t *testing.T) {
	dsn := os.Getenv("TEST_DB_DSN")
	if dsn == "" {
		t.Skip("TEST_DB_DSN is not set")
	}

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	tenantID := mustCreateTenant(t, ctx, db, "tenant-refresh")
	router := buildRouter(db)

	username := "refresh_" + uuid.NewString()[:8]
	email := fmt.Sprintf("%s@example.com", username)

	regStatus, regBody := callRegister(t, router, tenantID, model.RegisterRequest{
		Username:    username,
		Password:    "Password123",
		Email:       email,
		DisplayName: "Refresh User",
	})
	if regStatus != http.StatusCreated || regBody["code"] != "OK" {
		t.Fatalf("register setup failed, status=%d body=%#v", regStatus, regBody)
	}

	loginStatus, loginBody := callLogin(t, router, tenantID, model.LoginRequest{
		Username: username,
		Password: "Password123",
	})
	if loginStatus != http.StatusOK || loginBody["code"] != "OK" {
		t.Fatalf("login setup failed, status=%d body=%#v", loginStatus, loginBody)
	}

	loginData, ok := loginBody["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing login data: %#v", loginBody)
	}
	oldRefresh, ok := loginData["refresh_token"].(string)
	if !ok || oldRefresh == "" {
		t.Fatalf("missing old refresh token: %#v", loginData)
	}

	refreshStatus, refreshBody := callRefresh(t, router, tenantID, model.RefreshRequest{RefreshToken: oldRefresh})
	if refreshStatus != http.StatusOK || refreshBody["code"] != "OK" {
		t.Fatalf("refresh failed, status=%d body=%#v", refreshStatus, refreshBody)
	}
	refreshData, ok := refreshBody["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing refresh data: %#v", refreshBody)
	}
	newRefresh, ok := refreshData["refresh_token"].(string)
	if !ok || newRefresh == "" {
		t.Fatalf("missing new refresh token: %#v", refreshData)
	}
	if newRefresh == oldRefresh {
		t.Fatalf("expected rotated refresh token")
	}

	oldStatus, oldBody := callRefresh(t, router, tenantID, model.RefreshRequest{RefreshToken: oldRefresh})
	if oldStatus != http.StatusUnauthorized || oldBody["code"] != "AUTH_REFRESH_INVALID_TOKEN" {
		t.Fatalf("expected old refresh invalid, status=%d body=%#v", oldStatus, oldBody)
	}

	if !hasSessionStatus(t, ctx, db, tenantID, "active") {
		t.Fatalf("expected active session after refresh")
	}
	if !hasSessionStatus(t, ctx, db, tenantID, "revoked") {
		t.Fatalf("expected revoked session after rotation")
	}
}

func buildRouter(db *sql.DB) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	authRepo := repository.NewAuthRepository(db)
	authSvc := service.NewAuthService(authRepo)
	authH := handler.NewAuthHandler(authSvc)
	r.POST("/api/v1/auth/register", authH.Register)
	r.POST("/api/v1/auth/login", authH.Login)
	r.POST("/api/v1/auth/refresh", authH.Refresh)
	return r
}

func callRegister(t *testing.T, r *gin.Engine, tenantID string, payload model.RegisterRequest) (int, map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return resp.Code, body
}

func callLogin(t *testing.T, r *gin.Engine, tenantID string, payload model.LoginRequest) (int, map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return resp.Code, body
}

func callRefresh(t *testing.T, r *gin.Engine, tenantID string, payload model.RefreshRequest) (int, map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return resp.Code, body
}

func mustCreateTenant(t *testing.T, ctx context.Context, db *sql.DB, prefix string) string {
	t.Helper()
	name := fmt.Sprintf("%s-%s", prefix, uuid.NewString()[:8])
	display := "Tenant " + prefix
	var id string
	err := db.QueryRowContext(ctx, `
		INSERT INTO obs.tenant (name, display_name, status)
		VALUES ($1, $2, 'active')
		RETURNING id::text
	`, name, display).Scan(&id)
	if err != nil {
		t.Fatalf("create tenant: %v", err)
	}
	return id
}

func hasUser(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username, email string) bool {
	t.Helper()
	const q = `SELECT EXISTS(SELECT 1 FROM users WHERE tenant_id = $1::uuid AND username = $2 AND email = $3)`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username, email).Scan(&exists); err != nil {
		t.Fatalf("check users row: %v", err)
	}
	return exists
}

func hasCredential(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM user_credentials uc
			JOIN users u ON u.id = uc.user_id
			WHERE uc.tenant_id = $1::uuid AND u.username = $2 AND uc.password_hash <> ''
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username).Scan(&exists); err != nil {
		t.Fatalf("check user_credentials row: %v", err)
	}
	return exists
}

func hasSession(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions s
			JOIN users u ON u.id = s.user_id
			WHERE s.tenant_id = $1::uuid AND u.username = $2 AND s.refresh_token_hash <> ''
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username).Scan(&exists); err != nil {
		t.Fatalf("check user_sessions row: %v", err)
	}
	return exists
}

func hasSessionStatus(t *testing.T, ctx context.Context, db *sql.DB, tenantID, status string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions
			WHERE tenant_id = $1::uuid AND session_status = $2
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, status).Scan(&exists); err != nil {
		t.Fatalf("check user_sessions status: %v", err)
	}
	return exists
}

func hasLoginAttempt(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username, result string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM login_attempts
			WHERE tenant_id = $1::uuid AND username = $2 AND result = $3
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username, result).Scan(&exists); err != nil {
		t.Fatalf("check login_attempts row: %v", err)
	}
	return exists
}
