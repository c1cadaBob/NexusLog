package main

import "testing"

// TestParsePathLabelRules 验证环境变量 JSON 可正确映射为路径标签规则。
func TestParsePathLabelRules(t *testing.T) {
	raw := `[{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx","env":"prod"}},{"pattern":"*.log","labels":{"offset":"999","team":"obs"}}]`

	rules, err := parsePathLabelRules(raw)
	if err != nil {
		t.Fatalf("parsePathLabelRules returned error: %v", err)
	}
	if len(rules) != 2 {
		t.Fatalf("expected 2 rules, got %d", len(rules))
	}

	if rules[0].Pattern != "/var/log/nginx/*.log" {
		t.Fatalf("unexpected first pattern: %s", rules[0].Pattern)
	}
	if rules[0].Labels["service"] != "nginx" || rules[0].Labels["env"] != "prod" {
		t.Fatalf("unexpected first labels: %#v", rules[0].Labels)
	}

	if _, exists := rules[1].Labels["offset"]; exists {
		t.Fatalf("expected offset key to be filtered out, got %#v", rules[1].Labels)
	}
	if rules[1].Labels["team"] != "obs" {
		t.Fatalf("unexpected second labels: %#v", rules[1].Labels)
	}
}

// TestParsePathLabelRulesInvalidJSON 验证非法 JSON 会返回错误，避免静默误配置。
func TestParsePathLabelRulesInvalidJSON(t *testing.T) {
	_, err := parsePathLabelRules("{not-json}")
	if err == nil {
		t.Fatalf("expected parsePathLabelRules to fail on invalid json")
	}
}
