package ingest

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// SchemaVersion 当前日志文档 schema 版本，用于 ingest layer。
const SchemaVersion = "1.0"

// PipelineVersion 当前 ingest pipeline 版本。
const PipelineVersion = "1.0"

// LogDocument 定义五层字段模型，对齐 doc20 规范。
type LogDocument struct {
	// Raw layer: 原始日志行
	Raw RawLayer `json:"raw,omitempty"`

	// Event layer: 事件语义
	Event EventLayer `json:"event,omitempty"`

	// Transport layer: 传输与采集元数据
	Transport TransportLayer `json:"transport,omitempty"`

	// Ingest layer: 入库元数据
	Ingest IngestLayer `json:"ingest,omitempty"`

	// Governance layer: 治理与合规
	Governance GovernanceLayer `json:"governance,omitempty"`
}

// RawLayer 原始层：保留原始日志内容。
type RawLayer struct {
	RawMessage string `json:"raw_message"`
}

// EventLayer 事件层：解析后的日志事件语义。
type EventLayer struct {
	EventID   string `json:"event_id"`
	Level     string `json:"level"`
	Timestamp string `json:"timestamp"`
	Message   string `json:"message"`
	Source    string `json:"source"`
}

// TransportLayer 传输层：agent 采集与传输元数据。
type TransportLayer struct {
	AgentID    string `json:"agent_id"`
	BatchID    string `json:"batch_id"`
	CollectTime string `json:"collect_time"`
	Sequence   int64  `json:"sequence"`
}

// IngestLayer 入库层：控制面 ingest 元数据。
type IngestLayer struct {
	IngestedAt      string `json:"ingested_at"`
	SchemaVersion   string `json:"schema_version"`
	PipelineVersion string `json:"pipeline_version"`
}

// GovernanceLayer 治理层：租户与合规。
type GovernanceLayer struct {
	TenantID       string `json:"tenant_id"`
	RetentionPolicy string `json:"retention_policy"`
	PIIMasked      bool   `json:"pii_masked"`
}

// ToESDocument 将 LogDocument 展平为 ES bulk 索引所需的 map，字段名与 ES 映射一致。
func (d *LogDocument) ToESDocument() map[string]any {
	m := make(map[string]any)

	// Raw layer
	if d.Raw.RawMessage != "" {
		m["raw_message"] = d.Raw.RawMessage
	}

	// Event layer
	if d.Event.EventID != "" {
		m["event_id"] = d.Event.EventID
	}
	// @timestamp 为 ES 标准时间字段，用于 ILM 与排序
	if d.Event.Timestamp != "" {
		m["@timestamp"] = d.Event.Timestamp
	}
	if d.Event.Level != "" {
		m["level"] = d.Event.Level
	}
	if d.Event.Timestamp != "" {
		m["timestamp"] = d.Event.Timestamp
	}
	if d.Event.Message != "" {
		m["message"] = d.Event.Message
	}
	if d.Event.Source != "" {
		m["source"] = d.Event.Source
	}

	// Transport layer
	if d.Transport.AgentID != "" {
		m["agent_id"] = d.Transport.AgentID
	}
	if d.Transport.BatchID != "" {
		m["batch_id"] = d.Transport.BatchID
	}
	if d.Transport.CollectTime != "" {
		m["collect_time"] = d.Transport.CollectTime
	}
	if d.Transport.Sequence != 0 {
		m["sequence"] = d.Transport.Sequence
	}

	// Ingest layer
	if d.Ingest.IngestedAt != "" {
		m["ingested_at"] = d.Ingest.IngestedAt
	}
	if d.Ingest.SchemaVersion != "" {
		m["schema_version"] = d.Ingest.SchemaVersion
	}
	if d.Ingest.PipelineVersion != "" {
		m["pipeline_version"] = d.Ingest.PipelineVersion
	}

	// Governance layer
	if d.Governance.TenantID != "" {
		m["tenant_id"] = d.Governance.TenantID
	}
	if d.Governance.RetentionPolicy != "" {
		m["retention_policy"] = d.Governance.RetentionPolicy
	}
	m["pii_masked"] = d.Governance.PIIMasked

	return m
}

// GenerateEventID 基于 agent_id + source + collect_time + sequence 生成确定性 ID，
// 用于 ES _id 以实现幂等写入。
func GenerateEventID(agentID, source, collectTime string, sequence int64) string {
	agentID = strings.TrimSpace(agentID)
	source = strings.TrimSpace(source)
	collectTime = strings.TrimSpace(collectTime)
	if agentID == "" {
		agentID = "unknown"
	}
	if source == "" {
		source = "unknown"
	}
	if collectTime == "" {
		collectTime = "0"
	}
	input := fmt.Sprintf("%s|%s|%s|%d", agentID, source, collectTime, sequence)
	h := sha256.Sum256([]byte(input))
	return hex.EncodeToString(h[:])
}

// BuildLogDocument 从 AgentPullRecord 及上下文构建 LogDocument。
func BuildLogDocument(
	record AgentPullRecord,
	agentID, batchID, sourceDisplay string,
	tenantID, retentionPolicy string,
) LogDocument {
	collectTime := strings.TrimSpace(record.CollectedAt)
	if collectTime == "" {
		collectTime = toRFC3339Nano(record.Timestamp)
	}
	eventID := GenerateEventID(agentID, record.Source, collectTime, record.Sequence)

	level := strings.TrimSpace(record.Metadata["level"])
	if level == "" {
		level = "info"
	}

	return LogDocument{
		Raw: RawLayer{
			RawMessage: record.Data,
		},
		Event: EventLayer{
			EventID:   eventID,
			Level:     level,
			Timestamp: toRFC3339Nano(record.Timestamp),
			Message:   record.Data,
			Source:    sourceDisplay,
		},
		Transport: TransportLayer{
			AgentID:     agentID,
			BatchID:     batchID,
			CollectTime: collectTime,
			Sequence:    record.Sequence,
		},
		Ingest: IngestLayer{
			IngestedAt:      time.Now().UTC().Format(time.RFC3339Nano),
			SchemaVersion:   SchemaVersion,
			PipelineVersion: PipelineVersion,
		},
		Governance: GovernanceLayer{
			TenantID:       strings.TrimSpace(tenantID),
			RetentionPolicy: strings.TrimSpace(retentionPolicy),
			PIIMasked:       false,
		},
	}
}
