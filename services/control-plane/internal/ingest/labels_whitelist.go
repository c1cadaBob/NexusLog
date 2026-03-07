package ingest

import (
	"regexp"
	"strings"
)

// LabelsWhitelistConfig 定义 labels 白名单配置
type LabelsWhitelistConfig struct {
	// Whitelist 允许的 label key 列表（支持正则）
	Whitelist []string
	// AutoEnv 是否自动添加 env
	AutoEnv bool
	// BlockedPatterns 禁止的 label key 模式
	BlockedPatterns []string
}

// LabelsWhitelist 定义 labels 白名单治理器
type LabelsWhitelist struct {
	whitelist      []*regexp.Regexp
	blockedPatterns []*regexp.Regexp
	autoEnv        bool
	allowedKeys    map[string]bool // 快速查找
}

// DefaultLabelsWhitelistConfig 默认白名单配置
var DefaultLabelsWhitelistConfig = LabelsWhitelistConfig{
	Whitelist: []string{
		// 环境相关
		`^env$`,
		`^environment$`,
		`^stage$`,
		`^region$`,
		`^zone$`,
		`^cluster$`,

		// 服务相关
		`^service$`,
		`^service\.name$`,
		`^service\.type$`,
		`^service\.version$`,

		// 部署相关
		`^deployment$`,
		`^namespace$`,
		`^pod$`,
		`^container$`,
		`^host$`,

		// 业务相关
		`^team$`,
		`^owner$`,
		`^project$`,
		`^app$`,
		`^component$`,
		`^tier$`,
		`^partition$`,
		`^shard$`,

		// 版本相关
		`^version$`,
		`^release$`,
		`^build$`,
		`^commit$`,

		// 运维相关
		`^datacenter$`,
		`^rack$`,
		`^instance$`,
		`^instance\.id$`,
		`^instance\.type$`,

		// 日志相关元数据
		`^log\.source$`,
		`^log\.file$`,
		`^log\.level$`,

		// 自定义业务标签（受限）
		`^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){0,2}$`, // 最多 3 级，如 customer.id, billing.type
	},
	AutoEnv: true,
	BlockedPatterns: []string{
		`^_.*`,           // 以下划线开头
		`^password`,
		`^secret`,
		`^token`,
		`^key`,
		`^credential`,
		`^private`,
		`^internal\.`,
		`^\.`,            // 以点开头
	},
}

// NewLabelsWhitelist 创建 labels 白名单治理器
func NewLabelsWhitelist(cfg LabelsWhitelistConfig) (*LabelsWhitelist, error) {
	lw := &LabelsWhitelist{
		whitelist:      make([]*regexp.Regexp, 0, len(cfg.Whitelist)),
		blockedPatterns: make([]*regexp.Regexp, 0, len(cfg.BlockedPatterns)),
		allowedKeys:     make(map[string]bool),
		autoEnv:        cfg.AutoEnv,
	}

	// 编译白名单正则
	for _, pattern := range cfg.Whitelist {
		re, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			return nil, err
		}
		lw.whitelist = append(lw.whitelist, re)
	}

	// 编译禁止模式正则
	for _, pattern := range cfg.BlockedPatterns {
		re, err := regexp.Compile("(?i)" + pattern)
		if err != nil {
			return nil, err
		}
		lw.blockedPatterns = append(lw.blockedPatterns, re)
	}

	// 预计算常见 key
	commonKeys := []string{
		"env", "environment", "stage", "region", "zone", "cluster",
		"service", "service.name", "service.type", "service.version",
		"deployment", "namespace", "pod", "container", "host",
		"team", "owner", "project", "app", "component", "tier",
		"version", "release", "build", "commit",
		"datacenter", "rack", "instance", "instance.id", "instance.type",
		"log.source", "log.file", "log.level",
	}
	for _, key := range commonKeys {
		lw.allowedKeys[key] = true
	}

	return lw, nil
}

// DefaultLabelsWhitelist 获取默认白名单治理器
var defaultLabelsWhitelist, _ = NewLabelsWhitelist(DefaultLabelsWhitelistConfig)

