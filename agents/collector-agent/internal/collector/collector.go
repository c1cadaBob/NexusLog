// Package collector 实现日志采集器核心逻辑
// 负责从配置的数据源读取日志，支持文件和 syslog 两种采集方式
package collector

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/nexuslog/collector-agent/internal/checkpoint"
	"github.com/nexuslog/collector-agent/plugins"
)

// SourceType 采集源类型
type SourceType string

const (
	SourceTypeFile   SourceType = "file"
	SourceTypeSyslog SourceType = "syslog"
)

// SourcePriority 定义采集源优先级。
type SourcePriority string

const (
	SourcePriorityNormal   SourcePriority = "normal"
	SourcePriorityCritical SourcePriority = "critical"
)

// SourceConfig 采集源配置
type SourceConfig struct {
	Type             SourceType
	Paths            []string          // 文件采集包含路径（file 类型）
	ExcludePaths     []string          // 文件采集排除路径（file 类型）
	PathLabelRules   []PathLabelRule   // 按路径命中后注入 metadata 标签（file 类型）
	ScanInterval     time.Duration     // 独立扫描间隔（file 类型）
	Priority         SourcePriority    // 优先级（normal/critical）
	CriticalKeywords []string          // 关键日志关键词（覆盖默认关键字，file 类型）
	DisableFSNotify  bool              // 禁用 fsnotify 事件触发（file 类型）
	Protocol         string            // 协议（syslog 类型: udp/tcp）
	Bind             string            // 监听地址（syslog 类型）
	Extra            map[string]string // 额外配置
}

// PathLabelRule 定义“路径 -> 标签”匹配规则。
type PathLabelRule struct {
	Pattern string            // 支持 glob，如 /var/log/nginx/*.log
	Labels  map[string]string // 命中后附加到 record.Metadata
}

// Collector 日志采集器
type Collector struct {
	mu               sync.RWMutex
	sources          []SourceConfig
	ckpStore         checkpoint.Store
	outputCh         chan []plugins.Record
	batchSize        int
	flushInterval    time.Duration
	perFileReadLimit int
	enableFSNotify   bool
	eventDebounce    time.Duration
	criticalKeywords []string
	running          bool
}

// Config 采集器配置
type Config struct {
	Sources          []SourceConfig
	BatchSize        int
	FlushInterval    time.Duration
	BufferSize       int
	PerFileReadLimit int
	EnableFSNotify   *bool
	EventDebounce    time.Duration
	CriticalKeywords []string
}

const (
	defaultPerFileReadLimit = 200
	defaultEventDebounce    = 200 * time.Millisecond
)

// New 创建采集器实例
func New(cfg Config, ckpStore checkpoint.Store) *Collector {
	if cfg.BatchSize <= 0 {
		cfg.BatchSize = 1000
	}
	if cfg.FlushInterval <= 0 {
		cfg.FlushInterval = 5 * time.Second
	}
	if cfg.BufferSize <= 0 {
		cfg.BufferSize = 10000
	}
	if cfg.PerFileReadLimit <= 0 {
		cfg.PerFileReadLimit = defaultPerFileReadLimit
	}
	enableFSNotify := true
	if cfg.EnableFSNotify != nil {
		enableFSNotify = *cfg.EnableFSNotify
	}
	if cfg.EventDebounce <= 0 {
		cfg.EventDebounce = defaultEventDebounce
	}
	criticalKeywords := normalizeKeywords(cfg.CriticalKeywords)
	if len(criticalKeywords) == 0 {
		criticalKeywords = []string{
			"critical",
			"fatal",
			"panic",
			"error",
			"alert",
			"security",
		}
	}
	return &Collector{
		sources:          cfg.Sources,
		ckpStore:         ckpStore,
		outputCh:         make(chan []plugins.Record, cfg.BufferSize),
		batchSize:        cfg.BatchSize,
		flushInterval:    cfg.FlushInterval,
		perFileReadLimit: cfg.PerFileReadLimit,
		enableFSNotify:   enableFSNotify,
		eventDebounce:    cfg.EventDebounce,
		criticalKeywords: criticalKeywords,
	}
}

