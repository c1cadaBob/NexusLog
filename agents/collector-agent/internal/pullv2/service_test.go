package pullv2

import (
  "errors"
  "testing"
)

type memoryCheckpointSaver struct {
  fail  bool
  saves map[string]int64
}

func (m *memoryCheckpointSaver) Save(sourceKey string, filePath string, offset int64) error {
  if m.fail {
    return errors.New("checkpoint unavailable")
  }
  if m.saves == nil {
    m.saves = make(map[string]int64)
  }
  m.saves[sourceKey+"|"+filePath] = offset
  return nil
}

func TestPullIsScopedPerSource(t *testing.T) {
  svc := New(10, &memoryCheckpointSaver{})
  if err := svc.Append("source-a", []Record{{FilePath: "/var/log/a.log", Body: "a1", Offset: 10}, {FilePath: "/var/log/a.log", Body: "a2", Offset: 20}}); err != nil {
    t.Fatalf("append source-a failed: %v", err)
  }
  if err := svc.Append("source-b", []Record{{FilePath: "/var/log/b.log", Body: "b1", Offset: 5}}); err != nil {
    t.Fatalf("append source-b failed: %v", err)
  }

  resp, err := svc.Pull(PullRequest{SourceKey: "source-a", MaxRecords: 10})
  if err != nil {
    t.Fatalf("pull failed: %v", err)
  }
  if len(resp.Records) != 2 {
    t.Fatalf("expected 2 records, got %d", len(resp.Records))
  }
  if resp.SourceKey != "source-a" {
    t.Fatalf("unexpected source key: %s", resp.SourceKey)
  }
  for _, item := range resp.Records {
    if item.FilePath != "/var/log/a.log" {
      t.Fatalf("unexpected file path in scoped pull: %+v", item)
    }
  }

  other, err := svc.Pull(PullRequest{SourceKey: "source-b", MaxRecords: 10})
  if err != nil {
    t.Fatalf("pull other failed: %v", err)
  }
  if len(other.Records) != 1 || other.Records[0].FilePath != "/var/log/b.log" {
    t.Fatalf("unexpected records for source-b: %+v", other.Records)
  }
}

func TestAckRejectsCursorLeapAndKeepsBatchReplayable(t *testing.T) {
  saver := &memoryCheckpointSaver{}
  svc := New(10, saver)
  if err := svc.Append("source-a", []Record{{FilePath: "/var/log/a.log", Body: "a1", Offset: 10}}); err != nil {
    t.Fatalf("append failed: %v", err)
  }

  pullResp, err := svc.Pull(PullRequest{SourceKey: "source-a", MaxRecords: 10})
  if err != nil {
    t.Fatalf("pull failed: %v", err)
  }

  if _, err := svc.Ack(AckRequest{BatchID: pullResp.BatchID, Status: AckStatusAck, CommittedCursor: "999"}); !errors.Is(err, ErrCursorMismatch) {
    t.Fatalf("expected ErrCursorMismatch, got %v", err)
  }

  replayResp, err := svc.Pull(PullRequest{SourceKey: "source-a", MaxRecords: 10})
  if err != nil {
    t.Fatalf("replay pull failed: %v", err)
  }
  if len(replayResp.Records) != 1 {
    t.Fatalf("expected record to remain replayable, got %d", len(replayResp.Records))
  }

  ackResult, err := svc.Ack(AckRequest{BatchID: replayResp.BatchID, Status: AckStatusAck, CommittedCursor: replayResp.Cursor.Next})
  if err != nil {
    t.Fatalf("ack failed: %v", err)
  }
  if !ackResult.Accepted || !ackResult.CheckpointUpdated {
    t.Fatalf("unexpected ack result: %+v", ackResult)
  }
}

func TestAppendRejectsOverflowInsteadOfDropping(t *testing.T) {
  svc := New(2, &memoryCheckpointSaver{})
  if err := svc.Append("source-a", []Record{{Body: "1"}, {Body: "2"}}); err != nil {
    t.Fatalf("append failed: %v", err)
  }
  if err := svc.Append("source-a", []Record{{Body: "3"}}); !errors.Is(err, ErrBufferFull) {
    t.Fatalf("expected ErrBufferFull, got %v", err)
  }
}

func TestAckFailsWhenCheckpointSaveFails(t *testing.T) {
  saver := &memoryCheckpointSaver{fail: true}
  svc := New(10, saver)
  if err := svc.Append("source-a", []Record{{FilePath: "/var/log/a.log", Body: "a1", Offset: 10}}); err != nil {
    t.Fatalf("append failed: %v", err)
  }

  resp, err := svc.Pull(PullRequest{SourceKey: "source-a", MaxRecords: 10})
  if err != nil {
    t.Fatalf("pull failed: %v", err)
  }

  if _, err := svc.Ack(AckRequest{BatchID: resp.BatchID, Status: AckStatusAck, CommittedCursor: resp.Cursor.Next}); err == nil {
    t.Fatalf("expected checkpoint failure")
  }

  replay, err := svc.Pull(PullRequest{SourceKey: "source-a", MaxRecords: 10})
  if err != nil {
    t.Fatalf("replay pull failed: %v", err)
  }
  if len(replay.Records) != 1 {
    t.Fatalf("expected buffered record to remain after failed ack, got %d", len(replay.Records))
  }
}
