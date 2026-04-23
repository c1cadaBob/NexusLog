package ingest

import "testing"

func TestCursorSourcePathMatchesSupportsRecursiveGlob(t *testing.T) {
	patterns := []string{"/var/**/*.log"}
	if !cursorSourcePathMatches(patterns, "/var/log/app.log") {
		t.Fatal("expected recursive glob to match root log path")
	}
	if !cursorSourcePathMatches(patterns, "/var/log/nginx/access.log") {
		t.Fatal("expected recursive glob to match nested log path")
	}
	if cursorSourcePathMatches(patterns, "/opt/app/app.log") {
		t.Fatal("expected recursive glob not to match unrelated path")
	}
}

func TestPullSourcePatternOverlapSupportsRecursiveGlob(t *testing.T) {
	if !pullSourcePatternOverlap("/var/**/*.log", "/var/log/*.log") {
		t.Fatal("expected recursive source pattern to overlap nested log pattern")
	}
	if !pullSourcePatternOverlap("/var/**/*.log", "/var/log/nginx/*.log") {
		t.Fatal("expected recursive source pattern to overlap deeper nested log pattern")
	}
	if pullSourcePatternOverlap("/var/**/*.log", "/opt/**/*.log") {
		t.Fatal("expected different roots not to overlap")
	}
}
