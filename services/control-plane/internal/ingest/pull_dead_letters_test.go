package ingest

import (
	"encoding/json"
	"net/http"
	"net/url"
	"testing"
	"time"
)

// createDeadLetterForTest 注入死信记录并返回 dead_letter_id。
func createDeadLetterForTest(t *testing.T, fixture testFixture, packageID, sourceRef string) string {
	t.Helper()

	record := fixture.deadLetterStore.CreateForTest(DeadLetterRecord{
		PackageID:    packageID,
		SourceRef:    sourceRef,
		ErrorCode:    "TEST_ERROR",
		ErrorMessage: "test dead letter",
		RetryCount:   0,
		FailedAt:     time.Now().UTC(),
		CreatedAt:    time.Now().UTC(),
	})
	return record.DeadLetterID
}

// TestListDeadLettersByFilter 验证 source_ref / package_id / replayed 联合筛选。
func TestListDeadLettersByFilter(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	now := time.Now().UTC()
	replayedAt := now.Add(-30 * time.Second)
	fixture.deadLetterStore.CreateForTest(DeadLetterRecord{
		PackageID:    "pkg-dl-1",
		SourceRef:    "/var/log/app-a.log",
		ErrorCode:    "DL_A",
		ErrorMessage: "dead letter a",
		RetryCount:   1,
		FailedAt:     now.Add(-2 * time.Minute),
		CreatedAt:    now.Add(-2 * time.Minute),
		ReplayedAt:   &replayedAt,
	})
	fixture.deadLetterStore.CreateForTest(DeadLetterRecord{
		PackageID:    "pkg-dl-2",
		SourceRef:    "/var/log/app-a.log",
		ErrorCode:    "DL_B",
		ErrorMessage: "dead letter b",
		RetryCount:   0,
		FailedAt:     now.Add(-1 * time.Minute),
		CreatedAt:    now.Add(-1 * time.Minute),
	})
	fixture.deadLetterStore.CreateForTest(DeadLetterRecord{
		PackageID:    "pkg-dl-3",
		SourceRef:    "/var/log/app-b.log",
		ErrorCode:    "DL_C",
		ErrorMessage: "dead letter c",
		RetryCount:   0,
		FailedAt:     now,
		CreatedAt:    now,
	})

	query := "/api/v1/ingest/dead-letters?source_ref=" + url.QueryEscape("/var/log/app-a.log") + "&package_id=pkg-dl-2&replayed=no&page=1&page_size=10"
	resp := performJSONRequest(router, http.MethodGet, query, nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("list dead letters failed: %d body=%s", resp.Code, resp.Body.String())
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
		Items []DeadLetterRecord `json:"items"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode dead letters data failed: %v", err)
	}
	if len(data.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(data.Items))
	}
	if data.Items[0].PackageID != "pkg-dl-2" || data.Items[0].SourceRef != "/var/log/app-a.log" {
		t.Fatalf("unexpected dead letter item: %+v", data.Items[0])
	}
	if data.Items[0].ReplayedAt != nil {
		t.Fatalf("expected unreplayed item, got %+v", data.Items[0])
	}
}

// TestListDeadLettersPagination 验证死信分页与 total 元数据。
func TestListDeadLettersPagination(t *testing.T) {
	fixture := newTestFixture()
	router := fixture.router

	now := time.Now().UTC()
	fixture.deadLetterStore.CreateForTest(DeadLetterRecord{PackageID: "pkg-page-1", SourceRef: "/logs/page-a.log", ErrorCode: "DL1", FailedAt: now.Add(-3 * time.Minute), CreatedAt: now.Add(-3 * time.Minute)})
	fixture.deadLetterStore.CreateForTest(DeadLetterRecord{PackageID: "pkg-page-2", SourceRef: "/logs/page-b.log", ErrorCode: "DL2", FailedAt: now.Add(-2 * time.Minute), CreatedAt: now.Add(-2 * time.Minute)})
	fixture.deadLetterStore.CreateForTest(DeadLetterRecord{PackageID: "pkg-page-3", SourceRef: "/logs/page-c.log", ErrorCode: "DL3", FailedAt: now.Add(-1 * time.Minute), CreatedAt: now.Add(-1 * time.Minute)})

	page1 := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/dead-letters?page=1&page_size=2", nil)
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
		Items []DeadLetterRecord `json:"items"`
	}
	if err := json.Unmarshal(env1.Data, &data1); err != nil {
		t.Fatalf("decode page1 data failed: %v", err)
	}
	if len(data1.Items) != 2 {
		t.Fatalf("expected page1 size=2, got %d", len(data1.Items))
	}

	page2 := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/dead-letters?page=2&page_size=2", nil)
	if page2.Code != http.StatusOK {
		t.Fatalf("page2 failed: %d body=%s", page2.Code, page2.Body.String())
	}
	env2 := decodeEnvelope(t, page2)
	var data2 struct {
		Items []DeadLetterRecord `json:"items"`
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

// TestListDeadLettersInvalidArgument 验证非法查询参数返回统一错误码。
func TestListDeadLettersInvalidArgument(t *testing.T) {
	router := newTestRouter()

	invalidReplayedResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/dead-letters?replayed=maybe", nil)
	if invalidReplayedResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid replayed, got %d body=%s", invalidReplayedResp.Code, invalidReplayedResp.Body.String())
	}
	invalidReplayedEnvelope := decodeEnvelope(t, invalidReplayedResp)
	if invalidReplayedEnvelope.Code != ErrorCodeDeadLetterInvalidArgument {
		t.Fatalf("unexpected invalid replayed code: %s", invalidReplayedEnvelope.Code)
	}

	invalidPageResp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/dead-letters?page=0", nil)
	if invalidPageResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid page, got %d body=%s", invalidPageResp.Code, invalidPageResp.Body.String())
	}
	invalidPageEnvelope := decodeEnvelope(t, invalidPageResp)
	if invalidPageEnvelope.Code != ErrorCodeDeadLetterInvalidArgument {
		t.Fatalf("unexpected invalid page code: %s", invalidPageEnvelope.Code)
	}
}

// TestReplayDeadLettersSuccess 验证死信重放成功与计数返回。
func TestReplayDeadLettersSuccess(t *testing.T) {
	fixture := newTestFixture()

	id1 := createDeadLetterForTest(t, fixture, "pkg-dl-1", "/var/log/dl-1.log")
	id2 := createDeadLetterForTest(t, fixture, "pkg-dl-2", "/var/log/dl-2.log")

	resp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/dead-letters/replay", map[string]any{
		"dead_letter_ids": []string{id1, id2},
		"reason":          "manual replay after fix",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("replay dead letters failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != "OK" || envelope.Message != "success" {
		t.Fatalf("unexpected envelope: %+v", envelope)
	}
	var data struct {
		ReplayBatchID string `json:"replay_batch_id"`
		ReplayedCount int    `json:"replayed_count"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode replay data failed: %v", err)
	}
	if data.ReplayBatchID == "" {
		t.Fatalf("replay_batch_id should not be empty")
	}
	if data.ReplayedCount != 2 {
		t.Fatalf("expected replayed_count=2, got %d", data.ReplayedCount)
	}

	record1, ok := fixture.deadLetterStore.Get(id1)
	if !ok {
		t.Fatalf("dead letter not found: %s", id1)
	}
	if record1.ReplayBatchID != data.ReplayBatchID || record1.ReplayReason != "manual replay after fix" {
		t.Fatalf("dead letter replay metadata not updated: %+v", record1)
	}
	if record1.ReplayedAt == nil {
		t.Fatalf("dead letter replayed_at should be set")
	}
	if record1.RetryCount != 1 {
		t.Fatalf("dead letter retry_count should be 1, got %d", record1.RetryCount)
	}
}

