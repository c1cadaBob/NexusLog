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
	mock.ExpectQuery(`SELECT s.id, s.user_id, s.expires_at, s.created_at, s.session_status\s+FROM user_sessions s\s+JOIN users u`).
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

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT s.id, s.user_id, s.expires_at, s.created_at, s.session_status\s+FROM user_sessions s\s+JOIN users u`).
		WithArgs(input.TenantID, hashToken(input.CurrentRefresh)).
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "expires_at", "created_at", "session_status"}).
			AddRow(sessionID, userID, expiresAt, createdAt, "active"))
	mock.ExpectExec(`UPDATE user_sessions\s+SET session_status = 'revoked'`).
		WithArgs(sessionID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`INSERT INTO user_sessions`).
		WithArgs(
			input.TenantID,
			userID,
			hashToken(input.NewRefresh),
			input.AccessTokenJTI,
			input.ClientIP,
			input.UserAgent,
			timeBetweenMatcher{min: lowerBound, max: upperBound},
		).
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
