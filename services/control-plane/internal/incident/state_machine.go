package incident

import "strings"

// StateMachine validates incident status transitions.
type StateMachine struct {
	transitions map[string]map[string]bool
}

// NewStateMachine creates a state machine with valid transitions:
// - open → acknowledged
// - open → investigating (skip acknowledge)
// - acknowledged → investigating
// - investigating → resolved
// - resolved → closed
// - Any state → closed (force close)
func NewStateMachine() *StateMachine {
	sm := &StateMachine{
		transitions: map[string]map[string]bool{
			StatusOpen: {
				StatusAcknowledged:  true,
				StatusInvestigating: true,
				StatusClosed:        true,
			},
			StatusAcknowledged: {
				StatusInvestigating: true,
				StatusClosed:        true,
			},
			StatusInvestigating: {
				StatusResolved: true,
				StatusClosed:   true,
			},
			StatusResolved: {
				StatusClosed: true,
			},
			StatusClosed: {}, // terminal state
		},
	}
	return sm
}

// CanTransition returns true if fromStatus → toStatus is valid.
func (sm *StateMachine) CanTransition(fromStatus, toStatus string) bool {
	from := strings.ToLower(strings.TrimSpace(fromStatus))
	to := strings.ToLower(strings.TrimSpace(toStatus))
	if from == to {
		return false
	}
	allowed, ok := sm.transitions[from]
	if !ok {
		return false
	}
	return allowed[to]
}
