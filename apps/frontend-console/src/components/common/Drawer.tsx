/**
 * Drawer 组件
 * 
 * 基于 Ant Design Drawer 封装的抽屉组件
 * 
 * @requirements 8.2
 */

import React from 'react';
import { Drawer as AntDrawer } from 'antd';
import type { DrawerProps } from '@/types';

// ============================================================================
// 主组件
// ============================================================================

/**
 * 抽屉组件
 * 
 * 基于 Ant Design Drawer 封装，保留原有 API 接口
 */
export const Drawer: React.FC<DrawerProps> = ({
  open,
  title,
  placement = 'right',
  width = 400,
  height = 400,
  footer,
  closable = true,
  maskClosable = true,
  onClose,
  destroyOnClose = false,
  className,
  style,
  children,
}) => {
  // 根据位置确定尺寸属性
  const isHorizontal = placement === 'left' || placement === 'right';
  const sizeProps = isHorizontal ? { width } : { height };

  return (
    <AntDrawer
      open={open}
      title={title}
      placement={placement}
      {...sizeProps}
      footer={footer}
      closable={closable}
      maskClosable={maskClosable}
      onClose={onClose}
      destroyOnClose={destroyOnClose}
      className={className}
      style={style}
    >
      {children}
    </AntDrawer>
  );
};

export default Drawer;
