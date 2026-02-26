import { create } from 'zustand';
import type { Incident, IncidentStatus } from '../types/incident';

export interface IncidentState {
  /** 各状态的事件计数 */
  statusCounts: Record<IncidentStatus, number>;
  /** 待处理事件总数（未归档） */
  openCount: number;
  /** 刷新计数器 */
  refreshStatusCounts: () => void;
}

/** 模拟统计数据 */
const INITIAL_COUNTS: Record<IncidentStatus, number> = {
  detected: 2,
  alerted: 3,
  acknowledged: 5,
  analyzing: 2,
  mitigated: 1,
  resolved: 8,
  postmortem: 3,
  archived: 42,
};

export const useIncidentStore = create<IncidentState>()((set) => ({
  statusCounts: INITIAL_COUNTS,
  openCount: Object.entries(INITIAL_COUNTS)
    .filter(([k]) => k !== 'archived')
    .reduce((sum, [, v]) => sum + v, 0),
  refreshStatusCounts: () =>
    set((state) => ({
      ...state,
      openCount: Object.entries(state.statusCounts)
        .filter(([k]) => k !== 'archived')
        .reduce((sum, [, v]) => sum + v, 0),
    })),
}));
