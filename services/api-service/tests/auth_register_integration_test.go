package tests

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

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

func TestLogoutIntegration(t *testing.T) {
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
	tenantID := mustCreateTenant(t, ctx, db, "tenant-logout")
	router := buildRouter(db)

	username := "logout_" + uuid.NewString()[:8]
	email := fmt.Sprintf("%s@example.com", username)

	regStatus, regBody := callRegister(t, router, tenantID, model.RegisterRequest{
		Username:    username,
		Password:    "Password123",
		Email:       email,
		DisplayName: "Logout User",
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
	refreshToken, ok := loginData["refresh_token"].(string)
	if !ok || refreshToken == "" {
		t.Fatalf("missing refresh token: %#v", loginData)
	}

	logoutStatus, logoutBody := callLogout(t, router, tenantID, model.LogoutRequest{RefreshToken: refreshToken}, "")
	if logoutStatus != http.StatusOK || logoutBody["code"] != "OK" {
		t.Fatalf("logout failed, status=%d body=%#v", logoutStatus, logoutBody)
	}

	refreshStatus, refreshBody := callRefresh(t, router, tenantID, model.RefreshRequest{RefreshToken: refreshToken})
	if refreshStatus != http.StatusUnauthorized || refreshBody["code"] != "AUTH_REFRESH_INVALID_TOKEN" {
		t.Fatalf("expected refresh invalid after logout, status=%d body=%#v", refreshStatus, refreshBody)
	}

	if !hasSessionStatus(t, ctx, db, tenantID, "revoked") {
		t.Fatalf("expected revoked session after logout")
	}
}

func TestPasswordResetRequestIntegration(t *testing.T) {
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
	tenantID := mustCreateTenant(t, ctx, db, "tenant-reset-request")
	router := buildRouter(db)

	username := "resetreq_" + uuid.NewString()[:8]
	email := fmt.Sprintf("%s@example.com", username)

	regStatus, regBody := callRegister(t, router, tenantID, model.RegisterRequest{
		Username:    username,
		Password:    "Password123",
		Email:       email,
		DisplayName: "Reset Request User",
	})
	if regStatus != http.StatusCreated || regBody["code"] != "OK" {
		t.Fatalf("register setup failed, status=%d body=%#v", regStatus, regBody)
	}

	reqStatus, reqBody := callPasswordResetRequest(t, router, tenantID, model.PasswordResetRequestRequest{EmailOrUsername: username})
	if reqStatus != http.StatusOK || reqBody["code"] != "OK" {
		t.Fatalf("reset-request failed, status=%d body=%#v", reqStatus, reqBody)
	}
	reqData, ok := reqBody["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data in reset-request response: %#v", reqBody)
	}
	if accepted, ok := reqData["accepted"].(bool); !ok || !accepted {
		t.Fatalf("expected accepted=true, got %#v", reqData["accepted"])
	}

	if !hasPasswordResetToken(t, ctx, db, tenantID, username) {
		t.Fatalf("expected password_reset_tokens row exists")
	}
	if !hasLoginAttempt(t, ctx, db, tenantID, username, "success") {
		t.Fatalf("expected successful login_attempt for reset-request")
	}

	unknown := "unknown_" + uuid.NewString()[:8]
	reqStatus, reqBody = callPasswordResetRequest(t, router, tenantID, model.PasswordResetRequestRequest{EmailOrUsername: unknown})
	if reqStatus != http.StatusOK || reqBody["code"] != "OK" {
		t.Fatalf("reset-request for unknown user should still succeed, status=%d body=%#v", reqStatus, reqBody)
	}
	if !hasLoginAttempt(t, ctx, db, tenantID, unknown, "failed") {
		t.Fatalf("expected failed login_attempt for unknown reset-request")
	}
}

func TestPasswordResetConfirmIntegration(t *testing.T) {
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
	tenantID := mustCreateTenant(t, ctx, db, "tenant-reset-confirm")
	router := buildRouter(db)

	username := "resetcfm_" + uuid.NewString()[:8]
	email := fmt.Sprintf("%s@example.com", username)
	oldPassword := "Password123"
	newPassword := "Password456"

	regStatus, regBody := callRegister(t, router, tenantID, model.RegisterRequest{
		Username:    username,
		Password:    oldPassword,
		Email:       email,
		DisplayName: "Reset Confirm User",
	})
	if regStatus != http.StatusCreated || regBody["code"] != "OK" {
		t.Fatalf("register setup failed, status=%d body=%#v", regStatus, regBody)
	}

	loginStatus, loginBody := callLogin(t, router, tenantID, model.LoginRequest{
		Username: username,
		Password: oldPassword,
	})
	if loginStatus != http.StatusOK || loginBody["code"] != "OK" {
		t.Fatalf("pre-reset login failed, status=%d body=%#v", loginStatus, loginBody)
	}
	loginData, ok := loginBody["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing login data: %#v", loginBody)
	}
	oldRefreshToken, ok := loginData["refresh_token"].(string)
	if !ok || oldRefreshToken == "" {
		t.Fatalf("missing refresh token in pre-reset login response: %#v", loginData)
	}

	rawToken := "reset-token-" + uuid.NewString()
	insertPasswordResetToken(t, ctx, db, tenantID, username, rawToken, time.Now().UTC().Add(20*time.Minute))

	confirmStatus, confirmBody := callPasswordResetConfirm(t, router, tenantID, model.PasswordResetConfirmRequest{
		Token:       rawToken,
		NewPassword: newPassword,
	})
	if confirmStatus != http.StatusOK || confirmBody["code"] != "OK" {
		t.Fatalf("reset-confirm failed, status=%d body=%#v", confirmStatus, confirmBody)
	}
	confirmData, ok := confirmBody["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing reset-confirm data: %#v", confirmBody)
	}
	if reset, ok := confirmData["reset"].(bool); !ok || !reset {
		t.Fatalf("expected reset=true, got %#v", confirmData["reset"])
	}
	if !isPasswordResetTokenUsed(t, ctx, db, tenantID, rawToken) {
		t.Fatalf("expected password reset token marked used")
	}

	refreshStatus, refreshBody := callRefresh(t, router, tenantID, model.RefreshRequest{RefreshToken: oldRefreshToken})
	if refreshStatus != http.StatusUnauthorized || refreshBody["code"] != "AUTH_REFRESH_INVALID_TOKEN" {
		t.Fatalf("expected pre-reset refresh revoked, status=%d body=%#v", refreshStatus, refreshBody)
	}

	oldLoginStatus, oldLoginBody := callLogin(t, router, tenantID, model.LoginRequest{
		Username: username,
		Password: oldPassword,
	})
	if oldLoginStatus != http.StatusUnauthorized || oldLoginBody["code"] != "AUTH_LOGIN_INVALID_CREDENTIALS" {
		t.Fatalf("expected old password invalid, status=%d body=%#v", oldLoginStatus, oldLoginBody)
	}

	newLoginStatus, newLoginBody := callLogin(t, router, tenantID, model.LoginRequest{
		Username: username,
		Password: newPassword,
	})
	if newLoginStatus != http.StatusOK || newLoginBody["code"] != "OK" {
		t.Fatalf("expected new password login success, status=%d body=%#v", newLoginStatus, newLoginBody)
	}

	reuseStatus, reuseBody := callPasswordResetConfirm(t, router, tenantID, model.PasswordResetConfirmRequest{
		Token:       rawToken,
		NewPassword: "Password789",
	})
	if reuseStatus != http.StatusBadRequest || reuseBody["code"] != "AUTH_RESET_CONFIRM_INVALID_TOKEN" {
		t.Fatalf("expected token reuse invalid, status=%d body=%#v", reuseStatus, reuseBody)
	}
}

