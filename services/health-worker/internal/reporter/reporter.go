// Package reporter 负责汇报健康检查结果，支持日志输出和后续扩展（如推送到 Redis/Prometheus）
package reporter

import (
	"log"

	"github.com/nexuslog/health-worker/internal/checker"
)

// Reporter 处理健康检查结果的上报
type Reporter struct{}

// New 创建一个新的 Reporter 实例
func New() *Reporter {
	return &Reporter{}
}

// Report 上报单条健康检查结果
func (r *Reporter) Report(result checker.Result) {
	if result.Healthy {
		log.Printf("[健康] %s - 延迟: %v", result.Target, result.Latency)
	} else {
		log.Printf("[异常] %s - 错误: %s - 延迟: %v", result.Target, result.Error, result.Latency)
	}
}
