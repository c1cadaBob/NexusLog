package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
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
			"20000000-0000-0000-0000-000000000001",
			"pull_sources.list",
			"pull_sources",
			"",
			`{"http_status":200,"page":1,"page_size":10,"result":"success","result_count":0,"total":0}`,
			"192.0.2.10",
			"cp-audit-test",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	router.GET("/api/v1/ingest/pull-sources", func(c *gin.Context) {
		c.Set(authContextKeyTenantID, "00000000-0000-0000-0000-000000000001")
		c.Set(authContextKeyUserID, "20000000-0000-0000-0000-000000000001")
		SetAuditEvent(c, AuditEvent{
			Action:       "pull_sources.list",
			ResourceType: "pull_sources",
			Details: BuildAuditDetails(map[string]any{
				"result":       "success",
				"page":         1,
				"page_size":    10,
				"result_count": 0,
				"total":        0,
				"http_status":  http.StatusOK,
			}),
		})
		c.JSON(http.StatusOK, gin.H{"items": []any{}})
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ingest/pull-sources?page=1&page_size=10", nil)
	req.RemoteAddr = "192.0.2.10:34567"
	req.Header.Set("User-Agent", "cp-audit-test")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}

func TestAuditMiddleware_ResolvesUserIDAfterHandlerMutation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectExec("INSERT INTO audit_logs").
		WithArgs(
			"00000000-0000-0000-0000-000000000001",
			"20000000-0000-0000-0000-000000000001",
			"ingest.create",
			"ingest",
			"",
			"{}",
			"192.0.2.11",
			"cp-auto-audit",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	router.POST("/api/v1/ingest", func(c *gin.Context) {
		c.Set(authContextKeyTenantID, "00000000-0000-0000-0000-000000000001")
		c.Set(authContextKeyUserID, "20000000-0000-0000-0000-000000000001")
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", nil)
	req.RemoteAddr = "192.0.2.11:45678"
	req.Header.Set("User-Agent", "cp-auto-audit")
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
			"ingest.create",
			"ingest",
			"",
			"{}",
			"192.0.2.12",
			"cp-spoofed-headers",
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	router := gin.New()
	router.Use(AuditMiddleware(db))
	router.POST("/api/v1/ingest", func(c *gin.Context) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": "UNAUTHORIZED"})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/ingest", nil)
	req.RemoteAddr = "192.0.2.12:45678"
	req.Header.Set("User-Agent", "cp-spoofed-headers")
	req.Header.Set("X-Tenant-ID", "00000000-0000-0000-0000-000000000099")
	req.Header.Set("X-User-ID", "99999999-9999-9999-9999-999999999999")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.Code)
	}
	waitForAuditExpectations(t, mock)
}
