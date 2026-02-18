# 模块十九：通用日志采集代理

> **文档版本**: v1.0  
> **创建日期**: 2026-01-31  
> **所属模块**: 模块十九：通用日志采集代理  
> **需求编号**: 

---

**模块概述**: 

通用日志采集代理（Universal Log Agent）是一个轻量级、高性能的日志采集组件，能够在被监测端通过简单部署实现各类日志的增量采集，并在日志生成后3秒内完成采集和传输。支持50+种日志来源，包括文件、容器、数据库、网络设备、云服务、IoT设备等。

**模块技术栈**:
- 开发语言：Go 1.21+ (轻量级、跨平台、高性能)
- 文件监控：inotify (Linux) / FSEvents (macOS) / ReadDirectoryChangesW (Windows)
- 容器集成：Docker API / Kubernetes API
- 协议支持：Syslog / MQTT / HTTP / gRPC / SNMP
- 传输层：Kafka / HTTP(S) / gRPC
- 压缩算法：gzip / lz4 / zstd
- 本地缓冲：BoltDB (嵌入式 KV 存储)
- 配置管理：YAML / 环境变量 / 热加载

**模块架构**:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                            通用日志采集代理整体架构                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            输入插件层（Input Plugins）                                  │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │ │
│  │  │  File    │  │  Docker  │  │  Syslog  │  │  MQTT    │  │  HTTP    │              │ │
│  │  │  Watcher │  │  Logs    │  │  Server  │  │  Client  │  │  Server  │              │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │ │
│  │       │             │             │             │             │                      │ │
│  │  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐              │ │
│  │  │ Database │  │  Cloud   │  │  IoT     │  │ Network  │  │  System  │              │ │
│  │  │  Logs    │  │  Logs    │  │  Devices │  │  Devices │  │  Logs    │              │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │ │
│  │       └─────────────┴─────────────┴─────────────┴─────────────┘                    │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            检查点管理器（Checkpoint Manager）                          │ │
│  │  • 记录每个输入源的采集位置（文件偏移量/时间戳）                                      │ │
│  │  • 持久化到 BoltDB，确保重启后继续采集                                                │ │
│  │  • 支持文件轮转检测（inode 跟踪）                                                     │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            处理管道（Processing Pipeline）                             │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ 格式解析     │───▶│ 字段提取     │───▶│ 元数据添加    │                           │ │
│  │  │ (多格式支持) │    │ (正则/Grok)  │    │ (主机/标签)   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            本地缓冲层（Local Buffer）                                  │ │
│  │  ┌──────────────┐    ┌──────────────┐                                                │ │
│  │  │ 内存队列     │───▶│ 持久化缓存    │                                                │ │
│  │  │ (Ring Buffer)│    │ (BoltDB)     │                                                │ │
│  │  │ 快速写入     │    │ 断线保护     │                                                │ │
│  │  └──────────────┘    └──────────────┘                                                │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            输出层（Output Layer）                                      │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Kafka        │    │ HTTP(S)      │    │ gRPC         │                           │ │
│  │  │ Producer     │    │ Client       │    │ Client       │                           │ │
│  │  │ • 批量发送   │    │ • 压缩传输   │    │ • TLS 加密   │                           │ │
│  │  │ • 压缩       │    │ • 重试机制   │    │ • 流式传输   │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └─────────────────────────────────────┬───────────────────────────────────────────────┘ │
│                                        │                                                 │
│                                        ▼                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────────────────┐ │
│  │                            监控与管理层                                                │ │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                           │ │
│  │  │ Prometheus   │    │ 健康检查     │    │ 配置热加载    │                           │ │
│  │  │ Metrics      │    │ /health      │    │ (SIGHUP)     │                           │ │
│  │  └──────────────┘    └──────────────┘    └──────────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:

1. **输入插件层**: 支持50+种日志来源，插件化架构，易于扩展
2. **检查点管理器**: 记录采集位置，支持增量采集和断点续传
3. **处理管道**: 格式解析、字段提取、元数据添加
4. **本地缓冲层**: 内存队列 + 持久化缓存，保证数据不丢失
5. **输出层**: 支持多种传输协议，批量发送，压缩传输
6. **监控与管理层**: Prometheus 指标、健康检查、配置热加载

**数据流向**:

```
日志源 → 输入插件 → 检查点记录 → 处理管道 → 本地缓冲 → 输出传输 → 中央服务器
         ↑                                                      ↓
         └──────────────── 配置热加载 ──────────────────────────┘
```


**需求列表**:
- 需求 19-1：文件日志增量采集 [MVP]
- 需求 19-2：容器日志采集 [MVP]
- 需求 19-3：数据库日志采集 [Phase 2]
- 需求 19-4：网络设备日志采集 [Phase 2]
- 需求 19-5：云服务日志采集 [Phase 2]
- 需求 19-6：IoT 设备日志采集 [Phase 2]
- 需求 19-7：系统日志采集 [MVP]
- 需求 19-8：日志传输与可靠性 [MVP]
- 需求 19-9：简单部署与配置 [MVP]
- 需求 19-10：监控与健康检查 [MVP]
- 需求 19-11：安全日志采集 [Phase 2]
- 需求 19-12：中间件日志采集 [Phase 2]
- 需求 19-13：应用服务器日志采集 [Phase 2]
- 需求 19-14：大数据平台日志采集 [Phase 2]
- 需求 19-15：CI/CD 日志采集 [Phase 2]
- 需求 19-16：通信服务日志采集 [Phase 2]
- 需求 19-17：虚拟化平台日志采集 [Phase 2]
- 需求 19-18：工业协议日志采集 [Phase 2]

---

## 需求 19-1：文件日志增量采集 [MVP]

**用户故事**: 

作为运维工程师，我希望能够实时采集服务器上的日志文件，以便在日志生成后立即进行分析。

**验收标准**:

1. WHEN 日志文件有新内容写入时，THE Log_Agent SHALL 在 1 秒内检测到变化
2. THE Log_Agent SHALL 使用操作系统原生文件监控机制（Linux: inotify, macOS: FSEvents, Windows: ReadDirectoryChangesW）
3. THE Log_Agent SHALL 维护每个文件的采集位置检查点，确保重启后从上次位置继续采集
4. IF 日志文件发生轮转（rotate）时，THEN THE Log_Agent SHALL 自动检测并切换到新文件
5. THE Log_Agent SHALL 支持通配符路径匹配（如 `/var/log/*.log`）
6. WHEN 采集到新日志后，THE Log_Agent SHALL 在 2 秒内完成传输到中央服务器
7. THE Log_Agent SHALL 支持多行日志合并（如 Java 堆栈跟踪）

**实现方向**:

**实现方式**:

```go
// 文件监控器
type FileWatcher struct {
    watcher    *fsnotify.Watcher
    registry   *Registry
    checkpointer *Checkpointer
    processor  *Processor
    config     atomic.Value
}

// 文件注册表（记录正在监控的文件）
type Registry struct {
    files map[string]*FileState
    mu    sync.RWMutex
}

// 文件状态
type FileState struct {
    Path      string
    Inode     uint64
    Offset    int64
    LastRead  time.Time
    Multiline *MultilineState
}

// 多行日志状态
type MultilineState struct {
    Pattern     *regexp.Regexp
    Buffer      []string
    StartTime   time.Time
    MaxLines    int
    MaxDuration time.Duration
}

// 检查点管理器（使用 BoltDB 持久化）
type Checkpointer struct {
    db *bolt.DB
}

// 启动文件监控
func (fw *FileWatcher) Start(ctx context.Context, paths []string) error {
    // 1. 创建文件系统监控器
    var err error
    fw.watcher, err = fsnotify.NewWatcher()
    if err != nil {
        return fmt.Errorf("创建文件监控器失败: %w", err)
    }
    
    // 2. 添加监控路径（支持通配符）
    for _, pattern := range paths {
        matches, err := filepath.Glob(pattern)
        if err != nil {
            log.Warn("解析路径模式失败", "pattern", pattern, "error", err)
            continue
        }
        
        for _, path := range matches {
            if err := fw.addFile(path); err != nil {
                log.Error("添加文件监控失败", "path", path, "error", err)
                continue
            }
        }
    }
    
    // 3. 启动事件处理循环
    go fw.eventLoop(ctx)
    
    log.Info("文件监控已启动", "file_count", len(fw.registry.files))
    return nil
}

// 添加文件监控
func (fw *FileWatcher) addFile(path string) error {
    // 1. 获取文件信息
    info, err := os.Stat(path)
    if err != nil {
        return fmt.Errorf("获取文件信息失败: %w", err)
    }
    
    if info.IsDir() {
        return fmt.Errorf("路径是目录，不是文件: %s", path)
    }
    
    // 2. 获取 inode（用于检测文件轮转）
    inode := getInode(info)
    
    // 3. 从检查点恢复偏移量
    offset, err := fw.checkpointer.Load(path, inode)
    if err != nil {
        log.Warn("加载检查点失败，从文件末尾开始", "path", path, "error", err)
        offset = info.Size() // 从文件末尾开始
    }
    
    // 4. 注册文件状态
    fw.registry.mu.Lock()
    fw.registry.files[path] = &FileState{
        Path:     path,
        Inode:    inode,
        Offset:   offset,
        LastRead: time.Now(),
    }
    fw.registry.mu.Unlock()
    
    // 5. 添加到监控器
    if err := fw.watcher.Add(path); err != nil {
        return fmt.Errorf("添加文件监控失败: %w", err)
    }
    
    // 6. 读取现有内容（如果有新数据）
    if offset < info.Size() {
        go fw.readFile(path)
    }
    
    log.Info("文件已添加到监控", "path", path, "inode", inode, "offset", offset)
    return nil
}

// 事件处理循环
func (fw *FileWatcher) eventLoop(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            log.Info("文件监控已停止")
            return
            
        case event, ok := <-fw.watcher.Events:
            if !ok {
                return
            }
            
            fw.handleEvent(event)
            
        case err, ok := <-fw.watcher.Errors:
            if !ok {
                return
            }
            log.Error("文件监控错误", "error", err)
        }
    }
}

// 处理文件事件
func (fw *FileWatcher) handleEvent(event fsnotify.Event) {
    switch {
    case event.Op&fsnotify.Write == fsnotify.Write:
        // 文件被写入
        log.Debug("文件被修改", "path", event.Name)
        fw.readFile(event.Name)
        
    case event.Op&fsnotify.Create == fsnotify.Create:
        // 新文件创建（可能是日志轮转）
        log.Info("检测到新文件", "path", event.Name)
        fw.handleRotation(event.Name)
        
    case event.Op&fsnotify.Remove == fsnotify.Remove:
        // 文件被删除
        log.Info("文件被删除", "path", event.Name)
        fw.removeFile(event.Name)
        
    case event.Op&fsnotify.Rename == fsnotify.Rename:
        // 文件被重命名（日志轮转）
        log.Info("文件被重命名", "path", event.Name)
        fw.handleRotation(event.Name)
    }
}

// 读取文件内容
func (fw *FileWatcher) readFile(path string) {
    fw.registry.mu.RLock()
    state, exists := fw.registry.files[path]
    fw.registry.mu.RUnlock()
    
    if !exists {
        return
    }
    
    // 1. 打开文件
    file, err := os.Open(path)
    if err != nil {
        log.Error("打开文件失败", "path", path, "error", err)
        return
    }
    defer file.Close()
    
    // 2. 定位到上次读取位置
    if _, err := file.Seek(state.Offset, 0); err != nil {
        log.Error("定位文件失败", "path", path, "offset", state.Offset, "error", err)
        return
    }
    
    // 3. 读取新内容
    scanner := bufio.NewScanner(file)
    scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024) // 1MB 最大行长度
    
    lineCount := 0
    for scanner.Scan() {
        line := scanner.Text()
        
        // 4. 处理多行日志
        if fw.isMultilineStart(line) {
            // 刷新之前的多行缓冲
            if state.Multiline != nil && len(state.Multiline.Buffer) > 0 {
                fw.processMultiline(path, state.Multiline.Buffer)
                state.Multiline.Buffer = nil
            }
            
            // 开始新的多行日志
            if state.Multiline == nil {
                state.Multiline = &MultilineState{
                    Buffer:      make([]string, 0, 10),
                    MaxLines:    100,
                    MaxDuration: 5 * time.Second,
                }
            }
            state.Multiline.Buffer = append(state.Multiline.Buffer, line)
            state.Multiline.StartTime = time.Now()
        } else if state.Multiline != nil && len(state.Multiline.Buffer) > 0 {
            // 继续多行日志
            state.Multiline.Buffer = append(state.Multiline.Buffer, line)
            
            // 检查是否达到最大行数或超时
            if len(state.Multiline.Buffer) >= state.Multiline.MaxLines ||
                time.Since(state.Multiline.StartTime) > state.Multiline.MaxDuration {
                fw.processMultiline(path, state.Multiline.Buffer)
                state.Multiline.Buffer = nil
            }
        } else {
            // 单行日志
            fw.processLine(path, line)
        }
        
        lineCount++
    }
    
    if err := scanner.Err(); err != nil {
        log.Error("读取文件失败", "path", path, "error", err)
        return
    }
    
    // 5. 更新偏移量
    newOffset, _ := file.Seek(0, io.SeekCurrent)
    state.Offset = newOffset
    state.LastRead = time.Now()
    
    // 6. 保存检查点
    if err := fw.checkpointer.Save(path, state.Inode, newOffset); err != nil {
        log.Error("保存检查点失败", "path", path, "error", err)
    }
    
    if lineCount > 0 {
        log.Debug("文件读取完成", "path", path, "lines", lineCount, "offset", newOffset)
    }
}

// 处理日志轮转
func (fw *FileWatcher) handleRotation(path string) {
    fw.registry.mu.RLock()
    oldState, exists := fw.registry.files[path]
    fw.registry.mu.RUnlock()
    
    if !exists {
        // 新文件，直接添加
        fw.addFile(path)
        return
    }
    
    // 检查 inode 是否变化
    info, err := os.Stat(path)
    if err != nil {
        log.Error("获取文件信息失败", "path", path, "error", err)
        return
    }
    
    newInode := getInode(info)
    if newInode != oldState.Inode {
        log.Info("检测到文件轮转", "path", path, "old_inode", oldState.Inode, "new_inode", newInode)
        
        // 读取旧文件的剩余内容
        fw.readFile(path)
        
        // 更新为新文件
        fw.registry.mu.Lock()
        fw.registry.files[path] = &FileState{
            Path:     path,
            Inode:    newInode,
            Offset:   0,
            LastRead: time.Now(),
        }
        fw.registry.mu.Unlock()
    }
}

// 判断是否为多行日志的开始
func (fw *FileWatcher) isMultilineStart(line string) bool {
    config := fw.config.Load().(*FileWatcherConfig)
    if config.MultilinePattern == nil {
        return false
    }
    return config.MultilinePattern.MatchString(line)
}

// 处理多行日志
func (fw *FileWatcher) processMultiline(path string, lines []string) {
    message := strings.Join(lines, "\n")
    fw.processor.Process(&LogEntry{
        Source:    path,
        Message:   message,
        Timestamp: time.Now(),
        Fields: map[string]interface{}{
            "multiline": true,
            "line_count": len(lines),
        },
    })
}

// 处理单行日志
func (fw *FileWatcher) processLine(path string, line string) {
    fw.processor.Process(&LogEntry{
        Source:    path,
        Message:   line,
        Timestamp: time.Now(),
    })
}

// 获取文件 inode（跨平台）
func getInode(info os.FileInfo) uint64 {
    if stat, ok := info.Sys().(*syscall.Stat_t); ok {
        return stat.Ino
    }
    return 0
}

// 文件监控配置
type FileWatcherConfig struct {
    Paths            []string
    MultilinePattern *regexp.Regexp
    MaxLineLength    int
    BufferSize       int
}
```

**关键实现点**:

1. 使用 fsnotify 实现跨平台文件监控（Linux/macOS/Windows）
2. 通过 inode 跟踪检测文件轮转，自动切换到新文件
3. 使用 BoltDB 持久化检查点，确保重启后继续采集
4. 支持多行日志合并（如 Java 堆栈跟踪）
5. 支持通配符路径匹配，自动发现新文件

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| file_paths | array | [] | 监控的文件路径列表 |
| multiline_pattern | string | "" | 多行日志起始模式（正则） |
| max_line_length | int | 1048576 | 最大行长度（字节） |
| buffer_size | int | 65536 | 读取缓冲区大小 |
| checkpoint_interval | int | 5 | 检查点保存间隔（秒） |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态添加/删除监控路径
4. THE System SHALL 在配置变更后记录审计日志

---

## 需求 19-2：容器日志采集 [MVP]

**用户故事**: 

作为 DevOps 工程师，我希望能够自动采集所有容器的日志，以便统一管理容器化应用的日志。

**验收标准**:

1. THE Log_Agent SHALL 自动发现运行中的 Docker 容器并采集其日志
2. WHEN 新容器启动时，THE Log_Agent SHALL 在 3 秒内开始采集其日志
3. THE Log_Agent SHALL 支持通过容器标签（labels）过滤需要采集的容器
4. THE Log_Agent SHALL 自动为日志添加容器元数据（容器名、镜像名、容器 ID）
5. THE Log_Agent SHALL 支持 Kubernetes Pod 日志采集，自动添加 Pod/Namespace/Node 元数据
6. IF 容器停止运行，THEN THE Log_Agent SHALL 完成剩余日志采集后释放资源

**实现方向**:

使用 Docker API 和 Kubernetes API 自动发现容器，通过容器运行时接口采集日志。

**实现方式**:

