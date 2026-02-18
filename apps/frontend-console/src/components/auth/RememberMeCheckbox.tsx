/**
 * RememberMeCheckbox 组件
 * 
 * 基于 Ant Design Checkbox 的"记住我"复选框组件
 * 
 * @requirements 3.5, 9.4
 */

import React, { useCallback } from 'react';
import { Checkbox } from 'antd';
import type { CheckboxChangeEvent } from 'antd/es/checkbox';

/**
 * RememberMeCheckbox 组件属性
 */
export interface RememberMeCheckboxProps {
  /** 是否选中 */
  checked: boolean;
  /** 选中状态变化回调 */
  onChange: (checked: boolean) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 标签文本 */
  label?: string;
}

/**
 * "记住我" 复选框组件
 * 
 * 基于 Ant Design Checkbox 封装，支持键盘导航和无障碍访问
 */
export const RememberMeCheckbox: React.FC<RememberMeCheckboxProps> = ({
  checked,
  onChange,
  disabled = false,
  label = '记住我',
}) => {
  const handleChange = useCallback((e: CheckboxChangeEvent) => {
    if (!disabled) {
      onChange(e.target.checked);
    }
  }, [onChange, disabled]);

  return (
    <Checkbox
      checked={checked}
      onChange={handleChange}
      disabled={disabled}
    >
      {label}
    </Checkbox>
  );
};

export default RememberMeCheckbox;
