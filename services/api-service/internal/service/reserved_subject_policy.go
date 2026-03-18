package service

import (
	"strings"

	"github.com/nexuslog/api-service/internal/repository"
)

func ApplyReservedSubjectPolicyForMiddleware(
	snapshot AuthorizationContextSnapshot,
	policy repository.ReservedSubjectPolicyRecord,
) AuthorizationContextSnapshot {
	return applyReservedSubjectPolicy(snapshot, policy)
}

func applyReservedSubjectPolicy(
	snapshot AuthorizationContextSnapshot,
	policy repository.ReservedSubjectPolicyRecord,
) AuthorizationContextSnapshot {
	if !policy.Found {
		return snapshot
	}

	actorFlags := cloneActorFlags(snapshot.ActorFlags)
	actorFlags["reserved"] = policy.Reserved
	actorFlags["interactive_login_allowed"] = policy.InteractiveLoginAllowed
	actorFlags["system_subject"] = policy.SystemSubject
	snapshot.ActorFlags = actorFlags

	if policy.SystemSubject {
		snapshot.Scopes = ensureAuthorizationScopes(snapshot.Scopes, "system", "tenant")
	}
	return snapshot
}

func cloneActorFlags(actorFlags map[string]bool) map[string]bool {
	if len(actorFlags) == 0 {
		return map[string]bool{}
	}
	cloned := make(map[string]bool, len(actorFlags))
	for key, value := range actorFlags {
		cloned[key] = value
	}
	return cloned
}

func ensureAuthorizationScopes(scopes []string, required ...string) []string {
	set := make(map[string]struct{}, len(scopes)+len(required))
	for _, scope := range scopes {
		trimmed := strings.TrimSpace(scope)
		if trimmed == "" {
			continue
		}
		set[trimmed] = struct{}{}
	}
	for _, scope := range required {
		trimmed := strings.TrimSpace(scope)
		if trimmed == "" {
			continue
		}
		set[trimmed] = struct{}{}
	}
	return sortedStringSet(set)
}
