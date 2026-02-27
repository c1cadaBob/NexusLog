可以，**而且非常建议“默认走热更新”**，你这个方向是对的 👍
下面给你一个清晰结论：

## 哪些可以热更新（免重启）

| 组件 | 是否支持热更新 | 怎么做 |
|---|---|---|
| Prometheus 告警规则（`rule_files`） | ✅ | 改文件后 `POST /-/reload`（或 `SIGHUP`） |
| Prometheus 主配置（`prometheus.yml`） | ✅（大部分） | 同上，`POST /-/reload` |
| Alertmanager 路由/接收器/模板 | ✅ | 改文件后 `POST /-/reload` |
| Grafana Dashboard | ✅ | UI 保存/导入 JSON 即生效；文件 provisioning 可轮询更新 |
| 你的 Node Worker 代码 | ❌（代码本身） | 需要发布/滚动重启（可做到无损） |
| Worker 的 ENV 参数 | ❌（通常） | 需重启进程读取新环境变量 |

---

## 关键前提（别漏）

Prometheus / Alertmanager 要启用 lifecycle：

- Prometheus: `--web.enable-lifecycle`
- Alertmanager: `--web.enable-lifecycle`

---

## 推荐热更新流程（生产可用）

```bash
# 1) 先校验
promtool check rules /etc/prometheus/rules/audit-export-alerts.yml
promtool check config /etc/prometheus/prometheus.yml
amtool check-config /etc/alertmanager/alertmanager.yml

# 2) 再热加载
curl -fsS -X POST http://127.0.0.1:9090/-/reload
curl -fsS -X POST http://127.0.0.1:9093/-/reload
```

---

## 额外建议（避免“看起来 reload 了，实际没生效”）

1. **原子替换文件**：先写临时文件，再 `mv` 覆盖，避免半写入。
2. reload 后检查：
   - Prometheus: `/-/ready`、`/api/v1/rules`
   - Alertmanager: `/api/v2/status`
3. 把“校验+reload”做成 CI/CD 步骤（失败自动回滚）。

---

如果你愿意，我下一步给你一份 **`Makefile + deploy.sh` 热更新脚本**（带校验、原子替换、失败回滚）。这样你以后改规则就是一条命令。