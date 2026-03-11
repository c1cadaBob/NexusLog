package main

import (
	"net"
	"sort"
	"strings"
)

type ipCandidate struct {
	InterfaceName string
	IP            net.IP
}

func resolveSourceIP() string {
	for _, candidate := range []string{
		strings.TrimSpace(getEnv("AGENT_SOURCE_IP", "")),
		readTrimmedFirstLine(getEnv("AGENT_SOURCE_IP_FILE", "/host/etc/nexuslog-host-meta/source_ip")),
	} {
		if normalized := normalizeIPLiteral(candidate); normalized != "" {
			return normalized
		}
	}

	if !isTruthy(getEnv("AGENT_SOURCE_IP_ALLOW_CONTAINER_FALLBACK", "false")) {
		return ""
	}

	switch strings.ToLower(strings.TrimSpace(getEnv("AGENT_SOURCE_IP_DISCOVERY", "primary_ipv4"))) {
	case "", "primary_ipv4":
		return detectPrimaryIP()
	default:
		return detectPrimaryIP()
	}
}

func detectPrimaryIP() string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return ""
	}

	candidates := make([]ipCandidate, 0)
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ip := extractIPFromAddr(addr)
			if ip == nil {
				continue
			}
			ip = normalizeIP(ip)
			if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			candidates = append(candidates, ipCandidate{InterfaceName: iface.Name, IP: ip})
		}
	}

	ranked := rankCandidateIPs(candidates)
	if len(ranked) == 0 {
		return ""
	}
	return ranked[0].String()
}

func rankCandidateIPs(candidates []ipCandidate) []net.IP {
	type scoredCandidate struct {
		index int
		score int
		ip    net.IP
	}

	scored := make([]scoredCandidate, 0, len(candidates))
	for index, candidate := range candidates {
		ip := normalizeIP(candidate.IP)
		if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() {
			continue
		}
		scored = append(scored, scoredCandidate{
			index: index,
			score: scoreIPCandidate(candidate),
			ip:    ip,
		})
	}

	sort.SliceStable(scored, func(i, j int) bool {
		if scored[i].score != scored[j].score {
			return scored[i].score < scored[j].score
		}
		return scored[i].index < scored[j].index
	})

	ranked := make([]net.IP, 0, len(scored))
	for _, candidate := range scored {
		ranked = append(ranked, candidate.ip)
	}
	return ranked
}

func scoreIPCandidate(candidate ipCandidate) int {
	ip := normalizeIP(candidate.IP)
	if ip == nil {
		return 99
	}
	if ip.To4() != nil {
		if isExcludedInterfaceName(candidate.InterfaceName) {
			return 1
		}
		return 0
	}
	return 2
}

func isExcludedInterfaceName(name string) bool {
	trimmed := strings.ToLower(strings.TrimSpace(name))
	switch {
	case trimmed == "":
		return false
	case trimmed == "docker0":
		return true
	case strings.HasPrefix(trimmed, "br-"):
		return true
	case strings.HasPrefix(trimmed, "veth"):
		return true
	case strings.HasPrefix(trimmed, "cni"):
		return true
	case strings.HasPrefix(trimmed, "flannel"):
		return true
	case strings.HasPrefix(trimmed, "virbr"):
		return true
	default:
		return false
	}
}

func extractIPFromAddr(addr net.Addr) net.IP {
	switch value := addr.(type) {
	case *net.IPNet:
		return value.IP
	case *net.IPAddr:
		return value.IP
	default:
		literal := addr.String()
		if host, _, err := net.SplitHostPort(literal); err == nil {
			literal = host
		}
		if ip := normalizeIPLiteral(literal); ip != "" {
			return net.ParseIP(ip)
		}
		return nil
	}
}

func normalizeIPLiteral(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if ip := net.ParseIP(trimmed); ip != nil {
		if normalized := normalizeIP(ip); normalized != nil {
			return normalized.String()
		}
	}
	if ip, _, err := net.ParseCIDR(trimmed); err == nil {
		if normalized := normalizeIP(ip); normalized != nil {
			return normalized.String()
		}
	}
	return ""
}

func normalizeIP(ip net.IP) net.IP {
	if ip == nil {
		return nil
	}
	if ipv4 := ip.To4(); ipv4 != nil {
		return ipv4
	}
	return ip.To16()
}
