-- NexusLog API Gateway - JWT 认证校验 Lua 脚本
-- 对接 Keycloak JWKS 端点进行 JWT 签名验证
-- change_level: cab（涉及认证鉴权链路）

local cjson = require("cjson.safe")
local auth_cache = ngx.shared.auth_cache
local config_cache = ngx.shared.config_cache

-- ========== 配置 ==========
local AUTH_HEADER = "Authorization"
local BEARER_PREFIX = "Bearer "
local TOKEN_CACHE_TTL = 300          -- Token 验证结果缓存（秒）
local JWKS_CACHE_TTL = 600           -- JWKS 公钥缓存（秒）
local JWKS_CACHE_KEY = "jwks:keys"

-- Keycloak 配置（通过环境变量或默认值）
local KEYCLOAK_HOST = os.getenv("KEYCLOAK_HOST") or "keycloak"
local KEYCLOAK_PORT = os.getenv("KEYCLOAK_PORT") or "8080"
local KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM") or "nexuslog"
local KEYCLOAK_JWKS_URI = string.format(
    "http://%s:%s/realms/%s/protocol/openid-connect/certs",
    KEYCLOAK_HOST, KEYCLOAK_PORT, KEYCLOAK_REALM
)
local EXPECTED_ISSUER = os.getenv("KEYCLOAK_EXPECTED_ISSUER") or string.format(
    "http://%s:%s/realms/%s",
    KEYCLOAK_HOST, KEYCLOAK_PORT, KEYCLOAK_REALM
)
local EXPECTED_AUDIENCE = os.getenv("KEYCLOAK_EXPECTED_AUDIENCE") or ""
local ALLOW_UNSIGNED_FALLBACK = string.lower(os.getenv("AUTH_ALLOW_UNSIGNED_FALLBACK") or "false") == "true"

