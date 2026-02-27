-- NexusLog API Gateway - 指标收集模块
-- 提供 Prometheus 格式的指标暴露端点
-- change_level: none

local metrics_store = ngx.shared.metrics_store

local _M = {}

--- 递增请求计数器
function _M.incr_request_count(method, uri, status)
    local key = "req:" .. method .. ":" .. uri .. ":" .. tostring(status)
    local new_val, err = metrics_store:incr(key, 1, 0)
    if not new_val then
        ngx.log(ngx.ERR, "指标计数递增失败: ", err)
    end
end

--- 记录请求延迟
function _M.record_latency(uri, latency)
    local key = "latency:" .. uri
    -- 使用简单的累加和计数来计算平均延迟
    local sum_key = key .. ":sum"
    local count_key = key .. ":count"
    metrics_store:incr(sum_key, latency, 0)
    metrics_store:incr(count_key, 1, 0)
end

--- 暴露 Prometheus 格式指标
function _M.expose()
    ngx.header["Content-Type"] = "text/plain; charset=utf-8"

    local lines = {}
    table.insert(lines, "# HELP nexuslog_gateway_up 网关运行状态")
    table.insert(lines, "# TYPE nexuslog_gateway_up gauge")
    table.insert(lines, "nexuslog_gateway_up 1")
    table.insert(lines, "")

    -- 输出共享字典使用情况
    local dicts = { "rate_limit_store", "auth_cache", "config_cache", "metrics_store", "tenant_config" }
    table.insert(lines, "# HELP nexuslog_shared_dict_capacity_bytes 共享字典容量（字节）")
    table.insert(lines, "# TYPE nexuslog_shared_dict_capacity_bytes gauge")
    table.insert(lines, "# HELP nexuslog_shared_dict_free_bytes 共享字典剩余空间（字节）")
    table.insert(lines, "# TYPE nexuslog_shared_dict_free_bytes gauge")

    for _, name in ipairs(dicts) do
        local dict = ngx.shared[name]
        if dict then
            local capacity = dict:capacity()
            local free = dict:free_space()
            table.insert(lines, string.format('nexuslog_shared_dict_capacity_bytes{dict="%s"} %d', name, capacity))
            table.insert(lines, string.format('nexuslog_shared_dict_free_bytes{dict="%s"} %d', name, free))
        end
    end

    table.insert(lines, "")
    table.insert(lines, "# HELP nexuslog_nginx_connections_active 当前活跃连接数")
    table.insert(lines, "# TYPE nexuslog_nginx_connections_active gauge")
    table.insert(lines, string.format("nexuslog_nginx_connections_active %d", ngx.var.connections_active or 0))

    ngx.say(table.concat(lines, "\n"))
end

return _M
