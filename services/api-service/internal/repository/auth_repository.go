package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrUsernameConflict = errors.New("username conflict")
	ErrEmailConflict    = errors.New("email conflict")
)

// RegisterUserInput defines DB input for creating user and credentials.
type RegisterUserInput struct {
	TenantID     uuid.UUID
	Username     string
	Email        string
	DisplayName  string
	PasswordHash string
	PasswordCost int
}

// AuthRepository handles auth persistence.
type AuthRepository struct {
	db *sql.DB
}

func NewAuthRepository(db *sql.DB) *AuthRepository {
	return &AuthRepository{db: db}
}

func (r *AuthRepository) CheckTenantExists(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM obs.tenant WHERE id = $1 AND status = 'active')`
	var exists bool
	if err := r.db.QueryRowContext(ctx, q, tenantID).Scan(&exists); err != nil {
		return false, fmt.Errorf("query tenant exists: %w", err)
	}
	return exists, nil
}

func (r *AuthRepository) RegisterUser(ctx context.Context, input RegisterUserInput) (uuid.UUID, string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return uuid.Nil, "", fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	const insertUserSQL = `
		INSERT INTO users (tenant_id, username, email, display_name, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id, username
	`

	var userID uuid.UUID
	var username string
	if err = tx.QueryRowContext(
		ctx,
		insertUserSQL,
		input.TenantID,
		input.Username,
		input.Email,
		input.DisplayName,
	).Scan(&userID, &username); err != nil {
		return uuid.Nil, "", mapConflictError(err)
	}

	const insertCredentialSQL = `
		INSERT INTO user_credentials (
			tenant_id,
			user_id,
			password_hash,
			password_algo,
			password_cost
		)
		VALUES ($1, $2, $3, 'bcrypt', $4)
	`
	if _, err = tx.ExecContext(
		ctx,
		insertCredentialSQL,
		input.TenantID,
		userID,
		input.PasswordHash,
		input.PasswordCost,
	); err != nil {
		return uuid.Nil, "", fmt.Errorf("insert user credentials: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return uuid.Nil, "", fmt.Errorf("commit tx: %w", err)
	}

	return userID, username, nil
}

func mapConflictError(err error) error {
	var pqErr *pq.Error
	if !errors.As(err, &pqErr) {
		return fmt.Errorf("insert user: %w", err)
	}
	if pqErr.Code != "23505" {
		return fmt.Errorf("insert user: %w", err)
	}

	constraint := strings.ToLower(pqErr.Constraint)
	if strings.Contains(constraint, "username") {
		return ErrUsernameConflict
	}
	if strings.Contains(constraint, "email") {
		return ErrEmailConflict
	}
	return fmt.Errorf("insert user conflict: %w", err)
}
