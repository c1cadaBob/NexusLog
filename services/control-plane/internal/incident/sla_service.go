package incident

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

// SLASummary holds SLA summary statistics.
type SLASummary struct {
	AvgResponseMinutes   float64 `json:"avg_response_minutes"`
	AvgResolveMinutes    float64 `json:"avg_resolve_minutes"`
	SLAComplianceRatePct float64 `json:"sla_compliance_rate_pct"`
	TotalIncidents       int     `json:"total_incidents"`
	CompliantIncidents   int     `json:"compliant_incidents"`
}

// GetSLASummary returns SLA summary for a tenant.
// Response time = acknowledged_at - created_at (minutes)
// Resolve time = resolved_at - created_at (minutes)
// SLA compliance = % of incidents where response <= sla_response_minutes AND resolve <= sla_resolve_minutes
func (r *RepositoryPG) GetSLASummary(ctx context.Context, tenantID string) (*SLASummary, error) {
	tenantID = strings.TrimSpace(tenantID)
	if tenantID == "" {
		return nil, fmt.Errorf("tenant_id is required")
	}

	summary := &SLASummary{}

	// Avg response time (acknowledged_at - created_at) for incidents with acknowledged_at
	avgRespQuery := `
SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60), 0)
FROM incidents
WHERE tenant_id = $1::uuid AND acknowledged_at IS NOT NULL
`
	if err := r.db.QueryRowContext(ctx, avgRespQuery, tenantID).Scan(&summary.AvgResponseMinutes); err != nil {
		if err != sql.ErrNoRows {
			return nil, fmt.Errorf("avg response: %w", err)
		}
	}

	// Avg resolve time (resolved_at - created_at) for incidents with resolved_at
	avgResolveQuery := `
SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60), 0)
FROM incidents
WHERE tenant_id = $1::uuid AND resolved_at IS NOT NULL
`
	if err := r.db.QueryRowContext(ctx, avgResolveQuery, tenantID).Scan(&summary.AvgResolveMinutes); err != nil {
		if err != sql.ErrNoRows {
			return nil, fmt.Errorf("avg resolve: %w", err)
		}
	}

	// SLA compliance: incidents with sla_response_minutes AND sla_resolve_minutes set
	// where response_time <= sla_response_minutes AND resolve_time <= sla_resolve_minutes
	complianceQuery := `
WITH with_sla AS (
    SELECT
        id,
        EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60 AS response_mins,
        EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60 AS resolve_mins,
        sla_response_minutes,
        sla_resolve_minutes
    FROM incidents
    WHERE tenant_id = $1::uuid
      AND sla_response_minutes IS NOT NULL
      AND sla_resolve_minutes IS NOT NULL
      AND acknowledged_at IS NOT NULL
      AND resolved_at IS NOT NULL
)
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE response_mins <= sla_response_minutes AND resolve_mins <= sla_resolve_minutes) AS compliant
FROM with_sla
`
	if err := r.db.QueryRowContext(ctx, complianceQuery, tenantID).Scan(&summary.TotalIncidents, &summary.CompliantIncidents); err != nil {
		return nil, fmt.Errorf("sla compliance: %w", err)
	}

	if summary.TotalIncidents > 0 {
		summary.SLAComplianceRatePct = float64(summary.CompliantIncidents) / float64(summary.TotalIncidents) * 100
	}

	return summary, nil
}
