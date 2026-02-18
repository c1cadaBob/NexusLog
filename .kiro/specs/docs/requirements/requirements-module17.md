# 模块十七：备份系统增强

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块十七：备份系统增强  
> **需求编号**: 

---

**模块概述**: 

对现有备份系统进行全面增强，提供增量备份优化、自定义路径选择、备份下载导出、自定义命名和备注、空间管理等功能，提升备份系统的易用性和灵活性。

**模块技术栈**:
- 后端框架：Go 1.21+ (Gin)
- 存储引擎：Elasticsearch Snapshot API
- 文件系统：本地文件系统 / MinIO / S3
- 压缩算法：tar.gz (gzip 压缩)
- 数据库：PostgreSQL (元数据存储)
- 前端框架：React 18 + TypeScript + Ant Design

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                备份系统增强模块整体架构                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            前端层（React + Ant Design）                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │ │
│  │  │ 备份创建对话框│    │ 备份列表页面  │    │ 空间管理面板  │    │ 导入导出界面  │       │ │
│  │  │ • 名称/备注  │    │ • 筛选/排序  │    │ • 空间统计   │    │ • 上传/下载  │       │ │
│  │  │ • 路径选择   │    │ • 批量操作   │    │ • 清理策略   │    │ • 进度显示   │       │ │
│  │  │ • 索引模式   │    │ • 下载按钮   │    │ • 告警设置   │    │ • 断点续传   │       │ │
│  │  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘       │ │
│  └─────────┼────────────────────┼────────────────────┼────────────────────┼─────────────┘ │
│            │                    │                    │                    │               │
│            ▼                    ▼                    ▼                    ▼               │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            API 层（RESTful API）                                       │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │  POST   /api/v1/backups              创建备份（支持自定义配置）              │    │ │
│  │  │  GET    /api/v1/backups              列出备份（支持筛选/排序）                │    │ │
│  │  │  GET    /api/v1/backups/{id}         获取备份详情                            │    │ │
│  │  │  PUT    /api/v1/backups/{id}         更新备份（名称/备注）                   │    │ │
│  │  │  DELETE /api/v1/backups/{id}         删除备份                                │    │ │
│  │  │  GET    /api/v1/backups/{id}/download 下载备份包                             │    │ │
│  │  │  POST   /api/v1/backups/import      导入备份包                              │    │ │
│  │  │  GET    /api/v1/backups/stats       获取备份统计                            │    │ │
│  │  │  GET    /api/v1/backups/paths       获取可用路径列表                        │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            业务逻辑层（Backup Manager）                                │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        增量备份管理器                                         │    │ │
│  │  │  • 基于时间戳的增量备份（只备份新增日志）                                    │    │ │
│  │  │  • 依赖关系追溯（BasedOn 字段）                                              │    │ │
│  │  │  • 恢复时的依赖检查                                                          │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        路径管理器                                             │    │ │
│  │  │  • 自定义路径验证（存在性/权限/空间）                                        │    │ │
│  │  │  • 默认路径管理                                                              │    │ │
│  │  │  • 路径创建（如果不存在）                                                    │    │ │
│  │  │  • 磁盘空间监控                                                              │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        导出/导入管理器                                        │    │ │
│  │  │  • 备份打包（tar.gz 格式）                                                   │    │ │
│  │  │  • 元数据导出（JSON 格式）                                                   │    │ │
│  │  │  • 分块下载支持（>100MB）                                                    │    │ │
│  │  │  • 断点续传                                                                  │    │ │
│  │  │  • 校验和验证                                                                │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        命名与元数据管理器                                     │    │ │
│  │  │  • 自定义名称验证（格式/唯一性）                                             │    │ │
│  │  │  • 默认名称生成                                                              │    │ │
│  │  │  • 备注管理（最多 500 字符）                                                 │    │ │
│  │  │  • 修改历史记录                                                              │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  │  ┌──────────────────────────────────────────────────────────────────────────────┐    │ │
│  │  │                        空间管理器                                             │    │ │
│  │  │  • 总空间统计                                                                │    │ │
│  │  │  • 路径级空间监控                                                            │    │ │
│  │  │  • 自动清理策略                                                              │    │ │
│  │  │  • 空间告警                                                                  │    │ │
│  │  └──────────────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            存储层                                                      │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Elasticsearch│───▶│ 文件系统     │───▶│ PostgreSQL   │                           │ │
│  │  │ Snapshot API │    │ (备份数据)   │    │ (元数据)     │                           │ │
│  │  │ (快照管理)   │    │ /var/lib/... │    │ 名称/备注/路径│                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **前端层**: 提供用户友好的界面，支持备份创建配置、列表管理、空间监控、导入导出等功能
2. **API 层**: RESTful API 接口，处理所有备份相关的 HTTP 请求
3. **业务逻辑层**: 核心业务逻辑，包括增量备份、路径管理、导出导入、命名管理、空间管理
4. **存储层**: Elasticsearch 快照 API + 文件系统 + PostgreSQL 元数据存储

**数据流向**:

```
用户操作 → 前端界面 → API 请求 → 业务逻辑处理 → Elasticsearch/文件系统/数据库 → 响应返回
         ↑                                                                      ↓
         └──────────────────── 实时反馈（进度/状态）─────────────────────────────┘
```

**需求列表**:
- 需求 17-1：增量备份改进 [MVP]
- 需求 17-2：自定义备份路径 [MVP]
- 需求 17-3：备份下载功能 [MVP]
- 需求 17-4：自定义备份名称和备注 [MVP]
- 需求 17-5：创建备份对话框 [MVP]
- 需求 17-6：备份列表增强 [Phase 2]
- 需求 17-7：错误处理和用户反馈 [MVP]
- 需求 17-8：备份导入功能 [Phase 2]
- 需求 17-9：备份空间管理 [Phase 2]

---

## 需求 17-1：增量备份改进 [MVP]

**用户故事**: 

作为用户，我希望增量备份只备份自上次备份以来新增的日志内容，这样可以节省存储空间和备份时间。

**验收标准**:

1. WHEN 用户创建增量备份时，THE Backup_Manager SHALL 只备份自上次备份以来新增的日志数据
2. THE Backup_Manager SHALL 基于时间戳过滤，只包含上次备份结束时间之后的日志
3. THE Backup_Manager SHALL 记录增量备份基于哪个备份创建（BasedOn 字段），用于恢复时的依赖追溯
4. WHEN 恢复增量备份时，THE System SHALL 提示用户需要先恢复基准备份
5. IF 没有可用的基准备份，THEN 创建增量备份时 THE System SHALL 提示用户先创建全量备份
6. THE 增量备份的大小 SHALL 明显小于全量备份（仅包含增量数据）

**实现方向**:

**实现方式**:

```go
// 增量备份管理器
type IncrementalBackupManager struct {
    esClient    *elasticsearch.Client
    metadataDB  *sql.DB
    config      atomic.Value
}

// 增量备份元数据
type IncrementalBackupMetadata struct {
    ID              string    `json:"id"`
    Name            string    `json:"name"`
    Type            string    `json:"type"` // full/incremental
    BasedOn         string    `json:"based_on"` // 基准备份ID
    StartTime       time.Time `json:"start_time"`
    EndTime         time.Time `json:"end_time"`
    IndexPattern    string    `json:"index_pattern"`
    DocumentCount   int64     `json:"document_count"`
    SizeBytes       int64     `json:"size_bytes"`
}

// 创建增量备份
func (m *IncrementalBackupManager) CreateIncrementalBackup(indexPattern string) (*IncrementalBackupMetadata, error) {
    // 1. 查找最近的全量备份作为基准
    baseBackup, err := m.findLatestFullBackup(indexPattern)
    if err != nil {
        return nil, fmt.Errorf("未找到基准备份，请先创建全量备份: %w", err)
    }
    
    // 2. 计算增量时间范围（从上次备份结束时间到现在）
    startTime := baseBackup.EndTime
    endTime := time.Now()
    
    // 3. 构建时间范围查询
    query := map[string]interface{}{
        "query": map[string]interface{}{
            "range": map[string]interface{}{
                "@timestamp": map[string]interface{}{
                    "gte": startTime.Format(time.RFC3339),
                    "lt":  endTime.Format(time.RFC3339),
                },
            },
        },
    }
    
    // 4. 创建增量快照（只包含增量数据）
    snapshotName := fmt.Sprintf("incremental_%s_%d", indexPattern, time.Now().Unix())
    
    req := esapi.SnapshotCreateRequest{
        Repository: m.getRepository(),
        Snapshot:   snapshotName,
        Body: esutil.NewJSONReader(map[string]interface{}{
            "indices":           indexPattern,
            "ignore_unavailable": true,
            "include_global_state": false,
            "partial": false,
            "metadata": map[string]interface{}{
                "type":       "incremental",
                "based_on":   baseBackup.ID,
                "start_time": startTime.Format(time.RFC3339),
                "end_time":   endTime.Format(time.RFC3339),
            },
        }),
    }
    
    res, err := req.Do(context.Background(), m.esClient)
    if err != nil {
        return nil, fmt.Errorf("创建增量快照失败: %w", err)
    }
    defer res.Body.Close()
    
    if res.IsError() {
        return nil, fmt.Errorf("ES返回错误: %s", res.String())
    }
    
    // 5. 保存增量备份元数据
    metadata := &IncrementalBackupMetadata{
        ID:           snapshotName,
        Name:         snapshotName,
        Type:         "incremental",
        BasedOn:      baseBackup.ID,
        StartTime:    startTime,
        EndTime:      endTime,
        IndexPattern: indexPattern,
    }
    
    if err := m.saveMetadata(metadata); err != nil {
        return nil, fmt.Errorf("保存元数据失败: %w", err)
    }
    
    // 6. 等待快照完成并更新统计信息
    go m.waitAndUpdateStats(snapshotName, metadata)
    
    return metadata, nil
}

// 查找最近的全量备份
func (m *IncrementalBackupManager) findLatestFullBackup(indexPattern string) (*IncrementalBackupMetadata, error) {
    query := `
        SELECT id, name, type, end_time, index_pattern
        FROM backups
        WHERE type = 'full' AND index_pattern = $1
        ORDER BY end_time DESC
        LIMIT 1
    `
    
    var backup IncrementalBackupMetadata
    err := m.metadataDB.QueryRow(query, indexPattern).Scan(
        &backup.ID,
        &backup.Name,
        &backup.Type,
        &backup.EndTime,
        &backup.IndexPattern,
    )
    
    if err == sql.ErrNoRows {
        return nil, fmt.Errorf("未找到全量备份")
    }
    
    return &backup, err
}

// 恢复增量备份（需要先恢复基准备份）
func (m *IncrementalBackupManager) RestoreIncrementalBackup(backupID string) error {
    // 1. 获取备份元数据
    metadata, err := m.getMetadata(backupID)
    if err != nil {
        return fmt.Errorf("获取备份元数据失败: %w", err)
    }
    
    // 2. 检查是否为增量备份
    if metadata.Type != "incremental" {
        return m.restoreFullBackup(backupID)
    }
    
    // 3. 检查基准备份是否已恢复
    baseRestored, err := m.isBackupRestored(metadata.BasedOn)
    if err != nil {
        return fmt.Errorf("检查基准备份状态失败: %w", err)
    }
    
    if !baseRestored {
        return fmt.Errorf("请先恢复基准备份: %s", metadata.BasedOn)
    }
    
    // 4. 恢复增量备份
    req := esapi.SnapshotRestoreRequest{
        Repository: m.getRepository(),
        Snapshot:   backupID,
        Body: esutil.NewJSONReader(map[string]interface{}{
            "indices":           metadata.IndexPattern,
            "ignore_unavailable": true,
            "include_global_state": false,
        }),
    }
    
    res, err := req.Do(context.Background(), m.esClient)
    if err != nil {
        return fmt.Errorf("恢复增量备份失败: %w", err)
    }
    defer res.Body.Close()
    
    if res.IsError() {
        return fmt.Errorf("ES返回错误: %s", res.String())
    }
    
    log.Info("增量备份恢复成功", "backup_id", backupID, "based_on", metadata.BasedOn)
    return nil
}

// 获取备份依赖链
func (m *IncrementalBackupManager) GetBackupChain(backupID string) ([]*IncrementalBackupMetadata, error) {
    chain := make([]*IncrementalBackupMetadata, 0)
    currentID := backupID
    
    for currentID != "" {
        metadata, err := m.getMetadata(currentID)
        if err != nil {
            return nil, fmt.Errorf("获取备份元数据失败: %w", err)
        }
        
        chain = append([]*IncrementalBackupMetadata{metadata}, chain...)
        currentID = metadata.BasedOn
    }
    
    return chain, nil
}
```

