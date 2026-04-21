package ingest

import (
	"strings"
	"testing"
)

func TestGenerateDeploymentScriptLinuxSystemdBuildsHostedInstallCommand(t *testing.T) {
	handler := &AgentInventoryHandler{
		defaultAgentKeyID: "active",
		defaultAgentKey:   "0123456789abcdefghijklmn",
	}

	response, err := handler.generateDeploymentScript(GenerateDeploymentScriptRequest{
		TargetKind:          "linux-systemd",
		SourceName:          "nginx-prod",
		ControlPlaneBaseURL: "https://control.example.com",
		ReleaseBaseURL:      "https://github.com/acme/NexusLog/releases/download/v1.2.3",
		Version:             "v1.2.3",
		IncludePaths:        []string{"/var/log/nginx/access.log"},
	})
	if err != nil {
		t.Fatalf("generateDeploymentScript returned error: %v", err)
	}

	if !strings.Contains(response.Command, "collector-agent-installer.sh") {
		t.Fatalf("expected hosted installer command, got: %s", response.Command)
	}
	if !strings.Contains(response.Command, "collector-agent-linux-amd64.tar.gz") {
		t.Fatalf("expected asset url in command, got: %s", response.Command)
	}
	if !strings.Contains(response.Script, "CONFIG_PATH=${INSTALL_ROOT}/configs/agent.yaml") {
		t.Fatalf("expected script to configure CONFIG_PATH, got: %s", response.Script)
	}
	if !strings.Contains(response.Script, "sudo cp -R \"${CONFIG_DIR}\" \"${INSTALL_ROOT}/\"") {
		t.Fatalf("expected script to install packaged configs, got: %s", response.Script)
	}
}

func TestGenerateDeploymentScriptLinuxSystemdRespectsCustomInstallScriptURL(t *testing.T) {
	handler := &AgentInventoryHandler{
		defaultAgentKeyID: "active",
		defaultAgentKey:   "0123456789abcdefghijklmn",
	}

	response, err := handler.generateDeploymentScript(GenerateDeploymentScriptRequest{
		TargetKind:       "linux-systemd",
		SourceName:       "mysql-prod",
		InstallScriptURL: "https://downloads.example.com/collector-agent/install.sh",
		ReleaseBaseURL:   "https://downloads.example.com/collector-agent/v2.0.0",
		Version:          "v2.0.0",
	})
	if err != nil {
		t.Fatalf("generateDeploymentScript returned error: %v", err)
	}

	if !strings.Contains(response.Command, "https://downloads.example.com/collector-agent/install.sh") {
		t.Fatalf("expected custom installer url in command, got: %s", response.Command)
	}
}

func TestGenerateDeploymentScriptLinuxDockerUsesCollectorAgentImageName(t *testing.T) {
	handler := &AgentInventoryHandler{
		defaultAgentKeyID: "active",
		defaultAgentKey:   "0123456789abcdefghijklmn",
	}

	response, err := handler.generateDeploymentScript(GenerateDeploymentScriptRequest{
		TargetKind: "linux-docker",
		SourceName: "docker-prod",
		Version:    "v3.0.0",
	})
	if err != nil {
		t.Fatalf("generateDeploymentScript returned error: %v", err)
	}

	if !strings.Contains(response.Script, "ghcr.io/<owner>/nexuslog-collector-agent:v3.0.0") {
		t.Fatalf("expected updated default collector-agent image, got: %s", response.Script)
	}
}
