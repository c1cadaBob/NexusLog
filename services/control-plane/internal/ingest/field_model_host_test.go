package ingest

import "testing"

func TestBuildLogDocumentHostPrefersStructuredHostName(t *testing.T) {
	doc := BuildLogDocument(AgentPullRecord{
		RecordID:   "rec-1",
		Sequence:   1,
		ObservedAt: "2026-03-09T02:00:00Z",
		Body:       "plain log body",
		Source:     AgentPullSource{Path: "/var/log/app.log", Offset: 10},
		Attributes: map[string]string{
			"host.name": "node-a",
			"host":      "node-b",
		},
	}, AgentPullAgent{Hostname: "agent-node", IP: "10.0.0.8"}, "agent-1", "batch-1", "/var/log/app.log", "tenant-1", "")

	if got := doc.Host.Name; got != "node-a" {
		t.Fatalf("doc.Host.Name=%q, want node-a", got)
	}
}

func TestBuildLogDocumentHostFallsBackToHostnameAndAgentHostname(t *testing.T) {
	fromHostname := BuildLogDocument(AgentPullRecord{
		RecordID:   "rec-2",
		Sequence:   2,
		ObservedAt: "2026-03-09T02:00:00Z",
		Body:       "plain log body",
		Source:     AgentPullSource{Path: "/var/log/app.log", Offset: 20},
		Attributes: map[string]string{
			"hostname": "syslog-node",
		},
	}, AgentPullAgent{Hostname: "agent-node", IP: "10.0.0.8"}, "agent-1", "batch-1", "/var/log/app.log", "tenant-1", "")

	if got := fromHostname.Host.Name; got != "syslog-node" {
		t.Fatalf("fromHostname.Host.Name=%q, want syslog-node", got)
	}

	fromAgent := BuildLogDocument(AgentPullRecord{
		RecordID:   "rec-3",
		Sequence:   3,
		ObservedAt: "2026-03-09T02:00:00Z",
		Body:       "plain log body",
		Source:     AgentPullSource{Path: "/var/log/app.log", Offset: 30},
	}, AgentPullAgent{Hostname: "agent-node", IP: "10.0.0.8"}, "agent-1", "batch-1", "/var/log/app.log", "tenant-1", "")

	if got := fromAgent.Host.Name; got != "agent-node" {
		t.Fatalf("fromAgent.Host.Name=%q, want agent-node", got)
	}
}

func TestBuildLogDocumentHostIPFallsBackToStructuredAndAgentIP(t *testing.T) {
	structured := BuildLogDocument(AgentPullRecord{
		RecordID:   "rec-3-ip",
		Sequence:   3,
		ObservedAt: "2026-03-09T02:00:00Z",
		Body:       "plain log body",
		Source:     AgentPullSource{Path: "/var/log/app.log", Offset: 30},
		Attributes: map[string]string{
			"host.ip": "10.0.0.10",
		},
	}, AgentPullAgent{Hostname: "agent-node", IP: "10.0.0.8"}, "agent-1", "batch-1", "/var/log/app.log", "tenant-1", "")

	if got := structured.Host.IP; got != "10.0.0.10" {
		t.Fatalf("structured.Host.IP=%q, want 10.0.0.10", got)
	}
	if got := structured.Agent.IP; got != "10.0.0.8" {
		t.Fatalf("structured.Agent.IP=%q, want 10.0.0.8", got)
	}

	fallback := BuildLogDocument(AgentPullRecord{
		RecordID:   "rec-4-ip",
		Sequence:   4,
		ObservedAt: "2026-03-09T02:00:00Z",
		Body:       "plain log body",
		Source:     AgentPullSource{Path: "/var/log/app.log", Offset: 40},
	}, AgentPullAgent{Hostname: "agent-node", IP: "10.0.0.8"}, "agent-1", "batch-1", "/var/log/app.log", "tenant-1", "")

	if got := fallback.Host.IP; got != "10.0.0.8" {
		t.Fatalf("fallback.Host.IP=%q, want 10.0.0.8", got)
	}
}

func TestBuildLogDocumentServiceFallsBackToDockerStructuredMetadata(t *testing.T) {
	doc := BuildLogDocument(AgentPullRecord{
		RecordID:   "rec-4",
		Sequence:   4,
		ObservedAt: "2026-03-09T02:00:00Z",
		Body:       "plain log body",
		Source:     AgentPullSource{Path: "/var/lib/docker/containers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-json.log", Offset: 40},
		Attributes: map[string]string{
			"service.name":           "query-api",
			"service.instance.id":    "nexuslog-query-api-1",
			"docker.compose.service": "query-api",
			"container.name":         "nexuslog-query-api-1",
		},
	}, AgentPullAgent{Hostname: "agent-node", IP: "10.0.0.8"}, "agent-1", "batch-1", "/var/lib/docker/containers/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-json.log", "tenant-1", "")

	if got := doc.Service.Name; got != "query-api" {
		t.Fatalf("doc.Service.Name=%q, want query-api", got)
	}
	if got := doc.Service.Instance.ID; got != "nexuslog-query-api-1" {
		t.Fatalf("doc.Service.Instance.ID=%q, want nexuslog-query-api-1", got)
	}
	if got := doc.Container.Name; got != "nexuslog-query-api-1" {
		t.Fatalf("doc.Container.Name=%q, want nexuslog-query-api-1", got)
	}
}
