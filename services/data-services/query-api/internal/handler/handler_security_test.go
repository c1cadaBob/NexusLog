package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/data-services/query-api/internal/service"
)

func TestSanitizeQueryValidationError_HidesDeepPageInternals(t *testing.T) {
	err := fmt.Errorf("%w: page=999 page_size=500 max_page=20 max_rows=10000", service.ErrPageBeyondResultWindow)
	got := sanitizeQueryValidationError(err)
	if got != "requested page exceeds supported result window; use cursor pagination" {
		t.Fatalf("unexpected sanitized message: %q", got)
	}
	if strings.Contains(got, "max_page") || strings.Contains(got, "10000") {
		t.Fatalf("sanitized message leaked internals: %q", got)
	}
}

func TestWriteServiceError_DoesNotLeakQueryWindowDetails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v1/query/logs", nil)

	err := fmt.Errorf("%w: page=999 page_size=500 max_page=20 max_rows=10000", service.ErrPageBeyondResultWindow)
	writeServiceError(ctx, err)

	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("unexpected status: %d body=%s", recorder.Code, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "max_page") || strings.Contains(recorder.Body.String(), "10000") {
		t.Fatalf("response leaked internals: %s", recorder.Body.String())
	}

	var body struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body.Message != "requested page exceeds supported result window; use cursor pagination" {
		t.Fatalf("unexpected message: %q", body.Message)
	}
}
