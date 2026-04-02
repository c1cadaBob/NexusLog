import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Descriptions, Divider, Form, Input, InputNumber, Radio, Select, Space, Steps, Tabs, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  createPullSource,
  fetchIngestAgents,
  generateDeploymentScript,
  type GenerateDeploymentScriptResponse,
  type IngestAgentItem,
} from '../../api/ingest';

const SOURCE_TYPE_OPTIONS = [
  { label: '文本日志', value: 'custom', description: '任意应用日志目录或文件模式' },
  { label: 'Nginx', value: 'nginx', description: '接入 access / error 日志' },
  { label: 'Java 应用', value: 'java', description: '接入 JVM 或业务日志目录' },
  { label: 'MySQL', value: 'mysql', description: '接入 error / slow query 日志' },
  { label: 'Docker', value: 'docker', description: '接入容器 stdout/stderr 日志' },
  { label: 'Kubernetes', value: 'kubernetes', description: '接入容器日志目录' },
  { label: 'Syslog / 网络设备', value: 'syslog', description: '通过 collector-agent 监听 UDP/TCP Syslog' },
] as const;

const DEPLOY_TARGET_OPTIONS = [
  { label: 'Linux systemd', value: 'linux-systemd' },
  { label: 'Linux Docker', value: 'linux-docker' },
  { label: 'Windows 启动任务', value: 'windows-startup-task' },
  { label: '网络设备 Syslog UDP', value: 'network-syslog-udp' },
  { label: '网络设备 Syslog TCP', value: 'network-syslog-tcp' },
] as const;

const RELEASE_PROVIDER_OPTIONS = [
  { label: 'GitHub Release', value: 'github' },
  { label: 'Gitee Release', value: 'gitee' },
  { label: '自定义地址', value: 'custom' },
] as const;

const IMAGE_PROVIDER_OPTIONS = [
  { label: 'GHCR', value: 'ghcr' },
  { label: '自定义镜像', value: 'custom' },
] as const;

const DEFAULTS_BY_SOURCE_TYPE: Record<string, { path: string; protocol: string }> = {
  custom: { path: '/var/log/*.log', protocol: 'http' },
  nginx: { path: '/var/log/nginx/access.log,/var/log/nginx/error.log', protocol: 'http' },
  java: { path: '/var/log/*.log', protocol: 'http' },
  mysql: { path: '/var/log/mysql/*.log,/var/log/mysqld.log', protocol: 'http' },
  docker: { path: '/var/lib/docker/containers/*/*.log', protocol: 'http' },
  kubernetes: { path: '/var/log/containers/*.log', protocol: 'http' },
  syslog: { path: 'syslog://udp/0.0.0.0:5514', protocol: 'syslog_udp' },
};

function parseHostPort(agentBaseUrl?: string) {
  if (!agentBaseUrl) return { host: '', port: 9091 };
  try {
    const url = new URL(agentBaseUrl);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
    };
  } catch {
    return { host: '', port: 9091 };
  }
}

function buildReleaseBaseUrl(
  provider: 'github' | 'gitee' | 'custom',
  owner: string,
  repo: string,
  version: string,
  customUrl: string,
) {
  if (provider === 'custom') {
    return customUrl.trim();
  }
  const safeOwner = owner.trim() || '<owner>';
  const safeRepo = repo.trim() || '<repo>';
  const host = provider === 'gitee' ? 'https://gitee.com' : 'https://github.com';
  return `${host}/${safeOwner}/${safeRepo}/releases/download/${version}`;
}

function buildContainerImage(
  provider: 'ghcr' | 'custom',
  owner: string,
  repo: string,
  version: string,
  customImage: string,
) {
  if (provider === 'custom') {
    return customImage.trim();
  }
  const safeOwner = owner.trim() || '<owner>';
  const safeRepo = repo.trim() || '<repo>';
  return `ghcr.io/${safeOwner}/${safeRepo}/collector-agent:${version}`;
}

