package notification

import "testing"

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
