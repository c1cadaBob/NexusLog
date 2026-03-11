import { describe, expect, it } from 'vitest';
import { resolveLogHost, resolveLogHostIP, resolveLogService } from '../src/api/query';

describe('resolveLogHost', () => {
  it('prefers structured host field', () => {
    expect(resolveLogHost({ host: 'node-a' })).toBe('node-a');
  });

  it('falls back to host.name and hostname variants', () => {
    expect(resolveLogHost({ 'host.name': 'node-b' } as Record<string, unknown>)).toBe('node-b');
    expect(resolveLogHost({ hostname: 'node-c' })).toBe('node-c');
    expect(resolveLogHost({ syslog_hostname: 'node-d' })).toBe('node-d');
  });

  it('extracts hostname from syslog message when structured field is missing', () => {
    expect(resolveLogHost({}, 'Dec 21 12:01:58 localhost.localdomain chronyd[2304]: sync ok')).toBe('localhost.localdomain');
  });

  it('returns placeholder when host cannot be determined', () => {
    expect(resolveLogHost({}, 'plain application log without hostname')).toBe('—');
  });
});

describe('resolveLogHostIP', () => {
  it('prefers structured host ip field', () => {
    expect(resolveLogHostIP({ host_ip: '10.0.0.8' })).toBe('10.0.0.8');
    expect(resolveLogHostIP({ 'host.ip': '10.0.0.9' } as Record<string, unknown>)).toBe('10.0.0.9');
  });

  it('supports array-shaped ecs host.ip values', () => {
    expect(resolveLogHostIP({ 'host.ip': ['10.0.0.10', 'fe80::1'] } as Record<string, unknown>)).toBe('10.0.0.10');
  });

  it('returns placeholder when host ip is missing', () => {
    expect(resolveLogHostIP({ host: 'node-a' })).toBe('—');
  });
});

describe('resolveLogService', () => {
  it('prefers explicit service names', () => {
    expect(resolveLogService({ service_name: 'nginx' }, 'nginx')).toBe('nginx');
    expect(resolveLogService({ container_name: 'order-api-1' })).toBe('order-api-1');
  });

  it('falls back to file name when parsed service is a syslog month token', () => {
    expect(resolveLogService({ service_name: 'Dec', source_path: '/var/log/anaconda/journal.log' }, 'Dec')).toBe('journal.log');
  });

  it('falls back to file name when service candidate looks like a JSON envelope', () => {
    expect(resolveLogService({ service_name: '{"log":"[GIN]"', source_path: '/var/log/messages' }, '{"log":"[GIN]"')).toBe('messages');
  });
});
