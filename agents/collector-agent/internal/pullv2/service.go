package pullv2

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	ErrSourceKeyRequired = errors.New("source_key is required")
	ErrBatchNotFound     = errors.New("batch not found")
	ErrCursorMismatch    = errors.New("committed_cursor must match batch next cursor")
	ErrBufferFull        = errors.New("source buffer is full")
)

type AckStatus string

const (
	AckStatusAck  AckStatus = "ack"
	AckStatusNack AckStatus = "nack"
)

type Record struct {
	RecordID   string            `json:"record_id"`
	FilePath   string            `json:"file_path"`
	Body       string            `json:"body"`
	Offset     int64             `json:"offset"`
	ObservedAt time.Time         `json:"observed_at"`
	Attributes map[string]string `json:"attributes,omitempty"`
}

type PullRequest struct {
	SourceKey  string `json:"source_key"`
	Cursor     string `json:"cursor,omitempty"`
	MaxRecords int    `json:"max_records"`
}

type PullCursor struct {
	Prev    string `json:"prev,omitempty"`
	Next    string `json:"next,omitempty"`
	HasMore bool   `json:"has_more"`
}

type PullResponse struct {
	BatchID   string     `json:"batch_id,omitempty"`
	SourceKey string     `json:"source_key"`
	Cursor    PullCursor `json:"cursor"`
	Records   []Record   `json:"records"`
}

type AckRequest struct {
	BatchID         string    `json:"batch_id"`
	Status          AckStatus `json:"status"`
	CommittedCursor string    `json:"committed_cursor,omitempty"`
}

type AckResult struct {
	Accepted          bool   `json:"accepted"`
	CheckpointUpdated bool   `json:"checkpoint_updated"`
	SourceKey         string `json:"source_key,omitempty"`
	Cursor            string `json:"cursor,omitempty"`
}

type CheckpointSaver interface {
	Save(sourceKey string, filePath string, offset int64) error
}

type bufferedRecord struct {
	Seq int64
	Record
}

type pendingBatch struct {
	SourceKey  string
	NextCursor int64
	Records    []bufferedRecord
}

type Service struct {
	mu                 sync.Mutex
	saver              CheckpointSaver
	maxBufferedRecords int
	nextSeq            map[string]int64
	committed          map[string]int64
	records            map[string][]bufferedRecord
	pending            map[string]pendingBatch
}

func New(maxBufferedRecords int, saver CheckpointSaver) *Service {
	if maxBufferedRecords <= 0 {
		maxBufferedRecords = 10000
	}
	return &Service{
		saver:              saver,
		maxBufferedRecords: maxBufferedRecords,
		nextSeq:            make(map[string]int64),
		committed:          make(map[string]int64),
		records:            make(map[string][]bufferedRecord),
		pending:            make(map[string]pendingBatch),
	}
}

