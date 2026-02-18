/**
 * 路由配置入口
 * 
 * 配置完整的路由结构，包含 15 个路由模块
 * 对非首页路由使用 React.lazy 实现懒加载
 * 配置公开路由和受保护路由
 * 
 * @requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/auth';
import { LoadingScreen } from '@/components/common';
import { FALLBACK_ROUTE, PUBLIC_ROUTES } from '@/constants/menu';

// ============================================================================
// 懒加载页面组件
// ============================================================================

// Dashboard 首页 - 不使用懒加载（首页）
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));

// 认证模块 - 公开路由
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));

// 日志检索模块
const RealtimeSearchPage = lazy(() => import('@/pages/search/RealtimeSearchPage'));
const SearchHistoryPage = lazy(() => import('@/pages/search/SearchHistoryPage'));
const SavedQueriesPage = lazy(() => import('@/pages/search/SavedQueriesPage'));

// 日志分析模块
const AggregateAnalysisPage = lazy(() => import('@/pages/analysis/AggregateAnalysisPage'));
const AnomalyDetectionPage = lazy(() => import('@/pages/analysis/AnomalyDetectionPage'));
const LogClusteringPage = lazy(() => import('@/pages/analysis/LogClusteringPage'));

// 告警中心模块
const AlertListPage = lazy(() => import('@/pages/alerts/AlertListPage'));
const AlertRulesPage = lazy(() => import('@/pages/alerts/AlertRulesPage'));
const NotificationConfigPage = lazy(() => import('@/pages/alerts/NotificationConfigPage'));
const SilencePolicyPage = lazy(() => import('@/pages/alerts/SilencePolicyPage'));

// 采集接入模块
const SourceManagementPage = lazy(() => import('@/pages/ingestion/SourceManagementPage'));
const AgentManagementPage = lazy(() => import('@/pages/ingestion/AgentManagementPage'));
const AccessWizardPage = lazy(() => import('@/pages/ingestion/AccessWizardPage'));
const SourceStatusPage = lazy(() => import('@/pages/ingestion/SourceStatusPage'));

// 解析字段模块
const FieldMappingPage = lazy(() => import('@/pages/parsing/FieldMappingPage'));
const ParsingRulesPage = lazy(() => import('@/pages/parsing/ParsingRulesPage'));
const MaskingRulesPage = lazy(() => import('@/pages/parsing/MaskingRulesPage'));
const FieldDictionaryPage = lazy(() => import('@/pages/parsing/FieldDictionaryPage'));

// 索引存储模块
const IndexManagementPage = lazy(() => import('@/pages/storage/IndexManagementPage'));
const LifecyclePolicyPage = lazy(() => import('@/pages/storage/LifecyclePolicyPage'));
const BackupRecoveryPage = lazy(() => import('@/pages/storage/BackupRecoveryPage'));
const CapacityMonitoringPage = lazy(() => import('@/pages/storage/CapacityMonitoringPage'));

// 性能高可用模块
const PerformanceMonitoringPage = lazy(() => import('@/pages/performance/PerformanceMonitoringPage'));
const HealthCheckPage = lazy(() => import('@/pages/performance/HealthCheckPage'));
const AutoScalingPage = lazy(() => import('@/pages/performance/AutoScalingPage'));
const DisasterRecoveryPage = lazy(() => import('@/pages/performance/DisasterRecoveryPage'));

// 分布式追踪模块
const TraceSearchPage = lazy(() => import('@/pages/tracing/TraceSearchPage'));
const TraceAnalysisPage = lazy(() => import('@/pages/tracing/TraceAnalysisPage'));
const ServiceTopologyPage = lazy(() => import('@/pages/tracing/ServiceTopologyPage'));

// 报表中心模块
const ReportManagementPage = lazy(() => import('@/pages/reports/ReportManagementPage'));
const ScheduledTasksPage = lazy(() => import('@/pages/reports/ScheduledTasksPage'));
const DownloadRecordsPage = lazy(() => import('@/pages/reports/DownloadRecordsPage'));

// 安全审计模块
const UserManagementPage = lazy(() => import('@/pages/security/UserManagementPage'));
const RolePermissionsPage = lazy(() => import('@/pages/security/RolePermissionsPage'));
const AuditLogsPage = lazy(() => import('@/pages/security/AuditLogsPage'));
const LoginPolicyPage = lazy(() => import('@/pages/security/LoginPolicyPage'));

// 集成平台模块
const ApiDocsPage = lazy(() => import('@/pages/integration/ApiDocsPage'));
const WebhookManagementPage = lazy(() => import('@/pages/integration/WebhookManagementPage'));
const SdkDownloadPage = lazy(() => import('@/pages/integration/SdkDownloadPage'));
const PluginMarketPage = lazy(() => import('@/pages/integration/PluginMarketPage'));

// 成本管理模块
const CostOverviewPage = lazy(() => import('@/pages/cost/CostOverviewPage'));
const BudgetAlertsPage = lazy(() => import('@/pages/cost/BudgetAlertsPage'));
const OptimizationSuggestionsPage = lazy(() => import('@/pages/cost/OptimizationSuggestionsPage'));

// 系统设置模块
const SystemParametersPage = lazy(() => import('@/pages/settings/SystemParametersPage'));
const GlobalConfigPage = lazy(() => import('@/pages/settings/GlobalConfigPage'));
const ConfigVersionsPage = lazy(() => import('@/pages/settings/ConfigVersionsPage'));

// 帮助中心模块
const QuerySyntaxPage = lazy(() => import('@/pages/help/QuerySyntaxPage'));
const FAQPage = lazy(() => import('@/pages/help/FAQPage'));
const TicketPortalPage = lazy(() => import('@/pages/help/TicketPortalPage'));

// ============================================================================
// 路由组件
// ============================================================================

/**
 * 懒加载包装组件
 */
