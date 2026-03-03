/**
 * 客户端 ID 工具：
 * 1) 优先使用 Web Crypto（randomUUID / getRandomValues）
 * 2) 不可用时降级为 Math.random，避免在非安全上下文（http + 非 localhost）下崩溃
 */

/**
 * 生成随机字节；在不支持 crypto.getRandomValues 的环境下自动降级。
 */
function getRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
    return bytes;
  }

  for (let i = 0; i < size; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return bytes;
}

/**
 * 生成 UUID v4（带兼容降级）。
 */
function createUuidV4(): string {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = getRandomBytes(16);
  // UUID v4 版本位与变体位
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * 生成业务 ID；可选前缀用于区分来源（如 notice / alert）。
 */
export function createClientId(prefix?: string): string {
  const uuid = createUuidV4();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

/**
 * 生成短 ID（用于 trace/span 等展示字段）。
 */
export function createShortId(length = 8): string {
  const safeLength = Math.max(1, Math.floor(length));
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = getRandomBytes(safeLength);
  let result = '';

  for (let i = 0; i < safeLength; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

