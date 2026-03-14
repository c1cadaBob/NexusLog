package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/nexuslog/control-plane/internal/httpguard"
)

const defaultSemanticDedupWindow = 10 * time.Second

var esBulkFieldPattern = regexp.MustCompile(`(?:for|field) \[([^\]]+)\]`)

// ESSink 定义写入 Elasticsearch 的最小能力。
type ESSink struct {
	endpoint            string
	indexName           string
	username            string
	password            string
	client              *http.Client
	semanticDedupWindow time.Duration
	mu                  sync.Mutex
	semanticCache       map[string]semanticDedupEntry
}

type semanticDedupEntry struct {
	DocumentID  string
	FirstSeenAt time.Time
	LastSeenAt  time.Time
	Count       int
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
	Status int              `json:"status"`
	Index  string           `json:"_index"`
	ID     string           `json:"_id"`
	Error  *esBulkItemError `json:"error,omitempty"`
}

type esBulkItemError struct {
	Type     string           `json:"type"`
	Reason   string           `json:"reason"`
	CausedBy *esBulkItemError `json:"caused_by,omitempty"`
}

type ESBulkFailureDetail struct {
	Action      string
	Index       string
	DocumentID  string
	Status      int
	ErrorType   string
	ErrorReason string
	Field       string
}

type ESBulkWriteError struct {
	Indexed      int
	Failed       int
	FirstFailure *ESBulkFailureDetail
}

func (e *ESBulkWriteError) Error() string {
	if e == nil {
		return "es bulk write failed"
	}
	message := fmt.Sprintf("es bulk contains failed items: indexed=%d failed=%d", e.Indexed, e.Failed)
	if e.FirstFailure == nil {
		return message
	}

	detail := fmt.Sprintf(
		"index=%s id=%s status=%d error_type=%s reason=%s",
		firstNonEmpty(e.FirstFailure.Index, "unknown"),
		firstNonEmpty(e.FirstFailure.DocumentID, "unknown"),
		e.FirstFailure.Status,
		firstNonEmpty(e.FirstFailure.ErrorType, "unknown"),
		firstNonEmpty(e.FirstFailure.ErrorReason, "unknown"),
	)
	if field := strings.TrimSpace(e.FirstFailure.Field); field != "" {
		detail += fmt.Sprintf(" field=%s", field)
	}
	return message + " first_failure[" + detail + "]"
}

func (e *ESBulkWriteError) DetailPayload() map[string]any {
	if e == nil || e.FirstFailure == nil {
		return nil
	}
	payload := map[string]any{
		"index":        e.FirstFailure.Index,
		"document_id":  e.FirstFailure.DocumentID,
		"status":       e.FirstFailure.Status,
		"error_type":   e.FirstFailure.ErrorType,
		"error_reason": e.FirstFailure.ErrorReason,
	}
	if field := strings.TrimSpace(e.FirstFailure.Field); field != "" {
		payload["field"] = field
	}
	if action := strings.TrimSpace(e.FirstFailure.Action); action != "" {
		payload["action"] = action
	}
	return payload
}

