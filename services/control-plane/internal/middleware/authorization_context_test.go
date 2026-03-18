package middleware

import "testing"

func TestBuildAuthorizationContextIncludesDirectCapabilitiesAndScopes(t *testing.T) {
	ctx := BuildAuthorizationContext("alice", []string{"viewer"}, []string{"ingest.source.read", "tenant"})

	assertContains := func(values []string, target string) {
		t.Helper()
		for _, value := range values {
			if value == target {
				return
			}
		}
		t.Fatalf("expected %q in %#v", target, values)
	}
	assertNotContains := func(values []string, target string) {
		t.Helper()
		for _, value := range values {
			if value == target {
				t.Fatalf("did not expect %q in %#v", target, values)
			}
		}
	}

	assertContains(ctx.Capabilities, "ingest.source.read")
	assertContains(ctx.Scopes, "tenant")
	assertNotContains(ctx.Capabilities, "users:read")
}

func TestBuildAuthorizationContextWithExplicitMappingsAndEpoch(t *testing.T) {
	ctx := BuildAuthorizationContextWithOptions(
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
	if ctx.AuthzEpoch != 7 {
		t.Fatalf("AuthzEpoch=%d, want 7", ctx.AuthzEpoch)
	}
	if len(ctx.Capabilities) != 1 || ctx.Capabilities[0] != "iam.user.read" {
		t.Fatalf("unexpected capabilities: %#v", ctx.Capabilities)
	}
	if len(ctx.Scopes) != 1 || ctx.Scopes[0] != "tenant" {
		t.Fatalf("unexpected scopes: %#v", ctx.Scopes)
	}
}
