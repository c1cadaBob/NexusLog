package ingest

import "testing"

func TestNormalizeSourcePathForDisplay(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "docker mounted path",
			in:   "/host-docker-containers/abc/abc-json.log",
			want: "/var/lib/docker/containers/abc/abc-json.log",
		},
		{
			name: "var log mounted path",
			in:   "/host-var-log/messages",
			want: "/var/log/messages",
		},
		{
			name: "unknown path unchanged",
			in:   "/data/custom/app.log",
			want: "/data/custom/app.log",
		},
		{
			name: "empty path",
			in:   "   ",
			want: "unknown",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeSourcePathForDisplay(tc.in)
			if got != tc.want {
				t.Fatalf("normalizeSourcePathForDisplay(%q)=%q, want %q", tc.in, got, tc.want)
			}
		})
	}
}
