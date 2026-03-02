package ingest

import (
	"encoding/json"
	"net/http"
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
