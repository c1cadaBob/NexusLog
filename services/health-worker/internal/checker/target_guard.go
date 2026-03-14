package checker

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

var blockedHealthTargetHosts = map[string]struct{}{
	"metadata.google.internal": {},
	"metadata.aliyun.com":      {},
	"metadata.tencentyun.com":  {},
}

func normalizeCheckTarget(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("target is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("target is invalid")
	}
	if !strings.EqualFold(parsed.Scheme, "http") && !strings.EqualFold(parsed.Scheme, "https") {
		return "", fmt.Errorf("target scheme must be http or https")
	}
	if parsed.Host == "" || strings.TrimSpace(parsed.Hostname()) == "" {
		return "", fmt.Errorf("target host is required")
	}
	if parsed.User != nil {
		return "", fmt.Errorf("target must not contain credentials")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("target must not contain query or fragment")
	}
	if err := validateCheckTargetHost(parsed.Hostname()); err != nil {
		return "", err
	}
	return parsed.String(), nil
}

func validateCheckTargetHost(host string) error {
	host = strings.TrimSpace(host)
	if host == "" {
		return fmt.Errorf("target host is required")
	}
	lower := strings.ToLower(host)
	if _, blocked := blockedHealthTargetHosts[lower]; blocked {
		return fmt.Errorf("target host is not allowed")
	}
	if ip := net.ParseIP(host); ip != nil && isBlockedCheckTargetIP(ip) {
		return fmt.Errorf("target address is not allowed")
	}
	return nil
}

func isBlockedCheckTargetIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsUnspecified() || ip.IsMulticast() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}
	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] == 100 && ip4[1] == 100 && ip4[2] == 100 && ip4[3] == 200 {
			return true
		}
	}
	return false
}
