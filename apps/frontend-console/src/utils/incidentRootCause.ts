import { COLORS } from '../theme/tokens';
import type { RootCauseCategory } from '../types/incident';

export const ROOT_CAUSE_CONFIG: Record<RootCauseCategory, { label: string; color: string }> = {
  config: { label: '配置错误', color: COLORS.warning },
  capacity: { label: '容量不足', color: '#f97316' },
  dependency: { label: '依赖故障', color: COLORS.danger },
  code_defect: { label: '代码缺陷', color: '#8b5cf6' },
  security: { label: '安全事件', color: '#ef4444' },
  network: { label: '网络问题', color: COLORS.info },
  hardware: { label: '硬件故障', color: '#64748b' },
  unknown: { label: '待补充', color: '#94a3b8' },
};

export function classifyRootCause(rootCause?: string): RootCauseCategory {
  const text = (rootCause || '').toLowerCase();
  if (!text) return 'unknown';
  if (/(配置|参数|证书|密钥|权限|config|setting|certificate|secret|permission)/.test(text)) return 'config';
  if (/(容量|磁盘|内存|cpu|负载|堆|oom|capacity|memory|disk|heap)/.test(text)) return 'capacity';
  if (/(依赖|数据库|es|redis|kafka|mq|dependency|upstream|downstream|mysql|postgres)/.test(text)) return 'dependency';
  if (/(代码|缺陷|bug|异常逻辑|panic|nil pointer|defect|regression)/.test(text)) return 'code_defect';
  if (/(安全|攻击|漏洞|入侵|security|cve|attack)/.test(text)) return 'security';
  if (/(网络|连接|超时|dns|丢包|gateway|network|timeout)/.test(text)) return 'network';
  if (/(硬件|主机|节点|磁盘阵列|电源|hardware|host|node)/.test(text)) return 'hardware';
  return 'unknown';
}
