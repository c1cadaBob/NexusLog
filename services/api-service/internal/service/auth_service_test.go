package service

import (
	"context"
	"errors"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/google/uuid"

	"github.com/nexuslog/api-service/internal/model"
	"github.com/nexuslog/api-service/internal/repository"
)

type mockAuthRepository struct {
	tenantExists      bool
	checkErr          error
	registerErr       error
	userID            uuid.UUID
	username          string
	loginUser         repository.LoginUserRecord
	loginUserErr      error
	findUser          repository.UserIdentityRecord
	findUserErr       error
	createResetErr    error
	confirmResetErr   error
	confirmResetUser  uuid.UUID
	createSessionErr  error
	rotateErr         error
	revokeRefreshErr  error
	revokeByUserErr   error
	lockActive        bool
	lockUntil         time.Time
	lockErr           error
	lastLoginAttempt  *repository.LoginAttemptInput
	lastCreateSession *repository.CreateSessionInput
	lastRotateInput   *repository.RotateSessionInput
	sessionCreateCall int
	rotateCall        int
	createResetCall   int
	confirmResetCall  int
	revokeRefreshCall int
	revokeByUserCall  int
}

func (m *mockAuthRepository) CheckTenantExists(_ context.Context, _ uuid.UUID) (bool, error) {
	if m.checkErr != nil {
		return false, m.checkErr
	}
	return m.tenantExists, nil
}

func (m *mockAuthRepository) RegisterUser(_ context.Context, _ repository.RegisterUserInput) (uuid.UUID, string, error) {
	if m.registerErr != nil {
		return uuid.Nil, "", m.registerErr
	}
	return m.userID, m.username, nil
}

func (m *mockAuthRepository) GetLoginUserByUsername(_ context.Context, _ uuid.UUID, _ string) (repository.LoginUserRecord, error) {
	if m.loginUserErr != nil {
		return repository.LoginUserRecord{}, m.loginUserErr
	}
	return m.loginUser, nil
}

func (m *mockAuthRepository) FindUserByEmailOrUsername(_ context.Context, _ uuid.UUID, _ string) (repository.UserIdentityRecord, error) {
	if m.findUserErr != nil {
		return repository.UserIdentityRecord{}, m.findUserErr
	}
	return m.findUser, nil
}

func (m *mockAuthRepository) CreatePasswordResetToken(
	_ context.Context,
	_, _ uuid.UUID,
	_ string,
	_ time.Time,
	_, _ string,
) error {
	m.createResetCall++
	return m.createResetErr
}

func (m *mockAuthRepository) ConfirmPasswordReset(
	_ context.Context,
	_ uuid.UUID,
	_ string,
	_ string,
	_ int,
) (uuid.UUID, error) {
	m.confirmResetCall++
	if m.confirmResetErr != nil {
		return uuid.Nil, m.confirmResetErr
	}
	if m.confirmResetUser == uuid.Nil {
		return uuid.New(), nil
	}
	return m.confirmResetUser, nil
}

func (m *mockAuthRepository) CreateUserSession(_ context.Context, input repository.CreateSessionInput) error {
	cp := input
	m.lastCreateSession = &cp
	m.sessionCreateCall++
	return m.createSessionErr
}

func (m *mockAuthRepository) RotateSessionByRefreshToken(_ context.Context, input repository.RotateSessionInput) (uuid.UUID, error) {
	cp := input
	m.lastRotateInput = &cp
	m.rotateCall++
	if m.rotateErr != nil {
		return uuid.Nil, m.rotateErr
	}
	return uuid.New(), nil
}

func (m *mockAuthRepository) RevokeSessionByRefreshToken(_ context.Context, _ uuid.UUID, _ string) error {
	m.revokeRefreshCall++
	return m.revokeRefreshErr
}

func (m *mockAuthRepository) RevokeActiveSessionsByUserID(_ context.Context, _ uuid.UUID, _ uuid.UUID) error {
	m.revokeByUserCall++
	return m.revokeByUserErr
}

