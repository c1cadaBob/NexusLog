package ingest

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

// AgentPullResponse 定义日志服务器调用 agent /logs/pull 的响应结构。
// 该结构与 collector-agent 的公开契约保持一致，用于服务端解析与后续落库映射。
type AgentPullResponse struct {
	BatchID    string            `json:"batch_id"`
	Records    []AgentPullRecord `json:"records"`
	NextCursor string            `json:"next_cursor"`
	HasMore    bool              `json:"has_more"`
}

// AgentPullRecord 定义 agent 拉取返回的单条日志结构。
type AgentPullRecord struct {
	RecordID    string            `json:"record_id"`
	Sequence    int64             `json:"sequence"`
	Source      string            `json:"source"`
	Timestamp   int64             `json:"timestamp"`
	CollectedAt string            `json:"collected_at"`
	Data        string            `json:"data"`
	SizeBytes   int               `json:"size_bytes"`
	Offset      int64             `json:"offset"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// PullPackageFile 定义包内文件级摘要，和 agent_package_files 表语义对齐。
// 额外补充 first/last 记录信息，便于链路排障与追溯定位。
type PullPackageFile struct {
	FilePath      string `json:"file_path"`
	FromOffset    int64  `json:"from_offset"`
	ToOffset      int64  `json:"to_offset"`
	LineCount     int    `json:"line_count"`
	SizeBytes     int64  `json:"size_bytes"`
	Checksum      string `json:"checksum,omitempty"`
	FirstRecordID string `json:"first_record_id,omitempty"`
	LastRecordID  string `json:"last_record_id,omitempty"`
	FirstSequence int64  `json:"first_sequence,omitempty"`
	LastSequence  int64  `json:"last_sequence,omitempty"`
}

// BuildPullPackageInput 定义从 agent 拉取批次生成增量包时所需的上下文参数。
type BuildPullPackageInput struct {
	AgentID   string
	SourceID  string
	SourceRef string
	PackageNo string
	CreatedAt time.Time
}

// BuildPullPackageFromAgentPull 将 agent pull 批次映射为控制面增量包结构。
// 该方法用于统一服务端“日志信息结构”，让 batch/record/file 三层都可追溯。
func BuildPullPackageFromAgentPull(input BuildPullPackageInput, resp AgentPullResponse) (PullPackage, error) {
	agentID := strings.TrimSpace(input.AgentID)
	if agentID == "" {
		return PullPackage{}, fmt.Errorf("agent_id is required")
	}

	batchID := strings.TrimSpace(resp.BatchID)
	if batchID == "" {
		return PullPackage{}, fmt.Errorf("batch_id is required")
	}
	if len(resp.Records) == 0 {
		return PullPackage{}, fmt.Errorf("records must not be empty")
	}

	type fileAgg struct {
		path       string
		fromOffset int64
		toOffset   int64
		lineCount  int
		sizeBytes  int64

		firstRecordID string
		lastRecordID  string
		firstSequence int64
		lastSequence  int64

		hasSequence        bool
		lastResolvedOffset int64
		hashBuilder        strings.Builder
	}

	fileAggs := make(map[string]*fileAgg)
	for _, record := range resp.Records {
		source := strings.TrimSpace(record.Source)
		if source == "" {
			source = "unknown"
		}

		agg, ok := fileAggs[source]
		if !ok {
			agg = &fileAgg{path: source}
			fileAggs[source] = agg
		}

		sizeBytes := resolveRecordSize(record)
		resolvedOffset := resolveRecordOffset(record, sizeBytes, agg.lastResolvedOffset)
		if resolvedOffset > agg.lastResolvedOffset {
			agg.lastResolvedOffset = resolvedOffset
		}
		fromCandidate := resolvedOffset - int64(sizeBytes)
		if fromCandidate < 0 {
			fromCandidate = 0
		}

		if agg.lineCount == 0 {
			agg.fromOffset = fromCandidate
			agg.toOffset = resolvedOffset
			agg.firstRecordID = record.RecordID
			agg.lastRecordID = record.RecordID
		} else {
			if fromCandidate < agg.fromOffset {
				agg.fromOffset = fromCandidate
			}
			if resolvedOffset > agg.toOffset {
				agg.toOffset = resolvedOffset
			}
			if record.RecordID != "" {
				agg.lastRecordID = record.RecordID
			}
		}

		if record.Sequence > 0 {
			if !agg.hasSequence {
				agg.hasSequence = true
				agg.firstSequence = record.Sequence
				agg.lastSequence = record.Sequence
				if record.RecordID != "" {
					agg.firstRecordID = record.RecordID
					agg.lastRecordID = record.RecordID
				}
			} else {
				if record.Sequence < agg.firstSequence {
					agg.firstSequence = record.Sequence
					if record.RecordID != "" {
						agg.firstRecordID = record.RecordID
					}
				}
				if record.Sequence > agg.lastSequence {
					agg.lastSequence = record.Sequence
					if record.RecordID != "" {
						agg.lastRecordID = record.RecordID
					}
				}
			}
		}

		agg.lineCount++
		agg.sizeBytes += int64(sizeBytes)

		// 以“来源+记录主键+位点+正文”生成稳定摘要，保证幂等重算结果一致。
		agg.hashBuilder.WriteString(source)
		agg.hashBuilder.WriteString("|")
		agg.hashBuilder.WriteString(record.RecordID)
		agg.hashBuilder.WriteString("|")
		agg.hashBuilder.WriteString(strconv.FormatInt(record.Sequence, 10))
		agg.hashBuilder.WriteString("|")
		agg.hashBuilder.WriteString(strconv.FormatInt(resolvedOffset, 10))
		agg.hashBuilder.WriteString("|")
		agg.hashBuilder.WriteString(record.Data)
		agg.hashBuilder.WriteString("\n")
	}

	files := make([]PullPackageFile, 0, len(fileAggs))
	packageFromOffset := int64(-1)
	packageToOffset := int64(0)
	packageSizeBytes := int64(0)
	for _, agg := range fileAggs {
		if packageFromOffset < 0 || agg.fromOffset < packageFromOffset {
			packageFromOffset = agg.fromOffset
		}
		if agg.toOffset > packageToOffset {
			packageToOffset = agg.toOffset
		}
		packageSizeBytes += agg.sizeBytes

		fileChecksum := sha256.Sum256([]byte(agg.hashBuilder.String()))
		files = append(files, PullPackageFile{
			FilePath:      agg.path,
			FromOffset:    agg.fromOffset,
			ToOffset:      agg.toOffset,
			LineCount:     agg.lineCount,
			SizeBytes:     agg.sizeBytes,
			Checksum:      hex.EncodeToString(fileChecksum[:]),
			FirstRecordID: strings.TrimSpace(agg.firstRecordID),
			LastRecordID:  strings.TrimSpace(agg.lastRecordID),
			FirstSequence: agg.firstSequence,
			LastSequence:  agg.lastSequence,
		})
	}

	// 固定返回顺序，避免 map 迭代引入的非确定性。
	sort.Slice(files, func(i, j int) bool {
		return files[i].FilePath < files[j].FilePath
	})

	if packageFromOffset < 0 {
		packageFromOffset = 0
	}

	sourceRef := strings.TrimSpace(input.SourceRef)
	if sourceRef == "" {
		if len(files) == 1 {
			sourceRef = files[0].FilePath
		} else {
			sourceRef = "multi-source"
		}
	}

	createdAt := input.CreatedAt.UTC()
	if createdAt.IsZero() {
		createdAt = time.Now().UTC()
	}

	packageNo := strings.TrimSpace(input.PackageNo)
	if packageNo == "" {
		packageNo = buildPackageNoFromBatch(batchID)
	}

	packageChecksum := buildPackageChecksum(batchID, strings.TrimSpace(resp.NextCursor), files)

	pkg := PullPackage{
		PackageID:   newUUIDLike(),
		SourceID:    strings.TrimSpace(input.SourceID),
		AgentID:     agentID,
		SourceRef:   sourceRef,
		PackageNo:   packageNo,
		BatchID:     batchID,
		NextCursor:  strings.TrimSpace(resp.NextCursor),
		RecordCount: len(resp.Records),
		FromOffset:  packageFromOffset,
		ToOffset:    packageToOffset,
		FileCount:   len(files),
		SizeBytes:   packageSizeBytes,
		Checksum:    packageChecksum,
		Status:      "uploaded",
		Files:       files,
		Metadata:    map[string]string{"has_more": strconv.FormatBool(resp.HasMore)},
		CreatedAt:   createdAt,
	}
	if pkg.NextCursor != "" {
		pkg.Metadata["next_cursor"] = pkg.NextCursor
	}
	return pkg, nil
}

func resolveRecordSize(record AgentPullRecord) int {
	sizeBytes := record.SizeBytes
	if sizeBytes <= 0 {
		sizeBytes = len(record.Data)
	}
	if sizeBytes <= 0 {
		return 1
	}
	return sizeBytes
}

func resolveRecordOffset(record AgentPullRecord, sizeBytes int, previousOffset int64) int64 {
	offset := record.Offset
	if offset <= 0 {
		offset = parseOffsetFromMetadata(record.Metadata)
	}
	if offset <= 0 {
		// 当上游未提供 offset 时，按来源内累计字节构造单调递增位点。
		offset = previousOffset + int64(sizeBytes)
	}
	if offset < int64(sizeBytes) {
		offset = int64(sizeBytes)
	}
	return offset
}

func parseOffsetFromMetadata(metadata map[string]string) int64 {
	if len(metadata) == 0 {
		return 0
	}
	raw := strings.TrimSpace(metadata["offset"])
	if raw == "" {
		return 0
	}
	offset, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || offset <= 0 {
		return 0
	}
	return offset
}

func buildPackageNoFromBatch(batchID string) string {
	trimmed := strings.TrimSpace(batchID)
	if trimmed == "" {
		return fmt.Sprintf("pkg-%d", time.Now().UTC().UnixNano())
	}
	return "pkg-" + sanitizeToken(trimmed)
}

func sanitizeToken(raw string) string {
	builder := strings.Builder{}
	for _, r := range raw {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			builder.WriteRune(r)
			continue
		}
		builder.WriteRune('-')
	}
	result := strings.Trim(builder.String(), "-")
	if result == "" {
		return fmt.Sprintf("batch-%d", time.Now().UTC().UnixNano())
	}
	if len(result) > 48 {
		return result[:48]
	}
	return result
}

func buildPackageChecksum(batchID, nextCursor string, files []PullPackageFile) string {
	builder := strings.Builder{}
	builder.WriteString(strings.TrimSpace(batchID))
	builder.WriteString("|")
	builder.WriteString(strings.TrimSpace(nextCursor))
	builder.WriteString("\n")
	for _, file := range files {
		builder.WriteString(file.FilePath)
		builder.WriteString("|")
		builder.WriteString(strconv.FormatInt(file.FromOffset, 10))
		builder.WriteString("|")
		builder.WriteString(strconv.FormatInt(file.ToOffset, 10))
		builder.WriteString("|")
		builder.WriteString(strconv.Itoa(file.LineCount))
		builder.WriteString("|")
		builder.WriteString(strconv.FormatInt(file.SizeBytes, 10))
		builder.WriteString("|")
		builder.WriteString(file.Checksum)
		builder.WriteString("\n")
	}
	h := sha256.Sum256([]byte(builder.String()))
	return hex.EncodeToString(h[:])
}
