package ingest

import (
	"encoding/json"
	"net/http"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
)

// createPullSourceForTask 在测试中创建一个可用拉取源并返回 source_id。
func createPullSourceForTask(t *testing.T, router *gin.Engine, name string) string {
	t.Helper()
	host := name + ".nexuslog.test"

	createResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-sources", map[string]any{
		"name":           name,
		"host":           host,
		"port":           443,
		"protocol":       "https",
		"path":           "/api/pull/" + name,
		"auth":           "token-ref-" + name,
		"agent_base_url": "https://172.29.0.1:443",
	})
	if createResp.Code != http.StatusCreated {
		t.Fatalf("create pull source failed: %d %s", createResp.Code, createResp.Body.String())
	}
	createEnvelope := decodeEnvelope(t, createResp)
	var createData struct {
		SourceID string `json:"source_id"`
	}
	if err := json.Unmarshal(createEnvelope.Data, &createData); err != nil {
		t.Fatalf("decode create source data failed: %v", err)
	}
	if createData.SourceID == "" {
		t.Fatalf("source_id should not be empty")
	}
	return createData.SourceID
}

// runPullTaskForTest 触发一次 pull-task 并返回 task_id。
func runPullTaskForTest(t *testing.T, router *gin.Engine, sourceID, triggerType string) string {
	t.Helper()

	runResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-tasks/run", map[string]any{
		"source_id":    sourceID,
		"trigger_type": triggerType,
		"options": map[string]any{
			"max_files": 100,
		},
	})
	if runResp.Code != http.StatusAccepted {
		t.Fatalf("run pull task failed: %d %s", runResp.Code, runResp.Body.String())
	}

	runEnvelope := decodeEnvelope(t, runResp)
	var runData struct {
		TaskID string `json:"task_id"`
	}
	if err := json.Unmarshal(runEnvelope.Data, &runData); err != nil {
		t.Fatalf("decode run data failed: %v", err)
	}
	if runData.TaskID == "" {
		t.Fatalf("task_id should not be empty")
	}
	return runData.TaskID
}

// TestRunPullTaskSuccess 验证任务触发成功并返回 pending 状态。
func TestRunPullTaskSuccess(t *testing.T) {
	router := newTestRouter()
	sourceID := createPullSourceForTask(t, router, "task-source-b")

	runResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-tasks/run", map[string]any{
		"source_id":    sourceID,
		"trigger_type": "manual",
		"options": map[string]any{
			"max_files": 100,
		},
	})
	if runResp.Code != http.StatusAccepted {
		t.Fatalf("unexpected run status: %d body=%s", runResp.Code, runResp.Body.String())
	}

	runEnvelope := decodeEnvelope(t, runResp)
	if runEnvelope.Code != "OK" || runEnvelope.Message != "success" {
		t.Fatalf("unexpected run envelope: %+v", runEnvelope)
	}

	var runData struct {
		TaskID      string `json:"task_id"`
		SourceID    string `json:"source_id"`
		TriggerType string `json:"trigger_type"`
		Status      string `json:"status"`
	}
	if err := json.Unmarshal(runEnvelope.Data, &runData); err != nil {
		t.Fatalf("decode run data failed: %v", err)
	}
	if runData.TaskID == "" {
		t.Fatalf("task_id should not be empty")
	}
	if runData.SourceID != sourceID {
		t.Fatalf("source_id mismatch: got %s want %s", runData.SourceID, sourceID)
	}
	if runData.TriggerType != "manual" {
		t.Fatalf("unexpected trigger_type: %s", runData.TriggerType)
	}
	if runData.Status != "pending" {
		t.Fatalf("unexpected status: %s", runData.Status)
	}
}

// TestRunPullTaskSourceNotFound 验证 source 不存在时返回 404。
func TestRunPullTaskSourceNotFound(t *testing.T) {
	router := newTestRouter()
	runResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-tasks/run", map[string]any{
		"source_id":    "00000000-0000-0000-0000-000000000001",
		"trigger_type": "manual",
	})
	if runResp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", runResp.Code, runResp.Body.String())
	}

	envelope := decodeEnvelope(t, runResp)
	if envelope.Code != ErrorCodePullTaskSourceNotFound {
		t.Fatalf("unexpected error code: %s", envelope.Code)
	}
}

