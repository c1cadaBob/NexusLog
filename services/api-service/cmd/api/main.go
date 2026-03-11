package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/lib/pq"

	"github.com/nexuslog/api-service/internal/handler"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

func main() {
	port := getEnv("HTTP_PORT", getEnv("SERVER_HTTP_PORT", "8080"))

	db, err := newPostgresDBFromEnv()
	if err != nil {
		log.Fatalf("failed to init postgresql: %v", err)
	}
	defer db.Close()

	router := gin.Default()
	router.Use(gin.Recovery())
	router.Use(handler.AuditMiddleware(db))

	jwtSecret := getEnv("JWT_SECRET", "nexuslog-dev-secret-change-in-production")
	authRepo := repository.NewAuthRepository(db)
	authService := service.NewAuthService(authRepo, jwtSecret)
	authHandler := handler.NewAuthHandler(authService)

	userRepo := repository.NewUserRepository(db)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	// 健康检查端点（Kubernetes 探针使用）
	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "api-service",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	// API 版本化健康检查端点
	router.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "api-service",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})
	router.GET("/metrics", func(c *gin.Context) {
		c.Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		c.String(
			http.StatusOK,
			"# HELP nexuslog_service_up Whether the service is up.\n"+
				"# TYPE nexuslog_service_up gauge\n"+
				"nexuslog_service_up{service=\"api-service\"} 1\n",
		)
	})

	apiV1 := router.Group("/api/v1")

	// Public routes (no auth)
	authV1 := apiV1.Group("/auth")
	authV1.POST("/register", authHandler.Register)
	authV1.POST("/login", authHandler.Login)
	authV1.POST("/refresh", authHandler.Refresh)
	authV1.POST("/logout", authHandler.Logout)
	authV1.POST("/password/reset-request", authHandler.PasswordResetRequest)
	authV1.POST("/password/reset-confirm", authHandler.PasswordResetConfirm)

	// Protected routes
	protected := apiV1.Group("")
	protected.Use(handler.AuthRequired(db, jwtSecret))

	// User management (users:read, users:write)
	userV1 := protected.Group("/users")
	userV1.GET("/me", handler.RequirePermission("users:read"), userHandler.GetMe)
	userV1.GET("", handler.RequirePermission("users:read"), userHandler.List)
	userV1.POST("/batch/status", handler.RequirePermission("users:write"), userHandler.BatchUpdateStatus)
	userV1.GET("/:id", handler.RequirePermission("users:read"), userHandler.Get)
	userV1.POST("", handler.RequirePermission("users:write"), userHandler.Create)
	userV1.PUT("/:id", handler.RequirePermission("users:write"), userHandler.Update)
	userV1.DELETE("/:id", handler.RequirePermission("users:write"), userHandler.Delete)
	userV1.POST("/:id/roles", handler.RequirePermission("users:write"), userHandler.AssignRole)
	userV1.DELETE("/:id/roles/:roleId", handler.RequirePermission("users:write"), userHandler.RemoveRole)

	// Roles (users:read to list)
	roleV1 := protected.Group("/roles")
	roleV1.GET("", handler.RequirePermission("users:read"), userHandler.ListRoles)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		log.Printf("API service listening on :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down api-service...")
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Shutdown error: %v", err)
	}
}

func newPostgresDBFromEnv() (*sql.DB, error) {
	if dsn := getEnv("DB_DSN", getEnv("DATABASE_URL", "")); dsn != "" {
		return openAndPing(dsn)
	}

	host := getEnv("DATABASE_POSTGRESQL_HOST", "localhost")
	port := getEnv("DATABASE_POSTGRESQL_PORT", "5432")
	dbname := getEnv("DATABASE_POSTGRESQL_DBNAME", "nexuslog")
	user := getEnv("DATABASE_POSTGRESQL_USER", "nexuslog")
	password := getEnv("DATABASE_POSTGRESQL_PASSWORD", "nexuslog_dev")
	sslmode := getEnv("DATABASE_POSTGRESQL_SSLMODE", "disable")

	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s", user, password, host, port, dbname, sslmode)
	return openAndPing(dsn)
}

func openAndPing(dsn string) (*sql.DB, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}

	return db, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
