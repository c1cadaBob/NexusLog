// Package repository 提供 query-api 的数据访问层。
package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/lib/pq"
)

var (
	// ErrNotFound 表示目标记录不存在。
	ErrNotFound = errors.New("record not found")
	// ErrConflict 表示记录冲突（通常是唯一键冲突）。
	ErrConflict = errors.New("record conflict")
	// ErrMetadataStoreNotConfigured 表示元数据仓储未配置。
	ErrMetadataStoreNotConfigured = errors.New("query metadata store is not configured")
)

// QueryHistoryCreateInput 定义写入查询历史的输入参数。
type QueryHistoryCreateInput struct {
	TenantID       string
	UserID         string
	QueryText      string
	QueryHash      string
	Filters        map[string]any
	TimeRangeStart *time.Time
	TimeRangeEnd   *time.Time
	ResultCount    int64
	DurationMS     int
	Status         string
	ErrorMessage   string
	CreatedAt      time.Time
}

// ListQueryHistoriesInput 定义查询历史列表的过滤条件。
type ListQueryHistoriesInput struct {
	TenantID       string
	UserID         string
	Keyword        string
	TimeRangeStart *time.Time
	TimeRangeEnd   *time.Time
	Page           int
	PageSize       int
}

// QueryHistoryRecord 对应查询历史列表记录。
type QueryHistoryRecord struct {
	ID          string
	QueryText   string
	CreatedAt   time.Time
	DurationMS  int
	ResultCount int64
	Status      string
}

// ListQueryHistoriesOutput 定义查询历史列表输出。
type ListQueryHistoriesOutput struct {
	Items []QueryHistoryRecord
	Total int64
}

// ListSavedQueriesInput 定义收藏查询列表过滤参数。
type ListSavedQueriesInput struct {
	TenantID string
	UserID   string
	Tag      string
	Keyword  string
	Page     int
	PageSize int
}

// SavedQueryCreateInput 定义创建收藏查询的参数。
type SavedQueryCreateInput struct {
	TenantID    string
	UserID      string
	Name        string
	Description string
	QueryText   string
	Filters     map[string]any
	Tags        []string
	Now         time.Time
}

// SavedQueryUpdateInput 定义更新收藏查询的参数。
type SavedQueryUpdateInput struct {
	TenantID     string
	UserID       string
	SavedQueryID string
	Name         *string
	Description  *string
	QueryText    *string
	Filters      *map[string]any
	Tags         *[]string
	Now          time.Time
}

// SavedQueryRecord 对应收藏查询记录。
type SavedQueryRecord struct {
	ID        string
	Name      string
	QueryText string
	Tags      []string
	RunCount  int64
	CreatedAt time.Time
	UpdatedAt time.Time
}

// ListSavedQueriesOutput 定义收藏查询列表输出。
type ListSavedQueriesOutput struct {
	Items []SavedQueryRecord
	Total int64
}

// QueryMetadataRepository 提供查询历史与收藏查询的 PG 持久化。
type QueryMetadataRepository struct {
	db *sql.DB
}

// NewQueryMetadataRepository 创建元数据仓储实例。
func NewQueryMetadataRepository(db *sql.DB) *QueryMetadataRepository {
	return &QueryMetadataRepository{db: db}
}

// IsConfigured 判断仓储是否可用。
func (r *QueryMetadataRepository) IsConfigured() bool {
	return r != nil && r.db != nil
}

// CreateQueryHistory 写入一条查询历史。
func (r *QueryMetadataRepository) CreateQueryHistory(ctx context.Context, in QueryHistoryCreateInput) error {
	if !r.IsConfigured() {
		return ErrMetadataStoreNotConfigured
	}

	filtersRaw, err := marshalJSONMap(in.Filters)
	if err != nil {
		return fmt.Errorf("marshal history filters: %w", err)
	}
	query := `
INSERT INTO query_histories (
	tenant_id,
	user_id,
	query_text,
	query_hash,
	filters,
	time_range_start,
	time_range_end,
	result_count,
	duration_ms,
	status,
	error_message,
	created_at
) VALUES (
	$1::uuid,
	$2::uuid,
	$3,
	NULLIF($4, ''),
	$5::jsonb,
	$6,
	$7,
	$8,
	$9,
	$10,
	NULLIF($11, ''),
	$12
)
`
	_, err = r.db.ExecContext(
		ctx,
		query,
		strings.TrimSpace(in.TenantID),
		nullableString(in.UserID),
		strings.TrimSpace(in.QueryText),
		strings.TrimSpace(in.QueryHash),
		filtersRaw,
		in.TimeRangeStart,
		in.TimeRangeEnd,
		in.ResultCount,
		in.DurationMS,
		normalizeHistoryStatus(in.Status),
		strings.TrimSpace(in.ErrorMessage),
		in.CreatedAt.UTC(),
	)
	if err != nil {
		return fmt.Errorf("insert query history: %w", err)
	}
	return nil
}

