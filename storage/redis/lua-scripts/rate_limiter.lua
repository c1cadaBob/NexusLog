-- NexusLog Redis 限流 Lua 脚本（滑动窗口算法）
-- 用于 API 请求限流

local key = KEYS[1]           -- 限流 key（如 rate:user:<user_id>）
local limit = tonumber(ARGV[1])  -- 窗口内最大请求数
local window = tonumber(ARGV[2]) -- 窗口大小（秒）
local now = tonumber(ARGV[3])    -- 当前时间戳（毫秒）

-- 清除窗口外的旧记录
local window_start = now - (window * 1000)
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- 获取当前窗口内的请求数
local current = redis.call('ZCARD', key)

if current < limit then
    -- 未超限，记录本次请求
    redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
    redis.call('PEXPIRE', key, window * 1000)
    return 1  -- 允许
else
    return 0  -- 拒绝
end