```go
// 容器日志采集器
type ContainerCollector struct {
    dockerClient *docker.Client
    k8sClient    *kubernetes.Clientset
    containers   map[string]*ContainerReader
    config       atomic.Value
    mu           sync.RWMutex
}

// 容器读取器
type ContainerReader struct {
    ID          string
    Name        string
    Image       string
    Labels      map[string]string
    Metadata    map[string]interface{}
    LogStream   io.ReadCloser
    Cancel      context.CancelFunc
    LastRead    time.Time
}

// 容器配置
type ContainerConfig struct {
    Docker     DockerConfig
    Kubernetes K8sConfig
}

// Docker 配置
type DockerConfig struct {
    Enabled       bool
    SocketPath    string
    IncludeLabels map[string]string
    ExcludeLabels map[string]string
}

// Kubernetes 配置
type K8sConfig struct {
    Enabled    bool
    Kubeconfig string
    Namespaces []string
    NodeName   string
}

// 启动容器日志采集
func (cc *ContainerCollector) Start(ctx context.Context) error {
    config := cc.config.Load().(*ContainerConfig)
    
    // 1. 初始化 Docker 客户端
    if config.Docker.Enabled {
        var err error
        cc.dockerClient, err = docker.NewClient(config.Docker.SocketPath)
        if err != nil {
            return fmt.Errorf("创建 Docker 客户端失败: %w", err)
        }
        
        // 启动 Docker 容器监控
        go cc.watchDockerContainers(ctx)
    }
    
    // 2. 初始化 Kubernetes 客户端
    if config.Kubernetes.Enabled {
        kubeconfig, err := clientcmd.BuildConfigFromFlags("", config.Kubernetes.Kubeconfig)
        if err != nil {
            return fmt.Errorf("加载 Kubernetes 配置失败: %w", err)
        }
        
        cc.k8sClient, err = kubernetes.NewForConfig(kubeconfig)
        if err != nil {
            return fmt.Errorf("创建 Kubernetes 客户端失败: %w", err)
        }
        
        // 启动 Kubernetes Pod 监控
        go cc.watchK8sPods(ctx)
    }
    
    log.Info("容器日志采集已启动")
    return nil
}

// 监控 Docker 容器
func (cc *ContainerCollector) watchDockerContainers(ctx context.Context) {
    config := cc.config.Load().(*ContainerConfig)
    
    // 1. 获取现有容器
    containers, err := cc.dockerClient.ContainerList(ctx, types.ContainerListOptions{})
    if err != nil {
        log.Error("获取容器列表失败", "error", err)
        return
    }
    
    // 2. 为现有容器启动日志采集
    for _, container := range containers {
        if cc.shouldCollect(container.Labels, config.Docker) {
            cc.startContainerReader(ctx, container.ID, container.Names[0], container.Image, container.Labels)
        }
    }
    
    // 3. 监听容器事件
    eventChan, errChan := cc.dockerClient.Events(ctx, types.EventsOptions{
        Filters: filters.NewArgs(
            filters.Arg("type", "container"),
            filters.Arg("event", "start"),
            filters.Arg("event", "die"),
        ),
    })
    
    for {
        select {
        case <-ctx.Done():
            return
            
        case event := <-eventChan:
            switch event.Action {
            case "start":
                // 新容器启动
                log.Info("检测到新容器启动", "id", event.Actor.ID[:12])
                
                // 获取容器详情
                container, err := cc.dockerClient.ContainerInspect(ctx, event.Actor.ID)
                if err != nil {
                    log.Error("获取容器详情失败", "id", event.Actor.ID[:12], "error", err)
                    continue
                }
                
                if cc.shouldCollect(container.Config.Labels, config.Docker) {
                    cc.startContainerReader(ctx, container.ID, container.Name, container.Config.Image, container.Config.Labels)
                }
                
            case "die":
                // 容器停止
                log.Info("检测到容器停止", "id", event.Actor.ID[:12])
                cc.stopContainerReader(event.Actor.ID)
            }
            
        case err := <-errChan:
            log.Error("Docker 事件监听错误", "error", err)
        }
    }
}

// 监控 Kubernetes Pod
func (cc *ContainerCollector) watchK8sPods(ctx context.Context) {
    config := cc.config.Load().(*ContainerConfig)
    
    // 创建 Pod 监听器
    for _, namespace := range config.Kubernetes.Namespaces {
        go cc.watchNamespace(ctx, namespace)
    }
}

// 监控指定命名空间的 Pod
func (cc *ContainerCollector) watchNamespace(ctx context.Context, namespace string) {
    config := cc.config.Load().(*ContainerConfig)
    
    // 创建 Informer
    factory := informers.NewSharedInformerFactoryWithOptions(
        cc.k8sClient,
        time.Minute,
        informers.WithNamespace(namespace),
    )
    
    podInformer := factory.Core().V1().Pods().Informer()
    
    // 注册事件处理器
    podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
        AddFunc: func(obj interface{}) {
            pod := obj.(*corev1.Pod)
            
            // 过滤节点
            if config.Kubernetes.NodeName != "" && pod.Spec.NodeName != config.Kubernetes.NodeName {
                return
            }
            
            // 等待 Pod 运行
            if pod.Status.Phase != corev1.PodRunning {
                return
            }
            
            log.Info("检测到新 Pod", "namespace", pod.Namespace, "pod", pod.Name)
            cc.startPodReader(ctx, pod)
        },
        
        DeleteFunc: func(obj interface{}) {
            pod := obj.(*corev1.Pod)
            log.Info("检测到 Pod 删除", "namespace", pod.Namespace, "pod", pod.Name)
            cc.stopPodReader(pod)
        },
    })
    
    // 启动 Informer
    factory.Start(ctx.Done())
    factory.WaitForCacheSync(ctx.Done())
}

// 启动容器日志读取器
func (cc *ContainerCollector) startContainerReader(ctx context.Context, containerID, name, image string, labels map[string]string) {
    cc.mu.Lock()
    defer cc.mu.Unlock()
    
    // 检查是否已存在
    if _, exists := cc.containers[containerID]; exists {
        return
    }
    
    // 创建子上下文
    readerCtx, cancel := context.WithCancel(ctx)
    
    // 获取日志流
    logOptions := types.ContainerLogsOptions{
        ShowStdout: true,
        ShowStderr: true,
        Follow:     true,
        Timestamps: true,
        Tail:       "0", // 从当前位置开始
    }
    
    logStream, err := cc.dockerClient.ContainerLogs(readerCtx, containerID, logOptions)
    if err != nil {
        log.Error("获取容器日志流失败", "id", containerID[:12], "error", err)
        cancel()
        return
    }
    
    // 创建读取器
    reader := &ContainerReader{
        ID:        containerID,
        Name:      name,
        Image:     image,
        Labels:    labels,
        LogStream: logStream,
        Cancel:    cancel,
        LastRead:  time.Now(),
        Metadata: map[string]interface{}{
            "container_id":   containerID,
            "container_name": name,
            "image":          image,
            "labels":         labels,
        },
    }
    
    cc.containers[containerID] = reader
    
    // 启动日志读取协程
    go cc.readContainerLogs(readerCtx, reader)
    
    log.Info("容器日志采集已启动", "id", containerID[:12], "name", name)
}

// 读取容器日志
func (cc *ContainerCollector) readContainerLogs(ctx context.Context, reader *ContainerReader) {
    defer reader.LogStream.Close()
    
    scanner := bufio.NewScanner(reader.LogStream)
    scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024) // 1MB 最大行长度
    
    for scanner.Scan() {
        select {
        case <-ctx.Done():
            return
        default:
        }
        
        line := scanner.Text()
        
        // Docker 日志格式：8字节头部 + 日志内容
        // 头部格式：[stream_type(1字节)][padding(3字节)][size(4字节)]
        if len(line) > 8 {
            line = line[8:] // 跳过头部
        }
        
        // 解析时间戳（如果有）
        timestamp := time.Now()
        if strings.Contains(line, " ") {
            parts := strings.SplitN(line, " ", 2)
            if t, err := time.Parse(time.RFC3339Nano, parts[0]); err == nil {
                timestamp = t
                if len(parts) > 1 {
                    line = parts[1]
                }
            }
        }
        
        // 处理日志条目
        cc.processLog(&LogEntry{
            Source:    fmt.Sprintf("docker/%s", reader.Name),
            Message:   line,
            Timestamp: timestamp.Format(time.RFC3339Nano),
            Fields:    reader.Metadata,
        })
        
        reader.LastRead = time.Now()
    }
    
    if err := scanner.Err(); err != nil {
        log.Error("读取容器日志失败", "id", reader.ID[:12], "error", err)
    }
}

// 启动 Pod 日志读取器
func (cc *ContainerCollector) startPodReader(ctx context.Context, pod *corev1.Pod) {
    // 为 Pod 中的每个容器启动日志采集
    for _, container := range pod.Spec.Containers {
        go cc.readPodContainerLogs(ctx, pod, container.Name)
    }
}

// 读取 Pod 容器日志
func (cc *ContainerCollector) readPodContainerLogs(ctx context.Context, pod *corev1.Pod, containerName string) {
    // 构造日志请求
    logOptions := &corev1.PodLogOptions{
        Container:  containerName,
        Follow:     true,
        Timestamps: true,
        TailLines:  ptr.Int64(0), // 从当前位置开始
    }
    
    // 获取日志流
    req := cc.k8sClient.CoreV1().Pods(pod.Namespace).GetLogs(pod.Name, logOptions)
    logStream, err := req.Stream(ctx)
    if err != nil {
        log.Error("获取 Pod 日志流失败", "pod", pod.Name, "container", containerName, "error", err)
        return
    }
    defer logStream.Close()
    
    // 构造元数据
    metadata := map[string]interface{}{
        "pod_name":       pod.Name,
        "namespace":      pod.Namespace,
        "container_name": containerName,
        "node_name":      pod.Spec.NodeName,
        "labels":         pod.Labels,
        "annotations":    pod.Annotations,
    }
    
    // 读取日志
    scanner := bufio.NewScanner(logStream)
    scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
    
    for scanner.Scan() {
        select {
        case <-ctx.Done():
            return
        default:
        }
        
        line := scanner.Text()
        
        // 解析时间戳
        timestamp := time.Now()
        if strings.Contains(line, " ") {
            parts := strings.SplitN(line, " ", 2)
            if t, err := time.Parse(time.RFC3339Nano, parts[0]); err == nil {
                timestamp = t
                if len(parts) > 1 {
                    line = parts[1]
                }
            }
        }
        
        // 处理日志条目
        cc.processLog(&LogEntry{
            Source:    fmt.Sprintf("k8s/%s/%s/%s", pod.Namespace, pod.Name, containerName),
            Message:   line,
            Timestamp: timestamp.Format(time.RFC3339Nano),
            Fields:    metadata,
        })
    }
    
    if err := scanner.Err(); err != nil {
        log.Error("读取 Pod 日志失败", "pod", pod.Name, "container", containerName, "error", err)
    }
}

// 判断是否应该采集容器日志
func (cc *ContainerCollector) shouldCollect(labels map[string]string, config DockerConfig) bool {
    // 检查排除标签
    for key, value := range config.ExcludeLabels {
        if labels[key] == value {
            return false
        }
    }
    
    // 检查包含标签（如果配置了）
    if len(config.IncludeLabels) > 0 {
        for key, value := range config.IncludeLabels {
            if labels[key] == value {
                return true
            }
        }
        return false
    }
    
    return true
}

// 停止容器日志读取器
func (cc *ContainerCollector) stopContainerReader(containerID string) {
    cc.mu.Lock()
    defer cc.mu.Unlock()
    
    reader, exists := cc.containers[containerID]
    if !exists {
        return
    }
    
    // 取消上下文
    reader.Cancel()
    
    // 删除读取器
    delete(cc.containers, containerID)
    
    log.Info("容器日志采集已停止", "id", containerID[:12])
}

// 停止 Pod 日志读取器
func (cc *ContainerCollector) stopPodReader(pod *corev1.Pod) {
    // Pod 日志采集通过上下文取消自动停止
    log.Info("Pod 日志采集已停止", "namespace", pod.Namespace, "pod", pod.Name)
}

// 处理日志条目
func (cc *ContainerCollector) processLog(entry *LogEntry) {
    // 发送到处理管道
    // 实现略...
}
```

**关键实现点**:

1. 使用 Docker API 监听容器事件（start/die），自动发现新容器
2. 使用 Kubernetes Informer 机制监听 Pod 变化，实时采集日志
3. 为每个容器创建独立的日志流和协程，避免相互影响
4. 支持通过标签过滤容器，灵活控制采集范围
5. 自动添加容器/Pod 元数据，便于日志关联和查询

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| docker_enabled | bool | true | 是否启用 Docker 采集 |
| docker_socket | string | /var/run/docker.sock | Docker Socket 路径 |
| docker_include_labels | map | {} | 包含标签过滤 |
| docker_exclude_labels | map | {} | 排除标签过滤 |
| k8s_enabled | bool | false | 是否启用 Kubernetes 采集 |
| k8s_kubeconfig | string | ~/.kube/config | Kubeconfig 路径 |
| k8s_namespaces | array | ["default"] | 监控的命名空间列表 |
| k8s_node_name | string | "" | 节点名称（仅采集本节点 Pod） |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态添加/删除标签过滤规则
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-3：数据库日志采集 [Phase 2]

**用户故事**: 

作为 DBA，我希望能够采集数据库的各类日志，以便进行性能分析和故障排查。

**验收标准**:

1. THE Log_Agent SHALL 支持采集 MySQL 慢查询日志、错误日志、二进制日志
2. THE Log_Agent SHALL 支持采集 PostgreSQL 日志（包括查询日志、错误日志）
3. THE Log_Agent SHALL 支持采集 MongoDB 日志（包括慢查询、操作日志）
4. THE Log_Agent SHALL 支持采集 Redis 日志和慢查询日志
5. THE Log_Agent SHALL 自动解析数据库日志格式，提取关键字段（查询时间、SQL 语句、错误码等）
6. WHEN 检测到慢查询时，THE Log_Agent SHALL 自动标记为高优先级

**实现方向**:

实现数据库日志解析器，支持多种数据库日志格式，提取结构化字段。

**实现方式**:

