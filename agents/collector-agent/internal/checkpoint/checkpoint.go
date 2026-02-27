// Package checkpoint 实现断点续传机制
// 通过持久化采集位置信息，确保 at-least-once 语义：
// 只有在日志成功发送到下游后才更新 checkpoint，
// 崩溃恢复时从上次 checkpoint 位置重新采集
package checkpoint

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Position 记录某个日志源的采集位置
type Position struct {
	// Source 日志源标识（如文件路径）
	Source string `json:"source"`
	// Offset 当前读取偏移量（字节）
	Offset int64 `json:"offset"`
	// UpdatedAt 最后更新时间
	UpdatedAt time.Time `json:"updated_at"`
}

// Store checkpoint 存储接口
type Store interface {
	// Save 持久化指定源的 checkpoint
	Save(source string, offset int64) error
	// Load 加载指定源的 checkpoint
	Load(source string) (Position, error)
	// LoadAll 加载所有 checkpoint
	LoadAll() (map[string]Position, error)
	// Close 关闭存储
	Close() error
}

// FileStore 基于文件的 checkpoint 存储实现
// 将 checkpoint 数据以 JSON 格式写入本地文件
type FileStore struct {
	mu        sync.RWMutex
	dir       string
	positions map[string]Position
}

// NewFileStore 创建基于文件的 checkpoint 存储
// dir 为 checkpoint 文件存储目录
func NewFileStore(dir string) (*FileStore, error) {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建 checkpoint 目录失败: %w", err)
	}
	fs := &FileStore{
		dir:       dir,
		positions: make(map[string]Position),
	}
	// 启动时加载已有的 checkpoint
	if err := fs.loadFromDisk(); err != nil {
		log.Printf("加载 checkpoint 文件警告: %v", err)
	}
	return fs, nil
}

// Save 保存指定源的采集位置
// 只有在日志成功发送到下游后才应调用此方法（at-least-once 保证）
func (fs *FileStore) Save(source string, offset int64) error {
	fs.mu.Lock()
	defer fs.mu.Unlock()

	fs.positions[source] = Position{
		Source:    source,
		Offset:    offset,
		UpdatedAt: time.Now(),
	}
	return fs.flushToDisk()
}

// Load 加载指定源的 checkpoint 位置
func (fs *FileStore) Load(source string) (Position, error) {
	fs.mu.RLock()
	defer fs.mu.RUnlock()

	pos, ok := fs.positions[source]
	if !ok {
		return Position{Source: source, Offset: 0}, nil
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

// Close 关闭存储，确保数据已持久化
func (fs *FileStore) Close() error {
	fs.mu.Lock()
	defer fs.mu.Unlock()
	return fs.flushToDisk()
}

// flushToDisk 将所有 checkpoint 写入磁盘
func (fs *FileStore) flushToDisk() error {
	data, err := json.MarshalIndent(fs.positions, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化 checkpoint 失败: %w", err)
	}
	path := filepath.Join(fs.dir, "checkpoints.json")
	// 先写临时文件再重命名，确保原子性
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, data, 0644); err != nil {
		return fmt.Errorf("写入 checkpoint 文件失败: %w", err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		return fmt.Errorf("重命名 checkpoint 文件失败: %w", err)
	}
	return nil
}

// loadFromDisk 从磁盘加载 checkpoint 数据
func (fs *FileStore) loadFromDisk() error {
	path := filepath.Join(fs.dir, "checkpoints.json")
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // 首次启动，无历史 checkpoint
		}
		return err
	}
	return json.Unmarshal(data, &fs.positions)
}
