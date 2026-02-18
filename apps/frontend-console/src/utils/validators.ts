/**
 * 验证工具函数
 * 提供各种数据验证功能
 */

/**
 * 验证规则接口
 */
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
  message?: string;
}

/**
 * 验证规则集合
 */
export interface ValidationRules {
  [field: string]: ValidationRule;
}

/**
 * 验证错误集合
 */
export interface ValidationErrors {
  [field: string]: string;
}

/**
 * 验证表单数据
 * @param values - 表单值对象
 * @param rules - 验证规则对象
 * @returns 验证错误对象，如果没有错误则为空对象
 */
export function validateForm(
  values: Record<string, unknown>,
  rules: ValidationRules
): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = values[field];
    const error = validateField(value, rule);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

/**
 * 验证单个字段
 * @param value - 字段值
 * @param rule - 验证规则
 * @returns 错误消息，如果验证通过则返回 null
 */
export function validateField(value: unknown, rule: ValidationRule): string | null {
  // 必填验证
  if (rule.required) {
    if (value === undefined || value === null || value === '') {
      return rule.message || '此字段为必填项';
    }
  }

  // 如果值为空且非必填，跳过其他验证
  if (value === undefined || value === null || value === '') {
    return null;
  }

  // 字符串长度验证
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return rule.message || `最少需要 ${rule.minLength} 个字符`;
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return rule.message || `最多允许 ${rule.maxLength} 个字符`;
    }
  }

  // 数字范围验证
  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return rule.message || `最小值为 ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return rule.message || `最大值为 ${rule.max}`;
    }
  }

  // 正则表达式验证
  if (rule.pattern && typeof value === 'string') {
    if (!rule.pattern.test(value)) {
      return rule.message || '格式不正确';
    }
  }

  // 自定义验证
  if (rule.custom) {
    const customError = rule.custom(value);
    if (customError) {
      return customError;
    }
  }

  return null;
}

/**
 * 常用验证模式
 */
export const validationPatterns = {
  /** 邮箱地址 */
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  
  /** URL 地址 */
  url: /^https?:\/\/.+/,
  
  /** IPv4 地址 */
  ipv4: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  
  /** IPv6 地址 */
  ipv6: /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/,
  
  /** 端口号 (1-65535) */
  port: /^([1-9]|[1-9]\d{1,3}|[1-5]\d{4}|6[0-4]\d{3}|65[0-4]\d{2}|655[0-2]\d|6553[0-5])$/,
  
  /** 字母数字 */
  alphanumeric: /^[a-zA-Z0-9]+$/,
  
  /** 用户名 (字母开头，允许字母数字下划线，3-20位) */
  username: /^[a-zA-Z][a-zA-Z0-9_]{2,19}$/,
  
  /** 密码 (至少8位，包含大小写字母和数字) */
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
  
  /** 手机号 (中国大陆) */
  phone: /^1[3-9]\d{9}$/,
  
  /** 身份证号 (中国大陆) */
  idCard: /^[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/,
  
  /** 十六进制颜色 */
  hexColor: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
  
  /** JSON 字符串 */
  json: /^[\s]*(\{[\s\S]*\}|\[[\s\S]*\])[\s]*$/,
  
  /** 域名 */
  domain: /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
};

/**
 * 验证邮箱地址
 */
export function isValidEmail(email: string): boolean {
  return validationPatterns.email.test(email);
}

/**
 * 验证 URL
 */
export function isValidUrl(url: string): boolean {
  return validationPatterns.url.test(url);
}

/**
 * 验证 IPv4 地址
 */
export function isValidIPv4(ip: string): boolean {
  return validationPatterns.ipv4.test(ip);
}

/**
 * 验证端口号
 */
export function isValidPort(port: string | number): boolean {
  const portStr = String(port);
  return validationPatterns.port.test(portStr);
}

/**
 * 验证 JSON 字符串
 */
export function isValidJson(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查值是否为空
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * 检查值是否为数字
 */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'string') return !isNaN(Number(value)) && value.trim() !== '';
  return false;
}


// ============================================================================
// 登录表单验证
// ============================================================================

/**
 * 登录表单数据接口
 */
export interface LoginFormData {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * 登录表单验证错误接口
 */
export interface LoginFormErrors {
  username?: string;
  password?: string;
}

/**
 * 验证登录表单
 * 对用户名和密码进行空值验证，并对输入值进行 trim 处理
 * 
 * @param data - 登录表单数据
 * @returns 验证错误对象，如果没有错误则为空对象
 * 
 * @example
 * const errors = validateLoginForm({ username: '  ', password: '' });
 * // errors = { username: '请输入用户名', password: '请输入密码' }
 */
export function validateLoginForm(data: LoginFormData): LoginFormErrors {
  const errors: LoginFormErrors = {};
  
  // 对用户名进行 trim 处理后验证
  const trimmedUsername = data.username.trim();
  if (!trimmedUsername) {
    errors.username = '请输入用户名';
  }
  
  // 对密码进行 trim 处理后验证
  const trimmedPassword = data.password.trim();
  if (!trimmedPassword) {
    errors.password = '请输入密码';
  }
  
  return errors;
}

/**
 * 检查登录表单是否有效
 * 
 * @param errors - 验证错误对象
 * @returns 如果没有错误则返回 true，否则返回 false
 * 
 * @example
 * const errors = validateLoginForm({ username: 'admin', password: '123456' });
 * const valid = isFormValid(errors); // true
 */
export function isFormValid(errors: LoginFormErrors): boolean {
  return Object.keys(errors).length === 0;
}

// ============================================================================
// 增强验证规则
// ============================================================================

/**
 * 增强验证规则接口
 */
export interface EnhancedValidationRule extends ValidationRule {
  /** 邮箱验证 */
  email?: boolean;
  /** URL 验证 */
  url?: boolean;
  /** IPv4 验证 */
  ipv4?: boolean;
  /** IPv6 验证 */
  ipv6?: boolean;
  /** 端口验证 */
  port?: boolean;
  /** 域名验证 */
  domain?: boolean;
  /** 手机号验证 */
  phone?: boolean;
  /** 字母数字验证 */
  alphanumeric?: boolean;
  /** 十六进制颜色验证 */
  hexColor?: boolean;
  /** JSON 验证 */
  json?: boolean;
  /** 确认字段（用于密码确认等） */
  confirm?: string;
  /** 数组最小长度 */
  minItems?: number;
  /** 数组最大长度 */
  maxItems?: number;
}

/**
 * 增强验证规则集合
 */
export interface EnhancedValidationRules {
  [field: string]: EnhancedValidationRule;
}

/**
 * 增强表单验证
 * 支持更多内置验证类型
 * 
 * @param values - 表单值对象
 * @param rules - 增强验证规则对象
 * @returns 验证错误对象
 */
export function validateFormEnhanced(
  values: Record<string, unknown>,
  rules: EnhancedValidationRules
): ValidationErrors {
  const errors: ValidationErrors = {};

  for (const [field, rule] of Object.entries(rules)) {
    const value = values[field];
    const error = validateFieldEnhanced(value, rule, values);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
}

/**
 * 增强字段验证
 * 
 * @param value - 字段值
 * @param rule - 增强验证规则
 * @param allValues - 所有表单值（用于确认字段验证）
 * @returns 错误消息或 null
 */
export function validateFieldEnhanced(
  value: unknown,
  rule: EnhancedValidationRule,
  allValues?: Record<string, unknown>
): string | null {
  // 基础验证
  const baseError = validateField(value, rule);
  if (baseError) return baseError;

  // 如果值为空且非必填，跳过其他验证
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const strValue = typeof value === 'string' ? value : String(value);

  // 邮箱验证
  if (rule.email && !validationPatterns.email.test(strValue)) {
    return rule.message || '请输入有效的邮箱地址';
  }

  // URL 验证
  if (rule.url && !validationPatterns.url.test(strValue)) {
    return rule.message || '请输入有效的 URL 地址';
  }

  // IPv4 验证
  if (rule.ipv4 && !validationPatterns.ipv4.test(strValue)) {
    return rule.message || '请输入有效的 IPv4 地址';
  }

  // IPv6 验证
  if (rule.ipv6 && !validationPatterns.ipv6.test(strValue)) {
    return rule.message || '请输入有效的 IPv6 地址';
  }

  // 端口验证
  if (rule.port && !validationPatterns.port.test(strValue)) {
    return rule.message || '请输入有效的端口号 (1-65535)';
  }

  // 域名验证
  if (rule.domain && !validationPatterns.domain.test(strValue)) {
    return rule.message || '请输入有效的域名';
  }

  // 手机号验证
  if (rule.phone && !validationPatterns.phone.test(strValue)) {
    return rule.message || '请输入有效的手机号';
  }

  // 字母数字验证
  if (rule.alphanumeric && !validationPatterns.alphanumeric.test(strValue)) {
    return rule.message || '只能包含字母和数字';
  }

  // 十六进制颜色验证
  if (rule.hexColor && !validationPatterns.hexColor.test(strValue)) {
    return rule.message || '请输入有效的十六进制颜色值';
  }

  // JSON 验证
  if (rule.json && !isValidJson(strValue)) {
    return rule.message || '请输入有效的 JSON 格式';
  }

  // 确认字段验证
  if (rule.confirm && allValues) {
    const confirmValue = allValues[rule.confirm];
    if (value !== confirmValue) {
      return rule.message || '两次输入不一致';
    }
  }

  // 数组长度验证
  if (Array.isArray(value)) {
    if (rule.minItems !== undefined && value.length < rule.minItems) {
      return rule.message || `至少需要选择 ${rule.minItems} 项`;
    }
    if (rule.maxItems !== undefined && value.length > rule.maxItems) {
      return rule.message || `最多只能选择 ${rule.maxItems} 项`;
    }
  }

  return null;
}

// ============================================================================
// 便捷验证规则创建器
// ============================================================================

/**
 * 创建必填规则
 */
export function required(message?: string): ValidationRule {
  return { required: true, message: message || '此字段为必填项' };
}

/**
 * 创建邮箱规则
 */
export function email(message?: string): EnhancedValidationRule {
  return { email: true, message: message || '请输入有效的邮箱地址' };
}

/**
 * 创建 URL 规则
 */
export function url(message?: string): EnhancedValidationRule {
  return { url: true, message: message || '请输入有效的 URL 地址' };
}

/**
 * 创建最小长度规则
 */
export function minLength(length: number, message?: string): ValidationRule {
  return { minLength: length, message: message || `最少需要 ${length} 个字符` };
}

/**
 * 创建最大长度规则
 */
export function maxLength(length: number, message?: string): ValidationRule {
  return { maxLength: length, message: message || `最多允许 ${length} 个字符` };
}

/**
 * 创建数值范围规则
 */
export function range(min: number, max: number, message?: string): ValidationRule {
  return { min, max, message: message || `值必须在 ${min} 到 ${max} 之间` };
}

/**
 * 创建正则表达式规则
 */
export function pattern(regex: RegExp, message?: string): ValidationRule {
  return { pattern: regex, message: message || '格式不正确' };
}

/**
 * 组合多个验证规则
 */
export function compose(...rules: ValidationRule[]): ValidationRule {
  return {
    custom: (value: unknown) => {
      for (const rule of rules) {
        const error = validateField(value, rule);
        if (error) return error;
      }
      return null;
    }
  };
}

/**
 * 检查通用验证错误对象是否有效（无错误）
 */
export function hasNoErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length === 0;
}
