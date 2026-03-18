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
