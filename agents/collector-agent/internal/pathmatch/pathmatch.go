package pathmatch

import (
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

func HasWildcard(pattern string) bool {
	return strings.ContainsAny(pattern, "*?[")
}

func HasRecursiveWildcard(pattern string) bool {
	_, segments := splitPath(filepath.ToSlash(filepath.Clean(strings.TrimSpace(pattern))))
	for _, segment := range segments {
		if segment == "**" {
			return true
		}
	}
	return false
}

func Match(pattern, path string) (bool, error) {
	pattern = strings.TrimSpace(pattern)
	path = strings.TrimSpace(path)
	if pattern == "" || path == "" {
		return false, nil
	}
	if HasRecursiveWildcard(pattern) {
		return matchRecursive(pattern, path)
	}
	return filepath.Match(pattern, path)
}

func MatchPathOrBase(pattern, path string) (bool, error) {
	matched, err := Match(pattern, path)
	if err != nil || matched {
		return matched, err
	}
	normalizedPattern := filepath.ToSlash(strings.TrimSpace(pattern))
	if strings.Contains(normalizedPattern, "/") {
		return false, nil
	}
	return Match(pattern, filepath.Base(path))
}

func Expand(pattern string) ([]string, error) {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" {
		return nil, nil
	}
	if !HasRecursiveWildcard(pattern) {
		matches, err := filepath.Glob(pattern)
		if err != nil {
			return nil, err
		}
		sort.Strings(matches)
		return matches, nil
	}

	baseDir := RecursiveBaseDir(pattern)
	info, err := os.Stat(baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	if !info.IsDir() {
		matched, matchErr := Match(pattern, baseDir)
		if matchErr != nil || !matched {
			return nil, matchErr
		}
		return []string{baseDir}, nil
	}

	matches := make([]string, 0)
	walkErr := filepath.WalkDir(baseDir, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			if entry != nil && entry.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		matched, err := Match(pattern, path)
		if err != nil {
			return err
		}
		if matched {
			matches = append(matches, path)
		}
		return nil
	})
	if walkErr != nil {
		return nil, walkErr
	}
	sort.Strings(matches)
	return matches, nil
}

func RecursiveBaseDir(pattern string) string {
	pattern = strings.TrimSpace(pattern)
	if pattern == "" {
		return "."
	}
	cleaned := filepath.Clean(pattern)
	normalized := filepath.ToSlash(cleaned)
	absolute := strings.HasPrefix(normalized, "/")
	trimmed := strings.Trim(normalized, "/")
	if trimmed == "" {
		if absolute {
			return string(filepath.Separator)
		}
		return "."
	}

	segments := strings.Split(trimmed, "/")
	baseSegments := make([]string, 0, len(segments))
	for _, segment := range segments {
		if segment == "**" || HasWildcard(segment) {
			break
		}
		baseSegments = append(baseSegments, segment)
	}
	if len(baseSegments) == 0 {
		if absolute {
			return string(filepath.Separator)
		}
		return "."
	}
	base := filepath.FromSlash(strings.Join(baseSegments, "/"))
	if absolute {
		base = string(filepath.Separator) + base
	}
	return filepath.Clean(base)
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
