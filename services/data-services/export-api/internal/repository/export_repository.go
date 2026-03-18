// Package repository 提供 export-api 的数据访问层
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

var uuidRegex = regexp.MustCompile(`^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$`)

var (
	ErrExportNotFound        = errors.New("export job not found")
	ErrTenantContextRequired = errors.New("tenant context is required")
)

// ExportJob 表示导出任务记录
type ExportJob struct {
	ID            string
	TenantID      string
	QueryParams   map[string]any
	Format        string
	Status        string
	TotalRecords  *int
	FilePath      *string
	FileSizeBytes *int64
	ErrorMessage  *string
	CreatedBy     *string
	CreatedAt     time.Time
	CompletedAt   *time.Time
	ExpiresAt     *time.Time
}

// CreateJobInput 创建导出任务的输入
type CreateJobInput struct {
	TenantID    string
	QueryParams map[string]any
	Format      string
	CreatedBy   string
}

// ExportRepository 提供 export_jobs 表的持久化
type ExportRepository struct {
	db *sql.DB
}

// NewExportRepository 创建导出仓储实例
func NewExportRepository(db *sql.DB) *ExportRepository {
	return &ExportRepository{db: db}
}

// IsConfigured 判断仓储是否可用
func (r *ExportRepository) IsConfigured() bool {
	return r != nil && r.db != nil
}

// CreateJob 创建导出任务，返回 job ID
func (r *ExportRepository) CreateJob(ctx context.Context, in CreateJobInput) (string, error) {
	if !r.IsConfigured() {
		return "", fmt.Errorf("export repository is not configured")
	}
	tenantID, err := normalizeRequiredUUID(in.TenantID, ErrTenantContextRequired)
	if err != nil {
		return "", err
	}
	createdBy, err := normalizeOptionalUUID(in.CreatedBy, "created_by")
	if err != nil {
		return "", err
	}
	paramsRaw, err := json.Marshal(in.QueryParams)
	if err != nil {
		return "", fmt.Errorf("marshal query params: %w", err)
	}
	query := `
INSERT INTO export_jobs (tenant_id, query_params, format, status, created_by)
VALUES ($1::uuid, $2::jsonb, $3, 'pending', NULLIF($4, '')::uuid)
RETURNING id::text
`
	var jobID string
	err = r.db.QueryRowContext(ctx, query,
		tenantID,
		paramsRaw,
		strings.TrimSpace(in.Format),
		createdBy,
	).Scan(&jobID)
	if err != nil {
		return "", fmt.Errorf("insert export job: %w", err)
	}
	return jobID, nil
}

// GetJob 按租户和任务 ID 获取导出任务
func (r *ExportRepository) GetJob(ctx context.Context, tenantID, jobID, ownerUserID string) (*ExportJob, error) {
	if !r.IsConfigured() {
		return nil, ErrExportNotFound
	}
	normalizedTenantID, err := normalizeRequiredUUID(tenantID, ErrTenantContextRequired)
	if err != nil {
		return nil, err
	}
	normalizedJobID, err := normalizeLookupUUID(jobID, ErrExportNotFound)
	if err != nil {
		return nil, err
	}
	ownerClause, ownerArgs, err := buildCreatedByOwnershipClause(3, ownerUserID)
	if err != nil {
		return nil, err
	}
	query := `
SELECT
	id::text,
	tenant_id::text,
	query_params,
	format,
	status,
	total_records,
	file_path,
	file_size_bytes,
	error_message,
	created_by::text,
	created_at,
	completed_at,
	expires_at
FROM export_jobs
WHERE id = $1::uuid AND tenant_id = $2::uuid` + ownerClause + `
`
	var job ExportJob
	var paramsRaw []byte
	var tenantIDOut sql.NullString
	args := append([]any{normalizedJobID, normalizedTenantID}, ownerArgs...)
	err = r.db.QueryRowContext(ctx, query, args...).Scan(
		&job.ID,
		&tenantIDOut,
		&paramsRaw,
		&job.Format,
		&job.Status,
		&job.TotalRecords,
		&job.FilePath,
		&job.FileSizeBytes,
		&job.ErrorMessage,
		&job.CreatedBy,
		&job.CreatedAt,
		&job.CompletedAt,
		&job.ExpiresAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrExportNotFound
		}
		return nil, fmt.Errorf("get export job: %w", err)
	}
	if tenantIDOut.Valid {
		job.TenantID = tenantIDOut.String
	}
	if len(paramsRaw) > 0 {
		_ = json.Unmarshal(paramsRaw, &job.QueryParams)
	}
	if job.QueryParams == nil {
		job.QueryParams = map[string]any{}
	}
	job.CreatedAt = job.CreatedAt.UTC()
	return &job, nil
}

