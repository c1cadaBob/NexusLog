package ingestv3

import "testing"

type memoryCursorStore struct {
  items map[string]CursorEntry
}

func (m *memoryCursorStore) key(sourceID string, filePath string) string {
  return sourceID + "|" + filePath
}

func (m *memoryCursorStore) Get(sourceID string, filePath string) (CursorEntry, bool) {
  if m.items == nil {
    return CursorEntry{}, false
  }
  item, ok := m.items[m.key(sourceID, filePath)]
  return item, ok
}

func (m *memoryCursorStore) Put(entry CursorEntry) error {
  if m.items == nil {
    m.items = make(map[string]CursorEntry)
  }
  m.items[m.key(entry.SourceID, entry.FilePath)] = entry
  return nil
}

func TestBuildPullPlansUsesActualFilePathKeys(t *testing.T) {
  store := &memoryCursorStore{items: map[string]CursorEntry{
    "source-1|/var/log/a.log": {SourceID: "source-1", FilePath: "/var/log/a.log", LastCursor: "42", LastOffset: 100},
  }}

  plans := BuildPullPlans("source-1", []string{"/var/log/a.log", "/var/log/b.log"}, store)
  if len(plans) != 2 {
    t.Fatalf("expected 2 plans, got %d", len(plans))
  }
  if plans[0].FilePath != "/var/log/a.log" || plans[0].StartCursor != "42" {
    t.Fatalf("unexpected first plan: %+v", plans[0])
  }
  if plans[1].FilePath != "/var/log/b.log" || plans[1].StartCursor != "" {
    t.Fatalf("unexpected second plan: %+v", plans[1])
  }
}

func TestCommitPulledFilesPersistsByActualFilePath(t *testing.T) {
  store := &memoryCursorStore{}
  err := CommitPulledFiles("source-1", []PulledFile{
    {FilePath: "/var/log/a.log", NextCursor: "100", LastOffset: 300},
    {FilePath: "/var/log/b.log", NextCursor: "200", LastOffset: 900},
  }, store)
  if err != nil {
    t.Fatalf("commit failed: %v", err)
  }

  a, ok := store.Get("source-1", "/var/log/a.log")
  if !ok || a.LastCursor != "100" || a.LastOffset != 300 {
    t.Fatalf("unexpected cursor for a.log: %+v ok=%t", a, ok)
  }

  b, ok := store.Get("source-1", "/var/log/b.log")
  if !ok || b.LastCursor != "200" || b.LastOffset != 900 {
    t.Fatalf("unexpected cursor for b.log: %+v ok=%t", b, ok)
  }
}
