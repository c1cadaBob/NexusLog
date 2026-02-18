/**
 * 输入清理工具函数
 * 用于防止 XSS 攻击，清理用户输入中的危险内容
 */

// HTML 实体映射表
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

// 危险的 HTML 标签（黑名单）
const DANGEROUS_TAGS = [
  'script',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'style',
  'link',
  'meta',
  'base',
  'applet',
  'frame',
  'frameset',
  'layer',
  'ilayer',
  'bgsound',
  'title',
  'head',
  'html',
  'body',
  'xml',
  'blink',
  'marquee',
];

// 危险的属性（黑名单）
const DANGEROUS_ATTRIBUTES = [
  'onclick',
  'ondblclick',
  'onmousedown',
  'onmouseup',
  'onmouseover',
  'onmousemove',
  'onmouseout',
  'onmouseenter',
  'onmouseleave',
  'onkeydown',
  'onkeypress',
  'onkeyup',
  'onload',
  'onerror',
  'onabort',
  'onblur',
  'onchange',
  'onfocus',
  'onreset',
  'onsubmit',
  'onunload',
  'onbeforeunload',
  'onresize',
  'onscroll',
  'ondrag',
  'ondragend',
  'ondragenter',
  'ondragleave',
  'ondragover',
  'ondragstart',
  'ondrop',
  'oncontextmenu',
  'oncopy',
  'oncut',
  'onpaste',
  'oninput',
  'oninvalid',
  'onsearch',
  'onselect',
  'onwheel',
  'ontouchstart',
  'ontouchmove',
  'ontouchend',
  'ontouchcancel',
  'onanimationstart',
  'onanimationend',
  'onanimationiteration',
  'ontransitionend',
  'formaction',
  'xlink:href',
  'xmlns',
];

// 危险的 URL 协议
const DANGEROUS_PROTOCOLS = [
  'javascript:',
  'vbscript:',
  'data:',
  'file:',
];

/**
 * 转义 HTML 特殊字符
 * @param str - 要转义的字符串
 * @returns 转义后的字符串
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * 反转义 HTML 实体
 * @param str - 要反转义的字符串
 * @returns 反转义后的字符串
 */