func TestAuthStorageWriteAndVerifyIntegration(t *testing.T) {
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
	tenantID := mustCreateTenant(t, ctx, db, "tenant-storage-verify")
	router := buildRouter(db)

	username := "storage_" + uuid.NewString()[:8]
	email := fmt.Sprintf("%s@example.com", username)

	regStatus, regBody := callRegister(t, router, tenantID, model.RegisterRequest{
		Username:    username,
		Password:    "Password123",
		Email:       email,
		DisplayName: "Storage Verify User",
	})
	if regStatus != http.StatusCreated || regBody["code"] != "OK" {
		t.Fatalf("register setup failed, status=%d body=%#v", regStatus, regBody)
	}

	okStatus, okBody := callLogin(t, router, tenantID, model.LoginRequest{
		Username: username,
		Password: "Password123",
	})
	if okStatus != http.StatusOK || okBody["code"] != "OK" {
		t.Fatalf("login success setup failed, status=%d body=%#v", okStatus, okBody)
	}

	failStatus, failBody := callLogin(t, router, tenantID, model.LoginRequest{
		Username: username,
		Password: "wrong-password",
	})
	if failStatus != http.StatusUnauthorized || failBody["code"] != "AUTH_LOGIN_INVALID_CREDENTIALS" {
		t.Fatalf("failed login setup mismatch, status=%d body=%#v", failStatus, failBody)
	}

	resetStatus, resetBody := callPasswordResetRequest(t, router, tenantID, model.PasswordResetRequestRequest{
		EmailOrUsername: username,
	})
	if resetStatus != http.StatusOK || resetBody["code"] != "OK" {
		t.Fatalf("reset-request setup failed, status=%d body=%#v", resetStatus, resetBody)
	}

	if !hasSessionIntegrity(t, ctx, db, tenantID, username) {
		t.Fatalf("expected user_sessions integrity checks passed")
	}
	if !hasPasswordResetTokenIntegrity(t, ctx, db, tenantID, username) {
		t.Fatalf("expected password_reset_tokens integrity checks passed")
	}
	if !hasLoginAttempt(t, ctx, db, tenantID, username, "success") {
		t.Fatalf("expected login_attempts success row exists")
	}
	if !hasLoginAttempt(t, ctx, db, tenantID, username, "failed") {
		t.Fatalf("expected login_attempts failed row exists")
	}
	if !hasFailedLoginAttemptReason(t, ctx, db, tenantID, username) {
		t.Fatalf("expected failed login_attempt has non-empty reason")
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
	r.POST("/api/v1/auth/logout", authH.Logout)
	r.POST("/api/v1/auth/password/reset-request", authH.PasswordResetRequest)
	r.POST("/api/v1/auth/password/reset-confirm", authH.PasswordResetConfirm)
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

func callLogout(t *testing.T, r *gin.Engine, tenantID string, payload model.LogoutRequest, userID string) (int, map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", tenantID)
	if userID != "" {
		req.Header.Set("X-User-ID", userID)
	}
	resp := httptest.NewRecorder()
	r.ServeHTTP(resp, req)

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	return resp.Code, body
}

func callPasswordResetRequest(t *testing.T, r *gin.Engine, tenantID string, payload model.PasswordResetRequestRequest) (int, map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/password/reset-request", bytes.NewBuffer(raw))
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

func callPasswordResetConfirm(t *testing.T, r *gin.Engine, tenantID string, payload model.PasswordResetConfirmRequest) (int, map[string]any) {
	t.Helper()
	raw, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/password/reset-confirm", bytes.NewBuffer(raw))
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

func hasSessionIntegrity(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM user_sessions s
			JOIN users u ON u.id = s.user_id
			WHERE s.tenant_id = $1::uuid
			  AND u.username = $2
			  AND s.refresh_token_hash <> ''
			  AND COALESCE(s.access_token_jti, '') <> ''
			  AND s.session_status IN ('active', 'revoked')
			  AND s.expires_at IS NOT NULL
			  AND s.expires_at > s.created_at
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username).Scan(&exists); err != nil {
		t.Fatalf("check user_sessions integrity: %v", err)
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

func hasPasswordResetToken(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM password_reset_tokens prt
			JOIN users u ON u.id = prt.user_id
			WHERE prt.tenant_id = $1::uuid
			  AND u.username = $2
			  AND prt.token_hash <> ''
			  AND prt.expires_at > NOW()
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username).Scan(&exists); err != nil {
		t.Fatalf("check password_reset_tokens row: %v", err)
	}
	return exists
}

func hasPasswordResetTokenIntegrity(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM password_reset_tokens prt
			JOIN users u ON u.id = prt.user_id
			WHERE prt.tenant_id = $1::uuid
			  AND u.username = $2
			  AND prt.token_hash <> ''
			  AND char_length(prt.token_hash) = 64
			  AND prt.expires_at > prt.created_at
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username).Scan(&exists); err != nil {
		t.Fatalf("check password_reset_tokens integrity: %v", err)
	}
	return exists
}

func insertPasswordResetToken(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username, rawToken string, expiresAt time.Time) {
	t.Helper()
	const findUserSQL = `SELECT id FROM users WHERE tenant_id = $1::uuid AND username = $2 LIMIT 1`
	var userID string
	if err := db.QueryRowContext(ctx, findUserSQL, tenantID, username).Scan(&userID); err != nil {
		t.Fatalf("query user id for reset token: %v", err)
	}

	const insertTokenSQL = `
		INSERT INTO password_reset_tokens (
			tenant_id,
			user_id,
			token_hash,
			expires_at,
			requested_ip,
			user_agent
		)
		VALUES ($1::uuid, $2::uuid, $3, $4, '127.0.0.1', 'integration-test')
	`
	if _, err := db.ExecContext(ctx, insertTokenSQL, tenantID, userID, hashResetToken(rawToken), expiresAt); err != nil {
		t.Fatalf("insert password reset token: %v", err)
	}
}

func isPasswordResetTokenUsed(t *testing.T, ctx context.Context, db *sql.DB, tenantID, rawToken string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM password_reset_tokens
			WHERE tenant_id = $1::uuid
			  AND token_hash = $2
			  AND used_at IS NOT NULL
		)
	`
	var used bool
	if err := db.QueryRowContext(ctx, q, tenantID, hashResetToken(rawToken)).Scan(&used); err != nil {
		t.Fatalf("check password reset token used: %v", err)
	}
	return used
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

func hasFailedLoginAttemptReason(t *testing.T, ctx context.Context, db *sql.DB, tenantID, username string) bool {
	t.Helper()
	const q = `
		SELECT EXISTS(
			SELECT 1
			FROM login_attempts
			WHERE tenant_id = $1::uuid
			  AND username = $2
			  AND result = 'failed'
			  AND COALESCE(reason, '') <> ''
		)
	`
	var exists bool
	if err := db.QueryRowContext(ctx, q, tenantID, username).Scan(&exists); err != nil {
		t.Fatalf("check login_attempts failed reason: %v", err)
	}
	return exists
}

func hashResetToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
