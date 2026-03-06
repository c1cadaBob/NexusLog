// Package metrics provides system resource metrics collection for the collector agent.
package metrics

import (
	"bufio"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// SystemMetrics holds collected system resource metrics.
type SystemMetrics struct {
	CPUUsagePct      float64   `json:"cpu_usage_pct"`
	MemoryUsagePct   float64   `json:"memory_usage_pct"`
	DiskUsagePct     float64   `json:"disk_usage_pct"`
	DiskIOReadBytes  int64     `json:"disk_io_read_bytes"`
	DiskIOWriteBytes int64     `json:"disk_io_write_bytes"`
	NetInBytes       int64     `json:"net_in_bytes"`
	NetOutBytes      int64     `json:"net_out_bytes"`
	CollectedAt      time.Time `json:"collected_at"`
}

// Collector collects system metrics at a fixed interval and keeps the latest in memory.
type Collector struct {
	interval time.Duration
	stopCh   chan struct{}
	stoppedCh chan struct{}
	mu       sync.RWMutex
	latest   *SystemMetrics
	prevCPU  *cpuStats
}

// NewCollector creates a new system metrics collector.
func NewCollector(interval time.Duration) *Collector {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	return &Collector{
		interval:   interval,
		stopCh:     make(chan struct{}),
		stoppedCh:  make(chan struct{}),
		prevCPU:    &cpuStats{},
	}
}

type cpuStats struct {
	total uint64
	idle  uint64
}

// Start begins collecting metrics in the background.
func (c *Collector) Start() {
	go c.run()
}

// Stop stops the collector.
func (c *Collector) Stop() {
	close(c.stopCh)
	<-c.stoppedCh
}

// Latest returns the most recently collected metrics, or nil if none yet.
func (c *Collector) Latest() *SystemMetrics {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.latest == nil {
		return nil
	}
	// Return a copy to avoid races
	m := *c.latest
	return &m
}

func (c *Collector) run() {
	defer close(c.stoppedCh)
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	// Collect immediately on start
	c.collect()

	for {
		select {
		case <-c.stopCh:
			return
		case <-ticker.C:
			c.collect()
		}
	}
}

func (c *Collector) collect() {
	m := &SystemMetrics{CollectedAt: time.Now().UTC()}

	// CPU from /proc/stat
	if cpuPct, err := c.readCPUUsage(); err == nil {
		m.CPUUsagePct = cpuPct
	}

	// Memory from /proc/meminfo
	if memPct, err := c.readMemoryUsage(); err == nil {
		m.MemoryUsagePct = memPct
	}

	// Disk from syscall.Statfs (root filesystem)
	if diskPct, err := c.readDiskUsage(); err == nil {
		m.DiskUsagePct = diskPct
	}

	// Disk I/O from /proc/diskstats (simplified: sum of major block devices)
	if readB, writeB, err := c.readDiskIO(); err == nil {
		m.DiskIOReadBytes = int64(readB)
		m.DiskIOWriteBytes = int64(writeB)
	}

	// Network from /proc/net/dev
	if rxB, txB, err := c.readNetIO(); err == nil {
		m.NetInBytes = int64(rxB)
		m.NetOutBytes = int64(txB)
	}

	c.mu.Lock()
	c.latest = m
	c.mu.Unlock()
}

func (c *Collector) readCPUUsage() (float64, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return 0, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	if !scanner.Scan() {
		return 0, fmt.Errorf("no cpu line")
	}
	line := scanner.Text()
	if !strings.HasPrefix(line, "cpu ") {
		return 0, fmt.Errorf("invalid cpu line")
	}
	fields := strings.Fields(line)[1:]
	if len(fields) < 4 {
		return 0, fmt.Errorf("insufficient cpu fields")
	}
	var total, idle uint64
	for i, f := range fields {
		v, _ := strconv.ParseUint(f, 10, 64)
		total += v
		if i == 3 {
			idle = v
		}
	}

	c.mu.Lock()
	prev := c.prevCPU
	c.mu.Unlock()

	dtotal := total - prev.total
	didle := idle - prev.idle

	c.mu.Lock()
	c.prevCPU = &cpuStats{total: total, idle: idle}
	c.mu.Unlock()

	if dtotal == 0 {
		return 0, nil
	}
	usage := 100.0 * (1.0 - float64(didle)/float64(dtotal))
	if usage < 0 {
		usage = 0
	}
	if usage > 100 {
		usage = 100
	}
	return usage, nil
}

func (c *Collector) readMemoryUsage() (float64, error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, err
	}
	defer f.Close()

	var memTotal, memAvailable uint64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "MemTotal:") {
			fmt.Sscanf(line, "MemTotal: %d kB", &memTotal)
		} else if strings.HasPrefix(line, "MemAvailable:") {
			fmt.Sscanf(line, "MemAvailable: %d kB", &memAvailable)
		}
	}
	if memTotal == 0 {
		return 0, fmt.Errorf("memtotal is zero")
	}
	used := memTotal - memAvailable
	return 100.0 * float64(used) / float64(memTotal), nil
}

func (c *Collector) readDiskUsage() (float64, error) {
	var stat syscall.Statfs_t
	if err := syscall.Statfs("/", &stat); err != nil {
		return 0, err
	}
	total := stat.Blocks * uint64(stat.Bsize)
	free := stat.Bavail * uint64(stat.Bsize)
	if total == 0 {
		return 0, nil
	}
	used := total - free
	return 100.0 * float64(used) / float64(total), nil
}

func (c *Collector) readDiskIO() (readBytes, writeBytes uint64, err error) {
	f, err := os.Open("/proc/diskstats")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	var totalRead, totalWrite uint64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 14 {
			continue
		}
		// Skip partition devices (e.g. sda1) - only sum whole disks (sda, nvme0n1)
		name := fields[2]
		if len(name) > 0 && name[len(name)-1] >= '0' && name[len(name)-1] <= '9' {
			// Likely a partition
			continue
		}
		// fields[5]=sectors read, fields[9]=sectors written (512 bytes per sector)
		readSectors, _ := strconv.ParseUint(fields[5], 10, 64)
		writeSectors, _ := strconv.ParseUint(fields[9], 10, 64)
		totalRead += readSectors * 512
		totalWrite += writeSectors * 512
	}
	return totalRead, totalWrite, nil
}

// MetricsHandler returns an http.Handler that serves the latest system metrics as JSON.
func MetricsHandler(c *Collector) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		m := c.Latest()
		if m == nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(m)
	})
}

func (c *Collector) readNetIO() (rxBytes, txBytes uint64, err error) {
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	defer f.Close()

	var totalRx, totalTx uint64
	scanner := bufio.NewScanner(f)
	// Skip header lines
	scanner.Scan()
	scanner.Scan()
	for scanner.Scan() {
		line := scanner.Text()
		idx := strings.Index(line, ":")
		if idx < 0 {
			continue
		}
		dev := strings.TrimSpace(line[:idx])
		if dev == "lo" {
			continue
		}
		rest := strings.Fields(line[idx+1:])
		if len(rest) < 16 {
			continue
		}
		rx, _ := strconv.ParseUint(rest[0], 10, 64)
		tx, _ := strconv.ParseUint(rest[8], 10, 64)
		totalRx += rx
		totalTx += tx
	}
	return totalRx, totalTx, nil
}
