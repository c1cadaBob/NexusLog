# NexusLog OPA 授权策略服务
# 基于 OPA 官方镜像，预加载 RBAC 和多租户策略
# 变更级别: CAB（涉及授权链路）

FROM openpolicyagent/opa:0.67.0-static

# 复制策略文件
COPY policies/ /policies/
COPY bundles/ /config/

# 健康检查
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD ["/opa", "eval", "-d", "/policies", "true"]

# OPA 以服务模式运行，监听 8181 端口
# 策略通过 Bundle 热更新，无需重启
EXPOSE 8181

ENTRYPOINT ["/opa"]
CMD ["run", "--server", \
     "--addr=:8181", \
     "--log-level=info", \
     "--set=decision_logs.console=true", \
     "/policies"]
