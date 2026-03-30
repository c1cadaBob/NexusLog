package ingest

import (
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
	"time"
)

// TestListPullPackagesByFilter 验证 agent/source_ref/status 联合筛选。
func TestListPullPackagesByFilter(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	now := time.Now().UTC()
	fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-a",
		SourceRef: "/var/log/app-a.log",
		PackageNo: "pkg-001",
		Checksum:  "sha256-a1",
		Status:    "uploaded",
		CreatedAt: now.Add(-2 * time.Minute),
	})
	fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-a",
		SourceRef: "/var/log/app-a.log",
		PackageNo: "pkg-002",
		Checksum:  "sha256-a2",
		Status:    "acked",
		CreatedAt: now.Add(-1 * time.Minute),
	})
	fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-b",
		SourceRef: "/var/log/app-b.log",
		PackageNo: "pkg-003",
		Checksum:  "sha256-b1",
		Status:    "failed",
		CreatedAt: now,
	})

	query := "/api/v1/ingest/packages?agent_id=agent-a&source_ref=" + url.QueryEscape("/var/log/app-a.log") + "&status=acked&page=1&page_size=10"
	resp := performJSONRequest(router, http.MethodGet, query, nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("list packages failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != "OK" {
		t.Fatalf("unexpected code: %s", envelope.Code)
	}
	if envelope.Meta["total"] != float64(1) {
		t.Fatalf("expected total=1, got %#v", envelope.Meta["total"])
	}
	if envelope.Meta["has_next"] != false {
		t.Fatalf("expected has_next=false, got %#v", envelope.Meta["has_next"])
	}

	var data struct {
		Items []PullPackage `json:"items"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode packages data failed: %v", err)
	}
	if len(data.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(data.Items))
	}
	if data.Items[0].AgentID != "agent-a" || data.Items[0].Status != "acked" || data.Items[0].PackageNo != "pkg-002" {
		t.Fatalf("unexpected package item: %+v", data.Items[0])
	}
}

// TestListPullPackagesByTaskID 验证按 task_id 过滤包列表。
func TestListPullPackagesByTaskID(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	now := time.Now().UTC()
	fixture.packageStore.CreateForTest(PullPackage{
		TaskID:    "task-a",
		AgentID:   "agent-task",
		SourceRef: "/var/log/task-a.log",
		PackageNo: "pkg-task-001",
		Checksum:  "sha256-task-001",
		Status:    "uploaded",
		CreatedAt: now.Add(-2 * time.Minute),
	})
	fixture.packageStore.CreateForTest(PullPackage{
		TaskID:    "task-b",
		AgentID:   "agent-task",
		SourceRef: "/var/log/task-b.log",
		PackageNo: "pkg-task-002",
		Checksum:  "sha256-task-002",
		Status:    "acked",
		CreatedAt: now.Add(-1 * time.Minute),
	})

	resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/packages?task_id=task-b&page=1&page_size=10", nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("list packages by task_id failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != "OK" {
		t.Fatalf("unexpected code: %s", envelope.Code)
	}
	if envelope.Meta["total"] != float64(1) {
		t.Fatalf("expected total=1, got %#v", envelope.Meta["total"])
	}

	var data struct {
		Items []PullPackage `json:"items"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode packages data failed: %v", err)
	}
	if len(data.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(data.Items))
	}
	if data.Items[0].TaskID != "task-b" || data.Items[0].PackageNo != "pkg-task-002" {
		t.Fatalf("unexpected package item: %+v", data.Items[0])
	}
}

