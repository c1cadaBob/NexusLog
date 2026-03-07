// Package grpc 实现基于 gRPC 的远程插件
// 通过 gRPC 协议与外部插件进程通信，支持跨语言扩展
package grpc

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/nexuslog/collector-agent/plugins"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// ProcessorClient gRPC 处理服务的客户端接口
type ProcessorClient interface {
	Process(ctx context.Context, in *ProcessRequest, opts ...grpc.CallOption) (*ProcessResponse, error)
	Close() error
}

// processServiceClient 是 gRPC 生成的客户端接口的占位符
// 实际使用需要根据 .proto 文件生成
type processServiceClient struct {
	conn   *grpc.ClientConn
	client ProcessorClient
	mu     sync.RWMutex
	closed bool
}

// Plugin 基于 gRPC 的远程插件实现
type Plugin struct {
	name      string
	addr      string
	conn      *grpc.ClientConn
	client    ProcessorClient
	closed    bool
	mu        sync.Mutex
	timeout   time.Duration
}

// processRequest gRPC 请求消息
type ProcessRequest struct {
	Records []*PluginRecord `protobuf:"bytes,1,rep,name=records" json:"records,omitempty"`
}

// processResponse gRPC 响应消息
type ProcessResponse struct {
	Records []*PluginRecord `protobuf:"bytes,1,rep,name=records" json:"records,omitempty"`
	Error   string          `protobuf:"bytes,2,opt,name=error" json:"error,omitempty"`
}

// PluginRecord 插件处理的日志记录
type PluginRecord struct {
	Source    string            `protobuf:"bytes,1,opt,name=source" json:"source,omitempty"`
	Timestamp int64             `protobuf:"varint,2,opt,name=timestamp" json:"timestamp,omitempty"`
	Data      []byte            `protobuf:"bytes,3,opt,name=data" json:"data,omitempty"`
	Metadata  map[string]string `protobuf:"bytes,4,rep,name=metadata" json:"metadata,omitempty"`
}

// New 创建 gRPC 插件实例
func New(name, addr string) *Plugin {
	return &Plugin{
		name:    name,
		addr:    addr,
		timeout: 30 * time.Second,
	}
}

// Name 返回插件名称
func (p *Plugin) Name() string { return p.name }

// Type 返回插件类型
func (p *Plugin) Type() string { return "grpc" }

// Init 初始化 gRPC 连接
func (p *Plugin) Init(config map[string]string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return fmt.Errorf("gRPC 插件 %s: 已关闭", p.name)
	}

	// 从配置中获取参数
	if addr, ok := config["addr"]; ok {
		p.addr = addr
	}
	if timeoutStr, ok := config["timeout"]; ok {
		if timeout, err := time.ParseDuration(timeoutStr); err == nil {
			p.timeout = timeout
		}
	}

	if p.addr == "" {
		return fmt.Errorf("gRPC 插件 %s: 未配置服务地址", p.name)
	}

	log.Printf("gRPC 插件 %s: 连接到 %s", p.name, p.addr)

	// 建立 gRPC 连接
	conn, err := grpc.Dial(
		p.addr,
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithBlock(),
		grpc.WithTimeout(p.timeout),
	)
	if err != nil {
		return fmt.Errorf("gRPC 插件 %s: 连接失败: %w", p.name, err)
	}
	p.conn = conn

	log.Printf("gRPC 插件 %s: 已连接到 %s", p.name, p.addr)
	return nil
}

