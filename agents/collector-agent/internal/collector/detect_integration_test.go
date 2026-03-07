package collector

import (
	"fmt"
	"testing"
)

func TestDetectRealLogs(t *testing.T) {
	tests := []struct {
		input string
		wantLevel LogLevel
		wantTS    bool
	}{
		{`[274436] 2025-12-30 21:33:51.598 * Error * [ondisconnect][websocket_listener] websocket_listener::ondisconnect, err=49153`, LevelError, true},
		{`2026-03-06T11:50:20Z [ERROR] order-api: E2E验证日志 round=final seq=1`, LevelError, true},
		{`2026-02-25T15:50:34+0800 DEBUG error: Curl error (28): Timeout was reached`, LevelError, true},
		{`[3267]	2026-01-01 01:44:35.053	- Info  -	some message`, LevelInfo, true},
	}
	for _, tt := range tests {
		level := DetectLevel([]byte(tt.input))
		ts := DetectTimestamp([]byte(tt.input))
		fmt.Printf("Level=%-7s TS=%d Input=%.80s\n", level, ts, tt.input)
		if level != tt.wantLevel {
			t.Errorf("DetectLevel(%q) = %s, want %s", tt.input[:40], level, tt.wantLevel)
		}
		if tt.wantTS && ts == 0 {
			t.Errorf("DetectTimestamp(%q) = 0, want non-zero", tt.input[:40])
		}
	}
}
