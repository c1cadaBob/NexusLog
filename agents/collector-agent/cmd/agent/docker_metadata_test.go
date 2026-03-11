package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nexuslog/collector-agent/plugins"
)

func TestEnrichDockerContainerMetadata_PrefersComposeService(t *testing.T) {
	containerID := strings.Repeat("a", 64)
	containerDir := filepath.Join(t.TempDir(), containerID)
	if err := os.MkdirAll(containerDir, 0o755); err != nil {
		t.Fatalf("mkdir container dir failed: %v", err)
	}
	configPath := filepath.Join(containerDir, "config.v2.json")
	config := `{"ID":"` + containerID + `","Name":"/nexuslog-query-api-1","Config":{"Labels":{"com.docker.compose.service":"query-api"}}}`
	if err := os.WriteFile(configPath, []byte(config), 0o644); err != nil {
		t.Fatalf("write config failed: %v", err)
	}

	record := plugins.Record{
		Source: filepath.Join(containerDir, containerID+"-json.log"),
		Metadata: map[string]string{
			"source_path": filepath.Join(containerDir, containerID+"-json.log"),
		},
	}

	enrichDockerContainerMetadata(&record)

	if got := record.Metadata["service.name"]; got != "query-api" {
		t.Fatalf("service.name=%q, want query-api", got)
	}
	if got := record.Metadata["service.instance.id"]; got != "nexuslog-query-api-1" {
		t.Fatalf("service.instance.id=%q, want nexuslog-query-api-1", got)
	}
	if got := record.Metadata["container.name"]; got != "nexuslog-query-api-1" {
		t.Fatalf("container.name=%q, want nexuslog-query-api-1", got)
	}
	if got := record.Metadata["docker.compose.service"]; got != "query-api" {
		t.Fatalf("docker.compose.service=%q, want query-api", got)
	}
	if got := record.Metadata["container.id"]; got != containerID {
		t.Fatalf("container.id=%q, want %s", got, containerID)
	}
}

func TestEnrichDockerContainerMetadata_PreservesExplicitServiceName(t *testing.T) {
	containerID := strings.Repeat("b", 64)
	containerDir := filepath.Join(t.TempDir(), containerID)
	if err := os.MkdirAll(containerDir, 0o755); err != nil {
		t.Fatalf("mkdir container dir failed: %v", err)
	}
	configPath := filepath.Join(containerDir, "config.v2.json")
	config := `{"ID":"` + containerID + `","Name":"/nexuslog-worker-1","Config":{"Labels":{"com.docker.compose.service":"worker"}}}`
	if err := os.WriteFile(configPath, []byte(config), 0o644); err != nil {
		t.Fatalf("write config failed: %v", err)
	}

	record := plugins.Record{
		Source: filepath.Join(containerDir, containerID+"-json.log"),
		Metadata: map[string]string{
			"service.name":        "billing-api",
			"service.instance.id": "billing-api-1",
		},
	}

	enrichDockerContainerMetadata(&record)

	if got := record.Metadata["service.name"]; got != "billing-api" {
		t.Fatalf("service.name=%q, want billing-api", got)
	}
	if got := record.Metadata["service.instance.id"]; got != "billing-api-1" {
		t.Fatalf("service.instance.id=%q, want billing-api-1", got)
	}
	if got := record.Metadata["container.name"]; got != "nexuslog-worker-1" {
		t.Fatalf("container.name=%q, want nexuslog-worker-1", got)
	}
}
