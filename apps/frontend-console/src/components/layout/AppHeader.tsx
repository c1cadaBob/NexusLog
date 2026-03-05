import React, { useEffect } from 'react';
import { Layout, Input, Badge, Dropdown, Avatar, Switch, Popover, List, Tag, Button, Empty, theme } from 'antd';
import type { MenuProps } from 'antd';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import type { Notification } from '../../stores/notificationStore';
import { COLORS } from '../../theme/tokens';

const { Header } = Layout;

interface AppHeaderProps {
  /** 移动端菜单按钮点击 */
  onMenuClick?: () => void;
  /** 是否移动端 */
  isMobile?: boolean;
}

const AppHeader: React.FC<AppHeaderProps> = ({ onMenuClick, isMobile }) => {
  const { isDark, setMode } = useThemeStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const notifications = useNotificationStore((s) => s.notifications);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const { token } = theme.useToken();

  // 初始化模拟通知数据
  useEffect(() => {
    if (notifications.length === 0) {
      const mockNotifications = [
        { title: '系统更新', message: 'NexusLog v2.1.0 已发布，建议尽快升级', type: 'info' as const },
        { title: '任务分配', message: '张工将「日志归档策略优化」任务分配给你', type: 'info' as const },
        { title: '采集源变更', message: 'nginx-access-log 采集源已成功接入系统', type: 'success' as const },
        { title: '权限变更', message: '你已被授予「告警规则管理」权限', type: 'info' as const },
      ];
      mockNotifications.forEach((n) => addNotification(n));
    }
  }, []);

  const typeColorMap: Record<string, string> = {
    error: COLORS.danger,
    warning: COLORS.warning,
    success: COLORS.success,
    info: COLORS.info,
  };

  const notificationContent = (
    <div style={{ width: 320 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>系统通知</span>
        {notifications.length > 0 && (
          <Button type="link" size="small" onClick={clearAll} style={{ padding: 0, fontSize: 12 }}>
            全部清除
          </Button>
        )}
      </div>
      {notifications.length === 0 ? (
        <Empty description="暂无通知" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: '16px 0' }} />
      ) : (
        <List
          size="small"
          style={{ maxHeight: 300, overflowY: 'auto' }}
          dataSource={notifications.slice(0, 10)}
          renderItem={(item: Notification) => (
            <List.Item
              style={{ padding: '8px 0', cursor: 'pointer', opacity: item.read ? 0.5 : 1 }}
              onClick={() => markAsRead(item.id)}
            >
              <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'flex-start' }}>
                <Tag
                  color={typeColorMap[item.type]}
                  style={{ fontSize: 10, lineHeight: '16px', padding: '0 4px', margin: 0, flexShrink: 0 }}
                >
                  {item.type === 'error' ? '错误' : item.type === 'warning' ? '警告' : item.type === 'success' ? '成功' : '信息'}
                </Tag>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{item.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{item.message}</div>
                </div>
              </div>
            </List.Item>
          )}
        />
      )}
    </div>
  );

  const userMenuItems: MenuProps['items'] = [
    { key: 'profile', label: '个人设置', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span> },
    { key: 'preferences', label: '偏好设置', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span> },
    { type: 'divider' },
    { key: 'logout', label: '退出登录', icon: <span className="material-symbols-outlined" style={{ fontSize: 16 }}>logout</span>, danger: true },
  ];

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout();
    }
  };

  // 统一的图标按钮样式
  const iconButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    color: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderRadius: 8,
    lineHeight: 1,
  };

  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: isMobile ? '0 12px' : '0 24px',
        gap: 12,
        height: 56,
        background: token.colorBgContainer,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* 移动端菜单按钮 */}
      {isMobile && (
        <button
          onClick={onMenuClick}
          style={{ ...iconButtonStyle, flexShrink: 0 }}
          aria-label="打开菜单"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>menu</span>
        </button>
      )}

      {/* 全局搜索框 */}
      <Input
        id="global-search-input"
        name="global-search"
        autoComplete="off"
        prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, opacity: 0.5 }}>search</span>}
        placeholder="搜索日志、告警、设置..."
        style={{ maxWidth: 400, flex: 1 }}
        allowClear
      />

      <div style={{ flex: 1 }} />

      {/* 右侧操作区 - 使用 flexbox 确保垂直居中 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, height: 36 }}>
        {/* 主题切换 */}
        <Switch
          checked={isDark}
          onChange={(checked) => setMode(checked ? 'dark' : 'light')}
          checkedChildren={<span className="material-symbols-outlined" style={{ fontSize: 14, lineHeight: '22px' }}>dark_mode</span>}
          unCheckedChildren={<span className="material-symbols-outlined" style={{ fontSize: 14, lineHeight: '22px' }}>light_mode</span>}
          aria-label="切换主题"
        />

        {/* 通知图标 */}
        <Popover content={notificationContent} trigger="click" placement="bottomRight" arrow={false}>
          <Badge count={unreadCount} size="small" offset={[0, 0]} styles={{ indicator: { transform: 'translate(-30%, -20%)' } }}>
            <button
              style={iconButtonStyle}
              aria-label={`通知 ${unreadCount} 条未读`}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>notifications</span>
            </button>
          </Badge>
        </Popover>

        {/* 用户头像下拉 */}
        <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} trigger={['click']}>
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              height: 36,
              lineHeight: 1,
            }}
          >
            <Avatar size={32} style={{ backgroundColor: '#135bec' }}>
              {user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </Avatar>
          </button>
        </Dropdown>
      </div>
    </Header>
  );
};

export default AppHeader;
