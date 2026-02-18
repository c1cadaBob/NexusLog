/**
 * ErrorBoundary 组件
 * 
 * 错误边界组件，捕获子组件树中的 JavaScript 错误
 * 使用 Ant Design Result 组件展示错误信息
 * 
 * @requirements 8.3
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Result, Button, Typography, Space } from 'antd';
import { ReloadOutlined, HomeOutlined } from '@ant-design/icons';

const { Paragraph, Text } = Typography;

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 错误跟踪服务接口
 */
export interface ErrorTracker {
  captureError: (error: Error, context?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
}

/**
 * 后备 UI Props
 */
export interface FallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
}

/**
 * ErrorBoundary Props
 */
export interface ErrorBoundaryProps {
  /** 子组件 */
  children: ReactNode;
  /** 自定义后备 UI */
  fallback?: ReactNode | ((props: FallbackProps) => ReactNode);
  /** 错误发生时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** 重置时的回调 */
  onReset?: () => void;
  /** 错误跟踪服务 */
  errorTracker?: ErrorTracker;
  /** 是否显示错误详情（开发模式） */
  showDetails?: boolean;
  /** 组件名称（用于错误报告） */
  componentName?: string;
}

/**
 * ErrorBoundary State
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// 默认错误跟踪器
// ============================================================================

/**
 * 默认错误跟踪器（控制台输出）
 */
export const defaultErrorTracker: ErrorTracker = {
  captureError: (error: Error, context?: Record<string, unknown>) => {
    console.error('[ErrorBoundary] 捕获错误:', error);
    if (context) {
      console.error('[ErrorBoundary] 错误上下文:', context);
    }
  },
  captureMessage: (message: string, level: 'info' | 'warning' | 'error' = 'error') => {
    const logMethod = level === 'info' ? console.info : level === 'warning' ? console.warn : console.error;
    logMethod(`[ErrorBoundary] ${message}`);
  },
};

// ============================================================================
// ErrorBoundary 组件
// ============================================================================

/**
 * 错误边界组件
 * 
 * 捕获子组件树中的 JavaScript 错误，并显示后备 UI
 * 
 * @example
 * ```tsx
 * <ErrorBoundary
 *   onError={(error, info) => console.error(error)}
 *   fallback={<div>出错了</div>}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * 从错误中派生状态
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * 捕获错误并记录
   */
  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, errorTracker = defaultErrorTracker, componentName } = this.props;

    // 更新状态
    this.setState({ errorInfo });

    // 构建错误上下文
    const context: Record<string, unknown> = {
      componentStack: errorInfo.componentStack,
      timestamp: Date.now(),
    };

    if (componentName) {
      context.componentName = componentName;
    }

    // 发送到错误跟踪服务
    errorTracker.captureError(error, context);

    // 调用错误回调
    onError?.(error, errorInfo);
  }

  /**
   * 重置错误状态
   */
  resetError = (): void => {
    const { onReset } = this.props;
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    onReset?.();
  };

  override render(): ReactNode {
    const { children, fallback, showDetails } = this.props;
    const { hasError, error, errorInfo } = this.state;

    if (hasError && error) {
      // 使用自定义后备 UI
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback({
            error,
            errorInfo,
            resetError: this.resetError,
          });
        }
        return fallback;
      }

      // 使用默认后备 UI（Ant Design Result）
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetError}
          showDetails={showDetails}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// 默认后备 UI 组件
// ============================================================================

interface DefaultErrorFallbackProps extends FallbackProps {
  showDetails?: boolean;
}

/**
 * 默认错误后备 UI
 * 
 * 使用 Ant Design Result 组件展示错误信息
 */
const DefaultErrorFallback: React.FC<DefaultErrorFallbackProps> = ({
  error,
  errorInfo,
  resetError,
  showDetails = import.meta.env?.DEV,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <Result
      status="error"
      title="出错了"
      subTitle={error.message || '应用程序遇到了一个意外错误。请尝试刷新页面或稍后再试。'}
      extra={
        <Space>
          <Button type="primary" icon={<ReloadOutlined />} onClick={resetError}>
            重试
          </Button>
          <Button icon={<HomeOutlined />} onClick={() => window.location.href = '/'}>
            返回首页
          </Button>
        </Space>
      }
    >
      {showDetails && (
        <div style={{ textAlign: 'left' }}>
          <Paragraph>
            <Text
              strong
              style={{ cursor: 'pointer' }}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? '▼' : '▶'} 错误详情
            </Text>
          </Paragraph>
          
          {expanded && (
            <>
              <Paragraph>
                <Text type="danger" strong>错误类型: </Text>
                <Text code>{error.name}</Text>
              </Paragraph>
              
              {error.stack && (
                <Paragraph>
                  <Text type="warning" strong>堆栈跟踪:</Text>
                  <pre style={{ 
                    fontSize: 12, 
                    overflow: 'auto', 
                    maxHeight: 200,
                    background: '#f5f5f5',
                    padding: 8,
                    borderRadius: 4,
                  }}>
                    {error.stack}
                  </pre>
                </Paragraph>
              )}
              
              {errorInfo?.componentStack && (
                <Paragraph>
                  <Text type="secondary" strong>组件堆栈:</Text>
                  <pre style={{ 
                    fontSize: 12, 
                    overflow: 'auto', 
                    maxHeight: 200,
                    background: '#f5f5f5',
                    padding: 8,
                    borderRadius: 4,
                  }}>
                    {errorInfo.componentStack}
                  </pre>
                </Paragraph>
              )}
            </>
          )}
        </div>
      )}
    </Result>
  );
};

// ============================================================================
// 高阶组件
// ============================================================================

/**
 * withErrorBoundary 高阶组件
 * 
 * @example
 * ```tsx
 * const SafeComponent = withErrorBoundary(MyComponent, {
 *   fallback: <div>出错了</div>,
 * });
 * ```
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  const displayName = WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  const ComponentWithErrorBoundary: React.FC<P> = (props) => (
    <ErrorBoundary {...errorBoundaryProps} componentName={displayName}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  ComponentWithErrorBoundary.displayName = `withErrorBoundary(${displayName})`;
  
  return ComponentWithErrorBoundary;
}

// ============================================================================
// 导出
// ============================================================================

export default ErrorBoundary;
