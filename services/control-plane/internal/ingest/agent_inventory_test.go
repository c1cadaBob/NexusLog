package ingest

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

// TestListPullSourceStatusUsesFullWindowPackages 验证状态页趋势统计按时间窗口取全量包，而不是截断最近固定数量。
func TestListPullSourceStatusUsesFullWindowPackages(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	sourceStore := NewPullSourceStore()
	taskStore := NewPullTaskStore()
	packageStore := NewPullPackageStore()
	cursorStore := NewPullCursorStore()
	handler := NewAgentInventoryHandler(sourceStore, taskStore, packageStore, cursorStore, nil, nil, "", "")
	router.GET("/api/v1/ingest/pull-sources/status", handler.ListPullSourceStatus)

	source, err := sourceStore.Create(CreatePullSourceRequest{
		Name:            "status-source-a",
		Host:            "127.0.0.1",
		Port:            9091,
		Protocol:        "http",
		Path:            "/var/log/messages",
		AgentBaseURL:    "http://127.0.0.1:9091",
		PullIntervalSec: 2,
		PullTimeoutSec:  15,
		Status:          "active",
	})
	if err != nil {
		t.Fatalf("create source failed: %v", err)
	}

	now := time.Now().UTC()
	for i := 0; i < 300; i++ {
		createdAt := now.Add(-59 * time.Minute).Add(time.Duration(i) * 10 * time.Second)
		packageStore.CreateForTest(PullPackage{
			SourceID:    source.SourceID,
			AgentID:     "collector-agent",
			SourceRef:   source.Path,
			PackageNo:   "pkg-window-" + newUUIDLike(),
			Checksum:    "sha256-window-" + newUUIDLike(),
			Status:      "acked",
			RecordCount: 1,
			FileCount:   1,
			SizeBytes:   128,
			CreatedAt:   createdAt,
		})
	}
	packageStore.CreateForTest(PullPackage{
		SourceID:    source.SourceID,
		AgentID:     "collector-agent",
		SourceRef:   source.Path,
		PackageNo:   "pkg-outside-window",
		Checksum:    "sha256-outside-window",
		Status:      "acked",
		RecordCount: 99,
		FileCount:   1,
		SizeBytes:   128,
		CreatedAt:   now.Add(-2 * time.Hour),
	})

	resp := performJSONRequest(router, http.MethodGet, "/api/v1/ingest/pull-sources/status?range=1h", nil)
	if resp.Code != http.StatusOK {
		t.Fatalf("list pull source status failed: %d body=%s", resp.Code, resp.Body.String())
	}

	envelope := decodeEnvelope(t, resp)
	if envelope.Code != "OK" {
		t.Fatalf("unexpected code: %s", envelope.Code)
	}

	var data struct {
		Summary PullSourceStatusSummary      `json:"summary"`
		Trend   []PullSourceStatusTrendPoint `json:"trend"`
	}
	if err := json.Unmarshal(envelope.Data, &data); err != nil {
		t.Fatalf("decode status data failed: %v", err)
	}

	if data.Summary.RecentPackageCount != 300 {
		t.Fatalf("expected recent_package_count=300, got %d", data.Summary.RecentPackageCount)
	}
	if data.Summary.RecentRecordCount != 300 {
		t.Fatalf("expected recent_record_count=300, got %d", data.Summary.RecentRecordCount)
	}
	if len(data.Trend) < 12 {
		t.Fatalf("expected full 1h trend buckets, got %d", len(data.Trend))
	}

	totalPackages := 0
	totalRecords := 0
	for _, point := range data.Trend {
		totalPackages += point.PackageCount
		totalRecords += point.RecordCount
	}
	if totalPackages != 300 {
		t.Fatalf("expected trend package total=300, got %d", totalPackages)
	}
	if totalRecords != 300 {
		t.Fatalf("expected trend record total=300, got %d", totalRecords)
	}
}
