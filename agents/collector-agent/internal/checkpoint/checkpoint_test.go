package checkpoint

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestNewFileStore(t *testing.T) {
	dir := t.TempDir()
	fs, err := NewFileStore(dir, WithFlushInterval(100*time.Millisecond))
	if err != nil {
		t.Fatalf("NewFileStore: %v", err)
	}
	defer fs.Close()

	if fs.dir != dir {
		t.Errorf("dir = %q, want %q", fs.dir, dir)
	}
}

func TestSaveAndLoad(t *testing.T) {
	dir := t.TempDir()
	fs, err := NewFileStore(dir, WithFlushInterval(100*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}

	if err := fs.Save("/var/log/app.log", 1024); err != nil {
		t.Fatalf("Save: %v", err)
	}

	pos, err := fs.Load("/var/log/app.log")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if pos.Offset != 1024 {
		t.Errorf("Offset = %d, want 1024", pos.Offset)
	}
	if pos.Source != "/var/log/app.log" {
		t.Errorf("Source = %q, want /var/log/app.log", pos.Source)
	}
	fs.Close()
}

func TestLoadNonExistent(t *testing.T) {
	dir := t.TempDir()
	fs, err := NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer fs.Close()

	pos, err := fs.Load("/nonexistent/path.log")
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if pos.Offset != 0 {
		t.Errorf("Offset = %d, want 0", pos.Offset)
	}
}

func TestLoadAll(t *testing.T) {
	dir := t.TempDir()
	fs, err := NewFileStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer fs.Close()

	_ = fs.Save("/var/log/a.log", 100)
	_ = fs.Save("/var/log/b.log", 200)

	all, err := fs.LoadAll()
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != 2 {
		t.Errorf("LoadAll count = %d, want 2", len(all))
	}
}

func TestAtomicWriteAndRecover(t *testing.T) {
	dir := t.TempDir()
	fs1, err := NewFileStore(dir, WithFlushInterval(100*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}

	_ = fs1.Save("/var/log/app.log", 5000)
	_ = fs1.Flush()
	fs1.Close()

	fs2, err := NewFileStore(dir, WithFlushInterval(100*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	defer fs2.Close()

	pos, _ := fs2.Load("/var/log/app.log")
	if pos.Offset != 5000 {
		t.Errorf("Offset after recovery = %d, want 5000", pos.Offset)
	}
}

func TestCorruptCheckpointFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "checkpoints.json")
	if err := os.WriteFile(path, []byte("{{corrupted json"), 0644); err != nil {
		t.Fatal(err)
	}

	fs, err := NewFileStore(dir)
	if err != nil {
		t.Fatalf("NewFileStore with corrupt file should not fail: %v", err)
	}
	defer fs.Close()

	pos, _ := fs.Load("/any/path.log")
	if pos.Offset != 0 {
		t.Errorf("corrupt file should yield offset=0, got %d", pos.Offset)
	}

	corruptFiles, _ := filepath.Glob(filepath.Join(dir, "checkpoints.json.corrupt.*"))
	if len(corruptFiles) == 0 {
		t.Error("corrupt file should be backed up")
	}
}

func TestInodeTrackingWithRealFile(t *testing.T) {
	dir := t.TempDir()
	ckpDir := filepath.Join(dir, "ckp")
	logFile := filepath.Join(dir, "test.log")

	if err := os.WriteFile(logFile, []byte("line1\nline2\n"), 0644); err != nil {
		t.Fatal(err)
	}

	fs, err := NewFileStore(ckpDir, WithFlushInterval(100*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	defer fs.Close()

	if err := fs.Save(logFile, 12); err != nil {
		t.Fatal(err)
	}

	pos, _ := fs.Load(logFile)
	if pos.Inode == 0 {
		t.Error("inode should be captured")
	}
	if pos.Offset != 12 {
		t.Errorf("offset = %d, want 12", pos.Offset)
	}

	// Simulate log rotation: rename old → .bak (keeps old inode alive),
	// then create a new file (guarantees a different inode).
	rotatedFile := logFile + ".bak"
	if err := os.Rename(logFile, rotatedFile); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(logFile, []byte("new content\n"), 0644); err != nil {
		t.Fatal(err)
	}

	pos2, _ := fs.Load(logFile)
	if pos2.Offset != 0 {
		// Verify inodes actually differ before asserting
		newInode, _ := statInodeDev(logFile)
		if newInode != pos.Inode {
			t.Errorf("after rotation, offset should be 0, got %d (old inode=%d new inode=%d)", pos2.Offset, pos.Inode, newInode)
		} else {
			t.Logf("skip: OS reused inode (old=%d new=%d)", pos.Inode, newInode)
		}
	}
}

func TestSaveDetectsRotation(t *testing.T) {
	dir := t.TempDir()
	ckpDir := filepath.Join(dir, "ckp")
	logFile := filepath.Join(dir, "rotate.log")

	if err := os.WriteFile(logFile, []byte("original\n"), 0644); err != nil {
		t.Fatal(err)
	}

	fs, err := NewFileStore(ckpDir, WithFlushInterval(100*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}
	defer fs.Close()

	_ = fs.Save(logFile, 100)
	oldPos, _ := fs.Load(logFile)

	if err := os.Rename(logFile, logFile+".1"); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(logFile, []byte("rotated content\n"), 0644); err != nil {
		t.Fatal(err)
	}

	_ = fs.Save(logFile, 999)
	newPos, _ := fs.Load(logFile)

	newInode, _ := statInodeDev(logFile)
	if newInode != oldPos.Inode && newPos.Offset == 999 {
		t.Errorf("Save with changed inode should reset offset to 0, got %d", newPos.Offset)
	}
}

func TestPeriodicFlush(t *testing.T) {
	dir := t.TempDir()
	fs, err := NewFileStore(dir, WithFlushInterval(200*time.Millisecond))
	if err != nil {
		t.Fatal(err)
	}

	_ = fs.Save("/var/log/periodic.log", 999)

	time.Sleep(500 * time.Millisecond)
	fs.Close()

	data, err := os.ReadFile(filepath.Join(dir, "checkpoints.json"))
	if err != nil {
		t.Fatalf("checkpoint file should exist: %v", err)
	}
	var positions map[string]Position
	if err := json.Unmarshal(data, &positions); err != nil {
		t.Fatal(err)
	}
	pos, ok := positions["/var/log/periodic.log"]
	if !ok {
		t.Fatal("position not found in flushed data")
	}
	if pos.Offset != 999 {
		t.Errorf("flushed offset = %d, want 999", pos.Offset)
	}
}

func TestEmptyCheckpointFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "checkpoints.json")
	if err := os.WriteFile(path, []byte{}, 0644); err != nil {
		t.Fatal(err)
	}

	fs, err := NewFileStore(dir)
	if err != nil {
		t.Fatalf("empty file should not fail: %v", err)
	}
	fs.Close()
}