export function unescapeHtml(str: string): string {
  if (typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#x60;/g, '`')
    .replace(/&#x3D;/g, '=');
}

/**
 * 移除危险的 HTML 标签
 * @param html - 要清理的 HTML 字符串
 * @returns 清理后的字符串
 */
export function stripDangerousTags(html: string): string {
  if (typeof html !== 'string') {
    return '';
  }
  
  let result = html;
  
  // 移除危险标签及其内容
  for (const tag of DANGEROUS_TAGS) {
    // 移除开始和结束标签之间的内容
    const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
    result = result.replace(regex, '');
    
    // 移除自闭合标签
    const selfClosingRegex = new RegExp(`<${tag}[^>]*\\/?>`, 'gi');
    result = result.replace(selfClosingRegex, '');
  }
  
  return result;
}

/**
 * 移除危险的属性
 * @param html - 要清理的 HTML 字符串
 * @returns 清理后的字符串
 */
export function stripDangerousAttributes(html: string): string {
  if (typeof html !== 'string') {
    return '';
  }
  
  let result = html;
  
  // 移除事件处理器和危险属性
  for (const attr of DANGEROUS_ATTRIBUTES) {
    // 匹配属性及其值（支持单引号、双引号和无引号）
    const regex = new RegExp(`\\s*${attr}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)`, 'gi');
    result = result.replace(regex, '');
  }
  
  // 移除 javascript: 等危险协议
  for (const protocol of DANGEROUS_PROTOCOLS) {
    const escapedProtocol = protocol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(href|src|action)\\s*=\\s*["']?\\s*${escapedProtocol}`, 'gi');
    result = result.replace(regex, '$1=""');
  }
  
  return result;
}

/**
 * 清理选项接口
 */
export interface SanitizeOptions {
  /** 是否允许安全的 HTML 标签 */
  allowTags?: boolean;
  /** 是否移除所有 HTML 标签 */
  stripTags?: boolean;
  /** 是否转义输出 */
  escapeOutput?: boolean;
}

/**
 * 清理 HTML 字符串，移除所有危险内容
 * 这是主要的清理函数，应用于所有用户输入
 * @param html - 要清理的 HTML 字符串
 * @param options - 清理选项
 * @returns 清理后的安全字符串
 */
export function sanitizeHtml(
  html: string,
  options: SanitizeOptions = {}
): string {
  const {
    allowTags = false,
    stripTags = true,
    escapeOutput = true,
  } = options;
  
  if (typeof html !== 'string') {
    return '';
  }
  
  // 如果输入为空，直接返回
  if (!html.trim()) {
    return html;
  }
  
  let result = html;
  
  // 移除 null 字节和其他控制字符
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  if (allowTags) {
    // 允许部分标签，但移除危险内容
    result = stripDangerousTags(result);
    result = stripDangerousAttributes(result);
  } else if (stripTags) {
    // 移除所有 HTML 标签
    result = result.replace(/<[^>]*>/g, '');
  }
  
  if (escapeOutput && !allowTags) {
    // 转义特殊字符
    result = escapeHtml(result);
  }
  
  return result;
}

/**
 * 清理用户输入（用于表单字段）
 * 移除所有 HTML 并转义特殊字符
 * @param input - 用户输入
 * @returns 清理后的输入
 */
export function sanitizeInput(input: string): string {
  return sanitizeHtml(input, {
    allowTags: false,
    stripTags: true,
    escapeOutput: true,
  });
}

/**
 * 清理富文本内容
 * 允许安全的 HTML 标签，但移除危险内容
 * @param html - 富文本 HTML
 * @returns 清理后的 HTML
 */
export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, {
    allowTags: true,
    stripTags: false,
    escapeOutput: false,
  });
}

/**
 * 清理 URL
 * 移除危险协议，确保 URL 安全
 * @param url - 要清理的 URL
 * @returns 清理后的 URL
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    return '';
  }
  
  const trimmedUrl = url.trim().toLowerCase();
  
  // 检查危险协议
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (trimmedUrl.startsWith(protocol)) {
      return '';
    }
  }
  
  // 移除控制字符
  return url.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * 清理文件名
 * 移除路径遍历字符和危险字符
 * @param filename - 文件名
 * @returns 清理后的文件名
 */
export function sanitizeFilename(filename: string): string {
  if (typeof filename !== 'string') {
    return '';
  }
  
  return filename
    // 移除路径分隔符
    .replace(/[/\\]/g, '')
    // 移除路径遍历
    .replace(/\.\./g, '')
    // 移除控制字符
    .replace(/[\x00-\x1F\x7F]/g, '')
    // 移除 Windows 保留字符
    .replace(/[<>:"|?*]/g, '')
    // 限制长度
    .slice(0, 255);
}

/**
 * 清理 JSON 字符串
 * 确保 JSON 可以安全解析
 * @param json - JSON 字符串
 * @returns 清理后的 JSON 字符串
 */
export function sanitizeJson(json: string): string {
  if (typeof json !== 'string') {
    return '';
  }
  
  // 移除 BOM 和控制字符
  return json
    .replace(/^\uFEFF/, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * 检查字符串是否包含潜在的 XSS 攻击
 * @param str - 要检查的字符串
 * @returns 是否包含危险内容
 */
export function containsXss(str: string): boolean {
  if (typeof str !== 'string') {
    return false;
  }
  
  const lowerStr = str.toLowerCase();
  
  // 检查危险标签
  for (const tag of DANGEROUS_TAGS) {
    if (lowerStr.includes(`<${tag}`)) {
      return true;
    }
  }
  
  // 检查事件处理器
  for (const attr of DANGEROUS_ATTRIBUTES) {
    if (lowerStr.includes(attr)) {
      return true;
    }
  }
  
  // 检查危险协议
  for (const protocol of DANGEROUS_PROTOCOLS) {
    if (lowerStr.includes(protocol)) {
      return true;
    }
  }
  
  return false;
}

// 导出常量供测试使用
export const SANITIZE_CONSTANTS = {
  HTML_ENTITIES,
  DANGEROUS_TAGS,
  DANGEROUS_ATTRIBUTES,
  DANGEROUS_PROTOCOLS,
};
