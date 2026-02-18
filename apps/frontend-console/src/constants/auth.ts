/**
 * 认证相关国际化常量
 * 
 * 支持中文（简体）和英文两种语言
 */

/**
 * 支持的语言类型
 */
export type Language = 'zh-CN' | 'en-US';

/**
 * 登录页面文本常量接口
 */
export interface LoginPageTexts {
  // 品牌和标题
  brandName: string;
  welcomeBack: string;
  loginDescription: string;
  
  // 表单标签
  usernameLabel: string;
  passwordLabel: string;
  usernamePlaceholder: string;
  passwordPlaceholder: string;
  
  // 按钮文本
  loginButton: string;
  loggingIn: string;
  ssoLoginButton: string;
  
  // 链接文本
  forgotPassword: string;
  rememberMe: string;
  noAccount: string;
  registerNow: string;
  
  // 第三方登录
  orLoginWith: string;
  loginWithGitHub: string;
  loginWithGoogle: string;
  loginWithMicrosoft: string;
  
  // 验证错误
  usernameRequired: string;
  passwordRequired: string;
  
  // 安全提示
  securityNotice: string;
  rememberMeDescription: string;
}

/**
 * 忘记密码页面文本常量接口
 */
export interface ForgotPasswordTexts {
  title: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  emailRequired: string;
  emailInvalid: string;
  submitButton: string;
  submitting: string;
  backToLogin: string;
  securityHint: string;
  
  // 成功状态
  successTitle: string;
  successMessage: string;
  checkInbox: string;
  
  // 错误消息
  sendFailed: string;
}

/**
 * SSO 登录页面文本常量接口
 */
export interface SSOLoginTexts {
  title: string;
  description: string;
  domainLabel: string;
  domainPlaceholder: string;
  domainRequired: string;
  protocolHint: string;
  submitButton: string;
  redirecting: string;
  backToLogin: string;
  
  // 错误消息
  ssoFailed: string;
}

/**
 * 注册页面文本常量接口
 */
export interface RegisterPageTexts {
  title: string;
  description: string;
  usernameLabel: string;
  emailLabel: string;
  passwordLabel: string;
  confirmPasswordLabel: string;
  usernamePlaceholder: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  confirmPasswordPlaceholder: string;
  registerButton: string;
  registering: string;
  hasAccount: string;
  loginNow: string;
  
  // 验证错误
  usernameRequired: string;
  emailRequired: string;
  emailInvalid: string;
  passwordRequired: string;
  passwordTooShort: string;
  passwordMismatch: string;
}

/**
 * 所有认证相关文本常量接口
 */
export interface AuthTexts {
  login: LoginPageTexts;
  forgotPassword: ForgotPasswordTexts;
  sso: SSOLoginTexts;
  register: RegisterPageTexts;
}

/**
 * 中文文本常量
 */
export const zhCN: AuthTexts = {
  login: {
    // 品牌和标题
    brandName: 'NexusLog',
    welcomeBack: '欢迎回来',
    loginDescription: '登录以访问您的日志管理控制台',
    
    // 表单标签
    usernameLabel: '用户名',
    passwordLabel: '密码',
    usernamePlaceholder: '请输入用户名',
    passwordPlaceholder: '请输入密码',
    
    // 按钮文本
    loginButton: '登录',
    loggingIn: '登录中...',
    ssoLoginButton: '企业 SSO 登录',
    
    // 链接文本
    forgotPassword: '忘记密码？',
    rememberMe: '记住我',
    noAccount: '还没有账号？',
    registerNow: '立即注册',
    
    // 第三方登录
    orLoginWith: '或使用以下方式登录',
    loginWithGitHub: '使用 GitHub 登录',
    loginWithGoogle: '使用 Google 登录',
    loginWithMicrosoft: '使用 Microsoft 登录',
    
    // 验证错误
    usernameRequired: '请输入用户名',
    passwordRequired: '请输入密码',
    
    // 安全提示
    securityNotice: '请勿在公共设备上勾选"记住我"',
    rememberMeDescription: '勾选此选项以在下次访问时保持登录状态',
  },
  
  forgotPassword: {
    title: '忘记密码',
    description: '输入您的注册邮箱，我们将发送重置链接',
    emailLabel: '邮箱地址',
    emailPlaceholder: '请输入注册邮箱',
    emailRequired: '请输入邮箱地址',
    emailInvalid: '请输入有效的邮箱地址',
    submitButton: '发送重置链接',
    submitting: '发送中...',
    backToLogin: '返回登录',
    securityHint: '重置链接将发送到您的注册邮箱',
    
    // 成功状态
    successTitle: '邮件已发送',
    successMessage: '重置链接已发送到',
    checkInbox: '请检查您的收件箱并按照邮件中的说明重置密码',
    
    // 错误消息
    sendFailed: '发送重置邮件失败，请稍后重试',
  },
  
  sso: {
    title: '企业 SSO 登录',
    description: '输入您的企业域名以使用单点登录',
    domainLabel: '企业域名',
    domainPlaceholder: '例如：company.com',
    domainRequired: '请输入企业域名',
    protocolHint: '支持 SAML 2.0 和 OAuth 2.0/OIDC 协议',
    submitButton: '继续',
    redirecting: '正在跳转...',
    backToLogin: '返回普通登录',
    
    // 错误消息
    ssoFailed: 'SSO 认证失败，请检查域名是否正确',
  },
  
  register: {
    title: '创建账号',
    description: '注册以开始使用 NexusLog',
    usernameLabel: '用户名',
    emailLabel: '邮箱',
    passwordLabel: '密码',
    confirmPasswordLabel: '确认密码',
    usernamePlaceholder: '请输入用户名',
    emailPlaceholder: '请输入邮箱',
    passwordPlaceholder: '请输入密码',
    confirmPasswordPlaceholder: '请再次输入密码',
    registerButton: '注册',
    registering: '注册中...',
    hasAccount: '已有账号？',
    loginNow: '立即登录',
    
    // 验证错误
    usernameRequired: '请输入用户名',
    emailRequired: '请输入邮箱',
    emailInvalid: '请输入有效的邮箱地址',
    passwordRequired: '请输入密码',
    passwordTooShort: '密码至少需要 8 个字符',
    passwordMismatch: '两次输入的密码不一致',
  },
};