// Output 返回采集输出通道，下游 pipeline 从此通道消费
func (c *Collector) Output() <-chan []plugins.Record {
	return c.outputCh
}

// Start 启动所有采集源
func (c *Collector) Start(ctx context.Context) error {
	c.mu.Lock()
	if c.running {
		c.mu.Unlock()
		return fmt.Errorf("采集器已在运行")
	}
	c.running = true
	c.mu.Unlock()

	for i, src := range c.sources {
		switch src.Type {
		case SourceTypeFile:
			go c.collectFiles(ctx, src)
		case SourceTypeSyslog:
			go c.collectSyslog(ctx, src)
		default:
			log.Printf("未知采集源类型 #%d: %s, 跳过", i, src.Type)
		}
	}
	log.Printf("采集器已启动，共 %d 个采集源", len(c.sources))
	return nil
}

// collectFiles 从文件源采集日志
func (c *Collector) collectFiles(ctx context.Context, src SourceConfig) {
	// fileOffsets 维护当前进程内各文件读取位置，首次从 checkpoint 恢复。
	fileOffsets := make(map[string]int64)
	nextPathIndex := 0
	scanInterval := c.flushInterval
	if src.ScanInterval > 0 {
		scanInterval = src.ScanInterval
	}
	ticker := time.NewTicker(scanInterval)
	defer ticker.Stop()

	triggerCh := make(chan struct{}, 1)
	stopWatcher := c.startFileEventWatcher(ctx, src, triggerCh)
	defer stopWatcher()
	emitTrigger(triggerCh)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !c.scanAndEmit(ctx, src, fileOffsets, &nextPathIndex) {
				return
			}
		case <-triggerCh:
			if !c.scanAndEmit(ctx, src, fileOffsets, &nextPathIndex) {
				return
			}
		}
	}
}

func (c *Collector) scanAndEmit(ctx context.Context, src SourceConfig, fileOffsets map[string]int64, nextPathIndex *int) bool {
	batch, latestOffsets, nextIndex := c.scanIncrementalFileRecords(src, fileOffsets, *nextPathIndex)
	*nextPathIndex = nextIndex
	if len(batch) == 0 {
		return true
	}

	criticalBatch, normalBatch := c.splitCriticalBatch(src, batch)
	if len(criticalBatch) > 0 {
		if !c.emitBatch(ctx, criticalBatch) {
			return false
		}
	}
	if len(normalBatch) > 0 {
		if !c.emitBatch(ctx, normalBatch) {
			return false
		}
	}

	// 只有批次成功投递到下游通道后，才推进本进程读取位置。
	for path, offset := range latestOffsets {
		fileOffsets[path] = offset
	}
	return true
}

