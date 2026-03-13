package ingest

import "testing"

func TestResolvePullSourceUpdateAction(t *testing.T) {
	paused := "paused"
	active := "active"
	disabled := "disabled"
	host := "10.0.0.10"

	tests := []struct {
		name string
		req  UpdatePullSourceRequest
		want string
	}{
		{name: "pause only", req: UpdatePullSourceRequest{Status: &paused}, want: "pull_sources.pause"},
		{name: "resume only", req: UpdatePullSourceRequest{Status: &active}, want: "pull_sources.resume"},
		{name: "disable only", req: UpdatePullSourceRequest{Status: &disabled}, want: "pull_sources.disable"},
		{name: "mixed update", req: UpdatePullSourceRequest{Status: &active, Host: &host}, want: "pull_sources.update"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolvePullSourceUpdateAction(tc.req); got != tc.want {
				t.Fatalf("resolvePullSourceUpdateAction() = %q, want %q", got, tc.want)
			}
		})
	}
}
