package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

var (
	ErrRoleNotFound = errors.New("role not found")
	ErrRoleConflict = errors.New("role already assigned")
)

// UserRecord defines user row from DB.
type UserRecord struct {
	ID          uuid.UUID
	TenantID    uuid.UUID
	Username    string
	Email       string
	DisplayName sql.NullString
	Status      string
	LastLoginAt sql.NullTime
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// RoleRecord defines role row from DB.
type RoleRecord struct {
	ID          uuid.UUID
	TenantID    uuid.UUID
	Name        string
	Description sql.NullString
	Permissions []byte
}

// CreateUserInput defines input for creating user and credentials.
type CreateUserInput struct {
	TenantID     uuid.UUID
	Username     string
	Email        string
	DisplayName  string
	PasswordHash string
	PasswordCost int
}

// UpdateUserInput defines input for updating user.
type UpdateUserInput struct {
	DisplayName *string
	Email       *string
	Status      *string
}

// ListUsersFilter defines supported filters for listing users.
type ListUsersFilter struct {
	Query  string
	Status string
	RoleID *uuid.UUID
}

// UserRepository handles user persistence.
type UserRepository struct {
	db *sql.DB
}

// UserRepositoryInterface defines the user repository contract.
type UserRepositoryInterface interface {
	CheckTenantExists(ctx context.Context, tenantID uuid.UUID) (bool, error)
	ListUsers(ctx context.Context, tenantID string, page, pageSize int, filter ListUsersFilter) ([]UserRecord, int, error)
	GetUser(ctx context.Context, tenantID, userID string) (*UserRecord, error)
	CreateUser(ctx context.Context, input CreateUserInput) (string, error)
	UpdateUser(ctx context.Context, tenantID, userID string, input UpdateUserInput) error
	DisableUser(ctx context.Context, tenantID, userID string) error
	BatchUpdateUsersStatus(ctx context.Context, tenantID string, userIDs []uuid.UUID, status string) (int, error)
	AssignRole(ctx context.Context, tenantID, userID, roleID string) error
	RemoveRole(ctx context.Context, tenantID, userID, roleID string) error
	ListRoles(ctx context.Context, tenantID string) ([]RoleRecord, error)
	GetUserRoles(ctx context.Context, tenantID, userID string) ([]RoleRecord, error)
	IsLoginLocked(ctx context.Context, tenantID, username string) (bool, time.Time, error)
}

// NewUserRepository creates a new UserRepository.
func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) CheckTenantExists(ctx context.Context, tenantID uuid.UUID) (bool, error) {
	const q = `SELECT EXISTS(SELECT 1 FROM obs.tenant WHERE id = $1 AND status = 'active')`
	var exists bool
	if err := r.db.QueryRowContext(ctx, q, tenantID).Scan(&exists); err != nil {
		return false, fmt.Errorf("query tenant exists: %w", err)
	}
	return exists, nil
}