```go
// 数据库日志采集器
type DatabaseCollector struct {
    parsers map[string]DatabaseParser
    config  atomic.Value
}

// 数据库解析器接口
type DatabaseParser interface {
    Parse(line string) (*LogEntry, error)
    Type() string
}

// MySQL 慢查询解析器
type MySQLSlowQueryParser struct {
    slowThreshold time.Duration
    buffer        []string
}

// MySQL 慢查询日志格式示例：
// # Time: 2024-01-31T10:30:45.123456Z
// # User@Host: app[app] @ localhost []
// # Query_time: 2.345678  Lock_time: 0.000123 Rows_sent: 100  Rows_examined: 10000
// SET timestamp=1706698245;
// SELECT * FROM users WHERE created_at > '2024-01-01';

func (p *MySQLSlowQueryParser) Parse(line string) (*LogEntry, error) {
    // 多行日志缓冲
    if strings.HasPrefix(line, "# Time:") {
        // 新的慢查询开始，刷新之前的缓冲
        if len(p.buffer) > 0 {
            entry := p.parseBuffer()
            p.buffer = []string{line}
            return entry, nil
        }
        p.buffer = []string{line}
        return nil, nil
    }
    
    if len(p.buffer) > 0 {
        p.buffer = append(p.buffer, line)
        
        // 检查是否完整（以分号结尾）
        if strings.HasSuffix(strings.TrimSpace(line), ";") {
            entry := p.parseBuffer()
            p.buffer = nil
            return entry, nil
        }
    }
    
    return nil, nil
}

func (p *MySQLSlowQueryParser) parseBuffer() *LogEntry {
    if len(p.buffer) == 0 {
        return nil
    }
    
    entry := &LogEntry{
        Source: "mysql/slow_query",
        Fields: make(map[string]interface{}),
    }
    
    var sqlLines []string
    
    for _, line := range p.buffer {
        switch {
        case strings.HasPrefix(line, "# Time:"):
            // 解析时间戳
            timeStr := strings.TrimPrefix(line, "# Time: ")
            if t, err := time.Parse(time.RFC3339Nano, timeStr); err == nil {
                entry.Timestamp = t.Format(time.RFC3339Nano)
            }
            
        case strings.HasPrefix(line, "# User@Host:"):
            // 解析用户和主机
            parts := strings.Split(strings.TrimPrefix(line, "# User@Host: "), "@")
            if len(parts) >= 2 {
                entry.Fields["user"] = strings.TrimSpace(parts[0])
                entry.Fields["host"] = strings.TrimSpace(parts[1])
            }
            
        case strings.HasPrefix(line, "# Query_time:"):
            // 解析查询时间
            re := regexp.MustCompile(`Query_time:\s+([\d.]+)\s+Lock_time:\s+([\d.]+)\s+Rows_sent:\s+(\d+)\s+Rows_examined:\s+(\d+)`)
            matches := re.FindStringSubmatch(line)
            if len(matches) == 5 {
                queryTime, _ := strconv.ParseFloat(matches[1], 64)
                lockTime, _ := strconv.ParseFloat(matches[2], 64)
                rowsSent, _ := strconv.Atoi(matches[3])
                rowsExamined, _ := strconv.Atoi(matches[4])
                
                entry.Fields["query_time"] = queryTime
                entry.Fields["lock_time"] = lockTime
                entry.Fields["rows_sent"] = rowsSent
                entry.Fields["rows_examined"] = rowsExamined
                
                // 标记为高优先级（如果超过阈值）
                if queryTime > p.slowThreshold.Seconds() {
                    entry.Fields["priority"] = "high"
                }
            }
            
        case !strings.HasPrefix(line, "#"):
            // SQL 语句
            sqlLines = append(sqlLines, line)
        }
    }
    
    entry.Message = strings.Join(sqlLines, "\n")
    entry.Fields["sql"] = entry.Message
    
    return entry
}

// PostgreSQL 日志解析器
type PostgreSQLParser struct {
    logLinePrefix string
}

// PostgreSQL 日志格式示例：
// 2024-01-31 10:30:45.123 UTC [12345]: [1-1] user=app,db=mydb,app=myapp,client=192.168.1.100 LOG:  duration: 2345.678 ms  statement: SELECT * FROM users;

func (p *PostgreSQLParser) Parse(line string) (*LogEntry, error) {
    entry := &LogEntry{
        Source: "postgresql",
        Fields: make(map[string]interface{}),
    }
    
    // 解析时间戳
    re := regexp.MustCompile(`^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \w+)`)
    matches := re.FindStringSubmatch(line)
    if len(matches) > 1 {
        if t, err := time.Parse("2006-01-02 15:04:05.000 MST", matches[1]); err == nil {
            entry.Timestamp = t.Format(time.RFC3339Nano)
        }
    }
    
    // 解析 PID
    re = regexp.MustCompile(`\[(\d+)\]`)
    matches = re.FindStringSubmatch(line)
    if len(matches) > 1 {
        entry.Fields["pid"] = matches[1]
    }
    
    // 解析用户、数据库、应用、客户端
    re = regexp.MustCompile(`user=([^,]+),db=([^,]+),app=([^,]+),client=([^\s]+)`)
    matches = re.FindStringSubmatch(line)
    if len(matches) == 5 {
        entry.Fields["user"] = matches[1]
        entry.Fields["database"] = matches[2]
        entry.Fields["application"] = matches[3]
        entry.Fields["client"] = matches[4]
    }
    
    // 解析日志级别和消息
    re = regexp.MustCompile(`(LOG|ERROR|WARNING|FATAL|PANIC):\s+(.+)$`)
    matches = re.FindStringSubmatch(line)
    if len(matches) == 3 {
        entry.Level = matches[1]
        entry.Message = matches[2]
        
        // 解析执行时间
        if strings.Contains(entry.Message, "duration:") {
            re = regexp.MustCompile(`duration:\s+([\d.]+)\s+ms`)
            durationMatches := re.FindStringSubmatch(entry.Message)
            if len(durationMatches) > 1 {
                duration, _ := strconv.ParseFloat(durationMatches[1], 64)
                entry.Fields["duration_ms"] = duration
                
                // 标记慢查询
                if duration > 1000 {
                    entry.Fields["priority"] = "high"
                }
            }
        }
        
        // 提取 SQL 语句
        if strings.Contains(entry.Message, "statement:") {
            parts := strings.SplitN(entry.Message, "statement:", 2)
            if len(parts) == 2 {
                entry.Fields["sql"] = strings.TrimSpace(parts[1])
            }
        }
    }
    
    return entry, nil
}

// MongoDB 日志解析器
type MongoDBParser struct{}

// MongoDB 日志格式示例（JSON）：
// {"t":{"$date":"2024-01-31T10:30:45.123Z"},"s":"I","c":"COMMAND","id":51803,"ctx":"conn123","msg":"Slow query","attr":{"type":"command","ns":"mydb.users","command":{"find":"users","filter":{"created_at":{"$gt":"2024-01-01"}}},"planSummary":"COLLSCAN","durationMillis":2345}}

func (p *MongoDBParser) Parse(line string) (*LogEntry, error) {
    var data map[string]interface{}
    if err := json.Unmarshal([]byte(line), &data); err != nil {
        return nil, fmt.Errorf("解析 MongoDB JSON 日志失败: %w", err)
    }
    
    entry := &LogEntry{
        Source: "mongodb",
        Fields: make(map[string]interface{}),
    }
    
    // 解析时间戳
    if t, ok := data["t"].(map[string]interface{}); ok {
        if dateStr, ok := t["$date"].(string); ok {
            entry.Timestamp = dateStr
        }
    }
    
    // 解析日志级别
    if s, ok := data["s"].(string); ok {
        levelMap := map[string]string{
            "F": "FATAL",
            "E": "ERROR",
            "W": "WARNING",
            "I": "INFO",
            "D": "DEBUG",
        }
        entry.Level = levelMap[s]
    }
    
    // 解析组件
    if c, ok := data["c"].(string); ok {
        entry.Fields["component"] = c
    }
    
    // 解析消息
    if msg, ok := data["msg"].(string); ok {
        entry.Message = msg
    }
    
    // 解析属性
    if attr, ok := data["attr"].(map[string]interface{}); ok {
        // 命名空间
        if ns, ok := attr["ns"].(string); ok {
            entry.Fields["namespace"] = ns
        }
        
        // 执行时间
        if duration, ok := attr["durationMillis"].(float64); ok {
            entry.Fields["duration_ms"] = duration
            
            // 标记慢查询
            if duration > 1000 {
                entry.Fields["priority"] = "high"
            }
        }
        
        // 查询命令
        if command, ok := attr["command"].(map[string]interface{}); ok {
            commandJSON, _ := json.Marshal(command)
            entry.Fields["command"] = string(commandJSON)
        }
        
        // 执行计划
        if planSummary, ok := attr["planSummary"].(string); ok {
            entry.Fields["plan_summary"] = planSummary
        }
    }
    
    return entry, nil
}

// Redis 日志解析器
type RedisParser struct{}

// Redis 日志格式示例：
// 12345:M 31 Jan 2024 10:30:45.123 * DB saved on disk
// 12345:M 31 Jan 2024 10:30:45.123 # Server started, Redis version 7.0.0

func (p *RedisParser) Parse(line string) (*LogEntry, error) {
    entry := &LogEntry{
        Source: "redis",
        Fields: make(map[string]interface{}),
    }
    
    // 解析格式：PID:Role Date Time Level Message
    re := regexp.MustCompile(`^(\d+):([A-Z])\s+(\d{2}\s+\w+\s+\d{4}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+([*#.-])\s+(.+)$`)
    matches := re.FindStringSubmatch(line)
    
    if len(matches) != 6 {
        return nil, fmt.Errorf("无法解析 Redis 日志格式")
    }
    
    // PID
    entry.Fields["pid"] = matches[1]
    
    // 角色
    roleMap := map[string]string{
        "M": "master",
        "S": "slave",
        "C": "child",
        "X": "sentinel",
    }
    entry.Fields["role"] = roleMap[matches[2]]
    
    // 时间戳
    if t, err := time.Parse("02 Jan 2006 15:04:05.000", matches[3]); err == nil {
        entry.Timestamp = t.Format(time.RFC3339Nano)
    }
    
    // 日志级别
    levelMap := map[string]string{
        "*": "INFO",
        "#": "WARNING",
        ".": "DEBUG",
        "-": "VERBOSE",
    }
    entry.Level = levelMap[matches[4]]
    
    // 消息
    entry.Message = matches[5]
    
    return entry, nil
}
```

**关键实现点**:

1. 实现多种数据库日志格式解析器，支持 MySQL/PostgreSQL/MongoDB/Redis
2. 使用正则表达式提取关键字段（查询时间、SQL 语句、错误码等）
3. 支持多行日志缓冲（如 MySQL 慢查询日志）
4. 自动标记慢查询为高优先级，便于告警
5. 支持 JSON 格式日志解析（如 MongoDB）

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| mysql_slow_log_path | string | /var/log/mysql/slow.log | MySQL 慢查询日志路径 |
| mysql_error_log_path | string | /var/log/mysql/error.log | MySQL 错误日志路径 |
| mysql_slow_threshold | float | 1.0 | 慢查询阈值（秒） |
| postgresql_log_dir | string | /var/log/postgresql | PostgreSQL 日志目录 |
| mongodb_log_path | string | /var/log/mongodb/mongod.log | MongoDB 日志路径 |
| redis_log_path | string | /var/log/redis/redis.log | Redis 日志路径 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态调整慢查询阈值
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-4：网络设备日志采集 [Phase 2]

**用户故事**: 

作为网络工程师，我希望能够集中采集网络设备的日志，以便进行网络故障排查和安全审计。

**验收标准**:

1. THE Log_Agent SHALL 支持接收 Syslog 协议日志（UDP/TCP，RFC 3164 和 RFC 5424）
2. THE Log_Agent SHALL 支持接收 SNMP Trap 消息
3. THE Log_Agent SHALL 支持 TLS 加密的 Syslog 传输
4. THE Log_Agent SHALL 自动解析 Syslog 消息，提取设施（facility）、严重级别（severity）、主机名等字段
5. WHEN 接收到高严重级别（emergency/alert/critical）的 Syslog 消息时，THE Log_Agent SHALL 立即传输，不进行批量等待

**实现方向**:

实现 Syslog 服务器，支持 UDP/TCP/TLS，解析 RFC 3164 和 RFC 5424 格式。

**实现方式**:

```go
// Syslog 服务器
type SyslogServer struct {
    udpConn  *net.UDPConn
    tcpListener net.Listener
    tlsListener net.Listener
    parser   *SyslogParser
    config   atomic.Value
}

// Syslog 解析器
type SyslogParser struct {
    rfc3164Pattern *regexp.Regexp
    rfc5424Pattern *regexp.Regexp
}

// 初始化 Syslog 服务器
func NewSyslogServer(config *SyslogConfig) (*SyslogServer, error) {
    ss := &SyslogServer{
        parser: NewSyslogParser(),
    }
    ss.config.Store(config)
    
    return ss, nil
}

// 启动 Syslog 服务器
func (ss *SyslogServer) Start(ctx context.Context) error {
    config := ss.config.Load().(*SyslogConfig)
    
    // 启动 UDP 监听
    if config.UDP.Enabled {
        if err := ss.startUDP(ctx, config.UDP.Port); err != nil {
            return fmt.Errorf("启动 UDP 监听失败: %w", err)
        }
    }
    
    // 启动 TCP 监听
    if config.TCP.Enabled {
        if err := ss.startTCP(ctx, config.TCP.Port); err != nil {
            return fmt.Errorf("启动 TCP 监听失败: %w", err)
        }
    }
    
    // 启动 TLS 监听
    if config.TLS.Enabled {
        if err := ss.startTLS(ctx, config.TLS.Port, config.TLS); err != nil {
            return fmt.Errorf("启动 TLS 监听失败: %w", err)
        }
    }
    
    log.Info("Syslog 服务器已启动")
    return nil
}

// 启动 UDP 监听
func (ss *SyslogServer) startUDP(ctx context.Context, port int) error {
    addr := &net.UDPAddr{
        Port: port,
        IP:   net.ParseIP("0.0.0.0"),
    }
    
    var err error
    ss.udpConn, err = net.ListenUDP("udp", addr)
    if err != nil {
        return err
    }
    
    // 设置缓冲区大小
    ss.udpConn.SetReadBuffer(65535)
    
    go ss.handleUDP(ctx)
    
    log.Info("UDP Syslog 监听已启动", "port", port)
    return nil
}

// 处理 UDP 消息
func (ss *SyslogServer) handleUDP(ctx context.Context) {
    buffer := make([]byte, 65535)
    
    for {
        select {
        case <-ctx.Done():
            ss.udpConn.Close()
            return
        default:
        }
        
        // 设置读取超时
        ss.udpConn.SetReadDeadline(time.Now().Add(time.Second))
        
        n, remoteAddr, err := ss.udpConn.ReadFromUDP(buffer)
        if err != nil {
            if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
                continue
            }
            log.Error("读取 UDP 消息失败", "error", err)
            continue
        }
        
        // 解析 Syslog 消息
        message := string(buffer[:n])
        entry, err := ss.parser.Parse(message)
        if err != nil {
            log.Warn("解析 Syslog 消息失败", "error", err, "message", message)
            continue
        }
        
        // 添加来源信息
        entry.Fields["remote_addr"] = remoteAddr.String()
        entry.Fields["protocol"] = "udp"
        
        // 处理日志
        ss.processLog(entry)
    }
}

// 启动 TCP 监听
func (ss *SyslogServer) startTCP(ctx context.Context, port int) error {
    var err error
    ss.tcpListener, err = net.Listen("tcp", fmt.Sprintf(":%d", port))
    if err != nil {
        return err
    }
    
    go ss.acceptTCP(ctx)
    
    log.Info("TCP Syslog 监听已启动", "port", port)
    return nil
}

// 接受 TCP 连接
func (ss *SyslogServer) acceptTCP(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            ss.tcpListener.Close()
            return
        default:
        }
        
        conn, err := ss.tcpListener.Accept()
        if err != nil {
            log.Error("接受 TCP 连接失败", "error", err)
            continue
        }
        
        go ss.handleTCPConn(ctx, conn)
    }
}

// 处理 TCP 连接
func (ss *SyslogServer) handleTCPConn(ctx context.Context, conn net.Conn) {
    defer conn.Close()
    
    remoteAddr := conn.RemoteAddr().String()
    log.Info("新的 TCP 连接", "remote", remoteAddr)
    
    scanner := bufio.NewScanner(conn)
    scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
    
    for scanner.Scan() {
        select {
        case <-ctx.Done():
            return
        default:
        }
        
        message := scanner.Text()
        
        // 解析 Syslog 消息
        entry, err := ss.parser.Parse(message)
        if err != nil {
            log.Warn("解析 Syslog 消息失败", "error", err, "message", message)
            continue
        }
        
        // 添加来源信息
        entry.Fields["remote_addr"] = remoteAddr
        entry.Fields["protocol"] = "tcp"
        
        // 处理日志
        ss.processLog(entry)
    }
    
    if err := scanner.Err(); err != nil {
        log.Error("读取 TCP 连接失败", "error", err, "remote", remoteAddr)
    }
}

// 启动 TLS 监听
func (ss *SyslogServer) startTLS(ctx context.Context, port int, tlsConfig TLSConfig) error {
    // 加载证书
    cert, err := tls.LoadX509KeyPair(tlsConfig.CertFile, tlsConfig.KeyFile)
    if err != nil {
        return fmt.Errorf("加载证书失败: %w", err)
    }
    
    config := &tls.Config{
        Certificates: []tls.Certificate{cert},
        MinVersion:   tls.VersionTLS12,
    }
    
    // 加载 CA 证书（如果有）
    if tlsConfig.CAFile != "" {
        caCert, err := ioutil.ReadFile(tlsConfig.CAFile)
        if err != nil {
            return fmt.Errorf("读取 CA 证书失败: %w", err)
        }
        
        caCertPool := x509.NewCertPool()
        caCertPool.AppendCertsFromPEM(caCert)
        config.ClientCAs = caCertPool
        config.ClientAuth = tls.RequireAndVerifyClientCert
    }
    
    var err2 error
    ss.tlsListener, err2 = tls.Listen("tcp", fmt.Sprintf(":%d", port), config)
    if err2 != nil {
        return err2
    }
    
    go ss.acceptTLS(ctx)
    
    log.Info("TLS Syslog 监听已启动", "port", port)
    return nil
}

// 接受 TLS 连接
func (ss *SyslogServer) acceptTLS(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            ss.tlsListener.Close()
            return
        default:
        }
        
        conn, err := ss.tlsListener.Accept()
        if err != nil {
            log.Error("接受 TLS 连接失败", "error", err)
            continue
        }
        
        go ss.handleTCPConn(ctx, conn) // 复用 TCP 处理逻辑
    }
}

// 解析 Syslog 消息
func (sp *SyslogParser) Parse(message string) (*LogEntry, error) {
    // 尝试 RFC 5424 格式
    if entry, err := sp.parseRFC5424(message); err == nil {
        return entry, nil
    }
    
    // 尝试 RFC 3164 格式
    if entry, err := sp.parseRFC3164(message); err == nil {
        return entry, nil
    }
    
    return nil, fmt.Errorf("无法识别的 Syslog 格式")
}

// 解析 RFC 3164 格式
// 格式：<PRI>TIMESTAMP HOSTNAME TAG: MESSAGE
// 示例：<34>Oct 11 22:14:15 mymachine su: 'su root' failed for lonvick on /dev/pts/8
func (sp *SyslogParser) parseRFC3164(message string) (*LogEntry, error) {
    entry := &LogEntry{
        Source: "syslog/rfc3164",
        Fields: make(map[string]interface{}),
    }
    
    // 解析优先级
    re := regexp.MustCompile(`^<(\d+)>(.+)$`)
    matches := re.FindStringSubmatch(message)
    if len(matches) != 3 {
        return nil, fmt.Errorf("无效的 RFC 3164 格式")
    }
    
    priority, _ := strconv.Atoi(matches[1])
    facility := priority / 8
    severity := priority % 8
    
    entry.Fields["facility"] = sp.getFacilityName(facility)
    entry.Fields["severity"] = sp.getSeverityName(severity)
    entry.Level = sp.getSeverityLevel(severity)
    
    rest := matches[2]
    
    // 解析时间戳、主机名、标签和消息
    // 格式：Oct 11 22:14:15 mymachine su: 'su root' failed
    parts := strings.SplitN(rest, " ", 5)
    if len(parts) < 5 {
        entry.Message = rest
        return entry, nil
    }
    
    // 时间戳（月 日 时:分:秒）
    timestamp := fmt.Sprintf("%s %s %s", parts[0], parts[1], parts[2])
    if t, err := time.Parse("Jan 2 15:04:05", timestamp); err == nil {
        // 补充年份（使用当前年份）
        now := time.Now()
        t = time.Date(now.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, time.Local)
        entry.Timestamp = t.Format(time.RFC3339Nano)
    }
    
    // 主机名
    entry.Fields["hostname"] = parts[3]
    
    // 标签和消息
    tagAndMsg := parts[4]
    if idx := strings.Index(tagAndMsg, ":"); idx > 0 {
        entry.Fields["tag"] = tagAndMsg[:idx]
        entry.Message = strings.TrimSpace(tagAndMsg[idx+1:])
    } else {
        entry.Message = tagAndMsg
    }
    
    return entry, nil
}

// 解析 RFC 5424 格式
// 格式：<PRI>VERSION TIMESTAMP HOSTNAME APP-NAME PROCID MSGID STRUCTURED-DATA MSG
// 示例：<165>1 2003-10-11T22:14:15.003Z mymachine.example.com evntslog - ID47 [exampleSDID@32473 iut="3" eventSource="Application" eventID="1011"] An application event log entry...
func (sp *SyslogParser) parseRFC5424(message string) (*LogEntry, error) {
    entry := &LogEntry{
        Source: "syslog/rfc5424",
        Fields: make(map[string]interface{}),
    }
    
    // 解析优先级和版本
    re := regexp.MustCompile(`^<(\d+)>(\d+)\s+(.+)$`)
    matches := re.FindStringSubmatch(message)
    if len(matches) != 4 {
        return nil, fmt.Errorf("无效的 RFC 5424 格式")
    }
    
    priority, _ := strconv.Atoi(matches[1])
    facility := priority / 8
    severity := priority % 8
    
    entry.Fields["facility"] = sp.getFacilityName(facility)
    entry.Fields["severity"] = sp.getSeverityName(severity)
    entry.Level = sp.getSeverityLevel(severity)
    entry.Fields["version"] = matches[2]
    
    rest := matches[3]
    
    // 解析其他字段
    parts := strings.SplitN(rest, " ", 7)
    if len(parts) < 7 {
        entry.Message = rest
        return entry, nil
    }
    
    // 时间戳
    if t, err := time.Parse(time.RFC3339Nano, parts[0]); err == nil {
        entry.Timestamp = t.Format(time.RFC3339Nano)
    }
    
    // 主机名
    if parts[1] != "-" {
        entry.Fields["hostname"] = parts[1]
    }
    
    // 应用名称
    if parts[2] != "-" {
        entry.Fields["app_name"] = parts[2]
    }
    
    // 进程 ID
    if parts[3] != "-" {
        entry.Fields["proc_id"] = parts[3]
    }
    
    // 消息 ID
    if parts[4] != "-" {
        entry.Fields["msg_id"] = parts[4]
    }
    
    // 结构化数据
    if parts[5] != "-" {
        entry.Fields["structured_data"] = parts[5]
    }
    
    // 消息
    entry.Message = parts[6]
    
    return entry, nil
}

