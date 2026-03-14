package ingest

import (
	"context"
	"net"
	"strings"
	"testing"
	"time"
)

func TestAgentClientPullRejectsUnsafeLegacyAgentBaseURL(t *testing.T) {
	previousLookup := lookupAgentBaseURLHostIPs
	lookupAgentBaseURLHostIPs = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("127.0.0.1")}, nil
	}
	t.Cleanup(func() {
		lookupAgentBaseURLHostIPs = previousLookup
	})

	client := NewAgentClient(2 * time.Second)
	_, err := client.Pull(context.Background(), PullSource{
		AgentBaseURL:   "http://collector-agent.internal:9091",
		Path:           "/var/log/*.log",
		PullTimeoutSec: 5,
	}, PullTask{}, AgentAuthCredential{KeyID: "active", Key: "secret"}, "123")
	if err == nil || !strings.Contains(err.Error(), "resolved address is not allowed") {
		t.Fatalf("Pull() error = %v, want resolved address rejection", err)
	}
}

func TestAgentClientAckRejectsUnsafeLegacyAgentBaseURL(t *testing.T) {
	previousLookup := lookupAgentBaseURLHostIPs
	lookupAgentBaseURLHostIPs = func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("169.254.169.254")}, nil
	}
	t.Cleanup(func() {
		lookupAgentBaseURLHostIPs = previousLookup
	})

	client := NewAgentClient(2 * time.Second)
	err := client.Ack(context.Background(), PullSource{
		AgentBaseURL: "http://collector-agent.internal:9091",
	}, AgentAuthCredential{KeyID: "active", Key: "secret"}, AgentAckRequestPayload{
		BatchID: "batch-1",
		Status:  "ack",
	}, "req-1")
	if err == nil || !strings.Contains(err.Error(), "resolved address is not allowed") {
		t.Fatalf("Ack() error = %v, want resolved address rejection", err)
	}
}
