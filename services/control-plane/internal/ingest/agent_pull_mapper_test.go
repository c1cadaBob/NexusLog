package ingest

import (
	"testing"
	"time"
)

// TestBuildPullPackageFromAgentPullSuccess 验证批次映射后的包级/文件级结构完整性。
func TestBuildPullPackageFromAgentPullSuccess(t *testing.T) {
	createdAt := time.Date(2026, 3, 3, 12, 0, 0, 0, time.UTC)
	pkg, err := BuildPullPackageFromAgentPull(BuildPullPackageInput{
		AgentID:   "agent-sh-01",
		SourceID:  "source-001",
		SourceRef: "",
		PackageNo: "",
		CreatedAt: createdAt,
	}, AgentPullResponse{
		BatchID:    "batch-abc-001",
		NextCursor: "102",
		HasMore:    false,
		Records: []AgentPullRecord{
			{RecordID: "rec-100", Sequence: 100, Source: "/var/log/a.log", Data: "line-a-1", SizeBytes: 8, Offset: 8},
			{RecordID: "rec-101", Sequence: 101, Source: "/var/log/a.log", Data: "line-a-2", SizeBytes: 8, Offset: 16},
			{RecordID: "rec-102", Sequence: 102, Source: "/var/log/b.log", Data: "bbb", SizeBytes: 3, Offset: 3},
		},
	})
	if err != nil {
		t.Fatalf("build package failed: %v", err)
	}

	if pkg.PackageID == "" {
		t.Fatalf("package_id should not be empty")
	}
	if pkg.AgentID != "agent-sh-01" {
		t.Fatalf("unexpected agent_id: %s", pkg.AgentID)
	}
	if pkg.SourceID != "source-001" {
		t.Fatalf("unexpected source_id: %s", pkg.SourceID)
	}
	if pkg.BatchID != "batch-abc-001" {
		t.Fatalf("unexpected batch_id: %s", pkg.BatchID)
	}
	if pkg.NextCursor != "102" {
		t.Fatalf("unexpected next_cursor: %s", pkg.NextCursor)
	}
	if pkg.RecordCount != 3 {
		t.Fatalf("expected record_count=3, got %d", pkg.RecordCount)
	}
	if pkg.FileCount != 2 {
		t.Fatalf("expected file_count=2, got %d", pkg.FileCount)
	}
	if pkg.SizeBytes != 19 {
		t.Fatalf("expected size_bytes=19, got %d", pkg.SizeBytes)
	}
	if pkg.FromOffset != 0 {
		t.Fatalf("expected from_offset=0, got %d", pkg.FromOffset)
	}
	if pkg.ToOffset != 16 {
		t.Fatalf("expected to_offset=16, got %d", pkg.ToOffset)
	}
	if pkg.Status != "uploaded" {
		t.Fatalf("expected status=uploaded, got %s", pkg.Status)
	}
	if pkg.SourceRef != "multi-source" {
		t.Fatalf("expected source_ref=multi-source, got %s", pkg.SourceRef)
	}
	if pkg.CreatedAt != createdAt {
		t.Fatalf("unexpected created_at: %s", pkg.CreatedAt)
	}
	if pkg.Metadata["has_more"] != "false" {
		t.Fatalf("expected metadata.has_more=false, got %#v", pkg.Metadata["has_more"])
	}
	if pkg.Metadata["next_cursor"] != "102" {
		t.Fatalf("expected metadata.next_cursor=102, got %#v", pkg.Metadata["next_cursor"])
	}
	if pkg.Checksum == "" {
		t.Fatalf("checksum should not be empty")
	}

	if len(pkg.Files) != 2 {
		t.Fatalf("expected 2 files, got %d", len(pkg.Files))
	}
	if pkg.Files[0].FilePath != "/var/log/a.log" {
		t.Fatalf("expected first file=/var/log/a.log, got %s", pkg.Files[0].FilePath)
	}
	if pkg.Files[0].FromOffset != 0 || pkg.Files[0].ToOffset != 16 {
		t.Fatalf("unexpected first file offsets: %+v", pkg.Files[0])
	}
	if pkg.Files[0].LineCount != 2 || pkg.Files[0].SizeBytes != 16 {
		t.Fatalf("unexpected first file counters: %+v", pkg.Files[0])
	}
	if pkg.Files[0].FirstRecordID != "rec-100" || pkg.Files[0].LastRecordID != "rec-101" {
		t.Fatalf("unexpected first file record ids: %+v", pkg.Files[0])
	}
	if pkg.Files[0].FirstSequence != 100 || pkg.Files[0].LastSequence != 101 {
		t.Fatalf("unexpected first file sequences: %+v", pkg.Files[0])
	}

	if pkg.Files[1].FilePath != "/var/log/b.log" {
		t.Fatalf("expected second file=/var/log/b.log, got %s", pkg.Files[1].FilePath)
	}
	if pkg.Files[1].FromOffset != 0 || pkg.Files[1].ToOffset != 3 {
		t.Fatalf("unexpected second file offsets: %+v", pkg.Files[1])
	}
	if pkg.Files[1].LineCount != 1 || pkg.Files[1].SizeBytes != 3 {
		t.Fatalf("unexpected second file counters: %+v", pkg.Files[1])
	}
	if pkg.Files[1].Checksum == "" {
		t.Fatalf("second file checksum should not be empty")
	}
}

