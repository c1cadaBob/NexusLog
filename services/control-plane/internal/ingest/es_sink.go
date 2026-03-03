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

	var payload bytes.Buffer
	for _, record := range response.Records {
		docID := fmt.Sprintf("%s:%s:%s", agentID, strings.TrimSpace(response.BatchID), strings.TrimSpace(record.RecordID))
		action := map[string]any{
			"index": map[string]any{
				"_index": s.indexName,
				"_id":    docID,
			},
		}
		actionRaw, _ := json.Marshal(action)
		payload.Write(actionRaw)
		payload.WriteByte('\n')

		doc := map[string]any{
			"@timestamp": toRFC3339Nano(record.Timestamp),
			"message":    record.Data,
			"source":     record.Source,
			"offset":     record.Offset,
			"sequence":   record.Sequence,
			"record_id":  record.RecordID,
			"batch_id":   response.BatchID,
			"task_id":    task.TaskID,
			"source_id":  source.SourceID,
			"request_id": task.RequestID,
			"metadata":   record.Metadata,
		}
		docRaw, _ := json.Marshal(doc)
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

func toRFC3339Nano(ts int64) string {
	if ts <= 0 {
		return time.Now().UTC().Format(time.RFC3339Nano)
	}
	return time.Unix(0, ts).UTC().Format(time.RFC3339Nano)
}