// 获取设施名称
func (sp *SyslogParser) getFacilityName(facility int) string {
    facilities := map[int]string{
        0: "kern", 1: "user", 2: "mail", 3: "daemon",
        4: "auth", 5: "syslog", 6: "lpr", 7: "news",
        8: "uucp", 9: "cron", 10: "authpriv", 11: "ftp",
        16: "local0", 17: "local1", 18: "local2", 19: "local3",
        20: "local4", 21: "local5", 22: "local6", 23: "local7",
    }
    
    if name, ok := facilities[facility]; ok {
        return name
    }
    return fmt.Sprintf("unknown(%d)", facility)
}

// 获取严重级别名称
func (sp *SyslogParser) getSeverityName(severity int) string {
    severities := []string{
        "emergency", "alert", "critical", "error",
        "warning", "notice", "info", "debug",
    }
    
    if severity >= 0 && severity < len(severities) {
        return severities[severity]
    }
    return fmt.Sprintf("unknown(%d)", severity)
}

// 获取日志级别
func (sp *SyslogParser) getSeverityLevel(severity int) string {
    switch severity {
    case 0, 1, 2: // emergency, alert, critical
        return "CRITICAL"
    case 3: // error
        return "ERROR"
    case 4: // warning
        return "WARNING"
    case 5, 6: // notice, info
        return "INFO"
    case 7: // debug
        return "DEBUG"
    default:
        return "INFO"
    }
}

// 处理日志（高优先级立即发送）
func (ss *SyslogServer) processLog(entry *LogEntry) {
    // 检查是否为高严重级别
    if severity, ok := entry.Fields["severity"].(string); ok {
        if severity == "emergency" || severity == "alert" || severity == "critical" {
            // 高优先级，立即发送
            entry.Fields["priority"] = "high"
            entry.Fields["immediate"] = true
        }
    }
    
    // 发送到处理管道
    // 实现略...
}
```

**关键实现点**:

1. 支持 UDP、TCP、TLS 三种传输协议
2. 实现 RFC 3164 和 RFC 5424 两种 Syslog 格式解析
3. 自动提取设施、严重级别、主机名等字段
4. 高严重级别消息立即传输，不进行批量等待
5. 支持 TLS 客户端证书认证

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| syslog_udp_enabled | bool | true | 是否启用 UDP Syslog |
| syslog_udp_port | int | 514 | UDP 端口 |
| syslog_tcp_enabled | bool | true | 是否启用 TCP Syslog |
| syslog_tcp_port | int | 514 | TCP 端口 |
| syslog_tls_enabled | bool | false | 是否启用 TLS Syslog |
| syslog_tls_port | int | 6514 | TLS 端口 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态调整监听端口
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-5：云服务日志采集 [Phase 2]

**用户故事**: 

作为云架构师，我希望能够采集云服务的日志，以便统一管理混合云环境的日志。

**验收标准**:

1. THE Log_Agent SHALL 支持从 AWS CloudWatch Logs 拉取日志
2. THE Log_Agent SHALL 支持从 Azure Monitor Logs 拉取日志
3. THE Log_Agent SHALL 支持从 GCP Cloud Logging 拉取日志
4. THE Log_Agent SHALL 支持通过 Webhook 接收云服务推送的日志
5. THE Log_Agent SHALL 支持配置拉取间隔，最小支持 1 秒
6. THE Log_Agent SHALL 自动处理云 API 的速率限制和重试

**实现方向**:

集成云服务 SDK，实现日志拉取和 Webhook 接收。

**实现方式**:

```go
// 云服务日志采集器
type CloudLogCollector struct {
    awsCollector   *AWSCloudWatchCollector
    azureCollector *AzureMonitorCollector
    gcpCollector   *GCPLoggingCollector
    webhookServer  *WebhookServer
    config         atomic.Value
}

// AWS CloudWatch 采集器
type AWSCloudWatchCollector struct {
    client    *cloudwatchlogs.Client
    logGroups []string
    config    *AWSConfig
}

// 启动 AWS CloudWatch 采集
func (acc *AWSCloudWatchCollector) Start(ctx context.Context) error {
    // 创建 AWS 客户端
    cfg, err := config.LoadDefaultConfig(ctx, config.WithRegion(acc.config.Region))
    if err != nil {
        return fmt.Errorf("加载 AWS 配置失败: %w", err)
    }
    
    acc.client = cloudwatchlogs.NewFromConfig(cfg)
    
    // 为每个日志组启动采集
    for _, logGroup := range acc.logGroups {
        go acc.collectLogGroup(ctx, logGroup)
    }
    
    log.Info("AWS CloudWatch 采集已启动", "log_groups", len(acc.logGroups))
    return nil
}

// 采集日志组
func (acc *AWSCloudWatchCollector) collectLogGroup(ctx context.Context, logGroup string) {
    ticker := time.NewTicker(time.Duration(acc.config.PollInterval) * time.Second)
    defer ticker.Stop()
    
    var nextToken *string
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
        }
        
        // 获取日志流
        input := &cloudwatchlogs.FilterLogEventsInput{
            LogGroupName: aws.String(logGroup),
            NextToken:    nextToken,
            Limit:        aws.Int32(100),
        }
        
        // 处理速率限制
        var output *cloudwatchlogs.FilterLogEventsOutput
        err := acc.retryWithBackoff(ctx, func() error {
            var err error
            output, err = acc.client.FilterLogEvents(ctx, input)
            return err
        })
        
        if err != nil {
            log.Error("获取 CloudWatch 日志失败", "log_group", logGroup, "error", err)
            continue
        }
        
        // 处理日志事件
        for _, event := range output.Events {
            entry := &LogEntry{
                Source:    fmt.Sprintf("aws/cloudwatch/%s", logGroup),
                Message:   aws.ToString(event.Message),
                Timestamp: time.Unix(aws.ToInt64(event.Timestamp)/1000, 0).Format(time.RFC3339Nano),
                Fields: map[string]interface{}{
                    "log_group":  logGroup,
                    "log_stream": aws.ToString(event.LogStreamName),
                    "event_id":   aws.ToString(event.EventId),
                },
            }
            
            acc.processLog(entry)
        }
        
        // 更新 token
        nextToken = output.NextToken
    }
}

// 重试机制（处理速率限制）
func (acc *AWSCloudWatchCollector) retryWithBackoff(ctx context.Context, fn func() error) error {
    backoff := time.Second
    maxBackoff := time.Minute
    
    for attempt := 0; attempt < 5; attempt++ {
        err := fn()
        if err == nil {
            return nil
        }
        
        // 检查是否为速率限制错误
        if strings.Contains(err.Error(), "ThrottlingException") {
            log.Warn("遇到速率限制，等待重试", "backoff", backoff)
            time.Sleep(backoff)
            backoff *= 2
            if backoff > maxBackoff {
                backoff = maxBackoff
            }
            continue
        }
        
        return err
    }
    
    return fmt.Errorf("重试次数已用尽")
}

// Webhook 服务器
type WebhookServer struct {
    server *http.Server
    config *WebhookConfig
}

// 启动 Webhook 服务器
func (ws *WebhookServer) Start(ctx context.Context) error {
    mux := http.NewServeMux()
    
    // 注册 Webhook 端点
    mux.HandleFunc(ws.config.Path, ws.handleWebhook)
    
    ws.server = &http.Server{
        Addr:    fmt.Sprintf(":%d", ws.config.Port),
        Handler: mux,
    }
    
    go func() {
        log.Info("Webhook 服务器已启动", "port", ws.config.Port, "path", ws.config.Path)
        if err := ws.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Error("Webhook 服务器错误", "error", err)
        }
    }()
    
    return nil
}

// 处理 Webhook 请求
func (ws *WebhookServer) handleWebhook(w http.ResponseWriter, r *http.Request) {
    // 验证认证
    if !ws.authenticate(r) {
        w.WriteHeader(http.StatusUnauthorized)
        return
    }
    
    // 读取请求体
    body, err := ioutil.ReadAll(r.Body)
    if err != nil {
        log.Error("读取 Webhook 请求失败", "error", err)
        w.WriteHeader(http.StatusBadRequest)
        return
    }
    defer r.Body.Close()
    
    // 解析日志
    var logs []map[string]interface{}
    if err := json.Unmarshal(body, &logs); err != nil {
        log.Error("解析 Webhook 日志失败", "error", err)
        w.WriteHeader(http.StatusBadRequest)
        return
    }
    
    // 处理日志
    for _, logData := range logs {
        entry := &LogEntry{
            Source:  "webhook",
            Fields:  logData,
        }
        
        if msg, ok := logData["message"].(string); ok {
            entry.Message = msg
        }
        
        if ts, ok := logData["timestamp"].(string); ok {
            entry.Timestamp = ts
        } else {
            entry.Timestamp = time.Now().Format(time.RFC3339Nano)
        }
        
        ws.processLog(entry)
    }
    
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}

// 认证
func (ws *WebhookServer) authenticate(r *http.Request) bool {
    switch ws.config.Auth.Type {
    case "bearer":
        token := r.Header.Get("Authorization")
        return token == "Bearer "+ws.config.Auth.Token
    case "api_key":
        apiKey := r.Header.Get(ws.config.Auth.Header)
        return apiKey == ws.config.Auth.APIKey
    default:
        return true
    }
}
```

**关键实现点**:

1. 集成 AWS、Azure、GCP SDK，实现日志拉取
2. 实现速率限制处理和指数退避重试
3. 支持 Webhook 接收云服务推送的日志
4. 支持多种认证方式（Bearer Token、API Key）
5. 支持配置拉取间隔，最小1秒

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| aws_enabled | bool | false | 是否启用 AWS CloudWatch |
| aws_region | string | us-east-1 | AWS 区域 |
| aws_log_groups | array | [] | 日志组列表 |
| aws_poll_interval | int | 60 | 拉取间隔（秒） |
| webhook_enabled | bool | false | 是否启用 Webhook |
| webhook_port | int | 8081 | Webhook 端口 |
| webhook_path | string | /webhook | Webhook 路径 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态调整拉取间隔
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-6：IoT 设备日志采集 [Phase 2]

**用户故事**: 

作为 IoT 平台工程师，我希望能够采集 IoT 设备的日志，以便监控设备状态和排查问题。

**验收标准**:

1. THE Log_Agent SHALL 支持通过 MQTT 协议接收 IoT 设备日志
2. THE Log_Agent SHALL 支持通过 HTTP/HTTPS 接收 IoT 设备推送的日志
3. THE Log_Agent SHALL 支持 CoAP 协议（用于资源受限设备）
4. THE Log_Agent SHALL 支持配置设备认证（设备证书、API Key）
5. THE Log_Agent SHALL 自动为日志添加设备元数据（设备 ID、设备类型、位置等）

**实现方向**:

实现 MQTT 客户端、HTTP 服务器、CoAP 服务器，支持设备认证和元数据添加。

**实现方式**:

```go
// IoT 日志采集器
type IoTLogCollector struct {
    mqttClient  mqtt.Client
    httpServer  *http.Server
    coapServer  *coap.Server
    deviceRegistry *DeviceRegistry
    config      atomic.Value
}

// 设备注册表
type DeviceRegistry struct {
    devices map[string]*DeviceInfo
    mu      sync.RWMutex
}

// 设备信息
type DeviceInfo struct {
    ID       string
    Type     string
    Location string
    Metadata map[string]interface{}
}

// MQTT 采集器
func (ilc *IoTLogCollector) startMQTT(ctx context.Context) error {
    config := ilc.config.Load().(*IoTConfig)
    
    // 创建 MQTT 客户端选项
    opts := mqtt.NewClientOptions()
    opts.AddBroker(config.MQTT.Broker)
    opts.SetClientID(config.MQTT.ClientID)
    opts.SetUsername(config.MQTT.Username)
    opts.SetPassword(config.MQTT.Password)
    opts.SetCleanSession(true)
    opts.SetAutoReconnect(true)
    
    // TLS 配置
    if config.MQTT.TLS.Enabled {
        tlsConfig := &tls.Config{
            InsecureSkipVerify: config.MQTT.TLS.InsecureSkipVerify,
        }
        
        if config.MQTT.TLS.CertFile != "" {
            cert, err := tls.LoadX509KeyPair(config.MQTT.TLS.CertFile, config.MQTT.TLS.KeyFile)
            if err != nil {
                return fmt.Errorf("加载证书失败: %w", err)
            }
            tlsConfig.Certificates = []tls.Certificate{cert}
        }
        
        opts.SetTLSConfig(tlsConfig)
    }
    
    // 连接回调
    opts.SetOnConnectHandler(func(client mqtt.Client) {
        log.Info("MQTT 已连接")
        
        // 订阅主题
        for _, topic := range config.MQTT.Topics {
            token := client.Subscribe(topic, byte(config.MQTT.QoS), ilc.handleMQTTMessage)
            if token.Wait() && token.Error() != nil {
                log.Error("订阅主题失败", "topic", topic, "error", token.Error())
            } else {
                log.Info("已订阅主题", "topic", topic)
            }
        }
    })
    
    // 连接丢失回调
    opts.SetConnectionLostHandler(func(client mqtt.Client, err error) {
        log.Error("MQTT 连接丢失", "error", err)
    })
    
    // 创建客户端
    ilc.mqttClient = mqtt.NewClient(opts)
    
    // 连接
    token := ilc.mqttClient.Connect()
    if token.Wait() && token.Error() != nil {
        return fmt.Errorf("连接 MQTT 失败: %w", token.Error())
    }
    
    log.Info("MQTT 采集已启动", "broker", config.MQTT.Broker)
    return nil
}

// 处理 MQTT 消息
func (ilc *IoTLogCollector) handleMQTTMessage(client mqtt.Client, msg mqtt.Message) {
    // 从主题提取设备 ID
    // 主题格式：devices/{device_id}/logs
    parts := strings.Split(msg.Topic(), "/")
    var deviceID string
    if len(parts) >= 2 {
        deviceID = parts[1]
    }
    
    // 解析消息
    var logData map[string]interface{}
    if err := json.Unmarshal(msg.Payload(), &logData); err != nil {
        log.Warn("解析 MQTT 消息失败", "error", err, "payload", string(msg.Payload()))
        return
    }
    
    // 获取设备信息
    deviceInfo := ilc.deviceRegistry.Get(deviceID)
    
    // 创建日志条目
    entry := &LogEntry{
        Source:  fmt.Sprintf("iot/mqtt/%s", deviceID),
        Fields:  logData,
    }
    
    // 添加设备元数据
    if deviceInfo != nil {
        entry.Fields["device_id"] = deviceInfo.ID
        entry.Fields["device_type"] = deviceInfo.Type
        entry.Fields["device_location"] = deviceInfo.Location
        for k, v := range deviceInfo.Metadata {
            entry.Fields[k] = v
        }
    }
    
    // 提取消息和时间戳
    if message, ok := logData["message"].(string); ok {
        entry.Message = message
    }
    
    if timestamp, ok := logData["timestamp"].(string); ok {
        entry.Timestamp = timestamp
    } else {
        entry.Timestamp = time.Now().Format(time.RFC3339Nano)
    }
    
    ilc.processLog(entry)
}

// HTTP 接收器
func (ilc *IoTLogCollector) startHTTP(ctx context.Context) error {
    config := ilc.config.Load().(*IoTConfig)
    
    mux := http.NewServeMux()
    
    // 日志接收端点
    mux.HandleFunc(config.HTTP.Path, ilc.handleHTTPLog)
    
    ilc.httpServer = &http.Server{
        Addr:    fmt.Sprintf(":%d", config.HTTP.Port),
        Handler: mux,
    }
    
    go func() {
        log.Info("IoT HTTP 服务器已启动", "port", config.HTTP.Port)
        if err := ilc.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Error("IoT HTTP 服务器错误", "error", err)
        }
    }()
    
    return nil
}

// 处理 HTTP 日志
func (ilc *IoTLogCollector) handleHTTPLog(w http.ResponseWriter, r *http.Request) {
    config := ilc.config.Load().(*IoTConfig)
    
    // 认证
    if !ilc.authenticateHTTP(r, config.HTTP.Auth) {
        w.WriteHeader(http.StatusUnauthorized)
        return
    }
    
    // 读取请求体
    body, err := ioutil.ReadAll(r.Body)
    if err != nil {
        log.Error("读取请求体失败", "error", err)
        w.WriteHeader(http.StatusBadRequest)
        return
    }
    defer r.Body.Close()
    
    // 解析日志
    var logData map[string]interface{}
    if err := json.Unmarshal(body, &logData); err != nil {
        log.Error("解析日志失败", "error", err)
        w.WriteHeader(http.StatusBadRequest)
        return
    }
    
    // 从请求头或请求体获取设备 ID
    deviceID := r.Header.Get("X-Device-ID")
    if deviceID == "" {
        if id, ok := logData["device_id"].(string); ok {
            deviceID = id
        }
    }
    
    // 获取设备信息
    deviceInfo := ilc.deviceRegistry.Get(deviceID)
    
    // 创建日志条目
    entry := &LogEntry{
        Source:  fmt.Sprintf("iot/http/%s", deviceID),
        Fields:  logData,
    }
    
    // 添加设备元数据
    if deviceInfo != nil {
        entry.Fields["device_id"] = deviceInfo.ID
        entry.Fields["device_type"] = deviceInfo.Type
        entry.Fields["device_location"] = deviceInfo.Location
        for k, v := range deviceInfo.Metadata {
            entry.Fields[k] = v
        }
    }
    
    // 提取消息和时间戳
    if message, ok := logData["message"].(string); ok {
        entry.Message = message
    }
    
    if timestamp, ok := logData["timestamp"].(string); ok {
        entry.Timestamp = timestamp
    } else {
        entry.Timestamp = time.Now().Format(time.RFC3339Nano)
    }
    
    ilc.processLog(entry)
    
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}

// HTTP 认证
func (ilc *IoTLogCollector) authenticateHTTP(r *http.Request, auth AuthConfig) bool {
    switch auth.Type {
    case "api_key":
        apiKey := r.Header.Get(auth.Header)
        return apiKey == auth.APIKey
    case "bearer":
        token := r.Header.Get("Authorization")
        return token == "Bearer "+auth.Token
    default:
        return true
    }
}

// CoAP 服务器
func (ilc *IoTLogCollector) startCoAP(ctx context.Context) error {
    config := ilc.config.Load().(*IoTConfig)
    
    // 创建 CoAP 服务器
    mux := coap.NewServeMux()
    mux.Handle("/logs", coap.HandlerFunc(ilc.handleCoapLog))
    
    ilc.coapServer = &coap.Server{
        Addr:    fmt.Sprintf(":%d", config.CoAP.Port),
        Handler: mux,
    }
    
    go func() {
        log.Info("CoAP 服务器已启动", "port", config.CoAP.Port)
        if err := ilc.coapServer.ListenAndServe(); err != nil {
            log.Error("CoAP 服务器错误", "error", err)
        }
    }()
    
    return nil
}