// NewESSink 创建 ES 批量写入器。
func NewESSink(endpoint, indexName, username, password string, timeout time.Duration) *ESSink {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &ESSink{
		endpoint:            strings.TrimRight(strings.TrimSpace(endpoint), "/"),
		indexName:           strings.TrimSpace(indexName),
		username:            strings.TrimSpace(username),
		password:            strings.TrimSpace(password),
		client:              &http.Client{Timeout: timeout},
		semanticDedupWindow: defaultSemanticDedupWindow,
		semanticCache:       make(map[string]semanticDedupEntry),
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
		agentID = strings.TrimSpace(response.Agent.ID)
	}
	if agentID == "" {
		agentID = strings.TrimSpace(source.SourceID)
	}

	tenantID, retentionPolicy := resolveGovernance(task, source)
	batchID := strings.TrimSpace(response.BatchID)

	type bulkItem struct {
		id  string
		doc map[string]any
	}
	itemsByID := make(map[string]bulkItem)
	orderedIDs := make([]string, 0, len(response.Records))

	for _, record := range response.Records {
		displaySourcePath := normalizeSourcePathForDisplay(resolveRecordSourcePath(record))
		doc := BuildLogDocument(record, response.Agent, agentID, batchID, displaySourcePath, tenantID, retentionPolicy)
		doc = s.applySemanticDedup(doc)
		eventID := doc.Event.ID
		esDoc := doc.ToESDocument()
		if _, exists := itemsByID[eventID]; !exists {
			orderedIDs = append(orderedIDs, eventID)
		}
		itemsByID[eventID] = bulkItem{id: eventID, doc: esDoc}
	}

	var payload bytes.Buffer
	for _, eventID := range orderedIDs {
		item := itemsByID[eventID]
		action := map[string]any{
			"create": map[string]any{
				"_index": s.indexName,
				"_id":    item.id,
			},
		}
		actionRaw, _ := json.Marshal(action)
		payload.Write(actionRaw)
		payload.WriteByte('\n')
		docRaw, _ := json.Marshal(item.doc)
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
	raw, err := httpguard.ReadLimitedBody(resp.Body, 0)
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
				continue
			}
			if isIgnorableBulkConflict(item) {
				result.Indexed++
				continue
			}
			result.Failed++
		}
	}
	if result.Failed > 0 {
		firstFailure := firstBulkFailureDetail(bulkResp)
		if firstFailure != nil {
			log.Printf(
				"es bulk item failed index=%s id=%s status=%d error_type=%s error_reason=%s field=%s",
				firstNonEmpty(firstFailure.Index, "unknown"),
				firstNonEmpty(firstFailure.DocumentID, "unknown"),
				firstFailure.Status,
				firstNonEmpty(firstFailure.ErrorType, "unknown"),
				firstNonEmpty(firstFailure.ErrorReason, "unknown"),
				firstNonEmpty(firstFailure.Field, ""),
			)
		}
		return result, &ESBulkWriteError{
			Indexed:      result.Indexed,
			Failed:       result.Failed,
			FirstFailure: firstFailure,
		}
	}
	return result, nil
}

func firstBulkFailureDetail(resp esBulkResponse) *ESBulkFailureDetail {
	for _, itemRaw := range resp.Items {
		for action, item := range itemRaw {
			if item.Status >= 200 && item.Status < 300 {
				continue
			}
			if isIgnorableBulkConflict(item) {
				continue
			}
			detail := &ESBulkFailureDetail{
				Action:      strings.TrimSpace(action),
				Index:       strings.TrimSpace(item.Index),
				DocumentID:  strings.TrimSpace(item.ID),
				Status:      item.Status,
				ErrorType:   strings.TrimSpace(firstBulkErrorType(item.Error)),
				ErrorReason: strings.TrimSpace(firstBulkErrorReason(item.Error)),
			}
			detail.Field = extractESConflictField(detail.ErrorReason)
			return detail
		}
	}
	return nil
}

func isIgnorableBulkConflict(item esBulkItem) bool {
	if item.Status != http.StatusConflict {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(firstBulkErrorType(item.Error)), "version_conflict_engine_exception")
}

func firstBulkErrorType(err *esBulkItemError) string {
	if err == nil {
		return ""
	}
	if value := strings.TrimSpace(err.Type); value != "" {
		return value
	}
	return firstBulkErrorType(err.CausedBy)
}

func firstBulkErrorReason(err *esBulkItemError) string {
	if err == nil {
		return ""
	}
	current := strings.TrimSpace(err.Reason)
	child := strings.TrimSpace(firstBulkErrorReason(err.CausedBy))
	if current == "" {
		return child
	}
	if child == "" || child == current {
		return current
	}
	return current + "; caused_by=" + child
}

func extractESConflictField(reason string) string {
	matches := esBulkFieldPattern.FindStringSubmatch(strings.TrimSpace(reason))
	if len(matches) < 2 {
		return ""
	}
	return strings.TrimSpace(matches[1])
}

