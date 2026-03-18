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

func TestBuildAuthorizationContextUsersReadStaysWithinIAMBoundary(t *testing.T) {
	ctx := buildAuthorizationContext("alice", []model.RoleData{{Name: "viewer"}}, []string{"users:read"})

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

	assertContains(ctx.Capabilities, "iam.user.read")
	assertContains(ctx.Capabilities, "iam.role.read")
	assertContains(ctx.Scopes, "tenant")
	assertNotContains(ctx.Capabilities, "auth.login_policy.read")
	assertNotContains(ctx.Capabilities, "settings.parameter.read")
	assertNotContains(ctx.Capabilities, "settings.global.read")
	assertNotContains(ctx.Capabilities, "settings.version.read")
	assertNotContains(ctx.Capabilities, "integration.webhook.read")
	assertNotContains(ctx.Capabilities, "integration.plugin.read")
}

func TestBuildAuthorizationContextUsersWriteStaysWithinIAMBoundary(t *testing.T) {
	ctx := buildAuthorizationContext("alice", []model.RoleData{{Name: "editor"}}, []string{"users:write"})

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

	assertContains(ctx.Capabilities, "iam.user.create")
	assertContains(ctx.Capabilities, "iam.user.delete")
	assertContains(ctx.Capabilities, "iam.user.grant_role")
	assertContains(ctx.Capabilities, "iam.user.revoke_role")
	assertContains(ctx.Capabilities, "iam.user.update_profile")
	assertContains(ctx.Capabilities, "iam.user.update_status")
	assertContains(ctx.Scopes, "tenant")
	assertNotContains(ctx.Capabilities, "iam.user.invite")
	assertNotContains(ctx.Capabilities, "iam.user.import")
	assertNotContains(ctx.Capabilities, "iam.user.reset_password")
	assertNotContains(ctx.Capabilities, "auth.login_policy.read")
	assertNotContains(ctx.Capabilities, "auth.login_policy.update")
	assertNotContains(ctx.Capabilities, "settings.parameter.update")
	assertNotContains(ctx.Capabilities, "settings.global.update")
	assertNotContains(ctx.Capabilities, "settings.version.rollback")
	assertNotContains(ctx.Capabilities, "integration.webhook.update")
	assertNotContains(ctx.Capabilities, "integration.plugin.install")
	assertNotContains(ctx.Capabilities, "ingest.source.update")
}
