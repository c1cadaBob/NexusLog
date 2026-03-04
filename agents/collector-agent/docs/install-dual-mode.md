# Collector Agent 双安装模式（7.4）

本文档提供 `预编译二进制 + systemd` 与 `Docker` 两种安装方式，均不依赖远端 Go/GCC 编译工具。

## 1. 预编译打包

在构建机执行：

```bash
cd /opt/projects/NexusLog/agents/collector-agent
bash scripts/package-agent.sh
```

输出产物：

- `dist/collector-agent-linux-amd64/collector-agent`
- `dist/collector-agent-linux-amd64.tar.gz`

## 2. 模式 A：预编译二进制 + systemd

### 2.1 远端目录与用户

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin collector || true
sudo mkdir -p /opt/nexuslog/collector-agent /etc/nexuslog /var/lib/collector-agent/{checkpoints,cache}
sudo chown -R collector:collector /opt/nexuslog/collector-agent /var/lib/collector-agent
```

### 2.2 安装文件

```bash
sudo cp collector-agent /usr/local/bin/collector-agent
sudo chmod +x /usr/local/bin/collector-agent
sudo cp -r configs /opt/nexuslog/collector-agent/
sudo cp deploy/systemd/collector-agent.service /etc/systemd/system/
sudo cp deploy/systemd/collector-agent.env.example /etc/nexuslog/collector-agent.env
```

可按需编辑 `/etc/nexuslog/collector-agent.env` 的采集范围：

```bash
COLLECTOR_INCLUDE_PATHS=/var/log/*.log,/data/app/*.log
COLLECTOR_EXCLUDE_PATHS=/var/log/wtmp,/data/app/debug-*.log
COLLECTOR_PATH_LABEL_RULES=[{"pattern":"/var/log/nginx/*.log","labels":{"service":"nginx","env":"prod"}},{"pattern":"/data/app/*.log","labels":{"service":"app","env":"prod"}}]
```

### 2.3 启动与验证

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now collector-agent
sudo systemctl status collector-agent --no-pager
curl -s http://127.0.0.1:9091/healthz
curl -s -H 'X-Agent-Key: replace-with-strong-key' http://127.0.0.1:9091/agent/v1/meta
```

## 3. 模式 B：Docker 运行

```bash
cd deploy/docker
mkdir -p configs state/checkpoints state/cache
cp ../../configs/agent.yaml ./configs/agent.yaml
docker compose -f docker-compose.agent.yml up -d
docker compose -f docker-compose.agent.yml ps
curl -s http://127.0.0.1:9091/healthz
curl -s -H 'X-Agent-Key: replace-with-strong-key' http://127.0.0.1:9091/agent/v1/meta
```

可在 `docker-compose.agent.yml` 中独立配置容器采集范围：

```yaml
environment:
  COLLECTOR_INCLUDE_PATHS: "/var/log/*.log,/host-data/logs/*.log"
  COLLECTOR_EXCLUDE_PATHS: "/var/log/wtmp,/host-data/logs/debug-*.log"
  COLLECTOR_PATH_LABEL_RULES: '[{"pattern":"/host-data/logs/nginx*.log","labels":{"service":"nginx","env":"prod"}}]'
```

## 4. 回滚与停机

- systemd：`sudo systemctl stop collector-agent`
- Docker：`docker compose -f docker-compose.agent.yml down`
