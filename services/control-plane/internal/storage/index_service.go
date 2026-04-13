package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/nexuslog/control-plane/internal/httpguard"
)

const (
	defaultElasticsearchEndpoint = "http://elasticsearch:9200"
	defaultRequestTimeout        = 10 * time.Second
)

type IndexHealth string

type IndexStatus string

const (
	IndexHealthGreen   IndexHealth = "Green"
	IndexHealthYellow  IndexHealth = "Yellow"
	IndexHealthRed     IndexHealth = "Red"
	IndexHealthUnknown IndexHealth = "Unknown"

	IndexStatusOpen   IndexStatus = "Open"
	IndexStatusClosed IndexStatus = "Closed"
)

type IndexItem struct {
	Name           string      `json:"name"`
	Health         IndexHealth `json:"health"`
	Status         IndexStatus `json:"status"`
	PrimaryShards  int         `json:"primary_shards"`
	ReplicaShards  int         `json:"replica_shards"`
	DocsCount      int64       `json:"docs_count"`
	StoreSizeBytes int64       `json:"store_size_bytes"`
}

type IndexSummary struct {
	Total          int   `json:"total"`
	Green          int   `json:"green"`
	Yellow         int   `json:"yellow"`
	Red            int   `json:"red"`
	DocsCount      int64 `json:"docs_count"`
	StoreSizeBytes int64 `json:"store_size_bytes"`
}

type IndexListResult struct {
	Items       []IndexItem  `json:"items"`
	Summary     IndexSummary `json:"summary"`
	RefreshedAt string       `json:"refreshed_at"`
}

type catIndexItem struct {
	Health    string `json:"health"`
	Status    string `json:"status"`
	Index     string `json:"index"`
	Primary   string `json:"pri"`
	Replica   string `json:"rep"`
	DocsCount string `json:"docs.count"`
	StoreSize string `json:"store.size"`
}

type IndexService struct {
	endpoint    string
	endpointErr error
	username    string
	password    string
	client      *http.Client
}

func NewIndexServiceFromEnv() *IndexService {
	endpoint := resolveFirstAddress(
		os.Getenv("SEARCH_ELASTICSEARCH_ADDRESSES"),
		os.Getenv("DATABASE_ELASTICSEARCH_ADDRESSES"),
		os.Getenv("INGEST_ES_ENDPOINT"),
		defaultElasticsearchEndpoint,
	)
	normalizedEndpoint, endpointErr := httpguard.NormalizeBaseURL(endpoint, httpguard.BaseURLOptions{
		AllowPrivate:  true,
		AllowLoopback: true,
	})

	return &IndexService{
		endpoint:    normalizedEndpoint,
		endpointErr: endpointErr,
		username: strings.TrimSpace(firstNonEmpty(
			os.Getenv("DATABASE_ELASTICSEARCH_USERNAME"),
			os.Getenv("ELASTICSEARCH_USERNAME"),
		)),
		password: strings.TrimSpace(firstNonEmpty(
			os.Getenv("DATABASE_ELASTICSEARCH_PASSWORD"),
			os.Getenv("ELASTICSEARCH_PASSWORD"),
		)),
		client: &http.Client{Timeout: defaultRequestTimeout},
	}
}

func (s *IndexService) doRequest(ctx context.Context, path string) ([]byte, error) {
	if s == nil || s.client == nil {
		return nil, fmt.Errorf("storage service is not configured")
	}
	if s.endpointErr != nil {
		return nil, fmt.Errorf("elasticsearch endpoint is invalid: %w", s.endpointErr)
	}
	if strings.TrimSpace(s.endpoint) == "" {
		return nil, fmt.Errorf("elasticsearch endpoint is not configured")
	}

	requestURL := s.endpoint + path
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, http.NoBody)
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

	raw, err := httpguard.ReadLimitedBody(resp.Body, 0)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("elasticsearch request failed: status=%d body=%s", resp.StatusCode, string(raw))
	}
	return raw, nil
}

func (s *IndexService) ListIndices(ctx context.Context) (IndexListResult, error) {
	raw, err := s.doRequest(ctx, "/_cat/indices?format=json&bytes=b&expand_wildcards=all&h=health,status,index,pri,rep,docs.count,store.size")
	if err != nil {
		return IndexListResult{}, err
	}

	var payload []catIndexItem
	if err := json.Unmarshal(raw, &payload); err != nil {
		return IndexListResult{}, fmt.Errorf("decode cat indices response: %w", err)
	}

	items := make([]IndexItem, 0, len(payload))
	summary := IndexSummary{}
	for _, item := range payload {
		indexItem := IndexItem{
			Name:           strings.TrimSpace(item.Index),
			Health:         normalizeIndexHealth(item.Health),
			Status:         normalizeIndexStatus(item.Status),
			PrimaryShards:  parseInt(item.Primary),
			ReplicaShards:  parseInt(item.Replica),
			DocsCount:      parseInt64(item.DocsCount),
			StoreSizeBytes: parseInt64(item.StoreSize),
		}
		if indexItem.Name == "" {
			continue
		}
		items = append(items, indexItem)
		summary.Total++
		summary.DocsCount += maxInt64(indexItem.DocsCount, 0)
		summary.StoreSizeBytes += maxInt64(indexItem.StoreSizeBytes, 0)
		switch indexItem.Health {
		case IndexHealthGreen:
			summary.Green++
		case IndexHealthYellow:
			summary.Yellow++
		case IndexHealthRed:
			summary.Red++
		}
	}

	return IndexListResult{
		Items:       items,
		Summary:     summary,
		RefreshedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func normalizeIndexHealth(raw string) IndexHealth {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "green":
		return IndexHealthGreen
	case "yellow":
		return IndexHealthYellow
	case "red":
		return IndexHealthRed
	default:
		return IndexHealthUnknown
	}
}

func normalizeIndexStatus(raw string) IndexStatus {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "open":
		return IndexStatusOpen
	case "close", "closed":
		return IndexStatusClosed
	default:
		return IndexStatusClosed
	}
}

func parseInt(raw string) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil {
		return 0
	}
	return parsed
}

func parseInt64(raw string) int64 {
	parsed, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err == nil {
		return parsed
	}
	return 0
}

func maxInt64(value, fallback int64) int64 {
	if value < 0 {
		return fallback
	}
	return value
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func resolveFirstAddress(values ...string) string {
	for _, value := range values {
		for _, candidate := range strings.Split(value, ",") {
			if trimmed := strings.TrimSpace(candidate); trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}
