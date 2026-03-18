package repository

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type timeBetweenMatcher struct {
	min time.Time
	max time.Time
}

func (m timeBetweenMatcher) Match(v driver.Value) bool {
	t, ok := v.(time.Time)
	if !ok {
		return false
	}
	return !t.Before(m.min) && !t.After(m.max)
}

func TestGetRefreshTokenUser_RejectsInvalidRefreshToken(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	tenantID := uuid.New()
	refreshToken := "missing-refresh-token"

	mock.ExpectQuery(`SELECT u.id, u.username, u.email, u.status\s+FROM user_sessions s\s+JOIN users u`).
		WithArgs(tenantID, hashToken(refreshToken), sqlmock.AnyArg()).
		WillReturnError(sql.ErrNoRows)

	_, err = repo.GetRefreshTokenUser(context.Background(), tenantID, refreshToken)
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetRefreshTokenUser_ReturnsActiveUserIdentity(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	tenantID := uuid.New()
	userID := uuid.New()
	refreshToken := "active-refresh-token"

	mock.ExpectQuery(`SELECT u.id, u.username, u.email, u.status\s+FROM user_sessions s\s+JOIN users u`).
		WithArgs(tenantID, hashToken(refreshToken), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id", "username", "email", "status"}).
			AddRow(userID, "system-automation", "system-automation@nexuslog.local", "active"))

	rec, err := repo.GetRefreshTokenUser(context.Background(), tenantID, refreshToken)
	if err != nil {
		t.Fatalf("GetRefreshTokenUser() error = %v", err)
	}
	if rec.UserID != userID || rec.Username != "system-automation" {
		t.Fatalf("GetRefreshTokenUser() = %#v, want active identity", rec)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRotateSessionByRefreshToken_RejectsDisabledUser(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	input := RotateSessionInput{
		TenantID:       uuid.New(),
		CurrentRefresh: "current-refresh-token",
		NewRefresh:     "next-refresh-token",
		AccessTokenJTI: uuid.NewString(),
		ClientIP:       "127.0.0.1",
		UserAgent:      "ua",
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT s.id, s.user_id, s.expires_at, s.created_at, s.session_status, s.session_family_id, s.replaced_by_session_id\s+FROM user_sessions s\s+JOIN users u`).
		WithArgs(input.TenantID, hashToken(input.CurrentRefresh)).
		WillReturnError(sql.ErrNoRows)
	mock.ExpectRollback()

	_, err = repo.RotateSessionByRefreshToken(context.Background(), input)
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRotateSessionByRefreshToken_PreservesOriginalSessionTTL(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	input := RotateSessionInput{
		TenantID:       uuid.New(),
		CurrentRefresh: "remember-refresh-token",
		NewRefresh:     "remember-refresh-token-next",
		AccessTokenJTI: uuid.NewString(),
		ClientIP:       "127.0.0.1",
		UserAgent:      "ua",
	}
	createdAt := time.Now().UTC().Add(-2 * time.Hour)
	originalTTL := 30 * 24 * time.Hour
	expiresAt := createdAt.Add(originalTTL)
	lowerBound := time.Now().UTC().Add(originalTTL - time.Minute)
	upperBound := time.Now().UTC().Add(originalTTL + time.Minute)
	sessionID := uuid.New()
	userID := uuid.New()
	familyID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT s.id, s.user_id, s.expires_at, s.created_at, s.session_status, s.session_family_id, s.replaced_by_session_id\s+FROM user_sessions s\s+JOIN users u`).
		WithArgs(input.TenantID, hashToken(input.CurrentRefresh)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "expires_at", "created_at", "session_status", "session_family_id", "replaced_by_session_id"}).
			AddRow(sessionID, userID, expiresAt, createdAt, "active", familyID, nil))
	mock.ExpectExec(`INSERT INTO user_sessions`).
		WithArgs(
			sqlmock.AnyArg(),
			input.TenantID,
			userID,
			hashToken(input.NewRefresh),
			input.AccessTokenJTI,
			familyID,
			input.ClientIP,
			input.UserAgent,
			timeBetweenMatcher{min: lowerBound, max: upperBound},
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE user_sessions\s+SET[\s\S]*replaced_by_session_id = \$2[\s\S]*WHERE id = \$1`).
		WithArgs(sessionID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	gotUserID, err := repo.RotateSessionByRefreshToken(context.Background(), input)
	if err != nil {
		t.Fatalf("RotateSessionByRefreshToken() error = %v", err)
	}
	if gotUserID != userID {
		t.Fatalf("expected userID %s, got %s", userID, gotUserID)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestLookupReservedUsernamePolicyWithAvailability_ReturnsUnavailableWhenTableMissing(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	tenantID := uuid.New()

	mock.ExpectQuery(`FROM subject_reserved_policy`).
		WithArgs(tenantID, "tenant_root").
		WillReturnError(&pq.Error{Code: "42P01"})

	rec, available, err := repo.LookupReservedUsernamePolicyWithAvailability(context.Background(), tenantID, "tenant_root")
	if err != nil {
		t.Fatalf("LookupReservedUsernamePolicyWithAvailability() error = %v", err)
	}
	if available {
		t.Fatal("expected reserved policy source to be unavailable")
	}
	if rec.Found {
		t.Fatalf("expected empty policy record, got %#v", rec)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestLookupReservedUsernamePolicy_ReturnsPolicyForCustomUsername(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	tenantID := uuid.New()

	mock.ExpectQuery(`FROM subject_reserved_policy`).
		WithArgs(tenantID, "tenant_root").
		WillReturnRows(sqlmock.NewRows([]string{"reserved", "interactive_login_allowed", "system_subject", "break_glass_allowed", "managed_by"}).
			AddRow(true, false, false, false, "policy"))

	rec, err := repo.LookupReservedUsernamePolicy(context.Background(), tenantID, "tenant_root")
	if err != nil {
		t.Fatalf("LookupReservedUsernamePolicy() error = %v", err)
	}
	if !rec.Found || !rec.Reserved || rec.ManagedBy != "policy" {
		t.Fatalf("unexpected policy record: %#v", rec)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestGetPasswordResetTokenUser_ReturnsActiveUserIdentity(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	tenantID := uuid.New()
	userID := uuid.New()
	rawToken := "reset-token-active"
	expiresAt := time.Now().UTC().Add(30 * time.Minute)

	mock.ExpectQuery(`FROM password_reset_tokens prt`).
		WithArgs(tenantID, hashToken(rawToken)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "username", "email", "status", "expires_at", "used_at"}).
			AddRow(userID, "alice", "alice@example.com", "active", expiresAt, nil))

	rec, err := repo.GetPasswordResetTokenUser(context.Background(), tenantID, rawToken)
	if err != nil {
		t.Fatalf("GetPasswordResetTokenUser() error = %v", err)
	}
	if rec.UserID != userID || rec.Username != "alice" {
		t.Fatalf("unexpected reset token user: %#v", rec)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestRotateSessionByRefreshToken_ReplayRevokesActiveFamilySessions(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewAuthRepository(db)
	input := RotateSessionInput{
		TenantID:       uuid.New(),
		CurrentRefresh: "replayed-refresh-token",
		NewRefresh:     "unused-next-refresh-token",
		AccessTokenJTI: uuid.NewString(),
		ClientIP:       "127.0.0.1",
		UserAgent:      "ua",
	}
	createdAt := time.Now().UTC().Add(-time.Hour)
	expiresAt := createdAt.Add(30 * 24 * time.Hour)
	sessionID := uuid.New()
	userID := uuid.New()
	familyID := uuid.New()
	replacedBy := uuid.NewString()

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT s.id, s.user_id, s.expires_at, s.created_at, s.session_status, s.session_family_id, s.replaced_by_session_id\s+FROM user_sessions s\s+JOIN users u`).
		WithArgs(input.TenantID, hashToken(input.CurrentRefresh)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "expires_at", "created_at", "session_status", "session_family_id", "replaced_by_session_id"}).
			AddRow(sessionID, userID, expiresAt, createdAt, "revoked", familyID, replacedBy))
	mock.ExpectExec(`UPDATE user_sessions\s+SET[\s\S]*WHERE tenant_id = \$1 AND session_family_id = \$2 AND session_status = 'active'`).
		WithArgs(input.TenantID, familyID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	_, err = repo.RotateSessionByRefreshToken(context.Background(), input)
	if !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("expected ErrInvalidRefreshToken, got %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