func (s *ESSink) applySemanticDedup(doc LogDocument) LogDocument {
	fingerprint := strings.TrimSpace(doc.NexusLog.Dedup.Fingerprint)
	if fingerprint == "" {
		return doc
	}
	seenAt := parseRFC3339OrNow(doc.Timestamp)

	s.mu.Lock()
	defer s.mu.Unlock()

	for key, entry := range s.semanticCache {
		if seenAt.Sub(entry.LastSeenAt) > s.semanticDedupWindow {
			delete(s.semanticCache, key)
		}
	}

	entry, ok := s.semanticCache[fingerprint]
	if !ok || seenAt.Sub(entry.LastSeenAt) > s.semanticDedupWindow {
		count := doc.NexusLog.Dedup.Count
		if count <= 0 {
			count = 1
		}
		doc.NexusLog.Dedup.Count = count
		doc.NexusLog.Dedup.FirstSeenAt = firstNonEmpty(doc.NexusLog.Dedup.FirstSeenAt, doc.Timestamp)
		doc.NexusLog.Dedup.LastSeenAt = firstNonEmpty(doc.NexusLog.Dedup.LastSeenAt, doc.Timestamp)
		doc.NexusLog.Dedup.WindowSec = int(s.semanticDedupWindow.Seconds())
		doc.NexusLog.Dedup.SuppressedCount = maxInt(doc.NexusLog.Dedup.Count-1, 0)
		s.semanticCache[fingerprint] = semanticDedupEntry{
			DocumentID:  doc.Event.ID,
			FirstSeenAt: parseRFC3339OrNow(doc.NexusLog.Dedup.FirstSeenAt),
			LastSeenAt:  parseRFC3339OrNow(doc.NexusLog.Dedup.LastSeenAt),
			Count:       doc.NexusLog.Dedup.Count,
		}
		return doc
	}

	entry.Count += maxInt(doc.NexusLog.Dedup.Count, 1)
	entry.LastSeenAt = seenAt
	doc.Event.ID = entry.DocumentID
	doc.NexusLog.Dedup.Hit = true
	doc.NexusLog.Dedup.Count = entry.Count
	doc.NexusLog.Dedup.FirstSeenAt = entry.FirstSeenAt.UTC().Format(time.RFC3339Nano)
	doc.NexusLog.Dedup.LastSeenAt = entry.LastSeenAt.UTC().Format(time.RFC3339Nano)
	doc.NexusLog.Dedup.WindowSec = int(s.semanticDedupWindow.Seconds())
	if doc.NexusLog.Dedup.Strategy == "" {
		if doc.NexusLog.Multiline.Enabled {
			doc.NexusLog.Dedup.Strategy = "multiline"
		} else {
			doc.NexusLog.Dedup.Strategy = "normalized"
		}
	}
	doc.NexusLog.Dedup.SuppressedCount = maxInt(entry.Count-1, 0)
	s.semanticCache[fingerprint] = entry
	return doc
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

func parseRFC3339OrNow(raw string) time.Time {
	parsed, err := time.Parse(time.RFC3339Nano, strings.TrimSpace(raw))
	if err == nil {
		return parsed.UTC()
	}
	return time.Now().UTC()
}

// resolveGovernance 优先从 task.Options 解析治理字段，缺失时回退到 source。
func resolveGovernance(task PullTask, source PullSource) (tenantID, retentionPolicy string) {
	if task.Options == nil {
		return strings.TrimSpace(source.TenantID), ""
	}
	if v, ok := task.Options["tenant_id"].(string); ok {
		tenantID = strings.TrimSpace(v)
	}
	if v, ok := task.Options["retention_policy"].(string); ok {
		retentionPolicy = strings.TrimSpace(v)
	}
	if tenantID == "" {
		tenantID = strings.TrimSpace(source.TenantID)
	}
	return tenantID, retentionPolicy
}
