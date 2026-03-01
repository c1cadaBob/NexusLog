package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

type handlerRepoMock struct {
	tenantExists bool
	userID       uuid.UUID
	username     string
	registerErr  error
}

func (m *handlerRepoMock) CheckTenantExists(_ context.Context, _ uuid.UUID) (bool, error) {
	return m.tenantExists, nil
}

func (m *handlerRepoMock) RegisterUser(_ context.Context, _ repository.RegisterUserInput) (uuid.UUID, string, error) {
	if m.registerErr != nil {
		return uuid.Nil, "", m.registerErr
	}
	return m.userID, m.username, nil
}

func TestRegisterInvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := NewAuthHandler(service.NewAuthService(&handlerRepoMock{tenantExists: true}))
	router.POST("/api/v1/auth/register", h.Register)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewBufferString("{bad json"))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "AUTH_REGISTER_INVALID_ARGUMENT" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
	if _, ok := body["request_id"]; !ok {
		t.Fatalf("missing request_id")
	}
}

func TestRegisterSuccessEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := NewAuthHandler(service.NewAuthService(&handlerRepoMock{tenantExists: true, userID: uuid.New(), username: "alice"}))
	router.POST("/api/v1/auth/register", h.Register)

	payload := model.RegisterRequest{
		Username:    "alice",
		Password:    "Password123",
		Email:       "alice@example.com",
		DisplayName: "Alice",
	}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	req.Header.Set("X-Request-ID", "gw-test-id")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "OK" || body["message"] != "success" {
		t.Fatalf("unexpected envelope: %#v", body)
	}
	if body["request_id"] != "gw-test-id" {
		t.Fatalf("unexpected request_id: %v", body["request_id"])
	}
	if _, ok := body["meta"]; !ok {
		t.Fatalf("missing meta field")
	}
}
