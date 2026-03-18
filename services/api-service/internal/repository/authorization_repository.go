package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

func (r *AuthRepository) LoadLegacyPermissionMappings(ctx context.Context) (map[string][]string, map[string][]string, bool, error) {
	if r == nil || r.db == nil {
		return nil, nil, false, nil
	}

	const q = `
        SELECT legacy_permission, capability_bundle, scope_bundle, enabled
        FROM legacy_permission_mapping
        ORDER BY legacy_permission
    `

	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "42P01" {
			return nil, nil, false, nil
		}
		return nil, nil, false, fmt.Errorf("query legacy permission mapping: %w", err)
	}
	defer rows.Close()

	capabilityAliases := make(map[string][]string)
	permissionScopes := make(map[string][]string)
	found := false

	for rows.Next() {
		var (
			legacyPermission string
			rawCapabilities  []byte
			rawScopes        []byte
			enabled          bool
		)
		if err := rows.Scan(&legacyPermission, &rawCapabilities, &rawScopes, &enabled); err != nil {
			return nil, nil, false, fmt.Errorf("scan legacy permission mapping: %w", err)
		}
		normalizedPermission := strings.TrimSpace(legacyPermission)
		if normalizedPermission == "" {
			continue
		}

		found = true
		if !enabled {
			continue
		}

		capabilities, err := parseJSONTextArray(rawCapabilities)
		if err != nil {
			return nil, nil, false, fmt.Errorf("decode capability bundle for %s: %w", normalizedPermission, err)
		}
		scopes, err := parseJSONTextArray(rawScopes)
		if err != nil {
			return nil, nil, false, fmt.Errorf("decode scope bundle for %s: %w", normalizedPermission, err)
		}
		capabilityAliases[normalizedPermission] = capabilities
		permissionScopes[normalizedPermission] = scopes
	}

	if err := rows.Err(); err != nil {
		return nil, nil, false, fmt.Errorf("iterate legacy permission mapping: %w", err)
	}

	return capabilityAliases, permissionScopes, found, nil
}

func (r *AuthRepository) GetUserAuthzEpoch(ctx context.Context, tenantID, userID uuid.UUID) (int64, error) {
	if r == nil || r.db == nil || tenantID == uuid.Nil || userID == uuid.Nil {
		return 0, nil
	}

	const q = `
        SELECT authz_epoch
        FROM authz_version
        WHERE tenant_id = $1
          AND subject_type = 'user'
          AND subject_id = $2
        LIMIT 1
    `

	var epoch int64
	if err := r.db.QueryRowContext(ctx, q, tenantID, userID).Scan(&epoch); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "42P01" {
			return 0, nil
		}
		return 0, fmt.Errorf("query authz epoch: %w", err)
	}

	return epoch, nil
}

func parseJSONTextArray(raw []byte) ([]string, error) {
	if len(raw) == 0 {
		return []string{}, nil
	}

	var values []string
	if err := json.Unmarshal(raw, &values); err != nil {
		return nil, err
	}

	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result, nil
}