// ListJobs 分页列出导出任务
func (r *ExportRepository) ListJobs(ctx context.Context, tenantID string, page, pageSize int, ownerUserID string) ([]ExportJob, int64, error) {
	if !r.IsConfigured() {
		return nil, 0, fmt.Errorf("export repository is not configured")
	}
	normalizedTenantID, err := normalizeRequiredUUID(tenantID, ErrTenantContextRequired)
	if err != nil {
		return nil, 0, err
	}
	page = normalizePage(page)
	pageSize = normalizePageSize(pageSize)
	offset := (page - 1) * pageSize

	ownerClause, ownerArgs, err := buildCreatedByOwnershipClause(2, ownerUserID)
	if err != nil {
		return nil, 0, err
	}
	countQuery := `SELECT COUNT(1) FROM export_jobs WHERE tenant_id = $1::uuid` + ownerClause
	countArgs := append([]any{normalizedTenantID}, ownerArgs...)
	var total int64
	if err := r.db.QueryRowContext(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count export jobs: %w", err)
	}

	listQuery := `
SELECT
	id::text,
	tenant_id::text,
	query_params,
	format,
	status,
	total_records,
	file_path,
	file_size_bytes,
	error_message,
	created_by::text,
	created_at,
	completed_at,
	expires_at
FROM export_jobs
WHERE tenant_id = $1::uuid` + ownerClause + `
ORDER BY created_at DESC
OFFSET $` + fmt.Sprintf("%d", len(ownerArgs)+2) + ` LIMIT $` + fmt.Sprintf("%d", len(ownerArgs)+3) + `
`
	listArgs := append(append([]any{normalizedTenantID}, ownerArgs...), offset, pageSize)
	rows, err := r.db.QueryContext(ctx, listQuery, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list export jobs: %w", err)
	}
	defer rows.Close()

	items := make([]ExportJob, 0, pageSize)
	for rows.Next() {
		var job ExportJob
		var paramsRaw []byte
		var tenantIDOut sql.NullString
		if err := rows.Scan(
			&job.ID,
			&tenantIDOut,
			&paramsRaw,
			&job.Format,
			&job.Status,
			&job.TotalRecords,
			&job.FilePath,
			&job.FileSizeBytes,
			&job.ErrorMessage,
			&job.CreatedBy,
			&job.CreatedAt,
			&job.CompletedAt,
			&job.ExpiresAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan export job: %w", err)
		}
		if tenantIDOut.Valid {
			job.TenantID = tenantIDOut.String
		}
		if len(paramsRaw) > 0 {
			_ = json.Unmarshal(paramsRaw, &job.QueryParams)
		}
		if job.QueryParams == nil {
			job.QueryParams = map[string]any{}
		}
		job.CreatedAt = job.CreatedAt.UTC()
		items = append(items, job)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate export jobs: %w", err)
	}
	return items, total, nil
}

// UpdateJobStatus 更新任务状态及结果信息
func (r *ExportRepository) UpdateJobStatus(ctx context.Context, jobID string, status string, filePath *string, totalRecords *int, fileSizeBytes *int64, errMsg *string) error {
	if !r.IsConfigured() {
		return fmt.Errorf("export repository is not configured")
	}
	now := time.Now().UTC()
	query := `
UPDATE export_jobs
SET status = $2,
	total_records = COALESCE($3, total_records),
	file_path = COALESCE($4, file_path),
	file_size_bytes = COALESCE($5, file_size_bytes),
	error_message = $6,
	completed_at = CASE WHEN $2 IN ('completed', 'failed') THEN $7 ELSE completed_at END,
	expires_at = CASE WHEN $2 = 'completed' THEN $7 + INTERVAL '7 days' ELSE expires_at END
WHERE id = $1::uuid
`
	_, err := r.db.ExecContext(ctx, query,
		strings.TrimSpace(jobID),
		strings.TrimSpace(status),
		totalRecords,
		filePath,
		fileSizeBytes,
		errMsg,
		now,
	)
	if err != nil {
		return fmt.Errorf("update export job status: %w", err)
	}
	return nil
}

// CleanupExpiredJobs 删除过期任务记录，返回删除数量
func (r *ExportRepository) CleanupExpiredJobs(ctx context.Context) (int64, error) {
	if !r.IsConfigured() {
		return 0, nil
	}
	query := `DELETE FROM export_jobs WHERE expires_at IS NOT NULL AND expires_at < NOW()`
	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, fmt.Errorf("cleanup expired export jobs: %w", err)
	}
	return result.RowsAffected()
}

func normalizeRequiredUUID(raw string, errOnInvalid error) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || !uuidRegex.MatchString(raw) {
		return "", errOnInvalid
	}
	return strings.ToLower(raw), nil
}

func normalizeOptionalUUID(raw, field string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", nil
	}
	if !uuidRegex.MatchString(raw) {
		return "", fmt.Errorf("%s is invalid", strings.TrimSpace(field))
	}
	return strings.ToLower(raw), nil
}

func normalizeLookupUUID(raw string, errOnInvalid error) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" || !uuidRegex.MatchString(raw) {
		return "", errOnInvalid
	}
	return strings.ToLower(raw), nil
}

func buildCreatedByOwnershipClause(startParam int, ownerUserID string) (string, []any, error) {
	normalizedOwnerUserID, err := normalizeOptionalUUID(ownerUserID, "created_by")
	if err != nil {
		return "", nil, err
	}
	if normalizedOwnerUserID == "" {
		return "", nil, nil
	}
	return fmt.Sprintf(" AND created_by = $%d::uuid", startParam), []any{normalizedOwnerUserID}, nil
}

func normalizePage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

func normalizePageSize(pageSize int) int {
	switch {
	case pageSize <= 0:
		return 20
	case pageSize > 200:
		return 200
	default:
		return pageSize
	}
}
