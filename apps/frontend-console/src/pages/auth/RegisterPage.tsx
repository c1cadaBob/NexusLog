import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Divider, Dropdown } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import RegisterForm from '../../components/auth/RegisterForm';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import type { SocialProvider } from '../../components/auth/SocialLoginButtons';

type Language = 'zh-CN' | 'en-US';
const languages: { key: Language; label: string; flag: string }[] = [
  { key: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { key: 'en-US', label: 'English', flag: '🇺🇸' },
];

// 注册优势
const benefits = [
  { icon: 'deployed_code', text: '一键私有化部署，数据完全自主可控' },
  { icon: 'all_inclusive', text: '买断式授权，无隐藏费用，永久使用' },
  { icon: 'support_agent', text: '专属技术顾问，全程部署实施支持' },
  { icon: 'lock', text: '企业级安全架构，满足等保合规要求' },
];

const RegisterPage: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh-CN');
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '注册 - NexusLog';
  }, []);

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSocialLogin = (provider: SocialProvider) => {
    const urls: Record<SocialProvider, string> = {
      github: '/api/auth/github',
      google: '/api/auth/google',
      microsoft: '/api/auth/microsoft',
    };
    window.location.href = urls[provider];
  };

  const handleRegisterSuccess = () => {
    navigate('/login');
  };

  const currentLang = languages.find((l) => l.key === lang) || languages[0];

  return (
    <div className="min-h-screen flex relative" style={{ background: '#0f172a' }}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            top: 0, right: 0, width: 800, height: 800,
            background: 'radial-gradient(circle, rgba(19,91,236,0.3) 0%, transparent 70%)',
            transform: 'translate(50%, -50%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            bottom: 0, left: 0, width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
            transform: 'translate(-25%, 25%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            top: '50%', left: '50%', width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.03,
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* 左侧产品介绍 */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-center px-12 xl:px-20">
        <div className="relative z-10 max-w-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(19,91,236,0.2)' }}>
              <span className="material-symbols-outlined text-2xl" style={{ color: '#135bec' }}>analytics</span>
            </div>
            <span className="text-2xl font-bold text-white">NexusLog</span>
          </div>

          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            开启您的
            <br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, #135bec, #a78bfa)' }}>
              日志管理之旅
            </span>
          </h1>

          <p className="text-lg mb-10 leading-relaxed" style={{ color: '#94a3b8' }}>
            注册 NexusLog 管理账号，开始配置您的专属日志管理平台。
          </p>

          <div className="space-y-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
                  <span className="material-symbols-outlined text-lg" style={{ color: '#10b981' }}>{b.icon}</span>
                </div>
                <span style={{ color: '#94a3b8' }}>{b.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-12 xl:left-20 text-sm" style={{ color: '#64748b' }}>
          © 2026 NexusLog. All rights reserved.
        </div>
      </div>

      {/* 右侧注册区域 */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-[400px]">
          <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #8b5cf6, #135bec, #8b5cf6)' }} />

          <div
            className="rounded-b-xl p-5 sm:p-6 shadow-2xl"
            style={{
              background: 'rgba(30,41,59,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid #334155',
              borderTop: 'none',
            }}
          >
            <div className="text-center mb-5">
              <div className="lg:hidden inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3" style={{ background: 'rgba(19,91,236,0.2)' }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: '#135bec' }}>analytics</span>
              </div>
              <h1 className="text-xl font-bold text-white lg:hidden">NexusLog</h1>
              <h2 className="hidden lg:block text-lg font-semibold text-white">创建账号</h2>
              <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                <span className="lg:hidden">创建账号，</span>配置您的日志管理平台
              </p>
            </div>

            <RegisterForm onSuccess={handleRegisterSuccess} />

            <Divider plain className="!my-4 !text-xs opacity-50">或使用以下方式注册</Divider>

            <SocialLoginButtons onLogin={handleSocialLogin} />

            <p className="text-center text-sm mt-4" style={{ color: '#94a3b8' }}>
              已有账号？
              <Link to="/login" className="ml-1 hover:underline" style={{ color: '#135bec' }}>立即登录</Link>
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between px-2">
            <p className="text-xs" style={{ color: '#64748b' }}>创建的账号仅用于本系统管理</p>
            <Dropdown
              menu={{
                items: languages.map((l) => ({ key: l.key, label: `${l.flag} ${l.label}`, onClick: () => setLang(l.key) })),
                selectedKeys: [lang],
              }}
              trigger={['click']}
              placement="topRight"
            >
              <button className="flex items-center gap-1 px-2 py-1 rounded text-sm" style={{ color: '#94a3b8' }}>
                <span>{currentLang.flag}</span>
                <span>{currentLang.label}</span>
                <span className="material-symbols-outlined text-base">expand_more</span>
              </button>
            </Dropdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
