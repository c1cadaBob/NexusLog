package backup

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	defaultESAddress     = "http://localhost:9200"
	defaultRepoPath     = "/usr/share/elasticsearch/data/snapshots"
	defaultRequestTimeout = 30 * time.Second
)

// Service interfaces with Elasticsearch Snapshot API.
type Service struct {
	endpoint string
	username string
	password string
	client   *http.Client
}

// NewService creates a backup service from environment.
func NewService() *Service {
	endpoint := strings.TrimSpace(os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"))
	if endpoint == "" {
		endpoint = strings.TrimSpace(os.Getenv("ELASTICSEARCH_URL"))
	}
	if endpoint == "" {
		endpoint = defaultESAddress
	}
	endpoint = strings.TrimRight(endpoint, "/")

	username := strings.TrimSpace(os.Getenv("INGEST_ES_USERNAME"))
	password := strings.TrimSpace(os.Getenv("INGEST_ES_PASSWORD"))
	if username == "" {
		username = strings.TrimSpace(os.Getenv("ELASTICSEARCH_USERNAME"))
		password = strings.TrimSpace(os.Getenv("ELASTICSEARCH_PASSWORD"))
	}

	timeout := defaultRequestTimeout
	if sec := os.Getenv("INGEST_ES_TIMEOUT_SEC"); sec != "" {
		if n, err := parsePositiveInt(sec); err == nil && n > 0 {
			timeout = time.Duration(n) * time.Second
		}
	}

	return &Service{
		endpoint: endpoint,
		username: username,
		password: password,
		client:   &http.Client{Timeout: timeout},
	}
}

// CreateRepository registers a snapshot repository (type: fs).
func (s *Service) CreateRepository(ctx context.Context, repoName string, settings map[string]interface{}) error {
	if repoName == "" {
		return fmt.Errorf("repository name is required")
	}
	path := defaultRepoPath
	if settings != nil {
		if loc, ok := settings["location"].(string); ok && loc != "" {
			path = loc
		}
	}
	body := map[string]interface{}{
		"type": "fs",
		"settings": map[string]interface{}{
			"location": path,
		},
	}
	raw, _ := json.Marshal(body)
	url := s.endpoint + "/_snapshot/" + repoName
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("create repository failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// CreateSnapshot creates a full/incremental snapshot.
func (s *Service) CreateSnapshot(ctx context.Context, repoName, snapshotName, indices, description string) error {
	if repoName == "" || snapshotName == "" {
		return fmt.Errorf("repository and snapshot name are required")
	}
	if indices == "" {
		indices = "nexuslog-*"
	}
	body := map[string]interface{}{
		"indices":     indices,
		"include_global_state": false,
	}
	if description != "" {
		body["metadata"] = map[string]interface{}{"description": description}
	}
	raw, _ := json.Marshal(body)
	url := s.endpoint + "/_snapshot/" + repoName + "/" + snapshotName
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("create snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// ListSnapshots lists all snapshots in a repository.
func (s *Service) ListSnapshots(ctx context.Context, repoName string) ([]SnapshotInfo, error) {
	if repoName == "" {
		return nil, fmt.Errorf("repository name is required")
	}
	url := s.endpoint + "/_snapshot/" + repoName + "/_all?ignore_unavailable=true"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("list snapshots failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	var result struct {
		Snapshots []SnapshotInfo `json:"snapshots"`
	}
	if err := json.Unmarshal(rb, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return result.Snapshots, nil
}

// SnapshotInfo represents a snapshot entry.
type SnapshotInfo struct {
	Snapshot   string            `json:"snapshot"`
	State      string            `json:"state"`
	Indices    []string          `json:"indices"`
	StartTime  string            `json:"start_time"`
	EndTime    string            `json:"end_time"`
	Metadata   map[string]any    `json:"metadata,omitempty"`
}

// GetSnapshotStatus returns the status of a snapshot.
func (s *Service) GetSnapshotStatus(ctx context.Context, repoName, snapshotName string) (*SnapshotStatus, error) {
	if repoName == "" || snapshotName == "" {
		return nil, fmt.Errorf("repository and snapshot name are required")
	}
	url := s.endpoint + "/_snapshot/" + repoName + "/" + snapshotName
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("snapshot not found")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("get snapshot status failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	var result struct {
		Snapshots []SnapshotInfo `json:"snapshots"`
	}
	if err := json.Unmarshal(rb, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	if len(result.Snapshots) == 0 {
		return nil, fmt.Errorf("snapshot not found")
	}
	info := result.Snapshots[0]
	return &SnapshotStatus{
		Snapshot:  info.Snapshot,
		State:    info.State,
		Indices:  info.Indices,
		StartTime: info.StartTime,
		EndTime:   info.EndTime,
		Metadata:  info.Metadata,
	}, nil
}

// SnapshotStatus represents snapshot status.
type SnapshotStatus struct {
	Snapshot  string         `json:"snapshot"`
	State     string         `json:"state"`
	Indices   []string       `json:"indices"`
	StartTime string         `json:"start_time"`
	EndTime   string         `json:"end_time"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// RestoreSnapshot restores a snapshot.
func (s *Service) RestoreSnapshot(ctx context.Context, repoName, snapshotName string, indices []string) error {
	if repoName == "" || snapshotName == "" {
		return fmt.Errorf("repository and snapshot name are required")
	}
	body := map[string]interface{}{}
	if len(indices) > 0 {
		body["indices"] = strings.Join(indices, ",")
	}
	raw, _ := json.Marshal(body)
	url := s.endpoint + "/_snapshot/" + repoName + "/" + snapshotName + "/_restore"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("restore snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// DeleteSnapshot deletes a snapshot.
func (s *Service) DeleteSnapshot(ctx context.Context, repoName, snapshotName string) error {
	if repoName == "" || snapshotName == "" {
		return fmt.Errorf("repository and snapshot name are required")
	}
	url := s.endpoint + "/_snapshot/" + repoName + "/" + snapshotName
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		return err
	}
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("delete snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// CancelSnapshot cancels an in-progress snapshot.
func (s *Service) CancelSnapshot(ctx context.Context, repoName, snapshotName string) error {
	if repoName == "" || snapshotName == "" {
		return fmt.Errorf("repository and snapshot name are required")
	}
	url := s.endpoint + "/_snapshot/" + repoName + "/" + snapshotName + "/_cancel"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return err
	}
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	rb, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("cancel snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// ListRepositories lists all snapshot repositories.
func (s *Service) ListRepositories(ctx context.Context) (map[string]RepositoryInfo, error) {
	url := s.endpoint + "/_snapshot/_all"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	rb, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("list repositories failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	var result map[string]RepositoryInfo
	if err := json.Unmarshal(rb, &result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}
	return result, nil
}

// RepositoryInfo represents a repository entry.
type RepositoryInfo struct {
	Type     string            `json:"type"`
	Settings map[string]string `json:"settings"`
}

func parsePositiveInt(s string) (int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty")
	}
	var n int
	_, err := fmt.Sscanf(s, "%d", &n)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("invalid")
	}
	return n, nil
}
