package service

import "testing"

func TestBuildAuthorizationContextWithExplicitMappingsAndEpoch(t *testing.T) {
	snapshot := BuildAuthorizationContextWithOptions(
		"alice",
		[]string{"viewer"},
		[]string{"users:read", "logs:read"},
		AuthorizationContextOptions{
			CapabilityAliases: map[string][]string{
				"users:read": {"iam.user.read"},
			},
			PermissionScopes: map[string][]string{
				"users:read": {"tenant"},
			},
			UseExplicitLegacyMappings: true,
			AuthzEpoch:                7,
		},
	)

	if snapshot.AuthzEpoch != 7 {
		t.Fatalf("AuthzEpoch=%d, want 7", snapshot.AuthzEpoch)
	}
	if len(snapshot.Capabilities) != 1 || snapshot.Capabilities[0] != "iam.user.read" {
		t.Fatalf("unexpected capabilities: %#v", snapshot.Capabilities)
	}
	if len(snapshot.Scopes) != 1 || snapshot.Scopes[0] != "tenant" {
		t.Fatalf("unexpected scopes: %#v", snapshot.Scopes)
	}
}

func TestBuildAuthorizationContextWithExplicitMappingsDoesNotFallbackToUsersWriteDefaults(t *testing.T) {
	snapshot := BuildAuthorizationContextWithOptions(
		"alice",
		[]string{"editor"},
		[]string{"users:write", "alerts:write"},
		AuthorizationContextOptions{
			CapabilityAliases: map[string][]string{
				"users:write": {"iam.user.update_status"},
			},
			PermissionScopes: map[string][]string{
				"users:write": {"tenant"},
			},
			UseExplicitLegacyMappings: true,
			AuthzEpoch:                9,
		},
	)

	if snapshot.AuthzEpoch != 9 {
		t.Fatalf("AuthzEpoch=%d, want 9", snapshot.AuthzEpoch)
	}
	if len(snapshot.Capabilities) != 1 || snapshot.Capabilities[0] != "iam.user.update_status" {
		t.Fatalf("unexpected capabilities: %#v", snapshot.Capabilities)
	}
	if len(snapshot.Scopes) != 1 || snapshot.Scopes[0] != "tenant" {
		t.Fatalf("unexpected scopes: %#v", snapshot.Scopes)
	}
}
