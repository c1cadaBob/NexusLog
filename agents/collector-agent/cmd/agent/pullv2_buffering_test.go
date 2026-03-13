package main

import (
	"context"
	"testing"
	"time"

	"github.com/nexuslog/collector-agent/internal/pullv2"
	"github.com/nexuslog/collector-agent/plugins"
)

func TestFanOutCollectorOutputSkipsPullV2BufferingWhenDisabled(t *testing.T) {
	svc := pullv2.New(16, nil)
	collectorOut := make(chan []plugins.Record, 1)
	collectorOut <- []plugins.Record{{
		Source:    "/var/log/messages",
		Timestamp: time.Now().UTC().UnixNano(),
		Data:      []byte("disabled pullv2 buffering"),
	}}
	close(collectorOut)

	fanOutCollectorOutput(context.Background(), collectorOut, nil, nil, svc, true, false, "dual", "agent-local", "host-a", "10.0.0.8")

	resp, err := svc.Pull(pullv2.PullRequest{SourceKey: "/var/log/messages", MaxRecords: 10})
	if err != nil {
		t.Fatalf("Pull() error = %v", err)
	}
	if len(resp.Records) != 0 {
		t.Fatalf("expected no buffered records when pullv2 buffering is disabled, got %d", len(resp.Records))
	}
}

func TestFanOutCollectorOutputAppendsPullV2RecordsWhenEnabled(t *testing.T) {
	svc := pullv2.New(16, nil)
	collectorOut := make(chan []plugins.Record, 1)
	collectorOut <- []plugins.Record{{
		Source:    "/var/log/messages",
		Timestamp: time.Now().UTC().UnixNano(),
		Data:      []byte("enabled pullv2 buffering"),
	}}
	close(collectorOut)

	fanOutCollectorOutput(context.Background(), collectorOut, nil, nil, svc, true, true, "dual", "agent-local", "host-a", "10.0.0.8")

	resp, err := svc.Pull(pullv2.PullRequest{SourceKey: "/var/log/messages", MaxRecords: 10})
	if err != nil {
		t.Fatalf("Pull() error = %v", err)
	}
	if len(resp.Records) != 1 {
		t.Fatalf("expected 1 buffered record when pullv2 buffering is enabled, got %d", len(resp.Records))
	}
}