func (s *Service) Append(sourceKey string, records []Record) error {
	sourceKey = strings.TrimSpace(sourceKey)
	if sourceKey == "" {
		return ErrSourceKeyRequired
	}
	if len(records) == 0 {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	current := s.records[sourceKey]
	if len(current)+len(records) > s.maxBufferedRecords {
		return ErrBufferFull
	}

	nextSeq := s.nextSeq[sourceKey]
	for _, item := range records {
		nextSeq++
		normalized := cloneRecord(item)
		if strings.TrimSpace(normalized.RecordID) == "" {
			normalized.RecordID = fmt.Sprintf("%s-%d", sanitizeSourceKey(sourceKey), nextSeq)
		}
		if normalized.ObservedAt.IsZero() {
			normalized.ObservedAt = time.Now().UTC()
		}
		current = append(current, bufferedRecord{Seq: nextSeq, Record: normalized})
	}
	s.nextSeq[sourceKey] = nextSeq
	s.records[sourceKey] = current
	return nil
}

func (s *Service) Pull(req PullRequest) (PullResponse, error) {
	sourceKey := strings.TrimSpace(req.SourceKey)
	if sourceKey == "" {
		return PullResponse{}, ErrSourceKeyRequired
	}
	if req.MaxRecords <= 0 {
		req.MaxRecords = 200
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	startCursor, err := parseCursor(req.Cursor)
	if err != nil {
		return PullResponse{}, err
	}
	if req.Cursor == "" {
		startCursor = s.committed[sourceKey]
	}

	sourceRecords := s.records[sourceKey]
	selected := make([]bufferedRecord, 0, req.MaxRecords)
	for _, item := range sourceRecords {
		if item.Seq <= startCursor {
			continue
		}
		selected = append(selected, item)
		if len(selected) >= req.MaxRecords {
			break
		}
	}

	if len(selected) == 0 {
		return PullResponse{
			SourceKey: sourceKey,
			Cursor: PullCursor{
				Prev:    strconv.FormatInt(startCursor, 10),
				Next:    strconv.FormatInt(startCursor, 10),
				HasMore: false,
			},
			Records: []Record{},
		}, nil
	}

	nextCursor := selected[len(selected)-1].Seq
	hasMore := false
	for _, item := range sourceRecords {
		if item.Seq > nextCursor {
			hasMore = true
			break
		}
	}

	batchID := newBatchID()
	s.pending[batchID] = pendingBatch{
		SourceKey:  sourceKey,
		NextCursor: nextCursor,
		Records:    append([]bufferedRecord(nil), selected...),
	}

	responseRecords := make([]Record, 0, len(selected))
	for _, item := range selected {
		responseRecords = append(responseRecords, cloneRecord(item.Record))
	}

	return PullResponse{
		BatchID:   batchID,
		SourceKey: sourceKey,
		Cursor: PullCursor{
			Prev:    strconv.FormatInt(startCursor, 10),
			Next:    strconv.FormatInt(nextCursor, 10),
			HasMore: hasMore,
		},
		Records: responseRecords,
	}, nil
}

func (s *Service) Ack(req AckRequest) (AckResult, error) {
	batchID := strings.TrimSpace(req.BatchID)
	if batchID == "" {
		return AckResult{}, ErrBatchNotFound
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	batch, ok := s.pending[batchID]
	if !ok {
		return AckResult{}, ErrBatchNotFound
	}

	committedCursor := strconv.FormatInt(batch.NextCursor, 10)
	if raw := strings.TrimSpace(req.CommittedCursor); raw != "" {
		if raw != committedCursor {
			return AckResult{}, ErrCursorMismatch
		}
		committedCursor = raw
	}

	if req.Status == AckStatusNack {
		delete(s.pending, batchID)
		return AckResult{Accepted: true, SourceKey: batch.SourceKey, Cursor: committedCursor}, nil
	}

	latestOffsets := make(map[string]int64)
	for _, item := range batch.Records {
		if strings.TrimSpace(item.FilePath) == "" || item.Offset <= 0 {
			continue
		}
		if item.Offset > latestOffsets[item.FilePath] {
			latestOffsets[item.FilePath] = item.Offset
		}
	}

	checkpointUpdated := false
	for filePath, offset := range latestOffsets {
		if s.saver != nil {
			if err := s.saver.Save(batch.SourceKey, filePath, offset); err != nil {
				return AckResult{}, fmt.Errorf("save checkpoint failed for %s: %w", filePath, err)
			}
		}
		checkpointUpdated = true
	}

	s.committed[batch.SourceKey] = batch.NextCursor
	s.records[batch.SourceKey] = pruneCommitted(s.records[batch.SourceKey], batch.NextCursor)
	delete(s.pending, batchID)

	return AckResult{
		Accepted:          true,
		CheckpointUpdated: checkpointUpdated,
		SourceKey:         batch.SourceKey,
		Cursor:            committedCursor,
	}, nil
}

func pruneCommitted(records []bufferedRecord, committedCursor int64) []bufferedRecord {
	if len(records) == 0 {
		return nil
	}
	keep := records[:0]
	for _, item := range records {
		if item.Seq > committedCursor {
			keep = append(keep, item)
		}
	}
	return append([]bufferedRecord(nil), keep...)
}

func parseCursor(raw string) (int64, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	parsed, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || parsed < 0 {
		return 0, fmt.Errorf("cursor must be a non-negative integer")
	}
	return parsed, nil
}

func newBatchID() string {
	buf := make([]byte, 12)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("batch-%d", time.Now().UnixNano())
	}
	return "batch-" + hex.EncodeToString(buf)
}

func sanitizeSourceKey(sourceKey string) string {
	sourceKey = strings.TrimSpace(sourceKey)
	if sourceKey == "" {
		return "source"
	}
	sourceKey = strings.ReplaceAll(sourceKey, "/", "-")
	sourceKey = strings.ReplaceAll(sourceKey, " ", "-")
	return sourceKey
}

func cloneRecord(record Record) Record {
	cloned := record
	if len(record.Attributes) > 0 {
		cloned.Attributes = make(map[string]string, len(record.Attributes))
		for key, value := range record.Attributes {
			cloned.Attributes[key] = value
		}
	}
	return cloned
}