const AccessWizard: React.FC = () => {
  const navigate = useNavigate();
  const { message: messageApi } = App.useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [sourceType, setSourceType] = useState<string>('custom');
  const [sourceName, setSourceName] = useState('');
  const [sourcePath, setSourcePath] = useState(DEFAULTS_BY_SOURCE_TYPE.custom.path);
  const [protocol, setProtocol] = useState(DEFAULTS_BY_SOURCE_TYPE.custom.protocol);
  const [pullIntervalSec, setPullIntervalSec] = useState(30);
  const [pullTimeoutSec, setPullTimeoutSec] = useState(30);
  const [agentMode, setAgentMode] = useState<'existing' | 'new'>('existing');
  const [agents, setAgents] = useState<IngestAgentItem[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [agentBaseUrl, setAgentBaseUrl] = useState('http://127.0.0.1:9091');
  const [controlPlaneBaseUrl, setControlPlaneBaseUrl] = useState(window.location.origin);
  const [releaseProvider, setReleaseProvider] = useState<'github' | 'gitee' | 'custom'>('github');
  const [releaseOwner, setReleaseOwner] = useState('');
  const [releaseRepo, setReleaseRepo] = useState('NexusLog');
  const [releaseVersion, setReleaseVersion] = useState('');
  const [releaseBaseUrl, setReleaseBaseUrl] = useState('');
  const [containerImageProvider, setContainerImageProvider] = useState<'ghcr' | 'custom'>('ghcr');
  const [containerImage, setContainerImage] = useState('');
  const [deploymentTarget, setDeploymentTarget] = useState<typeof DEPLOY_TARGET_OPTIONS[number]['value']>('linux-systemd');
  const [scriptResponse, setScriptResponse] = useState<GenerateDeploymentScriptResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [syslogBind, setSyslogBind] = useState('0.0.0.0:5514');
  const [syslogProtocol, setSyslogProtocol] = useState<'udp' | 'tcp'>('udp');

  const normalizedVersion = useMemo(() => releaseVersion.trim() || 'latest', [releaseVersion]);
  const resolvedReleaseBaseUrl = useMemo(
    () => buildReleaseBaseUrl(releaseProvider, releaseOwner, releaseRepo, normalizedVersion, releaseBaseUrl),
    [normalizedVersion, releaseBaseUrl, releaseOwner, releaseProvider, releaseRepo],
  );
  const resolvedContainerImage = useMemo(
    () => buildContainerImage(containerImageProvider, releaseOwner, releaseRepo, normalizedVersion, containerImage),
    [containerImage, containerImageProvider, normalizedVersion, releaseOwner, releaseRepo],
  );
  const releaseConfigUsesPlaceholder = useMemo(
    () => resolvedReleaseBaseUrl.includes('<owner>') || resolvedReleaseBaseUrl.includes('<repo>'),
    [resolvedReleaseBaseUrl],
  );
  const imageConfigUsesPlaceholder = useMemo(
    () => resolvedContainerImage.includes('<owner>') || resolvedContainerImage.includes('<repo>'),
    [resolvedContainerImage],
  );

  const selectedAgent = useMemo(
    () => agents.find((item) => item.agent_id === selectedAgentId) ?? null,
    [agents, selectedAgentId],
  );

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    try {
      const data = await fetchIngestAgents();
      setAgents(data);
      const firstOnline = data.find((item) => item.live_connected) ?? data[0] ?? null;
      if (firstOnline) {
        setSelectedAgentId(firstOnline.agent_id);
        if (firstOnline.agent_base_url) {
          setAgentBaseUrl(firstOnline.agent_base_url);
        }
      }
    } catch (err) {
      messageApi.error(`Agent 列表加载失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAgentsLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  useEffect(() => {
    const defaults = DEFAULTS_BY_SOURCE_TYPE[sourceType] ?? DEFAULTS_BY_SOURCE_TYPE.custom;
    setSourcePath(defaults.path);
    setProtocol(defaults.protocol);
    if (sourceType === 'syslog') {
      setDeploymentTarget((current) => (current.startsWith('network-syslog') ? current : 'linux-systemd'));
      setSourcePath(`syslog://${syslogProtocol}/${syslogBind}`);
    }
  }, [sourceType, syslogBind, syslogProtocol]);

  useEffect(() => {
    if (sourceType === 'syslog') {
      setProtocol(syslogProtocol === 'tcp' ? 'syslog_tcp' : 'syslog_udp');
      setSourcePath(`syslog://${syslogProtocol}/${syslogBind}`);
    }
  }, [syslogBind, syslogProtocol, sourceType]);

  useEffect(() => {
    if (selectedAgent?.agent_base_url && agentMode === 'existing') {
      setAgentBaseUrl(selectedAgent.agent_base_url);
    }
  }, [selectedAgent?.agent_base_url, agentMode]);

  useEffect(() => {
    setScriptResponse(null);
  }, [
    agentBaseUrl,
    agentMode,
    containerImage,
    containerImageProvider,
    controlPlaneBaseUrl,
    deploymentTarget,
    pullIntervalSec,
    pullTimeoutSec,
    releaseBaseUrl,
    releaseOwner,
    releaseProvider,
    releaseRepo,
    normalizedVersion,
    selectedAgentId,
    sourceName,
    sourcePath,
    sourceType,
    syslogBind,
    syslogProtocol,
  ]);

  const agentOptions = useMemo(
    () => agents.map((agent) => ({
      label: `${agent.hostname || agent.host || agent.agent_id} (${agent.status})`,
      value: agent.agent_id,
    })),
    [agents],
  );

  const validateStep = useCallback((step: number) => {
    if (step === 0) {
      if (!sourceName.trim()) {
        messageApi.warning('请输入数据源名称');
        return false;
      }
      if (!sourceType.trim()) {
        messageApi.warning('请选择数据源类型');
        return false;
      }
      return true;
    }
    if (step === 1) {
      if (agentMode === 'existing' && !selectedAgentId) {
        messageApi.warning('请选择一个已有 Agent');
        return false;
      }
      if (!agentBaseUrl.trim()) {
        messageApi.warning('请输入 Agent 基础 URL');
        return false;
      }
      if (!sourcePath.trim()) {
        messageApi.warning('请输入采集路径或 source_path');
        return false;
      }
      return true;
    }
    return true;
  }, [agentBaseUrl, agentMode, messageApi, selectedAgentId, sourceName, sourcePath, sourceType]);

  const handleNext = useCallback(() => {
    if (!validateStep(currentStep)) return;
    setCurrentStep((value) => Math.min(value + 1, 2));
  }, [currentStep, validateStep]);

  const handlePrev = useCallback(() => {
    setCurrentStep((value) => Math.max(value - 1, 0));
  }, []);

  const handleGenerateScript = useCallback(async () => {
    if (!validateStep(1)) return;
    setScriptLoading(true);
    try {
      const includePaths = sourceType === 'syslog'
        ? []
        : sourcePath.split(',').map((item) => item.trim()).filter(Boolean);
      const result = await generateDeploymentScript({
        target_kind: deploymentTarget,
        source_name: sourceName.trim(),
        source_type: sourceType,
        agent_id: selectedAgentId || undefined,
        agent_base_url: agentBaseUrl.trim(),
        control_plane_base_url: controlPlaneBaseUrl.trim(),
        release_base_url: resolvedReleaseBaseUrl || undefined,
        container_image: resolvedContainerImage || undefined,
        version: normalizedVersion,
        include_paths: includePaths,
        exclude_paths: [],
        syslog_bind: sourceType === 'syslog' ? syslogBind : undefined,
        syslog_protocol: sourceType === 'syslog' ? syslogProtocol : undefined,
      });
      setScriptResponse(result);
      messageApi.success('部署脚本已生成');
    } catch (err) {
      messageApi.error(`脚本生成失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScriptLoading(false);
    }
  }, [
    agentBaseUrl,
    controlPlaneBaseUrl,
    deploymentTarget,
    messageApi,
    normalizedVersion,
    resolvedContainerImage,
    resolvedReleaseBaseUrl,
    selectedAgentId,
    sourceName,
    sourcePath,
    sourceType,
    syslogBind,
    syslogProtocol,
    validateStep,
  ]);

  const handleCreate = useCallback(async () => {
    if (!validateStep(1)) return;
    const { host, port } = parseHostPort(agentBaseUrl.trim());
    if (!host) {
      messageApi.warning('Agent 基础 URL 无法解析主机名');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createPullSource({
        name: sourceName.trim(),
        host,
        port,
        protocol,
        path: sourcePath.trim(),
        auth: 'agent-key',
        agent_base_url: agentBaseUrl.trim(),
        pull_interval_sec: pullIntervalSec,
        pull_timeout_sec: pullTimeoutSec,
        key_ref: 'active',
        status: 'active',
      });
      messageApi.success(`采集源 ${created.name} 已创建`);
      navigate('/ingestion/sources');
    } catch (err) {
      messageApi.error(`创建采集源失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSubmitting(false);
    }
  }, [agentBaseUrl, messageApi, navigate, protocol, pullIntervalSec, pullTimeoutSec, sourceName, sourcePath, validateStep]);

  const renderStepOne = () => (
    <Card title="1. 选择来源与命名">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <div>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>数据源类型</div>
          <Radio.Group name="sourceType" value={sourceType} onChange={(event) => setSourceType(event.target.value)}>
            <Space direction="vertical">
              {SOURCE_TYPE_OPTIONS.map((item) => (
                <Radio key={item.value} value={item.value}>
                  <Space direction="vertical" size={0}>
                    <span>{item.label}</span>
                    <Typography.Text type="secondary">{item.description}</Typography.Text>
                  </Space>
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </div>
        <Form layout="vertical" name="access-wizard-step-one">
          <Form.Item label="数据源名称" required>
            <Input
              name="sourceName"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="例如：prod-nginx-access / branch-router-syslog"
            />
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );

  const renderStepTwo = () => (
    <Card title="2. 选择 Agent 与采集配置">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Radio.Group name="agentMode" value={agentMode} onChange={(event) => setAgentMode(event.target.value)}>
          <Space>
            <Radio value="existing">绑定现有 Agent</Radio>
            <Radio value="new">为新主机生成部署脚本</Radio>
          </Space>
        </Radio.Group>

        {agentMode === 'existing' ? (
          <Card size="small" type="inner" title="现有 Agent">
            {agentsLoading ? (
              <Typography.Text type="secondary">正在加载 Agent 列表...</Typography.Text>
            ) : !agents.length ? (
              <Typography.Text type="secondary">当前没有可用 Agent，可切换到“为新主机生成部署脚本”，先部署 agent 再回来绑定。</Typography.Text>
            ) : (
              <Form layout="vertical" name="access-wizard-existing-agent">
                <Form.Item label="Agent">
                  <Select id="access-wizard-agent-select" value={selectedAgentId || undefined} options={agentOptions} onChange={setSelectedAgentId} />
                </Form.Item>
                <Form.Item label="Agent 基础 URL">
                  <Input name="agentBaseUrl" value={agentBaseUrl} onChange={(event) => setAgentBaseUrl(event.target.value)} />
                </Form.Item>
              </Form>
            )}
          </Card>
        ) : (
          <Card size="small" type="inner" title="新主机部署参数">
            <Form layout="vertical" name="access-wizard-new-agent-basic">
              <Form.Item label="Agent 基础 URL" extra="创建采集源后，控制面会通过这个地址探活与拉取日志。">
                <Input name="agentBaseUrl" value={agentBaseUrl} onChange={(event) => setAgentBaseUrl(event.target.value)} placeholder="例如：http://10.0.0.15:9091" />
              </Form.Item>
              <Form.Item label="控制面 URL" extra="Agent 用它上报系统资源指标，建议填写控制面可被被采集主机访问的地址。">
                <Input name="controlPlaneBaseUrl" value={controlPlaneBaseUrl} onChange={(event) => setControlPlaneBaseUrl(event.target.value)} placeholder="例如：http://192.168.0.202:8080" />
              </Form.Item>
            </Form>
          </Card>
        )}

        <Card size="small" type="inner" title="部署产物配置">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Card size="small" type="inner" title="发布源与版本">
              <Form layout="vertical" name="access-wizard-release-config">
                <Space align="start" wrap style={{ width: '100%' }}>
                  <Form.Item label="发布源">
                    <Select id="access-wizard-release-provider" value={releaseProvider} options={RELEASE_PROVIDER_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} onChange={setReleaseProvider} style={{ width: 180 }} />
                  </Form.Item>
                  <Form.Item label="版本 / Tag" extra="例如 latest、v0.1.0、v2026.03.30">
                    <Input name="releaseVersion" value={releaseVersion} onChange={(event) => setReleaseVersion(event.target.value)} style={{ width: 220 }} placeholder="latest 或 v0.1.0" />
                  </Form.Item>
                </Space>
                {releaseProvider === 'custom' ? (
                  <Form.Item label="发布包基址" extra="例如 GitHub / Gitee Release 下载目录；脚本会自动补上平台包名。">
                    <Input name="releaseBaseUrl" value={releaseBaseUrl} onChange={(event) => setReleaseBaseUrl(event.target.value)} placeholder="例如：https://github.com/<owner>/<repo>/releases/download/v0.1.0" />
                  </Form.Item>
                ) : (
                  <Space align="start" wrap style={{ width: '100%' }}>
                    <Form.Item label="Owner / 组织">
                      <Input name="releaseOwner" value={releaseOwner} onChange={(event) => setReleaseOwner(event.target.value)} placeholder="例如：your-org" style={{ width: 220 }} />
                    </Form.Item>
                    <Form.Item label="仓库名">
                      <Input name="releaseRepo" value={releaseRepo} onChange={(event) => setReleaseRepo(event.target.value)} placeholder="例如：NexusLog" style={{ width: 220 }} />
                    </Form.Item>
                  </Space>
                )}
                {releaseConfigUsesPlaceholder ? (
                  <Alert
                    type="warning"
                    showIcon
                    message="发布地址预览"
                    description={<Typography.Text code style={{ wordBreak: 'break-all' }}>{resolvedReleaseBaseUrl || '-'}</Typography.Text>}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <Typography.Text type="secondary">发布地址预览</Typography.Text>
                    <Typography.Text code style={{ wordBreak: 'break-all' }}>{resolvedReleaseBaseUrl || '-'}</Typography.Text>
                  </div>
                )}
              </Form>
            </Card>

            <Card size="small" type="inner" title="容器镜像（Linux Docker 目标可选）">
              <Form layout="vertical" name="access-wizard-image-config">
                <Form.Item label="镜像来源">
                  <Select id="access-wizard-image-provider" value={containerImageProvider} options={IMAGE_PROVIDER_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} onChange={setContainerImageProvider} style={{ width: 180 }} />
                </Form.Item>
                {containerImageProvider === 'custom' ? (
                  <Form.Item label="容器镜像">
                    <Input name="containerImage" value={containerImage} onChange={(event) => setContainerImage(event.target.value)} placeholder="例如 ghcr.io/<owner>/<repo>/collector-agent:v0.1.0" />
                  </Form.Item>
                ) : (
                  imageConfigUsesPlaceholder ? (
                    <Alert
                      type="warning"
                      showIcon
                      message="镜像地址预览"
                      description={<Typography.Text code style={{ wordBreak: 'break-all' }}>{resolvedContainerImage}</Typography.Text>}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Typography.Text type="secondary">镜像地址预览</Typography.Text>
                      <Typography.Text code style={{ wordBreak: 'break-all' }}>{resolvedContainerImage}</Typography.Text>
                    </div>
                  )
                )}
              </Form>
            </Card>
          </Space>
        </Card>

        <Card size="small" type="inner" title="采集参数">
          <Form layout="vertical" name="access-wizard-source-config">
            <Form.Item label={sourceType === 'syslog' ? 'source_path / 监听标识' : '采集路径'}>
              <Input.TextArea name="sourcePath" rows={2} value={sourcePath} onChange={(event) => setSourcePath(event.target.value)} />
            </Form.Item>
            {sourceType === 'syslog' ? (
              <Space style={{ width: '100%' }} align="start" wrap>
                <Form.Item label="Syslog 协议">
                  <Select
                    id="access-wizard-syslog-protocol"
                    style={{ width: 180 }}
                    value={syslogProtocol}
                    options={[{ label: 'UDP', value: 'udp' }, { label: 'TCP', value: 'tcp' }]}
                    onChange={(value) => setSyslogProtocol(value)}
                  />
                </Form.Item>
                <Form.Item label="监听地址">
                  <Input name="syslogBind" value={syslogBind} onChange={(event) => setSyslogBind(event.target.value)} placeholder="0.0.0.0:5514" />
                </Form.Item>
              </Space>
            ) : null}
            <Space style={{ width: '100%' }} align="start" wrap>
              <Form.Item label="拉取间隔（秒）">
                <InputNumber name="pullIntervalSec" min={2} max={3600} value={pullIntervalSec} onChange={(value) => setPullIntervalSec(Number(value ?? 30))} />
              </Form.Item>
              <Form.Item label="拉取超时（秒）">
                <InputNumber name="pullTimeoutSec" min={5} max={3600} value={pullTimeoutSec} onChange={(value) => setPullTimeoutSec(Number(value ?? 30))} />
              </Form.Item>
            </Space>
          </Form>
        </Card>
      </Space>
    </Card>
  );

  const renderStepThree = () => (
    <Card title="3. 创建并生成部署脚本">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="数据源类型">{SOURCE_TYPE_OPTIONS.find((item) => item.value === sourceType)?.label ?? sourceType}</Descriptions.Item>
          <Descriptions.Item label="数据源名称">{sourceName || '-'}</Descriptions.Item>
          <Descriptions.Item label="Agent 方式">{agentMode === 'existing' ? '绑定现有 Agent' : '生成新主机部署脚本'}</Descriptions.Item>
          <Descriptions.Item label="Agent URL">{agentBaseUrl || '-'}</Descriptions.Item>
          <Descriptions.Item label="版本 / Tag">{normalizedVersion}</Descriptions.Item>
          <Descriptions.Item label="发布源">{RELEASE_PROVIDER_OPTIONS.find((item) => item.value === releaseProvider)?.label ?? releaseProvider}</Descriptions.Item>
          <Descriptions.Item label="发布地址" span={2}><Typography.Text code style={{ wordBreak: 'break-all' }}>{resolvedReleaseBaseUrl || '-'}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="容器镜像" span={2}><Typography.Text code style={{ wordBreak: 'break-all' }}>{resolvedContainerImage || '-'}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="采集路径" span={2}><Typography.Text code style={{ wordBreak: 'break-all' }}>{sourcePath || '-'}</Typography.Text></Descriptions.Item>
          <Descriptions.Item label="拉取间隔">{pullIntervalSec}s</Descriptions.Item>
          <Descriptions.Item label="拉取超时">{pullTimeoutSec}s</Descriptions.Item>
        </Descriptions>

        {(releaseConfigUsesPlaceholder || (deploymentTarget === 'linux-docker' && imageConfigUsesPlaceholder)) ? (
          <Alert
            type="warning"
            showIcon
            message="脚本仍包含占位仓库信息"
            description="请补充 GitHub/Gitee 的 owner、repo 或自定义发布地址后再生成正式部署脚本。"
          />
        ) : null}

        <Typography.Text type="secondary">
          推荐流程：{agentMode === 'new'
            ? '先生成并执行部署脚本，再创建采集源；如果你已经确定目标 Agent URL，也可以先创建设定。'
            : '已有 Agent 可直接创建采集源；如需迁移到新主机，也可以生成一份新的部署脚本。'}
        </Typography.Text>

        <Card size="small" type="inner" title="部署脚本生成">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Select id="access-wizard-deployment-target" value={deploymentTarget} options={DEPLOY_TARGET_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} onChange={setDeploymentTarget} style={{ width: 240 }} />
            <Space>
              <Button loading={scriptLoading} onClick={handleGenerateScript}>生成部署脚本</Button>
              <Button type="primary" loading={submitting} onClick={handleCreate}>创建采集源</Button>
            </Space>
            {scriptResponse ? (
              <Tabs
                items={[
                  {
                    key: 'script',
                    label: '脚本内容',
                    children: (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {scriptResponse.notes?.length ? (
                          <Alert type="success" showIcon message="脚本已生成" description={<ul style={{ margin: 0, paddingLeft: 18 }}>{scriptResponse.notes.map((item) => <li key={item}>{item}</li>)}</ul>} />
                        ) : null}
                        {scriptResponse.command ? (
                          <Card size="small" title="一键命令">
                            <Typography.Paragraph copyable style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace' }}>
                              {scriptResponse.command}
                            </Typography.Paragraph>
                          </Card>
                        ) : null}
                        <Card size="small" title={scriptResponse.file_name} extra={<Typography.Text type="secondary">{scriptResponse.script_kind}</Typography.Text>}>
                          <Typography.Paragraph copyable style={{ marginBottom: 0, whiteSpace: 'pre-wrap', fontFamily: 'JetBrains Mono, monospace' }}>
                            {scriptResponse.script}
                          </Typography.Paragraph>
                        </Card>
                      </Space>
                    ),
                  },
                ]}
              />
            ) : null}
          </Space>
        </Card>
      </Space>
    </Card>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>接入向导</Typography.Title>
          <Typography.Paragraph style={{ margin: '4px 0 0', color: '#94a3b8' }}>
            支持绑定真实 Agent、生成 Linux / Windows / Syslog 接入脚本，并直接创建 pull source 配置。
          </Typography.Paragraph>
        </div>
        <Space>
          <Button onClick={loadAgents}>刷新 Agent</Button>
          <Button onClick={() => navigate('/ingestion/agents')}>查看 Agent</Button>
        </Space>
      </div>

      <Card>
        <Steps current={currentStep} items={[
          { title: '选择来源' },
          { title: '配置 Agent' },
          { title: '创建与部署' },
        ]} />
      </Card>

      {currentStep === 0 ? renderStepOne() : null}
      {currentStep === 1 ? renderStepTwo() : null}
      {currentStep === 2 ? renderStepThree() : null}

      <Divider style={{ margin: 0 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={currentStep === 0} onClick={handlePrev}>上一步</Button>
        <Space>
          <Button onClick={() => navigate('/ingestion/sources')}>取消</Button>
          {currentStep < 2 ? <Button type="primary" onClick={handleNext}>下一步</Button> : null}
        </Space>
      </div>
    </div>
  );
};

export default AccessWizard;
