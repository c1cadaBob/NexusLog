package ingest

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	defaultInventoryPageSize  = 200
	defaultRecentPackageLimit = 240
	defaultAgentProbeTimeout  = 3 * time.Second
)

type AgentInventoryItem struct {
	AgentID             string               `json:"agent_id"`
	AgentBaseURL        string               `json:"agent_base_url,omitempty"`
	Host                string               `json:"host,omitempty"`
	Hostname            string               `json:"hostname,omitempty"`
	IP                  string               `json:"ip,omitempty"`
	Version             string               `json:"version,omitempty"`
	Status              string               `json:"status"`
	LiveConnected       bool                 `json:"live_connected"`
	LastSeenAt          string               `json:"last_seen_at,omitempty"`
	SourceCount         int                  `json:"source_count"`
	ActiveSourceCount   int                  `json:"active_source_count"`
	PausedSourceCount   int                  `json:"paused_source_count"`
	DisabledSourceCount int                  `json:"disabled_source_count"`
	SourceIDs           []string             `json:"source_ids,omitempty"`
	SourceNames         []string             `json:"source_names,omitempty"`
	SourcePaths         []string             `json:"source_paths,omitempty"`
	Capabilities        []string             `json:"capabilities,omitempty"`
	Metrics             *AgentMetricsSummary `json:"metrics,omitempty"`
	ErrorMessage        string               `json:"error_message,omitempty"`
}

type AgentMetricsSummary struct {
	CPUUsagePct      float64 `json:"cpu_usage_pct"`
	MemoryUsagePct   float64 `json:"memory_usage_pct"`
	DiskUsagePct     float64 `json:"disk_usage_pct"`
	DiskIOReadBytes  int64   `json:"disk_io_read_bytes"`
	DiskIOWriteBytes int64   `json:"disk_io_write_bytes"`
	NetInBytes       int64   `json:"net_in_bytes"`
	NetOutBytes      int64   `json:"net_out_bytes"`
	CollectedAt      string  `json:"collected_at,omitempty"`
}

