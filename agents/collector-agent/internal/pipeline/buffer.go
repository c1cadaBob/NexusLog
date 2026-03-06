// Package pipeline 实现日志处理管道
package pipeline

import (
	"sync"

	"github.com/nexuslog/collector-agent/plugins"
)

// PriorityBuffer 双通道优先级缓冲区
// critical 通道（FATAL/ERROR）优先于 normal 通道
// 溢出时仅裁剪 normal 记录，永不裁剪 critical
type PriorityBuffer struct {
	mu       sync.Mutex
	capacity int
	critical []plugins.Record
	normal   []plugins.Record
}

// NewPriorityBuffer 创建指定容量的优先级缓冲区
func NewPriorityBuffer(capacity int) *PriorityBuffer {
	return &PriorityBuffer{
		capacity: capacity,
		critical: make([]plugins.Record, 0),
		normal:   make([]plugins.Record, 0),
	}
}

// Push 将记录推入缓冲区
// isCritical 为 true 时放入 critical 通道，否则放入 normal 通道
// 溢出时裁剪 normal 记录以腾出空间，永不裁剪 critical
func (b *PriorityBuffer) Push(records []plugins.Record, isCritical bool) {
	if len(records) == 0 {
		return
	}
	b.mu.Lock()
	defer b.mu.Unlock()

	if isCritical {
		b.critical = append(b.critical, records...)
	} else {
		b.normal = append(b.normal, records...)
	}
	b.trimIfOverflow()
}

// trimIfOverflow 在持有锁的情况下检查并裁剪溢出
// 仅裁剪 normal 通道，保证 critical 永不丢失
func (b *PriorityBuffer) trimIfOverflow() {
	total := len(b.critical) + len(b.normal)
	if total <= b.capacity {
		return
	}
	// 超出部分从 normal 头部裁剪（FIFO 丢弃）
	excess := total - b.capacity
	if excess >= len(b.normal) {
		b.normal = b.normal[:0]
	} else {
		b.normal = b.normal[excess:]
	}
}

// PopBatch 弹出最多 maxSize 条记录
// 优先返回 critical，其次 normal；返回 (batch, hasCritical)
func (b *PriorityBuffer) PopBatch(maxSize int) ([]plugins.Record, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.critical) == 0 && len(b.normal) == 0 {
		return nil, false
	}

	var batch []plugins.Record
	hasCritical := false

	// 先取 critical
	if len(b.critical) > 0 {
		hasCritical = true
		take := maxSize
		if take > len(b.critical) {
			take = len(b.critical)
		}
		batch = append(batch, b.critical[:take]...)
		b.critical = b.critical[take:]
	}

	// 若还有剩余空间，再取 normal
	remaining := maxSize - len(batch)
	if remaining > 0 && len(b.normal) > 0 {
		take := remaining
		if take > len(b.normal) {
			take = len(b.normal)
		}
		batch = append(batch, b.normal[:take]...)
		b.normal = b.normal[take:]
	}

	return batch, hasCritical
}

// Len 返回缓冲区总记录数
func (b *PriorityBuffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.critical) + len(b.normal)
}

// CriticalLen 返回 critical 通道记录数
func (b *PriorityBuffer) CriticalLen() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.critical)
}

// NormalLen 返回 normal 通道记录数
func (b *PriorityBuffer) NormalLen() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.normal)
}
