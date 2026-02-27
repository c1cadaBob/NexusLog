// Package grpc 实现基于 gRPC 的远程插件
// 通过 gRPC 协议与外部插件进程通信，支持跨语言扩展
package grpc

import (
	"context"
	"fmt"
	"log"

	"github.com/nexuslog/collector-agent/plugins"
)

// Plugin 基于 gRPC 的远程插件实现
type Plugin struct {
	name   string
	addr   string // gRPC 服务地址
	closed bool
}

// New 创建 gRPC 插件实例
func New(name, addr string) *Plugin {
	return &Plugin{
		name: name,
		addr: addr,
	}
}

// Name 返回插件名称
func (p *Plugin) Name() string { return p.name }

// Type 返回插件类型
func (p *Plugin) Type() string { return "grpc" }

// Init 初始化 gRPC 连接
func (p *Plugin) Init(config map[string]string) error {
	if addr, ok := config["addr"]; ok {
		p.addr = addr
	}
	if p.addr == "" {
		return fmt.Errorf("gRPC 插件 %s: 未配置服务地址", p.name)
	}
	log.Printf("gRPC 插件 %s: 连接到 %s", p.name, p.addr)
	// TODO: 建立 gRPC 连接（grpc.Dial）
	return nil
}

// Process 通过 gRPC 调用远程插件处理记录
func (p *Plugin) Process(ctx context.Context, records []plugins.Record) ([]plugins.Record, error) {
	if p.closed {
		return nil, fmt.Errorf("gRPC 插件 %s: 已关闭", p.name)
	}
	// TODO: 将 records 序列化为 protobuf，通过 gRPC 发送到远程插件处理
	// 当前直接透传
	return records, nil
}

// Close 关闭 gRPC 连接
func (p *Plugin) Close() error {
	p.closed = true
	log.Printf("gRPC 插件 %s: 已关闭", p.name)
	return nil
}