// TestListPullPackagesPagination 验证分页切片与 total 元数据。
func TestListPullPackagesPagination(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	now := time.Now().UTC()
	fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-page",
		SourceRef: "/logs/page-a.log",
		PackageNo: "pkg-p1",
		Checksum:  "sha256-p1",
		Status:    "created",
		CreatedAt: now.Add(-3 * time.Minute),
	})
	fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-page",
		SourceRef: "/logs/page-b.log",
		PackageNo: "pkg-p2",
		Checksum:  "sha256-p2",
		Status:    "uploaded",
		CreatedAt: now.Add(-2 * time.Minute),
	})
	fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-page",
		SourceRef: "/logs/page-c.log",
		PackageNo: "pkg-p3",
		Checksum:  "sha256-p3",
		Status:    "acked",
		CreatedAt: now.Add(-1 * time.Minute),
	})

	page1 := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/packages?page=1&page_size=2", nil)
	if page1.Code != http.StatusOK {
		t.Fatalf("page1 failed: %d body=%s", page1.Code, page1.Body.String())
	}
	env1 := decodeEnvelope(t, page1)
	if env1.Meta["total"] != float64(3) {
		t.Fatalf("expected total=3, got %#v", env1.Meta["total"])
	}
	if env1.Meta["has_next"] != true {
		t.Fatalf("expected page1 has_next=true, got %#v", env1.Meta["has_next"])
	}
	var data1 struct {
		Items []PullPackage `json:"items"`
	}
	if err := json.Unmarshal(env1.Data, &data1); err != nil {
		t.Fatalf("decode page1 data failed: %v", err)
	}
	if len(data1.Items) != 2 {
		t.Fatalf("expected page1 size=2, got %d", len(data1.Items))
	}

	page2 := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/packages?page=2&page_size=2", nil)
	if page2.Code != http.StatusOK {
		t.Fatalf("page2 failed: %d body=%s", page2.Code, page2.Body.String())
	}
	env2 := decodeEnvelope(t, page2)
	var data2 struct {
		Items []PullPackage `json:"items"`
	}
	if err := json.Unmarshal(env2.Data, &data2); err != nil {
		t.Fatalf("decode page2 data failed: %v", err)
	}
	if len(data2.Items) != 1 {
		t.Fatalf("expected page2 size=1, got %d", len(data2.Items))
	}
	if env2.Meta["has_next"] != false {
		t.Fatalf("expected page2 has_next=false, got %#v", env2.Meta["has_next"])
	}
}

// TestGetPullPackage 验证按 package_id 查询详情。
func TestGetPullPackage(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	created := fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-detail-a",
		SourceID:  "source-detail-a",
		TaskID:    "task-detail-a",
		SourceRef: "/var/log/detail-a.log",
		PackageNo: "pkg-detail-001",
		BatchID:   "batch-detail-001",
		Checksum:  "sha256-detail-001",
		Status:    "uploaded",
		Files: []PullPackageFile{{
			FilePath:   "/var/log/detail-a.log",
			FromOffset: 128,
			ToOffset:   256,
			LineCount:  16,
			SizeBytes:  1024,
		}},
		Metadata: map[string]string{"env": "test"},
		CreatedAt: time.Now().UTC(),
	})

	resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/packages/"+created.PackageID, nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("get package failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != "OK" {
		t.Fatalf("unexpected code: %s", envelope.Code)
	}
	var data struct {
		Item PullPackage `json:"item"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode package detail failed: %v", err)
	}
	if data.Item.PackageID != created.PackageID {
		t.Fatalf("package_id mismatch: got %s want %s", data.Item.PackageID, created.PackageID)
	}
	if data.Item.TaskID != "task-detail-a" {
		t.Fatalf("unexpected task_id: %s", data.Item.TaskID)
	}
	if len(data.Item.Files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(data.Item.Files))
	}
	if data.Item.Metadata["env"] != "test" {
		t.Fatalf("unexpected metadata: %+v", data.Item.Metadata)
	}
}

// TestGetPullPackageNotFound 验证 package_id 不存在返回 404。
func TestGetPullPackageNotFound(t *testing.T) {
	router := newTestRouter()

	resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/packages/00000000-0000-0000-0000-000000000001", nil)
	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != ErrorCodePackageNotFound {
		t.Fatalf("unexpected not found code: %s", envelope.Code)
	}
}

// TestListPullPackagesInvalidArgument 验证非法查询参数返回统一错误码。
func TestListPullPackagesInvalidArgument(t *testing.T) {
	router := newTestRouter()

	invalidStatusResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/packages?status=unknown", nil)
	if invalidStatusResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid status, got %d body=%s", invalidStatusResp.Code, invalidStatusResp.Body.String())
	}
	invalidStatusEnvelope := decodeEnvelope(t, invalidStatusResp)
	if invalidStatusEnvelope.Code != ErrorCodePackageInvalidArgument {
		t.Fatalf("unexpected invalid status code: %s", invalidStatusEnvelope.Code)
	}

	invalidPageResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/packages?page=0", nil)
	if invalidPageResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid page, got %d body=%s", invalidPageResp.Code, invalidPageResp.Body.String())
	}
	invalidPageEnvelope := decodeEnvelope(t, invalidPageResp)
	if invalidPageEnvelope.Code != ErrorCodePackageInvalidArgument {
		t.Fatalf("unexpected invalid page code: %s", invalidPageEnvelope.Code)
	}
}
