import { describe, expect, it } from 'vitest';

import { buildAuditDetailSummary } from '../src/pages/security/auditDetailSummary';

describe('buildAuditDetailSummary', () => {
  it('includes pull source path and port details', () => {
    const summary = buildAuditDetailSummary({
      result: 'success',
      source_name: 'audit-source-ui-20260313-2150-updated',
      host: '127.0.0.1',
      port: 65535,
      protocol: 'http',
      path: '/tmp/nexuslog-source-ui-20260313-2150-updated.log',
      status: 'disabled',
      updated_fields: ['status'],
    });

    expect(summary).toContain('res=success');
    expect(summary).toContain('source=audit-source-ui-20260313-2150-updated');
    expect(summary).toContain('host=127.0.0.1');
    expect(summary).toContain('port=65535');
    expect(summary).toContain('path=/tmp/nexuslog-source-ui-20260313-2150-updated.log');
    expect(summary).toContain('status=disabled');
    expect(summary).toContain('fields=status');
  });

  it('falls back to raw_message when structured fields are missing', () => {
    const summary = buildAuditDetailSummary({ raw_message: 'plain audit event' });
    expect(summary).toBe('plain audit event');
  });
});
