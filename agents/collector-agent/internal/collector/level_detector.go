package collector

import (
	"bytes"
	"strings"
	"unicode"
)

// LogLevel represents the severity level of a log entry.
type LogLevel string

const (
	LevelFatal   LogLevel = "FATAL"
	LevelError   LogLevel = "ERROR"
	LevelWarn    LogLevel = "WARN"
	LevelInfo    LogLevel = "INFO"
	LevelDebug   LogLevel = "DEBUG"
	LevelTrace   LogLevel = "TRACE"
	LevelUnknown LogLevel = "UNKNOWN"
)

// DetectLevel applies a three-layer detection strategy to extract the log level
// from raw log data. It returns LevelUnknown for empty/binary/unrecognizable input.
//
// Layer 1: Bracket-prefix pattern  — e.g. [ERROR], [WARN], <ERROR>
// Layer 2: JSON field extraction   — e.g. {"level":"error"}, {"severity":"WARNING"}
// Layer 3: Standalone keyword scan — first word-boundary match wins
func DetectLevel(data []byte) LogLevel {
	if len(data) == 0 || isBinaryData(data) {
		return LevelUnknown
	}

	if lvl := detectBracketPrefix(data); lvl != LevelUnknown {
		return lvl
	}

	if lvl := detectJSONLevel(data); lvl != LevelUnknown {
		return lvl
	}

	if lvl := detectKeyword(data); lvl != LevelUnknown {
		return lvl
	}

	return LevelUnknown
}

// --- Layer 1: bracket-prefix patterns ---
// Matches patterns like [ERROR], [error], <WARN>, (FATAL)
// Also handles common syslog-style: "2024-01-01 ERROR ..."
func detectBracketPrefix(data []byte) LogLevel {
	text := bytesToUpper(data, 256)

	for _, pair := range bracketPairs {
		if idx := bytes.Index(text, []byte(pair.open)); idx >= 0 {
			endIdx := bytes.Index(text[idx+len(pair.open):], []byte(pair.close))
			if endIdx > 0 && endIdx <= 10 {
				candidate := string(text[idx+len(pair.open) : idx+len(pair.open)+endIdx])
				if lvl := resolveLevel(candidate); lvl != LevelUnknown {
					return lvl
				}
			}
		}
	}

	return LevelUnknown
}

var bracketPairs = []struct{ open, close string }{
	{"[", "]"},
	{"<", ">"},
	{"(", ")"},
}

// --- Layer 2: JSON field extraction ---
// Looks for "level":"..." or "severity":"..." patterns without full JSON parsing.
func detectJSONLevel(data []byte) LogLevel {
	if len(data) < 5 {
		return LevelUnknown
	}
	trimmed := bytes.TrimLeftFunc(data, unicode.IsSpace)
	if len(trimmed) == 0 || trimmed[0] != '{' {
		return LevelUnknown
	}

	lower := bytes.ToLower(trimmed)
	for _, key := range jsonLevelKeys {
		if val := extractJSONStringValue(lower, key); val != "" {
			if lvl := resolveLevel(strings.ToUpper(val)); lvl != LevelUnknown {
				return lvl
			}
		}
	}
	return LevelUnknown
}

var jsonLevelKeys = []string{
	`"level"`,
	`"severity"`,
	`"log_level"`,
	`"loglevel"`,
	`"lvl"`,
}

// extractJSONStringValue extracts the string value for a given key in JSON-like text.
// This is a lightweight parser that avoids importing encoding/json for performance.
func extractJSONStringValue(data []byte, key string) string {
	idx := bytes.Index(data, []byte(key))
	if idx < 0 {
		return ""
	}

	rest := data[idx+len(key):]
	rest = bytes.TrimLeftFunc(rest, unicode.IsSpace)
	if len(rest) == 0 || rest[0] != ':' {
		return ""
	}
	rest = rest[1:]
	rest = bytes.TrimLeftFunc(rest, unicode.IsSpace)
	if len(rest) == 0 || rest[0] != '"' {
		return ""
	}
	rest = rest[1:]
	endQuote := bytes.IndexByte(rest, '"')
	if endQuote <= 0 || endQuote > 30 {
		return ""
	}
	return string(rest[:endQuote])
}

// --- Layer 3: standalone keyword scan ---
// Scans for level keywords at word boundaries.
func detectKeyword(data []byte) LogLevel {
	text := bytesToUpper(data, 512)

	for _, kw := range keywordPriority {
		idx := bytes.Index(text, []byte(kw))
		if idx < 0 {
			continue
		}
		before := idx == 0 || !isAlphaNum(text[idx-1])
		after := idx+len(kw) >= len(text) || !isAlphaNum(text[idx+len(kw)])
		if before && after {
			return resolveLevel(kw)
		}
	}
	return LevelUnknown
}

// keywordPriority defines scan order: higher severity first.
var keywordPriority = []string{
	"FATAL", "PANIC", "CRITICAL",
	"ERROR", "ERR",
	"WARNING", "WARN",
	"INFO",
	"DEBUG", "DBG",
	"TRACE", "TRC",
}

func resolveLevel(s string) LogLevel {
	switch strings.ToUpper(strings.TrimSpace(s)) {
	case "FATAL", "PANIC", "CRITICAL", "ALERT", "EMERGENCY", "EMERG":
		return LevelFatal
	case "ERROR", "ERR":
		return LevelError
	case "WARN", "WARNING":
		return LevelWarn
	case "INFO", "INFORMATION", "NOTICE":
		return LevelInfo
	case "DEBUG", "DBG":
		return LevelDebug
	case "TRACE", "TRC":
		return LevelTrace
	default:
		return LevelUnknown
	}
}

func bytesToUpper(data []byte, maxLen int) []byte {
	n := len(data)
	if n > maxLen {
		n = maxLen
	}
	buf := make([]byte, n)
	for i := 0; i < n; i++ {
		c := data[i]
		if c >= 'a' && c <= 'z' {
			buf[i] = c - 32
		} else {
			buf[i] = c
		}
	}
	return buf
}

func isAlphaNum(c byte) bool {
	return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_'
}

func isBinaryData(data []byte) bool {
	limit := len(data)
	if limit > 512 {
		limit = 512
	}
	nullCount := 0
	for i := 0; i < limit; i++ {
		if data[i] == 0 {
			nullCount++
			if nullCount > 2 {
				return true
			}
		}
	}
	return false
}
