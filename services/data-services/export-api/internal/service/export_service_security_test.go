package service

import (
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/nexuslog/data-services/export-api/internal/repository"
)

func TestSanitizeExportJobErrorMessage_HidesInternalFailureDetails(t *testing.T) {
	raw := "es scroll failed: status=500 body={\"error\":\"index_not_found_exception\"}"
	got := sanitizeExportJobErrorMessage(raw)
	if got != exportJobFailedMessage {
		t.Fatalf("unexpected sanitized message: %q", got)
	}
	if strings.Contains(got, "500") || strings.Contains(got, "index_not_found_exception") {
		t.Fatalf("sanitized message leaked internals: %q", got)
	}
}

func TestJobToItem_OmitsFilePathAndSanitizesErrorMessage(t *testing.T) {
	filePath := "/tmp/nexuslog-exports/export-secret.json"
	rawErr := "open /tmp/nexuslog-exports/export-secret.json: permission denied"
	job := &repository.ExportJob{
		ID:           "job-1",
		Format:       "json",
		Status:       "failed",
		FilePath:     &filePath,
		ErrorMessage: &rawErr,
		CreatedAt:    time.Date(2026, 3, 14, 12, 0, 0, 0, time.UTC),
	}

	item := jobToItem(job)
	if item.FilePath != nil {
		t.Fatal("expected file path to be omitted from API item")
	}
	if item.ErrorMessage == nil || *item.ErrorMessage != exportJobFailedMessage {
		t.Fatalf("unexpected sanitized error message: %#v", item.ErrorMessage)
	}

	rawJSON, err := json.Marshal(item)
	if err != nil {
		t.Fatalf("marshal item: %v", err)
	}
	jsonText := string(rawJSON)
	if strings.Contains(jsonText, "file_path") || strings.Contains(jsonText, "/tmp/nexuslog-exports") {
		t.Fatalf("serialized item leaked internal file path: %s", jsonText)
	}
	if strings.Contains(jsonText, "permission denied") {
		t.Fatalf("serialized item leaked raw error details: %s", jsonText)
	}
}