**关键实现点**:

1. 使用时间戳范围查询实现真正的增量备份，只备份新增数据
2. 在元数据中记录 `BasedOn` 字段，建立备份依赖关系
3. 恢复前检查基准备份状态，确保依赖链完整
4. 提供备份链查询功能，方便追溯依赖关系
5. 增量备份大小明显小于全量备份，节省存储空间

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| incremental_enabled | bool | true | 是否启用增量备份 |
| auto_base_backup | bool | true | 无基准备份时自动创建全量备份 |
| max_incremental_chain | int | 10 | 最大增量备份链长度 |
| incremental_interval_hours | int | 24 | 增量备份间隔（小时） |
| verify_base_on_restore | bool | true | 恢复时验证基准备份 |

**热更新机制**:

- 更新方式: API + PostgreSQL 配置表
- 生效时间: 立即生效（下一次备份操作）
- 回滚策略: 配置验证失败时保持原配置，记录错误日志

**热更新验收标准**:

1. THE System SHALL 在配置变更后 3 秒内生效
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误日志
3. THE System SHALL 支持通过 API 查询当前生效的配置值
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 17-2：自定义备份路径 [MVP]

**用户故事**: 

作为用户，我希望能够选择自定义备份路径，这样我可以将备份组织到不同的位置。

**验收标准**:

1. WHEN 创建备份时，THE UI SHALL 显示路径选择输入框，带有默认值提示
2. WHEN 提供自定义路径时，THE API_Server SHALL 将其用作备份仓库位置
3. WHEN 未提供自定义路径时，THE API_Server SHALL 使用默认仓库路径 "/var/lib/elasticsearch/snapshots"
4. THE API_Server SHALL 验证自定义路径是否存在、可访问且可写
5. IF 自定义路径无效，THEN THE API_Server SHALL 返回 HTTP 400 并附带具体错误消息
6. THE UI SHALL 显示可用的备份路径列表供用户选择（如果有多个配置的路径）
7. THE System SHALL 支持相对路径和绝对路径
8. WHEN 路径不存在时，THE System SHALL 尝试创建该路径（如果有权限）
9. THE UI SHALL 显示每个路径的可用磁盘空间
10. WHEN 磁盘空间不足时，THE System SHALL 提前警告用户

**实现方向**:

**实现方式**:

```go
// 路径管理器
type PathManager struct {
    config      atomic.Value
    metadataDB  *sql.DB
}

// 路径配置
type PathConfig struct {
    Path            string `json:"path"`
    IsDefault       bool   `json:"is_default"`
    MaxSizeGB       int64  `json:"max_size_gb"`
    WarningThreshold float64 `json:"warning_threshold"` // 0.9 = 90%
}

// 路径验证结果
type PathValidation struct {
    Valid           bool   `json:"valid"`
    Exists          bool   `json:"exists"`
    Writable        bool   `json:"writable"`
    AvailableSpaceGB float64 `json:"available_space_gb"`
    TotalSpaceGB    float64 `json:"total_space_gb"`
    UsagePercent    float64 `json:"usage_percent"`
    ErrorMessage    string `json:"error_message,omitempty"`
}

// 验证自定义路径
func (pm *PathManager) ValidatePath(path string) (*PathValidation, error) {
    validation := &PathValidation{
        Valid: false,
    }
    
    // 1. 检查路径是否存在
    info, err := os.Stat(path)
    if err != nil {
        if os.IsNotExist(err) {
            validation.Exists = false
            validation.ErrorMessage = "路径不存在"
            
            // 尝试创建路径
            if err := os.MkdirAll(path, 0755); err != nil {
                validation.ErrorMessage = fmt.Sprintf("路径不存在且无法创建: %v", err)
                return validation, nil
            }
            
            validation.Exists = true
            log.Info("自动创建备份路径", "path", path)
        } else {
            validation.ErrorMessage = fmt.Sprintf("无法访问路径: %v", err)
            return validation, nil
        }
    } else {
        validation.Exists = true
        
        // 检查是否为目录
        if !info.IsDir() {
            validation.ErrorMessage = "路径不是目录"
            return validation, nil
        }
    }
    
    // 2. 检查写权限
    testFile := filepath.Join(path, ".write_test")
    if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
        validation.Writable = false
        validation.ErrorMessage = fmt.Sprintf("路径不可写: %v", err)
        return validation, nil
    }
    os.Remove(testFile)
    validation.Writable = true
    
    // 3. 检查磁盘空间
    var stat syscall.Statfs_t
    if err := syscall.Statfs(path, &stat); err != nil {
        validation.ErrorMessage = fmt.Sprintf("无法获取磁盘空间信息: %v", err)
        return validation, nil
    }
    
    // 计算可用空间（GB）
    availableBytes := stat.Bavail * uint64(stat.Bsize)
    totalBytes := stat.Blocks * uint64(stat.Bsize)
    
    validation.AvailableSpaceGB = float64(availableBytes) / (1024 * 1024 * 1024)
    validation.TotalSpaceGB = float64(totalBytes) / (1024 * 1024 * 1024)
    validation.UsagePercent = float64(totalBytes-availableBytes) / float64(totalBytes) * 100
    
    // 4. 检查空间是否充足（至少需要10GB）
    if validation.AvailableSpaceGB < 10 {
        validation.ErrorMessage = fmt.Sprintf("可用空间不足: %.2f GB < 10 GB", validation.AvailableSpaceGB)
        return validation, nil
    }
    
    // 5. 检查是否接近容量上限
    config := pm.config.Load().(*PathConfig)
    if validation.UsagePercent > config.WarningThreshold*100 {
        log.Warn("磁盘空间不足", 
            "path", path, 
            "usage", validation.UsagePercent,
            "threshold", config.WarningThreshold*100)
    }
    
    validation.Valid = true
    return validation, nil
}

// 获取可用路径列表
func (pm *PathManager) GetAvailablePaths() ([]*PathInfo, error) {
    query := `
        SELECT path, is_default, max_size_gb, created_at
        FROM backup_paths
        WHERE enabled = true
        ORDER BY is_default DESC, created_at DESC
    `
    
    rows, err := pm.metadataDB.Query(query)
    if err != nil {
        return nil, fmt.Errorf("查询路径列表失败: %w", err)
    }
    defer rows.Close()
    
    paths := make([]*PathInfo, 0)
    for rows.Next() {
        var info PathInfo
        if err := rows.Scan(&info.Path, &info.IsDefault, &info.MaxSizeGB, &info.CreatedAt); err != nil {
            log.Error("扫描路径信息失败", "error", err)
            continue
        }
        
        // 获取实时空间信息
        validation, err := pm.ValidatePath(info.Path)
        if err == nil && validation.Valid {
            info.AvailableSpaceGB = validation.AvailableSpaceGB
            info.TotalSpaceGB = validation.TotalSpaceGB
            info.UsagePercent = validation.UsagePercent
        }
        
        paths = append(paths, &info)
    }
    
    return paths, nil
}

// 选择最佳路径（空间最大的可用路径）
func (pm *PathManager) SelectBestPath() (string, error) {
    paths, err := pm.GetAvailablePaths()
    if err != nil {
        return "", err
    }
    
    if len(paths) == 0 {
        return "", fmt.Errorf("没有可用的备份路径")
    }
    
    // 优先使用默认路径
    for _, p := range paths {
        if p.IsDefault {
            validation, err := pm.ValidatePath(p.Path)
            if err == nil && validation.Valid {
                return p.Path, nil
            }
        }
    }
    
    // 选择可用空间最大的路径
    var bestPath string
    var maxSpace float64
    
    for _, p := range paths {
        validation, err := pm.ValidatePath(p.Path)
        if err == nil && validation.Valid && validation.AvailableSpaceGB > maxSpace {
            maxSpace = validation.AvailableSpaceGB
            bestPath = p.Path
        }
    }
    
    if bestPath == "" {
        return "", fmt.Errorf("所有路径都不可用")
    }
    
    return bestPath, nil
}

// 路径信息
type PathInfo struct {
    Path             string    `json:"path"`
    IsDefault        bool      `json:"is_default"`
    MaxSizeGB        int64     `json:"max_size_gb"`
    AvailableSpaceGB float64   `json:"available_space_gb"`
    TotalSpaceGB     float64   `json:"total_space_gb"`
    UsagePercent     float64   `json:"usage_percent"`
    CreatedAt        time.Time `json:"created_at"`
}
```

**关键实现点**:

1. 使用 `syscall.Statfs` 获取实时磁盘空间信息
2. 自动创建不存在的路径（如果有权限）
3. 通过写入测试文件验证写权限
4. 支持多路径管理，自动选择最佳路径
5. 实时监控磁盘空间，提前预警

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| default_path | string | "/var/lib/elasticsearch/snapshots" | 默认备份路径 |
| min_free_space_gb | float64 | 10.0 | 最小可用空间（GB） |
| warning_threshold | float64 | 0.9 | 空间告警阈值（90%） |
| auto_create_path | bool | true | 自动创建不存在的路径 |
| path_check_interval_seconds | int | 300 | 路径检查间隔（秒） |

**热更新机制**:

- 更新方式: API + PostgreSQL 配置表
- 生效时间: 立即生效（下一次路径验证）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 路径配置变更时，THE System SHALL 验证新路径的有效性
3. THE System SHALL 支持通过 API 查询当前生效的路径配置
4. THE System SHALL 记录所有路径配置变更的审计日志

---

## 需求 17-3：备份下载功能 [MVP]

**用户故事**: 

作为用户，我希望能够下载备份数据，这样我可以将备份迁移到另一个系统。

**验收标准**:

1. WHEN 收到 GET /api/v1/backups/{id}/download 请求时，THE API_Server SHALL 将备份导出为可下载的包
2. THE 导出包 SHALL 包含备份元数据（名称、类型、索引列表、创建时间、大小、文档数）
3. THE 导出包 SHALL 包含实际备份数据，采用 tar.gz 压缩格式
4. WHEN 下载准备就绪时，THE API_Server SHALL 返回带有适当 Content-Disposition 头的文件
5. THE UI SHALL 为每个成功状态的备份显示下载按钮
6. IF 备份不存在或状态不是成功，THEN THE API_Server SHALL 返回 HTTP 404
7. THE 下载文件名 SHALL 包含备份名称和日期，格式为 "{backup_name}_{date}.tar.gz"
8. FOR 大型备份（>100MB），THE System SHALL 支持分块下载以避免超时
9. THE UI SHALL 显示下载进度指示器（百分比和已下载大小）
10. IF 下载失败，THE System SHALL 提供重试选项
11. THE System SHALL 支持断点续传功能
12. THE UI SHALL 在下载前显示预估文件大小
13. THE System SHALL 支持同时下载多个备份（队列方式）

**实现方向**:

**实现方式**:

