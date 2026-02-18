/**
 * SocialLoginButtons 组件
 * 
 * 基于 Ant Design Button 的社交登录按钮组
 * 
 * @requirements 3.5, 9.4
 */

import React from 'react';
import { Button, Space } from 'antd';
import { GithubOutlined, GoogleOutlined, WindowsOutlined } from '@ant-design/icons';

/**
 * 社交登录提供商类型
 */
export type SocialProvider = 'github' | 'google' | 'microsoft';

/**
 * SocialLoginButtons 组件属性
 */
export interface SocialLoginButtonsProps {
  /** 是否禁用 */
  disabled?: boolean;
  /** 登录回调，传入选择的提供商 */
  onLogin: (provider: SocialProvider) => void;
  /** 布局方向 */
  direction?: 'horizontal' | 'vertical';
}

/**
 * 提供商配置
 */
interface ProviderConfig {
  id: SocialProvider;
  name: string;
  icon: React.ReactNode;
  color: string;
}

/**
 * 社交登录提供商配置列表
 */
const providers: ProviderConfig[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: <GithubOutlined />,
    color: '#24292e',
  },
  {
    id: 'google',
    name: 'Google',
    icon: <GoogleOutlined />,
    color: '#4285f4',
  },
  {
    id: 'microsoft',
    name: 'Microsoft',
    icon: <WindowsOutlined />,
    color: '#00a4ef',
  },
];

/**
 * 社交登录按钮组组件
 * 
 * 显示多个社交登录选项按钮
 */
export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({ 
  disabled, 
  onLogin,
  direction = 'vertical',
}) => {
  const handleClick = (provider: SocialProvider) => {
    if (disabled) return;
    onLogin(provider);
  };

  return (
    <Space 
      direction={direction} 
      style={{ width: '100%' }}
      size="small"
    >
      {providers.map((provider) => (
        <Button
          key={provider.id}
          type="default"
          icon={provider.icon}
          onClick={() => handleClick(provider.id)}
          disabled={disabled}
          block={direction === 'vertical'}
          style={{
            backgroundColor: provider.color,
            borderColor: provider.color,
            color: '#fff',
          }}
          aria-label={`使用 ${provider.name} 登录`}
        >
          使用 {provider.name} 登录
        </Button>
      ))}
    </Space>
  );
};

export default SocialLoginButtons;
