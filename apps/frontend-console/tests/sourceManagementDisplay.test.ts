import { describe, expect, it } from 'vitest';
import {
  compactSourceID,
  getSourceDisplayIcon,
  inferSourceDisplayType,
  sourceDisplayTypeToFilterGroup,
  splitSourcePaths,
  summarizeSourcePath,
} from '../src/pages/ingestion/sourceManagementDisplay';

describe('sourceManagementDisplay helpers', () => {
  it('infers file/log type for file-like HTTP pull sources', () => {
    expect(inferSourceDisplayType({ protocol: 'http', path: '/var/log/*.log,/var/log/messages' } as never)).toBe('File / Log');
    expect(sourceDisplayTypeToFilterGroup({ protocol: 'http', path: '/host-docker-containers/*/*-json.log' } as never)).toBe('File');
    expect(getSourceDisplayIcon({ protocol: 'http', path: '/host-docker-containers/*/*-json.log' } as never)).toBe('description');
  });

  it('keeps HTTP type for API-style paths', () => {
    expect(inferSourceDisplayType({ protocol: 'http', path: '/api/logs' } as never)).toBe('HTTP');
    expect(getSourceDisplayIcon({ protocol: 'http', path: '/api/logs' } as never)).toBe('public');
  });

  it('splits and summarizes multi-path values', () => {
    expect(splitSourcePaths('/var/log/a.log, /var/log/b.log')).toEqual(['/var/log/a.log', '/var/log/b.log']);
    expect(summarizeSourcePath('/var/log/a.log, /var/log/b.log')).toEqual({
      label: '/var/log/a.log',
      extraCount: 1,
      fullText: '/var/log/a.log\n/var/log/b.log',
    });
  });

  it('compacts long ids for table display', () => {
    expect(compactSourceID('238ca845-9c01-4a0b-867f-7599407a87d0')).toBe('238ca845…407a87d0');
  });
});
