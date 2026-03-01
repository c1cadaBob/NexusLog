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
	"golang.org/x/crypto/bcrypt"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

type handlerRepoMock struct {
	tenantExists bool
	userID       uuid.UUID
	username     string
	registerErr  error
	loginUser    repository.LoginUserRecord
	loginErr     error
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

func (m *handlerRepoMock) GetLoginUserByUsername(_ context.Context, _ uuid.UUID, _ string) (repository.LoginUserRecord, error) {
	if m.loginErr != nil {
		return repository.LoginUserRecord{}, m.loginErr
	}
	return m.loginUser, nil
}

func (m *handlerRepoMock) CreateUserSession(_ context.Context, _ repository.CreateSessionInput) error {
	return nil
}

func (m *handlerRepoMock) RecordLoginAttempt(_ context.Context, _ repository.LoginAttemptInput) error {
	return nil
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

func TestLoginInvalidBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := NewAuthHandler(service.NewAuthService(&handlerRepoMock{tenantExists: true}))
	router.POST("/api/v1/auth/login", h.Login)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString("{bad json"))
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
	if body["code"] != "AUTH_LOGIN_INVALID_ARGUMENT" {
		t.Fatalf("unexpected code: %v", body["code"])
	}
}

func TestLoginSuccessEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	hash, err := bcrypt.GenerateFromPassword([]byte("Password123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("generate hash: %v", err)
	}

	mock := &handlerRepoMock{
		tenantExists: true,
		loginUser: repository.LoginUserRecord{
			UserID:       uuid.New(),
			Username:     "alice",
			Email:        "alice@example.com",
			DisplayName:  "Alice",
			Status:       "active",
			PasswordHash: string(hash),
		},
	}
	h := NewAuthHandler(service.NewAuthService(mock))
	router.POST("/api/v1/auth/login", h.Login)

	payload := model.LoginRequest{
		Username:   "alice",
		Password:   "Password123",
		RememberMe: true,
	}
	raw, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBuffer(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Tenant-ID", uuid.NewString())
	req.Header.Set("X-Request-ID", "gw-login-id")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if body["code"] != "OK" || body["message"] != "success" {
		t.Fatalf("unexpected envelope: %#v", body)
	}
	if body["request_id"] != "gw-login-id" {
		t.Fatalf("unexpected request_id: %v", body["request_id"])
	}

	data, ok := body["data"].(map[string]any)
	if !ok {
		t.Fatalf("missing data")
	}
	if data["access_token"] == "" || data["refresh_token"] == "" {
		t.Fatalf("missing token fields: %#v", data)
	}
}
