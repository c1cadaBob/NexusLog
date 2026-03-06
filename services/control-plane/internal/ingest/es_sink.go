package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// ESSink 定义写入 Elasticsearch 的最小能力。
type ESSink struct {
	endpoint  string
	indexName string
	username  string
	password  string
	client    *http.Client
}

// ESSinkResult 返回写入统计结果。
type ESSinkResult struct {
	Indexed int
	Failed  int
}

type esBulkResponse struct {
	Errors bool            `json:"errors"`
	Items  []esBulkItemRaw `json:"items"`
}

type esBulkItemRaw map[string]esBulkItem

type esBulkItem struct {
	Status int `json:"status"`
	Error  any `json:"error"`
}

// NewESSink 创建 ES 批量写入器。
func NewESSink(endpoint, indexName, username, password string, timeout time.Duration) *ESSink {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &ESSink{
		endpoint:  strings.TrimRight(strings.TrimSpace(endpoint), "/"),
		indexName: strings.TrimSpace(indexName),
		username:  strings.TrimSpace(username),
		password:  strings.TrimSpace(password),
		client:    &http.Client{Timeout: timeout},
	}
}

// WriteRecords 将 agent 拉取批次写入 ES _bulk。
func (s *ESSink) WriteRecords(ctx context.Context, task PullTask, source PullSource, agentID string, response AgentPullResponse) (ESSinkResult, error) {
	if s == nil || s.client == nil {
		return ESSinkResult{}, fmt.Errorf("es sink is not configured")
	}
	if s.endpoint == "" {
		return ESSinkResult{}, fmt.Errorf("es endpoint is empty")
	}
	if s.indexName == "" {
		return ESSinkResult{}, fmt.Errorf("es index is empty")
	}
	if len(response.Records) == 0 {
		return ESSinkResult{}, nil
	}

	agentID = strings.TrimSpace(agentID)
	if agentID == "" {
		agentID = strings.TrimSpace(source.SourceID)
	}

	tenantID, retentionPolicy := resolveGovernanceFromTask(task)
	batchID := strings.TrimSpace(response.BatchID)

	var payload bytes.Buffer
	for _, record := range response.Records {
		displaySourcePath := normalizeSourcePathForDisplay(strings.TrimSpace(record.Source))
		doc := BuildLogDocument(record, agentID, batchID, displaySourcePath, tenantID, retentionPolicy)
		eventID := doc.Event.EventID

		action := map[string]any{
			"index": map[string]any{
				"_index": s.indexName,
				"_id":    eventID,
			},
		}
		actionRaw, _ := json.Marshal(action)
		payload.Write(actionRaw)
		payload.WriteByte('\n')

		esDoc := doc.ToESDocument()
		if len(record.Metadata) > 0 {
			esDoc["metadata"] = record.Metadata
		}
		docRaw, _ := json.Marshal(esDoc)
		payload.Write(docRaw)
		payload.WriteByte('\n')
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint+"/_bulk", &payload)
	if err != nil {
		return ESSinkResult{}, err
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	if strings.TrimSpace(task.RequestID) != "" {
		req.Header.Set("X-Request-ID", strings.TrimSpace(task.RequestID))
	}
	if s.username != "" {
		req.SetBasicAuth(s.username, s.password)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return ESSinkResult{}, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return ESSinkResult{}, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return ESSinkResult{}, fmt.Errorf("es bulk request failed: status=%d body=%s", resp.StatusCode, string(raw))
	}

	bulkResp := esBulkResponse{}
	if err := json.Unmarshal(raw, &bulkResp); err != nil {
		return ESSinkResult{}, fmt.Errorf("decode es bulk response failed: %w", err)
	}

	result := ESSinkResult{}
	for _, itemRaw := range bulkResp.Items {
		for _, item := range itemRaw {
			if item.Status >= 200 && item.Status < 300 {
				result.Indexed++
			} else {
				result.Failed++
			}
		}
	}
	if bulkResp.Errors || result.Failed > 0 {
		return result, fmt.Errorf("es bulk contains failed items: indexed=%d failed=%d", result.Indexed, result.Failed)
	}
	return result, nil
}

func normalizeSourcePathForDisplay(raw string) string {
	path := strings.TrimSpace(raw)
	if path == "" {
		return "unknown"
	}
	const (
		hostVarLogPrefix           = "/host-var-log"
		hostDockerContainersPrefix = "/host-docker-containers"
		canonicalVarLogPrefix      = "/var/log"
		canonicalDockerPrefix      = "/var/lib/docker/containers"
	)

	switch {
	case path == hostVarLogPrefix:
		return canonicalVarLogPrefix
	case strings.HasPrefix(path, hostVarLogPrefix+"/"):
		return canonicalVarLogPrefix + strings.TrimPrefix(path, hostVarLogPrefix)
	case path == hostDockerContainersPrefix:
		return canonicalDockerPrefix
	case strings.HasPrefix(path, hostDockerContainersPrefix+"/"):
		return canonicalDockerPrefix + strings.TrimPrefix(path, hostDockerContainersPrefix)
	default:
		return path
	}
}

func toRFC3339Nano(ts int64) string {
	if ts <= 0 {
		return time.Now().UTC().Format(time.RFC3339Nano)
	}
	return time.Unix(0, ts).UTC().Format(time.RFC3339Nano)
}

// resolveGovernanceFromTask 从 task.Options 解析 tenant_id 与 retention_policy。
func resolveGovernanceFromTask(task PullTask) (tenantID, retentionPolicy string) {
	if task.Options == nil {
		return "", ""
	}
	if v, ok := task.Options["tenant_id"].(string); ok {
		tenantID = strings.TrimSpace(v)
	}
	if v, ok := task.Options["retention_policy"].(string); ok {
		retentionPolicy = strings.TrimSpace(v)
	}
	return tenantID, retentionPolicy
}
