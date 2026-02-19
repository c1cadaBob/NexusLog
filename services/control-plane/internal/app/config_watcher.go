// Package app 提供应用初始化和依赖注入功能
package app

import (
	"context"
	"time"
)

// ConfigChangeEvent 配置变更事件
type ConfigChangeEvent struct {
	// FilePath 发生变更的配置文件路径
	FilePath string
	// Timestamp 变更发生的时间
	Timestamp time.Time
	// ChangeLevel 变更级别: none / normal / cab
	ChangeLevel string
}

// ConfigChangeHandler 配置变更处理函数
type ConfigChangeHandler func(event ConfigChangeEvent) error

// ConfigWatcher 配置文件监听接口
// 用于监听配置文件变更并触发热更新
// 需求: 22.2
type ConfigWatcher interface {
	// Watch 开始监听指定路径的配置文件变更
	// ctx 用于控制监听生命周期，取消时停止监听
	Watch(ctx context.Context, paths []string) error

	// OnChange 注册配置变更回调
	// 当监听的文件发生变更时，调用 handler 处理
	OnChange(handler ConfigChangeHandler)

	// Close 停止监听并释放资源
	Close() error
}

// ConfigReloader 配置热重载接口
// 组件实现此接口以支持运行时配置更新
type ConfigReloader interface {
	// Reload 重新加载配置
	// 返回 error 表示重载失败，应保留旧配置
	Reload(ctx context.Context) error

	// CanHotReload 返回当前组件是否支持热重载
	CanHotReload() bool
}
