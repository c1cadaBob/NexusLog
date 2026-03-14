package ingest

import "strings"

func sanitizeIngestValidationError(err error, fallback string) string {
	if err == nil {
		return fallback
	}
	message := strings.TrimSpace(err.Error())
	if message == "" {
		return fallback
	}
	lower := strings.ToLower(message)
	if strings.Contains(lower, "invalid character") || strings.Contains(lower, "cannot unmarshal") {
		return fallback
	}
	return message
}