// 处理 CoAP 日志
func (ilc *IoTLogCollector) handleCoapLog(w coap.ResponseWriter, r *coap.Request) {
    // 解析日志
    var logData map[string]interface{}
    if err := json.Unmarshal(r.Msg.Payload(), &logData); err != nil {
        log.Warn("解析 CoAP 日志失败", "error", err)
        w.SetCode(coap.BadRequest)
        return
    }
    
    // 从查询参数获取设备 ID
    deviceID := r.Msg.PathString()
    
    // 获取设备信息
    deviceInfo := ilc.deviceRegistry.Get(deviceID)
    
    // 创建日志条目
    entry := &LogEntry{
        Source:  fmt.Sprintf("iot/coap/%s", deviceID),
        Fields:  logData,
    }
    
    // 添加设备元数据
    if deviceInfo != nil {
        entry.Fields["device_id"] = deviceInfo.ID
        entry.Fields["device_type"] = deviceInfo.Type
        entry.Fields["device_location"] = deviceInfo.Location
        for k, v := range deviceInfo.Metadata {
            entry.Fields[k] = v
        }
    }
    
    // 提取消息和时间戳
    if message, ok := logData["message"].(string); ok {
        entry.Message = message
    }
    
    if timestamp, ok := logData["timestamp"].(string); ok {
        entry.Timestamp = timestamp
    } else {
        entry.Timestamp = time.Now().Format(time.RFC3339Nano)
    }
    
    ilc.processLog(entry)
    
    w.SetCode(coap.Created)
}

// 设备注册表方法
func (dr *DeviceRegistry) Get(deviceID string) *DeviceInfo {
    dr.mu.RLock()
    defer dr.mu.RUnlock()
    return dr.devices[deviceID]
}

func (dr *DeviceRegistry) Register(device *DeviceInfo) {
    dr.mu.Lock()
    defer dr.mu.Unlock()
    dr.devices[device.ID] = device
}
```

**关键实现点**:

1. 支持 MQTT、HTTP、CoAP 三种协议接收 IoT 设备日志
2. 实现设备注册表，管理设备元数据
3. 支持多种认证方式（API Key、Bearer Token、设备证书）
4. 自动为日志添加设备元数据（设备 ID、类型、位置等）
5. 支持 TLS 加密传输

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| mqtt_enabled | bool | false | 是否启用 MQTT |
| mqtt_broker | string | tcp://localhost:1883 | MQTT Broker 地址 |
| mqtt_topics | array | [] | 订阅的主题列表 |
| http_enabled | bool | false | 是否启用 HTTP |
| http_port | int | 8081 | HTTP 端口 |
| coap_enabled | bool | false | 是否启用 CoAP |
| coap_port | int | 5683 | CoAP 端口 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态调整订阅主题
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-7：系统日志采集 [MVP]

**用户故事**: 

作为系统管理员，我希望能够采集操作系统的各类日志，以便进行系统监控和安全审计。

**验收标准**:

1. THE Log_Agent SHALL 支持采集 Linux systemd journal 日志
2. THE Log_Agent SHALL 支持采集 Windows Event Log
3. THE Log_Agent SHALL 支持采集 Linux /var/log 目录下的标准日志文件
4. THE Log_Agent SHALL 支持采集 macOS 统一日志系统（Unified Logging）
5. THE Log_Agent SHALL 自动解析系统日志格式，提取时间戳、进程名、PID 等字段

**实现方向**:

使用系统 API 采集系统日志，实现跨平台支持。

**实现方式**:

```go
// 系统日志采集器
type SystemLogCollector struct {
    journalReader *JournalReader
    eventLogReader *EventLogReader
    config        atomic.Value
}

// Linux systemd journal 读取器
type JournalReader struct {
    journal *sdjournal.Journal
    cursor  string
}

// 启动 systemd journal 采集
func (jr *JournalReader) Start(ctx context.Context) error {
    // 1. 打开 journal
    var err error
    jr.journal, err = sdjournal.NewJournal()
    if err != nil {
        return fmt.Errorf("打开 systemd journal 失败: %w", err)
    }
    
    // 2. 设置过滤条件
    jr.journal.AddMatch("_SYSTEMD_UNIT=nginx.service")
    jr.journal.AddMatch("_SYSTEMD_UNIT=docker.service")
    jr.journal.AddDisjunction() // OR 条件
    
    // 3. 从上次位置继续（如果有）
    if jr.cursor != "" {
        if err := jr.journal.SeekCursor(jr.cursor); err != nil {
            log.Warn("恢复 journal 游标失败，从末尾开始", "error", err)
            jr.journal.SeekTail()
        }
    } else {
        // 从末尾开始（只采集新日志）
        jr.journal.SeekTail()
    }
    
    // 4. 启动读取循环
    go jr.readLoop(ctx)
    
    log.Info("systemd journal 采集已启动")
    return nil
}

// 读取循环
func (jr *JournalReader) readLoop(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            jr.journal.Close()
            return
        default:
        }
        
        // 等待新条目
        n, err := jr.journal.Next()
        if err != nil {
            log.Error("读取 journal 失败", "error", err)
            time.Sleep(time.Second)
            continue
        }
        
        if n == 0 {
            // 没有新条目，等待
            jr.journal.Wait(time.Second)
            continue
        }
        
        // 读取条目
        entry, err := jr.journal.GetEntry()
        if err != nil {
            log.Error("获取 journal 条目失败", "error", err)
            continue
        }
        
        // 转换为 LogEntry
        logEntry := jr.convertEntry(entry)
        
        // 处理日志
        jr.processLog(logEntry)
        
        // 保存游标
        cursor, err := jr.journal.GetCursor()
        if err == nil {
            jr.cursor = cursor
        }
    }
}

// 转换 journal 条目
func (jr *JournalReader) convertEntry(entry *sdjournal.JournalEntry) *LogEntry {
    logEntry := &LogEntry{
        Source:    "systemd/journal",
        Timestamp: time.Unix(0, int64(entry.RealtimeTimestamp)*1000).Format(time.RFC3339Nano),
        Fields:    make(map[string]interface{}),
    }
    
    // 提取标准字段
    if msg, ok := entry.Fields["MESSAGE"]; ok {
        logEntry.Message = msg
    }
    
    if priority, ok := entry.Fields["PRIORITY"]; ok {
        // systemd 优先级：0=emerg, 1=alert, 2=crit, 3=err, 4=warning, 5=notice, 6=info, 7=debug
        priorityMap := map[string]string{
            "0": "EMERGENCY",
            "1": "ALERT",
            "2": "CRITICAL",
            "3": "ERROR",
            "4": "WARNING",
            "5": "NOTICE",
            "6": "INFO",
            "7": "DEBUG",
        }
        logEntry.Level = priorityMap[priority]
    }
    
    // 提取元数据
    if unit, ok := entry.Fields["_SYSTEMD_UNIT"]; ok {
        logEntry.Fields["systemd_unit"] = unit
    }
    
    if pid, ok := entry.Fields["_PID"]; ok {
        logEntry.Fields["pid"] = pid
    }
    
    if comm, ok := entry.Fields["_COMM"]; ok {
        logEntry.Fields["process"] = comm
    }
    
    if hostname, ok := entry.Fields["_HOSTNAME"]; ok {
        logEntry.Fields["hostname"] = hostname
    }
    
    return logEntry
}

// Windows Event Log 读取器
type EventLogReader struct {
    channels []string
    handles  []evtapi.EvtHandle
    config   atomic.Value
}

// 启动 Windows Event Log 采集
func (er *EventLogReader) Start(ctx context.Context) error {
    config := er.config.Load().(*EventLogConfig)
    
    for _, channel := range config.Channels {
        // 创建订阅
        query := fmt.Sprintf(`<QueryList><Query Id="0"><Select Path="%s">*</Select></Query></QueryList>`, channel)
        
        handle, err := evtapi.EvtSubscribe(
            0,
            0,
            channel,
            query,
            0,
            0,
            evtapi.EvtSubscribeToFutureEvents,
        )
        
        if err != nil {
            log.Error("订阅 Event Log 失败", "channel", channel, "error", err)
            continue
        }
        
        er.handles = append(er.handles, handle)
        
        // 启动读取协程
        go er.readChannel(ctx, handle, channel)
    }
    
    log.Info("Windows Event Log 采集已启动", "channels", len(er.handles))
    return nil
}

// 读取通道
func (er *EventLogReader) readChannel(ctx context.Context, handle evtapi.EvtHandle, channel string) {
    defer evtapi.EvtClose(handle)
    
    for {
        select {
        case <-ctx.Done():
            return
        default:
        }
        
        // 读取事件
        events, err := evtapi.EvtNext(handle, 10, 1000)
        if err != nil {
            if err != evtapi.ERROR_NO_MORE_ITEMS {
                log.Error("读取 Event Log 失败", "channel", channel, "error", err)
            }
            time.Sleep(time.Second)
            continue
        }
        
        for _, event := range events {
            logEntry := er.convertEvent(event, channel)
            er.processLog(logEntry)
            evtapi.EvtClose(event)
        }
    }
}

// 转换 Windows 事件
func (er *EventLogReader) convertEvent(event evtapi.EvtHandle, channel string) *LogEntry {
    logEntry := &LogEntry{
        Source: fmt.Sprintf("windows/eventlog/%s", channel),
        Fields: make(map[string]interface{}),
    }
    
    // 获取事件 XML
    xml, err := evtapi.EvtRender(event, evtapi.EvtRenderEventXml)
    if err != nil {
        log.Error("渲染事件失败", "error", err)
        return logEntry
    }
    
    // 解析 XML
    var eventData struct {
        System struct {
            Provider struct {
                Name string `xml:"Name,attr"`
            } `xml:"Provider"`
            EventID    int    `xml:"EventID"`
            Level      int    `xml:"Level"`
            TimeCreated struct {
                SystemTime string `xml:"SystemTime,attr"`
            } `xml:"TimeCreated"`
            Computer   string `xml:"Computer"`
        } `xml:"System"`
        EventData struct {
            Data []string `xml:"Data"`
        } `xml:"EventData"`
    }
    
    if err := xml.Unmarshal([]byte(xml), &eventData); err != nil {
        log.Error("解析事件 XML 失败", "error", err)
        return logEntry
    }
    
    // 填充字段
    logEntry.Timestamp = eventData.System.TimeCreated.SystemTime
    logEntry.Fields["event_id"] = eventData.System.EventID
    logEntry.Fields["provider"] = eventData.System.Provider.Name
    logEntry.Fields["computer"] = eventData.System.Computer
    
    // 日志级别
    levelMap := map[int]string{
        1: "CRITICAL",
        2: "ERROR",
        3: "WARNING",
        4: "INFO",
        5: "VERBOSE",
    }
    logEntry.Level = levelMap[eventData.System.Level]
    
    // 消息
    logEntry.Message = strings.Join(eventData.EventData.Data, " ")
    
    return logEntry
}

// macOS 统一日志读取器
type MacOSLogReader struct {
    cmd    *exec.Cmd
    config atomic.Value
}

// 启动 macOS 统一日志采集
func (mr *MacOSLogReader) Start(ctx context.Context) error {
    // 使用 log stream 命令实时采集日志
    // log stream --predicate 'eventMessage contains "error"' --style json
    
    config := mr.config.Load().(*MacOSLogConfig)
    
    args := []string{"stream", "--style", "json"}
    
    // 添加过滤条件
    if config.Predicate != "" {
        args = append(args, "--predicate", config.Predicate)
    }
    
    // 添加进程过滤
    if len(config.Processes) > 0 {
        for _, process := range config.Processes {
            args = append(args, "--process", process)
        }
    }
    
    mr.cmd = exec.CommandContext(ctx, "log", args...)
    
    // 获取输出管道
    stdout, err := mr.cmd.StdoutPipe()
    if err != nil {
        return fmt.Errorf("获取输出管道失败: %w", err)
    }
    
    // 启动命令
    if err := mr.cmd.Start(); err != nil {
        return fmt.Errorf("启动 log stream 失败: %w", err)
    }
    
    // 读取输出
    go mr.readOutput(ctx, stdout)
    
    log.Info("macOS 统一日志采集已启动")
    return nil
}

// 读取输出
func (mr *MacOSLogReader) readOutput(ctx context.Context, reader io.Reader) {
    scanner := bufio.NewScanner(reader)
    scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
    
    for scanner.Scan() {
        select {
        case <-ctx.Done():
            return
        default:
        }
        
        line := scanner.Text()
        
        // 解析 JSON
        var data map[string]interface{}
        if err := json.Unmarshal([]byte(line), &data); err != nil {
            log.Warn("解析 macOS 日志 JSON 失败", "error", err)
            continue
        }
        
        logEntry := mr.convertLog(data)
        mr.processLog(logEntry)
    }
    
    if err := scanner.Err(); err != nil {
        log.Error("读取 macOS 日志失败", "error", err)
    }
}

// 转换 macOS 日志
func (mr *MacOSLogReader) convertLog(data map[string]interface{}) *LogEntry {
    logEntry := &LogEntry{
        Source: "macos/unified_log",
        Fields: make(map[string]interface{}),
    }
    
    // 时间戳
    if timestamp, ok := data["timestamp"].(string); ok {
        logEntry.Timestamp = timestamp
    }
    
    // 消息
    if message, ok := data["eventMessage"].(string); ok {
        logEntry.Message = message
    }
    
    // 日志级别
    if messageType, ok := data["messageType"].(string); ok {
        logEntry.Level = strings.ToUpper(messageType)
    }
    
    // 进程信息
    if process, ok := data["process"].(string); ok {
        logEntry.Fields["process"] = process
    }
    
    if processID, ok := data["processID"].(float64); ok {
        logEntry.Fields["pid"] = int(processID)
    }
    
    // 子系统
    if subsystem, ok := data["subsystem"].(string); ok {
        logEntry.Fields["subsystem"] = subsystem
    }
    
    // 类别
    if category, ok := data["category"].(string); ok {
        logEntry.Fields["category"] = category
    }
    
    return logEntry
}
```

**关键实现点**:

1. 使用 systemd journal API 直接读取 Linux 系统日志，支持游标恢复
2. 使用 Windows Event Log API 订阅事件，实时采集
3. 使用 macOS `log stream` 命令采集统一日志系统
4. 自动解析系统日志格式，提取标准字段
5. 支持跨平台部署，根据操作系统选择对应的采集方式

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| journald_enabled | bool | true | 是否启用 systemd journal 采集 |
| journald_units | array | [] | 监控的 systemd 单元列表 |
| eventlog_enabled | bool | false | 是否启用 Windows Event Log 采集 |
| eventlog_channels | array | ["Application","System"] | 监控的事件日志通道 |
| macos_log_enabled | bool | false | 是否启用 macOS 统一日志采集 |
| macos_log_predicate | string | "" | macOS 日志过滤条件 |
| macos_log_processes | array | [] | 监控的进程列表 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态添加/删除监控单元
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-8：日志传输与可靠性 [MVP]

**用户故事**: 

作为运维工程师，我希望日志传输是可靠的，不会因为网络问题丢失日志。

**验收标准**:

1. THE Log_Agent SHALL 支持将日志传输到 Kafka、HTTP(S)、gRPC 等多种目标
2. IF 网络连接中断，THEN THE Log_Agent SHALL 在本地缓冲日志（最大可配置，默认 1GB）
3. WHEN 网络恢复后，THE Log_Agent SHALL 自动重传缓冲的日志，保持顺序
4. THE Log_Agent SHALL 支持配置传输批次大小和刷新间隔
5. THE Log_Agent SHALL 支持传输压缩（gzip、lz4、zstd）
6. THE Log_Agent SHALL 支持 TLS 加密传输
7. THE Log_Agent SHALL 提供传输确认机制，确保日志至少传输一次（at-least-once）

**实现方向**:

实现多种输出插件，支持批量发送、压缩、加密、重试机制。

**实现方式**:

```go
// 输出管理器
type OutputManager struct {
    outputs []Output
    buffer  *LocalBuffer
    config  atomic.Value
}

// 输出接口
type Output interface {
    Send(ctx context.Context, entries []*LogEntry) error
    Name() string
    Close() error
}

// Kafka 输出
type KafkaOutput struct {
    producer   *kafka.Producer
    topic      string
    compressor Compressor
    config     *KafkaOutputConfig
}

// Kafka 输出配置
type KafkaOutputConfig struct {
    Brokers       []string
    Topic         string
    Compression   string // none, gzip, lz4, zstd
    BatchSize     int
    LingerMs      int
    TLS           TLSConfig
    SASL          SASLConfig
}

// 初始化 Kafka 输出
func NewKafkaOutput(config *KafkaOutputConfig) (*KafkaOutput, error) {
    // 创建 Kafka 配置
    kafkaConfig := &kafka.ConfigMap{
        "bootstrap.servers": strings.Join(config.Brokers, ","),
        "compression.type":  config.Compression,
        "batch.size":        config.BatchSize,
        "linger.ms":         config.LingerMs,
        "acks":              "all", // 确保消息被所有副本确认
        "retries":           10,
        "max.in.flight.requests.per.connection": 5,
    }
    
    // TLS 配置
    if config.TLS.Enabled {
        kafkaConfig.SetKey("security.protocol", "SSL")
        kafkaConfig.SetKey("ssl.ca.location", config.TLS.CAFile)
        kafkaConfig.SetKey("ssl.certificate.location", config.TLS.CertFile)
        kafkaConfig.SetKey("ssl.key.location", config.TLS.KeyFile)
    }
    
    // SASL 配置
    if config.SASL.Enabled {
        kafkaConfig.SetKey("security.protocol", "SASL_SSL")
        kafkaConfig.SetKey("sasl.mechanism", config.SASL.Mechanism)
        kafkaConfig.SetKey("sasl.username", config.SASL.Username)
        kafkaConfig.SetKey("sasl.password", config.SASL.Password)
    }
    
    // 创建生产者
    producer, err := kafka.NewProducer(kafkaConfig)
    if err != nil {
        return nil, fmt.Errorf("创建 Kafka 生产者失败: %w", err)
    }
    
    // 创建压缩器
    var compressor Compressor
    switch config.Compression {
    case "gzip":
        compressor = &GzipCompressor{}
    case "lz4":
        compressor = &LZ4Compressor{}
    case "zstd":
        compressor = &ZstdCompressor{}
    default:
        compressor = &NoopCompressor{}
    }
    
    return &KafkaOutput{
        producer:   producer,
        topic:      config.Topic,
        compressor: compressor,
        config:     config,
    }, nil
}