// IsAllowed 检查 label key 是否允许
func (lw *LabelsWhitelist) IsAllowed(key string) bool {
	key = strings.ToLower(strings.TrimSpace(key))
	if key == "" {
		return false
	}

	// 快速查找
	if lw.allowedKeys[key] {
		return true
	}

	// 检查禁止模式
	for _, pattern := range lw.blockedPatterns {
		if pattern.MatchString(key) {
			return false
		}
	}

	// 检查白名单
	for _, pattern := range lw.whitelist {
		if pattern.MatchString(key) {
			lw.allowedKeys[key] = true // 缓存
			return true
		}
	}

	return false
}

// FilterLabels 对 labels 进行白名单过滤
func (lw *LabelsWhitelist) FilterLabels(labels map[string]string) map[string]string {
	if len(labels) == 0 {
		return nil
	}

	result := make(map[string]string)
	for key, value := range labels {
		if lw.IsAllowed(key) {
			result[key] = value
		}
	}

	if len(result) == 0 {
		return nil
	}

	return result
}

// AddEnvLabel 添加环境标签
func (lw *LabelsWhitelist) AddEnvLabel(labels map[string]string, env string) map[string]string {
	if !lw.autoEnv {
		return labels
	}

	env = strings.TrimSpace(env)
	if env == "" {
		return labels
	}

	if labels == nil {
		labels = make(map[string]string)
	}

	if _, exists := labels["env"]; !exists {
		labels["env"] = env
	}

	return labels
}

// LabelsWhitelistStats 统计信息
type LabelsWhitelistStats struct {
	TotalIn     int
	TotalOut    int
	BlockedKeys []string
}

// GetStats 获取过滤统计
func (lw *LabelsWhitelist) GetStats(inputLabels map[string]string) LabelsWhitelistStats {
	stats := LabelsWhitelistStats{
		TotalIn: len(inputLabels),
	}

	if len(inputLabels) == 0 {
		return stats
	}

	result := lw.FilterLabels(inputLabels)
	stats.TotalOut = len(result)

	// 记录被拦截的 key
	for key := range inputLabels {
		if _, exists := result[key]; !exists {
			stats.BlockedKeys = append(stats.BlockedKeys, key)
		}
	}

	return stats
}

// FilterRecordLabels 过滤 AgentPullRecord 中的 attributes，返回治理后的 labels
func FilterRecordLabels(record AgentPullRecord) map[string]string {
	if defaultLabelsWhitelist == nil {
		// 白名单初始化失败，降级为简单过滤
		return simpleFilterLabels(record)
	}

	labels := make(map[string]string)

	// 从 attributes 中提取 label.* 前缀的字段
	for key, value := range record.Attributes {
		if strings.HasPrefix(key, "label.") {
			labelKey := strings.TrimPrefix(key, "label.")
			if defaultLabelsWhitelist.IsAllowed(labelKey) {
				labels[labelKey] = value
			}
		}
	}

	// 添加环境标签
	if env := strings.TrimSpace(record.Service.Environment); env != "" {
		labels = defaultLabelsWhitelist.AddEnvLabel(labels, env)
	}

	if len(labels) == 0 {
		return nil
	}

	return labels
}

// simpleFilterLabels 简单过滤（降级方案）
func simpleFilterLabels(record AgentPullRecord) map[string]string {
	labels := make(map[string]string)

	for key, value := range record.Attributes {
		trimmedKey := strings.TrimSpace(key)
		if trimmedKey == "" {
			continue
		}

		// 只接受 label. 前缀
		if strings.HasPrefix(trimmedKey, "label.") {
			labelKey := strings.TrimPrefix(trimmedKey, "label.")
			// 简单检查：不能包含敏感词
			lower := strings.ToLower(labelKey)
			if strings.Contains(lower, "password") ||
				strings.Contains(lower, "secret") ||
				strings.Contains(lower, "token") ||
				strings.Contains(lower, "key") {
				continue
			}
			labels[labelKey] = value
		}
	}

	// 添加环境
	if env := strings.TrimSpace(record.Service.Environment); env != "" {
		labels["env"] = env
	}

	if len(labels) == 0 {
		return nil
	}

	return labels
}

// BuildLabelsWithWhitelist 使用白名单构建 labels
// 这是 buildLabels 的增强版本
func BuildLabelsWithWhitelist(record AgentPullRecord) map[string]string {
	return FilterRecordLabels(record)
}
