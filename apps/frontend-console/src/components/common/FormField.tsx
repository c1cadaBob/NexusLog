/**
 * FormField 组件
 * 
 * 基于 Ant Design Form.Item 的表单字段组件
 * 
 * @requirements 8.4
 */

import React from 'react';
import { Form } from 'antd';
import type { FormItemProps } from 'antd';

/**
 * FormField 组件属性
 */
export interface FormFieldProps extends FormItemProps {
  /** 字段名称 */
  name: string;
  /** 标签 */
  label?: string;
  /** 是否必填 */
  required?: boolean;
  /** 错误消息 */
  error?: string;
  /** 帮助文本 */
  help?: string;
  /** 子元素 */
  children?: React.ReactNode;
}

/**
 * 表单字段组件
 * 
 * 基于 Ant Design Form.Item 封装
 */
export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  required = false,
  error,
  help,
  children,
  ...rest
}) => {
  return (
    <Form.Item
      name={name}
      label={label}
      required={required}
      help={error || help}
      validateStatus={error ? 'error' : undefined}
      {...rest}
    >
      {children}
    </Form.Item>
  );
};

export default FormField;