// scanIncrementalFileRecords 按源配置扫描新增内容并生成批次。
// 使用 round-robin 按文件公平读取，避免高流量文件长期饿死其他路径。
func (c *Collector) scanIncrementalFileRecords(src SourceConfig, fileOffsets map[string]int64, startIndex int) ([]plugins.Record, map[string]int64, int) {
	batch := make([]plugins.Record, 0, c.batchSize)
	latestOffsets := make(map[string]int64)
	paths := c.resolveSourcePaths(src)
	if len(paths) == 0 || c.batchSize <= 0 {
		return batch, latestOffsets, 0
	}
	if startIndex < 0 {
		startIndex = 0
	}
	startIndex = startIndex % len(paths)
	nextIndex := startIndex

	idleRounds := 0
	for len(batch) < c.batchSize {
		path := paths[nextIndex]
		nextIndex = (nextIndex + 1) % len(paths)

		currentOffset, ok := latestOffsets[path]
		if !ok {
			var err error
			currentOffset, err = c.loadOffsetIfNeeded(path, fileOffsets)
			if err != nil {
				log.Printf("加载 checkpoint 失败 [%s]: %v, 使用 offset=0", path, err)
				currentOffset = 0
			}
		}

		pathLabels := resolvePathLabels(path, src.PathLabelRules)
		perPathLimit := c.perFileReadLimit
		remaining := c.batchSize - len(batch)
		if perPathLimit > remaining {
			perPathLimit = remaining
		}
		if perPathLimit <= 0 {
			break
		}
		records, nextOffset, readErr := c.readFileIncremental(path, currentOffset, perPathLimit, pathLabels)
		if readErr != nil {
			log.Printf("增量读取失败 [%s]: %v", path, readErr)
			idleRounds++
		} else if len(records) == 0 {
			idleRounds++
		} else {
			batch = append(batch, records...)
			latestOffsets[path] = nextOffset
			idleRounds = 0
		}

		// 完整扫描一轮都无新增，提前结束。
		if idleRounds >= len(paths) {
			break
		}
	}
	return batch, latestOffsets, nextIndex
}

func (c *Collector) resolveSourcePaths(src SourceConfig) []string {
	paths := make([]string, 0, len(src.Paths))
	seen := make(map[string]struct{})
	for _, configured := range src.Paths {
		resolved, err := resolveScanPaths(configured)
		if err != nil {
			log.Printf("解析采集路径失败 [%s]: %v", configured, err)
			continue
		}
		for _, path := range resolved {
			if isExcludedPath(path, src.ExcludePaths) {
				continue
			}
			cleaned := filepath.Clean(path)
			if cleaned == "" {
				continue
			}
			if _, exists := seen[cleaned]; exists {
				continue
			}
			seen[cleaned] = struct{}{}
			paths = append(paths, cleaned)
		}
	}
	sort.Strings(paths)
	return paths
}

// loadOffsetIfNeeded 在当前进程未缓存时，从 checkpoint 存储恢复文件偏移。
func (c *Collector) loadOffsetIfNeeded(path string, fileOffsets map[string]int64) (int64, error) {
	if offset, ok := fileOffsets[path]; ok {
		return offset, nil
	}

	pos, err := c.ckpStore.Load(path)
	if err != nil {
		return 0, err
	}
	fileOffsets[path] = pos.Offset
	if pos.Offset > 0 {
		log.Printf("从 checkpoint 恢复 [%s]: offset=%d", path, pos.Offset)
	}
	return pos.Offset, nil
}

// readFileIncremental 从指定偏移读取文件新增日志，返回记录与新偏移。
// pathLabels 用于按路径注入自定义标签，最终会透传到 pull API 与下游存储。
func (c *Collector) readFileIncremental(path string, startOffset int64, maxRecords int, pathLabels map[string]string) ([]plugins.Record, int64, error) {
	if maxRecords <= 0 {
		return nil, startOffset, nil
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, startOffset, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return nil, startOffset, err
	}
	if info.IsDir() {
		return nil, startOffset, fmt.Errorf("path is directory")
	}
	// 文件被截断或轮转时回退到头部，避免 seek 到无效偏移。
	if info.Size() < startOffset {
		startOffset = 0
	}

	if _, err = file.Seek(startOffset, io.SeekStart); err != nil {
		return nil, startOffset, err
	}

	reader := bufio.NewReader(file)
	records := make([]plugins.Record, 0, maxRecords)
	currentOffset := startOffset

	for len(records) < maxRecords {
		line, readErr := reader.ReadBytes('\n')
		if len(line) > 0 {
			currentOffset += int64(len(line))
			payload := bytes.TrimRight(line, "\r\n")
			metadata := make(map[string]string, len(pathLabels)+1)
			for key, value := range pathLabels {
				trimmedKey := strings.TrimSpace(key)
				if trimmedKey == "" {
					continue
				}
				// offset 为系统关键字段，禁止自定义规则覆盖。
				if trimmedKey == "offset" {
					continue
				}
				metadata[trimmedKey] = strings.TrimSpace(value)
			}
			// 记录“已提交到该行末尾”的绝对偏移，供 pipeline 与 ack checkpoint 回写。
			metadata["offset"] = strconv.FormatInt(currentOffset, 10)

			level := DetectLevel(payload)
			if level != LevelUnknown {
				metadata["level"] = strings.ToLower(string(level))
			}

			ts := DetectTimestamp(payload)
			if ts == 0 {
				ts = time.Now().UTC().UnixNano()
			}

			record := plugins.Record{
				Source:    path,
				Timestamp: ts,
				Data:      append([]byte(nil), payload...),
				Metadata:  metadata,
			}
			records = append(records, record)
		}

		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				break
			}
			return nil, startOffset, readErr
		}
	}

	return records, currentOffset, nil
}

