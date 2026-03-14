package backup

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var (
	ErrInvalidBackupName = errors.New("invalid backup name")

	backupNamePattern = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
)

func normalizeRepositoryName(raw string) (string, error) {
	return normalizeBackupName("repository", raw)
}

func normalizeSnapshotName(raw string) (string, error) {
	return normalizeBackupName("snapshot", raw)
}

func normalizeBackupName(kind, raw string) (string, error) {
	name := strings.TrimSpace(raw)
	if name == "" {
		return "", fmt.Errorf("%s name is required", kind)
	}
	if !backupNamePattern.MatchString(name) {
		return "", fmt.Errorf("%w: %s name contains unsupported characters", ErrInvalidBackupName, kind)
	}
	return name, nil
}
