package incident

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	// ErrInvalidSeverity indicates severity must be critical/major/minor.
	ErrInvalidSeverity = errors.New("severity must be one of: critical, major, minor")
	// ErrInvalidTransition indicates an invalid state transition.
	ErrInvalidTransition = errors.New("invalid state transition")
)

// Valid severities.
const (
	SeverityCritical = "critical"
	SeverityMajor    = "major"
	SeverityMinor    = "minor"
)

// Valid statuses.
const (
	StatusOpen          = "open"
	StatusAcknowledged  = "acknowledged"
	StatusInvestigating = "investigating"
	StatusResolved      = "resolved"
	StatusClosed        = "closed"
)

// Service provides business logic for incidents.
type Service struct {
	repo     Repository
	timeline TimelineStore
}

// NewService creates a new incident service.
func NewService(repo Repository, timeline TimelineStore) *Service {
	return &Service{repo: repo, timeline: timeline}
}

// ListIncidents returns paginated incidents for a tenant.
func (s *Service) ListIncidents(ctx context.Context, tenantID string, page, pageSize int, filters *IncidentFilters) ([]Incident, int, error) {
	return s.repo.ListIncidents(ctx, tenantID, page, pageSize, filters)
}

// GetIncident returns a single incident by ID.
func (s *Service) GetIncident(ctx context.Context, tenantID, incidentID string) (*Incident, error) {
	return s.repo.GetIncident(ctx, tenantID, incidentID)
}

// CreateIncident creates a new incident after validation.
func (s *Service) CreateIncident(ctx context.Context, inc *Incident) (string, error) {
	if inc == nil {
		return "", fmt.Errorf("incident is required")
	}
	if err := validateSeverity(inc.Severity); err != nil {
		return "", err
	}
	if inc.Status == "" {
		inc.Status = StatusOpen
	}
	id, err := s.repo.CreateIncident(ctx, inc)
	if err != nil {
		return "", err
	}
	_ = s.timeline.AddTimelineEntry(ctx, id, "created", inc.CreatedBy, inc.Description)
	return id, nil
}

// UpdateIncident updates an existing incident.
func (s *Service) UpdateIncident(ctx context.Context, tenantID, incidentID string, update *IncidentUpdate, actorID *string) error {
	if update == nil {
		return fmt.Errorf("update is required")
	}
	if update.Severity != nil {
		if err := validateSeverity(*update.Severity); err != nil {
			return err
		}
	}
	if err := s.repo.UpdateIncident(ctx, tenantID, incidentID, update); err != nil {
		return err
	}
	if update.AssignedTo != nil {
		_ = s.timeline.AddTimelineEntry(ctx, incidentID, "assigned", actorID, assignmentTimelineDetail(*update.AssignedTo))
	}
	return nil
}

// DeleteIncident permanently deletes an incident and its attached runtime records.
func (s *Service) DeleteIncident(ctx context.Context, tenantID, incidentID string) error {
	return s.repo.DeleteIncident(ctx, tenantID, incidentID)
}

// ArchiveIncident archives an incident with verdict.
func (s *Service) ArchiveIncident(ctx context.Context, tenantID, incidentID string, verdict string, actorID *string) error {
	if strings.TrimSpace(verdict) == "" {
		return fmt.Errorf("verdict is required for archive")
	}
	if err := s.repo.ArchiveIncident(ctx, tenantID, incidentID, verdict); err != nil {
		return err
	}
	_ = s.timeline.AddTimelineEntry(ctx, incidentID, "closed", actorID, "Archived with verdict: "+verdict)
	return nil
}

// Transition transitions incident to a new status (uses state machine).
func (s *Service) Transition(ctx context.Context, tenantID, incidentID string, toStatus string, actorID *string, resolution *string) error {
	inc, err := s.repo.GetIncident(ctx, tenantID, incidentID)
	if err != nil {
		return err
	}

	sm := NewStateMachine()
	if !sm.CanTransition(inc.Status, toStatus) {
		return ErrInvalidTransition
	}

	now := time.Now().UTC()
	upd := &StatusUpdate{Status: toStatus}

	switch toStatus {
	case StatusAcknowledged:
		upd.AcknowledgedAt = &now
	case StatusResolved:
		upd.ResolvedAt = &now
		if resolution != nil {
			upd.Resolution = resolution
		}
	case StatusClosed:
		upd.ClosedAt = &now
		if resolution != nil {
			upd.Resolution = resolution
		}
	}

	if err := s.repo.UpdateIncidentStatus(ctx, tenantID, incidentID, upd); err != nil {
		return err
	}

	action := statusToTimelineAction(toStatus)
	detail := ""
	if resolution != nil && *resolution != "" {
		detail = *resolution
	}
	_ = s.timeline.AddTimelineEntry(ctx, incidentID, action, actorID, detail)
	return nil
}

// GetTimeline returns timeline entries for an incident.
func (s *Service) GetTimeline(ctx context.Context, tenantID, incidentID string) ([]TimelineEntry, error) {
	if _, err := s.repo.GetIncident(ctx, tenantID, incidentID); err != nil {
		return nil, err
	}
	return s.timeline.GetTimeline(ctx, incidentID)
}

// GetSLASummary returns SLA summary for a tenant.
func (s *Service) GetSLASummary(ctx context.Context, tenantID string) (*SLASummary, error) {
	return s.repo.GetSLASummary(ctx, tenantID)
}

func validateSeverity(sev string) error {
	s := strings.ToLower(strings.TrimSpace(sev))
	switch s {
	case SeverityCritical, SeverityMajor, SeverityMinor:
		return nil
	default:
		return ErrInvalidSeverity
	}
}

func assignmentTimelineDetail(rawAssignedTo string) string {
	assignedTo := strings.TrimSpace(rawAssignedTo)
	if assignedTo == "" {
		return "Assignment cleared"
	}
	return "Assigned to user: " + assignedTo
}

func statusToTimelineAction(status string) string {
	switch status {
	case StatusAcknowledged:
		return "acknowledged"
	case StatusInvestigating:
		return "investigating"
	case StatusResolved:
		return "resolved"
	case StatusClosed:
		return "closed"
	default:
		return status
	}
}