// resolvePathLabels 根据路径规则生成标签，后出现的规则会覆盖先前同名字段。
func resolvePathLabels(path string, rules []PathLabelRule) map[string]string {
	if len(rules) == 0 {
		return nil
	}

	resolved := make(map[string]string)
	for _, rule := range rules {
		pattern := strings.TrimSpace(rule.Pattern)
		if pattern == "" || len(rule.Labels) == 0 {
			continue
		}
		if !isPathMatched(path, pattern) {
			continue
		}
		for key, value := range rule.Labels {
			trimmedKey := strings.TrimSpace(key)
			if trimmedKey == "" {
				continue
			}
			resolved[trimmedKey] = strings.TrimSpace(value)
		}
	}
	if len(resolved) == 0 {
		return nil
	}
	return resolved
}

// isPathMatched 判断路径是否命中 pattern，兼容全路径与文件名匹配。
func isPathMatched(path, pattern string) bool {
	if matched, err := filepath.Match(pattern, path); err == nil && matched {
		return true
	}
	if matched, err := filepath.Match(pattern, filepath.Base(path)); err == nil && matched {
		return true
	}
	return false
}

// resolveScanPaths 将配置项解析为可读取文件列表，支持 glob 与单文件路径。
func resolveScanPaths(configured string) ([]string, error) {
	configured = strings.TrimSpace(configured)
	if configured == "" {
		return nil, nil
	}

	matches, err := filepath.Glob(configured)
	if err != nil {
		return nil, err
	}
	if len(matches) > 0 {
		return matches, nil
	}

	info, statErr := os.Stat(configured)
	if statErr == nil && !info.IsDir() {
		return []string{configured}, nil
	}
	if statErr != nil && !os.IsNotExist(statErr) {
		return nil, statErr
	}
	return nil, nil
}

// isExcludedPath 判断文件路径是否命中排除规则。
func isExcludedPath(path string, excludePatterns []string) bool {
	for _, raw := range excludePatterns {
		pattern := strings.TrimSpace(raw)
		if pattern == "" {
			continue
		}
		if matched, err := filepath.Match(pattern, path); err == nil && matched {
			return true
		}
		// 兼容仅写文件名模式（如 *.gz）。
		if matched, err := filepath.Match(pattern, filepath.Base(path)); err == nil && matched {
			return true
		}
	}
	return false
}

// emitBatch 向下游发送批次；如果上下文结束则返回 false。
func (c *Collector) emitBatch(ctx context.Context, batch []plugins.Record) bool {
	select {
	case c.outputCh <- batch:
		return true
	case <-ctx.Done():
		return false
	}
}