// TestRunPullTaskInvalidArgument 验证参数非法场景。
func TestRunPullTaskInvalidArgument(t *testing.T) {
	router := newTestRouter()

	// 缺失 source_id。
	missingResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-tasks/run", map[string]any{
		"trigger_type": "manual",
	})
	if missingResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing source_id, got %d body=%s", missingResp.Code, missingResp.Body.String())
	}
	missingEnvelope := decodeEnvelope(t, missingResp)
	if missingEnvelope.Code != ErrorCodePullTaskInvalidArgument {
		t.Fatalf("unexpected missing source_id error code: %s", missingEnvelope.Code)
	}

	// trigger_type 非法。
	sourceID := createPullSourceForTask(t, router, "task-source-c")

	invalidTriggerResp := performJSONRequest(router, http.MethodPost, "/api/v1/ingest/pull-tasks/run", map[string]any{
		"source_id":    sourceID,
		"trigger_type": "cron",
	})
	if invalidTriggerResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid trigger_type, got %d body=%s", invalidTriggerResp.Code, invalidTriggerResp.Body.String())
	}
	invalidTriggerEnvelope := decodeEnvelope(t, invalidTriggerResp)
	if invalidTriggerEnvelope.Code != ErrorCodePullTaskInvalidArgument {
		t.Fatalf("unexpected invalid trigger error code: %s", invalidTriggerEnvelope.Code)
	}
}