// TestReplayDeadLettersInvalidArgument 验证参数非法场景。
func TestReplayDeadLettersInvalidArgument(t *testing.T) {
	fixture := newTestFixture()

	emptyIDs := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/dead-letters/replay", map[string]any{
		"dead_letter_ids": []string{},
		"reason":          "retry",
	})
	if emptyIDs.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for empty ids, got %d body=%s", emptyIDs.Code, emptyIDs.Body.String())
	}
	emptyEnvelope := decodeEnvelope(t, emptyIDs)
	if emptyEnvelope.Code != ErrorCodeDeadLetterInvalidArgument {
		t.Fatalf("unexpected invalid argument code: %s", emptyEnvelope.Code)
	}

	noReason := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/dead-letters/replay", map[string]any{
		"dead_letter_ids": []string{"00000000-0000-0000-0000-000000000001"},
	})
	if noReason.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing reason, got %d body=%s", noReason.Code, noReason.Body.String())
	}
	noReasonEnvelope := decodeEnvelope(t, noReason)
	if noReasonEnvelope.Code != ErrorCodeDeadLetterInvalidArgument {
		t.Fatalf("unexpected no reason code: %s", noReasonEnvelope.Code)
	}
}

// TestReplayDeadLettersNotFound 验证死信不存在场景。
func TestReplayDeadLettersNotFound(t *testing.T) {
	fixture := newTestFixture()

	resp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/dead-letters/replay", map[string]any{
		"dead_letter_ids": []string{"00000000-0000-0000-0000-000000000009"},
		"reason":          "manual replay",
	})
	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", resp.Code, resp.Body.String())
	}
	envelope := decodeEnvelope(t, resp)
	if envelope.Code != ErrorCodeDeadLetterNotFound {
		t.Fatalf("unexpected not found code: %s", envelope.Code)
	}
}
