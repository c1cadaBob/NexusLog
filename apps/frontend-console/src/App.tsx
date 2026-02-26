import React, { Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useThemeStore } from './stores/themeStore';
import { getAntdThemeConfig } from './theme/antdTheme';
import AppLayout from './components/layout/AppLayout';
import LoadingScreen from './components/layout/LoadingScreen';
import ProtectedRoute from './components/auth/ProtectedRoute';

// === 立即加载（首屏页面） ===
import Dashboard from './pages/Dashboard';

// === 懒加载页面 ===
// 认证
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));

// 日志检索
const RealtimeSearch = lazy(() => import('./pages/search/RealtimeSearch'));
const SearchHistory = lazy(() => import('./pages/search/SearchHistory'));
const SavedQueries = lazy(() => import('./pages/search/SavedQueries'));

// 日志分析
const AggregateAnalysis = lazy(() => import('./pages/analysis/AggregateAnalysis'));
const AnomalyDetection = lazy(() => import('./pages/analysis/AnomalyDetection'));
const LogClustering = lazy(() => import('./pages/analysis/LogClustering'));

// 告警中心
const AlertList = lazy(() => import('./pages/alerts/AlertList'));
const AlertRules = lazy(() => import('./pages/alerts/AlertRules'));
const NotificationConfig = lazy(() => import('./pages/alerts/NotificationConfig'));
const SilencePolicy = lazy(() => import('./pages/alerts/SilencePolicy'));

// 事件管理
const IncidentList = lazy(() => import('./pages/incidents/IncidentList'));
const IncidentDetail = lazy(() => import('./pages/incidents/IncidentDetail'));
const IncidentTimeline = lazy(() => import('./pages/incidents/IncidentTimeline'));
const IncidentAnalysis = lazy(() => import('./pages/incidents/IncidentAnalysis'));
const IncidentSLA = lazy(() => import('./pages/incidents/IncidentSLA'));
const IncidentArchive = lazy(() => import('./pages/incidents/IncidentArchive'));

// 采集与接入
const SourceManagement = lazy(() => import('./pages/ingestion/SourceManagement'));
const AgentManagement = lazy(() => import('./pages/ingestion/AgentManagement'));
const AccessWizard = lazy(() => import('./pages/ingestion/AccessWizard'));
const SourceStatus = lazy(() => import('./pages/ingestion/SourceStatus'));

// 解析与字段
const FieldMapping = lazy(() => import('./pages/parsing/FieldMapping'));
const ParsingRules = lazy(() => import('./pages/parsing/ParsingRules'));
const MaskingRules = lazy(() => import('./pages/parsing/MaskingRules'));
const FieldDictionary = lazy(() => import('./pages/parsing/FieldDictionary'));

// 索引与存储
const IndexManagement = lazy(() => import('./pages/storage/IndexManagement'));
const LifecyclePolicy = lazy(() => import('./pages/storage/LifecyclePolicy'));
const BackupRecovery = lazy(() => import('./pages/storage/BackupRecovery'));
const CapacityMonitoring = lazy(() => import('./pages/storage/CapacityMonitoring'));

// 性能与高可用
const PerformanceMonitoring = lazy(() => import('./pages/performance/PerformanceMonitoring'));
const HealthCheck = lazy(() => import('./pages/performance/HealthCheck'));
const AutoScaling = lazy(() => import('./pages/performance/AutoScaling'));
const DisasterRecovery = lazy(() => import('./pages/performance/DisasterRecovery'));

// 分布式追踪
const TraceSearch = lazy(() => import('./pages/tracing/TraceSearch'));
const TraceAnalysis = lazy(() => import('./pages/tracing/TraceAnalysis'));
const ServiceTopology = lazy(() => import('./pages/tracing/ServiceTopology'));

// 报表中心
const ReportManagement = lazy(() => import('./pages/reports/ReportManagement'));
const ScheduledTasks = lazy(() => import('./pages/reports/ScheduledTasks'));
const DownloadRecords = lazy(() => import('./pages/reports/DownloadRecords'));

// 安全与审计
const UserManagement = lazy(() => import('./pages/security/UserManagement'));
const RolePermissions = lazy(() => import('./pages/security/RolePermissions'));
const AuditLogs = lazy(() => import('./pages/security/AuditLogs'));
const LoginPolicy = lazy(() => import('./pages/security/LoginPolicy'));

// 集成与开放平台
const ApiDocs = lazy(() => import('./pages/integration/ApiDocs'));
const WebhookManagement = lazy(() => import('./pages/integration/WebhookManagement'));
const SdkDownload = lazy(() => import('./pages/integration/SdkDownload'));
const PluginMarket = lazy(() => import('./pages/integration/PluginMarket'));

// 成本管理
const CostOverview = lazy(() => import('./pages/cost/CostOverview'));
const BudgetAlerts = lazy(() => import('./pages/cost/BudgetAlerts'));
const OptimizationSuggestions = lazy(() => import('./pages/cost/OptimizationSuggestions'));

