# 模块十三：用户体验

> **文档版本**: v1.0  
> **创建日期**: 2026-01-29  
> **所属模块**: 模块十三：用户体验  
> **需求编号**: 

---

**模块概述**

用户体验模块专注于提升系统的易用性和交互体验。通过现代化的界面设计、流畅的交互动画、响应式布局、智能搜索等功能，为用户提供高效、愉悦的使用体验。支持深色模式、个性化配置、快捷键操作，满足不同用户的使用习惯。

**核心能力**:
- 现代化的扁平化设计风格
- 响应式布局，适配各种屏幕尺寸
- 流畅的页面切换和加载动画
- 虚拟滚动和懒加载优化性能
- 智能搜索和高级过滤
- 深色模式和主题定制
- 快捷键操作和个性化配置

**技术栈选型**

| 技术类别 | 技术选型 | 版本要求 | 用途说明 |
|---------|---------|---------|---------|
| 前端框架 | React | 18+ | UI 框架 |
| 类型系统 | TypeScript | 5+ | 类型安全 |
| UI 组件库 | Ant Design | 5+ | 组件库 |
| 状态管理 | Zustand | 4+ | 轻量级状态管理 |
| 动画库 | Framer Motion | 11+ | 动画效果 |
| 虚拟滚动 | @tanstack/react-virtual | 3+ | 大数据列表优化 |
| 代码高亮 | Prism.js | 1.29+ | 代码语法高亮 |
| 图表库 | ECharts | 5+ | 数据可视化 |
| 日期处理 | Day.js | 1.11+ | 日期时间处理 |
| HTTP 客户端 | Axios | 1.6+ | API 请求 |
| 路由 | React Router | 6+ | 页面路由 |
| 构建工具 | Vite | 5+ | 快速构建 |

**架构设计**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        用户体验架构                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      设计系统层                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  设计令牌 (Design Tokens)                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │  │
│  │  │  │ 颜色系统  │  │ 字体系统  │  │ 间距系统  │  │ 阴影系统  │  │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  主题系统                                                  │ │  │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                │ │  │
│  │  │  │ 浅色主题  │  │ 深色主题  │  │ 自定义   │                │ │  │
│  │  │  └──────────┘  └──────────┘  └──────────┘                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      组件层级                                     │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  基础组件层                                                │ │  │
│  │  │  • Button, Input, Select, Table, Modal                     │ │  │
│  │  │  • Card, Tag, Badge, Tooltip, Dropdown                     │ │  │
│  │  │  • Form, Checkbox, Radio, Switch                           │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                            ↓                                      │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  业务组件层                                                │ │  │
│  │  │  • LogCard, AlertBadge, TimeRangePicker                    │ │  │
│  │  │  • SearchBar, FilterPanel, ChartWidget                     │ │  │
│  │  │  • UserAvatar, NotificationBell, ThemeToggle               │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │                            ↓                                      │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  页面模板层                                                │ │  │
│  │  │  • DashboardLayout, SearchLayout, DetailLayout             │ │  │
│  │  │  • SettingsLayout, ReportLayout                            │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      响应式布局层                                 │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  断点系统                                                  │ │  │
│  │  │  • xs: < 576px   (手机)                                    │ │  │
│  │  │  • sm: ≥ 576px   (平板竖屏)                                │ │  │
│  │  │  • md: ≥ 768px   (平板横屏)                                │ │  │
│  │  │  • lg: ≥ 992px   (小型桌面)                                │ │  │
│  │  │  • xl: ≥ 1200px  (标准桌面)                                │ │  │
│  │  │  • xxl: ≥ 1600px (大型桌面)                                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  栅格系统                                                  │ │  │
│  │  │  • 24 列栅格布局                                           │ │  │
│  │  │  • 响应式间距（gutter）                                    │ │  │
│  │  │  • 弹性布局（flex）                                        │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      交互动画层                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  页面切换动画                                              │ │  │
│  │  │  • 淡入淡出（Fade）                                        │ │  │
│  │  │  • 滑动（Slide）                                           │ │  │
│  │  │  • 缩放（Scale）                                           │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  加载动画                                                  │ │  │
│  │  │  • 骨架屏（Skeleton）                                      │ │  │
│  │  │  • 进度条（Progress）                                      │ │  │
│  │  │  • 加载指示器（Spinner）                                   │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  微交互动画                                                │ │  │
│  │  │  • 按钮点击反馈                                            │ │  │
│  │  │  • 卡片悬停效果                                            │ │  │
│  │  │  • 展开折叠动画                                            │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      性能优化层                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  虚拟滚动                                                  │ │  │
│  │  │  • 大数据列表渲染优化                                      │ │  │
│  │  │  • 动态行高计算                                            │ │  │
│  │  │  • 预渲染（Overscan）                                      │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  懒加载                                                    │ │  │
│  │  │  • 图片懒加载                                              │ │  │
│  │  │  • 组件懒加载                                              │ │  │
│  │  │  • 路由懒加载                                              │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  代码分割                                                  │ │  │
│  │  │  • 路由级别分割                                            │ │  │
│  │  │  • 组件级别分割                                            │ │  │
│  │  │  • 第三方库分割                                            │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      个性化配置层                                 │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  用户偏好设置                                              │ │  │
│  │  │  • 主题选择（浅色/深色）                                   │ │  │
│  │  │  • 语言选择                                                │ │  │
│  │  │  • 时区设置                                                │ │  │
│  │  │  • 日期格式                                                │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  │  ┌────────────────────────────────────────────────────────────┐ │  │
│  │  │  快捷键配置                                                │ │  │
│  │  │  • 全局快捷键                                              │ │  │
│  │  │  • 页面快捷键                                              │ │  │
│  │  │  • 自定义快捷键                                            │ │  │
│  │  └────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**架构说明**:
1. **设计系统层**: 统一的设计令牌和主题系统
2. **组件层级**: 基础组件、业务组件、页面模板三层架构
3. **响应式布局层**: 6个断点和24列栅格系统
4. **交互动画层**: 页面切换、加载、微交互动画
5. **性能优化层**: 虚拟滚动、懒加载、代码分割
6. **个性化配置层**: 用户偏好和快捷键配置

### 13.4 需求详情



#### 需求 13-44: 界面设计与交互 [MVP]

**用户故事**:
作为运维工程师，我希望系统界面美观、交互流畅，以便提升工作效率和使用体验。

**验收标准**:

