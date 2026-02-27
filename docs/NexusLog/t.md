太好了 👍
你这个动作会明显降低值班风险。下面给你一份可直接放进仓库的：

# Monitoring 回滚 Runbook（最小可用版）

> 建议文件路径：`docs/runbook-monitoring-rollback.md`

## 1）目标与原则（先看这个）
- **目标**：在配置发布异常时，最快恢复监控与告警能力。
- **原则**：
  1. **优先热更新**（`ALLOW_RESTART_FALLBACK=0`）
  2. 自动重启仅作人工确认后的兜底（`ALLOW_RESTART_FALLBACK=1`）
  3. 回滚优先选“最近一个已知稳定版本”

---

## 2）触发条件（满足任一就回滚）
- 发布后 Prometheus/Alertmanager 告警异常（误报/漏报明显）
- `/-/reload` 后 `*_config_last_reload_successful != 1`
- 值班判断“继续观察风险高于回滚风险”

---

## 3）标准回滚（推荐：GitHub Actions）
1. 打开 `Actions` → `monitoring-release` → `Run workflow`
2. 参数：
   - `action = rollback`
   - `version = <目标版本>`（必填）
   - `allow_restart_fallback = false`（先保持 false）
3. 等待执行完成，确认 job 为 ✅

> 若失败且确认需要兜底，再执行一次：`allow_restart_fallback = true`

---

## 4）命令行回滚（应急）
登录部署机后执行：

```bash
# 1) 看当前版本
sudo /usr/local/sbin/deploy-monitoring.sh current

# 2) 看可回滚版本列表
sudo /usr/local/sbin/deploy-monitoring.sh list

# 3) 执行回滚（热更新优先）
sudo ALLOW_RESTART_FALLBACK=0 /usr/local/sbin/deploy-monitoring.sh rollback <VERSION>
```

兜底（仅在审批/确认后）：
```bash
sudo ALLOW_RESTART_FALLBACK=1 /usr/local/sbin/deploy-monitoring.sh rollback <VERSION>
```

---

## 5）回滚成功判定（30 秒内完成）
```bash
# 当前版本应为目标版本
sudo /usr/local/sbin/deploy-monitoring.sh current

# Prometheus reload 成功指标应为 1
curl -fsS http://127.0.0.1:9090/metrics | grep '^prometheus_config_last_reload_successful '

# Alertmanager reload 成功指标应为 1
curl -fsS http://127.0.0.1:9093/metrics | grep '^alertmanager_config_last_reload_successful '
```

可选补充检查：
- Prometheus Targets 页面无大面积 `down`
- Alertmanager 路由/静默策略符合预期

---

## 6）失败升级路径（简版）
1. `rollback + 热更新` 失败
2. 经确认后允许 `restart fallback` 再试一次
3. 仍失败：立即升级到 oncall owner + 平台负责人，进入人工恢复（保留现场日志）

---

## 7）值班沟通模板（可直接发群）
> `【监控回滚】已执行 rollback -> <VERSION>，方式：热更新优先（是否重启兜底：否/是），当前 reload 指标：Prometheus=1，Alertmanager=1，影响已恢复/持续观察中。`

---

如果你愿意，我下一条可以把这份再给你一个**“夜间值班超短版（10行命令版）”**，方便贴到告警平台备注里。