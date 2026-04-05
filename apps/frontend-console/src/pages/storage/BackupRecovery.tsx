import React, { useState, useCallback, useEffect } from 'react';
import { Button, Card, Table, Tag, Space, Modal, Form, Select, Input, message, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useThemeStore } from '../../stores/themeStore';
import { COLORS, DARK_PALETTE, LIGHT_PALETTE } from '../../theme/tokens';
import {
  fetchBackupRepositories,
  fetchBackupSnapshots,
  createBackupSnapshot,
  restoreSnapshot,
  deleteSnapshot,
  type BackupRepository,
  type BackupSnapshot,
} from '../../api/export';
import InlineLoadingState from '../../components/common/InlineLoadingState';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

const SNAPSHOT_STATE_MAP: Record<string, { color: string; label: string }> = {
  SUCCESS: { color: 'success', label: '成功' },
  IN_PROGRESS: { color: 'processing', label: '进行中' },
  PARTIAL: { color: 'warning', label: '部分成功' },
  FAILED: { color: 'error', label: '失败' },
  INCOMPATIBLE: { color: 'default', label: '不兼容' },
};

const BackupRecovery: React.FC = () => {
  const isDark = useThemeStore((s) => s.isDark);
  const p = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const [repositories, setRepositories] = useState<BackupRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState<BackupSnapshot | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [form] = Form.useForm();
  const [restoreForm] = Form.useForm();

  const loadRepositories = useCallback(async () => {
    setLoadingRepos(true);
    setError(null);
    try {
      const repos = await fetchBackupRepositories();
      setRepositories(repos);
      setLastUpdatedAt(new Date());
      if (repos.length > 0 && !selectedRepo) {
        setSelectedRepo(repos[0].name);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载仓库失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoadingRepos(false);
    }
  }, [selectedRepo]);

  const loadSnapshots = useCallback(async () => {
    if (!selectedRepo) {
      setSnapshots([]);
      return;
    }
    setLoadingSnapshots(true);
    setError(null);
    try {
      const list = await fetchBackupSnapshots(selectedRepo);
      setSnapshots(list);
      setLastUpdatedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载快照失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoadingSnapshots(false);
    }
  }, [selectedRepo]);

  useEffect(() => {
    loadRepositories();
  }, [loadRepositories]);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  const handleCreateSnapshot = async () => {
    try {
      const values = await form.validateFields();
      setCreateLoading(true);
      await createBackupSnapshot({
        repository: selectedRepo || values.repository,
        name: values.name,
        indices: values.indices || undefined,
        description: values.description || undefined,
      });
      message.success('快照创建已提交');
      setShowCreateModal(false);
      form.resetFields();
      loadSnapshots();
    } catch (err) {
      if (err instanceof Error && !err.message.includes('validateFields')) {
        message.error(err.message);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRestore = async () => {
    const snapshot = showRestoreModal;
    if (!snapshot) return;
    try {
      const values = await restoreForm.validateFields();
      setRestoreLoading(true);
      await restoreSnapshot(snapshot.snapshot, {
        repository: selectedRepo,
        indices: values.indices ? values.indices.split(/[\s,]+/).filter(Boolean) : undefined,
      });
      message.success('恢复已启动');
      setShowRestoreModal(null);
      restoreForm.resetFields();
    } catch (err) {
      if (err instanceof Error && !err.message.includes('validateFields')) {
        message.error(err.message);
      }
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleDelete = async (snapshot: BackupSnapshot) => {
    if (snapshot.state === 'IN_PROGRESS') {
      message.warning('进行中的快照无法删除');
      return;
    }
    setDeleteLoading(snapshot.snapshot);
    try {
      await deleteSnapshot(snapshot.snapshot, selectedRepo);
      message.success('快照已删除');
      loadSnapshots();
    } catch (err) {
      message.error(err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeleteLoading(null);
    }
  };

  const formatIndices = (indices: string | string[]): string => {
    return Array.isArray(indices) ? indices.join(', ') : (indices || '-');
  };

  const snapshotColumns: ColumnsType<BackupSnapshot> = [
    {
      title: '快照名称',
      dataIndex: 'snapshot',
      key: 'snapshot',
      render: (name: string) => (
        <span style={{ color: COLORS.primary, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}>{name}</span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 100,
      render: (state: string) => {
        const cfg = SNAPSHOT_STATE_MAP[state] ?? { color: 'default', label: state };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '索引',
      dataIndex: 'indices',
      key: 'indices',
      render: (indices: string | string[]) => <Tag>{formatIndices(indices)}</Tag>,
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      width: 180,
      render: (v: string) => <span style={{ fontSize: 13, color: p.textSecondary }}>{v || '-'}</span>,
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 180,
      render: (v: string) => <span style={{ fontSize: 13, color: p.textSecondary }}>{v || '-'}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_: unknown, record: BackupSnapshot) => (
        <Space size={4}>
          <Button
            size="small"
            disabled={record.state !== 'SUCCESS'}
            onClick={() => {
              setShowRestoreModal(record);
              restoreForm.setFieldsValue({ indices: formatIndices(record.indices) });
            }}
          >
            恢复
          </Button>
          <Button
            size="small"
            danger
            loading={deleteLoading === record.snapshot}
            disabled={record.state === 'IN_PROGRESS'}
            onClick={() => handleDelete(record)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%' }}>
      <AnalysisPageHeader
        title="备份与恢复"
        subtitle="管理索引快照仓库及数据恢复"
        statusTag={<Tag color={selectedRepo ? 'blue' : 'default'} style={{ margin: 0 }}>{selectedRepo ? `仓库：${selectedRepo}` : '未选择仓库'}</Tag>}
        lastUpdatedAt={lastUpdatedAt}
        actions={(
          <>
            <Button onClick={() => { window.location.hash = '#/help/faq'; }} icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>}>
              帮助
            </Button>
            <Select
              placeholder="选择仓库"
              value={selectedRepo || undefined}
              onChange={setSelectedRepo}
              style={{ width: 200 }}
              loading={loadingRepos}
              options={repositories.map((r) => ({ value: r.name, label: `${r.name} (${r.type})` }))}
            />
            <Button
              type="primary"
              icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_a_photo</span>}
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedRepo}
            >
              创建快照
            </Button>
            <Button icon={<span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>} onClick={() => void loadSnapshots()}>
              刷新数据
            </Button>
          </>
        )}
      />

      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        <div style={{ padding: '12px 24px', borderBottom: `1px solid ${p.border}` }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>快照列表</span>
          {selectedRepo && <span style={{ marginLeft: 8, fontSize: 12, color: p.textSecondary }}>仓库: {selectedRepo}</span>}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {!selectedRepo ? (
            <Empty description="请先选择仓库" style={{ padding: 48 }} />
          ) : loadingSnapshots ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
              <InlineLoadingState tip="加载中..." />
            </div>
          ) : error ? (
            <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: 48 }} />
          ) : (
            <Table<BackupSnapshot>
              rowKey="snapshot"
              columns={snapshotColumns}
              dataSource={snapshots}
              size="middle"
              pagination={{ pageSize: 20 }}
              loading={false}
            />
          )}
        </div>
      </Card>

      <Modal
        title="创建快照"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        footer={null}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleCreateSnapshot}>
          {!selectedRepo && (
            <Form.Item name="repository" label="仓库" rules={[{ required: true }]}>
              <Select
                placeholder="选择仓库"
                options={repositories.map((r) => ({ value: r.name, label: r.name }))}
              />
            </Form.Item>
          )}
          <Form.Item name="name" label="快照名称" rules={[{ required: true, message: '请输入快照名称' }]}>
            <Input placeholder="例如: snapshot-20240306" />
          </Form.Item>
          <Form.Item name="indices" label="索引 (逗号分隔)">
            <Input placeholder="nexuslog-* 或留空表示全部" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setShowCreateModal(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`恢复快照: ${showRestoreModal?.snapshot ?? ''}`}
        open={!!showRestoreModal}
        onCancel={() => setShowRestoreModal(null)}
        footer={null}
        destroyOnHidden
      >
        <Form form={restoreForm} layout="vertical" onFinish={handleRestore}>
          <Form.Item
            name="indices"
            label="要恢复的索引 (逗号分隔，留空恢复快照内全部)"
          >
            <Input.TextArea rows={3} placeholder="例如: nexuslog-2024-01, nexuslog-2024-02" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => setShowRestoreModal(null)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={restoreLoading}>
                开始恢复
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BackupRecovery;
