import { Action } from 'shared/ReactTypes';
import { Update } from './fiberFlags';

export interface Update<State> {
  action: Action<State>;
}

export interface UpdateQueue<State> {
  shared: {
    pending: Update<State> | null;
  };
}

/**
 * 返回一个一个有 action 属性的对象，作为 update
 */
export const createUpdate = <State>(action: Action<State>) => {
  return {
    action
  };
};

// create an instance of 'updateQueue'
export const createUpdateQueue = <State>() => {
  return {
    shared: {
      pending: null
    }
  } as UpdateQueue<State>;
};

//  Enqueues an update to the update queue.
export const enqueueUpdate = <State>(
  updateQueue: UpdateQueue<State>,
  update: Update<State>
) => {
  updateQueue.shared.pending = update;
};

// Process the update queue and return the memoized state,
// which is the the new state after the update.
export const processUpdateQueue = <State>(
  baseState: State,
  pendingUpdate: Update<State> | null
): { memoizedState: State } => {
  const result: ReturnType<typeof processUpdateQueue<State>> = {
    memoizedState: baseState
  };
  if (pendingUpdate !== null) {
    const action = pendingUpdate.action;
    if (action instanceof Function) {
      result.memoizedState = action(baseState);
    } else {
      // react 启动阶段走这里，直接返回 action
      // 此时的 action 指的是 ReactElement
      result.memoizedState = action;
    }
  }

  return result;
};
