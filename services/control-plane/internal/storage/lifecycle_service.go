package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
)

type PolicyStatus string

type LifecyclePhase string

type ExecutionStatus string

const (
	PolicyStatusActive PolicyStatus = "Active"
	PolicyStatusError  PolicyStatus = "Error"
	PolicyStatusUnused PolicyStatus = "Unused"

	LifecyclePhaseHot    LifecyclePhase = "Hot"
	LifecyclePhaseWarm   LifecyclePhase = "Warm"
	LifecyclePhaseCold   LifecyclePhase = "Cold"
	LifecyclePhaseDelete LifecyclePhase = "Delete"

	ExecutionStatusSuccess ExecutionStatus = "Success"
	ExecutionStatusFailed  ExecutionStatus = "Failed"
	ExecutionStatusIdle    ExecutionStatus = "Idle"
)

type PhaseTransition struct {
	From      LifecyclePhase `json:"from"`
	To        LifecyclePhase `json:"to"`
	Condition string         `json:"condition"`
}

type LifecyclePhaseCount struct {
	Phase LifecyclePhase `json:"phase"`
	Count int            `json:"count"`
}

type LifecyclePolicyItem struct {
	Name               string                `json:"name"`
	Status             PolicyStatus          `json:"status"`
	ManagedIndexCount  int                   `json:"managed_index_count"`
	DataStreamCount    int                   `json:"data_stream_count"`
	TemplateCount      int                   `json:"template_count"`
	UpdatedAt          string                `json:"updated_at,omitempty"`
	Description        string                `json:"description,omitempty"`
	PhaseSequence      []LifecyclePhase      `json:"phase_sequence"`
	Phases             []PhaseTransition     `json:"phases"`
	ExecutionStatus    ExecutionStatus       `json:"execution_status"`
	ExecutionMessage   string                `json:"execution_message,omitempty"`
	ErrorCount         int                   `json:"error_count"`
	Managed            bool                  `json:"managed"`
	Deprecated         bool                  `json:"deprecated"`
	CurrentPhaseCounts []LifecyclePhaseCount `json:"current_phase_counts"`
}

type LifecyclePolicySummary struct {
	Total          int    `json:"total"`
	Active         int    `json:"active"`
	Error          int    `json:"error"`
	Unused         int    `json:"unused"`
	ManagedIndices int    `json:"managed_indices"`
	OperationMode  string `json:"operation_mode"`
}

type LifecyclePolicyListResult struct {
	Items       []LifecyclePolicyItem  `json:"items"`
	Summary     LifecyclePolicySummary `json:"summary"`
	RefreshedAt string                 `json:"refreshed_at"`
}

type ilmPolicyResponse map[string]ilmPolicyEntry

type ilmPolicyEntry struct {
	ModifiedDate string           `json:"modified_date"`
	Policy       ilmPolicyPayload `json:"policy"`
	InUseBy      ilmPolicyInUseBy `json:"in_use_by"`
}

type ilmPolicyPayload struct {
	Phases     map[string]ilmPhaseDefinition `json:"phases"`
	Meta       ilmPolicyMeta                 `json:"_meta"`
	Deprecated bool                          `json:"deprecated"`
}

type ilmPolicyMeta struct {
	Managed     bool   `json:"managed"`
	Description string `json:"description"`
}

type ilmPolicyInUseBy struct {
	Indices             []string `json:"indices"`
	DataStreams         []string `json:"data_streams"`
	ComposableTemplates []string `json:"composable_templates"`
}

type ilmPhaseDefinition struct {
	MinAge  string                     `json:"min_age"`
	Actions map[string]json.RawMessage `json:"actions"`
}

type ilmExplainResponse struct {
	Indices map[string]ilmExplainIndex `json:"indices"`
}

type ilmExplainIndex struct {
	Index      string             `json:"index"`
	Managed    bool               `json:"managed"`
	Policy     string             `json:"policy"`
	Phase      string             `json:"phase"`
	Action     string             `json:"action"`
	Step       string             `json:"step"`
	FailedStep string             `json:"failed_step"`
	StepInfo   ilmExplainStepInfo `json:"step_info"`
}

