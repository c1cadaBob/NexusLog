package notification

import (
	"context"
	"net"
	"net/smtp"
	"testing"
)

func TestSMTPSenderSendRejectsUnsafeSMTPHost(t *testing.T) {
	sender := NewSMTPSender()
	cfg := EmailConfig{
		SMTPHost:  "127.0.0.1",
		SMTPPort:  25,
		FromEmail: "ops@example.com",
	}
	if err := sender.Send(cfg, "subject", "body", "ops@example.com"); err == nil {
		t.Fatalf("Send() expected error")
	}
}

func TestSMTPSenderSendRejectsPlaintextSMTPByDefault(t *testing.T) {
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.20")}, nil
	})
	sender := NewSMTPSender()
	cfg := EmailConfig{
		SMTPHost:  "smtp.example.com",
		SMTPPort:  25,
		FromEmail: "ops@example.com",
		UseTLS:    false,
	}
	if err := sender.Send(cfg, "subject", "body", "ops@example.com"); err == nil {
		t.Fatalf("Send() expected error")
	}
}

func TestSMTPSenderSendTestEmailAllowsPlaintextWhenTestOverrideEnabled(t *testing.T) {
	t.Setenv("NOTIFICATION_ALLOW_PLAINTEXT_SMTP_TESTS", "true")
	stubNotificationHostLookup(t, func(ctx context.Context, host string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("203.0.113.20")}, nil
	})
	previousSendMail := smtpSendMail
	smtpSendMail = func(addr string, auth smtp.Auth, from string, to []string, msg []byte) error {
		return context.DeadlineExceeded
	}
	defer func() {
		smtpSendMail = previousSendMail
	}()
	sender := NewSMTPSender()
	cfg := EmailConfig{
		SMTPHost:  "smtp.example.com",
		SMTPPort:  25,
		FromEmail: "ops@example.com",
		UseTLS:    false,
	}
	if err := sender.SendTestEmail(cfg, "ops@example.com"); err == nil {
		t.Fatalf("SendTestEmail() expected stubbed send error")
	} else if err.Error() == "plaintext SMTP send is disabled" {
		t.Fatalf("expected plaintext gate to allow test send, got %v", err)
	}
}