func (m *mockAuthRepository) RecordLoginAttempt(_ context.Context, input repository.LoginAttemptInput) error {
	cp := input
	m.lastLoginAttempt = &cp
	return nil
}

func (m *mockAuthRepository) IsLoginLocked(_ context.Context, _ uuid.UUID, _ string) (bool, time.Time, error) {
	if m.lockErr != nil {
		return false, time.Time{}, m.lockErr
	}
	return m.lockActive, m.lockUntil, nil
}

func TestRegisterValidationAndTenantErrors(t *testing.T) {
	svc := NewAuthService(&mockAuthRepository{tenantExists: true}, "test-secret")

	_, err := svc.Register(context.Background(), "", model.RegisterRequest{})
	if err == nil || err.Code != "AUTH_REGISTER_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required error, got %#v", err)
	}

	_, err = svc.Register(context.Background(), "bad-tenant", model.RegisterRequest{})
	if err == nil || err.Code != "AUTH_REGISTER_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid error, got %#v", err)
	}

	_, err = svc.Register(context.Background(), uuid.NewString(), model.RegisterRequest{Username: "ab", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for username, got %#v", err)
	}

	_, err = svc.Register(context.Background(), uuid.NewString(), model.RegisterRequest{Username: "valid_user", Password: "short", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for password, got %#v", err)
	}

	_, err = svc.Register(context.Background(), uuid.NewString(), model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "bad-email"})
	if err == nil || err.Code != "AUTH_REGISTER_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for email, got %#v", err)
	}

	_, err = svc.Register(context.Background(), uuid.NewString(), model.RegisterRequest{Username: reservedUsernameSuperAdmin, Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_RESERVED_USERNAME" {
		t.Fatalf("expected reserved username error, got %#v", err)
	}
}

