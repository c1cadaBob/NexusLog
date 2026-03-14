package checker

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCheckRejectsUnsafeMetadataTarget(t *testing.T) {
	chk := New()
	result := chk.Check(context.Background(), "http://metadata.google.internal/healthz")
	if result.Healthy {
		t.Fatal("Check() should reject metadata target")
	}
	if !strings.Contains(result.Error, "非法目标") {
		t.Fatalf("Check() error = %q, want illegal target message", result.Error)
	}
}

func TestCheckRejectsCredentialsInTarget(t *testing.T) {
	chk := New()
	result := chk.Check(context.Background(), "http://user:pass@localhost:8080/healthz")
	if result.Healthy {
		t.Fatal("Check() should reject credential target")
	}
	if !strings.Contains(result.Error, "credentials") {
		t.Fatalf("Check() error = %q, want credentials rejection", result.Error)
	}
}

func TestCheckAllowsHealthyHTTPServer(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	chk := New()
	result := chk.Check(context.Background(), server.URL+"/healthz")
	if !result.Healthy {
		t.Fatalf("Check() healthy = false, error = %q", result.Error)
	}
	if result.Target != server.URL+"/healthz" {
		t.Fatalf("Check() target = %q, want %q", result.Target, server.URL+"/healthz")
	}
}
