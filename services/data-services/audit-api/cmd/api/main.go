package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"
	"github.com/nexuslog/data-services/audit-api/internal/handler"
	"github.com/nexuslog/data-services/audit-api/internal/repository"
	"github.com/nexuslog/data-services/audit-api/internal/service"
	"github.com/nexuslog/data-services/shared/server"
)

func main() {
	cfg := server.Config{
		Name: "audit-api",
		Port: server.GetEnv("HTTP_PORT", "8083"),
	}

	db, err := newPostgresDBFromEnv()
	if err != nil {
		log.Printf("audit-api: postgres unavailable: %v", err)
	}
	if db != nil {
		defer func() {
			if closeErr := db.Close(); closeErr != nil {
				log.Printf("audit-api: close postgres failed: %v", closeErr)
			}
		}()
	}

	auditRepo := repository.NewAuditRepository(db)
	auditSvc := service.NewAuditService(auditRepo)
	auditHandler := handler.NewAuditHandler(auditSvc)

	server.Run(cfg, func(r *gin.Engine) {
		v1 := r.Group("/api/v1/audit")
		{
			v1.GET("/logs", auditHandler.ListAuditLogs)
		}
	})
}

func newPostgresDBFromEnv() (*sql.DB, error) {
	if dsn := getEnv("DB_DSN", getEnv("DATABASE_URL", "")); dsn != "" {
		return openAndPing(dsn)
	}
	host := getEnv("DATABASE_POSTGRESQL_HOST", "localhost")
	port := getEnv("DATABASE_POSTGRESQL_PORT", "5432")
	dbName := getEnv("DATABASE_POSTGRESQL_DBNAME", "nexuslog")
	user := getEnv("DATABASE_POSTGRESQL_USER", "nexuslog")
	password := getEnv("DATABASE_POSTGRESQL_PASSWORD", "nexuslog_dev")
	sslMode := getEnv("DATABASE_POSTGRESQL_SSLMODE", "disable")
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, password, host, port, dbName, sslMode)
	return openAndPing(dsn)
}

func openAndPing(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", strings.TrimSpace(dsn))
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(12)
	db.SetMaxIdleConns(4)
	db.SetConnMaxLifetime(30 * time.Minute)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}
