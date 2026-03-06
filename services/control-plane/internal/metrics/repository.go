package metrics

import (
	"context"
	"database/sql"
	"time"
)

// ServerMetric represents a single server metrics record.
type ServerMetric struct {
	ID               int64
	TenantID         string
	AgentID          string
	ServerID         string
	CPUUsagePct      *float64
	MemoryUsagePct   *float64
	DiskUsagePct     *float64
	DiskIOReadBytes  *int64
	DiskIOWriteBytes *int64
	NetInBytes       *int64
	NetOutBytes      *int64
	CollectedAt      time.Time
	CreatedAt        time.Time
}

// ReportRequest represents a metrics report from an agent.
type ReportRequest struct {
	AgentID  string        `json:"agent_id"`
	ServerID string        `json:"server_id"`
	Metrics  SystemMetrics `json:"metrics"`
}

// SystemMetrics matches the agent's SystemMetrics structure.
type SystemMetrics struct {
	CPUUsagePct      float64   `json:"cpu_usage_pct"`
	MemoryUsagePct   float64   `json:"memory_usage_pct"`
	DiskUsagePct     float64   `json:"disk_usage_pct"`
	DiskIOReadBytes  int64     `json:"disk_io_read_bytes"`
	DiskIOWriteBytes int64     `json:"disk_io_write_bytes"`
	NetInBytes       int64     `json:"net_in_bytes"`
	NetOutBytes      int64     `json:"net_out_bytes"`
	CollectedAt      time.Time `json:"collected_at"`
}

// Repository provides persistence for server metrics.
type Repository struct {
	db *sql.DB
}

// NewRepository creates a new metrics repository.
func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// InsertMetrics inserts a batch of metrics.
func (r *Repository) InsertMetrics(ctx context.Context, tenantID string, req *ReportRequest) error {
	query := `
INSERT INTO server_metrics (tenant_id, agent_id, server_id, cpu_usage_pct, memory_usage_pct, disk_usage_pct,
	disk_io_read_bytes, disk_io_write_bytes, net_in_bytes, net_out_bytes, collected_at)
VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
`
	m := &req.Metrics
	_, err := r.db.ExecContext(ctx, query,
		tenantID, req.AgentID, req.ServerID,
		m.CPUUsagePct, m.MemoryUsagePct, m.DiskUsagePct,
		m.DiskIOReadBytes, m.DiskIOWriteBytes, m.NetInBytes, m.NetOutBytes,
		m.CollectedAt,
	)
	return err
}

// CleanupOldMetrics deletes records older than retentionDays. Returns number of deleted rows.
func (r *Repository) CleanupOldMetrics(ctx context.Context, retentionDays int) (int64, error) {
	query := `DELETE FROM server_metrics WHERE collected_at < NOW() - ($1::text || ' days')::interval`
	result, err := r.db.ExecContext(ctx, query, retentionDays)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}

// QueryMetrics returns metrics for an agent within the time range.
func (r *Repository) QueryMetrics(ctx context.Context, tenantID, agentID string, from, to time.Time) ([]ServerMetric, error) {
	query := `
SELECT id, tenant_id, agent_id, server_id, cpu_usage_pct, memory_usage_pct, disk_usage_pct,
	disk_io_read_bytes, disk_io_write_bytes, net_in_bytes, net_out_bytes, collected_at, created_at
FROM server_metrics
WHERE tenant_id = $1::uuid AND agent_id = $2 AND collected_at >= $3 AND collected_at <= $4
ORDER BY collected_at ASC
`
	rows, err := r.db.QueryContext(ctx, query, tenantID, agentID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []ServerMetric
	for rows.Next() {
		var m ServerMetric
		var tenantIDVal, agentIDVal, serverIDVal string
		var cpu, mem, disk sql.NullFloat64
		var diskRead, diskWrite, netIn, netOut sql.NullInt64
		err := rows.Scan(
			&m.ID, &tenantIDVal, &agentIDVal, &serverIDVal,
			&cpu, &mem, &disk, &diskRead, &diskWrite, &netIn, &netOut,
			&m.CollectedAt, &m.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		m.TenantID = tenantIDVal
		m.AgentID = agentIDVal
		m.ServerID = serverIDVal
		if cpu.Valid {
			m.CPUUsagePct = &cpu.Float64
		}
		if mem.Valid {
			m.MemoryUsagePct = &mem.Float64
		}
		if disk.Valid {
			m.DiskUsagePct = &disk.Float64
		}
		if diskRead.Valid {
			m.DiskIOReadBytes = &diskRead.Int64
		}
		if diskWrite.Valid {
			m.DiskIOWriteBytes = &diskWrite.Int64
		}
		if netIn.Valid {
			m.NetInBytes = &netIn.Int64
		}
		if netOut.Valid {
			m.NetOutBytes = &netOut.Int64
		}
		list = append(list, m)
	}
	return list, rows.Err()
}
