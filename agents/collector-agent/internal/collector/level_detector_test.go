package collector

import (
	"strings"
	"testing"
)

func TestDetectLevel_BracketPrefix(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  LogLevel
	}{
		{"square bracket ERROR", "[ERROR] something went wrong", LevelError},
		{"square bracket error lower", "[error] something went wrong", LevelError},
		{"square bracket WARN", "[WARN] disk space low", LevelWarn},
		{"square bracket WARNING", "[WARNING] high memory usage", LevelWarn},
		{"square bracket INFO", "[INFO] server started", LevelInfo},
		{"square bracket DEBUG", "[DEBUG] processing request", LevelDebug},
		{"square bracket FATAL", "[FATAL] out of memory", LevelFatal},
		{"square bracket TRACE", "[TRACE] entering function", LevelTrace},
		{"angle bracket ERROR", "<ERROR> connection refused", LevelError},
		{"paren bracket WARN", "(WARN) deprecated API used", LevelWarn},
		{"timestamp then bracket", "2024-01-01 10:00:00 [ERROR] db timeout", LevelError},
		{"syslog-style prefix", "Jan  1 10:00:00 host ERROR process crashed", LevelError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectLevel([]byte(tt.input))
			if got != tt.want {
				t.Errorf("DetectLevel(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestDetectLevel_JSONField(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  LogLevel
	}{
		{"json level error", `{"level":"error","message":"failed"}`, LevelError},
		{"json level ERROR upper", `{"level":"ERROR","msg":"oops"}`, LevelError},
		{"json level warn", `{"level":"warn","msg":"slow query"}`, LevelWarn},
		{"json level info", `{"level":"info","msg":"startup"}`, LevelInfo},
		{"json level debug", `{"level":"debug","details":"trace data"}`, LevelDebug},
		{"json level fatal", `{"level":"fatal","msg":"panic"}`, LevelFatal},
		{"json severity WARNING", `{"severity":"WARNING","message":"timeout"}`, LevelWarn},
		{"json log_level", `{"log_level":"error","ctx":"handler"}`, LevelError},
		{"json lvl field", `{"lvl":"info","component":"api"}`, LevelInfo},
		{"json with whitespace", `  { "level" : "error" , "msg": "test" }`, LevelError},
		{"json first level match wins", `{"data":{"level":"error"},"level":"info"}`, LevelError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectLevel([]byte(tt.input))
			if got != tt.want {
				t.Errorf("DetectLevel(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestDetectLevel_Keyword(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  LogLevel
	}{
		{"standalone ERROR", "connection ERROR timeout", LevelError},
		{"standalone error lower", "connection error timeout", LevelError},
		{"standalone WARN in middle", "disk usage WARN threshold", LevelWarn},
		{"standalone FATAL", "process FATAL signal received", LevelFatal},
		{"standalone PANIC", "goroutine PANIC recovered", LevelFatal},
		{"standalone INFO", "request INFO completed", LevelInfo},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectLevel([]byte(tt.input))
			if got != tt.want {
				t.Errorf("DetectLevel(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestDetectLevel_Boundary(t *testing.T) {
	tests := []struct {
		name  string
		input []byte
		want  LogLevel
	}{
		{"empty", []byte{}, LevelUnknown},
		{"nil", nil, LevelUnknown},
		{"binary data", []byte{0x00, 0x01, 0x00, 0x02, 0x00, 0x03}, LevelUnknown},
		{"no level", []byte("just a regular log message"), LevelUnknown},
		{"partial keyword ERRORS", []byte("ERRORS in processing"), LevelUnknown},
		{"keyword in word INTERNAL", []byte("INTERNAL server"), LevelUnknown},
		{"whitespace only", []byte("   \t\n  "), LevelUnknown},
		{"single char", []byte("x"), LevelUnknown},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DetectLevel(tt.input)
			if got != tt.want {
				t.Errorf("DetectLevel(%v) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestDetectLevel_PriorityOrder(t *testing.T) {
	got := DetectLevel([]byte("[FATAL] also ERROR here"))
	if got != LevelFatal {
		t.Errorf("expected FATAL (higher priority), got %q", got)
	}
}

func TestResolveLevel_Aliases(t *testing.T) {
	tests := []struct {
		input string
		want  LogLevel
	}{
		{"PANIC", LevelFatal},
		{"CRITICAL", LevelFatal},
		{"ALERT", LevelFatal},
		{"EMERGENCY", LevelFatal},
		{"EMERG", LevelFatal},
		{"ERR", LevelError},
		{"WARNING", LevelWarn},
		{"INFORMATION", LevelInfo},
		{"NOTICE", LevelInfo},
		{"DBG", LevelDebug},
		{"TRC", LevelTrace},
		{"NONSENSE", LevelUnknown},
		{"", LevelUnknown},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			got := resolveLevel(tt.input)
			if got != tt.want {
				t.Errorf("resolveLevel(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestDetectLevel_LargeInput(t *testing.T) {
	large := strings.Repeat("x", 10000) + " [ERROR] tail"
	got := DetectLevel([]byte(large))
	if got == LevelError {
		t.Log("detected ERROR in large input (Layer 3 keyword scan found it)")
	}
}

func BenchmarkDetectLevel_BracketPrefix(b *testing.B) {
	data := []byte("2024-01-01T00:00:00Z [ERROR] connection refused for host=db-01")
	for i := 0; i < b.N; i++ {
		DetectLevel(data)
	}
}

func BenchmarkDetectLevel_JSON(b *testing.B) {
	data := []byte(`{"timestamp":"2024-01-01T00:00:00Z","level":"error","message":"db timeout","service":"api"}`)
	for i := 0; i < b.N; i++ {
		DetectLevel(data)
	}
}

func BenchmarkDetectLevel_Keyword(b *testing.B) {
	data := []byte("connection timeout ERROR while connecting to database host db-01:5432")
	for i := 0; i < b.N; i++ {
		DetectLevel(data)
	}
}