1. THE System SHALL 采用现代化的扁平化设计风格，保持界面简洁美观
2. THE System SHALL 采用响应式设计，支持 6 种屏幕断点（xs/sm/md/lg/xl/xxl）
3. THE System SHALL 在页面切换时提供平滑过渡动画，过渡时间 < 300ms
4. WHEN 加载大量数据时，THE System SHALL 显示骨架屏或进度条
5. THE System SHALL 提供信息层次分明的布局，重要信息放置在明显位置
6. THE System SHALL 支持虚拟滚动展示大量日志数据，单页可展示 10000+ 条记录
7. THE System SHALL 使用懒加载方式加载图片和组件，减少首屏加载时间
8. THE System SHALL 提供流畅的微交互动画（按钮点击、卡片悬停、展开折叠）
9. THE System SHALL 支持深色模式和浅色模式切换，切换时平滑过渡
10. THE System SHALL 通过配置中心管理 UI 配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```typescript
// web/src/components/VirtualLogList.tsx
import React, { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';

interface VirtualLogListProps {
  logs: LogEntry[];
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
}

// 虚拟滚动日志列表
export const VirtualLogList: React.FC<VirtualLogListProps> = ({
  logs,
  onLoadMore,
  hasMore,
  loading
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // 初始化虚拟滚动
  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,  // 预估每行高度
    overscan: 10,  // 预渲染 10 行
  });
  
  // 无限滚动检测
  useEffect(() => {
    const lastItem = virtualizer.getVirtualItems().at(-1);
    
    if (lastItem && lastItem.index >= logs.length - 5 && hasMore && !loading) {
      onLoadMore();
    }
  }, [virtualizer.getVirtualItems(), hasMore, loading, onLoadMore]);
  
  return (
    <div
      ref={parentRef}
      className="virtual-log-list"
      style={{
        height: '600px',
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <motion.div
            key={virtualRow.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <LogCard log={logs[virtualRow.index]} />
          </motion.div>
        ))}
      </div>
      
      {/* 加载指示器 */}
      {loading && (
        <div className="loading-indicator">
          <Spin tip="加载中..." />
        </div>
      )}
    </div>
  );
};


// web/src/components/PageTransition.tsx
import { motion } from 'framer-motion';

// 页面切换动画配置
const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: 'easeInOut',
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: 0.2,
      ease: 'easeInOut',
    },
  },
};

// 页面切换包装组件
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    {children}
  </motion.div>
);


// web/src/components/LoadingSkeleton.tsx
import { Skeleton, Card } from 'antd';

// 日志卡片骨架屏
export const LogCardSkeleton: React.FC = () => (
  <Card className="log-card-skeleton">
    <Skeleton.Input active style={{ width: 100, marginBottom: 8 }} />
    <Skeleton.Input active style={{ width: '80%', marginBottom: 8 }} />
    <Skeleton.Input active style={{ width: '60%' }} />
  </Card>
);

// 骨架屏列表
export const SkeletonList: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="skeleton-list">
    {Array.from({ length: count }).map((_, index) => (
      <LogCardSkeleton key={index} />
    ))}
  </div>
);


// web/src/components/ResponsiveLayout.tsx
import { Grid, Layout } from 'antd';
import { useBreakpoint } from 'antd';

const { Header, Sider, Content } = Layout;

// 响应式布局配置
const getLayoutConfig = (screens: Record<string, boolean>) => {
  if (screens.xxl) return { sidebarWidth: 280, columns: 4, collapsed: false };
  if (screens.xl) return { sidebarWidth: 240, columns: 3, collapsed: false };
  if (screens.lg) return { sidebarWidth: 200, columns: 2, collapsed: false };
  if (screens.md) return { sidebarWidth: 80, columns: 2, collapsed: true };
  return { sidebarWidth: 0, columns: 1, collapsed: true };
};

// 响应式仪表盘布局
export const ResponsiveDashboard: React.FC = () => {
  const screens = useBreakpoint();
  const config = getLayoutConfig(screens);
  
  return (
    <Layout className="dashboard-layout">
      {/* 侧边栏 */}
      {config.sidebarWidth > 0 && (
        <Sider
          width={config.sidebarWidth}
          collapsed={config.collapsed}
          collapsedWidth={config.collapsed ? 80 : 0}
          className="dashboard-sider"
        >
          <Sidebar collapsed={config.collapsed} />
        </Sider>
      )}
      
      {/* 主内容区 */}
      <Layout>
        <Header className="dashboard-header">
          <DashboardHeader />
        </Header>
        
        <Content className="dashboard-content">
          <Row gutter={[16, 16]}>
            {widgets.map((widget, index) => (
              <Col
                key={index}
                xs={24}
                sm={24}
                md={24 / Math.min(config.columns, 2)}
                lg={24 / config.columns}
                xl={24 / config.columns}
                xxl={24 / config.columns}
              >
                <WidgetCard widget={widget} />
              </Col>
            ))}
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};


// web/src/hooks/useTheme.ts
import { useState, useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';

// 主题配置
export const useTheme = () => {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark';
  });
  
  // 切换主题
  const toggleTheme = () => {
    setIsDark(!isDark);
    localStorage.setItem('theme', !isDark ? 'dark' : 'light');
  };
  
  // 获取主题配置
  const themeConfig = {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 4,
      fontSize: 14,
    },
  };
  
  return { isDark, toggleTheme, themeConfig };
};


// web/src/components/ThemeProvider.tsx
import { ConfigProvider } from 'antd';
import { useTheme } from '@/hooks/useTheme';

// 主题提供者
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { themeConfig } = useTheme();
  
  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
};


// web/src/components/LazyImage.tsx
import { useState, useEffect, useRef } from 'react';

interface LazyImageProps {
  src: string;
  alt: string;
  placeholder?: string;
  className?: string;
}

// 懒加载图片组件
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholder = '/placeholder.png',
  className
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  
  useEffect(() => {
    // 使用 Intersection Observer 实现懒加载
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
      }
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => {
      observer.disconnect();
    };
  }, [src]);
  
  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`lazy-image ${isLoaded ? 'loaded' : ''} ${className}`}
      onLoad={() => setIsLoaded(true)}
    />
  );
};


// web/src/components/MicroInteractions.tsx
import { motion } from 'framer-motion';
import { Button, Card } from 'antd';

// 按钮点击动画
export const AnimatedButton: React.FC<ButtonProps> = (props) => (
  <motion.div
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    transition={{ duration: 0.2 }}
  >
    <Button {...props} />
  </motion.div>
);

// 卡片悬停动画
export const AnimatedCard: React.FC<CardProps> = (props) => (
  <motion.div
    whileHover={{
      y: -4,
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.1)',
    }}
    transition={{ duration: 0.2 }}
  >
    <Card {...props} />
  </motion.div>
);

// 展开折叠动画
export const ExpandableSection: React.FC<{
  expanded: boolean;
  children: React.ReactNode;
}> = ({ expanded, children }) => (
  <motion.div
    initial={false}
    animate={{
      height: expanded ? 'auto' : 0,
      opacity: expanded ? 1 : 0,
    }}
    transition={{
      duration: 0.3,
      ease: 'easeInOut',
    }}
    style={{ overflow: 'hidden' }}
  >
    {children}
  </motion.div>
);
```

**关键实现点**:

1. 使用 @tanstack/react-virtual 实现虚拟滚动，支持 10000+ 条日志展示
2. 使用 Framer Motion 实现流畅的页面切换和微交互动画
3. 响应式布局支持 6 种屏幕断点，自动适配不同设备
4. 骨架屏加载提升用户体验，避免白屏等待
5. 使用 Intersection Observer 实现图片和组件懒加载
6. 深色模式和浅色模式平滑切换，使用 CSS 变量实现
7. 所有动画时长控制在 300ms 以内，保证流畅性

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| ui_theme | string | "light" | 默认主题（light/dark） |
| animation_enabled | bool | true | 是否启用动画 |
| animation_duration | int | 300 | 动画时长（毫秒） |
| virtual_scroll_enabled | bool | true | 是否启用虚拟滚动 |
| virtual_scroll_overscan | int | 10 | 虚拟滚动预渲染行数 |
| lazy_load_enabled | bool | true | 是否启用懒加载 |
| skeleton_enabled | bool | true | 是否显示骨架屏 |
| responsive_breakpoints | map | {} | 响应式断点配置 |

**热更新机制**:

- 更新方式: WebSocket + LocalStorage
- 生效时间: 立即生效（刷新页面生效）
- 回滚策略: 配置验证失败时保持原配置，显示错误提示

**热更新验收标准**:

1. THE System SHALL 在配置变更后通过 WebSocket 推送到所有在线用户
2. WHEN 主题配置变更时，THE System SHALL 在用户刷新页面后生效
3. THE System SHALL 支持通过 API 查询当前生效的 UI 配置
4. THE System SHALL 记录所有 UI 配置变更的审计日志
5. WHEN 动画时长变更时，THE System SHALL 验证配置的合理性（>= 100ms）

---



#### 需求 13-45: 日志详情与批量操作 [MVP]

**用户故事**:
作为运维工程师，我希望能够查看日志详细信息并进行批量操作，以便高效处理日志事件。

**验收标准**:

1. THE System SHALL 采用卡片式设计展示日志数据，每条日志为一个可展开的卡片
2. WHEN 用户点击展开日志卡片时，THE System SHALL 展示详细的日志内容、错误堆栈、事件源
3. THE System SHALL 提供日志详情页面，包含时间戳、来源、级别、堆栈、请求ID、关联信息
4. THE System SHALL 对技术性字段提供工具提示（Tooltip）或文档链接
5. THE System SHALL 支持对多个日志条目进行批量操作（标记、删除、导出）
6. THE System SHALL 支持智能批量导出，按日期、错误类型等进行分段导出
7. THE System SHALL 支持批量操作的撤销功能，撤销时间窗口 30 秒
8. THE System SHALL 在批量操作时显示进度条，操作完成后显示结果统计
9. THE System SHALL 支持日志的快速复制（一键复制全部内容）
10. THE System SHALL 通过配置中心管理批量操作配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```typescript
// web/src/components/LogCard.tsx
import React, { useState } from 'react';
import { Card, Tag, Checkbox, Button, Tooltip, Descriptions, Typography } from 'antd';
import { CopyOutlined, ExpandOutlined, LinkOutlined } from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import Prism from 'prismjs';

const { Paragraph, Text } = Typography;

interface LogCardProps {
  log: LogEntry;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
}

// 日志级别颜色映射
const levelColors: Record<string, string> = {
  DEBUG: '#8c8c8c',
  INFO: '#1890ff',
  WARN: '#faad14',
  ERROR: '#ff4d4f',
  FATAL: '#cf1322',
};

// 日志卡片组件
export const LogCard: React.FC<LogCardProps> = ({ log, selected, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  
  // 复制日志内容
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = JSON.stringify(log, null, 2);
    navigator.clipboard.writeText(content);
    message.success('已复制到剪贴板');
  };
  
  // 查看追踪
  const handleViewTrace = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (log.traceId) {
      window.open(`/trace/${log.traceId}`, '_blank');
    }
  };
  
  return (
    <Card
      className={`log-card ${expanded ? 'expanded' : ''} ${selected ? 'selected' : ''}`}
      hoverable
      onClick={() => setExpanded(!expanded)}
    >
      {/* 卡片头部 */}
      <div className="log-card-header">
        <Checkbox
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSelect(log.id, e.target.checked)}
        />
        
        <Tag color={levelColors[log.level]}>{log.level}</Tag>
        
        <Tooltip title={log.timestamp}>
          <span className="timestamp">{formatRelativeTime(log.timestamp)}</span>
        </Tooltip>
        
        <Tag>{log.service}</Tag>
        
        <Text className="message-preview" ellipsis={{ tooltip: log.message }}>
          {log.message}
        </Text>
        
        <div className="card-actions">
          <Tooltip title="复制">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={handleCopy}
            />
          </Tooltip>
          
          {log.traceId && (
            <Tooltip title="查看追踪">
              <Button
                type="text"
                size="small"
                icon={<LinkOutlined />}
                onClick={handleViewTrace}
              />
            </Tooltip>
          )}
          
          <Button
            type="text"
            size="small"
            icon={<ExpandOutlined />}
          />
        </div>
      </div>
      
      {/* 展开内容 */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="log-card-body"
          >
            {/* 详细信息 */}
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="时间戳">
                {log.timestamp}
              </Descriptions.Item>
              
              <Descriptions.Item label="服务">
                <Tooltip title="点击查看服务详情">
                  <a href={`/services/${log.service}`}>{log.service}</a>
                </Tooltip>
              </Descriptions.Item>
              
              <Descriptions.Item label="实例">
                {log.instance || 'N/A'}
              </Descriptions.Item>
              
              <Descriptions.Item label="日志级别">
                <Tag color={levelColors[log.level]}>{log.level}</Tag>
              </Descriptions.Item>
              
              {log.traceId && (
                <Descriptions.Item label="Trace ID">
                  <Tooltip title="点击查看完整追踪链路">
                    <a href={`/trace/${log.traceId}`} target="_blank">
                      {log.traceId}
                    </a>
                  </Tooltip>
                </Descriptions.Item>
              )}
              
              {log.requestId && (
                <Descriptions.Item label="请求 ID">
                  {log.requestId}
                </Descriptions.Item>
              )}
              
              {log.userId && (
                <Descriptions.Item label="用户 ID">
                  {log.userId}
                </Descriptions.Item>
              )}
              
              {log.tags && log.tags.length > 0 && (
                <Descriptions.Item label="标签" span={2}>
                  {log.tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </Descriptions.Item>
              )}
            </Descriptions>
            
            {/* 日志消息 */}
            <div className="log-message">
              <Text strong>消息:</Text>
              <Paragraph copyable>{log.message}</Paragraph>
            </div>
            
            {/* 错误堆栈 */}
            {log.stackTrace && (
              <div className="log-stacktrace">
                <Text strong>堆栈信息:</Text>
                <pre className="language-java">
                  <code
                    dangerouslySetInnerHTML={{
                      __html: Prism.highlight(
                        log.stackTrace,
                        Prism.languages.java,
                        'java'
                      ),
                    }}
                  />
                </pre>
                <Button
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(log.stackTrace);
                    message.success('堆栈信息已复制');
                  }}
                >
                  复制堆栈
                </Button>
              </div>
            )}
            
            {/* 自定义字段 */}
            {log.fields && Object.keys(log.fields).length > 0 && (
              <div className="log-fields">
                <Text strong>自定义字段:</Text>
                <Descriptions column={2} size="small">
                  {Object.entries(log.fields).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              </div>
            )}
            
            {/* 操作按钮 */}
            <div className="log-actions">
              <Button type="primary" size="small">
                标记为已处理
              </Button>
              <Button size="small">创建工单</Button>
              <Button size="small">查看上下文</Button>
              <Button size="small" danger>
                删除
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
};


// web/src/components/BatchOperations.tsx
import React, { useState } from 'react';
import { Button, Dropdown, Modal, Progress, message, Space } from 'antd';
import {
  DeleteOutlined,
  ExportOutlined,
  CheckOutlined,
  DownOutlined,
} from '@ant-design/icons';

interface BatchOperationsProps {
  selectedIds: string[];
  onClearSelection: () => void;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onBatchExport: (ids: string[], format: string) => Promise<void>;
  onBatchMarkProcessed: (ids: string[]) => Promise<void>;
}

// 批量操作组件
export const BatchOperations: React.FC<BatchOperationsProps> = ({
  selectedIds,
  onClearSelection,
  onBatchDelete,
  onBatchExport,
  onBatchMarkProcessed,
}) => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [undoTimer, setUndoTimer] = useState<NodeJS.Timeout | null>(null);
  
  // 批量删除
  const handleBatchDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedIds.length} 条日志吗？`,
      okText: '确定',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setLoading(true);
        setProgress(0);
        
        try {
          // 模拟进度
          const interval = setInterval(() => {
            setProgress((prev) => Math.min(prev + 10, 90));
          }, 100);
          
          await onBatchDelete(selectedIds);
          
          clearInterval(interval);
          setProgress(100);
          
          // 显示撤销提示
          const key = `delete-${Date.now()}`;
          message.success({
            content: (
              <span>
                已删除 {selectedIds.length} 条日志
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleUndo(key)}
                >
                  撤销
                </Button>
              </span>
            ),
            key,
            duration: 30,
          });
          
          // 设置撤销定时器
          const timer = setTimeout(() => {
            message.destroy(key);
          }, 30000);
          
          setUndoTimer(timer);
          onClearSelection();
        } catch (error) {
          message.error('删除失败: ' + error.message);
        } finally {
          setLoading(false);
          setProgress(0);
        }
      },
    });
  };
  
  // 批量导出
  const handleBatchExport = async (format: string) => {
    setLoading(true);
    setProgress(0);
    
    try {
      const interval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90));
      }, 200);
      
      await onBatchExport(selectedIds, format);
      
      clearInterval(interval);
      setProgress(100);
      
      message.success(`已导出 ${selectedIds.length} 条日志`);
      onClearSelection();
    } catch (error) {
      message.error('导出失败: ' + error.message);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };
  
  // 批量标记为已处理
  const handleBatchMarkProcessed = async () => {
    setLoading(true);
    
    try {
      await onBatchMarkProcessed(selectedIds);
      message.success(`已标记 ${selectedIds.length} 条日志为已处理`);
      onClearSelection();
    } catch (error) {
      message.error('标记失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 撤销操作
  const handleUndo = (key: string) => {
    if (undoTimer) {
      clearTimeout(undoTimer);
      setUndoTimer(null);
    }
    message.destroy(key);
    message.info('操作已撤销');
    // TODO: 实现撤销逻辑
  };
  
  // 导出菜单
  const exportMenu = {
    items: [
      {
        key: 'json',
        label: '导出为 JSON',
        onClick: () => handleBatchExport('json'),
      },
      {
        key: 'csv',
        label: '导出为 CSV',
        onClick: () => handleBatchExport('csv'),
      },
      {
        key: 'txt',
        label: '导出为 TXT',
        onClick: () => handleBatchExport('txt'),
      },
    ],
  };
  
  if (selectedIds.length === 0) {
    return null;
  }
  
  return (
    <div className="batch-operations">
      <Space>
        <span>已选择 {selectedIds.length} 条日志</span>
        
        <Button
          icon={<CheckOutlined />}
          onClick={handleBatchMarkProcessed}
          loading={loading}
        >
          标记为已处理
        </Button>
        
        <Dropdown menu={exportMenu}>
          <Button icon={<ExportOutlined />}>
            导出 <DownOutlined />
          </Button>
        </Dropdown>
        
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={handleBatchDelete}
          loading={loading}
        >
          删除
        </Button>
        
        <Button onClick={onClearSelection}>取消选择</Button>
      </Space>
      
      {/* 进度条 */}
      {loading && progress > 0 && (
        <Progress
          percent={progress}
          size="small"
          status={progress === 100 ? 'success' : 'active'}
        />
      )}
    </div>
  );
};


// web/src/hooks/useBatchSelection.ts
import { useState, useCallback } from 'react';

// 批量选择 Hook
export const useBatchSelection = () => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // 选择/取消选择单个项目
  const toggleSelection = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) =>
      selected ? [...prev, id] : prev.filter((item) => item !== id)
    );
  }, []);
  
  // 全选
  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(ids);
  }, []);
  
  // 取消全选
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);
  
  // 反选
  const invertSelection = useCallback((allIds: string[]) => {
    setSelectedIds((prev) => {
      const selected = new Set(prev);
      return allIds.filter((id) => !selected.has(id));
    });
  }, []);
  
  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    invertSelection,
  };
};
```

**关键实现点**:

1. 卡片式设计展示日志，支持展开查看详细信息
2. 使用 Prism.js 实现代码高亮，美化堆栈信息显示
3. 支持批量操作（标记、删除、导出），显示操作进度
4. 批量删除支持 30 秒撤销功能，避免误操作
5. 智能批量导出支持 JSON、CSV、TXT 三种格式
6. 提供工具提示和文档链接，帮助理解技术性字段
7. 一键复制功能，快速复制日志内容和堆栈信息

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| card_expand_animation | bool | true | 是否启用卡片展开动画 |
| batch_operation_enabled | bool | true | 是否启用批量操作 |
| batch_size_limit | int | 1000 | 批量操作最大数量 |
| undo_timeout | int | 30 | 撤销超时时间（秒） |
| export_formats | array | ["json","csv","txt"] | 支持的导出格式 |
| code_highlight_enabled | bool | true | 是否启用代码高亮 |
| tooltip_enabled | bool | true | 是否显示工具提示 |

**热更新机制**:

- 更新方式: WebSocket + LocalStorage
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置，显示错误提示

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的批量操作限制
2. WHEN 撤销超时时间变更时，THE System SHALL 在下次批量操作时生效
3. THE System SHALL 支持通过 API 查询当前生效的批量操作配置
4. THE System SHALL 记录所有批量操作配置变更的审计日志
5. WHEN 批量大小限制变更时，THE System SHALL 验证配置的合理性（>= 1）

---



#### 需求 13-46: 智能搜索与过滤 [MVP]

**用户故事**:
作为运维工程师，我希望能够快速搜索和过滤日志，以便精准定位问题。

**验收标准**:

1. THE System SHALL 提供智能搜索框，支持全文搜索、字段搜索、正则表达式搜索
2. THE System SHALL 支持搜索建议和自动补全，响应时间 < 100ms
3. THE System SHALL 提供高级过滤面板，支持多条件组合过滤（AND/OR/NOT）
4. THE System SHALL 支持保存常用搜索条件为快捷过滤器
5. THE System SHALL 提供搜索历史记录，保留最近 20 条搜索
6. THE System SHALL 支持时间范围快速选择（最近1小时、今天、最近7天等）
7. THE System SHALL 在搜索结果中高亮显示匹配的关键词
8. THE System SHALL 支持搜索结果的实时更新，新日志自动匹配搜索条件
9. THE System SHALL 提供搜索语法帮助和示例
10. THE System SHALL 通过配置中心管理搜索配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```typescript
// web/src/components/SmartSearchBar.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Input, AutoComplete, Tag, Tooltip, Button, Dropdown } from 'antd';
import {
  SearchOutlined,
  ClockCircleOutlined,
  StarOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';

interface SearchBarProps {
  onSearch: (query: SearchQuery) => void;
  loading?: boolean;
}

// 搜索查询
interface SearchQuery {
  text: string;
  filters: Filter[];
  timeRange: TimeRange;
}

// 智能搜索栏
export const SmartSearchBar: React.FC<SearchBarProps> = ({ onSearch, loading }) => {
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const inputRef = useRef<any>(null);
  
  // 加载搜索历史
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history));
    }
    
    const filters = localStorage.getItem('savedFilters');
    if (filters) {
      setSavedFilters(JSON.parse(filters));
    }
  }, []);
  
  // 搜索建议
  const handleSearch = async (value: string) => {
    setSearchText(value);
    
    if (value.length < 2) {
      setSuggestions([]);
      return;
    }
    
    // 获取搜索建议
    const suggestions = await fetchSearchSuggestions(value);
    setSuggestions(suggestions);
  };
  
  // 执行搜索
  const handleSubmit = () => {
    if (!searchText.trim()) return;
    
    // 解析搜索文本
    const query = parseSearchText(searchText);
    
    // 保存到搜索历史
    const newHistory = [searchText, ...searchHistory.filter(h => h !== searchText)].slice(0, 20);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    
    // 执行搜索
    onSearch(query);
  };
  
  // 快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K 聚焦搜索框
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // 搜索建议选项
  const options = [
    // 搜索历史
    ...(searchHistory.length > 0
      ? [
          {
            label: (
              <div className="suggestion-group">
                <ClockCircleOutlined /> 搜索历史
              </div>
            ),
            options: searchHistory.map((item) => ({
              value: item,
              label: item,
            })),
          },
        ]
      : []),
    
    // 智能建议
    ...(suggestions.length > 0
      ? [
          {
            label: (
              <div className="suggestion-group">
                <SearchOutlined /> 建议
              </div>
            ),
            options: suggestions.map((item) => ({
              value: item,
              label: item,
            })),
          },
        ]
      : []),
    
    // 保存的过滤器
    ...(savedFilters.length > 0
      ? [
          {
            label: (
              <div className="suggestion-group">
                <StarOutlined /> 保存的过滤器
              </div>
            ),
            options: savedFilters.map((filter) => ({
              value: filter.query,
              label: (
                <div>
                  <span>{filter.name}</span>
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {filter.count}
                  </Tag>
                </div>
              ),
            })),
          },
        ]
      : []),
  ];
  
  return (
    <div className="smart-search-bar">
      <AutoComplete
        ref={inputRef}
        value={searchText}
        options={options}
        onSearch={handleSearch}
        onSelect={(value) => {
          setSearchText(value);
          handleSubmit();
        }}
        style={{ width: '100%' }}
      >
        <Input.Search
          size="large"
          placeholder="搜索日志... (支持全文搜索、字段搜索、正则表达式)"
          prefix={<SearchOutlined />}
          suffix={
            <Tooltip title="搜索语法帮助 (Ctrl+K 聚焦)">
              <Button
                type="text"
                size="small"
                icon={<QuestionCircleOutlined />}
                onClick={() => showSearchHelp()}
              />
            </Tooltip>
          }
          onSearch={handleSubmit}
          loading={loading}
          enterButton="搜索"
        />
      </AutoComplete>
      
      {/* 搜索语法提示 */}
      <div className="search-syntax-hints">
        <Tag>level:ERROR</Tag>
        <Tag>service:payment</Tag>
        <Tag>message:/timeout/</Tag>
        <Tag>timestamp:[now-1h TO now]</Tag>
      </div>
    </div>
  );
};


