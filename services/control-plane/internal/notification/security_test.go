package notification

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"os"
	"testing"
)

func TestSanitizeChannelMasksSensitiveConfigFields(t *testing.T) {
	ch := Channel{
		Type:   "dingtalk",
		Config: json.RawMessage(`{"webhook_url":"https://oapi.dingtalk.com/robot/send?access_token=abc","access_token":"abc","secret":"shh"}`),
	}

	sanitized := sanitizeChannel(ch)
	var cfg map[string]any
	if err := json.Unmarshal(sanitized.Config, &cfg); err != nil {
		t.Fatalf("unmarshal sanitized config: %v", err)
	}
	for _, key := range []string{"webhook_url", "access_token", "secret"} {
		if cfg[key] != maskedSecretValue {
			t.Fatalf("config[%s]=%v, want %q", key, cfg[key], maskedSecretValue)
		}
	}
}

func TestMergeMaskedConfigPreservesStoredSecrets(t *testing.T) {
	existing := json.RawMessage(`{"smtp_host":"smtp.example.com","smtp_password":"real-secret","from_email":"ops@example.com"}`)
	incoming := json.RawMessage(`{"smtp_host":"smtp.example.com","smtp_password":"********","from_email":"ops@example.com"}`)

	merged, err := mergeMaskedConfig("email", existing, incoming)
	if err != nil {
		t.Fatalf("mergeMaskedConfig() error = %v", err)
	}
	var cfg map[string]any
	if err := json.Unmarshal(merged, &cfg); err != nil {
		t.Fatalf("unmarshal merged config: %v", err)
	}
	if cfg["smtp_password"] != "real-secret" {
		t.Fatalf("smtp_password=%v, want real-secret", cfg["smtp_password"])
	}
}

func TestValidateDingTalkTargetRejectsPrivateOrInsecureHosts(t *testing.T) {
	os.Unsetenv("NOTIFICATION_DINGTALK_ALLOWED_HOSTS")

	cases := []struct {
		name string
		cfg  DingTalkConfig
	}{
		{name: "http scheme", cfg: DingTalkConfig{WebhookURL: "http://oapi.dingtalk.com/robot/send?access_token=abc"}},
		{name: "localhost", cfg: DingTalkConfig{WebhookURL: "https://localhost/robot/send?access_token=abc"}},
		{name: "private ip", cfg: DingTalkConfig{WebhookURL: "https://10.0.0.5/robot/send?access_token=abc"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := validateDingTalkTarget(tc.cfg); err == nil {
				t.Fatalf("validateDingTalkTarget() expected error")
			}
		})
	}
}

func TestValidateDingTalkTargetAllowsOfficialHost(t *testing.T) {
	os.Unsetenv("NOTIFICATION_DINGTALK_ALLOWED_HOSTS")
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.10")}, nil
	})
	if err := validateDingTalkTarget(DingTalkConfig{WebhookURL: "https://oapi.dingtalk.com/robot/send?access_token=abc"}); err != nil {
		t.Fatalf("validateDingTalkTarget() error = %v", err)
	}
}

func TestValidateDingTalkTargetRejectsLookupFailure(t *testing.T) {
	os.Unsetenv("NOTIFICATION_DINGTALK_ALLOWED_HOSTS")
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return nil, errors.New("lookup failed")
	})
	if err := validateDingTalkTarget(DingTalkConfig{WebhookURL: "https://oapi.dingtalk.com/robot/send?access_token=abc"}); err == nil {
		t.Fatalf("validateDingTalkTarget() expected error")
	}
}

func TestValidateEmailTestTargetRejectsPlaintextSMTPByDefault(t *testing.T) {
	os.Unsetenv("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_TESTS")
	os.Unsetenv("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_SENDS")
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.20")}, nil
	})
	cfg := EmailConfig{SMTPHost: "smtp.example.com", SMTPPort: 25, UseTLS: false}
	if err := validateEmailTestTarget(cfg, "ops@example.com"); err == nil {
		t.Fatalf("validateEmailTestTarget() expected error")
	}
}

func TestValidateEmailTestTargetAllowsPlaintextSMTPWhenTestOverrideEnabled(t *testing.T) {
	t.Setenv("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_TESTS", "true")
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.20")}, nil
	})
	cfg := EmailConfig{SMTPHost: "smtp.example.com", SMTPPort: 25, UseTLS: false}
	if err := validateEmailTestTarget(cfg, "ops@example.com"); err != nil {
		t.Fatalf("validateEmailTestTarget() error = %v", err)
	}
}

