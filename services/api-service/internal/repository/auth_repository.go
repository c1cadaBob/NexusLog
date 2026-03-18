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
	ErrInvalidResetToken    = errors.New("invalid reset token")
	ErrUserNotFound         = errors.New("user not found")
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

// UserIdentityRecord defines generic user identity fields.
type UserIdentityRecord struct {
	UserID   uuid.UUID
	Username string
	Email    string
	Status   string
}

// ReservedSubjectPolicyRecord defines reserved-subject governance facts.
type ReservedSubjectPolicyRecord struct {
	Reserved                bool
	InteractiveLoginAllowed bool
	SystemSubject           bool
	BreakGlassAllowed       bool
	ManagedBy               string
	Found                   bool
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

func (r *AuthRepository) LookupReservedUsernamePolicyWithAvailability(ctx context.Context, tenantID uuid.UUID, username string) (ReservedSubjectPolicyRecord, bool, error) {
	if r == nil || r.db == nil || tenantID == uuid.Nil {
		return ReservedSubjectPolicyRecord{}, false, nil
	}
	normalizedUsername := strings.TrimSpace(username)
	if normalizedUsername == "" {
		return ReservedSubjectPolicyRecord{}, true, nil
	}
	const q = `
		SELECT reserved, interactive_login_allowed, system_subject, break_glass_allowed, COALESCE(managed_by, '')
		FROM subject_reserved_policy
		WHERE tenant_id = $1
		  AND subject_type = 'username'
		  AND LOWER(subject_ref) = LOWER($2)
		LIMIT 1
	`

	var rec ReservedSubjectPolicyRecord
	if err := r.db.QueryRowContext(ctx, q, tenantID, normalizedUsername).Scan(
		&rec.Reserved,
		&rec.InteractiveLoginAllowed,
		&rec.SystemSubject,
		&rec.BreakGlassAllowed,
		&rec.ManagedBy,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return ReservedSubjectPolicyRecord{}, true, nil
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "42P01" {
			return ReservedSubjectPolicyRecord{}, false, nil
		}
		return ReservedSubjectPolicyRecord{}, false, fmt.Errorf("query reserved subject policy: %w", err)
	}

	rec.Found = true
	return rec, true, nil
}

func (r *AuthRepository) LookupReservedUsernamePolicy(ctx context.Context, tenantID uuid.UUID, username string) (ReservedSubjectPolicyRecord, error) {
	rec, _, err := r.LookupReservedUsernamePolicyWithAvailability(ctx, tenantID, username)
	return rec, err
}

func (r *AuthRepository) GetReservedSubjectPolicy(ctx context.Context, tenantID uuid.UUID, username string) (ReservedSubjectPolicyRecord, error) {
	normalizedUsername := strings.ToLower(strings.TrimSpace(username))
	if normalizedUsername != "sys-superadmin" && normalizedUsername != "system-automation" {
		return ReservedSubjectPolicyRecord{}, nil
	}
	return r.LookupReservedUsernamePolicy(ctx, tenantID, normalizedUsername)
}

func (r *AuthRepository) FindUserByEmailOrUsername(ctx context.Context, tenantID uuid.UUID, identifier string) (UserIdentityRecord, error) {
	const q = `
		SELECT id, username, email, status
		FROM users
		WHERE tenant_id = $1
		  AND (username = $2 OR LOWER(email) = LOWER($2))
		ORDER BY created_at DESC
		LIMIT 1
	`

	var rec UserIdentityRecord
	if err := r.db.QueryRowContext(ctx, q, tenantID, identifier).Scan(
		&rec.UserID,
		&rec.Username,
		&rec.Email,
		&rec.Status,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return UserIdentityRecord{}, ErrUserNotFound
		}
		return UserIdentityRecord{}, fmt.Errorf("find user by email or username: %w", err)
	}
	if rec.Status != "active" {
		return UserIdentityRecord{}, ErrUserNotFound
	}
	return rec, nil
}