// web/src/components/AdvancedFilterPanel.tsx
import React, { useState } from 'react';
import { Form, Select, Input, DatePicker, Button, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { RangePicker } = DatePicker;
const { Option } = Select;

// 过滤条件
interface Filter {
  id: string;
  field: string;
  operator: string;
  value: any;
  logic: 'AND' | 'OR';
}

// 高级过滤面板
export const AdvancedFilterPanel: React.FC = () => {
  const [filters, setFilters] = useState<Filter[]>([
    {
      id: '1',
      field: 'level',
      operator: 'eq',
      value: 'ERROR',
      logic: 'AND',
    },
  ]);
  
  // 添加过滤条件
  const addFilter = () => {
    const newFilter: Filter = {
      id: Date.now().toString(),
      field: 'service',
      operator: 'eq',
      value: '',
      logic: 'AND',
    };
    setFilters([...filters, newFilter]);
  };
  
  // 删除过滤条件
  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };
  
  // 更新过滤条件
  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(
      filters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };
  
  // 字段选项
  const fieldOptions = [
    { value: 'level', label: '日志级别' },
    { value: 'service', label: '服务名称' },
    { value: 'message', label: '日志消息' },
    { value: 'timestamp', label: '时间戳' },
    { value: 'traceId', label: 'Trace ID' },
    { value: 'userId', label: '用户 ID' },
    { value: 'tags', label: '标签' },
  ];
  
  // 操作符选项
  const operatorOptions = {
    string: [
      { value: 'eq', label: '等于' },
      { value: 'ne', label: '不等于' },
      { value: 'contains', label: '包含' },
      { value: 'notContains', label: '不包含' },
      { value: 'startsWith', label: '开始于' },
      { value: 'endsWith', label: '结束于' },
      { value: 'regex', label: '正则匹配' },
    ],
    number: [
      { value: 'eq', label: '等于' },
      { value: 'ne', label: '不等于' },
      { value: 'gt', label: '大于' },
      { value: 'gte', label: '大于等于' },
      { value: 'lt', label: '小于' },
      { value: 'lte', label: '小于等于' },
    ],
    date: [
      { value: 'eq', label: '等于' },
      { value: 'gt', label: '晚于' },
      { value: 'lt', label: '早于' },
      { value: 'between', label: '之间' },
    ],
  };
  
  return (
    <div className="advanced-filter-panel">
      <div className="filter-header">
        <h3>高级过滤</h3>
        <Button type="primary" icon={<PlusOutlined />} onClick={addFilter}>
          添加条件
        </Button>
      </div>
      
      <div className="filter-list">
        {filters.map((filter, index) => (
          <div key={filter.id} className="filter-item">
            {/* 逻辑运算符 */}
            {index > 0 && (
              <Select
                value={filter.logic}
                onChange={(value) => updateFilter(filter.id, { logic: value })}
                style={{ width: 80 }}
              >
                <Option value="AND">AND</Option>
                <Option value="OR">OR</Option>
              </Select>
            )}
            
            {/* 字段选择 */}
            <Select
              value={filter.field}
              onChange={(value) => updateFilter(filter.id, { field: value })}
              style={{ width: 150 }}
              placeholder="选择字段"
            >
              {fieldOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
            
            {/* 操作符选择 */}
            <Select
              value={filter.operator}
              onChange={(value) => updateFilter(filter.id, { operator: value })}
              style={{ width: 120 }}
            >
              {operatorOptions.string.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
            
            {/* 值输入 */}
            <Input
              value={filter.value}
              onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
              placeholder="输入值"
              style={{ width: 200 }}
            />
            
            {/* 删除按钮 */}
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeFilter(filter.id)}
            />
          </div>
        ))}
      </div>
      
      {/* 快捷时间范围 */}
      <div className="time-range-shortcuts">
        <span>时间范围:</span>
        <Space>
          <Tag.CheckableTag>最近 1 小时</Tag.CheckableTag>
          <Tag.CheckableTag>今天</Tag.CheckableTag>
          <Tag.CheckableTag>最近 7 天</Tag.CheckableTag>
          <Tag.CheckableTag>最近 30 天</Tag.CheckableTag>
          <RangePicker showTime />
        </Space>
      </div>
      
      {/* 操作按钮 */}
      <div className="filter-actions">
        <Space>
          <Button type="primary" onClick={() => applyFilters(filters)}>
            应用过滤
          </Button>
          <Button onClick={() => saveFilter(filters)}>保存为快捷过滤器</Button>
          <Button onClick={() => setFilters([])}>清空</Button>
        </Space>
      </div>
    </div>
  );
};


// web/src/utils/searchParser.ts
// 搜索文本解析器
export const parseSearchText = (text: string): SearchQuery => {
  const query: SearchQuery = {
    text: '',
    filters: [],
    timeRange: { start: null, end: null },
  };
  
  // 解析字段搜索: field:value
  const fieldPattern = /(\w+):([^\s]+)/g;
  let match;
  
  while ((match = fieldPattern.exec(text)) !== null) {
    const [, field, value] = match;
    
    // 处理正则表达式: field:/pattern/
    if (value.startsWith('/') && value.endsWith('/')) {
      query.filters.push({
        field,
        operator: 'regex',
        value: value.slice(1, -1),
      });
    }
    // 处理范围查询: field:[start TO end]
    else if (value.startsWith('[') && value.includes('TO')) {
      const [start, end] = value.slice(1, -1).split('TO').map(s => s.trim());
      query.filters.push({
        field,
        operator: 'between',
        value: [start, end],
      });
    }
    // 普通字段查询
    else {
      query.filters.push({
        field,
        operator: 'eq',
        value,
      });
    }
    
    // 从原文本中移除已解析的部分
    text = text.replace(match[0], '');
  }
  
  // 剩余文本作为全文搜索
  query.text = text.trim();
  
  return query;
};


// web/src/components/SearchResultHighlight.tsx
import React from 'react';

interface HighlightProps {
  text: string;
  keywords: string[];
}

// 搜索结果高亮
export const SearchResultHighlight: React.FC<HighlightProps> = ({ text, keywords }) => {
  if (!keywords || keywords.length === 0) {
    return <span>{text}</span>;
  }
  
  // 构建正则表达式
  const pattern = new RegExp(`(${keywords.join('|')})`, 'gi');
  const parts = text.split(pattern);
  
  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = keywords.some(
          (keyword) => part.toLowerCase() === keyword.toLowerCase()
        );
        
        return isMatch ? (
          <mark key={index} className="search-highlight">
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
};
```

**关键实现点**:

1. 智能搜索支持全文搜索、字段搜索、正则表达式、范围查询
2. 搜索建议和自动补全响应时间 < 100ms，使用防抖优化
3. 高级过滤面板支持多条件组合（AND/OR/NOT）
4. 保存常用搜索条件为快捷过滤器，存储在 LocalStorage
5. 搜索历史记录保留最近 20 条，支持快速重用
6. 时间范围快速选择（最近1小时、今天、最近7天等）
7. 搜索结果中高亮显示匹配的关键词，使用 `<mark>` 标签

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| search_enabled | bool | true | 是否启用搜索功能 |
| autocomplete_enabled | bool | true | 是否启用自动补全 |
| autocomplete_delay | int | 100 | 自动补全延迟（毫秒） |
| search_history_size | int | 20 | 搜索历史保留数量 |
| highlight_enabled | bool | true | 是否高亮搜索结果 |
| regex_search_enabled | bool | true | 是否支持正则搜索 |
| saved_filters_limit | int | 10 | 保存的过滤器数量限制 |
| time_range_shortcuts | array | [] | 时间范围快捷选项 |

**热更新机制**:

- 更新方式: WebSocket + LocalStorage
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置，显示错误提示

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的搜索配置
2. WHEN 自动补全延迟变更时，THE System SHALL 在下次搜索时生效
3. THE System SHALL 支持通过 API 查询当前生效的搜索配置
4. THE System SHALL 记录所有搜索配置变更的审计日志
5. WHEN 搜索历史大小变更时，THE System SHALL 验证配置的合理性（>= 1）

---



#### 需求 13-47: 实时交互与数据更新 [MVP]

**用户故事**:
作为运维工程师，我希望能够实时查看日志更新和系统状态，以便第一时间发现和响应系统异常。

**验收标准**:

1. THE System SHALL 通过 WebSocket 实现实时日志流，无需用户手动刷新页面
2. THE System SHALL 支持多标签页功能，允许用户同时打开多个日志查询、分析页面
3. THE System SHALL 支持窗口拆分功能，同时查看日志详情、告警、图表等多个视图
4. THE System SHALL 的所有图表和数据面板支持动态更新，实时反映系统最新状态
5. THE System SHALL 在实时日志流中自动滚动到最新日志，支持暂停/恢复
6. THE System SHALL 支持实时日志的过滤和搜索，新日志自动匹配条件
7. THE System SHALL 在网络断开时自动重连，重连后恢复数据流
8. THE System SHALL 显示实时连接状态和数据更新频率
9. THE System SHALL 支持实时日志的性能优化，单页最多显示 1000 条
10. THE System SHALL 通过配置中心管理实时更新配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```typescript
// web/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

// WebSocket Hook
export const useWebSocket = (options: UseWebSocketOptions) => {
  const {
    url,
    autoConnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 3000,
  } = options;
  
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectCountRef = useRef(0);
  
  // 连接 WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    
    const socket = io(url, {
      transports: ['websocket', 'polling'],
      auth: {
        token: localStorage.getItem('token'),
      },
    });
    
    socket.on('connect', () => {
      console.log('WebSocket 已连接');
      setConnected(true);
      setReconnecting(false);
      reconnectCountRef.current = 0;
    });
    
    socket.on('disconnect', (reason) => {
      console.log('WebSocket 已断开:', reason);
      setConnected(false);
      
      // 自动重连
      if (reason === 'io server disconnect') {
        // 服务器主动断开，不重连
        return;
      }
      
      if (reconnectCountRef.current < reconnectAttempts) {
        setReconnecting(true);
        reconnectCountRef.current++;
        
        setTimeout(() => {
          console.log(`尝试重连 (${reconnectCountRef.current}/${reconnectAttempts})`);
          socket.connect();
        }, reconnectDelay);
      }
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket 错误:', error);
    });
    
    socketRef.current = socket;
  }, [url, reconnectAttempts, reconnectDelay]);
  
  // 断开连接
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setConnected(false);
  }, []);
  
  // 发送消息
  const emit = useCallback((event: string, data: any) => {
    socketRef.current?.emit(event, data);
  }, []);
  
  // 监听事件
  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);
  
  // 自动连接
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);
  
  return {
    connected,
    reconnecting,
    connect,
    disconnect,
    emit,
    on,
  };
};


