package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	defaultPullMaxRecords = 1000
	defaultPullMaxBytes   = 1 * 1024 * 1024
)

// AgentClient 封装 control-plane 到 collector-agent 的 /agent/v1 调用。
type AgentClient struct {
	httpClient *http.Client
}

// AgentPullRequest 定义调用 agent 拉取日志时的请求体。
type AgentPullRequest struct {
	Cursor     string `json:"cursor,omitempty"`
	SourcePath string `json:"source_path,omitempty"`
	MaxRecords int    `json:"max_records"`
	MaxBytes   int    `json:"max_bytes"`
	TimeoutMS  int    `json:"timeout_ms"`
}

// AgentAckRequestPayload 定义 agent ACK/NACK 请求体。
type AgentAckRequestPayload struct {
	BatchID         string `json:"batch_id"`
	Status          string `json:"status"`
	CommittedCursor string `json:"committed_cursor,omitempty"`
	Reason          string `json:"reason,omitempty"`
}

type agentAckResponse struct {
	Accepted          bool `json:"accepted"`
	CheckpointUpdated bool `json:"checkpoint_updated"`
}

type agentErrorEnvelope struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewAgentClient 创建 agent 调用客户端。
func NewAgentClient(timeout time.Duration) *AgentClient {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}
	return &AgentClient{
		httpClient: &http.Client{Timeout: timeout},
	}
}

// Pull 调用 /agent/v1/logs/pull 拉取日志批次。
func (c *AgentClient) Pull(ctx context.Context, source PullSource, task PullTask, credential AgentAuthCredential, cursor string) (AgentPullResponse, error) {
	baseURL := strings.TrimRight(strings.TrimSpace(source.AgentBaseURL), "/")
	if baseURL == "" {
		return AgentPullResponse{}, fmt.Errorf("agent_base_url is required")
	}

	body := AgentPullRequest{
		Cursor:     resolveCursor(cursor, task.Options),
		SourcePath: strings.TrimSpace(source.Path),
		MaxRecords: resolveIntOption(task.Options, "max_records", defaultPullMaxRecords),
		MaxBytes:   resolveIntOption(task.Options, "max_bytes", defaultPullMaxBytes),
		TimeoutMS:  resolveIntOption(task.Options, "timeout_ms", source.PullTimeoutSec*1000),
	}
	if body.MaxRecords <= 0 {
		body.MaxRecords = defaultPullMaxRecords
	}
	if body.MaxBytes <= 0 {
		body.MaxBytes = defaultPullMaxBytes
	}
	if body.TimeoutMS <= 0 {
		body.TimeoutMS = 30000
	}
	if clientTimeoutMS := requestTimeoutMS(c); clientTimeoutMS > 0 && body.TimeoutMS >= clientTimeoutMS {
		headroomMS := 1000
		if clientTimeoutMS <= headroomMS {
			headroomMS = 1
		}
		body.TimeoutMS = clientTimeoutMS - headroomMS
	}

	var response AgentPullResponse
	if err := c.doJSON(
		ctx,
		http.MethodPost,
		baseURL+"/agent/v1/logs/pull",
		credential,
		body,
		&response,
		task.RequestID,
	); err != nil {
		return AgentPullResponse{}, err
	}
	return response, nil
}

// Ack 调用 /agent/v1/logs/ack 回写结果。
func (c *AgentClient) Ack(ctx context.Context, source PullSource, credential AgentAuthCredential, payload AgentAckRequestPayload, requestID string) error {
	baseURL := strings.TrimRight(strings.TrimSpace(source.AgentBaseURL), "/")
	if baseURL == "" {
		return fmt.Errorf("agent_base_url is required")
	}
	payload.BatchID = strings.TrimSpace(payload.BatchID)
	payload.Status = strings.ToLower(strings.TrimSpace(payload.Status))
	payload.CommittedCursor = strings.TrimSpace(payload.CommittedCursor)
	payload.Reason = strings.TrimSpace(payload.Reason)
	if payload.BatchID == "" {
		return fmt.Errorf("batch_id is required")
	}
	if payload.Status != "ack" && payload.Status != "nack" {
		return fmt.Errorf("status must be ack or nack")
	}

	var response agentAckResponse
	if err := c.doJSON(
		ctx,
		http.MethodPost,
		baseURL+"/agent/v1/logs/ack",
		credential,
		payload,
		&response,
		requestID,
	); err != nil {
		return err
	}
	if !response.Accepted {
		return fmt.Errorf("agent did not accept ack")
	}
	return nil
}

func (c *AgentClient) doJSON(ctx context.Context, method, endpoint string, credential AgentAuthCredential, requestBody any, responseBody any, requestID string) error {
	if c == nil || c.httpClient == nil {
		return fmt.Errorf("agent client is not configured")
	}

	raw, err := json.Marshal(requestBody)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, method, endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	if rid := strings.TrimSpace(requestID); rid != "" {
		req.Header.Set("X-Request-ID", rid)
	}
	if key := strings.TrimSpace(credential.Key); key != "" {
		req.Header.Set("X-Agent-Key", key)
	}
	if keyID := strings.TrimSpace(credential.KeyID); keyID != "" {
		req.Header.Set("X-Key-Id", keyID)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		agentErr := agentErrorEnvelope{}
		_ = json.Unmarshal(body, &agentErr)
		if strings.TrimSpace(agentErr.Message) != "" {
			return fmt.Errorf("agent request failed: status=%d code=%s message=%s", resp.StatusCode, agentErr.Code, agentErr.Message)
		}
		return fmt.Errorf("agent request failed: status=%d body=%s", resp.StatusCode, string(body))
	}

	if responseBody != nil {
		if err := json.Unmarshal(body, responseBody); err != nil {
			return fmt.Errorf("decode agent response failed: %w", err)
		}
	}
	return nil
}

func requestTimeoutMS(c *AgentClient) int {
	if c == nil || c.httpClient == nil || c.httpClient.Timeout <= 0 {
		return 0
	}
	return int(c.httpClient.Timeout / time.Millisecond)
}

func resolveCursor(fallback string, options map[string]any) string {
	if options != nil {
		if raw, ok := options["cursor"]; ok {
			if text := strings.TrimSpace(fmt.Sprintf("%v", raw)); text != "" {
				return text
			}
		}
	}
	return strings.TrimSpace(fallback)
}

func resolveIntOption(options map[string]any, key string, fallback int) int {
	if options == nil {
		return fallback
	}
	raw, ok := options[key]
	if !ok || raw == nil {
		return fallback
	}
	switch typed := raw.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case float32:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err == nil {
			return parsed
		}
	}
	return fallback
}
