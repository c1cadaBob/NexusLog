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
// SLA compliance = % of incidents where response <= effective_sla_response_minutes
// and resolve <= effective_sla_resolve_minutes. When incident-specific SLA values are
// not configured, severity defaults are used so the summary stays aligned with the SLA page.
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

	// SLA compliance: count all incidents in tenant for the total, and treat incidents as compliant
	// only when both response and resolve timestamps exist and stay within the effective SLA.
	// If incident-specific SLA values are missing, fall back to severity defaults used by the UI.
	complianceQuery := `
WITH scoped AS (
    SELECT
        id,
        EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 60 AS response_mins,
        EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60 AS resolve_mins,
        acknowledged_at IS NOT NULL AS has_response,
        resolved_at IS NOT NULL AS has_resolution,
        COALESCE(
            sla_response_minutes,
            CASE severity
                WHEN 'critical' THEN 5
                WHEN 'major' THEN 15
                ELSE 30
            END
        ) AS effective_response_minutes,
        COALESCE(
            sla_resolve_minutes,
            CASE severity
                WHEN 'critical' THEN 60
                WHEN 'major' THEN 240
                ELSE 480
            END
        ) AS effective_resolve_minutes
    FROM incidents
    WHERE tenant_id = $1::uuid
)
SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (
        WHERE has_response
          AND has_resolution
          AND response_mins <= effective_response_minutes
          AND resolve_mins <= effective_resolve_minutes
    ) AS compliant
FROM scoped
`
	if err := r.db.QueryRowContext(ctx, complianceQuery, tenantID).Scan(&summary.TotalIncidents, &summary.CompliantIncidents); err != nil {
		return nil, fmt.Errorf("sla compliance: %w", err)
	}

	if summary.TotalIncidents > 0 {
		summary.SLAComplianceRatePct = float64(summary.CompliantIncidents) / float64(summary.TotalIncidents) * 100
	}

	return summary, nil
}
