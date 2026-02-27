-- NexusLog API Gateway - 请求限流 Lua 脚本
-- 基于滑动窗口的多层限流：全局限流 + 租户级限流 + 路径级限流
-- change_level: cab（涉及全局流量策略）

local cjson = require("cjson.safe")
local rate_limit_store = ngx.shared.rate_limit_store
local tenant_rate_limit = ngx.shared.tenant_rate_limit

-- ========== 全局限流配置 ==========
local DEFAULT_RATE = 100       -- 默认每窗口最大请求数
local DEFAULT_WINDOW = 60      -- 默认窗口大小（秒）

-- ========== 路径级限流规则 ==========
local PATH_RULES = {
    ["/api/v1/auth/login"]            = { rate = 10,  window = 60 },
    ["/api/v1/auth/register"]         = { rate = 5,   window = 60 },
    ["/api/v1/auth/forgot-password"]  = { rate = 3,   window = 60 },
    ["/api/data/export/"]             = { rate = 20,  window = 60 },
    ["/api/data/query/"]              = { rate = 200, window = 60 },
}

-- ========== 租户级限流默认配置 ==========
local DEFAULT_TENANT_RATE = 500    -- 每租户每窗口最大请求数
local DEFAULT_TENANT_WINDOW = 60   -- 租户限流窗口（秒）

-- 租户级限流配置覆盖（可从配置文件或数据库加载）
local TENANT_RULES = {
    -- 示例：特定租户的自定义限流
    -- ["tenant-premium"] = { rate = 2000, window = 60 },
    -- ["tenant-basic"]   = { rate = 200,  window = 60 },
}

--- 获取客户端标识（IP 或用户 ID）
local function get_client_key()
    -- 优先使用已认证的用户 ID
    local user_id = ngx.req.get_headers()["X-User-ID"]
    if user_id and user_id ~= "" then
        return "user:" .. user_id
    end

    -- 其次使用 X-Forwarded-For 中的真实 IP
    local xff = ngx.req.get_headers()["X-Forwarded-For"]
    if xff then
        local ip = string.match(xff, "^([^,]+)")
        if ip then
            return "ip:" .. string.gsub(ip, "%s+", "")
        end
    end

    return "ip:" .. ngx.var.remote_addr
end

--- 获取租户 ID
local function get_tenant_id()
    -- 优先从请求头获取
    local tenant_id = ngx.req.get_headers()["X-Tenant-ID"]
    if tenant_id and tenant_id ~= "" then
        return tenant_id
    end

    -- 从 URL 路径提取（/t/{tenant_id}/...）
    local path_tenant = string.match(ngx.var.uri, "^/t/([^/]+)/")
    if path_tenant then
        return path_tenant
    end

    return nil
end

--- 获取路径对应的限流规则
local function get_path_rule(uri)
    for path, rule in pairs(PATH_RULES) do
        if uri == path or string.sub(uri, 1, #path) == path then
            return rule.rate, rule.window
        end
    end
    return DEFAULT_RATE, DEFAULT_WINDOW
end

--- 获取租户限流规则
local function get_tenant_rule(tenant_id)
    if not tenant_id then
        return nil, nil
    end

    -- 先查动态配置缓存
    local tenant_config = ngx.shared.tenant_config
    if tenant_config then
        local cached = tenant_config:get("rate:" .. tenant_id)
        if cached then
            local config = cjson.decode(cached)
            if config then
                return config.rate, config.window
            end
        end
    end

    -- 查静态配置
    local rule = TENANT_RULES[tenant_id]
    if rule then
        return rule.rate, rule.window
    end

    return DEFAULT_TENANT_RATE, DEFAULT_TENANT_WINDOW
end

--- 滑动窗口限流检查
--- @param store table ngx.shared.DICT 实例
--- @param key string 限流键
--- @param max_rate number 最大请求数
--- @param window number 窗口大小（秒）
--- @return boolean 是否允许
--- @return number|nil 需要等待的秒数
local function check_rate_limit(store, key, max_rate, window)
    local now = ngx.time()
    local window_key = key .. ":" .. math.floor(now / window)
    local prev_window_key = key .. ":" .. math.floor(now / window - 1)

    -- 当前窗口计数
    local current = store:get(window_key) or 0
    -- 上一窗口计数
    local previous = store:get(prev_window_key) or 0

    -- 滑动窗口加权计算
    local elapsed = now % window
    local weight = (window - elapsed) / window
    local estimated = previous * weight + current

    if estimated >= max_rate then
        local retry_after = math.ceil(window - elapsed)
        return false, retry_after, math.ceil(estimated)
    end

    -- 递增当前窗口计数
    local new_val, err = store:incr(window_key, 1, 0, window * 2)
    if not new_val then
        ngx.log(ngx.ERR, "限流计数递增失败: ", err)
    end

    return true, nil, math.ceil(estimated)
end

--- 返回限流拒绝响应
local function reject_rate_limit(retry_after, limit, current)
    ngx.status = 429
    ngx.header["Content-Type"] = "application/json"
    ngx.header["Retry-After"] = retry_after
    ngx.header["X-RateLimit-Limit"] = limit
    ngx.header["X-RateLimit-Remaining"] = 0
    ngx.say(cjson.encode({
        code = 429,
        message = "请求过于频繁，请稍后重试",
        retry_after = retry_after,
        request_id = ngx.var.request_id or "",
    }))
    return ngx.exit(429)
end

-- ========== 主逻辑 ==========
local uri = ngx.var.uri
local client_key = get_client_key()
local tenant_id = get_tenant_id()

-- 第一层：路径级限流（基于客户端 IP/用户）
local path_rate, path_window = get_path_rule(uri)
local path_key = "rl:" .. client_key .. ":" .. uri

local allowed, retry_after, current = check_rate_limit(
    rate_limit_store, path_key, path_rate, path_window
)

-- 设置限流响应头
ngx.header["X-RateLimit-Limit"] = path_rate
ngx.header["X-RateLimit-Window"] = path_window .. "s"
ngx.header["X-RateLimit-Remaining"] = math.max(0, path_rate - (current or 0))

if not allowed then
    return reject_rate_limit(retry_after, path_rate, current)
end

-- 第二层：租户级限流（如果存在租户 ID）
if tenant_id then
    local tenant_rate, tenant_window = get_tenant_rule(tenant_id)
    if tenant_rate then
        local tenant_key = "trl:" .. tenant_id

        local t_allowed, t_retry, t_current = check_rate_limit(
            tenant_rate_limit, tenant_key, tenant_rate, tenant_window
        )

        ngx.header["X-Tenant-RateLimit-Limit"] = tenant_rate
        ngx.header["X-Tenant-RateLimit-Remaining"] = math.max(0, tenant_rate - (t_current or 0))

        if not t_allowed then
            return reject_rate_limit(t_retry, tenant_rate, t_current)
        end
    end
end