// TestListPullTasksByFilter 验证 source/status 筛选能力。
func TestListPullTasksByFilter(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	sourceA := createPullSourceForTask(t, router, "task-list-source-a")
	sourceB := createPullSourceForTask(t, router, "task-list-source-b")

	taskA1 := runPullTaskForTest(t, router, sourceA, "manual")
	taskA2 := runPullTaskForTest(t, router, sourceA, "schedule")
	_ = runPullTaskForTest(t, router, sourceB, "manual")

	if ok := fixture.taskStore.SetStatusForTest(taskA1, "running"); !ok {
		t.Fatalf("failed to set taskA1 status")
	}
	if ok := fixture.taskStore.SetStatusForTest(taskA2, "success"); !ok {
		t.Fatalf("failed to set taskA2 status")
	}

	query := "/api/v1/ingest/pull-tasks?source_id=" + url.QueryEscape(sourceA) + "&status=running&page=1&page_size=10"
	listResp := performJSONRequest(router, http.MethodGet, query, nil)
	if listResp.Code != http.StatusOK {
		t.Fatalf("list pull tasks failed: %d %s", listResp.Code, listResp.Body.String())
	}
	envelope := decodeEnvelope(t, listResp)
	if envelope.Code != "OK" {
		t.Fatalf("unexpected list code: %s", envelope.Code)
	}
	if envelope.Meta["total"] != float64(1) {
		t.Fatalf("expected total=1, got %#v", envelope.Meta["total"])
	}
	if envelope.Meta["has_next"] != false {
		t.Fatalf("expected has_next=false, got %#v", envelope.Meta["has_next"])
	}
	var data struct {
		Items []PullTask `json:"items"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode list data failed: %v", err)
	}
	if len(data.Items) != 1 {
		t.Fatalf("expected 1 task, got %d", len(data.Items))
	}
	if data.Items[0].SourceID != sourceA || data.Items[0].Status != "running" {
		t.Fatalf("unexpected task item: %+v", data.Items[0])
	}
}

// TestListPullTasksPagination 验证分页切片行为。
func TestListPullTasksPagination(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	sourceID := createPullSourceForTask(t, router, "task-page-source")
	_ = runPullTaskForTest(t, router, sourceID, "manual")
	_ = runPullTaskForTest(t, router, sourceID, "schedule")
	_ = runPullTaskForTest(t, router, sourceID, "replay")

	page1Resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-tasks?page=1&page_size=2", nil)
	if page1Resp.Code != http.StatusOK {
		t.Fatalf("page1 query failed: %d %s", page1Resp.Code, page1Resp.Body.String())
	}
	page1Envelope := decodeEnvelope(t, page1Resp)
	var page1Data struct {
		Items []PullTask `json:"items"`
	}
	if err := json.Unmarshal(page1Envelope.Data, &page1Data); err != nil {
		t.Fatalf("decode page1 data failed: %v", err)
	}
	if len(page1Data.Items) != 2 {
		t.Fatalf("expected page1 size 2, got %d", len(page1Data.Items))
	}
	if page1Envelope.Meta["total"] != float64(3) {
		t.Fatalf("expected total=3, got %#v", page1Envelope.Meta["total"])
	}
	if page1Envelope.Meta["has_next"] != true {
		t.Fatalf("expected page1 has_next=true, got %#v", page1Envelope.Meta["has_next"])
	}

	page2Resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-tasks?page=2&page_size=2", nil)
	if page2Resp.Code != http.StatusOK {
		t.Fatalf("page2 query failed: %d %s", page2Resp.Code, page2Resp.Body.String())
	}
	page2Envelope := decodeEnvelope(t, page2Resp)
	var page2Data struct {
		Items []PullTask `json:"items"`
	}
	if err := json.Unmarshal(page2Envelope.Data, &page2Data); err != nil {
		t.Fatalf("decode page2 data failed: %v", err)
	}
	if len(page2Data.Items) != 1 {
		t.Fatalf("expected page2 size 1, got %d", len(page2Data.Items))
	}
	if page2Envelope.Meta["has_next"] != false {
		t.Fatalf("expected page2 has_next=false, got %#v", page2Envelope.Meta["has_next"])
	}
}

// TestGetPullTask 验证按 task_id 查询详情。
func TestGetPullTask(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	sourceID := createPullSourceForTask(t, router, "task-detail-source")
	taskID := runPullTaskForTest(t, router, sourceID, "manual")
	if ok := fixture.taskStore.SetStatusForTest(taskID, "running"); !ok {
		t.Fatalf("failed to set task status")
	}

	resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-tasks/"+taskID, nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("get task failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != "OK" {
		t.Fatalf("unexpected code: %s", envelope.Code)
	}
	var data struct {
		Item PullTask `json:"item"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode task detail failed: %v", err)
	}
	if data.Item.TaskID != taskID {
		t.Fatalf("task_id mismatch: got %s want %s", data.Item.TaskID, taskID)
	}
	if data.Item.SourceID != sourceID {
		t.Fatalf("source_id mismatch: got %s want %s", data.Item.SourceID, sourceID)
	}
	if data.Item.Status != "running" {
		t.Fatalf("unexpected status: %s", data.Item.Status)
	}
	if data.Item.Options["max_files"] != float64(100) {
		t.Fatalf("unexpected task options: %+v", data.Item.Options)
	}
}

// TestGetPullTaskNotFound 验证 task_id 不存在返回 404。
func TestGetPullTaskNotFound(t *testing.T) {
	router := newTestRouter()

	resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-tasks/00000000-0000-0000-0000-000000000001", nil)
	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != ErrorCodePullTaskNotFound {
		t.Fatalf("unexpected not found code: %s", envelope.Code)
	}
}

// TestListPullTasksInvalidArgument 验证查询参数非法场景。
func TestListPullTasksInvalidArgument(t *testing.T) {
	router := newTestRouter()

	invalidStatusResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-tasks?status=done", nil)
	if invalidStatusResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid status, got %d body=%s", invalidStatusResp.Code, invalidStatusResp.Body.String())
	}
	invalidStatusEnvelope := decodeEnvelope(t, invalidStatusResp)
	if invalidStatusEnvelope.Code != ErrorCodePullTaskInvalidArgument {
		t.Fatalf("unexpected invalid status code: %s", invalidStatusEnvelope.Code)
	}

	invalidPageResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-tasks?page=0", nil)
	if invalidPageResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid page, got %d body=%s", invalidPageResp.Code, invalidPageResp.Body.String())
	}
	invalidPageEnvelope := decodeEnvelope(t, invalidPageResp)
	if invalidPageEnvelope.Code != ErrorCodePullTaskInvalidArgument {
		t.Fatalf("unexpected invalid page code: %s", invalidPageEnvelope.Code)
	}
}