type PullTaskStatusSummary struct {
	TaskID       string         `json:"task_id,omitempty"`
	Status       string         `json:"status,omitempty"`
	TriggerType  string         `json:"trigger_type,omitempty"`
	RequestID    string         `json:"request_id,omitempty"`
	BatchID      string         `json:"batch_id,omitempty"`
	RetryCount   int            `json:"retry_count,omitempty"`
	ErrorCode    string         `json:"error_code,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
	ScheduledAt  string         `json:"scheduled_at,omitempty"`
	StartedAt    string         `json:"started_at,omitempty"`
	FinishedAt   string         `json:"finished_at,omitempty"`
	Options      map[string]any `json:"options,omitempty"`
}

type PullCursorStatusSummary struct {
	AgentID     string `json:"agent_id,omitempty"`
	SourceRef   string `json:"source_ref,omitempty"`
	SourcePath  string `json:"source_path,omitempty"`
	LastCursor  string `json:"last_cursor,omitempty"`
	LastOffset  int64  `json:"last_offset,omitempty"`
	LastBatchID string `json:"last_batch_id,omitempty"`
	UpdatedAt   string `json:"updated_at,omitempty"`
}

type PullPackageStatusSummary struct {
	PackageID   string `json:"package_id,omitempty"`
	AgentID     string `json:"agent_id,omitempty"`
	SourceRef   string `json:"source_ref,omitempty"`
	BatchID     string `json:"batch_id,omitempty"`
	NextCursor  string `json:"next_cursor,omitempty"`
	RecordCount int    `json:"record_count,omitempty"`
	FileCount   int    `json:"file_count,omitempty"`
	SizeBytes   int64  `json:"size_bytes,omitempty"`
	Status      string `json:"status,omitempty"`
	CreatedAt   string `json:"created_at,omitempty"`
	AckedAt     string `json:"acked_at,omitempty"`
	PrimaryFile string `json:"primary_file,omitempty"`
}

type PullSourceStatusItem struct {
	SourceID         string                   `json:"source_id"`
	Name             string                   `json:"name"`
	Protocol         string                   `json:"protocol"`
	Host             string                   `json:"host"`
	Port             int                      `json:"port"`
	Path             string                   `json:"path"`
	AgentBaseURL     string                   `json:"agent_base_url,omitempty"`
	ConfiguredStatus string                   `json:"configured_status"`
	RuntimeStatus    string                   `json:"runtime_status"`
	AgentID          string                   `json:"agent_id,omitempty"`
	AgentHostname    string                   `json:"agent_hostname,omitempty"`
	AgentIP          string                   `json:"agent_ip,omitempty"`
	AgentStatus      string                   `json:"agent_status,omitempty"`
	LiveConnected    bool                     `json:"live_connected"`
	PullIntervalSec  int                      `json:"pull_interval_sec"`
	PullTimeoutSec   int                      `json:"pull_timeout_sec"`
	EstimatedEPS     float64                  `json:"estimated_eps,omitempty"`
	LastTask         PullTaskStatusSummary    `json:"last_task,omitempty"`
	LastCursor       PullCursorStatusSummary  `json:"last_cursor,omitempty"`
	LastPackage      PullPackageStatusSummary `json:"last_package,omitempty"`
	Metrics          *AgentMetricsSummary     `json:"metrics,omitempty"`
	UpdatedAt        string                   `json:"updated_at,omitempty"`
	ErrorMessage     string                   `json:"error_message,omitempty"`
}

type PullSourceStatusSummary struct {
	TotalSources       int `json:"total_sources"`
	ActiveSources      int `json:"active_sources"`
	PausedSources      int `json:"paused_sources"`
	DisabledSources    int `json:"disabled_sources"`
	OnlineAgents       int `json:"online_agents"`
	OfflineAgents      int `json:"offline_agents"`
	HealthySources     int `json:"healthy_sources"`
	FailedSources      int `json:"failed_sources"`
	RecentRecordCount  int `json:"recent_record_count"`
	RecentPackageCount int `json:"recent_package_count"`
}

type PullSourceStatusTrendPoint struct {
	BucketStart  string `json:"bucket_start"`
	PackageCount int    `json:"package_count"`
	RecordCount  int    `json:"record_count"`
}

type GenerateDeploymentScriptRequest struct {
	TargetKind          string   `json:"target_kind"`
	SourceName          string   `json:"source_name"`
	SourceType          string   `json:"source_type,omitempty"`
	AgentID             string   `json:"agent_id,omitempty"`
	AgentBaseURL        string   `json:"agent_base_url,omitempty"`
	ControlPlaneBaseURL string   `json:"control_plane_base_url,omitempty"`
	ReleaseBaseURL      string   `json:"release_base_url,omitempty"`
	ContainerImage      string   `json:"container_image,omitempty"`
	Version             string   `json:"version,omitempty"`
	IncludePaths        []string `json:"include_paths,omitempty"`
	ExcludePaths        []string `json:"exclude_paths,omitempty"`
	SyslogBind          string   `json:"syslog_bind,omitempty"`
	SyslogProtocol      string   `json:"syslog_protocol,omitempty"`
	KeyRef              string   `json:"key_ref,omitempty"`
}

type GenerateDeploymentScriptResponse struct {
	TargetKind      string   `json:"target_kind"`
	ScriptKind      string   `json:"script_kind"`
	FileName        string   `json:"file_name"`
	Command         string   `json:"command,omitempty"`
	Script          string   `json:"script"`
	AgentBaseURL    string   `json:"agent_base_url,omitempty"`
	ListenerAddress string   `json:"listener_address,omitempty"`
	Notes           []string `json:"notes,omitempty"`
}

type AgentInventoryHandler struct {
	sourceStore       *PullSourceStore
	taskStore         *PullTaskStore
	packageStore      *PullPackageStore
	cursorStore       *PullCursorStore
	authKeyStore      *AgentAuthKeyStore
	agentClient       *AgentClient
	defaultAgentKeyID string
	defaultAgentKey   string
}

func NewAgentInventoryHandler(
	sourceStore *PullSourceStore,
	taskStore *PullTaskStore,
	packageStore *PullPackageStore,
	cursorStore *PullCursorStore,
	authKeyStore *AgentAuthKeyStore,
	agentClient *AgentClient,
	defaultAgentKeyID string,
	defaultAgentKey string,
) *AgentInventoryHandler {
	return &AgentInventoryHandler{
		sourceStore:       sourceStore,
		taskStore:         taskStore,
		packageStore:      packageStore,
		cursorStore:       cursorStore,
		authKeyStore:      authKeyStore,
		agentClient:       agentClient,
		defaultAgentKeyID: strings.TrimSpace(defaultAgentKeyID),
		defaultAgentKey:   strings.TrimSpace(defaultAgentKey),
	}
}

type agentProbeResult struct {
	Meta      AgentMetaResponse
	Metrics   *AgentMetricsSummary
	Reachable bool
	CheckedAt time.Time
	Error     string
}

func (h *AgentInventoryHandler) ListAgents(c *gin.Context) {
	sources, err := h.loadAllSources()
	if err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to load pull sources", gin.H{"details": err.Error()})
		return
	}

	probes := h.probeAgents(c.Request.Context(), sources)
	items := h.buildAgentInventoryItems(sources, probes)
	writeSuccess(c, http.StatusOK, gin.H{"items": items}, gin.H{"total": len(items)})
}

func (h *AgentInventoryHandler) ListPullSourceStatus(c *gin.Context) {
	rangeKey, window := parseSourceStatusRange(c.DefaultQuery("range", "1h"))
	sources, err := h.loadAllSources()
	if err != nil {
		writeError(c, http.StatusInternalServerError, ErrorCodeInternalError, "failed to load pull sources", gin.H{"details": err.Error()})
		return
	}

	probes := h.probeAgents(c.Request.Context(), sources)
	items := make([]PullSourceStatusItem, 0, len(sources))
	summary := PullSourceStatusSummary{TotalSources: len(sources)}
	for _, source := range sources {
		item := h.buildPullSourceStatusItem(source, probes)
		items = append(items, item)
		switch strings.ToLower(strings.TrimSpace(source.Status)) {
		case "active":
			summary.ActiveSources += 1
		case "paused":
			summary.PausedSources += 1
		case "disabled":
			summary.DisabledSources += 1
		}
		switch item.RuntimeStatus {
		case "healthy", "running":
			summary.HealthySources += 1
		case "error", "offline":
			summary.FailedSources += 1
		}
	}
	for _, item := range h.buildAgentInventoryItems(sources, probes) {
		switch item.Status {
		case "online", "paused", "disabled":
			summary.OnlineAgents += 1
		default:
			summary.OfflineAgents += 1
		}
	}

	recentPackages, _ := h.packageStore.List("", "", "", 1, defaultRecentPackageLimit)
	trend := buildSourceStatusTrend(recentPackages, window)
	for _, pkg := range recentPackages {
		if window > 0 && pkg.CreatedAt.Before(time.Now().UTC().Add(-window)) {
			continue
		}
		summary.RecentPackageCount += 1
		summary.RecentRecordCount += pkg.RecordCount
	}

	writeSuccess(c, http.StatusOK, gin.H{
		"summary":         summary,
		"items":           items,
		"trend":           trend,
		"range":           rangeKey,
		"last_refresh_at": time.Now().UTC().Format(time.RFC3339),
	}, gin.H{"total": len(items)})
}

func (h *AgentInventoryHandler) GenerateDeploymentScript(c *gin.Context) {
	var req GenerateDeploymentScriptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, "invalid request body", gin.H{"details": err.Error()})
		return
	}
	resp, err := h.generateDeploymentScript(req)
	if err != nil {
		writeError(c, http.StatusBadRequest, ErrorCodeRequestInvalidParams, err.Error(), gin.H{})
		return
	}
	writeSuccess(c, http.StatusOK, resp, gin.H{})
}

func (h *AgentInventoryHandler) loadAllSources() ([]PullSource, error) {
	if h == nil || h.sourceStore == nil {
		return nil, fmt.Errorf("pull source store is not configured")
	}
	page := 1
	items := make([]PullSource, 0, defaultInventoryPageSize)
	for {
		chunk, total := h.sourceStore.List("", page, defaultInventoryPageSize)
		if len(chunk) == 0 {
			break
		}
		items = append(items, chunk...)
		if len(items) >= total || len(chunk) < defaultInventoryPageSize {
			break
		}
		page += 1
	}
	return items, nil
}

func (h *AgentInventoryHandler) buildAgentInventoryItems(sources []PullSource, probes map[string]agentProbeResult) []AgentInventoryItem {
	grouped := groupSourcesByAgentEndpoint(sources)
	keys := make([]string, 0, len(grouped))
	for key := range grouped {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	items := make([]AgentInventoryItem, 0, len(keys))
	for _, key := range keys {
		group := grouped[key]
		probe := probes[key]
		first := group[0]
		activeCount := 0
		pausedCount := 0
		disabledCount := 0
		sourceIDs := make([]string, 0, len(group))
		sourceNames := make([]string, 0, len(group))
		sourcePaths := make([]string, 0, len(group)*2)
		lastSeenAt := latestRFC3339(first.UpdatedAt)
		for _, source := range group {
			sourceIDs = append(sourceIDs, source.SourceID)
			sourceNames = append(sourceNames, source.Name)
			sourcePaths = append(sourcePaths, splitCSVValues(source.Path)...)
			switch strings.ToLower(strings.TrimSpace(source.Status)) {
			case "active":
				activeCount += 1
			case "paused":
				pausedCount += 1
			case "disabled":
				disabledCount += 1
			}
			if source.UpdatedAt.After(parseRFC3339OrZero(lastSeenAt)) {
				lastSeenAt = latestRFC3339(source.UpdatedAt)
			}
		}
		if probe.Reachable {
			lastSeenAt = latestRFC3339(probe.CheckedAt)
		}

		status := "offline"
		switch {
		case disabledCount == len(group):
			status = "disabled"
		case probe.Reachable && activeCount > 0:
			status = "online"
		case pausedCount > 0 && activeCount == 0:
			status = "paused"
		case probe.Reachable:
			status = "online"
		}

		hostname := strings.TrimSpace(probe.Meta.Hostname)
		if hostname == "" {
			hostname = first.Host
		}
		host := first.Host
		if host == "" {
			host = hostFromBaseURL(first.AgentBaseURL)
		}

		sourcePaths = uniqueSortedStrings(sourcePaths)
		if len(probe.Meta.Sources) > 0 {
			sourcePaths = uniqueSortedStrings(append(sourcePaths, probe.Meta.Sources...))
		}

		item := AgentInventoryItem{
			AgentID:             firstNonEmptyValue(strings.TrimSpace(probe.Meta.AgentID), host, key),
			AgentBaseURL:        strings.TrimSpace(first.AgentBaseURL),
			Host:                host,
			Hostname:            hostname,
			IP:                  strings.TrimSpace(probe.Meta.IP),
			Version:             strings.TrimSpace(probe.Meta.Version),
			Status:              status,
			LiveConnected:       probe.Reachable,
			LastSeenAt:          lastSeenAt,
			SourceCount:         len(group),
			ActiveSourceCount:   activeCount,
			PausedSourceCount:   pausedCount,
			DisabledSourceCount: disabledCount,
			SourceIDs:           uniqueSortedStrings(sourceIDs),
			SourceNames:         uniqueSortedStrings(sourceNames),
			SourcePaths:         sourcePaths,
			Capabilities:        uniqueSortedStrings(probe.Meta.Capabilities),
			Metrics:             probe.Metrics,
			ErrorMessage:        strings.TrimSpace(probe.Error),
		}
		items = append(items, item)
	}
	return items
}

func (h *AgentInventoryHandler) buildPullSourceStatusItem(source PullSource, probes map[string]agentProbeResult) PullSourceStatusItem {
	probe := probes[groupKeyForSource(source)]
	cursor, hasCursor := h.cursorStore.GetLatestMatchingSourcePath(source.SourceID, source.Path)
	if !hasCursor {
		cursor, hasCursor = h.cursorStore.GetLatestBySource(source.SourceID)
	}
	task, hasTask := h.taskStore.LatestBySource(source.SourceID)

	lastPackage := PullPackage{}
	hasPackage := false
	packageAgentID := strings.TrimSpace(cursor.AgentID)
	packageSourceRef := strings.TrimSpace(cursor.SourceRef)
	if packageSourceRef == "" {
		packageSourceRef = strings.TrimSpace(source.Path)
	}
	packages, _ := h.packageStore.List(packageAgentID, packageSourceRef, "", 1, 1)
	if len(packages) == 0 && packageSourceRef != strings.TrimSpace(source.Path) {
		packages, _ = h.packageStore.List(packageAgentID, strings.TrimSpace(source.Path), "", 1, 1)
	}
	if len(packages) > 0 {
		lastPackage = packages[0]
		hasPackage = true
	}

	runtimeStatus := deriveRuntimeSourceStatus(source.Status, probe.Reachable, hasTask, task)
	estimatedEPS := 0.0
	if hasPackage {
		estimatedEPS = estimatePackageEPS(lastPackage, task, source.PullIntervalSec)
	}

	item := PullSourceStatusItem{
		SourceID:         source.SourceID,
		Name:             source.Name,
		Protocol:         source.Protocol,
		Host:             source.Host,
		Port:             source.Port,
		Path:             source.Path,
		AgentBaseURL:     source.AgentBaseURL,
		ConfiguredStatus: source.Status,
		RuntimeStatus:    runtimeStatus,
		AgentID:          firstNonEmptyValue(strings.TrimSpace(probe.Meta.AgentID), strings.TrimSpace(cursor.AgentID)),
		AgentHostname:    firstNonEmptyValue(strings.TrimSpace(probe.Meta.Hostname), source.Host),
		AgentIP:          strings.TrimSpace(probe.Meta.IP),
		AgentStatus:      strings.TrimSpace(probe.Meta.Status),
		LiveConnected:    probe.Reachable,
		PullIntervalSec:  source.PullIntervalSec,
		PullTimeoutSec:   source.PullTimeoutSec,
		EstimatedEPS:     estimatedEPS,
		Metrics:          probe.Metrics,
		UpdatedAt:        latestRFC3339(source.UpdatedAt),
		ErrorMessage:     strings.TrimSpace(firstNonEmptyValue(task.ErrorMessage, probe.Error)),
	}
	if hasTask {
		item.LastTask = summarizeTask(task)
	}
	if hasCursor {
		item.LastCursor = summarizeCursor(cursor)
	}
	if hasPackage {
		item.LastPackage = summarizePackage(lastPackage)
	}
	return item
}

func deriveRuntimeSourceStatus(configuredStatus string, probeReachable bool, hasTask bool, task PullTask) string {
	switch strings.ToLower(strings.TrimSpace(configuredStatus)) {
	case "disabled":
		return "disabled"
	case "paused":
		return "paused"
	}
	if hasTask {
		switch strings.ToLower(strings.TrimSpace(task.Status)) {
		case "failed", "canceled":
			return "error"
		case "pending", "running":
			if probeReachable {
				return "running"
			}
			return "offline"
		case "success":
			if probeReachable {
				return "healthy"
			}
			return "offline"
		}
	}
	if probeReachable {
		return "healthy"
	}
	return "offline"
}

func estimatePackageEPS(pkg PullPackage, task PullTask, fallbackIntervalSec int) float64 {
	if pkg.RecordCount <= 0 {
		return 0
	}
	seconds := float64(maxIntValue(fallbackIntervalSec, 1))
	if task.StartedAt != nil && task.FinishedAt != nil {
		duration := task.FinishedAt.Sub(*task.StartedAt).Seconds()
		if duration > 0 {
			seconds = duration
		}
	}
	if seconds <= 0 {
		seconds = 1
	}
	return float64(pkg.RecordCount) / seconds
}

func (h *AgentInventoryHandler) probeAgents(ctx context.Context, sources []PullSource) map[string]agentProbeResult {
	grouped := groupSourcesByAgentEndpoint(sources)
	results := make(map[string]agentProbeResult, len(grouped))
	if h == nil || h.agentClient == nil {
		return results
	}

	var (
		mu  sync.Mutex
		wg  sync.WaitGroup
		sem = make(chan struct{}, 6)
	)

	for key, group := range grouped {
		if strings.TrimSpace(key) == "" || len(group) == 0 {
			continue
		}
		wg.Add(1)
		go func(key string, group []PullSource) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			probeCtx, cancel := context.WithTimeout(ctx, defaultAgentProbeTimeout)
			defer cancel()

			source := firstProbeableSource(group)
			credential := h.resolveCredentialForSources(group)
			checkedAt := time.Now().UTC()
			meta, err := h.agentClient.Meta(probeCtx, source, credential, "")
			result := agentProbeResult{CheckedAt: checkedAt}
			if err != nil {
				result.Error = err.Error()
				mu.Lock()
				results[key] = result
				mu.Unlock()
				return
			}
			result.Reachable = true
			result.Meta = meta
			if metrics, metricsErr := h.agentClient.Metrics(probeCtx, source, credential, ""); metricsErr == nil {
				result.Metrics = &AgentMetricsSummary{
					CPUUsagePct:      metrics.CPUUsagePct,
					MemoryUsagePct:   metrics.MemoryUsagePct,
					DiskUsagePct:     metrics.DiskUsagePct,
					DiskIOReadBytes:  metrics.DiskIOReadBytes,
					DiskIOWriteBytes: metrics.DiskIOWriteBytes,
					NetInBytes:       metrics.NetInBytes,
					NetOutBytes:      metrics.NetOutBytes,
					CollectedAt:      latestRFC3339(metrics.CollectedAt),
				}
			} else {
				result.Error = metricsErr.Error()
			}
			mu.Lock()
			results[key] = result
			mu.Unlock()
		}(key, group)
	}
	wg.Wait()
	return results
}

func (h *AgentInventoryHandler) resolveCredentialForSources(group []PullSource) AgentAuthCredential {
	for _, source := range group {
		if keyRef := strings.TrimSpace(source.KeyRef); keyRef != "" && h.authKeyStore != nil {
			if credential, ok := h.authKeyStore.ResolveCredential(keyRef); ok {
				return credential
			}
		}
	}
	if h.authKeyStore != nil && strings.TrimSpace(h.defaultAgentKeyID) != "" {
		if credential, ok := h.authKeyStore.ResolveCredential(h.defaultAgentKeyID); ok {
			return credential
		}
	}
	return AgentAuthCredential{
		KeyID: firstNonEmptyValue(h.defaultAgentKeyID, "active"),
		Key:   strings.TrimSpace(h.defaultAgentKey),
	}
}

func firstProbeableSource(group []PullSource) PullSource {
	for _, source := range group {
		if strings.TrimSpace(source.AgentBaseURL) != "" {
			return source
		}
	}
	if len(group) > 0 {
		return group[0]
	}
	return PullSource{}
}

func groupSourcesByAgentEndpoint(sources []PullSource) map[string][]PullSource {
	grouped := make(map[string][]PullSource)
	for _, source := range sources {
		key := groupKeyForSource(source)
		grouped[key] = append(grouped[key], source)
	}
	return grouped
}

func groupKeyForSource(source PullSource) string {
	if baseURL := strings.TrimSpace(source.AgentBaseURL); baseURL != "" {
		return baseURL
	}
	return strings.TrimSpace(source.Host) + ":" + fmt.Sprintf("%d", source.Port)
}

func summarizeTask(task PullTask) PullTaskStatusSummary {
	summary := PullTaskStatusSummary{
		TaskID:       task.TaskID,
		Status:       task.Status,
		TriggerType:  task.TriggerType,
		RequestID:    task.RequestID,
		BatchID:      task.BatchID,
		RetryCount:   task.RetryCount,
		ErrorCode:    task.ErrorCode,
		ErrorMessage: task.ErrorMessage,
		ScheduledAt:  latestRFC3339(task.ScheduledAt),
		Options:      task.Options,
	}
	if task.StartedAt != nil {
		summary.StartedAt = latestRFC3339(*task.StartedAt)
	}
	if task.FinishedAt != nil {
		summary.FinishedAt = latestRFC3339(*task.FinishedAt)
	}
	return summary
}

func summarizeCursor(cursor PullCursor) PullCursorStatusSummary {
	return PullCursorStatusSummary{
		AgentID:     cursor.AgentID,
		SourceRef:   cursor.SourceRef,
		SourcePath:  cursor.SourcePath,
		LastCursor:  cursor.LastCursor,
		LastOffset:  cursor.LastOffset,
		LastBatchID: cursor.LastBatchID,
		UpdatedAt:   latestRFC3339(cursor.UpdatedAt),
	}
}

func summarizePackage(pkg PullPackage) PullPackageStatusSummary {
	summary := PullPackageStatusSummary{
		PackageID:   pkg.PackageID,
		AgentID:     pkg.AgentID,
		SourceRef:   pkg.SourceRef,
		BatchID:     pkg.BatchID,
		NextCursor:  pkg.NextCursor,
		RecordCount: pkg.RecordCount,
		FileCount:   pkg.FileCount,
		SizeBytes:   pkg.SizeBytes,
		Status:      pkg.Status,
		CreatedAt:   latestRFC3339(pkg.CreatedAt),
	}
	if pkg.AckedAt != nil {
		summary.AckedAt = latestRFC3339(*pkg.AckedAt)
	}
	if len(pkg.Files) > 0 {
		summary.PrimaryFile = pkg.Files[0].FilePath
	}
	return summary
}

func parseSourceStatusRange(raw string) (string, time.Duration) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "6h":
		return "6h", 6 * time.Hour
	case "24h":
		return "24h", 24 * time.Hour
	case "7d":
		return "7d", 7 * 24 * time.Hour
	default:
		return "1h", time.Hour
	}
}

func buildSourceStatusTrend(packages []PullPackage, window time.Duration) []PullSourceStatusTrendPoint {
	if len(packages) == 0 {
		return []PullSourceStatusTrendPoint{}
	}
	now := time.Now().UTC()
	start := now.Add(-window)
	bucketSize := timeBucketForWindow(window)
	buckets := make(map[time.Time]*PullSourceStatusTrendPoint)
	for _, pkg := range packages {
		if window > 0 && pkg.CreatedAt.Before(start) {
			continue
		}
		bucket := pkg.CreatedAt.UTC().Truncate(bucketSize)
		point, ok := buckets[bucket]
		if !ok {
			point = &PullSourceStatusTrendPoint{BucketStart: latestRFC3339(bucket)}
			buckets[bucket] = point
		}
		point.PackageCount += 1
		point.RecordCount += pkg.RecordCount
	}
	points := make([]PullSourceStatusTrendPoint, 0, len(buckets))
	cursor := start.Truncate(bucketSize)
	for !cursor.After(now) {
		if point, ok := buckets[cursor]; ok {
			points = append(points, *point)
		} else {
			points = append(points, PullSourceStatusTrendPoint{BucketStart: latestRFC3339(cursor)})
		}
		cursor = cursor.Add(bucketSize)
	}
	return points
}

func timeBucketForWindow(window time.Duration) time.Duration {
	switch {
	case window <= time.Hour:
		return 5 * time.Minute
	case window <= 6*time.Hour:
		return 15 * time.Minute
	case window <= 24*time.Hour:
		return time.Hour
	default:
		return 6 * time.Hour
	}
}

func (h *AgentInventoryHandler) generateDeploymentScript(req GenerateDeploymentScriptRequest) (GenerateDeploymentScriptResponse, error) {
	targetKind := strings.ToLower(strings.TrimSpace(req.TargetKind))
	sourceName := strings.TrimSpace(req.SourceName)
	if sourceName == "" {
		sourceName = "nexuslog-source"
	}
	sourceType := strings.ToLower(strings.TrimSpace(req.SourceType))
	if sourceType == "" {
		sourceType = "custom"
	}
	includePaths := uniqueSortedStrings(req.IncludePaths)
	excludePaths := uniqueSortedStrings(req.ExcludePaths)
	if len(includePaths) == 0 && sourceType != "syslog" {
		includePaths = []string{"/var/log/*.log"}
	}
	syslogProtocol := firstNonEmptyValue(strings.ToLower(strings.TrimSpace(req.SyslogProtocol)), "udp")
	syslogBind := firstNonEmptyValue(strings.TrimSpace(req.SyslogBind), "0.0.0.0:5514")
	version := firstNonEmptyValue(strings.TrimSpace(req.Version), "latest")
	controlPlaneBaseURL := firstNonEmptyValue(strings.TrimSpace(req.ControlPlaneBaseURL), "http://127.0.0.1:8080")
	agentBaseURL := firstNonEmptyValue(strings.TrimSpace(req.AgentBaseURL), "http://127.0.0.1:9091")
	containerImage := strings.TrimSpace(req.ContainerImage)
	if containerImage == "" {
		containerImage = "ghcr.io/<owner>/<repo>/collector-agent:" + version
	}
	releaseBaseURL := strings.TrimSpace(req.ReleaseBaseURL)
	if releaseBaseURL == "" {
		releaseBaseURL = "https://github.com/<owner>/<repo>/releases/download/" + version
	}

	credential := AgentAuthCredential{KeyID: firstNonEmptyValue(strings.TrimSpace(req.KeyRef), h.defaultAgentKeyID, "active"), Key: strings.TrimSpace(h.defaultAgentKey)}
	if strings.TrimSpace(req.KeyRef) != "" && h.authKeyStore != nil {
		if resolved, ok := h.authKeyStore.ResolveCredential(req.KeyRef); ok {
			credential = resolved
		}
	}
	if credential.KeyID == "" {
		credential.KeyID = "active"
	}
	if credential.Key == "" && h.authKeyStore != nil {
		if resolved, ok := h.authKeyStore.ResolveCredential(credential.KeyID); ok {
			credential = resolved
		}
	}

	pathRuleJSON := buildPathRuleJSON(sourceName, sourceType, includePaths)
	syslogListenersJSON := ""
	if sourceType == "syslog" {
		payload, _ := json.Marshal([]map[string]string{{
			"protocol": syslogProtocol,
			"bind":     syslogBind,
		}})
		syslogListenersJSON = string(payload)
	}

	switch targetKind {
	case "linux-systemd":
		assetURL := strings.TrimRight(releaseBaseURL, "/") + "/collector-agent-linux-amd64.tar.gz"
		script := buildLinuxSystemdScript(sourceName, version, agentBaseURL, controlPlaneBaseURL, assetURL, credential, includePaths, excludePaths, pathRuleJSON, syslogListenersJSON)
		return GenerateDeploymentScriptResponse{
			TargetKind:   targetKind,
			ScriptKind:   "bash",
			FileName:     "deploy-collector-agent.sh",
			Command:      "bash deploy-collector-agent.sh",
			Script:       script,
			AgentBaseURL: agentBaseURL,
			Notes: []string{
				"适用于大多数 Linux 主机，使用 systemd 托管 collector-agent。",
				"请先将 Linux 发布包上传到 GitHub/Gitee Release，并将页面中的发布地址配置为真实下载基址。",
				"脚本默认启用 pull-only + metrics report，便于控制台实时显示 Agent 与目录状态。",
			},
		}, nil
	case "linux-docker":
		composeYAML := buildLinuxDockerCompose(sourceName, version, containerImage, controlPlaneBaseURL, credential, includePaths, excludePaths, pathRuleJSON, syslogListenersJSON)
		command := "mkdir -p nexuslog-agent && cd nexuslog-agent && cat > docker-compose.agent.yml <<'EOF'\n" + composeYAML + "\nEOF\ndocker compose -f docker-compose.agent.yml up -d"
		return GenerateDeploymentScriptResponse{
			TargetKind:   targetKind,
			ScriptKind:   "bash",
			FileName:     "docker-compose.agent.yml",
			Command:      command,
			Script:       composeYAML,
			AgentBaseURL: agentBaseURL,
			Notes: []string{
				"需要提前将 collector-agent 镜像发布到可访问的仓库。",
				"如果采集目录不在 /var/log 下，请补充 volume 挂载后再启动。",
			},
		}, nil
	case "windows-startup-task", "windows-powershell":
		assetURL := strings.TrimRight(releaseBaseURL, "/") + "/collector-agent-windows-amd64.zip"
		ps1 := buildWindowsStartupScript(sourceName, version, assetURL, controlPlaneBaseURL, credential, includePaths, excludePaths, pathRuleJSON)
		return GenerateDeploymentScriptResponse{
			TargetKind:   targetKind,
			ScriptKind:   "powershell",
			FileName:     "deploy-collector-agent.ps1",
			Command:      "powershell -ExecutionPolicy Bypass -File .\\deploy-collector-agent.ps1",
			Script:       ps1,
			AgentBaseURL: agentBaseURL,
			Notes: []string{
				"Windows 默认生成“开机自启动计划任务”版本，避免依赖额外服务包装器。",
				"当前仓库需要在 CI 中额外产出 windows 发布包后，此脚本才能直接落地。",
			},
		}, nil
	case "network-syslog-udp", "network-syslog-tcp":
		parsed, err := url.Parse(agentBaseURL)
		if err != nil {
			return GenerateDeploymentScriptResponse{}, fmt.Errorf("agent_base_url is invalid")
		}
		host := parsed.Hostname()
		if host == "" {
			host = "collector-host"
		}
		listenerAddress := host + ":" + portFromBind(syslogBind)
		protocol := "UDP"
		if targetKind == "network-syslog-tcp" {
			protocol = "TCP"
		}
		script := fmt.Sprintf("# 将以下目标写入网络设备的 Syslog Server 配置\n# 协议: %s\n# 目标地址: %s\n# 建议 source name: %s\n# collector-agent 监听: %s\n", protocol, listenerAddress, sourceName, syslogBind)
		return GenerateDeploymentScriptResponse{
			TargetKind:      targetKind,
			ScriptKind:      "network-cli",
			FileName:        "network-syslog-config.txt",
			Command:         script,
			Script:          script,
			ListenerAddress: listenerAddress,
			AgentBaseURL:    agentBaseURL,
			Notes: []string{
				"请先在 Linux collector-agent 主机上启用 Syslog 监听，再把目标地址/端口下发到网络设备。",
				"网络设备厂商命令格式不同，页面这里给出的是通用 Syslog 目标参数。",
			},
		}, nil
	default:
		return GenerateDeploymentScriptResponse{}, fmt.Errorf("target_kind must be one of linux-systemd|linux-docker|windows-startup-task|network-syslog-udp|network-syslog-tcp")
	}
}

func buildLinuxSystemdScript(sourceName, version, agentBaseURL, controlPlaneBaseURL, assetURL string, credential AgentAuthCredential, includePaths, excludePaths []string, pathRuleJSON, syslogListenersJSON string) string {
	lines := []string{
		"#!/usr/bin/env bash",
		"set -euo pipefail",
		"",
		"ASSET_URL=" + shellQuote(assetURL),
		"AGENT_ID=" + shellQuote(sourceName+"-agent"),
		"CONTROL_PLANE_BASE_URL=" + shellQuote(controlPlaneBaseURL),
		"AGENT_API_KEY_ACTIVE_ID=" + shellQuote(firstNonEmptyValue(credential.KeyID, "active")),
		"AGENT_API_KEY_ACTIVE=" + shellQuote(credential.Key),
		"COLLECTOR_INCLUDE_PATHS=" + shellQuote(strings.Join(includePaths, ",")),
		"COLLECTOR_EXCLUDE_PATHS=" + shellQuote(strings.Join(excludePaths, ",")),
		"COLLECTOR_PATH_LABEL_RULES=" + shellQuote(pathRuleJSON),
		"COLLECTOR_SYSLOG_LISTENERS_JSON=" + shellQuote(syslogListenersJSON),
		"INSTALL_ROOT=/opt/nexuslog/collector-agent",
		"STATE_ROOT=/var/lib/collector-agent",
		"ENV_FILE=/etc/nexuslog/collector-agent.env",
		"SERVICE_FILE=/etc/systemd/system/collector-agent.service",
		"TMP_DIR=$(mktemp -d)",
		"trap 'rm -rf \"${TMP_DIR}\"' EXIT",
		"sudo useradd --system --no-create-home --shell /usr/sbin/nologin collector >/dev/null 2>&1 || true",
		"sudo mkdir -p \"${INSTALL_ROOT}\" /etc/nexuslog \"${STATE_ROOT}/checkpoints\" \"${STATE_ROOT}/cache\"",
		"curl -fsSL \"${ASSET_URL}\" -o \"${TMP_DIR}/collector-agent.tgz\"",
		"tar -xzf \"${TMP_DIR}/collector-agent.tgz\" -C \"${TMP_DIR}\"",
		"BIN_PATH=$(find \"${TMP_DIR}\" -type f -name collector-agent | head -n 1)",
		"test -n \"${BIN_PATH}\"",
		"sudo install -m 0755 \"${BIN_PATH}\" /usr/local/bin/collector-agent",
		"cat <<EOF | sudo tee \"${ENV_FILE}\" >/dev/null",
		"HTTP_PORT=9091",
		"AGENT_ID=${AGENT_ID}",
		"AGENT_VERSION=" + shellQuote(version),
		"AGENT_API_KEY_ACTIVE_ID=${AGENT_API_KEY_ACTIVE_ID}",
		"AGENT_API_KEY_ACTIVE=${AGENT_API_KEY_ACTIVE}",
		"CHECKPOINT_DIR=${STATE_ROOT}/checkpoints",
		"CACHE_DIR=${STATE_ROOT}/cache",
		"COLLECTOR_INCLUDE_PATHS=${COLLECTOR_INCLUDE_PATHS}",
		"COLLECTOR_EXCLUDE_PATHS=${COLLECTOR_EXCLUDE_PATHS}",
		"COLLECTOR_PATH_LABEL_RULES=${COLLECTOR_PATH_LABEL_RULES}",
		"COLLECTOR_SYSLOG_LISTENERS_JSON=${COLLECTOR_SYSLOG_LISTENERS_JSON}",
		"DELIVERY_MODE=pull",
		"ENABLE_KAFKA_PIPELINE=false",
		"LEGACY_LOG_PIPELINE_ENABLED=false",
		"CONTROL_PLANE_BASE_URL=${CONTROL_PLANE_BASE_URL}",
		"AGENT_METRICS_REPORT_ENABLED=true",
		"AGENT_METRICS_REPORT_INTERVAL=30s",
		"AGENT_METRICS_REPORT_TIMEOUT=10s",
		"EOF",
		"cat <<'EOF' | sudo tee \"${SERVICE_FILE}\" >/dev/null",
		"[Unit]",
		"Description=NexusLog Collector Agent",
		"After=network-online.target",
		"Wants=network-online.target",
		"",
		"[Service]",
		"Type=simple",
		"User=root",
		"EnvironmentFile=/etc/nexuslog/collector-agent.env",
		"ExecStart=/usr/local/bin/collector-agent",
		"Restart=always",
		"RestartSec=5",
		"LimitNOFILE=65535",
		"",
		"[Install]",
		"WantedBy=multi-user.target",
		"EOF",
		"sudo systemctl daemon-reload",
		"sudo systemctl enable --now collector-agent",
		"sudo systemctl status collector-agent --no-pager || true",
		"curl -fsSL http://127.0.0.1:9091/healthz || true",
	}
	if strings.TrimSpace(syslogListenersJSON) == "" {
		lines = append(lines, "echo 'collector-agent deployed; current agent base URL: "+strings.TrimSpace(agentBaseURL)+"'")
	} else {
		lines = append(lines, "echo 'collector-agent deployed with syslog listener enabled: "+strings.TrimSpace(syslogListenersJSON)+"'")
	}
	return strings.Join(lines, "\n")
}

func buildLinuxDockerCompose(sourceName, version, containerImage, controlPlaneBaseURL string, credential AgentAuthCredential, includePaths, excludePaths []string, pathRuleJSON, syslogListenersJSON string) string {
	mountRoots := mountRootsFromPaths(includePaths)
	if len(mountRoots) == 0 {
		mountRoots = []string{"/var/log"}
	}
	lines := []string{
		"services:",
		"  collector-agent:",
		"    image: " + containerImage,
		"    container_name: nexuslog-collector-agent",
		"    restart: unless-stopped",
		"    ports:",
		"      - \"9091:9091\"",
		"    environment:",
		"      HTTP_PORT: \"9091\"",
		"      AGENT_ID: \"" + sourceName + "-agent\"",
		"      AGENT_VERSION: \"" + escapeYAMLString(version) + "\"",
		"      AGENT_API_KEY_ACTIVE_ID: \"" + firstNonEmptyValue(credential.KeyID, "active") + "\"",
		"      AGENT_API_KEY_ACTIVE: \"" + escapeYAMLString(credential.Key) + "\"",
		"      COLLECTOR_INCLUDE_PATHS: \"" + escapeYAMLString(strings.Join(includePaths, ",")) + "\"",
		"      COLLECTOR_EXCLUDE_PATHS: \"" + escapeYAMLString(strings.Join(excludePaths, ",")) + "\"",
		"      COLLECTOR_PATH_LABEL_RULES: '" + escapeSingleQuotedYAML(pathRuleJSON) + "'",
		"      COLLECTOR_SYSLOG_LISTENERS_JSON: '" + escapeSingleQuotedYAML(syslogListenersJSON) + "'",
		"      DELIVERY_MODE: \"pull\"",
		"      ENABLE_KAFKA_PIPELINE: \"false\"",
		"      LEGACY_LOG_PIPELINE_ENABLED: \"false\"",
		"      CONTROL_PLANE_BASE_URL: \"" + escapeYAMLString(controlPlaneBaseURL) + "\"",
		"      AGENT_METRICS_REPORT_ENABLED: \"true\"",
		"      AGENT_METRICS_REPORT_INTERVAL: \"30s\"",
		"      AGENT_METRICS_REPORT_TIMEOUT: \"10s\"",
		"      CHECKPOINT_DIR: \"/var/lib/collector-agent/checkpoints\"",
		"      CACHE_DIR: \"/var/lib/collector-agent/cache\"",
		"    volumes:",
		"      - ./state/checkpoints:/var/lib/collector-agent/checkpoints",
		"      - ./state/cache:/var/lib/collector-agent/cache",
	}
	for _, root := range mountRoots {
		lines = append(lines, "      - "+root+":"+root+":ro")
	}
	lines = append(lines,
		"    healthcheck:",
		"      test: [\"CMD\", \"wget\", \"-q\", \"-O\", \"-\", \"http://127.0.0.1:9091/healthz\"]",
		"      interval: 30s",
		"      timeout: 5s",
		"      retries: 3",
		"      start_period: 10s",
	)
	return strings.Join(lines, "\n")
}

func buildWindowsStartupScript(sourceName, version, assetURL, controlPlaneBaseURL string, credential AgentAuthCredential, includePaths, excludePaths []string, pathRuleJSON string) string {
	return strings.Join([]string{
		"$ErrorActionPreference = 'Stop'",
		"$InstallRoot = 'C:\\Program Files\\NexusLog\\collector-agent'",
		"$StateRoot = 'C:\\ProgramData\\NexusLog\\collector-agent'",
		"$ZipPath = Join-Path $env:TEMP 'collector-agent.zip'",
		"$StartScript = Join-Path $InstallRoot 'start-collector-agent.ps1'",
		"New-Item -ItemType Directory -Force -Path $InstallRoot, $StateRoot, (Join-Path $StateRoot 'checkpoints'), (Join-Path $StateRoot 'cache') | Out-Null",
		"Invoke-WebRequest -Uri '" + psQuote(assetURL) + "' -OutFile $ZipPath",
		"Expand-Archive -Path $ZipPath -DestinationPath $InstallRoot -Force",
		"$AgentExe = Get-ChildItem -Path $InstallRoot -Recurse -Filter 'collector-agent.exe' | Select-Object -First 1",
		"if (-not $AgentExe) { throw 'collector-agent.exe not found in archive' }",
		"@'",
		"$env:HTTP_PORT = '9091'",
		"$env:AGENT_ID = '" + sourceName + "-agent'",
		"$env:AGENT_VERSION = '" + strings.ReplaceAll(version, "'", "''") + "'",
		"$env:AGENT_API_KEY_ACTIVE_ID = '" + firstNonEmptyValue(credential.KeyID, "active") + "'",
		"$env:AGENT_API_KEY_ACTIVE = '" + strings.ReplaceAll(credential.Key, "'", "''") + "'",
		"$env:CHECKPOINT_DIR = 'C:\\ProgramData\\NexusLog\\collector-agent\\checkpoints'",
		"$env:CACHE_DIR = 'C:\\ProgramData\\NexusLog\\collector-agent\\cache'",
		"$env:COLLECTOR_INCLUDE_PATHS = '" + strings.ReplaceAll(strings.Join(includePaths, ","), "'", "''") + "'",
		"$env:COLLECTOR_EXCLUDE_PATHS = '" + strings.ReplaceAll(strings.Join(excludePaths, ","), "'", "''") + "'",
		"$env:COLLECTOR_PATH_LABEL_RULES = '" + strings.ReplaceAll(pathRuleJSON, "'", "''") + "'",
		"$env:DELIVERY_MODE = 'pull'",
		"$env:ENABLE_KAFKA_PIPELINE = 'false'",
		"$env:LEGACY_LOG_PIPELINE_ENABLED = 'false'",
		"$env:CONTROL_PLANE_BASE_URL = '" + strings.ReplaceAll(controlPlaneBaseURL, "'", "''") + "'",
		"$env:AGENT_METRICS_REPORT_ENABLED = 'true'",
		"$env:AGENT_METRICS_REPORT_INTERVAL = '30s'",
		"& $AgentExe.FullName",
		"'@ | Set-Content -Path $StartScript -Encoding UTF8",
		"$Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-ExecutionPolicy Bypass -File `\"' + $StartScript + '`\"')",
		"$Trigger = New-ScheduledTaskTrigger -AtStartup",
		"$Principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -RunLevel Highest",
		"Register-ScheduledTask -TaskName 'NexusLogCollectorAgent' -Action $Action -Trigger $Trigger -Principal $Principal -Force | Out-Null",
		"Start-ScheduledTask -TaskName 'NexusLogCollectorAgent'",
		"Write-Host 'collector-agent startup task deployed successfully'",
	}, "\n")
}

