package main

import (
	"strings"
	"testing"
)

const testStrongAgentAPIKey = "nexuslog-local-dev-agent-key-20260314-change-before-production"

func TestResolveAgentAPIKeyConfig(t *testing.T) {
	testCases := []struct {
		name          string
		activeID      string
		activeKey     string
		nextID        string
		nextKey       string
		wantActiveID  string
		wantActiveKey string
		wantNextID    string
		wantNextKey   string
		wantErr       string
	}{
		{
			name:          "valid active key",
			activeKey:     testStrongAgentAPIKey,
			wantActiveID:  "active",
			wantActiveKey: testStrongAgentAPIKey,
			wantNextID:    "next",
		},
		{
			name:    "missing active key",
			wantErr: "AGENT_API_KEY_ACTIVE is required",
		},
		{
			name:      "reject weak default",
			activeKey: weakDefaultAgentAPIKey,
			wantErr:   "known weak default",
		},
		{
			name:      "reject short active key",
			activeKey: "short-agent-key",
			wantErr:   "at least",
		},
		{
			name:      "reject duplicate next key",
			activeKey: testStrongAgentAPIKey,
			nextKey:   testStrongAgentAPIKey,
			wantErr:   "must differ from AGENT_API_KEY_ACTIVE",
		},
		{
			name:      "reject duplicate next key id",
			activeID:  "shared",
			activeKey: testStrongAgentAPIKey,
			nextID:    "shared",
			nextKey:   "nexuslog-local-dev-agent-key-20260314-next-rotation",
			wantErr:   "must differ from AGENT_API_KEY_ACTIVE_ID",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("AGENT_API_KEY_ACTIVE_ID", tc.activeID)
			t.Setenv("AGENT_API_KEY_ACTIVE", tc.activeKey)
			t.Setenv("AGENT_API_KEY_NEXT_ID", tc.nextID)
			t.Setenv("AGENT_API_KEY_NEXT", tc.nextKey)

			gotActiveID, gotActiveKey, gotNextID, gotNextKey, err := resolveAgentAPIKeyConfig()
			if tc.wantErr != "" {
				if err == nil || !strings.Contains(err.Error(), tc.wantErr) {
					t.Fatalf("expected error containing %q, got %v", tc.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("resolve agent api key config: %v", err)
			}
			if gotActiveID != tc.wantActiveID {
				t.Fatalf("activeID=%q, want %q", gotActiveID, tc.wantActiveID)
			}
			if gotActiveKey != tc.wantActiveKey {
				t.Fatalf("activeKey=%q, want %q", gotActiveKey, tc.wantActiveKey)
			}
			if gotNextID != tc.wantNextID {
				t.Fatalf("nextID=%q, want %q", gotNextID, tc.wantNextID)
			}
			if gotNextKey != tc.wantNextKey {
				t.Fatalf("nextKey=%q, want %q", gotNextKey, tc.wantNextKey)
			}
		})
	}
}
