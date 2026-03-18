package auth

import "testing"

func TestBuildAuthorizationContextForReservedSubjects(t *testing.T) {
	ctx := BuildAuthorizationContext(reservedUsernameSystemAutomation, []string{protectedRoleNameSystemAutomation}, []string{"audit:write"})
	if !ctx.ActorFlags["reserved"] {
		t.Fatal("expected reserved actor flag")
	}
	if ctx.ActorFlags["interactive_login_allowed"] {
		t.Fatal("expected interactive login to be disabled")
	}
	if !ctx.ActorFlags["system_subject"] {
		t.Fatal("expected system subject flag")
	}
	if len(ctx.Scopes) == 0 {
		t.Fatal("expected non-empty scopes")
	}
	if canBypassTenantScope(ctx) {
		t.Fatal("system automation should not bypass tenant scope for read APIs")
	}
}

func TestBuildAuthorizationContextMapsLegacyPermissions(t *testing.T) {
	ctx := BuildAuthorizationContext("alice", []string{"viewer"}, []string{"logs:read", "users:read"})
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
	assertContains(ctx.Capabilities, "log.query.read")
	assertContains(ctx.Capabilities, "iam.user.read")
	assertContains(ctx.Scopes, "tenant")
	assertContains(ctx.Scopes, "owned")
	assertNotContains(ctx.Capabilities, "dashboard.read")
	if ctx.AuthzEpoch != defaultAuthzEpoch {
		t.Fatalf("unexpected authz epoch: %d", ctx.AuthzEpoch)
	}
}

func TestBuildAuthorizationContextIncludesDirectCapabilitiesAndScopes(t *testing.T) {
	ctx := BuildAuthorizationContext("alice", []string{"viewer"}, []string{"log.query.read", "all_tenants"})
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
	assertContains(ctx.Capabilities, "log.query.read")
	assertContains(ctx.Scopes, "all_tenants")
	assertNotContains(ctx.Capabilities, "users:read")
	if !canBypassTenantScope(ctx) {
		t.Fatal("expected direct capability + scope to allow bypass")
	}
}
