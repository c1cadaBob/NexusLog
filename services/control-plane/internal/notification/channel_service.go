package notification

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

var allowedChannelTypes = map[string]struct{}{
	"email":    {},
	"dingtalk": {},
	"sms":      {},
}

// ValidateChannelType checks that type is one of email/dingtalk/sms.
func ValidateChannelType(chType string) error {
	chType = strings.ToLower(strings.TrimSpace(chType))
	if _, ok := allowedChannelTypes[chType]; !ok {
		return fmt.Errorf("type must be one of email, dingtalk, sms")
	}
	return nil
}

// ValidateConfig validates config based on channel type.
func ValidateConfig(chType string, config json.RawMessage) error {
	chType = strings.ToLower(strings.TrimSpace(chType))
	if config == nil || len(config) == 0 {
		config = json.RawMessage("{}")
	}

	var m map[string]interface{}
	if err := json.Unmarshal(config, &m); err != nil {
		return fmt.Errorf("config must be valid JSON: %w", err)
	}

	switch chType {
	case "email":
		return validateEmailConfig(m)
	case "dingtalk":
		return validateDingTalkConfig(m)
	case "sms":
		return validateSMSConfig(m)
	default:
		return fmt.Errorf("unsupported channel type: %s", chType)
	}
}

func validateEmailConfig(m map[string]interface{}) error {
	host, _ := m["smtp_host"].(string)
	if strings.TrimSpace(host) == "" {
		return fmt.Errorf("email config requires smtp_host")
	}
	port, ok := m["smtp_port"]
	if !ok {
		return fmt.Errorf("email config requires smtp_port")
	}
	var portNum int
	switch v := port.(type) {
	case float64:
		portNum = int(v)
	case int:
		portNum = v
	case string:
		var err error
		portNum, err = parseInt(v)
		if err != nil {
			return fmt.Errorf("smtp_port must be a number: %w", err)
		}
	default:
		return fmt.Errorf("email config requires smtp_port")
	}
	if portNum <= 0 || portNum > 65535 {
		return fmt.Errorf("smtp_port must be between 1 and 65535")
	}
	from, _ := m["from_email"].(string)
	if strings.TrimSpace(from) == "" {
		username, _ := m["smtp_username"].(string)
		if strings.TrimSpace(username) == "" {
			return fmt.Errorf("email config requires from_email or smtp_username")
		}
	}
	return nil
}

func validateDingTalkConfig(m map[string]interface{}) error {
	webhook, _ := m["webhook_url"].(string)
	accessToken, _ := m["access_token"].(string)
	if strings.TrimSpace(webhook) == "" && strings.TrimSpace(accessToken) == "" {
		return fmt.Errorf("dingtalk config requires webhook_url or access_token")
	}
	cfg, err := ParseDingTalkConfig(mustMarshalConfigMap(m))
	if err != nil {
		return fmt.Errorf("invalid dingtalk config")
	}
	if err := validateDingTalkTarget(cfg); err != nil {
		return err
	}
	return nil
}

func mustMarshalConfigMap(m map[string]interface{}) json.RawMessage {
	raw, err := json.Marshal(m)
	if err != nil {
		return json.RawMessage("{}")
	}
	return raw
}

func validateSMSConfig(m map[string]interface{}) error {
	// SMS typically needs provider-specific config (e.g. access_key, secret, sign_name, template_code)
	provider, _ := m["provider"].(string)
	if strings.TrimSpace(provider) == "" {
		return fmt.Errorf("sms config requires provider")
	}
	return nil
}

func parseInt(s string) (int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, fmt.Errorf("empty string")
	}
	return strconv.Atoi(s)
}
