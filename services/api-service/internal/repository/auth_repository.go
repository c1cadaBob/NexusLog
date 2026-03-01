package repository

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrUsernameConflict     = errors.New("username conflict")
	ErrEmailConflict        = errors.New("email conflict")
	ErrInvalidCredentials   = errors.New("invalid credentials")
	ErrSessionTokenConflict = errors.New("session token conflict")
	ErrInvalidRefreshToken  = errors.New("invalid refresh token")
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

// LoginUserRecord defines user+credential info required by login.
type LoginUserRecord struct {
	UserID       uuid.UUID
	Username     string
	Email        string
	DisplayName  string
	Status       string
	PasswordHash string
}

// CreateSessionInput defines input for creating user session.
type CreateSessionInput struct {
	TenantID       uuid.UUID
	UserID         uuid.UUID
	RefreshToken   string
	AccessTokenJTI string
	ClientIP       string
	UserAgent      string
	ExpiresAt      time.Time
}

// RotateSessionInput defines input for rotating refresh token session.
type RotateSessionInput struct {
	TenantID       uuid.UUID
	CurrentRefresh string
	NewRefresh     string
	AccessTokenJTI string
	ClientIP       string
	UserAgent      string
	ExpiresAt      time.Time
}

// LoginAttemptInput defines input for writing login attempt audit.
type LoginAttemptInput struct {
	TenantID  uuid.UUID
	UserID    *uuid.UUID
	Username  string
	Email     string
	IPAddress string
	UserAgent string
	Result    string
	Reason    string
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

func (r *AuthRepository) GetLoginUserByUsername(ctx context.Context, tenantID uuid.UUID, username string) (LoginUserRecord, error) {
	const q = `
		SELECT u.id, u.username, u.email, COALESCE(u.display_name, ''), u.status, uc.password_hash
		FROM users u
		JOIN user_credentials uc ON uc.user_id = u.id AND uc.tenant_id = u.tenant_id
		WHERE u.tenant_id = $1 AND u.username = $2
		LIMIT 1
	`

	var rec LoginUserRecord
	if err := r.db.QueryRowContext(ctx, q, tenantID, username).Scan(
		&rec.UserID,
		&rec.Username,
		&rec.Email,
		&rec.DisplayName,
		&rec.Status,
		&rec.PasswordHash,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return LoginUserRecord{}, ErrInvalidCredentials
		}
		return LoginUserRecord{}, fmt.Errorf("query login user: %w", err)
	}

	if rec.Status != "active" {
		return LoginUserRecord{}, ErrInvalidCredentials
	}
	return rec, nil
}

func (r *AuthRepository) CreateUserSession(ctx context.Context, input CreateSessionInput) error {
	const q = `
		INSERT INTO user_sessions (
			tenant_id,
			user_id,
			refresh_token_hash,
			access_token_jti,
			session_status,
			client_ip,
			user_agent,
			expires_at,
			last_seen_at
		)
		VALUES ($1, $2, $3, $4, 'active', NULLIF($5, ''), NULLIF($6, ''), $7, NOW())
	`

	refreshHash := hashToken(input.RefreshToken)
	if _, err := r.db.ExecContext(
		ctx,
		q,
		input.TenantID,
		input.UserID,
		refreshHash,
		input.AccessTokenJTI,
		input.ClientIP,
		input.UserAgent,
		input.ExpiresAt,
	); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return ErrSessionTokenConflict
		}
		return fmt.Errorf("create user session: %w", err)
	}
	return nil
}

func (r *AuthRepository) RotateSessionByRefreshToken(ctx context.Context, input RotateSessionInput) (uuid.UUID, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return uuid.Nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	const selectSessionSQL = `
		SELECT id, user_id, expires_at, session_status
		FROM user_sessions
		WHERE tenant_id = $1 AND refresh_token_hash = $2
		FOR UPDATE
	`

	var sessionID uuid.UUID
	var userID uuid.UUID
	var expiresAt time.Time
	var status string
	if err = tx.QueryRowContext(
		ctx,
		selectSessionSQL,
		input.TenantID,
		hashToken(input.CurrentRefresh),
	).Scan(&sessionID, &userID, &expiresAt, &status); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return uuid.Nil, ErrInvalidRefreshToken
		}
		return uuid.Nil, fmt.Errorf("query refresh session: %w", err)
	}

	if status != "active" || expiresAt.Before(time.Now().UTC()) {
		return uuid.Nil, ErrInvalidRefreshToken
	}

	const revokeOldSQL = `
		UPDATE user_sessions
		SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND session_status = 'active'
	`
	if _, err = tx.ExecContext(ctx, revokeOldSQL, sessionID); err != nil {
		return uuid.Nil, fmt.Errorf("revoke old session: %w", err)
	}

	const insertNewSQL = `
		INSERT INTO user_sessions (
			tenant_id,
			user_id,
			refresh_token_hash,
			access_token_jti,
			session_status,
			client_ip,
			user_agent,
			expires_at,
			last_seen_at
		)
		VALUES ($1, $2, $3, $4, 'active', NULLIF($5, ''), NULLIF($6, ''), $7, NOW())
	`
	if _, err = tx.ExecContext(
		ctx,
		insertNewSQL,
		input.TenantID,
		userID,
		hashToken(input.NewRefresh),
		input.AccessTokenJTI,
		input.ClientIP,
		input.UserAgent,
		input.ExpiresAt,
	); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return uuid.Nil, ErrSessionTokenConflict
		}
		return uuid.Nil, fmt.Errorf("insert rotated session: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return uuid.Nil, fmt.Errorf("commit tx: %w", err)
	}

	return userID, nil
}

func (r *AuthRepository) RevokeSessionByRefreshToken(ctx context.Context, tenantID uuid.UUID, refreshToken string) error {
	const q = `
		UPDATE user_sessions
		SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND refresh_token_hash = $2 AND session_status = 'active'
	`

	result, err := r.db.ExecContext(ctx, q, tenantID, hashToken(refreshToken))
	if err != nil {
		return fmt.Errorf("revoke session by refresh token: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read affected rows: %w", err)
	}
	if affected == 0 {
		return ErrInvalidRefreshToken
	}
	return nil
}

func (r *AuthRepository) RevokeActiveSessionsByUserID(ctx context.Context, tenantID, userID uuid.UUID) error {
	const q = `
		UPDATE user_sessions
		SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND user_id = $2 AND session_status = 'active'
	`
	if _, err := r.db.ExecContext(ctx, q, tenantID, userID); err != nil {
		return fmt.Errorf("revoke active sessions by user id: %w", err)
	}
	return nil
}

func (r *AuthRepository) RecordLoginAttempt(ctx context.Context, input LoginAttemptInput) error {
	const q = `
		INSERT INTO login_attempts (
			tenant_id,
			user_id,
			username,
			email,
			ip_address,
			user_agent,
			result,
			reason
		)
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), $7, NULLIF($8, ''))
	`

	var userID any
	if input.UserID != nil {
		userID = *input.UserID
	}

	if _, err := r.db.ExecContext(
		ctx,
		q,
		input.TenantID,
		userID,
		input.Username,
		input.Email,
		input.IPAddress,
		input.UserAgent,
		input.Result,
		input.Reason,
	); err != nil {
		return fmt.Errorf("record login attempt: %w", err)
	}
	return nil
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

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
