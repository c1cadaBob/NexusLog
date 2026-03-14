package httpguard

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

var blockedOutboundURLHosts = map[string]struct{}{
	"metadata.google.internal": {},
	"metadata.aliyun.com":      {},
	"metadata.tencentyun.com":  {},
}

type BaseURLOptions struct {
	AllowPrivate  bool
	AllowLoopback bool
}

func NormalizeBaseURL(raw string, opts BaseURLOptions) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", fmt.Errorf("url is required")
	}

	parsed, err := url.Parse(raw)
	if err != nil {
		return "", fmt.Errorf("url is invalid")
	}
	if !strings.EqualFold(parsed.Scheme, "http") && !strings.EqualFold(parsed.Scheme, "https") {
		return "", fmt.Errorf("url scheme must be http or https")
	}
	if parsed.Host == "" || strings.TrimSpace(parsed.Hostname()) == "" {
		return "", fmt.Errorf("url host is required")
	}
	if parsed.User != nil {
		return "", fmt.Errorf("url must not contain credentials")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", fmt.Errorf("url must not contain query or fragment")
	}
	if err := validateBaseURLHost(parsed.Hostname(), opts); err != nil {
		return "", err
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

func validateBaseURLHost(host string, opts BaseURLOptions) error {
	host = strings.TrimSpace(host)
	if host == "" {
		return fmt.Errorf("url host is required")
	}
	lower := strings.ToLower(host)
	if !opts.AllowLoopback && (lower == "localhost" || strings.HasSuffix(lower, ".localhost")) {
		return fmt.Errorf("url host is not allowed")
	}
	if _, blocked := blockedOutboundURLHosts[lower]; blocked {
		return fmt.Errorf("url host is not allowed")
	}
	if ip := net.ParseIP(host); ip != nil {
		if isBlockedOutboundURLIP(ip, opts) {
			return fmt.Errorf("url address is not allowed")
		}
	}
	return nil
}

func isBlockedOutboundURLIP(ip net.IP, opts BaseURLOptions) bool {
	if ip == nil {
		return true
	}
	if ip.IsUnspecified() || ip.IsMulticast() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() {
		return true
	}
	if !opts.AllowLoopback && ip.IsLoopback() {
		return true
	}
	if !opts.AllowPrivate && isPrivateURLIP(ip) {
		return true
	}
	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] == 100 && ip4[1] == 100 && ip4[2] == 100 && ip4[3] == 200 {
			return true
		}
	}
	return false
}

func isPrivateURLIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip4 := ip.To4(); ip4 != nil {
		switch {
		case ip4[0] == 10:
			return true
		case ip4[0] == 172 && ip4[1] >= 16 && ip4[1] <= 31:
			return true
		case ip4[0] == 192 && ip4[1] == 168:
			return true
		default:
			return false
		}
	}
	return len(ip) == net.IPv6len && (ip[0]&0xfe) == 0xfc
}
