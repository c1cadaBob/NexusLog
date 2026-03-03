package ingest

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/lib/pq"
)

const (
	// DefaultTenantID 用于开发环境兜底租户。
	DefaultTenantID = "00000000-0000-0000-0000-000000000001"
)

// PGOptions 定义 PG 后端选项。
type PGOptions struct {
	DefaultTenantID string
}

// PGBackend 封装 ingest 的 PostgreSQL 依赖与公共工具。
type PGBackend struct {
	db              *sql.DB
	defaultTenantID string
}

// NewPGBackend 创建 ingest PG 后端。
func NewPGBackend(db *sql.DB, opts PGOptions) *PGBackend {
	tenantID := strings.TrimSpace(opts.DefaultTenantID)
	if tenantID == "" {
		tenantID = strings.TrimSpace(os.Getenv("INGEST_DEFAULT_TENANT_ID"))
	}
	if tenantID == "" {
		tenantID = DefaultTenantID
	}
	return &PGBackend{
		db:              db,
		defaultTenantID: tenantID,
	}
}

// DB 返回底层数据库句柄。
func (b *PGBackend) DB() *sql.DB {
	return b.db
}

// Now 返回统一 UTC 时间戳。
func (b *PGBackend) Now() time.Time {
	return time.Now().UTC()
}

// ResolveTenantID 解析写入所需租户 ID。
func (b *PGBackend) ResolveTenantID(ctx context.Context) string {
	if b == nil {
		return DefaultTenantID
	}
	tenantID := strings.TrimSpace(b.defaultTenantID)
	if tenantID == "" {
		return DefaultTenantID
	}
	return tenantID
}

// IsUniqueViolation 判断是否为唯一键冲突。
func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}

func sqlNullString(raw string) sql.NullString {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: raw, Valid: true}
}

func derefString(p *string) sql.NullString {
	if p == nil {
		return sql.NullString{}
	}
	return sqlNullString(*p)
}

func derefInt(p *int) sql.NullInt64 {
	if p == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: int64(*p), Valid: true}
}

func parseOptionalTime(raw sql.NullTime) *time.Time {
	if !raw.Valid {
		return nil
	}
	v := raw.Time.UTC()
	return &v
}

func mustRowsClose(rows *sql.Rows) {
	if rows == nil {
		return
	}
	_ = rows.Close()
}

func wrapDBError(action string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", action, err)
}
