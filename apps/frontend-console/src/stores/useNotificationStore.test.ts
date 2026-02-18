/**
 * useNotificationStore 属性测试
 * 
 * Property 11: useNotificationStore 状态管理
 * Validates: Requirements 7.3
 * 
 * @module stores/useNotificationStore.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { useNotificationStore } from './useNotificationStore';
import type { NotificationType, CreateNotificationParams } from '@/types/notification';

// ============================================================================
// Mock Ant Design
// ============================================================================

vi.mock('antd', () => ({
  message: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
  notification: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// 测试辅助函数
// ============================================================================

/**
 * 重置 store 到初始状态
 */
function resetStore() {
  useNotificationStore.setState({
    notifications: [],
    unreadCount: 0,
  });
}

/**
 * 有效的通知类型
 */
const notificationTypes: NotificationType[] = ['info', 'success', 'warning', 'error'];

/**
 * 生成有效的通知类型
 */
const notificationTypeArb = fc.constantFrom(...notificationTypes);

/**
 * 生成有效的标题
 */
const titleArb = fc.string({ minLength: 1, maxLength: 100 })
  .filter(s => s.trim().length > 0);

/**
 * 生成有效的消息
 */
const messageArb = fc.string({ minLength: 1, maxLength: 500 })
  .filter(s => s.trim().length > 0);

/**
 * 生成通知参数
 */
const notificationParamsArb: fc.Arbitrary<CreateNotificationParams> = fc.record({
  type: notificationTypeArb,
  title: titleArb,
  message: messageArb,
  duration: fc.constant(0), // 禁用 Ant Design 通知以避免测试问题
});

/**
 * 生成通知参数数组
 */
const notificationParamsArrayArb = fc.array(notificationParamsArb, { minLength: 1, maxLength: 20 });

// ============================================================================
// 属性测试
// ============================================================================

