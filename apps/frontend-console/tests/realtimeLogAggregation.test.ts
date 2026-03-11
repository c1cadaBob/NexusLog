import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../src/types/log';
import { aggregateRealtimeDisplayLogs, summarizeImageAggregation } from '../src/pages/search/realtimeLogAggregation';

function buildLog(id: string, message: string, timestamp = '2026-03-11T10:29:56Z'): LogEntry {
  return {
    id,
    timestamp,
    level: 'info',
    service: 'journal.log',
    host: 'localhost.localdomain',
    hostIp: '192.168.0.202',
    message,
    rawLog: message,
    fields: {},
  };
}

describe('aggregateRealtimeDisplayLogs', () => {
  it('aggregates consecutive image asset listing logs into one display row', () => {
    const logs = [
      buildLog('1', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: -rw-r--r-- 1 root root 1580 May 30 2020 usr/share/plymouth/themes/spinner/throbber-0030.png'),
      buildLog('2', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: -rw-r--r-- 1 root root 1588 May 30 2020 usr/share/plymouth/themes/spinner/throbber-0029.png'),
      buildLog('3', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: -rw-r--r-- 1 root root 1614 May 30 2020 usr/share/plymouth/themes/spinner/throbber-0028.png'),
      buildLog('4', 'Dec 21 04:51:27 localhost.localdomain systemd[1]: Started Daily Cleanup of Temporary Directories.'),
    ];

    const result = aggregateRealtimeDisplayLogs(logs);
    expect(result).toHaveLength(2);
    expect(result[0].aggregated?.count).toBe(3);
    expect(result[0].message).toContain('图片资源日志已聚合');
    expect(result[0].message).toContain('spinner/*.png');
    expect(result[0].rawLog).toContain('throbber-0030.png');
    expect(result[0].rawLog).toContain('throbber-0028.png');
    expect(result[1].id).toBe('4');
  });

  it('keeps short image bursts unaggregated', () => {
    const logs = [
      buildLog('1', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: usr/share/plymouth/themes/spinner/throbber-0030.png'),
      buildLog('2', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: usr/share/plymouth/themes/spinner/throbber-0029.png'),
    ];

    const result = aggregateRealtimeDisplayLogs(logs);
    expect(result).toHaveLength(2);
    expect(result[0].aggregated).toBeUndefined();
  });

  it('summarizes folded image rows', () => {
    const logs = aggregateRealtimeDisplayLogs([
      buildLog('1', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: usr/share/plymouth/themes/spinner/throbber-0030.png'),
      buildLog('2', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: usr/share/plymouth/themes/spinner/throbber-0029.png'),
      buildLog('3', 'Dec 21 04:51:26 localhost.localdomain dracut[57041]: usr/share/plymouth/themes/spinner/throbber-0028.png'),
      buildLog('4', 'Dec 21 04:51:27 localhost.localdomain systemd[1]: Started Daily Cleanup of Temporary Directories.'),
    ]);

    expect(summarizeImageAggregation(logs)).toEqual({ groupedRows: 1, hiddenRows: 2 });
  });
});