func (r *UserRepository) ListUsers(ctx context.Context, tenantID string, page, pageSize int, filter ListUsersFilter) ([]UserRecord, int, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid tenant id: %w", err)
	}

	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}

	whereClauses := []string{"u.tenant_id = $1"}
	args := []any{tenantUUID}
	argIdx := 2

	if filter.Query != "" {
		pattern := "%" + strings.ToLower(strings.TrimSpace(filter.Query)) + "%"
		whereClauses = append(whereClauses, fmt.Sprintf("(LOWER(u.username) LIKE $%d OR LOWER(u.email) LIKE $%d OR LOWER(COALESCE(u.display_name, '')) LIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, pattern)
		argIdx++
	}
	if filter.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("u.status = $%d", argIdx))
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.RoleID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND ur.role_id = $%d AND r.tenant_id = u.tenant_id)", argIdx))
		args = append(args, *filter.RoleID)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")
	countQ := fmt.Sprintf("SELECT COUNT(*) FROM users u WHERE %s", whereSQL)
	var total int
	if err := r.db.QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count users: %w", err)
	}

	listArgs := append(append([]any{}, args...), pageSize, offset)
	listQ := fmt.Sprintf(`
		SELECT u.id, u.tenant_id, u.username, u.email, u.display_name, u.status, u.last_login_at, u.created_at, u.updated_at
		FROM users u
		WHERE %s
		ORDER BY u.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)
	rows, err := r.db.QueryContext(ctx, listQ, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list users: %w", err)
	}
	defer rows.Close()

	var users []UserRecord
	for rows.Next() {
		var u UserRecord
		if err := rows.Scan(
			&u.ID,
			&u.TenantID,
			&u.Username,
			&u.Email,
			&u.DisplayName,
			&u.Status,
			&u.LastLoginAt,
			&u.CreatedAt,
			&u.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan user: %w", err)
		}
		users = append(users, u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate users: %w", err)
	}

	return users, total, nil
}

func (r *UserRepository) GetUser(ctx context.Context, tenantID, userID string) (*UserRecord, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant id: %w", err)
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	const q = `
		SELECT id, tenant_id, username, email, display_name, status, last_login_at, created_at, updated_at
		FROM users
		WHERE tenant_id = $1 AND id = $2
	`
	var u UserRecord
	if err := r.db.QueryRowContext(ctx, q, tenantUUID, userUUID).Scan(
		&u.ID,
		&u.TenantID,
		&u.Username,
		&u.Email,
		&u.DisplayName,
		&u.Status,
		&u.LastLoginAt,
		&u.CreatedAt,
		&u.UpdatedAt,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("get user: %w", err)
	}
	return &u, nil
}

func (r *UserRepository) CreateUser(ctx context.Context, input CreateUserInput) (string, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	const insertUserSQL = `
		INSERT INTO users (tenant_id, username, email, display_name, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id
	`
	var userID uuid.UUID
	if err = tx.QueryRowContext(
		ctx,
		insertUserSQL,
		input.TenantID,
		input.Username,
		input.Email,
		nullString(input.DisplayName),
	).Scan(&userID); err != nil {
		return "", mapUserConflictError(err)
	}

	const insertCredentialSQL = `
		INSERT INTO user_credentials (tenant_id, user_id, password_hash, password_algo, password_cost)
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
		return "", fmt.Errorf("insert user credentials: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return "", fmt.Errorf("commit tx: %w", err)
	}

	return userID.String(), nil
}

func (r *UserRepository) UpdateUser(ctx context.Context, tenantID, userID string, input UpdateUserInput) error {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant id: %w", err)
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}

	var set []string
	var args []any
	argIdx := 1

	if input.DisplayName != nil {
		set = append(set, fmt.Sprintf("display_name = $%d", argIdx))
		args = append(args, nullString(*input.DisplayName))
		argIdx++
	}
	if input.Email != nil {
		set = append(set, fmt.Sprintf("email = $%d", argIdx))
		args = append(args, *input.Email)
		argIdx++
	}
	if input.Status != nil {
		set = append(set, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *input.Status)
		argIdx++
	}

	if len(set) == 0 {
		return nil
	}

	set = append(set, "updated_at = NOW()")
	args = append(args, tenantUUID, userUUID)

	q := fmt.Sprintf(`
		UPDATE users
		SET %s
		WHERE tenant_id = $%d AND id = $%d
	`, strings.Join(set, ", "), argIdx, argIdx+1)

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	result, err := tx.ExecContext(ctx, q, args...)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return ErrEmailConflict
		}
		return fmt.Errorf("update user: %w", err)
	}

	affected, _ := result.RowsAffected()
	if affected == 0 {
		err = ErrUserNotFound // from auth_repository
		return err
	}

	if input.Status != nil && *input.Status == "disabled" {
		const revokeSessionsSQL = `
			UPDATE user_sessions
			SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
			WHERE tenant_id = $1 AND user_id = $2 AND session_status = 'active'
		`
		if _, err = tx.ExecContext(ctx, revokeSessionsSQL, tenantUUID, userUUID); err != nil {
			return fmt.Errorf("revoke active sessions for disabled user: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit user update: %w", err)
	}
	return nil
}

func (r *UserRepository) DisableUser(ctx context.Context, tenantID, userID string) error {
	return r.UpdateUser(ctx, tenantID, userID, UpdateUserInput{Status: ptr("disabled")})
}

func (r *UserRepository) BatchUpdateUsersStatus(ctx context.Context, tenantID string, userIDs []uuid.UUID, status string) (int, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return 0, fmt.Errorf("invalid tenant id: %w", err)
	}
	if len(userIDs) == 0 {
		return 0, nil
	}

	idStrings := make([]string, 0, len(userIDs))
	for _, userID := range userIDs {
		idStrings = append(idStrings, userID.String())
	}

	const q = `
		UPDATE users
		SET status = $1, updated_at = NOW()
		WHERE tenant_id = $2
		  AND id = ANY($3::uuid[])
		  AND status <> $1
	`
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	result, err := tx.ExecContext(ctx, q, status, tenantUUID, pq.Array(idStrings))
	if err != nil {
		return 0, fmt.Errorf("batch update users status: %w", err)
	}
	updated, _ := result.RowsAffected()

	if status == "disabled" {
		const revokeSessionsSQL = `
			UPDATE user_sessions
			SET session_status = 'revoked', revoked_at = NOW(), updated_at = NOW()
			WHERE tenant_id = $1 AND user_id = ANY($2::uuid[]) AND session_status = 'active'
		`
		if _, err = tx.ExecContext(ctx, revokeSessionsSQL, tenantUUID, pq.Array(idStrings)); err != nil {
			return 0, fmt.Errorf("revoke active sessions for disabled users: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit batch user status update: %w", err)
	}
	return int(updated), nil
}

