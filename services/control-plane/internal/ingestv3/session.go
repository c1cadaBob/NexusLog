package ingestv3

import "strings"

type CursorEntry struct {
	SourceID   string `json:"source_id"`
	FilePath   string `json:"file_path"`
	LastCursor string `json:"last_cursor,omitempty"`
	LastOffset int64  `json:"last_offset"`
}

type CursorLookup interface {
	Get(sourceID string, filePath string) (CursorEntry, bool)
}

type CursorWriter interface {
	Put(entry CursorEntry) error
}

type PullTaskPlan struct {
	SourceID    string `json:"source_id"`
	FilePath    string `json:"file_path"`
	StartCursor string `json:"start_cursor,omitempty"`
}

type PulledFile struct {
	FilePath   string `json:"file_path"`
	NextCursor string `json:"next_cursor,omitempty"`
	LastOffset int64  `json:"last_offset"`
}

func BuildPullPlans(sourceID string, filePaths []string, lookup CursorLookup) []PullTaskPlan {
	sourceID = strings.TrimSpace(sourceID)
	plans := make([]PullTaskPlan, 0, len(filePaths))
	for _, filePath := range filePaths {
		filePath = strings.TrimSpace(filePath)
		if sourceID == "" || filePath == "" {
			continue
		}
		startCursor := ""
		if lookup != nil {
			if entry, ok := lookup.Get(sourceID, filePath); ok {
				startCursor = strings.TrimSpace(entry.LastCursor)
			}
		}
		plans = append(plans, PullTaskPlan{
			SourceID:    sourceID,
			FilePath:    filePath,
			StartCursor: startCursor,
		})
	}
	return plans
}

func CommitPulledFiles(sourceID string, files []PulledFile, writer CursorWriter) error {
	if writer == nil {
		return nil
	}
	sourceID = strings.TrimSpace(sourceID)
	for _, file := range files {
		filePath := strings.TrimSpace(file.FilePath)
		if sourceID == "" || filePath == "" {
			continue
		}
		if err := writer.Put(CursorEntry{
			SourceID:   sourceID,
			FilePath:   filePath,
			LastCursor: strings.TrimSpace(file.NextCursor),
			LastOffset: file.LastOffset,
		}); err != nil {
			return err
		}
	}
	return nil
}
