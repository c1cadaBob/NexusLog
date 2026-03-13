import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../src/types/log';
import { mapAuditLogEntry, parseAuditMessage } from '../src/api/audit';

describe('parseAuditMessage', () => {
  it('extracts user, type, process and address from auditd message', () => {
    const parsed = parseAuditMessage(
      'type=USER_LOGIN msg=audit(1773399501.815:9061): pid=2813186 uid=0 auid=1002 ses=63 msg=\'op=login id=1002 exe="/usr/sbin/sshd" hostname=? addr=192.168.0.101 terminal=ssh res=success\' UID="root" AUID="testdev" ID="testdev"',
    );

    expect(parsed.type).toBe('USER_LOGIN');
    expect(parsed.sequence).toBe('9061');
    expect(parsed.pid).toBe('2813186');
    expect(parsed.user).toBe('testdev');
    expect(parsed.operation).toBe('login');
    expect(parsed.result).toBe('success');
    expect(parsed.address).toBe('192.168.0.101');
    expect(parsed.process).toBe('sshd');
  });
});

describe('mapAuditLogEntry', () => {
  it('maps audit.log query hit into audit table row', () => {
    const entry: LogEntry = {
      id: 'audit-1',
      timestamp: '2026-03-13T11:00:00Z',
      level: 'info',
      service: 'audit.log',
      host: 'dev-server-centos8',
      hostIp: '192.168.0.202',
      message:
        'type=USER_LOGIN msg=audit(1773399501.815:9061): pid=2813186 uid=0 auid=1002 ses=63 msg=\'op=login id=1002 exe="/usr/sbin/sshd" hostname=? addr=192.168.0.101 terminal=ssh res=success\' UID="root" AUID="testdev" ID="testdev"',
      fields: {
        tenant_id: '00000000-0000-0000-0000-000000000001',
        source: '/var/log/audit/audit.log',
      },
    };

    const row = mapAuditLogEntry(entry);
    expect(row.user_id).toBe('testdev');
    expect(row.action).toBe('USER_LOGIN');
    expect(row.resource_type).toBe('sshd');
    expect(row.resource_id).toBe('9061');
    expect(row.ip_address).toBe('192.168.0.101');
    expect(row.detail?.source).toBe('/var/log/audit/audit.log');
  });

  it('falls back to host ip and service when audit fields are sparse', () => {
    const entry: LogEntry = {
      id: 'audit-2',
      timestamp: '2026-03-13T11:01:00Z',
      level: 'info',
      service: 'audit.log',
      host: 'dev-server-centos8',
      hostIp: '192.168.0.202',
      message: 'type=ANOM_PROMISCUOUS msg=audit(1773399501.815:9062): dev=veth123 prom=256 old_prom=0 auid=4294967295 uid=0 gid=0 ses=4294967295',
    };

    const row = mapAuditLogEntry(entry);
    expect(row.user_id).toBe('0');
    expect(row.action).toBe('ANOM_PROMISCUOUS');
    expect(row.resource_type).toBe('audit.log');
    expect(row.ip_address).toBe('192.168.0.202');
  });
});
