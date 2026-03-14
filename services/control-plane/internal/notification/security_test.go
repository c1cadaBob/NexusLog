package notification

import (
	"encoding/json"
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
	if err := validateDingTalkTarget(DingTalkConfig{WebhookURL: "https://oapi.dingtalk.com/robot/send?access_token=abc"}); err != nil {
		t.Fatalf("validateDingTalkTarget() error = %v", err)
	}
}

func TestValidateEmailTestTargetRejectsPlaintextSMTPByDefault(t *testing.T) {
	os.Unsetenv("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_TESTS")
	cfg := EmailConfig{SMTPHost: "smtp.example.com", SMTPPort: 25, UseTLS: false}
	if err := validateEmailTestTarget(cfg, "ops@example.com"); err == nil {
		t.Fatalf("validateEmailTestTarget() expected error")
	}
}
