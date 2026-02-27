// Package plugins 定义采集代理的插件化架构接口
// 支持 gRPC 和 WASM 两种插件扩展方式
package plugins

import "context"

// Record 表示一条日志记录
type Record struct {
	// Source 日志来源标识
	Source string
	// Timestamp 日志时间戳（Unix 纳秒）
	Timestamp int64
	// Data 日志原始数据
	Data []byte
	// Metadata 附加元数据
	Metadata map[string]string
}

// Plugin 插件通用接口
// 所有插件（gRPC / WASM）均需实现此接口
type Plugin interface {
	// Name 返回插件名称
	Name() string
	// Type 返回插件类型: "grpc" 或 "wasm"
	Type() string
	// Init 初始化插件，传入配置参数
	Init(config map[string]string) error
	// Process 处理日志记录，返回处理后的记录
	Process(ctx context.Context, records []Record) ([]Record, error)
	// Close 关闭插件并释放资源
	Close() error
}

// Registry 插件注册表，管理所有已加载的插件
type Registry struct {
	plugins []Plugin
}

// NewRegistry 创建新的插件注册表
func NewRegistry() *Registry {
	return &Registry{}
}

// Register 注册一个插件
func (r *Registry) Register(p Plugin) {
	r.plugins = append(r.plugins, p)
}

// Process 按注册顺序依次调用所有插件处理记录
func (r *Registry) Process(ctx context.Context, records []Record) ([]Record, error) {
	var err error
	for _, p := range r.plugins {
		records, err = p.Process(ctx, records)
		if err != nil {
			return nil, err
		}
	}
	return records, nil
}

// Close 关闭所有已注册的插件
func (r *Registry) Close() error {
	for _, p := range r.plugins {
		if err := p.Close(); err != nil {
			return err
		}
	}
	return nil
}
