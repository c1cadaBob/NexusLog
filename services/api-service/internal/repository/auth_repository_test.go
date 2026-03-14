package repository

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

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
		ExpiresAt:      time.Now().UTC().Add(time.Hour),
	}

	mock.ExpectBegin()
	mock.ExpectQuery(`SELECT s.id, s.user_id, s.expires_at, s.session_status\s+FROM user_sessions s\s+JOIN users u`).
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
