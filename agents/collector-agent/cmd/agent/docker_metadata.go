package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/nexuslog/collector-agent/plugins"
)

var (
	dockerContainerIDPattern = regexp.MustCompile(`^[a-f0-9]{12,64}$`)
	dockerJSONLogNamePattern = regexp.MustCompile(`^[a-f0-9]{12,64}-json\.log$`)
	dockerMetadataCache      sync.Map
)

const (
	hostDockerContainersPrefix = "/host-docker-containers"
	canonicalDockerPrefix      = "/var/lib/docker/containers"
)

type dockerContainerMetadata struct {
	ID             string
	Name           string
	ComposeService string
}

type dockerConfigV2 struct {
	ID     string `json:"ID"`
	Name   string `json:"Name"`
	Config struct {
		Labels map[string]string `json:"Labels"`
	} `json:"Config"`
}

func enrichDockerContainerMetadata(record *plugins.Record) {
	if record == nil {
		return
	}
	sourcePath := firstNonEmptyString(
		strings.TrimSpace(record.Metadata["source_collect_path"]),
		strings.TrimSpace(record.Metadata["source_path"]),
		strings.TrimSpace(record.Source),
	)
	metadata, ok := resolveDockerContainerMetadata(sourcePath)
	if !ok {
		return
	}
	if record.Metadata == nil {
		record.Metadata = make(map[string]string)
	}
	if strings.TrimSpace(record.Metadata["container.id"]) == "" && metadata.ID != "" {
		record.Metadata["container.id"] = metadata.ID
	}
	if strings.TrimSpace(record.Metadata["container.name"]) == "" && metadata.Name != "" {
		record.Metadata["container.name"] = metadata.Name
	}
	if strings.TrimSpace(record.Metadata["docker.compose.service"]) == "" && metadata.ComposeService != "" {
		record.Metadata["docker.compose.service"] = metadata.ComposeService
	}

	desiredServiceName := firstNonEmptyString(metadata.ComposeService, metadata.Name)
	if shouldReplaceDockerDerivedServiceName(record.Metadata["service.name"], sourcePath, metadata.ID) && desiredServiceName != "" {
		record.Metadata["service.name"] = desiredServiceName
	}
	if shouldReplaceDockerDerivedInstanceID(record.Metadata["service.instance.id"], metadata.ID) && metadata.Name != "" {
		record.Metadata["service.instance.id"] = metadata.Name
	}
}

func resolveDockerContainerMetadata(sourcePath string) (dockerContainerMetadata, bool) {
	containerID, configPaths, ok := dockerConfigCandidatePaths(sourcePath)
	if !ok {
		return dockerContainerMetadata{}, false
	}
	if cached, ok := dockerMetadataCache.Load(containerID); ok {
		metadata, _ := cached.(dockerContainerMetadata)
		if metadata.ID != "" {
			return metadata, true
		}
	}
	for _, configPath := range configPaths {
		raw, err := os.ReadFile(configPath)
		if err != nil {
			continue
		}
		var cfg dockerConfigV2
		if err := json.Unmarshal(raw, &cfg); err != nil {
			continue
		}
		metadata := dockerContainerMetadata{
			ID:             firstNonEmptyString(strings.TrimSpace(cfg.ID), containerID),
			Name:           normalizeDockerContainerName(cfg.Name),
			ComposeService: strings.TrimSpace(cfg.Config.Labels["com.docker.compose.service"]),
		}
		if metadata.Name == "" && metadata.ComposeService == "" {
			continue
		}
		dockerMetadataCache.Store(containerID, metadata)
		return metadata, true
	}
	return dockerContainerMetadata{}, false
}

func dockerConfigCandidatePaths(sourcePath string) (string, []string, bool) {
	normalized := filepath.Clean(strings.TrimSpace(sourcePath))
	if normalized == "" {
		return "", nil, false
	}
	dir := filepath.Dir(normalized)
	containerID := strings.TrimSpace(filepath.Base(dir))
	fileName := strings.TrimSpace(filepath.Base(normalized))
	if !dockerContainerIDPattern.MatchString(containerID) {
		return "", nil, false
	}
	if !strings.EqualFold(fileName, containerID+"-json.log") && !dockerJSONLogNamePattern.MatchString(strings.ToLower(fileName)) {
		return "", nil, false
	}

	candidates := []string{filepath.Join(dir, "config.v2.json")}
	switch {
	case strings.HasPrefix(dir, canonicalDockerPrefix+string(filepath.Separator)):
		altDir := hostDockerContainersPrefix + strings.TrimPrefix(dir, canonicalDockerPrefix)
		candidates = append(candidates, filepath.Join(altDir, "config.v2.json"))
	case strings.HasPrefix(dir, hostDockerContainersPrefix+string(filepath.Separator)):
		altDir := canonicalDockerPrefix + strings.TrimPrefix(dir, hostDockerContainersPrefix)
		candidates = append(candidates, filepath.Join(altDir, "config.v2.json"))
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

func normalizeDockerContainerName(raw string) string {
	trimmed := strings.TrimSpace(raw)
	trimmed = strings.TrimPrefix(trimmed, "/")
	return strings.TrimSpace(trimmed)
}

func shouldReplaceDockerDerivedServiceName(current, sourcePath, containerID string) bool {
	trimmed := strings.TrimSpace(current)
	if trimmed == "" {
		return true
	}
	if strings.EqualFold(trimmed, containerID) {
		return true
	}
	sourceBase := strings.TrimSpace(filepath.Base(strings.TrimSpace(sourcePath)))
	if sourceBase != "" && strings.EqualFold(trimmed, sourceBase) {
		return true
	}
	return dockerJSONLogNamePattern.MatchString(strings.ToLower(trimmed))
}

func shouldReplaceDockerDerivedInstanceID(current, containerID string) bool {
	trimmed := strings.TrimSpace(current)
	return trimmed == "" || strings.EqualFold(trimmed, containerID)
}
