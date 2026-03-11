package ingest

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// apiEnvelope 对齐统一响应结构，便于测试断言。
type apiEnvelope struct {
	Code      string          `json:"code"`
	Message   string          `json:"message"`
	RequestID string          `json:"request_id"`
	Data      json.RawMessage `json:"data"`
	Meta      map[string]any  `json:"meta"`
}

// testFixture 统一承载测试用路由与内存仓储，便于跨接口场景复用。
type testFixture struct {
	router          *gin.Engine
	sourceStore     *PullSourceStore
	taskStore       *PullTaskStore
	packageStore    *PullPackageStore
	receiptStore    *ReceiptStore
	deadLetterStore *DeadLetterStore
}

// newTestFixture 创建测试路由与内存仓储实例。
func newTestFixture() testFixture {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	sourceStore := NewPullSourceStore()
	taskStore := NewPullTaskStore()
	packageStore := NewPullPackageStore()
	receiptStore := NewReceiptStore()
	deadLetterStore := NewDeadLetterStore()
	RegisterPullSourceRoutes(router, sourceStore)
	RegisterPullTaskRoutes(router, sourceStore, taskStore)
	RegisterPullPackageRoutes(router, packageStore)
	RegisterReceiptRoutes(router, packageStore, receiptStore, deadLetterStore)
	RegisterDeadLetterRoutes(router, deadLetterStore)
	return testFixture{
		router:          router,
		sourceStore:     sourceStore,
		taskStore:       taskStore,
		packageStore:    packageStore,
		receiptStore:    receiptStore,
		deadLetterStore: deadLetterStore,
	}
}

// newTestRouter 创建用于接口测试的最小 Gin 路由。
func newTestRouter() *gin.Engine {
	return newTestFixture().router
}

