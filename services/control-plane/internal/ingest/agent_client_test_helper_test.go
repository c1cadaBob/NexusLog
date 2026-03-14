package ingest

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"testing"
	"time"
)

const agentTestAliasHost = "172.29.0.10"

func newAliasedAgentBaseURL(t *testing.T, rawURL string) string {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse server URL failed: %v", err)
	}
	parsed.Host = net.JoinHostPort(agentTestAliasHost, parsed.Port())
	return parsed.String()
}

func newAliasedAgentHTTPClient(t *testing.T, rawURL string, timeout time.Duration) *http.Client {
	t.Helper()
	parsed, err := url.Parse(rawURL)
	if err != nil {
		t.Fatalf("parse server URL failed: %v", err)
	}
	actualHost := parsed.Host
	aliasHost := net.JoinHostPort(agentTestAliasHost, parsed.Port())
	dialer := &net.Dialer{Timeout: timeout}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			if addr == aliasHost {
				addr = actualHost
			}
			return dialer.DialContext(ctx, network, addr)
		},
	}
	return &http.Client{Timeout: timeout, Transport: transport}
}

func mustNewAliasedAgentClient(t *testing.T, rawURL string, timeout time.Duration) *AgentClient {
	t.Helper()
	if timeout <= 0 {
		timeout = 5 * time.Second
	}
	client := &AgentClient{httpClient: newAliasedAgentHTTPClient(t, rawURL, timeout)}
	if client.httpClient == nil {
		t.Fatalf("failed to build aliased agent http client: %s", fmt.Sprint(rawURL))
	}
	return client
}
