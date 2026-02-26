import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Divider, Dropdown } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import LoginForm from '../../components/auth/LoginForm';
import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';
import SSOLoginForm from '../../components/auth/SSOLoginForm';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
import type { SocialProvider } from '../../components/auth/SocialLoginButtons';

type ViewType = 'login' | 'forgot-password' | 'sso';

// 产品特性
const features = [
  { icon: 'speed', title: '实时日志分析', desc: '毫秒级日志检索，支持 PB 级数据实时查询' },
  { icon: 'security', title: '企业级安全', desc: '端到端加密，符合 SOC2、GDPR 等合规要求' },
  { icon: 'insights', title: '智能告警', desc: 'AI 驱动的异常检测，提前发现潜在问题' },
  { icon: 'hub', title: '无缝集成', desc: '支持 200+ 数据源，一键接入主流云平台' },
];

// 统计数据
const stats = [
  { value: '99.99%', label: '系统可用性' },
  { value: '10PB+', label: '日处理能力' },
  { value: '200+', label: '已交付企业' },
  { value: '<100ms', label: '查询响应' },
];

// 语言选项
type Language = 'zh-CN' | 'en-US';
const languages: { key: Language; label: string; flag: string }[] = [
  { key: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { key: 'en-US', label: 'English', flag: '🇺🇸' },
];

const LoginPage: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewType>('login');
  const [lang, setLang] = useState<Language>('zh-CN');
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '登录 - NexusLog';
  }, []);

  // 已认证用户重定向
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSocialLogin = (provider: SocialProvider) => {
    const urls: Record<SocialProvider, string> = {
      github: '/api/auth/github',
      google: '/api/auth/google',
      microsoft: '/api/auth/microsoft',
    };
    window.location.href = urls[provider];
  };

  const currentLang = languages.find((l) => l.key === lang) || languages[0];

  const renderView = () => {
    switch (activeView) {
      case 'forgot-password':
        return <ForgotPasswordForm onBack={() => setActiveView('login')} />;
      case 'sso':
        return <SSOLoginForm onBack={() => setActiveView('login')} />;
      default:
        return (
          <>
            <LoginForm
              onForgotPassword={() => setActiveView('forgot-password')}
              onSSOLogin={() => setActiveView('sso')}
            />
            <Divider plain className="!my-4 !text-xs opacity-50">
              或使用以下方式登录
            </Divider>
            <SocialLoginButtons onLogin={handleSocialLogin} />
          </>
        );
    }
  };

  return (
    <div className="min-h-screen flex relative" style={{ background: '#0f172a' }}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            top: 0, left: 0, width: 800, height: 800,
            background: 'radial-gradient(circle, rgba(19,91,236,0.3) 0%, transparent 70%)',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            bottom: 0, right: 0, width: 600, height: 600,
            background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
            transform: 'translate(25%, 25%)',
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
        {/* 网格点阵 */}
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.03,
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      {/* 左侧产品介绍 - lg 以上显示 */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-center px-12 xl:px-20">
        <div className="relative z-10 max-w-xl">
          {/* 品牌标识 */}
          <div className="flex items-center gap-3 mb-8">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(19,91,236,0.2)' }}
            >
              <span className="material-symbols-outlined text-2xl" style={{ color: '#135bec' }}>
                analytics
              </span>
            </div>
            <span className="text-2xl font-bold text-white">NexusLog</span>
          </div>

          {/* 主标题 */}
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-6">
            企业级日志管理
            <br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: 'linear-gradient(to right, #135bec, #a78bfa)' }}
            >
              智能分析平台
            </span>
          </h1>

          <p className="text-lg mb-10 leading-relaxed" style={{ color: '#94a3b8' }}>
            私有化部署的日志管理平台，实时收集、存储、分析海量日志数据，助力企业快速定位问题、保障业务稳定运行。
          </p>

          {/* 产品特性卡片 */}
          <div className="grid grid-cols-2 gap-4 mb-12">
            {features.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-4 rounded-xl transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(19,91,236,0.2)' }}
                >
                  <span className="material-symbols-outlined text-xl" style={{ color: '#135bec' }}>
                    {f.icon}
                  </span>
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">{f.title}</h3>
                  <p className="text-sm" style={{ color: '#64748b' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 统计数据 */}
          <div className="flex items-center gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl xl:text-3xl font-bold text-white">{s.value}</div>
                <div className="text-sm mt-1" style={{ color: '#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-8 left-12 xl:left-20 text-sm" style={{ color: '#64748b' }}>
          © 2026 NexusLog. All rights reserved.
        </div>
      </div>

      {/* 右侧登录区域 */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-[400px]">
          {/* 顶部渐变条 */}
          <div
            className="h-1 rounded-t-xl"
            style={{ background: 'linear-gradient(to right, #135bec, #8b5cf6, #135bec)' }}
          />

          {/* 卡片主体 */}
          <div
            className="rounded-b-xl p-5 sm:p-6 shadow-2xl"
            style={{
              background: 'rgba(30,41,59,0.8)',
              backdropFilter: 'blur(20px)',
              border: '1px solid #334155',
              borderTop: 'none',
            }}
          >
            {/* 品牌标识 - 移动端 + 欢迎文字 */}
            {activeView === 'login' && (
              <div className="text-center mb-5">
                <div className="lg:hidden inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                  style={{ background: 'rgba(19,91,236,0.2)' }}
                >
                  <span className="material-symbols-outlined text-2xl" style={{ color: '#135bec' }}>
                    analytics
                  </span>
                </div>
                <h1 className="text-xl font-bold text-white lg:hidden">NexusLog</h1>
                <h2 className="hidden lg:block text-lg font-semibold text-white">欢迎回来</h2>
                <p className="text-sm mt-1" style={{ color: '#94a3b8' }}>
                  <span className="lg:hidden">欢迎回来，</span>登录以访问您的日志管理控制台
                </p>
              </div>
            )}

            {renderView()}

            {/* 注册链接 */}
            {activeView === 'login' && (
              <p className="text-center text-sm mt-4" style={{ color: '#94a3b8' }}>
                还没有账号？
                <Link to="/register" className="ml-1 hover:underline" style={{ color: '#135bec' }}>
                  立即注册
                </Link>
              </p>
            )}
          </div>

          {/* 底部：安全提示 + 语言切换 */}
          <div className="mt-3 flex items-center justify-between px-2">
            <p className="text-xs" style={{ color: '#64748b' }}>
              请勿在公共设备上勾选"记住我"
            </p>
            <Dropdown
              menu={{
                items: languages.map((l) => ({
                  key: l.key,
                  label: `${l.flag} ${l.label}`,
                  onClick: () => setLang(l.key),
                })),
                selectedKeys: [lang],
              }}
              trigger={['click']}
              placement="topRight"
            >
              <button
                className="flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors"
                style={{ color: '#94a3b8' }}
              >
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

export default LoginPage;
