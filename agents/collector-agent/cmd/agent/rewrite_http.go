package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/nexuslog/collector-agent/internal/metrics"
	"github.com/nexuslog/collector-agent/internal/pullv2"
)

func startRewriteHTTPServer(port string, sysMetrics *metrics.Collector) *http.Server {
	mux := http.NewServeMux()
	mux.Handle("/agent/v1/metrics", metrics.MetricsHandler(sysMetrics))
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"healthy","service":"collector-agent","legacy_pipeline_enabled":false,"time":"%s"}`,
			time.Now().UTC().Format(time.RFC3339))
	})
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ready","service":"collector-agent","legacy_pipeline_enabled":false,"time":"%s"}`,
			time.Now().UTC().Format(time.RFC3339))
	})

	gone := pullv2.GoneV1Handler()
	mux.HandleFunc("/agent/v1/meta", gone)
	mux.HandleFunc("/agent/v1/logs/pull", gone)
	mux.HandleFunc("/agent/v1/logs/ack", gone)

	svc := pullv2.New(parseEnvInt("PULLV2_MAX_BUFFERED_RECORDS", 10000), nil)
	auth := pullv2.NewAuthConfig(
		getEnv("AGENT_API_KEY_ACTIVE_ID", "active"),
		getEnv("AGENT_API_KEY_ACTIVE", "dev-agent-key"),
		getEnv("AGENT_API_KEY_NEXT_ID", "next"),
		getEnv("AGENT_API_KEY_NEXT", ""),
	)
	meta := pullv2.BuildDefaultMeta(
		getEnv("AGENT_ID", "collector-agent-rewrite"),
		getEnv("AGENT_VERSION", "0.2.0"),
	)
	pullv2.RegisterRoutes(mux, svc, meta, auth)

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		log.Printf("rewrite HTTP 服务监听端口 :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Printf("HTTP 服务启动失败: %v", err)
		}
	}()
	return server
}
