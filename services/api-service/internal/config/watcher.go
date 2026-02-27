// Package config 提供配置管理和热更新能力
package config

import (
	"context"
	"time"
)

// ChangeLevel 变更级别常量
const (
	// ChangeLevelNone 无需审批，可直接热更新
	ChangeLevelNone = "none"
	// ChangeLevelNormal 常规审批，团队 Lead 审批后生效
	ChangeLevelNormal = "normal"
	// ChangeLevelCAB 高危变更，需 CAB 委员会审批
	ChangeLevelCAB = "cab"
)

// ChangeEvent 配置变更事件
type ChangeEvent struct {
	// FilePath 发生变更的配置文件路径
	FilePath string
	// Timestamp 变更发生的时间
	Timestamp time.Time
	// ChangeLevel 变更级别: none / normal / cab
	ChangeLevel string
}

// ChangeHandler 配置变更处理函数
type ChangeHandler func(event ChangeEvent) error

// Watcher 配置文件监听接口
// 监听配置文件变更并触发热更新回调
type Watcher interface {
	// Watch 开始监听指定路径的配置文件变更
	// ctx 用于控制监听生命周期
	Watch(ctx context.Context, paths []string) error

	// OnChange 注册配置变更回调
	OnChange(handler ChangeHandler)

	// Close 停止监听并释放资源
	Close() error
}

// Reloader 配置热重载接口
// 组件实现此接口以支持运行时配置更新
type Reloader interface {
	// Reload 重新加载配置
	// 返回 error 表示重载失败，应保留旧配置
	Reload(ctx context.Context) error

	// CanHotReload 返回当前组件是否支持热重载
	CanHotReload() bool
}
