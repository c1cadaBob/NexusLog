package backup

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/nexuslog/control-plane/internal/httpguard"
)

const (
	defaultESAddress      = "http://localhost:9200"
	defaultRepoPath       = "/usr/share/elasticsearch/snapshots"
	defaultRequestTimeout = 30 * time.Second
)

// Service interfaces with Elasticsearch Snapshot API.
type Service struct {
	endpoint    string
	endpointErr error
	username    string
	password    string
	client      *http.Client
}

// NewService creates a backup service from environment.
func NewService() *Service {
	rawEndpoint := strings.TrimSpace(os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"))
	if rawEndpoint == "" {
		rawEndpoint = strings.TrimSpace(os.Getenv("ELASTICSEARCH_URL"))
	}
	if rawEndpoint == "" {
		rawEndpoint = defaultESAddress
	}
	normalizedEndpoint, endpointErr := httpguard.NormalizeBaseURL(rawEndpoint, httpguard.BaseURLOptions{
		AllowPrivate:  true,
		AllowLoopback: true,
	})

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
		endpoint:    normalizedEndpoint,
		endpointErr: endpointErr,
		username:    username,
		password:    password,
		client:      &http.Client{Timeout: timeout},
	}
}

func (s *Service) validate() error {
	if s == nil || s.client == nil {
		return fmt.Errorf("backup service is not configured")
	}
	if s.endpointErr != nil {
		return fmt.Errorf("es endpoint is invalid: %w", s.endpointErr)
	}
	if s.endpoint == "" {
		return fmt.Errorf("es endpoint is required")
	}
	return nil
}

// CreateRepository registers a snapshot repository (type: fs).
func (s *Service) CreateRepository(ctx context.Context, repoName string, settings map[string]interface{}) error {
	if err := s.validate(); err != nil {
		return err
	}
	repoName, err := normalizeRepositoryName(repoName)
	if err != nil {
		return err
	}
	path, err := resolveRepositoryLocation(settings)
	if err != nil {
		return err
	}
	body := map[string]interface{}{
		"type": "fs",
		"settings": map[string]interface{}{
			"location": path,
		},
	}
	raw, _ := json.Marshal(body)
	requestURL := s.endpoint + "/_snapshot/" + url.PathEscape(repoName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, bytes.NewReader(raw))
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
	rb, _ := httpguard.ReadLimitedBody(resp.Body, 0)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("create repository failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// CreateSnapshot creates a full/incremental snapshot.
func (s *Service) CreateSnapshot(ctx context.Context, repoName, snapshotName, indices, description string) error {
	if err := s.validate(); err != nil {
		return err
	}
	repoName, err := normalizeRepositoryName(repoName)
	if err != nil {
		return err
	}
	snapshotName, err = normalizeSnapshotName(snapshotName)
	if err != nil {
		return err
	}
	if indices == "" {
		indices = "nexuslog-*"
	}
	body := map[string]interface{}{
		"indices":              indices,
		"include_global_state": false,
	}
	if description != "" {
		body["metadata"] = map[string]interface{}{"description": description}
	}
	raw, _ := json.Marshal(body)
	requestURL := s.endpoint + "/_snapshot/" + url.PathEscape(repoName) + "/" + url.PathEscape(snapshotName)
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, requestURL, bytes.NewReader(raw))
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
	rb, _ := httpguard.ReadLimitedBody(resp.Body, 0)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("create snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// ListSnapshots lists all snapshots in a repository.
func (s *Service) ListSnapshots(ctx context.Context, repoName string) ([]SnapshotInfo, error) {
	if err := s.validate(); err != nil {
		return nil, err
	}
	repoName, err := normalizeRepositoryName(repoName)
	if err != nil {
		return nil, err
	}
	requestURL := s.endpoint + "/_snapshot/" + url.PathEscape(repoName) + "/_all?ignore_unavailable=true"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
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
	rb, err := httpguard.ReadLimitedBody(resp.Body, 0)
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
	Snapshot  string         `json:"snapshot"`
	State     string         `json:"state"`
	Indices   []string       `json:"indices"`
	StartTime string         `json:"start_time"`
	EndTime   string         `json:"end_time"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

// GetSnapshotStatus returns the status of a snapshot.
func (s *Service) GetSnapshotStatus(ctx context.Context, repoName, snapshotName string) (*SnapshotStatus, error) {
	if err := s.validate(); err != nil {
		return nil, err
	}
	repoName, err := normalizeRepositoryName(repoName)
	if err != nil {
		return nil, err
	}
	snapshotName, err = normalizeSnapshotName(snapshotName)
	if err != nil {
		return nil, err
	}
	requestURL := s.endpoint + "/_snapshot/" + url.PathEscape(repoName) + "/" + url.PathEscape(snapshotName)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
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
	rb, err := httpguard.ReadLimitedBody(resp.Body, 0)
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
		State:     info.State,
		Indices:   info.Indices,
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
	if err := s.validate(); err != nil {
		return err
	}
	repoName, err := normalizeRepositoryName(repoName)
	if err != nil {
		return err
	}
	snapshotName, err = normalizeSnapshotName(snapshotName)
	if err != nil {
		return err
	}
	body := map[string]interface{}{}
	if len(indices) > 0 {
		body["indices"] = strings.Join(indices, ",")
	}
	raw, _ := json.Marshal(body)
	requestURL := s.endpoint + "/_snapshot/" + url.PathEscape(repoName) + "/" + url.PathEscape(snapshotName) + "/_restore"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, bytes.NewReader(raw))
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
	rb, _ := httpguard.ReadLimitedBody(resp.Body, 0)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("restore snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// DeleteSnapshot deletes a snapshot.
func (s *Service) DeleteSnapshot(ctx context.Context, repoName, snapshotName string) error {
	if err := s.validate(); err != nil {
		return err
	}
	repoName, err := normalizeRepositoryName(repoName)
	if err != nil {
		return err
	}
	snapshotName, err = normalizeSnapshotName(snapshotName)
	if err != nil {
		return err
	}
	requestURL := s.endpoint + "/_snapshot/" + url.PathEscape(repoName) + "/" + url.PathEscape(snapshotName)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, requestURL, nil)
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
	rb, _ := httpguard.ReadLimitedBody(resp.Body, 0)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("delete snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// CancelSnapshot cancels an in-progress snapshot.
func (s *Service) CancelSnapshot(ctx context.Context, repoName, snapshotName string) error {
	if err := s.validate(); err != nil {
		return err
	}
	repoName, err := normalizeRepositoryName(repoName)
	if err != nil {
		return err
	}
	snapshotName, err = normalizeSnapshotName(snapshotName)
	if err != nil {
		return err
	}
	requestURL := s.endpoint + "/_snapshot/" + url.PathEscape(repoName) + "/" + url.PathEscape(snapshotName) + "/_cancel"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, requestURL, nil)
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
	rb, _ := httpguard.ReadLimitedBody(resp.Body, 0)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("cancel snapshot failed: status=%d body=%s", resp.StatusCode, string(rb))
	}
	return nil
}

// ListRepositories lists all snapshot repositories.
func (s *Service) ListRepositories(ctx context.Context) (map[string]RepositoryInfo, error) {
	if err := s.validate(); err != nil {
		return nil, err
	}
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
	rb, err := httpguard.ReadLimitedBody(resp.Body, 0)
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