type ilmExplainStepInfo struct {
	Type   string `json:"type"`
	Reason string `json:"reason"`
}

type ilmStatusResponse struct {
	OperationMode string `json:"operation_mode"`
}

type ilmExplainStats struct {
	ManagedIndexCount int
	ErrorCount        int
	CurrentPhaseCount map[LifecyclePhase]int
	FirstError        string
}

func (s *IndexService) ListLifecyclePolicies(ctx context.Context) (LifecyclePolicyListResult, error) {
	if s == nil || s.client == nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("storage lifecycle service is not configured")
	}
	if s.endpointErr != nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("elasticsearch endpoint is invalid: %w", s.endpointErr)
	}
	if strings.TrimSpace(s.endpoint) == "" {
		return LifecyclePolicyListResult{}, fmt.Errorf("elasticsearch endpoint is not configured")
	}

	policiesRaw, err := s.doRequest(ctx, "/_ilm/policy")
	if err != nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("fetch ilm policies: %w", err)
	}
	var policies ilmPolicyResponse
	if err := json.Unmarshal(policiesRaw, &policies); err != nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("decode ilm policies response: %w", err)
	}

	explainRaw, err := s.doRequest(ctx, "/_all/_ilm/explain?expand_wildcards=all")
	if err != nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("fetch ilm explain: %w", err)
	}
	var explain ilmExplainResponse
	if err := json.Unmarshal(explainRaw, &explain); err != nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("decode ilm explain response: %w", err)
	}

	statusRaw, err := s.doRequest(ctx, "/_ilm/status")
	if err != nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("fetch ilm status: %w", err)
	}
	var status ilmStatusResponse
	if err := json.Unmarshal(statusRaw, &status); err != nil {
		return LifecyclePolicyListResult{}, fmt.Errorf("decode ilm status response: %w", err)
	}

	statsByPolicy := aggregateILMExplainStats(explain)
	items := make([]LifecyclePolicyItem, 0, len(policies))
	summary := LifecyclePolicySummary{OperationMode: strings.ToUpper(strings.TrimSpace(status.OperationMode))}

	for name, entry := range policies {
		policyName := strings.TrimSpace(name)
		if policyName == "" {
			continue
		}
		stats := statsByPolicy[policyName]
		resourceRefs := len(entry.InUseBy.Indices) + len(entry.InUseBy.DataStreams) + len(entry.InUseBy.ComposableTemplates)
		phaseSequence := buildLifecyclePhaseSequence(entry.Policy.Phases)
		item := LifecyclePolicyItem{
			Name:               policyName,
			Status:             determinePolicyStatus(stats.ErrorCount, stats.ManagedIndexCount, resourceRefs),
			ManagedIndexCount:  stats.ManagedIndexCount,
			DataStreamCount:    len(entry.InUseBy.DataStreams),
			TemplateCount:      len(entry.InUseBy.ComposableTemplates),
			UpdatedAt:          strings.TrimSpace(entry.ModifiedDate),
			Description:        strings.TrimSpace(entry.Policy.Meta.Description),
			PhaseSequence:      phaseSequence,
			Phases:             buildPhaseTransitions(phaseSequence, entry.Policy.Phases),
			ExecutionStatus:    determineExecutionStatus(stats.ErrorCount, stats.ManagedIndexCount),
			ExecutionMessage:   buildExecutionMessage(stats, resourceRefs),
			ErrorCount:         stats.ErrorCount,
			Managed:            entry.Policy.Meta.Managed,
			Deprecated:         entry.Policy.Deprecated,
			CurrentPhaseCounts: buildLifecyclePhaseCounts(stats.CurrentPhaseCount),
		}
		items = append(items, item)

		summary.Total++
		summary.ManagedIndices += item.ManagedIndexCount
		switch item.Status {
		case PolicyStatusError:
			summary.Error++
		case PolicyStatusUnused:
			summary.Unused++
		default:
			summary.Active++
		}
	}

	sort.Slice(items, func(i, j int) bool {
		leftRank := lifecycleStatusRank(items[i].Status)
		rightRank := lifecycleStatusRank(items[j].Status)
		if leftRank != rightRank {
			return leftRank < rightRank
		}
		if items[i].ManagedIndexCount != items[j].ManagedIndexCount {
			return items[i].ManagedIndexCount > items[j].ManagedIndexCount
		}
		return items[i].Name < items[j].Name
	})

	return LifecyclePolicyListResult{
		Items:       items,
		Summary:     summary,
		RefreshedAt: time.Now().UTC().Format(time.RFC3339),
	}, nil
}

