import { Action } from 'shared/ReactTypes';
import { Update } from './fiberFlags';
import { Dispatch } from 'react/src/currentDispatcher';
import { Lane } from './fiberLanes';

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
  update: Update<State>
) => {
  const pending = updateQueue.shared.pending;
  if (pending === null) {
    update.next = update;
  } else {
    update.next = pending.next;
    pending.next = update;
  }
  updateQueue.shared.pending = update;
};

// Process the update queue and return the memoized state,
// which is the the new state after the update.
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null,
  renderLane: Lane
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };
  if (pendingUpdate !== null) {
    // 第一个 update
    const first = pendingUpdate.next;
    let pending = pendingUpdate.next as Update<any>;

    do {
      const updateLane = pending.lane;
      if (updateLane === renderLane) {
        // 执行计算过程
        const action = pending.action;
        if (action instanceof Function) {
          baseState = action(baseState);
        } else {
          // react 启动阶段走这里，直接返回 action
          // 此时的 action 指的是 ReactElement
          baseState = action;
        }
      } else {
        // 不是
        if (__DEV__) {
          console.warn('only SyncLane impled for now');
        }
      }
      pending = pending.next as Update<State>;
    } while (pending !== first);
  }
  result.memoizedState = baseState;

  return result;
};
