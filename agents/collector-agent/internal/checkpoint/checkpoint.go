// Package checkpoint 实现断点续传机制
// 通过持久化采集位置信息，确保 at-least-once 语义：
// 只有在日志成功发送到下游后才更新 checkpoint，
// 崩溃恢复时从上次 checkpoint 位置重新采集。
// 支持 inode/device 追踪以检测日志轮转。
package checkpoint

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"syscall"
	"time"
)

const defaultFlushInterval = 5 * time.Second

// Position 记录某个日志源的采集位置
type Position struct {
	Source    string    `json:"source"`
	Offset   int64     `json:"offset"`
	Inode    uint64    `json:"inode,omitempty"`
	Device   uint64    `json:"device,omitempty"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Store checkpoint 存储接口
type Store interface {
	Save(source string, offset int64) error
	Load(source string) (Position, error)
	LoadAll() (map[string]Position, error)
	Close() error
}

// FileStore 基于文件的 checkpoint 存储实现
type FileStore struct {
	mu            sync.RWMutex
	dir           string
	positions     map[string]Position
	dirty         bool
	flushInterval time.Duration
	stopCh        chan struct{}
	stopped       chan struct{}
}

// FileStoreOption configures FileStore behavior.
type FileStoreOption func(*FileStore)

// WithFlushInterval sets the periodic flush interval.
func WithFlushInterval(d time.Duration) FileStoreOption {
	return func(fs *FileStore) {
		if d > 0 {
			fs.flushInterval = d
		}
	}
}

// NewFileStore 创建基于文件的 checkpoint 存储
func NewFileStore(dir string, opts ...FileStoreOption) (*FileStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建 checkpoint 目录失败: %w", err)
	}
	fs := &FileStore{
		dir:           dir,
		positions:     make(map[string]Position),
		flushInterval: defaultFlushInterval,
		stopCh:        make(chan struct{}),
		stopped:       make(chan struct{}),
	}
	for _, opt := range opts {
		opt(fs)
	}
	if err := fs.loadFromDisk(); err != nil {
		log.Printf("加载 checkpoint 文件警告: %v", err)
	}
	go fs.periodicFlush()
	return fs, nil
}

// Save updates the checkpoint for a source. The inode/device of the file
// are captured automatically. If the inode has changed (log rotation),
// the offset is reset to 0.
func (fs *FileStore) Save(source string, offset int64) error {
	inode, device := statInodeDev(source)

	fs.mu.Lock()
	defer fs.mu.Unlock()

	prev, exists := fs.positions[source]
	if exists && prev.Inode != 0 && inode != 0 && prev.Inode != inode {
		log.Printf("检测到日志轮转 [%s]: inode %d → %d, 重置 offset", source, prev.Inode, inode)
		offset = 0
	}

	fs.positions[source] = Position{
		Source:    source,
		Offset:    offset,
		Inode:     inode,
		Device:    device,
		UpdatedAt: time.Now(),
	}
	fs.dirty = true
	return nil
}

// Load 加载指定源的 checkpoint 位置。
// 如果文件的 inode 已变化（轮转），返回 offset=0。
func (fs *FileStore) Load(source string) (Position, error) {
	fs.mu.RLock()
	pos, ok := fs.positions[source]
	fs.mu.RUnlock()

	if !ok {
		return Position{Source: source, Offset: 0}, nil
	}

	if pos.Inode != 0 {
		currentInode, _ := statInodeDev(source)
		if currentInode != 0 && currentInode != pos.Inode {
			log.Printf("检测到日志轮转 [%s]: inode %d → %d, 重置 offset", source, pos.Inode, currentInode)
			return Position{Source: source, Offset: 0}, nil
		}
	}
	return pos, nil
}

// LoadAll 加载所有 checkpoint
func (fs *FileStore) LoadAll() (map[string]Position, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	result := make(map[string]Position, len(fs.positions))
	for k, v := range fs.positions {
		result[k] = v
	}
	return result, nil
}

// Flush forces an immediate write to disk.
func (fs *FileStore) Flush() error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	fs.dirty = false
	return fs.flushToDisk()
}

// Close 关闭存储，停止周期刷盘并持久化
func (fs *FileStore) Close() error {
	close(fs.stopCh)
	<-fs.stopped

	fs.mu.Lock()
	defer fs.mu.Unlock()
	return fs.flushToDisk()
}

func (fs *FileStore) periodicFlush() {
	defer close(fs.stopped)
	ticker := time.NewTicker(fs.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-fs.stopCh:
			return
		case <-ticker.C:
			fs.mu.Lock()
			if fs.dirty {
				if err := fs.flushToDisk(); err != nil {
					log.Printf("周期性 checkpoint 刷盘失败: %v", err)
				}
				fs.dirty = false
			}
			fs.mu.Unlock()
		}
	}
}

// flushToDisk 原子写入：tmp 文件 + rename
func (fs *FileStore) flushToDisk() error {
	data, err := json.MarshalIndent(fs.positions, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化 checkpoint 失败: %w", err)
	}
	path := filepath.Join(fs.dir, "checkpoints.json")
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("写入 checkpoint 临时文件失败: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("重命名 checkpoint 文件失败: %w", err)
	}
	return nil
}

// loadFromDisk 从磁盘加载 checkpoint 数据，容错处理损坏文件
func (fs *FileStore) loadFromDisk() error {
	path := filepath.Join(fs.dir, "checkpoints.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	if len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, &fs.positions); err != nil {
		backupPath := path + ".corrupt." + time.Now().Format("20060102T150405")
		log.Printf("checkpoint 文件损坏: %v, 备份到 %s 并重新开始", err, backupPath)
		_ = os.Rename(path, backupPath)
		fs.positions = make(map[string]Position)
		return nil
	}
	return nil
}

// statInodeDev returns the inode and device numbers for a file path.
// Returns (0, 0) if stat fails.
func statInodeDev(path string) (inode uint64, device uint64) {
	info, err := os.Stat(path)
	if err != nil {
		return 0, 0
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok || stat == nil {
		return 0, 0
	}
	return stat.Ino, uint64(stat.Dev)
}
