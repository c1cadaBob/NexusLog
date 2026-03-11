package pullapi

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/nexuslog/collector-agent/plugins"
)

func TestEnsureMetadata_PrefersExistingHostName(t *testing.T) {
	metadata := ensureMetadata(map[string]string{
		"host.name": "node-a",
		"hostname":  "node-b",
	}, APISeverity{Text: "info"}, APIService{}, 12, "node-c", "10.0.0.8")

	if got := metadata["host.name"]; got != "node-a" {
		t.Fatalf("metadata[host.name]=%q, want node-a", got)
	}
	if got := metadata["host"]; got != "node-a" {
		t.Fatalf("metadata[host]=%q, want node-a", got)
	}
}

func TestEnsureMetadata_PromotesHostnameAndFallbackSourceHostname(t *testing.T) {
	fromHostname := ensureMetadata(map[string]string{
		"hostname": "syslog-host",
	}, APISeverity{Text: "info"}, APIService{}, 10, "agent-host", "10.0.0.9")
	if got := fromHostname["host.name"]; got != "syslog-host" {
		t.Fatalf("metadata[host.name]=%q, want syslog-host", got)
	}
	if got := fromHostname["host"]; got != "syslog-host" {
		t.Fatalf("metadata[host]=%q, want syslog-host", got)
	}

	fromAgent := ensureMetadata(map[string]string{}, APISeverity{Text: "info"}, APIService{}, 10, "agent-host", "10.0.0.10")
	if got := fromAgent["host.name"]; got != "agent-host" {
		t.Fatalf("fallback metadata[host.name]=%q, want agent-host", got)
	}
	if got := fromAgent["host"]; got != "agent-host" {
		t.Fatalf("fallback metadata[host]=%q, want agent-host", got)
	}
	if got := fromAgent["host.ip"]; got != "10.0.0.10" {
		t.Fatalf("fallback metadata[host.ip]=%q, want 10.0.0.10", got)
	}
	if got := fromAgent["agent.ip"]; got != "10.0.0.10" {
		t.Fatalf("fallback metadata[agent.ip]=%q, want 10.0.0.10", got)
	}
}

func TestPullResponseFallsBackToAgentHostnameWhenRecordMissingHost(t *testing.T) {
	svc := New(newMockCheckpointStore())
	svc.SetAgentInfo("agent-hosted", "1.0.0", "node-source-a", "10.20.30.40")
	mux := http.NewServeMux()
	RegisterRoutes(mux, svc, MetaInfo{Hostname: "node-source-a", IP: "10.20.30.40"}, testAuthConfig())

	svc.AddRecords([]plugins.Record{{
		Source: "/var/log/app.log",
		Data:   []byte("plain application log without embedded hostname"),
		Metadata: map[string]string{
			"offset": "10",
		},
	}})

	resp := doJSONRequest(t, mux, http.MethodPost, "/agent/v1/logs/pull", map[string]any{
		"max_records": 1,
		"max_bytes":   1024,
	}, map[string]string{
		"X-Agent-Key": "test-active-key",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("pull failed: %d body=%s", resp.Code, resp.Body.String())
	}

	var pullData PullResponse
	if err := json.Unmarshal(resp.Body.Bytes(), &pullData); err != nil {
		t.Fatalf("decode pull response failed: %v", err)
	}
	if len(pullData.Records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(pullData.Records))
	}
	if got := pullData.Agent.Hostname; got != "node-source-a" {
		t.Fatalf("pullData.Agent.Hostname=%q, want node-source-a", got)
	}
	if got := pullData.Agent.IP; got != "10.20.30.40" {
		t.Fatalf("pullData.Agent.IP=%q, want 10.20.30.40", got)
	}
	if got := pullData.Records[0].Attributes["host.name"]; got != "node-source-a" {
		t.Fatalf("record.Attributes[host.name]=%q, want node-source-a", got)
	}
	if got := pullData.Records[0].Attributes["host"]; got != "node-source-a" {
		t.Fatalf("record.Attributes[host]=%q, want node-source-a", got)
	}
}
