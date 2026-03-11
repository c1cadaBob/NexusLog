package pullv2

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const (
	ErrorCodeInvalidParams = "REQ_INVALID_PARAMS"
	ErrorCodeUnauthorized  = "AUTH_INVALID_TOKEN"
	ErrorCodeMissingToken  = "AUTH_MISSING_TOKEN"
)

type MetaInfo struct {
	AgentID               string   `json:"agent_id"`
	Version               string   `json:"version"`
	Hostname              string   `json:"hostname,omitempty"`
	IP                    string   `json:"ip,omitempty"`
	Status                string   `json:"status"`
	LegacyPipelineEnabled bool     `json:"legacy_pipeline_enabled"`
	Capabilities          []string `json:"capabilities,omitempty"`
}

type AuthConfig struct {
	KeysByID map[string]string
}

func NewAuthConfig(activeID, activeKey, nextID, nextKey string) AuthConfig {
	keys := make(map[string]string)
	if id := strings.TrimSpace(activeID); id != "" && strings.TrimSpace(activeKey) != "" {
		keys[id] = strings.TrimSpace(activeKey)
	}
	if id := strings.TrimSpace(nextID); id != "" && strings.TrimSpace(nextKey) != "" {
		keys[id] = strings.TrimSpace(nextKey)
	}
	return AuthConfig{KeysByID: keys}
}

func RegisterRoutes(mux *http.ServeMux, svc *Service, meta MetaInfo, auth AuthConfig) {
	if mux == nil || svc == nil {
		return
	}

	mux.HandleFunc("/agent/v2/meta", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			writeError(w, http.StatusMethodNotAllowed, ErrorCodeInvalidParams, "method not allowed")
			return
		}
		if !authenticateRequest(w, r, auth) {
			return
		}
		writeJSON(w, http.StatusOK, meta)
	})

	mux.HandleFunc("/agent/v2/logs/pull", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, ErrorCodeInvalidParams, "method not allowed")
			return
		}
		if !authenticateRequest(w, r, auth) {
			return
		}
		var req PullRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, ErrorCodeInvalidParams, err.Error())
			return
		}
		resp, err := svc.Pull(req)
		if err != nil {
			writeError(w, http.StatusBadRequest, ErrorCodeInvalidParams, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})

	mux.HandleFunc("/agent/v2/logs/ack", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeError(w, http.StatusMethodNotAllowed, ErrorCodeInvalidParams, "method not allowed")
			return
		}
		if !authenticateRequest(w, r, auth) {
			return
		}
		var req AckRequest
		if err := decodeJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, ErrorCodeInvalidParams, err.Error())
			return
		}
		resp, err := svc.Ack(req)
		if err != nil {
			writeError(w, http.StatusBadRequest, ErrorCodeInvalidParams, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, resp)
	})
}

func authenticateRequest(w http.ResponseWriter, r *http.Request, auth AuthConfig) bool {
	agentKey := strings.TrimSpace(r.Header.Get("X-Agent-Key"))
	if agentKey == "" {
		writeError(w, http.StatusUnauthorized, ErrorCodeMissingToken, "unauthorized")
		return false
	}
	keyID := strings.TrimSpace(r.Header.Get("X-Key-Id"))
	if !auth.matches(keyID, agentKey) {
		writeError(w, http.StatusUnauthorized, ErrorCodeUnauthorized, "unauthorized")
		return false
	}
	return true
}

func (a AuthConfig) matches(keyID, key string) bool {
	if len(a.KeysByID) == 0 {
		return false
	}
	if keyID != "" {
		expected, ok := a.KeysByID[keyID]
		return ok && expected == key
	}
	for _, expected := range a.KeysByID {
		if expected == key {
			return true
		}
	}
	return false
}

func decodeJSON(r *http.Request, v any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	return decoder.Decode(v)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"code":    code,
		"message": message,
		"time":    time.Now().UTC().Format(time.RFC3339),
	})
}

func BuildDefaultMeta(agentID, version string) MetaInfo {
	return MetaInfo{
		AgentID:               strings.TrimSpace(agentID),
		Version:               strings.TrimSpace(version),
		Status:                "rewrite-ready",
		LegacyPipelineEnabled: false,
		Capabilities: []string{
			"scoped_pull",
			"strict_ack",
			"per_source_cursor",
		},
	}
}

func GoneV1Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusGone)
		fmt.Fprint(w, `{"code":"LEGACY_PIPELINE_REMOVED","message":"legacy collector pipeline removed; rewrite in progress"}`)
	}
}
