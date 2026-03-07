很好，我们上 **生产增强版**。
这一步的价值很直接：**把“部署焦虑”变成“可控流程”**——失败能自动回滚，结果能自动通知，发布前有人工审批。

---

## 1) 先给脚本加“本地自动回滚”能力（双保险）

在 `scripts/deploy-monitoring-v2.sh` 增加这段（核心变量 + trap）：

```bash
DEPLOY_IN_PROGRESS=0
PREV_VERSION=""

on_err() {
  local code=$?
  if [[ "$DEPLOY_IN_PROGRESS" -eq 1 && -n "$PREV_VERSION" ]]; then
    log "deploy failed, auto rollback to previous version: $PREV_VERSION"
    DEPLOY_IN_PROGRESS=0
    set +e
    apply_release "$RELEASES_DIR/$PREV_VERSION" "$PREV_VERSION"
    set -e
  fi
  exit "$code"
}
trap on_err ERR
```

然后改 `cmd_deploy()`：

```bash
cmd_deploy() {
  local version
  version="$(gen_version)"
  mkdir -p "$RELEASES_DIR"

  PREV_VERSION="$(cmd_current || true)"
  [[ "$PREV_VERSION" == "(unknown)" ]] && PREV_VERSION=""
  [[ "$PREV_VERSION" == "" ]] && log "no previous version found (first deploy?)"

  log "build release: $version"
  local dir
  dir="$(build_release "$version")"

  log "validate release..."
  validate_release "$dir"

  DEPLOY_IN_PROGRESS=1
  log "apply release..."
  apply_release "$dir" "$version"
  DEPLOY_IN_PROGRESS=0

  log "deploy success: $version"
}
```

---

## 2) GitHub Actions（审批 + 自动回滚 + 通知）

新建：`.github/workflows/monitoring-deploy-prod.yml`

```yaml
name: monitoring-deploy-prod

on:
  push:
    branches: [ "main" ]
    paths:
      - "monitoring/**"
      - "scripts/deploy-monitoring-v2.sh"
      - ".github/workflows/monitoring-deploy-prod.yml"
  workflow_dispatch:

concurrency:
  group: monitoring-prod
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # 配合 Environment 审批
    steps:
      - uses: actions/checkout@v4

      - name: Validate configs
        run: |
          docker run --rm -v "$PWD:/work" -w /work prom/prometheus:v2.52.0 \
            promtool check config monitoring/prometheus/prometheus.yml
          files=$(find monitoring/prometheus/rules -type f \( -name "*.yml" -o -name "*.yaml" \))
          test -n "$files"
          for f in $files; do
            docker run --rm -v "$PWD:/work" -w /work prom/prometheus:v2.52.0 \
              promtool check rules "$f"
          done
          docker run --rm -v "$PWD:/work" -w /work prom/alertmanager:v0.27.0 \
            amtool check-config monitoring/alertmanager/alertmanager.yml

      - name: Setup SSH
        run: |
          install -m 700 -d ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -p "${{ secrets.DEPLOY_PORT }}" "${{ secrets.DEPLOY_HOST }}" >> ~/.ssh/known_hosts

      - name: Sync files
        run: |
          rsync -az --delete -e "ssh -p ${{ secrets.DEPLOY_PORT }}" \
            ./monitoring ./scripts \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:${{ secrets.DEPLOY_PATH }}/"

      - name: Get previous version
        id: prev
        run: |
          prev=$(ssh -p "${{ secrets.DEPLOY_PORT }}" \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}" \
            "sudo ${{ secrets.DEPLOY_PATH }}/scripts/deploy-monitoring-v2.sh current || true")
          echo "prev=$prev" >> "$GITHUB_OUTPUT"
          echo "PREV=$prev"

      - name: Deploy
        id: deploy_step
        continue-on-error: true
        run: |
          VERSION="${GITHUB_SHA::7}-$(date +%Y%m%d%H%M%S)"
          ssh -p "${{ secrets.DEPLOY_PORT }}" \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}" \
            "cd '${{ secrets.DEPLOY_PATH }}' && \
             chmod +x scripts/deploy-monitoring-v2.sh && \
             sudo SRC_ROOT='${{ secrets.DEPLOY_PATH }}/monitoring' scripts/deploy-monitoring-v2.sh deploy '$VERSION'"

      - name: Rollback on failure
        if: steps.deploy_step.outcome == 'failure' && steps.prev.outputs.prev != '' && steps.prev.outputs.prev != '(unknown)'
        run: |
          ssh -p "${{ secrets.DEPLOY_PORT }}" \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}" \
            "cd '${{ secrets.DEPLOY_PATH }}' && \
             sudo scripts/deploy-monitoring-v2.sh rollback '${{ steps.prev.outputs.prev }}'"

      - name: Get current version
        id: curr
        if: always()
        run: |
          curr=$(ssh -p "${{ secrets.DEPLOY_PORT }}" \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}" \
            "sudo ${{ secrets.DEPLOY_PATH }}/scripts/deploy-monitoring-v2.sh current || true")
          echo "curr=$curr" >> "$GITHUB_OUTPUT"

      - name: Notify Slack
        if: always()
        run: |
          if [ -n "${{ secrets.SLACK_WEBHOOK_URL }}" ]; then
            status="${{ steps.deploy_step.outcome }}"
            text="Monitoring deploy ${status}. repo=${{ github.repository }} sha=${{ github.sha }} prev=${{ steps.prev.outputs.prev }} curr=${{ steps.curr.outputs.curr }} actor=${{ github.actor }}"
            curl -X POST -H 'Content-type: application/json' \
              --data "{\"text\":\"$text\"}" \
              "${{ secrets.SLACK_WEBHOOK_URL }}"
          fi

      - name: Notify Feishu
        if: always()
        run: |
          if [ -n "${{ secrets.FEISHU_WEBHOOK_URL }}" ]; then
            status="${{ steps.deploy_step.outcome }}"
            text="Monitoring deploy ${status}\nrepo=${{ github.repository }}\nsha=${{ github.sha }}\nprev=${{ steps.prev.outputs.prev }}\ncurr=${{ steps.curr.outputs.curr }}\nactor=${{ github.actor }}"
            curl -X POST -H "Content-Type: application/json" \
              -d "{\"msg_type\":\"text\",\"content\":{\"text\":\"$text\"}}" \
              "${{ secrets.FEISHU_WEBHOOK_URL }}"
          fi

      - name: Finalize
        if: steps.deploy_step.outcome == 'failure'
        run: |
          echo "Deploy failed (rollback attempted)."
          exit 1
```

---

## 3) 你需要新增的 Secrets

- `SLACK_WEBHOOK_URL`（可选）
- `FEISHU_WEBHOOK_URL`（可选）
- 以及之前那批 SSH/部署 secrets

---

## 4) 打开“生产审批”（双人审核）

GitHub 仓库里：

`Settings -> Environments -> production -> Required reviewers`

建议至少 2 人，这对生产环境非常关键。

---

如果你点头，我下一条就给你一份**可直接复制的 `sudoers` 最小权限模板 + SSH 限制策略**（把部署账号权限再收紧一层）。