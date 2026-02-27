-- NexusLog API Gateway - 多租户路由 Lua 脚本
-- 支持基于 Header（X-Tenant-ID）和 Path（/t/{tenant_id}/）的租户识别
-- 在 access_by_lua 阶段执行，完成租户解析、校验和认证
-- change_level: cab（涉及全局流量策略）

local cjson = require("cjson.safe")
local tenant_config_store = ngx.shared.tenant_config

-- ========== 配置 ==========
local TENANT_CONFIG_DIR = "/etc/openresty/tenants/"
local TENANT_CACHE_TTL = 300  -- 租户配置缓存（秒）

-- 默认租户配置
local DEFAULT_TENANT_CONFIG = {
    enabled = true,
    rate_limit = { rate = 500, window = 60 },
    allowed_apis = { "v1", "control", "data" },
    max_body_size = "50m",
}

--- 从请求中解析租户 ID
--- 优先级：URL 路径 > Header > JWT Claims
--- @return string|nil 租户 ID
--- @return string|nil 解析来源
local function resolve_tenant_id()
    -- 1. 从 URL 路径提取（/t/{tenant_id}/...）
    local path_tenant = ngx.var.tenant_id
    if path_tenant and path_tenant ~= "" then
        return path_tenant, "path"
    end

    -- 2. 从请求头提取
    local header_tenant = ngx.req.get_headers()["X-Tenant-ID"]
    if header_tenant and header_tenant ~= "" then
        return header_tenant, "header"
    end

    -- 3. 从已认证的用户信息中提取（auth_check.lua 设置的）
    local jwt_tenant = ngx.req.get_headers()["X-Tenant-ID"]
    if jwt_tenant and jwt_tenant ~= "" then
        return jwt_tenant, "jwt"
    end

    return nil, nil
end

--- 校验租户 ID 格式
--- 租户 ID 只允许字母、数字、连字符和下划线
local function validate_tenant_id(tenant_id)
    if not tenant_id or tenant_id == "" then
        return false, "租户 ID 不能为空"
    end

    if #tenant_id > 64 then
        return false, "租户 ID 长度不能超过 64 个字符"
    end

    if not string.match(tenant_id, "^[a-zA-Z0-9_-]+$") then
        return false, "租户 ID 格式无效，仅允许字母、数字、连字符和下划线"
    end

    return true, nil
end

--- 加载租户配置
--- 先查缓存，再查配置文件，最后使用默认配置
local function load_tenant_config(tenant_id)
    local cache_key = "config:" .. tenant_id

    -- 查缓存
    local cached = tenant_config_store:get(cache_key)
    if cached then
        local config = cjson.decode(cached)
        if config then
            return config, nil
        end
    end

    -- 尝试从配置文件加载
    local config_path = TENANT_CONFIG_DIR .. tenant_id .. ".json"
    local file = io.open(config_path, "r")
    if file then
        local content = file:read("*a")
        file:close()

        local config = cjson.decode(content)
        if config then
            -- 缓存配置
            tenant_config_store:set(cache_key, content, TENANT_CACHE_TTL)
            return config, nil
        end
    end

    -- 使用默认配置
    local default_json = cjson.encode(DEFAULT_TENANT_CONFIG)
    tenant_config_store:set(cache_key, default_json, TENANT_CACHE_TTL)
    return DEFAULT_TENANT_CONFIG, nil
end

--- 检查租户是否启用
local function check_tenant_enabled(config)
    if config.enabled == false then
        return false, "该租户已被禁用"
    end
    return true, nil
end

--- 检查 API 访问权限
local function check_api_access(config, uri)
    if not config.allowed_apis then
        return true, nil
    end

    for _, api in ipairs(config.allowed_apis) do
        if string.find(uri, "/api/" .. api, 1, true) then
            return true, nil
        end
    end

    return false, "该租户无权访问此 API"
end

--- 设置租户级限流配置到共享字典
local function apply_tenant_rate_limit(tenant_id, config)
    if config.rate_limit then
        local rate_config = cjson.encode(config.rate_limit)
        tenant_config_store:set("rate:" .. tenant_id, rate_config, TENANT_CACHE_TTL)
    end
end

--- 返回 JSON 错误响应
local function reject(status_code, message)
    ngx.status = status_code
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({
        code = status_code,
        message = message,
        request_id = ngx.var.request_id or "",
    }))
    return ngx.exit(status_code)
end

-- ========== 主逻辑 ==========

-- 1. 解析租户 ID
local tenant_id, source = resolve_tenant_id()
if not tenant_id then
    return reject(400, "缺少租户标识，请通过 X-Tenant-ID 头或 /t/{tenant_id}/ 路径指定")
end

-- 2. 校验租户 ID 格式
local valid, err = validate_tenant_id(tenant_id)
if not valid then
    return reject(400, err)
end

-- 3. 加载租户配置
local config, err = load_tenant_config(tenant_id)
if not config then
    ngx.log(ngx.ERR, "加载租户配置失败: tenant=", tenant_id, " err=", err)
    return reject(500, "租户配置加载失败")
end

-- 4. 检查租户是否启用
local enabled, err = check_tenant_enabled(config)
if not enabled then
    return reject(403, err)
end

-- 5. 检查 API 访问权限
local uri = ngx.var.uri
local access_ok, err = check_api_access(config, uri)
if not access_ok then
    return reject(403, err)
end

-- 6. 应用租户级限流配置
apply_tenant_rate_limit(tenant_id, config)

-- 7. 执行认证检查（复用 auth_check 逻辑）
local auth_check = require("auth_check_helper")
if auth_check then
    local ok, err = auth_check.verify_request()
    if not ok then
        return reject(401, err)
    end
end

-- 8. 设置租户上下文头，传递给上游服务
ngx.req.set_header("X-Tenant-ID", tenant_id)
ngx.req.set_header("X-Tenant-Source", source)
ngx.req.set_header("X-Request-ID", ngx.var.request_id)

ngx.log(ngx.INFO, string.format(
    "[租户路由] tenant=%s source=%s uri=%s",
    tenant_id, source, uri
))
