package notification

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DingTalkConfig holds webhook configuration for DingTalk.
type DingTalkConfig struct {
	WebhookURL string `json:"webhook_url"`
	Secret     string `json:"secret,omitempty"` // for sign verification
}

// ParseDingTalkConfig parses JSON config into DingTalkConfig.
func ParseDingTalkConfig(config json.RawMessage) (DingTalkConfig, error) {
	var m map[string]interface{}
	if err := json.Unmarshal(config, &m); err != nil {
		return DingTalkConfig{}, fmt.Errorf("invalid config json: %w", err)
	}
	cfg := DingTalkConfig{}
	if v, ok := m["webhook_url"].(string); ok {
		cfg.WebhookURL = strings.TrimSpace(v)
	}
	if v, ok := m["access_token"].(string); ok && cfg.WebhookURL == "" {
		cfg.WebhookURL = "https://oapi.dingtalk.com/robot/send?access_token=" + strings.TrimSpace(v)
	}
	if v, ok := m["secret"].(string); ok {
		cfg.Secret = v
	}
	return cfg, nil
}

// AlertMessage represents an alert to send via DingTalk.
type AlertMessage struct {
	Title    string `json:"title"`
	Detail   string `json:"detail"`
	RuleID   string `json:"rule_id"`
	Severity string `json:"severity"`
	FiredAt  string `json:"fired_at"`
}

// DingTalkSender sends alerts to DingTalk via webhook.
type DingTalkSender struct{}

// NewDingTalkSender creates a new DingTalk sender.
func NewDingTalkSender() *DingTalkSender {
	return &DingTalkSender{}
}

// Send sends an alert to DingTalk using action card format.
func (s *DingTalkSender) Send(config DingTalkConfig, alert AlertMessage) error {
	webhookURL := strings.TrimSpace(config.WebhookURL)
	if webhookURL == "" {
		return fmt.Errorf("webhook_url is required")
	}

	if err := validateDingTalkTarget(config); err != nil {
		return err
	}

	if _, err := url.Parse(webhookURL); err != nil {
		return fmt.Errorf("invalid webhook URL")
	}

	if config.Secret != "" {
		timestamp := fmt.Sprintf("%d", time.Now().UnixMilli())
		sign, err := computeSign(timestamp, strings.TrimSpace(config.Secret))
		if err != nil {
			return fmt.Errorf("compute sign: %w", err)
		}
		sep := "?"
		if strings.Contains(webhookURL, "?") {
			sep = "&"
		}
		webhookURL = webhookURL + sep + "timestamp=" + url.QueryEscape(timestamp) + "&sign=" + url.QueryEscape(sign)
	}

	title := strings.TrimSpace(alert.Title)
	if title == "" {
		title = "NexusLog Alert"
	}
	text := buildAlertText(alert)

	body := map[string]interface{}{
		"msgtype": "actionCard",
		"actionCard": map[string]interface{}{
			"title":       title,
			"text":        text,
			"singleTitle": "View Details",
			"singleURL":   "",
		},
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("marshal payload: %w", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("dingtalk webhook returned status %d", resp.StatusCode)
	}
	return nil
}

func computeSign(timestamp, secret string) (string, error) {
	stringToSign := timestamp + "\n" + secret
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(stringToSign))
	signBytes := mac.Sum(nil)
	return base64.StdEncoding.EncodeToString(signBytes), nil
}

func buildAlertText(alert AlertMessage) string {
	var b strings.Builder
	b.WriteString(fmt.Sprintf("**Severity:** %s\n\n", alert.Severity))
	if alert.Detail != "" {
		b.WriteString(fmt.Sprintf("**Detail:** %s\n\n", alert.Detail))
	}
	if alert.RuleID != "" {
		b.WriteString(fmt.Sprintf("**Rule ID:** %s\n\n", alert.RuleID))
	}
	if alert.FiredAt != "" {
		b.WriteString(fmt.Sprintf("**Fired At:** %s", alert.FiredAt))
	}
	return b.String()
}
