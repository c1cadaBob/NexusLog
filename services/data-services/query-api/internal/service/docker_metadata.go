package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

var (
	queryDockerContainerIDPattern = regexp.MustCompile(`^[a-f0-9]{12,64}$`)
	queryDockerJSONLogNamePattern = regexp.MustCompile(`^[a-f0-9]{12,64}-json\.log$`)
	queryDockerMetadataCache      sync.Map
)

const (
	queryDockerContainersMountRoot = "/host-docker-containers"
	queryCanonicalDockerRoot       = "/var/lib/docker/containers"
)

type queryDockerMetadata struct {
	ContainerID    string
	ContainerName  string
	ComposeService string
}

type queryDockerConfigV2 struct {
	ID     string `json:"ID"`
	Name   string `json:"Name"`
	Config struct {
		Labels map[string]string `json:"Labels"`
	} `json:"Config"`
}

func resolveDisplayServiceFromDockerMetadata(source map[string]any) string {
	sourcePath := firstPathString(source, "source.path", "log.file.path", "source_path", "source")
	metadata, ok := resolveQueryDockerMetadata(sourcePath)
	if !ok {
		return ""
	}
	return sanitizeDisplayServiceName(firstNonEmptyDockerDisplayString(metadata.ComposeService, metadata.ContainerName))
}

func resolveQueryDockerMetadata(sourcePath string) (queryDockerMetadata, bool) {
	containerID, candidates, ok := queryDockerConfigCandidatePaths(sourcePath)
	if !ok {
		return queryDockerMetadata{}, false
	}
	cacheKey := dockerMetadataCacheKey(containerID)
	if cached, ok := queryDockerMetadataCache.Load(cacheKey); ok {
		metadata, _ := cached.(queryDockerMetadata)
		if metadata.ContainerID != "" || metadata.ContainerName != "" || metadata.ComposeService != "" {
			return metadata, true
		}
	}

	for _, candidate := range candidates {
		raw, err := os.ReadFile(candidate)
		if err != nil {
			continue
		}
		var cfg queryDockerConfigV2
		if err := json.Unmarshal(raw, &cfg); err != nil {
			continue
		}
		metadata := queryDockerMetadata{
			ContainerID:    firstNonEmptyDockerDisplayString(strings.TrimSpace(cfg.ID), containerID),
			ContainerName:  normalizeQueryDockerContainerName(cfg.Name),
			ComposeService: strings.TrimSpace(cfg.Config.Labels["com.docker.compose.service"]),
		}
		if metadata.ContainerID == "" && metadata.ContainerName == "" && metadata.ComposeService == "" {
			continue
		}
		queryDockerMetadataCache.Store(cacheKey, metadata)
		return metadata, true
	}
	return queryDockerMetadata{}, false
}

func queryDockerConfigCandidatePaths(sourcePath string) (string, []string, bool) {
	normalized := filepath.Clean(strings.TrimSpace(sourcePath))
	if normalized == "" {
		return "", nil, false
	}

	dir := filepath.Dir(normalized)
	containerID := strings.TrimSpace(filepath.Base(dir))
	fileName := strings.TrimSpace(filepath.Base(normalized))
	if !queryDockerContainerIDPattern.MatchString(strings.ToLower(containerID)) {
		return "", nil, false
	}
	if !strings.EqualFold(fileName, containerID+"-json.log") && !queryDockerJSONLogNamePattern.MatchString(strings.ToLower(fileName)) {
		return "", nil, false
	}

	mountRoot := strings.TrimSpace(os.Getenv("QUERY_DOCKER_CONTAINERS_ROOT"))
	if mountRoot == "" {
		mountRoot = queryDockerContainersMountRoot
	}

	candidates := make([]string, 0, 3)
	candidates = append(candidates, filepath.Join(dir, "config.v2.json"))
	switch {
	case strings.HasPrefix(dir, queryCanonicalDockerRoot+string(filepath.Separator)):
		candidates = append(candidates, filepath.Join(mountRoot, strings.TrimPrefix(dir, queryCanonicalDockerRoot), "config.v2.json"))
	case strings.HasPrefix(dir, mountRoot+string(filepath.Separator)):
		candidates = append(candidates, filepath.Join(queryCanonicalDockerRoot, strings.TrimPrefix(dir, mountRoot), "config.v2.json"))
	}

	deduped := make([]string, 0, len(candidates))
	seen := make(map[string]struct{}, len(candidates))
	for _, candidate := range candidates {
		resolved := filepath.Clean(candidate)
		if _, exists := seen[resolved]; exists {
			continue
		}
		seen[resolved] = struct{}{}
		deduped = append(deduped, resolved)
	}
	return containerID, deduped, true
}

func dockerMetadataCacheKey(containerID string) string {
	mountRoot := strings.TrimSpace(os.Getenv("QUERY_DOCKER_CONTAINERS_ROOT"))
	if mountRoot == "" {
		mountRoot = queryDockerContainersMountRoot
	}
	return mountRoot + "|" + strings.ToLower(strings.TrimSpace(containerID))
}

func normalizeQueryDockerContainerName(raw string) string {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "/")
	return strings.TrimSpace(trimmed)
}

func firstNonEmptyDockerDisplayString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