// web/src/components/RealtimeLogStream.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button, Switch, Badge, Statistic } from 'antd';
import { PauseOutlined, PlayCircleOutlined, ClearOutlined } from '@ant-design/icons';
import { useWebSocket } from '@/hooks/useWebSocket';

interface RealtimeLogStreamProps {
  query: SearchQuery;
  maxLogs?: number;
}

// 实时日志流组件
export const RealtimeLogStream: React.FC<RealtimeLogStreamProps> = ({
  query,
  maxLogs = 1000,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [updateRate, setUpdateRate] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef(Date.now());
  const updateCountRef = useRef(0);
  
  // WebSocket 连接
  const { connected, reconnecting, emit, on } = useWebSocket({
    url: process.env.REACT_APP_WS_URL || 'ws://localhost:3000',
  });
  
  // 订阅日志流
  useEffect(() => {
    if (!connected) return;
    
    // 发送订阅请求
    emit('subscribe', query);
    
    // 监听新日志
    const unsubscribe = on('log', (log: LogEntry) => {
      if (paused) return;
      
      setLogs((prev) => {
        const newLogs = [log, ...prev];
        // 限制日志数量
        return newLogs.slice(0, maxLogs);
      });
      
      // 更新频率统计
      updateCountRef.current++;
      const now = Date.now();
      const elapsed = (now - lastUpdateRef.current) / 1000;
      
      if (elapsed >= 1) {
        setUpdateRate(Math.round(updateCountRef.current / elapsed));
        updateCountRef.current = 0;
        lastUpdateRef.current = now;
      }
    });
    
    return () => {
      emit('unsubscribe', query);
      unsubscribe();
    };
  }, [connected, query, paused, maxLogs, emit, on]);
  
  // 自动滚动
  useEffect(() => {
    if (autoScroll && !paused && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll, paused]);
  
  // 清空日志
  const handleClear = () => {
    setLogs([]);
  };
  
  return (
    <div className="realtime-log-stream">
      {/* 控制栏 */}
      <div className="stream-controls">
        <div className="stream-status">
          <Badge
            status={connected ? 'success' : reconnecting ? 'processing' : 'error'}
            text={
              connected
                ? '已连接'
                : reconnecting
                ? '重连中...'
                : '未连接'
            }
          />
          
          <Statistic
            title="更新频率"
            value={updateRate}
            suffix="条/秒"
            style={{ marginLeft: 16 }}
          />
          
          <Statistic
            title="日志数量"
            value={logs.length}
            suffix={`/ ${maxLogs}`}
            style={{ marginLeft: 16 }}
          />
        </div>
        
        <div className="stream-actions">
          <Switch
            checked={autoScroll}
            onChange={setAutoScroll}
            checkedChildren="自动滚动"
            unCheckedChildren="手动滚动"
          />
          
          <Button
            type={paused ? 'primary' : 'default'}
            icon={paused ? <PlayCircleOutlined /> : <PauseOutlined />}
            onClick={() => setPaused(!paused)}
          >
            {paused ? '恢复' : '暂停'}
          </Button>
          
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            清空
          </Button>
        </div>
      </div>
      
      {/* 日志列表 */}
      <div ref={containerRef} className="stream-container">
        <VirtualLogList
          logs={logs}
          onLoadMore={() => {}}
          hasMore={false}
          loading={false}
        />
      </div>
    </div>
  );
};


// web/src/components/MultiTabLayout.tsx
import React, { useState } from 'react';
import { Tabs, Button, Dropdown } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';

interface Tab {
  key: string;
  title: string;
  content: React.ReactNode;
  closable?: boolean;
}

// 多标签页布局
export const MultiTabLayout: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      key: '1',
      title: '日志搜索',
      content: <LogSearchPage />,
      closable: false,
    },
  ]);
  const [activeKey, setActiveKey] = useState('1');
  
  // 添加标签页
  const addTab = (type: string) => {
    const newKey = `${Date.now()}`;
    const newTab: Tab = {
      key: newKey,
      title: getTabTitle(type),
      content: getTabContent(type),
      closable: true,
    };
    
    setTabs([...tabs, newTab]);
    setActiveKey(newKey);
  };
  
  // 关闭标签页
  const removeTab = (targetKey: string) => {
    const newTabs = tabs.filter((tab) => tab.key !== targetKey);
    setTabs(newTabs);
    
    if (activeKey === targetKey && newTabs.length > 0) {
      setActiveKey(newTabs[newTabs.length - 1].key);
    }
  };
  
  // 新建标签页菜单
  const newTabMenu = {
    items: [
      { key: 'search', label: '日志搜索', onClick: () => addTab('search') },
      { key: 'analysis', label: '日志分析', onClick: () => addTab('analysis') },
      { key: 'alerts', label: '告警管理', onClick: () => addTab('alerts') },
      { key: 'dashboard', label: '仪表盘', onClick: () => addTab('dashboard') },
    ],
  };
  
  return (
    <div className="multi-tab-layout">
      <Tabs
        type="editable-card"
        activeKey={activeKey}
        onChange={setActiveKey}
        onEdit={(targetKey, action) => {
          if (action === 'remove') {
            removeTab(targetKey as string);
          }
        }}
        tabBarExtraContent={
          <Dropdown menu={newTabMenu}>
            <Button type="text" icon={<PlusOutlined />}>
              新建标签页
            </Button>
          </Dropdown>
        }
        items={tabs.map((tab) => ({
          key: tab.key,
          label: tab.title,
          children: tab.content,
          closable: tab.closable,
        }))}
      />
    </div>
  );
};