func (c *Collector) splitCriticalBatch(src SourceConfig, batch []plugins.Record) ([]plugins.Record, []plugins.Record) {
	criticalKeywords := c.criticalKeywords
	if len(src.CriticalKeywords) > 0 {
		criticalKeywords = normalizeKeywords(src.CriticalKeywords)
	}
	priority := normalizeSourcePriority(src.Priority)

	critical := make([]plugins.Record, 0, len(batch))
	normal := make([]plugins.Record, 0, len(batch))
	for _, item := range batch {
		isCritical := priority == SourcePriorityCritical || isCriticalRecord(item, criticalKeywords)
		if isCritical {
			record := item
			if record.Metadata == nil {
				record.Metadata = map[string]string{}
			}
			if strings.TrimSpace(record.Metadata["log_priority"]) == "" {
				record.Metadata["log_priority"] = string(SourcePriorityCritical)
			}
			critical = append(critical, record)
			continue
		}
		normal = append(normal, item)
	}
	return critical, normal
}

func isCriticalRecord(record plugins.Record, keywords []string) bool {
	if record.Metadata != nil && strings.EqualFold(strings.TrimSpace(record.Metadata["log_priority"]), string(SourcePriorityCritical)) {
		return true
	}
	if len(keywords) == 0 || len(record.Data) == 0 {
		return false
	}
	text := strings.ToLower(string(record.Data))
	for _, keyword := range keywords {
		if keyword == "" {
			continue
		}
		if strings.Contains(text, keyword) {
			return true
		}
	}
	return false
}

