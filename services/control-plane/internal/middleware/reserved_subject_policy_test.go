package middleware

import "testing"

func TestApplyReservedSubjectPolicyOverridesActorFlags(t *testing.T) {
	snapshot := BuildAuthorizationContext("sys-superadmin", []string{"viewer"}, []string{"logs:read"})
	policy := reservedSubjectPolicy{
		Found:                   true,
		Reserved:                true,
		InteractiveLoginAllowed: false,
		SystemSubject:           true,
	}

	updated := applyReservedSubjectPolicy(snapshot, policy)
	if !updated.ActorFlags["reserved"] {
		t.Fatal("expected reserved flag to remain enabled")
	}
	if updated.ActorFlags["interactive_login_allowed"] {
		t.Fatal("expected interactive login to be disabled by policy")
	}
	if !updated.ActorFlags["system_subject"] {
		t.Fatal("expected system subject flag to be enabled by policy")
	}
	assertContains := func(values []string, target string) {
		t.Helper()
		for _, value := range values {
			if value == target {
				return
			}
		}
		t.Fatalf("expected %q in %#v", target, values)
	}
	assertContains(updated.Scopes, "system")
	assertContains(updated.Scopes, "tenant")
}
