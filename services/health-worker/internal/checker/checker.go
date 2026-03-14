// Package checker 实现健康检查逻辑，负责对目标服务执行健康探测
package checker

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

// Result 表示单次健康检查的结果
type Result struct {
	Target    string        `json:"target"`
	Healthy   bool          `json:"healthy"`
	Latency   time.Duration `json:"latency"`
	Error     string        `json:"error,omitempty"`
	CheckedAt time.Time     `json:"checked_at"`
}

// Checker 执行健康检查
type Checker struct {
	client *http.Client
}

// New 创建一个新的 Checker 实例
func New() *Checker {
	return &Checker{
		client: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// Check 对指定目标执行健康检查
func (c *Checker) Check(ctx context.Context, target string) Result {
	start := time.Now()
	result := Result{
		Target:    target,
		CheckedAt: start,
	}

	normalizedTarget, err := normalizeCheckTarget(target)
	if err != nil {
		result.Error = fmt.Sprintf("非法目标: %v", err)
		result.Latency = time.Since(start)
		return result
	}
	result.Target = normalizedTarget

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, normalizedTarget, nil)
	if err != nil {
		result.Error = fmt.Sprintf("创建请求失败: %v", err)
		result.Latency = time.Since(start)
		return result
	}

	resp, err := c.client.Do(req)
	result.Latency = time.Since(start)

	if err != nil {
		result.Error = fmt.Sprintf("请求失败: %v", err)
		return result
	}
	defer resp.Body.Close()

	result.Healthy = resp.StatusCode >= 200 && resp.StatusCode < 300
	if !result.Healthy {
		result.Error = fmt.Sprintf("非健康状态码: %d", resp.StatusCode)
	}

	return result
}