// ListQueryHistories 按过滤条件分页返回查询历史。
func (r *QueryMetadataRepository) ListQueryHistories(ctx context.Context, in ListQueryHistoriesInput) (ListQueryHistoriesOutput, error) {
	if !r.IsConfigured() {
		return ListQueryHistoriesOutput{}, ErrMetadataStoreNotConfigured
	}

	page := normalizePage(in.Page)
	pageSize := normalizePageSize(in.PageSize)
	keyword := strings.TrimSpace(in.Keyword)
	offset := (page - 1) * pageSize

	countQuery := `
SELECT COUNT(1)
FROM query_histories
WHERE tenant_id = $1::uuid
  AND user_id = $2::uuid
  AND ($3 = '' OR query_text ILIKE ('%' || $3 || '%'))
  AND ($4::timestamptz IS NULL OR created_at >= $4)
  AND ($5::timestamptz IS NULL OR created_at <= $5)
`
	var total int64
	if err := r.db.QueryRowContext(
		ctx,
		countQuery,
		strings.TrimSpace(in.TenantID),
		strings.TrimSpace(in.UserID),
		keyword,
		in.TimeRangeStart,
		in.TimeRangeEnd,
	).Scan(&total); err != nil {
		return ListQueryHistoriesOutput{}, fmt.Errorf("count query histories: %w", err)
	}

	listQuery := `
SELECT
	id::text,
	query_text,
	created_at,
	COALESCE(duration_ms, 0),
	COALESCE(result_count, 0),
	COALESCE(status, 'success')
FROM query_histories
WHERE tenant_id = $1::uuid
  AND user_id = $2::uuid
  AND ($3 = '' OR query_text ILIKE ('%' || $3 || '%'))
  AND ($4::timestamptz IS NULL OR created_at >= $4)
  AND ($5::timestamptz IS NULL OR created_at <= $5)
ORDER BY created_at DESC
OFFSET $6
LIMIT $7
`
	rows, err := r.db.QueryContext(
		ctx,
		listQuery,
		strings.TrimSpace(in.TenantID),
		strings.TrimSpace(in.UserID),
		keyword,
		in.TimeRangeStart,
		in.TimeRangeEnd,
		offset,
		pageSize,
	)
	if err != nil {
		return ListQueryHistoriesOutput{}, fmt.Errorf("query query histories: %w", err)
	}
	defer mustRowsClose(rows)

	items := make([]QueryHistoryRecord, 0, pageSize)
	for rows.Next() {
		var item QueryHistoryRecord
		if scanErr := rows.Scan(
			&item.ID,
			&item.QueryText,
			&item.CreatedAt,
			&item.DurationMS,
			&item.ResultCount,
			&item.Status,
		); scanErr != nil {
			return ListQueryHistoriesOutput{}, fmt.Errorf("scan query history: %w", scanErr)
		}
		item.CreatedAt = item.CreatedAt.UTC()
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return ListQueryHistoriesOutput{}, fmt.Errorf("iterate query histories: %w", err)
	}

	return ListQueryHistoriesOutput{
		Items: items,
		Total: total,
	}, nil
}

// DeleteQueryHistory 删除一条查询历史。
func (r *QueryMetadataRepository) DeleteQueryHistory(ctx context.Context, tenantID, userID, historyID string) (bool, error) {
	if !r.IsConfigured() {
		return false, ErrMetadataStoreNotConfigured
	}
	query := `
DELETE FROM query_histories
WHERE id = $1::uuid
  AND tenant_id = $2::uuid
  AND user_id = $3::uuid
`
	result, err := r.db.ExecContext(
		ctx,
		query,
		strings.TrimSpace(historyID),
		strings.TrimSpace(tenantID),
		strings.TrimSpace(userID),
	)
	if err != nil {
		return false, fmt.Errorf("delete query history: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read delete query history rows affected: %w", err)
	}
	return affected > 0, nil
}