func TestRegisterConflictAndSuccess(t *testing.T) {
	tenantID := uuid.NewString()

	svc := NewAuthService(&mockAuthRepository{tenantExists: false}, "test-secret")
	_, err := svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_TENANT_NOT_FOUND" {
		t.Fatalf("expected tenant not found, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: true, registerErr: repository.ErrUsernameConflict}, "test-secret")
	_, err = svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_USERNAME_CONFLICT" {
		t.Fatalf("expected username conflict, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: true, registerErr: repository.ErrEmailConflict}, "test-secret")
	_, err = svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_EMAIL_CONFLICT" {
		t.Fatalf("expected email conflict, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: true, checkErr: errors.New("db error")}, "test-secret")
	_, err = svc.Register(context.Background(), tenantID, model.RegisterRequest{Username: "valid_user", Password: "Password123", Email: "a@example.com"})
	if err == nil || err.Code != "AUTH_REGISTER_INTERNAL_ERROR" {
		t.Fatalf("expected internal error on tenant check, got %#v", err)
	}

	expectedUserID := uuid.New()
	svc = NewAuthService(&mockAuthRepository{tenantExists: true, userID: expectedUserID, username: "valid_user"}, "test-secret")
	resp, err := svc.Register(context.Background(), tenantID, model.RegisterRequest{
		Username:    " valid_user ",
		Password:    "Password123",
		Email:       "A@Example.com",
		DisplayName: "Alice",
	})
	if err != nil {
		t.Fatalf("expected success, got error %#v", err)
	}
	if resp.UserID != expectedUserID.String() || resp.Username != "valid_user" {
		t.Fatalf("unexpected success response: %#v", resp)
	}
}

func TestLoginValidationAndTenantErrors(t *testing.T) {
	svc := NewAuthService(&mockAuthRepository{tenantExists: true}, "test-secret")

	_, err := svc.Login(context.Background(), "", model.LoginRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required error, got %#v", err)
	}

	_, err = svc.Login(context.Background(), "bad-tenant", model.LoginRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid error, got %#v", err)
	}

	_, err = svc.Login(context.Background(), uuid.NewString(), model.LoginRequest{Username: "ab", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for username, got %#v", err)
	}

	_, err = svc.Login(context.Background(), uuid.NewString(), model.LoginRequest{Username: "valid_user", Password: ""}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for password, got %#v", err)
	}

	svc = NewAuthService(&mockAuthRepository{tenantExists: false}, "test-secret")
	_, err = svc.Login(context.Background(), uuid.NewString(), model.LoginRequest{Username: "valid_user", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_TENANT_NOT_FOUND" {
		t.Fatalf("expected tenant not found, got %#v", err)
	}
}

func TestLoginLockedRecordsLockedAttempt(t *testing.T) {
	tenantID := uuid.NewString()
	repoMock := &mockAuthRepository{
		tenantExists: true,
		lockActive:   true,
		lockUntil:    time.Now().UTC().Add(10 * time.Minute),
	}
	svc := NewAuthService(repoMock, "test-secret")

	_, err := svc.Login(context.Background(), tenantID, model.LoginRequest{Username: "valid_user", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_LOCKED" {
		t.Fatalf("expected locked error, got %#v", err)
	}
	if repoMock.lastLoginAttempt == nil {
		t.Fatal("expected locked login attempt record")
	}
	if repoMock.lastLoginAttempt.Result != "locked" {
		t.Fatalf("expected locked result, got %#v", repoMock.lastLoginAttempt)
	}
	if repoMock.lastLoginAttempt.Reason != "account_locked" {
		t.Fatalf("expected account_locked reason, got %#v", repoMock.lastLoginAttempt)
	}
}

func TestLoginInvalidCredentialsAndSuccess(t *testing.T) {
	tenantID := uuid.NewString()
	userID := uuid.New()

	hash, hashErr := bcrypt.GenerateFromPassword([]byte("Password123"), bcrypt.DefaultCost)
	if hashErr != nil {
		t.Fatalf("bcrypt hash: %v", hashErr)
	}

	repoMock := &mockAuthRepository{
		tenantExists: true,
		loginUserErr: repository.ErrInvalidCredentials,
	}
	svc := NewAuthService(repoMock, "test-secret")
	_, err := svc.Login(context.Background(), tenantID, model.LoginRequest{Username: "valid_user", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INVALID_CREDENTIALS" {
		t.Fatalf("expected invalid credentials, got %#v", err)
	}
	if repoMock.lastLoginAttempt == nil || repoMock.lastLoginAttempt.Result != "failed" {
		t.Fatalf("expected failed login attempt record")
	}

	repoMock = &mockAuthRepository{
		tenantExists: true,
		loginUser: repository.LoginUserRecord{
			UserID:       userID,
			Username:     "valid_user",
			Email:        "user@example.com",
			DisplayName:  "User",
			Status:       "active",
			PasswordHash: string(hash),
		},
	}
	svc = NewAuthService(repoMock, "test-secret")
	resp, err := svc.Login(context.Background(), tenantID, model.LoginRequest{Username: "valid_user", Password: "Password123", RememberMe: true}, "127.0.0.1", "ua")
	if err != nil {
		t.Fatalf("expected success, got %#v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" || resp.ExpiresIn <= 0 {
		t.Fatalf("unexpected token payload: %#v", resp)
	}
	if resp.User.UserID != userID.String() || resp.User.Username != "valid_user" {
		t.Fatalf("unexpected user payload: %#v", resp.User)
	}
	if repoMock.sessionCreateCall != 1 {
		t.Fatalf("expected session create call once, got %d", repoMock.sessionCreateCall)
	}
	if repoMock.lastCreateSession == nil {
		t.Fatalf("expected session create input recorded")
	}
	rememberTTL := time.Until(repoMock.lastCreateSession.ExpiresAt)
	if rememberTTL < defaultRememberRefresh-time.Minute || rememberTTL > defaultRememberRefresh+time.Minute {
		t.Fatalf("expected remember_me refresh ttl near %s, got %s", defaultRememberRefresh, rememberTTL)
	}
	if repoMock.lastLoginAttempt == nil || repoMock.lastLoginAttempt.Result != "success" {
		t.Fatalf("expected success login attempt record")
	}

	repoMock = &mockAuthRepository{
		tenantExists: true,
		loginUser: repository.LoginUserRecord{
			UserID:       userID,
			Username:     "valid_user",
			Email:        "user@example.com",
			DisplayName:  "User",
			Status:       "active",
			PasswordHash: string(hash),
		},
		createSessionErr: errors.New("session failed"),
	}
	svc = NewAuthService(repoMock, "test-secret")
	_, err = svc.Login(context.Background(), tenantID, model.LoginRequest{Username: "valid_user", Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_LOGIN_INTERNAL_ERROR" {
		t.Fatalf("expected internal error on session create, got %#v", err)
	}
}

func TestLoginRejectsSystemAutomationInteractiveAccess(t *testing.T) {
	tenantID := uuid.NewString()
	userID := uuid.New()

	hash, hashErr := bcrypt.GenerateFromPassword([]byte("Password123"), bcrypt.DefaultCost)
	if hashErr != nil {
		t.Fatalf("bcrypt hash: %v", hashErr)
	}

	repoMock := &mockAuthRepository{
		tenantExists: true,
		loginUser: repository.LoginUserRecord{
			UserID:       userID,
			Username:     reservedUsernameSystemAutomation,
			Email:        "system-automation@nexuslog.local",
			DisplayName:  "System Automation",
			Status:       "active",
			PasswordHash: string(hash),
		},
	}

	svc := NewAuthService(repoMock, "test-secret")
	_, err := svc.Login(context.Background(), tenantID, model.LoginRequest{Username: reservedUsernameSystemAutomation, Password: "Password123"}, "127.0.0.1", "ua")
	if err == nil || err.Code != model.ErrorCodeAuthLoginInteractiveDisabled {
		t.Fatalf("expected interactive login disabled error, got %#v", err)
	}
	if repoMock.sessionCreateCall != 0 {
		t.Fatalf("expected no session creation, got %d", repoMock.sessionCreateCall)
	}
	if repoMock.lastLoginAttempt == nil {
		t.Fatal("expected blocked login attempt record")
	}
	if repoMock.lastLoginAttempt.Result != "blocked" || repoMock.lastLoginAttempt.Reason != "interactive_login_disallowed" {
		t.Fatalf("unexpected blocked login attempt: %#v", repoMock.lastLoginAttempt)
	}
}

func TestRefreshValidationAndRotation(t *testing.T) {
	tenantID := uuid.NewString()

	repoMock := &mockAuthRepository{tenantExists: true}
	svc := NewAuthService(repoMock, "test-secret")

	_, err := svc.Refresh(context.Background(), "", model.RefreshRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required, got %#v", err)
	}

	_, err = svc.Refresh(context.Background(), "bad-tenant", model.RefreshRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid, got %#v", err)
	}

	_, err = svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: ""}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument, got %#v", err)
	}

	repoMock.rotateErr = repository.ErrInvalidRefreshToken
	_, err = svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: "rt-1"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_INVALID_TOKEN" {
		t.Fatalf("expected invalid token, got %#v", err)
	}

	repoMock.rotateErr = nil
	resp, err := svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: "rt-2"}, "127.0.0.1", "ua")
	if err != nil {
		t.Fatalf("expected refresh success, got %#v", err)
	}
	if resp.AccessToken == "" || resp.RefreshToken == "" || resp.ExpiresIn <= 0 {
		t.Fatalf("unexpected refresh response: %#v", resp)
	}
	if repoMock.rotateCall == 0 {
		t.Fatalf("expected rotate call")
	}

	repoMock.rotateErr = errors.New("db failed")
	_, err = svc.Refresh(context.Background(), tenantID, model.RefreshRequest{RefreshToken: "rt-3"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_REFRESH_INTERNAL_ERROR" {
		t.Fatalf("expected internal error, got %#v", err)
	}
}

func TestLogoutValidationAndSuccess(t *testing.T) {
	tenantID := uuid.NewString()
	userID := uuid.NewString()

	repoMock := &mockAuthRepository{tenantExists: true}
	svc := NewAuthService(repoMock, "test-secret")

	_, err := svc.Logout(context.Background(), "", "", model.LogoutRequest{})
	if err == nil || err.Code != "AUTH_LOGOUT_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required, got %#v", err)
	}

	_, err = svc.Logout(context.Background(), "bad-tenant", "", model.LogoutRequest{})
	if err == nil || err.Code != "AUTH_LOGOUT_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid, got %#v", err)
	}

	repoMock.revokeRefreshErr = repository.ErrInvalidRefreshToken
	_, err = svc.Logout(context.Background(), tenantID, "", model.LogoutRequest{RefreshToken: "bad-rt"})
	if err == nil || err.Code != "AUTH_LOGOUT_INVALID_TOKEN" {
		t.Fatalf("expected invalid token, got %#v", err)
	}

	repoMock.revokeRefreshErr = nil
	resp, err := svc.Logout(context.Background(), tenantID, "", model.LogoutRequest{RefreshToken: "rt-ok"})
	if err != nil || !resp.LoggedOut {
		t.Fatalf("expected logout success by refresh token, resp=%#v err=%#v", resp, err)
	}
	if repoMock.revokeRefreshCall == 0 {
		t.Fatalf("expected revoke by refresh call")
	}

	_, err = svc.Logout(context.Background(), tenantID, "", model.LogoutRequest{})
	if err == nil || err.Code != "AUTH_LOGOUT_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument without refresh/user header, got %#v", err)
	}

	_, err = svc.Logout(context.Background(), tenantID, "bad-user-id", model.LogoutRequest{})
	if err == nil || err.Code != "AUTH_LOGOUT_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid user id argument, got %#v", err)
	}

	repoMock.revokeByUserErr = nil
	resp, err = svc.Logout(context.Background(), tenantID, userID, model.LogoutRequest{})
	if err != nil || !resp.LoggedOut {
		t.Fatalf("expected logout success by user id, resp=%#v err=%#v", resp, err)
	}
	if repoMock.revokeByUserCall == 0 {
		t.Fatalf("expected revoke by user call")
	}

	repoMock.revokeByUserErr = errors.New("db failed")
	_, err = svc.Logout(context.Background(), tenantID, userID, model.LogoutRequest{})
	if err == nil || err.Code != "AUTH_LOGOUT_INTERNAL_ERROR" {
		t.Fatalf("expected internal error on revoke by user, got %#v", err)
	}
}

