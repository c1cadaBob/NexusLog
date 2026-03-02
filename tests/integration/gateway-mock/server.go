package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

// mockResponse 定义统一的回包结构，便于脚本断言具体命中的上游服务。
type mockResponse struct {
	Service string `json:"service"`
	Method  string `json:"method"`
	Path    string `json:"path"`
}

// main 启动一个轻量 HTTP Mock 服务，用于网关路由与鉴权冒烟测试。
func main() {
	serviceName := getenv("MOCK_SERVICE_NAME", "mock-service")
	port := getenv("MOCK_PORT", "8080")

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(mockResponse{
			Service: serviceName,
			Method:  r.Method,
			Path:    r.URL.Path,
		})
	})

	addr := ":" + port
	log.Printf("gateway smoke mock server started: service=%s addr=%s", serviceName, addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

// getenv 读取环境变量，未设置时回落到默认值。
func getenv(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}