func aggregateILMExplainStats(payload ilmExplainResponse) map[string]ilmExplainStats {
	statsByPolicy := make(map[string]ilmExplainStats)
	for _, item := range payload.Indices {
		if !item.Managed {
			continue
		}
		policyName := strings.TrimSpace(item.Policy)
		if policyName == "" {
			continue
		}

		stats := statsByPolicy[policyName]
		if stats.CurrentPhaseCount == nil {
			stats.CurrentPhaseCount = make(map[LifecyclePhase]int)
		}
		stats.ManagedIndexCount++
		if phase, ok := normalizeLifecyclePhase(item.Phase); ok {
			stats.CurrentPhaseCount[phase]++
		}
		if isLifecycleExecutionFailed(item) {
			stats.ErrorCount++
			if stats.FirstError == "" {
				reason := strings.TrimSpace(item.StepInfo.Reason)
				if reason != "" {
					stats.FirstError = fmt.Sprintf("%s：%s", strings.TrimSpace(item.Index), reason)
				} else {
					stats.FirstError = fmt.Sprintf("%s：步骤 %s 执行失败", strings.TrimSpace(item.Index), firstNonEmpty(item.FailedStep, item.Step))
				}
			}
		}
		statsByPolicy[policyName] = stats
	}
	return statsByPolicy
}

func buildLifecyclePhaseSequence(definitions map[string]ilmPhaseDefinition) []LifecyclePhase {
	ordered := []LifecyclePhase{LifecyclePhaseHot, LifecyclePhaseWarm, LifecyclePhaseCold, LifecyclePhaseDelete}
	sequence := make([]LifecyclePhase, 0, len(ordered))
	for _, phase := range ordered {
		if _, ok := definitions[strings.ToLower(string(phase))]; ok {
			sequence = append(sequence, phase)
		}
	}
	return sequence
}

func buildPhaseTransitions(sequence []LifecyclePhase, definitions map[string]ilmPhaseDefinition) []PhaseTransition {
	if len(sequence) < 2 {
		return []PhaseTransition{}
	}
	transitions := make([]PhaseTransition, 0, len(sequence)-1)
	for index := 0; index < len(sequence)-1; index++ {
		fromPhase := sequence[index]
		toPhase := sequence[index+1]
		transitions = append(transitions, PhaseTransition{
			From:      fromPhase,
			To:        toPhase,
			Condition: buildPhaseTransitionCondition(fromPhase, toPhase, definitions),
		})
	}
	return transitions
}

func buildPhaseTransitionCondition(fromPhase, toPhase LifecyclePhase, definitions map[string]ilmPhaseDefinition) string {
	toDefinition := definitions[strings.ToLower(string(toPhase))]
	if minAge := strings.TrimSpace(toDefinition.MinAge); minAge != "" && !strings.EqualFold(minAge, "0ms") {
		return minAge
	}
	fromDefinition := definitions[strings.ToLower(string(fromPhase))]
	if rolloverCondition := summarizeRolloverCondition(fromDefinition.Actions); rolloverCondition != "" {
		return rolloverCondition
	}
	if minAge := strings.TrimSpace(toDefinition.MinAge); minAge != "" {
		return minAge
	}
	return "按策略条件"
}