describe('useNotificationStore 属性测试', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  /**
   * Property 11: useNotificationStore 状态管理
   * 
   * 对于任意通知操作序列（添加、删除、标记已读），
   * notifications 列表长度和 unreadCount 应该保持一致——
   * unreadCount 应该等于 notifications 中 read 为 false 的数量。
   * 
   * **Validates: Requirements 7.3**
   */
  describe('Property 11: useNotificationStore 状态管理', () => {
    it('unreadCount 应等于 notifications 中 read 为 false 的数量', () => {
      fc.assert(
        fc.property(notificationParamsArrayArb, (paramsArray) => {
          resetStore();
          
          // 添加多个通知
          paramsArray.forEach(params => {
            useNotificationStore.getState().addNotification(params);
          });
          
          const state = useNotificationStore.getState();
          const actualUnreadCount = state.notifications.filter(n => !n.read).length;
          
          // 验证 unreadCount 一致性
          expect(state.unreadCount).toBe(actualUnreadCount);
        }),
        { numRuns: 100 }
      );
    });

    it('添加通知后 unreadCount 应增加', () => {
      fc.assert(
        fc.property(notificationParamsArb, (params) => {
          resetStore();
          
          const countBefore = useNotificationStore.getState().unreadCount;
          
          useNotificationStore.getState().addNotification(params);
          
          const countAfter = useNotificationStore.getState().unreadCount;
          
          // 添加通知后 unreadCount 应该增加 1
          expect(countAfter).toBe(countBefore + 1);
        }),
        { numRuns: 100 }
      );
    });

    it('删除通知后 unreadCount 应正确更新', () => {
      fc.assert(
        fc.property(notificationParamsArrayArb, (paramsArray) => {
          resetStore();
          
          // 添加多个通知
          const ids = paramsArray.map(params => 
            useNotificationStore.getState().addNotification(params)
          );
          
          // 随机删除一个通知
          if (ids.length > 0) {
            const idToRemove = ids[0];
            const notificationToRemove = useNotificationStore.getState()
              .notifications.find(n => n.id === idToRemove);
            const wasUnread = notificationToRemove && !notificationToRemove.read;
            const countBefore = useNotificationStore.getState().unreadCount;
            
            useNotificationStore.getState().removeNotification(idToRemove);
            
            const countAfter = useNotificationStore.getState().unreadCount;
            
            // 如果删除的是未读通知，unreadCount 应该减少 1
            if (wasUnread) {
              expect(countAfter).toBe(countBefore - 1);
            } else {
              expect(countAfter).toBe(countBefore);
            }
          }
          
          // 验证一致性
          const state = useNotificationStore.getState();
          const actualUnreadCount = state.notifications.filter(n => !n.read).length;
          expect(state.unreadCount).toBe(actualUnreadCount);
        }),
        { numRuns: 100 }
      );
    });

    it('markAsRead 后 unreadCount 应减少', () => {
      fc.assert(
        fc.property(notificationParamsArb, (params) => {
          resetStore();
          
          // 添加通知
          const id = useNotificationStore.getState().addNotification(params);
          
          const countBefore = useNotificationStore.getState().unreadCount;
          expect(countBefore).toBe(1);
          
          // 标记为已读
          useNotificationStore.getState().markAsRead(id);
          
          const countAfter = useNotificationStore.getState().unreadCount;
          expect(countAfter).toBe(0);
          
          // 验证通知状态
          const notification = useNotificationStore.getState()
            .notifications.find(n => n.id === id);
          expect(notification?.read).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('markAllAsRead 后 unreadCount 应为 0', () => {
      fc.assert(
        fc.property(notificationParamsArrayArb, (paramsArray) => {
          resetStore();
          
          // 添加多个通知
          paramsArray.forEach(params => {
            useNotificationStore.getState().addNotification(params);
          });
          
          // 标记全部为已读
          useNotificationStore.getState().markAllAsRead();
          
          const state = useNotificationStore.getState();
          
          // unreadCount 应为 0
          expect(state.unreadCount).toBe(0);
          
          // 所有通知都应该是已读
          state.notifications.forEach(n => {
            expect(n.read).toBe(true);
          });
        }),
        { numRuns: 100 }
      );
    });

    it('clearAll 后 notifications 和 unreadCount 都应为空/0', () => {
      fc.assert(
        fc.property(notificationParamsArrayArb, (paramsArray) => {
          resetStore();
          
          // 添加多个通知
          paramsArray.forEach(params => {
            useNotificationStore.getState().addNotification(params);
          });
          
          // 清除所有
          useNotificationStore.getState().clearAll();
          
          const state = useNotificationStore.getState();
          
          expect(state.notifications).toHaveLength(0);
          expect(state.unreadCount).toBe(0);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：通知列表长度不变量
   */
  describe('通知列表长度不变量', () => {
    it('添加 n 个通知后列表长度应为 n', () => {
      fc.assert(
        fc.property(notificationParamsArrayArb, (paramsArray) => {
          resetStore();
          
          paramsArray.forEach(params => {
            useNotificationStore.getState().addNotification(params);
          });
          
          expect(useNotificationStore.getState().notifications).toHaveLength(paramsArray.length);
        }),
        { numRuns: 100 }
      );
    });

    it('删除通知后列表长度应减少 1', () => {
      fc.assert(
        fc.property(notificationParamsArrayArb, (paramsArray) => {
          resetStore();
          
          const ids = paramsArray.map(params => 
            useNotificationStore.getState().addNotification(params)
          );
          
          const lengthBefore = useNotificationStore.getState().notifications.length;
          
          if (ids.length > 0) {
            useNotificationStore.getState().removeNotification(ids[0]);
            
            const lengthAfter = useNotificationStore.getState().notifications.length;
            expect(lengthAfter).toBe(lengthBefore - 1);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：通知 ID 唯一性
   */
  describe('通知 ID 唯一性', () => {
    it('每个通知应有唯一的 ID', () => {
      fc.assert(
        fc.property(notificationParamsArrayArb, (paramsArray) => {
          resetStore();
          
          const ids = paramsArray.map(params => 
            useNotificationStore.getState().addNotification(params)
          );
          
          // 所有 ID 应该唯一
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：通知顺序
   */
  describe('通知顺序', () => {
    it('新通知应添加到列表开头', () => {
      fc.assert(
        fc.property(
          notificationParamsArb,
          notificationParamsArb,
          (params1, params2) => {
            resetStore();
            
            const id1 = useNotificationStore.getState().addNotification(params1);
            const id2 = useNotificationStore.getState().addNotification(params2);
            
            const notifications = useNotificationStore.getState().notifications;
            
            // 最新的通知应该在前面
            expect(notifications[0].id).toBe(id2);
            expect(notifications[1].id).toBe(id1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * 额外属性：markAsRead 幂等性
   */
  describe('markAsRead 幂等性', () => {
    it('多次 markAsRead 同一通知应该是幂等的', () => {
      fc.assert(
        fc.property(notificationParamsArb, (params) => {
          resetStore();
          
          const id = useNotificationStore.getState().addNotification(params);
          
          // 第一次标记
          useNotificationStore.getState().markAsRead(id);
          const stateAfterFirst = useNotificationStore.getState();
          
          // 第二次标记
          useNotificationStore.getState().markAsRead(id);
          const stateAfterSecond = useNotificationStore.getState();
          
          // 状态应该相同
          expect(stateAfterSecond.unreadCount).toBe(stateAfterFirst.unreadCount);
          expect(stateAfterSecond.notifications.find(n => n.id === id)?.read)
            .toBe(stateAfterFirst.notifications.find(n => n.id === id)?.read);
        }),
        { numRuns: 100 }
      );
    });
  });
});