func TestParseEmailConfigParsesRecipients(t *testing.T) {
	cfg, err := ParseEmailConfig(json.RawMessage(`{"smtp_host":"smtp.example.com","smtp_port":465,"from_email":"ops@example.com","use_tls":true,"recipients":["ops@example.com","oncall@example.com"]}`))
	if err != nil {
		t.Fatalf("ParseEmailConfig() error = %v", err)
	}
	if len(cfg.Recipients) != 2 {
		t.Fatalf("len(cfg.Recipients) = %d, want 2", len(cfg.Recipients))
	}
	if cfg.Recipients[0] != "ops@example.com" || cfg.Recipients[1] != "oncall@example.com" {
		t.Fatalf("cfg.Recipients = %#v", cfg.Recipients)
	}
}

func TestValidateEmailConfigRequiresRecipients(t *testing.T) {
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.20")}, nil
	})
	cfg := map[string]interface{}{
		"smtp_host":  "smtp.example.com",
		"smtp_port":  465,
		"from_email": "ops@example.com",
		"use_tls":    true,
		"recipients": []string{},
	}
	if err := validateEmailConfig(cfg); err == nil {
		t.Fatalf("validateEmailConfig() expected recipients error")
	}
}

func TestValidateEmailConfigRejectsPrivateSMTPHostByDefault(t *testing.T) {
	os.Unsetenv("NOTIFICATION_SMTP_ALLOW_PRIVATE_HOSTS")
	os.Unsetenv("NOTIFICATION_SMTP_ALLOWED_HOSTS")
	os.Unsetenv("NOTIFICATION_SMTP_ALLOWED_CIDRS")
	cfg := map[string]interface{}{
		"smtp_host":  "10.0.0.5",
		"smtp_port":  465,
		"from_email": "ops@example.com",
		"use_tls":    true,
		"recipients": []string{"ops@example.com"},
	}
	if err := validateEmailConfig(cfg); err == nil {
		t.Fatalf("validateEmailConfig() expected error")
	}
}

func TestValidateEmailConfigAllowsPrivateSMTPHostWhenCIDRAllowlisted(t *testing.T) {
	t.Setenv("NOTIFICATION_SMTP_ALLOWED_CIDRS", "10.0.0.0/8")
	cfg := map[string]interface{}{
		"smtp_host":  "10.0.0.5",
		"smtp_port":  465,
		"from_email": "ops@example.com",
		"use_tls":    true,
		"recipients": []string{"ops@example.com"},
	}
	if err := validateEmailConfig(cfg); err != nil {
		t.Fatalf("validateEmailConfig() error = %v", err)
	}
}

func TestValidateEmailConfigRejectsPlaintextSMTPDeliveryByDefault(t *testing.T) {
	os.Unsetenv("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_SENDS")
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.20")}, nil
	})
	cfg := map[string]interface{}{
		"smtp_host":  "smtp.example.com",
		"smtp_port":  25,
		"from_email": "ops@example.com",
		"use_tls":    false,
		"recipients": []string{"ops@example.com"},
	}
	if err := validateEmailConfig(cfg); err == nil {
		t.Fatalf("validateEmailConfig() expected error")
	}
}

func TestValidateEmailConfigAllowsPlaintextSMTPDeliveryWhenOverrideEnabled(t *testing.T) {
	t.Setenv("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_SENDS", "true")
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.20")}, nil
	})
	cfg := map[string]interface{}{
		"smtp_host":  "smtp.example.com",
		"smtp_port":  25,
		"from_email": "ops@example.com",
		"use_tls":    false,
		"recipients": []string{"ops@example.com"},
	}
	if err := validateEmailConfig(cfg); err != nil {
		t.Fatalf("validateEmailConfig() error = %v", err)
	}
}

func stubNotificationHostLookup(t *testing.T, fn func(context.Context, string) ([]net.IP, error)) {
	t.Helper()
	previous := lookupNotificationHostIPs
	lookupNotificationHostIPs = fn
	t.Cleanup(func() {
		lookupNotificationHostIPs = previous
	})
}