// web/src/components/SplitPaneLayout.tsx
import React from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';

// 窗口拆分布局
export const SplitPaneLayout: React.FC = () => {
  return (
    <div className="split-pane-layout" style={{ height: '100vh' }}>
      <Allotment>
        {/* 左侧：日志列表 */}
        <Allotment.Pane minSize={300}>
          <div className="pane-content">
            <h3>日志列表</h3>
            <RealtimeLogStream query={{}} />
          </div>
        </Allotment.Pane>
        
        {/* 右侧：垂直拆分 */}
        <Allotment.Pane>
          <Allotment vertical>
            {/* 上方：日志详情 */}
            <Allotment.Pane minSize={200}>
              <div className="pane-content">
                <h3>日志详情</h3>
                <LogDetailPanel />
              </div>
            </Allotment.Pane>
            
            {/* 下方：图表和告警 */}
            <Allotment.Pane minSize={200}>
              <Allotment>
                {/* 图表 */}
                <Allotment.Pane>
                  <div className="pane-content">
                    <h3>实时图表</h3>
                    <RealtimeChart />
                  </div>
                </Allotment.Pane>
                
                {/* 告警 */}
                <Allotment.Pane>
                  <div className="pane-content">
                    <h3>实时告警</h3>
                    <RealtimeAlerts />
                  </div>
                </Allotment.Pane>
              </Allotment>
            </Allotment.Pane>
          </Allotment>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
};
```

**关键实现点**:

1. 使用 Socket.io 实现 WebSocket 连接，支持自动重连
2. 实时日志流支持暂停/恢复、自动滚动、清空操作
3. 多标签页功能支持同时打开多个页面，提升工作效率
4. 窗口拆分使用 Allotment 库，支持灵活的布局调整
5. 实时连接状态显示和数据更新频率统计
6. 网络断开时自动重连，最多重试 5 次
7. 单页最多显示 1000 条日志，避免性能问题

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| realtime_enabled | bool | true | 是否启用实时更新 |
| websocket_url | string | "" | WebSocket 服务地址 |
| reconnect_attempts | int | 5 | 最大重连次数 |
| reconnect_delay | int | 3000 | 重连延迟（毫秒） |
| max_realtime_logs | int | 1000 | 实时日志最大数量 |
| auto_scroll_enabled | bool | true | 是否默认启用自动滚动 |
| update_rate_display | bool | true | 是否显示更新频率 |
| multi_tab_enabled | bool | true | 是否启用多标签页 |

**热更新机制**:

- 更新方式: WebSocket + LocalStorage
- 生效时间: 立即生效（需要重新连接）
- 回滚策略: 配置验证失败时保持原配置，显示错误提示

**热更新验收标准**:

1. THE System SHALL 在配置变更后通过 WebSocket 推送到所有在线用户
2. WHEN WebSocket URL 变更时，THE System SHALL 提示用户刷新页面
3. THE System SHALL 支持通过 API 查询当前生效的实时更新配置
4. THE System SHALL 记录所有实时更新配置变更的审计日志
5. WHEN 最大日志数量变更时，THE System SHALL 验证配置的合理性（>= 100）

---



#### 需求 13-48: 个性化配置与快捷键 [Phase 2]

**用户故事**:
作为运维工程师，我希望能够自定义界面配置和快捷键，以便提升个人工作效率。

**验收标准**:

1. THE System SHALL 支持用户个性化配置（主题、语言、时区、日期格式）
2. THE System SHALL 提供完整的快捷键支持，覆盖常用操作（搜索、刷新、导出等）
3. THE System SHALL 支持用户自定义快捷键，避免与浏览器快捷键冲突
4. THE System SHALL 提供快捷键帮助面板，显示所有可用快捷键
5. THE System SHALL 支持工作区布局保存和恢复，包含窗口位置、大小、拆分状态
6. THE System SHALL 支持仪表盘小部件的自定义排列和配置
7. THE System SHALL 支持用户偏好设置的导入导出，便于跨设备同步
8. THE System SHALL 在用户首次登录时提供引导教程
9. THE System SHALL 支持多语言切换（中文、英文），切换后立即生效
10. THE System SHALL 通过配置中心管理个性化配置，配置变更后立即生效

**实现方向**:

**实现方式**:

```typescript
// web/src/hooks/useUserPreferences.ts
import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

interface UserPreferences {
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  timezone: string;
  dateFormat: string;
  shortcuts: Record<string, string>;
  layout: LayoutConfig;
  dashboardWidgets: WidgetConfig[];
}

// 默认配置
const defaultPreferences: UserPreferences = {
  theme: 'light',
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  shortcuts: {
    search: 'ctrl+k',
    refresh: 'ctrl+r',
    export: 'ctrl+e',
    help: 'ctrl+/',
  },
  layout: {
    sidebarCollapsed: false,
    splitPanes: [],
  },
  dashboardWidgets: [],
};

// 用户偏好设置 Hook
export const useUserPreferences = () => {
  const [preferences, setPreferences] = useLocalStorage<UserPreferences>(
    'userPreferences',
    defaultPreferences
  );
  
  // 更新偏好设置
  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...updates }));
  };
  
  // 重置为默认设置
  const resetPreferences = () => {
    setPreferences(defaultPreferences);
  };
  
  // 导出配置
  const exportPreferences = () => {
    const data = JSON.stringify(preferences, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'user-preferences.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  
  // 导入配置
  const importPreferences = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        setPreferences(imported);
        message.success('配置导入成功');
      } catch (error) {
        message.error('配置文件格式错误');
      }
    };
    reader.readAsText(file);
  };
  
  return {
    preferences,
    updatePreferences,
    resetPreferences,
    exportPreferences,
    importPreferences,
  };
};


