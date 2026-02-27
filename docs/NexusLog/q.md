太好了，下面给你一份**可直接落地**的「最小权限 sudoers + SSH 限制」方案。
先说一句关键的安全点：

> **不要让 CI 同步并覆盖可被 sudo 执行的脚本。**
> 否则等于给了 deploy 用户“间接 root”。

---

## 1) 先做结构收敛（强烈建议）

- CI 只同步：`/opt/monitoring-release/monitoring`
- root 固定脚本：`/usr/local/sbin/deploy-monitoring.sh`（sudo 只允许它）

### `/usr/local/sbin/deploy-monitoring.sh`（root:root, 0755）

```bash
#!/usr/bin/env bash
set -euo pipefail

BASE="/opt/monitoring-release"
SCRIPT="$BASE/scripts/deploy-monitoring-v2.sh"

case "${1:-}" in
  deploy|rollback|list|current) ;;
  *) echo "usage: $0 {deploy [version]|rollback <version>|list|current}" >&2; exit 2 ;;
esac

export SRC_ROOT="$BASE/monitoring"
exec "$SCRIPT" "$@"
```

> `deploy-monitoring-v2.sh` 本体请放在 root 可控路径，且不要被 CI 覆盖。

---

## 2) sudoers 最小权限模板

新建 `/etc/sudoers.d/deploy-monitoring`（用 `visudo -f` 编辑）：

```sudoers
Defaults:deploy env_reset
Defaults:deploy secure_path="/usr/sbin:/usr/bin:/sbin:/bin:/usr/local/sbin:/usr/local/bin"
Defaults:deploy !requiretty

Cmnd_Alias MONITORING_DEPLOY = \
  /usr/local/sbin/deploy-monitoring.sh deploy, \
  /usr/local/sbin/deploy-monitoring.sh deploy *, \
  /usr/local/sbin/deploy-monitoring.sh rollback *, \
  /usr/local/sbin/deploy-monitoring.sh list, \
  /usr/local/sbin/deploy-monitoring.sh current

deploy ALL=(root) NOPASSWD: MONITORING_DEPLOY
```

校验：

```bash
visudo -cf /etc/sudoers.d/deploy-monitoring
sudo -l -U deploy
```

---

## 3) SSH 限制策略（实用版）

### `sshd` 基础策略（`/etc/ssh/sshd_config.d/deploy.conf`）

```sshconfig
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes

AllowUsers deploy
```

### deploy 用户 `authorized_keys`（建议）

```text
no-agent-forwarding,no-port-forwarding,no-X11-forwarding,no-user-rc,no-pty ssh-ed25519 AAAA... your-ci-key
```

> 如果你有固定出口 IP（如自建 runner / NAT 网关），再加 `from="x.x.x.x/32"` 最佳。
> GitHub Hosted Runner IP 不固定时，`from=` 不太好用。

---

## 4) 文件权限建议

```bash
# 可被 CI 同步的目录（deploy 可写）
chown -R deploy:deploy /opt/monitoring-release/monitoring

# root 控制的脚本（deploy 不可写）
chown root:root /usr/local/sbin/deploy-monitoring.sh
chmod 755 /usr/local/sbin/deploy-monitoring.sh

chown root:root /opt/monitoring-release/scripts/deploy-monitoring-v2.sh
chmod 750 /opt/monitoring-release/scripts/deploy-monitoring-v2.sh
```

---

## 5) 你的 GitHub Actions 需要改一处

把 `rsync ./monitoring ./scripts` 改成只同步 monitoring：

```bash
rsync -az --delete -e "ssh -p ${{ secrets.DEPLOY_PORT }}" \
  ./monitoring \
  "${{ secrets.DEPLOY_USER }}@${{ secrets.DEPLOY_HOST }}:${{ secrets.DEPLOY_PATH }}/"
```

远端执行改成：

```bash
sudo /usr/local/sbin/deploy-monitoring.sh deploy "$VERSION"
```

---

如果你愿意，我下一步可以把你现有 workflow 直接改成**“安全收敛版完整 YAML”**（我会把上面这些策略全部合进去，直接替换即可）。