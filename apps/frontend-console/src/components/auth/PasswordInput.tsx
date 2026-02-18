/**
 * PasswordInput 组件
 * 
 * 基于 Ant Design Input.Password 的密码输入组件
 * 
 * @requirements 3.5, 9.4
 */

import React, { forwardRef } from 'react';
import { Input, Form } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import type { InputRef } from 'antd';

/**
 * PasswordInput 组件属性
 */
export interface PasswordInputProps {
  /** 输入框 ID */
  id?: string;
  /** 标签文本 */
  label?: string;
  /** 输入值 */
  value?: string;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 失焦回调 */
  onBlur?: () => void;
  /** 占位符 */
  placeholder?: string;
  /** 错误信息 */
  error?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自动完成属性 */
  autoComplete?: string;
  /** 是否必填 */
  required?: boolean;
  /** 表单项名称（用于 Form.Item） */
  name?: string;
}

/**
 * 密码输入组件
 * 
 * 基于 Ant Design Input.Password 封装，支持：
 * - 密码可见性切换
 * - 错误状态显示
 * - 表单集成
 */
export const PasswordInput = forwardRef<InputRef, PasswordInputProps>(({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder = '请输入密码',
  error,
  disabled,
  autoComplete,
  required,
  name,
}, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e.target.value);
  };

  const inputElement = (
    <Input.Password
      ref={ref}
      id={id}
      value={value}
      onChange={handleChange}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete={autoComplete}
      prefix={<LockOutlined style={{ color: error ? '#ff4d4f' : undefined }} />}
      status={error ? 'error' : undefined}
      size="large"
    />
  );

  // 如果有 label，使用 Form.Item 包装
  if (label) {
    return (
      <Form.Item
        label={label}
        name={name}
        required={required}
        validateStatus={error ? 'error' : undefined}
        help={error}
      >
        {inputElement}
      </Form.Item>
    );
  }

  return inputElement;
});

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;

/**
 * 用于属性测试的辅助函数
 * 切换密码可见性状态
 */
export function togglePasswordVisibility(currentState: boolean): boolean {
  return !currentState;
}
