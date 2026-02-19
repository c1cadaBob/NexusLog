-- NexusLog API Gateway - 认证校验 Lua 脚本
-- 负责 JWT/OIDC Token 验证，与 Keycloak 集成
-- change_level: cab（涉及认证鉴权链路）

local auth_cache = ngx.shared.auth_cache

-- 配置
local AUTH_HEADER = "Authorization"
local BEARER_PREFIX = "Bearer "
local CACHE_TTL = 300 -- Token 缓存有效期（秒）

-- 白名单路径（无需认证）
local WHITELIST = {
    "/health",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/refresh",
}

--- 检查路径是否在白名单中
local function is_whitelisted(uri)
    for _, path in ipairs(WHITELIST) do
        if uri == path or string.sub(uri, 1, #path) == path then
            return true
        end
    end
    return false
end

--- 从请求头提取 Bearer Token
local function extract_token()
    local auth_header = ngx.req.get_headers()[AUTH_HEADER]
    if not auth_header then
        return nil, "missing Authorization header"
    end

    if string.sub(auth_header, 1, #BEARER_PREFIX) ~= BEARER_PREFIX then
        return nil, "invalid Authorization format, expected Bearer token"
    end

    return string.sub(auth_header, #BEARER_PREFIX + 1), nil
end

--- 验证 Token（简化版，生产环境应对接 Keycloak JWKS）
local function validate_token(token)
    -- 先查缓存
    local cached = auth_cache:get(token)
    if cached then
        return true, nil
    end

    -- TODO: 对接 Keycloak JWKS 端点进行 JWT 签名验证
    -- TODO: 验证 Token 过期时间、issuer、audience
    -- TODO: 提取用户信息和角色，设置到请求头中

    -- 基础格式校验（JWT 应包含三段）
    local dot_count = 0
    for _ in string.gmatch(token, "%.") do
        dot_count = dot_count + 1
    end

    if dot_count ~= 2 then
        return false, "invalid token format"
    end

    -- 缓存有效 Token
    auth_cache:set(token, "valid", CACHE_TTL)

    return true, nil
end

-- 主逻辑
local uri = ngx.var.uri

-- 白名单路径跳过认证
if is_whitelisted(uri) then
    return
end

-- 提取 Token
local token, err = extract_token()
if not token then
    ngx.status = 401
    ngx.header["Content-Type"] = "application/json"
    ngx.say('{"code":401,"message":"' .. err .. '"}')
    return ngx.exit(401)
end

-- 验证 Token
local ok, err = validate_token(token)
if not ok then
    ngx.status = 401
    ngx.header["Content-Type"] = "application/json"
    ngx.say('{"code":401,"message":"' .. err .. '"}')
    return ngx.exit(401)
end

-- 将请求 ID 传递给上游
ngx.req.set_header("X-Request-ID", ngx.var.request_id)
