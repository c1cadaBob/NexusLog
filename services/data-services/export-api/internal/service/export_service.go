// Package service 提供 export-api 的业务逻辑层
package service

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nexuslog/data-services/export-api/internal/repository"
)

const (
	exportDir         = "/tmp/nexuslog-exports"
	maxExportRecords  = 100000
	exportRetentionDays = 7
)

// CreateExportJobRequest 创建导出任务请求
type CreateExportJobRequest struct {
	QueryParams map[string]any `json:"query_params"`
	Format      string         `json:"format"`
}

// ExportJobItem 导出任务项
type ExportJobItem struct {
	ID           string  `json:"id"`
	Format       string  `json:"format"`
	Status       string  `json:"status"`
	TotalRecords *int    `json:"total_records,omitempty"`
	FilePath     *string `json:"file_path,omitempty"`
	FileSizeBytes *int64 `json:"file_size_bytes,omitempty"`
	ErrorMessage *string `json:"error_message,omitempty"`
	CreatedAt    string  `json:"created_at"`
	CompletedAt  *string `json:"completed_at,omitempty"`
	ExpiresAt    *string `json:"expires_at,omitempty"`
}

// ListExportJobsResult 导出任务列表结果
type ListExportJobsResult struct {
	Items    []ExportJobItem
	Total    int64
	Page     int
	PageSize int
}

// ExportService 封装导出业务逻辑
type ExportService struct {
	exportRepo *repository.ExportRepository
	esRepo     *repository.ESExportRepository
	cleanupOnce sync.Once
}

// NewExportService 创建导出服务实例
func NewExportService(exportRepo *repository.ExportRepository, esRepo *repository.ESExportRepository) *ExportService {
	return &ExportService{
		exportRepo: exportRepo,
		esRepo:     esRepo,
	}
}

// CreateExportJob 创建异步导出任务
func (s *ExportService) CreateExportJob(ctx context.Context, tenantID, userID string, req CreateExportJobRequest) (string, error) {
	if s == nil || s.exportRepo == nil || !s.exportRepo.IsConfigured() {
		return "", fmt.Errorf("export service is not configured")
	}
	format := strings.ToLower(strings.TrimSpace(req.Format))
	if format == "" {
		format = "csv"
	}
	if format != "csv" && format != "json" {
		return "", fmt.Errorf("invalid format: must be csv or json")
	}
	queryParams := req.QueryParams
	if queryParams == nil {
		queryParams = map[string]any{}
	}

	jobID, err := s.exportRepo.CreateJob(ctx, repository.CreateJobInput{
		TenantID:    tenantID,
		QueryParams: queryParams,
		Format:      format,
		CreatedBy:   userID,
	})
	if err != nil {
		return "", err
	}

	// 启动异步导出
	go s.runExportJob(context.Background(), jobID, tenantID, queryParams, format)
	return jobID, nil
}

func (s *ExportService) runExportJob(ctx context.Context, jobID, tenantID string, queryParams map[string]any, format string) {
	// 1. 更新为 running
	_ = s.exportRepo.UpdateJobStatus(ctx, jobID, "running", nil, nil, nil, nil)

	// 2. 确保导出目录存在
	if err := os.MkdirAll(exportDir, 0755); err != nil {
		msg := err.Error()
		_ = s.exportRepo.UpdateJobStatus(ctx, jobID, "failed", nil, nil, nil, &msg)
		return
	}
	fileName := fmt.Sprintf("export-%s-%d.%s", jobID, time.Now().Unix(), format)
	filePath := filepath.Join(exportDir, fileName)

	exportParams := parseQueryParams(queryParams)
	totalRecords := 0
	var writeErr error

	if format == "csv" {
		totalRecords, writeErr = s.exportToCSV(ctx, filePath, exportParams)
	} else {
		totalRecords, writeErr = s.exportToJSON(ctx, filePath, exportParams)
	}

	if writeErr != nil {
		_ = os.Remove(filePath)
		msg := writeErr.Error()
		_ = s.exportRepo.UpdateJobStatus(ctx, jobID, "failed", nil, nil, nil, &msg)
		return
	}

	// 3. 获取文件大小
	info, err := os.Stat(filePath)
	var fileSize int64
	if err == nil {
		fileSize = info.Size()
	}

	// 4. 更新为 completed
	_ = s.exportRepo.UpdateJobStatus(ctx, jobID, "completed", &filePath, &totalRecords, &fileSize, nil)
	log.Printf("[export-api] job %s completed: %d records, %d bytes", jobID, totalRecords, fileSize)
}