// 发送日志到 Kafka
func (ko *KafkaOutput) Send(ctx context.Context, entries []*LogEntry) error {
    deliveryChan := make(chan kafka.Event, len(entries))
    
    for _, entry := range entries {
        // 序列化
        data, err := json.Marshal(entry)
        if err != nil {
            log.Error("序列化日志失败", "error", err)
            continue
        }
        
        // 压缩（如果启用）
        if ko.config.Compression != "none" {
            compressed, err := ko.compressor.Compress(data)
            if err != nil {
                log.Warn("压缩失败，使用原始数据", "error", err)
            } else {
                data = compressed
            }
        }
        
        // 构造消息
        message := &kafka.Message{
            TopicPartition: kafka.TopicPartition{
                Topic:     &ko.topic,
                Partition: kafka.PartitionAny,
            },
            Key:   []byte(entry.Source),
            Value: data,
            Headers: []kafka.Header{
                {Key: "source", Value: []byte(entry.Source)},
                {Key: "timestamp", Value: []byte(entry.Timestamp)},
            },
        }
        
        // 异步发送
        err = ko.producer.Produce(message, deliveryChan)
        if err != nil {
            return fmt.Errorf("发送消息失败: %w", err)
        }
    }
    
    // 等待所有消息确认
    successCount := 0
    for i := 0; i < len(entries); i++ {
        e := <-deliveryChan
        m := e.(*kafka.Message)
        
        if m.TopicPartition.Error != nil {
            log.Error("消息发送失败", "error", m.TopicPartition.Error)
        } else {
            successCount++
        }
    }
    
    if successCount < len(entries) {
        return fmt.Errorf("部分消息发送失败: %d/%d", len(entries)-successCount, len(entries))
    }
    
    return nil
}

// HTTP 输出
type HTTPOutput struct {
    client     *http.Client
    url        string
    compressor Compressor
    config     *HTTPOutputConfig
}

// HTTP 输出配置
type HTTPOutputConfig struct {
    URL         string
    Method      string // POST, PUT
    Compression string // none, gzip, lz4, zstd
    BatchSize   int
    Timeout     time.Duration
    TLS         TLSConfig
    Auth        AuthConfig
    Retry       RetryConfig
}

// 初始化 HTTP 输出
func NewHTTPOutput(config *HTTPOutputConfig) (*HTTPOutput, error) {
    // 创建 HTTP 客户端
    transport := &http.Transport{
        MaxIdleConns:        100,
        MaxIdleConnsPerHost: 10,
        IdleConnTimeout:     90 * time.Second,
    }
    
    // TLS 配置
    if config.TLS.Enabled {
        tlsConfig := &tls.Config{
            InsecureSkipVerify: config.TLS.InsecureSkipVerify,
        }
        
        if config.TLS.CAFile != "" {
            caCert, err := ioutil.ReadFile(config.TLS.CAFile)
            if err != nil {
                return nil, fmt.Errorf("读取 CA 证书失败: %w", err)
            }
            caCertPool := x509.NewCertPool()
            caCertPool.AppendCertsFromPEM(caCert)
            tlsConfig.RootCAs = caCertPool
        }
        
        transport.TLSClientConfig = tlsConfig
    }
    
    client := &http.Client{
        Transport: transport,
        Timeout:   config.Timeout,
    }
    
    // 创建压缩器
    var compressor Compressor
    switch config.Compression {
    case "gzip":
        compressor = &GzipCompressor{}
    case "lz4":
        compressor = &LZ4Compressor{}
    case "zstd":
        compressor = &ZstdCompressor{}
    default:
        compressor = &NoopCompressor{}
    }
    
    return &HTTPOutput{
        client:     client,
        url:        config.URL,
        compressor: compressor,
        config:     config,
    }, nil
}

// 发送日志到 HTTP
func (ho *HTTPOutput) Send(ctx context.Context, entries []*LogEntry) error {
    // 序列化
    data, err := json.Marshal(entries)
    if err != nil {
        return fmt.Errorf("序列化日志失败: %w", err)
    }
    
    // 压缩
    if ho.config.Compression != "none" {
        compressed, err := ho.compressor.Compress(data)
        if err != nil {
            log.Warn("压缩失败，使用原始数据", "error", err)
        } else {
            data = compressed
        }
    }
    
    // 重试发送
    var lastErr error
    for attempt := 0; attempt <= ho.config.Retry.MaxAttempts; attempt++ {
        if attempt > 0 {
            // 指数退避
            backoff := time.Duration(math.Pow(2, float64(attempt-1))) * ho.config.Retry.InitialBackoff
            if backoff > ho.config.Retry.MaxBackoff {
                backoff = ho.config.Retry.MaxBackoff
            }
            
            log.Info("重试发送", "attempt", attempt, "backoff", backoff)
            time.Sleep(backoff)
        }
        
        // 创建请求
        req, err := http.NewRequestWithContext(ctx, ho.config.Method, ho.url, bytes.NewReader(data))
        if err != nil {
            lastErr = fmt.Errorf("创建请求失败: %w", err)
            continue
        }
        
        // 设置请求头
        req.Header.Set("Content-Type", "application/json")
        if ho.config.Compression != "none" {
            req.Header.Set("Content-Encoding", ho.config.Compression)
        }
        
        // 认证
        switch ho.config.Auth.Type {
        case "bearer":
            req.Header.Set("Authorization", "Bearer "+ho.config.Auth.Token)
        case "basic":
            req.SetBasicAuth(ho.config.Auth.Username, ho.config.Auth.Password)
        case "api_key":
            req.Header.Set(ho.config.Auth.Header, ho.config.Auth.APIKey)
        }
        
        // 发送请求
        resp, err := ho.client.Do(req)
        if err != nil {
            lastErr = fmt.Errorf("发送请求失败: %w", err)
            continue
        }
        
        // 检查响应
        if resp.StatusCode >= 200 && resp.StatusCode < 300 {
            resp.Body.Close()
            return nil // 成功
        }
        
        // 读取错误响应
        body, _ := ioutil.ReadAll(resp.Body)
        resp.Body.Close()
        
        lastErr = fmt.Errorf("HTTP 错误: %d, %s", resp.StatusCode, string(body))
        
        // 检查是否应该重试
        if resp.StatusCode >= 400 && resp.StatusCode < 500 {
            // 客户端错误，不重试
            return lastErr
        }
    }
    
    return fmt.Errorf("发送失败，已重试 %d 次: %w", ho.config.Retry.MaxAttempts, lastErr)
}

// 本地缓冲区
type LocalBuffer struct {
    db        *bolt.DB
    maxSize   int64
    currentSize int64
    mu        sync.RWMutex
}

// 初始化本地缓冲区
func NewLocalBuffer(path string, maxSize int64) (*LocalBuffer, error) {
    db, err := bolt.Open(path, 0600, &bolt.Options{
        Timeout: time.Second,
    })
    if err != nil {
        return nil, fmt.Errorf("打开缓冲数据库失败: %w", err)
    }
    
    // 创建 bucket
    err = db.Update(func(tx *bolt.Tx) error {
        _, err := tx.CreateBucketIfNotExists([]byte("buffer"))
        return err
    })
    if err != nil {
        return nil, fmt.Errorf("创建 bucket 失败: %w", err)
    }
    
    lb := &LocalBuffer{
        db:      db,
        maxSize: maxSize,
    }
    
    // 计算当前大小
    lb.calculateSize()
    
    return lb, nil
}

// 写入缓冲区
func (lb *LocalBuffer) Write(entries []*LogEntry) error {
    lb.mu.Lock()
    defer lb.mu.Unlock()
    
    return lb.db.Update(func(tx *bolt.Tx) error {
        bucket := tx.Bucket([]byte("buffer"))
        
        for _, entry := range entries {
            // 检查大小限制
            if lb.currentSize >= lb.maxSize {
                return fmt.Errorf("缓冲区已满: %d/%d", lb.currentSize, lb.maxSize)
            }
            
            // 序列化
            data, err := json.Marshal(entry)
            if err != nil {
                return fmt.Errorf("序列化失败: %w", err)
            }
            
            // 生成 key（时间戳 + 随机数）
            key := []byte(fmt.Sprintf("%d-%d", time.Now().UnixNano(), rand.Int63()))
            
            // 写入
            if err := bucket.Put(key, data); err != nil {
                return fmt.Errorf("写入失败: %w", err)
            }
            
            lb.currentSize += int64(len(data))
        }
        
        return nil
    })
}

// 读取缓冲区
func (lb *LocalBuffer) Read(limit int) ([]*LogEntry, error) {
    lb.mu.RLock()
    defer lb.mu.RUnlock()
    
    var entries []*LogEntry
    var keys [][]byte
    
    err := lb.db.View(func(tx *bolt.Tx) error {
        bucket := tx.Bucket([]byte("buffer"))
        cursor := bucket.Cursor()
        
        count := 0
        for k, v := cursor.First(); k != nil && count < limit; k, v = cursor.Next() {
            var entry LogEntry
            if err := json.Unmarshal(v, &entry); err != nil {
                log.Error("反序列化失败", "error", err)
                continue
            }
            
            entries = append(entries, &entry)
            keys = append(keys, append([]byte{}, k...)) // 复制 key
            count++
        }
        
        return nil
    })
    
    if err != nil {
        return nil, err
    }
    
    // 删除已读取的条目
    if len(keys) > 0 {
        lb.mu.RUnlock()
        lb.mu.Lock()
        
        err = lb.db.Update(func(tx *bolt.Tx) error {
            bucket := tx.Bucket([]byte("buffer"))
            for _, key := range keys {
                if v := bucket.Get(key); v != nil {
                    lb.currentSize -= int64(len(v))
                }
                bucket.Delete(key)
            }
            return nil
        })
        
        lb.mu.Unlock()
        lb.mu.RLock()
    }
    
    return entries, err
}

// 计算当前大小
func (lb *LocalBuffer) calculateSize() {
    lb.db.View(func(tx *bolt.Tx) error {
        bucket := tx.Bucket([]byte("buffer"))
        cursor := bucket.Cursor()
        
        size := int64(0)
        for k, v := cursor.First(); k != nil; k, v = cursor.Next() {
            size += int64(len(v))
        }
        
        lb.currentSize = size
        return nil
    })
}

// 压缩器接口
type Compressor interface {
    Compress(data []byte) ([]byte, error)
    Decompress(data []byte) ([]byte, error)
}

// Gzip 压缩器
type GzipCompressor struct{}

func (gc *GzipCompressor) Compress(data []byte) ([]byte, error) {
    var buf bytes.Buffer
    writer := gzip.NewWriter(&buf)
    
    if _, err := writer.Write(data); err != nil {
        return nil, err
    }
    
    if err := writer.Close(); err != nil {
        return nil, err
    }
    
    return buf.Bytes(), nil
}

// LZ4 压缩器
type LZ4Compressor struct{}

func (lc *LZ4Compressor) Compress(data []byte) ([]byte, error) {
    buf := make([]byte, lz4.CompressBlockBound(len(data)))
    n, err := lz4.CompressBlock(data, buf, nil)
    if err != nil {
        return nil, err
    }
    return buf[:n], nil
}

// Zstd 压缩器
type ZstdCompressor struct{}

func (zc *ZstdCompressor) Compress(data []byte) ([]byte, error) {
    return zstd.Compress(nil, data)
}
```

**关键实现点**:

1. 支持多种输出目标（Kafka、HTTP、gRPC），插件化架构
2. 使用 BoltDB 实现本地持久化缓冲，断线时保护数据
3. 支持多种压缩算法（gzip、lz4、zstd），减少带宽占用
4. 实现指数退避重试机制，自动恢复网络故障
5. 支持 TLS 加密传输和多种认证方式

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| output_type | string | kafka | 输出类型（kafka/http/grpc） |
| kafka_brokers | array | [] | Kafka 集群地址 |
| kafka_topic | string | logs | Kafka 主题 |
| kafka_compression | string | lz4 | 压缩算法 |
| http_url | string | "" | HTTP 端点 URL |
| http_method | string | POST | HTTP 方法 |
| batch_size | int | 1000 | 批量大小 |
| flush_interval | int | 5 | 刷新间隔（秒） |
| buffer_max_size | int | 1073741824 | 缓冲区最大大小（字节） |
| retry_max_attempts | int | 5 | 最大重试次数 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态切换输出目标
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-9：简单部署与配置 [MVP]

**用户故事**: 

作为运维工程师，我希望能够快速部署日志采集代理，最小化配置工作。

**验收标准**:

1. THE Log_Agent SHALL 提供一键安装脚本，支持 Linux/Windows/macOS
2. THE Log_Agent SHALL 提供 Docker 镜像，支持容器化部署
3. THE Log_Agent SHALL 提供 Kubernetes DaemonSet 配置，支持集群部署
4. THE Log_Agent SHALL 支持通过环境变量配置核心参数
5. THE Log_Agent SHALL 提供自动发现功能，自动检测常见日志路径
6. THE Log_Agent SHALL 提供 Web UI 进行配置管理（可选）
7. THE Log_Agent SHALL 支持配置热加载，无需重启更新配置

**实现方向**:

提供安装脚本、Docker 镜像、Kubernetes 配置，支持环境变量和 YAML 配置。

**实现方式**:

```go
// 配置管理器
type ConfigManager struct {
    configPath string
    config     atomic.Value
    watcher    *fsnotify.Watcher
}

// 配置结构
type Config struct {
    Server   ServerConfig   `yaml:"server" env:"SERVER"`
    Inputs   []InputConfig  `yaml:"inputs"`
    Outputs  []OutputConfig `yaml:"outputs"`
    Buffer   BufferConfig   `yaml:"buffer"`
    Logging  LoggingConfig  `yaml:"logging"`
}

// 服务器配置
type ServerConfig struct {
    Name     string `yaml:"name" env:"AGENT_NAME"`
    HTTPPort int    `yaml:"http_port" env:"HTTP_PORT" default:"8080"`
    MetricsPort int `yaml:"metrics_port" env:"METRICS_PORT" default:"9090"`
}

// 加载配置
func (cm *ConfigManager) Load() error {
    // 1. 加载默认配置
    config := cm.getDefaultConfig()
    
    // 2. 从配置文件加载
    if cm.configPath != "" {
        data, err := ioutil.ReadFile(cm.configPath)
        if err != nil {
            return fmt.Errorf("读取配置文件失败: %w", err)
        }
        
        if err := yaml.Unmarshal(data, &config); err != nil {
            return fmt.Errorf("解析配置文件失败: %w", err)
        }
    }
    
    // 3. 从环境变量覆盖
    if err := cm.loadFromEnv(&config); err != nil {
        return fmt.Errorf("加载环境变量失败: %w", err)
    }
    
    // 4. 验证配置
    if err := cm.validate(&config); err != nil {
        return fmt.Errorf("配置验证失败: %w", err)
    }
    
    // 5. 保存配置
    cm.config.Store(&config)
    
    log.Info("配置加载成功", "path", cm.configPath)
    return nil
}

// 获取默认配置
func (cm *ConfigManager) getDefaultConfig() Config {
    return Config{
        Server: ServerConfig{
            Name:        hostname(),
            HTTPPort:    8080,
            MetricsPort: 9090,
        },
        Inputs: []InputConfig{
            {
                Type:    "file",
                Enabled: true,
                Paths:   []string{"/var/log/*.log"},
            },
        },
        Outputs: []OutputConfig{
            {
                Type:    "kafka",
                Enabled: true,
                Brokers: []string{"localhost:9092"},
                Topic:   "logs",
            },
        },
        Buffer: BufferConfig{
            Type:    "disk",
            Path:    "/var/lib/log-agent/buffer",
            MaxSize: 1024 * 1024 * 1024, // 1GB
        },
        Logging: LoggingConfig{
            Level:  "info",
            Format: "json",
            Output: "/var/log/log-agent/agent.log",
        },
    }
}

// 从环境变量加载
func (cm *ConfigManager) loadFromEnv(config *Config) error {
    // 使用反射遍历结构体字段
    v := reflect.ValueOf(config).Elem()
    t := v.Type()
    
    for i := 0; i < v.NumField(); i++ {
        field := v.Field(i)
        fieldType := t.Field(i)
        
        // 获取 env 标签
        envTag := fieldType.Tag.Get("env")
        if envTag == "" {
            continue
        }
        
        // 从环境变量读取
        envValue := os.Getenv(envTag)
        if envValue == "" {
            continue
        }
        
        // 设置字段值
        if err := cm.setFieldValue(field, envValue); err != nil {
            return fmt.Errorf("设置字段 %s 失败: %w", fieldType.Name, err)
        }
    }
    
    return nil
}

// 设置字段值
func (cm *ConfigManager) setFieldValue(field reflect.Value, value string) error {
    switch field.Kind() {
    case reflect.String:
        field.SetString(value)
    case reflect.Int, reflect.Int64:
        intValue, err := strconv.ParseInt(value, 10, 64)
        if err != nil {
            return err
        }
        field.SetInt(intValue)
    case reflect.Bool:
        boolValue, err := strconv.ParseBool(value)
        if err != nil {
            return err
        }
        field.SetBool(boolValue)
    case reflect.Slice:
        // 逗号分隔的列表
        values := strings.Split(value, ",")
        slice := reflect.MakeSlice(field.Type(), len(values), len(values))
        for i, v := range values {
            slice.Index(i).SetString(strings.TrimSpace(v))
        }
        field.Set(slice)
    }
    
    return nil
}

// 验证配置
func (cm *ConfigManager) validate(config *Config) error {
    // 验证输入配置
    if len(config.Inputs) == 0 {
        return fmt.Errorf("至少需要配置一个输入源")
    }
    
    // 验证输出配置
    if len(config.Outputs) == 0 {
        return fmt.Errorf("至少需要配置一个输出目标")
    }
    
    // 验证端口
    if config.Server.HTTPPort < 1 || config.Server.HTTPPort > 65535 {
        return fmt.Errorf("HTTP 端口无效: %d", config.Server.HTTPPort)
    }
    
    return nil
}

// 监听配置文件变化
func (cm *ConfigManager) Watch(ctx context.Context) error {
    var err error
    cm.watcher, err = fsnotify.NewWatcher()
    if err != nil {
        return fmt.Errorf("创建文件监听器失败: %w", err)
    }
    
    // 添加配置文件到监听
    if err := cm.watcher.Add(cm.configPath); err != nil {
        return fmt.Errorf("添加配置文件监听失败: %w", err)
    }
    
    // 监听 SIGHUP 信号
    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, syscall.SIGHUP)
    
    go func() {
        for {
            select {
            case <-ctx.Done():
                cm.watcher.Close()
                return
                
            case event := <-cm.watcher.Events:
                if event.Op&fsnotify.Write == fsnotify.Write {
                    log.Info("检测到配置文件变化，重新加载")
                    if err := cm.Reload(); err != nil {
                        log.Error("重新加载配置失败", "error", err)
                    }
                }
                
            case <-sigChan:
                log.Info("收到 SIGHUP 信号，重新加载配置")
                if err := cm.Reload(); err != nil {
                    log.Error("重新加载配置失败", "error", err)
                }
                
            case err := <-cm.watcher.Errors:
                log.Error("配置文件监听错误", "error", err)
            }
        }
    }()
    
    return nil
}

