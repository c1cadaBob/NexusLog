-- NexusLog API Gateway - 限流 Lua 脚本
-- 基于滑动窗口的请求限流，防止暴力攻击和滥用
-- change_level: cab（涉及流量总闸）

local rate_limit_store = ngx.shared.rate_limit_store

-- 限流配置
local DEFAULT_RATE = 100       -- 默认每窗口最大请求数
local DEFAULT_WINDOW = 60      -- 默认窗口大小（秒）

-- 路径级别限流规则
local RATE_RULES = {
    ["/api/v1/auth/login"] = { rate = 10, window = 60 },
    ["/api/v1/auth/register"] = { rate = 5, window = 60 },
    ["/api/v1/auth/forgot-password"] = { rate = 3, window = 60 },
}

--- 获取客户端标识（IP 或用户 ID）
local function get_client_key()
    -- 优先使用 X-Forwarded-For 中的真实 IP
    local xff = ngx.req.get_headers()["X-Forwarded-For"]
    if xff then
        -- 取第一个 IP（最接近客户端的）
        local ip = string.match(xff, "^([^,]+)")
        if ip then
            return string.gsub(ip, "%s+", "")
        end
    end
    return ngx.var.remote_addr
end

--- 获取路径对应的限流规则
local function get_rate_rule(uri)
    for path, rule in pairs(RATE_RULES) do
        if uri == path or string.sub(uri, 1, #path) == path then
            return rule.rate, rule.window
        end
    end
    return DEFAULT_RATE, DEFAULT_WINDOW
end

--- 滑动窗口限流检查
local function check_rate_limit(key, max_rate, window)
    local now = ngx.time()
    local window_key = key .. ":" .. math.floor(now / window)
    local prev_window_key = key .. ":" .. math.floor(now / window - 1)

    -- 当前窗口计数
    local current = rate_limit_store:get(window_key) or 0
    -- 上一窗口计数
    local previous = rate_limit_store:get(prev_window_key) or 0

    -- 滑动窗口加权计算
    local elapsed = now % window
    local weight = (window - elapsed) / window
    local estimated = previous * weight + current

    if estimated >= max_rate then
        return false, math.ceil(window - elapsed)
    end

    -- 递增当前窗口计数
    local new_val, err = rate_limit_store:incr(window_key, 1, 0, window * 2)
    if not new_val then
        ngx.log(ngx.ERR, "rate limit incr failed: ", err)
    end

    return true, nil
end

-- 主逻辑
local uri = ngx.var.uri
local client_key = get_client_key()
local rate_key = "rl:" .. client_key .. ":" .. uri
local max_rate, window = get_rate_rule(uri)

local allowed, retry_after = check_rate_limit(rate_key, max_rate, window)

-- 设置限流响应头
ngx.header["X-RateLimit-Limit"] = max_rate
ngx.header["X-RateLimit-Window"] = window .. "s"

if not allowed then
    ngx.status = 429
    ngx.header["Content-Type"] = "application/json"
    ngx.header["Retry-After"] = retry_after
    ngx.say('{"code":429,"message":"请求过于频繁，请稍后重试","retry_after":' .. retry_after .. '}')
    return ngx.exit(429)
end
