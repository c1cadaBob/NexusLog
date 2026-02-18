/**
 * ContextMenu 组件
 * 
 * 上下文菜单组件，基于 Ant Design Dropdown
 * 
 * @requirements 8.4
 */

import React, { useEffect, useCallback } from 'react';
import { Dropdown, Menu } from 'antd';
import type { MenuProps } from 'antd';
import type { ContextMenuProps, ContextMenuItem } from '@/types';

/**
 * 将 ContextMenuItem 转换为 Ant Design Menu 项
 */
const convertToMenuItems = (
  items: ContextMenuItem[],
  onItemClick?: (key: string, item: ContextMenuItem) => void
): MenuProps['items'] => {
  return items.map((item) => {
    if (item.divider) {
      return { type: 'divider' as const, key: `divider-${item.key}` };
    }

    const menuItem: NonNullable<MenuProps['items']>[number] = {
      key: item.key,
      label: item.label,
      disabled: item.disabled,
      danger: item.danger,
      onClick: () => {
        item.onClick?.();
        onItemClick?.(item.key, item);
      },
    };

    if (item.children && item.children.length > 0) {
      return {
        ...menuItem,
        children: convertToMenuItems(item.children, onItemClick),
      };
    }

    return menuItem;
  });
};

/**
 * 上下文菜单组件
 */
export const ContextMenu: React.FC<ContextMenuProps> = ({
  open,
  position,
  items,
  onClose,
  onItemClick,
  className,
  style,
}) => {
  // 点击外部关闭
  const handleClickOutside = useCallback(() => {
    if (open) {
      onClose();
    }
  }, [open, onClose]);

  // ESC 键关闭
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const menuItems = convertToMenuItems(items, onItemClick);

  const menu = (
    <Menu
      items={menuItems}
      onClick={handleClickOutside}
      className={className}
      style={style}
    />
  );

  return (
    <Dropdown
      open={open}
      dropdownRender={() => menu}
      trigger={['contextMenu']}
      onOpenChange={(visible) => {
        if (!visible) onClose();
      }}
    >
      <div
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: 1,
          height: 1,
          pointerEvents: 'none',
        }}
      />
    </Dropdown>
  );
};

export default ContextMenu;
