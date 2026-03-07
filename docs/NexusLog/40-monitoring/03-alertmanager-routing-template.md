好，我们直接把**告警闭环**补齐。下面给你一份可落地的 **Alertmanager 路由模板**（按 `severity` 分流到 Slack / 企业微信 / 钉钉）。

---

## 1) `alertmanager.yml`（核心模板）

> 你只需要替换 webhook/token/频道名即可。

```yaml
global:
  resolve_timeout: 5m

templates:
  - /etc/alertmanager/templates/*.tmpl

route:
  receiver: "null"
  group_by: ["alertname", "service", "severity"]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

  routes:
    # audit-export critical -> 立即打到高优先级渠道
    - matchers:
        - service="audit-export"
        - severity="critical"
      receiver: "audit-export-critical"
      continue: false

    # audit-export warning -> 普通告警渠道
    - matchers:
        - service="audit-export"
        - severity="warning"
      receiver: "audit-export-warning"
      continue: false

    # 其他服务的 critical（可选）
    - matchers:
        - severity="critical"
      receiver: "platform-critical"
      continue: false

receivers:
  - name: "null"

  - name: "audit-export-critical"
    # 1) Slack（原生支持）
    slack_configs:
      - api_url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
        channel: "#oncall-critical"
        username: "alertmanager"
        title: '[{{ .Status | toUpper }}][{{ .CommonLabels.severity }}] {{ .CommonLabels.alertname }}'
        text: '{{ template "alert.text" . }}'
        send_resolved: true

    # 2) 企业微信（建议走内部 webhook relay）
    webhook_configs:
      - url: "http://alert-relay:18080/wecom/critical"
        send_resolved: true

      # 3) 钉钉（建议走内部 webhook relay）
      - url: "http://alert-relay:18080/dingtalk/critical"
        send_resolved: true

  - name: "audit-export-warning"
    slack_configs:
      - api_url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
        channel: "#audit-export-warning"
        username: "alertmanager"
        title: '[{{ .Status | toUpper }}][{{ .CommonLabels.severity }}] {{ .CommonLabels.alertname }}'
        text: '{{ template "alert.text" . }}'
        send_resolved: true

    webhook_configs:
      - url: "http://alert-relay:18080/wecom/warning"
        send_resolved: true
      - url: "http://alert-relay:18080/dingtalk/warning"
        send_resolved: true

  - name: "platform-critical"
    slack_configs:
      - api_url: "https://hooks.slack.com/services/XXX/YYY/ZZZ"
        channel: "#platform-critical"
        username: "alertmanager"
        title: '[{{ .Status | toUpper }}][{{ .CommonLabels.severity }}] {{ .CommonLabels.alertname }}'
        text: '{{ template "alert.text" . }}'
        send_resolved: true

# 抑制规则：critical 到来时，同类 warning 不再刷屏
inhibit_rules:
  - source_matchers:
      - severity="critical"
    target_matchers:
      - severity="warning"
    equal: ["alertname", "service", "instance"]
```

---

## 2) 消息模板 `templates/alert.tmpl`

```tmpl
{{ define "alert.text" -}}
*Service:* {{ .CommonLabels.service }}
*Alert:* {{ .CommonLabels.alertname }}
*Severity:* {{ .CommonLabels.severity }}
*Status:* {{ .Status }}

{{- if .CommonAnnotations.summary }}
*Summary:* {{ .CommonAnnotations.summary }}
{{- end }}

{{- if .CommonAnnotations.description }}
*Description:* {{ .CommonAnnotations.description }}
{{- end }}

*Labels:*
{{- range $k, $v := .CommonLabels }}
- {{ $k }} = {{ $v }}
{{- end }}

{{- if .ExternalURL }}
*Alertmanager:* {{ .ExternalURL }}
{{- end }}
{{- end }}
```

---

## 3) 为什么企业微信/钉钉建议走 `alert-relay`
Alertmanager 的 `webhook_configs` 发的是标准告警 JSON，不是钉钉/企微机器人要求的专有格式。
所以推荐你放一个轻量 `alert-relay` 做格式转换（也便于加签名、限流、去重）。

---

## 4) 生效与验证

```bash
# 1) 检查配置
amtool check-config /etc/alertmanager/alertmanager.yml

# 2) 热加载
curl -X POST http://127.0.0.1:9093/-/reload
```

触发测试告警（Prometheus）：

```bash
curl -X POST http://127.0.0.1:9090/-/reload
```

或临时通过 API 推一条测试 alert（如你需要我可以给你完整 curl）。

---

如果你愿意，下一步我可以直接给你一份 **Node.js `alert-relay` 最小实现**（一个文件，支持 Slack/企微/钉钉三路分发 + 签名 + 限流），你部署后就能全链路打通。