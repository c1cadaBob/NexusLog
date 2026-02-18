/**
 * SearchBar 组件
 * 
 * 基于 Ant Design Input.Search 的搜索栏组件
 * 
 * @requirements 8.4
 */

import React from 'react';
import { Input } from 'antd';
import type { SearchProps } from 'antd/es/input';

const { Search } = Input;

/**
 * SearchBar 组件属性
 */
export interface SearchBarProps {
  /** 占位符 */
  placeholder?: string;
  /** 值 */
  value?: string;
  /** 默认值 */
  defaultValue?: string;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 尺寸 */
  size?: 'small' | 'middle' | 'large';
  /** 是否允许清除 */
  allowClear?: boolean;
  /** 搜索回调 */
  onSearch?: (value: string) => void;
  /** 值变化回调 */
  onChange?: (value: string) => void;
  /** 自定义类名 */
  className?: string;
  /** 自定义样式 */
  style?: React.CSSProperties;
}

/**
 * 搜索栏组件
 * 
 * 基于 Ant Design Input.Search 封装
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = '搜索...',
  value,
  defaultValue,
  loading = false,
  disabled = false,
  size = 'middle',
  allowClear = true,
  onSearch,
  onChange,
  className,
  style,
}) => {
  const handleChange: SearchProps['onChange'] = (e) => {
    onChange?.(e.target.value);
  };

  return (
    <Search
      placeholder={placeholder}
      value={value}
      defaultValue={defaultValue}
      loading={loading}
      disabled={disabled}
      size={size}
      allowClear={allowClear}
      onSearch={onSearch}
      onChange={handleChange}
      className={className}
      style={style}
      enterButton
    />
  );
};

export default SearchBar;