// 系统设置
const SystemParameters = lazy(() => import('./pages/settings/SystemParameters'));
const GlobalConfig = lazy(() => import('./pages/settings/GlobalConfig'));
const ConfigVersions = lazy(() => import('./pages/settings/ConfigVersions'));

// 帮助中心
const QuerySyntax = lazy(() => import('./pages/help/QuerySyntax'));
const FAQ = lazy(() => import('./pages/help/FAQ'));
const TicketPortal = lazy(() => import('./pages/help/TicketPortal'));


const App: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const themeConfig = getAntdThemeConfig(isDark);

  return (
    <ConfigProvider theme={themeConfig} locale={zhCN}>
      <AntdApp>
        <HashRouter>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              {/* 公开路由 */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* 受保护路由 */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Dashboard />} />

                {/* 日志检索 */}
                <Route path="/search/realtime" element={<RealtimeSearch />} />
                <Route path="/search/history" element={<SearchHistory />} />
                <Route path="/search/saved" element={<SavedQueries />} />

                {/* 日志分析 */}
                <Route path="/analysis/aggregate" element={<AggregateAnalysis />} />
                <Route path="/analysis/anomaly" element={<AnomalyDetection />} />
                <Route path="/analysis/clustering" element={<LogClustering />} />

                {/* 告警中心 */}
                <Route path="/alerts/list" element={<AlertList />} />
                <Route path="/alerts/rules" element={<AlertRules />} />
                <Route path="/alerts/notifications" element={<NotificationConfig />} />
                <Route path="/alerts/silence" element={<SilencePolicy />} />

                {/* 事件管理 */}
                <Route path="/incidents/list" element={<IncidentList />} />
                <Route path="/incidents/detail/:id" element={<IncidentDetail />} />
                <Route path="/incidents/timeline" element={<IncidentTimeline />} />
                <Route path="/incidents/analysis" element={<IncidentAnalysis />} />
                <Route path="/incidents/sla" element={<IncidentSLA />} />
                <Route path="/incidents/archive" element={<IncidentArchive />} />

                {/* 采集与接入 */}
                <Route path="/ingestion/sources" element={<SourceManagement />} />
                <Route path="/ingestion/agents" element={<AgentManagement />} />
                <Route path="/ingestion/wizard" element={<AccessWizard />} />
                <Route path="/ingestion/status" element={<SourceStatus />} />

                {/* 解析与字段 */}
                <Route path="/parsing/mapping" element={<FieldMapping />} />
                <Route path="/parsing/rules" element={<ParsingRules />} />
                <Route path="/parsing/masking" element={<MaskingRules />} />
                <Route path="/parsing/dictionary" element={<FieldDictionary />} />

                {/* 索引与存储 */}
                <Route path="/storage/indices" element={<IndexManagement />} />
                <Route path="/storage/ilm" element={<LifecyclePolicy />} />
                <Route path="/storage/backup" element={<BackupRecovery />} />
                <Route path="/storage/capacity" element={<CapacityMonitoring />} />

                {/* 性能与高可用 */}
                <Route path="/performance/monitoring" element={<PerformanceMonitoring />} />
                <Route path="/performance/health" element={<HealthCheck />} />
                <Route path="/performance/scaling" element={<AutoScaling />} />
                <Route path="/performance/dr" element={<DisasterRecovery />} />

                {/* 分布式追踪 */}
                <Route path="/tracing/search" element={<TraceSearch />} />
                <Route path="/tracing/analysis" element={<TraceAnalysis />} />
                <Route path="/tracing/topology" element={<ServiceTopology />} />

                {/* 报表中心 */}
                <Route path="/reports/management" element={<ReportManagement />} />
                <Route path="/reports/scheduled" element={<ScheduledTasks />} />
                <Route path="/reports/downloads" element={<DownloadRecords />} />

                {/* 安全与审计 */}
                <Route path="/security/users" element={<UserManagement />} />
                <Route path="/security/roles" element={<RolePermissions />} />
                <Route path="/security/audit" element={<AuditLogs />} />
                <Route path="/security/login-policy" element={<LoginPolicy />} />

                {/* 集成与开放平台 */}
                <Route path="/integration/api" element={<ApiDocs />} />
                <Route path="/integration/webhook" element={<WebhookManagement />} />
                <Route path="/integration/sdk" element={<SdkDownload />} />
                <Route path="/integration/plugins" element={<PluginMarket />} />

                {/* 成本管理 */}
                <Route path="/cost/overview" element={<CostOverview />} />
                <Route path="/cost/budgets" element={<BudgetAlerts />} />
                <Route path="/cost/optimization" element={<OptimizationSuggestions />} />

                {/* 系统设置 */}
                <Route path="/settings/parameters" element={<SystemParameters />} />
                <Route path="/settings/global" element={<GlobalConfig />} />
                <Route path="/settings/versions" element={<ConfigVersions />} />

                {/* 帮助中心 */}
                <Route path="/help/syntax" element={<QuerySyntax />} />
                <Route path="/help/faq" element={<FAQ />} />
                <Route path="/help/tickets" element={<TicketPortal />} />

                {/* 404 回退到 Dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </AntdApp>
    </ConfigProvider>
  );
};

export default App;
