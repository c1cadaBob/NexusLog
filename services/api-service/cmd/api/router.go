package main

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/nexuslog/api-service/internal/handler"
	"github.com/nexuslog/api-service/internal/repository"
	"github.com/nexuslog/api-service/internal/service"
)

func registerRoutes(router *gin.Engine, db *sql.DB, jwtSecret string) {
	authRepo := repository.NewAuthRepository(db)
	authService := service.NewAuthService(authRepo, jwtSecret)
	authHandler := handler.NewAuthHandler(authService)
	authRateLimiter := handler.NewDefaultAuthRateLimitMiddleware()

	userRepo := repository.NewUserRepository(db)
	userService := service.NewUserService(userRepo, authRepo)
	userHandler := handler.NewUserHandler(userService)

	router.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "api-service",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

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

	authV1 := apiV1.Group("/auth")
	authV1.POST("/register", authRateLimiter.Register(), authHandler.Register)
	authV1.POST("/login", authRateLimiter.Login(), authHandler.Login)
	authV1.POST("/refresh", authHandler.Refresh)
	authV1.POST("/password/reset-request", authRateLimiter.PasswordResetRequest(), authHandler.PasswordResetRequest)
	authV1.POST("/password/reset-confirm", authRateLimiter.PasswordResetConfirm(), authHandler.PasswordResetConfirm)

	protected := apiV1.Group("")
	protected.Use(handler.AuthRequired(db, jwtSecret))
	protected.POST("/auth/logout", authHandler.Logout)

	userV1 := protected.Group("/users")
	userV1.GET("/me", userHandler.GetMe)

	tenantScopedUsers := userV1.Group("")
	tenantScopedUsers.Use(handler.RequireScope("tenant"))
	tenantScopedUsers.GET("", handler.RequireCapability("iam.user.read"), userHandler.List)
	tenantScopedUsers.POST("/batch/status", handler.RequireCapability("iam.user.update_status"), userHandler.BatchUpdateStatus)
	tenantScopedUsers.GET("/:id", handler.RequireCapability("iam.user.read"), userHandler.Get)
	tenantScopedUsers.POST("", handler.RequireCapability("iam.user.create"), userHandler.Create)
	tenantScopedUsers.PUT("/:id", handler.RequireCapability("iam.user.update_profile"), userHandler.Update)
	tenantScopedUsers.DELETE("/:id", handler.RequireCapability("iam.user.delete"), userHandler.Delete)
	tenantScopedUsers.POST("/:id/roles", handler.RequireCapability("iam.user.grant_role"), userHandler.AssignRole)
	tenantScopedUsers.DELETE("/:id/roles/:roleId", handler.RequireCapability("iam.user.revoke_role"), userHandler.RemoveRole)

	roleV1 := protected.Group("/roles")
	roleV1.Use(handler.RequireScope("tenant"))
	roleV1.GET("", handler.RequireCapability("iam.role.read"), userHandler.ListRoles)
}

func newHTTPServer(port string, router http.Handler) *http.Server {
	return &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 10 * time.Second,
	}
}