func TestPasswordResetRequestValidationAndSuccess(t *testing.T) {
	tenantID := uuid.NewString()
	userID := uuid.New()

	repoMock := &mockAuthRepository{tenantExists: true}
	svc := NewAuthService(repoMock, "test-secret")

	_, err := svc.PasswordResetRequest(context.Background(), "", model.PasswordResetRequestRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_RESET_REQUEST_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required, got %#v", err)
	}

	_, err = svc.PasswordResetRequest(context.Background(), "bad-tenant", model.PasswordResetRequestRequest{}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_RESET_REQUEST_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid, got %#v", err)
	}

	_, err = svc.PasswordResetRequest(context.Background(), tenantID, model.PasswordResetRequestRequest{EmailOrUsername: ""}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_RESET_REQUEST_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument, got %#v", err)
	}

	repoMock.findUserErr = repository.ErrUserNotFound
	resp, err := svc.PasswordResetRequest(context.Background(), tenantID, model.PasswordResetRequestRequest{EmailOrUsername: "nobody@example.com"}, "127.0.0.1", "ua")
	if err != nil || !resp.Accepted {
		t.Fatalf("expected accepted for user-not-found, resp=%#v err=%#v", resp, err)
	}
	if repoMock.lastLoginAttempt != nil {
		t.Fatalf("password reset request should not record login attempts, got %#v", repoMock.lastLoginAttempt)
	}

	repoMock.findUserErr = nil
	repoMock.findUser = repository.UserIdentityRecord{
		UserID:   userID,
		Username: "alice",
		Email:    "alice@example.com",
		Status:   "active",
	}
	repoMock.createResetErr = nil
	resp, err = svc.PasswordResetRequest(context.Background(), tenantID, model.PasswordResetRequestRequest{EmailOrUsername: "alice"}, "127.0.0.1", "ua")
	if err != nil || !resp.Accepted {
		t.Fatalf("expected accepted for existing user, resp=%#v err=%#v", resp, err)
	}
	if repoMock.createResetCall == 0 {
		t.Fatalf("expected reset token creation")
	}
	if repoMock.lastLoginAttempt != nil {
		t.Fatalf("password reset request should not record login attempts, got %#v", repoMock.lastLoginAttempt)
	}

	repoMock.createResetErr = errors.New("db failed")
	_, err = svc.PasswordResetRequest(context.Background(), tenantID, model.PasswordResetRequestRequest{EmailOrUsername: "alice"}, "127.0.0.1", "ua")
	if err == nil || err.Code != "AUTH_RESET_REQUEST_INTERNAL_ERROR" {
		t.Fatalf("expected internal error on token create, got %#v", err)
	}
}

