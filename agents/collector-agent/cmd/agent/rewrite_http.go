package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/nexuslog/collector-agent/internal/metrics"
	"github.com/nexuslog/collector-agent/internal/pullapi"
	"github.com/nexuslog/collector-agent/internal/pullv2"
)

func startRewriteHTTPServer(
	port string,
	sysMetrics *metrics.Collector,
	pullService *pullapi.Service,
	meta pullapi.MetaInfo,
	auth pullapi.AuthConfig,
	pullV2Service *pullv2.Service,
	pullV2Meta pullv2.MetaInfo,
	pullV2Auth pullv2.AuthConfig,
) *http.Server {
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

	if pullService != nil {
		pullapi.RegisterRoutes(mux, pullService, meta, auth)
	} else {
		gone := pullv2.GoneV1Handler()
		mux.HandleFunc("/agent/v1/meta", gone)
		mux.HandleFunc("/agent/v1/logs/pull", gone)
		mux.HandleFunc("/agent/v1/logs/ack", gone)
	}

	if pullV2Service != nil {
		pullv2.RegisterRoutes(mux, pullV2Service, pullV2Meta, pullV2Auth)
	}

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