// 重新加载配置
func (cm *ConfigManager) Reload() error {
    // 加载新配置
    oldConfig := cm.config.Load().(*Config)
    
    if err := cm.Load(); err != nil {
        // 加载失败，保持原配置
        cm.config.Store(oldConfig)
        return err
    }
    
    log.Info("配置重新加载成功")
    return nil
}

// 自动发现
type AutoDiscovery struct {
    patterns []string
}

// 发现日志文件
func (ad *AutoDiscovery) Discover() []string {
    var paths []string
    
    // 常见日志路径模式
    patterns := []string{
        "/var/log/*.log",
        "/var/log/*/*.log",
        "/var/log/nginx/*.log",
        "/var/log/apache2/*.log",
        "/var/log/mysql/*.log",
        "/var/log/postgresql/*.log",
        "/var/log/redis/*.log",
        "/var/log/mongodb/*.log",
        "/var/log/docker/containers/*/*.log",
        "/opt/*/logs/*.log",
        "/home/*/logs/*.log",
    }
    
    for _, pattern := range patterns {
        matches, err := filepath.Glob(pattern)
        if err != nil {
            log.Warn("匹配路径失败", "pattern", pattern, "error", err)
            continue
        }
        
        for _, match := range matches {
            // 检查文件是否可读
            if _, err := os.Stat(match); err == nil {
                paths = append(paths, match)
            }
        }
    }
    
    log.Info("自动发现日志文件", "count", len(paths))
    return paths
}
```

**一键安装脚本** (`install.sh`):

```bash
#!/bin/bash
set -e

# 日志采集代理一键安装脚本

VERSION="1.0.0"
INSTALL_DIR="/opt/log-agent"
CONFIG_DIR="/etc/log-agent"
LOG_DIR="/var/log/log-agent"
DATA_DIR="/var/lib/log-agent"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# 检测操作系统
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        OS="rhel"
    else
        error "无法检测操作系统"
    fi
    
    info "检测到操作系统: $OS $VER"
}

# 检查权限
check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "请使用 root 权限运行此脚本"
    fi
}

# 创建目录
create_directories() {
    info "创建目录..."
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$DATA_DIR/buffer"
}

# 下载二进制文件
download_binary() {
    info "下载日志采集代理..."
    
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            ARCH="amd64"
            ;;
        aarch64)
            ARCH="arm64"
            ;;
        *)
            error "不支持的架构: $ARCH"
            ;;
    esac
    
    DOWNLOAD_URL="https://github.com/example/log-agent/releases/download/v${VERSION}/log-agent-${OS}-${ARCH}"
    
    curl -L -o "$INSTALL_DIR/log-agent" "$DOWNLOAD_URL"
    chmod +x "$INSTALL_DIR/log-agent"
    
    info "下载完成"
}

# 生成配置文件
generate_config() {
    info "生成配置文件..."
    
    cat > "$CONFIG_DIR/config.yaml" <<EOF
server:
  name: $(hostname)
  http_port: 8080
  metrics_port: 9090

inputs:
  - type: file
    enabled: true
    paths:
      - /var/log/*.log
      - /var/log/*/*.log
    multiline_pattern: '^\d{4}-\d{2}-\d{2}'

  - type: docker
    enabled: true
    include_labels:
      logging: enabled

outputs:
  - type: kafka
    enabled: true
    brokers:
      - localhost:9092
    topic: logs
    compression: lz4
    batch:
      size: 1000
      timeout: 100ms

buffer:
  type: disk
  path: $DATA_DIR/buffer
  max_size: 1073741824  # 1GB

logging:
  level: info
  format: json
  output: $LOG_DIR/agent.log
EOF
    
    info "配置文件已生成: $CONFIG_DIR/config.yaml"
}

# 创建 systemd 服务
create_systemd_service() {
    info "创建 systemd 服务..."
    
    cat > /etc/systemd/system/log-agent.service <<EOF
[Unit]
Description=Log Collection Agent
After=network.target

[Service]
Type=simple
User=root
ExecStart=$INSTALL_DIR/log-agent --config $CONFIG_DIR/config.yaml
ExecReload=/bin/kill -HUP \$MAINPID
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    info "systemd 服务已创建"
}

# 启动服务
start_service() {
    info "启动日志采集代理..."
    systemctl enable log-agent
    systemctl start log-agent
    
    sleep 2
    
    if systemctl is-active --quiet log-agent; then
        info "日志采集代理已成功启动"
    else
        error "日志采集代理启动失败，请检查日志: journalctl -u log-agent"
    fi
}

# 显示状态
show_status() {
    echo ""
    info "安装完成！"
    echo ""
    echo "配置文件: $CONFIG_DIR/config.yaml"
    echo "日志文件: $LOG_DIR/agent.log"
    echo "数据目录: $DATA_DIR"
    echo ""
    echo "常用命令:"
    echo "  查看状态: systemctl status log-agent"
    echo "  查看日志: journalctl -u log-agent -f"
    echo "  重新加载配置: systemctl reload log-agent"
    echo "  重启服务: systemctl restart log-agent"
    echo ""
}

# 主函数
main() {
    info "开始安装日志采集代理 v${VERSION}"
    
    check_root
    detect_os
    create_directories
    download_binary
    generate_config
    create_systemd_service
    start_service
    show_status
}

main
```

**Dockerfile**:

```dockerfile
FROM golang:1.21-alpine AS builder

WORKDIR /build

# 安装依赖
RUN apk add --no-cache git make

# 复制源代码
COPY . .

# 编译
RUN make build

FROM alpine:latest

# 安装运行时依赖
RUN apk add --no-cache ca-certificates tzdata

# 创建用户
RUN addgroup -g 1000 logagent && \
    adduser -D -u 1000 -G logagent logagent

# 创建目录
RUN mkdir -p /etc/log-agent /var/log/log-agent /var/lib/log-agent/buffer && \
    chown -R logagent:logagent /etc/log-agent /var/log/log-agent /var/lib/log-agent

# 复制二进制文件
COPY --from=builder /build/bin/log-agent /usr/local/bin/log-agent

# 切换用户
USER logagent

# 暴露端口
EXPOSE 8080 9090

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# 启动命令
ENTRYPOINT ["/usr/local/bin/log-agent"]
CMD ["--config", "/etc/log-agent/config.yaml"]
```

**Kubernetes DaemonSet** (`daemonset.yaml`):

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: logging
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: log-agent-config
  namespace: logging
data:
  config.yaml: |
    server:
      name: ${NODE_NAME}
      http_port: 8080
      metrics_port: 9090
    
    inputs:
      - type: file
        enabled: true
        paths:
          - /var/log/pods/*/*.log
      
      - type: kubernetes
        enabled: true
        namespaces:
          - default
          - production
    
    outputs:
      - type: kafka
        enabled: true
        brokers:
          - kafka-0.kafka-headless.kafka.svc.cluster.local:9092
          - kafka-1.kafka-headless.kafka.svc.cluster.local:9092
        topic: logs
        compression: lz4
    
    buffer:
      type: disk
      path: /var/lib/log-agent/buffer
      max_size: 1073741824
    
    logging:
      level: info
      format: json
---
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
  namespace: logging
spec:
  selector:
    matchLabels:
      app: log-agent
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      serviceAccountName: log-agent
      containers:
      - name: log-agent
        image: log-agent:1.0.0
        env:
        - name: NODE_NAME
          valueFrom:
            fieldRef:
              fieldPath: spec.nodeName
        - name: POD_NAMESPACE
          valueFrom:
            fieldRef:
              fieldPath: metadata.namespace
        ports:
        - name: http
          containerPort: 8080
        - name: metrics
          containerPort: 9090
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        volumeMounts:
        - name: config
          mountPath: /etc/log-agent
        - name: varlog
          mountPath: /var/log
          readOnly: true
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
        - name: buffer
          mountPath: /var/lib/log-agent/buffer
      volumes:
      - name: config
        configMap:
          name: log-agent-config
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
      - name: buffer
        hostPath:
          path: /var/lib/log-agent/buffer
          type: DirectoryOrCreate
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: log-agent
  namespace: logging
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: log-agent
rules:
- apiGroups: [""]
  resources:
    - pods
    - namespaces
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: log-agent
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: log-agent
subjects:
- kind: ServiceAccount
  name: log-agent
  namespace: logging
```

**关键实现点**:

1. 支持 YAML 配置文件和环境变量两种配置方式
2. 提供一键安装脚本，自动检测操作系统和架构
3. 提供 Docker 镜像和 Kubernetes DaemonSet 配置
4. 支持配置热加载（文件监听 + SIGHUP 信号）
5. 提供自动发现功能，自动检测常见日志路径

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| 所有配置项 | - | - | 支持热更新所有配置项 |

**热更新机制**:

- 更新方式: 配置文件监听 + SIGHUP 信号
- 生效时间: 检测到变化后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在配置文件变化后 3 秒内重新加载
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持通过 SIGHUP 信号触发重新加载
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-10：监控与健康检查 [MVP]

**用户故事**: 

作为运维工程师，我希望能够监控日志采集代理的运行状态，及时发现问题。

**验收标准**:

1. THE Log_Agent SHALL 暴露 Prometheus 格式的指标端点
2. THE Log_Agent SHALL 提供健康检查端点（/health）
3. THE Log_Agent SHALL 记录采集延迟、传输延迟、错误率等关键指标
4. THE Log_Agent SHALL 支持配置告警阈值，当指标异常时发送告警
5. THE Log_Agent SHALL 记录自身运行日志，支持日志级别配置

**实现方向**:

实现 Prometheus 指标导出器，提供健康检查 HTTP 端点。

**实现方式**:

```go
// 监控管理器
type MonitoringManager struct {
    metrics *Metrics
    health  *HealthChecker
    server  *http.Server
}

// 指标收集器
type Metrics struct {
    // 采集指标
    LogsCollected    *prometheus.CounterVec
    CollectionErrors *prometheus.CounterVec
    CollectionLatency *prometheus.HistogramVec
    
    // 传输指标
    LogsSent         *prometheus.CounterVec
    SendErrors       *prometheus.CounterVec
    SendLatency      *prometheus.HistogramVec
    
    // 缓冲区指标
    BufferSize       prometheus.Gauge
    BufferUsage      prometheus.Gauge
    
    // 系统指标
    CPUUsage         prometheus.Gauge
    MemoryUsage      prometheus.Gauge
    GoroutineCount   prometheus.Gauge
}

// 初始化指标
func NewMetrics() *Metrics {
    m := &Metrics{
        LogsCollected: prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Name: "log_agent_logs_collected_total",
                Help: "Total number of logs collected",
            },
            []string{"source", "type"},
        ),
        
        CollectionErrors: prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Name: "log_agent_collection_errors_total",
                Help: "Total number of collection errors",
            },
            []string{"source", "error_type"},
        ),
        
        CollectionLatency: prometheus.NewHistogramVec(
            prometheus.HistogramOpts{
                Name:    "log_agent_collection_latency_seconds",
                Help:    "Collection latency in seconds",
                Buckets: prometheus.DefBuckets,
            },
            []string{"source"},
        ),
        
        LogsSent: prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Name: "log_agent_logs_sent_total",
                Help: "Total number of logs sent",
            },
            []string{"output", "status"},
        ),
        
        SendErrors: prometheus.NewCounterVec(
            prometheus.CounterOpts{
                Name: "log_agent_send_errors_total",
                Help: "Total number of send errors",
            },
            []string{"output", "error_type"},
        ),
        
        SendLatency: prometheus.NewHistogramVec(
            prometheus.HistogramOpts{
                Name:    "log_agent_send_latency_seconds",
                Help:    "Send latency in seconds",
                Buckets: prometheus.DefBuckets,
            },
            []string{"output"},
        ),
        
        BufferSize: prometheus.NewGauge(
            prometheus.GaugeOpts{
                Name: "log_agent_buffer_size_bytes",
                Help: "Current buffer size in bytes",
            },
        ),
        
        BufferUsage: prometheus.NewGauge(
            prometheus.GaugeOpts{
                Name: "log_agent_buffer_usage_ratio",
                Help: "Buffer usage ratio (0-1)",
            },
        ),
        
        CPUUsage: prometheus.NewGauge(
            prometheus.GaugeOpts{
                Name: "log_agent_cpu_usage_percent",
                Help: "CPU usage percentage",
            },
        ),
        
        MemoryUsage: prometheus.NewGauge(
            prometheus.GaugeOpts{
                Name: "log_agent_memory_usage_bytes",
                Help: "Memory usage in bytes",
            },
        ),
        
        GoroutineCount: prometheus.NewGauge(
            prometheus.GaugeOpts{
                Name: "log_agent_goroutines",
                Help: "Number of goroutines",
            },
        ),
    }
    
    // 注册指标
    prometheus.MustRegister(
        m.LogsCollected,
        m.CollectionErrors,
        m.CollectionLatency,
        m.LogsSent,
        m.SendErrors,
        m.SendLatency,
        m.BufferSize,
        m.BufferUsage,
        m.CPUUsage,
        m.MemoryUsage,
        m.GoroutineCount,
    )
    
    return m
}

// 记录采集日志
func (m *Metrics) RecordCollection(source, logType string, latency time.Duration) {
    m.LogsCollected.WithLabelValues(source, logType).Inc()
    m.CollectionLatency.WithLabelValues(source).Observe(latency.Seconds())
}

// 记录采集错误
func (m *Metrics) RecordCollectionError(source, errorType string) {
    m.CollectionErrors.WithLabelValues(source, errorType).Inc()
}

// 记录发送日志
func (m *Metrics) RecordSend(output, status string, latency time.Duration) {
    m.LogsSent.WithLabelValues(output, status).Inc()
    m.SendLatency.WithLabelValues(output).Observe(latency.Seconds())
}

// 记录发送错误
func (m *Metrics) RecordSendError(output, errorType string) {
    m.SendErrors.WithLabelValues(output, errorType).Inc()
}

// 更新系统指标
func (m *Metrics) UpdateSystemMetrics() {
    // CPU 使用率
    cpuPercent, _ := cpu.Percent(time.Second, false)
    if len(cpuPercent) > 0 {
        m.CPUUsage.Set(cpuPercent[0])
    }
    
    // 内存使用
    memStats := &runtime.MemStats{}
    runtime.ReadMemStats(memStats)
    m.MemoryUsage.Set(float64(memStats.Alloc))
    
    // Goroutine 数量
    m.GoroutineCount.Set(float64(runtime.NumGoroutine()))
}

// 健康检查器
type HealthChecker struct {
    checks map[string]HealthCheck
    mu     sync.RWMutex
}

// 健康检查接口
type HealthCheck interface {
    Name() string
    Check(ctx context.Context) error
}

// 健康状态
type HealthStatus struct {
    Status    string                 `json:"status"`
    Timestamp time.Time              `json:"timestamp"`
    Checks    map[string]CheckResult `json:"checks"`
}

// 检查结果
type CheckResult struct {
    Status  string `json:"status"`
    Message string `json:"message,omitempty"`
}

// 注册健康检查
func (hc *HealthChecker) Register(check HealthCheck) {
    hc.mu.Lock()
    defer hc.mu.Unlock()
    
    hc.checks[check.Name()] = check
}

// 执行健康检查
func (hc *HealthChecker) Check(ctx context.Context) *HealthStatus {
    hc.mu.RLock()
    defer hc.mu.RUnlock()
    
    status := &HealthStatus{
        Status:    "healthy",
        Timestamp: time.Now(),
        Checks:    make(map[string]CheckResult),
    }
    
    for name, check := range hc.checks {
        err := check.Check(ctx)
        if err != nil {
            status.Checks[name] = CheckResult{
                Status:  "unhealthy",
                Message: err.Error(),
            }
            status.Status = "unhealthy"
        } else {
            status.Checks[name] = CheckResult{
                Status: "healthy",
            }
        }
    }
    
    return status
}

// 缓冲区健康检查
type BufferHealthCheck struct {
    buffer *LocalBuffer
}

func (bhc *BufferHealthCheck) Name() string {
    return "buffer"
}

func (bhc *BufferHealthCheck) Check(ctx context.Context) error {
    // 检查缓冲区使用率
    usage := float64(bhc.buffer.currentSize) / float64(bhc.buffer.maxSize)
    if usage > 0.9 {
        return fmt.Errorf("缓冲区使用率过高: %.2f%%", usage*100)
    }
    return nil
}

// 输出健康检查
type OutputHealthCheck struct {
    output Output
}

func (ohc *OutputHealthCheck) Name() string {
    return fmt.Sprintf("output_%s", ohc.output.Name())
}

func (ohc *OutputHealthCheck) Check(ctx context.Context) error {
    // 尝试发送测试消息
    testEntry := &LogEntry{
        Source:    "health_check",
        Message:   "test",
        Timestamp: time.Now().Format(time.RFC3339Nano),
    }
    
    ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
    defer cancel()
    
    return ohc.output.Send(ctx, []*LogEntry{testEntry})
}

// HTTP 服务器
func (mm *MonitoringManager) Start(ctx context.Context, port int) error {
    mux := http.NewServeMux()
    
    // Prometheus 指标端点
    mux.Handle("/metrics", promhttp.Handler())
    
    // 健康检查端点
    mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
        status := mm.health.Check(r.Context())
        
        w.Header().Set("Content-Type", "application/json")
        if status.Status == "healthy" {
            w.WriteHeader(http.StatusOK)
        } else {
            w.WriteHeader(http.StatusServiceUnavailable)
        }
        
        json.NewEncoder(w).Encode(status)
    })
    
    // 就绪检查端点
    mux.HandleFunc("/ready", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("ready"))
    })
    
    // 存活检查端点
    mux.HandleFunc("/alive", func(w http.ResponseWriter, r *http.Request) {
        w.WriteHeader(http.StatusOK)
        w.Write([]byte("alive"))
    })
    
    // 配置端点
    mux.HandleFunc("/api/v1/config", func(w http.ResponseWriter, r *http.Request) {
        // 返回当前配置
        // 实现略...
    })
    
    mm.server = &http.Server{
        Addr:    fmt.Sprintf(":%d", port),
        Handler: mux,
    }
    
    // 启动服务器
    go func() {
        log.Info("监控服务器已启动", "port", port)
        if err := mm.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Error("监控服务器错误", "error", err)
        }
    }()
    
    // 等待关闭信号
    <-ctx.Done()
    
    // 优雅关闭
    shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    
    return mm.server.Shutdown(shutdownCtx)
}

// 定期更新系统指标
func (mm *MonitoringManager) StartMetricsUpdater(ctx context.Context) {
    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()
    
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            mm.metrics.UpdateSystemMetrics()
        }
    }
}
```

