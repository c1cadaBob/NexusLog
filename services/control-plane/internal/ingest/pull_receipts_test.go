package ingest

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

// createPackageForReceiptTest 创建回执测试所需的包数据并返回 package_id。
func createPackageForReceiptTest(t *testing.T, fixture testFixture, status, checksum string) string {
	t.Helper()

	created := fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-receipt-a",
		SourceRef: "/var/log/receipt-a.log",
		PackageNo: "pkg-receipt-001",
		Checksum:  checksum,
		Status:    status,
		CreatedAt: time.Now().UTC(),
	})
	return created.PackageID
}

// getPackageForReceiptTest 查询包状态用于断言回执处理结果。
func getPackageForReceiptTest(t *testing.T, fixture testFixture, packageID string) PullPackage {
	t.Helper()

	pkg, ok := fixture.packageStore.Get(packageID)
	if !ok {
		t.Fatalf("package not found: %s", packageID)
	}
	return pkg
}

// TestCreateReceiptAck 验证 ACK 回执写入与包状态更新。
func TestCreateReceiptAck(t *testing.T) {
	fixture := newTestFixture()
	packageID := createPackageForReceiptTest(t, fixture, "uploaded", "sha256-receipt-ack")

	resp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": packageID,
		"status":     "ack",
		"checksum":   "sha256-receipt-ack",
	})
	if resp.Code != http.StatusCreated {
		t.Fatalf("create receipt failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != "OK" || envelope.Message != "success" {
		t.Fatalf("unexpected envelope: %+v", envelope)
	}
	var data struct {
		ReceiptID string `json:"receipt_id"`
		Accepted  bool   `json:"accepted"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode receipt data failed: %v", err)
	}
	if data.ReceiptID == "" {
		t.Fatalf("receipt_id should not be empty")
	}
	if !data.Accepted {
		t.Fatalf("expected accepted=true")
	}

	updated := getPackageForReceiptTest(t, fixture, packageID)
	if updated.Status != "acked" {
		t.Fatalf("expected package status acked, got %s", updated.Status)
	}
	if updated.AckedAt == nil {
		t.Fatalf("expected acked_at to be set")
	}
}

// TestCreateReceiptNack 验证 NACK 回执写入与包状态更新。
func TestCreateReceiptNack(t *testing.T) {
	fixture := newTestFixture()
	packageID := createPackageForReceiptTest(t, fixture, "uploaded", "sha256-receipt-nack")

	resp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": packageID,
		"status":     "nack",
		"reason":     "checksum validation failed",
		"checksum":   "sha256-receipt-nack",
	})
	if resp.Code != http.StatusCreated {
		t.Fatalf("create receipt nack failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	var data struct {
		Accepted bool `json:"accepted"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode receipt data failed: %v", err)
	}
	if !data.Accepted {
		t.Fatalf("expected accepted=true")
	}

	updated := getPackageForReceiptTest(t, fixture, packageID)
	if updated.Status != "nacked" {
		t.Fatalf("expected package status nacked, got %s", updated.Status)
	}

	// nack 应触发死信记录写入，供 6.6 replay 使用。
	if fixture.deadLetterStore.Count() != 1 {
		t.Fatalf("expected dead letter count=1, got %d", fixture.deadLetterStore.Count())
	}
}

// TestCreateReceiptInvalidArgument 验证参数非法场景。
func TestCreateReceiptInvalidArgument(t *testing.T) {
	fixture := newTestFixture()

	missingPackageResp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"status": "ack",
	})
	if missingPackageResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing package_id, got %d body=%s", missingPackageResp.Code, missingPackageResp.Body.String())
	}
	missingPackageEnvelope := decodeEnvelope(t, missingPackageResp)
	if missingPackageEnvelope.Code != ErrorCodeReceiptInvalidArgument {
		t.Fatalf("unexpected error code: %s", missingPackageEnvelope.Code)
	}

	invalidStatusResp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": "pkg-unknown",
		"status":     "done",
	})
	if invalidStatusResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid status, got %d body=%s", invalidStatusResp.Code, invalidStatusResp.Body.String())
	}
	invalidStatusEnvelope := decodeEnvelope(t, invalidStatusResp)
	if invalidStatusEnvelope.Code != ErrorCodeReceiptInvalidArgument {
		t.Fatalf("unexpected invalid status error code: %s", invalidStatusEnvelope.Code)
	}

	// nack 缺少 reason。
	packageID := createPackageForReceiptTest(t, fixture, "uploaded", "sha256-receipt-reason")
	missingReasonResp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": packageID,
		"status":     "nack",
	})
	if missingReasonResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for nack without reason, got %d body=%s", missingReasonResp.Code, missingReasonResp.Body.String())
	}
	missingReasonEnvelope := decodeEnvelope(t, missingReasonResp)
	if missingReasonEnvelope.Code != ErrorCodeReceiptInvalidArgument {
		t.Fatalf("unexpected missing reason error code: %s", missingReasonEnvelope.Code)
	}
}

// TestCreateReceiptPackageNotFound 验证 package 不存在场景。
func TestCreateReceiptPackageNotFound(t *testing.T) {
	fixture := newTestFixture()

	resp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": "00000000-0000-0000-0000-000000000123",
		"status":     "ack",
	})
	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", resp.Code, resp.Body.String())
	}
	envelope := decodeEnvelope(t, resp)
	if envelope.Code != ErrorCodeReceiptPackageNotFound {
		t.Fatalf("unexpected not found code: %s", envelope.Code)
	}
}

// TestCreateReceiptChecksumMismatch 验证 checksum 不一致场景。
func TestCreateReceiptChecksumMismatch(t *testing.T) {
	fixture := newTestFixture()
	packageID := createPackageForReceiptTest(t, fixture, "uploaded", "sha256-receipt-real")

	resp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": packageID,
		"status":     "ack",
		"checksum":   "sha256-receipt-wrong",
	})
	if resp.Code != http.StatusConflict {
		t.Fatalf("expected 409 for checksum mismatch, got %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != ErrorCodeReceiptChecksumMismatch {
		t.Fatalf("unexpected checksum mismatch code: %s", envelope.Code)
	}

	// checksum 冲突时不应更新包状态。
	pkg := getPackageForReceiptTest(t, fixture, packageID)
	if pkg.Status != "uploaded" {
		t.Fatalf("package status should remain uploaded, got %s", pkg.Status)
	}
}