func parseQueryParams(m map[string]any) repository.ExportQueryParams {
	var p repository.ExportQueryParams
	if m == nil {
		return p
	}
	if v, ok := m["keywords"]; ok && v != nil {
		p.Keywords = strings.TrimSpace(fmt.Sprintf("%v", v))
	}
	if tr, ok := m["time_range"].(map[string]any); ok {
		if from, ok := tr["from"]; ok {
			p.TimeRangeFrom = strings.TrimSpace(fmt.Sprintf("%v", from))
		}
		if to, ok := tr["to"]; ok {
			p.TimeRangeTo = strings.TrimSpace(fmt.Sprintf("%v", to))
		}
	}
	if v, ok := m["time_range_from"]; ok && v != nil {
		p.TimeRangeFrom = strings.TrimSpace(fmt.Sprintf("%v", v))
	}
	if v, ok := m["time_range_to"]; ok && v != nil {
		p.TimeRangeTo = strings.TrimSpace(fmt.Sprintf("%v", v))
	}
	if f, ok := m["filters"].(map[string]any); ok {
		p.Filters = f
	}
	if sortArr, ok := m["sort"].([]any); ok {
		for _, item := range sortArr {
			if m2, ok := item.(map[string]any); ok {
				field, _ := m2["field"].(string)
				order, _ := m2["order"].(string)
				p.Sort = append(p.Sort, struct {
					Field string `json:"field"`
					Order string `json:"order"`
				}{Field: field, Order: order})
			}
		}
	}
	return p
}

func (s *ExportService) exportToCSV(ctx context.Context, filePath string, params repository.ExportQueryParams) (int, error) {
	f, err := os.Create(filePath)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	w := csv.NewWriter(f)
	defer w.Flush()

	total := 0
	var headers []string
	err = s.esRepo.ScrollSearch(ctx, params, maxExportRecords, func(hits []repository.LogHit) error {
		for _, hit := range hits {
			if headers == nil {
				headers = extractCSVHeaders(hit.Source)
				if err := w.Write(headers); err != nil {
					return err
				}
			}
			row := sourceToCSVRow(hit.Source, headers)
			if err := w.Write(row); err != nil {
				return err
			}
			total++
		}
		return nil
	})
	if err != nil {
		return total, err
	}
	return total, nil
}

func (s *ExportService) exportToJSON(ctx context.Context, filePath string, params repository.ExportQueryParams) (int, error) {
	f, err := os.Create(filePath)
	if err != nil {
		return 0, err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	total := 0
	err = s.esRepo.ScrollSearch(ctx, params, maxExportRecords, func(hits []repository.LogHit) error {
		for _, hit := range hits {
			if err := enc.Encode(hit.Source); err != nil {
				return err
			}
			total++
		}
		return nil
	})
	if err != nil {
		return total, err
	}
	return total, nil
}

func extractCSVHeaders(source map[string]any) []string {
	priority := []string{"@timestamp", "timestamp", "message", "level", "service", "raw_log"}
	seen := make(map[string]bool)
	headers := make([]string, 0)
	for _, p := range priority {
		if _, ok := source[p]; ok {
			headers = append(headers, p)
			seen[p] = true
		}
	}
	for k := range source {
		if !seen[k] {
			headers = append(headers, k)
		}
	}
	return headers
}

func sourceToCSVRow(source map[string]any, headers []string) []string {
	row := make([]string, len(headers))
	for i, h := range headers {
		if v, ok := source[h]; ok && v != nil {
			row[i] = strings.ReplaceAll(fmt.Sprintf("%v", v), "\n", " ")
		}
	}
	return row
}

// GetJob 获取导出任务详情
func (s *ExportService) GetJob(ctx context.Context, tenantID, jobID string) (*ExportJobItem, error) {
	if s == nil || s.exportRepo == nil {
		return nil, fmt.Errorf("export service is not configured")
	}
	job, err := s.exportRepo.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return nil, err
	}
	return jobToItem(job), nil
}

