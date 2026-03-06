package metrics

import (
	"context"
	"log"
	"time"
)

// StartCleanupJob runs a background job that deletes metrics older than retentionDays.
// Runs daily. Stops when ctx is cancelled.
func StartCleanupJob(ctx context.Context, repo *Repository, retentionDays int, interval time.Duration) {
	if interval <= 0 {
		interval = 24 * time.Hour
	}
	if retentionDays <= 0 {
		retentionDays = 30
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				deleted, err := repo.CleanupOldMetrics(ctx, retentionDays)
				if err != nil {
					log.Printf("metrics cleanup error: %v", err)
				} else if deleted > 0 {
					log.Printf("metrics cleanup: deleted %d records older than %d days", deleted, retentionDays)
				}
			}
		}
	}()
}
