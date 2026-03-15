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

// OverviewSnapshot represents the latest metrics snapshot for one agent.
type OverviewSnapshot struct {
	AgentID          string
	ServerID         string
	CPUUsagePct      float64
	MemoryUsagePct   float64
	DiskUsagePct     float64
	DiskIOReadBytes  int64
	DiskIOWriteBytes int64
	NetInBytes       int64
	NetOutBytes      int64
	CollectedAt      time.Time
}

// OverviewTrendRow represents an aggregated overview row for a time bucket.
type OverviewTrendRow struct {
	BucketStart       time.Time
	ActiveAgents      int
	AvgCPUUsagePct    float64
	AvgMemoryUsagePct float64
	AvgDiskUsagePct   float64
	TotalDiskRead     int64
	TotalDiskWrite    int64
	TotalNetInBytes   int64
	TotalNetOutBytes  int64
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

// QueryLatestMetricsSnapshots returns the latest metrics snapshot for each agent within the window.
func (r *Repository) QueryLatestMetricsSnapshots(ctx context.Context, tenantID string, from, to time.Time) ([]OverviewSnapshot, error) {
	query := `
SELECT agent_id, server_id,
	cpu_usage_pct::double precision,
	memory_usage_pct::double precision,
	disk_usage_pct::double precision,
	disk_io_read_bytes,
	disk_io_write_bytes,
	net_in_bytes,
	net_out_bytes,
	collected_at
FROM (
	SELECT DISTINCT ON (agent_id)
		agent_id,
		server_id,
		cpu_usage_pct,
		memory_usage_pct,
		disk_usage_pct,
		disk_io_read_bytes,
		disk_io_write_bytes,
		net_in_bytes,
		net_out_bytes,
		collected_at
	FROM server_metrics
	WHERE tenant_id = $1::uuid AND collected_at >= $2 AND collected_at <= $3
	ORDER BY agent_id, collected_at DESC
) latest
ORDER BY collected_at DESC, agent_id ASC
`
	rows, err := r.db.QueryContext(ctx, query, tenantID, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]OverviewSnapshot, 0)
	for rows.Next() {
		var snapshot OverviewSnapshot
		var cpu, mem, disk sql.NullFloat64
		var diskRead, diskWrite, netIn, netOut sql.NullInt64
		if err := rows.Scan(
			&snapshot.AgentID,
			&snapshot.ServerID,
			&cpu,
			&mem,
			&disk,
			&diskRead,
			&diskWrite,
			&netIn,
			&netOut,
			&snapshot.CollectedAt,
		); err != nil {
			return nil, err
		}
		if cpu.Valid {
			snapshot.CPUUsagePct = cpu.Float64
		}
		if mem.Valid {
			snapshot.MemoryUsagePct = mem.Float64
		}
		if disk.Valid {
			snapshot.DiskUsagePct = disk.Float64
		}
		if diskRead.Valid {
			snapshot.DiskIOReadBytes = diskRead.Int64
		}
		if diskWrite.Valid {
			snapshot.DiskIOWriteBytes = diskWrite.Int64
		}
		if netIn.Valid {
			snapshot.NetInBytes = netIn.Int64
		}
		if netOut.Valid {
			snapshot.NetOutBytes = netOut.Int64
		}
		result = append(result, snapshot)
	}
	return result, rows.Err()
}

// QueryOverviewTrend returns aggregated overview data grouped by time bucket.
func (r *Repository) QueryOverviewTrend(ctx context.Context, tenantID string, from, to time.Time, bucketSeconds int64) ([]OverviewTrendRow, error) {
	query := `
WITH bucketed AS (
	SELECT
		to_timestamp(floor(extract(epoch FROM collected_at) / $4) * $4) AS bucket_start,
		agent_id,
		cpu_usage_pct,
		memory_usage_pct,
		disk_usage_pct,
		disk_io_read_bytes,
		disk_io_write_bytes,
		net_in_bytes,
		net_out_bytes,
		ROW_NUMBER() OVER (
			PARTITION BY agent_id, floor(extract(epoch FROM collected_at) / $4)
			ORDER BY collected_at DESC
		) AS rn
	FROM server_metrics
	WHERE tenant_id = $1::uuid AND collected_at >= $2 AND collected_at <= $3
)
SELECT
	bucket_start,
	COUNT(*)::integer AS active_agents,
	COALESCE(AVG(cpu_usage_pct), 0)::double precision AS avg_cpu_usage_pct,
	COALESCE(AVG(memory_usage_pct), 0)::double precision AS avg_memory_usage_pct,
	COALESCE(AVG(disk_usage_pct), 0)::double precision AS avg_disk_usage_pct,
	COALESCE(SUM(disk_io_read_bytes), 0)::bigint AS total_disk_read,
	COALESCE(SUM(disk_io_write_bytes), 0)::bigint AS total_disk_write,
	COALESCE(SUM(net_in_bytes), 0)::bigint AS total_net_in_bytes,
	COALESCE(SUM(net_out_bytes), 0)::bigint AS total_net_out_bytes
FROM bucketed
WHERE rn = 1
GROUP BY bucket_start
ORDER BY bucket_start ASC
`
	rows, err := r.db.QueryContext(ctx, query, tenantID, from, to, bucketSeconds)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]OverviewTrendRow, 0)
	for rows.Next() {
		var row OverviewTrendRow
		if err := rows.Scan(
			&row.BucketStart,
			&row.ActiveAgents,
			&row.AvgCPUUsagePct,
			&row.AvgMemoryUsagePct,
			&row.AvgDiskUsagePct,
			&row.TotalDiskRead,
			&row.TotalDiskWrite,
			&row.TotalNetInBytes,
			&row.TotalNetOutBytes,
		); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}
