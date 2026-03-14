package backup

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

var ErrInvalidRepositoryLocation = errors.New("invalid repository location")

func resolveRepositoryLocation(settings map[string]interface{}) (string, error) {
	requestedLocation := ""
	if settings != nil {
		if location, ok := settings["location"].(string); ok {
			requestedLocation = location
		}
	}
	return normalizeRepositoryLocation(requestedLocation)
}

func normalizeRepositoryLocation(location string) (string, error) {
	basePath := strings.TrimSpace(os.Getenv("BACKUP_REPOSITORY_BASE_PATH"))
	if basePath == "" {
		basePath = defaultRepoPath
	}
	basePath = filepath.Clean(basePath)
	if !filepath.IsAbs(basePath) {
		return "", fmt.Errorf("%w: base path must be absolute", ErrInvalidRepositoryLocation)
	}

	location = strings.TrimSpace(location)
	if location == "" {
		return basePath, nil
	}

	location = filepath.Clean(location)
	if !filepath.IsAbs(location) {
		return "", fmt.Errorf("%w: location must be an absolute path", ErrInvalidRepositoryLocation)
	}

	relPath, err := filepath.Rel(basePath, location)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidRepositoryLocation, err)
	}
	if relPath == ".." || strings.HasPrefix(relPath, ".."+string(os.PathSeparator)) {
		return "", fmt.Errorf("%w: location must stay within %s", ErrInvalidRepositoryLocation, basePath)
	}

	return location, nil
}
