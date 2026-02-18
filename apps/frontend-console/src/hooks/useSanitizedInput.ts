/**
 * 输入清理 Hook
 * 用于在表单输入中自动应用输入清理
 * 
 * @module hooks/useSanitizedInput
 */

import { useState, useCallback, useMemo } from 'react';
import { sanitizeInput, sanitizeUrl, containsXss } from '@/utils/sanitize';

// ============================================================================
// 类型定义
// ============================================================================

export interface SanitizeInputOptions {
  type?: 'text' | 'url' | 'email' | 'search' | 'rich';
  sanitizeOnChange?: boolean;
  sanitizeOnBlur?: boolean;
  maxLength?: number;
  customSanitizer?: (value: string) => string;
}

export interface SanitizedInputState {
  rawValue: string;
  sanitizedValue: string;
  hasXss: boolean;
  wasSanitized: boolean;
}

export interface UseSanitizedInputReturn {
  value: string;
  sanitizedValue: string;
  hasXss: boolean;
  wasSanitized: boolean;
  setValue: (value: string) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur: () => void;
  reset: () => void;
  getSanitizedValue: () => string;
}


// ============================================================================
// 辅助函数
// ============================================================================

function getSanitizer(type: SanitizeInputOptions['type']) {
  switch (type) {
    case 'url': return sanitizeUrl;
    case 'email': return (value: string) => {
      const sanitized = sanitizeInput(value);
      return sanitized.replace(/&amp;/g, '&').replace(/&#x40;/g, '@');
    };
    default: return sanitizeInput;
  }
}

// ============================================================================
// Hook 实现
// ============================================================================

export function useSanitizedInput(
  initialValue: string = '',
  options: SanitizeInputOptions = {}
): UseSanitizedInputReturn {
  const {
    type = 'text',
    sanitizeOnChange = false,
    sanitizeOnBlur = true,
    maxLength,
    customSanitizer,
  } = options;

  const sanitizer = useMemo(() => customSanitizer || getSanitizer(type), [type, customSanitizer]);

  const [state, setState] = useState<SanitizedInputState>(() => {
    const sanitized = sanitizer(initialValue);
    return {
      rawValue: initialValue,
      sanitizedValue: sanitized,
      hasXss: containsXss(initialValue),
      wasSanitized: sanitized !== initialValue,
    };
  });

  const setValue = useCallback((value: string) => {
    let processedValue = value;
    if (maxLength && processedValue.length > maxLength) {
      processedValue = processedValue.slice(0, maxLength);
    }
    const hasXss = containsXss(processedValue);
    
    if (sanitizeOnChange) {
      const sanitized = sanitizer(processedValue);
      setState({ rawValue: sanitized, sanitizedValue: sanitized, hasXss, wasSanitized: sanitized !== processedValue });
    } else {
      setState(prev => ({ ...prev, rawValue: processedValue, hasXss }));
    }
  }, [sanitizer, sanitizeOnChange, maxLength]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, [setValue]);

  const onBlur = useCallback(() => {
    if (sanitizeOnBlur) {
      const sanitized = sanitizer(state.rawValue);
      setState(prev => ({ ...prev, rawValue: sanitized, sanitizedValue: sanitized, wasSanitized: sanitized !== prev.rawValue }));
    } else {
      setState(prev => ({ ...prev, sanitizedValue: sanitizer(prev.rawValue) }));
    }
  }, [sanitizer, sanitizeOnBlur, state.rawValue]);

  const reset = useCallback(() => {
    const sanitized = sanitizer(initialValue);
    setState({ rawValue: initialValue, sanitizedValue: sanitized, hasXss: containsXss(initialValue), wasSanitized: sanitized !== initialValue });
  }, [initialValue, sanitizer]);

  const getSanitizedValue = useCallback(() => sanitizer(state.rawValue), [sanitizer, state.rawValue]);

  return { value: state.rawValue, sanitizedValue: state.sanitizedValue, hasXss: state.hasXss, wasSanitized: state.wasSanitized, setValue, onChange, onBlur, reset, getSanitizedValue };
}

export default useSanitizedInput;