func buildPathRuleJSON(sourceName, sourceType string, includePaths []string) string {
	rules := make([]map[string]any, 0, len(includePaths))
	for _, path := range includePaths {
		trimmed := strings.TrimSpace(path)
		if trimmed == "" {
			continue
		}
		rules = append(rules, map[string]any{
			"pattern": trimmed,
			"labels": map[string]string{
				"service":     sourceName,
				"source_type": firstNonEmptyValue(sourceType, "custom"),
			},
		})
	}
	if len(rules) == 0 {
		return "[]"
	}
	raw, err := json.Marshal(rules)
	if err != nil {
		return "[]"
	}
	return string(raw)
}

func mountRootsFromPaths(paths []string) []string {
	roots := make([]string, 0, len(paths))
	for _, path := range paths {
		trimmed := strings.TrimSpace(path)
		if trimmed == "" || !strings.HasPrefix(trimmed, "/") {
			continue
		}
		root := trimmed
		if idx := strings.IndexAny(root, "*?["); idx > 0 {
			root = root[:idx]
		}
		root = strings.TrimRight(root, "/")
		if slash := strings.LastIndex(root, "/"); slash > 0 {
			root = root[:slash]
		}
		if root == "" {
			root = "/var/log"
		}
		roots = append(roots, root)
	}
	return uniqueSortedStrings(roots)
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

func psQuote(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}

func escapeYAMLString(value string) string {
	return strings.ReplaceAll(value, "\"", "\\\"")
}

func escapeSingleQuotedYAML(value string) string {
	return strings.ReplaceAll(value, "'", "''")
}

func portFromBind(bind string) string {
	trimmed := strings.TrimSpace(bind)
	if trimmed == "" {
		return "5514"
	}
	if idx := strings.LastIndex(trimmed, ":"); idx >= 0 && idx+1 < len(trimmed) {
		return trimmed[idx+1:]
	}
	return trimmed
}

func hostFromBaseURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return ""
	}
	return strings.TrimSpace(parsed.Hostname())
}

func splitCSVValues(raw string) []string {
	parts := strings.Split(strings.TrimSpace(raw), ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		items = append(items, trimmed)
	}
	return items
}

func uniqueSortedStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	items := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		items = append(items, trimmed)
	}
	sort.Strings(items)
	return items
}

func firstNonEmptyValue(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func latestRFC3339(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func parseRFC3339OrZero(raw string) time.Time {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return time.Time{}
	}
	parsed, err := time.Parse(time.RFC3339, trimmed)
	if err != nil {
		return time.Time{}
	}
	return parsed.UTC()
}

func maxIntValue(left, right int) int {
	if left > right {
		return left
	}
	return right
}