-- 白名单路径（无需认证）
local WHITELIST = {
    "/health",
    "/metrics",
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/password/reset-request",
    "/api/v1/auth/password/reset-confirm",
    "/api/v1/auth/refresh",
    "/auth/",
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
        return nil, "缺少 Authorization 请求头"
    end

    if string.sub(auth_header, 1, #BEARER_PREFIX) ~= BEARER_PREFIX then
        return nil, "Authorization 格式错误，需要 Bearer Token"
    end

    local token = string.sub(auth_header, #BEARER_PREFIX + 1)
    if not token or token == "" then
        return nil, "Token 为空"
    end

    return token, nil
end

--- Base64URL 解码
local function base64url_decode(input)
    local remainder = #input % 4
    if remainder > 0 then
        input = input .. string.rep("=", 4 - remainder)
    end
    input = input:gsub("-", "+"):gsub("_", "/")
    return ngx.decode_base64(input)
end

--- 解析 JWT 的 Header 和 Payload（不验证签名）
local function decode_jwt_parts(token)
    local parts = {}
    for part in string.gmatch(token, "[^%.]+") do
        table.insert(parts, part)
    end

    if #parts ~= 3 then
        return nil, nil, "Token 格式无效，JWT 应包含三段"
    end

    local header_json = base64url_decode(parts[1])
    local payload_json = base64url_decode(parts[2])

    if not header_json or not payload_json then
        return nil, nil, "Token Base64 解码失败"
    end

    local header = cjson.decode(header_json)
    local payload = cjson.decode(payload_json)

    if not header or not payload then
        return nil, nil, "Token JSON 解析失败"
    end

    return header, payload, nil
end

--- 从 Keycloak 获取 JWKS 公钥
local function fetch_jwks()
    -- 先查缓存
    local cached_jwks = config_cache:get(JWKS_CACHE_KEY)
    if cached_jwks then
        return cjson.decode(cached_jwks), nil
    end

    -- 请求 Keycloak JWKS 端点
    local http = require("resty.http")
    local httpc = http.new()
    httpc:set_timeout(5000)

    local res, err = httpc:request_uri(KEYCLOAK_JWKS_URI, {
        method = "GET",
        headers = { ["Accept"] = "application/json" },
    })

    if not res then
        ngx.log(ngx.ERR, "获取 JWKS 失败: ", err)
        return nil, "无法连接 Keycloak 获取公钥"
    end

    if res.status ~= 200 then
        ngx.log(ngx.ERR, "JWKS 端点返回异常状态: ", res.status)
        return nil, "JWKS 端点返回状态码 " .. res.status
    end

    local jwks = cjson.decode(res.body)
    if not jwks or not jwks.keys then
        return nil, "JWKS 响应格式无效"
    end

    -- 缓存 JWKS
    config_cache:set(JWKS_CACHE_KEY, res.body, JWKS_CACHE_TTL)

    return jwks, nil
end

--- 使用 lua-resty-jwt 验证 Token 签名
local function verify_jwt_signature(token)
    local jwt_lib = require("resty.jwt")

    -- 获取 JWKS 公钥
    local jwks, err = fetch_jwks()
    if not jwks then
        if not ALLOW_UNSIGNED_FALLBACK then
            return false, nil, err
        end
        ngx.log(ngx.WARN, "AUTH_ALLOW_UNSIGNED_FALLBACK=true，降级为格式校验: ", err)
        local jwt_obj = jwt_lib:load_jwt(token)
        if not jwt_obj or not jwt_obj.valid then
            return false, nil, "Token 加载失败"
        end
        return true, jwt_obj.payload, nil
    end

    -- 使用 JWKS 验证签名
    local validators = require("resty.jwt-validators")
    local claim_spec = {
        exp = validators.is_not_expired(),
    }

    local jwt_obj = jwt_lib:verify_jwt_obj(
        jwks,
        jwt_lib:load_jwt(token),
        claim_spec
    )

    if not jwt_obj or not jwt_obj.verified then
        local reason = jwt_obj and jwt_obj.reason or "未知错误"
        return false, nil, "Token 验证失败: " .. reason
    end

    return true, jwt_obj.payload, nil
end

--- 验证 Token Claims（issuer、过期时间等）
local function validate_claims(payload)
    local now = ngx.time()

    -- 检查过期时间
    if payload.exp and payload.exp < now then
        return false, "Token 已过期"
    end

    -- 检查生效时间
    if payload.nbf and payload.nbf > now then
        return false, "Token 尚未生效"
    end

    -- 检查签发时间（允许 5 分钟时钟偏差）
    if payload.iat and payload.iat > (now + 300) then
        return false, "Token 签发时间异常"
    end
    if EXPECTED_ISSUER ~= "" and payload.iss and payload.iss ~= EXPECTED_ISSUER then
        return false, "Token issuer 不匹配"
    end
    if EXPECTED_AUDIENCE ~= "" then
        if payload.aud == EXPECTED_AUDIENCE then
            return true, nil
        end
        if type(payload.aud) == "table" then
            for _, aud in ipairs(payload.aud) do
                if aud == EXPECTED_AUDIENCE then
                    return true, nil
                end
            end
        end
        return false, "Token audience 不匹配"
    end

    return true, nil
end

--- 完整的 Token 验证流程
local function validate_token(token)
    -- 先查缓存
    local cached = auth_cache:get("token:" .. ngx.md5(token))
    if cached then
        local cached_data = cjson.decode(cached)
        if cached_data then
            return true, cached_data, nil
        end
    end

    -- 解析 JWT Header 和 Payload
    local header, payload, err = decode_jwt_parts(token)
    if err then
        return false, nil, err
    end

    -- 验证 Claims
    local ok, err = validate_claims(payload)
    if not ok then
        return false, nil, err
    end

    -- 尝试 JWKS 签名验证
    local verified, verified_payload, verify_err = verify_jwt_signature(token)
    if not verified then
        ngx.log(ngx.WARN, "JWT 签名验证失败: ", verify_err)
        return false, nil, verify_err
    end

    local final_payload = verified_payload or payload

    -- 构建用户信息
    local user_info = {
        sub = final_payload.sub or "",
        preferred_username = final_payload.preferred_username or "",
        email = final_payload.email or "",
        realm_access = final_payload.realm_access or {},
        tenant_id = final_payload.tenant_id or final_payload.azp or "",
    }

    -- 缓存验证结果
    local cache_data = cjson.encode(user_info)
    if cache_data then
        auth_cache:set("token:" .. ngx.md5(token), cache_data, TOKEN_CACHE_TTL)
    end

    return true, user_info, nil
end

--- 返回 JSON 错误响应（统一错误码结构）
local function reject(status_code, error_code, message)
    ngx.status = status_code
    ngx.header["Content-Type"] = "application/json"
    ngx.say(cjson.encode({
        code = error_code or "INTERNAL_ERROR",
        message = message or "internal error",
        request_id = ngx.var.request_id or "",
    }))
    return ngx.exit(status_code)
end

-- ========== 主逻辑 ==========
local uri = ngx.var.uri

-- 白名单路径跳过认证
if is_whitelisted(uri) then
    return
end

-- 提取 Token
local token, err = extract_token()
if not token then
    return reject(401, "AUTH_MISSING_TOKEN", err)
end

-- 验证 Token
local ok, user_info, err = validate_token(token)
if not ok then
    return reject(401, "AUTH_INVALID_TOKEN", err)
end

-- 将用户信息传递给上游服务
ngx.req.set_header("X-Request-ID", ngx.var.request_id)
ngx.req.set_header("X-User-ID", user_info.sub)
ngx.req.set_header("X-User-Name", user_info.preferred_username)
ngx.req.set_header("X-User-Email", user_info.email)
if user_info.tenant_id and user_info.tenant_id ~= "" then
    ngx.req.set_header("X-Tenant-ID", user_info.tenant_id)
end

-- 将角色信息序列化传递
if user_info.realm_access and user_info.realm_access.roles then
    ngx.req.set_header("X-User-Roles", table.concat(user_info.realm_access.roles, ","))
end
