import { Action } from 'shared/ReactTypes';
import { Update } from './fiberFlags';
import { Dispatch } from 'react/src/currentDispatcher';
import { Lane, NoLane, isSubsetOfLanes, mergeLanes } from './fiberLanes';
import { FiberNode } from './fiber';

export interface Update<State> {
  action: Action<State>;
  lane: Lane;
  next: Update<any> | null;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
  dispatch: Dispatch<State> | null;
}

/**
 * 返回一个一个有 action 属性的对象，作为 update
 */
export const createUpdate = <State>(action: Action<State>, lane: Lane) => {
  return {
    action,
    lane,
    next: null
  };
};

// create an instance of 'updateQueue'
export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null
    },
    dispatch: null
  } as UpdateQueue<State>;
};

//  Enqueues an update to the update queue.
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>,
  fiber: FiberNode,
  lane: Lane
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;

  fiber.lanes = mergeLanes(fiber.lanes, lane);

  // 为了出问题的时候可以重置
  const current = fiber.alternate;
  if (current) {
    current.lanes = mergeLanes(fiber.lanes, lane);
  }
};

// Process the update queue and return the memoized state,
// which is the the new state after the update.
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane,
  onSkipUpdate?: <State>(update: Update<State>) => void
): {
  memoizedState: State;
  baseState: State;
  baseQueue: Update<State> | null;
} => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState,
    baseState,
    baseQueue: null
  };

  if (pendingUpdate !== null) {
    // 第一个 update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;

    let newBaseState = baseState;
    let newBaseQueueFirst: Update<State> | null = null;
    let newBaseQueueLast: Update<State> | null = null;
    let newState = baseState;

    do {
      const updateLane = pending.lane;
      if (!isSubsetOfLanes(renderLane, updateLane)) {
        // 优先级不够，被跳过
        const clone = createUpdate(pending.action, pending.lane);
        if (onSkipUpdate) onSkipUpdate(clone);
        if (newBaseQueueFirst === null) {
          // 第一个被跳过的 update
          newBaseQueueFirst = clone;
          newBaseQueueLast = clone;
          newBaseState = newState;
        } else {
          (newBaseQueueLast as Update<State>).next = clone;
          newBaseQueueLast = clone;
        }
      } else {
        if (newBaseQueueLast !== null) {
          const clone = createUpdate(pending.action, NoLane);
          newBaseQueueLast = clone;
          newBaseQueueLast = clone;
        }
        // 执行计算过程
        const action = pending.action;
        if (action instanceof Function) {
          newState = action(baseState);
        } else {
          // react 启动阶段走这里，直接返回 action
          // 此时的 action 指的是 ReactElement
          newState = action;
        }
      }
      pending = pending.next as Update<State>;
    } while (pending !== first);

    if (newBaseQueueLast === null) {
      // 本次计算没有 update 被跳过
      newBaseState = newState;
    } else {
      newBaseQueueLast.next = newBaseQueueFirst;
    }
    result.memoizedState = newState;
    result.baseState = newBaseState;
    result.baseQueue = newBaseQueueLast;
  }

  return result;
};