// Process 通过 gRPC 调用远程插件处理记录
func (p *Plugin) Process(ctx context.Context, records []plugins.Record) ([]plugins.Record, error) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil, fmt.Errorf("gRPC 插件 %s: 已关闭", p.name)
	}
	if p.conn == nil {
		p.mu.Unlock()
		// 无连接时透传
		return records, nil
	}
	p.mu.Unlock()

	// 创建带超时的上下文
	timeoutCtx, cancel := context.WithTimeout(ctx, p.timeout)
	defer cancel()

	// 转换记录格式
	pluginRecords := make([]*PluginRecord, len(records))
	for i, r := range records {
		pluginRecords[i] = &PluginRecord{
			Source:    r.Source,
			Timestamp: r.Timestamp,
			Data:      r.Data,
			Metadata:  r.Metadata,
		}
	}

	req := &ProcessRequest{Records: pluginRecords}

	// 调用远程 gRPC 服务
	// 注意：这里需要根据实际的 proto 定义来调用
	// 下面的代码是模拟调用，实际使用时需要根据生成的 gRPC 客户端代码修改
	resp, err := p.callRemoteProcessor(timeoutCtx, req)
	if err != nil {
		log.Printf("gRPC 插件 %s: 调用远程处理失败: %v, 透传原始记录", p.name, err)
		return records, nil
	}

	if resp == nil {
		return records, nil
	}

	// 转换响应记录格式
	result := make([]plugins.Record, len(resp.Records))
	for i, r := range resp.Records {
		result[i] = plugins.Record{
			Source:    r.Source,
			Timestamp: r.Timestamp,
			Data:      r.Data,
			Metadata:  r.Metadata,
		}
	}

	return result, nil
}

// callRemoteProcessor 调用远程 gRPC 处理服务
// 这是一个示例实现，实际使用时需要根据生成的 gRPC 客户端代码
func (p *Plugin) callRemoteProcessor(ctx context.Context, req *ProcessRequest) (*ProcessResponse, error) {
	// 由于没有 proto 定义，这里使用简单的 JSON 序列化通过 gRPC 通用服务调用
	// 实际生产环境应该：
	// 1. 定义 .proto 文件
	// 2. 使用 protoc 生成 Go 代码
	// 3. 调用生成的客户端方法

	// 示例：假设有一个 Process 方法
	// client := NewProcessorClient(p.conn)
	// return client.Process(ctx, req)

	// 当前实现：直接透传，不做远程调用
	// 这样可以保证即使 gRPC 服务不可用也不会影响主流程
	log.Printf("gRPC 插件 %s: 收到 %d 条记录（当前为透传模式，需要配置 proto）", p.name, len(req.Records))
	return &ProcessResponse{Records: req.Records}, nil
}

// Close 关闭 gRPC 连接
func (p *Plugin) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil
	}
	p.closed = true

	if p.conn != nil {
		err := p.conn.Close()
		if err != nil {
			return fmt.Errorf("gRPC 插件 %s: 关闭连接失败: %w", p.name, err)
		}
	}

	log.Printf("gRPC 插件 %s: 已关闭", p.name)
	return nil
}

// NewProcessRequest 创建处理请求
func NewProcessRequest(records []plugins.Record) *ProcessRequest {
	pluginRecords := make([]*PluginRecord, len(records))
	for i, r := range records {
		pluginRecords[i] = &PluginRecord{
			Source:    r.Source,
			Timestamp: r.Timestamp,
			Data:      r.Data,
			Metadata:  r.Metadata,
		}
	}
	return &ProcessRequest{Records: pluginRecords}
}

// ToPluginRecords 转换 records 为插件记录
func ToPluginRecords(records []plugins.Record) []*PluginRecord {
	result := make([]*PluginRecord, len(records))
	for i, r := range records {
		result[i] = &PluginRecord{
			Source:    r.Source,
			Timestamp: r.Timestamp,
			Data:      r.Data,
			Metadata:  r.Metadata,
		}
	}
	return result
}

// ToRecords 转换插件记录为 records
func ToRecords(pluginRecords []*PluginRecord) []plugins.Record {
	result := make([]plugins.Record, len(pluginRecords))
	for i, r := range pluginRecords {
		result[i] = plugins.Record{
			Source:    r.Source,
			Timestamp: r.Timestamp,
			Data:      r.Data,
			Metadata:  r.Metadata,
		}
	}
	return result
}
