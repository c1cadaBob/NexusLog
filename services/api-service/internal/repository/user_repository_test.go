package repository

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/google/uuid"
)

func TestUpdateUser_DisableRevokesSessions(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewUserRepository(db)
	tenantID := uuid.New()
	userID := uuid.New()

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE users`).
		WithArgs("disabled", tenantID, userID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec(`UPDATE user_sessions`).
		WithArgs(tenantID, userID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := repo.UpdateUser(context.Background(), tenantID.String(), userID.String(), UpdateUserInput{Status: ptr("disabled")}); err != nil {
		t.Fatalf("UpdateUser returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateUser_EmailChangeDoesNotRevokeSessions(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewUserRepository(db)
	tenantID := uuid.New()
	userID := uuid.New()
	email := "updated@example.com"

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE users`).
		WithArgs(email, tenantID, userID).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := repo.UpdateUser(context.Background(), tenantID.String(), userID.String(), UpdateUserInput{Email: &email}); err != nil {
		t.Fatalf("UpdateUser returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestBatchUpdateUsersStatus_DisableRevokesSessions(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewUserRepository(db)
	tenantID := uuid.New()
	userIDs := []uuid.UUID{uuid.New(), uuid.New()}

	mock.ExpectBegin()
	mock.ExpectExec(`UPDATE users`).
		WithArgs("disabled", tenantID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectExec(`UPDATE user_sessions`).
		WithArgs(tenantID, sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 2))
	mock.ExpectCommit()

	updated, err := repo.BatchUpdateUsersStatus(context.Background(), tenantID.String(), userIDs, "disabled")
	if err != nil {
		t.Fatalf("BatchUpdateUsersStatus returned error: %v", err)
	}
	if updated != 2 {
		t.Fatalf("updated=%d, want 2", updated)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
