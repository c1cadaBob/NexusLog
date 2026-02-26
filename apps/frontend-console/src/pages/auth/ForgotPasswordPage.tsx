import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ForgotPasswordForm from '../../components/auth/ForgotPasswordForm';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = '忘记密码 - NexusLog';
  }, []);

  const handleBack = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f172a' }}>
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            top: '-50%', left: '-50%', width: '100%', height: '100%',
            background: 'radial-gradient(circle, rgba(19,91,236,0.2) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            bottom: '-50%', right: '-50%', width: '100%', height: '100%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            opacity: 0.05,
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
      </div>

      {/* 卡片 */}
      <div className="relative w-full max-w-[420px] z-10">
        <div className="h-1 rounded-t-xl" style={{ background: 'linear-gradient(to right, #135bec, #8b5cf6, #135bec)' }} />

        <div
          className="rounded-b-xl p-8 shadow-2xl"
          style={{
            background: 'rgba(30,41,59,0.9)',
            backdropFilter: 'blur(20px)',
            border: '1px solid #334155',
            borderTop: 'none',
          }}
        >
          {/* 品牌标识 */}
          <div className="text-center mb-6">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
              style={{ background: 'rgba(19,91,236,0.2)' }}
            >
              <span className="material-symbols-outlined text-2xl" style={{ color: '#135bec' }}>analytics</span>
            </div>
            <h1 className="text-lg font-bold text-white">NexusLog</h1>
          </div>

          <ForgotPasswordForm onBack={handleBack} />
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#64748b' }}>
          如果您没有收到邮件，请检查垃圾邮件文件夹
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
