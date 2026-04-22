import { describe, expect, it } from 'vitest';

import type { IngestAgentItem, PullSource } from '../src/api/ingest';
import {
  buildAgentOptionLabel,
  buildAgentOptionValue,
  buildPullSourceOverlapMessage,
  findOverlappingActivePullSource,
  pullSourcePathsOverlap,
} from '../src/pages/ingestion/accessWizardHelpers';

describe('accessWizardHelpers', () => {
  it('builds distinct option values for the same agent id on different endpoints', () => {
    const first = {
      agent_id: 'collector-agent-local',
      agent_base_url: 'http://172.29.0.1:16066',
    } as IngestAgentItem;
    const second = {
      agent_id: 'collector-agent-local',
      agent_base_url: 'http://collector-agent:9091',
    } as IngestAgentItem;

    expect(buildAgentOptionValue(first)).not.toBe(buildAgentOptionValue(second));
  });

  it('includes endpoint information in the agent option label', () => {
    const agent = {
      agent_id: 'collector-agent-local',
      hostname: 'dev-server-centos8',
      agent_base_url: 'http://collector-agent:9091',
      status: 'online',
      live_connected: true,
    } as IngestAgentItem;

    expect(buildAgentOptionLabel(agent)).toContain('http://collector-agent:9091');
    expect(buildAgentOptionLabel(agent)).toContain('online / 在线');
  });

  it('matches overlapping paths on the same endpoint', () => {
    expect(pullSourcePathsOverlap('/var/log/messages', '/var/log/messages')).toBe(true);
    expect(pullSourcePathsOverlap('/var/log/*.log', '/host-docker-containers/*/*-json.log')).toBe(false);
  });

  it('finds the active conflicting pull source', () => {
    const existingSources = [
      {
        source_id: 'source-a',
        name: 'local-host-buffered-logs',
        path: '/var/log/*.log,/var/log/messages',
        agent_base_url: 'http://collector-agent:9091',
        status: 'active',
      },
      {
        source_id: 'source-b',
        name: 'disabled-source',
        path: '/var/log/*.log',
        agent_base_url: 'http://collector-agent:9091',
        status: 'disabled',
      },
    ] as PullSource[];

    const conflict = findOverlappingActivePullSource(existingSources, {
      agent_base_url: 'http://collector-agent:9091/',
      path: '/var/log/messages',
      status: 'active',
    });

    expect(conflict?.source_id).toBe('source-a');
  });

  it('builds a Chinese overlap message with the conflicting source name', () => {
    const message = buildPullSourceOverlapMessage({
      source_id: 'source-a',
      name: 'local-host-buffered-logs',
      path: '/var/log/*.log',
      agent_base_url: 'http://collector-agent:9091',
      status: 'active',
    } as PullSource);

    expect(message).toContain('local-host-buffered-logs');
    expect(message).toContain('/var/log/*.log');
    expect(message).toContain('采集源管理');
  });
});