func TestPasswordResetConfirmValidationAndSuccess(t *testing.T) {
	tenantID := uuid.NewString()
	repoMock := &mockAuthRepository{tenantExists: true}
	svc := NewAuthService(repoMock, "test-secret")

	_, err := svc.PasswordResetConfirm(context.Background(), "", model.PasswordResetConfirmRequest{})
	if err == nil || err.Code != "AUTH_RESET_CONFIRM_TENANT_REQUIRED" {
		t.Fatalf("expected tenant required, got %#v", err)
	}

	_, err = svc.PasswordResetConfirm(context.Background(), "bad-tenant", model.PasswordResetConfirmRequest{})
	if err == nil || err.Code != "AUTH_RESET_CONFIRM_TENANT_INVALID" {
		t.Fatalf("expected tenant invalid, got %#v", err)
	}

	_, err = svc.PasswordResetConfirm(context.Background(), tenantID, model.PasswordResetConfirmRequest{
		Token:       "",
		NewPassword: "Password123",
	})
	if err == nil || err.Code != "AUTH_RESET_CONFIRM_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for token, got %#v", err)
	}

	_, err = svc.PasswordResetConfirm(context.Background(), tenantID, model.PasswordResetConfirmRequest{
		Token:       "token-1",
		NewPassword: "short",
	})
	if err == nil || err.Code != "AUTH_RESET_CONFIRM_INVALID_ARGUMENT" {
		t.Fatalf("expected invalid argument for new password, got %#v", err)
	}

	repoMock.confirmResetErr = repository.ErrInvalidResetToken
	_, err = svc.PasswordResetConfirm(context.Background(), tenantID, model.PasswordResetConfirmRequest{
		Token:       "token-2",
		NewPassword: "Password123",
	})
	if err == nil || err.Code != "AUTH_RESET_CONFIRM_INVALID_TOKEN" {
		t.Fatalf("expected invalid token, got %#v", err)
	}

	repoMock.confirmResetErr = errors.New("db failed")
	_, err = svc.PasswordResetConfirm(context.Background(), tenantID, model.PasswordResetConfirmRequest{
		Token:       "token-3",
		NewPassword: "Password123",
	})
	if err == nil || err.Code != "AUTH_RESET_CONFIRM_INTERNAL_ERROR" {
		t.Fatalf("expected internal error, got %#v", err)
	}

	repoMock.confirmResetErr = nil
	resp, err := svc.PasswordResetConfirm(context.Background(), tenantID, model.PasswordResetConfirmRequest{
		Token:       "token-4",
		NewPassword: "Password123",
	})
	if err != nil {
		t.Fatalf("expected success, got %#v", err)
	}
	if !resp.Reset {
		t.Fatalf("expected reset=true, got %#v", resp)
	}
	if repoMock.confirmResetCall == 0 {
		t.Fatalf("expected confirm reset call")
	}
}