func (r *AuthRepository) GetRefreshTokenUser(ctx context.Context, tenantID uuid.UUID, refreshToken string) (UserIdentityRecord, error) {
	const q = `
		SELECT u.id, u.username, u.email, u.status
		FROM user_sessions s
		JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
		WHERE s.tenant_id = $1
		  AND s.refresh_token_hash = $2
		  AND s.session_status = 'active'
		  AND s.expires_at > $3
		  AND u.status = 'active'
		ORDER BY s.updated_at DESC
		LIMIT 1
	`

	var rec UserIdentityRecord
	if err := r.db.QueryRowContext(ctx, q, tenantID, hashToken(refreshToken), time.Now().UTC()).Scan(
		&rec.UserID,
		&rec.Username,
		&rec.Email,
		&rec.Status,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return UserIdentityRecord{}, ErrInvalidRefreshToken
		}
		return UserIdentityRecord{}, fmt.Errorf("query refresh token user: %w", err)
	}
	if rec.Status != "active" {
		return UserIdentityRecord{}, ErrInvalidRefreshToken
	}
	return rec, nil
}

func (r *AuthRepository) GetPasswordResetTokenUser(ctx context.Context, tenantID uuid.UUID, rawToken string) (UserIdentityRecord, error) {
	const q = `
		SELECT u.id, u.username, u.email, u.status, prt.expires_at, prt.used_at
		FROM password_reset_tokens prt
		JOIN users u ON u.id = prt.user_id AND u.tenant_id = prt.tenant_id
		WHERE prt.tenant_id = $1
		  AND prt.token_hash = $2
		LIMIT 1
	`

	var rec UserIdentityRecord
	var expiresAt time.Time
	var usedAt sql.NullTime
	if err := r.db.QueryRowContext(ctx, q, tenantID, hashToken(rawToken)).Scan(
		&rec.UserID,
		&rec.Username,
		&rec.Email,
		&rec.Status,
		&expiresAt,
		&usedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return UserIdentityRecord{}, ErrInvalidResetToken
		}
		return UserIdentityRecord{}, fmt.Errorf("query password reset token user: %w", err)
	}
	if rec.Status != "active" || usedAt.Valid || !expiresAt.After(time.Now().UTC()) {
		return UserIdentityRecord{}, ErrInvalidResetToken
	}
	return rec, nil
}

