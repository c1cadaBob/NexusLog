-- NexusLog API Gateway - 认证辅助模块
-- 提供可复用的认证函数，供 tenant_router.lua 等脚本调用
-- change_level: cab（涉及认证鉴权链路）

local cjson = require("cjson.safe")
local auth_cache = ngx.shared.auth_cache

local _M = {}

local AUTH_HEADER = "Authorization"
local BEARER_PREFIX = "Bearer "
local TOKEN_CACHE_TTL = 300

--- Base64URL 解码
local function base64url_decode(input)
    local remainder = #input % 4
    if remainder > 0 then
        input = input .. string.rep("=", 4 - remainder)
    end
    input = input:gsub("-", "+"):gsub("_", "/")
    return ngx.decode_base64(input)
end

--- 解析 JWT Payload
local function decode_jwt_payload(token)
    local parts = {}
    for part in string.gmatch(token, "[^%.]+") do
        table.insert(parts, part)
    end

    if #parts ~= 3 then
        return nil, "Token 格式无效"
    end

    local payload_json = base64url_decode(parts[2])
    if not payload_json then
        return nil, "Token 解码失败"
    end

    local payload = cjson.decode(payload_json)
    if not payload then
        return nil, "Token JSON 解析失败"
    end

    return payload, nil
end

--- 验证请求中的 Token
--- @return boolean 是否通过验证
--- @return string|nil 错误信息
function _M.verify_request()
    local auth_header = ngx.req.get_headers()[AUTH_HEADER]
    if not auth_header then
        return false, "缺少 Authorization 请求头"
    end

    if string.sub(auth_header, 1, #BEARER_PREFIX) ~= BEARER_PREFIX then
        return false, "Authorization 格式错误"
    end

    local token = string.sub(auth_header, #BEARER_PREFIX + 1)
    if not token or token == "" then
        return false, "Token 为空"
    end

    -- 查缓存
    local cache_key = "token:" .. ngx.md5(token)
    local cached = auth_cache:get(cache_key)
    if cached then
        local user_info = cjson.decode(cached)
        if user_info then
            -- 设置用户信息头
            ngx.req.set_header("X-User-ID", user_info.sub or "")
            ngx.req.set_header("X-User-Name", user_info.preferred_username or "")
            return true, nil
        end
    end

    -- 解析并校验 Token
    local payload, err = decode_jwt_payload(token)
    if not payload then
        return false, err
    end

    -- 检查过期时间
    local now = ngx.time()
    if payload.exp and payload.exp < now then
        return false, "Token 已过期"
    end

    -- 设置用户信息头
    ngx.req.set_header("X-User-ID", payload.sub or "")
    ngx.req.set_header("X-User-Name", payload.preferred_username or "")

    -- 缓存
    local user_info = {
        sub = payload.sub or "",
        preferred_username = payload.preferred_username or "",
        email = payload.email or "",
        tenant_id = payload.tenant_id or payload.azp or "",
    }
    auth_cache:set(cache_key, cjson.encode(user_info), TOKEN_CACHE_TTL)

    return true, nil
end

return _M