/**
 * 英文文本常量
 */
export const enUS: AuthTexts = {
  login: {
    // 品牌和标题
    brandName: 'NexusLog',
    welcomeBack: 'Welcome Back',
    loginDescription: 'Sign in to access your log management console',
    
    // 表单标签
    usernameLabel: 'Username',
    passwordLabel: 'Password',
    usernamePlaceholder: 'Enter your username',
    passwordPlaceholder: 'Enter your password',
    
    // 按钮文本
    loginButton: 'Sign In',
    loggingIn: 'Signing in...',
    ssoLoginButton: 'Enterprise SSO Login',
    
    // 链接文本
    forgotPassword: 'Forgot password?',
    rememberMe: 'Remember me',
    noAccount: "Don't have an account?",
    registerNow: 'Sign up',
    
    // 第三方登录
    orLoginWith: 'Or sign in with',
    loginWithGitHub: 'Sign in with GitHub',
    loginWithGoogle: 'Sign in with Google',
    loginWithMicrosoft: 'Sign in with Microsoft',
    
    // 验证错误
    usernameRequired: 'Please enter your username',
    passwordRequired: 'Please enter your password',
    
    // 安全提示
    securityNotice: 'Do not check "Remember me" on public devices',
    rememberMeDescription: 'Check this option to stay signed in on your next visit',
  },
  
  forgotPassword: {
    title: 'Forgot Password',
    description: 'Enter your registered email and we will send you a reset link',
    emailLabel: 'Email Address',
    emailPlaceholder: 'Enter your registered email',
    emailRequired: 'Please enter your email address',
    emailInvalid: 'Please enter a valid email address',
    submitButton: 'Send Reset Link',
    submitting: 'Sending...',
    backToLogin: 'Back to Login',
    securityHint: 'Reset link will be sent to your registered email',
    
    // 成功状态
    successTitle: 'Email Sent',
    successMessage: 'Reset link has been sent to',
    checkInbox: 'Please check your inbox and follow the instructions to reset your password',
    
    // 错误消息
    sendFailed: 'Failed to send reset email, please try again later',
  },
  
  sso: {
    title: 'Enterprise SSO Login',
    description: 'Enter your company domain to use single sign-on',
    domainLabel: 'Company Domain',
    domainPlaceholder: 'e.g., company.com',
    domainRequired: 'Please enter your company domain',
    protocolHint: 'Supports SAML 2.0 and OAuth 2.0/OIDC protocols',
    submitButton: 'Continue',
    redirecting: 'Redirecting...',
    backToLogin: 'Back to Standard Login',
    
    // 错误消息
    ssoFailed: 'SSO authentication failed, please check if the domain is correct',
  },
  
  register: {
    title: 'Create Account',
    description: 'Sign up to start using NexusLog',
    usernameLabel: 'Username',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    confirmPasswordLabel: 'Confirm Password',
    usernamePlaceholder: 'Enter your username',
    emailPlaceholder: 'Enter your email',
    passwordPlaceholder: 'Enter your password',
    confirmPasswordPlaceholder: 'Re-enter your password',
    registerButton: 'Sign Up',
    registering: 'Signing up...',
    hasAccount: 'Already have an account?',
    loginNow: 'Sign in',
    
    // 验证错误
    usernameRequired: 'Please enter your username',
    emailRequired: 'Please enter your email',
    emailInvalid: 'Please enter a valid email address',
    passwordRequired: 'Please enter your password',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
  },
};

/**
 * 语言文本映射
 */
export const authTexts: Record<Language, AuthTexts> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

/**
 * 获取指定语言的认证文本
 * 
 * @param language - 语言代码
 * @returns 对应语言的文本常量
 */
export function getAuthTexts(language: Language): AuthTexts {
  return authTexts[language] || zhCN;
}

/**
 * 默认语言
 */
export const DEFAULT_LANGUAGE: Language = 'zh-CN';

/**
 * 语言存储键名
 */
export const LANGUAGE_STORAGE_KEY = 'nexuslog-language';

/**
 * 从 localStorage 获取保存的语言偏好
 * 
 * @returns 保存的语言代码，如果没有则返回默认语言
 */
export function getSavedLanguage(): Language {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }
  
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved === 'zh-CN' || saved === 'en-US') {
    return saved;
  }
  
  return DEFAULT_LANGUAGE;
}

/**
 * 保存语言偏好到 localStorage
 * 
 * @param language - 要保存的语言代码
 */
export function saveLanguage(language: Language): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }
}
