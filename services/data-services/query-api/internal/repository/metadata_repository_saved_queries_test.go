package repository

import (
	"context"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestListSavedQueries_ReturnsAvailableTags(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	defer db.Close()

	repo := NewQueryMetadataRepository(db)
	createdAt := time.Date(2026, 3, 17, 10, 0, 0, 0, time.UTC)
	updatedAt := createdAt.Add(5 * time.Minute)

	mock.ExpectQuery(`SELECT COUNT\(1\)\s+FROM saved_queries sq\s+WHERE sq\.tenant_id = \$1::uuid\s+AND sq\.user_id = \$2::uuid`).
		WithArgs("tenant-1", "user-1", "", "").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(int64(1)))

	mock.ExpectQuery(`SELECT\s+sq\.id::text,\s+sq\.name,\s+sq\.query_text,\s+COALESCE\(sq\.run_count, 0\),\s+sq\.created_at,\s+sq\.updated_at,\s+COALESCE\(array_agg`).
		WithArgs("tenant-1", "user-1", "", "", 0, 20).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "query_text", "run_count", "created_at", "updated_at", "tags"}).
				AddRow("saved-1", "Error Query", "level:error", int64(3), createdAt, updatedAt, "{ops,billing}"),
		)

	mock.ExpectQuery(`SELECT DISTINCT sqt\.tag\s+FROM saved_query_tags sqt\s+INNER JOIN saved_queries sq ON sq\.id = sqt\.saved_query_id\s+WHERE sq\.tenant_id = \$1::uuid\s+AND sq\.user_id = \$2::uuid`).
		WithArgs("tenant-1", "user-1").
		WillReturnRows(
			sqlmock.NewRows([]string{"tag"}).
				AddRow("ops").
				AddRow("billing"),
		)

	result, err := repo.ListSavedQueries(context.Background(), ListSavedQueriesInput{
		TenantID: "tenant-1",
		UserID:   "user-1",
		Page:     1,
		PageSize: 20,
	})
	if err != nil {
		t.Fatalf("ListSavedQueries() error = %v", err)
	}

	if result.Total != 1 {
		t.Fatalf("result.Total = %d, want 1", result.Total)
	}
	if len(result.Items) != 1 {
		t.Fatalf("len(result.Items) = %d, want 1", len(result.Items))
	}
	if got := result.Items[0].Tags; len(got) != 2 || got[0] != "billing" || got[1] != "ops" {
		t.Fatalf("result.Items[0].Tags = %#v, want []string{\"billing\", \"ops\"}", got)
	}
	if got := result.AvailableTags; len(got) != 2 || got[0] != "billing" || got[1] != "ops" {
		t.Fatalf("result.AvailableTags = %#v, want []string{\"billing\", \"ops\"}", got)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
