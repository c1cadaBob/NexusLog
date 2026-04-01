package notification

import (
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/smtp"
	"strconv"
	"strings"
)

// EmailConfig holds SMTP configuration for sending emails.
type EmailConfig struct {
	SMTPHost     string   `json:"smtp_host"`
	SMTPPort     int      `json:"smtp_port"`
	SMTPUsername string   `json:"smtp_username"`
	SMTPPassword string   `json:"smtp_password"`
	FromEmail    string   `json:"from_email"`
	FromName     string   `json:"from_name"`
	UseTLS       bool     `json:"use_tls"`
	Recipients   []string `json:"recipients,omitempty"`
}

// ParseEmailConfig parses JSON config into EmailConfig.
func ParseEmailConfig(config json.RawMessage) (EmailConfig, error) {
	var m map[string]interface{}
	if err := json.Unmarshal(config, &m); err != nil {
		return EmailConfig{}, fmt.Errorf("invalid config json: %w", err)
	}

	cfg := EmailConfig{}
	if v, ok := m["smtp_host"].(string); ok {
		cfg.SMTPHost = strings.TrimSpace(v)
	}
	if v, ok := m["smtp_port"].(float64); ok {
		cfg.SMTPPort = int(v)
	} else if v, ok := m["smtp_port"].(string); ok {
		if p, err := strconv.Atoi(strings.TrimSpace(v)); err == nil {
			cfg.SMTPPort = p
		}
	}
	if v, ok := m["smtp_username"].(string); ok {
		cfg.SMTPUsername = strings.TrimSpace(v)
	}
	if v, ok := m["smtp_password"].(string); ok {
		cfg.SMTPPassword = v
	}
	if v, ok := m["from_email"].(string); ok {
		cfg.FromEmail = strings.TrimSpace(v)
	}
	if v, ok := m["from_name"].(string); ok {
		cfg.FromName = strings.TrimSpace(v)
	}
	if v, ok := m["use_tls"].(bool); ok {
		cfg.UseTLS = v
	}
	cfg.Recipients = normalizeEmailRecipients(m["recipients"])
	return cfg, nil
}

func normalizeEmailRecipients(raw any) []string {
	parts := make([]string, 0)
	switch value := raw.(type) {
	case []string:
		parts = append(parts, value...)
	case []interface{}:
		for _, item := range value {
			if text, ok := item.(string); ok {
				parts = append(parts, text)
			}
		}
	case string:
		parts = strings.FieldsFunc(value, func(r rune) bool {
			return r == ',' || r == ';' || r == '\n' || r == '\r'
		})
	}

	seen := make(map[string]struct{}, len(parts))
	recipients := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if _, exists := seen[key]; exists {
			continue
		}
		seen[key] = struct{}{}
		recipients = append(recipients, trimmed)
	}
	return recipients
}

func (c EmailConfig) primaryRecipient() string {
	for _, recipient := range c.Recipients {
		if trimmed := strings.TrimSpace(recipient); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

var (
	smtpSendMail = smtp.SendMail
	tlsDial      = func(network, addr string, config *tls.Config) (net.Conn, error) {
		return tls.Dial(network, addr, config)
	}
)

// SMTPSender sends emails via SMTP.
type SMTPSender struct{}

// NewSMTPSender creates a new SMTP sender.
func NewSMTPSender() *SMTPSender {
	return &SMTPSender{}
}

// SendTestEmail sends a test email to the given address.
func (s *SMTPSender) SendTestEmail(config EmailConfig, to string) error {
	return s.send(config, "NexusLog Notification Channel Test", "This is a test email from NexusLog notification channel.", to, allowPlaintextSMTPTests())
}

// Send sends an email with the given subject and body.
func (s *SMTPSender) Send(config EmailConfig, subject, body, to string) error {
	return s.send(config, subject, body, to, allowPlaintextSMTPDelivery())
}

func (s *SMTPSender) send(config EmailConfig, subject, body, to string, allowPlaintext bool) error {
	to = strings.TrimSpace(to)
	if to == "" {
		return fmt.Errorf("recipient email is required")
	}
	if config.SMTPHost == "" {
		return fmt.Errorf("smtp_host is required")
	}
	if config.SMTPPort <= 0 || config.SMTPPort > 65535 {
		return fmt.Errorf("smtp_port must be between 1 and 65535")
	}
	if err := validateSMTPHost(config.SMTPHost); err != nil {
		return fmt.Errorf("smtp target is not allowed")
	}
	if !config.UseTLS && !allowPlaintext {
		return fmt.Errorf("plaintext SMTP send is disabled")
	}

	from := config.FromEmail
	if from == "" {
		from = config.SMTPUsername
	}
	if from == "" {
		from = "noreply@nexuslog.local"
	}

	addr := fmt.Sprintf("%s:%d", config.SMTPHost, config.SMTPPort)

	msg := fmt.Sprintf("From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		config.FromName, from, to, subject, body)
	if config.FromName == "" {
		msg = fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
			from, to, subject, body)
	}

	if config.UseTLS {
		return s.sendTLS(config, addr, from, to, msg)
	}
	return s.sendPlain(config, addr, from, to, msg)
}

func (s *SMTPSender) sendPlain(config EmailConfig, addr, from, to, msg string) error {
	var auth smtp.Auth
	if config.SMTPUsername != "" || config.SMTPPassword != "" {
		auth = smtp.PlainAuth("", config.SMTPUsername, config.SMTPPassword, config.SMTPHost)
	}
	return smtpSendMail(addr, auth, from, []string{to}, []byte(msg))
}

func (s *SMTPSender) sendTLS(config EmailConfig, addr, from, to, msg string) error {
	tlsConfig := &tls.Config{
		ServerName: config.SMTPHost,
		MinVersion: tls.VersionTLS12,
	}
	conn, err := tlsDial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("tls dial: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, config.SMTPHost)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if config.SMTPUsername != "" || config.SMTPPassword != "" {
		auth := smtp.PlainAuth("", config.SMTPUsername, config.SMTPPassword, config.SMTPHost)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail: %w", err)
	}
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := w.Write([]byte(msg)); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("smtp close: %w", err)
	}
	return client.Quit()
}