// ListSavedQueries 按过滤条件分页返回收藏查询。
func (r *QueryMetadataRepository) ListSavedQueries(ctx context.Context, in ListSavedQueriesInput) (ListSavedQueriesOutput, error) {
	if !r.IsConfigured() {
		return ListSavedQueriesOutput{}, ErrMetadataStoreNotConfigured
	}

	page := normalizePage(in.Page)
	pageSize := normalizePageSize(in.PageSize)
	tag := strings.TrimSpace(in.Tag)
	keyword := strings.TrimSpace(in.Keyword)
	offset := (page - 1) * pageSize

	countQuery := `
SELECT COUNT(1)
FROM saved_queries sq
WHERE sq.tenant_id = $1::uuid
  AND sq.user_id = $2::uuid
  AND ($3 = '' OR EXISTS (
    SELECT 1
    FROM saved_query_tags sqt
    WHERE sqt.saved_query_id = sq.id
      AND sqt.tag = $3
  ))
  AND ($4 = '' OR sq.name ILIKE ('%' || $4 || '%') OR sq.query_text ILIKE ('%' || $4 || '%'))
`
	var total int64
	if err := r.db.QueryRowContext(
		ctx,
		countQuery,
		strings.TrimSpace(in.TenantID),
		strings.TrimSpace(in.UserID),
		tag,
		keyword,
	).Scan(&total); err != nil {
		return ListSavedQueriesOutput{}, fmt.Errorf("count saved queries: %w", err)
	}

	listQuery := `
SELECT
	sq.id::text,
	sq.name,
	sq.query_text,
	COALESCE(sq.run_count, 0),
	sq.created_at,
	sq.updated_at,
	COALESCE(array_agg(DISTINCT sqt.tag) FILTER (WHERE sqt.tag IS NOT NULL), ARRAY[]::text[])
FROM saved_queries sq
LEFT JOIN saved_query_tags sqt ON sqt.saved_query_id = sq.id
WHERE sq.tenant_id = $1::uuid
  AND sq.user_id = $2::uuid
  AND ($3 = '' OR EXISTS (
    SELECT 1
    FROM saved_query_tags tag_filter
    WHERE tag_filter.saved_query_id = sq.id
      AND tag_filter.tag = $3
  ))
  AND ($4 = '' OR sq.name ILIKE ('%' || $4 || '%') OR sq.query_text ILIKE ('%' || $4 || '%'))
GROUP BY sq.id
ORDER BY sq.updated_at DESC
OFFSET $5
LIMIT $6
`
	rows, err := r.db.QueryContext(
		ctx,
		listQuery,
		strings.TrimSpace(in.TenantID),
		strings.TrimSpace(in.UserID),
		tag,
		keyword,
		offset,
		pageSize,
	)
	if err != nil {
		return ListSavedQueriesOutput{}, fmt.Errorf("query saved queries: %w", err)
	}
	defer mustRowsClose(rows)

	items := make([]SavedQueryRecord, 0, pageSize)
	for rows.Next() {
		var item SavedQueryRecord
		var tags []string
		if scanErr := rows.Scan(
			&item.ID,
			&item.Name,
			&item.QueryText,
			&item.RunCount,
			&item.CreatedAt,
			&item.UpdatedAt,
			pq.Array(&tags),
		); scanErr != nil {
			return ListSavedQueriesOutput{}, fmt.Errorf("scan saved query: %w", scanErr)
		}
		item.CreatedAt = item.CreatedAt.UTC()
		item.UpdatedAt = item.UpdatedAt.UTC()
		item.Tags = normalizeTags(tags)
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return ListSavedQueriesOutput{}, fmt.Errorf("iterate saved queries: %w", err)
	}

	return ListSavedQueriesOutput{
		Items: items,
		Total: total,
	}, nil
}