func normalizeKeywords(raw []string) []string {
	result := make([]string, 0, len(raw))
	seen := make(map[string]struct{})
	for _, item := range raw {
		trimmed := strings.ToLower(strings.TrimSpace(item))
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func normalizeSourcePriority(priority SourcePriority) SourcePriority {
	switch strings.ToLower(strings.TrimSpace(string(priority))) {
	case string(SourcePriorityCritical):
		return SourcePriorityCritical
	default:
		return SourcePriorityNormal
	}
}

func emitTrigger(triggerCh chan<- struct{}) {
	select {
	case triggerCh <- struct{}{}:
	default:
	}
}

func (c *Collector) startFileEventWatcher(ctx context.Context, src SourceConfig, triggerCh chan<- struct{}) func() {
	if !c.enableFSNotify || src.DisableFSNotify {
		return func() {}
	}
	dirs := collectWatchDirs(src.Paths)
	if len(dirs) == 0 {
		return func() {}
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("初始化 fsnotify 失败，降级为定时扫描: %v", err)
		return func() {}
	}
	var closeOnce sync.Once
	closeWatcher := func() {
		closeOnce.Do(func() {
			_ = watcher.Close()
		})
	}
	for _, dir := range dirs {
		if addErr := watcher.Add(dir); addErr != nil {
			log.Printf("添加 fsnotify 监听目录失败 [%s]: %v", dir, addErr)
		}
	}

	go func() {
		var debounceTimer *time.Timer
		var debounceCh <-chan time.Time
		pending := false
		for {
			select {
			case <-ctx.Done():
				closeWatcher()
				if debounceTimer != nil {
					debounceTimer.Stop()
				}
				return
			case <-debounceCh:
				debounceCh = nil
				if pending {
					emitTrigger(triggerCh)
					pending = false
				}
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if !shouldHandleFsEvent(event.Op) {
					continue
				}
				path := filepath.Clean(strings.TrimSpace(event.Name))
				if path == "" || !matchesSourcePaths(path, src.Paths) || isExcludedPath(path, src.ExcludePaths) {
					continue
				}
				if c.eventDebounce <= 0 {
					emitTrigger(triggerCh)
					continue
				}
				pending = true
				if debounceTimer == nil {
					debounceTimer = time.NewTimer(c.eventDebounce)
					debounceCh = debounceTimer.C
					continue
				}
				if !debounceTimer.Stop() {
					select {
					case <-debounceTimer.C:
					default:
					}
				}
				debounceTimer.Reset(c.eventDebounce)
				debounceCh = debounceTimer.C
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("fsnotify 监听异常: %v", err)
			}
		}
	}()

	return func() {
		closeWatcher()
	}
}

func shouldHandleFsEvent(op fsnotify.Op) bool {
	return op&(fsnotify.Create|fsnotify.Write|fsnotify.Rename|fsnotify.Chmod) != 0
}

func collectWatchDirs(configuredPaths []string) []string {
	seen := make(map[string]struct{})
	dirs := make([]string, 0, len(configuredPaths))
	for _, configured := range configuredPaths {
		configured = strings.TrimSpace(configured)
		if configured == "" {
			continue
		}
		dir := configured
		if hasWildcard(configured) {
			dir = filepath.Dir(configured)
		} else {
			info, err := os.Stat(configured)
			if err == nil {
				if info.IsDir() {
					dir = configured
				} else {
					dir = filepath.Dir(configured)
				}
			} else {
				dir = filepath.Dir(configured)
			}
		}
		dir = filepath.Clean(strings.TrimSpace(dir))
		if dir == "" || dir == "." {
			dir = "."
		}
		if _, ok := seen[dir]; ok {
			continue
		}
		seen[dir] = struct{}{}
		dirs = append(dirs, dir)
	}
	sort.Strings(dirs)
	return dirs
}

func matchesSourcePaths(path string, configuredPaths []string) bool {
	for _, configured := range configuredPaths {
		trimmed := strings.TrimSpace(configured)
		if trimmed == "" {
			continue
		}
		if hasWildcard(trimmed) {
			if isPathMatched(path, trimmed) {
				return true
			}
			continue
		}
		cleaned := filepath.Clean(trimmed)
		if cleaned == path {
			return true
		}
		if filepath.Base(cleaned) == filepath.Base(path) {
			return true
		}
	}
	return false
}

func hasWildcard(path string) bool {
	return strings.ContainsAny(path, "*?[")
}

// collectSyslog 从 syslog 源采集日志
func (c *Collector) collectSyslog(ctx context.Context, src SourceConfig) {
	log.Printf("Syslog 采集器启动: %s://%s", src.Protocol, src.Bind)

	// 解析协议和地址
	protocol := strings.ToLower(strings.TrimSpace(src.Protocol))
	bindAddr := strings.TrimSpace(src.Bind)
	if bindAddr == "" {
		bindAddr = "0.0.0.0:514" // 默认 syslog 端口
	}

	// 启动监听器
	var listener net.Listener
	var err error

	if protocol == "udp" {
		// UDP 监听
		addr, err := net.ResolveUDPAddr("udp", bindAddr)
		if err != nil {
			log.Printf("Syslog UDP 地址解析失败: %v", err)
			return
		}
		conn, err := net.ListenUDP("udp", addr)
		if err != nil {
			log.Printf("Syslog UDP 监听失败: %v", err)
			return
		}
		defer conn.Close()
		go c.handleUDPSyslog(ctx, conn, src)
		log.Printf("Syslog UDP 监听器已启动: %s", bindAddr)
	} else {
		// TCP 监听
		listener, err = net.Listen("tcp", bindAddr)
		if err != nil {
			log.Printf("Syslog TCP 监听失败: %v", err)
			return
		}
		defer listener.Close()
		go c.handleTCPSyslog(ctx, listener, src)
		log.Printf("Syslog TCP 监听器已启动: %s", bindAddr)
	}

	<-ctx.Done()
	log.Printf("Syslog 采集器已停止: %s", src.Bind)
}

// handleUDPSyslog 处理 UDP syslog 消息
func (c *Collector) handleUDPSyslog(ctx context.Context, conn *net.UDPConn, src SourceConfig) {
	buf := make([]byte, 65536) // 64KB UDP 最大包
	for {
		select {
		case <-ctx.Done():
			return
		default:
			conn.SetReadDeadline(time.Now().Add(1 * time.Second))
			n, addr, err := conn.ReadFromUDP(buf)
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue
				}
				log.Printf("UDP 读取错误: %v", err)
				continue
			}
			if n > 0 {
				data := make([]byte, n)
				copy(data, buf[:n])
				record := c.parseSyslogMessage(data, fmt.Sprintf("udp://%s", addr.String()), src)
				select {
				case c.outputCh <- []plugins.Record{record}:
				case <-ctx.Done():
					return
				}
			}
		}
	}
}

