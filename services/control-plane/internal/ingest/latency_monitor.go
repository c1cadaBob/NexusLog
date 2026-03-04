package ingest

import (
	"math"
	"sort"
	"sync"
	"time"
)

const (
	defaultLatencyWindowSize    = 200
	defaultLatencyAlertP95MS    = 3000
	defaultLatencyAlertP99MS    = 5000
	defaultLatencyAlertCooldown = 60 * time.Second
	defaultLatencyMinSamples    = 5
)

// PullLatencySnapshot 描述当前窗口内拉取链路延迟统计。
type PullLatencySnapshot struct {
	Count        int       `json:"count"`
	LastMS       int64     `json:"last_ms"`
	P50MS        int64     `json:"p50_ms"`
	P95MS        int64     `json:"p95_ms"`
	P99MS        int64     `json:"p99_ms"`
	MaxMS        int64     `json:"max_ms"`
	UpdatedAt    time.Time `json:"updated_at"`
	LastTaskID   string    `json:"last_task_id,omitempty"`
	LastSourceID string    `json:"last_source_id,omitempty"`
	LastStatus   string    `json:"last_status,omitempty"`
}

// PullLatencyMonitor 维护窗口内拉取延迟并触发阈值告警。
type PullLatencyMonitor struct {
	mu                 sync.RWMutex
	windowSize         int
	alertP95MS         int64
	alertP99MS         int64
	alertCooldown      time.Duration
	lastAlertAt        time.Time
	samplesMS          []int64
	lastSnapshot       PullLatencySnapshot
	minSamplesForAlert int
}

// NewPullLatencyMonitor 创建拉取延迟监控器。
func NewPullLatencyMonitor(windowSize int, alertP95MS int64, alertP99MS int64, alertCooldown time.Duration) *PullLatencyMonitor {
	if windowSize <= 0 {
		windowSize = defaultLatencyWindowSize
	}
	if alertP95MS <= 0 {
		alertP95MS = defaultLatencyAlertP95MS
	}
	if alertP99MS <= 0 {
		alertP99MS = defaultLatencyAlertP99MS
	}
	if alertCooldown <= 0 {
		alertCooldown = defaultLatencyAlertCooldown
	}
	return &PullLatencyMonitor{
		windowSize:         windowSize,
		alertP95MS:         alertP95MS,
		alertP99MS:         alertP99MS,
		alertCooldown:      alertCooldown,
		samplesMS:          make([]int64, 0, windowSize),
		minSamplesForAlert: defaultLatencyMinSamples,
	}
}

// Observe 记录一条任务端到端延迟并返回最新快照与是否触发阈值告警。
func (m *PullLatencyMonitor) Observe(sourceID, taskID, status string, scheduledAt, finishedAt time.Time) (PullLatencySnapshot, bool) {
	if m == nil {
		return PullLatencySnapshot{}, false
	}
	if scheduledAt.IsZero() {
		return PullLatencySnapshot{}, false
	}
	if finishedAt.IsZero() {
		finishedAt = time.Now().UTC()
	}
	latency := finishedAt.Sub(scheduledAt).Milliseconds()
	if latency < 0 {
		latency = 0
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	m.samplesMS = append(m.samplesMS, latency)
	if len(m.samplesMS) > m.windowSize {
		m.samplesMS = append([]int64(nil), m.samplesMS[len(m.samplesMS)-m.windowSize:]...)
	}

	snapshot := m.buildSnapshotLocked(latency, sourceID, taskID, status, finishedAt)
	m.lastSnapshot = snapshot

	shouldAlert := false
	thresholdHit := len(m.samplesMS) >= m.minSamplesForAlert &&
		(snapshot.P95MS >= m.alertP95MS || snapshot.P99MS >= m.alertP99MS)
	if thresholdHit && (m.lastAlertAt.IsZero() || finishedAt.Sub(m.lastAlertAt) >= m.alertCooldown) {
		shouldAlert = true
		m.lastAlertAt = finishedAt
	}
	return snapshot, shouldAlert
}

// Snapshot 返回最近一次延迟窗口统计。
func (m *PullLatencyMonitor) Snapshot() PullLatencySnapshot {
	if m == nil {
		return PullLatencySnapshot{}
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.lastSnapshot
}

func (m *PullLatencyMonitor) buildSnapshotLocked(lastMS int64, sourceID, taskID, status string, now time.Time) PullLatencySnapshot {
	if len(m.samplesMS) == 0 {
		return PullLatencySnapshot{
			LastMS:       lastMS,
			UpdatedAt:    now,
			LastTaskID:   taskID,
			LastSourceID: sourceID,
			LastStatus:   status,
		}
	}
	sorted := append([]int64(nil), m.samplesMS...)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i] < sorted[j]
	})

	return PullLatencySnapshot{
		Count:        len(sorted),
		LastMS:       lastMS,
		P50MS:        percentile(sorted, 0.50),
		P95MS:        percentile(sorted, 0.95),
		P99MS:        percentile(sorted, 0.99),
		MaxMS:        sorted[len(sorted)-1],
		UpdatedAt:    now,
		LastTaskID:   taskID,
		LastSourceID: sourceID,
		LastStatus:   status,
	}
}

func percentile(sorted []int64, ratio float64) int64 {
	if len(sorted) == 0 {
		return 0
	}
	if ratio <= 0 {
		return sorted[0]
	}
	if ratio >= 1 {
		return sorted[len(sorted)-1]
	}
	index := int(math.Ceil(float64(len(sorted))*ratio)) - 1
	if index < 0 {
		index = 0
	}
	if index >= len(sorted) {
		index = len(sorted) - 1
	}
	return sorted[index]
}
