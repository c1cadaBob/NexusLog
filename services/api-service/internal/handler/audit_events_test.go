package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

func waitForAuditExpectations(t *testing.T, mock sqlmock.Sqlmock) {
	t.Helper()
	deadline := time.Now().Add(500 * time.Millisecond)
	for {
		if err := mock.ExpectationsWereMet(); err == nil {
			return
		}
		if time.Now().After(deadline) {
			if err := mock.ExpectationsWereMet(); err != nil {
				t.Fatalf("audit expectations not met: %v", err)
			}
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestAuditMiddleware_UsesExplicitAuditEventForGet(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			"11111111-1111-1111-1111-111111111111",
			"users.list",
			"users",
			"",
			`{"http_status":200,"result":"success"}`,
			"192.0.2.1",
			"audit-test",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	router.GET("/api/v1/users", func(c *gin.Context) {
		c.Set(contextKeyTenantID, "00000000-0000-0000-0000-000000000001")
		c.Set(contextKeyUserID, "11111111-1111-1111-1111-111111111111")
		setAuditEvent(c, auditEvent{
			Action:       "users.list",
			ResourceType: "users",
			Details: buildAuditDetails(map[string]any{
				"result":      "success",
				"http_status": http.StatusOK,
			}),
		})
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users", nil)
	req.RemoteAddr = "192.0.2.1:12345"
	req.Header.Set("User-Agent", "audit-test")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_ResolvesUserIDAfterDownstreamAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			"22222222-2222-2222-2222-222222222222",
			"users.create",
			"users",
			"",
			"{}",
			"192.0.2.2",
			"audit-user-create",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	router.POST("/api/v1/users", func(c *gin.Context) {
		c.Set(contextKeyTenantID, "00000000-0000-0000-0000-000000000001")
		c.Set(contextKeyUserID, "22222222-2222-2222-2222-222222222222")
		c.Request.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
		c.Request.Header.Set("X-User-ID", "22222222-2222-2222-2222-222222222222")
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", nil)
	req.RemoteAddr = "192.0.2.2:23456"
	req.Header.Set("User-Agent", "audit-user-create")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_DoesNotTrustSpoofedHeadersWithoutAuthContext(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			nil,
			nil,
			"users.create",
			"users",
			"",
			"{}",
			"192.0.2.22",
			"audit-spoofed-headers",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	router.POST("/api/v1/users", func(c *gin.Context) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED"})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/users", nil)
	req.RemoteAddr = "192.0.2.22:23456"
	req.Header.Set("User-Agent", "audit-spoofed-headers")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000099")
	req.Header.Set("X-User-ID", "99999999-9999-9999-9999-999999999999")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_UsesExplicitAuditEventForAuthRefresh(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			nil,
			"auth.refresh",
			"auth",
			"",
			`{"http_status":200,"result":"success","token_provided":true}`,
			"192.0.2.3",
			"audit-auth-refresh",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	mockRepo := &handlerRepoMock{tenantExists: true}
	h := NewAuthHandler(service.NewAuthService(mockRepo, "test-secret"))
	router.POST("/api/v1/auth/refresh", h.Refresh)

	payload := model.RefreshRequest{RefreshToken: "rt-valid"}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewBuffer(raw))
	req.RemoteAddr = "192.0.2.3:34567"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("User-Agent", "audit-auth-refresh")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_UsesExplicitAuditEventForAuthRefreshInvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			nil,
			"auth.refresh",
			"auth",
			"",
			`{"error_code":"AUTH_REFRESH_INVALID_ARGUMENT","http_status":400,"result":"failed","token_provided":false}`,
			"192.0.2.4",
			"audit-auth-refresh-invalid",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	h := NewAuthHandler(service.NewAuthService(&handlerRepoMock{tenantExists: true}, "test-secret"))
	router.POST("/api/v1/auth/refresh", h.Refresh)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewBufferString("{bad json"))
	req.RemoteAddr = "192.0.2.4:45678"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("User-Agent", "audit-auth-refresh-invalid")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_UsesExplicitAuditEventForPasswordResetRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			nil,
			"auth.password_reset_request",
			"auth",
			"",
			`{"email_or_username":"alice","http_status":200,"result":"success"}`,
			"192.0.2.5",
			"audit-reset-request",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	mockRepo := &handlerRepoMock{
		tenantExists: true,
		findUser: repository.UserIdentityRecord{
			UserID:   uuid.New(),
			Username: "alice",
			Email:    "alice@example.com",
			Status:   "active",
		},
	}
	h := NewAuthHandler(service.NewAuthService(mockRepo, "test-secret"))
	router.POST("/api/v1/auth/password/reset-request", h.PasswordResetRequest)

	payload := model.PasswordResetRequestRequest{EmailOrUsername: "alice"}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/password/reset-request", bytes.NewBuffer(raw))
	req.RemoteAddr = "192.0.2.5:34567"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("User-Agent", "audit-reset-request")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_UsesExplicitAuditEventForPasswordResetRequestInvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			nil,
			"auth.password_reset_request",
			"auth",
			"",
			`{"error_code":"AUTH_RESET_REQUEST_INVALID_ARGUMENT","http_status":400,"result":"failed"}`,
			"192.0.2.6",
			"audit-reset-request-invalid",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	h := NewAuthHandler(service.NewAuthService(&handlerRepoMock{tenantExists: true}, "test-secret"))
	router.POST("/api/v1/auth/password/reset-request", h.PasswordResetRequest)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/password/reset-request", bytes.NewBufferString("{bad json"))
	req.RemoteAddr = "192.0.2.6:45678"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("User-Agent", "audit-reset-request-invalid")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_UsesExplicitAuditEventForPasswordResetConfirm(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			nil,
			"auth.password_reset_confirm",
			"auth",
			"",
			`{"http_status":200,"result":"success","token_provided":true}`,
			"192.0.2.7",
			"audit-reset-confirm",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	h := NewAuthHandler(service.NewAuthService(&handlerRepoMock{tenantExists: true}, "test-secret"))
	router.POST("/api/v1/auth/password/reset-confirm", h.PasswordResetConfirm)

	payload := model.PasswordResetConfirmRequest{Token: "reset-token-1", NewPassword: "Password123"}
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal request: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/password/reset-confirm", bytes.NewBuffer(raw))
	req.RemoteAddr = "192.0.2.7:34567"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("User-Agent", "audit-reset-confirm")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_UsesExplicitAuditEventForPasswordResetConfirmInvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			nil,
			"auth.password_reset_confirm",
			"auth",
			"",
			`{"error_code":"AUTH_RESET_CONFIRM_INVALID_ARGUMENT","http_status":400,"result":"failed","token_provided":false}`,
			"192.0.2.8",
			"audit-reset-confirm-invalid",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	h := NewAuthHandler(service.NewAuthService(&handlerRepoMock{tenantExists: true}, "test-secret"))
	router.POST("/api/v1/auth/password/reset-confirm", h.PasswordResetConfirm)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/password/reset-confirm", bytes.NewBufferString("{bad json"))
	req.RemoteAddr = "192.0.2.8:45678"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000001")
	req.Header.Set("User-Agent", "audit-reset-confirm-invalid")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}
