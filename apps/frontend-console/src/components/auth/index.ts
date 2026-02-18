/**
 * 认证相关组件导出
 */

export { ProtectedRoute } from './ProtectedRoute';
export type { ProtectedRouteProps } from './ProtectedRoute';

export { LoginForm, simulateAuthFailure } from './LoginForm';
export type { LoginFormProps, AuthFailureState } from './LoginForm';

export { RegisterForm } from './RegisterForm';
export type { RegisterFormProps } from './RegisterForm';

export { ForgotPasswordForm } from './ForgotPasswordForm';
export type { ForgotPasswordFormProps } from './ForgotPasswordForm';

export { PasswordInput, togglePasswordVisibility } from './PasswordInput';
export type { PasswordInputProps } from './PasswordInput';

export { RememberMeCheckbox } from './RememberMeCheckbox';
export type { RememberMeCheckboxProps } from './RememberMeCheckbox';

export { SocialLoginButtons } from './SocialLoginButtons';
export type { SocialLoginButtonsProps, SocialProvider } from './SocialLoginButtons';

export { SSOLoginForm } from './SSOLoginForm';
export type { SSOLoginFormProps } from './SSOLoginForm';