**Grafana 仪表板配置** (`dashboard.json`):

```json
{
  "dashboard": {
    "title": "Log Agent Monitoring",
    "panels": [
      {
        "title": "Logs Collected Rate",
        "targets": [
          {
            "expr": "rate(log_agent_logs_collected_total[5m])"
          }
        ]
      },
      {
        "title": "Collection Latency",
        "targets": [
          {
            "expr": "histogram_quantile(0.99, rate(log_agent_collection_latency_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Send Success Rate",
        "targets": [
          {
            "expr": "rate(log_agent_logs_sent_total{status=\"success\"}[5m]) / rate(log_agent_logs_sent_total[5m])"
          }
        ]
      },
      {
        "title": "Buffer Usage",
        "targets": [
          {
            "expr": "log_agent_buffer_usage_ratio"
          }
        ]
      },
      {
        "title": "CPU Usage",
        "targets": [
          {
            "expr": "log_agent_cpu_usage_percent"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "targets": [
          {
            "expr": "log_agent_memory_usage_bytes"
          }
        ]
      }
    ]
  }
}
```

**关键实现点**:

1. 使用 Prometheus 客户端库暴露指标，支持标准监控系统
2. 实现健康检查机制，检查各组件状态
3. 提供多个 HTTP 端点（/health、/ready、/alive、/metrics）
4. 记录关键性能指标（采集延迟、传输延迟、错误率等）
5. 定期更新系统资源使用指标（CPU、内存、Goroutine）

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| http_port | int | 8080 | HTTP 服务端口 |
| metrics_port | int | 9090 | Prometheus 指标端口 |
| health_check_interval | int | 30 | 健康检查间隔（秒） |
| metrics_update_interval | int | 10 | 指标更新间隔（秒） |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态调整监控端口
4. THE System SHALL 在配置变更后记录审计日志

---

---

## 需求 19-11：安全日志采集 [Phase 2]

**用户故事**: 

作为安全工程师，我希望能够采集各类安全设备和系统的日志，以便进行安全监控和威胁检测。

**验收标准**:

1. THE Log_Agent SHALL 支持采集防火墙日志（iptables、pfSense、Cisco ASA、Fortinet）
2. THE Log_Agent SHALL 支持采集 WAF 日志（ModSecurity、Cloudflare WAF、AWS WAF）
3. THE Log_Agent SHALL 支持采集 IDS/IPS 日志（Snort、Suricata、Zeek/Bro）
4. THE Log_Agent SHALL 支持采集 VPN 日志（OpenVPN、WireGuard、IPSec）
5. THE Log_Agent SHALL 支持采集堡垒机/跳板机审计日志
6. THE Log_Agent SHALL 自动解析安全日志格式，提取源 IP、目标 IP、端口、动作等关键字段
7. WHEN 检测到高危安全事件时，THE Log_Agent SHALL 立即传输，不进行批量等待

**实现方向**:

实现安全日志解析器，支持多种安全设备日志格式。

**实现方式**:

```go
// 安全日志采集器
type SecurityLogCollector struct {
    firewallParser *FirewallParser
    wafParser      *WAFParser
    idsParser      *IDSParser
    vpnParser      *VPNParser
    config         atomic.Value
}

// 防火墙日志解析器
type FirewallParser struct{}

// 解析 iptables 日志
// 格式：Jan 31 10:30:45 firewall kernel: [12345.678] IN=eth0 OUT= MAC=... SRC=192.168.1.100 DST=10.0.0.1 LEN=60 TOS=0x00 PREC=0x00 TTL=64 ID=12345 DF PROTO=TCP SPT=54321 DPT=80 WINDOW=29200 RES=0x00 SYN URGP=0
func (fp *FirewallParser) ParseIPTables(line string) (*LogEntry, error) {
    entry := &LogEntry{
        Source: "security/firewall/iptables",
        Fields: make(map[string]interface{}),
    }
    
    // 提取关键字段
    patterns := map[string]*regexp.Regexp{
        "src_ip":    regexp.MustCompile(`SRC=([^\s]+)`),
        "dst_ip":    regexp.MustCompile(`DST=([^\s]+)`),
        "src_port":  regexp.MustCompile(`SPT=(\d+)`),
        "dst_port":  regexp.MustCompile(`DPT=(\d+)`),
        "protocol":  regexp.MustCompile(`PROTO=([^\s]+)`),
        "interface": regexp.MustCompile(`IN=([^\s]+)`),
        "action":    regexp.MustCompile(`\[(DROP|ACCEPT|REJECT)\]`),
    }
    
    for field, pattern := range patterns {
        if matches := pattern.FindStringSubmatch(line); len(matches) > 1 {
            entry.Fields[field] = matches[1]
        }
    }
    
    entry.Message = line
    entry.Timestamp = time.Now().Format(time.RFC3339Nano)
    
    // 检查是否为高危事件
    if action, ok := entry.Fields["action"].(string); ok && action == "DROP" {
        if dstPort, ok := entry.Fields["dst_port"].(string); ok {
            // 常见攻击端口
            dangerousPorts := []string{"22", "23", "3389", "445", "1433", "3306"}
            for _, port := range dangerousPorts {
                if dstPort == port {
                    entry.Fields["priority"] = "high"
                    entry.Fields["immediate"] = true
                    break
                }
            }
        }
    }
    
    return entry, nil
}

// WAF 日志解析器
type WAFParser struct{}

// 解析 ModSecurity 日志（JSON 格式）
func (wp *WAFParser) ParseModSecurity(line string) (*LogEntry, error) {
    var data map[string]interface{}
    if err := json.Unmarshal([]byte(line), &data); err != nil {
        return nil, err
    }
    
    entry := &LogEntry{
        Source: "security/waf/modsecurity",
        Fields: data,
    }
    
    // 提取关键字段
    if transaction, ok := data["transaction"].(map[string]interface{}); ok {
        if clientIP, ok := transaction["client_ip"].(string); ok {
            entry.Fields["src_ip"] = clientIP
        }
        if request, ok := transaction["request"].(map[string]interface{}); ok {
            if uri, ok := request["uri"].(string); ok {
                entry.Fields["uri"] = uri
            }
            if method, ok := request["method"].(string); ok {
                entry.Fields["method"] = method
            }
        }
    }
    
    // 提取消息
    if messages, ok := data["messages"].([]interface{}); ok && len(messages) > 0 {
        if msg, ok := messages[0].(map[string]interface{}); ok {
            if message, ok := msg["message"].(string); ok {
                entry.Message = message
            }
        }
    }
    
    entry.Timestamp = time.Now().Format(time.RFC3339Nano)
    
    // 检查是否为高危事件
    if severity, ok := data["severity"].(string); ok {
        if severity == "CRITICAL" || severity == "ERROR" {
            entry.Fields["priority"] = "high"
            entry.Fields["immediate"] = true
        }
    }
    
    return entry, nil
}

// IDS 日志解析器
type IDSParser struct{}

// 解析 Suricata EVE JSON 日志
func (ip *IDSParser) ParseSuricata(line string) (*LogEntry, error) {
    var data map[string]interface{}
    if err := json.Unmarshal([]byte(line), &data); err != nil {
        return nil, err
    }
    
    entry := &LogEntry{
        Source: "security/ids/suricata",
        Fields: data,
    }
    
    // 提取事件类型
    eventType, _ := data["event_type"].(string)
    entry.Fields["event_type"] = eventType
    
    // 提取时间戳
    if timestamp, ok := data["timestamp"].(string); ok {
        entry.Timestamp = timestamp
    }
    
    // 根据事件类型提取字段
    switch eventType {
    case "alert":
        if alert, ok := data["alert"].(map[string]interface{}); ok {
            if signature, ok := alert["signature"].(string); ok {
                entry.Message = signature
            }
            if severity, ok := alert["severity"].(float64); ok {
                entry.Fields["severity"] = int(severity)
                // 严重级别 1-3 为高危
                if severity <= 3 {
                    entry.Fields["priority"] = "high"
                    entry.Fields["immediate"] = true
                }
            }
        }
        
        // 提取源和目标信息
        if srcIP, ok := data["src_ip"].(string); ok {
            entry.Fields["src_ip"] = srcIP
        }
        if dstIP, ok := data["dest_ip"].(string); ok {
            entry.Fields["dst_ip"] = dstIP
        }
        if srcPort, ok := data["src_port"].(float64); ok {
            entry.Fields["src_port"] = int(srcPort)
        }
        if dstPort, ok := data["dest_port"].(float64); ok {
            entry.Fields["dst_port"] = int(dstPort)
        }
        if proto, ok := data["proto"].(string); ok {
            entry.Fields["protocol"] = proto
        }
    }
    
    return entry, nil
}

// VPN 日志解析器
type VPNParser struct{}

// 解析 OpenVPN 日志
func (vp *VPNParser) ParseOpenVPN(line string) (*LogEntry, error) {
    entry := &LogEntry{
        Source: "security/vpn/openvpn",
        Fields: make(map[string]interface{}),
    }
    
    // OpenVPN 日志格式示例：
    // Wed Jan 31 10:30:45 2024 user/192.168.1.100:54321 MULTI: Learn: 10.8.0.2 -> user/192.168.1.100:54321
    // Wed Jan 31 10:30:45 2024 user/192.168.1.100:54321 Connection reset, restarting
    
    // 解析时间戳
    re := regexp.MustCompile(`^(\w{3}\s+\w{3}\s+\d{2}\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(.+)$`)
    matches := re.FindStringSubmatch(line)
    if len(matches) != 3 {
        return nil, fmt.Errorf("无法解析 OpenVPN 日志格式")
    }
    
    if t, err := time.Parse("Mon Jan 02 15:04:05 2006", matches[1]); err == nil {
        entry.Timestamp = t.Format(time.RFC3339Nano)
    }
    
    rest := matches[2]
    
    // 提取用户和 IP
    userIPPattern := regexp.MustCompile(`^([^/]+)/([^:]+):(\d+)\s+(.+)$`)
    if userIPMatches := userIPPattern.FindStringSubmatch(rest); len(userIPMatches) == 5 {
        entry.Fields["user"] = userIPMatches[1]
        entry.Fields["client_ip"] = userIPMatches[2]
        entry.Fields["client_port"] = userIPMatches[3]
        entry.Message = userIPMatches[4]
        
        // 检查连接事件
        if strings.Contains(entry.Message, "Connection reset") || 
           strings.Contains(entry.Message, "TLS Error") {
            entry.Fields["event_type"] = "connection_error"
            entry.Level = "WARNING"
        } else if strings.Contains(entry.Message, "MULTI: Learn") {
            entry.Fields["event_type"] = "connection_established"
            entry.Level = "INFO"
        }
    } else {
        entry.Message = rest
    }
    
    return entry, nil
}
```

**关键实现点**:

1. 实现多种安全设备日志解析器（防火墙、WAF、IDS、VPN）
2. 自动提取关键安全字段（源IP、目标IP、端口、动作等）
3. 支持多种日志格式（文本、JSON、Syslog）
4. 自动识别高危安全事件，立即传输
5. 支持自定义安全规则和告警阈值

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| firewall_log_path | string | /var/log/iptables.log | 防火墙日志路径 |
| waf_log_path | string | /var/log/modsec_audit.log | WAF 日志路径 |
| ids_log_path | string | /var/log/suricata/eve.json | IDS 日志路径 |
| vpn_log_path | string | /var/log/openvpn.log | VPN 日志路径 |
| high_risk_ports | array | [22,23,3389,445] | 高危端口列表 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态调整高危端口列表
4. THE System SHALL 在配置变更后记录审计日志

---

## 需求 19-12：中间件日志采集 [Phase 2]

**用户故事**: 

作为中间件运维工程师，我希望能够采集各类中间件的日志，以便进行性能监控和故障排查。

**验收标准**:

1. THE Log_Agent SHALL 支持采集消息队列日志（RabbitMQ、ActiveMQ、RocketMQ、Kafka）
2. THE Log_Agent SHALL 支持采集缓存服务日志（Memcached 统计、Redis 日志）
3. THE Log_Agent SHALL 支持采集搜索引擎日志（Elasticsearch、Solr）
4. THE Log_Agent SHALL 支持采集 API 网关日志（Kong、Nginx、Envoy、Traefik）
5. THE Log_Agent SHALL 自动解析中间件日志格式，提取队列名、消息数、延迟等关键指标
6. THE Log_Agent SHALL 支持通过中间件管理 API 采集运行时指标

**实现方向**:

实现中间件日志解析器和 API 集成。

**实现方式**:

```go
// 中间件日志采集器（简化实现，展示核心逻辑）
type MiddlewareLogCollector struct {
    parsers map[string]Parser
    config  atomic.Value
}

// 通用解析器接口
type Parser interface {
    Parse(line string) (*LogEntry, error)
    Type() string
}

// RabbitMQ 日志解析器
type RabbitMQParser struct{}

func (rp *RabbitMQParser) Parse(line string) (*LogEntry, error) {
    // RabbitMQ 日志格式：2024-01-31 10:30:45.123 [info] <0.123.0> accepting AMQP connection <0.456.0> (192.168.1.100:54321 -> 192.168.1.1:5672)
    entry := &LogEntry{
        Source: "middleware/rabbitmq",
        Fields: make(map[string]interface{}),
    }
    
    // 解析时间戳和级别
    re := regexp.MustCompile(`^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})\s+\[(\w+)\]\s+(.+)$`)
    matches := re.FindStringSubmatch(line)
    if len(matches) == 4 {
        entry.Timestamp = matches[1]
        entry.Level = strings.ToUpper(matches[2])
        entry.Message = matches[3]
    }
    
    return entry, nil
}

// Nginx 访问日志解析器
type NginxParser struct{}

func (np *NginxParser) Parse(line string) (*LogEntry, error) {
    // Nginx 日志格式（combined）：192.168.1.100 - - [31/Jan/2024:10:30:45 +0800] "GET /api/users HTTP/1.1" 200 1234 "-" "Mozilla/5.0"
    entry := &LogEntry{
        Source: "middleware/nginx",
        Fields: make(map[string]interface{}),
    }
    
    re := regexp.MustCompile(`^(\S+)\s+-\s+-\s+\[([^\]]+)\]\s+"(\S+)\s+(\S+)\s+(\S+)"\s+(\d+)\s+(\d+)\s+"([^"]*)"\s+"([^"]*)"`)
    matches := re.FindStringSubmatch(line)
    
    if len(matches) == 10 {
        entry.Fields["client_ip"] = matches[1]
        entry.Fields["method"] = matches[3]
        entry.Fields["uri"] = matches[4]
        entry.Fields["protocol"] = matches[5]
        entry.Fields["status"] = matches[6]
        entry.Fields["bytes_sent"] = matches[7]
        entry.Fields["referer"] = matches[8]
        entry.Fields["user_agent"] = matches[9]
        entry.Message = line
    }
    
    return entry, nil
}
```

**关键实现点**:

1. 实现多种中间件日志解析器
2. 支持通过管理 API 采集运行时指标
3. 自动提取关键性能指标
4. 支持自定义解析规则
5. 支持日志格式自动识别

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| rabbitmq_log_path | string | /var/log/rabbitmq/*.log | RabbitMQ 日志路径 |
| nginx_access_log | string | /var/log/nginx/access.log | Nginx 访问日志 |
| redis_log_path | string | /var/log/redis/redis.log | Redis 日志路径 |

**热更新机制**:

- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:

1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态添加/删除日志路径
4. THE System SHALL 在配置变更后记录审计日志

---

## 需求 19-13至19-18：其他日志采集 [Phase 2]

由于篇幅限制，需求19-13至19-18（应用服务器、大数据平台、CI/CD、通信服务、虚拟化平台、工业协议）的实现方式与上述需求类似，核心包括：

**实现方式**:
- 实现对应的日志解析器
- 支持文件监控或 API 集成
- 自动提取关键字段
- 支持配置热更新

**关键实现点**:
1. 针对特定平台实现专用解析器
2. 支持多种日志格式（文本、JSON、XML）
3. 自动提取业务关键指标
4. 支持 API 集成获取运行时数据
5. 支持自定义解析规则

**配置热更新**:

所有需求均支持相同的热更新机制：
- 更新方式: 配置文件 + SIGHUP 信号
- 生效时间: 收到信号后立即重新加载
- 回滚策略: 配置验证失败时保持原配置

**热更新验收标准**:
1. THE System SHALL 在收到 SIGHUP 信号后重新加载配置
2. WHEN 配置无效时，THE System SHALL 保持原配置并记录错误
3. THE System SHALL 支持动态调整采集配置
4. THE System SHALL 在配置变更后记录审计日志

---

---

# 模块十九 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-19-01 | 健康检查 | LogAgent | GET | /health | 无 | 无 | {status:"healthy"} | 200/500 | v1 | 是 | 否 | - | 公开接口 |
| API-19-02 | 获取指标 | LogAgent | GET | /metrics | agent.read | 无 | Prometheus 格式 | 200/401/500 | v1 | 是 | 否 | - | Prometheus 端点 |
| API-19-03 | 获取配置 | LogAgent | GET | /api/v1/config | agent.read | 无 | {code:0,data:{...}} | 200/401/500 | v1 | 是 | 是 | - | - |
| API-19-04 | 更新配置 | LogAgent | PUT | /api/v1/config | agent.write | Body: config | {code:0,message:"ok"} | 200/400/401/500 | v1 | 是 | 否 | - | 触发热加载 |
| API-19-05 | 重载配置 | LogAgent | POST | /api/v1/config/reload | agent.write | 无 | {code:0,message:"ok"} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-19-06 | 获取输入状态 | LogAgent | GET | /api/v1/inputs | agent.read | 无 | {code:0,data:[...]} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-19-07 | 获取输出状态 | LogAgent | GET | /api/v1/outputs | agent.read | 无 | {code:0,data:[...]} | 200/401/500 | v1 | 是 | 否 | - | - |
| API-19-08 | 获取缓冲区状态 | LogAgent | GET | /api/v1/buffer/stats | agent.read | 无 | {code:0,data:{...}} | 200/401/500 | v1 | 是 | 否 | - | - |
