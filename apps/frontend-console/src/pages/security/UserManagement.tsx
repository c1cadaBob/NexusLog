import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Result,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useAuthStore } from '../../stores/authStore';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import {
  assignRole,
  batchUpdateUsersStatus,
  createUser,
  disableUser,
  fetchRoles,
  fetchUser,
  fetchUsers,
  removeRole,
  updateUser,
  type RoleData,
  type UserData,
} from '../../api/user';
import {
  getAssignableRoles,
  isProtectedRole,
  isProtectedUser,
  protectedGovernanceTagLabel,
} from './securityGovernance';
import {
  canApplyPrimaryRoleChange,
  canAssignRoleOnCreate,
  canEditRoleForUser,
  canOpenUserEditModal,
  getPrimaryRoleChangeDeniedReason,
  resolveUserManagementActionAccess,
} from './userManagementAuthorization';

interface LoadErrorState {
  message: string;
  status?: number;
}

type UserStatus = 'active' | 'disabled';

const roleColorMap: Record<string, string> = {
  admin: 'purple',
  system_admin: 'purple',
  super_admin: 'red',
  system_automation: 'gold',
  sre: 'blue',
  developer: 'default',
  viewer: 'cyan',
  operator: 'orange',
};

function toLoadError(error: unknown, fallbackMessage: string): LoadErrorState {
  const typedError = error as Error & { status?: number };
  return {
    message: typedError?.message || fallbackMessage,
    status: typeof typedError?.status === 'number' ? typedError.status : undefined,
  };
}

function getUserDisplayName(user: UserData): string {
  return user.display_name || user.username;
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
  } catch {
    return value;
  }
}

function getStatusLabel(status: string): string {
  return status === 'active' ? '启用' : '禁用';
}

function renderRoleTags(roles: RoleData[] | undefined, limit = 2) {
  const safeRoles = roles ?? [];
  if (safeRoles.length === 0) {
    return <Tag color="default">未分配角色</Tag>;
  }

  return (
    <Space size={4} wrap>
      {safeRoles.slice(0, limit).map((role) => (
        <Tag key={role.id} color={roleColorMap[role.name.toLowerCase()] || 'default'}>
          {isProtectedRole(role) ? `${role.name} · ${protectedGovernanceTagLabel}` : role.name}
        </Tag>
      ))}
      {safeRoles.length > limit ? <Tag color="default">+{safeRoles.length - limit}</Tag> : null}
    </Space>
  );
}

