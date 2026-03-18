package middleware

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/lib/pq"
)

type reservedSubjectPolicy struct {
	Reserved                bool
	InteractiveLoginAllowed bool
	SystemSubject           bool
	BreakGlassAllowed       bool
	ManagedBy               string
	Found                   bool
}

func lookupReservedSubjectPolicy(ctx context.Context, db *sql.DB, tenantID, username string) (reservedSubjectPolicy, error) {
	if db == nil || strings.TrimSpace(tenantID) == "" || strings.TrimSpace(username) == "" {
		return reservedSubjectPolicy{}, nil
	}
	if !isReservedUsername(username) {
		return reservedSubjectPolicy{}, nil
	}

	const q = `
		SELECT reserved, interactive_login_allowed, system_subject, break_glass_allowed, COALESCE(managed_by, '')
		FROM subject_reserved_policy
		WHERE tenant_id = $1::uuid
		  AND subject_type = 'username'
		  AND LOWER(subject_ref) = LOWER($2)
		LIMIT 1
	`

	var policy reservedSubjectPolicy
	if err := db.QueryRowContext(ctx, q, strings.TrimSpace(tenantID), strings.TrimSpace(username)).Scan(
		&policy.Reserved,
		&policy.InteractiveLoginAllowed,
		&policy.SystemSubject,
		&policy.BreakGlassAllowed,
		&policy.ManagedBy,
	); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return reservedSubjectPolicy{}, nil
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "42P01" {
			return reservedSubjectPolicy{}, nil
		}
		return reservedSubjectPolicy{}, fmt.Errorf("query reserved subject policy: %w", err)
	}

	policy.Found = true
	return policy, nil
}

func applyReservedSubjectPolicy(snapshot AuthorizationContextSnapshot, policy reservedSubjectPolicy) AuthorizationContextSnapshot {
	if !policy.Found {
		return snapshot
	}
	actorFlags := make(map[string]bool, len(snapshot.ActorFlags))
	for key, value := range snapshot.ActorFlags {
		actorFlags[key] = value
	}
	actorFlags["reserved"] = policy.Reserved
	actorFlags["interactive_login_allowed"] = policy.InteractiveLoginAllowed
	actorFlags["system_subject"] = policy.SystemSubject
	snapshot.ActorFlags = actorFlags
	if policy.SystemSubject {
		snapshot.Scopes = ensureReservedSubjectScopes(snapshot.Scopes)
	}
	return snapshot
}

func ensureReservedSubjectScopes(scopes []string) []string {
	set := make(map[string]struct{}, len(scopes)+2)
	for _, scope := range scopes {
		trimmed := strings.TrimSpace(scope)
		if trimmed == "" {
			continue
		}
		set[trimmed] = struct{}{}
	}
	set["system"] = struct{}{}
	set["tenant"] = struct{}{}
	return sortedStringSet(set)
}
