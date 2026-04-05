import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Card, Empty, Spin, Tag, Tooltip } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { fetchIncidentDetail, fetchIncidentTimeline } from '../../api/incident';
import type { Incident, TimelineEvent } from '../../types/incident';
import {
  buildIncidentArchiveReportFilename,
  downloadBlobFile,
  downloadIncidentArchiveMarkdown,
  formatIncidentReportDateTime,
  shouldAllowIncidentArchiveReport,
} from '../../utils/incidentArchiveReport';
import { useAuthStore } from '../../stores/authStore';
import {
  getIncidentPermissionDeniedReason,
  resolveIncidentActionAccess,
} from './incidentAuthorization';
import AnalysisPageHeader from '../../components/common/AnalysisPageHeader';

const IncidentArchiveReport: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const permissions = useAuthStore((state) => state.permissions);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [searchParams] = useSearchParams();
  const autoPrint = searchParams.get('print') === '1';
  const autoPrintTriggeredRef = useRef(false);
  const [incident, setIncident] = useState<Incident | null>(null);
  const authorization = useMemo(() => ({ permissions, capabilities }), [capabilities, permissions]);
  const actionAccess = useMemo(() => resolveIncidentActionAccess(authorization), [authorization]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const loadReport = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [detail, incidentTimeline] = await Promise.all([
        fetchIncidentDetail(id),
        fetchIncidentTimeline(id),
      ]);
      setIncident(detail);
      setTimeline(incidentTimeline);
      setLastUpdatedAt(new Date());
    } catch (err) {
      const nextError = err instanceof Error ? err.message : '加载归档报告失败';
      setError(nextError);
      message.error(nextError);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!autoPrint || autoPrintTriggeredRef.current || loading || !incident || !shouldAllowIncidentArchiveReport(incident)) {
      return;
    }
    autoPrintTriggeredRef.current = true;
    const timer = window.setTimeout(() => {
      window.print();
    }, 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint, incident, loading]);

  const sortedTimeline = useMemo(() => [...timeline].sort((left, right) => left.timestamp - right.timestamp), [timeline]);

  const handleDownloadMarkdown = useCallback(() => {
    if (!incident) return;
    if (!shouldAllowIncidentArchiveReport(incident)) {
      message.warning('仅支持导出已归档事件报告');
      return;
    }
    downloadIncidentArchiveMarkdown(incident, sortedTimeline);
    message.success('Markdown 报告已开始下载');
  }, [incident, sortedTimeline]);

  const handleDownloadHtml = useCallback(() => {
    if (!incident) return;
    const html = document.documentElement.outerHTML;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlobFile(blob, buildIncidentArchiveReportFilename(incident, 'html'));
    message.success('HTML 报告已开始下载');
  }, [incident]);

  if (loading) {
    return <Spin fullscreen size="large" tip="加载事件归档报告..." />;
  }

  if (error || !incident) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
        <Card style={{ width: '100%', maxWidth: 720 }}>
          <Empty description={error || '未找到事件归档报告'} />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
            <Button type="primary" onClick={() => navigate('/incidents/archive')}>返回归档列表</Button>
          </div>
        </Card>
      </div>
    );
  }

  const archived = shouldAllowIncidentArchiveReport(incident);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a' }}>
      <style>{`
        @media print {
          .incident-report-toolbar { display: none !important; }
          .incident-report-shell { padding: 0 !important; background: #fff !important; }
          .incident-report-card { box-shadow: none !important; border: none !important; }
          body { background: #fff !important; }
        }
      `}</style>
      <div className="incident-report-shell" style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
        <div className="incident-report-toolbar" style={{ marginBottom: 16 }}>
          <AnalysisPageHeader
            title="事件归档报告"
            subtitle="用于归档留痕、复盘共享与外部汇报"
            statusTag={(
              <>
                <Tag color="blue" style={{ margin: 0 }}>事件 ID：{incident.id}</Tag>
                <Tag color={archived ? 'success' : 'warning'} style={{ margin: 0 }}>{archived ? '已归档' : '未归档'}</Tag>
                <Tag color="purple" style={{ margin: 0 }}>{incident.severity}</Tag>
              </>
            )}
            lastUpdatedAt={lastUpdatedAt}
            actions={(
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Button size="small" onClick={() => navigate('/incidents/archive')}>返回归档列表</Button>
                <Button size="small" icon={<span className="material-symbols-outlined text-sm">support_agent</span>} onClick={() => navigate('/help/faq')}>帮助</Button>
                <Tooltip title={actionAccess.canReadIncident ? '打开事件详情' : getIncidentPermissionDeniedReason('read')}>
                  <Button size="small" disabled={!actionAccess.canReadIncident} onClick={() => navigate(`/incidents/detail/${incident.id}`)}>打开事件详情</Button>
                </Tooltip>
                <Button size="small" icon={<span className="material-symbols-outlined text-sm">refresh</span>} onClick={() => void loadReport()}>刷新数据</Button>
                <Button size="small" icon={<span className="material-symbols-outlined text-sm">description</span>} onClick={handleDownloadMarkdown}>下载 Markdown</Button>
                <Button size="small" icon={<span className="material-symbols-outlined text-sm">code</span>} onClick={handleDownloadHtml}>下载 HTML</Button>
                <Button size="small" type="primary" icon={<span className="material-symbols-outlined text-sm">picture_as_pdf</span>} onClick={() => window.print()}>保存为 PDF</Button>
              </div>
            )}
          />
        </div>

        {!archived && (
          <Alert
            style={{ marginBottom: 16 }}
            type="warning"
            message="当前事件尚未归档"
            description="建议在归档完成并填写研判结论后再导出正式报告。"
            showIcon
          />
        )}

        <Card className="incident-report-card" style={{ borderRadius: 16, boxShadow: '0 8px 30px rgba(15, 23, 42, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#475569' }}>归档快照</div>
            </div>
          </div>

          <section style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>基本信息</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <InfoCard label="标题" value={incident.title} />
              <InfoCard label="负责人" value={incident.assignee || '未分配'} />
              <InfoCard label="创建人" value={incident.createdBy || '未知'} />
              <InfoCard label="来源告警" value={incident.sourceAlertId || '-'} mono />
              <InfoCard label="检测时间" value={formatIncidentReportDateTime(incident.detectedAt)} />
              <InfoCard label="归档时间" value={formatIncidentReportDateTime(incident.archivedAt)} />
              <InfoCard label="响应时间" value={formatIncidentReportDateTime(incident.ackedAt)} />
              <InfoCard label="解决时间" value={formatIncidentReportDateTime(incident.resolvedAt)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <InfoBlock label="事件描述" value={incident.description || '暂无描述'} />
            </div>
          </section>

          <section style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>归档结论</div>
            <InfoBlock label="研判结论" value={incident.verdict || '暂无研判结论'} emphasize />
          </section>

          <section style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>分析与处置</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <InfoBlock label="根因分析" value={incident.rootCause || '暂无根因分析'} />
              <InfoBlock label="处置方案" value={incident.resolution || '暂无处置方案'} />
            </div>
          </section>

          <section>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>处理时间线</div>
            {sortedTimeline.length === 0 ? (
              <Empty description="暂无时间线记录" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sortedTimeline.map((event, index) => (
                  <div key={event.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>{index + 1}. {event.title || event.type}</div>
                      <div style={{ color: '#64748b', fontSize: 12 }}>{formatIncidentReportDateTime(event.timestamp)}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#475569', marginBottom: 6 }}>{event.description || '-'}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8' }}>操作人：{event.operator || '系统'}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Card>
      </div>
    </div>
  );
};

const InfoCard: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 14, background: '#fff' }}>
    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 14, fontWeight: 500, fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
  </div>
);

const InfoBlock: React.FC<{ label: string; value: string; emphasize?: boolean }> = ({ label, value, emphasize }) => (
  <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: emphasize ? '#f8fafc' : '#fff', minHeight: 120 }}>
    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>{label}</div>
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 14 }}>{value}</div>
  </div>
);

export default IncidentArchiveReport;
