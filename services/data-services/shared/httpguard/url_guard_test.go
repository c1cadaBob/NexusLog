package httpguard

import (
	"strings"
	"testing"
)

func TestNormalizeBaseURL_RejectsCredentials(t *testing.T) {
	_, err := NormalizeBaseURL("http://user:pass@example.com:9200", BaseURLOptions{AllowPrivate: true, AllowLoopback: true})
	if err == nil || !strings.Contains(err.Error(), "credentials") {
		t.Fatalf("NormalizeBaseURL() error = %v, want credentials rejection", err)
	}
}

func TestNormalizeBaseURL_RejectsQueryAndFragment(t *testing.T) {
	_, err := NormalizeBaseURL("https://example.com/base?token=abc#frag", BaseURLOptions{AllowPrivate: true, AllowLoopback: true})
	if err == nil || !strings.Contains(err.Error(), "query or fragment") {
		t.Fatalf("NormalizeBaseURL() error = %v, want query or fragment rejection", err)
	}
}

func TestNormalizeBaseURL_RejectsMetadataHost(t *testing.T) {
	_, err := NormalizeBaseURL("http://metadata.google.internal/computeMetadata/v1", BaseURLOptions{AllowPrivate: true, AllowLoopback: true})
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("NormalizeBaseURL() error = %v, want blocked host", err)
	}
}

func TestNormalizeBaseURL_RejectsLinkLocalIP(t *testing.T) {
	_, err := NormalizeBaseURL("http://169.254.169.254/latest/meta-data", BaseURLOptions{AllowPrivate: true, AllowLoopback: true})
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("NormalizeBaseURL() error = %v, want blocked address", err)
	}
}

func TestNormalizeBaseURL_AllowsLoopbackWhenConfigured(t *testing.T) {
	normalized, err := NormalizeBaseURL("http://127.0.0.1:9200/", BaseURLOptions{AllowPrivate: true, AllowLoopback: true})
	if err != nil {
		t.Fatalf("NormalizeBaseURL() error = %v", err)
	}
	if normalized != "http://127.0.0.1:9200" {
		t.Fatalf("NormalizeBaseURL() = %q, want http://127.0.0.1:9200", normalized)
	}
}
