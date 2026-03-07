// Package wasm 实现基于 WASM 的本地插件
// 通过 WebAssembly 运行时加载和执行插件模块，支持安全沙箱隔离
package wasm

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/nexuslog/collector-agent/plugins"
)

// Plugin 基于 WASM 的本地插件实现
type Plugin struct {
	name       string
	modulePath string
	runtime    interface{} // wazero.Runtime
	module     interface{} // wazero.CompiledModule
	instance   interface{} // api.Module
	closed     bool
	mu         sync.Mutex

	// WASM 模块导出的函数名
	processFuncName string
}

// WASMPluginFunc 插件导出函数的签名
// 参数: records_json string
// 返回: result_json string
const (
	DefaultProcessFuncName = "process_records"
)

// New 创建 WASM 插件实例
func New(name, modulePath string) *Plugin {
	return &Plugin{
		name:            name,
		modulePath:      modulePath,
		processFuncName: DefaultProcessFuncName,
	}
}

// Name 返回插件名称
func (p *Plugin) Name() string { return p.name }

// Type 返回插件类型
func (p *Plugin) Type() string { return "wasm" }

// Init 加载 WASM 模块
func (p *Plugin) Init(config map[string]string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return fmt.Errorf("WASM 插件 %s: 已关闭", p.name)
	}

	// 从配置中获取参数
	if path, ok := config["module_path"]; ok {
		p.modulePath = path
	}
	if funcName, ok := config["process_func"]; ok && funcName != "" {
		p.processFuncName = funcName
	}

	if p.modulePath == "" {
		return fmt.Errorf("WASM 插件 %s: 未配置模块路径", p.name)
	}

	// 检查文件是否存在
	if _, err := os.Stat(p.modulePath); err != nil {
		return fmt.Errorf("WASM 插件 %s: 模块文件不存在: %w", p.name, err)
	}

	log.Printf("WASM 插件 %s: 加载模块 %s", p.name, p.modulePath)

	// TODO: 使用 wazero 或 wasmtime-go 加载 WASM 模块
	// 示例代码（需要添加依赖 github.com/tetratelabs/wazero）：
	//
	// runtimeConfig := wazero.NewRuntimeConfig().WithCloseOnContextDone(true)
	// runtime := wazero.NewRuntimeWithConfig(context.Background(), runtimeConfig)
	// moduleBytes, err := os.ReadFile(p.modulePath)
	// compiled, err := runtime.CompileModule(context.Background(), moduleBytes)
	// module, err := runtime.InstantiateModule(context.Background(), compiled, wazero.NewModuleConfig())
	// p.runtime = runtime
	// p.module = compiled
	// p.instance = module

	log.Printf("WASM 插件 %s: 模块路径已配置 (需要 wazero 依赖才能加载)", p.name)
	return nil
}

// Process 通过 WASM 运行时执行插件处理记录
func (p *Plugin) Process(ctx context.Context, records []plugins.Record) ([]plugins.Record, error) {
	p.mu.Lock()
	if p.closed {
		p.mu.Unlock()
		return nil, fmt.Errorf("WASM 插件 %s: 已关闭", p.name)
	}
	if p.instance == nil {
		p.mu.Unlock()
		// 无实例时透传
		log.Printf("WASM 插件 %s: 模块未加载，透传原始记录", p.name)
		return records, nil
	}
	p.mu.Unlock()

	// TODO: 调用 WASM 模块处理记录
	// 示例代码：
	// processFunc := p.instance.ExportedFunctions()[p.processFuncName]
	// if processFunc == nil {
	//     return records, nil
	// }
	// results, err := processFunc.Call(ctx, inputJSON)
	// ...

	log.Printf("WASM 插件 %s: 处理 %d 条记录 (透传模式)", p.name, len(records))
	return records, nil
}

// Close 释放 WASM 运行时资源
func (p *Plugin) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.closed {
		return nil
	}
	p.closed = true

	// TODO: 关闭 WASM 模块和运行时
	// if p.instance != nil {
	//     p.instance.Close(context.Background())
	// }
	// if p.module != nil {
	//     p.module.Close(context.Background())
	// }
	// if p.runtime != nil {
	//     p.runtime.Close(context.Background())
	// }

	log.Printf("WASM 插件 %s: 已关闭", p.name)
	return nil
}

// compileTimeCheck 确保 Plugin 实现 plugins.Plugin 接口
var _ plugins.Plugin = (*Plugin)(nil)
