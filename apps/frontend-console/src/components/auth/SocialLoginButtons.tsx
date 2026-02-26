import React from 'react';
import { Button } from 'antd';

export type SocialProvider = 'github' | 'google' | 'microsoft';

interface SocialLoginButtonsProps {
  disabled?: boolean;
  onLogin: (provider: SocialProvider) => void;
}

const providers: { id: SocialProvider; name: string; icon: string; color: string }[] = [
  { id: 'github', name: 'GitHub', icon: 'code', color: '#24292e' },
  { id: 'google', name: 'Google', icon: 'g_mobiledata', color: '#4285f4' },
  { id: 'microsoft', name: 'Microsoft', icon: 'window', color: '#00a4ef' },
];

const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({ disabled, onLogin }) => (
  <div className="flex flex-col gap-2">
    {providers.map((p) => (
      <Button
        key={p.id}
        block
        disabled={disabled}
        onClick={() => onLogin(p.id)}
        style={{ backgroundColor: p.color, borderColor: p.color, color: '#fff' }}
        aria-label={`使用 ${p.name} 登录`}
      >
        <span className="material-symbols-outlined text-base mr-1">{p.icon}</span>
        使用 {p.name} 登录
      </Button>
    ))}
  </div>
);

export default SocialLoginButtons;