func (r *AuthRepository) CreatePasswordResetToken(
	ctx context.Context,
	tenantID, userID uuid.UUID,
	rawToken string,
	expiresAt time.Time,
	requestedIP, userAgent string,
) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	tokenHash := hashToken(rawToken)

	const insertTokenSQL = `
		INSERT INTO password_reset_tokens (
			tenant_id,
			user_id,
			token_hash,
			expires_at,
			requested_ip,
			user_agent
		)
		VALUES ($1, $2, $3, $4, NULLIF($5, '')::inet, NULLIF($6, ''))
	`
	if _, err = tx.ExecContext(
		ctx,
		insertTokenSQL,
		tenantID,
		userID,
		tokenHash,
		expiresAt,
		requestedIP,
		userAgent,
	); err != nil {
		return fmt.Errorf("create password reset token: %w", err)
	}

	const invalidateOtherTokensSQL = `
		UPDATE password_reset_tokens
		SET used_at = NOW()
		WHERE tenant_id = $1
		  AND user_id = $2
		  AND used_at IS NULL
		  AND token_hash <> $3
	`
	if _, err = tx.ExecContext(ctx, invalidateOtherTokensSQL, tenantID, userID, tokenHash); err != nil {
		return fmt.Errorf("invalidate prior password reset tokens: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

func (r *AuthRepository) ConfirmPasswordReset(
	ctx context.Context,
	tenantID uuid.UUID,
	rawToken string,
	passwordHash string,
	passwordCost int,
) (uuid.UUID, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return uuid.Nil, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	const selectResetTokenSQL = `
		SELECT user_id, expires_at, used_at
		FROM password_reset_tokens
		WHERE tenant_id = $1 AND token_hash = $2
		FOR UPDATE
	`

	var userID uuid.UUID
	var expiresAt time.Time
	var usedAt sql.NullTime
	if err = tx.QueryRowContext(
		ctx,
		selectResetTokenSQL,
		tenantID,
		hashToken(rawToken),
	).Scan(&userID, &expiresAt, &usedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return uuid.Nil, ErrInvalidResetToken
		}
		return uuid.Nil, fmt.Errorf("query password reset token: %w", err)
	}

	now := time.Now().UTC()
	if usedAt.Valid || !expiresAt.After(now) {
		return uuid.Nil, ErrInvalidResetToken
	}

	const updateCredentialSQL = `
		UPDATE user_credentials
		SET
			password_hash = $3,
			password_algo = 'bcrypt',
			password_cost = $4,
			password_updated_at = NOW(),
			updated_at = NOW()
		WHERE tenant_id = $1 AND user_id = $2
	`
	updateResult, err := tx.ExecContext(
		ctx,
		updateCredentialSQL,
		tenantID,
		userID,
		passwordHash,
		passwordCost,
	)
	if err != nil {
		return uuid.Nil, fmt.Errorf("update user credentials password: %w", err)
	}

	updatedRows, err := updateResult.RowsAffected()
	if err != nil {
		return uuid.Nil, fmt.Errorf("read updated credentials rows: %w", err)
	}
	if updatedRows == 0 {
		return uuid.Nil, fmt.Errorf("update user credentials password: no row updated")
	}

	const invalidateOutstandingTokensSQL = `
		UPDATE password_reset_tokens
		SET used_at = NOW()
		WHERE tenant_id = $1
		  AND user_id = $2
		  AND used_at IS NULL
	`
	if _, err = tx.ExecContext(ctx, invalidateOutstandingTokensSQL, tenantID, userID); err != nil {
		return uuid.Nil, fmt.Errorf("invalidate outstanding password reset tokens: %w", err)
	}

	const revokeSessionsSQL = `
		UPDATE user_sessions
		SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND user_id = $2 AND session_status = 'active'
	`
	if _, err = tx.ExecContext(ctx, revokeSessionsSQL, tenantID, userID); err != nil {
		return uuid.Nil, fmt.Errorf("revoke active sessions after password reset: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return uuid.Nil, fmt.Errorf("commit tx: %w", err)
	}

	return userID, nil
}

func (r *AuthRepository) CreateUserSession(ctx context.Context, input CreateSessionInput) error {
	// client_ip 列类型为 INET，NULLIF 返回 text，需显式转换为 inet。
	const q = `
		INSERT INTO user_sessions (
			id,
			tenant_id,
			user_id,
			refresh_token_hash,
			access_token_jti,
			session_family_id,
			session_status,
			client_ip,
			user_agent,
			expires_at,
			last_seen_at
		)
		VALUES ($1, $2, $3, $4, $5, $1, 'active', NULLIF($6, '')::inet, NULLIF($7, ''), $8, NOW())
	`

	refreshHash := hashToken(input.RefreshToken)
	sessionID := uuid.New()
	if _, err := r.db.ExecContext(
		ctx,
		q,
		sessionID,
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
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback()
		}
	}()

	const selectSessionSQL = `
		SELECT s.id, s.user_id, s.expires_at, s.created_at, s.session_status, s.session_family_id, s.replaced_by_session_id
		FROM user_sessions s
		JOIN users u ON u.id = s.user_id AND u.tenant_id = s.tenant_id
		WHERE s.tenant_id = $1 AND s.refresh_token_hash = $2 AND u.status = 'active'
		FOR UPDATE OF s
	`

	var sessionID uuid.UUID
	var userID uuid.UUID
	var expiresAt time.Time
	var createdAt time.Time
	var status string
	var familyID uuid.UUID
	var replacedBySessionID sql.NullString
	if err = tx.QueryRowContext(
		ctx,
		selectSessionSQL,
		input.TenantID,
		hashToken(input.CurrentRefresh),
	).Scan(&sessionID, &userID, &expiresAt, &createdAt, &status, &familyID, &replacedBySessionID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return uuid.Nil, ErrInvalidRefreshToken
		}
		return uuid.Nil, fmt.Errorf("query refresh session: %w", err)
	}

	now := time.Now().UTC()
	if status != "active" || expiresAt.Before(now) {
		if status == "revoked" && replacedBySessionID.Valid {
			if revokeErr := revokeActiveSessionFamily(ctx, tx, input.TenantID, familyID); revokeErr != nil {
				return uuid.Nil, revokeErr
			}
			if err = tx.Commit(); err != nil {
				return uuid.Nil, fmt.Errorf("commit replay revocation: %w", err)
			}
			committed = true
		}
		return uuid.Nil, ErrInvalidRefreshToken
	}

	sessionTTL, ttlErr := deriveSessionTTL(createdAt, expiresAt)
	if ttlErr != nil {
		return uuid.Nil, fmt.Errorf("derive session ttl: %w", ttlErr)
	}
	newExpiresAt := now.Add(sessionTTL)
	newSessionID := uuid.New()

	const insertNewSQL = `
		INSERT INTO user_sessions (
			id,
			tenant_id,
			user_id,
			refresh_token_hash,
			access_token_jti,
			session_family_id,
			session_status,
			client_ip,
			user_agent,
			expires_at,
			last_seen_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, 'active', NULLIF($7, '')::inet, NULLIF($8, ''), $9, NOW())
	`
	if _, err = tx.ExecContext(
		ctx,
		insertNewSQL,
		newSessionID,
		input.TenantID,
		userID,
		hashToken(input.NewRefresh),
		input.AccessTokenJTI,
		familyID,
		input.ClientIP,
		input.UserAgent,
		newExpiresAt,
	); err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return uuid.Nil, ErrSessionTokenConflict
		}
		return uuid.Nil, fmt.Errorf("insert rotated session: %w", err)
	}

	const revokeOldSQL = `
		UPDATE user_sessions
		SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW(), replaced_by_session_id = $2
		WHERE id = $1 AND session_status = 'active'
	`
	if _, err = tx.ExecContext(ctx, revokeOldSQL, sessionID, newSessionID); err != nil {
		return uuid.Nil, fmt.Errorf("revoke old session: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return uuid.Nil, fmt.Errorf("commit tx: %w", err)
	}
	committed = true

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

func (r *AuthRepository) IsLoginLocked(ctx context.Context, tenantID uuid.UUID, username string) (bool, time.Time, error) {
	const q = `
		SELECT result, created_at
		FROM login_attempts
		WHERE tenant_id = $1 AND username = $2
		ORDER BY created_at DESC
		LIMIT 5
	`
	rows, err := r.db.QueryContext(ctx, q, tenantID, username)
	if err != nil {
		return false, time.Time{}, fmt.Errorf("query login attempts: %w", err)
	}
	defer rows.Close()

	var results []struct {
		result string
		at     time.Time
	}
	for rows.Next() {
		var result string
		var at time.Time
		if err := rows.Scan(&result, &at); err != nil {
			return false, time.Time{}, fmt.Errorf("scan login attempt: %w", err)
		}
		results = append(results, struct {
			result string
			at     time.Time
		}{result: result, at: at})
	}
	if err := rows.Err(); err != nil {
		return false, time.Time{}, fmt.Errorf("iterate login attempts: %w", err)
	}
	if len(results) < 5 {
		return false, time.Time{}, nil
	}
	for i := 0; i < 5; i++ {
		if results[i].result != "failed" {
			return false, time.Time{}, nil
		}
	}
	lockUntil := results[4].at.Add(15 * time.Minute)
	if time.Now().UTC().Before(lockUntil) {
		return true, lockUntil, nil
	}
	return false, time.Time{}, nil
}

func (r *AuthRepository) RecordLoginAttempt(ctx context.Context, input LoginAttemptInput) error {
	// ip_address 列类型为 INET，NULLIF 返回 text，需显式转换为 inet。
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
		VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, '')::inet, NULLIF($6, ''), $7, NULLIF($8, ''))
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

func deriveSessionTTL(createdAt, expiresAt time.Time) (time.Duration, error) {
	ttl := expiresAt.Sub(createdAt)
	if ttl <= 0 {
		return 0, fmt.Errorf("session ttl must be positive")
	}
	return ttl, nil
}

func revokeActiveSessionFamily(ctx context.Context, tx *sql.Tx, tenantID, familyID uuid.UUID) error {
	const q = `
		UPDATE user_sessions
		SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
		WHERE tenant_id = $1 AND session_family_id = $2 AND session_status = 'active'
	`
	if _, err := tx.ExecContext(ctx, q, tenantID, familyID); err != nil {
		return fmt.Errorf("revoke replayed session family: %w", err)
	}
	return nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
