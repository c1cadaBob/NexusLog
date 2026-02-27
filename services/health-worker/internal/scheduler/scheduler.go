// Package scheduler 实现健康检查的定时调度，按配置的间隔周期性执行检查任务
package scheduler

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/nexuslog/health-worker/internal/checker"
	"github.com/nexuslog/health-worker/internal/reporter"
)

// Scheduler 管理健康检查的定时调度
type Scheduler struct {
	checker  *checker.Checker
	reporter *reporter.Reporter
	interval time.Duration

	mu      sync.RWMutex
	results []checker.Result
}

// New 创建一个新的 Scheduler 实例
func New(chk *checker.Checker, rpt *reporter.Reporter, interval time.Duration) *Scheduler {
	return &Scheduler{
		checker:  chk,
		reporter: rpt,
		interval: interval,
		results:  make([]checker.Result, 0),
	}
}

// Start 启动调度循环，在 context 取消时停止
func (s *Scheduler) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()

		// 启动时立即执行一次检查
		s.runChecks(ctx)

		for {
			select {
			case <-ctx.Done():
				log.Println("调度器已停止")
				return
			case <-ticker.C:
				s.runChecks(ctx)
			}
		}
	}()
}

// LatestResults 返回最近一轮检查结果的副本
func (s *Scheduler) LatestResults() []checker.Result {
	s.mu.RLock()
	defer s.mu.RUnlock()

	copied := make([]checker.Result, len(s.results))
	copy(copied, s.results)
	return copied
}

// runChecks 执行一轮健康检查
func (s *Scheduler) runChecks(ctx context.Context) {
	// TODO: 从配置中读取检查目标列表，当前使用空列表
	targets := s.getTargets()

	results := make([]checker.Result, 0, len(targets))
	for _, target := range targets {
		result := s.checker.Check(ctx, target)
		results = append(results, result)
		s.reporter.Report(result)
	}

	s.mu.Lock()
	s.results = results
	s.mu.Unlock()

	if len(targets) > 0 {
		log.Printf("完成一轮健康检查，共 %d 个目标", len(targets))
	}
}

// getTargets 获取需要检查的目标列表
// TODO: 从配置文件或服务发现中动态获取
func (s *Scheduler) getTargets() []string {
	return []string{}
}
