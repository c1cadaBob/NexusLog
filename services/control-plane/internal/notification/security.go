package notification

import (
	"encoding/json"
	"fmt"
	"net"
	"net/mail"
	"net/url"
	"os"
	"strings"
)

const maskedSecretValue = "********"

var defaultDingTalkHosts = map[string]struct{}{
	"oapi.dingtalk.com": {},
	"api.dingtalk.com":  {},
}

func sanitizeChannel(ch Channel) Channel {
	ch.Config = sanitizeConfigByType(ch.Type, ch.Config)
	return ch
}

func sanitizeChannels(items []Channel) []Channel {
	if len(items) == 0 {
		return nil
	}
	out := make([]Channel, 0, len(items))
	for _, item := range items {
		out = append(out, sanitizeChannel(item))
	}
	return out
}

func sanitizeConfigByType(chType string, raw json.RawMessage) json.RawMessage {
	config, ok := parseConfigMap(raw)
	if !ok {
		return raw
	}
	switch strings.ToLower(strings.TrimSpace(chType)) {
	case "email":
		maskConfigValue(config, "smtp_password")
	case "dingtalk":
		maskConfigValue(config, "webhook_url")
		maskConfigValue(config, "access_token")
		maskConfigValue(config, "secret")
	}
	masked, err := json.Marshal(config)
	if err != nil {
		return raw
	}
	return masked
}

func mergeMaskedConfig(chType string, existing, incoming json.RawMessage) (json.RawMessage, error) {
	candidate, ok := parseConfigMap(incoming)
	if !ok {
		return nil, fmt.Errorf("config must be valid JSON object")
	}
	existingMap, _ := parseConfigMap(existing)
	switch strings.ToLower(strings.TrimSpace(chType)) {
	case "email":
		preserveMaskedValue(candidate, existingMap, "smtp_password")
	case "dingtalk":
		preserveMaskedValue(candidate, existingMap, "webhook_url")
		preserveMaskedValue(candidate, existingMap, "access_token")
		preserveMaskedValue(candidate, existingMap, "secret")
	}
	merged, err := json.Marshal(candidate)
	if err != nil {
		return nil, fmt.Errorf("marshal merged config: %w", err)
	}
	return merged, nil
}

func validateEmailTestTarget(cfg EmailConfig, to string) error {
	if _, err := mail.ParseAddress(strings.TrimSpace(to)); err != nil {
		return fmt.Errorf("invalid recipient email")
	}
	if err := validateHostForOutboundTest(cfg.SMTPHost, true); err != nil {
		return fmt.Errorf("smtp target is not allowed")
	}
	if !cfg.UseTLS && !envBool("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_TESTS", false) {
		return fmt.Errorf("plaintext SMTP test is disabled")
	}
	return nil
}

func validateDingTalkTarget(cfg DingTalkConfig) error {
	webhookURL := strings.TrimSpace(cfg.WebhookURL)
	if webhookURL == "" {
		return fmt.Errorf("webhook_url is required")
	}
	parsed, err := url.Parse(webhookURL)
	if err != nil {
		return fmt.Errorf("invalid webhook URL")
	}
	if !strings.EqualFold(parsed.Scheme, "https") {
		return fmt.Errorf("dingtalk webhook must use https")
	}
	if parsed.User != nil {
		return fmt.Errorf("dingtalk webhook must not contain credentials")
	}
	host := strings.TrimSpace(parsed.Hostname())
	if err := validateHostForOutboundTest(host, false); err != nil {
		return fmt.Errorf("dingtalk webhook host is not allowed")
	}
	if !isAllowedDingTalkHost(host) {
		return fmt.Errorf("dingtalk webhook host is not allowed")
	}
	return nil
}

func validateHostForOutboundTest(rawHost string, allowPrivate bool) error {
	host := strings.TrimSpace(rawHost)
	if host == "" {
		return fmt.Errorf("host is required")
	}
	lower := strings.ToLower(host)
	if lower == "localhost" || strings.HasSuffix(lower, ".localhost") || lower == "metadata.google.internal" {
		return fmt.Errorf("host is not allowed")
	}
	if ip := net.ParseIP(host); ip != nil {
		if isBlockedIP(ip, allowPrivate) {
			return fmt.Errorf("ip is not allowed")
		}
		return nil
	}
	addrs, err := net.LookupIP(host)
	if err != nil {
		return nil
	}
	for _, ip := range addrs {
		if isBlockedIP(ip, allowPrivate) {
			return fmt.Errorf("resolved IP is not allowed")
		}
	}
	return nil
}

func isBlockedIP(ip net.IP, allowPrivate bool) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return true
	}
	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] == 169 && ip4[1] == 254 {
			return true
		}
		if ip4[0] == 100 && ip4[1] == 100 && ip4[2] == 100 && ip4[3] == 200 {
			return true
		}
	}
	if !allowPrivate && isPrivateIP(ip) {
		return true
	}
	return false
}

func isPrivateIP(ip net.IP) bool {
	privateBlocks := []string{
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"fc00::/7",
		"fe80::/10",
	}
	for _, cidr := range privateBlocks {
		_, network, err := net.ParseCIDR(cidr)
		if err == nil && network.Contains(ip) {
			return true
		}
	}
	return false
}

func isAllowedDingTalkHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}
	allowed := parseCSVEnv("NOTIFICATION_DINGTALK_ALLOWED_HOSTS")
	if len(allowed) == 0 {
		_, ok := defaultDingTalkHosts[host]
		return ok
	}
	for _, item := range allowed {
		item = strings.ToLower(strings.TrimSpace(item))
		if item == "" {
			continue
		}
		if host == item || strings.HasSuffix(host, "."+item) {
			return true
		}
	}
	return false
}

func parseCSVEnv(key string) []string {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		result = append(result, trimmed)
	}
	return result
}

func envBool(key string, fallback bool) bool {
	raw := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if raw == "" {
		return fallback
	}
	return raw == "1" || raw == "true" || raw == "yes" || raw == "on"
}

func parseConfigMap(raw json.RawMessage) (map[string]any, bool) {
	if len(raw) == 0 {
		return map[string]any{}, true
	}
	var result map[string]any
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, false
	}
	if result == nil {
		result = map[string]any{}
	}
	return result, true
}

func maskConfigValue(config map[string]any, key string) {
	value, ok := config[key]
	if !ok || value == nil {
		return
	}
	text := strings.TrimSpace(fmt.Sprintf("%v", value))
	if text == "" || text == "<nil>" {
		return
	}
	config[key] = maskedSecretValue
}

func preserveMaskedValue(candidate, existing map[string]any, key string) {
	value, ok := candidate[key]
	if !ok {
		return
	}
	text := strings.TrimSpace(fmt.Sprintf("%v", value))
	if text != maskedSecretValue {
		return
	}
	if existingValue, exists := existing[key]; exists {
		candidate[key] = existingValue
		return
	}
	delete(candidate, key)
}
