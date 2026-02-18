/**
 * DataTable 组件
 * 
 * 基于 Ant Design Table 封装的数据表格组件，支持：
 * - 排序和过滤
 * - 分页
 * - 行选择（单选和多选）
 * 
 * @requirements 8.1
 */

import React, { useMemo, useCallback } from 'react';
import { Table, Empty, Spin } from 'antd';
import type { TableProps as AntTableProps, TableColumnType } from 'antd';
import type { SorterResult, FilterValue, TablePaginationConfig } from 'antd/es/table/interface';
import type { 
  TableColumn, 
  SortConfig, 
  SortDirection,
  PaginationConfig, 
  SelectionConfig 
} from '@/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface DataTableProps<T extends Record<string, unknown>> {
  /** 列定义 */
  columns: TableColumn<T>[];
  /** 数据源 */
  data: T[];
  /** 行键 */
  rowKey: keyof T | ((record: T) => string);
  /** 排序配置 */
  sort?: SortConfig | null;
  /** 分页配置 */
  pagination?: PaginationConfig | false;
  /** 选择配置 */
  selection?: SelectionConfig<string>;
  /** 是否显示边框 */
  bordered?: boolean;
  /** 是否显示斑马纹 */
  striped?: boolean;
  /** 是否可悬停高亮 */
  hoverable?: boolean;
  /** 尺寸 */
  size?: 'small' | 'middle' | 'large';
  /** 是否加载中 */
  loading?: boolean;
  /** 空数据提示 */
  emptyText?: string;
  /** 自定义类名 */
  className?: string;
  /** 滚动配置 */
  scroll?: AntTableProps<T>['scroll'];
  /** 行点击回调 */
  onRowClick?: (record: T, index: number) => void;
  /** 排序变化回调 */
  onSortChange?: (sort: SortConfig | null) => void;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 默认排序函数
 */
function defaultSorter<T>(a: T, b: T, field: string): number {
  const aVal = (a as Record<string, unknown>)[field];
  const bVal = (b as Record<string, unknown>)[field];
  
  if (aVal === bVal) return 0;
  if (aVal === null || aVal === undefined) return 1;
  if (bVal === null || bVal === undefined) return -1;
  
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return aVal - bVal;
  }
  
  return String(aVal).localeCompare(String(bVal));
}

/**
 * 将自定义 TableColumn 转换为 Ant Design ColumnType
 */
function convertToAntdColumns<T extends Record<string, unknown>>(
  columns: TableColumn<T>[],
  sort: SortConfig | null
): TableColumnType<T>[] {
  return columns
    .filter(col => !col.hidden)
    .map(col => {
      const antdCol: TableColumnType<T> = {
        key: col.key,
        dataIndex: col.dataIndex as string | undefined,
        title: col.title,
        width: col.width,
        align: col.align,
        fixed: col.fixed,
        ellipsis: col.ellipsis,
        render: col.render as TableColumnType<T>['render'],
      };

      // 处理排序
      if (col.sortable) {
        antdCol.sorter = typeof col.sorter === 'function' 
          ? col.sorter as (a: T, b: T) => number
          : (a: T, b: T) => defaultSorter(a, b, col.dataIndex as string || col.key);
        
        // 设置当前排序状态
        if (sort?.field === col.key) {
          antdCol.sortOrder = sort.direction === 'asc' ? 'ascend' : 'descend';
        }
      }

      return antdCol;
    });
}

// ============================================================================
// 主组件
// ============================================================================

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  sort,
  pagination,
  selection,
  bordered = false,
  striped = false,
  hoverable = true,
  size = 'middle',
  loading = false,
  emptyText = '暂无数据',
  className,
  scroll,
  onRowClick,
  onSortChange,
}: DataTableProps<T>) {
  // 转换列定义
  const antdColumns = useMemo(
    () => convertToAntdColumns(columns, sort ?? null),
    [columns, sort]
  );

  // 处理分页配置
  const antdPagination = useMemo<TablePaginationConfig | false>(() => {
    if (pagination === false) return false;
    if (!pagination) return false;
    
    return {
      current: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
      pageSizeOptions: ['10', '20', '50', '100'],
      onChange: (page, pageSize) => pagination.onChange(page, pageSize),
    };
  }, [pagination]);

  // 处理选择配置
  const rowSelection = useMemo(() => {
    if (!selection) return undefined;
    
    return {
      type: selection.mode === 'single' ? 'radio' as const : 'checkbox' as const,
      selectedRowKeys: Array.from(selection.selectedKeys),
      onChange: (selectedRowKeys: React.Key[]) => {
        selection.onChange(new Set(selectedRowKeys.map(String)));
      },
    };
  }, [selection]);

  // 处理表格变化（排序、筛选、分页）
  const handleTableChange = useCallback(
    (
      _pagination: TablePaginationConfig,
      _filters: Record<string, FilterValue | null>,
      sorter: SorterResult<T> | SorterResult<T>[]
    ) => {
      if (!onSortChange) return;
      
      // 处理排序
      const singleSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      
      if (!singleSorter || !singleSorter.order) {
        onSortChange(null);
      } else {
        onSortChange({
          field: String(singleSorter.columnKey || singleSorter.field || ''),
          direction: singleSorter.order === 'ascend' ? 'asc' as SortDirection : 'desc' as SortDirection,
        });
      }
    },
    [onSortChange]
  );

  // 处理行点击
  const onRow = useCallback(
    (record: T, index?: number) => ({
      onClick: () => onRowClick?.(record, index ?? 0),
      style: { cursor: onRowClick ? 'pointer' : undefined },
    }),
    [onRowClick]
  );

  // 获取行键
  const getRowKey = useCallback(
    (record: T): string => {
      if (typeof rowKey === 'function') {
        return rowKey(record);
      }
      return String(record[rowKey]);
    },
    [rowKey]
  );

  return (
    <Table<T>
      className={className}
      columns={antdColumns}
      dataSource={data}
      rowKey={getRowKey}
      pagination={antdPagination}
      rowSelection={rowSelection}
      bordered={bordered}
      size={size}
      loading={{
        spinning: loading,
        indicator: <Spin />,
      }}
      locale={{
        emptyText: <Empty description={emptyText} />,
      }}
      scroll={scroll}
      onChange={handleTableChange}
      onRow={onRow}
      rowClassName={striped ? (_, index) => (index % 2 === 1 ? 'ant-table-row-striped' : '') : undefined}
    />
  );
}

export default DataTable;
