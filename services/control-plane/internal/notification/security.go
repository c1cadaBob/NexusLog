package notification

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/mail"
	"net/url"
	"os"
	"strings"
	"time"
)

const maskedSecretValue = "********"

var (
	defaultDingTalkHosts = map[string]struct{}{
		"oapi.dingtalk.com": {},
		"api.dingtalk.com":  {},
	}
	blockedOutboundHosts = map[string]struct{}{
		"metadata.google.internal": {},
		"metadata.aliyun.com":      {},
		"metadata.tencentyun.com":  {},
	}
	lookupNotificationHostIPs = func(ctx context.Context, host string) ([]net.IP, error) {
		return net.DefaultResolver.LookupIP(ctx, "ip", host)
	}
)

type outboundHostValidationOptions struct {
	allowPrivate      bool
	allowedHosts      []string
	allowedCIDRs      []*net.IPNet
	failOnLookupError bool
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
	case "webhook":
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
	case "webhook":
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
	if err := validateSMTPHost(cfg.SMTPHost); err != nil {
		return fmt.Errorf("smtp target is not allowed")
	}
	if !cfg.UseTLS && !allowPlaintextSMTPTests() {
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
	if err := validateHostForOutboundTarget(host, outboundHostValidationOptions{
		allowPrivate:      false,
		failOnLookupError: true,
	}); err != nil {
		return fmt.Errorf("dingtalk webhook host is not allowed")
	}
	if !isAllowedDingTalkHost(host) {
		return fmt.Errorf("dingtalk webhook host is not allowed")
	}
	return nil
}

func validateSMTPHost(rawHost string) error {
	allowedCIDRs, err := parseCIDREnv("NOTIFICATION_SMTP_ALLOWED_CIDRS")
	if err != nil {
		return err
	}
	return validateHostForOutboundTarget(rawHost, outboundHostValidationOptions{
		allowPrivate:      envBool("NOTIFICATION_SMTP_ALLOW_PRIVATE_HOSTS", false),
		allowedHosts:      parseCSVEnv("NOTIFICATION_SMTP_ALLOWED_HOSTS"),
		allowedCIDRs:      allowedCIDRs,
		failOnLookupError: true,
	})
}

func validateHostForOutboundTest(rawHost string, allowPrivate bool) error {
	return validateHostForOutboundTarget(rawHost, outboundHostValidationOptions{
		allowPrivate:      allowPrivate,
		failOnLookupError: true,
	})
}

func validateHostForOutboundTarget(rawHost string, opts outboundHostValidationOptions) error {
	host := strings.TrimSpace(rawHost)
	if host == "" {
		return fmt.Errorf("host is required")
	}
	lower := strings.ToLower(host)
	if lower == "localhost" || strings.HasSuffix(lower, ".localhost") {
		return fmt.Errorf("host is not allowed")
	}
	if _, blocked := blockedOutboundHosts[lower]; blocked {
		return fmt.Errorf("host is not allowed")
	}
	allowedByHost := hostMatchesAllowlist(lower, opts.allowedHosts)
	if ip := net.ParseIP(host); ip != nil {
		if isAlwaysBlockedIP(ip) {
			return fmt.Errorf("ip is not allowed")
		}
		if isPrivateIP(ip) && !(opts.allowPrivate || allowedByHost || ipWithinAllowedCIDRs(ip, opts.allowedCIDRs)) {
			return fmt.Errorf("ip is not allowed")
		}
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	addrs, err := lookupNotificationHostIPs(ctx, host)
	if err != nil {
		if opts.failOnLookupError {
			return fmt.Errorf("host lookup failed")
		}
		return nil
	}
	if len(addrs) == 0 {
		if opts.failOnLookupError {
			return fmt.Errorf("host resolved to no addresses")
		}
		return nil
	}
	for _, ip := range addrs {
		if isAlwaysBlockedIP(ip) {
			return fmt.Errorf("resolved IP is not allowed")
		}
		if isPrivateIP(ip) && !(opts.allowPrivate || allowedByHost || ipWithinAllowedCIDRs(ip, opts.allowedCIDRs)) {
			return fmt.Errorf("resolved IP is not allowed")
		}
	}
	return nil
}

func isBlockedIP(ip net.IP, allowPrivate bool) bool {
	if isAlwaysBlockedIP(ip) {
		return true
	}
	if !allowPrivate && isPrivateIP(ip) {
		return true
	}
	return false
}

func isAlwaysBlockedIP(ip net.IP) bool {
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

func parseCIDREnv(key string) ([]*net.IPNet, error) {
	items := parseCSVEnv(key)
	if len(items) == 0 {
		return nil, nil
	}
	result := make([]*net.IPNet, 0, len(items))
	for _, item := range items {
		_, network, err := net.ParseCIDR(item)
		if err != nil {
			return nil, fmt.Errorf("invalid CIDR in %s", key)
		}
		result = append(result, network)
	}
	return result, nil
}

func hostMatchesAllowlist(host string, allowed []string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}
	for _, item := range allowed {
		trimmed := strings.ToLower(strings.TrimSpace(item))
		if trimmed == "" {
			continue
		}
		if host == trimmed || strings.HasSuffix(host, "."+trimmed) {
			return true
		}
	}
	return false
}

func ipWithinAllowedCIDRs(ip net.IP, networks []*net.IPNet) bool {
	for _, network := range networks {
		if network != nil && network.Contains(ip) {
			return true
		}
	}
	return false
}

func allowPlaintextSMTPDelivery() bool {
	return envBool("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_SENDS", false)
}

func allowPlaintextSMTPTests() bool {
	return allowPlaintextSMTPDelivery() || envBool("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_TESTS", false)
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
