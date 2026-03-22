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
	"github.com/nexuslog/data-services/query-api/internal/handler"
	"github.com/nexuslog/data-services/query-api/internal/repository"
	"github.com/nexuslog/data-services/query-api/internal/service"
	sharedauth "github.com/nexuslog/data-services/shared/auth"
	"github.com/nexuslog/data-services/shared/server"
)

func main() {
	cfg := server.Config{
		Name: "query-api",
		Port: server.GetEnv("HTTP_PORT", "8082"),
	}
	jwtSecret := requireJWTSecret()

	metadataDB, err := newPostgresDBFromEnv()
	if err != nil {
		log.Printf("query-api: metadata store disabled, postgres unavailable: %v", err)
	}
	if metadataDB != nil {
		defer func() {
			if closeErr := metadataDB.Close(); closeErr != nil {
				log.Printf("query-api: close postgres failed: %v", closeErr)
			}
		}()
	}

	esRepo := repository.NewElasticsearchRepositoryFromEnv()
	metadataRepo := repository.NewQueryMetadataRepository(metadataDB)
	querySvc := service.NewQueryService(esRepo, metadataRepo)
	statsSvc := service.NewStatsService(esRepo, metadataDB)
	queryHandler := handler.NewQueryHandler(querySvc)
	statsHandler := handler.NewStatsHandler(statsSvc)

	server.Run(cfg, func(r *gin.Engine) {
		registerRoutes(r, metadataDB, jwtSecret, queryHandler, statsHandler)
	})
}

func registerRoutes(r *gin.Engine, metadataDB *sql.DB, jwtSecret string, queryHandler *handler.QueryHandler, statsHandler *handler.StatsHandler) {
	r.Use(sharedauth.RequireAuthenticatedIdentity(metadataDB, jwtSecret))
	v1 := r.Group("/api/v1/query")
	v1.POST("/logs", sharedauth.RequireCapability("log.query.read"), queryHandler.SearchLogs)
	v1.GET("/stats/overview", sharedauth.RequireCapability("log.query.aggregate"), statsHandler.GetOverviewStats)
	v1.POST("/stats/aggregate", sharedauth.RequireCapability("log.query.aggregate"), statsHandler.Aggregate)
	v1.POST("/stats/anomalies", sharedauth.RequireCapability("log.query.aggregate"), statsHandler.DetectAnomalies)
	v1.POST("/stats/clusters", sharedauth.RequireCapability("log.query.aggregate"), statsHandler.ClusterLogs)
	v1.GET("/history", sharedauth.RequireCapability("query.history.read"), queryHandler.ListQueryHistories)
	v1.DELETE("/history/:history_id", sharedauth.RequireCapability("query.history.read"), queryHandler.DeleteQueryHistory)
	v1.GET("/saved", sharedauth.RequireCapability("query.saved.read"), queryHandler.ListSavedQueries)
	v1.POST("/saved", sharedauth.RequireCapability("query.saved.read"), queryHandler.CreateSavedQuery)
	v1.PUT("/saved/:saved_query_id", sharedauth.RequireCapability("query.saved.read"), queryHandler.UpdateSavedQuery)
	v1.DELETE("/saved/:saved_query_id", sharedauth.RequireCapability("query.saved.read"), queryHandler.DeleteSavedQuery)
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

func requireJWTSecret() string {
	secret := strings.TrimSpace(getEnv("JWT_SECRET", ""))
	if secret == "" {
		log.Fatal("JWT_SECRET is required")
	}
	if secret == "nexuslog-dev-secret-change-in-production" {
		log.Fatal("JWT_SECRET uses a known weak default and must be replaced")
	}
	if len(secret) < 32 {
		log.Fatal("JWT_SECRET must be at least 32 characters")
	}
	return secret
}
