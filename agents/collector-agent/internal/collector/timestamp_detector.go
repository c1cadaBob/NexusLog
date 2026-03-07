package collector

import (
	"regexp"
	"time"
)

var timestampPatterns = []struct {
	re     *regexp.Regexp
	layout string
}{
	// ISO 8601 with timezone: 2026-03-06T13:29:36.878Z or 2026-03-06T21:29:36+0800
	{regexp.MustCompile(`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})`), ""},
	// 2026-03-06 21:33:51.598 (space-separated datetime with optional millis)
	{regexp.MustCompile(`\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}(?:\.\d+)?`), ""},
	// 2026-03-06T21:33:51+0800 (with timezone offset no colon)
	{regexp.MustCompile(`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}`), ""},
}

var parseLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04:05.999999999Z0700",
	"2006-01-02T15:04:05.999999999Z07:00",
	"2006-01-02T15:04:05Z0700",
	"2006-01-02T15:04:05+0800",
	"2006-01-02T15:04:05-0700",
	"2006-01-02T15:04:05",
	"2006-01-02 15:04:05.999999999",
	"2006-01-02 15:04:05.999",
	"2006-01-02 15:04:05",
	"2006/01/02 15:04:05",
	"02/Jan/2006:15:04:05 -0700",
	"Jan  2 15:04:05",
	"Jan 2 15:04:05",
}

var tsRegex = regexp.MustCompile(
	`(\d{4}[-/]\d{2}[-/]\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)` +
		`|(\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})`,
)

// DetectTimestamp tries to extract the original log timestamp from raw log data.
// Returns Unix nanoseconds, or 0 if no timestamp could be parsed.
func DetectTimestamp(data []byte) int64 {
	if len(data) == 0 {
		return 0
	}

	limit := len(data)
	if limit > 200 {
		limit = 200
	}
	sample := string(data[:limit])

	match := tsRegex.FindString(sample)
	if match == "" {
		return 0
	}

	for _, layout := range parseLayouts {
		t, err := time.Parse(layout, match)
		if err == nil {
			if t.Year() == 0 {
				t = t.AddDate(time.Now().Year(), 0, 0)
			}
			return t.UnixNano()
		}
	}

	return 0
}