// web/src/hooks/useKeyboardShortcuts.ts
import { useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  handler: () => void;
  description: string;
  enabled?: boolean;
}

// 快捷键 Hook
export const useKeyboardShortcuts = (shortcuts: ShortcutConfig[]) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 构建按键组合字符串
      const keys: string[] = [];
      if (event.ctrlKey || event.metaKey) keys.push('ctrl');
      if (event.shiftKey) keys.push('shift');
      if (event.altKey) keys.push('alt');
      keys.push(event.key.toLowerCase());
      
      const combination = keys.join('+');
      
      // 查找匹配的快捷键
      const shortcut = shortcuts.find(
        (s) => s.enabled !== false && s.key === combination
      );
      
      if (shortcut) {
        event.preventDefault();
        shortcut.handler();
      }
    },
    [shortcuts]
  );
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};


// web/src/components/ShortcutHelpPanel.tsx
import React from 'react';
import { Modal, Table, Tag } from 'antd';

interface ShortcutHelpPanelProps {
  visible: boolean;
  onClose: () => void;
  shortcuts: ShortcutConfig[];
}

// 快捷键帮助面板
export const ShortcutHelpPanel: React.FC<ShortcutHelpPanelProps> = ({
  visible,
  onClose,
  shortcuts,
}) => {
  const columns = [
    {
      title: '功能',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '快捷键',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => {
        const keys = key.split('+');
        return (
          <span>
            {keys.map((k, index) => (
              <React.Fragment key={k}>
                {index > 0 && ' + '}
                <Tag>{k.toUpperCase()}</Tag>
              </React.Fragment>
            ))}
          </span>
        );
      },
    },
  ];
  
  // 按类别分组
  const groupedShortcuts = {
    全局: shortcuts.filter((s) => s.description.includes('全局')),
    搜索: shortcuts.filter((s) => s.description.includes('搜索')),
    导航: shortcuts.filter((s) => s.description.includes('导航')),
    操作: shortcuts.filter((s) => !['全局', '搜索', '导航'].some(cat => s.description.includes(cat))),
  };
  
  return (
    <Modal
      title="快捷键帮助"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      {Object.entries(groupedShortcuts).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <h3>{category}</h3>
          <Table
            dataSource={items}
            columns={columns}
            pagination={false}
            size="small"
          />
        </div>
      ))}
    </Modal>
  );
};


