// Package wasm 实现基于 WASM 的本地插件
// 通过 WebAssembly 运行时加载和执行插件模块，支持安全沙箱隔离
package wasm

import (
	"context"
	"fmt"
	"log"

	"github.com/nexuslog/collector-agent/plugins"
)

// Plugin 基于 WASM 的本地插件实现
type Plugin struct {
	name       string
	modulePath string // WASM 模块文件路径
	closed     bool
}

// New 创建 WASM 插件实例
func New(name, modulePath string) *Plugin {
	return &Plugin{
		name:       name,
		modulePath: modulePath,
	}
}

// Name 返回插件名称
func (p *Plugin) Name() string { return p.name }

// Type 返回插件类型
func (p *Plugin) Type() string { return "wasm" }

// Init 加载 WASM 模块
func (p *Plugin) Init(config map[string]string) error {
	if path, ok := config["module_path"]; ok {
		p.modulePath = path
	}
	if p.modulePath == "" {
		return fmt.Errorf("WASM 插件 %s: 未配置模块路径", p.name)
	}
	log.Printf("WASM 插件 %s: 加载模块 %s", p.name, p.modulePath)
	// TODO: 使用 wazero 或 wasmtime-go 加载 WASM 模块
	return nil
}

// Process 通过 WASM 运行时执行插件处理记录
func (p *Plugin) Process(ctx context.Context, records []plugins.Record) ([]plugins.Record, error) {
	if p.closed {
		return nil, fmt.Errorf("WASM 插件 %s: 已关闭", p.name)
	}
	// TODO: 将 records 传入 WASM 模块处理
	// 当前直接透传
	return records, nil
}

// Close 释放 WASM 运行时资源
func (p *Plugin) Close() error {
	p.closed = true
	log.Printf("WASM 插件 %s: 已关闭", p.name)
	return nil
}
