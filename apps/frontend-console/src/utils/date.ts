/**
 * 日期工具函数
 * 提供日期和时间相关的实用函数
 */

/**
 * 时间范围类型
 */
export interface TimeRange {
  start: number;
  end: number;
  relative?: string;
}

/**
 * 预设时间范围选项
 */
export type PresetTimeRange =
  | 'last-5m'
  | 'last-15m'
  | 'last-30m'
  | 'last-1h'
  | 'last-3h'
  | 'last-6h'
  | 'last-12h'
  | 'last-24h'
  | 'last-2d'
  | 'last-7d'
  | 'last-30d'
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'this-month'
  | 'last-month';

/**
 * 预设时间范围配置
 */
export const PRESET_TIME_RANGES: Record<PresetTimeRange, { label: string; getValue: () => TimeRange }> = {
  'last-5m': {
    label: '最近 5 分钟',
    getValue: () => ({
      start: Date.now() - 5 * 60 * 1000,
      end: Date.now(),
      relative: 'last-5m',
    }),
  },
  'last-15m': {
    label: '最近 15 分钟',
    getValue: () => ({
      start: Date.now() - 15 * 60 * 1000,
      end: Date.now(),
      relative: 'last-15m',
    }),
  },
  'last-30m': {
    label: '最近 30 分钟',
    getValue: () => ({
      start: Date.now() - 30 * 60 * 1000,
      end: Date.now(),
      relative: 'last-30m',
    }),
  },
  'last-1h': {
    label: '最近 1 小时',
    getValue: () => ({
      start: Date.now() - 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-1h',
    }),
  },
  'last-3h': {
    label: '最近 3 小时',
    getValue: () => ({
      start: Date.now() - 3 * 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-3h',
    }),
  },
  'last-6h': {
    label: '最近 6 小时',
    getValue: () => ({
      start: Date.now() - 6 * 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-6h',
    }),
  },
  'last-12h': {
    label: '最近 12 小时',
    getValue: () => ({
      start: Date.now() - 12 * 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-12h',
    }),
  },
  'last-24h': {
    label: '最近 24 小时',
    getValue: () => ({
      start: Date.now() - 24 * 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-24h',
    }),
  },
  'last-2d': {
    label: '最近 2 天',
    getValue: () => ({
      start: Date.now() - 2 * 24 * 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-2d',
    }),
  },
  'last-7d': {
    label: '最近 7 天',
    getValue: () => ({
      start: Date.now() - 7 * 24 * 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-7d',
    }),
  },
  'last-30d': {
    label: '最近 30 天',
    getValue: () => ({
      start: Date.now() - 30 * 24 * 60 * 60 * 1000,
      end: Date.now(),
      relative: 'last-30d',
    }),
  },
  'today': {
    label: '今天',
    getValue: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      return { start, end: Date.now(), relative: 'today' };
    },
  },
  'yesterday': {
    label: '昨天',
    getValue: () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
      return { start: yesterdayStart, end: todayStart - 1, relative: 'yesterday' };
    },
  },
  'this-week': {
    label: '本周',
    getValue: () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // 周一为一周开始
      const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).getTime();
      return { start: weekStart, end: Date.now(), relative: 'this-week' };
    },
  },
  'last-week': {
    label: '上周',
    getValue: () => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const thisWeekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).getTime();
      const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;
      return { start: lastWeekStart, end: thisWeekStart - 1, relative: 'last-week' };
    },
  },
  'this-month': {
    label: '本月',
    getValue: () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      return { start: monthStart, end: Date.now(), relative: 'this-month' };
    },
  },
  'last-month': {
    label: '上月',
    getValue: () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
      return { start: lastMonthStart, end: thisMonthStart - 1, relative: 'last-month' };
    },
  },
};

/**
 * 获取预设时间范围
 * @param preset - 预设时间范围类型
 * @returns 时间范围对象
 */
