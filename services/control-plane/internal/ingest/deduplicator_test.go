package ingest

import (
	"sync"
	"testing"
)

func TestDeduplicator_NonDuplicateReturnsFalse(t *testing.T) {
	d := NewDeduplicator(5)

	if got := d.IsDuplicate("event-1"); got {
		t.Errorf("IsDuplicate(\"event-1\") = %v, want false", got)
	}
	if got := d.IsDuplicate("event-2"); got {
		t.Errorf("IsDuplicate(\"event-2\") = %v, want false", got)
	}
}

func TestDeduplicator_SameEventIDInSameBatchReturnsTrue(t *testing.T) {
	d := NewDeduplicator(5)

	if got := d.IsDuplicate("event-1"); got {
		t.Errorf("first IsDuplicate(\"event-1\") = %v, want false", got)
	}
	if got := d.IsDuplicate("event-1"); !got {
		t.Errorf("second IsDuplicate(\"event-1\") = %v, want true", got)
	}
}

func TestDeduplicator_SameEventIDAcrossBatchesWithinWindowReturnsTrue(t *testing.T) {
	d := NewDeduplicator(5)

	_ = d.IsDuplicate("event-1")
	d.AdvanceBatch()
	_ = d.IsDuplicate("event-2")
	d.AdvanceBatch()

	if got := d.IsDuplicate("event-1"); !got {
		t.Errorf("IsDuplicate(\"event-1\") across batches = %v, want true", got)
	}
}

func TestDeduplicator_EventIDOutsideWindowReturnsFalse(t *testing.T) {
	d := NewDeduplicator(3)

	_ = d.IsDuplicate("event-1")
	d.AdvanceBatch()
	_ = d.IsDuplicate("event-2")
	d.AdvanceBatch()
	_ = d.IsDuplicate("event-3")
	d.AdvanceBatch()
	// event-1 is now outside the window (slot was cleared)
	if got := d.IsDuplicate("event-1"); got {
		t.Errorf("IsDuplicate(\"event-1\") outside window = %v, want false", got)
	}
}

func TestDeduplicator_StatsDuplicateRatio(t *testing.T) {
	d := NewDeduplicator(5)

	_ = d.IsDuplicate("a")
	_ = d.IsDuplicate("b")
	_ = d.IsDuplicate("a") // duplicate
	_ = d.IsDuplicate("a") // duplicate

	st := d.Stats()
	if st.TotalSeen != 4 {
		t.Errorf("TotalSeen = %d, want 4", st.TotalSeen)
	}
	if st.TotalDuplicate != 2 {
		t.Errorf("TotalDuplicate = %d, want 2", st.TotalDuplicate)
	}
	wantRatio := 0.5
	if st.DuplicateRatio != wantRatio {
		t.Errorf("DuplicateRatio = %v, want %v", st.DuplicateRatio, wantRatio)
	}
	if st.WindowBatches != 5 {
		t.Errorf("WindowBatches = %d, want 5", st.WindowBatches)
	}
}

func TestDeduplicator_StatsZeroSeen(t *testing.T) {
	d := NewDeduplicator(5)
	st := d.Stats()
	if st.DuplicateRatio != 0.0 {
		t.Errorf("DuplicateRatio with zero seen = %v, want 0", st.DuplicateRatio)
	}
}

func TestDeduplicator_ConcurrentAccess(t *testing.T) {
	d := NewDeduplicator(5)
	var wg sync.WaitGroup

	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			eventID := string(rune('a' + id%26))
			_ = d.IsDuplicate(eventID)
		}(i)
	}

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			d.AdvanceBatch()
		}()
	}

	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_ = d.Stats()
		}()
	}

	wg.Wait()
	st := d.Stats()
	if st.TotalSeen < 0 {
		t.Errorf("TotalSeen negative after concurrent access: %d", st.TotalSeen)
	}
}

func TestDeduplicator_DefaultWindowSize(t *testing.T) {
	d := NewDeduplicator(0)
	st := d.Stats()
	if st.WindowBatches != 5 {
		t.Errorf("WindowBatches with 0 = %d, want 5", st.WindowBatches)
	}
}
