package service

import (
	"testing"

	"github.com/nexuslog/api-service/internal/model"
)

func TestBuildAuthorizationContextForReservedSubjects(t *testing.T) {
	ctx := buildAuthorizationContext(reservedUsernameSystemAutomation, []model.RoleData{{Name: protectedRoleNameSystemAutomation}}, []string{"audit:read"})
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
}

func TestBuildAuthorizationContextMapsLegacyPermissions(t *testing.T) {
	ctx := buildAuthorizationContext("alice", []model.RoleData{{Name: "viewer"}}, []string{"logs:read", "users:read"})
	assertContains := func(values []string, target string) {
		t.Helper()
		for _, value := range values {
			if value == target {
				return
			}
		}
		t.Fatalf("expected %q in %#v", target, values)
	}
	assertContains(ctx.Capabilities, "log.query.read")
	assertContains(ctx.Capabilities, "iam.user.read")
	assertContains(ctx.Scopes, "tenant")
	assertContains(ctx.Scopes, "owned")
	assertNotContains := func(values []string, target string) {
		t.Helper()
		for _, value := range values {
			if value == target {
				t.Fatalf("did not expect %q in %#v", target, values)
			}
		}
	}
	assertNotContains(ctx.Capabilities, "dashboard.read")
	assertNotContains(ctx.Capabilities, "auth.session.read")
	if ctx.AuthzEpoch != defaultAuthzEpoch {
		t.Fatalf("unexpected authz epoch: %d", ctx.AuthzEpoch)
	}
	if ctx.ActorFlags["reserved"] {
		t.Fatal("expected normal user not reserved")
	}
	if !ctx.ActorFlags["interactive_login_allowed"] {
		t.Fatal("expected interactive login allowed")
	}
}

func TestBuildAuthorizationContextIncludesDirectCapabilitiesAndScopes(t *testing.T) {
	ctx := buildAuthorizationContext("alice", []model.RoleData{{Name: "viewer"}}, []string{"ingest.source.read", "tenant"})

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