export function getPresetTimeRange(preset: PresetTimeRange): TimeRange {
  return PRESET_TIME_RANGES[preset].getValue();
}

/**
 * 获取一天的开始时间（00:00:00）
 * @param date - 日期
 * @returns 时间戳
 */
export function getStartOfDay(date: Date | number): number {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * 获取一天的结束时间（23:59:59.999）
 * @param date - 日期
 * @returns 时间戳
 */
export function getEndOfDay(date: Date | number): number {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

/**
 * 获取一周的开始时间（周一 00:00:00）
 * @param date - 日期
 * @returns 时间戳
 */
export function getStartOfWeek(date: Date | number): number {
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff).getTime();
}

/**
 * 获取一月的开始时间
 * @param date - 日期
 * @returns 时间戳
 */
export function getStartOfMonth(date: Date | number): number {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

/**
 * 添加时间
 * @param date - 基准日期
 * @param amount - 数量
 * @param unit - 单位
 * @returns 新的时间戳
 */
export function addTime(
  date: Date | number,
  amount: number,
  unit: 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'M' | 'y'
): number {
  const d = new Date(date);

  switch (unit) {
    case 'ms':
      return d.getTime() + amount;
    case 's':
      return d.getTime() + amount * 1000;
    case 'm':
      return d.getTime() + amount * 60 * 1000;
    case 'h':
      return d.getTime() + amount * 60 * 60 * 1000;
    case 'd':
      return d.getTime() + amount * 24 * 60 * 60 * 1000;
    case 'w':
      return d.getTime() + amount * 7 * 24 * 60 * 60 * 1000;
    case 'M':
      return new Date(d.getFullYear(), d.getMonth() + amount, d.getDate()).getTime();
    case 'y':
      return new Date(d.getFullYear() + amount, d.getMonth(), d.getDate()).getTime();
    default:
      return d.getTime();
  }
}

/**
 * 计算两个日期之间的差值
 * @param date1 - 日期1
 * @param date2 - 日期2
 * @param unit - 单位
 * @returns 差值
 */
export function dateDiff(
  date1: Date | number,
  date2: Date | number,
  unit: 'ms' | 's' | 'm' | 'h' | 'd' = 'ms'
): number {
  const diff = new Date(date1).getTime() - new Date(date2).getTime();

  switch (unit) {
    case 'ms':
      return diff;
    case 's':
      return Math.floor(diff / 1000);
    case 'm':
      return Math.floor(diff / (60 * 1000));
    case 'h':
      return Math.floor(diff / (60 * 60 * 1000));
    case 'd':
      return Math.floor(diff / (24 * 60 * 60 * 1000));
    default:
      return diff;
  }
}

/**
 * 判断是否为同一天
 * @param date1 - 日期1
 * @param date2 - 日期2
 * @returns 是否为同一天
 */
export function isSameDay(date1: Date | number, date2: Date | number): boolean {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

/**
 * 格式化日期为 ISO 字符串（本地时区）
 * @param date - 日期
 * @returns ISO 格式字符串
 */
export function toLocalISOString(date: Date | number): string {
  const d = new Date(date);
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - offset * 60 * 1000);
  return localDate.toISOString().slice(0, -1);
}

/**
 * 解析相对时间字符串
 * @param relativeTime - 相对时间字符串（如 "5m", "1h", "7d"）
 * @returns 毫秒数
 */
export function parseRelativeTime(relativeTime: string): number {
  const match = relativeTime.match(/^(\d+)(ms|s|m|h|d|w|M|y)$/);
  if (!match || !match[1]) return 0;

  const amount = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    case 'w':
      return amount * 7 * 24 * 60 * 60 * 1000;
    case 'M':
      return amount * 30 * 24 * 60 * 60 * 1000; // 近似值
    case 'y':
      return amount * 365 * 24 * 60 * 60 * 1000; // 近似值
    default:
      return 0;
  }
}
