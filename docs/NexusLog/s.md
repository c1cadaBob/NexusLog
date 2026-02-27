太好了，给你一份**可直接落地**、与前面脚本完全匹配的 `GitHub Actions` 最终版（热更新优先、可手工回滚、带审批位、可选通知）。

> 文件：`.github/workflows/monitoring-release.yml`

```yaml
name: monitoring-release

on:
  workflow_dispatch:
    inputs:
      action:
        description: "deploy 或 rollback"
        required: true
        type: choice
        options: [deploy, rollback]
        default: deploy
      version:
        description: "版本号（deploy 可留空自动生成；rollback 必填）"
        required: false
        type: string
      allow_restart_fallback:
        description: "是否允许重启兜底（默认 false，推荐保持 false）"
        required: true
        type: boolean
        default: false
  push:
    tags:
      - "monitoring-v*"

permissions:
  contents: read

concurrency:
  group: monitoring-prod-release
  cancel-in-progress: false

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    environment: production  # 在 GitHub 环境里配置 required reviewers 即可开启审批

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install base tools
        run: |
          sudo apt-get update
          sudo apt-get install -y rsync openssh-client curl

      - name: Resolve meta
        id: meta
        shell: bash
        run: |
          set -euo pipefail

          ACTION="${{ github.event_name == 'workflow_dispatch' && github.event.inputs.action || 'deploy' }}"
          VERSION_INPUT="${{ github.event_name == 'workflow_dispatch' && github.event.inputs.version || '' }}"
          ALLOW_RESTART="${{ github.event_name == 'workflow_dispatch' && github.event.inputs.allow_restart_fallback || 'false' }}"

          if [[ "$ACTION" == "rollback" && -z "$VERSION_INPUT" ]]; then
            echo "rollback 模式必须提供 version" >&2
            exit 1
          fi

          if [[ -n "$VERSION_INPUT" ]]; then
            VERSION="$VERSION_INPUT"
          elif [[ "${GITHUB_REF_TYPE:-}" == "tag" ]]; then
            VERSION="${GITHUB_REF_NAME#monitoring-v}"
          else
            VERSION="$(date +%Y%m%d%H%M%S)"
          fi

          # 简单白名单，避免命令注入
          if [[ ! "$VERSION" =~ ^[0-9A-Za-z._-]+$ ]]; then
            echo "非法版本号: $VERSION" >&2
            exit 1
          fi

          if [[ "$ALLOW_RESTART" == "true" ]]; then
            ALLOW_RESTART_NUM=1
          else
            ALLOW_RESTART_NUM=0
          fi

          echo "action=$ACTION" >> "$GITHUB_OUTPUT"
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "allow_restart_num=$ALLOW_RESTART_NUM" >> "$GITHUB_OUTPUT"

          echo "ACTION=$ACTION"
          echo "VERSION=$VERSION"
          echo "ALLOW_RESTART_FALLBACK=$ALLOW_RESTART_NUM"

      - name: Validate Prometheus/Alertmanager config (offline)
        shell: bash
        run: |
          set -euo pipefail

          test -f monitoring/prometheus/prometheus.yml
          test -f monitoring/alertmanager/alertmanager.yml

          # promtool check config
          docker run --rm \
            -v "$PWD/monitoring/prometheus:/etc/prometheus" \
            prom/prometheus:v2.52.0 \
            promtool check config /etc/prometheus/prometheus.yml

          # promtool check rules
          shopt -s nullglob globstar
          RULE_FILES=(monitoring/prometheus/rules/**/*.yml monitoring/prometheus/rules/**/*.yaml)
          if (( ${#RULE_FILES[@]} > 0 )); then
            for f in "${RULE_FILES[@]}"; do
              docker run --rm \
                -v "$PWD:/work" -w /work \
                prom/prometheus:v2.52.0 \
                promtool check rules "$f"
            done
          else
            echo "WARN: no rule files found under monitoring/prometheus/rules"
          fi

          # amtool check config
          docker run --rm \
            -v "$PWD/monitoring/alertmanager:/etc/alertmanager" \
            prom/alertmanager:v0.27.0 \
            amtool check-config /etc/alertmanager/alertmanager.yml

      - name: Setup SSH
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh

          echo "${{ secrets.DEPLOY_SSH_PRIVATE_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519

          # 强烈建议在 secret 中固定主机指纹，避免 MITM
          echo "${{ secrets.DEPLOY_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          chmod 644 ~/.ssh/known_hosts

      - name: Sync monitoring files to server (deploy only)
        if: steps.meta.outputs.action == 'deploy'
        shell: bash
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_PORT: ${{ secrets.DEPLOY_PORT }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          DEPLOY_PATH: ${{ secrets.DEPLOY_PATH }} # 例如 /opt/monitoring-release
        run: |
          set -euo pipefail

          rsync -az --delete \
            -e "ssh -i ~/.ssh/id_ed25519 -p ${DEPLOY_PORT} -o StrictHostKeyChecking=yes" \
            ./monitoring \
            "${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PATH}/"

      - name: Execute remote deploy/rollback
        shell: bash
        env:
          DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
          DEPLOY_PORT: ${{ secrets.DEPLOY_PORT }}
          DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
          ACTION: ${{ steps.meta.outputs.action }}
          VERSION: ${{ steps.meta.outputs.version }}
          ALLOW_RESTART_NUM: ${{ steps.meta.outputs.allow_restart_num }}
        run: |
          set -euo pipefail

          SSH_CMD="ssh -i ~/.ssh/id_ed25519 -p ${DEPLOY_PORT} -o StrictHostKeyChecking=yes ${DEPLOY_USER}@${DEPLOY_HOST}"

          if [[ "$ACTION" == "deploy" ]]; then
            $SSH_CMD "sudo ALLOW_RESTART_FALLBACK=${ALLOW_RESTART_NUM} /usr/local/sbin/deploy-monitoring.sh deploy ${VERSION}"
          else
            $SSH_CMD "sudo ALLOW_RESTART_FALLBACK=${ALLOW_RESTART_NUM} /usr/local/sbin/deploy-monitoring.sh rollback ${VERSION}"
          fi

          echo "Current version on server:"
          $SSH_CMD "sudo /usr/local/sbin/deploy-monitoring.sh current"

      - name: Slack notify (optional)
        if: always() && secrets.SLACK_WEBHOOK_URL != ''
        shell: bash
        env:
          WEBHOOK: ${{ secrets.SLACK_WEBHOOK_URL }}
          ACTION: ${{ steps.meta.outputs.action }}
          VERSION: ${{ steps.meta.outputs.version }}
          STATUS: ${{ job.status }}
        run: |
          set -euo pipefail
          MSG="monitoring ${ACTION} ${VERSION} => ${STATUS} (actor: ${{ github.actor }}, run: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})"
          curl -sS -X POST "$WEBHOOK" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"${MSG}\"}"

      - name: Feishu notify (optional)
        if: always() && secrets.FEISHU_WEBHOOK_URL != ''
        shell: bash
        env:
          WEBHOOK: ${{ secrets.FEISHU_WEBHOOK_URL }}
          ACTION: ${{ steps.meta.outputs.action }}
          VERSION: ${{ steps.meta.outputs.version }}
          STATUS: ${{ job.status }}
        run: |
          set -euo pipefail
          MSG="monitoring ${ACTION} ${VERSION} => ${STATUS}\nactor: ${{ github.actor }}\nrun: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
          curl -sS -X POST "$WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"${MSG}\"}}"
```

---

### 你需要准备的 Secrets

- `DEPLOY_HOST`
- `DEPLOY_PORT`
- `DEPLOY_USER`（deploy）
- `DEPLOY_PATH`（如 `/opt/monitoring-release`）
- `DEPLOY_SSH_PRIVATE_KEY`
- `DEPLOY_KNOWN_HOSTS`（`ssh-keyscan -p <port> <host>` 结果，建议人工核验后存）
- （可选）`SLACK_WEBHOOK_URL`
- （可选）`FEISHU_WEBHOOK_URL`

---

如果你愿意，我下一步可以再给你一份**“最小可用回滚 Runbook（值班手册版）”**，让非开发同学也能安全执行回滚。