// CreateSavedQuery 创建收藏查询并落标签。
func (r *QueryMetadataRepository) CreateSavedQuery(ctx context.Context, in SavedQueryCreateInput) (SavedQueryRecord, error) {
	if !r.IsConfigured() {
		return SavedQueryRecord{}, ErrMetadataStoreNotConfigured
	}

	filtersRaw, err := marshalJSONMap(in.Filters)
	if err != nil {
		return SavedQueryRecord{}, fmt.Errorf("marshal saved query filters: %w", err)
	}
	now := in.Now.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return SavedQueryRecord{}, fmt.Errorf("begin create saved query tx: %w", err)
	}
	defer rollbackIfNeeded(tx)

	query := `
INSERT INTO saved_queries (
	tenant_id,
	user_id,
	name,
	description,
	query_text,
	filters,
	is_public,
	run_count,
	created_at,
	updated_at
) VALUES (
	$1::uuid,
	$2::uuid,
	$3,
	NULLIF($4, ''),
	$5,
	$6::jsonb,
	false,
	0,
	$7,
	$7
)
RETURNING
	id::text,
	name,
	query_text,
	COALESCE(run_count, 0),
	created_at,
	updated_at
`

	var created SavedQueryRecord
	err = tx.QueryRowContext(
		ctx,
		query,
		strings.TrimSpace(in.TenantID),
		strings.TrimSpace(in.UserID),
		strings.TrimSpace(in.Name),
		strings.TrimSpace(in.Description),
		strings.TrimSpace(in.QueryText),
		filtersRaw,
		now,
	).Scan(
		&created.ID,
		&created.Name,
		&created.QueryText,
		&created.RunCount,
		&created.CreatedAt,
		&created.UpdatedAt,
	)
	if err != nil {
		if isUniqueViolation(err) {
			return SavedQueryRecord{}, ErrConflict
		}
		return SavedQueryRecord{}, fmt.Errorf("insert saved query: %w", err)
	}
	if err := replaceSavedQueryTags(ctx, tx, created.ID, in.Tags); err != nil {
		return SavedQueryRecord{}, err
	}
	if err := tx.Commit(); err != nil {
		return SavedQueryRecord{}, fmt.Errorf("commit create saved query tx: %w", err)
	}

	created.CreatedAt = created.CreatedAt.UTC()
	created.UpdatedAt = created.UpdatedAt.UTC()
	created.Tags = normalizeTags(in.Tags)
	return created, nil
}

