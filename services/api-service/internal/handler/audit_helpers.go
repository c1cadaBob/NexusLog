package handler

import "strings"

func buildAuditDetails(values map[string]any) map[string]any {
	if len(values) == 0 {
		return nil
	}
	cleaned := make(map[string]any, len(values))
	for key, value := range values {
		switch typed := value.(type) {
		case nil:
			continue
		case string:
			if normalized := strings.TrimSpace(typed); normalized != "" {
				cleaned[key] = normalized
			}
		case *string:
			if typed != nil {
				if normalized := strings.TrimSpace(*typed); normalized != "" {
					cleaned[key] = normalized
				}
			}
		case []string:
			if len(typed) > 0 {
				cleaned[key] = typed
			}
		case []any:
			if len(typed) > 0 {
				cleaned[key] = typed
			}
		default:
			cleaned[key] = value
		}
	}
	if len(cleaned) == 0 {
		return nil
	}
	return cleaned
}
