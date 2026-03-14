package main

import (
	"strings"
	"testing"
)

const testStrongSharedAgentKey = "nexuslog-local-dev-agent-key-20260314-change-before-production"

func TestResolveDefaultAgentCredential(t *testing.T) {
	testCases := []struct {
		name      string
		keyID     string
		key       string
		wantKeyID string
		wantKey   string
		wantErr   string
	}{
		{name: "missing key allowed", wantKeyID: "active", wantKey: ""},
		{name: "custom key id", keyID: "primary", key: testStrongSharedAgentKey, wantKeyID: "primary", wantKey: testStrongSharedAgentKey},
		{name: "reject weak default", key: weakDefaultAgentSharedKey, wantErr: "known weak default"},
		{name: "reject short key", key: "short-agent-key", wantErr: "at least"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("INGEST_DEFAULT_AGENT_KEY_ID", tc.keyID)
			t.Setenv("INGEST_DEFAULT_AGENT_KEY", tc.key)

			gotKeyID, gotKey, err := resolveDefaultAgentCredential()
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("expected error containing %q, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("resolve credential: %v", err)
			}
			if gotKeyID != tc.wantKeyID {
				t.Fatalf("keyID=%q, want %q", gotKeyID, tc.wantKeyID)
			}
			if gotKey != tc.wantKey {
				t.Fatalf("key=%q, want %q", gotKey, tc.wantKey)
			}
		})
	}
}