// web/src/components/PreferencesPanel.tsx
import React from 'react';
import { Form, Select, Switch, Button, Upload, Space, Divider } from 'antd';
import { UploadOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import { useUserPreferences } from '@/hooks/useUserPreferences';

const { Option } = Select;

// 偏好设置面板
export const PreferencesPanel: React.FC = () => {
  const {
    preferences,
    updatePreferences,
    resetPreferences,
    exportPreferences,
    importPreferences,
  } = useUserPreferences();
  
  return (
    <div className="preferences-panel">
      <Form layout="vertical">
        {/* 外观设置 */}
        <Divider>外观设置</Divider>
        
        <Form.Item label="主题">
          <Select
            value={preferences.theme}
            onChange={(value) => updatePreferences({ theme: value })}
          >
            <Option value="light">浅色</Option>
            <Option value="dark">深色</Option>
          </Select>
        </Form.Item>
        
        <Form.Item label="语言">
          <Select
            value={preferences.language}
            onChange={(value) => updatePreferences({ language: value })}
          >
            <Option value="zh-CN">简体中文</Option>
            <Option value="en-US">English</Option>
          </Select>
        </Form.Item>
        
        {/* 时间设置 */}
        <Divider>时间设置</Divider>
        
        <Form.Item label="时区">
          <Select
            value={preferences.timezone}
            onChange={(value) => updatePreferences({ timezone: value })}
            showSearch
          >
            <Option value="Asia/Shanghai">中国标准时间 (UTC+8)</Option>
            <Option value="America/New_York">美国东部时间 (UTC-5)</Option>
            <Option value="Europe/London">英国时间 (UTC+0)</Option>
            <Option value="Asia/Tokyo">日本时间 (UTC+9)</Option>
          </Select>
        </Form.Item>
        
        <Form.Item label="日期格式">
          <Select
            value={preferences.dateFormat}
            onChange={(value) => updatePreferences({ dateFormat: value })}
          >
            <Option value="YYYY-MM-DD HH:mm:ss">2024-12-28 10:30:00</Option>
            <Option value="MM/DD/YYYY HH:mm:ss">12/28/2024 10:30:00</Option>
            <Option value="DD/MM/YYYY HH:mm:ss">28/12/2024 10:30:00</Option>
            <Option value="YYYY年MM月DD日 HH:mm:ss">2024年12月28日 10:30:00</Option>
          </Select>
        </Form.Item>
        
        {/* 快捷键设置 */}
        <Divider>快捷键设置</Divider>
        
        <Form.Item label="搜索">
          <Input
            value={preferences.shortcuts.search}
            onChange={(e) =>
              updatePreferences({
                shortcuts: { ...preferences.shortcuts, search: e.target.value },
              })
            }
            placeholder="例如: ctrl+k"
          />
        </Form.Item>
        
        <Form.Item label="刷新">
          <Input
            value={preferences.shortcuts.refresh}
            onChange={(e) =>
              updatePreferences({
                shortcuts: { ...preferences.shortcuts, refresh: e.target.value },
              })
            }
            placeholder="例如: ctrl+r"
          />
        </Form.Item>
        
        <Form.Item label="导出">
          <Input
            value={preferences.shortcuts.export}
            onChange={(e) =>
              updatePreferences({
                shortcuts: { ...preferences.shortcuts, export: e.target.value },
              })
            }
            placeholder="例如: ctrl+e"
          />
        </Form.Item>
        
        {/* 配置管理 */}
        <Divider>配置管理</Divider>
        
        <Space>
          <Button icon={<DownloadOutlined />} onClick={exportPreferences}>
            导出配置
          </Button>
          
          <Upload
            accept=".json"
            showUploadList={false}
            beforeUpload={(file) => {
              importPreferences(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>导入配置</Button>
          </Upload>
          
          <Button
            danger
            icon={<ReloadOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认重置',
                content: '确定要重置所有配置为默认值吗？',
                onOk: resetPreferences,
              });
            }}
          >
            重置为默认
          </Button>
        </Space>
      </Form>
    </div>
  );
};


// web/src/components/OnboardingTour.tsx
import React, { useState } from 'react';
import { Tour } from 'antd';
import type { TourProps } from 'antd';

// 引导教程
export const OnboardingTour: React.FC = () => {
  const [open, setOpen] = useState(() => {
    // 检查是否是首次访问
    const hasVisited = localStorage.getItem('hasVisited');
    return !hasVisited;
  });
  
  const steps: TourProps['steps'] = [
    {
      title: '欢迎使用日志管理系统',
      description: '让我们快速了解一下主要功能',
      target: null,
    },
    {
      title: '搜索栏',
      description: '在这里输入关键词搜索日志，支持全文搜索和字段搜索',
      target: () => document.querySelector('.search-bar') as HTMLElement,
    },
    {
      title: '高级过滤',
      description: '点击这里打开高级过滤面板，进行多条件组合查询',
      target: () => document.querySelector('.filter-button') as HTMLElement,
    },
    {
      title: '实时日志流',
      description: '这里显示实时日志更新，可以暂停/恢复查看',
      target: () => document.querySelector('.realtime-stream') as HTMLElement,
    },
    {
      title: '快捷键',
      description: '按 Ctrl+/ 查看所有可用的快捷键',
      target: null,
    },
  ];
  
  const handleClose = () => {
    setOpen(false);
    localStorage.setItem('hasVisited', 'true');
  };
  
  return <Tour open={open} onClose={handleClose} steps={steps} />;
};


// web/src/components/LayoutManager.tsx
import React from 'react';
import { useUserPreferences } from '@/hooks/useUserPreferences';

// 布局管理器
export const LayoutManager: React.FC = () => {
  const { preferences, updatePreferences } = useUserPreferences();
  
  // 保存当前布局
  const saveLayout = () => {
    const layout = {
      sidebarCollapsed: document.querySelector('.sidebar')?.classList.contains('collapsed'),
      splitPanes: Array.from(document.querySelectorAll('.split-pane')).map((pane) => ({
        size: (pane as HTMLElement).style.width,
      })),
    };
    
    updatePreferences({ layout });
    message.success('布局已保存');
  };
  
  // 恢复布局
  const restoreLayout = () => {
    const { layout } = preferences;
    
    // 恢复侧边栏状态
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && layout.sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    }
    
    // 恢复窗口拆分状态
    layout.splitPanes.forEach((pane, index) => {
      const element = document.querySelectorAll('.split-pane')[index] as HTMLElement;
      if (element) {
        element.style.width = pane.size;
      }
    });
    
    message.success('布局已恢复');
  };
  
  return (
    <div className="layout-manager">
      <Button onClick={saveLayout}>保存布局</Button>
      <Button onClick={restoreLayout}>恢复布局</Button>
    </div>
  );
};
```

**关键实现点**:

1. 用户偏好设置存储在 LocalStorage，支持跨会话保持
2. 完整的快捷键支持，覆盖搜索、刷新、导出等常用操作
3. 快捷键帮助面板按类别分组显示，便于查找
4. 支持配置的导入导出，便于跨设备同步
5. 工作区布局保存和恢复，包含窗口位置、大小、拆分状态
6. 首次登录时显示引导教程，帮助用户快速上手
7. 多语言支持（中文、英文），切换后立即生效

**配置热更新**:

**可热更新配置项**:

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| preferences_enabled | bool | true | 是否启用个性化配置 |
| shortcuts_enabled | bool | true | 是否启用快捷键 |
| default_theme | string | "light" | 默认主题 |
| default_language | string | "zh-CN" | 默认语言 |
| default_timezone | string | "Asia/Shanghai" | 默认时区 |
| onboarding_enabled | bool | true | 是否启用引导教程 |
| layout_save_enabled | bool | true | 是否启用布局保存 |
| config_export_enabled | bool | true | 是否启用配置导出 |

**热更新机制**:

- 更新方式: WebSocket + LocalStorage
- 生效时间: 立即生效
- 回滚策略: 配置验证失败时保持原配置，显示错误提示

**热更新验收标准**:

1. THE System SHALL 在配置变更后立即应用新的个性化配置
2. WHEN 默认主题变更时，THE System SHALL 在新用户首次登录时生效
3. THE System SHALL 支持通过 API 查询当前生效的个性化配置
4. THE System SHALL 记录所有个性化配置变更的审计日志
5. WHEN 快捷键配置变更时，THE System SHALL 验证快捷键的有效性

---


### 13.5 API 接口汇总

| 接口编号 | 接口名称 | 模块 | HTTP 方法 | 路径 | 权限/Scope | 请求参数 | 返回结构(示例) | 状态码 | 版本 | 是否幂等 | 是否缓存 | 负责人 | 备注 |
|---------|---------|------|----------|------|-----------|---------|---------------|--------|------|---------|---------|--------|------|
| API-13-453 | 获取主题配置 | UI | GET | /api/v1/ui/theme | ui.read | 无 | {code:0,data:{theme:"light"}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-454 | 更新主题配置 | UI | PUT | /api/v1/ui/theme | ui.write | Body: {theme} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-455 | 批量标记日志 | Logs | POST | /api/v1/logs/batch/mark | logs.write | Body: {log_ids:[],mark} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-456 | 批量删除日志 | Logs | POST | /api/v1/logs/batch/delete | logs.write | Body: {log_ids:[]} | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-457 | 批量导出日志 | Logs | POST | /api/v1/logs/batch/export | logs.read | Body: {log_ids:[],format} | Binary | 200/400/401/403/500 | v1 | 是 | 否 | - | 返回文件 |
| API-13-458 | 获取搜索建议 | Search | GET | /api/v1/search/suggestions | search.read | Query: keyword | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-459 | 获取搜索历史 | Search | GET | /api/v1/search/history | search.read | Query: limit | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-460 | 获取保存的过滤器 | Search | GET | /api/v1/search/filters | search.read | 无 | {code:0,data:[...]} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-461 | 保存过滤器 | Search | POST | /api/v1/search/filters | search.write | Body: filter_config | {code:0,data:{id:"filter-1"}} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-13-462 | 订阅实时日志流 | Realtime | WS | /api/v1/realtime/subscribe | realtime.read | WebSocket消息 | WebSocket消息流 | 101/401/403/500 | v1 | 否 | 否 | - | WebSocket连接 |
| API-13-463 | 取消订阅 | Realtime | WS | /api/v1/realtime/unsubscribe | realtime.read | WebSocket消息 | WebSocket消息 | 101/401/403/500 | v1 | 是 | 否 | - | WebSocket连接 |
| API-13-464 | 获取用户偏好设置 | Preferences | GET | /api/v1/preferences | preferences.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-465 | 更新用户偏好设置 | Preferences | PUT | /api/v1/preferences | preferences.write | Body: preferences_data | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |
| API-13-466 | 导出用户配置 | Preferences | GET | /api/v1/preferences/export | preferences.read | 无 | Binary | 200/401/403/500 | v1 | 是 | 否 | - | 返回JSON文件 |
| API-13-467 | 导入用户配置 | Preferences | POST | /api/v1/preferences/import | preferences.write | Body: config_file | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 否 | 否 | - | - |
| API-13-468 | 获取快捷键配置 | Shortcuts | GET | /api/v1/shortcuts | shortcuts.read | 无 | {code:0,data:{...}} | 200/401/403/500 | v1 | 是 | 是 | - | - |
| API-13-469 | 更新快捷键配置 | Shortcuts | PUT | /api/v1/shortcuts | shortcuts.write | Body: shortcuts_config | {code:0,message:"ok"} | 200/400/401/403/500 | v1 | 是 | 否 | - | - |

---