// performJSONRequest 发送 JSON 请求并返回响应记录。
func performJSONRequest(router *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

// decodeEnvelope 将响应体解码为统一 envelope。
func decodeEnvelope(t *testing.T, recorder *httptest.ResponseRecorder) apiEnvelope {
	t.Helper()
	var resp apiEnvelope
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return resp
}

// TestPullSourceCreateAndList 验证 POST/GET 基本闭环与分页输出。
func TestPullSourceCreateAndList(t *testing.T) {
	router := newTestRouter()

	createBody := map[string]any{
		"name":     "source-a",
		"host":     "10.0.0.1",
		"port":     22,
		"protocol": "ssh",
		"path":     "/var/log/*.log",
		"auth":     "key-ref-a",
	}
	createResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", createBody)
	if createResp.Code != http.StatusCreated {
		t.Fatalf("unexpected status code: %d, body=%s", createResp.Code, createResp.Body.String())
	}
	createEnvelope := decodeEnvelope(t, createResp)
	if createEnvelope.Code != "OK" || createEnvelope.Message != "success" {
		t.Fatalf("unexpected create envelope: %+v", createEnvelope)
	}

	var createData struct {
		SourceID string `json:"source_id"`
		Status   string `json:"status"`
	}
	if err := json.Unmarshal(createEnvelope.Data, &createData); err != nil {
		t.Fatalf("failed to decode create data: %v", err)
	}
	if createData.SourceID == "" {
		t.Fatalf("source_id should not be empty")
	}
	if createData.Status != "active" {
		t.Fatalf("expected default status active, got %s", createData.Status)
	}

	listResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-sources?page=1&page_size=10", nil)
	if listResp.Code != http.StatusOK {
		t.Fatalf("unexpected list status code: %d, body=%s", listResp.Code, listResp.Body.String())
	}
	listEnvelope := decodeEnvelope(t, listResp)
	if listEnvelope.Code != "OK" {
		t.Fatalf("unexpected list code: %s", listEnvelope.Code)
	}
	if listEnvelope.Meta["total"] != float64(1) {
		t.Fatalf("expected total=1, got %#v", listEnvelope.Meta["total"])
	}
	if listEnvelope.Meta["has_next"] != false {
		t.Fatalf("expected has_next=false, got %#v", listEnvelope.Meta["has_next"])
	}

	var listData struct {
		Items []PullSource `json:"items"`
	}
	if err := json.Unmarshal(listEnvelope.Data, &listData); err != nil {
		t.Fatalf("failed to decode list data: %v", err)
	}
	if len(listData.Items) != 1 {
		t.Fatalf("expected one item, got %d", len(listData.Items))
	}
	if listData.Items[0].Name != "source-a" || listData.Items[0].Protocol != "ssh" {
		t.Fatalf("unexpected item: %+v", listData.Items[0])
	}
}

// TestPullSourceUpdateByPath 验证 PUT 路径参数更新与状态筛选。
func TestPullSourceUpdateByPath(t *testing.T) {
	router := newTestRouter()

	createResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":     "source-b",
		"host":     "10.0.0.2",
		"port":     443,
		"protocol": "https",
		"path":     "/api/logs",
		"auth":     "token-ref-b",
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create failed: %d %s", createResp.Code, createResp.Body.String())
	}
	createEnvelope := decodeEnvelope(t, createResp)
	var createData struct {
		SourceID string `json:"source_id"`
	}
	if err := json.Unmarshal(createEnvelope.Data, &createData); err != nil {
		t.Fatalf("failed to decode create data: %v", err)
	}

	updateResp := performJSONRequest(router, http.MethodPut, "/api/v1/ingest/pull-sources/"+createData.SourceID, map[string]any{
		"status": "paused",
		"port":   8443,
	})
	if updateResp.Code != http.StatusOK {
		t.Fatalf("update failed: %d %s", updateResp.Code, updateResp.Body.String())
	}
	updateEnvelope := decodeEnvelope(t, updateResp)
	if updateEnvelope.Code != "OK" {
		t.Fatalf("unexpected update code: %s", updateEnvelope.Code)
	}
	var updateData struct {
		Updated bool `json:"updated"`
	}
	if err := json.Unmarshal(updateEnvelope.Data, &updateData); err != nil {
		t.Fatalf("failed to decode update data: %v", err)
	}
	if !updateData.Updated {
		t.Fatalf("expected updated=true")
	}

	filterResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-sources?status=paused", nil)
	if filterResp.Code != http.StatusOK {
		t.Fatalf("filtered list failed: %d %s", filterResp.Code, filterResp.Body.String())
	}
	filterEnvelope := decodeEnvelope(t, filterResp)
	var filterData struct {
		Items []PullSource `json:"items"`
	}
	if err := json.Unmarshal(filterEnvelope.Data, &filterData); err != nil {
		t.Fatalf("failed to decode filtered list data: %v", err)
	}
	if len(filterData.Items) != 1 || filterData.Items[0].Status != "paused" || filterData.Items[0].Port != 8443 {
		t.Fatalf("unexpected filtered items: %+v", filterData.Items)
	}
	if filterEnvelope.Meta["has_next"] != false {
		t.Fatalf("expected filtered has_next=false, got %#v", filterEnvelope.Meta["has_next"])
	}
}

// TestPullSourceInvalidArgument 验证参数校验失败场景（6.1 验收证据要求）。
func TestPullSourceInvalidArgument(t *testing.T) {
	router := newTestRouter()

	invalidResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":     "source-c",
		"host":     "",
		"port":     70000,
		"protocol": "unknown",
	})
	if invalidResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d body=%s", invalidResp.Code, invalidResp.Body.String())
	}
	invalidEnvelope := decodeEnvelope(t, invalidResp)
	if invalidEnvelope.Code != ErrorCodePullSourceInvalidArgument {
		t.Fatalf("unexpected error code: %s", invalidEnvelope.Code)
	}

	updateResp := performJSONRequest(router, http.MethodPut, "/api/v1/ingest/pull-sources", map[string]any{
		"name": "only-name",
	})
	if updateResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing source_id, got %d body=%s", updateResp.Code, updateResp.Body.String())
	}
	updateEnvelope := decodeEnvelope(t, updateResp)
	if updateEnvelope.Code != ErrorCodePullSourceInvalidArgument {
		t.Fatalf("unexpected update error code: %s", updateEnvelope.Code)
	}
}