// TestBuildPullPackageFromAgentPullFallbackOffset 验证 offset/size 缺省时的兜底逻辑。
func TestBuildPullPackageFromAgentPullFallbackOffset(t *testing.T) {
	pkg, err := BuildPullPackageFromAgentPull(BuildPullPackageInput{
		AgentID:   "agent-sh-02",
		SourceRef: "/var/log/app.log",
	}, AgentPullResponse{
		BatchID:    "batch-fallback-01",
		NextCursor: "2",
		HasMore:    true,
		Records: []AgentPullRecord{
			{RecordID: "rec-1", Source: "/var/log/app.log", Data: "hello", SizeBytes: 0, Offset: 0, Metadata: map[string]string{"offset": "5"}},
			{RecordID: "rec-2", Source: "/var/log/app.log", Data: "go", SizeBytes: 0, Offset: 0},
		},
	})
	if err != nil {
		t.Fatalf("build package failed: %v", err)
	}

	if pkg.SourceRef != "/var/log/app.log" {
		t.Fatalf("unexpected source_ref: %s", pkg.SourceRef)
	}
	if pkg.RecordCount != 2 || pkg.FileCount != 1 {
		t.Fatalf("unexpected package counters: %+v", pkg)
	}
	if len(pkg.Files) != 1 {
		t.Fatalf("expected one file, got %d", len(pkg.Files))
	}

	file := pkg.Files[0]
	if file.FromOffset != 0 {
		t.Fatalf("expected file.from_offset=0, got %d", file.FromOffset)
	}
	if file.ToOffset != 7 {
		t.Fatalf("expected file.to_offset=7, got %d", file.ToOffset)
	}
	if file.LineCount != 2 {
		t.Fatalf("expected file.line_count=2, got %d", file.LineCount)
	}
	if file.SizeBytes != 7 {
		t.Fatalf("expected file.size_bytes=7, got %d", file.SizeBytes)
	}
	if pkg.Metadata["has_more"] != "true" {
		t.Fatalf("expected metadata.has_more=true, got %#v", pkg.Metadata["has_more"])
	}
}

// TestBuildPullPackageFromAgentPullInvalidInput 验证关键参数缺失时返回明确错误。
func TestBuildPullPackageFromAgentPullInvalidInput(t *testing.T) {
	_, err := BuildPullPackageFromAgentPull(BuildPullPackageInput{}, AgentPullResponse{
		BatchID: "batch-x",
		Records: []AgentPullRecord{{Source: "/a.log", Data: "x"}},
	})
	if err == nil {
		t.Fatalf("expected error when agent_id is empty")
	}

	_, err = BuildPullPackageFromAgentPull(BuildPullPackageInput{AgentID: "agent-x"}, AgentPullResponse{
		BatchID: "",
		Records: []AgentPullRecord{{Source: "/a.log", Data: "x"}},
	})
	if err == nil {
		t.Fatalf("expected error when batch_id is empty")
	}

	_, err = BuildPullPackageFromAgentPull(BuildPullPackageInput{AgentID: "agent-x"}, AgentPullResponse{
		BatchID: "batch-x",
		Records: nil,
	})
	if err == nil {
		t.Fatalf("expected error when records are empty")
	}
}
