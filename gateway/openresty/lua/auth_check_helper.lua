-- NexusLog API Gateway - 认证辅助模块
-- 提供可复用的严格认证函数，供 tenant_router.lua 等脚本调用
-- change_level: cab（涉及认证鉴权链路）

local cjson = require("cjson.safe")
local auth_cache = ngx.shared.auth_cache
local config_cache = ngx.shared.config_cache

local _M = {}

local AUTH_HEADER = "Authorization"
local BEARER_PREFIX = "Bearer "
local TOKEN_CACHE_TTL = 300
local JWKS_CACHE_TTL = 600
local JWKS_CACHE_KEY = "jwks:keys"

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

local function extract_token()
    local auth_header = ngx.req.get_headers()[AUTH_HEADER]
    if not auth_header then
        return nil, "缺少 Authorization 请求头"
    end
    if string.sub(auth_header, 1, #BEARER_PREFIX) ~= BEARER_PREFIX then
        return nil, "Authorization 格式错误"
    end
    local token = string.sub(auth_header, #BEARER_PREFIX + 1)
    if not token or token == "" then
        return nil, "Token 为空"
    end
    return token, nil
end

local function base64url_decode(input)
    local remainder = #input % 4
    if remainder > 0 then
        input = input .. string.rep("=", 4 - remainder)
    end
    input = input:gsub("-", "+"):gsub("_", "/")
    return ngx.decode_base64(input)
end

local function decode_jwt_parts(token)
    local parts = {}
    for part in string.gmatch(token, "[^%.]+") do
        table.insert(parts, part)
    end
    if #parts ~= 3 then
        return nil, nil, "Token 格式无效"
    end
    local header_json = base64url_decode(parts[1])
    local payload_json = base64url_decode(parts[2])
    if not header_json or not payload_json then
        return nil, nil, "Token 解码失败"
    end
    local header = cjson.decode(header_json)
    local payload = cjson.decode(payload_json)
    if not header or not payload then
        return nil, nil, "Token JSON 解析失败"
    end
    return header, payload, nil
end

local function fetch_jwks()
    local cached_jwks = config_cache:get(JWKS_CACHE_KEY)
    if cached_jwks then
        return cjson.decode(cached_jwks), nil
    end

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
    config_cache:set(JWKS_CACHE_KEY, res.body, JWKS_CACHE_TTL)
    return jwks, nil
end

local function verify_jwt_signature(token)
    local jwt_lib = require("resty.jwt")
    local jwks, err = fetch_jwks()
    if not jwks then
        if not ALLOW_UNSIGNED_FALLBACK then
            return false, nil, err
        end
        ngx.log(ngx.WARN, "AUTH_ALLOW_UNSIGNED_FALLBACK=true，降级为仅解析 claims: ", err)
        local jwt_obj = jwt_lib:load_jwt(token)
        if not jwt_obj or not jwt_obj.valid then
            return false, nil, "Token 加载失败"
        end
        return true, jwt_obj.payload, nil
    end

    local validators = require("resty.jwt-validators")
    local claim_spec = {
        exp = validators.is_not_expired(),
    }
    local jwt_obj = jwt_lib:verify_jwt_obj(jwks, jwt_lib:load_jwt(token), claim_spec)
    if not jwt_obj or not jwt_obj.verified then
        local reason = jwt_obj and jwt_obj.reason or "未知错误"
        return false, nil, "Token 验证失败: " .. reason
    end
    return true, jwt_obj.payload, nil
end

local function audience_matches(payload)
    if EXPECTED_AUDIENCE == "" then
        return true
    end
    if payload.aud == EXPECTED_AUDIENCE then
        return true
    end
    if type(payload.aud) == "table" then
        for _, item in ipairs(payload.aud) do
            if item == EXPECTED_AUDIENCE then
                return true
            end
        end
    end
    return false
end

local function validate_claims(payload)
    local now = ngx.time()
    if payload.exp and payload.exp < now then
        return false, "Token 已过期"
    end
    if payload.nbf and payload.nbf > now then
        return false, "Token 尚未生效"
    end
    if payload.iat and payload.iat > (now + 300) then
        return false, "Token 签发时间异常"
    end
    if EXPECTED_ISSUER ~= "" and payload.iss and payload.iss ~= EXPECTED_ISSUER then
        return false, "Token issuer 不匹配"
    end
    if not audience_matches(payload) then
        return false, "Token audience 不匹配"
    end
    return true, nil
end

local function apply_user_headers(user_info)
    ngx.req.set_header("X-User-ID", user_info.sub or "")
    ngx.req.set_header("X-User-Name", user_info.preferred_username or "")
    if user_info.tenant_id and user_info.tenant_id ~= "" then
        ngx.req.set_header("X-Tenant-ID", user_info.tenant_id)
    end
end

function _M.verify_request()
    local token, err = extract_token()
    if not token then
        return false, err
    end

    local cache_key = "token:" .. ngx.md5(token)
    local cached = auth_cache:get(cache_key)
    if cached then
        local user_info = cjson.decode(cached)
        if user_info then
            apply_user_headers(user_info)
            return true, nil
        end
    end

    local _, payload, decode_err = decode_jwt_parts(token)
    if decode_err then
        return false, decode_err
    end

    local ok, claim_err = validate_claims(payload)
    if not ok then
        return false, claim_err
    end

    local verified, verified_payload, verify_err = verify_jwt_signature(token)
    if not verified then
        return false, verify_err
    end

    local final_payload = verified_payload or payload
    local user_info = {
        sub = final_payload.sub or "",
        preferred_username = final_payload.preferred_username or "",
        email = final_payload.email or "",
        tenant_id = final_payload.tenant_id or final_payload.azp or "",
    }
    apply_user_headers(user_info)
    auth_cache:set(cache_key, cjson.encode(user_info), TOKEN_CACHE_TTL)
    return true, nil
end

return _M