func summarizeRolloverCondition(actions map[string]json.RawMessage) string {
	raw, ok := actions["rollover"]
	if !ok || len(raw) == 0 {
		return ""
	}
	var payload struct {
		MaxAge              string `json:"max_age"`
		MaxPrimaryShardSize string `json:"max_primary_shard_size"`
		MaxDocs             int64  `json:"max_docs"`
		MaxPrimaryShardDocs int64  `json:"max_primary_shard_docs"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return ""
	}
	parts := make([]string, 0, 3)
	if value := strings.TrimSpace(payload.MaxAge); value != "" {
		parts = append(parts, value)
	}
	if value := strings.TrimSpace(payload.MaxPrimaryShardSize); value != "" {
		parts = append(parts, value)
	}
	if payload.MaxDocs > 0 {
		parts = append(parts, fmt.Sprintf("%d docs", payload.MaxDocs))
	} else if payload.MaxPrimaryShardDocs > 0 {
		parts = append(parts, fmt.Sprintf("%d docs", payload.MaxPrimaryShardDocs))
	}
	return strings.Join(parts, " / ")
}

func buildLifecyclePhaseCounts(counts map[LifecyclePhase]int) []LifecyclePhaseCount {
	ordered := []LifecyclePhase{LifecyclePhaseHot, LifecyclePhaseWarm, LifecyclePhaseCold, LifecyclePhaseDelete}
	result := make([]LifecyclePhaseCount, 0, len(ordered))
	for _, phase := range ordered {
		count := counts[phase]
		if count <= 0 {
			continue
		}
		result = append(result, LifecyclePhaseCount{Phase: phase, Count: count})
	}
	return result
}

func determinePolicyStatus(errorCount, managedIndexCount, resourceRefs int) PolicyStatus {
	if errorCount > 0 {
		return PolicyStatusError
	}
	if managedIndexCount > 0 || resourceRefs > 0 {
		return PolicyStatusActive
	}
	return PolicyStatusUnused
}

func determineExecutionStatus(errorCount, managedIndexCount int) ExecutionStatus {
	if errorCount > 0 {
		return ExecutionStatusFailed
	}
	if managedIndexCount > 0 {
		return ExecutionStatusSuccess
	}
	return ExecutionStatusIdle
}

func buildExecutionMessage(stats ilmExplainStats, resourceRefs int) string {
	if stats.ErrorCount > 0 {
		if stats.FirstError != "" {
			return fmt.Sprintf("%d 个索引异常：%s", stats.ErrorCount, stats.FirstError)
		}
		return fmt.Sprintf("%d 个受管索引执行异常", stats.ErrorCount)
	}
	if stats.ManagedIndexCount > 0 {
		phaseSummary := summarizeLifecyclePhaseCounts(stats.CurrentPhaseCount)
		if phaseSummary != "" {
			return fmt.Sprintf("受管索引 %d 个 · 当前阶段 %s", stats.ManagedIndexCount, phaseSummary)
		}
		return fmt.Sprintf("受管索引 %d 个，执行正常", stats.ManagedIndexCount)
	}
	if resourceRefs > 0 {
		return "策略已被引用，当前没有受管索引"
	}
	return "策略已定义，当前未被引用"
}

func summarizeLifecyclePhaseCounts(counts map[LifecyclePhase]int) string {
	ordered := []LifecyclePhase{LifecyclePhaseHot, LifecyclePhaseWarm, LifecyclePhaseCold, LifecyclePhaseDelete}
	parts := make([]string, 0, len(ordered))
	for _, phase := range ordered {
		count := counts[phase]
		if count <= 0 {
			continue
		}
		parts = append(parts, fmt.Sprintf("%s %d", phase, count))
	}
	return strings.Join(parts, " · ")
}

func lifecycleStatusRank(status PolicyStatus) int {
	switch status {
	case PolicyStatusError:
		return 0
	case PolicyStatusActive:
		return 1
	default:
		return 2
	}
}

func normalizeLifecyclePhase(raw string) (LifecyclePhase, bool) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "hot":
		return LifecyclePhaseHot, true
	case "warm":
		return LifecyclePhaseWarm, true
	case "cold":
		return LifecyclePhaseCold, true
	case "delete":
		return LifecyclePhaseDelete, true
	default:
		return "", false
	}
}

func isLifecycleExecutionFailed(item ilmExplainIndex) bool {
	if strings.EqualFold(strings.TrimSpace(item.Step), "ERROR") {
		return true
	}
	return strings.TrimSpace(item.FailedStep) != ""
}
