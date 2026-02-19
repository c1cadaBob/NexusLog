/**
 * QueryBuilder 查询构建器组件
 * 
 * 提供可视化的日志查询条件构建功能：
 * - 字段选择
 * - 操作符选择
 * - 值输入
 * - 条件组合（AND/OR）
 * 
 * @requirements 9.2
 */

import React, { useState, useCallback } from 'react';
import {
  Card,
  Select,
  Input,
  Button,
  Space,
  Tag,
  Tooltip,
  Row,
  Col,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SearchOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import type { LogFilter, FilterOperator } from '@/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface QueryBuilderProps {
  /** 可用字段列表 */
  fields?: string[];
  /** 当前过滤条件 */
  filters?: LogFilter[];
  /** 过滤条件变化回调 */
  onFiltersChange?: (filters: LogFilter[]) => void;
  /** 执行搜索回调 */
  onSearch?: (filters: LogFilter[]) => void;
  /** 是否加载中 */
  loading?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
}

interface FilterRow {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
}

// ============================================================================
// 常量定义
// ============================================================================

/** 默认可用字段 */
const DEFAULT_FIELDS = [
  'level',
  'service',
  'host',
  'message',
  'traceId',
  'spanId',
  'source',
  'tags',
];

/** 操作符选项 */
const OPERATOR_OPTIONS: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: '等于' },
  { value: 'ne', label: '不等于' },
  { value: 'contains', label: '包含' },
  { value: 'not_contains', label: '不包含' },
  { value: 'starts_with', label: '开头是' },
  { value: 'ends_with', label: '结尾是' },
  { value: 'regex', label: '正则匹配' },
  { value: 'gt', label: '大于' },
  { value: 'gte', label: '大于等于' },
  { value: 'lt', label: '小于' },
  { value: 'lte', label: '小于等于' },
  { value: 'in', label: '在列表中' },
  { value: 'nin', label: '不在列表中' },
  { value: 'exists', label: '字段存在' },
  { value: 'not_exists', label: '字段不存在' },
];

/** 生成唯一 ID */
const generateId = () => `filter_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ============================================================================
// 辅助函数
// ============================================================================

/** 将 FilterRow 转换为 LogFilter */
const rowToFilter = (row: FilterRow): LogFilter => ({
  field: row.field,
  operator: row.operator,
  value: row.operator === 'in' || row.operator === 'nin'
    ? row.value.split(',').map(v => v.trim())
    : row.value,
});

/** 将 LogFilter 转换为 FilterRow */
const filterToRow = (filter: LogFilter): FilterRow => ({
  id: generateId(),
  field: filter.field,
  operator: filter.operator,
  value: Array.isArray(filter.value) ? filter.value.join(', ') : String(filter.value),
});

// ============================================================================
// 主组件
// ============================================================================

export const QueryBuilder: React.FC<QueryBuilderProps> = ({
  fields = DEFAULT_FIELDS,
  filters = [],
  onFiltersChange,
  onSearch,
  loading = false,
  disabled = false,
}) => {
  // 将外部 filters 转换为内部 rows
  const [rows, setRows] = useState<FilterRow[]>(() =>
    filters.length > 0 ? filters.map(filterToRow) : []
  );

  // 添加新条件
  const handleAddRow = useCallback(() => {
    const newRow: FilterRow = {
      id: generateId(),
      field: fields[0] || 'message',
      operator: 'contains',
      value: '',
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    onFiltersChange?.(newRows.filter(r => r.value || r.operator === 'exists' || r.operator === 'not_exists').map(rowToFilter));
  }, [rows, fields, onFiltersChange]);

  // 删除条件
  const handleRemoveRow = useCallback((id: string) => {
    const newRows = rows.filter(r => r.id !== id);
    setRows(newRows);
    onFiltersChange?.(newRows.filter(r => r.value || r.operator === 'exists' || r.operator === 'not_exists').map(rowToFilter));
  }, [rows, onFiltersChange]);

  // 更新条件
  const handleUpdateRow = useCallback((id: string, updates: Partial<FilterRow>) => {
    const newRows = rows.map(r => r.id === id ? { ...r, ...updates } : r);
    setRows(newRows);
    onFiltersChange?.(newRows.filter(r => r.value || r.operator === 'exists' || r.operator === 'not_exists').map(rowToFilter));
  }, [rows, onFiltersChange]);

  // 清空所有条件
  const handleClear = useCallback(() => {
    setRows([]);
    onFiltersChange?.([]);
  }, [onFiltersChange]);

  // 执行搜索
  const handleSearch = useCallback(() => {
    const validFilters = rows
      .filter(r => r.value || r.operator === 'exists' || r.operator === 'not_exists')
      .map(rowToFilter);
    onSearch?.(validFilters);
  }, [rows, onSearch]);

  // 判断操作符是否需要值输入
  const needsValue = (operator: FilterOperator) => 
    operator !== 'exists' && operator !== 'not_exists';

  return (
    <Card 
      title="查询构建器" 
      size="small"
      extra={
        <Space>
          <Tooltip title="清空条件">
            <Button
              icon={<ClearOutlined />}
              onClick={handleClear}
              disabled={disabled || rows.length === 0}
              size="small"
            />
          </Tooltip>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            loading={loading}
            disabled={disabled}
            size="small"
          >
            搜索
          </Button>
        </Space>
      }
    >
      {/* 已添加的条件 */}
      {rows.length > 0 && (
        <>
          <div style={{ marginBottom: 16 }}>
            {rows.map((row, index) => (
              <div key={row.id} style={{ marginBottom: 8 }}>
                {index > 0 && (
                  <Tag color="blue" style={{ marginBottom: 8 }}>AND</Tag>
                )}
                <Row gutter={8} align="middle">
                  <Col flex="150px">
                    <Select
                      value={row.field}
                      onChange={(value) => handleUpdateRow(row.id, { field: value })}
                      disabled={disabled}
                      style={{ width: '100%' }}
                      size="small"
                      showSearch
                      placeholder="选择字段"
                    >
                      {fields.map(field => (
                        <Select.Option key={field} value={field}>
                          {field}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col flex="120px">
                    <Select
                      value={row.operator}
                      onChange={(value) => handleUpdateRow(row.id, { operator: value })}
                      disabled={disabled}
                      style={{ width: '100%' }}
                      size="small"
                    >
                      {OPERATOR_OPTIONS.map(op => (
                        <Select.Option key={op.value} value={op.value}>
                          {op.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col flex="auto">
                    {needsValue(row.operator) && (
                      <Input
                        value={row.value}
                        onChange={(e) => handleUpdateRow(row.id, { value: e.target.value })}
                        disabled={disabled}
                        placeholder={
                          row.operator === 'in' || row.operator === 'nin'
                            ? '多个值用逗号分隔'
                            : '输入值'
                        }
                        size="small"
                        onPressEnter={handleSearch}
                      />
                    )}
                  </Col>
                  <Col flex="32px">
                    <Tooltip title="删除条件">
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={disabled}
                        size="small"
                      />
                    </Tooltip>
                  </Col>
                </Row>
              </div>
            ))}
          </div>
          <Divider style={{ margin: '12px 0' }} />
        </>
      )}

      {/* 添加条件按钮 */}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAddRow}
        disabled={disabled}
        block
        size="small"
      >
        添加过滤条件
      </Button>
    </Card>
  );
};

export default QueryBuilder;