// TestPullSourceRejectsActiveOverlap 验证同一 agent 端点下路径重叠的 active 拉取源会被拒绝。
func TestPullSourceRejectsActiveOverlap(t *testing.T) {
	router := newTestRouter()

	first := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":              "source-overlap-a",
		"host":              "172.29.0.1",
		"port":              16666,
		"protocol":          "http",
		"path":              "/var/log/*",
		"auth":              "key-ref-a",
		"agent_base_url":    "http://172.29.0.1:16666/",
		"pull_interval_sec": 30,
		"pull_timeout_sec":  30,
		"status":            "active",
	})
	if first.Code != http.StatusCreated {
		t.Fatalf("first create failed: %d %s", first.Code, first.Body.String())
	}

	overlap := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":              "source-overlap-b",
		"host":              "172.29.0.1",
		"port":              16666,
		"protocol":          "http",
		"path":              "/var/log/messages",
		"auth":              "key-ref-b",
		"agent_base_url":    "http://172.29.0.1:16666",
		"pull_interval_sec": 30,
		"pull_timeout_sec":  30,
		"status":            "active",
	})
	if overlap.Code != http.StatusConflict {
		t.Fatalf("expected 409 for overlap, got %d body=%s", overlap.Code, overlap.Body.String())
	}
	overlapEnvelope := decodeEnvelope(t, overlap)
	if overlapEnvelope.Code != ErrorCodePullSourceOverlapConflict {
		t.Fatalf("unexpected overlap error code: %s", overlapEnvelope.Code)
	}

	paused := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":              "source-overlap-c",
		"host":              "172.29.0.1",
		"port":              16666,
		"protocol":          "http",
		"path":              "/var/log/messages",
		"auth":              "key-ref-c",
		"agent_base_url":    "http://172.29.0.1:16666",
		"pull_interval_sec": 30,
		"pull_timeout_sec":  30,
		"status":            "paused",
	})
	if paused.Code != http.StatusCreated {
		t.Fatalf("paused create should bypass overlap check: %d %s", paused.Code, paused.Body.String())
	}
}

// TestPullSourceAllowsDisjointActivePaths 验证同一 agent 端点下非重叠路径可并行 active。
func TestPullSourceAllowsDisjointActivePaths(t *testing.T) {
	router := newTestRouter()

	first := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":              "source-disjoint-a",
		"host":              "172.29.0.1",
		"port":              16666,
		"protocol":          "http",
		"path":              "/var/log/*.log,/var/log/*/*.log",
		"auth":              "key-ref-a",
		"agent_base_url":    "http://172.29.0.1:16666",
		"pull_interval_sec": 30,
		"pull_timeout_sec":  30,
		"status":            "active",
	})
	if first.Code != http.StatusCreated {
		t.Fatalf("first create failed: %d %s", first.Code, first.Body.String())
	}

	second := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":              "source-disjoint-b",
		"host":              "172.29.0.1",
		"port":              16666,
		"protocol":          "http",
		"path":              "/host-docker-containers/*/*-json.log",
		"auth":              "key-ref-b",
		"agent_base_url":    "http://172.29.0.1:16666",
		"pull_interval_sec": 30,
		"pull_timeout_sec":  30,
		"status":            "active",
	})
	if second.Code != http.StatusCreated {
		t.Fatalf("expected disjoint active source to succeed, got %d body=%s", second.Code, second.Body.String())
	}
}

// TestGlobalErrorCodeContractAlignment 验证 ingest 错误码常量对齐 12 文档核心规范。
func TestGlobalErrorCodeContractAlignment(t *testing.T) {
	if ErrorCodeRequestInvalidParams != "REQ_INVALID_PARAMS" {
		t.Fatalf("request invalid code mismatch: %s", ErrorCodeRequestInvalidParams)
	}
	if ErrorCodeResourceNotFound != "RES_NOT_FOUND" {
		t.Fatalf("resource not found code mismatch: %s", ErrorCodeResourceNotFound)
	}
	if ErrorCodeResourceConflict != "RES_CONFLICT" {
		t.Fatalf("resource conflict code mismatch: %s", ErrorCodeResourceConflict)
	}
	if ErrorCodeInternalError != "INTERNAL_ERROR" {
		t.Fatalf("internal error code mismatch: %s", ErrorCodeInternalError)
	}
}