const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<LoadingScreen message="正在加载页面..." fullScreen={false} />}>
    {children}
  </Suspense>
);

/**
 * 受保护的布局路由
 */
const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedRoute>
    <AppLayout>
      <LazyPage>{children}</LazyPage>
    </AppLayout>
  </ProtectedRoute>
);

/**
 * 应用路由配置
 * 
 * 路由结构：
 * - 公开路由：/login, /register, /forgot-password（无需认证）
 * - 受保护路由：其他所有路由（需要认证）
 * - 404 回退：重定向到 Dashboard
 */
export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* ============================================================ */}
      {/* 公开路由 - 无需认证 */}
      {/* ============================================================ */}
      <Route path="/login" element={<LazyPage><LoginPage /></LazyPage>} />
      <Route path="/register" element={<LazyPage><RegisterPage /></LazyPage>} />
      <Route path="/forgot-password" element={<LazyPage><ForgotPasswordPage /></LazyPage>} />

      {/* ============================================================ */}
      {/* 受保护路由 - 需要认证 */}
      {/* ============================================================ */}
      
      {/* Dashboard 首页 */}
      <Route path="/dashboard" element={<ProtectedLayout><DashboardPage /></ProtectedLayout>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* 日志检索模块 */}
      <Route path="/search">
        <Route index element={<Navigate to="/search/realtime" replace />} />
        <Route path="realtime" element={<ProtectedLayout><RealtimeSearchPage /></ProtectedLayout>} />
        <Route path="history" element={<ProtectedLayout><SearchHistoryPage /></ProtectedLayout>} />
        <Route path="saved" element={<ProtectedLayout><SavedQueriesPage /></ProtectedLayout>} />
      </Route>

      {/* 日志分析模块 */}
      <Route path="/analysis">
        <Route index element={<Navigate to="/analysis/aggregate" replace />} />
        <Route path="aggregate" element={<ProtectedLayout><AggregateAnalysisPage /></ProtectedLayout>} />
        <Route path="anomaly" element={<ProtectedLayout><AnomalyDetectionPage /></ProtectedLayout>} />
        <Route path="clustering" element={<ProtectedLayout><LogClusteringPage /></ProtectedLayout>} />
      </Route>

      {/* 告警中心模块 */}
      <Route path="/alerts">
        <Route index element={<Navigate to="/alerts/list" replace />} />
        <Route path="list" element={<ProtectedLayout><AlertListPage /></ProtectedLayout>} />
        <Route path="rules" element={<ProtectedLayout><AlertRulesPage /></ProtectedLayout>} />
        <Route path="notification" element={<ProtectedLayout><NotificationConfigPage /></ProtectedLayout>} />
        <Route path="silence" element={<ProtectedLayout><SilencePolicyPage /></ProtectedLayout>} />
      </Route>

      {/* 采集接入模块 */}
      <Route path="/ingestion">
        <Route index element={<Navigate to="/ingestion/sources" replace />} />
        <Route path="sources" element={<ProtectedLayout><SourceManagementPage /></ProtectedLayout>} />
        <Route path="agents" element={<ProtectedLayout><AgentManagementPage /></ProtectedLayout>} />
        <Route path="wizard" element={<ProtectedLayout><AccessWizardPage /></ProtectedLayout>} />
        <Route path="status" element={<ProtectedLayout><SourceStatusPage /></ProtectedLayout>} />
      </Route>

      {/* 解析字段模块 */}
      <Route path="/parsing">
        <Route index element={<Navigate to="/parsing/mapping" replace />} />
        <Route path="mapping" element={<ProtectedLayout><FieldMappingPage /></ProtectedLayout>} />
        <Route path="rules" element={<ProtectedLayout><ParsingRulesPage /></ProtectedLayout>} />
        <Route path="masking" element={<ProtectedLayout><MaskingRulesPage /></ProtectedLayout>} />
        <Route path="dictionary" element={<ProtectedLayout><FieldDictionaryPage /></ProtectedLayout>} />
      </Route>

      {/* 索引存储模块 */}
      <Route path="/storage">
        <Route index element={<Navigate to="/storage/index" replace />} />
        <Route path="index" element={<ProtectedLayout><IndexManagementPage /></ProtectedLayout>} />
        <Route path="lifecycle" element={<ProtectedLayout><LifecyclePolicyPage /></ProtectedLayout>} />
        <Route path="backup" element={<ProtectedLayout><BackupRecoveryPage /></ProtectedLayout>} />
        <Route path="capacity" element={<ProtectedLayout><CapacityMonitoringPage /></ProtectedLayout>} />
      </Route>

      {/* 性能高可用模块 */}
      <Route path="/performance">
        <Route index element={<Navigate to="/performance/monitoring" replace />} />
        <Route path="monitoring" element={<ProtectedLayout><PerformanceMonitoringPage /></ProtectedLayout>} />
        <Route path="health" element={<ProtectedLayout><HealthCheckPage /></ProtectedLayout>} />
        <Route path="scaling" element={<ProtectedLayout><AutoScalingPage /></ProtectedLayout>} />
        <Route path="disaster" element={<ProtectedLayout><DisasterRecoveryPage /></ProtectedLayout>} />
      </Route>

      {/* 分布式追踪模块 */}
      <Route path="/tracing">
        <Route index element={<Navigate to="/tracing/search" replace />} />
        <Route path="search" element={<ProtectedLayout><TraceSearchPage /></ProtectedLayout>} />
        <Route path="analysis" element={<ProtectedLayout><TraceAnalysisPage /></ProtectedLayout>} />
        <Route path="topology" element={<ProtectedLayout><ServiceTopologyPage /></ProtectedLayout>} />
      </Route>

      {/* 报表中心模块 */}
      <Route path="/reports">
        <Route index element={<Navigate to="/reports/management" replace />} />
        <Route path="management" element={<ProtectedLayout><ReportManagementPage /></ProtectedLayout>} />
        <Route path="scheduled" element={<ProtectedLayout><ScheduledTasksPage /></ProtectedLayout>} />
        <Route path="downloads" element={<ProtectedLayout><DownloadRecordsPage /></ProtectedLayout>} />
      </Route>

      {/* 安全审计模块 */}
      <Route path="/security">
        <Route index element={<Navigate to="/security/users" replace />} />
        <Route path="users" element={<ProtectedLayout><UserManagementPage /></ProtectedLayout>} />
        <Route path="roles" element={<ProtectedLayout><RolePermissionsPage /></ProtectedLayout>} />
        <Route path="audit" element={<ProtectedLayout><AuditLogsPage /></ProtectedLayout>} />
        <Route path="login" element={<ProtectedLayout><LoginPolicyPage /></ProtectedLayout>} />
      </Route>

      {/* 集成平台模块 */}
      <Route path="/integration">
        <Route index element={<Navigate to="/integration/api" replace />} />
        <Route path="api" element={<ProtectedLayout><ApiDocsPage /></ProtectedLayout>} />
        <Route path="webhook" element={<ProtectedLayout><WebhookManagementPage /></ProtectedLayout>} />
        <Route path="sdk" element={<ProtectedLayout><SdkDownloadPage /></ProtectedLayout>} />
        <Route path="plugins" element={<ProtectedLayout><PluginMarketPage /></ProtectedLayout>} />
      </Route>

      {/* 成本管理模块 */}
      <Route path="/cost">
        <Route index element={<Navigate to="/cost/overview" replace />} />
        <Route path="overview" element={<ProtectedLayout><CostOverviewPage /></ProtectedLayout>} />
        <Route path="budget" element={<ProtectedLayout><BudgetAlertsPage /></ProtectedLayout>} />
        <Route path="optimization" element={<ProtectedLayout><OptimizationSuggestionsPage /></ProtectedLayout>} />
      </Route>

      {/* 系统设置模块 */}
      <Route path="/settings">
        <Route index element={<Navigate to="/settings/parameters" replace />} />
        <Route path="parameters" element={<ProtectedLayout><SystemParametersPage /></ProtectedLayout>} />
        <Route path="global" element={<ProtectedLayout><GlobalConfigPage /></ProtectedLayout>} />
        <Route path="versions" element={<ProtectedLayout><ConfigVersionsPage /></ProtectedLayout>} />
      </Route>

      {/* 帮助中心模块 */}
      <Route path="/help">
        <Route index element={<Navigate to="/help/syntax" replace />} />
        <Route path="syntax" element={<ProtectedLayout><QuerySyntaxPage /></ProtectedLayout>} />
        <Route path="faq" element={<ProtectedLayout><FAQPage /></ProtectedLayout>} />
        <Route path="ticket" element={<ProtectedLayout><TicketPortalPage /></ProtectedLayout>} />
      </Route>

      {/* ============================================================ */}
      {/* 404 回退 - 重定向到 Dashboard */}
      {/* ============================================================ */}
      <Route path="*" element={<Navigate to={FALLBACK_ROUTE} replace />} />
    </Routes>
  );
};

/**
 * 导出路由相关常量和类型
 */
export { PUBLIC_ROUTES, FALLBACK_ROUTE };

export default AppRoutes;