// handleTCPSyslog 处理 TCP syslog 消息
func (c *Collector) handleTCPSyslog(ctx context.Context, listener net.Listener, src SourceConfig) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			listener.(*net.TCPListener).SetDeadline(time.Now().Add(1 * time.Second))
			conn, err := listener.Accept()
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue
				}
				log.Printf("TCP Accept 错误: %v", err)
				continue
			}
			go c.handleTCPConnection(ctx, conn, src)
		}
	}
}

// handleTCPConnection 处理单个 TCP 连接
func (c *Collector) handleTCPConnection(ctx context.Context, conn net.Conn, src SourceConfig) {
	defer conn.Close()
	addr := conn.RemoteAddr().String()
	reader := bufio.NewReader(conn)

	for {
		select {
		case <-ctx.Done():
			return
		default:
			conn.SetReadDeadline(time.Now().Add(1 * time.Second))
			line, err := reader.ReadString('\n')
			if err != nil {
				if err != io.EOF {
					log.Printf("TCP 读取错误: %v", err)
				}
				return
			}
			if len(line) > 0 {
				record := c.parseSyslogMessage([]byte(line), fmt.Sprintf("tcp://%s", addr), src)
				select {
				case c.outputCh <- []plugins.Record{record}:
				case <-ctx.Done():
					return
				}
			}
		}
	}
}

// parseSyslogMessage 解析 syslog 消息并转换为 Record
func (c *Collector) parseSyslogMessage(data []byte, source string, src SourceConfig) plugins.Record {
	metadata := make(map[string]string, 8)

	// 解析 RFC3164 或 RFC5424 格式的 syslog 消息
	// 简单实现：提取消息文本和基本字段
	message := strings.TrimSpace(string(data))

	// 提取 priority (如果有)
	priority := extractSyslogPriority(message)
	if priority != "" {
		metadata["priority"] = priority
		// 从 priority 提取 facility 和 severity
		metadata["facility"] = extractFacility(priority)
		metadata["severity"] = extractSeverity(priority)
	}

	// 提取主机名
	hostname := extractSyslogHostname(message)
	if hostname != "" {
		metadata["hostname"] = hostname
	}

	// 提取应用名
	appname := extractSyslogAppname(message)
	if appname != "" {
		metadata["appname"] = appname
	}

	// 提取进程 ID
	procid := extractSyslogProcid(message)
	if procid != "" {
		metadata["proc_id"] = procid
	}

	// 提取消息内容
	msgContent := extractSyslogMessage(message)
	if msgContent != "" {
		message = msgContent
	}

	// 检测日志级别
	level := DetectLevel([]byte(message))
	if level != LevelUnknown {
		metadata["level"] = strings.ToLower(string(level))
	}

	// 路径标签
	pathLabels := resolvePathLabels(source, src.PathLabelRules)
	for k, v := range pathLabels {
		if k != "offset" {
			metadata[k] = v
		}
	}

	record := plugins.Record{
		Source:    source,
		Timestamp: time.Now().UTC().UnixNano(),
		Data:      []byte(message),
		Metadata:  metadata,
	}

	// 添加 source.kind
	if record.Metadata == nil {
		record.Metadata = make(map[string]string)
	}
	record.Metadata["source_kind"] = "syslog"
	record.Metadata["source_path"] = src.Bind

	return record
}

// extractSyslogPriority 从 syslog 消息中提取 priority
func extractSyslogPriority(msg string) string {
	// RFC5424: <priority>version...
	if len(msg) > 0 && msg[0] == '<' {
		end := strings.Index(msg, ">")
		if end > 0 {
			return msg[1:end]
		}
	}
	return ""
}

// extractFacility 从 priority 提取 facility
func extractFacility(priority string) string {
	p, err := strconv.Atoi(priority)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%d", p>>3)
}

