package alert

import (
	"context"
	"database/sql"
	"os"
	"testing"

	_ "github.com/lib/pq"
)

func TestSilenceServiceListActive_Integration(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DB_DSN")
	}
	if dsn == "" {
		t.Skip("DATABASE_URL or DB_DSN not set, skipping integration test")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		t.Skipf("cannot ping db: %v", err)
	}

	svc := NewSilenceService(db)
	if _, err := svc.ListActive(context.Background(), ""); err != nil {
		t.Fatalf("ListActive(\"\") error: %v", err)
	}
}
