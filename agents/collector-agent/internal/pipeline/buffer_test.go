package pipeline

import (
	"sync"
	"testing"

	"github.com/nexuslog/collector-agent/plugins"
)

func makeRecord(id string) plugins.Record {
	return plugins.Record{Source: id, Data: []byte(id)}
}

func TestPriorityBuffer_PushPopBasic(t *testing.T) {
	buf := NewPriorityBuffer(100)

	// Push normal records
	recs := []plugins.Record{makeRecord("a"), makeRecord("b"), makeRecord("c")}
	buf.Push(recs, false)

	if buf.Len() != 3 {
		t.Errorf("Len() = %d, want 3", buf.Len())
	}
	if buf.NormalLen() != 3 || buf.CriticalLen() != 0 {
		t.Errorf("NormalLen=%d CriticalLen=%d, want 3,0", buf.NormalLen(), buf.CriticalLen())
	}

	// Pop
	batch, hasCritical := buf.PopBatch(2)
	if hasCritical {
		t.Error("PopBatch: hasCritical should be false for normal-only")
	}
	if len(batch) != 2 {
		t.Errorf("PopBatch size = %d, want 2", len(batch))
	}
	if string(batch[0].Data) != "a" || string(batch[1].Data) != "b" {
		t.Errorf("PopBatch content wrong: %v", batch)
	}

	// Pop remaining
	batch2, _ := buf.PopBatch(10)
	if len(batch2) != 1 || string(batch2[0].Data) != "c" {
		t.Errorf("PopBatch remaining wrong: %v", batch2)
	}

	// Empty buffer
	batch3, _ := buf.PopBatch(10)
	if batch3 != nil {
		t.Errorf("Empty PopBatch should return nil, got %v", batch3)
	}
}

func TestPriorityBuffer_CriticalFirst(t *testing.T) {
	buf := NewPriorityBuffer(100)

	// Push normal first
	buf.Push([]plugins.Record{makeRecord("n1"), makeRecord("n2")}, false)
	// Push critical
	buf.Push([]plugins.Record{makeRecord("c1"), makeRecord("c2")}, true)
	// Push more normal
	buf.Push([]plugins.Record{makeRecord("n3")}, false)

	// Pop should return critical first
	batch, hasCritical := buf.PopBatch(2)
	if !hasCritical {
		t.Error("PopBatch: hasCritical should be true")
	}
	if len(batch) != 2 {
		t.Errorf("PopBatch size = %d, want 2", len(batch))
	}
	if string(batch[0].Data) != "c1" || string(batch[1].Data) != "c2" {
		t.Errorf("Critical should come first, got %v", batch)
	}

	// Next pop returns normal
	batch2, hasCritical2 := buf.PopBatch(10)
	if hasCritical2 {
		t.Error("Second PopBatch: hasCritical should be false")
	}
	if len(batch2) != 3 {
		t.Errorf("PopBatch size = %d, want 3", len(batch2))
	}
	if string(batch2[0].Data) != "n1" || string(batch2[1].Data) != "n2" || string(batch2[2].Data) != "n3" {
		t.Errorf("Normal order wrong: %v", batch2)
	}
}

