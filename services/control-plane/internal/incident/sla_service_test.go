package incident

import (
	"context"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestRepositoryPG_GetSLASummary_UsesSeverityDefaultsForCompliance(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	repo := NewRepositoryPG(db)
	tenantID := "10000000-0000-0000-0000-000000000001"

	mock.ExpectQuery(`SELECT COALESCE\(AVG\(EXTRACT\(EPOCH FROM \(acknowledged_at - created_at\)\) / 60\), 0\)`).
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(1.0))
	mock.ExpectQuery(`SELECT COALESCE\(AVG\(EXTRACT\(EPOCH FROM \(resolved_at - created_at\)\) / 60\), 0\)`).
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"avg"}).AddRow(1.0))
	mock.ExpectQuery(`WITH scoped AS`).
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"total", "compliant"}).AddRow(1, 1))

	summary, err := repo.GetSLASummary(context.Background(), tenantID)
	if err != nil {
		t.Fatalf("GetSLASummary() error = %v", err)
	}
	if summary.TotalIncidents != 1 {
		t.Fatalf("GetSLASummary().TotalIncidents = %d, want 1", summary.TotalIncidents)
	}
	if summary.CompliantIncidents != 1 {
		t.Fatalf("GetSLASummary().CompliantIncidents = %d, want 1", summary.CompliantIncidents)
	}
	if summary.SLAComplianceRatePct != 100 {
		t.Fatalf("GetSLASummary().SLAComplianceRatePct = %v, want 100", summary.SLAComplianceRatePct)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("expectations: %v", err)
	}
}