const UserManagement: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const isDark = useThemeStore((state) => state.isDark);
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const authUser = useAuthStore((state) => state.user);
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;

  const [users, setUsers] = useState<UserData[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [batchActionLoading, setBatchActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [userLoadError, setUserLoadError] = useState<LoadErrorState | null>(null);
  const [roleLoadError, setRoleLoadError] = useState<LoadErrorState | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [detailUser, setDetailUser] = useState<UserData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<LoadErrorState | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserData[]>([]);
  const [userTableViewportWidth, setUserTableViewportWidth] = useState(0);
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();
  const userTableContainerRef = useRef<HTMLDivElement | null>(null);

  const currentSessionUserId = authUser?.id ?? null;
  const authorization = useMemo(
    () => ({ permissions, capabilities }),
    [capabilities, permissions],
  );
  const actionAccess = useMemo(
    () => resolveUserManagementActionAccess(authorization),
    [authorization],
  );

  const clearSelection = useCallback(() => {
    setSelectedRowKeys([]);
    setSelectedUsers([]);
  }, []);

  const mergeHydratedUsers = useCallback(async (baseUsers: UserData[]) => {
    const hydratedUsers = await Promise.allSettled(
      baseUsers.map(async (user) => {
        const detailedUser = await fetchUser(user.id);
        return detailedUser;
      }),
    );

    return baseUsers.map((user, index) => {
      const detailResult = hydratedUsers[index];
      return detailResult.status === 'fulfilled' ? detailResult.value : user;
    });
  }, []);

  const loadUsers = useCallback(
    async (nextPage: number, nextPageSize: number) => {
      setLoading(true);
      try {
        const response = await fetchUsers({
          page: nextPage,
          pageSize: nextPageSize,
          query: searchTerm,
          roleId: roleFilter,
          status: statusFilter,
        });
        const hydratedUsers = await mergeHydratedUsers(response.users);
        setUsers(hydratedUsers);
        setTotal(response.total);
        setUserLoadError(null);
      } catch (error) {
        setUsers([]);
        setTotal(0);
        setUserLoadError(toLoadError(error, '加载用户列表失败'));
      } finally {
        setLoading(false);
      }
    },
    [mergeHydratedUsers, roleFilter, searchTerm, statusFilter],
  );

  const loadRoles = useCallback(async () => {
    try {
      const roleList = await fetchRoles();
      setRoles(roleList);
      setRoleLoadError(null);
    } catch (error) {
      setRoles([]);
      setRoleLoadError(toLoadError(error, '加载角色列表失败'));
    }
  }, []);

  useEffect(() => {
    void loadUsers(page, pageSize);
  }, [loadUsers, page, pageSize]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    const tableContainer = userTableContainerRef.current;
    if (!tableContainer) {
      return undefined;
    }

    const syncWidth = () => {
      setUserTableViewportWidth(Math.floor(tableContainer.clientWidth));
    };

    syncWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncWidth);
      return () => window.removeEventListener('resize', syncWidth);
    }

    const resizeObserver = new ResizeObserver(() => {
      syncWidth();
    });
    resizeObserver.observe(tableContainer);

    return () => resizeObserver.disconnect();
  }, []);

  const roleOptions = useMemo(
    () => roles.map((role) => ({
      value: role.id,
      label: isProtectedRole(role) ? `${role.name} · ${protectedGovernanceTagLabel}` : role.name,
    })),
    [roles],
  );
  const assignableRoleOptions = useMemo(
    () => getAssignableRoles(roles).map((role) => ({ value: role.id, label: role.name })),
    [roles],
  );

  const filtersActive = Boolean(searchTerm.trim() || roleFilter || statusFilter);
  const activeUsersCount = users.filter((user) => user.status === 'active').length;
  const disabledUsersCount = users.filter((user) => user.status === 'disabled').length;
  const identifiedRoleUsersCount = users.filter((user) => (user.roles?.length ?? 0) > 0).length;
  const selectedActiveCount = selectedUsers.filter((user) => user.status === 'active').length;
  const selectedDisabledCount = selectedUsers.filter((user) => user.status === 'disabled').length;
  const canOpenCreateUserModal = actionAccess.canCreateUser;
  const canEditUsers = canOpenUserEditModal(actionAccess);
  const canAssignRoleDuringCreate = canAssignRoleOnCreate(actionAccess);
  const isUserManagementReadOnly = actionAccess.isReadOnly;
  const canBatchDisable = actionAccess.canUpdateUserStatus && selectedUsers.some((user) => user.status === 'active');
  const canBatchEnable = actionAccess.canUpdateUserStatus && selectedUsers.some((user) => user.status === 'disabled');
  const currentPageSummary = filtersActive
    ? `当前筛选页返回 ${users.length} 条；后端命中 ${total} 条`
    : `当前页已加载 ${users.length} 条；后端总数 ${total} 条`;

  const refreshPageData = useCallback(async () => {
    clearSelection();
    await Promise.all([loadUsers(page, pageSize), loadRoles()]);
  }, [clearSelection, loadRoles, loadUsers, page, pageSize]);

  const openCreateModal = useCallback(() => {
    if (!canOpenCreateUserModal) {
      messageApi.warning('当前会话缺少新增用户权限');
      return;
    }
    createForm.resetFields();
    setIsCreateModalOpen(true);
  }, [canOpenCreateUserModal, createForm, messageApi]);

  const openEditModal = useCallback(
    (user: UserData) => {
      if (isProtectedUser(user)) {
        messageApi.warning('系统保留账号仅支持查看，不支持在此页编辑或重新授权');
        return;
      }
      if (!canEditUsers) {
        messageApi.warning('当前会话缺少编辑用户资料或调整角色的权限');
        return;
      }
      setEditingUser(user);
      form.setFieldsValue({
        display_name: user.display_name || user.username,
        email: user.email,
        role_id: user.roles?.[0]?.id,
      });
      setIsEditModalOpen(true);
    },
    [canEditUsers, form, messageApi],
  );

  const openDetailDrawer = useCallback(
    async (user: UserData) => {
      setDetailUser(user);
      setDetailError(null);
      setIsDetailDrawerOpen(true);
      setDetailLoading(true);
      try {
        const detailedUser = await fetchUser(user.id);
        setDetailUser(detailedUser);
        setUsers((previous) => previous.map((item) => (item.id === detailedUser.id ? detailedUser : item)));
      } catch (error) {
        setDetailError(toLoadError(error, '加载用户详情失败'));
      } finally {
        setDetailLoading(false);
      }
    },
    [],
  );

  const closeDetailDrawer = useCallback(() => {
    setIsDetailDrawerOpen(false);
    setDetailError(null);
  }, []);

  const handleCreateUser = useCallback(async () => {
    if (!actionAccess.canCreateUser) {
      messageApi.warning('当前会话缺少新增用户权限');
      return;
    }
    try {
      const values = await createForm.validateFields();
      setActionLoading(true);
      await createUser({
        username: values.username,
        password: values.password,
        email: values.email,
        display_name: values.display_name || values.username,
        role_id: canAssignRoleDuringCreate ? values.role_id : undefined,
      });
      setIsCreateModalOpen(false);
      createForm.resetFields();
      messageApi.success('用户创建成功');
      setPage(1);
      clearSelection();
      await Promise.all([loadUsers(1, pageSize), loadRoles()]);
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) return;
      messageApi.error((error as Error).message || '创建用户失败');
    } finally {
      setActionLoading(false);
    }
  }, [actionAccess.canCreateUser, canAssignRoleDuringCreate, clearSelection, createForm, loadRoles, loadUsers, messageApi, pageSize]);

  const handleEditUser = useCallback(async () => {
    if (!editingUser) return;
    if (isProtectedUser(editingUser)) {
      messageApi.warning('系统保留账号不支持在此页编辑');
      return;
    }
    if (!canEditUsers) {
      messageApi.warning('当前会话缺少编辑用户资料或调整角色的权限');
      return;
    }
    try {
      const values = await form.validateFields();
      const targetRoleId = values.role_id as string | undefined;
      const currentPrimaryRoleId = editingUser.roles?.[0]?.id;
      const roleChangeDeniedReason = getPrimaryRoleChangeDeniedReason(actionAccess, currentPrimaryRoleId, targetRoleId);
      if (roleChangeDeniedReason) {
        messageApi.warning(roleChangeDeniedReason);
        return;
      }

      const nextDisplayName = values.display_name || editingUser.username;
      const profileChanged = actionAccess.canUpdateUserProfile && (
        nextDisplayName !== (editingUser.display_name || editingUser.username) ||
        values.email !== editingUser.email
      );
      const roleChanged = canApplyPrimaryRoleChange(actionAccess, currentPrimaryRoleId, targetRoleId) && targetRoleId !== currentPrimaryRoleId;

      if (!profileChanged && !roleChanged) {
        messageApi.info('没有需要保存的变更');
        return;
      }

      setActionLoading(true);
      if (profileChanged) {
        await updateUser(editingUser.id, {
          display_name: nextDisplayName,
          email: values.email,
        });
      }

      if (roleChanged) {
        if (currentPrimaryRoleId) {
          await removeRole(editingUser.id, currentPrimaryRoleId);
        }
        if (targetRoleId) {
          await assignRole(editingUser.id, targetRoleId);
        }
      }

      setIsEditModalOpen(false);
      setEditingUser(null);
      form.resetFields();
      messageApi.success('用户信息已更新');
      await loadUsers(page, pageSize);
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) return;
      messageApi.error((error as Error).message || '更新用户失败');
    } finally {
      setActionLoading(false);
    }
  }, [actionAccess, canEditUsers, editingUser, form, loadUsers, messageApi, page, pageSize]);

  const updateSingleUserStatus = useCallback(
    async (user: UserData, nextStatus: UserStatus) => {
      if (isProtectedUser(user)) {
        messageApi.warning('系统保留账号不支持启用、禁用或删除');
        return;
      }
      if (!actionAccess.canUpdateUserStatus) {
        messageApi.warning('当前会话缺少变更用户状态的权限');
        return;
      }
      setActionLoading(true);
      try {
        if (nextStatus === 'disabled') {
          await disableUser(user.id);
        } else {
          await updateUser(user.id, { status: 'active' });
        }
        if (detailUser?.id === user.id) {
          setDetailUser((previous) => (previous ? { ...previous, status: nextStatus } : previous));
        }
        messageApi.success(nextStatus === 'active' ? '用户已启用' : '用户已禁用');
        await loadUsers(page, pageSize);
      } catch (error) {
        messageApi.error((error as Error).message || '操作失败');
      } finally {
        setActionLoading(false);
      }
    },
    [actionAccess.canUpdateUserStatus, detailUser?.id, loadUsers, messageApi, page, pageSize],
  );

  const handleBatchStatusChange = useCallback(
    async (nextStatus: UserStatus) => {
      if (!actionAccess.canUpdateUserStatus) {
        messageApi.warning('当前会话缺少批量变更用户状态的权限');
        return;
      }

      const skippedProtectedUsers = selectedUsers.filter((user) => isProtectedUser(user));
      const candidates = selectedUsers.filter((user) => !isProtectedUser(user) && user.status !== nextStatus);
      if (candidates.length === 0) {
        if (skippedProtectedUsers.length > 0) {
          messageApi.warning('系统保留账号不会参与批量状态变更');
          return;
        }
        messageApi.info(nextStatus === 'active' ? '所选用户均已启用' : '所选用户均已禁用');
        return;
      }

      setBatchActionLoading(true);
      try {
        const result = await batchUpdateUsersStatus(candidates.map((user) => user.id), nextStatus);
        if (result.updated < result.requested) {
          messageApi.warning(`批量操作完成：请求 ${result.requested} 个，实际更新 ${result.updated} 个`);
        } else if (skippedProtectedUsers.length > 0) {
          messageApi.warning(`已处理 ${result.updated} 个普通用户；${skippedProtectedUsers.length} 个系统保留账号已跳过`);
        } else {
          messageApi.success(nextStatus === 'active' ? `已批量启用 ${result.updated} 个用户` : `已批量禁用 ${result.updated} 个用户`);
        }
        clearSelection();
        await loadUsers(page, pageSize);
      } catch (error) {
        messageApi.error((error as Error).message || '批量操作失败');
      } finally {
        setBatchActionLoading(false);
      }
    },
    [actionAccess.canUpdateUserStatus, clearSelection, loadUsers, messageApi, page, pageSize, selectedUsers],
  );

  const handleResetFilters = useCallback(() => {
    setSearchTerm('');
    setRoleFilter(undefined);
    setStatusFilter(undefined);
    setPage(1);
    clearSelection();
  }, [clearSelection]);

  const handleCopyText = useCallback(async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      messageApi.success(successMessage);
    } catch {
      messageApi.error('复制失败');
    }
  }, [messageApi]);

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[], rows: UserData[]) => {
      setSelectedRowKeys(keys);
      setSelectedUsers(rows);
    },
    getTitleCheckboxProps: () => ({
      name: 'user-select-all',
      disabled: !actionAccess.canUpdateUserStatus,
    }),
    getCheckboxProps: (record: UserData) => ({
      disabled: !actionAccess.canUpdateUserStatus || record.id === currentSessionUserId || isProtectedUser(record),
      name: `user-select-${record.id}`,
    }),
  };

  const columns: ColumnsType<UserData> = [
    {
      title: '序号',
      key: 'index',
      width: 72,
      align: 'center',
      render: (_, __, index) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: palette.textSecondary }}>
          {(page - 1) * pageSize + index + 1}
        </span>
      ),
    },
    {
      title: '用户 (USER)',
      dataIndex: 'display_name',
      key: 'name',
      width: 190,
      render: (_, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `${COLORS.primary}20`,
              color: COLORS.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            {getUserDisplayName(record).charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 500 }}>{getUserDisplayName(record)}</span>
              {record.id === currentSessionUserId ? <Tag color="success">当前登录</Tag> : null}
              {isProtectedUser(record) ? <Tag color="magenta">{protectedGovernanceTagLabel}</Tag> : null}
            </div>
            <div style={{ fontSize: 12, color: palette.textSecondary }}>{record.username}</div>
            <div style={{ fontSize: 12, color: palette.textSecondary, fontFamily: 'JetBrains Mono, monospace' }}>
              ID: {record.id}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '邮箱 (EMAIL)',
      dataIndex: 'email',
      key: 'email',
      width: 220,
      render: (text: string) => <span style={{ color: palette.textSecondary }}>{text}</span>,
    },
    {
      title: '角色 (ROLE)',
      key: 'roles',
      width: 160,
      render: (_, record) => renderRoleTags(record.roles),
    },
    {
      title: '最后登录 (LAST LOGIN)',
      key: 'lastLogin',
      width: 160,
      render: (_, record) => (
        <span style={{ fontFamily: 'JetBrains Mono, monospace', color: palette.textSecondary }}>
          {formatDateTime(record.last_login_at)}
        </span>
      ),
    },
    {
      title: '状态 (STATUS)',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center',
      render: (status: string) => <Tag color={status === 'active' ? 'success' : 'default'}>{getStatusLabel(status)}</Tag>,
    },
    {
      title: '操作 (ACTIONS)',
      key: 'actions',
      align: 'right',
      width: 160,
      render: (_, record) => {
        const isSelf = record.id === currentSessionUserId;
        const isProtected = isProtectedUser(record);
        const nextStatus: UserStatus = record.status === 'active' ? 'disabled' : 'active';
        const toggleLabel = nextStatus === 'active' ? '启用用户' : '禁用用户';
        const roleFieldEnabled = canEditRoleForUser(actionAccess, record.roles?.[0]?.id);
        const editDisabled = isProtected || !canEditUsers || actionLoading;
        const toggleDisabled = isSelf || isProtected || !actionAccess.canUpdateUserStatus || actionLoading;
        const toggleButton = (
          <Button
            type="text"
            size="small"
            disabled={toggleDisabled}
            title={
              isProtected
                ? '系统保留账号不可修改状态'
                : isSelf
                  ? '当前登录用户不可在此页修改状态'
                  : !actionAccess.canUpdateUserStatus
                    ? '当前会话缺少变更用户状态权限'
                    : toggleLabel
            }
            icon={
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {nextStatus === 'active' ? 'check_circle' : 'block'}
              </span>
            }
          />
        );

        const editButton = (
          <Button
            type="text"
            size="small"
            title={
              isProtected
                ? '系统保留账号不可编辑'
                : !canEditUsers
                  ? '当前会话缺少编辑资料或角色授权权限'
                  : !actionAccess.canUpdateUserProfile && roleFieldEnabled
                    ? '当前会话仅可调整角色'
                    : '编辑用户'
            }
            onClick={() => openEditModal(record)}
            disabled={editDisabled}
            icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>}
          />
        );

        return (
          <Space size={4}>
            <Button
              type="text"
              size="small"
              title="查看详情"
              onClick={() => void openDetailDrawer(record)}
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>visibility</span>}
            />
            {isProtected ? (
              <Tooltip title="系统保留账号不可在此页编辑、启用或禁用">{editButton}</Tooltip>
            ) : !canEditUsers ? (
              <Tooltip title="当前会话缺少编辑用户资料或调整角色的权限">{editButton}</Tooltip>
            ) : editButton}
            {isProtected ? (
              <Tooltip title="系统保留账号不可在此页编辑、启用或禁用">{toggleButton}</Tooltip>
            ) : isSelf ? (
              <Tooltip title="当前登录用户不可在此页禁用自己">{toggleButton}</Tooltip>
            ) : !actionAccess.canUpdateUserStatus ? (
              <Tooltip title="当前会话缺少变更用户状态权限">{toggleButton}</Tooltip>
            ) : (
              <Popconfirm
                title={`${nextStatus === 'active' ? '启用' : '禁用'}用户？`}
                description={`确认要${nextStatus === 'active' ? '启用' : '禁用'} ${getUserDisplayName(record)} 吗？`}
                okText="确认"
                cancelText="取消"
                onConfirm={() => void updateSingleUserStatus(record, nextStatus)}
              >
                {toggleButton}
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  const userTableMinWidth = 1180;
  const userTableScroll = userTableViewportWidth > 0 && userTableViewportWidth < userTableMinWidth
    ? { x: userTableMinWidth }
    : undefined;

  const userErrorPresentation = userLoadError?.status === 401
    ? {
        status: '403' as const,
        title: '当前会话未登录或已失效',
        subTitle: '用户管理接口返回 401。请先重新登录，再继续查看或维护用户信息。',
      }
    : {
        status: 'warning' as const,
        title: '加载用户数据失败',
        subTitle: userLoadError?.message || '请稍后重试。',
      };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div
        style={{
          padding: '16px 24px',
          borderBottom: `1px solid ${palette.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          background: isDark ? '#111722' : palette.bgContainer,
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: palette.textSecondary,
              marginBottom: 4,
            }}
          >
            <span>安全与审计</span>
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>chevron_right</span>
            <span style={{ color: COLORS.primary, fontWeight: 500 }}>用户管理</span>
          </div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>用户管理</h2>
        </div>
        <Space wrap>
          <Button onClick={() => void refreshPageData()} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>}>
            刷新
          </Button>
          <Tooltip title={actionAccess.canInviteUser ? '普通账号邀请入口规划中；系统保留账号仅能由系统治理流程维护，不支持通过邀请创建' : '当前会话缺少用户邀请权限；后续该入口会按 iam.user.invite 单独开放'}>
            <span>
              <Button disabled icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_add</span>}>
                邀请用户
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={actionAccess.canImportUser ? '普通账号导入入口规划中；系统保留账号仅能由系统治理流程维护，不支持通过导入创建' : '当前会话缺少用户导入权限；后续该入口会按 iam.user.import 单独开放'}>
            <span>
              <Button disabled icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>upload_file</span>}>
                导入用户
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={canOpenCreateUserModal ? undefined : '当前会话缺少新增用户权限'}>
            <span>
              <Button type="primary" disabled={Boolean(userLoadError) || !canOpenCreateUserModal} onClick={openCreateModal} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>}>
                新增用户
              </Button>
            </span>
          </Tooltip>
        </Space>
      </div>

      {isUserManagementReadOnly ? (
        <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
          <Alert
            showIcon
            type="info"
            message="当前会话为只读访问"
            description="你可以查看用户、角色与详情信息，但不能新增用户、编辑资料、调整角色或变更账号状态。"
          />
        </div>
      ) : null}

      <div
        style={{
          padding: '16px 24px 0',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 16,
          flexShrink: 0,
        }}
      >
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>后端总用户数</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{total}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.primary}15`, color: COLORS.primary }}>
              <span className="material-symbols-outlined">groups</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>当前页启用</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{activeUsersCount}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.success}15`, color: COLORS.success }}>
              <span className="material-symbols-outlined">check_circle</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>当前页禁用</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{disabledUsersCount}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.warning}15`, color: COLORS.warning }}>
              <span className="material-symbols-outlined">block</span>
            </div>
          </div>
        </Card>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 13, color: palette.textSecondary }}>已识别角色</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{identifiedRoleUsersCount}</div>
            </div>
            <div style={{ padding: 8, borderRadius: 8, background: `${COLORS.purple}15`, color: COLORS.purple }}>
              <span className="material-symbols-outlined">shield</span>
            </div>
          </div>
        </Card>
      </div>

      <div
        style={{
          padding: '16px 24px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
          flexWrap: 'wrap',
        }}
      >
        <Input
          name="user_search"
          prefix={<span className="material-symbols-outlined" style={{ fontSize: 18, color: palette.textSecondary }}>search</span>}
          placeholder="按显示名、用户名、邮箱搜索..."
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setPage(1);
            clearSelection();
          }}
          style={{ width: 320 }}
          allowClear
          disabled={Boolean(userLoadError)}
        />
        <Select
          id="user-role-filter"
          placeholder="所有角色"
          value={roleFilter}
          onChange={(value) => {
            setRoleFilter(value);
            setPage(1);
            clearSelection();
          }}
          allowClear
          style={{ width: 180 }}
          options={roleOptions}
          disabled={Boolean(userLoadError) || Boolean(roleLoadError)}
        />
        <Select
          id="user-status-filter"
          placeholder="所有状态"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
            clearSelection();
          }}
          allowClear
          style={{ width: 140 }}
          disabled={Boolean(userLoadError)}
          options={[
            { value: 'active', label: '启用' },
            { value: 'disabled', label: '禁用' },
          ]}
        />
        <Button onClick={handleResetFilters} disabled={Boolean(userLoadError)}>
          重置筛选
        </Button>
      </div>

      <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
        {roleLoadError ? (
          <Alert
            showIcon
            type={roleLoadError.status === 401 ? 'warning' : 'error'}
            message={roleLoadError.status === 401 ? '角色信息未授权，角色筛选与角色分配暂不可用' : '角色信息加载失败'}
            description={roleLoadError.message}
            action={<Button size="small" onClick={() => void loadRoles()}>重试角色加载</Button>}
          />
        ) : (
          <Alert
            showIcon
            type="info"
            message={currentPageSummary}
            description={filtersActive ? '搜索与筛选已切换为服务端查询；角色显示仍通过详情接口回填。' : '角色显示已通过详情接口回填。'}
          />
        )}
      </div>

      <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
        <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600 }}>批量操作</span>
              <span style={{ color: palette.textSecondary }}>已选 {selectedUsers.length} 人</span>
              {selectedUsers.length > 0 ? (
                <span style={{ color: palette.textSecondary }}>启用 {selectedActiveCount} / 禁用 {selectedDisabledCount}</span>
              ) : null}
            </div>
            <Space wrap>
              <Popconfirm
                title="确认批量启用？"
                description={`将批量启用 ${selectedDisabledCount} 个已禁用用户`}
                okText="确认启用"
                cancelText="取消"
                disabled={!canBatchEnable}
                onConfirm={() => void handleBatchStatusChange('active')}
              >
                <Button disabled={!canBatchEnable} loading={batchActionLoading}>
                  批量启用
                </Button>
              </Popconfirm>
              <Popconfirm
                title="确认批量禁用？"
                description={`将批量禁用 ${selectedActiveCount} 个已启用用户`}
                okText="确认禁用"
                cancelText="取消"
                disabled={!canBatchDisable}
                onConfirm={() => void handleBatchStatusChange('disabled')}
              >
                <Button danger disabled={!canBatchDisable} loading={batchActionLoading}>
                  批量禁用
                </Button>
              </Popconfirm>
              <Button onClick={clearSelection} disabled={selectedUsers.length === 0}>
                清空选择
              </Button>
            </Space>
          </div>
        </Card>
      </div>

      <div ref={userTableContainerRef} style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {userLoadError ? (
          <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Result
              status={userErrorPresentation.status}
              title={userErrorPresentation.title}
              subTitle={userErrorPresentation.subTitle}
              extra={[
                <Button key="retry" onClick={() => void refreshPageData()}>重新加载</Button>,
                userLoadError.status === 401 ? (
                  <Button key="login" type="primary" onClick={() => { window.location.hash = '#/login'; }}>
                    前往登录
                  </Button>
                ) : null,
              ]}
            />
          </div>
        ) : (
          <Spin spinning={loading}>
            <Table<UserData>
              rowSelection={rowSelection}
              columns={columns}
              dataSource={users}
              rowKey="id"
              size="middle"
              loading={false}
              scroll={userTableScroll}
              onRow={(record) => ({
                onDoubleClick: () => {
                  void openDetailDrawer(record);
                },
              })}
              pagination={{
                current: page,
                pageSize,
                total,
                showTotal: (itemsTotal, range) => `显示 ${range[0]} 到 ${range[1]} 条，共 ${itemsTotal} 条记录`,
                showSizeChanger: true,
                onChange: (nextPage, nextPageSize) => {
                  clearSelection();
                  setPage(nextPage);
                  setPageSize(nextPageSize ?? 10);
                },
              }}
              locale={{
                emptyText: <Empty description={filtersActive ? '没有匹配条件的用户' : '暂无用户数据'} />,
              }}
            />
          </Spin>
        )}
      </div>

      <Modal
        open={isCreateModalOpen}
        title="新增用户"
        onCancel={() => {
          setIsCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => void handleCreateUser()}
        okText="创建"
        cancelText="取消"
        width={520}
        confirmLoading={actionLoading}
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少 3 位' },
              { max: 32, message: '用户名最多 32 位' },
            ]}
          >
            <Input name="create_username" placeholder="输入登录用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label="密码"
            extra="至少 8 位，且包含大写、小写、数字、特殊符号中的至少 3 类"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 8, message: '密码至少 8 位' },
            ]}
          >
            <Input.Password name="create_password" placeholder="输入密码" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input name="create_display_name" placeholder="输入显示名称（可选）" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input name="create_email" placeholder="输入邮箱地址" />
          </Form.Item>
          <Form.Item
            name="role_id"
            label="初始角色"
            extra={canAssignRoleDuringCreate ? undefined : '当前会话缺少角色授予权限，新建用户后也不会自动附带角色'}
          >
            <Select
              placeholder={
                roleLoadError
                  ? '角色加载失败，暂不可选'
                  : canAssignRoleDuringCreate
                    ? '选择角色（可选）'
                    : '当前会话无角色授予权限'
              }
              allowClear
              options={assignableRoleOptions}
              disabled={Boolean(roleLoadError) || !canAssignRoleDuringCreate}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={isEditModalOpen}
        title="编辑用户"
        onCancel={() => {
          setIsEditModalOpen(false);
          setEditingUser(null);
          form.resetFields();
        }}
        onOk={() => void handleEditUser()}
        okText="保存"
        cancelText="取消"
        width={520}
        confirmLoading={actionLoading}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="display_name" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input name="edit_display_name" disabled={!actionAccess.canUpdateUserProfile} />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input name="edit_email" disabled={!actionAccess.canUpdateUserProfile} />
          </Form.Item>
          <Form.Item
            name="role_id"
            label="角色"
            extra={
              editingUser && !canEditRoleForUser(actionAccess, editingUser.roles?.[0]?.id)
                ? '当前会话缺少本次角色调整所需的授予或移除权限'
                : undefined
            }
          >
            <Select
              placeholder={
                roleLoadError
                  ? '角色加载失败，暂不可选'
                  : editingUser && canEditRoleForUser(actionAccess, editingUser.roles?.[0]?.id)
                    ? '选择角色'
                    : '当前会话无角色调整权限'
              }
              allowClear
              options={assignableRoleOptions}
              disabled={Boolean(roleLoadError) || (editingUser ? !canEditRoleForUser(actionAccess, editingUser.roles?.[0]?.id) : true)}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        open={isDetailDrawerOpen}
        title={detailUser ? `${getUserDisplayName(detailUser)} · 用户详情` : '用户详情'}
        width={560}
        onClose={closeDetailDrawer}
        extra={
          detailUser ? (
            <Space>
              <Button size="small" onClick={() => void handleCopyText(detailUser.id, '用户 ID 已复制')}>
                复制 ID
              </Button>
              <Button size="small" onClick={() => void handleCopyText(detailUser.email, '邮箱已复制')}>
                复制邮箱
              </Button>
            </Space>
          ) : null
        }
      >
        {detailLoading ? (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <Spin />
          </div>
        ) : detailError ? (
          <Result status="warning" title="加载用户详情失败" subTitle={detailError.message} extra={<Button onClick={() => detailUser && void openDetailDrawer(detailUser)}>重试</Button>} />
        ) : detailUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isProtectedUser(detailUser) ? (
              <Alert
                showIcon
                type="info"
                message="系统保留账号"
                description="该账号由系统治理规则保护，仅用于平台管理或自动化审计归因，不支持在当前页面修改状态或角色。"
              />
            ) : null}
            <Card size="small" style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <Descriptions
                column={1}
                size="small"
                styles={{ label: { width: 108, color: palette.textSecondary } }}
              >
                <Descriptions.Item label="显示名称">{getUserDisplayName(detailUser)}</Descriptions.Item>
                <Descriptions.Item label="用户名">{detailUser.username}</Descriptions.Item>
                <Descriptions.Item label="邮箱">{detailUser.email}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={detailUser.status === 'active' ? 'success' : 'default'}>{getStatusLabel(detailUser.status)}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="角色">{renderRoleTags(detailUser.roles, 6)}</Descriptions.Item>
                <Descriptions.Item label="用户 ID">
                  <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{detailUser.id}</span>
                </Descriptions.Item>
                <Descriptions.Item label="最后登录">{formatDateTime(detailUser.last_login_at)}</Descriptions.Item>
                <Descriptions.Item label="创建时间">{formatDateTime(detailUser.created_at)}</Descriptions.Item>
                <Descriptions.Item label="更新时间">{formatDateTime(detailUser.updated_at)}</Descriptions.Item>
              </Descriptions>
            </Card>
            <Card size="small" title="快捷操作" style={{ background: palette.bgContainer, borderColor: palette.border }}>
              <Space wrap>
                {isProtectedUser(detailUser) ? (
                  <Tooltip title="系统保留账号不可在此页编辑或重新授权">
                    <Button disabled>编辑资料</Button>
                  </Tooltip>
                ) : !canEditUsers ? (
                  <Tooltip title="当前会话缺少编辑用户资料或调整角色的权限">
                    <Button disabled>编辑资料</Button>
                  </Tooltip>
                ) : (
                  <Button onClick={() => { closeDetailDrawer(); openEditModal(detailUser); }}>编辑资料</Button>
                )}
                {isProtectedUser(detailUser) ? (
                  <Tooltip title="系统保留账号不可在此页修改状态">
                    <Button disabled>
                      {detailUser.status === 'active' ? '禁用用户' : '启用用户'}
                    </Button>
                  </Tooltip>
                ) : detailUser.id === currentSessionUserId ? (
                  <Tooltip title="当前登录用户不可在此页禁用自己">
                    <Button disabled>
                      {detailUser.status === 'active' ? '禁用用户' : '启用用户'}
                    </Button>
                  </Tooltip>
                ) : !actionAccess.canUpdateUserStatus ? (
                  <Tooltip title="当前会话缺少变更用户状态权限">
                    <Button disabled>
                      {detailUser.status === 'active' ? '禁用用户' : '启用用户'}
                    </Button>
                  </Tooltip>
                ) : (
                  <Popconfirm
                    title={detailUser.status === 'active' ? '确认禁用该用户？' : '确认启用该用户？'}
                    okText="确认"
                    cancelText="取消"
                    onConfirm={() => void updateSingleUserStatus(detailUser, detailUser.status === 'active' ? 'disabled' : 'active')}
                  >
                    <Button>
                      {detailUser.status === 'active' ? '禁用用户' : '启用用户'}
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
};

export default UserManagement;
