package ingest

import (
	"encoding/json"
	"net/http"
	"net/url"
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

// TestListReceiptsByFilter 验证按 source_ref / package_id / status 查询回执。
func TestListReceiptsByFilter(t *testing.T) {
	fixture := newTestFixture()
	now := time.Now().UTC()

	pkgAck := fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-receipt-filter-a",
		SourceRef: "/var/log/app-a.log",
		PackageNo: "pkg-filter-ack",
		Checksum:  "sha256-filter-ack",
		Status:    "uploaded",
		CreatedAt: now.Add(-3 * time.Minute),
	})
	pkgNack := fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-receipt-filter-b",
		SourceRef: "/var/log/app-a.log",
		PackageNo: "pkg-filter-nack",
		Checksum:  "sha256-filter-nack",
		Status:    "uploaded",
		CreatedAt: now.Add(-2 * time.Minute),
	})
	pkgOther := fixture.packageStore.CreateForTest(PullPackage{
		AgentID:   "agent-receipt-filter-c",
		SourceRef: "/var/log/app-b.log",
		PackageNo: "pkg-filter-other",
		Checksum:  "sha256-filter-other",
		Status:    "uploaded",
		CreatedAt: now.Add(-1 * time.Minute),
	})

	ackResp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": pkgAck.PackageID,
		"status":     "ack",
		"checksum":   pkgAck.Checksum,
	})
	if ackResp.Code != http.StatusCreated {
		t.Fatalf("create ack receipt failed: %d body=%s", ackResp.Code, ackResp.Body.String())
	}

	nackResp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": pkgNack.PackageID,
		"status":     "nack",
		"reason":     "downstream rejected batch",
		"checksum":   pkgNack.Checksum,
	})
	if nackResp.Code != http.StatusCreated {
		t.Fatalf("create nack receipt failed: %d body=%s", nackResp.Code, nackResp.Body.String())
	}

	otherResp := performJSONRequest(fixture.router, http.MethodPost, "/api/v1/ingest/receipts", map[string]any{
		"package_id": pkgOther.PackageID,
		"status":     "ack",
		"checksum":   pkgOther.Checksum,
	})
	if otherResp.Code != http.StatusCreated {
		t.Fatalf("create other receipt failed: %d body=%s", otherResp.Code, otherResp.Body.String())
	}

	query := "/api/v1/ingest/receipts?source_ref=" + url.QueryEscape("/var/log/app-a.log") + "&package_id=" + url.QueryEscape(pkgNack.PackageID) + "&status=nack&page=1&page_size=10"
	resp := performJSONRequest(fixture.router, http.MethodGet, query, nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("list receipts failed: %d body=%s", resp.Code, resp.Body.String())
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
		Items []DeliveryReceipt `json:"items"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode receipt list failed: %v", err)
	}
	if len(data.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(data.Items))
	}
	if data.Items[0].PackageID != pkgNack.PackageID {
		t.Fatalf("unexpected package_id: %+v", data.Items[0])
	}
	if data.Items[0].Status != "nack" || data.Items[0].SourceRef != "/var/log/app-a.log" {
		t.Fatalf("unexpected receipt item: %+v", data.Items[0])
	}
	if data.Items[0].ErrorCode != "NACK_RECEIPT" {
		t.Fatalf("unexpected error code: %+v", data.Items[0])
	}
}

// TestListReceiptsPagination 验证回执分页元数据。
func TestListReceiptsPagination(t *testing.T) {
	fixture := newTestFixture()
	now := time.Now().UTC()

	_, _ = fixture.receiptStore.Create(DeliveryReceipt{
		PackageID:  "pkg-page-1",
		PackageNo:  "pkg-page-1",
		SourceRef:  "/var/log/page-a.log",
		Status:     "ack",
		Accepted:   true,
		ReceivedAt: now.Add(-3 * time.Minute),
		CreatedAt:  now.Add(-3 * time.Minute),
	})
	_, _ = fixture.receiptStore.Create(DeliveryReceipt{
		PackageID:  "pkg-page-2",
		PackageNo:  "pkg-page-2",
		SourceRef:  "/var/log/page-b.log",
		Status:     "nack",
		ErrorCode:  "NACK_RECEIPT",
		Reason:     "page test nack",
		Accepted:   true,
		ReceivedAt: now.Add(-2 * time.Minute),
		CreatedAt:  now.Add(-2 * time.Minute),
	})
	_, _ = fixture.receiptStore.Create(DeliveryReceipt{
		PackageID:  "pkg-page-3",
		PackageNo:  "pkg-page-3",
		SourceRef:  "/var/log/page-c.log",
		Status:     "ack",
		Accepted:   true,
		ReceivedAt: now.Add(-1 * time.Minute),
		CreatedAt:  now.Add(-1 * time.Minute),
	})

	page1 := performJSONRequest(fixture.router, http.MethodGet, "/api/v1/ingest/receipts?page=1&page_size=2", nil)
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
		Items []DeliveryReceipt `json:"items"`
	}
	if err := json.Unmarshal(env1.Data, &data1); err != nil {
		t.Fatalf("decode page1 data failed: %v", err)
	}
	if len(data1.Items) != 2 {
		t.Fatalf("expected page1 size=2, got %d", len(data1.Items))
	}

	page2 := performJSONRequest(fixture.router, http.MethodGet, "/api/v1/ingest/receipts?page=2&page_size=2", nil)
	if page2.Code != http.StatusOK {
		t.Fatalf("page2 failed: %d body=%s", page2.Code, page2.Body.String())
	}
	env2 := decodeEnvelope(t, page2)
	var data2 struct {
		Items []DeliveryReceipt `json:"items"`
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

// TestListReceiptsInvalidArgument 验证查询参数非法场景。
func TestListReceiptsInvalidArgument(t *testing.T) {
	fixture := newTestFixture()

	invalidStatusResp := performJSONRequest(fixture.router, http.MethodGet, "/api/v1/ingest/receipts?status=done", nil)
	if invalidStatusResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid status, got %d body=%s", invalidStatusResp.Code, invalidStatusResp.Body.String())
	}
	invalidStatusEnvelope := decodeEnvelope(t, invalidStatusResp)
	if invalidStatusEnvelope.Code != ErrorCodeReceiptInvalidArgument {
		t.Fatalf("unexpected invalid status code: %s", invalidStatusEnvelope.Code)
	}

	invalidPageResp := performJSONRequest(fixture.router, http.MethodGet, "/api/v1/ingest/receipts?page=0", nil)
	if invalidPageResp.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid page, got %d body=%s", invalidPageResp.Code, invalidPageResp.Body.String())
	}
	invalidPageEnvelope := decodeEnvelope(t, invalidPageResp)
	if invalidPageEnvelope.Code != ErrorCodeReceiptInvalidArgument {
		t.Fatalf("unexpected invalid page code: %s", invalidPageEnvelope.Code)
	}
}
