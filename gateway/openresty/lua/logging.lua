-- NexusLog API Gateway - 请求日志 Lua 脚本
-- 在 log_by_lua 阶段记录结构化请求日志，用于审计和监控
-- change_level: none

--- 收集请求上下文信息
local function collect_request_info()
    local info = {
        timestamp = ngx.now(),
        request_id = ngx.var.request_id or "-",
        remote_addr = ngx.var.remote_addr,
        method = ngx.var.request_method,
        uri = ngx.var.uri,
        query_string = ngx.var.query_string or "",
        status = ngx.var.status,
        body_bytes_sent = tonumber(ngx.var.body_bytes_sent) or 0,
        request_time = tonumber(ngx.var.request_time) or 0,
        upstream_response_time = ngx.var.upstream_response_time or "-",
        user_agent = ngx.var.http_user_agent or "-",
        referer = ngx.var.http_referer or "-",
    }
    return info
end

--- 记录慢请求告警
local function check_slow_request(info)
    local SLOW_THRESHOLD = 3.0 -- 慢请求阈值（秒）
    if info.request_time > SLOW_THRESHOLD then
        ngx.log(ngx.WARN,
            "slow request detected: ",
            "request_id=", info.request_id, " ",
            "uri=", info.method, " ", info.uri, " ",
            "time=", info.request_time, "s ",
            "upstream=", info.upstream_response_time, "s"
        )
    end
end

--- 记录错误请求
local function check_error_response(info)
    local status = tonumber(info.status) or 0
    if status >= 500 then
        ngx.log(ngx.ERR,
            "upstream error: ",
            "request_id=", info.request_id, " ",
            "uri=", info.method, " ", info.uri, " ",
            "status=", info.status, " ",
            "upstream=", info.upstream_response_time, "s"
        )
    end
end

-- 主逻辑
local ok, err = pcall(function()
    local info = collect_request_info()
    check_slow_request(info)
    check_error_response(info)

    -- TODO: 将结构化日志推送到 Kafka 或日志采集管道
    -- TODO: 集成 Prometheus metrics 上报（请求计数、延迟直方图）
end)

if not ok then
    ngx.log(ngx.ERR, "logging lua error: ", err)
end