// UpdateSavedQuery 更新收藏查询内容。
func (r *QueryMetadataRepository) UpdateSavedQuery(ctx context.Context, in SavedQueryUpdateInput) (SavedQueryRecord, error) {
	if !r.IsConfigured() {
		return SavedQueryRecord{}, ErrMetadataStoreNotConfigured
	}

	now := in.Now.UTC()
	if now.IsZero() {
		now = time.Now().UTC()
	}
	filtersRaw, err := marshalJSONMapPointer(in.Filters)
	if err != nil {
		return SavedQueryRecord{}, fmt.Errorf("marshal update saved query filters: %w", err)
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return SavedQueryRecord{}, fmt.Errorf("begin update saved query tx: %w", err)
	}
	defer rollbackIfNeeded(tx)

	query := `
UPDATE saved_queries
SET
	name = COALESCE($4, name),
	description = COALESCE($5, description),
	query_text = COALESCE($6, query_text),
	filters = COALESCE($7::jsonb, filters),
	updated_at = $8
WHERE id = $1::uuid
  AND tenant_id = $2::uuid
  AND user_id = $3::uuid
RETURNING
	id::text,
	name,
	query_text,
	COALESCE(run_count, 0),
	created_at,
	updated_at
`
	var updated SavedQueryRecord
	err = tx.QueryRowContext(
		ctx,
		query,
		strings.TrimSpace(in.SavedQueryID),
		strings.TrimSpace(in.TenantID),
		strings.TrimSpace(in.UserID),
		nullableStringPointer(in.Name),
		nullableStringPointer(in.Description),
		nullableStringPointer(in.QueryText),
		filtersRaw,
		now,
	).Scan(
		&updated.ID,
		&updated.Name,
		&updated.QueryText,
		&updated.RunCount,
		&updated.CreatedAt,
		&updated.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return SavedQueryRecord{}, ErrNotFound
		}
		if isUniqueViolation(err) {
			return SavedQueryRecord{}, ErrConflict
		}
		return SavedQueryRecord{}, fmt.Errorf("update saved query: %w", err)
	}

	if in.Tags != nil {
		if err := replaceSavedQueryTags(ctx, tx, updated.ID, *in.Tags); err != nil {
			return SavedQueryRecord{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return SavedQueryRecord{}, fmt.Errorf("commit update saved query tx: %w", err)
	}

	updated.CreatedAt = updated.CreatedAt.UTC()
	updated.UpdatedAt = updated.UpdatedAt.UTC()
	if in.Tags != nil {
		updated.Tags = normalizeTags(*in.Tags)
		return updated, nil
	}
	updated.Tags = r.mustListTags(ctx, updated.ID)
	return updated, nil
}

// DeleteSavedQuery 删除收藏查询。
func (r *QueryMetadataRepository) DeleteSavedQuery(ctx context.Context, tenantID, userID, savedQueryID string) (bool, error) {
	if !r.IsConfigured() {
		return false, ErrMetadataStoreNotConfigured
	}
	query := `
DELETE FROM saved_queries
WHERE id = $1::uuid
  AND tenant_id = $2::uuid
  AND user_id = $3::uuid
`
	result, err := r.db.ExecContext(
		ctx,
		query,
		strings.TrimSpace(savedQueryID),
		strings.TrimSpace(tenantID),
		strings.TrimSpace(userID),
	)
	if err != nil {
		return false, fmt.Errorf("delete saved query: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("read delete saved query rows affected: %w", err)
	}
	return affected > 0, nil
}

func (r *QueryMetadataRepository) mustListTags(ctx context.Context, savedQueryID string) []string {
	if !r.IsConfigured() {
		return []string{}
	}
	query := `
SELECT tag
FROM saved_query_tags
WHERE saved_query_id = $1::uuid
ORDER BY tag ASC
`
	rows, err := r.db.QueryContext(ctx, query, strings.TrimSpace(savedQueryID))
	if err != nil {
		return []string{}
	}
	defer mustRowsClose(rows)

	tags := make([]string, 0, 4)
	for rows.Next() {
		var tag string
		if scanErr := rows.Scan(&tag); scanErr != nil {
			continue
		}
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		tags = append(tags, tag)
	}
	return normalizeTags(tags)
}

func replaceSavedQueryTags(ctx context.Context, tx *sql.Tx, savedQueryID string, tags []string) error {
	deleteQuery := `DELETE FROM saved_query_tags WHERE saved_query_id = $1::uuid`
	if _, err := tx.ExecContext(ctx, deleteQuery, strings.TrimSpace(savedQueryID)); err != nil {
		return fmt.Errorf("delete saved query tags: %w", err)
	}

	cleanTags := normalizeTags(tags)
	if len(cleanTags) == 0 {
		return nil
	}

	insertQuery := `
INSERT INTO saved_query_tags (saved_query_id, tag, created_at)
VALUES ($1::uuid, $2, $3)
ON CONFLICT (saved_query_id, tag) DO NOTHING
`
	now := time.Now().UTC()
	for _, tag := range cleanTags {
		if _, err := tx.ExecContext(ctx, insertQuery, strings.TrimSpace(savedQueryID), tag, now); err != nil {
			return fmt.Errorf("insert saved query tag: %w", err)
		}
	}
	return nil
}

func normalizeHistoryStatus(raw string) string {
	status := strings.ToLower(strings.TrimSpace(raw))
	switch status {
	case "success", "failed", "timeout", "canceled":
		return status
	default:
		return "success"
	}
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

func normalizeTags(rawTags []string) []string {
	seen := make(map[string]struct{}, len(rawTags))
	items := make([]string, 0, len(rawTags))
	for _, raw := range rawTags {
		tag := strings.TrimSpace(raw)
		if tag == "" {
			continue
		}
		if len(tag) > 64 {
			tag = tag[:64]
		}
		if _, ok := seen[tag]; ok {
			continue
		}
		seen[tag] = struct{}{}
		items = append(items, tag)
	}
	sort.Strings(items)
	return items
}

func marshalJSONMap(input map[string]any) ([]byte, error) {
	if len(input) == 0 {
		return []byte("{}"), nil
	}
	return json.Marshal(input)
}

func marshalJSONMapPointer(input *map[string]any) ([]byte, error) {
	if input == nil {
		return nil, nil
	}
	return marshalJSONMap(*input)
}

func nullableString(raw string) any {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	return raw
}

func nullableStringPointer(raw *string) any {
	if raw == nil {
		return nil
	}
	return nullableString(*raw)
}

func rollbackIfNeeded(tx *sql.Tx) {
	if tx == nil {
		return
	}
	_ = tx.Rollback()
}

func mustRowsClose(rows *sql.Rows) {
	if rows == nil {
		return
	}
	_ = rows.Close()
}

func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}
