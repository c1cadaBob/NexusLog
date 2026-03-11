package main

import (
	"net"
	"os"
	"path/filepath"
	"testing"
)

func TestResolveSourceIPPrefersExplicitEnv(t *testing.T) {
	t.Setenv("AGENT_SOURCE_IP", "10.10.0.8")
	t.Setenv("AGENT_SOURCE_IP_FILE", filepath.Join(t.TempDir(), "missing"))
	t.Setenv("AGENT_SOURCE_IP_ALLOW_CONTAINER_FALLBACK", "false")

	if got := resolveSourceIP(); got != "10.10.0.8" {
		t.Fatalf("resolveSourceIP()=%q, want 10.10.0.8", got)
	}
}

func TestResolveSourceIPFallsBackToFile(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, "source_ip")
	if err := os.WriteFile(path, []byte("192.168.10.25\n"), 0o644); err != nil {
		t.Fatalf("write source ip failed: %v", err)
	}

	t.Setenv("AGENT_SOURCE_IP", "")
	t.Setenv("AGENT_SOURCE_IP_FILE", path)
	t.Setenv("AGENT_SOURCE_IP_ALLOW_CONTAINER_FALLBACK", "false")

	if got := resolveSourceIP(); got != "192.168.10.25" {
		t.Fatalf("resolveSourceIP()=%q, want 192.168.10.25", got)
	}
}

func TestRankCandidateIPsPrefersNonVirtualIPv4(t *testing.T) {
	ranked := rankCandidateIPs([]ipCandidate{
		{InterfaceName: "docker0", IP: net.ParseIP("172.17.0.1")},
		{InterfaceName: "ens33", IP: net.ParseIP("10.0.0.9")},
		{InterfaceName: "ens33", IP: net.ParseIP("fe80::1")},
	})

	if len(ranked) < 2 {
		t.Fatalf("expected ranked candidates, got %d", len(ranked))
	}
	if got := ranked[0].String(); got != "10.0.0.9" {
		t.Fatalf("ranked[0]=%q, want 10.0.0.9", got)
	}
}

func TestRankCandidateIPsFallsBackToVirtualIPv4ThenIPv6(t *testing.T) {
	virtualOnly := rankCandidateIPs([]ipCandidate{
		{InterfaceName: "docker0", IP: net.ParseIP("172.17.0.1")},
		{InterfaceName: "virbr0", IP: net.ParseIP("192.168.122.1")},
	})
	if len(virtualOnly) == 0 || virtualOnly[0].String() != "172.17.0.1" {
		t.Fatalf("virtual fallback=%v, want first virtual IPv4", virtualOnly)
	}

	ipv6Only := rankCandidateIPs([]ipCandidate{{InterfaceName: "ens160", IP: net.ParseIP("2001:db8::8")}})
	if len(ipv6Only) == 0 || ipv6Only[0].String() != "2001:db8::8" {
		t.Fatalf("ipv6 fallback=%v, want 2001:db8::8", ipv6Only)
	}
}
