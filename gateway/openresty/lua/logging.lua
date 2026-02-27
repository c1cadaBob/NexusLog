-- NexusLog API Gateway - 请求日志 Lua 脚本
-- 在 log_by_lua 阶段记录结构化请求日志，收集指标
-- 支持将日志推送到 Kafka（通过 UDP/TCP 日志管道）
-- change_level: none

local cjson = require("cjson.safe")
local metrics_store = ngx.shared.metrics_store

-- ========== 配置 ==========
local SLOW_THRESHOLD = 3.0           -- 慢请求阈值（秒）
local LOG_SAMPLE_RATE = 1.0          -- 日志采样率（1.0 = 100%）
local ENABLE_KAFKA_LOG = false       -- 是否启用 Kafka 日志推送
local KAFKA_LOG_SOCKET = "127.0.0.1" -- Kafka 日志代理地址
local KAFKA_LOG_PORT = 9514          -- Kafka 日志代理端口

--- 收集请求上下文信息
local function collect_request_info()
    return {
        -- 基础信息
        timestamp = ngx.now(),
        time_iso8601 = ngx.var.time_iso8601,
        request_id = ngx.var.request_id or "-",

        -- 客户端信息
        remote_addr = ngx.var.remote_addr,
        user_agent = ngx.var.http_user_agent or "-",
        referer = ngx.var.http_referer or "-",
        x_forwarded_for = ngx.var.http_x_forwarded_for or "-",

        -- 请求信息
        method = ngx.var.request_method,
        uri = ngx.var.uri,
        query_string = ngx.var.query_string or "",
        host = ngx.var.host or "-",
        scheme = ngx.var.scheme or "http",
        request_length = tonumber(ngx.var.request_length) or 0,

        -- 响应信息
        status = tonumber(ngx.var.status) or 0,
        body_bytes_sent = tonumber(ngx.var.body_bytes_sent) or 0,

        -- 性能信息
        request_time = tonumber(ngx.var.request_time) or 0,
        upstream_response_time = ngx.var.upstream_response_time or "-",
        upstream_connect_time = ngx.var.upstream_connect_time or "-",
        upstream_header_time = ngx.var.upstream_header_time or "-",
        upstream_addr = ngx.var.upstream_addr or "-",

        -- 租户和用户信息
        tenant_id = ngx.var.http_x_tenant_id or ngx.req.get_headers()["X-Tenant-ID"] or "-",
        user_id = ngx.req.get_headers()["X-User-ID"] or "-",
    }
end

--- 更新指标计数器
local function update_metrics(info)
    if not metrics_store then
        return
    end

    -- 请求总数
    metrics_store:incr("total_requests", 1, 0)

    -- 按状态码分类计数
    local status_class = math.floor(info.status / 100) .. "xx"
    metrics_store:incr("status:" .. status_class, 1, 0)

    -- 按方法计数
    metrics_store:incr("method:" .. info.method, 1, 0)

    -- 延迟累加（用于计算平均值）
    metrics_store:incr("latency_sum", info.request_time, 0)
    metrics_store:incr("latency_count", 1, 0)

    -- 按租户计数
    if info.tenant_id and info.tenant_id ~= "-" then
        metrics_store:incr("tenant:" .. info.tenant_id .. ":requests", 1, 0)
    end

    -- 慢请求计数
    if info.request_time > SLOW_THRESHOLD then
        metrics_store:incr("slow_requests", 1, 0)
    end

    -- 错误请求计数
    if info.status >= 500 then
        metrics_store:incr("error_5xx", 1, 0)
    elseif info.status >= 400 then
        metrics_store:incr("error_4xx", 1, 0)
    end
end

--- 检测慢请求并记录告警
local function check_slow_request(info)
    if info.request_time > SLOW_THRESHOLD then
        ngx.log(ngx.WARN, string.format(
            "[慢请求] request_id=%s method=%s uri=%s time=%.3fs upstream=%s tenant=%s",
            info.request_id,
            info.method,
            info.uri,
            info.request_time,
            info.upstream_response_time,
            info.tenant_id
        ))
    end
end

--- 检测错误响应并记录
local function check_error_response(info)
    if info.status >= 500 then
        ngx.log(ngx.ERR, string.format(
            "[上游错误] request_id=%s method=%s uri=%s status=%d upstream=%s addr=%s",
            info.request_id,
            info.method,
            info.uri,
            info.status,
            info.upstream_response_time,
            info.upstream_addr
        ))
    end
end

--- 构建结构化日志条目
local function build_log_entry(info)
    return {
        ["@timestamp"] = info.time_iso8601,
        level = info.status >= 500 and "ERROR" or (info.status >= 400 and "WARN" or "INFO"),
        logger = "nexuslog-gateway",
        request_id = info.request_id,
        tenant_id = info.tenant_id,
        user_id = info.user_id,
        http = {
            method = info.method,
            uri = info.uri,
            status = info.status,
            request_length = info.request_length,
            response_length = info.body_bytes_sent,
        },
        performance = {
            request_time = info.request_time,
            upstream_time = info.upstream_response_time,
            upstream_connect = info.upstream_connect_time,
        },
        client = {
            ip = info.remote_addr,
            user_agent = info.user_agent,
        },
        upstream = {
            addr = info.upstream_addr,
        },
    }
end

--- 通过 UDP 推送日志到 Kafka 代理（异步，不阻塞请求）
local function push_to_kafka(log_entry)
    if not ENABLE_KAFKA_LOG then
        return
    end

    local log_json = cjson.encode(log_entry)
    if not log_json then
        return
    end

    local sock = ngx.socket.udp()
    sock:settimeout(100) -- 100ms 超时，避免阻塞
    local ok, err = sock:setpeername(KAFKA_LOG_SOCKET, KAFKA_LOG_PORT)
    if not ok then
        ngx.log(ngx.ERR, "Kafka 日志代理连接失败: ", err)
        return
    end

    local ok, err = sock:send(log_json)
    if not ok then
        ngx.log(ngx.ERR, "Kafka 日志发送失败: ", err)
    end

    sock:close()
end

-- ========== 主逻辑 ==========
local ok, err = pcall(function()
    -- 采样控制
    if LOG_SAMPLE_RATE < 1.0 then
        if math.random() > LOG_SAMPLE_RATE then
            return
        end
    end

    local info = collect_request_info()

    -- 更新指标
    update_metrics(info)

    -- 检测异常
    check_slow_request(info)
    check_error_response(info)

    -- 构建结构化日志并推送
    local log_entry = build_log_entry(info)
    push_to_kafka(log_entry)
end)

if not ok then
    ngx.log(ngx.ERR, "日志脚本执行异常: ", err)
end
