package ingest

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"
)

func TestNormalizeAndValidateAgentBaseURL_RejectsLoopbackAddress(t *testing.T) {
	_, err := normalizeAndValidateAgentBaseURL("http://127.0.0.1:9091")
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected loopback rejection, got %v", err)
	}
}

func TestNormalizeAndValidateAgentBaseURL_RejectsMetadataHostname(t *testing.T) {
	_, err := normalizeAndValidateAgentBaseURL("http://metadata.google.internal:9091")
	if err == nil || !strings.Contains(err.Error(), "not allowed") {
		t.Fatalf("expected metadata hostname rejection, got %v", err)
	}
}

func TestNormalizeAndValidateAgentBaseURL_RejectsHostnameResolvingToLoopback(t *testing.T) {
	previousLookup := lookupAgentBaseURLHostIPs
	lookupAgentBaseURLHostIPs = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("127.0.0.1")}, nil
	}
	t.Cleanup(func() {
		lookupAgentBaseURLHostIPs = previousLookup
	})

	_, err := normalizeAndValidateAgentBaseURL("http://collector-agent.internal:9091")
	if err == nil || !strings.Contains(err.Error(), "resolved address is not allowed") {
		t.Fatalf("expected resolved loopback rejection, got %v", err)
	}
}

func TestNormalizeAndValidateAgentBaseURL_RejectsUnresolvableHostname(t *testing.T) {
	previousLookup := lookupAgentBaseURLHostIPs
	lookupAgentBaseURLHostIPs = func(ctx context.Context, host string) ([]net.IP, error) {
		return nil, errors.New("lookup failed")
	}
	t.Cleanup(func() {
		lookupAgentBaseURLHostIPs = previousLookup
	})

	_, err := normalizeAndValidateAgentBaseURL("http://collector-agent.internal:9091")
	if err == nil || !strings.Contains(err.Error(), "lookup failed") {
		t.Fatalf("expected lookup failure rejection, got %v", err)
	}
}

func TestNormalizeAndValidateAgentBaseURL_AllowsHostnameResolvingToPrivateAddress(t *testing.T) {
	previousLookup := lookupAgentBaseURLHostIPs
	lookupAgentBaseURLHostIPs = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("172.29.0.1")}, nil
	}
	t.Cleanup(func() {
		lookupAgentBaseURLHostIPs = previousLookup
	})

	normalized, err := normalizeAndValidateAgentBaseURL("http://collector-agent:9091/")
	if err != nil {
		t.Fatalf("expected private address host to be allowed, got %v", err)
	}
	if normalized != "http://collector-agent:9091" {
		t.Fatalf("expected normalized URL, got %s", normalized)
	}
}
