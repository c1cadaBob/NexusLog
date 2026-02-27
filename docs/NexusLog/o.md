太好了，直接给你可落地的 **GitHub Actions 版本**。
你可以先用它跑通，再决定要不要我给你补一份 GitLab CI。

---

## 一、先准备 GitHub Secrets

在仓库里配置这些 Secrets：

- `DEPLOY_HOST`：目标机器 IP/域名
- `DEPLOY_PORT`：SSH 端口（如 `22`）
- `DEPLOY_USER`：SSH 用户（建议专用 deploy 用户）
- `DEPLOY_SSH_KEY`：私钥内容（对应目标机公钥）
- `DEPLOY_PATH`：远端发布目录（如 `/opt/monitoring-release`）

> 建议这个目录专用，不要和别的项目共用（因为我们用了 `rsync --delete`）。

---

## 二、自动部署工作流（push main 自动）

新建：`.github/workflows/monitoring-deploy.yml`

```yaml
name: monitoring-deploy

on:
  push:
    branches: [ "main" ]
    paths:
      - "monitoring/**"
      - "scripts/deploy-monitoring-v2.sh"
      - ".github/workflows/monitoring-deploy.yml"
  workflow_dispatch:

concurrency:
  group: monitoring-deploy-prod
  cancel-in-progress: false

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Validate Prometheus config
        run: |
          docker run --rm -v "$PWD:/work" -w /work prom/prometheus:v2.52.0 \
            promtool check config monitoring/prometheus/prometheus.yml

      - name: Validate Prometheus rules
        run: |
          set -e
          files=$(find monitoring/prometheus/rules -type f \( -name "*.yml" -o -name "*.yaml" \))
          test -n "$files" || (echo "No rule files found"; exit 1)
          for f in $files; do
            echo "checking $f"
            docker run --rm -v "$PWD:/work" -w /work prom/prometheus:v2.52.0 \
              promtool check rules "$f"
          done

      - name: Validate Alertmanager config
        run: |
          docker run --rm -v "$PWD:/work" -w /work prom/alertmanager:v0.27.0 \
            amtool check-config monitoring/alertmanager/alertmanager.yml

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Setup SSH
        run: |
          install -m 700 -d ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -p "${{ secrets.DEPLOY_PORT }}" "${{ secrets.DEPLOY_HOST }}" >> ~/.ssh/known_hosts

      - name: Sync files to server
        run: |
          rsync -az --delete \
            -e "ssh -p ${{ secrets.DEPLOY_PORT }}" \
            ./monitoring ./scripts \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:${{ secrets.DEPLOY_PATH }}/"

      - name: Deploy with hot reload
        run: |
          ssh -p "${{ secrets.DEPLOY_PORT }}" \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}" \
            "cd '${{ secrets.DEPLOY_PATH }}' && \
             chmod +x scripts/deploy-monitoring-v2.sh && \
             sudo SRC_ROOT='${{ secrets.DEPLOY_PATH }}/monitoring' scripts/deploy-monitoring-v2.sh deploy && \
             echo 'Current version:' && sudo scripts/deploy-monitoring-v2.sh current"
```

---

## 三、手动回滚工作流（指定版本）

新建：`.github/workflows/monitoring-rollback.yml`

```yaml
name: monitoring-rollback

on:
  workflow_dispatch:
    inputs:
      version:
        description: "Target release version (from list)"
        required: true
        type: string

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Setup SSH
        run: |
          install -m 700 -d ~/.ssh
          echo "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/id_rsa
          chmod 600 ~/.ssh/id_rsa
          ssh-keyscan -p "${{ secrets.DEPLOY_PORT }}" "${{ secrets.DEPLOY_HOST }}" >> ~/.ssh/known_hosts

      - name: Rollback
        run: |
          ssh -p "${{ secrets.DEPLOY_PORT }}" \
            "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}" \
            "cd '${{ secrets.DEPLOY_PATH }}' && \
             sudo scripts/deploy-monitoring-v2.sh rollback '${{ github.event.inputs.version }}' && \
             echo 'Current version:' && sudo scripts/deploy-monitoring-v2.sh current"
```

---

## 四、目标机权限（很关键）

如果脚本要写 `/etc/prometheus`、`/etc/alertmanager`，通常需要 sudo。
建议给 deploy 用户最小化 sudo 权限（`visudo`）：

```bash
deploy ALL=(root) NOPASSWD: /opt/monitoring-release/scripts/deploy-monitoring-v2.sh *
```

---

## 五、别忘了启动参数

Prometheus / Alertmanager 必须启用：

- `--web.enable-lifecycle`

否则热更新接口 `/-/reload` 不生效。

---

如果你愿意，我下一步可以直接给你一份 **“生产增强版”**：
- 部署后自动发 Slack/飞书通知（带 version）
- 失败自动触发最近版本回滚
- GitHub Environment 审批（双人审核后才可 deploy）