// extractSeverity 从 priority 提取 severity
func extractSeverity(priority string) string {
	p, err := strconv.Atoi(priority)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%d", p&7)
}

// extractSyslogHostname 提取主机名
func extractSyslogHostname(msg string) string {
	// RFC3164: <timestamp> <hostname> <tag>: <message>
	// RFC5424: <priority>version timestamp hostname app-name procid msgid structured-data message
	if len(msg) > 0 && msg[0] == '<' {
		// RFC5424 格式
		end := strings.Index(msg, ">")
		if end < 0 {
			return ""
		}
		msg = msg[end+1:]
		// 跳过 version
		spaceIdx := strings.Index(msg, " ")
		if spaceIdx < 0 {
			return ""
		}
		msg = msg[spaceIdx+1:]
		// 提取 timestamp
		spaceIdx = strings.Index(msg, " ")
		if spaceIdx < 0 {
			return ""
		}
		hostname := msg[:spaceIdx]
		if hostname == "-" {
			return ""
		}
		return hostname
	}
	// RFC3164 格式 - 简化处理
	parts := strings.Fields(msg)
	if len(parts) >= 2 {
		return parts[1]
	}
	return ""
}

// extractSyslogAppname 提取应用名
func extractSyslogAppname(msg string) string {
	if len(msg) > 0 && msg[0] == '<' {
		// RFC5424 格式
		end := strings.Index(msg, ">")
		if end < 0 {
			return ""
		}
		msg = msg[end+1:]
		// 跳过 version, timestamp, hostname
		for i := 0; i < 3; i++ {
			spaceIdx := strings.Index(msg, " ")
			if spaceIdx < 0 {
				return ""
			}
			msg = msg[spaceIdx+1:]
		}
		// 提取 app-name
		spaceIdx := strings.Index(msg, " ")
		if spaceIdx < 0 {
			return ""
		}
		appname := msg[:spaceIdx]
		if appname == "-" {
			return ""
		}
		return appname
	}
	return ""
}

// extractSyslogProcid 提取进程 ID
func extractSyslogProcid(msg string) string {
	if len(msg) > 0 && msg[0] == '<' {
		// RFC5424 格式
		end := strings.Index(msg, ">")
		if end < 0 {
			return ""
		}
		msg = msg[end+1:]
		// 跳过 version, timestamp, hostname, app-name
		for i := 0; i < 4; i++ {
			spaceIdx := strings.Index(msg, " ")
			if spaceIdx < 0 {
				return ""
			}
			msg = msg[spaceIdx+1:]
		}
		// 提取 procid
		spaceIdx := strings.Index(msg, " ")
		if spaceIdx < 0 {
			procid := strings.TrimSpace(msg)
			if procid != "-" && procid != "" {
				return procid
			}
			return ""
		}
		procid := msg[:spaceIdx]
		if procid == "-" {
			return ""
		}
		return procid
	}
	return ""
}

// extractSyslogMessage 提取消息内容
func extractSyslogMessage(msg string) string {
	if len(msg) > 0 && msg[0] == '<' {
		// RFC5424 格式 - 跳过前面所有字段，找 message
		end := strings.Index(msg, ">")
		if end < 0 {
			return msg
		}
		msg = msg[end+1:]
		// 跳过 version, timestamp, hostname, app-name, procid, msgid, structured-data
		for i := 0; i < 6; i++ {
			spaceIdx := strings.Index(msg, " ")
			if spaceIdx < 0 {
				break
			}
			msg = msg[spaceIdx+1:]
		}
		return strings.TrimSpace(msg)
	}
	// RFC3164 格式 - 找第一个 : 之后的内容
	if idx := strings.Index(msg, ":"); idx >= 0 {
		return strings.TrimSpace(msg[idx+1:])
	}
	return msg
}

// Stop 停止采集器
func (c *Collector) Stop() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.running = false
	close(c.outputCh)
}