// ListJobs 分页列出导出任务
func (s *ExportService) ListJobs(ctx context.Context, tenantID string, page, pageSize int) (ListExportJobsResult, error) {
	if s == nil || s.exportRepo == nil {
		return ListExportJobsResult{}, fmt.Errorf("export service is not configured")
	}
	items, total, err := s.exportRepo.ListJobs(ctx, tenantID, page, pageSize)
	if err != nil {
		return ListExportJobsResult{}, err
	}
	result := ListExportJobsResult{
		Items:    make([]ExportJobItem, 0, len(items)),
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}
	for _, j := range items {
		result.Items = append(result.Items, *jobToItem(&j))
	}
	return result, nil
}

// GetDownloadPath 获取可下载文件路径，仅当任务完成且文件存在时返回
func (s *ExportService) GetDownloadPath(ctx context.Context, tenantID, jobID string) (string, string, error) {
	if s == nil || s.exportRepo == nil {
		return "", "", fmt.Errorf("export service is not configured")
	}
	job, err := s.exportRepo.GetJob(ctx, tenantID, jobID)
	if err != nil {
		return "", "", err
	}
	if job.Status != "completed" {
		return "", "", fmt.Errorf("job not completed: status=%s", job.Status)
	}
	if job.FilePath == nil || *job.FilePath == "" {
		return "", "", fmt.Errorf("export file not available")
	}
	if _, err := os.Stat(*job.FilePath); err != nil {
		return "", "", fmt.Errorf("export file not found")
	}
	contentType := "text/csv"
	if job.Format == "json" {
		contentType = "application/json"
	}
	return *job.FilePath, contentType, nil
}

// StartCleanupLoop 启动后台清理过期导出文件
func (s *ExportService) StartCleanupLoop() {
	s.cleanupOnce.Do(func() {
		go func() {
			ticker := time.NewTicker(24 * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				s.cleanupExpiredExports(context.Background())
			}
		}()
	})
}

func (s *ExportService) cleanupExpiredExports(ctx context.Context) {
	if s == nil || s.exportRepo == nil {
		return
	}
	// 清理过期文件
	cutoff := time.Now().Add(-exportRetentionDays * 24 * time.Hour)
	entries, err := os.ReadDir(exportDir)
	if err != nil {
		log.Printf("[export-api] cleanup read dir failed: %v", err)
		return
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			path := filepath.Join(exportDir, e.Name())
			if err := os.Remove(path); err != nil {
				log.Printf("[export-api] cleanup remove %s failed: %v", path, err)
			}
		}
	}
	// 清理 DB 中过期记录
	n, err := s.exportRepo.CleanupExpiredJobs(ctx)
	if err != nil {
		log.Printf("[export-api] cleanup db failed: %v", err)
		return
	}
	if n > 0 {
		log.Printf("[export-api] cleanup removed %d expired job records", n)
	}
}

func jobToItem(job *repository.ExportJob) *ExportJobItem {
	item := &ExportJobItem{
		ID:        job.ID,
		Format:    job.Format,
		Status:    job.Status,
		CreatedAt: job.CreatedAt.UTC().Format(time.RFC3339),
	}
	item.TotalRecords = job.TotalRecords
	item.FilePath = job.FilePath
	item.FileSizeBytes = job.FileSizeBytes
	item.ErrorMessage = job.ErrorMessage
	if job.CompletedAt != nil {
		s := job.CompletedAt.UTC().Format(time.RFC3339)
		item.CompletedAt = &s
	}
	if job.ExpiresAt != nil {
		s := job.ExpiresAt.UTC().Format(time.RFC3339)
		item.ExpiresAt = &s
	}
	return item
}