```go
// 导出管理器
type ExportManager struct {
    esClient    *elasticsearch.Client
    metadataDB  *sql.DB
    tempDir     string
}

// 导出备份包
func (em *ExportManager) ExportBackup(backupID string) (string, error) {
    // 1. 获取备份元数据
    metadata, err := em.getBackupMetadata(backupID)
    if err != nil {
        return "", fmt.Errorf("获取备份元数据失败: %w", err)
    }
    
    if metadata.Status != "SUCCESS" {
        return "", fmt.Errorf("备份状态不是成功: %s", metadata.Status)
    }
    
    // 2. 创建临时目录
    exportDir := filepath.Join(em.tempDir, fmt.Sprintf("export_%s_%d", backupID, time.Now().Unix()))
    if err := os.MkdirAll(exportDir, 0755); err != nil {
        return "", fmt.Errorf("创建导出目录失败: %w", err)
    }
    
    // 3. 导出元数据为 JSON
    metadataFile := filepath.Join(exportDir, "metadata.json")
    metadataJSON, err := json.MarshalIndent(metadata, "", "  ")
    if err != nil {
        return "", fmt.Errorf("序列化元数据失败: %w", err)
    }
    
    if err := os.WriteFile(metadataFile, metadataJSON, 0644); err != nil {
        return "", fmt.Errorf("写入元数据文件失败: %w", err)
    }
    
    // 4. 复制快照数据
    snapshotPath := em.getSnapshotPath(metadata.Repository, backupID)
    dataDir := filepath.Join(exportDir, "data")
    
    if err := em.copyDirectory(snapshotPath, dataDir); err != nil {
        return "", fmt.Errorf("复制快照数据失败: %w", err)
    }
    
    // 5. 打包为 tar.gz
    tarFile := filepath.Join(em.tempDir, fmt.Sprintf("%s_%s.tar.gz", 
        metadata.Name, 
        time.Now().Format("20060102_150405")))
    
    if err := em.createTarGz(exportDir, tarFile); err != nil {
        return "", fmt.Errorf("打包失败: %w", err)
    }
    
    // 6. 清理临时目录
    os.RemoveAll(exportDir)
    
    // 7. 计算校验和
    checksum, err := em.calculateChecksum(tarFile)
    if err != nil {
        log.Warn("计算校验和失败", "error", err)
    } else {
        // 保存校验和到数据库
        em.saveChecksum(backupID, checksum)
    }
    
    log.Info("备份导出成功", "backup_id", backupID, "file", tarFile, "checksum", checksum)
    return tarFile, nil
}

// 创建 tar.gz 压缩包
func (em *ExportManager) createTarGz(sourceDir, targetFile string) error {
    // 创建目标文件
    file, err := os.Create(targetFile)
    if err != nil {
        return err
    }
    defer file.Close()
    
    // 创建 gzip writer
    gzipWriter := gzip.NewWriter(file)
    defer gzipWriter.Close()
    
    // 创建 tar writer
    tarWriter := tar.NewWriter(gzipWriter)
    defer tarWriter.Close()
    
    // 遍历源目录
    return filepath.Walk(sourceDir, func(path string, info os.FileInfo, err error) error {
        if err != nil {
            return err
        }
        
        // 创建 tar header
        header, err := tar.FileInfoHeader(info, "")
        if err != nil {
            return err
        }
        
        // 设置相对路径
        relPath, err := filepath.Rel(sourceDir, path)
        if err != nil {
            return err
        }
        header.Name = relPath
        
        // 写入 header
        if err := tarWriter.WriteHeader(header); err != nil {
            return err
        }
        
        // 如果是文件，写入内容
        if !info.IsDir() {
            data, err := os.ReadFile(path)
            if err != nil {
                return err
            }
            
            if _, err := tarWriter.Write(data); err != nil {
                return err
            }
        }
        
        return nil
    })
}

// 计算文件校验和（SHA256）
func (em *ExportManager) calculateChecksum(filePath string) (string, error) {
    file, err := os.Open(filePath)
    if err != nil {
        return "", err
    }
    defer file.Close()
    
    hash := sha256.New()
    if _, err := io.Copy(hash, file); err != nil {
        return "", err
    }
    
    return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// HTTP 下载处理器（支持断点续传）
func (em *ExportManager) DownloadHandler(c *gin.Context) {
    backupID := c.Param("id")
    
    // 1. 检查备份是否存在
    metadata, err := em.getBackupMetadata(backupID)
    if err != nil {
        c.JSON(404, gin.H{"error": "备份不存在"})
        return
    }
    
    // 2. 导出备份包（如果还未导出）
    exportFile, err := em.getOrCreateExportFile(backupID)
    if err != nil {
        c.JSON(500, gin.H{"error": fmt.Sprintf("导出失败: %v", err)})
        return
    }
    
    // 3. 获取文件信息
    fileInfo, err := os.Stat(exportFile)
    if err != nil {
        c.JSON(500, gin.H{"error": "文件不存在"})
        return
    }
    
    fileSize := fileInfo.Size()
    fileName := fmt.Sprintf("%s_%s.tar.gz", 
        metadata.Name, 
        metadata.CreatedAt.Format("20060102_150405"))
    
    // 4. 设置响应头
    c.Header("Content-Description", "File Transfer")
    c.Header("Content-Type", "application/gzip")
    c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
    c.Header("Content-Length", fmt.Sprintf("%d", fileSize))
    c.Header("Accept-Ranges", "bytes")
    
    // 5. 处理 Range 请求（断点续传）
    rangeHeader := c.GetHeader("Range")
    if rangeHeader != "" {
        // 解析 Range 头
        ranges, err := parseRange(rangeHeader, fileSize)
        if err != nil {
            c.JSON(416, gin.H{"error": "无效的 Range 请求"})
            return
        }
        
        if len(ranges) > 0 {
            r := ranges[0]
            
            // 打开文件并定位到指定位置
            file, err := os.Open(exportFile)
            if err != nil {
                c.JSON(500, gin.H{"error": "打开文件失败"})
                return
            }
            defer file.Close()
            
            if _, err := file.Seek(r.start, 0); err != nil {
                c.JSON(500, gin.H{"error": "定位文件失败"})
                return
            }
            
            // 设置 206 Partial Content 响应
            c.Header("Content-Range", fmt.Sprintf("bytes %d-%d/%d", r.start, r.end, fileSize))
            c.Status(206)
            
            // 发送部分内容
            io.CopyN(c.Writer, file, r.end-r.start+1)
            return
        }
    }
    
    // 6. 发送完整文件
    c.File(exportFile)
    
    log.Info("备份下载完成", "backup_id", backupID, "file_size", fileSize)
}

// Range 结构
type httpRange struct {
    start int64
    end   int64
}

// 解析 Range 头
func parseRange(rangeHeader string, fileSize int64) ([]httpRange, error) {
    if !strings.HasPrefix(rangeHeader, "bytes=") {
        return nil, fmt.Errorf("无效的 Range 格式")
    }
    
    rangeStr := strings.TrimPrefix(rangeHeader, "bytes=")
    parts := strings.Split(rangeStr, "-")
    
    if len(parts) != 2 {
        return nil, fmt.Errorf("无效的 Range 格式")
    }
    
    start, err := strconv.ParseInt(parts[0], 10, 64)
    if err != nil {
        return nil, err
    }
    
    var end int64
    if parts[1] == "" {
        end = fileSize - 1
    } else {
        end, err = strconv.ParseInt(parts[1], 10, 64)
        if err != nil {
            return nil, err
        }
    }
    
    if start > end || start < 0 || end >= fileSize {
        return nil, fmt.Errorf("无效的 Range 范围")
    }
    
    return []httpRange{{start: start, end: end}}, nil
}
```

**关键实现点**:

1. 使用 tar.gz 格式打包备份数据和元数据
2. 支持 HTTP Range 请求实现断点续传
3. 计算 SHA256 校验和确保文件完整性
4. 异步导出大型备份，避免请求超时
5. 自动清理临时文件，节省磁盘空间

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| export_temp_dir | string | "/tmp/backup-exports" | 导出临时目录 |
| export_cache_ttl_hours | int | 24 | 导出文件缓存时间（小时） |
| max_concurrent_exports | int | 3 | 最大并发导出数 |
| chunk_size_mb | int | 10 | 分块下载大小（MB） |
| enable_checksum | bool | true | 是否计算校验和 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次导出操作）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 导出配置变更时，THE System SHALL 验证配置的有效性
3. THE System SHALL 支持通过 API 查询当前生效的导出配置
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 17-4：自定义备份名称和备注 [MVP]

**用户故事**: 

作为用户，我希望能够为备份设置自定义名称和描述，这样我可以轻松识别和组织它们。

**验收标准**:

1. WHEN 创建备份时，THE UI SHALL 显示自定义名称和描述的输入框
2. WHEN 提供自定义名称时，THE API_Server SHALL 将其用作备份名称
3. WHEN 未提供自定义名称时，THE API_Server SHALL 生成默认名称，格式为 "{repository}_{type}_{timestamp}"
4. THE 自定义名称 SHALL 验证：
   - 只包含字母数字字符、连字符、下划线和中文
   - 长度在 1-100 个字符之间
   - 不能以数字开头
   - 不能包含空格或特殊字符（除了允许的）
5. THE 描述字段 SHALL 支持最多 500 个字符，允许中文和特殊字符
6. WHEN 列出备份时，THE API_Server SHALL 返回自定义名称和描述
7. THE 备份名称 SHALL 在同一仓库内唯一，如果重复 THE System SHALL 返回错误
8. THE UI SHALL 在输入时实时验证名称格式
9. THE System SHALL 支持编辑已有备份的名称和描述
10. THE 名称和描述的修改 SHALL 记录修改时间

**实现方向**:

**实现方式**:

```go
// 命名与元数据管理器
type MetadataManager struct {
    db     *sql.DB
    config atomic.Value
}

// 备份元数据
type BackupMetadata struct {
    ID          string    `json:"id"`
    Name        string    `json:"name"`
    Description string    `json:"description"`
    Type        string    `json:"type"`
    Repository  string    `json:"repository"`
    Status      string    `json:"status"`
    CreatedAt   time.Time `json:"created_at"`
    UpdatedAt   time.Time `json:"updated_at"`
    CreatedBy   string    `json:"created_by"`
    UpdatedBy   string    `json:"updated_by"`
}

// 名称验证规则
var (
    // 名称正则：字母、数字、连字符、下划线、中文，1-100字符，不能以数字开头
    namePattern = regexp.MustCompile(`^[a-zA-Z\p{Han}][a-zA-Z0-9_\-\p{Han}]{0,99}$`)
)

// 验证备份名称
func (mm *MetadataManager) ValidateName(name string) error {
    if name == "" {
        return nil // 空名称将使用默认名称
    }
    
    // 1. 检查长度
    if len(name) < 1 || len(name) > 100 {
        return fmt.Errorf("名称长度必须在 1-100 个字符之间")
    }
    
    // 2. 检查格式
    if !namePattern.MatchString(name) {
        return fmt.Errorf("名称只能包含字母、数字、连字符、下划线和中文，且不能以数字开头")
    }
    
    // 3. 检查是否包含空格
    if strings.Contains(name, " ") {
        return fmt.Errorf("名称不能包含空格")
    }
    
    // 4. 检查特殊字符
    invalidChars := []string{"<", ">", ":", "\"", "/", "\\", "|", "?", "*"}
    for _, char := range invalidChars {
        if strings.Contains(name, char) {
            return fmt.Errorf("名称不能包含特殊字符: %s", char)
        }
    }
    
    return nil
}

// 验证描述
func (mm *MetadataManager) ValidateDescription(description string) error {
    if description == "" {
        return nil // 描述可以为空
    }
    
    // 检查长度（最多500字符）
    if len([]rune(description)) > 500 {
        return fmt.Errorf("描述长度不能超过 500 个字符")
    }
    
    return nil
}

// 生成默认名称
func (mm *MetadataManager) GenerateDefaultName(repository, backupType string) string {
    timestamp := time.Now().Format("20060102_150405")
    return fmt.Sprintf("%s_%s_%s", repository, backupType, timestamp)
}

// 检查名称唯一性
func (mm *MetadataManager) IsNameUnique(name, repository string) (bool, error) {
    query := `
        SELECT COUNT(*) 
        FROM backups 
        WHERE name = $1 AND repository = $2
    `
    
    var count int
    err := mm.db.QueryRow(query, name, repository).Scan(&count)
    if err != nil {
        return false, fmt.Errorf("检查名称唯一性失败: %w", err)
    }
    
    return count == 0, nil
}

// 创建备份元数据
func (mm *MetadataManager) CreateMetadata(metadata *BackupMetadata) error {
    // 1. 验证名称
    if metadata.Name != "" {
        if err := mm.ValidateName(metadata.Name); err != nil {
            return fmt.Errorf("名称验证失败: %w", err)
        }
        
        // 检查唯一性
        unique, err := mm.IsNameUnique(metadata.Name, metadata.Repository)
        if err != nil {
            return err
        }
        if !unique {
            return fmt.Errorf("备份名称已存在: %s", metadata.Name)
        }
    } else {
        // 生成默认名称
        metadata.Name = mm.GenerateDefaultName(metadata.Repository, metadata.Type)
    }
    
    // 2. 验证描述
    if err := mm.ValidateDescription(metadata.Description); err != nil {
        return fmt.Errorf("描述验证失败: %w", err)
    }
    
    // 3. 插入数据库
    query := `
        INSERT INTO backups (
            id, name, description, type, repository, status, 
            created_at, updated_at, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `
    
    now := time.Now()
    _, err := mm.db.Exec(query,
        metadata.ID,
        metadata.Name,
        metadata.Description,
        metadata.Type,
        metadata.Repository,
        metadata.Status,
        now,
        now,
        metadata.CreatedBy,
    )
    
    if err != nil {
        return fmt.Errorf("保存元数据失败: %w", err)
    }
    
    log.Info("备份元数据创建成功", 
        "id", metadata.ID, 
        "name", metadata.Name,
        "type", metadata.Type)
    
    return nil
}

// 更新备份元数据
func (mm *MetadataManager) UpdateMetadata(id string, name, description, updatedBy string) error {
    // 1. 验证名称
    if name != "" {
        if err := mm.ValidateName(name); err != nil {
            return fmt.Errorf("名称验证失败: %w", err)
        }
        
        // 检查唯一性（排除当前备份）
        query := `
            SELECT COUNT(*) 
            FROM backups 
            WHERE name = $1 AND id != $2
        `
        
        var count int
        err := mm.db.QueryRow(query, name, id).Scan(&count)
        if err != nil {
            return fmt.Errorf("检查名称唯一性失败: %w", err)
        }
        
        if count > 0 {
            return fmt.Errorf("备份名称已存在: %s", name)
        }
    }
    
    // 2. 验证描述
    if err := mm.ValidateDescription(description); err != nil {
        return fmt.Errorf("描述验证失败: %w", err)
    }
    
    // 3. 更新数据库
    query := `
        UPDATE backups 
        SET name = COALESCE(NULLIF($1, ''), name),
            description = COALESCE(NULLIF($2, ''), description),
            updated_at = $3,
            updated_by = $4
        WHERE id = $5
    `
    
    result, err := mm.db.Exec(query, name, description, time.Now(), updatedBy, id)
    if err != nil {
        return fmt.Errorf("更新元数据失败: %w", err)
    }
    
    rowsAffected, _ := result.RowsAffected()
    if rowsAffected == 0 {
        return fmt.Errorf("备份不存在: %s", id)
    }
    
    // 4. 记录修改历史
    if err := mm.recordHistory(id, name, description, updatedBy); err != nil {
        log.Warn("记录修改历史失败", "error", err)
    }
    
    log.Info("备份元数据更新成功", "id", id, "updated_by", updatedBy)
    return nil
}

// 记录修改历史
func (mm *MetadataManager) recordHistory(backupID, name, description, updatedBy string) error {
    query := `
        INSERT INTO backup_history (
            backup_id, name, description, updated_by, updated_at
        ) VALUES ($1, $2, $3, $4, $5)
    `
    
    _, err := mm.db.Exec(query, backupID, name, description, updatedBy, time.Now())
    return err
}

// 获取修改历史
func (mm *MetadataManager) GetHistory(backupID string) ([]*BackupHistory, error) {
    query := `
        SELECT name, description, updated_by, updated_at
        FROM backup_history
        WHERE backup_id = $1
        ORDER BY updated_at DESC
    `
    
    rows, err := mm.db.Query(query, backupID)
    if err != nil {
        return nil, fmt.Errorf("查询修改历史失败: %w", err)
    }
    defer rows.Close()
    
    history := make([]*BackupHistory, 0)
    for rows.Next() {
        var h BackupHistory
        if err := rows.Scan(&h.Name, &h.Description, &h.UpdatedBy, &h.UpdatedAt); err != nil {
            log.Error("扫描历史记录失败", "error", err)
            continue
        }
        history = append(history, &h)
    }
    
    return history, nil
}

// 修改历史记录
type BackupHistory struct {
    Name        string    `json:"name"`
    Description string    `json:"description"`
    UpdatedBy   string    `json:"updated_by"`
    UpdatedAt   time.Time `json:"updated_at"`
}
```

**关键实现点**:

1. 使用正则表达式验证名称格式，支持中文字符
2. 在数据库层面保证名称唯一性（同一仓库内）
3. 自动生成默认名称，格式为 `{repository}_{type}_{timestamp}`
4. 记录所有元数据修改历史，支持审计追溯
5. 实时验证输入，提供友好的错误提示

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| name_max_length | int | 100 | 名称最大长度 |
| description_max_length | int | 500 | 描述最大长度 |
| enable_name_validation | bool | true | 是否启用名称验证 |
| enable_history_tracking | bool | true | 是否记录修改历史 |
| default_name_format | string | "{repository}_{type}_{timestamp}" | 默认名称格式 |

**热更新机制**:

- 更新方式: API + PostgreSQL 配置表
- 生效时间: 立即生效（下一次验证操作）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 验证规则变更时，THE System SHALL 应用新规则进行验证
3. THE System SHALL 支持通过 API 查询当前生效的验证规则
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 17-5：创建备份对话框 [MVP]

**用户故事**: 

作为用户，我希望在创建备份前有一个配置对话框，这样我可以自定义每个备份的选项。

**验收标准**:

1. WHEN 用户点击"全量备份"或"增量备份"按钮时，THE UI SHALL 显示配置对话框
2. THE 对话框 SHALL 包含以下字段：
   - 备份名称（可选，带格式提示和字符计数）
   - 描述/备注（可选，多行文本框，带字符计数）
   - 自定义路径（可选，下拉选择或手动输入）
   - 索引模式（默认 "logs-*"，可修改，带提示）
3. THE 对话框 SHALL 以只读方式显示备份类型（全量/增量）
4. WHEN 用户确认时，THE UI SHALL 发送包含所有配置选项的备份请求
5. WHEN 用户取消时，THE UI SHALL 关闭对话框而不创建备份
6. THE 对话框 SHALL 显示表单验证错误（如名称格式不正确）
7. THE 确认按钮 SHALL 在表单验证通过后才可点击
8. THE 对话框 SHALL 支持键盘快捷键（Enter 确认，Escape 取消）
9. THE UI SHALL 显示预估备份大小（基于索引模式匹配的数据量）
10. THE UI SHALL 显示预估备份时间
11. THE 对话框 SHALL 记住上次使用的配置（路径、索引模式）

**实现方向**:

**实现方式**:

```go
// 备份创建对话框配置
type BackupDialogConfig struct {
    Type         string   `json:"type" binding:"required,oneof=full incremental"`
    Name         string   `json:"name"`
    Description  string   `json:"description"`
    CustomPath   string   `json:"custom_path"`
    IndexPattern string   `json:"index_pattern"`
}

// 前端对话框组件（React + Ant Design）
/*
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Radio, Space, Alert, Statistic } from 'antd';
import { FolderOutlined, InfoCircleOutlined } from '@ant-design/icons';

const BackupCreateDialog = ({ visible, type, onOk, onCancel }) => {
    const [form] = Form.useForm();
    const [paths, setPaths] = useState([]);
    const [estimatedSize, setEstimatedSize] = useState(0);
    const [estimatedTime, setEstimatedTime] = useState(0);
    const [nameError, setNameError] = useState('');
    
    // 加载可用路径列表
    useEffect(() => {
        if (visible) {
            fetch('/api/v1/backups/paths')
                .then(res => res.json())
                .then(data => setPaths(data.data || []));
            
            // 从 localStorage 恢复上次配置
            const lastConfig = localStorage.getItem('lastBackupConfig');
            if (lastConfig) {
                const config = JSON.parse(lastConfig);
                form.setFieldsValue({
                    custom_path: config.custom_path,
                    index_pattern: config.index_pattern || 'logs-*'
                });
            }
        }
    }, [visible]);
    
    // 实时验证名称
    const validateName = async (name) => {
        if (!name) {
            setNameError('');
            return;
        }
        
        // 前端验证
        const nameRegex = /^[a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9_\-\u4e00-\u9fa5]{0,99}$/;
        if (!nameRegex.test(name)) {
            setNameError('名称只能包含字母、数字、连字符、下划线和中文，且不能以数字开头');
            return;
        }
        
        setNameError('');
    };
    
    // 估算备份大小和时间
    const estimateBackup = async (indexPattern) => {
        try {
            const res = await fetch(`/api/v1/backups/estimate?index_pattern=${indexPattern}`);
            const data = await res.json();
            setEstimatedSize(data.data.size_gb);
            setEstimatedTime(data.data.time_minutes);
        } catch (err) {
            console.error('估算失败', err);
        }
    };
    
    // 索引模式变化时重新估算
    const handleIndexPatternChange = (e) => {
        const pattern = e.target.value;
        if (pattern) {
            estimateBackup(pattern);
        }
    };
    
    // 提交表单
    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            
            // 保存配置到 localStorage
            localStorage.setItem('lastBackupConfig', JSON.stringify({
                custom_path: values.custom_path,
                index_pattern: values.index_pattern
            }));
            
            onOk({ ...values, type });
        } catch (err) {
            console.error('表单验证失败', err);
        }
    };
    
    return (
        <Modal
            title={`创建${type === 'full' ? '全量' : '增量'}备份`}
            visible={visible}
            onOk={handleOk}
            onCancel={onCancel}
            width={600}
            okText="创建"
            cancelText="取消"
            okButtonProps={{ disabled: !!nameError }}
        >
            <Form
                form={form}
                layout="vertical"
                initialValues={{
                    index_pattern: 'logs-*'
                }}
            >
                <Form.Item label="备份类型">
                    <Input value={type === 'full' ? '全量备份' : '增量备份'} disabled />
                </Form.Item>
                
                <Form.Item
                    label="备份名称"
                    name="name"
                    help={nameError || "可选，留空将自动生成。格式：字母/中文开头，可包含数字、连字符、下划线"}
                    validateStatus={nameError ? 'error' : ''}
                    extra={
                        <Space>
                            <InfoCircleOutlined />
                            <span>字符数: {form.getFieldValue('name')?.length || 0}/100</span>
                        </Space>
                    }
                >
                    <Input
                        placeholder="例如：production-backup-20260131"
                        maxLength={100}
                        onChange={(e) => validateName(e.target.value)}
                    />
                </Form.Item>
                
                <Form.Item
                    label="描述/备注"
                    name="description"
                    extra={
                        <span>字符数: {form.getFieldValue('description')?.length || 0}/500</span>
                    }
                >
                    <Input.TextArea
                        placeholder="可选，描述此备份的用途或重要信息"
                        rows={3}
                        maxLength={500}
                        showCount
                    />
                </Form.Item>
                
                <Form.Item
                    label="备份路径"
                    name="custom_path"
                    help="可选，留空使用默认路径"
                >
                    <Select
                        placeholder="选择备份路径或手动输入"
                        allowClear
                        showSearch
                        suffixIcon={<FolderOutlined />}
                    >
                        {paths.map(path => (
                            <Select.Option key={path.path} value={path.path}>
                                <Space direction="vertical" size={0}>
                                    <span>{path.path}</span>
                                    <span style={{ fontSize: 12, color: '#999' }}>
                                        可用: {path.available_space_gb.toFixed(2)} GB / 
                                        总计: {path.total_space_gb.toFixed(2)} GB
                                        ({(100 - path.usage_percent).toFixed(1)}% 可用)
                                    </span>
                                </Space>
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
                
                <Form.Item
                    label="索引模式"
                    name="index_pattern"
                    rules={[{ required: true, message: '请输入索引模式' }]}
                    help="支持通配符，例如：logs-*"
                >
                    <Input
                        placeholder="logs-*"
                        onChange={handleIndexPatternChange}
                    />
                </Form.Item>
                
                {estimatedSize > 0 && (
                    <Alert
                        message="预估信息"
                        description={
                            <Space size="large">
                                <Statistic
                                    title="预估大小"
                                    value={estimatedSize}
                                    suffix="GB"
                                    precision={2}
                                />
                                <Statistic
                                    title="预估时间"
                                    value={estimatedTime}
                                    suffix="分钟"
                                    precision={0}
                                />
                            </Space>
                        }
                        type="info"
                        showIcon
                        style={{ marginTop: 16 }}
                    />
                )}
            </Form>
        </Modal>
    );
};

export default BackupCreateDialog;
*/

// 后端估算接口
func (bm *BackupManager) EstimateBackupSize(indexPattern string) (*BackupEstimate, error) {
    // 1. 查询匹配的索引
    req := esapi.CatIndicesRequest{
        Index:  []string{indexPattern},
        Format: "json",
        Bytes:  "b",
    }
    
    res, err := req.Do(context.Background(), bm.esClient)
    if err != nil {
        return nil, fmt.Errorf("查询索引失败: %w", err)
    }
    defer res.Body.Close()
    
    if res.IsError() {
        return nil, fmt.Errorf("ES返回错误: %s", res.String())
    }
    
    // 2. 解析索引信息
    var indices []struct {
        Index      string `json:"index"`
        DocsCount  string `json:"docs.count"`
        StoreSize  string `json:"store.size"`
        PriStoreSize string `json:"pri.store.size"`
    }
    
    if err := json.NewDecoder(res.Body).Decode(&indices); err != nil {
        return nil, fmt.Errorf("解析响应失败: %w", err)
    }
    
    // 3. 计算总大小
    var totalBytes int64
    var totalDocs int64
    
    for _, idx := range indices {
        // 解析大小（字节）
        size, _ := strconv.ParseInt(idx.PriStoreSize, 10, 64)
        totalBytes += size
        
        // 解析文档数
        docs, _ := strconv.ParseInt(idx.DocsCount, 10, 64)
        totalDocs += docs
    }
    
    // 4. 估算备份时间（基于经验值：1GB约需1分钟）
    sizeGB := float64(totalBytes) / (1024 * 1024 * 1024)
    estimatedMinutes := int(sizeGB * 1.2) // 加20%缓冲
    
    if estimatedMinutes < 1 {
        estimatedMinutes = 1
    }
    
    return &BackupEstimate{
        IndexCount:       len(indices),
        DocumentCount:    totalDocs,
        SizeBytes:        totalBytes,
        SizeGB:           sizeGB,
        EstimatedMinutes: estimatedMinutes,
    }, nil
}

// 备份估算结果
type BackupEstimate struct {
    IndexCount       int     `json:"index_count"`
    DocumentCount    int64   `json:"document_count"`
    SizeBytes        int64   `json:"size_bytes"`
    SizeGB           float64 `json:"size_gb"`
    EstimatedMinutes int     `json:"time_minutes"`
}
```

**关键实现点**:

1. 使用 Ant Design Modal 组件实现对话框，用户体验友好
2. 实时验证名称格式，前端即时反馈错误
3. 从 localStorage 恢复上次配置，减少重复输入
4. 显示路径的可用空间，帮助用户选择
5. 实时估算备份大小和时间，让用户心中有数
6. 支持键盘快捷键（Enter确认，Escape取消）

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| enable_size_estimation | bool | true | 是否启用大小估算 |
| estimation_buffer_percent | float64 | 20.0 | 估算缓冲百分比 |
| default_index_pattern | string | "logs-*" | 默认索引模式 |
| remember_last_config | bool | true | 是否记住上次配置 |

**热更新机制**:

- 更新方式: API + 前端配置
- 生效时间: 立即生效（下一次打开对话框）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 对话框配置变更时，THE UI SHALL 应用新配置
3. THE System SHALL 支持通过 API 查询当前生效的对话框配置
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 17-6：备份列表增强 [Phase 2]

**用户故事**: 

作为用户，我希望在备份列表中看到更多信息，这样我可以更好地管理备份。

**验收标准**:

1. THE 备份列表 SHALL 显示自定义名称（如果有）或默认名称
2. THE 备份列表 SHALL 显示描述/备注（如果有），超长时截断显示
3. THE 备份列表 SHALL 显示存储路径
4. THE 备份列表 SHALL 支持按名称、类型、状态、日期筛选
5. THE 备份列表 SHALL 支持按名称、大小、日期排序
6. WHEN 鼠标悬停在备份行上时，THE UI SHALL 显示完整描述（如果描述较长）
7. THE UI SHALL 支持批量选择和批量删除备份
8. THE UI SHALL 支持批量下载选中的备份
9. THE UI SHALL 显示每个备份的存储路径和可用空间
10. THE UI SHALL 支持搜索备份（按名称或描述）

**实现方向**:

**实现方式**:

```go
// 备份列表增强
type BackupListManager struct {
    db     *sql.DB
    config atomic.Value
}

// 列表查询参数
type BackupListQuery struct {
    // 筛选条件
    NameFilter   string   `form:"name"`
    TypeFilter   []string `form:"type"`
    StatusFilter []string `form:"status"`
    PathFilter   string   `form:"path"`
    DateFrom     string   `form:"date_from"`
    DateTo       string   `form:"date_to"`
    
    // 排序
    SortBy    string `form:"sort_by" binding:"oneof=name size date type status"`
    SortOrder string `form:"sort_order" binding:"oneof=asc desc"`
    
    // 分页
    Page     int `form:"page" binding:"min=1"`
    PageSize int `form:"page_size" binding:"min=1,max=100"`
}

// 列表响应
type BackupListResponse struct {
    Items      []*BackupListItem `json:"items"`
    Total      int64             `json:"total"`
    Page       int               `json:"page"`
    PageSize   int               `json:"page_size"`
    TotalPages int               `json:"total_pages"`
}

// 列表项
type BackupListItem struct {
    ID               string    `json:"id"`
    Name             string    `json:"name"`
    DisplayName      string    `json:"display_name"` // 自定义名称或默认名称
    Description      string    `json:"description"`
    ShortDescription string    `json:"short_description"` // 截断的描述
    Type             string    `json:"type"`
    Status           string    `json:"status"`
    Path             string    `json:"path"`
    SizeBytes        int64     `json:"size_bytes"`
    SizeGB           float64   `json:"size_gb"`
    DocumentCount    int64     `json:"document_count"`
    CreatedAt        time.Time `json:"created_at"`
    CreatedBy        string    `json:"created_by"`
    AvailableSpace   float64   `json:"available_space_gb"`
}

// 查询备份列表
func (blm *BackupListManager) ListBackups(query *BackupListQuery) (*BackupListResponse, error) {
    // 1. 构建 SQL 查询
    sqlQuery := `
        SELECT 
            b.id, b.name, b.description, b.type, b.status, b.path,
            b.size_bytes, b.document_count, b.created_at, b.created_by,
            COUNT(*) OVER() as total_count
        FROM backups b
        WHERE 1=1
    `
    
    args := make([]interface{}, 0)
    argIndex := 1
    
    // 2. 添加筛选条件
    if query.NameFilter != "" {
        sqlQuery += fmt.Sprintf(" AND (b.name ILIKE $%d OR b.description ILIKE $%d)", argIndex, argIndex)
        args = append(args, "%"+query.NameFilter+"%")
        argIndex++
    }
    
    if len(query.TypeFilter) > 0 {
        placeholders := make([]string, len(query.TypeFilter))
        for i, t := range query.TypeFilter {
            placeholders[i] = fmt.Sprintf("$%d", argIndex)
            args = append(args, t)
            argIndex++
        }
        sqlQuery += fmt.Sprintf(" AND b.type IN (%s)", strings.Join(placeholders, ","))
    }
    
    if len(query.StatusFilter) > 0 {
        placeholders := make([]string, len(query.StatusFilter))
        for i, s := range query.StatusFilter {
            placeholders[i] = fmt.Sprintf("$%d", argIndex)
            args = append(args, s)
            argIndex++
        }
        sqlQuery += fmt.Sprintf(" AND b.status IN (%s)", strings.Join(placeholders, ","))
    }
    
    if query.PathFilter != "" {
        sqlQuery += fmt.Sprintf(" AND b.path ILIKE $%d", argIndex)
        args = append(args, "%"+query.PathFilter+"%")
        argIndex++
    }
    
    if query.DateFrom != "" {
        sqlQuery += fmt.Sprintf(" AND b.created_at >= $%d", argIndex)
        args = append(args, query.DateFrom)
        argIndex++
    }
    
    if query.DateTo != "" {
        sqlQuery += fmt.Sprintf(" AND b.created_at <= $%d", argIndex)
        args = append(args, query.DateTo)
        argIndex++
    }
    
    // 3. 添加排序
    sortColumn := "created_at"
    switch query.SortBy {
    case "name":
        sortColumn = "name"
    case "size":
        sortColumn = "size_bytes"
    case "date":
        sortColumn = "created_at"
    case "type":
        sortColumn = "type"
    case "status":
        sortColumn = "status"
    }
    
    sortOrder := "DESC"
    if query.SortOrder == "asc" {
        sortOrder = "ASC"
    }
    
    sqlQuery += fmt.Sprintf(" ORDER BY %s %s", sortColumn, sortOrder)
    
    // 4. 添加分页
    if query.Page < 1 {
        query.Page = 1
    }
    if query.PageSize < 1 {
        query.PageSize = 20
    }
    
    offset := (query.Page - 1) * query.PageSize
    sqlQuery += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
    args = append(args, query.PageSize, offset)
    
    // 5. 执行查询
    rows, err := blm.db.Query(sqlQuery, args...)
    if err != nil {
        return nil, fmt.Errorf("查询失败: %w", err)
    }
    defer rows.Close()
    
    // 6. 解析结果
    items := make([]*BackupListItem, 0)
    var totalCount int64
    
    for rows.Next() {
        var item BackupListItem
        err := rows.Scan(
            &item.ID,
            &item.Name,
            &item.Description,
            &item.Type,
            &item.Status,
            &item.Path,
            &item.SizeBytes,
            &item.DocumentCount,
            &item.CreatedAt,
            &item.CreatedBy,
            &totalCount,
        )
        if err != nil {
            log.Error("扫描行失败", "error", err)
            continue
        }
        
        // 处理显示名称
        item.DisplayName = item.Name
        
        // 截断描述（超过100字符）
        if len(item.Description) > 100 {
            item.ShortDescription = item.Description[:100] + "..."
        } else {
            item.ShortDescription = item.Description
        }
        
        // 计算大小（GB）
        item.SizeGB = float64(item.SizeBytes) / (1024 * 1024 * 1024)
        
        // 获取路径可用空间
        if item.Path != "" {
            if space, err := blm.getPathAvailableSpace(item.Path); err == nil {
                item.AvailableSpace = space
            }
        }
        
        items = append(items, &item)
    }
    
    // 7. 构建响应
    totalPages := int(totalCount) / query.PageSize
    if int(totalCount)%query.PageSize > 0 {
        totalPages++
    }
    
    return &BackupListResponse{
        Items:      items,
        Total:      totalCount,
        Page:       query.Page,
        PageSize:   query.PageSize,
        TotalPages: totalPages,
    }, nil
}

// 批量删除备份
func (blm *BackupListManager) BatchDelete(ids []string, userID string) error {
    if len(ids) == 0 {
        return fmt.Errorf("未选择要删除的备份")
    }
    
    // 开启事务
    tx, err := blm.db.Begin()
    if err != nil {
        return fmt.Errorf("开启事务失败: %w", err)
    }
    defer tx.Rollback()
    
    // 删除每个备份
    for _, id := range ids {
        // 1. 检查备份是否存在
        var exists bool
        err := tx.QueryRow("SELECT EXISTS(SELECT 1 FROM backups WHERE id = $1)", id).Scan(&exists)
        if err != nil {
            return fmt.Errorf("检查备份存在性失败: %w", err)
        }
        
        if !exists {
            log.Warn("备份不存在，跳过", "id", id)
            continue
        }
        
        // 2. 删除 Elasticsearch 快照
        if err := blm.deleteESSnapshot(id); err != nil {
            log.Error("删除ES快照失败", "id", id, "error", err)
            // 继续删除元数据
        }
        
        // 3. 删除数据库记录
        _, err = tx.Exec("DELETE FROM backups WHERE id = $1", id)
        if err != nil {
            return fmt.Errorf("删除备份记录失败: %w", err)
        }
        
        // 4. 记录审计日志
        _, err = tx.Exec(`
            INSERT INTO audit_logs (action, resource_type, resource_id, user_id, created_at)
            VALUES ('delete', 'backup', $1, $2, $3)
        `, id, userID, time.Now())
        if err != nil {
            log.Warn("记录审计日志失败", "error", err)
        }
    }
    
    // 提交事务
    if err := tx.Commit(); err != nil {
        return fmt.Errorf("提交事务失败: %w", err)
    }
    
    log.Info("批量删除备份成功", "count", len(ids), "user_id", userID)
    return nil
}

// 搜索备份
func (blm *BackupListManager) SearchBackups(keyword string, limit int) ([]*BackupListItem, error) {
    query := `
        SELECT id, name, description, type, status, created_at
        FROM backups
        WHERE name ILIKE $1 OR description ILIKE $1
        ORDER BY created_at DESC
        LIMIT $2
    `
    
    rows, err := blm.db.Query(query, "%"+keyword+"%", limit)
    if err != nil {
        return nil, fmt.Errorf("搜索失败: %w", err)
    }
    defer rows.Close()
    
    items := make([]*BackupListItem, 0)
    for rows.Next() {
        var item BackupListItem
        if err := rows.Scan(&item.ID, &item.Name, &item.Description, &item.Type, &item.Status, &item.CreatedAt); err != nil {
            log.Error("扫描行失败", "error", err)
            continue
        }
        items = append(items, &item)
    }
    
    return items, nil
}
```

**关键实现点**:

1. 支持多条件组合筛选（名称、类型、状态、路径、日期范围）
2. 支持多字段排序（名称、大小、日期、类型、状态）
3. 实现高效的分页查询，使用 COUNT(*) OVER() 获取总数
4. 自动截断长描述，鼠标悬停显示完整内容
5. 批量操作使用事务保证原子性

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| default_page_size | int | 20 | 默认每页条数 |
| max_page_size | int | 100 | 最大每页条数 |
| description_truncate_length | int | 100 | 描述截断长度 |
| enable_batch_operations | bool | true | 是否启用批量操作 |
| max_batch_size | int | 50 | 最大批量操作数 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次查询）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 列表配置变更时，THE System SHALL 应用新配置
3. THE System SHALL 支持通过 API 查询当前生效的列表配置
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 17-7：错误处理和用户反馈 [MVP]

**用户故事**: 

作为用户，我希望在操作失败时获得清晰的错误信息，这样我可以了解问题并采取措施。

**验收标准**:

1. WHEN 备份创建失败时，THE UI SHALL 显示具体错误原因
2. WHEN 下载失败时，THE UI SHALL 显示错误信息并提供重试选项
3. WHEN 路径验证失败时，THE UI SHALL 显示具体原因（不存在、无权限、空间不足等）
4. WHEN 名称验证失败时，THE UI SHALL 显示格式要求
5. ALL 错误消息 SHALL 使用中文
6. THE 成功操作 SHALL 显示成功提示消息
7. THE 长时间操作 SHALL 显示进度条或加载指示器
8. THE System SHALL 支持取消正在进行的备份操作
9. WHEN 取消操作后，THE System SHALL 清理已创建的临时文件

**实现方向**:

**实现方式**:

```go
// 错误处理管理器
type ErrorHandler struct {
    logger *log.Logger
}

// 错误类型定义
var (
    ErrBackupNotFound      = errors.New("备份不存在")
    ErrBackupInProgress    = errors.New("备份正在进行中")
    ErrInvalidPath         = errors.New("无效的备份路径")
    ErrInsufficientSpace   = errors.New("磁盘空间不足")
    ErrInvalidName         = errors.New("无效的备份名称")
    ErrNameAlreadyExists   = errors.New("备份名称已存在")
    ErrDownloadFailed      = errors.New("下载失败")
    ErrPermissionDenied    = errors.New("权限不足")
)

// 错误响应结构
type ErrorResponse struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
    Action  string `json:"action,omitempty"` // 建议的操作
}

// 处理备份创建错误
func (eh *ErrorHandler) HandleBackupCreateError(err error, c *gin.Context) {
    var resp ErrorResponse
    
    switch {
    case errors.Is(err, ErrInvalidName):
        resp = ErrorResponse{
            Code:    "INVALID_NAME",
            Message: "备份名称格式不正确",
            Details: "名称只能包含字母、数字、连字符、下划线和中文，且不能以数字开头，长度1-100字符",
            Action:  "请修改备份名称后重试",
        }
        c.JSON(400, resp)
        
    case errors.Is(err, ErrNameAlreadyExists):
        resp = ErrorResponse{
            Code:    "NAME_EXISTS",
            Message: "备份名称已存在",
            Details: err.Error(),
            Action:  "请使用不同的名称或留空自动生成",
        }
        c.JSON(400, resp)
        
    case errors.Is(err, ErrInvalidPath):
        resp = ErrorResponse{
            Code:    "INVALID_PATH",
            Message: "备份路径无效",
            Details: err.Error(),
            Action:  "请检查路径是否存在、是否有写权限",
        }
        c.JSON(400, resp)
        
    case errors.Is(err, ErrInsufficientSpace):
        resp = ErrorResponse{
            Code:    "INSUFFICIENT_SPACE",
            Message: "磁盘空间不足",
            Details: err.Error(),
            Action:  "请清理磁盘空间或选择其他路径",
        }
        c.JSON(400, resp)
        
    case errors.Is(err, ErrPermissionDenied):
        resp = ErrorResponse{
            Code:    "PERMISSION_DENIED",
            Message: "权限不足",
            Details: "无法在指定路径创建备份",
            Action:  "请检查文件系统权限或联系管理员",
        }
        c.JSON(403, resp)
        
    default:
        resp = ErrorResponse{
            Code:    "INTERNAL_ERROR",
            Message: "创建备份失败",
            Details: err.Error(),
            Action:  "请稍后重试或联系技术支持",
        }
        c.JSON(500, resp)
    }
    
    eh.logger.Error("备份创建失败", "error", err, "code", resp.Code)
}

// 处理下载错误
func (eh *ErrorHandler) HandleDownloadError(err error, c *gin.Context) {
    var resp ErrorResponse
    
    switch {
    case errors.Is(err, ErrBackupNotFound):
        resp = ErrorResponse{
            Code:    "BACKUP_NOT_FOUND",
            Message: "备份不存在",
            Details: "请求的备份ID不存在或已被删除",
            Action:  "请刷新备份列表后重试",
        }
        c.JSON(404, resp)
        
    case errors.Is(err, ErrBackupInProgress):
        resp = ErrorResponse{
            Code:    "BACKUP_IN_PROGRESS",
            Message: "备份尚未完成",
            Details: "只能下载状态为成功的备份",
            Action:  "请等待备份完成后再下载",
        }
        c.JSON(400, resp)
        
    case errors.Is(err, ErrDownloadFailed):
        resp = ErrorResponse{
            Code:    "DOWNLOAD_FAILED",
            Message: "下载失败",
            Details: err.Error(),
            Action:  "请点击重试按钮或稍后再试",
        }
        c.JSON(500, resp)
        
    default:
        resp = ErrorResponse{
            Code:    "INTERNAL_ERROR",
            Message: "下载失败",
            Details: err.Error(),
            Action:  "请稍后重试或联系技术支持",
        }
        c.JSON(500, resp)
    }
    
    eh.logger.Error("下载失败", "error", err, "code", resp.Code)
}

// 前端错误处理（React）
/*
import { message, notification } from 'antd';

// 统一错误处理
const handleError = (error) => {
    if (error.response) {
        const { code, message: msg, details, action } = error.response.data;
        
        // 根据错误代码显示不同的提示
        switch (code) {
            case 'INVALID_NAME':
            case 'NAME_EXISTS':
            case 'INVALID_PATH':
                message.error(msg);
                break;
                
            case 'INSUFFICIENT_SPACE':
                notification.warning({
                    message: msg,
                    description: details,
                    duration: 10,
                    btn: (
                        <Button type="primary" size="small" onClick={() => {
                            // 跳转到空间管理页面
                            window.location.href = '/backups/space';
                        }}>
                            查看空间管理
                        </Button>
                    ),
                });
                break;
                
            case 'BACKUP_IN_PROGRESS':
                notification.info({
                    message: msg,
                    description: details,
                    duration: 5,
                });
                break;
                
            case 'DOWNLOAD_FAILED':
                notification.error({
                    message: msg,
                    description: details,
                    duration: 0,
                    btn: (
                        <Button type="primary" size="small" onClick={() => {
                            // 重试下载
                            retryDownload();
                        }}>
                            重试
                        </Button>
                    ),
                });
                break;
                
            default:
                notification.error({
                    message: msg || '操作失败',
                    description: details || error.message,
                    duration: 10,
                });
        }
    } else {
        message.error('网络错误，请检查网络连接');
    }
};

// 取消备份操作
const cancelBackup = async (backupId) => {
    try {
        await axios.post(`/api/v1/backups/${backupId}/cancel`);
        message.success('备份已取消');
        
        // 刷新列表
        refreshBackupList();
    } catch (error) {
        handleError(error);
    }
};

// 带进度的操作
const createBackupWithProgress = async (config) => {
    const hide = message.loading('正在创建备份...', 0);
    
    try {
        const response = await axios.post('/api/v1/backups', config);
        hide();
        
        message.success('备份创建成功');
        return response.data;
    } catch (error) {
        hide();
        handleError(error);
        throw error;
    }
};
*/

// 取消备份操作
func (bm *BackupManager) CancelBackup(backupID string) error {
    // 1. 检查备份状态
    var status string
    err := bm.db.QueryRow("SELECT status FROM backups WHERE id = $1", backupID).Scan(&status)
    if err != nil {
        if err == sql.ErrNoRows {
            return ErrBackupNotFound
        }
        return fmt.Errorf("查询备份状态失败: %w", err)
    }
    
    if status != "IN_PROGRESS" {
        return fmt.Errorf("只能取消进行中的备份，当前状态: %s", status)
    }
    
    // 2. 取消 Elasticsearch 快照
    req := esapi.SnapshotDeleteRequest{
        Repository: bm.repository,
        Snapshot:   []string{backupID},
    }
    
    res, err := req.Do(context.Background(), bm.esClient)
    if err != nil {
        return fmt.Errorf("取消ES快照失败: %w", err)
    }
    defer res.Body.Close()
    
    if res.IsError() {
        return fmt.Errorf("ES返回错误: %s", res.String())
    }
    
    // 3. 更新数据库状态
    _, err = bm.db.Exec(`
        UPDATE backups 
        SET status = 'CANCELLED', updated_at = $1
        WHERE id = $2
    `, time.Now(), backupID)
    
    if err != nil {
        return fmt.Errorf("更新备份状态失败: %w", err)
    }
    
    // 4. 清理临时文件
    go bm.cleanupTempFiles(backupID)
    
    log.Info("备份已取消", "backup_id", backupID)
    return nil
}

// 清理临时文件
func (bm *BackupManager) cleanupTempFiles(backupID string) {
    tempDir := filepath.Join(bm.tempDir, backupID)
    if err := os.RemoveAll(tempDir); err != nil {
        log.Warn("清理临时文件失败", "backup_id", backupID, "error", err)
    } else {
        log.Info("临时文件已清理", "backup_id", backupID)
    }
}
```

**关键实现点**:

1. 定义明确的错误类型，使用 errors.Is 进行错误判断
2. 返回结构化的错误响应，包含错误代码、消息、详情和建议操作
3. 前端统一错误处理，根据错误类型显示不同的提示
4. 支持取消正在进行的备份操作
5. 自动清理取消操作产生的临时文件

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| error_log_level | string | "error" | 错误日志级别 |
| enable_detailed_errors | bool | true | 是否返回详细错误信息 |
| error_notification_duration | int | 10 | 错误通知显示时长（秒） |
| enable_auto_retry | bool | false | 是否启用自动重试 |
| max_retry_attempts | int | 3 | 最大重试次数 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次错误处理）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 错误处理配置变更时，THE System SHALL 应用新配置
3. THE System SHALL 支持通过 API 查询当前生效的错误处理配置
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 17-8：备份导入功能 [Phase 2]

**用户故事**: 

作为用户，我希望能够导入之前下载的备份包，这样我可以在新系统中恢复数据。

**验收标准**:

1. THE UI SHALL 提供"导入备份"按钮
2. WHEN 点击导入按钮时，THE UI SHALL 显示文件选择对话框
3. THE System SHALL 验证上传文件的格式（必须是 tar.gz）
4. THE System SHALL 验证备份包的完整性（校验和）
5. THE UI SHALL 在导入过程中显示进度
6. WHEN 导入成功后，THE 备份 SHALL 出现在备份列表中
7. IF 导入失败，THE System SHALL 显示具体错误原因
8. THE UI SHALL 支持拖拽文件到页面进行导入

**实现方向**:

**实现方式**:

```go
// 导入管理器
type ImportManager struct {
    esClient   *elasticsearch.Client
    metadataDB *sql.DB
    tempDir    string
}

// 导入备份包
func (im *ImportManager) ImportBackup(uploadedFile multipart.File, header *multipart.FileHeader) (*BackupMetadata, error) {
    // 1. 验证文件格式
    if !strings.HasSuffix(header.Filename, ".tar.gz") {
        return nil, fmt.Errorf("不支持的文件格式，必须是 .tar.gz")
    }
    
    // 2. 保存上传文件到临时目录
    tempFile := filepath.Join(im.tempDir, fmt.Sprintf("import_%d_%s", time.Now().Unix(), header.Filename))
    out, err := os.Create(tempFile)
    if err != nil {
        return nil, fmt.Errorf("创建临时文件失败: %w", err)
    }
    defer out.Close()
    defer os.Remove(tempFile)
    
    if _, err := io.Copy(out, uploadedFile); err != nil {
        return nil, fmt.Errorf("保存上传文件失败: %w", err)
    }
    
    // 3. 解压文件
    extractDir := filepath.Join(im.tempDir, fmt.Sprintf("extract_%d", time.Now().Unix()))
    if err := os.MkdirAll(extractDir, 0755); err != nil {
        return nil, fmt.Errorf("创建解压目录失败: %w", err)
    }
    defer os.RemoveAll(extractDir)
    
    if err := im.extractTarGz(tempFile, extractDir); err != nil {
        return nil, fmt.Errorf("解压文件失败: %w", err)
    }
    
    // 4. 读取并验证元数据
    metadataFile := filepath.Join(extractDir, "metadata.json")
    metadataBytes, err := os.ReadFile(metadataFile)
    if err != nil {
        return nil, fmt.Errorf("读取元数据失败: %w", err)
    }
    
    var metadata BackupMetadata
    if err := json.Unmarshal(metadataBytes, &metadata); err != nil {
        return nil, fmt.Errorf("解析元数据失败: %w", err)
    }
    
    // 5. 验证校验和（如果存在）
    if metadata.Checksum != "" {
        calculatedChecksum, err := im.calculateChecksum(tempFile)
        if err != nil {
            log.Warn("计算校验和失败", "error", err)
        } else if calculatedChecksum != metadata.Checksum {
            return nil, fmt.Errorf("校验和不匹配，文件可能已损坏")
        }
    }
    
    // 6. 复制快照数据到 Elasticsearch 仓库
    dataDir := filepath.Join(extractDir, "data")
    targetDir := im.getSnapshotPath(metadata.Repository, metadata.ID)
    
    if err := im.copyDirectory(dataDir, targetDir); err != nil {
        return nil, fmt.Errorf("复制快照数据失败: %w", err)
    }
    
    // 7. 注册快照到 Elasticsearch
    if err := im.registerSnapshot(metadata.Repository, metadata.ID); err != nil {
        return nil, fmt.Errorf("注册快照失败: %w", err)
    }
    
    // 8. 保存元数据到数据库
    metadata.ID = fmt.Sprintf("imported_%s_%d", metadata.ID, time.Now().Unix())
    if err := im.saveMetadata(&metadata); err != nil {
        return nil, fmt.Errorf("保存元数据失败: %w", err)
    }
    
    log.Info("备份导入成功", "backup_id", metadata.ID, "original_name", metadata.Name)
    return &metadata, nil
}

// 解压 tar.gz 文件
func (im *ImportManager) extractTarGz(tarFile, targetDir string) error {
    file, err := os.Open(tarFile)
    if err != nil {
        return err
    }
    defer file.Close()
    
    gzipReader, err := gzip.NewReader(file)
    if err != nil {
        return err
    }
    defer gzipReader.Close()
    
    tarReader := tar.NewReader(gzipReader)
    
    for {
        header, err := tarReader.Next()
        if err == io.EOF {
            break
        }
        if err != nil {
            return err
        }
        
        targetPath := filepath.Join(targetDir, header.Name)
        
        switch header.Typeflag {
        case tar.TypeDir:
            if err := os.MkdirAll(targetPath, 0755); err != nil {
                return err
            }
            
        case tar.TypeReg:
            // 确保父目录存在
            if err := os.MkdirAll(filepath.Dir(targetPath), 0755); err != nil {
                return err
            }
            
            outFile, err := os.Create(targetPath)
            if err != nil {
                return err
            }
            
            if _, err := io.Copy(outFile, tarReader); err != nil {
                outFile.Close()
                return err
            }
            outFile.Close()
        }
    }
    
    return nil
}

// 注册快照到 Elasticsearch
func (im *ImportManager) registerSnapshot(repository, snapshotID string) error {
    // Elasticsearch 会自动识别仓库中的快照
    // 这里只需要验证快照是否可访问
    req := esapi.SnapshotGetRequest{
        Repository: repository,
        Snapshot:   []string{snapshotID},
    }
    
    res, err := req.Do(context.Background(), im.esClient)
    if err != nil {
        return err
    }
    defer res.Body.Close()
    
    if res.IsError() {
        return fmt.Errorf("快照不可访问: %s", res.String())
    }
    
    return nil
}

// HTTP 上传处理器
func (im *ImportManager) UploadHandler(c *gin.Context) {
    // 1. 获取上传文件
    file, header, err := c.Request.FormFile("file")
    if err != nil {
        c.JSON(400, gin.H{"error": "未找到上传文件"})
        return
    }
    defer file.Close()
    
    // 2. 检查文件大小（最大10GB）
    maxSize := int64(10 * 1024 * 1024 * 1024)
    if header.Size > maxSize {
        c.JSON(400, gin.H{"error": "文件过大，最大支持10GB"})
        return
    }
    
    // 3. 显示进度（使用 WebSocket 或 SSE）
    progressChan := make(chan int)
    go im.trackProgress(c, progressChan)
    
    // 4. 导入备份
    metadata, err := im.ImportBackup(file, header)
    if err != nil {
        close(progressChan)
        c.JSON(500, gin.H{"error": fmt.Sprintf("导入失败: %v", err)})
        return
    }
    
    close(progressChan)
    
    c.JSON(201, gin.H{
        "code": 0,
        "message": "导入成功",
        "data": metadata,
    })
}

// 前端拖拽上传组件（React）
/*
import React, { useState } from 'react';
import { Upload, message, Progress } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

const { Dragger } = Upload;

const BackupImport = () => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    
    const uploadProps = {
        name: 'file',
        multiple: false,
        action: '/api/v1/backups/import',
        accept: '.tar.gz',
        maxCount: 1,
        beforeUpload: (file) => {
            // 验证文件格式
            if (!file.name.endsWith('.tar.gz')) {
                message.error('只支持 .tar.gz 格式的备份文件');
                return false;
            }
            
            // 验证文件大小（10GB）
            const maxSize = 10 * 1024 * 1024 * 1024;
            if (file.size > maxSize) {
                message.error('文件过大，最大支持 10GB');
                return false;
            }
            
            setUploading(true);
            setProgress(0);
            return true;
        },
        onChange: (info) => {
            const { status } = info.file;
            
            if (status === 'uploading') {
                setProgress(info.file.percent || 0);
            }
            
            if (status === 'done') {
                setUploading(false);
                message.success(`${info.file.name} 导入成功`);
                // 刷新备份列表
                window.location.reload();
            } else if (status === 'error') {
                setUploading(false);
                message.error(`${info.file.name} 导入失败`);
            }
        },
        onDrop: (e) => {
            console.log('拖拽文件', e.dataTransfer.files);
        },
    };
    
    return (
        <div>
            <Dragger {...uploadProps} disabled={uploading}>
                <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                    点击或拖拽文件到此区域上传
                </p>
                <p className="ant-upload-hint">
                    支持 .tar.gz 格式的备份文件，最大 10GB
                </p>
            </Dragger>
            
            {uploading && (
                <Progress
                    percent={Math.round(progress)}
                    status="active"
                    style={{ marginTop: 16 }}
                />
            )}
        </div>
    );
};

export default BackupImport;
*/
```

**关键实现点**:

1. 验证上传文件格式和大小，防止无效文件
2. 使用 tar 库解压备份包，提取元数据和数据
3. 验证 SHA256 校验和，确保文件完整性
4. 自动注册快照到 Elasticsearch 仓库
5. 支持拖拽上传，提升用户体验

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| max_upload_size_gb | int | 10 | 最大上传文件大小（GB） |
| enable_checksum_verification | bool | true | 是否验证校验和 |
| import_temp_dir | string | "/tmp/backup-imports" | 导入临时目录 |
| auto_cleanup_temp | bool | true | 是否自动清理临时文件 |

**热更新机制**:

- 更新方式: API + 配置文件
- 生效时间: 立即生效（下一次导入操作）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 导入配置变更时，THE System SHALL 应用新配置
3. THE System SHALL 支持通过 API 查询当前生效的导入配置
4. THE System SHALL 记录所有配置变更的审计日志

---

## 需求 17-9：备份空间管理 [Phase 2]

**用户故事**: 

作为用户，我希望能够查看和管理备份占用的存储空间，这样我可以避免磁盘空间不足。

**验收标准**:

1. THE 统计卡片 SHALL 显示总备份大小和可用空间
2. THE UI SHALL 显示每个存储路径的使用情况（已用/总量）
3. WHEN 可用空间低于阈值（如 10%）时，THE System SHALL 显示警告
4. THE System SHALL 支持设置自动清理策略（如保留最近 N 个备份）
5. THE UI SHALL 支持按大小排序备份，方便清理大文件

**实现方向**:

**实现方式**:

```go
// 空间管理器
type SpaceManager struct {
    db          *sql.DB
    config      atomic.Value
    alertSender *AlertSender
}

// 空间统计信息
type SpaceStats struct {
    TotalBackups      int     `json:"total_backups"`
    TotalSizeBytes    int64   `json:"total_size_bytes"`
    TotalSizeGB       float64 `json:"total_size_gb"`
    AvailableSpaceGB  float64 `json:"available_space_gb"`
    UsedSpaceGB       float64 `json:"used_space_gb"`
    UsagePercent      float64 `json:"usage_percent"`
    PathStats         []*PathSpaceStats `json:"path_stats"`
    LargestBackups    []*BackupSizeInfo `json:"largest_backups"`
    OldestBackups     []*BackupAgeInfo  `json:"oldest_backups"`
}

// 路径空间统计
type PathSpaceStats struct {
    Path             string  `json:"path"`
    BackupCount      int     `json:"backup_count"`
    TotalSizeGB      float64 `json:"total_size_gb"`
    AvailableSpaceGB float64 `json:"available_space_gb"`
    UsagePercent     float64 `json:"usage_percent"`
    IsWarning        bool    `json:"is_warning"`
}

// 备份大小信息
type BackupSizeInfo struct {
    ID        string  `json:"id"`
    Name      string  `json:"name"`
    SizeGB    float64 `json:"size_gb"`
    CreatedAt time.Time `json:"created_at"`
}

// 备份年龄信息
type BackupAgeInfo struct {
    ID        string    `json:"id"`
    Name      string    `json:"name"`
    CreatedAt time.Time `json:"created_at"`
    AgeDays   int       `json:"age_days"`
}

// 获取空间统计
func (sm *SpaceManager) GetSpaceStats() (*SpaceStats, error) {
    stats := &SpaceStats{}
    
    // 1. 查询总备份数和总大小
    query := `
        SELECT 
            COUNT(*) as total_backups,
            COALESCE(SUM(size_bytes), 0) as total_size_bytes
        FROM backups
        WHERE status = 'SUCCESS'
    `
    
    err := sm.db.QueryRow(query).Scan(&stats.TotalBackups, &stats.TotalSizeBytes)
    if err != nil {
        return nil, fmt.Errorf("查询备份统计失败: %w", err)
    }
    
    stats.TotalSizeGB = float64(stats.TotalSizeBytes) / (1024 * 1024 * 1024)
    
    // 2. 查询各路径的空间使用情况
    pathQuery := `
        SELECT 
            path,
            COUNT(*) as backup_count,
            COALESCE(SUM(size_bytes), 0) as total_size_bytes
        FROM backups
        WHERE status = 'SUCCESS'
        GROUP BY path
    `
    
    rows, err := sm.db.Query(pathQuery)
    if err != nil {
        return nil, fmt.Errorf("查询路径统计失败: %w", err)
    }
    defer rows.Close()
    
    config := sm.config.Load().(*SpaceConfig)
    pathStats := make([]*PathSpaceStats, 0)
    
    for rows.Next() {
        var path string
        var count int
        var sizeBytes int64
        
        if err := rows.Scan(&path, &count, &sizeBytes); err != nil {
            log.Error("扫描路径统计失败", "error", err)
            continue
        }
        
        // 获取路径的磁盘空间信息
        var stat syscall.Statfs_t
        if err := syscall.Statfs(path, &stat); err != nil {
            log.Warn("获取路径空间信息失败", "path", path, "error", err)
            continue
        }
        
        availableBytes := stat.Bavail * uint64(stat.Bsize)
        totalBytes := stat.Blocks * uint64(stat.Bsize)
        usedBytes := totalBytes - availableBytes
        
        pathStat := &PathSpaceStats{
            Path:             path,
            BackupCount:      count,
            TotalSizeGB:      float64(sizeBytes) / (1024 * 1024 * 1024),
            AvailableSpaceGB: float64(availableBytes) / (1024 * 1024 * 1024),
            UsagePercent:     float64(usedBytes) / float64(totalBytes) * 100,
        }
        
        // 检查是否需要告警
        if pathStat.UsagePercent > config.WarningThreshold*100 {
            pathStat.IsWarning = true
            
            // 发送告警
            sm.sendSpaceAlert(pathStat)
        }
        
        pathStats = append(pathStats, pathStat)
        
        stats.AvailableSpaceGB += pathStat.AvailableSpaceGB
        stats.UsedSpaceGB += pathStat.TotalSizeGB
    }
    
    stats.PathStats = pathStats
    
    // 计算总使用率
    if stats.AvailableSpaceGB+stats.UsedSpaceGB > 0 {
        stats.UsagePercent = stats.UsedSpaceGB / (stats.AvailableSpaceGB + stats.UsedSpaceGB) * 100
    }
    
    // 3. 查询最大的备份
    largestQuery := `
        SELECT id, name, size_bytes, created_at
        FROM backups
        WHERE status = 'SUCCESS'
        ORDER BY size_bytes DESC
        LIMIT 10
    `
    
    rows, err = sm.db.Query(largestQuery)
    if err != nil {
        return nil, fmt.Errorf("查询最大备份失败: %w", err)
    }
    defer rows.Close()
    
    largestBackups := make([]*BackupSizeInfo, 0)
    for rows.Next() {
        var info BackupSizeInfo
        var sizeBytes int64
        
        if err := rows.Scan(&info.ID, &info.Name, &sizeBytes, &info.CreatedAt); err != nil {
            log.Error("扫描备份信息失败", "error", err)
            continue
        }
        
        info.SizeGB = float64(sizeBytes) / (1024 * 1024 * 1024)
        largestBackups = append(largestBackups, &info)
    }
    
    stats.LargestBackups = largestBackups
    
    // 4. 查询最旧的备份
    oldestQuery := `
        SELECT id, name, created_at
        FROM backups
        WHERE status = 'SUCCESS'
        ORDER BY created_at ASC
        LIMIT 10
    `
    
    rows, err = sm.db.Query(oldestQuery)
    if err != nil {
        return nil, fmt.Errorf("查询最旧备份失败: %w", err)
    }
    defer rows.Close()
    
    oldestBackups := make([]*BackupAgeInfo, 0)
    now := time.Now()
    
    for rows.Next() {
        var info BackupAgeInfo
        
        if err := rows.Scan(&info.ID, &info.Name, &info.CreatedAt); err != nil {
            log.Error("扫描备份信息失败", "error", err)
            continue
        }
        
        info.AgeDays = int(now.Sub(info.CreatedAt).Hours() / 24)
        oldestBackups = append(oldestBackups, &info)
    }
    
    stats.OldestBackups = oldestBackups
    
    return stats, nil
}

// 自动清理策略
type CleanupPolicy struct {
    Enabled          bool `json:"enabled"`
    KeepLastN        int  `json:"keep_last_n"`        // 保留最近N个备份
    KeepDays         int  `json:"keep_days"`          // 保留N天内的备份
    MinFreeSpaceGB   float64 `json:"min_free_space_gb"` // 最小可用空间
}

// 执行自动清理
func (sm *SpaceManager) AutoCleanup() error {
    config := sm.config.Load().(*SpaceConfig)
    policy := config.CleanupPolicy
    
    if !policy.Enabled {
        return nil
    }
    
    log.Info("开始执行自动清理", "policy", policy)
    
    // 1. 查询所有备份，按创建时间排序
    query := `
        SELECT id, name, created_at, size_bytes, path
        FROM backups
        WHERE status = 'SUCCESS'
        ORDER BY created_at DESC
    `
    
    rows, err := sm.db.Query(query)
    if err != nil {
        return fmt.Errorf("查询备份列表失败: %w", err)
    }
    defer rows.Close()
    
    backups := make([]*BackupInfo, 0)
    for rows.Next() {
        var info BackupInfo
        if err := rows.Scan(&info.ID, &info.Name, &info.CreatedAt, &info.SizeBytes, &info.Path); err != nil {
            log.Error("扫描备份信息失败", "error", err)
            continue
        }
        backups = append(backups, &info)
    }
    
    // 2. 应用清理策略
    toDelete := make([]string, 0)
    now := time.Now()
    
    for i, backup := range backups {
        shouldDelete := false
        reason := ""
        
        // 保留最近N个备份
        if policy.KeepLastN > 0 && i >= policy.KeepLastN {
            shouldDelete = true
            reason = fmt.Sprintf("超出保留数量限制（保留最近%d个）", policy.KeepLastN)
        }
        
        // 保留N天内的备份
        if policy.KeepDays > 0 {
            ageDays := int(now.Sub(backup.CreatedAt).Hours() / 24)
            if ageDays > policy.KeepDays {
                shouldDelete = true
                reason = fmt.Sprintf("超出保留时间限制（保留%d天）", policy.KeepDays)
            }
        }
        
        // 检查可用空间
        if policy.MinFreeSpaceGB > 0 {
            var stat syscall.Statfs_t
            if err := syscall.Statfs(backup.Path, &stat); err == nil {
                availableGB := float64(stat.Bavail*uint64(stat.Bsize)) / (1024 * 1024 * 1024)
                if availableGB < policy.MinFreeSpaceGB {
                    shouldDelete = true
                    reason = fmt.Sprintf("可用空间不足（%.2f GB < %.2f GB）", availableGB, policy.MinFreeSpaceGB)
                }
            }
        }
        
        if shouldDelete {
            toDelete = append(toDelete, backup.ID)
            log.Info("标记删除备份", "id", backup.ID, "name", backup.Name, "reason", reason)
        }
    }
    
    // 3. 执行删除
    if len(toDelete) > 0 {
        for _, id := range toDelete {
            if err := sm.deleteBackup(id); err != nil {
                log.Error("删除备份失败", "id", id, "error", err)
            } else {
                log.Info("备份已删除", "id", id)
            }
        }
    }
    
    log.Info("自动清理完成", "deleted_count", len(toDelete))
    return nil
}

// 发送空间告警
func (sm *SpaceManager) sendSpaceAlert(pathStat *PathSpaceStats) {
    alert := &Alert{
        Level:   "warning",
        Title:   "备份空间不足",
        Message: fmt.Sprintf("路径 %s 的磁盘使用率已达 %.1f%%", pathStat.Path, pathStat.UsagePercent),
        Details: map[string]interface{}{
            "path":              pathStat.Path,
            "usage_percent":     pathStat.UsagePercent,
            "available_space_gb": pathStat.AvailableSpaceGB,
            "backup_count":      pathStat.BackupCount,
        },
    }
    
    if err := sm.alertSender.Send(alert); err != nil {
        log.Error("发送告警失败", "error", err)
    }
}

// 空间配置
type SpaceConfig struct {
    WarningThreshold float64       `json:"warning_threshold"` // 0.9 = 90%
    CleanupPolicy    CleanupPolicy `json:"cleanup_policy"`
}

// 备份信息
type BackupInfo struct {
    ID        string
    Name      string
    CreatedAt time.Time
    SizeBytes int64
    Path      string
}
```

**关键实现点**:

1. 实时统计各路径的空间使用情况，使用 syscall.Statfs 获取磁盘信息
2. 自动检测空间不足并发送告警
3. 支持多种清理策略（保留最近N个、保留N天、最小可用空间）
4. 提供最大备份和最旧备份列表，方便手动清理
5. 定期执行自动清理任务，释放磁盘空间

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| warning_threshold | float64 | 0.9 | 空间告警阈值（90%） |
| cleanup_enabled | bool | false | 是否启用自动清理 |
| keep_last_n | int | 10 | 保留最近N个备份 |
| keep_days | int | 30 | 保留N天内的备份 |
| min_free_space_gb | float64 | 50.0 | 最小可用空间（GB） |
| cleanup_interval_hours | int | 24 | 清理任务执行间隔（小时） |

**热更新机制**:

- 更新方式: API + PostgreSQL 配置表
- 生效时间: 立即生效（下一次统计或清理）
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即生效
2. WHEN 清理策略变更时，THE System SHALL 应用新策略
3. THE System SHALL 支持通过 API 查询当前生效的空间管理配置
4. THE System SHALL 记录所有配置变更的审计日志
5. WHEN 自动清理执行时，THE System SHALL 记录清理日志

---

# 模块十七 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-17-01 | 创建备份 | Backup | POST | /api/v1/backups | backup.write | Body: {type,name,description,custom_path,index_pattern} | {code:0,data:{id:"backup-1"}} | 201/400/401/403/500 | v1 | 否 | 否 | - | 支持自定义配置 |
| API-17-02 | 列出备份 | Backup | GET | /api/v1/backups | backup.read | Query: filter,sort,page,size | {code:0,data:{items:[],total:0}} | 200/401/403/500 | v1 | 是 | 否 | - | 支持筛选排序 |
| API-17-03 | 获取备份详情 | Backup | GET | /api/v1/backups/{id} | backup.read | 无 | {code:0,data:{...}} | 200/401/403/404/500 | v1 | 是 | 是 | - | - |
| API-17-04 | 更新备份 | Backup | PUT | /api/v1/backups/{id} | backup.write | Body: {name,description} | {code:0,message:"ok"} | 200/400/401/403/404/500 | v1 | 是 | 否 | - | 仅更新元数据 |
| API-17-05 | 删除备份 | Backup | DELETE | /api/v1/backups/{id} | backup.write | 无 | {code:0,message:"ok"} | 204/401/403/404/500 | v1 | 是 | 否 | - | - |
| API-17-06 | 下载备份 | Backup | GET | /api/v1/backups/{id}/download | backup.read | Query: range | Binary | 200/206/401/403/404/500 | v1 | 是 | 否 | - | 支持断点续传 |
| API-17-07 | 导入备份 | Backup | POST | /api/v1/backups/import | backup.write | Body: multipart/form-data | {code:0,data:{id:"backup-1"}} | 201/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-17-08 | 获取备份统计 | Backup | GET | /api/v1/backups/stats | backup.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-17-09 | 获取可用路径 | Backup | GET | /api/v1/backups/paths | backup.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | 包含空间信息 |
| API-17-10 | 验证路径 | Backup | POST | /api/v1/backups/paths/validate | backup.read | Body: {path} | {code:0,data:{valid:true}} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-17-11 | 批量删除备份 | Backup | POST | /api/v1/backups/batch-delete | backup.write | Body: {ids:[]} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-17-12 | 取消备份 | Backup | POST | /api/v1/backups/{id}/cancel | backup.write | 无 | {code:0,message:"ok"} | 200/401/403/404/500 | v1 | 是 | 否 | - | 仅进行中的备份 |
