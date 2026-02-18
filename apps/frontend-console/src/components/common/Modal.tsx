/**
 * Modal 组件
 * 
 * 基于 Ant Design Modal 封装的模态框组件
 * 
 * @requirements 8.2
 */

import React from 'react';
import { Modal as AntModal, Button } from 'antd';
import type { ModalProps as AntModalProps } from 'antd';
import type { ModalProps, ModalSize } from '@/types';

// ============================================================================
// 尺寸配置
// ============================================================================

const sizeConfig: Record<ModalSize, number | string> = {
  sm: 400,
  md: 520,
  lg: 720,
  xl: 1000,
  full: '90vw',
};

// ============================================================================
// 主组件
// ============================================================================

/**
 * 模态框组件
 * 
 * 基于 Ant Design Modal 封装，保留原有 API 接口
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  title,
  size = 'md',
  width,
  footer,
  closable = true,
  maskClosable = true,
  escClosable = true,
  centered = true,
  onClose,
  onConfirm,
  confirmText = '确认',
  cancelText = '取消',
  confirmLoading = false,
  destroyOnClose = false,
  className,
  style,
  children,
}) => {
  // 计算宽度
  const modalWidth = width ?? sizeConfig[size];

  // 处理确认按钮点击
  const handleOk = () => {
    onConfirm?.();
  };

  // 渲染底部按钮
  const renderFooter = (): React.ReactNode => {
    // 如果明确传入 footer，使用传入的值
    if (footer !== undefined) {
      return footer;
    }

    // 如果有 onConfirm，渲染默认按钮
    if (onConfirm) {
      return (
        <>
          <Button onClick={onClose}>
            {cancelText}
          </Button>
          <Button type="primary" loading={confirmLoading} onClick={handleOk}>
            {confirmText}
          </Button>
        </>
      );
    }

    // 否则只显示关闭按钮
    return (
      <Button onClick={onClose}>
        关闭
      </Button>
    );
  };

  return (
    <AntModal
      open={open}
      title={title}
      width={modalWidth}
      footer={renderFooter()}
      closable={closable}
      maskClosable={maskClosable}
      keyboard={escClosable}
      centered={centered}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={confirmLoading}
      destroyOnClose={destroyOnClose}
      className={className}
      style={style}
    >
      {children}
    </AntModal>
  );
};

export default Modal;
