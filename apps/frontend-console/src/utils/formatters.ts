/**
 * 格式化工具函数
 * 提供各种数据格式化功能
 */

/**
 * 格式化字节数为人类可读的格式
 * @param bytes - 字节数
 * @param decimals - 小数位数，默认为2
 * @returns 格式化后的字符串，如 "1.5 MB"
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return '-' + formatBytes(-bytes, decimals);

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${parseFloat(value.toFixed(dm))} ${sizes[i]}`;
}

/**
 * 格式化持续时间（毫秒）为人类可读的格式
 * @param ms - 毫秒数
 * @returns 格式化后的字符串，如 "2h 30m" 或 "500ms"
 */
export function formatDuration(ms: number): string {
  if (ms < 0) return '-' + formatDuration(-ms);
  if (ms === 0) return '0ms';

  const units = [
    { label: 'd', value: 86400000 },
    { label: 'h', value: 3600000 },
    { label: 'm', value: 60000 },
    { label: 's', value: 1000 },
    { label: 'ms', value: 1 },
  ];

  for (const unit of units) {
    if (ms >= unit.value) {
      const value = ms / unit.value;
      if (value >= 1) {
        return `${Math.floor(value)}${unit.label}`;
      }
    }
  }

  return `${ms}ms`;
}

/**
 * 格式化时间戳为本地时间字符串
 * @param timestamp - Unix 时间戳（毫秒）
 * @param options - Intl.DateTimeFormat 选项
 * @returns 格式化后的时间字符串
 */
export function formatTimestamp(
  timestamp: number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }
): string {
  return new Intl.DateTimeFormat('zh-CN', options).format(new Date(timestamp));
}

/**
 * 格式化相对时间（如 "3分钟前"）
 * @param timestamp - Unix 时间戳（毫秒）
 * @returns 相对时间字符串
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 0) {
    return '刚刚';
  }

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years}年前`;
  if (months > 0) return `${months}个月前`;
  if (weeks > 0) return `${weeks}周前`;
  if (days > 0) return `${days}天前`;
  if (hours > 0) return `${hours}小时前`;
  if (minutes > 0) return `${minutes}分钟前`;
  if (seconds > 10) return `${seconds}秒前`;
  return '刚刚';
}

/**
 * 格式化数字为带千分位分隔符的字符串
 * @param num - 数字
 * @param decimals - 小数位数
 * @returns 格式化后的字符串，如 "1,234,567.89"
 */
export function formatNumber(num: number, decimals?: number): string {
  const options: Intl.NumberFormatOptions = {};
  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals;
    options.maximumFractionDigits = decimals;
  }
  return new Intl.NumberFormat('zh-CN', options).format(num);
}

/**
 * 格式化数字为紧凑格式（如 1.2K, 3.4M）
 * @param num - 数字
 * @returns 格式化后的字符串
 */
export function formatCompactNumber(num: number): string {
  if (num < 0) return '-' + formatCompactNumber(-num);
  if (num === 0) return '0';

  const units = [
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ];

  for (const unit of units) {
    if (num >= unit.value) {
      const value = num / unit.value;
      return `${value >= 10 ? Math.floor(value) : value.toFixed(1)}${unit.suffix}`;
    }
  }

  return num.toString();
}

/**
 * 格式化百分比
 * @param value - 小数值（如 0.1234 表示 12.34%）
 * @param decimals - 小数位数，默认为2
 * @returns 格式化后的百分比字符串
 */
export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 截断字符串并添加省略号
 * @param str - 原始字符串
 * @param maxLength - 最大长度
 * @returns 截断后的字符串
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * 格式化文件名（截断中间部分）
 * @param filename - 文件名
 * @param maxLength - 最大长度
 * @returns 格式化后的文件名
 */
export function formatFilename(filename: string, maxLength: number = 30): string {
  if (filename.length <= maxLength) return filename;

  const ext = filename.lastIndexOf('.') > 0 ? filename.slice(filename.lastIndexOf('.')) : '';
  const name = filename.slice(0, filename.length - ext.length);
  const keepLength = Math.floor((maxLength - 3 - ext.length) / 2);

  return `${name.slice(0, keepLength)}...${name.slice(-keepLength)}${ext}`;
}