func (r *UserRepository) AssignRole(ctx context.Context, tenantID, userID, roleID string) error {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant id: %w", err)
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}
	roleUUID, err := uuid.Parse(roleID)
	if err != nil {
		return fmt.Errorf("invalid role id: %w", err)
	}

	const q = `
		INSERT INTO user_roles (user_id, role_id)
		SELECT u.id, r.id
		FROM users u
		JOIN roles r ON r.id = $3
		WHERE u.id = $2
		  AND u.tenant_id = $1
		  AND r.tenant_id = $1
	`
	result, err := r.db.ExecContext(ctx, q, tenantUUID, userUUID, roleUUID)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) {
			if pqErr.Code == "23505" {
				return ErrRoleConflict
			}
		}
		return fmt.Errorf("assign role: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("assign role rows affected: %w", err)
	}
	if affected == 0 {
		return ErrRoleNotFound
	}
	return nil
}

func (r *UserRepository) RemoveRole(ctx context.Context, tenantID, userID, roleID string) error {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return fmt.Errorf("invalid tenant id: %w", err)
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return fmt.Errorf("invalid user id: %w", err)
	}
	roleUUID, err := uuid.Parse(roleID)
	if err != nil {
		return fmt.Errorf("invalid role id: %w", err)
	}

	const q = `
		DELETE FROM user_roles ur
		USING users u, roles r
		WHERE ur.user_id = u.id
		  AND ur.role_id = r.id
		  AND u.id = $2
		  AND r.id = $3
		  AND u.tenant_id = $1
		  AND r.tenant_id = $1
	`
	result, err := r.db.ExecContext(ctx, q, tenantUUID, userUUID, roleUUID)
	if err != nil {
		return fmt.Errorf("remove role: %w", err)
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return ErrRoleNotFound
	}
	return nil
}

func (r *UserRepository) ListRoles(ctx context.Context, tenantID string) ([]RoleRecord, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant id: %w", err)
	}

	const q = `
		SELECT id, tenant_id, name, description, permissions
		FROM roles
		WHERE tenant_id = $1
		ORDER BY name
	`
	rows, err := r.db.QueryContext(ctx, q, tenantUUID)
	if err != nil {
		return nil, fmt.Errorf("list roles: %w", err)
	}
	defer rows.Close()

	var roles []RoleRecord
	for rows.Next() {
		var ro RoleRecord
		if err := rows.Scan(&ro.ID, &ro.TenantID, &ro.Name, &ro.Description, &ro.Permissions); err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}
		roles = append(roles, ro)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate roles: %w", err)
	}
	return roles, nil
}

func (r *UserRepository) GetUserRoles(ctx context.Context, tenantID, userID string) ([]RoleRecord, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return nil, fmt.Errorf("invalid tenant id: %w", err)
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("invalid user id: %w", err)
	}

	const q = `
		SELECT r.id, r.tenant_id, r.name, r.description, r.permissions
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id
		WHERE u.tenant_id = $1
		  AND u.id = $2
		  AND r.tenant_id = u.tenant_id
		ORDER BY r.name
	`
	rows, err := r.db.QueryContext(ctx, q, tenantUUID, userUUID)
	if err != nil {
		return nil, fmt.Errorf("get user roles: %w", err)
	}
	defer rows.Close()

	var roles []RoleRecord
	for rows.Next() {
		var ro RoleRecord
		if err := rows.Scan(&ro.ID, &ro.TenantID, &ro.Name, &ro.Description, &ro.Permissions); err != nil {
			return nil, fmt.Errorf("scan role: %w", err)
		}
		roles = append(roles, ro)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate user roles: %w", err)
	}
	return roles, nil
}

// IsLoginLocked checks if username is locked due to 5 consecutive failed attempts.
// Returns (locked, lockUntil) - lockUntil is when the lock expires.
func (r *UserRepository) IsLoginLocked(ctx context.Context, tenantID, username string) (bool, time.Time, error) {
	tenantUUID, err := uuid.Parse(tenantID)
	if err != nil {
		return false, time.Time{}, fmt.Errorf("invalid tenant id: %w", err)
	}

	const q = `
		SELECT result, created_at
		FROM login_attempts
		WHERE tenant_id = $1 AND username = $2
		ORDER BY created_at DESC
		LIMIT 5
	`
	rows, err := r.db.QueryContext(ctx, q, tenantUUID, username)
	if err != nil {
		return false, time.Time{}, fmt.Errorf("query login attempts: %w", err)
	}
	defer rows.Close()

	var results []struct {
		result    string
		createdAt time.Time
	}
	for rows.Next() {
		var res string
		var at time.Time
		if err := rows.Scan(&res, &at); err != nil {
			return false, time.Time{}, fmt.Errorf("scan attempt: %w", err)
		}
		results = append(results, struct {
			result    string
			createdAt time.Time
		}{res, at})
	}
	if err := rows.Err(); err != nil {
		return false, time.Time{}, fmt.Errorf("iterate attempts: %w", err)
	}

	if len(results) < 5 {
		return false, time.Time{}, nil
	}
	for i := 0; i < 5; i++ {
		if results[i].result != "failed" {
			return false, time.Time{}, nil
		}
	}
	fifthAt := results[4].createdAt
	lockUntil := fifthAt.Add(15 * time.Minute)
	if time.Now().UTC().Before(lockUntil) {
		return true, lockUntil, nil
	}
	return false, time.Time{}, nil
}

func nullString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func ptr(s string) *string { return &s }

func mapUserConflictError(err error) error {
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
