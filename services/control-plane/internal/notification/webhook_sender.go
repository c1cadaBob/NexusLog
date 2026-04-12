package notification

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// WebhookConfig holds generic webhook channel configuration.
type WebhookConfig struct {
	WebhookURL string            `json:"webhook_url"`
	Secret     string            `json:"secret,omitempty"`
	Events     []string          `json:"events,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
}

func ParseWebhookConfig(raw json.RawMessage) (WebhookConfig, error) {
	config, ok := parseConfigMap(raw)
	if !ok {
		return WebhookConfig{}, fmt.Errorf("invalid webhook config")
	}
	cfg := WebhookConfig{
		WebhookURL: strings.TrimSpace(stringValue(config, "webhook_url", "url")),
		Secret:     strings.TrimSpace(stringValue(config, "secret")),
		Headers:    mapStringValue(config["headers"]),
		Events:     stringSliceValue(config["events"]),
	}
	return cfg, nil
}

func validateWebhookTarget(cfg WebhookConfig) error {
	webhookURL := strings.TrimSpace(cfg.WebhookURL)
	if webhookURL == "" {
		return fmt.Errorf("webhook_url is required")
	}
	parsed, err := url.Parse(webhookURL)
	if err != nil {
		return fmt.Errorf("invalid webhook URL")
	}
	if parsed.User != nil {
		return fmt.Errorf("webhook URL must not contain credentials")
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "https" && !(scheme == "http" && envBool("NOTIFICATION_WEBHOOK_ALLOW_HTTP", false)) {
		return fmt.Errorf("webhook must use https")
	}
	allowedCIDRs, err := parseCIDREnv("NOTIFICATION_WEBHOOK_ALLOWED_CIDRS")
	if err != nil {
		return err
	}
	if err := validateHostForOutboundTarget(parsed.Hostname(), outboundHostValidationOptions{
		allowPrivate:      envBool("NOTIFICATION_WEBHOOK_ALLOW_PRIVATE_HOSTS", false),
		allowedHosts:      parseCSVEnv("NOTIFICATION_WEBHOOK_ALLOWED_HOSTS"),
		allowedCIDRs:      allowedCIDRs,
		failOnLookupError: true,
	}); err != nil {
		return fmt.Errorf("webhook host is not allowed")
	}
	return nil
}

// WebhookSender sends generic JSON webhook messages.
type WebhookSender struct {
	client *http.Client
}

func NewWebhookSender() *WebhookSender {
	return &WebhookSender{client: &http.Client{Timeout: 10 * time.Second}}
}

func (s *WebhookSender) SendTest(cfg WebhookConfig, channelName string) error {
	payload := map[string]any{
		"event":      "notification.channel.test",
		"channel":    strings.TrimSpace(channelName),
		"message":    "This is a test message from NexusLog webhook channel.",
		"sent_at":    time.Now().UTC().Format(time.RFC3339),
		"source":     "NexusLog",
		"event_scope": cfg.Events,
	}
	return s.send(cfg, "notification.channel.test", payload)
}

func (s *WebhookSender) SendAlert(cfg WebhookConfig, payload DispatchPayload) error {
	body := map[string]any{
		"event":       "alert.notification",
		"title":       payload.Title,
		"detail":      payload.Detail,
		"severity":    payload.Severity,
		"fired_at":    payload.FiredAt,
		"tenant_id":   payload.TenantID,
		"rule_id":     payload.RuleID,
		"source_id":   payload.SourceID,
		"agent_id":    payload.AgentID,
		"resource_threshold_id": payload.ResourceThresholdID,
	}
	return s.send(cfg, "alert.notification", body)
}

func (s *WebhookSender) send(cfg WebhookConfig, event string, payload any) error {
	if s == nil || s.client == nil {
		return fmt.Errorf("webhook sender is not configured")
	}
	if err := validateWebhookTarget(cfg); err != nil {
		return err
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal webhook payload: %w", err)
	}
	request, err := http.NewRequest(http.MethodPost, strings.TrimSpace(cfg.WebhookURL), bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("build webhook request: %w", err)
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "NexusLog-Webhook/1.0")
	request.Header.Set("X-NexusLog-Event", event)
	timestamp := time.Now().UTC().Format(time.RFC3339)
	request.Header.Set("X-NexusLog-Timestamp", timestamp)
	for key, value := range cfg.Headers {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(value)
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		request.Header.Set(trimmedKey, trimmedValue)
	}
	if secret := strings.TrimSpace(cfg.Secret); secret != "" {
		mac := hmac.New(sha256.New, []byte(secret))
		_, _ = mac.Write([]byte(timestamp))
		_, _ = mac.Write([]byte("."))
		_, _ = mac.Write(body)
		request.Header.Set("X-NexusLog-Signature", hex.EncodeToString(mac.Sum(nil)))
	}

	response, err := s.client.Do(request)
	if err != nil {
		return fmt.Errorf("send webhook request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("webhook returned status %d", response.StatusCode)
	}
	return nil
}

func stringValue(config map[string]any, keys ...string) string {
	for _, key := range keys {
		if value, ok := config[key].(string); ok {
			trimmed := strings.TrimSpace(value)
			if trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

func stringSliceValue(raw any) []string {
	items, ok := raw.([]any)
	if !ok {
		return []string{}
	}
	result := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		value := strings.TrimSpace(fmt.Sprintf("%v", item))
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func mapStringValue(raw any) map[string]string {
	input, ok := raw.(map[string]any)
	if !ok {
		return map[string]string{}
	}
	result := make(map[string]string, len(input))
	for key, value := range input {
		trimmedKey := strings.TrimSpace(key)
		trimmedValue := strings.TrimSpace(fmt.Sprintf("%v", value))
		if trimmedKey == "" || trimmedValue == "" {
			continue
		}
		result[trimmedKey] = trimmedValue
	}
	return result
}