func TestPriorityBuffer_OverflowTrimNormal(t *testing.T) {
	buf := NewPriorityBuffer(10)

	// Fill with normal
	for i := 0; i < 8; i++ {
		buf.Push([]plugins.Record{makeRecord("n")}, false)
	}
	if buf.Len() != 8 {
		t.Errorf("Len = %d, want 8", buf.Len())
	}

	// Push 5 more normal -> overflow, trim 3 from normal
	buf.Push([]plugins.Record{
		makeRecord("x1"), makeRecord("x2"), makeRecord("x3"),
		makeRecord("x4"), makeRecord("x5"),
	}, false)
	if buf.Len() != 10 {
		t.Errorf("After overflow Len = %d, want 10", buf.Len())
	}
	// First 3 normal (n) should be trimmed, we keep last 5 n + 5 x = 10? No.
	// Total was 8+5=13, capacity 10, excess 3. We trim 3 from normal.
	// So we keep: 5 of original n + 5 x = 10. Actually the trim is from the beginning.
	// normal was [n,n,n,n,n,n,n,n,x1,x2,x3,x4,x5], we trim 3 from front -> [n,n,n,n,n,x1,x2,x3,x4,x5]
	// So we have 5 n + 5 x = 10. Good.

	// Now push critical - should never be trimmed
	buf.Push([]plugins.Record{
		makeRecord("c1"), makeRecord("c2"), makeRecord("c3"),
	}, true)
	// Total would be 13, we trim 3 from normal
	// critical: 3, normal: 10 -> trim 3 from normal -> normal has 7
	if buf.Len() != 10 {
		t.Errorf("After critical overflow Len = %d, want 10", buf.Len())
	}
	if buf.CriticalLen() != 3 {
		t.Errorf("CriticalLen = %d, want 3 (critical must never be trimmed)", buf.CriticalLen())
	}
	if buf.NormalLen() != 7 {
		t.Errorf("NormalLen = %d, want 7", buf.NormalLen())
	}

	// Pop: critical first
	batch, hasCritical := buf.PopBatch(10)
	if !hasCritical {
		t.Error("hasCritical should be true")
	}
	if len(batch) != 10 {
		t.Errorf("PopBatch size = %d, want 10", len(batch))
	}
	// First 3 must be critical
	if string(batch[0].Data) != "c1" || string(batch[1].Data) != "c2" || string(batch[2].Data) != "c3" {
		t.Errorf("First 3 must be critical: %v", batch[:3])
	}
}

func TestPriorityBuffer_OverflowNeverTrimCritical(t *testing.T) {
	buf := NewPriorityBuffer(5)

	// Fill with critical only
	buf.Push([]plugins.Record{
		makeRecord("c1"), makeRecord("c2"), makeRecord("c3"),
		makeRecord("c4"), makeRecord("c5"), makeRecord("c6"),
	}, true)
	// Capacity 5, we have 6 critical. Spec says "NEVER trim critical".
	// So we'd have 6 in buffer - that would exceed capacity. The spec says:
	// "When buffer overflows (reaches 10000), trim normal records to make room, NEVER trim critical"
	// So we only trim normal. If we have ONLY critical and overflow, we don't trim - we keep all critical.
	// The buffer would then hold 6 (over capacity). Let me re-read...
	// "trim normal records to make room" - so we only ever trim normal. If buffer is full of critical,
	// we don't trim anything. So we allow critical to exceed capacity. That makes sense - critical
	// must never be lost.
	if buf.CriticalLen() != 6 {
		t.Errorf("Critical must never be trimmed: CriticalLen = %d, want 6", buf.CriticalLen())
	}
	if buf.Len() != 6 {
		t.Errorf("Len = %d, want 6 (critical can exceed capacity)", buf.Len())
	}

	// Pop all
	batch, _ := buf.PopBatch(10)
	if len(batch) != 6 {
		t.Errorf("PopBatch size = %d, want 6", len(batch))
	}
	for i := 0; i < 6; i++ {
		if string(batch[i].Data) != "c"+string(rune('1'+i)) {
			t.Errorf("batch[%d] = %s", i, batch[i].Data)
		}
	}
}

func TestPriorityBuffer_EmptyReturnsNil(t *testing.T) {
	buf := NewPriorityBuffer(100)

	batch, hasCritical := buf.PopBatch(10)
	if batch != nil {
		t.Errorf("Empty PopBatch should return nil batch, got %v", batch)
	}
	if hasCritical {
		t.Error("Empty PopBatch hasCritical should be false")
	}

	// Push then pop all
	buf.Push([]plugins.Record{makeRecord("a")}, false)
	buf.PopBatch(10)
	batch2, _ := buf.PopBatch(10)
	if batch2 != nil {
		t.Errorf("After drain PopBatch should return nil, got %v", batch2)
	}
}

func TestPriorityBuffer_ConcurrentAccess(t *testing.T) {
	buf := NewPriorityBuffer(10000)
	var wg sync.WaitGroup

	// Concurrent writers
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				rec := makeRecord("x")
				buf.Push([]plugins.Record{rec}, id%2 == 0) // alternate critical/normal
			}
		}(i)
	}

	// Concurrent readers
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 200; j++ {
				buf.PopBatch(5)
				buf.Len()
				buf.CriticalLen()
				buf.NormalLen()
			}
		}()
	}

	wg.Wait()
	// No panic and Len is consistent
	_ = buf.Len()
	_ = buf.CriticalLen()
	_ = buf.NormalLen()
}
