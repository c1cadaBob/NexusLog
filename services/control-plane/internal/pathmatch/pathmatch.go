package pathmatch

import (
	"path/filepath"
	"strings"
)

func HasWildcard(pattern string) bool {
	return strings.ContainsAny(pattern, "*?[")
}

func Match(pattern, path string) (bool, error) {
	pattern = strings.TrimSpace(pattern)
	path = strings.TrimSpace(path)
	if pattern == "" || path == "" {
		return false, nil
	}
	if hasRecursiveWildcard(pattern) {
		return matchRecursive(pattern, path)
	}
	return filepath.Match(pattern, path)
}

func StaticPrefix(pattern string) string {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" {
		return ""
	}
	cleaned := filepath.Clean(pattern)
	normalized := filepath.ToSlash(cleaned)
	absolute := strings.HasPrefix(normalized, "/")
	trimmed := strings.Trim(normalized, "/")
	if trimmed == "" {
		if absolute {
			return string(filepath.Separator)
		}
		return ""
	}
	segments := strings.Split(trimmed, "/")
	prefixSegments := make([]string, 0, len(segments))
	for _, segment := range segments {
		if segment == "**" || HasWildcard(segment) {
			break
		}
		prefixSegments = append(prefixSegments, segment)
	}
	if len(prefixSegments) == 0 {
		if absolute {
			return string(filepath.Separator)
		}
		return ""
	}
	prefix := filepath.FromSlash(strings.Join(prefixSegments, "/"))
	if absolute {
		prefix = string(filepath.Separator) + prefix
	}
	return filepath.Clean(prefix)
}

func hasRecursiveWildcard(pattern string) bool {
	_, segments := splitPath(filepath.ToSlash(filepath.Clean(strings.TrimSpace(pattern))))
	for _, segment := range segments {
		if segment == "**" {
			return true
		}
	}
	return false
}

func matchRecursive(pattern, path string) (bool, error) {
	patternAbsolute, patternSegments := splitPath(filepath.ToSlash(filepath.Clean(pattern)))
	pathAbsolute, pathSegments := splitPath(filepath.ToSlash(filepath.Clean(path)))
	if patternAbsolute && !pathAbsolute {
		return false, nil
	}
	return matchSegments(patternSegments, pathSegments)
}

func matchSegments(patternSegments, pathSegments []string) (bool, error) {
	if len(patternSegments) == 0 {
		return len(pathSegments) == 0, nil
	}
	if patternSegments[0] == "**" {
		for len(patternSegments) > 1 && patternSegments[1] == "**" {
			patternSegments = patternSegments[1:]
		}
		if len(patternSegments) == 1 {
			return true, nil
		}
		for consumed := 0; consumed <= len(pathSegments); consumed++ {
			matched, err := matchSegments(patternSegments[1:], pathSegments[consumed:])
			if err != nil || matched {
				return matched, err
			}
		}
		return false, nil
	}
	if len(pathSegments) == 0 {
		return false, nil
	}
	matched, err := filepath.Match(patternSegments[0], pathSegments[0])
	if err != nil || !matched {
		return matched, err
	}
	return matchSegments(patternSegments[1:], pathSegments[1:])
}

func splitPath(value string) (bool, []string) {
	absolute := strings.HasPrefix(value, "/")
	trimmed := strings.Trim(value, "/")
	if trimmed == "" || trimmed == "." {
		return absolute, nil
	}
	return absolute, strings.Split(trimmed, "/")
}
